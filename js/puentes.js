/* CalculoLaboral · mide clics en enlaces con data-puente (GA4: clic_puente) */
document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-puente]');
    if (a && typeof window.gtag === 'function') {
        window.gtag('event', 'clic_puente', { puente: a.getAttribute('data-puente'), destino: a.getAttribute('href') });
    }
});
