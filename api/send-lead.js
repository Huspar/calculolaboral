/**
 * Vercel Serverless Function: send-lead
 * Intermediates between Cálculo Laboral client forms and Resend (transactional email).
 * Sends the lead notification to JHON (CC) and the requested guide/resource to the USER.
 *
 * Hardened (2026-06):
 *  - Strict CORS allowlist (no wildcard)
 *  - In-memory IP rate limit (10 req / 10 min per IP)
 *  - Honeypot field to catch bots
 *  - Input validation: name (1-80), email RFC-lite, phone digits-only (<=20), tipo enum, monto numeric (<=20 chars)
 *  - Body size limit (4KB)
 *  - No hardcoded credential fallbacks: RESEND_API_KEY must be set in Vercel env or the request fails fast.
 *  - Generic error responses (no internal details leaked)
 *  - HTML-escaped email content
 *  - LeadMagnet tipo: also sends a welcome email with the guide link to the user
 */

const ALLOWED_ORIGINS = new Set([
    'https://calculolaboral.cl',
    'https://www.calculolaboral.cl',
    'http://localhost:3000',
    'http://localhost:5500'
]);

const TIPO_ALLOWED = new Set(['Finiquito', 'Sueldo Liquido', 'Sueldo Líquido', 'Contacto', 'LeadMagnet', 'Despido', 'CartaDespido', 'ProtocoloKarin', 'InformePDF', 'Consulta Legal', 'Pyme', 'Multa DT', 'Kit Laboral', 'Demanda Despido Injustificado', 'Despido Art. 160', 'Otro']);

// Leads para abogados: basta un teléfono/WhatsApp válido, el correo es opcional
const TIPO_ABOGADO = new Set(['Consulta Legal', 'Despido', 'Demanda Despido Injustificado', 'Despido Art. 160']);

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 10; // max requests per IP per window
const ipBuckets = new Map(); // ip -> { count, resetAt }

const MAX_BODY_BYTES = 4096;

const FROM_ADDRESS = 'contacto@calculolaboral.cl'; // Verified in Resend on 2026-07-01 (Cloudflare DNS)
const FROM_NAME = 'Cálculo Laboral';
const NOTIFY_JHON = 'jhonfcj@gmail.com';
const GUIDE_URL = 'https://calculolaboral.cl/Articulos/lead-magnet-finiquito.pdf';
const DESPIDO_PACK_URL = 'https://calculolaboral.cl/descargas/Pack_Modelos_Cartas_Despido_Chile_2026.zip';
const DESPIDO_DOCX_ART161_URL = 'https://calculolaboral.cl/descargas/01_Modelo_Carta_Despido_Art161_Necesidades_Empresa_2026.docx';
const DESPIDO_DOCX_ART160_URL = 'https://calculolaboral.cl/descargas/02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx';
const DESPIDO_DOCX_CHECKLIST_URL = 'https://calculolaboral.cl/descargas/03_Checklist_Legal_Envio_Carta_Despido_y_Plazos_DT_2026.docx';
const KARIN_BASE = 'https://calculolaboral.cl/descargas/';
const KARIN_PACK_URL = KARIN_BASE + 'Pack_Ley_Karin_Basico_2026.zip';
const KARIN_DOCS = [
    ['01_Estructura_Protocolo_Ley_Karin_2026.docx', 'Estructura del protocolo de prevención (para completar)'],
    ['02_Formulario_Recepcion_Denuncia_Ley_Karin_2026.docx', 'Formulario de recepción de denuncia'],
    ['03_Comprobante_Entrega_Protocolo_Ley_Karin_2026.docx', 'Comprobante de entrega del protocolo al trabajador'],
];

function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim();
    }
    return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit(ip) {
    const now = Date.now();
    const bucket = ipBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
        ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    if (bucket.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count };
}

function escapeHtml(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
    // RFC 5322 lite — good enough to reject obvious garbage, server still does the real validation.
    return typeof email === 'string'
        && email.length <= 254
        && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
    'mailinator.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com', 'trashmail.net',
    'getnada.com', 'dispostable.com', 'fakeinbox.com', 'generator.email',
    'throwawaymail.com', 'maildrop.cc', 'inboxkitten.com', 'mytemp.email',
    'mohmal.com', 'fakemailgenerator.com', 'crazymailing.com', 'tempail.com',
    'emailondeck.com', 'burnermail.io', 'minuteinbox.com', 'tempmailo.com',
    'guerrillamailblock.com', 'pokemail.net', 'spam4.me', 'grr.la', 'discard.email',
    'harakirimail.com', 'mailcatch.com', 'tempr.email', 'dropmail.me'
]);

function isDisposableEmail(email) {
    if (typeof email !== 'string') return false;
    const parts = email.toLowerCase().split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].trim();
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

async function verifyTurnstile(token, ip) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        // Not configured in environment variables: allow pass-through without breaking
        return { success: true, bypassed: true };
    }
    if (!token || typeof token !== 'string') {
        return { success: false, reason: 'missing-token' };
    }
    try {
        const formData = new URLSearchParams();
        formData.append('secret', secret);
        formData.append('response', token);
        if (ip && ip !== 'unknown') formData.append('remoteip', ip);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const data = await res.json();
        return { success: !!data.success, data };
    } catch (e) {
        console.error('Turnstile verification request error');
        return { success: false, reason: 'network-error' };
    }
}

function maskEmail(email) {
    if (typeof email !== 'string') return '***';
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const user = parts[0];
    const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user.slice(-1);
    return `${maskedUser}@${parts[1]}`;
}

function sanitizeName(value) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, 80);
}

function sanitizePhone(value) {
    if (typeof value !== 'string') return '';
    const digits = value.replace(/[^\d+\s\-]/g, '').trim();
    return digits.slice(0, 20);
}

function sanitizeMonto(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.min(Math.max(value, 0), 1e12));
    if (typeof value !== 'string') return '0';
    const cleaned = value.replace(/[^\d.,\-]/g, '').slice(0, 20);
    return cleaned || '0';
}

function sanitizeTipo(value) {
    if (typeof value !== 'string') return 'Finiquito';
    const trimmed = value.trim().slice(0, 40);
    return TIPO_ALLOWED.has(trimmed) ? trimmed : 'Otro';
}

function setCors(req, res) {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
    }
}

module.exports = async (req, res) => {
    setCors(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Block cross-origin POSTs that did not pass the allowlist (CSRF mitigation).
    const origin = req.headers.origin;
    if (typeof origin === 'string' && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    // Body size guard
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'Payload too large' });
    }

    const ip = getClientIp(req);
    const rl = rateLimit(ip);
    if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfter || 60));
        return res.status(429).json({ error: 'Too many requests' });
    }

    try {
        // Vercel parses JSON automatically when Content-Type is application/json.
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const {
            nombre,
            correo,
            telefono,
            monto_calculado,
            tipo,
            // Honeypot: must be empty for real users; bots fill it.
            website,
            // Minimum time the form has been on screen (ms). If too short, treat as bot.
            form_rendered_at
        } = body;

        // 1. Cloudflare Turnstile Verification (if configured in env)
        const turnstileToken = body['cf-turnstile-response'] || body.turnstile_token;
        if (process.env.TURNSTILE_SECRET_KEY) {
            const turnstileResult = await verifyTurnstile(turnstileToken, ip);
            if (!turnstileResult.success) {
                return res.status(403).json({ error: 'Verificación de seguridad fallida. Por favor recarga e intenta nuevamente.' });
            }
        }

        if (typeof website === 'string' && website.trim().length > 0) {
            // Silently accept to look like a success without sending anything.
            return res.status(200).json({ success: true });
        }

        if (typeof form_rendered_at === 'number' && Date.now() - form_rendered_at < 1500) {
            return res.status(200).json({ success: true });
        }

        const cleanName = sanitizeName(nombre);
        const cleanEmail = (typeof correo === 'string' ? correo.trim().toLowerCase() : '');

        if (!cleanName) {
            return res.status(400).json({ error: 'Nombre es obligatorio.' });
        }
        const cleanPhone = sanitizePhone(telefono);
        const cleanMonto = sanitizeMonto(monto_calculado);
        const cleanTipo = sanitizeTipo(tipo);
        const phoneDigits = cleanPhone.replace(/\D/g, '');
        const emailOptional = TIPO_ABOGADO.has(cleanTipo) && phoneDigits.length >= 8;
        const hasEmail = cleanEmail.length > 0;

        if (TIPO_ABOGADO.has(cleanTipo) && !hasEmail && phoneDigits.length < 8) {
            return res.status(400).json({ error: 'Ingresa un WhatsApp o teléfono válido.' });
        }
        if (hasEmail || !emailOptional) {
            if (!isValidEmail(cleanEmail)) {
                return res.status(400).json({ error: 'Correo no válido.' });
            }
            if (isDisposableEmail(cleanEmail)) {
                return res.status(400).json({ error: 'Por favor ingresa un correo electrónico corporativo o personal válido.' });
            }
        }

        // Resend API key must come from Vercel env. No hardcoded fallbacks.
        const resendApiKey = process.env.RESEND_API_KEY;

        if (!resendApiKey) {
            console.error('send-lead: missing RESEND_API_KEY env var');
            return res.status(500).json({ error: 'Service not configured' });
        }

        const fechaLocal = new Date().toLocaleDateString('es-CL');

        // Email body builder: small helper, escapes HTML, returns safe HTML and text versions
        function buildEmailHtml({ title, intro, body }) {
            return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; color: #0f172a; line-height: 1.5; max-width: 560px; margin: 0 auto; padding: 24px;">
<h1 style="color: #0ea5e9; font-size: 22px; margin: 0 0 16px;">${title}</h1>
<p style="margin: 0 0 16px;">${intro}</p>
<div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 14px 18px; margin: 0 0 16px; font-size: 14px;">${body}</div>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
<p style="font-size: 12px; color: #64748b; margin: 0;">Cálculo Laboral · calculolaboral.cl</p>
</body>
</html>`;
        }

        function buildEmailText({ intro, body }) {
            return `${intro}\n\n${body.replace(/<[^>]+>/g, '')}\n\n--\nCálculo Laboral · calculolaboral.cl`;
        }

        let userSubject, userHtml, userText;

        if (cleanTipo === 'LeadMagnet') {
            // LeadMagnet: send a welcome email to the user with the guide link
            userSubject = 'Tu guía "Qué hago con mi finiquito" está lista';
            const userIntro = `Hola ${cleanName}, gracias por descargar la guía. Te la adjuntamos a continuación.`;
            const userBody = `
                <p style="margin: 0 0 12px;"><strong>📘 Guía: Qué hago con mi finiquito</strong></p>
                <p style="margin: 0 0 12px;">6 páginas · lectura de 6 minutos · 3 escenarios de inversión + plan de 90 días.</p>
                <p style="margin: 16px 0; text-align: center;">
                    <a href="${GUIDE_URL}" style="background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Descargar la guía (PDF)</a>
                </p>
                <p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">El link de descarga funciona en cualquier dispositivo. Puedes compartirla con quien quieras.</p>
            `;
        } else if (cleanTipo === 'CartaDespido') {
            userSubject = 'Tus Modelos de Carta de Despido 2026 (Word .docx)';
            const userIntro = `Hola ${cleanName}, gracias por solicitar los modelos de carta de despido en formato Word (.docx).`;
            const userBody = `
                <p style="margin: 0 0 12px;"><strong>📄 Pack de Cartas de Despido Chile 2026</strong></p>
                <p style="margin: 0 0 12px;">Incluye formatos Word (.docx totalmente editables para incorporar membrete y razón social):</p>
                <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #334155;">
                    <li><strong>Modelo 1:</strong> Despido por Necesidades de la Empresa (Art. 161 inc. 1º) con fundamentación técnica y Ley Bustos.</li>
                    <li><strong>Modelo 2:</strong> Despido Disciplinario por Inasistencia Injustificada (Art. 160 Nº 3).</li>
                    <li><strong>Checklist Legal:</strong> Plazos fatales de envío a Correos de Chile y comunicación a la Dirección del Trabajo (DT).</li>
                </ul>
                <p style="margin: 20px 0; text-align: center;">
                    <a href="${DESPIDO_PACK_URL}" style="background: #0284c7; color: #ffffff !important; padding: 13px 26px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 14px;">Descargar Pack Completo (.zip)</a>
                </p>
                <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #0f172a;">
                        📱 ¿En tu celular o prefieres descargar los archivos Word directamente?
                    </p>
                    <p style="margin: 0 0 10px; font-size: 12px; color: #475569;">
                        Haz clic en cualquiera de los enlaces directos para abrir o guardar cada documento Word (.docx) sin necesidad de descomprimir:
                    </p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.7;">
                        <li style="margin-bottom: 4px;">
                            <a href="${DESPIDO_DOCX_ART161_URL}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Descargar Modelo 1: Art. 161 Necesidades de la Empresa (.docx)</a>
                        </li>
                        <li style="margin-bottom: 4px;">
                            <a href="${DESPIDO_DOCX_ART160_URL}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Descargar Modelo 2: Art. 160 Nº 3 Inasistencia Injustificada (.docx)</a>
                        </li>
                        <li style="margin-bottom: 0;">
                            <a href="${DESPIDO_DOCX_CHECKLIST_URL}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Descargar Checklist: Plazos y Trámites DT (.docx)</a>
                        </li>
                    </ul>
                </div>
                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin: 18px 0; font-size: 12.5px; color: #92400e;">
                    <strong>⚠️ Plazo Legal Obligatorio (Art. 177):</strong><br>
                    Recuerda que una vez entregada o despachada la carta, tienes un plazo legal máximo de <strong>10 días hábiles</strong> para poner a disposición del trabajador su finiquito notarial ratificado.
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 14px 0; font-size: 12.5px;">
                    <strong>Soluciones complementarias para tu empresa:</strong><br>
                    • <a href="https://calculolaboral.cl/pack-cartas-despido-chile" style="color: #0284c7; font-weight: bold;">Pack de Cartas de Despido por Causal ($9.990)</a>: 22 documentos Word con una carta para cada causal de los artículos 159, 160 y 161, amonestación, descargos y aviso a la Inspección.<br>
                    • <a href="https://calculolaboral.cl/kit-cumplimiento-ley-datos-personales-chile" style="color: #e11d48; font-weight: bold;">Kit Ley 21.719 Protección de Datos ($29.990)</a>: 7 instrumentos en Word para adecuar tu pyme a la nueva ley de datos personales, que rige desde el 1 de diciembre de 2026. Reduce el riesgo de multas de la Agencia de Protección de Datos.<br>
                    • <a href="https://calculolaboral.cl/kit-cumplimiento-laboral-pymes" style="color: #0284c7; font-weight: bold;">Kit de Blindaje Pyme ($19.990)</a>: Protocolo Ley Karin (DS 44), anexos Ley 40 Horas y carpeta de fiscalización DT.<br>
                    • <a href="https://calculolaboral.cl/generador-finiquito-chile" style="color: #0284c7; font-weight: bold;">Generador de Finiquito Notarial ($12.990)</a>: Cálculo exacto de indemnizaciones, feriado proporcional y documento listo para notaría.
                </div>
            `;
            userHtml = buildEmailHtml({ title: 'Tus Modelos de Carta de Despido (.docx) 📄', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        } else if (cleanTipo === 'ProtocoloKarin') {
            userSubject = 'Tu pack Ley Karin para empresas (Word .docx)';
            const userIntro = `Hola ${cleanName}, aquí tienes los documentos de Ley Karin en Word, editables con los datos de tu empresa.`;
            const userBody = `
                <p style="margin: 0 0 12px;"><strong>Pack Ley Karin básico 2026</strong></p>
                <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #334155;">
                    ${KARIN_DOCS.map(([file, label]) => `<li style="margin-bottom: 4px;"><a href="${KARIN_BASE}${file}" style="color: #00382E; text-decoration: underline; font-weight: 600;">${label}</a></li>`).join('')}
                </ul>
                <p style="margin: 20px 0; text-align: center;">
                    <a href="${KARIN_PACK_URL}" style="background: #00382E; color: #ffffff !important; padding: 13px 26px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 14px;">Descargar los 3 documentos (.zip)</a>
                </p>
                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin: 18px 0; font-size: 12.5px; color: #92400e;">
                    <strong>Si llega una denuncia:</strong> adopta de inmediato medidas de resguardo, decide en 3 días hábiles si investigas o derivas a la Inspección del Trabajo, y si investigas, termina en 30 días hábiles.
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 14px 0; font-size: 12.5px;">
                    ¿Prefieres el protocolo ya redactado? El <a href="https://calculolaboral.cl/kit-cumplimiento-laboral-pymes" style="color: #00382E; font-weight: bold;">Kit Blindaje Laboral Pyme ($19.990)</a> incluye el protocolo completo, la matriz de riesgos psicosociales, las actas de resguardo y capacitación, y anexos de jornada 42 horas.
                </div>
                <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">Son modelos de referencia basados en la Ley 21.643; adáptalos a tu empresa. Guía completa: <a href="https://calculolaboral.cl/protocolo-ley-karin-empresas" style="color: #00382E;">calculolaboral.cl/protocolo-ley-karin-empresas</a></p>
            `;
            userHtml = buildEmailHtml({ title: 'Tu pack Ley Karin (.docx)', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        } else if (cleanTipo === 'InformePDF') {
            const esSueldo = body.producto === 'sueldo_liquido';
            const saludo = cleanName && cleanName !== 'Lector' ? `Hola ${cleanName},` : 'Hola,';
            const montoTxt = cleanMonto && cleanMonto !== '0' ? '$' + cleanMonto : '';
            userSubject = esSueldo ? 'Tu cálculo de sueldo líquido - Cálculo Laboral' : 'Tu cálculo de finiquito - Cálculo Laboral';
            const userIntro = `${saludo} aquí tienes una copia del resultado que calculaste en calculolaboral.cl. El informe en PDF lo descargaste desde la página.`;
            const resultado = montoTxt
                ? `<p style="margin: 0 0 12px;"><strong>${esSueldo ? 'Sueldo líquido estimado' : 'Total estimado del finiquito'}:</strong> <span style="font-size: 18px; font-weight: bold; color: #00382E;">${montoTxt} CLP</span></p>`
                : '';
            const siguiente = esSueldo
                ? `<li><a href="https://calculolaboral.cl/como-leer-liquidacion-de-sueldo" style="color: #00382E; font-weight: 600;">Cómo leer tu liquidación de sueldo</a>, para comparar cada descuento con tu liquidación real.</li>
                   <li><a href="https://calculolaboral.cl/calculadora-horas-extras" style="color: #00382E; font-weight: 600;">Calculadora de horas extras</a>, si trabajas más de tu jornada.</li>`
                : `<li><a href="https://calculolaboral.cl/finiquito-por-renuncia-voluntaria" style="color: #00382E; font-weight: 600;">Finiquito por renuncia voluntaria</a>: qué te corresponde y qué no.</li>
                   <li><a href="https://calculolaboral.cl/que-hacer-si-no-te-pagan-el-finiquito" style="color: #00382E; font-weight: 600;">Qué hacer si no te pagan el finiquito</a>.</li>`;
            const userBody = `
                ${resultado}
                <p style="margin: 0 0 12px; font-size: 13px; color: #475569;">Es una estimación referencial. El valor definitivo depende de tus antecedentes, de tu contrato y de lo que acuerdes con tu empleador.</p>
                ${esSueldo ? '' : '<p style="margin: 0 0 12px; font-size: 13px; color: #475569;">Recuerda que, para tener poder liberatorio, el finiquito debe firmarse ante un ministro de fe (notario, Inspección del Trabajo u otro que indica el Art. 177 del Código del Trabajo).</p>'}
                <p style="margin: 14px 0 6px;"><strong>Para seguir:</strong></p>
                <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #334155;">${siguiente}</ul>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 14px 0; font-size: 12.5px; color: #334155;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Publicidad · Banco Itaú</span><br>
                    ${esSueldo ? '¿Dónde recibirás tu sueldo?' : '¿Dónde recibirás tu pago?'} Abre una Cuenta Corriente Itaú 100% online, con $0 de mantención al transferir tu remuneración mensual. Sujeto a evaluación de antecedentes comerciales.<br>
                    <a href="https://calculolaboral.cl/itau-correo" style="color: #00382E; font-weight: bold;">Ver la cuenta corriente</a>
                </div>
                <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">Recibes este correo porque pediste una copia del cálculo en calculolaboral.cl. No te enviaremos otros mensajes por este motivo.</p>
            `;
            userHtml = buildEmailHtml({ title: esSueldo ? 'Tu cálculo de sueldo líquido' : 'Tu cálculo de finiquito', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        } else if (cleanTipo === 'Multa DT') {
            userSubject = 'Evaluación de Multa DT (Art. 511) - Cálculo Laboral';
            const userIntro = `Hola ${cleanName}, hemos recibido los antecedentes de la multa de tu empresa.`;
            const userBody = `
                <p style="margin: 0 0 12px;"><strong>Reconsideración Administrativa de Multa DT (Art. 511)</strong></p>
                <p style="margin: 0 0 12px;">Considerando que el plazo legal ante la Dirección del Trabajo es perentorio (<strong>15 días hábiles</strong> desde la notificación), un especialista revisará la viabilidad de solicitar la rebaja de hasta el 80% o sustitución por capacitación.</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Te contactaremos a la mayor brevedad a tu correo (${cleanEmail}) o teléfono de contacto.</p>
            `;
            userHtml = buildEmailHtml({ title: 'Solicitud Recibida - Multa DT', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        } else if (cleanTipo === 'Pyme' || cleanTipo === 'Kit Laboral') {
            userSubject = 'Confirmación de Solicitud para Empresas - Cálculo Laboral';
            const userIntro = `Hola ${cleanName}, hemos recibido tu consulta sobre soluciones laborales para tu empresa.`;
            const userBody = `
                <p style="margin: 0 0 12px;"><strong>Kit de Blindaje y Cumplimiento Laboral Pyme 2026</strong></p>
                <p style="margin: 0 0 12px;">Tu solicitud ha sido registrada correctamente. Un ejecutivo de atención para empleadores revisará los requerimientos de tu rubro y te contactará a la brevedad.</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Cálculo Laboral · calculolaboral.cl</p>
            `;
            userHtml = buildEmailHtml({ title: 'Solicitud para Empresas Registrada', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        } else {
            // Other tipos: only the user gets a confirmation, no resource attached
            userSubject = 'Recibimos tu consulta en Cálculo Laboral';
            const userIntro = `Hola ${cleanName}, recibimos tu mensaje. Te contactaremos pronto.`;
            const userBody = `<p>Nuestro equipo revisará tu caso y te responderá a la brevedad al correo ${cleanEmail}.</p>`;
            userHtml = buildEmailHtml({ title: 'Recibimos tu consulta', intro: userIntro, body: userBody });
            userText = buildEmailText({ intro: userIntro, body: userBody });
        }

        const cleanFuente = escapeHtml(typeof body === 'object' && body && body.fuente ? body.fuente.trim() : 'Calculadora de Finiquito');
        const cleanDetalle = typeof body === 'object' && body && body.detalle ? escapeHtml(body.detalle.trim().slice(0, 300)) : '';
        const cleanOrigen = typeof body === 'object' && body && typeof body.origen === 'string' ? escapeHtml(body.origen.trim().slice(0, 160)) : '';

        // Notification email to JHON (with all lead details and origin source)
        const jhonSubject = `[Lead - ${cleanFuente}] ${cleanName}`;
        const jhonIntro = `Nuevo lead capturado desde <strong>${cleanFuente}</strong> en calculolaboral.cl.`;
        const jhonBody = `
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Origen / Formulario:</td><td style="padding: 6px 0; font-weight: bold; color: #0284c7;">${cleanFuente}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Nombre:</td><td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${cleanName}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Correo:</td><td style="padding: 6px 0;">${hasEmail ? `<a href="mailto:${cleanEmail}" style="color: #0ea5e9; font-weight: 600;">${cleanEmail}</a>` : '— (solo WhatsApp)'}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Teléfono:</td><td style="padding: 6px 0; font-weight: bold; color: #0f172a;"><a href="tel:${cleanPhone}" style="color: #0f172a; text-decoration: none;">${cleanPhone || '—'}</a></td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Monto / Estimación:</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">${cleanMonto && cleanMonto !== '0' ? '$' + cleanMonto + ' CLP' : 'Consulta directa desde guía'}</td></tr>
                ${cleanDetalle ? `<tr><td style="padding: 6px 0; color: #64748b;">Detalle / Caso:</td><td style="padding: 6px 0; color: #334155; font-style: italic;">${cleanDetalle}</td></tr>` : ''}
                ${cleanOrigen ? `<tr><td style="padding: 6px 0; color: #64748b;">Llegó desde:</td><td style="padding: 6px 0; color: #334155;">${cleanOrigen}</td></tr>` : ''}
                <tr><td style="padding: 6px 0; color: #64748b;">Tipo:</td><td style="padding: 6px 0; color: #64748b;">${cleanTipo}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Fecha:</td><td style="padding: 6px 0; color: #64748b;">${fechaLocal}</td></tr>
            </table>
        `;
        const jhonHtml = buildEmailHtml({ title: `Nuevo Lead: ${cleanName}`, intro: jhonIntro, body: jhonBody });
        const jhonText = buildEmailText({ intro: jhonIntro, body: jhonBody });

        // Send BOTH emails via Resend (user first, then jhon)
        async function sendResendEmail(to, subject, html, text, replyTo) {
            const payload = {
                from: `${FROM_NAME} <${FROM_ADDRESS}>`,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text,
            };
            if (replyTo) {
                payload.reply_to = replyTo;
            }
            const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'calculolaboral-cl/1.0',
                },
                body: JSON.stringify(payload),
            });
            return resp;
        }

        // 1. Send to JHON first (Essential: The lead is captured and must NEVER be lost)
        const jhonResp = await sendResendEmail(
            NOTIFY_JHON,
            jhonSubject,
            jhonHtml,
            jhonText,
            hasEmail ? cleanEmail : undefined // Reply-To al correo del usuario cuando lo entregó
        );
        if (!jhonResp.ok) {
            console.error('Resend error (jhon email): status', jhonResp.status);
            return res.status(500).json({ error: 'No se pudo registrar la solicitud en el servidor.' });
        }

        // 2. Try sending confirmation/welcome to the user (non-blocking)
        if (hasEmail) try {
            const userResp = await sendResendEmail(
                cleanEmail,
                userSubject,
                userHtml,
                userText,
                NOTIFY_JHON
            );
            if (!userResp.ok) {
                console.warn(`Resend notice: user auto-responder email failed for ${maskEmail(cleanEmail)} (status ${userResp.status})`);
            }
        } catch (eUser) {
            console.warn(`Exception during user email for ${maskEmail(cleanEmail)} (ignored to preserve lead)`);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Exception inside send-lead api route:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
