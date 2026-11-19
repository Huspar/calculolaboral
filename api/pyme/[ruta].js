/**
 * Asistente Laboral Pyme: API (una sola funcion; el enrutador esta en api/_pyme/rutas.js).
 *
 * Variables de entorno (Vercel):
 *   DATABASE_URL          conexion a Neon (la crea la integracion Neon-Vercel)
 *   PYME_SESSION_SECRET   32 bytes aleatorios en base64 (huellas de tokens, correos e IP)
 *   PYME_DATA_KEY         clave de cifrado de los datos de trabajadores (se usa desde la fase 2)
 *   RESEND_API_KEY        envio del correo con el enlace de acceso
 *   FLOW_API_KEY, FLOW_SECRET_KEY, PYME_PASE_VENTA  cobro del Pase Pyme (la venta se abre con PYME_PASE_VENTA=1)
 *   CRON_SECRET           activa la tarea diaria de avisos por correo (/api/pyme/avisos-cron); sin ella no se envían
 *   PYME_PILOTO_FIN       «1» cierra antes de tiempo el piloto gratuito (por defecto dura hasta el 31-dic-2026, ver api/_pyme/piloto.js)
 */
const T = require('../_pyme/tokens');
const H = require('../_pyme/http');
const C = require('../_pyme/correo');
const Servicios = require('../_pyme/servicios');
const { crear, MINUTOS_ENLACE } = require('../_pyme/auth');
const { crearRutas } = require('../_pyme/rutas');
const D = require('../_pyme/datos');
const Cifrado = require('../_pyme/cifrado');
const Avisos = require('../_pyme/avisos');
const Equipo = require('../_pyme/equipo');
const Portal = require('../_pyme/portal');
const Enlaces = require('../_pyme/enlaces');
const Piloto = require('../_pyme/piloto');
const Comentarios = require('../_pyme/comentarios');

let manejador = null; // se arma una vez por instancia de la funcion

function armar() {
    const { SITE_URL, sendEmail } = require('../_flow');
    const secreto = T.secretoDesdeEntorno();
    const almacen = Servicios.almacen();

    async function enviarCorreo({ to, enlace, clave }) {
        const c = C.correoAcceso({ enlace, minutos: MINUTOS_ENLACE });
        await sendEmail({ to: [to], reply_to: 'contacto@calculolaboral.cl', subject: c.asunto, html: c.html, text: c.texto }, 'pyme-acceso-' + clave);
    }

    async function notificarRegistro(ev) {
        const c = C.correoRegistroAdmin(ev);
        await sendEmail({ to: ['contacto@calculolaboral.cl'], subject: c.asunto, html: c.html, text: c.texto }, 'pyme-' + ev.clave);
    }

    const auth = crear({ almacen, enviarCorreo, notificarRegistro, secreto, siteUrl: SITE_URL });
    // El servicio de datos (y con el la clave de cifrado) se arma recien al primer uso: entrar y salir no la necesitan
    let datosReal = null;
    const datos = new Proxy({}, {
        get: (_, nombre) => (...args) => {
            if (!datosReal) datosReal = D.crear({ almacen, cifrado: Cifrado.crear(), piloto: Piloto.crear(process.env) });
            return datosReal[nombre](...args);
        }
    });
    const avisos = Avisos.crear({
        almacen, datos, secreto, siteUrl: SITE_URL,
        P: require('../../js/liquidacion_parametros.js'), F: require('../../js/feriados_cl.js'),
        enviar: ({ to, asunto, html, texto, clave }) => sendEmail({ to: [to], reply_to: 'contacto@calculolaboral.cl', subject: asunto, html, text: texto }, clave)
    });
    const enlaces = Enlaces.crear({ almacen, datos, secreto, siteUrl: SITE_URL });
    const equipo = Equipo.crear({ almacen, datos });
    const portal = Portal.crear({ almacen, datos });
    // Estudio del contador: se arma al primer uso para no exigir la clave de cifrado al entrar
    const Est = require('../_estudio/datos');
    const SiiGateway = require('../_estudio/sii_gateway');
    let estudioReal = null;
    const estudio = new Proxy({}, {
        get: (_, nombre) => (...args) => {
            if (!estudioReal) estudioReal = Est.crear({ consulta: almacen.consulta, cifrado: Cifrado.crear() });
            return estudioReal[nombre](...args);
        }
    });
    const siiGateway = SiiGateway.crear({ env: process.env });
    // Opiniones del piloto: se guardan y se avisa a contacto@ (si el correo falla, la opinión queda igual)
    const comentarios = Comentarios.crear({
        almacen, destino: ['contacto@calculolaboral.cl'],
        enviar: ({ to, reply_to, asunto, html, texto, clave }) => sendEmail(Object.assign({ to, subject: asunto, html, text: texto }, reply_to ? { reply_to } : {}), clave)
    });
    return crearRutas({ auth, datos, env: process.env, siteUrl: SITE_URL, pase: Servicios.pase(), avisos, enlaces, comentarios, estudio, equipo, portal, siiGateway });
}

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function leerCuerpoCrudo(req) {
    return new Promise((resolve, reject) => {
        if (req.body !== undefined || typeof req.on !== 'function' || req.method === 'GET' || req.method === 'HEAD') {
            resolve();
            return;
        }
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(new Error('cuerpo_demasiado_grande'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            req.rawBody = raw;
            const ct = String((req.headers && req.headers['content-type']) || '').toLowerCase();
            if (!raw) {
                req.body = {};
            } else if (ct.indexOf('application/json') === 0) {
                try { req.body = JSON.parse(raw); } catch (e) { req.body = {}; }
            } else if (ct.indexOf('application/x-www-form-urlencoded') === 0) {
                try { req.body = Object.fromEntries(new URLSearchParams(raw)); } catch (e) { req.body = {}; }
            } else {
                req.body = raw;
            }
            resolve();
        });
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    try {
        await leerCuerpoCrudo(req);
        if (!manejador) manejador = armar();
        await manejador(req, res);
    } catch (e) {
        // Sin datos personales ni tokens en el registro: solo el tipo de error
        console.error('pyme:', e && e.name, String((e && e.message) || '').slice(0, 200));
        manejador = null; // por si fue un problema de configuracion que se corrige sin redesplegar
        Servicios.olvidar();
        if (!res.headersSent) H.json(res, 500, { ok: false, error: 'No pudimos completar la solicitud. Intenta de nuevo en unos minutos.' });
    }
};
module.exports.config = { api: { bodyParser: false } };
