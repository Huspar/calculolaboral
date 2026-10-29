// Pruebas del resumen del mes de todas las empresas de un estudio: node tools/test_pyme_estudio.js
'use strict';
const assert = require('assert');
const S = require('../js/pyme_estudio');
const L = require('../js/pyme_liquidaciones');
const HON = require('../js/pyme_honorarios');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const I = require('../js/pyme_importar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const PER = '2026-10';
const v = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const TA = { id: 'a', activo: true, nombre: 'Ana', rut: '15.234.567-4', contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 2500000, fechaIngreso: '2022-03-15' };
const TB = { id: 'b', activo: true, nombre: 'Bruno', rut: '19.876.543-0', contrato: 'indefinido', jornadaHoras: 42, afp: 'Uno', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3, sueldoBase: 900000, fechaIngreso: '2020-01-01' };
const TC = { id: 'c', activo: false, nombre: 'Carla', rut: '13.456.789-9', contrato: 'indefinido', afp: 'Habitat', salud: 'fonasa', sueldoBase: 700000, fechaIngreso: '2019-01-01' };
const mes = (t, extra) => {
    const m = Object.assign(L.mesBase(t, PER), extra);
    const res = E.calcular({ trabajador: t, mes: m, periodo: PER, tasaMutual: 0.93 }, v);
    return Object.assign({}, m, { calculo: L.resumen(res, v, t) });
};
const BOL = [{ fecha: '2026-10-05', bruto: 100000, retiene: 'empresa' }, { fecha: '2026-10-20', bruto: 200000, retiene: 'prestador' }];

caso('el resumen de una empresa coincide con lo que calculan los paneles de Previred, F29 y honorarios', () => {
    const meses = { a: mes(TA), b: Object.assign(mes(TB), { emitida: '2026-10-28' }) };
    const r = S.resumenEmpresa({ trabajadores: [TA, TB, TC], meses, boletas: BOL });
    const regs = [meses.a.calculo, meses.b.calculo];
    const prev = L.previred(regs);
    assert.strictEqual(r.activos, 2);
    assert.deepStrictEqual([r.guardadas, r.emitidas], [2, 1]);
    assert.strictEqual(r.previred, prev.total);
    assert.strictEqual(r.impuesto, prev.impuesto);
    assert.ok(r.impuesto > 0, 'el sueldo alto paga impuesto único');
    assert.strictEqual(r.retencion, HON.resumen(BOL).retenidoEmpresa);
    assert.strictEqual(r.retencion, 15250);
    assert.strictEqual(r.costo, prev.costo);
    assert.strictEqual(r.liquido, meses.a.calculo.liquido + meses.b.calculo.liquido);
    assert.strictEqual(r.sinDesglose, 0);
});

caso('una empresa vacía o con meses sin desglose no rompe y lo dice', () => {
    const vacia = S.resumenEmpresa({ trabajadores: [], meses: {}, boletas: [] });
    assert.deepStrictEqual([vacia.activos, vacia.guardadas, vacia.previred, vacia.impuesto, vacia.retencion], [0, 0, 0, 0, 0]);
    const viejo = mes(TA); delete viejo.calculo.conDesglose;
    const r = S.resumenEmpresa({ trabajadores: [TA], meses: { a: viejo, x: null, y: Object.assign({}, mes(TB), { calculo: null }) } });
    assert.strictEqual(r.guardadas, 2); assert.strictEqual(r.sinDesglose, 2); assert.strictEqual(r.previred, 0);
    assert.doesNotThrow(() => S.resumenEmpresa({}));
});

caso('los totales suman cada columna y el CSV se lee con el mismo lector de planillas, con la fila de totales', () => {
    const f1 = Object.assign({ empresa: 'Panadería "Los Aromos"; SpA', rut: '76.543.210-3' }, S.resumenEmpresa({ trabajadores: [TA], meses: { a: mes(TA) }, boletas: BOL }));
    const f2 = Object.assign({ empresa: 'Ferretería El Clavo', rut: '76.111.222-3' }, S.resumenEmpresa({ trabajadores: [TB], meses: { b: mes(TB) }, boletas: [] }));
    const t = S.totales([f1, f2]);
    assert.strictEqual(t.previred, f1.previred + f2.previred);
    assert.strictEqual(t.retencion, 15250);
    const filas = I.leerCsv(S.csv({ periodoNombre: 'octubre 2026' }, [f1, f2]));
    const cab = filas.findIndex(f => f[0] === 'Empresa');
    assert.deepStrictEqual(filas[cab], S.COLUMNAS.map(c => c.titulo));
    assert.strictEqual(filas[cab + 1][0], 'Panadería "Los Aromos"; SpA');
    const tot = filas[filas.length - 1];
    assert.strictEqual(tot[0], 'Totales'); assert.strictEqual(Number(tot[6]), t.previred); assert.strictEqual(Number(tot[8]), 15250);
    assert.ok(filas[1][0].includes('estimación') || filas[1][0].includes('Previred'));
});

console.log(ok + ' pruebas correctas');
