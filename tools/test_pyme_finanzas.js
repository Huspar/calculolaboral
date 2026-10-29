// Pruebas unitarias de Finanzas y Puente Contable del Asistente Pyme (/app): node tools/test_pyme_finanzas.js
'use strict';

const assert = require('assert');
const FIN = require('../js/pyme_finanzas');

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

caso('parsearCartolaCsv lee cartolas bancarias chilenas separadas por punto y coma o coma con formatos de fecha DD/MM/AAAA e ISO', () => {
    const csv = [
        'Cartola Cuenta Corriente Empresa;;;;',
        'Fecha;Descripción Movimiento;Cargos ($);Abonos ($);Saldo Contable',
        '12/10/2026;ABONO TEF MINIMARKET ARAUCANIA FACT 1108;0;$535.500;$5.530.700',
        '14-10-2026;CARGO PAC MOLINOS CUNCO 46088;844.900;;4.685.800'
    ].join('\r\n');

    const res = FIN.parsearCartolaCsv(csv, '2026-10');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.movimientos.length, 2);
    assert.deepStrictEqual(
        [res.movimientos[0].fecha, res.movimientos[0].tipo, res.movimientos[0].monto],
        ['2026-10-12', 'abono', 535500]
    );
    assert.deepStrictEqual(
        [res.movimientos[1].fecha, res.movimientos[1].tipo, res.movimientos[1].monto],
        ['2026-10-14', 'cargo', 844900]
    );
    assert.strictEqual(res.ultimoSaldo, 4685800);
});

caso('importarRcvACobranzas e importarRcvAPagos transforman el CSV del RCV SII en cuentas por cobrar y por pagar omitiendo resúmenes y NC', () => {
    const rcvVentas = [
        'Nro;Tipo Doc;Tipo Venta;RUT Cliente;Razon Social;Folio;Fecha Docto;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Total',
        '1;33;Del Giro;76112340-8;Cafeteria El Rincon Ltda;1102;05/10/2026;0;630000;119700;749700',
        '2;61;Del Giro;76112340-8;Cafeteria El Rincon Ltda;55;07/10/2026;0;50000;9500;59500',
        '3;39;Del Giro;66666666-6;Resumen Boletas;12;08/10/2026;0;100000;19000;119000'
    ].join('\n');

    const cxc = FIN.importarRcvACobranzas(rcvVentas, { periodo: '2026-10', plazoDias: 30 });
    assert.strictEqual(cxc.ok, true);
    assert.strictEqual(cxc.items.length, 1);
    assert.strictEqual(cxc.items[0].rut, '76.112.340-8');
    assert.strictEqual(cxc.items[0].monto, 749700);
    assert.strictEqual(cxc.items[0].vencimiento, '2026-11-04');

    const rcvCompras = [
        'Nro;Tipo Doc;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Total',
        '1;33;Del Giro;96540110-K;Molinos Cunco S.A.;46088;02/10/2026;0;710000;134900;844900'
    ].join('\n');
    const cxp = FIN.importarRcvAPagos(rcvCompras, {
        periodo: '2026-10',
        cuentasProveedores: { '96.540.110-K': { banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '0018945002' } }
    });
    assert.strictEqual(cxp.ok, true);
    assert.strictEqual(cxp.items.length, 1);
    assert.strictEqual(cxp.items[0].banco, 'Banco de Chile');
    assert.strictEqual(cxp.items[0].monto, 844900);
});

caso('estadoVencimiento clasifica correctamente facturas vencidas, por vencer en 7 dias, al dia y pagadas', () => {
    assert.strictEqual(FIN.estadoVencimiento({ vencimiento: '2026-10-10', pagada: false }, '2026-10-14').codigo, 'vencida');
    assert.strictEqual(FIN.estadoVencimiento({ vencimiento: '2026-10-18', pagada: false }, '2026-10-14').codigo, 'por_vencer');
    assert.strictEqual(FIN.estadoVencimiento({ vencimiento: '2026-10-29', pagada: false }, '2026-10-14').codigo, 'al_dia');
    assert.strictEqual(FIN.estadoVencimiento({ vencimiento: '2026-10-01', pagada: true }, '2026-10-14').codigo, 'pagada');
});

caso('mensajeCobranza redacta recordatorio formal con monto, folio y cuenta bancaria sin emojis ni rayas largas', () => {
    const txt = FIN.mensajeCobranza(
        { razonSocial: 'Minimarket Araucanía SpA', folio: '1108', monto: 535500, vencimiento: '2026-10-17' },
        { razonSocial: 'Panadería Los Aromos SpA', rut: '76.543.210-3' },
        { banco: 'BancoEstado', tipoCuenta: 'corriente', numeroCuenta: '6250014892', correo: 'pagos@losaromos.cl' }
    );
    assert.ok(txt.includes('Factura N° 1108'));
    assert.ok(txt.includes('$535.500'));
    assert.ok(txt.includes('BancoEstado'));
    assert.ok(!txt.includes('—'), 'no debe usar em-dash');
});

caso('generarNominaProveedores valida datos bancarios y exporta CSV de transferencias masivas', () => {
    const res = FIN.generarNominaProveedores([
        { rut: '96.540.110-K', razonSocial: 'Molinos Cunco S.A.', folio: '46088', monto: 844900, banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '0018945002', pagada: false },
        { rut: '88.272.600-2', razonSocial: 'Envases BioBío SpA', folio: '1820', monto: 297500, banco: '', tipoCuenta: '', numeroCuenta: '', pagada: false }
    ], { periodoNombre: 'octubre 2026' });

    assert.strictEqual(res.incluidos, 1);
    assert.strictEqual(res.total, 844900);
    assert.strictEqual(res.omitidos.length, 1);
    assert.ok(res.texto.includes('Molinos Cunco S.A.;Banco de Chile;Cuenta corriente;0018945002;844900'));
});

caso('sugerirConciliacion detecta coincidencias de 1 clic para facturas por cobrar, proveedores, Previred y sueldos', () => {
    const movs = [
        { id: 'm1', fecha: '2026-10-13', glosa: 'ABONO TEF MINIMARKET ARAUCANIA 1108', tipo: 'abono', monto: 535500, conciliadoCon: null },
        { id: 'm2', fecha: '2026-10-13', glosa: 'PAGO COTIZACIONES PREVIRED OCT', tipo: 'cargo', monto: 540000, conciliadoCon: null }
    ];
    const cruces = FIN.sugerirConciliacion(movs, {
        cobranzas: [{ id: 'c1', rut: '78.320.410-5', razonSocial: 'Minimarket Araucanía SpA', folio: '1108', vencimiento: '2026-10-17', monto: 535500, pagada: false }],
        pagos: [],
        obligacionesMes: { sueldosLiquidos: 1850000, previred: 540000, f29Total: 472150 }
    });

    assert.ok(cruces[0].mejorMatch);
    assert.strictEqual(cruces[0].mejorMatch.tipoDestino, 'cxc');
    assert.strictEqual(cruces[0].mejorMatch.destinoId, 'c1');

    assert.ok(cruces[1].mejorMatch);
    assert.strictEqual(cruces[1].mejorMatch.tipoDestino, 'previred');
});

caso('calcularFlujoCaja proyecta fin de mes y ordena compromisos de sueldos, Previred (dia 13), F29 (dia 20) y proveedores', () => {
    const flujo = FIN.calcularFlujoCaja({
        periodo: '2026-10',
        saldoBancoHoy: 4000000,
        cobranzas: [{ id: 'c1', monto: 1000000, pagada: false }],
        pagos: [{ id: 'p1', razonSocial: 'Molinos Cunco', folio: '46088', vencimiento: '2026-10-20', monto: 800000, pagada: false }],
        obligacionesMes: { sueldosLiquidos: 1800000, previred: 500000, f29Total: 400000 }
    });

    assert.strictEqual(flujo.porEntrarMes, 1000000);
    assert.strictEqual(flujo.porSalirMes, 800000 + 1800000 + 500000 + 400000);
    assert.strictEqual(flujo.proyeccionFinMes, 4000000 + 1000000 - 3500000);
    assert.strictEqual(flujo.compromisos.length, 4);
    assert.strictEqual(flujo.compromisos[0].fecha, '2026-10-20');
});

caso('resolverPuenteContable sincroniza estado CERRADO_TRIBUTARIO y F29 desde Suite Contadores cuando coincide empresa y periodo', () => {
    const suiteMock = {
        'panadería los aromos spa::2026-09': {
            periodo: '2026-09',
            regimen: '14D3',
            cerradoTributario: true,
            fechaCierre: '2026-10-18',
            ventasCsv: 'Nro;Tipo Doc;Tipo Venta;RUT Cliente;Razon Social;Folio;Fecha Docto;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Total\n1;33;Del Giro;76112340-8;Cliente;10;10/09/2026;0;1000000;190000;1190000',
            comprasCsv: 'Nro;Tipo Doc;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Total\n1;33;Del Giro;96540110-K;Prov;20;12/09/2026;0;400000;76000;476000',
            honorariosBruto: 200000
        }
    };
    const puente = FIN.resolverPuenteContable(
        { razonSocial: 'Panadería Los Aromos SpA', rut: '76.543.210-3' },
        '2026-09',
        suiteMock,
        {}
    );
    assert.strictEqual(puente.conectadoSuite, true);
    assert.strictEqual(puente.cerradoTributario, true);
    assert.strictEqual(puente.fechaCierre, '2026-10-18');
    assert.strictEqual(puente.f29Resumen.ivaDebito, 190000);
    assert.strictEqual(puente.f29Resumen.ivaCredito, 76000);
    assert.strictEqual(puente.f29Resumen.retencion151, Math.round(200000 * 0.1525));
    assert.ok(puente.f29Resumen.totalPagar91 > 140000);
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
