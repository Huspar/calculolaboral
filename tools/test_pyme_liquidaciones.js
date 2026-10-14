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
caso('el resumen guarda las bases del finiquito (horas extra, gratificación, colación y movilización) y el servidor las valida', () => {
    const t = T({ colacion: 40000, movilizacion: 30000 });
    const mes = L.mesBase(t, '2026-10');
    mes.horasExtra = 10; mes.gratificacion = 'legal';
    const v = { uf: 41130.94, utm: 72151, imm: 553553, topeAfpUF: 90, topeAfcUF: 135.2, jornadaMaxima: 42, afp: { Modelo: 0.0058 } };
    const res = require('../js/liquidacion_engine.js').calcular({ trabajador: Object.assign({ contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 900000 }, { colacion: 40000, movilizacion: 30000 }), mes, periodo: '2026-10' }, v);
    const c = L.resumen(res, v, t);
    assert.strictEqual(c.conBases, true);
    assert.ok(c.horasExtra > 0 && c.gratificacion > 0, JSON.stringify(c));
    assert.strictEqual(c.colMov, 70000);
    const ok = V.validarMes(Object.assign(L.mesBase(T(), '2026-10'), { calculo: Object.assign({}, c, { uf: 41130.94, utm: 72151 }) }));
    assert.ok(ok.ok, JSON.stringify(ok.errores));
    assert.strictEqual(ok.valor.calculo.colMov, 70000);
    assert.strictEqual(V.validarMes(Object.assign(L.mesBase(T(), '2026-10'), { calculo: Object.assign({}, c, { colMov: -1 }) })).ok, false);
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

caso('semana corrida del mes: comisiones y tratos, sin vacaciones, licencias ni permisos en el promedio (art. 45, Ord. 833/2024)', () => {
    const F = require('../js/feriados_cl');
    const t = T({ distribucion: '5' });
    const mes = (extra) => Object.assign(L.mesBase(t, '2026-10'), { comisiones: 600000 }, extra);
    const sc = (m, opc) => L.semanaCorridaMes(t, m, '2026-10', Object.assign({ esFeriado: F.esFeriado }, opc));
    // octubre de 2026, lunes a viernes: 21 hábiles, 5 domingos y festivos (el 31 cae en sábado)
    let r = sc(mes());
    assert.strictEqual(r.monto, 142857);
    assert.strictEqual(r.detalle, '5 domingos y festivos × $28.571');
    // vacaciones registradas (19 al 23) y una licencia del 5 al 6: 21 - 5 - 2 = 14 días
    r = sc(mes({ ausencias: [{ tipo: 'licencia', desde: '2026-10-05', hasta: '2026-10-06' }] }), { vacaciones: [{ desde: '2026-10-19', hasta: '2026-10-23' }] });
    assert.strictEqual(r.calculo.divisor, 14);
    assert.strictEqual(r.monto, 214286);
    // los tratos también son base; con jornada de lunes a sábado cambia el divisor
    assert.strictEqual(sc(mes({ comisiones: 0, tratos: 600000 })).monto, 142857);
    assert.strictEqual(L.semanaCorridaMes(T({ distribucion: '6' }), mes(), '2026-10', { esFeriado: F.esFeriado }).monto, 144000);
    // ingreso a mitad de mes: solo desde ese día
    assert.strictEqual(L.semanaCorridaMes(T({ fechaIngreso: '2026-10-15' }), mes(), '2026-10', { esFeriado: F.esFeriado }).monto, 100000);
    // no corresponde o sin variable: nada
    assert.deepStrictEqual([sc(mes({ scModo: 'no' })).aplica, sc(mes({ scModo: 'no' })).monto], [false, 0]);
    assert.strictEqual(sc(mes({ comisiones: 0 })).aplica, false);
    // sin feriados verificados para el año no se inventa: error visible
    const e = L.semanaCorridaMes(t, Object.assign(L.mesBase(t, '2028-03'), { comisiones: 100000 }), '2028-03', { esFeriado: F.esFeriado });
    assert.ok(e.error && /2028/.test(e.error), e.error);
    assert.strictEqual(e.monto, 0);
});
caso('motor: semana corrida y tratos son imponibles y entran en la gratificación legal', () => {
    const v = { uf: 41130.94, utm: 72151, imm: 553553, topeAfpUF: 90, topeAfcUF: 135.2, jornadaMaxima: 42, afp: { Modelo: 0.0058 } };
    const t = { contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa', sueldoBase: 553553 };
    const mes = Object.assign(L.mesBase(T(), '2026-10'), { comisiones: 60000, tratos: 40000, semanaCorrida: 23810, semanaCorridaDetalle: '5 domingos y festivos × $4.762' });
    const res = E.calcular({ trabajador: t, mes, periodo: '2026-10' }, v);
    const linea = (txt) => res.haberesImponibles.find(l => l.concepto === txt) || {};
    assert.strictEqual(linea('Semana corrida').monto, 23810);
    assert.strictEqual(linea('Semana corrida').detalle, '5 domingos y festivos × $4.762');
    assert.strictEqual(linea('Tratos y producción').monto, 40000);
    assert.strictEqual(linea('Gratificación legal').monto, Math.round((553553 + 60000 + 40000 + 23810) * 0.25));
    // sin semana corrida no aparece la línea
    const sin = E.calcular({ trabajador: t, mes: L.mesBase(T(), '2026-10'), periodo: '2026-10' }, v);
    assert.ok(!sin.haberesImponibles.some(l => l.concepto === 'Semana corrida'));
});
caso('servidor: acepta tratos, semana corrida y licencias o permisos con fechas; rechaza fechas al revés o de más', () => {
    const base = Object.assign(L.mesBase(T(), '2026-10'), { comisiones: 600000, tratos: 1000, semanaCorrida: 142857, semanaCorridaDetalle: '5 domingos y festivos × $28.571', ausencias: [{ tipo: 'permiso', desde: '2026-10-05', hasta: '2026-10-06' }] });
    const r = V.validarMes(base);
    assert.ok(r.ok, JSON.stringify(r.errores));
    assert.deepStrictEqual(r.valor.ausencias, [{ tipo: 'permiso', desde: '2026-10-05', hasta: '2026-10-06' }]);
    assert.strictEqual(r.valor.semanaCorrida, 142857);
    assert.strictEqual(r.valor.scModo, 'calcular');
    assert.strictEqual(V.validarMes(Object.assign({}, base, { ausencias: [{ tipo: 'licencia', desde: '2026-10-09', hasta: '2026-10-02' }] })).ok, false);
    assert.strictEqual(V.validarMes(Object.assign({}, base, { ausencias: Array.from({ length: 11 }, () => ({ desde: '2026-10-01', hasta: '2026-10-01' })) })).ok, false);
    assert.strictEqual(V.validarMes(Object.assign({}, base, { ausencias: [{ tipo: 'diagnostico', desde: '2026-10-01', hasta: '2026-10-01' }] })).ok, false);
    assert.strictEqual(V.validarMes(Object.assign({}, base, { scModo: 'otro' })).ok, false);
});

caso('mesBase: los bonos fijos de la ficha se proponen en el mes (imponibles y los no imponibles del art. 41)', () => {
    const t = T({ bonosFijos: [{ tipo: 'imponible', nombre: 'Bono de responsabilidad', monto: 50000 }, { tipo: 'desgaste_herramientas', nombre: 'Desgaste de herramientas', monto: 12000 }, { tipo: 'imponible', nombre: 'Sin monto', monto: 0 }] });
    const m = L.mesBase(t, '2026-10');
    assert.deepStrictEqual(m.bonosImponibles, [{ nombre: 'Bono de responsabilidad', monto: 50000 }]);
    assert.deepStrictEqual(m.otrosNoImponibles, [{ nombre: 'Desgaste de herramientas', monto: 12000 }]);
    assert.ok(V.validarMes(m).ok);
    assert.deepStrictEqual(L.mesBase(T(), '2026-10').bonosImponibles, []);
});

caso('mesBase toma las licencias y permisos de la ficha: días a pagar, días de licencia y la lista del mes', () => {
    const t = T({ ausencias: [{ id: 'a1', tipo: 'licencia', desde: '2026-09-28', hasta: '2026-10-03' }, { id: 'a2', tipo: 'permiso', desde: '2026-10-15', hasta: '2026-10-15' }, { id: 'a3', tipo: 'sin_goce', desde: '2026-10-20', hasta: '2026-10-21' }] });
    const m = L.mesBase(t, '2026-10');
    assert.strictEqual(m.diasLicencia, 3);                 // 1 al 3 de octubre
    assert.strictEqual(m.diasTrabajados, 25);              // 30 - 3 de licencia - 2 sin goce (el permiso con goce se paga)
    assert.deepStrictEqual(m.ausencias, [{ tipo: 'licencia', desde: '2026-10-01', hasta: '2026-10-03' }, { tipo: 'permiso', desde: '2026-10-15', hasta: '2026-10-15' }, { tipo: 'sin_goce', desde: '2026-10-20', hasta: '2026-10-21' }]);
    assert.ok(V.validarMes(m).ok, JSON.stringify(V.validarMes(m).errores));
    assert.strictEqual(L.mesBase(t, '2026-09').diasLicencia, 3); // 28 al 30 de septiembre
    // sin ausencias, igual que antes
    assert.strictEqual(L.mesBase(T(), '2026-10').diasTrabajados, 30);
    assert.strictEqual(L.diasPropuestos(T({ fechaIngreso: '2026-10-15', ausencias: [{ tipo: 'licencia', desde: '2026-10-20', hasta: '2026-10-22' }] }), '2026-10'), 13);
});

caso('estadoDe', () => {
    assert.strictEqual(L.estadoDe(null), 'sin_datos');
    assert.strictEqual(L.estadoDe({ emitida: '' }), 'guardada');
    assert.strictEqual(L.estadoDe({ emitida: '2026-10-05' }), 'emitida');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
