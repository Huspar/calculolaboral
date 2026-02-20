/**
 * Release: v1.0.0
 * Fecha: Febrero 2026
 * Estado: Producción estable
 */

/**
 * UI Controller for Sueldo Líquido Calculator (Phase 2 Enhanced)
 * Connects inputs to ForensicSalaryCalculator
 */

document.addEventListener('DOMContentLoaded', () => {
    // Defensive Element Getter
    const getEl = (id) => document.getElementById(id);

    // DOM Elements
    const inputs = {
        salary: getEl('salary'),
        overtime: getEl('overtime'),
        bonuses: getEl('bonuses'),
        gratificationType: getEl('gratificationType'),
        gratificationManual: getEl('gratificationManual'),
        manualGratContainer: getEl('manualGratInput'),
        afp: getEl('afpSelect'),
        // Health Radios - get by Name
        isapreInput: getEl('isapreInput'),
        isapreValue: getEl('isapreValue'),
        colacion: getEl('colacion'),
        movilizacion: getEl('movilizacion'),
        viaticos: getEl('viaticos'),
        btnIndefinido: getEl('btn-indefinido'),
        btnPlazo: getEl('btn-plazo'),

        // Phase 2 Inputs
        ccaf: getEl('ccaf'),
        apv: getEl('apv'),
        prestamos: getEl('prestamos'),
        pension: getEl('pension'),
        sindicato: getEl('sindicato'),
        otrosDescuentos: getEl('otrosDescuentos')
    };

    // Health Radios are special
    const healthRadios = document.getElementsByName('salud');

    const display = {
        // Sticky Header
        netSalary: getEl('headerNetSalary'),
        percentage: getEl('headerPercentage'),
        totalDiscounts: getEl('headerTotalDiscounts'),

        // Legal Breakdown
        afpAmount: getEl('resultAFP'),
        afpLabel: getEl('labelAFP'),
        healthAmount: getEl('resultHealth'),
        healthLabel: getEl('labelHealth'),
        afcAmount: getEl('resultAFC'),
        taxAmount: getEl('resultTax'),

        // Imponibles Breakdown
        sectionImponibles: getEl('section-imponibles'),
        ccafResult: getEl('resultCCAF'),
        apvResult: getEl('resultAPV'),

        // No Imponibles Breakdown
        sectionNoImponibles: getEl('section-no-imponibles'),
        prestamosResult: getEl('resultPrestamos'),
        pensionResult: getEl('resultPension'),
        sindicatoResult: getEl('resultSindicato'),
        otrosResult: getEl('resultOtros'),

        // Chart
        chart: document.querySelector('.w-48.h-48.rounded-full'),
        chartLabel: document.querySelector('.w-48.h-48.rounded-full span.text-3xl'),

        // Indicators (stable selectors)
        ufVal: document.querySelector('.uf-value'),
        utmVal: document.querySelector('.utm-value'),

        // Notifications
        notifications: getEl('global-notifications'),

        // Mobile Sticky Bar
        mobileResultBar: getEl('mobile-result-bar'),
        mobileResultValue: getEl('mobile-result-value'),
        mobileResultPercentage: getEl('mobile-result-percentage')
    };

    let contractType = 'indefinido';

    // Use shared Validation module (loaded from validation.js)
    const V = window.Validation;

    // Helper: Format Currency (safe — never NaN)
    const formatCLP = (num) => V.formatCLPSafe(num);

    // Helper: Parse input safely
    const parseInput = (val) => V.safeCurrency(val);

    const formatInput = (input) => {
        let rawVal = input.value.replace(/\./g, '').replace(/[^0-9]/g, '');
        if (rawVal) {
            let newVal = new Intl.NumberFormat('es-CL').format(parseInt(rawVal));
            if (input.value !== newVal) input.value = newVal;
        } else {
            if (input.value !== '') input.value = '';
        }
    };




    // Initialization
    const init = () => {
        console.log('Salary UI Initializing...');

        // Set Economic Indicators
        // Set Economic Indicators
        let C = null;
        if (typeof window !== 'undefined' && window.CONSTANTS) {
            C = window.CONSTANTS;
        } else if (typeof CONSTANTS !== 'undefined') {
            C = CONSTANTS;
        }

        if (C) {
            if (display.ufVal) display.ufVal.textContent = formatCLP(C.UF);
            if (display.utmVal) display.utmVal.textContent = formatCLP(C.UTM);
            // Note: indicators.js will overwrite this with real data if available
        }

        // Attach Events
        Object.keys(inputs).forEach(key => {
            const el = inputs[key];
            if (el && el.tagName === 'INPUT') {
                el.addEventListener('input', (e) => {
                    if (key === 'isapreValue' || key === 'overtime') {
                        calculate();
                        return;
                    }
                    formatInput(e.target);
                    calculate();
                });
            } else if (el && el.tagName === 'SELECT') {
                el.addEventListener('change', () => {
                    if (key === 'gratificationType') toggleGratification();
                    calculate();
                });
            }
        });

        if (healthRadios.length > 0) {
            healthRadios.forEach(r => r.addEventListener('change', () => {
                toggleIsapre();
                calculate();
            }));
        }

        if (inputs.btnIndefinido) {
            inputs.btnIndefinido.addEventListener('click', () => {
                contractType = 'indefinido';
                updateContractUI();
                calculate();
            });
        }
        if (inputs.btnPlazo) {
            inputs.btnPlazo.addEventListener('click', () => {
                contractType = 'plazo_fijo';
                updateContractUI();
                calculate();
            });
        }



        // Mobile Menu Logic
        const mobileMenuBtn = getEl('mobile-menu-btn');
        const mobileMenu = getEl('mobile-menu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                const isHidden = mobileMenu.classList.toggle('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', !isHidden);
            });
        }

        // Prevent Negative Inputs
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', (e) => {
                if (parseFloat(e.target.value) < 0) {
                    e.target.value = 0;
                }
            });
        });

        // Listen for Real-time Indicators Update
        document.addEventListener('indicatorsUpdated', () => {
            console.log('Recalculating with new indicators...');
            // refresh display values from global CONSTANTS if needed
            if (typeof CONSTANTS !== 'undefined') {
                if (display.ufVal) display.ufVal.textContent = formatCLP(CONSTANTS.UF);
                if (display.utmVal) display.utmVal.textContent = formatCLP(CONSTANTS.UTM);
            }
            calculate();
        });

        calculate();
    };

    const toggleIsapre = () => {
        const checked = Array.from(healthRadios).find(r => r.checked);
        const isIsapre = checked ? checked.value === 'isapre' : false;
        if (isIsapre && inputs.isapreInput) {
            inputs.isapreInput.classList.remove('hidden');
        } else if (inputs.isapreInput) {
            inputs.isapreInput.classList.add('hidden');
        }
    };

    const toggleGratification = () => {
        if (inputs.gratificationType && inputs.manualGratContainer) {
            if (inputs.gratificationType.value === 'manual') {
                inputs.manualGratContainer.classList.remove('hidden');
            } else {
                inputs.manualGratContainer.classList.add('hidden');
            }
        }
    };

    const updateContractUI = () => {
        if (!inputs.btnIndefinido || !inputs.btnPlazo) return;
        if (contractType === 'indefinido') {
            inputs.btnIndefinido.classList.remove('text-slate-400', 'hover:text-white');
            inputs.btnIndefinido.classList.add('bg-primary', 'text-white', 'shadow-lg');
            inputs.btnPlazo.classList.remove('bg-primary', 'text-white', 'shadow-lg');
            inputs.btnPlazo.classList.add('text-slate-400', 'hover:text-white');
        } else {
            inputs.btnPlazo.classList.remove('text-slate-400', 'hover:text-white');
            inputs.btnPlazo.classList.add('bg-primary', 'text-white', 'shadow-lg');
            inputs.btnIndefinido.classList.remove('bg-primary', 'text-white', 'shadow-lg');
            inputs.btnIndefinido.classList.add('text-slate-400', 'hover:text-white');
        }
    };

    // ===== VALIDATION ===== //
    const validateSalaryForm = () => {
        V.clearAllErrors();
        let valid = true;

        // Salary > 0 (always required — empty or 0 blocks calculation)
        if (inputs.salary) {
            const sal = V.safeCurrency(inputs.salary.value);
            if (sal <= 0) {
                V.showFieldError(inputs.salary, 'Ingresa un sueldo mayor a $0');
                valid = false;
            }
        }

        // Overtime: 0-100 hours
        if (inputs.overtime && inputs.overtime.value.trim() !== '') {
            const ot = V.safeNumber(inputs.overtime.value);
            if (ot < 0 || ot > 100) {
                V.showFieldError(inputs.overtime, 'Máximo 100 horas extra');
                valid = false;
            }
        }

        // Isapre UF: 0-30 (only if isapre is selected)
        const checkedHealth = Array.from(healthRadios).find(r => r.checked);
        if (checkedHealth && checkedHealth.value === 'isapre' && inputs.isapreValue) {
            const uf = V.safeNumber(inputs.isapreValue.value);
            if (uf < 0 || uf > 30) {
                V.showFieldError(inputs.isapreValue, 'Valor entre 0 y 30 UF');
                valid = false;
            }
        }

        return valid;
    };

    const calculate = () => {
        // Gate: validate first
        if (!validateSalaryForm()) return;

        const getVal = (el) => el ? el.value : '0';

        const data = {
            baseSalary: parseInput(getVal(inputs.salary)),
            gratificationType: inputs.gratificationType ? inputs.gratificationType.value : 'legal_tope',
            gratificationManual: parseInput(getVal(inputs.gratificationManual)),
            overtimeHours: V.safeNumber(getVal(inputs.overtime)),
            bonusAmount: parseInput(getVal(inputs.bonuses)),
            colacion: parseInput(getVal(inputs.colacion)),
            movilizacion: parseInput(getVal(inputs.movilizacion)),
            viaticos: parseInput(getVal(inputs.viaticos)),
            afpName: inputs.afp ? inputs.afp.value.split(' ')[0] : 'Modelo',
            healthSystem: 'fonasa',
            isapreUF: V.safeNumber(getVal(inputs.isapreValue)),
            contractType: contractType,

            // Phase 2 Data
            ccafAmount: parseInput(getVal(inputs.ccaf)),
            apvAmount: parseInput(getVal(inputs.apv)),
            prestamos: parseInput(getVal(inputs.prestamos)),
            pension: parseInput(getVal(inputs.pension)),
            sindicato: parseInput(getVal(inputs.sindicato)),
            otrosDescuentos: parseInput(getVal(inputs.otrosDescuentos)),

            // P1: Feature flag – CCAF/APV reduce base de cotizaciones
            reduceSocialSecurityBaseByCCAFAPV: (() => {
                const toggle = getEl('toggleReduceSS');
                return toggle ? toggle.checked : false;
            })()
        };

        // Final NaN safety net
        for (const key in data) {
            if (typeof data[key] === 'number' && isNaN(data[key])) {
                data[key] = 0;
            }
        }

        const checkedHealthRadio = Array.from(healthRadios).find(r => r.checked);
        if (checkedHealthRadio) data.healthSystem = checkedHealthRadio.value;

        if (typeof ForensicSalaryCalculator !== 'undefined') {
            try {
                const calculator = new ForensicSalaryCalculator(data);
                const result = calculator.calculate();
                updateUI(result, data);
            } catch (e) {
                console.error("Calculation Error Details:", e);
                console.error("Data Payload:", data);
            }
        } else {
            console.error("ForensicSalaryCalculator class is undefined");
        }
    };

    const updateUI = (res, data) => {
        const d = res.details;
        const setText = (el, text) => { if (el) el.textContent = text; };

        // 1. Sticky Header
        setText(display.netSalary, formatCLP(d.netSalary));

        // Calculate Percentage of Gross
        const grossTotal = d.baseSalary + d.gratification + d.overtimeAmount + d.bonusAmount; // Not exactly Total Taxable because Taxable might be capped? No gross is gross.
        const perc = grossTotal > 0 ? (d.netSalary / grossTotal) * 100 : 0;
        setText(display.percentage, `${perc.toFixed(1)}%`);

        // Update Mobile Bar
        if (display.mobileResultBar) {
            setText(display.mobileResultValue, formatCLP(d.netSalary));
            setText(display.mobileResultPercentage, `${perc.toFixed(1)}%`);

            if (d.netSalary > 0) {
                display.mobileResultBar.classList.remove('translate-y-full');
            } else {
                display.mobileResultBar.classList.add('translate-y-full');
            }
        }

        // Total Discounts (Everything that was subtracted)
        // Gross - Net + NonTaxableAdded? 
        // Or just sum of all deductions.
        // Deductions = Legal + TaxableDisc + NonTaxableDisc + Tax
        const totalDeductions = d.afpAmount + d.healthAmount + d.afcAmount + d.taxAmount +
            d.ccafAmount + d.apvAmount +
            d.prestamos + d.pension + d.sindicato + d.otrosDescuentos;

        setText(display.totalDiscounts, `-${formatCLP(totalDeductions)}`);

        // 2. Legal Breakdown
        setText(display.afpAmount, `-${formatCLP(d.afpAmount)}`);
        setText(display.afpLabel, `AFP ${data.afpName}`);

        const healthName = data.healthSystem === 'fonasa' ? 'Fonasa' : 'Isapre';
        setText(display.healthAmount, `-${formatCLP(d.healthAmount)}`);
        setText(display.healthLabel, `Salud (${healthName})`);

        setText(display.afcAmount, `-${formatCLP(d.afcAmount)}`);
        setText(display.taxAmount, `-${formatCLP(d.taxAmount)}`);

        // 3. Imponibles Breakdown (Hide if 0)
        let hasImponibles = (d.ccafAmount > 0 || d.apvAmount > 0);
        if (display.sectionImponibles) {
            if (hasImponibles) {
                display.sectionImponibles.classList.remove('hidden');
                display.sectionImponibles.classList.add('block'); // Ensure block
                setText(display.ccafResult, `-${formatCLP(d.ccafAmount)}`);
                setText(display.apvResult, `-${formatCLP(d.apvAmount)}`);
            } else {
                display.sectionImponibles.classList.add('hidden');
                display.sectionImponibles.classList.remove('block');
            }
        }

        // 4. No Imponibles Breakdown (Hide if 0)
        let hasNoImponibles = (d.prestamos > 0 || d.pension > 0 || d.sindicato > 0 || d.otrosDescuentos > 0);
        if (display.sectionNoImponibles) {
            if (hasNoImponibles) {
                display.sectionNoImponibles.classList.remove('hidden');
                display.sectionNoImponibles.classList.add('block');
                setText(display.prestamosResult, `-${formatCLP(d.prestamos)}`);
                setText(display.pensionResult, `-${formatCLP(d.pension)}`);
                setText(display.sindicatoResult, `-${formatCLP(d.sindicato)}`);
                setText(display.otrosResult, `-${formatCLP(d.otrosDescuentos)}`);
            } else {
                display.sectionNoImponibles.classList.add('hidden');
                display.sectionNoImponibles.classList.remove('block');
            }
        }

        // 5. Notifications (using createElement for safety)
        if (display.notifications) {
            display.notifications.innerHTML = '';

            const createAlert = (bgClass, borderClass, iconColor, icon, textColor, message) => {
                const div = document.createElement('div');
                div.className = `${bgClass} ${borderClass} rounded-lg p-3 flex gap-3 items-center`;
                const span = document.createElement('span');
                span.className = `material-icons ${iconColor} text-sm`;
                span.textContent = icon;
                const p = document.createElement('p');
                p.className = `text-xs ${textColor}`;
                p.textContent = message;
                div.appendChild(span);
                div.appendChild(p);
                return div;
            };

            // Min Wage Warning
            if (d.baseSalary < 539000 && d.baseSalary > 0) {
                display.notifications.appendChild(
                    createAlert('bg-yellow-500/10', 'border border-yellow-500/20', 'text-yellow-500', 'warning', 'text-yellow-200', 'Sueldo base menor al mínimo legal ($539.000)')
                );
            }

            // CCAF Info
            if (d.ccafAmount > 0) {
                display.notifications.appendChild(
                    createAlert('bg-blue-500/10', 'border border-blue-500/20', 'text-blue-400', 'info', 'text-blue-200', 'CCAF reduce tu base imponible')
                );
            }

            // APV Tip
            if (d.apvAmount > 0) {
                display.notifications.appendChild(
                    createAlert('bg-emerald-500/10', 'border border-emerald-500/20', 'text-emerald-400', 'lightbulb', 'text-emerald-200', 'APV reduce tu impuesto y te da beneficio tributario')
                );
            }

            if (display.notifications.children.length > 0) {
                display.notifications.classList.remove('hidden');
            } else {
                display.notifications.classList.add('hidden');
            }
        }

        // 6. Chart
        if (display.chart) {
            const total = d.netSalary + totalDeductions;
            if (total === 0) return;

            // Simplified Chart: Net vs Deductions
            const pNet = (d.netSalary / total) * 100;
            const pDed = 100 - pNet;

            // Green for Net, Red/Blue for Deductions
            display.chart.style.background = `conic-gradient(
                #10b981 0% ${pNet}%, 
                #ef4444 ${pNet}% 100%
            )`;

            if (display.chartLabel) display.chartLabel.textContent = `${Math.round(pNet)}%`;
        }
    };

    init();
});
