/**
 * Asistente Laboral Pyme: API (una sola funcion; el enrutador esta en api/_pyme/rutas.js).
 *
 * Variables de entorno (Vercel):
 *   DATABASE_URL          conexion a Neon (la crea la integracion Neon-Vercel)
 *   PYME_SESSION_SECRET   32 bytes aleatorios en base64 (huellas de tokens, correos e IP)
 *   PYME_DATA_KEY         clave de cifrado de los datos de trabajadores (se usa desde la fase 2)
 *   RESEND_API_KEY        envio del correo con el enlace de acceso
 */
const T = require('../_pyme/tokens');
const H = require('../_pyme/http');
const C = require('../_pyme/correo');
const { crearAlmacenSql } = require('../_pyme/almacen');
const { crear, MINUTOS_ENLACE } = require('../_pyme/auth');
const { crearRutas } = require('../_pyme/rutas');

let manejador = null; // se arma una vez por instancia de la funcion

function armar() {
    const { SITE_URL, sendEmail } = require('../_flow');
    const secreto = T.secretoDesdeEntorno();
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no configurada');
    const { neon } = require('@neondatabase/serverless');
    const almacen = crearAlmacenSql(neon(url));

    async function enviarCorreo({ to, enlace, clave }) {
        const c = C.correoAcceso({ enlace, minutos: MINUTOS_ENLACE });
        await sendEmail({ to: [to], reply_to: 'contacto@calculolaboral.cl', subject: c.asunto, html: c.html, text: c.texto }, 'pyme-acceso-' + clave);
    }

    const auth = crear({ almacen, enviarCorreo, secreto, siteUrl: SITE_URL });
    return crearRutas({ auth, env: process.env, siteUrl: SITE_URL });
}

module.exports = async (req, res) => {
    try {
        if (!manejador) manejador = armar();
        await manejador(req, res);
    } catch (e) {
        // Sin datos personales ni tokens en el registro: solo el tipo de error
        console.error('pyme:', e && e.name, String((e && e.message) || '').slice(0, 200));
        manejador = null; // por si fue un problema de configuracion que se corrige sin redesplegar
        if (!res.headersSent) H.json(res, 500, { ok: false, error: 'No pudimos completar la solicitud. Intenta de nuevo en unos minutos.' });
    }
};
