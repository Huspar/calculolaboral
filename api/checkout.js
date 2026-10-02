/**
 * POST /api/checkout  { product: 'blindaje' | 'datos', email, nombre, empresa, telefono, rubro }
 * Crea el pago en Flow y devuelve la URL a la que debe ir el comprador.
 */
const { PRODUCTS, createPayment } = require('./_flow');

const ALLOWED_ORIGINS = new Set([
    'https://calculolaboral.cl',
    'https://www.calculolaboral.cl',
    'http://localhost:3000',
    'http://127.0.0.1:8765'
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

function clean(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método no permitido' });
    }
    if (typeof origin === 'string' && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    if (rateLimited(req)) return res.status(429).json({ error: 'Demasiados intentos. Prueba en unos minutos.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const product = clean(body.product, 20);
    const email = clean(body.email, 254).toLowerCase();
    if (!PRODUCTS[product]) return res.status(400).json({ error: 'Producto no válido.' });
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
        return res.status(400).json({ error: 'Correo electrónico no válido.' });
    }

    try {
        const pay = await createPayment({
            product,
            email,
            optional: {
                nombre: clean(body.nombre, 80),
                empresa: clean(body.empresa, 100),
                telefono: clean(body.telefono, 25),
                rubro: clean(body.rubro, 50)
            }
        });
        if (!pay.url || !pay.token) throw new Error('Respuesta de Flow sin url/token');
        return res.status(200).json({ url: `${pay.url}?token=${pay.token}` });
    } catch (err) {
        console.error('checkout:', err.message);
        // Flow valida que la casilla exista y rechaza correos mal escritos o inventados
        if (/userEmail/i.test(err.message)) {
            return res.status(400).json({ error: 'Flow no aceptó ese correo. Revisa que esté bien escrito e intenta de nuevo.' });
        }
        return res.status(502).json({ error: 'No pudimos conectar con Flow. Intenta de nuevo en unos minutos.' });
    }
};
