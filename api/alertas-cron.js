/**
 * Vercel Serverless Function (cron): alertas mensuales del Monitor.
 *
 *   GET /api/alertas-cron   con "Authorization: Bearer CRON_SECRET"
 *
 * Vercel lo llama todos los días (vercel.json). El handler decide según el día
 * de Santiago de Chile:
 *   día 1  -> correo de inicio de mes (UF y UTM vigentes + plazos Previred y F29)
 *   día 13 -> recordatorio del pago de cotizaciones en Previred
 *   día 20 -> recordatorio de la declaración y pago del F29
 * Los otros días no envía nada (respuesta 200 con enviados: 0).
 *
 * Sin CRON_SECRET la tarea queda desactivada (503), como /api/pyme/avisos-cron.
 * Variables de entorno: DATABASE_URL, RESEND_API_KEY, PYME_SESSION_SECRET, CRON_SECRET.
 */
'use strict';

const { crear, correoDia1, correoDia13, correoDia20 } = require('./_alertas');
const { sendEmail, SITE_URL } = require('./_flow');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaSantiago() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
}

async function indicadoresMes() {
    // UF del día y UTM del mes desde mindicador.cl (API pública). Si falla, el correo
    // se envía igual con los plazos y sin valores.
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const [rUf, rUtm] = await Promise.all([
            fetch('https://mindicador.cl/api/uf', { signal: ctrl.signal }),
            fetch('https://mindicador.cl/api/utm', { signal: ctrl.signal })
        ]);
        clearTimeout(t);
        const uf = await rUf.json();
        const utm = await rUtm.json();
        const ufHoy = uf && Array.isArray(uf.serie) && uf.serie[0] && uf.serie[0].valor;
        const utmMes = utm && Array.isArray(utm.serie) && utm.serie[0] && utm.serie[0].valor;
        return {
            uf: ufHoy ? Number(ufHoy).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : null,
            utm: utmMes ? Number(utmMes).toLocaleString('es-CL', { maximumFractionDigits: 0 }) : null
        };
    } catch (e) {
        return { uf: null, utm: null };
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método no permitido' });
    }
    const clave = process.env.CRON_SECRET;
    if (!clave) return res.status(503).json({ error: 'Tarea desactivada (sin CRON_SECRET).' });
    const auth = String(req.headers.authorization || '');
    if (auth !== 'Bearer ' + clave) return res.status(401).json({ error: 'No autorizado.' });

    const url = process.env.DATABASE_URL;
    const secreto = process.env.PYME_SESSION_SECRET;
    if (!url || !secreto) return res.status(503).json({ error: 'Sin base de datos configurada.' });

    const ahora = fechaSantiago();
    const dia = ahora.getDate();
    const mesIdx = ahora.getMonth();                    // mes de envío
    const mesAnteriorIdx = (mesIdx + 11) % 12;           // mes que se paga/declara
    const mes = MESES[mesIdx];
    const mesAnterior = MESES[mesAnteriorIdx];
    const periodo = ahora.getFullYear() + '-' + String(mesIdx + 1).padStart(2, '0');

    let tipo = null;
    if (dia === 1) tipo = 'inicio';
    else if (dia === 13) tipo = 'previred';
    else if (dia === 20) tipo = 'f29';
    if (!tipo) return res.status(200).json({ dia, enviados: 0, detalle: 'sin alerta hoy' });

    try {
        const { neon } = require('@neondatabase/serverless');
        const consulta = (texto, parametros) => neon(url).query(texto, parametros);
        const s = crear({
            almacen: { consulta },
            siteUrl: SITE_URL,
            enviar: ({ to, reply_to, subject, html, text }, claveIdem) => sendEmail({ to, reply_to, subject, html, text }, claveIdem),
            secreto
        });

        const activos = await s.activos();
        let enviados = 0;
        let errores = 0;
        let indicadores = null;
        if (tipo === 'inicio') indicadores = await indicadoresMes();

        for (const sub of activos) {
            const enlaceBaja = SITE_URL + '/api/alertas?accion=baja&t=' + encodeURIComponent(sub.bajaClave);
            let c;
            if (tipo === 'inicio') c = correoDia1({ ...indicadores, mes, mesAnterior, enlaceBaja });
            else if (tipo === 'previred') c = correoDia13({ mes, mesAnterior, enlaceBaja });
            else c = correoDia20({ mes, mesAnterior, enlaceBaja });
            try {
                await sendEmail({
                    to: [sub.correo],
                    reply_to: 'contacto@calculolaboral.cl',
                    subject: c.asunto,
                    html: c.html,
                    text: c.texto
                }, 'alertas-' + tipo + '-' + sub.correo + '-' + periodo);
                enviados += 1;
            } catch (e) {
                errores += 1;
                console.error('alertas-cron', sub.correo, e.message);
            }
        }

        return res.status(200).json({ dia, tipo, mes, mesAnterior, activos: activos.length, enviados, errores });
    } catch (err) {
        console.error('alertas-cron:', err.message);
        return res.status(500).json({ error: 'Fallo al enviar las alertas.' });
    }
};
