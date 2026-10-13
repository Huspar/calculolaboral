/*
 * CalculoLaboral · vacaciones del Asistente Pyme (v1.0.0)
 * Saldo estimado de feriado de cada trabajador: lo que corresponde por años completos de servicio menos lo registrado.
 *  - Feriado básico: 15 días hábiles por año de servicio; 20 en zona extrema (art. 67).
 *  - Feriado progresivo: un día hábil más por cada tres nuevos años trabajados sobre 10, contando hasta 10 años con
 *    empleadores anteriores (art. 68). Se suma en el aniversario en que se cumplen.
 *  - Para el feriado el sábado es siempre inhábil (art. 69); domingos y feriados nacionales tampoco cuentan.
 *  - El feriado puede acumularse hasta por dos períodos consecutivos (art. 70).
 * Registros: { tipo: 'periodo', desde, hasta, dias, nota } o { tipo: 'ajuste', fecha, dias, nota } (días tomados antes de
 * usar el asistente). Funciones puras: las usan el navegador (window.CLPymeVacaciones) y el servidor (require).
 */
(function (root) {
    'use strict';

    var BASE = 15, BASE_EXTREMA = 20, MAX_DIAS_PERIODO = 92;

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function deIso(s) { var a = String(s).split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); }
    function aIso(d) { return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function esFecha(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && aIso(deIso(s)) === s; }
    function diasEntre(desde, hasta) { return Math.round((deIso(hasta) - deIso(desde)) / 86400000); }

    // Aniversario número k de una fecha (el 29 de febrero pasa al 28 en años no bisiestos)
    function aniversario(ingreso, k) {
        var a = ingreso.split('-').map(Number), y = a[0] + k, m = a[1];
        var ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return y + '-' + dos(m) + '-' + dos(Math.min(a[2], ultimo));
    }
    function aniosCompletos(ingreso, hoy) {
        var k = 0;
        while (k < 80 && aniversario(ingreso, k + 1) <= hoy) k++;
        return k;
    }
    // Días adicionales por feriado progresivo con esa cantidad total de años trabajados (art. 68)
    function progresivo(aniosTotales) { return aniosTotales >= 10 ? Math.floor((aniosTotales - 10) / 3) : 0; }

    /** Lo que corresponde por años completos de servicio hasta hoy. */
    function derecho(t, hoy) {
        var base = t && t.zonaExtrema ? BASE_EXTREMA : BASE;
        var otros = Math.max(0, Math.min(10, Number(t && t.aniosOtrosEmpleadores) || 0));
        if (!t || !esFecha(t.fechaIngreso) || t.fechaIngreso > hoy) return { anios: 0, base: base, otros: otros, porAnio: [], total: 0, anual: base + progresivo(otros + 1), proximo: null };
        var n = aniosCompletos(t.fechaIngreso, hoy), porAnio = [], total = 0;
        for (var k = 1; k <= n; k++) {
            var dias = base + progresivo(k + otros);
            porAnio.push({ anio: k, desde: aniversario(t.fechaIngreso, k), dias: dias, progresivo: dias - base });
            total += dias;
        }
        return { anios: n, base: base, otros: otros, porAnio: porAnio, total: total, anual: base + progresivo(n + 1 + otros), proximo: aniversario(t.fechaIngreso, n + 1) };
    }

    /** Días hábiles de feriado entre dos fechas, ambas incluidas. F es js/feriados_cl.js (lanza si el año no tiene feriados verificados). */
    function diasHabiles(desde, hasta, F) {
        if (!esFecha(desde) || !esFecha(hasta)) throw new Error('Fechas no válidas.');
        if (hasta < desde) throw new Error('La fecha de término debe ser igual o posterior a la de inicio.');
        if (diasEntre(desde, hasta) + 1 > MAX_DIAS_PERIODO) throw new Error('Un período no puede pasar de ' + MAX_DIAS_PERIODO + ' días corridos.');
        var dias = 0, sabados = 0, d = deIso(desde), fin = deIso(hasta);
        while (d <= fin) {
            var iso = aIso(d), s = d.getUTCDay();
            if (F.esDiaHabil(iso)) dias++;
            else if (s === 6 && !F.esFeriado(iso)) sabados++;
            d = new Date(d.getTime() + 86400000);
        }
        return { dias: dias, sabados: sabados, feriados: F.feriadosEntre(desde, hasta) };
    }

    function tomados(registros) { return (registros || []).reduce(function (s, r) { return s + (Number(r.dias) || 0); }, 0); }

    /** Resumen de un trabajador: derecho, días tomados, saldo, período actual o próximo y avisos. */
    function resumen(t, registros, hoy) {
        var d = derecho(t, hoy), tom = tomados(registros), saldo = d.total - tom, avisos = [];
        var periodos = (registros || []).filter(function (r) { return r.tipo === 'periodo'; });
        var actual = periodos.filter(function (r) { return r.desde <= hoy && r.hasta >= hoy; })[0] || null;
        var proximo = periodos.filter(function (r) { return r.desde > hoy; }).sort(function (a, b) { return a.desde < b.desde ? -1 : 1; })[0] || null;
        if (!t || !esFecha(t.fechaIngreso)) avisos.push({ nivel: 'aviso', texto: 'Falta la fecha de ingreso en la ficha: sin ella no podemos calcular los días que le corresponden.' });
        else if (d.anios === 0) avisos.push({ nivel: 'info', texto: 'Aún no cumple su primer año de servicio: el feriado anual corresponde desde el ' + fechaCorta(aniversario(t.fechaIngreso, 1)) + ' (art. 67).' });
        if (saldo < 0) avisos.push({ nivel: 'aviso', texto: 'Registraste más días de los que corresponden por años completos: puede ser un feriado anticipado o un error en el registro.' });
        if (saldo > 2 * d.anual) avisos.push({ nivel: 'aviso', texto: 'Tiene más de dos períodos acumulados. El feriado puede acumularse hasta por dos períodos consecutivos (art. 70).' });
        return { derecho: d, tomados: tom, saldo: saldo, actual: actual, proximo: proximo, avisos: avisos };
    }

    var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    function fechaCorta(iso) { var a = iso.split('-'); return +a[2] + ' ' + MESES_CORTOS[+a[1] - 1] + ' ' + a[0]; }

    // Dos períodos se cruzan si comparten al menos un día
    function seCruzan(a, b) { return a.desde <= b.hasta && b.desde <= a.hasta; }

    var api = {
        BASE: BASE, BASE_EXTREMA: BASE_EXTREMA, MAX_DIAS_PERIODO: MAX_DIAS_PERIODO,
        esFecha: esFecha, aniversario: aniversario, aniosCompletos: aniosCompletos, progresivo: progresivo, derecho: derecho,
        diasHabiles: diasHabiles, tomados: tomados, resumen: resumen, seCruzan: seCruzan, version: '1.0.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeVacaciones = api;
})(typeof window !== 'undefined' ? window : this);
