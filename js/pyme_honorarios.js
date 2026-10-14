/*
 * CalculoLaboral · boletas de honorarios recibidas por la empresa (v1.0.0)
 * Funciona en el navegador (window.CLPymeHonorarios) y en Node (require).
 *
 *   tasa(anio)                  → tasa de retención del año (o null si no hay una verificada)
 *   boleta({ fecha, bruto, retiene }) → { tasa, retencion, liquido } (retiene: 'empresa' | 'prestador')
 *   resumen(boletas)            → { cantidad, bruto, retenidoEmpresa, liquidoPagado, sinTasa }
 *
 * Retención de las boletas de honorarios (art. 42 N°2 y 74 N°2 de la Ley sobre Impuesto a la Renta), con el aumento
 * gradual de la Ley 21.133: 14,5% en 2025, 15,25% desde el 1-ene-2026, 16% en 2027 y 17% desde 2028 (SII, «Boletas de
 * honorarios»). Ejemplo publicado: boleta de $100.000 en 2026 → retención $15.250, líquido $84.750.
 * La retiene quien paga si es persona jurídica o lleva contabilidad completa (art. 74 N°2); si no, la boleta puede
 * emitirse sin retención y el impuesto lo paga el prestador. La retención de la empresa se declara en el código 151 del F29.
 * La tasa se toma del año de la fecha de la boleta.
 */
(function (root) {
    'use strict';

    var TASAS = { 2025: 0.145, 2026: 0.1525, 2027: 0.16, 2028: 0.17 };
    var PRIMER_ANIO = 2025, TASA_FINAL = 0.17; // desde 2028 la tasa queda en 17% (Ley 21.133)

    function tasa(anio) {
        anio = Number(anio);
        if (!(anio >= PRIMER_ANIO)) return null;
        return TASAS[anio] !== undefined ? TASAS[anio] : TASA_FINAL;
    }

    function boleta(b) {
        var bruto = Math.max(0, Math.round(Number(b && b.bruto) || 0));
        var t = tasa(String((b && b.fecha) || '').slice(0, 4));
        if (t === null) return { tasa: null, retencion: 0, liquido: bruto };
        var retencion = Math.round(bruto * t);
        // Si retiene el prestador, la empresa paga el total de la boleta y no declara nada en el código 151
        if (b.retiene === 'prestador') return { tasa: t, retencion: retencion, liquido: bruto, retieneEmpresa: 0 };
        return { tasa: t, retencion: retencion, liquido: bruto - retencion, retieneEmpresa: retencion };
    }

    function resumen(lista) {
        var r = { cantidad: 0, bruto: 0, retenidoEmpresa: 0, liquidoPagado: 0, sinTasa: 0 };
        (lista || []).forEach(function (b) {
            var c = boleta(b);
            r.cantidad++;
            r.bruto += Math.round(Number(b.bruto) || 0);
            r.liquidoPagado += c.liquido;
            r.retenidoEmpresa += c.retieneEmpresa || 0;
            if (c.tasa === null) r.sinTasa++;
        });
        return r;
    }

    var api = { tasa: tasa, boleta: boleta, resumen: resumen, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeHonorarios = api;
})(typeof window !== 'undefined' ? window : this);
