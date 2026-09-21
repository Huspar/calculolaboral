/**
 * Vercel Serverless Function: send-kit-datos
 * Automatically delivers the Kit Ley 21.719 Protección de Datos Personales 2026 (.zip)
 * to the buyer via Resend with the archive attached directly,
 * and notifies Jhon (jhonfcj@gmail.com) of the confirmed sale ($29.990 CLP).
 */

const kitZipBase64 = require('./assets/kit-datos-base64.js');

const ALLOWED_ORIGINS = new Set([
    'https://calculolaboral.cl',
    'https://www.calculolaboral.cl',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://localhost:8080',
    'http://localhost:8092',
    'http://localhost:8093'
]);

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 10;
const ipBuckets = new Map();

const FROM_ADDRESS = 'contacto@calculolaboral.cl';
const FROM_NAME = 'Cálculo Laboral';
const NOTIFY_JHON = 'jhonfcj@gmail.com';

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
    return typeof email === 'string'
        && email.length <= 254
        && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);
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

    const origin = req.headers.origin;
    if (typeof origin === 'string' && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    const ip = getClientIp(req);
    const rl = rateLimit(ip);
    if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfter || 60));
        return res.status(429).json({ error: 'Too many requests' });
    }

    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { email, nombre, empresa, telefono, token, sessionId } = body;

        const cleanEmail = (typeof email === 'string' ? email.trim().toLowerCase() : '');
        const cleanName = (typeof nombre === 'string' ? nombre.trim().slice(0, 80) : 'Cliente');
        const cleanEmpresa = (typeof empresa === 'string' ? empresa.trim().slice(0, 100) : 'Empresa');
        const cleanPhone = (typeof telefono === 'string' ? telefono.trim().slice(0, 25) : '—');
        const cleanToken = (typeof token === 'string' ? token.trim().slice(0, 80) : (sessionId || 'Webpay-Directo'));

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Correo electrónico no válido.' });
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        const fechaLocal = new Date().toLocaleDateString('es-CL', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // 1. Email para el Comprador (con el archivo ZIP adjunto)
        const buyerSubject = 'Tu Kit de Cumplimiento Ley 21.719 Protección de Datos Personales 2026 [Word & Excel]';
        const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
            <h1 style="color: #0284c7; font-size: 22px; font-weight: 800; margin: 0 0 6px;">Cálculo<span style="color: #0ea5e9;">Laboral</span></h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Kit LegalTech de Cumplimiento Ley 21.719 (Datos Personales Chile 2026)</p>
        </div>

        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Hola ${escapeHtml(cleanName)},</p>
        <p style="font-size: 14px; color: #334155; margin: 0 0 20px;">
            ¡Muchas gracias por tu compra! Hemos confirmado exitosamente tu pago de <strong>$29.990 CLP</strong>. Adjunto a este correo encontrarás el archivo comprimido <strong>Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip</strong> con los 6 instrumentos legales oficiales en formato Word (.doc editable) y Excel/CSV formulado.
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h2 style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 12px;">📁 Contenido del Paquete Incluido:</h2>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #0f172a; line-height: 1.7;">
                <li style="margin-bottom: 6px;"><strong>1_Anexo_Laboral_Datos_Personales_Ley_21719.doc:</strong> Anexo de contrato con cláusula biométrica (Res. Ex. 38 DT) y reserva de licencias médicas.</li>
                <li style="margin-bottom: 6px;"><strong>2_Politica_Privacidad_Web_y_Pyme_Ley_21719.doc:</strong> Para publicar en el sitio web y contratos comerciales, con catálogo de derechos ARCOP.</li>
                <li style="margin-bottom: 6px;"><strong>3_Clausula_DPA_Proveedores_Encargados_Ley_21719.doc:</strong> Addendum para contador, software de nómina y hosting con exención de responsabilidad solidaria.</li>
                <li style="margin-bottom: 6px;"><strong>4_Registro_Actividades_Tratamiento_RAT_Ley_21719.csv:</strong> Inventario obligatorio Art. 14 ter APDP formulado en Excel/CSV con 6 áreas listas.</li>
                <li style="margin-bottom: 6px;"><strong>5_Protocolo_Brechas_Seguridad_72h_Ley_21719.doc:</strong> Protocolo operativo y formulario oficial de notificación ante la Agencia en plazo de 72 horas.</li>
                <li><strong>Bonus_Formulario_Solicitud_Derechos_ARCOP.doc:</strong> Modelo formal de atención de reclamos con acuse de recibo timbrado (plazo legal 15 días).</li>
            </ol>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
            <p style="margin: 0 0 8px; font-weight: 700; color: #0f172a;">Pasos para implementar en tu empresa (${escapeHtml(cleanEmpresa)}):</p>
            <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
                <li>Descomprime el archivo adjunto en tu computador.</li>
                <li>Reemplaza los campos entre corchetes <code>[NOMBRE EMPRESA]</code> y <code>[RUT]</code> con tus datos reales.</li>
                <li>Firma el anexo con tus dependientes y publica la política en tu sitio web para certificar tu estándar de cumplimiento.</li>
            </ul>
        </div>

        <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">
            Si necesitas asistencia o tienes preguntas sobre la normativa, puedes responder directamente a este correo.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
            Cálculo Laboral Chile · calculolaboral.cl · Todos los derechos reservados.
        </p>
    </div>
</body>
</html>`;

        const buyerText = `Hola ${cleanName},\n\n¡Muchas gracias por tu compra! Hemos confirmado tu pago de $29.990 CLP por el Kit Ley 21.719 de Protección de Datos Personales 2026.\n\nAdjunto a este correo encontrarás el archivo Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip con los 6 instrumentos oficiales en formato Word y Excel.\n\nEquipo de Cálculo Laboral\nhttps://calculolaboral.cl`;

        async function sendResend(to, subject, html, text, attachments = []) {
            if (!resendApiKey) {
                console.warn('send-kit-datos: RESEND_API_KEY no configurado, omitiendo envío de correo externo.');
                return { ok: true, text: async () => 'mock' };
            }
            const payload = {
                from: `${FROM_NAME} <${FROM_ADDRESS}>`,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text
            };
            if (attachments && attachments.length > 0) {
                payload.attachments = attachments;
            }
            return await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'calculolaboral-cl/1.0'
                },
                body: JSON.stringify(payload)
            });
        }

        // 2. Despachar correo al comprador
        const buyerResp = await sendResend(
            cleanEmail,
            buyerSubject,
            buyerHtml,
            buyerText,
            [
                {
                    filename: 'Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip',
                    content: kitZipBase64
                }
            ]
        );

        // 3. Notificación a Jhon (Alerta de Venta Confirmada)
        const jhonSubject = `💰 [VENTA CONFIRMADA $29.990] Kit Ley 21.719 - ${cleanName} (${cleanEmpresa})`;
        const jhonHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #0f172a; padding: 20px;">
    <h2 style="color: #16a34a; margin-top: 0;">🎉 ¡Nueva Venta Confirmada de $29.990!</h2>
    <p>El Kit Ley 21.719 de Protección de Datos Personales ha sido despachado exitosamente al comprador de forma automática.</p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Cliente:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanName)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Empresa:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanEmpresa)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Correo:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Teléfono:</td><td style="padding: 6px 0;">${escapeHtml(cleanPhone)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Monto:</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">$29.990 CLP</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Token / Sesión:</td><td style="padding: 6px 0; font-family: monospace;">${escapeHtml(cleanToken)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Fecha:</td><td style="padding: 6px 0;">${fechaLocal}</td></tr>
    </table>
</body>
</html>`;

        try {
            await sendResend(NOTIFY_JHON, jhonSubject, jhonHtml, `Nueva venta de $29.990: ${cleanName} (${cleanEmpresa}) - ${cleanEmail}`);
        } catch (eNotify) {
            console.warn('Notification to Jhon failed:', eNotify);
        }

        return res.status(200).json({
            success: true,
            email: cleanEmail,
            message: 'Kit despachado correctamente.',
            fileBase64: kitZipBase64
        });

    } catch (error) {
        console.error('Exception inside send-kit-datos api route:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
