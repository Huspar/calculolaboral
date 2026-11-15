// Pruebas del módulo Cumplimiento DT, Ley Karin, DS 44 y Firma Simple: node tools/test_pyme_cumplimiento.js
'use strict';
const assert = require('assert');
const C = require('../js/pyme_cumplimiento');
const F = require('../js/feriados_cl');
const V = require('../api/_pyme/validar');

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message)); process.exitCode = 1; }
}

const EMP = { razonSocial: 'Los Aromos SpA', rut: '76.543.210-3', mutual: 'ACHS', direccion: 'Av. Alemania 0450' };
const TRAB = (extra) => Object.assign({
    id: 't1', nombre: 'Ana Pérez', rut: '15.234.567-4', fechaIngreso: '2024-03-01', jornadaHoras: 42,
    sueldoBase: 650000, midtRegistrado: true, irlEntrega: '2025-02-10', karinEntrega: '2024-08-01',
    anexoDatosEntrega: '2026-10-15', correoPersonal: 'ana@correo.cl', consentimientoElectronico: true, activo: true
}, extra);

caso('RIOHS aplica desde 10 trabajadores permanentes; RIHS DS 44 aplica siempre', () => {
    const baseD = {
        correoPrivacidad: 'priv@aromos.cl', responsableDatos: 'Manuel', encargados: [{ dpaFirmado: true }], rat: [{ actividad: 'Personal' }],
        cumplimientoDt: { trabajadoresPermanentes: 4, rihsVigente: true, asistenciaSistema: 'electronico_res38', canalKarinActivo: true, previredAlDia: true, jornadaRevisada42h: true }
    };
    const ev4 = C.evaluarCarpetaDt({ empresa: EMP, trabajadores: [TRAB()] }, baseD, '2026-11-15');
    assert.strictEqual(ev4.requiereRiohs, false);
    assert.strictEqual(ev4.itemsDt.find(x => x.id === 'riohs').estado, 'no_aplica');
    assert.strictEqual(ev4.itemsDt.find(x => x.id === 'rihs').estado, 'ok');
    assert.strictEqual(ev4.pctDt, 100);

    const d12 = Object.assign({}, baseD, { cumplimientoDt: Object.assign({}, baseD.cumplimientoDt, { trabajadoresPermanentes: 12, riohsVigente: false }) });
    const ev12 = C.evaluarCarpetaDt({ empresa: EMP, trabajadores: [TRAB()] }, d12, '2026-11-15');
    assert.strictEqual(ev12.requiereRiohs, true);
    assert.strictEqual(ev12.itemsDt.find(x => x.id === 'riohs').estado, 'pendiente');
    assert.ok(ev12.pctDt < 100);
});

caso('CPHS se exige sobre 25 trabajadores y jornada >42h marca riesgo', () => {
    const d28 = { cumplimientoDt: { trabajadoresPermanentes: 28, cphsActivo: false } };
    const ev = C.evaluarCarpetaDt({ empresa: EMP, trabajadores: [TRAB({ jornadaHoras: 45 })] }, d28, '2026-11-15');
    assert.strictEqual(ev.requiereCphs, true);
    assert.strictEqual(ev.itemsDt.find(x => x.id === 'cphs').estado, 'riesgo');
    assert.strictEqual(ev.itemsDt.find(x => x.id === 'jornada_42h').estado, 'riesgo');
});

caso('Ley Karin: 3 días hábiles decisión, 30 días hábiles sin prórroga y alerta de derivación obligatoria si involucra empleador', () => {
    const casoEmp = {
        codigo: 'KARIN-2026-001',
        fechaRecepcion: '2026-11-02', // lunes
        clasificacion: 'acoso_laboral',
        via: 'interna',
        denunciadoInvolucraEmpleador: true,
        fechaResguardo: '2026-11-02',
        estado: 'resguardo'
    };
    const pl = C.evaluarCasoKarin(casoEmp, '2026-11-10', F);
    assert.strictEqual(pl.venceDecision3d, '2026-11-05'); // 3 dias habiles (mar 3, mie 4, jue 5)
    assert.ok(pl.hitoActivo.includes('Derivar OBLIGATORIAMENTE a la DT'));
    assert.strictEqual(pl.vencido, true);

    const htmlCarpeta = C.construirIndiceCarpetaDtHtml({ empresa: EMP, trabajadores: [TRAB()] }, { cumplimientoDt: {} }, '2026-11-15');
    assert.ok(htmlCarpeta.includes('Agencia de Protección de Datos Personales'));
    assert.ok(htmlCarpeta.includes('Los Aromos SpA'));
});

caso('Matriz documental y rechazo legal estricto de finiquito / despido en firma simple', () => {
    const t2 = TRAB({ id: 't2', nombre: 'Bruno', rut: '19.876.543-0', irlEntrega: '', karinEntrega: '', midtRegistrado: false, consentimientoElectronico: false });
    const d = {
        documentosFirma: [
            { id: 'f1', trabajadorId: 't2', tipo: 'constancia_rihs_irl', titulo: 'Constancia IRL', fechaEmision: '2026-11-15', estado: 'pendiente_firma' },
            { id: 'f2', trabajadorId: 't1', tipo: 'anexo_datos', titulo: 'Anexo Datos', fechaEmision: '2026-11-10', estado: 'firmado', hashSha256: 'abc' }
        ]
    };
    const mat = C.resumenMatrizDocumentos({ empresa: EMP, trabajadores: [TRAB(), t2] }, d);
    assert.strictEqual(mat.totalTrabajadores, 2);
    assert.strictEqual(mat.pendientesFirmaTotal, 1);
    assert.strictEqual(mat.firmadosTotal, 1);
    assert.strictEqual(mat.filas[0].pct, 100);
    assert.strictEqual(mat.filas[1].pct, 20);

    // El validador backend rechaza rotundamente finiquito y cartas de despido para firma simple
    ['finiquito', 'carta_161', 'carta_159_4'].forEach(tipoExcl => {
        const res = V.validarDatosLey21719({
            documentosFirma: [{ trabajadorId: 't1', tipo: tipoExcl, titulo: 'Doc excluido', fechaEmision: '2026-11-15', estado: 'pendiente_firma' }]
        });
        assert.strictEqual(res.ok, false, tipoExcl + ' debe ser rechazado');
    });

    const diag = C.diagnosticoCumplimiento({ empresa: EMP, trabajadores: [TRAB(), t2] }, d, '2026-11-15', F);
    assert.ok(diag.score >= 0 && diag.score <= 100);
    assert.strictEqual(C.normalizarRutUlt4('15.234.567-4'), '5674');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
