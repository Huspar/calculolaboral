/*
 * CalculoLaboral · Revisor Anual BHE, PPM y Renta para Independientes (v1.0.0)
 * Normativa verificada (nov-2026):
 * - Ley 21.133 tasas: 14,5% (2025), 15,25% (2026), 16,00% (2027), 17,00% (2028+).
 * - Cotizaciones obligatorias (Arts. 89-92 DL 3.500): base = 80% de honorarios brutos anuales (tope 1.080 UF - dep; exento < 5 IMM anuales).
 *   Cobertura parcial: AT 2026 (comercial 2025) = 80% Salud/AFP; AT 2027 (comercial 2026) = 90% Salud/AFP; AT 2028 = 100%.
 *   SIS (~1,79% nov-2026) y ATEP/SANNA (0,93% base) siempre sobre 100% de la base imponible.
 * - Gastos Art. 50 LIR: presuntos = 30% bruto actualizado (tope 15 UTA) y NO permiten rebajar cotizaciones aparte (Circular SII 21/1991);
 *   gastos efectivos SI permiten rebajar cotizaciones pagadas (Circular SII 53/2020).
 * - Tabla IGC Art. 52 LIR en UTA (Circular SII N°5/2026); UTA ref. nov-2026 $869.280 (AT 2027 provisorio) o UTA dic-2025 $834.504 (AT 2026).
 */
(function (root, doc) {
    'use strict';

    var IMM_ANUAL_5_REF = 5 * 553553; // $2.767.765 ref. 2026
    var UF_REF = 41439.89;
    var UTA_POR_AT = {
        2026: 834504, // dic-2025 SII Circular 5/2026
        2027: 869280  // ref. nov-2026 Previred (provisorio hasta dic-2026)
    };
    var COBERTURA_PARCIAL_POR_AT = {
        2026: 0.80,
        2027: 0.90,
        2028: 1.00
    };
    var TRAMOS_IGC = [
        [13.5, 0, 0],
        [30, 0.04, 0.54],
        [50, 0.08, 1.74],
        [70, 0.135, 4.49],
        [90, 0.23, 11.14],
        [120, 0.304, 17.80],
        [310, 0.35, 23.32],
        [Infinity, 0.40, 38.82]
    ];

    function entero(v) { return Math.max(0, Math.round(Number(v) || 0)); }

    function calcularIgc(baseClp, utaClp) {
        if (baseClp <= 0 || utaClp <= 0) return { impuesto: 0, tramo: 1, tasaMarginal: 0 };
        var utas = baseClp / utaClp;
        for (var i = 0; i < TRAMOS_IGC.length; i++) {
            if (utas <= TRAMOS_IGC[i][0]) {
                var imp = Math.max(0, Math.round(baseClp * TRAMOS_IGC[i][1] - TRAMOS_IGC[i][2] * utaClp));
                return { impuesto: imp, tramo: i + 1, tasaMarginal: TRAMOS_IGC[i][1] };
            }
        }
        return { impuesto: 0, tramo: 1, tasaMarginal: 0 };
    }

    function simularRentaAnual(datos) {
        var d = datos || {};
        var anioCom = Math.round(Number(d.anioComercial) || 2026);
        var at = anioCom + 1;
        var uta = UTA_POR_AT[at] || 869280;
        var tasaRetAnio = anioCom === 2025 ? 0.145 : (anioCom === 2026 ? 0.1525 : (anioCom === 2027 ? 0.16 : 0.17));

        var brutoConRet = entero(d.brutoConRetencion);
        var brutoSinRet = entero(d.brutoSinRetencion);
        var brutoTotal = brutoConRet + brutoSinRet;
        var retencionesBhe = d.retencionesReales != null ? entero(d.retencionesReales) : Math.round(brutoConRet * tasaRetAnio);
        var ppmPagados = entero(d.ppmPagados);
        var sueldosImponibleDep = entero(d.sueldosImponibleDependiente);
        var sueldosRentaNetaDep = entero(d.sueldosRentaNetaDependiente);
        var iuscDependiente = entero(d.impuestoUnicoDependiente);

        // 1. Cotizaciones obligatorias Ley 21.133 (Arts. 89-92 DL 3.500)
        var exentoPrevisional = !!d.exentoPrevisional || brutoTotal < IMM_ANUAL_5_REF;
        var motivoExencion = '';
        if (d.exentoPrevisional) motivoExencion = 'Marcada exención legal (edad al 01-01-2018, pensionado o régimen especial).';
        else if (brutoTotal > 0 && brutoTotal < IMM_ANUAL_5_REF) motivoExencion = 'Honorarios anuales bajo 5 IMM ($2.767.765 ref.): exento de cotización obligatoria.';

        var topeAnual = Math.round(12 * 90 * UF_REF);
        var cupoRestante = Math.max(0, topeAnual - sueldosImponibleDep);
        var baseImponibleCot = exentoPrevisional ? 0 : Math.min(Math.round(brutoTotal * 0.80), cupoRestante);

        var coberturaSaludAfp = d.cobertura === 'total' ? 1 : (COBERTURA_PARCIAL_POR_AT[at] || 0.90);
        var tasaSis = Number(d.tasaSis) || 0.0179;
        var tasaAtep = Number(d.tasaAtep) || 0.0093;
        var tasaAfp = Number(d.tasaAfp) || 0.1058; // 10% + comision Modelo ref.
        var tasaSalud = 0.07;

        // Orden prelación Art. 92 DL 3.500: SIS (100% base) -> ATEP/SANNA (100% base) -> Salud -> AFP
        var cotSis = Math.round(baseImponibleCot * tasaSis);
        var cotAtep = Math.round(baseImponibleCot * tasaAtep);
        var cotSalud = Math.round(baseImponibleCot * tasaSalud * coberturaSaludAfp);
        var cotAfp = Math.round(baseImponibleCot * tasaAfp * coberturaSaludAfp);
        var totalCotizaciones = cotSis + cotAtep + cotSalud + cotAfp;

        // 2. Base Imponible IGC (Art. 50 LIR)
        var tipoGastos = d.tipoGastos === 'efectivos' ? 'efectivos' : 'presuntos';
        var gastosPresuntos = Math.min(Math.round(brutoTotal * 0.30), Math.round(15 * uta));
        var gastosEfectivos = entero(d.gastosEfectivos);
        // Regla crítica Circular SII 21/1991: con gastos presuntos NO se rebajan cotizaciones aparte
        var deduccionGastos = tipoGastos === 'efectivos' ? (gastosEfectivos + totalCotizaciones) : gastosPresuntos;
        var rentaNetaHonorarios = Math.max(0, brutoTotal - deduccionGastos);
        var baseIgc = rentaNetaHonorarios + sueldosRentaNetaDep;

        var igc = calcularIgc(baseIgc, uta);
        var creditosDisponibles = retencionesBhe + ppmPagados + iuscDependiente;
        var totalCargos = igc.impuesto + totalCotizaciones;
        var saldoFinal = creditosDisponibles - totalCargos; // >0 devolucion, <0 a pagar

        return {
            anioComercial: anioCom,
            anioTributario: at,
            uta: uta,
            brutoTotal: brutoTotal,
            retencionesBhe: retencionesBhe,
            ppmPagados: ppmPagados,
            ppmFaltanteTeorico: Math.max(0, Math.round(brutoSinRet * tasaRetAnio) - ppmPagados),
            exentoPrevisional: exentoPrevisional,
            motivoExencion: motivoExencion,
            baseImponibleCot: baseImponibleCot,
            coberturaSaludAfpPct: Math.round(coberturaSaludAfp * 100),
            cotizaciones: { sis: cotSis, atep: cotAtep, salud: cotSalud, afp: cotAfp, total: totalCotizaciones },
            tipoGastos: tipoGastos,
            deduccionGastos: deduccionGastos,
            rentaNetaHonorarios: rentaNetaHonorarios,
            baseIgc: baseIgc,
            igc: igc,
            creditosDisponibles: creditosDisponibles,
            totalCargos: totalCargos,
            saldoFinal: saldoFinal,
            esDevolucion: saldoFinal >= 0
        };
    }

    if (typeof window === 'undefined' || !doc || !doc.addEventListener) {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = { simularRentaAnual: simularRentaAnual, calcularIgc: calcularIgc };
        }
        return;
    }

    function pesos(n) {
        var v = Math.round(Number(n) || 0);
        return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL');
    }

    function leerArchivoBhe(file) {
        if (!file || !root.CLImportadores) return;
        var periodo = (doc.getElementById('rev-anio-comercial').value || '2026') + '-11';
        var procesarTexto = function (txt) {
            var res = root.CLImportadores.parsearBheSii(txt, { periodo: periodo });
            if (!res || !res.ok) {
                alert((res && res.error) || 'No reconocimos boletas válidas en ese archivo BHE.');
                return;
            }
            doc.getElementById('rev-bruto-ret').value = String(res.totalBruto);
            doc.getElementById('rev-ret-real').value = String(res.totalRetenido);
            var st = doc.getElementById('rev-bhe-status');
            if (st) st.textContent = 'Archivo BHE cargado: ' + res.boletas.length + ' boletas vigentes (' + res.anuladasOmitidas + ' anuladas omitidas). Bruto: ' + pesos(res.totalBruto) + ' · Retenido: ' + pesos(res.totalRetenido) + '.';
            actualizarUI();
        };
        if (/\.(xlsx|xls)$/i.test(file.name) && root.CLPymeExcel) {
            file.arrayBuffer().then(function (buf) {
                return root.CLPymeExcel.asegurarXlsx().then(function (XLSX) {
                    var filas = root.CLPymeExcel.filasDesdeBuffer(buf, XLSX);
                    var csv = filas.map(function (r) { return r.join(';'); }).join('\n');
                    procesarTexto(csv);
                });
            });
        } else {
            var rd = new FileReader();
            rd.onload = function () { procesarTexto(String(rd.result || '')); };
            rd.readAsText(file, 'ISO-8859-1');
        }
    }

    function actualizarUI() {
        var elAnio = doc.getElementById('rev-anio-comercial');
        if (!elAnio) return;
        var retRealRaw = doc.getElementById('rev-ret-real').value;
        var tipoGastos = doc.getElementById('rev-gastos').value;
        var wrapEfec = doc.getElementById('wrap-rev-gastos-efectivos');
        if (wrapEfec) wrapEfec.classList.toggle('hidden', tipoGastos !== 'efectivos');

        var r = simularRentaAnual({
            anioComercial: elAnio.value,
            brutoConRetencion: doc.getElementById('rev-bruto-ret').value,
            brutoSinRetencion: doc.getElementById('rev-bruto-sin').value,
            retencionesReales: retRealRaw !== '' ? retRealRaw : null,
            ppmPagados: doc.getElementById('rev-ppm').value,
            sueldosImponibleDependiente: doc.getElementById('rev-sueldos-dep').value,
            sueldosRentaNetaDependiente: doc.getElementById('rev-sueldos-dep').value,
            tipoGastos: tipoGastos,
            gastosEfectivos: doc.getElementById('rev-gastos-efectivos').value,
            cobertura: doc.getElementById('rev-cobertura').value,
            exentoPrevisional: doc.getElementById('rev-exento').checked
        });

        var set = function (id, txt) { var el = doc.getElementById(id); if (el) el.textContent = txt; };
        set('rev-kpi-titulo', r.esDevolucion ? ('Devolución estimada F22 (AT ' + r.anioTributario + ')') : ('Diferencia estimada a pagar F22 (AT ' + r.anioTributario + ')'));
        set('rev-kpi-saldo', pesos(Math.abs(r.saldoFinal)));
        set('rev-kpi-cot', pesos(r.cotizaciones.total));
        set('rev-kpi-igc', pesos(r.igc.impuesto));
        set('rev-kpi-cred', pesos(r.creditosDisponibles));
        set('rev-det-sis', pesos(r.cotizaciones.sis));
        set('rev-det-atep', pesos(r.cotizaciones.atep));
        set('rev-det-salud', pesos(r.cotizaciones.salud));
        set('rev-det-afp', pesos(r.cotizaciones.afp));
        set('rev-det-base-igc', pesos(r.baseIgc));

        var aviso = doc.getElementById('rev-aviso-normativo');
        if (aviso) {
            aviso.textContent = 'AT ' + r.anioTributario + ' (año comercial ' + r.anioComercial + '): cobertura Salud/AFP ' + r.coberturaSaludAfpPct + '% sobre base imponible ' + pesos(r.baseImponibleCot) + ' (SIS y ATEP/SANNA sobre base íntegra). ' +
                (r.tipoGastos === 'presuntos' ? 'Con gastos presuntos (30%, tope 15 UTA) no se rebajan cotizaciones aparte del IGC (Art. 50 LIR).' : 'Con gastos efectivos sí rebajas cotizaciones pagadas.') +
                (r.anioComercial >= 2026 ? ' Simulación referencial sujeta a UTA dic-' + r.anioComercial + ' y factores IPC SII.' : '');
        }
    }

    doc.addEventListener('DOMContentLoaded', function () {
        if (!doc.getElementById('rev-anio-comercial')) return;
        ['rev-anio-comercial', 'rev-bruto-ret', 'rev-bruto-sin', 'rev-ret-real', 'rev-ppm', 'rev-sueldos-dep', 'rev-gastos', 'rev-gastos-efectivos', 'rev-cobertura', 'rev-exento'].forEach(function (id) {
            var el = doc.getElementById(id);
            if (el) {
                el.addEventListener('input', actualizarUI);
                el.addEventListener('change', actualizarUI);
            }
        });
        var fEl = doc.getElementById('rev-file-bhe');
        if (fEl) {
            fEl.addEventListener('change', function () {
                if (fEl.files && fEl.files[0]) leerArchivoBhe(fEl.files[0]);
            });
        }
        var btnEj = doc.getElementById('btn-rev-ejemplo');
        if (btnEj) {
            btnEj.addEventListener('click', function () {
                doc.getElementById('rev-bruto-ret').value = '14400000';
                doc.getElementById('rev-bruto-sin').value = '1200000';
                doc.getElementById('rev-ret-real').value = '';
                doc.getElementById('rev-ppm').value = '183000';
                doc.getElementById('rev-sueldos-dep').value = '0';
                doc.getElementById('rev-gastos').value = 'presuntos';
                doc.getElementById('rev-cobertura').value = 'parcial';
                doc.getElementById('rev-exento').checked = false;
                actualizarUI();
            });
        }
        actualizarUI();
    });
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
