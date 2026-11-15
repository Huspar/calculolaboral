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

caso('plantillaXlsx y leerXlsx preservan fechas Excel, números y ceros a la izquierda', () => {
    const XLSX = require('../assets/vendor/xlsx.full.min.js');
    const tplBytes = I.plantillaXlsx(XLSX);
    const tplWb = XLSX.read(tplBytes, { type: 'array' });
    assert.deepStrictEqual(tplWb.SheetNames, ['Trabajadores']);
    const tplRows = I.leerXlsx(tplBytes, XLSX);
    assert.deepStrictEqual(tplRows[0], I.COLUMNAS.map(c => c.titulo));

    const ws = XLSX.utils.aoa_to_sheet([
        ['Nombre completo', 'RUT', 'Fecha de ingreso', 'Sueldo base', 'Colación mensual', 'Domicilio'],
        ['Ana Pérez', '08111222-3', new Date(Date.UTC(2022, 2, 15)), 650000, 40000, 'Pasaje 00123']
    ]);
    ws['B2'].t = 's';
    ws['B2'].z = '@';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trabajadores');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const [r] = I.revisar(I.leerXlsx(buf, XLSX), OPC);
    assert.deepStrictEqual(r.errores, []);
    assert.strictEqual(r.datos.rut, '08.111.222-3');
    assert.strictEqual(r.datos.fechaIngreso, '2022-03-15');
    assert.strictEqual(r.datos.sueldoBase, 650000);
    assert.strictEqual(r.datos.colacion, 40000);
});

caso('Previred 105 campos: lee muestra real, fusiona líneas y valida en servidor', () => {
    const fs = require('fs');
    const path = require('path');
    const muestra = fs.readFileSync(path.join(__dirname, 'previred', 'muestra-2026-10.txt'), 'utf8');
    const res = I.analizar(I.leerCsv(muestra), OPC);
    assert.strictEqual(res.formato, 'previred');
    assert.strictEqual(res.periodo, '2026-10');
    assert.strictEqual(res.filas.length, 2);

    const [camila, rodrigo] = res.filas;
    assert.deepStrictEqual(camila.errores, []);
    assert.strictEqual(camila.datos.nombre, 'Camila Rojas Perez');
    assert.strictEqual(camila.datos.rut, '12.345.678-5');
    assert.strictEqual(camila.datos.afp, 'Cuprum');
    assert.strictEqual(camila.datos.salud, 'fonasa');
    assert.strictEqual(camila.datos.sexo, 'F');
    assert.strictEqual(camila.meta.rentaImponible, 1419115);
    assert.ok(V.validarTrabajador(camila.datos).ok);

    assert.deepStrictEqual(rodrigo.errores, []);
    assert.strictEqual(rodrigo.datos.salud, 'isapre');
    assert.strictEqual(rodrigo.datos.isapreNombre, 'Colmena');
    assert.strictEqual(rodrigo.datos.fun, 'FUN123');
    assert.ok(V.validarTrabajador(rodrigo.datos).ok);

    // Prueba plan Isapre en UF (campo 78=2, campo 79=00040241) + línea secundaria de contratación
    const f1 = new Array(105).fill('0');
    f1[0] = '15234567'; f1[1] = '4'; f1[2] = 'Perez'; f1[3] = 'Gonzalez'; f1[4] = 'Ana';
    f1[5] = 'F'; f1[6] = '0'; f1[8] = '112026'; f1[10] = 'AFP'; f1[13] = '00';
    f1[25] = '34'; f1[26] = '950000'; f1[74] = '04'; f1[77] = '2'; f1[78] = '00040241';
    const f2 = f1.slice();
    f2[13] = '01'; f2[14] = '1'; f2[15] = '15-03-2022'; f2[16] = '';
    const rUf = I.analizar([f1, f2], OPC);
    assert.strictEqual(rUf.filas.length, 1);
    assert.strictEqual(rUf.filas[0].datos.isaprePlanUF, 4.02);
    assert.strictEqual(rUf.filas[0].datos.fechaIngreso, '2022-03-15');
    assert.strictEqual(rUf.filas[0].datos.afp, 'Modelo');
    assert.ok(V.validarTrabajador(rUf.filas[0].datos).ok);
});

caso('LRE de la Dirección del Trabajo: detecta códigos DT, sueldo 2101 y nombre faltante', () => {
    const lre = [
        'Rut trabajador;Fecha inicio contrato;Código tipo de jornada;AFP;FONASA / ISAPRE;Sueldo;Colación total mensual;Movilización total mensual',
        '15234567-4;15/03/2022;101;103;102;650000;40000;30000',
        '12345678-5;01/05/2024;201;13;4;520000;0;0'
    ].join('\r\n');
    const res = I.analizar(I.leerCsv(lre), OPC);
    assert.strictEqual(res.formato, 'lre');
    assert.strictEqual(res.filas.length, 2);
    assert.strictEqual(res.filas[0].faltaNombre, true);
    assert.strictEqual(res.filas[0].datos.rut, '15.234.567-4');
    assert.strictEqual(res.filas[0].datos.fechaIngreso, '2022-03-15');
    assert.strictEqual(res.filas[0].datos.afp, 'Modelo');
    assert.strictEqual(res.filas[0].datos.salud, 'fonasa');
    assert.strictEqual(res.filas[0].datos.sueldoBase, 650000);
    assert.strictEqual(res.filas[0].datos.colacion, 40000);
    assert.strictEqual(res.filas[0].datos.movilizacion, 30000);
    assert.strictEqual(res.filas[1].datos.isapreNombre, 'Colmena');
    assert.ok(res.filas[1].avisos.some(a => /Jornada parcial/i.test(a)));
});

caso('Excel/CSV genérico de otro sistema: filas de título arriba, nombres separados e Isapre directa', () => {
    const XLSX = require('../assets/vendor/xlsx.full.min.js');
    const ws = XLSX.utils.aoa_to_sheet([
        ['Reporte de Nómina Empresa Demo'],
        ['Generado 15-11-2026'],
        ['RUN', 'Nombres', 'Apellido paterno', 'Apellido materno', 'Cargo', 'Salario base', 'Prevision', 'Institucion salud', 'Plan UF'],
        ['15234567-4', 'Ana', 'Pérez', 'González', 'Vendedora', '$720.000', 'AFP Habitat', 'Consalud', '3,8']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nomina');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const res = I.analizar(I.leerXlsx(buf, XLSX), OPC);
    assert.strictEqual(res.formato, 'generica');
    assert.strictEqual(res.filas.length, 1);
    const [r] = res.filas;
    assert.deepStrictEqual(r.errores, []);
    assert.strictEqual(r.datos.nombre, 'Ana Pérez González');
    assert.strictEqual(r.datos.sueldoBase, 720000);
    assert.strictEqual(r.datos.afp, 'Habitat');
    assert.strictEqual(r.datos.salud, 'isapre');
    assert.strictEqual(r.datos.isapreNombre, 'Consalud');
    assert.strictEqual(r.datos.isaprePlanUF, 3.8);
    assert.ok(V.validarTrabajador(r.datos).ok);
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
