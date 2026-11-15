'use strict';

var assert = require('assert');
var path = require('path');

var F29 = require(path.join(__dirname, '..', 'js', 'contadores_f29.js'));
var Pro = require(path.join(__dirname, '..', 'js', 'contadores_asistente_pro.js'));

function hallazgoPorId(audit, id) {
    return (audit.hallazgos || []).find(function (h) { return h.id === id; });
}

// 1. Escenario limpio -> Estado VERDE (sin alertas)
var ventasLimpias = F29.parsearRcv([
    { tipo_doc: 33, folio: 101, rut_contraparte: '76.111.222-3', razon_social: 'Cliente A', monto_neto: 5000000, monto_iva: 950000 }
], 'ventas');
var comprasLimpias = F29.parsearRcv([
    { tipo_doc: 33, folio: 55, rut_contraparte: '77.222.333-4', razon_social: 'Proveedor B', monto_neto: 2000000, monto_iva: 380000 }
], 'compras');
var f29Limpio = F29.calcularF29({
    periodo: '2026-11',
    regimen: '14D3',
    ventas: ventasLimpias,
    compras: comprasLimpias,
    remanenteAnterior: 0,
    impuestoUnico48: 42000,
    honorariosBruto: 1000000
});
var auditVerde = Pro.auditarF29PreSii({
    periodo: '2026-11',
    f29: f29Limpio,
    ventas: ventasLimpias,
    compras: comprasLimpias,
    nomina: { impuesto48: 42000, totalDebe: 3200000 },
    estado: { regimen: '14D3', honorariosBruto: 1000000 }
});

assert.strictEqual(auditVerde.estadoGeneral, 'verde', 'Escenario limpio debe ser verde');
assert.strictEqual(auditVerde.conteo.rojo, 0);
assert.strictEqual(auditVerde.conteo.amarillo, 0);
assert.ok(auditVerde.conteo.verde >= 6);

// 2. Supermercados: NO debe mencionar "tope de 5 UTA" ni "límite de 5 UTA", sí Art. 31 LIR y cód. 761/762
var comprasSup = F29.parsearRcv([
    { tipo_doc: 33, folio: 1, rut_contraparte: '76.123.456-7', razon_social: 'Supermercados Jumbo S.A.', tipo_transaccion: 'supermercado', monto_neto: 500000, monto_iva: 95000 },
    { tipo_doc: 33, folio: 2, rut_contraparte: '77.222.333-4', razon_social: 'Proveedor Industrial Ltda', monto_neto: 2000000, monto_iva: 380000 }
], 'compras');
var f29Sup = F29.calcularF29({ periodo: '2026-11', regimen: '14D3', ventas: ventasLimpias, compras: comprasSup });
var auditSup = Pro.auditarF29PreSii({ periodo: '2026-11', f29: f29Sup, ventas: ventasLimpias, compras: comprasSup });
var hSup = hallazgoPorId(auditSup, 'supermercado');
assert.strictEqual(hSup.nivel, 'amarillo');
assert.ok(/Ley 21\.210|no existe tope de 5 UTA/i.test(hSup.detalle), 'Debe aclarar derogación tope 5 UTA');
assert.ok(!/límite legal de 5 UTA|exceso de 5 UTA/i.test(hSup.detalle), 'No debe afirmar que existe límite 5 UTA');
assert.ok(/761\/762/.test(hSup.codigoSii));

// 3. Supermercados peso >=45% + descuadre IUSC nómina + 14A con PPM 0% + FM01 remanente -> ROJO
var comprasSupAlto = F29.parsearRcv([
    { tipo_doc: 33, folio: 10, rut_contraparte: '76.123.456-7', razon_social: 'Lider Hiper', tipo_transaccion: '2', monto_neto: 1000000, monto_iva: 190000, monto_iva_no_rec: 19000 }
], 'compras');
var f29Rojo = F29.calcularF29({
    periodo: '2026-11',
    regimen: '14A',
    ventas: ventasLimpias,
    compras: comprasSupAlto,
    remanenteAnterior: 120000,
    impuestoUnico48: 10000,
    honorariosBruto: 500000
});
// Force cód. 151 = 0 to validate zero retention error check
f29Rojo.codigos[151] = 0;

var auditRojo = Pro.auditarF29PreSii({
    periodo: '2026-11',
    f29: f29Rojo,
    ventas: ventasLimpias,
    compras: comprasSupAlto,
    nomina: { impuesto48: 55000, totalDebe: 2500000 },
    estado: { regimen: '14A', honorariosBruto: 500000 },
    remanente77MesAnterior: 100000,
    utmMesPresentacionAnterior: 66000,
    utmMesPresentacionActual: 66660 // esperado ~ 101000 vs 120000
});
assert.strictEqual(auditRojo.estadoGeneral, 'rojo');
assert.strictEqual(hallazgoPorId(auditRojo, 'supermercado').nivel, 'rojo');
assert.strictEqual(hallazgoPorId(auditRojo, 'iva_no_rec').nivel, 'amarillo');
assert.strictEqual(hallazgoPorId(auditRojo, 'cuadratura_bhe').nivel, 'rojo');
assert.strictEqual(hallazgoPorId(auditRojo, 'cuadratura_iusc').nivel, 'rojo');
assert.strictEqual(hallazgoPorId(auditRojo, 'remanente_utm').nivel, 'rojo');
assert.strictEqual(hallazgoPorId(auditRojo, 'coherencia_ppm').nivel, 'rojo');

// 4. Remanente exacto UTM -> verde
var auditRemOk = Pro.auditarF29PreSii({
    periodo: '2026-11',
    f29: Object.assign({}, f29Limpio, { codigos: Object.assign({}, f29Limpio.codigos, { 504: 101000 }) }),
    ventas: ventasLimpias,
    compras: comprasLimpias,
    nomina: { impuesto48: 42000, totalDebe: 3200000 },
    estado: { regimen: '14D3', honorariosBruto: 1000000 },
    remanente77MesAnterior: 100000,
    utmMesPresentacionAnterior: 70000,
    utmMesPresentacionActual: 70700
});
assert.strictEqual(hallazgoPorId(auditRemOk, 'remanente_utm').nivel, 'verde');

// 5. WhatsApp resumen ejecutivo: cifras reales, sin jerga vacia, firma estudio
var wa = Pro.generarResumenWhatsappCliente({
    cliente: 'Panadería San Isidro SpA',
    periodo: '2026-11',
    regimenNombre: 'ProPyme General (14 D3)',
    f29: f29Limpio,
    pnl: { ingresosGiro: 5000000, resultadoAntesImpuesto: 1450000 },
    flujo: { saldoDisponibleBanco: 3100000, compromisoPreviredDia13: 540000, cajaProyectadaPostImpuestos: 1900000 },
    auditoria: auditVerde,
    estudio: { estudio: 'Asesorías Pérez Ltda.', contador: 'Carolina Pérez' }
});
assert.ok(wa.indexOf('Panadería San Isidro SpA') >= 0);
assert.ok(wa.indexOf('Noviembre 2026') >= 0);
assert.ok(wa.indexOf('Total F29 a pagar (cód. 91)') >= 0);
assert.ok(wa.indexOf('Asesorías Pérez Ltda.') >= 0);
assert.ok(wa.indexOf('OK, sin observaciones') >= 0);

// 6. TOP 2 Activo Fijo 14 D3 (imperativa pagado nuevo/usado, terreno $0, impago $0)
var af14d3 = Pro.calcularActivoFijoTributario([
    { descripcion: 'Horno industrial', valorNetoPagado: 1600000, pagado: true, esUsado: false },
    { descripcion: 'Furgón usado', valorNetoPagado: 4500000, pagado: true, esUsado: true },
    { descripcion: 'Sitio industrial', valorNetoPagado: 20000000, pagado: true, esTerreno: true },
    { descripcion: 'Maquinaria pendiente pago', valorNetoPagado: 2000000, pagado: false }
], { regimen: '14D3' });
assert.strictEqual(af14d3.totalBaseDepreciable, 8100000);
assert.strictEqual(af14d3.totalDepreciacionTributaria, 6100000);
assert.strictEqual(af14d3.items[2].depreciacionTributaria, 0, 'Terreno no se deprecia');
assert.strictEqual(af14d3.items[3].depreciacionTributaria, 0, 'Impago no rebaja en ProPyme');

// 7. TOP 2 Activo Fijo 14 A: acelerada 1/3 piso entero + DDAN solo para bien nuevo >=3 años
var af14a = Pro.calcularActivoFijoTributario([
    { descripcion: 'Máquina nueva 10 años', valorNetoPagado: 9000000, pagado: true, esUsado: false, vidaUtilNormalAnios: 10, mesesUsoEjercicio: 12, modalidad14A: 'acelerada_1_3' },
    { descripcion: 'Camión usado', valorNetoPagado: 6000000, pagado: true, esUsado: true, vidaUtilNormalAnios: 6, mesesUsoEjercicio: 12, modalidad14A: 'acelerada_1_3' }
], { regimen: '14A', factorIpc: 1.0 });
assert.strictEqual(af14a.items[0].vidaAplicada, 3, '10/3 -> floor = 3 años');
assert.strictEqual(af14a.items[0].depreciacionNormal, 900000);
assert.strictEqual(af14a.items[0].depreciacionTributaria, 3000000);
assert.strictEqual(af14a.items[0].diferenciaDdan, 2100000);
assert.strictEqual(af14a.items[1].depreciacionTributaria, 1000000, 'Usado cae a normal en 14A');

// 8. TOP 3 Conciliación con reglas + facturas + Aging
var conc = Pro.conciliarCartolaConReglas([
    { id: 'M1', fecha: '2026-11-10', glosa: 'Abono Transbank Ventas', tipo: 'abono', monto: 456000 },
    { id: 'M2', fecha: '2026-11-12', glosa: 'Pago Previred Noviembre', tipo: 'cargo', monto: 540000 },
    { id: 'M3', fecha: '2026-11-15', glosa: 'TEF Cliente A', tipo: 'abono', monto: 5950000 },
    { id: 'M4', fecha: '2026-11-18', glosa: 'Giro sin identificar', tipo: 'cargo', monto: 85000 }
], {
    ventas: ventasLimpias,
    compras: comprasLimpias,
    reglas: [{ patron: 'giro sin identificar', tipo: 'cargo', cuenta: '42040', motivo: 'Caja menor' }]
});
assert.strictEqual(conc.resumen.totalMovimientos, 4);
assert.strictEqual(conc.resumen.porFactura, 1);
assert.strictEqual(conc.resumen.porRegla, 3);
assert.strictEqual(conc.resumen.pctConciliado, 100);

var aging = Pro.calcularAgingDocumentos(
    { documentos: [{ tipoDoc: 33, folio: 1, fecha: '2026-09-01', total: 1000000 }, { tipoDoc: 33, folio: 2, fecha: '2026-11-15', total: 500000 }] },
    comprasLimpias,
    '2026-11',
    { pctVentasCobradas: 50, pctComprasPagadas: 60 }
);
assert.ok(aging.cxc.buckets.dias_mas_60 === 500000, 'Factura sept debe quedar en +60 dias');
assert.ok(aging.cxc.buckets.dias_0_30 === 250000);

// 9. TOP 4 Propuesta F22 (14D3 12.5% Ley 21.755, 14A 27%, 14D8 0% y PPM a DJ1947; Cod 36 L85)
var f22D3 = Pro.calcularPropuestaF22({
    regimen: '14D3',
    anioTributario: 2026,
    baseImponibleRli: 20000000,
    ppmNominales: [{ mes: '2025-01', monto: 1000000, factor: 1.036 }, { mes: '2025-12', monto: 500000, factor: 1.0 }]
});
assert.strictEqual(f22D3.tasaIdpc, 12.5);
assert.strictEqual(f22D3.idpcDeterminado, 2500000);
assert.strictEqual(f22D3.ppmCod36Empresa, 1536000);
assert.strictEqual(f22D3.saldoAPagar, 964000);
assert.ok(f22D3.notaNormativa.indexOf('código 36') >= 0 && f22D3.notaNormativa.indexOf('código 84') < 0);

var f22D8 = Pro.calcularPropuestaF22({ regimen: '14D8', anioTributario: 2026, baseImponibleRli: 12000000, ppmPagadoTotal: 300000, factorPromedioPpm: 1.02 });
assert.strictEqual(f22D8.tasaIdpc, 0);
assert.strictEqual(f22D8.ppmCod36Empresa, 0);
assert.strictEqual(f22D8.ppmDj1947Socios, 306000);

var f22A = Pro.calcularPropuestaF22({ regimen: '14A', anioTributario: 2026, baseImponibleRli: 10000000, ppmPagadoTotal: 3000000, factorPromedioPpm: 1.0 });
assert.strictEqual(f22A.tasaIdpc, 27);
assert.strictEqual(f22A.idpcDeterminado, 2700000);
assert.strictEqual(f22A.devolucionF22, 300000);

console.log('OK test_contadores_asistente_pro (9/9 escenarios validados)');
