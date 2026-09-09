/**
 * Asistente y Generador de Carta de Renuncia Voluntaria (Chile 2026)
 * Artículos 159 Nº 2 y 177 del Código del Trabajo
 */

(function () {
    'use strict';

    // Element references
    const elements = {
        workerName: document.getElementById('renuncia-nombre'),
        workerRut: document.getElementById('renuncia-rut'),
        companyName: document.getElementById('renuncia-empresa'),
        jobTitle: document.getElementById('renuncia-cargo'),
        city: document.getElementById('renuncia-ciudad'),
        notifyDate: document.getElementById('renuncia-fecha-notif'),
        lastDayDate: document.getElementById('renuncia-fecha-termino'),
        reasonSelect: document.getElementById('renuncia-motivo'),
        includeGratitude: document.getElementById('renuncia-agradecimiento'),
        includeFiniquitoTerm: document.getElementById('renuncia-plazo-legal'),
        
        // Preview targets
        previewCityDate: document.getElementById('prev-ciudad-fecha'),
        previewCompany: document.getElementById('prev-empresa'),
        previewJob: document.getElementById('prev-cargo'),
        previewLastDay: document.getElementById('prev-fecha-termino'),
        previewReason: document.getElementById('prev-motivo'),
        previewGratitude: document.getElementById('prev-agradecimiento'),
        previewFiniquitoTerm: document.getElementById('prev-plazo-legal'),
        previewSignatureName: document.getElementById('prev-firma-nombre'),
        previewSignatureRut: document.getElementById('prev-firma-rut'),
        noticeBadge: document.getElementById('notice-days-badge'),
        
        // Buttons
        copyBtn: document.getElementById('btn-copy-letter'),
        printBtn: document.getElementById('btn-print-letter'),
        resetBtn: document.getElementById('btn-reset-letter'),
        
        // Autodespido checks
        checkCotizaciones: document.getElementById('chk-cotizaciones'),
        checkKarin: document.getElementById('chk-karin'),
        checkContrato: document.getElementById('chk-contrato'),
        autodespidoAlert: document.getElementById('autodespido-smart-box')
    };

    // Helper: Format Chilean RUT (12.345.678-K)
    function formatRut(value) {
        if (!value) return '';
        let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length === 0) return '';
        if (clean.length === 1) return clean;

        const dv = clean.slice(-1);
        let cuerpo = clean.slice(0, -1);

        cuerpo = cuerpo.slice(0, 8);

        let formattedCuerpo = '';
        for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
            if (j > 0 && j % 3 === 0) {
                formattedCuerpo = '.' + formattedCuerpo;
            }
            formattedCuerpo = cuerpo[i] + formattedCuerpo;
        }

        return formattedCuerpo + '-' + dv;
    }

    // Helper: Format Chilean date string to friendly readable date
    function formatReadableDate(dateString) {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) return dateString;

        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        return `${day} de ${months[month]} de ${year}`;
    }

    // Initialize Default Dates
    function initDefaultDates() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayFormatted = `${yyyy}-${mm}-${dd}`;

        if (elements.notifyDate && !elements.notifyDate.value) {
            elements.notifyDate.value = todayFormatted;
        }

        // Default last day: 30 days ahead (legal recommended notice)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const fyyyy = futureDate.getFullYear();
        const fmm = String(futureDate.getMonth() + 1).padStart(2, '0');
        const fdd = String(futureDate.getDate()).padStart(2, '0');
        const futureFormatted = `${fyyyy}-${fmm}-${fdd}`;

        if (elements.lastDayDate && !elements.lastDayDate.value) {
            elements.lastDayDate.value = futureFormatted;
        }
    }

    // Calculate notice days difference
    function updateNoticeDays() {
        if (!elements.notifyDate || !elements.lastDayDate || !elements.noticeBadge) return;

        const start = new Date(elements.notifyDate.value);
        const end = new Date(elements.lastDayDate.value);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            elements.noticeBadge.textContent = 'Fecha por definir';
            elements.noticeBadge.className = 'text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200';
            return;
        }

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            elements.noticeBadge.textContent = 'La fecha de término no puede ser anterior al aviso';
            elements.noticeBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200';
        } else if (diffDays === 0) {
            elements.noticeBadge.textContent = 'Renuncia con efecto inmediato (0 días de aviso)';
            elements.noticeBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200';
        } else if (diffDays >= 30) {
            elements.noticeBadge.textContent = `Preaviso: ${diffDays} días corridos (Conforme al estándar sugerido de 30 días)`;
            elements.noticeBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200';
        } else {
            elements.noticeBadge.textContent = `Preaviso: ${diffDays} días corridos (Menor a los 30 días sugeridos por el Art. 159 Nº 2)`;
            elements.noticeBadge.className = 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200';
        }
    }

    // Update Live Letter Preview
    function updatePreview() {
        const city = (elements.city?.value.trim() || 'Santiago');
        const notifyDate = elements.notifyDate?.value ? formatReadableDate(elements.notifyDate.value) : 'Fecha actual';
        const company = elements.companyName?.value.trim() || '[Nombre o Razón Social del Empleador]';
        const job = elements.jobTitle?.value.trim() || '[Cargo o Función desempeñada]';
        const lastDay = elements.lastDayDate?.value ? formatReadableDate(elements.lastDayDate.value) : '[Fecha de último día]';
        const workerName = elements.workerName?.value.trim() || '[Nombre Completo del Trabajador]';
        const workerRut = elements.workerRut?.value.trim() || '[RUT: XX.XXX.XXX-X]';

        if (elements.previewCityDate) {
            elements.previewCityDate.textContent = `${city}, ${notifyDate}`;
        }
        if (elements.previewCompany) {
            elements.previewCompany.textContent = company;
        }
        if (elements.previewJob) {
            elements.previewJob.textContent = job;
        }
        if (elements.previewLastDay) {
            elements.previewLastDay.textContent = lastDay;
        }

        // Reason clause
        const reasonKey = elements.reasonSelect?.value || 'personal';
        let reasonText = 'por motivos de índole estrictamente personal.';
        if (reasonKey === 'oportunidad') {
            reasonText = 'con el fin de emprender nuevos desafíos y oportunidades de crecimiento profesional.';
        } else if (reasonKey === 'estudios') {
            reasonText = 'debido a compromisos académicos y de perfeccionamiento personal incompatibles con la jornada laboral.';
        } else if (reasonKey === 'mutuo') {
            reasonText = 'en conformidad y común acuerdo respecto a la conclusión de mi ciclo de servicios.';
        } else if (reasonKey === 'sin_motivo') {
            reasonText = 'en ejercicio de mi libre facultad de poner término a la relación laboral.';
        }
        if (elements.previewReason) {
            elements.previewReason.textContent = reasonText;
        }

        // Gratitude clause
        if (elements.previewGratitude) {
            if (elements.includeGratitude && elements.includeGratitude.checked) {
                elements.previewGratitude.style.display = 'block';
            } else {
                elements.previewGratitude.style.display = 'none';
            }
        }

        // Legal term (10 working days)
        if (elements.previewFiniquitoTerm) {
            if (elements.includeFiniquitoTerm && elements.includeFiniquitoTerm.checked) {
                elements.previewFiniquitoTerm.style.display = 'block';
            } else {
                elements.previewFiniquitoTerm.style.display = 'none';
            }
        }

        // Signature block
        if (elements.previewSignatureName) {
            elements.previewSignatureName.textContent = workerName;
        }
        if (elements.previewSignatureRut) {
            elements.previewSignatureRut.textContent = `RUT: ${workerRut}`;
        }

        updateNoticeDays();
    }

    // Build raw text for clipboard
    function getFullLetterText() {
        const city = elements.city?.value.trim() || 'Santiago';
        const notifyDate = elements.notifyDate?.value ? formatReadableDate(elements.notifyDate.value) : '';
        const company = elements.companyName?.value.trim() || '[Nombre de la Empresa]';
        const job = elements.jobTitle?.value.trim() || '[Cargo desempeñado]';
        const lastDay = elements.lastDayDate?.value ? formatReadableDate(elements.lastDayDate.value) : '[Fecha de término]';
        const workerName = elements.workerName?.value.trim() || '[Nombre del Trabajador]';
        const workerRut = elements.workerRut?.value.trim() || '[RUT]';

        const reasonKey = elements.reasonSelect?.value || 'personal';
        let reasonText = 'por motivos de índole estrictamente personal.';
        if (reasonKey === 'oportunidad') {
            reasonText = 'con el fin de emprender nuevos desafíos y oportunidades de crecimiento profesional.';
        } else if (reasonKey === 'estudios') {
            reasonText = 'debido a compromisos académicos y de perfeccionamiento personal incompatibles con la jornada laboral.';
        } else if (reasonKey === 'mutuo') {
            reasonText = 'en conformidad y común acuerdo respecto a la conclusión de mi ciclo de servicios.';
        } else if (reasonKey === 'sin_motivo') {
            reasonText = 'en ejercicio de mi libre facultad de poner término a la relación laboral.';
        }

        let text = `${city}, ${notifyDate}\n\n`;
        text += `Señores\n`;
        text += `${company}\n`;
        text += `Presente\n\n`;
        text += `De mi consideración:\n\n`;
        text += `Por medio de la presente carta, vengo en comunicar a ustedes formalmente mi RENUNCIA VOLUNTARIA al cargo de ${job} que he venido desempeñando en vuestra empresa, ${reasonText}\n\n`;
        text += `En conformidad con lo dispuesto en el artículo 159 Nº 2 del Código del Trabajo, informo que mi último día efectivo de labores y término definitivo de funciones será el ${lastDay}.\n\n`;

        if (elements.includeGratitude && elements.includeGratitude.checked) {
            text += `Agradezco sinceramente la confianza, el apoyo y las oportunidades de desarrollo profesional y humano brindadas durante el tiempo en que formé parte de la organización, así como las gratas relaciones de trabajo compartidas con mis compañeros y jefaturas.\n\n`;
        }

        if (elements.includeFiniquitoTerm && elements.includeFiniquitoTerm.checked) {
            text += `Ruego a ustedes disponer la oportuna confección y pago de mi finiquito legal dentro del plazo perentorio de 10 días hábiles que establece el artículo 177 del Código del Trabajo, incluyendo la liquidación de las remuneraciones adeudadas a la fecha y la debida compensación del feriado legal y proporcional que corresponda.\n\n`;
        }

        text += `Saluda atentamente a ustedes,\n\n\n`;
        text += `_________________________________________\n`;
        text += `${workerName}\n`;
        text += `RUT: ${workerRut}\n\n`;
        text += `(Documento para ratificación ante Notario Público o entrega formal ante la empresa conforme al Art. 177 del Código del Trabajo)`;

        return text;
    }

    // Copy to clipboard
    async function handleCopy() {
        const text = getFullLetterText();
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = elements.copyBtn.innerHTML;
            elements.copyBtn.innerHTML = '<span class="material-icons text-sm">check_circle</span> <span>¡Texto Copiado!</span>';
            elements.copyBtn.classList.remove('bg-sky-500', 'hover:bg-sky-600');
            elements.copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

            setTimeout(() => {
                elements.copyBtn.innerHTML = originalHTML;
                elements.copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                elements.copyBtn.classList.add('bg-sky-500', 'hover:bg-sky-600');
            }, 2500);
        } catch (err) {
            alert('No se pudo copiar automáticamente. Puedes seleccionar el texto de la vista previa y copiarlo manualmente.');
        }
    }

    // Print / PDF Handler
    function handlePrint() {
        const printContainer = document.getElementById('print-letter-content');
        const previewElement = document.getElementById('letter-preview-sheet');

        if (!printContainer || !previewElement) {
            window.print();
            return;
        }

        printContainer.innerHTML = previewElement.innerHTML;
        window.print();
    }

    // Autodespido Smart Detector
    function handleAutodespidoCheck() {
        const hasBreach = (elements.checkCotizaciones?.checked || elements.checkKarin?.checked || elements.checkContrato?.checked);
        if (elements.autodespidoAlert) {
            if (hasBreach) {
                elements.autodespidoAlert.classList.remove('hidden');
                elements.autodespidoAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                elements.autodespidoAlert.classList.add('hidden');
            }
        }
    }

    // Event listeners binding
    document.addEventListener('DOMContentLoaded', () => {
        initDefaultDates();

        // Format RUT on input
        if (elements.workerRut) {
            elements.workerRut.addEventListener('input', (e) => {
                const formatted = formatRut(e.target.value);
                e.target.value = formatted;
                updatePreview();
            });
        }

        // Live preview listeners
        const inputs = [
            elements.workerName, elements.companyName, elements.jobTitle,
            elements.city, elements.notifyDate, elements.lastDayDate,
            elements.reasonSelect, elements.includeGratitude, elements.includeFiniquitoTerm
        ];

        inputs.forEach(el => {
            if (!el) return;
            const evt = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') ? 'change' : 'input';
            el.addEventListener(evt, updatePreview);
        });

        // Copy and print buttons
        if (elements.copyBtn) elements.copyBtn.addEventListener('click', handleCopy);
        if (elements.printBtn) elements.printBtn.addEventListener('click', handlePrint);

        // Reset button
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', () => {
                if (elements.workerName) elements.workerName.value = '';
                if (elements.workerRut) elements.workerRut.value = '';
                if (elements.companyName) elements.companyName.value = '';
                if (elements.jobTitle) elements.jobTitle.value = '';
                if (elements.city) elements.city.value = 'Santiago';
                initDefaultDates();
                if (elements.reasonSelect) elements.reasonSelect.value = 'personal';
                if (elements.includeGratitude) elements.includeGratitude.checked = true;
                if (elements.includeFiniquitoTerm) elements.includeFiniquitoTerm.checked = true;
                updatePreview();
            });
        }

        // Autodespido checks
        if (elements.checkCotizaciones) elements.checkCotizaciones.addEventListener('change', handleAutodespidoCheck);
        if (elements.checkKarin) elements.checkKarin.addEventListener('change', handleAutodespidoCheck);
        if (elements.checkContrato) elements.checkContrato.addEventListener('change', handleAutodespidoCheck);

        // Initial render
        updatePreview();
    });

})();
