/*
 * Pruebas unitarias de js/pyme_equipo_ui.js (sin dependencias externas).
 */
'use strict';

var assert = require('assert');
var E = require('../js/pyme_equipo_ui.js');
var L = require('../js/liquidacion_engine.js');

var pruebas = 0;
function ok(nombre, fn) {
    fn();
    pruebas++;
    console.log('  ok ', nombre);
}

ok('clasificarAreaTrabajador agrupa cargos reales sin exigir configuracion previa', function () {
    assert.strictEqual(E.clasificarAreaTrabajador({ cargo: 'Panadera' }), 'Producción y Taller');
    assert.strictEqual(E.clasificarAreaTrabajador({ cargo: 'Vendedor' }), 'Ventas y Atención');
    assert.strictEqual(E.clasificarAreaTrabajador({ cargo: 'Encargada de local' }), 'Administración y Supervisión');
    assert.strictEqual(E.clasificarAreaTrabajador({ cargo: 'Chofer', area: 'Despacho' }), 'Despacho');
});

ok('calcularMontoHorasExtra coincide peso a peso con liquidacion_engine.js', function () {
    var m = E.calcularMontoHorasExtra(650000, 42, 4);
    var res = L.calcular({
        trabajador: { sueldoBase: 650000, jornadaHoras: 42, gratificacion: 'legal', afp: 'Modelo', salud: 'fonasa', contrato: 'indefinido' },
        mes: { diasTrabajados: 30, horasExtra: 4 }
    }, { uf: 39643.59, utm: 69542, imm: 539000, afp: { Modelo: 0.1058 } });
    var lineaHe = res.haberesImponibles.filter(function (x) { return x.concepto === 'Horas extra'; })[0];
    assert.ok(lineaHe);
    assert.strictEqual(m, lineaHe.monto);
});

ok('resumenEquipoKpis cuenta activos, ausencias vigentes, plazos fijos y solicitudes', function () {
    var r = E.resumenEquipoKpis({
        hoy: '2026-11-15',
        trabajadores: [
            { id: '1', nombre: 'Ana', contrato: 'indefinido', activo: true },
            { id: '2', nombre: 'Bruno', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-11-27', activo: true, ausencias: [{ tipo: 'licencia', desde: '2026-11-14', hasta: '2026-11-18' }] },
            { id: '3', nombre: 'Carla', contrato: 'indefinido', activo: false }
        ],
        vacCache: [],
        solicitudes: [
            { id: 's1', tipo: 'vacaciones', estado: 'pendiente' },
            { id: 's2', tipo: 'horas_extra', estado: 'pendiente' },
            { id: 's3', tipo: 'permiso', estado: 'aprobada' }
        ]
    });
    assert.strictEqual(r.activos, 2);
    assert.strictEqual(r.ausentesHoy, 1);
    assert.strictEqual(r.plazosPorVencer, 1);
    assert.strictEqual(r.solicitudesPendientes, 2);
});

ok('construirOrganigrama genera nivel de gerencia y areas con alertas visuales', function () {
    var org = E.construirOrganigrama({
        hoy: '2026-11-15',
        empresa: { representante: 'Manuel Lagos', razonSocial: 'Los Aromos SpA' },
        trabajadores: [
            { id: '1', nombre: 'Ana Perez', cargo: 'Panadera', contrato: 'indefinido', activo: true },
            { id: '2', nombre: 'Bruno Castillo', cargo: 'Vendedor', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-11-27', activo: true }
        ],
        vacCache: []
    });
    assert.strictEqual(org.lider.nombre, 'Manuel Lagos');
    assert.strictEqual(org.areas.length, 2);
    var ventas = org.areas.filter(function (a) { return /Ventas/.test(a.nombre); })[0];
    assert.strictEqual(ventas.miembros[0].alerta, true);
});

ok('crearSolicitudesIniciales y flujo aprobar/rechazar actualizan estado limpiamente', function () {
    var sols = E.crearSolicitudesIniciales({
        hoy: '2026-11-15',
        trabajadores: [
            { id: 't1', nombre: 'Ana Perez', cargo: 'Panadera' },
            { id: 't2', nombre: 'Bruno Castillo', cargo: 'Vendedor' }
        ]
    });
    assert.ok(sols.length >= 2);
    var aprob = E.aprobarSolicitudEnLista(sols, sols[0].id);
    assert.strictEqual(aprob[0].estado, 'aprobada');
    var rech = E.rechazarSolicitudEnLista(sols, sols[1].id, 'Sin presupuesto');
    assert.strictEqual(rech[1].estado, 'rechazada');
    assert.strictEqual(rech[1].motivoRechazo, 'Sin presupuesto');
});

ok('novedadesDelMesResumen resume horas extra, licencias y vacaciones del periodo', function () {
    var nov = E.novedadesDelMesResumen({
        periodo: '2026-11',
        trabajadores: [
            { id: '1', nombre: 'Ana Perez', sueldoBase: 650000, jornadaHoras: 42, activo: true },
            { id: '2', nombre: 'Bruno Castillo', sueldoBase: 560000, activo: true, ausencias: [{ tipo: 'licencia', desde: '2026-11-14', hasta: '2026-11-18' }] }
        ],
        mesesPeriodo: { '1': { horasExtra: 4 } },
        vacCache: [{ trabajadorId: '1', tipo: 'periodo', desde: '2026-11-02', hasta: '2026-11-04', dias: 3 }]
    });
    assert.strictEqual(nov.length, 3);
});

console.log('\n' + pruebas + ' pruebas correctas en pyme_equipo_ui');
