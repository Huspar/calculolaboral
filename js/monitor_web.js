/*
 * CalculoLaboral · Monitor Tributario y Previsional (v1.0.0)
 * Autodiagnóstico de plazos (acuse RCV 8 días, Previred, F29, TGR) + formularios de
 * alertas por correo y de acceso anticipado. Todo el chequeo corre en el navegador.
 */
(function (doc) {
    'use strict';

    var PREGUNTAS = [
        {
            id: 'acuse',
            critica: true,
            texto: '¿Revisaste en sii.cl que no te queden facturas de compra sin acuse de recibo dentro del plazo de 8 días corridos?',
            accion: 'Entra al RCV de Compras en sii.cl y acepta o rechaza los DTE pendientes: si dejas pasar los 8 días, la factura queda irrevocablemente aceptada y pierdes el reclamo por contenido o falta de entrega (el crédito fiscal se difiere al mes de la aceptación tácita).',
            enlace: { texto: 'Ver la guía Previred, LRE y F29', href: 'como-generar-archivo-previred-lre-f29-chile' }
        },
        {
            id: 'pendientes',
            critica: false,
            texto: '¿Detectaste compras que siguen con estado PENDIENTE en tu RCV del mes pasado?',
            accion: 'Un proveedor que aún no emitió la factura te deja sin crédito fiscal: pídele el DTE y revisa el estado PENDIENTE de tu RCV antes del cierre del mes.',
            enlace: { texto: 'Simular el F29 con tu RCV', href: 'calculadora-f29-chile' }
        },
        {
            id: 'previred',
            critica: true,
            texto: '¿Pagaste las cotizaciones del mes anterior en Previred dentro de los primeros 10 días corridos de este mes?',
            accion: 'Revisa en previred.com que la nómina del mes anterior esté declarada y pagada: el atraso genera reajustes, intereses y multas de la Dirección del Trabajo.',
            enlace: { texto: 'Conciliar el pago con tu cartola', href: 'conciliacion-bancaria-cartola-excel' }
        },
        {
            id: 'f29',
            critica: true,
            texto: '¿Declaraste y pagaste el F29 del mes anterior antes de tu vencimiento (día 12, 20 o 28 según tu medio de declaración)?',
            accion: 'Declara y paga el F29 en sii.cl antes de tu vencimiento: las multas e intereses por atraso se declaran en el propio formulario (códigos 92, 93 y 94).',
            enlace: { texto: 'Simular mi F29 con RCV SII', href: 'calculadora-f29-chile' }
        },
        {
            id: 'tgr',
            critica: false,
            texto: '¿Revisaste este mes los giros y convenios de tu empresa en el portal de deudas de la Tesorería (TGR)?',
            accion: 'Consulta tus giros impagos y convenios en tgr.cl: la Tesorería notifica en tu domicilio tributario y luego cobra por vía administrativa (retención de devoluciones) y judicial (embargos y costas del juicio).',
            enlace: { texto: 'Ver el chequeo del mes siguiente', href: '#alertas-correo' }
        },
        {
            id: 'bhe',
            critica: false,
            texto: 'Si emites o recibes boletas de honorarios: ¿revisaste tu registro BHE del mes en sii.cl?',
            accion: 'El registro BHE define tu retención y tus PPM del mes: revisarlo evita sorpresas en la Operación Renta.',
            enlace: { texto: 'Revisar mis boletas y renta anual', href: 'calculadora-boleta-honorarios-chile' }
        },
        {
            id: 'claves',
            critica: false,
            texto: '¿Sabes quiénes tienen tu Clave Tributaria del SII y la cambiaste en los últimos 12 meses?',
            accion: 'Cambia la Clave Tributaria si no recuerdas quién la usa: el acceso compartido con ex-colaboradores es el riesgo más común en pymes.',
            enlace: null
        }
    ];

    var respuestas = {}; // id -> 'si' | 'no' | 'nose'

    function pesos(r) {
        if (r === 'no') return 3;
        if (r === 'nose') return 2;
        return 0;
    }

    function nivelPara(puntos, respondidas) {
        if (respondidas === 0) return { texto: 'Responde para ver tu resultado', color: '#FFB703' };
        if (puntos <= 2) return { texto: 'Riesgo bajo: sigue al día', color: '#FFB703' };
        if (puntos <= 5) return { texto: 'Atención: revisa lo marcado en rojo', color: '#FFB703' };
        return { texto: 'Riesgo alto: prioriza estos plazos hoy', color: '#FFB703' };
    }

    function render() {
        var cont = doc.getElementById('mon-preguntas');
        if (!cont) return;
        cont.innerHTML = '';
        PREGUNTAS.forEach(function (p, i) {
            var div = doc.createElement('div');
            div.className = 'mon-pregunta p-4 sm:p-4.5 space-y-3';
            var num = doc.createElement('p');
            num.className = 'text-xs font-bold text-slate-500 m-0';
            num.textContent = 'Pregunta ' + (i + 1) + (p.critica ? ' · crítica' : '');
            var txt = doc.createElement('p');
            txt.className = 'text-sm font-semibold text-slate-900 m-0 leading-snug';
            txt.textContent = p.texto;
            var fila = doc.createElement('div');
            fila.className = 'flex flex-wrap gap-2';
            [['si', 'Sí'], ['no', 'No'], ['nose', 'No sé']].forEach(function (par) {
                var b = doc.createElement('button');
                b.type = 'button';
                b.className = 'mon-opcion op-' + par[0];
                b.textContent = par[1];
                b.setAttribute('aria-pressed', respuestas[p.id] === par[0] ? 'true' : 'false');
                b.addEventListener('click', function () {
                    respuestas[p.id] = par[0];
                    actualizar();
                });
                fila.appendChild(b);
            });
            div.appendChild(num);
            div.appendChild(txt);
            div.appendChild(fila);
            cont.appendChild(div);
        });
        actualizar();
    }

    function actualizar() {
        // botones presionados
        var botones = doc.querySelectorAll('#mon-preguntas .mon-opcion');
        var orden = ['si', 'no', 'nose'];
        botones.forEach(function (b, i) {
            var pIdx = Math.floor(i / 3);
            var p = PREGUNTAS[pIdx];
            var val = orden[i % 3];
            b.setAttribute('aria-pressed', respuestas[p.id] === val ? 'true' : 'false');
        });

        var respondidas = 0, puntos = 0, criticas = 0;
        PREGUNTAS.forEach(function (p) {
            var r = respuestas[p.id];
            if (r) respondidas++;
            var w = pesos(r);
            puntos += w;
            if (p.critica && r && r !== 'si') criticas++;
        });

        doc.getElementById('mon-progreso').textContent = respondidas + ' de ' + PREGUNTAS.length + ' respondidas';
        doc.getElementById('mon-contadas').textContent = respondidas + '/' + PREGUNTAS.length;
        doc.getElementById('mon-puntos').textContent = respondidas ? String(puntos) : '—';
        doc.getElementById('mon-criticas').textContent = respondidas ? String(criticas) : '—';

        var nivel = nivelPara(puntos, respondidas);
        var el = doc.getElementById('mon-nivel');
        el.textContent = nivel.texto;
        el.style.color = nivel.color;

        var lista = doc.getElementById('mon-acciones-lista');
        lista.innerHTML = '';
        PREGUNTAS.forEach(function (p) {
            var r = respuestas[p.id];
            if (!r || r === 'si') return;
            var li = doc.createElement('li');
            li.className = 'p-3 rounded-xl bg-slate-50 border border-slate-100';
            var strong = doc.createElement('div');
            strong.className = 'font-bold text-slate-900 mb-1';
            strong.textContent = (r === 'no' ? 'Pendiente: ' : 'Por confirmar: ') + p.texto.replace('¿', '').replace('?', '');
            var acc = doc.createElement('p');
            acc.className = 'm-0 leading-relaxed';
            acc.textContent = p.accion;
            li.appendChild(strong);
            li.appendChild(acc);
            if (p.enlace) {
                var a = doc.createElement('a');
                a.href = p.enlace.href;
                a.className = 'font-semibold text-[#00382E] underline';
                a.textContent = p.enlace.texto;
                var parr = doc.createElement('p');
                parr.className = 'mt-1.5 mb-0';
                parr.appendChild(a);
                li.appendChild(parr);
            }
            lista.appendChild(li);
        });
        if (!lista.children.length) {
            var vacio = doc.createElement('li');
            vacio.className = 'text-xs text-slate-400';
            vacio.textContent = 'Aún nada marcado en rojo.';
            lista.appendChild(vacio);
        }
    }

    function reiniciar() {
        respuestas = {};
        actualizar();
    }

    function estadoCargando(form, cargando) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = !!cargando;
            btn.style.opacity = cargando ? '0.6' : '1';
        }
    }

    function medir(nombre) {
        try { if (typeof gtag === 'function') gtag('event', nombre, { event_category: 'monitor', value: 1 }); } catch (e) { /* sin GA4 */ }
    }

    function enviarFormulario(form, body, estadoEl, alOk) {
        fetch('/api/alertas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
            estadoEl.textContent = res.j && res.j.mensaje ? res.j.mensaje : (res.j && res.j.error ? res.j.error : 'No pudimos procesar la solicitud.');
            estadoEl.className = 'text-xs font-semibold m-0 ' + (res.ok ? 'text-emerald-800' : 'text-rose-700');
            if (res.ok) alOk && alOk();
        }).catch(function () {
            estadoEl.textContent = 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.';
            estadoEl.className = 'text-xs font-semibold m-0 text-rose-700';
        }).then(function () { estadoCargando(form, false); });
    }

    function iniciar() {
        if (!doc.getElementById('mon-preguntas')) return;

        // Aviso tras confirmar o darse de baja desde el correo
        var m = /[?&]alertas=(confirmado|baja|error)/.exec(doc.location.search);
        if (m) {
            var banner = doc.getElementById('mon-alerta-banner');
            if (banner) {
                var textos = {
                    confirmado: 'Confirmado: ya recibes las alertas del día 1, 13 y 20 de cada mes.',
                    baja: 'Listo: quitamos tu correo de las alertas y no te escribiremos más.',
                    error: 'El enlace ya no es válido. Si quieres recibir las alertas, inscríbete otra vez desde el formulario.'
                };
                banner.textContent = textos[m[1]];
                banner.className = 'p-3.5 rounded-2xl border text-sm font-semibold mb-6 ' +
                    (m[1] === 'baja' ? 'bg-slate-100 border-slate-300 text-slate-700' : m[1] === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900');
            }
        }

        render();
        var btnReiniciar = doc.getElementById('btn-mon-reiniciar');
        if (btnReiniciar) btnReiniciar.addEventListener('click', reiniciar);

        var formAlertas = doc.getElementById('mon-form-alertas');
        if (formAlertas) {
            formAlertas.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var correo = doc.getElementById('mon-correo').value.trim();
                var estado = doc.getElementById('mon-alertas-status');
                if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(correo)) {
                    estado.textContent = 'Escribe un correo válido.';
                    estado.className = 'text-xs font-semibold m-0 text-rose-700';
                    return;
                }
                if (!doc.getElementById('mon-consentimiento').checked) {
                    estado.textContent = 'Marca la casilla para aceptar las alertas.';
                    estado.className = 'text-xs font-semibold m-0 text-rose-700';
                    return;
                }
                estadoCargando(formAlertas, true);
                estado.textContent = 'Enviando...';
                estado.className = 'text-xs font-semibold m-0 text-slate-500';
                medir('alerta_optin');
                enviarFormulario(formAlertas, {
                    accion: 'suscribir',
                    correo: correo,
                    origen: 'monitor',
                    web: doc.getElementById('mon-correo-web').value
                }, estado, function () { formAlertas.reset(); });
            });
        }

        var formAcceso = doc.getElementById('mon-form-acceso');
        if (formAcceso) {
            formAcceso.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var correo = doc.getElementById('acc-correo').value.trim();
                var estado = doc.getElementById('mon-acceso-status');
                if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(correo)) {
                    estado.textContent = 'Escribe un correo válido.';
                    estado.className = 'text-xs font-semibold m-0 text-rose-700';
                    return;
                }
                estadoCargando(formAcceso, true);
                estado.textContent = 'Enviando...';
                estado.className = 'text-xs font-semibold m-0 text-slate-500';
                medir('monitor_acceso_anticipado');
                enviarFormulario(formAcceso, {
                    accion: 'acceso',
                    correo: correo,
                    nombre: doc.getElementById('acc-nombre').value.trim(),
                    empresa: doc.getElementById('acc-empresa').value.trim(),
                    rut: doc.getElementById('acc-rut').value.trim(),
                    alertas: doc.getElementById('acc-alertas').checked,
                    web: doc.getElementById('acc-web').value
                }, estado, function () {
                    formAcceso.reset();
                    doc.getElementById('acc-alertas').checked = false;
                });
            });
        }
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})(typeof document !== 'undefined' ? document : null);
