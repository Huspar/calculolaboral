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

        var cerrado = Boolean(e.cerradoTributario);
        var tieneDatos = e.tieneDatos !== undefined ? Boolean(e.tieneDatos) : (num(c[538]) > 0 || num(c[537]) > 0 || num(c[91]) > 0);
        var estadoF29 = cerrado
            ? 'Declarado'
            : (tieneDatos ? 'Pendiente de declaración (borrador listo)' : 'Sin declarar');

        var retenciones = num(c[48]) + num(c[151]);
        var ivaLinea = num(c[89]) > 0
            ? ('- IVA determinado a pagar (cód. 89): ' + money(c[89]))
            : ('- Remanente IVA mes siguiente (cód. 77): ' + money(c[77]) + ' (sin pago IVA)');

        var lineas = [
            '*Resumen Mensual · ' + periodoLbl + '*',
            'Cliente: ' + cliente + ' · ' + regNombre,
            '',
            '*1. Formulario 29 (vence día 20 electrónico · 12 general · 28 sin pago)*',
            '- Estado del período: ' + estadoF29,
            '- Débito fiscal ventas (cód. 538): ' + money(c[538]),
            '- Crédito fiscal compras (cód. 537): ' + money(c[537]),
            ivaLinea,
            '- Retenciones (sueldos + honorarios): ' + money(retenciones),
            '- PPM obligatorio (' + num(c[115]).toLocaleString('es-CL', { maximumFractionDigits: 3 }) + '%): ' + money(c[62]),
            '*Total F29 a pagar (cód. 91): ' + money(c[91]) + '*'
        ];
        if (!cerrado && (e.incluirRecordatorio === true || (e.cerradoTributario === false && e.incluirRecordatorio !== false))) {
            lineas.push('- Recordatorio: declara y paga tu F29 en sii.cl dentro del plazo mensual (día 20 para facturador electrónico con pago por Internet; día 12 regla general / día 28 sin pago; si es inhábil, siguiente día hábil).');
        }

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

        var portalUrl = String(e.portalUrl || '').trim();
        if (portalUrl) {
            lineas.push('');
            lineas.push('Portal del cliente: ' + portalUrl);
        }

        var firmaEstudio = String(estudio.estudio || '').trim();
        var firmaResp = String(estudio.contador || '').trim();
        if (firmaEstudio || firmaResp) {
            lineas.push('');
            lineas.push('Atte., ' + [firmaResp, firmaEstudio].filter(Boolean).join(' · '));
        }

        return lineas.join('\n');
    }

    // =========================================================
    // TOP 2: Activo Fijo y Depreciación (14 D3 / 14 D8 / 14 A)
    // =========================================================
    function enteroPos(v) {
        return Math.max(0, Math.round(num(v)));
    }

    function calcularActivoFijoTributario(activos, opciones) {
        var opts = opciones || {};
        var regimen = String(opts.regimen || '14D3').toUpperCase();
        var esProPyme = regimen === '14D3' || regimen === '14D3_MAYOR' || regimen === '14D8' || regimen === '14D8_MAYOR';
        var factorIpc = esProPyme ? 1 : Math.max(1, num(opts.factorIpc) || 1);
        var pymesMenor100k = opts.pymesMenor100kUf !== false;

        var totalBase = 0;
        var totalTrib = 0;
        var totalNorm = 0;
        var totalDdan = 0;

        var items = (Array.isArray(activos) ? activos : []).map(function (raw, idx) {
            var a = raw || {};
            var desc = String(a.descripcion || ('Activo fijo #' + (idx + 1))).trim();
            var valorNeto = enteroPos(a.valorNetoPagado);
            var ivaNoRec = enteroPos(a.ivaNoRecuperable);
            var esTerreno = Boolean(a.esTerreno);
            var esUsado = Boolean(a.esUsado);
            var pagado = a.pagado !== false;
            var vidaNormal = Math.max(1, Math.round(num(a.vidaUtilNormalAnios) || 5));
            var mesesUso = Math.max(1, Math.min(12, Math.round(num(a.mesesUsoEjercicio) || 12)));
            var modalidad = String(a.modalidad14A || 'normal');

            var baseSinCm = esTerreno ? 0 : (valorNeto + ivaNoRec);
            var baseDep = esProPyme ? baseSinCm : Math.round(baseSinCm * factorIpc);
            var depNormal = 0;
            var depTrib = 0;
            var ddan = 0;
            var vidaAplicada = vidaNormal;
            var metodoAplicado = '';
            var obs = '';

            if (esTerreno) {
                metodoAplicado = 'Terreno (no depreciable)';
                obs = 'Los terrenos no se deprecian tributariamente (Oficio SII N°1292/2023).';
            } else if (esProPyme) {
                if (!pagado) {
                    metodoAplicado = 'Pendiente de pago';
                    obs = 'Régimen de flujo de caja: solo se rebaja el 100% cuando el activo queda pagado (Circ. SII 62/2020).';
                } else {
                    depTrib = baseDep;
                    depNormal = baseDep;
                    vidaAplicada = 1;
                    metodoAplicado = regimen.indexOf('14D8') === 0
                        ? 'Instantánea 100% (Art. 14 D N°8 -> N°3)'
                        : 'Instantánea 100% imperativa (Art. 14 D N°3)';
                    obs = esUsado
                        ? 'Aplica 100% también a bienes físicos usados pagados (Oficio SII N°715/2025).'
                        : 'Rebaja íntegra sin corrección monetaria y sin IVA recuperable.';
                }
            } else {
                depNormal = Math.min(baseDep, Math.round((baseDep / vidaNormal) * (mesesUso / 12)));
                if (modalidad === 'acelerada_1_3') {
                    if (esUsado) {
                        depTrib = depNormal;
                        metodoAplicado = 'Normal (usado no califica 1/3)';
                        obs = 'Art. 31 N°5: la acelerada 1/3 exige bienes nuevos o internados. Se aplica vida útil normal.';
                    } else if (vidaNormal < 3) {
                        depTrib = depNormal;
                        metodoAplicado = 'Normal (vida < 3 años)';
                        obs = 'Art. 31 N°5: requiere vida útil normal de al menos 3 años.';
                    } else {
                        vidaAplicada = Math.floor(vidaNormal / 3);
                        depTrib = Math.min(baseDep, Math.round((baseDep / vidaAplicada) * (mesesUso / 12)));
                        metodoAplicado = 'Acelerada 1/3 (' + vidaAplicada + ' años)';
                        obs = 'Diferencia vs normal solo rebaja IDPC y se controla en registro DDAN.';
                    }
                } else if (modalidad === 'ultra_1_10') {
                    if (!pymesMenor100k) {
                        depTrib = depNormal;
                        metodoAplicado = 'Normal (>100.000 UF)';
                        obs = 'Art. 31 N°5 bis exige promedio ingresos 3 años <= 100.000 UF.';
                    } else {
                        vidaAplicada = Math.max(1, Math.floor(vidaNormal / 10));
                        depTrib = Math.min(baseDep, Math.round((baseDep / vidaAplicada) * (mesesUso / 12)));
                        metodoAplicado = 'Ultrarápida 1/10 Art. 31 N°5 bis (' + vidaAplicada + ' años)';
                        obs = 'Aplica a bienes nuevos o usados; diferencia frente a normal va a DDAN.';
                    }
                } else {
                    depTrib = depNormal;
                    metodoAplicado = 'Normal LIR Art. 31 N°5 (' + vidaNormal + ' años)';
                    obs = mesesUso < 12 ? ('Cuota proporcional por ' + mesesUso + ' mes(es) de uso.') : 'Cuota anual lineal con CM Art. 41.';
                }
                ddan = Math.max(0, depTrib - depNormal);
            }

            var valorLibroFinal = esTerreno ? valorNeto : Math.max(0, baseDep - depTrib);
            totalBase += baseDep;
            totalTrib += depTrib;
            totalNorm += depNormal;
            totalDdan += ddan;

            return {
                id: a.id || ('AF-' + (idx + 1)),
                descripcion: desc,
                fechaCompra: String(a.fechaCompra || '').trim(),
                valorNetoPagado: valorNeto,
                ivaNoRecuperable: ivaNoRec,
                baseDepreciable: baseDep,
                esTerreno: esTerreno,
                esUsado: esUsado,
                pagado: pagado,
                vidaNormal: vidaNormal,
                vidaAplicada: vidaAplicada,
                mesesUso: mesesUso,
                metodoAplicado: metodoAplicado,
                depreciacionNormal: depNormal,
                depreciacionTributaria: depTrib,
                diferenciaDdan: ddan,
                valorLibroCierre: valorLibroFinal,
                observacion: obs
            };
        });

        var notaNormativa = esProPyme
            ? 'ProPyme (' + regimen + '): depreciación instantánea del 100% sobre valor neto pagado (sin IVA recuperable, sin terrenos y sin corrección monetaria). Obligatoria en 14 D N°3.'
            : 'Régimen 14 A: depreciación normal o acelerada (1/3 de la vida útil entera para bienes nuevos >= 3 años) con CM Art. 41. La diferencia acelerada vs normal se controla en DDAN.';

        return {
            regimen: regimen,
            esProPyme: esProPyme,
            factorIpcAplicado: factorIpc,
            totalBaseDepreciable: totalBase,
            totalDepreciacionTributaria: totalTrib,
            totalDepreciacionNormal: totalNorm,
            totalDiferenciaDdan: totalDdan,
            items: items,
            notaNormativa: notaNormativa
        };
    }

    // =========================================================
    // TOP 3: Conciliación Bancaria con Reglas + CxC/CxP Aging
    // =========================================================
    var REGLAS_CONCILIACION_DEFECTO = [
        { id: 'r-pos', patron: 'transbank|tbk|getnet|sumup|redelcom|webpay|mercado pago', tipo: 'abono', cuenta: '11050', nombreCuenta: 'Clientes por cobrar', motivo: 'Recaudación medios de pago' },
        { id: 'r-sii', patron: 'sii|tesorer|tgr|f29|formulario 29', tipo: 'cargo', cuenta: '21070', nombreCuenta: 'Impuestos F29 por pagar', motivo: 'Pago impuestos F29 / TGR' },
        { id: 'r-prev', patron: 'previred|afp|fonasa|isapre|ips|mutual|achs|ist', tipo: 'cargo', cuenta: '21035', nombreCuenta: 'Cotizaciones previsionales por pagar', motivo: 'Pago cotizaciones Previred' },
        { id: 'r-suel', patron: 'sueldo|remunerac|nomina|anticipo', tipo: 'cargo', cuenta: '21030', nombreCuenta: 'Remuneraciones por pagar', motivo: 'Pago sueldos líquidos' },
        { id: 'r-hon', patron: 'honorario|bhe', tipo: 'cargo', cuenta: '21025', nombreCuenta: 'Honorarios por pagar', motivo: 'Pago honorarios líquidos' },
        { id: 'r-bco', patron: 'comision|mantencion|mantención|iva comision|seguro cta', tipo: 'cargo', cuenta: '42040', nombreCuenta: 'Gastos generales y bancarios', motivo: 'Comisión o gasto bancario' },
        { id: 'r-gast', patron: 'arriendo|enel|chilectra|aguas|entel|movistar|vtr|supermercado|lider|jumbo', tipo: 'cargo', cuenta: '42040', nombreCuenta: 'Gastos generales y supermercados', motivo: 'Pago servicios o gasto operativo' }
    ];

    function normTxt(s) {
        return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function coincidePatron(texto, patron) {
        var normGlosa = normTxt(texto);
        return String(patron || '').split('|').some(function (tok) {
            var t = normTxt(tok).trim();
            return t.length >= 2 && normGlosa.indexOf(t) >= 0;
        });
    }

    function extraerRutDeTexto(texto) {
        var m = /(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/.exec(String(texto || ''));
        if (!m) return '';
        return m[1].replace(/\./g, '').toUpperCase();
    }

    function normRutSimple(r) {
        return String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
    }

    function buscarComboFacturas(pool, usados, targetMonto, maxN) {
        // Agrupa facturas no usadas del mismo RUT/razonSocial que sumen targetMonto (+-100)
        var grupos = {};
        for (var i = 0; i < pool.length; i++) {
            if (usados[i]) continue;
            var d = pool[i];
            if (!d || d.esResumen || d.resta) continue;
            var tot = enteroPos(d.total);
            if (!tot || tot >= targetMonto) continue;
            var key = normRutSimple(d.rut) || normTxt(d.razonSocial || '');
            if (!key) continue;
            if (!grupos[key]) grupos[key] = [];
            grupos[key].push({ idx: i, doc: d, total: tot });
        }
        var keys = Object.keys(grupos);
        for (var k = 0; k < keys.length; k++) {
            var arr = grupos[keys[k]];
            if (arr.length < 2) continue;
            // Busqueda exacta de 2 o 3 facturas (tope 25 items por emisor)
            var lim = Math.min(arr.length, 25);
            for (var a = 0; a < lim; a++) {
                for (var b = a + 1; b < lim; b++) {
                    var s2 = arr[a].total + arr[b].total;
                    if (Math.abs(s2 - targetMonto) <= 100) {
                        return [arr[a], arr[b]];
                    }
                    if (maxN >= 3) {
                        for (var c = b + 1; c < lim; c++) {
                            var s3 = s2 + arr[c].total;
                            if (Math.abs(s3 - targetMonto) <= 100) {
                                return [arr[a], arr[b], arr[c]];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    function docKeyFactura(d) {
        return String(d.tipoDoc || 33) + '-' + String(d.folio || 'sf') + '-' + (normRutSimple(d.rut) || 'sr');
    }

    function sugerirPatronDesdeMov(glosa, rut) {
        var r = normRutSimple(rut || extraerRutDeTexto(glosa));
        if (r && r.length >= 7) {
            return r.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + r.slice(-1);
        }
        var limpio = normTxt(glosa)
            .replace(/\b(tef|transferencia|transf|trf|pago|abono|cargo|deposito|dep|cta|cte|web|pac|pat|nro|folio|doc|factura|boleta)\b/g, ' ')
            .replace(/\b\d{4,}\b/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!limpio) return '';
        var partes = limpio.split(' ').filter(function (w) { return w.length >= 2; });
        return partes.slice(0, 3).join(' ');
    }

    function conciliarCartolaConReglas(movimientos, contexto) {
        var ctx = contexto || {};
        var ventasDocs = (ctx.ventas && Array.isArray(ctx.ventas.documentos)) ? ctx.ventas.documentos : [];
        var comprasDocs = (ctx.compras && Array.isArray(ctx.compras.documentos)) ? ctx.compras.documentos : [];
        var bheLista = Array.isArray(ctx.bheBoletas) ? ctx.bheBoletas : [];
        var f29TotalPagar = enteroPos(ctx.f29TotalPagar);
        var previredTotal = enteroPos(ctx.previredTotal);
        var reglasUsr = Array.isArray(ctx.reglas) ? ctx.reglas : [];
        var todasReglas = reglasUsr.concat(REGLAS_CONCILIACION_DEFECTO);
        var confirmados = (ctx.matchesConfirmados && typeof ctx.matchesConfirmados === 'object') ? ctx.matchesConfirmados : {};
        var descartados = (ctx.matchesDescartados && typeof ctx.matchesDescartados === 'object') ? ctx.matchesDescartados : {};
        var cuentasManuales = (ctx.cuentasManuales && typeof ctx.cuentasManuales === 'object') ? ctx.cuentasManuales : {};
        var modoSug = !!ctx.modoSugerencias;

        var usadosVentas = {};
        var usadosCompras = {};
        var usadosBhe = {};
        var f29Usado = false;
        var previredUsado = false;
        var foliosConciliados = { cxc: {}, cxp: {} };
        var filas = [];
        var porFactura = 0;
        var porRegla = 0;
        var sugeridos = 0;
        var sinConciliar = 0;
        var montoSinConciliar = 0;

        (Array.isArray(movimientos) ? movimientos : []).forEach(function (mov, idx) {
            var movId = mov.id || ('MOV-' + (idx + 1));
            var monto = enteroPos(mov.monto);
            var tipo = mov.tipo === 'abono' ? 'abono' : 'cargo';
            var glosa = String(mov.glosa || '').trim();
            var rutMov = normRutSimple(mov.rut || extraerRutDeTexto(glosa));
            var match = null;
            var pool = tipo === 'abono' ? ventasDocs : comprasDocs;
            var usados = tipo === 'abono' ? usadosVentas : usadosCompras;
            var carteraTipo = tipo === 'abono' ? 'cxc' : 'cxp';

            // 1A. Match Tipo A: RUT coincidente + monto exacto (+-$100) -> Conciliado automatico
            if (!descartados[movId] && rutMov) {
                for (var i = 0; i < pool.length; i++) {
                    if (usados[i]) continue;
                    var dA = pool[i];
                    if (dA.esResumen || dA.resta) continue;
                    var totalA = enteroPos(dA.total);
                    if (totalA > 0 && Math.abs(totalA - monto) <= 100 && normRutSimple(dA.rut) === rutMov) {
                        usados[i] = true;
                        var keyA = docKeyFactura(dA);
                        foliosConciliados[carteraTipo][keyA] = movId;
                        match = {
                            metodo: 'factura_rcv',
                            matchTipo: 'A',
                            estado: 'conciliado',
                            cuenta: tipo === 'abono' ? '11050' : '21010',
                            matchedKeys: [keyA],
                            matchedFolios: [String(dA.folio || 's/f')],
                            detalleMatch: 'DTE ' + dA.tipoDoc + ' folio ' + (dA.folio || 's/f') + ' · ' + (dA.razonSocial || dA.rut || 'Contraparte')
                        };
                        porFactura += 1;
                        break;
                    }
                }
            }

            // 1B. Match Tipo B: Monto exacto sin RUT (+-$100)
            if (!match && !descartados[movId]) {
                for (var j = 0; j < pool.length; j++) {
                    if (usados[j]) continue;
                    var dB = pool[j];
                    if (dB.esResumen || dB.resta) continue;
                    var totalB = enteroPos(dB.total);
                    if (totalB > 0 && Math.abs(totalB - monto) <= 100) {
                        usados[j] = true;
                        var keyB = docKeyFactura(dB);
                        var confirmadoB = !!confirmados[movId] || !modoSug;
                        if (confirmadoB) {
                            foliosConciliados[carteraTipo][keyB] = movId;
                            porFactura += 1;
                        } else {
                            sugeridos += 1;
                        }
                        match = {
                            metodo: 'factura_rcv',
                            matchTipo: 'B',
                            estado: confirmadoB ? 'conciliado' : 'sugerido',
                            cuenta: tipo === 'abono' ? '11050' : '21010',
                            matchedKeys: [keyB],
                            matchedFolios: [String(dB.folio || 's/f')],
                            detalleMatch: 'DTE ' + dB.tipoDoc + ' folio ' + (dB.folio || 's/f') + ' · ' + (dB.razonSocial || dB.rut || 'Contraparte')
                        };
                        break;
                    }
                }
            }

            // 1C. Match Tipo C: Pago agrupado (1 movimiento cubre 2 o 3 facturas del mismo emisor/receptor)
            if (!match && !descartados[movId]) {
                var combo = buscarComboFacturas(pool, usados, monto, 3);
                if (combo && combo.length >= 2) {
                    var fols = [];
                    var keysC = [];
                    var confirmadoC = !!confirmados[movId] || !modoSug;
                    combo.forEach(function (it) {
                        usados[it.idx] = true;
                        var kC = docKeyFactura(it.doc);
                        keysC.push(kC);
                        fols.push('F.' + (it.doc.folio || 's/f'));
                        if (confirmadoC) foliosConciliados[carteraTipo][kC] = movId;
                    });
                    if (confirmadoC) porFactura += 1;
                    else sugeridos += 1;
                    var emisorC = combo[0].doc.razonSocial || combo[0].doc.rut || 'Mismo RUT';
                    match = {
                        metodo: 'factura_rcv',
                        matchTipo: 'C',
                        estado: confirmadoC ? 'conciliado' : 'sugerido',
                        cuenta: tipo === 'abono' ? '11050' : '21010',
                        matchedKeys: keysC,
                        matchedFolios: fols,
                        detalleMatch: 'Pago agrupado (' + fols.join(' + ') + ') · ' + emisorC
                    };
                }
            }

            // 1D. Cruce contra BHE vigentes, F29 (cod. 91) y PreviRed del periodo cuando no calzo factura RCV
            if (!match && !descartados[movId] && tipo === 'cargo') {
                for (var b = 0; b < bheLista.length; b++) {
                    if (usadosBhe[b]) continue;
                    var bhe = bheLista[b];
                    if (!bhe || String(bhe.estado || 'VIGENTE').toUpperCase() === 'ANULADA') continue;
                    var liqBhe = enteroPos(bhe.liquido != null ? bhe.liquido : (bhe.montoLiquido != null ? bhe.montoLiquido : (enteroPos(bhe.bruto) - enteroPos(bhe.retenido))));
                    var rutBhe = normRutSimple(bhe.rut);
                    if (liqBhe > 0 && Math.abs(liqBhe - monto) <= 100 && (!rutMov || !rutBhe || rutMov === rutBhe)) {
                        usadosBhe[b] = true;
                        var okBhe = !!confirmados[movId] || (!modoSug && !!rutMov && rutMov === rutBhe);
                        if (okBhe) porRegla += 1;
                        else sugeridos += 1;
                        match = {
                            metodo: 'bhe',
                            matchTipo: 'BHE',
                            estado: okBhe ? 'conciliado' : 'sugerido',
                            cuenta: '21025',
                            matchedKeys: [],
                            matchedFolios: [String(bhe.folio || bhe.numero || 's/f')],
                            detalleMatch: 'BHE #' + (bhe.folio || bhe.numero || 's/f') + ' · ' + (bhe.razonSocial || bhe.emisor || bhe.rut || 'Profesional')
                        };
                        break;
                    }
                }
                if (!match && !f29Usado && f29TotalPagar > 0 && Math.abs(f29TotalPagar - monto) <= 100) {
                    f29Usado = true;
                    var okF29 = !!confirmados[movId];
                    if (okF29) porRegla += 1;
                    else sugeridos += 1;
                    match = {
                        metodo: 'obligacion',
                        matchTipo: 'F29',
                        estado: okF29 ? 'conciliado' : 'sugerido',
                        cuenta: '21070',
                        matchedKeys: [],
                        matchedFolios: [],
                        detalleMatch: 'Pago F29 del período (cód. 91)'
                    };
                }
                if (!match && !previredUsado && previredTotal > 0 && Math.abs(previredTotal - monto) <= 100) {
                    previredUsado = true;
                    var okPrev = !!confirmados[movId];
                    if (okPrev) porRegla += 1;
                    else sugeridos += 1;
                    match = {
                        metodo: 'obligacion',
                        matchTipo: 'PREVIRED',
                        estado: okPrev ? 'conciliado' : 'sugerido',
                        cuenta: '21035',
                        matchedKeys: [],
                        matchedFolios: [],
                        detalleMatch: 'Pago cotizaciones PreviRed del período'
                    };
                }
            }

            // 2. Si no calza con factura ni obligacion, evaluar reglas de contraparte (usuario primero, defecto después)
            if (!match) {
                for (var r = 0; r < todasReglas.length; r++) {
                    var regla = todasReglas[r];
                    var tipoOk = !regla.tipo || regla.tipo === 'ambos' || regla.tipo === tipo;
                    if (tipoOk && coincidePatron(glosa, regla.patron)) {
                        match = {
                            metodo: 'regla',
                            matchTipo: 'REGLA',
                            estado: 'conciliado',
                            cuenta: String(regla.cuenta || '42040'),
                            matchedKeys: [],
                            matchedFolios: [],
                            detalleMatch: regla.motivo || regla.nombreCuenta || ('Regla "' + regla.patron + '"')
                        };
                        porRegla += 1;
                        break;
                    }
                }
            }

            if (!match) {
                if (confirmados[movId]) {
                    porRegla += 1;
                    match = {
                        metodo: 'manual',
                        matchTipo: 'MANUAL',
                        estado: 'conciliado',
                        cuenta: mov.cuentaSugerida || (tipo === 'abono' ? '11050' : '42040'),
                        matchedKeys: [],
                        matchedFolios: [],
                        detalleMatch: 'Cuenta asignada y confirmada manualmente'
                    };
                } else {
                    sinConciliar += 1;
                    montoSinConciliar += monto;
                    match = {
                        metodo: 'pendiente',
                        matchTipo: 'PENDIENTE',
                        estado: 'pendiente',
                        cuenta: mov.cuentaSugerida || (tipo === 'abono' ? '11050' : '42040'),
                        matchedKeys: [],
                        matchedFolios: [],
                        detalleMatch: 'Sin regla ni factura coincidente; elige cuenta y confirma'
                    };
                }
            }

            if (cuentasManuales[movId]) {
                match.cuenta = String(cuentasManuales[movId]);
            }

            var asientoPropuesto = {
                debe: tipo === 'abono' ? '11010' : match.cuenta,
                haber: tipo === 'abono' ? match.cuenta : '11010',
                monto: monto
            };

            filas.push({
                id: movId,
                fecha: mov.fecha || '',
                glosa: glosa,
                rut: rutMov,
                tipo: tipo,
                monto: monto,
                estado: match.estado,
                metodo: match.metodo,
                matchTipo: match.matchTipo,
                cuenta: match.cuenta,
                asientoPropuesto: asientoPropuesto,
                matchedKeys: match.matchedKeys,
                matchedFolios: match.matchedFolios,
                detalleMatch: match.detalleMatch
            });
        });

        var total = filas.length;
        var pctConciliado = total > 0 ? Math.round(((porFactura + porRegla) / total) * 100) : 0;

        return {
            filas: filas,
            foliosConciliados: foliosConciliados,
            resumen: {
                totalMovimientos: total,
                porFactura: porFactura,
                porRegla: porRegla,
                sugeridos: sugeridos,
                sinConciliar: sinConciliar,
                pctConciliado: pctConciliado,
                montoSinConciliar: montoSinConciliar
            }
        };
    }

    function parseFechaIso(fechaRaw, periodoDefecto) {
        var s = String(fechaRaw || '').trim();
        var mIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (mIso) return new Date(Number(mIso[1]), Number(mIso[2]) - 1, Number(mIso[3]));
        var mCl = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
        if (mCl) return new Date(Number(mCl[3]), Number(mCl[2]) - 1, Number(mCl[1]));
        var p = /^(\d{4})-(\d{2})$/.exec(String(periodoDefecto || '2026-11'));
        if (p) return new Date(Number(p[1]), Number(p[2]) - 1, 15);
        return new Date(2026, 10, 15);
    }

    function fechaCortePeriodo(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || '2026-11'));
        if (!m) return new Date(2026, 10, 30);
        return new Date(Number(m[1]), Number(m[2]), 0);
    }

    function calcularAgingDocumentos(ventas, compras, periodo, opciones) {
        var opts = opciones || {};
        var modoReal = !!opts.modoReal;
        var pctCobro = opts.pctVentasCobradas != null ? num(opts.pctVentasCobradas) : 80;
        var pctPago = opts.pctComprasPagadas != null ? num(opts.pctComprasPagadas) : 75;
        var carteraEstado = (opts.carteraEstado && typeof opts.carteraEstado === 'object') ? opts.carteraEstado : {};
        var foliosConc = (opts.foliosConciliados && typeof opts.foliosConciliados === 'object') ? opts.foliosConciliados : {};
        var corte = fechaCortePeriodo(periodo);

        function armarCartera(docs, factorPendiente, tipoCartera) {
            var buckets = { dias_0_30: 0, dias_31_60: 0, dias_mas_60: 0 };
            var items = [];
            var todosItems = [];
            var total = 0;
            var estManuales = carteraEstado[tipoCartera] || {};
            var concMap = foliosConc[tipoCartera] || {};

            (Array.isArray(docs) ? docs : []).forEach(function (d) {
                if (!d || d.esResumen || d.resta) return;
                var bruto = enteroPos(d.total);
                if (!bruto) return;
                var dKey = docKeyFactura(d);
                var manualEst = estManuales[dKey];
                var esConc = !!concMap[dKey];

                var estadoPago = 'PENDIENTE';
                var saldo = bruto;
                if (modoReal || manualEst || esConc) {
                    if (manualEst === 'PAGADA') {
                        estadoPago = 'PAGADA';
                        saldo = 0;
                    } else if (manualEst === 'PENDIENTE') {
                        estadoPago = 'PENDIENTE';
                        saldo = bruto;
                    } else if (esConc) {
                        estadoPago = 'CONCILIADA';
                        saldo = 0;
                    }
                } else {
                    saldo = Math.round(bruto * (factorPendiente / 100));
                    if (saldo <= 0) return;
                }

                var fDoc = parseFechaIso(d.fecha, periodo);
                var dias = Math.max(0, Math.round((corte.getTime() - fDoc.getTime()) / 86400000));
                var tramo = dias <= 30 ? '0-30 días' : (dias <= 60 ? '31-60 días' : '+60 días');
                if (saldo > 0) {
                    if (dias <= 30) buckets.dias_0_30 += saldo;
                    else if (dias <= 60) buckets.dias_31_60 += saldo;
                    else buckets.dias_mas_60 += saldo;
                    total += saldo;
                }

                var row = {
                    docKey: dKey,
                    tipoDoc: d.tipoDoc,
                    folio: d.folio || 's/f',
                    rut: d.rut || '-',
                    razonSocial: d.razonSocial || 'Sin razón social',
                    fecha: d.fecha || String(periodo || ''),
                    dias: dias,
                    tramo: tramo,
                    estadoPago: estadoPago,
                    montoOriginal: bruto,
                    saldoPendiente: saldo
                };
                todosItems.push(row);
                if (saldo > 0) items.push(row);
            });
            items.sort(function (a, b) { return b.dias - a.dias || b.saldoPendiente - a.saldoPendiente; });
            todosItems.sort(function (a, b) {
                var aPend = a.saldoPendiente > 0 ? 0 : 1;
                var bPend = b.saldoPendiente > 0 ? 0 : 1;
                return aPend - bPend || b.dias - a.dias || b.montoOriginal - a.montoOriginal;
            });
            return { total: total, buckets: buckets, items: items, todosItems: todosItems };
        }

        return {
            periodoCorte: String(periodo || '2026-11'),
            cxc: armarCartera(ventas && ventas.documentos, Math.max(0, 100 - pctCobro), 'cxc'),
            cxp: armarCartera(compras && compras.documentos, Math.max(0, 100 - pctPago), 'cxp')
        };
    }

    // =========================================================
    // TOP 4: Propuesta F22 (IDPC vs PPM reajustado Cód. 36 L85)
    // =========================================================
    function tasaIdpcPorRegimen(regimen, anioTributario) {
        var r = String(regimen || '14D3').toUpperCase();
        var at = Math.round(num(anioTributario) || 2026);
        if (r === '14D8' || r === '14D8_MAYOR') {
            return { tasa: 0, fuente: 'LIR art. 14 D N°8 (empresa liberada de IDPC; propietarios tributan con IGC/IA)' };
        }
        if (r === '14A') {
            var tasa14a = at <= 2027 ? 27 : (at === 2028 ? 25.5 : (at === 2029 ? 24 : 23));
            return { tasa: tasa14a, fuente: 'Régimen General 14 A (' + tasa14a + '% en AT ' + at + ')' };
        }
        var tasaPyme = at <= 2028 ? 12.5 : (at === 2029 ? 15 : 23);
        return { tasa: tasaPyme, fuente: 'Art. 25 Ley 21.755 · Circ. SII N°53/2025 (' + tasaPyme + '% en AT ' + at + ')' };
    }

    function calcularPropuestaF22(entrada) {
        var e = entrada || {};
        var regimen = String(e.regimen || '14D3').toUpperCase();
        var at = Math.round(num(e.anioTributario) || 2026);
        var rliSigned = Math.round(num(e.baseImponibleRli));
        var basePositiva = Math.max(0, rliSigned);
        var infoIdpc = tasaIdpcPorRegimen(regimen, at);
        var idpcDeterminado = Math.round(basePositiva * (infoIdpc.tasa / 100));

        var ppmNominalTotal = 0;
        var ppmReajustadoTotal = 0;
        if (Array.isArray(e.ppmNominales) && e.ppmNominales.length) {
            e.ppmNominales.forEach(function (item) {
                var m = enteroPos(item.monto);
                var f = Math.max(1, num(item.factor) || 1);
                ppmNominalTotal += m;
                ppmReajustadoTotal += Math.round(m * f);
            });
        } else {
            ppmNominalTotal = enteroPos(e.ppmPagadoTotal);
            var facProm = Math.max(1, num(e.factorPromedioPpm) || 1.018);
            ppmReajustadoTotal = Math.round(ppmNominalTotal * facProm);
        }

        var esTransparente = regimen === '14D8' || regimen === '14D8_MAYOR';
        var otrosCreditos = esTransparente ? 0 : enteroPos(e.otrosCreditos);
        var ppmCod36Empresa = esTransparente ? 0 : ppmReajustadoTotal;
        var ppmDj1947Socios = esTransparente ? ppmReajustadoTotal : 0;

        var saldoAPagar = esTransparente ? 0 : Math.max(0, idpcDeterminado - ppmCod36Empresa - otrosCreditos);
        var devolucionF22 = esTransparente ? 0 : Math.max(0, (ppmCod36Empresa + otrosCreditos) - idpcDeterminado);

        var lineasF22 = esTransparente
            ? [
                { codigo: 'Base 14 D8', concepto: 'Renta líquida determinada a distribuir a propietarios (DJ 1947)', monto: basePositiva },
                { codigo: 'IDPC', concepto: 'Impuesto de Primera Categoría empresa (0% · 14 D N°8)', monto: 0 },
                { codigo: 'DJ 1947 / 1645', concepto: 'PPM reajustado puesto a disposición de socios (NO va en línea 85 cód. 36)', monto: ppmDj1947Socios },
                { codigo: 'F22 Empresa', concepto: 'Saldo de IDPC a pagar por la sociedad', monto: 0 }
            ]
            : [
                { codigo: 'RLI / 18', concepto: rliSigned >= 0 ? 'Renta Líquida Imponible / Base imponible ProPyme' : 'Pérdida tributaria del ejercicio', monto: rliSigned },
                { codigo: 'Línea 54', concepto: 'IDPC determinado (' + infoIdpc.tasa + '%)', monto: idpcDeterminado },
                { codigo: 'L85 / Cód. 36', concepto: 'Menos: PPM obligatorios y voluntarios reajustados (cód. 1904/1905/1906)', monto: -ppmCod36Empresa },
                { codigo: 'Créditos', concepto: 'Menos: Otros créditos imputables al IDPC', monto: -otrosCreditos },
                saldoAPagar > 0
                    ? { codigo: 'Línea 91', concepto: 'Impuesto Renta F22 estimado a pagar', monto: saldoAPagar, destacado: 'pagar' }
                    : { codigo: 'Línea 92', concepto: 'Remanente / Devolución de PPM a solicitar en F22', monto: devolucionF22, destacado: 'devolucion' }
            ];

        return {
            regimen: regimen,
            anioTributario: at,
            esTransparente: esTransparente,
            baseImponibleRli: rliSigned,
            tasaIdpc: infoIdpc.tasa,
            fuenteTasa: infoIdpc.fuente,
            idpcDeterminado: idpcDeterminado,
            ppmNominalTotal: ppmNominalTotal,
            ppmReajustadoTotal: ppmReajustadoTotal,
            ppmCod36Empresa: ppmCod36Empresa,
            ppmDj1947Socios: ppmDj1947Socios,
            otrosCreditos: otrosCreditos,
            saldoAPagar: saldoAPagar,
            devolucionF22: devolucionF22,
            lineasF22: lineasF22,
            notaNormativa: esTransparente
                ? '14 D N°8: la empresa no paga IDPC (0%) ni imputa PPM en F22 línea 85 cód. 36; los PPM actualizados van en la DJ 1947 hacia el F22 código 1645 de cada socio.'
                : 'En F22 el PPM se declara en línea 85, código 36 (sumatoria de 1904/1905/1906/1916 reajustados por factor SII del mes de pago efectivo).'
        };
    }

    var api = {
        auditarF29PreSii: auditarF29PreSii,
        generarResumenWhatsappCliente: generarResumenWhatsappCliente,
        tasaHonorariosEsperada: tasaHonorariosEsperada,
        tasaPpmEsperadaProPyme: tasaPpmEsperadaProPyme,
        calcularActivoFijoTributario: calcularActivoFijoTributario,
        REGLAS_CONCILIACION_DEFECTO: REGLAS_CONCILIACION_DEFECTO,
        sugerirPatronDesdeMov: sugerirPatronDesdeMov,
        conciliarCartolaConReglas: conciliarCartolaConReglas,
        calcularAgingDocumentos: calcularAgingDocumentos,
        tasaIdpcPorRegimen: tasaIdpcPorRegimen,
        calcularPropuestaF22: calcularPropuestaF22
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CLContadoresAsistentePro = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
