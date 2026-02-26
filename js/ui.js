/**
 * Release: v1.0.0
 * Fecha: Febrero 2026
 * Estado: Producción estable
 */

// DOM Interaction Script - depends on logic.js
// VERSIÓN CORREGIDA - Encoding UTF-8 + Validaciones + Mejoras

const elements = {};
let _previousVacProp = null; // Track previous vacation proportional value for explanation message

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Elements
    elements.startDate = document.getElementById('startDate');
    elements.endDate = document.getElementById('endDate');

    // Inputs Desglosados
    elements.baseSalary = document.getElementById('baseSalary');
    elements.gratification = document.getElementById('gratification');
    elements.assignments = document.getElementById('assignments');

    elements.vacationPending = document.getElementById('vacationPending');
    elements.cause = document.getElementById('cause');
    elements.noticeGiven = document.getElementById('noticeGiven');
    elements.includeAssignmentsInVacation = document.getElementById('includeAssignmentsInVacation');
    elements.includeAssignmentsInIndemnity = document.getElementById('includeAssignmentsInIndemnity');

    // Results
    elements.totalAmount = document.getElementById('totalAmount');
    elements.totalAmountMobile = document.getElementById('totalAmountMobile');
    elements.yearsServiceAmount = document.getElementById('yearsServiceAmount');
    elements.afcRow = document.getElementById('afcRow');
    elements.afcAmount = document.getElementById('afcAmount');
    elements.noticeAmount = document.getElementById('noticeAmount');
    elements.vacationPropAmount = document.getElementById('vacationPropAmount');
    elements.vacationPendingAmount = document.getElementById('vacationPendingAmount');
    elements.antiquityOutput = document.getElementById('antiquityOutput');
    elements.totalVacationDaysOutput = document.getElementById('totalVacationDaysOutput');

    // Mobile Result Bar elements
    elements.mobileResultBar = document.getElementById('mobile-result-bar');
    elements.mobileResultValue = document.getElementById('mobile-result-value');

    // Advanced UI Hooks
    elements.toggleAdvanced = document.getElementById('toggleAdvanced');
    elements.advancedControls = document.getElementById('advancedControls');
    elements.advancedIcon = document.getElementById('advancedIcon');
    elements.ufCapValue = document.getElementById('ufCapValue');
    elements.lastUpdateDate = document.getElementById('lastUpdateDate');

    // Initialize UF Display and Dynamic Date
    if (elements.ufCapValue) {
        // UF Cap = TOPE_INDEMNIZACION * UF
        const topeUF = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_INDEMNIZACION : 90;
        const valorUF = typeof CONSTANTS !== 'undefined' ? CONSTANTS.UF : 0;
        elements.ufCapValue.textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valorUF * topeUF);
    }
    if (elements.lastUpdateDate) {
        const now = new Date();
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        elements.lastUpdateDate.textContent = `Última actualización normativa: ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    if (elements.toggleAdvanced) {
        elements.toggleAdvanced.addEventListener('click', () => {
            const isHidden = elements.advancedControls.classList.toggle('hidden');
            elements.advancedIcon.textContent = isHidden ? 'expand_more' : 'expand_less';
        });
    }

    // New Pending Remuneration Outputs
    elements.pendingSalaryAmount = document.getElementById('pendingSalaryAmount');
    elements.daysWorkedOutput = document.getElementById('daysWorkedOutput');

    elements.btnVacationMinus = document.getElementById('btnVacationMinus');
    elements.btnVacationPlus = document.getElementById('btnVacationPlus');

    // Rows for toggling visibility/styling
    elements.yearsRow = document.getElementById('yearsRow');
    elements.noticeRow = document.getElementById('noticeRow');

    // Variable Salary Inputs
    elements.hasVariableSalary = document.getElementById('hasVariableSalary');
    elements.variableSalaryContainer = document.getElementById('variableSalaryContainer');

    // Buttons
    elements.btnLoadExample = document.getElementById('btnLoadExample');
    elements.btnClear = document.getElementById('btnClear');

    // Variable Salary Outputs
    elements.varMonth1 = document.getElementById('varMonth1');
    elements.varMonth2 = document.getElementById('varMonth2');
    elements.varMonth3 = document.getElementById('varMonth3');
    elements.variableAverageOutput = document.getElementById('variableAverageOutput');

    // Fetch Holidays from JSON or Constants
    fetch('assets/holidays/holidays-2026.json')
        .then(response => response.json())
        .then(data => {
            window.HOLIDAYS_LIST = data;
            console.log('Holidays loaded:', data.length);
        })
        .catch(err => {
            console.warn('Could not load holidays JSON, using fallback from constants:', err);
            window.HOLIDAYS_LIST = (typeof CONSTANTS !== 'undefined' ? CONSTANTS.HOLIDAYS_2026 : []);
        });

    // ============================================
    // EVENT LISTENERS
    // ============================================

    // Explicitly listing all inputs to ensure event binding works
    const textInputs = [
        elements.startDate, elements.endDate, elements.baseSalary,
        elements.gratification, elements.assignments, elements.vacationPending,
        elements.hasVariableSalary, elements.varMonth1, elements.varMonth2, elements.varMonth3
    ];
    const selectInputs = [
        elements.cause, elements.noticeGiven,
        elements.includeAssignmentsInVacation, elements.includeAssignmentsInIndemnity
    ];

    const attachListener = (el, eventType) => {
        if (el) {
            el.addEventListener(eventType, (e) => {
                // Toggle Variable Salary Visibility
                if (e.target.id === 'hasVariableSalary') {
                    elements.variableSalaryContainer.classList.toggle('hidden', !e.target.checked);
                    if (!e.target.checked) {
                        elements.varMonth1.value = '';
                        elements.varMonth2.value = '';
                        elements.varMonth3.value = '';
                        // Force update to remove variable average from calculation
                        updateCalculations();
                    }
                }

                // Format money inputs
                if (e.target.dataset.type === 'currency') {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val) e.target.value = new Intl.NumberFormat('es-CL').format(parseInt(val));
                }

                updateCalculations();
            });
        }
    };

    textInputs.forEach(el => attachListener(el, 'input'));
    selectInputs.forEach(el => attachListener(el, 'change'));

    // Also attach 'change' to checkbox/date for robustness
    if (elements.hasVariableSalary) attachListener(elements.hasVariableSalary, 'change');
    if (elements.noticeGiven) attachListener(elements.noticeGiven, 'change');
    if (elements.includeAssignmentsInVacation) attachListener(elements.includeAssignmentsInVacation, 'change');
    if (elements.startDate) attachListener(elements.startDate, 'change');
    if (elements.endDate) attachListener(elements.endDate, 'change');

    // Advanced Toggles Listeners
    elements.enableIAS = document.getElementById('enableIAS');
    elements.enableNotice = document.getElementById('enableNotice');
    elements.simulateAFC = document.getElementById('simulateAFC');

    if (elements.enableIAS) elements.enableIAS.addEventListener('change', updateCalculations);
    if (elements.enableNotice) elements.enableNotice.addEventListener('change', updateCalculations);
    if (elements.simulateAFC) elements.simulateAFC.addEventListener('change', updateCalculations);

    // ============================================
    // GRATIFICATION AUTO-CALC & CAP (2026 Rules)
    // ============================================

    if (elements.baseSalary && elements.gratification) {
        // Auto-calculate 25% capped when Base Salary changes
        elements.baseSalary.addEventListener('input', () => {
            const base = parseInt(elements.baseSalary.value.replace(/\D/g, '')) || 0;

            // Calculate Cap Dynamically: (TOPE_GRATIFICACION * IMM) / 12
            const topeGrat = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_GRATIFICACION : 4.75;
            const imm = typeof CONSTANTS !== 'undefined' ? CONSTANTS.IMM : 539000;
            const legalCap = Math.round((topeGrat * imm) / 12);

            // Formula: 25% of Base, capped
            const calculated = Math.min(Math.round(base * 0.25), legalCap);

            elements.gratification.value = new Intl.NumberFormat('es-CL').format(calculated);
            // updateCalculations() is already called by the generic input listener
        });

        // Enforce Hard Cap on Manual Input
        elements.gratification.addEventListener('input', (e) => {
            let val = parseInt(e.target.value.replace(/\D/g, '')) || 0;

            // Calculate Cap Dynamically
            const topeGrat = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_GRATIFICACION : 4.75;
            const imm = typeof CONSTANTS !== 'undefined' ? CONSTANTS.IMM : 539000;
            const legalCap = Math.round((topeGrat * imm) / 12);

            if (val > legalCap) {
                val = legalCap;
                // Clamp visual value
                e.target.value = new Intl.NumberFormat('es-CL').format(val);
            }
        });
    }

    // ============================================
    // VACATION +/- BUTTONS
    // ============================================

    if (elements.btnVacationMinus) {
        elements.btnVacationMinus.addEventListener('click', () => {
            let val = parseFloat(elements.vacationPending.value) || 0;
            elements.vacationPending.value = Math.max(0, val - 0.5).toFixed(1);
            updateCalculations();
        });
    }

    if (elements.btnVacationPlus) {
        elements.btnVacationPlus.addEventListener('click', () => {
            let val = parseFloat(elements.vacationPending.value) || 0;
            elements.vacationPending.value = (val + 0.5).toFixed(1);
            updateCalculations();
        });
    }

    // ============================================
    // DATE VALIDATION
    // ============================================

    if (elements.startDate && elements.endDate) {
        const validateDates = () => {
            if (!elements.startDate.value || !elements.endDate.value) return true;

            const start = new Date(elements.startDate.value);
            const end = new Date(elements.endDate.value);

            if (end < start) {
                // Show error
                elements.endDate.setCustomValidity('La fecha de término debe ser posterior a la fecha de inicio');
                elements.endDate.reportValidity();
                return false;
            } else {
                elements.endDate.setCustomValidity('');
                return true;
            }
        };

        elements.startDate.addEventListener('change', validateDates);
        elements.endDate.addEventListener('change', validateDates);
    }

    // ============================================
    // ACTION BUTTONS
    // ============================================

    if (elements.btnLoadExample) {
        elements.btnLoadExample.addEventListener('click', () => {
            // Realistic Chilean Data
            if (elements.startDate) elements.startDate.value = '2021-03-01';
            if (elements.endDate) elements.endDate.value = '2026-02-09';
            if (elements.baseSalary) elements.baseSalary.value = '850.000'; // Formato visual
            if (elements.gratification) elements.gratification.value = '212.500'; // Art 50 approx
            if (elements.assignments) elements.assignments.value = '80.000';
            if (elements.vacationPending) elements.vacationPending.value = '15';

            // Optional/Standard defaults
            if (elements.cause) elements.cause.value = '161'; // Nec. Empresa
            if (elements.noticeGiven) elements.noticeGiven.checked = false;

            // Trigger calculation immediately
            updateCalculations();
        });
    }

    if (elements.btnClear) {
        elements.btnClear.addEventListener('click', () => {
            // Reset standard inputs
            const inputsToClear = [
                elements.startDate, elements.endDate, elements.baseSalary,
                elements.gratification, elements.assignments, elements.vacationPending,
                elements.varMonth1, elements.varMonth2, elements.varMonth3
            ];

            inputsToClear.forEach(input => {
                if (input) input.value = '';
            });

            // Reset Toggle inputs
            if (elements.noticeGiven) elements.noticeGiven.checked = false;
            if (elements.hasVariableSalary) {
                elements.hasVariableSalary.checked = false;
                elements.variableSalaryContainer.classList.add('hidden');
            }
            // Reset Cause
            if (elements.cause) elements.cause.value = '161';

            // Trigger update to clear results
            updateCalculations();
        });
    }

    // ============================================
    // SCROLL LISTENER FOR MOBILE BAR
    // ============================================
    window.addEventListener('scroll', () => {
        if (!elements.mobileResultBar) return;

        // Show after 300px of scroll
        if (window.scrollY > 300) {
            elements.mobileResultBar.classList.remove('translate-y-full');
        } else {
            elements.mobileResultBar.classList.add('translate-y-full');
        }
    });

    // Initialize - Start Empty
    updateCalculations();
});

// ============================================
// MAIN UPDATE FUNCTION
// ============================================

function updateCalculations() {
    if (!elements.baseSalary) return;

    const V = window.Validation;

    // Helper for formatting currency (safe — never NaN)
    const format = (n) => V.formatCLPSafe(n);

    // Safe parsers using Validation module
    const parseCurrency = (el) => V.safeCurrency(el?.value);
    const parseFloatSafe = (el) => V.safeNumber(el?.value);

    // ============================================
    // VALIDATION (Day 2)
    // ============================================

    V.clearAllErrors();
    let validationFailed = false;

    // If essential fields are empty, show placeholders (existing behavior)
    if (!elements.startDate.value || !elements.endDate.value || !elements.baseSalary.value) {
        // Set Empty States
        if (elements.totalAmount) elements.totalAmount.textContent = "$ — CLP";
        if (elements.totalAmountMobile) elements.totalAmountMobile.textContent = "$ —";
        if (elements.yearsServiceAmount) elements.yearsServiceAmount.textContent = "$ — CLP";
        if (elements.noticeAmount) elements.noticeAmount.textContent = "$ — CLP";
        if (elements.vacationPropAmount) elements.vacationPropAmount.textContent = "$ — CLP";
        if (elements.vacationPendingAmount) elements.vacationPendingAmount.textContent = "$ — CLP";

        // Pending Remuneration
        if (elements.pendingSalaryAmount) elements.pendingSalaryAmount.textContent = "$ — CLP";
        if (elements.daysWorkedOutput) elements.daysWorkedOutput.textContent = "— DÍAS TRABAJADOS";

        // Totals Panel
        if (elements.antiquityOutput) elements.antiquityOutput.textContent = "— años, — meses";
        if (elements.totalVacationDaysOutput) elements.totalVacationDaysOutput.textContent = "— días corridos";

        // Reset Styles
        if (elements.yearsRow) {
            elements.yearsRow.classList.remove('opacity-50', 'line-through');
            elements.yearsRow.removeAttribute('title');
        }
        if (elements.noticeRow) {
            elements.noticeRow.classList.remove('opacity-50', 'line-through');
        }

        return; // Stop here, do not attempt calculation
    }

    // Validate salary > 0
    if (elements.baseSalary.value.trim() !== '') {
        const salVal = V.safeCurrency(elements.baseSalary.value);
        if (salVal <= 0) {
            V.showFieldError(elements.baseSalary, 'Ingresa un sueldo mayor a $0');
            validationFailed = true;
        }
    }

    // Validate date order
    if (!V.requireDateOrder(elements.startDate, elements.endDate)) {
        validationFailed = true;
    }

    // Validate vacation days: 0-90
    if (elements.vacationPending && elements.vacationPending.value.trim() !== '') {
        const vd = V.safeNumber(elements.vacationPending.value);
        if (vd < 0 || vd > 90) {
            V.showFieldError(elements.vacationPending, 'Máximo 90 días de vacaciones');
            validationFailed = true;
        }
    }

    if (validationFailed) return;

    // ============================================
    // PARSE INPUTS
    // ============================================

    const baseSalary = parseCurrency(elements.baseSalary);
    const gratification = parseCurrency(elements.gratification);
    const assignments = parseCurrency(elements.assignments);
    const vacationDaysPending = parseFloatSafe(elements.vacationPending);

    // Variable Salary Calculation
    let variableAverage = 0;
    if (elements.hasVariableSalary && elements.hasVariableSalary.checked) {
        const v1 = parseCurrency(elements.varMonth1);
        const v2 = parseCurrency(elements.varMonth2);
        const v3 = parseCurrency(elements.varMonth3);

        let sum = v1 + v2 + v3;
        variableAverage = Math.round(sum / 3);

        if (elements.variableAverageOutput) {
            elements.variableAverageOutput.textContent = format(variableAverage);
        }
    } else {
        variableAverage = 0;
        if (elements.variableAverageOutput) {
            elements.variableAverageOutput.textContent = '$0';
        }
    }


    // ============================================
    // CALCULATE (with error handling)
    // ============================================

    try {
        // FiniquitoCalculator is available globally from logic.js
        // If logic.js is not loaded, this will throw
        if (typeof FiniquitoCalculator === 'undefined') {
            throw new Error('FiniquitoCalculator logic is not loaded');
        }

        const rawCause = elements.cause?.value ?? '161';
        const cause = rawCause.replace(/\D/g, '') || '161';

        const calculator = new FiniquitoCalculator({
            startDate: elements.startDate.value, // YYYY-MM-DD
            endDate: elements.endDate.value,     // YYYY-MM-DD
            baseSalary,
            gratification,
            assignments,
            variableAverage,
            vacationDaysPending: vacationDaysPending,
            cause: cause,
            noticeGiven: elements.noticeGiven.checked,
            includeAssignmentsInVacation: elements.includeAssignmentsInVacation ?
                elements.includeAssignmentsInVacation.checked : true,
            includeAssignmentsInIndemnity: elements.includeAssignmentsInIndemnity ?
                elements.includeAssignmentsInIndemnity.checked : true,
            enableIAS: readBool(elements.enableIAS, true),
            enableNotice: readBool(elements.enableNotice, true),
            simulateAFC: readBool(elements.simulateAFC, true),
            holidays: window.HOLIDAYS_LIST
        });

        const results = calculator.calculate();

        if (elements.totalAmount) elements.totalAmount.textContent = format(results.total);
        if (elements.totalAmountMobile) elements.totalAmountMobile.textContent = format(results.total).replace(' CLP', '');

        // Update Mobile Bottom Bar if exists
        if (elements.mobileResultValue) elements.mobileResultValue.textContent = format(results.total).replace(' CLP', '');

        if (elements.yearsServiceAmount) elements.yearsServiceAmount.textContent = format(results.indemnities.yearsOfService.total);

        // AFC Deduction Row Update
        if (elements.afcRow && elements.afcAmount) {
            if (results.afc.applied && results.afc.total > 0) {
                elements.afcRow.classList.remove('hidden');
                elements.afcAmount.textContent = `- ${format(results.afc.total)}`;
                elements.afcRow.title = results.afc.reason;
            } else {
                elements.afcRow.classList.add('hidden');
            }
        }

        if (elements.noticeAmount) elements.noticeAmount.textContent = format(results.indemnities.notice.total);
        if (elements.vacationPropAmount) elements.vacationPropAmount.textContent = format(results.indemnities.vacation.proportionalTotal);
        if (elements.vacationPendingAmount) elements.vacationPendingAmount.textContent = format(results.indemnities.vacation.pendingTotal);

        // Pending Remuneration
        if (elements.pendingSalaryAmount) elements.pendingSalaryAmount.textContent = format(results.pendingRemuneration.total);
        if (elements.daysWorkedOutput) elements.daysWorkedOutput.textContent = `${results.pendingRemuneration.daysWorked} DÍAS TRABAJADOS`;

        // Update Totals Panel (Non-monetary)
        if (elements.antiquityOutput) {
            const years = results.serviceTime.years;
            const months = results.serviceTime.months;

            if (isNaN(years) || isNaN(months)) {
                elements.antiquityOutput.textContent = "— años, — meses";
            } else {
                elements.antiquityOutput.textContent = `${years} años, ${months} meses`;
            }
        }

        if (elements.totalVacationDaysOutput) {
            const vacDays = parseFloat(results.vacationIndemnity.totalCalendarDays);
            const displayDays = isNaN(vacDays) ? "—" :
                new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(vacDays);
            elements.totalVacationDaysOutput.textContent = `${displayDays} días hábiles`; // User requested clarity on 'hábiles' vs 'corridos'
            elements.totalVacationDaysOutput.title = results.vacationIndemnity.details;
        }

        // ============================================
        // STYLING LOGIC (Educational)
        // ============================================

        // Years of Service
        if (elements.yearsRow) {
            if (results.yearsOfServiceIndemnity.total === 0) {
                elements.yearsRow.classList.add('opacity-50', 'line-through');
                elements.yearsRow.title = results.yearsOfServiceIndemnity.reason;
            } else {
                elements.yearsRow.classList.remove('opacity-50', 'line-through');
                elements.yearsRow.title = `${results.yearsOfServiceIndemnity.yearsUsed} años computados (Tope 11)`;
            }
        }

        // Notice
        if (elements.noticeRow) {
            if (results.noticeIndemnity.total === 0) {
                elements.noticeRow.classList.add('opacity-50', 'line-through');
                elements.noticeRow.title = results.noticeIndemnity.reason;
            } else {
                elements.noticeRow.classList.remove('opacity-50', 'line-through');
            }
        }

        // ============================================
        // VACATION EXPLANATION MESSAGE
        // ============================================

        const currentVacProp = results.vacationIndemnity.proportionalTotal;
        const vacMsgId = 'vacationExplanationMsg';
        let existingMsg = document.getElementById(vacMsgId);

        // CONDICIÓN 1: Transición de >0 a 0 (usuario movió fecha)
        const isTransition = _previousVacProp !== null && _previousVacProp > 0 && currentVacProp === 0;

        // CONDICIÓN 2: Año cerrado / aniversario (carga directa con fecha exacta)
        const svcYears = results.serviceTime.years;
        const svcMonths = results.serviceTime.months;
        const isExactAnniversary = currentVacProp === 0 && svcYears >= 1 && svcMonths === 0;

        if (isTransition || isExactAnniversary) {
            // Show explanation message
            if (!existingMsg) {
                existingMsg = document.createElement('div');
                existingMsg.id = vacMsgId;
                existingMsg.className = 'mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2';

                const icon = document.createElement('span');
                icon.textContent = '⚠️';
                icon.className = 'flex-shrink-0 text-sm mt-0.5';

                const text = document.createElement('p');
                text.className = 'text-xs text-amber-300/90 leading-relaxed';
                text.textContent = 'Al completar un nuevo año laboral, las vacaciones dejan de ser proporcionales y pasan a considerarse vacaciones del período siguiente. Por eso este ítem puede desaparecer del cálculo. ';

                const guideLink = document.createElement('a');
                guideLink.href = 'guia-vacaciones-proporcionales.html';
                guideLink.className = 'underline text-amber-200 hover:text-white transition-colors';
                guideLink.textContent = 'Ver guía completa';
                text.appendChild(guideLink);

                existingMsg.appendChild(icon);
                existingMsg.appendChild(text);

                // Insert after the vacation proportional row
                const vacPropRow = elements.vacationPropAmount ? elements.vacationPropAmount.closest('[class*="flex"]') : null;
                if (vacPropRow && vacPropRow.parentNode) {
                    vacPropRow.parentNode.insertBefore(existingMsg, vacPropRow.nextSibling);
                }
            }
        } else {
            // Hide explanation message
            if (existingMsg) {
                existingMsg.remove();
            }
        }

        _previousVacProp = currentVacProp;

        // ============================================
        // ANALYTICS TRACKING (optional)
        // ============================================

        trackCalculation(results);

    } catch (error) {
        console.error('Error en cálculo de finiquito:', error);
        if (typeof window !== 'undefined') {
            window.__lastFiniquitoError = {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
        }

        // Show user-friendly error
        if (elements.totalAmount) {
            elements.totalAmount.textContent = "Error en cálculo";
            elements.totalAmount.classList.add('text-red-500');
        }
        if (elements.totalAmountMobile) {
            elements.totalAmountMobile.textContent = "Error";
            elements.totalAmountMobile.classList.add('text-red-500');
        }

        // Optional: Show alert for critical errors
        // alert('Hubo un error al calcular. Por favor verifica los datos ingresados.');
    }
}

// ============================================
// ANALYTICS TRACKING
// ============================================

function trackCalculation(results) {
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'calculate_finiquito', {
            'event_category': 'Calculator',
            'event_label': results.economics.isCapped ? 'capped_salary' : 'normal_salary',
            'value': Math.round(results.total)
        });
    }

    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Calculate', {
            content_name: 'Finiquito',
            value: results.total,
            currency: 'CLP'
        });
    }

    // Log to console for debugging (remove in production)
    console.log('Cálculo completado:', {
        total: results.total,
        antiguedad: `${results.serviceTime.years} años, ${results.serviceTime.months} meses`,
        salaryCapped: results.economics.isCapped
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Helper for Robust Boolean Reading
function readBool(el, defaultValue = true) {
    if (!el) return defaultValue;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return !!el.checked;
    const v = (el.value ?? '').toString().toLowerCase().trim();
    if (v === '') return defaultValue;
    return (v === 'true' || v === '1' || v === 'yes' || v === 'on');
}

// Format number as Chilean Pesos
function formatChileanPesos(amount) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Copy result to clipboard
function copyResultToClipboard() {
    if (!elements.totalAmount) return;

    const text = elements.totalAmount.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('¡Resultado copiado al portapapeles!', 'success');
        }).catch(err => {
            console.error('Error copiando:', err);
        });
    }
}

// Show notification (simple version - you can improve this)
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: Implement visual notification
}
