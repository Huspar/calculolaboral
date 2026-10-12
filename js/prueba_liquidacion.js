/*
 * CalculoLaboral · prueba de interés del generador de liquidaciones para pymes (producto en evaluación)
 * - En las guías: clic en <a data-humo-cta="lugar"> → select_promotion (promotion_id liquidacion-pyme).
 * - En /generador-liquidacion-sueldo: botón "Quiero usarlo" → interes_producto; correo → /api/send-lead
 *   (tipo InteresProducto) y generate_lead. No se cobra nada ni se llama a Flow.
 */
(function () {
    'use strict';

    var PRODUCTO = 'liquidacion-pyme';
    var NOMBRE = 'Generador de liquidaciones (prueba)';

    function medir(evento, params) {
        if (typeof window.gtag === 'function') {
            try { window.gtag('event', evento, params || {}); } catch (e) { /* sin GA4 */ }
        }
    }

    // Llamados desde otras páginas hacia la página de prueba
    function onCtaClick(e) {
        if (e.type === 'auxclick' && e.button !== 1) return;
        var a = e.target.closest && e.target.closest('a[data-humo-cta]');
        if (!a) return;
        medir('select_promotion', {
            promotion_id: PRODUCTO,
            promotion_name: NOMBRE,
            creative_slot: a.getAttribute('data-humo-cta') || '',
            location_id: window.location.pathname,
            transport_type: 'beacon'
        });
    }
    document.addEventListener('click', onCtaClick, true);
    document.addEventListener('auxclick', onCtaClick, true);

    // Página de prueba
    var boton = document.getElementById('hm-quiero');
    var panel = document.getElementById('hm-interes');
    if (!boton || !panel) return;

    var form = document.getElementById('hm-form');
    var error = form.querySelector('.hm-error');
    var ok = document.getElementById('hm-ok');
    var enviar = form.querySelector('button[type="submit"]');
    var renderedAt = Date.now();
    var yaMidio = false;

    boton.addEventListener('click', function () {
        if (!yaMidio) {
            medir('interes_producto', { producto: PRODUCTO, precio: 2990, currency: 'CLP' });
            yaMidio = true;
        }
        boton.hidden = true;
        panel.hidden = false;
        panel.focus();
    });

    function mostrarError(msg) {
        error.textContent = msg;
        error.hidden = false;
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        error.hidden = true;
        var nombre = form.nombre.value.trim();
        var correo = form.correo.value.trim();
        var trabajadores = form.trabajadores.value;
        if (!nombre || !correo) return mostrarError('Completa tu nombre y correo.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return mostrarError('Revisa el correo: parece incompleto.');
        if (!form.consentimiento.checked) return mostrarError('Debes aceptar la política de privacidad.');

        enviar.disabled = true;
        fetch('/api/send-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                correo: correo,
                tipo: 'InteresProducto',
                fuente: 'Prueba: generador de liquidaciones ($2.990)',
                detalle: 'Trabajadores: ' + (trabajadores || 'no indicó'),
                website: form.website.value,
                form_rendered_at: renderedAt
            })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
            });
        }).then(function () {
            medir('generate_lead', { currency: 'CLP', value: 0, lead_type: 'Interes_LiquidacionPyme', trabajadores: trabajadores || 'no indicó' });
            form.hidden = true;
            ok.textContent = 'Listo. Si lanzamos el generador, te escribiremos a ' + correo + '.';
            ok.hidden = false;
            ok.focus();
        }).catch(function (err) {
            enviar.disabled = false;
            medir('lead_error', { lead_type: 'Interes_LiquidacionPyme', motivo: String(err.message).slice(0, 80) });
            mostrarError(/correo|corporativo/i.test(err.message) ? err.message : 'No pudimos guardar tu correo. Intenta de nuevo en unos minutos.');
        });
    });
})();
