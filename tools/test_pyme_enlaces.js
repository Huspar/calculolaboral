// Pruebas de la liquidación compartida por enlace (sin base ni correo reales): node tools/test_pyme_enlaces.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const En = require('../api/_pyme/enlaces');
const E = require('../js/liquidacion_engine');
const L = require('../js/pyme_liquidaciones');
const Rut = require('../js/rut_cl');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); process.exitCode = 1; }
    });
}
const SITIO = 'https://calculolaboral.cl', DIA = 86400000;
const ESCRIBIR = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
const rutValido = (c) => { let s = 0, m = 2; for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };

function montar() {
    const reloj = { t: Date.parse('2026-10-20T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const accesos = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { accesos.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t });
    const enlaces = En.crear({ almacen, datos, secreto, siteUrl: SITIO, ahora: () => reloj.t });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, enlaces });
    let ip = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + (++ip) });
        const token = new URL(accesos[accesos.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cuenta: await auth.leerSesion(r.sesion.token), cookie: 'cl_pyme=' + r.sesion.token };
    }
    return { reloj, almacen, datos, rutas, entrar };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
// Cuenta con empresa, un trabajador y su liquidación de octubre guardada (calculada con el motor, como lo hace el panel)
async function conLiquidacion(m, correo) {
    const s = await m.entrar(correo);
    await m.datos.guardarEmpresa(s.cuenta, { razonSocial: 'Panadería La Espiga Ltda.', rut: rutValido(76845123), representante: 'Manuel Lagos' });
    const t = (await m.datos.crearTrabajador(s.cuenta, { nombre: 'Ana Pérez <b>González</b>', rut: rutValido(15234567), fechaIngreso: '2022-03-15', sueldoBase: 650000, afp: 'Habitat', colacion: 40000 })).trabajador;
    const v = { uf: 39600, utm: 69751, imm: 553553, topeAfpUF: 90, topeAfcUF: 135.2, jornadaMaxima: 42, afp: require('../js/liquidacion_parametros').vigenciaDe('2026-10').afp };
    const mes = L.mesBase(t, '2026-10');
    const res = E.calcular({ trabajador: t, mes, periodo: '2026-10' }, v);
    const g = await m.datos.guardarMes(s.cuenta, t.id, '2026-10', Object.assign({}, mes, { calculo: L.resumen(res, v, t) }));
    assert.ok(g.ok, JSON.stringify(g));
    return Object.assign({ tid: t.id, liquido: res.liquido }, s);
}
const tokenDe = (enlace) => new URL(enlace).searchParams.get('t');

caso('crear el enlace exige la cabecera del asistente y la liquidación guardada', async () => {
    const m = montar();
    const s = await conLiquidacion(m, 'ana@ejemplo.cl');
    const q = { ruta: 'enlace-liquidacion', trabajador: s.tid, periodo: '2026-10' };
    assert.strictEqual((await pedir(m.rutas, { metodo: 'POST', query: q, headers: { cookie: s.cookie } })).statusCode, 403);
    assert.strictEqual((await pedir(m.rutas, { metodo: 'POST', query: { ...q, periodo: '2026-09' }, headers: { ...ESCRIBIR, cookie: s.cookie } })).json.codigo, 'sin_mes');
    const r = await pedir(m.rutas, { metodo: 'POST', query: q, headers: { ...ESCRIBIR, cookie: s.cookie } });
    assert.strictEqual(r.statusCode, 200);
    assert.ok(/^https:\/\/calculolaboral\.cl\/api\/pyme\/liquidacion\?t=[A-Za-z0-9_-]{43}$/.test(r.json.enlace), r.json.enlace);
    assert.strictEqual(r.json.vence, new Date(m.reloj.t + 60 * DIA).toISOString());
    assert.ok(!JSON.stringify(m.almacen._estado.enlaces).includes(tokenDe(r.json.enlace)), 'en la base queda solo la huella');
});

caso('la página pública muestra la liquidación armada en el servidor, sin scripts, escapada y no indexable; registra las aperturas', async () => {
    const m = montar();
    const s = await conLiquidacion(m, 'ana@ejemplo.cl');
    const { json } = await pedir(m.rutas, { metodo: 'POST', query: { ruta: 'enlace-liquidacion', trabajador: s.tid, periodo: '2026-10' }, headers: { ...ESCRIBIR, cookie: s.cookie } });
    const p = await pedir(m.rutas, { query: { ruta: 'liquidacion', t: tokenDe(json.enlace) } });
    assert.strictEqual(p.statusCode, 200);
    assert.ok(/default-src 'none'/.test(p.headers['content-security-policy']) && !/script-src/.test(p.headers['content-security-policy']));
    assert.ok(/noindex/.test(p.headers['x-robots-tag']) && p.headers['cache-control'] === 'no-store');
    assert.ok(!/<script/i.test(p.cuerpo));
    assert.ok(p.cuerpo.includes('Ana Pérez &lt;b&gt;González&lt;/b&gt;'), 'el nombre se escapa');
    assert.ok(p.cuerpo.includes('$' + Math.round(s.liquido).toLocaleString('es-CL')), 'trae el líquido calculado');
    assert.ok(/Panadería La Espiga/.test(p.cuerpo));
    m.reloj.t += DIA;
    await pedir(m.rutas, { query: { ruta: 'liquidacion', t: tokenDe(json.enlace) } });
    const l = await pedir(m.rutas, { query: { ruta: 'enlaces-liquidacion', periodo: '2026-10' }, headers: { cookie: s.cookie } });
    assert.deepStrictEqual([l.json.enlaces.length, l.json.enlaces[0].vistas, l.json.enlaces[0].primeraVista, l.json.enlaces[0].ultimaVista], [1, 2, '2026-10-20T15:00:00.000Z', '2026-10-21T15:00:00.000Z']);
});

caso('un enlace nuevo reemplaza al anterior; anular, vencer o borrar al trabajador lo deja sin efecto', async () => {
    const m = montar();
    const s = await conLiquidacion(m, 'ana@ejemplo.cl');
    const crearE = async () => (await pedir(m.rutas, { metodo: 'POST', query: { ruta: 'enlace-liquidacion', trabajador: s.tid, periodo: '2026-10' }, headers: { ...ESCRIBIR, cookie: s.cookie } })).json.enlace;
    const ver = async (e) => (await pedir(m.rutas, { query: { ruta: 'liquidacion', t: tokenDe(e) } })).statusCode;
    const e1 = await crearE(), e2 = await crearE();
    assert.deepStrictEqual([await ver(e1), await ver(e2)], [404, 200]);
    assert.strictEqual((await pedir(m.rutas, { metodo: 'DELETE', query: { ruta: 'enlace-liquidacion', trabajador: s.tid, periodo: '2026-10' }, headers: { ...ESCRIBIR, cookie: s.cookie } })).statusCode, 200);
    assert.strictEqual(await ver(e2), 404);
    const e3 = await crearE();
    m.reloj.t += 61 * DIA;
    assert.strictEqual(await ver(e3), 404, 'vencido a los 60 días');
    m.reloj.t -= 61 * DIA;
    await m.datos.borrarTrabajador(s.cuenta, s.tid);
    assert.strictEqual(await ver(e3), 404);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'liquidacion', t: 'x' } })).statusCode, 404);
});

caso('otra cuenta no puede crear ni anular enlaces de mis trabajadores', async () => {
    const m = montar();
    const s = await conLiquidacion(m, 'ana@ejemplo.cl');
    const o = await m.entrar('otra@ejemplo.cl');
    await m.datos.guardarEmpresa(o.cuenta, { razonSocial: 'Otra', rut: rutValido(76111333) });
    const q = { trabajador: s.tid, periodo: '2026-10' };
    assert.strictEqual((await pedir(m.rutas, { metodo: 'POST', query: { ruta: 'enlace-liquidacion', ...q }, headers: { ...ESCRIBIR, cookie: o.cookie } })).statusCode, 409);
    await pedir(m.rutas, { metodo: 'POST', query: { ruta: 'enlace-liquidacion', ...q }, headers: { ...ESCRIBIR, cookie: s.cookie } });
    assert.strictEqual((await pedir(m.rutas, { metodo: 'DELETE', query: { ruta: 'enlace-liquidacion', ...q }, headers: { ...ESCRIBIR, cookie: o.cookie } })).statusCode, 404);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'enlaces-liquidacion', periodo: '2026-10' }, headers: { cookie: o.cookie } })).json.enlaces.length, 0);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
