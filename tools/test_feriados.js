// Pruebas de feriados_cl.js (node tools/test_feriados.js)
'use strict';
const assert = require('assert');
const F = require('../js/feriados_cl');

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}
const fechas = anio => F.feriados(anio).map(f => f.fecha);
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaDe = iso => DIAS[new Date(iso + 'T00:00:00Z').getUTCDay()];

// Listas esperadas, escritas a mano a partir de las fuentes (ver docs/asistente-pyme.md, sección 8)
const ESPERADO_2026 = ['2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-21', '2026-06-29', '2026-07-16',
    '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25'];
const ESPERADO_2027 = ['2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21', '2027-06-21', '2027-06-28', '2027-07-16',
    '2027-08-15', '2027-09-17', '2027-09-18', '2027-09-19', '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08', '2027-12-25'];

console.log('Listas verificadas');
caso('2026 coincide con la lista publicada (16 feriados)', () => assert.deepStrictEqual(fechas(2026), ESPERADO_2026));
caso('2026: 10 feriados caen en día de semana y 6 en fin de semana (dato de Chileestuyo.cl)', () => {
    const f = fechas(2026), finde = f.filter(x => ['sábado', 'domingo'].indexOf(diaDe(x)) >= 0);
    assert.strictEqual(f.length - finde.length, 10);
    assert.strictEqual(finde.length, 6);
});
caso('2027 coincide con la lista calculada por ley (17 feriados)', () => assert.deepStrictEqual(fechas(2027), ESPERADO_2027));
caso('2027: San Pedro y San Pablo y Dos Mundos pasan al lunes; el viernes 17-sep es feriado', () => {
    assert.strictEqual(diaDe('2027-06-29'), 'martes');
    assert.strictEqual(diaDe('2027-06-28'), 'lunes');
    assert.ok(F.esFeriado('2027-06-28') && !F.esFeriado('2027-06-29'));
    assert.ok(F.esFeriado('2027-10-11') && !F.esFeriado('2027-10-12'));
    assert.strictEqual(diaDe('2027-09-17'), 'viernes');
    assert.ok(F.esFeriado('2027-09-17'));
    assert.strictEqual(F.nombreFeriado('2027-09-17'), 'Fiestas Patrias (viernes 17)');
});
caso('2026: San Pedro y Dos Mundos caen lunes y no se mueven; no hay 17 ni 20 de septiembre', () => {
    assert.strictEqual(diaDe('2026-06-29'), 'lunes');
    assert.strictEqual(diaDe('2026-10-12'), 'lunes');
    assert.ok(!F.esFeriado('2026-09-17') && !F.esFeriado('2026-09-20'));
});
caso('sin repetidos, ordenados y con base legal', () => {
    [2026, 2027].forEach(a => {
        const f = F.feriados(a);
        assert.strictEqual(new Set(f.map(x => x.fecha)).size, f.length);
        assert.deepStrictEqual(f.map(x => x.fecha), f.map(x => x.fecha).slice().sort());
        f.forEach(x => { assert.ok(x.nombre && x.base, x.fecha); assert.strictEqual(x.fecha.slice(0, 4), String(a)); });
    });
});

console.log('Reglas de la ley (comprobadas en años ya ocurridos)');
const sinSol = anio => F._calcular(anio, { sinSolsticio: true }).map(f => f.fecha);
caso('Pascua: 2025-04-20, 2026-04-05, 2027-03-28', () => {
    assert.strictEqual(F._pascua(2025), '2025-04-20');
    assert.strictEqual(F._pascua(2026), '2026-04-05');
    assert.strictEqual(F._pascua(2027), '2027-03-28');
});
caso('Ley 19.668 en 2022: San Pedro el lunes 27-jun y Dos Mundos el lunes 10-oct', () => {
    const f = sinSol(2022);
    assert.ok(f.indexOf('2022-06-27') >= 0 && f.indexOf('2022-06-29') < 0);
    assert.ok(f.indexOf('2022-10-10') >= 0 && f.indexOf('2022-10-12') < 0);
});
caso('Ley 19.668 en 2023: San Pedro el lunes 26-jun y Dos Mundos el lunes 9-oct', () => {
    const f = sinSol(2023);
    assert.ok(f.indexOf('2023-06-26') >= 0 && f.indexOf('2023-10-09') >= 0);
});
caso('Ley 19.668: viernes, sábado, domingo y lunes no se mueven (2025 domingo, 2024 sábado)', () => {
    assert.ok(sinSol(2025).indexOf('2025-06-29') >= 0 && sinSol(2025).indexOf('2025-10-12') >= 0);
    assert.ok(sinSol(2024).indexOf('2024-06-29') >= 0 && sinSol(2024).indexOf('2024-10-12') >= 0);
});
caso('Ley 20.215: viernes 20-sep en 2024 y 2019; lunes 17-sep en 2018', () => {
    assert.ok(sinSol(2024).indexOf('2024-09-20') >= 0);
    assert.ok(sinSol(2019).indexOf('2019-09-20') >= 0);
    assert.ok(sinSol(2018).indexOf('2018-09-17') >= 0);
});
caso('Ley 20.983: viernes 17-sep en 2021 (el 18 fue sábado)', () => assert.ok(sinSol(2021).indexOf('2021-09-17') >= 0));
caso('Ley 20.299: Iglesias Evangélicas el viernes 27-oct en 2023 (el 31 fue martes)', () => assert.ok(sinSol(2023).indexOf('2023-10-27') >= 0 && sinSol(2023).indexOf('2023-10-31') < 0));

console.log('Cobertura');
caso('solo cubre 2026 y 2027 y se niega a calcular otros años', () => {
    assert.ok(F.cubre(2026) && F.cubre(2027) && !F.cubre(2025) && !F.cubre(2028));
    assert.throws(() => F.feriados(2028), F.ErrorFeriados);
    assert.throws(() => F.esFeriado('2025-12-25'), /No hay feriados verificados para 2025/);
    assert.throws(() => F.esDiaHabil('2028-01-03'), F.ErrorFeriados);
});
caso('el 2027 queda marcado como calculado por ley y el 2026 como confirmado', () => {
    assert.strictEqual(F.VERIFICACION[2026].estado, 'confirmado');
    assert.strictEqual(F.VERIFICACION[2027].estado, 'calculado por ley');
});

console.log('Días hábiles');
caso('sábado y domingo no son hábiles; el sábado sí con sabadoHabil', () => {
    assert.ok(F.esDiaHabil('2026-10-13')); // martes
    assert.ok(!F.esDiaHabil('2026-10-17')); // sábado
    assert.ok(F.esDiaHabil('2026-10-17', { sabadoHabil: true }));
    assert.ok(!F.esDiaHabil('2026-10-18')); // domingo
    assert.ok(!F.esDiaHabil('2026-10-18', { sabadoHabil: true }));
});
caso('un feriado en día de semana no es hábil, aunque sabadoHabil esté activo', () => {
    assert.ok(!F.esDiaHabil('2026-10-12'));
    assert.ok(!F.esDiaHabil('2026-12-25', { sabadoHabil: true }));
    assert.strictEqual(F.nombreFeriado('2026-12-25'), 'Navidad');
    assert.strictEqual(F.nombreFeriado('2026-12-24'), null);
});
caso('siguienteDiaHabil: un sábado de feriado largo pasa al martes', () => {
    assert.strictEqual(F.siguienteDiaHabil('2026-10-13'), '2026-10-13');
    assert.strictEqual(F.siguienteDiaHabil('2026-10-10'), '2026-10-13'); // sábado, domingo, lunes 12 feriado
});
caso('sumarDiasHabiles: salta fines de semana y feriados', () => {
    assert.strictEqual(F.sumarDiasHabiles('2026-12-24', 1), '2026-12-28');                     // 25 feriado, 26 y 27 fin de semana
    assert.strictEqual(F.sumarDiasHabiles('2026-12-24', 1, { sabadoHabil: true }), '2026-12-26');
    assert.strictEqual(F.sumarDiasHabiles('2026-10-09', 3), '2026-10-15');                      // lunes 12 feriado
    assert.strictEqual(F.sumarDiasHabiles('2026-10-09', 0), '2026-10-09');
});
caso('sumarDiasHabiles cruza el cambio de año (31-dic-2026 + 1-ene-2027 feriado)', () => {
    assert.strictEqual(F.sumarDiasHabiles('2026-12-30', 3), '2027-01-05');
});
caso('sumarDiasHabiles falla si el cálculo entra a un año sin cobertura', () => {
    assert.throws(() => F.sumarDiasHabiles('2027-12-30', 3), F.ErrorFeriados);
});
caso('feriadosEntre incluye los extremos y cruza años', () => {
    assert.deepStrictEqual(F.feriadosEntre('2026-12-25', '2027-01-01').map(f => f.fecha), ['2026-12-25', '2027-01-01']);
    assert.deepStrictEqual(F.feriadosEntre('2027-06-21', '2027-06-21').map(f => f.fecha), ['2027-06-21']);
    assert.deepStrictEqual(F.feriadosEntre('2026-12-26', '2026-12-31'), []);
    assert.deepStrictEqual(F.feriadosEntre('2027-01-02', '2026-12-31'), []);
});
caso('rechaza fechas mal escritas o inexistentes', () => {
    ['2026-13-01', '2026-02-30', '26-10-12', '', null, '2026-1-1'].forEach(v => assert.throws(() => F.esFeriado(v), F.ErrorFeriados, String(v)));
});
caso('no depende de la zona horaria del equipo', () => {
    const ant = process.env.TZ;
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
    try { assert.deepStrictEqual(fechas(2027), ESPERADO_2027); assert.strictEqual(F.sumarDiasHabiles('2026-12-24', 1), '2026-12-28'); }
    finally { if (ant === undefined) delete process.env.TZ; else process.env.TZ = ant; }
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
