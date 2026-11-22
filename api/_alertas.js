/**
 * Monitor Tributario y Previsional · lista pública de alertas por correo.
 *
 * Suscripción con doble opt-in: el correo queda "pendiente" hasta que su dueño
 * confirma desde el enlace del correo de confirmación. La baja se hace desde el
 * enlace de darse de baja que va en cada alerta (secreto por suscriptor).
 *
 * Variables de entorno (Vercel):
 *   DATABASE_URL          conexión a Neon (la crea la integración Neon-Vercel)
 *   RESEND_API_KEY        envío de correos (lo maneja api/_flow.js)
 *   CRON_SECRET           activa la tarea diaria /api/alertas-cron; sin ella no se envían
 *
 * Igual que api/_flow.js, los archivos que empiezan con "_" en /api no se publican
 * como endpoints.
 */
'use strict';

const crypto = require('crypto');

const CORREO_OK = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const ESTADOS = ['pendiente', 'activo', 'baja'];

function crear({ almacen, siteUrl, enviar, secreto, ahora = () => new Date() }) {
    if (!almacen || !almacen.consulta) throw new Error('_alertas: falta almacen');
    if (!enviar) throw new Error('_alertas: falta enviar');
    if (!secreto) throw new Error('_alertas: falta secreto');

    function hashToken(token) {
        return crypto.createHmac('sha256', secreto).update('alertas|' + token).digest('hex');
    }

    function nuevoToken() {
        return crypto.randomBytes(24).toString('base64url');
    }

    async function buscar(correo) {
        const r = await almacen.consulta('SELECT correo, estado, baja_clave FROM suscriptores_alertas WHERE correo = $1', [correo]);
        return r[0] || null;
    }

    /** Suscribe con doble opt-in. Devuelve { estado, yaActivo, enviado }. */
    async function suscribir({ correo, origen }) {
        correo = String(correo || '').trim().toLowerCase();
        if (!CORREO_OK.test(correo)) return { error: 'correo_invalido' };
        origen = String(origen || 'monitor').slice(0, 30);
        const existente = await buscar(correo);
        const token = nuevoToken();
        const bajaClave = crypto.randomBytes(16).toString('base64url');

        if (existente && existente.estado === 'activo') {
            return { estado: 'activo', yaActivo: true, enviado: false };
        }

        if (existente) {
            // pendiente (reenviar confirmación) o dado de baja (reactivar desde cero)
            await almacen.consulta(
                'UPDATE suscriptores_alertas SET estado = $2, token_hash = $3, baja_clave = $4, confirmado = NULL, dado_baja = NULL WHERE correo = $1',
                [correo, 'pendiente', hashToken(token), bajaClave]
            );
        } else {
            await almacen.consulta(
                'INSERT INTO suscriptores_alertas (correo, origen, estado, token_hash, baja_clave) VALUES ($1, $2, $3, $4, $5)',
                [correo, origen, 'pendiente', hashToken(token), bajaClave]
            );
        }

        const enlace = siteUrl + '/api/alertas?accion=confirmar&t=' + encodeURIComponent(token);
        const c = correoConfirmacion({ enlace });
        await enviar({ to: [correo], reply_to: 'contacto@calculolaboral.cl', subject: c.asunto, html: c.html, text: c.texto },
            'alertas-conf-' + hashToken(token).slice(0, 24));
        return { estado: 'pendiente', yaActivo: false, enviado: true };
    }

    /** Confirma con el token del correo. Devuelve true si activó (o ya estaba activo). */
    async function confirmar(token) {
        const r = await almacen.consulta(
            'UPDATE suscriptores_alertas SET estado = $2, confirmado = $3 WHERE token_hash = $1 AND confirmado IS NULL RETURNING correo',
            [hashToken(String(token || '')), 'activo', ahora().toISOString()]
        );
        if (r[0]) return { confirmado: true, correo: r[0].correo };
        // token ya usado: si el correo sigue activo, no es un error para quien hace clic de nuevo
        const ya = await almacen.consulta(
            'SELECT correo FROM suscriptores_alertas WHERE token_hash = $1 AND estado = $2',
            [hashToken(String(token || '')), 'activo']
        );
        return ya[0] ? { confirmado: true, correo: ya[0].correo } : { confirmado: false };
    }

    /** Baja con la clave del enlace de cada correo. Idempotente. */
    async function darBaja(clave) {
        const k = String(clave || '');
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(k)) return false;
        await almacen.consulta(
            'UPDATE suscriptores_alertas SET estado = $2, dado_baja = $3 WHERE baja_clave = $1 AND estado <> $2',
            [k, 'baja', ahora().toISOString()]
        );
        return true;
    }

    /** Suscriptores activos para el envío del día. */
    async function activos() {
        const r = await almacen.consulta('SELECT correo, baja_clave FROM suscriptores_alertas WHERE estado = $1 ORDER BY creado', ['activo']);
        return r.map(f => ({ correo: f.correo, bajaClave: f.baja_clave }));
    }

    /** Conteo para el panel del cron (no expone correos). */
    async function contar() {
        const r = await almacen.consulta('SELECT estado, COUNT(*)::int AS n FROM suscriptores_alertas GROUP BY estado');
        const out = { pendiente: 0, activo: 0, baja: 0 };
        r.forEach(f => { if (ESTADOS.includes(f.estado)) out[f.estado] = Number(f.n); });
        return out;
    }

    /** Notifica al dueño una solicitud de acceso anticipado al Monitor. */
    async function notificarAcceso({ correo, rut, empresa, nombre }) {
        const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        await enviar({
            to: ['jhonfcj@gmail.com'],
            subject: '[MONITOR] Solicitud de acceso anticipado - ' + (empresa || correo),
            html: '<p>Nueva solicitud de acceso anticipado al Monitor Tributario y Previsional.</p><ul>' +
                '<li>Correo: ' + esc(correo) + '</li>' +
                '<li>Nombre: ' + esc(nombre) + '</li>' +
                '<li>Empresa: ' + esc(empresa) + '</li>' +
                '<li>RUT: ' + esc(rut) + '</li></ul>' +
                '<p>Responde a la persona para coordinar la validación (los RUT de prueba aún se están definiendo).</p>'
        }, 'monitor-acceso-' + correo + '-' + Date.now());
    }

    return { suscribir, confirmar, darBaja, activos, contar, notificarAcceso, hashToken };
}

/** Correo de confirmación del opt-in (doble opt-in). */
function correoConfirmacion({ enlace }) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Confirmamos que quieres recibir las <strong>alertas mensuales de plazos tributarios y previsionales</strong>:</p>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#334155">
    <li>Inicio de mes: UF y UTM vigentes y los plazos del mes.</li>
    <li>Día 13: recordatorio del pago de cotizaciones en Previred.</li>
    <li>Día 20: recordatorio de la declaración y pago del F29.</li>
  </ul>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Haz clic en este enlace para confirmar tu suscripción (si no fuiste tú, ignora este correo y no quedará activa):</p>
  <p style="margin:0 0 20px"><a href="${enlace}" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Confirmar suscripción</a></p>
  <p style="margin:0 0 16px;font-size:12px;color:#475569">Unas 3 alertas al mes. Puedes darte de baja en cualquier momento desde el enlace que va en cada correo. Tratamos tu correo solo para enviar estas alertas (Ley 21.719).</p>
  <p style="margin:0;font-size:13px;color:#64748b">¿Dudas? Responde este correo.</p>
</div></body></html>`;
    const texto = 'Confirmamos que quieres recibir las alertas mensuales de plazos tributarios y previsionales (inicio de mes, Previred dia 13, F29 dia 20). Abre este enlace para confirmar: ' + enlace;
    return { asunto: 'Confirma tus alertas de plazos tributarios y previsionales', html, texto };
}

/**
 * Correos del cron. `mes` es el nombre del mes de envío y `mesAnterior` el que se declara/paga.
 * Los textos legales (plazos) son referenciales y fueron revisados por el agente Normativa.
 */
function correoDia1({ uf, utm, mes, mesAnterior, enlaceBaja }) {
    const filas = [];
    if (uf) filas.push('<li><strong>UF al 1 de ' + mes + ': $' + uf + '</strong></li>');
    if (utm) filas.push('<li><strong>UTM de ' + mes + ': $' + utm + '</strong></li>');
    const lista = filas.length ? '<ul style="margin:0 0 16px;padding-left:18px">' + filas.join('') + '</ul>' : '';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:15px">Alerta de inicio de mes</p>
  ${lista}
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Plazos de ${mes} que te conviene tener anotados:</p>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#334155">
    <li><strong>Cotizaciones Previred de ${mesAnterior}:</strong> págalo dentro de los primeros 10 días corridos de ${mes} (si pagas por Internet, el plazo se amplía al día 13).</li>
    <li><strong>F29 de ${mesAnterior}:</strong> decláralo y págalo antes de tu vencimiento según tu medio de declaración y tipo de contribuyente (día 12, 20 o 28 de ${mes}).</li>
    <li><strong>Acuse RCV:</strong> revisa que no queden facturas de compra sin acuse dentro del plazo de 8 días corridos; si vence, queda irrevocablemente aceptada y pierdes el reclamo.</li>
  </ul>
  <p style="margin:0 0 20px"><a href="https://calculolaboral.cl/monitor-tributario-previsional" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Abrir el chequeo gratuito</a></p>
  <p style="margin:0;font-size:12px;color:#64748b">Alerta referencial sin asesoría tributaria. <a href="${enlaceBaja}" style="color:#64748b">Darme de baja</a></p>
</div></body></html>`;
    const texto = 'Alerta de inicio de mes.' + (uf ? ' UF al 1 de ' + mes + ': $' + uf + '.' : '') + (utm ? ' UTM de ' + mes + ': $' + utm + '.' : '') +
        ' Cotizaciones Previred de ' + mesAnterior + ': dentro de los primeros 10 dias corridos de ' + mes + ' (por Internet, hasta el dia 13). F29 de ' + mesAnterior + ': antes de tu vencimiento (dia 12, 20 o 28). Abre el chequeo: https://calculolaboral.cl/monitor-tributario-previsional Baja: ' + enlaceBaja;
    return { asunto: 'Inicio de ' + mes + ': UF, UTM y plazos Previred y F29', html, texto };
}

function correoDia13({ mes, mesAnterior, enlaceBaja }) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:15px">Recordatorio Previred del 13 de ${mes}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">El plazo para pagar las cotizaciones de <strong>${mesAnterior}</strong> corre dentro de los primeros 10 días corridos de ${mes} (si pagas por Internet, el plazo se amplía al día 13). Revisa en <strong>previred.com</strong> que el pago quedó declarado y pagado, y que el cargo apareció en tu banco. Si usas pago con convenio, confirma que la nómina de ${mesAnterior} quedó cerrada.</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Dejar cotizaciones impagas genera reajustes e intereses, y expone a la empresa a multas de la Dirección del Trabajo.</p>
  <p style="margin:0 0 20px"><a href="https://calculolaboral.cl/monitor-tributario-previsional" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Abrir el chequeo gratuito</a></p>
  <p style="margin:0;font-size:12px;color:#64748b">Alerta referencial sin asesoría previsional. <a href="${enlaceBaja}" style="color:#64748b">Darme de baja</a></p>
</div></body></html>`;
    const texto = 'Recordatorio Previred del 13 de ' + mes + ': revisa que las cotizaciones de ' + mesAnterior + ' quedaron declaradas y pagadas en previred.com (si pagas por Internet, el plazo se amplía al dia 13). Chequeo: https://calculolaboral.cl/monitor-tributario-previsional Baja: ' + enlaceBaja;
    return { asunto: 'Previred: revisa el pago de cotizaciones de ' + mesAnterior, html, texto };
}

function correoDia20({ mes, mesAnterior, enlaceBaja }) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:#00382E">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:15px">Recordatorio F29 del 20 de ${mes}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Si tu vencimiento del <strong>Formulario 29 de ${mesAnterior}</strong> es el día 20, decláralo y págalo hoy en <strong>sii.cl</strong>. Los vencimientos dependen de tu medio de declaración y tipo de contribuyente (día 12, 20 o 28), así que revisa el tuyo en el calendario de vencimientos del SII.</p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Declarar fuera de plazo genera multas e intereses por atraso que se declaran en el propio F29 (códigos 92, 93 y 94).</p>
  <p style="margin:0 0 20px"><a href="https://calculolaboral.cl/calculadora-f29-chile" style="display:inline-block;background:#00382E;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Simular mi F29 con RCV</a></p>
  <p style="margin:0;font-size:12px;color:#64748b">Alerta referencial sin asesoría tributaria. <a href="${enlaceBaja}" style="color:#64748b">Darme de baja</a></p>
</div></body></html>`;
    const texto = 'Recordatorio F29 del 20 de ' + mes + ': si tu vencimiento es el dia 20, declara y paga hoy el F29 de ' + mesAnterior + ' en sii.cl (multas e intereses por atraso van en los codigos 92, 93 y 94). Simulador: https://calculolaboral.cl/calculadora-f29-chile Baja: ' + enlaceBaja;
    return { asunto: 'F29 de ' + mesAnterior + ': hoy vence si tu plazo es el día 20', html, texto };
}

module.exports = { crear, correoConfirmacion, correoDia1, correoDia13, correoDia20 };
