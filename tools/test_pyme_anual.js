// Pruebas del resumen anual de remuneraciones (Certificado N°6 y DDJJ 1887): node tools/test_pyme_anual.js
'use strict';
const assert = require('assert');
const A = require('../js/pyme_anual');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');
const V = require('../api/_pyme/validar');
const I = require('../js/pyme_importar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const T = { nombre: 'Carla Rojas', rut: '13.456.789-9', contrato: 'indefinido', jornadaHoras: 42, afp: 'Habitat', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 5, sueldoBase: 1800000, colacion: 50000, movilizacion: 40000, fechaIngreso: '2020-01-10', gratificacion: 'legal' };
const v = (p) => Object.assign({}, P.vigenciaDe(p), { uf: 39600, utm: 69751 });
const calc = (p, extra) => E.calcular({ trabajador: T, mes: Object.assign(L.mesBase(T, p), extra), periodo: p, tasaMutual: 0 }, v(p));

caso('fila del mes: columnas (2) a (5) y (8) del Certificado N°6, cuadradas', () => {
    const res = calc('2026-10', { horasExtra: 4, asignacionFamiliar: 0 });
    const f = A.filaDesdeResultado('2026-10', res);
    assert.strictEqual(f.rentaBruta, res.totalImponible);
    assert.strictEqual(f.rentaAfecta, Math.round(res.bases.baseTributable));
    assert.strictEqual(f.cotizaciones, f.rentaBruta - f.rentaAfecta);
    assert.strictEqual(f.impuesto, res.montos.impuesto);
    assert.ok(f.impuesto > 0, 'con este sueldo hay impuesto');
    assert.strictEqual(f.noGravada, 90000);           // colación + movilización
    assert.strictEqual(f.mes, 'Octubre');
});
caso('el resumen guardado del mes trae la base del impuesto y da la misma fila; el servidor la acepta', () => {
    const res = calc('2026-10');
    const c = L.resumen(res, v('2026-10'), T);
    assert.strictEqual(c.baseTributable, Math.round(res.bases.baseTributable));
    assert.deepStrictEqual(A.filaDesdeCalculo('2026-10', c), A.filaDesdeResultado('2026-10', res));
    const r = V.validarMes(Object.assign(L.mesBase(T, '2026-10'), { calculo: c }));
    assert.ok(r.ok && r.valor.calculo.baseTributable === c.baseTributable, JSON.stringify(r.errores));
    assert.strictEqual(A.filaDesdeCalculo('2026-10', Object.assign({}, c, { baseTributable: undefined })), null, 'meses viejos sin la base: se recalculan');
});
caso('resumen del año: totales sin actualizar mientras no hay factores; con factores, columnas (11) a (16)', () => {
    const filas = ['2026-11', '2026-09', '2026-10'].map(p => A.filaDesdeResultado(p, calc(p)));
    const r = A.resumen(2026, filas);
    assert.strictEqual(r.actualizado, false);
    assert.deepStrictEqual(r.filas.map(f => f.periodo), ['2026-09', '2026-10', '2026-11']);
    assert.strictEqual(r.totales.impuesto, filas.reduce((s, f) => s + f.impuesto, 0));
    A.FACTORES[2099] = Array(12).fill(1.05);
    const r2 = A.resumen(2099, [Object.assign({}, filas[0], { periodo: '2099-03' })]);
    assert.strictEqual(r2.actualizado, true);
    assert.strictEqual(r2.filas[0].impuestoAct, Math.round(filas[0].impuesto * 1.05));
    delete A.FACTORES[2099];
});
caso('planilla para el contador: una fila por trabajador con los meses y el aviso de montos sin actualizar', () => {
    const r = A.resumen(2026, ['2026-09', '2026-10'].map(p => A.filaDesdeResultado(p, calc(p))));
    const texto = A.csv({ empresa: { razonSocial: 'Panadería', rut: '76.543.210-3' }, anio: 2026 }, [{ t: T, resumen: r }]);
    const l = I.leerCsv(texto);
    assert.ok(/sin actualizar/.test(l[0][0]));
    assert.deepStrictEqual(l[3].slice(0, 3), ['13.456.789-9', 'Carla Rojas', '9 10']);
    assert.strictEqual(+l[3][6], r.totales.impuesto);
    assert.ok(/no genera el archivo de la DDJJ 1887/.test(texto));
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
