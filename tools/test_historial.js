/* Pruebas del historial de meses cerrados.  node tools/test_historial.js */
'use strict';
const assert = require('assert');
const path = require('path');
const H = require(path.join(__dirname, '..', 'js', 'demo_historial.js'));

function almacenFalso() {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

caso('cierra un mes y lo lista', () => {
    const h = H.crear(almacenFalso());
    h.cerrar('Panaderia Los Aromos', '2026-10', { trabajadores: 12, liquido: 17420713, costo: 22402654 });
    const l = h.listar('panaderia los aromos');
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].periodo, '2026-10');
    assert.strictEqual(l[0].trabajadores, 12);
    assert.strictEqual(l[0].liquido, 17420713);
});

caso('cerrar el mismo mes lo reemplaza', () => {
    const h = H.crear(almacenFalso());
    h.cerrar('A', '2026-10', { trabajadores: 10, liquido: 100 });
    h.cerrar('A', '2026-10', { trabajadores: 11, liquido: 110 });
    const l = h.listar('A');
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].trabajadores, 11);
});

caso('ordena del mes mas nuevo al mas viejo', () => {
    const h = H.crear(almacenFalso());
    h.cerrar('A', '2026-08', { trabajadores: 1 });
    h.cerrar('A', '2026-10', { trabajadores: 1 });
    h.cerrar('A', '2026-09', { trabajadores: 1 });
    assert.deepStrictEqual(h.listar('A').map(x => x.periodo), ['2026-10', '2026-09', '2026-08']);
});

caso('separa clientes', () => {
    const h = H.crear(almacenFalso());
    h.cerrar('A', '2026-10', { trabajadores: 3 });
    h.cerrar('B', '2026-10', { trabajadores: 7 });
    assert.strictEqual(h.listar('A')[0].trabajadores, 3);
    assert.strictEqual(h.listar('B')[0].trabajadores, 7);
});

caso('exige nombre y periodo valido', () => {
    const h = H.crear(almacenFalso());
    assert.throws(() => h.cerrar('', '2026-10', {}), /cliente/i);
    assert.throws(() => h.cerrar('A', 'octubre', {}), /período|periodo/i);
});

caso('guarda como maximo 24 meses', () => {
    const h = H.crear(almacenFalso());
    for (let i = 1; i <= 30; i++) h.cerrar('A', '2024-' + String(i).padStart(2, '0'), { trabajadores: 1 });
    assert.strictEqual(h.listar('A').length, 24);
});

caso('borra el historial de un cliente', () => {
    const h = H.crear(almacenFalso());
    h.cerrar('A', '2026-10', { trabajadores: 1 });
    h.borrar('a');
    assert.deepStrictEqual(h.listar('A'), []);
});

caso('un almacen corrupto no rompe', () => {
    const m = almacenFalso();
    m.setItem(H.CLAVE, 'no es json');
    const h = H.crear(m);
    assert.deepStrictEqual(h.listar('A'), []);
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
