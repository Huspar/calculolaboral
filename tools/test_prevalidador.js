// Pruebas del pre-validador de cumplimiento laboral (Previred + LRE + calendario 2026): node tools/test_prevalidador.js
'use strict';
const assert = require('assert');
const PV = require('../js/contadores_prevalidador');
const Previred = require('../js/previred_generador');
const A = require('../js/demo_archivos');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n         ')); process.exitCode = 1; } }

const PER = '2026-10';
const mes = Object.assign({}, P.vigenciaDe(PER), { uf: 39600, utm: 69751 });
const HOY = new Date(2026, 10, 18); // 18-11-2026

function resultado(rec) {
    rec = Object.assign({ rut: '15.234.567-4', nombre: 'Ana Pérez', apPaterno: 'Perez', apMaterno: 'Soto', nombres: 'Ana', sueldo: 650000, dias: 30, afp: 'Modelo', salud: 'fonasa', planUF: 0, contrato: 'indefinido', jornada: 42, ingreso: '2022-03-15', colacion: 40000, movilizacion: 30000, comisiones: 0, horasExtra: 0, gratificacion: 'legal', gratificacionMonto: 0, sexo: 'F', isapreNombre: '', movimiento: '', movDesde: '', movHasta: '', tramoAF: '', cargas: 0, licenciaDias: 0, apvMonto: 0, tipoTrabajador: '0', banco: 'BancoEstado', tipoCuenta: 'vista', numeroCuenta: '123456', fechaTermino: '', causalTermino: '', rutSindicato: '', cuotaSindical: 0, creditoCCAF: 0 }, rec);
    const res = E.calcular({
        periodo: PER, tasaMutual: 0.93,
        trabajador: { sueldoBase: rec.sueldo, afp: rec.afp, salud: rec.salud, isaprePlanUF: rec.planUF, isapreNombre: 'Isapre', contrato: rec.contrato, jornadaHoras: rec.jornada, fechaIngreso: rec.ingreso, colacion: rec.colacion, movilizacion: rec.movilizacion },
        mes: { diasTrabajados: rec.dias, horasExtra: 0, comisiones: 0, gratificacion: 'legal', gratificacionMonto: 0, asignacionFamiliar: 0, otrosNoImponibles: [], otrosDescuentos: [], cuotaSindical: 0, creditoCCAF: 0 }
    }, mes);
    return { record: rec, detalle: res, error: '', avisos: [], liquido: res.liquido };
}

const BASE = { periodo: PER, mutual: 'Mutual de Seguridad', ccaf: '', comuna: 'Temuco', rutEmpresa: '76.543.210-3', uf: 39600, hoy: HOY, previred: Previred, archivos: A };

caso('nómina limpia: todo en verde y calendario con Previred (13 fijo) y LRE (15 días hábiles del mes siguiente)', () => {
    const r = PV.evaluar(Object.assign({}, BASE, { resultados: [resultado({})] }));
    assert.strictEqual(r.estadoGeneral, 'verde', JSON.stringify(r.trabajadores[0].hallazgos));
    assert.strictEqual(r.conteo.rojo, 0);
    assert.ok(r.notas.some(n => /voluntario/i.test(n)), 'con <5 trabajadores avisa LRE voluntario');
    const prev = r.calendario.find(c => c.id === 'previred');
    const lre = r.calendario.find(c => c.id === 'lre');
    assert.strictEqual(prev.fechaLimite, '2026-11-13');
    assert.strictEqual(lre.fechaLimite, '2026-11-20', 'noviembre 2026 tiene 15 días hábiles el viernes 20-11 (lun-vie)');
    assert.strictEqual(prev.estado, 'vencido');
    assert.strictEqual(lre.estado, 'critico');
});

caso('sin mutualidad, RUT empresa o comuna con 5+ trabajadores: bloquea (rojo) a nivel general', () => {
    const cinco = [1, 2, 3, 4, 5].map(i => resultado({ rut: ['15.234.567-4', '19.876.543-0', '12.345.678-5', '9.876.543-3', '11.111.111-1'][i - 1], nombre: 'Trab ' + i }));
    const r = PV.evaluar(Object.assign({}, BASE, { mutual: '', rutEmpresa: '', comuna: '', resultados: cinco }));
    assert.strictEqual(r.estadoGeneral, 'rojo');
    assert.ok(r.generales.some(g => g.nivel === 'rojo' && /mutualidad/i.test(g.texto)));
    assert.ok(r.generales.some(g => g.nivel === 'rojo' && /RUT de la empresa/i.test(g.texto)));
    assert.ok(r.generales.some(g => g.nivel === 'rojo' && /comuna/i.test(g.texto)));
});

caso('RUT inválido/duplicado, días fuera de rango, exceso licencia y error de cálculo salen en rojo', () => {
    const malo = resultado({ rut: '15.234.567-9', nombre: 'Rut Malo' });
    const dup1 = resultado({ rut: '19.876.543-0', nombre: 'Dup Uno' });
    const dup2 = resultado({ rut: '19.876.543-0', nombre: 'Dup Dos' });
    const dias = resultado({ rut: '12.345.678-5', nombre: 'Dias Raros', dias: 25, licenciaDias: 10 });
    const err = { record: { nombre: 'Sin Sueldo', rut: '9.876.543-3' }, error: 'Falta el sueldo base', detalle: null, avisos: [], liquido: 0 };
    const r = PV.evaluar(Object.assign({}, BASE, { resultados: [malo, dup1, dup2, dias, err] }));
    const por = n => r.trabajadores.find(t => t.nombre === n);
    assert.strictEqual(por('Rut Malo').nivel, 'rojo');
    assert.ok(por('Dup Uno').hallazgos.some(h => /duplicado/i.test(h.texto)));
    assert.ok(por('Dias Raros').hallazgos.some(h => /superan 30/i.test(h.texto)));
    assert.ok(por('Sin Sueldo').hallazgos.some(h => h.origen === 'Cálculo'));
});

caso('pensionado vejez con AFC o tipo 2 con AFP/SIS y exceso de tope 2026 bloquean en rojo', () => {
    const pensAfc = resultado({ nombre: 'Pens AFC', tipoTrabajador: '1' });
    const pensNoCot = resultado({ nombre: 'Pens NoCot', rut: '19.876.543-0', tipoTrabajador: '2' });
    const sobreTope = resultado({ nombre: 'Sobre Tope', rut: '12.345.678-5', sueldo: 4000000 });
    sobreTope.detalle.bases.baseAfp = 3600000; // > 90 * 39600 = 3.564.000
    const r = PV.evaluar(Object.assign({}, BASE, { resultados: [pensAfc, pensNoCot, sobreTope] }));
    assert.ok(r.trabajadores[0].hallazgos.some(h => h.nivel === 'rojo' && /Cesantía/i.test(h.texto)));
    assert.ok(r.trabajadores[1].hallazgos.some(h => h.nivel === 'rojo' && /no cotiza/i.test(h.texto)));
    assert.ok(r.trabajadores[2].hallazgos.some(h => h.nivel === 'rojo' && /tope legal/i.test(h.texto)));
});

caso('retiro sin causal bloquea en rojo; con causal sale limpio', () => {
    const sinCausal = resultado({ nombre: 'Retiro Uno', movimiento: 'retiro', movHasta: '20-10-2026', fechaTermino: '2026-10-20', causalTermino: '', dias: 20 });
    const conCausal = resultado({ nombre: 'Retiro Dos', rut: '19.876.543-0', movimiento: 'retiro', movHasta: '20-10-2026', fechaTermino: '2026-10-20', causalTermino: A.causalCodigo('Renuncia voluntaria'), dias: 20 });
    const r = PV.evaluar(Object.assign({}, BASE, { resultados: [sinCausal, conCausal] }));
    assert.ok(r.trabajadores[0].hallazgos.some(h => h.origen === 'LRE' && h.nivel === 'rojo' && /causal/i.test(h.texto)));
    assert.strictEqual(r.trabajadores[1].nivel, 'verde', JSON.stringify(r.trabajadores[1].hallazgos));
});

caso('calendario: contrato a 15 días hábiles, feriados descontados y término diferenciado por causal', () => {
    const cal = PV.calendarioVencimientos({
        periodo: '2026-11', hoy: '2026-11-18', trabajadoresCount: 6,
        eventos: [
            { tipo: 'contrato', fecha: '2026-11-16', nombre: 'Alta Nueva' },
            { tipo: 'termino', fecha: '2026-11-16', nombre: 'Plazo Fijo', causal: '6' },
            { tipo: 'termino', fecha: '2026-11-16', nombre: 'Renuncia', causal: '4' }
        ]
    });
    const c = cal.find(x => x.id === 'contrato-0');
    assert.strictEqual(c.fechaLimite, '2026-12-07', '15 días hábiles lun-vie desde 16-11 = 07-12 (08-12 es feriado)');
    const tPlazo = cal.find(x => x.id === 'termino-1');
    assert.strictEqual(tPlazo.fechaLimite, '2026-11-19', 'causal 6: 3 días hábiles desde lunes 16-11 = jueves 19-11');
    const tRenuncia = cal.find(x => x.id === 'termino-2');
    assert.strictEqual(tRenuncia.fechaLimite, '2026-11-30', 'causal 4: 10 días hábiles lun-vie desde lunes 16-11 = lunes 30-11');
    // Saltar feriado 08-12-2026 en sumarDiasHabiles
    assert.strictEqual(PV.sumarDiasHabiles(Date.UTC(2026, 11, 7), 1), Date.UTC(2026, 11, 9), '07-12 + 1 día hábil salta el feriado 08-12');
    assert.ok(cal[0].diasRestantes <= cal[cal.length - 1].diasRestantes);
});

caso('eventosDeResultados toma altas, anexos y retiros con causal', () => {
    const ev = PV.eventosDeResultados([
        resultado({ nombre: 'Alta', movimiento: 'alta', movDesde: '05-10-2026' }),
        resultado({ nombre: 'Anexo', rut: '12.345.678-5', movimiento: 'anexo', movDesde: '10-10-2026' }),
        resultado({ nombre: 'Baja', rut: '19.876.543-0', movimiento: 'baja', movHasta: '20-10-2026', causalTermino: '18' })
    ]);
    assert.deepStrictEqual(ev.map(e => e.tipo + ':' + e.fecha + ':' + (e.causal || '')), [
        'contrato:2026-10-05:',
        'anexo:2026-10-10:',
        'termino:2026-10-20:18'
    ]);
});

console.log(ok + ' pruebas correctas en Pre-validador');
