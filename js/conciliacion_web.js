/*
 * CalculoLaboral · Simulador público de Conciliación Bancaria CSV/Excel y Flujo de Caja Pyme (v1.0.0)
 * Reutiliza CLImportadores, CLContadoresF29, CLPymeFinanzas y CLPymeExcel sin pedir claves bancarias.
 */
(function (root, doc) {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pesos(n) {
        var v = Math.round(Number(n) || 0);
        return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL');
    }

    function entero(v) {
        var s = String(v == null ? '' : v).replace(/[^\d-]/g, '');
        var n = parseInt(s, 10);
        return isFinite(n) && n > 0 ? n : 0;
    }

    function filasACsvTexto(filas) {
        return (filas || []).map(function (f) {
            return (Array.isArray(f) ? f : []).map(function (c) {
                if (c instanceof Date && !isNaN(c.getTime())) return c.toISOString().slice(0, 10);
                var s = String(c == null ? '' : c);
                return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            }).join(';');
        }).join('\n');
    }

    function ejemploCartolaConciliable(periodo) {
        var p = String(periodo || '2026-11');
        var y = p.slice(0, 4);
        var m = p.slice(5, 7);
        return [
            'Fecha;Descripcion;Cargo;Abono;Saldo',
            '06/' + m + '/' + y + ';Transferencia cliente Gastronomia del Sur folio 1041;0;7378000;11378000',
            '10/' + m + '/' + y + ';Abono cliente Cafe Patagonia folio 1042;0;5712000;17090000',
            '11/' + m + '/' + y + ';Pago proveedor Molinera del Centro fac 8492;6188000;0;10902000',
            '13/' + m + '/' + y + ';Pago planilla Previred noviembre;385000;0;10517000',
            '20/' + m + '/' + y + ';Pago F29 SII Tesoreria General;420000;0;10097000',
            '27/' + m + '/' + y + ';Comision mantencion cuenta corriente banco;14900;0;10082100'
        ].join('\n');
    }

    function ejecutarAnalisis(opts) {
        var Imp = root.CLImportadores || (typeof require === 'function' ? require('./contadores_importadores.js') : null);
        var Fin = root.CLPymeFinanzas || (typeof require === 'function' ? require('./pyme_finanzas.js') : null);
        if (!Imp || !Fin) throw new Error('Faltan modulos de conciliacion y finanzas.');

        var periodo = (opts && opts.periodo) || '2026-11';
        var parsedCartola = Imp.parsearCartola((opts && opts.cartolaEntrada) || '', { periodo: periodo });
        if (!parsedCartola.ok) {
            return { ok: false, error: parsedCartola.error || 'No pudimos leer la cartola bancaria.' };
        }

        var cobranzas = [];
        if (opts && opts.rcvVentasTexto && String(opts.rcvVentasTexto).trim()) {
            var rV = Fin.importarRcvACobranzas(opts.rcvVentasTexto, { periodo: periodo, plazoDias: 30 });
            if (rV && rV.ok) cobranzas = rV.items;
        }
        var pagos = [];
        if (opts && opts.rcvComprasTexto && String(opts.rcvComprasTexto).trim()) {
            var rC = Fin.importarRcvAPagos(opts.rcvComprasTexto, { periodo: periodo, plazoDias: 30 });
            if (rC && rC.ok) pagos = rC.items;
        }

        var ob = {
            sueldosLiquidos: entero(opts && opts.sueldosLiquidos),
            previred: entero(opts && opts.previred),
            f29Total: entero(opts && opts.f29Total),
            sueldosConciliados: false,
            previredConciliado: false,
            f29Conciliado: false
        };

        var movs = parsedCartola.movimientos.map(function (m) {
            return Object.assign({}, m);
        });
        var sugerencias = Fin.sugerirConciliacion(movs, { cobranzas: cobranzas, pagos: pagos, obligacionesMes: ob });

        var confirmados = (opts && opts.confirmados) || {};
        var conciliadosCount = 0;
        var sugeridosCount = 0;
        var cobIdsConciliados = {};
        var pagIdsConciliados = {};

        sugerencias.forEach(function (s) {
            var m = s.movimiento;
            var cand = s.mejorMatch || (s.candidatos && s.candidatos[0]) || null;
            var estadoManual = confirmados[m.id];
            if (estadoManual === false) {
                s.estado = 'pendiente';
                return;
            }
            if ((estadoManual === true || s.mejorMatch) && cand) {
                s.estado = 'conciliado';
                s.matchUsado = cand;
                conciliadosCount++;
                m.conciliadoCon = cand;
                if (cand.tipoDestino === 'cxc') cobIdsConciliados[cand.destinoId] = true;
                if (cand.tipoDestino === 'cxp') pagIdsConciliados[cand.destinoId] = true;
                if (cand.tipoDestino === 'sueldos') ob.sueldosConciliados = true;
                if (cand.tipoDestino === 'previred') ob.previredConciliado = true;
                if (cand.tipoDestino === 'f29') ob.f29Conciliado = true;
            } else if (cand) {
                s.estado = 'sugerido';
                s.matchUsado = cand;
                sugeridosCount++;
            } else {
                s.estado = 'sin_match';
                s.matchUsado = null;
            }
        });

        var cobranzasPend = cobranzas.map(function (c) {
            return Object.assign({}, c, { pagada: !!cobIdsConciliados[c.id] });
        });
        var pagosPend = pagos.map(function (p) {
            return Object.assign({}, p, { pagada: !!pagIdsConciliados[p.id] });
        });

        var saldoHoy = entero(opts && opts.saldoBancoHoy);
        if (!saldoHoy && parsedCartola.ultimoSaldo !== null) saldoHoy = Math.max(0, parsedCartola.ultimoSaldo);

        var flujo = Fin.calcularFlujoCaja({
            periodo: periodo,
            saldoBancoHoy: saldoHoy,
            cobranzas: cobranzasPend,
            pagos: pagosPend,
            obligacionesMes: ob
        });

        return {
            ok: true,
            periodo: periodo,
            cartola: parsedCartola,
            sugerencias: sugerencias,
            conciliadosCount: conciliadosCount,
            sugeridosCount: sugeridosCount,
            sinMatchCount: sugerencias.length - conciliadosCount - sugeridosCount,
            flujo: flujo
        };
    }

    if (typeof window === 'undefined' || !doc || !doc.addEventListener) {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                ejecutarAnalisis: ejecutarAnalisis,
                ejemploCartolaConciliable: ejemploCartolaConciliable,
                filasACsvTexto: filasACsvTexto
            };
        }
        return;
    }

    var confirmadosMap = {};
    var ultimoResultado = null;

    function val(id) {
        var el = doc.getElementById(id);
        return el ? el.value : '';
    }

    function leerArchivoTextoOExcel(file, callback) {
        if (!file) return;
        var ext = (file.name || '').toLowerCase();
        if (/\.(xlsx|xls)$/.test(ext) && root.CLPymeExcel) {
            file.arrayBuffer().then(function (buf) {
                return root.CLPymeExcel.asegurarXlsx().then(function (XLSX) {
                    var filas = root.CLPymeExcel.filasDesdeBuffer(buf, XLSX);
                    callback(null, filasACsvTexto(filas));
                });
            }).catch(function (err) { callback(err); });
            return;
        }
        var reader = new FileReader();
        reader.onload = function () { callback(null, String(reader.result || '')); };
        reader.onerror = function () { callback(new Error('No se pudo leer el archivo.')); };
        reader.readAsText(file, 'ISO-8859-1');
    }

    function renderResultados() {
        var errorBox = doc.getElementById('conc-error-box');
        var resWrap = doc.getElementById('conc-resultados-wrap');
        var res;
        try {
            res = ejecutarAnalisis({
                periodo: val('conc-periodo') || '2026-11',
                cartolaEntrada: val('conc-cartola-txt'),
                rcvVentasTexto: val('conc-rcv-ventas-txt'),
                rcvComprasTexto: val('conc-rcv-compras-txt'),
                saldoBancoHoy: val('conc-saldo-hoy'),
                sueldosLiquidos: val('conc-ob-sueldos'),
                previred: val('conc-ob-previred'),
                f29Total: val('conc-ob-f29'),
                confirmados: confirmadosMap
            });
        } catch (err) {
            res = { ok: false, error: err.message };
        }

        if (!res.ok) {
            ultimoResultado = null;
            if (errorBox) { errorBox.textContent = res.error; errorBox.classList.remove('hidden'); }
            if (resWrap) resWrap.classList.add('hidden');
            return;
        }
        ultimoResultado = res;
        if (errorBox) errorBox.classList.add('hidden');
        if (resWrap) resWrap.classList.remove('hidden');

        var totalMovs = res.sugerencias.length;
        var pctMatch = totalMovs > 0 ? Math.round((res.conciliadosCount / totalMovs) * 100) : 0;

        var set = function (id, txt) { var el = doc.getElementById(id); if (el) el.textContent = txt; };
        set('kpi-abonos', pesos(res.cartola.totalAbonos));
        set('kpi-cargos', pesos(res.cartola.totalCargos));
        set('kpi-conciliados', res.conciliadosCount + ' / ' + totalMovs + ' (' + pctMatch + '%)');
        set('kpi-caja-proy', pesos(res.flujo.proyeccionFinMes));
        set('kpi-holgura', res.flujo.diasHolgura !== null ? ('Holgura estimada: ' + res.flujo.diasHolgura + ' días') : 'Sin salidas proyectadas');

        var tbody = doc.getElementById('conc-tabla-body');
        if (tbody) {
            tbody.innerHTML = res.sugerencias.map(function (s) {
                var m = s.movimiento;
                var match = s.matchUsado;
                var badge = s.estado === 'conciliado'
                    ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">Conciliado</span>'
                    : (s.estado === 'sugerido'
                        ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">Sugerido</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Sin cruce</span>');
                var detalle = match ? ('<strong>' + esc(match.titulo) + '</strong><br><span class="text-[11px] text-slate-600">' + esc(match.subtitulo) + '</span>') : '<span class="text-xs text-slate-500">Sin documento RCV o gasto asociado</span>';
                var btn = match
                    ? '<button type="button" data-toggle-mov="' + esc(m.id) + '" class="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold hover:border-[#00382E] cursor-pointer bg-white">' + (s.estado === 'conciliado' ? 'Desmarcar' : 'Confirmar') + '</button>'
                    : '';
                return '<tr>' +
                    '<td class="p-3 whitespace-nowrap font-mono-num text-xs">' + esc(m.fecha) + '</td>' +
                    '<td class="p-3 text-xs text-slate-800">' + esc(m.glosa) + '</td>' +
                    '<td class="p-3 text-right font-mono-num text-xs font-bold ' + (m.tipo === 'abono' ? 'text-emerald-800' : 'text-rose-800') + '">' + (m.tipo === 'abono' ? '+' : '-') + pesos(m.monto) + '</td>' +
                    '<td class="p-3 text-xs text-slate-700">' + detalle + '</td>' +
                    '<td class="p-3">' + badge + '</td>' +
                    '<td class="p-3 text-right">' + btn + '</td>' +
                '</tr>';
            }).join('');

            tbody.querySelectorAll('[data-toggle-mov]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-toggle-mov');
                    var item = res.sugerencias.filter(function (x) { return x.movimiento.id === id; })[0];
                    var estabaConc = item && item.estado === 'conciliado';
                    confirmadosMap[id] = !estabaConc;
                    renderResultados();
                });
            });
        }

        var compEl = doc.getElementById('conc-compromisos-lista');
        if (compEl) {
            if (!res.flujo.compromisos.length) {
                compEl.innerHTML = '<li class="text-xs text-slate-600">Sin compromisos pendientes ingresados para este período.</li>';
            } else {
                compEl.innerHTML = res.flujo.compromisos.map(function (c) {
                    return '<li class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 text-xs">' +
                        '<span><strong class="text-slate-900">' + esc(c.titulo) + '</strong> · <span class="text-slate-600">' + esc(c.fecha) + '</span></span>' +
                        '<strong class="font-mono-num text-slate-900 shrink-0">' + pesos(c.monto) + '</strong>' +
                    '</li>';
                }).join('');
            }
        }
    }

    function descargarExcel() {
        if (!ultimoResultado || !root.CLPymeExcel) return;
        var res = ultimoResultado;
        var filasConc = [
            ['Conciliacion Bancaria y Flujo de Caja Pyme (CalculoLaboral.cl)'],
            ['Periodo: ' + res.periodo, 'Conciliados: ' + res.conciliadosCount + ' de ' + res.sugerencias.length],
            [],
            ['Fecha', 'Glosa Banco', 'Tipo', 'Monto (CLP)', 'Estado', 'Cruce sugerido']
        ];
        res.sugerencias.forEach(function (s) {
            filasConc.push([
                s.movimiento.fecha,
                s.movimiento.glosa,
                s.movimiento.tipo,
                s.movimiento.monto,
                s.estado,
                s.matchUsado ? s.matchUsado.titulo : 'Sin cruce'
            ]);
        });
        var filasFlujo = [
            ['Resumen Flujo de Caja Pyme'],
            [],
            ['Concepto', 'Monto (CLP)'],
            ['Saldo bancario actual / cierre cartola', res.flujo.saldoBancoHoy],
            ['Cobranzas RCV por entrar', res.flujo.porEntrarMes],
            ['Salidas proyectadas (CxP + Sueldos + Previred + F29)', res.flujo.porSalirMes],
            ['Caja proyectada fin de mes', res.flujo.proyeccionFinMes]
        ];
        root.CLPymeExcel.descargarXlsx('Conciliacion_Flujo_' + res.periodo + '.xlsx', [
            { nombre: 'Conciliacion', filas: filasConc, monedas: { 3: true }, estilo: { tituloFilas: [0], encabezadoFila: 3 } },
            { nombre: 'Flujo de Caja', filas: filasFlujo, monedas: { 1: true }, estilo: { tituloFilas: [0], encabezadoFila: 2 } }
        ]);
    }

    doc.addEventListener('DOMContentLoaded', function () {
        var btnEjemplo = doc.getElementById('btn-conc-ejemplo');
        if (btnEjemplo) {
            btnEjemplo.addEventListener('click', function () {
                var F29 = root.CLContadoresF29;
                var periodo = val('conc-periodo') || '2026-11';
                var elCar = doc.getElementById('conc-cartola-txt');
                var elVen = doc.getElementById('conc-rcv-ventas-txt');
                var elCom = doc.getElementById('conc-rcv-compras-txt');
                var elSue = doc.getElementById('conc-ob-sueldos');
                var elPre = doc.getElementById('conc-ob-previred');
                var elF29 = doc.getElementById('conc-ob-f29');
                if (elCar) elCar.value = ejemploCartolaConciliable(periodo);
                if (elVen && F29 && F29.ejemploRcvVentasCsv) elVen.value = F29.ejemploRcvVentasCsv();
                if (elCom && F29 && F29.ejemploRcvComprasCsv) elCom.value = F29.ejemploRcvComprasCsv();
                if (elSue) elSue.value = '1650000';
                if (elPre) elPre.value = '385000';
                if (elF29) elF29.value = '420000';
                confirmadosMap = {};
                renderResultados();
            });
        }

        [
            ['conc-file-cartola', 'conc-cartola-txt'],
            ['conc-file-ventas', 'conc-rcv-ventas-txt'],
            ['conc-file-compras', 'conc-rcv-compras-txt']
        ].forEach(function (pair) {
            var finput = doc.getElementById(pair[0]);
            var tarea = doc.getElementById(pair[1]);
            if (finput && tarea) {
                finput.addEventListener('change', function () {
                    var f = finput.files && finput.files[0];
                    if (!f) return;
                    leerArchivoTextoOExcel(f, function (err, txt) {
                        if (err) { alert(err.message); return; }
                        tarea.value = txt;
                        confirmadosMap = {};
                        renderResultados();
                    });
                });
            }
        });

        var btnCalc = doc.getElementById('btn-conc-calcular');
        if (btnCalc) btnCalc.addEventListener('click', renderResultados);
        var btnXlsx = doc.getElementById('btn-conc-xlsx');
        if (btnXlsx) btnXlsx.addEventListener('click', descargarExcel);

        // Cargar ejemplo inicial para mostrar el simulador vivo al entrar
        if (btnEjemplo) btnEjemplo.click();
    });
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
