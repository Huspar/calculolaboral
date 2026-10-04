/**
 * GET /itau, /abakos, /abakos-emergencias (reescritos a /api/go?p=...)
 * Redirige al programa de afiliados en Soicos y deja en los logs de Vercel de dónde viene
 * cada clic (página de origen, país, tipo de navegador). Los accesos de bots y verificadores
 * de enlaces se mandan a la portada para no generar clics falsos en la red de afiliados.
 */
const DESTINOS = {
    itau: 'https://ad.soicos.com/1163773',
    'itau-informe': 'https://ad.soicos.com/1163773',
    'itau-correo': 'https://ad.soicos.com/1163773',
    abakos: 'https://ad.soicos.com/1154772',
    'abakos-emergencias': 'https://ad.soicos.com/1154903'
};

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed|monitor|scanner|embedly|whatsapp|telegram|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|libwww|httpclient|phantom|selenium|puppeteer|playwright/i;

module.exports = (req, res) => {
    const p = String((req.query && req.query.p) || '');
    const destino = DESTINOS[p];
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!destino) {
        res.statusCode = 302;
        res.setHeader('Location', '/');
        return res.end();
    }

    const ua = String(req.headers['user-agent'] || '');
    const bot = req.method !== 'GET' || !ua || BOT.test(ua);
    let ref = String(req.headers.referer || '');
    ref = ref ? ref.replace(/^https?:\/\/(www\.)?calculolaboral\.cl/i, '').slice(0, 120) || '/' : 'sin-referer';

    console.log(JSON.stringify({
        evento: 'aff_click',
        p,
        ref,
        bot,
        pais: String(req.headers['x-vercel-ip-country'] || ''),
        movil: /mobile|android|iphone/i.test(ua),
        ua: ua.slice(0, 90)
    }));

    res.statusCode = 302;
    res.setHeader('Location', bot ? '/' : destino);
    return res.end();
};
