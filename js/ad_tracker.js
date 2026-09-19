/**
 * Cálculo Laboral - Ad Click Tracker v1.0.0 (GA4)
 * Telemetría centralizada y no intrusiva de clics en banners patrocinados (Soicos, Itaú, Abakos).
 */
(function() {
    'use strict';

    function trackAdClick(link) {
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var isSoicos = href.indexOf('ad.soicos.com') !== -1;
        var isItauShort = href === '/itau' || href.indexOf('/itau') !== -1;
        var hasAdData = link.hasAttribute('data-ad-name');

        if (!isSoicos && !isItauShort && !hasAdData) return;

        var adName = link.getAttribute('data-ad-name');
        if (!adName) {
            if (href.indexOf('1154903') !== -1) adName = 'abakos_emergencias';
            else if (href.indexOf('1154772') !== -1) adName = 'abakos_prestamos';
            else if (href.indexOf('1163773') !== -1 || isItauShort) adName = 'itau_cuenta_corriente';
            else adName = 'soicos_patrocinado';
        }

        var placement = link.getAttribute('data-ad-placement');
        if (!placement) {
            if (link.closest('#lead-section')) placement = 'lead_section';
            else if (link.closest('.dark-banner')) placement = 'dark_banner';
            else if (link.closest('#sueldo-calc-container') || link.closest('#finiquito-calc-container')) placement = 'calc_sidebar';
            else placement = 'in_content';
        }

        if (typeof window.gtag === 'function') {
            window.gtag('event', 'ad_click', {
                'event_category': 'Monetization',
                'event_label': adName,
                'ad_name': adName,
                'ad_placement': placement,
                'ad_destination': href,
                'page_location': window.location.href,
                'page_path': window.location.pathname,
                'transport_type': 'beacon'
            });
        }
    }

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link) {
            trackAdClick(link);
        }
    }, { capture: true, passive: true });
})();
