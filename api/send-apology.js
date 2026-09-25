/**
 * Serverless function to dispatch the apology & direct file delivery email to Andres.
 * Protected by secret key.
 */

const FROM_NAME = 'Cálculo Laboral';
const FROM_ADDRESS = 'contacto@calculolaboral.cl';
const NOTIFY_JHON = 'jhonfcj@gmail.com';
const TARGET_EMAIL = 'andresgolivares@gmail.com';

const DESPIDO_PACK_URL = 'https://calculolaboral.cl/descargas/Pack_Modelos_Cartas_Despido_Chile_2026.zip';
const DESPIDO_DOCX_ART161_URL = 'https://calculolaboral.cl/descargas/01_Modelo_Carta_Despido_Art161_Necesidades_Empresa_2026.docx';
const DESPIDO_DOCX_ART160_URL = 'https://calculolaboral.cl/descargas/02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx';
const DESPIDO_DOCX_CHECKLIST_URL = 'https://calculolaboral.cl/descargas/03_Checklist_Legal_Envio_Carta_Despido_y_Plazos_DT_2026.docx';

module.exports = async (req, res) => {
    // Basic protection
    const token = req.query.token || (req.body && req.body.token);
    if (token !== 'cl_dispatch_apology_andres_2026') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
    }

    const subject = 'Disculpas y entrega directa: Tus Modelos de Carta de Despido 2026 (.docx / .zip) — Cálculo Laboral';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modelos de Carta de Despido 2026</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
            <span style="font-size: 18px; font-weight: bold; color: #0f172a;">Cálculo<span style="color: #0284c7;">Laboral</span></span>
            <span style="font-size: 12px; color: #64748b; margin-left: 8px;">· Plataforma Laboral Legal Chile</span>
        </div>

        <h1 style="color: #0f172a; font-size: 20px; font-weight: bold; margin: 0 0 16px;">Estimado Andrés,</h1>
        
        <p style="margin: 0 0 14px; font-size: 14px; color: #334155;">
            Te escribimos directamente desde el equipo de <strong>Cálculo Laboral</strong> en relación a la solicitud del <strong>Pack de Cartas de Despido Chile 2026</strong> que realizaste hoy por la mañana (a eso de las 11:00 hrs) en nuestra plataforma.
        </p>

        <p style="margin: 0 0 16px; font-size: 14px; color: #334155;">
            Al revisar los registros del sistema de hoy, nos dimos cuenta de que lamentablemente se produjo un error técnico en nuestro servidor que te impidió descargar el archivo en ese momento. <strong>Te pedimos sinceras disculpas por la demora, el inconveniente y el tiempo perdido durante el día.</strong>
        </p>

        <p style="margin: 0 0 20px; font-size: 14px; color: #334155;">
            El problema técnico ya fue 100% corregido y no queríamos que terminara la jornada sin hacerte entrega formal de los documentos para que puedas utilizarlos de inmediato:
        </p>

        <!-- Master ZIP Button -->
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 18px; margin-bottom: 20px; text-align: center;">
            <p style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #0369a1;">
                📦 Opción 1: Descargar Pack Completo (.ZIP)
            </p>
            <p style="margin: 0 0 14px; font-size: 12px; color: #475569;">
                Incluye los 2 modelos Word editables + el Checklist Legal en un solo archivo:
            </p>
            <a href="${DESPIDO_PACK_URL}" style="background-color: #0284c7; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                Descargar Pack Completo (.ZIP)
            </a>
        </div>

        <!-- Individual DOCX Section -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px; font-size: 13.5px; font-weight: bold; color: #0f172a;">
                📱 Opción 2: Descarga directa por documento (Word .docx)
            </p>
            <p style="margin: 0 0 12px; font-size: 12px; color: #64748b;">
                Ideal si estás revisando este correo desde tu teléfono celular o prefieres abrirlos sin descomprimir:
            </p>
            
            <div style="margin-bottom: 10px;">
                <p style="margin: 0 0 2px; font-size: 13px; font-weight: 600; color: #1e293b;">
                    1. 📄 Modelo 1: Despido por Necesidades de la Empresa (Art. 161 Inc. 1º)
                </p>
                <p style="margin: 0 0 4px; font-size: 11.5px; color: #64748b;">Incluye fundamentación técnica/económica y cláusula Ley Bustos.</p>
                <a href="${DESPIDO_DOCX_ART161_URL}" style="color: #0284c7; text-decoration: underline; font-size: 12.5px; font-weight: 600;">👉 Descargar Modelo Art. 161 (.docx)</a>
            </div>

            <div style="margin-bottom: 10px;">
                <p style="margin: 0 0 2px; font-size: 13px; font-weight: 600; color: #1e293b;">
                    2. 📄 Modelo 2: Despido Disciplinario por Inasistencia (Art. 160 Nº 3)
                </p>
                <p style="margin: 0 0 4px; font-size: 11.5px; color: #64748b;">Formato de despido directo sin indemnización por falta injustificada.</p>
                <a href="${DESPIDO_DOCX_ART160_URL}" style="color: #0284c7; text-decoration: underline; font-size: 12.5px; font-weight: 600;">👉 Descargar Modelo Art. 160 Nº 3 (.docx)</a>
            </div>

            <div style="margin-bottom: 0;">
                <p style="margin: 0 0 2px; font-size: 13px; font-weight: 600; color: #1e293b;">
                    3. 📋 Checklist Legal: Plazos Fatales y Notificación DT
                </p>
                <p style="margin: 0 0 4px; font-size: 11.5px; color: #64748b;">Resumen paso a paso: plazo de 3 días para carta certificada y portal Mi DT.</p>
                <a href="${DESPIDO_DOCX_CHECKLIST_URL}" style="color: #0284c7; text-decoration: underline; font-size: 12.5px; font-weight: 600;">👉 Descargar Checklist Legal (.docx)</a>
            </div>
        </div>

        <!-- Legal Alert -->
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 22px; font-size: 12.5px; color: #92400e; line-height: 1.5;">
            <strong>⚠️ Recordatorio Legal Importante (Art. 177):</strong><br>
            Recuerda que una vez entregada o despachada la carta certificada, la empresa dispone de un plazo legal máximo de <strong>10 días hábiles</strong> para poner a disposición del trabajador su finiquito ratificado ante Notario Público o en el portal de la Dirección del Trabajo.
        </div>

        <p style="margin: 0 0 20px; font-size: 13.5px; color: #334155;">
            Cualquier consulta adicional que tengas sobre la redacción de la causal o la liquidación de las indemnizaciones, puedes responder con total libertad a este correo.
        </p>

        <!-- Sign-off -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 13px; color: #475569;">
            <strong>Equipo de Cálculo Laboral Chile</strong><br>
            <a href="https://calculolaboral.cl" style="color: #0284c7; text-decoration: none;">calculolaboral.cl</a> · <a href="mailto:contacto@calculolaboral.cl" style="color: #0284c7; text-decoration: none;">contacto@calculolaboral.cl</a>
        </div>
    </div>
</body>
</html>`;

    const text = `Estimado Andrés,

Te escribimos directamente desde el equipo de Cálculo Laboral en relación a la solicitud del Pack de Cartas de Despido Chile 2026 que realizaste hoy por la mañana (a eso de las 11:00 hrs) en nuestra plataforma.

Al revisar los registros del sistema de hoy, nos dimos cuenta de que lamentablemente se produjo un error técnico en nuestro servidor que te impidió descargar el archivo en ese momento. Te pedimos sinceras disculpas por la demora, el inconveniente y el tiempo perdido durante el día.

El problema técnico ya fue 100% corregido y no queríamos que terminara la jornada sin hacerte entrega formal de los documentos para que puedas utilizarlos de inmediato:

OPCIÓN 1: Descargar Pack Completo (.ZIP)
${DESPIDO_PACK_URL}

OPCIÓN 2: Descarga directa por documento (Word .docx)
1. Modelo 1: Despido por Necesidades de la Empresa (Art. 161 Inc. 1º)
${DESPIDO_DOCX_ART161_URL}

2. Modelo 2: Despido Disciplinario por Inasistencia (Art. 160 Nº 3)
${DESPIDO_DOCX_ART160_URL}

3. Checklist Legal: Plazos Fatales y Notificación DT
${DESPIDO_DOCX_CHECKLIST_URL}

Recordatorio Legal Importante (Art. 177):
Recuerda que una vez entregada o despachada la carta certificada, la empresa dispone de un plazo legal máximo de 10 días hábiles para poner a disposición del trabajador su finiquito ratificado ante Notario Público o en el portal de la Dirección del Trabajo.

Cualquier consulta adicional, puedes responder a este correo.

Atentamente,
Equipo de Cálculo Laboral Chile
calculolaboral.cl · contacto@calculolaboral.cl`;

    try {
        const payload = {
            from: `${FROM_NAME} <${FROM_ADDRESS}>`,
            to: [TARGET_EMAIL],
            cc: [NOTIFY_JHON],
            reply_to: FROM_ADDRESS,
            subject: subject,
            html: html,
            text: text
        };

        const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'calculolaboral-cl/1.0',
            },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (!resp.ok) {
            console.error('Resend error:', data);
            return res.status(resp.status).json({ error: 'Resend API error', details: data });
        }

        return res.status(200).json({ success: true, resendId: data.id, to: TARGET_EMAIL, cc: NOTIFY_JHON });
    } catch (e) {
        console.error('Fatal dispatch error:', e);
        return res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
};
