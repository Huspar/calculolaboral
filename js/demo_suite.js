/*
 * CalculoLaboral · Controlador UI de la Suite Contable en /demo-contadores (v1.0.0)
 * Conecta los 5 modulos: Remuneraciones, F29 Tributario, Libro Diario/Mayor,
 * Balance de 8 Columnas + RLI ProPyme 14 D3 y Estado de Resultados + Flujo de Caja.
 * Persiste por cliente + periodo en localStorage ('cl-suite-contable') compatible con CLRespaldo.
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var F29 = window.CLContadoresF29;
    var C = window.CLContabilidad;
    var K_STORAGE = 'cl-suite-contable';

    var ui = {
        modulo: 'remuneraciones',
        subLibro: 'diario',
        subBalance: 'balance8',
        filtroMayor: '',
        lineasManualesDraft: [
            { cuenta: '42040', debe: '', haber: '' },
            { cuenta: '11010', debe: '', haber: '' }
        ]
    };

    function $(id) { return document.getElementById(id); }

    function clienteClave() {
        var el = $('liq-cliente');
        var v = el ? el.value.trim() : '';
        return (v || 'cliente-demo').toLowerCase();
    }

    function clienteNombre() {
        var el = $('liq-cliente');
        var v = el ? el.value.trim() : '';
        return v || 'Cliente en demostración';
    }

    function periodoActual() {
        var el = $('periodo');
        return (el && el.value) ? el.value : '2026-10';
    }

    function leerTodoAlmacen() {
        try {
            var raw = window.localStorage.getItem(K_STORAGE);
            var parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function guardarTodoAlmacen(obj) {
        try { window.localStorage.setItem(K_STORAGE, JSON.stringify(obj)); } catch (e) { /* sin espacio */ }
    }

    function estadoDefecto(periodo) {
        return {
            periodo: periodo,
            regimen: '14D3',
            cerradoTributario: false,
            fechaCierre: '',
            ventasCsv: '',
            ventasArchivo: '',
            ventasRows: null,
            comprasCsv: '',
            comprasArchivo: '',
            comprasRows: null,
            remanenteAnterior: 0,
            tasaPpmPersonalizada: '',
            iuscManual: '',
            honorariosBruto: 0,
            tesoreria: {
                saldoInicialBanco: 0,
                pctVentasCobradas: 80,
                pctComprasPagadas: 75,
                activoFijoPagado: true,
                sueldosPagados: true,
                honorariosPagados: true,
                cotizacionesPagadas: false
            },
            rliAjustes: {
                cobrosAnterioresNetos: 0,
                pagosAnterioresNetos: 0,
                otrosAgregados: 0,
                tasaIdpc: 12.5
            },
            manuales: [],
            auditados: {}
        };
    }

    function claveRegistro() {
        return clienteClave() + '::' + periodoActual();
    }

    function leerEstadoActual() {
        var todo = leerTodoAlmacen();
        var k = claveRegistro();
        var base = estadoDefecto(periodoActual());
        var guardado = todo[k];
        if (!guardado || typeof guardado !== 'object') return base;
        return Object.assign({}, base, guardado, {
            tesoreria: Object.assign({}, base.tesoreria, guardado.tesoreria || {}),
            rliAjustes: Object.assign({}, base.rliAjustes, guardado.rliAjustes || {}),
            manuales: Array.isArray(guardado.manuales) ? guardado.manuales : [],
            auditados: (guardado.auditados && typeof guardado.auditados === 'object') ? guardado.auditados : {}
        });
    }

    function guardarEstadoActual(mutador) {
        var todo = leerTodoAlmacen();
        var k = claveRegistro();
        var actual = leerEstadoActual();
        mutador(actual);
        todo[k] = actual;
        guardarTodoAlmacen(todo);
        return actual;
    }

    function resultadosNominaActiva() {
        if (!window.CLDemoLiquidaciones) return [];
        return window.CLDemoLiquidaciones.resultados().filter(function (r) { return r && !r.error && r.detalle; });
    }

    function calcularModelo() {
        var est = leerEstadoActual();
        var periodo = periodoActual();
        var resLiq = resultadosNominaActiva();
        var nomina = C.resumenNominaDesdeResultados(resLiq, window.CLDemoArchivos);

        var ventas = est.ventasRows
            ? F29.parsearRcv(est.ventasRows, 'ventas')
            : F29.parsearRcv(est.ventasCsv || '', 'ventas');
        var compras = est.comprasRows
            ? F29.parsearRcv(est.comprasRows, 'compras')
            : F29.parsearRcv(est.comprasCsv || '', 'compras');

        var iuscAuto = nomina ? nomina.impuesto48 : 0;
        var usaIuscManual = !nomina && est.iuscManual !== '' && est.iuscManual !== null;
        var iusc48 = usaIuscManual ? D.parseNumber(est.iuscManual) : iuscAuto;

        var f29 = F29.calcularF29({
            periodo: periodo,
            regimen: est.regimen,
            ventas: ventas,
            compras: compras,
            remanenteAnterior: est.remanenteAnterior,
            tasaPpm: est.tasaPpmPersonalizada,
            impuestoUnico48: iusc48,
            honorariosBruto: est.honorariosBruto
        });

        var hayMovimientos = (
            ventas.documentos.length > 0 ||
            compras.documentos.length > 0 ||
            (nomina && nomina.totalDebe > 0) ||
            est.honorariosBruto > 0 ||
            est.remanenteAnterior > 0 ||
            est.tesoreria.saldoInicialBanco > 0 ||
            est.manuales.length > 0
        );

        var gen = C.generarAsientos({
            periodo: periodo,
            ventas: ventas,
            compras: compras,
            f29: hayMovimientos ? f29 : null,
            nomina: nomina,
            tesoreria: est.tesoreria,
            manuales: est.manuales,
            auditados: est.auditados
        });

        var mayor = C.calcularMayor(gen.asientos);
        var balance = C.calcularBalance8Columnas(mayor);
        var rli = C.calcularRliProPyme(balance, gen.metricasFlujo, est.rliAjustes);
        var pyf = C.calcularEstadoResultadosYFlujo(balance, gen.metricasFlujo, hayMovimientos ? f29 : null);

        return {
            estado: est,
            periodo: periodo,
            hayMovimientos: hayMovimientos,
            nomina: nomina,
            iuscAuto: iuscAuto,
            ventas: ventas,
            compras: compras,
            f29: f29,
            asientos: gen.asientos,
            metricasFlujo: gen.metricasFlujo,
            mayor: mayor,
            balance: balance,
            rli: rli,
            pnl: pyf.pnl,
            flujo: pyf.flujo
        };
    }

    function moneySigno(n) {
        var v = Math.round(Number(n) || 0);
        if (v < 0) return '-$' + Math.abs(v).toLocaleString('es-CL');
        return '$' + v.toLocaleString('es-CL');
    }

    function chipOrigenHtml(origen) {
        if (origen === 'auditado') {
            return '<span class="asiento-chip chip-auditado"><span class="material-icons" aria-hidden="true">verified</span>Auditado · Contador</span>';
        }
        if (origen === 'ajuste') {
            return '<span class="asiento-chip chip-ajuste"><span class="material-icons" aria-hidden="true">tune</span>Ajuste · Contador</span>';
        }
        return '<span class="asiento-chip chip-automatico"><span class="material-icons" aria-hidden="true">auto_awesome</span>Automático · RCV / Nómina</span>';
    }

    // ------------------------------------------------------------- Render F29
    function pintarF29(m) {
        var est = m.estado;
        var f = m.f29;
        var c = f.codigos;
        var bloqueado = est.cerradoTributario;

        if ($('f29-periodo') && $('f29-periodo').value !== m.periodo) $('f29-periodo').value = m.periodo;
        if ($('suite-regimen') && $('suite-regimen').value !== est.regimen) $('suite-regimen').value = est.regimen;

        var regDef = F29.REGIMENES[est.regimen] || F29.REGIMENES['14D3'];
        var tasaMostrar = est.tasaPpmPersonalizada !== '' ? est.tasaPpmPersonalizada : regDef.tasaPpmDefecto;
        if ($('f29-tasa-ppm') && document.activeElement !== $('f29-tasa-ppm')) $('f29-tasa-ppm').value = tasaMostrar;
        if ($('f29-remanente') && document.activeElement !== $('f29-remanente')) $('f29-remanente').value = est.remanenteAnterior || '';
        if ($('f29-hon-bruto') && document.activeElement !== $('f29-hon-bruto')) $('f29-hon-bruto').value = est.honorariosBruto || '';

        var iuscInput = $('f29-iusc-manual');
        if (iuscInput) {
            if (m.nomina) {
                iuscInput.value = m.iuscAuto;
                iuscInput.readOnly = true;
                $('f29-iusc-ayuda').textContent = 'Tomado automáticamente del lote de liquidaciones calculado.';
            } else {
                iuscInput.readOnly = bloqueado;
                if (document.activeElement !== iuscInput) iuscInput.value = est.iuscManual !== '' ? est.iuscManual : '';
                $('f29-iusc-ayuda').textContent = 'Sin nómina cargada: escribe el monto manual o calcula Liquidaciones.';
            }
        }

        $('rcv-ventas-estado').textContent = m.ventas.documentos.length
            ? (est.ventasArchivo || 'RCV Ventas') + ' · ' + m.ventas.documentos.length + ' registros'
            : 'Sin archivo cargado (.csv o .xlsx)';
        $('rcv-compras-estado').textContent = m.compras.documentos.length
            ? (est.comprasArchivo || 'RCV Compras') + ' · ' + m.compras.documentos.length + ' registros'
            : 'Sin archivo cargado (.csv o .xlsx)';

        var vacio = $('f29-vacio');
        var resPanel = $('f29-resultados');
        var tieneDatosF29 = m.ventas.documentos.length > 0 || m.compras.documentos.length > 0 || c[48] > 0 || c[151] > 0 || c[504] > 0;
        if (!tieneDatosF29) {
            vacio.hidden = false;
            resPanel.hidden = true;
            return;
        }
        vacio.hidden = true;
        resPanel.hidden = false;

        $('f29-k-debito').textContent = D.money(c[538]);
        $('f29-k-credito').textContent = D.money(c[537]);
        $('f29-k-iva-lbl').textContent = c[89] > 0 ? 'IVA determinado (cód. 89)' : 'Remanente mes sig. (cód. 77)';
        $('f29-k-iva').textContent = c[89] > 0 ? D.money(c[89]) : D.money(c[77]);
        $('f29-k-total').textContent = D.money(c[91]);

        var filas = [
            { sec: 'I. Débito fiscal (ventas y servicios)' },
            { glosa: 'Facturas emitidas del giro (' + c[503] + ' doctos. · neto ' + D.money(m.ventas.netoGiro) + ')', codCant: '503', cant: c[503], cod: '502', monto: c[502] },
            { glosa: 'Facturas por ventas fuera del giro / activo fijo', codCant: '716', cant: c[716], cod: '717', monto: c[717], ocultarCero: true },
            { glosa: 'Resumen boletas electrónicas RCV (tipo 39 · ' + f.resumen.cantBoletasElectronicas + ' boletas)', codCant: '-', cant: f.resumen.cantBoletasElectronicas, cod: 'Prop. SII', monto: f.resumen.ivaBoletasElectronicas, ocultarCero: true },
            { glosa: 'Notas de débito emitidas', codCant: '512', cant: c[512], cod: '513', monto: c[513], ocultarCero: true },
            { glosa: 'Menos: Notas de crédito emitidas (restan débito)', codCant: '509', cant: c[509], cod: '510', monto: c[510], resta: true },
            { glosa: 'Total débito fiscal del período', cod: '538', monto: c[538], total: true },

            { sec: 'II. Crédito fiscal y remanente (compras)' },
            { glosa: 'Facturas recibidas del giro con derecho a crédito (' + c[519] + ' doctos.)', codCant: '519', cant: c[519], cod: '520', monto: c[520] },
            { glosa: 'Facturas de supermercados y comercios similares (art. 23 N°4)', codCant: '761', cant: c[761], cod: '762', monto: c[762], ocultarCero: true },
            { glosa: 'Facturas recibidas por compras de activo fijo (' + c[524] + ' doctos. · neto ' + D.money(m.compras.netoActivoFijo) + ')', codCant: '524', cant: c[524], cod: '525', monto: c[525], ocultarCero: true },
            { glosa: 'Notas de débito recibidas', codCant: '531', cant: c[531], cod: '532', monto: c[532], ocultarCero: true },
            { glosa: 'Menos: Notas de crédito recibidas (restan crédito)', codCant: '527', cant: c[527], cod: '528', monto: c[528], resta: true },
            { glosa: 'Remanente de crédito fiscal del mes anterior', cod: '504', monto: c[504] },
            { glosa: 'Total crédito fiscal del período', cod: '537', monto: c[537], total: true },

            { sec: 'III. Determinación de IVA (cód. 538 menos cód. 537)' },
            c[89] > 0
                ? { glosa: 'Impuesto IVA determinado a pagar', cod: '89', monto: c[89], total: true }
                : { glosa: 'Remanente de crédito fiscal para el período siguiente (no suma al pago)', cod: '77', monto: c[77], ok: true },

            { sec: 'IV. Retenciones de Segunda Categoría y PPM obligatorio' },
            { glosa: 'Impuesto Único de 2ª Categoría retenido sobre sueldos (art. 42 N°1)', cod: '48', monto: c[48] },
            { glosa: 'Retención sobre boletas de honorarios de terceros (' + D.num(f.resumen.tasaHonorariosPct, 2) + '% vigente · bruto ' + D.money(f.resumen.honorariosBruto) + ')', cod: '151', monto: c[151] },
            { glosa: 'Base imponible PPM (' + D.money(c[563]) + ') · Tasa cód. 115 (' + D.num(c[115], 3) + '%)', cod: '62', monto: c[62] },

            { sec: 'V. Total determinado' },
            { glosa: 'Total a pagar en Formulario 29 dentro del plazo legal (día 20 del mes siguiente)', cod: '91', monto: c[91], granTotal: true }
        ];

        $('tbody-f29').innerHTML = filas.filter(function (r) {
            return !r.ocultarCero || r.monto > 0 || r.cant > 0;
        }).map(function (r) {
            if (r.sec) {
                return '<tr class="f29-sec"><td colspan="4">' + D.esc(r.sec) + '</td></tr>';
            }
            var cls = r.granTotal ? 'f29-gran-total' : (r.total ? 'f29-subtotal' : (r.ok ? 'f29-remanente' : ''));
            var signo = (r.resta && r.monto > 0) ? '-' : '';
            var cantTxt = r.codCant ? ('<span class="f29-cod-sec">[' + D.esc(r.codCant) + ']</span> ' + D.num(r.cant || 0, 0)) : '-';
            return '<tr class="' + cls + '">' +
                '<td>' + D.esc(r.glosa) + '</td>' +
                '<td class="mono num">' + cantTxt + '</td>' +
                '<td class="mono f29-celda-cod"><span class="f29-cod">' + D.esc(r.cod) + '</span></td>' +
                '<td class="mono num">' + signo + D.money(r.monto) + '</td>' +
                '</tr>';
        }).join('');

        var avisos = f.avisos.concat(m.ventas.avisos).concat(m.compras.avisos);
        var notaHtml = '<b>Borrador referencial:</b> confirma siempre los montos con la propuesta oficial en sii.cl antes de declarar y pagar. Tasa PPM ProPyme General 2026 rebajada transitoriamente por Ley 21.755 y Circular SII N°53/2025 (configurable en código 115).';
        if (avisos.length) {
            notaHtml += '<br>' + avisos.map(function (a) { return '· ' + D.esc(a); }).join('<br>');
        }
        $('f29-notas').innerHTML = notaHtml;

        Array.prototype.forEach.call(document.querySelectorAll('#suite-f29 input:not(#f29-periodo), #suite-f29 select'), function (inp) {
            if (inp.id === 'f29-iusc-manual' && m.nomina) return;
            inp.disabled = bloqueado && inp.type !== 'file';
        });
    }

    // ------------------------------------------------------------- Render Diario y Mayor
    function pintarLibros(m) {
        var est = m.estado;
        var bloqueado = est.cerradoTributario;

        Array.prototype.forEach.call(document.querySelectorAll('[data-sublibro]'), function (btn) {
            var act = btn.getAttribute('data-sublibro') === ui.subLibro;
            btn.classList.toggle('activo', act);
            btn.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        $('sub-diario').hidden = ui.subLibro !== 'diario';
        $('sub-mayor').hidden = ui.subLibro !== 'mayor';
        $('sub-tesoreria').hidden = ui.subLibro !== 'tesoreria';

        // Sincronizar campos de tesoreria
        var t = est.tesoreria;
        if (document.activeElement !== $('tes-banco-ini')) $('tes-banco-ini').value = t.saldoInicialBanco || 0;
        if (document.activeElement !== $('tes-pct-cobro')) $('tes-pct-cobro').value = t.pctVentasCobradas;
        if (document.activeElement !== $('tes-pct-pago')) $('tes-pct-pago').value = t.pctComprasPagadas;
        $('tes-af-pagado').checked = !!t.activoFijoPagado;
        $('tes-sueldos-pagados').checked = !!t.sueldosPagados;
        $('tes-hon-pagados').checked = !!t.honorariosPagados;
        $('tes-cotiz-pagadas').checked = !!t.cotizacionesPagadas;
        Array.prototype.forEach.call(document.querySelectorAll('#sub-tesoreria input'), function (el) { el.disabled = bloqueado; });

        var totalDebe = m.asientos.reduce(function (s, a) { return s + a.debe; }, 0);
        var totalHaber = m.asientos.reduce(function (s, a) { return s + a.haber; }, 0);
        $('lib-k-asientos').textContent = m.asientos.length;
        $('lib-k-debe').textContent = D.money(totalDebe);
        $('lib-k-haber').textContent = D.money(totalHaber);
        $('lib-k-estado').textContent = (totalDebe === totalHaber) ? 'Cuadrado' : 'Descuadrado';
        $('lib-k-estado').className = (totalDebe === totalHaber) ? 'ok-txt' : 'bad';

        if (!m.asientos.length) {
            $('diario-lista').innerHTML = '<div class="demo-vacio"><p class="demo-vacio-t">Aún no hay asientos en este período</p><ol><li>Carga el RCV o el ejemplo en <b>F29 Tributario</b>, o calcula las <b>Liquidaciones</b> del mes.</li><li>También puedes registrar un asiento manual o de apertura abajo.</li></ol></div>';
        } else {
            $('diario-lista').innerHTML = m.asientos.map(function (a, idx) {
                var esManual = /^MAN-/.test(a.id);
                var btnAccion = '';
                if (!bloqueado) {
                    if (esManual) {
                        btnAccion = '<button type="button" class="btn btn-chico" data-borrar-asiento="' + D.esc(a.id) + '">Eliminar ajuste</button>';
                    } else {
                        var marcado = !!est.auditados[a.id];
                        btnAccion = '<button type="button" class="btn btn-chico" data-auditar-asiento="' + D.esc(a.id) + '">' + (marcado ? 'Quitar marca auditado' : 'Marcar auditado') + '</button>';
                    }
                }
                return '<article class="panel asiento-card">' +
                    '<div class="panel-head asiento-head">' +
                    '<div><span class="mono asiento-num">Asiento #' + (idx + 1) + ' · ' + D.esc(a.fecha) + '</span><h3>' + D.esc(a.glosa) + '</h3></div>' +
                    '<div class="asiento-head-der">' + chipOrigenHtml(a.origen) + btnAccion + '</div>' +
                    '</div>' +
                    '<div class="tabla-contable-wrap asiento-tabla-wrap">' +
                    '<table class="tabla-contable">' +
                    '<thead><tr><th>Código</th><th>Cuenta contable</th><th>Naturaleza</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>' +
                    '<tbody>' +
                    a.lineas.map(function (l) {
                        return '<tr>' +
                            '<td class="mono">' + D.esc(l.cuenta) + '</td>' +
                            '<td>' + D.esc(l.nombre) + '</td>' +
                            '<td class="cap">' + D.esc(l.tipo) + '</td>' +
                            '<td class="mono num">' + (l.debe ? D.money(l.debe) : '-') + '</td>' +
                            '<td class="mono num">' + (l.haber ? D.money(l.haber) : '-') + '</td>' +
                            '</tr>';
                    }).join('') +
                    '<tr class="f29-subtotal"><td colspan="3">Totales del asiento</td><td class="mono num">' + D.money(a.debe) + '</td><td class="mono num">' + D.money(a.haber) + '</td></tr>' +
                    '</tbody></table></div></article>';
            }).join('');
        }

        $('form-nuevo-asiento-wrap').hidden = bloqueado;
        pintarDraftManual();

        // Libro Mayor
        var selMayor = $('mayor-cuenta-filtro');
        if (selMayor) {
            var prev = ui.filtroMayor;
            selMayor.innerHTML = '<option value="">Todas las cuentas con movimiento (' + m.mayor.length + ')</option>' +
                m.mayor.map(function (cta) {
                    return '<option value="' + D.esc(cta.codigo) + '"' + (cta.codigo === prev ? ' selected' : '') + '>' + D.esc(cta.codigo + ' · ' + cta.nombre) + '</option>';
                }).join('');
        }

        var cuentasMayor = ui.filtroMayor
            ? m.mayor.filter(function (c) { return c.codigo === ui.filtroMayor; })
            : m.mayor;

        if (!cuentasMayor.length) {
            $('mayor-lista').innerHTML = '<div class="demo-vacio"><p class="demo-vacio-t">Sin movimientos en el Libro Mayor</p><p class="texto-ayuda" style="font-size:13px">Cuando existan asientos en el Libro Diario, cada cuenta mostrará aquí sus cargos, abonos y saldo.</p></div>';
        } else {
            $('mayor-lista').innerHTML = cuentasMayor.map(function (cta) {
                var saldoTxt = cta.saldoDeudor > 0
                    ? ('Saldo deudor: ' + D.money(cta.saldoDeudor))
                    : (cta.saldoAcreedor > 0 ? ('Saldo acreedor: ' + D.money(cta.saldoAcreedor)) : 'Cuenta saldada ($0)');
                return '<section class="panel asiento-card">' +
                    '<div class="panel-head">' +
                    '<h3><span class="mono">' + D.esc(cta.codigo) + '</span> · ' + D.esc(cta.nombre) + '</h3>' +
                    '<span class="texto-ayuda mono">' + saldoTxt + '</span>' +
                    '</div>' +
                    '<div class="tabla-contable-wrap asiento-tabla-wrap">' +
                    '<table class="tabla-contable">' +
                    '<thead><tr><th>Fecha</th><th>Asiento</th><th>Glosa</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>' +
                    '<tbody>' +
                    cta.movimientos.map(function (mv) {
                        return '<tr>' +
                            '<td class="mono">' + D.esc(mv.fecha) + '</td>' +
                            '<td class="mono">' + D.esc(mv.asientoId) + '</td>' +
                            '<td>' + D.esc(mv.glosa) + '</td>' +
                            '<td class="mono num">' + (mv.debe ? D.money(mv.debe) : '-') + '</td>' +
                            '<td class="mono num">' + (mv.haber ? D.money(mv.haber) : '-') + '</td>' +
                            '<td class="mono num">' + moneySigno(mv.saldoAcumulado) + '</td>' +
                            '</tr>';
                    }).join('') +
                    '<tr class="f29-subtotal"><td colspan="3">Sumas de la cuenta</td><td class="mono num">' + D.money(cta.debito) + '</td><td class="mono num">' + D.money(cta.credito) + '</td><td class="mono num">' + D.esc(saldoTxt) + '</td></tr>' +
                    '</tbody></table></div></section>';
            }).join('');
        }
    }

    function opcionesPlanCuentas(sel) {
        return C.PLAN_CUENTAS.map(function (c) {
            return '<option value="' + c.codigo + '"' + (c.codigo === sel ? ' selected' : '') + '>' + c.codigo + ' · ' + D.esc(c.nombre) + '</option>';
        }).join('');
    }

    function pintarDraftManual() {
        var cont = $('manual-lineas');
        if (!cont) return;
        if (!$('manual-fecha').value) $('manual-fecha').value = periodoActual() + '-28';
        cont.innerHTML = ui.lineasManualesDraft.map(function (l, i) {
            return '<div class="manual-fila" data-idx="' + i + '">' +
                '<select data-m-campo="cuenta" aria-label="Cuenta contable">' + opcionesPlanCuentas(l.cuenta) + '</select>' +
                '<input type="number" min="0" step="1" placeholder="Debe ($)" data-m-campo="debe" value="' + (l.debe !== '' ? l.debe : '') + '">' +
                '<input type="number" min="0" step="1" placeholder="Haber ($)" data-m-campo="haber" value="' + (l.haber !== '' ? l.haber : '') + '">' +
                (ui.lineasManualesDraft.length > 2 ? '<button type="button" class="btn btn-chico" data-m-quitar="' + i + '" aria-label="Quitar línea">Quitar</button>' : '') +
                '</div>';
        }).join('');
        actualizarCuadreManual();
    }

    function actualizarCuadreManual() {
        var debe = 0, haber = 0;
        ui.lineasManualesDraft.forEach(function (l) {
            debe += Math.max(0, Math.round(Number(l.debe) || 0));
            haber += Math.max(0, Math.round(Number(l.haber) || 0));
        });
        var el = $('manual-cuadre');
        if (!el) return;
        if (!debe && !haber) {
            el.textContent = 'Ingresa montos al Debe y al Haber para cuadrar el asiento.';
            el.className = 'texto-ayuda';
        } else if (debe === haber) {
            el.textContent = 'Asiento cuadrado: Debe ' + D.money(debe) + ' = Haber ' + D.money(haber);
            el.className = 'texto-ayuda ok-txt';
        } else {
            el.textContent = 'Diferencia por cuadrar: ' + D.money(Math.abs(debe - haber)) + ' (Debe ' + D.money(debe) + ' vs Haber ' + D.money(haber) + ')';
            el.className = 'texto-ayuda bad';
        }
    }

    // ------------------------------------------------------------- Render Balance 8 Columnas y RLI
    function pintarBalance(m) {
        var b = m.balance;
        var rli = m.rli;
        var est = m.estado;

        Array.prototype.forEach.call(document.querySelectorAll('[data-subbal]'), function (btn) {
            var act = btn.getAttribute('data-subbal') === ui.subBalance;
            btn.classList.toggle('activo', act);
            btn.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        $('sub-balance8').hidden = ui.subBalance !== 'balance8';
        $('sub-rli').hidden = ui.subBalance !== 'rli';

        $('bal-k-activo').textContent = D.money(b.totales.activo);
        $('bal-k-pasivo').textContent = D.money(b.totales.pasivo);
        $('bal-k-res-lbl').textContent = b.resultado >= 0 ? 'Utilidad contable' : 'Pérdida contable';
        $('bal-k-resultado').textContent = moneySigno(b.resultado);
        $('bal-k-rli').textContent = moneySigno(rli.baseImponible);

        if (!b.filas.length) {
            $('bal-vacio').hidden = false;
            $('bal-tabla-panel').hidden = true;
        } else {
            $('bal-vacio').hidden = true;
            $('bal-tabla-panel').hidden = false;

            var t = b.totales;
            var fr = b.filaResultado;
            var si = b.sumasIguales;
            var etRes = b.resultado >= 0 ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio';

            $('tbody-balance8').innerHTML = b.filas.map(function (f) {
                return '<tr>' +
                    '<td class="mono">' + D.esc(f.codigo) + '</td>' +
                    '<td>' + D.esc(f.nombre) + '</td>' +
                    '<td class="mono num">' + D.money(f.debito) + '</td>' +
                    '<td class="mono num">' + D.money(f.credito) + '</td>' +
                    '<td class="mono num">' + (f.deudor ? D.money(f.deudor) : '-') + '</td>' +
                    '<td class="mono num">' + (f.acreedor ? D.money(f.acreedor) : '-') + '</td>' +
                    '<td class="mono num">' + (f.activo ? D.money(f.activo) : '-') + '</td>' +
                    '<td class="mono num">' + (f.pasivo ? D.money(f.pasivo) : '-') + '</td>' +
                    '<td class="mono num">' + (f.perdida ? D.money(f.perdida) : '-') + '</td>' +
                    '<td class="mono num">' + (f.ganancia ? D.money(f.ganancia) : '-') + '</td>' +
                    '</tr>';
            }).join('') +
                '<tr class="f29-subtotal">' +
                '<td colspan="2">Sumas parciales</td>' +
                '<td class="mono num">' + D.money(t.debito) + '</td>' +
                '<td class="mono num">' + D.money(t.credito) + '</td>' +
                '<td class="mono num">' + D.money(t.deudor) + '</td>' +
                '<td class="mono num">' + D.money(t.acreedor) + '</td>' +
                '<td class="mono num">' + D.money(t.activo) + '</td>' +
                '<td class="mono num">' + D.money(t.pasivo) + '</td>' +
                '<td class="mono num">' + D.money(t.perdida) + '</td>' +
                '<td class="mono num">' + D.money(t.ganancia) + '</td>' +
                '</tr>' +
                '<tr class="f29-remanente">' +
                '<td colspan="2">' + etRes + '</td>' +
                '<td class="mono num">-</td><td class="mono num">-</td><td class="mono num">-</td><td class="mono num">-</td>' +
                '<td class="mono num">' + (fr.activo ? D.money(fr.activo) : '-') + '</td>' +
                '<td class="mono num">' + (fr.pasivo ? D.money(fr.pasivo) : '-') + '</td>' +
                '<td class="mono num">' + (fr.perdida ? D.money(fr.perdida) : '-') + '</td>' +
                '<td class="mono num">' + (fr.ganancia ? D.money(fr.ganancia) : '-') + '</td>' +
                '</tr>' +
                '<tr class="f29-gran-total">' +
                '<td colspan="2">Sumas iguales</td>' +
                '<td class="mono num">' + D.money(si.debito) + '</td>' +
                '<td class="mono num">' + D.money(si.credito) + '</td>' +
                '<td class="mono num">' + D.money(si.deudor) + '</td>' +
                '<td class="mono num">' + D.money(si.acreedor) + '</td>' +
                '<td class="mono num">' + D.money(si.activo) + '</td>' +
                '<td class="mono num">' + D.money(si.pasivo) + '</td>' +
                '<td class="mono num">' + D.money(si.perdida) + '</td>' +
                '<td class="mono num">' + D.money(si.ganancia) + '</td>' +
                '</tr>';
        }

        // Inputs RLI
        var aj = est.rliAjustes;
        if (document.activeElement !== $('rli-cobros-ant')) $('rli-cobros-ant').value = aj.cobrosAnterioresNetos || 0;
        if (document.activeElement !== $('rli-pagos-ant')) $('rli-pagos-ant').value = aj.pagosAnterioresNetos || 0;
        if (document.activeElement !== $('rli-agregados')) $('rli-agregados').value = aj.otrosAgregados || 0;
        if (document.activeElement !== $('rli-tasa-idpc')) $('rli-tasa-idpc').value = aj.tasaIdpc;
        Array.prototype.forEach.call(document.querySelectorAll('#sub-rli input'), function (el) { el.disabled = est.cerradoTributario; });

        $('tbody-rli').innerHTML = [
            { sec: 'I. Ingresos brutos percibidos del giro (valores netos sin IVA)' },
            { glosa: '(+) Ingresos del giro devengados en el período', monto: rli.ingresosDevengadosNetos },
            { glosa: '(-) Menos: Ventas devengadas pendientes de cobro al cierre (CxC netas)', monto: -rli.ventasNoCobradasNetas },
            { glosa: '(+) Más: Cobros percibidos de ventas de períodos anteriores', monto: rli.cobrosAnterioresNetos },
            { glosa: '(=) Total ingresos percibidos computables', monto: rli.ingresosPercibidos, subtotal: true },

            { sec: 'II. Egresos efectivamente pagados y depreciación instantánea (Art. 14 D N°3)' },
            { glosa: '(-) Compras, existencias y gastos del giro efectivamente pagados (sin ajuste de inventario final)', monto: -rli.comprasGastosPagados },
            { glosa: '(-) Remuneraciones, cotizaciones y honorarios efectivamente pagados (excluye pasivos devengados no pagados por ' + D.money(rli.pasivosLaboralesPendientes) + ')', monto: -rli.remuneracionesHonorariosPagados },
            { glosa: '(-) Depreciación instantánea 100% de activo fijo pagado en el ejercicio', monto: -rli.activoFijoPagadoNeto },
            { glosa: '(+) Agregados por multas fiscales o gastos rechazados no deducibles (art. 21 y 31 LIR)', monto: rli.multasGastosRechazados },

            { sec: 'III. Base imponible pre-cierre F22' },
            { glosa: rli.baseImponible >= 0 ? '(=) Renta Líquida Imponible ProPyme determinada' : '(=) Pérdida tributaria del período', monto: rli.baseImponible, granTotal: true },
            { glosa: 'Impuesto de 1ª Categoría simulado (' + D.num(rli.tasaIdpcSimulada, 2) + '%)', monto: rli.idpcSimulado },
            { glosa: 'Menos: PPM acumulados del período (cuenta 11090)', monto: -rli.ppmAcumulado },
            { glosa: rli.diferenciaF22Simulada >= 0 ? 'Diferencia anual estimada por pagar en F22' : 'Saldo estimado a favor por devolución PPM', monto: rli.diferenciaF22Simulada, subtotal: true }
        ].map(function (r) {
            if (r.sec) return '<tr class="f29-sec"><td colspan="2">' + D.esc(r.sec) + '</td></tr>';
            var cls = r.granTotal ? 'f29-gran-total' : (r.subtotal ? 'f29-subtotal' : '');
            return '<tr class="' + cls + '"><td>' + D.esc(r.glosa) + '</td><td class="mono num">' + moneySigno(r.monto) + '</td></tr>';
        }).join('');
    }

    // ------------------------------------------------------------- Render P&L y Flujo
    function pintarPnl(m) {
        var p = m.pnl;
        var fl = m.flujo;

        $('pnl-k-ingresos').textContent = D.money(p.ingresosGiro);
        $('pnl-k-margen').textContent = D.money(p.margenBruto) + ' (' + D.num(p.margenBrutoPct, 1) + '%)';
        $('pnl-k-ebit').textContent = moneySigno(p.resultadoOperacional);
        $('pnl-k-caja').textContent = moneySigno(fl.cajaProyectadaPostImpuestos);

        $('tbody-pnl').innerHTML = [
            { glosa: 'Ingresos de explotación (ventas afectas y exentas netas)', monto: p.ingresosGiro, subtotal: true },
            { glosa: '(-) Costo de ventas e insumos directos del giro', monto: -p.costoVentas },
            { glosa: '(=) Margen bruto de explotación (' + D.num(p.margenBrutoPct, 1) + '%)', monto: p.margenBruto, subtotal: true },
            { glosa: '(-) Costo laboral (sueldos, no imponibles y aporte empleador)', monto: -p.gastoLaboral },
            { glosa: '(-) Honorarios profesionales de terceros', monto: -p.gastoHonorarios },
            { glosa: '(-) Gastos generales, administración e IVA no recuperable', monto: -p.gastoAdmin },
            { glosa: '(-) Depreciación contable del período', monto: -p.depreciacion },
            { glosa: '(=) Resultado operacional (' + D.num(p.margenOperacionalPct, 1) + '%)', monto: p.resultadoOperacional, subtotal: true },
            { glosa: '(+) Otros ingresos fuera del giro', monto: p.otrosIngresos },
            { glosa: '(-) Multas y gastos no deducibles', monto: -p.otrosGastosNoDeducibles },
            { glosa: '(=) Resultado contable antes de impuestos', monto: p.resultadoAntesImpuesto, granTotal: true }
        ].map(function (r) {
            var cls = r.granTotal ? 'f29-gran-total' : (r.subtotal ? 'f29-subtotal' : '');
            return '<tr class="' + cls + '"><td>' + D.esc(r.glosa) + '</td><td class="mono num">' + moneySigno(r.monto) + '</td></tr>';
        }).join('');

        $('tbody-flujo').innerHTML = [
            { glosa: 'Saldo inicial disponible en banco', monto: fl.saldoInicialBanco, subtotal: true },
            { glosa: '(+) Entradas por cobranza a clientes (con IVA)', monto: fl.entradasCobrosClientes },
            { glosa: '(-) Pagos a proveedores y activo fijo (con IVA)', monto: -fl.salidasProveedores },
            { glosa: '(-) Pago de remuneraciones líquidas', monto: -fl.salidasSueldos },
            { glosa: '(-) Pago de cotizaciones en el mismo mes', monto: -fl.salidasCotizaciones },
            { glosa: '(-) Pago de boletas de honorarios líquidas', monto: -fl.salidasHonorarios },
            { glosa: '(=) Saldo disponible en banco al cierre del mes', monto: fl.saldoDisponibleBanco, subtotal: true },
            { glosa: '(-) Compromiso previsional Previred (vence día 13)', monto: -fl.compromisoPreviredDia13 },
            { glosa: '(-) Compromiso tributario F29 cód. 91 (vence día 20)', monto: -fl.compromisoF29Dia20 },
            { glosa: '(=) Caja libre proyectada después de Previred y F29', monto: fl.cajaProyectadaPostImpuestos, granTotal: true }
        ].map(function (r) {
            var cls = r.granTotal ? 'f29-gran-total' : (r.subtotal ? 'f29-subtotal' : '');
            return '<tr class="' + cls + '"><td>' + D.esc(r.glosa) + '</td><td class="mono num">' + moneySigno(r.monto) + '</td></tr>';
        }).join('');
    }

    // ------------------------------------------------------------- Cierre Tributario y Shell
    function pintarEstadoCierre(m) {
        var cerrado = m.estado.cerradoTributario;
        var badgeTop = $('suite-estado-badge');
        if (badgeTop) {
            badgeTop.className = 'sello ' + (cerrado ? 'sello-preparada' : 'sello-emitida');
            badgeTop.innerHTML = '<span class="material-icons" aria-hidden="true">' + (cerrado ? 'lock' : 'lock_open') + '</span>' +
                (cerrado ? 'Cerrado tributario' : 'Período abierto');
        }
        var chipSuite = $('suite-estado-chip');
        if (chipSuite) {
            chipSuite.className = 'app-nav-chip ' + (cerrado ? 'cerrado' : 'abierto');
            chipSuite.textContent = cerrado ? 'Cerrado' : 'Abierto';
        }
        var banner = $('suite-banner-bloqueo');
        if (banner) {
            banner.hidden = !cerrado;
            if (cerrado) {
                $('suite-banner-texto').textContent = 'El período ' + m.periodo + ' de ' + clienteNombre() + ' fue marcado como CERRADO_TRIBUTARIO (F29 cód. 91: ' + D.money(m.f29.codigos[91]) + '). Los parámetros tributarios y asientos quedan protegidos contra cambios accidentales.';
            }
        }
        var btnCierre = $('btn-cierre-tributario');
        if (btnCierre) {
            btnCierre.innerHTML = '<span class="material-icons" aria-hidden="true">' + (cerrado ? 'lock_open' : 'lock') + '</span>' +
                (cerrado ? 'Reabrir período' : 'Cerrar período tributario');
        }
        var resumenRiel = $('riel-resumen-f29');
        if (resumenRiel) {
            resumenRiel.textContent = 'F29 cód. 91: ' + D.money(m.f29.codigos[91]) + ' · ' + (cerrado ? 'Cerrado' : 'En preparación');
        }
    }

    function cambiarModulo(mod) {
        ui.modulo = mod;
        var mapPanes = {
            remuneraciones: $('suite-remuneraciones'),
            f29: $('suite-f29'),
            libros: $('suite-libros'),
            balance: $('suite-balance'),
            pnl: $('suite-pnl')
        };
        Object.keys(mapPanes).forEach(function (k) {
            if (mapPanes[k]) mapPanes[k].hidden = (k !== mod);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.suite-mod-btn'), function (b) {
            var act = b.getAttribute('data-modulo') === mod;
            b.classList.toggle('activo', act);
            b.setAttribute('aria-current', act ? 'page' : 'false');
        });
        refrescarTodo();
    }

    function refrescarTodo() {
        var m = calcularModelo();
        pintarEstadoCierre(m);
        pintarF29(m);
        pintarLibros(m);
        pintarBalance(m);
        pintarPnl(m);
    }

    // ------------------------------------------------------------- Exportaciones e Impresion
    function imprimirHtmlModulo(titulo, subtitulo, tablaHtml, notaExtra) {
        var pag = '<div class="print-page">' +
            D.encabezado(titulo, D.esc(clienteNombre()) + ' · Período ' + D.esc(periodoActual()) + (subtitulo ? ' · ' + D.esc(subtitulo) : '')) +
            tablaHtml +
            (notaExtra ? '<div class="print-note">' + D.esc(notaExtra) + '</div>' : '') +
            D.NOTA +
            '</div>';
        D.imprimir([pag]);
    }

    function subirArchivoRcv(file, modo) {
        var esCsv = /\.csv$/i.test(file.name);
        if (esCsv) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var txt = String(e.target.result || '');
                var parsed = F29.parsearRcv(txt, modo);
                if (!parsed.documentos.length) {
                    D.avisar('No encontramos documentos RCV reconocibles en ' + file.name + '. Verifica que sea el CSV del SII.');
                    return;
                }
                guardarEstadoActual(function (est) {
                    if (modo === 'ventas') { est.ventasCsv = txt; est.ventasRows = null; est.ventasArchivo = file.name; }
                    else { est.comprasCsv = txt; est.comprasRows = null; est.comprasArchivo = file.name; }
                });
                refrescarTodo();
                D.avisar('RCV de ' + modo + ' cargado: ' + parsed.documentos.length + ' registros.');
            };
            reader.onerror = function () { D.avisar('No pudimos leer el archivo CSV.'); };
            reader.readAsText(file, 'UTF-8');
        } else {
            D.leerArchivo(file).then(function (r) {
                var parsed = F29.parsearRcv(r.rows, modo);
                if (!parsed.documentos.length) {
                    D.avisar('No encontramos columnas RCV reconocibles en la planilla.');
                    return;
                }
                guardarEstadoActual(function (est) {
                    if (modo === 'ventas') { est.ventasRows = r.rows; est.ventasCsv = ''; est.ventasArchivo = r.nombre; }
                    else { est.comprasRows = r.rows; est.comprasCsv = ''; est.comprasArchivo = r.nombre; }
                });
                refrescarTodo();
                D.avisar('RCV de ' + modo + ' cargado: ' + parsed.documentos.length + ' registros.');
            }).catch(function (err) {
                D.avisar('No pudimos leer el archivo: ' + err.message);
            });
        }
    }

    function conectarDropRcv(dropId, fileId, modo) {
        var drop = $(dropId), file = $(fileId);
        if (!drop || !file) return;
        drop.addEventListener('click', function () {
            if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente. Reábrelo para cargar archivos.'); return; }
            file.click();
        });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
        drop.addEventListener('drop', function (e) {
            e.preventDefault();
            drop.classList.remove('over');
            if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
            if (e.dataTransfer.files.length) subirArchivoRcv(e.dataTransfer.files[0], modo);
        });
        file.addEventListener('change', function () {
            if (file.files.length) subirArchivoRcv(file.files[0], modo);
            file.value = '';
        });
    }

    // ------------------------------------------------------------- Boot
    document.addEventListener('DOMContentLoaded', function () {
        if (!$('suite-modulos')) return;

        // Navegacion de 5 modulos
        Array.prototype.forEach.call(document.querySelectorAll('.suite-mod-btn'), function (btn) {
            btn.addEventListener('click', function () {
                cambiarModulo(btn.getAttribute('data-modulo'));
            });
        });

        // Sincronizar periodo entre F29 y Liquidaciones
        var perLiq = $('periodo');
        var perF29 = $('f29-periodo');
        if (perF29 && perLiq) {
            perF29.value = perLiq.value;
            perF29.addEventListener('change', function () {
                perLiq.value = perF29.value;
                perLiq.dispatchEvent(new Event('change'));
                refrescarTodo();
            });
            perLiq.addEventListener('change', function () {
                perF29.value = perLiq.value;
                refrescarTodo();
            });
        }

        // Regimen tributario en riel
        var selReg = $('suite-regimen');
        if (selReg) {
            selReg.addEventListener('change', function () {
                guardarEstadoActual(function (est) {
                    est.regimen = selReg.value;
                    est.tasaPpmPersonalizada = ''; // adopta tasa por defecto del nuevo regimen
                });
                refrescarTodo();
            });
        }

        // Cierre tributario (protocolo CERRADO_TRIBUTARIO)
        function alternarCierreTributario() {
            var actual = leerEstadoActual();
            var nuevo = !actual.cerradoTributario;
            guardarEstadoActual(function (est) {
                est.cerradoTributario = nuevo;
                est.fechaCierre = nuevo ? new Date().toISOString() : '';
            });
            refrescarTodo();
            D.avisar(nuevo ? 'Período marcado como CERRADO_TRIBUTARIO.' : 'Período reabierto para rectificación o ajustes.');
        }
        if ($('btn-cierre-tributario')) $('btn-cierre-tributario').addEventListener('click', alternarCierreTributario);
        if ($('btn-reabrir-banner')) $('btn-reabrir-banner').addEventListener('click', alternarCierreTributario);

        // Dropzones RCV
        conectarDropRcv('drop-rcv-ventas', 'file-rcv-ventas', 'ventas');
        conectarDropRcv('drop-rcv-compras', 'file-rcv-compras', 'compras');

        // Cargar ejemplo completo RCV + Honorarios + Banco inicial
        if ($('btn-rcv-ejemplo')) {
            $('btn-rcv-ejemplo').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('Reabre el período antes de reemplazar los datos.'); return; }
                var cli = $('liq-cliente');
                if (cli && !cli.value.trim()) {
                    cli.value = 'Panadería San Isidro SpA';
                    try { localStorage.setItem('cl-cliente-liq', cli.value); } catch (e) { }
                }
                guardarEstadoActual(function (est) {
                    est.ventasCsv = F29.ejemploRcvVentasCsv();
                    est.ventasRows = null;
                    est.ventasArchivo = 'RCV_Ventas_SII_ejemplo.csv';
                    est.comprasCsv = F29.ejemploRcvComprasCsv();
                    est.comprasRows = null;
                    est.comprasArchivo = 'RCV_Compras_SII_ejemplo.csv';
                    est.remanenteAnterior = 120000;
                    est.honorariosBruto = 800000;
                    est.tesoreria.saldoInicialBanco = 6500000;
                });
                refrescarTodo();
                D.avisar('Ejemplo RCV SII (Ventas, Compras y Honorarios) cargado.');
            });
        }

        if ($('btn-plantilla-rcv-ventas')) {
            $('btn-plantilla-rcv-ventas').addEventListener('click', function () {
                D.descargar(new Blob(['\uFEFF' + F29.ejemploRcvVentasCsv()], { type: 'text/csv;charset=utf-8' }), 'plantilla-sii-rcv-ventas.csv');
            });
        }
        if ($('btn-plantilla-rcv-compras')) {
            $('btn-plantilla-rcv-compras').addEventListener('click', function () {
                D.descargar(new Blob(['\uFEFF' + F29.ejemploRcvComprasCsv()], { type: 'text/csv;charset=utf-8' }), 'plantilla-sii-rcv-compras.csv');
            });
        }
        if ($('btn-limpiar-f29')) {
            $('btn-limpiar-f29').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
                guardarEstadoActual(function (est) {
                    est.ventasCsv = ''; est.ventasRows = null; est.ventasArchivo = '';
                    est.comprasCsv = ''; est.comprasRows = null; est.comprasArchivo = '';
                    est.remanenteAnterior = 0; est.honorariosBruto = 0; est.iuscManual = '';
                });
                refrescarTodo();
                D.avisar('Datos RCV y F29 limpiados para este período.');
            });
        }

        // Inputs F29
        ['f29-remanente', 'f29-tasa-ppm', 'f29-iusc-manual', 'f29-hon-bruto'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', function () {
                guardarEstadoActual(function (est) {
                    if (id === 'f29-remanente') est.remanenteAnterior = Math.max(0, Math.round(D.parseNumber(el.value)));
                    if (id === 'f29-tasa-ppm') est.tasaPpmPersonalizada = el.value;
                    if (id === 'f29-iusc-manual') est.iuscManual = el.value;
                    if (id === 'f29-hon-bruto') est.honorariosBruto = Math.max(0, Math.round(D.parseNumber(el.value)));
                });
                refrescarTodo();
            });
        });

        // Botones F29
        if ($('btn-f29-copiar')) {
            $('btn-f29-copiar').addEventListener('click', function () {
                var c = calcularModelo().f29.codigos;
                var lineas = [
                    'Resumen F29 · ' + clienteNombre() + ' · ' + periodoActual(),
                    'Cód. 503/502 Facturas giro: ' + c[503] + ' / ' + D.money(c[502]),
                    'Cód. 509/510 NC emitidas: ' + c[509] + ' / -' + D.money(c[510]),
                    'Cód. 538 Total Débitos: ' + D.money(c[538]),
                    'Cód. 519/520 Compras giro: ' + c[519] + ' / ' + D.money(c[520]),
                    'Cód. 761/762 Supermercados: ' + c[761] + ' / ' + D.money(c[762]),
                    'Cód. 524/525 Activo fijo: ' + c[524] + ' / ' + D.money(c[525]),
                    'Cód. 527/528 NC recibidas: ' + c[527] + ' / -' + D.money(c[528]),
                    'Cód. 504 Remanente anterior: ' + D.money(c[504]),
                    'Cód. 537 Total Créditos: ' + D.money(c[537]),
                    c[89] > 0 ? ('Cód. 89 IVA determinado: ' + D.money(c[89])) : ('Cód. 77 Remanente mes sig.: ' + D.money(c[77])),
                    'Cód. 48 Impuesto Único: ' + D.money(c[48]),
                    'Cód. 151 Retención Honorarios: ' + D.money(c[151]),
                    'Cód. 563/115/62 PPM (' + c[115] + '%): ' + D.money(c[62]),
                    'Cód. 91 Total a pagar: ' + D.money(c[91])
                ].join('\n');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(lineas).then(function () { D.avisar('Hoja guía F29 copiada al portapapeles.'); });
                } else {
                    D.avisar('Total cód. 91: ' + D.money(c[91]));
                }
            });
        }
        if ($('btn-f29-ir-diario')) {
            $('btn-f29-ir-diario').addEventListener('click', function () {
                ui.subLibro = 'diario';
                cambiarModulo('libros');
            });
        }
        if ($('btn-f29-csv')) {
            $('btn-f29-csv').addEventListener('click', function () {
                var c = calcularModelo().f29.codigos;
                var filas = [
                    ['503 / 502', 'Facturas emitidas del giro', c[503], c[502]],
                    ['509 / 510', 'Notas de crédito emitidas (restan)', c[509], -c[510]],
                    ['538', 'Total débito fiscal', '', c[538]],
                    ['519 / 520', 'Facturas recibidas del giro', c[519], c[520]],
                    ['761 / 762', 'Supermercados y comercios similares', c[761], c[762]],
                    ['524 / 525', 'Compras activo fijo', c[524], c[525]],
                    ['527 / 528', 'Notas de crédito recibidas (restan)', c[527], -c[528]],
                    ['504', 'Remanente crédito fiscal mes anterior', '', c[504]],
                    ['537', 'Total crédito fiscal', '', c[537]],
                    ['89', 'Impuesto IVA determinado', '', c[89]],
                    ['77', 'Remanente crédito fiscal mes siguiente', '', c[77]],
                    ['48', 'Impuesto Único 2ª Categoría', '', c[48]],
                    ['151', 'Retención boletas de honorarios', '', c[151]],
                    ['563 / 115 / 62', 'PPM neto determinado (tasa ' + c[115] + '%)', c[563], c[62]],
                    ['91', 'Total a pagar dentro del plazo legal', '', c[91]]
                ];
                D.descargarCsv('hoja-guia-f29-' + periodoActual() + '.csv', ['Código SII', 'Concepto', 'Cantidad / Base', 'Monto ($)'], filas);
            });
        }
        if ($('btn-f29-pdf')) {
            $('btn-f29-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                imprimirHtmlModulo(
                    'Hoja Guía Formulario 29',
                    m.f29.regimenNombre,
                    '<table class="print-table"><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Código</th><th class="r">Monto</th></tr></thead><tbody>' + $('tbody-f29').innerHTML + '</tbody></table>',
                    'Borrador de trabajo para revisión del contador antes de declarar en sii.cl.'
                );
            });
        }

        // Subpestañas Libros
        Array.prototype.forEach.call(document.querySelectorAll('[data-sublibro]'), function (btn) {
            btn.addEventListener('click', function () {
                ui.subLibro = btn.getAttribute('data-sublibro');
                refrescarTodo();
            });
        });

        // Acciones sobre asientos (auditar / borrar)
        if ($('diario-lista')) {
            $('diario-lista').addEventListener('click', function (ev) {
                var btnAud = ev.target.closest('[data-auditar-asiento]');
                if (btnAud) {
                    var idA = btnAud.getAttribute('data-auditar-asiento');
                    guardarEstadoActual(function (est) {
                        if (est.auditados[idA]) delete est.auditados[idA];
                        else est.auditados[idA] = true;
                    });
                    refrescarTodo();
                    return;
                }
                var btnBor = ev.target.closest('[data-borrar-asiento]');
                if (btnBor) {
                    var idB = btnBor.getAttribute('data-borrar-asiento');
                    guardarEstadoActual(function (est) {
                        est.manuales = est.manuales.filter(function (x) { return x.id !== idB; });
                    });
                    refrescarTodo();
                    D.avisar('Ajuste manual eliminado.');
                }
            });
        }

        // Formulario asiento manual
        if ($('manual-lineas')) {
            $('manual-lineas').addEventListener('input', function (ev) {
                var fila = ev.target.closest('.manual-fila');
                if (!fila) return;
                var idx = Number(fila.getAttribute('data-idx'));
                var campo = ev.target.getAttribute('data-m-campo');
                if (!ui.lineasManualesDraft[idx] || !campo) return;
                ui.lineasManualesDraft[idx][campo] = ev.target.value;
                actualizarCuadreManual();
            });
            $('manual-lineas').addEventListener('click', function (ev) {
                var btnQ = ev.target.closest('[data-m-quitar]');
                if (!btnQ) return;
                ui.lineasManualesDraft.splice(Number(btnQ.getAttribute('data-m-quitar')), 1);
                pintarDraftManual();
            });
        }
        if ($('btn-manual-agregar-linea')) {
            $('btn-manual-agregar-linea').addEventListener('click', function () {
                ui.lineasManualesDraft.push({ cuenta: '11010', debe: '', haber: '' });
                pintarDraftManual();
            });
        }
        if ($('form-nuevo-asiento')) {
            $('form-nuevo-asiento').addEventListener('submit', function (ev) {
                ev.preventDefault();
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var fecha = $('manual-fecha').value || (periodoActual() + '-28');
                var glosa = ($('manual-glosa').value || '').trim();
                if (!glosa) { D.avisar('Escribe una glosa para el asiento.'); $('manual-glosa').focus(); return; }
                var a = C.crearAsiento('MAN-' + Date.now(), fecha, glosa, 'ajuste', ui.lineasManualesDraft);
                if (!a || !a.debe) { D.avisar('Ingresa montos mayores a cero.'); return; }
                if (!a.cuadra) { D.avisar('El asiento no cuadra: Debe (' + D.money(a.debe) + ') debe igualar Haber (' + D.money(a.haber) + ').'); return; }
                guardarEstadoActual(function (est) {
                    est.manuales.push({ id: a.id, fecha: fecha, glosa: glosa, origen: 'ajuste', lineas: ui.lineasManualesDraft });
                });
                $('manual-glosa').value = '';
                ui.lineasManualesDraft = [{ cuenta: '42040', debe: '', haber: '' }, { cuenta: '11010', debe: '', haber: '' }];
                refrescarTodo();
                D.avisar('Asiento registrado en Libro Diario y Mayor.');
            });
        }

        if ($('mayor-cuenta-filtro')) {
            $('mayor-cuenta-filtro').addEventListener('change', function () {
                ui.filtroMayor = $('mayor-cuenta-filtro').value;
                refrescarTodo();
            });
        }

        // Inputs Tesoreria
        ['tes-banco-ini', 'tes-pct-cobro', 'tes-pct-pago', 'tes-af-pagado', 'tes-sueldos-pagados', 'tes-hon-pagados', 'tes-cotiz-pagadas'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('change', function () {
                guardarEstadoActual(function (est) {
                    est.tesoreria.saldoInicialBanco = Math.max(0, Math.round(D.parseNumber($('tes-banco-ini').value)));
                    est.tesoreria.pctVentasCobradas = Math.max(0, Math.min(100, Number($('tes-pct-cobro').value) || 0));
                    est.tesoreria.pctComprasPagadas = Math.max(0, Math.min(100, Number($('tes-pct-pago').value) || 0));
                    est.tesoreria.activoFijoPagado = $('tes-af-pagado').checked;
                    est.tesoreria.sueldosPagados = $('tes-sueldos-pagados').checked;
                    est.tesoreria.honorariosPagados = $('tes-hon-pagados').checked;
                    est.tesoreria.cotizacionesPagadas = $('tes-cotiz-pagadas').checked;
                });
                refrescarTodo();
            });
        });

        if ($('btn-libros-csv')) {
            $('btn-libros-csv').addEventListener('click', function () {
                var m = calcularModelo();
                var filas = [];
                m.asientos.forEach(function (a) {
                    a.lineas.forEach(function (l) {
                        filas.push([a.id, a.fecha, a.origen, a.glosa, l.cuenta, l.nombre, l.debe, l.haber]);
                    });
                });
                D.descargarCsv('libro-diario-' + periodoActual() + '.csv', ['Asiento', 'Fecha', 'Origen', 'Glosa', 'Código', 'Cuenta', 'Debe', 'Haber'], filas);
            });
        }
        if ($('btn-libros-pdf')) {
            $('btn-libros-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                var html = m.asientos.map(function (a, i) {
                    return '<div class="print-h3">Asiento #' + (i + 1) + ' · ' + D.esc(a.fecha) + ' · ' + D.esc(a.glosa) + '</div>' +
                        '<table class="print-table"><thead><tr><th>Código</th><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th></tr></thead><tbody>' +
                        a.lineas.map(function (l) {
                            return '<tr><td>' + D.esc(l.cuenta) + '</td><td>' + D.esc(l.nombre) + '</td><td class="r">' + (l.debe ? D.money(l.debe) : '-') + '</td><td class="r">' + (l.haber ? D.money(l.haber) : '-') + '</td></tr>';
                        }).join('') +
                        '<tr class="total"><td colspan="2">Total asiento</td><td class="r">' + D.money(a.debe) + '</td><td class="r">' + D.money(a.haber) + '</td></tr></tbody></table>';
                }).join('');
                imprimirHtmlModulo('Libro Diario Contable', m.asientos.length + ' asientos cuadrados', html || '<p>Sin asientos registrados.</p>');
            });
        }

        // Subpestañas Balance / RLI
        Array.prototype.forEach.call(document.querySelectorAll('[data-subbal]'), function (btn) {
            btn.addEventListener('click', function () {
                ui.subBalance = btn.getAttribute('data-subbal');
                refrescarTodo();
            });
        });

        ['rli-cobros-ant', 'rli-pagos-ant', 'rli-agregados', 'rli-tasa-idpc'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', function () {
                guardarEstadoActual(function (est) {
                    est.rliAjustes.cobrosAnterioresNetos = Math.max(0, Math.round(D.parseNumber($('rli-cobros-ant').value)));
                    est.rliAjustes.pagosAnterioresNetos = Math.max(0, Math.round(D.parseNumber($('rli-pagos-ant').value)));
                    est.rliAjustes.otrosAgregados = Math.max(0, Math.round(D.parseNumber($('rli-agregados').value)));
                    est.rliAjustes.tasaIdpc = Math.max(0, Number($('rli-tasa-idpc').value) || 0);
                });
                refrescarTodo();
            });
        });

        if ($('btn-balance-csv')) {
            $('btn-balance-csv').addEventListener('click', function () {
                var b = calcularModelo().balance;
                var filas = b.filas.map(function (f) {
                    return [f.codigo, f.nombre, f.debito, f.credito, f.deudor, f.acreedor, f.activo, f.pasivo, f.perdida, f.ganancia];
                });
                var si = b.sumasIguales;
                filas.push(['', 'SUMAS IGUALES', si.debito, si.credito, si.deudor, si.acreedor, si.activo, si.pasivo, si.perdida, si.ganancia]);
                D.descargarCsv('balance-8-columnas-' + periodoActual() + '.csv',
                    ['Código', 'Cuenta', 'Débito', 'Crédito', 'Saldo Deudor', 'Saldo Acreedor', 'Activo', 'Pasivo', 'Pérdida', 'Ganancia'], filas);
            });
        }
        if ($('btn-rli-csv')) {
            $('btn-rli-csv').addEventListener('click', function () {
                var r = calcularModelo().rli;
                var filas = [
                    ['Ingresos devengados netos', r.ingresosDevengadosNetos],
                    ['Menos: Ventas no cobradas (CxC netas)', -r.ventasNoCobradasNetas],
                    ['Más: Cobros períodos anteriores', r.cobrosAnterioresNetos],
                    ['Ingresos percibidos computables', r.ingresosPercibidos],
                    ['Menos: Compras y gastos pagados', -r.comprasGastosPagados],
                    ['Menos: Remuneraciones y honorarios pagados', -r.remuneracionesHonorariosPagados],
                    ['Menos: Activo fijo pagado (depreciación instantánea)', -r.activoFijoPagadoNeto],
                    ['Más: Agregados art. 21 y 31 LIR', r.multasGastosRechazados],
                    ['Base Imponible / RLI ProPyme 14 D N°3', r.baseImponible]
                ];
                D.descargarCsv('hoja-rli-propyme-' + periodoActual() + '.csv', ['Concepto RLI Art. 14 D N°3', 'Monto ($)'], filas);
            });
        }
        if ($('btn-balance-pdf')) {
            $('btn-balance-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                var html = '<table class="print-table"><thead><tr><th>Cód.</th><th>Cuenta</th><th class="r">Débito</th><th class="r">Crédito</th><th class="r">Deudor</th><th class="r">Acreedor</th><th class="r">Activo</th><th class="r">Pasivo</th><th class="r">Pérdida</th><th class="r">Ganancia</th></tr></thead><tbody>' +
                    $('tbody-balance8').innerHTML + '</tbody></table>' +
                    '<div class="print-h3" style="margin-top:14px">Hoja de Trabajo RLI ProPyme (Art. 14 D N°3)</div>' +
                    '<table class="print-table"><tbody>' + $('tbody-rli').innerHTML + '</tbody></table>';
                imprimirHtmlModulo('Balance Tributario de 8 Columnas y RLI', m.f29.regimenNombre, html);
            });
        }

        // Exportaciones P&L y Flujo
        if ($('btn-pnl-csv')) {
            $('btn-pnl-csv').addEventListener('click', function () {
                var m = calcularModelo();
                var p = m.pnl, fl = m.flujo;
                var filas = [
                    ['ESTADO DE RESULTADOS', ''],
                    ['Ingresos de explotación', p.ingresosGiro],
                    ['Costo de ventas', -p.costoVentas],
                    ['Margen bruto', p.margenBruto],
                    ['Gasto laboral', -p.gastoLaboral],
                    ['Honorarios profesionales', -p.gastoHonorarios],
                    ['Gastos administración', -p.gastoAdmin],
                    ['Resultado operacional', p.resultadoOperacional],
                    ['Resultado antes de impuestos', p.resultadoAntesImpuesto],
                    ['', ''],
                    ['FLUJO DE CAJA DEL PERÍODO', ''],
                    ['Saldo inicial banco', fl.saldoInicialBanco],
                    ['Cobros clientes', fl.entradasCobrosClientes],
                    ['Pagos proveedores', -fl.salidasProveedores],
                    ['Pagos sueldos líquidos', -fl.salidasSueldos],
                    ['Pagos honorarios líquidos', -fl.salidasHonorarios],
                    ['Saldo disponible banco al cierre', fl.saldoDisponibleBanco],
                    ['Compromiso Previred día 13', -fl.compromisoPreviredDia13],
                    ['Compromiso F29 cód. 91 día 20', -fl.compromisoF29Dia20],
                    ['Caja libre proyectada post-impuestos', fl.cajaProyectadaPostImpuestos]
                ];
                D.descargarCsv('estado-resultados-flujo-' + periodoActual() + '.csv', ['Concepto', 'Monto ($)'], filas);
            });
        }
        if ($('btn-pnl-pdf')) {
            $('btn-pnl-pdf').addEventListener('click', function () {
                var html = '<div class="print-h3">Estado de Resultados (Base Devengada)</div>' +
                    '<table class="print-table"><tbody>' + $('tbody-pnl').innerHTML + '</tbody></table>' +
                    '<div class="print-h3" style="margin-top:14px">Flujo de Caja Operativo y Tributario</div>' +
                    '<table class="print-table"><tbody>' + $('tbody-flujo').innerHTML + '</tbody></table>';
                imprimirHtmlModulo('Estado de Resultados y Flujo de Caja', '', html);
            });
        }

        // Eventos cruzados desde Liquidaciones / Cliente
        document.addEventListener('demo:liquidaciones', refrescarTodo);
        document.addEventListener('demo:cliente', refrescarTodo);

        var modUrl = (/[?&]mod=(remuneraciones|f29|libros|balance|pnl)/.exec(location.search) || [])[1];
        cambiarModulo(modUrl || 'remuneraciones');
    });
})();
