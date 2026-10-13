/*
 * CalculoLaboral · prellenado de los generadores con los datos del Asistente Pyme (v1.0.0)
 *
 * El panel abre cada generador con  ?desde=pyme&t=<id del trabajador>. Este archivo lee la empresa y la ficha de esa persona
 * desde /api/pyme/estado (con la sesión del asistente) y completa el formulario del generador, sin tocar el código del generador.
 *
 * Uso: <script src="/js/pyme_prefill.js" data-pagina="contrato|anexo42|finiquito" defer></script>
 * Se ejecuta al terminar de cargar la página, para que el borrador que el generador restaura del navegador ya esté puesto y se
 * pregunte antes de reemplazarlo. Los valores se escriben con .value (nunca como HTML) y luego se avisa al generador con los
 * eventos input y change, como si la persona los hubiera escrito.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    var PAGINA = script && script.getAttribute('data-pagina');
    var q = new URLSearchParams(window.location.search);
    var aplica = !!PAGINA && q.get('desde') === 'pyme' && !!q.get('t');

    // Los generadores esperan a que el prellenado termine antes de atender el desbloqueo del pase (el desbloqueo del finiquito
    // queda atado al RUT del formulario, así que el RUT ya debe estar puesto). Si no se viene del asistente, se ejecuta de inmediato.
    var terminado = !aplica, esperando = [];
    function terminar() {
        terminado = true;
        var lista = esperando; esperando = [];
        lista.forEach(function (fn) { try { fn(); } catch (e) { /* un fallo del generador no debe frenar a los demás */ } });
    }
    window.CLPymePrefill = {
        cuando: function (fn) {
            if (terminado) { fn(); return; }
            esperando.push(fn);
            window.setTimeout(terminar, 8000); // si el asistente no responde, el generador sigue como siempre
        }
    };
    if (!aplica) return;

    // Borrador que el generador guarda en el navegador y campos que indican que la persona ya escribió algo propio
    // (los generadores guardan su estado inicial desde que se abren, así que solo cuenta si hay empresa o trabajador escritos)
    var BORRADOR = {
        contrato: { clave: 'contrato_builder_state', campos: ['empresaRazonSocial', 'trabajadorNombre'] },
        anexo42: null,
        finiquito: { clave: 'fini_draft_payload', campos: ['empresaRazon', 'trabajadorNombre'] }
    };
    function esTexto(v) { return typeof v === 'string' && v.trim() !== '' && !(v.trim().charAt(0) === '[' && v.trim().slice(-1) === ']'); }
    function hayBorradorPropio() {
        var b = BORRADOR[PAGINA];
        if (!b) return false;
        try {
            var crudo = window.localStorage.getItem(b.clave);
            if (!crudo) return false;
            var d = JSON.parse(crudo);
            return b.campos.some(function (k) { return esTexto(d && d[k]); });
        } catch (e) { return false; }
    }

    function juntar(a, b) { return [a, b].filter(Boolean).join(', '); }
    function entero(n) { return n > 0 ? String(Math.round(n)) : ''; }
    function miles(n) { return n > 0 ? Math.round(n).toLocaleString('es-CL') : ''; }

    // Cada entrada: [id del campo, valor, tipo]. tipo: 'radio' (nombre del grupo en id), 'check' o por defecto texto/fecha/lista.
    var MAPAS = {
        contrato: function (e, t) {
            var grat = t.gratificacion === 'legal' ? 'art50' : t.gratificacion === 'ninguna' ? 'sin_gratif' : '';
            var jornada = t.jornadaHoras === 20 ? 'part_time_20h' : t.jornadaHoras === 30 ? 'part_time_30h' : (t.jornadaHoras === 42 && t.distribucion === '6') ? '6x1_comercio' : '';
            return [
                ['tipoContrato', t.contrato === 'plazo_fijo' ? 'plazo' : t.contrato === 'obra' ? 'obra' : 'indefinido', 'radio'],
                ['input-fecha-termino-plazo', t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : ''],
                ['input-empresa-nombre', e.razonSocial], ['input-empresa-rut', e.rut], ['input-empresa-rep', e.representante], ['input-empresa-rep-rut', e.rutRepresentante],
                ['input-empresa-direccion', juntar(e.direccion, e.comuna)],
                ['input-trabajador-nombre', t.nombre], ['input-trabajador-rut', t.rut], ['input-trabajador-nacionalidad', t.nacionalidad],
                ['input-trabajador-fecha-nac', t.fechaNacimiento], ['input-trabajador-direccion', juntar(t.domicilio, t.comuna)],
                ['input-cargo-nombre', t.cargo],
                ['select-jornada-clave', jornada],
                ['input-sueldo-base', entero(t.sueldoBase)], ['select-tipo-gratif', grat],
                ['input-asig-colacion', String(Math.round(t.colacion || 0))], ['input-asig-movilizacion', String(Math.round(t.movilizacion || 0))]
            ];
        },
        anexo42: function (e, t) {
            return [
                ['company-name', e.razonSocial], ['company-rut', e.rut], ['company-address', juntar(e.direccion, e.comuna)], ['rep-name', e.representante],
                ['worker-name', t.nombre], ['worker-rut', t.rut], ['worker-position', t.cargo], ['contract-date', t.fechaIngreso],
                ['city', e.ciudad || e.comuna]
            ];
        },
        finiquito: function (e, t) {
            var plazo = t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo;
            return [
                ['empresa-razon', e.razonSocial], ['empresa-rut', e.rut], ['empresa-domicilio', juntar(e.direccion, e.comuna)], ['empresa-ciudad', e.ciudad || e.comuna],
                ['empresa-rep-nombre', e.representante], ['empresa-rep-rut', e.rutRepresentante],
                ['trabajador-nombre', t.nombre], ['trabajador-rut', t.rut], ['trabajador-cargo', t.cargo], ['trabajador-domicilio', juntar(t.domicilio, t.comuna)], ['trabajador-ciudad', t.comuna],
                ['fecha-inicio', t.fechaIngreso],
                ['causal-select', plazo ? '159-4' : ''], ['fecha-termino', plazo ? t.fechaTerminoPlazo : ''],
                ['sueldo-base', miles(t.sueldoBase)], ['asignaciones', miles((t.colacion || 0) + (t.movilizacion || 0)) || '0'],
                ['zona-extrema', t.zonaExtrema === true, 'check']
            ];
        }
    };

    function avisar(texto, tipo) {
        var caja = document.createElement('div');
        caja.setAttribute('role', 'status');
        caja.style.cssText = 'margin:0 0 1rem;padding:.7rem .95rem;border-radius:.75rem;font-size:.9rem;line-height:1.45;' +
            (tipo === 'error' ? 'background:#fff1f2;color:#9f1239;' : 'background:#eef6f3;color:#0f3f35;');
        caja.textContent = texto + ' ';
        var enlace = document.createElement('a');
        enlace.href = '/app';
        enlace.textContent = 'Volver al asistente';
        enlace.style.cssText = 'font-weight:700;text-decoration:underline;color:inherit;';
        caja.appendChild(enlace);
        var main = document.querySelector('main') || document.body;
        main.insertBefore(caja, main.firstChild);
    }

    function avisarCampo(el) {
        ['input', 'change'].forEach(function (ev) { el.dispatchEvent(new Event(ev, { bubbles: true })); });
    }

    function poner(id, valor, tipo) {
        if (tipo === 'radio') {
            var r = document.querySelector('input[name="' + id + '"][value="' + valor + '"]');
            if (r) { r.checked = true; avisarCampo(r); return true; }
            return false;
        }
        var el = document.getElementById(id);
        if (!el) return false;
        if (tipo === 'check') { el.checked = !!valor; avisarCampo(el); return true; }
        if (valor === undefined || valor === null || valor === '') return false; // no se borra lo que el generador ya traía
        if (el.tagName === 'SELECT') {
            var hay = Array.prototype.some.call(el.options, function (o) { return o.value === String(valor); });
            if (!hay) return false;
        }
        el.value = String(valor);
        avisarCampo(el);
        return true;
    }

    function aplicar() {
        fetch('/api/pyme/estado', { credentials: 'same-origin' }).then(function (r) {
            if (r.status === 401) { avisar('Para cargar los datos de tu trabajador debes entrar a tu cuenta del asistente.', 'error'); return null; }
            if (!r.ok) throw new Error('http');
            return r.json();
        }).then(function (estado) {
            if (!estado) return;
            var t = (estado.trabajadores || []).filter(function (x) { return x.id === q.get('t'); })[0];
            if (!estado.empresa || !t) { avisar('No encontramos a ese trabajador en tu cuenta.', 'error'); return; }
            if (hayBorradorPropio() && !window.confirm('Este formulario ya tiene datos guardados en tu navegador. ¿Quieres reemplazarlos con los de ' + t.nombre + '?')) return;
            var mapa = MAPAS[PAGINA](estado.empresa, t), puestos = 0;
            mapa.forEach(function (m) { if (poner(m[0], m[1], m[2])) puestos++; });
            avisar('Cargamos los datos de ' + t.nombre + ' y de tu empresa desde el asistente. Revisa todo antes de generar el documento.');
        }).catch(function () {
            avisar('No pudimos cargar los datos desde el asistente. Intenta de nuevo.', 'error');
        }).then(terminar);
    }

    if (document.readyState === 'complete') aplicar(); else window.addEventListener('load', aplicar);
})();
