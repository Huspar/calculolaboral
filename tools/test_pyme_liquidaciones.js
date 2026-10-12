// Pruebas de los valores base de las liquidaciones del Asistente Pyme: node tools/test_pyme_liquidaciones.js
'use strict';
const assert = require('assert');
const L = require('../js/pyme_liquidaciones');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const V = require('../api/_pyme/validar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const T = (extra) => Object.assign({ contrato: 'indefinido', fechaIngreso: '2022-03-15', gratificacion: 'legal' }, extra);

caso('mes completo: 30 días', () => {
    assert.strictEqual(L.diasBase(T(), '2026-09'), 30);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '' }), '2026-09'), 30);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-09-01' }), '2026-09'), 30);
});
caso('ingreso durante el mes: desde ese día hasta el 30 (mes comercial)', () => {
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-09-16' }), '2026-09'), 15);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-31' }), '2026-10'), 1);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-30' }), '2026-10'), 1);
});
caso('aún no ingresaba: 0 días', () => {
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-02' }), '2026-09'), 0);
});
caso('plazo fijo que termina en el mes, o antes', () => {
    const pf = (f, ing) => T({ contrato: 'plazo_fijo', fechaTerminoPlazo: f, fechaIngreso: ing || '2026-01-10' });
    assert.strictEqual(L.diasBase(pf('2026-09-12'), '2026-09'), 12);
    assert.strictEqual(L.diasBase(pf('2026-09-30'), '2026-09'), 30);
    assert.strictEqual(L.diasBase(pf('2026-08-31'), '2026-09'), 0);
    assert.strictEqual(L.diasBase(pf('2026-09-20', '2026-09-10'), '2026-09'), 11);
    assert.strictEqual(L.diasBase(pf('2026-12-31'), '2026-09'), 30);
    // el término solo cuenta en contratos a plazo fijo
    assert.strictEqual(L.diasBase(T({ fechaTerminoPlazo: '2026-09-05' }), '2026-09'), 30);
});
caso('mesBase: gratificación según la ficha y todo lo demás en cero; el servidor lo acepta tal cual', () => {
    assert.strictEqual(L.mesBase(T(), '2026-09').gratificacion, 'legal');
    assert.strictEqual(L.mesBase(T({ gratificacion: 'ninguna' }), '2026-09').gratificacion, 'ninguna');
    assert.strictEqual(L.mesBase(T({ gratificacion: 'pactada' }), '2026-09').gratificacion, 'manual');
    const m = L.mesBase(T(), '2026-09');
    assert.ok(V.validarMes(m).ok, JSON.stringify(V.validarMes(m).errores));
    assert.deepStrictEqual(V.validarMes(m).valor.bonosImponibles, []);
});
caso('resumen del resultado del motor: cumple lo que valida el servidor', () => {
    const vig = P.vigenciaDe('2026-09');
    const mv = { uf: 41000.5, utm: 72151, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp };
    const t = { nombre: 'Ana', rut: '123456785', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 650000, afp: 'Modelo', salud: 'fonasa' };
    const res = E.calcular({ trabajador: t, mes: L.mesBase(t, '2026-09'), periodo: '2026-09' }, mv);
    const r = L.resumen(res, mv);
    assert.ok(r.liquido > 0 && r.liquido < r.totalHaberes);
    const m = Object.assign(L.mesBase(t, '2026-09'), { calculo: r });
    assert.ok(V.validarMes(m).ok, JSON.stringify(V.validarMes(m).errores));
});
caso('estadoDe', () => {
    assert.strictEqual(L.estadoDe(null), 'sin_datos');
    assert.strictEqual(L.estadoDe({ emitida: '' }), 'guardada');
    assert.strictEqual(L.estadoDe({ emitida: '2026-10-05' }), 'emitida');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
