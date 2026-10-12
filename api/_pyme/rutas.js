/**
 * Enrutador del Asistente Pyme (una sola funcion de Vercel: api/pyme/[ruta].js).
 *
 *   POST /api/pyme/entrar     { email }            envia el enlace de acceso (responde igual exista o no la cuenta)
 *   GET  /api/pyme/verificar  ?t=TOKEN             pagina de confirmacion (no consume el token)
 *   POST /api/pyme/verificar  formulario t, acepto consume el token, abre sesion y redirige al panel
 *   GET  /api/pyme/sesion                          { autenticado, email }
 *   POST /api/pyme/salir                           cierra la sesion
 *
 * crearRutas({ auth, env, siteUrl }) devuelve (req, res) => Promise; recibe todo por parametro para probarlo sin servidor.
 */
const H = require('./http');
const C = require('./correo');
const T = require('./tokens');

const DESTINO_PANEL = '/asistente-pyme';
const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pide uno nuevo desde el asistente.';

function crearRutas({ auth, env, siteUrl }) {
    function metodo(req, res, permitido) {
        if (req.method === permitido) return true;
        res.setHeader('Allow', permitido);
        H.json(res, 405, { ok: false, error: 'Método no permitido.' });
        return false;
    }

    async function entrar(req, res) {
        if (!metodo(req, res, 'POST')) return;
        if (!H.escrituraPermitida(req, env, siteUrl)) return H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' });
        const r = await auth.solicitarAcceso({ email: H.cuerpoDe(req).email, ip: H.ipDe(req) });
        if (r.ok) return H.json(res, 200, { ok: true, mensaje: 'Si el correo es correcto, te enviamos un enlace para entrar. Revisa también el spam.' });
        if (r.motivo === 'limite') return H.json(res, 429, { ok: false, error: 'Hiciste muchas solicitudes. Intenta de nuevo en una hora.' });
        return H.json(res, 400, { ok: false, error: 'Escribe un correo válido.' });
    }

    async function verificar(req, res) {
        if (req.method === 'GET') {
            const token = typeof req.query?.t === 'string' ? req.query.t : '';
            const p = await auth.previsualizar(token);
            if (!p.valido) return H.html(res, 400, C.paginaMensaje('Enlace no válido', MENSAJE_ENLACE_INVALIDO));
            return H.html(res, 200, C.paginaConfirmar({ token, correoEnmascarado: p.correoEnmascarado, requiereAceptar: p.requiereAceptar }));
        }
        if (req.method === 'POST') {
            // Formulario de nuestra propia pagina: si el navegador manda Origin, debe ser el del sitio
            const origen = req.headers && req.headers.origin;
            if (origen && H.origenesPermitidos(env, siteUrl).indexOf(origen) < 0) return H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' });
            const cuerpo = H.cuerpoDe(req);
            const token = typeof cuerpo.t === 'string' ? cuerpo.t : '';
            const r = await auth.completar({ token, acepto: cuerpo.acepto, ip: H.ipDe(req) });
            if (r.ok) {
                const cookie = H.cookieSesion(r.sesion.token, r.sesion.vence, Date.now());
                return H.redirigir(res, DESTINO_PANEL, { cookie });
            }
            if (r.motivo === 'aceptar') {
                const p = await auth.previsualizar(token);
                if (!p.valido) return H.html(res, 400, C.paginaMensaje('Enlace no válido', MENSAJE_ENLACE_INVALIDO));
                return H.html(res, 400, C.paginaConfirmar({ token, correoEnmascarado: p.correoEnmascarado, requiereAceptar: true, error: 'Para continuar debes aceptar los Términos y la cláusula de encargo.' }));
            }
            return H.html(res, 400, C.paginaMensaje('Enlace no válido', MENSAJE_ENLACE_INVALIDO));
        }
        res.setHeader('Allow', 'GET, POST');
        return H.json(res, 405, { ok: false, error: 'Método no permitido.' });
    }

    async function sesion(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await auth.leerSesion(H.leerCookie(req, H.NOMBRE_COOKIE));
        if (!s.autenticado) return H.json(res, 200, { autenticado: false });
        const extras = s.renovada ? { cookie: H.cookieSesion(s.renovada.token, s.renovada.vence, Date.now()) } : undefined;
        return H.json(res, 200, { autenticado: true, email: s.email }, extras);
    }

    async function salir(req, res) {
        if (!metodo(req, res, 'POST')) return;
        if (!H.escrituraPermitida(req, env, siteUrl)) return H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' });
        await auth.cerrar(H.leerCookie(req, H.NOMBRE_COOKIE), H.ipDe(req));
        return H.json(res, 200, { ok: true }, { cookie: H.cookieBorrada() });
    }

    const tabla = { entrar, verificar, sesion, salir };

    return async function manejar(req, res) {
        const ruta = typeof req.query?.ruta === 'string' ? req.query.ruta : '';
        const f = Object.prototype.hasOwnProperty.call(tabla, ruta) ? tabla[ruta] : null;
        if (!f) return H.json(res, 404, { ok: false, error: 'No encontrado.' });
        return f(req, res);
    };
}

module.exports = { crearRutas, DESTINO_PANEL, tokenValido: T.tokenValido };
