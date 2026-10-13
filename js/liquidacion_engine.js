/*
 * CalculoLaboral · motor del generador de liquidaciones de sueldo (v1.3.0)
 *
 * Función pura: calcular(datos, mes) devuelve las líneas de la liquidación, las bases de cálculo y los avisos.
 * "datos": { trabajador, mes, periodo "AAAA-MM" }. "mes" son los valores oficiales del mes (UF, UTM, ingreso
 * mínimo, topes, jornada máxima y AFP). No usa valores del día ni APIs externas.
 *
 * Criterios (revisados el 12-oct-2026):
 * - Sueldo base, gratificación legal y topes imponibles proporcionales a los días trabajados (base 30).
 * - Hora extra: sueldo base / 30 × 28 / (4 × jornada semanal) × 1,5 (con 42 horas da el factor DT 1,5/180).
 * - Jornada máxima legal del mes: 44 horas hasta el 25-abr-2026 y 42 desde el 26-abr-2026 (Ley 21.561).
 * - Gratificación legal (art. 50): 25% de lo devengado en el mes con tope mensual de 4,75 ingresos mínimos / 12.
 * - Topes imponibles en pesos con la UF del último día del mes; plan de Isapre con esa misma UF.
 * - AFP y salud sobre lo imponible con tope de 90 UF (89,9 UF en enero de 2026); seguro de cesantía del trabajador
 *   (0,6%) solo en contrato indefinido, con tope de 135,2 UF (135,1 UF en enero), y solo durante los primeros 11 años de
 *   la relación laboral (art. 9 de la Ley 19.728): desde el mes siguiente a aquel en que se cumplen 11 años, el
 *   trabajador deja de cotizar. En el mes del aniversario se mantiene el descuento y se avisa.
 * - Base del impuesto único: imponible menos AFP, seguro de cesantía, salud (7% más adicional de Isapre, con tope
 *   conjunto del 7% de 90 UF, según el SII) y APV régimen B. Créditos de caja, anticipos y otros descuentos no la rebajan.
 * - Descuentos pactados por escrito (art. 58): otros descuentos y cuotas de préstamos del empleador (mes.cuotasPrestamo, del
 *   Asistente Pyme). Juntos no pueden pasar del 15% de la remuneración total: si pasan, se avisa. El anticipo no cuenta.
 * - Tramos del impuesto con la UTM del mes.
 *
 * Costo del empleador (resultado.empleador, solo si el mes trae "empleador" en sus valores): no cambia el líquido.
 * - AFP 0,1%, SIS y seguro social (Ley 21.735) sobre lo imponible con el tope de la AFP, con las tasas de cada mes.
 * - Seguro de cesantía del empleador (art. 5 de la Ley 19.728) con el tope del seguro: 2,4% en contrato indefinido,
 *   3% a plazo fijo o por obra y 0,8% en indefinido desde el mes siguiente a los 11 años de relación laboral.
 * - Mutual o ISL (Ley 16.744): 0,90% básica más 0,03% de la Ley 21.010 (SANNA) más la adicional de la empresa. Si no
 *   se indica la tasa total de la empresa, se usa 0,93% y se avisa.
 */
(function (root) {
    'use strict';

    var JORNADA_MAXIMA_DEFECTO = 42; // si el mes no trae jornada máxima (la normal desde el 26-abr-2026)
    var JORNADA_PARCIAL = 30;        // jornada parcial: hasta 30 horas semanales (art. 40 bis)
    var ANIOS_AFC = 11;              // años de cotización del trabajador al seguro de cesantía (art. 9 Ley 19.728)
    var TASA_SALUD = 0.07;
    var TASA_AFC_TRABAJADOR = 0.006;
    var TOPE_GRATIFICACION_IMM = 4.75;
    var TOPE_DESCUENTOS_PACTADOS = 0.15; // art. 58
    var TASA_AFC_EMPLEADOR = { indefinido: 0.024, plazo: 0.03, once: 0.008 }; // art. 5 Ley 19.728
    var TASA_MUTUAL_BASE = 0.0093;        // 0,90% básica (Ley 16.744) + 0,03% SANNA (Ley 21.010)
    var TASA_MUTUAL_MAX = 0.08;

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

    // Años de cotización al seguro de cesantía: 'cumplidos' si los 11 años se cumplieron en un mes anterior,
    // 'aniversario' si se cumplen durante el mes, 'no' en los demás casos (o sin fecha de ingreso).
    function estadoAfc11(fechaIngreso, periodo) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaIngreso || '')) || !/^\d{4}-\d{2}$/.test(String(periodo || ''))) return 'no';
        var aniversario = (+fechaIngreso.slice(0, 4) + ANIOS_AFC) + fechaIngreso.slice(4);
        var ult = new Date(Date.UTC(+periodo.slice(0, 4), +periodo.slice(5, 7), 0)).getUTCDate();
        if (aniversario < periodo + '-01') return 'cumplidos';
        if (aniversario <= periodo + '-' + (ult < 10 ? '0' : '') + ult) return 'aniversario';
        return 'no';
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
        var JORNADA_MAXIMA = mes.jornadaMaxima || JORNADA_MAXIMA_DEFECTO;
        var jornadaIndicada = n(t.jornadaHoras) || JORNADA_MAXIMA;
        var jornada = Math.min(JORNADA_MAXIMA, Math.max(1, jornadaIndicada));
        if (jornadaIndicada > JORNADA_MAXIMA) {
            avisos.push({ nivel: 'aviso', texto: 'La jornada indicada (' + jornadaIndicada + ' horas) supera la jornada máxima legal de ese mes (' + JORNADA_MAXIMA + ' horas semanales): se calculó con ' + JORNADA_MAXIMA + '.' });
        }
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

        var antig = indefinido ? estadoAfc11(t.fechaIngreso, datos.periodo) : 'no';
        var afc = indefinido && antig !== 'cumplidos' ? r(baseAfc * TASA_AFC_TRABAJADOR) : 0;
        if (indefinido && antig === 'cumplidos') {
            legales.push({ concepto: 'Seguro de cesantía', detalle: 'Sin descuento: 11 años con el mismo empleador', monto: 0 });
            avisos.push({ nivel: 'info', texto: 'No se descontó el seguro de cesantía del trabajador porque ya cumplió 11 años con este empleador (art. 9 de la Ley 19.728). Si la fecha de ingreso no corresponde a una relación laboral continua, corrígela.' });
        } else if (indefinido) {
            legales.push({ concepto: 'Seguro de cesantía', detalle: '0,6%', monto: afc });
            if (antig === 'aniversario') {
                avisos.push({ nivel: 'aviso', texto: 'El trabajador cumple 11 años con este empleador durante el mes. Se mantuvo el descuento del seguro de cesantía: desde el mes siguiente deja de corresponder (art. 9 de la Ley 19.728). Confírmalo con la AFC si necesitas el detalle del mes del aniversario.' });
            }
        }

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
        (Array.isArray(m.cuotasPrestamo) ? m.cuotasPrestamo : []).forEach(function (c) {
            var monto = r(n(c && c.monto)), nombre = String((c && c.nombre) || 'Préstamo').trim().slice(0, 60) || 'Préstamo';
            if (monto <= 0) return;
            var detalle = c.numero && c.de ? 'Cuota ' + c.numero + ' de ' + c.de : 'Cuota de préstamo';
            otros.push({ concepto: nombre, detalle: detalle, monto: monto });
            pactados.push({ concepto: nombre, monto: monto });
        });
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
            avisos.push({ nivel: 'aviso', texto: 'Los descuentos pactados y las cuotas de préstamos (' + pesos(totalPactados) + ') superan el 15% de la remuneración total (' + pesos(TOPE_DESCUENTOS_PACTADOS * totalHaberes) + '), el máximo del artículo 58 del Código del Trabajo. Posterga una cuota o reduce un descuento.' });
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
            // Montos retenidos al trabajador, para el resumen de lo que se paga en Previred y en el SII
            montos: { afp: afp, salud: saludTotal, afc: afc, impuesto: imp.monto, apv: apv, creditoCCAF: r(n(m.creditoCCAF)) },
            empleador: mes.empleador ? aportesEmpleador({ totalHaberes: totalHaberes, bases: { baseAfp: baseAfp, baseAfc: baseAfc } }, datos, mes) : null,
            avisos: avisos,
            listo: !avisos.some(function (a) { return a.nivel === 'error'; })
        };
    }

    // Edad cumplida al último día del mes (o null si no hay fecha de nacimiento)
    function edadAlCierre(fechaNacimiento, periodo) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaNacimiento || '')) || !/^\d{4}-\d{2}$/.test(String(periodo || ''))) return null;
        var ult = new Date(Date.UTC(+periodo.slice(0, 4), +periodo.slice(5, 7), 0)).getUTCDate();
        var cierre = periodo + '-' + (ult < 10 ? '0' : '') + ult;
        var e = +cierre.slice(0, 4) - +fechaNacimiento.slice(0, 4);
        if (cierre.slice(5) < fechaNacimiento.slice(5)) e--;
        return e;
    }

    // Cotizaciones de cargo del empleador. "res" necesita totalHaberes y bases.baseAfp / bases.baseAfc.
    function aportesEmpleador(res, datos, mes) {
        var e = mes && mes.empleador;
        if (!e || !res || !res.bases) return null;
        var t = datos.trabajador || {}, b = res.bases, avisos = [];
        var contrato = t.contrato || 'indefinido';
        var tasaAfc = contrato !== 'indefinido' ? TASA_AFC_EMPLEADOR.plazo
            : estadoAfc11(t.fechaIngreso, datos.periodo) === 'cumplidos' ? TASA_AFC_EMPLEADOR.once : TASA_AFC_EMPLEADOR.indefinido;
        var tm = Math.round(n(datos.tasaMutual) * 100) / 10000;
        var tasaMutual = tm >= TASA_MUTUAL_BASE && tm <= TASA_MUTUAL_MAX ? tm : TASA_MUTUAL_BASE;
        var lineas = [
            { clave: 'afp', concepto: 'AFP (cargo del empleador)', detalle: pct(e.afp), monto: r(b.baseAfp * e.afp) },
            { clave: 'sis', concepto: 'Seguro de invalidez y sobrevivencia (SIS)', detalle: pct(e.sis), monto: r(b.baseAfp * e.sis) },
            { clave: 'seguroSocial', concepto: 'Seguro social', detalle: pct(e.seguroSocial) + (e.seguroSocialDetalle ? ' (' + e.seguroSocialDetalle + ')' : ''), monto: r(b.baseAfp * e.seguroSocial) },
            { clave: 'afc', concepto: 'Seguro de cesantía (cargo del empleador)', detalle: pct(tasaAfc), monto: r(b.baseAfc * tasaAfc) },
            { clave: 'mutual', concepto: 'Mutual o ISL (accidentes del trabajo)', detalle: pct(tasaMutual), monto: r(b.baseAfp * tasaMutual) }
        ];
        if (!tm) {
            avisos.push({ nivel: 'info', texto: 'Para la mutual o el ISL usamos la tasa mínima de 0,93%. Si tu empresa paga una cotización adicional, indica la tasa total en «Empresa».' });
        }
        if (e.porConfirmar) {
            avisos.push({ nivel: 'info', texto: 'La tasa del SIS de este mes aún no está publicada: usamos la vigente (' + pct(e.sis) + '). Confírmala en Previred.' });
        }
        var edad = edadAlCierre(t.fechaNacimiento, datos.periodo);
        if (edad !== null && edad >= 65) {
            avisos.push({ nivel: 'aviso', texto: 'El trabajador tiene ' + edad + ' años: si está pensionado o es mayor de 65, no corresponden el SIS ni todas las cotizaciones del seguro social. Revisa en Previred cuáles aplican.' });
        }
        var total = suma(lineas);
        return { lineas: lineas, total: total, costoTotal: (res.totalHaberes || 0) + total, tasaMutual: tasaMutual, avisos: avisos };
    }

    var api = { calcular: calcular, impuestoUnico: impuestoUnico, aportesEmpleador: aportesEmpleador, TOPE_DESCUENTOS_PACTADOS: TOPE_DESCUENTOS_PACTADOS, version: '1.3.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionEngine = api;
})(typeof window !== 'undefined' ? window : this);
