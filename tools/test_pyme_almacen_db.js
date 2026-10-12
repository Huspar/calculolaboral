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

        // Borrar la cuenta borra todo lo suyo
        await sql.query('DELETE FROM cuentas WHERE id = $1', [cuentaId]);
        for (const t of ['sesiones', 'empresas']) assert.strictEqual((await sql.query(`SELECT count(*)::int AS n FROM ${t} WHERE cuenta_id = $1`, [cuentaId]))[0].n, 0, t);
        paso('borrar la cuenta borra sesiones y empresa en cascada');
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
