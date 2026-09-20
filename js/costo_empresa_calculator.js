/**
 * Calculadora de Costo Empresa y Costo Real de Contratar en Chile (2026)
 * Normativa: Código del Trabajo (Art. 42, 44, 47, 50, 161, 163), Ley 19.728 (AFC), Ley 16.744 (Mutual), Ley 21.561 (40 Horas / 42h)
 * Desarrollado para Cálculo Laboral Chile (calculolaboral.cl)
 */

(function () {
    'use strict';

    // Constantes e Indicadores Oficiales 2026 (SUSESO, Previred, SII, DT)
    const UF_VALOR = 39682.99;
    const UTM_VALOR = 69611;
    const IMM_VALOR = 553553; // Ingreso Mínimo Mensual referencial 2026
    const TOPE_PREV_UF = 89.9; // Tope Imponible AFP/Salud/SIS/Mutual (UF)
    const TOPE_AFC_UF = 135.1; // Tope Imponible Cesantía AFC oficial Previred (UF)
    const TOPE_GRATIF_FACTOR = 4.75; // 4.75 IMM anual / 12 mensual (Art. 50 Código del Trabajo)
    const TOPE_GRATIF_MENSUAL = Math.round((IMM_VALOR * TOPE_GRATIF_FACTOR) / 12); // $219.115 mensual

    // Tasas Patronales Legales
    const TASA_SIS = 0.0149; // 1.49% Seguro Invalidez y Sobrevivencia (cargo empleador)
    const TASA_AFC_EMP_INDEF = 0.024; // 2.4% AFC empleador en contrato indefinido (1.6% CIC + 0.8% FSC)
    const TASA_AFC_EMP_PLAZO = 0.030; // 3.0% AFC empleador en contrato a plazo fijo / obra
    const TASA_AFC_TRAB_INDEF = 0.006; // 0.6% AFC trabajador en indefinido

    // Provisiones Recomendadas para Blindaje Financiero Pyme
    const TASA_PROV_VACACIONES = 0.0417; // 15 días hábiles / 360 días = 4.167% mensual
    const TASA_PROV_IAS = 0.0833; // 1 mes por año de servicio (Art. 163) = 8.333% mensual

    // Promedios Trabajador
    const TASA_AFP_PROMEDIO = 0.1144; // 10% obligatorio + 1.44% comisión promedio AFP
    const TASA_SALUD_LEGAL = 0.07; // 7% Fonasa / Isapre legal obligatorio

    // Tramos Impuesto Único de Segunda Categoría (Art. 43 Nº 1 en UTM mensuales - SII)
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

    // Cálculo Directo desde Sueldo Base Pactado (Estándar DT)
    function calcularDesdeBase(sueldoBase, opciones) {
        opciones = opciones || {};
        var tipoContrato = opciones.tipoContrato || 'indefinido';
        var tasaMutual = parseFloat(opciones.tasaMutual || 0.0093);
        var tieneGratificacion = opciones.gratificacion !== false;
        var asignacionesNoImponibles = parseFloat(opciones.asignaciones || 0);
        var incluirProvisiones = opciones.incluirProvisiones !== false;

        // 1. Gratificación Legal Art. 50 (25% sueldo devengado con tope 4,75 IMM / 12)
        var gratificacion = 0;
        if (tieneGratificacion) {
            gratificacion = Math.min(Math.round(sueldoBase * 0.25), TOPE_GRATIF_MENSUAL);
        }

        // 2. Remuneración Imponible Bruta
        var totalImponible = sueldoBase + gratificacion;

        // Topes en pesos según UF oficial
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

        // Base tributable e Impuesto Único de Segunda Categoría
        var baseTributable = Math.max(0, totalImponible - totalCotizacionesTrabajador);
        var impuestoSegundaCat = calcularImpuestoUnico(baseTributable, UTM_VALOR);

        // Sueldo Líquido resultante en bolsillo
        var sueldoLiquido = totalImponible + asignacionesNoImponibles - totalCotizacionesTrabajador - impuestoSegundaCat;

        // 5. Provisiones Contables Opcionales (Costos Ocultos)
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
            tieneGratificacion: tieneGratificacion,
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

    // Cálculo Inverso: Hallar el Sueldo Base a partir del Sueldo Líquido deseado
    function calcularDesdeLiquido(sueldoLiquidoDeseado, opciones) {
        opciones = opciones || {};
        if (sueldoLiquidoDeseado <= 0) {
            return calcularDesdeBase(0, opciones);
        }

        // Si el usuario indicó Gratificación Legal Adicional (sobre el sueldo pactado)
        if (opciones.gratificacionAdicional === true) {
            // Se calcula el sueldo base necesario para cubrir el líquido deseado sin gratificación
            var optsPuro = Object.assign({}, opciones, { gratificacion: false });
            var basePuro = resolverBaseParaLiquido(sueldoLiquidoDeseado, optsPuro);
            // Luego se le agrega la gratificación legal Art. 50 adicional
            return calcularDesdeBase(basePuro, Object.assign({}, opciones, { gratificacion: true }));
        }

        // Caso estándar (Gratificación incluida en la oferta o sin gratificación)
        var sueldoBaseEstimado = resolverBaseParaLiquido(sueldoLiquidoDeseado, opciones);
        return calcularDesdeBase(sueldoBaseEstimado, opciones);
    }

    // Algoritmo de convergencia exacta al peso para sueldo base inverso
    function resolverBaseParaLiquido(sueldoLiquidoDeseado, opciones) {
        var low = 0;
        var high = sueldoLiquidoDeseado * 2.8;
        var sueldoBaseEstimado = sueldoLiquidoDeseado;

        for (var i = 0; i < 40; i++) {
            var mid = (low + high) / 2;
            var sim = calcularDesdeBase(mid, opciones);
            if (Math.abs(sim.sueldoLiquido - sueldoLiquidoDeseado) < 1.5) {
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
        return sueldoBaseEstimado;
    }

    // Exportar al objeto global
    window.CostoEmpresaCalculator = {
        calcularDesdeBase: calcularDesdeBase,
        calcularDesdeLiquido: calcularDesdeLiquido,
        formatCLP: formatCLP,
        parseCLP: parseCLP,
        UF_VALOR: UF_VALOR,
        UTM_VALOR: UTM_VALOR,
        IMM_VALOR: IMM_VALOR,
        TOPE_GRATIF_MENSUAL: TOPE_GRATIF_MENSUAL
    };

    // Inicialización del DOM cuando la página esté lista
    document.addEventListener('DOMContentLoaded', function () {
        var inputMonto = document.getElementById('input-monto-sueldo');
        var inputModo = document.getElementById('select-modo-calculo');
        var btnModoBase = document.getElementById('btn-modo-base');
        var btnModoLiquido = document.getElementById('btn-modo-liquido');
        var selectTipoContrato = document.getElementById('select-tipo-contrato');
        var selectRiesgoMutual = document.getElementById('select-riesgo-mutual');
        var checkGratificacion = document.getElementById('check-gratificacion');
        var checkGratifAdicional = document.getElementById('check-gratif-adicional');
        var inputAsignaciones = document.getElementById('input-asignaciones');
        var checkProvisiones = document.getElementById('check-provisiones');

        if (!inputMonto) return; // Si no estamos en la página de la calculadora, salir limpiamente

        // Formateador dinámico para inputs monetarios
        function bindMoneyInput(input) {
            input.addEventListener('input', function () {
                var raw = parseCLP(this.value);
                this.value = raw > 0 ? raw.toLocaleString('es-CL') : '0';
                recalcular();
            });
        }

        bindMoneyInput(inputMonto);
        if (inputAsignaciones) bindMoneyInput(inputAsignaciones);

        // Control Segmentado de Modo de Cálculo (Base vs Líquido)
        function setModo(modo) {
            if (inputModo) inputModo.value = modo;

            var labelMonto = document.getElementById('label-monto-sueldo');
            var badgeModo = document.getElementById('badge-modo-calculo');
            var helpMonto = document.getElementById('help-monto-sueldo');
            var notaInverso = document.getElementById('nota-modo-inverso-gratif');
            var wrapGratifAdicional = document.getElementById('wrap-gratif-adicional');

            if (modo === 'base') {
                if (btnModoBase) {
                    btnModoBase.className = 'py-2 px-1.5 rounded-lg text-xs font-bold text-center transition-all bg-white text-sky-700 shadow-xs border border-slate-200 leading-tight';
                }
                if (btnModoLiquido) {
                    btnModoLiquido.className = 'py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all text-slate-600 hover:text-slate-900 leading-tight';
                }
                if (labelMonto) labelMonto.innerText = 'Sueldo Base Mensual:';
                if (badgeModo) {
                    badgeModo.innerText = 'Cálculo Directo DT';
                    badgeModo.className = 'text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold border border-sky-200/80';
                }
                if (helpMonto) {
                    helpMonto.innerText = 'Sueldo pactado en contrato individual (cláusula 4). Desmarcar gratificación reduce el costo directamente.';
                }
                if (notaInverso) notaInverso.classList.add('hidden');
                if (wrapGratifAdicional) wrapGratifAdicional.classList.add('hidden');
            } else {
                if (btnModoLiquido) {
                    btnModoLiquido.className = 'py-2 px-1.5 rounded-lg text-xs font-bold text-center transition-all bg-white text-sky-700 shadow-xs border border-slate-200 leading-tight';
                }
                if (btnModoBase) {
                    btnModoBase.className = 'py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all text-slate-600 hover:text-slate-900 leading-tight';
                }
                if (labelMonto) labelMonto.innerText = 'Sueldo Líquido que pide el Candidato (en bolsillo):';
                if (badgeModo) {
                    badgeModo.innerText = 'Cálculo Inverso (Líquido)';
                    badgeModo.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200/80';
                }
                if (helpMonto) {
                    helpMonto.innerText = 'Monto neto final transferido al trabajador tras descuentos obligatorios (AFP, Salud, AFC e Impuesto).';
                }
                if (notaInverso) notaInverso.classList.remove('hidden');
                if (wrapGratifAdicional) wrapGratifAdicional.classList.remove('hidden');
            }
            recalcular();
        }

        if (btnModoBase) {
            btnModoBase.addEventListener('click', function () { setModo('base'); });
        }
        if (btnModoLiquido) {
            btnModoLiquido.addEventListener('click', function () { setModo('liquido'); });
        }

        // Preset Chips de Montos Frecuentes
        var presetBtns = document.querySelectorAll('.btn-preset-monto');
        presetBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var monto = parseInt(this.getAttribute('data-monto'), 10);
                if (monto > 0) {
                    inputMonto.value = monto.toLocaleString('es-CL');
                    recalcular();
                }
            });
        });

        if (selectTipoContrato) selectTipoContrato.addEventListener('change', recalcular);
        if (selectRiesgoMutual) selectRiesgoMutual.addEventListener('change', recalcular);
        if (checkGratificacion) checkGratificacion.addEventListener('change', recalcular);
        if (checkGratifAdicional) checkGratifAdicional.addEventListener('change', recalcular);
        if (checkProvisiones) checkProvisiones.addEventListener('change', recalcular);

        function recalcular() {
            var modo = inputModo ? inputModo.value : 'base';
            var montoRaw = parseCLP(inputMonto.value);
            var asignacionesRaw = inputAsignaciones ? parseCLP(inputAsignaciones.value) : 0;
            var tipoContrato = selectTipoContrato ? selectTipoContrato.value : 'indefinido';
            var tasaMutual = selectRiesgoMutual ? parseFloat(selectRiesgoMutual.value) : 0.0093;
            var gratificacion = checkGratificacion ? checkGratificacion.checked : true;
            var gratificacionAdicional = checkGratifAdicional ? checkGratifAdicional.checked : false;
            var incluirProvisiones = checkProvisiones ? checkProvisiones.checked : true;

            var opciones = {
                tipoContrato: tipoContrato,
                tasaMutual: tasaMutual,
                gratificacion: gratificacion,
                gratificacionAdicional: (modo === 'liquido' && gratificacionAdicional),
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
            var setText = function (id, val) {
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

            // Actualizar Texto Explicativo en Modo Líquido
            var elTextoExplicativo = document.getElementById('texto-explicativo-gratif');
            if (elTextoExplicativo && modo === 'liquido') {
                if (gratificacionAdicional) {
                    elTextoExplicativo.innerText = 'Gratificación Adicional activa: Se pactan ' + formatCLP(res.sueldoBase) + ' de base (para dar ' + formatCLP(montoRaw) + ' líquidos) MÁS ' + formatCLP(res.gratificacion) + ' de gratificación legal. El trabajador recibe ' + formatCLP(res.sueldoLiquido) + ' líquidos en bolsillo.';
                } else if (gratificacion) {
                    elTextoExplicativo.innerText = 'Gratificación incluida en la oferta: Se desglosa en Sueldo Base (' + formatCLP(res.sueldoBase) + ') + Gratificación Art. 50 (' + formatCLP(res.gratificacion) + ') para alcanzar exactamente ' + formatCLP(res.sueldoLiquido) + ' líquidos.';
                } else {
                    elTextoExplicativo.innerText = 'Sin gratificación mensual: El total imponible (' + formatCLP(res.totalImponible) + ') se asigna 100% a Sueldo Base para pagar íntegramente los ' + formatCLP(res.sueldoLiquido) + ' líquidos acordados.';
                }
            }

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

        // Inicializar en modo Sueldo Base Pactado (Estándar DT)
        setModo('base');
    });
})();
