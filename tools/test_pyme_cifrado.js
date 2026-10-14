// Pruebas del cifrado y de los tokens del Asistente Pyme (no necesitan base de datos): node tools/test_pyme_cifrado.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const C = require('../api/_pyme/cifrado');
const T = require('../api/_pyme/tokens');

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}
const nuevaClave = () => crypto.randomBytes(32).toString('base64');

const K1 = nuevaClave();
const K2 = nuevaClave();
const cif = C.crear(C.clavesDesdeEntorno({ PYME_DATA_KEY: K1 }));

const trabajador = { nombre: 'María José Núñez Peña', rut: '12.345.678-5', sueldoBase: 650000, cargo: 'Panadera', fechaIngreso: '2022-03-15' };
const CTX = 'trabajadores:7d1f0a52-6a52-4b8e-9a64-9b2f6e1f6a11';

console.log('Cifrado');
caso('cifra y descifra un objeto con tildes y eñes sin perder nada', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    assert.strictEqual(version, 1);
    assert.deepStrictEqual(cif.descifrar(datos, version, CTX), trabajador);
});
caso('lo guardado no contiene el texto original ni el RUT', () => {
    const { datos } = cif.cifrar(trabajador, CTX);
    const texto = datos.toString('latin1') + datos.toString('utf8') + datos.toString('hex');
    ['María', 'Núñez', '12.345.678-5', '650000', 'Panadera'].forEach(s => assert.ok(texto.indexOf(s) < 0, 'aparece ' + s));
});
caso('el formato es vector (12) + etiqueta (16) + texto cifrado', () => {
    const { datos } = cif.cifrar({ a: 1 }, CTX);
    assert.ok(Buffer.isBuffer(datos));
    assert.strictEqual(datos.length, 12 + 16 + Buffer.byteLength(JSON.stringify({ a: 1 })));
});
caso('cada cifrado usa un vector distinto: el mismo dato da resultados distintos', () => {
    const a = cif.cifrar(trabajador, CTX).datos, b = cif.cifrar(trabajador, CTX).datos;
    assert.notStrictEqual(a.toString('hex'), b.toString('hex'));
    assert.notStrictEqual(a.subarray(0, 12).toString('hex'), b.subarray(0, 12).toString('hex'));
});
caso('soporta valores vacios, listas y textos largos', () => {
    [{}, [], [1, 2, { x: 'y' }], { largo: 'ñ'.repeat(50000) }, 'solo texto', 0, null, false].forEach(v => {
        const { datos, version } = cif.cifrar(v, CTX);
        assert.deepStrictEqual(cif.descifrar(datos, version, CTX), v);
    });
});
caso('alterar cualquier parte (vector, etiqueta o texto) hace fallar el descifrado', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    [0, 5, 12, 20, 28, datos.length - 1].forEach(pos => {
        const copia = Buffer.from(datos);
        copia[pos] ^= 0x01;
        assert.throws(() => cif.descifrar(copia, version, CTX), C.ErrorCifrado, 'posicion ' + pos);
    });
    assert.throws(() => cif.descifrar(datos.subarray(0, datos.length - 3), version, CTX), C.ErrorCifrado);
    assert.throws(() => cif.descifrar(Buffer.alloc(5), version, CTX), /incompleto/);
});
caso('un dato copiado a otro registro o a otra cuenta no se puede descifrar (contexto distinto)', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    assert.throws(() => cif.descifrar(datos, version, 'trabajadores:otro-registro'), C.ErrorCifrado);
    assert.throws(() => cif.descifrar(datos, version, 'empresas:7d1f0a52-6a52-4b8e-9a64-9b2f6e1f6a11'), C.ErrorCifrado);
});
caso('exige contexto al cifrar y al descifrar', () => {
    assert.throws(() => cif.cifrar(trabajador), /contexto/);
    assert.throws(() => cif.cifrar(trabajador, ''), /contexto/);
    const { datos, version } = cif.cifrar(trabajador, CTX);
    assert.throws(() => cif.descifrar(datos, version), /contexto/);
});
caso('con otra clave no descifra', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    const otra = C.crear(C.clavesDesdeEntorno({ PYME_DATA_KEY: K2 }));
    assert.throws(() => otra.descifrar(datos, version, CTX), C.ErrorCifrado);
});
caso('el error no revela el contenido ni la clave', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    const otra = C.crear(C.clavesDesdeEntorno({ PYME_DATA_KEY: K2 }));
    try { otra.descifrar(datos, version, CTX); assert.fail('debio fallar'); } catch (e) {
        const msg = e.message + (e.stack || '');
        [K1, K2, 'María', '12.345.678-5', datos.toString('hex'), datos.toString('base64')].forEach(s => assert.ok(msg.indexOf(s) < 0));
    }
});
caso('el mensaje es el mismo para clave, contexto o contenido incorrecto (no da pistas)', () => {
    const { datos, version } = cif.cifrar(trabajador, CTX);
    const alterado = Buffer.from(datos); alterado[30] ^= 1;
    const mensajes = new Set();
    [() => cif.descifrar(alterado, version, CTX), () => cif.descifrar(datos, version, 'otro:ctx'),
        () => C.crear(C.clavesDesdeEntorno({ PYME_DATA_KEY: K2 })).descifrar(datos, version, CTX)].forEach(f => {
        try { f(); } catch (e) { mensajes.add(e.message); }
    });
    assert.strictEqual(mensajes.size, 1);
});

console.log('Claves y rotacion');
caso('rechaza claves ausentes, cortas, largas, con espacios, sin base64 y de un solo byte repetido', () => {
    const malas = [undefined, '', '   ', 'corta', crypto.randomBytes(16).toString('base64'), crypto.randomBytes(48).toString('base64'),
        K1.slice(0, 20) + ' ' + K1.slice(21), '!'.repeat(44), Buffer.alloc(32, 7).toString('base64'), Buffer.alloc(32).toString('base64')];
    malas.forEach(m => assert.throws(() => C.clavesDesdeEntorno({ PYME_DATA_KEY: m }), C.ErrorCifrado, String(m)));
});
caso('acepta la clave con espacios o salto de linea al inicio y al final (pegado desde el portapapeles)', () => {
    assert.doesNotThrow(() => C.clavesDesdeEntorno({ PYME_DATA_KEY: '  ' + K1 + '\r\n' }));
});
caso('el mensaje de una clave mala no incluye la clave', () => {
    try { C.clavesDesdeEntorno({ PYME_DATA_KEY: K1.slice(0, 30) }); assert.fail('debio fallar'); } catch (e) {
        assert.ok(e.message.indexOf(K1.slice(0, 30)) < 0);
    }
});
caso('rotar: con la version 2 se cifra con la nueva y se siguen leyendo los datos de la version 1', () => {
    const viejo = cif.cifrar(trabajador, CTX);
    const rot = C.crear(C.clavesDesdeEntorno({ PYME_DATA_KEY: K1, PYME_DATA_KEY_2: K2, PYME_DATA_KEY_VERSION: '2' }));
    assert.strictEqual(rot.versionActual, 2);
    assert.deepStrictEqual(rot.descifrar(viejo.datos, viejo.version, CTX), trabajador);
    const nuevo = rot.recifrar(viejo.datos, viejo.version, CTX);
    assert.strictEqual(nuevo.version, 2);
    assert.deepStrictEqual(rot.descifrar(nuevo.datos, 2, CTX), trabajador);
    // lo recifrado ya no depende de la clave vieja
    const soloNueva = C.crear({ claves: { 2: Buffer.from(K2, 'base64') }, versionActual: 2 });
    assert.deepStrictEqual(soloNueva.descifrar(nuevo.datos, 2, CTX), trabajador);
    assert.throws(() => soloNueva.descifrar(viejo.datos, 1, CTX), /version 1/);
});
caso('la version actual debe tener clave configurada', () => {
    assert.throws(() => C.clavesDesdeEntorno({ PYME_DATA_KEY: K1, PYME_DATA_KEY_VERSION: '3' }), /version/);
    assert.throws(() => C.clavesDesdeEntorno({ PYME_DATA_KEY: K1, PYME_DATA_KEY_VERSION: 'x' }), /version/);
});

console.log('Tokens y huellas');
const S = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: nuevaClave() });
caso('el token tiene 43 caracteres base64url y no se repite', () => {
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
        const t = T.nuevoToken();
        assert.ok(T.tokenValido(t), t);
        assert.ok(!vistos.has(t));
        vistos.add(t);
    }
});
caso('tokenValido rechaza basura, largo incorrecto y tipos raros', () => {
    ['', 'abc', 'x'.repeat(42), 'x'.repeat(44), 'a'.repeat(42) + '=', 'a'.repeat(42) + '/', null, undefined, 123, {}, ['a'.repeat(43)]].forEach(v => assert.ok(!T.tokenValido(v), String(v)));
});
caso('la huella es estable, con 64 caracteres hex, y no contiene el token', () => {
    const t = T.nuevoToken();
    const h = T.huellaToken(S, 'sesion', t);
    assert.strictEqual(h, T.huellaToken(S, 'sesion', t));
    assert.ok(/^[0-9a-f]{64}$/.test(h));
    assert.ok(h.indexOf(t) < 0);
});
caso('un token de acceso no sirve como token de sesion (dominios distintos)', () => {
    const t = T.nuevoToken();
    assert.notStrictEqual(T.huellaToken(S, 'acceso', t), T.huellaToken(S, 'sesion', t));
    assert.throws(() => T.huellaToken(S, 'otro', t), /desconocido/);
});
caso('con otro secreto la huella cambia (robar la base no alcanza)', () => {
    const t = T.nuevoToken();
    const S2 = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: nuevaClave() });
    assert.notStrictEqual(T.huellaToken(S, 'sesion', t), T.huellaToken(S2, 'sesion', t));
});
caso('la huella del correo ignora mayusculas y espacios; la de IP distingue direcciones', () => {
    assert.strictEqual(T.huellaCorreo(S, ' Ana@Ejemplo.CL '), T.huellaCorreo(S, 'ana@ejemplo.cl'));
    assert.notStrictEqual(T.huellaCorreo(S, 'ana@ejemplo.cl'), T.huellaCorreo(S, 'ana@ejemplo.com'));
    assert.notStrictEqual(T.huellaIp(S, '200.1.2.3'), T.huellaIp(S, '200.1.2.4'));
    assert.notStrictEqual(T.huellaCorreo(S, 'x'), T.huellaIp(S, 'x'));
});
caso('PYME_SESSION_SECRET se valida igual que la clave de datos', () => {
    assert.throws(() => T.secretoDesdeEntorno({}), /PYME_SESSION_SECRET/);
    assert.throws(() => T.secretoDesdeEntorno({ PYME_SESSION_SECRET: 'corto' }), /PYME_SESSION_SECRET/);
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
