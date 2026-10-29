// Pruebas de los archivos del mes de la demo (LRE, nómina de pagos y asiento): node tools/test_demo_archivos.js
'use strict';
const assert = require('assert');
const A = require('../js/demo_archivos');
const G = require('../js/lre_generador');
const T = require('../js/lre_tablas');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const PER = '2026-10';
const mes = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const EMP = { rut: '76.543.210-3', mutual: 'Mutual de Seguridad', ccaf: '', comuna: 'Temuco' };
const OPC = { periodo: PER, periodoNombre: 'octubre 2026', empresa: EMP, tramoDe: () => 'D' };

// Igual que calcularTodo de js/demo_liquidaciones.js: el APV y el seguro de cesantía del subsidio van como «otros descuentos»
function resultado(rec, extra) {
    rec = Object.assign({ rut: '15.234.567-4', nombre: 'Ana Pérez', sueldo: 650000, dias: 30, afp: 'Modelo', salud: 'fonasa', planUF: 0, contrato: 'indefinido', jornada: 42, ingreso: '2022-03-15', colacion: 40000, movilizacion: 30000, comisiones: 0, horasExtra: 0, gratificacion: 'legal', gratificacionMonto: 0, sexo: 'F', isapreNombre: '', movimiento: '', movHasta: '', tramoAF: '', cargas: 0, licenciaDias: 0, apvMonto: 0, tipoTrabajador: '0', banco: 'BancoEstado', tipoCuenta: 'vista', numeroCuenta: '123456', fechaTermino: '', causalTermino: '', rutSindicato: '', cuotaSindical: 0, creditoCCAF: 0 }, rec);
    const e = Object.assign({ subsidio: 0, indem: [] }, extra);
    const noImp = (e.subsidio ? [{ nombre: 'Subsidio por licencia médica', monto: e.subsidio }] : []).concat(e.indem);
    const otros = [];
    if (e.subsidio) otros.push({ nombre: 'AFC 0,6% sobre subsidio', monto: Math.round(e.subsidio * 0.006) });
    if (rec.apvMonto > 0) otros.push({ nombre: 'APV', monto: rec.apvMonto });
    const res = E.calcular({
        periodo: PER, tasaMutual: 0.93,
        trabajador: { sueldoBase: rec.sueldo, afp: rec.afp, salud: rec.salud, isaprePlanUF: rec.planUF, isapreNombre: 'Isapre', contrato: rec.contrato, jornadaHoras: rec.jornada, fechaIngreso: rec.ingreso, colacion: rec.colacion, movilizacion: rec.movilizacion },
        mes: { diasTrabajados: rec.dias, horasExtra: 0, comisiones: 0, gratificacion: 'legal', gratificacionMonto: 0, asignacionFamiliar: 0, otrosNoImponibles: noImp, otrosDescuentos: otros, cuotaSindical: rec.cuotaSindical, creditoCCAF: rec.creditoCCAF }
    }, mes);
    return { record: rec, detalle: res, error: '', liquido: res.liquido };
}
const cols = (l) => l.split(';');
const col = (c) => T.COLUMNAS.findIndex(x => x.c === c);

caso('la nómina de la demo sale con el LRE, la nómina de pagos y el asiento, y los tres cuadran con las liquidaciones', () => {
    const rs = [resultado({}), resultado({ rut: '19.876.543-0', nombre: 'Bruno Castillo', sueldo: 900000, afp: 'Uno', salud: 'isapre', planUF: 3, isapreNombre: 'Colmena', contrato: 'plazo', ingreso: '2026-01-05', banco: 'Santander', tipoCuenta: 'corriente' })];
    const l = A.lre(rs, OPC);
    assert.deepStrictEqual(l.errores, []);
    assert.strictEqual(l.filas.length, 2);
    assert.deepStrictEqual(G.validar(l.texto), []);
    const a = cols(l.filas[0]);
    assert.strictEqual(Number(a[col('5501')]), rs[0].detalle.liquido);
    assert.strictEqual(a[col('1143')], '102'); assert.strictEqual(cols(l.filas[1])[col('1143')], '4');
    const n = A.nomina(rs, OPC);
    assert.strictEqual(n.incluidos, 2); assert.strictEqual(n.total, rs[0].liquido + rs[1].liquido);
    const s = A.asiento(rs, OPC);
    assert.ok(s.cuadra, s.debe + ' vs ' + s.haber);
    assert.deepStrictEqual(s.errores, []);
});

caso('APV y subsidio de licencia: se clasifican (3155 y 2201) y debe y haber siguen cuadrando', () => {
    const rs = [resultado({ apvMonto: 40000, apvContrato: 'AB1', licenciaDias: 5 }, { subsidio: 100000 })];
    const l = A.lre(rs, OPC);
    assert.deepStrictEqual(l.errores, []);
    const a = cols(l.filas[0]);
    assert.strictEqual(Number(a[col('3155')]), 40000); assert.strictEqual(a[col('1155')], '1');
    assert.strictEqual(Number(a[col('2201')]), 100000);
    assert.strictEqual(Number(a[col('5220')]), 100000);
    assert.strictEqual(Number(a[col('5301')]), rs[0].detalle.totalDescuentos);
    assert.strictEqual(Number(a[col('5201')]), rs[0].detalle.totalHaberes);
    const s = A.asiento(rs, OPC);
    assert.ok(s.cuadra);
    assert.strictEqual(s.filas.find(f => f.glosa === 'APV por pagar').haber, 40000);
});

caso('retiro de la demo: movimiento «retiro» con fecha hasta, o «Fecha de término», lleva fecha y causal al LRE, con sus indemnizaciones', () => {
    const base = { fechaTermino: '2026-10-20', causalTermino: A.causalCodigo('Renuncia voluntaria'), dias: 20 };
    const rs = [resultado(base, { indem: [{ nombre: 'Feriado proporcional', monto: 150000 }, { nombre: 'Indemnización años de servicio', monto: 650000 }] })];
    const l = A.lre(rs, OPC);
    assert.deepStrictEqual(l.errores, []);
    const a = cols(l.filas[0]);
    assert.strictEqual(a[col('1103')], '20/10/2026'); assert.strictEqual(a[col('1104')], '4');
    assert.strictEqual(Number(a[col('2313')]), 150000); assert.strictEqual(Number(a[col('2314')]), 650000);
    assert.strictEqual(Number(a[col('5502')]), 800000);
    const viaMov = [resultado({ movimiento: 'retiro', movHasta: '20-10-2026', causalTermino: '4', dias: 20 })];
    assert.strictEqual(cols(A.lre(viaMov, OPC).filas[0])[col('1103')], '20/10/2026');
    const pagaDeMas = [resultado({ fechaTermino: '2026-10-20', causalTermino: '4', dias: 30 })];
    assert.ok(A.lre(pagaDeMas, OPC).errores.some(e => /paga 30 días y el contrato terminó el 20/.test(e)));
    const sinCausal = [resultado({ fechaTermino: '2026-10-20', dias: 20 })];
    assert.ok(A.lre(sinCausal, OPC).errores.some(e => /causal/.test(e)));
});

caso('cuota sindical y crédito de la caja: salen en sus códigos y exigen el RUT del sindicato', () => {
    const sin = [resultado({ cuotaSindical: 8000 })];
    assert.ok(A.lre(sin, OPC).errores.some(e => /RUT del sindicato/.test(e)));
    const con = [resultado({ cuotaSindical: 8000, rutSindicato: '65.123.456-5', creditoCCAF: 20000 })];
    const l = A.lre(con, Object.assign({}, OPC, { empresa: Object.assign({}, EMP, { ccaf: 'Los Andes' }) }));
    assert.deepStrictEqual(l.errores, []);
    const a = cols(l.filas[0]);
    assert.strictEqual(a[col('1171')], '65123456-5'); assert.strictEqual(Number(a[col('3171')]), 8000);
    assert.strictEqual(Number(a[col('3110')]), 20000); assert.strictEqual(a[col('1110')], '1');
    assert.ok(A.asiento(con, OPC).cuadra);
});

caso('la causal se reconoce por código o por texto; lo desconocido queda vacío', () => {
    const casos = { '4': '4', 'Renuncia': '4', 'mutuo acuerdo': '3', 'Necesidades de la empresa': '18', 'art 161 desahucio': '19', 'vencimiento del plazo': '6', 'abandono del trabajo': '13', 'falta de probidad': '24', 'caso fortuito': '8', '99': '', 'otra cosa': '', '': '' };
    Object.keys(casos).forEach(k => assert.strictEqual(A.causalCodigo(k), casos[k], k));
});

caso('quien no tiene cuenta bancaria queda fuera de la nómina de pagos con el motivo; el asiento cuadra igual', () => {
    const rs = [resultado({}), resultado({ rut: '19.876.543-0', nombre: 'Sin cuenta', banco: '', tipoCuenta: '', numeroCuenta: '' })];
    const n = A.nomina(rs, OPC);
    assert.strictEqual(n.incluidos, 1); assert.match(n.omitidos[0].motivo, /banco/);
    assert.ok(A.asiento(rs, OPC).cuadra);
});

caso('las filas con error no entran a ningún archivo', () => {
    const rs = [resultado({}), { record: { nombre: 'X', rut: '1-9' }, error: 'Falta el sueldo base', detalle: null }];
    assert.strictEqual(A.lre(rs, OPC).filas.length, 1);
    assert.strictEqual(A.nomina(rs, OPC).incluidos, 1);
});

console.log(ok + ' pruebas correctas');
