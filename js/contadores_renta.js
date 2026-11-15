/*
 * CalculoLaboral · Motor Operacion Renta y DDJJ AT 2026 (v1.0.0)
 * Cubre: DJ 1887 + Certificado N°6 (col 7 Exenta / col 8 No Gravada invertidas vs DJ 1887 C6/C7),
 * DJ 1879 + Certificado N°1 (retencion BHE real segun tasa Ley 21.133, sin tasa fija 13%),
 * DJ 1947 (14 D8), DJ 1948 (14 D3 / 14 A) y CPT Simplificado (Circular SII 62/2020).
 * Bloqueo explicito para AT 2027 hasta publicacion de resoluciones SII.
 * Funciona en navegador (window.CLRenta) y Node (require).
 */
(function (root) {
    'use strict';

    var ANIO_TRIBUTARIO_MAXIMO = 2026;

    function entero(v) { return Math.max(0, Math.round(Number(v) || 0)); }
    function enteroConSigno(v) { return Math.round(Number(v) || 0); }

    function limpiarRut(rut) {
        return String(rut == null ? '' : rut).replace(/[^0-9kK]/g, '').toUpperCase();
    }

    function formatearRut(rut) {
        var clean = limpiarRut(rut);
        if (clean.length < 2) return String(rut || '').trim();
        var body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return body + '-' + clean.slice(-1);
    }

    function validarAnioTributario(anioTributario) {
        var anio = Math.round(Number(anioTributario) || ANIO_TRIBUTARIO_MAXIMO);
        if (anio > ANIO_TRIBUTARIO_MAXIMO) {
            return {
                ok: false,
                bloqueado: true,
                anioTributario: anio,
                motivo: 'AT ' + anio + ' esta bloqueado hasta que el SII publique las resoluciones de DDJJ, suplemento normativo y factores de actualizacion IPC.'
            };
        }
        return { ok: true, bloqueado: false, anioTributario: anio };
    }

    function acumularLiquidacionesParaDj1887(resultados, opciones) {
        var opts = opciones || {};
        var porRut = {};

        (resultados || []).forEach(function (item) {
            if (!item || item.error) return;
            var det = item.detalle || null;
            var trab = item.trabajador || item.fila || item;
            var rutRaw = trab.rut || item.rut || '';
            var rutClean = limpiarRut(rutRaw);
            if (!rutClean) return;
            var rutFmt = formatearRut(rutRaw);
            var nombre = String(trab.nombre || item.nombre || 'Trabajador').trim();

            // Renta Total Neta Pagada (Art. 42 N°1): Imponible menos cotizaciones legales (AFP, Salud hasta 7%, AFC).
            // Nunca usar sueldo bruto como renta neta de DJ 1887.
            var rentaNeta = 0;
            var sueldoImponible = 0;
            var cotizacionesLegales = 0;
            var impuestoUnico = 0;
            var noGravada = 0;
            var exenta = entero(item.rentaExenta != null ? item.rentaExenta : (trab.rentaExenta || 0));
            var zonasExtremas = entero(item.rebajaZonasExtremas != null ? item.rebajaZonasExtremas : (trab.rebajaZonasExtremas || 0));
            var mayorRetencion = entero(item.mayorRetencion != null ? item.mayorRetencion : 0);

            if (det && det.bases) {
                sueldoImponible = entero(det.totalImponible);
                var montos = det.montos || {};
                var rebajaSalud = det.bases.rebajaSalud != null ? entero(det.bases.rebajaSalud) : entero(montos.salud);
                cotizacionesLegales = entero(montos.afp) + rebajaSalud + entero(montos.afc);
                rentaNeta = det.bases.baseTributable != null
                    ? entero(det.bases.baseTributable)
                    : Math.max(0, sueldoImponible - cotizacionesLegales);
                impuestoUnico = entero(montos.impuesto);
                noGravada = item.rentaNoGravada != null ? entero(item.rentaNoGravada) : entero(det.totalNoImponible);
            } else {
                sueldoImponible = entero(item.sueldoImponible != null ? item.sueldoImponible : (item.imponible != null ? item.imponible : item.bruto));
                var afp = entero(item.afp);
                var salud = entero(item.saludLegal != null ? item.saludLegal : item.salud);
                var afc = entero(item.afc);
                cotizacionesLegales = entero(item.cotizacionesPrevisionales) || (afp + salud + afc);
                rentaNeta = item.rentaNeta != null
                    ? entero(item.rentaNeta)
                    : Math.max(0, sueldoImponible - cotizacionesLegales);
                impuestoUnico = entero(item.impuestoUnico != null ? item.impuestoUnico : item.impuesto);
                noGravada = entero(item.rentaNoGravada != null ? item.rentaNoGravada : (item.noGravada != null ? item.noGravada : item.noImponible));
            }

            if (!porRut[rutClean]) {
                porRut[rutClean] = {
                    rut: rutFmt,
                    nombre: nombre,
                    sueldoImponible: 0,
                    cotizacionesPrevisionales: 0,
                    rentaNeta: 0,
                    impuestoUnico: 0,
                    mayorRetencion: 0,
                    rentaNoGravada: 0,
                    rentaExenta: 0,
                    rebajaZonasExtremas: 0,
                    prestamoLey21252: 0,
                    mesesCantidad: 0,
                    factorActualizacion: Number(opts.factorActualizacion || item.factorActualizacion || 1) || 1
                };
            }
            var acc = porRut[rutClean];
            acc.sueldoImponible += sueldoImponible;
            acc.cotizacionesPrevisionales += cotizacionesLegales;
            acc.rentaNeta += rentaNeta;
            acc.impuestoUnico += impuestoUnico;
            acc.mayorRetencion += mayorRetencion;
            acc.rentaNoGravada += noGravada;
            acc.rentaExenta += exenta;
            acc.rebajaZonasExtremas += zonasExtremas;
            acc.prestamoLey21252 += entero(item.prestamoLey21252);
            acc.mesesCantidad += 1;
        });

        return Object.keys(porRut).sort().map(function (k) { return porRut[k]; });
    }

    function generarDj1887(registros, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }

        var filas = [];
        var certificadosN6 = [];
        var totales = {
            trabajadores: 0,
            rentaNeta: 0,
            impuestoUnico: 0,
            mayorRetencion: 0,
            rentaNoGravada: 0,
            rentaExenta: 0,
            rebajaZonasExtremas: 0,
            prestamoLey21252: 0
        };

        (registros || []).forEach(function (r) {
            var rutFmt = formatearRut(r.rut);
            if (!limpiarRut(rutFmt)) return;
            var factor = Number(r.factorActualizacion || opts.factorActualizacion || 1) || 1;
            var sueldoImponible = entero(r.sueldoImponible);
            var cotPrev = entero(r.cotizacionesPrevisionales);
            var rentaNeta = r.rentaNeta != null
                ? entero(r.rentaNeta)
                : Math.max(0, sueldoImponible - cotPrev);
            var impuesto = entero(r.impuestoUnico);
            var mayorRet = entero(r.mayorRetencion);
            var noGravada = entero(r.rentaNoGravada);
            var exenta = entero(r.rentaExenta);
            var zonasExt = entero(r.rebajaZonasExtremas);
            var prestamo = entero(r.prestamoLey21252);

            var rentaNetaAct = Math.round(rentaNeta * factor);
            var impAct = Math.round(impuesto * factor);
            var mayorRetAct = Math.round(mayorRet * factor);
            var noGravAct = Math.round(noGravada * factor);
            var exentaAct = Math.round(exenta * factor);
            var zonasAct = Math.round(zonasExt * factor);

            // Estructura DJ 1887 SII: C6 = Renta No Gravada, C7 = Renta Exenta
            filas.push({
                C2_rut: rutFmt,
                nombre: String(r.nombre || 'Trabajador').trim(),
                C3_rentaNeta: rentaNetaAct,
                C4_impuestoUnico: impAct,
                C5_mayorRetencion: mayorRetAct,
                C6_rentaNoGravada: noGravAct,
                C7_rentaExenta: exentaAct,
                C8_rebajaZonasExtremas: zonasAct,
                C33_prestamoLey21252: prestamo,
                sueldoImponibleBase: sueldoImponible,
                cotizacionesBase: cotPrev
            });

            // Certificado N°6 (16 columnas SII): col (7) = Renta Exenta, col (8) = Renta No Gravada (INVERTIDAS respecto a DJ 1887 C6/C7)
            certificadosN6.push({
                rut: rutFmt,
                nombre: String(r.nombre || 'Trabajador').trim(),
                anioTributario: vAt.anioTributario,
                col1_meses: r.mesesCantidad || 12,
                col2_sueldoImponible: sueldoImponible,
                col3_cotizacionesPrevisionales: cotPrev,
                col4_rentaNeta: rentaNeta,
                col5_impuestoUnico: impuesto,
                col6_mayorRetencion: mayorRet,
                col7_rentaExenta: exenta,
                col8_rentaNoGravada: noGravada,
                col9_rebajaZonasExtremas: zonasExt,
                col10_factorActualizacion: factor,
                col11_rentaNetaActualizada: rentaNetaAct,
                col12_impuestoActualizado: impAct,
                col13_mayorRetencionActualizada: mayorRetAct,
                col14_rentaExentaActualizada: exentaAct,
                col15_rentaNoGravadaActualizada: noGravAct,
                col16_rebajaZonasExtremasActualizada: zonasAct
            });

            totales.trabajadores += 1;
            totales.rentaNeta += rentaNetaAct;
            totales.impuestoUnico += impAct;
            totales.mayorRetencion += mayorRetAct;
            totales.rentaNoGravada += noGravAct;
            totales.rentaExenta += exentaAct;
            totales.rebajaZonasExtremas += zonasAct;
            totales.prestamoLey21252 += prestamo;
        });

        var lineasCsv = ['RUT Trabajador (C2);Nombre;Renta Total Neta Pagada (C3);Impuesto Unico Retenido (C4);Mayor Retencion (C5);Renta Total No Gravada (C6);Renta Total Exenta (C7);Rebaja Zonas Extremas (C8);Prestamo Ley 21252 (C33)'];
        filas.forEach(function (f) {
            lineasCsv.push([
                f.C2_rut,
                f.nombre.replace(/;/g, ' '),
                f.C3_rentaNeta,
                f.C4_impuestoUnico,
                f.C5_mayorRetencion,
                f.C6_rentaNoGravada,
                f.C7_rentaExenta,
                f.C8_rebajaZonasExtremas,
                f.C33_prestamoLey21252
            ].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1887',
            anioTributario: vAt.anioTributario,
            certificadoN6ColumnasInvertidas: true,
            notaColumnas: 'Certificado N°6 SII ubica (7) Renta Exenta y (8) Renta No Gravada invertidas frente a DJ 1887 C6 (No Gravada) y C7 (Exenta).',
            filas: filas,
            certificadosN6: certificadosN6,
            totales: totales,
            csv: lineasCsv.join('\n')
        };
    }

    function generarDj1879(boletas, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }

        var porRut = {};
        var anuladasIgnoradas = 0;

        (boletas || []).forEach(function (b) {
            if (!b) return;
            if (/ANULAD/i.test(String(b.estado || ''))) {
                anuladasIgnoradas++;
                return;
            }
            var rutClean = limpiarRut(b.rut);
            if (!rutClean) return;
            var rutFmt = formatearRut(b.rut);
            var bruto = entero(b.bruto);
            // DJ 1879 siempre acumula la retencion real practicada (15,25% en 2026), nunca una tasa fija 13%
            var retenido = entero(b.retenido);
            if (!bruto && !retenido) return;
            var factor = Number(b.factorActualizacion || opts.factorActualizacion || 1) || 1;

            if (!porRut[rutClean]) {
                porRut[rutClean] = {
                    rut: rutFmt,
                    razonSocial: String(b.razonSocial || 'Prestador de servicios').trim(),
                    cantidadBoletas: 0,
                    brutoTotal: 0,
                    retenidoTotal: 0,
                    brutoActualizado: 0,
                    retenidoActualizado: 0,
                    tasaPromedioPct: 0
                };
            }
            var acc = porRut[rutClean];
            acc.cantidadBoletas += 1;
            acc.brutoTotal += bruto;
            acc.retenidoTotal += retenido;
            acc.brutoActualizado += Math.round(bruto * factor);
            acc.retenidoActualizado += Math.round(retenido * factor);
            acc.tasaPromedioPct = acc.brutoTotal > 0 ? Math.round((acc.retenidoTotal / acc.brutoTotal) * 10000) / 100 : 0;
        });

        var filas = Object.keys(porRut).sort().map(function (k) { return porRut[k]; });
        var certificadosN1 = filas.map(function (f) {
            return {
                rutPrestador: f.rut,
                nombrePrestador: f.razonSocial,
                anioTributario: vAt.anioTributario,
                cantidadBoletas: f.cantidadBoletas,
                honorariosBrutos: f.brutoTotal,
                impuestoRetenido: f.retenidoTotal,
                honorariosActualizados: f.brutoActualizado,
                retencionActualizada: f.retenidoActualizado,
                tasaPromedioPct: f.tasaPromedioPct
            };
        });

        var totales = filas.reduce(function (s, f) {
            s.prestadores += 1;
            s.boletas += f.cantidadBoletas;
            s.brutoTotal += f.brutoTotal;
            s.retenidoTotal += f.retenidoTotal;
            s.retenidoActualizado += f.retenidoActualizado;
            return s;
        }, { prestadores: 0, boletas: 0, brutoTotal: 0, retenidoTotal: 0, retenidoActualizado: 0 });

        var lineasCsv = ['RUT Prestador;Nombre o Razon Social;Cantidad BHE;Honorarios Brutos;Retencion Real Practicada;Tasa Efectiva %;Honorarios Actualizados;Retencion Actualizada'];
        filas.forEach(function (f) {
            lineasCsv.push([
                f.rut,
                f.razonSocial.replace(/;/g, ' '),
                f.cantidadBoletas,
                f.brutoTotal,
                f.retenidoTotal,
                f.tasaPromedioPct,
                f.brutoActualizado,
                f.retenidoActualizado
            ].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1879',
            anioTributario: vAt.anioTributario,
            anuladasIgnoradas: anuladasIgnoradas,
            notaNormativa: 'Acumula la retencion efectivamente practicada en cada BHE (15,25% en 2026 segun Ley 21.133). No usa tasa historica del 13%.',
            filas: filas,
            certificadosN1: certificadosN1,
            totales: totales,
            csv: lineasCsv.join('\n')
        };
    }

    function generarDj1947o1948(regimen, datos, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }

        var d = datos || {};
        var regNorm = String(regimen || '14D3').toUpperCase();
        var socios = Array.isArray(d.socios) && d.socios.length
            ? d.socios
            : [{ rut: '12.345.678-5', nombre: 'Socio titular', porcentaje: 100, retiros: entero(d.retirosTotales) }];

        if (/^14D8/.test(regNorm)) {
            var baseImponible = enteroConSigno(d.baseImponible != null ? d.baseImponible : 0);
            var ppmDisponible = entero(d.ppmDisponible);
            var filas1947 = socios.map(function (s) {
                var pct = Number(s.porcentaje || 0);
                var asignado = Math.round(baseImponible * (pct / 100));
                var creditoPpm = Math.round(ppmDisponible * (pct / 100));
                return {
                    rutSocio: formatearRut(s.rut),
                    nombreSocio: String(s.nombre || 'Socio').trim(),
                    porcentajeParticipacion: pct,
                    baseImponibleAsignada: asignado,
                    creditoPpmAsignado: creditoPpm,
                    gastoRechazadoAsignado: Math.round(entero(d.gastosRechazados) * (pct / 100))
                };
            });
            var csv1947 = ['RUT Propietario;Nombre;Porcentaje %;Base Imponible 14 D8 Asignada;Credito PPM Asignado;Gastos Rechazados Asignados'];
            filas1947.forEach(function (f) {
                csv1947.push([f.rutSocio, f.nombreSocio.replace(/;/g, ' '), f.porcentajeParticipacion, f.baseImponibleAsignada, f.creditoPpmAsignado, f.gastoRechazadoAsignado].join(';'));
            });
            return {
                ok: true,
                codigoDj: '1947',
                regimen: regNorm,
                anioTributario: vAt.anioTributario,
                baseImponibleTotal: baseImponible,
                ppmDisponibleTotal: ppmDisponible,
                filas: filas1947,
                csv: csv1947.join('\n')
            };
        }

        // 14 D3 o 14 A -> DJ 1948 (Retiros, Remesas y/o Dividendos distribuidos)
        var es14A = /^14A/.test(regNorm);
        var tasaIdpc = Number(d.tasaIdpc != null ? d.tasaIdpc : (es14A ? 27 : 12.5));
        var filas1948 = socios.map(function (s) {
            var pct = Number(s.porcentaje || 0);
            var retiro = s.retiros != null ? entero(s.retiros) : Math.round(entero(d.retirosTotales) * (pct / 100));
            var factor = tasaIdpc > 0 && tasaIdpc < 100 ? (tasaIdpc / (100 - tasaIdpc)) : 0;
            var creditoBruto = Math.round(retiro * factor);
            // En 14 A (Semi-integrado) opera restitucion del 35% (credito usable 65%)
            var creditoFinal = es14A ? Math.round(creditoBruto * 0.65) : creditoBruto;
            return {
                rutSocio: formatearRut(s.rut),
                nombreSocio: String(s.nombre || 'Socio').trim(),
                porcentajeParticipacion: pct,
                montoRetiroODividendo: retiro,
                tasaIdpcPct: tasaIdpc,
                factorCredito: Math.round(factor * 1000000) / 1000000,
                creditoIdpc: creditoFinal,
                sujetoRestitucion14A: es14A
            };
        });

        var totalRetiros = filas1948.reduce(function (acc, f) { return acc + f.montoRetiroODividendo; }, 0);
        var totalCredito = filas1948.reduce(function (acc, f) { return acc + f.creditoIdpc; }, 0);
        var csv1948 = ['RUT Propietario;Nombre;Retiro o Dividendo;Tasa IDPC %;Factor;Credito IDPC;Sujeto Restitucion 14A'];
        filas1948.forEach(function (f) {
            csv1948.push([f.rutSocio, f.nombreSocio.replace(/;/g, ' '), f.montoRetiroODividendo, f.tasaIdpcPct, f.factorCredito, f.creditoIdpc, f.sujetoRestitucion14A ? 'SI' : 'NO'].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1948',
            regimen: regNorm,
            anioTributario: vAt.anioTributario,
            tasaIdpcPct: tasaIdpc,
            totalRetiros: totalRetiros,
            totalCreditoIdpc: totalCredito,
            filas: filas1948,
            csv: csv1948.join('\n')
        };
    }

    /*
     * Capital Propio Tributario Simplificado (Art. 14 D N°3 / N°8, Circular SII N°62 de 2020):
     * CPT Cierre = CPT Anterior + Aumentos Capital + Base Imponible (RLI) + INR/Rentas Exentas
     *              - Disminuciones Capital - Retiros/Dividendos - Gastos Rechazados no Art.21 - IDPC pagado.
     */
    function calcularCptSimplificado(datos) {
        var d = datos || {};
        var cptAnterior = enteroConSigno(d.cptAnterior);
        var aumentosCapital = entero(d.aumentosCapital);
        var baseImponibleRli = enteroConSigno(d.baseImponibleRli);
        var rentasExentasInr = entero(d.rentasExentasInr);
        var disminucionesCapital = entero(d.disminucionesCapital);
        var retirosDividendos = entero(d.retirosDividendos);
        var gastosRechazados = entero(d.gastosRechazados);
        var idpcPagado = entero(d.idpcPagado);

        var cptFinal = cptAnterior
            + aumentosCapital
            + baseImponibleRli
            + rentasExentasInr
            - disminucionesCapital
            - retirosDividendos
            - gastosRechazados
            - idpcPagado;

        var capitalAportado = entero(d.capitalAportadoReajustado);
        var saldoRex = entero(d.saldoRex);
        var raiEstimado = Math.max(0, cptFinal + retirosDividendos - capitalAportado - saldoRex);

        return {
            norma: 'Circular SII 62/2020',
            componentes: {
                cptAnterior: cptAnterior,
                aumentosCapital: aumentosCapital,
                baseImponibleRli: baseImponibleRli,
                rentasExentasInr: rentasExentasInr,
                disminucionesCapital: disminucionesCapital,
                retirosDividendos: retirosDividendos,
                gastosRechazados: gastosRechazados,
                idpcPagado: idpcPagado
            },
            cptFinal: cptFinal,
            capitalAportadoReajustado: capitalAportado,
            raiEstimado: raiEstimado
        };
    }

    var api = {
        ANIO_TRIBUTARIO_MAXIMO: ANIO_TRIBUTARIO_MAXIMO,
        validarAnioTributario: validarAnioTributario,
        acumularLiquidacionesParaDj1887: acumularLiquidacionesParaDj1887,
        generarDj1887: generarDj1887,
        generarDj1879: generarDj1879,
        generarDj1947o1948: generarDj1947o1948,
        calcularCptSimplificado: calcularCptSimplificado,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLRenta = api;
})(typeof window !== 'undefined' ? window : this);
