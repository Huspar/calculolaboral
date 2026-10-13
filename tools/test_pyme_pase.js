// Pruebas del Pase Pyme (compra, vigencia en la cuenta, desbloqueo de generadores y avisos de Flow), sin base, sin Flow y sin correo:
//   node tools/test_pyme_pase.js
'use strict';
process.env.FLOW_API_KEY = 'clave-prueba';
process.env.FLOW_SECRET_KEY = 'secreto-prueba';
process.env.FLOW_API_URL = 'https://flow.invalid/api';
process.env.RESEND_API_KEY = 'resend-prueba';
process.env.SITE_URL = 'https://calculolaboral.cl';

const assert = require('assert');
const crypto = require('crypto');
const Flow = require('../api/_flow');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Pase = require('../api/_pyme/pase');
const { procesarPagoPase } = require('../api/_pyme/confirmar_pase');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); process.exitCode = 1; }
    });
}

const SITIO = 'https://calculolaboral.cl';
const DIA = 86400000;
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };

// ---------- montaje ----------
function montar({ venta = true } = {}) {
    const reloj = { t: Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const creados = [];
    const flow = {
        createPayment: async (x) => { creados.push(x); return { url: 'https://flow.invalid/pagar', token: 'TOKEN' + creados.length }; },
        signUnlock: Flow.signUnlock
    };
    const pase = Pase.crear({ almacen, productos: Flow.PRODUCTS, flow, venta: () => venta, ahora: () => reloj.t });
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, pase });
    let ipN = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.1.' + (++ipN) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.1.1' });
        const s = await auth.leerSesion(r.sesion.token);
        return { cookie: 'cl_pyme=' + r.sesion.token, cuenta: { cuentaId: s.cuentaId, email: s.email } };
    }
    return { reloj, almacen, pase, rutas, entrar, creados };
}
function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
const escribir = (m, o) => pedir(m.rutas, { ...o, headers: { ...JSON_OK, cookie: o.cookie } });
const leer = (m, o) => pedir(m.rutas, { ...o, headers: { cookie: o.cookie } });
const pago = (producto, cuentaId, extra) => Object.assign({ paid: true, product: producto, order: 'FLOW-' + crypto.randomBytes(3).toString('hex'), commerceOrder: (Flow.PRODUCTS[producto].code) + '-1-abc', email: 'otro@pago.cl', optional: { cuenta: cuentaId } }, extra);

// ---------- catalogo y productos ----------
console.log('Catálogo y productos');
caso('los dos pases existen con su precio, sus días y su código, y no son kits ni generadores', () => {
    const p3 = Flow.PRODUCTS.pyme3, p12 = Flow.PRODUCTS.pyme12;
    assert.deepStrictEqual([p3.code, p3.amount, p3.dias, !!p3.pase, !!p3.unlock, !!p3.zip], ['P3', 19990, 92, true, false, false]);
    assert.deepStrictEqual([p12.code, p12.amount, p12.dias, !!p12.pase, !!p12.unlock, !!p12.zip], ['P12', 59990, 366, true, false, false]);
    const codigos = Object.keys(Flow.PRODUCTS).map(k => Flow.PRODUCTS[k].code);
    assert.strictEqual(new Set(codigos).size, codigos.length, 'códigos repetidos');
});
caso('el catálogo del panel muestra monto, duración y equivalente mensual, sin descuentos ni precios tachados', () => {
    const { pase } = montar();
    assert.deepStrictEqual(pase.catalogo().map(p => [p.id, p.monto, p.meses, p.porMes]), [['pyme3', 19990, 3, 6663], ['pyme12', 59990, 12, 4999]]);
    pase.catalogo().forEach(p => assert.deepStrictEqual(Object.keys(p).sort(), ['dias', 'id', 'meses', 'monto', 'porMes', 'titulo']));
});

// ---------- vigencia en la cuenta ----------
console.log('Vigencia');
caso('un pase pagado se suma a la cuenta: 92 días desde ahora, y sube el límite a 5 trabajadores', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const r = await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    assert.ok(r.ok && !r.repetido);
    assert.strictEqual(r.vence, m.reloj.t + 92 * DIA);
    assert.strictEqual(r.email, 'ana@ejemplo.cl', 'el comprobante va al correo de la cuenta, no al que se escribió en Flow');
    const datos = D.crear({ almacen: m.almacen, cifrado: Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') })), ahora: () => m.reloj.t });
    const e = await datos.estado(cuenta);
    assert.deepStrictEqual([e.limites.maxActivos, e.limites.paseProducto, e.limites.paseVence], [5, 'pyme3', new Date(r.vence).toISOString()]);
});
caso('el aviso repetido de Flow no duplica la vigencia (la orden es única)', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const p = pago('pyme3', cuenta.cuentaId);
    const a = await m.pase.confirmar(p), b = await m.pase.confirmar(p);
    assert.ok(a.ok && !a.repetido && b.ok && b.repetido);
    assert.strictEqual(b.vence, a.vence);
    assert.strictEqual(m.almacen._estado.pases.length, 1);
});
caso('comprar de nuevo extiende: el segundo pase empieza cuando termina el primero', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const a = await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    m.reloj.t += 30 * DIA;
    const b = await m.pase.confirmar(pago('pyme12', cuenta.cuentaId));
    assert.strictEqual(b.vence, a.vence + 366 * DIA);
    assert.strictEqual(await m.almacen.paseVigente(cuenta.cuentaId, new Date(m.reloj.t).toISOString()), b.vence, 'cuenta la vigencia total');
    assert.strictEqual((await m.almacen.paseActual(cuenta.cuentaId, new Date(m.reloj.t).toISOString())).producto, 'pyme3', 'hoy rige el primero');
    m.reloj.t = a.vence + DIA;
    assert.strictEqual((await m.almacen.paseActual(cuenta.cuentaId, new Date(m.reloj.t).toISOString())).producto, 'pyme12');
});
caso('un pase vencido se vuelve a comprar desde la fecha de la compra, no desde la del pase anterior', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const a = await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    m.reloj.t = a.vence + 10 * DIA;
    assert.strictEqual(await m.almacen.paseVigente(cuenta.cuentaId, new Date(m.reloj.t).toISOString()), null);
    const b = await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    assert.strictEqual(b.vence, m.reloj.t + 92 * DIA);
});
caso('un pase de otra cuenta no vale para esta', async () => {
    const m = montar(), a = await m.entrar('ana@ejemplo.cl'), b = await m.entrar('beto@ejemplo.cl');
    await m.pase.confirmar(pago('pyme3', a.cuenta.cuentaId));
    assert.strictEqual(await m.almacen.paseVigente(b.cuenta.cuentaId, new Date(m.reloj.t).toISOString()), null);
});
caso('confirmar rechaza lo que no es un pago de pase hecho a una cuenta real', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    assert.strictEqual((await m.pase.confirmar(pago('pyme3', cuenta.cuentaId, { paid: false }))).motivo, 'no_pagado');
    assert.strictEqual((await m.pase.confirmar(pago('blindaje', cuenta.cuentaId))).motivo, 'no_pagado');
    assert.strictEqual((await m.pase.confirmar(pago('pyme3', undefined, { optional: {} }))).motivo, 'sin_cuenta');
    assert.strictEqual((await m.pase.confirmar(pago('pyme3', 'no-es-uuid'))).motivo, 'sin_cuenta');
    assert.strictEqual((await m.pase.confirmar(pago('pyme3', crypto.randomUUID()))).motivo, 'cuenta_inexistente');
    assert.strictEqual((await m.pase.confirmar(null)).motivo, 'no_pagado');
    assert.strictEqual(m.almacen._estado.pases.length, 0);
});

// ---------- compra ----------
console.log('Compra');
caso('la venta está cerrada por defecto: no se crea ningún pago', async () => {
    const m = montar({ venta: false }), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const r = await m.pase.comprar(cuenta, 'pyme3');
    assert.deepStrictEqual([r.ok, r.estado, r.codigo], [false, 403, 'venta_cerrada']);
    assert.strictEqual(m.creados.length, 0);
    assert.strictEqual(m.pase.ventaActiva(), false);
});
caso('con la venta abierta se crea el pago con el correo y el id de la cuenta puestos por el servidor', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const r = await m.pase.comprar(cuenta, 'pyme12');
    assert.deepStrictEqual([r.ok, r.url], [true, 'https://flow.invalid/pagar?token=TOKEN1']);
    assert.deepStrictEqual(m.creados[0], { product: 'pyme12', email: 'ana@ejemplo.cl', optional: { cuenta: cuenta.cuentaId } });
});
caso('solo se compran los pases: ni kits ni generadores ni productos inventados', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    for (const p of ['blindaje', 'contrato', 'liquidacion', 'otro', '', undefined, null, 5]) assert.strictEqual((await m.pase.comprar(cuenta, p)).codigo, 'producto', String(p));
    assert.strictEqual(m.creados.length, 0);
});
caso('si Flow falla, la respuesta es un error genérico sin detalles', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const pase = Pase.crear({ almacen: m.almacen, productos: Flow.PRODUCTS, flow: { createPayment: async () => { throw new Error('Flow /payment/create 401: apiKey inválida SECRETO'); }, signUnlock: Flow.signUnlock }, venta: () => true });
    const r = await pase.comprar(cuenta, 'pyme3');
    assert.deepStrictEqual([r.estado, r.codigo], [502, 'flow']);
    assert.ok(r.error.indexOf('SECRETO') < 0 && r.error.indexOf('apiKey') < 0);
});

// ---------- desbloqueo de generadores ----------
console.log('Desbloqueo de generadores');
caso('el contrato lo desbloquea cualquier pase; el finiquito solo el de 12 meses', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    assert.strictEqual((await m.pase.desbloqueo(cuenta, 'contrato')).codigo, 'sin_pase');
    await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    const c = await m.pase.desbloqueo(cuenta, 'contrato');
    assert.ok(c.ok);
    assert.strictEqual((await m.pase.desbloqueo(cuenta, 'finiquito')).codigo, 'pase_no_incluye');
    const m2 = montar(), a2 = await m2.entrar('beto@ejemplo.cl');
    await m2.pase.confirmar(pago('pyme12', a2.cuenta.cuentaId));
    assert.ok((await m2.pase.desbloqueo(a2.cuenta, 'finiquito')).ok && (await m2.pase.desbloqueo(a2.cuenta, 'contrato')).ok);
});
caso('el desbloqueo es una firma que /api/unlock valida como la de un pago, y vence en 48 horas', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.pase.confirmar(pago('pyme12', cuenta.cuentaId));
    const d = (await m.pase.desbloqueo(cuenta, 'finiquito')).desbloqueo;
    assert.deepStrictEqual([d.p, typeof d.o, d.expiresAt - Date.now() > 47 * 3600000, d.expiresAt - Date.now() <= 48 * 3600000], ['finiquito', 'string', true, true]);
    assert.ok(Flow.verifyDownload({ p: d.p, o: d.o, e: d.e, sig: d.sig }));
    assert.ok(!Flow.verifyDownload({ p: 'contrato', o: d.o, e: d.e, sig: d.sig }), 'la firma no sirve para otro producto');
    assert.ok(!Flow.verifyDownload({ p: d.p, o: d.o, e: d.e, sig: d.sig.replace(/.$/, c => c === 'a' ? 'b' : 'a') }));
});
caso('sin pase vigente (vencido) no hay desbloqueo, y solo se pueden pedir el contrato y el finiquito', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const a = await m.pase.confirmar(pago('pyme12', cuenta.cuentaId));
    for (const p of ['informe', 'liquidacion', 'blindaje', 'otro', undefined]) assert.strictEqual((await m.pase.desbloqueo(cuenta, p)).codigo, 'producto', String(p));
    m.reloj.t = a.vence + DIA;
    assert.strictEqual((await m.pase.desbloqueo(cuenta, 'contrato')).codigo, 'sin_pase');
});

// ---------- rutas ----------
console.log('Rutas');
caso('el estado trae si la venta está abierta, los productos y qué cubre cada pase', async () => {
    const abierta = montar(), a = await abierta.entrar('ana@ejemplo.cl');
    const e = (await leer(abierta, { query: { ruta: 'estado' }, cookie: a.cookie })).json;
    assert.strictEqual(e.pase.venta, true);
    assert.deepStrictEqual(e.pase.productos.map(p => p.id), ['pyme3', 'pyme12']);
    assert.deepStrictEqual(e.pase.cobertura, { contrato: ['pyme3', 'pyme12'], finiquito: ['pyme12'] });
    assert.strictEqual(e.limites.paseProducto, null);
    const cerrada = montar({ venta: false }), b = await cerrada.entrar('beto@ejemplo.cl');
    assert.strictEqual((await leer(cerrada, { query: { ruta: 'estado' }, cookie: b.cookie })).json.pase.venta, false);
});
caso('comprar por la API: exige sesión, encabezado propio y origen; crea el pago y deja registro sin datos personales', async () => {
    const m = montar(), { cookie, cuenta } = await m.entrar('ana@ejemplo.cl');
    const q = { ruta: 'comprar' };
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: JSON_OK, body: { product: 'pyme3' } })).statusCode, 401);
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: { cookie }, body: { product: 'pyme3' } })).statusCode, 403);
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: { ...JSON_OK, origin: 'https://otro.com', cookie }, body: { product: 'pyme3' } })).statusCode, 403);
    assert.strictEqual((await leer(m, { query: q, cookie })).statusCode, 405);
    const r = await escribir(m, { query: q, metodo: 'POST', cookie, body: { product: 'pyme3' } });
    assert.deepStrictEqual([r.statusCode, r.json.ok, r.json.url], [200, true, 'https://flow.invalid/pagar?token=TOKEN1']);
    assert.strictEqual(m.creados[0].optional.cuenta, cuenta.cuentaId);
    assert.ok(m.almacen._estado.auditoria.some(a => a.evento === 'pase_compra_iniciada' && a.cuentaId === cuenta.cuentaId));
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: { product: 'kit' } })).statusCode, 400);
});
caso('comprar con la venta cerrada responde 403 y no crea el pago', async () => {
    const m = montar({ venta: false }), { cookie } = await m.entrar('ana@ejemplo.cl');
    const r = await escribir(m, { query: { ruta: 'comprar' }, metodo: 'POST', cookie, body: { product: 'pyme3' } });
    assert.deepStrictEqual([r.statusCode, r.json.codigo], [403, 'venta_cerrada']);
    assert.strictEqual(m.creados.length, 0);
});
caso('el desbloqueo por la API exige sesión y pase', async () => {
    const m = montar(), { cookie, cuenta } = await m.entrar('ana@ejemplo.cl');
    const q = { ruta: 'desbloqueo' };
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: JSON_OK, body: { producto: 'contrato' } })).statusCode, 401);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: { producto: 'contrato' } })).statusCode, 403);
    await m.pase.confirmar(pago('pyme3', cuenta.cuentaId));
    const r = await escribir(m, { query: q, metodo: 'POST', cookie, body: { producto: 'contrato' } });
    assert.deepStrictEqual([r.statusCode, r.json.desbloqueo.p], [200, 'contrato']);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: { producto: 'finiquito' } })).statusCode, 403);
});

// ---------- avisos de Flow (confirmación del pago) ----------
console.log('Confirmación del pago');
function correos() {
    const enviados = [];
    return {
        enviados,
        deliverPase: async (pay, vence) => { enviados.push(['comprobante', pay.email, new Date(vence).toISOString()]); },
        notifyOwner: async (pay, texto) => { enviados.push(['dueño', texto]); }
    };
}
caso('pago confirmado: registra el pase, envía el comprobante a la cuenta y avisa al dueño', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl'), c = correos();
    const r = await procesarPagoPase(pago('pyme3', cuenta.cuentaId), { pase: m.pase, ...c });
    assert.strictEqual(r.estado, 'registrado');
    assert.deepStrictEqual(c.enviados.map(e => e[0]), ['comprobante', 'dueño']);
    assert.strictEqual(c.enviados[0][1], 'ana@ejemplo.cl');
});
caso('aviso repetido: no suma vigencia y responde bien', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl'), c = correos(), p = pago('pyme3', cuenta.cuentaId);
    await procesarPagoPase(p, { pase: m.pase, ...c });
    const r = await procesarPagoPase(p, { pase: m.pase, ...c });
    assert.strictEqual(r.estado, 'repetido');
    assert.strictEqual(m.almacen._estado.pases.length, 1);
});
caso('si el comprobante falla se lanza el error (Flow reintenta) y el reintento no duplica el pase', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl'), p = pago('pyme3', cuenta.cuentaId);
    await assert.rejects(() => procesarPagoPase(p, { pase: m.pase, deliverPase: async () => { throw new Error('Resend 500'); }, notifyOwner: async () => {} }), /Resend 500/);
    assert.strictEqual(m.almacen._estado.pases.length, 1);
    const c = correos();
    assert.strictEqual((await procesarPagoPase(p, { pase: m.pase, ...c })).estado, 'repetido');
    assert.strictEqual(c.enviados[0][0], 'comprobante', 'el reintento sí envía el comprobante');
    assert.strictEqual(m.almacen._estado.pases.length, 1);
});
caso('un pago sin cuenta asociable avisa al dueño y no lanza error (reintentar no lo arreglaría)', async () => {
    const m = montar(), c = correos();
    const r = await procesarPagoPase(pago('pyme3', crypto.randomUUID()), { pase: m.pase, ...c });
    assert.deepStrictEqual([r.estado, r.motivo], ['sin_cuenta', 'cuenta_inexistente']);
    assert.ok(c.enviados[0][0] === 'dueño' && c.enviados[0][1].indexOf('asígnalo a mano') > 0);
    assert.strictEqual(m.almacen._estado.pases.length, 0);
});

// ---------- integración con las funciones de Vercel (Flow y Resend simulados) ----------
console.log('Funciones de Vercel');
function entorno(estadoFlow) {
    const llamadas = [];
    const original = global.fetch;
    global.fetch = async (url, init) => {
        const u = String(url);
        llamadas.push([init && init.method || 'GET', u, init && init.body]);
        if (u.indexOf('/payment/getStatus') >= 0) return { ok: true, status: 200, json: async () => estadoFlow };
        if (u.indexOf('api.resend.com') >= 0) return { ok: true, status: 200, json: async () => ({ id: 'x' }), text: async () => '' };
        throw new Error('llamada inesperada ' + u);
    };
    return { llamadas, restaurar: () => { global.fetch = original; } };
}
function respuesta() {
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { this.cuerpo = JSON.stringify(o); return this; }, end(c) { this.cuerpo = c || ''; return this; } };
    return res;
}
caso('api/flow-confirm registra el pase en la cuenta y manda comprobante y aviso por Resend', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const ruta = require.resolve('../api/_pyme/servicios');
    require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: { pase: () => m.pase, almacen: () => m.almacen } };
    delete require.cache[require.resolve('../api/flow-confirm')];
    const confirmar = require('../api/flow-confirm');
    const env = entorno({ status: 2, commerceOrder: 'P3-1700000000000-abc123', amount: 19990, flowOrder: 7777, payer: 'pagador@otro.cl', optional: JSON.stringify({ cuenta: cuenta.cuentaId }) });
    try {
        const res = respuesta();
        await confirmar({ method: 'POST', body: 'token=TOKENDEFLOW1234', query: {}, headers: {} }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(m.almacen._estado.pases.length, 1);
        assert.deepStrictEqual([m.almacen._estado.pases[0].producto, m.almacen._estado.pases[0].ordenFlow], ['pyme3', '7777']);
        const correosEnviados = env.llamadas.filter(l => l[1].indexOf('resend') >= 0).map(l => JSON.parse(l[2]));
        assert.ok(correosEnviados.some(c => c.to[0] === 'ana@ejemplo.cl' && /Pase Pyme 3 meses/.test(c.subject)), 'comprobante al correo de la cuenta');
        assert.ok(correosEnviados.some(c => /\[VENTA \$19\.990\]/.test(c.subject)), 'aviso al dueño');
        assert.ok(!correosEnviados.some(c => c.to[0] === 'pagador@otro.cl'));
        const comprobante = correosEnviados.find(c => c.to[0] === 'ana@ejemplo.cl');
        assert.ok(/no se renueva solo/i.test(comprobante.html) && !/retracto|garantiza|100%/i.test(comprobante.html));
        assert.ok(/reembolso total dentro de 14 días corridos/.test(comprobante.html), 'el comprobante informa el reembolso');
    } finally { env.restaurar(); }
});
caso('api/flow-confirm ignora un pago de pase con monto distinto o sin pagar', async () => {
    const m = montar(), { cuenta } = await m.entrar('ana@ejemplo.cl');
    const confirmar = require('../api/flow-confirm');
    for (const st of [{ status: 2, amount: 1000 }, { status: 1, amount: 19990 }, { status: 3, amount: 19990 }]) {
        const env = entorno({ ...st, commerceOrder: 'P3-1-a', flowOrder: 8888, optional: JSON.stringify({ cuenta: cuenta.cuentaId }) });
        try { const res = respuesta(); await confirmar({ method: 'POST', body: 'token=TOKENDEFLOW1234', query: {}, headers: {} }, res); assert.strictEqual(res.statusCode, 200); } finally { env.restaurar(); }
    }
    assert.strictEqual(m.almacen._estado.pases.length, 0);
});
caso('api/flow-return lleva de vuelta al asistente según el resultado del pago de un pase', async () => {
    const volver = require('../api/flow-return');
    const casos = [[{ status: 2, amount: 59990, commerceOrder: 'P12-1-a', flowOrder: 123 }, '/asistente-pyme?pase=ok&o=123'], [{ status: 1, amount: 59990, commerceOrder: 'P12-1-a', flowOrder: 123 }, '/asistente-pyme?pase=pendiente'], [{ status: 3, amount: 59990, commerceOrder: 'P12-1-a', flowOrder: 123 }, '/asistente-pyme?pase=rechazado']];
    for (const [st, destino] of casos) {
        const env = entorno(st);
        try { const res = respuesta(); await volver({ method: 'POST', body: 'token=TOKENDEFLOW1234', query: {}, headers: {} }, res); assert.deepStrictEqual([res.statusCode, res.headers.Location], [303, 'https://calculolaboral.cl' + destino]); } finally { env.restaurar(); }
    }
});
caso('api/checkout no vende el pase: exige comprar desde la cuenta', async () => {
    const checkout = require('../api/checkout');
    const res = respuesta();
    await checkout({ method: 'POST', headers: { origin: 'https://calculolaboral.cl' }, body: { product: 'pyme3', email: 'a@b.cl' } }, res);
    assert.strictEqual(res.statusCode, 400);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
