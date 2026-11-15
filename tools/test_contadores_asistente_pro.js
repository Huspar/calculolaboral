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

console.log('OK test_contadores_asistente_pro (5/5 escenarios validados)');
