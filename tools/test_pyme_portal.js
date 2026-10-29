// Pruebas del Portal del Cliente (fase 3): node tools/test_pyme_portal.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const T = require('../api/_pyme/tokens');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');
const D = require('../api/_pyme/datos');
const Cif = require('../api/_pyme/cifrado');
const Piloto = require('../api/_pyme/piloto');
const { crearRutas } = require('../api/_pyme/rutas');
const A = require('../api/_pyme/auth');
const Eq = require('../api/_pyme/equipo');
const Portal = require('../api/_pyme/portal');
const Rut = require('../js/rut_cl');

let ok = 0;
const pendientes = [];
function caso(nombre, fn) {
    pendientes.push((async () => {
        try {
            await fn();
            ok++;
            console.log('  ok  ' + nombre);
        } catch (e) {
            console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message));
            process.exitCode = 1;
        }
    })());
}

const SITIO = 'https://calculolaboral.cl';
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };

const rutValido = (c) => {
    let s = 0, m = 2;
    for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r)));
};

function montar(ahora) {
    const reloj = { t: ahora || Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t, piloto: Piloto.crear({}, () => reloj.t) });
    const equipo = Eq.crear({ almacen, datos, ahora: () => reloj.t });
    const portal = Portal.crear({ almacen, datos, ahora: () => reloj.t });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, equipo, portal });

    let ip = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.' + Math.floor(++ip / 200) + '.' + (ip % 200) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.9.9.9' });
        return { cookie: 'cl_pyme=' + r.sesion.token, cuentaId: (await auth.leerSesion(r.sesion.token)).cuentaId, email: correo };
    }

    return { almacen, auth, datos, equipo, portal, rutas, reloj, entrar };
}

function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => {
        try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; }
        return res;
    });
}

const w = (m, como, o) => pedir(m.rutas, Object.assign({}, o, { headers: Object.assign({}, JSON_OK, { cookie: como.cookie }, como.estudio ? { 'x-cl-estudio': como.estudio } : {}, como.empresa ? { 'x-cl-empresa': como.empresa } : {}) }));
const r_ = (m, como, o) => pedir(m.rutas, Object.assign({}, o, { headers: Object.assign({ cookie: como.cookie }, como.estudio ? { 'x-cl-estudio': como.estudio } : {}, como.empresa ? { 'x-cl-empresa': como.empresa } : {}) }));

const TRAB = (n) => ({
    nombre: 'Trabajador ' + n, apellido: 'Pérez', rut: rutValido(10000000 + n), fechaIngreso: '2022-03-15', sueldoBase: 650000,
    afp: 'Habitat', salud: 'fonasa', activo: true, banco: 'Banco Estado', tipoCuenta: 'vista', numeroCuenta: '12345678'
});

async function setupEstudio(m) {
    const titular = await m.entrar('titular@estudio.cl');
    const cuenta = { cuentaId: titular.cuentaId, email: 'titular@estudio.cl', rol: 'titular' };
    const e1 = (await m.datos.guardarEmpresa(cuenta, { razonSocial: 'Cliente Uno SpA', rut: rutValido(76000001), giro: 'Panadería' })).empresaId;
    const e2 = (await m.datos.crearEmpresa(cuenta, { razonSocial: 'Cliente Dos SpA', rut: rutValido(76000002), giro: 'Taller' })).empresaId;
    const c1 = Object.assign({}, cuenta, { empresaId: e1 });
    const t1 = (await m.datos.crearTrabajador(c1, TRAB(1))).trabajador.id;
    const mes = {
        diasTrabajados: 30, emitida: '2026-10-05',
        calculo: { liquido: 520000, totalHaberes: 650000, totalImponible: 650000, totalDescuentos: 130000, costoEmpleador: 710000, conDesglose: true, uf: 39600, utm: 69751 }
    };
    await m.datos.guardarMes(c1, t1, '2026-10', mes);
    return { titular, cuenta, e1, e2, t1 };
}

caso('el titular invita a un cliente al portal con secciones; se respetan y se listan', async () => {
    const m = montar();
    const { titular, e1 } = await setupEstudio(m);

    // Listar inicial
    const r0 = await r_(m, titular, { query: { ruta: 'portal-gestion', empresaId: e1 } });
    assert.strictEqual(r0.statusCode, 200);
    assert.deepStrictEqual(r0.json.clientes, []);

    // Invitar cliente
    const rInv = await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'gerente@uno.cl', secciones: { liquidaciones: true } }
    });
    assert.strictEqual(rInv.statusCode, 200);
    assert.strictEqual(rInv.json.cliente.email, 'gerente@uno.cl');
    assert.strictEqual(rInv.json.cliente.secciones.resumen, true);
    assert.strictEqual(rInv.json.cliente.secciones.liquidaciones, true);
    assert.strictEqual(rInv.json.cliente.secciones.documentos, false);

    // Listar después
    const r1 = await r_(m, titular, { query: { ruta: 'portal-gestion', empresaId: e1 } });
    assert.strictEqual(r1.json.clientes.length, 1);
    assert.strictEqual(r1.json.clientes[0].email, 'gerente@uno.cl');
});

caso('límite del piloto: máximo 1 cliente por empresa, no propio y no repetido', async () => {
    const m = montar();
    const { titular, e1 } = await setupEstudio(m);

    // Email propio rechazado
    const rPropio = await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'titular@estudio.cl' }
    });
    assert.strictEqual(rPropio.statusCode, 400);

    // Invitar primero ok
    assert.strictEqual((await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'cliente1@uno.cl' }
    })).statusCode, 200);

    // Segundo cliente a la misma empresa rechazado por límite
    const rSegundo = await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'cliente2@uno.cl' }
    });
    assert.strictEqual(rSegundo.statusCode, 409);
    assert.strictEqual(rSegundo.json.codigo, 'limite');
});

caso('el cliente entra con su correo y consulta el portal de su empresa en solo lectura', async () => {
    const m = montar();
    const { titular, e1, e2 } = await setupEstudio(m);

    // Invitar cliente
    await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'dueno@uno.cl', secciones: { liquidaciones: true } }
    });

    // Cliente entra
    const cliente = await m.entrar('dueno@uno.cl');

    // Su sesión informa el portal disponible
    const ses = await r_(m, cliente, { query: { ruta: 'sesion' } });
    assert.strictEqual(ses.statusCode, 200);
    assert.ok(ses.json.portales && ses.json.portales.length === 1);
    assert.strictEqual(ses.json.portales[0].empresaId, e1);
    assert.strictEqual(ses.json.portales[0].razonSocial, 'Cliente Uno SpA');

    // Consulta datos del portal de e1
    const pData = await r_(m, cliente, { query: { ruta: 'portal-datos', empresaId: e1, periodo: '2026-10' } });
    assert.strictEqual(pData.statusCode, 200);
    assert.strictEqual(pData.json.empresa.razonSocial, 'Cliente Uno SpA');
    assert.strictEqual(pData.json.resumen.trabajadoresActivos, 1);
    assert.strictEqual(pData.json.resumen.liquidoTotal, 520000);
    assert.strictEqual(pData.json.resumen.costoTotal, 710000);
    assert.strictEqual(pData.json.liquidaciones.length, 1);
    assert.strictEqual(pData.json.liquidaciones[0].nombre, 'Trabajador 1');
    // Verifica que JAMÁS viajan datos bancarios
    assert.strictEqual(pData.json.liquidaciones[0].banco, undefined);
    assert.strictEqual(pData.json.liquidaciones[0].numeroCuenta, undefined);

    // Intento de consultar e2 (otra empresa del estudio) -> 403
    const pAjena = await r_(m, cliente, { query: { ruta: 'portal-datos', empresaId: e2 } });
    assert.strictEqual(pAjena.statusCode, 403);
    assert.strictEqual(pAjena.json.codigo, 'sin_acceso');
});

caso('descarga de liquidación en el portal: solo emitidas y con datos bancarios sanitizados', async () => {
    const m = montar();
    const { titular, e1, t1 } = await setupEstudio(m);

    await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'socio@uno.cl', secciones: { liquidaciones: true } }
    });
    const cliente = await m.entrar('socio@uno.cl');

    const liqDoc = await r_(m, cliente, {
        query: { ruta: 'portal-datos', empresaId: e1, trabajadorId: t1, periodo: '2026-10' }
    });
    assert.strictEqual(liqDoc.statusCode, 200);
    assert.strictEqual(liqDoc.json.trabajador.nombre, 'Trabajador 1');
    assert.strictEqual(liqDoc.json.trabajador.banco, '');
    assert.strictEqual(liqDoc.json.trabajador.numeroCuenta, '');
    assert.strictEqual(liqDoc.json.trabajador.tipoCuenta, '');
    assert.strictEqual(liqDoc.json.mes.emitida, '2026-10-05');
});

caso('un rol sin permiso (asistente) no puede gestionar el portal', async () => {
    const m = montar();
    const { titular, e1 } = await setupEstudio(m);

    await m.equipo.invitar(Object.assign({}, titular, { rol: 'titular' }), { email: 'asist@estudio.cl', rol: 'asistente', empresas: [e1] });
    const asist = await m.entrar('asist@estudio.cl');
    const r = await w(m, Object.assign({}, asist, { estudio: titular.cuentaId }), {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'cliente@test.cl' }
    });
    assert.strictEqual(r.statusCode, 403);
    assert.strictEqual(r.json.codigo, 'sin_permiso');
});

caso('quitar al cliente del portal corta su acceso de inmediato', async () => {
    const m = montar();
    const { titular, e1 } = await setupEstudio(m);

    const rInv = await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'temporal@uno.cl' }
    });
    const clienteId = rInv.json.cliente.id;
    const cliente = await m.entrar('temporal@uno.cl');

    // Con acceso ok
    assert.strictEqual((await r_(m, cliente, { query: { ruta: 'portal-datos', empresaId: e1 } })).statusCode, 200);

    // Titular lo quita
    const rDel = await w(m, titular, {
        query: { ruta: 'portal-gestion', id: clienteId }, metodo: 'DELETE'
    });
    assert.strictEqual(rDel.statusCode, 200);

    // En la siguiente petición recibe 403 sin_acceso
    const despues = await r_(m, cliente, { query: { ruta: 'portal-datos', empresaId: e1 } });
    assert.strictEqual(despues.statusCode, 403);
    assert.strictEqual(despues.json.codigo, 'sin_acceso');
});

caso('actividad registra portal_invitado, portal_cambiado, portal_quitado y portal_visto', async () => {
    const m = montar();
    const { titular, e1 } = await setupEstudio(m);

    const inv = await w(m, titular, {
        query: { ruta: 'portal-gestion' }, metodo: 'POST',
        body: { empresaId: e1, email: 'auditable@uno.cl', secciones: { liquidaciones: true } }
    });
    const cid = inv.json.cliente.id;

    await w(m, titular, {
        query: { ruta: 'portal-gestion', id: cid }, metodo: 'PUT',
        body: { secciones: { liquidaciones: false } }
    });

    const c = await m.entrar('auditable@uno.cl');
    await r_(m, c, { query: { ruta: 'portal-datos', empresaId: e1 } });

    await w(m, titular, {
        query: { ruta: 'portal-gestion', id: cid }, metodo: 'DELETE'
    });

    const act = (await r_(m, titular, { query: { ruta: 'actividad' } })).json.actividad;
    const acciones = act.map(a => a.accion);
    assert.ok(acciones.includes('portal_invitado'), 'falta portal_invitado: ' + acciones);
    assert.ok(acciones.includes('portal_cambiado'), 'falta portal_cambiado: ' + acciones);
    assert.ok(acciones.includes('portal_visto'), 'falta portal_visto: ' + acciones);
    assert.ok(acciones.includes('portal_quitado'), 'falta portal_quitado: ' + acciones);
});

Promise.all(pendientes).then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
