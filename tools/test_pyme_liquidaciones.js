// Pruebas de los valores base de las liquidaciones del Asistente Pyme: node tools/test_pyme_liquidaciones.js
'use strict';
const assert = require('assert');
const L = require('../js/pyme_liquidaciones');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const V = require('../api/_pyme/validar');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const T = (extra) => Object.assign({ contrato: 'indefinido', fechaIngreso: '2022-03-15', gratificacion: 'legal' }, extra);

caso('mes completo: 30 días', () => {
    assert.strictEqual(L.diasBase(T(), '2026-09'), 30);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '' }), '2026-09'), 30);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-09-01' }), '2026-09'), 30);
});
caso('ingreso durante el mes: desde ese día hasta el 30 (mes comercial)', () => {
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-09-16' }), '2026-09'), 15);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-31' }), '2026-10'), 1);
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-30' }), '2026-10'), 1);
});
caso('aún no ingresaba: 0 días', () => {
    assert.strictEqual(L.diasBase(T({ fechaIngreso: '2026-10-02' }), '2026-09'), 0);
});
caso('plazo fijo que termina en el mes, o antes', () => {
    const pf = (f, ing) => T({ contrato: 'plazo_fijo', fechaTerminoPlazo: f, fechaIngreso: ing || '2026-01-10' });
    assert.strictEqual(L.diasBase(pf('2026-09-12'), '2026-09'), 12);
    assert.strictEqual(L.diasBase(pf('2026-09-30'), '2026-09'), 30);
    assert.strictEqual(L.diasBase(pf('2026-08-31'), '2026-09'), 0);
    assert.strictEqual(L.diasBase(pf('2026-09-20', '2026-09-10'), '2026-09'), 11);
    assert.strictEqual(L.diasBase(pf('2026-12-31'), '2026-09'), 30);
    // el término solo cuenta en contratos a plazo fijo
    assert.strictEqual(L.diasBase(T({ fechaTerminoPlazo: '2026-09-05' }), '2026-09'), 30);
});
caso('mesBase: gratificación según la ficha y todo lo demás en cero; el servidor lo acepta tal cual', () => {
    assert.strictEqual(L.mesBase(T(), '2026-09').gratificacion, 'legal');
    assert.strictEqual(L.mesBase(T({ gratificacion: 'ninguna' }), '2026-09').gratificacion, 'ninguna');
    assert.strictEqual(L.mesBase(T({ gratificacion: 'pactada' }), '2026-09').gratificacion, 'manual');
    const m = L.mesBase(T(), '2026-09');
    assert.ok(V.validarMes(m).ok, JSON.stringify(V.validarMes(m).errores));
    assert.deepStrictEqual(V.validarMes(m).valor.bonosImponibles, []);
});
caso('resumen del resultado del motor: cumple lo que valida el servidor', () => {
    const vig = P.vigenciaDe('2026-09');
    const mv = { uf: 41000.5, utm: 72151, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp };
    const t = { nombre: 'Ana', rut: '123456785', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 650000, afp: 'Modelo', salud: 'fonasa' };
    const res = E.calcular({ trabajador: t, mes: L.mesBase(t, '2026-09'), periodo: '2026-09' }, mv);
    const r = L.resumen(res, mv);
    assert.ok(r.liquido > 0 && r.liquido < r.totalHaberes);
    const m = Object.assign(L.mesBase(t, '2026-09'), { calculo: r });
    assert.ok(V.validarMes(m).ok, JSON.stringify(V.validarMes(m).errores));
});
caso('resumen con desglose: lo acepta el servidor y el resumen de Previred agrupa por institución', () => {
    const vig = P.vigenciaDe('2026-10');
    const mv = { uf: 41247.63, utm: 72151, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp, empleador: vig.empleador };
    const ana = { nombre: 'Ana', rut: '123456785', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 553553, afp: 'Modelo', salud: 'fonasa' };
    const beto = { nombre: 'Beto', rut: '111111111', fechaIngreso: '2025-01-02', contrato: 'plazo_fijo', jornadaHoras: 42, sueldoBase: 900000, afp: 'Modelo', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3 };
    const c1 = L.resumen(E.calcular({ trabajador: ana, mes: Object.assign(L.mesBase(ana, '2026-10'), { gratificacion: 'ninguna' }), periodo: '2026-10', tasaMutual: 0.93 }, mv), mv, ana);
    const c2 = L.resumen(E.calcular({ trabajador: beto, mes: Object.assign(L.mesBase(beto, '2026-10'), { gratificacion: 'ninguna' }), periodo: '2026-10', tasaMutual: 0.93 }, mv), mv, beto);
    assert.strictEqual(c1.conDesglose, true);
    assert.strictEqual(c1.afp, 58566);
    assert.strictEqual(c1.empAfc, 13285);
    assert.strictEqual(c1.costoEmpleador, 591361);
    const v = V.validarMes(Object.assign(L.mesBase(ana, '2026-10'), { calculo: c1 }));
    assert.ok(v.ok, JSON.stringify(v.errores));
    assert.strictEqual(v.valor.calculo.costoEmpleador, 591361);
    assert.strictEqual(v.valor.calculo.afpNombre, 'Modelo');
    const r = L.previred([c1, c2, { liquido: 1, totalHaberes: 1 }]);
    assert.strictEqual(r.incluidos, 2);
    const fila = n => (r.filas.find(f => f.institucion === n) || {}).monto;
    assert.strictEqual(fila('AFP Modelo'), c1.afp + c1.empAfp + c2.afp + c2.empAfp);
    assert.strictEqual(fila('Fonasa'), c1.salud);
    assert.strictEqual(fila('Isapre Colmena'), c2.salud);
    assert.strictEqual(fila('Seguro de cesantía (AFC)'), c1.afcTrabajador + c1.empAfc + c2.empAfc);
    assert.strictEqual(c2.afcTrabajador, 0);
    assert.strictEqual(r.total, r.filas.reduce((s, f) => s + f.monto, 0));
    assert.strictEqual(r.costo, c1.costoEmpleador + c2.costoEmpleador);
});
caso('el servidor rechaza un desglose con montos inválidos y acepta la tasa de la mutual de la empresa', () => {
    const m = Object.assign(L.mesBase(T(), '2026-10'), { calculo: { liquido: 1, totalHaberes: 1, totalImponible: 1, totalDescuentos: 0, uf: 41000, utm: 72000, conDesglose: true, afp: -5 } });
    assert.strictEqual(V.validarMes(m).ok, false);
    const emp = V.validarEmpresa({ razonSocial: 'Panadería', rut: '111111111', tasaMutual: '1,88' });
    assert.ok(emp.ok, JSON.stringify(emp.errores));
    assert.strictEqual(emp.valor.tasaMutual, 1.88);
    assert.strictEqual(V.validarEmpresa({ razonSocial: 'Panadería', rut: '111111111' }).valor.tasaMutual, 0.93);
    assert.strictEqual(V.validarEmpresa({ razonSocial: 'Panadería', rut: '111111111', tasaMutual: '0,5' }).ok, false);
});
// ---------- préstamos con cuotas ----------
const PREST = (extra) => Object.assign({ id: 'abc123', concepto: 'Préstamo auto', fecha: '2026-10-05', monto: 300001, cuotas: 3, desde: '2026-10', pausas: [] }, extra);

caso('préstamo: cuotas iguales desde el primer mes y la última ajusta el redondeo', () => {
    assert.deepStrictEqual(L.cuotasDe(PREST()), [
        { periodo: '2026-10', numero: 1, monto: 100000 }, { periodo: '2026-11', numero: 2, monto: 100000 }, { periodo: '2026-12', numero: 3, monto: 100001 }
    ]);
    assert.deepStrictEqual(L.cuotasDe(PREST({ cuotas: 1 })), [{ periodo: '2026-10', numero: 1, monto: 300001 }]);
    assert.deepStrictEqual(L.cuotasDe(PREST({ desde: '' })), []);
});
caso('préstamo: una cuota postergada pasa al final y cruza el año', () => {
    const c = L.cuotasDe(PREST({ pausas: ['2026-11'] }));
    assert.deepStrictEqual(c.map(x => x.periodo), ['2026-10', '2026-12', '2027-01']);
    assert.strictEqual(L.cuotasDelMes({ prestamos: [PREST({ pausas: ['2026-11'] })] }, '2026-11').length, 0);
    assert.deepStrictEqual(L.cuotasDelMes({ prestamos: [PREST({ pausas: ['2026-11'] })] }, '2027-01'), [{ id: 'abc123', nombre: 'Préstamo auto', monto: 100001, numero: 3, de: 3 }]);
});
caso('préstamo: avance y saldo al cierre de cada mes', () => {
    const p = PREST();
    assert.deepStrictEqual([L.estadoPrestamo(p, '2026-09').saldo, L.estadoPrestamo(p, '2026-10').saldo, L.estadoPrestamo(p, '2026-12').saldo], [300001, 200001, 0]);
    assert.strictEqual(L.estadoPrestamo(p, '2026-11').pagadas, 2);
    assert.strictEqual(L.estadoPrestamo(p, '2026-10').proxima.periodo, '2026-11');
    assert.strictEqual(L.estadoPrestamo(p, '2026-12').proxima, null);
    assert.strictEqual(L.saldoPrestamos({ prestamos: [p, PREST({ id: 'xyz789', monto: 50000, cuotas: 1, desde: '2026-11' })] }, '2026-10'), 250001);
});
caso('mesBase: trae el anticipo fijo y las cuotas del mes; el servidor lo acepta', () => {
    const t = T({ anticipoMensual: 120000, prestamos: [PREST()] });
    const m = L.mesBase(t, '2026-11');
    assert.strictEqual(m.anticipo, 120000);
    assert.deepStrictEqual(m.cuotasPrestamo, [{ id: 'abc123', nombre: 'Préstamo auto', monto: 100000, numero: 2, de: 3 }]);
    const v = V.validarMes(m);
    assert.ok(v.ok, JSON.stringify(v.errores));
    assert.deepStrictEqual(v.valor.cuotasPrestamo, m.cuotasPrestamo);
    assert.strictEqual(V.validarMes(Object.assign({}, m, { cuotasPrestamo: [{ id: 'abc123', nombre: 'X', monto: 5, numero: 4, de: 3 }] })).ok, false);
    assert.strictEqual(V.validarMes(Object.assign({}, m, { cuotasPrestamo: [{ nombre: 'X', monto: 5, numero: 1, de: 3 }] })).ok, false);
});
caso('motor: la cuota es un descuento pactado que cuenta para el 15% del art. 58; el anticipo no', () => {
    const vig = P.vigenciaDe('2026-10');
    const mv = { uf: 41247.63, utm: 72151, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp };
    const t = { fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 600000, afp: 'Modelo', salud: 'fonasa' };
    const mes = (extra) => Object.assign(L.mesBase(t, '2026-10'), { gratificacion: 'ninguna' }, extra);
    let r = E.calcular({ trabajador: t, mes: mes({ cuotasPrestamo: [{ id: 'abc123', nombre: 'Préstamo auto', monto: 80000, numero: 1, de: 3 }] }), periodo: '2026-10' }, mv);
    const linea = r.otrosDescuentos.find(l => l.concepto === 'Préstamo auto');
    assert.ok(linea && linea.monto === 80000 && linea.detalle === 'Cuota 1 de 3');
    assert.ok(!r.avisos.some(a => /15%/.test(a.texto)), '80.000 es menos del 15% de 600.000');
    r = E.calcular({ trabajador: t, mes: mes({ cuotasPrestamo: [{ id: 'abc123', nombre: 'Préstamo auto', monto: 80000, numero: 1, de: 3 }], otrosDescuentos: [{ nombre: 'Compra', monto: 20000 }] }), periodo: '2026-10' }, mv);
    assert.ok(r.avisos.some(a => /15%/.test(a.texto) && /\$100\.000/.test(a.texto)), 'cuota más descuento pasa de $90.000');
    r = E.calcular({ trabajador: t, mes: mes({ anticipo: 300000 }), periodo: '2026-10' }, mv);
    assert.ok(!r.avisos.some(a => /15%/.test(a.texto)), 'el anticipo no cuenta para el 15%');
});
caso('validación de préstamos: ids nuevos, meses postergados limpios y mensajes claros', () => {
    const e = {};
    const v = V.validarPrestamos([PREST({ id: '' , pausas: ['2026-12', '2026-09', '2026-12'] }), PREST({ id: 'abc123' }), PREST({ id: 'abc123' })], e);
    assert.ok(v, JSON.stringify(e));
    assert.strictEqual(new Set(v.map(p => p.id)).size, 3);
    assert.deepStrictEqual(v[0].pausas, ['2026-12']);
    const err = (x) => { const o = {}; V.validarPrestamos([PREST(x)], o); return o.prestamos || ''; };
    assert.match(err({ monto: 500 }), /monto/);
    assert.match(err({ cuotas: 49 }), /cuotas/);
    assert.match(err({ desde: '2026-09' }), /antes del mes/);
    assert.match(err({ fecha: '' }), /fecha/);
    const muchos = {}; V.validarPrestamos(Array.from({ length: 13 }, () => PREST({ id: '' })), muchos);
    assert.match(muchos.prestamos, /hasta 12/);
    assert.ok(V.validarTrabajador({ nombre: 'Ana', rut: '111111111', anticipoMensual: '100000' }).valor.anticipoMensual === 100000);
    assert.strictEqual(V.validarTrabajador({ nombre: 'Ana', rut: '111111111' }).valor.prestamos, undefined);
});

caso('estadoDe', () => {
    assert.strictEqual(L.estadoDe(null), 'sin_datos');
    assert.strictEqual(L.estadoDe({ emitida: '' }), 'guardada');
    assert.strictEqual(L.estadoDe({ emitida: '2026-10-05' }), 'emitida');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
