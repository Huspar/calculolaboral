// Pruebas de validacion, datos cifrados y rutas de datos del Asistente Pyme (sin base ni correo): node tools/test_pyme_datos.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const V = require('../api/_pyme/validar');
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
const MIN = 60000, DIA = 86400000;
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
let RUT_EMPRESA; const rutValido = (cuerpo) => { // genera un RUT con digito verificador correcto
    let s = 0, m = 2;
    for (let i = String(cuerpo).length - 1; i >= 0; i--) { s += +String(cuerpo)[i] * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    return Rut.formatear(cuerpo + (r === 11 ? '0' : r === 10 ? 'K' : String(r)));
};
RUT_EMPRESA = rutValido(76845123);
const EMPRESA = { razonSocial: 'Panadería La Espiga Ltda.', rut: rutValido(76845123), representante: 'Manuel Lagos', direccion: 'Av. Principal 123', comuna: 'Temuco' };
const TRAB = (n, extra) => Object.assign({ nombre: 'Trabajador ' + n, rut: rutValido(10000000 + n), cargo: 'Panadero', fechaIngreso: '2022-03-15', sueldoBase: 650000, afp: 'Habitat' }, extra);

function montar() {
    const reloj = { t: Date.parse('2026-10-12T15:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => { enviados.push(m); } });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t });
    const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO });
    let ipN = 0;
    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.' + (++ipN) });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        const cuenta = await auth.leerSesion(r.sesion.token);
        return { cookie: 'cl_pyme=' + r.sesion.token, sesion: cuenta, cuenta: { cuentaId: cuenta.cuentaId, email: cuenta.email } };
    }
    return { reloj, almacen, cifrado, auth, datos, rutas, entrar, enviados };
}

function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
    return Promise.resolve(rutas(req, res)).then(() => { try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; } return res; });
}
const escribir = (m, o) => pedir(m.rutas, { ...o, headers: { ...JSON_OK, cookie: o.cookie, ...(o.headers || {}) } });
const leer = (m, o) => pedir(m.rutas, { ...o, headers: { cookie: o.cookie } });

// ---------- RUT ----------
console.log('RUT');
caso('valida el dígito verificador y da formato estándar', () => {
    assert.ok(Rut.valido('12.345.678-5') && Rut.valido('123456785') && Rut.valido(RUT_EMPRESA) && !Rut.valido('76845123k'));
    assert.ok(!Rut.valido('12.345.678-9') && !Rut.valido('') && !Rut.valido('1-9') && !Rut.valido('abc') && !Rut.valido(null));
    assert.strictEqual(Rut.formatear('123456785'), '12.345.678-5');
    assert.strictEqual(Rut.limpiar(' 12.345.678-k '), '12345678K');
    assert.ok(!Rut.valido('1K345678-5'), 'la K solo puede ser el verificador');
});

// ---------- validacion ----------
console.log('Validación');
caso('empresa: normaliza, exige razón social y RUT válido, y descarta campos desconocidos', () => {
    const r = V.validarEmpresa({ ...EMPRESA, rut: Rut.limpiar(RUT_EMPRESA).toLowerCase(), razonSocial: '  Panadería   La Espiga  ', admin: true, __proto__x: 1 });
    assert.ok(r.ok);
    assert.strictEqual(r.valor.rut, RUT_EMPRESA);
    assert.strictEqual(r.valor.razonSocial, 'Panadería La Espiga');
    assert.ok(!('admin' in r.valor));
    const mala = V.validarEmpresa({ razonSocial: '', rut: '11.111.111-2' });
    assert.ok(!mala.ok && mala.errores.razonSocial && mala.errores.rut);
    assert.ok(!V.validarEmpresa(null).ok && !V.validarEmpresa([]).ok && !V.validarEmpresa('x').ok);
});
caso('empresa: largo máximo y logo (solo imagen base64 pequeña)', () => {
    assert.ok(!V.validarEmpresa({ ...EMPRESA, razonSocial: 'x'.repeat(101) }).ok);
    const logo = 'data:image/png;base64,' + Buffer.from('imagen').toString('base64');
    assert.ok(V.validarEmpresa({ ...EMPRESA, logo }).ok);
    ['data:text/html;base64,PHNjcmlwdD4=', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'http://x.cl/a.png', 'data:image/png;base64,' + 'A'.repeat(V.MAX_LOGO)].forEach(l => assert.ok(!V.validarEmpresa({ ...EMPRESA, logo: l }).ok, l.slice(0, 30)));
});
caso('trabajador: valores por defecto y conversión de números escritos como texto', () => {
    const r = V.validarTrabajador({ nombre: 'Ana', rut: '12.345.678-5', sueldoBase: '650000', jornadaHoras: '42' });
    assert.ok(r.ok);
    assert.deepStrictEqual([r.valor.contrato, r.valor.afp, r.valor.salud, r.valor.gratificacion, r.valor.activo, r.valor.sueldoBase, r.valor.jornadaHoras], ['indefinido', 'Modelo', 'fonasa', 'legal', true, 650000, 42]);
});
caso('trabajador: rangos, opciones y fechas se rechazan con un mensaje por campo', () => {
    const casos = [['sueldoBase', -1], ['sueldoBase', 1.5], ['sueldoBase', '12abc'], ['sueldoBase', 60000000], ['jornadaHoras', 0], ['jornadaHoras', 60], ['afp', 'Inventada'], ['salud', 'otra'],
        ['contrato', 'honorarios'], ['fechaIngreso', '2022-02-30'], ['fechaIngreso', '15-03-2022'], ['zonaExtrema', 'si'], ['activo', 1], ['aniosOtrosEmpleadores', 11], ['isaprePlanUF', 200]];
    casos.forEach(([campo, valor]) => {
        const r = V.validarTrabajador({ nombre: 'Ana', rut: '12.345.678-5', ...(campo === 'isaprePlanUF' ? { salud: 'isapre' } : {}), [campo]: valor });
        assert.ok(!r.ok && r.errores[campo], campo + '=' + valor);
    });
});
caso('trabajador: plazo fijo exige fecha de término posterior al ingreso; los demás contratos la borran', () => {
    const base = { nombre: 'Ana', rut: '12.345.678-5', fechaIngreso: '2026-03-01' };
    assert.ok(!V.validarTrabajador({ ...base, contrato: 'plazo_fijo' }).ok);
    assert.ok(!V.validarTrabajador({ ...base, contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-02-01' }).ok);
    assert.ok(V.validarTrabajador({ ...base, contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-12-01', renovaciones: 1 }).ok);
    const ind = V.validarTrabajador({ ...base, contrato: 'indefinido', fechaTerminoPlazo: '2026-12-01', renovaciones: 2 });
    assert.ok(ind.ok && ind.valor.fechaTerminoPlazo === '' && ind.valor.renovaciones === 0);
});
caso('trabajador: con Fonasa se borran los datos de Isapre; el ingreso no puede ser anterior al nacimiento', () => {
    const r = V.validarTrabajador({ nombre: 'Ana', rut: '12.345.678-5', salud: 'fonasa', isapreNombre: 'Colmena', isaprePlanUF: 4.2 });
    assert.ok(r.ok && r.valor.isapreNombre === '' && r.valor.isaprePlanUF === 0);
    assert.ok(V.validarTrabajador({ nombre: 'Ana', rut: '12.345.678-5', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: '4,25' }).valor.isaprePlanUF === 4.25);
    assert.ok(!V.validarTrabajador({ nombre: 'Ana', rut: '12.345.678-5', fechaNacimiento: '2000-01-01', fechaIngreso: '1999-01-01' }).ok);
});
caso('la lista de AFP sale de los parámetros del generador de liquidaciones', () => {
    assert.ok(['Capital', 'Cuprum', 'Habitat', 'Modelo', 'Planvital', 'Provida', 'Uno'].every(a => V.AFPS.indexOf(a) >= 0));
});

// ---------- servicio de datos ----------
console.log('Datos cifrados');
caso('la empresa se guarda cifrada: la base no contiene el texto y se recupera igual', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    assert.ok((await m.datos.guardarEmpresa(cuenta, EMPRESA)).ok);
    const crudo = JSON.stringify(m.almacen._estado.empresas);
    ['Espiga', '76.845.12', 'Lagos', 'Temuco'].forEach(s => assert.ok(crudo.indexOf(s) < 0 && Buffer.from(m.almacen._estado.empresas[0].datos).toString('latin1').indexOf(s) < 0, s));
    const e = await m.datos.estado(cuenta);
    assert.strictEqual(e.empresa.razonSocial, 'Panadería La Espiga Ltda.');
    assert.strictEqual(e.empresa.rut, RUT_EMPRESA);
});
caso('los trabajadores se guardan cifrados y se recuperan con sus ids', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    const r = await m.datos.crearTrabajador(cuenta, TRAB(1, { nombre: 'María José Núñez' }));
    assert.ok(r.ok && /^[0-9a-f-]{36}$/.test(r.trabajador.id));
    const bytes = Buffer.from(m.almacen._estado.trabajadores[0].datos);
    ['María', 'Núñez', 'Panadero', '650000'].forEach(s => assert.ok(bytes.toString('utf8').indexOf(s) < 0 && bytes.toString('latin1').indexOf(s) < 0, s));
    const e = await m.datos.estado(cuenta);
    assert.strictEqual(e.trabajadores.length, 1);
    assert.strictEqual(e.trabajadores[0].nombre, 'María José Núñez');
    assert.strictEqual(e.trabajadores[0].id, r.trabajador.id);
});
caso('un dato cifrado copiado a otra cuenta o a otro registro no se puede leer', async () => {
    const m = montar();
    const a = (await m.entrar('a@ejemplo.cl')).cuenta, b = (await m.entrar('b@ejemplo.cl')).cuenta;
    await m.datos.guardarEmpresa(a, EMPRESA); await m.datos.guardarEmpresa(b, { ...EMPRESA, razonSocial: 'Otra Empresa' });
    await m.datos.crearTrabajador(a, TRAB(1));
    const E = m.almacen._estado;
    const empA = E.empresas.find(x => x.cuentaId === a.cuentaId), empB = E.empresas.find(x => x.cuentaId === b.cuentaId);
    empB.datos = Buffer.from(empA.datos); // alguien con acceso a la base copia el contenido de A en B
    await assert.rejects(() => m.datos.estado(b), Cif.ErrorCifrado);
    E.trabajadores[0].empresaId = empB.id; // y mueve un trabajador de A a la empresa de B
    empB.datos = Buffer.from((await m.cifrado.cifrar(EMPRESA, 'empresas:' + b.cuentaId)).datos);
    await assert.rejects(() => m.datos.estado(b), Cif.ErrorCifrado);
});
caso('no se puede agregar un trabajador sin empresa', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    const r = await m.datos.crearTrabajador(cuenta, TRAB(1));
    assert.deepStrictEqual([r.ok, r.estado, r.codigo], [false, 409, 'sin_empresa']);
});
caso('límite de trabajadores activos: 1 sin pase, 5 con pase vigente; al vencer el pase no se pueden activar más', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    assert.ok((await m.datos.crearTrabajador(cuenta, TRAB(1))).ok);
    const sin = await m.datos.crearTrabajador(cuenta, TRAB(2));
    assert.deepStrictEqual([sin.ok, sin.estado, sin.codigo], [false, 409, 'limite']);
    assert.ok(/Pase Pyme/.test(sin.error));
    m.almacen._estado.pases.push({ cuentaId: cuenta.cuentaId, desde: new Date(m.reloj.t - DIA).toISOString(), vence: new Date(m.reloj.t + 30 * DIA).toISOString() });
    for (let n = 2; n <= 5; n++) assert.ok((await m.datos.crearTrabajador(cuenta, TRAB(n))).ok, 'trabajador ' + n);
    assert.strictEqual((await m.datos.crearTrabajador(cuenta, TRAB(6))).codigo, 'limite');
    assert.strictEqual((await m.datos.estado(cuenta)).limites.maxActivos, 5);
    // un inactivo no cuenta y reactivarlo respeta el máximo
    const e = await m.datos.estado(cuenta);
    const t1 = e.trabajadores[0], { id, ...sinId } = t1;
    assert.ok((await m.datos.actualizarTrabajador(cuenta, id, { ...sinId, activo: false })).ok);
    assert.ok((await m.datos.crearTrabajador(cuenta, TRAB(6))).ok);
    assert.strictEqual((await m.datos.actualizarTrabajador(cuenta, id, { ...sinId, activo: true })).codigo, 'limite');
    // el pase vence: los que ya están siguen, pero no se agregan más
    m.reloj.t += 31 * DIA;
    assert.strictEqual((await m.datos.estado(cuenta)).limites.maxActivos, 1);
    assert.strictEqual((await m.datos.crearTrabajador(cuenta, TRAB(7))).codigo, 'limite');
});
caso('RUT repetido en la misma empresa se rechaza al crear y al editar; otra empresa sí puede usarlo', async () => {
    const m = montar();
    const a = (await m.entrar('a@ejemplo.cl')).cuenta, b = (await m.entrar('b@ejemplo.cl')).cuenta;
    m.almacen._estado.pases.push({ cuentaId: a.cuentaId, desde: new Date(m.reloj.t - DIA).toISOString(), vence: new Date(m.reloj.t + 30 * DIA).toISOString() });
    await m.datos.guardarEmpresa(a, EMPRESA); await m.datos.guardarEmpresa(b, EMPRESA);
    const t1 = (await m.datos.crearTrabajador(a, TRAB(1))).trabajador;
    const dup = await m.datos.crearTrabajador(a, TRAB(2, { rut: t1.rut }));
    assert.deepStrictEqual([dup.ok, dup.codigo], [false, 'rut_repetido']);
    const t2 = (await m.datos.crearTrabajador(a, TRAB(2))).trabajador;
    const { id, ...d2 } = t2;
    assert.strictEqual((await m.datos.actualizarTrabajador(a, id, { ...d2, rut: t1.rut })).codigo, 'rut_repetido');
    assert.ok((await m.datos.crearTrabajador(b, TRAB(1, { rut: t1.rut }))).ok);
});
caso('editar y borrar: ids que no son UUID o que no existen dan 404', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    const t = (await m.datos.crearTrabajador(cuenta, TRAB(1))).trabajador;
    for (const id of ['', 'abc', "' OR 1=1", '00000000-0000-0000-0000-000000000000', undefined, 5]) {
        assert.strictEqual((await m.datos.actualizarTrabajador(cuenta, id, TRAB(1))).estado, 404, String(id));
        assert.strictEqual((await m.datos.borrarTrabajador(cuenta, id)).estado, 404, String(id));
    }
    const { id, ...d } = t;
    const r = await m.datos.actualizarTrabajador(cuenta, id, { ...d, sueldoBase: 700000 });
    assert.ok(r.ok && r.trabajador.sueldoBase === 700000);
    assert.strictEqual((await m.datos.estado(cuenta)).trabajadores[0].sueldoBase, 700000);
    assert.ok((await m.datos.borrarTrabajador(cuenta, id)).ok);
    assert.strictEqual((await m.datos.estado(cuenta)).trabajadores.length, 0);
});
caso('tope total de 50 trabajadores (activos más inactivos)', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    for (let n = 1; n <= 50; n++) assert.ok((await m.datos.crearTrabajador(cuenta, TRAB(n, { activo: false }))).ok, 'trabajador ' + n);
    assert.strictEqual((await m.datos.crearTrabajador(cuenta, TRAB(51, { activo: false }))).codigo, 'limite_total');
});
caso('importar: guarda la empresa, salta repetidos y avisa los que no entran por el límite o por datos inválidos', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    const r = await m.datos.importar(cuenta, { empresa: EMPRESA, trabajadores: [TRAB(1), TRAB(1), TRAB(2), { nombre: 'Sin RUT' }] });
    assert.ok(r.ok && r.empresa === true && r.importados === 1);
    assert.deepStrictEqual(r.omitidos.map(o => o.motivo).sort(), ['invalido', 'limite', 'repetido']);
    const mala = await m.datos.importar(cuenta, { empresa: { razonSocial: '' }, trabajadores: [TRAB(9)] });
    assert.ok(!mala.ok && mala.estado === 400);
    assert.strictEqual((await m.datos.estado(cuenta)).trabajadores.length, 1);
    const sinEmpresa = await montar().datos.importar({ cuentaId: crypto.randomUUID(), email: 'x@y.cl' }, { trabajadores: [TRAB(1)] });
    assert.strictEqual(sinEmpresa.codigo, 'sin_empresa');
});
caso('exportar entrega todo descifrado, con versión y fecha; el archivo no incluye ids internos de la base de datos', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    await m.datos.crearTrabajador(cuenta, TRAB(1));
    const x = (await m.datos.exportar(cuenta)).archivo;
    assert.strictEqual(x.formato, 'calculolaboral-asistente-pyme');
    assert.strictEqual(x.version, 5);
    assert.deepStrictEqual([x.meses, x.documentos, x.vacaciones, x.honorarios], [[], [], [], []]);
    assert.strictEqual(x.cuenta.email, 'ana@ejemplo.cl');
    assert.strictEqual(x.empresa.razonSocial, 'Panadería La Espiga Ltda.');
    assert.strictEqual(x.trabajadores[0].nombre, 'Trabajador 1');
    assert.ok(!('cuentaId' in x.cuenta));
});
caso('borrar la cuenta exige escribir el correo exacto y borra todo', async () => {
    const m = montar();
    const { cuenta } = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(cuenta, EMPRESA);
    await m.datos.crearTrabajador(cuenta, TRAB(1));
    for (const c of [undefined, '', 'otro@ejemplo.cl', 'ana@ejemplo', 5]) assert.strictEqual((await m.datos.borrarCuenta(cuenta, c)).codigo, 'confirmacion');
    assert.ok((await m.datos.borrarCuenta(cuenta, ' ANA@ejemplo.cl ')).ok);
    const E = m.almacen._estado;
    assert.deepStrictEqual([E.cuentas.length, E.empresas.length, E.trabajadores.length, E.sesiones.length], [0, 0, 0, 0]);
});

// ---------- rutas ----------
console.log('Rutas de datos');
caso('sin sesión: todas las rutas de datos responden 401', async () => {
    const m = montar();
    for (const [ruta, metodo] of [['estado', 'GET'], ['exportar', 'GET'], ['empresa', 'PUT'], ['trabajador', 'POST'], ['meses', 'GET'], ['mes', 'PUT'], ['mes', 'DELETE'], ['documento', 'POST'], ['importar', 'POST'], ['borrar-cuenta', 'POST']]) {
        const r = await pedir(m.rutas, { query: { ruta }, metodo, headers: metodo === 'GET' ? {} : JSON_OK, body: {} });
        assert.strictEqual(r.statusCode, 401, ruta);
        assert.strictEqual(r.json.codigo, 'sin_sesion');
    }
});
caso('las escrituras exigen el encabezado propio y el origen del sitio (antes de mirar la sesión)', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    for (const headers of [{ cookie }, { cookie, 'content-type': 'application/json' }, { ...JSON_OK, cookie, origin: 'https://otro.com' }]) {
        assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'empresa' }, metodo: 'PUT', headers, body: { empresa: EMPRESA } })).statusCode, 403);
    }
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie })).json.empresa, null);
});
caso('flujo completo por la API: empresa, trabajador, estado, edición y borrado', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    assert.deepStrictEqual((await leer(m, { query: { ruta: 'estado' }, cookie })).json, { ok: true, cuenta: { email: 'ana@ejemplo.cl' }, empresa: null, trabajadores: [], limites: { maxActivos: 1, paseVence: null, paseProducto: null }, maxTotal: 50 });
    const e = await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: EMPRESA } });
    assert.strictEqual(e.statusCode, 200);
    const t = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: { trabajador: TRAB(1) } });
    assert.strictEqual(t.statusCode, 200);
    const id = t.json.trabajador.id;
    const est = (await leer(m, { query: { ruta: 'estado' }, cookie })).json;
    assert.strictEqual(est.empresa.razonSocial, 'Panadería La Espiga Ltda.');
    assert.strictEqual(est.trabajadores[0].id, id);
    const { id: _, ...d } = t.json.trabajador;
    assert.strictEqual((await escribir(m, { query: { ruta: 'trabajador', id }, metodo: 'PUT', cookie, body: { trabajador: { ...d, cargo: 'Maestro' } } })).json.trabajador.cargo, 'Maestro');
    assert.strictEqual((await escribir(m, { query: { ruta: 'trabajador', id }, metodo: 'DELETE', cookie, body: {} })).statusCode, 200);
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie })).json.trabajadores.length, 0);
});
caso('errores de validación llegan con un mensaje por campo (400); el límite es 409', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    const mala = await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: { razonSocial: '', rut: 'x' } } });
    assert.strictEqual(mala.statusCode, 400);
    assert.ok(mala.json.errores.razonSocial && mala.json.errores.rut);
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: EMPRESA } });
    await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: { trabajador: TRAB(1) } });
    const lim = await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie, body: { trabajador: TRAB(2) } });
    assert.strictEqual(lim.statusCode, 409);
    assert.strictEqual(lim.json.codigo, 'limite');
});
caso('una cuenta no puede ver, editar ni borrar los trabajadores de otra', async () => {
    const m = montar();
    const a = await m.entrar('a@ejemplo.cl'), b = await m.entrar('b@ejemplo.cl');
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: a.cookie, body: { empresa: EMPRESA } });
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: b.cookie, body: { empresa: { ...EMPRESA, razonSocial: 'Empresa B' } } });
    const idA = (await escribir(m, { query: { ruta: 'trabajador' }, metodo: 'POST', cookie: a.cookie, body: { trabajador: TRAB(1, { nombre: 'Secreto de A' }) } })).json.trabajador.id;
    const verB = await leer(m, { query: { ruta: 'estado' }, cookie: b.cookie });
    assert.ok(verB.cuerpo.indexOf('Secreto de A') < 0 && verB.json.trabajadores.length === 0);
    assert.strictEqual((await escribir(m, { query: { ruta: 'trabajador', id: idA }, metodo: 'PUT', cookie: b.cookie, body: { trabajador: TRAB(1, { nombre: 'Hackeado' }) } })).statusCode, 404);
    assert.strictEqual((await escribir(m, { query: { ruta: 'trabajador', id: idA }, metodo: 'DELETE', cookie: b.cookie, body: {} })).statusCode, 404);
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie: a.cookie })).json.trabajadores[0].nombre, 'Secreto de A');
});
caso('exportar: descarga como archivo, deja registro en la auditoría y no incluye datos de otras cuentas', async () => {
    const m = montar();
    const a = await m.entrar('a@ejemplo.cl'), b = await m.entrar('b@ejemplo.cl');
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: a.cookie, body: { empresa: EMPRESA } });
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: b.cookie, body: { empresa: { ...EMPRESA, razonSocial: 'Empresa B' } } });
    const r = await leer(m, { query: { ruta: 'exportar' }, cookie: a.cookie });
    assert.strictEqual(r.statusCode, 200);
    assert.ok(/^attachment; filename="calculolaboral-datos-\d{4}-\d{2}-\d{2}\.json"$/.test(r.headers['content-disposition']));
    assert.ok(r.cuerpo.indexOf('Empresa B') < 0 && r.json.empresa.razonSocial === 'Panadería La Espiga Ltda.');
    assert.ok(m.almacen._estado.auditoria.some(x => x.evento === 'datos_exportados' && x.cuentaId === a.sesion.cuentaId));
});
caso('borrar la cuenta por la API: borra todo, cierra la sesión y deja un registro sin datos personales', async () => {
    const m = montar();
    const a = await m.entrar('a@ejemplo.cl');
    await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: a.cookie, body: { empresa: EMPRESA } });
    const mal = await escribir(m, { query: { ruta: 'borrar-cuenta' }, metodo: 'POST', cookie: a.cookie, body: { confirmar: 'otro@ejemplo.cl' } });
    assert.strictEqual(mal.statusCode, 400);
    const bien = await escribir(m, { query: { ruta: 'borrar-cuenta' }, metodo: 'POST', cookie: a.cookie, body: { confirmar: 'a@ejemplo.cl' } });
    assert.strictEqual(bien.statusCode, 200);
    assert.ok(/Max-Age=0/.test(bien.headers['set-cookie']));
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie: a.cookie })).statusCode, 401);
    const E = m.almacen._estado;
    assert.deepStrictEqual([E.cuentas.length, E.empresas.length], [0, 0]);
    const ev = E.auditoria.filter(x => x.evento === 'cuenta_borrada');
    assert.strictEqual(ev.length, 1);
    assert.ok(JSON.stringify(E.auditoria).indexOf('a@ejemplo.cl') < 0);
});
caso('límite de escrituras: 300 por hora por cuenta, y se reinicia a la hora siguiente', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    let ultimo;
    for (let i = 0; i < 300; i++) ultimo = await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: EMPRESA } });
    assert.strictEqual(ultimo.statusCode, 200);
    const excede = await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie, body: { empresa: EMPRESA } });
    assert.strictEqual(excede.statusCode, 429);
    assert.strictEqual((await leer(m, { query: { ruta: 'estado' }, cookie })).statusCode, 200, 'leer no cuenta como escritura');
    m.reloj.t += 61 * MIN;
    const sesion = (await m.entrar('ana@ejemplo.cl')).cookie;
    assert.strictEqual((await escribir(m, { query: { ruta: 'empresa' }, metodo: 'PUT', cookie: sesion, body: { empresa: EMPRESA } })).statusCode, 200);
});
caso('la respuesta de importar entrega lo importado y lo omitido', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ana@ejemplo.cl');
    const r = await escribir(m, { query: { ruta: 'importar' }, metodo: 'POST', cookie, body: { empresa: EMPRESA, trabajadores: [TRAB(1), TRAB(2)] } });
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual([r.json.importados, r.json.omitidos.length], [1, 1]);
});

// ---------- meses de liquidacion ----------
console.log('Meses de liquidación');
const CALC = { liquido: 612345, totalHaberes: 800000, totalImponible: 720000, totalDescuentos: 187655, uf: 41130.94, utm: 72151 };
const MES = (extra) => Object.assign({ diasTrabajados: 30, horasExtra: 4, gratificacion: 'legal', bonosImponibles: [{ nombre: 'Bono de producción', monto: 50000 }], calculo: CALC }, extra);
async function conTrabajador(extra) {
    const m = montar();
    const sesion = await m.entrar('ana@ejemplo.cl');
    await m.datos.guardarEmpresa(sesion.cuenta, EMPRESA);
    const t = await m.datos.crearTrabajador(sesion.cuenta, TRAB(1, extra));
    return Object.assign({ m, tid: t.trabajador.id }, sesion);
}
caso('validarMes: completa los valores por defecto, normaliza y descarta campos inesperados', () => {
    const r = V.validarMes({ horasExtra: '4,5', sistema: 'x', bonosImponibles: [{ nombre: '  Bono  ', monto: '50000', extra: 1 }, { nombre: '', monto: 0 }] });
    assert.ok(r.ok);
    assert.strictEqual(r.valor.diasTrabajados, 30);
    assert.strictEqual(r.valor.horasExtra, 4.5);
    assert.strictEqual(r.valor.gratificacion, 'legal');
    assert.deepStrictEqual(r.valor.bonosImponibles, [{ nombre: 'Bono', monto: 50000 }]);
    assert.ok(!('sistema' in r.valor));
    assert.strictEqual(r.valor.calculo, null);
});
caso('validarMes: rechaza días, montos, opciones y listas fuera de rango', () => {
    const malos = [{ diasTrabajados: 31 }, { diasTrabajados: -1 }, { horasExtra: 301 }, { gratificacion: 'otra' }, { anticipo: 50000001 }, { comisiones: 'mucho' },
        { bonosImponibles: new Array(9).fill({ nombre: 'a', monto: 1 }) }, { otrosDescuentos: [{ nombre: 'x'.repeat(61), monto: 1 }] }, { emitida: '2026-13-40' },
        { calculo: { liquido: 1 } }, { calculo: { ...CALC, uf: 5 } }, { calculo: 'x' }];
    malos.forEach(m => assert.ok(!V.validarMes(m).ok, JSON.stringify(m)));
    assert.ok(!V.validarMes(null).ok && !V.validarMes([]).ok);
});
caso('validarPeriodo acepta AAAA-MM reales y rechaza el resto', () => {
    ['2026-10', '2020-01', '2100-12'].forEach(p => assert.ok(V.validarPeriodo(p), p));
    ['2026-13', '2026-00', '2026-1', '2019-12', '2101-01', '20261', '', null, undefined, '2026-10-01'].forEach(p => assert.ok(!V.validarPeriodo(p), String(p)));
});
caso('guardar un mes lo cifra: la base no contiene el texto, y se lee de vuelta igual', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    const r = await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    assert.ok(r.ok);
    const fila = m.almacen._estado.meses[0];
    assert.ok(!fila.datos.toString('latin1').includes('Bono de producci') && !fila.datos.toString('utf8').includes('liquido'));
    const l = await m.datos.meses(cuenta, '2026-09');
    assert.strictEqual(l.meses.length, 1);
    assert.strictEqual(l.meses[0].trabajadorId, tid);
    assert.strictEqual(l.meses[0].mes.calculo.liquido, 612345);
    assert.strictEqual(l.meses[0].mes.bonosImponibles[0].nombre, 'Bono de producción');
    assert.deepStrictEqual((await m.datos.meses(cuenta, '2026-08')).meses, []);
});
caso('guardar de nuevo el mismo mes lo reemplaza (no lo duplica)', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES({ diasTrabajados: 20, emitida: '2026-10-05' }));
    const l = (await m.datos.meses(cuenta, '2026-09')).meses;
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].mes.diasTrabajados, 20);
    assert.strictEqual(l[0].mes.emitida, '2026-10-05');
});
caso('un mes copiado a otro periodo o a otro trabajador no se puede leer (cifrado atado a su lugar)', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    const E = m.almacen._estado;
    E.meses.push({ ...E.meses[0], periodo: '2026-08' });
    await assert.rejects(() => m.datos.meses(cuenta, '2026-08'));
    E.meses.pop();
    E.meses[0].trabajadorId = crypto.randomUUID();
    E.trabajadores.push({ id: E.meses[0].trabajadorId, empresaId: E.empresas[0].id, activo: false, datos: E.trabajadores[0].datos, version: E.trabajadores[0].version });
    await assert.rejects(() => m.datos.meses(cuenta, '2026-09'));
});
caso('otra cuenta no puede guardar, leer ni borrar meses de un trabajador ajeno', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    const otra = (await m.entrar('beto@ejemplo.cl')).cuenta;
    assert.deepStrictEqual((await m.datos.meses(otra, '2026-09')).meses, []);
    await m.datos.guardarEmpresa(otra, { ...EMPRESA, rut: rutValido(76111222) });
    assert.strictEqual((await m.datos.guardarMes(otra, tid, '2026-09', MES())).estado, 404);
    assert.strictEqual((await m.datos.borrarMes(otra, tid, '2026-09')).estado, 404);
    assert.strictEqual((await m.datos.meses(cuenta, '2026-09')).meses.length, 1);
});
caso('guardarMes valida trabajador, periodo y datos', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    assert.strictEqual((await m.datos.guardarMes(cuenta, 'no-es-uuid', '2026-09', MES())).estado, 404);
    assert.strictEqual((await m.datos.guardarMes(cuenta, crypto.randomUUID(), '2026-09', MES())).estado, 404);
    assert.strictEqual((await m.datos.guardarMes(cuenta, tid, '2026-9', MES())).codigo, 'periodo');
    const mala = await m.datos.guardarMes(cuenta, tid, '2026-09', MES({ diasTrabajados: 40 }));
    assert.deepStrictEqual([mala.estado, mala.codigo, Object.keys(mala.errores)], [400, 'validacion', ['diasTrabajados']]);
    assert.strictEqual((await m.datos.meses(cuenta, 'x')).codigo, 'periodo');
    assert.strictEqual((await m.datos.borrarMes(cuenta, tid, '2026-09')).estado, 404);
});
caso('hay un máximo de meses guardados por trabajador, pero reemplazar un mes existente siempre se puede', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    for (let i = 0; i < D.MAX_MESES_POR_TRABAJADOR; i++) {
        const periodo = (2020 + Math.floor(i / 12)) + '-' + String(i % 12 + 1).padStart(2, '0');
        assert.ok((await m.datos.guardarMes(cuenta, tid, periodo, MES())).ok, periodo);
    }
    assert.strictEqual((await m.datos.guardarMes(cuenta, tid, '2031-01', MES())).codigo, 'limite_meses');
    assert.ok((await m.datos.guardarMes(cuenta, tid, '2020-01', MES({ diasTrabajados: 10 }))).ok);
});
caso('borrar un mes, un trabajador o la cuenta borra los meses que dependen de ellos', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.guardarMes(cuenta, tid, '2026-08', MES());
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    assert.ok((await m.datos.borrarMes(cuenta, tid, '2026-08')).ok);
    assert.strictEqual(m.almacen._estado.meses.length, 1);
    assert.ok((await m.datos.borrarTrabajador(cuenta, tid)).ok);
    assert.strictEqual(m.almacen._estado.meses.length, 0);
    const c2 = await conTrabajador();
    await c2.m.datos.guardarMes(c2.cuenta, c2.tid, '2026-09', MES());
    await c2.m.datos.borrarCuenta(c2.cuenta, 'ana@ejemplo.cl');
    assert.strictEqual(c2.m.almacen._estado.meses.length, 0);
});
caso('exportar incluye los meses guardados descifrados', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.guardarMes(cuenta, tid, '2026-09', MES());
    const x = (await m.datos.exportar(cuenta)).archivo;
    assert.strictEqual(x.meses.length, 1);
    assert.deepStrictEqual([x.meses[0].trabajadorId, x.meses[0].periodo, x.meses[0].mes.calculo.uf], [tid, '2026-09', 41130.94]);
});
caso('rutas de meses: guardar, listar, borrar; escribir exige encabezado y origen', async () => {
    const { m, cookie, tid } = await conTrabajador();
    const q = { ruta: 'mes', trabajador: tid, periodo: '2026-09' };
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'PUT', headers: { cookie }, body: { mes: MES() } })).statusCode, 403);
    const g = await escribir(m, { query: q, metodo: 'PUT', cookie, body: { mes: MES() } });
    assert.strictEqual(g.statusCode, 200);
    const l = await leer(m, { query: { ruta: 'meses', periodo: '2026-09' }, cookie });
    assert.strictEqual(l.json.meses[0].mes.calculo.liquido, 612345);
    assert.strictEqual((await leer(m, { query: { ruta: 'meses' }, cookie })).statusCode, 400);
    assert.strictEqual((await escribir(m, { query: { ...q, periodo: 'mal' }, metodo: 'PUT', cookie, body: { mes: MES() } })).statusCode, 400);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: {} })).statusCode, 405);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'DELETE', cookie })).statusCode, 200);
    assert.strictEqual((await leer(m, { query: { ruta: 'meses', periodo: '2026-09' }, cookie })).json.meses.length, 0);
});

// ---------- documentos emitidos ----------
console.log('Registro de documentos');
caso('registrar un documento guarda solo el tipo y la fecha, y sale en la exportación', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    assert.ok((await m.datos.registrarDocumento(cuenta, tid, 'cert_antiguedad')).ok);
    assert.ok((await m.datos.registrarDocumento(cuenta, tid, 'carta_161')).ok);
    const fila = m.almacen._estado.documentos[0];
    assert.deepStrictEqual(Object.keys(fila).sort(), ['emitido', 'tipo', 'trabajadorId']);
    const x = (await m.datos.exportar(cuenta)).archivo;
    assert.deepStrictEqual(x.documentos.map(d => [d.trabajadorId, d.tipo, d.emitido]), [[tid, 'cert_antiguedad', '2026-10-12T15:00:00.000Z'], [tid, 'carta_161', '2026-10-12T15:00:00.000Z']]);
});
caso('registrar un documento valida el tipo y el trabajador, y no se puede en trabajadores de otra cuenta', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    assert.strictEqual((await m.datos.registrarDocumento(cuenta, tid, 'documento_inventado')).codigo, 'tipo');
    assert.strictEqual((await m.datos.registrarDocumento(cuenta, 'no-uuid', 'carta_161')).estado, 404);
    assert.strictEqual((await m.datos.registrarDocumento(cuenta, crypto.randomUUID(), 'carta_161')).estado, 404);
    const otra = (await m.entrar('beto@ejemplo.cl')).cuenta;
    await m.datos.guardarEmpresa(otra, { ...EMPRESA, rut: rutValido(76111222) });
    assert.strictEqual((await m.datos.registrarDocumento(otra, tid, 'carta_161')).estado, 404);
    assert.strictEqual(m.almacen._estado.documentos.length, 0);
});
caso('hay un máximo de documentos registrados por trabajador', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    for (let i = 0; i < D.MAX_DOCUMENTOS_POR_TRABAJADOR; i++) assert.ok((await m.datos.registrarDocumento(cuenta, tid, 'liquidacion')).ok);
    assert.strictEqual((await m.datos.registrarDocumento(cuenta, tid, 'liquidacion')).codigo, 'limite_documentos');
});
caso('borrar al trabajador o la cuenta borra sus documentos registrados', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    await m.datos.registrarDocumento(cuenta, tid, 'carta_161');
    await m.datos.borrarTrabajador(cuenta, tid);
    assert.strictEqual(m.almacen._estado.documentos.length, 0);
    const c2 = await conTrabajador();
    await c2.m.datos.registrarDocumento(c2.cuenta, c2.tid, 'carta_161');
    await c2.m.datos.borrarCuenta(c2.cuenta, 'ana@ejemplo.cl');
    assert.strictEqual(c2.m.almacen._estado.documentos.length, 0);
});
caso('ruta de documentos: registra, valida y exige encabezado y origen', async () => {
    const { m, cookie, tid } = await conTrabajador();
    const q = { ruta: 'documento', trabajador: tid };
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: { cookie }, body: { tipo: 'carta_161' } })).statusCode, 403);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: { tipo: 'carta_161' } })).statusCode, 200);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'POST', cookie, body: { tipo: 'otro' } })).statusCode, 400);
    assert.strictEqual((await escribir(m, { query: q, metodo: 'GET', cookie })).statusCode, 405);
    assert.strictEqual(m.almacen._estado.documentos.length, 1);
});

caso('vacaciones: el servidor cuenta los días hábiles, cifra el registro y lo lista', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    const r = await m.datos.guardarVacacion(cuenta, tid, { tipo: 'periodo', desde: '2026-12-07', hasta: '2026-12-13', dias: 99, nota: '  Fin de año  ' });
    assert.ok(r.ok, JSON.stringify(r));
    assert.strictEqual(r.vacacion.dias, 4, 'el servidor ignora los días que manda el cliente: el 8 de diciembre es feriado y el sábado no cuenta');
    assert.strictEqual(r.vacacion.nota, 'Fin de año');
    assert.ok(!m.almacen._estado.vacaciones[0].datos.toString('utf8').includes('Fin de año'), 'en la base es ilegible');
    const a = await m.datos.guardarVacacion(cuenta, tid, { tipo: 'ajuste', dias: 12, fecha: '1999-01-01' });
    assert.ok(a.ok && a.vacacion.fecha === '2026-10-12', 'la fecha del ajuste la pone el servidor');
    const lista = (await m.datos.vacaciones(cuenta)).vacaciones;
    assert.deepStrictEqual(lista.map(v => [v.tipo, v.dias, v.trabajadorId === tid]), [['periodo', 4, true], ['ajuste', 12, true]]);
    assert.strictEqual((await m.datos.exportar(cuenta)).archivo.vacaciones.length, 2);
});
caso('vacaciones: valida fechas, cobertura de feriados, días hábiles y períodos que se cruzan', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    const g = (e) => m.datos.guardarVacacion(cuenta, tid, e);
    assert.ok((await g({ tipo: 'periodo', desde: '2026-12-10', hasta: '2026-12-07' })).errores.hasta);
    assert.ok(/feriados verificados/.test((await g({ tipo: 'periodo', desde: '2030-01-07', hasta: '2030-01-11' })).errores.hasta));
    assert.ok(/no hay días hábiles/.test((await g({ tipo: 'periodo', desde: '2026-12-12', hasta: '2026-12-13' })).errores.hasta));
    assert.strictEqual((await g({ tipo: 'otro' })).estado, 400);
    assert.ok((await g({ tipo: 'ajuste', dias: 0 })).errores.dias);
    assert.ok((await g({ tipo: 'ajuste', dias: 3, nota: 'x'.repeat(130) })).errores.nota);
    assert.ok((await g({ tipo: 'periodo', desde: '2026-11-02', hasta: '2026-11-06' })).ok);
    const cruza = await g({ tipo: 'periodo', desde: '2026-11-06', hasta: '2026-11-10' });
    assert.strictEqual(cruza.codigo, 'se_cruza');
});
caso('vacaciones: no se cruzan cuentas; borrar el registro, el trabajador o la cuenta los elimina', async () => {
    const { m, cuenta, tid } = await conTrabajador();
    const r = await m.datos.guardarVacacion(cuenta, tid, { tipo: 'ajuste', dias: 5 });
    const { cuenta: otra } = await m.entrar('otra@ejemplo.cl');
    await m.datos.guardarEmpresa(otra, { ...EMPRESA, rut: rutValido(76111222) });
    assert.strictEqual((await m.datos.guardarVacacion(otra, tid, { tipo: 'ajuste', dias: 5 })).estado, 404);
    assert.strictEqual((await m.datos.borrarVacacion(otra, r.vacacion.id)).estado, 404);
    assert.deepStrictEqual((await m.datos.vacaciones(otra)).vacaciones, []);
    assert.ok((await m.datos.borrarVacacion(cuenta, r.vacacion.id)).ok);
    await m.datos.guardarVacacion(cuenta, tid, { tipo: 'ajuste', dias: 5 });
    await m.datos.borrarTrabajador(cuenta, tid);
    assert.strictEqual(m.almacen._estado.vacaciones.length, 0);
});
caso('rutas de vacaciones e historial de documentos', async () => {
    const { m, cookie, tid } = await conTrabajador();
    const q = { ruta: 'vacacion', trabajador: tid };
    assert.strictEqual((await pedir(m.rutas, { query: q, metodo: 'POST', headers: { cookie }, body: { vacacion: { tipo: 'ajuste', dias: 3 } } })).statusCode, 403);
    const r = await escribir(m, { query: q, metodo: 'POST', cookie, body: { vacacion: { tipo: 'ajuste', dias: 3 } } });
    assert.strictEqual(r.statusCode, 200);
    const l = await leer(m, { query: { ruta: 'vacaciones' }, cookie });
    assert.strictEqual(l.json.vacaciones.length, 1);
    assert.strictEqual((await escribir(m, { query: { ruta: 'vacacion', id: r.json.vacacion.id }, metodo: 'DELETE', cookie })).statusCode, 200);
    await escribir(m, { query: { ruta: 'documento', trabajador: tid }, metodo: 'POST', cookie, body: { tipo: 'carta_161' } });
    const d = await leer(m, { query: { ruta: 'documentos' }, cookie });
    assert.deepStrictEqual(d.json.documentos.map(x => [x.tipo, x.trabajadorId === tid]), [['carta_161', true]]);
    assert.strictEqual((await leer(m, { query: { ruta: 'documentos' } })).statusCode, 401);
});

caso('préstamos: se guardan cifrados en la ficha, editar la ficha no los borra y otra cuenta no los toca', async () => {
    const { m, cookie, tid, cuenta } = await conTrabajador();
    const p = { concepto: 'Préstamo para el auto', fecha: '2026-10-05', monto: 300000, cuotas: 6, desde: '2026-10' };
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'prestamos', trabajador: tid }, metodo: 'PUT', headers: { cookie }, body: { prestamos: [p] } })).statusCode, 403);
    const r = await escribir(m, { query: { ruta: 'prestamos', trabajador: tid }, metodo: 'PUT', cookie, body: { prestamos: [p] } });
    assert.strictEqual(r.statusCode, 200);
    assert.ok(/^[a-z0-9]{6,20}$/.test(r.json.trabajador.prestamos[0].id));
    const bytes = Buffer.from(m.almacen._estado.trabajadores[0].datos).toString('utf8');
    assert.ok(bytes.indexOf('auto') < 0);
    // guardar la ficha sin la lista conserva los préstamos
    const actual = (await m.datos.estado(cuenta)).trabajadores[0];
    const { id, prestamos, ...ficha } = actual;
    assert.ok((await m.datos.actualizarTrabajador(cuenta, tid, Object.assign(ficha, { cargo: 'Maestro panadero' }))).ok);
    const despues = (await m.datos.estado(cuenta)).trabajadores[0];
    assert.strictEqual(despues.cargo, 'Maestro panadero');
    assert.strictEqual(despues.prestamos.length, 1);
    // errores y otra cuenta
    const malo = await escribir(m, { query: { ruta: 'prestamos', trabajador: tid }, metodo: 'PUT', cookie, body: { prestamos: [{ ...p, cuotas: 0 }] } });
    assert.strictEqual(malo.statusCode, 400);
    assert.match(malo.json.error, /cuotas/);
    const { cuenta: otra } = await m.entrar('otra@ejemplo.cl');
    await m.datos.guardarEmpresa(otra, { ...EMPRESA, rut: rutValido(76111333) });
    assert.strictEqual((await m.datos.guardarPrestamos(otra, tid, [p])).estado, 404);
    // eliminar
    assert.deepStrictEqual((await m.datos.guardarPrestamos(cuenta, tid, [])).trabajador.prestamos, []);
});

caso('bonos fijos: se guardan en la ficha, editarla sin la lista los conserva y solo el art. 41 va como no imponible', async () => {
    const { m, tid, cuenta } = await conTrabajador();
    const actual = (await m.datos.estado(cuenta)).trabajadores[0];
    const { id, prestamos, ...ficha } = actual;
    const bonos = [{ tipo: 'imponible', nombre: 'Bono de responsabilidad', monto: 50000 }, { tipo: 'perdida_caja', nombre: 'otro nombre', monto: 15000 }];
    const r = await m.datos.actualizarTrabajador(cuenta, tid, Object.assign({}, ficha, { bonosFijos: bonos }));
    assert.ok(r.ok, JSON.stringify(r));
    let t = (await m.datos.estado(cuenta)).trabajadores[0];
    assert.deepStrictEqual(t.bonosFijos, [{ tipo: 'imponible', nombre: 'Bono de responsabilidad', monto: 50000 }, { tipo: 'perdida_caja', nombre: 'Asignación de pérdida de caja', monto: 15000 }]);
    // la ficha sin la lista (por ejemplo, al actualizarla desde un anexo) no borra los bonos
    const { bonosFijos, ...sinBonos } = t;
    delete sinBonos.id; delete sinBonos.prestamos;
    assert.ok((await m.datos.actualizarTrabajador(cuenta, tid, Object.assign(sinBonos, { cargo: 'Cajero' }))).ok);
    t = (await m.datos.estado(cuenta)).trabajadores[0];
    assert.strictEqual(t.bonosFijos.length, 2);
    // un bono imponible sin nombre, un tipo inventado o más de 8 se rechazan
    const malo = (b) => m.datos.actualizarTrabajador(cuenta, tid, Object.assign({}, ficha, { bonosFijos: b }));
    assert.strictEqual((await malo([{ tipo: 'imponible', nombre: '', monto: 1000 }])).estado, 400);
    assert.strictEqual((await malo([{ tipo: 'bono_libre_no_imponible', nombre: 'Bono', monto: 1000 }])).estado, 400);
    assert.strictEqual((await malo(Array.from({ length: 9 }, () => bonos[0]))).estado, 400);
    // y se vacía con una lista vacía
    assert.ok((await m.datos.actualizarTrabajador(cuenta, tid, Object.assign({}, ficha, { bonosFijos: [] }))).ok);
    assert.deepStrictEqual((await m.datos.estado(cuenta)).trabajadores[0].bonosFijos, []);
});

caso('boletas de honorarios: se guardan cifradas por mes, se validan, se exportan y se borran con la cuenta', async () => {
    const { m, cookie, cuenta } = await conTrabajador();
    const B = (extra) => Object.assign({ fecha: '2026-10-05', nombre: 'Rosa Fuentes, contadora', rut: rutValido(12345678), numero: 154, bruto: 100000 }, extra);
    // sin el encabezado del navegador no se escribe
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'honorarios', periodo: '2026-10' }, metodo: 'PUT', headers: { cookie }, body: { boletas: [B()] } })).statusCode, 403);
    const r = await escribir(m, { query: { ruta: 'honorarios', periodo: '2026-10' }, metodo: 'PUT', cookie, body: { boletas: [B({ fecha: '2026-10-20' }), B({ retiene: 'prestador', bruto: '50000' })] } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.json));
    assert.deepStrictEqual(r.json.boletas.map(b => [b.fecha, b.bruto, b.retiene]), [['2026-10-05', 50000, 'prestador'], ['2026-10-20', 100000, 'empresa']]);
    const bytes = Buffer.from(m.almacen._estado.honorarios[0].datos).toString('utf8');
    assert.ok(bytes.indexOf('Rosa') < 0, 'el nombre del prestador debe ir cifrado');
    const l = await leer(m, { query: { ruta: 'honorarios', periodo: '2026-10' }, cookie });
    assert.strictEqual(l.json.boletas.length, 2);
    assert.deepStrictEqual((await leer(m, { query: { ruta: 'honorarios', periodo: '2026-09' }, cookie })).json.boletas, []);
    // validación
    const malo = async (b) => (await m.datos.guardarHonorarios(cuenta, '2026-10', [b])).error;
    assert.match(await malo(B({ fecha: '2026-09-30' })), /de este mes/);
    assert.match(await malo(B({ rut: '12.345.678-0' })), /RUT/);
    assert.match(await malo(B({ nombre: '' })), /nombre/);
    assert.match(await malo(B({ bruto: 0 })), /monto/);
    assert.strictEqual((await m.datos.guardarHonorarios(cuenta, '2026-10', Array.from({ length: 61 }, () => B()))).estado, 400);
    assert.strictEqual((await m.datos.guardarHonorarios(cuenta, '2026-1', [B()])).codigo, 'periodo');
    // exportar
    const x = (await m.datos.exportar(cuenta)).archivo;
    assert.deepStrictEqual(x.honorarios.map(h => [h.periodo, h.boletas.length]), [['2026-10', 2]]);
    // lista vacía borra el mes; borrar la cuenta borra todo
    await m.datos.guardarHonorarios(cuenta, '2026-11', [B({ fecha: '2026-11-02' })]);
    assert.ok((await m.datos.guardarHonorarios(cuenta, '2026-10', [])).ok);
    assert.deepStrictEqual(m.almacen._estado.honorarios.map(h => h.periodo), ['2026-11']);
    assert.ok((await m.datos.borrarCuenta(cuenta, 'ana@ejemplo.cl')).ok);
    assert.strictEqual(m.almacen._estado.honorarios.length, 0);
});

caso('licencias y permisos: se guardan en la ficha con su ruta, editar la ficha sin la lista los conserva y no admite otros datos', async () => {
    const { m, cookie, tid, cuenta } = await conTrabajador();
    const lic = { tipo: 'licencia', desde: '2026-10-05', hasta: '2026-10-10', diagnostico: 'no debe guardarse' };
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'ausencias', trabajador: tid }, metodo: 'PUT', headers: { cookie }, body: { ausencias: [lic] } })).statusCode, 403);
    const r = await escribir(m, { query: { ruta: 'ausencias', trabajador: tid }, metodo: 'PUT', cookie, body: { ausencias: [lic, { tipo: 'sin_goce', desde: '2026-09-01', hasta: '2026-09-01' }] } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.json));
    assert.deepStrictEqual(r.json.trabajador.ausencias.map(a => [a.tipo, a.desde]), [['sin_goce', '2026-09-01'], ['licencia', '2026-10-05']]);
    assert.ok(r.json.trabajador.ausencias.every(a => /^[a-z0-9]{6,20}$/.test(a.id) && !('diagnostico' in a)));
    const actual = (await m.datos.estado(cuenta)).trabajadores[0];
    const { id, ausencias, ...ficha } = actual;
    assert.ok((await m.datos.actualizarTrabajador(cuenta, tid, Object.assign(ficha, { cargo: 'Cajero' }))).ok);
    assert.strictEqual((await m.datos.estado(cuenta)).trabajadores[0].ausencias.length, 2);
    const malo = async (a) => (await m.datos.guardarAusencias(cuenta, tid, [a])).error;
    assert.match(await malo({ tipo: 'licencia', desde: '2026-10-10', hasta: '2026-10-01' }), /anterior/);
    assert.match(await malo({ tipo: 'vacaciones', desde: '2026-10-01', hasta: '2026-10-02' }), /tipo/);
    assert.match(await malo({ tipo: 'licencia', desde: '2026-01-01', hasta: '2027-06-01' }), /hasta un año/);
    assert.deepStrictEqual((await m.datos.guardarAusencias(cuenta, tid, [])).trabajador.ausencias, []);
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
