// Pruebas del libro de remuneraciones del mes para el contador: node tools/test_pyme_libro.js
'use strict';
const assert = require('assert');
const B = require('../js/pyme_libro');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');
const I = require('../js/pyme_importar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

// Valores de octubre de 2026 con la UF y la UTM fijas (sin consultar APIs)
const v = Object.assign({}, P.vigenciaDe('2026-10'), { uf: 39600, utm: 69751 });
const T1 = { nombre: 'Ana Pérez', rut: '15.234.567-4', contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, fechaIngreso: '2022-03-15' };
const T2 = { nombre: 'Bruno Castillo', rut: '19.876.543-0', contrato: 'plazo_fijo', jornadaHoras: 42, afp: 'Uno', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3, sueldoBase: 900000, fechaIngreso: '2026-05-04' };
const calc = (t, extra) => E.calcular({ trabajador: t, mes: Object.assign(L.mesBase(t, '2026-10'), extra), periodo: '2026-10', tasaMutual: 0 }, v);

caso('cada fila cuadra: imponibles, haberes y descuentos suman sus totales, y el líquido es haberes menos descuentos', () => {
    [calc(T1, { horasExtra: 5, comisiones: 30000, otrosNoImponibles: [{ nombre: 'Aguinaldo', monto: 20000 }], anticipo: 100000 }), calc(T2)].forEach((res, i) => {
        const f = B.fila(i ? T2 : T1, res);
        assert.strictEqual(f.sueldoBase + f.horasExtra + f.gratificacion + f.otrosImponibles, f.totalImponible);
        assert.strictEqual(f.totalImponible + f.colMov + f.otrosNoImponibles, f.totalHaberes);
        assert.strictEqual(f.afp + f.salud + f.afc + f.impuesto + f.otrosDescuentos, f.totalDescuentos);
        assert.strictEqual(f.totalHaberes - f.totalDescuentos, f.liquido);
        assert.strictEqual(f.costo, f.totalHaberes + f.aportesEmpleador);
        assert.ok(f.otrosImponibles >= 0 && f.otrosNoImponibles >= 0 && f.otrosDescuentos >= 0);
    });
    const f1 = B.fila(T1, calc(T1, { horasExtra: 5, comisiones: 30000, otrosNoImponibles: [{ nombre: 'Aguinaldo', monto: 20000 }], anticipo: 100000 }));
    assert.deepStrictEqual([f1.sueldoBase, f1.otrosImponibles, f1.colMov, f1.otrosNoImponibles, f1.dias], [650000, 30000, 70000, 20000, 30]);
    assert.ok(f1.otrosDescuentos >= 100000, 'el anticipo va en otros descuentos');
});
caso('los totales suman las filas y el archivo se lee con el mismo lector de planillas', () => {
    const filas = [B.fila(T1, calc(T1)), B.fila(T2, calc(T2))];
    const tot = B.totales(filas);
    assert.strictEqual(tot.liquido, filas[0].liquido + filas[1].liquido);
    assert.strictEqual(tot.costo, filas[0].costo + filas[1].costo);
    const texto = B.csv({ empresa: { razonSocial: 'Panadería "Los Aromos"; SpA', rut: '76.543.210-3' }, periodoNombre: 'octubre 2026' }, filas);
    const lineas = I.leerCsv(texto);
    assert.strictEqual(lineas[0][0], 'Libro de remuneraciones de octubre 2026');
    assert.strictEqual(lineas[1][0], 'Panadería "Los Aromos"; SpA');
    const enc = lineas[2];
    assert.deepStrictEqual(enc, B.COLUMNAS.map(c => c.titulo));
    assert.strictEqual(lineas[3][1], 'Ana Pérez');
    assert.strictEqual(+lineas[5][enc.indexOf('Líquido a pagar')], tot.liquido);
    assert.ok(/No reemplaza al Libro de Remuneraciones Electrónico/.test(texto));
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
