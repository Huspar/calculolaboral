// Pruebas del piloto gratuito y de las opiniones de los usuarios (sin base ni correo reales): node tools/test_pyme_piloto.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Pi = require('../api/_pyme/piloto');
const Pase = require('../api/_pyme/pase');
const Co = require('../api/_pyme/comentarios');
const Rut = require('../js/rut_cl');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 6).join('\n         ')); process.exitCode = 1; }
    });
}
const SITIO = 'https://calculolaboral.cl', DIA = 86400000;
const ESCRIBIR = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
const rutValido = (c) => { let s = 0, m = 2; for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };
const trabajador = (n) => ({ nombre: 'Persona ' + n, rut: rutValido(15000000 + n * 11), fechaIngreso: '2026-01-05', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 560000, afp: 'Modelo', salud: 'fonasa' });

function montar(env) {
    const reloj = { t: Date.parse('2026-10-20T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const accesos = [], correos = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { accesos.push(m); } });
    const piloto = Pi.crear(env || {}, () => reloj.t);
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t, piloto });
    const flow = { createPayment: async () => ({}), signUnlock: (p, o) => 'firma-' + p + '-' + o };
    const pase = Pase.crear({ almacen, productos: {}, flow, venta: () => false, ahora: () => reloj.t, piloto });
    const comentarios = Co.crear({ almacen, destino: ['contacto@calculolaboral.cl'], ahora: () => reloj.t, enviar: async (m) => { correos.push(m); } });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, pase, comentarios });
    let ip = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + (++ip) });
        const token = new URL(accesos[accesos.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cuenta: await auth.leerSesion(r.sesion.token), cookie: 'cl_pyme=' + r.sesion.token };
    }
    return { reloj, almacen, datos, pase, rutas, correos, entrar };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
async function conEmpresa(m, correo) {
    const s = await m.entrar(correo);
    assert.ok((await m.datos.guardarEmpresa(s.cuenta, { razonSocial: 'Panadería La Espiga Ltda.', rut: rutValido(76845123), representante: 'Manuel Lagos' })).ok);
    return s;
}
const altas = async (m, s, n) => { const r = []; for (let i = 1; i <= n; i++) r.push(await m.datos.crearTrabajador(s.cuenta, trabajador(i))); return r; };

caso('el piloto vence el 31-dic-2026 a las 23:59:59 de Chile y se puede cerrar antes con PYME_PILOTO_FIN=1', () => {
    assert.strictEqual(Pi.VENCE, '2027-01-01T02:59:59.000Z');
    const fechaChile = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(Pi.VENCE));
    assert.strictEqual(fechaChile, '2026-12-31, 23:59');
    const en = (iso, env) => Pi.crear(env || {}, () => Date.parse(iso)).activo();
    assert.deepStrictEqual([en('2026-10-14T12:00:00Z'), en('2027-01-01T02:59:58Z'), en('2027-01-01T03:00:00Z'), en('2026-10-14T12:00:00Z', { PYME_PILOTO_FIN: '1' })], [true, true, false, false]);
});

caso('durante el piloto toda cuenta tiene el cupo de 50 y el estado lo dice (sin pago)', async () => {
    const m = montar();
    const s = await conEmpresa(m, 'ana@ejemplo.cl');
    const lista = await altas(m, s, 50);
    assert.ok(lista.every(r => r.ok), JSON.stringify(lista.find(r => !r.ok)));
    const extra = await m.datos.crearTrabajador(s.cuenta, trabajador(51));
    assert.deepStrictEqual([extra.ok, extra.codigo], [false, 'limite']);
    assert.ok(/hasta 50/.test(extra.error), extra.error);
    const est = await m.datos.estado(s.cuenta);
    assert.deepStrictEqual(est.limites, { maxActivos: 50, paseVence: Pi.VENCE, paseProducto: 'pyme12', piloto: true, pilotoHasta: '2026-12-31' });
});

caso('al terminar el piloto, o si se cierra antes, la cuenta vuelve a 1 trabajador activo', async () => {
    for (const [nombre, m, avanzar] of [['por fecha', montar(), true], ['por PYME_PILOTO_FIN', montar({ PYME_PILOTO_FIN: '1' }), false]]) {
        const s = await conEmpresa(m, 'ana@ejemplo.cl');
        if (avanzar) m.reloj.t = Date.parse('2027-01-02T12:00:00Z');
        const est = await m.datos.estado(s.cuenta);
        assert.deepStrictEqual(est.limites, { maxActivos: 1, paseVence: null, paseProducto: null }, nombre);
        assert.ok((await m.datos.crearTrabajador(s.cuenta, trabajador(1))).ok, nombre);
        assert.strictEqual((await m.datos.crearTrabajador(s.cuenta, trabajador(2))).codigo, 'limite', nombre);
    }
});

caso('un pase pagado que dura más que el piloto manda; uno más corto no le quita el piloto', async () => {
    const m = montar();
    const s = await conEmpresa(m, 'ana@ejemplo.cl');
    await m.almacen.registrarPase({ cuentaId: s.cuenta.cuentaId, producto: 'pyme3', ordenFlow: 'O1', dias: 30, ahoraIso: new Date(m.reloj.t).toISOString() });
    let est = await m.datos.estado(s.cuenta);
    assert.deepStrictEqual([est.limites.piloto, est.limites.paseVence], [true, Pi.VENCE], 'el pase de 30 días termina antes que el piloto');
    await m.almacen.registrarPase({ cuentaId: s.cuenta.cuentaId, producto: 'pyme12', ordenFlow: 'O2', dias: 365, ahoraIso: new Date(m.reloj.t).toISOString() });
    est = await m.datos.estado(s.cuenta);
    assert.strictEqual(est.limites.piloto, undefined, 'el pase largo gana');
    assert.strictEqual(est.limites.paseProducto, 'pyme3', 'el pase de 12 meses empieza cuando termina el de 3 (así funciona hoy)');
    assert.ok(Date.parse(est.limites.paseVence) > Date.parse(Pi.VENCE));
});

caso('el desbloqueo de generadores cuenta el piloto como pase de 12 meses y deja de valer al terminar', async () => {
    const m = montar();
    const s = await conEmpresa(m, 'ana@ejemplo.cl');
    for (const p of ['contrato', 'finiquito']) {
        const r = await m.pase.desbloqueo(s.cuenta, p);
        assert.ok(r.ok && /^firma-/.test(r.desbloqueo), p);
    }
    m.reloj.t = Date.parse('2027-01-02T12:00:00Z');
    const r = await m.pase.desbloqueo(s.cuenta, 'contrato');
    assert.deepStrictEqual([r.ok, r.codigo], [false, 'sin_pase']);
});

caso('opinión: se valida, se guarda y avisa a contacto@; el correo de la persona solo sale si marcó «puedes escribirme»', async () => {
    const m = montar();
    const s = await conEmpresa(m, 'ana@ejemplo.cl');
    const q = { ruta: 'comentario' };
    assert.strictEqual((await pedir(m.rutas, { metodo: 'POST', query: q, headers: { cookie: s.cookie }, body: {} })).statusCode, 403, 'exige el encabezado del asistente');
    assert.strictEqual((await pedir(m.rutas, { metodo: 'POST', query: q, headers: ESCRIBIR, body: {} })).statusCode, 401, 'exige sesión');
    assert.strictEqual((await pedir(m.rutas, { query: q, headers: { cookie: s.cookie } })).statusCode, 405);
    const enviar = (c) => pedir(m.rutas, { metodo: 'POST', query: q, headers: { ...ESCRIBIR, cookie: s.cookie }, body: { comentario: c } });
    for (const malo of [{}, { tipo: 'raro', texto: 'hola mundo' }, { tipo: 'funciona', texto: 'hey' }, { tipo: 'funciona', texto: 'x'.repeat(2001) }, { tipo: 'funciona', texto: 12345678 }]) {
        const r = await enviar(malo);
        assert.deepStrictEqual([r.statusCode, r.json.codigo], [400, 'validacion'], JSON.stringify(malo).slice(0, 40));
    }
    assert.strictEqual(m.almacen._estado.comentarios.length, 0);
    const r1 = await enviar({ tipo: 'sugerencia', texto: 'Me gustaría <b>subir</b> la nómina al banco', pantalla: 'liquidaciones', contacto: false });
    assert.strictEqual(r1.statusCode, 200);
    const c1 = m.correos[0];
    assert.deepStrictEqual(c1.to, ['contacto@calculolaboral.cl']);
    assert.strictEqual(c1.reply_to, undefined);
    assert.ok(/Qué agregarían/.test(c1.asunto) && /liquidaciones/.test(c1.asunto));
    assert.ok(!c1.texto.includes('ana@ejemplo.cl') && !c1.html.includes('ana@ejemplo.cl'), 'sin contacto no se muestra el correo');
    assert.ok(c1.html.includes('&lt;b&gt;subir&lt;/b&gt;') && !c1.html.includes('<b>subir'), 'el texto se escapa');
    await enviar({ tipo: 'no_funciona', texto: 'El botón de imprimir no responde', pantalla: 'Mala Pantalla!', contacto: true });
    const c2 = m.correos[1];
    assert.strictEqual(c2.reply_to, 'ana@ejemplo.cl');
    assert.ok(c2.texto.includes('ana@ejemplo.cl'));
    assert.strictEqual(m.almacen._estado.comentarios[1].pantalla, '', 'una pantalla con caracteres raros se descarta');
    assert.strictEqual(m.almacen._estado.comentarios.length, 2);
});

caso('opinión: máximo 5 por cuenta en 24 horas; un correo caído no pierde la opinión; borrar la cuenta la borra', async () => {
    const m = montar();
    const s = await conEmpresa(m, 'ana@ejemplo.cl');
    const co = Co.crear({ almacen: m.almacen, destino: ['x@y.cl'], ahora: () => m.reloj.t, enviar: async () => { throw new Error('Resend 500'); } });
    for (let i = 0; i < 5; i++) assert.ok((await co.guardar(s.cuenta, { tipo: 'funciona', texto: 'Todo bien número ' + i })).ok);
    const sexta = await co.guardar(s.cuenta, { tipo: 'funciona', texto: 'Todo bien número 5' });
    assert.deepStrictEqual([sexta.ok, sexta.estado, sexta.codigo], [false, 429, 'limite_comentarios']);
    assert.strictEqual(m.almacen._estado.comentarios.length, 5, 'el correo caído no impidió guardar');
    m.reloj.t += DIA + 1000;
    assert.ok((await co.guardar(s.cuenta, { tipo: 'otro', texto: 'Pasó un día completo' })).ok);
    const otra = await m.entrar('otra@ejemplo.cl');
    assert.ok((await co.guardar(otra.cuenta, { tipo: 'otro', texto: 'Otra cuenta, otro cupo' })).ok);
    assert.ok((await m.datos.borrarCuenta(s.cuenta, 'ana@ejemplo.cl')).ok);
    assert.deepStrictEqual(m.almacen._estado.comentarios.map(c => c.cuentaId), [otra.cuenta.cuentaId]);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
