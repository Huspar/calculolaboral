/**
 * validation.js — Shared Input Validation Utilities
 * Día 2: Validación de inputs y robustez
 * Fecha: Febrero 2026
 */

const Validation = {

    // =============================================
    // SAFE PARSERS (replace raw parseFloat/parseInt)
    // =============================================

    /** Parse a number safely — never returns NaN */
    safeNumber(value, fallback = 0) {
        if (value === null || value === undefined || value === '') return fallback;
        const parsed = parseFloat(value);
        return isFinite(parsed) ? parsed : fallback;
    },

    /** Parse a CLP currency string safely: strips dots/chars, returns int */
    safeCurrency(value) {
        if (!value) return 0;
        const stripped = String(value).replace(/\./g, '').replace(/[^0-9]/g, '');
        return parseInt(stripped, 10) || 0;
    },

    /** Format a number as CLP — never returns NaN, undefined, or empty */
    formatCLPSafe(num) {
        const safe = isFinite(num) ? num : 0;
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(safe);
    },

    /**
     * Fintech-grade live currency mask for input fields.
     * Transforms raw typing like '1500000' into '$ 1.500.000' in real-time,
     * maintaining exact cursor position without jumping to the end.
     */
    maskCurrency(input) {
        if (!input) return;
        const raw = input.value || '';
        const oldSel = input.selectionStart || 0;

        // Count numeric digits before current cursor position
        let digitsBefore = 0;
        for (let i = 0; i < oldSel; i++) {
            if (/\d/.test(raw[i])) digitsBefore++;
        }

        // Extract only digits
        const digits = raw.replace(/\D/g, '');

        // If field was cleared completely
        if (!digits) {
            if (input.value !== '') input.value = '';
            return;
        }

        // Cap to 11 digits (up to $99.999.999.999 CLP)
        const cleanDigits = digits.slice(0, 11);
        const intVal = parseInt(cleanDigits, 10);

        const formattedNum = new Intl.NumberFormat('es-CL').format(intVal);
        const formatted = '$ ' + formattedNum;

        if (input.value !== formatted) {
            input.value = formatted;
        }

        // Calculate new cursor position preserving digit offset
        let newPos = formatted.length;
        let counted = 0;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                counted++;
                if (counted === digitsBefore) {
                    newPos = i + 1;
                    break;
                }
            }
        }
        if (digitsBefore === 0) newPos = 2; // Right after '$ '

        try {
            input.setSelectionRange(newPos, newPos);
        } catch (e) {}
    },

    /**
     * Attaches live mask listeners and mobile numeric keypad attributes to an input
     */
    attachCurrencyMask(input) {
        if (!input || input._hasCurrencyMask) return;
        input._hasCurrencyMask = true;

        // Ensure proper mobile keypad
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('spellcheck', 'false');

        // Real-time live mask on input event
        input.addEventListener('input', () => {
            this.maskCurrency(input);
        });

        // Intelligent backspace over dots / space
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                if (start === end && start > 0) {
                    const charBefore = input.value[start - 1];
                    if (charBefore === '.' || charBefore === ' ') {
                        e.preventDefault();
                        const before = input.value.slice(0, start - 2);
                        const after = input.value.slice(start);
                        input.value = before + after;
                        input.setSelectionRange(start - 2, start - 2);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }
        });

        // If it already has an initial numeric value without '$ ', format it immediately
        if (input.value && !input.value.startsWith('$')) {
            this.maskCurrency(input);
        }
    },

    // =============================================
    // INLINE ERROR MESSAGES
    // =============================================

    /**
     * Show an inline error message below an input field.
     * Creates a <p> element with class 'field-error' if it doesn't exist.
     */
    showFieldError(inputEl, message) {
        if (!inputEl) return;
        inputEl.classList.add('ring-1', 'ring-red-500/50');

        let errorEl = inputEl.parentElement.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'field-error text-[11px] text-red-400 mt-1 flex items-center gap-1 animate-fade-in';
            errorEl.innerHTML = `<span class="material-icons text-[12px]">error_outline</span> <span class="error-text"></span>`;
            // Insert after the input (or after its parent wrapper if inside one)
            inputEl.parentElement.appendChild(errorEl);
        }

        const textEl = errorEl.querySelector('.error-text');
        if (textEl) textEl.textContent = message;
        errorEl.style.display = 'flex';
    },

    /** Clear the inline error for a specific input */
    clearFieldError(inputEl) {
        if (!inputEl) return;
        inputEl.classList.remove('ring-1', 'ring-red-500/50');

        const errorEl = inputEl.parentElement.querySelector('.field-error');
        if (errorEl) errorEl.style.display = 'none';
    },

    /** Clear all inline errors within a container */
    clearAllErrors(container) {
        if (!container) container = document;
        container.querySelectorAll('.field-error').forEach(el => el.style.display = 'none');
        // ring-1 is always added alongside ring-red-500/50, so query it reliably
        container.querySelectorAll('.ring-1').forEach(el => {
            el.classList.remove('ring-1', 'ring-red-500/50');
        });
    },

    // =============================================
    // FIELD VALIDATORS
    // =============================================

    /** Validate a currency field is > 0. Returns true if valid. */
    requirePositiveCurrency(inputEl, label) {
        const val = this.safeCurrency(inputEl?.value);
        if (val <= 0) {
            this.showFieldError(inputEl, `Ingresa un ${label} mayor a $0`);
            return false;
        }
        this.clearFieldError(inputEl);
        return true;
    },

    /** Validate a number is within range. Returns true if valid. */
    requireRange(inputEl, min, max, label) {
        const val = this.safeNumber(inputEl?.value);
        if (val < min || val > max) {
            this.showFieldError(inputEl, `${label} debe ser entre ${min} y ${max}`);
            return false;
        }
        this.clearFieldError(inputEl);
        return true;
    },

    /** Validate that endDate > startDate. Returns true if valid. */
    requireDateOrder(startEl, endEl) {
        if (!startEl?.value || !endEl?.value) return true; // empty is handled elsewhere

        const start = new Date(startEl.value);
        const end = new Date(endEl.value);

        if (isNaN(start.getTime())) {
            this.showFieldError(startEl, 'Fecha de inicio no válida');
            return false;
        }
        if (isNaN(end.getTime())) {
            this.showFieldError(endEl, 'Fecha de término no válida');
            return false;
        }

        // Avoid triggering validation while the user is still typing the year (e.g. "0002")
        if (start.getFullYear() < 1900 || end.getFullYear() < 1900) {
            this.clearFieldError(startEl);
            this.clearFieldError(endEl);
            return true;
        }

        if (end < start) {
            this.showFieldError(endEl, 'Debe ser posterior a la fecha de inicio');
            return false;
        }

        this.clearFieldError(startEl);
        this.clearFieldError(endEl);
        return true;
    }
};

// Make globally available
window.Validation = Validation;
window.formatCurrencyInput = function(input) {
    Validation.attachCurrencyMask(input);
    Validation.maskCurrency(input);
};

// =============================================
// QA MODE (dev only — ?qa=1)
// =============================================

(function initQAMode() {
    if (!new URLSearchParams(window.location.search).has('qa')) return;

    const QA = {
        results: [],
        pass: 0,
        fail: 0,

        log(testName, passed, detail) {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            this.results.push({ test: testName, status, detail });
            passed ? this.pass++ : this.fail++;
            console[passed ? 'log' : 'error'](`${status}: ${testName}${detail ? ' — ' + detail : ''}`);
        },

        /** Set an input element's value and dispatch 'input' event */
        setInput(id, value) {
            const el = document.getElementById(id);
            if (!el) return null;
            // Use native setter to work with formatInput handlers
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeSetter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return el;
        },

        /** Check if a field has an active error shown */
        hasError(id) {
            const el = document.getElementById(id);
            if (!el) return false;
            const errEl = el.parentElement?.querySelector('.field-error');
            return errEl && errEl.style.display !== 'none';
        },

        /** Check if any visible text contains NaN/undefined/Infinity */
        checkNoNaN(selector) {
            const els = document.querySelectorAll(selector || '[id]');
            const bad = [];
            els.forEach(el => {
                const txt = el.textContent || '';
                if (/\bNaN\b|\bundefined\b|\bInfinity\b/.test(txt)) {
                    bad.push({ id: el.id || el.className, text: txt.trim().substring(0, 80) });
                }
            });
            return bad;
        },

        /** Pause briefly to let DOM update */
        wait(ms = 50) {
            return new Promise(r => setTimeout(r, ms));
        },

        // ---- SUELDO LIQUIDO TESTS ----
        async runSueldoTests() {
            console.group('🔬 QA: Sueldo Líquido');

            // T1: Empty salary → should show error
            Validation.clearAllErrors();
            this.setInput('salary', '');
            document.getElementById('salary')?.dispatchEvent(new Event('input', { bubbles: true }));
            // Trigger calculate
            const calcBtn = document.querySelector('[onclick*="calculate"]') ||
                document.getElementById('salary'); // fallback: just trigger input
            // Force calculation via exposed function
            if (typeof window.triggerCalculation === 'function') window.triggerCalculation();
            else document.getElementById('salary')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait();
            this.log('Sueldo vacío → bloquea', this.hasError('salary'), 'Should show error on empty salary');

            // T2: Salary = "0" → should show error
            this.setInput('salary', '0');
            document.getElementById('salary')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait();
            this.log('Sueldo "0" → bloquea', this.hasError('salary'), 'Salary 0 must be rejected');

            // T3: Salary = "800.000" → should NOT show error
            Validation.clearAllErrors();
            this.setInput('salary', '800000');
            document.getElementById('salary')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait(100);
            this.log('Sueldo "800.000" → permite', !this.hasError('salary'), 'Valid salary should pass');

            // T4: Check no NaN in output after valid salary
            const nanCheck = this.checkNoNaN('#headerNetSalary, #resultAFP, #resultHealth, #resultAFC, #resultTax');
            this.log('Sin NaN en salida', nanCheck.length === 0,
                nanCheck.length > 0 ? 'NaN found in: ' + JSON.stringify(nanCheck) : 'All outputs clean');

            // T5: Salary = "abc" → should block
            this.setInput('salary', 'abc');
            document.getElementById('salary')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait();
            this.log('Sueldo "abc" → bloquea', this.hasError('salary'), 'Non-numeric must be rejected');

            // T6: Overtime = 150 → should block
            Validation.clearAllErrors();
            this.setInput('salary', '800000');
            this.setInput('overtime', '150');
            document.getElementById('overtime')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait();
            this.log('Horas extra 150 → bloquea', this.hasError('overtime'), 'Max 100 hours');

            // T7: Isapre UF = 50 → should block (need to select isapre first)
            const isapreRadio = document.querySelector('input[name="health"][value="isapre"]');
            if (isapreRadio) {
                isapreRadio.checked = true;
                isapreRadio.dispatchEvent(new Event('change', { bubbles: true }));
                await this.wait(100);
                this.setInput('isapreValue', '50');
                this.setInput('overtime', '0'); // reset overtime
                document.getElementById('isapreValue')?.dispatchEvent(new Event('input', { bubbles: true }));
                await this.wait();
                this.log('Isapre 50 UF → bloquea', this.hasError('isapreValue'), 'Max 30 UF');

                // Reset to Fonasa
                const fonasaRadio = document.querySelector('input[name="health"][value="fonasa"]');
                if (fonasaRadio) {
                    fonasaRadio.checked = true;
                    fonasaRadio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                this.log('Isapre 50 UF → bloquea', false, 'SKIP: isapre radio not found');
            }

            // Cleanup
            Validation.clearAllErrors();
            this.setInput('salary', '');
            this.setInput('overtime', '');

            console.groupEnd();
        },

        // ---- FINIQUITO TESTS ----
        async runFiniquitoTests() {
            console.group('🔬 QA: Finiquito');

            // T1: End date < Start date → should block
            Validation.clearAllErrors();
            this.setInput('baseSalary', '800000');
            this.setInput('startDate', '2025-06-01');
            this.setInput('endDate', '2025-03-01');
            // Trigger update
            document.getElementById('endDate')?.dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById('endDate')?.dispatchEvent(new Event('input', { bubbles: true }));
            await this.wait(100);
            // Also try to trigger updateCalculations directly
            if (typeof updateCalculations === 'function') updateCalculations();
            await this.wait();
            this.log('Término < Inicio → bloquea', this.hasError('endDate'), 'End date must be after start');

            // T2: Vacation days = 999 → should block
            Validation.clearAllErrors();
            this.setInput('startDate', '2024-01-15');
            this.setInput('endDate', '2025-06-01');
            this.setInput('baseSalary', '800000');
            this.setInput('vacationPending', '999');
            if (typeof updateCalculations === 'function') updateCalculations();
            await this.wait();
            this.log('Vacaciones 999 → bloquea', this.hasError('vacationPending'), 'Max 90 days');

            // T3: Valid case → should pass
            Validation.clearAllErrors();
            this.setInput('startDate', '2024-01-15');
            this.setInput('endDate', '2025-06-01');
            this.setInput('baseSalary', '800000');
            this.setInput('vacationPending', '5');
            if (typeof updateCalculations === 'function') updateCalculations();
            await this.wait(100);
            const hasAnyError = document.querySelector('.field-error[style*="flex"]') !== null;
            this.log('Caso válido → permite', !hasAnyError, 'All valid inputs should calculate');

            // T4: Check no NaN in finiquito output
            const nanCheck = this.checkNoNaN('#totalAmount, #yearsServiceAmount, #noticeAmount, #vacationPropAmount, #vacationPendingAmount, #pendingSalaryAmount');
            this.log('Sin NaN en salida', nanCheck.length === 0,
                nanCheck.length > 0 ? 'NaN found in: ' + JSON.stringify(nanCheck) : 'All outputs clean');

            // T5: Salary = 0 → should block
            Validation.clearAllErrors();
            this.setInput('baseSalary', '0');
            if (typeof updateCalculations === 'function') updateCalculations();
            await this.wait();
            this.log('Sueldo 0 → bloquea', this.hasError('baseSalary'), 'Zero salary must be rejected');

            // Cleanup
            Validation.clearAllErrors();

            console.groupEnd();
        },

        // ---- SUMMARY ----
        printSummary() {
            console.log('\n');
            console.group('📊 QA SUMMARY');
            console.table(this.results);
            const total = this.pass + this.fail;
            const pct = total > 0 ? Math.round((this.pass / total) * 100) : 0;
            console.log(`\n  Result: ${this.pass}/${total} passed (${pct}%)`);
            if (this.fail > 0) {
                console.error(`  ⚠️ ${this.fail} test(s) FAILED`);
            } else {
                console.log('  🎉 All tests passed!');
            }
            console.groupEnd();
        }
    };

    // Inject QA button on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.createElement('button');
        btn.id = 'qa-run-btn';
        btn.textContent = '🔬 Run QA';
        btn.className = 'fixed top-2 right-2 z-[9999] px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono rounded-lg shadow-lg transition-all cursor-pointer';
        btn.title = 'Dev-only: Run validation test suite';

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = '⏳ Running...';
            QA.results = [];
            QA.pass = 0;
            QA.fail = 0;

            // Detect which calculator page we're on
            const isSueldo = !!document.getElementById('salary');
            const isFiniquito = !!document.getElementById('baseSalary');

            if (isSueldo) await QA.runSueldoTests();
            if (isFiniquito) await QA.runFiniquitoTests();

            QA.printSummary();

            btn.textContent = `🔬 QA: ${QA.pass}/${QA.pass + QA.fail}`;
            btn.disabled = false;
        });

        // Insert at body start
        document.body.prepend(btn);
    });

    window.__QA = QA;
})();
