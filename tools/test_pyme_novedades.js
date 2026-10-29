// Pruebas de las novedades del mes por planilla: node tools/test_pyme_novedades.js
'use strict';
const assert = require('assert');
const N = require('../js/pyme_novedades');
const I = require('../js/pyme_importar');
const L = require('../js/pyme_liquidaciones');
const Rut = require('../js/rut_cl');
const V = require('../api/_pyme/validar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const T1 = { id: 'a', nombre: 'Ana Pérez', rut: '15.234.567-4', contrato: 'indefinido', sueldoBase: 650000, afp: 'Modelo', salud: 'fonasa', fechaIngreso: '2022-03-15', anticipoMensual: 100000, bonosFijos: [{ tipo: 'imponible', nombre: 'Bono de asistencia', monto: 20000 }] };
const T2 = { id: 'b', nombre: 'Bruno Castillo', rut: '19.876.543-0', contrato: 'indefinido', sueldoBase: 900000, afp: 'Uno', salud: 'fonasa', fechaIngreso: '2020-01-01' };
const TS = [T1, T2];
const leer = (txt) => N.revisar(I.leerCsv(txt), TS, Rut);
const CAB = N.COLUMNAS.map(c => c.titulo).join(';');

caso('la plantilla trae una fila por trabajador con su RUT y nombre y se vuelve a leer con el mismo lector', () => {
    const filas = I.leerCsv(N.plantilla(TS));
    assert.strictEqual(filas.length, 3);
    assert.deepStrictEqual(filas[0], N.COLUMNAS.map(c => c.titulo));
    assert.deepStrictEqual(filas[1].slice(0, 2), ['15.234.567-4', 'Ana Pérez']);
    const r = leer(N.plantilla(TS));
    assert.deepStrictEqual(r.errores, []);
    assert.deepStrictEqual(r.cambios.map(c => Object.keys(c.nov).length), [0, 0]);
});

caso('lee días, horas con coma, montos con puntos y deja sin tocar lo que va vacío; un cero explícito sí cuenta', () => {
    const r = leer(CAB + '\r\n15.234.567-4;;28;4,5;1.200.000;;50.000;$ 10.000;0;;;\r\n19.876.543-0;;;;;;;;;;;\r\n');
    assert.deepStrictEqual(r.errores, []);
    assert.deepStrictEqual(r.cambios[0].nov, { dias: 28, horasExtra: 4.5, comisiones: 1200000, bono: 50000, viaticos: 10000, anticipo: 0 });
    assert.deepStrictEqual(r.cambios[1].nov, {});
});

caso('aplica las novedades sobre el mes base: lo vacío queda, el anticipo de la ficha se reemplaza solo si viene, el bono del mes no se duplica', () => {
    const base = L.mesBase(T1, '2026-10');
    assert.strictEqual(base.anticipo, 100000);
    const a = N.aplicar(base, { dias: 25, horasExtra: 3, bono: 40000 });
    assert.deepStrictEqual([a.diasTrabajados, a.horasExtra, a.anticipo, a.comisiones], [25, 3, 100000, 0]);
    assert.deepStrictEqual(a.bonosImponibles.map(b => b.nombre), ['Bono de asistencia', 'Bono del mes']);
    const b = N.aplicar(a, { bono: 10000, anticipo: 0, apv: 30000, cuotaSindical: 5000, creditoCCAF: 8000, tratos: 7000, comisiones: 100 });
    assert.deepStrictEqual(b.bonosImponibles.map(x => x.monto), [20000, 10000]);
    assert.deepStrictEqual([b.anticipo, b.apvMonto, b.cuotaSindical, b.creditoCCAF, b.tratos, b.comisiones, b.diasTrabajados], [0, 30000, 5000, 8000, 7000, 100, 25]);
    assert.deepStrictEqual(N.aplicar(a, { bono: 0 }).bonosImponibles.map(x => x.nombre), ['Bono de asistencia']);
    assert.strictEqual(base.horasExtra, 0, 'no modifica el mes base');
    const v = V.validarMes(Object.assign({}, b, { calculo: null }));
    assert.ok(v.ok || !v.errores.bonosImponibles, JSON.stringify(v.errores));
});

caso('rechaza RUT inválido, de otra persona, repetido, montos mal escritos y días fuera de rango, con la fila', () => {
    const r = leer(CAB + '\r\n11.111.111-2;;;;;;;;;;;\r\n12.345.678-5;;;;;;;;;;;\r\n15.234.567-4;;31;;;;;;;;;\r\n19.876.543-0;;;abc;;;;;;;;\r\n15.234.567-4;;30;;;;;;;;;\r\n');
    const motivos = r.errores.map(e => e.fila + ':' + e.motivo);
    assert.ok(motivos.some(m => /^2:.*no es válido/.test(m)), motivos.join('|'));
    assert.ok(motivos.some(m => /^3:.*ningún trabajador/.test(m)));
    assert.ok(motivos.some(m => /^4:.*Días trabajados/.test(m)));
    assert.ok(motivos.some(m => /^5:.*Horas extra/.test(m)));
    assert.ok(motivos.some(m => /^6:.*aparece dos veces/.test(m)));
    assert.strictEqual(r.cambios.length, 0);
    const m2 = leer(CAB + '\r\n19.876.543-0;;;;12,5;;;;;;;\r\n');
    assert.ok(m2.errores.some(e => /Comisiones/.test(e.motivo)));
});

caso('avisa quién no trae fila y exige la columna RUT', () => {
    const r = leer(CAB + '\r\n15.234.567-4;;30;;;;;;;;;\r\n');
    assert.deepStrictEqual(r.sinFila, ['Bruno Castillo']);
    const sin = leer('Nombre;Horas extra\r\nAna;3\r\n');
    assert.ok(sin.errores.some(e => /Falta la columna «RUT»/.test(e.motivo)));
    assert.ok(leer('').errores.length);
});

caso('los encabezados se reconocen sin tildes, en mayúsculas y con el texto entre paréntesis', () => {
    const r = leer('rut;DIAS TRABAJADOS;horas extra (hh);Credito caja de compensacion\r\n15.234.567-4;20;2;9.000\r\n');
    assert.deepStrictEqual(r.errores, []);
    assert.deepStrictEqual(r.cambios[0].nov, { dias: 20, horasExtra: 2, creditoCCAF: 9000 });
});

console.log(ok + ' pruebas correctas');
