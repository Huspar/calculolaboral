/**
 * Utilidades compartidas del cobro con Flow (API v2) y la entrega de los kits.
 *
 * El kit se entrega solo cuando el servidor confirma con Flow (payment/getStatus)
 * que el pago esta hecho. El navegador nunca decide si alguien pago.
 *
 * Variables de entorno (Vercel):
 *   FLOW_API_KEY, FLOW_SECRET_KEY  credenciales de Flow (Integraciones > API)
 *   FLOW_API_URL                   opcional; https://sandbox.flow.cl/api para pruebas
 *   SITE_URL                       opcional; por defecto https://calculolaboral.cl
 *   RESEND_API_KEY                 envio de correos
 *
 * Los archivos que empiezan con "_" en /api no se publican como endpoints.
 */
const crypto = require('crypto');

const FLOW_API_URL = (process.env.FLOW_API_URL || 'https://www.flow.cl/api').replace(/\/$/, '');
const SITE_URL = (process.env.SITE_URL || 'https://calculolaboral.cl').replace(/\/$/, '');
const FLOW_STATUS_PAID = 2; // 1 pendiente, 2 pagada, 3 rechazada, 4 anulada
const DOWNLOAD_DAYS = 30;

const FROM = 'Cálculo Laboral <contacto@calculolaboral.cl>';
const NOTIFY_OWNER = 'jhonfcj@gmail.com';

const PRODUCTS = {
    blindaje: {
        code: 'KB',
        amount: 19990,
        subject: 'Kit Blindaje Laboral Pyme 2026',
        filename: 'Kit_Blindaje_Laboral_Pyme_2026.zip',
        // require con ruta fija: Vercel solo empaqueta lo que puede rastrear
        zip: () => require('./assets/kit-base64.js'),
        page: '/kit-cumplimiento-laboral-pymes',
        intro: '21 documentos en Word (.docx editable) y el manual de uso en PDF.',
        steps: [
            'Descomprime el archivo.',
            'Abre primero <strong>00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf</strong>.',
            'En la página 2 del manual verás qué documentos aplican a tu rubro.'
        ]
    },
    datos: {
        code: 'KD',
        amount: 29990,
        subject: 'Kit Ley 21.719 Protección de Datos 2026',
        filename: 'Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip',
        zip: () => require('./assets/kit-datos-base64.js'),
        page: '/kit-cumplimiento-ley-datos-personales-chile',
        intro: '7 instrumentos en Word y Excel editables y el manual de uso (PDF y Word).',
        steps: [
            'Descomprime el archivo.',
            'Abre primero <strong>0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf</strong>.',
            'Reemplaza los campos entre corchetes con los datos de tu empresa.'
        ],
        note: 'La Ley 21.719 rige desde el 1 de diciembre de 2026. Si la Agencia de Protección de Datos dicta normas que cambien estos documentos antes del 31 de diciembre de 2027, te enviaremos la versión actualizada sin costo a este correo.'
    },
    despido: {
        code: 'PD',
        amount: 9990,
        subject: 'Pack Cartas de Despido por Causal 2026',
        filename: 'Pack_Cartas_Despido_por_Causal_Chile_2026.zip',
        zip: () => require('./assets/pack-despido-base64.js'),
        page: '/pack-cartas-despido-chile',
        intro: '22 documentos en Word (.docx editable): cartas de término por causal y documentos de apoyo.',
        steps: [
            'Descomprime el archivo.',
            'Abre primero <strong>00_LEEME_Guia_de_Uso_y_Plazos.docx</strong>: te indica qué carta usar según la causal.',
            'Completa los campos entre corchetes y recuerda el plazo de 3 días hábiles para enviar la carta.'
        ]
    },
    // Generadores: el documento se arma en el navegador con los datos del cliente;
    // el pago confirmado entrega un desbloqueo firmado por UNLOCK_HOURS.
    finiquito: {
        code: 'GF',
        amount: 12990,
        subject: 'Finiquito para Notaría (Word + PDF)',
        page: '/generador-finiquito-chile',
        unlock: true
    },
    contrato: {
        code: 'GC',
        amount: 12990,
        subject: 'Contrato de Trabajo a la Medida (Word + PDF)',
        page: '/generador-contrato-trabajo-chile',
        unlock: true
    },
    informe: {
        code: 'IC',
        amount: 4990,
        subject: 'Informe Ejecutivo de Costo Empresa (PDF)',
        page: '/calculadora-costo-empresa-chile',
        unlock: true
    }
};
const UNLOCK_HOURS = 48;

function productByCode(code) {
    return Object.keys(PRODUCTS).find(k => PRODUCTS[k].code === code) || null;
}

function credentials() {
    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    if (!apiKey || !secretKey) throw new Error('FLOW_API_KEY / FLOW_SECRET_KEY no configuradas');
    return { apiKey, secretKey };
}

// Firma de Flow: HMAC-SHA256 de "nombrevalor" con los parametros en orden alfabetico
function sign(params, secretKey) {
    const raw = Object.keys(params).sort().map(k => k + params[k]).join('');
    return crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
}

async function flowRequest(method, path, params) {
    const { apiKey, secretKey } = credentials();
    const all = { ...params, apiKey };
    const body = new URLSearchParams({ ...all, s: sign(all, secretKey) });
    const url = FLOW_API_URL + path + (method === 'GET' ? '?' + body.toString() : '');
    const resp = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
        body: method === 'POST' ? body.toString() : undefined
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(`Flow ${path} ${resp.status}: ${data.message || JSON.stringify(data).slice(0, 200)}`);
    }
    return data;
}

function createPayment({ product, email, optional }) {
    const p = PRODUCTS[product];
    const commerceOrder = `${p.code}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    return flowRequest('POST', '/payment/create', {
        commerceOrder,
        subject: p.subject,
        currency: 'CLP',
        amount: String(p.amount),
        email,
        // El correo va tambien en optional: respaldo si getStatus no trae "payer"
        optional: JSON.stringify({ ...(optional || {}), correo: email }),
        urlConfirmation: `${SITE_URL}/api/flow-confirm`,
        urlReturn: `${SITE_URL}/api/flow-return`
    });
}

/**
 * Consulta el pago en Flow. Devuelve { paid, pending, product, status, order, email, optional }.
 * Un pago solo cuenta si Flow lo marca pagado y el monto coincide con el producto.
 */
async function paymentStatus(token) {
    const st = await flowRequest('GET', '/payment/getStatus', { token });
    const product = productByCode(String(st.commerceOrder || '').split('-')[0]);
    let optional = st.optional || {};
    if (typeof optional === 'string') {
        try { optional = JSON.parse(optional); } catch (e) { optional = {}; }
    }
    const amountOk = product && Number(st.amount) === PRODUCTS[product].amount;
    const payer = typeof st.payer === 'string' ? st.payer : '';
    const respaldo = typeof optional.correo === 'string' ? optional.correo : '';
    return {
        paid: Number(st.status) === FLOW_STATUS_PAID && !!amountOk,
        pending: Number(st.status) === 1,
        product,
        status: Number(st.status),
        order: String(st.flowOrder || ''),
        commerceOrder: String(st.commerceOrder || ''),
        email: (payer || respaldo).trim().toLowerCase(),
        optional
    };
}

// Enlace de descarga firmado: no requiere base de datos y caduca en DOWNLOAD_DAYS
function downloadSignature(product, order, exp) {
    const { secretKey } = credentials();
    return crypto.createHmac('sha256', secretKey).update(`dl|${product}|${order}|${exp}`).digest('hex');
}

// Kits: descarga por DOWNLOAD_DAYS. Generadores: desbloqueo por UNLOCK_HOURS.
function downloadQuery(product, order) {
    const ttl = PRODUCTS[product].unlock ? UNLOCK_HOURS * 3600 : DOWNLOAD_DAYS * 86400;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return new URLSearchParams({ p: product, o: order, e: String(exp), sig: downloadSignature(product, order, exp) }).toString();
}

function verifyDownload({ p, o, e, sig }) {
    if (!PRODUCTS[p] || !o || !e || typeof sig !== 'string') return false;
    if (Number(e) < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(downloadSignature(p, o, e));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendEmail(payload, idempotencyKey) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY no configurada');
    const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            // Flow puede avisar mas de una vez el mismo pago: Resend descarta el duplicado
            'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ from: FROM, ...payload })
    });
    if (!resp.ok) throw new Error(`Resend ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

/** Generadores: comprobante con el enlace para volver a desbloquear el documento. */
async function deliverUnlock(pay) {
    const p = PRODUCTS[pay.product];
    const link = `${SITE_URL}${p.page}?${downloadQuery(pay.product, pay.order)}`;
    await sendEmail({
        to: [pay.email],
        reply_to: 'contacto@calculolaboral.cl',
        subject: `Pago confirmado: ${p.subject}`,
        html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Confirmamos tu pago de <strong>$${p.amount.toLocaleString('es-CL')}</strong> por <strong>${escapeHtml(p.subject)}</strong> (orden Flow ${escapeHtml(pay.order)}).</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Si cerraste la página antes de descargar, abre este enlace <strong>en el mismo navegador</strong> donde completaste los datos. Funciona por ${UNLOCK_HOURS} horas.</p>
  <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Volver a mi documento</a></p>
  <p style="margin:0 0 16px;font-size:12px;color:#475569">Es un modelo de referencia basado en la normativa vigente; no constituye asesoría legal.</p>
  <p style="margin:0;font-size:13px;color:#64748b">¿Dudas? Responde este correo.</p>
</div></body></html>`
    }, `unlock-${pay.order}`);
    await notifyOwner(pay, 'Venta confirmada por Flow; documento desbloqueado.');
}

async function notifyOwner(pay, lead) {
    const p = PRODUCTS[pay.product];
    const o = pay.optional || {};
    await sendEmail({
        to: [NOTIFY_OWNER],
        subject: `[VENTA $${p.amount.toLocaleString('es-CL')}] ${p.subject} - ${o.nombre || pay.email || 'orden ' + pay.order}`,
        html: `<p>${lead}</p><ul>
<li>Producto: ${escapeHtml(p.subject)}</li><li>Orden Flow: ${escapeHtml(pay.order)} (${escapeHtml(pay.commerceOrder)})</li>
<li>Correo: ${escapeHtml(pay.email)}</li><li>Nombre: ${escapeHtml(o.nombre)}</li><li>Empresa: ${escapeHtml(o.empresa)}</li>
<li>Teléfono: ${escapeHtml(o.telefono)}</li>${o.rubro ? `<li>Rubro: ${escapeHtml(o.rubro)}</li>` : ''}</ul>`
    }, `notify-${pay.order}`);
}

/** Entrega segun el producto: kit por correo o desbloqueo del generador. */
function deliver(pay) {
    return PRODUCTS[pay.product].unlock ? deliverUnlock(pay) : deliverKit(pay);
}

/** Envia el kit al comprador (adjunto + enlace) y avisa la venta al dueño. */
async function deliverKit(pay) {
    const p = PRODUCTS[pay.product];
    const nombre = (pay.optional && pay.optional.nombre) || '';
    const link = `${SITE_URL}/api/download?${downloadQuery(pay.product, pay.order)}`;
    const zip = p.zip();

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 12px;font-size:15px">Hola${nombre ? ' ' + escapeHtml(nombre) : ''},</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Confirmamos tu pago de <strong>$${p.amount.toLocaleString('es-CL')}</strong> (orden Flow ${escapeHtml(pay.order)}). Adjuntamos <strong>${p.filename}</strong>: ${p.intro}</p>
  <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Descargar el kit</a></p>
  <p style="margin:0 0 8px;font-size:12px;color:#64748b">El enlace funciona por ${DOWNLOAD_DAYS} días, por si el adjunto no te llega.</p>
  <div style="background:#EEF6F3;border:1px solid #D6EBE4;border-radius:12px;padding:16px;margin:16px 0;font-size:13px">
    <p style="margin:0 0 8px;font-weight:700">Para empezar</p>
    <ol style="margin:0;padding-left:18px">${p.steps.map(s => `<li style="margin-bottom:4px">${s}</li>`).join('')}</ol>
  </div>
  ${p.note ? `<p style="margin:0 0 16px;font-size:12px;color:#475569">${p.note}</p>` : ''}
  <p style="margin:0 0 16px;font-size:12px;color:#475569">Son modelos de referencia basados en la normativa vigente; no constituyen asesoría legal. Si tu caso tiene particularidades, revísalos con un abogado antes de firmar.</p>
  <p style="margin:0;font-size:13px;color:#64748b">¿Dudas? Responde este correo.</p>
</div></body></html>`;

    await sendEmail({
        to: [pay.email],
        reply_to: 'contacto@calculolaboral.cl',
        subject: `Tu ${p.subject}`,
        html,
        attachments: [{ filename: p.filename, content: zip }]
    }, `kit-${pay.order}`);

    await notifyOwner(pay, 'Venta confirmada por Flow y kit enviado.');
}

/** Lee el token que Flow envia por POST (form-urlencoded) o por query. */
function readToken(req) {
    let body = req.body;
    if (typeof body === 'string') body = Object.fromEntries(new URLSearchParams(body));
    const token = (body && body.token) || (req.query && req.query.token) || '';
    return typeof token === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(token) ? token : '';
}

module.exports = {
    PRODUCTS, SITE_URL, createPayment, paymentStatus, deliver, notifyOwner, sendEmail,
    downloadQuery, verifyDownload, readToken, escapeHtml
};
