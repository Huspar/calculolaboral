/*
 * CalculoLaboral · proyección del costo de los trabajadores (v1.0.0)
 * Funciona en el navegador (window.CLPymeProyeccion) y en Node (require).
 *
 *   tasaLey('AAAA-MM')            → aporte total del empleador de la Ley 21.735 ese mes (SIS incluido), o null antes de ago-2026
 *   hitos('AAAA-MM')              → [{ periodo, tasa }] los cambios de tasa posteriores a ese mes (hasta agosto de 2033)
 *   proyectar(calculo, 'AAAA-MM', hito) → { costo, ley, diferencia } costo mensual del trabajador con la tasa del hito
 *   horaExtra(sueldoBase, jornada) → valor de una hora extra (sueldo / 30 × 28 / (4 × jornada) × 1,5)
 *
 * Calendario oficial (Subsecretaría de Previsión Social, presentación «Ley 21.735, nueva cotización del empleador»,
 * septiembre de 2025): 1% desde agosto de 2025 (con el SIS aparte); con el SIS incluido, 3,5% desde agosto de 2026, 4,25%
 * en 2027, 5% en 2028, 5,7% en 2029, 6,4% en 2030, 7,1% en 2031, 7,8% en 2032 y 8,5% desde agosto de 2033. Desde 2029 el
 * calendario puede extenderse hasta 11 años: la proyección lo advierte.
 * El cálculo mantiene igual el sueldo, la mutual y el seguro de cesantía: solo cambia el aporte de la ley.
 * Jornada máxima de 40 horas desde el 26-abr-2028 (Ley 21.561), sin rebaja del sueldo: la hora extra sube en proporción.
 */
(function (root) {
    'use strict';

    var CALENDARIO = [
        ['2026-08', 0.035], ['2027-08', 0.0425], ['2028-08', 0.05], ['2029-08', 0.057], ['2030-08', 0.064],
        ['2031-08', 0.071], ['2032-08', 0.078], ['2033-08', 0.085]
    ];
    var JORNADA_40 = '2028-04-26';

    function tasaLey(periodo) {
        var t = null;
        CALENDARIO.forEach(function (c) { if (periodo >= c[0]) t = c[1]; });
        return t;
    }

    function hitos(periodo) {
        return CALENDARIO.filter(function (c) { return c[0] > periodo; }).map(function (c) { return { periodo: c[0], tasa: c[1] }; });
    }

    // "calculo": el resumen guardado del mes (pyme_liquidaciones.resumen con conDesglose). El aporte de la ley es
    // empAfp + empSis + empSeguroSocial: se escala con la tasa del hito sobre la del mes de la liquidación.
    function proyectar(calculo, periodo, hito) {
        var actual = tasaLey(periodo);
        if (!calculo || !calculo.conDesglose || !actual) return null;
        var ley = (calculo.empAfp || 0) + (calculo.empSis || 0) + (calculo.empSeguroSocial || 0);
        var otros = (calculo.empAfc || 0) + (calculo.empMutual || 0);
        var leyHito = Math.round(ley * hito.tasa / actual);
        var costo = (calculo.totalHaberes || 0) + otros + leyHito;
        return { costo: costo, ley: leyHito, diferencia: costo - (calculo.costoEmpleador || 0) };
    }

    function horaExtra(sueldoBase, jornada) {
        var s = Number(sueldoBase) || 0, j = Number(jornada) || 0;
        return s > 0 && j > 0 ? Math.round(s / 30 * 28 / (4 * j) * 1.5) : 0;
    }

    var api = { CALENDARIO: CALENDARIO, JORNADA_40: JORNADA_40, tasaLey: tasaLey, hitos: hitos, proyectar: proyectar, horaExtra: horaExtra, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeProyeccion = api;
})(typeof window !== 'undefined' ? window : this);
