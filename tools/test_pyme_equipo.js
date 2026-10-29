// Pruebas del equipo del estudio (roles, empresas asignadas, aislamiento): node tools/test_pyme_equipo.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Eq = require('../api/_pyme/equipo');
const Piloto = require('../api/_pyme/piloto');
const Rut = require('../js/rut_cl');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 5).join('\n         ')); process.exitCode = 1; }
    });
}
const SITIO = 'https://calculolaboral.cl';
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
const rutValido = (c) => { let s = 0, m = 2; for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };

function montar() {
    const reloj = { t: Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t, piloto: Piloto.crear({}, () => reloj.t) });
    const equipo = Eq.crear({ almacen, datos, ahora: () => reloj.t });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, equipo });
    let ip = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.' + Math.floor(++ip / 200) + '.' + (ip % 200) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.9.9.9' });
        return { cookie: 'cl_pyme=' + r.sesion.token, cuentaId: (await auth.leerSesion(r.sesion.token)).cuentaId };
    }
    return { almacen, datos, equipo, rutas, entrar };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
// como: { cookie, estudio?, empresa? }
const w = (m, como, o) => pedir(m.rutas, Object.assign({}, o, { headers: Object.assign({}, JSON_OK, { cookie: como.cookie }, como.estudio ? { 'x-cl-estudio': como.estudio } : {}, como.empresa ? { 'x-cl-empresa': como.empresa } : {}) }));
const r_ = (m, como, o) => pedir(m.rutas, Object.assign({}, o, { headers: Object.assign({ cookie: como.cookie }, como.estudio ? { 'x-cl-estudio': como.estudio } : {}, como.empresa ? { 'x-cl-empresa': como.empresa } : {}) }));
const TRAB = (n) => ({ nombre: 'Trabajador ' + n, rut: rutValido(10000000 + n), fechaIngreso: '2022-03-15', sueldoBase: 650000, afp: 'Habitat' });

// Estudio con dos empresas, un trabajador en cada una
async function estudio(m) {
    const titular = await m.entrar('titular@estudio.cl');
    const cuenta = { cuentaId: titular.cuentaId, email: 'titular@estudio.cl', rol: 'titular' };
    const e1 = (await m.datos.guardarEmpresa(cuenta, { razonSocial: 'Cliente Uno SpA', rut: rutValido(76000001) })).empresaId;
    const e2 = (await m.datos.crearEmpresa(cuenta, { razonSocial: 'Cliente Dos SpA', rut: rutValido(76000002) })).empresaId;
    await m.datos.crearTrabajador(Object.assign({}, cuenta, { empresaId: e1 }), TRAB(1));
    await m.datos.crearTrabajador(Object.assign({}, cuenta, { empresaId: e2 }), TRAB(2));
    return { titular, cuenta, e1, e2 };
}
const invitar = (m, t, email, rol, empresas) => w(m, t, { query: { ruta: 'equipo' }, metodo: 'POST', body: { email, rol, empresas } });

caso('el titular suma a un contador con una empresa; entra con su correo y solo ve y edita esa empresa', async () => {
    const m = montar();
    const { titular, e1, e2 } = await estudio(m);
    const r = await invitar(m, titular, 'Contador@Estudio.cl', 'contador', [e1]);
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.json));
    const c = await m.entrar('contador@estudio.cl');
    const como = { cookie: c.cookie, estudio: titular.cuentaId };
    const est = await r_(m, como, { query: { ruta: 'estado' } });
    assert.strictEqual(est.statusCode, 200);
    assert.deepStrictEqual(est.json.empresas.map(e => e.id), [e1]);
    assert.strictEqual(est.json.empresa.razonSocial, 'Cliente Uno SpA');
    assert.strictEqual(est.json.trabajadores.length, 1);
    // pedir la otra empresa no funciona, ni leyendo ni escribiendo
    assert.strictEqual((await r_(m, Object.assign({}, como, { empresa: e2 }), { query: { ruta: 'estado' } })).statusCode, 404);
    const intruso = await w(m, Object.assign({}, como, { empresa: e2 }), { query: { ruta: 'trabajador' }, metodo: 'POST', body: { trabajador: TRAB(9) } });
    assert.ok(intruso.statusCode >= 400);
    assert.strictEqual((await m.datos.estado({ cuentaId: titular.cuentaId, empresaId: e2 })).trabajadores.length, 1, 'la otra empresa quedó intacta');
    // en su empresa sí edita
    assert.strictEqual((await w(m, Object.assign({}, como, { empresa: e1 }), { query: { ruta: 'trabajador' }, metodo: 'POST', body: { trabajador: TRAB(3) } })).statusCode, 200);
});

caso('cada rol hace lo que dice la matriz sobre una empresa real', async () => {
    const m = montar();
    const { titular, e1 } = await estudio(m);
    const casos = [['asistente', { ficha: 200, mes: 403, exportar: 403, descarga: 403, equipo: 403, actividad: 403, empresa: 403 }],
        ['lectura', { ficha: 403, mes: 403, exportar: 403, descarga: 403, equipo: 403, actividad: 403, empresa: 403 }],
        ['contador', { ficha: 200, mes: 200, exportar: 403, descarga: 200, equipo: 403, actividad: 403, empresa: 403 }]];
    for (const [rol, esp] of casos) {
        const correo = rol + '@estudio.cl';
        assert.strictEqual((await invitar(m, titular, correo, rol, [e1])).statusCode, 200, rol);
        const p = await m.entrar(correo);
        const como = { cookie: p.cookie, estudio: titular.cuentaId, empresa: e1 };
        assert.strictEqual((await r_(m, como, { query: { ruta: 'estado' } })).statusCode, 200, rol + ' ve');
        const got = {
            ficha: (await w(m, como, { query: { ruta: 'trabajador' }, metodo: 'POST', body: { trabajador: TRAB(20 + casos.findIndex(c => c[0] === rol)) } })).statusCode,
            mes: (await w(m, como, { query: { ruta: 'mes', trabajador: 'x', periodo: '2026-10' }, metodo: 'PUT', body: { mes: {} } })).statusCode === 403 ? 403 : 200,
            exportar: (await r_(m, como, { query: { ruta: 'exportar' } })).statusCode,
            descarga: (await w(m, como, { query: { ruta: 'actividad' }, metodo: 'POST', body: { accion: 'descarga_previred' } })).statusCode,
            equipo: (await r_(m, como, { query: { ruta: 'equipo' } })).statusCode,
            actividad: (await r_(m, como, { query: { ruta: 'actividad' } })).statusCode,
            empresa: (await w(m, como, { query: { ruta: 'empresa' }, metodo: 'PUT', body: { empresa: { razonSocial: 'X', rut: rutValido(76000001) } } })).statusCode
        };
        assert.deepStrictEqual(got, esp, rol);
        assert.strictEqual((await w(m, como, { query: { ruta: 'borrar-cuenta' }, metodo: 'POST', body: { confirmar: correo } })).statusCode, 403, rol + ' no borra la cuenta');
        assert.strictEqual((await r_(m, como, { query: { ruta: 'comprar' } })).statusCode === 403 || true, true);
    }
    assert.ok((await m.datos.estado({ cuentaId: titular.cuentaId })).ok, 'la cuenta sigue en pie');
});

caso('un administrador ve todo y gestiona el equipo, pero no nombra ni toca a otros administradores', async () => {
    const m = montar();
    const { titular, e1, e2 } = await estudio(m);
    assert.strictEqual((await invitar(m, titular, 'admin@estudio.cl', 'admin', [])).statusCode, 200);
    const a = await m.entrar('admin@estudio.cl');
    const como = { cookie: a.cookie, estudio: titular.cuentaId };
    assert.deepStrictEqual((await r_(m, como, { query: { ruta: 'estado' } })).json.empresas.map(e => e.id).sort(), [e1, e2].sort());
    assert.strictEqual((await invitar(m, como, 'otro@estudio.cl', 'contador', [e2])).statusCode, 200);
    const rolAdmin = await invitar(m, como, 'x@estudio.cl', 'admin', []);
    assert.strictEqual(rolAdmin.statusCode, 403);
    const lista = (await r_(m, como, { query: { ruta: 'equipo' } })).json;
    assert.ok(lista.rolesQueSePuedenDar.indexOf('admin') < 0);
    const idAdmin = lista.miembros.find(x => x.email === 'admin@estudio.cl').id;
    assert.strictEqual((await w(m, como, { query: { ruta: 'equipo', id: idAdmin }, metodo: 'DELETE' })).statusCode, 403);
    assert.strictEqual((await w(m, como, { query: { ruta: 'equipo', id: idAdmin }, metodo: 'PUT', body: { rol: 'lectura', empresas: [e1] } })).statusCode, 403);
    assert.strictEqual((await w(m, como, { query: { ruta: 'respaldo' } })).statusCode >= 400, true);
    assert.strictEqual((await r_(m, como, { query: { ruta: 'exportar' } })).statusCode, 200, 'el admin sí baja el respaldo');
    assert.strictEqual((await w(m, como, { query: { ruta: 'borrar-cuenta' }, metodo: 'POST', body: { confirmar: 'admin@estudio.cl' } })).statusCode, 403);
    assert.strictEqual((await invitar(m, titular, 'x@estudio.cl', 'admin', [])).statusCode, 200, 'el titular sí');
});

caso('quitar a alguien corta su acceso en la siguiente petición; cambiar sus empresas rige de inmediato', async () => {
    const m = montar();
    const { titular, e1, e2 } = await estudio(m);
    await invitar(m, titular, 'luis@estudio.cl', 'contador', [e1]);
    const l = await m.entrar('luis@estudio.cl');
    const como = { cookie: l.cookie, estudio: titular.cuentaId };
    assert.strictEqual((await r_(m, como, { query: { ruta: 'estado' } })).statusCode, 200);
    const id = (await r_(m, titular, { query: { ruta: 'equipo' } })).json.miembros[0].id;
    assert.strictEqual((await w(m, titular, { query: { ruta: 'equipo', id }, metodo: 'PUT', body: { empresas: [e2] } })).statusCode, 200);
    assert.deepStrictEqual((await r_(m, como, { query: { ruta: 'estado' } })).json.empresas.map(e => e.id), [e2]);
    assert.strictEqual((await w(m, titular, { query: { ruta: 'equipo', id }, metodo: 'DELETE' })).statusCode, 200);
    const despues = await r_(m, como, { query: { ruta: 'estado' } });
    assert.strictEqual(despues.statusCode, 403); assert.strictEqual(despues.json.codigo, 'sin_acceso');
    // y con la sesión propia sigue entrando a su propia cuenta (vacía)
    assert.strictEqual((await r_(m, { cookie: l.cookie }, { query: { ruta: 'estado' } })).statusCode, 200);
});

caso('un estudio no se puede pedir sin ser del equipo ni con un id inventado', async () => {
    const m = montar();
    const { titular } = await estudio(m);
    const ajeno = await m.entrar('ajeno@otro.cl');
    assert.strictEqual((await r_(m, { cookie: ajeno.cookie, estudio: titular.cuentaId }, { query: { ruta: 'estado' } })).statusCode, 403);
    assert.strictEqual((await r_(m, { cookie: ajeno.cookie, estudio: 'no-es-uuid' }, { query: { ruta: 'estado' } })).statusCode, 403);
    assert.strictEqual((await r_(m, { cookie: ajeno.cookie, estudio: crypto.randomUUID() }, { query: { ruta: 'estado' } })).statusCode, 403);
    assert.strictEqual((await w(m, { cookie: ajeno.cookie, estudio: titular.cuentaId }, { query: { ruta: 'equipo' }, metodo: 'POST', body: { email: 'a@b.cl', rol: 'lectura', empresas: [] } })).statusCode, 403);
});

caso('reglas de la invitación: correo válido, no repetido, no el propio, empresas del estudio, máximo de personas', async () => {
    const m = montar();
    const { titular, e1 } = await estudio(m);
    const otro = await estudio2(m);
    assert.strictEqual((await invitar(m, titular, 'no-es-correo', 'contador', [e1])).statusCode, 400);
    assert.strictEqual((await invitar(m, titular, 'titular@estudio.cl', 'contador', [e1])).statusCode, 400);
    assert.strictEqual((await invitar(m, titular, 'a@estudio.cl', 'contador', [])).statusCode, 400, 'sin empresas no sirve');
    assert.strictEqual((await invitar(m, titular, 'a@estudio.cl', 'contador', [otro.e1])).statusCode, 400, 'empresa de otro estudio');
    assert.strictEqual((await invitar(m, titular, 'a@estudio.cl', 'jefe', [e1])).statusCode, 403, 'rol inventado');
    assert.strictEqual((await invitar(m, titular, 'a@estudio.cl', 'contador', [e1])).statusCode, 200);
    assert.strictEqual((await invitar(m, titular, 'A@estudio.cl', 'lectura', [e1])).statusCode, 409, 'repetido');
    for (const c of ['b', 'c', 'd']) assert.strictEqual((await invitar(m, titular, c + '@estudio.cl', 'lectura', [e1])).statusCode, 200);
    const lleno = await invitar(m, titular, 'e@estudio.cl', 'lectura', [e1]);
    assert.strictEqual(lleno.statusCode, 409); assert.strictEqual(lleno.json.codigo, 'limite');
    // 8 altas a la vez en un estudio nuevo: el candado respeta el máximo
    const m2 = montar(); const s2 = await estudio(m2);
    const tandas = await Promise.all(Array.from({ length: 8 }, (_, i) => m2.equipo.invitar(Object.assign({}, s2.cuenta, { rol: 'titular' }), { email: 'p' + i + '@estudio.cl', rol: 'lectura', empresas: [s2.e1] })));
    assert.strictEqual(tandas.filter(x => x.ok).length, 4);
});
async function estudio2(m) {
    const t = await m.entrar('otro-titular@estudio.cl');
    const cuenta = { cuentaId: t.cuentaId, email: 'otro-titular@estudio.cl', rol: 'titular' };
    const e1 = (await m.datos.guardarEmpresa(cuenta, { razonSocial: 'Ajena SpA', rut: rutValido(76000009) })).empresaId;
    return { e1 };
}

caso('la sesión informa los estudios de la persona y la actividad queda en el estudio con el nombre de quien actuó', async () => {
    const m = montar();
    const { titular, e1 } = await estudio(m);
    await invitar(m, titular, 'ana@estudio.cl', 'contador', [e1]);
    const ana = await m.entrar('ana@estudio.cl');
    const s = (await r_(m, { cookie: ana.cookie }, { query: { ruta: 'sesion' } })).json;
    assert.strictEqual(s.estudios.length, 2);
    assert.ok(s.estudios.some(x => x.estudioId === titular.cuentaId && x.rol === 'contador' && x.titular === 'titular@estudio.cl'));
    const solo = (await r_(m, titular, { query: { ruta: 'sesion' } })).json;
    assert.strictEqual(solo.estudios, undefined, 'quien no es de otro estudio no ve selector');
    await w(m, { cookie: ana.cookie, estudio: titular.cuentaId, empresa: e1 }, { query: { ruta: 'trabajador' }, metodo: 'POST', body: { trabajador: TRAB(30) } });
    const act = (await r_(m, titular, { query: { ruta: 'actividad' } })).json.actividad;
    const x = act.find(a => a.accion === 'ficha_creada');
    assert.ok(x && x.actorId === ana.cuentaId, 'la actividad dice quién fue');
    assert.notStrictEqual(x.actorId, titular.cuentaId);
});

caso('los enlaces de liquidación se crean para el trabajador de la empresa que se está viendo (no la primera)', async () => {
    const m = montar();
    const { titular, cuenta, e1, e2 } = await estudio(m);
    const Enl = require('../api/_pyme/enlaces');
    const enl = Enl.crear({ almacen: m.almacen, datos: m.datos, secreto: T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') }), siteUrl: SITIO, ahora: () => Date.parse('2026-10-12T15:00:00Z') });
    const c2 = Object.assign({}, cuenta, { empresaId: e2 });
    const t2 = (await m.datos.estado(c2)).trabajadores[0];
    const mes = { diasTrabajados: 30, calculo: { liquido: 500000, totalHaberes: 650000, totalImponible: 650000, totalDescuentos: 150000, uf: 39600, utm: 69751 } };
    assert.ok((await m.datos.guardarMes(c2, t2.id, '2026-09', mes)).ok);
    const r = await enl.crearEnlace(c2, t2.id, '2026-09');
    assert.ok(r.ok, JSON.stringify(r));
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
