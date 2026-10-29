/**
 * Estudios contables: API de la capa de cuentas.
 *
 *   GET /api/estudio/datos   devuelve el estudio de la cuenta de la sesión
 *   PUT /api/estudio/datos   guarda el estudio (JSON) de la cuenta
 *
 * La sesión es la del Asistente Pyme: se entra con el enlace al correo y la cookie
 * vale para todo el dominio. Sin sesión responde 401.
 */
const { neon } = require('@neondatabase/serverless');
const H = require('../_pyme/http');
const T = require('../_pyme/tokens');
const Servicios = require('../_pyme/servicios');
const { crear } = require('../_pyme/auth');
const Cifrado = require('../_pyme/cifrado');
const E = require('../_estudio/datos');

let manejador = null;

function armar() {
    const { SITE_URL } = require('../_flow');
    const secreto = T.secretoDesdeEntorno();
    const almacen = Servicios.almacen();
    const auth = crear({ almacen, enviarCorreo: async () => { }, secreto, siteUrl: SITE_URL });
    const sql = neon(process.env.DATABASE_URL);
    const estudio = E.crear({ consulta: (texto, params) => sql.query(texto, params), cifrado: Cifrado.crear() });

    return async function (req, res) {
        const partes = req.query && req.query.ruta ? [].concat(req.query.ruta) : [];
        const accion = partes.join('/');

        let sesion;
        try {
            sesion = await auth.leerSesion(H.leerCookie(req, H.NOMBRE_COOKIE));
        } catch (e) {
            return H.json(res, 500, { ok: false, error: 'No pudimos revisar tu sesión.' });
        }
        if (sesion.renovada) {
            res.setHeader('Set-Cookie', H.cookieSesion(sesion.renovada.token, sesion.renovada.vence, Date.now()));
        }
        if (!sesion.autenticado) {
            return H.json(res, 401, { ok: false, error: 'Entra con tu correo para usar tu cuenta.' });
        }

        try {
            if (accion === 'datos' && req.method === 'GET') {
                const r = await estudio.leer(sesion.cuentaId);
                if (!r.ok) return H.json(res, r.estado || 500, { ok: false, error: r.error });
                return H.json(res, 200, { ok: true, email: sesion.email, datos: r.datos, actualizado: r.actualizado });
            }

            if (accion === 'datos' && req.method === 'PUT') {
                if (!H.escrituraPermitida(req, process.env, SITE_URL)) {
                    return H.json(res, 403, { ok: false, error: 'Petición no permitida.' });
                }
                const cuerpo = H.cuerpoDe(req);
                const r = await estudio.guardar(sesion.cuentaId, cuerpo.datos);
                if (!r.ok) return H.json(res, r.estado || 500, { ok: false, codigo: r.codigo, error: r.error });
                return H.json(res, 200, { ok: true, actualizado: new Date().toISOString() });
            }

            return H.json(res, 404, { ok: false, error: 'Ruta no encontrada.' });
        } catch (e) {
            return H.json(res, 500, { ok: false, error: 'No pudimos guardar o leer tu estudio.' });
        }
    };
}

module.exports = (req, res) => {
    if (!manejador) manejador = armar();
    return manejador(req, res);
};
