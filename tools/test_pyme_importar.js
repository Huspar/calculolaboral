// Pruebas de la importación de trabajadores desde una planilla CSV: node tools/test_pyme_importar.js
'use strict';
const assert = require('assert');
const I = require('../js/pyme_importar');
const Rut = require('../js/rut_cl');
const V = require('../api/_pyme/validar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }
const OPC = { rut: Rut, afps: V.AFPS };

caso('la plantilla trae todas las columnas separadas por punto y coma y se vuelve a leer igual', () => {
    const p = I.plantilla();
    assert.ok(p.endsWith('\r\n'));
    const filas = I.leerCsv(p);
    assert.strictEqual(filas.length, 1);
    assert.strictEqual(filas[0].length, I.COLUMNAS.length);
    assert.strictEqual(filas[0][0], 'Nombre completo');
});
caso('leerCsv: punto y coma o coma, comillas, comillas dobles, BOM, CRLF y filas vacías', () => {
    assert.deepStrictEqual(I.leerCsv('﻿a;b\r\n"x;1";"di ""y"""\r\n;\r\n'), [['a', 'b'], ['x;1', 'di "y"']]);
    assert.deepStrictEqual(I.leerCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
    assert.deepStrictEqual(I.leerCsv('a;b\n"linea\ncon salto";2'), [['a', 'b'], ['linea\ncon salto', '2']]);
});
caso('fechas y montos en formatos chilenos', () => {
    assert.strictEqual(I._fecha('15-03-2022'), '2022-03-15');
    assert.strictEqual(I._fecha('5/3/2022'), '2022-03-05');
    assert.strictEqual(I._fecha('2022-03-15'), '2022-03-15');
    assert.strictEqual(I._fecha('31-02-2022'), null);
    assert.strictEqual(I._fecha('marzo 2022'), null);
    assert.strictEqual(I._monto('$650.000'), 650000);
    assert.strictEqual(I._monto('650000'), 650000);
    assert.strictEqual(I._monto('650,5'), null);
    assert.strictEqual(I._monto(''), '');
});
caso('revisar: convierte una fila completa a la ficha y el servidor la acepta', () => {
    const csv = I.plantilla() +
        'Ana Pérez González;15.234.567-4;Panadera;15-03-2022;Indefinido;;42;6;$650.000;$40.000;$30.000;Legal;afp modelo;Fonasa;;;10-07-1990;Chilena;Av. Alemania 100;Temuco\r\n';
    const [r] = I.revisar(I.leerCsv(csv), OPC);
    assert.deepStrictEqual(r.errores, []);
    assert.strictEqual(r.fila, 2);
    assert.deepStrictEqual(r.datos, { nombre: 'Ana Pérez González', rut: '15.234.567-4', cargo: 'Panadera', nacionalidad: 'Chilena', domicilio: 'Av. Alemania 100', comuna: 'Temuco', fechaIngreso: '2022-03-15', fechaNacimiento: '1990-07-10', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, jornadaHoras: 42, distribucion: '6', contrato: 'indefinido', gratificacion: 'legal', afp: 'Modelo', salud: 'fonasa' });
    assert.ok(V.validarTrabajador(r.datos).ok);
});
caso('revisar: explica cada error en palabras simples y con el número de fila', () => {
    const csv = I.plantilla() +
        ';12.345.678-0;;31-02-2022;temporal;;50;7;mucho;;;;Futuro;Isapre;;4,x\r\n' +
        'Bruno;19.876.543-0;;;Plazo fijo\r\n';
    const [a, b] = I.revisar(I.leerCsv(csv), OPC);
    assert.strictEqual(a.fila, 2);
    ['falta el nombre', 'el RUT no es válido', 'la fecha de ingreso no es una fecha', 'el contrato debe ser', 'la jornada debe ser', 'los días de trabajo', '«mucho» no es un monto', 'AFP «Futuro» desconocida', 'el plan de Isapre', 'falta el nombre de la Isapre']
        .forEach(t => assert.ok(a.errores.some(e => e.indexOf(t) === 0), 'falta el error: ' + t + ' en ' + JSON.stringify(a.errores)));
    assert.deepStrictEqual(b.errores, ['falta el término del plazo fijo']);
});
caso('columnas en otro orden o con otro texto entre paréntesis se reconocen; hasta 50 filas', () => {
    const csv = 'rut;NOMBRE COMPLETO (como en el carnet);Sueldo base\n15.234.567-4;Ana;650000\n';
    const [r] = I.revisar(I.leerCsv(csv), OPC);
    assert.deepStrictEqual([r.datos.nombre, r.datos.rut, r.datos.sueldoBase, r.errores.length], ['Ana', '15.234.567-4', 650000, 0]);
    const muchas = 'Nombre completo;RUT\n' + Array.from({ length: 60 }, () => 'A;15.234.567-4').join('\n');
    assert.strictEqual(I.revisar(I.leerCsv(muchas), OPC).length, 50);
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
