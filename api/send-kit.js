/**
 * Vercel Serverless Function: send-kit
 * Automatically delivers the Kit de Blindaje Laboral Pyme 2026 (.zip)
 * to the buyer via Resend with the archive attached directly,
 * and notifies Jhon (jhonfcj@gmail.com) of the confirmed sale.
 */

const fs = require('fs');
const path = require('path');
const kitZipBase64 = require('./assets/kit-base64.js');

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
        const { email, nombre, empresa, telefono, token, rubro } = body;

        const cleanEmail = (typeof email === 'string' ? email.trim().toLowerCase() : '');
        const cleanName = (typeof nombre === 'string' ? nombre.trim().slice(0, 80) : 'Cliente');
        const cleanEmpresa = (typeof empresa === 'string' ? empresa.trim().slice(0, 100) : 'Empresa');
        const cleanPhone = (typeof telefono === 'string' ? telefono.trim().slice(0, 25) : '—');
        const cleanRubro = (typeof rubro === 'string' ? rubro.trim().slice(0, 50) : 'General');
        const cleanToken = (typeof token === 'string' ? token.trim().slice(0, 80) : 'Webpay-Directo');

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Correo electrónico no válido.' });
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error('send-kit: missing RESEND_API_KEY env var');
            return res.status(500).json({ error: 'Servicio de correo no configurado.' });
        }

        const fechaLocal = new Date().toLocaleDateString('es-CL', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // 1. Email para el Comprador (con el archivo ZIP adjunto)
        const buyerSubject = 'Tu Kit de Blindaje y Cumplimiento Laboral Pyme 2026 [Documentos Word + Guía]';
        const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; pb: 20px;">
            <h1 style="color: #0284c7; font-size: 22px; font-weight: 800; margin: 0 0 6px;">Cálculo<span style="color: #0ea5e9;">Laboral</span></h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Suite de Cumplimiento y Blindaje Laboral Pyme 2026</p>
        </div>

        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Hola ${escapeHtml(cleanName)},</p>
        <p style="font-size: 14px; color: #334155; margin: 0 0 20px;">
            ¡Muchas gracias por tu compra! Hemos confirmado tu pago de <strong>$19.990 CLP</strong>. Adjunto a este correo encontrarás el paquete comprimido <strong>Kit_Blindaje_Laboral_Pyme_2026.zip</strong> con los 21 documentos oficiales en formato Word (.docx 100% editable) y las guías de implementación para la Dirección del Trabajo (DT).
        </p>

        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h2 style="color: #0369a1; font-size: 15px; font-weight: 700; margin: 0 0 12px;">💡 Guía de Inicio Rápido (3 Pasos):</h2>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #0f172a; line-height: 1.7;">
                <li style="margin-bottom: 8px;"><strong>Descarga y descomprime</strong> el archivo <code>Kit_Blindaje_Laboral_Pyme_2026.zip</code> adjunto en este correo.</li>
                <li style="margin-bottom: 8px;"><strong>Abre primero el archivo:</strong> <code>00_INSTRUCCIONES_Y_GUIA_DE_IMPLEMENTACION_PYME.docx</code>.</li>
                <li><strong>Revisa la Sección 3 (Árbol de Decisión):</strong> Encontrarás una tabla que te indica exactamente cuáles son los 3 o 4 documentos que aplican a tu rubro (${escapeHtml(cleanRubro)}), para que no pierdas tiempo revisando anexos que no necesitas.</li>
            </ol>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
            <p style="margin: 0 0 8px; font-weight: 700; color: #0f172a;">Respaldo Normativo Vigente:</p>
            <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
                <li>Ley N° 21.643 (Ley Karin) y Decreto Supremo N° 44 del Mintrab.</li>
                <li>Pauta simplificada Circular N° 3.813 de la SUSESO.</li>
                <li>Ley N° 21.561 (Ley 40 Horas - Hito legal 42h para el año 2026).</li>
            </ul>
        </div>

        <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">
            Si tienes dudas con la personalización de las plantillas o la carga en el portal Mi DT, puedes responder directamente a este correo.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
            Cálculo Laboral Chile · calculolaboral.cl · Modelos referenciales tipo conforme a la legislación vigente.
        </p>
    </div>
</body>
</html>`;

        const buyerText = `Hola ${cleanName},\n\n¡Muchas gracias por tu compra! Adjunto a este correo encontrarás el archivo Kit_Blindaje_Laboral_Pyme_2026.zip con los 21 documentos oficiales en formato Word (.docx editable).\n\nGuía rápida:\n1. Descomprime el archivo adjunto.\n2. Abre el archivo 00_INSTRUCCIONES_Y_GUIA_DE_IMPLEMENTACION_PYME.docx.\n3. Revisa la Sección 3 (Árbol de Decisión) para ver los documentos específicos de tu rubro.\n\nSoporte: responde directamente a este correo si tienes dudas.\n\nEquipo de Cálculo Laboral\nhttps://calculolaboral.cl`;

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
                    filename: 'Kit_Blindaje_Laboral_Pyme_2026.zip',
                    content: kitZipBase64
                }
            ]
        );

        if (!buyerResp.ok) {
            const errText = await buyerResp.text();
            console.error('Resend error dispatching to buyer:', buyerResp.status, errText);
            return res.status(500).json({ error: 'No se pudo enviar el correo con el producto digital.' });
        }

        // 3. Notificación a Jhon (Alerta de Venta Confirmada)
        const jhonSubject = `💰 [VENTA CONFIRMADA $19.990] Kit Pyme - ${cleanName} (${cleanEmpresa})`;
        const jhonHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #0f172a; padding: 20px;">
    <h2 style="color: #16a34a; margin-top: 0;">🎉 ¡Nueva Venta Confirmada de $19.990!</h2>
    <p>El kit digital ha sido despachado exitosamente al comprador de forma automática.</p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Cliente:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanName)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Empresa:</td><td style="padding: 6px 0; font-weight: bold;">${escapeHtml(cleanEmpresa)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Correo:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Teléfono:</td><td style="padding: 6px 0;">${escapeHtml(cleanPhone)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Rubro:</td><td style="padding: 6px 0;">${escapeHtml(cleanRubro)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Monto:</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">$19.990 CLP</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Token / Orden:</td><td style="padding: 6px 0; font-family: monospace;">${escapeHtml(cleanToken)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Fecha:</td><td style="padding: 6px 0;">${fechaLocal}</td></tr>
    </table>
</body>
</html>`;

        try {
            await sendResend(NOTIFY_JHON, jhonSubject, jhonHtml, `Nueva venta de $19.990: ${cleanName} (${cleanEmpresa}) - ${cleanEmail}`);
        } catch (eNotify) {
            console.warn('Notification to Jhon failed (buyer already received kit):', eNotify);
        }

        return res.status(200).json({
            success: true,
            email: cleanEmail,
            message: 'Kit despachado correctamente.',
            fileBase64: kitZipBase64
        });

    } catch (error) {
        console.error('Exception inside send-kit api route:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
