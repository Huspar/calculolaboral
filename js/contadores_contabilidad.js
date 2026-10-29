/*
 * CalculoLaboral · Motor Contable de Partida Doble, Libro Diario/Mayor,
 * Balance Tributario de 8 Columnas, RLI ProPyme (Art. 14 D N°3), P&L y Flujo de Caja (v1.0.0).
 * Funciona en el navegador (window.CLContabilidad) y en Node (require).
 */
(function (root) {
    'use strict';

    var PLAN_CUENTAS = [
        { codigo: '11010', nombre: 'Banco cuenta corriente', tipo: 'activo', grupo: 'disponible' },
        { codigo: '11050', nombre: 'Clientes por cobrar', tipo: 'activo', grupo: 'cxc' },
        { codigo: '11080', nombre: 'IVA crédito fiscal', tipo: 'activo', grupo: 'impuestos' },
        { codigo: '11085', nombre: 'Remanente crédito fiscal IVA', tipo: 'activo', grupo: 'impuestos' },
        { codigo: '11090', nombre: 'Pagos provisionales mensuales (PPM)', tipo: 'activo', grupo: 'impuestos' },
        { codigo: '12010', nombre: 'Maquinaria y equipos (activo fijo)', tipo: 'activo', grupo: 'activo_fijo' },
        { codigo: '12015', nombre: 'Depreciación acumulada activo fijo', tipo: 'pasivo', grupo: 'complementaria' },
        { codigo: '21010', nombre: 'Proveedores por pagar', tipo: 'pasivo', grupo: 'cxp' },
        { codigo: '21025', nombre: 'Honorarios por pagar', tipo: 'pasivo', grupo: 'honorarios' },
        { codigo: '21030', nombre: 'Remuneraciones por pagar', tipo: 'pasivo', grupo: 'laboral' },
        { codigo: '21035', nombre: 'Cotizaciones previsionales por pagar', tipo: 'pasivo', grupo: 'laboral' },
        { codigo: '21040', nombre: 'Impuesto único 2ª cat. por pagar (cód. 48)', tipo: 'pasivo', grupo: 'impuestos' },
        { codigo: '21045', nombre: 'Otros descuentos laborales por pagar', tipo: 'pasivo', grupo: 'laboral' },
        { codigo: '21050', nombre: 'IVA débito fiscal', tipo: 'pasivo', grupo: 'impuestos' },
        { codigo: '21060', nombre: 'Retención honorarios por pagar (cód. 151)', tipo: 'pasivo', grupo: 'impuestos' },
        { codigo: '21070', nombre: 'Impuestos F29 por pagar', tipo: 'pasivo', grupo: 'impuestos' },
        { codigo: '31010', nombre: 'Capital social', tipo: 'patrimonio', grupo: 'patrimonio' },
        { codigo: '31020', nombre: 'Resultados acumulados', tipo: 'patrimonio', grupo: 'patrimonio' },
        { codigo: '41010', nombre: 'Costo de ventas e insumos del giro', tipo: 'perdida', grupo: 'costo_ventas' },
        { codigo: '42010', nombre: 'Sueldos y haberes imponibles', tipo: 'perdida', grupo: 'opex_laboral' },
        { codigo: '42012', nombre: 'Asignaciones no imponibles', tipo: 'perdida', grupo: 'opex_laboral' },
        { codigo: '42015', nombre: 'Aporte empleador y leyes sociales', tipo: 'perdida', grupo: 'opex_laboral' },
        { codigo: '42020', nombre: 'Honorarios profesionales', tipo: 'perdida', grupo: 'opex_honorarios' },
        { codigo: '42040', nombre: 'Gastos generales y supermercados', tipo: 'perdida', grupo: 'opex_admin' },
        { codigo: '42060', nombre: 'Depreciación del ejercicio', tipo: 'perdida', grupo: 'depreciacion' },
        { codigo: '42090', nombre: 'IVA no recuperable y otros gastos', tipo: 'perdida', grupo: 'opex_admin' },
        { codigo: '42095', nombre: 'Multas e intereses fiscales (art. 21 y 31)', tipo: 'perdida', grupo: 'gasto_rechazado' },
        { codigo: '51010', nombre: 'Ventas afectas del giro', tipo: 'ganancia', grupo: 'ingreso_giro' },
        { codigo: '51020', nombre: 'Ventas y servicios exentos', tipo: 'ganancia', grupo: 'ingreso_giro' },
        { codigo: '52010', nombre: 'Otros ingresos fuera del giro', tipo: 'ganancia', grupo: 'ingreso_otro' }
    ];

    var MAPA_CUENTAS = {};
    PLAN_CUENTAS.forEach(function (c) { MAPA_CUENTAS[c.codigo] = c; });

    function entero(v) { return Math.max(0, Math.round(Number(v) || 0)); }

    function cuentaInfo(codigo) {
        return MAPA_CUENTAS[String(codigo)] || { codigo: String(codigo || '99999'), nombre: 'Cuenta ' + (codigo || 's/c'), tipo: 'activo', grupo: 'otro' };
    }

    function ultimoDiaMes(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || '2026-10'));
        if (!m) return '2026-10-31';
        var d = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0));
        var dd = d.getUTCDate();
        return m[1] + '-' + m[2] + '-' + (dd < 10 ? '0' + dd : String(dd));
    }

    function crearAsiento(id, fecha, glosa, origen, lineasRaw) {
        var lineas = [], debe = 0, haber = 0;
        (lineasRaw || []).forEach(function (l) {
            var d = entero(l.debe), h = entero(l.haber);
            if (!d && !h) return;
            var cta = cuentaInfo(l.cuenta);
            lineas.push({
                cuenta: cta.codigo,
                nombre: l.nombre || cta.nombre,
                tipo: cta.tipo,
                debe: d,
                haber: h
            });
            debe += d;
            haber += h;
        });
        if (!lineas.length) return null;
        return {
            id: id,
            fecha: fecha,
            glosa: glosa,
            origen: origen || 'automatico', // 'automatico' | 'auditado' | 'ajuste'
            lineas: lineas,
            debe: debe,
            haber: haber,
            cuadra: debe === haber
        };
    }

    /*
     * Construye los asientos automaticos del periodo mas los ajustes manuales del contador.
     * Todo asiento automatico nace cuadrado al peso.
     */
    function generarAsientos(entrada) {
        var e = entrada || {};
        var periodo = e.periodo || '2026-10';
        var iniFecha = periodo + '-01';
        var finFecha = ultimoDiaMes(periodo);
        var f29 = e.f29 || null;
        var ventas = e.ventas || null;
        var compras = e.compras || null;
        var nomina = e.nomina || null; // salida de resumenNomina() o CLDemoArchivos.asiento
        var tes = Object.assign({
            saldoInicialBanco: 6500000,
            pctVentasCobradas: 80,
            pctComprasPagadas: 75,
            activoFijoPagado: true,
            sueldosPagados: true,
            honorariosPagados: true,
            cotizacionesPagadas: false
        }, e.tesoreria || {});

        var asientos = [];
        var nro = 1;
        function sigId(pref) { return pref + '-' + (nro++); }

        // 1. Apertura del periodo (Banco inicial + eventual remanente IVA anterior contra Capital/Resultados)
        var bancoIni = entero(tes.saldoInicialBanco);
        var remAnt = f29 ? entero(f29.codigos[504]) : 0;
        if (bancoIni > 0 || remAnt > 0) {
            var linAp = [];
            if (bancoIni > 0) linAp.push({ cuenta: '11010', debe: bancoIni, haber: 0 });
            if (remAnt > 0) linAp.push({ cuenta: '11085', debe: remAnt, haber: 0 });
            linAp.push({ cuenta: '31010', debe: 0, haber: bancoIni + remAnt });
            var aAp = crearAsiento(sigId('AP'), iniFecha, 'Apertura y saldos iniciales del periodo ' + periodo, 'automatico', linAp);
            if (aAp) asientos.push(aAp);
        }

        // 2. Centralizacion RCV Ventas
        var totalBrutoVentas = 0;
        var netoVentasAfectas = 0;
        var netoVentasExentas = 0;
        var netoVentasFueraGiro = 0;
        if (ventas && f29) {
            netoVentasAfectas = Math.max(0, entero(ventas.netoGiro) + entero(ventas.netoBoletas39) + entero(ventas.netoNotasDebito) - entero(ventas.netoNotasCredito));
            netoVentasExentas = Math.max(0, entero(ventas.exentoGiro) + entero(ventas.exentoBoletas41));
            netoVentasFueraGiro = entero(ventas.netoFueraGiro);
            var ivaDeb = entero(f29.codigos[538]);
            totalBrutoVentas = netoVentasAfectas + netoVentasExentas + netoVentasFueraGiro + ivaDeb;
            if (totalBrutoVentas > 0) {
                var aVen = crearAsiento(sigId('VEN'), finFecha, 'Centralizacion libro de ventas RCV ' + periodo, 'automatico', [
                    { cuenta: '11050', debe: totalBrutoVentas, haber: 0 },
                    { cuenta: '51010', debe: 0, haber: netoVentasAfectas },
                    { cuenta: '51020', debe: 0, haber: netoVentasExentas },
                    { cuenta: '52010', debe: 0, haber: netoVentasFueraGiro },
                    { cuenta: '21050', debe: 0, haber: ivaDeb }
                ]);
                if (aVen) asientos.push(aVen);
            }
        }

        // 3. Centralizacion RCV Compras
        var totalBrutoCompras = 0;
        var costoGiroNeto = 0;
        var gastoSuperNeto = 0;
        var activoFijoNeto = 0;
        var ivaNoRec = 0;
        var ivaCredMes = 0;
        if (compras && f29) {
            costoGiroNeto = Math.max(0, entero(compras.netoGiro) + entero(compras.exentoGiro) + entero(compras.netoNotasDebito) - entero(compras.netoNotasCredito));
            gastoSuperNeto = entero(compras.netoSupermercado);
            activoFijoNeto = entero(compras.netoActivoFijo);
            ivaNoRec = entero(compras.ivaNoRecuperable);
            ivaCredMes = Math.max(0, entero(f29.codigos[537]) - entero(f29.codigos[504]));
            totalBrutoCompras = costoGiroNeto + gastoSuperNeto + activoFijoNeto + ivaNoRec + ivaCredMes;
            if (totalBrutoCompras > 0) {
                var aCom = crearAsiento(sigId('COM'), finFecha, 'Centralizacion libro de compras RCV ' + periodo, 'automatico', [
                    { cuenta: '41010', debe: costoGiroNeto, haber: 0 },
                    { cuenta: '42040', debe: gastoSuperNeto, haber: 0 },
                    { cuenta: '12010', debe: activoFijoNeto, haber: 0 },
                    { cuenta: '42090', debe: ivaNoRec, haber: 0 },
                    { cuenta: '11080', debe: ivaCredMes, haber: 0 },
                    { cuenta: '21010', debe: 0, haber: totalBrutoCompras }
                ]);
                if (aCom) asientos.push(aCom);
            }
        }

        // 4. Centralizacion Boletas de Honorarios
        var honBruto = f29 ? entero(f29.resumen.honorariosBruto) : 0;
        var honRet151 = f29 ? entero(f29.codigos[151]) : 0;
        var honLiquido = Math.max(0, honBruto - honRet151);
        if (honBruto > 0) {
            var aHon = crearAsiento(sigId('HON'), finFecha, 'Centralizacion boletas de honorarios ' + periodo, 'automatico', [
                { cuenta: '42020', debe: honBruto, haber: 0 },
                { cuenta: '21060', debe: 0, haber: honRet151 },
                { cuenta: '21025', debe: 0, haber: honLiquido }
            ]);
            if (aHon) asientos.push(aHon);
        }

        // 5. Centralizacion Remuneraciones (desde lote calculado en Remuneraciones)
        var remSueldos = 0, remNoImp = 0, remAporte = 0, remLiquido = 0, remPrev = 0, remImp48 = 0, remOtros = 0;
        if (nomina && nomina.totalDebe > 0) {
            remSueldos = entero(nomina.sueldos);
            remNoImp = entero(nomina.noImponibles);
            remAporte = entero(nomina.cotEmpleador);
            remLiquido = entero(nomina.liquido);
            remPrev = entero(nomina.previsionales);
            remImp48 = entero(nomina.impuesto48);
            remOtros = entero(nomina.otros);
            var aRem = crearAsiento(sigId('REM'), finFecha, 'Centralizacion remuneraciones y leyes sociales ' + periodo, 'automatico', [
                { cuenta: '42010', debe: remSueldos, haber: 0 },
                { cuenta: '42012', debe: remNoImp, haber: 0 },
                { cuenta: '42015', debe: remAporte, haber: 0 },
                { cuenta: '21030', debe: 0, haber: remLiquido },
                { cuenta: '21035', debe: 0, haber: remPrev },
                { cuenta: '21040', debe: 0, haber: remImp48 },
                { cuenta: '21045', debe: 0, haber: remOtros }
            ]);
            if (aRem) asientos.push(aRem);
        } else if (f29 && entero(f29.codigos[48]) > 0) {
            // Si el contador digito cod. 48 manual sin cargar nomina completa, reflejar solo cuando exista asiento manual o nomina.
            remImp48 = 0;
        }

        // 6. Movimientos de Banco / Tesoreria del periodo (cobranza y pagos efectivos)
        var pctCobro = Math.max(0, Math.min(100, Number(tes.pctVentasCobradas)));
        var cobroClientes = totalBrutoVentas > 0 ? Math.round(totalBrutoVentas * (pctCobro / 100)) : 0;
        if (cobroClientes > 0) {
            var aCob = crearAsiento(sigId('BCO'), finFecha, 'Recaudacion transferencias de clientes (' + pctCobro + '% cobrado)', 'automatico', [
                { cuenta: '11010', debe: cobroClientes, haber: 0 },
                { cuenta: '11050', debe: 0, haber: cobroClientes }
            ]);
            if (aCob) asientos.push(aCob);
        }

        // Separamos el activo fijo del resto de proveedores para controlar su pago exacto en RLI 14 D3
        var brutoActivoFijo = activoFijoNeto + (compras ? entero(compras.ivaActivoFijo) : 0);
        var brutoComprasGiro = Math.max(0, totalBrutoCompras - brutoActivoFijo);
        var pctPago = Math.max(0, Math.min(100, Number(tes.pctComprasPagadas)));
        var pagoComprasGiro = brutoComprasGiro > 0 ? Math.round(brutoComprasGiro * (pctPago / 100)) : 0;
        var pagoActivoFijo = (tes.activoFijoPagado && brutoActivoFijo > 0) ? brutoActivoFijo : 0;
        var pagoProveedores = pagoComprasGiro + pagoActivoFijo;
        var pagoSueldos = tes.sueldosPagados ? remLiquido : 0;
        var pagoCotiz = tes.cotizacionesPagadas ? remPrev : 0;
        var pagoHonorarios = tes.honorariosPagados ? honLiquido : 0;
        var totalEgresosBanco = pagoProveedores + pagoSueldos + pagoCotiz + pagoHonorarios;

        if (totalEgresosBanco > 0) {
            var aEgr = crearAsiento(sigId('BCO'), finFecha, 'Egresos bancarios del mes (proveedores, nomina y honorarios)', 'automatico', [
                { cuenta: '21010', debe: pagoProveedores, haber: 0 },
                { cuenta: '21030', debe: pagoSueldos, haber: 0 },
                { cuenta: '21035', debe: pagoCotiz, haber: 0 },
                { cuenta: '21025', debe: pagoHonorarios, haber: 0 },
                { cuenta: '11010', debe: 0, haber: totalEgresosBanco }
            ]);
            if (aEgr) asientos.push(aEgr);
        }

        // 7. Centralizacion Devengo F29 (compensa IVA Debito vs Credito, registra PPM y consolida pasivo F29 cod. 91)
        if (f29) {
            var cod538 = entero(f29.codigos[538]);
            var cod504 = entero(f29.codigos[504]);
            var cod89 = entero(f29.codigos[89]);
            var cod77 = entero(f29.codigos[77]);
            var cod62 = entero(f29.codigos[62]);
            var imp48EnLibro = remImp48;
            var totalPasivoF29 = cod89 + cod62 + imp48EnLibro + honRet151;
            if (cod538 > 0 || ivaCredMes > 0 || cod504 > 0 || totalPasivoF29 > 0 || cod77 > 0) {
                var aF29 = crearAsiento(sigId('F29'), finFecha, 'Centralizacion y determinacion F29 ' + periodo, 'automatico', [
                    { cuenta: '21050', debe: cod538, haber: 0 },
                    { cuenta: '11085', debe: cod77, haber: 0 },
                    { cuenta: '21040', debe: imp48EnLibro, haber: 0 },
                    { cuenta: '21060', debe: honRet151, haber: 0 },
                    { cuenta: '11090', debe: cod62, haber: 0 },
                    { cuenta: '11080', debe: 0, haber: ivaCredMes },
                    { cuenta: '11085', debe: 0, haber: cod504 },
                    { cuenta: '21070', debe: 0, haber: totalPasivoF29 }
                ]);
                if (aF29 && aF29.cuadra) asientos.push(aF29);
            }
        }

        // 8. Asientos manuales / reclasificaciones del contador
        (e.manuales || []).forEach(function (m, idx) {
            var am = crearAsiento(
                m.id || ('MAN-' + (idx + 1)),
                m.fecha || finFecha,
                m.glosa || 'Ajuste contable',
                m.origen || 'ajuste',
                m.lineas || []
            );
            if (am) asientos.push(am);
        });

        // Aplicar marcas de auditoria si el contador aprobo asientos
        var auditados = e.auditados || {};
        asientos.forEach(function (a) {
            if (auditados[a.id] && a.origen === 'automatico') a.origen = 'auditado';
        });

        return {
            asientos: asientos,
            metricasFlujo: {
                saldoInicialBanco: bancoIni,
                cobroClientes: cobroClientes,
                pagoProveedores: pagoProveedores,
                pagoSueldos: pagoSueldos,
                pagoCotizaciones: pagoCotiz,
                pagoHonorarios: pagoHonorarios,
                totalEgresos: totalEgresosBanco,
                pctVentasCobradas: pctCobro,
                pctComprasPagadas: pctPago,
                activoFijoNetoPagado: tes.activoFijoPagado ? activoFijoNeto : 0,
                activoFijoNetoPendiente: tes.activoFijoPagado ? 0 : activoFijoNeto,
                sueldosPagados: !!tes.sueldosPagados,
                honorariosPagados: !!tes.honorariosPagados,
                cotizacionesPagadas: !!tes.cotizacionesPagadas
            }
        };
    }

    function resumenNominaDesdeResultados(resultados, demoArchivos) {
        if (!Array.isArray(resultados) || !resultados.length || !demoArchivos) return null;
        var s = demoArchivos.asiento(resultados, { periodoNombre: '', cuentas: {} });
        if (!s || !s.cuadra || !s.debe) return null;
        var porGlosa = {};
        (s.filas || []).forEach(function (f) { porGlosa[f.glosa] = f; });
        function monto(g, lado) { return porGlosa[g] ? entero(porGlosa[g][lado]) : 0; }
        var sueldos = monto('Sueldos y haberes imponibles', 'debe');
        var noImp = monto('Haberes no imponibles (colación, movilización y otros)', 'debe');
        var cotEmp = monto('Cotizaciones de cargo del empleador', 'debe');
        var liquido = monto('Remuneraciones por pagar', 'haber');
        var imp48 = monto('Impuesto único por pagar', 'haber');
        var otros = monto('Anticipos, préstamos y otros descuentos', 'haber');
        var prev = entero(s.haber) - liquido - imp48 - otros;
        return {
            sueldos: sueldos,
            noImponibles: noImp,
            cotEmpleador: cotEmp,
            liquido: liquido,
            previsionales: Math.max(0, prev),
            impuesto48: imp48,
            otros: otros,
            totalDebe: entero(s.debe),
            totalHaber: entero(s.haber)
        };
    }

    function calcularMayor(asientos) {
        var cuentas = {};
        (asientos || []).forEach(function (a) {
            if (!a || !a.cuadra) return;
            (a.lineas || []).forEach(function (l) {
                var c = cuentaInfo(l.cuenta);
                if (!cuentas[c.codigo]) {
                    cuentas[c.codigo] = {
                        codigo: c.codigo,
                        nombre: c.nombre,
                        tipo: c.tipo,
                        grupo: c.grupo,
                        debito: 0,
                        credito: 0,
                        saldoDeudor: 0,
                        saldoAcreedor: 0,
                        movimientos: []
                    };
                }
                var m = cuentas[c.codigo];
                m.debito += entero(l.debe);
                m.credito += entero(l.haber);
                var neto = m.debito - m.credito;
                m.movimientos.push({
                    asientoId: a.id,
                    fecha: a.fecha,
                    glosa: a.glosa,
                    origen: a.origen,
                    debe: entero(l.debe),
                    haber: entero(l.haber),
                    saldoAcumulado: neto
                });
            });
        });

        var codigos = Object.keys(cuentas).sort();
        return codigos.map(function (cod) {
            var m = cuentas[cod];
            if (m.debito >= m.credito) {
                m.saldoDeudor = m.debito - m.credito;
                m.saldoAcreedor = 0;
            } else {
                m.saldoDeudor = 0;
                m.saldoAcreedor = m.credito - m.debito;
            }
            return m;
        });
    }

    /*
     * Balance Tributario de 8 Columnas (estructura SII Chile):
     * Sumas (Debito / Credito) | Saldos (Deudor / Acreedor) | Inventario (Activo / Pasivo) | Resultados (Perdida / Ganancia)
     */
    function calcularBalance8Columnas(mayor) {
        var filas = [];
        var tot = {
            debito: 0, credito: 0,
            deudor: 0, acreedor: 0,
            activo: 0, pasivo: 0,
            perdida: 0, ganancia: 0
        };

        (mayor || []).forEach(function (m) {
            var esInventario = (m.tipo === 'activo' || m.tipo === 'pasivo' || m.tipo === 'patrimonio');
            var activo = 0, pasivo = 0, perdida = 0, ganancia = 0;
            if (esInventario) {
                // En el balance de 8 columnas las cuentas de inventario llevan su saldo deudor a Activo y su saldo acreedor a Pasivo
                activo = m.saldoDeudor;
                pasivo = m.saldoAcreedor;
            } else {
                perdida = m.saldoDeudor;
                ganancia = m.saldoAcreedor;
            }
            filas.push({
                codigo: m.codigo,
                nombre: m.nombre,
                tipo: m.tipo,
                grupo: m.grupo,
                debito: m.debito,
                credito: m.credito,
                deudor: m.saldoDeudor,
                acreedor: m.saldoAcreedor,
                activo: activo,
                pasivo: pasivo,
                perdida: perdida,
                ganancia: ganancia
            });
            tot.debito += m.debito;
            tot.credito += m.credito;
            tot.deudor += m.saldoDeudor;
            tot.acreedor += m.saldoAcreedor;
            tot.activo += activo;
            tot.pasivo += pasivo;
            tot.perdida += perdida;
            tot.ganancia += ganancia;
        });

        // Resultado del ejercicio: Ganancia - Perdida === Activo - Pasivo
        var resultado = tot.ganancia - tot.perdida;
        var resInventario = tot.activo - tot.pasivo;

        var filaResultado = {
            utilidad: resultado > 0 ? resultado : 0,
            perdidaEjercicio: resultado < 0 ? Math.abs(resultado) : 0,
            activo: resultado < 0 ? Math.abs(resultado) : 0,
            pasivo: resultado > 0 ? resultado : 0,
            perdida: resultado > 0 ? resultado : 0,
            ganancia: resultado < 0 ? Math.abs(resultado) : 0
        };

        var sumasIguales = {
            debito: tot.debito,
            credito: tot.credito,
            deudor: tot.deudor,
            acreedor: tot.acreedor,
            activo: tot.activo + filaResultado.activo,
            pasivo: tot.pasivo + filaResultado.pasivo,
            perdida: tot.perdida + filaResultado.perdida,
            ganancia: tot.ganancia + filaResultado.ganancia
        };

        var cuadra = (
            tot.debito === tot.credito &&
            tot.deudor === tot.acreedor &&
            resultado === resInventario &&
            sumasIguales.activo === sumasIguales.pasivo &&
            sumasIguales.perdida === sumasIguales.ganancia
        );

        return {
            filas: filas,
            totales: tot,
            resultado: resultado,
            filaResultado: filaResultado,
            sumasIguales: sumasIguales,
            cuadra: cuadra
        };
    }

    /*
     * Hoja de trabajo RLI ProPyme General (Art. 14 letra D N°3 LIR)
     * Base percibida / pagada en valores netos (excluye IVA), depreciacion instantanea del activo fijo pagado,
     * sin correccion monetaria y con agregados por gastos rechazados/multas.
     */
    function calcularRliProPyme(balance, metricasFlujo, ajustesManualesRli) {
        var aj = ajustesManualesRli || {};
        var mf = metricasFlujo || {};
        var filas = (balance && balance.filas) || [];

        function sumarGrupo(fn) {
            return filas.filter(fn).reduce(function (s, f) { return s + (f.ganancia || f.perdida || f.activo || f.pasivo || 0); }, 0);
        }

        var ingresosDevengadosNetos = filas
            .filter(function (f) { return f.tipo === 'ganancia'; })
            .reduce(function (s, f) { return s + (f.ganancia - f.perdida); }, 0);

        var pctCobro = mf.pctVentasCobradas !== undefined ? Number(mf.pctVentasCobradas) : 100;
        var ventasNoCobradasNetas = aj.ventasNoCobradasNetas !== undefined && aj.ventasNoCobradasNetas !== ''
            ? entero(aj.ventasNoCobradasNetas)
            : Math.round(ingresosDevengadosNetos * ((100 - Math.max(0, Math.min(100, pctCobro))) / 100));
        var cobrosAnterioresNetos = entero(aj.cobrosAnterioresNetos);
        var ingresosPercibidos = Math.max(0, ingresosDevengadosNetos - ventasNoCobradasNetas + cobrosAnterioresNetos);

        var comprasGastosDevengados = filas
            .filter(function (f) { return f.grupo === 'costo_ventas' || f.grupo === 'opex_admin'; })
            .reduce(function (s, f) { return s + (f.perdida - f.ganancia); }, 0);

        var pctPago = mf.pctComprasPagadas !== undefined ? Number(mf.pctComprasPagadas) : 100;
        var comprasNoPagadasNetas = aj.comprasNoPagadasNetas !== undefined && aj.comprasNoPagadasNetas !== ''
            ? entero(aj.comprasNoPagadasNetas)
            : Math.round(comprasGastosDevengados * ((100 - Math.max(0, Math.min(100, pctPago))) / 100));
        var pagosAnterioresNetos = entero(aj.pagosAnterioresNetos);
        var comprasGastosPagados = Math.max(0, comprasGastosDevengados - comprasNoPagadasNetas + pagosAnterioresNetos);

        var gastoLaboralDevengado = filas
            .filter(function (f) { return f.grupo === 'opex_laboral'; })
            .reduce(function (s, f) { return s + (f.perdida - f.ganancia); }, 0);
        var gastoHonorariosDevengado = filas
            .filter(function (f) { return f.grupo === 'opex_honorarios'; })
            .reduce(function (s, f) { return s + (f.perdida - f.ganancia); }, 0);

        // Pasivos laborales/honorarios pendientes al cierre (21025, 21030, 21035, 21040, 21045) no estan pagados aun
        var pasivosLaboralesPendientes = filas
            .filter(function (f) { return ['21025', '21030', '21035', '21040', '21045'].indexOf(f.codigo) >= 0; })
            .reduce(function (s, f) { return s + f.pasivo; }, 0);

        var remuneracionesHonorariosPagados = Math.max(0, gastoLaboralDevengado + gastoHonorariosDevengado - pasivosLaboralesPendientes);

        var depreciacionContable = sumarGrupo(function (f) { return f.grupo === 'depreciacion'; });
        var activoFijoPagadoNeto = aj.activoFijoPagadoNeto !== undefined && aj.activoFijoPagadoNeto !== ''
            ? entero(aj.activoFijoPagadoNeto)
            : entero(mf.activoFijoNetoPagado);

        var multasGastosRechazados = filas
            .filter(function (f) { return f.grupo === 'gasto_rechazado'; })
            .reduce(function (s, f) { return s + f.perdida; }, 0) + entero(aj.otrosAgregados);

        var baseImponible = ingresosPercibidos
            - comprasGastosPagados
            - remuneracionesHonorariosPagados
            - activoFijoPagadoNeto
            + multasGastosRechazados;

        var ppmAcumulado = filas
            .filter(function (f) { return f.codigo === '11090'; })
            .reduce(function (s, f) { return s + f.activo; }, 0);

        var tasaIdpcSimulada = aj.tasaIdpc !== undefined && aj.tasaIdpc !== '' ? Math.max(0, Number(aj.tasaIdpc) || 0) : 12.5;
        var idpcSimulado = baseImponible > 0 ? Math.round(baseImponible * (tasaIdpcSimulada / 100)) : 0;
        var diferenciaF22Simulada = idpcSimulado - ppmAcumulado;

        return {
            resultadoContable: balance ? balance.resultado : 0,
            ingresosDevengadosNetos: ingresosDevengadosNetos,
            ventasNoCobradasNetas: ventasNoCobradasNetas,
            cobrosAnterioresNetos: cobrosAnterioresNetos,
            ingresosPercibidos: ingresosPercibidos,
            comprasGastosDevengados: comprasGastosDevengados,
            comprasNoPagadasNetas: comprasNoPagadasNetas,
            pagosAnterioresNetos: pagosAnterioresNetos,
            comprasGastosPagados: comprasGastosPagados,
            gastoLaboralHonorariosDevengado: gastoLaboralDevengado + gastoHonorariosDevengado,
            pasivosLaboralesPendientes: pasivosLaboralesPendientes,
            remuneracionesHonorariosPagados: remuneracionesHonorariosPagados,
            depreciacionContableReversada: depreciacionContable,
            activoFijoPagadoNeto: activoFijoPagadoNeto,
            multasGastosRechazados: multasGastosRechazados,
            baseImponible: baseImponible,
            ppmAcumulado: ppmAcumulado,
            tasaIdpcSimulada: tasaIdpcSimulada,
            idpcSimulado: idpcSimulado,
            diferenciaF22Simulada: diferenciaF22Simulada
        };
    }

    function calcularEstadoResultadosYFlujo(balance, metricasFlujo, f29) {
        var filas = (balance && balance.filas) || [];
        var mf = metricasFlujo || {};
        function netoGrupo(grp) {
            return filas.filter(function (f) { return f.grupo === grp; })
                .reduce(function (s, f) { return s + (f.tipo === 'ganancia' ? (f.ganancia - f.perdida) : (f.perdida - f.ganancia)); }, 0);
        }

        var ingresosGiro = netoGrupo('ingreso_giro');
        var otrosIngresos = netoGrupo('ingreso_otro');
        var totalIngresos = ingresosGiro + otrosIngresos;
        var costoVentas = netoGrupo('costo_ventas');
        var margenBruto = ingresosGiro - costoVentas;
        var margenBrutoPct = ingresosGiro > 0 ? Math.round((margenBruto / ingresosGiro) * 1000) / 10 : 0;

        var gastoLaboral = netoGrupo('opex_laboral');
        var gastoHonorarios = netoGrupo('opex_honorarios');
        var gastoAdmin = netoGrupo('opex_admin');
        var depreciacion = netoGrupo('depreciacion');
        var otrosRechazados = netoGrupo('gasto_rechazado');

        var resultadoOperacional = margenBruto - gastoLaboral - gastoHonorarios - gastoAdmin - depreciacion;
        var margenOperacionalPct = ingresosGiro > 0 ? Math.round((resultadoOperacional / ingresosGiro) * 1000) / 10 : 0;
        var resultadoAntesImpuesto = resultadoOperacional + otrosIngresos - otrosRechazados;

        var filaBanco = filas.filter(function (f) { return f.codigo === '11010'; })[0];
        var saldoFinalBanco = filaBanco ? (filaBanco.activo - filaBanco.pasivo) : 0;
        var compromisoPrevired = filas.filter(function (f) { return f.codigo === '21035'; })
            .reduce(function (s, f) { return s + f.pasivo; }, 0);
        var compromisoF29 = f29 ? entero(f29.codigos[91]) : filas.filter(function (f) { return f.codigo === '21070'; })
            .reduce(function (s, f) { return s + f.pasivo; }, 0);
        var cajaPostObligaciones = saldoFinalBanco - compromisoPrevired - compromisoF29;

        return {
            pnl: {
                ingresosGiro: ingresosGiro,
                otrosIngresos: otrosIngresos,
                totalIngresos: totalIngresos,
                costoVentas: costoVentas,
                margenBruto: margenBruto,
                margenBrutoPct: margenBrutoPct,
                gastoLaboral: gastoLaboral,
                gastoHonorarios: gastoHonorarios,
                gastoAdmin: gastoAdmin,
                depreciacion: depreciacion,
                otrosGastosNoDeducibles: otrosRechazados,
                resultadoOperacional: resultadoOperacional,
                margenOperacionalPct: margenOperacionalPct,
                resultadoAntesImpuesto: resultadoAntesImpuesto
            },
            flujo: {
                saldoInicialBanco: entero(mf.saldoInicialBanco),
                entradasCobrosClientes: entero(mf.cobroClientes),
                salidasProveedores: entero(mf.pagoProveedores),
                salidasSueldos: entero(mf.pagoSueldos),
                salidasCotizaciones: entero(mf.pagoCotizaciones),
                salidasHonorarios: entero(mf.pagoHonorarios),
                saldoDisponibleBanco: saldoFinalBanco,
                compromisoPreviredDia13: compromisoPrevired,
                compromisoF29Dia20: compromisoF29,
                cajaProyectadaPostImpuestos: cajaPostObligaciones
            }
        };
    }

    var api = {
        PLAN_CUENTAS: PLAN_CUENTAS,
        cuentaInfo: cuentaInfo,
        crearAsiento: crearAsiento,
        resumenNominaDesdeResultados: resumenNominaDesdeResultados,
        generarAsientos: generarAsientos,
        calcularMayor: calcularMayor,
        calcularBalance8Columnas: calcularBalance8Columnas,
        calcularRliProPyme: calcularRliProPyme,
        calcularEstadoResultadosYFlujo: calcularEstadoResultadosYFlujo,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLContabilidad = api;
})(typeof window !== 'undefined' ? window : this);
