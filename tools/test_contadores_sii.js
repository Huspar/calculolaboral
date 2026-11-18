/* Pruebas de normalización SII Gateway -> motores F29/BHE/Contabilidad: node tools/test_contadores_sii.js */
'use strict';
const assert = require('assert');
const Sii = require('../js/contadores_sii');
const F29 = require('../js/contadores_f29');
const Imp = require('../js/contadores_importadores');
const Cont = require('../js/contadores_contabilidad');

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message)); process.exitCode = 1; }
}

caso('normaliza períodos entre YYYY-MM y YYYYMM', () => {
    assert.strictEqual(Sii.periodoGateway('2026-11'), '202611');
    assert.strictEqual(Sii.periodoGateway('202611'), '202611');
    assert.strictEqual(Sii.periodoUi('202611'), '2026-11');
    assert.strictEqual(Sii.periodoGateway('invalido'), '');
});

caso('normaliza RCV de SII Gateway, separa PENDIENTE/RECLAMADO y alimenta F29 y Balance 8 Columnas', () => {
    const respVentas = {
        ok: true,
        rcv: {
            period: '202611',
            totalCount: 4,
            documents: [
                { tipoDoc: 33, folio: 1001, rutContraparte: '76.111.222-3', razonSocialContraparte: 'Cliente Uno SpA', fechaEmision: '2026-11-05', operacion: 'VENTA', estadoContab: 'REGISTRO', tipoTransaccion: '1', montoExento: 0, montoNeto: 2000000, montoIvaRecuperable: 380000, montoTotal: 2380000 },
                { tipoDoc: 39, folio: 42, rutContraparte: '', razonSocialContraparte: 'Resumen boletas', fechaEmision: '2026-11-30', operacion: 'VENTA', estadoContab: 'REGISTRO', tipoTransaccion: '1', montoExento: 0, montoNeto: 500000, montoIvaRecuperable: 95000, montoTotal: 595000 },
                { tipoDoc: 61, folio: 12, rutContraparte: '76.111.222-3', razonSocialContraparte: 'Cliente Uno SpA', fechaEmision: '2026-11-18', operacion: 'VENTA', estadoContab: 'REGISTRO', tipoTransaccion: '1', montoExento: 0, montoNeto: 100000, montoIvaRecuperable: 19000, montoTotal: 119000 }
            ]
        }
    };
    const respCompras = {
        ok: true,
        rcv: {
            period: '202611',
            totalCount: 4,
            documents: [
                { tipoDoc: 33, folio: 501, rutContraparte: '96.510.220-4', razonSocialContraparte: 'Proveedor Giro SA', fechaEmision: '2026-11-03', operacion: 'COMPRA', estadoContab: 'REGISTRO', tipoTransaccion: '1', montoExento: 0, montoNeto: 1000000, montoIvaRecuperable: 190000, montoTotal: 1190000 },
                { tipoDoc: 33, folio: 88, rutContraparte: '81.201.000-K', razonSocialContraparte: 'Supermercados del Sur', fechaEmision: '2026-11-10', operacion: 'COMPRA', estadoContab: 'REGISTRO', tipoTransaccion: '2', montoExento: 0, montoNeto: 100000, montoIvaRecuperable: 19000, montoTotal: 119000 },
                { tipoDoc: 33, folio: 90, rutContraparte: '77.880.120-5', razonSocialContraparte: 'Maquinaria SpA', fechaEmision: '2026-11-12', operacion: 'COMPRA', estadoContab: 'REGISTRO', tipoTransaccion: '4', montoExento: 0, montoNetoActivoFijo: 500000, montoIvaActivoFijo: 95000, montoTotal: 595000 },
                { tipoDoc: 33, folio: 777, rutContraparte: '76.999.888-1', razonSocialContraparte: 'Proveedor Pendiente', fechaEmision: '2026-11-28', operacion: 'COMPRA', estadoContab: 'PENDIENTE', tipoTransaccion: '1', montoExento: 0, montoNeto: 400000, montoIvaRecuperable: 76000, montoTotal: 476000 }
            ]
        }
    };

    const vNorm = Sii.normalizarRcvDesdeGateway(respVentas, 'ventas');
    const cNorm = Sii.normalizarRcvDesdeGateway(respCompras, 'compras');
    assert.strictEqual(vNorm.rows.length, 3);
    assert.strictEqual(cNorm.rows.length, 3);
    assert.strictEqual(cNorm.pendientesCount, 1);

    const vParsed = F29.parsearRcv(vNorm.rows, 'ventas');
    const cParsed = F29.parsearRcv(cNorm.rows, 'compras');
    assert.strictEqual(vParsed.netoGiro, 2000000);
    assert.strictEqual(vParsed.cantBoletas39, 42);
    assert.strictEqual(vParsed.ivaNotasCredito, 19000);
    assert.strictEqual(cParsed.ivaGiro, 190000);
    assert.strictEqual(cParsed.ivaSupermercado, 19000);
    assert.strictEqual(cParsed.ivaActivoFijo, 95000);

    const f29 = F29.calcularF29({ periodo: '2026-11', regimen: '14D3', ventas: vParsed, compras: cParsed });
    // Debitos: 380.000 + 95.000 - 19.000 = 456.000; Creditos: 190.000 + 19.000 + 95.000 = 304.000
    assert.strictEqual(f29.codigos[538], 456000);
    assert.strictEqual(f29.codigos[537], 304000);
    assert.strictEqual(f29.codigos[89], 152000);

    const gen = Cont.generarAsientos({ periodo: '2026-11', ventas: vParsed, compras: cParsed, f29 });
    const bal = Cont.calcularBalance8Columnas(Cont.calcularMayor(gen.asientos));
    assert.strictEqual(bal.cuadra, true);
});

caso('normaliza BHE de SII Gateway hacia CLImportadores.parsearBheSii', () => {
    const respBhe = {
        ok: true,
        bhe: {
            period: '202611',
            items: [
                { direction: 'RECIBIDA', numeroBoleta: 10, fechaEmision: '2026-11-04', rutEmisor: '15.234.567-4', nombreEmisor: 'Ana Soto', estado: 'VIGENTE', montoBruto: 1000000, montoRetencion: 152500, montoLiquido: 847500 },
                { direction: 'RECIBIDA', numeroBoleta: 11, fechaEmision: '2026-11-06', rutEmisor: '15.234.567-4', nombreEmisor: 'Ana Soto', estado: 'ANULADA', montoBruto: 200000, montoRetencion: 30500, montoLiquido: 169500 }
            ]
        }
    };
    const norm = Sii.normalizarBheDesdeGateway(respBhe, { direction: 'RECIBIDA' });
    const imp = Imp.parsearBheSii(norm.items, { periodo: '2026-11' });
    assert.strictEqual(imp.ok, true);
    assert.strictEqual(imp.boletas.length, 1);
    assert.strictEqual(imp.anuladasOmitidas, 1);
    assert.strictEqual(imp.codigo151, 152500);
});

caso('normaliza y compara resumen F29 oficial con cálculo local', () => {
    const respF29 = {
        ok: true,
        synced: true,
        summary: {
            period: '202611',
            folioDeclaracion: '99887766',
            estado: 'DECLARADO',
            fechaPresentacion: '2026-12-18',
            debitoFiscalIva: 456000,
            creditoFiscalIva: 304000,
            remanenteAnterior: 0,
            remanenteSiguiente: 0,
            ppmNetoDeterminado: 3000,
            retencionHonorarios: 152500,
            impuestoUnicoTrabajadores: 0,
            totalAPagar: 307500,
            codigosJson: { '538': 456000, '537': 304000, '89': 152000, '62': 3000, '151': 152500, '91': 307500 }
        }
    };
    const f29Sii = Sii.normalizarF29DesdeGateway(respF29);
    assert.strictEqual(f29Sii.synced, true);
    assert.strictEqual(f29Sii.codigos['91'], 307500);

    const cmpIgual = Sii.compararF29ConSii({ codigos: { 538: 456000, 537: 304000, 89: 152000, 77: 0, 48: 0, 151: 152500, 62: 3000, 91: 307500 } }, f29Sii);
    assert.strictEqual(cmpIgual.comparable, true);
    assert.strictEqual(cmpIgual.coincideTotal, true);

    const cmpDif = Sii.compararF29ConSii({ codigos: { 538: 456000, 537: 304000, 89: 152000, 77: 0, 48: 0, 151: 0, 62: 3000, 91: 155000 } }, f29Sii);
    assert.strictEqual(cmpDif.coincideTotal, false);
    assert.strictEqual(cmpDif.diferencias.length, 2);
});

caso('podarRespaldoParaLimite reduce JSON bajo el tope de 2 MB sin perder marca siiSyncAt', () => {
    const filaGrande = Array.from({ length: 1200 }, (_, i) => ({ tipo_doc: 33, folio: String(i), neto: 10000 }));
    const obj = {
        'cliente::2026-09': { siiSyncAt: '2026-10-01T03:00:00Z', ventasRows: filaGrande, comprasRows: filaGrande, ventasCsv: 'a;b\n'.repeat(2000) },
        'cliente::2026-11': { siiSyncAt: '2026-11-18T03:00:00Z', ventasRows: filaGrande.slice(0, 50), comprasRows: null }
    };
    const podado = Sii.podarRespaldoParaLimite(obj, 40000);
    assert.ok(JSON.stringify(podado).length <= 40000);
    assert.strictEqual(podado['cliente::2026-09'].siiSyncAt, '2026-10-01T03:00:00Z');
    assert.strictEqual(podado['cliente::2026-09'].ventasRows, null);
    assert.strictEqual(podado['cliente::2026-11'].ventasRows.length, 50);
});

caso('tienda de vínculos guarda solo metadatos y nunca secretos', () => {
    const mem = {};
    const store = {
        getItem: k => mem[k] || null,
        setItem: (k, v) => { mem[k] = v; }
    };
    const t = Sii.crearTiendaVinculos(store);
    t.guardar('Panadería San Isidro SpA', {
        companyId: 'cmp_1',
        rut: '76543210-3',
        hasCredentials: true,
        credentialKind: 'CLAVE_TRIBUTARIA',
        claveTributaria: 'NO_DEBE_GUARDARSE'
    });
    const leido = t.obtener('panadería san isidro spa');
    assert.strictEqual(leido.companyId, 'cmp_1');
    assert.strictEqual(leido.rut, '76.543.210-3');
    assert.ok(!JSON.stringify(mem).includes('NO_DEBE_GUARDARSE'));
});

caso('normalizarPendientesDesdeGateway calcula plazo legal de 8 días corridos desde recepción SII', () => {
    const pendientes = Sii.normalizarPendientesDesdeGateway({
        rcv: {
            period: '202611',
            documents: [
                { id: 'd1', operacion: 'COMPRA', estadoContab: 'PENDIENTE', tipoDoc: 33, folio: 77, rutContraparte: '76.111.222-3', razonSocialContraparte: 'Proveedor Urgente', fechaEmision: '2026-11-10', fechaRecepcion: '2026-11-12', montoNeto: 100000, montoIvaRecuperable: 19000, montoTotal: 119000 },
                { id: 'd2', operacion: 'COMPRA', estadoContab: 'PENDIENTE', tipoDoc: 33, folio: 78, rutContraparte: '76.333.444-5', razonSocialContraparte: 'Proveedor Nuevo', fechaEmision: '2026-11-16', fechaRecepcion: '2026-11-17', montoNeto: 200000, montoIvaRecuperable: 38000, montoTotal: 238000 },
                { id: 'd3', operacion: 'VENTA', estadoContab: 'PENDIENTE', tipoDoc: 33, folio: 99, montoTotal: 50000 }
            ]
        }
    }, '2026-11-18');
    assert.strictEqual(pendientes.length, 2, 'Solo compras PENDIENTE');
    assert.strictEqual(pendientes[0].folio, '77');
    assert.strictEqual(pendientes[0].diasRestantes, 2);
    assert.strictEqual(pendientes[0].estadoPlazo, 'critico');
    assert.strictEqual(pendientes[1].diasRestantes, 7);
    assert.strictEqual(pendientes[1].estadoPlazo, 'seguro');
});

console.log(process.exitCode ? 'HAY FALLAS' : (ok + ' pruebas correctas en Contadores SII'));
