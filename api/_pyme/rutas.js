/**
 * Enrutador del Asistente Pyme (una sola funcion de Vercel: api/pyme/[ruta].js).
 *
 *   POST /api/pyme/entrar     { email }            envia el enlace de acceso (responde igual exista o no la cuenta)
 *   GET  /api/pyme/verificar  ?t=TOKEN             pagina de confirmacion (no consume el token)
 *   POST /api/pyme/verificar  formulario t, acepto consume el token, abre sesion y redirige al panel
 *   GET  /api/pyme/sesion                          { autenticado, email }
 *   POST /api/pyme/salir                           cierra la sesion
 *   GET  /api/pyme/estado                          empresa, trabajadores y limites de la cuenta
 *   PUT  /api/pyme/empresa            { empresa }  guarda la empresa (cifrada)
 *   POST|PUT|DELETE /api/pyme/trabajador[?id=]  { trabajador }   crea, actualiza o borra un trabajador
 *   GET  /api/pyme/meses?periodo=AAAA-MM           liquidaciones guardadas de ese mes (todos los trabajadores)
 *   PUT|DELETE /api/pyme/mes?trabajador=ID&periodo=AAAA-MM  { mes }   guarda o elimina el mes de un trabajador
 *   POST /api/pyme/documento?trabajador=ID  { tipo }   anota que se emitió un documento (solo tipo y fecha)
 *   POST /api/pyme/importar           { empresa, trabajadores }  trae datos de otro lugar (el generador de liquidaciones)
 *   GET  /api/pyme/exportar                        descarga todos los datos en un archivo JSON
 *   POST /api/pyme/borrar-cuenta      { confirmar }  elimina la cuenta y todo lo que contiene
 *
 * crearRutas({ auth, datos, env, siteUrl }) devuelve (req, res) => Promise; recibe todo por parametro para probarlo sin servidor.
 */
const H = require('./http');
const C = require('./correo');
const T = require('./tokens');

const DESTINO_PANEL = '/asistente-pyme';
const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pide uno nuevo desde el asistente.';

function crearRutas({ auth, datos, env, siteUrl }) {
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

    // ---------- datos (requieren sesion) ----------
    const RESPUESTA_SIN_SESION = { ok: false, codigo: 'sin_sesion', error: 'Tu sesión venció. Entra de nuevo con tu correo.' };

    async function conSesion(req, res) {
        const s = await auth.leerSesion(H.leerCookie(req, H.NOMBRE_COOKIE));
        if (!s.autenticado) { H.json(res, 401, RESPUESTA_SIN_SESION); return null; }
        if (s.renovada) res.setHeader('Set-Cookie', H.cookieSesion(s.renovada.token, s.renovada.vence, Date.now()));
        return s;
    }

    // Escrituras: encabezado propio y origen, sesion y limite por hora. Devuelve la sesion o null (ya respondio).
    async function sesionParaEscribir(req, res) {
        if (!H.escrituraPermitida(req, env, siteUrl)) { H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' }); return null; }
        const s = await conSesion(req, res);
        if (!s) return null;
        if (!(await auth.permitirEscritura(s.cuentaId))) { H.json(res, 429, { ok: false, codigo: 'limite_escrituras', error: 'Hiciste demasiados cambios seguidos. Espera un momento e intenta de nuevo.' }); return null; }
        return s;
    }

    function responder(res, r, extra) {
        if (r.ok) return H.json(res, 200, Object.assign({}, r, extra));
        return H.json(res, r.estado || 400, { ok: false, codigo: r.codigo, error: r.error, errores: r.errores });
    }

    async function estado(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        return responder(res, await datos.estado(s));
    }

    async function empresa(req, res) {
        if (!metodo(req, res, 'PUT')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        return responder(res, await datos.guardarEmpresa(s, H.cuerpoDe(req).empresa));
    }

    async function trabajador(req, res) {
        const m = req.method;
        if (m !== 'POST' && m !== 'PUT' && m !== 'DELETE') { res.setHeader('Allow', 'POST, PUT, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const id = typeof req.query?.id === 'string' ? req.query.id : '';
        if (m === 'POST') return responder(res, await datos.crearTrabajador(s, H.cuerpoDe(req).trabajador));
        if (m === 'PUT') return responder(res, await datos.actualizarTrabajador(s, id, H.cuerpoDe(req).trabajador));
        return responder(res, await datos.borrarTrabajador(s, id));
    }

    async function meses(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        return responder(res, await datos.meses(s, typeof req.query?.periodo === 'string' ? req.query.periodo : ''));
    }

    async function mes(req, res) {
        const m = req.method;
        if (m !== 'PUT' && m !== 'DELETE') { res.setHeader('Allow', 'PUT, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const id = typeof req.query?.trabajador === 'string' ? req.query.trabajador : '';
        const periodo = typeof req.query?.periodo === 'string' ? req.query.periodo : '';
        if (m === 'PUT') return responder(res, await datos.guardarMes(s, id, periodo, H.cuerpoDe(req).mes));
        return responder(res, await datos.borrarMes(s, id, periodo));
    }

    async function documento(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const id = typeof req.query?.trabajador === 'string' ? req.query.trabajador : '';
        return responder(res, await datos.registrarDocumento(s, id, H.cuerpoDe(req).tipo));
    }

    async function importar(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const r = await datos.importar(s, H.cuerpoDe(req));
        if (r.ok) await auth.auditar('datos_importados', s.cuentaId, H.ipDe(req));
        return responder(res, r);
    }

    async function exportar(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        const r = await datos.exportar(s);
        await auth.auditar('datos_exportados', s.cuentaId, H.ipDe(req));
        res.setHeader('Content-Disposition', `attachment; filename="calculolaboral-datos-${new Date().toISOString().slice(0, 10)}.json"`);
        return H.json(res, 200, r.archivo);
    }

    async function borrarCuenta(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const r = await datos.borrarCuenta(s, H.cuerpoDe(req).confirmar);
        if (!r.ok) return responder(res, r);
        await auth.auditar('cuenta_borrada', s.cuentaId, H.ipDe(req));
        return H.json(res, 200, { ok: true }, { cookie: H.cookieBorrada() });
    }

    const tabla = { entrar, verificar, sesion, salir, estado, empresa, trabajador, meses, mes, documento, importar, exportar, 'borrar-cuenta': borrarCuenta };

    return async function manejar(req, res) {
        const ruta = typeof req.query?.ruta === 'string' ? req.query.ruta : '';
        const f = Object.prototype.hasOwnProperty.call(tabla, ruta) ? tabla[ruta] : null;
        if (!f) return H.json(res, 404, { ok: false, error: 'No encontrado.' });
        return f(req, res);
    };
}

module.exports = { crearRutas, DESTINO_PANEL, tokenValido: T.tokenValido };
