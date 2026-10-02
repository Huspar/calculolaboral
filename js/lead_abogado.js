/*
 * CalculoLaboral · bloque de revisión de caso con abogado
 * Se monta en cualquier <div data-lead-abogado> con:
 *   data-fuente      nombre de la página para el correo del lead y GA4
 *   data-variante    161 | 160 | impago | injustificado
 *   data-monto-anos  (opcional) selector del monto de años de servicio para personalizar el recargo
 *   data-causal      (opcional) selector del <select> de causal; oculta el bloque si la causal no es despido
 * Envía a /api/send-lead (tipo "Consulta Legal": basta WhatsApp, correo opcional).
 */
(function () {
    'use strict';

    var VARIANTES = {
        '161': {
            titulo: '¿Tu carta de despido fue genérica? Podrías recibir un 30% más',
            texto: 'Si te despidieron por necesidades de la empresa sin una justificación concreta, el juez puede ordenar un recargo del 30% sobre tus años de servicio y la devolución del descuento AFC.',
            recargo: 0.3,
            motivo: 'Despido Art. 161 (Necesidades de la empresa)'
        },
        '160': {
            titulo: '¿Te despidieron por Art. 160 sin pruebas claras?',
            texto: 'Si la falta grave no se acredita en juicio, el juez ordena pagar las indemnizaciones completas con un recargo del 80% sobre los años de servicio, que puede llegar al 100% según el caso.',
            recargo: 0.8,
            motivo: 'Despido sin indemnización Art. 160'
        },
        impago: {
            titulo: '¿Pasaron 10 días hábiles y no te pagan el finiquito?',
            texto: 'Un abogado laboral puede exigir judicialmente el pago con reajustes e intereses. El plazo para demandar corre desde el despido.',
            recargo: 0,
            motivo: 'Finiquito impago o mal calculado'
        },
        injustificado: {
            titulo: 'Tienes 60 días hábiles para reclamar tu despido',
            texto: 'Vencido el plazo se pierde el derecho a demandar. Un abogado laboral revisa tu carta y te dice si tienes un caso antes de que corra el tiempo.',
            recargo: 0,
            motivo: 'Despido Injustificado / Causal cuestionable'
        }
    };

    var MOTIVOS = [
        'Despido Art. 161 (Necesidades de la empresa)',
        'Despido Injustificado / Causal cuestionable',
        'Despido sin indemnización Art. 160',
        'Finiquito impago o mal calculado',
        'Retención indebida Aporte Patronal AFC',
        'Autodespido / Despido Indirecto Art. 171',
        'No pago de cotizaciones (Ley Bustos)',
        'Otra consulta legal laboral'
    ];

    var CAUSALES_DESPIDO = { '161': '161', '160': '160' };

    function track(evento, params) {
        if (typeof window.gtag === 'function') window.gtag('event', evento, params || {});
    }

    function clp(n) {
        return '$ ' + Math.round(n).toLocaleString('es-CL');
    }

    function leerMonto(el) {
        if (!el) return 0;
        var digitos = (el.textContent || '').replace(/[^\d]/g, '');
        return digitos ? parseInt(digitos, 10) : 0;
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function montar(root, idx) {
        var fuente = root.getAttribute('data-fuente') || document.title;
        var variante = root.getAttribute('data-variante') || 'injustificado';
        var v = VARIANTES[variante] || VARIANTES.injustificado;
        var uid = 'cl-lead-' + idx;
        var opciones = MOTIVOS.map(function (m) {
            return '<option' + (m === v.motivo ? ' selected' : '') + '>' + esc(m) + '</option>';
        }).join('');

        root.classList.add('cl-lead');
        root.setAttribute('aria-labelledby', uid + '-titulo');
        root.innerHTML =
            '<p class="cl-lead__eyebrow">Revisión gratuita de tu caso</p>' +
            '<h3 class="cl-lead__titulo" id="' + uid + '-titulo">' + esc(v.titulo) + '</h3>' +
            '<p class="cl-lead__texto">' + esc(v.texto) + '</p>' +
            '<p class="cl-lead__monto" data-lead-monto hidden></p>' +
            '<ul class="cl-lead__puntos">' +
                '<li>Evaluación preliminar sin costo inicial</li>' +
                '<li>Honorarios habituales a porcentaje de lo recuperado (cuota litis)</li>' +
                '<li>Te contacta un abogado laboralista colaborador</li>' +
            '</ul>' +
            '<button type="button" class="cl-lead__abrir" aria-expanded="false" aria-controls="' + uid + '-form">Revisar mi caso gratis</button>' +
            '<form class="cl-lead__form" id="' + uid + '-form" hidden novalidate>' +
                '<div class="cl-lead__campos">' +
                    '<label class="cl-lead__campo"><span>Nombre</span><input name="nombre" autocomplete="name" required maxlength="80"></label>' +
                    '<label class="cl-lead__campo"><span>WhatsApp o teléfono</span><input name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="+56 9 1234 5678" required maxlength="20"></label>' +
                    '<label class="cl-lead__campo cl-lead__campo--full"><span>¿Qué pasó?</span><select name="motivo">' + opciones + '</select></label>' +
                    '<label class="cl-lead__campo cl-lead__campo--full"><span>Correo <em>(opcional)</em></span><input name="correo" type="email" autocomplete="email" maxlength="254"></label>' +
                '</div>' +
                '<input class="cl-lead__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
                '<label class="cl-lead__consent"><input type="checkbox" name="consent" required><span>Autorizo enviar estos datos a un abogado laboralista colaborador para evaluar mi caso, según la <a href="privacidad">Política de Privacidad</a>.</span></label>' +
                '<p class="cl-lead__error" role="alert" hidden></p>' +
                '<button type="submit" class="cl-lead__enviar">Enviar para revisión</button>' +
            '</form>' +
            '<div class="cl-lead__ok" role="status" tabindex="-1" hidden></div>';

        var abrir = root.querySelector('.cl-lead__abrir');
        var form = root.querySelector('form');
        var error = root.querySelector('.cl-lead__error');
        var ok = root.querySelector('.cl-lead__ok');
        var montoEl = root.querySelector('[data-lead-monto]');
        var renderedAt = Date.now();
        var recargoActual = 0;

        abrir.addEventListener('click', function () {
            form.hidden = false;
            abrir.hidden = true;
            abrir.setAttribute('aria-expanded', 'true');
            form.querySelector('input[name="nombre"]').focus();
            track('lead_abogado_abrir', { fuente: fuente });
        });

        // Personalización: recargo estimado sobre el monto de años de servicio calculado en la página
        var fuenteMonto = root.getAttribute('data-monto-anos') ? document.querySelector(root.getAttribute('data-monto-anos')) : null;
        var causalSel = root.getAttribute('data-causal') ? document.querySelector(root.getAttribute('data-causal')) : null;

        function actualizar() {
            var causal = causalSel ? causalSel.value : variante;
            var aplica = !causalSel || CAUSALES_DESPIDO[causal];
            root.hidden = !aplica;
            if (!aplica) return;
            var vv = VARIANTES[causal] || v;
            root.querySelector('.cl-lead__titulo').textContent = vv.titulo;
            root.querySelector('.cl-lead__texto').textContent = vv.texto;
            var sel = form.querySelector('select[name="motivo"]');
            if (sel && !form.dataset.motivoTocado) sel.value = vv.motivo;
            var base = leerMonto(fuenteMonto);
            recargoActual = vv.recargo && base ? base * vv.recargo : 0;
            if (recargoActual > 0) {
                montoEl.innerHTML = 'Con tu cálculo, el recargo sería de aprox. <strong>' + clp(recargoActual) + '</strong> adicionales.';
                montoEl.hidden = false;
            } else {
                montoEl.hidden = true;
            }
        }
        form.querySelector('select[name="motivo"]').addEventListener('change', function () { form.dataset.motivoTocado = '1'; });
        if (fuenteMonto && 'MutationObserver' in window) {
            new MutationObserver(actualizar).observe(fuenteMonto, { childList: true, characterData: true, subtree: true });
        }
        if (causalSel) causalSel.addEventListener('change', actualizar);
        actualizar();

        function mostrarError(msg) {
            error.textContent = msg;
            error.hidden = false;
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            error.hidden = true;
            var nombre = form.nombre.value.trim();
            var telefono = form.telefono.value.trim();
            var correo = form.correo.value.trim();
            var motivo = form.motivo.value;
            if (!nombre) { mostrarError('Escribe tu nombre.'); form.nombre.focus(); return; }
            if (telefono.replace(/\D/g, '').length < 8) { mostrarError('Escribe un WhatsApp o teléfono válido, por ejemplo +56 9 1234 5678.'); form.telefono.focus(); return; }
            if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { mostrarError('El correo no parece válido. Puedes dejarlo vacío.'); form.correo.focus(); return; }
            if (!form.consent.checked) { mostrarError('Necesitamos tu autorización para enviar los datos al abogado.'); return; }

            var boton = form.querySelector('.cl-lead__enviar');
            boton.disabled = true;
            boton.textContent = 'Enviando…';

            var detalle = 'Motivo: ' + motivo + ' | Página: ' + fuente + (recargoActual ? ' | Recargo estimado: ' + clp(recargoActual) : '');
            fetch('/api/send-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    telefono: telefono,
                    correo: correo,
                    tipo: 'Consulta Legal',
                    fuente: fuente,
                    detalle: detalle.slice(0, 300),
                    monto_calculado: recargoActual ? Math.round(recargoActual) : undefined,
                    website: form.website.value,
                    form_rendered_at: renderedAt
                })
            }).then(function (res) {
                if (!res.ok) {
                    return res.json().catch(function () { return {}; }).then(function (d) {
                        throw new Error(d && d.error ? d.error : 'No pudimos enviar tu solicitud.');
                    });
                }
                form.hidden = true;
                ok.innerHTML = '<strong>Listo, ' + esc(nombre.split(' ')[0]) + '.</strong> Recibimos tus datos. Un abogado laboralista colaborador te contactará al ' + esc(telefono) + ' en horario hábil.';
                ok.hidden = false;
                ok.focus();
                track('generate_lead', { fuente: fuente, tipo: 'abogado', value: 15000, currency: 'CLP' });
            }).catch(function (err) {
                mostrarError((err && err.message ? err.message : 'No pudimos enviar tu solicitud.') + ' Intenta de nuevo o escríbenos a contacto@calculolaboral.cl.');
                track('lead_error', { fuente: fuente, tipo: 'abogado' });
                boton.disabled = false;
                boton.textContent = 'Enviar para revisión';
            });
        });
    }

    function start() {
        var mounts = document.querySelectorAll('[data-lead-abogado]');
        for (var i = 0; i < mounts.length; i++) montar(mounts[i], i);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
