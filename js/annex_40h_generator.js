/**
 * Generador de Anexo Ley 40 Horas (42 Horas 2026)
 * Cálculo Laboral Chile - https://calculolaboral.cl
 * Conforme a Ley Nº 21.561 y Artículos 10, 11 y 38 del Código del Trabajo
 */

(function () {
    'use strict';

    // Elements cache
    let elements = {};

    function initElements() {
        elements = {
            companyName: document.getElementById('company-name'),
            companyRut: document.getElementById('company-rut'),
            companyAddress: document.getElementById('company-address'),
            repName: document.getElementById('rep-name'),
            workerName: document.getElementById('worker-name'),
            workerRut: document.getElementById('worker-rut'),
            workerPosition: document.getElementById('worker-position'),
            contractDate: document.getElementById('contract-date'),
            prevHours: document.getElementById('prev-hours'),
            modality: document.getElementById('reduction-modality'),
            customScheduleGroup: document.getElementById('custom-schedule-group'),
            customSchedule: document.getElementById('custom-schedule'),
            effectiveDate: document.getElementById('effective-date'),
            city: document.getElementById('city'),
            previewContainer: document.getElementById('annex-preview-text'),
            copyBtn: document.getElementById('copy-annex-btn'),
            printBtn: document.getElementById('print-annex-btn'),
            printContainer: document.getElementById('print-annex-content'),
            leadForm: document.getElementById('form-lead-checklist'),
            leadSuccess: document.getElementById('lead-checklist-success')
        };
    }

    // Chilean RUT formatter (e.g. 12.345.678-K)
    function formatRut(rutRaw) {
        if (!rutRaw) return '';
        let clean = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length === 0) return '';
        if (clean.length === 1) return clean;
        const dv = clean.slice(-1);
        let cuerpo = clean.slice(0, -1);
        cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${cuerpo}-${dv}`;
    }

    // Format date YYYY-MM-DD to readable Spanish date
    function formatDateSpanish(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${day} de ${months[monthIndex] || 'mes'} de ${year}`;
    }

    // Get reduction schedule description
    function getScheduleData() {
        const mod = elements.modality ? elements.modality.value : '5x2-viernes';
        if (mod === '5x2-viernes') {
            return {
                title: 'Jornada Ordinaria de 42 Horas Semanales (Lunes a Viernes)',
                text: 'La nueva jornada ordinaria de trabajo será de 42 (cuarenta y dos) horas semanales, distribuidas de lunes a viernes en el siguiente horario:\n\n' +
                      '• De Lunes a Jueves: de 09:00 horas a 18:00 horas, con 60 minutos destinados a colación (imputables/no imputables según contrato matriz).\n' +
                      '• Viernes: de 09:00 horas a 16:00 horas, con 60 minutos de colación.\n\n' +
                      'La reducción horaria se concentra los días viernes (salida anticipada en 2 horas), dando cabal cumplimiento al tope legal de 42 horas semanales fijado para el hito 2026 por la Ley Nº 21.561.'
            };
        } else if (mod === '5x2-diaria') {
            return {
                title: 'Jornada Ordinaria de 42 Horas Semanales (Distribución Homogénea)',
                text: 'La nueva jornada ordinaria de trabajo será de 42 (cuarenta y dos) horas semanales, distribuida de lunes a viernes a razón de 8 horas y 24 minutos diarios, en el siguiente horario:\n\n' +
                      '• De Lunes a Viernes: de 08:30 horas a 17:54 horas, con una pausa de 60 minutos de colación intermedia.\n\n' +
                      'Dicha distribución respeta estrictamente el límite máximo diario y las disposiciones de la Ley Nº 21.561.'
            };
        } else if (mod === '6x1-comercio') {
            return {
                title: 'Jornada Ordinaria de 42 Horas Semanales (Comercio / Gastronomía - 6x1)',
                text: 'La nueva jornada ordinaria de trabajo será de 42 (cuarenta y dos) horas semanales, distribuidas en 6 (seis) días a la semana, de conformidad con las excepciones del artículo 38 del Código del Trabajo:\n\n' +
                      '• De Lunes a Sábado: turnos de 7 (siete) horas diarias efectivas, con un descanso de 30 a 60 minutos para colación según pauta de turnos publicada oportunamente.\n\n' +
                      'Se deja expresa constancia de que se mantienen plenamente vigentes las normas sobre descanso semanal compensatorio y el otorgamiento obligatorio de al menos dos domingos de descanso al mes conforme al Art. 38 del Código del Trabajo.'
            };
        } else {
            const custom = elements.customSchedule && elements.customSchedule.value.trim() ? elements.customSchedule.value.trim() : 'Horario a convenir según turnos de 42 horas semanales.';
            return {
                title: 'Jornada Ordinaria de 42 Horas Semanales (Pactada entre las Partes)',
                text: `La nueva jornada ordinaria de trabajo será de 42 (cuarenta y dos) horas semanales, distribuida de la siguiente forma:\n\n${custom}`
            };
        }
    }

    // Helper to safely escape HTML in user inputs
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Extract all values for the annex document
    function getAnnexValues() {
        const city = elements.city?.value.trim() || 'Santiago';
        const effDate = formatDateSpanish(elements.effectiveDate?.value) || '26 de abril de 2026';
        const compName = elements.companyName?.value.trim() || '[NOMBRE O RAZÓN SOCIAL DEL EMPLEADOR]';
        const compRut = elements.companyRut?.value.trim() || '[RUT EMPLEADOR]';
        const compAddr = elements.companyAddress?.value.trim() || '[DOMICILIO DE LA EMPRESA]';
        const repName = elements.repName?.value.trim() || '[NOMBRE REPRESENTANTE LEGAL]';
        const workName = elements.workerName?.value.trim() || '[NOMBRE DEL TRABAJADOR]';
        const workRut = elements.workerRut?.value.trim() || '[RUT TRABAJADOR]';
        const workPos = elements.workerPosition?.value.trim() || '[CARGO U OFICIO]';
        const origDate = formatDateSpanish(elements.contractDate?.value) || '[FECHA CONTRATO ORIGINAL]';
        const prevH = elements.prevHours?.value || '44';
        const sched = getScheduleData();

        return {
            city, effDate, compName, compRut, compAddr, repName,
            workName, workRut, workPos, origDate, prevH, sched
        };
    }

    // Format schedule text into elegant HTML
    function formatScheduleHTML(text) {
        if (!text) return '';
        const paragraphs = text.split('\n\n');
        return paragraphs.map(para => {
            if (para.includes('\n• ') || para.startsWith('• ')) {
                const lines = para.split('\n');
                return lines.map(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('•')) {
                        const content = trimmed.substring(1).trim();
                        const colonIdx = content.indexOf(':');
                        if (colonIdx !== -1) {
                            const label = escapeHTML(content.substring(0, colonIdx + 1));
                            const rest = escapeHTML(content.substring(colonIdx + 1));
                            return `<div style="padding-left: 18px; margin: 4px 0; text-indent: -12px;">• <strong>${label}</strong>${rest}</div>`;
                        }
                        return `<div style="padding-left: 18px; margin: 4px 0; text-indent: -12px;">• ${escapeHTML(content)}</div>`;
                    }
                    return `<p style="margin: 6px 0;">${escapeHTML(trimmed)}</p>`;
                }).join('');
            } else {
                return `<p style="margin: 6px 0;">${escapeHTML(para)}</p>`;
            }
        }).join('');
    }

    // Single source of truth for the Annex document HTML (used for both Preview and Print/PDF)
    function buildDocumentHTML(options) {
        const isPrint = options && options.isPrint;
        const d = getAnnexValues();
        const escCompName = escapeHTML(d.compName);
        const escCompRut = escapeHTML(d.compRut);
        const escCompAddr = escapeHTML(d.compAddr);
        const escRepName = escapeHTML(d.repName);
        const escWorkName = escapeHTML(d.workName);
        const escWorkRut = escapeHTML(d.workRut);
        const escWorkPos = escapeHTML(d.workPos);
        const escCity = escapeHTML(d.city);
        const escEffDate = escapeHTML(d.effDate);
        const escOrigDate = escapeHTML(d.origDate);
        const escPrevH = escapeHTML(d.prevH);

        const innerHTML = `
            <div style="text-align: center; margin-bottom: 22px;">
                <div style="font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: #64748b; font-family: system-ui, -apple-system, sans-serif; margin-bottom: 4px;">
                    Instrumento Jurídico Laboral · Artículos 10 y 11 del Código del Trabajo
                </div>
                <h1 style="font-size: 13pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: -0.01em; line-height: 1.35;">
                    ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO
                </h1>
                <h2 style="font-size: 10.5pt; font-weight: 600; font-style: italic; color: #334155; margin: 4px 0 0; line-height: 1.35;">
                    Adecuación de Jornada Ordinaria de Trabajo a 42 Horas Semanales (Ley Nº 21.561)
                </h2>
            </div>

            <p style="text-align: justify; margin-bottom: 12px;">
                En la ciudad de <strong>${escCity}</strong>, a <strong>${escEffDate}</strong>, comparecen por una parte <strong>${escCompName}</strong>, Rol Único Tributario Nº <strong>${escCompRut}</strong>, con domicilio para estos efectos en ${escCompAddr}, debidamente representada por su representante legal don(ña) <strong>${escRepName}</strong>, en adelante denominado indistintamente como "el Empleador"; y por la otra, don(ña) <strong>${escWorkName}</strong>, Cédula Nacional de Identidad Nº <strong>${escWorkRut}</strong>, domiciliado(a) en los registros de la empresa, quien se desempeña en calidad de <strong>${escWorkPos}</strong>, en adelante denominado como "el Trabajador", quienes han convenido suscribir el presente Anexo al Contrato de Trabajo celebrado originalmente con fecha <strong>${escOrigDate}</strong>:
            </p>

            <p style="text-align: justify; margin-bottom: 12px;">
                <strong>PRIMERO: ANTECEDENTES Y MARCO LEGAL.</strong> Con fecha 26 de abril de 2023 se promulgó y publicó en el Diario Oficial la Ley Nº 21.561, que modifica el Código del Trabajo en materia de jornada ordinaria, fijando una reducción progresiva que alcanza el hito legal de 42 horas semanales a partir del año 2026.
            </p>

            <p style="text-align: justify; margin-bottom: 12px;">
                <strong>SEGUNDO: MODIFICACIÓN DE LA JORNADA ORDINARIA.</strong> En conformidad con el artículo primero y las normas transitorias de la Ley Nº 21.561, las partes acuerdan modificar la cláusula sobre jornada de trabajo del contrato individual original, reemplazando la jornada previa de ${escPrevH} horas semanales por una nueva jornada ordinaria de <strong>42 (cuarenta y dos) horas semanales</strong>.
            </p>

            <div style="text-align: justify; margin-bottom: 12px;">
                <strong>TERCERO: DISTRIBUCIÓN HORARIA Y DESCANSOS.</strong>
                ${formatScheduleHTML(d.sched.text)}
            </div>

            <p style="text-align: justify; margin-bottom: 12px;">
                <strong>CUARTO: IRRENUNCIABILIDAD Y MANTENCIÓN DE REMUNERACIONES.</strong> En cumplimiento del mandato imperativo del artículo tercero transitorio de la citada ley, se estipula de forma expresa que la reducción de jornada no significará en caso alguno rebaja de las remuneraciones convenidas en el contrato de trabajo ni menoscabo patrimonial para el Trabajador, manteniéndose íntegramente los haberes fijos, variables y asignaciones legales o convencionales vigentes.
            </p>

            <p style="text-align: justify; margin-bottom: 12px;">
                <strong>QUINTO: SUBSISTENCIA DE LAS DEMÁS ESTIPULACIONES.</strong> Las restantes cláusulas del contrato individual de trabajo y anexos precedentes se mantienen plenamente válidas y vigentes en todo lo que no resulte modificado por este instrumento.
            </p>

            <p style="text-align: justify; margin-bottom: 24px;">
                <strong>SEXTO: EJEMPLARES Y REGISTRO.</strong> En cumplimiento del artículo 11 del Código del Trabajo, el presente anexo se otorga y firma en dos ejemplares de idéntico tenor y fecha, quedando uno en poder de cada una de las partes interesadas para su debida custodia y registro laboral.
            </p>

            <!-- Bloque de Firmas -->
            <div style="margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; text-align: center; font-family: system-ui, -apple-system, sans-serif; font-size: 8.5pt; page-break-inside: avoid; break-inside: avoid;">
                <div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 40px;">
                        <div style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${escCompName}</div>
                        <div style="color: #475569; font-size: 8pt; margin-top: 2px;">p.p. ${escRepName}</div>
                        <div style="font-family: monospace; font-size: 8pt; color: #334155; margin-top: 1px;">RUT: ${escCompRut}</div>
                        <div style="font-size: 7.5pt; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.05em;">Empleador / Representante Legal</div>
                    </div>
                </div>
                <div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 40px;">
                        <div style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${escWorkName}</div>
                        <div style="font-family: monospace; font-size: 8pt; color: #334155; margin-top: 14px;">CNI: ${escWorkRut}</div>
                        <div style="font-size: 7.5pt; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.05em;">Trabajador</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 28px; text-align: center; font-family: system-ui, -apple-system, sans-serif; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                Documento elaborado conforme a la Ley Nº 21.561 y el Código del Trabajo · calculolaboral.cl
            </div>
        `;

        if (isPrint) {
            return `
                <div class="annex-print-doc" style="font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.55; color: #0f172a; max-width: 100%; margin: 0 auto; box-sizing: border-box; text-align: justify;">
                    ${innerHTML}
                </div>
            `;
        } else {
            return `
                <div class="annex-preview-doc bg-white border border-slate-200/90 rounded-xl p-5 sm:p-7 shadow-xs" style="font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.55; color: #0f172a; text-align: justify;">
                    ${innerHTML}
                </div>
            `;
        }
    }

    // Build the full legal annex text for clipboard copy
    function getAnnexFullText() {
        const d = getAnnexValues();
        let t = `ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO\n`;
        t += `ADECUACIÓN DE JORNADA ORDINARIA A 42 HORAS SEMANALES (LEY Nº 21.561)\n\n`;
        t += `En la ciudad de ${d.city}, a ${d.effDate}, comparecen por una parte ${d.compName}, Rol Único Tributario Nº ${d.compRut}, con domicilio para estos efectos en ${d.compAddr}, debidamente representada por su representante legal don(ña) ${d.repName}, en adelante denominado indistintamente como "el Empleador"; y por la otra, don(ña) ${d.workName}, Cédula Nacional de Identidad Nº ${d.workRut}, domiciliado(a) en los registros de la empresa, quien se desempeña en calidad de ${d.workPos}, en adelante denominado como "el Trabajador", quienes han convenido suscribir el presente Anexo al Contrato de Trabajo celebrado originalmente con fecha ${d.origDate}:\n\n`;
        t += `PRIMERO: ANTECEDENTES Y MARCO LEGAL.\n`;
        t += `Con fecha 26 de abril de 2023 se promulgó y publicó en el Diario Oficial la Ley Nº 21.561, que modifica el Código del Trabajo en materia de jornada ordinaria, fijando una reducción progresiva que alcanza el hito legal de 42 horas semanales a partir del año 2026.\n\n`;
        t += `SEGUNDO: MODIFICACIÓN DE LA JORNADA ORDINARIA.\n`;
        t += `En conformidad con el artículo primero y las normas transitorias de la Ley Nº 21.561, las partes acuerdan modificar la cláusula sobre jornada de trabajo del contrato individual original, reemplazando la jornada previa de ${d.prevH} horas semanales por una nueva jornada ordinaria de 42 (cuarenta y dos) horas semanales.\n\n`;
        t += `TERCERO: DISTRIBUCIÓN HORARIA Y DESCANSOS.\n`;
        t += `${d.sched.text}\n\n`;
        t += `CUARTO: IRRENUNCIABILIDAD Y MANTENCIÓN DE REMUNERACIONES.\n`;
        t += `En cumplimiento del mandato imperativo del artículo tercero transitorio de la citada ley, se estipula de forma expresa que la reducción de jornada no significará en caso alguno rebaja de las remuneraciones convenidas en el contrato de trabajo ni menoscabo patrimonial para el Trabajador, manteniéndose íntegramente los haberes fijos, variables y asignaciones legales o convencionales vigentes.\n\n`;
        t += `QUINTO: SUBSISTENCIA DE LAS DEMÁS ESTIPULACIONES.\n`;
        t += `Las restantes cláusulas del contrato individual de trabajo y anexos precedentes se mantienen plenamente válidas y vigentes en todo lo que no resulte modificado por este instrumento.\n\n`;
        t += `SEXTO: EJEMPLARES Y REGISTRO.\n`;
        t += `En cumplimiento del artículo 11 del Código del Trabajo, el presente anexo se otorga y firma en dos ejemplares de idéntico tenor y fecha, quedando uno en poder de cada una de las partes interesadas para su debida custodia y registro laboral.\n\n\n`;
        t += `________________________________________               ________________________________________\n`;
        t += `FIRMA DEL EMPLEADOR / REP. LEGAL                       FIRMA DEL TRABAJADOR\n`;
        t += `${d.compName}\n`;
        t += `p.p. ${d.repName}                                      ${d.workName}\n`;
        t += `RUT: ${d.compRut}                                      CNI: ${d.workRut}\n`;

        return t;
    }

    // Update screen preview
    function updatePreview() {
        if (!elements.previewContainer) return;
        elements.previewContainer.innerHTML = buildDocumentHTML({ isPrint: false });
    }

    // Build print HTML document for window.print() (Clean A4 portrait, perfect serif legal styling)
    function buildPrintHTML() {
        return buildDocumentHTML({ isPrint: true });
    }

    // Copy to clipboard
    async function handleCopy() {
        const text = getAnnexFullText();
        try {
            await navigator.clipboard.writeText(text);
            if (elements.copyBtn) {
                const originalHTML = elements.copyBtn.innerHTML;
                elements.copyBtn.innerHTML = '<span class="material-icons text-base text-emerald-600">check_circle</span> <span class="text-emerald-700 font-medium">¡Texto copiado!</span>';
                elements.copyBtn.classList.add('border-emerald-300', 'bg-emerald-50/50');

                if (typeof gtag === 'function') {
                    gtag('event', 'copy_anexo_40h', {
                        event_category: 'tool',
                        event_label: elements.modality?.value || 'standard'
                    });
                }

                setTimeout(() => {
                    elements.copyBtn.innerHTML = originalHTML;
                    elements.copyBtn.classList.remove('border-emerald-300', 'bg-emerald-50/50');
                }, 2500);
            }
        } catch (err) {
            alert('No se pudo copiar automáticamente. Puedes seleccionar el texto de la vista previa y copiarlo.');
        }
    }

    // Print / PDF Handler
    function handlePrint() {
        if (!elements.printContainer) {
            window.print();
            return;
        }
        elements.printContainer.innerHTML = buildPrintHTML();
        if (typeof gtag === 'function') {
            gtag('event', 'print_anexo_40h', {
                event_category: 'tool',
                event_label: elements.modality?.value || 'standard'
            });
        }
        window.print();
    }

    // Lead capture form handler (Checklist & editable templates)
    function handleLeadSubmit(e) {
        e.preventDefault();
        const emailInput = document.getElementById('lead-checklist-email');
        const nameInput = document.getElementById('lead-checklist-nombre');
        const btn = document.getElementById('lead-checklist-btn');

        if (!emailInput || !emailInput.value.trim()) return;

        const email = emailInput.value.trim();
        const name = nameInput ? nameInput.value.trim() : 'Empleador Pyme';

        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Enviando...';
        }

        fetch('/api/send-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: name,
                correo: email,
                telefono: '',
                tipo: 'LeadMagnet',
                fuente: 'Generador Anexo 40 Horas - Checklist Pyme',
                detalle: `Empresa: ${elements.companyName?.value || 'No informada'}, Modalidad: ${elements.modality?.value || '5x2'}`,
                monto_calculado: '0'
            })
        }).then(res => {
            if (res.ok) {
                if (elements.leadForm) elements.leadForm.classList.add('hidden');
                if (elements.leadSuccess) elements.leadSuccess.classList.remove('hidden');
                if (typeof gtag === 'function') {
                    gtag('event', 'lead_anexo_checklist', {
                        event_category: 'lead',
                        event_label: 'anexo_40h'
                    });
                }
            } else {
                throw new Error('Error al procesar el envío');
            }
        }).catch(err => {
            console.error('Error enviando lead:', err);
            alert('Hubo un inconveniente al enviar tu solicitud. Inténtalo nuevamente.');
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Recibir Checklist en mi Correo';
            }
        });
    }

    // Set default dates
    function initDates() {
        if (elements.contractDate && !elements.contractDate.value) {
            elements.contractDate.value = '2024-01-01';
        }
        if (elements.effectiveDate && !elements.effectiveDate.value) {
            // Milestone 2026: 26 April 2026
            elements.effectiveDate.value = '2026-04-26';
        }
    }

    // Initialize module
    document.addEventListener('DOMContentLoaded', () => {
        initElements();
        initDates();

        // RUT formatters
        if (elements.companyRut) {
            elements.companyRut.addEventListener('input', (e) => {
                e.target.value = formatRut(e.target.value);
                updatePreview();
            });
        }
        if (elements.workerRut) {
            elements.workerRut.addEventListener('input', (e) => {
                e.target.value = formatRut(e.target.value);
                updatePreview();
            });
        }

        // Modality toggle for custom field
        if (elements.modality) {
            elements.modality.addEventListener('change', () => {
                if (elements.modality.value === 'personalizada') {
                    elements.customScheduleGroup?.classList.remove('hidden');
                } else {
                    elements.customScheduleGroup?.classList.add('hidden');
                }
                updatePreview();
            });
        }

        // Auto-update preview on inputs
        const liveInputs = [
            elements.companyName, elements.companyAddress, elements.repName,
            elements.workerName, elements.workerPosition, elements.contractDate,
            elements.prevHours, elements.customSchedule, elements.effectiveDate, elements.city
        ];

        liveInputs.forEach(el => {
            if (!el) return;
            const evt = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
            el.addEventListener(evt, updatePreview);
        });

        // Action buttons
        if (elements.copyBtn) elements.copyBtn.addEventListener('click', handleCopy);
        if (elements.printBtn) elements.printBtn.addEventListener('click', handlePrint);

        // Lead form
        if (elements.leadForm) elements.leadForm.addEventListener('submit', handleLeadSubmit);

        // Initial preview render
        updatePreview();
    });

})();
