// Prueba de integracion de las cuentas contra la base REAL de Neon (rama "pruebas").
//
//   $env:DATABASE_URL_MIGRACION = (Get-Clipboard -Raw).Trim()      # cadena de la rama pruebas, copiada desde Neon
//   node tools/test_pyme_almacen_db.js --entorno=pruebas
//
// Usa correos @ejemplo.invalid y borra todo lo que crea. No envia correos (el envio es un simulador).
// Antes de correrlo: aplicar las migraciones con tools/db_migrate.js.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { crearAlmacenSql } = require('../api/_pyme/almacen');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');

async function main() {
    if (process.argv.indexOf('--entorno=pruebas') < 0) throw new Error('Agrega --entorno=pruebas (confirma que la cadena es la de la rama "pruebas")');
    const url = process.env.DATABASE_URL_MIGRACION;
    if (!url) throw new Error('Falta DATABASE_URL_MIGRACION');
    console.log('Servidor: ' + new URL(url).host);

    const sql = neon(url);
    const almacen = crearAlmacenSql(sql);
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const marca = crypto.randomBytes(4).toString('hex');
    const correo = `prueba-${marca}@ejemplo.invalid`;
    const ips = [`ip-prueba-${marca}-1`, `ip-prueba-${marca}-2`];
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: 'https://calculolaboral.cl', enviarCorreo: async m => { enviados.push(m); } });
    const claves = [T.huellaIp(secreto, ips[0]) + ':entrar', T.huellaCorreo(secreto, correo) + ':entrar'];
    let cuentaId = null, ok = 0;
    const paso = (n) => { ok++; console.log('  ok  ' + n); };

    try {
        // La migracion esta aplicada
        const tablas = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        ['cuentas', 'enlaces_acceso', 'sesiones', 'empresas', 'trabajadores', 'vacaciones', 'meses', 'documentos', 'pases', 'intentos', 'auditoria']
            .forEach(t => assert.ok(tablas.some(x => x.table_name === t), 'falta la tabla ' + t + ' (aplica las migraciones)'));
        paso('las 11 tablas existen');

        await auth.solicitarAcceso({ email: correo, ip: ips[0] });
        assert.strictEqual(enviados.length, 1);
        const token = new URL(enviados[0].enlace).searchParams.get('t');
        const filaEnlace = await sql.query('SELECT email, usado FROM enlaces_acceso WHERE token_hash = $1', [T.huellaToken(secreto, 'acceso', token)]);
        assert.strictEqual(filaEnlace.length, 1);
        assert.strictEqual(filaEnlace[0].usado, null);
        const enClaro = await sql.query('SELECT count(*)::int AS n FROM enlaces_acceso WHERE token_hash = $1', [token]);
        assert.strictEqual(enClaro[0].n, 0);
        paso('solicitar: guarda la huella del token, nunca el token');

        assert.deepStrictEqual(await auth.previsualizar(token), { valido: true, correoEnmascarado: 'p***@e***.invalid', requiereAceptar: true });
        paso('previsualizar no consume el enlace');

        assert.deepStrictEqual(await auth.completar({ token, acepto: false, ip: ips[0] }), { ok: false, motivo: 'aceptar' });
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM cuentas WHERE email = $1', [correo]))[0].n, 0);
        paso('sin aceptar la clausula no se crea la cuenta');

        const [x, y] = await Promise.all([auth.completar({ token, acepto: true, ip: ips[0] }), auth.completar({ token, acepto: true, ip: ips[1] })]);
        assert.strictEqual([x, y].filter(r => r.ok).length, 1, 'el mismo enlace entro dos veces');
        const sesion = (x.ok ? x : y).sesion;
        paso('dos solicitudes simultaneas con el mismo enlace: solo una entra (UPDATE ... RETURNING atomico)');

        const cuenta = (await sql.query('SELECT id, acepto_encargo, ultimo_acceso FROM cuentas WHERE email = $1', [correo]))[0];
        cuentaId = cuenta.id;
        assert.ok(cuenta.acepto_encargo && cuenta.ultimo_acceso);
        const s = await auth.leerSesion(sesion.token);
        assert.ok(s.autenticado && s.email === correo && s.cuentaId === cuentaId);
        assert.deepStrictEqual(await auth.leerSesion(T.nuevoToken()), { autenticado: false });
        paso('la cuenta guarda la aceptacion y la sesion la identifica');

        await auth.solicitarAcceso({ email: correo, ip: ips[0] });
        const token2 = new URL(enviados[1].enlace).searchParams.get('t');
        assert.strictEqual((await auth.previsualizar(token2)).requiereAceptar, false);
        const primera = cuenta.acepto_encargo.toISOString ? cuenta.acepto_encargo.toISOString() : String(cuenta.acepto_encargo);
        assert.ok((await auth.completar({ token: token2, ip: ips[0] })).ok);
        const despues = (await sql.query('SELECT acepto_encargo FROM cuentas WHERE email = $1', [correo]))[0].acepto_encargo;
        assert.strictEqual(new Date(despues).toISOString(), new Date(primera).toISOString());
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM cuentas WHERE email = $1', [correo]))[0].n, 1);
        paso('volver a entrar no duplica la cuenta ni cambia la primera aceptacion');

        const cont = await sql.query('SELECT cuenta FROM intentos WHERE clave = $1', [claves[1]]);
        assert.ok(cont.length >= 1 && Number(cont[0].cuenta) >= 2);
        paso('el contador de intentos suma por ventana de una hora');

        await auth.cerrar(sesion.token, ips[0]);
        assert.deepStrictEqual(await auth.leerSesion(sesion.token), { autenticado: false });
        const aud = await sql.query('SELECT evento, ip_hash FROM auditoria WHERE cuenta_id = $1', [cuentaId]);
        assert.ok(aud.length >= 2 && aud.every(a => /^[0-9a-f]{64}$/.test(a.ip_hash)));
        paso('cerrar sesion la revoca y la auditoria guarda solo la huella de la IP');

        // Cifrado: lo guardado en bytea vuelve igual y la base no ve los datos
        const cif = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
        const ctx = 'empresas:' + cuentaId;
        const datos = { razonSocial: 'Panadería La Espiga Ltda.', rut: '76.845.123-K', representante: 'Manuel Lagos' };
        const c = cif.cifrar(datos, ctx);
        await sql.query('INSERT INTO empresas (cuenta_id, datos_cifrados, version_clave) VALUES ($1, $2, $3)', [cuentaId, c.datos, c.version]);
        const fila = (await sql.query('SELECT datos_cifrados, version_clave FROM empresas WHERE cuenta_id = $1', [cuentaId]))[0];
        assert.deepStrictEqual(cif.descifrar(Buffer.from(fila.datos_cifrados), fila.version_clave, ctx), datos);
        const busca = await sql.query("SELECT count(*)::int AS n FROM empresas WHERE position('Espiga'::bytea IN datos_cifrados) > 0");
        assert.strictEqual(busca[0].n, 0);
        paso('bytea: lo cifrado se guarda y se descifra igual; la base no contiene el texto');

        // ---- Servicio de datos contra la base real ----
        await sql.query('DELETE FROM empresas WHERE cuenta_id = $1', [cuentaId]);
        const srv = require('../api/_pyme/datos').crear({ almacen, cifrado: cif });
        const cuentaObj = { cuentaId, email: correo };
        const rutDe = (n) => { let s = 0, m = 2; for (let i = String(n).length - 1; i >= 0; i--) { s += +String(n)[i] * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return require('../js/rut_cl').formatear(n + (r === 11 ? '0' : r === 10 ? 'K' : String(r))); };
        const trab = (n) => ({ nombre: 'Trabajador ' + n, rut: rutDe(10000000 + n), fechaIngreso: '2022-03-15', sueldoBase: 650000 });

        const e1 = await srv.guardarEmpresa(cuentaObj, { razonSocial: 'Panadería La Espiga Ltda.', rut: rutDe(76845123) });
        assert.ok(e1.ok);
        await srv.guardarEmpresa(cuentaObj, { razonSocial: 'Panadería La Espiga Ltda. (editada)', rut: rutDe(76845123) });
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM empresas WHERE cuenta_id = $1', [cuentaId]))[0].n, 1);
        assert.strictEqual((await srv.estado(cuentaObj)).empresa.razonSocial, 'Panadería La Espiga Ltda. (editada)');
        paso('guardar la empresa dos veces actualiza la misma fila (upsert) y se descifra bien');

        assert.ok((await srv.crearTrabajador(cuentaObj, trab(1))).ok);
        assert.strictEqual((await srv.crearTrabajador(cuentaObj, trab(2))).codigo, 'limite');
        paso('sin pase solo entra 1 trabajador activo');

        await sql.query("INSERT INTO pases (cuenta_id, producto, orden_flow, desde, vence) VALUES ($1, 'pyme3', $2, now() - interval '1 day', now() + interval '30 days')", [cuentaId, 'TEST-' + marca]);
        assert.strictEqual((await srv.estado(cuentaObj)).limites.maxActivos, 5);
        const resultados = await Promise.all([2, 3, 4, 5, 6, 7, 8].map(n => srv.crearTrabajador(cuentaObj, trab(n))));
        const entraron = resultados.filter(r => r.ok).length;
        assert.strictEqual(entraron, 4, 'con pase y 1 existente deben entrar exactamente 4 mas, entraron ' + entraron);
        const activos = (await sql.query('SELECT count(*)::int AS n FROM trabajadores t JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = $1 AND t.activo', [cuentaId]))[0].n;
        assert.strictEqual(activos, 5);
        paso('con pase: 7 altas simultaneas dejan exactamente 5 activos (el limite lo aplica la propia sentencia SQL)');

        const lista = (await srv.estado(cuentaObj)).trabajadores;
        const { id: idPrimero, ...resto } = lista[0];
        assert.ok((await srv.actualizarTrabajador(cuentaObj, idPrimero, { ...resto, activo: false })).ok);
        assert.ok((await srv.crearTrabajador(cuentaObj, trab(9))).ok);
        assert.strictEqual((await srv.actualizarTrabajador(cuentaObj, idPrimero, { ...resto, activo: true })).codigo, 'limite');
        assert.ok((await srv.borrarTrabajador(cuentaObj, lista[1].id)).ok);
        assert.ok((await srv.actualizarTrabajador(cuentaObj, idPrimero, { ...resto, activo: true })).ok);
        paso('desactivar, reactivar con el limite y borrar funcionan');

        // Un trabajador de otra cuenta no se puede tocar con un id ajeno
        const otra = (await sql.query('INSERT INTO cuentas (email) VALUES ($1) RETURNING id', ['otra-' + marca + '@ejemplo.invalid']))[0].id;
        const cuentaOtra = { cuentaId: otra, email: 'otra-' + marca + '@ejemplo.invalid' };
        await srv.guardarEmpresa(cuentaOtra, { razonSocial: 'Otra', rut: rutDe(76111111) });
        assert.strictEqual((await srv.actualizarTrabajador(cuentaOtra, idPrimero, trab(1))).codigo, 'no_existe');
        assert.strictEqual((await srv.borrarTrabajador(cuentaOtra, idPrimero)).codigo, 'no_existe');
        assert.strictEqual((await srv.estado(cuentaOtra)).trabajadores.length, 0);
        await sql.query('DELETE FROM cuentas WHERE id = $1', [otra]);
        paso('una cuenta no puede editar ni borrar trabajadores de otra');

        const crudo = await sql.query('SELECT encode(t.datos_cifrados, \'escape\') AS t FROM trabajadores t JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = $1', [cuentaId]);
        assert.ok(crudo.every(f => f.t.indexOf('Trabajador') < 0 && f.t.indexOf('650000') < 0));
        const exportado = (await srv.exportar(cuentaObj)).archivo;
        assert.ok(exportado.trabajadores.length === 5 && exportado.empresa.razonSocial.indexOf('editada') > 0);
        paso('en la base los trabajadores son bytes ilegibles y la exportacion los devuelve completos');

        // ---- Meses de liquidacion contra la base real ----
        const empresaId = (await almacen.obtenerEmpresa(cuentaId)).id;
        const tid = (await srv.estado(cuentaObj)).trabajadores[0].id;
        const CALC = { liquido: 612345, totalHaberes: 800000, totalImponible: 720000, totalDescuentos: 187655, uf: 41130.94, utm: 72151 };
        const mesEj = (extra) => Object.assign({ diasTrabajados: 30, horasExtra: 4, bonosImponibles: [{ nombre: 'Bono de producción', monto: 50000 }], calculo: CALC }, extra);
        assert.ok((await srv.guardarMes(cuentaObj, tid, '2026-09', mesEj())).ok);
        assert.ok((await srv.guardarMes(cuentaObj, tid, '2026-09', mesEj({ diasTrabajados: 20 }))).ok);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM meses WHERE trabajador_id = $1', [tid]))[0].n, 1);
        const leidos = (await srv.meses(cuentaObj, '2026-09')).meses;
        assert.ok(leidos.length === 1 && leidos[0].mes.diasTrabajados === 20 && leidos[0].mes.calculo.liquido === 612345);
        paso('guardar el mismo mes dos veces reemplaza la fila (restriccion unica) y se descifra bien');

        const crudoMes = await sql.query("SELECT encode(datos_cifrados, 'escape') AS t FROM meses WHERE trabajador_id = $1", [tid]);
        assert.ok(crudoMes.every(f => f.t.indexOf('Bono') < 0 && f.t.indexOf('612345') < 0));
        paso('en la base los meses son bytes ilegibles');

        assert.ok((await srv.guardarMes(cuentaObj, tid, '2026-08', mesEj())).ok);
        assert.strictEqual((await almacen.guardarMes({ trabajadorId: tid, empresaId, periodo: '2026-07', datos: Buffer.from('x'), version: 1, ahoraIso: new Date().toISOString(), maxMeses: 2 })), false);
        assert.strictEqual((await almacen.guardarMes({ trabajadorId: tid, empresaId, periodo: '2026-08', datos: Buffer.from('x'), version: 1, ahoraIso: new Date().toISOString(), maxMeses: 2 })), true);
        await srv.guardarMes(cuentaObj, tid, '2026-08', mesEj());
        paso('el maximo de meses por trabajador lo aplica la sentencia SQL, y reemplazar un mes existente siempre se puede');

        const otraC = (await sql.query('INSERT INTO cuentas (email) VALUES ($1) RETURNING id', ['otra2-' + marca + '@ejemplo.invalid']))[0].id;
        const cuentaOtra2 = { cuentaId: otraC, email: 'otra2-' + marca + '@ejemplo.invalid' };
        await srv.guardarEmpresa(cuentaOtra2, { razonSocial: 'Otra', rut: rutDe(76111112) });
        assert.strictEqual((await srv.guardarMes(cuentaOtra2, tid, '2026-09', mesEj())).codigo, 'no_existe');
        assert.strictEqual((await srv.borrarMes(cuentaOtra2, tid, '2026-09')).codigo, 'no_existe');
        assert.deepStrictEqual((await srv.meses(cuentaOtra2, '2026-09')).meses, []);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM meses WHERE trabajador_id = $1', [tid]))[0].n, 2);
        await sql.query('DELETE FROM cuentas WHERE id = $1', [otraC]);
        paso('una cuenta no puede guardar, leer ni borrar meses de un trabajador de otra');

        assert.strictEqual((await srv.exportar(cuentaObj)).archivo.meses.length, 2);
        assert.ok((await srv.borrarMes(cuentaObj, tid, '2026-08')).ok);
        assert.strictEqual((await srv.borrarMes(cuentaObj, tid, '2026-08')).codigo, 'no_existe');
        await srv.guardarMes(cuentaObj, tid, '2026-08', mesEj());
        paso('exportar incluye los meses; borrar un mes lo elimina');

        // ---- Documentos emitidos contra la base real ----
        assert.ok((await srv.registrarDocumento(cuentaObj, tid, 'carta_161')).ok);
        assert.ok((await srv.registrarDocumento(cuentaObj, tid, 'anexo_datos')).ok);
        assert.strictEqual((await srv.registrarDocumento(cuentaObj, tid, 'documento_inventado')).codigo, 'tipo');
        const filasDoc = await sql.query('SELECT tipo FROM documentos WHERE trabajador_id = $1 ORDER BY emitido, id', [tid]);
        assert.deepStrictEqual(filasDoc.map(f => f.tipo), ['carta_161', 'anexo_datos']);
        assert.strictEqual(await almacen.registrarDocumento({ trabajadorId: tid, empresaId, tipo: 'carta_161', ahoraIso: new Date().toISOString(), maximo: 2 }), false);
        const otraD = (await sql.query('INSERT INTO cuentas (email) VALUES ($1) RETURNING id', ['otra3-' + marca + '@ejemplo.invalid']))[0].id;
        const cuentaOtra3 = { cuentaId: otraD, email: 'otra3-' + marca + '@ejemplo.invalid' };
        await srv.guardarEmpresa(cuentaOtra3, { razonSocial: 'Otra', rut: rutDe(76111113) });
        assert.strictEqual((await srv.registrarDocumento(cuentaOtra3, tid, 'carta_161')).codigo, 'no_existe');
        await sql.query('DELETE FROM cuentas WHERE id = $1', [otraD]);
        assert.strictEqual((await srv.exportar(cuentaObj)).archivo.documentos.length, 2);
        // La base admite todos los tipos que registra el servidor (migración 003: anexo de contrato y pacto de horas extra)
        const { TIPOS_DOCUMENTO } = require('../api/_pyme/datos.js');
        const idsTipos = [];
        for (const tipo of TIPOS_DOCUMENTO) idsTipos.push((await sql.query('INSERT INTO documentos (trabajador_id, tipo) VALUES ($1, $2) RETURNING id', [tid, tipo]))[0].id);
        await sql.query('DELETE FROM documentos WHERE id = ANY($1::uuid[])', [idsTipos]);
        assert.strictEqual((await srv.exportar(cuentaObj)).archivo.documentos.length, 2);
        assert.ok(!JSON.stringify(await sql.query('SELECT * FROM documentos WHERE trabajador_id = $1', [tid])).includes('Panadería'));
        paso('el registro de documentos guarda solo tipo y fecha, respeta el tipo permitido y el máximo, y no cruza cuentas');

        // ---- Vacaciones contra la base real ----
        const vac = await srv.guardarVacacion(cuentaObj, tid, { tipo: 'periodo', desde: '2026-12-07', hasta: '2026-12-13', nota: 'Fin de año' });
        assert.ok(vac.ok && vac.vacacion.dias === 4, JSON.stringify(vac));
        assert.strictEqual((await srv.guardarVacacion(cuentaObj, tid, { tipo: 'periodo', desde: '2026-12-11', hasta: '2026-12-15' })).codigo, 'se_cruza');
        assert.ok((await srv.guardarVacacion(cuentaObj, tid, { tipo: 'ajuste', dias: 10 })).ok);
        const crudoVac = await sql.query("SELECT encode(v.datos_cifrados, 'escape') AS t FROM vacaciones v WHERE v.trabajador_id = $1", [tid]);
        assert.ok(crudoVac.length === 2 && crudoVac.every(f => f.t.indexOf('Fin de año') < 0));
        assert.deepStrictEqual((await srv.vacaciones(cuentaObj)).vacaciones.map(v => v.tipo), ['periodo', 'ajuste']);
        assert.strictEqual(await almacen.crearVacacion({ id: crypto.randomUUID(), trabajadorId: tid, empresaId, datos: Buffer.from('x'), version: 1, ahoraIso: new Date().toISOString(), maximo: 2 }), false, 'el máximo lo aplica la sentencia con candado');
        assert.ok((await srv.borrarVacacion(cuentaObj, vac.vacacion.id)).ok);
        assert.strictEqual((await srv.documentos(cuentaObj)).documentos.length, 2);
        paso('vacaciones: días hábiles del servidor, cifradas, sin cruces, con máximo y borrado; historial de documentos');

        // ---- Boletas de honorarios contra la base real (migración 002) ----
        const boleta = (extra) => Object.assign({ fecha: '2026-10-05', nombre: 'Prestador de prueba Ñuñoa', rut: '11.111.111-1', numero: 7, bruto: 100000 }, extra);
        const h1 = await srv.guardarHonorarios(cuentaObj, '2026-10', [boleta(), boleta({ fecha: '2026-10-20', retiene: 'prestador' })]);
        assert.ok(h1.ok, JSON.stringify(h1));
        assert.ok((await srv.guardarHonorarios(cuentaObj, '2026-10', [boleta({ bruto: 120000 })])).ok, 'reemplaza la lista del mes');
        assert.deepStrictEqual((await srv.honorarios(cuentaObj, '2026-10')).boletas.map(b => b.bruto), [120000]);
        const crudoHon = await sql.query("SELECT encode(datos_cifrados, 'escape') AS t FROM honorarios WHERE empresa_id = $1", [empresaId]);
        assert.ok(crudoHon.length === 1 && crudoHon[0].t.indexOf('Prestador') < 0, 'el prestador va cifrado');
        assert.ok((await srv.guardarHonorarios(cuentaObj, '2026-11', [boleta({ fecha: '2026-11-03' })])).ok);
        assert.strictEqual(await almacen.guardarHonorarios({ empresaId, periodo: '2026-12', datos: Buffer.from('x'), version: 1, ahoraIso: new Date().toISOString(), maxPeriodos: 2 }), false, 'el máximo de meses lo aplica la sentencia');
        assert.strictEqual(await almacen.guardarHonorarios({ empresaId, periodo: '2026-11', datos: Buffer.from('x'), version: 1, ahoraIso: new Date().toISOString(), maxPeriodos: 2 }), true, 'reemplazar un mes existente sí se puede');
        await srv.guardarHonorarios(cuentaObj, '2026-11', [boleta({ fecha: '2026-11-03' })]);
        assert.ok((await srv.guardarHonorarios(cuentaObj, '2026-11', [])).ok);
        assert.deepStrictEqual((await srv.exportar(cuentaObj)).archivo.honorarios.map(h => h.periodo), ['2026-10']);
        await assert.rejects(() => sql.query("INSERT INTO honorarios (empresa_id, periodo, datos_cifrados, version_clave) VALUES ($1, '2026-13', 'x', 1)", [empresaId]), 'la base rechaza un período inválido');
        paso('honorarios: boletas cifradas por mes, se reemplazan, con máximo de meses, se borran con lista vacía y se exportan');

        // ---- Pase: vigencia en la base real ----
        const ahoraPase = new Date().toISOString();
        const vigenteAntes = await almacen.paseVigente(cuentaId, ahoraPase);
        assert.ok(vigenteAntes > Date.now(), 'el pase de prueba insertado antes sigue vigente');
        const nuevoPase = await almacen.registrarPase({ cuentaId, producto: 'pyme3', ordenFlow: 'PRUEBA-A-' + marca, dias: 92, ahoraIso: ahoraPase });
        assert.strictEqual(nuevoPase.desde, vigenteAntes, 'el pase nuevo empieza cuando termina el que ya tenia');
        assert.ok(Math.abs(nuevoPase.vence - (vigenteAntes + 92 * 86400000)) < 1000);
        assert.strictEqual(await almacen.registrarPase({ cuentaId, producto: 'pyme3', ordenFlow: 'PRUEBA-A-' + marca, dias: 92, ahoraIso: ahoraPase }), null, 'la misma orden de Flow no suma dos veces');
        assert.strictEqual(await almacen.paseVigente(cuentaId, ahoraPase), nuevoPase.vence, 'la vigencia cuenta el pase encolado');
        assert.strictEqual((await almacen.paseActual(cuentaId, ahoraPase)).producto, 'pyme3');
        assert.strictEqual((await almacen.paseDeOrden('PRUEBA-A-' + marca)).cuentaId, cuentaId);
        assert.strictEqual((await almacen.buscarCuentaPorId(cuentaId)).email, correo);
        assert.strictEqual(await almacen.buscarCuentaPorId(crypto.randomUUID()), null);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM pases WHERE cuenta_id = $1', [cuentaId]))[0].n, 2);
        const lejano = new Date(Date.now() + 400 * 86400000).toISOString();
        assert.strictEqual(await almacen.paseVigente(cuentaId, lejano), null, 'vencidos los dos, no hay pase');
        const paseDoce = await almacen.registrarPase({ cuentaId, producto: 'pyme12', ordenFlow: 'PRUEBA-B-' + marca, dias: 366, ahoraIso: lejano });
        assert.ok(Math.abs(paseDoce.desde - Date.parse(lejano)) < 1000, 'con todo vencido empieza en la fecha de la compra');
        await assert.rejects(() => almacen.registrarPase({ cuentaId, producto: 'otro', ordenFlow: 'PRUEBA-C-' + marca, dias: 5, ahoraIso: ahoraPase }), 'la base solo admite pyme3 y pyme12');
        paso('pase: se suma al que ya tiene, la orden de Flow es unica, la vigencia cuenta lo encolado y la base solo admite los productos del pase');

        assert.strictEqual((await srv.borrarCuenta(cuentaObj, 'otro@ejemplo.invalid')).codigo, 'confirmacion');
        assert.ok((await srv.borrarCuenta(cuentaObj, correo)).ok);
        for (const [t, col] of [['sesiones', 'cuenta_id'], ['empresas', 'cuenta_id'], ['pases', 'cuenta_id']]) {
            assert.strictEqual((await sql.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = $1`, [cuentaId]))[0].n, 0, t);
        }
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM trabajadores WHERE empresa_id NOT IN (SELECT id FROM empresas)'))[0].n, 0);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM meses WHERE trabajador_id NOT IN (SELECT id FROM trabajadores)'))[0].n, 0);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM meses WHERE trabajador_id = $1', [tid]))[0].n, 0);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM documentos WHERE trabajador_id = $1', [tid]))[0].n, 0);
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM honorarios WHERE empresa_id = $1', [empresaId]))[0].n, 0);
        paso('borrar la cuenta borra sesiones, empresa, trabajadores, meses, honorarios y pases en cascada');
        cuentaId = null;
        console.log('\n' + ok + ' pruebas correctas contra la base real');
    } finally {
        // Limpieza de todo lo creado por esta prueba
        if (cuentaId) { await sql.query('DELETE FROM cuentas WHERE id = $1', [cuentaId]); await sql.query('DELETE FROM auditoria WHERE cuenta_id = $1', [cuentaId]); }
        await sql.query('DELETE FROM enlaces_acceso WHERE email = $1', [correo]);
        await sql.query('DELETE FROM intentos WHERE clave = ANY($1::text[])', [claves]);
        await sql.query('DELETE FROM auditoria WHERE ip_hash = ANY($1::text[])', [ips.map(ip => T.huellaIp(secreto, ip))]);
    }
}

main().catch(e => { console.error('FALLA: ' + e.message); process.exit(1); });
