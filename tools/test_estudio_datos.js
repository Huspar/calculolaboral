/* Pruebas del servicio de datos del estudio (sin base ni red).  node tools/test_estudio_datos.js */
'use strict';
const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, '..', 'api', '_estudio', 'datos.js'));

function cifradoFalso() {
    const ctx = [];
    return {
        ctx: ctx,
        cifrar: (texto, contexto) => { ctx.push(contexto); return { datos: Buffer.from('x' + texto), version: 1 }; },
        descifrar: (datos, version, contexto) => {
            ctx.push(contexto);
            if (!String(datos).startsWith('x')) throw new Error('datos rotos');
            return String(datos).slice(1);
        }
    };
}

function almacenFalso() {
    const filas = new Map();
    return {
        consulta: async (texto, params) => {
            if (/^\s*SELECT/i.test(texto)) {
                const f = filas.get(params[0]);
                return f ? [{ datos_cifrados: f.datos, version_clave: f.version, actualizado: f.actualizado }] : [];
            }
            filas.set(params[0], { datos: params[1], version: params[2], actualizado: new Date().toISOString() });
            return [];
        }
    };
}

let ok = 0;
function caso(nombre, fn) {
    return Promise.resolve().then(fn).then(
        () => { ok++; console.log('  ok  ' + nombre); },
        e => { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
    );
}

(async () => {
    const cifrado = cifradoFalso();
    const almacen = almacenFalso();
    const svc = E.crear({ consulta: almacen.consulta, cifrado: cifrado });
    const cuenta = '11111111-1111-1111-1111-111111111111';

    await caso('sin fila devuelve vacío', async () => {
        const r = await svc.leer(cuenta);
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.datos, null);
    });

    await caso('guarda y devuelve el estudio', async () => {
        const r = await svc.guardar(cuenta, { clientes: [{ nombre: 'A' }], historial: {} });
        assert.strictEqual(r.ok, true);
        const l = await svc.leer(cuenta);
        assert.deepStrictEqual(l.datos, { clientes: [{ nombre: 'A' }], historial: {} });
    });

    await caso('el cifrado va atado a la cuenta', async () => {
        await svc.guardar(cuenta, { a: 1 });
        assert.ok(cifrado.ctx.every(c => c === 'estudios:' + cuenta), cifrado.ctx.join(','));
    });

    await caso('rechaza datos que no son objeto', async () => {
        assert.strictEqual((await svc.guardar(cuenta, null)).codigo, 'datos_invalidos');
        assert.strictEqual((await svc.guardar(cuenta, [1, 2])).codigo, 'datos_invalidos');
    });

    await caso('rechaza estudios de más de 2 MB', async () => {
        const grande = { relleno: 'x'.repeat(2 * 1024 * 1024 + 10) };
        const r = await svc.guardar(cuenta, grande);
        assert.strictEqual(r.codigo, 'datos_muy_grandes');
        assert.strictEqual(r.estado, 413);
    });

    await caso('guarda dos veces sin duplicar', async () => {
        await svc.guardar(cuenta, { v: 1 });
        await svc.guardar(cuenta, { v: 2 });
        const l = await svc.leer(cuenta);
        assert.deepStrictEqual(l.datos, { v: 2 });
    });

    console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
})();
