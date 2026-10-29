// Pruebas de permisos y registro de actividad del Asistente Pyme: node tools/test_pyme_permisos.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const PERM = require('../api/_pyme/permisos');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Rut = require('../js/rut_cl');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); process.exitCode = 1; }
    });
}
const SITIO = 'https://calculolaboral.cl';
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
const rutValido = (c) => { let s = 0, m = 2; for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };

function montar(rolDeSesion) {
    const reloj = { t: Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t });
    // Para probar otros roles se envuelve la lectura de sesión (con el equipo, el rol saldrá de la base)
    const authRol = Object.assign({}, auth, { leerSesion: async (t) => { const s = await auth.leerSesion(t); return s.autenticado && rolDeSesion.rol ? Object.assign({}, s, { rol: rolDeSesion.rol }) : s; } });
    const rutas = crearRutas({ auth: authRol, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO });
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + Math.floor(Math.random() * 200) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cookie: 'cl_pyme=' + r.sesion.token, cuenta: await auth.leerSesion(r.sesion.token) };
    }
    return { almacen, datos, rutas, entrar };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
const escribir = (m, o) => pedir(m.rutas, Object.assign({}, o, { headers: Object.assign({}, JSON_OK, { cookie: o.cookie }) }));
const leer = (m, o) => pedir(m.rutas, Object.assign({}, o, { headers: { cookie: o.cookie } }));
const FICHA = () => ({ trabajador: { nombre: 'Ana', rut: rutValido(15234567), sueldoBase: 650000 } });

caso('la matriz: cada rol tiene exactamente lo que dice la propuesta', () => {
    const esperado = {
        titular: ['ver', 'ficha_editar', 'liquidar', 'descargar', 'empresa_gestionar', 'respaldo', 'equipo_gestionar', 'actividad_ver', 'cuenta_borrar'],
        admin: ['ver', 'ficha_editar', 'liquidar', 'descargar', 'empresa_gestionar', 'respaldo', 'equipo_gestionar', 'actividad_ver'],
        contador: ['ver', 'ficha_editar', 'liquidar', 'descargar'],
        asistente: ['ver', 'ficha_editar'],
        lectura: ['ver']
    };
    PERM.ROLES.forEach(rol => assert.deepStrictEqual(Object.keys(PERM.MATRIZ).filter(a => PERM.permitir(rol, a)).sort(), esperado[rol].slice().sort(), rol));
    assert.ok(!PERM.permitir('inventado', 'ver') && !PERM.permitir('titular', 'inventada') && !PERM.permitir(undefined, 'ver') && !PERM.permitir('titular', '__proto__'));
});

caso('toda ruta que cambia datos declara su permiso y todo permiso declarado existe', () => {
    Object.keys(PERM.RUTAS).forEach(r => Object.keys(PERM.RUTAS[r]).forEach(m => assert.ok(PERM.MATRIZ[PERM.RUTAS[r][m]], r + ':' + m)));
    const fuente = require('fs').readFileSync(require('path').join(__dirname, '..', 'api', '_pyme', 'rutas.js'), 'utf8');
    const tabla = /const tabla = \{([^}]*)\}/.exec(fuente)[1];
    const escritura = ['empresa', 'empresas', 'trabajador', 'prestamos', 'ausencias', 'documento', 'vacacion', 'importar', 'mes', 'honorarios', 'enlace-liquidacion', 'exportar', 'borrar-cuenta'];
    escritura.forEach(r => { assert.ok(PERM.RUTAS[r], 'falta el permiso de ' + r); assert.ok(tabla.indexOf(r) >= 0, r + ' no está en la tabla de rutas'); });
    assert.strictEqual(PERM.accionDe('mes', 'PUT'), 'liquidar');
    assert.strictEqual(PERM.accionDe('mes', 'TRACE'), null);
    assert.strictEqual(PERM.accionDe('constructor', 'GET'), null);
});

caso('un rol sin permiso recibe 403 antes de tocar nada; el titular sigue igual', async () => {
    const rol = { rol: 'lectura' };
    const m = montar(rol);
    const { cookie, cuenta } = await m.entrar('a@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, { razonSocial: 'Panadería SpA', rut: rutValido(76845123) });
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie })).statusCode, 200);
    const ficha = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: FICHA() });
    assert.strictEqual(ficha.statusCode, 403); assert.strictEqual(ficha.json.codigo, 'sin_permiso');
    assert.strictEqual((await leer(m, { query: { ruta: 'exportar' }, cookie })).statusCode, 403);
    assert.strictEqual((await escribir(m, { query: { ruta: 'actividad' }, metodo: 'POST', cookie, body: { accion: 'descarga_previred' } })).statusCode, 403);
    assert.strictEqual((await leer(m, { query: { ruta: 'actividad' }, cookie })).statusCode, 403);
    assert.strictEqual((await escribir(m, { query: { ruta: 'borrar-cuenta' }, metodo: 'POST', cookie, body: { confirmar: 'a@ejemplo.cl' } })).statusCode, 403);
    assert.strictEqual((await m.datos.estado(cuenta)).trabajadores.length, 0, 'no se creó nada');
    rol.rol = 'asistente';
    assert.strictEqual((await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: FICHA() })).statusCode, 200, 'el asistente edita ffichas');
    assert.strictEqual((await escribir(m, { query: { ruta: 'mes' }, metodo: 'PUT', cookie, query2: 1, body: { mes: {} } })).statusCode, 403, 'el asistente no guarda liquidaciones');
    rol.rol = null;
    assert.strictEqual((await leer(m, { query: { ruta: 'exportar' }, cookie })).statusCode, 200, 'el titular sigue igual');
});

caso('las acciones que cambian datos quedan registradas sin montos ni datos de trabajadores', async () => {
    const m = montar({});
    const { cookie, cuenta } = await m.entrar('b@ejemplo.cl');
    assert.strictEqual((await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: { razonSocial: 'Ferretería El Clavo', rut: rutValido(76845124) } } })).statusCode, 200);
    const t = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: { trabajador: { nombre: 'Luis Soto', rut: rutValido(12345678), sueldoBase: 777777 } } });
    assert.strictEqual(t.statusCode, 200);
    await leer(m, { query: { ruta: 'exportar' }, cookie });
    const lista = (await leer(m, { query: { ruta: 'actividad' }, cookie })).json.actividad;
    assert.deepStrictEqual(lista.map(x => x.accion), ['respaldo_descargado', 'ficha_creada', 'empresa_editada']);
    const crudo = JSON.stringify(m.almacen._estado.actividad);
    ['Luis', '777777', 'Ferretería', '12.345'].forEach(s => assert.ok(!crudo.includes(s), 'el registro guarda «' + s + '»'));
    assert.ok(lista.every(x => x.actorId === cuenta.cuentaId && x.origen === 'servidor'));
    const antes = lista.length;
    await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: { trabajador: { nombre: '', rut: 'mal' } } });
    assert.strictEqual((await leer(m, { query: { ruta: 'actividad' }, cookie })).json.actividad.length, antes, 'un intento rechazado no queda como acción hecha');
});

caso('las descargas del navegador se avisan con una lista cerrada y quedan marcadas como del cliente', async () => {
    const m = montar({});
    const { cookie } = await m.entrar('c@ejemplo.cl');
    assert.strictEqual((await escribir(m, { query: { ruta: 'actividad' }, metodo: 'POST', cookie, body: { accion: 'descarga_previred' } })).statusCode, 200);
    assert.strictEqual((await escribir(m, { query: { ruta: 'actividad' }, metodo: 'POST', cookie, body: { accion: 'borrar_todo' } })).statusCode, 400);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'actividad' }, metodo: 'POST', headers: { cookie }, body: { accion: 'descarga_lre' } })).statusCode, 403, 'sin la cabecera propia se rechaza');
    const l = (await leer(m, { query: { ruta: 'actividad' }, cookie })).json.actividad;
    assert.deepStrictEqual(l.map(x => [x.accion, x.origen]), [['descarga_previred', 'cliente']]);
});

caso('la actividad es de cada cuenta, se borra con ella y sin sesión no se ve', async () => {
    const m = montar({});
    const a = await m.entrar('d@ejemplo.cl'), b = await m.entrar('e@ejemplo.cl');
    await escribir(m, { query: { ruta: 'actividad' }, metodo: 'POST', cookie: a.cookie, body: { accion: 'descarga_lre' } });
    assert.deepStrictEqual((await leer(m, { query: { ruta: 'actividad' }, cookie: b.cookie })).json.actividad, []);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'actividad' } })).statusCode, 401);
    assert.ok((await m.datos.borrarCuenta(a.cuenta, 'd@ejemplo.cl')).ok);
    assert.ok(!m.almacen._estado.actividad.some(x => x.cuentaId === a.cuenta.cuentaId));
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
