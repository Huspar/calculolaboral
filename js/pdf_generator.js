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

    // 4.5 CORREO OPCIONAL ANTES DE DESCARGAR: guarda el lead (tipo InformePDF) y manda una copia del resultado.
    // Quien no quiere dejar su correo descarga igual: el PDF nunca depende de este formulario.
    var NOMBRES = { finiquito: 'Finiquito', sueldo_liquido: 'Sueldo líquido' };

    function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
    function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
    function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

    function medir(evento, params) {
        if (typeof window.gtag === 'function') window.gtag('event', evento, params || {});
    }

    function montoActual(calculatorType) {
        var el = document.getElementById(calculatorType === 'sueldo_liquido' ? 'headerNetSalary' : 'totalAmount');
        return el ? el.textContent.trim() : '';
    }

    function injectModalStyles() {
        if (document.getElementById('cl-pdfmail-css')) return;
        var st = document.createElement('style');
        st.id = 'cl-pdfmail-css';
        st.textContent =
            '.cl-pdfmail{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)}' +
            '.cl-pdfmail__box{background:#fff;border-radius:20px;max-width:420px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:inherit;color:#0f172a;position:relative;max-height:92vh;overflow:auto}' +
            '.cl-pdfmail__x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:26px;line-height:1;color:#64748b;cursor:pointer;padding:4px 8px}' +
            '.cl-pdfmail h2{font-size:18px;font-weight:800;margin:0 24px 6px 0;color:#00382E}' +
            '.cl-pdfmail p{font-size:13px;line-height:1.5;color:#475569;margin:0 0 14px}' +
            '.cl-pdfmail label{display:block;font-size:12px;font-weight:700;color:#334155;margin:0 0 4px}' +
            '.cl-pdfmail input[type=text],.cl-pdfmail input[type=email]{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:16px;margin:0 0 10px;background:#fff;color:#0f172a}' +
            '.cl-pdfmail input:focus{outline:2px solid #00382E;outline-offset:1px}' +
            '.cl-pdfmail__chk{display:flex;gap:8px;align-items:flex-start;margin:2px 0 12px}' +
            '.cl-pdfmail__chk input{margin-top:2px;flex-shrink:0}' +
            '.cl-pdfmail__chk label{font-weight:400;margin:0;font-size:12px;color:#475569}' +
            '.cl-pdfmail__chk a{color:#00382E;text-decoration:underline}' +
            '.cl-pdfmail__go{width:100%;border:0;border-radius:999px;padding:12px 16px;font-size:14px;font-weight:700;background:#00382E;color:#ffffff!important;cursor:pointer}' +
            '.cl-pdfmail__go:disabled{opacity:.6;cursor:wait}' +
            '.cl-pdfmail__skip{display:block;width:100%;margin-top:8px;border:0;background:none;padding:8px;font-size:13px;color:#475569;text-decoration:underline;cursor:pointer}' +
            '.cl-pdfmail__err{color:#be123c;font-size:12px;margin:0 0 10px}' +
            '.cl-pdfmail__err[hidden]{display:none}' +
            '.cl-pdfmail__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}';
        document.head.appendChild(st);
    }

    function askEmailThenPrint(calculatorType) {
        if (lsGet('cl_pdf_correo') === '1' || ssGet('cl_pdf_sin_correo') === '1') {
            generatePDFReport();
            return;
        }
        injectModalStyles();
        var previo = document.getElementById('cl-pdfmail');
        if (previo) previo.remove();
        var nombreProducto = NOMBRES[calculatorType] || 'Informe';
        var modal = document.createElement('div');
        modal.id = 'cl-pdfmail';
        modal.className = 'cl-pdfmail no-print';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'cl-pdfmail-t');
        modal.innerHTML =
            '<div class="cl-pdfmail__box">' +
            '<button type="button" class="cl-pdfmail__x" aria-label="Cerrar">&times;</button>' +
            '<h2 id="cl-pdfmail-t">Tu informe en PDF está listo</h2>' +
            '<p>Si quieres, te enviamos una copia del resultado a tu correo para tenerla a mano. También puedes descargarlo sin dejar tus datos.</p>' +
            '<form novalidate>' +
            '<label for="cl-pdfmail-n">Nombre (opcional)</label>' +
            '<input type="text" id="cl-pdfmail-n" name="nombre" autocomplete="given-name" maxlength="80">' +
            '<label for="cl-pdfmail-e">Correo</label>' +
            '<input type="email" id="cl-pdfmail-e" name="correo" autocomplete="email" inputmode="email" placeholder="tucorreo@ejemplo.cl">' +
            '<div class="cl-pdfmail__hp" aria-hidden="true"><label>No completar<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
            '<div class="cl-pdfmail__chk"><input type="checkbox" id="cl-pdfmail-c" name="consentimiento"><label for="cl-pdfmail-c">Acepto la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a> y recibir esta copia por correo.</label></div>' +
            '<p class="cl-pdfmail__err" role="alert" hidden></p>' +
            '<button type="submit" class="cl-pdfmail__go" style="color:#ffffff !important;">Descargar y enviarme una copia</button>' +
            '<button type="button" class="cl-pdfmail__skip">Descargar sin correo</button>' +
            '</form></div>';
        document.body.appendChild(modal);

        var form = modal.querySelector('form');
        var err = modal.querySelector('.cl-pdfmail__err');
        var go = modal.querySelector('.cl-pdfmail__go');
        var renderedAt = Date.now();
        var enviando = false;

        function cerrar() {
            document.removeEventListener('keydown', onKey);
            modal.remove();
        }
        function onKey(e) { if (e.key === 'Escape') cerrar(); }
        function imprimir() {
            cerrar();
            generatePDFReport();
        }
        function mostrarError(msg) { err.textContent = msg; err.hidden = false; }

        document.addEventListener('keydown', onKey);
        modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });
        modal.querySelector('.cl-pdfmail__x').addEventListener('click', cerrar);
        modal.querySelector('.cl-pdfmail__skip').addEventListener('click', function () {
            ssSet('cl_pdf_sin_correo', '1');
            medir('pdf_sin_correo', { calculadora: calculatorType });
            imprimir();
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (enviando) return;
            err.hidden = true;
            var correo = form.correo.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return mostrarError('Ingresa un correo válido o elige descargar sin correo.');
            if (!form.consentimiento.checked) return mostrarError('Marca la casilla para recibir la copia en tu correo.');
            enviando = true;
            go.disabled = true;
            fetch('/api/send-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: form.nombre.value.trim() || 'Lector',
                    correo: correo,
                    tipo: 'InformePDF',
                    producto: calculatorType,
                    fuente: 'Informe PDF (' + nombreProducto + ')',
                    detalle: 'Descarga del informe PDF · ' + nombreProducto,
                    monto_calculado: montoActual(calculatorType),
                    website: form.website.value,
                    form_rendered_at: renderedAt
                })
            }).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
                });
            }).then(function () {
                lsSet('cl_pdf_correo', '1');
                medir('generate_lead', { currency: 'CLP', value: 0, lead_type: 'InformePDF_' + calculatorType });
                imprimir();
            }).catch(function (error) {
                enviando = false;
                go.disabled = false;
                medir('lead_error', { lead_type: 'InformePDF_' + calculatorType, motivo: String(error.message).slice(0, 80) });
                if (/correo/i.test(error.message)) return mostrarError(error.message);
                // Falla del servidor: el informe se entrega igual
                imprimir();
            });
        });

        setTimeout(function () { var i = document.getElementById('cl-pdfmail-e'); if (i) i.focus(); }, 60);
    }

    // 4. SETUP EVENT LISTENERS
    function setupEventListeners() {
        const downloadBtnFini = document.getElementById('download-pdf-btn');
        const downloadBtnSueldo = document.getElementById('download-pdf-btn-sueldo');

        [downloadBtnFini, downloadBtnSueldo].forEach((btn) => {
            if (btn) ['pointerenter', 'focus', 'touchstart'].forEach((ev) => btn.addEventListener(ev, preloadSponsor, { passive: true }));
        });

        const downloadHandler = (calculatorType) => {
            preloadSponsor();

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

            askEmailThenPrint(calculatorType);
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

        // El banner se incrusta como data: URL (ya descargado al pulsar Descargar) y se
        // decodifica antes de imprimir: así el diálogo de impresión, sobre todo en el
        // celular, no deja el hueco vacío. Si no cargó (bloqueador, sin red), se cambia
        // por un aviso de texto para que el PDF no muestre una imagen rota.
        const tope = (ms) => new Promise((ok) => setTimeout(() => ok(null), ms));
        const banners = Array.from(printSection.querySelectorAll('.clr-aviso-img img'));
        Promise.race([preloadSponsor(), tope(3000)]).then((dataUrl) => Promise.all(banners.map((img) => {
            if (dataUrl) img.src = dataUrl;
            const listo = img.decode ? img.decode() : new Promise((ok, ko) => {
                if (img.complete) return ok();
                img.addEventListener('load', ok);
                img.addEventListener('error', ko);
            });
            return Promise.race([listo, tope(2000)]).catch(() => {}).then(() => {
                if (!img.complete || !img.naturalWidth) img.parentNode.innerHTML = sponsorFallbackHTML();
            });
        }))).then(() => setTimeout(() => {
            window.print();
            // Clean up print section after dialog close
            setTimeout(() => {
                const sec = document.getElementById('print-section');
                if (sec) sec.remove();
            }, 1000);
        }, 100));
    }

    // 7.5 HELPER: envoltorio con la identidad de los informes (js/print_brand.js)
    function wrapReport(inner) {
        const css = (window.CLPrint && CLPrint.css) ? CLPrint.css() : '';
        return `<style>${css}</style><div class="clr">${inner}</div>`;
    }

    function headerHTML(doctype, dateString, folio) {
        if (window.CLPrint) return CLPrint.header({ doctype, date: dateString, folio });
        return `<div style="font-weight:800;font-size:13pt;border-bottom:1.5pt solid #00382E;padding-bottom:8pt;margin-bottom:10pt;">CálculoLaboral · ${doctype} · ${dateString}</div>`;
    }

    function indicatorsHTML() {
        const fmt = (v) => (typeof v === 'number' ? '$' + v.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : (v || '--'));
        const c = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : {};
        return `<div class="clr-ind"><span>UF <b class="mono">${fmt(c.UF)}</b></span><span>UTM <b class="mono">${fmt(c.UTM)}</b></span><span>Sueldo mínimo <b class="mono">${fmt(c.IMM)}</b></span></div>`;
    }

    // Banner de Itaú del informe: imagen clicable. La imagen sale del mismo dominio que la
    // página y se precarga como data: URL al acercarse al botón Descargar; el enlace es
    // absoluto para que funcione en el PDF guardado.
    const SPONSOR_IMG = '/assets/informe-cuenta-itau.jpg';

    function preloadSponsor() {
        if (!preloadSponsor.p) {
            preloadSponsor.p = fetch(SPONSOR_IMG)
                .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
                .then((blob) => new Promise((ok) => {
                    const fr = new FileReader();
                    fr.onload = () => ok(fr.result);
                    fr.onerror = () => ok(null);
                    fr.readAsDataURL(blob);
                }))
                .catch(() => null)
                .then((dataUrl) => { if (!dataUrl) preloadSponsor.p = null; return dataUrl; });
        }
        return preloadSponsor.p;
    }

    function sponsorHTML(question, text) {
        const url = 'https://calculolaboral.cl/itau-informe';
        const src = new URL(SPONSOR_IMG, window.location.href).href;
        return `<div class="clr-aviso"><div class="clr-aviso-txt"><b>Publicidad · Banco Itaú.</b> ${question} ${text}</div>` +
            `<a class="clr-aviso-img" href="${url}"><img src="${src}" alt="Banco Itaú: Plan Cuenta Corriente $0 costo de mantención"></a>` +
            `<a class="url" href="${url}">Abre tu cuenta en calculolaboral.cl/itau-informe</a></div>`;
    }

    function sponsorFallbackHTML() {
        return '<span class="clr-aviso-alt"><b>itaú</b><span>Cuenta Corriente <strong>$0 mantención</strong> · Ábrela en minutos, 100% online</span><em>Hazte cliente &rsaquo;</em></span>';
    }

    // 8. COMPILE FINIQUITO REPORT
    function compileFiniquitoReport(dateString) {
        const folio = window.CLPrint ? CLPrint.folio('FIN') : '';
        const $ = (id) => document.getElementById(id);

        const total = $('totalAmount')?.textContent || '$0';
        const antiquity = $('antiquityOutput')?.textContent || 'No especificada';
        const vacationDays = $('totalVacationDaysOutput')?.textContent || '0 días';
        const yearsService = $('yearsServiceAmount')?.textContent || '$0';
        const noticeAmount = $('noticeAmount')?.textContent || '$0';
        const pendingSalary = $('pendingSalaryAmount')?.textContent || '$0';
        const vacationProp = $('vacationPropAmount')?.textContent || '$0';
        const vacationPendingAmt = $('vacationPendingAmount')?.textContent || '$0';
        const afcRow = $('afcRow');
        const afcAmount = (afcRow && !afcRow.classList.contains('hidden')) ? ($('afcAmount')?.textContent || '$0') : '$0';

        const startDateVal = $('startDate')?.value || '--';
        const endDateVal = $('endDate')?.value || '--';
        const baseSalary = $('baseSalary')?.value || '0';
        const assignments = $('assignments')?.value || '0';
        const causeSelect = $('cause');
        const cause = causeSelect ? causeSelect.options[causeSelect.selectedIndex]?.text : 'No especificada';
        const noticeText = ($('noticeGiven') && $('noticeGiven').checked) ? 'Sí' : 'No';

        const hasVariableSalary = $('hasVariableSalary')?.checked || false;
        const variableAverage = $('variableAverageOutput')?.textContent || '$0';
        const gratVal = parseCleanNumber($('gratification')?.value || '0');
        const vacPDays = parseCleanNumber($('vacationPending')?.value || '0');

        const options = [
            { label: 'Indemnización por años de servicio', active: $('enableIAS')?.checked ?? true },
            { label: 'Aviso previo', active: $('enableNotice')?.checked ?? true },
            { label: 'Descuento AFC', active: $('simulateAFC')?.checked || false },
            { label: 'Sueldo pendiente', active: $('enablePending')?.checked ?? true },
            { label: 'Asignaciones en IAS', active: $('includeAssignmentsInIndemnity')?.checked || false },
            { label: 'Asignaciones en vacaciones', active: $('includeAssignmentsInVacation')?.checked || false }
        ];

        const row = (k, v, cls = '') => `<tr><td class="k">${k}</td><td class="v ${cls}">${v}</td></tr>`;
        const item = (title, note, amount, cls = '') => `<tr><td><b>${title}</b><span class="n">${note}</span></td><td class="v ${cls}">${amount}</td></tr>`;
        const hasAfc = afcAmount !== '$0' && afcAmount !== '0' && afcAmount !== '';

        return wrapReport(`
            ${headerHTML('Simulación de finiquito', dateString, folio)}
            <h1 class="clr-title">Liquidación estimada de finiquito</h1>
            <p class="clr-sub">Desglose de indemnizaciones y haberes a la fecha de término del contrato.</p>
            <p class="clr-cite">Código del Trabajo, arts. 67, 73, 159, 160, 161, 163, 168 y 177</p>
            ${indicatorsHTML()}

            <div class="clr-grid">
                <section>
                    <p class="clr-h">Contrato</p>
                    <table class="clr-t">
                        ${row('Inicio', formatInputDate(startDateVal))}
                        ${row('Término', formatInputDate(endDateVal))}
                        ${row('Antigüedad', antiquity)}
                        <tr><td class="k">Causal</td><td class="v" style="white-space:normal;font-family:inherit;max-width:190pt">${cause}</td></tr>
                        ${row('Aviso previo dado', noticeText)}
                    </table>
                </section>
                <section>
                    <p class="clr-h">Bases de cálculo</p>
                    <table class="clr-t">
                        ${row('Sueldo base', '$' + formatNumber(parseCleanNumber(baseSalary)))}
                        ${row('Haberes no imponibles', '$' + formatNumber(parseCleanNumber(assignments)))}
                        ${gratVal > 0 ? row('Gratificación (art. 50)', '$' + formatNumber(gratVal)) : ''}
                        ${hasVariableSalary ? row('Promedio sueldo variable', variableAverage) : ''}
                        ${vacPDays > 0 ? row('Vacaciones pendientes', vacPDays + ' días') : ''}
                    </table>
                </section>
            </div>

            <section class="clr-sec">
                <p class="clr-h">Detalle de indemnizaciones y haberes</p>
                <table class="clr-t">
                    ${item('Indemnización por años de servicio', 'Art. 163: un mes por año o fracción superior a seis meses, tope de 11 años y 90 UF.', yearsService)}
                    ${item('Indemnización sustitutiva del aviso previo', 'Art. 161 inc. 2: un mes de remuneración si no hubo aviso con 30 días.', noticeAmount)}
                    ${item('Feriado proporcional (' + vacationDays + ')', 'Art. 73: 1,25 días hábiles por mes trabajado, proyectados en días corridos.', vacationProp)}
                    ${item('Feriado legal pendiente', 'Art. 67: vacaciones de períodos anteriores no tomadas.', vacationPendingAmt)}
                    ${item('Remuneraciones pendientes', 'Días trabajados en el mes del término.', pendingSalary)}
                    ${hasAfc ? item('Descuento aporte AFC del empleador', 'Art. 13 Ley 19.728. Impugnable si el despido se declara injustificado.', '−' + afcAmount.replace(/^[\s\-−]+/, ''), 'neg') : ''}
                </table>
            </section>

            <div class="clr-total">
                <div class="lbl">Total estimado del finiquito<small>Monto líquido referencial a la fecha de término</small></div>
                <div class="amt">${total}</div>
            </div>
            <div class="clr-flags">${options.map(o => `<span class="${o.active ? '' : 'off'}">${o.active ? '✓' : '·'} ${o.label}</span>`).join('')}</div>

            <div class="clr-note">
                <b class="t">Reserva de derechos al firmar · plazo de pago: 10 días hábiles (art. 177)</b>
                Ante el ministro de fe, escribe de tu puño y letra una reserva, por ejemplo: <i>“Me reservo el derecho a reclamar despido injustificado, el recargo legal y la devolución del descuento AFC”</i>. Firmar con reserva no impide recibir el pago de los montos reconocidos.
            </div>

            <div class="clr-steps">
                <div><b>1. Compara cada concepto.</b> Los montos que ofrezca tu empleador no deberían ser menores a los de este informe.</div>
                <div><b>2. Pide aclaraciones.</b> Si difieren el sueldo base, los años o los feriados, solicita la planilla antes de firmar.</div>
                <div><b>3. Firma el finiquito de la empresa.</b> Este informe es tu respaldo; el documento válido lo extiende el empleador ante ministro de fe.</div>
            </div>

            ${sponsorHTML('¿Dónde recibir el pago de tu finiquito?', 'Cuenta Corriente Itaú con $0 costo de mantención, apertura 100% online.')}

            <footer class="clr-foot">Simulación referencial conforme a la normativa de la Dirección del Trabajo. No constituye asesoría legal ni reemplaza el finiquito firmado por las partes. <span class="brand">calculolaboral.cl</span></footer>
        `);
    }

    // 9. COMPILE SUELDO REPORT
    function compileSueldoReport(dateString) {
        const $ = (id) => document.getElementById(id);
        const txt = (id, d = '—') => ($(id)?.textContent || d).trim();
        const visible = (id) => { const el = $(id); return el && !el.classList.contains('hidden'); };

        const netSalary = txt('headerNetSalary', '$0');
        const totalDiscounts = txt('headerTotalDiscounts', '$0');
        const healthLabel = txt('print-row-salary-health').includes('Isapre') ? 'Isapre' : 'Fonasa';
        const amountOnly = (s) => s.replace(/\s*\((Fonasa|Isapre)\)\s*$/, '');

        const row = (k, v, cls = '') => `<tr><td class="k">${k}</td><td class="v ${cls}">${v}</td></tr>`;
        const optional = [
            ['print-row-salary-ccaf-container', 'print-row-salary-ccaf', 'Crédito Caja de Compensación (CCAF)'],
            ['print-row-salary-apv-container', 'print-row-salary-apv', 'Ahorro previsional voluntario (APV)'],
            ['print-row-salary-loans-container', 'print-row-salary-loans', 'Préstamos y anticipos'],
            ['print-row-salary-pension-container', 'print-row-salary-pension', 'Pensión de alimentos'],
            ['print-row-salary-sindicato-container', 'print-row-salary-sindicato', 'Cuota sindical'],
            ['print-row-salary-other-container', 'print-row-salary-other', 'Otros descuentos']
        ].filter(r => visible(r[0])).map(r => row(r[2], txt(r[1]), 'neg')).join('');

        return wrapReport(`
            ${headerHTML('Simulación de sueldo líquido', dateString, window.CLPrint ? CLPrint.folio('SUE') : '')}
            <h1 class="clr-title">Liquidación estimada de sueldo</h1>
            <p class="clr-sub">Haberes, descuentos legales y sueldo líquido mensual a pagar.</p>
            <p class="clr-cite">Código del Trabajo, arts. 41, 42 y 50 · Ley de la Renta, art. 43</p>
            ${indicatorsHTML()}

            <div class="clr-grid">
                <section>
                    <p class="clr-h">Haberes</p>
                    <table class="clr-t">
                        ${row('Sueldo base', txt('print-input-salary-base'))}
                        ${row('Horas extraordinarias', txt('print-input-salary-ot'))}
                        ${row('Gratificación legal', txt('print-input-salary-grat'))}
                        ${row('Bonos imponibles', txt('print-input-salary-bonuses'))}
                        ${row('Asignación de colación', txt('print-input-salary-colacion'))}
                        ${row('Asignación de movilización', txt('print-input-salary-movilizacion'))}
                        ${row('Viáticos y otros no imponibles', txt('print-input-salary-viaticos'))}
                    </table>
                </section>
                <section>
                    <p class="clr-h">Descuentos</p>
                    <table class="clr-t">
                        ${row('AFP ' + txt('print-input-salary-afp-name', ''), txt('print-row-salary-afp'), 'neg')}
                        ${row('Salud (' + healthLabel + ')', amountOnly(txt('print-row-salary-health')), 'neg')}
                        ${row('Seguro de cesantía (AFC)', txt('print-row-salary-afc'), 'neg')}
                        ${row('Impuesto único de segunda categoría', txt('print-row-salary-tax'), 'neg')}
                        ${optional}
                        <tr class="sum"><td>Total descuentos</td><td class="v neg">${totalDiscounts}</td></tr>
                    </table>
                </section>
            </div>

            <div class="clr-total">
                <div class="lbl">Sueldo líquido a pagar<small>Monto mensual estimado que recibe el trabajador</small></div>
                <div class="amt">${netSalary}</div>
            </div>

            ${sponsorHTML('¿Dónde recibir tu sueldo?', 'Cuenta Corriente Itaú con $0 costo de mantención, apertura 100% online.')}

            <footer class="clr-foot">Simulación referencial según la normativa vigente en Chile. No constituye comprobante de pago ni tiene validez ante la Dirección del Trabajo o el SII. <span class="brand">calculolaboral.cl</span></footer>
        `);
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
