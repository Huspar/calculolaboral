/**
 * Simulador de Despido Injustificado & Riesgo de Demanda Laboral (Chile 2026)
 * Código del Trabajo: Art. 161, Art. 162 (Ley Bustos), Art. 163, Art. 168 (Recargos 30% a 100%), Art. 172, Art. 173
 * Ley 19.728: Art. 13 (Devolución descuento AFC por despido improcedente - Jurisprudencia Corte Suprema)
 * Actualizado con valores UF, UTM y Sueldo Mínimo 2026.
 */

(function () {
    'use strict';

    // Constantes Oficiales 2026
    function getUF() {
        return (typeof CONSTANTS !== 'undefined' && CONSTANTS.UF) ? CONSTANTS.UF : 40975.41;
    }
    const TOPE_IAS_UF = 90; // Art. 172 Código del Trabajo
    function getTopeIASPesos() {
        return Math.round(TOPE_IAS_UF * getUF());
    }
    const SUELDO_MINIMO_2026 = 553553;

    // Estado del Simulador
    const state = {
        mode: 'empleador', // 'empleador' o 'trabajador'
        sueldoImponible: 900000,
        anios: 3,
        meses: 2,
        causal: 'art161', // 'art161' (+30%), 'art159' (+50%), 'art160_80' (+80%), 'art160_100' (+100%)
        avisoPrevioPagado: true, // Si se dio aviso con 30 días de anticipación
        descuentoAfcAplicado: true,
        montoAfcPersonalizado: 0,
        leyBustosActiva: false,
        mesesJuicioLeyBustos: 5,
        incluirCostas: true,
        costasEstimadas: 800000
    };

    // Helper: Formato Moneda Chilena ($1.500.000)
    function formatMoney(amount) {
        const num = Math.round(Number(amount) || 0);
        return '$' + num.toLocaleString('es-CL');
    }

    // Helper: Limpiar y parsear número desde input formateado
    function parseMoney(value) {
        if (!value) return 0;
        const clean = value.toString().replace(/[^0-9]/g, '');
        return parseInt(clean, 10) || 0;
    }

    // Cálculo Forense Laboral
    function calculate() {
        const sueldo = state.sueldoImponible;
        const sueldoTopadoIAS = Math.min(sueldo, getTopeIASPesos());

        // Años de servicio para cálculo legal (Art. 163)
        // Fracción superior a 6 meses suma 1 año completo. Máximo 11 años.
        let aniosComputables = state.anios;
        if (state.meses > 6) {
            aniosComputables += 1;
        }
        aniosComputables = Math.min(Math.max(aniosComputables, 0), 11);

        // 1. Indemnización por Años de Servicio (IAS Base)
        const iasBase = aniosComputables * sueldoTopadoIAS;

        // 2. Indemnización Sustitutiva de Aviso Previo
        // Si no se dio aviso de 30 días o si se despidió por Art. 160 (sin aviso) y la causal se cae:
        let avisoPrevioOriginal = 0;
        let avisoPrevioOmisionRiesgo = 0;

        if (state.causal === 'art161') {
            if (!state.avisoPrevioPagado) {
                avisoPrevioOriginal = sueldoTopadoIAS;
            }
        } else {
            // En Art. 160 o Art. 159 no se paga aviso previo en el finiquito inicial.
            // Si el despido se declara injustificado en tribunales, se condena al pago de aviso previo.
            avisoPrevioOmisionRiesgo = sueldoTopadoIAS;
        }

        // 3. Finiquito Inicial Pretendido (lo que legalmente correspondía según la causal invocada)
        let finiquitoInicial = 0;
        if (state.causal === 'art161') {
            finiquitoInicial = iasBase + avisoPrevioOriginal;
        } else {
            finiquitoInicial = 0; // En Art. 160 no hay indemnizaciones contractuales
        }

        // 4. Recargo Judicial Art. 168
        let porcentajeRecargo = 30;
        let causalNombre = 'Art. 161 (Necesidades de la Empresa)';

        if (state.causal === 'art161') {
            porcentajeRecargo = 30;
            causalNombre = 'Art. 161 (Necesidades de la Empresa)';
        } else if (state.causal === 'art159') {
            porcentajeRecargo = 50;
            causalNombre = 'Art. 159 (Causal no acreditada / Vencimiento)';
        } else if (state.causal === 'art160_80') {
            porcentajeRecargo = 80;
            causalNombre = 'Art. 160 (Falta de probidad / Conducta indebida)';
        } else if (state.causal === 'art160_100') {
            porcentajeRecargo = 100;
            causalNombre = 'Art. 160 Temerario o carente de motivo plausible';
        }

        const montoRecargoJudicial = Math.round(iasBase * (porcentajeRecargo / 100));

        // 5. Devolución Aporte Patronal AFC (Art. 13 Ley 19.728 - Jurisprudencia Corte Suprema)
        let montoReintegroAFC = 0;
        if (state.descuentoAfcAplicado) {
            if (state.montoAfcPersonalizado > 0) {
                montoReintegroAFC = state.montoAfcPersonalizado;
            } else {
                // Estimación aproximada: 1.6% mensual acumulado sobre el sueldo imponible por los meses trabajados
                const mesesTotales = (state.anios * 12) + state.meses;
                const topeAfcImponible = Math.min(sueldo, Math.round(135.1 * getUF())); // Tope AFC 135.1 UF (Previred 2026)
                montoReintegroAFC = Math.round(topeAfcImponible * 0.016 * mesesTotales);
            }
        }

        // 6. Nulidad del Despido / Ley Bustos (Art. 162 inc. 5° y 7°)
        let montoSueldosLeyBustos = 0;
        if (state.leyBustosActiva) {
            // Sueldos íntegros devengados por los meses de juicio hasta convalidación formal
            montoSueldosLeyBustos = sueldo * state.mesesJuicioLeyBustos;
        }

        // 7. Costas Judiciales y Procesales
        let montoCostas = 0;
        if (state.incluirCostas) {
            montoCostas = state.costasEstimadas;
        }

        // TOTALES DE CONTINGENCIA
        // En caso de sentencia judicial condenatoria completa:
        let totalSentencia = iasBase + montoRecargoJudicial + avisoPrevioOmisionRiesgo + montoReintegroAFC + montoSueldosLeyBustos + montoCostas;
        
        // Si fue Art. 161 y ya se contemplaba aviso previo, el monto final incluye el aviso previo ya calculado
        if (state.causal === 'art161') {
            totalSentencia += avisoPrevioOriginal;
        }

        // El sobrecosto directo atribuible exclusivamente al error/juicio:
        const sobrecostoDemanda = totalSentencia - finiquitoInicial;
        const porcentajeIncremento = finiquitoInicial > 0 ? Math.round((sobrecostoDemanda / finiquitoInicial) * 100) : 100;

        // Clasificación del Nivel de Riesgo
        let nivelRiesgo = 'Moderado';
        let nivelClase = 'bg-amber-100 text-amber-800 border-amber-300';
        let nivelBarra = '35%';
        let nivelColorBarra = 'bg-amber-500';

        if (state.leyBustosActiva || totalSentencia > 8000000 || porcentajeRecargo >= 80) {
            nivelRiesgo = 'Catastrófico';
            nivelClase = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
            nivelBarra = '98%';
            nivelColorBarra = 'bg-rose-600';
        } else if (totalSentencia > 4000000 || porcentajeRecargo >= 50) {
            nivelRiesgo = 'Crítico';
            nivelClase = 'bg-red-100 text-red-800 border-red-300';
            nivelBarra = '75%';
            nivelColorBarra = 'bg-red-500';
        } else if (totalSentencia > 2000000) {
            nivelRiesgo = 'Alto';
            nivelClase = 'bg-orange-100 text-orange-800 border-orange-300';
            nivelBarra = '55%';
            nivelColorBarra = 'bg-orange-500';
        }

        renderResults({
            sueldo,
            sueldoTopadoIAS,
            aniosComputables,
            iasBase,
            porcentajeRecargo,
            montoRecargoJudicial,
            causalNombre,
            avisoPrevioOriginal,
            avisoPrevioOmisionRiesgo,
            montoReintegroAFC,
            montoSueldosLeyBustos,
            montoCostas,
            finiquitoInicial,
            totalSentencia,
            sobrecostoDemanda,
            porcentajeIncremento,
            nivelRiesgo,
            nivelClase,
            nivelBarra,
            nivelColorBarra
        });
    }

    // Renderizar Resultados en el DOM
    function renderResults(res) {
        // Cifras Principales
        const elTotalSentencia = document.getElementById('res-total-sentencia');
        const elFiniquitoInicial = document.getElementById('res-finiquito-inicial');
        const elSobrecosto = document.getElementById('res-sobrecosto');
        const elPorcentaje = document.getElementById('res-porcentaje-incremento');

        if (elTotalSentencia) elTotalSentencia.textContent = formatMoney(res.totalSentencia);
        if (elFiniquitoInicial) elFiniquitoInicial.textContent = formatMoney(res.finiquitoInicial);
        if (elSobrecosto) elSobrecosto.textContent = '+' + formatMoney(res.sobrecostoDemanda);
        if (elPorcentaje) elPorcentaje.textContent = '+' + res.porcentajeIncremento + '%';

        // Desglose Específico
        const elIasBase = document.getElementById('res-ias-base');
        const elAniosDesc = document.getElementById('res-anios-desc');
        const elRecargo = document.getElementById('res-recargo-monto');
        const elRecargoPct = document.getElementById('res-recargo-pct');
        const elAvisoPrevio = document.getElementById('res-aviso-previo');
        const elReintegroAfc = document.getElementById('res-reintegro-afc');
        const elLeyBustos = document.getElementById('res-ley-bustos');
        const elLeyBustosRow = document.getElementById('row-ley-bustos');
        const elCostas = document.getElementById('res-costas');
        const elCostasRow = document.getElementById('row-costas');

        if (elIasBase) elIasBase.textContent = formatMoney(res.iasBase);
        if (elAniosDesc) elAniosDesc.textContent = res.aniosComputables + ' ' + (res.aniosComputables === 1 ? 'año' : 'años');
        if (elRecargo) elRecargo.textContent = '+' + formatMoney(res.montoRecargoJudicial);
        if (elRecargoPct) elRecargoPct.textContent = '(+' + res.porcentajeRecargo + '%)';

        const totalAviso = res.avisoPrevioOriginal + res.avisoPrevioOmisionRiesgo;
        if (elAvisoPrevio) {
            elAvisoPrevio.textContent = totalAviso > 0 ? formatMoney(totalAviso) : '$0';
        }

        if (elReintegroAfc) {
            elReintegroAfc.textContent = res.montoReintegroAFC > 0 ? '+' + formatMoney(res.montoReintegroAFC) : '$0';
        }

        if (elLeyBustosRow) {
            if (state.leyBustosActiva) {
                elLeyBustosRow.classList.remove('hidden');
                if (elLeyBustos) elLeyBustos.textContent = '+' + formatMoney(res.montoSueldosLeyBustos);
            } else {
                elLeyBustosRow.classList.add('hidden');
            }
        }

        if (elCostasRow) {
            if (state.incluirCostas) {
                elCostasRow.classList.remove('hidden');
                if (elCostas) elCostas.textContent = '+' + formatMoney(res.montoCostas);
            } else {
                elCostasRow.classList.add('hidden');
            }
        }

        // Semáforo de Riesgo
        const elBadge = document.getElementById('res-riesgo-badge');
        const elBarra = document.getElementById('res-riesgo-barra');
        if (elBadge) {
            elBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ' + res.nivelClase;
            elBadge.innerHTML = '<span class="w-2 h-2 rounded-full ' + (res.nivelRiesgo === 'Catastrófico' ? 'bg-rose-600 animate-ping' : 'bg-current') + '"></span> Nivel: ' + res.nivelRiesgo;
        }
        if (elBarra) {
            elBarra.style.width = res.nivelBarra;
            elBarra.className = 'h-full rounded-full transition-all duration-500 ' + res.nivelColorBarra;
        }

        // Adaptación de Textos según Modo
        updateModeText(res);
    }

    // Actualizar Textos y CTAs según Modo (Empleador vs Trabajador)
    function updateModeText(res) {
        const elHeroCifra = document.getElementById('cta-cifra-dinamica');
        const ctaEmpleador = document.getElementById('cta-bloque-empleador');
        const ctaTrabajador = document.getElementById('cta-bloque-trabajador');
        const lblTotalHeader = document.getElementById('lbl-total-header');
        const lblTotalDesc = document.getElementById('lbl-total-desc');

        if (elHeroCifra) {
            elHeroCifra.textContent = formatMoney(res.totalSentencia);
        }

        if (state.mode === 'empleador') {
            if (ctaEmpleador) ctaEmpleador.classList.remove('hidden');
            if (ctaTrabajador) ctaTrabajador.classList.add('hidden');
            if (lblTotalHeader) lblTotalHeader.textContent = 'Riesgo Máximo por Demanda Perdida';
            if (lblTotalDesc) lblTotalDesc.textContent = 'Monto total a pagar en caso de sentencia condenatoria desfavorable:';
        } else {
            if (ctaEmpleador) ctaEmpleador.classList.add('hidden');
            if (ctaTrabajador) ctaTrabajador.classList.remove('hidden');
            if (lblTotalHeader) lblTotalHeader.textContent = 'Total Estimado a Exigir en Demanda';
            if (lblTotalDesc) lblTotalDesc.textContent = 'Monto que tu empleador debería pagarte si demandas por despido injustificado:';
        }
    }

    // Eventos y Enlace con UI
    function initEvents() {
        // Toggle Modo (Empleador / Trabajador)
        const btnModoEmp = document.getElementById('tab-modo-empleador');
        const btnModoTrab = document.getElementById('tab-modo-trabajador');

        if (btnModoEmp && btnModoTrab) {
            btnModoEmp.addEventListener('click', function () {
                state.mode = 'empleador';
                btnModoEmp.className = 'flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all bg-white text-slate-900 shadow-sm border border-slate-200/80';
                btnModoTrab.className = 'flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all text-slate-600 hover:text-slate-900';
                calculate();
            });

            btnModoTrab.addEventListener('click', function () {
                state.mode = 'trabajador';
                btnModoTrab.className = 'flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all bg-white text-slate-900 shadow-sm border border-slate-200/80';
                btnModoEmp.className = 'flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all text-slate-600 hover:text-slate-900';
                calculate();
            });
        }

        // Input Sueldo
        const inSueldo = document.getElementById('sim-sueldo');
        if (inSueldo) {
            inSueldo.addEventListener('input', function (e) {
                const val = parseMoney(e.target.value);
                state.sueldoImponible = val;
                e.target.value = formatMoney(val);
                calculate();
            });
        }

        // Antigüedad: Años y Meses
        const inAnios = document.getElementById('sim-anios');
        const inMeses = document.getElementById('sim-meses');
        if (inAnios) {
            inAnios.addEventListener('change', function (e) {
                state.anios = parseInt(e.target.value, 10) || 0;
                calculate();
            });
        }
        if (inMeses) {
            inMeses.addEventListener('change', function (e) {
                state.meses = parseInt(e.target.value, 10) || 0;
                calculate();
            });
        }

        // Causal
        const inCausales = document.querySelectorAll('input[name="sim-causal"]');
        inCausales.forEach(function (radio) {
            radio.addEventListener('change', function (e) {
                if (e.target.checked) {
                    state.causal = e.target.value;
                    // Actualizar visibilidad de opciones específicas
                    const afcBlock = document.getElementById('block-afc-option');
                    if (afcBlock) {
                        if (state.causal === 'art161') {
                            afcBlock.classList.remove('opacity-50', 'pointer-events-none');
                        } else {
                            afcBlock.classList.add('opacity-50', 'pointer-events-none');
                        }
                    }
                    calculate();
                }
            });
        });

        // Aviso Previo (30 días)
        const inAviso = document.getElementById('sim-aviso-previo');
        if (inAviso) {
            inAviso.addEventListener('change', function (e) {
                state.avisoPrevioPagado = e.target.checked;
                calculate();
            });
        }

        // Descuento AFC
        const inAfcCheck = document.getElementById('sim-afc-descuento');
        const inAfcMonto = document.getElementById('sim-afc-monto');
        if (inAfcCheck) {
            inAfcCheck.addEventListener('change', function (e) {
                state.descuentoAfcAplicado = e.target.checked;
                const fieldMonto = document.getElementById('sim-afc-monto-container');
                if (fieldMonto) {
                    if (state.descuentoAfcAplicado) {
                        fieldMonto.classList.remove('hidden');
                    } else {
                        fieldMonto.classList.add('hidden');
                    }
                }
                calculate();
            });
        }
        if (inAfcMonto) {
            inAfcMonto.addEventListener('input', function (e) {
                state.montoAfcPersonalizado = parseMoney(e.target.value);
                e.target.value = state.montoAfcPersonalizado > 0 ? formatMoney(state.montoAfcPersonalizado) : '';
                calculate();
            });
        }

        // Ley Bustos (Cotizaciones Impagas)
        const inLeyBustos = document.getElementById('sim-ley-bustos');
        const containerLeyBustos = document.getElementById('container-meses-bustos');
        const inMesesBustos = document.getElementById('sim-meses-bustos');
        const valMesesBustos = document.getElementById('val-meses-bustos');

        if (inLeyBustos) {
            inLeyBustos.addEventListener('change', function (e) {
                state.leyBustosActiva = e.target.checked;
                if (containerLeyBustos) {
                    if (state.leyBustosActiva) {
                        containerLeyBustos.classList.remove('hidden');
                    } else {
                        containerLeyBustos.classList.add('hidden');
                    }
                }
                calculate();
            });
        }

        if (inMesesBustos) {
            inMesesBustos.addEventListener('input', function (e) {
                state.mesesJuicioLeyBustos = parseInt(e.target.value, 10) || 5;
                if (valMesesBustos) valMesesBustos.textContent = state.mesesJuicioLeyBustos + ' meses';
                calculate();
            });
        }

        // Costas
        const inCostas = document.getElementById('sim-incluir-costas');
        if (inCostas) {
            inCostas.addEventListener('change', function (e) {
                state.incluirCostas = e.target.checked;
                calculate();
            });
        }

        // Formulario de Lead Trabajador
        const leadForm = document.getElementById('sim-lead-form');
        if (leadForm) {
            leadForm.addEventListener('submit', function (e) {
                e.preventDefault();
                enviarLeadTrabajador(e);
            });
        }
    }

    // Envío de Lead a /api/send-lead
    function enviarLeadTrabajador(event) {
        const form = document.getElementById('sim-lead-form');
        const btn = document.getElementById('sim-lead-btn');
        const success = document.getElementById('sim-lead-success');

        const nombre = (document.getElementById('sim-lead-nombre') || {}).value || '';
        const correo = (document.getElementById('sim-lead-correo') || {}).value || '';
        const telefono = (document.getElementById('sim-lead-telefono') || {}).value || '';
        const ciudad = (document.getElementById('sim-lead-ciudad') || {}).value || '';
        const detalle = (document.getElementById('sim-lead-detalle') || {}).value || '';
        const consent = (document.getElementById('sim-lead-consent') || {}).checked;

        if (!consent) {
            alert('Debes autorizar el tratamiento de datos para conectar con un abogado.');
            return;
        }

        const info = `Causal: ${state.causal} | Sueldo: ${formatMoney(state.sueldoImponible)} | Antigüedad: ${state.anios}a ${state.meses}m | Ley Bustos: ${state.leyBustosActiva ? 'SÍ' : 'NO'} | Ciudad: ${ciudad} | Nota: ${detalle}`;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons text-sm animate-spin">autorenew</span> Evaluando caso...';
        }

        fetch('/api/send-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                correo: correo,
                telefono: telefono,
                tipo: 'Demanda Despido Injustificado',
                fuente: 'Simulador Despido Injustificado Chile',
                detalle: info
            })
        }).then(function (res) {
            if (res.ok) {
                form.classList.add('hidden');
                success.classList.remove('hidden');
            } else {
                throw new Error('Error al enviar');
            }
        }).catch(function () {
            alert('Hubo un inconveniente al enviar tu consulta. Por favor escríbenos directamente a contacto@calculolaboral.cl');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-icons text-sm text-white">gavel</span> <span class="text-white font-bold">Solicitar Evaluación Gratuita con Abogado</span>';
            }
        });
    }

    // Inicializar
    document.addEventListener('DOMContentLoaded', function () {
        initEvents();
        calculate();
    });

    document.addEventListener('indicatorsUpdated', function () {
        calculate();
    });

})();
