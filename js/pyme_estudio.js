/*
 * CalculoLaboral · resumen del mes de todas las empresas de un estudio (Asistente Pyme, v1.0.0)
 * Funciona en el navegador (window.CLPymeEstudio) y en Node (require).
 *
 *   resumenEmpresa({ trabajadores, meses, boletas })  → { activos, guardadas, emitidas, previred, impuesto, retencion, costo, haberes, liquido, sinDesglose }
 *       trabajadores: la lista de la empresa; meses: { trabajadorId: mes guardado }; boletas: las de honorarios del mes
 *   totales(filas)                                    → la suma de cada columna numérica
 *   csv({ periodoNombre }, filas)                     → texto separado por punto y coma, para abrir en Excel
 *
 * Usa las mismas cuentas del panel de cada empresa (L.previred para Previred y el impuesto único, HON.resumen para la retención de
 * honorarios), así que los montos coinciden con los que ve la empresa. Es una ayuda para revisar el F29 y Previred: no los reemplaza.
 */
(function (root) {
    'use strict';

    // Se resuelven al usarlos: en la página este archivo puede cargarse antes que los otros dos
    var esNode = typeof module !== 'undefined' && module.exports;
    function L() { return esNode ? require('./pyme_liquidaciones.js') : root.CLPymeLiquidaciones; }
    function HON() { return esNode ? require('./pyme_honorarios.js') : root.CLPymeHonorarios; }

    var COLUMNAS = [
        { k: 'empresa', titulo: 'Empresa' }, { k: 'rut', titulo: 'RUT' }, { k: 'activos', titulo: 'Trabajadores activos' },
        { k: 'guardadas', titulo: 'Liquidaciones guardadas' }, { k: 'emitidas', titulo: 'Liquidaciones emitidas' },
        { k: 'liquido', titulo: 'Líquido a pagar' }, { k: 'previred', titulo: 'Previred (estimación)' },
        { k: 'impuesto', titulo: 'F29 cód. 48 · Impuesto único' }, { k: 'retencion', titulo: 'F29 cód. 151 · Retención honorarios' },
        { k: 'costo', titulo: 'Costo total empresa' }
    ];
    var NUMEROS = COLUMNAS.slice(2).map(function (c) { return c.k; });

    function resumenEmpresa(d) {
        var trabajadores = (d && d.trabajadores) || [], meses = (d && d.meses) || {};
        var activos = trabajadores.filter(function (t) { return t.activo; });
        var registros = [], guardadas = 0, emitidas = 0, liquido = 0, haberes = 0, sinDesglose = 0;
        Object.keys(meses).forEach(function (id) {
            var m = meses[id];
            if (!m) return;
            guardadas++;
            if (m.emitida) emitidas++;
            var c = m.calculo;
            if (c) { liquido += c.liquido || 0; haberes += c.totalHaberes || 0; if (!c.conDesglose) sinDesglose++; }
            else sinDesglose++;
            registros.push(c);
        });
        var prev = L().previred(registros), hon = HON().resumen((d && d.boletas) || []);
        return {
            activos: activos.length, guardadas: guardadas, emitidas: emitidas, liquido: liquido, haberes: haberes,
            previred: prev.total, impuesto: prev.impuesto, retencion: hon.retenidoEmpresa || 0, costo: prev.costo, sinDesglose: sinDesglose, sinTasa: !!hon.sinTasa
        };
    }

    function totales(filas) {
        var t = { empresa: 'Totales', rut: '' };
        NUMEROS.forEach(function (k) { t[k] = (filas || []).reduce(function (s, f) { return s + (Number(f[k]) || 0); }, 0); });
        return t;
    }

    function celda(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function csv(meta, filas) {
        var lineas = [];
        var relleno = ';'.repeat(COLUMNAS.length - 1);
        lineas.push(celda('Resumen de ' + meta.periodoNombre + ' de todas las empresas') + relleno);
        lineas.push(celda('Montos en pesos calculados con el Asistente Laboral Pyme a partir de las liquidaciones y boletas guardadas. Previred y el F29 son una estimación: confirma los montos en Previred y en sii.cl antes de declarar.') + relleno);
        lineas.push('');
        lineas.push(COLUMNAS.map(function (c) { return celda(c.titulo); }).join(';'));
        (filas || []).concat([totales(filas)]).forEach(function (f) {
            lineas.push(COLUMNAS.map(function (c) { return celda(f[c.k]); }).join(';'));
        });
        return lineas.join('\r\n') + '\r\n';
    }

    var api = { resumenEmpresa: resumenEmpresa, totales: totales, csv: csv, COLUMNAS: COLUMNAS, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeEstudio = api;
})(typeof window !== 'undefined' ? window : this);
