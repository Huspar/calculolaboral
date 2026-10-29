// Pruebas de los avisos por correo del Asistente Pyme (sin base ni correo reales): node tools/test_pyme_avisos.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Av = require('../api/_pyme/avisos');
const P = require('../js/liquidacion_parametros');
const F = require('../js/feriados_cl');
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
const rutValido = (c) => { let s = 0, m = 2; for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };
const EMPRESA = { razonSocial: 'Panadería La Espiga Ltda.', rut: rutValido(76845123), representante: 'Manuel Lagos' };

function montar(env, conPiloto) {
    const reloj = { t: Date.parse('2026-10-20T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const accesos = [], correos = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { accesos.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t, piloto: conPiloto ? require('../api/_pyme/piloto').crear({}, () => reloj.t) : undefined });
    const avisos = Av.crear({ almacen, datos, secreto, siteUrl: SITIO, ahora: () => reloj.t, P, F, enviar: async m => { correos.push(m); } });
    const rutas = crearRutas({ auth, datos, env: Object.assign({ VERCEL_ENV: 'production' }, env), siteUrl: SITIO, avisos });
    let ip = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + (++ip) });
        const token = new URL(accesos[accesos.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cuenta: await auth.leerSesion(r.sesion.token), cookie: 'cl_pyme=' + r.sesion.token };
    }
    return { reloj, almacen, datos, avisos, rutas, entrar, correos };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
const ESCRIBIR = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };

// Cuenta con un plazo fijo que vence en 5 días (aviso urgente) y otra sin avisos activos
async function conAviso(m, correo, activar) {
    const s = await m.entrar(correo);
    await m.datos.guardarEmpresa(s.cuenta, EMPRESA);
    await m.datos.crearTrabajador(s.cuenta, { nombre: 'Ana Pérez', rut: rutValido(15234567), fechaIngreso: '2026-04-01', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-25', sueldoBase: 650000, karinEntrega: '2026-04-01' });
    if (activar) await m.datos.guardarAvisosCorreo(s.cuenta, true);
    return s;
}

caso('la preferencia viene apagada y se cambia con su ruta (con la cabecera del asistente)', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    assert.deepStrictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-correo' }, headers: { cookie } })).json.activo, false);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-correo' }, metodo: 'PUT', headers: { cookie }, body: { activo: true } })).statusCode, 403);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-correo' }, metodo: 'PUT', headers: { ...ESCRIBIR, cookie }, body: { activo: 'si' } })).statusCode, 400);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-correo' }, metodo: 'PUT', headers: { ...ESCRIBIR, cookie }, body: { activo: true } })).json.activo, true);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-correo' }, headers: { cookie } })).json.activo, true);
});

caso('la tarea diaria manda un correo con los avisos urgentes o importantes, solo a quien los activó, y no repite antes de 7 días', async () => {
    const m = montar();
    await conAviso(m, 'ana@ejemplo.cl', true);
    await conAviso(m, 'bruno@ejemplo.cl', false);
    let r = await m.avisos.correr();
    assert.deepStrictEqual([r.revisadas, r.enviados, r.errores], [1, 1, 0]);
    const c = m.correos[0];
    assert.strictEqual(c.to, 'ana@ejemplo.cl');
    assert.ok(/aviso urgente/.test(c.asunto), c.asunto);
    assert.ok(/plazo fijo vence/.test(c.texto) && /Panadería La Espiga/.test(c.html));
    assert.ok(/\/api\/pyme\/avisos-baja\?t=/.test(c.html) && /no reemplazan revisar los plazos/.test(c.texto));
    assert.ok(!/respaldo/i.test(c.texto), 'los avisos informativos no van por correo');
    assert.strictEqual(c.clave, 'pyme-avisos-' + m.almacen._estado.avisos[0].cuentaId + '-2026-10-20');
    // el mismo día y a los 3 días: nada nuevo
    assert.strictEqual((await m.avisos.correr()).enviados, 0);
    m.reloj.t += 3 * DIA;
    assert.strictEqual((await m.avisos.correr()).enviados, 0);
});

caso('sin avisos urgentes o importantes no se manda nada', async () => {
    const m = montar();
    const s = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(s.cuenta, EMPRESA);
    await m.datos.crearTrabajador(s.cuenta, { nombre: 'Ana Pérez', rut: rutValido(15234567), fechaIngreso: '2022-03-15', sueldoBase: 650000, karinEntrega: '2024-08-01' });
    await m.datos.guardarAvisosCorreo(s.cuenta, true);
    assert.deepStrictEqual(await m.avisos.correr(), { revisadas: 1, enviados: 0, errores: 0 });
});

caso('la ruta de la tarea exige CRON_SECRET: sin ella está desactivada y con una clave equivocada no corre', async () => {
    const sin = montar();
    assert.strictEqual((await pedir(sin.rutas, { query: { ruta: 'avisos-cron' } })).statusCode, 503);
    const m = montar({ CRON_SECRET: 'clave-de-prueba-larga' });
    await conAviso(m, 'ana@ejemplo.cl', true);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-cron' }, headers: { authorization: 'Bearer otra' } })).statusCode, 401);
    assert.strictEqual(m.correos.length, 0);
    const r = await pedir(m.rutas, { query: { ruta: 'avisos-cron' }, headers: { authorization: 'Bearer clave-de-prueba-larga' } });
    assert.deepStrictEqual([r.statusCode, r.json.enviados], [200, 1]);
});

caso('baja desde el correo: el enlace firmado pide confirmar y apaga los avisos; uno alterado no sirve', async () => {
    const m = montar();
    await conAviso(m, 'ana@ejemplo.cl', true);
    await m.avisos.correr();
    const t = new URL(/href="([^"]*avisos-baja[^"]*)"/.exec(m.correos[0].html)[1].replace(/&amp;/g, '&')).searchParams.get('t');
    const g = await pedir(m.rutas, { query: { ruta: 'avisos-baja', t } });
    assert.ok(g.statusCode === 200 && /Dejar de recibirlos/.test(g.cuerpo));
    assert.strictEqual(m.almacen._estado.avisos[0].activo, true, 'abrir el enlace no apaga nada');
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'avisos-baja', t: t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A') } })).statusCode, 400);
    const p = await pedir(m.rutas, { metodo: 'POST', query: { ruta: 'avisos-baja' }, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITIO }, body: { t } });
    assert.ok(p.statusCode === 200 && /Ya no te enviaremos/.test(p.cuerpo));
    assert.strictEqual(m.almacen._estado.avisos[0].activo, false);
    assert.strictEqual((await m.avisos.correr()).revisadas, 0);
});

caso('a los 7 días el aviso que sigue pendiente se vuelve a mandar; borrar la cuenta borra la preferencia', async () => {
    const m = montar();
    const s = await conAviso(m, 'ana@ejemplo.cl', true);
    await m.datos.actualizarTrabajador(s.cuenta, (await m.datos.estado(s.cuenta)).trabajadores[0].id, Object.assign({}, (await m.datos.estado(s.cuenta)).trabajadores[0], { fechaTerminoPlazo: '2026-11-15', id: undefined }));
    await m.avisos.correr();
    m.reloj.t += 7 * DIA;
    assert.strictEqual((await m.avisos.correr()).enviados, 1);
    assert.ok((await m.datos.borrarCuenta(s.cuenta, 'ana@ejemplo.cl')).ok);
    assert.strictEqual(m.almacen._estado.avisos.length, 0);
});

caso('con varias empresas va un solo correo con los avisos de todas, cada uno con su empresa, y no se repite', async () => {
    const m = montar(undefined, true);
    const s = await conAviso(m, 'estudio@ejemplo.cl', true);
    const otra = await m.datos.crearEmpresa(s.cuenta, { razonSocial: 'Ferretería El Clavo SpA', rut: rutValido(76111222) });
    assert.ok(otra.ok);
    await m.datos.crearTrabajador(Object.assign({}, s.cuenta, { empresaId: otra.empresaId }), { nombre: 'Luis Soto', rut: rutValido(12345678), fechaIngreso: '2026-04-01', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-26', sueldoBase: 650000, afp: 'Habitat' });
    const r = await m.avisos.correr();
    assert.strictEqual(r.enviados, 1);
    assert.strictEqual(m.correos.length, 1);
    const c = m.correos[0];
    assert.match(c.texto, /\[Panadería La Espiga Ltda\.\] .*Ana Pérez/s);
    assert.match(c.texto, /\[Ferretería El Clavo SpA\] .*Luis Soto/s);
    assert.match(c.texto, /Avisos de tus 2 empresas/);
    assert.strictEqual((await m.avisos.correr()).enviados, 0, 'el mismo día no se repite');
    m.reloj.t += 7 * DIA;
    assert.strictEqual((await m.avisos.correr()).enviados, 1, 'a los 7 días vuelve');
});

caso('una sola empresa: los ids y el texto no cambian (no se reenvía nada tras la actualización)', async () => {
    const m = montar();
    await conAviso(m, 'uno@ejemplo.cl', true);
    await m.avisos.correr();
    const ids = Object.keys(m.almacen._estado.avisos[0].enviados);
    assert.ok(ids.length && ids.every(id => !/^[0-9a-f-]{36}:/.test(id)));
    assert.doesNotMatch(m.correos[0].texto, /\[Panadería/);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
