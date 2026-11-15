/*
 * CálculoLaboral · Asistente Pro Contadores (Etapa 1: Semáforo Pre-SII F29 + Resumen Ejecutivo Cliente)
 * Funciona en navegador (window.CLContadoresAsistentePro) y en Node (require).
 *
 * Normativa verificada (SII / BCN al 15-11-2026):
 *   - Supermercados: tope 5 UTA eliminado por Ley 21.210 desde 01-01-2020 (Circular 53/2020).
 *     Regla vigente: gasto necesario del giro (art. 31 LIR) y crédito en F29 códigos 761/762 (art. 23 N°4 DL 825).
 *   - Remanente IVA (cód. 504): cód. 77 mes previo convertido a UTM del mes de presentación anterior
 *     y reconvertido a pesos con UTM del mes de presentación actual (control SII FM01).
 *   - Honorarios BHE (cód. 151): 14,5% (2025), 15,25% (2026), 16% (2027); retención real manda si viene en BHE.
 *   - PPM ProPyme General (14 D3): 0,125% (<=50k UF) / 0,25% (>50k UF) de ago-2025 a dic-2027 (Ley 21.755, Circ. 53/2025).
 */
(function (root) {
    'use strict';

    var HON = (typeof module !== 'undefined' && module.exports)
        ? require('./pyme_honorarios.js')
        : root.CLPymeHonorarios;

    function num(v) {
        var n = Number(v);
        return isFinite(n) ? n : 0;
    }

    function money(v) {
        var n = Math.round(num(v));
        var signo = n < 0 ? '-' : '';
        return signo + '$' + Math.abs(n).toLocaleString('es-CL');
    }

    function tasaHonorariosEsperada(anio) {
        var a = Number(anio) || 2026;
        if (HON && typeof HON.tasa === 'function') {
            return HON.tasa(a);
        }
        if (a <= 2024) return 0.1375;
        if (a === 2025) return 0.145;
        if (a === 2026) return 0.1525;
        if (a === 2027) return 0.16;
        return 0.17;
    }

    function enVentanaPpmRebajado(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
        if (!m) return true;
        var ym = Number(m[1]) * 100 + Number(m[2]);
        return ym >= 202508 && ym <= 202712;
    }

    function tasaPpmEsperadaProPyme(regimen, periodo) {
        var rebajado = enVentanaPpmRebajado(periodo);
        if (regimen === '14D3') return rebajado ? 0.125 : 0.25;
        if (regimen === '14D3_MAYOR') return rebajado ? 0.25 : 0.5;
        return null;
    }

    function formatearPeriodoCorto(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
        if (!m) return String(periodo || 'Período actual');
        var meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        var idx = Number(m[2]) - 1;
        return (meses[idx] || m[2]) + ' ' + m[1];
    }

    function auditarF29PreSii(entrada) {
        var e = entrada || {};
        var f29 = e.f29 || {};
        var c = f29.codigos || {};
        var res = f29.resumen || {};
        var ventas = e.ventas || {};
        var compras = e.compras || {};
        var nomina = e.nomina || null;
        var est = e.estado || {};
        var periodo = e.periodo || f29.periodo || est.periodo || '2026-11';
        var anio = Number(String(periodo).slice(0, 4)) || 2026;
        var regimen = f29.regimen || est.regimen || '14D3';

        var hallazgos = [];

        // 1. Compras en supermercados y comercios similares (cod. 761/762 — art. 31 LIR, sin tope 5 UTA)
        var cantSup = num(c[761]) || num(compras.cantSupermercado);
        var ivaSup = num(c[762]) || num(compras.ivaSupermercado);
        var totalCreditosDoc = num(c[520]) + num(c[762]) + num(c[525]);
        if (cantSup > 0 || ivaSup > 0) {
            var pctSup = totalCreditosDoc > 0 ? Math.round((ivaSup / totalCreditosDoc) * 100) : 0;
            var esAlto = pctSup >= 45;
            hallazgos.push({
                id: 'supermercado',
                nivel: esAlto ? 'rojo' : 'amarillo',
                codigoSii: '761/762',
                titulo: esAlto
                    ? 'Peso elevado de supermercados sobre crédito IVA (' + pctSup + '%)'
                    : 'Compras en supermercado registradas en cód. 761/762',
                detalle: 'Compra en supermercado o comercio similar (' + cantSup + ' docto(s)., IVA ' + money(ivaSup) + '). Desde la Ley 21.210 no existe tope de 5 UTA: valida que sean gastos necesarios del giro (art. 31 LIR) y que no estén duplicados en cód. 519/520.',
                norma: 'Art. 31 LIR · Art. 23 N°4 DL 825 · Circ. SII N°53/2020'
            });
        } else {
            hallazgos.push({
                id: 'supermercado',
                nivel: 'verde',
                codigoSii: '761/762',
                titulo: 'Sin facturas de supermercado objetables',
                detalle: 'No se registran créditos fiscales por supermercados o comercios similares en códigos 761/762.',
                norma: 'Art. 23 N°4 DL 825'
            });
        }

        // 2. IVA no recuperable y completitud del RCV de compras
        var ivaNoRec = num(compras.ivaNoRecuperable || res.ivaNoRecuperable);
        var avisosCompras = Array.isArray(compras.avisos) ? compras.avisos : [];
        var avisosRcvSinRut = avisosCompras.filter(function (a) { return /sin RUT/i.test(String(a)); });
        if (ivaNoRec > 0) {
            hallazgos.push({
                id: 'iva_no_rec',
                nivel: 'amarillo',
                codigoSii: 'RCV',
                titulo: 'IVA no recuperable detectado en compras (' + money(ivaNoRec) + ')',
                detalle: 'El RCV de compras informa ' + money(ivaNoRec) + ' como IVA no recuperable. No rebaja el débito del F29; verifica si corresponde llevarlo a costo/gasto o si hubo error de caracterización en el SII.',
                norma: 'DL 825 art. 23 · RCV SII'
            });
        } else if (avisosRcvSinRut.length > 0) {
            hallazgos.push({
                id: 'iva_no_rec',
                nivel: 'amarillo',
                codigoSii: 'RCV',
                titulo: avisosRcvSinRut.length + ' documento(s) de compra sin RUT emisor',
                detalle: 'Hay documentos en compras sin RUT identificado. Confirma el archivo CSV/Excel del SII antes de cerrar el crédito fiscal.',
                norma: 'RCV Compras SII'
            });
        } else {
            hallazgos.push({
                id: 'iva_no_rec',
                nivel: 'verde',
                codigoSii: 'RCV',
                titulo: 'RCV de compras sin IVA no recuperable ni errores de RUT',
                detalle: 'Todos los documentos recibidos con derecho a crédito se encuentran completos y sin IVA castigado.',
                norma: 'RCV Compras SII'
            });
        }

        // 3. Cuadratura retención Boletas de Honorarios (cód. 151)
        var cod151 = num(c[151]);
        var brutoHon = num(res.honorariosBruto) || num(est.honorariosBruto);
        var tasaEsp = tasaHonorariosEsperada(anio);
        var tasaPctStr = (tasaEsp * 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var bheLista = Array.isArray(est.bheBoletas) ? est.bheBoletas : [];
        var bheAlertas = Array.isArray(est.bheAlertas) ? est.bheAlertas : [];
        var retEsperadaBhe = null;
        if (bheLista.length > 0) {
            retEsperadaBhe = bheLista.reduce(function (s, b) { return s + num(b.retencion); }, 0);
        } else if (brutoHon > 0 && !(est.honorariosRetencionDirecta > 0)) {
            retEsperadaBhe = Math.round(brutoHon * tasaEsp);
        }

        if (brutoHon > 0 && cod151 === 0) {
            hallazgos.push({
                id: 'cuadratura_bhe',
                nivel: 'rojo',
                codigoSii: '151',
                titulo: 'Honorarios con retención en $0 en cód. 151',
                detalle: 'Se informan honorarios brutos por ' + money(brutoHon) + ' pero el código 151 marca $0. El código 151 declara la retención efectiva (' + tasaPctStr + '% en ' + anio + '), no el bruto.',
                norma: 'Ley 21.133 · F29 cód. 151'
            });
        } else if (retEsperadaBhe !== null && Math.abs(cod151 - retEsperadaBhe) > 50) {
            hallazgos.push({
                id: 'cuadratura_bhe',
                nivel: 'amarillo',
                codigoSii: '151',
                titulo: 'Diferencia entre cód. 151 y retención esperada BHE',
                detalle: 'Cód. 151 informa ' + money(cod151) + ' frente a ' + money(retEsperadaBhe) + ' calculado sobre las BHE/bruto (' + tasaPctStr + '%). Si la boleta SII ya trae retención emitida, manda la de la boleta.',
                norma: 'Ley 21.133 · DJ 1879'
            });
        } else if (bheAlertas.length > 0) {
            hallazgos.push({
                id: 'cuadratura_bhe',
                nivel: 'amarillo',
                codigoSii: '151',
                titulo: 'Revisar advertencias en nómina BHE importada (' + bheAlertas.length + ')',
                detalle: 'La suma de cód. 151 (' + money(cod151) + ') cuadra, pero existen observaciones en las boletas importadas: ' + String(bheAlertas[0]),
                norma: 'DJ 1879 · BHE SII'
            });
        } else {
            hallazgos.push({
                id: 'cuadratura_bhe',
                nivel: 'verde',
                codigoSii: '151',
                titulo: cod151 > 0 ? ('Retención honorarios cód. 151 cuadrada (' + money(cod151) + ')') : 'Sin retenciones de honorarios en el período',
                detalle: cod151 > 0
                    ? ('Consistente con boletas del período y tasa vigente ' + anio + ' (' + tasaPctStr + '%). No mezclar con cód. 48.')
                    : 'Sin boletas de honorarios retenidas para enterar en código 151.',
                norma: 'Ley 21.133 · F29 cód. 151'
            });
        }

        // 4. Cuadratura Impuesto Único 2ª Categoría (Nómina vs cód. 48)
        var cod48 = num(c[48]);
        var iuscNomina = nomina ? num(nomina.impuesto48) : 0;
        var hayNomina = Boolean(nomina && (num(nomina.totalDebe) > 0 || iuscNomina > 0));
        if (hayNomina && cod48 !== iuscNomina) {
            hallazgos.push({
                id: 'cuadratura_iusc',
                nivel: 'rojo',
                codigoSii: '48',
                titulo: 'Descuadre entre Nómina y F29 en Impuesto Único (cód. 48)',
                detalle: 'Remuneraciones determina ' + money(iuscNomina) + ', pero el F29 informa ' + money(cod48) + '. El código 48 corresponde exclusivamente a sueldos dependientes (art. 42 N°1) y debe cuadrar con la DJ 1887.',
                norma: 'Art. 42 N°1 LIR · DJ 1887'
            });
        } else if (cod48 > 0 && !hayNomina) {
            hallazgos.push({
                id: 'cuadratura_iusc',
                nivel: 'amarillo',
                codigoSii: '48',
                titulo: 'Cód. 48 informado sin nómina calculada en Remuneraciones',
                detalle: 'Se declaró ' + money(cod48) + ' manualmente en código 48 sin liquidaciones en este cliente. Verifica su respaldo contra el LRE para evitar diferencias con la DJ 1887.',
                norma: 'Art. 42 N°1 LIR · LRE'
            });
        } else {
            hallazgos.push({
                id: 'cuadratura_iusc',
                nivel: 'verde',
                codigoSii: '48',
                titulo: cod48 > 0 ? ('Impuesto Único cód. 48 cuadrado con nómina (' + money(cod48) + ')') : 'Sin Impuesto Único de sueldos por enterar',
                detalle: cod48 > 0
                    ? 'El monto de código 48 coincide exactamente con el total retenido en Remuneraciones.'
                    : 'Los sueldos del período están bajo el tramo exento o sin nómina afecta en código 48.',
                norma: 'F29 cód. 48 · DJ 1887'
            });
        }

        // 5. Remanente de Crédito Fiscal (cód. 504 vs cód. 77 previo reajustado por UTM de presentación)
        var cod504 = num(c[504]);
        var remAntOriginal = num(e.remanente77MesAnterior);
        var utmPresAnt = num(e.utmMesPresentacionAnterior);
        var utmPresAct = num(e.utmMesPresentacionActual);
        if (remAntOriginal > 0 && utmPresAnt > 0 && utmPresAct > 0) {
            var remEsperado = Math.round((remAntOriginal / utmPresAnt) * utmPresAct);
            if (Math.abs(cod504 - remEsperado) > 10) {
                hallazgos.push({
                    id: 'remanente_utm',
                    nivel: 'rojo',
                    codigoSii: '504',
                    titulo: 'Riesgo de Observación SII FM01 en remanente cód. 504',
                    detalle: 'Cód. 504 ingresado (' + money(cod504) + ') difiere del reajuste exacto (' + money(remEsperado) + '): cód. 77 anterior (' + money(remAntOriginal) + ') / UTM presentación previa × UTM presentación actual.',
                    norma: 'Control SII FM01 · FAQ 001.130.0790'
                });
            } else {
                hallazgos.push({
                    id: 'remanente_utm',
                    nivel: 'verde',
                    codigoSii: '504',
                    titulo: 'Remanente cód. 504 reajustado correctamente por UTM',
                    detalle: 'El monto (' + money(cod504) + ') coincide con el cód. 77 del mes previo actualizado con la UTM de los meses de presentación.',
                    norma: 'Control SII FM01'
                });
            }
        } else if (cod504 > 0) {
            hallazgos.push({
                id: 'remanente_utm',
                nivel: 'amarillo',
                codigoSii: '504',
                titulo: 'Validar reajuste UTM del remanente en cód. 504 (' + money(cod504) + ')',
                detalle: 'Confirma en la propuesta del SII que cód. 504 equivalga al cód. 77 del mes anterior convertido a UTM del mes en que se presentó ese F29 y reconvertido con la UTM del mes en que presentas este F29 (evita objeción FM01).',
                norma: 'Control SII FM01 · Circ. UTM SII'
            });
        } else {
            hallazgos.push({
                id: 'remanente_utm',
                nivel: 'verde',
                codigoSii: '504',
                titulo: 'Sin remanente de crédito fiscal anterior (cód. 504)',
                detalle: 'El período parte sin saldo de crédito fiscal arrastrado desde el mes previo.',
                norma: 'F29 Línea 36 · Cód. 504'
            });
        }

        // 6. Coherencia PPM Obligatorio (cód. 563 base / 115 tasa / 62 determinado)
        var cod563 = num(c[563]);
        var cod115 = num(c[115]);
        var cod62 = num(c[62]);
        var ppmRebajadoEsp = tasaPpmEsperadaProPyme(regimen, periodo);

        if (regimen === '14A' && cod563 > 0 && cod115 === 0) {
            hallazgos.push({
                id: 'coherencia_ppm',
                nivel: 'rojo',
                codigoSii: '115/62',
                titulo: 'Régimen 14 A requiere tasa PPM variable en código 115',
                detalle: 'Hay ingresos afectos en cód. 563 (' + money(cod563) + ') con tasa PPM en 0%. Ingresa la tasa variable vigente del cliente en cód. 115 para determinar el código 62.',
                norma: 'Art. 84 letra a) LIR · Cód. 115'
            });
        } else if (cod563 > 0 && cod115 > 0 && cod62 === 0) {
            hallazgos.push({
                id: 'coherencia_ppm',
                nivel: 'rojo',
                codigoSii: '62',
                titulo: 'PPM determinado en $0 pese a tener base y tasa',
                detalle: 'Cód. 563 (' + money(cod563) + ') y tasa cód. 115 (' + cod115 + '%) debieran generar PPM en código 62.',
                norma: 'Art. 84 LIR · F29 cód. 62'
            });
        } else if (ppmRebajadoEsp !== null && Math.abs(cod115 - ppmRebajadoEsp) > 0.001) {
            hallazgos.push({
                id: 'coherencia_ppm',
                nivel: 'amarillo',
                codigoSii: '115',
                titulo: 'Tasa PPM distinta al tramo rebajado ProPyme (' + cod115 + '% vs ' + ppmRebajadoEsp + '%)',
                detalle: 'Para ingresos ProPyme General entre agosto 2025 y diciembre 2027 rige la rebaja a la mitad: 0,125% (<=50.000 UF) o 0,25% (>50.000 UF). Confirma si tu cliente aplica tasa distinta.',
                norma: 'Ley 21.755 · Circ. SII N°53/2025'
            });
        } else {
            hallazgos.push({
                id: 'coherencia_ppm',
                nivel: 'verde',
                codigoSii: '563/115/62',
                titulo: 'PPM cód. 62 coherente con el régimen (' + money(cod62) + ')',
                detalle: 'Base ' + money(cod563) + ' × tasa ' + cod115.toLocaleString('es-CL', { maximumFractionDigits: 3 }) + '% = ' + money(cod62) + ' en código 62.',
                norma: regimen === '14D3' || regimen === '14D3_MAYOR' ? 'Circ. SII N°53/2025' : 'Art. 84 LIR'
            });
        }

        // Además: alerta si Boletas Electrónicas tipo 39 presentes para contrastar con propuesta SII
        if (num(res.cantBoletasElectronicas) > 0 && num(res.ivaBoletasElectronicas) > 0) {
            hallazgos.push({
                id: 'boletas_39',
                nivel: 'amarillo',
                codigoSii: 'Prop. SII',
                titulo: 'Contrastar resumen boletas electrónicas (tipo 39 · ' + res.cantBoletasElectronicas + ' doc.)',
                detalle: 'Su IVA (' + money(res.ivaBoletasElectronicas) + ') sumó al débito cód. 538. Valida que coincida con la línea automática del SII; cód. 110/111 es solo para boletas manuales.',
                norma: 'Instrucciones F29 · Tipo 39'
            });
        }

        var conteo = { verde: 0, amarillo: 0, rojo: 0 };
        hallazgos.forEach(function (h) {
            if (conteo[h.nivel] !== undefined) conteo[h.nivel] += 1;
        });

        var estadoGeneral = conteo.rojo > 0 ? 'rojo' : (conteo.amarillo > 0 ? 'amarillo' : 'verde');
        var resumenEstado = estadoGeneral === 'rojo'
            ? 'Alertas críticas: corregir antes de declarar en sii.cl'
            : (estadoGeneral === 'amarillo'
                ? 'Observaciones menores: verificar puntos en amarillo en sii.cl'
                : 'Sin objeciones detectadas: listo para cotejar con propuesta SII');

        return {
            estadoGeneral: estadoGeneral,
            resumenEstado: resumenEstado,
            conteo: conteo,
            hallazgos: hallazgos
        };
    }

    function generarResumenWhatsappCliente(entrada) {
        var e = entrada || {};
        var f29 = e.f29 || {};
        var c = f29.codigos || {};
        var pnl = e.pnl || null;
        var flujo = e.flujo || null;
        var nomina = e.nomina || null;
        var audit = e.auditoria || auditarF29PreSii(e);
        var estudio = e.estudio || {};
        var cliente = String(e.cliente || 'Empresa cliente').trim();
        var periodoLbl = formatearPeriodoCorto(e.periodo || f29.periodo);
        var regNombre = String(e.regimenNombre || f29.regimenNombre || 'ProPyme General (14 D3)').trim();

        var retenciones = num(c[48]) + num(c[151]);
        var ivaLinea = num(c[89]) > 0
            ? ('- IVA determinado a pagar (cód. 89): ' + money(c[89]))
            : ('- Remanente IVA mes siguiente (cód. 77): ' + money(c[77]) + ' (sin pago IVA)');

        var lineas = [
            '*Resumen Mensual · ' + periodoLbl + '*',
            'Cliente: ' + cliente + ' · ' + regNombre,
            '',
            '*1. Formulario 29 (vence día 20)*',
            '- Débito fiscal ventas (cód. 538): ' + money(c[538]),
            '- Crédito fiscal compras (cód. 537): ' + money(c[537]),
            ivaLinea,
            '- Retenciones (sueldos + honorarios): ' + money(retenciones),
            '- PPM obligatorio (' + num(c[115]).toLocaleString('es-CL', { maximumFractionDigits: 3 }) + '%): ' + money(c[62]),
            '*Total F29 a pagar (cód. 91): ' + money(c[91]) + '*'
        ];

        var previredComp = flujo ? num(flujo.compromisoPreviredDia13) : (nomina ? num(nomina.totalPrevired || nomina.totalImposiciones) : 0);
        if (pnl || flujo || previredComp > 0) {
            lineas.push('');
            lineas.push('*2. Resultado y Caja*');
            if (pnl) {
                lineas.push('- Ventas netas del giro: ' + money(pnl.ingresosGiro));
                lineas.push('- Resultado antes de impuesto: ' + money(pnl.resultadoAntesImpuesto));
            }
            if (flujo) {
                lineas.push('- Saldo estimado en banco: ' + money(flujo.saldoDisponibleBanco));
            }
            if (previredComp > 0) {
                lineas.push('- Previred estimado (vence día 13): ' + money(previredComp));
            }
            if (flujo) {
                lineas.push('- Caja proyectada tras impuestos/Previred: ' + money(flujo.cajaProyectadaPostImpuestos));
            }
        }

        var relevantes = (audit.hallazgos || []).filter(function (h) { return h.nivel === 'rojo' || h.nivel === 'amarillo'; });
        lineas.push('');
        lineas.push('*3. Revisión Pre-SII:* ' + (audit.estadoGeneral === 'verde' ? 'OK, sin observaciones' : (relevantes.length + ' punto(s) por revisar')));
        relevantes.slice(0, 2).forEach(function (h) {
            lineas.push('- [' + h.codigoSii + '] ' + h.titulo);
        });

        var firmaEstudio = String(estudio.estudio || '').trim();
        var firmaResp = String(estudio.contador || '').trim();
        if (firmaEstudio || firmaResp) {
            lineas.push('');
            lineas.push('Atte., ' + [firmaResp, firmaEstudio].filter(Boolean).join(' · '));
        }

        return lineas.join('\n');
    }

    var api = {
        auditarF29PreSii: auditarF29PreSii,
        generarResumenWhatsappCliente: generarResumenWhatsappCliente,
        tasaHonorariosEsperada: tasaHonorariosEsperada,
        tasaPpmEsperadaProPyme: tasaPpmEsperadaProPyme
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CLContadoresAsistentePro = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
