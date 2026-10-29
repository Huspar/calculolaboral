/* Pruebas de la revisión previa de la nómina.  node tools/test_validaciones.js */
'use strict';
const assert = require('assert');
const path = require('path');
const V = require(path.join(__dirname, '..', 'js', 'demo_validaciones.js'));

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

const base = { rut: '12.345.678-5', nombre: 'Camila Rojas', afp: 'cuprum', salud: 'fonasa', dias: 30, sueldo: 1200000 };

function textos(r, o) { return V.lote([r], o).map(x => x.texto).join(' | '); }

caso('un registro correcto no tiene hallazgos', () => {
    assert.deepStrictEqual(V.lote([base], { imm: 553553 }), []);
});

caso('RUT con dígito verificador malo es error', () => {
    const r = Object.assign({}, base, { rut: '12.345.678-9' });
    const h = V.lote([r]);
    assert.strictEqual(h.length, 1);
    assert.strictEqual(h[0].nivel, 'error');
    assert.ok(/dígito/i.test(h[0].texto));
});

caso('RUT repetido es error y apunta a la otra fila', () => {
    const h = V.lote([base, Object.assign({}, base, { nombre: 'Otro' })]);
    assert.ok(h.some(x => /repetido/i.test(x.texto) && /fila 2/.test(x.texto)), JSON.stringify(h));
});

caso('AFP desconocida es error', () => {
    const h = V.lote([Object.assign({}, base, { afp: 'inexistente' })]);
    assert.ok(h.some(x => /AFP/i.test(x.texto)));
});

caso('Isapre sin plan es error', () => {
    const h = V.lote([Object.assign({}, base, { salud: 'isapre', planUF: 0 })]);
    assert.ok(h.some(x => /Isapre sin plan/i.test(x.texto)));
});

caso('días sobre 30 es aviso, no error', () => {
    const h = V.lote([Object.assign({}, base, { dias: 31 })]);
    assert.strictEqual(h.length, 1);
    assert.strictEqual(h[0].nivel, 'aviso');
});

caso('sueldo bajo el mínimo es aviso', () => {
    const h = V.lote([Object.assign({}, base, { sueldo: 400000 })], { imm: 553553 });
    assert.ok(h.some(x => x.nivel === 'aviso' && /mínimo/i.test(x.texto)));
});

caso('cargas sin tramo es aviso', () => {
    const h = V.lote([Object.assign({}, base, { cargas: 2, tramoAF: '' })]);
    assert.ok(h.some(x => /tramo/i.test(x.texto)));
});

caso('la fila que se informa es la del Excel', () => {
    const h = V.lote([base, Object.assign({}, base, { rut: '9.876.543-2' })]);
    assert.strictEqual(h[0].fila, 3);
});

caso('un lote vacío no rompe', () => {
    assert.deepStrictEqual(V.lote([]), []);
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
