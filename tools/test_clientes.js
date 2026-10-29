/* Pruebas del almacén de clientes de la demo (localStorage simulado).
 *   node tools/test_clientes.js
 */
'use strict';
const assert = require('assert');
const path = require('path');
const C = require(path.join(__dirname, '..', 'js', 'demo_clientes.js'));

function almacenFalso() {
    const m = new Map();
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); }
    };
}

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

const filas = [{ RUT: '12.345.678-5', Nombre: 'Camila Rojas' }, { RUT: '9.876.543-3', Nombre: 'Pedro Soto' }];

caso('guarda y lista un cliente', () => {
    const s = C.crear(almacenFalso());
    assert.strictEqual(s.guardar('Panaderia Los Aromos', filas, 'nomina.xlsx'), true);
    const l = s.listar();
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].nombre, 'Panaderia Los Aromos');
    assert.strictEqual(l[0].trabajadores, 2);
    assert.strictEqual(l[0].archivo, 'nomina.xlsx');
});

caso('recupera las filas guardadas', () => {
    const s = C.crear(almacenFalso());
    s.guardar('Cliente A', filas, 'a.xlsx');
    const c = s.obtener('cliente a');
    assert.strictEqual(c.filas.length, 2);
    assert.strictEqual(c.filas[0].RUT, '12.345.678-5');
});

caso('guardar el mismo cliente lo reemplaza, no lo duplica', () => {
    const s = C.crear(almacenFalso());
    s.guardar('Cliente A', filas, 'a.xlsx');
    s.guardar('Cliente A', [filas[0]], 'a2.xlsx');
    const l = s.listar();
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].trabajadores, 1);
});

caso('sin nombre o sin filas falla con un mensaje claro', () => {
    const s = C.crear(almacenFalso());
    assert.throws(() => s.guardar('', filas), /nombre/i);
    assert.throws(() => s.guardar('Cliente', []), /nómina|nomina/i);
});

caso('borra un cliente y deja los demás', () => {
    const s = C.crear(almacenFalso());
    s.guardar('Cliente A', filas, '');
    s.guardar('Cliente B', filas, '');
    s.borrar('cliente a');
    const l = s.listar();
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].nombre, 'Cliente B');
});

caso('un almacén corrupto no rompe la página', () => {
    const m = almacenFalso();
    m.setItem(C.CLAVE, 'esto no es json');
    const s = C.crear(m);
    assert.deepStrictEqual(s.listar(), []);
});

caso('el límite de clientes se respeta', () => {
    const s = C.crear(almacenFalso());
    for (let i = 0; i < 45; i++) s.guardar('Cliente ' + i, filas, '');
    assert.ok(s.listar().length <= 40);
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
