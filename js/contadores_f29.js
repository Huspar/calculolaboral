/*
 * CalculoLaboral · Lector RCV SII y motor Formulario 29 (Suite Contadores, v1.0.0)
 * Funciona en el navegador (window.CLContadoresF29) y en Node (require).
 *
 * Codigos verificados contra Instrucciones Oficiales F29 SII y Circular 53/2025:
 *   Debitos: 503/502 facturas giro, 716/717 fuera del giro/activo fijo, 110/111 boletas manuales,
 *            758/759 comprobantes pago electronico, 512/513 ND emitidas, 509/510 NC emitidas (restan),
 *            538 total debitos. Resumen tipo 39 (boletas electronicas RCV) se informa separado y suma a 538.
 *   Creditos: 519/520 facturas giro, 761/762 supermercados, 524/525 activo fijo, 531/532 ND recibidas,
 *             527/528 NC recibidas (restan), 504 remanente anterior, 537 total creditos.
 *   Determinacion IVA: 538 - 537 -> si > 0 va a cod. 89 (impuesto determinado); si <= 0 va a cod. 77 (remanente).
 *   Retenciones y PPM: 48 Impuesto Unico 2a Cat., 151 Honorarios (15,25% en 2026, Ley 21.133),
 *                      563 base PPM, 115 tasa PPM parametrizable, 62 PPM neto determinado.
 *   Total a pagar: 91 = 89 + 48 + 151 + 62 (sin ceros a la izquierda en ningun codigo).
 */
(function (root) {
    'use strict';

    var HON = (typeof module !== 'undefined' && module.exports)
        ? require('./pyme_honorarios.js')
        : root.CLPymeHonorarios;

    var REGIMENES = {
        '14D3': { codigo: '14D3', nombre: 'ProPyme General (Art. 14 D N°3 <= 50.000 UF)', tasaPpmDefecto: 0.125, tasaEditable: true },
        '14D3_MAYOR': { codigo: '14D3_MAYOR', nombre: 'ProPyme General (Art. 14 D N°3 > 50.000 UF)', tasaPpmDefecto: 0.25, tasaEditable: true },
        '14D8': { codigo: '14D8', nombre: 'ProPyme Transparente (Art. 14 D N°8 <= 50.000 UF)', tasaPpmDefecto: 0.2, tasaEditable: true },
        '14D8_MAYOR': { codigo: '14D8_MAYOR', nombre: 'ProPyme Transparente (Art. 14 D N°8 > 50.000 UF)', tasaPpmDefecto: 0.5, tasaEditable: true },
        '14A': { codigo: '14A', nombre: 'Regimen General Semi Integrado (Art. 14 A, tasa variable)', tasaPpmDefecto: 0, tasaEditable: true }
    };

    function norm(s) {
        return String(s == null ? '' : s)
            .trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function entero(v) {
        if (v == null || v === '') return 0;
        if (typeof v === 'number') return Math.max(0, Math.round(v));
        var s = String(v).trim().replace(/\$/g, '').replace(/\s+/g, '');
        if (!s) return 0;
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
        else s = s.replace(/,/g, '');
        var n = Math.round(parseFloat(s));
        return isNaN(n) ? 0 : Math.abs(n);
    }

    function partirLineaCsv(linea, sep) {
        var out = [], cur = '', enComillas = false;
        for (var i = 0; i < linea.length; i++) {
            var ch = linea[i];
            if (ch === '"') {
                if (enComillas && linea[i + 1] === '"') { cur += '"'; i++; }
                else enComillas = !enComillas;
            } else if (ch === sep && !enComillas) {
                out.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur.trim());
        return out;
    }

    function parsearCsvTexto(texto) {
        var limpio = String(texto == null ? '' : texto).replace(/^\uFEFF/, '');
        var lineas = limpio.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
        if (!lineas.length) return [];
        var primera = lineas[0];
        var sep = (primera.split(';').length >= primera.split(',').length) ? ';' : ',';
        var cabeceras = partirLineaCsv(primera, sep);
        var filas = [];
        for (var i = 1; i < lineas.length; i++) {
            var cols = partirLineaCsv(lineas[i], sep);
            if (!cols.some(function (c) { return c !== ''; })) continue;
            var obj = {};
            for (var j = 0; j < cabeceras.length; j++) {
                if (cabeceras[j]) obj[cabeceras[j]] = cols[j] !== undefined ? cols[j] : '';
            }
            filas.push(obj);
        }
        return filas;
    }

    var ALIAS_RCV = {
        tipoDoc: ['tipo_doc', 'tipo_documento', 'cod_tipo_doc', 'dte', 'tipo_dte'],
        folio: ['folio', 'nro', 'numero', 'nro_doc', 'folio_doc'],
        rut: ['rut_contraparte', 'rut_proveedor', 'rut_cliente', 'rut_receptor', 'rut_emisor', 'rut'],
        razonSocial: ['razon_social_contraparte', 'razon_social', 'nombre_contraparte', 'proveedor', 'cliente'],
        fecha: ['fecha_emision', 'fecha_docto', 'fecha_documento', 'fecha'],
        exento: ['monto_exento', 'exento'],
        neto: ['monto_neto', 'neto'],
        iva: ['monto_iva_recuperable', 'monto_iva', 'iva_recuperable', 'iva'],
        ivaNoRec: ['monto_iva_no_rec', 'monto_iva_no_recuperable', 'iva_no_recuperable', 'iva_no_rec'],
        ivaUsoComun: ['iva_uso_comun', 'monto_iva_uso_comun'],
        netoActivoFijo: ['monto_activo_fijo', 'neto_activo_fijo', 'monto_neto_activo_fijo'],
        ivaActivoFijo: ['monto_iva_activo_fijo', 'iva_activo_fijo'],
        total: ['monto_total', 'total'],
        tipoTransaccion: ['tipo_transaccion', 'tipo_compra', 'tipo_venta', 'clasificacion']
    };

    function mapearFilaRcv(raw) {
        var n = {};
        Object.keys(raw || {}).forEach(function (k) { n[norm(k)] = raw[k]; });
        function leer(campo) {
            var lista = ALIAS_RCV[campo] || [];
            for (var i = 0; i < lista.length; i++) {
                var v = n[lista[i]];
                if (v !== undefined && v !== '') return v;
            }
            return '';
        }
        var tipoRaw = String(leer('tipoDoc')).trim();
        var mTipo = tipoRaw.match(/\d+/);
        var tipoDoc = mTipo ? Number(mTipo[0]) : 0;
        var folioRaw = String(leer('folio')).trim();
        var exento = entero(leer('exento'));
        var neto = entero(leer('neto'));
        var iva = entero(leer('iva'));
        var ivaNoRec = entero(leer('ivaNoRec'));
        var ivaUsoComun = entero(leer('ivaUsoComun'));
        var netoAF = entero(leer('netoActivoFijo'));
        var ivaAF = entero(leer('ivaActivoFijo'));
        var total = entero(leer('total'));
        if (!total && (exento || neto || iva || ivaNoRec || ivaAF)) {
            total = exento + neto + iva + ivaNoRec + ivaUsoComun + ivaAF;
        }
        return {
            tipoDoc: tipoDoc,
            folio: folioRaw,
            rut: String(leer('rut')).trim(),
            razonSocial: String(leer('razonSocial')).trim(),
            fecha: String(leer('fecha')).trim(),
            exento: exento,
            neto: neto,
            iva: iva,
            ivaNoRec: ivaNoRec,
            ivaUsoComun: ivaUsoComun,
            netoActivoFijo: netoAF,
            ivaActivoFijo: ivaAF,
            total: total,
            tipoTransaccion: String(leer('tipoTransaccion')).trim()
        };
    }

    function esSupermercado(doc) {
        var t = norm(doc.tipoTransaccion);
        if (t === '2' || /supermercado|comercio_similar/.test(t)) return true;
        return /supermercado|hipermercado|lider|jumbo|unimarc|santa_isabel|tottus/i.test(doc.razonSocial);
    }

    function esActivoFijo(doc) {
        if (doc.ivaActivoFijo > 0 || doc.netoActivoFijo > 0) return true;
        var t = norm(doc.tipoTransaccion);
        return t === '4' || /activo_fijo/.test(t);
    }

    function esVentaFueraGiro(doc) {
        if (doc.netoActivoFijo > 0 || doc.ivaActivoFijo > 0) return true;
        var t = norm(doc.tipoTransaccion);
        return t === '4' || /activo_fijo|fuera_del_giro|no_giro/.test(t);
    }

    function cantidadResumenBoletas(doc) {
        var n = entero(doc.folio);
        return n > 0 ? n : 1;
    }

    function parsearRcv(entrada, modo) {
        var filasRaw = typeof entrada === 'string' ? parsearCsvTexto(entrada) : (Array.isArray(entrada) ? entrada : []);
        var docs = [], avisos = [], omitidas = 0;

        filasRaw.forEach(function (r, idx) {
            var d = mapearFilaRcv(r);
            if (!d.tipoDoc) { omitidas++; return; }
            d.esResumen = (d.tipoDoc === 39 || d.tipoDoc === 41);
            d.resta = (d.tipoDoc === 60 || d.tipoDoc === 61);
            if (!d.esResumen && !d.rut && modo !== 'ventas') {
                avisos.push('Fila ' + (idx + 2) + ' (DTE ' + d.tipoDoc + ' folio ' + (d.folio || 's/f') + '): sin RUT contraparte.');
            }
            docs.push(d);
        });

        var res = {
            modo: modo || 'ventas',
            documentos: docs,
            omitidas: omitidas,
            avisos: avisos,
            netoGiro: 0,
            exentoGiro: 0,
            ivaGiro: 0,
            cantFacturasGiro: 0,
            cantFueraGiro: 0,
            netoFueraGiro: 0,
            ivaFueraGiro: 0,
            cantBoletas39: 0,
            netoBoletas39: 0,
            ivaBoletas39: 0,
            exentoBoletas41: 0,
            cantSupermercado: 0,
            netoSupermercado: 0,
            ivaSupermercado: 0,
            cantActivoFijo: 0,
            netoActivoFijo: 0,
            ivaActivoFijo: 0,
            ivaNoRecuperable: 0,
            cantNotasDebito: 0,
            netoNotasDebito: 0,
            ivaNotasDebito: 0,
            cantNotasCredito: 0,
            netoNotasCredito: 0,
            ivaNotasCredito: 0
        };

        docs.forEach(function (d) {
            if (modo === 'compras') {
                if (d.tipoDoc === 60 || d.tipoDoc === 61) {
                    res.cantNotasCredito += 1;
                    res.netoNotasCredito += d.neto;
                    res.ivaNotasCredito += d.iva + d.ivaActivoFijo;
                } else if (d.tipoDoc === 55 || d.tipoDoc === 56) {
                    res.cantNotasDebito += 1;
                    res.netoNotasDebito += d.neto;
                    res.ivaNotasDebito += d.iva;
                } else if (d.tipoDoc === 32 || d.tipoDoc === 34) {
                    res.exentoGiro += d.exento || d.total;
                } else if (esActivoFijo(d)) {
                    res.cantActivoFijo += 1;
                    res.netoActivoFijo += d.netoActivoFijo || d.neto;
                    res.ivaActivoFijo += d.ivaActivoFijo || d.iva;
                    res.ivaNoRecuperable += d.ivaNoRec;
                } else if (esSupermercado(d)) {
                    res.cantSupermercado += 1;
                    res.netoSupermercado += d.neto;
                    res.ivaSupermercado += d.iva;
                    res.ivaNoRecuperable += d.ivaNoRec;
                } else if ([30, 33, 40, 43, 45, 46].indexOf(d.tipoDoc) >= 0) {
                    res.cantFacturasGiro += 1;
                    res.netoGiro += d.neto;
                    res.exentoGiro += d.exento;
                    res.ivaGiro += d.iva + d.ivaUsoComun;
                    res.ivaNoRecuperable += d.ivaNoRec;
                }
            } else {
                // Ventas
                if (d.tipoDoc === 60 || d.tipoDoc === 61) {
                    res.cantNotasCredito += 1;
                    res.netoNotasCredito += d.neto;
                    res.exentoGiro = Math.max(0, res.exentoGiro - d.exento);
                    res.ivaNotasCredito += d.iva;
                } else if (d.tipoDoc === 55 || d.tipoDoc === 56) {
                    res.cantNotasDebito += 1;
                    res.netoNotasDebito += d.neto;
                    res.ivaNotasDebito += d.iva;
                } else if (d.tipoDoc === 39) {
                    res.cantBoletas39 += cantidadResumenBoletas(d);
                    var netoBol = d.neto || (d.total > d.iva ? d.total - d.iva - d.exento : 0);
                    res.netoBoletas39 += netoBol;
                    res.ivaBoletas39 += d.iva;
                    res.exentoGiro += d.exento;
                } else if (d.tipoDoc === 41) {
                    res.exentoBoletas41 += d.exento || d.total;
                } else if (d.tipoDoc === 32 || d.tipoDoc === 34) {
                    res.exentoGiro += d.exento || d.total;
                } else if (esVentaFueraGiro(d)) {
                    res.cantFueraGiro += 1;
                    res.netoFueraGiro += d.netoActivoFijo || d.neto;
                    res.ivaFueraGiro += d.ivaActivoFijo || d.iva;
                } else if ([30, 33, 40, 43, 45, 46].indexOf(d.tipoDoc) >= 0) {
                    res.cantFacturasGiro += 1;
                    res.netoGiro += d.neto;
                    res.exentoGiro += d.exento;
                    res.ivaGiro += d.iva;
                }
            }
        });

        return res;
    }

    function calcularF29(entrada) {
        var e = entrada || {};
        var v = e.ventas || parsearRcv([], 'ventas');
        var c = e.compras || parsearRcv([], 'compras');
        var reg = REGIMENES[e.regimen] || REGIMENES['14D3'];
        var anio = Number(String(e.periodo || '2026-10').slice(0, 4)) || 2026;

        // Debitos F29
        var cod503 = entero(v.cantFacturasGiro);
        var cod502 = entero(v.ivaGiro);
        var cod716 = entero(v.cantFueraGiro);
        var cod717 = entero(v.ivaFueraGiro);
        var cod110 = entero(e.cantBoletasManuales);
        var cod111 = entero(e.ivaBoletasManuales);
        var cod758 = entero(e.cantComprobantesPago);
        var cod759 = entero(e.ivaComprobantesPago);
        var ivaBoletasElectronicas = entero(v.ivaBoletas39);
        var cantBoletasElectronicas = entero(v.cantBoletas39);
        var cod512 = entero(v.cantNotasDebito);
        var cod513 = entero(v.ivaNotasDebito);
        var cod509 = entero(v.cantNotasCredito);
        var cod510 = entero(v.ivaNotasCredito);

        var sumaDebitos = cod502 + cod717 + cod111 + cod759 + ivaBoletasElectronicas + cod513 - cod510;
        var cod538 = Math.max(0, sumaDebitos);

        // Creditos F29
        var cod519 = entero(c.cantFacturasGiro);
        var cod520 = entero(c.ivaGiro);
        var cod761 = entero(c.cantSupermercado);
        var cod762 = entero(c.ivaSupermercado);
        var cod524 = entero(c.cantActivoFijo);
        var cod525 = entero(c.ivaActivoFijo);
        var cod531 = entero(c.cantNotasDebito);
        var cod532 = entero(c.ivaNotasDebito);
        var cod527 = entero(c.cantNotasCredito);
        var cod528 = entero(c.ivaNotasCredito);
        var cod504 = entero(e.remanenteAnterior);

        var sumaCreditos = cod520 + cod762 + cod525 + cod532 - cod528 + cod504;
        var cod537 = Math.max(0, sumaCreditos);

        // Determinacion IVA: 538 - 537
        var difIva = cod538 - cod537;
        var cod89 = difIva > 0 ? difIva : 0;
        var cod77 = difIva < 0 ? Math.abs(difIva) : 0;

        // Retenciones 2a categoria
        var cod48 = entero(e.impuestoUnico48);
        var cod151 = 0;
        var honorariosBruto = 0;
        var honorariosLiquido = 0;
        var tasaHonorarios = HON && HON.tasa ? HON.tasa(anio) : 0.1525;

        if (Array.isArray(e.boletasHonorarios) && e.boletasHonorarios.length && HON) {
            var rHon = HON.resumen(e.boletasHonorarios.map(function (b) {
                return Object.assign({ fecha: String(e.periodo || '2026-10') + '-15', retiene: 'empresa' }, b);
            }));
            cod151 = rHon.retenidoEmpresa;
            honorariosBruto = rHon.bruto;
            honorariosLiquido = rHon.liquidoPagado;
        } else if (e.honorariosRetencionDirecta !== undefined && e.honorariosRetencionDirecta !== null && e.honorariosRetencionDirecta !== '') {
            cod151 = entero(e.honorariosRetencionDirecta);
            honorariosBruto = entero(e.honorariosBruto) || (tasaHonorarios ? Math.round(cod151 / tasaHonorarios) : 0);
            honorariosLiquido = Math.max(0, honorariosBruto - cod151);
        } else if (entero(e.honorariosBruto) > 0) {
            honorariosBruto = entero(e.honorariosBruto);
            cod151 = Math.round(honorariosBruto * (tasaHonorarios || 0.1525));
            honorariosLiquido = honorariosBruto - cod151;
        }

        // PPM obligatorio 1a categoria
        var ingresosNetosGiro = Math.max(0,
            entero(v.netoGiro) +
            entero(v.exentoGiro) +
            entero(v.netoBoletas39) +
            entero(v.exentoBoletas41) +
            entero(v.netoNotasDebito) -
            entero(v.netoNotasCredito)
        );
        var cod563 = e.basePpmManual !== undefined && e.basePpmManual !== null && e.basePpmManual !== ''
            ? entero(e.basePpmManual)
            : ingresosNetosGiro;

        var tasa115 = (e.tasaPpm !== undefined && e.tasaPpm !== null && e.tasaPpm !== '')
            ? Math.max(0, Number(e.tasaPpm) || 0)
            : reg.tasaPpmDefecto;
        var cod62 = Math.round(cod563 * (tasa115 / 100));

        // Total a pagar dentro del plazo legal (nunca suma remanente 77)
        var cod91 = cod89 + cod48 + cod151 + cod62;

        var avisos = [];
        if (cantBoletasElectronicas > 0) {
            avisos.push('Resumen RCV boletas electrónicas (tipo 39): se sumó su IVA ($' + ivaBoletasElectronicas.toLocaleString('es-CL') + ') al total de débitos (cód. 538). Verifica que coincida con la propuesta automática del SII; los códigos 110/111 son solo para boletas manuales.');
        }
        if (reg.codigo === '14A' && tasa115 === 0 && cod563 > 0) {
            avisos.push('Régimen 14 A seleccionado con tasa PPM en 0%: ingresa la tasa variable anual determinada para el cliente en el código 115.');
        }
        if (sumaDebitos < 0) {
            avisos.push('Las notas de crédito emitidas superan los débitos del mes: revisa en el SII el tratamiento del exceso.');
        }

        return {
            periodo: e.periodo || '2026-10',
            regimen: reg.codigo,
            regimenNombre: reg.nombre,
            codigos: {
                503: cod503,
                502: cod502,
                716: cod716,
                717: cod717,
                110: cod110,
                111: cod111,
                758: cod758,
                759: cod759,
                512: cod512,
                513: cod513,
                509: cod509,
                510: cod510,
                538: cod538,
                519: cod519,
                520: cod520,
                761: cod761,
                762: cod762,
                524: cod524,
                525: cod525,
                531: cod531,
                532: cod532,
                527: cod527,
                528: cod528,
                504: cod504,
                537: cod537,
                89: cod89,
                77: cod77,
                48: cod48,
                151: cod151,
                563: cod563,
                115: tasa115,
                62: cod62,
                91: cod91
            },
            resumen: {
                ivaBoletasElectronicas: ivaBoletasElectronicas,
                cantBoletasElectronicas: cantBoletasElectronicas,
                honorariosBruto: honorariosBruto,
                honorariosLiquido: honorariosLiquido,
                tasaHonorariosPct: Math.round((tasaHonorarios || 0.1525) * 10000) / 100,
                ingresosNetosGiro: ingresosNetosGiro,
                comprasNetasGiro: Math.max(0, entero(c.netoGiro) + entero(c.exentoGiro) + entero(c.netoNotasDebito) - entero(c.netoNotasCredito)),
                comprasSupermercadoNeto: entero(c.netoSupermercado),
                comprasActivoFijoNeto: entero(c.netoActivoFijo),
                ivaNoRecuperable: entero(c.ivaNoRecuperable)
            },
            avisos: avisos
        };
    }

    // Plantillas oficiales SII Carga Masiva (separador ';', montos positivos incluso en NC 61)
    var CABECERA_VENTAS_SII = 'Tipo Doc;Folio;Rut Contraparte;Tasa Impuesto;Razon Social Contraparte;Fecha Emision;Monto Exento;Monto Neto;Monto IVA;IVA Fuera Plazo (Nota Credito);Cod Otro Imp;Tasa Otro Imp;Monto Otro Imp;Monto IVA Propio;Monto IVA Terceros;IVA Retenido Total;IVA Retenido Parcial;IVA No Retenido;Ley 18211;Credito Constructoras;Tipo Doc Referencia;Folio Documento Referencia;Deposito por Envase;Monto No Facturable;Monto Periodo;Venta Pasaje Nacional;Venta Pasaje Internacional;Numero Id Receptor Extranjero;Nacionalidad;Indicador de Servicio;Indicador sin Costo;Rut Liquidador;Valor Neto Comisiones;Valor Comisiones Exentas;Valor IVA Comisiones;Codigo sucursal SII;Numero Interno;Emisor/Receptor;Monto Total;Tipo Transaccion';

    var CABECERA_COMPRAS_SII = 'Tipo Doc;Folio;Rut Contraparte;Tasa Impuesto;Razon Social Contraparte;Tipo Impuesto[1=IVA:2=LEY 18211];Fecha Emision;Monto Exento;Monto Neto;Monto IVA (Recuperable);Cod IVA no Rec;Monto IVA no Rec;IVA Uso Comun;Cod Otro Imp (Con Credito);Tasa Otro Imp (Con Credito);Monto Otro Imp (Con Credito);Monto Otro Imp Sin Credito;Monto Activo Fijo;Monto IVA Activo Fijo;IVA No Retenido;Tabacos - Puros;Tabacos - Cigarrillos;Tabacos - Elaborados;Codigo sucursal SII;Numero Interno;Emisor/Receptor;Monto Total;Tipo Transaccion';

    function ejemploRcvVentasCsv() {
        function filaV(tipo, folio, rut, razon, fecha, exento, neto, iva, total, refTipo, refFolio) {
            var cols = new Array(40).fill('');
            cols[0] = tipo; cols[1] = folio; cols[2] = rut; cols[3] = exento && !neto ? 0 : 19;
            cols[4] = razon; cols[5] = fecha; cols[6] = exento; cols[7] = neto; cols[8] = iva;
            cols[20] = refTipo || ''; cols[21] = refFolio || '';
            cols[38] = total; cols[39] = 1;
            return cols.join(';');
        }
        return [
            CABECERA_VENTAS_SII,
            filaV(33, 1041, '76.840.112-K', 'Gastronomia del Sur Ltda', '04-10-2026', 0, 6200000, 1178000, 7378000),
            filaV(33, 1042, '77.190.440-2', 'Cafe Patagonia SpA', '09-10-2026', 0, 4800000, 912000, 5712000),
            filaV(33, 1043, '76.312.900-8', 'Distribuidora Central Ltda', '15-10-2026', 0, 5500000, 1045000, 6545000),
            filaV(34, 210, '69.080.100-1', 'Municipalidad Convenio Capacitacion', '18-10-2026', 900000, 0, 0, 900000),
            filaV(39, 185, '', 'Resumen mensual boletas electronicas', '31-10-2026', 0, 2400000, 456000, 2856000),
            filaV(61, 45, '77.190.440-2', 'Cafe Patagonia SpA', '22-10-2026', 0, 500000, 95000, 595000, 33, 1042)
        ].join('\r\n');
    }

    function ejemploRcvComprasCsv() {
        function filaC(tipo, folio, rut, razon, fecha, exento, neto, iva, ivaNoRec, netoAF, ivaAF, total, tipoTrans) {
            var cols = new Array(28).fill('');
            cols[0] = tipo; cols[1] = folio; cols[2] = rut; cols[3] = 19;
            cols[4] = razon; cols[5] = 1; cols[6] = fecha;
            cols[7] = exento; cols[8] = neto; cols[9] = iva;
            cols[11] = ivaNoRec || 0;
            cols[17] = netoAF || 0; cols[18] = ivaAF || 0;
            cols[26] = total; cols[27] = tipoTrans || 1;
            return cols.join(';');
        }
        return [
            CABECERA_COMPRAS_SII,
            filaC(33, 8492, '96.510.220-4', 'Molinera del Centro S.A.', '03-10-2026', 0, 5200000, 988000, 0, 0, 0, 6188000, 1),
            filaC(33, 310, '76.445.880-1', 'Envasados Plasticos del Sur SpA', '10-10-2026', 0, 2100000, 399000, 0, 0, 0, 2499000, 1),
            filaC(33, 55910, '76.120.300-9', 'Energia y Gas Industrial S.A.', '14-10-2026', 0, 950000, 180500, 0, 0, 0, 1130500, 1),
            filaC(33, 991204, '81.201.000-K', 'Supermercados del Sur Ltda', '16-10-2026', 0, 180000, 34200, 0, 0, 0, 214200, 2),
            filaC(33, 742, '77.880.120-5', 'Maquinaria Gastronomica Chile SpA', '19-10-2026', 0, 0, 0, 0, 1600000, 304000, 1904000, 4),
            filaC(61, 88, '96.510.220-4', 'Molinera del Centro S.A.', '24-10-2026', 0, 300000, 57000, 0, 0, 0, 357000, 1)
        ].join('\r\n');
    }

    var api = {
        REGIMENES: REGIMENES,
        parsearCsvTexto: parsearCsvTexto,
        parsearRcv: parsearRcv,
        calcularF29: calcularF29,
        CABECERA_VENTAS_SII: CABECERA_VENTAS_SII,
        CABECERA_COMPRAS_SII: CABECERA_COMPRAS_SII,
        ejemploRcvVentasCsv: ejemploRcvVentasCsv,
        ejemploRcvComprasCsv: ejemploRcvComprasCsv,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLContadoresF29 = api;
})(typeof window !== 'undefined' ? window : this);
