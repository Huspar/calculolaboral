// Pruebas de varias empresas por cuenta (estudios contables), sin base ni correo: node tools/test_pyme_multiempresa.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Piloto = require('../api/_pyme/piloto');
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
const rutValido = (cuerpo) => {
    let s = 0, m = 2;
    for (let i = String(cuerpo).length - 1; i >= 0; i--) { s += +String(cuerpo)[i] * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    return Rut.formatear(cuerpo + (r === 11 ? '0' : r === 10 ? 'K' : String(r)));
};
const EMPRESA = (n) => ({ razonSocial: 'Cliente ' + n + ' SpA', rut: rutValido(76000000 + n), comuna: 'Temuco' });
const TRAB = (n) => ({ nombre: 'Trabajador ' + n, rut: rutValido(10000000 + n), cargo: 'Panadero', fechaIngreso: '2022-03-15', sueldoBase: 650000, afp: 'Habitat' });

function montar(conPiloto) {
    const reloj = { t: Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const piloto = conPiloto ? Piloto.crear({}, () => reloj.t) : undefined;
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t, piloto });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO });
    let ipN = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + (++ipN) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        const s = await auth.leerSesion(r.sesion.token);
        return { cookie: 'cl_pyme=' + r.sesion.token, cuenta: { cuentaId: s.cuentaId, email: s.email } };
    }
    return { almacen, datos, rutas, entrar };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
const escribir = (m, o) => pedir(m.rutas, { ...o, headers: { ...JSON_OK, cookie: o.cookie, ...(o.headers || {}) } });
const leer = (m, o) => pedir(m.rutas, { ...o, headers: { cookie: o.cookie, ...(o.headers || {}) } });
const con = (cuenta, empresaId) => Object.assign({}, cuenta, { empresaId });

caso('sin piloto la cuenta sigue con una sola empresa y guardar la empresa la edita en vez de crear otra', async () => {
    const m = montar(false);
    const { cuenta } = await m.entrar('uno@ejemplo.cl');
    const r1 = await m.datos.guardarEmpresa(cuenta, EMPRESA(1));
    assert.ok(r1.ok && r1.empresaId);
    const r2 = await m.datos.guardarEmpresa(cuenta, { ...EMPRESA(1), giro: 'Panadería' });
    assert.strictEqual(r2.empresaId, r1.empresaId);
    const otra = await m.datos.crearEmpresa(cuenta, EMPRESA(2));
    assert.ok(!otra.ok && otra.codigo === 'limite_empresas' && otra.estado === 409);
    const e = await m.datos.estado(cuenta);
    assert.strictEqual(e.empresas.length, 1);
    assert.strictEqual(e.limites.maxEmpresas, 1);
    assert.strictEqual(e.empresa.giro, 'Panadería');
});

caso('durante el piloto se agregan empresas; cada una guarda sus propios trabajadores y el estado lista todas', async () => {
    const m = montar(true);
    const { cuenta } = await m.entrar('estudio@ejemplo.cl');
    const a = (await m.datos.guardarEmpresa(cuenta, EMPRESA(1))).empresaId;
    const b = await m.datos.crearEmpresa(cuenta, EMPRESA(2));
    const c = await m.datos.crearEmpresa(cuenta, EMPRESA(3));
    assert.ok(b.ok && c.ok && b.empresaId !== a);
    assert.ok((await m.datos.crearTrabajador(con(cuenta, a), TRAB(1))).ok);
    assert.ok((await m.datos.crearTrabajador(con(cuenta, b.empresaId), TRAB(1))).ok, 'el mismo RUT puede estar en dos empresas distintas');
    assert.ok((await m.datos.crearTrabajador(con(cuenta, b.empresaId), TRAB(2))).ok);
    const eA = await m.datos.estado(con(cuenta, a)), eB = await m.datos.estado(con(cuenta, b.empresaId)), eC = await m.datos.estado(con(cuenta, c.empresaId));
    assert.deepStrictEqual([eA.trabajadores.length, eB.trabajadores.length, eC.trabajadores.length], [1, 2, 0]);
    assert.strictEqual(eB.empresa.razonSocial, 'Cliente 2 SpA');
    assert.deepStrictEqual(eA.empresas.map(x => x.razonSocial), ['Cliente 1 SpA', 'Cliente 2 SpA', 'Cliente 3 SpA']);
    assert.strictEqual(eA.empresaId, a);
    // sin indicar empresa se trabaja con la primera, como antes
    assert.strictEqual((await m.datos.estado(cuenta)).empresaId, a);
});

caso('guardar la empresa con una empresa indicada solo cambia esa', async () => {
    const m = montar(true);
    const { cuenta } = await m.entrar('estudio2@ejemplo.cl');
    const a = (await m.datos.guardarEmpresa(cuenta, EMPRESA(1))).empresaId;
    const b = (await m.datos.crearEmpresa(cuenta, EMPRESA(2))).empresaId;
    const r = await m.datos.guardarEmpresa(con(cuenta, b), { ...EMPRESA(2), giro: 'Ferretería' });
    assert.strictEqual(r.empresaId, b);
    assert.strictEqual((await m.datos.estado(con(cuenta, b))).empresa.giro, 'Ferretería');
    assert.ok(!(await m.datos.estado(con(cuenta, a))).empresa.giro);
});

caso('por la API el encabezado X-CL-Empresa elige la empresa; uno inválido o ajeno se rechaza', async () => {
    const m = montar(true);
    const x = await m.entrar('api@ejemplo.cl');
    const otro = await m.entrar('otro@ejemplo.cl');
    const a = (await m.datos.guardarEmpresa(x.cuenta, EMPRESA(1))).empresaId;
    const bR = await escribir(m, { query: { ruta: 'empresas' }, metodo: 'POST', cookie: x.cookie, body: { empresa: EMPRESA(2) } });
    assert.strictEqual(bR.statusCode, 200, JSON.stringify(bR.json));
    const b = bR.json.empresaId;
    const tr = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie: x.cookie, headers: { 'x-cl-empresa': b }, body: { trabajador: TRAB(7) } });
    assert.strictEqual(tr.statusCode, 200, JSON.stringify(tr.json));
    const eB = await leer(m, { query: { ruta: 'estado' }, cookie: x.cookie, headers: { 'x-cl-empresa': b } });
    const eA = await leer(m, { query: { ruta: 'estado' }, cookie: x.cookie, headers: { 'x-cl-empresa': a } });
    const eSin = await leer(m, { query: { ruta: 'estado' }, cookie: x.cookie });
    assert.deepStrictEqual([eB.json.trabajadores.length, eA.json.trabajadores.length, eSin.json.empresaId], [1, 0, a]);
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie: x.cookie, headers: { 'x-cl-empresa': 'no-es-uuid' } })).statusCode, 400);
    // la empresa de otra cuenta no existe para esta
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie: otro.cookie, headers: { 'x-cl-empresa': b } })).statusCode, 404);
    const intruso = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie: otro.cookie, headers: { 'x-cl-empresa': b }, body: { trabajador: TRAB(8) } });
    assert.ok(intruso.statusCode >= 400, 'no puede crear trabajadores en una empresa ajena');
    assert.strictEqual((await m.datos.estado(con(x.cuenta, b))).trabajadores.length, 1);
    const sinOrigen = await pedir(m.rutas, { query: { ruta: 'empresas' }, metodo: 'POST', headers: { cookie: x.cookie }, body: { empresa: EMPRESA(9) } });
    assert.strictEqual(sinOrigen.statusCode, 403);
});

caso('el piloto permite hasta 25 empresas por cuenta', async () => {
    const m = montar(true);
    const { cuenta } = await m.entrar('muchas@ejemplo.cl');
    for (let i = 1; i <= D.MAX_EMPRESAS_PILOTO; i++) {
        const r = i === 1 ? await m.datos.guardarEmpresa(cuenta, EMPRESA(i)) : await m.datos.crearEmpresa(cuenta, EMPRESA(i));
        assert.ok(r.ok, 'empresa ' + i);
    }
    const de_mas = await m.datos.crearEmpresa(cuenta, EMPRESA(99));
    assert.ok(!de_mas.ok && de_mas.codigo === 'limite_empresas');
    assert.strictEqual((await m.datos.estado(cuenta)).empresas.length, D.MAX_EMPRESAS_PILOTO);
});

caso('borrar una empresa pide confirmación, se lleva sus trabajadores y meses y deja intactas las demás', async () => {
    const m = montar(true);
    const x = await m.entrar('borra@ejemplo.cl');
    const otro = await m.entrar('ajeno@ejemplo.cl');
    const a = (await m.datos.guardarEmpresa(x.cuenta, EMPRESA(1))).empresaId;
    const b = (await m.datos.crearEmpresa(x.cuenta, EMPRESA(2))).empresaId;
    const ta = (await m.datos.crearTrabajador(con(x.cuenta, a), TRAB(1))).trabajador.id;
    const tb = (await m.datos.crearTrabajador(con(x.cuenta, b), TRAB(2))).trabajador.id;
    assert.ok((await m.datos.guardarMes(con(x.cuenta, a), ta, '2026-10', { diasTrabajados: 30 })).ok);
    assert.ok((await m.datos.guardarMes(con(x.cuenta, b), tb, '2026-10', { diasTrabajados: 30 })).ok);
    assert.ok(!(await m.datos.guardarMes(con(x.cuenta, a), tb, '2026-10', { diasTrabajados: 30 })).ok, 'un trabajador de otra empresa no se toca desde esta');
    const sin = await m.datos.borrarEmpresa(x.cuenta, b, false);
    assert.ok(!sin.ok && sin.codigo === 'confirmacion');
    assert.ok(!(await m.datos.borrarEmpresa(otro.cuenta, b, true)).ok, 'otra cuenta no puede borrarla');
    assert.ok(!(await m.datos.borrarEmpresa(x.cuenta, 'no-uuid', true)).ok);
    const r = await escribir(m, { query: { ruta: 'empresas' }, metodo: 'DELETE', cookie: x.cookie, body: { id: b, confirmar: true } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.json));
    assert.deepStrictEqual((await m.datos.estado(x.cuenta)).empresas.map(e => e.id), [a]);
    assert.strictEqual((await m.datos.estado(con(x.cuenta, a))).trabajadores.length, 1);
    assert.ok(!m.almacen._estado.trabajadores.some(t => t.empresaId === b));
    assert.strictEqual((await m.datos.estado(con(x.cuenta, b))).codigo, 'no_existe');
    assert.ok(!m.almacen._estado.meses.some(me => me.trabajadorId === tb));
    assert.ok(m.almacen._estado.meses.some(me => me.trabajadorId === ta));
});

caso('borrar la cuenta se lleva todas sus empresas', async () => {
    const m = montar(true);
    const x = await m.entrar('fin@ejemplo.cl');
    await m.datos.guardarEmpresa(x.cuenta, EMPRESA(1));
    const b = (await m.datos.crearEmpresa(x.cuenta, EMPRESA(2))).empresaId;
    await m.datos.crearTrabajador(con(x.cuenta, b), TRAB(3));
    assert.ok((await m.datos.borrarCuenta(x.cuenta, 'fin@ejemplo.cl')).ok);
    assert.strictEqual(m.almacen._estado.empresas.length, 0);
    assert.strictEqual(m.almacen._estado.trabajadores.length, 0);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
