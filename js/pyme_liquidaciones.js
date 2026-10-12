/*
 * CalculoLaboral · valores base de las liquidaciones del Asistente Pyme (v1.0.0). Funciona en el navegador (window.CLPymeLiquidaciones) y en Node.
 *
 *   diasBase(trabajador, 'AAAA-MM')  → días a pagar según ingreso y término de plazo fijo (mes comercial de 30 días); 0 si aún no ingresaba o ya terminó
 *   mesBase(trabajador, 'AAAA-MM')   → el mes con los valores por defecto (lo que se guarda al "preparar el mes")
 *   resumen(resultado, mesValores)   → { liquido, totalHaberes, totalImponible, totalDescuentos, uf, utm } para guardar junto al mes
 *   estadoDe(registro)               → 'sin_datos' | 'guardada' | 'emitida'
 *
 * Son valores iniciales: la persona los revisa y corrige antes de guardar o imprimir.
 */
(function (root) {
    'use strict';

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function ultimoDia(periodo) {
        var a = periodo.split('-').map(Number);
        return new Date(Date.UTC(a[0], a[1], 0)).getUTCDate();
    }

    function diasBase(t, periodo) {
        var inicio = periodo + '-01', fin = periodo + '-' + dos(ultimoDia(periodo));
        var ingreso = t && t.fechaIngreso, termino = t && t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : '';
        if (ingreso && ingreso > fin) return 0;
        if (termino && termino < inicio) return 0;
        var desde = ingreso && ingreso >= inicio ? Math.min(+ingreso.slice(8, 10), 30) : 1;
        var hasta = termino && termino <= fin ? Math.min(+termino.slice(8, 10), 30) : 30;
        return Math.max(0, Math.min(30, hasta - desde + 1));
    }

    function mesBase(t, periodo) {
        var grat = t && t.gratificacion === 'ninguna' ? 'ninguna' : t && t.gratificacion === 'pactada' ? 'manual' : 'legal';
        return {
            diasTrabajados: diasBase(t, periodo), diasLicencia: 0, horasExtra: 0,
            gratificacion: grat, gratificacionMonto: 0, comisiones: 0, bonosImponibles: [],
            viaticos: 0, asignacionFamiliar: 0, otrosNoImponibles: [],
            apvMonto: 0, apvRegimen: 'B', anticipo: 0, creditoCCAF: 0, cuotaSindical: 0, otrosDescuentos: [],
            emitida: '', calculo: null
        };
    }

    function resumen(res, mesValores) {
        return {
            liquido: Math.max(0, Math.round(res.liquido)),
            totalHaberes: Math.round(res.totalHaberes),
            totalImponible: Math.round(res.totalImponible),
            totalDescuentos: Math.round(res.totalDescuentos),
            uf: mesValores.uf,
            utm: Math.round(mesValores.utm)
        };
    }

    function estadoDe(registro) {
        if (!registro) return 'sin_datos';
        return registro.emitida ? 'emitida' : 'guardada';
    }

    var api = { diasBase: diasBase, mesBase: mesBase, resumen: resumen, estadoDe: estadoDe, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeLiquidaciones = api;
})(typeof window !== 'undefined' ? window : this);
