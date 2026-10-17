/*
 * CalculoLaboral · medición de los anuncios del Asistente Laboral Pyme en páginas que no cargan checkout_consent.js.
 * Envía select_promotion de GA4 con el mismo formato que usa checkout_consent.js (promotion_id, promotion_name,
 * creative_slot, location_id) para <a data-cta="asistente-pyme" data-cta-slot="lugar">.
 * Si la página ya carga checkout_consent.js (window.CLCheckout), esa lo mide y esta no hace nada.
 */
(function () {
    'use strict';
    function alClic(e) {
        if (window.CLCheckout) return;
        if (e.defaultPrevented || (e.type === 'auxclick' && e.button !== 1)) return;
        var a = e.target.closest && e.target.closest('a[data-cta]');
        if (!a || typeof window.gtag !== 'function') return;
        var slug = a.getAttribute('data-cta');
        try {
            window.gtag('event', 'select_promotion', {
                promotion_id: slug,
                promotion_name: a.getAttribute('data-cta-name') || slug,
                creative_slot: a.getAttribute('data-cta-slot') || '',
                location_id: window.location.pathname,
                transport_type: 'beacon'
            });
        } catch (err) { /* sin analítica */ }
    }
    document.addEventListener('click', alClic, true);
    document.addEventListener('auxclick', alClic, true);
})();
