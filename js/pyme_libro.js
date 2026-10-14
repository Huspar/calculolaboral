/*
 * CalculoLaboral · libro de remuneraciones del mes para el contador (v1.0.0)
 * Funciona en el navegador (window.CLPymeLibro) y en Node (require).
 *
 *   fila(trabajador, resultado)  → una fila con los totales de la liquidación (resultado = liquidacion_engine.calcular)
 *   totales(filas)               → la fila de totales
 *   csv({ empresa, periodoNombre }, filas) → texto separado por punto y coma, para abrir en Excel
 *   COLUMNAS                     → [{ k, titulo }] en el orden del archivo y de la hoja impresa
 *
 * Es el resumen del art. 62 del Código del Trabajo con lo que el asistente calcula; no reemplaza al Libro de
 * Remuneraciones Electrónico de la DT, obligatorio desde 5 trabajadores (Ley 21.327). Lo dice el mismo archivo.
 */
(function (root) {
    'use strict';

    var COLUMNAS = [
        { k: 'rut', titulo: 'RUT' }, { k: 'nombre', titulo: 'Nombre' }, { k: 'dias', titulo: 'Días trabajados' },
        { k: 'sueldoBase', titulo: 'Sueldo base' }, { k: 'horasExtra', titulo: 'Horas extra' }, { k: 'gratificacion', titulo: 'Gratificación' },
        { k: 'otrosImponibles', titulo: 'Otros imponibles' }, { k: 'totalImponible', titulo: 'Total imponible' },
        { k: 'colMov', titulo: 'Colación y movilización' }, { k: 'otrosNoImponibles', titulo: 'Otros no imponibles' }, { k: 'totalHaberes', titulo: 'Total haberes' },
        { k: 'afp', titulo: 'AFP' }, { k: 'salud', titulo: 'Salud' }, { k: 'afc', titulo: 'Seguro de cesantía' }, { k: 'impuesto', titulo: 'Impuesto único' },
        { k: 'otrosDescuentos', titulo: 'Otros descuentos' }, { k: 'totalDescuentos', titulo: 'Total descuentos' }, { k: 'liquido', titulo: 'Líquido a pagar' },
        { k: 'aportesEmpleador', titulo: 'Cotizaciones del empleador' }, { k: 'costo', titulo: 'Costo total' }
    ];
    var NUMEROS = COLUMNAS.slice(2).map(function (c) { return c.k; });

    function suma(lista, prefijos) {
        return (lista || []).reduce(function (s, l) {
            return s + (prefijos.some(function (p) { return String(l.concepto).indexOf(p) === 0; }) ? l.monto : 0);
        }, 0);
    }

    function fila(t, res) {
        var m = res.montos || {};
        var sueldo = suma(res.haberesImponibles, ['Sueldo base']), he = suma(res.haberesImponibles, ['Horas extra']), grat = suma(res.haberesImponibles, ['Gratificación']);
        var colMov = suma(res.haberesNoImponibles, ['Colación', 'Movilización']);
        var legales = (m.afp || 0) + (m.salud || 0) + (m.afc || 0) + (m.impuesto || 0);
        return {
            rut: t.rut || '', nombre: t.nombre || '', dias: res.bases ? res.bases.dias : 0,
            sueldoBase: sueldo, horasExtra: he, gratificacion: grat, otrosImponibles: res.totalImponible - sueldo - he - grat, totalImponible: res.totalImponible,
            colMov: colMov, otrosNoImponibles: res.totalNoImponible - colMov, totalHaberes: res.totalHaberes,
            afp: m.afp || 0, salud: m.salud || 0, afc: m.afc || 0, impuesto: m.impuesto || 0,
            otrosDescuentos: res.totalDescuentos - legales, totalDescuentos: res.totalDescuentos, liquido: res.liquido,
            aportesEmpleador: res.empleador ? res.empleador.total : 0, costo: res.empleador ? res.empleador.costoTotal : res.totalHaberes
        };
    }

    function totales(filas) {
        var t = { rut: '', nombre: 'Totales', dias: '' };
        NUMEROS.forEach(function (k) { if (k !== 'dias') t[k] = filas.reduce(function (s, f) { return s + (f[k] || 0); }, 0); });
        return t;
    }

    function celda(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function csv(meta, filas) {
        var lineas = [];
        lineas.push(celda('Libro de remuneraciones de ' + meta.periodoNombre));
        lineas.push([celda(meta.empresa.razonSocial || ''), celda('RUT ' + (meta.empresa.rut || ''))].join(';'));
        lineas.push('');
        lineas.push(COLUMNAS.map(function (c) { return celda(c.titulo); }).join(';'));
        filas.concat([totales(filas)]).forEach(function (f) { lineas.push(COLUMNAS.map(function (c) { return celda(f[c.k]); }).join(';')); });
        lineas.push('');
        lineas.push(celda('Montos en pesos, calculados con el Asistente Laboral Pyme de calculolaboral.cl a partir de las liquidaciones guardadas. Las cotizaciones del empleador son una estimación: el monto exacto lo calcula Previred.'));
        lineas.push(celda('No reemplaza al Libro de Remuneraciones Electrónico de la Dirección del Trabajo, obligatorio para empleadores con 5 o más trabajadores (art. 62 del Código del Trabajo).'));
        return lineas.join('\r\n') + '\r\n';
    }

    var api = { COLUMNAS: COLUMNAS, fila: fila, totales: totales, csv: csv, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeLibro = api;
})(typeof window !== 'undefined' ? window : this);
