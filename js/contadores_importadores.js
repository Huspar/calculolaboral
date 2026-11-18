/*
 * CalculoLaboral · Importadores Unificados para Contadores (v1.0.0)
 * Parseo real de Registro SII de Boletas de Honorarios Electronicas (BHE) y Cartolas Bancarias.
 * Ley 21.133: retencion BHE 15,25% (2026), 16% (2027), 17% (2028+). F29 cod. 151 = monto retenido.
 * Funciona en navegador (window.CLImportadores) y Node (require).
 */
(function (root) {
    'use strict';

    var TASAS_BHE = {
        2019: 0.10,
        2020: 0.1075,
        2021: 0.115,
        2022: 0.1225,
        2023: 0.13,
        2024: 0.1375,
        2025: 0.145,
        2026: 0.1525,
        2027: 0.16,
        2028: 0.17
    };

    function tasaRetencionBhe(anio) {
        var y = Math.round(Number(anio) || 2026);
        if (y <= 2019) return 0.10;
        if (y >= 2028) return 0.17;
        return TASAS_BHE[y] || 0.1525;
    }

    function normalizarTexto(s) {
        return String(s == null ? '' : s)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function limpiarRut(rut) {
        return String(rut == null ? '' : rut).replace(/[^0-9kK]/g, '').toUpperCase();
    }

    function formatearRut(rut) {
        var clean = limpiarRut(rut);
        if (clean.length < 2) return String(rut || '').trim();
        var body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return body + '-' + clean.slice(-1);
    }

    function enteroChileno(v) {
        if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
        var s = String(v == null ? '' : v).trim();
        if (!s || s === '-') return 0;
        var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
        // Quitar signo moneda, espacios, paréntesis
        s = s.replace(/[$\s()]/g, '');
        // Si usa punto como miles y opcional coma decimal: 1.250.000 o 1.250.000,00
        if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (/^-?\d+(,\d{1,2})$/.test(s)) {
            s = s.replace(',', '.');
        } else {
            s = s.replace(/\./g, '').replace(/,/g, '');
        }
        var n = Math.round(Number(s.replace(/[^0-9.-]/g, '')) || 0);
        return neg ? -Math.abs(n) : n;
    }

    function normalizarFecha(raw, periodoFallback) {
        if (raw instanceof Date && !isNaN(raw.getTime())) {
            return raw.toISOString().slice(0, 10);
        }
        if (typeof raw === 'number' && isFinite(raw) && raw > 25000 && raw < 80000) {
            var ms = Math.round((raw - 25569) * 86400 * 1000);
            var dt = new Date(ms);
            if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
        }
        var s = String(raw == null ? '' : raw).trim();
        if (!s) return (periodoFallback || '2026-11') + '-01';
        var iso = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(s);
        if (iso) {
            return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
        }
        var cl = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/.exec(s);
        if (cl) {
            var y = cl[3].length === 2 ? '20' + cl[3] : cl[3];
            return y + '-' + cl[2].padStart(2, '0') + '-' + cl[1].padStart(2, '0');
        }
        return (periodoFallback || '2026-11') + '-01';
    }

    function partirLineaCsv(linea, sep) {
        var out = [];
        var cur = '';
        var enComillas = false;
        for (var i = 0; i < linea.length; i++) {
            var ch = linea.charAt(i);
            if (ch === '"') {
                if (enComillas && linea.charAt(i + 1) === '"') {
                    cur += '"';
                    i++;
                } else {
                    enComillas = !enComillas;
                }
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

    function textoAFilas(texto) {
        var limpio = String(texto == null ? '' : texto).replace(/^\uFEFF/, '').trim();
        if (!limpio) return [];
        var lineas = limpio.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        var muestra = lineas.slice(0, 6).join('\n');
        var cntSemi = (muestra.match(/;/g) || []).length;
        var cntComma = (muestra.match(/,/g) || []).length;
        var cntTab = (muestra.match(/\t/g) || []).length;
        var sep = cntTab >= cntSemi && cntTab >= cntComma && cntTab > 0 ? '\t' : (cntSemi >= cntComma ? ';' : ',');
        return lineas.map(function (l) { return partirLineaCsv(l, sep); });
    }

    function parsearBheSii(entrada, opciones) {
        var opts = opciones || {};
        var periodoFallback = opts.periodo || '2026-11';
        var anioDefecto = Number(String(periodoFallback).slice(0, 4)) || 2026;
        var filas = Array.isArray(entrada) ? entrada : textoAFilas(entrada);

        if (!filas.length) {
            return {
                ok: false,
                error: 'El archivo BHE esta vacio.',
                boletas: [],
                anuladasOmitidas: 0,
                totalBruto: 0,
                totalRetenido: 0,
                totalLiquido: 0,
                codigo151: 0,
                advertencias: []
            };
        }

        // Si ya vienen objetos estructurados
        if (typeof filas[0] === 'object' && !Array.isArray(filas[0])) {
            return procesarObjetosBhe(filas, periodoFallback, anioDefecto);
        }

        var idxHead = -1;
        var mapa = null;
        for (var i = 0; i < Math.min(filas.length, 20); i++) {
            var cols = (filas[i] || []).map(normalizarTexto);
            var iNro = -1, iFecha = -1, iEstado = -1, iRut = -1, iNombre = -1, iBruto = -1, iRet = -1, iLiq = -1;
            for (var j = 0; j < cols.length; j++) {
                var h = cols[j];
                if (!h) continue;
                if (iNro < 0 && /^(n|nro|numero|boleta|folio)/.test(h)) iNro = j;
                else if (iFecha < 0 && /fecha/.test(h)) iFecha = j;
                else if (iEstado < 0 && /estado/.test(h)) iEstado = j;
                else if (iRut < 0 && /rut/.test(h)) iRut = j;
                else if (iNombre < 0 && /(nombre|razon|prestador|emisor|contribuyente)/.test(h)) iNombre = j;
                else if (iBruto < 0 && /(bruto|honorario|total honor)/.test(h) && !/liquid/.test(h)) iBruto = j;
                else if (iRet < 0 && /(retenc|retenid|impuesto)/.test(h)) iRet = j;
                else if (iLiq < 0 && /liquid/.test(h)) iLiq = j;
            }
            if (iRut >= 0 && (iBruto >= 0 || iRet >= 0 || iLiq >= 0)) {
                idxHead = i;
                mapa = { nro: iNro, fecha: iFecha, estado: iEstado, rut: iRut, nombre: iNombre, bruto: iBruto, retenido: iRet, liquido: iLiq };
                break;
            }
        }

        if (idxHead < 0 || !mapa) {
            return {
                ok: false,
                error: 'No reconocimos las columnas del registro BHE SII (RUT Emisor, Bruto, Retencion y Liquido).',
                boletas: [],
                anuladasOmitidas: 0,
                totalBruto: 0,
                totalRetenido: 0,
                totalLiquido: 0,
                codigo151: 0,
                advertencias: []
            };
        }

        var objetos = [];
        for (var r = idxHead + 1; r < filas.length; r++) {
            var fila = filas[r];
            if (!fila || !fila.length) continue;
            var rutRaw = String(mapa.rut >= 0 ? (fila[mapa.rut] || '') : '').trim();
            if (!rutRaw || /^totales?$/i.test(rutRaw)) continue;
            objetos.push({
                folio: mapa.nro >= 0 ? String(fila[mapa.nro] || '').trim() : String(r - idxHead),
                fecha: mapa.fecha >= 0 ? fila[mapa.fecha] : '',
                estado: mapa.estado >= 0 ? String(fila[mapa.estado] || '').trim() : 'VIGENTE',
                rut: rutRaw,
                razonSocial: mapa.nombre >= 0 ? String(fila[mapa.nombre] || '').trim() : '',
                bruto: mapa.bruto >= 0 ? enteroChileno(fila[mapa.bruto]) : 0,
                retenido: mapa.retenido >= 0 ? enteroChileno(fila[mapa.retenido]) : null,
                liquido: mapa.liquido >= 0 ? enteroChileno(fila[mapa.liquido]) : 0
            });
        }
        return procesarObjetosBhe(objetos, periodoFallback, anioDefecto);
    }

    function procesarObjetosBhe(lista, periodoFallback, anioDefecto) {
        var boletas = [];
        var anuladasOmitidas = 0;
        var totalBruto = 0;
        var totalRetenido = 0;
        var totalLiquido = 0;
        var advertencias = [];

        (lista || []).forEach(function (item, idx) {
            var estadoNorm = normalizarTexto(item.estado || 'vigente').toUpperCase();
            if (/ANULAD/.test(estadoNorm)) {
                anuladasOmitidas++;
                return;
            }
            var rutFmt = formatearRut(item.rut);
            if (!limpiarRut(rutFmt)) return;

            var fecha = normalizarFecha(item.fecha, periodoFallback);
            var anio = Number(fecha.slice(0, 4)) || anioDefecto;
            var tasaEsperada = tasaRetencionBhe(anio);

            var bruto = Math.max(0, Math.round(Number(item.bruto) || 0));
            var liqInput = Math.max(0, Math.round(Number(item.liquido) || 0));
            var retInput = (item.retenido === null || item.retenido === undefined || item.retenido === '')
                ? null
                : Math.max(0, Math.round(Number(item.retenido) || 0));

            if (!bruto && liqInput > 0) {
                bruto = Math.round(liqInput / (1 - tasaEsperada));
            }
            var retenido = retInput !== null ? retInput : Math.round(bruto * tasaEsperada);
            var liquido = liqInput > 0 ? liqInput : Math.max(0, bruto - retenido);
            if (!bruto && (retenido > 0 || liquido > 0)) bruto = retenido + liquido;
            if (bruto <= 0) return;

            var esperado = Math.round(bruto * tasaEsperada);
            if (Math.abs(retenido - esperado) > Math.max(150, Math.round(bruto * 0.005))) {
                advertencias.push({
                    folio: item.folio || String(idx + 1),
                    rut: rutFmt,
                    mensaje: 'Boleta ' + (item.folio || idx + 1) + ' (' + rutFmt + '): retencion informada ($' + retenido + ') difiere de tasa legal ' + (Math.round(tasaEsperada * 10000) / 100) + '% ($' + esperado + '). Se respeta monto retenido real.'
                });
            }

            boletas.push({
                folio: String(item.folio || (idx + 1)),
                fecha: fecha,
                anio: anio,
                estado: 'VIGENTE',
                rut: rutFmt,
                razonSocial: String(item.razonSocial || 'Prestador de servicios').trim(),
                bruto: bruto,
                retenido: retenido,
                liquido: liquido,
                tasaAplicada: bruto > 0 ? Math.round((retenido / bruto) * 10000) / 100 : Math.round(tasaEsperada * 10000) / 100
            });
            totalBruto += bruto;
            totalRetenido += retenido;
            totalLiquido += liquido;
        });

        if (!boletas.length && !anuladasOmitidas) {
            return {
                ok: false,
                error: 'No se encontraron boletas de honorarios vigentes con monto mayor a cero.',
                boletas: [],
                anuladasOmitidas: 0,
                totalBruto: 0,
                totalRetenido: 0,
                totalLiquido: 0,
                codigo151: 0,
                advertencias: []
            };
        }

        return {
            ok: true,
            boletas: boletas,
            anuladasOmitidas: anuladasOmitidas,
            totalBruto: totalBruto,
            totalRetenido: totalRetenido,
            totalLiquido: totalLiquido,
            codigo151: totalRetenido,
            advertencias: advertencias
        };
    }

    function parsearCartola(entrada, opciones) {
        var opts = opciones || {};
        var periodoFallback = opts.periodo || '2026-11';
        var filas = Array.isArray(entrada) ? entrada : textoAFilas(entrada);
        if (!filas.length) {
            return { ok: false, error: 'La cartola bancaria esta vacia.', movimientos: [], totalAbonos: 0, totalCargos: 0, ultimoSaldo: null, saldoInicialEstimado: null };
        }

        var idxHead = -1;
        var mapa = null;
        for (var i = 0; i < Math.min(filas.length, 25); i++) {
            var cols = (filas[i] || []).map(normalizarTexto);
            var iFecha = -1, iGlosa = -1, iCargo = -1, iAbono = -1, iMonto = -1, iSaldo = -1, iCta = -1;
            for (var j = 0; j < cols.length; j++) {
                var h = cols[j];
                if (!h) continue;
                if (iFecha < 0 && /fecha/.test(h)) iFecha = j;
                else if (iGlosa < 0 && /(descripcion|detalle|glosa|movimiento|concepto|referencia|operacion)/.test(h)) iGlosa = j;
                else if (iCargo < 0 && /(cargo|egreso|giro|debito|salida|cheque|retiro)/.test(h)) iCargo = j;
                else if (iAbono < 0 && /(abono|ingreso|deposito|credito|entrada)/.test(h)) iAbono = j;
                else if (iMonto < 0 && /^(monto|importe|valor)/.test(h)) iMonto = j;
                else if (iSaldo < 0 && /saldo/.test(h)) iSaldo = j;
                else if (iCta < 0 && /(cuenta|contrapartida|cod_cta)/.test(h)) iCta = j;
            }
            if (iFecha >= 0 && (iCargo >= 0 || iAbono >= 0 || iMonto >= 0)) {
                idxHead = i;
                mapa = {
                    fecha: iFecha,
                    glosa: iGlosa >= 0 ? iGlosa : Math.min(iFecha + 1, cols.length - 1),
                    cargo: iCargo,
                    abono: iAbono,
                    monto: iMonto,
                    saldo: iSaldo,
                    cuenta: iCta
                };
                break;
            }
        }

        if (idxHead < 0 || !mapa) {
            return {
                ok: false,
                error: 'No reconocimos las columnas de la cartola (Fecha, Glosa y Cargo/Abono o Monto).',
                movimientos: [],
                totalAbonos: 0,
                totalCargos: 0,
                ultimoSaldo: null,
                saldoInicialEstimado: null
            };
        }

        var movimientos = [];
        var totalAbonos = 0;
        var totalCargos = 0;
        var ultimoSaldo = null;
        var saldoInicialEstimado = null;

        for (var r = idxHead + 1; r < filas.length; r++) {
            var fila = filas[r];
            if (!fila || !fila.length) continue;
            var rawFecha = fila[mapa.fecha];
            var glosa = String(fila[mapa.glosa] == null ? '' : fila[mapa.glosa]).trim();
            if (!rawFecha && !glosa) continue;
            var fechaNorm = normalizarTexto(rawFecha);
            var glosaNorm = normalizarTexto(glosa);
            if (/^(total|subtotal|totales|saldo\s*(inicial|final|anterior|contable|disponible))/.test(fechaNorm)) continue;
            if (!rawFecha && /^(total|totales|sub\s*total|resumen)/.test(glosaNorm)) continue;

            var cargo = mapa.cargo >= 0 ? Math.abs(enteroChileno(fila[mapa.cargo])) : 0;
            var abono = mapa.abono >= 0 ? Math.abs(enteroChileno(fila[mapa.abono])) : 0;
            if (!cargo && !abono && mapa.monto >= 0) {
                var m = enteroChileno(fila[mapa.monto]);
                if (m < 0) cargo = Math.abs(m);
                else if (m > 0) abono = m;
            }
            if (!cargo && !abono) continue;

            var saldoFila = (mapa.saldo >= 0 && String(fila[mapa.saldo] == null ? '' : fila[mapa.saldo]).trim() !== '')
                ? enteroChileno(fila[mapa.saldo])
                : null;
            if (saldoFila !== null) {
                if (saldoInicialEstimado === null && movimientos.length === 0) {
                    saldoInicialEstimado = abono > 0 ? saldoFila - abono : saldoFila + cargo;
                }
                ultimoSaldo = saldoFila;
            }

            var tipo = abono > 0 ? 'abono' : 'cargo';
            var monto = abono > 0 ? abono : cargo;
            if (tipo === 'abono') totalAbonos += monto;
            else totalCargos += monto;

            movimientos.push({
                id: 'mov-' + (r - idxHead) + '-' + monto,
                fecha: normalizarFecha(rawFecha, periodoFallback),
                glosa: glosa || (tipo === 'abono' ? 'Abono bancario' : 'Cargo bancario'),
                tipo: tipo,
                monto: monto,
                saldo: saldoFila,
                cuentaContrapartida: mapa.cuenta >= 0 ? String(fila[mapa.cuenta] || '').trim() : ''
            });
        }

        if (!movimientos.length) {
            return { ok: false, error: 'La cartola no tiene movimientos con montos mayores a cero.', movimientos: [], totalAbonos: 0, totalCargos: 0, ultimoSaldo: null, saldoInicialEstimado: null };
        }

        return {
            ok: true,
            movimientos: movimientos,
            totalAbonos: totalAbonos,
            totalCargos: totalCargos,
            ultimoSaldo: ultimoSaldo,
            saldoInicialEstimado: saldoInicialEstimado
        };
    }

    function ejemploBheCsv(periodo) {
        var p = String(periodo || '2026-11');
        var y = p.slice(0, 4);
        var m = p.slice(5, 7);
        var tasa = tasaRetencionBhe(Number(y) || 2026);
        function row(folio, dia, estado, rut, nom, bruto) {
            var ret = Math.round(bruto * tasa);
            var liq = bruto - ret;
            return [folio, dia + '/' + m + '/' + y, estado, rut, nom, bruto, ret, liq].join(';');
        }
        return [
            'Nro;Fecha Emision;Estado;RUT Emisor;Nombre o Razon Social;Honorarios Brutos;Retencion;Honorarios Liquidos',
            row(145, '05', 'VIGENTE', '12.345.678-5', 'Camila Rojas Asesorias', 1000000),
            row(146, '12', 'VIGENTE', '14.567.890-2', 'Soporte TI Sur EIRL', 600000),
            row(147, '14', 'ANULADA', '14.567.890-2', 'Soporte TI Sur EIRL', 500000),
            row(148, '20', 'VIGENTE', '16.789.012-K', 'Estudio Diseno Sur', 400000)
        ].join('\n');
    }

    function ejemploCartolaCsv(periodo) {
        var p = String(periodo || '2026-11');
        var y = p.slice(0, 4);
        var m = p.slice(5, 7);
        return [
            'Fecha;Descripcion;Cargo;Abono;Saldo',
            '03/' + m + '/' + y + ';Transferencia cliente factura 412;0;1487500;4987500',
            '08/' + m + '/' + y + ';Pago proveedor insumos panaderia;595000;0;4392500',
            '13/' + m + '/' + y + ';Pago planilla Previred;385000;0;4007500',
            '20/' + m + '/' + y + ';Pago F29 SII Tesoreria;420000;0;3587500',
            '28/' + m + '/' + y + ';Comision mantencion cuenta corriente;14900;0;3572600'
        ].join('\n');
    }

    var api = {
        TASAS_BHE: TASAS_BHE,
        tasaRetencionBhe: tasaRetencionBhe,
        parsearBheSii: parsearBheSii,
        parsearCartola: parsearCartola,
        ejemploBheCsv: ejemploBheCsv,
        ejemploCartolaCsv: ejemploCartolaCsv,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLImportadores = api;
})(typeof window !== 'undefined' ? window : this);
