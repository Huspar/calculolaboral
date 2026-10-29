/* Pruebas del respaldo del estudio.  node tools/test_respaldo.js */
'use strict';
const assert = require('assert');
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'demo_respaldo.js'));

function almacenFalso(inicial) {
    const m = new Map(Object.entries(inicial || {}));
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

const clientes = [{ nombre: 'A', filas: [{ RUT: '1-9' }], archivo: 'a.xlsx' }];
const historial = { a: [{ periodo: '2026-10', trabajadores: 1, liquido: 100, costo: 120 }] };

caso('exporta clientes e historial', () => {
    const s = almacenFalso({ 'cl-clientes-liq': JSON.stringify(clientes), 'cl-historial-liq': JSON.stringify(historial) });
    const datos = JSON.parse(R.crear(s).exportar());
    assert.strictEqual(datos.version, 1);
    assert.strictEqual(datos.clientes.length, 1);
    assert.strictEqual(datos.clientes[0].nombre, 'A');
    assert.strictEqual(datos.historial.a.length, 1);
});

caso('restaura en un navegador vacio', () => {
    const origen = R.crear(almacenFalso({ 'cl-clientes-liq': JSON.stringify(clientes), 'cl-historial-liq': JSON.stringify(historial) }));
    const destino = almacenFalso();
    const r = R.crear(destino).importar(origen.exportar());
    assert.strictEqual(r.clientes, 1);
    assert.strictEqual(r.meses, 1);
    assert.strictEqual(JSON.parse(destino.getItem('cl-clientes-liq'))[0].nombre, 'A');
});

caso('reemplaza el cliente del mismo nombre y no lo duplica', () => {
    const destino = almacenFalso({ 'cl-clientes-liq': JSON.stringify([{ nombre: 'a', filas: [{ RUT: 'viejo' }] }]) });
    const origen = R.crear(almacenFalso({ 'cl-clientes-liq': JSON.stringify(clientes) }));
    const r = R.crear(destino).importar(origen.exportar());
    const lista = JSON.parse(destino.getItem('cl-clientes-liq'));
    assert.strictEqual(lista.length, 1);
    assert.strictEqual(lista[0].filas[0].RUT, '1-9');
    assert.strictEqual(r.reemplazados, 1);
});

caso('un archivo que no es JSON falla con mensaje claro', () => {
    assert.throws(() => R.crear(almacenFalso()).importar('hola'), /JSON/i);
});

caso('un respaldo de otra version se rechaza', () => {
    assert.throws(() => R.crear(almacenFalso()).importar(JSON.stringify({ version: 2, clientes: [] })), /versión|version/i);
});

caso('sin lista de clientes se rechaza', () => {
    assert.throws(() => R.crear(almacenFalso()).importar(JSON.stringify({ version: 1 })), /clientes/i);
});

caso('un cliente sin nombre o sin filas se ignora sin romper', () => {
    const destino = almacenFalso();
    const r = R.crear(destino).importar(JSON.stringify({ version: 1, clientes: [{ nombre: '' }, { nombre: 'B' }], historial: {} }));
    assert.strictEqual(r.clientes, 0);
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
