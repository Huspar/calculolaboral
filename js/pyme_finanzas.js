/*
 * CalculoLaboral · Finanzas operativas y puente contable para Asistente Pyme (/app, v1.0.0)
 * Incluye: Flujo de caja operacional, Cobranzas (CxC), Cuentas por pagar (CxP),
 * Conciliacion bancaria en 1 clic y Mi Contador con protocolo CERRADO_TRIBUTARIO.
 * Funciona en navegador (window.CLPymeFinanzas) y en Node (require) para pruebas unitarias.
 */
(function (root) {
    'use strict';

    var esNode = typeof module !== 'undefined' && module.exports;
    function Rut() { return esNode ? require('./rut_cl.js') : root.CLRut; }
    function F29Mod() { return esNode ? require('./contadores_f29.js') : root.CLContadoresF29; }

    var K_FINANZAS = 'cl_pyme_finanzas_v1';
    var K_SUITE_CONTABLE = 'cl-suite-contable';

    var BANCOS_CHILE = [
        'BancoEstado',
        'Banco de Chile',
        'Banco Santander',
        'Banco BCI',
        'Scotiabank Chile',
        'Banco Itaú',
        'Banco BICE',
        'Banco Security',
        'Banco Falabella',
        'Banco Consorcio',
        'Tenpo / Mercado Pago'
    ];

    var TIPOS_CUENTA = {
        corriente: 'Cuenta corriente',
        vista: 'Cuenta vista / RUT',
        ahorro: 'Cuenta de ahorro'
    };

    var REGIMENES = {
        '14D3': 'ProPyme General (Art. 14 D N°3)',
        '14D8': 'ProPyme Transparente (Art. 14 D N°8)',
        '14A': 'Régimen General Semi Integrado (Art. 14 A)'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function entero(v) {
        if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
        var s = String(v == null ? '' : v).trim();
        if (!s) return 0;
        var neg = /^-|\(.*\)$/.test(s);
        var limpio = s.replace(/[^\d]/g, '');
        if (!limpio) return 0;
        var n = parseInt(limpio, 10) || 0;
        return neg ? -n : n;
    }

    function pesos(n) {
        var v = Math.round(Number(n) || 0);
        return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL');
    }

    function dos(n) { return n < 10 ? '0' + n : String(n); }

    function sumarDias(iso, dias) {
        var p = String(iso || '2026-10-01').slice(0, 10).split('-').map(Number);
        var d = new Date(Date.UTC(p[0] || 2026, (p[1] || 1) - 1, p[2] || 1) + (dias * 86400000));
        return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
    }

    function diasEntre(desdeIso, hastaIso) {
        var a = String(desdeIso || '').slice(0, 10).split('-').map(Number);
        var b = String(hastaIso || '').slice(0, 10).split('-').map(Number);
        if (a.length < 3 || b.length < 3) return 0;
        var utcA = Date.UTC(a[0], a[1] - 1, a[2]);
        var utcB = Date.UTC(b[0], b[1] - 1, b[2]);
        return Math.round((utcB - utcA) / 86400000);
    }

    function normalizarFecha(raw, periodoFallback) {
        var s = String(raw == null ? '' : raw).trim();
        var fb = (periodoFallback || '2026-10') + '-01';
        if (!s) return fb;
        var mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (mIso) return mIso[1] + '-' + dos(+mIso[2]) + '-' + dos(+mIso[3]);
        var mCl = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
        if (mCl) {
            var y = mCl[3].length === 2 ? '20' + mCl[3] : mCl[3];
            return y + '-' + dos(+mCl[2]) + '-' + dos(+mCl[1]);
        }
        return fb;
    }

    function normalizarTexto(s) {
        return String(s == null ? '' : s)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function partirLineaCsv(linea, sep) {
        var res = [], cur = '', enComillas = false;
        for (var i = 0; i < linea.length; i++) {
            var c = linea[i];
            if (c === '"') {
                if (enComillas && linea[i + 1] === '"') { cur += '"'; i++; }
                else enComillas = !enComillas;
            } else if (c === sep && !enComillas) {
                res.push(cur.trim());
                cur = '';
            } else {
                cur += c;
            }
        }
        res.push(cur.trim());
        return res;
    }

    function parsearCartolaFilas(filas, periodoFallback) {
        var lista = Array.isArray(filas) ? filas : [];
        var idxHead = -1;
        var mapa = null;

        for (var i = 0; i < Math.min(lista.length, 25); i++) {
            var cols = (lista[i] || []).map(normalizarTexto);
            var iFecha = -1, iGlosa = -1, iCargo = -1, iAbono = -1, iMonto = -1, iSaldo = -1;
            for (var j = 0; j < cols.length; j++) {
                var h = cols[j];
                if (!h) continue;
                if (iFecha < 0 && /fecha/.test(h)) iFecha = j;
                else if (iGlosa < 0 && /(descripcion|detalle|glosa|movimiento|concepto|referencia)/.test(h)) iGlosa = j;
                else if (iCargo < 0 && /(cargo|egreso|giro|debito)/.test(h)) iCargo = j;
                else if (iAbono < 0 && /(abono|ingreso|deposito|credito)/.test(h)) iAbono = j;
                else if (iMonto < 0 && /^(monto|importe|valor)$/.test(h)) iMonto = j;
                else if (iSaldo < 0 && /saldo/.test(h)) iSaldo = j;
            }
            if (iFecha >= 0 && (iCargo >= 0 || iAbono >= 0 || iMonto >= 0)) {
                idxHead = i;
                mapa = {
                    fecha: iFecha,
                    glosa: iGlosa >= 0 ? iGlosa : Math.min(iFecha + 1, cols.length - 1),
                    cargo: iCargo,
                    abono: iAbono,
                    monto: iMonto,
                    saldo: iSaldo
                };
                break;
            }
        }

        if (idxHead < 0 || !mapa) {
            return { ok: false, error: 'No reconocimos las columnas de la cartola. Incluye encabezados Fecha, Descripción y Cargo/Abono (o Monto).', movimientos: [], ultimoSaldo: null };
        }

        var movs = [];
        var ultimoSaldo = null;
        for (var r = idxHead + 1; r < lista.length; r++) {
            var fila = lista[r];
            if (!fila || !fila.length) continue;
            var rawFecha = fila[mapa.fecha];
            var glosa = String(fila[mapa.glosa] == null ? '' : fila[mapa.glosa]).trim();
            if (!rawFecha && !glosa) continue;

            var cargo = mapa.cargo >= 0 ? Math.abs(entero(fila[mapa.cargo])) : 0;
            var abono = mapa.abono >= 0 ? Math.abs(entero(fila[mapa.abono])) : 0;
            if (!cargo && !abono && mapa.monto >= 0) {
                var m = entero(fila[mapa.monto]);
                if (m < 0) cargo = Math.abs(m);
                else if (m > 0) abono = m;
            }
            if (!cargo && !abono) continue;

            var saldoFila = mapa.saldo >= 0 && String(fila[mapa.saldo] == null ? '' : fila[mapa.saldo]).trim() !== '' ? entero(fila[mapa.saldo]) : null;
            if (saldoFila !== null) ultimoSaldo = saldoFila;

            movs.push({
                id: 'mov-' + (r - idxHead) + '-' + (abono || cargo),
                fecha: normalizarFecha(rawFecha, periodoFallback),
                glosa: glosa || (abono > 0 ? 'Abono en cuenta' : 'Cargo en cuenta'),
                tipo: abono > 0 ? 'abono' : 'cargo',
                monto: abono > 0 ? abono : cargo,
                saldo: saldoFila,
                conciliadoCon: null
            });
        }

        if (!movs.length) {
            return { ok: false, error: 'El archivo no trae movimientos con montos mayores a cero.', movimientos: [], ultimoSaldo: null };
        }
        return { ok: true, movimientos: movs, ultimoSaldo: ultimoSaldo };
    }

    function parsearCartolaCsv(texto, periodoFallback) {
        var limpio = String(texto == null ? '' : texto).replace(/^\uFEFF/, '').trim();
        if (!limpio) return { ok: false, error: 'El archivo está vacío.', movimientos: [], ultimoSaldo: null };
        var lineas = limpio.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        var muestra = lineas.slice(0, 5).join('\n');
        var sep = (muestra.match(/;/g) || []).length >= (muestra.match(/,/g) || []).length ? ';' : ',';
        if ((muestra.match(/\t/g) || []).length > (muestra.match(new RegExp('\\' + sep, 'g')) || []).length) sep = '\t';
        var filas = lineas.map(function (l) { return partirLineaCsv(l, sep); });
        return parsearCartolaFilas(filas, periodoFallback);
    }

    function estadoVencimiento(doc, hoyIso) {
        if (!doc) return { codigo: 'al_dia', etiqueta: 'Al día', dias: 0 };
        if (doc.pagada) return { codigo: 'pagada', etiqueta: doc.tipoDoc === 'cxp' ? 'Pagada' : 'Cobrada', dias: 0 };
        var dias = diasEntre(hoyIso, doc.vencimiento || doc.fecha);
        if (dias < 0) return { codigo: 'vencida', etiqueta: 'Vencida (' + Math.abs(dias) + ' d)', dias: dias };
        if (dias <= 7) return { codigo: 'por_vencer', etiqueta: dias === 0 ? 'Vence hoy' : 'Vence en ' + dias + ' d', dias: dias };
        return { codigo: 'al_dia', etiqueta: 'Al día', dias: dias };
    }

    function importarRcvACobranzas(csvTexto, opciones) {
        opciones = opciones || {};
        var F29 = F29Mod();
        if (!F29 || !F29.parsearRcv) return { ok: false, error: 'Falta el lector RCV.', items: [] };
        var parsed = F29.parsearRcv(csvTexto, 'ventas');
        var docs = parsed && Array.isArray(parsed.documentos) ? parsed.documentos : [];
        if (!docs.length) return { ok: false, error: 'No encontramos documentos válidos en el archivo RCV de Ventas.', items: [] };
        var plazo = typeof opciones.plazoDias === 'number' ? opciones.plazoDias : 30;
        var periodo = opciones.periodo || '2026-10';
        var items = [];
        docs.forEach(function (r, idx) {
            if (r.esResumen || r.resta || r.total <= 0) return;
            var fEmision = normalizarFecha(r.fecha, periodo);
            items.push({
                id: 'cxc-rcv-' + r.tipoDoc + '-' + escId(r.folio || idx),
                rut: Rut() && r.rut ? Rut().formatear(r.rut) : (r.rut || ''),
                razonSocial: r.razonSocial || 'Cliente SII',
                folio: String(r.folio || (idx + 1)),
                tipoDte: r.tipoDoc,
                fecha: fEmision,
                vencimiento: sumarDias(fEmision, plazo),
                monto: Math.round(r.total),
                telefono: '',
                pagada: false,
                fechaPago: '',
                origen: 'RCV SII'
            });
        });
        var ivaDeb = Math.max(0, (parsed.ivaGiro || 0) + (parsed.ivaFueraGiro || 0) + (parsed.ivaBoletas39 || 0) + (parsed.ivaNotasDebito || 0) - (parsed.ivaNotasCredito || 0));
        return { ok: true, items: items, resumen: { ivaDebito: ivaDeb, raw: parsed } };
    }

    function importarRcvAPagos(csvTexto, opciones) {
        opciones = opciones || {};
        var F29 = F29Mod();
        if (!F29 || !F29.parsearRcv) return { ok: false, error: 'Falta el lector RCV.', items: [] };
        var parsed = F29.parsearRcv(csvTexto, 'compras');
        var docs = parsed && Array.isArray(parsed.documentos) ? parsed.documentos : [];
        if (!docs.length) return { ok: false, error: 'No encontramos documentos válidos en el archivo RCV de Compras.', items: [] };
        var plazo = typeof opciones.plazoDias === 'number' ? opciones.plazoDias : 30;
        var periodo = opciones.periodo || '2026-10';
        var cuentasPrevias = opciones.cuentasProveedores || {};
        var items = [];
        docs.forEach(function (r, idx) {
            if (r.esResumen || r.resta || r.total <= 0) return;
            var rutFmt = Rut() && r.rut ? Rut().formatear(r.rut) : (r.rut || '');
            var cta = cuentasPrevias[rutFmt] || {};
            var fEmision = normalizarFecha(r.fecha, periodo);
            items.push({
                id: 'cxp-rcv-' + r.tipoDoc + '-' + escId(r.folio || idx),
                tipoDoc: 'cxp',
                rut: rutFmt,
                razonSocial: r.razonSocial || 'Proveedor SII',
                folio: String(r.folio || (idx + 1)),
                tipoDte: r.tipoDoc,
                fecha: fEmision,
                vencimiento: sumarDias(fEmision, plazo),
                monto: Math.round(r.total),
                banco: cta.banco || '',
                tipoCuenta: cta.tipoCuenta || '',
                numeroCuenta: cta.numeroCuenta || '',
                correo: cta.correo || '',
                pagada: false,
                fechaPago: '',
                origen: 'RCV SII'
            });
        });
        var ivaCred = Math.max(0, (parsed.ivaGiro || 0) + (parsed.ivaSupermercado || 0) + (parsed.ivaActivoFijo || 0) + (parsed.ivaNotasDebito || 0) - (parsed.ivaNotasCredito || 0));
        return { ok: true, items: items, resumen: { ivaCredito: ivaCred, raw: parsed } };
    }

    function escId(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, ''); }

    function mensajeCobranza(doc, empresa, cuentaCobro) {
        var empNombre = (empresa && empresa.razonSocial) ? empresa.razonSocial : 'nuestra empresa';
        var empRut = (empresa && empresa.rut) ? (Rut() ? Rut().formatear(empresa.rut) : empresa.rut) : '';
        var cliente = (doc && doc.razonSocial) ? doc.razonSocial : 'cliente';
        var folio = (doc && doc.folio) ? doc.folio : 'S/N';
        var monto = pesos(doc && doc.monto);
        var vence = (doc && doc.vencimiento) ? doc.vencimiento.split('-').reverse().join('-') : '';
        var lineas = [
            'Estimados ' + cliente + ', junto con saludar, les escribimos de ' + empNombre + (empRut ? ' (RUT ' + empRut + ')' : '') + '.',
            'Les recordamos el pago de la Factura N° ' + folio + ' por ' + monto + (vence ? ', con vencimiento el ' + vence : '') + '.'
        ];
        if (cuentaCobro && cuentaCobro.banco && cuentaCobro.numeroCuenta) {
            lineas.push(
                'Datos para transferencia: ' + cuentaCobro.banco +
                ' · ' + (TIPOS_CUENTA[cuentaCobro.tipoCuenta] || cuentaCobro.tipoCuenta || 'Cuenta corriente') +
                ' N° ' + cuentaCobro.numeroCuenta +
                (empRut ? ' · RUT ' + empRut : '') +
                (cuentaCobro.correo ? ' · ' + cuentaCobro.correo : '') + '.'
            );
        }
        lineas.push('Si el pago ya fue realizado, agradecemos enviarnos el comprobante para conciliarlo. Muchas gracias.');
        return lineas.join('\n\n');
    }

    function celdaCsv(v) {
        var s = String(v == null ? '' : v);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function generarNominaProveedores(items, meta) {
        meta = meta || {};
        var lineas = [], incluidos = 0, omitidos = [], total = 0;
        var periodoNombre = meta.periodoNombre || meta.periodo || '';
        lineas.push(['Nómina de pago a proveedores · ' + periodoNombre, '', '', '', '', '', '', ''].map(celdaCsv).join(';'));
        lineas.push(['Planilla para revisión y carga en portal bancario empresa. No ejecuta transferencias automáticas.', '', '', '', '', '', '', ''].map(celdaCsv).join(';'));
        lineas.push('');
        lineas.push(['RUT Proveedor', 'Razón Social', 'Banco', 'Tipo de cuenta', 'Número de cuenta', 'Monto a pagar', 'Glosa', 'Correo aviso'].map(celdaCsv).join(';'));

        (items || []).forEach(function (it) {
            var quien = String(it.razonSocial || it.rut || 'Proveedor').trim();
            var monto = entero(it.monto);
            if (it.pagada) { omitidos.push({ nombre: quien, motivo: 'la factura ya figura como pagada.' }); return; }
            if (monto <= 0) { omitidos.push({ nombre: quien, motivo: 'el monto es cero.' }); return; }
            var faltan = [];
            if (!String(it.rut || '').trim()) faltan.push('RUT');
            if (!String(it.banco || '').trim()) faltan.push('banco');
            if (!TIPOS_CUENTA[it.tipoCuenta]) faltan.push('tipo de cuenta');
            var numLimpio = String(it.numeroCuenta || '').replace(/[\s.-]/g, '');
            if (!/^\d{4,22}$/.test(numLimpio)) faltan.push('número de cuenta');
            if (faltan.length) {
                omitidos.push({ nombre: quien + ' (Factura ' + (it.folio || 'S/N') + ')', motivo: 'falta ' + faltan.join(', ') + '.' });
                return;
            }
            lineas.push([
                it.rut,
                quien,
                it.banco,
                TIPOS_CUENTA[it.tipoCuenta],
                numLimpio,
                monto,
                'Pago Factura ' + (it.folio || 'S/N'),
                it.correo || ''
            ].map(celdaCsv).join(';'));
            incluidos++;
            total += monto;
        });

        lineas.push('');
        lineas.push(['', 'Total seleccionado', '', '', '', total, '', ''].map(celdaCsv).join(';'));
        return { texto: lineas.join('\r\n') + '\r\n', incluidos: incluidos, omitidos: omitidos, total: total };
    }

    function sugerirConciliacion(movimientos, contexto) {
        contexto = contexto || {};
        var cobranzas = (contexto.cobranzas || []).filter(function (c) { return !c.pagada; });
        var pagos = (contexto.pagos || []).filter(function (p) { return !p.pagada; });
        var ob = contexto.obligacionesMes || {};

        return (movimientos || []).map(function (mov) {
            if (mov.conciliadoCon) return { movimiento: mov, candidatos: [], mejorMatch: null };
            var glosaNorm = normalizarTexto(mov.glosa);
            var candidatos = [];

            if (mov.tipo === 'abono') {
                cobranzas.forEach(function (c) {
                    var score = puntajeMonto(mov.monto, c.monto);
                    if (c.folio && glosaNorm.indexOf(String(c.folio).toLowerCase()) >= 0) score += 25;
                    var palabras = normalizarTexto(c.razonSocial).split(/\s+/).filter(function (w) { return w.length > 3; });
                    if (palabras.some(function (w) { return glosaNorm.indexOf(w) >= 0; })) score += 25;
                    if (c.rut && glosaNorm.indexOf(c.rut.replace(/\./g, '').toLowerCase()) >= 0) score += 30;
                    if (score > 0) {
                        candidatos.push({
                            tipoDestino: 'cxc',
                            destinoId: c.id,
                            titulo: c.razonSocial + ' · Factura ' + c.folio,
                            subtitulo: 'Vence ' + c.vencimiento + ' · ' + c.rut,
                            monto: c.monto,
                            score: score,
                            confianza: score >= 100 ? 'alta' : 'media'
                        });
                    }
                });
            } else {
                pagos.forEach(function (p) {
                    var score = puntajeMonto(mov.monto, p.monto);
                    if (p.folio && glosaNorm.indexOf(String(p.folio).toLowerCase()) >= 0) score += 25;
                    var palabras = normalizarTexto(p.razonSocial).split(/\s+/).filter(function (w) { return w.length > 3; });
                    if (palabras.some(function (w) { return glosaNorm.indexOf(w) >= 0; })) score += 25;
                    if (p.rut && glosaNorm.indexOf(p.rut.replace(/\./g, '').toLowerCase()) >= 0) score += 30;
                    if (score > 0) {
                        candidatos.push({
                            tipoDestino: 'cxp',
                            destinoId: p.id,
                            titulo: p.razonSocial + ' · Factura ' + p.folio,
                            subtitulo: 'Proveedor · Vence ' + p.vencimiento,
                            monto: p.monto,
                            score: score,
                            confianza: score >= 100 ? 'alta' : 'media'
                        });
                    }
                });

                if (ob.sueldosLiquidos > 0 && !ob.sueldosConciliados) {
                    var scSueldo = puntajeMonto(mov.monto, ob.sueldosLiquidos) + (/(remunerac|sueldo|nomina)/.test(glosaNorm) ? 30 : 0);
                    if (scSueldo > 0) {
                        candidatos.push({
                            tipoDestino: 'sueldos',
                            destinoId: 'ob-sueldos',
                            titulo: 'Nómina de sueldos líquidos del mes',
                            subtitulo: 'Liquidaciones guardadas en Asistente Pyme',
                            monto: ob.sueldosLiquidos,
                            score: scSueldo,
                            confianza: scSueldo >= 100 ? 'alta' : 'media'
                        });
                    }
                }
                if (ob.previred > 0 && !ob.previredConciliado) {
                    var scPrev = puntajeMonto(mov.monto, ob.previred) + (/previred|cotizacion/.test(glosaNorm) ? 35 : 0);
                    if (scPrev > 0) {
                        candidatos.push({
                            tipoDestino: 'previred',
                            destinoId: 'ob-previred',
                            titulo: 'Cotizaciones previsionales Previred',
                            subtitulo: 'Vencimiento día 13 del mes siguiente',
                            monto: ob.previred,
                            score: scPrev,
                            confianza: scPrev >= 100 ? 'alta' : 'media'
                        });
                    }
                }
                if (ob.f29Total > 0 && !ob.f29Conciliado) {
                    var scF29 = puntajeMonto(mov.monto, ob.f29Total) + (/(tesoreria|tgr|sii|f29|impuesto)/.test(glosaNorm) ? 35 : 0);
                    if (scF29 > 0) {
                        candidatos.push({
                            tipoDestino: 'f29',
                            destinoId: 'ob-f29',
                            titulo: 'Pago de impuestos mensuales F29 (SII / TGR)',
                            subtitulo: 'Formulario 29 informado por contabilidad',
                            monto: ob.f29Total,
                            score: scF29,
                            confianza: scF29 >= 100 ? 'alta' : 'media'
                        });
                    }
                }
            }

            candidatos.sort(function (a, b) { return b.score - a.score; });
            return {
                movimiento: mov,
                candidatos: candidatos,
                mejorMatch: candidatos[0] && candidatos[0].score >= 95 ? candidatos[0] : null
            };
        });
    }

    function puntajeMonto(a, b) {
        var ma = Math.abs(entero(a)), mb = Math.abs(entero(b));
        if (!ma || !mb) return 0;
        if (ma === mb) return 100;
        var diff = Math.abs(ma - mb) / Math.max(ma, mb);
        if (diff <= 0.01) return 75;
        if (diff <= 0.03) return 45;
        return 0;
    }

    function mesSiguiente(periodo) {
        var p = String(periodo || '2026-10').split('-').map(Number);
        var y = p[0] || 2026, m = (p[1] || 10) + 1;
        if (m > 12) { m = 1; y++; }
        return y + '-' + dos(m);
    }

    function finDeMes(periodo) {
        var p = String(periodo || '2026-10').split('-').map(Number);
        var d = new Date(Date.UTC(p[0] || 2026, p[1] || 10, 0));
        return (p[0] || 2026) + '-' + dos(p[1] || 10) + '-' + dos(d.getUTCDate());
    }

    function calcularFlujoCaja(datos) {
        datos = datos || {};
        var periodo = datos.periodo || '2026-10';
        var saldoHoy = entero(datos.saldoBancoHoy);
        var cobranzasPend = (datos.cobranzas || []).filter(function (c) { return !c.pagada; });
        var pagosPend = (datos.pagos || []).filter(function (p) { return !p.pagada; });

        var porEntrar = cobranzasPend.reduce(function (s, c) { return s + entero(c.monto); }, 0);
        var totalCxP = pagosPend.reduce(function (s, p) { return s + entero(p.monto); }, 0);

        var ob = datos.obligacionesMes || {};
        var sueldosPend = ob.sueldosConciliados ? 0 : entero(ob.sueldosLiquidos);
        var previredPend = ob.previredConciliado ? 0 : entero(ob.previred);
        var f29Pend = ob.f29Conciliado ? 0 : entero(ob.f29Total);

        var porSalir = totalCxP + sueldosPend + previredPend + f29Pend;
        var proyeccion = saldoHoy + porEntrar - porSalir;

        var gastoDiario = porSalir > 0 ? (porSalir / 30) : 0;
        var diasHolgura = gastoDiario > 0 ? Math.max(0, Math.round(Math.max(0, saldoHoy + porEntrar) / gastoDiario)) : null;

        var compromisos = [];
        if (sueldosPend > 0) {
            compromisos.push({
                id: 'comp-sueldos',
                fecha: finDeMes(periodo),
                titulo: 'Pago de sueldos líquidos del equipo',
                detalle: 'Calculado desde tus liquidaciones del mes',
                monto: sueldosPend,
                tipo: 'egreso',
                ruta: 'liquidaciones'
            });
        }
        var sigMes = mesSiguiente(periodo);
        if (previredPend > 0) {
            compromisos.push({
                id: 'comp-previred',
                fecha: sigMes + '-13',
                titulo: 'Cotizaciones previsionales Previred',
                detalle: 'Tope electrónico día 13 a las 13:45 h',
                monto: previredPend,
                tipo: 'egreso',
                ruta: 'liquidaciones'
            });
        }
        if (f29Pend > 0) {
            compromisos.push({
                id: 'comp-f29',
                fecha: sigMes + '-20',
                titulo: 'Impuestos mensuales Formulario 29 (SII)',
                detalle: ob.f29Cerrado ? 'Monto declarado por tu contador' : 'Provisión estimada de IVA, PPM y retenciones',
                monto: f29Pend,
                tipo: 'egreso',
                ruta: 'mi-contador'
            });
        }
        pagosPend.forEach(function (p) {
            compromisos.push({
                id: 'comp-' + p.id,
                fecha: p.vencimiento || p.fecha,
                titulo: p.razonSocial + ' · Factura ' + p.folio,
                detalle: 'Proveedor por pagar',
                monto: entero(p.monto),
                tipo: 'egreso',
                ruta: 'pagos'
            });
        });

        compromisos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });

        return {
            saldoBancoHoy: saldoHoy,
            porEntrarMes: porEntrar,
            facturasPorCobrar: cobranzasPend.length,
            porSalirMes: porSalir,
            facturasPorPagar: pagosPend.length,
            proyeccionFinMes: proyeccion,
            diasHolgura: diasHolgura,
            compromisos: compromisos
        };
    }

    function resolverPuenteContable(empresa, periodo, suiteStore, localBridge) {
        suiteStore = suiteStore || {};
        localBridge = localBridge || {};
        var nombreNorm = normalizarTexto(empresa && empresa.razonSocial);
        var rutLimpio = String((empresa && empresa.rut) || '').replace(/[\s.-]/g, '').toLowerCase();

        var regSuite = null;
        Object.keys(suiteStore).forEach(function (k) {
            var partes = k.split('::');
            if (partes[1] !== periodo) return;
            var claveCli = normalizarTexto(partes[0]);
            if ((nombreNorm && claveCli === nombreNorm) || (rutLimpio && claveCli.replace(/[\s.-]/g, '') === rutLimpio) || (localBridge.claveSuite && claveCli === normalizarTexto(localBridge.claveSuite))) {
                regSuite = suiteStore[k];
            }
        });

        var regimen = (regSuite && regSuite.regimen) || localBridge.regimen || '14D3';
        var cerrado = regSuite ? !!regSuite.cerradoTributario : !!localBridge.cerradoTributario;
        var fechaCierre = (regSuite && regSuite.fechaCierre) || localBridge.fechaCierre || '';

        var f29 = Object.assign({
            ivaDebito: 0,
            ivaCredito: 0,
            iusc48: 0,
            retencion151: 0,
            ppm: 0,
            totalPagar91: 0
        }, localBridge.f29Resumen || {});

        if (regSuite && F29Mod() && F29Mod().calcularF29) {
            try {
                var rVentas = regSuite.ventasCsv ? F29Mod().parsearRcv(regSuite.ventasCsv, 'ventas') : null;
                var rCompras = regSuite.comprasCsv ? F29Mod().parsearRcv(regSuite.comprasCsv, 'compras') : null;
                if (rVentas || rCompras || entero(regSuite.honorariosBruto) > 0) {
                    var calc = F29Mod().calcularF29({
                        periodo: periodo,
                        regimen: regimen,
                        ventas: rVentas || undefined,
                        compras: rCompras || undefined,
                        remanenteAnterior: entero(regSuite.remanenteAnterior),
                        impuestoUnico48: f29.iusc48 || entero(regSuite.iuscManual),
                        honorariosBruto: entero(regSuite.honorariosBruto)
                    });
                    var cods = calc.codigos || {};
                    f29 = {
                        ivaDebito: cods[538] || 0,
                        ivaCredito: cods[537] || 0,
                        iusc48: cods[48] || 0,
                        retencion151: cods[151] || 0,
                        ppm: cods[62] || 0,
                        totalPagar91: cods[91] || 0
                    };
                }
            } catch (e) { /* mantiene resumen previo */ }
        }

        return {
            conectadoSuite: !!regSuite,
            regimen: regimen,
            regimenNombre: REGIMENES[regimen] || REGIMENES['14D3'],
            cerradoTributario: cerrado,
            fechaCierre: fechaCierre,
            estudio: Object.assign({
                nombreEstudio: 'Sin estudio vinculado',
                contadorNombre: '',
                correo: '',
                telefono: ''
            }, localBridge.estudio || {}),
            f29Resumen: f29,
            solicitudesReapertura: Array.isArray(localBridge.solicitudesReapertura) ? localBridge.solicitudesReapertura : []
        };
    }

    function semillaEjemploFinanzas(periodo, periodoAnterior, hoyIso, laboralActual, laboralAnterior) {
        laboralActual = laboralActual || { liquido: 1850000, previred: 540000, impuesto: 0, retencion: 27450 };
        laboralAnterior = laboralAnterior || { liquido: 1920000, previred: 565000, impuesto: 0, retencion: 0 };

        var estudioDemo = {
            nombreEstudio: 'Soto y Asociados Contadores Auditores',
            contadorNombre: 'Paula Soto Riquelme',
            correo: 'paula.soto@sotocontadores.cl',
            telefono: '+56987654321'
        };
        var cuentaCobroDemo = {
            banco: 'BancoEstado',
            tipoCuenta: 'corriente',
            numeroCuenta: '6250014892',
            correo: 'pagos@losaromos.cl'
        };

        var porPeriodo = {};
        porPeriodo[periodoAnterior] = {
            saldoInicialManual: 3420000,
            ultimoSaldoCartola: 4180000,
            fechaCartola: finDeMes(periodoAnterior),
            cobranzas: [
                { id: 'cxc-pa-1', rut: '76.112.340-8', razonSocial: 'Cafetería El Rincón del Sur Ltda.', folio: '1084', tipoDte: 33, fecha: periodoAnterior + '-08', vencimiento: periodoAnterior + '-25', monto: 690200, telefono: '+56991234567', pagada: true, fechaPago: periodoAnterior + '-24', origen: 'RCV SII' },
                { id: 'cxc-pa-2', rut: '77.450.890-1', razonSocial: 'Hotel Frontera Temuco SpA', folio: '1089', tipoDte: 33, fecha: periodoAnterior + '-14', vencimiento: periodoAnterior + '-29', monto: 952000, telefono: '+56992345678', pagada: true, fechaPago: periodoAnterior + '-28', origen: 'RCV SII' }
            ],
            pagos: [
                { id: 'cxp-pa-1', tipoDoc: 'cxp', rut: '96.540.110-K', razonSocial: 'Molinos Cunco S.A.', folio: '45120', tipoDte: 33, fecha: periodoAnterior + '-05', vencimiento: periodoAnterior + '-20', monto: 785400, banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '0018945002', correo: 'cobranzas@molinoscunco.cl', pagada: true, fechaPago: periodoAnterior + '-19', origen: 'RCV SII' }
            ],
            movimientos: [
                { id: 'mov-pa-1', fecha: periodoAnterior + '-19', glosa: 'TEF A MOLINOS CUNCO FACT 45120', tipo: 'cargo', monto: 785400, saldo: 3228000, conciliadoCon: { tipoDestino: 'cxp', destinoId: 'cxp-pa-1', titulo: 'Molinos Cunco S.A. · Factura 45120' } },
                { id: 'mov-pa-2', fecha: periodoAnterior + '-28', glosa: 'ABONO HOTEL FRONTERA TEMUCO F1089', tipo: 'abono', monto: 952000, saldo: 4180000, conciliadoCon: { tipoDestino: 'cxc', destinoId: 'cxc-pa-2', titulo: 'Hotel Frontera Temuco SpA · Factura 1089' } }
            ],
            obligacionesConciliadas: { sueldos: true, previred: true, f29: true },
            puenteLocal: {
                regimen: '14D3',
                cerradoTributario: true,
                fechaCierre: periodo + '-18',
                estudio: estudioDemo,
                f29Resumen: {
                    ivaDebito: 896800,
                    ivaCredito: 512400,
                    iusc48: laboralAnterior.impuesto || 0,
                    retencion151: 27450,
                    ppm: 5900,
                    totalPagar91: 417750
                },
                solicitudesReapertura: []
            }
        };

        porPeriodo[periodo] = {
            saldoInicialManual: 4180000,
            ultimoSaldoCartola: 4685800,
            fechaCartola: hoyIso,
            cobranzas: [
                { id: 'cxc-p-1', rut: '76.112.340-8', razonSocial: 'Cafetería El Rincón del Sur Ltda.', folio: '1102', tipoDte: 33, fecha: sumarDias(hoyIso, -34), vencimiento: sumarDias(hoyIso, -4), monto: 749700, telefono: '+56991234567', pagada: false, fechaPago: '', origen: 'RCV SII' },
                { id: 'cxc-p-2', rut: '78.320.410-5', razonSocial: 'Minimarket Araucanía SpA', folio: '1108', tipoDte: 33, fecha: sumarDias(hoyIso, -12), vencimiento: sumarDias(hoyIso, 3), monto: 535500, telefono: '+56993456789', pagada: false, fechaPago: '', origen: 'RCV SII' },
                { id: 'cxc-p-3', rut: '77.450.890-1', razonSocial: 'Hotel Frontera Temuco SpA', folio: '1115', tipoDte: 33, fecha: sumarDias(hoyIso, -5), vencimiento: sumarDias(hoyIso, 18), monto: 1190000, telefono: '+56992345678', pagada: false, fechaPago: '', origen: 'RCV SII' },
                { id: 'cxc-p-4', rut: '76.890.230-2', razonSocial: 'Banquetería Cautín Ltda.', folio: '1099', tipoDte: 33, fecha: sumarDias(hoyIso, -18), vencimiento: sumarDias(hoyIso, -2), monto: 428400, telefono: '+56994567890', pagada: true, fechaPago: sumarDias(hoyIso, -3), origen: 'RCV SII' }
            ],
            pagos: [
                { id: 'cxp-p-1', tipoDoc: 'cxp', rut: '96.540.110-K', razonSocial: 'Molinos Cunco S.A.', folio: '46088', tipoDte: 33, fecha: sumarDias(hoyIso, -20), vencimiento: sumarDias(hoyIso, 2), monto: 844900, banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '0018945002', correo: 'cobranzas@molinoscunco.cl', pagada: false, fechaPago: '', origen: 'RCV SII' },
                { id: 'cxp-p-2', tipoDoc: 'cxp', rut: '76.204.990-7', razonSocial: 'Lácteos y Mantequillas del Sur Ltda.', folio: '9314', tipoDte: 33, fecha: sumarDias(hoyIso, -25), vencimiento: sumarDias(hoyIso, -3), monto: 464100, banco: 'Banco Santander', tipoCuenta: 'corriente', numeroCuenta: '0681239901', correo: 'pagos@lacteosdelsur.cl', pagada: false, fechaPago: '', origen: 'RCV SII' },
                { id: 'cxp-p-3', tipoDoc: 'cxp', rut: '88.272.600-2', razonSocial: 'Distribuidora Envases BioBío SpA', folio: '1820', tipoDte: 33, fecha: sumarDias(hoyIso, -6), vencimiento: sumarDias(hoyIso, 14), monto: 297500, banco: '', tipoCuenta: '', numeroCuenta: '', correo: '', pagada: false, fechaPago: '', origen: 'RCV SII' }
            ],
            movimientos: [
                { id: 'mov-p-1', fecha: sumarDias(hoyIso, -3), glosa: 'TRANSF BANQUETERIA CAUTIN F1099', tipo: 'abono', monto: 428400, saldo: 4995200, conciliadoCon: { tipoDestino: 'cxc', destinoId: 'cxc-p-4', titulo: 'Banquetería Cautín Ltda. · Factura 1099' } },
                { id: 'mov-p-2', fecha: sumarDias(hoyIso, -1), glosa: 'ABONO TEF MINIMARKET ARAUCANIA FACT 1108', tipo: 'abono', monto: 535500, saldo: 5530700, conciliadoCon: null },
                { id: 'mov-p-3', fecha: hoyIso, glosa: 'CARGO PAC MOLINOS CUNCO 46088', tipo: 'cargo', monto: 844900, saldo: 4685800, conciliadoCon: null }
            ],
            obligacionesConciliadas: { sueldos: false, previred: false, f29: false },
            puenteLocal: {
                regimen: '14D3',
                cerradoTributario: false,
                fechaCierre: '',
                estudio: estudioDemo,
                f29Resumen: {
                    ivaDebito: 1024100,
                    ivaCredito: 586150,
                    iusc48: laboralActual.impuesto || 0,
                    retencion151: laboralActual.retencion || 27450,
                    ppm: 6750,
                    totalPagar91: (1024100 - 586150) + (laboralActual.impuesto || 0) + (laboralActual.retencion || 27450) + 6750
                },
                solicitudesReapertura: []
            }
        };

        return {
            estudio: estudioDemo,
            cuentaCobro: cuentaCobroDemo,
            regimen: '14D3',
            proveedoresBanco: {
                '96.540.110-K': { banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '0018945002', correo: 'cobranzas@molinoscunco.cl' },
                '76.204.990-7': { banco: 'Banco Santander', tipoCuenta: 'corriente', numeroCuenta: '0681239901', correo: 'pagos@lacteosdelsur.cl' }
            },
            periodos: porPeriodo
        };
    }

    // =========================================================================
    // CONTROLADOR DE INTERFAZ (/app)
    // =========================================================================
    function montarUI(app) {
        if (!app || typeof document === 'undefined') return null;

        var $ = function (id) { return document.getElementById(id); };
        var memoriaEjemplo = null;
        var ejemploSembradoPara = '';

        var ui = {
            filtroCobranzas: 'todas',
            filtroPagos: 'pendientes',
            filtroConciliacion: 'pendientes',
            seleccionPagos: {},
            movSeleccionadoId: null,
            cobroDocActivo: null,
            provDocActivo: null
        };

        function claveEmpresa() {
            var est = app.getEstado();
            if (!est) return 'unica';
            if (app.esEjemplo()) return 'ejemplo';
            return est.empresaId || ((est.empresa && est.empresa.rut) ? est.empresa.rut.replace(/\D/g, '') : 'unica');
        }

        function leerAlmacenRaiz() {
            if (app.esEjemplo()) {
                asegurarSemillaEjemplo();
                return { ejemplo: memoriaEjemplo };
            }
            try {
                var raw = window.localStorage.getItem(K_FINANZAS);
                var parsed = raw ? JSON.parse(raw) : {};
                return (parsed && typeof parsed === 'object') ? parsed : {};
            } catch (e) {
                return {};
            }
        }

        function guardarAlmacenRaiz(raiz) {
            if (app.esEjemplo()) {
                memoriaEjemplo = raiz.ejemplo;
                return;
            }
            try { window.localStorage.setItem(K_FINANZAS, JSON.stringify(raiz)); } catch (e) { /* sin espacio */ }
        }

        function asegurarSemillaEjemplo() {
            if (memoriaEjemplo) return;
            var p = app.getPeriodo() || '2026-10';
            var pa = app.mesAnteriorDe(p);
            memoriaEjemplo = semillaEjemploFinanzas(
                p,
                pa,
                app.hoyIso(),
                app.resumenLaboralMes(p),
                app.resumenLaboralMes(pa)
            );
            ejemploSembradoPara = p + '::' + pa;
        }

        function limpiarEjemplo() {
            memoriaEjemplo = null;
            ejemploSembradoPara = '';
            ui.seleccionPagos = {};
            ui.movSeleccionadoId = null;
        }

        function datosEmpresaFinanzas() {
            var raiz = leerAlmacenRaiz();
            var k = claveEmpresa();
            if (!raiz[k]) {
                raiz[k] = {
                    estudio: { nombreEstudio: '', contadorNombre: '', correo: '', telefono: '' },
                    cuentaCobro: { banco: '', tipoCuenta: 'corriente', numeroCuenta: '', correo: '' },
                    regimen: '14D3',
                    proveedoresBanco: {},
                    periodos: {}
                };
            }
            return { raiz: raiz, emp: raiz[k], k: k };
        }

        function datosPeriodoActual(periodo) {
            periodo = periodo || app.getPeriodo();
            var d = datosEmpresaFinanzas();
            if (!d.emp.periodos[periodo]) {
                d.emp.periodos[periodo] = {
                    saldoInicialManual: 0,
                    ultimoSaldoCartola: null,
                    fechaCartola: '',
                    cobranzas: [],
                    pagos: [],
                    movimientos: [],
                    obligacionesConciliadas: { sueldos: false, previred: false, f29: false },
                    puenteLocal: {
                        regimen: d.emp.regimen || '14D3',
                        cerradoTributario: false,
                        fechaCierre: '',
                        estudio: d.emp.estudio || {},
                        f29Resumen: { ivaDebito: 0, ivaCredito: 0, iusc48: 0, retencion151: 0, ppm: 0, totalPagar91: 0 },
                        solicitudesReapertura: []
                    }
                };
            }
            return { raiz: d.raiz, emp: d.emp, per: d.emp.periodos[periodo], periodo: periodo };
        }

        function mutarPeriodoActual(fn) {
            var ctx = datosPeriodoActual();
            fn(ctx.per, ctx.emp);
            guardarAlmacenRaiz(ctx.raiz);
            actualizarInsigniasYBanner();
            return ctx;
        }

        function leerSuiteLocalStorage() {
            try {
                var raw = window.localStorage.getItem(K_SUITE_CONTABLE);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        function puenteDePeriodo(periodo) {
            var est = app.getEstado();
            var ctx = datosPeriodoActual(periodo);
            var local = Object.assign({}, ctx.per.puenteLocal || {}, {
                estudio: ctx.emp.estudio || (ctx.per.puenteLocal && ctx.per.puenteLocal.estudio) || {},
                regimen: ctx.emp.regimen || (ctx.per.puenteLocal && ctx.per.puenteLocal.regimen) || '14D3'
            });
            var lab = app.resumenLaboralMes(periodo);
            if (local.f29Resumen) {
                if (!local.cerradoTributario) {
                    var ivaNeto = Math.max(0, entero(local.f29Resumen.ivaDebito) - entero(local.f29Resumen.ivaCredito));
                    var iusc = lab.impuesto || entero(local.f29Resumen.iusc48);
                    var ret = lab.retencion || entero(local.f29Resumen.retencion151);
                    var ppm = entero(local.f29Resumen.ppm);
                    local.f29Resumen = Object.assign({}, local.f29Resumen, {
                        iusc48: iusc,
                        retencion151: ret,
                        totalPagar91: ivaNeto + iusc + ret + ppm
                    });
                }
            }
            return resolverPuenteContable(est && est.empresa, periodo, leerSuiteLocalStorage(), local);
        }

        function estaCerrado(periodo) {
            if (!app.getEstado()) return false;
            return !!puenteDePeriodo(periodo || app.getPeriodo()).cerradoTributario;
        }

        function obligacionesDelMes(periodo) {
            periodo = periodo || app.getPeriodo();
            var ctx = datosPeriodoActual(periodo);
            var lab = app.resumenLaboralMes(periodo);
            var puente = puenteDePeriodo(periodo);
            var conc = ctx.per.obligacionesConciliadas || {};
            return {
                sueldosLiquidos: entero(lab.liquido),
                previred: entero(lab.previred),
                f29Total: entero(puente.f29Resumen && puente.f29Resumen.totalPagar91),
                f29Cerrado: puente.cerradoTributario,
                sueldosConciliados: !!conc.sueldos,
                previredConciliado: !!conc.previred,
                f29Conciliado: !!conc.f29
            };
        }

        function actualizarInsigniasYBanner() {
            if (!app.getEstado()) return;
            var p = app.getPeriodo();
            var ctx = datosPeriodoActual(p);
            var cxcPend = (ctx.per.cobranzas || []).filter(function (c) { return !c.pagada; }).length;
            var cxpPend = (ctx.per.pagos || []).filter(function (x) { return !x.pagada; }).length;
            var movSin = (ctx.per.movimientos || []).filter(function (m) { return !m.conciliadoCon; }).length;
            var puente = puenteDePeriodo(p);

            var elCxc = $('nav-cobranzas-pendientes');
            if (elCxc) elCxc.textContent = cxcPend > 0 ? String(cxcPend) : '';
            var elCxp = $('nav-pagos-pendientes');
            if (elCxp) elCxp.textContent = cxpPend > 0 ? String(cxpPend) : '';
            var elMov = $('nav-mov-sin-conciliar');
            if (elMov) elMov.textContent = movSin > 0 ? String(movSin) : '';
            var elChip = $('nav-chip-cierre');
            if (elChip) {
                elChip.textContent = puente.cerradoTributario ? 'Cerrado' : 'Abierto';
                elChip.className = 'app-nav-chip ' + (puente.cerradoTributario ? 'cerrado' : 'abierto');
            }

            var banner = $('pm-cierre-banner');
            if (banner) {
                banner.hidden = !puente.cerradoTributario;
                if (puente.cerradoTributario) {
                    $('pm-cierre-banner-txt').textContent =
                        'Período ' + app.nombrePeriodo(p) + ' cerrado tributariamente por contabilidad' +
                        (puente.fechaCierre ? ' el ' + puente.fechaCierre.split('-').reverse().join('-') : '') +
                        '. Las facturas, conciliaciones y liquidaciones de este mes están protegidas para cuadrar con el F29.';
                }
            }
        }

        // ---------------- 1. FLUJO DE CAJA ----------------
        function dibujarFlujoCaja() {
            actualizarInsigniasYBanner();
            var p = app.getPeriodo();
            var ctx = datosPeriodoActual(p);
            var saldoBanco = ctx.per.ultimoSaldoCartola !== null && ctx.per.ultimoSaldoCartola !== undefined
                ? ctx.per.ultimoSaldoCartola
                : ctx.per.saldoInicialManual;
            var flujo = calcularFlujoCaja({
                periodo: p,
                saldoBancoHoy: saldoBanco,
                cobranzas: ctx.per.cobranzas,
                pagos: ctx.per.pagos,
                obligacionesMes: obligacionesDelMes(p)
            });

            $('fc-titulo').textContent = 'Flujo de caja de ' + app.nombrePeriodo(p);
            $('fc-sub').textContent = 'Tu liquidez real y los próximos pagos laborales, previsionales y de proveedores en palabras simples.';

            var notaBanco = ctx.per.fechaCartola
                ? 'Según cartola al ' + ctx.per.fechaCartola.split('-').reverse().join('-')
                : 'Saldo manual registrado';
            var holguraTxt = flujo.diasHolgura !== null
                ? 'Alcanza para ~' + flujo.diasHolgura + ' días de operación'
                : 'Sin compromisos pendientes este mes';
            var claseProy = flujo.proyeccionFinMes < 0 ? 'riesgo' : 'ok';

            $('fc-kpis').innerHTML =
                '<div class="fin-kpi"><span class="fin-kpi-label">Hoy en el banco</span><strong class="fin-kpi-val mono">' + pesos(flujo.saldoBancoHoy) + '</strong><span class="fin-kpi-meta">' + esc(notaBanco) + '</span></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Por entrar este mes</span><strong class="fin-kpi-val mono ok">' + pesos(flujo.porEntrarMes) + '</strong><span class="fin-kpi-meta">' + flujo.facturasPorCobrar + (flujo.facturasPorCobrar === 1 ? ' factura por cobrar' : ' facturas por cobrar') + '</span></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Por salir este mes</span><strong class="fin-kpi-val mono">' + pesos(flujo.porSalirMes) + '</strong><span class="fin-kpi-meta">Sueldos, Previred, F29 y proveedores</span></div>' +
                '<div class="fin-kpi fin-kpi-destacado ' + claseProy + '"><span class="fin-kpi-label">Proyección fin de mes</span><strong class="fin-kpi-val mono">' + pesos(flujo.proyeccionFinMes) + '</strong><span class="fin-kpi-meta">' + esc(holguraTxt) + '</span></div>';

            var listaEl = $('fc-compromisos');
            if (!flujo.compromisos.length) {
                listaEl.innerHTML = '<li class="fin-vacio-li">No tienes pagos pendientes registrados para ' + esc(app.nombrePeriodo(p)) + '.</li>';
            } else {
                listaEl.innerHTML = flujo.compromisos.map(function (c) {
                    var estVenc = estadoVencimiento({ vencimiento: c.fecha, pagada: false }, app.hoyIso());
                    var selloCls = estVenc.codigo === 'vencida' ? 'sello-riesgo' : estVenc.codigo === 'por_vencer' ? 'sello-preparada' : 'sello-guardada';
                    return '<li class="fin-comp-item">' +
                        '<div class="fin-comp-fecha mono">' + esc(c.fecha.slice(8, 10) + '/' + c.fecha.slice(5, 7)) + '</div>' +
                        '<div class="fin-comp-info"><strong>' + esc(c.titulo) + '</strong><span>' + esc(c.detalle) + '</span></div>' +
                        '<div class="fin-comp-der"><span class="sello ' + selloCls + '">' + esc(estVenc.etiqueta) + '</span><strong class="mono">' + pesos(c.monto) + '</strong><a href="/app/' + esc(c.ruta) + '" data-ruta="' + esc(c.ruta) + '" class="btn-texto">Ver</a></div>' +
                        '</li>';
                }).join('');
            }

            var movsCount = (ctx.per.movimientos || []).length;
            var sinConciliar = (ctx.per.movimientos || []).filter(function (m) { return !m.conciliadoCon; }).length;
            $('fc-cartola-resumen').innerHTML = movsCount
                ? '<p class="texto-ayuda"><strong>' + movsCount + ' movimientos cargados</strong> en este período · ' +
                    (sinConciliar ? '<a href="/app/conciliacion" data-ruta="conciliacion">' + sinConciliar + ' listos para conciliar en 1 clic</a>.' : 'todos conciliados al día.') + '</p>'
                : '<p class="texto-ayuda">Aún no subes una cartola en ' + esc(app.nombrePeriodo(p)) + '. Sube el archivo CSV o Excel de tu banco para actualizar el saldo y conciliar pagos.</p>';
        }

        // ---------------- 2. COBRANZAS ----------------
        function dibujarCobranzas() {
            actualizarInsigniasYBanner();
            var p = app.getPeriodo();
            var cerrado = estaCerrado(p);
            var ctx = datosPeriodoActual(p);
            var hoy = app.hoyIso();
            var todas = ctx.per.cobranzas || [];

            $('cob-titulo').textContent = 'Cobranzas · ' + app.nombrePeriodo(p);
            $('cob-btn-nueva').disabled = cerrado;
            $('cob-btn-rcv').disabled = cerrado;
            if (cerrado) $('cob-form-panel').hidden = true;

            var totalPend = 0, totalVencido = 0, totalPronto = 0, totalCobrado = 0;
            todas.forEach(function (c) {
                var st = estadoVencimiento(c, hoy);
                if (st.codigo === 'pagada') totalCobrado += entero(c.monto);
                else {
                    totalPend += entero(c.monto);
                    if (st.codigo === 'vencida') totalVencido += entero(c.monto);
                    else if (st.codigo === 'por_vencer') totalPronto += entero(c.monto);
                }
            });

            $('cob-kpis').innerHTML =
                '<div class="fin-kpi"><span class="fin-kpi-label">Total por cobrar</span><strong class="fin-kpi-val mono">' + pesos(totalPend) + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Vencido hoy</span><strong class="fin-kpi-val mono ' + (totalVencido > 0 ? 'riesgo' : '') + '">' + pesos(totalVencido) + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Vence en 7 días</span><strong class="fin-kpi-val mono">' + pesos(totalPronto) + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Cobrado en el mes</span><strong class="fin-kpi-val mono ok">' + pesos(totalCobrado) + '</strong></div>';

            Array.prototype.forEach.call(document.querySelectorAll('[data-cob-filtro]'), function (b) {
                var act = b.getAttribute('data-cob-filtro') === ui.filtroCobranzas;
                b.classList.toggle('activo', act);
                b.setAttribute('aria-pressed', act ? 'true' : 'false');
            });

            var filtradas = todas.filter(function (c) {
                var st = estadoVencimiento(c, hoy).codigo;
                if (ui.filtroCobranzas === 'todas') return true;
                if (ui.filtroCobranzas === 'vencidas') return st === 'vencida';
                if (ui.filtroCobranzas === 'por_vencer') return st === 'por_vencer';
                if (ui.filtroCobranzas === 'al_dia') return st === 'al_dia';
                if (ui.filtroCobranzas === 'pagadas') return st === 'pagada';
                return true;
            });

            var tbody = $('cob-filas');
            if (!filtradas.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="vacio">No hay facturas en esta vista. Importa el archivo RCV de Ventas del SII o agrega una cuenta por cobrar.</td></tr>';
                return;
            }

            tbody.innerHTML = filtradas.map(function (c) {
                var st = estadoVencimiento(c, hoy);
                var cls = st.codigo === 'pagada' ? 'sello-emitida' : st.codigo === 'vencida' ? 'sello-riesgo' : st.codigo === 'por_vencer' ? 'sello-preparada' : 'sello-guardada';
                var acciones = c.pagada
                    ? (cerrado ? '<span class="texto-ayuda">Protegida</span>' : '<button type="button" class="btn-texto" data-cob-accion="desmarcar" data-id="' + esc(c.id) + '">Reabrir</button>')
                    : '<div class="acciones-pila acciones-fila">' +
                        '<button type="button" class="btn btn-chico" data-cob-accion="cobrar" data-id="' + esc(c.id) + '"><span class="material-icons" aria-hidden="true">send</span>Cobrar</button>' +
                        (cerrado ? '' : '<button type="button" class="btn-texto" data-cob-accion="pagada" data-id="' + esc(c.id) + '">Marcar cobrada</button>') +
                      '</div>';
                return '<tr>' +
                    '<td class="celda-nombre"><strong>' + esc(c.razonSocial) + '</strong><span class="mono">' + esc(c.rut || 'Sin RUT') + '</span></td>' +
                    '<td class="mono">Factura ' + esc(c.folio) + '</td>' +
                    '<td class="fecha">' + esc(c.vencimiento) + '</td>' +
                    '<td><span class="sello ' + cls + '">' + esc(st.etiqueta) + '</span></td>' +
                    '<td class="num">' + pesos(c.monto) + '</td>' +
                    '<td class="celda-acciones">' + acciones + '</td>' +
                    '</tr>';
            }).join('');
        }

        // ---------------- 3. CUENTAS POR PAGAR ----------------
        function dibujarPagos() {
            actualizarInsigniasYBanner();
            var p = app.getPeriodo();
            var cerrado = estaCerrado(p);
            var ctx = datosPeriodoActual(p);
            var hoy = app.hoyIso();
            var todas = ctx.per.pagos || [];

            $('pag-titulo').textContent = 'Cuentas por pagar · ' + app.nombrePeriodo(p);
            $('pag-btn-nueva').disabled = cerrado;
            $('pag-btn-rcv').disabled = cerrado;
            if (cerrado) $('pag-form-panel').hidden = true;

            var totalPend = 0, totalVencido = 0, totalSel = 0, cantSel = 0;
            todas.forEach(function (x) {
                var st = estadoVencimiento(x, hoy);
                if (st.codigo !== 'pagada') {
                    totalPend += entero(x.monto);
                    if (st.codigo === 'vencida') totalVencido += entero(x.monto);
                    if (ui.seleccionPagos[x.id]) {
                        totalSel += entero(x.monto);
                        cantSel++;
                    }
                }
            });

            $('pag-kpis').innerHTML =
                '<div class="fin-kpi"><span class="fin-kpi-label">Pendiente proveedores</span><strong class="fin-kpi-val mono">' + pesos(totalPend) + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Facturas vencidas</span><strong class="fin-kpi-val mono ' + (totalVencido > 0 ? 'riesgo' : '') + '">' + pesos(totalVencido) + '</strong></div>' +
                '<div class="fin-kpi fin-kpi-destacado"><span class="fin-kpi-label">Seleccionado para nómina</span><strong class="fin-kpi-val mono">' + pesos(totalSel) + '</strong><span class="fin-kpi-meta">' + cantSel + (cantSel === 1 ? ' factura marcada' : ' facturas marcadas') + '</span></div>';

            $('pag-btn-nomina-txt').textContent = cantSel > 0 ? 'Descargar nómina (' + cantSel + ')' : 'Descargar nómina bancaria';

            Array.prototype.forEach.call(document.querySelectorAll('[data-pag-filtro]'), function (b) {
                var act = b.getAttribute('data-pag-filtro') === ui.filtroPagos;
                b.classList.toggle('activo', act);
                b.setAttribute('aria-pressed', act ? 'true' : 'false');
            });

            var filtradas = todas.filter(function (x) {
                var st = estadoVencimiento(x, hoy).codigo;
                if (ui.filtroPagos === 'todas') return true;
                if (ui.filtroPagos === 'pendientes') return st !== 'pagada';
                if (ui.filtroPagos === 'vencidas') return st === 'vencida';
                if (ui.filtroPagos === 'pagadas') return st === 'pagada';
                return true;
            });

            var tbody = $('pag-filas');
            if (!filtradas.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay facturas de proveedores en esta vista. Importa el RCV de Compras del SII o registra una factura.</td></tr>';
                return;
            }

            tbody.innerHTML = filtradas.map(function (x) {
                var st = estadoVencimiento(x, hoy);
                var cls = st.codigo === 'pagada' ? 'sello-emitida' : st.codigo === 'vencida' ? 'sello-riesgo' : st.codigo === 'por_vencer' ? 'sello-preparada' : 'sello-guardada';
                var tieneBanco = x.banco && x.tipoCuenta && x.numeroCuenta;
                var infoBanco = tieneBanco
                    ? '<span class="fin-banco-ok">' + esc(x.banco) + ' · ' + esc(x.numeroCuenta) + '</span>'
                    : '<button type="button" class="btn-texto" data-pag-accion="banco" data-id="' + esc(x.id) + '">Completar cuenta bancaria</button>';
                var check = x.pagada
                    ? ''
                    : '<input type="checkbox" class="pag-check" data-id="' + esc(x.id) + '" aria-label="Seleccionar factura ' + esc(x.folio) + '"' + (ui.seleccionPagos[x.id] ? ' checked' : '') + '>';
                var acc = x.pagada
                    ? (cerrado ? '<span class="texto-ayuda">Protegida</span>' : '<button type="button" class="btn-texto" data-pag-accion="desmarcar" data-id="' + esc(x.id) + '">Reabrir</button>')
                    : '<div class="acciones-pila acciones-fila">' +
                        '<button type="button" class="btn-texto" data-pag-accion="banco" data-id="' + esc(x.id) + '">Cuenta</button>' +
                        (cerrado ? '' : '<button type="button" class="btn-texto" data-pag-accion="pagada" data-id="' + esc(x.id) + '">Marcar pagada</button>') +
                      '</div>';
                return '<tr>' +
                    '<td class="fin-col-check">' + check + '</td>' +
                    '<td class="celda-nombre"><strong>' + esc(x.razonSocial) + '</strong><span>' + esc(x.rut || 'Sin RUT') + ' · ' + infoBanco + '</span></td>' +
                    '<td class="mono">Factura ' + esc(x.folio) + '</td>' +
                    '<td class="fecha">' + esc(x.vencimiento) + '</td>' +
                    '<td><span class="sello ' + cls + '">' + esc(st.etiqueta) + '</span></td>' +
                    '<td class="num">' + pesos(x.monto) + '</td>' +
                    '<td class="celda-acciones">' + acc + '</td>' +
                    '</tr>';
            }).join('');
        }

        // ---------------- 4. CONCILIACION BANCARIA ----------------
        function dibujarConciliacion() {
            actualizarInsigniasYBanner();
            var p = app.getPeriodo();
            var cerrado = estaCerrado(p);
            var ctx = datosPeriodoActual(p);
            var movs = ctx.per.movimientos || [];
            var ob = obligacionesDelMes(p);

            $('conc-titulo').textContent = 'Conciliación bancaria · ' + app.nombrePeriodo(p);
            $('conc-btn-cartola').disabled = cerrado;

            var cruces = sugerirConciliacion(movs, {
                cobranzas: ctx.per.cobranzas,
                pagos: ctx.per.pagos,
                obligacionesMes: ob
            });

            var conciliados = movs.filter(function (m) { return !!m.conciliadoCon; }).length;
            var sinConciliar = movs.length - conciliados;
            var sugeridos1Clic = cruces.filter(function (c) { return !!c.mejorMatch; }).length;

            $('conc-kpis').innerHTML =
                '<div class="fin-kpi"><span class="fin-kpi-label">Movimientos en cartola</span><strong class="fin-kpi-val mono">' + movs.length + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Conciliados</span><strong class="fin-kpi-val mono ok">' + conciliados + '</strong></div>' +
                '<div class="fin-kpi"><span class="fin-kpi-label">Sin conciliar</span><strong class="fin-kpi-val mono">' + sinConciliar + '</strong></div>' +
                '<div class="fin-kpi fin-kpi-destacado"><span class="fin-kpi-label">Listos en 1 clic</span><strong class="fin-kpi-val mono">' + sugeridos1Clic + '</strong><span class="fin-kpi-meta">Coincidencia exacta de monto y glosa</span></div>';

            Array.prototype.forEach.call(document.querySelectorAll('[data-conc-filtro]'), function (b) {
                var act = b.getAttribute('data-conc-filtro') === ui.filtroConciliacion;
                b.classList.toggle('activo', act);
                b.setAttribute('aria-pressed', act ? 'true' : 'false');
            });

            var visibles = cruces.filter(function (c) {
                if (ui.filtroConciliacion === 'pendientes') return !c.movimiento.conciliadoCon;
                if (ui.filtroConciliacion === 'conciliados') return !!c.movimiento.conciliadoCon;
                return true;
            });

            if (!ui.movSeleccionadoId || !visibles.some(function (c) { return c.movimiento.id === ui.movSeleccionadoId; })) {
                ui.movSeleccionadoId = visibles[0] ? visibles[0].movimiento.id : null;
            }

            var colIzq = $('conc-lista-banco');
            var colDer = $('conc-lista-empresa');

            if (!visibles.length) {
                colIzq.innerHTML = '<div class="detalle-vacio">No hay movimientos bancarios en esta vista. Sube tu cartola CSV o Excel arriba a la derecha.</div>';
                colDer.innerHTML = '<div class="detalle-vacio">Selecciona un movimiento bancario para ver con qué factura, sueldo o impuesto cruzarlo.</div>';
                return;
            }

            colIzq.innerHTML = visibles.map(function (c) {
                var m = c.movimiento;
                var sel = m.id === ui.movSeleccionadoId;
                var signo = m.tipo === 'abono' ? '+' : '-';
                var clsMonto = m.tipo === 'abono' ? 'ok' : '';
                var badge = m.conciliadoCon
                    ? '<span class="sello sello-emitida"><span class="material-icons" aria-hidden="true">check_circle</span>' + esc(m.conciliadoCon.titulo) + '</span>'
                    : (c.mejorMatch
                        ? '<span class="sello sello-preparada">Sugerencia lista</span>'
                        : '<span class="sello sello-sin">Sin cruzar</span>');
                var btnRapido = (!m.conciliadoCon && c.mejorMatch && !cerrado)
                    ? '<button type="button" class="btn btn-chico btn-primario" data-conc-rapido="' + esc(m.id) + '" data-tipo="' + esc(c.mejorMatch.tipoDestino) + '" data-destino="' + esc(c.mejorMatch.destinoId) + '"><span class="material-icons" aria-hidden="true">bolt</span>Conciliar en 1 clic</button>'
                    : (m.conciliadoCon && !cerrado
                        ? '<button type="button" class="btn-texto" data-conc-deshacer="' + esc(m.id) + '">Deshacer</button>'
                        : '');

                return '<div class="conc-card' + (sel ? ' activo' : '') + '" data-conc-sel="' + esc(m.id) + '" tabindex="0">' +
                    '<div class="conc-card-top"><span class="mono conc-fecha">' + esc(m.fecha) + '</span><strong class="mono ' + clsMonto + '">' + signo + pesos(m.monto).replace('$', '$') + '</strong></div>' +
                    '<p class="conc-glosa">' + esc(m.glosa) + '</p>' +
                    '<div class="conc-card-pie">' + badge + btnRapido + '</div>' +
                    '</div>';
            }).join('');

            var activo = cruces.filter(function (c) { return c.movimiento.id === ui.movSeleccionadoId; })[0];
            if (!activo) {
                colDer.innerHTML = '<div class="detalle-vacio">Elige un movimiento de la columna izquierda.</div>';
                return;
            }
            var movA = activo.movimiento;
            if (movA.conciliadoCon) {
                colDer.innerHTML = '<div class="panel-cuerpo">' +
                    '<p class="h-seccion">Movimiento ya conciliado</p>' +
                    '<p class="texto-ayuda">Cruzado con <strong>' + esc(movA.conciliadoCon.titulo) + '</strong> por <strong class="mono">' + pesos(movA.monto) + '</strong>.</p>' +
                    (cerrado ? '<p class="texto-ayuda" style="margin-top:10px">El período está cerrado por contabilidad.</p>' : '<div class="form-acciones"><button type="button" class="btn" data-conc-deshacer="' + esc(movA.id) + '">Deshacer conciliación</button></div>') +
                    '</div>';
                return;
            }

            var htmlCand = activo.candidatos.map(function (cand) {
                return '<div class="conc-cand">' +
                    '<div><strong>' + esc(cand.titulo) + '</strong><span>' + esc(cand.subtitulo) + '</span></div>' +
                    '<div class="conc-cand-der"><strong class="mono">' + pesos(cand.monto) + '</strong>' +
                    (cerrado ? '' : '<button type="button" class="btn btn-chico' + (cand.confianza === 'alta' ? ' btn-primario' : '') + '" data-conc-aplicar="' + esc(movA.id) + '" data-tipo="' + esc(cand.tipoDestino) + '" data-destino="' + esc(cand.destinoId) + '" data-titulo="' + esc(cand.titulo) + '">Conciliar</button>') +
                    '</div></div>';
            }).join('');

            var directoTxt = movA.tipo === 'abono' ? 'Otro ingreso bancario sin factura' : 'Gasto bancario / comisión directa';
            colDer.innerHTML = '<div class="panel-cuerpo">' +
                '<p class="h-seccion">' + (movA.tipo === 'abono' ? 'Facturas por cobrar sugeridas' : 'Pagos y obligaciones sugeridas') + '</p>' +
                '<p class="texto-ayuda" style="margin-bottom:12px">Para <strong>' + esc(movA.glosa) + '</strong> (<span class="mono">' + pesos(movA.monto) + '</span>):</p>' +
                (htmlCand || '<p class="texto-ayuda">No encontramos una factura por ese mismo monto. Puedes conciliarlo como movimiento directo o registrar primero la factura.</p>') +
                (cerrado ? '' : '<div class="conc-directo"><button type="button" class="btn-texto" data-conc-aplicar="' + esc(movA.id) + '" data-tipo="directo" data-destino="directo" data-titulo="' + esc(directoTxt) + '">Marcar como «' + esc(directoTxt) + '»</button></div>') +
                '</div>';
        }

        // ---------------- 5. MI CONTADOR Y CIERRE ----------------
        function dibujarMiContador() {
            actualizarInsigniasYBanner();
            var p = app.getPeriodo();
            var ctx = datosPeriodoActual(p);
            var puente = puenteDePeriodo(p);

            $('mc-titulo').textContent = 'Mi Contador y Cierre · ' + app.nombrePeriodo(p);

            $('mc-est-nombre').value = ctx.emp.estudio.nombreEstudio || puente.estudio.nombreEstudio || '';
            $('mc-est-contador').value = ctx.emp.estudio.contadorNombre || puente.estudio.contadorNombre || '';
            $('mc-est-correo').value = ctx.emp.estudio.correo || puente.estudio.correo || '';
            $('mc-est-telefono').value = ctx.emp.estudio.telefono || puente.estudio.telefono || '';
            $('mc-regimen').value = puente.regimen || '14D3';

            $('mc-cobro-banco').value = ctx.emp.cuentaCobro.banco || '';
            $('mc-cobro-tipo').value = ctx.emp.cuentaCobro.tipoCuenta || 'corriente';
            $('mc-cobro-numero').value = ctx.emp.cuentaCobro.numeroCuenta || '';
            $('mc-cobro-correo').value = ctx.emp.cuentaCobro.correo || '';

            var badgeEstado = puente.cerradoTributario
                ? '<span class="sello sello-emitida"><span class="material-icons" aria-hidden="true">lock</span>Cerrado tributariamente</span>'
                : '<span class="sello sello-preparada"><span class="material-icons" aria-hidden="true">schedule</span>Abierto · En preparación</span>';

            var notaOrigen = puente.conectadoSuite
                ? 'Sincronizado en vivo con Suite Contadores en este navegador.'
                : 'Conectado mediante respaldo colaborativo del estudio.';

            var f = puente.f29Resumen || {};
            $('mc-cierre-panel').innerHTML =
                '<div class="mc-estado-top">' + badgeEstado + '<span class="texto-ayuda">' + esc(notaOrigen) + '</span></div>' +
                '<p class="texto-ayuda" style="margin-top:8px">Régimen vigente: <strong>' + esc(puente.regimenNombre) + '</strong></p>' +
                '<dl class="detalle-dl">' +
                    '<div><dt>IVA Débito Fiscal del mes</dt><dd class="mono">' + pesos(f.ivaDebito) + '</dd></div>' +
                    '<div><dt>IVA Crédito Fiscal recuperable</dt><dd class="mono">' + pesos(f.ivaCredito) + '</dd></div>' +
                    '<div><dt>Impuesto único trabajadores (cód. 48)</dt><dd class="mono">' + pesos(f.iusc48) + '</dd></div>' +
                    '<div><dt>Retención boletas honorarios (cód. 151)</dt><dd class="mono">' + pesos(f.retencion151) + '</dd></div>' +
                    '<div><dt>PPM mensual estimado (cód. 62)</dt><dd class="mono">' + pesos(f.ppm) + '</dd></div>' +
                    '<div class="mc-total-f29"><dt>Total F29 del período (cód. 91)</dt><dd class="mono">' + pesos(f.totalPagar91) + '</dd></div>' +
                '</dl>' +
                '<div class="form-acciones" style="margin-top:16px">' +
                    (puente.cerradoTributario
                        ? '<button type="button" class="btn btn-primario" id="mc-btn-solicitar-reapertura"><span class="material-icons" aria-hidden="true">lock_open</span>Solicitar reapertura al contador</button>' +
                          '<button type="button" class="btn-texto" id="mc-btn-simular-toggle">Simular reapertura del contador</button>'
                        : '<button type="button" class="btn" id="mc-btn-simular-toggle"><span class="material-icons" aria-hidden="true">verified_user</span>Simular cierre tributario del contador</button>') +
                '</div>';

            var solicitudes = puente.solicitudesReapertura || [];
            var solCaja = $('mc-solicitudes-lista');
            solCaja.hidden = !solicitudes.length;
            if (solicitudes.length) {
                solCaja.innerHTML = '<p class="h-seccion" style="margin-top:14px">Solicitudes de reapertura enviadas</p><ul class="avisos-mes">' +
                    solicitudes.map(function (s) {
                        return '<li class="n-aviso"><span class="material-icons" aria-hidden="true">history</span><div><strong>Enviada el ' + esc(s.fecha) + '</strong><p>' + esc(s.motivo) + '</p></div><span class="sello sello-preparada">Pendiente contador</span></li>';
                    }).join('') + '</ul>';
            }

            // Historial de los ultimos 4 meses
            var periodosHist = [];
            var cur = p;
            for (var i = 0; i < 4; i++) {
                periodosHist.push(cur);
                cur = app.mesAnteriorDe(cur);
            }
            $('mc-historial-filas').innerHTML = periodosHist.map(function (perItem) {
                var pt = puenteDePeriodo(perItem);
                var cls = pt.cerradoTributario ? 'sello-emitida' : 'sello-guardada';
                var txt = pt.cerradoTributario ? 'Cerrado (' + (pt.fechaCierre || 'F29') + ')' : 'Abierto';
                return '<tr>' +
                    '<td><strong>' + esc(app.nombrePeriodo(perItem)) + '</strong></td>' +
                    '<td>' + esc(REGIMENES[pt.regimen] || pt.regimen) + '</td>' +
                    '<td><span class="sello ' + cls + '">' + esc(txt) + '</span></td>' +
                    '<td class="num">' + pesos(pt.f29Resumen && pt.f29Resumen.totalPagar91) + '</td>' +
                    '<td class="celda-acciones"><button type="button" class="btn-texto" data-mc-ver-mes="' + esc(perItem) + '">Ir al mes</button></td>' +
                    '</tr>';
            }).join('');
        }

        // ---------------- ARCHIVOS Y EVENTOS ----------------
        function procesarArchivoCartola(file) {
            if (!file) return;
            if (estaCerrado()) { app.avisoGlobal('error', 'Este período está cerrado tributariamente por tu contador.'); return; }
            var nombre = file.name || '';
            var p = app.getPeriodo();

            if (/\.xlsx?$/i.test(nombre)) {
                var asegurarXlsx = root.XLSX
                    ? Promise.resolve(root.XLSX)
                    : new Promise(function (res, rej) {
                        var s = document.createElement('script');
                        s.src = '/assets/vendor/xlsx.full.min.js';
                        s.onload = function () { res(root.XLSX); };
                        s.onerror = function () { rej(new Error('xlsx')); };
                        document.head.appendChild(s);
                    });
                asegurarXlsx.then(function (XLSX) {
                    var fr = new FileReader();
                    fr.onload = function () {
                        try {
                            var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
                            var hoja = wb.Sheets[wb.SheetNames[0]];
                            var filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false });
                            aplicarResultadoCartola(parsearCartolaFilas(filas, p));
                        } catch (e) {
                            app.avisoGlobal('error', 'No pudimos leer el archivo Excel de la cartola.');
                        }
                    };
                    fr.readAsArrayBuffer(file);
                }).catch(function () {
                    app.avisoGlobal('error', 'No pudimos cargar el lector de archivos Excel.');
                });
                return;
            }

            var frCsv = new FileReader();
            frCsv.onload = function () {
                aplicarResultadoCartola(parsearCartolaCsv(frCsv.result, p));
            };
            frCsv.readAsText(file, 'utf-8');
        }

        function aplicarResultadoCartola(res) {
            if (!res.ok) {
                app.avisoGlobal('error', res.error);
                return;
            }
            mutarPeriodoActual(function (per) {
                per.movimientos = res.movimientos;
                if (res.ultimoSaldo !== null) per.ultimoSaldoCartola = res.ultimoSaldo;
                per.fechaCartola = app.hoyIso();
            });
            app.avisoGlobal('ok', 'Cartola actualizada: ' + res.movimientos.length + ' movimientos listos para revisar.');
            redibujarVistaActiva();
        }

        function aplicarConciliacion(movId, tipoDestino, destinoId, tituloCustom) {
            if (estaCerrado()) return;
            mutarPeriodoActual(function (per) {
                var mov = (per.movimientos || []).filter(function (m) { return m.id === movId; })[0];
                if (!mov) return;
                var titulo = tituloCustom || '';
                if (tipoDestino === 'cxc') {
                    var c = (per.cobranzas || []).filter(function (x) { return x.id === destinoId; })[0];
                    if (c) { c.pagada = true; c.fechaPago = mov.fecha; titulo = c.razonSocial + ' · Factura ' + c.folio; }
                } else if (tipoDestino === 'cxp') {
                    var p = (per.pagos || []).filter(function (x) { return x.id === destinoId; })[0];
                    if (p) { p.pagada = true; p.fechaPago = mov.fecha; titulo = p.razonSocial + ' · Factura ' + p.folio; delete ui.seleccionPagos[p.id]; }
                } else if (tipoDestino === 'sueldos') {
                    per.obligacionesConciliadas.sueldos = true;
                    titulo = 'Nómina de sueldos líquidos';
                } else if (tipoDestino === 'previred') {
                    per.obligacionesConciliadas.previred = true;
                    titulo = 'Cotizaciones Previred';
                } else if (tipoDestino === 'f29') {
                    per.obligacionesConciliadas.f29 = true;
                    titulo = 'Impuestos F29';
                }
                mov.conciliadoCon = { tipoDestino: tipoDestino, destinoId: destinoId, titulo: titulo || 'Movimiento conciliado' };
            });
            ui.movSeleccionadoId = null;
            redibujarVistaActiva();
        }

        function deshacerConciliacion(movId) {
            if (estaCerrado()) return;
            mutarPeriodoActual(function (per) {
                var mov = (per.movimientos || []).filter(function (m) { return m.id === movId; })[0];
                if (!mov || !mov.conciliadoCon) return;
                var cc = mov.conciliadoCon;
                if (cc.tipoDestino === 'cxc') {
                    var c = (per.cobranzas || []).filter(function (x) { return x.id === cc.destinoId; })[0];
                    if (c) { c.pagada = false; c.fechaPago = ''; }
                } else if (cc.tipoDestino === 'cxp') {
                    var p = (per.pagos || []).filter(function (x) { return x.id === cc.destinoId; })[0];
                    if (p) { p.pagada = false; p.fechaPago = ''; }
                } else if (cc.tipoDestino === 'sueldos') per.obligacionesConciliadas.sueldos = false;
                else if (cc.tipoDestino === 'previred') per.obligacionesConciliadas.previred = false;
                else if (cc.tipoDestino === 'f29') per.obligacionesConciliadas.f29 = false;
                mov.conciliadoCon = null;
            });
            redibujarVistaActiva();
        }

        function abrirModalCobro(docId) {
            var ctx = datosPeriodoActual();
            var doc = (ctx.per.cobranzas || []).filter(function (c) { return c.id === docId; })[0];
            if (!doc) return;
            ui.cobroDocActivo = doc;
            var dlg = $('pm-cobro-dlg');
            $('pm-cobro-titulo').textContent = 'Cobrar Factura ' + doc.folio + ' · ' + doc.razonSocial;
            $('pm-cobro-tel').value = doc.telefono || '';
            $('pm-cobro-banco').value = ctx.emp.cuentaCobro.banco || '';
            $('pm-cobro-tipo').value = ctx.emp.cuentaCobro.tipoCuenta || 'corriente';
            $('pm-cobro-num').value = ctx.emp.cuentaCobro.numeroCuenta || '';
            actualizarTextoModalCobro();
            if (dlg && dlg.showModal) dlg.showModal();
        }

        function actualizarTextoModalCobro() {
            if (!ui.cobroDocActivo) return;
            var est = app.getEstado();
            var cta = {
                banco: $('pm-cobro-banco').value.trim(),
                tipoCuenta: $('pm-cobro-tipo').value,
                numeroCuenta: $('pm-cobro-num').value.trim()
            };
            var msg = mensajeCobranza(ui.cobroDocActivo, est && est.empresa, cta);
            $('pm-cobro-texto').value = msg;
            var tel = $('pm-cobro-tel').value.replace(/[^\d]/g, '');
            $('pm-cobro-wa').href = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(msg);
        }

        function abrirModalBancoProveedor(docId) {
            var ctx = datosPeriodoActual();
            var doc = (ctx.per.pagos || []).filter(function (p) { return p.id === docId; })[0];
            if (!doc) return;
            ui.provDocActivo = doc;
            $('pm-prov-titulo').textContent = 'Cuenta bancaria · ' + doc.razonSocial;
            $('pm-prov-banco').value = doc.banco || '';
            $('pm-prov-tipo').value = doc.tipoCuenta || 'corriente';
            $('pm-prov-num').value = doc.numeroCuenta || '';
            $('pm-prov-correo').value = doc.correo || '';
            var dlg = $('pm-prov-banco-dlg');
            if (dlg && dlg.showModal) dlg.showModal();
        }

        function abrirModalReapertura() {
            $('pm-reap-motivo').value = '';
            $('pm-reap-estado').textContent = '';
            var dlg = $('pm-reapertura-dlg');
            if (dlg && dlg.showModal) dlg.showModal();
        }

        function bajarTexto(nombre, contenido, mime) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff', contenido], { type: mime || 'text/csv;charset=utf-8' }));
            a.download = nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }

        function redibujarVistaActiva() {
            var v = app.getVistaActual();
            if (v === 'flujo-caja') dibujarFlujoCaja();
            else if (v === 'cobranzas') dibujarCobranzas();
            else if (v === 'pagos') dibujarPagos();
            else if (v === 'conciliacion') dibujarConciliacion();
            else if (v === 'mi-contador') dibujarMiContador();
            else actualizarInsigniasYBanner();
        }

        function poblarSelectsBancos() {
            var opts = '<option value="">Selecciona banco…</option>' + BANCOS_CHILE.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
            ['pag-f-banco', 'pm-cobro-banco', 'pm-prov-banco', 'mc-cobro-banco'].forEach(function (id) {
                var el = $(id);
                if (el) el.innerHTML = opts;
            });
        }

        function enlazarEventos() {
            poblarSelectsBancos();

            // Banner global CERRADO_TRIBUTARIO
            var btnBannerReap = $('pm-cierre-solicitar');
            if (btnBannerReap) btnBannerReap.addEventListener('click', function () {
                app.navegar('mi-contador');
                setTimeout(abrirModalReapertura, 60);
            });

            // Flujo de caja: saldo manual + cartola
            $('fc-btn-saldo').addEventListener('click', function () {
                var ctx = datosPeriodoActual();
                $('pm-saldo-input').value = ctx.per.ultimoSaldoCartola !== null ? ctx.per.ultimoSaldoCartola : (ctx.per.saldoInicialManual || '');
                if ($('pm-saldo-dlg').showModal) $('pm-saldo-dlg').showModal();
            });
            $('pm-saldo-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var monto = entero($('pm-saldo-input').value);
                mutarPeriodoActual(function (per) {
                    per.saldoInicialManual = monto;
                    per.ultimoSaldoCartola = monto;
                    per.fechaCartola = app.hoyIso();
                });
                $('pm-saldo-dlg').close();
                dibujarFlujoCaja();
            });
            $('pm-saldo-cerrar').addEventListener('click', function () { $('pm-saldo-dlg').close(); });

            $('fc-btn-subir-cartola').addEventListener('click', function () { $('fc-cartola-file').click(); });
            $('fc-dropzone').addEventListener('click', function () { $('fc-cartola-file').click(); });
            $('fc-dropzone').addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('arrastrando'); });
            $('fc-dropzone').addEventListener('dragleave', function () { this.classList.remove('arrastrando'); });
            $('fc-dropzone').addEventListener('drop', function (e) {
                e.preventDefault();
                this.classList.remove('arrastrando');
                var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) procesarArchivoCartola(f);
            });
            $('fc-cartola-file').addEventListener('change', function () {
                if (this.files && this.files[0]) procesarArchivoCartola(this.files[0]);
                this.value = '';
            });
            $('fc-btn-cartola-demo').addEventListener('click', function () {
                var hoy = app.hoyIso();
                var csvDemo = [
                    'Fecha;Descripción;Cargo;Abono;Saldo',
                    sumarDias(hoy, -2) + ';ABONO CLIENTE FACTURA 1102;;749700;5435500',
                    sumarDias(hoy, -1) + ';TEF PROVEEDOR LACTEOS DEL SUR 9314;464100;;4971400',
                    hoy + ';COMISION MANTENCION CUENTA EMPRESA;8900;;4962500'
                ].join('\n');
                aplicarResultadoCartola(parsearCartolaCsv(csvDemo, app.getPeriodo()));
            });

            // Cobranzas
            $('cob-btn-nueva').addEventListener('click', function () {
                $('cob-form-panel').hidden = !$('cob-form-panel').hidden;
                if (!$('cob-form-panel').hidden) {
                    $('cob-f-fecha').value = app.hoyIso();
                    $('cob-f-vence').value = sumarDias(app.hoyIso(), 30);
                    $('cob-f-razon').focus();
                }
            });
            $('cob-form-cancelar').addEventListener('click', function () { $('cob-form-panel').hidden = true; });
            $('cob-form').addEventListener('submit', function (e) {
                e.preventDefault();
                if (estaCerrado()) return;
                var razon = $('cob-f-razon').value.trim();
                var monto = entero($('cob-f-monto').value);
                if (!razon || monto <= 0) {
                    $('cob-form-err').textContent = 'Ingresa la razón social del cliente y un monto mayor a cero.';
                    $('cob-form-err').hidden = false;
                    return;
                }
                $('cob-form-err').hidden = true;
                var rutRaw = $('cob-f-rut').value.trim();
                mutarPeriodoActual(function (per) {
                    per.cobranzas.unshift({
                        id: 'cxc-man-' + Date.now(),
                        rut: Rut() && rutRaw ? Rut().formatear(rutRaw) : rutRaw,
                        razonSocial: razon,
                        folio: $('cob-f-folio').value.trim() || 'S/N',
                        tipoDte: 33,
                        fecha: $('cob-f-fecha').value || app.hoyIso(),
                        vencimiento: $('cob-f-vence').value || sumarDias(app.hoyIso(), 30),
                        monto: monto,
                        telefono: $('cob-f-tel').value.trim(),
                        pagada: false,
                        fechaPago: '',
                        origen: 'Manual'
                    });
                });
                this.reset();
                $('cob-form-panel').hidden = true;
                dibujarCobranzas();
            });
            $('cob-btn-rcv').addEventListener('click', function () { $('cob-rcv-file').click(); });
            $('cob-rcv-file').addEventListener('change', function () {
                var f = this.files && this.files[0];
                if (!f) return;
                var fr = new FileReader();
                fr.onload = function () {
                    var res = importarRcvACobranzas(fr.result, { periodo: app.getPeriodo() });
                    if (!res.ok) { app.avisoGlobal('error', res.error); return; }
                    mutarPeriodoActual(function (per) {
                        var foliosExistentes = {};
                        per.cobranzas.forEach(function (c) { foliosExistentes[c.rut + '::' + c.folio] = true; });
                        res.items.forEach(function (it) {
                            if (!foliosExistentes[it.rut + '::' + it.folio]) per.cobranzas.push(it);
                        });
                        if (res.resumen && res.resumen.ivaDebito) per.puenteLocal.f29Resumen.ivaDebito = res.resumen.ivaDebito;
                    });
                    app.avisoGlobal('ok', 'Importamos ' + res.items.length + ' documentos desde el RCV de Ventas del SII.');
                    dibujarCobranzas();
                };
                fr.readAsText(f, 'utf-8');
                this.value = '';
            });
            document.addEventListener('click', function (e) {
                var bf = e.target.closest('[data-cob-filtro]');
                if (bf) { ui.filtroCobranzas = bf.getAttribute('data-cob-filtro'); dibujarCobranzas(); return; }
                var ba = e.target.closest('[data-cob-accion]');
                if (ba) {
                    var id = ba.getAttribute('data-id'), acc = ba.getAttribute('data-cob-accion');
                    if (acc === 'cobrar') abrirModalCobro(id);
                    else if (acc === 'pagada' && !estaCerrado()) {
                        mutarPeriodoActual(function (per) {
                            var d = per.cobranzas.filter(function (c) { return c.id === id; })[0];
                            if (d) { d.pagada = true; d.fechaPago = app.hoyIso(); }
                        });
                        dibujarCobranzas();
                    } else if (acc === 'desmarcar' && !estaCerrado()) {
                        mutarPeriodoActual(function (per) {
                            var d = per.cobranzas.filter(function (c) { return c.id === id; })[0];
                            if (d) { d.pagada = false; d.fechaPago = ''; }
                        });
                        dibujarCobranzas();
                    }
                }
            });

            // Modal cobro WhatsApp / copiar
            ['pm-cobro-tel', 'pm-cobro-banco', 'pm-cobro-tipo', 'pm-cobro-num'].forEach(function (id) {
                $(id).addEventListener('input', actualizarTextoModalCobro);
                $(id).addEventListener('change', actualizarTextoModalCobro);
            });
            $('pm-cobro-copiar').addEventListener('click', function () {
                mutarPeriodoActual(function (per, emp) {
                    emp.cuentaCobro = {
                        banco: $('pm-cobro-banco').value.trim(),
                        tipoCuenta: $('pm-cobro-tipo').value,
                        numeroCuenta: $('pm-cobro-num').value.trim(),
                        correo: emp.cuentaCobro.correo || ''
                    };
                    if (ui.cobroDocActivo) ui.cobroDocActivo.telefono = $('pm-cobro-tel').value.trim();
                });
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText($('pm-cobro-texto').value).catch(function () {});
                }
                $('pm-cobro-copiado').textContent = 'Mensaje copiado al portapapeles.';
            });
            $('pm-cobro-cerrar').addEventListener('click', function () { $('pm-cobro-dlg').close(); });

            // Cuentas por pagar
            $('pag-btn-nueva').addEventListener('click', function () {
                $('pag-form-panel').hidden = !$('pag-form-panel').hidden;
                if (!$('pag-form-panel').hidden) {
                    $('pag-f-fecha').value = app.hoyIso();
                    $('pag-f-vence').value = sumarDias(app.hoyIso(), 30);
                    $('pag-f-razon').focus();
                }
            });
            $('pag-form-cancelar').addEventListener('click', function () { $('pag-form-panel').hidden = true; });
            $('pag-form').addEventListener('submit', function (e) {
                e.preventDefault();
                if (estaCerrado()) return;
                var razon = $('pag-f-razon').value.trim();
                var monto = entero($('pag-f-monto').value);
                if (!razon || monto <= 0) {
                    $('pag-form-err').textContent = 'Ingresa la razón social del proveedor y un monto mayor a cero.';
                    $('pag-form-err').hidden = false;
                    return;
                }
                $('pag-form-err').hidden = true;
                var rutRaw = $('pag-f-rut').value.trim();
                var rutFmt = Rut() && rutRaw ? Rut().formatear(rutRaw) : rutRaw;
                var banco = $('pag-f-banco').value;
                var tipoCta = $('pag-f-tipo').value;
                var numCta = $('pag-f-num').value.trim();
                mutarPeriodoActual(function (per, emp) {
                    if (rutFmt && banco && numCta) emp.proveedoresBanco[rutFmt] = { banco: banco, tipoCuenta: tipoCta, numeroCuenta: numCta, correo: '' };
                    per.pagos.unshift({
                        id: 'cxp-man-' + Date.now(),
                        tipoDoc: 'cxp',
                        rut: rutFmt,
                        razonSocial: razon,
                        folio: $('pag-f-folio').value.trim() || 'S/N',
                        tipoDte: 33,
                        fecha: $('pag-f-fecha').value || app.hoyIso(),
                        vencimiento: $('pag-f-vence').value || sumarDias(app.hoyIso(), 30),
                        monto: monto,
                        banco: banco,
                        tipoCuenta: tipoCta,
                        numeroCuenta: numCta,
                        correo: '',
                        pagada: false,
                        fechaPago: '',
                        origen: 'Manual'
                    });
                });
                this.reset();
                $('pag-form-panel').hidden = true;
                dibujarPagos();
            });
            $('pag-btn-rcv').addEventListener('click', function () { $('pag-rcv-file').click(); });
            $('pag-rcv-file').addEventListener('change', function () {
                var f = this.files && this.files[0];
                if (!f) return;
                var fr = new FileReader();
                fr.onload = function () {
                    var ctx = datosPeriodoActual();
                    var res = importarRcvAPagos(fr.result, { periodo: app.getPeriodo(), cuentasProveedores: ctx.emp.proveedoresBanco });
                    if (!res.ok) { app.avisoGlobal('error', res.error); return; }
                    mutarPeriodoActual(function (per) {
                        var foliosExistentes = {};
                        per.pagos.forEach(function (x) { foliosExistentes[x.rut + '::' + x.folio] = true; });
                        res.items.forEach(function (it) {
                            if (!foliosExistentes[it.rut + '::' + it.folio]) per.pagos.push(it);
                        });
                        if (res.resumen && res.resumen.ivaCredito) per.puenteLocal.f29Resumen.ivaCredito = res.resumen.ivaCredito;
                    });
                    app.avisoGlobal('ok', 'Importamos ' + res.items.length + ' facturas de proveedores desde el RCV de Compras.');
                    dibujarPagos();
                };
                fr.readAsText(f, 'utf-8');
                this.value = '';
            });
            $('pag-sel-todas').addEventListener('change', function () {
                var marcar = this.checked;
                var ctx = datosPeriodoActual();
                (ctx.per.pagos || []).forEach(function (x) {
                    if (!x.pagada) {
                        if (marcar) ui.seleccionPagos[x.id] = true;
                        else delete ui.seleccionPagos[x.id];
                    }
                });
                dibujarPagos();
            });
            $('pag-filas').addEventListener('change', function (e) {
                if (e.target && e.target.classList.contains('pag-check')) {
                    var id = e.target.getAttribute('data-id');
                    if (e.target.checked) ui.seleccionPagos[id] = true;
                    else delete ui.seleccionPagos[id];
                    dibujarPagos();
                }
            });
            $('pag-btn-nomina').addEventListener('click', function () {
                var ctx = datosPeriodoActual();
                var pendientes = (ctx.per.pagos || []).filter(function (x) { return !x.pagada; });
                var elegidos = pendientes.filter(function (x) { return !!ui.seleccionPagos[x.id]; });
                if (!elegidos.length) elegidos = pendientes;
                var nom = generarNominaProveedores(elegidos, { periodoNombre: app.nombrePeriodo(app.getPeriodo()) });
                var caja = $('pag-nomina-detalle');
                var listaOmit = nom.omitidos.length
                    ? '<ul>' + nom.omitidos.map(function (o) { return '<li>' + esc(o.nombre + ': ' + o.motivo) + '</li>'; }).join('') + '</ul>'
                    : '';
                if (!nom.incluidos) {
                    caja.hidden = false;
                    caja.innerHTML = '<p><strong>No pudimos armar la nómina:</strong> completa los datos bancarios de los proveedores seleccionados.</p>' + listaOmit;
                    return;
                }
                bajarTexto('nomina-proveedores-' + app.getPeriodo() + '.csv', nom.texto, 'text/csv;charset=utf-8');
                caja.hidden = false;
                caja.innerHTML = '<p><strong>Nómina descargada con ' + nom.incluidos + (nom.incluidos === 1 ? ' factura' : ' facturas') + ' por ' + pesos(nom.total) + '.</strong> Revísala antes de cargarla en el portal empresa de tu banco.</p>' + listaOmit;
            });
            document.addEventListener('click', function (e) {
                var pf = e.target.closest('[data-pag-filtro]');
                if (pf) { ui.filtroPagos = pf.getAttribute('data-pag-filtro'); dibujarPagos(); return; }
                var pa = e.target.closest('[data-pag-accion]');
                if (pa) {
                    var id = pa.getAttribute('data-id'), acc = pa.getAttribute('data-pag-accion');
                    if (acc === 'banco') abrirModalBancoProveedor(id);
                    else if (acc === 'pagada' && !estaCerrado()) {
                        mutarPeriodoActual(function (per) {
                            var d = per.pagos.filter(function (x) { return x.id === id; })[0];
                            if (d) { d.pagada = true; d.fechaPago = app.hoyIso(); delete ui.seleccionPagos[id]; }
                        });
                        dibujarPagos();
                    } else if (acc === 'desmarcar' && !estaCerrado()) {
                        mutarPeriodoActual(function (per) {
                            var d = per.pagos.filter(function (x) { return x.id === id; })[0];
                            if (d) { d.pagada = false; d.fechaPago = ''; }
                        });
                        dibujarPagos();
                    }
                }
            });
            $('pm-prov-form').addEventListener('submit', function (e) {
                e.preventDefault();
                if (!ui.provDocActivo) return;
                var b = $('pm-prov-banco').value, t = $('pm-prov-tipo').value, n = $('pm-prov-num').value.trim(), c = $('pm-prov-correo').value.trim();
                mutarPeriodoActual(function (per, emp) {
                    var doc = per.pagos.filter(function (x) { return x.id === ui.provDocActivo.id; })[0];
                    if (!doc) return;
                    doc.banco = b; doc.tipoCuenta = t; doc.numeroCuenta = n; doc.correo = c;
                    if (doc.rut) emp.proveedoresBanco[doc.rut] = { banco: b, tipoCuenta: t, numeroCuenta: n, correo: c };
                    per.pagos.forEach(function (otro) {
                        if (doc.rut && otro.rut === doc.rut && !otro.numeroCuenta) {
                            otro.banco = b; otro.tipoCuenta = t; otro.numeroCuenta = n; otro.correo = c;
                        }
                    });
                });
                $('pm-prov-banco-dlg').close();
                dibujarPagos();
            });
            $('pm-prov-cerrar').addEventListener('click', function () { $('pm-prov-banco-dlg').close(); });

            // Conciliacion
            $('conc-btn-cartola').addEventListener('click', function () { $('fc-cartola-file').click(); });
            document.addEventListener('click', function (e) {
                var cf = e.target.closest('[data-conc-filtro]');
                if (cf) { ui.filtroConciliacion = cf.getAttribute('data-conc-filtro'); dibujarConciliacion(); return; }
                var rapido = e.target.closest('[data-conc-rapido]');
                if (rapido) {
                    e.stopPropagation();
                    aplicarConciliacion(rapido.getAttribute('data-conc-rapido'), rapido.getAttribute('data-tipo'), rapido.getAttribute('data-destino'));
                    return;
                }
                var aplicar = e.target.closest('[data-conc-aplicar]');
                if (aplicar) {
                    aplicarConciliacion(aplicar.getAttribute('data-conc-aplicar'), aplicar.getAttribute('data-tipo'), aplicar.getAttribute('data-destino'), aplicar.getAttribute('data-titulo'));
                    return;
                }
                var des = e.target.closest('[data-conc-deshacer]');
                if (des) {
                    e.stopPropagation();
                    deshacerConciliacion(des.getAttribute('data-conc-deshacer'));
                    return;
                }
                var card = e.target.closest('[data-conc-sel]');
                if (card) {
                    ui.movSeleccionadoId = card.getAttribute('data-conc-sel');
                    dibujarConciliacion();
                }
            });

            // Mi Contador y Cierre Tributario
            $('mc-estudio-form').addEventListener('submit', function (e) {
                e.preventDefault();
                mutarPeriodoActual(function (per, emp) {
                    emp.estudio = {
                        nombreEstudio: $('mc-est-nombre').value.trim(),
                        contadorNombre: $('mc-est-contador').value.trim(),
                        correo: $('mc-est-correo').value.trim(),
                        telefono: $('mc-est-telefono').value.trim()
                    };
                    emp.regimen = $('mc-regimen').value;
                    emp.cuentaCobro = {
                        banco: $('mc-cobro-banco').value,
                        tipoCuenta: $('mc-cobro-tipo').value,
                        numeroCuenta: $('mc-cobro-numero').value.trim(),
                        correo: $('mc-cobro-correo').value.trim()
                    };
                    per.puenteLocal.regimen = emp.regimen;
                    per.puenteLocal.estudio = emp.estudio;
                });
                $('mc-estudio-estado').textContent = 'Datos de estudio y cuenta de cobro guardados.';
                dibujarMiContador();
            });

            $('mc-cierre-panel').addEventListener('click', function (e) {
                if (e.target.closest('#mc-btn-solicitar-reapertura')) {
                    abrirModalReapertura();
                    return;
                }
                if (e.target.closest('#mc-btn-simular-toggle')) {
                    var p = app.getPeriodo();
                    var actualmenteCerrado = estaCerrado(p);
                    mutarPeriodoActual(function (per) {
                        per.puenteLocal.cerradoTributario = !actualmenteCerrado;
                        per.puenteLocal.fechaCierre = !actualmenteCerrado ? app.hoyIso() : '';
                    });
                    // Si existe el registro en cl-suite-contable en el mismo navegador, tambien lo sincroniza
                    try {
                        var suite = leerSuiteLocalStorage();
                        var est = app.getEstado();
                        var nombreNorm = normalizarTexto(est && est.empresa && est.empresa.razonSocial);
                        Object.keys(suite).forEach(function (k) {
                            var partes = k.split('::');
                            if (partes[1] === p && normalizarTexto(partes[0]) === nombreNorm) {
                                suite[k].cerradoTributario = !actualmenteCerrado;
                                suite[k].fechaCierre = !actualmenteCerrado ? app.hoyIso() : '';
                            }
                        });
                        window.localStorage.setItem(K_SUITE_CONTABLE, JSON.stringify(suite));
                    } catch (err) { /* local */ }
                    dibujarMiContador();
                }
            });

            $('mc-historial-filas').addEventListener('click', function (e) {
                var b = e.target.closest('[data-mc-ver-mes]');
                if (!b) return;
                app.cambiarPeriodo(b.getAttribute('data-mc-ver-mes'));
                dibujarMiContador();
                window.scrollTo(0, 0);
            });

            $('mc-btn-exportar-contador').addEventListener('click', function () {
                var p = app.getPeriodo();
                var est = app.getEstado();
                var ctx = datosPeriodoActual(p);
                var lab = app.resumenLaboralMes(p);
                var paquete = {
                    tipo: 'paquete-colaborativo-pyme-contador',
                    version: '1.0.0',
                    generadoEn: new Date().toISOString(),
                    periodo: p,
                    empresa: est && est.empresa,
                    regimen: ctx.emp.regimen,
                    resumenLaboral: lab,
                    cobranzas: ctx.per.cobranzas,
                    pagos: ctx.per.pagos,
                    movimientosBancarios: ctx.per.movimientos
                };
                bajarTexto('paquete-contador-' + p + '.json', JSON.stringify(paquete, null, 2), 'application/json');
                app.avisoGlobal('ok', 'Descargamos el paquete del mes para tu contador.');
            });

            $('pm-reap-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var motivo = $('pm-reap-motivo').value.trim();
                if (motivo.length < 5) {
                    $('pm-reap-estado').textContent = 'Explica brevemente qué necesitas corregir para que tu contador lo evalúe.';
                    return;
                }
                mutarPeriodoActual(function (per) {
                    per.puenteLocal.solicitudesReapertura = per.puenteLocal.solicitudesReapertura || [];
                    per.puenteLocal.solicitudesReapertura.unshift({
                        fecha: app.hoyIso(),
                        motivo: motivo
                    });
                });
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    var est = app.getEstado();
                    var borrador = 'Solicitud de reapertura período ' + app.nombrePeriodo(app.getPeriodo()) +
                        ' · ' + ((est && est.empresa && est.empresa.razonSocial) || 'Empresa') +
                        ': ' + motivo;
                    navigator.clipboard.writeText(borrador).catch(function () {});
                }
                $('pm-reapertura-dlg').close();
                app.avisoGlobal('ok', 'Solicitud de reapertura registrada y copiada para enviar a tu contador.');
                dibujarMiContador();
            });
            $('pm-reap-cerrar').addEventListener('click', function () { $('pm-reapertura-dlg').close(); });
        }

        enlazarEventos();

        return {
            dibujarFlujoCaja: dibujarFlujoCaja,
            dibujarCobranzas: dibujarCobranzas,
            dibujarPagos: dibujarPagos,
            dibujarConciliacion: dibujarConciliacion,
            dibujarMiContador: dibujarMiContador,
            actualizarInsigniasYBanner: actualizarInsigniasYBanner,
            redibujarVistaActiva: redibujarVistaActiva,
            estaCerrado: estaCerrado,
            limpiarEjemplo: limpiarEjemplo
        };
    }

    var api = {
        BANCOS_CHILE: BANCOS_CHILE,
        TIPOS_CUENTA: TIPOS_CUENTA,
        REGIMENES: REGIMENES,
        parsearCartolaFilas: parsearCartolaFilas,
        parsearCartolaCsv: parsearCartolaCsv,
        estadoVencimiento: estadoVencimiento,
        importarRcvACobranzas: importarRcvACobranzas,
        importarRcvAPagos: importarRcvAPagos,
        mensajeCobranza: mensajeCobranza,
        generarNominaProveedores: generarNominaProveedores,
        sugerirConciliacion: sugerirConciliacion,
        calcularFlujoCaja: calcularFlujoCaja,
        resolverPuenteContable: resolverPuenteContable,
        semillaEjemploFinanzas: semillaEjemploFinanzas,
        montarUI: montarUI,
        version: '1.0.0'
    };

    if (esNode) module.exports = api;
    else root.CLPymeFinanzas = api;
})(typeof window !== 'undefined' ? window : this);
