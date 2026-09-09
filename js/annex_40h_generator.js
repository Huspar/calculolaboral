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

    // Build the full legal annex text for clipboard copy
    function getAnnexFullText() {
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

        let t = `ANEXO DE CONTRATO DE TRABAJO\n`;
        t += `ADECUACIÓN DE JORNADA LABORAL - LEY Nº 21.561 (40 HORAS)\n\n`;
        t += `En ${city}, a ${effDate}, entre:\n\n`;
        t += `1. Por una parte, ${compName}, Rol Único Tributario Nº ${compRut}, domiciliada para estos efectos en ${compAddr}, representada legalmente por don(ña) ${repName}, en adelante denominado indistintamente como "el Empleador"; y\n\n`;
        t += `2. Por otra parte, don(ña) ${workName}, Cédula Nacional de Identidad Nº ${workRut}, desempeñándose en el cargo de ${workPos}, en adelante denominado como "el Trabajador",\n\n`;
        t += `se ha convenido en celebrar el siguiente Anexo al Contrato Individual de Trabajo suscrito entre las partes con fecha ${origDate}:\n\n`;
        t += `PRIMERO: ANTECEDENTES Y MARCO LEGAL\n`;
        t += `Con fecha 26 de abril de 2023 se promulgó y publicó en el Diario Oficial la Ley Nº 21.561, que modifica el Código del Trabajo con el objeto de reducir la jornada ordinaria laboral semanal de 45 a 40 horas, fijando una implementación gradual que contempla la reducción obligatoria a 42 horas semanales cumplidos tres años desde su entrada en vigencia (año 2026).\n\n`;
        t += `SEGUNDO: REDUCCIÓN DE LA JORNADA ORDINARIA\n`;
        t += `En virtud de lo dispuesto en el artículo primero y normas transitorias de la Ley Nº 21.561, las partes vienen en modificar la cláusula sobre jornada de trabajo del contrato individual original, reemplazando la jornada previa de ${prevH} horas semanales por una nueva jornada ordinaria de 42 (cuarenta y dos) horas semanales.\n\n`;
        t += `TERCERO: DISTRIBUCIÓN HORARIA Y DESCANSOS\n`;
        t += `${sched.text}\n\n`;
        t += `CUARTO: MANTENCIÓN DE REMUNERACIONES (IRRENUNCIABILIDAD)\n`;
        t += `En conformidad expresa con el artículo tercero transitorio de la Ley Nº 21.561, la presente adecuación y reducción horaria no implicará, bajo ningún respecto ni circunstancia, una disminución de las remuneraciones convenidas en el contrato de trabajo ni menoscabo patrimonial para el Trabajador, manteniéndose inalterables el sueldo base pactado y demás asignaciones legales o convencionales vigentes.\n\n`;
        t += `QUINTO: VIGENCIA DE LAS DEMÁS ESTIPULACIONES\n`;
        t += `En todo lo no modificado expresa o tácitamente por el presente instrumento, continúan plenamente vigentes y válidas todas y cada una de las demás cláusulas y estipulaciones del Contrato Individual de Trabajo y sus anexos anteriores.\n\n`;
        t += `SEXTO: EJEMPLARES Y PROTOCOLIZACIÓN\n`;
        t += `Para constancia y en cumplimiento de lo establecido en el artículo 11 del Código del Trabajo, el presente anexo se firma en dos ejemplares de idéntico tenor y fecha, quedando uno en poder del Trabajador y otro en la carpeta de personal en custodia del Empleador.\n\n\n`;
        t += `________________________________________               ________________________________________\n`;
        t += `FIRMA DEL EMPLEADOR / REP. LEGAL                       FIRMA DEL TRABAJADOR\n`;
        t += `${compName}                                             ${workName}\n`;
        t += `RUT: ${compRut}                                        CNI: ${workRut}\n`;

        return t;
    }

    // Update screen preview
    function updatePreview() {
        if (!elements.previewContainer) return;

        const compName = elements.companyName?.value.trim() || 'Razón Social / Nombre Empleador';
        const compRut = elements.companyRut?.value.trim() || 'XX.XXX.XXX-X';
        const workName = elements.workerName?.value.trim() || 'Nombre del Trabajador';
        const workRut = elements.workerRut?.value.trim() || 'XX.XXX.XXX-X';
        const workPos = elements.workerPosition?.value.trim() || 'Cargo / Función';
        const city = elements.city?.value.trim() || 'Santiago';
        const effDate = formatDateSpanish(elements.effectiveDate?.value) || '26 de abril de 2026';
        const prevH = elements.prevHours?.value || '44';
        const sched = getScheduleData();

        const html = `
            <div class="space-y-4 text-slate-800 font-sans text-xs md:text-sm leading-relaxed">
                <div class="text-center pb-3 border-b border-slate-200">
                    <p class="font-bold text-xs uppercase tracking-wider text-slate-500">Documento Oficial Art. 11 Código del Trabajo</p>
                    <h3 class="font-black text-slate-900 text-sm md:text-base mt-1">ANEXO DE CONTRATO DE TRABAJO - ADECUACIÓN LEY Nº 21.561</h3>
                    <p class="text-xs text-sky-700 font-semibold mt-0.5">Implementación Hito 42 Horas Semanales</p>
                </div>

                <p>En <strong class="text-slate-900">${city}</strong>, a <strong class="text-slate-900">${effDate}</strong>, entre <strong>${compName}</strong>, RUT Nº <strong>${compRut}</strong>, y don(ña) <strong>${workName}</strong>, RUT Nº <strong>${workRut}</strong>, en su calidad de <strong>${workPos}</strong>, se acuerda el siguiente anexo:</p>

                <div class="bg-amber-50/70 border-l-4 border-amber-500 p-3 rounded-r-lg space-y-1">
                    <p class="font-bold text-amber-900 text-xs uppercase">Cláusula Segunda: Reducción Legal de Jornada</p>
                    <p class="text-amber-950 text-xs">Se sustituye la jornada anterior de ${prevH} horas semanales por una nueva jornada ordinaria de <strong>42 (cuarenta y dos) horas semanales</strong> sin alteración ni menoscabo alguno en la remuneración del trabajador.</p>
                </div>

                <div class="space-y-1">
                    <p class="font-bold text-slate-900 text-xs uppercase">Cláusula Tercera: Distribución Horaria</p>
                    <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-line font-mono">
${sched.text}
                    </div>
                </div>

                <div class="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-center">
                    <div class="border-t border-dashed border-slate-400 pt-2">
                        <p class="font-bold text-[11px] text-slate-900">${compName}</p>
                        <p class="text-[10px] text-slate-500">Firma Empleador (RUT: ${compRut})</p>
                    </div>
                    <div class="border-t border-dashed border-slate-400 pt-2">
                        <p class="font-bold text-[11px] text-slate-900">${workName}</p>
                        <p class="text-[10px] text-slate-500">Firma Trabajador (CNI: ${workRut})</p>
                    </div>
                </div>
            </div>
        `;

        elements.previewContainer.innerHTML = html;
    }

    // Build print HTML document for window.print() (Clean A4 portrait, perfect serif legal styling)
    function buildPrintHTML() {
        const city = elements.city?.value.trim() || 'Santiago';
        const effDate = formatDateSpanish(elements.effectiveDate?.value) || '26 de abril de 2026';
        const compName = elements.companyName?.value.trim() || '________________________________________';
        const compRut = elements.companyRut?.value.trim() || '_______________';
        const compAddr = elements.companyAddress?.value.trim() || '________________________________________';
        const repName = elements.repName?.value.trim() || '________________________________________';
        const workName = elements.workerName?.value.trim() || '________________________________________';
        const workRut = elements.workerRut?.value.trim() || '_______________';
        const workPos = elements.workerPosition?.value.trim() || '____________________';
        const origDate = formatDateSpanish(elements.contractDate?.value) || '____________________';
        const prevH = elements.prevHours?.value || '44';
        const sched = getScheduleData();

        return `
            <div style="font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.55; color: #0f172a; max-width: 100%; margin: 0 auto; box-sizing: border-box;">
                
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: #475569; font-family: system-ui, sans-serif; margin-bottom: 4px;">
                        Instrumento Jurídico Laboral · Artículos 10 y 11 del Código del Trabajo
                    </div>
                    <h1 style="font-size: 13.5pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: -0.01em;">
                        ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO
                    </h1>
                    <h2 style="font-size: 11pt; font-weight: 600; font-style: italic; color: #334155; margin: 4px 0 0;">
                        Adecuación de Jornada Ordinaria de Trabajo a 42 Horas Semanales (Ley Nº 21.561)
                    </h2>
                </div>

                <p style="text-align: justify; margin-bottom: 14px;">
                    En la ciudad de <strong>${city}</strong>, a <strong>${effDate}</strong>, comparecen por una parte <strong>${compName}</strong>, Rol Único Tributario Nº <strong>${compRut}</strong>, con domicilio en ${compAddr}, debidamente representada por su representante legal don(ña) <strong>${repName}</strong>, en adelante denominado indistintamente como "el Empleador"; y por la otra, don(ña) <strong>${workName}</strong>, Cédula Nacional de Identidad Nº <strong>${workRut}</strong>, domiciliado(a) en los registros de la empresa, quien se desempeña en calidad de <strong>${workPos}</strong>, en adelante denominado como "el Trabajador", quienes han convenido suscribir el presente Anexo al Contrato de Trabajo celebrado originalmente con fecha <strong>${origDate}</strong>:
                </p>

                <p style="text-align: justify; margin-bottom: 12px;">
                    <strong>PRIMERO: ANTECEDENTES.</strong> Con fecha 26 de abril de 2023 se publicó la Ley Nº 21.561 que modifica el Código del Trabajo en materia de jornada ordinaria, fijando una reducción progresiva que alcanza el hito legal de 42 horas semanales a partir del año 2026.
                </p>

                <p style="text-align: justify; margin-bottom: 12px;">
                    <strong>SEGUNDO: MODIFICACIÓN DE JORNADA.</strong> En observancia irrestricta de las normas transitorias y del artículo primero de la Ley Nº 21.561, las partes modifican la cláusula de jornada del contrato matriz, rebajando la jornada ordinaria previa de ${prevH} horas a una nueva jornada de <strong>42 (cuarenta y dos) horas semanales</strong>.
                </p>

                <p style="text-align: justify; margin-bottom: 12px;">
                    <strong>TERCERO: DISTRIBUCIÓN HORARIA.</strong> ${sched.text.replace(/\n\n/g, '<br><br>')}
                </p>

                <p style="text-align: justify; margin-bottom: 12px;">
                    <strong>CUARTO: IRRENUNCIABILIDAD Y MANTENCIÓN DE REMUNERACIONES.</strong> En cumplimiento del mandato imperativo del artículo tercero transitorio de la citada ley, se estipula de forma expresa que la reducción de jornada no significará en caso alguno rebaja de la remuneración convenida, manteniéndose íntegramente los haberes fijos, variables y asignaciones legales vigentes.
                </p>

                <p style="text-align: justify; margin-bottom: 12px;">
                    <strong>QUINTO: SUBSISTENCIA CONTRACTUAL.</strong> Las restantes cláusulas del contrato individual de trabajo y anexos precedentes se mantienen plenamente válidas y vigentes en todo lo que no resulte modificado por este acto.
                </p>

                <p style="text-align: justify; margin-bottom: 24px;">
                    <strong>SEXTO: EJEMPLARES.</strong> En cumplimiento del artículo 11 del Código del Trabajo, el presente instrumento se otorga y firma en dos ejemplares de idéntico tenor y fecha, quedando uno en poder de cada parte interesada.
                </p>

                <!-- Bloque de Firmas -->
                <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-family: system-ui, sans-serif; font-size: 9pt;">
                    <div>
                        <div style="border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 50px;">
                            <div style="font-weight: 700; text-transform: uppercase;">${compName}</div>
                            <div style="color: #475569;">p.p. ${repName}</div>
                            <div style="font-family: monospace; font-size: 8.5pt;">RUT: ${compRut}</div>
                            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">EMPLEADOR / REPRESENTANTE LEGAL</div>
                        </div>
                    </div>
                    <div>
                        <div style="border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 50px;">
                            <div style="font-weight: 700; text-transform: uppercase;">${workName}</div>
                            <div style="font-family: monospace; font-size: 8.5pt;">CNI: ${workRut}</div>
                            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">TRABAJADOR</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px; text-align: center; font-family: system-ui, sans-serif; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                    Documento formal generado conforme a la Ley Nº 21.561 y la Dirección del Trabajo de Chile · calculolaboral.cl
                </div>
            </div>
        `;
    }

    // Copy to clipboard
    async function handleCopy() {
        const text = getAnnexFullText();
        try {
            await navigator.clipboard.writeText(text);
            if (elements.copyBtn) {
                const originalHTML = elements.copyBtn.innerHTML;
                elements.copyBtn.innerHTML = '<span class="material-icons text-sm">check_circle</span> <span>¡Anexo Copiado!</span>';
                elements.copyBtn.classList.remove('bg-sky-500', 'hover:bg-sky-600');
                elements.copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

                if (typeof gtag === 'function') {
                    gtag('event', 'copy_anexo_40h', {
                        event_category: 'tool',
                        event_label: elements.modality?.value || 'standard'
                    });
                }

                setTimeout(() => {
                    elements.copyBtn.innerHTML = originalHTML;
                    elements.copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                    elements.copyBtn.classList.add('bg-sky-500', 'hover:bg-sky-600');
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
