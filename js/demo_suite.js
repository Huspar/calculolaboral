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
    var Imp = window.CLImportadores;
    var Renta = window.CLRenta;
    var Pro = window.CLContadoresAsistentePro;
    var K_STORAGE = 'cl-suite-contable';
    var K_PLAN_CUENTAS = 'cl-plan-cuentas-estudio';
    var K_MEMBRETE = 'cl-membrete-estudio';

    var ui = {
        modulo: 'remuneraciones',
        subLibro: 'diario',
        subBanco: 'conciliacion',
        subBalance: 'balance8',
        subDdjj: '1887',
        filtroMayor: '',
        lineasManualesDraft: [
            { cuenta: '42040', debe: '', haber: '' },
            { cuenta: '11010', debe: '', haber: '' }
        ]
    };

    function cargarPlanPersonalizado() {
        if (!C || !C.establecerPlanCuentas) return;
        try {
            var raw = window.localStorage.getItem(K_PLAN_CUENTAS);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) C.establecerPlanCuentas(parsed);
        } catch (e) { /* usar plan base */ }
    }

    function guardarPlanPersonalizado() {
        if (!C || !C.obtenerPlanCuentas) return;
        try { window.localStorage.setItem(K_PLAN_CUENTAS, JSON.stringify(C.obtenerPlanCuentas())); } catch (e) { }
    }

    function leerMembrete() {
        var e = D && D.estudio ? D.estudio() : {};
        var base = {
            estudio: e.nombre || 'Estudio Contable Chile',
            rut: '76.543.210-K',
            contador: 'Contador Auditor',
            pie: 'Documento de trabajo y referencia tributaria emitido para el cliente.'
        };
        try {
            var raw = window.localStorage.getItem(K_MEMBRETE);
            if (!raw) return base;
            var parsed = JSON.parse(raw);
            return Object.assign({}, base, parsed && typeof parsed === 'object' ? parsed : {});
        } catch (err) {
            return base;
        }
    }

    function guardarMembrete(obj) {
        try { window.localStorage.setItem(K_MEMBRETE, JSON.stringify(obj)); } catch (e) { }
    }

    function clienteSlug() {
        var s = clienteClave().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return s || 'cliente';
    }

    cargarPlanPersonalizado();

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
        return (el && el.value) ? el.value : '2026-11';
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
            comprasPendientesAcuse: [],
            acuseDecisiones: {},
            remanenteAnterior: 0,
            remanente77MesAnterior: '',
            utmMesPresentacionAnterior: '',
            utmMesPresentacionActual: '',
            postergarIva: false,
            excluirSupermercado: false,
            tasaPpmPersonalizada: '',
            iuscManual: '',
            honorariosBruto: 0,
            honorariosRetencionDirecta: 0,
            bheBoletas: [],
            bheAnuladas: 0,
            bheAlertas: [],
            cartolaMovimientos: [],
            cartolaTotalAbonos: 0,
            cartolaTotalCargos: 0,
            cartolaUltimoSaldo: null,
            ddjjAnio: 2026,
            socios: [
                { rut: '12.345.678-5', nombre: 'Socio titular', porcentaje: 100, retiros: 0 }
            ],
            cptAjustes: {
                cptAnterior: 10000000,
                aumentosCapital: 0,
                disminucionesCapital: 0,
                retirosDividendos: 0,
                gastosRechazados: 0,
                idpcPagado: 0,
                capitalAportadoReajustado: 10000000
            },
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
            activosFijos: [],
            reglasConciliacion: [],
            matchesConfirmados: {},
            matchesDescartados: {},
            carteraEstado: { cxc: {}, cxp: {} },
            f22Ajustes: {
                ppmManual: '',
                factorPpm: 1.018,
                otrosCreditos: 0
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
            cptAjustes: Object.assign({}, base.cptAjustes, guardado.cptAjustes || {}),
            bheBoletas: Array.isArray(guardado.bheBoletas) ? guardado.bheBoletas : [],
            bheAlertas: Array.isArray(guardado.bheAlertas) ? guardado.bheAlertas : [],
            comprasPendientesAcuse: Array.isArray(guardado.comprasPendientesAcuse) ? guardado.comprasPendientesAcuse : [],
            acuseDecisiones: (guardado.acuseDecisiones && typeof guardado.acuseDecisiones === 'object') ? guardado.acuseDecisiones : {},
            cartolaMovimientos: Array.isArray(guardado.cartolaMovimientos) ? guardado.cartolaMovimientos : [],
            activosFijos: Array.isArray(guardado.activosFijos) ? guardado.activosFijos : [],
            reglasConciliacion: Array.isArray(guardado.reglasConciliacion) ? guardado.reglasConciliacion : [],
            matchesConfirmados: (guardado.matchesConfirmados && typeof guardado.matchesConfirmados === 'object') ? guardado.matchesConfirmados : {},
            matchesDescartados: (guardado.matchesDescartados && typeof guardado.matchesDescartados === 'object') ? guardado.matchesDescartados : {},
            carteraEstado: Object.assign({ cxc: {}, cxp: {} }, guardado.carteraEstado || {}),
            f22Ajustes: Object.assign({}, base.f22Ajustes, guardado.f22Ajustes || {}),
            socios: Array.isArray(guardado.socios) && guardado.socios.length ? guardado.socios : base.socios,
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

    function guardarEstadoParaCliente(nombreCliente, periodo, mutador) {
        var nomKey = String(nombreCliente || '').trim().toLowerCase() || 'cliente-demo';
        var per = String(periodo || periodoActual()).trim() || '2026-11';
        var k = nomKey + '::' + per;
        var todo = leerTodoAlmacen();
        var base = estadoDefecto(per);
        var guardado = todo[k];
        var actual = (guardado && typeof guardado === 'object')
            ? Object.assign({}, base, guardado, {
                tesoreria: Object.assign({}, base.tesoreria, guardado.tesoreria || {}),
                carteraEstado: Object.assign({ cxc: {}, cxp: {} }, guardado.carteraEstado || {})
            })
            : base;
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
            postergarIva: !!est.postergarIva,
            excluirSupermercado: !!est.excluirSupermercado,
            tasaPpm: est.tasaPpmPersonalizada,
            impuestoUnico48: iusc48,
            honorariosBruto: est.honorariosBruto,
            honorariosRetencionDirecta: (est.honorariosRetencionDirecta > 0 || (Array.isArray(est.bheBoletas) && est.bheBoletas.length > 0))
                ? est.honorariosRetencionDirecta
                : ''
        });

        var hayMovimientos = (
            ventas.documentos.length > 0 ||
            compras.documentos.length > 0 ||
            (nomina && nomina.totalDebe > 0) ||
            est.honorariosBruto > 0 ||
            (est.honorariosRetencionDirecta || 0) > 0 ||
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

        var ddjjAnio = Number(est.ddjjAnio || 2026);
        var dj1887 = null, dj1879 = null, dj194x = null, cptSimp = null;
        if (Renta) {
            var nomRegs = Renta.acumularLiquidacionesParaDj1887(resLiq);
            dj1887 = Renta.generarDj1887(nomRegs, { anioTributario: ddjjAnio });

            var bheLista = Array.isArray(est.bheBoletas) && est.bheBoletas.length
                ? est.bheBoletas
                : (est.honorariosBruto > 0
                    ? [{ rut: '12.345.678-5', razonSocial: 'Honorarios consolidados del período', bruto: est.honorariosBruto, retenido: f29.codigos[151], estado: 'VIGENTE' }]
                    : []);
            dj1879 = Renta.generarDj1879(bheLista, { anioTributario: ddjjAnio });

            dj194x = Renta.generarDj1947o1948(est.regimen, {
                baseImponible: rli.baseImponible,
                ppmDisponible: f29.codigos[62],
                retirosTotales: (est.socios && est.socios[0] && est.socios[0].retiros) || 0,
                tasaIdpc: est.rliAjustes.tasaIdpc,
                socios: est.socios
            }, { anioTributario: ddjjAnio });

            cptSimp = Renta.calcularCptSimplificado(Object.assign({}, est.cptAjustes, {
                baseImponibleRli: rli.baseImponible
            }));
        }

        var auditoria = Pro ? Pro.auditarF29PreSii({
            periodo: periodo,
            f29: f29,
            ventas: ventas,
            compras: compras,
            nomina: nomina,
            estado: est,
            remanente77MesAnterior: est.remanente77MesAnterior,
            utmMesPresentacionAnterior: est.utmMesPresentacionAnterior,
            utmMesPresentacionActual: est.utmMesPresentacionActual
        }) : null;

        var activoFijo = Pro ? Pro.calcularActivoFijoTributario(est.activosFijos, {
            regimen: est.regimen,
            factorIpc: 1.018
        }) : null;

        var conciliacion = Pro ? Pro.conciliarCartolaConReglas(est.cartolaMovimientos, {
            ventas: ventas,
            compras: compras,
            reglas: est.reglasConciliacion,
            modoSugerencias: true,
            matchesConfirmados: est.matchesConfirmados,
            matchesDescartados: est.matchesDescartados
        }) : null;

        var aging = Pro ? Pro.calcularAgingDocumentos(ventas, compras, periodo, {
            modoReal: true,
            pctVentasCobradas: est.tesoreria.pctVentasCobradas,
            pctComprasPagadas: est.tesoreria.pctComprasPagadas,
            carteraEstado: est.carteraEstado,
            foliosConciliados: conciliacion ? conciliacion.foliosConciliados : {}
        }) : null;

        var ppmManualVal = (est.f22Ajustes && est.f22Ajustes.ppmManual !== '' && est.f22Ajustes.ppmManual != null)
            ? Math.max(0, Math.round(Number(est.f22Ajustes.ppmManual) || 0))
            : null;
        var f22 = Pro ? Pro.calcularPropuestaF22({
            regimen: est.regimen,
            anioTributario: ddjjAnio,
            baseImponibleRli: rli.baseImponible,
            ppmPagadoTotal: ppmManualVal !== null ? ppmManualVal : (f29.codigos[62] || 0),
            factorPromedioPpm: (est.f22Ajustes && Number(est.f22Ajustes.factorPpm)) || 1.018,
            otrosCreditos: (est.f22Ajustes && Number(est.f22Ajustes.otrosCreditos)) || 0
        }) : null;

        return {
            estado: est,
            periodo: periodo,
            hayMovimientos: hayMovimientos,
            nomina: nomina,
            iuscAuto: iuscAuto,
            ventas: ventas,
            compras: compras,
            f29: f29,
            auditoria: auditoria,
            activoFijo: activoFijo,
            conciliacion: conciliacion,
            aging: aging,
            f22: f22,
            asientos: gen.asientos,
            metricasFlujo: gen.metricasFlujo,
            mayor: mayor,
            balance: balance,
            rli: rli,
            pnl: pyf.pnl,
            flujo: pyf.flujo,
            ddjj: { anio: ddjjAnio, dj1887: dj1887, dj1879: dj1879, dj194x: dj194x, cpt: cptSimp }
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
        if ($('drop-rcv-ventas')) $('drop-rcv-ventas').classList.toggle('cargada', m.ventas.documentos.length > 0);
        $('rcv-compras-estado').textContent = m.compras.documentos.length
            ? (est.comprasArchivo || 'RCV Compras') + ' · ' + m.compras.documentos.length + ' registros'
            : 'Sin archivo cargado (.csv o .xlsx)';
        if ($('drop-rcv-compras')) $('drop-rcv-compras').classList.toggle('cargada', m.compras.documentos.length > 0);

        var vacio = $('f29-vacio');
        var resPanel = $('f29-resultados');
        var tieneDatosF29 = m.ventas.documentos.length > 0 || m.compras.documentos.length > 0 || c[48] > 0 || c[151] > 0 || c[504] > 0;
        pintarAuditoriaComprasF29(m);
        pintarAsistenteUtm(m);
        if (!tieneDatosF29) {
            vacio.hidden = false;
            resPanel.hidden = true;
            if ($('f29-semaforo-auditoria')) $('f29-semaforo-auditoria').hidden = true;
            return;
        }
        vacio.hidden = true;
        resPanel.hidden = false;
        pintarPostergacionF29(m);
        pintarSemaforoF29(m);

        $('f29-k-debito').textContent = moneySigno(c[538]);
        $('f29-k-credito').textContent = moneySigno(c[537]);
        $('f29-k-iva-lbl').textContent = c[89] > 0 ? 'IVA determinado (cód. 89)' : 'Remanente mes sig. (cód. 77)';
        $('f29-k-iva').textContent = c[89] > 0 ? D.money(c[89]) : D.money(c[77]);
        $('f29-k-total').textContent = D.money(c[91]);

        if ($('f29-m-deb')) {
            $('f29-m-deb').textContent = moneySigno(c[538]);
            $('f29-m-cred').textContent = moneySigno(c[537]);
            if ($('f29-m-iva-lbl')) $('f29-m-iva-lbl').textContent = c[89] > 0 ? 'IVA determinado (cód. 89)' : 'Remanente mes sig. (cód. 77)';
            $('f29-m-iva').textContent = c[89] > 0 ? D.money(c[89]) : D.money(c[77]);
            $('f29-m-total').textContent = D.money(c[91]);
            if ($('f29-m-estado')) {
                $('f29-m-estado').textContent = c[91] > 0 ? 'Con pago en plazo' : 'Sin pago F29';
            }
            if ($('f29-m-pie')) {
                $('f29-m-pie').textContent = 'Incluye retenciones (' + D.money((c[48] || 0) + (c[151] || 0)) + ') y PPM (' + D.money(c[62] || 0) + ').';
            }
        }

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
                ? { glosa: 'Impuesto IVA determinado', cod: '89', monto: c[89], total: !c[756] }
                : { glosa: 'Remanente de crédito fiscal para el período siguiente (no suma al pago)', cod: '77', monto: c[77], ok: true },
            { glosa: 'Menos: IVA postergado a 2 meses (art. 64 inc. 3° · cód. 756 activo)', cod: '755', monto: c[755], resta: true, ocultarCero: true },

            { sec: 'IV. Retenciones de Segunda Categoría y PPM obligatorio' },
            { glosa: 'Impuesto Único de 2ª Categoría retenido sobre sueldos (art. 42 N°1)', cod: '48', monto: c[48] },
            { glosa: 'Retención sobre boletas de honorarios de terceros (' + D.num(f.resumen.tasaHonorariosPct, 2) + '% vigente · bruto ' + D.money(f.resumen.honorariosBruto) + ')', cod: '151', monto: c[151] },
            { glosa: 'Base imponible PPM (' + D.money(c[563]) + ') · Tasa cód. 115 (' + D.num(c[115], 3) + '%)', cod: '62', monto: c[62] },

            { sec: 'V. Total determinado' },
            { glosa: c[756] ? 'Total a pagar hoy en Formulario 29 (retenciones + PPM; IVA va en giro mes +2)' : 'Total a pagar en Formulario 29 dentro del plazo legal (día 20 del mes siguiente)', cod: '91', monto: c[91], granTotal: true }
        ];

        $('tbody-f29').innerHTML = filas.filter(function (r) {
            return !r.ocultarCero || r.monto !== 0 || r.cant > 0;
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
                '<td class="mono num">' + signo + (r.resta ? D.money(r.monto) : moneySigno(r.monto)) + '</td>' +
                '</tr>';
        }).join('');

        var avisos = f.avisos.concat(m.ventas.avisos).concat(m.compras.avisos);
        var notaHtml = '<b>Borrador referencial:</b> confirma siempre los montos con la propuesta en sii.cl antes de declarar y pagar. Tasa PPM ProPyme General 2026 rebajada transitoriamente por Ley 21.755 y Circular SII N°53/2025 (configurable en código 115).';
        if (avisos.length) {
            notaHtml += '<br>' + avisos.map(function (a) { return '· ' + D.esc(a); }).join('<br>');
        }
        $('f29-notas').innerHTML = notaHtml;

        Array.prototype.forEach.call(document.querySelectorAll('#suite-f29 input:not(#f29-periodo), #suite-f29 select'), function (inp) {
            if (inp.id === 'f29-iusc-manual' && m.nomina) return;
            if (inp.id === 'f29-check-postergacion' && (!(m.f29 && m.f29.codigos && m.f29.codigos[89] > 0) || bloqueado)) {
                inp.disabled = true;
                return;
            }
            inp.disabled = bloqueado && inp.type !== 'file';
        });
    }

    var NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    function sumarMesesNombre(periodo, deltaMeses) {
        var mp = /^(\d{4})-(\d{2})$/.exec(String(periodo || '2026-11'));
        if (!mp) return '';
        var dt = new Date(Number(mp[1]), Number(mp[2]) - 1 + deltaMeses, 1);
        return NOMBRES_MESES[dt.getMonth()] + ' ' + dt.getFullYear();
    }

    function actualizarPreviewUtmCard() {
        var remEl = $('utm-calc-rem-ant');
        var uAntEl = $('utm-val-ant');
        var uActEl = $('utm-val-act');
        if (!remEl || !uAntEl || !uActEl || !F29 || !F29.reajustarRemanenteUtm) return null;
        var res = F29.reajustarRemanenteUtm(D.parseNumber(remEl.value), D.parseNumber(uAntEl.value), D.parseNumber(uActEl.value));
        if ($('utm-var-pct')) {
            var sign = res.variacionPct >= 0 ? '+' : '';
            $('utm-var-pct').textContent = sign + D.num(res.variacionPct, 3) + '%';
        }
        if ($('utm-rem-reajustado')) {
            $('utm-rem-reajustado').textContent = D.money(res.reajustado) + (res.utm > 0 ? (' (' + D.num(res.utm, 2) + ' UTM)') : '');
        }
        return res;
    }

    function pintarAsistenteUtm(m) {
        var per = (m && m.periodo) || periodoActual();
        if ($('utm-mes-ant-nom')) $('utm-mes-ant-nom').textContent = sumarMesesNombre(per, 0);
        if ($('utm-mes-act-nom')) $('utm-mes-act-nom').textContent = sumarMesesNombre(per, 1);
        var est = m && m.estado ? m.estado : leerEstadoActual();
        if ($('utm-calc-rem-ant') && document.activeElement !== $('utm-calc-rem-ant') && est.remanente77MesAnterior !== '' && est.remanente77MesAnterior != null) {
            $('utm-calc-rem-ant').value = est.remanente77MesAnterior;
        }
        if ($('utm-val-ant') && document.activeElement !== $('utm-val-ant') && est.utmMesPresentacionAnterior) {
            $('utm-val-ant').value = est.utmMesPresentacionAnterior;
        }
        if ($('utm-val-act') && document.activeElement !== $('utm-val-act') && est.utmMesPresentacionActual) {
            $('utm-val-act').value = est.utmMesPresentacionActual;
        }
        actualizarPreviewUtmCard();
    }

    function pintarAuditoriaComprasF29(m) {
        var panel = $('f29-auditoria-compras');
        if (!panel) return;
        var est = m.estado || {};
        var bloqueado = !!est.cerradoTributario;
        var pendientes = Array.isArray(est.comprasPendientesAcuse) ? est.comprasPendientesAcuse : [];
        var fRes = (m.f29 && m.f29.resumen) || {};
        var superCant = fRes.comprasSupermercadoCantOrig || 0;
        var superIva = fRes.comprasSupermercadoIvaOrig || 0;
        var mostrar = m.compras.documentos.length > 0 || pendientes.length > 0 || superCant > 0;
        panel.hidden = !mostrar;
        if (!mostrar) return;

        var urgentes = pendientes.filter(function (p) { return p.estadoPlazo === 'critico'; }).length;
        if ($('badge-acuse-urgentes')) {
            $('badge-acuse-urgentes').hidden = urgentes === 0;
            if ($('txt-acuse-urgentes')) $('txt-acuse-urgentes').textContent = urgentes + ' por vencer';
        }

        var tbody = $('tbody-f29-acuse-compras');
        if (tbody) {
            var decs = est.acuseDecisiones || {};
            tbody.innerHTML = pendientes.length
                ? pendientes.map(function (p) {
                    var selloCls = p.estadoPlazo === 'critico' ? 'sello-riesgo' : (p.estadoPlazo === 'tacito' ? 'sello-guardada' : 'sello-emitida');
                    var plazoTxt = p.estadoPlazo === 'tacito'
                        ? 'Aceptada tácita (+8d)'
                        : (p.estadoPlazo === 'critico' ? ('¡Vence en ' + p.diasRestantes + 'd!') : (p.diasRestantes + ' días restantes'));
                    var decRaw = decs[p.id];
                    var decObj = typeof decRaw === 'string'
                        ? { modo: 'local', accion: decRaw === 'reclamar' ? 'RCD' : 'ERM' }
                        : (decRaw && typeof decRaw === 'object' ? decRaw : null);
                    var accHtml = '';
                    if (decObj && decObj.modo === 'sii') {
                        var esRec = decObj.accion === 'RCD' || decObj.accion === 'RFP' || decObj.accion === 'RFT';
                        var fAcc = decObj.fechaAcuse ? String(decObj.fechaAcuse).slice(0, 10) : '';
                        accHtml = '<div class="acuse-fila-confirmada">' +
                            '<span class="sello ' + (esRec ? 'sello-riesgo' : 'sello-emitida') + '">Enviado SII · ' + D.esc(decObj.accion || 'ERM') + '</span>' +
                            '<span class="texto-ayuda mono">' + D.esc(fAcc ? (fAcc + ' · ') : '') + 'Irreversible (Ley 19.983)</span>' +
                            '</div>';
                    } else if (decObj && decObj.modo === 'enviando') {
                        accHtml = '<span class="sello sello-preparada"><span class="material-icons sii-spin" aria-hidden="true" style="font-size:14px">sync</span>Enviando...</span>';
                    } else if (decObj && decObj.modo === 'error') {
                        accHtml = '<div class="acuse-fila-confirmada">' +
                            '<span class="sello sello-riesgo" title="' + D.esc(decObj.error || '') + '">Error al enviar</span>' +
                            '<button type="button" class="btn-texto btn-acuse-dec" data-acuse-id="' + D.esc(p.id) + '" data-acuse-acc="reintentar"' + (bloqueado ? ' disabled' : '') + '>Reintentar</button>' +
                            '</div>';
                    } else if (decObj && decObj.modo === 'local') {
                        var esLocRec = decObj.accion === 'RCD' || decObj.accion === 'RFP' || decObj.accion === 'RFT';
                        accHtml = '<div class="acuse-fila-confirmada">' +
                            '<span class="sello ' + (esLocRec ? 'sello-riesgo' : 'sello-preparada') + '">Marca local: ' + D.esc(decObj.accion || 'ERM') + '</span>' +
                            '<button type="button" class="btn-texto btn-acuse-dec" data-acuse-id="' + D.esc(p.id) + '" data-acuse-acc="cambiar"' + (bloqueado ? ' disabled' : '') + '>Enviar o cambiar</button>' +
                            '</div>';
                    } else {
                        accHtml = '<div class="match-acciones-fila">' +
                            '<button type="button" class="btn btn-chico btn-acuse-dec" data-acuse-id="' + D.esc(p.id) + '" data-acuse-acc="aceptar"' + (bloqueado ? ' disabled' : '') + '>Aceptar</button>' +
                            '<button type="button" class="btn-texto btn-acuse-dec" data-acuse-id="' + D.esc(p.id) + '" data-acuse-acc="reclamar"' + (bloqueado ? ' disabled' : '') + '>Reclamar</button>' +
                          '</div>';
                    }
                    return '<tr>' +
                        '<td class="mono">DTE ' + D.esc(p.tipoDoc || 33) + ' #' + D.esc(p.folio || 's/f') + '</td>' +
                        '<td>' + D.esc(p.razonSocial || 'Proveedor') + '<br><span class="texto-ayuda mono">' + D.esc(p.rut || '-') + '</span></td>' +
                        '<td class="mono">' + D.esc(p.fechaRecepcion || p.fechaEmision || '-') + '</td>' +
                        '<td><span class="sello ' + selloCls + '">' + D.esc(plazoTxt) + '</span></td>' +
                        '<td class="mono num">' + D.money(p.iva || 0) + '<br><span class="texto-ayuda">' + D.money(p.total || 0) + '</span></td>' +
                        '<td class="num">' + accHtml + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="6" class="texto-ayuda">Sin facturas en estado PENDIENTE de acuse de recibo (Ley 19.983) para este período.</td></tr>';
        }

        var boxSup = $('f29-alerta-supermercado');
        if (boxSup) {
            boxSup.hidden = superCant === 0;
            if (superCant > 0) {
                if ($('super-cant')) $('super-cant').textContent = superCant;
                if ($('super-monto')) $('super-monto').textContent = D.money(superIva);
                var excl = !!est.excluirSupermercado;
                if ($('supermercado-titulo')) {
                    $('supermercado-titulo').textContent = excl
                        ? 'Supermercados excluidos temporalmente del crédito (No Incluir)'
                        : 'Facturas de supermercado detectadas (Cód. 761 / 762)';
                }
                if ($('btn-super-no-incluir')) {
                    $('btn-super-no-incluir').classList.toggle('btn-primario', excl);
                    $('btn-super-no-incluir').disabled = bloqueado;
                }
                if ($('btn-super-mantener')) {
                    $('btn-super-mantener').classList.toggle('btn-primario', !excl);
                    $('btn-super-mantener').disabled = bloqueado;
                }
            }
        }
    }

    function pintarPostergacionF29(m) {
        var est = m.estado || {};
        var c = (m.f29 && m.f29.codigos) || {};
        var fRes = (m.f29 && m.f29.resumen) || {};
        var chk = $('f29-check-postergacion');
        if (chk) chk.checked = !!est.postergarIva;
        var activo = !!c[756];
        if ($('sello-postergacion-estado')) $('sello-postergacion-estado').hidden = !activo;
        if ($('f29-postergacion-desglose')) $('f29-postergacion-desglose').hidden = !activo;
        if (activo) {
            if ($('post-monto-iva')) $('post-monto-iva').textContent = D.money(c[755] || 0);
            if ($('post-monto-inmediato')) $('post-monto-inmediato').textContent = D.money(fRes.retencionesYPpm || 0);
            if ($('post-total-final')) $('post-total-final').textContent = D.money(c[91] || 0);
            if ($('post-fecha-vence')) $('post-fecha-vence').textContent = 'Vence día 12 o 20 de ' + sumarMesesNombre(m.periodo, 2);
        }
    }

    function pintarSemaforoF29(m) {
        var box = $('f29-semaforo-auditoria');
        if (!box) return;
        var a = m && m.auditoria;
        if (!a || !Array.isArray(a.hallazgos) || !a.hallazgos.length) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        box.className = 'f29-semaforo-box estado-' + a.estadoGeneral;

        var icono = a.estadoGeneral === 'rojo' ? 'error' : (a.estadoGeneral === 'amarillo' ? 'warning' : 'verified');
        var pills = [];
        if (a.conteo.rojo > 0) pills.push('<span class="f29-sem-pill rojo">' + a.conteo.rojo + ' crítico(s)</span>');
        if (a.conteo.amarillo > 0) pills.push('<span class="f29-sem-pill amarillo">' + a.conteo.amarillo + ' por revisar</span>');
        pills.push('<span class="f29-sem-pill verde">' + a.conteo.verde + ' OK</span>');

        var cardsHtml = a.hallazgos.map(function (h) {
            return '<div class="f29-sem-item nivel-' + D.esc(h.nivel) + '">' +
                '<span class="f29-sem-dot ' + D.esc(h.nivel) + '" aria-hidden="true"></span>' +
                '<div>' +
                '<div class="f29-sem-item-top"><strong>' + D.esc(h.titulo) + '</strong><span class="f29-sem-cod">' + D.esc(h.codigoSii) + '</span></div>' +
                '<p>' + D.esc(h.detalle) + '</p>' +
                '<span class="f29-sem-norma">' + D.esc(h.norma) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');

        box.innerHTML = '<div class="f29-sem-head">' +
            '<div class="f29-sem-titulo"><span class="material-icons" aria-hidden="true">' + icono + '</span><div><strong>Semáforo Pre-SII del F29</strong><div class="f29-sem-resumen">' + D.esc(a.resumenEstado) + '</div></div></div>' +
            '<div class="f29-sem-pills">' + pills.join('') + '</div>' +
            '</div>' +
            '<div class="f29-sem-grid">' + cardsHtml + '</div>';
    }

    function generarTextoWhatsapp(m) {
        if (!Pro || !m) return '';
        return Pro.generarResumenWhatsappCliente({
            cliente: clienteNombre(),
            periodo: m.periodo,
            regimenNombre: m.f29 ? m.f29.regimenNombre : '',
            f29: m.f29,
            pnl: m.pnl,
            flujo: m.flujo,
            nomina: m.nomina,
            auditoria: m.auditoria,
            estudio: leerMembrete()
        });
    }

    function copiarTextoPortapapeles(texto, mensajeOk) {
        if (!texto) {
            D.avisar('No hay datos calculados para copiar.');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(function () {
                D.avisar(mensajeOk || 'Texto copiado al portapapeles.');
            }).catch(function () {
                copiarFallbackTextarea(texto, mensajeOk);
            });
            return;
        }
        copiarFallbackTextarea(texto, mensajeOk);
    }

    function copiarFallbackTextarea(texto, mensajeOk) {
        try {
            var ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            D.avisar(mensajeOk || 'Texto copiado al portapapeles.');
        } catch (e) {
            D.avisar('Copia manual disponible en la vista previa.');
        }
    }

    // ------------------------------------------------------------- Render Bancos y Contabilidad General
    function pintarIdentidadCliente() {
        var disp = $('ctx-cliente-display');
        if (disp) disp.textContent = clienteNombre();
    }

    function pintarBancos(m) {
        var est = m.estado;
        var bloqueado = !!est.cerradoTributario;
        var subB = (ui.subBanco === 'cartera' || ui.subBanco === 'tesoreria') ? ui.subBanco : 'conciliacion';

        Array.prototype.forEach.call(document.querySelectorAll('[data-subbanco]'), function (btn) {
            var act = btn.getAttribute('data-subbanco') === subB;
            btn.classList.toggle('activo', act);
            btn.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        if ($('sub-conciliacion')) $('sub-conciliacion').hidden = subB !== 'conciliacion';
        if ($('sub-bancos-cartera')) $('sub-bancos-cartera').hidden = subB !== 'cartera';
        if ($('sub-tesoreria')) $('sub-tesoreria').hidden = subB !== 'tesoreria';

        var t = est.tesoreria;
        if ($('tes-banco-ini') && document.activeElement !== $('tes-banco-ini')) $('tes-banco-ini').value = t.saldoInicialBanco || 0;
        if ($('tes-pct-cobro') && document.activeElement !== $('tes-pct-cobro')) $('tes-pct-cobro').value = t.pctVentasCobradas;
        if ($('tes-pct-pago') && document.activeElement !== $('tes-pct-pago')) $('tes-pct-pago').value = t.pctComprasPagadas;
        if ($('tes-af-pagado')) $('tes-af-pagado').checked = !!t.activoFijoPagado;
        if ($('tes-sueldos-pagados')) $('tes-sueldos-pagados').checked = !!t.sueldosPagados;
        if ($('tes-hon-pagados')) $('tes-hon-pagados').checked = !!t.honorariosPagados;
        if ($('tes-cotiz-pagadas')) $('tes-cotiz-pagadas').checked = !!t.cotizacionesPagadas;
        Array.prototype.forEach.call(document.querySelectorAll('#sub-tesoreria input'), function (el) { el.disabled = bloqueado; });

        var chipPct = $('nav-bancos-pct');
        if (chipPct) {
            var pct = (m.conciliacion && m.conciliacion.resumen) ? (m.conciliacion.resumen.pctConciliado || 0) : 0;
            chipPct.textContent = pct + '%';
        }
        pintarConciliacionYAgenda(m);
    }

    function pintarLibros(m) {
        var est = m.estado;
        var bloqueado = est.cerradoTributario;
        var subLib = (ui.subLibro === 'mayor' || ui.subLibro === 'plan') ? ui.subLibro : 'diario';

        Array.prototype.forEach.call(document.querySelectorAll('[data-sublibro]'), function (btn) {
            var act = btn.getAttribute('data-sublibro') === subLib;
            btn.classList.toggle('activo', act);
            btn.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        $('sub-diario').hidden = subLib !== 'diario';
        $('sub-mayor').hidden = subLib !== 'mayor';
        if ($('sub-plan')) $('sub-plan').hidden = subLib !== 'plan';
        pintarPlanCuentas();

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
            var nro = i + 1;
            return '<div class="manual-fila" data-idx="' + i + '">' +
                '<select data-m-campo="cuenta" aria-label="Cuenta contable línea ' + nro + '">' + opcionesPlanCuentas(l.cuenta) + '</select>' +
                '<div class="campo-unidad"><span class="campo-addon" aria-hidden="true">$</span><input type="text" inputmode="numeric" data-tipo="pesos" placeholder="Debe" aria-label="Debe en pesos línea ' + nro + '" data-m-campo="debe" value="' + (l.debe !== '' ? D.esc(l.debe) : '') + '"></div>' +
                '<div class="campo-unidad"><span class="campo-addon" aria-hidden="true">$</span><input type="text" inputmode="numeric" data-tipo="pesos" placeholder="Haber" aria-label="Haber en pesos línea ' + nro + '" data-m-campo="haber" value="' + (l.haber !== '' ? D.esc(l.haber) : '') + '"></div>' +
                (ui.lineasManualesDraft.length > 2 ? '<button type="button" class="btn btn-chico" data-m-quitar="' + i + '" aria-label="Quitar línea ' + nro + '">Quitar</button>' : '') +
                '</div>';
        }).join('');
        actualizarCuadreManual();
    }

    function actualizarCuadreManual() {
        var debe = 0, haber = 0;
        ui.lineasManualesDraft.forEach(function (l) {
            debe += Math.max(0, Math.round(D.parseNumber(l.debe) || 0));
            haber += Math.max(0, Math.round(D.parseNumber(l.haber) || 0));
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
        if ($('sub-activo-fijo')) $('sub-activo-fijo').hidden = ui.subBalance !== 'activo_fijo';
        pintarActivoFijo(m);

        $('bal-k-activo').textContent = D.money(b.totales.activo);
        $('bal-k-pasivo').textContent = D.money(b.totales.pasivo);
        $('bal-k-res-lbl').textContent = b.resultado >= 0 ? 'Utilidad contable' : 'Pérdida contable';
        $('bal-k-resultado').textContent = moneySigno(b.resultado);
        $('bal-k-rli').textContent = moneySigno(rli.baseImponible);

        if ($('bal-resumen-movil')) {
            $('bal-resumen-movil').hidden = !b.filas.length;
            if ($('bal-m-activo')) $('bal-m-activo').textContent = D.money(b.totales.activo);
            if ($('bal-m-pasivo')) $('bal-m-pasivo').textContent = D.money(b.totales.pasivo);
            if ($('bal-m-res-lbl')) $('bal-m-res-lbl').textContent = b.resultado >= 0 ? 'Utilidad contable' : 'Pérdida contable';
            if ($('bal-m-resultado')) $('bal-m-resultado').textContent = moneySigno(b.resultado);
            if ($('bal-m-rli')) $('bal-m-rli').textContent = moneySigno(rli.baseImponible);
            var dif = Math.abs((b.sumasIguales && b.sumasIguales.debito || 0) - (b.sumasIguales && b.sumasIguales.credito || 0));
            if ($('bal-m-dif')) $('bal-m-dif').textContent = D.money(dif);
            if ($('bal-m-cuadratura')) $('bal-m-cuadratura').textContent = dif === 0 ? 'Cuadrado (Débitos = Créditos)' : 'Revisar cuadratura';
        }

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
            { glosa: '(-) Depreciación instantánea íntegra de activo fijo pagado en el ejercicio', monto: -rli.activoFijoPagadoNeto },
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
        var sinDatosPnl = !(m.ventas && m.ventas.documentos.length) && !(m.compras && m.compras.documentos.length) && !m.nomina && !(m.estado && m.estado.manuales && m.estado.manuales.length);
        if ($('pnl-vacio')) $('pnl-vacio').hidden = !sinDatosPnl;

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
            btnCierre.classList.toggle('periodo-cerrado', !!cerrado);
            btnCierre.innerHTML = '<span class="material-icons" aria-hidden="true">' + (cerrado ? 'lock_open' : 'lock') + '</span>' +
                (cerrado ? 'Reabrir período' : 'Cerrar período tributario');
        }
        var resumenRiel = $('riel-resumen-f29');
        if (resumenRiel) {
            resumenRiel.textContent = 'F29 cód. 91: ' + D.money(m.f29.codigos[91]) + ' · ' + (cerrado ? 'Cerrado' : 'En preparación');
        }
    }

    var MODULOS_VALIDOS = /^(torre|importador|remuneraciones|f29|ddjj|bancos|libros|balance|pnl|reportes)$/;

    function moduloDesdeUbicacion() {
        var hash = String(location.hash || '').replace(/^#/, '');
        if (MODULOS_VALIDOS.test(hash)) return hash;
        var modUrl = (/[?&]mod=(torre|importador|remuneraciones|f29|ddjj|bancos|libros|balance|pnl|reportes)/.exec(location.search) || [])[1];
        return modUrl || 'remuneraciones';
    }

    function cambiarModulo(mod, opts) {
        var modNorm = MODULOS_VALIDOS.test(mod) ? mod : 'remuneraciones';
        ui.modulo = modNorm;
        var mapPanes = {
            torre: $('suite-torre'),
            importador: $('suite-importador'),
            remuneraciones: $('suite-remuneraciones'),
            f29: $('suite-f29'),
            ddjj: $('suite-ddjj'),
            bancos: $('suite-bancos'),
            libros: $('suite-libros'),
            balance: $('suite-balance'),
            pnl: $('suite-pnl'),
            reportes: $('suite-reportes')
        };
        Object.keys(mapPanes).forEach(function (k) {
            if (mapPanes[k]) mapPanes[k].hidden = (k !== modNorm);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.suite-mod-btn'), function (b) {
            var act = b.getAttribute('data-modulo') === modNorm;
            b.classList.toggle('activo', act);
            b.setAttribute('aria-current', act ? 'page' : 'false');
        });
        if (!opts || !opts.sinHash) {
            var targetHash = '#' + modNorm;
            if (location.hash !== targetHash) {
                try { history.replaceState(null, '', targetHash); } catch (e) { location.hash = targetHash; }
            }
        }
        refrescarTodo();
    }

    function pintarEstadoPuentePyme(est) {
        var el = $('puente-pyme-estado');
        if (!el) return;
        var meta = est && est.paquetePymeMeta;
        if (!meta) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = 'Paquete Pyme (' + (meta.periodo || periodoActual()) + ') · ' +
            (meta.cobranzasCount || 0) + ' cobros · ' + (meta.pagosCount || 0) + ' pagos';
    }

    function importarPaquetePyme(textoJson) {
        var paquete;
        try {
            paquete = JSON.parse(textoJson);
        } catch (e) {
            D.avisar('El archivo seleccionado no es un JSON válido.');
            return;
        }
        if (!paquete || paquete.tipo !== 'paquete-colaborativo-pyme-contador') {
            D.avisar('Formato no reconocido. Sube el archivo paquete-contador-YYYY-MM.json exportado desde /app.');
            return;
        }

        if (paquete.empresa && paquete.empresa.razonSocial) {
            var cli = $('liq-cliente');
            if (cli) {
                cli.value = paquete.empresa.razonSocial;
                try { localStorage.setItem('cl-cliente-liq', cli.value); } catch (e) { }
                cli.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        if (paquete.empresa && paquete.empresa.rut && $('liq-rut-empresa')) {
            $('liq-rut-empresa').value = paquete.empresa.rut;
        }

        var selPeriodo = $('periodo');
        if (selPeriodo && paquete.periodo) {
            var tieneOpc = Array.prototype.some.call(selPeriodo.options, function (o) { return o.value === paquete.periodo; });
            if (tieneOpc && selPeriodo.value !== paquete.periodo) {
                selPeriodo.value = paquete.periodo;
                if ($('f29-periodo')) $('f29-periodo').value = paquete.periodo;
            }
        }

        if (leerEstadoActual().cerradoTributario) {
            D.avisar('El período ' + periodoActual() + ' está cerrado. Reábrelo para importar los datos de /app.');
            return;
        }

        var lab = paquete.resumenLaboral || {};
        var cobros = Array.isArray(paquete.cobranzas) ? paquete.cobranzas : [];
        var pagos = Array.isArray(paquete.pagos) ? paquete.pagos : [];
        var movs = Array.isArray(paquete.movimientosBancarios) ? paquete.movimientosBancarios : [];

        var totalCob = cobros.reduce(function (s, x) { return s + (Number(x && x.monto) || 0); }, 0);
        var pagadoCob = cobros.reduce(function (s, x) { return s + (x && x.pagada ? (Number(x.monto) || 0) : 0); }, 0);
        var pctCob = totalCob > 0 ? Math.round((pagadoCob / totalCob) * 100) : null;

        var totalPag = pagos.reduce(function (s, x) { return s + (Number(x && x.monto) || 0); }, 0);
        var pagadoPag = pagos.reduce(function (s, x) { return s + (x && x.pagada ? (Number(x.monto) || 0) : 0); }, 0);
        var pctPag = totalPag > 0 ? Math.round((pagadoPag / totalPag) * 100) : null;

        var saldoIni = null;
        if (movs.length) {
            var prim = movs[0];
            if (prim && typeof prim.saldo === 'number') {
                var mAmt = Number(prim.monto) || 0;
                saldoIni = Math.max(0, Math.round(prim.saldo + (prim.tipo === 'cargo' ? mAmt : -mAmt)));
            }
        }

        var anio = Number(String(paquete.periodo || periodoActual()).slice(0, 4)) || 2026;
        var tasaHon = (window.CLHonorarios && typeof window.CLHonorarios.tasa === 'function')
            ? window.CLHonorarios.tasa(anio)
            : 0.1525;

        guardarEstadoActual(function (est) {
            if (paquete.regimen && /^(14D3|14D3_MAYOR|14D8|14D8_MAYOR|14A)$/.test(paquete.regimen)) {
                est.regimen = paquete.regimen;
            }
            if (Number(lab.impuesto) > 0 && !resultadosNominaActiva().length) {
                est.iuscManual = String(Math.round(Number(lab.impuesto)));
            }
            if (Number(lab.retencion) > 0) {
                est.honorariosBruto = Math.round(Number(lab.retencion) / (tasaHon || 0.1525));
            }
            if (pctCob !== null) est.tesoreria.pctVentasCobradas = pctCob;
            if (pctPag !== null) est.tesoreria.pctComprasPagadas = pctPag;
            if (saldoIni !== null) est.tesoreria.saldoInicialBanco = saldoIni;
            est.paquetePymeMeta = {
                periodo: paquete.periodo || periodoActual(),
                generadoEn: paquete.generadoEn || '',
                cobranzasCount: cobros.length,
                pagosCount: pagos.length,
                movimientosCount: movs.length
            };
        });

        refrescarTodo();
        D.avisar('Paquete Pyme importado: ' + (paquete.empresa && paquete.empresa.razonSocial ? paquete.empresa.razonSocial : 'Empresa') + ' (' + (paquete.periodo || periodoActual()) + ').');
    }

    function cambiarACliente(nombre) {
        var limpio = String(nombre || '').trim();
        if (!limpio) return;
        var cli = $('liq-cliente');
        if (cli) cli.value = limpio;
        try { window.localStorage.setItem('cl-cliente-liq', limpio); } catch (e) { }
        var sel = $('liq-clientes-guardados');
        if (sel) {
            var existeOpc = Array.prototype.some.call(sel.options, function (o) { return o.value === limpio; });
            if (existeOpc) {
                sel.value = limpio;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
        document.dispatchEvent(new CustomEvent('demo:cliente', { detail: { cliente: limpio } }));
    }

    function pintarTorre(m) {
        var p = m.periodo;
        if ($('torre-periodo-badge')) $('torre-periodo-badge').textContent = p;
        var guardados = (window.CLClientes && window.CLClientes.listar) ? window.CLClientes.listar() : [];
        var almacen = leerTodoAlmacen();
        var porKey = {};

        function regCliente(nombre, filasCount, origen) {
            var nom = String(nombre || '').trim();
            if (!nom) return;
            var k = nom.toLowerCase();
            if (!porKey[k]) porKey[k] = { nombre: nom, trabajadores: 0, origen: origen };
            if (filasCount > porKey[k].trabajadores) porKey[k].trabajadores = filasCount;
        }

        regCliente(clienteNombre(), resultadosNominaActiva().length, 'activo');
        guardados.forEach(function (g) {
            regCliente(g.nombre, Array.isArray(g.filas) ? g.filas.length : 0, 'nomina');
        });
        Object.keys(almacen).forEach(function (k) {
            var parts = k.split('::');
            if (parts[0]) regCliente(parts[0], 0, 'suite');
        });

        var lista = Object.keys(porKey).sort().map(function (k) {
            var item = porKey[k];
            var st = almacen[k + '::' + p] || null;
            var reg = st && st.regimen ? st.regimen : '14D3';
            var cerrado = !!(st && st.cerradoTributario);
            var f29Total = 0;
            if (k === clienteClave()) {
                f29Total = m.f29.codigos[91] || 0;
                cerrado = !!m.estado.cerradoTributario;
                reg = m.estado.regimen;
            } else if (st && F29) {
                var v = st.ventasRows ? F29.parsearRcv(st.ventasRows, 'ventas') : F29.parsearRcv(st.ventasCsv || '', 'ventas');
                var c = st.comprasRows ? F29.parsearRcv(st.comprasRows, 'compras') : F29.parsearRcv(st.comprasCsv || '', 'compras');
                var f = F29.calcularF29({
                    periodo: p,
                    regimen: reg,
                    ventas: v,
                    compras: c,
                    remanenteAnterior: st.remanenteAnterior || 0,
                    postergarIva: !!st.postergarIva,
                    excluirSupermercado: !!st.excluirSupermercado,
                    tasaPpm: st.tasaPpmPersonalizada || '',
                    impuestoUnico48: st.iuscManual || 0,
                    honorariosBruto: st.honorariosBruto || 0,
                    honorariosRetencionDirecta: (st.honorariosRetencionDirecta > 0 || (Array.isArray(st.bheBoletas) && st.bheBoletas.length > 0))
                        ? st.honorariosRetencionDirecta
                        : ''
                });
                f29Total = f.codigos[91] || 0;
            }
            return {
                key: k,
                nombre: item.nombre,
                trabajadores: item.trabajadores,
                regimen: reg,
                cerrado: cerrado,
                f29Total: f29Total,
                esActivo: k === clienteClave()
            };
        });

        var cerrados = lista.filter(function (x) { return x.cerrado; }).length;
        var f29Sum = lista.reduce(function (s, x) { return s + x.f29Total; }, 0);
        if ($('nav-count-clientes')) $('nav-count-clientes').textContent = lista.length;
        if ($('torre-k-clientes')) $('torre-k-clientes').textContent = lista.length;
        if ($('torre-k-abiertos')) $('torre-k-abiertos').textContent = Math.max(0, lista.length - cerrados);
        if ($('torre-k-cerrados')) $('torre-k-cerrados').textContent = cerrados;
        if ($('torre-k-f29total')) $('torre-k-f29total').textContent = D.money(f29Sum);

        var tbody = $('tbody-torre-clientes');
        if (tbody) {
            tbody.innerHTML = lista.map(function (c) {
                var rutTxt = (window.CLDemoSii && window.CLDemoSii.rutDeCliente) ? window.CLDemoSii.rutDeCliente(c.nombre) : '';
                var siiCell = (window.CLDemoSii && window.CLDemoSii.celdaTorre)
                    ? window.CLDemoSii.celdaTorre(c, rutTxt)
                    : '<span class="sello sello-guardada">Modo CSV</span>';
                var esSyncActiva = (window.CLDemoSii && window.CLDemoSii.filaActivaSync && window.CLDemoSii.filaActivaSync(c, rutTxt));
                return '<tr' + (esSyncActiva ? ' class="fila-sii-activa"' : '') + '>' +
                    '<td><strong>' + D.esc(c.nombre) + '</strong>' + (c.esActivo ? ' <span class="app-nav-chip">En uso</span>' : '') + '</td>' +
                    '<td class="mono">' + (rutTxt ? D.esc(rutTxt) : '<span class="texto-ayuda">Sin RUT</span>') + '</td>' +
                    '<td class="mono">' + D.esc(c.regimen) + '</td>' +
                    '<td>' + siiCell + '</td>' +
                    '<td class="mono num">' + c.trabajadores + '</td>' +
                    '<td class="mono num">' + D.money(c.f29Total) + '</td>' +
                    '<td><span class="app-nav-chip ' + (c.cerrado ? '' : 'abierto') + '">' + (c.cerrado ? 'Cerrado' : 'Abierto') + '</span></td>' +
                    '<td class="num"><button type="button" class="btn btn-chico" data-torre-trabajar="' + D.esc(c.nombre) + '">' + (c.esActivo ? 'Activo' : 'Trabajar') + '</button></td>' +
                    '</tr>';
            }).join('');
        }
    }

    function pintarImportador(m) {
        var est = m.estado;
        var bhe = est.bheBoletas || [];
        var bruto = bhe.reduce(function (s, x) { return s + (x.bruto || 0); }, 0);
        var ret = bhe.reduce(function (s, x) { return s + (x.retenido || 0); }, 0);
        if ($('imp-bhe-vigentes')) $('imp-bhe-vigentes').textContent = bhe.length;
        if ($('imp-bhe-anuladas')) $('imp-bhe-anuladas').textContent = est.bheAnuladas || 0;
        if ($('imp-bhe-bruto')) $('imp-bhe-bruto').textContent = D.money(bruto);
        if ($('imp-bhe-retencion')) $('imp-bhe-retencion').textContent = D.money(ret);
        if ($('imp-bhe-alertas')) {
            $('imp-bhe-alertas').innerHTML = (est.bheAlertas || []).map(function (a) {
                return '<div class="texto-ayuda">' + D.esc(a.mensaje || a) + '</div>';
            }).join('');
        }
        if ($('tbody-imp-bhe')) {
            $('tbody-imp-bhe').innerHTML = bhe.length
                ? bhe.map(function (b) {
                    return '<tr><td class="mono">' + D.esc(b.folio) + '</td><td class="mono">' + D.esc(b.rut) + '</td><td>' + D.esc(b.razonSocial) + '</td><td class="mono num">' + D.money(b.bruto) + '</td><td class="mono num">' + D.money(b.retenido) + '</td><td class="mono num">' + D.money(b.liquido) + '</td></tr>';
                }).join('')
                : '<tr><td colspan="6" class="texto-ayuda">Sin boletas BHE cargadas aún. Sube el CSV del SII o carga el ejemplo (15,25%).</td></tr>';
        }

        var movs = est.cartolaMovimientos || [];
        if ($('imp-car-movs')) $('imp-car-movs').textContent = movs.length;
        if ($('imp-car-abonos')) $('imp-car-abonos').textContent = D.money(est.cartolaTotalAbonos || 0);
        if ($('imp-car-cargos')) $('imp-car-cargos').textContent = D.money(est.cartolaTotalCargos || 0);
        if ($('imp-car-saldo')) $('imp-car-saldo').textContent = est.cartolaUltimoSaldo != null ? D.money(est.cartolaUltimoSaldo) : '-';
        if ($('tbody-imp-cartola')) {
            $('tbody-imp-cartola').innerHTML = movs.length
                ? movs.map(function (mv) {
                    return '<tr><td class="mono">' + D.esc(mv.fecha) + '</td><td>' + D.esc(mv.glosa) + '</td><td class="cap">' + D.esc(mv.tipo) + '</td><td class="mono num">' + D.money(mv.monto) + '</td></tr>';
                }).join('')
                : '<tr><td colspan="4" class="texto-ayuda">Sin cartola bancaria importada aún.</td></tr>';
        }
    }

    function pintarPlanCuentas() {
        var tbody = $('tbody-plan-cuentas');
        if (!tbody || !C || !C.obtenerPlanCuentas) return;
        var lista = C.obtenerPlanCuentas();
        if ($('suite-plan-estado-txt')) {
            $('suite-plan-estado-txt').textContent = lista.length + ' cuentas activas · Cambios sincronizados en Diario, Mayor y Balance.';
        }
        tbody.innerHTML = lista.map(function (c) {
            return '<tr>' +
                '<td class="mono">' + D.esc(c.codigo) + '</td>' +
                '<td><input type="text" class="lq-input-plan" data-plan-nombre="' + D.esc(c.codigo) + '" value="' + D.esc(c.nombre) + '" aria-label="Nombre cuenta ' + D.esc(c.codigo) + '"></td>' +
                '<td class="cap">' + D.esc(c.tipo) + '</td>' +
                '<td class="mono">' + D.esc(c.grupo) + '</td>' +
                '<td class="num"><button type="button" class="btn btn-chico" data-plan-borrar="' + D.esc(c.codigo) + '">Quitar</button></td>' +
                '</tr>';
        }).join('');
    }

    function pintarDdjj(m) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-subddjj]'), function (btn) {
            var act = btn.getAttribute('data-subddjj') === ui.subDdjj;
            btn.classList.toggle('activo', act);
            btn.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        ['1887', '1879', '1947', 'cpt', 'f22'].forEach(function (k) {
            var pan = $('subddjj-' + k);
            if (pan) pan.hidden = (ui.subDdjj !== k);
        });
        pintarPropuestaF22(m);
        var d = m.ddjj || {};
        var barDdjj = $('ddjj-preval-bar');
        if (barDdjj) {
            var rutCli = (window.CLDemoSii && window.CLDemoSii.rutDeCliente && window.CLDemoSii.rutDeCliente(clienteNombre())) || ($('liq-rut-empresa') && $('liq-rut-empresa').value.trim()) || '';
            var tiene87 = d.dj1887 && Array.isArray(d.dj1887.filas) && d.dj1887.filas.length > 0;
            var tiene79 = d.dj1879 && Array.isArray(d.dj1879.filas) && d.dj1879.filas.length > 0;
            var faltantesDdjj = [];
            if (!rutCli) faltantesDdjj.push('RUT de empresa activo');
            if (!tiene87) faltantesDdjj.push('nómina calculada para DJ 1887 / Cert. N°6');
            if (!tiene79) faltantesDdjj.push('BHE o honorarios para DJ 1879 / Cert. N°1');
            if (!faltantesDdjj.length) {
                barDdjj.className = 'suite-preval-strip ok';
                barDdjj.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">check_circle</span><strong>Pre-validación DDJJ OK</strong><span>RUT empresa, sueldos y honorarios completos para emitir borradores.</span></span>';
            } else {
                barDdjj.className = 'suite-preval-strip warn';
                barDdjj.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">info</span><strong>Revisa antes de exportar DDJJ:</strong><span>falta ' + D.esc(faltantesDdjj.join(', ')) + '.</span></span>';
            }
        }
        if (d.dj1887 && d.dj1887.ok && $('tbody-dj1887')) {
            var filas87 = d.dj1887.filas || [];
            var t87 = d.dj1887.totales || {};
            $('tbody-dj1887').innerHTML = filas87.length
                ? filas87.map(function (f) {
                    return '<tr><td class="mono">' + D.esc(f.C2_rut) + '</td><td>' + D.esc(f.nombre) + '</td><td class="mono num">' + D.money(f.C3_rentaNeta) + '</td><td class="mono num">' + D.money(f.C4_impuestoUnico) + '</td><td class="mono num">' + D.money(f.C6_rentaNoGravada) + '</td><td class="mono num">' + D.money(f.C7_rentaExenta) + '</td></tr>';
                }).join('') +
                    '<tr class="fila-total"><td colspan="2"><strong>Totales DJ 1887</strong></td><td class="mono num"><strong>' + D.money(t87.rentaNeta || 0) + '</strong></td><td class="mono num"><strong>' + D.money(t87.impuestoUnico || 0) + '</strong></td><td class="mono num"><strong>' + D.money(t87.rentaNoGravada || 0) + '</strong></td><td class="mono num"><strong>' + D.money(t87.rentaExenta || 0) + '</strong></td></tr>'
                : '<tr><td colspan="6" class="texto-ayuda">Calcula liquidaciones en Nómina para poblar automáticamente la DJ 1887 con renta neta pagada.</td></tr>';
        }
        if (d.dj1879 && d.dj1879.ok && $('tbody-dj1879')) {
            var filas79 = d.dj1879.filas || [];
            var t79 = d.dj1879.totales || {};
            $('tbody-dj1879').innerHTML = filas79.length
                ? filas79.map(function (f) {
                    return '<tr><td class="mono">' + D.esc(f.rut) + '</td><td>' + D.esc(f.razonSocial) + '</td><td class="mono num">' + f.cantidadBoletas + '</td><td class="mono num">' + D.money(f.brutoTotal) + '</td><td class="mono num">' + D.money(f.retenidoTotal) + '</td><td class="mono num">' + D.num(f.tasaPromedioPct, 2) + '%</td></tr>';
                }).join('') +
                    '<tr class="fila-total"><td colspan="2"><strong>Totales DJ 1879</strong></td><td class="mono num"><strong>' + (t79.boletas || 0) + '</strong></td><td class="mono num"><strong>' + D.money(t79.brutoTotal || 0) + '</strong></td><td class="mono num"><strong>' + D.money(t79.retenidoTotal || 0) + '</strong></td><td class="mono num">' + D.num(t79.brutoTotal > 0 ? (t79.retenidoTotal / t79.brutoTotal) * 100 : 15.25, 2) + '%</td></tr>'
                : '<tr><td colspan="6" class="texto-ayuda">Importa tus boletas BHE SII o ingresa honorarios en F29 para poblar la DJ 1879.</td></tr>';
        }
        if (d.dj194x && d.dj194x.ok) {
            if ($('dj194x-titulo')) $('dj194x-titulo').textContent = 'DJ ' + d.dj194x.codigoDj + ' · Régimen ' + m.estado.regimen;
            var s0 = (m.estado.socios && m.estado.socios[0]) || {};
            if ($('ddjj-socios-rut') && document.activeElement !== $('ddjj-socios-rut')) $('ddjj-socios-rut').value = s0.rut || '12.345.678-5';
            if ($('ddjj-socios-nombre') && document.activeElement !== $('ddjj-socios-nombre')) $('ddjj-socios-nombre').value = s0.nombre || 'Socio titular';
            if ($('ddjj-socios-pct') && document.activeElement !== $('ddjj-socios-pct')) $('ddjj-socios-pct').value = s0.porcentaje != null ? s0.porcentaje : 100;
            if ($('ddjj-retiros-totales') && document.activeElement !== $('ddjj-retiros-totales')) $('ddjj-retiros-totales').value = s0.retiros || 0;
            if ($('tbody-dj194x')) {
                $('tbody-dj194x').innerHTML = (d.dj194x.filas || []).map(function (f) {
                    var monto = d.dj194x.codigoDj === '1947' ? f.baseImponibleAsignada : f.montoRetiroODividendo;
                    var cred = d.dj194x.codigoDj === '1947' ? f.creditoPpmAsignado : f.creditoIdpc;
                    return '<tr><td class="mono">' + D.esc(f.rutSocio) + '</td><td>' + D.esc(f.nombreSocio) + '</td><td class="mono num">' + f.porcentajeParticipacion + '%</td><td class="mono num">' + moneySigno(monto) + '</td><td class="mono num">' + D.money(cred) + '</td></tr>';
                }).join('');
            }
        }
        if (d.cpt && $('tbody-cpt')) {
            var comp = d.cpt.componentes || {};
            var ca = m.estado.cptAjustes || {};
            if ($('cpt-anterior') && document.activeElement !== $('cpt-anterior')) $('cpt-anterior').value = ca.cptAnterior || 0;
            if ($('cpt-aumentos') && document.activeElement !== $('cpt-aumentos')) $('cpt-aumentos').value = ca.aumentosCapital || 0;
            if ($('cpt-disminuciones') && document.activeElement !== $('cpt-disminuciones')) $('cpt-disminuciones').value = ca.disminucionesCapital || 0;
            if ($('cpt-retiros') && document.activeElement !== $('cpt-retiros')) $('cpt-retiros').value = ca.retirosDividendos || 0;
            if ($('cpt-rechazados') && document.activeElement !== $('cpt-rechazados')) $('cpt-rechazados').value = ca.gastosRechazados || 0;
            if ($('cpt-idpc') && document.activeElement !== $('cpt-idpc')) $('cpt-idpc').value = ca.idpcPagado || 0;
            if ($('cpt-cap-aportado') && document.activeElement !== $('cpt-cap-aportado')) $('cpt-cap-aportado').value = ca.capitalAportadoReajustado || 0;

            $('tbody-cpt').innerHTML = [
                ['(+) CPT inicial del ejercicio anterior', comp.cptAnterior],
                ['(+) Aumentos efectivos de capital', comp.aumentosCapital],
                ['(+/-) Base imponible o RLI del período', comp.baseImponibleRli],
                ['(-) Disminuciones formales de capital', -comp.disminucionesCapital],
                ['(-) Retiros o dividendos distribuidos', -comp.retirosDividendos],
                ['(-) Gastos rechazados no afectos Art. 21', -comp.gastosRechazados],
                ['(-) IDPC pagado en el ejercicio', -comp.idpcPagado]
            ].map(function (r) {
                return '<tr><td>' + r[0] + '</td><td class="mono num">' + moneySigno(r[1]) + '</td></tr>';
            }).join('') +
                '<tr class="fila-total"><td><strong>(=) Capital Propio Tributario Simplificado de cierre</strong></td><td class="mono num"><strong>' + moneySigno(d.cpt.cptFinal) + '</strong></td></tr>' +
                '<tr><td>RAI estimado (sobre capital aportado reajustado)</td><td class="mono num">' + D.money(d.cpt.raiEstimado) + '</td></tr>';
        }
    }

    function pintarConciliacionYAgenda(m) {
        if (!$('sub-conciliacion')) return;
        var est = m.estado;
        var bloqueado = !!est.cerradoTributario;
        var conc = m.conciliacion || { filas: [], resumen: { totalMovimientos: 0, pctConciliado: 0 } };
        var aging = m.aging || { cxc: { total: 0, buckets: { dias_0_30: 0, dias_31_60: 0, dias_mas_60: 0 }, items: [] }, cxp: { total: 0, buckets: { dias_0_30: 0, dias_31_60: 0, dias_mas_60: 0 }, items: [] } };

        if ($('conc-k-movs')) $('conc-k-movs').textContent = conc.resumen.totalMovimientos;
        if ($('conc-k-pct')) $('conc-k-pct').textContent = conc.resumen.pctConciliado + '%';
        if ($('conc-k-cxc')) $('conc-k-cxc').textContent = D.money(aging.cxc.total);
        if ($('conc-k-cxp')) $('conc-k-cxp').textContent = D.money(aging.cxp.total);

        if ($('conc-reglas-lista')) {
            var reglasUsr = Array.isArray(est.reglasConciliacion) ? est.reglasConciliacion : [];
            var chipsUsr = reglasUsr.map(function (r) {
                return '<span class="suite-regla-chip">' +
                    '<span class="suite-regla-chip-tipo">' + D.esc(r.tipo || 'ambos') + '</span>' +
                    '<span>"' + D.esc(r.patron) + '" → ' + D.esc(r.cuenta) + (r.motivo ? ' · ' + D.esc(r.motivo) : '') + '</span>' +
                    (bloqueado ? '' : '<button type="button" class="suite-regla-chip-del" data-regla-del="' + D.esc(r.id) + '" aria-label="Eliminar regla">×</button>') +
                    '</span>';
            }).join('');
            var chipsDef = (Pro ? Pro.REGLAS_CONCILIACION_DEFECTO : []).map(function (r) {
                return '<span class="suite-regla-chip" title="Regla integrada del sistema">' +
                    '<span class="suite-regla-chip-tipo">' + D.esc(r.tipo) + '</span>' +
                    '<span>' + D.esc(r.motivo) + ' (' + D.esc(r.cuenta) + ')</span>' +
                    '</span>';
            }).join('');
            $('conc-reglas-lista').innerHTML = chipsUsr + chipsDef;
        }

        if ($('tbody-conciliacion')) {
            $('tbody-conciliacion').innerHTML = conc.filas.length
                ? conc.filas.map(function (f) {
                    var badgeHtml = '';
                    if (f.matchTipo === 'A') badgeHtml = '<span class="sello-match-a"><span class="material-icons" aria-hidden="true">verified</span>Match A · RUT + Monto</span>';
                    else if (f.matchTipo === 'B') badgeHtml = '<span class="sello-match-b"><span class="material-icons" aria-hidden="true">help_outline</span>Sugerencia B · Monto</span>';
                    else if (f.matchTipo === 'C') badgeHtml = '<span class="sello-match-c"><span class="material-icons" aria-hidden="true">layers</span>Match C · Agrupado</span>';
                    else if (f.metodo === 'regla') badgeHtml = '<span class="conc-pill conc-pill-regla">Regla auto</span>';
                    else badgeHtml = '<span class="conc-pill conc-pill-pend">Sin match</span>';

                    var accionHtml = '';
                    if (f.estado === 'sugerido') {
                        accionHtml = '<div class="match-acciones-fila">' +
                            '<button type="button" class="btn btn-chico btn-primario btn-match-confirmar" data-match-confirmar="' + D.esc(f.id) + '"><span class="material-icons" aria-hidden="true">check</span>Confirmar</button>' +
                            '<button type="button" class="btn-texto btn-match-descartar" data-match-descartar="' + D.esc(f.id) + '">Descartar</button>' +
                            '</div>';
                    } else if (f.estado === 'conciliado') {
                        accionHtml = '<span class="conc-pill conc-pill-ok">Conciliado</span>';
                    } else {
                        accionHtml = '<span class="conc-pill conc-pill-pend">Pendiente</span>';
                    }

                    return '<tr>' +
                        '<td class="mono">' + D.esc(f.fecha || '-') + '</td>' +
                        '<td>' + D.esc(f.glosa || '-') + '</td>' +
                        '<td class="cap">' + D.esc(f.tipo) + '</td>' +
                        '<td class="mono num">' + D.money(f.monto) + '</td>' +
                        '<td>' + badgeHtml + '<div class="texto-ayuda" style="margin-top:3px">' + D.esc(f.detalleMatch) + '</div></td>' +
                        '<td class="mono">' + D.esc(f.cuenta) + '</td>' +
                        '<td>' + accionHtml + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="7" class="texto-ayuda">Sin movimientos bancarios aún. Haz clic en "Subir Cartola CSV" o "Cargar cartola ejemplo".</td></tr>';
        }

        function renderFilasCartera(lista, tipoCartera, msgVacio) {
            if (!lista || !lista.length) {
                return '<tr><td colspan="5" class="texto-ayuda">' + D.esc(msgVacio) + '</td></tr>';
            }
            return lista.slice(0, 20).map(function (it) {
                var pagada = it.saldoPendiente <= 0;
                var selloCls = pagada ? 'sello-emitida' : 'sello-preparada';
                var selloTxt = it.estadoPago === 'CONCILIADA'
                    ? 'Bancos'
                    : (pagada ? 'Pagada' : 'Pendiente');
                var nextEst = pagada ? 'PENDIENTE' : 'PAGADA';
                var btnTxt = pagada ? 'Reabrir' : 'Marcar pagada';
                return '<tr>' +
                    '<td>DTE ' + D.esc(it.tipoDoc) + ' #' + D.esc(it.folio) + '<br><span class="texto-ayuda">' + D.esc(it.razonSocial) + ' · <span class="mono">' + D.esc(it.rut || '-') + '</span></span></td>' +
                    '<td class="mono">' + it.dias + 'd (' + D.esc(it.tramo) + ')</td>' +
                    '<td class="mono num">' + D.money(it.saldoPendiente) + (pagada ? '<br><span class="texto-ayuda">Orig. ' + D.money(it.montoOriginal) + '</span>' : '') + '</td>' +
                    '<td><span class="sello ' + selloCls + '">' + selloTxt + '</span></td>' +
                    '<td class="num"><button type="button" class="btn btn-chico btn-cartera-toggle" data-cartera-tipo="' + tipoCartera + '" data-cartera-key="' + D.esc(it.docKey) + '" data-cartera-next="' + nextEst + '">' + btnTxt + '</button></td>' +
                    '</tr>';
            }).join('');
        }

        if ($('aging-cxc-buckets')) {
            var bc = aging.cxc.buckets;
            $('aging-cxc-buckets').textContent = '0-30d: ' + D.money(bc.dias_0_30) + ' · 31-60d: ' + D.money(bc.dias_31_60) + ' · +60d: ' + D.money(bc.dias_mas_60);
        }
        if ($('tbody-aging-cxc')) {
            var listaCxc = aging.cxc.todosItems || aging.cxc.items || [];
            $('tbody-aging-cxc').innerHTML = renderFilasCartera(listaCxc, 'cxc', 'Sin facturas CxC en este período.');
        }

        if ($('aging-cxp-buckets')) {
            var bp = aging.cxp.buckets;
            $('aging-cxp-buckets').textContent = '0-30d: ' + D.money(bp.dias_0_30) + ' · 31-60d: ' + D.money(bp.dias_31_60) + ' · +60d: ' + D.money(bp.dias_mas_60);
        }
        if ($('tbody-aging-cxp')) {
            var listaCxp = aging.cxp.todosItems || aging.cxp.items || [];
            $('tbody-aging-cxp').innerHTML = renderFilasCartera(listaCxp, 'cxp', 'Sin facturas CxP en este período.');
        }

        Array.prototype.forEach.call(document.querySelectorAll('#sub-conciliacion input, #sub-conciliacion select, #btn-regla-agregar, #btn-conc-centralizar, #btn-bancos-subir-cartola, #btn-bancos-ejemplo, .btn-match-confirmar, .btn-match-descartar, .btn-cartera-toggle'), function (el) {
            el.disabled = bloqueado;
        });
    }

    function pintarActivoFijo(m) {
        if (!$('sub-activo-fijo')) return;
        var est = m.estado;
        var bloqueado = !!est.cerradoTributario;
        var af = m.activoFijo || { esProPyme: true, totalBaseDepreciable: 0, totalDepreciacionTributaria: 0, totalDiferenciaDdan: 0, items: [], notaNormativa: '' };

        if ($('af-norma-txt') && af.notaNormativa) $('af-norma-txt').textContent = af.notaNormativa;
        if ($('af-k-base')) $('af-k-base').textContent = D.money(af.totalBaseDepreciable);
        if ($('af-k-trib')) $('af-k-trib').textContent = D.money(af.totalDepreciacionTributaria);
        if ($('af-k-ddan')) $('af-k-ddan').textContent = D.money(af.totalDiferenciaDdan);
        var libroTotal = (af.items || []).reduce(function (s, it) { return s + (it.valorLibroCierre || 0); }, 0);
        if ($('af-k-libro')) $('af-k-libro').textContent = D.money(libroTotal);

        if ($('af-mod14a')) {
            $('af-mod14a').disabled = bloqueado || af.esProPyme;
            $('af-mod14a').title = af.esProPyme ? 'En ProPyme 14 D3 / 14 D8 aplica depreciación instantánea del 100%.' : '';
        }

        if ($('tbody-activo-fijo')) {
            $('tbody-activo-fijo').innerHTML = af.items.length
                ? af.items.map(function (it) {
                    return '<tr>' +
                        '<td><strong>' + D.esc(it.descripcion) + '</strong><br><span class="texto-ayuda">' + D.esc(it.observacion) + '</span></td>' +
                        '<td>' + D.esc(it.metodoAplicado) + '</td>' +
                        '<td class="mono num">' + D.money(it.baseDepreciable) + '</td>' +
                        '<td class="mono num">' + D.money(it.depreciacionTributaria) + '</td>' +
                        '<td class="mono num">' + D.money(it.diferenciaDdan) + '</td>' +
                        '<td class="mono num">' + D.money(it.valorLibroCierre) + '</td>' +
                        '<td class="num">' + (bloqueado ? '-' : '<button type="button" class="btn btn-chico" data-af-borrar="' + D.esc(it.id) + '">Quitar</button>') + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="7" class="texto-ayuda">Sin bienes registrados. Usa "Importar desde RCV" o agrega un bien arriba.</td></tr>';
        }

        Array.prototype.forEach.call(document.querySelectorAll('#sub-activo-fijo input, #btn-af-agregar, #btn-af-importar-rcv, #btn-af-asiento-diario'), function (el) {
            el.disabled = bloqueado;
        });
    }

    function pintarPropuestaF22(m) {
        if (!$('subddjj-f22')) return;
        var est = m.estado;
        var f22 = m.f22;
        if (!f22) return;

        var aj = est.f22Ajustes || {};
        if ($('f22-ppm-anual') && document.activeElement !== $('f22-ppm-anual')) {
            $('f22-ppm-anual').value = aj.ppmManual !== '' && aj.ppmManual != null ? aj.ppmManual : '';
        }
        if ($('f22-factor-ppm') && document.activeElement !== $('f22-factor-ppm')) {
            $('f22-factor-ppm').value = aj.factorPpm || 1.018;
        }
        if ($('f22-otros-creditos') && document.activeElement !== $('f22-otros-creditos')) {
            $('f22-otros-creditos').value = aj.otrosCreditos || 0;
        }

        if ($('f22-norma-txt')) $('f22-norma-txt').textContent = f22.notaNormativa;
        if ($('f22-fuente-tasa')) $('f22-fuente-tasa').textContent = 'AT ' + f22.anioTributario + ' · ' + f22.fuenteTasa;
        if ($('f22-k-rli')) $('f22-k-rli').textContent = moneySigno(f22.baseImponibleRli);
        if ($('f22-k-idpc-lbl')) $('f22-k-idpc-lbl').textContent = 'IDPC determinado (' + D.num(f22.tasaIdpc, 1) + '%)';
        if ($('f22-k-idpc')) $('f22-k-idpc').textContent = D.money(f22.idpcDeterminado);
        if ($('f22-k-ppm36')) {
            $('f22-k-ppm36').textContent = f22.esTransparente
                ? D.money(f22.ppmDj1947Socios) + ' (DJ 1947)'
                : D.money(f22.ppmCod36Empresa);
        }
        if ($('f22-k-saldo-lbl')) {
            $('f22-k-saldo-lbl').textContent = f22.esTransparente
                ? 'IDPC empresa (14 D N°8)'
                : (f22.saldoAPagar > 0 ? 'Impuesto F22 a pagar' : 'Devolución PPM estimada');
        }
        if ($('f22-k-saldo')) {
            $('f22-k-saldo').textContent = f22.esTransparente
                ? '$0'
                : D.money(f22.saldoAPagar > 0 ? f22.saldoAPagar : f22.devolucionF22);
        }

        if ($('tbody-f22')) {
            $('tbody-f22').innerHTML = (f22.lineasF22 || []).map(function (ln) {
                var cls = ln.destacado === 'pagar' ? ' class="f22-fila-pagar"' : (ln.destacado === 'devolucion' ? ' class="f22-fila-devolucion"' : '');
                return '<tr' + cls + '>' +
                    '<td class="mono">' + D.esc(ln.codigo) + '</td>' +
                    '<td>' + D.esc(ln.concepto) + '</td>' +
                    '<td class="mono num">' + moneySigno(ln.monto) + '</td>' +
                    '</tr>';
            }).join('');
        }
    }

    function pintarReportes(m) {
        var mb = leerMembrete();
        if ($('rep-estudio-nombre') && document.activeElement !== $('rep-estudio-nombre')) $('rep-estudio-nombre').value = mb.estudio;
        if ($('rep-estudio-rut') && document.activeElement !== $('rep-estudio-rut')) $('rep-estudio-rut').value = mb.rut;
        if ($('rep-contador-nombre') && document.activeElement !== $('rep-contador-nombre')) $('rep-contador-nombre').value = mb.contador;
        if ($('rep-estudio-pie') && document.activeElement !== $('rep-estudio-pie')) $('rep-estudio-pie').value = mb.pie;
        if ($('rep-preview-box')) {
            $('rep-preview-box').innerHTML = '<div><strong>' + D.esc(mb.estudio) + '</strong> · RUT ' + D.esc(mb.rut) + '</div>' +
                '<div>Responsable: ' + D.esc(mb.contador) + ' · Cliente activo: <strong>' + D.esc(clienteNombre()) + '</strong></div>' +
                '<div class="texto-ayuda" style="margin-top:4px">' + D.esc(mb.pie) + '</div>';
        }
        var boxWa = $('rep-whatsapp-preview');
        var txtWa = $('rep-whatsapp-texto');
        if (boxWa && txtWa && Pro) {
            var modelo = m || calcularModelo();
            var mensaje = generarTextoWhatsapp(modelo);
            if (mensaje) {
                boxWa.hidden = false;
                txtWa.textContent = mensaje;
            } else {
                boxWa.hidden = true;
            }
        }
    }

    function refrescarTodo() {
        var est = leerEstadoActual();
        pintarIdentidadCliente();
        pintarEstadoPuentePyme(est);
        var m = calcularModelo();
        pintarEstadoCierre(m);
        pintarTorre(m);
        pintarImportador(m);
        pintarF29(m);
        pintarDdjj(m);
        pintarBancos(m);
        pintarLibros(m);
        pintarBalance(m);
        pintarPnl(m);
        pintarReportes(m);
        document.dispatchEvent(new CustomEvent('suite:refrescado', { detail: m }));
    }

    window.CLSuiteSiiBridge = {
        clienteNombre: clienteNombre,
        clienteClave: clienteClave,
        periodoActual: periodoActual,
        leerEstadoActual: leerEstadoActual,
        guardarEstadoActual: guardarEstadoActual,
        guardarEstadoParaCliente: guardarEstadoParaCliente,
        cambiarACliente: cambiarACliente,
        cambiarModulo: cambiarModulo,
        calcularModelo: calcularModelo,
        refrescarTodo: refrescarTodo
    };

    // ------------------------------------------------------------- Exportaciones e Impresion
    function imprimirHtmlModulo(titulo, subtitulo, tablaHtml, notaExtra, opts) {
        opts = opts || {};
        var mb = leerMembrete();
        var estInfo = D && D.estudio ? D.estudio() : {};
        var logoHtml = estInfo.logo ? '<img src="' + estInfo.logo + '" alt="">' : '';
        var memHtml = '<div class="print-membrete-estudio">' +
            '<div>' + logoHtml + '<strong>' + D.esc(mb.estudio) + '</strong><br><span>RUT ' + D.esc(mb.rut) + ' · ' + D.esc(mb.contador) + '</span></div>' +
            '<div class="print-meta"><span>Cliente: <strong>' + D.esc(clienteNombre()) + '</strong><br>Período: ' + D.esc(periodoActual()) + ' · Emitido el ' + D.esc(D.hoy()) + '</span></div>' +
            '</div>';
        var pieHtml = '<div class="print-pie-estudio"><span>' + D.esc(mb.pie || 'Documento de trabajo tributario.') + '</span><span>Emitido con CálculoLaboral · Suite Contadores</span></div>';
        var bloques = Array.isArray(opts.paginas)
            ? opts.paginas
            : [{ html: tablaHtml, titulo: titulo, subtitulo: subtitulo, paisa: !!opts.paisa, nota: notaExtra }];
        var pags = bloques.map(function (b) {
            var t = b.titulo || titulo;
            var sub = b.subtitulo !== undefined ? b.subtitulo : subtitulo;
            var nota = b.nota !== undefined ? b.nota : notaExtra;
            return '<div class="print-page' + (b.paisa ? ' print-page--paisa' : '') + '">' +
                memHtml +
                '<div class="print-title">' + D.esc(t) + '</div>' +
                '<div class="print-sub">' + D.esc(clienteNombre()) + ' · Período ' + D.esc(periodoActual()) + (sub ? ' · ' + D.esc(sub) : '') + '</div>' +
                b.html +
                (nota ? '<div class="print-note">' + D.esc(nota) + '</div>' : '') +
                pieHtml +
                '</div>';
        });
        D.imprimir(pags);
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

        if ($('btn-ctx-indicadores')) {
            $('btn-ctx-indicadores').addEventListener('click', function () {
                cambiarModulo('remuneraciones');
                var radLiq = document.querySelector('input[name="modo"][value="liquidaciones"]');
                if (radLiq && !radLiq.checked) { radLiq.checked = true; radLiq.dispatchEvent(new Event('change')); }
                if ($('liq-uf')) { $('liq-uf').focus(); $('liq-uf').select(); }
            });
        }
        if ($('btn-pnl-ir-f29')) $('btn-pnl-ir-f29').addEventListener('click', function () { cambiarModulo('f29'); });
        if ($('btn-pnl-ir-nomina')) $('btn-pnl-ir-nomina').addEventListener('click', function () { cambiarModulo('remuneraciones'); });

        // Navegacion de modulos
        Array.prototype.forEach.call(document.querySelectorAll('.suite-mod-btn'), function (btn) {
            btn.addEventListener('click', function () {
                cambiarModulo(btn.getAttribute('data-modulo'));
            });
        });

        // Teclado WAI-ARIA en pestañas internas (.fin-filtros[role="tablist"]) y dropzones
        document.addEventListener('keydown', function (ev) {
            var dz = ev.target && ev.target.classList && ev.target.classList.contains('fin-dropzone') ? ev.target : null;
            if (dz && (ev.key === 'Enter' || ev.key === ' ')) {
                ev.preventDefault();
                dz.click();
                return;
            }
            var tab = ev.target && ev.target.getAttribute && ev.target.getAttribute('role') === 'tab' ? ev.target : null;
            if (!tab) return;
            var list = tab.closest('[role="tablist"]');
            if (!list) return;
            var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
            var idx = tabs.indexOf(tab);
            if (idx < 0) return;
            var next = -1;
            if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (idx + 1) % tabs.length;
            else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
            else if (ev.key === 'Home') next = 0;
            else if (ev.key === 'End') next = tabs.length - 1;
            if (next >= 0) {
                ev.preventDefault();
                tabs[next].focus();
                tabs[next].click();
            }
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

        function cargarEjemploCompleto(opts) {
            var o = opts || {};
            if (leerEstadoActual().cerradoTributario) { D.avisar('Reabre el período antes de cargar el ejemplo completo.'); return; }
            var cli = $('liq-cliente');
            if (cli && !cli.value.trim()) {
                cli.value = 'Panadería San Isidro SpA';
                try { localStorage.setItem('cl-cliente-liq', cli.value); } catch (e) { }
            }
            var rutEmp = $('liq-rut-empresa');
            if (rutEmp && !rutEmp.value.trim()) rutEmp.value = '76.543.210-3';
            var comEmp = $('liq-comuna');
            if (comEmp && !comEmp.value.trim()) comEmp.value = 'Santiago';
            if ($('liq-rut') && !$('liq-rut').value.trim()) $('liq-rut').value = '76.543.210-3';
            if (window.CLDemoSii && window.CLDemoSii.guardarRutCliente && cli && cli.value.trim()) {
                window.CLDemoSii.guardarRutCliente(cli.value.trim(), '76.543.210-3');
            }

            if (window.CLDemoLiquidaciones && window.CLDemoLiquidaciones.cargarEjemplo) {
                window.CLDemoLiquidaciones.cargarEjemplo();
            } else if ($('btn-sample-liq')) {
                $('btn-sample-liq').click();
            }
            if ($('btn-sample-fin')) $('btn-sample-fin').click();

            var per = periodoActual();
            var bheParsed = Imp ? Imp.parsearBheSii(Imp.ejemploBheCsv(per), { periodo: per }) : null;
            var carParsed = Imp ? Imp.parsearCartola(Imp.ejemploCartolaCsv(per), { periodo: per }) : null;

            guardarEstadoActual(function (est) {
                est.ventasCsv = F29.ejemploRcvVentasCsv();
                est.ventasRows = null;
                est.ventasArchivo = 'RCV_Ventas_SII_ejemplo.csv';
                est.comprasCsv = F29.ejemploRcvComprasCsv();
                est.comprasRows = null;
                est.comprasArchivo = 'RCV_Compras_SII_ejemplo.csv';
                est.remanenteAnterior = 120000;
                est.tesoreria.saldoInicialBanco = 6500000;
                if (bheParsed && bheParsed.ok) {
                    est.bheBoletas = bheParsed.boletas;
                    est.bheAnuladas = bheParsed.anuladasOmitidas;
                    est.bheAlertas = bheParsed.advertencias;
                    est.honorariosBruto = bheParsed.totalBruto;
                    est.honorariosRetencionDirecta = bheParsed.codigo151;
                } else {
                    est.honorariosBruto = 800000;
                    est.honorariosRetencionDirecta = '';
                }
                if (carParsed && carParsed.ok) {
                    est.cartolaMovimientos = carParsed.movimientos;
                    est.cartolaTotalAbonos = carParsed.totalAbonos;
                    est.cartolaTotalCargos = carParsed.totalCargos;
                    est.cartolaUltimoSaldo = carParsed.ultimoSaldo;
                }
                if (!est.comprasPendientesAcuse || !est.comprasPendientesAcuse.length) {
                    est.comprasPendientesAcuse = [
                        {
                            id: '33-4512-76111222-3',
                            tipoDoc: 33,
                            folio: 4512,
                            rut: '76.111.222-3',
                            razonSocial: 'Insumos Panaderos Ltda.',
                            fechaRecepcion: per + '-15',
                            diasRestantes: 2,
                            estadoPlazo: 'critico',
                            iva: 190000,
                            total: 1190000
                        },
                        {
                            id: '33-8891-77222333-4',
                            tipoDoc: 33,
                            folio: 8891,
                            rut: '77.222.333-4',
                            razonSocial: 'Servicios Eléctricos del Sur SpA',
                            fechaRecepcion: per + '-17',
                            diasRestantes: 5,
                            estadoPlazo: 'proximo',
                            iva: 85500,
                            total: 535500
                        }
                    ];
                }
            });

            if ($('btn-af-importar-rcv')) $('btn-af-importar-rcv').click();
            refrescarTodo();
            if (!o.silencioso) {
                D.avisar('Ejemplo completo cargado en todos los módulos (Nómina, Finiquitos, F29, BHE, Bancos, Balance, P&L y DDJJ).');
            }
        }
        if ($('btn-cargar-ejemplo-todo')) {
            $('btn-cargar-ejemplo-todo').addEventListener('click', function () { cargarEjemploCompleto(); });
        }
        if (/[?&]demo=1/.test(location.search) && !/[?&]tab=/.test(location.search)) {
            setTimeout(function () { cargarEjemploCompleto({ silencioso: true }); }, 40);
        }

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
                    est.bheBoletas = [];
                    est.bheAlertas = [];
                    est.honorariosBruto = 800000;
                    est.honorariosRetencionDirecta = '';
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
                if (id === 'f29-tasa-ppm') {
                    var tVal = el.value.trim() === '' ? 0 : (D.parseDecimal ? D.parseDecimal(el.value) : D.parseNumber(el.value));
                    var errPpm = $('f29-tasa-ppm-err');
                    if (tVal < 0 || tVal > 10) {
                        el.setAttribute('aria-invalid', 'true');
                        if (errPpm) { errPpm.hidden = false; errPpm.textContent = 'Ingresa una tasa PPM entre 0% y 10%.'; }
                        return;
                    }
                    el.removeAttribute('aria-invalid');
                    if (errPpm) { errPpm.hidden = true; errPpm.textContent = ''; }
                }
                guardarEstadoActual(function (est) {
                    if (id === 'f29-remanente') est.remanenteAnterior = Math.max(0, Math.round(D.parseNumber(el.value)));
                    if (id === 'f29-tasa-ppm') est.tasaPpmPersonalizada = el.value.trim() === '' ? '' : (D.parseDecimal ? D.parseDecimal(el.value) : D.parseNumber(el.value));
                    if (id === 'f29-iusc-manual') est.iuscManual = el.value;
                    if (id === 'f29-hon-bruto') {
                        est.honorariosBruto = Math.max(0, Math.round(D.parseNumber(el.value)));
                        est.honorariosRetencionDirecta = '';
                    }
                });
                refrescarTodo();
            });
        });

        // Asistente Reajuste UTM (Cód. 77 -> Cód. 504)
        function alternarUtmCard(abrir) {
            var card = $('f29-asistente-utm-card');
            var btn = $('btn-f29-asistente-utm');
            if (!card) return;
            var mostrar = typeof abrir === 'boolean' ? abrir : card.hidden;
            card.hidden = !mostrar;
            if (btn) btn.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
            if (mostrar) {
                actualizarPreviewUtmCard();
                if ($('utm-calc-rem-ant') && !$('utm-calc-rem-ant').value) {
                    $('utm-calc-rem-ant').focus();
                }
            }
        }
        if ($('btn-f29-asistente-utm')) $('btn-f29-asistente-utm').addEventListener('click', function () { alternarUtmCard(); });
        if ($('btn-cerrar-asistente-utm')) $('btn-cerrar-asistente-utm').addEventListener('click', function () { alternarUtmCard(false); });
        ['utm-calc-rem-ant', 'utm-val-ant', 'utm-val-act'].forEach(function (id) {
            if ($(id)) $(id).addEventListener('input', function () {
                if (id === 'utm-val-act') $(id).dataset.editadoManual = '1';
                actualizarPreviewUtmCard();
            });
        });
        if ($('btn-utm-aplicar')) {
            $('btn-utm-aplicar').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
                var res = actualizarPreviewUtmCard();
                if (!res || !res.reajustado) { D.avisar('Ingresa el remanente del período anterior y ambas UTM.'); return; }
                guardarEstadoActual(function (est) {
                    est.remanente77MesAnterior = Math.max(0, Math.round(D.parseNumber($('utm-calc-rem-ant').value)));
                    est.utmMesPresentacionAnterior = Math.round(D.parseNumber($('utm-val-ant').value)) || '';
                    est.utmMesPresentacionActual = Math.round(D.parseNumber($('utm-val-act').value)) || '';
                    est.remanenteAnterior = res.reajustado;
                });
                alternarUtmCard(false);
                refrescarTodo();
                D.avisar('Remanente reajustado (' + D.num(res.utm, 2) + ' UTM = ' + D.money(res.reajustado) + ') aplicado al Código 504.');
            });
        }

        // Postergación pago IVA (Cód. 756)
        if ($('f29-check-postergacion')) {
            $('f29-check-postergacion').addEventListener('change', function () {
                if (leerEstadoActual().cerradoTributario) {
                    $('f29-check-postergacion').checked = !!leerEstadoActual().postergarIva;
                    D.avisar('El período está cerrado tributariamente.');
                    return;
                }
                guardarEstadoActual(function (est) {
                    est.postergarIva = !!$('f29-check-postergacion').checked;
                });
                refrescarTodo();
            });
        }

        // Auditoría preventiva Compras RCV (Acuse 8 días + Supermercado Cód. 761)
        var acuseActivo = null;
        var TEXTOS_ACUSE = {
            ERM: {
                ayuda: 'Habilita el uso del crédito fiscal IVA en el período actual, impide reclamar después y otorga mérito ejecutivo a la factura (Ley 19.983).',
                alerta: 'Acción irreversible: habilita el uso del crédito fiscal IVA en el período actual, impide reclamar la factura (RCD/RFP/RFT) y la deja apta para cesión y mérito ejecutivo.'
            },
            ACD: {
                ayuda: 'Acepta el contenido del documento e impide reclamar después, pero NO habilita el crédito fiscal por sí solo.',
                alerta: 'Acción irreversible: ya no podrás reclamar esta factura (RCD/RFP/RFT). Ojo: ACD por sí solo NO habilita el crédito fiscal IVA; el DTE seguirá en Pendientes hasta que otorgues ERM o venzan los 8 días corridos.'
            },
            RCD: {
                ayuda: 'Rechaza contenido, montos o glosas del documento. Anula derecho a crédito fiscal IVA.',
                alerta: 'Acción irreversible para el crédito fiscal: la factura pasará a Reclamados, NO dará derecho a crédito fiscal IVA y no podrás aceptarla ni otorgar recibo (ACD/ERM) después.'
            },
            RFP: {
                ayuda: 'Reclama entrega parcial de mercaderías o servicios. Anula derecho a crédito fiscal IVA.',
                alerta: 'Acción irreversible para el crédito fiscal: la factura pasará a Reclamados, NO dará derecho a crédito fiscal IVA y no podrás aceptarla ni otorgar recibo (ACD/ERM) después.'
            },
            RFT: {
                ayuda: 'Reclama falta total de mercaderías o servicios. Anula derecho a crédito fiscal IVA.',
                alerta: 'Acción irreversible para el crédito fiscal: la factura pasará a Reclamados, NO dará derecho a crédito fiscal IVA y no podrás aceptarla ni otorgar recibo (ACD/ERM) después.'
            }
        };

        function actualizarTextosAcuseDlg() {
            var acc = ($('acuse-dlg-accion') && $('acuse-dlg-accion').value) || 'ERM';
            var info = TEXTOS_ACUSE[acc] || TEXTOS_ACUSE.ERM;
            if ($('acuse-dlg-accion-ayuda')) $('acuse-dlg-accion-ayuda').textContent = info.ayuda;
            if ($('acuse-dlg-alerta-txt')) $('acuse-dlg-alerta-txt').textContent = info.alerta;
        }

        function refrescarEstadoSiiAcuseDlg() {
            var st = (window.CLDemoSii && window.CLDemoSii.estadoConexionCliente)
                ? window.CLDemoSii.estadoConexionCliente(clienteNombre())
                : { autenticado: false, gatewayConfigured: false, companyId: '', hasCredentials: false, tienePfx: false };
            var sinSii = $('acuse-dlg-sin-sii');
            var conSii = $('acuse-dlg-con-sii');
            var chkWrap = $('acuse-check-wrap');
            var chk = $('acuse-check-confirmar');
            var btnEnviar = $('btn-acuse-enviar-sii');

            if (st.autenticado && st.gatewayConfigured && st.companyId && st.tienePfx) {
                if (sinSii) sinSii.hidden = true;
                if (conSii) conSii.hidden = false;
                if (chkWrap) chkWrap.hidden = false;
                if (btnEnviar) btnEnviar.disabled = !(chk && chk.checked);
            } else {
                if (sinSii) {
                    sinSii.hidden = false;
                    var pSin = sinSii.querySelector('p');
                    if (pSin) {
                        pSin.innerHTML = (st.autenticado && st.hasCredentials && !st.tienePfx)
                            ? '<strong>Se requiere Certificado Digital (.pfx) para enviar acuses al SII.</strong> Esta empresa está conectada solo con Clave Tributaria. Puedes guardar una marca local o cargar el .pfx ahora.'
                            : '<strong>Empresa sin conexión automática con .pfx al SII.</strong> Puedes guardar esta decisión como recordatorio local para ejecutarla en sii.cl, o conectar el certificado digital ahora.';
                    }
                }
                if (conSii) conSii.hidden = true;
                if (chkWrap) chkWrap.hidden = true;
                if (btnEnviar) btnEnviar.disabled = true;
            }
            return st;
        }

        function abrirDialogoAcuse(id, accBtn) {
            var est = leerEstadoActual();
            var lista = Array.isArray(est.comprasPendientesAcuse) ? est.comprasPendientesAcuse : [];
            var doc = null;
            for (var i = 0; i < lista.length; i++) {
                if (lista[i] && lista[i].id === id) { doc = lista[i]; break; }
            }
            if (!doc) return;
            acuseActivo = doc;

            var decPrev = (est.acuseDecisiones && typeof est.acuseDecisiones[id] === 'object') ? est.acuseDecisiones[id] : null;
            var accionInicial = (decPrev && decPrev.accion) ? decPrev.accion : (accBtn === 'reclamar' ? 'RCD' : 'ERM');

            if ($('acuse-dlg-dte')) $('acuse-dlg-dte').textContent = 'DTE ' + (doc.tipoDoc || 33) + ' #' + (doc.folio || 's/f');
            if ($('acuse-dlg-emisor')) $('acuse-dlg-emisor').textContent = doc.razonSocial || 'Proveedor';
            if ($('acuse-dlg-rut')) $('acuse-dlg-rut').textContent = doc.rut || 'Sin RUT';
            if ($('acuse-dlg-iva')) $('acuse-dlg-iva').textContent = D.money(doc.iva || 0);
            if ($('acuse-dlg-total')) $('acuse-dlg-total').textContent = D.money(doc.total || 0);
            if ($('acuse-dlg-plazo')) {
                $('acuse-dlg-plazo').textContent = doc.estadoPlazo === 'tacito'
                    ? 'Plazo 8 días cumplido'
                    : (doc.estadoPlazo === 'critico' ? ('Vence en ' + doc.diasRestantes + 'd') : (doc.diasRestantes + ' días restantes'));
                $('acuse-dlg-plazo').className = 'sello ' + (doc.estadoPlazo === 'critico' ? 'sello-riesgo' : (doc.estadoPlazo === 'tacito' ? 'sello-guardada' : 'sello-emitida'));
            }
            if ($('acuse-dlg-accion')) $('acuse-dlg-accion').value = accionInicial;
            if ($('acuse-check-confirmar')) $('acuse-check-confirmar').checked = false;
            if ($('acuse-dlg-feedback')) {
                if (decPrev && decPrev.modo === 'error' && decPrev.error) {
                    $('acuse-dlg-feedback').hidden = false;
                    $('acuse-dlg-feedback').className = 'sii-feedback-box error';
                    $('acuse-dlg-feedback').textContent = decPrev.error;
                } else {
                    $('acuse-dlg-feedback').hidden = true;
                    $('acuse-dlg-feedback').textContent = '';
                }
            }
            actualizarTextosAcuseDlg();
            refrescarEstadoSiiAcuseDlg();

            var dlg = $('dlg-acuse-sii');
            if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
        }

        if ($('tbody-f29-acuse-compras')) {
            $('tbody-f29-acuse-compras').addEventListener('click', function (ev) {
                var btn = ev.target.closest('.btn-acuse-dec');
                if (!btn) return;
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
                abrirDialogoAcuse(btn.getAttribute('data-acuse-id'), btn.getAttribute('data-acuse-acc'));
            });
        }
        if ($('acuse-dlg-accion')) $('acuse-dlg-accion').addEventListener('change', actualizarTextosAcuseDlg);
        if ($('acuse-check-confirmar')) {
            $('acuse-check-confirmar').addEventListener('change', function () {
                refrescarEstadoSiiAcuseDlg();
            });
        }
        if ($('btn-cerrar-acuse-dlg')) $('btn-cerrar-acuse-dlg').addEventListener('click', function () { if ($('dlg-acuse-sii') && $('dlg-acuse-sii').open) $('dlg-acuse-sii').close(); });
        if ($('btn-acuse-cancelar')) $('btn-acuse-cancelar').addEventListener('click', function () { if ($('dlg-acuse-sii') && $('dlg-acuse-sii').open) $('dlg-acuse-sii').close(); });
        if ($('btn-acuse-conectar-sii')) {
            $('btn-acuse-conectar-sii').addEventListener('click', function () {
                if ($('dlg-acuse-sii') && $('dlg-acuse-sii').open) $('dlg-acuse-sii').close();
                if (window.CLDemoSii && window.CLDemoSii.abrirModalSii) {
                    window.CLDemoSii.abrirModalSii(clienteNombre(), { metodo: 'PFX_CERTIFICATE' });
                }
            });
        }
        if ($('btn-acuse-solo-local')) {
            $('btn-acuse-solo-local').addEventListener('click', function () {
                if (!acuseActivo) return;
                var acc = ($('acuse-dlg-accion') && $('acuse-dlg-accion').value) || 'ERM';
                guardarEstadoActual(function (est) {
                    est.acuseDecisiones = est.acuseDecisiones || {};
                    est.acuseDecisiones[acuseActivo.id] = { modo: 'local', accion: acc };
                });
                if ($('dlg-acuse-sii') && $('dlg-acuse-sii').open) $('dlg-acuse-sii').close();
                refrescarTodo();
                D.avisar('Marca local (' + acc + ') guardada para ejecutar en sii.cl.');
            });
        }
        if ($('btn-acuse-enviar-sii')) {
            $('btn-acuse-enviar-sii').addEventListener('click', async function () {
                if (!acuseActivo || !window.CLSii) return;
                var st = refrescarEstadoSiiAcuseDlg();
                if (!st.companyId || !st.tienePfx) return;
                var chk = $('acuse-check-confirmar');
                if (!chk || !chk.checked) return;
                var acc = ($('acuse-dlg-accion') && $('acuse-dlg-accion').value) || 'ERM';
                var docId = acuseActivo.id;
                var docRef = acuseActivo;

                $('btn-acuse-enviar-sii').disabled = true;
                guardarEstadoActual(function (est) {
                    est.acuseDecisiones = est.acuseDecisiones || {};
                    est.acuseDecisiones[docId] = { modo: 'enviando', accion: acc };
                });
                refrescarTodo();

                try {
                    var apiSii = window.CLSii.crearClienteApi();
                    var resp = await apiSii.enviarAcuseRcv(st.companyId, {
                        tipoDoc: Number(docRef.tipoDoc) || 33,
                        folio: Number(docRef.folio),
                        rutEmisor: docRef.rut,
                        accion: acc,
                        period: periodoActual()
                    });
                    var ac = (resp && resp.acuse) || {};
                    guardarEstadoActual(function (est) {
                        est.acuseDecisiones = est.acuseDecisiones || {};
                        est.acuseDecisiones[docId] = {
                            modo: 'sii',
                            accion: acc,
                            estadoContab: ac.estadoContab || ((acc === 'ACD' || acc === 'ERM') ? 'REGISTRO' : 'RECLAMADO'),
                            fechaAcuse: ac.fechaAcuse || new Date().toISOString()
                        };
                    });
                    if ($('dlg-acuse-sii') && $('dlg-acuse-sii').open) $('dlg-acuse-sii').close();
                    refrescarTodo();
                    D.avisar('Evento ' + acc + ' registrado en el SII para DTE #' + docRef.folio + '.');
                } catch (err) {
                    var msgErr = (err && err.message) || 'No pudimos registrar el acuse en el SII.';
                    guardarEstadoActual(function (est) {
                        est.acuseDecisiones = est.acuseDecisiones || {};
                        est.acuseDecisiones[docId] = { modo: 'error', accion: acc, error: msgErr };
                    });
                    if ($('acuse-dlg-feedback')) {
                        $('acuse-dlg-feedback').hidden = false;
                        $('acuse-dlg-feedback').className = 'sii-feedback-box error';
                        $('acuse-dlg-feedback').textContent = msgErr;
                    }
                    $('btn-acuse-enviar-sii').disabled = false;
                    refrescarTodo();
                }
            });
        }
        if ($('btn-super-no-incluir')) {
            $('btn-super-no-incluir').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
                guardarEstadoActual(function (est) { est.excluirSupermercado = true; });
                refrescarTodo();
                D.avisar('Crédito de supermercados (cód. 761/762) excluido del cálculo F29 actual.');
            });
        }
        if ($('btn-super-mantener')) {
            $('btn-super-mantener').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado tributariamente.'); return; }
                guardarEstadoActual(function (est) { est.excluirSupermercado = false; });
                refrescarTodo();
                D.avisar('Crédito de supermercados acreditado con giro (cód. 761/762 incluido en cód. 537).');
            });
        }

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
        if ($('btn-f29-whatsapp')) {
            $('btn-f29-whatsapp').addEventListener('click', function () {
                var texto = generarTextoWhatsapp(calcularModelo());
                copiarTextoPortapapeles(texto, 'Reporte ejecutivo copiado para enviar por WhatsApp.');
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
                var m = calcularModelo();
                var c = m.f29.codigos;
                var per = periodoActual();
                var filas = [
                    ['Hoja Guía Formulario 29 · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Régimen: ' + m.f29.regimenNombre],
                    [],
                    ['Código SII', 'Concepto tributario', 'Cantidad / Base', 'Monto ($)'],
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
                    ['91', 'Total a pagar dentro del plazo legal', '', c[91]],
                    [],
                    ['Borrador referencial generado con CálculoLaboral. Confirma los códigos en sii.cl antes de declarar.']
                ];
                D.descargarXlsx('hoja-guia-f29-' + per + '.xlsx', null, null, {
                    nombreHoja: 'Guía F29',
                    filasCompletas: filas,
                    textos: { 0: true },
                    monedas: { 3: true },
                    alinear: { 0: 'center', 1: 'left', 2: 'right', 3: 'right' },
                    anchos: { 0: 15, 1: 42, 2: 18, 3: 18 },
                    estilo: {
                        tituloFilas: [0],
                        metaFilas: [1],
                        encabezadoFila: 3,
                        totalesFilas: [6, 12, 13, 18],
                        notasFilas: [20],
                        congelarFila: 4,
                        orientacion: 'portrait',
                        zebra: true
                    }
                });
            });
        }
        if ($('btn-f29-pdf')) {
            $('btn-f29-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                pintarF29(m);
                var tb = $('tbody-f29') ? $('tbody-f29').innerHTML.trim() : '';
                if (!tb) {
                    D.avisar('No hay líneas del F29 para imprimir en este período.');
                    return;
                }
                imprimirHtmlModulo(
                    'Hoja Guía Formulario 29',
                    m.f29.regimenNombre,
                    '<table class="print-table"><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Código</th><th class="r">Monto</th></tr></thead><tbody>' + tb + '</tbody></table>',
                    'Borrador de trabajo para revisión del contador antes de declarar en sii.cl.'
                );
            });
        }

        // Selector compacto de cliente y panel de edición inline
        function alternarPanelCliente(mostrar) {
            var panel = $('ctx-cliente-edicion');
            if (!panel) return;
            var abrir = typeof mostrar === 'boolean' ? mostrar : panel.hidden;
            panel.hidden = !abrir;
            if ($('btn-editar-cliente-trigger')) $('btn-editar-cliente-trigger').setAttribute('aria-expanded', abrir ? 'true' : 'false');
            if ($('btn-nuevo-cliente-trigger')) $('btn-nuevo-cliente-trigger').setAttribute('aria-expanded', abrir ? 'true' : 'false');
        }
        if ($('btn-editar-cliente-trigger')) {
            $('btn-editar-cliente-trigger').addEventListener('click', function () {
                var panel = $('ctx-cliente-edicion');
                var abrir = panel ? panel.hidden : true;
                alternarPanelCliente(abrir);
                if (abrir && $('liq-cliente')) { $('liq-cliente').focus(); $('liq-cliente').select(); }
            });
        }
        if ($('btn-nuevo-cliente-trigger')) {
            $('btn-nuevo-cliente-trigger').addEventListener('click', function () {
                alternarPanelCliente(true);
                if ($('liq-cliente')) {
                    $('liq-cliente').value = '';
                    $('liq-cliente').focus();
                }
                if ($('liq-rut')) $('liq-rut').value = '';
                pintarIdentidadCliente();
            });
        }
        if ($('liq-cliente')) {
            $('liq-cliente').addEventListener('input', function () { pintarIdentidadCliente(); });
        }
        if ($('btn-guardar-cliente')) {
            $('btn-guardar-cliente').addEventListener('click', function () {
                setTimeout(function () {
                    alternarPanelCliente(false);
                    refrescarTodo();
                }, 0);
            });
        }

        // Subpestañas Bancos y Conciliación
        Array.prototype.forEach.call(document.querySelectorAll('[data-subbanco]'), function (btn) {
            btn.addEventListener('click', function () {
                ui.subBanco = btn.getAttribute('data-subbanco');
                refrescarTodo();
            });
        });

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
                if (id === 'ddjj-socios-pct') {
                    var pSoc = D.parseDecimal(el.value);
                    var errSoc = $('ddjj-socios-pct-err');
                    if (pSoc < 1 || pSoc > 100) {
                        el.setAttribute('aria-invalid', 'true');
                        if (errSoc) { errSoc.hidden = false; errSoc.textContent = 'El porcentaje debe estar entre 1% y 100%.'; }
                        return;
                    }
                    el.removeAttribute('aria-invalid');
                    if (errSoc) { errSoc.hidden = true; errSoc.textContent = ''; }
                }
                guardarEstadoActual(function (est) {
                    est.tesoreria.saldoInicialBanco = Math.max(0, Math.round(D.parseNumber($('tes-banco-ini').value)));
                    est.tesoreria.pctVentasCobradas = Math.max(0, Math.min(100, D.parseDecimal($('tes-pct-cobro').value) || 0));
                    est.tesoreria.pctComprasPagadas = Math.max(0, Math.min(100, D.parseDecimal($('tes-pct-pago').value) || 0));
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
                var per = periodoActual();
                var filasDiario = [
                    ['Libro Diario Contable · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Asientos: ' + m.asientos.length],
                    [],
                    ['Asiento', 'Fecha', 'Origen', 'Glosa', 'Código', 'Cuenta', 'Debe', 'Haber']
                ];
                var sDebe = 0, sHaber = 0;
                m.asientos.forEach(function (a, i) {
                    var numA = '#' + (i + 1);
                    a.lineas.forEach(function (l) {
                        var d = Math.round(l.debe || 0), h = Math.round(l.haber || 0);
                        sDebe += d; sHaber += h;
                        filasDiario.push([numA, a.fecha, a.origen, a.glosa, l.cuenta, l.nombre, d || '', h || '']);
                    });
                });
                filasDiario.push(['', '', '', 'Sumas iguales Libro Diario', '', '', sDebe, sHaber]);

                var filasMayor = [
                    ['Libro Mayor (Saldos por Cuenta) · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Régimen: ' + m.f29.regimenNombre],
                    [],
                    ['Código', 'Cuenta', 'Total Debe', 'Total Haber', 'Saldo Deudor', 'Saldo Acreedor']
                ];
                var md = 0, mh = 0, msd = 0, msa = 0;
                (m.mayor || []).forEach(function (c) {
                    var d = Math.round(c.debe || 0), h = Math.round(c.haber || 0);
                    var sd = d > h ? (d - h) : 0, sa = h > d ? (h - d) : 0;
                    md += d; mh += h; msd += sd; msa += sa;
                    filasMayor.push([c.codigo, c.nombre, d, h, sd, sa]);
                });
                filasMayor.push(['', 'Totales', md, mh, msd, msa]);

                D.descargarXlsx('libro-diario-' + per + '.xlsx', null, null, {
                    hojas: [
                        {
                            nombre: 'Libro Diario',
                            filas: filasDiario,
                            textos: { 0: true, 1: true, 4: true },
                            monedas: { 6: true, 7: true },
                            alinear: { 0: 'center', 1: 'center', 2: 'center', 3: 'left', 4: 'center', 5: 'left' },
                            anchos: { 0: 10, 1: 13, 2: 14, 3: 36, 4: 12, 5: 32, 6: 16, 7: 16 },
                            estilo: {
                                tituloFilas: [0],
                                metaFilas: [1],
                                encabezadoFila: 3,
                                totalesFilas: [filasDiario.length - 1],
                                congelarFila: 4,
                                autoFiltro: true,
                                orientacion: 'landscape',
                                zebra: true
                            }
                        },
                        {
                            nombre: 'Libro Mayor',
                            filas: filasMayor,
                            textos: { 0: true },
                            monedas: { 2: true, 3: true, 4: true, 5: true },
                            alinear: { 0: 'center', 1: 'left' },
                            anchos: { 0: 12, 1: 34, 2: 16, 3: 16, 4: 16, 5: 16 },
                            estilo: {
                                tituloFilas: [0],
                                metaFilas: [1],
                                encabezadoFila: 3,
                                totalesFilas: [filasMayor.length - 1],
                                congelarFila: 4,
                                autoFiltro: true,
                                orientacion: 'landscape',
                                zebra: true
                            }
                        }
                    ]
                });
            });
        }
        if ($('btn-libros-pdf')) {
            $('btn-libros-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                if (!m.asientos.length) {
                    D.avisar('Aún no hay asientos registrados en este período. Carga RCV, ejemplo o crea un asiento manual.');
                    return;
                }
                var diarioHtml = m.asientos.map(function (a, i) {
                    return '<div class="print-h3">Asiento #' + (i + 1) + ' · ' + D.esc(a.fecha) + ' · ' + D.esc(a.glosa) + '</div>' +
                        '<table class="print-table"><thead><tr><th>Código</th><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th></tr></thead><tbody>' +
                        a.lineas.map(function (l) {
                            return '<tr><td class="mono">' + D.esc(l.cuenta) + '</td><td>' + D.esc(l.nombre) + '</td><td class="r">' + (l.debe ? D.money(l.debe) : '-') + '</td><td class="r">' + (l.haber ? D.money(l.haber) : '-') + '</td></tr>';
                        }).join('') +
                        '<tr class="total"><td colspan="2">Total asiento</td><td class="r">' + D.money(a.debe) + '</td><td class="r">' + D.money(a.haber) + '</td></tr></tbody></table>';
                }).join('');
                var mayorHtml = '<table class="print-table"><thead><tr><th>Código</th><th>Cuenta contable</th><th class="r">Débito</th><th class="r">Crédito</th><th class="r">Saldo Deudor</th><th class="r">Saldo Acreedor</th></tr></thead><tbody>' +
                    m.mayor.map(function (cta) {
                        return '<tr><td class="mono">' + D.esc(cta.codigo) + '</td><td>' + D.esc(cta.nombre) + '</td>' +
                            '<td class="r">' + D.money(cta.debito) + '</td><td class="r">' + D.money(cta.credito) + '</td>' +
                            '<td class="r">' + (cta.saldoDeudor ? D.money(cta.saldoDeudor) : '-') + '</td>' +
                            '<td class="r">' + (cta.saldoAcreedor ? D.money(cta.saldoAcreedor) : '-') + '</td></tr>';
                    }).join('') + '</tbody></table>';
                imprimirHtmlModulo('Libros Contables del Período', '', '', '', {
                    paginas: [
                        {
                            titulo: 'Libro Diario Contable',
                            subtitulo: m.asientos.length + ' asientos cuadrados',
                            html: diarioHtml,
                            nota: 'Libro Diario generado automáticamente según RCV, nómina, BHE y ajustes manuales.'
                        },
                        {
                            titulo: 'Libro Mayor (Resumen por Cuenta)',
                            subtitulo: m.mayor.length + ' cuentas con movimiento',
                            html: mayorHtml,
                            nota: 'Saldos acumulados del período para respaldo de auditoría.'
                        }
                    ]
                });
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
                    est.rliAjustes.tasaIdpc = Math.max(0, D.parseDecimal($('rli-tasa-idpc').value) || 0);
                });
                refrescarTodo();
            });
        });

        if ($('btn-balance-csv')) {
            $('btn-balance-csv').addEventListener('click', function () {
                var m = calcularModelo();
                var b = m.balance;
                var per = periodoActual();
                var filas = [
                    ['Balance Tributario Clasificado de 8 Columnas · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Régimen: ' + m.f29.regimenNombre + '   ·   Cuadratura SII'],
                    [],
                    ['Código', 'Cuenta contable', 'Sumas', '', 'Saldos', '', 'Inventario', '', 'Resultados', ''],
                    ['', '', 'Débito', 'Crédito', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Pérdida', 'Ganancia']
                ];
                b.filas.forEach(function (f) {
                    filas.push([f.codigo, f.nombre, f.debito, f.credito, f.deudor, f.acreedor, f.activo, f.pasivo, f.perdida, f.ganancia]);
                });
                var si = b.sumasIguales;
                filas.push(['', 'SUMAS IGUALES', si.debito, si.credito, si.deudor, si.acreedor, si.activo, si.pasivo, si.perdida, si.ganancia]);
                D.descargarXlsx('balance-8-columnas-' + per + '.xlsx', null, null, {
                    nombreHoja: 'Balance 8 Columnas',
                    filasCompletas: filas,
                    textos: { 0: true },
                    monedas: { 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true },
                    alinear: { 0: 'center', 1: 'left' },
                    anchos: { 0: 11, 1: 32, 2: 14, 3: 14, 4: 14, 5: 14, 6: 14, 7: 14, 8: 14, 9: 14 },
                    estilo: {
                        tituloFilas: [0],
                        metaFilas: [1],
                        grupoFilas: [3],
                        encabezadoFila: 4,
                        totalesFilas: [filas.length - 1],
                        merges: [
                            { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
                            { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
                            { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
                            { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
                            { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
                            { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } }
                        ],
                        congelarFila: 5,
                        orientacion: 'landscape',
                        zebra: true
                    }
                });
            });
        }
        if ($('btn-rli-csv')) {
            $('btn-rli-csv').addEventListener('click', function () {
                var m = calcularModelo();
                var r = m.rli;
                var per = periodoActual();
                var filas = [
                    ['Determinación RLI ProPyme General (Art. 14 D N°3 LIR) · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Flujo percibido y pagado'],
                    [],
                    ['Concepto RLI Art. 14 D N°3', 'Monto ($)'],
                    ['Ingresos devengados netos', r.ingresosDevengadosNetos],
                    ['Menos: Ventas no cobradas (CxC netas)', -r.ventasNoCobradasNetas],
                    ['Más: Cobros períodos anteriores', r.cobrosAnterioresNetos],
                    ['Ingresos percibidos computables', r.ingresosPercibidos],
                    ['Menos: Compras y gastos pagados', -r.comprasGastosPagados],
                    ['Menos: Remuneraciones y honorarios pagados', -r.remuneracionesHonorariosPagados],
                    ['Menos: Activo fijo pagado (depreciación instantánea)', -r.activoFijoPagadoNeto],
                    ['Más: Agregados art. 21 y 31 LIR', r.multasGastosRechazados],
                    ['Base Imponible / RLI ProPyme 14 D N°3', r.baseImponible],
                    [],
                    ['Hoja de trabajo referencial para declaración F22. Revisa respaldos y exenciones con el contador responsable.']
                ];
                D.descargarXlsx('hoja-rli-propyme-' + per + '.xlsx', null, null, {
                    nombreHoja: 'RLI ProPyme',
                    filasCompletas: filas,
                    monedas: { 1: true },
                    alinear: { 0: 'left', 1: 'right' },
                    anchos: { 0: 52, 1: 18 },
                    estilo: {
                        tituloFilas: [0],
                        metaFilas: [1],
                        encabezadoFila: 3,
                        totalesFilas: [7, 12],
                        notasFilas: [14],
                        congelarFila: 4,
                        orientacion: 'portrait',
                        zebra: true
                    }
                });
            });
        }
        if ($('btn-balance-pdf')) {
            $('btn-balance-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                pintarBalance(m);
                if (!m.balance.filas.length) {
                    D.avisar('Aún no hay movimientos contables para emitir el Balance de 8 Columnas.');
                    return;
                }
                var balHtml = '<table class="print-table print-table--compact"><thead><tr><th>Cód.</th><th>Cuenta</th><th class="r">Débito</th><th class="r">Crédito</th><th class="r">Deudor</th><th class="r">Acreedor</th><th class="r">Activo</th><th class="r">Pasivo</th><th class="r">Pérdida</th><th class="r">Ganancia</th></tr></thead><tbody>' +
                    $('tbody-balance8').innerHTML + '</tbody></table>';
                var rliHtml = '<table class="print-table"><thead><tr><th>Partida Tributaria (Art. 14 D N°3)</th><th class="r">Monto</th></tr></thead><tbody>' +
                    $('tbody-rli').innerHTML + '</tbody></table>';
                imprimirHtmlModulo('Balance Tributario de 8 Columnas y RLI', m.f29.regimenNombre, '', '', {
                    paginas: [
                        {
                            titulo: 'Balance Tributario de 8 Columnas',
                            subtitulo: m.f29.regimenNombre,
                            html: balHtml,
                            paisa: true,
                            nota: 'Balance de comprobación, saldos, inventario y resultado por naturaleza contable.'
                        },
                        {
                            titulo: 'Hoja de Trabajo RLI ProPyme (Art. 14 D N°3)',
                            subtitulo: m.f29.regimenNombre,
                            html: rliHtml,
                            nota: 'Determinación referencial en base percibida/pagada pre-cierre Formulario 22.'
                        }
                    ]
                });
            });
        }

        // Exportaciones P&L y Flujo
        if ($('btn-pnl-csv')) {
            $('btn-pnl-csv').addEventListener('click', function () {
                var m = calcularModelo();
                var p = m.pnl, fl = m.flujo;
                var per = periodoActual();
                var filas = [
                    ['Estado de Resultados y Flujo de Caja · ' + per],
                    ['Cliente: ' + clienteNombre() + '   ·   Cifras netas en pesos chilenos (CLP)'],
                    [],
                    ['Rubro / Concepto', 'Monto ($)'],
                    ['ESTADO DE RESULTADOS (BASE DEVENGADA)', ''],
                    ['Ingresos de explotación', p.ingresosGiro],
                    ['Costo de ventas', -p.costoVentas],
                    ['Margen bruto', p.margenBruto],
                    ['Gasto laboral', -p.gastoLaboral],
                    ['Honorarios profesionales', -p.gastoHonorarios],
                    ['Gastos de administración', -p.gastoAdmin],
                    ['Resultado operacional (EBIT)', p.resultadoOperacional],
                    ['Resultado antes de impuestos', p.resultadoAntesImpuesto],
                    [],
                    ['FLUJO DE CAJA DEL PERÍODO Y COMPROMISOS', ''],
                    ['Saldo inicial banco', fl.saldoInicialBanco],
                    ['Cobros a clientes', fl.entradasCobrosClientes],
                    ['Pagos a proveedores', -fl.salidasProveedores],
                    ['Pagos sueldos líquidos', -fl.salidasSueldos],
                    ['Pagos honorarios líquidos', -fl.salidasHonorarios],
                    ['Saldo disponible banco al cierre', fl.saldoDisponibleBanco],
                    ['Compromiso Previred día 13', -fl.compromisoPreviredDia13],
                    ['Compromiso F29 cód. 91 día 20', -fl.compromisoF29Dia20],
                    ['Caja libre proyectada post-impuestos', fl.cajaProyectadaPostImpuestos]
                ];
                D.descargarXlsx('estado-resultados-flujo-' + per + '.xlsx', null, null, {
                    nombreHoja: 'Resultados y Flujo',
                    filasCompletas: filas,
                    monedas: { 1: true },
                    alinear: { 0: 'left', 1: 'right' },
                    anchos: { 0: 46, 1: 20 },
                    estilo: {
                        tituloFilas: [0],
                        metaFilas: [1],
                        encabezadoFila: 3,
                        seccionFilas: [4, 14],
                        totalesFilas: [7, 11, 12, 20, 23],
                        congelarFila: 4,
                        orientacion: 'portrait',
                        zebra: true
                    }
                });
            });
        }
        if ($('btn-pnl-pdf')) {
            $('btn-pnl-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                pintarPnl(m);
                var html = '<div class="print-h3">Estado de Resultados (Base Devengada)</div>' +
                    '<table class="print-table"><thead><tr><th>Partida</th><th class="r">Monto</th></tr></thead><tbody>' + $('tbody-pnl').innerHTML + '</tbody></table>' +
                    '<div class="print-h3" style="margin-top:14px">Flujo de Caja Operativo y Tributario</div>' +
                    '<table class="print-table"><thead><tr><th>Concepto</th><th class="r">Monto</th></tr></thead><tbody>' + $('tbody-flujo').innerHTML + '</tbody></table>';
                imprimirHtmlModulo('Estado de Resultados y Flujo de Caja', m.f29.regimenNombre, html, 'Estado financiero gerencial y proyección de compromisos tributarios y previsionales.');
            });
        }

        // Puente colaborativo Pyme (/app -> paquete-contador-YYYY-MM.json)
        if ($('btn-importar-pyme') && $('file-paquete-pyme')) {
            $('btn-importar-pyme').addEventListener('click', function () {
                $('file-paquete-pyme').value = '';
                $('file-paquete-pyme').click();
            });
            $('file-paquete-pyme').addEventListener('change', function () {
                var f = $('file-paquete-pyme').files && $('file-paquete-pyme').files[0];
                if (!f) return;
                f.text().then(importarPaquetePyme).catch(function (err) {
                    D.avisar('No se pudo leer el paquete Pyme: ' + (err && err.message ? err.message : 'error'));
                });
            });
        }

        function descargarCsvTexto(nombre, contenido) {
            if (window.CLDemoArchivos && window.CLDemoArchivos.descargarCsv) {
                window.CLDemoArchivos.descargarCsv(nombre, '\uFEFF' + contenido);
            } else {
                var blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = nombre;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 500);
            }
        }

        function aplicarTextoBhe(txt) {
            if (!Imp) return;
            var res = Imp.parsearBheSii(txt, { periodo: periodoActual() });
            if (!res.ok) {
                D.avisar(res.error || 'No se reconocieron boletas BHE.');
                return;
            }
            if (leerEstadoActual().cerradoTributario) {
                D.avisar('El período está cerrado. Reábrelo para importar BHE.');
                return;
            }
            guardarEstadoActual(function (est) {
                est.bheBoletas = res.boletas;
                est.bheAnuladas = res.anuladasOmitidas;
                est.bheAlertas = res.advertencias || [];
                est.honorariosBruto = res.totalBruto;
                est.honorariosRetencionDirecta = res.codigo151;
            });
            refrescarTodo();
            D.avisar('BHE importadas: ' + res.boletas.length + ' vigentes (' + res.anuladasOmitidas + ' anuladas omitidas). F29 cód. 151 = ' + D.money(res.codigo151) + '.');
        }

        function aplicarResultadoCartola(res) {
            if (!res || !res.ok) {
                D.avisar((res && res.error) || 'No se reconocieron movimientos de cartola.');
                return;
            }
            if (leerEstadoActual().cerradoTributario) {
                D.avisar('El período está cerrado. Reábrelo para importar cartola.');
                return;
            }
            guardarEstadoActual(function (est) {
                est.cartolaMovimientos = res.movimientos;
                est.cartolaTotalAbonos = res.totalAbonos;
                est.cartolaTotalCargos = res.totalCargos;
                est.cartolaUltimoSaldo = res.ultimoSaldo;
                if (res.saldoInicialEstimado != null && !est.tesoreria.saldoInicialBanco) {
                    est.tesoreria.saldoInicialBanco = Math.max(0, res.saldoInicialEstimado);
                }
            });
            refrescarTodo();
            D.avisar('Cartola leída: ' + res.movimientos.length + ' movimientos bancarios listos para centralizar.');
        }

        function aplicarTextoCartola(txt) {
            if (!Imp) return;
            aplicarResultadoCartola(Imp.parsearCartola(txt, { periodo: periodoActual() }));
        }

        function decodificarTextoBanco(buf) {
            if (typeof TextDecoder === 'undefined') return '';
            var txt = new TextDecoder('utf-8').decode(buf);
            if (txt.indexOf('\uFFFD') >= 0) {
                try { txt = new TextDecoder('windows-1252').decode(buf); } catch (e) { }
            }
            return txt;
        }

        function aplicarArchivoCartola(file) {
            if (!file || !Imp) return;
            var per = periodoActual();
            var esExcel = /\.(xlsx|xls|ods)$/i.test(file.name);
            file.arrayBuffer().then(function (buf) {
                var res = null;
                if (esExcel && typeof XLSX !== 'undefined') {
                    try {
                        var wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
                        var firstErr = null;
                        for (var i = 0; i < (wb.SheetNames || []).length; i++) {
                            var sh = wb.Sheets[wb.SheetNames[i]];
                            var rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
                            var cand = Imp.parsearCartola(rows, { periodo: per });
                            if (cand && cand.ok) { res = cand; break; }
                            if (!firstErr) firstErr = cand;
                        }
                        if (!res) res = firstErr;
                    } catch (e) {
                        res = null;
                    }
                }
                if (!res || (!res.ok && esExcel)) {
                    var txtFallback = decodificarTextoBanco(buf);
                    var candTxt = txtFallback ? Imp.parsearCartola(txtFallback, { periodo: per }) : null;
                    if (candTxt && candTxt.ok) res = candTxt;
                    else if (!res) res = candTxt;
                }
                aplicarResultadoCartola(res);
            }).catch(function () {
                D.avisar('No pudimos leer el archivo de cartola.');
            });
        }

        function conectarInputCartola(btnId, inputId) {
            var btn = $(btnId);
            var inp = $(inputId);
            if (!btn || !inp) return;
            btn.addEventListener('click', function () { inp.value = ''; inp.click(); });
            inp.addEventListener('change', function () {
                var f = inp.files && inp.files[0];
                if (f) aplicarArchivoCartola(f);
                inp.value = '';
            });
        }

        function imprimirCertificadoN6() {
            var m = calcularModelo();
            var dj = m.ddjj && m.ddjj.dj1887;
            if (!dj || !dj.ok || !(dj.certificadosN6 || []).length) {
                D.avisar('Calcula liquidaciones en Remuneraciones para emitir el Certificado N°6.');
                return;
            }
            var rows = dj.certificadosN6.map(function (c) {
                return '<tr>' +
                    '<td class="mono">' + D.esc(c.rut) + '</td>' +
                    '<td>' + D.esc(c.nombre) + '</td>' +
                    '<td class="r">' + D.money(c.col4_rentaNeta) + '</td>' +
                    '<td class="r">' + D.money(c.col5_impuestoUnico) + '</td>' +
                    '<td class="r">' + D.money(c.col7_rentaExenta) + '</td>' +
                    '<td class="r">' + D.money(c.col8_rentaNoGravada) + '</td>' +
                    '<td class="r">' + D.money(c.col9_rebajaZonasExtremas) + '</td>' +
                    '</tr>';
            }).join('');
            var html = '<p style="font-size:12px;margin-bottom:8px">' + D.esc(dj.notaColumnas) + '</p>' +
                '<table class="print-table"><thead><tr><th>RUT</th><th>Trabajador</th><th class="r">Col. 4 Renta Neta</th><th class="r">Col. 5 Imp. Único</th><th class="r">Col. 7 Exenta</th><th class="r">Col. 8 No Gravada</th><th class="r">Col. 9 Z. Extremas</th></tr></thead><tbody>' + rows + '</tbody></table>';
            imprimirHtmlModulo('Certificado N°6 sobre Sueldos', 'AT ' + dj.anioTributario, html, 'Emitido conforme al mapeo SII de Certificado N°6 (col. 7 Exenta / col. 8 No Gravada).');
        }

        function imprimirCertificadoN1() {
            var m = calcularModelo();
            var dj = m.ddjj && m.ddjj.dj1879;
            if (!dj || !dj.ok || !(dj.certificadosN1 || []).length) {
                D.avisar('Carga boletas BHE o ingresa honorarios para emitir el Certificado N°1.');
                return;
            }
            var rows = dj.certificadosN1.map(function (c) {
                return '<tr>' +
                    '<td class="mono">' + D.esc(c.rutPrestador) + '</td>' +
                    '<td>' + D.esc(c.nombrePrestador) + '</td>' +
                    '<td class="r">' + c.cantidadBoletas + '</td>' +
                    '<td class="r">' + D.money(c.honorariosBrutos) + '</td>' +
                    '<td class="r">' + D.money(c.impuestoRetenido) + '</td>' +
                    '<td class="r">' + D.num(c.tasaPromedioPct, 2) + '%</td>' +
                    '</tr>';
            }).join('');
            var html = '<table class="print-table"><thead><tr><th>RUT Prestador</th><th>Nombre</th><th class="r">BHE</th><th class="r">Honorario Bruto</th><th class="r">Retención Practicada</th><th class="r">Tasa</th></tr></thead><tbody>' + rows + '</tbody></table>';
            imprimirHtmlModulo('Certificado N°1 sobre Honorarios', 'AT ' + dj.anioTributario, html, dj.notaNormativa);
        }

        // Torre de Control Multiempresa
        if ($('btn-torre-crear-cliente')) {
            $('btn-torre-crear-cliente').addEventListener('click', function () {
                var nom = $('torre-nuevo-nombre') ? $('torre-nuevo-nombre').value.trim() : '';
                if (!nom) { D.avisar('Escribe el nombre o razón social del cliente.'); return; }
                var rutRaw = $('torre-nuevo-rut') ? $('torre-nuevo-rut').value.trim() : '';
                var regNuevo = $('torre-nuevo-regimen') ? $('torre-nuevo-regimen').value : '14D3';
                var errTorreRut = $('torre-nuevo-rut-err');
                if (rutRaw && window.CLSii && window.CLSii.rutValido && !window.CLSii.rutValido(rutRaw)) {
                    if ($('torre-nuevo-rut')) { $('torre-nuevo-rut').setAttribute('aria-invalid', 'true'); $('torre-nuevo-rut').focus(); }
                    if (errTorreRut) { errTorreRut.hidden = false; errTorreRut.textContent = 'RUT inválido (revisa dígito verificador).'; }
                    D.avisar('El RUT ingresado no es válido. Revísalo antes de crear el cliente.');
                    return;
                }
                if ($('torre-nuevo-rut')) $('torre-nuevo-rut').removeAttribute('aria-invalid');
                if (errTorreRut) { errTorreRut.hidden = true; errTorreRut.textContent = ''; }
                guardarTodoAlmacen((function () {
                    var todo = leerTodoAlmacen();
                    var k = nom.toLowerCase() + '::' + periodoActual();
                    if (!todo[k]) todo[k] = estadoDefecto(periodoActual());
                    todo[k].regimen = regNuevo || todo[k].regimen;
                    return todo;
                })());
                if (rutRaw && window.CLDemoSii && window.CLDemoSii.guardarRutCliente) {
                    window.CLDemoSii.guardarRutCliente(nom, rutRaw);
                }
                if ($('torre-nuevo-nombre')) $('torre-nuevo-nombre').value = '';
                if ($('torre-nuevo-rut')) $('torre-nuevo-rut').value = '';
                cambiarACliente(nom);
                refrescarTodo();
                D.avisar('Cliente activo cambiado a ' + nom + '.');
            });
        }
        if ($('tbody-torre-clientes')) {
            $('tbody-torre-clientes').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-torre-trabajar]');
                if (!btn) return;
                cambiarACliente(btn.getAttribute('data-torre-trabajar'));
                refrescarTodo();
                D.avisar('Trabajando con ' + btn.getAttribute('data-torre-trabajar') + '.');
            });
        }

        // Importador Unificado (BHE + Cartola Bancaria + Navegación rápida)
        if ($('btn-imp-ir-nomina')) $('btn-imp-ir-nomina').addEventListener('click', function () { cambiarModulo('remuneraciones'); });
        if ($('btn-imp-ir-f29')) $('btn-imp-ir-f29').addEventListener('click', function () { cambiarModulo('f29'); });

        if ($('btn-imp-bhe-subir') && $('file-imp-bhe')) {
            $('btn-imp-bhe-subir').addEventListener('click', function () { $('file-imp-bhe').value = ''; $('file-imp-bhe').click(); });
            $('file-imp-bhe').addEventListener('change', function () {
                var f = $('file-imp-bhe').files && $('file-imp-bhe').files[0];
                if (f) f.text().then(aplicarTextoBhe);
            });
        }
        if ($('btn-imp-bhe-ejemplo') && Imp) {
            $('btn-imp-bhe-ejemplo').addEventListener('click', function () {
                aplicarTextoBhe(Imp.ejemploBheCsv(periodoActual()));
            });
        }
        if ($('btn-imp-bhe-limpiar')) {
            $('btn-imp-bhe-limpiar').addEventListener('click', function () {
                guardarEstadoActual(function (est) {
                    est.bheBoletas = []; est.bheAnuladas = 0; est.bheAlertas = [];
                    est.honorariosBruto = 0; est.honorariosRetencionDirecta = 0;
                });
                refrescarTodo();
                D.avisar('Registro de boletas BHE limpio.');
            });
        }

        conectarInputCartola('btn-imp-cartola-subir', 'file-imp-cartola');
        if ($('btn-imp-cartola-ejemplo') && Imp) {
            $('btn-imp-cartola-ejemplo').addEventListener('click', function () {
                aplicarTextoCartola(Imp.ejemploCartolaCsv(periodoActual()));
            });
        }
        if ($('btn-imp-cartola-centralizar')) {
            $('btn-imp-cartola-centralizar').addEventListener('click', function () {
                var estAct = leerEstadoActual();
                if (estAct.cerradoTributario) { D.avisar('Período cerrado.'); return; }
                var movs = estAct.cartolaMovimientos || [];
                if (!movs.length) { D.avisar('Primero carga una cartola o usa el ejemplo.'); return; }
                var nuevos = C.asientosDesdeCartola(movs, { prefijo: 'CART', origen: 'ajuste' });
                guardarEstadoActual(function (est) {
                    var sinCartola = (est.manuales || []).filter(function (a) { return !/^CART-/.test(String(a.id || '')); });
                    est.manuales = sinCartola.concat(nuevos);
                });
                ui.subLibro = 'diario';
                refrescarTodo();
                D.avisar('Cartola centralizada en Libro Diario (' + nuevos.length + ' asientos cuadrados).');
            });
        }

        // Plan de Cuentas editable
        if ($('tbody-plan-cuentas')) {
            $('tbody-plan-cuentas').addEventListener('change', function (ev) {
                var inp = ev.target.closest('[data-plan-nombre]');
                if (!inp || !C || !C.obtenerPlanCuentas) return;
                var cod = inp.getAttribute('data-plan-nombre');
                var lista = C.obtenerPlanCuentas().map(function (c) {
                    if (c.codigo === cod && inp.value.trim()) c.nombre = inp.value.trim();
                    return c;
                });
                C.establecerPlanCuentas(lista);
                guardarPlanPersonalizado();
                refrescarTodo();
                D.avisar('Cuenta ' + cod + ' actualizada.');
            });
            $('tbody-plan-cuentas').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-plan-borrar]');
                if (!btn || !C || !C.obtenerPlanCuentas) return;
                var cod = btn.getAttribute('data-plan-borrar');
                var actual = C.obtenerPlanCuentas();
                if (actual.length <= 10) { D.avisar('Conserva al menos 10 cuentas base en el plan.'); return; }
                C.establecerPlanCuentas(actual.filter(function (c) { return c.codigo !== cod; }));
                guardarPlanPersonalizado();
                refrescarTodo();
            });
        }
        if ($('btn-plan-agregar')) {
            $('btn-plan-agregar').addEventListener('click', function () {
                var cod = $('plan-nuevo-codigo') ? $('plan-nuevo-codigo').value.trim() : '';
                var nom = $('plan-nuevo-nombre') ? $('plan-nuevo-nombre').value.trim() : '';
                var tipo = $('plan-nuevo-tipo') ? $('plan-nuevo-tipo').value : 'activo';
                var grupo = $('plan-nuevo-grupo') ? $('plan-nuevo-grupo').value : 'otro';
                if (!cod || !nom) { D.avisar('Ingresa código y nombre para la nueva cuenta.'); return; }
                var actual = C.obtenerPlanCuentas();
                if (actual.some(function (c) { return c.codigo === cod; })) { D.avisar('Ya existe la cuenta ' + cod + '.'); return; }
                actual.push({ codigo: cod, nombre: nom, tipo: tipo, grupo: grupo });
                C.establecerPlanCuentas(actual);
                guardarPlanPersonalizado();
                if ($('plan-nuevo-codigo')) $('plan-nuevo-codigo').value = '';
                if ($('plan-nuevo-nombre')) $('plan-nuevo-nombre').value = '';
                refrescarTodo();
                D.avisar('Cuenta ' + cod + ' agregada al plan contable.');
            });
        }
        if ($('btn-plan-restaurar')) {
            $('btn-plan-restaurar').addEventListener('click', function () {
                C.restaurarPlanCuentas();
                try { window.localStorage.removeItem(K_PLAN_CUENTAS); } catch (e) { }
                refrescarTodo();
                D.avisar('Plan de cuentas restaurado a valores base.');
            });
        }
        if ($('suite-erp-origen')) {
            $('suite-erp-origen').addEventListener('change', function () {
                var desc = {
                    sii_estandar: 'Plan base Suite activo y editable.',
                    softland: 'Referencia Softland activa para exportación CSV.',
                    transtecnia: 'Referencia Transtecnia activa para exportación CSV.',
                    laudus: 'Referencia Laudus activa para exportación CSV.'
                }[this.value] || 'Plan activo.';
                if ($('suite-plan-estado-txt')) $('suite-plan-estado-txt').textContent = desc;
            });
        }
        if ($('btn-importar-plan-csv') && $('file-plan-csv')) {
            $('btn-importar-plan-csv').addEventListener('click', function () { $('file-plan-csv').value = ''; $('file-plan-csv').click(); });
            $('file-plan-csv').addEventListener('change', function () {
                var f = $('file-plan-csv').files && $('file-plan-csv').files[0];
                if (!f) return;
                f.text().then(function (raw) {
                    var lineas = String(raw || '').split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
                    var nuevas = [];
                    lineas.forEach(function (l, idx) {
                        var sep = l.indexOf(';') >= 0 ? ';' : ',';
                        var cols = l.split(sep).map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
                        if (idx === 0 && /cod/i.test(cols[0] || '')) return;
                        if (cols[0] && cols[1]) {
                            nuevas.push({ codigo: cols[0], nombre: cols[1], tipo: (cols[2] || 'activo').toLowerCase(), grupo: cols[3] || 'otro' });
                        }
                    });
                    if (!nuevas.length) { D.avisar('El CSV debe tener columnas Código;Nombre;Tipo;Grupo.'); return; }
                    C.establecerPlanCuentas(nuevas);
                    guardarPlanPersonalizado();
                    refrescarTodo();
                    D.avisar('Plan personalizado importado (' + nuevas.length + ' cuentas).');
                });
            });
        }

        // Operación Renta DDJJ
        Array.prototype.forEach.call(document.querySelectorAll('[data-subddjj]'), function (btn) {
            btn.addEventListener('click', function () {
                ui.subDdjj = btn.getAttribute('data-subddjj');
                refrescarTodo();
            });
        });
        ['ddjj-socios-rut', 'ddjj-socios-nombre', 'ddjj-socios-pct', 'ddjj-retiros-totales'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('change', function () {
                guardarEstadoActual(function (est) {
                    est.socios = [{
                        rut: ($('ddjj-socios-rut') && $('ddjj-socios-rut').value.trim()) || '12.345.678-5',
                        nombre: ($('ddjj-socios-nombre') && $('ddjj-socios-nombre').value.trim()) || 'Socio titular',
                        porcentaje: Math.max(1, Math.min(100, D.parseDecimal($('ddjj-socios-pct') && $('ddjj-socios-pct').value) || 100)),
                        retiros: Math.max(0, Math.round(D.parseNumber($('ddjj-retiros-totales') && $('ddjj-retiros-totales').value)))
                    }];
                });
                refrescarTodo();
            });
        });
        [
            ['cpt-anterior', 'cptAnterior'],
            ['cpt-aumentos', 'aumentosCapital'],
            ['cpt-disminuciones', 'disminucionesCapital'],
            ['cpt-retiros', 'retirosDividendos'],
            ['cpt-rechazados', 'gastosRechazados'],
            ['cpt-idpc', 'idpcPagado'],
            ['cpt-cap-aportado', 'capitalAportadoReajustado']
        ].forEach(function (par) {
            var el = $(par[0]);
            if (!el) return;
            el.addEventListener('change', function () {
                guardarEstadoActual(function (est) {
                    est.cptAjustes[par[1]] = Math.round(D.parseNumber(el.value));
                });
                refrescarTodo();
            });
        });
        if ($('btn-dj1887-csv')) {
            $('btn-dj1887-csv').addEventListener('click', function () {
                var dj = calcularModelo().ddjj.dj1887;
                if (!dj || !dj.ok) { D.avisar(dj && dj.error ? dj.error : 'Sin datos DJ 1887.'); return; }
                descargarCsvTexto('Borrador_DJ_1887_' + clienteSlug() + '_AT2026.csv', dj.csv);
            });
        }
        if ($('btn-dj1879-csv')) {
            $('btn-dj1879-csv').addEventListener('click', function () {
                var dj = calcularModelo().ddjj.dj1879;
                if (!dj || !dj.ok) { D.avisar(dj && dj.error ? dj.error : 'Sin datos DJ 1879.'); return; }
                descargarCsvTexto('Borrador_DJ_1879_' + clienteSlug() + '_AT2026.csv', dj.csv);
            });
        }
        if ($('btn-dj194x-csv')) {
            $('btn-dj194x-csv').addEventListener('click', function () {
                var dj = calcularModelo().ddjj.dj194x;
                if (!dj || !dj.ok) { D.avisar(dj && dj.error ? dj.error : 'Sin datos DJ 1947/1948.'); return; }
                descargarCsvTexto('Borrador_DJ_' + dj.codigoDj + '_' + clienteSlug() + '_AT2026.csv', dj.csv);
            });
        }
        if ($('btn-dj1887-cert-pdf')) $('btn-dj1887-cert-pdf').addEventListener('click', imprimirCertificadoN6);
        if ($('btn-dj1879-cert-pdf')) $('btn-dj1879-cert-pdf').addEventListener('click', imprimirCertificadoN1);

        // Etapa 2 · TOP 2: Activo Fijo Tributario
        if ($('btn-af-agregar')) {
            $('btn-af-agregar').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var desc = ($('af-desc') && $('af-desc').value.trim()) || '';
                var val = Math.max(0, Math.round(D.parseNumber($('af-valor') && $('af-valor').value)));
                if (!desc || !val) {
                    D.avisar('Ingresa descripción y valor neto del bien.');
                    return;
                }
                var nuevo = {
                    id: 'AF-' + Date.now(),
                    descripcion: desc,
                    fechaCompra: periodoActual() + '-15',
                    valorNetoPagado: val,
                    ivaNoRecuperable: Math.max(0, Math.round(D.parseNumber($('af-iva-norec') && $('af-iva-norec').value))),
                    vidaUtilNormalAnios: Math.max(1, Math.round(D.parseNumber($('af-vida') && $('af-vida').value) || 5)),
                    mesesUsoEjercicio: Math.max(1, Math.min(12, Math.round(D.parseNumber($('af-meses') && $('af-meses').value) || 12))),
                    modalidad14A: ($('af-mod14a') && $('af-mod14a').value) || 'normal',
                    pagado: $('af-pagado') ? $('af-pagado').checked : true,
                    esUsado: $('af-usado') ? $('af-usado').checked : false,
                    esTerreno: $('af-terreno') ? $('af-terreno').checked : false
                };
                guardarEstadoActual(function (est) {
                    est.activosFijos.push(nuevo);
                });
                if ($('af-desc')) $('af-desc').value = '';
                if ($('af-valor')) $('af-valor').value = '';
                refrescarTodo();
                D.avisar('Activo fijo "' + desc + '" agregado al cálculo tributario.');
            });
        }
        if ($('tbody-activo-fijo')) {
            $('tbody-activo-fijo').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-af-borrar]');
                if (!btn) return;
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var idAf = btn.getAttribute('data-af-borrar');
                guardarEstadoActual(function (est) {
                    est.activosFijos = (est.activosFijos || []).filter(function (x) { return String(x.id) !== String(idAf); });
                });
                refrescarTodo();
            });
        }
        if ($('btn-af-importar-rcv')) {
            $('btn-af-importar-rcv').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var m = calcularModelo();
                var docsAf = (m.compras && Array.isArray(m.compras.documentos) ? m.compras.documentos : []).filter(function (d) {
                    return !d.esResumen && !d.resta && (Number(d.ivaActivoFijo) || 0) > 0;
                });
                var agregado = 0;
                guardarEstadoActual(function (est) {
                    var idsExist = {};
                    (est.activosFijos || []).forEach(function (a) { idsExist[String(a.id)] = true; });
                    if (docsAf.length) {
                        docsAf.forEach(function (d, idx) {
                            var aid = 'AF-RCV-' + (d.folio || idx);
                            if (idsExist[aid]) return;
                            var netoDoc = Math.max(0, Math.round(Number(d.neto) || Math.round((Number(d.ivaActivoFijo) || 0) / 0.19)));
                            if (!netoDoc) return;
                            est.activosFijos.push({
                                id: aid,
                                descripcion: (d.razonSocial || 'Compra activo fijo') + ' (DTE ' + (d.folio || idx) + ')',
                                fechaCompra: d.fecha || (periodoActual() + '-15'),
                                valorNetoPagado: netoDoc,
                                ivaNoRecuperable: 0,
                                vidaUtilNormalAnios: 7,
                                mesesUsoEjercicio: 12,
                                modalidad14A: 'acelerada_1_3',
                                pagado: est.tesoreria ? !!est.tesoreria.activoFijoPagado : true,
                                esUsado: false,
                                esTerreno: false
                            });
                            agregado += 1;
                        });
                    } else if (m.compras && m.compras.netoActivoFijo > 0) {
                        var aidGlob = 'AF-RCV-GLOBAL-' + periodoActual();
                        if (!idsExist[aidGlob]) {
                            est.activosFijos.push({
                                id: aidGlob,
                                descripcion: 'Compras activo fijo RCV ' + periodoActual(),
                                fechaCompra: periodoActual() + '-15',
                                valorNetoPagado: Math.round(m.compras.netoActivoFijo),
                                ivaNoRecuperable: 0,
                                vidaUtilNormalAnios: 7,
                                mesesUsoEjercicio: 12,
                                modalidad14A: 'acelerada_1_3',
                                pagado: est.tesoreria ? !!est.tesoreria.activoFijoPagado : true,
                                esUsado: false,
                                esTerreno: false
                            });
                            agregado += 1;
                        }
                    }
                });
                refrescarTodo();
                D.avisar(agregado ? ('Se importaron ' + agregado + ' bien(es) desde compras de activo fijo del RCV.') : 'No hay nuevos activos fijos detectados en el RCV actual.');
            });
        }
        if ($('btn-af-asiento-diario')) {
            $('btn-af-asiento-diario').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var m = calcularModelo();
                var depTrib = m.activoFijo ? m.activoFijo.totalDepreciacionTributaria : 0;
                if (!depTrib) { D.avisar('No hay depreciación tributaria > $0 para contabilizar.'); return; }
                var fecha = periodoActual() + '-28';
                var glosa = 'Depreciación tributaria del período (' + m.f29.regimenNombre + ')';
                guardarEstadoActual(function (est) {
                    est.manuales = (est.manuales || []).filter(function (a) { return !/^MAN-AF-/.test(String(a.id || '')); });
                    est.manuales.push({
                        id: 'MAN-AF-' + periodoActual(),
                        fecha: fecha,
                        glosa: glosa,
                        origen: 'ajuste',
                        lineas: [
                            { cuenta: '42060', debe: depTrib, haber: 0 },
                            { cuenta: '12015', debe: 0, haber: depTrib }
                        ]
                    });
                });
                ui.modulo = 'libros';
                ui.subLibro = 'diario';
                cambiarModulo('libros');
                D.avisar('Asiento de depreciación (' + D.money(depTrib) + ') centralizado en Libro Diario.');
            });
        }

        // Etapa 2 · TOP 3: Conciliación Bancaria con Reglas + Carga directa en Bancos
        conectarInputCartola('btn-bancos-subir-cartola', 'file-bancos-cartola');
        if ($('btn-bancos-ejemplo') && Imp) {
            $('btn-bancos-ejemplo').addEventListener('click', function () {
                aplicarTextoCartola(Imp.ejemploCartolaCsv(periodoActual()));
            });
        }

        if ($('btn-regla-agregar')) {
            $('btn-regla-agregar').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var patron = ($('regla-patron') && $('regla-patron').value.trim()) || '';
                if (!patron || patron.length < 2) { D.avisar('Escribe al menos 2 caracteres en palabra clave.'); return; }
                var nueva = {
                    id: 'REG-' + Date.now(),
                    tipo: ($('regla-tipo') && $('regla-tipo').value) || 'cargo',
                    patron: patron,
                    cuenta: ($('regla-cuenta') && $('regla-cuenta').value) || '42040',
                    motivo: ($('regla-motivo') && $('regla-motivo').value.trim()) || ('Regla "' + patron + '"')
                };
                guardarEstadoActual(function (est) {
                    est.reglasConciliacion.push(nueva);
                });
                if ($('regla-patron')) $('regla-patron').value = '';
                if ($('regla-motivo')) $('regla-motivo').value = '';
                refrescarTodo();
                D.avisar('Regla de conciliación guardada y aplicada.');
            });
        }
        if ($('conc-reglas-lista')) {
            $('conc-reglas-lista').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-regla-del]');
                if (!btn) return;
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var idR = btn.getAttribute('data-regla-del');
                guardarEstadoActual(function (est) {
                    est.reglasConciliacion = (est.reglasConciliacion || []).filter(function (x) { return String(x.id) !== String(idR); });
                });
                refrescarTodo();
            });
        }
        if ($('btn-conc-centralizar')) {
            $('btn-conc-centralizar').addEventListener('click', function () {
                if (leerEstadoActual().cerradoTributario) { D.avisar('El período está cerrado.'); return; }
                var m = calcularModelo();
                var filas = (m.conciliacion && m.conciliacion.filas) ? m.conciliacion.filas : [];
                var conciliados = filas.filter(function (f) { return f.estado === 'conciliado' && f.monto > 0; });
                if (!conciliados.length) {
                    D.avisar('No hay movimientos conciliados para centralizar. Carga primero la cartola ejemplo.');
                    return;
                }
                var nuevos = conciliados.map(function (f, i) {
                    var lineas = f.tipo === 'abono'
                        ? [{ cuenta: '11010', debe: f.monto, haber: 0 }, { cuenta: f.cuenta || '11050', debe: 0, haber: f.monto }]
                        : [{ cuenta: f.cuenta || '42040', debe: f.monto, haber: 0 }, { cuenta: '11010', debe: 0, haber: f.monto }];
                    return {
                        id: 'MAN-CONC-' + periodoActual() + '-' + (i + 1),
                        fecha: f.fecha || (periodoActual() + '-28'),
                        glosa: 'Conciliación bancaria: ' + f.glosa + ' (' + f.detalleMatch + ')',
                        origen: 'ajuste',
                        lineas: lineas
                    };
                });
                guardarEstadoActual(function (est) {
                    est.manuales = (est.manuales || []).filter(function (a) { return !/^MAN-CONC-/.test(String(a.id || '')); }).concat(nuevos);
                });
                ui.subLibro = 'diario';
                cambiarModulo('libros');
                D.avisar('Se centralizaron ' + nuevos.length + ' movimientos conciliados en Libro Diario.');
            });
        }

        // Confirmar / Descartar match bancario Tipo B / C
        if ($('tbody-conciliacion')) {
            $('tbody-conciliacion').addEventListener('click', function (ev) {
                if (leerEstadoActual().cerradoTributario) return;
                var btnOk = ev.target.closest('[data-match-confirmar]');
                if (btnOk) {
                    var idM = btnOk.getAttribute('data-match-confirmar');
                    guardarEstadoActual(function (est) {
                        est.matchesConfirmados = est.matchesConfirmados || {};
                        est.matchesDescartados = est.matchesDescartados || {};
                        est.matchesConfirmados[idM] = true;
                        delete est.matchesDescartados[idM];
                    });
                    refrescarTodo();
                    D.avisar('Match bancario confirmado y factura rebajada de la cartera.');
                    return;
                }
                var btnNo = ev.target.closest('[data-match-descartar]');
                if (btnNo) {
                    var idD = btnNo.getAttribute('data-match-descartar');
                    guardarEstadoActual(function (est) {
                        est.matchesConfirmados = est.matchesConfirmados || {};
                        est.matchesDescartados = est.matchesDescartados || {};
                        est.matchesDescartados[idD] = true;
                        delete est.matchesConfirmados[idD];
                    });
                    refrescarTodo();
                    D.avisar('Sugerencia descartada; puedes asignar regla manual.');
                }
            });
        }

        // Toggle factura a factura en Cartera CxC / CxP
        ['tbody-aging-cxc', 'tbody-aging-cxp'].forEach(function (tbodyId) {
            var tb = $(tbodyId);
            if (!tb) return;
            tb.addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-cartera-key]');
                if (!btn || leerEstadoActual().cerradoTributario) return;
                var tipoC = btn.getAttribute('data-cartera-tipo');
                var keyC = btn.getAttribute('data-cartera-key');
                var nextC = btn.getAttribute('data-cartera-next');
                guardarEstadoActual(function (est) {
                    est.carteraEstado = est.carteraEstado || { cxc: {}, cxp: {} };
                    est.carteraEstado[tipoC] = est.carteraEstado[tipoC] || {};
                    est.carteraEstado[tipoC][keyC] = nextC;
                });
                refrescarTodo();
                D.avisar(nextC === 'PAGADA' ? 'Factura marcada como pagada en cartera.' : 'Factura reabierta como pendiente.');
            });
        });

        // Etapa 2 · TOP 4: Propuesta F22 (IDPC vs PPM Cód. 36 L85)
        ['f22-ppm-anual', 'f22-factor-ppm', 'f22-otros-creditos'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', function () {
                guardarEstadoActual(function (est) {
                    est.f22Ajustes.ppmManual = ($('f22-ppm-anual') && $('f22-ppm-anual').value.trim() !== '')
                        ? Math.max(0, Math.round(D.parseNumber($('f22-ppm-anual').value)))
                        : '';
                    est.f22Ajustes.factorPpm = Math.max(1, D.parseDecimal($('f22-factor-ppm') && $('f22-factor-ppm').value) || 1);
                    est.f22Ajustes.otrosCreditos = Math.max(0, Math.round(D.parseNumber($('f22-otros-creditos') && $('f22-otros-creditos').value)));
                });
                refrescarTodo();
            });
        });
        if ($('btn-f22-usar-f29')) {
            $('btn-f22-usar-f29').addEventListener('click', function () {
                var m = calcularModelo();
                var ppmF29 = (m.f29 && m.f29.codigos && m.f29.codigos[62]) ? m.f29.codigos[62] : 0;
                guardarEstadoActual(function (est) {
                    est.f22Ajustes.ppmManual = ppmF29;
                });
                refrescarTodo();
                D.avisar('PPM del F29 actual (' + D.money(ppmF29) + ') cargado en Propuesta F22.');
            });
        }
        if ($('btn-f22-pdf')) {
            $('btn-f22-pdf').addEventListener('click', function () {
                var m = calcularModelo();
                var f22 = m.f22;
                if (!f22) return;
                var filasHtml = (f22.lineasF22 || []).map(function (ln) {
                    return '<tr' + (ln.destacado ? ' class="total"' : '') + '><td>' + D.esc(ln.codigo) + '</td><td>' + D.esc(ln.concepto) + '</td><td class="r">' + moneySigno(ln.monto) + '</td></tr>';
                }).join('');
                imprimirHtmlModulo(
                    'Propuesta Preliminar Formulario 22 (AT ' + f22.anioTributario + ')',
                    m.f29.regimenNombre + ' · ' + f22.fuenteTasa,
                    '<table class="print-table"><thead><tr><th>Línea / Código</th><th>Concepto</th><th class="r">Monto ($)</th></tr></thead><tbody>' + filasHtml + '</tbody></table>',
                    f22.notaNormativa
                );
            });
        }

        // Reportes PDF con Membrete
        if ($('btn-rep-guardar-membrete')) {
            $('btn-rep-guardar-membrete').addEventListener('click', function () {
                guardarMembrete({
                    estudio: ($('rep-estudio-nombre') && $('rep-estudio-nombre').value.trim()) || 'Estudio Contable Chile',
                    rut: ($('rep-estudio-rut') && $('rep-estudio-rut').value.trim()) || '76.543.210-K',
                    contador: ($('rep-contador-nombre') && $('rep-contador-nombre').value.trim()) || 'Contador Auditor',
                    pie: ($('rep-estudio-pie') && $('rep-estudio-pie').value.trim()) || ''
                });
                pintarReportes();
                D.avisar('Membrete del estudio guardado.');
            });
        }
        if ($('btn-rep-cert6')) $('btn-rep-cert6').addEventListener('click', imprimirCertificadoN6);
        if ($('btn-rep-cert1')) $('btn-rep-cert1').addEventListener('click', imprimirCertificadoN1);
        if ($('btn-rep-whatsapp')) {
            $('btn-rep-whatsapp').addEventListener('click', function () {
                var m = calcularModelo();
                pintarReportes(m);
                var texto = generarTextoWhatsapp(m);
                copiarTextoPortapapeles(texto, 'Resumen ejecutivo copiado para WhatsApp del cliente.');
            });
        }
        if ($('btn-rep-resumen')) {
            $('btn-rep-resumen').addEventListener('click', function () {
                var m = calcularModelo();
                var cantTrab = resultadosNominaActiva().filter(function (r) { return !r.error; }).length;
                var html = '<div class="print-data">' +
                    '<div><b>Régimen Tributario SII:</b> ' + D.esc(m.f29.regimenNombre) + '</div>' +
                    '<div><b>Trabajadores en nómina:</b> ' + cantTrab + '</div>' +
                    '<div><b>Débito Fiscal IVA (cód. 538):</b> ' + D.money(m.f29.codigos[538]) + '</div>' +
                    '<div><b>Crédito Fiscal IVA (cód. 537):</b> ' + D.money(m.f29.codigos[537]) + '</div>' +
                    '</div>' +
                    '<table class="print-table"><thead><tr><th>Indicador del Período</th><th class="r">Valor</th></tr></thead><tbody>' +
                    '<tr><td>Ingresos de Explotación (P&amp;L)</td><td class="r">' + D.money(m.pnl.ingresosGiro) + '</td></tr>' +
                    '<tr><td>Margen Bruto de Explotación</td><td class="r">' + moneySigno(m.pnl.margenBruto) + ' (' + D.num(m.pnl.margenBrutoPct, 1) + '%)</td></tr>' +
                    '<tr><td>Resultado Antes de Impuesto</td><td class="r">' + moneySigno(m.pnl.resultadoAntesImpuesto) + '</td></tr>' +
                    '<tr><td>Base RLI ProPyme (Art. 14 D N°3)</td><td class="r">' + moneySigno(m.rli.baseImponible) + '</td></tr>' +
                    '<tr><td>Impuesto 1ª Categoría Simulado (' + D.num(m.rli.tasaIdpcSimulada, 2) + '%)</td><td class="r">' + D.money(m.rli.idpcSimulado) + '</td></tr>' +
                    '<tr><td>Caja Libre Proyectada Post Impuestos</td><td class="r">' + moneySigno(m.flujo.cajaProyectadaPostImpuestos) + '</td></tr>' +
                    '<tr class="total"><td>Total a Pagar F29 (cód. 91)</td><td class="r">' + D.money(m.f29.codigos[91]) + '</td></tr>' +
                    '</tbody></table>';
                imprimirHtmlModulo('Resumen Mensual para el Cliente', m.f29.regimenNombre, html, 'Incluye F29 borrador, resultados del período y base tributaria.');
            });
        }
        if ($('btn-rep-f29')) {
            $('btn-rep-f29').addEventListener('click', function () {
                if ($('btn-f29-pdf')) $('btn-f29-pdf').click();
            });
        }

        // Eventos cruzados desde Liquidaciones / Cliente
        document.addEventListener('demo:liquidaciones', refrescarTodo);
        document.addEventListener('demo:cliente', refrescarTodo);
        window.addEventListener('hashchange', function () {
            var mHash = String(location.hash || '').replace(/^#/, '');
            if (MODULOS_VALIDOS.test(mHash) && mHash !== ui.modulo) {
                cambiarModulo(mHash, { sinHash: true });
            }
        });

        cambiarModulo(moduloDesdeUbicacion());
    });
})();
