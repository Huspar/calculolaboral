// Pruebas del esquema y del script de migraciones (no necesitan base de datos): node tools/test_db_migrate.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('./db_migrate');

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

const dir = path.join(__dirname, '..', 'db', 'migrations');
const reales = M.listarMigraciones(dir);
const sqlTodo = reales.map(m => m.sql).join('\n');

caso('hay al menos una migracion y la primera es la 001', () => {
    assert.ok(reales.length >= 1);
    assert.strictEqual(reales[0].nombre.slice(0, 3), '001');
});
caso('la huella no depende de los saltos de linea (CRLF o LF)', () => {
    assert.strictEqual(M.huella('a\r\nb'), M.huella('a\nb'));
    assert.notStrictEqual(M.huella('a'), M.huella('b'));
});
caso('rechaza nombres mal formados y numeros repetidos', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.writeFileSync(path.join(tmp, '001_a.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(tmp, '001_b.sql'), 'SELECT 1;');
    assert.throws(() => M.listarMigraciones(tmp), /repetido/);
    fs.unlinkSync(path.join(tmp, '001_b.sql'));
    fs.writeFileSync(path.join(tmp, 'MalNombre.sql'), 'SELECT 1;');
    assert.throws(() => M.listarMigraciones(tmp), /invalido/);
});
caso('planear separa pendientes, aplicadas, alteradas y huerfanas', () => {
    const mig = [{ nombre: '001_a.sql', huella: 'h1' }, { nombre: '002_b.sql', huella: 'h2' }, { nombre: '003_c.sql', huella: 'h3' }];
    const aplicadas = [{ nombre: '001_a.sql', huella: 'h1' }, { nombre: '002_b.sql', huella: 'OTRA' }, { nombre: '000_vieja.sql', huella: 'x' }];
    const p = M.planear(mig, aplicadas);
    assert.deepStrictEqual(p.aplicadas.map(m => m.nombre), ['001_a.sql']);
    assert.deepStrictEqual(p.alteradas.map(m => m.nombre), ['002_b.sql']);
    assert.deepStrictEqual(p.pendientes.map(m => m.nombre), ['003_c.sql']);
    assert.deepStrictEqual(p.huerfanas, ['000_vieja.sql']);
});
caso('servidorDe no devuelve usuario ni clave', () => {
    const s = M.servidorDe('postgresql://usuario:secreta@ep-algo.sa-east-1.aws.neon.tech/asistente?sslmode=require');
    assert.strictEqual(s, 'ep-algo.sa-east-1.aws.neon.tech');
    assert.ok(s.indexOf('secreta') < 0 && s.indexOf('usuario') < 0);
    assert.strictEqual(M.servidorDe('no es una url'), null);
});
caso('conSslEstricto fija verify-full y conserva el resto de la direccion', () => {
    const u = M.conSslEstricto('postgresql://usuario:clave@ep-algo.sa-east-1.aws.neon.tech/asistente?sslmode=require&channel_binding=require');
    const x = new URL(u);
    assert.strictEqual(x.searchParams.get('sslmode'), 'verify-full');
    assert.strictEqual(x.searchParams.get('channel_binding'), 'require');
    assert.strictEqual(x.username, 'usuario');
    assert.strictEqual(x.password, 'clave');
    assert.strictEqual(x.host, 'ep-algo.sa-east-1.aws.neon.tech');
    assert.strictEqual(x.pathname, '/asistente');
    assert.strictEqual(new URL(M.conSslEstricto('postgresql://u:p@h.neon.tech/db')).searchParams.get('sslmode'), 'verify-full');
});
caso('produccion exige --confirmar-produccion para aplicar, no para ver el estado', () => {
    assert.throws(() => M.leerArgumentos(['--entorno=produccion']), /confirmar-produccion/);
    assert.doesNotThrow(() => M.leerArgumentos(['--entorno=produccion', '--estado']));
    assert.doesNotThrow(() => M.leerArgumentos(['--entorno=produccion', '--confirmar-produccion']));
    assert.doesNotThrow(() => M.leerArgumentos(['--entorno=pruebas']));
    assert.throws(() => M.leerArgumentos([]), /entorno/);
    assert.throws(() => M.leerArgumentos(['--entorno=pruebas', '--raro']), /desconocido/);
});

// Reglas del esquema (leyendo el SQL como texto)
function tablas(sql) {
    const out = [];
    const re = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g;
    let m;
    while ((m = re.exec(sql))) out.push({ nombre: m[1], cuerpo: m[2] });
    return out;
}
const T = tablas(sqlTodo);

caso('el esquema define las 11 tablas del plan', () => {
    const esperadas = ['cuentas', 'enlaces_acceso', 'sesiones', 'empresas', 'trabajadores', 'vacaciones', 'meses', 'documentos', 'pases', 'intentos', 'auditoria'];
    esperadas.forEach(n => assert.ok(T.some(t => t.nombre === n), 'falta la tabla ' + n));
});
caso('toda tabla con datos_cifrados tiene version_clave', () => {
    T.filter(t => /datos_cifrados/.test(t.cuerpo)).forEach(t => assert.ok(/version_clave/.test(t.cuerpo), t.nombre + ' sin version_clave'));
});
caso('ninguna columna guarda datos personales en claro', () => {
    const prohibidas = ['rut', 'nombre', 'apellido', 'sueldo', 'domicilio', 'direccion', 'telefono', 'cargo', 'fecha_nacimiento', 'salud', 'afp'];
    T.forEach(t => {
        t.cuerpo.split('\n').forEach(linea => {
            const col = (/^\s+(\w+)\s/.exec(linea) || [])[1];
            if (col && !/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK)$/i.test(col)) assert.ok(prohibidas.indexOf(col) < 0, t.nombre + '.' + col + ' deberia ir cifrado');
        });
    });
});
caso('los tokens se guardan solo como hash', () => {
    assert.ok(/token_hash\s+text NOT NULL UNIQUE/.test(sqlTodo));
    assert.ok(!/\btoken\s+text/.test(sqlTodo), 'hay una columna "token" en claro');
});
caso('borrar la cuenta borra todo (cascada) y la auditoria no depende de la cuenta', () => {
    ['sesiones', 'empresas', 'pases'].forEach(n => assert.ok(new RegExp(n + ' \\([\\s\\S]*?REFERENCES cuentas \\(id\\) ON DELETE CASCADE').test(sqlTodo), n));
    ['trabajadores', 'vacaciones', 'meses', 'documentos'].forEach(n => {
        const t = T.find(x => x.nombre === n);
        assert.ok(/ON DELETE CASCADE/.test(t.cuerpo), n + ' sin cascada');
    });
    assert.ok(!/REFERENCES/.test(T.find(t => t.nombre === 'auditoria').cuerpo), 'auditoria no debe tener clave foranea');
});
caso('una orden de Flow no se puede registrar dos veces y el pase tiene vigencia valida', () => {
    assert.ok(/orden_flow\s+text NOT NULL UNIQUE/.test(sqlTodo));
    assert.ok(/CHECK \(vence > desde\)/.test(sqlTodo));
    assert.ok(/producto IN \('pyme3', 'pyme12'\)/.test(sqlTodo));
});
caso('el correo se guarda en minusculas y es unico', () => {
    assert.ok(/email = lower\(email\)/.test(sqlTodo));
    assert.ok(/CREATE UNIQUE INDEX IF NOT EXISTS cuentas_email_idx ON cuentas \(email\)/.test(sqlTodo));
});
caso('la migracion se puede repetir sin error (todo es IF NOT EXISTS)', () => {
    assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(sqlTodo));
    assert.ok(!/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/.test(sqlTodo));
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
