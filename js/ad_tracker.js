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
        var isAbakosShort = href === '/abakos' || href.indexOf('/abakos') !== -1;
        var hasPartnerData = link.hasAttribute('data-partner') || link.hasAttribute('data-promo') || link.hasAttribute('data-ad-name');

        if (!isSoicos && !isItauShort && !isAbakosShort && !hasPartnerData) return;

        var adName = link.getAttribute('data-partner') || link.getAttribute('data-promo') || link.getAttribute('data-ad-name');
        if (!adName) {
            if (href.indexOf('1154903') !== -1 || href.indexOf('/abakos-emergencias') !== -1) adName = 'abakos_emergencias';
            else if (href.indexOf('1154772') !== -1 || href === '/abakos') adName = 'abakos_prestamos';
            else if (href.indexOf('1163773') !== -1 || isItauShort) adName = 'itau_cuenta_corriente';
            else adName = 'soicos_patrocinado';
        }

        var placement = link.getAttribute('data-placement') || link.getAttribute('data-ad-placement');
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

    function resolveMeta(link) {
        var href = link.getAttribute('href') || '';
        var adName = link.getAttribute('data-partner') || link.getAttribute('data-promo') || link.getAttribute('data-ad-name');
        if (!adName) {
            if (href.indexOf('1154903') !== -1 || href.indexOf('/abakos-emergencias') !== -1) adName = 'abakos_emergencias';
            else if (href.indexOf('1154772') !== -1 || href.indexOf('/abakos') !== -1) adName = 'abakos_prestamos';
            else if (href.indexOf('1163773') !== -1 || href.indexOf('/itau') !== -1) adName = 'itau_cuenta_corriente';
            else adName = 'soicos_patrocinado';
        }
        var placement = link.getAttribute('data-placement') || link.getAttribute('data-ad-placement') || 'in_content';
        placement = placement.replace(/_(img|btn)$/, '');
        return { adName: adName, placement: placement };
    }

    function observeImpressions() {
        var links = document.querySelectorAll('a[href^="/abakos"], a[href^="/itau"], a[data-partner]');
        if (!links.length) return;
        var vistos = {};
        function enviarImpresion(el) {
            var link = el.tagName === 'A' ? el : el.querySelector('a[href^="/abakos"], a[href^="/itau"], a[data-partner]');
            if (!link) return;
            var meta = resolveMeta(link);
            var key = meta.adName + '|' + meta.placement;
            if (vistos[key]) return;
            vistos[key] = true;
            if (typeof window.gtag === 'function') {
                window.gtag('event', 'ver_anuncio', {
                    'ad_name': meta.adName,
                    'ad_placement': meta.placement
                });
            }
        }
        var targets = [];
        for (var i = 0; i < links.length; i++) {
            var l = links[i];
            if (l.closest('[data-itau-renta]') || l.closest('[data-abakos-fallback]')) continue;
            var meta = resolveMeta(l);
            var k = meta.adName + '|' + meta.placement;
            if (vistos['q_' + k]) continue;
            vistos['q_' + k] = true;
            targets.push(l);
        }
        if (!targets.length) return;
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function(entries) {
                for (var j = 0; j < entries.length; j++) {
                    if (entries[j].isIntersecting) {
                        enviarImpresion(entries[j].target);
                        io.unobserve(entries[j].target);
                    }
                }
            }, { threshold: 0.25 });
            for (var t = 0; t < targets.length; t++) io.observe(targets[t]);
        } else {
            for (var u = 0; u < targets.length; u++) enviarImpresion(targets[u]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeImpressions);
    } else {
        observeImpressions();
    }
})();
