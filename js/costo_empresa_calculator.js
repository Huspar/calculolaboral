/**
 * Calculadora de Costo Empresa y Costo Real de Contratar en Chile (2026)
 * Normativa: Código del Trabajo, Ley 19.728 (AFC), Ley 16.744 (Mutual), Ley 21.561 (40 Horas / 42h)
 * Desarrollado para Cálculo Laboral Chile (calculolaboral.cl)
 */

(function () {
    'use strict';

    // Constantes e Indicadores Oficiales 2026
    const UF_VALOR = 39682.99;
    const UTM_VALOR = 69611;
    const IMM_VALOR = 553553; // Ingreso Mínimo Mensual referencial
    const TOPE_PREV_UF = 89.9; // Tope Imponible AFP/Salud/SIS/Mutual (UF)
    const TOPE_AFC_UF = 134.8; // Tope Imponible Cesantía AFC (UF)
    const TOPE_GRATIF_FACTOR = 4.75; // 4.75 IMM anual / 12 mensual
    const TOPE_GRATIF_MENSUAL = Math.round((IMM_VALOR * TOPE_GRATIF_FACTOR) / 12); // ~$219.031

    // Tasas Patronales Legales
    const TASA_SIS = 0.0149; // 1.49% Seguro Invalidez y Sobrevivencia (cargo empleador)
    const TASA_AFC_EMP_INDEF = 0.024; // 2.4% AFC empleador en contrato indefinido (1.6% CIC + 0.8% FSC)
    const TASA_AFC_EMP_PLAZO = 0.030; // 3.0% AFC empleador en contrato a plazo fijo / obra
    const TASA_AFC_TRAB_INDEF = 0.006; // 0.6% AFC trabajador en indefinido

    // Provisiones Recomendadas
    const TASA_PROV_VACACIONES = 0.0417; // 15 días hábiles / 360 días = 4.167%
    const TASA_PROV_IAS = 0.0833; // 1 mes por año = 8.333%

    // Promedios Trabajador
    const TASA_AFP_PROMEDIO = 0.1144; // 10% base + 1.44% comisión promedio
    const TASA_SALUD_LEGAL = 0.07; // 7% Fonasa / Isapre base

    // Tramos Impuesto Único de Segunda Categoría (en UTM mensuales)
    const TRAMOS_IMPUESTO_UTM = [
        { desde: 0, hasta: 13.5, factor: 0, rebaja: 0 },
        { desde: 13.5, hasta: 30, factor: 0.04, rebaja: 0.54 },
        { desde: 30, hasta: 50, factor: 0.08, rebaja: 1.74 },
        { desde: 50, hasta: 70, factor: 0.135, rebaja: 4.49 },
        { desde: 70, hasta: 90, factor: 0.23, rebaja: 11.14 },
        { desde: 90, hasta: 120, factor: 0.304, rebaja: 17.80 },
        { desde: 120, hasta: 310, factor: 0.35, rebaja: 23.32 },
        { desde: 310, hasta: Infinity, factor: 0.40, rebaja: 38.82 }
    ];

    // Utilidad: Formato de Moneda CLP
    function formatCLP(amount) {
        if (isNaN(amount)) return '$0';
        return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function parseCLP(str) {
        if (!str) return 0;
        var clean = str.toString().replace(/[^0-9]/g, '');
        return clean ? parseInt(clean, 10) : 0;
    }

    // Cálculo del Impuesto Único mensual a partir de la base imponible neta
    function calcularImpuestoUnico(baseTributable, utm) {
        if (baseTributable <= 0) return 0;
        var baseUTM = baseTributable / utm;
        for (var i = 0; i < TRAMOS_IMPUESTO_UTM.length; i++) {
            var tramo = TRAMOS_IMPUESTO_UTM[i];
            if (baseUTM > tramo.desde && baseUTM <= tramo.hasta) {
                var impuestoUTM = (baseUTM * tramo.factor) - tramo.rebaja;
                return Math.max(0, Math.round(impuestoUTM * utm));
            }
        }
        return 0;
    }

    // Cálculo Directo desde Sueldo Base
    function calcularDesdeBase(sueldoBase, opciones) {
        var tipoContrato = opciones.tipoContrato || 'indefinido';
        var tasaMutual = parseFloat(opciones.tasaMutual || 0.0093);
        var tieneGratificacion = opciones.gratificacion !== false;
        var asignacionesNoImponibles = parseFloat(opciones.asignaciones || 0);
        var incluirProvisiones = opciones.incluirProvisiones === true;

        // 1. Gratificación Legal Art. 50
        var gratificacion = 0;
        if (tieneGratificacion) {
            gratificacion = Math.min(Math.round(sueldoBase * 0.25), TOPE_GRATIF_MENSUAL);
        }

        // 2. Remuneración Imponible Bruta
        var totalImponible = sueldoBase + gratificacion;

        // Topes en pesos
        var topePrevPesos = Math.round(TOPE_PREV_UF * UF_VALOR);
        var topeAfcPesos = Math.round(TOPE_AFC_UF * UF_VALOR);

        var imponiblePrev = Math.min(totalImponible, topePrevPesos);
        var imponibleAfc = Math.min(totalImponible, topeAfcPesos);

        // 3. Aportes Obligatorios del Empleador (Costo Patronal Directo)
        var costoSis = Math.round(imponiblePrev * TASA_SIS);
        var tasaAfcEmp = (tipoContrato === 'indefinido') ? TASA_AFC_EMP_INDEF : TASA_AFC_EMP_PLAZO;
        var costoAfcEmp = Math.round(imponibleAfc * tasaAfcEmp);
        var costoMutual = Math.round(imponiblePrev * tasaMutual);
        var totalAportesPatronales = costoSis + costoAfcEmp + costoMutual;

        // 4. Descuentos Obligatorios del Trabajador
        var descAfp = Math.round(imponiblePrev * TASA_AFP_PROMEDIO);
        var descSalud = Math.round(imponiblePrev * TASA_SALUD_LEGAL);
        var tasaAfcTrab = (tipoContrato === 'indefinido') ? TASA_AFC_TRAB_INDEF : 0;
        var descAfcTrab = Math.round(imponibleAfc * tasaAfcTrab);
        var totalCotizacionesTrabajador = descAfp + descSalud + descAfcTrab;

        // Base tributable e Impuesto Único
        var baseTributable = Math.max(0, totalImponible - totalCotizacionesTrabajador);
        var impuestoSegundaCat = calcularImpuestoUnico(baseTributable, UTM_VALOR);

        // Sueldo Líquido resultante
        var sueldoLiquido = totalImponible + asignacionesNoImponibles - totalCotizacionesTrabajador - impuestoSegundaCat;

        // 5. Provisiones Contables Opcionales
        var provVacaciones = 0;
        var provIas = 0;
        if (incluirProvisiones) {
            provVacaciones = Math.round(totalImponible * TASA_PROV_VACACIONES);
            if (tipoContrato === 'indefinido') {
                provIas = Math.round(totalImponible * TASA_PROV_IAS);
            }
        }
        var totalProvisiones = provVacaciones + provIas;

        // 6. Costo Empresa Final
        var costoEmpresaDirecto = totalImponible + asignacionesNoImponibles + totalAportesPatronales;
        var costoEmpresaTotal = costoEmpresaDirecto + totalProvisiones;
        var costoEmpresaAnual = costoEmpresaTotal * 12;

        var factorMultiplicador = sueldoLiquido > 0 ? (costoEmpresaTotal / sueldoLiquido) : 1;

        return {
            sueldoBase: sueldoBase,
            gratificacion: gratificacion,
            totalImponible: totalImponible,
            asignacionesNoImponibles: asignacionesNoImponibles,
            sueldoBrutoTotal: totalImponible + asignacionesNoImponibles,
            
            // Aportes patronales
            costoSis: costoSis,
            costoAfcEmp: costoAfcEmp,
            costoMutual: costoMutual,
            totalAportesPatronales: totalAportesPatronales,
            
            // Descuentos trabajador
            descAfp: descAfp,
            descSalud: descSalud,
            descAfcTrab: descAfcTrab,
            totalCotizacionesTrabajador: totalCotizacionesTrabajador,
            impuestoSegundaCat: impuestoSegundaCat,
            sueldoLiquido: Math.max(0, sueldoLiquido),
            
            // Provisiones
            provVacaciones: provVacaciones,
            provIas: provIas,
            totalProvisiones: totalProvisiones,
            
            // Totales empresa
            costoEmpresaDirecto: costoEmpresaDirecto,
            costoEmpresaTotal: costoEmpresaTotal,
            costoEmpresaAnual: costoEmpresaAnual,
            factorMultiplicador: factorMultiplicador
        };
    }

    // Cálculo Inverso: Hallar el Sueldo Base que produce el Sueldo Líquido deseado
    function calcularDesdeLiquido(sueldoLiquidoDeseado, opciones) {
        if (sueldoLiquidoDeseado <= 0) {
            return calcularDesdeBase(0, opciones);
        }

        var low = 0;
        var high = sueldoLiquidoDeseado * 2.5;
        var sueldoBaseEstimado = sueldoLiquidoDeseado;

        // Búsqueda binaria para convergencia exacta al peso
        for (var i = 0; i < 35; i++) {
            var mid = (low + high) / 2;
            var sim = calcularDesdeBase(mid, opciones);
            if (Math.abs(sim.sueldoLiquido - sueldoLiquidoDeseado) < 2) {
                sueldoBaseEstimado = Math.round(mid);
                break;
            }
            if (sim.sueldoLiquido < sueldoLiquidoDeseado) {
                low = mid;
            } else {
                high = mid;
            }
            sueldoBaseEstimado = Math.round(mid);
        }

        return calcularDesdeBase(sueldoBaseEstimado, opciones);
    }

    // Exportar al objeto global
    window.CostoEmpresaCalculator = {
        calcularDesdeBase: calcularDesdeBase,
        calcularDesdeLiquido: calcularDesdeLiquido,
        formatCLP: formatCLP,
        parseCLP: parseCLP,
        UF_VALOR: UF_VALOR,
        UTM_VALOR: UTM_VALOR,
        IMM_VALOR: IMM_VALOR
    };

    // Inicialización del DOM cuando la página esté lista
    document.addEventListener('DOMContentLoaded', function () {
        var inputMonto = document.getElementById('input-monto-sueldo');
        var selectModo = document.getElementById('select-modo-calculo');
        var selectTipoContrato = document.getElementById('select-tipo-contrato');
        var selectRiesgoMutual = document.getElementById('select-riesgo-mutual');
        var checkGratificacion = document.getElementById('check-gratificacion');
        var inputAsignaciones = document.getElementById('input-asignaciones');
        var checkProvisiones = document.getElementById('check-provisiones');

        if (!inputMonto) return; // Si no estamos en la página de la calculadora, salir limpiamente

        // Formateador dinámico para inputs monetarios
        function bindMoneyInput(input) {
            input.addEventListener('input', function (e) {
                var raw = parseCLP(this.value);
                this.value = raw > 0 ? raw.toLocaleString('es-CL') : '0';
                recalcular();
            });
        }

        bindMoneyInput(inputMonto);
        if (inputAsignaciones) bindMoneyInput(inputAsignaciones);

        if (selectModo) selectModo.addEventListener('change', function () {
            var label = document.getElementById('label-monto-sueldo');
            if (label) {
                label.innerText = this.value === 'liquido' ? 'Sueldo Líquido que pide el Candidato (en bolsillo):' : 'Sueldo Base Mensual Pactado:';
            }
            recalcular();
        });

        if (selectTipoContrato) selectTipoContrato.addEventListener('change', recalcular);
        if (selectRiesgoMutual) selectRiesgoMutual.addEventListener('change', recalcular);
        if (checkGratificacion) checkGratificacion.addEventListener('change', recalcular);
        if (checkProvisiones) checkProvisiones.addEventListener('change', recalcular);

        function recalcular() {
            var modo = selectModo ? selectModo.value : 'liquido';
            var montoRaw = parseCLP(inputMonto.value);
            var asignacionesRaw = inputAsignaciones ? parseCLP(inputAsignaciones.value) : 0;
            var tipoContrato = selectTipoContrato ? selectTipoContrato.value : 'indefinido';
            var tasaMutual = selectRiesgoMutual ? parseFloat(selectRiesgoMutual.value) : 0.0093;
            var gratificacion = checkGratificacion ? checkGratificacion.checked : true;
            var incluirProvisiones = checkProvisiones ? checkProvisiones.checked : true;

            var opciones = {
                tipoContrato: tipoContrato,
                tasaMutual: tasaMutual,
                gratificacion: gratificacion,
                asignaciones: asignacionesRaw,
                incluirProvisiones: incluirProvisiones
            };

            var res;
            if (modo === 'liquido') {
                res = calcularDesdeLiquido(montoRaw, opciones);
            } else {
                res = calcularDesdeBase(montoRaw, opciones);
            }

            // Actualizar Métricas Principales (Dashboard Sticky)
            var elCostoTotalMes = document.getElementById('resumen-costo-mensual');
            var elCostoTotalAno = document.getElementById('resumen-costo-anual');
            var elFactor = document.getElementById('resumen-factor-multiplicador');
            var elSueldoLiquido = document.getElementById('resumen-sueldo-liquido');
            var elSueldoBruto = document.getElementById('resumen-sueldo-bruto');
            var elAportesPatronales = document.getElementById('resumen-aportes-patronales');
            var elProvisionesMes = document.getElementById('resumen-provisiones-mes');

            if (elCostoTotalMes) elCostoTotalMes.innerText = formatCLP(res.costoEmpresaTotal);
            if (elCostoTotalAno) elCostoTotalAno.innerText = formatCLP(res.costoEmpresaAnual);
            if (elFactor) elFactor.innerText = res.factorMultiplicador.toFixed(2) + 'x';
            if (elSueldoLiquido) elSueldoLiquido.innerText = formatCLP(res.sueldoLiquido);
            if (elSueldoBruto) elSueldoBruto.innerText = formatCLP(res.sueldoBrutoTotal);
            if (elAportesPatronales) elAportesPatronales.innerText = formatCLP(res.totalAportesPatronales);
            if (elProvisionesMes) elProvisionesMes.innerText = formatCLP(res.totalProvisiones);

            // Actualizar Desglose en Tablas
            var setText = function(id, val) {
                var el = document.getElementById(id);
                if (el) el.innerText = val;
            };

            setText('det-sueldo-base', formatCLP(res.sueldoBase));
            setText('det-gratificacion', formatCLP(res.gratificacion));
            setText('det-total-imponible', formatCLP(res.totalImponible));
            setText('det-asignaciones', formatCLP(res.asignacionesNoImponibles));
            setText('det-bruto-total', formatCLP(res.sueldoBrutoTotal));

            setText('det-sis', formatCLP(res.costoSis));
            setText('det-afc-emp', formatCLP(res.costoAfcEmp));
            setText('det-mutual', formatCLP(res.costoMutual));
            setText('det-total-aportes-emp', formatCLP(res.totalAportesPatronales));

            setText('det-afp-trab', formatCLP(res.descAfp));
            setText('det-salud-trab', formatCLP(res.descSalud));
            setText('det-afc-trab', formatCLP(res.descAfcTrab));
            setText('det-impuesto-trab', formatCLP(res.impuestoSegundaCat));
            setText('det-liquido-final', formatCLP(res.sueldoLiquido));

            setText('det-prov-vacaciones', formatCLP(res.provVacaciones));
            setText('det-prov-ias', formatCLP(res.provIas));
            setText('det-total-prov', formatCLP(res.totalProvisiones));

            // Actualizar Barra de Distribución Visual
            var totalParaBarra = res.costoEmpresaTotal || 1;
            var pctLiquido = Math.max(5, (res.sueldoLiquido / totalParaBarra) * 100);
            var pctDescuentosTrab = Math.max(3, ((res.totalCotizacionesTrabajador + res.impuestoSegundaCat) / totalParaBarra) * 100);
            var pctAportesEmp = Math.max(3, (res.totalAportesPatronales / totalParaBarra) * 100);
            var pctProvisiones = Math.max(0, (res.totalProvisiones / totalParaBarra) * 100);

            var barLiquido = document.getElementById('bar-liquido');
            var barDescuentos = document.getElementById('bar-descuentos');
            var barAportes = document.getElementById('bar-aportes');
            var barProvisiones = document.getElementById('bar-provisiones');

            if (barLiquido) barLiquido.style.width = pctLiquido + '%';
            if (barDescuentos) barDescuentos.style.width = pctDescuentosTrab + '%';
            if (barAportes) barAportes.style.width = pctAportesEmp + '%';
            if (barProvisiones) barProvisiones.style.width = pctProvisiones + '%';
        }

        // Ejecutar recálculo inicial con valores por defecto
        recalcular();
    });
})();
