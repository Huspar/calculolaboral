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

        const crudo = await sql.query('SELECT encode(datos_cifrados, \'escape\') AS t FROM trabajadores t JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = $1', [cuentaId]);
        assert.ok(crudo.every(f => f.t.indexOf('Trabajador') < 0 && f.t.indexOf('650000') < 0));
        const exportado = (await srv.exportar(cuentaObj)).archivo;
        assert.ok(exportado.trabajadores.length === 5 && exportado.empresa.razonSocial.indexOf('editada') > 0);
        paso('en la base los trabajadores son bytes ilegibles y la exportacion los devuelve completos');

        assert.strictEqual((await srv.borrarCuenta(cuentaObj, 'otro@ejemplo.invalid')).codigo, 'confirmacion');
        assert.ok((await srv.borrarCuenta(cuentaObj, correo)).ok);
        for (const [t, col] of [['sesiones', 'cuenta_id'], ['empresas', 'cuenta_id'], ['pases', 'cuenta_id']]) {
            assert.strictEqual((await sql.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = $1`, [cuentaId]))[0].n, 0, t);
        }
        assert.strictEqual((await sql.query('SELECT count(*)::int AS n FROM trabajadores WHERE empresa_id NOT IN (SELECT id FROM empresas)'))[0].n, 0);
        paso('borrar la cuenta borra sesiones, empresa, trabajadores y pases en cascada');
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
