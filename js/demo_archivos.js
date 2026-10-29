/*
 * CálculoLaboral · archivos del mes de la demo para contadores (v1.0.0): LRE, nómina de pagos y asiento contable.
 * Funciona en el navegador (window.CLDemoArchivos) y en Node (require).
 *
 * Adapta los resultados de la demo (nómina de Excel calculada con el motor de liquidaciones) a lo que piden los mismos
 * módulos del Asistente Pyme (js/pyme_lre.js y js/pyme_pagos.js), así que los tres archivos salen igual en los dos productos.
 *
 *   lre(results, { periodo, empresa: { rut, mutual, ccaf, comuna }, tramoDe })   → { texto, nombreArchivo, errores, avisos, incluidos }
 *   nomina(results, { periodoNombre })                                          → { texto, incluidos, omitidos, total }
 *   asiento(results, { periodoNombre, cuentas })                                → { texto, cuadra, debe, haber, ... }
 *   causalCodigo(texto)                                                         → código de la tabla de causales del LRE o ''
 */
(function (root) {
    'use strict';

    var LRE = typeof module !== 'undefined' && module.exports ? require('./pyme_lre.js') : root.CLPymeLre;
    var PAG = typeof module !== 'undefined' && module.exports ? require('./pyme_pagos.js') : root.CLPymePagos;

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function norm(s) { return texto(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    var CAUSALES = ['3', '4', '5', '6', '7', '8', '24', '25', '26', '27', '28', '29', '11', '12', '13', '14', '15', '16', '18', '19', '20'];
    // Palabras que identifican cada causal cuando el Excel trae el texto en vez del código (de la más específica a la más general)
    var PALABRAS = [
        [/mutuo/, '3'], [/renuncia/, '4'], [/muerte|fallec/, '5'], [/vencimiento|plazo convenido|plazo fijo/, '6'], [/conclusion|obra|faena/, '7'], [/fortuito|fuerza mayor/, '8'],
        [/probidad/, '24'], [/acoso sexual/, '25'], [/vias de hecho/, '26'], [/injuria/, '27'], [/inmoral/, '28'], [/acoso laboral/, '29'],
        [/negociaciones/, '11'], [/no concurrencia|inasistencia/, '12'], [/abandono/, '13'], [/imprudencia|temerari/, '14'], [/perjuicio/, '15'], [/incumplimiento/, '16'],
        [/necesidades/, '18'], [/desahucio/, '19'], [/concursal|163/, '20']
    ];
    function causalCodigo(v) {
        var s = norm(v);
        if (!s) return '';
        if (/^\d{1,2}$/.test(s)) return CAUSALES.indexOf(s) >= 0 ? s : '';
        for (var i = 0; i < PALABRAS.length; i++) if (PALABRAS[i][0].test(s)) return PALABRAS[i][1];
        return '';
    }

    function ddmmaaaaAIso(s) {
        var m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(texto(s));
        if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
        return /^\d{4}-\d{2}-\d{2}$/.test(texto(s)) ? texto(s) : '';
    }

    // Línea de cada concepto como la espera el módulo del asistente: el APV y el seguro de cesantía del subsidio van entre las
    // cotizaciones (la demo los descuenta como «otros») y los totales se recalculan para que debe y haber sigan cuadrando.
    function resDe(d) {
        var res = Object.assign({}, d), legales = (d.descuentosLegales || []).slice(), otros = [], apv = 0, afcSub = 0;
        (d.otrosDescuentos || []).forEach(function (l) {
            if (/^APV/.test(l.concepto)) { legales.push({ concepto: 'APV régimen A', detalle: '', monto: l.monto }); apv += l.monto; }
            else if (/^AFC 0,6%/.test(l.concepto)) { legales.push({ concepto: 'Seguro de cesantía', detalle: 'Sobre el subsidio', monto: l.monto }); afcSub += l.monto; }
            else otros.push(l);
        });
        res.descuentosLegales = legales;
        res.otrosDescuentos = otros;
        res.totalOtros = otros.reduce(function (s, l) { return s + l.monto; }, 0);
        res.montos = Object.assign({}, d.montos, { apv: ((d.montos && d.montos.apv) || 0) + apv, afc: ((d.montos && d.montos.afc) || 0) + afcSub });
        return res;
    }

    function fichaDe(rec, o) {
        var mov = norm(rec.movimiento), esRetiro = /^(retiro|baja|finiquito)/.test(mov);
        var fin = rec.fechaTermino || (esRetiro ? ddmmaaaaAIso(rec.movHasta) : '');
        return {
            nombre: rec.nombre, rut: rec.rut, fechaIngreso: rec.ingreso, afp: rec.afp,
            salud: rec.salud === 'isapre' ? 'isapre' : 'fonasa', isapreNombre: rec.isapreNombre, isaprePlanUF: rec.planUF,
            jornadaHoras: rec.jornada, contrato: rec.contrato === 'plazo' ? 'plazo_fijo' : 'indefinido',
            afTramo: rec.tramoAF || (o && o.tramoDe ? o.tramoDe(rec) : ''), afCargas: rec.cargas,
            fechaTermino: fin, causalTermino: rec.causalTermino || '',
            pension: rec.tipoTrabajador === '1' ? 'vejez_cotiza' : rec.tipoTrabajador === '2' ? 'vejez_no_cotiza' : '',
            rutSindicato: rec.rutSindicato || '',
            banco: rec.banco, tipoCuenta: rec.tipoCuenta, numeroCuenta: rec.numeroCuenta
        };
    }

    function items(results, o) {
        return (results || []).filter(function (r) { return r && !r.error && r.detalle; }).map(function (r) {
            return { t: fichaDe(r.record, o), res: resDe(r.detalle), diasLicencia: r.record.licenciaDias || 0 };
        });
    }

    function lre(results, o) {
        return LRE.armar({ periodo: o.periodo, empresa: o.empresa || {}, items: items(results, o) });
    }

    function nomina(results, o) { return PAG.nomina({ periodoNombre: o.periodoNombre, items: items(results, o) }); }
    function asiento(results, o) { return PAG.asiento({ periodoNombre: o.periodoNombre, cuentas: o.cuentas || {}, items: items(results, o) }); }

    var api = { lre: lre, nomina: nomina, asiento: asiento, causalCodigo: causalCodigo, items: items, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLDemoArchivos = api;
})(typeof window !== 'undefined' ? window : this);
