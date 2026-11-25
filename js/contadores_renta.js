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

    function validarAnioTributario(anioTributario, opciones) {
        var opts = opciones || {};
        var anio = Math.round(Number(anioTributario) || ANIO_TRIBUTARIO_MAXIMO);
        if (anio > ANIO_TRIBUTARIO_MAXIMO) {
            if (opts.modoBorrador === true && anio <= ANIO_TRIBUTARIO_MAXIMO + 1) {
                return {
                    ok: true,
                    bloqueado: false,
                    esProvisorio: true,
                    ipcOficialDisponible: false,
                    anioTributario: anio,
                    avisoProvisorio: 'Borrador AT ' + anio + ' segun Res. Ex. SII N° 116: los factores de correccion monetaria (IPC) se publican en enero ' + anio + '; las cifras actuales son preliminares.'
                };
            }
            return {
                ok: false,
                bloqueado: true,
                anioTributario: anio,
                motivo: 'AT ' + anio + ' esta bloqueado hasta que el SII publique las resoluciones de DDJJ, suplemento normativo y factores de actualizacion IPC.'
            };
        }
        return { ok: true, bloqueado: false, esProvisorio: false, ipcOficialDisponible: true, anioTributario: anio };
    }

    function acumularLiquidacionesParaDj1887(resultados, opciones) {
        var opts = opciones || {};
        var porRut = {};

        (resultados || []).forEach(function (item) {
            if (!item || item.error) return;
            var det = item.detalle || null;
            var trab = item.trabajador || item.record || item.fila || item;
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
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }

        var incluyeC61 = vAt.anioTributario <= 2026;
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
            var prestamo = incluyeC61 ? entero(r.prestamoLey21252) : 0;

            var rentaNetaAct = Math.round(rentaNeta * factor);
            var impAct = Math.round(impuesto * factor);
            var mayorRetAct = Math.round(mayorRet * factor);
            var noGravAct = Math.round(noGravada * factor);
            var exentaAct = Math.round(exenta * factor);
            var zonasAct = Math.round(zonasExt * factor);

            // Estructura DJ 1887 SII (Res. Ex. 104 AT 2026 / Res. Ex. 116 AT 2027):
            // C8 = Renta No Gravada, C33 = Renta Exenta, C9 = Rebaja Zonas Extremas.
            // Se mantienen C6_rentaNoGravada y C7_rentaExenta solo como alias internos de compatibilidad para suites previas.
            var filaDj = {
                C2_rut: rutFmt,
                nombre: String(r.nombre || 'Trabajador').trim(),
                C3_rentaNeta: rentaNetaAct,
                C4_impuestoUnico: impAct,
                C5_mayorRetencion: mayorRetAct,
                C8_rentaNoGravada: noGravAct,
                C33_rentaExenta: exentaAct,
                C9_rebajaZonasExtremas: zonasAct,
                C6_rentaNoGravada: noGravAct,
                C7_rentaExenta: exentaAct,
                sueldoImponibleBase: sueldoImponible,
                cotizacionesBase: cotPrev
            };
            if (incluyeC61) {
                filaDj.C61_prestamoLey21252 = prestamo;
                filaDj.C33_prestamoLey21252 = prestamo;
            }
            filas.push(filaDj);

            // Certificado N°6 (16 columnas SII): col (7) = Renta Exenta, col (8) = Renta No Gravada
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

        var lineasCsv = [
            incluyeC61
                ? 'RUT Trabajador (C2);Nombre;Renta Total Neta Pagada (C3);Impuesto Unico Retenido (C4);Mayor Retencion (C5);Renta Total No Gravada (C8);Renta Total Exenta (C33);Rebaja Zonas Extremas (C9);Prestamo Ley 21252 (C61)'
                : 'RUT Trabajador (C2);Nombre;Renta Total Neta Pagada (C3);Impuesto Unico Retenido (C4);Mayor Retencion (C5);Renta Total No Gravada (C8);Renta Total Exenta (C33);Rebaja Zonas Extremas (C9)'
        ];
        filas.forEach(function (f) {
            var cols = [
                f.C2_rut,
                f.nombre.replace(/;/g, ' '),
                f.C3_rentaNeta,
                f.C4_impuestoUnico,
                f.C5_mayorRetencion,
                f.C8_rentaNoGravada,
                f.C33_rentaExenta,
                f.C9_rebajaZonasExtremas
            ];
            if (incluyeC61) cols.push(f.C61_prestamoLey21252 || 0);
            lineasCsv.push(cols.join(';'));
        });

        return {
            ok: true,
            codigoDj: '1887',
            anioTributario: vAt.anioTributario,
            esProvisorio: !!vAt.esProvisorio,
            ipcOficialDisponible: vAt.esProvisorio ? false : true,
            avisoProvisorio: vAt.avisoProvisorio || '',
            incluyeC61: incluyeC61,
            certificadoN6ColumnasInvertidas: true,
            notaColumnas: 'Certificado N°6 SII ubica (7) Renta Exenta y (8) Renta No Gravada frente a DJ 1887 C8 (No Gravada), C33 (Exenta) y C9 (Zonas Extremas).' + (incluyeC61 ? '' : ' En AT 2027 (Res. Ex. 116) se eliminan C61, C64 y C65.'),
            filas: filas,
            certificadosN6: certificadosN6,
            totales: totales,
            csv: lineasCsv.join('\n')
        };
    }

    function generarDj1879(boletas, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
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
            s.brutoActualizado += f.brutoActualizado;
            s.retenidoActualizado += f.retenidoActualizado;
            return s;
        }, { prestadores: 0, boletas: 0, brutoTotal: 0, retenidoTotal: 0, brutoActualizado: 0, retenidoActualizado: 0 });

        var lineasCsv = ['RUT Prestador;Nombre o Razon Social;Cantidad BHE;Honorarios Brutos Sin Actualizar (C28);Retencion Real Practicada;Tasa Efectiva %;Honorarios Actualizados;Retencion Actualizada'];
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
            esProvisorio: !!vAt.esProvisorio,
            ipcOficialDisponible: vAt.esProvisorio ? false : true,
            avisoProvisorio: vAt.avisoProvisorio || '',
            anuladasIgnoradas: anuladasIgnoradas,
            notaNormativa: 'Acumula la retencion efectivamente practicada en cada BHE (15,25% en 2026 segun Ley 21.133). No usa tasa historica del 13%.' + (vAt.anioTributario >= 2027 ? ' AT 2027 (Res. Ex. 116) mantiene C28 e elimina C29/C30.' : ''),
            filas: filas,
            certificadosN1: certificadosN1,
            totales: totales,
            csv: lineasCsv.join('\n')
        };
    }

    function generarDj1947o1948(regimen, datos, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
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
            var sumaPct = socios.reduce(function (acc, s) { return acc + Number(s.porcentaje || 0); }, 0) || 100;
            var acumBase = 0;
            var acumPpm = 0;
            var filas1947 = socios.map(function (s, idx) {
                var pct = Number(s.porcentaje || 0);
                var ultimo = idx === socios.length - 1;
                var asignado = ultimo ? (baseImponible - acumBase) : Math.round(baseImponible * (pct / sumaPct));
                var creditoPpm = ultimo ? Math.max(0, ppmDisponible - acumPpm) : Math.round(ppmDisponible * (pct / sumaPct));
                acumBase += asignado;
                acumPpm += creditoPpm;
                return {
                    rutSocio: formatearRut(s.rut),
                    nombreSocio: String(s.nombre || 'Socio').trim(),
                    porcentajeParticipacion: pct,
                    baseImponibleAsignada: asignado,
                    creditoPpmAsignado: creditoPpm,
                    gastoRechazadoAsignado: Math.round(entero(d.gastosRechazados) * (pct / sumaPct))
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
            // En 14 A (Semi-integrado) DJ 1948 informa credito bruto sujeto a restitucion 35% (neto usable 65% en F22 socio)
            var creditoFinal = es14A ? Math.round(creditoBruto * 0.65) : creditoBruto;
            return {
                rutSocio: formatearRut(s.rut),
                nombreSocio: String(s.nombre || 'Socio').trim(),
                porcentajeParticipacion: pct,
                montoRetiroODividendo: retiro,
                tasaIdpcPct: tasaIdpc,
                factorCredito: Math.round(factor * 1000000) / 1000000,
                creditoBruto14A: creditoBruto,
                creditoIdpc: creditoFinal,
                sujetoRestitucion14A: es14A
            };
        });

        var totalRetiros = filas1948.reduce(function (acc, f) { return acc + f.montoRetiroODividendo; }, 0);
        var totalCredito = filas1948.reduce(function (acc, f) { return acc + f.creditoIdpc; }, 0);
        var csv1948 = ['RUT Propietario;Nombre;Retiro o Dividendo;Tasa IDPC %;Factor;Credito IDPC;Credito Bruto Sujeto Restitucion;Sujeto Restitucion 14A'];
        filas1948.forEach(function (f) {
            csv1948.push([f.rutSocio, f.nombreSocio.replace(/;/g, ' '), f.montoRetiroODividendo, f.tasaIdpcPct, f.factorCredito, f.creditoIdpc, f.creditoBruto14A, f.sujetoRestitucion14A ? 'SI' : 'NO'].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1948',
            regimen: regNorm,
            anioTributario: vAt.anioTributario,
            tasaIdpcPct: tasaIdpc,
            totalRetiros: totalRetiros,
            totalCreditoIdpc: totalCredito,
            totalCreditoBruto: filas1948.reduce(function (acc, f) { return acc + f.creditoBruto14A; }, 0),
            filas: filas1948,
            csv: csv1948.join('\n')
        };
    }

    /*
     * Capital Propio Tributario Simplificado (Art. 14 D N°3 / N°8, Circular SII N°62 de 2020):
     * CPT Cierre = CPT Anterior + Aumentos Capital + Base Imponible (RLI) + INR/Dividendos Percibidos
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
        var rexPositivo = Math.max(0, saldoRex);
        var rexNegativo = Math.max(0, -saldoRex);
        var raiEstimado = Math.max(0, Math.max(0, cptFinal) + retirosDividendos + rexNegativo - rexPositivo - capitalAportado);

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

    function consolidarEjercicioAnual(entradas, anio, opciones) {
        var opts = opciones || {};
        var anioStr = String(Math.round(Number(anio) || ANIO_TRIBUTARIO_MAXIMO));
        var pref = anioStr + '-';
        var lista = [];
        if (Array.isArray(entradas)) {
            lista = entradas.filter(function (e) { return e && String(e.periodo || '').indexOf(pref) === 0; });
        } else if (entradas && typeof entradas === 'object') {
            Object.keys(entradas).forEach(function (per) {
                if (per.indexOf(pref) === 0 && entradas[per] && typeof entradas[per] === 'object') {
                    lista.push(Object.assign({ periodo: per }, entradas[per]));
                }
            });
        }
        lista.sort(function (a, b) { return String(a.periodo).localeCompare(String(b.periodo)); });

        var todosNom = [];
        var todasBhe = [];
        var bheSeen = {};
        var ppmTotal = 0;
        var mesesConDatos = [];
        var asientosAnuales = [];
        var factoresPorMes = (opts.factoresPorMes && typeof opts.factoresPorMes === 'object') ? opts.factoresPorMes : {};
        var factorDef = Number(opts.factorActualizacion || 1) || 1;

        lista.forEach(function (item) {
            var per = String(item.periodo || '');
            var factorMes = Number(factoresPorMes[per] || item.factorActualizacion || factorDef) || 1;
            var hayDatoMes = false;
            if (Array.isArray(item.nominaResultados) && item.nominaResultados.length) {
                hayDatoMes = true;
                item.nominaResultados.forEach(function (r) {
                    if (!r) return;
                    todosNom.push(Object.assign({}, r, { factorActualizacion: r.factorActualizacion || factorMes }));
                });
            }
            if (Array.isArray(item.bheBoletas) && item.bheBoletas.length) {
                hayDatoMes = true;
                item.bheBoletas.forEach(function (b, idx) {
                    if (!b) return;
                    var folioKey = b.folio ? (limpiarRut(b.rut) + '|' + String(b.folio) + '|' + String(b.fecha || per)) : (per + '|' + idx);
                    if (b.folio && bheSeen[folioKey]) return;
                    if (b.folio) bheSeen[folioKey] = true;
                    todasBhe.push(Object.assign({}, b, { factorActualizacion: b.factorActualizacion || factorMes }));
                });
            } else if (entero(item.honorariosBruto) > 0) {
                hayDatoMes = true;
                var retMan = entero(item.honorariosRetencion) || Math.round(entero(item.honorariosBruto) * 0.1525);
                todasBhe.push({
                    rut: '12.345.678-5',
                    razonSocial: 'Honorarios consolidados (' + per + ')',
                    bruto: entero(item.honorariosBruto),
                    retenido: retMan,
                    estado: 'VIGENTE',
                    factorActualizacion: factorMes
                });
            }
            if (item.f29 && item.f29.codigos && entero(item.f29.codigos[62]) > 0) {
                hayDatoMes = true;
                ppmTotal += entero(item.f29.codigos[62]);
            }
            if (Array.isArray(item.asientos) && item.asientos.length) {
                hayDatoMes = true;
                item.asientos.forEach(function (a) {
                    if (!a) return;
                    asientosAnuales.push(Object.assign({}, a, {
                        id: per + '-' + (a.id || 'AS'),
                        periodo: per
                    }));
                });
            }
            if (hayDatoMes && mesesConDatos.indexOf(per) < 0) mesesConDatos.push(per);
        });

        return {
            anio: Number(anioStr),
            mesesConDatos: mesesConDatos,
            cantidadMeses: mesesConDatos.length,
            nominaRegistros: acumularLiquidacionesParaDj1887(todosNom, { factorActualizacion: factorDef }),
            bheLista: todasBhe,
            ppmTotal: ppmTotal,
            asientosAnuales: asientosAnuales
        };
    }

    function clasificarCuentaDj1847(f) {
        var cod = String(f.codigo || '');
        var tipo = String(f.tipo || 'activo');
        var grupo = String(f.grupo || '');
        var activo = entero(f.activo);
        var pasivo = entero(f.pasivo);
        var c2 = '1.01.09';
        var c28 = '';
        var c29 = null;

        if (tipo === 'activo') {
            var mapaAct = { '11010': '1.01.01', '11020': '1.01.02', '11040': '1.01.03', '11060': '1.01.04', '11080': '1.01.06', '11090': '1.01.07' };
            c2 = mapaAct[cod] || (/^12/.test(cod) ? '1.02.01' : '1.01.09');
            c29 = activo - pasivo;
        } else if (tipo === 'pasivo') {
            var mapaPas = { '21010': '2.01.01', '21020': '2.01.03', '21025': '2.01.06', '21030': '2.01.06', '21035': '2.01.06', '21040': '2.01.06', '21045': '2.01.06', '21060': '2.01.08' };
            c2 = mapaPas[cod] || (/^22/.test(cod) ? '2.02.01' : '2.01.09');
            c29 = activo - pasivo;
        } else if (tipo === 'patrimonio') {
            c2 = '3.01.01';
        } else if (tipo === 'ganancia') {
            c2 = (grupo === 'financiero' || grupo === 'otros_ingresos') ? '4.02.01' : '4.01.01';
            c28 = (grupo === 'financiero' || grupo === 'otros_ingresos') ? '1658' : '1657';
        } else {
            if (grupo === 'costo_ventas') { c2 = '5.01.01'; c28 = '1660'; }
            else if (grupo === 'depreciacion') { c2 = '5.02.05'; c28 = '1665'; }
            else if (grupo === 'gasto_rechazado') { c2 = '5.03.01'; c28 = '1666'; }
            else if (grupo === 'opex_laboral') { c2 = '5.02.01'; c28 = '1664'; }
            else if (grupo === 'opex_honorarios') { c2 = '5.02.02'; c28 = '1664'; }
            else { c2 = '5.02.09'; c28 = '1664'; }
        }
        return { c2: c2, c28: c28, c29: c29 };
    }

    function generarDj1847(balance, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }
        var regNorm = String(opts.regimen || '14D3').toUpperCase();
        var obligado = /^14A/.test(regNorm);
        var srcFilas = (balance && Array.isArray(balance.filas)) ? balance.filas : [];

        var filas = srcFilas.map(function (f, idx) {
            var clf = clasificarCuentaDj1847(f);
            return {
                C0_n: idx + 1,
                C1_idCuenta: String(f.codigo || ''),
                C2_clasificadorSii: clf.c2,
                C3_nombre: String(f.nombre || '').trim(),
                tipo: String(f.tipo || 'activo'),
                C4_debito: entero(f.debito),
                C5_credito: entero(f.credito),
                C6_deudor: entero(f.deudor),
                C7_acreedor: entero(f.acreedor),
                C8_activo: entero(f.activo),
                C9_pasivo: entero(f.pasivo),
                C10_perdida: entero(f.perdida),
                C11_ganancia: entero(f.ganancia),
                C28_conceptoResultado: clf.c28,
                C29_valorTributario: clf.c29
            };
        });

        var tot = (balance && balance.totales) || {};
        var csv = ['Nro (C0);Id Plan Propio (C1);Clasificador SII (C2);Nombre Cuenta (C3);Debito (C4);Credito (C5);Deudor (C6);Acreedor (C7);Activo (C8);Pasivo (C9);Perdida (C10);Ganancia (C11);Concepto Resultado (C28);Valor Tributario (C29)'];
        filas.forEach(function (f) {
            csv.push([
                f.C0_n,
                f.C1_idCuenta,
                f.C2_clasificadorSii,
                f.C3_nombre.replace(/;/g, ' '),
                f.C4_debito,
                f.C5_credito,
                f.C6_deudor,
                f.C7_acreedor,
                f.C8_activo,
                f.C9_pasivo,
                f.C10_perdida,
                f.C11_ganancia,
                f.C28_conceptoResultado || '',
                f.C29_valorTributario != null ? f.C29_valorTributario : ''
            ].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1847',
            anioTributario: vAt.anioTributario,
            regimen: regNorm,
            obligado: obligado,
            esProvisorio: !!vAt.esProvisorio,
            avisoProvisorio: vAt.avisoProvisorio || '',
            notaNormativa: obligado
                ? 'Obligatoria para contribuyentes en Art. 14 letra A LIR. Patrimonio y Resultado llevan C29 vacio; Pasivos en C29 con signo negativo.'
                : 'No obligatoria en regimen ProPyme (Art. 14 D N°3 / N°8) segun Res. Ex. SII N° 123/2020 y N° 22/2021; borrador solo referencial.',
            filas: filas,
            totales: {
                cuentas: filas.length,
                debito: entero(tot.debito),
                credito: entero(tot.credito),
                activo: entero(tot.activo),
                pasivo: entero(tot.pasivo),
                perdida: entero(tot.perdida),
                ganancia: entero(tot.ganancia),
                resultadoContable: balance ? enteroConSigno(balance.resultado) : 0
            },
            csv: csv.join('\n')
        };
    }

    function generarDj1926(datos, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }
        var d = datos || {};
        var regNorm = String(d.regimen || opts.regimen || '14D3').toUpperCase();
        var obligado = /^14A/.test(regNorm);
        var etiquetasTipo = { '9': 'Resultado Financiero', '1': 'Agregado', '2': 'Deduccion', '4': 'Incentivo Art. 14 E' };

        var partidas = [];
        function addPartida(concepto, clf, desc, monto, tipoAj) {
            var val = Number(tipoAj) === 9 ? enteroConSigno(monto) : entero(monto);
            if (Number(tipoAj) !== 9 && val === 0) return;
            partidas.push({
                C2_conceptoRli: String(concepto),
                C3_clasificadorSecIII: String(clf),
                C4_descripcion: String(desc).trim(),
                C5_monto: val,
                C6_tipoAjuste: Number(tipoAj),
                tipoAjusteEtiqueta: etiquetasTipo[String(tipoAj)] || 'Ajuste'
            });
        }

        if (Array.isArray(d.partidas) && d.partidas.length) {
            d.partidas.forEach(function (p) {
                if (!p) return;
                addPartida(p.concepto || p.C2_conceptoRli || '1679', p.clasificador || p.C3_clasificadorSecIII || '5.03.01', p.descripcion || p.C4_descripcion || 'Partida RLI', p.monto != null ? p.monto : p.C5_monto, p.tipoAjuste != null ? p.tipoAjuste : (p.C6_tipoAjuste != null ? p.C6_tipoAjuste : 1));
            });
        } else {
            addPartida('1675', '3.01.00', 'Resultado financiero del ejercicio segun Balance', d.resultadoFinanciero != null ? d.resultadoFinanciero : d.resultadoContable, 9);
            addPartida('1679', '5.03.01', 'Agregado: gastos rechazados y multas no deducibles (Art. 21 LIR)', d.multasGastosRechazados, 1);
            addPartida('1680', '5.02.05', 'Agregado: depreciacion financiera contabilizada', d.depreciacionFinanciera, 1);
            addPartida('1678', '4.01.09', 'Agregado: otros agregados tributarios a la RLI', d.otrosAgregados, 1);
            addPartida('1685', '5.02.05', 'Deduccion: depreciacion tributaria autorizada (Art. 31 N°5 LIR)', d.depreciacionTributaria, 2);
            addPartida('1686', '5.02.09', 'Deduccion: otras deducciones aceptadas de la RLI', d.otrasDeducciones, 2);
            addPartida('1688', '5.04.01', 'Deduccion: incentivo al ahorro PYME Art. 14 letra E LIR', d.incentivo14E, 4);
        }

        var filas = partidas.map(function (p, i) {
            return Object.assign({ C0_n: i + 1 }, p);
        });

        var resFin = 0, agregados = 0, deducciones = 0, ded14E = 0;
        filas.forEach(function (f) {
            if (f.C6_tipoAjuste === 9) resFin += f.C5_monto;
            else if (f.C6_tipoAjuste === 1) agregados += f.C5_monto;
            else if (f.C6_tipoAjuste === 2) deducciones += f.C5_monto;
            else if (f.C6_tipoAjuste === 4) ded14E += f.C5_monto;
        });
        var rliFinal = d.baseImponibleRli != null
            ? enteroConSigno(d.baseImponibleRli)
            : (resFin + agregados - deducciones - ded14E);

        var csv = ['Nro (C0);Concepto RLI (C2);Cuenta Clasificador Sec. III (C3);Descripcion Ajuste (C4);Monto (C5);Tipo Ajuste (C6)'];
        filas.forEach(function (f) {
            csv.push([f.C0_n, f.C2_conceptoRli, f.C3_clasificadorSecIII, f.C4_descripcion.replace(/;/g, ' '), f.C5_monto, f.C6_tipoAjuste].join(';'));
        });

        return {
            ok: true,
            codigoDj: '1926',
            anioTributario: vAt.anioTributario,
            regimen: regNorm,
            obligado: obligado,
            esProvisorio: !!vAt.esProvisorio,
            avisoProvisorio: vAt.avisoProvisorio || '',
            notaNormativa: obligado
                ? 'Obligatoria para contribuyentes en Art. 14 letra A LIR. Tipo ajuste C6: 9 Resultado Financiero, 1 Agregado, 2 Deduccion, 4 Art. 14 E.'
                : 'No obligatoria en regimen ProPyme (Art. 14 D N°3 / N°8); vista referencial equivalente al esquema de conciliacion SII.',
            filas: filas,
            totales: {
                resultadoFinanciero: resFin,
                agregados: agregados,
                deducciones: deducciones,
                deducciones14E: ded14E,
                rliFinalC1690: rliFinal
            },
            csv: csv.join('\n')
        };
    }

    function generarDj1837(datos, opciones) {
        var opts = opciones || {};
        var vAt = validarAnioTributario(opts.anioTributario || ANIO_TRIBUTARIO_MAXIMO, opts);
        if (!vAt.ok) {
            return { ok: false, bloqueado: true, error: vAt.motivo };
        }
        var d = datos || {};
        var regNorm = String(d.regimen || opts.regimen || '14D3').toUpperCase();
        var tipoEntidad = String(d.tipoEntidad || opts.tipoEntidad || 'SOC_PERSONAS').toUpperCase();
        var entidadesObligadas = ['EIRL', 'SOC_PERSONAS', 'SOC_HECHO', 'PROFESIONALES', 'COMUNIDAD'];
        var esTransparente = /^14D8/.test(regNorm);
        var aplica = !esTransparente && entidadesObligadas.indexOf(tipoEntidad) >= 0;

        var montoTotalPpm = aplica ? entero(d.ppmDisponible != null ? d.ppmDisponible : d.montoPpmTotal) : 0;
        var socios = Array.isArray(d.socios) && d.socios.length
            ? d.socios
            : [{ rut: '12.345.678-5', nombre: 'Socio titular', porcentaje: 100 }];

        var filas = [];
        if (aplica) {
            var sumaPct = socios.reduce(function (acc, s) { return acc + Math.max(0, Number(s && s.porcentaje) || 0); }, 0) || 100;
            var acumulado = 0;
            filas = socios.map(function (s, idx) {
                var pct = Math.max(0, Number(s && s.porcentaje) || 0);
                var monto = idx === socios.length - 1
                    ? Math.max(0, montoTotalPpm - acumulado)
                    : Math.round(montoTotalPpm * (pct / sumaPct));
                acumulado += monto;
                return {
                    C1_numero: idx + 1,
                    C2_rutSocio: formatearRut(s && s.rut),
                    nombreSocio: String((s && s.nombre) || 'Socio').trim(),
                    C3_montoCreditoPpm: monto
                };
            });
        }

        // Anexo 16 Res. Ex. 116: C1 Nro, C2 RUT Socio/Comunero, C3 Monto Credito/PPM en pesos (sin columna de porcentaje)
        var csv = ['Nro (C1);RUT Socio o Comunero (C2);Monto Credito PPM Puesto a Disposicion (C3)'];
        filas.forEach(function (f) {
            csv.push([f.C1_numero, f.C2_rutSocio, f.C3_montoCreditoPpm].join(';'));
        });

        var motivoNoAplica = '';
        if (esTransparente) {
            motivoNoAplica = 'Regimen ProPyme Transparente (Art. 14 D N°8) excluido de DJ 1837: el PPM a disposicion se informa en DJ 1947.';
        } else if (entidadesObligadas.indexOf(tipoEntidad) < 0) {
            motivoNoAplica = 'Tipo societario ' + tipoEntidad + ' excluido: S.A., SpA y SCPA no presentan DJ 1837 (solo EIRL, Soc. de Personas, Soc. de Hecho, Soc. de Profesionales y Comunidades).';
        }

        return {
            ok: true,
            codigoDj: '1837',
            anioTributario: vAt.anioTributario,
            regimen: regNorm,
            tipoEntidad: tipoEntidad,
            aplica: aplica,
            esProvisorio: !!vAt.esProvisorio,
            avisoProvisorio: vAt.avisoProvisorio || '',
            motivoNoAplica: motivoNoAplica,
            notaNormativa: aplica
                ? 'Seccion B DJ 1837: C1 N°, C2 RUT socio/comunero, C3 Monto Credito/PPM puesto a disposicion (sin columna % en formato SII).'
                : motivoNoAplica,
            filas: filas,
            totales: {
                socios: filas.length,
                montoTotalPpmPuesto: filas.reduce(function (acc, f) { return acc + f.C3_montoCreditoPpm; }, 0)
            },
            csv: csv.join('\n')
        };
    }

    var api = {
        ANIO_TRIBUTARIO_MAXIMO: ANIO_TRIBUTARIO_MAXIMO,
        validarAnioTributario: validarAnioTributario,
        acumularLiquidacionesParaDj1887: acumularLiquidacionesParaDj1887,
        consolidarEjercicioAnual: consolidarEjercicioAnual,
        generarDj1887: generarDj1887,
        generarDj1879: generarDj1879,
        generarDj1947o1948: generarDj1947o1948,
        generarDj1847: generarDj1847,
        generarDj1926: generarDj1926,
        generarDj1837: generarDj1837,
        calcularCptSimplificado: calcularCptSimplificado,
        version: '1.2.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLRenta = api;
})(typeof window !== 'undefined' ? window : this);
