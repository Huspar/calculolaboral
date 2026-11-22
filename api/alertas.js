/**
 * Vercel Serverless Function: alertas del Monitor Tributario y Previsional.
 *
 *   POST /api/alertas  { accion: 'suscribir' | 'acceso', correo, [nombre], [empresa], [rut], [alertas] }
 *     - suscribir: alta en la lista con confirmación por correo (doble opt-in).
 *     - acceso: solicitud de acceso anticipado al Monitor (avisa al dueño) y
 *               opcionalmente también la suscripción a las alertas.
 *   GET  /api/alertas?accion=confirmar&t=...   activa la suscripción
 *   GET  /api/alertas?accion=baja&t=...        da de baja
 *
 * Endurecido igual que api/checkout.js: CORS por lista, límite por IP,
 * honeypot, validación de correo, sin credenciales en el código.
 *
 * Variables de entorno: DATABASE_URL, RESEND_API_KEY, PYME_SESSION_SECRET.
 */
'use strict';

const { crear } = require('./_alertas');
const { sendEmail, SITE_URL } = require('./_flow');

const ALLOWED_ORIGINS = new Set([
    'https://calculolaboral.cl',
    'https://www.calculolaboral.cl',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:8791'
]);

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const ipBuckets = new Map();

function rateLimited(req) {
    const xff = req.headers['x-forwarded-for'];
    const ip = (typeof xff === 'string' && xff.split(',')[0].trim()) || 'unknown';
    const now = Date.now();
    const b = ipBuckets.get(ip);
    if (!b || now > b.resetAt) {
        ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    b.count += 1;
    return b.count > RATE_LIMIT_MAX;
}

const CORREO_OK = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function clean(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

let servicio = null;
function armar() {
    if (servicio) return servicio;
    const url = process.env.DATABASE_URL;
    const secreto = process.env.PYME_SESSION_SECRET;
    if (!url || !secreto) {
        const e = new Error('alertas no configuradas');
        e.codigo = 503;
        throw e;
    }
    const { neon } = require('@neondatabase/serverless');
    const consulta = (texto, parametros) => neon(url).query(texto, parametros);
    servicio = crear({
        almacen: { consulta },
        siteUrl: SITE_URL,
        enviar: ({ to, reply_to, subject, html, text }, clave) => sendEmail({ to, reply_to, subject, html, text }, clave),
        secreto
    });
    return servicio;
}

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        const s = armar();

        // Confirmación y baja desde el correo: redirigen a la página del Monitor con un aviso.
        if (req.method === 'GET') {
            const accion = clean(req.query && req.query.accion, 20);
            const t = clean(req.query && req.query.t, 100);
            if (accion === 'confirmar' && t) {
                const r = await s.confirmar(t);
                res.setHeader('Location', SITE_URL + '/monitor-tributario-previsional?alertas=' + (r.confirmado ? 'confirmado' : 'error'));
                return res.status(302).end();
            }
            if (accion === 'baja' && t) {
                await s.darBaja(t);
                res.setHeader('Location', SITE_URL + '/monitor-tributario-previsional?alertas=baja');
                return res.status(302).end();
            }
            res.setHeader('Allow', 'GET, POST, OPTIONS');
            return res.status(405).json({ error: 'Método no permitido' });
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST, OPTIONS');
            return res.status(405).json({ error: 'Método no permitido' });
        }
        if (typeof origin === 'string' && !ALLOWED_ORIGINS.has(origin)) {
            return res.status(403).json({ error: 'Origen no permitido' });
        }
        if (rateLimited(req)) return res.status(429).json({ error: 'Demasiados intentos. Prueba en unos minutos.' });

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (clean(body.web, 50)) return res.status(200).json({ ok: true }); // honeypot: bots que llenan todo

        const accion = clean(body.accion, 20) || 'suscribir';
        const correo = clean(body.correo, 254).toLowerCase();
        if (!CORREO_OK.test(correo)) {
            return res.status(400).json({ error: 'Correo electrónico no válido.' });
        }

        if (accion === 'suscribir') {
            const r = await s.suscribir({ correo, origen: clean(body.origen, 30) || 'monitor' });
            if (r.error) return res.status(400).json({ error: 'Correo electrónico no válido.' });
            return res.status(200).json({
                ok: true,
                yaActivo: !!r.yaActivo,
                mensaje: r.yaActivo
                    ? 'Este correo ya recibe las alertas.'
                    : 'Te enviamos un correo de confirmación: ábrelo y haz clic en el enlace para activar las alertas.'
            });
        }

        if (accion === 'acceso') {
            await s.notificarAcceso({
                correo,
                nombre: clean(body.nombre, 80),
                empresa: clean(body.empresa, 100),
                rut: clean(body.rut, 20)
            });
            let mensaje = 'Solicitud enviada. Te contactaremos para coordinar el acceso anticipado mientras termina la validación.';
            if (body.alertas) {
                const r = await s.suscribir({ correo, origen: 'monitor-acceso' });
                mensaje += r.yaActivo
                    ? ' Este correo ya recibe las alertas.'
                    : ' También te enviamos el correo de confirmación de las alertas: ábrelo y haz clic en el enlace.';
            }
            return res.status(200).json({ ok: true, mensaje });
        }

        return res.status(400).json({ error: 'Acción no válida.' });
    } catch (err) {
        if (err.codigo === 503) {
            return res.status(503).json({ error: 'El sistema de alertas aún no está activo. Inténtalo más tarde.' });
        }
        console.error('alertas:', err.message);
        return res.status(500).json({ error: 'No pudimos procesar la solicitud. Intenta de nuevo en unos minutos.' });
    }
};
