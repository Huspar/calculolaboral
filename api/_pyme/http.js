/**
 * Utilidades HTTP del Asistente Pyme: cookies, IP, origen (CSRF), cuerpo y respuestas.
 * Sin dependencias; todo es funcion pura sobre req/res para poder probarlo sin servidor.
 */
const NOMBRE_COOKIE = 'cl_pyme';

function escapeHtml(valor) {
    return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Lee una cookie del encabezado Cookie. */
function leerCookie(req, nombre) {
    const crudo = (req.headers && req.headers.cookie) || '';
    const partes = crudo.split(';');
    for (let i = 0; i < partes.length; i++) {
        const p = partes[i].trim();
        const igual = p.indexOf('=');
        if (igual > 0 && p.slice(0, igual) === nombre) return p.slice(igual + 1);
    }
    return '';
}

/** Set-Cookie de la sesion: HttpOnly, Secure, SameSite=Lax. */
function cookieSesion(token, venceMs, ahoraMs) {
    const segundos = Math.max(0, Math.floor((venceMs - ahoraMs) / 1000));
    return `${NOMBRE_COOKIE}=${token}; Path=/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
}
function cookieBorrada() {
    return `${NOMBRE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** IP del visitante: Cloudflare, luego Vercel. Se usa solo para limitar solicitudes (se guarda como huella). */
function ipDe(req) {
    const h = req.headers || {};
    const cf = h['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    const real = h['x-real-ip'];
    if (typeof real === 'string' && real.trim()) return real.trim();
    const xff = h['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
    return 'desconocida';
}

/**
 * Origenes aceptados para escrituras: el sitio, la vista previa de Vercel de esa misma version y, fuera de produccion, localhost.
 * Si el navegador no manda Origin (algunas peticiones del mismo sitio) se acepta solo con el encabezado propio X-CL-Pyme.
 */
function origenesPermitidos(env, siteUrl) {
    const lista = [siteUrl];
    if (env.VERCEL_URL) lista.push('https://' + env.VERCEL_URL);
    if (env.VERCEL_ENV !== 'production') lista.push('http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500');
    return lista;
}

/** Proteccion contra escrituras desde otros sitios: Origin permitido, encabezado propio y JSON. */
function escrituraPermitida(req, env, siteUrl) {
    const h = req.headers || {};
    if (h['x-cl-pyme'] !== '1') return false;
    const tipo = String(h['content-type'] || '').toLowerCase();
    if (tipo.indexOf('application/json') !== 0) return false;
    const origen = h.origin;
    if (origen && origenesPermitidos(env, siteUrl).indexOf(origen) < 0) return false;
    return true;
}

/** Cuerpo como objeto: Vercel entrega JSON o formulario ya procesado; si llega texto se intenta leerlo. */
function cuerpoDe(req) {
    let b = req.body;
    if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch (e) {
            try { b = Object.fromEntries(new URLSearchParams(b)); } catch (e2) { b = {}; }
        }
    }
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

function json(res, estado, objeto, extras) {
    res.statusCode = estado;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (extras && extras.cookie) res.setHeader('Set-Cookie', extras.cookie);
    res.end(JSON.stringify(objeto));
}

function html(res, estado, cuerpo, extras) {
    res.statusCode = estado;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // "origin": el navegador manda el Origin correcto en el formulario (con "no-referrer" lo manda como "null" y se rechazaria)
    // y a otras paginas solo llega el origen, nunca la direccion con el token del enlace.
    res.setHeader('Referrer-Policy', 'origin');
    if (extras && extras.cookie) res.setHeader('Set-Cookie', extras.cookie);
    res.end(cuerpo);
}

function redirigir(res, destino, extras) {
    res.statusCode = 303;
    res.setHeader('Location', destino);
    res.setHeader('Cache-Control', 'no-store');
    if (extras && extras.cookie) res.setHeader('Set-Cookie', extras.cookie);
    res.end();
}

module.exports = {
    NOMBRE_COOKIE, escapeHtml, leerCookie, cookieSesion, cookieBorrada, ipDe,
    origenesPermitidos, escrituraPermitida, cuerpoDe, json, html, redirigir
};
