/*
 * Verificacion normativa y contable de la Suite Contadores (F29 + RCV + Diario/Mayor + Balance 8 col + RLI 14 D3 + P&L/Flujo).
 * Ejecutar: node tools/test_contadores_suite.js
 */
'use strict';

const assert = require('assert');
const F29 = require('../js/contadores_f29');
const C = require('../js/contadores_contabilidad');
const A = require('../js/demo_archivos');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');

let ok = 0;
function caso(nombre, fn) {
    try {
        fn();
        ok++;
        console.log('  ok  ' + nombre);
    } catch (err) {
        console.error('  FALLA  ' + nombre + '\n         ' + err.message);
        process.exitCode = 1;
    }
}

caso('RCV Ventas SII (;): suma facturas 33, exentas 34, resumen boletas 39 y resta NC 61 informada positiva', () => {
    const csv = F29.ejemploRcvVentasCsv();
    const v = F29.parsearRcv(csv, 'ventas');
    // 3 facturas 33: netos 6.200.000 + 4.800.000 + 5.500.000 = 16.500.000; IVA = 1.178.000 + 912.000 + 1.045.000 = 3.135.000
    assert.strictEqual(v.cantFacturasGiro, 3);
    assert.strictEqual(v.netoGiro, 16500000);
    assert.strictEqual(v.ivaGiro, 3135000);
    // 1 exenta 34 por 900.000
    assert.strictEqual(v.exentoGiro, 900000);
    // Resumen 39: 185 boletas, neto 2.400.000, IVA 456.000
    assert.strictEqual(v.cantBoletas39, 185);
    assert.strictEqual(v.netoBoletas39, 2400000);
    assert.strictEqual(v.ivaBoletas39, 456000);
    // 1 NC 61 informada positiva: neto 500.000, IVA 95.000
    assert.strictEqual(v.cantNotasCredito, 1);
    assert.strictEqual(v.netoNotasCredito, 500000);
    assert.strictEqual(v.ivaNotasCredito, 95000);
});

caso('RCV Compras SII (;): separa giro (519/520), supermercado (761/762), activo fijo (524/525) y NC recibida (527/528)', () => {
    const csv = F29.ejemploRcvComprasCsv();
    const c = F29.parsearRcv(csv, 'compras');
    // Giro: 5.200.000 + 2.100.000 + 950.000 = 8.250.000; IVA = 988.000 + 399.000 + 180.500 = 1.567.500
    assert.strictEqual(c.cantFacturasGiro, 3);
    assert.strictEqual(c.netoGiro, 8250000);
    assert.strictEqual(c.ivaGiro, 1567500);
    // Supermercado: 1 doc, neto 180.000, IVA 34.200
    assert.strictEqual(c.cantSupermercado, 1);
    assert.strictEqual(c.ivaSupermercado, 34200);
    // Activo fijo: 1 doc, neto 1.600.000, IVA 304.000
    assert.strictEqual(c.cantActivoFijo, 1);
    assert.strictEqual(c.netoActivoFijo, 1600000);
    assert.strictEqual(c.ivaActivoFijo, 304000);
    // NC 61 recibida: 1 doc, neto 300.000, IVA 57.000
    assert.strictEqual(c.cantNotasCredito, 1);
    assert.strictEqual(c.ivaNotasCredito, 57000);
});

caso('F29 2026: codigos oficiales sin ceros a la izquierda, honorarios 15,25% y PPM ProPyme 0,125%', () => {
    const v = F29.parsearRcv(F29.ejemploRcvVentasCsv(), 'ventas');
    const c = F29.parsearRcv(F29.ejemploRcvComprasCsv(), 'compras');
    const f = F29.calcularF29({
        periodo: '2026-10',
        regimen: '14D3',
        ventas: v,
        compras: c,
        remanenteAnterior: 120000,
        impuestoUnico48: 84600,
        boletasHonorarios: [{ fecha: '2026-10-12', bruto: 1000000, retiene: 'empresa' }]
    });

    // Debitos: 502 (3.135.000) + boletas39 (456.000) - 510 (95.000) = 3.496.000
    assert.strictEqual(f.codigos[503], 3);
    assert.strictEqual(f.codigos[502], 3135000);
    assert.strictEqual(f.codigos[509], 1);
    assert.strictEqual(f.codigos[510], 95000);
    assert.strictEqual(f.codigos[538], 3496000);

    // Creditos: 520 (1.567.500) + 762 (34.200) + 525 (304.000) - 528 (57.000) + 504 (120.000) = 1.968.700
    assert.strictEqual(f.codigos[520], 1567500);
    assert.strictEqual(f.codigos[762], 34200);
    assert.strictEqual(f.codigos[525], 304000);
    assert.strictEqual(f.codigos[528], 57000);
    assert.strictEqual(f.codigos[504], 120000);
    assert.strictEqual(f.codigos[537], 1968700);

    // Determinacion IVA: 538 - 537 = 1.527.300 -> va a 89, y 77 es 0
    assert.strictEqual(f.codigos[89], 1527300);
    assert.strictEqual(f.codigos[77], 0);

    // Retencion honorarios 2026: 15,25% de 1.000.000 = 152.500 (no 145.000)
    assert.strictEqual(f.codigos[151], 152500);
    assert.strictEqual(f.codigos[48], 84600);

    // PPM 14 D3 <= 50.000 UF: base 563 = 16.500.000 + 900.000 + 2.400.000 - 500.000 = 19.300.000; tasa 0,125% -> 24.125
    assert.strictEqual(f.codigos[563], 19300000);
    assert.strictEqual(f.codigos[115], 0.125);
    assert.strictEqual(f.codigos[62], 24125);

    // Total a pagar cod. 91 = 1.527.300 + 84.600 + 152.500 + 24.125 = 1.788.525
    assert.strictEqual(f.codigos[91], 1788525);
});

caso('F29 con remanente (537 > 538): va a cod. 77 y JAMAS se suma al total a pagar cod. 91', () => {
    const v = F29.parsearRcv(F29.ejemploRcvVentasCsv(), 'ventas');
    const c = F29.parsearRcv(F29.ejemploRcvComprasCsv(), 'compras');
    const f = F29.calcularF29({
        periodo: '2026-10',
        regimen: '14D8', // ProPyme Transparente -> 0,2%
        ventas: v,
        compras: c,
        remanenteAnterior: 3000000,
        impuestoUnico48: 50000,
        honorariosBruto: 400000
    });

    // Creditos = 1.848.700 + 3.000.000 = 4.848.700 > Debitos 3.496.000 -> Remanente 77 = 1.352.700, IVA 89 = 0
    assert.strictEqual(f.codigos[89], 0);
    assert.strictEqual(f.codigos[77], 1352700);
    assert.strictEqual(f.codigos[115], 0.2);
    assert.strictEqual(f.codigos[62], Math.round(19300000 * 0.002)); // 38.600
    assert.strictEqual(f.codigos[151], Math.round(400000 * 0.1525)); // 61.000
    assert.strictEqual(f.codigos[91], 0 + 50000 + 61000 + 38600);
});

caso('Libro Diario, Mayor y Balance 8 Columnas cuadran al peso con utilidad y pasivo F29 igual a cod. 91', () => {
    const mes = Object.assign({}, P.vigenciaDe('2026-10'), { uf: 41247.63, utm: 72151 });
    const liqRes = E.calcular({
        periodo: '2026-10', tasaMutual: 0.93,
        trabajador: { sueldoBase: 2600000, afp: 'Habitat', salud: 'fonasa', isaprePlanUF: 0, isapreNombre: '', contrato: 'indefinido', jornadaHoras: 42, fechaIngreso: '2021-03-01', colacion: 60000, movilizacion: 40000 },
        mes: { diasTrabajados: 30, horasExtra: 0, comisiones: 0, gratificacion: 'legal', gratificacionMonto: 0, asignacionFamiliar: 0, otrosNoImponibles: [], otrosDescuentos: [], cuotaSindical: 0, creditoCCAF: 0 }
    }, mes);
    const loteLiq = [{
        record: { rut: '16.543.210-K', nombre: 'Andres Munoz', sueldo: 2600000, dias: 30, afp: 'Habitat', salud: 'fonasa', contrato: 'indefinido', jornada: 42, ingreso: '2021-03-01', colacion: 60000, movilizacion: 40000 },
        detalle: liqRes, error: '', liquido: liqRes.liquido
    }];
    const nomina = C.resumenNominaDesdeResultados(loteLiq, A);
    assert.ok(nomina && nomina.totalDebe === nomina.totalHaber);

    const v = F29.parsearRcv(F29.ejemploRcvVentasCsv(), 'ventas');
    const c = F29.parsearRcv(F29.ejemploRcvComprasCsv(), 'compras');
    const f29 = F29.calcularF29({
        periodo: '2026-10',
        regimen: '14D3',
        ventas: v,
        compras: c,
        remanenteAnterior: 120000,
        impuestoUnico48: nomina.impuesto48,
        boletasHonorarios: [{ fecha: '2026-10-15', bruto: 800000, retiene: 'empresa' }]
    });

    const gen = C.generarAsientos({
        periodo: '2026-10',
        ventas: v,
        compras: c,
        f29: f29,
        nomina: nomina,
        tesoreria: { saldoInicialBanco: 8000000, pctVentasCobradas: 80, pctComprasPagadas: 75, activoFijoPagado: true, sueldosPagados: true, honorariosPagados: true },
        manuales: [{ fecha: '2026-10-28', glosa: 'Multa fiscal tesoreria pagada desde banco', lineas: [{ cuenta: '42095', debe: 45000, haber: 0 }, { cuenta: '11010', debe: 0, haber: 45000 }] }]
    });

    assert.ok(gen.asientos.every(a => a.cuadra), 'Todos los asientos deben cuadrar');
    const mayor = C.calcularMayor(gen.asientos);
    const bal = C.calcularBalance8Columnas(mayor);
    assert.strictEqual(bal.cuadra, true, 'El balance de 8 columnas debe cuadrar');
    assert.ok(bal.resultado > 0, 'Escenario con utilidad del ejercicio');

    // Cuenta 21070 Impuestos F29 por pagar debe ser exactamente igual a F29 cod. 91
    const cta21070 = bal.filas.find(x => x.codigo === '21070');
    assert.strictEqual(cta21070.pasivo, f29.codigos[91]);

    // RLI ProPyme 14 D3: deduce activo fijo pagado al 100%, trabaja sobre percibido/pagado neto y agrega multa art. 21/31
    const rli = C.calcularRliProPyme(bal, gen.metricasFlujo, {});
    assert.strictEqual(rli.activoFijoPagadoNeto, 1600000);
    assert.strictEqual(rli.multasGastosRechazados, 45000);
    assert.notStrictEqual(rli.baseImponible, bal.resultado, 'RLI 14 D3 percibida/pagada difiere del resultado devengado');

    // Estado de resultados concilia exactamente con el resultado del balance
    const pyf = C.calcularEstadoResultadosYFlujo(bal, gen.metricasFlujo, f29);
    assert.strictEqual(pyf.pnl.resultadoAntesImpuesto, bal.resultado);
});

caso('Balance de 8 Columnas tambien cuadra cuando el ejercicio arroja perdida', () => {
    const gen = C.generarAsientos({
        periodo: '2026-10',
        tesoreria: { saldoInicialBanco: 5000000 },
        manuales: [{ fecha: '2026-10-31', glosa: 'Gasto arriendo inicial sin ventas', lineas: [{ cuenta: '42040', debe: 1200000, haber: 0 }, { cuenta: '11010', debe: 0, haber: 1200000 }] }]
    });
    const bal = C.calcularBalance8Columnas(C.calcularMayor(gen.asientos));
    assert.strictEqual(bal.cuadra, true);
    assert.strictEqual(bal.resultado, -1200000);
    assert.strictEqual(bal.filaResultado.perdidaEjercicio, 1200000);
    assert.strictEqual(bal.sumasIguales.activo, bal.sumasIguales.pasivo);
    assert.strictEqual(bal.sumasIguales.perdida, bal.sumasIguales.ganancia);
});

console.log(ok + ' pruebas correctas en Suite Contadores');
