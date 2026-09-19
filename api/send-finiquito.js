/**
 * Vercel Serverless Function: send-finiquito
 * Automatically delivers the Finiquito Notarial Pack (.doc editable)
 * to the buyer via Resend with the document attached,
 * and notifies Jhon (jhonfcj@gmail.com) of the confirmed sale ($12.990 CLP).
 */

const ALLOWED_ORIGINS = new Set([
    'https://calculolaboral.cl',
    'https://www.calculolaboral.cl',
    'http://localhost:3000',
    'http://localhost:5500'
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
        const {
            email,
            empresaRazon,
            empresaRut,
            trabajadorNombre,
            trabajadorRut,
            saldoLiquido,
            htmlContent,
            token
        } = body;

        const cleanEmail = (typeof email === 'string' ? email.trim().toLowerCase() : '');
        const cleanEmpresa = (typeof empresaRazon === 'string' ? empresaRazon.trim().slice(0, 100) : 'Empresa');
        const cleanEmpresaRut = (typeof empresaRut === 'string' ? empresaRut.trim().slice(0, 20) : '—');
        const cleanTrabajador = (typeof trabajadorNombre === 'string' ? trabajadorNombre.trim().slice(0, 80) : 'Trabajador');
        const cleanTrabajadorRut = (typeof trabajadorRut === 'string' ? trabajadorRut.trim().slice(0, 20) : '—');
        const cleanSaldo = (typeof saldoLiquido === 'string' || typeof saldoLiquido === 'number' ? String(saldoLiquido) : '0');
        const cleanToken = (typeof token === 'string' ? token.trim().slice(0, 80) : 'Flow-Directo');

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Correo electrónico no válido.' });
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error('send-finiquito: missing RESEND_API_KEY env var');
            return res.status(500).json({ error: 'Servicio de correo no configurado.' });
        }

        const fechaLocal = new Date().toLocaleDateString('es-CL', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Construir archivo Word (.doc compatible con Word y Google Docs)
        const docBodyContent = typeof htmlContent === 'string' && htmlContent.length > 50
            ? htmlContent
            : `<p>Finiquito legal correspondiente a don(ña) ${escapeHtml(cleanTrabajador)}, RUT ${escapeHtml(cleanTrabajadorRut)}.</p>`;

        const wordHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>Finiquito - ${escapeHtml(cleanTrabajador)}</title>
    <style>
        body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; }
        h2 { text-align: center; font-size: 14pt; margin-bottom: 4pt; }
        p { text-align: justify; margin-bottom: 8pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 8pt; font-family: Arial, sans-serif; font-size: 9.5pt; }
        th, td { border: 1px solid #777; padding: 4pt 6pt; }
        th { background-color: #f2f2f2; text-align: left; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    ${docBodyContent}
</body>
</html>`;

        const wordBufferBase64 = Buffer.from('\ufeff' + wordHtml, 'utf-8').toString('base64');
        const filenameSafe = `Finiquito_${cleanTrabajador.replace(/[^a-zA-Z0-9]/g, '_')}_${cleanTrabajadorRut.replace(/[^a-zA-Z0-9]/g, '')}.doc`;

        // 1. Email para el Comprador
        const buyerSubject = `Tu Finiquito Notarial Oficial [${cleanTrabajador}] - Pack Legal ($12.990)`;
        const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h1 style="color: #0284c7; font-size: 22px; font-weight: 800; margin: 0 0 4px;">Cálculo<span style="color: #0ea5e9;">Laboral</span></h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Generador de Finiquitos y Pack de Despido Notarial Chile 2026</p>
        </div>

        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Estimado(a) empleador(a) de ${escapeHtml(cleanEmpresa)},</p>
        
        <p style="font-size: 14px; color: #334155; margin: 0 0 18px;">
            Confirmamos la recepción de tu pago de <strong>$12.990 CLP</strong> por el <strong>Pack Finiquito Notarial Oficial</strong>. Adjunto a este correo encontrarás el documento completo en formato <strong>Word (.doc 100% editable)</strong> listo para imprimir o personalizar.
        </p>

        <!-- Tarjeta de Resumen del Documento -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <h2 style="color: #0369a1; font-size: 14px; font-weight: 700; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.05em;">
                📄 Datos del Finiquito Emitido:
            </h2>
            <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #64748b; width: 140px;">Trabajador(a):</td><td style="padding: 4px 0; font-weight: bold;">${escapeHtml(cleanTrabajador)}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">RUT Trabajador:</td><td style="padding: 4px 0; font-weight: bold;">${escapeHtml(cleanTrabajadorRut)}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Empleador:</td><td style="padding: 4px 0;">${escapeHtml(cleanEmpresa)} (${escapeHtml(cleanEmpresaRut)})</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Saldo Líquido:</td><td style="padding: 4px 0; font-weight: bold; color: #16a34a;">$${escapeHtml(cleanSaldo)} CLP</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Archivo Adjunto:</td><td style="padding: 4px 0; font-family: monospace;">${filenameSafe}</td></tr>
            </table>
        </div>

        <!-- Instrucciones Notariales -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <h3 style="color: #15803d; font-size: 14px; font-weight: 700; margin: 0 0 10px;">
                🏛️ ¿Qué llevar a la Notaría para ratificar el finiquito?
            </h3>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #166534; line-height: 1.6;">
                <li style="margin-bottom: 6px;"><strong>3 copias impresas</strong> de este finiquito (1 para el empleador, 1 para el trabajador y 1 para el archivo notarial).</li>
                <li style="margin-bottom: 6px;"><strong>Cédulas de identidad vigentes</strong> del representante legal y del trabajador.</li>
                <li style="margin-bottom: 6px;"><strong>Certificado de cotizaciones previsionales al día</strong> (Previred / F-30) para acreditar la <strong>Ley Bustos (Ley Nº 19.631)</strong>.</li>
                <li><strong>Comprobante del medio de pago</strong> pactado (transferencia bancaria, cheque o vale vista).</li>
            </ol>
        </div>

        <!-- Botón de acceso Web durante 48 horas -->
        <div style="text-align: center; margin: 28px 0;">
            <a href="https://calculolaboral.cl/generador-finiquito-chile?pago=exito" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 13px; font-weight: bold; border-radius: 10px; display: inline-block;">
                Ver / Re-descargar en la Web (Garantía 48 Horas)
            </a>
            <p style="font-size: 11px; color: #64748b; margin-top: 8px;">
                Tu sesión web se mantendrá desbloqueada para este trabajador durante 48 horas por si necesitas ajustar algún dato.
            </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
            Cálculo Laboral Chile · calculolaboral.cl · Documento referencial tipo conforme al Artículo 177 del Código del Trabajo.
        </p>
    </div>
</body>
</html>`;

        const buyerText = `Hola,\n\nMuchas gracias por tu compra. Confirmamos tu pago de $12.990 CLP por el Finiquito Notarial de ${cleanTrabajador} (RUT ${cleanTrabajadorRut}).\n\nAdjunto a este correo encontrarás el archivo Word (.doc editable): ${filenameSafe}.\n\nPara firmar en Notaría lleva:\n1. 3 copias impresas de este finiquito.\n2. Cédulas de identidad vigentes.\n3. Planillas de cotizaciones pagadas (Previred / Ley Bustos).\n4. Comprobante de pago.\n\nPuedes volver a ver o descargar tu documento en la web durante 48 horas en:\nhttps://calculolaboral.cl/generador-finiquito-chile?pago=exito\n\nEquipo de Cálculo Laboral Chile\nhttps://calculolaboral.cl`;

        // Helper para enviar emails con Resend API
        async function sendResend(to, subject, html, text, attachments = []) {
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
            const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'calculolaboral-cl/1.0'
                },
                body: JSON.stringify(payload)
            });
            return resp;
        }

        // 2. Despachar correo al comprador con el archivo adjunto
        const buyerResp = await sendResend(
            cleanEmail,
            buyerSubject,
            buyerHtml,
            buyerText,
            [
                {
                    filename: filenameSafe,
                    content: wordBufferBase64
                }
            ]
        );

        if (!buyerResp.ok) {
            const errText = await buyerResp.text();
            console.error('Resend error dispatching finiquito to buyer:', buyerResp.status, errText);
            return res.status(500).json({ error: 'No se pudo enviar el correo al comprador.' });
        }

        // 3. Notificación a Jhon (Alerta de Venta Confirmada de Finiquito)
        const jhonSubject = `💰 [VENTA FINIQUITO $12.990] ${cleanEmpresa} - ${cleanTrabajador}`;
        const jhonHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #0f172a; padding: 20px;">
    <h2 style="color: #16a34a; margin-top: 0;">🎉 ¡Nueva Venta de Finiquito Notarial ($12.990 CLP)!</h2>
    <p>El documento Word oficial ha sido generado y despachado automáticamente al correo del empleador.</p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 150px;">Empresa:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanEmpresa)} (${escapeHtml(cleanEmpresaRut)})</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Trabajador:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanTrabajador)} (${escapeHtml(cleanTrabajadorRut)})</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Correo Comprador:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Saldo Finiquito:</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">$${escapeHtml(cleanSaldo)} CLP</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Token / Orden:</td><td style="padding: 6px 0; font-family: monospace;">${escapeHtml(cleanToken)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Fecha:</td><td style="padding: 6px 0;">${fechaLocal}</td></tr>
    </table>
</body>
</html>`;

        await sendResend(
            NOTIFY_JHON,
            jhonSubject,
            jhonHtml,
            `Nueva venta de Finiquito Notarial $12.990\nEmpresa: ${cleanEmpresa}\nTrabajador: ${cleanTrabajador}\nEmail: ${cleanEmail}\nToken: ${cleanToken}`
        ).catch(e => console.error('Error notifying Jhon:', e));

        return res.status(200).json({
            success: true,
            message: 'Finiquito notarial despachado exitosamente al correo del comprador.'
        });

    } catch (err) {
        console.error('send-finiquito unexpected error:', err);
        return res.status(500).json({ error: 'Error interno al procesar el envío del finiquito.' });
    }
};
