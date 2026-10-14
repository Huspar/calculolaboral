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
const Enlaces = require('../_pyme/enlaces');

let manejador = null; // se arma una vez por instancia de la funcion

function armar() {
    const { SITE_URL, sendEmail } = require('../_flow');
    const secreto = T.secretoDesdeEntorno();
    const almacen = Servicios.almacen();

    async function enviarCorreo({ to, enlace, clave }) {
        const c = C.correoAcceso({ enlace, minutos: MINUTOS_ENLACE });
        await sendEmail({ to: [to], reply_to: 'contacto@calculolaboral.cl', subject: c.asunto, html: c.html, text: c.texto }, 'pyme-acceso-' + clave);
    }

    const auth = crear({ almacen, enviarCorreo, secreto, siteUrl: SITE_URL });
    // El servicio de datos (y con el la clave de cifrado) se arma recien al primer uso: entrar y salir no la necesitan
    let datosReal = null;
    const datos = new Proxy({}, {
        get: (_, nombre) => (...args) => {
            if (!datosReal) datosReal = D.crear({ almacen, cifrado: Cifrado.crear() });
            return datosReal[nombre](...args);
        }
    });
    const avisos = Avisos.crear({
        almacen, datos, secreto, siteUrl: SITE_URL,
        P: require('../../js/liquidacion_parametros.js'), F: require('../../js/feriados_cl.js'),
        enviar: ({ to, asunto, html, texto, clave }) => sendEmail({ to: [to], reply_to: 'contacto@calculolaboral.cl', subject: asunto, html, text: texto }, clave)
    });
    const enlaces = Enlaces.crear({ almacen, datos, secreto, siteUrl: SITE_URL });
    return crearRutas({ auth, datos, env: process.env, siteUrl: SITE_URL, pase: Servicios.pase(), avisos, enlaces });
}

module.exports = async (req, res) => {
    try {
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
