// Pruebas de la nómina de pagos y el asiento contable: node tools/test_pyme_pagos.js
'use strict';
const assert = require('assert');
const G = require('../js/pyme_pagos');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');
const I = require('../js/pyme_importar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const PER = '2026-10';
const v = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const BANCO = { banco: 'Banco de Chile', tipoCuenta: 'vista', numeroCuenta: '12.345-678' };
const T1 = Object.assign({ nombre: 'Ana Pérez', rut: '15.234.567-4', contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, fechaIngreso: '2022-03-15' }, BANCO);
const T2 = { nombre: 'Bruno "Beto" Castillo', rut: '19.876.543-0', contrato: 'plazo_fijo', jornadaHoras: 42, afp: 'Uno', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3, sueldoBase: 900000, fechaIngreso: '2026-10-05', banco: 'Santander', tipoCuenta: 'corriente', numeroCuenta: '000123456789' };
const T3 = { nombre: 'Carla Soto', rut: '13.456.789-9', contrato: 'indefinido', jornadaHoras: 42, afp: 'Habitat', salud: 'fonasa', sueldoBase: 700000, fechaIngreso: '2020-01-01' };
const calc = (t, extra) => E.calcular({ trabajador: t, mes: Object.assign(L.mesBase(t, PER), { empleador: true }, extra), periodo: PER, tasaMutual: 0.93 }, v);
const items = (ts, extra) => ts.map(t => ({ t, res: calc(t, extra) }));

caso('la nómina trae una fila por trabajador con su banco, cuenta y líquido, y el total suma los pagos', () => {
    const it = items([T1, T2]);
    const s = G.nomina({ periodoNombre: 'octubre 2026', items: it });
    const lineas = I.leerCsv(s.texto);
    const datos = lineas.filter(l => /^\d/.test(l[0]));
    assert.strictEqual(datos.length, 2);
    assert.deepStrictEqual(datos[0].slice(0, 5), ['15.234.567-4', 'Ana Pérez', 'Banco de Chile', 'Cuenta vista o RUT', '12345678']);
    assert.strictEqual(Number(datos[0][5]), it[0].res.liquido);
    assert.strictEqual(datos[1][1], 'Bruno "Beto" Castillo');
    assert.strictEqual(datos[1][4], '000123456789', 'los ceros a la izquierda se conservan');
    assert.strictEqual(s.total, it[0].res.liquido + it[1].res.liquido);
    assert.strictEqual(s.incluidos, 2);
    assert.deepStrictEqual(s.omitidos, []);
});

caso('quien no tiene datos de cuenta no entra a la nómina y se dice qué le falta; no se adivina nada', () => {
    const s = G.nomina({ periodoNombre: 'octubre 2026', items: items([T1, T3, Object.assign({}, T2, { numeroCuenta: 'abc' })]) });
    assert.strictEqual(s.incluidos, 1);
    assert.strictEqual(s.omitidos.length, 2);
    assert.match(s.omitidos[0].motivo, /banco, tipo de cuenta, número de cuenta/);
    assert.match(s.omitidos[1].motivo, /número de cuenta/);
    assert.ok(!s.texto.includes('Carla Soto'));
});

caso('líquido cero no se paga', () => {
    const t = Object.assign({}, T1);
    const r = calc(t, { diasTrabajados: 0 });
    const s = G.nomina({ periodoNombre: 'octubre 2026', items: [{ t, res: Object.assign({}, r, { liquido: 0 }) }] });
    assert.strictEqual(s.incluidos, 0);
    assert.match(s.omitidos[0].motivo, /cero/);
});

caso('el asiento cuadra: debe igual a haber, con cualquier mezcla de trabajadores y descuentos', () => {
    const casos = [
        items([T1]),
        items([T1, T2, T3]),
        [{ t: T1, res: calc(T1, { horasExtra: 5, comisiones: 30000, anticipo: 100000, apvMonto: 50000, apvRegimen: 'B', creditoCCAF: 20000, cuotaSindical: 8000 }) }, { t: T2, res: calc(T2) }]
    ];
    casos.forEach(it => {
        const a = G.asiento({ periodoNombre: 'octubre 2026', items: it });
        assert.ok(a.cuadra, 'debe ' + a.debe + ' haber ' + a.haber);
        assert.strictEqual(a.debe, it.reduce((s, x) => s + x.res.totalHaberes + x.res.empleador.lineas.reduce((q, l) => q + Math.round(l.monto), 0), 0));
    });
});

caso('el asiento separa los conceptos en su cuenta y usa los códigos que puso el contador', () => {
    const TA = Object.assign({}, T1, { sueldoBase: 2500000 });
    const r = calc(TA, { anticipo: 100000, apvMonto: 50000, apvRegimen: 'B' });
    const a = G.asiento({ periodoNombre: 'octubre 2026', cuentas: { sueldos: '6101', liquido: '2105', afp: '2110' }, items: [{ t: TA, res: r }] });
    const por = (g) => a.filas.find(f => f.glosa === g);
    assert.strictEqual(por('Sueldos y haberes imponibles').cuenta, '6101');
    assert.strictEqual(por('Sueldos y haberes imponibles').debe, r.totalImponible);
    assert.strictEqual(por('Haberes no imponibles (colación, movilización y otros)').debe, 70000);
    assert.ok(r.montos.impuesto > 0);
    assert.strictEqual(por('Remuneraciones por pagar').cuenta, '2105');
    assert.strictEqual(por('Remuneraciones por pagar').haber, r.liquido);
    assert.strictEqual(por('Impuesto único por pagar').haber, r.montos.impuesto);
    assert.strictEqual(por('APV por pagar').haber, 50000);
    assert.strictEqual(por('Anticipos, préstamos y otros descuentos').haber, 100000);
    assert.strictEqual(por('Salud por pagar').cuenta, '');
    assert.ok(a.sinCodigos > 0);
    const emp = Object.fromEntries(r.empleador.lineas.map(l => [l.clave, Math.round(l.monto)]));
    assert.strictEqual(por('AFP por pagar').haber, r.montos.afp + emp.afp);
    assert.strictEqual(por('Mutual o ISL por pagar').haber, emp.mutual);
});

caso('el archivo del asiento se lee con el mismo lector de planillas y respeta comillas y punto y coma', () => {
    const a = G.asiento({ periodoNombre: 'octubre 2026', cuentas: { sueldos: '61;01' }, items: items([T1]) });
    const lineas = I.leerCsv(a.texto);
    const cab = lineas.findIndex(l => l[0] === 'Cuenta');
    assert.deepStrictEqual(lineas[cab], ['Cuenta', 'Glosa', 'Debe', 'Haber']);
    assert.strictEqual(lineas[cab + 1][0], '61;01');
    const tot = lineas.find(l => l[1] === 'Totales');
    assert.strictEqual(Number(tot[2]), Number(tot[3]));
});

caso('una liquidación sin las cotizaciones del empleador no se puede asentar y se avisa', () => {
    const r = E.calcular({ trabajador: T1, mes: L.mesBase(T1, PER), periodo: PER, tasaMutual: 0.93 }, Object.assign({}, v, { empleador: undefined }));
    const a = G.asiento({ periodoNombre: 'octubre 2026', items: [{ t: T1, res: r }] });
    assert.ok(a.errores.length === 1 && /cotizaciones del empleador/.test(a.errores[0]));
});

console.log(ok + ' pruebas correctas');
