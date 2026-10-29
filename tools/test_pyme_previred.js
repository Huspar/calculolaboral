// Pruebas del archivo para Previred del Asistente Pyme: node tools/test_pyme_previred.js
'use strict';
const assert = require('assert');
const A = require('../js/pyme_previred');
const PV = require('../js/previred_generador');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const PER = '2026-10';
const v = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const EMP = { mutual: 'ACHS', tasaMutual: 0.93 };
const T1 = { nombre: 'Ana María Pérez Soto', rut: '15.234.567-4', sexo: 'F', contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, fechaIngreso: '2022-03-15' };
const T2 = { nombre: 'Bruno Castillo Rojas', rut: '19.876.543-0', sexo: 'M', apellidoPaterno: 'Castillo', apellidoMaterno: 'Rojas', contrato: 'plazo_fijo', fechaTerminoPlazo: '2027-03-31', jornadaHoras: 42, afp: 'Uno', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3, sueldoBase: 900000, fechaIngreso: '2026-10-05' };
const calc = (t, extra) => E.calcular({ trabajador: t, mes: Object.assign(L.mesBase(t, PER), { empleador: true }, extra), periodo: PER, tasaMutual: EMP.tasaMutual }, v);
const armar = (items, emp) => A.armar({ periodo: PER, empresa: emp || EMP, items });
const campos = (linea) => linea.split(';');

caso('un trabajador con Fonasa y otro con Isapre generan líneas de 105 campos que pasan el validador', () => {
    const s = armar([{ t: T1, res: calc(T1) }, { t: T2, res: calc(T2) }]);
    assert.deepStrictEqual(s.errores, []);
    assert.strictEqual(s.filas.length, 2);
    assert.deepStrictEqual(PV.validar(s.texto), []);
    assert.ok(s.texto.endsWith('\r\n'));
});

caso('los montos del archivo son los de la liquidación: AFP, renta imponible, cesantía y mutual', () => {
    const r1 = calc(T1);
    const f = campos(armar([{ t: T1, res: r1 }]).filas[0]);
    assert.strictEqual(f[0], '15234567'); assert.strictEqual(f[1], '4');
    assert.strictEqual(Number(f[26]), r1.bases.baseAfp);            // campo 27 renta imponible AFP
    assert.strictEqual(Number(f[27]), r1.montos.afp);               // campo 28 cotización AFP
    assert.strictEqual(Number(f[69]), r1.montos.salud);             // campo 70 cotización Fonasa
    assert.strictEqual(Number(f[100]), r1.montos.afc);              // campo 101 AFC trabajador
    assert.strictEqual(Number(f[97]), r1.empleador.lineas.filter(l => l.clave === 'mutual')[0].monto); // campo 98
    assert.strictEqual(f[12], String(r1.bases.dias));
});

caso('los apellidos de la ficha se usan tal cual; sin ellos se separan del nombre y se avisa', () => {
    const s = armar([{ t: T1, res: calc(T1) }, { t: T2, res: calc(T2) }]);
    const a = campos(s.filas[0]), b = campos(s.filas[1]);
    assert.deepStrictEqual([a[2], a[3], a[4]], ['Perez', 'Soto', 'Ana Maria']);
    assert.deepStrictEqual([b[2], b[3], b[4]], ['Castillo', 'Rojas', 'Bruno']);
    assert.ok(s.avisos.some(x => /Ana María Pérez Soto.*apellidos/.test(x)));
    assert.ok(!s.avisos.some(x => /Bruno.*apellidos/.test(x)));
});

caso('el ingreso del mes sale como movimiento de alta (7 en plazo fijo) con la fecha dd-mm-aaaa', () => {
    const s = armar([{ t: T1, res: calc(T1) }, { t: T2, res: calc(T2) }]);
    const a = campos(s.filas[0]), b = campos(s.filas[1]);
    assert.strictEqual(a[14], '0');
    assert.strictEqual(b[14], '7'); assert.strictEqual(b[15], '05-10-2026');
});

caso('Isapre en UF: plan en UF con 4 decimales, renta imponible y cotización obligatoria del 7%', () => {
    const r2 = calc(T2);
    const b = campos(armar([{ t: T2, res: r2 }]).filas[0]);
    assert.strictEqual(b[77], '2');
    assert.strictEqual(b[78], '00030000');
    assert.strictEqual(Number(b[76]), r2.bases.baseAfp);
    assert.strictEqual(Number(b[79]), Math.round(r2.bases.baseAfp * 0.07));
    assert.strictEqual(b[69], '0');
});

caso('sin sexo, sin mutualidad o con APV sin contrato no hay archivo y el error dice qué falta', () => {
    const sinSexo = Object.assign({}, T1, { sexo: '' });
    let s = armar([{ t: sinSexo, res: calc(sinSexo) }]);
    assert.strictEqual(s.texto, ''); assert.ok(/falta el sexo/.test(s.errores[0]));
    s = armar([{ t: T1, res: calc(T1) }], { mutual: '' });
    assert.ok(s.errores.some(e => /mutualidad/.test(e)));
    const r = calc(T1, { apvMonto: 50000, apvRegimen: 'B' });
    s = armar([{ t: T1, res: r }]);
    assert.ok(s.errores.some(e => /APV/.test(e)));
    const conApv = Object.assign({}, T1, { apvContrato: 'AB123' });
    s = armar([{ t: conApv, res: r }]);
    assert.deepStrictEqual(s.errores, []);
    const f = campos(s.filas[0]);
    assert.strictEqual(f[39], '34'); assert.strictEqual(f[40], 'AB123'); assert.strictEqual(f[42], '50000');
});

caso('Isapre sin plan en UF o con nombre desconocido se rechaza, no se adivina', () => {
    const sinPlan = Object.assign({}, T2, { isaprePlanUF: 0 });
    let s = armar([{ t: sinPlan, res: calc(sinPlan) }]);
    assert.ok(s.errores.some(e => /plan/i.test(e)));
    const rara = Object.assign({}, T2, { isapreNombre: 'Isapre Fantasma' });
    s = armar([{ t: rara, res: calc(rara) }]);
    assert.ok(s.errores.some(e => /no reconocida/.test(e)));
});

caso('asignación familiar sin tramo se rechaza; con tramo y cargas sale informada', () => {
    const r = calc(T1, { asignacionFamiliar: 15000 });
    let s = armar([{ t: T1, res: r }]);
    assert.ok(s.errores.some(e => /tramo/.test(e)));
    const t = Object.assign({}, T1, { afTramo: 'B', afCargas: 2 });
    s = armar([{ t, res: r }]);
    assert.deepStrictEqual(s.errores, []);
    const f = campos(s.filas[0]);
    assert.strictEqual(f[17], 'B'); assert.strictEqual(f[18], '2'); assert.strictEqual(f[21], '15000');
});

caso('extranjero se marca como tal y CCAF y mayores de 60 años dejan avisos', () => {
    const t = Object.assign({}, T1, { nacionalidad: 'Peruana', fechaNacimiento: '1960-01-01' });
    const s = armar([{ t, res: calc(t) }], { mutual: 'IST', ccaf: 'Los Andes' });
    assert.deepStrictEqual(s.errores, []);
    assert.strictEqual(campos(s.filas[0])[6], '1');
    assert.ok(s.avisos.some(x => /caja de compensación/.test(x)));
    assert.ok(s.avisos.some(x => /66 años/.test(x)));
    assert.strictEqual(campos(s.filas[0])[95], '03');
});

caso('sin trabajadores no hay archivo', () => {
    const s = armar([]);
    assert.strictEqual(s.texto, ''); assert.ok(s.errores.length);
});

caso('el término del contrato en el mes sale como retiro (movimiento 2) con su fecha, y los días llegan hasta ese día', () => {
    const t = Object.assign({}, T1, { fechaTermino: '2026-10-15', causalTermino: '4' });
    const r = calc(t, { diasTrabajados: L.diasBase(t, PER) });
    const s = armar([{ t, res: r }]);
    assert.deepStrictEqual(s.errores, []);
    const f = campos(s.filas[0]);
    assert.strictEqual(f[14], '2'); assert.strictEqual(f[15], ''); assert.strictEqual(f[16], '15-10-2026');
    assert.strictEqual(f[12], '15');
    assert.deepStrictEqual(PV.validar(s.texto), []);
});

caso('un plazo fijo que vence este mes sin término anotado deja un aviso en vez de adivinar un retiro', () => {
    const t = Object.assign({}, T1, { contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-31' });
    const s = armar([{ t, res: calc(t) }]);
    assert.strictEqual(campos(s.filas[0])[14], '0');
    assert.ok(s.avisos.some(a => /plazo fijo vence este mes/.test(a)));
});

caso('si la liquidación guardada paga más días que los del contrato, no se arma el archivo y se dice qué hacer', () => {
    const t = Object.assign({}, T1, { fechaTermino: '2026-10-15', causalTermino: '4' });
    const s = armar([{ t, res: calc(t, { diasTrabajados: 30 }) }]);
    assert.strictEqual(s.texto, ''); assert.ok(s.errores.some(e => /paga 30 días y el contrato terminó el 15/.test(e)));
});

console.log(ok + ' pruebas correctas');
