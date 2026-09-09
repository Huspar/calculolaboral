/**
 * PDF Report Generator & Lead Capture System - Cálculo Laboral (2026)
 * Handles modal injection, email capture (opt-in), leads backup in localStorage,
 * and compiles pixel-perfect print sheets for native browser PDF export.
 */

(function () {
    // CONFIGURACIÓN DE LEADS: Reemplaza con la URL de tu Google Apps Script desplegado
    const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby81-BL0hip010mshIYnpCwTMHKJYEcyNVrZyKZeoRJDi3_MQ4UWEC7gf2HxhcJ4iL1Ug/exec';

    // 1. SETUP EVENT LISTENERS ON PAGE LOAD (print styles now inline in HTML)
    window.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
    });

    // 2. MODAL HTML TEMPLATE (REMOVED: PDF is downloaded directly without asking for email)

    // 3. INJECT PRINT STYLES — MOVED TO INLINE CSS (kept as no-op for compatibility)
    function injectPrintStyles() {
        // Print styles are now in the HTML <style> block for better mobile support.
        // This function is intentionally empty — do not remove to avoid breaking references.
    }

    // 4. SETUP EVENT LISTENERS
    function setupEventListeners() {
        const downloadBtnFini = document.getElementById('download-pdf-btn');
        const downloadBtnSueldo = document.getElementById('download-pdf-btn-sueldo');

        const downloadHandler = (calculatorType) => {
            // Verify that calculator is calculated
            if (!isCalculated()) {
                alert("Por favor, realiza una simulación primero ingresando tus datos para generar el reporte.");
                return;
            }

            // Track event in GA4
            if (typeof gtag !== 'undefined') {
                gtag('event', 'click_download_pdf_report', {
                    'event_category': 'PDF_Report',
                    'event_label': calculatorType + '_report'
                });
            }

            generatePDFReport();
        };

        if (downloadBtnFini) {
            downloadBtnFini.addEventListener('click', () => downloadHandler('finiquito'));
        }
        if (downloadBtnSueldo) {
            downloadBtnSueldo.addEventListener('click', () => downloadHandler('sueldo_liquido'));
        }
    }

    // 5. HELPER: STRICT EMAIL VALIDATION (REMOVED)

    // 6. HELPER: CHECK IF CALCULATOR IS GENUINELY CALCULATED WITH REAL INPUTS
    function isCalculated() {
        const isSueldoActive = document.getElementById('sueldo-calc-container') && !document.getElementById('sueldo-calc-container').classList.contains('hidden');

        if (isSueldoActive) {
            // For Sueldo Liquido
            const netSalElement = document.getElementById('headerNetSalary');
            if (netSalElement) {
                const salary = document.getElementById('salary')?.value;
                
                // If main input is empty or negative/zero, it's not calculated
                if (!salary || parseFloat(salary.replace(/\./g, '')) <= 0) {
                    return false;
                }
                
                const val = netSalElement.textContent.trim();
                // Should not be the default zero placeholder or error states
                return val !== '' && val !== '$0' && val !== '$ --' && !val.includes('Error') && !val.includes('—');
            }
        } else {
            // For Finiquito
            const totalFiniElement = document.getElementById('totalAmount');
            if (totalFiniElement) {
                const startDate = document.getElementById('startDate')?.value;
                const endDate = document.getElementById('endDate')?.value;
                const baseSalary = document.getElementById('baseSalary')?.value;
                
                // If main inputs are completely empty or negative, it's not calculated
                if (!startDate || !endDate || !baseSalary || parseFloat(baseSalary.replace(/\./g, '')) <= 0) {
                    return false;
                }
                
                const val = totalFiniElement.textContent.trim();
                // Should not be the default placeholder value, error, or empty reset states
                return val !== '' && val !== '$6.850.250' && val !== '$ — CLP' && !val.includes('Error') && !val.includes('—');
            }
        }

        return false;
    }

    // 6. HELPER: SAVE EMAIL LEAD TO LOCAL STORAGE DATABASE (REMOVED)

    // 7. MAIN FUNCTION: GENERATE PRINT REPORT AND TRIGGER WINDOW.PRINT
    function generatePDFReport() {
        const isSueldoActive = document.getElementById('sueldo-calc-container') && !document.getElementById('sueldo-calc-container').classList.contains('hidden');
        
        // Remove existing print section
        const oldSection = document.getElementById('print-section');
        if (oldSection) oldSection.remove();

        const printSection = document.createElement('div');
        printSection.id = 'print-section';
        printSection.style.display = 'none';

        const currentDate = new Date().toLocaleDateString('es-CL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let htmlContent = '';

        if (isSueldoActive) {
            htmlContent = compileSueldoReport(currentDate);
        } else {
            htmlContent = compileFiniquitoReport(currentDate);
        }

        printSection.innerHTML = htmlContent;
        document.body.appendChild(printSection);

        // Wait a tiny bit for render, then print
        setTimeout(() => {
            window.print();
            // Clean up print section after dialog close
            setTimeout(() => {
                const sec = document.getElementById('print-section');
                if (sec) sec.remove();
            }, 1000);
        }, 100);
    }

    // 7.5 HELPER: BRANDED HEADER WITH OFFICIAL SVG LOGO & PALETTE
    function getBrandedHeaderHTML(reportTitle, dateString, folio) {
        return `
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #0284c7 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(2,132,199,0.25);">
                        <svg style="width: 24px; height: 24px;" viewBox="0 0 100 100" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M30 84h40M38 79h24"></path>
                            <path d="M50 22v57"></path>
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                            <path d="M58 43.5v20h10"></path>
                        </svg>
                    </div>
                    <div>
                        <div style="margin: 0; font-size: 14pt; font-weight: 800; color: #0f172a; line-height: 1.1; letter-spacing: -0.3px;">
                            Cálculo<span style="color: #0284c7;">Laboral</span>
                        </div>
                        <div style="font-size: 6.8pt; font-weight: 600; color: #64748b; letter-spacing: 0.3px; margin-top: 1px;">
                            PLATAFORMA LEGAL Y FINANCIERA · CHILE
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; padding: 3px 9px; background-color: #f0f9ff !important; border: 1px solid #bae6fd; border-radius: 9999px; font-size: 7.5pt; font-weight: 700; color: #0369a1; letter-spacing: 0.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                        ${reportTitle}
                    </span>
                    <div style="font-size: 7pt; color: #64748b; margin-top: 3px;">
                        Fecha: <strong style="color: #0f172a;">${dateString}</strong>
                    </div>
                    ${folio ? `<div style="font-size: 6.5pt; color: #94a3b8; font-family: monospace; letter-spacing: 0.3px;">Folio: ${folio}</div>` : ''}
                </div>
            </div>
        `;
    }

    // 8. COMPILE FINIQUITO REPORT
    function compileFiniquitoReport(dateString) {
        // Generate unique folio: YYYYMMDD-XXXXX
        const now = new Date();
        const folioDate = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const folioRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
        const folio = `FIN-${folioDate}-${folioRandom}`;

        // Economic indicators from CONSTANTS (global)
        const uf = (typeof CONSTANTS !== 'undefined' && CONSTANTS.UF) ? CONSTANTS.UF : '--';
        const utm = (typeof CONSTANTS !== 'undefined' && CONSTANTS.UTM) ? CONSTANTS.UTM : '--';
        const imm = (typeof CONSTANTS !== 'undefined' && CONSTANTS.IMM) ? CONSTANTS.IMM : '--';

        // Query results safely from DOM
        const total = document.getElementById('totalAmount')?.textContent || '$0';
        const antiquity = document.getElementById('antiquityOutput')?.textContent || 'No especificada';
        const vacationDays = document.getElementById('totalVacationDaysOutput')?.textContent || '0 días';
        
        const yearsService = document.getElementById('yearsServiceAmount')?.textContent || '$0';
        const noticeAmount = document.getElementById('noticeAmount')?.textContent || '$0';
        const pendingSalary = document.getElementById('pendingSalaryAmount')?.textContent || '$0';
        const vacationProp = document.getElementById('vacationPropAmount')?.textContent || '$0';
        const vacationPendingAmt = document.getElementById('vacationPendingAmount')?.textContent || '$0';
        
        // AFC Deduction (if displayed or not hidden)
        const afcRow = document.getElementById('afcRow');
        const afcAmount = (afcRow && !afcRow.classList.contains('hidden')) 
            ? document.getElementById('afcAmount')?.textContent 
            : '$0';

        // Query input values for general details
        const startDateVal = document.getElementById('startDate')?.value || '--';
        const endDateVal = document.getElementById('endDate')?.value || '--';
        const baseSalary = document.getElementById('baseSalary')?.value || '0';
        const assignments = document.getElementById('assignments')?.value || '0';
        
        const causeSelect = document.getElementById('cause');
        const cause = causeSelect ? causeSelect.options[causeSelect.selectedIndex]?.text : 'No especificada';
        
        const noticeCheckbox = document.getElementById('noticeGiven');
        const noticeText = (noticeCheckbox && noticeCheckbox.checked) ? 'Sí' : 'No';

        // --- NEW: Income tab fields ---
        const hasVariableSalary = document.getElementById('hasVariableSalary')?.checked || false;
        const varMonth1 = document.getElementById('varMonth1')?.value || '0';
        const varMonth2 = document.getElementById('varMonth2')?.value || '0';
        const varMonth3 = document.getElementById('varMonth3')?.value || '0';
        const variableAverage = document.getElementById('variableAverageOutput')?.textContent || '$0';

        const gratification = document.getElementById('gratification')?.value || '0';
        const vacPendingDays = document.getElementById('vacationPending')?.value || '0';
        const includeAssignInVac = document.getElementById('includeAssignmentsInVacation')?.checked || false;

        // --- NEW: Advanced options tab fields ---
        const enableIAS = document.getElementById('enableIAS')?.checked ?? true;
        const enableNotice = document.getElementById('enableNotice')?.checked ?? true;
        const simulateAFC = document.getElementById('simulateAFC')?.checked || false;
        const enablePending = document.getElementById('enablePending')?.checked ?? true;
        const includeAssignInIndem = document.getElementById('includeAssignmentsInIndemnity')?.checked || false;

        // Helper: build variable salary rows for Bases de Cálculo
        let variableSalaryRows = '';
        if (hasVariableSalary) {
            variableSalaryRows = `
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Sueldo Variable:</td>
                            <td style="font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Sí (prom. ${variableAverage})</td>
                        </tr>`;
        }

        // Helper: gratification row
        let gratificationRow = '';
        const gratVal = parseCleanNumber(gratification);
        if (gratVal > 0) {
            gratificationRow = `
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Gratificación Art. 50:</td>
                            <td style="font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(gratVal)} CLP</td>
                        </tr>`;
        }

        // Helper: vacation pending days row
        let vacPendingRow = '';
        const vacPDays = parseCleanNumber(vacPendingDays);
        if (vacPDays > 0) {
            vacPendingRow = `
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Vac. pendientes ant.:</td>
                            <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">${vacPDays} días</td>
                        </tr>`;
        }

        // Build options checkmarks (compact single line per option)
        const checkIcon = '☑';
        const uncheckIcon = '☐';
        const optionsItems = [
            { label: 'Indemn. Años Serv.', active: enableIAS },
            { label: 'Aviso Previo', active: enableNotice },
            { label: 'Desc. AFC', active: simulateAFC },
            { label: 'Sueldo Pendiente', active: enablePending },
            { label: 'Asign. en IAS', active: includeAssignInIndem },
            { label: 'Asign. en Vac.', active: includeAssignInVac }
        ];

        return `
            ${getBrandedHeaderHTML('SIMULACIÓN DE FINIQUITO LEGAL', dateString, folio)}

            <!-- Economic Indicators Chips -->
            <div style="display: flex; gap: 6px; margin-bottom: 8px; font-size: 7pt;">
                <div style="flex: 1; background: #f0f9ff !important; border: 1px solid #bae6fd; border-radius: 5px; padding: 3px 6px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                    <span style="color: #0369a1; font-weight: 700; text-transform: uppercase; font-size: 6.5pt;">UF:</span>&nbsp;&nbsp;<strong style="color: #0c4a6e; font-size: 7.5pt;">$${typeof uf === 'number' ? formatNumber(uf) : uf}</strong>
                </div>
                <div style="flex: 1; background: #f8fafc !important; border: 1px solid #e2e8f0; border-radius: 5px; padding: 3px 6px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                    <span style="color: #475569; font-weight: 700; text-transform: uppercase; font-size: 6.5pt;">UTM:</span>&nbsp;&nbsp;<strong style="color: #1e293b; font-size: 7.5pt;">$${typeof utm === 'number' ? formatNumber(utm) : utm}</strong>
                </div>
                <div style="flex: 1; background: #fffbeb !important; border: 1px solid #fde68a; border-radius: 5px; padding: 3px 6px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                    <span style="color: #b45309; font-weight: 700; text-transform: uppercase; font-size: 6.5pt;">Sueldo Mínimo (IMM):</span>&nbsp;&nbsp;<strong style="color: #78350f; font-size: 7.5pt;">$${typeof imm === 'number' ? formatNumber(imm) : imm}</strong>
                </div>
            </div>

            <!-- Subtitle and Scope -->
            <div style="border-left: 3px solid #0284c7; padding-left: 8px; margin-bottom: 8px;">
                <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">
                    Reporte de Liquidación Estimada de Finiquito Laboral
                </div>
                <div style="font-size: 6.8pt; color: #64748b; margin-top: 1px;">
                    Desglose normativo conforme al Código del Trabajo de Chile (Arts. 67, 73, 159, 160, 161, 163, 168 y 177) y jurisprudencia DT 2026.
                </div>
            </div>

            <!-- Column Layout: Resumen del Contrato and Bases de Cálculo side by side -->
            <div style="display: flex; gap: 10px; margin-bottom: 6px; width: 100%;">
                <div style="flex: 1; min-width: 0;">
                    <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">1. Resumen del Contrato</div>
                    <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt;">
                        <tr>
                            <td style="font-weight: 600; width: 40%; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Inicio:</td>
                            <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 600;">${formatInputDate(startDateVal)}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Término:</td>
                            <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 600;">${formatInputDate(endDateVal)}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Antigüedad:</td>
                            <td style="font-weight: 700; color: #0f172a; padding: 2.5px 5px; border: 1px solid #e2e8f0;">${antiquity}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Causal:</td>
                            <td style="font-size: 6.8pt; padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #0369a1;">${cause}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">¿Aviso previo?:</td>
                            <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600;">${noticeText}</td>
                        </tr>
                    </table>
                </div>
                <div style="width: 46%; min-width: 0;">
                    <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">2. Bases de Cálculo y Remuneración</div>
                    <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt;">
                        <tr>
                            <td style="font-weight: 600; width: 50%; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Sueldo Base:</td>
                            <td style="font-weight: 700; text-align: right; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(parseCleanNumber(baseSalary))}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: 600; color: #475569; padding: 2.5px 5px; border: 1px solid #e2e8f0;">Haberes no Imp.:</td>
                            <td style="text-align: right; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(parseCleanNumber(assignments))}</td>
                        </tr>
                        ${gratificationRow}
                        ${variableSalaryRows}
                        ${vacPendingRow}
                    </table>
                </div>
            </div>

            <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">3. Detalle de Indemnizaciones y Haberes</div>
            <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt; margin-bottom: 6px;">
                <thead>
                    <tr style="background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                        <th style="width: 72%; text-align: left; padding: 4px 6px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Concepto Liquidado & Fundamento Legal</th>
                        <th style="text-align: right; padding: 4px 6px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Monto Estimado</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 3px 6px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 700; color: #0f172a;">Indemnización por Años de Servicio (IAS)</div>
                            <div style="font-size: 6.3pt; color: #64748b;">Art. 163 Código del Trabajo (1 mes por año de servicio continuo o fracción &ge; 6 meses, tope legal 11 años / 90 UF)</div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #0f172a; padding: 3px 6px; border: 1px solid #e2e8f0;">${yearsService}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 6px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 700; color: #0f172a;">Indemnización Sustitutiva del Aviso Previo</div>
                            <div style="font-size: 6.3pt; color: #64748b;">Art. 161 inc. 2 Código del Trabajo (Equivalente a un mes de remuneración por no mediar 30 días de anticipación)</div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #0f172a; padding: 3px 6px; border: 1px solid #e2e8f0;">${noticeAmount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 6px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 700; color: #0f172a;">Feriado Proporcional (${vacationDays})</div>
                            <div style="font-size: 6.3pt; color: #64748b;">Art. 73 inc. 3 Código del Trabajo (1.25 días hábiles por mes trabajado, proyectados sobre calendario corrido)</div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #0f172a; padding: 3px 6px; border: 1px solid #e2e8f0;">${vacationProp}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 6px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 700; color: #0f172a;">Feriado Legal Pendiente (Períodos Anteriores)</div>
                            <div style="font-size: 6.3pt; color: #64748b;">Art. 67 Código del Trabajo (Vacaciones anuales acumuladas de períodos anteriores no gozadas)</div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #0f172a; padding: 3px 6px; border: 1px solid #e2e8f0;">${vacationPendingAmt}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 6px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 700; color: #0f172a;">Remuneraciones Pendientes (Días del Mes)</div>
                            <div style="font-size: 6.3pt; color: #64748b;">Sueldo proporcional por días efectivamente trabajados en el mes de desvinculación</div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #0f172a; padding: 3px 6px; border: 1px solid #e2e8f0;">${pendingSalary}</td>
                    </tr>
                    ${afcAmount !== '$0' && afcAmount !== '0' && afcAmount !== '' ? `
                    <tr style="background-color: #fef2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                        <td style="padding: 3px 6px; border: 1px solid #fecaca; color: #991b1b;">
                            <div style="font-weight: 700;">(-) Descuento Aporte AFC Empleador</div>
                            <div style="font-size: 6.3pt; color: #b91c1c;">Art. 13 Ley 19.728. <em>Nota: Impugnable judicialmente con recargo si la causal de despido es injustificada.</em></div>
                        </td>
                        <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 8pt; color: #dc2626; padding: 3px 6px; border: 1px solid #fecaca;">-${afcAmount}</td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>

            <!-- Premium Hero Total Box (Sky Blue Brand Theme) -->
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; border: 2px solid #0284c7; border-radius: 7px; padding: 7px 14px; margin-top: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 6.2pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #0284c7; display: block;">✓ CÁLCULO VERIFICADO · VALOR ESTIMADO LÍQUIDO</span>
                    <span style="font-size: 9.5pt; font-weight: 800; color: #0f172a;">Total Neto Estimado del Finiquito:</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 18pt; font-weight: 900; color: #0369a1; font-family: monospace; letter-spacing: -0.5px;">${total}</span>
                    <span style="font-size: 10pt; font-weight: 800; color: #0284c7; margin-left: 2px;">CLP</span>
                </div>
            </div>

            <!-- Parameters Badges -->
            <div style="display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 5px;">
                ${optionsItems.map(o => `<span style="font-size: 6pt; padding: 1.5px 5px; border-radius: 3px; border: 1px solid ${o.active ? '#bae6fd' : '#e2e8f0'}; background-color: ${o.active ? '#f0f9ff' : '#f8fafc'} !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; color: ${o.active ? '#0369a1' : '#94a3b8'}; font-weight: 600;">${o.active ? '✓' : '✗'} ${o.label}</span>`).join('')}
            </div>

            <!-- Amber Legal Alert & Reserva de Derechos -->
            <div style="background-color: #fffbeb !important; border: 1px solid #fde68a; border-left: 3.5px solid #f59e0b; border-radius: 5px; padding: 5px 8px; margin-bottom: 6px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5px;">
                    <strong style="color: #92400e; font-size: 6.6pt; text-transform: uppercase; letter-spacing: 0.4px;">
                        ⚖️ RECOMENDACIÓN LEGAL · RESERVA DE DERECHOS EN EL FINIQUITO
                    </strong>
                    <span style="font-size: 5.8pt; color: #b45309; font-weight: 600;">Plazo legal de pago: 10 días hábiles (Art. 177 CT)</span>
                </div>
                <p style="font-size: 6.2pt; color: #78350f; margin: 0; line-height: 1.3;">
                    Al firmar ante ministro de fe, <strong>estampa de tu puño y letra la frase de Reserva de Derechos</strong> (ej: <em>"Me reservo el derecho a reclamar despido injustificado, recargo legal del 30% al 100% y devolución del descuento AFC"</em>). Firmar con reserva no impide recibir el pago inmediato de los montos reconocidos por el empleador.
                </p>
            </div>

            <!-- Guía de Cotejo para el Trabajador (Sin firmas para evitar confusión) -->
            <div style="background-color: #f8fafc !important; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-top: 6px; margin-bottom: 5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                    <strong style="color: #0f172a; font-size: 6.6pt; text-transform: uppercase; letter-spacing: 0.3px;">
                        📋 GUÍA DE COTEJO PERSONAL · DOCUMENTO INFORMATIVO (NO REQUIERE FIRMAS)
                    </strong>
                    <span style="font-size: 5.8pt; color: #64748b; font-weight: 600;">Uso exclusivo de consulta</span>
                </div>
                <div style="display: flex; gap: 12px; font-size: 6.1pt; color: #475569; line-height: 1.35;">
                    <div style="flex: 1;">
                        <strong>1. Compara cada concepto:</strong> Revisa que los montos ofrecidos por tu empleador no sean inferiores a los calculados en este informe.
                    </div>
                    <div style="flex: 1;">
                        <strong>2. Solicita aclaraciones:</strong> Si existen discrepancias en sueldo base, años o feriados, exige la planilla oficial antes de firmar.
                    </div>
                    <div style="flex: 1;">
                        <strong>3. Firma el finiquito de la empresa:</strong> Este informe es tu respaldo de cálculo. El documento legal vinculante es extendido por el empleador ante ministro de fe.
                    </div>
                </div>
            </div>

            <!-- Footer Disclaimer -->
            <div class="print-disclaimer" style="font-size: 5.8pt; color: #94a3b8; line-height: 1.25; border-top: 1px solid #e2e8f0; padding-top: 3px; text-align: center;">
                <strong>NOTA INFORMATIVA:</strong> Simulación computacional de carácter referencial conforme a normativas de la Dirección del Trabajo (DT). No constituye asesoría letrada ni sustituye la liquidación formal suscrita por las partes.<br>
                <strong>CÁLCULO LABORAL CHILE</strong> — <a href="https://calculolaboral.cl" style="color: #0284c7; text-decoration: none;">www.calculolaboral.cl</a> — Documento generado automáticamente
            </div>
        `;
    }

    // 9. COMPILE SUELDO REPORT
    function compileSueldoReport(dateString) {
        // Query results safely from DOM
        const netSalary = document.getElementById('headerNetSalary')?.textContent || '$0';
        const totalDiscounts = document.getElementById('headerTotalDiscounts')?.textContent || '$0';
        
        const afp = document.getElementById('resultAFP')?.textContent || '$0';
        const health = document.getElementById('resultHealth')?.textContent || '$0';
        const afc = document.getElementById('resultAFC')?.textContent || '$0';
        const tax = document.getElementById('resultTax')?.textContent || '$0';

        const labelAFP = document.getElementById('labelAFP')?.textContent || 'Modelo';
        const labelHealth = document.getElementById('labelHealth')?.textContent || '7%';

        // Input values
        const baseSalary = document.getElementById('salary')?.value || '0';
        const overtimeHours = document.getElementById('overtime')?.value || '0';
        const bonuses = document.getElementById('bonuses')?.value || '0';
        
        const colacion = document.getElementById('colacion')?.value || '0';
        const movilizacion = document.getElementById('movilizacion')?.value || '0';
        const viaticos = document.getElementById('viaticos')?.value || '0';

        // Additional discounts
        const ccaf = document.getElementById('ccaf')?.value || '0';
        const apv = document.getElementById('apv')?.value || '0';
        const prestamos = document.getElementById('prestamos')?.value || '0';
        const pension = document.getElementById('pension')?.value || '0';
        const sindicato = document.getElementById('sindicato')?.value || '0';
        const otrosDescuentos = document.getElementById('otrosDescuentos')?.value || '0';

        return `
            ${getBrandedHeaderHTML('SIMULACIÓN DE SUELDO LÍQUIDO', dateString, null)}

            <div style="border-left: 3px solid #0284c7; padding-left: 8px; margin-bottom: 8px;">
                <div style="font-size: 8.5pt; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">
                    Reporte de Simulación de Sueldo Líquido Mensual
                </div>
                <div style="font-size: 6.8pt; color: #64748b; margin-top: 1px;">
                    Desglose de haberes imponibles, no imponibles y deducciones previsionales conforme a la normativa legal vigente (DT, SII y SP).
                </div>
            </div>

            <!-- Column Layout: Haberes and Descuentos Previsionales side by side -->
            <div style="display: flex; gap: 10px; margin-bottom: 6px; width: 100%;">
                <div style="flex: 1; min-width: 0;">
                    <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">1. Haberes (Ingresos Brutos)</div>
                    <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt;">
                        <thead>
                            <tr style="background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                                <th style="width: 60%; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Concepto</th>
                                <th style="text-align: right; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Sueldo Base Mensual</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(parseCleanNumber(baseSalary))} CLP</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; color: #475569;">Horas Extras (${overtimeHours}h)</td>
                                <td style="text-align: right; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0; color: #64748b;">(En liquidación)</td>
                            </tr>
                            ${parseCleanNumber(bonuses) > 0 ? `
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; color: #475569;">Bonos e Imponibles</td>
                                <td style="text-align: right; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(parseCleanNumber(bonuses))} CLP</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td style="font-weight: 700; background-color: #f8fafc; padding: 2.5px 5px; border: 1px solid #e2e8f0; color: #0f172a;">Haberes No Imponibles</td>
                                <td style="text-align: right; font-weight: 700; font-family: monospace; background-color: #f8fafc; padding: 2.5px 5px; border: 1px solid #e2e8f0;">$${formatNumber(parseCleanNumber(colacion) + parseCleanNumber(movilizacion) + parseCleanNumber(viaticos))} CLP</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">2. Descuentos Previsionales Obligatorios</div>
                    <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt;">
                        <thead>
                            <tr style="background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                                <th style="width: 60%; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Descuento Obligatorio</th>
                                <th style="text-align: right; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Monto Retenido</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">AFP (${labelAFP})</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #b91c1c; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-${afp}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Salud (${labelHealth})</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #b91c1c; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-${health}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Seguro de Cesantía AFC</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #b91c1c; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-${afc}</td>
                            </tr>
                            <tr>
                                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Impuesto 2ª Categoría (SII)</td>
                                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #b91c1c; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-${tax}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            ${parseCleanNumber(ccaf) > 0 || parseCleanNumber(apv) > 0 || parseCleanNumber(prestamos) > 0 || parseCleanNumber(pension) > 0 || parseCleanNumber(sindicato) > 0 || parseCleanNumber(otrosDescuentos) > 0 ? `
            <div class="print-section-title" style="font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; margin-bottom: 3px; border-bottom: 1.5px solid #0284c7; padding-bottom: 2px;">3. Otros Descuentos Aplicados</div>
            <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 7.2pt; margin-bottom: 6px;">
                <thead>
                    <tr style="background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;">
                        <th style="width: 70%; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Descuento Adicional</th>
                        <th style="text-align: right; padding: 3px 5px; border: 1px solid #e2e8f0; font-size: 6.8pt; color: #334155; text-transform: uppercase;">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    ${parseCleanNumber(ccaf) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">Caja Compensación (CCAF)</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(ccaf))} CLP</td></tr>` : ''}
                    ${parseCleanNumber(apv) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">APV (Ahorro Previsional Voluntario)</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(apv))} CLP</td></tr>` : ''}
                    ${parseCleanNumber(prestamos) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">Préstamos de la Empresa</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(prestamos))} CLP</td></tr>` : ''}
                    ${parseCleanNumber(pension) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">Pensión Alimenticia</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(pension))} CLP</td></tr>` : ''}
                    ${parseCleanNumber(sindicato) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">Cuota Sindical</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(sindicato))} CLP</td></tr>` : ''}
                    ${parseCleanNumber(otrosDescuentos) > 0 ? `<tr><td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">Otros Descuentos Diversos</td><td style="text-align: right; color: #b91c1c; font-family: monospace; padding: 2.5px 5px; border: 1px solid #e2e8f0;">-$${formatNumber(parseCleanNumber(otrosDescuentos))} CLP</td></tr>` : ''}
                </tbody>
            </table>
            ` : ''}

            <!-- Premium Hero Total Box (Sky Blue Brand Theme) -->
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; border: 2px solid #0284c7; border-radius: 7px; padding: 7px 14px; margin-top: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 6.2pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #0284c7; display: block;">✓ CÁLCULO PREVISIONAL EXACTO</span>
                    <span style="font-size: 9.5pt; font-weight: 800; color: #0f172a;">Sueldo Líquido Estimado a Percibir:</span>
                    <div style="font-size: 6.5pt; color: #64748b; margin-top: 1px;">Total retenciones previsionales y tributarias: <strong style="color: #991b1b;">${totalDiscounts}</strong></div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 18pt; font-weight: 900; color: #0369a1; font-family: monospace; letter-spacing: -0.5px;">${netSalary}</span>
                    <span style="font-size: 10pt; font-weight: 800; color: #0284c7; margin-left: 2px;">CLP</span>
                </div>
            </div>

            <!-- Footer Disclaimer -->
            <div class="print-disclaimer" style="font-size: 5.8pt; color: #94a3b8; line-height: 1.25; border-top: 1px solid #e2e8f0; padding-top: 3px; text-align: center; margin-top: 6px;">
                <strong>NOTA DE CARÁCTER INFORMATIVO:</strong> Simulación computacional referencial según normativa legal chilena. No tiene validez legal oficial ante el empleador, la DT o tribunales.<br>
                <strong>CÁLCULO LABORAL CHILE</strong> — <a href="https://calculolaboral.cl" style="color: #0284c7; text-decoration: none;">www.calculolaboral.cl</a> — Documento generado automáticamente
            </div>
        `;
    }

    // 10. FORMAT HELPERS
    function parseCleanNumber(val) {
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9-]/g, '');
        return parseInt(cleaned, 10) || 0;
    }

    function formatInputDate(dateStr) {
        if (!dateStr || dateStr === '--') return '--';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    }

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
})();
