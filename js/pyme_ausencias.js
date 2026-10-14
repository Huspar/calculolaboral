/*
 * CalculoLaboral · licencias médicas y permisos del Asistente Pyme (v1.0.0)
 * Funciona en el navegador (window.CLPymeAusencias) y en Node (require).
 *
 * Registro en la ficha (t.ausencias): [{ id, tipo: 'licencia' | 'permiso' | 'sin_goce', desde, hasta }]. Solo fechas: nunca
 * diagnóstico ni otro dato de salud.
 *
 *   delMes(lista, 'AAAA-MM')            → las ausencias que tocan el mes, recortadas al mes (lo que se guarda en mes.ausencias)
 *   diasNoPagados(lista, 'AAAA-MM')     → días de licencia o permiso sin goce del mes, en mes comercial de 30 días
 *   diasLicencia(lista, 'AAAA-MM')      → solo los de licencia médica, igual que el anterior (para la liquidación)
 *   diasTrabajados(diasBase, lista, 'AAAA-MM', { desde, hasta }) → días a pagar: los del contrato en el mes menos los no pagados
 *   dias(a)                             → días corridos de una ausencia
 *   carencia(a)                         → true si es licencia de 10 días o menos (sin subsidio los 3 primeros días)
 *   plazoTramite(a, F)                  → último día para tramitar la licencia si se recibió el día que empieza
 *
 * Normas: el empleador tramita la licencia dentro de 3 días hábiles desde que la recibe (art. 13 del DS 3 de 1984); si lo hace
 * fuera de plazo, paga él lo que correspondía como subsidio (art. 56). El subsidio corre desde el primer día si la licencia
 * dura más de 10 días y desde el cuarto si dura 10 o menos (art. 14 del DFL 44 de 1978); el empleador no está obligado a
 * pagar esos días salvo que lo haya pactado. Licencias seguidas por la misma causa se suman (Suseso). Para el plazo se cuenta
 * el sábado como hábil, que da el plazo más corto, y se excluyen domingos y feriados.
 * Mes comercial: el día 31 cuenta como el 30 y, en febrero, una ausencia que llega al último día cubre hasta el 30.
 */
(function (root) {
    'use strict';

    var TIPOS = { licencia: 'Licencia médica', permiso: 'Permiso con goce de sueldo', sin_goce: 'Permiso sin goce de sueldo' };

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function ultimo(periodo) { var a = periodo.split('-').map(Number); return new Date(Date.UTC(a[0], a[1], 0)).getUTCDate(); }
    function aMs(iso) { var a = iso.split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); }
    function dias(a) { return Math.round((aMs(a.hasta) - aMs(a.desde)) / 86400000) + 1; }
    function valida(a) { return a && /^\d{4}-\d{2}-\d{2}$/.test(a.desde) && /^\d{4}-\d{2}-\d{2}$/.test(a.hasta) && a.desde <= a.hasta; }

    function delMes(lista, periodo) {
        var ini = periodo + '-01', fin = periodo + '-' + dos(ultimo(periodo));
        return (lista || []).filter(function (a) { return valida(a) && a.desde <= fin && a.hasta >= ini; })
            .map(function (a) { return { tipo: TIPOS[a.tipo] ? a.tipo : 'licencia', desde: a.desde < ini ? ini : a.desde, hasta: a.hasta > fin ? fin : a.hasta }; })
            .sort(function (x, y) { return x.desde < y.desde ? -1 : x.desde > y.desde ? 1 : 0; });
    }

    // Días comerciales (1 a 30) que cubre una lista de ausencias dentro del mes
    function diasComerciales(lista, periodo, tipos) {
        var u = ultimo(periodo), set = {};
        delMes(lista, periodo).forEach(function (a) {
            if (tipos.indexOf(a.tipo) < 0) return;
            var d1 = +a.desde.slice(8, 10), d2 = +a.hasta.slice(8, 10);
            for (var d = d1; d <= d2; d++) set[Math.min(d, 30)] = true;
            if (d2 === u && u < 30) for (var x = u + 1; x <= 30; x++) set[x] = true;
        });
        return set;
    }
    function contar(set) { return Object.keys(set).length; }
    function diasNoPagados(lista, periodo) { return contar(diasComerciales(lista, periodo, ['licencia', 'sin_goce'])); }
    function diasLicencia(lista, periodo) { return contar(diasComerciales(lista, periodo, ['licencia'])); }

    // Días a pagar: los días comerciales del contrato en el mes (desde/hasta, como pyme_liquidaciones.diasBase) sin los no pagados
    function diasTrabajados(lista, periodo, rango) {
        rango = rango || {};
        var ini = periodo + '-01', fin = periodo + '-' + dos(ultimo(periodo));
        if ((rango.desde && rango.desde > fin) || (rango.hasta && rango.hasta < ini)) return 0;
        var d1 = rango.desde && rango.desde >= ini ? Math.min(+rango.desde.slice(8, 10), 30) : 1;
        var d2 = rango.hasta && rango.hasta <= fin ? Math.min(+rango.hasta.slice(8, 10), 30) : 30;
        var fuera = diasComerciales(lista, periodo, ['licencia', 'sin_goce']), n = 0;
        for (var d = d1; d <= d2; d++) if (!fuera[d]) n++;
        return n;
    }

    function carencia(a) { return a.tipo === 'licencia' && dias(a) <= 10; }

    function plazoTramite(a, F) {
        try { return F.sumarDiasHabiles(a.desde, 3, { sabadoHabil: true }); } catch (e) { return null; }
    }

    var api = { TIPOS: TIPOS, delMes: delMes, diasNoPagados: diasNoPagados, diasLicencia: diasLicencia, diasTrabajados: diasTrabajados, dias: dias, carencia: carencia, plazoTramite: plazoTramite, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeAusencias = api;
})(typeof window !== 'undefined' ? window : this);
