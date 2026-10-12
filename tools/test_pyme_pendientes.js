// Pruebas de los pendientes del mes del Asistente Pyme: node tools/test_pyme_pendientes.js
'use strict';
const assert = require('assert');
const M = require('../js/pyme_pendientes');
const P = require('../js/liquidacion_parametros');
const F = require('../js/feriados_cl');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const EMPRESA = { razonSocial: 'La Espiga', rut: '76.845.123-0' };
const T = (extra) => Object.assign({ id: 't1', nombre: 'Ana Pérez', rut: '12.345.678-5', activo: true, contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 650000, fechaIngreso: '2022-03-15', aniosOtrosEmpleadores: 0, renovaciones: 0 }, extra);
const est = (trabajadores, extra) => Object.assign({ empresa: EMPRESA, trabajadores, limites: { maxActivos: 1, paseVence: null } }, extra);
const RESP = '2026-10-01T10:00:00Z'; // respaldo reciente para que no moleste en las pruebas que no lo miran
const correr = (e, hoy, extra) => M.pendientes(e, Object.assign({ hoy, P, F, ultimoRespaldo: RESP }, extra));
const ids = (l) => l.map(x => x.id);
const pend = (l, id) => l.find(x => x.id === id);

caso('sin empresa: solo pide completarla', () => {
    const l = correr({ empresa: null, trabajadores: [], limites: {} }, '2026-10-20');
    assert.deepStrictEqual(ids(l), ['empresa']);
    assert.strictEqual(l[0].accion.tipo, 'empresa');
});
caso('empresa sin trabajadores: invita a agregar el primero', () => {
    assert.ok(ids(correr(est([]), '2026-10-20')).indexOf('trabajador-nuevo') >= 0);
});
caso('ficha completa y mes tranquilo: no hay avisos', () => {
    assert.deepStrictEqual(correr(est([T()]), '2026-10-20'), []);
});
caso('falta fecha de ingreso o sueldo base', () => {
    const l = correr(est([T({ fechaIngreso: '', sueldoBase: 0 })]), '2026-10-20');
    assert.deepStrictEqual(ids(l).sort(), ['ingreso-t1', 'sueldo-t1']);
    assert.ok(l.every(x => x.nivel === 'aviso' && x.accion.id === 't1'));
});
caso('sueldo bajo el ingreso mínimo: jornada completa y proporcional', () => {
    assert.ok(pend(correr(est([T({ sueldoBase: 500000 })]), '2026-10-20'), 'minimo-t1').texto.indexOf('$553.553') >= 0);
    assert.ok(!pend(correr(est([T({ sueldoBase: 553553 })]), '2026-10-20'), 'minimo-t1'));
    // media jornada (21 de 42 horas): mínimo proporcional $276.777 (redondeado)
    assert.ok(!pend(correr(est([T({ jornadaHoras: 21, sueldoBase: 280000 })]), '2026-10-20'), 'minimo-t1'));
    const bajo = pend(correr(est([T({ jornadaHoras: 21, sueldoBase: 250000 })]), '2026-10-20'), 'minimo-t1');
    assert.ok(bajo && bajo.texto.indexOf('21 horas') >= 0 && bajo.texto.indexOf('$276.777') >= 0);
});
caso('el mínimo usa el valor del mes: en enero de 2026 era $539.000 y la jornada máxima 44 horas', () => {
    assert.ok(!pend(correr(est([T({ jornadaHoras: 44, sueldoBase: 539000 })]), '2026-01-20'), 'minimo-t1'));
    assert.ok(pend(correr(est([T({ jornadaHoras: 44, sueldoBase: 538999 })]), '2026-01-20'), 'minimo-t1'));
});
caso('fuera de los meses con parámetros no se inventa un mínimo', () => {
    assert.ok(!pend(correr(est([T({ sueldoBase: 100000 })]), '2027-03-20'), 'minimo-t1'));
});
caso('plazo fijo: vence en más de 30 días no avisa; en 30 es aviso; en 7 o menos es urgente; vencido es urgente', () => {
    const t = (fin) => T({ contrato: 'plazo_fijo', fechaTerminoPlazo: fin });
    assert.ok(!pend(correr(est([t('2026-11-21')]), '2026-10-20'), 'plazo-t1'));
    assert.strictEqual(pend(correr(est([t('2026-11-19')]), '2026-10-20'), 'plazo-t1').nivel, 'aviso');
    assert.strictEqual(pend(correr(est([t('2026-10-27')]), '2026-10-20'), 'plazo-t1').nivel, 'urgente');
    const hoy = pend(correr(est([t('2026-10-20')]), '2026-10-20'), 'plazo-t1');
    assert.ok(hoy.nivel === 'urgente' && /vence hoy/.test(hoy.titulo));
    const vencido = pend(correr(est([t('2026-10-10')]), '2026-10-20'), 'plazo-t1');
    assert.ok(vencido.nivel === 'urgente' && /ya venció/.test(vencido.titulo) && /hace 10 días/.test(vencido.texto));
    assert.ok(/art\. 159 N°4/.test(vencido.texto));
});
caso('plazo fijo: avisa si ya tiene una renovación', () => {
    const p = pend(correr(est([T({ contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-11-05', renovaciones: 1 })]), '2026-10-20'), 'plazo-t1');
    assert.ok(/Ya tiene 1 renovación\./.test(p.texto));
});
caso('feriado progresivo: 1 día a los 13 años (10 + 3), contando años de otros empleadores', () => {
    assert.ok(!pend(correr(est([T({ fechaIngreso: '2014-10-20' })]), '2026-10-20'), 'progresivo-t1'), '12 años: nada todavía');
    const p = pend(correr(est([T({ fechaIngreso: '2013-10-20' })]), '2026-10-20'), 'progresivo-t1');
    assert.ok(p && /1 día hábil adicional/.test(p.texto) && /art\. 68/.test(p.texto));
    const q = pend(correr(est([T({ fechaIngreso: '2020-10-20', aniosOtrosEmpleadores: 7 })]), '2026-10-20'), 'progresivo-t1');
    assert.ok(q && /13 años/.test(q.texto));
    assert.ok(/2 días hábiles adicionales/.test(pend(correr(est([T({ fechaIngreso: '2010-10-20' })]), '2026-10-20'), 'progresivo-t1').texto), '16 años: 2 días');
});
caso('años cumplidos: un día antes del aniversario aún no cuenta', () => {
    assert.strictEqual(M.anios('2013-10-21', '2026-10-20'), 12);
    assert.strictEqual(M.anios('2013-10-20', '2026-10-20'), 13);
});
caso('cotizaciones: solo del 1 al 13 del mes; el 10 que cae en día inhábil pasa al hábil siguiente', () => {
    assert.ok(!pend(correr(est([T()]), '2026-10-14'), 'cotizaciones'));
    assert.ok(!pend(correr(est([T()]), '2026-10-31'), 'cotizaciones'));
    const l = correr(est([T()]), '2026-11-03'); // 10-nov-2026 es martes
    const c = pend(l, 'cotizaciones');
    assert.ok(/Cotizaciones de octubre 2026/.test(c.titulo) && /hasta el 10 de noviembre/.test(c.texto) && /hasta el 13 de noviembre/.test(c.texto) && /Previred/.test(c.texto));
    assert.strictEqual(c.nivel, 'info');
    const sabado = pend(correr(est([T()]), '2026-08-03'), 'cotizaciones'); // 10-ago-2026 es lunes
    assert.ok(/hasta el 10 de agosto/.test(sabado.texto));
    const finde = pend(correr(est([T()]), '2026-10-02'), 'cotizaciones'); // 10-oct-2026 es sábado: pasa al martes 13 (lunes 12 feriado)
    assert.ok(/hasta el 13 de octubre/.test(finde.texto) && /cae en día inhábil/.test(finde.texto));
});
caso('cotizaciones: aviso a 3 días y urgente cuando ya pasó el 10 (y falta hasta el 13 por internet)', () => {
    assert.strictEqual(pend(correr(est([T()]), '2026-11-07'), 'cotizaciones').nivel, 'aviso');
    assert.strictEqual(pend(correr(est([T()]), '2026-11-11'), 'cotizaciones').nivel, 'urgente');
});
caso('cotizaciones en enero cuenta diciembre del año anterior; sin trabajadores activos no avisa', () => {
    assert.ok(/Cotizaciones de diciembre 2026/.test(pend(correr(est([T()]), '2027-01-05'), 'cotizaciones').titulo));
    assert.ok(!pend(correr(est([T({ activo: false })]), '2026-11-03'), 'cotizaciones'));
});
caso('cotizaciones en un año sin feriados verificados: muestra el día 10 sin corrimiento, sin fallar', () => {
    const c = pend(correr(est([T()]), '2028-02-03'), 'cotizaciones');
    assert.ok(c && /hasta el 10 de febrero/.test(c.texto));
});
caso('pase por vencer: aviso desde 15 días, urgente desde 3', () => {
    const con = (venceIso) => est([T()], { limites: { maxActivos: 5, paseVence: venceIso } });
    assert.ok(!pend(correr(con('2026-11-10T00:00:00Z'), '2026-10-20'), 'pase'));
    assert.strictEqual(pend(correr(con('2026-11-04T00:00:00Z'), '2026-10-20'), 'pase').nivel, 'aviso');
    assert.strictEqual(pend(correr(con('2026-10-22T00:00:00Z'), '2026-10-20'), 'pase').nivel, 'urgente');
    assert.ok(/hoy/.test(pend(correr(con('2026-10-20T23:00:00Z'), '2026-10-20'), 'pase').titulo));
});
caso('nota normativa del mes (mayo de 2026: ingreso mínimo retroactivo)', () => {
    const n = pend(correr(est([T()]), '2026-05-20'), 'nota-mes');
    assert.ok(n && /553\.553/.test(n.texto));
});
caso('respaldo: sin respaldo o con más de 30 días es un aviso; reciente no', () => {
    assert.strictEqual(pend(M.pendientes(est([T()]), { hoy: '2026-10-20', P, F, ultimoRespaldo: null }), 'respaldo').nivel, 'aviso');
    assert.ok(!pend(M.pendientes(est([T()]), { hoy: '2026-10-20', P, F, ultimoRespaldo: '2026-09-21T00:00:00Z' }), 'respaldo'), '29 días');
    const viejo = pend(M.pendientes(est([T()]), { hoy: '2026-10-20', P, F, ultimoRespaldo: '2026-09-10T00:00:00Z' }), 'respaldo');
    assert.ok(viejo && /Hace 40 días/.test(viejo.titulo) && viejo.accion.tipo === 'respaldo');
});
caso('los trabajadores inactivos no generan avisos de ficha', () => {
    const l = correr(est([T({ activo: false, fechaIngreso: '', sueldoBase: 0, contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-01' })]), '2026-10-20');
    assert.deepStrictEqual(l, []);
});
caso('orden: urgentes primero, luego avisos y por último información, sin perder el orden dentro de cada grupo', () => {
    const l = correr(est([T({ id: 'a', nombre: 'A', fechaIngreso: '' }), T({ id: 'b', nombre: 'B', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-05', rut: '11.111.111-1' })]), '2026-11-03', { ultimoRespaldo: null });
    const niveles = l.map(x => x.nivel);
    assert.deepStrictEqual(niveles, niveles.slice().sort((x, y) => ({ urgente: 0, aviso: 1, info: 2 }[x] - { urgente: 0, aviso: 1, info: 2 }[y])));
    assert.strictEqual(l[0].id, 'plazo-b');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
