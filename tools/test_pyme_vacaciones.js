// Pruebas del cálculo de vacaciones del Asistente Pyme (js/pyme_vacaciones.js)
'use strict';
const assert = require('assert');
const V = require('../js/pyme_vacaciones');
const F = require('../js/feriados_cl');

let ok = 0;
function caso(nombre, fn) { fn(); ok++; console.log('  ok  ' + nombre); }

caso('aniversarios: el 29 de febrero pasa al 28 en años no bisiestos', () => {
    assert.strictEqual(V.aniversario('2024-02-29', 1), '2025-02-28');
    assert.strictEqual(V.aniversario('2024-02-29', 4), '2028-02-29');
    assert.strictEqual(V.aniversario('2021-09-15', 5), '2026-09-15');
});
caso('años completos: cuenta el aniversario del mismo día', () => {
    assert.strictEqual(V.aniosCompletos('2023-03-01', '2026-02-28'), 2);
    assert.strictEqual(V.aniosCompletos('2023-03-01', '2026-03-01'), 3);
    assert.strictEqual(V.aniosCompletos('2026-02-01', '2026-10-13'), 0);
});
caso('feriado progresivo: un día por cada tres años nuevos sobre diez (art. 68)', () => {
    assert.deepStrictEqual([9, 10, 12, 13, 15, 16, 19].map(V.progresivo), [0, 0, 0, 1, 1, 2, 3]);
});
caso('derecho: 15 días por año completo, 20 en zona extrema', () => {
    const d = V.derecho({ fechaIngreso: '2023-03-01' }, '2026-10-13');
    assert.strictEqual(d.anios, 3);
    assert.strictEqual(d.total, 45);
    assert.strictEqual(d.proximo, '2027-03-01');
    assert.strictEqual(V.derecho({ fechaIngreso: '2023-03-01', zonaExtrema: true }, '2026-10-13').total, 60);
    assert.strictEqual(V.derecho({ fechaIngreso: '2026-02-01' }, '2026-10-13').total, 0);
    assert.strictEqual(V.derecho({}, '2026-10-13').total, 0);
});
caso('derecho: el progresivo cuenta los años con empleadores anteriores, hasta 10', () => {
    // 4 años en la empresa + 10 anteriores: el aniversario 3 suma 13 años (1 día extra) y el 4 suma 14 (1 día extra)
    const d = V.derecho({ fechaIngreso: '2022-01-10', aniosOtrosEmpleadores: 10 }, '2026-10-13');
    assert.deepStrictEqual(d.porAnio.map(x => x.dias), [15, 15, 16, 16]);
    assert.strictEqual(V.derecho({ fechaIngreso: '2022-01-10', aniosOtrosEmpleadores: 25 }, '2026-10-13').otros, 10);
});
caso('días hábiles: sin sábados, domingos ni feriados (art. 69)', () => {
    assert.strictEqual(V.diasHabiles('2026-11-02', '2026-11-06', F).dias, 5);
    const r = V.diasHabiles('2026-12-07', '2026-12-13', F);
    assert.strictEqual(r.dias, 4, 'el 8 de diciembre es feriado');
    assert.strictEqual(r.sabados, 1);
    assert.ok(r.feriados.some(f => f.fecha === '2026-12-08'));
    assert.throws(() => V.diasHabiles('2026-11-06', '2026-11-02', F), /posterior/);
    assert.throws(() => V.diasHabiles('2026-01-01', '2026-06-30', F), /92/);
});
caso('resumen: saldo, período actual y próximo, avisos', () => {
    const t = { fechaIngreso: '2023-03-01' };
    const regs = [
        { tipo: 'ajuste', fecha: '2026-10-01', dias: 20 },
        { tipo: 'periodo', desde: '2026-10-12', hasta: '2026-10-16', dias: 4 },
        { tipo: 'periodo', desde: '2026-12-21', hasta: '2026-12-24', dias: 4 }
    ];
    const r = V.resumen(t, regs, '2026-10-13');
    assert.strictEqual(r.tomados, 28);
    assert.strictEqual(r.saldo, 17);
    assert.strictEqual(r.actual.desde, '2026-10-12');
    assert.strictEqual(r.proximo.desde, '2026-12-21');
    assert.strictEqual(r.avisos.length, 0);
    assert.ok(V.resumen(t, [{ tipo: 'ajuste', dias: 50 }], '2026-10-13').avisos.some(a => /más días/.test(a.texto)));
    assert.ok(V.resumen({ fechaIngreso: '2019-03-01' }, [], '2026-10-13').avisos.some(a => /art\. 70/.test(a.texto)), 'acumula más de dos períodos');
    assert.ok(V.resumen({}, [], '2026-10-13').avisos.some(a => /fecha de ingreso/.test(a.texto)));
    assert.ok(V.resumen({ fechaIngreso: '2026-02-01' }, [], '2026-10-13').avisos.some(a => /primer año/.test(a.texto)));
});
caso('períodos que se cruzan', () => {
    assert.ok(V.seCruzan({ desde: '2026-10-12', hasta: '2026-10-16' }, { desde: '2026-10-16', hasta: '2026-10-20' }));
    assert.ok(!V.seCruzan({ desde: '2026-10-12', hasta: '2026-10-16' }, { desde: '2026-10-17', hasta: '2026-10-20' }));
});

console.log('\n' + ok + ' pruebas correctas');
