/* CalculoLaboral · recuerda de dónde llegó la visita y lo agrega a cada lead (/api/send-lead) */
(function () {
    var KEY = 'cl_origen';
    var origen;
    try { origen = sessionStorage.getItem(KEY); } catch (e) { origen = null; }
    if (!origen) {
        var ref = '';
        try {
            var r = new URL(document.referrer);
            if (r.hostname && r.hostname !== location.hostname) ref = r.hostname;
        } catch (e) { /* sin referer */ }
        var q = new URLSearchParams(location.search);
        var utm = q.get('utm_source') || (q.get('gclid') ? 'google-ads' : '');
        origen = ((ref || 'directo/sin referer') + (utm ? ' (utm ' + utm + ')' : '') + ' → ' + location.pathname).slice(0, 160);
        try { sessionStorage.setItem(KEY, origen); } catch (e) { /* storage bloqueado */ }
    }
    var nativeFetch = window.fetch;
    if (!nativeFetch) return;
    window.fetch = function (url, opts) {
        try {
            if (typeof url === 'string' && url.indexOf('/api/send-lead') !== -1 && opts && typeof opts.body === 'string') {
                var b = JSON.parse(opts.body);
                if (b && typeof b === 'object' && !b.origen) {
                    b.origen = origen;
                    opts = Object.assign({}, opts, { body: JSON.stringify(b) });
                }
            }
        } catch (e) { /* nunca bloquear el envío */ }
        return nativeFetch.call(this, url, opts);
    };
})();
