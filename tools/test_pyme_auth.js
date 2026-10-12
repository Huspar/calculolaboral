// Pruebas de las cuentas del Asistente Pyme (sin base de datos ni correo): node tools/test_pyme_auth.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const H = require('../api/_pyme/http');
const C = require('../api/_pyme/correo');
const T = require('../api/_pyme/tokens');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n         ')); process.exitCode = 1; }
    });
}

const SITIO = 'https://calculolaboral.cl';
const SECRETO = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
const MIN = 60000, HORA = 3600000, DIA = 86400000;

function montar(inicio) {
    const reloj = { t: inicio || Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const enviados = [];
    const auth = A.crear({
        almacen, secreto: SECRETO, siteUrl: SITIO, ahora: () => reloj.t,
        enviarCorreo: async (m) => { enviados.push(m); }
    });
    const tokenDe = (m) => new URL(m.enlace).searchParams.get('t');
    return { reloj, almacen, enviados, auth, tokenDe };
}

// ---------- auth ----------
console.log('Entrar con enlace');
caso('envía el enlace al correo en minúsculas, con un token de 43 caracteres, y guarda solo su huella', async () => {
    const m = montar();
    const r = await m.auth.solicitarAcceso({ email: '  Ana.Perez@Ejemplo.CL ', ip: '200.1.2.3' });
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(m.enviados.length, 1);
    assert.strictEqual(m.enviados[0].to, 'ana.perez@ejemplo.cl');
    const token = m.tokenDe(m.enviados[0]);
    assert.ok(T.tokenValido(token));
    assert.ok(m.enviados[0].enlace.startsWith(SITIO + '/api/pyme/verificar?t='));
    const guardado = JSON.stringify(m.almacen._estado);
    assert.ok(guardado.indexOf(token) < 0, 'el token aparece en claro en la base');
    assert.ok(guardado.indexOf(T.huellaToken(SECRETO, 'acceso', token)) >= 0);
    assert.strictEqual(m.enviados[0].vence.getTime() - m.reloj.t, 15 * MIN);
});
caso('rechaza correos mal escritos sin enviar nada', async () => {
    const m = montar();
    for (const v of [undefined, null, '', '   ', 'sin-arroba', 'a@b', 'a b@c.cl', 'a@b.c', '<x>@y.cl', 'a@b.cl,c@d.cl', 'x'.repeat(250) + '@e.cl', 42, {}]) {
        const r = await m.auth.solicitarAcceso({ email: v, ip: '1.1.1.1' });
        assert.deepStrictEqual(r, { ok: false, motivo: 'correo' }, String(v));
    }
    assert.strictEqual(m.enviados.length, 0);
});
caso('responde igual para un correo con cuenta y uno sin cuenta (no revela quién tiene cuenta)', async () => {
    const m = montar();
    await m.almacen.upsertCuenta('existe@ejemplo.cl', m.reloj.t, new Date(m.reloj.t).toISOString());
    const a = await m.auth.solicitarAcceso({ email: 'existe@ejemplo.cl', ip: '1.1.1.1' });
    const b = await m.auth.solicitarAcceso({ email: 'nuevo@ejemplo.cl', ip: '1.1.1.2' });
    assert.deepStrictEqual(a, b);
    assert.strictEqual(m.enviados.length, 2);
});
caso('límite por correo: 5 enlaces por hora; el sexto no se envía pero responde igual; la hora siguiente se reinicia', async () => {
    const m = montar();
    for (let i = 0; i < 5; i++) assert.deepStrictEqual(await m.auth.solicitarAcceso({ email: 'a@ejemplo.cl', ip: '1.1.1.' + i }), { ok: true });
    assert.strictEqual(m.enviados.length, 5);
    assert.deepStrictEqual(await m.auth.solicitarAcceso({ email: 'a@ejemplo.cl', ip: '1.1.1.9' }), { ok: true });
    assert.strictEqual(m.enviados.length, 5, 'no debió enviar el sexto');
    m.reloj.t += HORA;
    await m.auth.solicitarAcceso({ email: 'a@ejemplo.cl', ip: '1.1.1.9' });
    assert.strictEqual(m.enviados.length, 6);
});
caso('límite por IP: 20 solicitudes por hora; la 21 se rechaza con "limite"', async () => {
    const m = montar();
    for (let i = 0; i < 20; i++) assert.deepStrictEqual(await m.auth.solicitarAcceso({ email: `u${i}@ejemplo.cl`, ip: '9.9.9.9' }), { ok: true });
    assert.deepStrictEqual(await m.auth.solicitarAcceso({ email: 'u21@ejemplo.cl', ip: '9.9.9.9' }), { ok: false, motivo: 'limite' });
    assert.deepStrictEqual(await m.auth.solicitarAcceso({ email: 'u21@ejemplo.cl', ip: '9.9.9.8' }), { ok: true });
    assert.strictEqual(m.enviados.length, 21);
});
caso('previsualizar no consume el token y muestra el correo enmascarado', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'ana.perez@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    for (let i = 0; i < 3; i++) {
        const p = await m.auth.previsualizar(token);
        assert.deepStrictEqual(p, { valido: true, correoEnmascarado: 'a***@e***.cl', requiereAceptar: true });
    }
    assert.ok((await m.auth.completar({ token, acepto: true, ip: '1.1.1.1' })).ok);
});
caso('enmascarar: a***@d***.tld', () => {
    assert.strictEqual(A.enmascarar('ana@ejemplo.cl'), 'a***@e***.cl');
    assert.strictEqual(A.enmascarar('x@y.co.uk'), 'x***@y***.uk');
});
caso('cuenta nueva: sin aceptar la cláusula no entra y el token sigue sirviendo; al aceptar entra y queda registrado', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'nuevo@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    for (const a of [undefined, false, '', 'no', 0]) assert.deepStrictEqual(await m.auth.completar({ token, acepto: a, ip: '1.1.1.1' }), { ok: false, motivo: 'aceptar' });
    assert.strictEqual(m.almacen._estado.cuentas.length, 0, 'no debe crear la cuenta sin aceptación');
    const r = await m.auth.completar({ token, acepto: true, ip: '1.1.1.1' });
    assert.ok(r.ok && T.tokenValido(r.sesion.token));
    assert.strictEqual(m.almacen._estado.cuentas.length, 1);
    assert.ok(m.almacen._estado.cuentas[0].aceptoEncargo);
    assert.strictEqual(r.sesion.vence - m.reloj.t, 30 * DIA);
});
caso('cuenta que ya aceptó: entra sin volver a aceptar y conserva la fecha de la primera aceptación', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    await m.auth.completar({ token: m.tokenDe(m.enviados[0]), acepto: true, ip: '1.1.1.1' });
    const primera = m.almacen._estado.cuentas[0].aceptoEncargo;
    m.reloj.t += 3 * DIA;
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const token2 = m.tokenDe(m.enviados[1]);
    assert.strictEqual((await m.auth.previsualizar(token2)).requiereAceptar, false);
    assert.ok((await m.auth.completar({ token: token2, ip: '1.1.1.1' })).ok);
    assert.strictEqual(m.almacen._estado.cuentas.length, 1);
    assert.strictEqual(m.almacen._estado.cuentas[0].aceptoEncargo, primera);
});
caso('el enlace sirve una sola vez, también con dos solicitudes simultáneas', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    const [x, y] = await Promise.all([m.auth.completar({ token, acepto: true, ip: '1.1.1.1' }), m.auth.completar({ token, acepto: true, ip: '2.2.2.2' })]);
    assert.strictEqual([x, y].filter(r => r.ok).length, 1);
    assert.deepStrictEqual(await m.auth.completar({ token, acepto: true, ip: '1.1.1.1' }), { ok: false, motivo: 'invalido' });
    assert.strictEqual(m.almacen._estado.sesiones.length, 1);
});
caso('el enlace vence a los 15 minutos', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    m.reloj.t += 15 * MIN - 1;
    assert.strictEqual((await m.auth.previsualizar(token)).valido, true);
    m.reloj.t += 2;
    assert.strictEqual((await m.auth.previsualizar(token)).valido, false);
    assert.deepStrictEqual(await m.auth.completar({ token, acepto: true, ip: '1.1.1.1' }), { ok: false, motivo: 'invalido' });
});
caso('tokens inventados o mal formados no entran', async () => {
    const m = montar();
    for (const t of [undefined, '', 'abc', T.nuevoToken(), 'x'.repeat(43), "' OR 1=1 --", 123]) {
        assert.deepStrictEqual(await m.auth.completar({ token: t, acepto: true, ip: '1.1.1.1' }), { ok: false, motivo: 'invalido' });
        assert.deepStrictEqual(await m.auth.previsualizar(t), { valido: false });
    }
});

console.log('Sesión');
async function conSesion(m, correo) {
    await m.auth.solicitarAcceso({ email: correo || 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const r = await m.auth.completar({ token: m.tokenDe(m.enviados[m.enviados.length - 1]), acepto: true, ip: '1.1.1.1' });
    return r.sesion;
}
caso('la sesión identifica la cuenta; una cookie falsa o vacía no', async () => {
    const m = montar();
    const s = await conSesion(m);
    const ok1 = await m.auth.leerSesion(s.token);
    assert.strictEqual(ok1.autenticado, true);
    assert.strictEqual(ok1.email, 'ana@ejemplo.cl');
    for (const t of [undefined, '', 'basura', T.nuevoToken()]) assert.deepStrictEqual(await m.auth.leerSesion(t), { autenticado: false });
});
caso('un token de acceso no sirve como token de sesión', async () => {
    const m = montar();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const acceso = m.tokenDe(m.enviados[0]);
    assert.deepStrictEqual(await m.auth.leerSesion(acceso), { autenticado: false });
});
caso('la sesión dura 30 días y vence', async () => {
    const m = montar();
    const s = await conSesion(m);
    m.reloj.t += 30 * DIA - 1;
    assert.strictEqual((await m.auth.leerSesion(s.token)).autenticado, true); // aún vigente (y se renueva al leerla)
    const n = montar();
    const s2 = await conSesion(n);
    n.reloj.t += 30 * DIA + 1; // sin haberla usado en 30 días
    assert.strictEqual((await n.auth.leerSesion(s2.token)).autenticado, false);
});
caso('renovación: no antes de los 15 días; después se extiende a 30 desde ese momento', async () => {
    const m = montar();
    const s = await conSesion(m);
    m.reloj.t += 10 * DIA;
    assert.strictEqual((await m.auth.leerSesion(s.token)).renovada, undefined);
    m.reloj.t += 6 * DIA; // quedan 14 días
    const r = await m.auth.leerSesion(s.token);
    assert.ok(r.renovada);
    assert.strictEqual(r.renovada.vence - m.reloj.t, 30 * DIA);
    m.reloj.t += 29 * DIA;
    assert.strictEqual((await m.auth.leerSesion(s.token)).autenticado, true);
});
caso('cerrar sesión la revoca en el servidor aunque alguien conserve la cookie', async () => {
    const m = montar();
    const s = await conSesion(m);
    await m.auth.cerrar(s.token, '1.1.1.1');
    assert.deepStrictEqual(await m.auth.leerSesion(s.token), { autenticado: false });
    assert.deepStrictEqual(await m.auth.cerrar('basura', '1.1.1.1'), { ok: true });
});
caso('la base no guarda tokens en claro, ni correos en intentos y auditoría, ni IP en claro', async () => {
    const m = montar();
    const s = await conSesion(m, 'privado@ejemplo.cl');
    await m.auth.cerrar(s.token, '203.0.113.7');
    const e = m.almacen._estado;
    const todo = JSON.stringify(e);
    assert.ok(todo.indexOf(s.token) < 0);
    assert.ok(todo.indexOf(m.tokenDe(m.enviados[0])) < 0);
    assert.ok(JSON.stringify([e.intentos, e.auditoria]).indexOf('privado@ejemplo.cl') < 0, 'correo en intentos o auditoría');
    assert.ok(JSON.stringify(e).indexOf('203.0.113.7') < 0 && JSON.stringify(e).indexOf('1.1.1.1') < 0, 'IP en claro');
    assert.ok(e.auditoria.length >= 3);
    assert.ok(e.auditoria.every(a => /^[0-9a-f]{64}$/.test(a.ipHash)));
});

// ---------- rutas ----------
console.log('Rutas');
function pedir(rutas, opciones) {
    const req = { method: opciones.metodo || 'GET', query: opciones.query || {}, headers: opciones.headers || {}, body: opciones.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => res);
}
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
function montarRutas() {
    const m = montar();
    const rutas = crearRutas({ auth: m.auth, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO });
    return Object.assign(m, { rutas });
}
const cookieDe = res => (res.headers['set-cookie'] || '').split(';')[0].split('=')[1];

caso('entrar: exige el encabezado propio, JSON y origen del sitio', async () => {
    const m = montarRutas();
    const base = { query: { ruta: 'entrar' }, metodo: 'POST', body: { email: 'ana@ejemplo.cl' } };
    for (const headers of [{}, { 'content-type': 'application/json' }, { 'x-cl-pyme': '1' }, { ...JSON_OK, origin: 'https://sitio-malo.com' }, { ...JSON_OK, 'content-type': 'application/x-www-form-urlencoded' }]) {
        const r = await pedir(m.rutas, { ...base, headers });
        assert.strictEqual(r.statusCode, 403, JSON.stringify(headers));
    }
    assert.strictEqual(m.enviados.length, 0);
    const bien = await pedir(m.rutas, { ...base, headers: JSON_OK });
    assert.strictEqual(bien.statusCode, 200);
    assert.strictEqual(m.enviados.length, 1);
});
caso('entrar: misma respuesta con o sin cuenta; error de formato 400; límite 429', async () => {
    const m = montarRutas();
    const pide = (email, ip) => pedir(m.rutas, { query: { ruta: 'entrar' }, metodo: 'POST', headers: { ...JSON_OK, 'cf-connecting-ip': ip }, body: { email } });
    const a = await pide('a@ejemplo.cl', '1.1.1.1'), b = await pide('b@ejemplo.cl', '1.1.1.2');
    assert.strictEqual(a.cuerpo, b.cuerpo);
    assert.strictEqual((await pide('malo', '1.1.1.3')).statusCode, 400);
    for (let i = 0; i < 20; i++) await pide(`z${i}@ejemplo.cl`, '5.5.5.5');
    assert.strictEqual((await pide('z99@ejemplo.cl', '5.5.5.5')).statusCode, 429);
    assert.ok(a.headers['cache-control'] === 'no-store');
});
caso('verificar (GET): muestra la confirmación con casilla, escapa el token y no consume nada', async () => {
    const m = montarRutas();
    await m.auth.solicitarAcceso({ email: 'ana.perez@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    const r = await pedir(m.rutas, { query: { ruta: 'verificar', t: token } });
    assert.strictEqual(r.statusCode, 200);
    assert.ok(r.cuerpo.indexOf('a***@e***.cl') >= 0);
    assert.ok(r.cuerpo.indexOf('name="acepto"') >= 0 && r.cuerpo.indexOf('required') >= 0);
    assert.ok(r.cuerpo.indexOf('ana.perez') < 0, 'no debe mostrar el correo completo');
    assert.ok(/noindex/.test(r.cuerpo) && r.headers['x-robots-tag'] === 'noindex, nofollow' && r.headers['referrer-policy'] === 'origin' && /name="referrer" content="origin"/.test(r.cuerpo));
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'verificar', t: token } })).statusCode, 200);
    const mala = await pedir(m.rutas, { query: { ruta: 'verificar', t: '"><script>alert(1)</script>' } });
    assert.strictEqual(mala.statusCode, 400);
    assert.ok(mala.cuerpo.indexOf('<script>') < 0);
});
caso('verificar (POST): sin aceptar vuelve a pedirlo; aceptando redirige al panel con la cookie de sesión', async () => {
    const m = montarRutas();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    const sin = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: { t: token } });
    assert.strictEqual(sin.statusCode, 400);
    assert.ok(sin.cuerpo.indexOf('debes aceptar') >= 0 && !sin.headers['set-cookie']);
    const con = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: { t: token, acepto: '1' } });
    assert.strictEqual(con.statusCode, 303);
    assert.strictEqual(con.headers.location, '/asistente-pyme');
    const ck = con.headers['set-cookie'];
    assert.ok(/^cl_pyme=[A-Za-z0-9_-]{43};/.test(ck) && /HttpOnly/.test(ck) && /Secure/.test(ck) && /SameSite=Lax/.test(ck) && /Path=\//.test(ck));
    assert.ok(/Max-Age=\d+/.test(ck) && Number(/Max-Age=(\d+)/.exec(ck)[1]) > 29 * 86400 - 5);
    assert.ok(con.headers.location.indexOf(token) < 0);
    const otra = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: { t: token, acepto: '1' } });
    assert.strictEqual(otra.statusCode, 400, 'el enlace ya se usó');
});
caso('verificar (POST) acepta el cuerpo de formulario como texto y rechaza otro origen', async () => {
    const m = montarRutas();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const token = m.tokenDe(m.enviados[0]);
    const ajeno = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: 'https://otro.com' }, body: { t: token, acepto: '1' } });
    assert.strictEqual(ajeno.statusCode, 403);
    const texto = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: `t=${token}&acepto=1` });
    assert.strictEqual(texto.statusCode, 303);
});
caso('sesión por cookie: autenticado con la cookie; sin ella no; renueva la cookie cerca del vencimiento', async () => {
    const m = montarRutas();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const login = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: { t: m.tokenDe(m.enviados[0]), acepto: '1' } });
    const cookie = 'otra=1; cl_pyme=' + cookieDe(login) + '; mas=2';
    const s = await pedir(m.rutas, { query: { ruta: 'sesion' }, headers: { cookie } });
    assert.deepStrictEqual(JSON.parse(s.cuerpo), { autenticado: true, email: 'ana@ejemplo.cl' });
    assert.ok(!s.headers['set-cookie']);
    assert.deepStrictEqual(JSON.parse((await pedir(m.rutas, { query: { ruta: 'sesion' } })).cuerpo), { autenticado: false });
    assert.deepStrictEqual(JSON.parse((await pedir(m.rutas, { query: { ruta: 'sesion' }, headers: { cookie: 'cl_pyme=falsa' } })).cuerpo), { autenticado: false });
    m.reloj.t += 20 * DIA;
    const renovada = await pedir(m.rutas, { query: { ruta: 'sesion' }, headers: { cookie } });
    assert.ok(/^cl_pyme=/.test(renovada.headers['set-cookie']));
});
caso('salir: borra la cookie, revoca la sesión y exige el encabezado propio', async () => {
    const m = montarRutas();
    await m.auth.solicitarAcceso({ email: 'ana@ejemplo.cl', ip: '1.1.1.1' });
    const login = await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'POST', headers: { origin: SITIO }, body: { t: m.tokenDe(m.enviados[0]), acepto: '1' } });
    const cookie = 'cl_pyme=' + cookieDe(login);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'salir' }, metodo: 'POST', headers: { cookie } })).statusCode, 403);
    const fuera = await pedir(m.rutas, { query: { ruta: 'salir' }, metodo: 'POST', headers: { ...JSON_OK, cookie } });
    assert.strictEqual(fuera.statusCode, 200);
    assert.ok(/Max-Age=0/.test(fuera.headers['set-cookie']));
    assert.deepStrictEqual(JSON.parse((await pedir(m.rutas, { query: { ruta: 'sesion' }, headers: { cookie } })).cuerpo), { autenticado: false });
});
caso('rutas desconocidas dan 404 y los métodos incorrectos 405', async () => {
    const m = montarRutas();
    for (const ruta of [undefined, '', 'admin', '__proto__', 'constructor', 'toString']) assert.strictEqual((await pedir(m.rutas, { query: { ruta } })).statusCode, 404, String(ruta));
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'entrar' }, metodo: 'GET' })).statusCode, 405);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'sesion' }, metodo: 'POST' })).statusCode, 405);
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'verificar' }, metodo: 'DELETE' })).statusCode, 405);
});

console.log('Ayudas HTTP y correo');
caso('leerCookie, ipDe y escrituraPermitida', () => {
    assert.strictEqual(H.leerCookie({ headers: { cookie: 'a=1; cl_pyme=xyz; b=2' } }, 'cl_pyme'), 'xyz');
    assert.strictEqual(H.leerCookie({ headers: { cookie: 'xcl_pyme=1' } }, 'cl_pyme'), '');
    assert.strictEqual(H.leerCookie({ headers: {} }, 'cl_pyme'), '');
    assert.strictEqual(H.ipDe({ headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } }), '1.1.1.1');
    assert.strictEqual(H.ipDe({ headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' } }), '2.2.2.2');
    assert.strictEqual(H.ipDe({ headers: {} }), 'desconocida');
    const prod = { VERCEL_ENV: 'production' };
    assert.ok(!H.escrituraPermitida({ headers: { ...JSON_OK, origin: 'http://localhost:3000' } }, prod, SITIO));
    assert.ok(H.escrituraPermitida({ headers: { ...JSON_OK, origin: 'http://localhost:3000' } }, { VERCEL_ENV: 'development' }, SITIO));
    assert.ok(H.escrituraPermitida({ headers: { 'content-type': 'application/json; charset=utf-8', 'x-cl-pyme': '1' } }, prod, SITIO));
});
caso('el correo trae el enlace, el aviso de 15 minutos y no promete nada que no corresponda', () => {
    const enlace = 'https://calculolaboral.cl/api/pyme/verificar?t=' + 'a'.repeat(43);
    const c = C.correoAcceso({ enlace, minutos: 15 });
    assert.strictEqual(c.asunto, 'Tu enlace para entrar a Cálculo Laboral');
    assert.ok(c.html.indexOf(enlace) >= 0 && c.texto.indexOf(enlace) >= 0);
    assert.ok(/15 minutos/.test(c.html) && /una sola vez/.test(c.html));
    assert.ok(!/garant|oficial|abogad|100%/i.test(c.html + c.texto));
    assert.ok(C.correoAcceso({ enlace: 'https://x.cl/?a="><script>', minutos: 15 }).html.indexOf('"><script>') < 0);
});
caso('la página de confirmación no muestra la casilla a quien ya aceptó', () => {
    const con = C.paginaConfirmar({ token: 't', correoEnmascarado: 'a***@e***.cl', requiereAceptar: true });
    const sin = C.paginaConfirmar({ token: 't', correoEnmascarado: 'a***@e***.cl', requiereAceptar: false });
    assert.ok(con.indexOf('name="acepto"') >= 0 && sin.indexOf('name="acepto"') < 0);
    assert.ok(/#asistente-pyme/.test(con));
    assert.ok(!/sky-|blue-|indigo|violet|purple|orange/.test(con));
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
