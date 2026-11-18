// Pruebas unitarias de motores Ola 2 de Suite Contadores:
// Plan de cuentas editable, Cartola -> Diario, BHE SII 15,25% (sin anuladas),
// DDJJ AT 2026 (1887 + Cert N6 col 7/8 invertidas, 1879 sin 13%, 1947/1948, CPT 62/2020), bloqueo AT 2027, planes de estudio.
// Ejecutar: node tools/test_contadores_ola2.js
'use strict';

const assert = require('assert');
const C = require('../js/contadores_contabilidad');
const F29 = require('../js/contadores_f29');
const Imp = require('../js/contadores_importadores');
const Renta = require('../js/contadores_renta');
const Liq = require('../js/liquidacion_engine');
const Param = require('../js/liquidacion_parametros');
const DatosPyme = require('../api/_pyme/datos');

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

caso('Plan de cuentas configurable permite personalizar codigos/nombres y restaurar base', () => {
    const inicial = C.obtenerPlanCuentas();
    assert.ok(inicial.length >= 20, 'debe tener plan base');
    C.establecerPlanCuentas([
        ...inicial,
        { codigo: '11015', nombre: 'Banco Santander Pyme', tipo: 'activo', grupo: 'disponible' }
    ]);
    assert.strictEqual(C.cuentaInfo('11015').nombre, 'Banco Santander Pyme');
    const restaurado = C.restaurarPlanCuentas();
    assert.strictEqual(restaurado.length, inicial.length);
    assert.strictEqual(C.cuentaInfo('11015').nombre, 'Cuenta 11015');
});

caso('BHE SII 2026: tasa 15,25%, omite ANULADA y alimenta F29 cod. 151 con retencion (no bruto)', () => {
    const csv = [
        'Nro;Fecha Emision;Estado;RUT Emisor;Nombre o Razon Social;Honorarios Brutos;Retencion;Honorarios Liquidos',
        '101;05/11/2026;VIGENTE;12.345.678-5;Consultora Uno;1.000.000;152.500;847.500',
        '102;08/11/2026;ANULADA;12.345.678-5;Consultora Uno;900.000;137.250;762.750',
        '103;15/11/2026;VIGENTE;14.567.890-2;Soporte TI;600.000;91.500;508.500'
    ].join('\n');

    const res = Imp.parsearBheSii(csv, { periodo: '2026-11' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.boletas.length, 2, 'debe omitir boleta ANULADA');
    assert.strictEqual(res.anuladasOmitidas, 1);
    assert.strictEqual(res.totalBruto, 1600000);
    assert.strictEqual(res.totalRetenido, 244000);
    assert.strictEqual(res.codigo151, 244000);
    assert.strictEqual(Imp.tasaRetencionBhe(2026), 0.1525);
    assert.strictEqual(Imp.tasaRetencionBhe(2027), 0.16);
    assert.strictEqual(Imp.tasaRetencionBhe(2028), 0.17);

    const f29 = F29.calcularF29({
        periodo: '2026-11',
        regimen: '14D3',
        honorariosRetencionDirecta: res.codigo151,
        honorariosBruto: res.totalBruto
    });
    assert.strictEqual(f29.codigos[151], 244000);
    assert.notStrictEqual(f29.codigos[151], res.totalBruto);
});

caso('Cartola bancaria CSV genera asientos cuadrados para Libro Diario y Mayor', () => {
    const csv = Imp.ejemploCartolaCsv('2026-11');
    const parsed = Imp.parsearCartola(csv, { periodo: '2026-11' });
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.movimientos.length, 5);
    assert.strictEqual(parsed.totalAbonos, 1487500);
    assert.strictEqual(parsed.totalCargos, 595000 + 385000 + 420000 + 14900);

    const asientos = C.asientosDesdeCartola(parsed.movimientos);
    assert.strictEqual(asientos.length, 5);
    asientos.forEach(a => {
        assert.strictEqual(a.cuadra, true, 'cada asiento de cartola debe cuadrar');
        assert.strictEqual(a.debe, a.haber);
    });
});

caso('Cartola bancaria Excel 2D (encabezado en fila 6, Date ISO, variantes Chile y fila Total omitida)', () => {
    const filasExcel = [
        ['BancoEstado - Cartola Cuenta Vista'],
        ['Cuenta', '000-123456-78'],
        ['Periodo', 'Noviembre 2026'],
        [],
        ['Fecha Movimiento', 'Descripción Movimiento', 'Cheques / Otros Cargos', 'Depósitos / Otros Abonos', 'Saldo Contable'],
        [new Date(Date.UTC(2026, 10, 5)), 'Pago Transbank liquidacion', '', 980000, 3980000],
        [new Date(Date.UTC(2026, 10, 8)), 'Transferencia Previred', -245000, '', 3735000],
        ['TOTALES', '', 245000, 980000, '']
    ];
    const parsed = Imp.parsearCartola(filasExcel, { periodo: '2026-11' });
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.movimientos.length, 2);
    assert.strictEqual(parsed.movimientos[0].fecha, '2026-11-05');
    assert.strictEqual(parsed.movimientos[0].tipo, 'abono');
    assert.strictEqual(parsed.movimientos[0].monto, 980000);
    assert.strictEqual(parsed.movimientos[1].fecha, '2026-11-08');
    assert.strictEqual(parsed.movimientos[1].tipo, 'cargo');
    assert.strictEqual(parsed.movimientos[1].monto, 245000);
    assert.strictEqual(parsed.totalAbonos, 980000);
    assert.strictEqual(parsed.totalCargos, 245000);
    assert.strictEqual(parsed.ultimoSaldo, 3735000);
});

caso('DJ 1887 acumula renta neta (no bruto) y Certificado N6 invierte col 7 Exenta / col 8 No Gravada', () => {
    const vals = Object.assign({}, Param.vigenciaDe('2026-10'), Param.RESPALDO['2026-10']);
    const trabajador = {
        rut: '16.543.210-3',
        nombre: 'Camila Perez',
        tipoContrato: 'indefinido',
        afp: 'Habitat',
        salud: 'fonasa',
        sueldoBase: 1500000,
        gratificacion: 'legal',
        colacion: 50000,
        movilizacion: 30000
    };
    const mes = { diasTrabajados: 30, bonosImponibles: 0 };
    const calc = Liq.calcular({ trabajador, mes, periodo: '2026-10', tasaMutual: 0.0093 }, vals);

    const acum = Renta.acumularLiquidacionesParaDj1887([
        {
            trabajador,
            detalle: calc,
            rentaNoGravada: 80000,
            rentaExenta: 25000,
            rebajaZonasExtremas: 12000
        }
    ]);
    assert.strictEqual(acum.length, 1);
    assert.strictEqual(acum[0].rentaNeta, calc.bases.baseTributable);
    assert.ok(acum[0].rentaNeta < calc.totalImponible, 'renta neta debe descontar AFP/Salud/AFC');

    const dj = Renta.generarDj1887(acum, { anioTributario: 2026 });
    assert.strictEqual(dj.ok, true);
    assert.strictEqual(dj.certificadoN6ColumnasInvertidas, true);

    const f1887 = dj.filas[0];
    const cert6 = dj.certificadosN6[0];
    // DJ 1887: C6 = No Gravada, C7 = Exenta
    assert.strictEqual(f1887.C6_rentaNoGravada, 80000);
    assert.strictEqual(f1887.C7_rentaExenta, 25000);
    // Certificado N°6: col (7) = Exenta, col (8) = No Gravada
    assert.strictEqual(cert6.col7_rentaExenta, 25000);
    assert.strictEqual(cert6.col8_rentaNoGravada, 80000);
    assert.strictEqual(cert6.col9_rebajaZonasExtremas, 12000);

    // Regresion: demo_liquidaciones pasa { record, detalle } en lugar de { trabajador, detalle }
    const acumDesdeRecord = Renta.acumularLiquidacionesParaDj1887([
        { record: trabajador, detalle: calc }
    ]);
    assert.strictEqual(acumDesdeRecord.length, 1);
    assert.strictEqual(acumDesdeRecord[0].rut, '16.543.210-3');
    assert.strictEqual(acumDesdeRecord[0].rentaNeta, calc.bases.baseTributable);
    assert.strictEqual(acumDesdeRecord[0].rentaNoGravada, 80000);
});

caso('DJ 1879 y Certificado N1 suman retencion real 15,25% (no tasa obsoleta 13%)', () => {
    const bhe = Imp.parsearBheSii(Imp.ejemploBheCsv('2026-11'), { periodo: '2026-11' });
    const dj1879 = Renta.generarDj1879(bhe.boletas, { anioTributario: 2026 });
    assert.strictEqual(dj1879.ok, true);
    assert.strictEqual(dj1879.totales.boletas, 3);
    // Brutos ejemplo: 1.000.000 + 600.000 + 400.000 = 2.000.000; 15,25% = 305.000 (13% habria sido 260.000)
    assert.strictEqual(dj1879.totales.brutoTotal, 2000000);
    assert.strictEqual(dj1879.totales.retenidoTotal, 305000);
    assert.strictEqual(dj1879.certificadosN1.length, 3);
});

caso('DJ 1947 (14 D8), DJ 1948 (14 D3 / 14 A) y CPT Simplificado Circular 62/2020', () => {
    const dj1947 = Renta.generarDj1947o1948('14D8', {
        baseImponible: 10000000,
        ppmDisponible: 300000,
        socios: [
            { rut: '11.111.111-1', nombre: 'Socia A', porcentaje: 60 },
            { rut: '22.222.222-2', nombre: 'Socio B', porcentaje: 40 }
        ]
    });
    assert.strictEqual(dj1947.codigoDj, '1947');
    assert.strictEqual(dj1947.filas[0].baseImponibleAsignada, 6000000);
    assert.strictEqual(dj1947.filas[1].creditoPpmAsignado, 120000);

    const dj1948 = Renta.generarDj1947o1948('14D3', {
        tasaIdpc: 12.5,
        socios: [{ rut: '11.111.111-1', nombre: 'Socia A', porcentaje: 100, retiros: 7000000 }]
    });
    assert.strictEqual(dj1948.codigoDj, '1948');
    // Factor 12.5 / 87.5 = 1/7 => credito = 1.000.000
    assert.strictEqual(dj1948.totalCreditoIdpc, 1000000);

    const cpt = Renta.calcularCptSimplificado({
        cptAnterior: 20000000,
        aumentosCapital: 5000000,
        baseImponibleRli: 12000000,
        rentasExentasInr: 1000000,
        disminucionesCapital: 0,
        retirosDividendos: 4000000,
        gastosRechazados: 500000,
        idpcPagado: 1500000,
        capitalAportadoReajustado: 15000000
    });
    assert.strictEqual(cpt.norma, 'Circular SII 62/2020');
    assert.strictEqual(cpt.cptFinal, 32000000);
});

caso('AT 2027 bloqueado explicitamente hasta publicacion SII', () => {
    const val = Renta.validarAnioTributario(2027);
    assert.strictEqual(val.ok, false);
    assert.strictEqual(val.bloqueado, true);

    const res1887 = Renta.generarDj1887([], { anioTributario: 2027 });
    const res1879 = Renta.generarDj1879([], { anioTributario: 2027 });
    const res1948 = Renta.generarDj1947o1948('14D3', {}, { anioTributario: 2027 });
    assert.strictEqual(res1887.bloqueado, true);
    assert.strictEqual(res1879.bloqueado, true);
    assert.strictEqual(res1948.bloqueado, true);
});

caso('Backend PLANES_ESTUDIO define limites 10/30/999 empresas sin alterar MAX_EMPRESAS base', () => {
    assert.strictEqual(DatosPyme.MAX_EMPRESAS, 1);
    assert.strictEqual(DatosPyme.MAX_EMPRESAS_PILOTO, 25);
    assert.deepStrictEqual(DatosPyme.PLANES_ESTUDIO.estudio_independiente, { maxActivos: 50, maxEmpresas: 10 });
    assert.deepStrictEqual(DatosPyme.PLANES_ESTUDIO.estudio_estudio, { maxActivos: 50, maxEmpresas: 30 });
    assert.deepStrictEqual(DatosPyme.PLANES_ESTUDIO.estudio_ilimitado, { maxActivos: 50, maxEmpresas: 999 });
});

console.log('\n' + ok + ' pruebas correctas en motores Ola 2');
