// Pruebas del archivo del Libro de Remuneraciones Electrónico: node tools/test_lre.js
'use strict';
const assert = require('assert');
const G = require('../js/lre_generador');
const A = require('../js/pyme_lre');
const T = require('../js/lre_tablas');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const PER = '2026-10';
const v = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const EMP = { rut: '76.543.210-3', mutual: 'ACHS', ccaf: '', comuna: 'Temuco', tasaMutual: 0.93 };
const T1 = { nombre: 'Ana María Pérez Soto', rut: '15.234.567-4', sexo: 'F', contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, fechaIngreso: '2022-03-15' };
const T2 = { nombre: 'Bruno Castillo Rojas', rut: '19.876.543-0', sexo: 'M', contrato: 'plazo_fijo', jornadaHoras: 42, afp: 'Uno', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3, sueldoBase: 900000, fechaIngreso: '2026-10-05' };
const calc = (t, extra) => E.calcular({ trabajador: t, mes: Object.assign(L.mesBase(t, PER), extra), periodo: PER, tasaMutual: EMP.tasaMutual }, v);
const armar = (items, emp, plantilla) => A.armar({ periodo: PER, empresa: emp || EMP, items, plantilla });
const cols = (linea) => linea.split(';');
const col = (cod) => T.COLUMNAS.findIndex(c => c.c === cod);

caso('las tablas traen las 147 columnas del anexo y las comunas de la DT con sus códigos', () => {
    assert.strictEqual(T.COLUMNAS.length, 147);
    assert.strictEqual(T.COLUMNAS[0].c, '1101');
    assert.strictEqual(T.COMUNAS['9101'], 'TEMUCO');
    assert.strictEqual(T.COMUNAS['13101'], 'SANTIAGO');
    assert.ok(Object.keys(T.COMUNAS).length >= 346);
    const oblig = T.COLUMNAS.filter(c => c.o).map(c => c.c);
    ['1101', '1102', '1105', '1106', '1115', '2101', '3141', '3143', '3161', '4152', '4155', '5201', '5501', '5564'].forEach(c => assert.ok(oblig.includes(c), c));
    assert.ok(!oblig.includes('4151') && !oblig.includes('2102'));
});

caso('el archivo trae una fila de encabezados y una por trabajador, todas con 147 columnas separadas por punto y coma', () => {
    const s = armar([{ t: T1, res: calc(T1) }, { t: T2, res: calc(T2) }]);
    assert.deepStrictEqual(s.errores, []);
    const lineas = s.texto.split('\r\n').filter(Boolean);
    assert.strictEqual(lineas.length, 3);
    lineas.forEach(l => assert.strictEqual(l.split(';').length, 147));
    assert.strictEqual(cols(lineas[0])[0], 'Rut trabajador');
    assert.deepStrictEqual(G.validar(s.texto), []);
    assert.strictEqual(s.nombreArchivo, '765432103_202610.csv');
});

caso('identificación: RUT con guion, fecha dd/mm/aaaa, región y comuna de la empresa, códigos de AFP, salud, mutual y jornada', () => {
    const s = armar([{ t: T1, res: calc(T1) }, { t: T2, res: calc(T2) }]);
    const a = cols(s.filas[0]), b = cols(s.filas[1]);
    assert.strictEqual(a[col('1101')], '15234567-4');
    assert.strictEqual(a[col('1102')], '15/03/2022');
    assert.strictEqual(a[col('1105')], '9'); assert.strictEqual(a[col('1106')], '9101');
    assert.strictEqual(a[col('1141')], '103');           // Modelo
    assert.strictEqual(b[col('1141')], '19');            // Uno
    assert.strictEqual(a[col('1143')], '102');           // Fonasa
    assert.strictEqual(b[col('1143')], '4');             // Colmena
    assert.strictEqual(a[col('1152')], '1');             // ACHS
    assert.strictEqual(a[col('1110')], '0');             // sin caja
    assert.strictEqual(a[col('1107')], '101');
    assert.strictEqual(a[col('1115')], '30');
    assert.strictEqual(a[col('1103')], ''); assert.strictEqual(a[col('1104')], '');
});

caso('los montos salen en su código y los totales cuadran con la liquidación', () => {
    const r1 = calc(T1, { horasExtra: 5, comisiones: 30000, anticipo: 100000 });
    const a = cols(armar([{ t: T1, res: r1 }]).filas[0]);
    const n = (c) => Number(a[col(c)] || 0);
    assert.strictEqual(n('2101'), 650000);
    assert.strictEqual(n('2301'), 40000); assert.strictEqual(n('2302'), 30000);
    assert.strictEqual(n('3141'), r1.montos.afp);
    assert.strictEqual(n('3143'), r1.montos.salud);
    assert.strictEqual(n('3151'), r1.montos.afc);
    assert.strictEqual(n('3161'), r1.montos.impuesto);
    assert.strictEqual(n('3188'), 100000);
    assert.strictEqual(n('5201'), r1.totalHaberes);
    assert.strictEqual(n('5210'), r1.totalImponible);
    assert.strictEqual(n('5230'), r1.totalNoImponible);
    assert.strictEqual(n('5301'), r1.totalDescuentos);
    assert.strictEqual(n('5341') + n('5361') + n('5302'), n('5301'));
    assert.strictEqual(n('5501'), r1.liquido);
    assert.strictEqual(n('5410'), n('4151') + n('4152') + n('4155'));
    assert.ok(n('4155') > 0 && n('4152') > 0);
});

caso('Isapre con plan sobre el 7%: la cotización de salud y el adicional van en 3143 y 3144', () => {
    const r2 = calc(T2);
    const b = cols(armar([{ t: T2, res: r2 }]).filas[0]);
    const n = (c) => Number(b[col(c)] || 0);
    assert.ok(n('3144') > 0);
    assert.strictEqual(n('3143') + n('3144'), r2.montos.salud);
});

caso('APV, asignación familiar, bonos y cuotas de préstamo se clasifican; las columnas opcionales sin dato quedan vacías', () => {
    const t = Object.assign({}, T1, { afTramo: 'B', afCargas: 2 });
    const r = calc(t, { apvMonto: 50000, apvRegimen: 'B', asignacionFamiliar: 15000, bonosImponibles: [{ nombre: 'Bono de asistencia', monto: 20000 }], cuotasPrestamo: [{ nombre: 'Préstamo', monto: 10000, numero: 1, de: 6 }] });
    const s = armar([{ t, res: r }]);
    assert.deepStrictEqual(s.errores, []);
    const a = cols(s.filas[0]);
    const n = (c) => Number(a[col(c)] || 0);
    assert.strictEqual(n('3156'), 50000); assert.strictEqual(a[col('1155')], '1');
    assert.strictEqual(n('2311'), 15000); assert.strictEqual(a[col('1114')], 'B'); assert.strictEqual(a[col('1111')], '2');
    assert.strictEqual(n('2111'), 20000);
    assert.strictEqual(n('3188'), 10000);
    assert.strictEqual(a[col('2105')], ''); assert.strictEqual(a[col('1171')], '');
});

caso('lo que no se puede clasificar detiene el archivo y dice qué línea es', () => {
    const r = calc(T1, { otrosNoImponibles: [{ nombre: 'Aguinaldo especial', monto: 20000 }] });
    let s = armar([{ t: T1, res: r }]);
    assert.strictEqual(s.texto, ''); assert.ok(/Aguinaldo especial/.test(s.errores[0]));
    const r2 = calc(T1, { otrosNoImponibles: [{ nombre: 'Pérdida de caja', monto: 20000 }] });
    s = armar([{ t: T1, res: r2 }]);
    assert.deepStrictEqual(s.errores, []);
    assert.strictEqual(Number(cols(s.filas[0])[col('2304')]), 20000);
    const rs = calc(T1, { cuotaSindical: 8000 });
    s = armar([{ t: T1, res: rs }]);
    assert.ok(s.errores.some(e => /Cuota sindical/.test(e)));
});

caso('asignación familiar sin tramo, comuna desconocida o sin RUT de empresa se rechazan con el dato que falta', () => {
    const r = calc(T1, { asignacionFamiliar: 15000 });
    assert.ok(armar([{ t: T1, res: r }]).errores.some(e => /tramo/.test(e)));
    assert.ok(armar([{ t: T1, res: calc(T1) }], Object.assign({}, EMP, { comuna: 'Villa Fantasma' })).errores.some(e => /Comuna/.test(e)));
    assert.ok(armar([{ t: T1, res: calc(T1) }], Object.assign({}, EMP, { rut: '' })).errores.some(e => /RUT de la empresa/.test(e)));
    assert.ok(armar([{ t: T1, res: calc(T1) }], Object.assign({}, EMP, { mutual: '' })).errores.some(e => /Mutualidad/.test(e)));
});

caso('la comuna se reconoce con tildes, mayúsculas y por código', () => {
    assert.strictEqual(G.comunaDe('ñuñoa').codigo, 13120);
    assert.strictEqual(G.comunaDe('San Pedro de Atacama').region, 2);
    assert.strictEqual(G.comunaDe('Puerto Montt').region, 10);
    assert.strictEqual(G.comunaDe('13101').codigo, 13101);
});

caso('con la plantilla de Mi DT se usan sus encabezados y su orden; si no coincide, se avisa', () => {
    const base = T.COLUMNAS.filter(c => c.c !== '2105').map(c => c.n);
    const invertida = [base[1], base[0]].concat(base.slice(2));
    const s = armar([{ t: T1, res: calc(T1) }], EMP, invertida.join(';') + '\r\n');
    assert.deepStrictEqual(s.errores, []);
    assert.strictEqual(s.texto.split('\r\n')[0].split(';').length, 146);
    assert.strictEqual(cols(s.filas[0])[0], '15/03/2022');
    assert.strictEqual(cols(s.filas[0])[1], '15234567-4');
    const mala = armar([{ t: T1, res: calc(T1) }], EMP, 'Rut trabajador;Algo raro;Fecha inicio contrato\r\n');
    assert.ok(mala.errores.some(e => /Algo raro/.test(e)));
    assert.ok(mala.errores.some(e => /obligatoria/.test(e)));
    const porCodigo = armar([{ t: T1, res: calc(T1) }], EMP, T.COLUMNAS.map(c => c.c + ' ' + c.n).join(';'));
    assert.deepStrictEqual(porCodigo.errores, []);
});

caso('la codificación ANSI conserva las tildes de los encabezados en un byte', () => {
    const s = armar([{ t: T1, res: calc(T1) }]);
    const bytes = G.bytesAnsi(s.texto);
    assert.strictEqual(bytes.length, s.texto.length);
    const i = s.texto.indexOf('Región');
    assert.strictEqual(bytes[i + 4], 0xF3);   // ó en Windows-1252
    assert.ok(Array.from(bytes).every(b => b < 256));
});

caso('sin trabajadores o con período inválido no hay archivo', () => {
    assert.ok(armar([]).errores.length);
    const s = A.armar({ periodo: '2026/10', empresa: EMP, items: [{ t: T1, res: calc(T1) }] });
    assert.strictEqual(s.texto, '');
    assert.ok(s.errores.some(e => /Período/.test(e)));
});

caso('el aviso de la Ley 21.735 y el de términos de contrato acompañan al archivo', () => {
    const s = armar([{ t: T1, res: calc(T1) }]);
    assert.ok(s.avisos.some(a => /términos de contrato/.test(a)));
    assert.ok(s.avisos.some(a => /comuna de la empresa/.test(a)));
    assert.ok(s.avisos.some(a => /Ley 21\.735/.test(a)));
});

console.log(ok + ' pruebas correctas');
