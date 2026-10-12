/*
 * CalculoLaboral · motor del generador de liquidaciones de sueldo (v1.0.0)
 *
 * Función pura: calcular(datos, mes) devuelve las líneas de la liquidación, las bases de cálculo y los avisos.
 * "mes" son los valores oficiales de js/liquidacion_parametros.js. No usa valores del día ni APIs externas.
 *
 * Criterios (revisados el 12-oct-2026):
 * - Sueldo base, gratificación legal y topes imponibles proporcionales a los días trabajados (base 30).
 * - Hora extra: sueldo base / 30 × 28 / (4 × jornada semanal) × 1,5 (con 42 horas da el factor DT 1,5/180).
 * - Gratificación legal (art. 50): 25% de lo devengado en el mes con tope mensual de 4,75 ingresos mínimos / 12.
 * - Topes imponibles en pesos con la UF del último día del mes; plan de Isapre con esa misma UF.
 * - AFP y salud sobre lo imponible con tope de 90 UF; seguro de cesantía del trabajador (0,6%) solo en contrato
 *   indefinido, con tope de 135,2 UF.
 * - Base del impuesto único: imponible menos AFP, seguro de cesantía, salud (7% más adicional de Isapre, con tope
 *   conjunto del 7% de 90 UF, según el SII) y APV régimen B. Créditos de caja, anticipos y otros descuentos no la rebajan.
 * - Tramos del impuesto con la UTM del mes.
 */
(function (root) {
    'use strict';

    var JORNADA_MAXIMA = 42;   // horas semanales en 2026 (Ley 21.561)
    var JORNADA_PARCIAL = 30;  // jornada parcial: hasta 30 horas semanales (art. 40 bis)
    var TASA_SALUD = 0.07;
    var TASA_AFC_TRABAJADOR = 0.006;
    var TOPE_GRATIFICACION_IMM = 4.75;
    var TOPE_DESCUENTOS_PACTADOS = 0.15; // art. 58

    // Tramos del impuesto único en UTM: [hasta, factor, rebaja]
    var TRAMOS = [
        [13.5, 0, 0],
        [30, 0.04, 0.54],
        [50, 0.08, 1.74],
        [70, 0.135, 4.49],
        [90, 0.23, 11.14],
        [120, 0.304, 17.8],
        [310, 0.35, 23.32],
        [Infinity, 0.40, 38.82]
    ];

    function n(v) {
        // La interfaz entrega números; un texto solo se acepta con coma decimal ("4,5")
        var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
        return isFinite(x) && x > 0 ? x : 0;
    }
    function r(x) { return Math.round(x); }
    function suma(lista) { return lista.reduce(function (t, l) { return t + l.monto; }, 0); }
    function pesos(x) { return '$' + Math.round(x).toLocaleString('es-CL'); }
    function pct(x) { return (Math.round(x * 10000) / 100).toLocaleString('es-CL') + '%'; }
    function lineasLibres(lista) {
        return (Array.isArray(lista) ? lista : [])
            .map(function (l) { return { concepto: String(l.nombre || '').trim().slice(0, 60), monto: r(n(l.monto)) }; })
            .filter(function (l) { return l.concepto && l.monto > 0; });
    }

    function impuestoUnico(base, utm) {
        for (var i = 0; i < TRAMOS.length; i++) {
            if (base <= TRAMOS[i][0] * utm) {
                return { monto: Math.max(0, r(base * TRAMOS[i][1] - TRAMOS[i][2] * utm)), tramo: i + 1, factor: TRAMOS[i][1] };
            }
        }
        return { monto: 0, tramo: 1, factor: 0 };
    }

    function calcular(datos, mes) {
        if (!mes || !mes.uf || !mes.utm || !mes.imm) throw new Error('Faltan los valores oficiales del mes.');
        var t = datos.trabajador || {};
        var m = datos.mes || {};
        var avisos = [];

        var dias = Math.min(30, Math.max(0, Math.round(n(m.diasTrabajados))));
        var f = dias / 30;
        var jornada = Math.min(JORNADA_MAXIMA, Math.max(1, n(t.jornadaHoras) || JORNADA_MAXIMA));
        var sueldoBase = r(n(t.sueldoBase));
        var indefinido = (t.contrato || 'indefinido') === 'indefinido';
        var tasaAfp = mes.afp[t.afp];
        if (!tasaAfp) throw new Error('Elige la AFP del trabajador.');

        // Haberes imponibles
        var imponibles = [];
        var sueldoMes = r(sueldoBase * f);
        imponibles.push({ concepto: 'Sueldo base', detalle: dias < 30 ? dias + ' de 30 días' : '', monto: sueldoMes });

        var horasExtra = n(m.horasExtra);
        if (horasExtra > 0) {
            var valorHoraExtra = sueldoBase / 30 * 28 / (4 * jornada) * 1.5;
            imponibles.push({ concepto: 'Horas extra', detalle: horasExtra.toLocaleString('es-CL') + ' h × ' + pesos(valorHoraExtra), monto: r(valorHoraExtra * horasExtra) });
        }
        var comisiones = r(n(m.comisiones));
        if (comisiones > 0) imponibles.push({ concepto: 'Comisiones', detalle: '', monto: comisiones });
        lineasLibres(m.bonosImponibles).forEach(function (b) { imponibles.push({ concepto: b.concepto, detalle: 'Bono imponible', monto: b.monto }); });

        var devengado = suma(imponibles);
        var tipoGrat = m.gratificacion || 'legal';
        if (tipoGrat === 'legal') {
            var topeGrat = r(TOPE_GRATIFICACION_IMM * mes.imm / 12 * f);
            var grat25 = r(devengado * 0.25);
            var grat = Math.min(grat25, topeGrat);
            imponibles.push({ concepto: 'Gratificación legal', detalle: grat === topeGrat && grat25 > topeGrat ? 'Tope mensual art. 50' : '25% art. 50', monto: grat });
        } else if (tipoGrat === 'manual' && n(m.gratificacionMonto) > 0) {
            imponibles.push({ concepto: 'Gratificación', detalle: '', monto: r(n(m.gratificacionMonto)) });
        }
        imponibles = imponibles.filter(function (l) { return l.monto > 0; });
        var totalImponible = suma(imponibles);

        // Haberes no imponibles
        var noImponibles = [];
        [['colacion', 'Colación'], ['movilizacion', 'Movilización'], ['viaticos', 'Viáticos'], ['asignacionFamiliar', 'Asignación familiar']].forEach(function (p) {
            var v = r(n(p[0] === 'colacion' || p[0] === 'movilizacion' ? t[p[0]] : m[p[0]]));
            if (v > 0) noImponibles.push({ concepto: p[1], detalle: '', monto: v });
        });
        lineasLibres(m.otrosNoImponibles).forEach(function (b) { noImponibles.push({ concepto: b.concepto, detalle: 'No imponible', monto: b.monto }); });
        var totalNoImponible = suma(noImponibles);
        var totalHaberes = totalImponible + totalNoImponible;

        // Descuentos legales
        var topeAfp = r(mes.topeAfpUF * mes.uf * f);
        var topeAfc = r(mes.topeAfcUF * mes.uf * f);
        var baseAfp = Math.min(totalImponible, topeAfp);
        var baseAfc = Math.min(totalImponible, topeAfc);
        var legales = [];

        var afp = r(baseAfp * tasaAfp);
        legales.push({ concepto: 'AFP ' + t.afp, detalle: pct(tasaAfp), monto: afp });

        var salud7 = r(baseAfp * TASA_SALUD);
        var saludTotal = salud7;
        if (t.salud === 'isapre') {
            var planUF = n(t.isaprePlanUF);
            var plan = r(planUF * mes.uf);
            var nombreIsapre = String(t.isapreNombre || 'Isapre').trim().slice(0, 40) || 'Isapre';
            legales.push({ concepto: 'Salud ' + nombreIsapre + ' (7%)', detalle: '', monto: salud7 });
            if (plan > salud7) {
                legales.push({ concepto: 'Adicional de salud', detalle: 'Plan ' + planUF.toLocaleString('es-CL') + ' UF', monto: plan - salud7 });
                saludTotal = plan;
            }
            if (!planUF) avisos.push({ nivel: 'aviso', texto: 'Falta el valor del plan de Isapre en UF: se descontó solo el 7%.' });
        } else {
            legales.push({ concepto: 'Salud Fonasa', detalle: '7%', monto: salud7 });
        }

        var afc = indefinido ? r(baseAfc * TASA_AFC_TRABAJADOR) : 0;
        if (indefinido) legales.push({ concepto: 'Seguro de cesantía', detalle: '0,6%', monto: afc });

        var apv = r(n(m.apvMonto));
        var apvB = apv > 0 && m.apvRegimen === 'B';
        var rebajaSalud = Math.min(saludTotal, r(TASA_SALUD * mes.topeAfpUF * mes.uf));
        var baseTributable = Math.max(0, totalImponible - afp - afc - rebajaSalud - (apvB ? apv : 0));
        var imp = impuestoUnico(baseTributable, mes.utm);
        legales.push({ concepto: 'Impuesto único', detalle: imp.monto ? 'Tramo ' + imp.tramo + ' (' + pct(imp.factor) + ')' : 'Exento', monto: imp.monto });
        if (apv > 0) legales.push({ concepto: 'APV régimen ' + (apvB ? 'B' : 'A'), detalle: '', monto: apv });
        var totalLegales = suma(legales);

        // Otros descuentos
        var otros = [];
        [['anticipo', 'Anticipo de sueldo'], ['creditoCCAF', 'Crédito caja de compensación'], ['cuotaSindical', 'Cuota sindical']].forEach(function (p) {
            var v = r(n(m[p[0]]));
            if (v > 0) otros.push({ concepto: p[1], detalle: '', monto: v });
        });
        var pactados = lineasLibres(m.otrosDescuentos);
        pactados.forEach(function (d) { otros.push({ concepto: d.concepto, detalle: 'Pactado por escrito', monto: d.monto }); });
        var totalOtros = suma(otros);
        var totalDescuentos = totalLegales + totalOtros;
        var liquido = totalHaberes - totalDescuentos;

        // Avisos
        var minimo = jornada <= JORNADA_PARCIAL ? r(mes.imm * jornada / JORNADA_MAXIMA) : mes.imm;
        if (sueldoBase > 0 && sueldoBase < minimo) {
            avisos.push({ nivel: 'aviso', texto: 'El sueldo base pactado (' + pesos(sueldoBase) + ') es menor al ingreso mínimo para ' + jornada + ' horas semanales (' + pesos(minimo) + '). Revisa el contrato; hay excepciones para menores de 18 y mayores de 65 años.' });
        }
        var totalPactados = suma(pactados);
        if (totalPactados > TOPE_DESCUENTOS_PACTADOS * totalHaberes) {
            avisos.push({ nivel: 'aviso', texto: 'Los descuentos pactados (' + pesos(totalPactados) + ') superan el 15% de la remuneración total, el máximo del artículo 58 del Código del Trabajo.' });
        }
        if (totalImponible > topeAfp && dias > 0) {
            avisos.push({ nivel: 'info', texto: 'Lo imponible supera el tope de ' + mes.topeAfpUF + ' UF: AFP y salud se calculan sobre ' + pesos(topeAfp) + '.' });
        }
        if (dias < 30) {
            avisos.push({ nivel: 'info', texto: 'Mes incompleto: sueldo base, gratificación legal y topes imponibles se calcularon por ' + dias + ' de 30 días.' });
        }
        if (dias === 0) avisos.push({ nivel: 'error', texto: 'Indica al menos un día trabajado.' });
        if (!sueldoBase) avisos.push({ nivel: 'error', texto: 'Falta el sueldo base.' });
        if (liquido < 0) avisos.push({ nivel: 'error', texto: 'Los descuentos superan los haberes: revisa los montos.' });

        return {
            haberesImponibles: imponibles,
            totalImponible: totalImponible,
            haberesNoImponibles: noImponibles,
            totalNoImponible: totalNoImponible,
            totalHaberes: totalHaberes,
            descuentosLegales: legales,
            totalLegales: totalLegales,
            otrosDescuentos: otros,
            totalOtros: totalOtros,
            totalDescuentos: totalDescuentos,
            liquido: liquido,
            bases: {
                dias: dias, jornada: jornada, uf: mes.uf, utm: mes.utm, imm: mes.imm,
                topeAfp: topeAfp, topeAfc: topeAfc, baseAfp: baseAfp, baseAfc: baseAfc,
                rebajaSalud: rebajaSalud, baseTributable: baseTributable, tramo: imp.tramo
            },
            avisos: avisos,
            listo: !avisos.some(function (a) { return a.nivel === 'error'; })
        };
    }

    var api = { calcular: calcular, impuestoUnico: impuestoUnico, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionEngine = api;
})(typeof window !== 'undefined' ? window : this);
