/**
 * Vercel Serverless Function: send-finiquito
 * Automatically delivers the Finiquito Notarial Pack (.doc editable)
 * to the buyer via Resend with the document attached.
 * Solo funciona con un desbloqueo firmado tras un pago verificado con Flow
 * (p, o, e, sig; ver api/_flow.js). La venta ya la avisa /api/flow-confirm.
 */
const { verifyDownload, SITE_URL } = require('./_flow');

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
            token,
            unlock
        } = body;

        // Sin pago verificado no se envia nada (evita usar el dominio para correos arbitrarios)
        const u = unlock && typeof unlock === 'object' ? unlock : {};
        let paid = false;
        try {
            paid = u.p === 'finiquito' && verifyDownload({ p: u.p, o: u.o, e: u.e, sig: u.sig });
        } catch (e) {
            console.error('send-finiquito:', e.message);
        }
        if (!paid) {
            return res.status(403).json({ error: 'Pago no verificado.' });
        }
        const relink = `${SITE_URL}/generador-finiquito-chile?` + new URLSearchParams({ p: u.p, o: u.o, e: String(u.e), sig: u.sig }).toString();

        const cleanEmail = (typeof email === 'string' ? email.trim().toLowerCase() : '');
        const cleanEmpresa = (typeof empresaRazon === 'string' ? empresaRazon.trim().slice(0, 100) : 'Empresa');
        const cleanEmpresaRut = (typeof empresaRut === 'string' ? empresaRut.trim().slice(0, 20) : '—');
        const cleanTrabajador = (typeof trabajadorNombre === 'string' ? trabajadorNombre.trim().slice(0, 80) : 'Trabajador');
        const cleanTrabajadorRut = (typeof trabajadorRut === 'string' ? trabajadorRut.trim().slice(0, 20) : '—');
        const cleanSaldo = (typeof saldoLiquido === 'string' || typeof saldoLiquido === 'number' ? String(saldoLiquido) : '0');

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Correo electrónico no válido.' });
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error('send-finiquito: missing RESEND_API_KEY env var');
            return res.status(500).json({ error: 'Servicio de correo no configurado.' });
        }

        // El documento real pesa ~30 KB; un cuerpo mucho mayor no viene del generador
        if (typeof htmlContent === 'string' && htmlContent.length > 300000) {
            return res.status(413).json({ error: 'Documento demasiado grande.' });
        }

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
        const buyerSubject = `Tu finiquito para notaría: ${cleanTrabajador}`;
        const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
            <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0 0 4px;">Cálculo<span style="color: #00382E;">Laboral</span></h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Generador de finiquitos para notaría · Chile 2026</p>
        </div>

        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Estimado(a) empleador(a) de ${escapeHtml(cleanEmpresa)},</p>
        
        <p style="font-size: 14px; color: #334155; margin: 0 0 18px;">
            Confirmamos la recepción de tu pago de <strong>$12.990 CLP</strong> por el <strong>Finiquito para Notaría (Word + PDF)</strong>. Adjunto a este correo encontrarás el documento completo en formato <strong>Word (.doc editable)</strong> listo para imprimir o personalizar.
        </p>

        <!-- Tarjeta de Resumen del Documento -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <h2 style="color: #00382E; font-size: 14px; font-weight: 700; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.05em;">
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
            <a href="${relink}" style="background-color: #00382E; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 13px; font-weight: bold; border-radius: 10px; display: inline-block;">
                Ver / Re-descargar en la Web (Acceso 48 Horas)
            </a>
            <p style="font-size: 11px; color: #64748b; margin-top: 8px;">
                Tu sesión web se mantendrá desbloqueada para este trabajador durante 48 horas por si necesitas ajustar algún dato.
            </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
        <p style="font-size: 12px; color: #475569; margin: 0 0 12px;">
            Es un modelo de referencia basado en el Artículo 177 del Código del Trabajo; no constituye asesoría legal. Si tu caso tiene particularidades, revísalo con un abogado antes de firmar.
        </p>
        <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
            Cálculo Laboral Chile · calculolaboral.cl
        </p>
    </div>
</body>
</html>`;

        const buyerText = `Hola,\n\nMuchas gracias por tu compra. Confirmamos tu pago de $12.990 CLP por el finiquito para notaría de ${cleanTrabajador} (RUT ${cleanTrabajadorRut}).\n\nAdjunto a este correo encontrarás el archivo Word (.doc editable): ${filenameSafe}.\n\nPara firmar en Notaría lleva:\n1. 3 copias impresas de este finiquito.\n2. Cédulas de identidad vigentes.\n3. Planillas de cotizaciones pagadas (Previred / Ley Bustos).\n4. Comprobante de pago.\n\nPuedes volver a ver o descargar tu documento en la web durante 48 horas en:\n${relink}\n\nEs un modelo de referencia basado en el Artículo 177 del Código del Trabajo; no constituye asesoría legal.\n\nEquipo de Cálculo Laboral Chile\nhttps://calculolaboral.cl`;

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
                    'User-Agent': 'calculolaboral-cl/1.0',
                    // Un solo envío por orden: el desbloqueo no sirve para mandar correos a terceros
                    'Idempotency-Key': `finiquito-${u.o}`
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

        if (buyerResp.status === 409) {
            // Misma orden con otro destinatario o contenido: ya se envió una vez
            return res.status(409).json({ error: 'Este finiquito ya se envió por correo. Usa el enlace del correo o descárgalo desde la página.' });
        }
        if (!buyerResp.ok) {
            const errText = await buyerResp.text();
            console.error('Resend error dispatching finiquito to buyer:', buyerResp.status, errText);
            return res.status(500).json({ error: 'No se pudo enviar el correo al comprador.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Finiquito notarial despachado exitosamente al correo del comprador.'
        });

    } catch (err) {
        console.error('send-finiquito unexpected error:', err);
        return res.status(500).json({ error: 'Error interno al procesar el envío del finiquito.' });
    }
};
