/*
 * CalculoLaboral · semana corrida (art. 45 del Código del Trabajo) (v1.0.0)
 * Funciona en el navegador (window.CLSemanaCorrida) y en Node (require).
 *
 *   calcular({ periodo, distribucion, variable, ausencias, desde, hasta, esFeriado })
 *     periodo       'AAAA-MM'
 *     distribucion  '5' (lunes a viernes) o '6' (lunes a sábado): días de la jornada ordinaria
 *     variable      remuneración variable del mes que se devenga día a día (comisiones por venta, tratos, bonos de
 *                   producción diarios). No incluye sueldo fijo, horas extra, gratificación ni bonos accesorios.
 *     ausencias     [{ desde, hasta }] días en que el trabajador no estaba obligado a trabajar por una causa legal
 *                   (licencia médica, permiso, feriado anual). Las faltas injustificadas NO van aquí.
 *     desde, hasta  fechas de inicio y fin de la relación dentro del mes (opcionales: ingreso o término a mitad de mes)
 *     esFeriado     función (iso) → true si es feriado nacional
 *   → { monto, promedioDiario, divisor, multiplicador, habiles, descanso, habilesAusencia, descansoAusencia,
 *       festivosSabado: [iso], detalle }
 *
 * Criterio (Dirección del Trabajo, Ord. 833 de 05-dic-2024, que recoge los dictámenes 0110/001 de 2009 y 1983/82):
 * - Se paga el domingo y cada festivo con el promedio de lo devengado: la remuneración variable dividida por los días
 *   que el trabajador legalmente debió trabajar. Con sueldo mixto, el promedio es solo sobre la parte variable.
 * - Los días en que una causa legal lo eximía de trabajar (licencia, permiso, feriado) no se cuentan en el divisor; las
 *   faltas sin causa legal sí se cuentan. Los domingos y festivos dentro de una licencia o permiso no se pagan.
 * - La DT lo calcula semana a semana. Aquí se usa el promedio del mes, como lo hacen los software de remuneraciones
 *   (ejemplo publicado por Buk: mayo de 2022, licencia del 1 al 10, $200.000 de comisión → $40.000). Si lo devengado
 *   cambia mucho entre semanas, el cálculo semanal puede dar otro monto: la pantalla lo advierte.
 * - Con jornada de lunes a viernes, un festivo que cae en sábado no es día de la jornada y no se paga como semana
 *   corrida (mismo criterio del ejemplo de Buk). No hay un dictamen específico: se informa en el detalle.
 */
(function (root) {
    'use strict';

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function aIso(d) { return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function esFecha(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

    function calcular(o) {
        o = o || {};
        if (!/^\d{4}-\d{2}$/.test(String(o.periodo || ''))) throw new Error('Período inválido.');
        if (typeof o.esFeriado !== 'function') throw new Error('Falta el calendario de feriados.');
        var seis = String(o.distribucion) === '6';
        var variable = Math.max(0, Math.round(Number(o.variable) || 0));
        var anio = +o.periodo.slice(0, 4), mes = +o.periodo.slice(5, 7);
        var ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
        var ini = o.periodo + '-01', fin = o.periodo + '-' + dos(ultimo);
        var desde = esFecha(o.desde) && o.desde > ini ? o.desde : ini;
        var hasta = esFecha(o.hasta) && o.hasta < fin ? o.hasta : fin;
        var ausencias = (Array.isArray(o.ausencias) ? o.ausencias : []).filter(function (a) { return a && esFecha(a.desde) && esFecha(a.hasta) && a.desde <= a.hasta; });
        function ausente(iso) { return ausencias.some(function (a) { return iso >= a.desde && iso <= a.hasta; }); }

        var r = { habiles: 0, descanso: 0, habilesAusencia: 0, descansoAusencia: 0, festivosSabado: [] };
        for (var d = 1; d <= ultimo; d++) {
            var fecha = new Date(Date.UTC(anio, mes - 1, d)), iso = aIso(fecha), dow = fecha.getUTCDay();
            if (iso < desde || iso > hasta) continue;
            var tipo;
            if (dow === 0) tipo = 'descanso';
            else if (o.esFeriado(iso)) {
                if (dow === 6 && !seis) { r.festivosSabado.push(iso); continue; }
                tipo = 'descanso';
            } else if (dow === 6 && !seis) continue;   // sábado fuera de la jornada de lunes a viernes
            else tipo = 'habil';
            if (tipo === 'habil') { r.habiles++; if (ausente(iso)) r.habilesAusencia++; }
            else { r.descanso++; if (ausente(iso)) r.descansoAusencia++; }
        }
        r.divisor = r.habiles - r.habilesAusencia;
        r.multiplicador = r.descanso - r.descansoAusencia;
        r.promedioDiario = r.divisor > 0 ? variable / r.divisor : 0;
        r.monto = r.divisor > 0 && r.multiplicador > 0 ? Math.round(r.promedioDiario * r.multiplicador) : 0;
        r.variable = variable;
        r.detalle = r.monto ? r.multiplicador + ' domingos y festivos × $' + Math.round(r.promedioDiario).toLocaleString('es-CL') : '';
        return r;
    }

    var api = { calcular: calcular, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLSemanaCorrida = api;
})(typeof window !== 'undefined' ? window : this);
