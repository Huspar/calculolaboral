/**
 * Enrutador del Asistente Pyme (una sola funcion de Vercel: api/pyme/[ruta].js).
 *
 *   POST /api/pyme/entrar     { email }            envia el enlace de acceso (responde igual exista o no la cuenta)
 *   GET  /api/pyme/verificar  ?t=TOKEN             pagina de confirmacion (no consume el token)
 *   POST /api/pyme/verificar  formulario t, acepto consume el token, abre sesion y redirige al panel
 *   GET  /api/pyme/sesion                          { autenticado, email }
 *   POST /api/pyme/salir                           cierra la sesion
 *   GET  /api/pyme/estado                          empresa, trabajadores y limites de la cuenta
 *   PUT  /api/pyme/empresa            { empresa }  guarda la empresa (cifrada); con el encabezado X-CL-Empresa, esa empresa de la cuenta
 *   POST /api/pyme/empresas           { empresa }  agrega otra empresa a la cuenta (hasta el máximo de la cuenta)
 *   DELETE /api/pyme/empresas         { id, confirmar: true }  borra la empresa con todo lo suyo
 *   POST|PUT|DELETE /api/pyme/trabajador[?id=]  { trabajador }   crea, actualiza o borra un trabajador
 *   PUT  /api/pyme/prestamos?trabajador=ID  { prestamos }   reemplaza los préstamos con cuotas de un trabajador
 *   PUT  /api/pyme/ausencias?trabajador=ID  { ausencias }   reemplaza las licencias y permisos de un trabajador (solo tipo y fechas)
 *   GET  /api/pyme/meses?periodo=AAAA-MM           liquidaciones guardadas de ese mes (todos los trabajadores)
 *   PUT|DELETE /api/pyme/mes?trabajador=ID&periodo=AAAA-MM  { mes }   guarda o elimina el mes de un trabajador
 *   POST /api/pyme/documento?trabajador=ID  { tipo }   anota que se emitió un documento (solo tipo y fecha)
 *   POST|DELETE /api/pyme/enlace-liquidacion?trabajador=ID&periodo=AAAA-MM   crea (o anula) el enlace para que el trabajador vea su liquidación
 *   GET  /api/pyme/enlaces-liquidacion?periodo=AAAA-MM   enlaces del mes con sus aperturas
 *   GET  /api/pyme/liquidacion?t=TOKEN            página pública con la liquidación (sin scripts, no indexable)
 *   POST /api/pyme/comentario                    { comentario: { tipo, texto, pantalla, contacto } } opinión del piloto (máximo 5 por día)
 *   GET|PUT /api/pyme/avisos-correo   { activo }   preferencia de avisos por correo de la cuenta
 *   GET  /api/pyme/avisos-cron                   tarea diaria de Vercel (Authorization: Bearer CRON_SECRET); sin CRON_SECRET, desactivada
 *   GET|POST /api/pyme/avisos-baja?t=FIRMA        baja de los avisos por correo desde el enlace del correo (pide confirmar)
 *   GET|PUT /api/pyme/honorarios?periodo=AAAA-MM  { boletas }   boletas de honorarios recibidas en el mes (PUT reemplaza la lista)
 *   POST /api/pyme/comprar     { product }       crea el pago del Pase Pyme en Flow para esta cuenta y devuelve { url } (cerrado por defecto)
 *   POST /api/pyme/desbloqueo  { producto }      desbloqueo firmado del generador de contrato o finiquito para quien tiene pase
 *   POST /api/pyme/importar           { empresa, trabajadores }  trae datos de otro lugar (el generador de liquidaciones)
 *   GET  /api/pyme/exportar                        descarga todos los datos en un archivo JSON
 *   POST /api/pyme/borrar-cuenta      { confirmar }  elimina la cuenta y todo lo que contiene
 *
 * crearRutas({ auth, datos, env, siteUrl }) devuelve (req, res) => Promise; recibe todo por parametro para probarlo sin servidor.
 */
const H = require('./http');
const PERM = require('./permisos');
const C = require('./correo');
const T = require('./tokens');

const DESTINO_PANEL = '/app';
const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pide uno nuevo desde el asistente.';

// Ruta:método → nombre de la actividad que se registra (nunca con montos ni datos de trabajadores)
const ACTIVIDAD_RUTA = {
    'empresa:PUT': 'empresa_editada', 'empresas:POST': 'empresa_creada', 'empresas:DELETE': 'empresa_borrada',
    'trabajador:POST': 'ficha_creada', 'trabajador:PUT': 'ficha_editada', 'trabajador:DELETE': 'ficha_borrada',
    'mes:PUT': (req) => (req.body && req.body.mes && req.body.mes.emitida ? 'liquidacion_emitida' : 'liquidacion_guardada'), 'mes:DELETE': 'liquidacion_borrada',
    'enlace-liquidacion:POST': 'enlace_creado', 'enlace-liquidacion:DELETE': 'enlace_anulado',
    'equipo:POST': 'equipo_invitado', 'equipo:PUT': 'equipo_cambiado', 'equipo:DELETE': 'equipo_quitado',
    'portal-gestion:POST': 'portal_invitado', 'portal-gestion:PUT': 'portal_cambiado', 'portal-gestion:DELETE': 'portal_quitado',
    'honorarios:PUT': 'honorarios_guardados', 'importar:POST': 'datos_importados', 'exportar:GET': 'respaldo_descargado'
};

function crearRutas({ auth, datos, env, siteUrl, pase, avisos, enlaces, comentarios, estudio, equipo, portal }) {
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
        const estudios = equipo ? await equipo.estudiosDe(s).catch(() => []) : [];
        const portales = portal ? await portal.portalesDe(s).catch(() => []) : [];
        return H.json(res, 200, {
            autenticado: true, email: s.email,
            estudios: estudios.length > 1 ? estudios : undefined,
            portales: portales.length ? portales : undefined
        }, extras);
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
        // Equipo: con el encabezado X-CL-Estudio se trabaja como miembro de ese estudio (los datos son los de su titular); sin él, o con el propio, como titular
        const pedido = req.headers && req.headers['x-cl-estudio'];
        if (pedido && equipo) {
            const id = String(pedido).toLowerCase();
            const como = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? await equipo.resolver(s, id) : null;
            if (!como) { H.json(res, 403, { ok: false, codigo: 'sin_acceso', error: 'No tienes acceso a ese estudio.' }); return null; }
            Object.assign(s, como);
        } else {
            s.rol = s.rol || 'titular';
            s.personaId = s.personaId || s.cuentaId;
        }
        // Permiso por ruta y método, centralizado en permisos.js: una ruta nueva sin permiso declarado no se puede olvidar sin que lo vea la prueba
        const accion = PERM.accionDe(req.query && req.query.ruta, req.method);
        if (accion && !PERM.permitir(s.rol, accion)) { H.json(res, 403, { ok: false, codigo: 'sin_permiso', error: 'Tu rol no permite esta acción.' }); return null; }
        req._sesion = s;
        // Cuenta con varias empresas (estudios contables): el panel dice con cuál trabaja en el encabezado X-CL-Empresa; sin él, la primera
        const pedida = req.headers && req.headers['x-cl-empresa'];
        if (pedida) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(pedida))) { H.json(res, 400, { ok: false, codigo: 'empresa_invalida', error: 'La empresa indicada no es válida.' }); return null; }
            s.empresaId = String(pedida).toLowerCase();
        }
        return s;
    }

    // Escrituras: encabezado propio y origen, sesion y limite por hora. Devuelve la sesion o null (ya respondio).
    async function sesionParaEscribir(req, res) {
        if (!H.escrituraPermitida(req, env, siteUrl)) { H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' }); return null; }
        const s = await conSesion(req, res);
        if (!s) return null;
        if (!(await auth.permitirEscritura(s.personaId || s.cuentaId))) { H.json(res, 429, { ok: false, codigo: 'limite_escrituras', error: 'Hiciste demasiados cambios seguidos. Espera un momento e intenta de nuevo.' }); return null; }
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
        const r = await datos.estado(s);
        if (r.ok && pase) r.pase = { venta: pase.ventaActiva(), productos: pase.catalogo(), cobertura: pase.cobertura() };
        return responder(res, r);
    }

    async function empresa(req, res) {
        if (!metodo(req, res, 'PUT')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        return responder(res, await datos.guardarEmpresa(s, H.cuerpoDe(req).empresa));
    }

    // Equipo del estudio: GET lista; POST suma a una persona; PUT cambia su rol o sus empresas; DELETE la quita
    async function equipoRuta(req, res) {
        const m = req.method;
        if (!equipo) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        if (['GET', 'POST', 'PUT', 'DELETE'].indexOf(m) < 0) { res.setHeader('Allow', 'GET, POST, PUT, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = m === 'GET' ? await conSesion(req, res) : await sesionParaEscribir(req, res);
        if (!s) return;
        const b = H.cuerpoDe(req), id = typeof req.query?.id === 'string' ? req.query.id : '';
        if (m === 'GET') return responder(res, await equipo.listar(s));
        if (m === 'POST') return responder(res, await equipo.invitar(s, b));
        if (m === 'PUT') return responder(res, await equipo.cambiar(s, id, b));
        return responder(res, await equipo.quitar(s, id));
    }

    // Portal del cliente: gestión por parte del estudio (GET lista; POST invita; PUT actualiza secciones; DELETE quita)
    async function portalGestion(req, res) {
        const m = req.method;
        if (!portal) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        if (['GET', 'POST', 'PUT', 'DELETE'].indexOf(m) < 0) { res.setHeader('Allow', 'GET, POST, PUT, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = m === 'GET' ? await conSesion(req, res) : await sesionParaEscribir(req, res);
        if (!s) return;
        const b = H.cuerpoDe(req), id = typeof req.query?.id === 'string' ? req.query.id : '';
        const empId = typeof req.query?.empresaId === 'string' ? req.query.empresaId : (b.empresaId || s.empresaId || '');
        if (m === 'GET') return responder(res, await portal.listar(s, empId));
        if (m === 'POST') return responder(res, await portal.invitar(s, b));
        if (m === 'PUT') return responder(res, await portal.cambiar(s, id, b));
        return responder(res, await portal.quitar(s, id));
    }

    // Portal del cliente: consulta de datos por parte del cliente (solo lectura)
    async function portalDatos(req, res) {
        if (!metodo(req, res, 'GET')) return;
        if (!portal) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        const s = await conSesion(req, res);
        if (!s) return;
        const empId = typeof req.query?.empresaId === 'string' ? req.query.empresaId : '';
        const per = typeof req.query?.periodo === 'string' ? req.query.periodo : '';
        const trabId = typeof req.query?.trabajadorId === 'string' ? req.query.trabajadorId : '';

        if (trabId) {
            return responder(res, await portal.obtenerLiquidacion(s, { empresaId: empId, trabajadorId: trabId, periodo: per }));
        }
        const resp = await portal.obtenerDatos(s, { empresaId: empId, periodo: per });
        if (resp.ok) {
            const actor = { cuentaId: resp.estudioId, personaId: s.personaId || s.cuentaId, empresaId: empId };
            await auth.registrar('portal_visto', actor, empId, H.ipDe(req), 'cliente');
        }
        return responder(res, resp);
    }

    // Registro de actividad: GET lista lo último (titular y administradores); POST lo avisa el navegador tras bajar un archivo
    async function actividad(req, res) {
        if (req.method === 'POST') {
            const s = await sesionParaEscribir(req, res);
            if (!s) return;
            const accion = String(H.cuerpoDe(req).accion || '');
            if (!Object.prototype.hasOwnProperty.call(PERM.DESCARGAS, accion)) return H.json(res, 400, { ok: false, error: 'Acción no reconocida.' });
            if (!PERM.permitir(s.rol, PERM.DESCARGAS[accion])) return H.json(res, 403, { ok: false, codigo: 'sin_permiso', error: 'Tu rol no permite esta acción.' });
            await auth.registrar(accion, s, null, H.ipDe(req), 'cliente');
            return H.json(res, 200, { ok: true });
        }
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        const lista = await auth.listarActividad(s.cuentaId, 200);
        return H.json(res, 200, { ok: true, actividad: lista });
    }

    // Agregar otra empresa a la cuenta (POST) o borrar una con todo lo suyo (DELETE)
    async function empresas(req, res) {
        const m = req.method;
        if (m !== 'POST' && m !== 'DELETE') { res.setHeader('Allow', 'POST, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const b = H.cuerpoDe(req);
        if (m === 'POST') return responder(res, await datos.crearEmpresa(s, b.empresa));
        const r = await datos.borrarEmpresa(s, b.id, b.confirmar);
        if (r.ok) await auth.auditar('empresa_borrada', s.cuentaId, H.ipDe(req));
        return responder(res, r);
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

    async function ausencias(req, res) {
        if (!metodo(req, res, 'PUT')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        return responder(res, await datos.guardarAusencias(s, typeof req.query?.trabajador === 'string' ? req.query.trabajador : '', H.cuerpoDe(req).ausencias));
    }

    async function prestamos(req, res) {
        if (!metodo(req, res, 'PUT')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        return responder(res, await datos.guardarPrestamos(s, typeof req.query?.trabajador === 'string' ? req.query.trabajador : '', H.cuerpoDe(req).prestamos));
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

    async function enlaceLiquidacion(req, res) {
        const m = req.method;
        if (m !== 'POST' && m !== 'DELETE') { res.setHeader('Allow', 'POST, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        if (!enlaces) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        const id = typeof req.query?.trabajador === 'string' ? req.query.trabajador : '';
        const periodo = typeof req.query?.periodo === 'string' ? req.query.periodo : '';
        return responder(res, m === 'POST' ? await enlaces.crearEnlace(s, id, periodo) : await enlaces.anular(s, id, periodo));
    }

    async function enlacesLiquidacion(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        if (!enlaces) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        return responder(res, await enlaces.listar(s, typeof req.query?.periodo === 'string' ? req.query.periodo : ''));
    }

    // Página pública del enlace: documento armado en el servidor, sin scripts (CSP), no indexable y sin caché
    async function liquidacionPublica(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const r = enlaces ? await enlaces.abrir(typeof req.query?.t === 'string' ? req.query.t : '') : { ok: false };
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Referrer-Policy', 'no-referrer');
        if (!r.ok) return H.html(res, 404, C.paginaMensaje('Enlace no válido', 'Este enlace no existe, venció o el empleador lo anuló. Pídele uno nuevo.'));
        return H.html(res, 200, C.paginaLiquidacion(r));
    }

    async function comentario(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        if (!comentarios) return H.json(res, 503, { ok: false, error: 'No disponible.' });
        return responder(res, await comentarios.guardar(s, H.cuerpoDe(req).comentario));
    }

    async function avisosCorreo(req, res) {
        const m = req.method;
        if (m !== 'GET' && m !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = m === 'GET' ? await conSesion(req, res) : await sesionParaEscribir(req, res);
        if (!s) return;
        if (m === 'GET') return responder(res, await datos.avisosCorreo(s));
        return responder(res, await datos.guardarAvisosCorreo(s, H.cuerpoDe(req).activo));
    }

    // Tarea programada de Vercel: llama con "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET no hace nada.
    async function avisosCron(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const clave = env && env.CRON_SECRET;
        if (!clave || !avisos) return H.json(res, 503, { ok: false, error: 'Avisos por correo desactivados.' });
        const a = Buffer.from(String((req.headers && req.headers.authorization) || '')), b = Buffer.from('Bearer ' + clave);
        if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) return H.json(res, 401, { ok: false, error: 'No autorizado.' });
        const r = await avisos.correr();
        console.log('pyme avisos: revisadas ' + r.revisadas + ', enviados ' + r.enviados + ', errores ' + r.errores);
        return H.json(res, 200, Object.assign({ ok: true }, r));
    }

    async function avisosBaja(req, res) {
        const token = String((req.method === 'POST' ? H.cuerpoDe(req).t : req.query?.t) || '');
        const cuentaId = avisos ? avisos.validarBaja(token) : null;
        if (!cuentaId) return H.html(res, 400, C.paginaMensaje('Enlace no válido', 'El enlace para dejar de recibir avisos no es válido. Puedes apagarlos en «Mi cuenta» del asistente.'));
        if (req.method === 'GET') return H.html(res, 200, C.paginaBajaAvisos({ token }));
        if (req.method === 'POST') {
            const origen = req.headers && req.headers.origin;
            if (origen && H.origenesPermitidos(env, siteUrl).indexOf(origen) < 0) return H.json(res, 403, { ok: false, error: 'Solicitud no permitida.' });
            await datos.guardarAvisosCorreo({ cuentaId }, false);
            return H.html(res, 200, C.paginaMensaje('Listo', 'Ya no te enviaremos avisos por correo. Puedes volver a activarlos en «Mi cuenta» del asistente.'));
        }
        res.setHeader('Allow', 'GET, POST');
        return H.json(res, 405, { ok: false, error: 'Método no permitido.' });
    }

    async function honorarios(req, res) {
        const m = req.method;
        if (m !== 'GET' && m !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = m === 'GET' ? await conSesion(req, res) : await sesionParaEscribir(req, res);
        if (!s) return;
        const periodo = typeof req.query?.periodo === 'string' ? req.query.periodo : '';
        if (m === 'GET') return responder(res, await datos.honorarios(s, periodo));
        return responder(res, await datos.guardarHonorarios(s, periodo, H.cuerpoDe(req).boletas));
    }

    async function documento(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        const id = typeof req.query?.trabajador === 'string' ? req.query.trabajador : '';
        return responder(res, await datos.registrarDocumento(s, id, H.cuerpoDe(req).tipo));
    }

    async function documentos(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        return responder(res, await datos.documentos(s));
    }

    async function vacaciones(req, res) {
        if (!metodo(req, res, 'GET')) return;
        const s = await conSesion(req, res);
        if (!s) return;
        return responder(res, await datos.vacaciones(s));
    }

    async function vacacion(req, res) {
        const m = req.method;
        if (m !== 'POST' && m !== 'DELETE') { res.setHeader('Allow', 'POST, DELETE'); return H.json(res, 405, { ok: false, error: 'Método no permitido.' }); }
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        if (m === 'POST') return responder(res, await datos.guardarVacacion(s, typeof req.query?.trabajador === 'string' ? req.query.trabajador : '', H.cuerpoDe(req).vacacion));
        return responder(res, await datos.borrarVacacion(s, typeof req.query?.id === 'string' ? req.query.id : ''));
    }

    async function comprar(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        if (!pase) return H.json(res, 404, { ok: false, error: 'No encontrado.' });
        const b = H.cuerpoDe(req);
        const r = await pase.comprar(s, typeof b.product === 'string' ? b.product : b.producto);
        if (r.ok) await auth.auditar('pase_compra_iniciada', s.cuentaId, H.ipDe(req));
        return responder(res, r);
    }

    async function desbloqueo(req, res) {
        if (!metodo(req, res, 'POST')) return;
        const s = await sesionParaEscribir(req, res);
        if (!s) return;
        if (!pase) return H.json(res, 404, { ok: false, error: 'No encontrado.' });
        return responder(res, await pase.desbloqueo(s, H.cuerpoDe(req).producto));
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

    const tabla = { entrar, verificar, sesion, salir, estado, empresa, empresas, actividad, equipo: equipoRuta, 'portal-gestion': portalGestion, 'portal-datos': portalDatos, trabajador, prestamos, ausencias, meses, mes, honorarios, 'enlace-liquidacion': enlaceLiquidacion, 'enlaces-liquidacion': enlacesLiquidacion, liquidacion: liquidacionPublica, comentario, 'avisos-correo': avisosCorreo, 'avisos-cron': avisosCron, 'avisos-baja': avisosBaja, documento, documentos, vacaciones, vacacion, comprar, desbloqueo, importar, exportar, 'borrar-cuenta': borrarCuenta };

    // Capa de cuentas del contador: su estudio (clientes, nóminas, historial) en una fila cifrada.
    if (estudio) {
        tabla.estudio = async function (req, res) {
            let s;
            try { s = await auth.leerSesion(H.leerCookie(req, H.NOMBRE_COOKIE)); }
            catch (e) { return H.json(res, 500, { ok: false, error: 'No pudimos revisar tu sesión.' }); }
            if (s.renovada) res.setHeader('Set-Cookie', H.cookieSesion(s.renovada.token, s.renovada.vence, Date.now()));
            if (!s.autenticado) return H.json(res, 401, { ok: false, error: 'Entra con tu correo para usar tu cuenta.' });

            try {
                if (req.method === 'GET') {
                    const r = await estudio.leer(s.cuentaId);
                    if (!r.ok) return H.json(res, r.estado || 500, { ok: false, error: r.error });
                    return H.json(res, 200, { ok: true, email: s.email, datos: r.datos, actualizado: r.actualizado });
                }
                if (req.method === 'PUT') {
                    if (!H.escrituraPermitida(req, env, siteUrl)) {
                        return H.json(res, 403, { ok: false, error: 'Petición no permitida.' });
                    }
                    const cuerpo = H.cuerpoDe(req);
                    const r = await estudio.guardar(s.cuentaId, cuerpo.datos);
                    if (!r.ok) return H.json(res, r.estado || 500, { ok: false, codigo: r.codigo, error: r.error });
                    return H.json(res, 200, { ok: true, actualizado: new Date().toISOString() });
                }
                return H.json(res, 405, { ok: false, error: 'Método no permitido.' });
            } catch (e) {
                return H.json(res, 500, { ok: false, error: 'No pudimos guardar o leer tu estudio.' });
            }
        };
    }

    return async function manejar(req, res) {
        const ruta = typeof req.query?.ruta === 'string' ? req.query.ruta : '';
        const f = Object.prototype.hasOwnProperty.call(tabla, ruta) ? tabla[ruta] : null;
        if (!f) return H.json(res, 404, { ok: false, error: 'No encontrado.' });
        await f(req, res);
        // Actividad de las acciones que cambian datos (solo si salieron bien)
        const acc = req._sesion && ACTIVIDAD_RUTA[ruta + ':' + req.method];
        if (acc && res.statusCode >= 200 && res.statusCode < 300) {
            const nombre = typeof acc === 'function' ? acc(req) : acc;
            if (nombre) await auth.registrar(nombre, req._sesion, null, H.ipDe(req));
        }
    };
}

module.exports = { crearRutas, DESTINO_PANEL, tokenValido: T.tokenValido };
