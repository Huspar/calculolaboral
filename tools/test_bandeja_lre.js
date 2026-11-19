// Pruebas unitarias de js/bandeja_lre.js (bandeja de estados LRE por empresa):
// vencimiento legal (15.o dia habil del mes siguiente), dias habiles restantes,
// estados por periodo/cliente, ciclo avanzar y resumen de KPIs.
// Ejecutar: node tools/test_bandeja_lre.js
'use strict';

const assert = require('assert');
const B = require('../js/bandeja_lre');

let ok = 0;
function caso(nombre, fn) {
    try {
        fn();
        ok++;
        console.log('  ok  ' + nombre);
    } catch (e) {
        console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message));
        process.exitCode = 1;
    }
}

caso('Vencimiento LRE 2026-11: 15.o dia habil de diciembre 2026 (sabado inhabil, sin 8 ni 25 dic)', () => {
    const v = B.vencimientoLre('2026-11');
    assert.strictEqual(v.cubierto, true);
    // dic-2026 (1 = martes): 1,2,3,4 (4) · 7,9,10,11 (8) · 14..18 (13) · 21 (14) · 22 (15)
    assert.strictEqual(v.vence, '2026-12-22');
});

caso('Vencimiento LRE 2026-12: 15 dias habiles de enero 2027 (sin 1-ene)', () => {
    const v = B.vencimientoLre('2026-12');
    assert.strictEqual(v.cubierto, true);
    // habiles ene-2027: 4,5,6,7,8 (5) 11..15 (10) 18..22 (15) => 22-01-2027
    assert.strictEqual(v.vence, '2027-01-22');
});

caso('Periodo invalido y anio sin cobertura de feriados se reportan', () => {
    assert.strictEqual(B.vencimientoLre('2026-13'), null);
    assert.strictEqual(B.vencimientoLre('nada'), null);
    assert.strictEqual(B.vencimientoLre('2030-01').cubierto, false);
    assert.strictEqual(B.vencimientoLre('2030-01').vence, null);
});

caso('Dias habiles restantes: dentro del plazo, dia exacto y vencido', () => {
    // Periodo 2026-11 vence 2026-12-22 (martes).
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-12-18'), 2, 'viernes 18: quedan lunes 21 y martes 22');
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-12-21'), 1, 'lunes 21: queda el martes 22');
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-12-22'), 1, 'hoy es el vencimiento: el plazo corre hoy');
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-12-19'), 2, 'domingo 19 inhabil: quedan lunes 21 y martes 22');
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-12-23'), -1, 'miercoles 23: vencido hace 1 dia habil');
    assert.strictEqual(B.diasHabilesRestantes('2026-11', '2026-11-30'), 15, 'desde el 30-11 quedan los 15 habiles de diciembre');
    assert.strictEqual(B.diasHabilesRestantes('2030-01', '2026-12-01'), null, 'sin cobertura de feriados no se calcula');
});

caso('Estados por empresa: marcar, leer, persistir y ciclo avanzar', () => {
    const guardar = {};
    const almacen = {
        getItem: (k) => (k in guardar ? guardar[k] : null),
        setItem: (k, v) => { guardar[k] = v; },
        removeItem: (k) => { delete guardar[k]; }
    };
    const bandeja = B.crear(almacen);
    // Sin datos: empresa nueva cae en pendiente por defecto al consultar resumen
    assert.strictEqual(bandeja.obtener('2026-11', 'Panaderia San Isidro SpA'), null);
    bandeja.marcar('2026-11', 'Panaderia San Isidro SpA', 'enviado', '2026-12-10T12:00:00Z');
    const e = bandeja.obtener('2026-11', 'Panaderia San Isidro SpA');
    assert.strictEqual(e.estado, 'enviado');
    assert.strictEqual(e.etiqueta, 'Enviado a Mi DT');
    assert.strictEqual(e.fecha, '2026-12-10T12:00:00Z');
    // otro cliente y otro periodo son independientes
    bandeja.marcar('2026-11', 'Ferreteria El Clavo Ltda', 'cargado');
    bandeja.marcar('2026-12', 'Panaderia San Isidro SpA', 'pendiente');
    const est11 = bandeja.estados('2026-11');
    assert.strictEqual(Object.keys(est11).length, 2);
    assert.strictEqual(bandeja.obtener('2026-11', 'Ferreteria El Clavo Ltda').estado, 'cargado');
    assert.strictEqual(bandeja.obtener('2026-12', 'Panaderia San Isidro SpA').estado, 'pendiente');
    // ciclo: cargado -> rectificar
    assert.strictEqual(bandeja.avanzar('2026-11', 'Ferreteria El Clavo Ltda'), 'rectificar');
    // ciclo: rectificar -> enviado
    assert.strictEqual(bandeja.avanzar('2026-11', 'Ferreteria El Clavo Ltda'), 'enviado');
    // estado desconocido rechazado
    assert.throws(() => bandeja.marcar('2026-11', 'X', 'borrado'), /Estado desconocido/);
    // periodo invalido rechazado
    assert.throws(() => bandeja.marcar('2026-1', 'X', 'enviado'), /periodo/);
});

caso('Resumen de KPIs por periodo cuenta pendientes de empresas de la cartera', () => {
    const guardar = {};
    const almacen = {
        getItem: (k) => (k in guardar ? guardar[k] : null),
        setItem: (k, v) => { guardar[k] = v; },
        removeItem: (k) => { delete guardar[k]; }
    };
    const bandeja = B.crear(almacen);
    bandeja.marcar('2026-11', 'Cliente A', 'cargado');
    bandeja.marcar('2026-11', 'Cliente B', 'observado');
    // Cliente C no se ha marcado: debe contarse como pendiente
    const res = bandeja.resumen('2026-11', ['Cliente A', 'Cliente B', 'Cliente C']);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.cargado, 1);
    assert.strictEqual(res.observado, 1);
    assert.strictEqual(res.pendiente, 1);
});

console.log('test_bandeja_lre: ' + ok + ' OK');
if (process.exitCode) console.error('HUBO FALLAS');
