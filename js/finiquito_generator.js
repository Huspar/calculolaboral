/**
 * Generador de Finiquito y Pack de Despido Notarial (Chile 2026)
 * Código del Trabajo: Art. 177, Art. 161, Art. 163, Art. 172, Art. 67, 73
 * Leyes Complementarias: Ley 19.631 (Ley Bustos), Ley 19.728 (AFC), Ley 21.389 (Alimentos), Ley 21.361 (Reserva)
 */

(function () {
    'use strict';

    // Estado del generador
    const state = {
        isPaid: false,
        calcResult: null,
        activeTab: 'datos' // 'datos', 'remuneracion', 'descuentos'
    };

    // Helper: Formateador de RUT chileno (12.345.678-K)
    function formatRut(value) {
        if (!value) return '';
        let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length === 0) return '';
        if (clean.length === 1) return clean;

        const dv = clean.slice(-1);
        let cuerpo = clean.slice(0, -1).slice(0, 8);

        let formattedCuerpo = '';
        for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
            if (j > 0 && j % 3 === 0) {
                formattedCuerpo = '.' + formattedCuerpo;
            }
            formattedCuerpo = cuerpo[i] + formattedCuerpo;
        }

        return formattedCuerpo + '-' + dv;
    }

    // Helper: Validar RUT chileno (Módulo 11)
    function validateRut(rut) {
        if (!rut) return false;
        let clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length < 8) return false;

        const dv = clean.slice(-1);
        const cuerpo = clean.slice(0, -1);

        let suma = 0;
        let multiplo = 2;

        for (let i = cuerpo.length - 1; i >= 0; i--) {
            suma += parseInt(cuerpo[i], 10) * multiplo;
            multiplo = multiplo === 7 ? 2 : multiplo + 1;
        }

        const resto = 11 - (suma % 11);
        let dvEsperado = '';
        if (resto === 11) dvEsperado = '0';
        else if (resto === 10) dvEsperado = 'K';
        else dvEsperado = resto.toString();

        return dv === dvEsperado;
    }

    // Helper: Formateador de moneda chilena ($1.500.000)
    function formatMoney(amount) {
        const num = Math.round(Number(amount) || 0);
        return '$' + num.toLocaleString('es-CL');
    }

    // Helper: Formatear fecha a formato legal chileno ("19 de septiembre de 2026")
    function formatLegalDate(dateString) {
        if (!dateString) return '___ de ____________ de 2026';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        return `${day} de ${months[month]} de ${year}`;
    }

    // Helper: Conversor de números a palabras en español (pesos chilenos)
    function numberToWords(num) {
        const n = Math.round(Math.abs(Number(num) || 0));
        if (n === 0) return 'cero pesos';

        function Unidades(u) {
            switch (u) {
                case 1: return 'un';
                case 2: return 'dos';
                case 3: return 'tres';
                case 4: return 'cuatro';
                case 5: return 'cinco';
                case 6: return 'seis';
                case 7: return 'siete';
                case 8: return 'ocho';
                case 9: return 'nueve';
                default: return '';
            }
        }

        function Decenas(d) {
            const decena = Math.floor(d / 10);
            const unidad = d - (decena * 10);
            switch (decena) {
                case 1:
                    switch (unidad) {
                        case 0: return 'diez';
                        case 1: return 'once';
                        case 2: return 'doce';
                        case 3: return 'trece';
                        case 4: return 'catorce';
                        case 5: return 'quince';
                        default: return 'dieci' + Unidades(unidad);
                    }
                case 2:
                    switch (unidad) {
                        case 0: return 'veinte';
                        default: return 'veinti' + Unidades(unidad);
                    }
                case 3: return DecenasY('treinta', unidad);
                case 4: return DecenasY('cuarenta', unidad);
                case 5: return DecenasY('cincuenta', unidad);
                case 6: return DecenasY('sesenta', unidad);
                case 7: return DecenasY('setenta', unidad);
                case 8: return DecenasY('ochenta', unidad);
                case 9: return DecenasY('noventa', unidad);
                case 0: return Unidades(unidad);
            }
        }

        function DecenasY(strSin, numUnidades) {
            if (numUnidades > 0) return strSin + ' y ' + Unidades(numUnidades);
            return strSin;
        }

        function Centenas(c) {
            const centenas = Math.floor(c / 100);
            const decenas = c - (centenas * 100);
            switch (centenas) {
                case 1:
                    if (decenas > 0) return 'ciento ' + Decenas(decenas);
                    return 'cien';
                case 2: return 'doscientos ' + Decenas(decenas);
                case 3: return 'trescientos ' + Decenas(decenas);
                case 4: return 'cuatrocientos ' + Decenas(decenas);
                case 5: return 'quinientos ' + Decenas(decenas);
                case 6: return 'seiscientos ' + Decenas(decenas);
                case 7: return 'setecientos ' + Decenas(decenas);
                case 8: return 'ochocientos ' + Decenas(decenas);
                case 9: return 'novecientos ' + Decenas(decenas);
                default: return Decenas(decenas);
            }
        }

        function Seccion(num, divisor, strSingular, strPlural) {
            const cientos = Math.floor(num / divisor);
            const resto = num - (cientos * divisor);
            let letras = '';
            if (cientos > 0) {
                if (cientos > 1) letras = Centenas(cientos) + ' ' + strPlural;
                else letras = strSingular;
            }
            if (resto > 0) letras += '';
            return letras;
        }

        function Miles(m) {
            const divisor = 1000;
            const cientos = Math.floor(m / divisor);
            const resto = m - (cientos * divisor);
            const strMiles = Seccion(m, divisor, 'un mil', 'mil');
            const strCentenas = Centenas(resto);
            if (strMiles === '') return strCentenas;
            return (strMiles + ' ' + strCentenas).trim();
        }

        function Millones(m) {
            const divisor = 1000000;
            const cientos = Math.floor(m / divisor);
            const resto = m - (cientos * divisor);
            const strMillones = Seccion(m, divisor, 'un millón', 'millones');
            const strMiles = Miles(resto);
            if (strMillones === '') return strMiles;
            return (strMillones + ' ' + strMiles).trim();
        }

        const palabras = Millones(n);
        return (palabras + ' pesos').trim();
    }

    // Inicialización del generador
    function init() {
        bindInputs();
        loadFromUrlOrStorage();
        updateAll();
        setupPaymentModal();
    }

    // Enlazar inputs con listeners de actualización
    function bindInputs() {
        const inputIds = [
            'empresa-razon', 'empresa-rut', 'empresa-rep-nombre', 'empresa-rep-rut',
            'empresa-domicilio', 'empresa-ciudad',
            'trabajador-nombre', 'trabajador-rut', 'trabajador-cargo',
            'trabajador-domicilio', 'trabajador-ciudad',
            'fecha-inicio', 'fecha-termino', 'fecha-pago', 'causal-select',
            'sueldo-base', 'gratificacion', 'asignaciones', 'promedio-variables',
            'vacaciones-pendientes', 'aviso-previo', 'zona-extrema',
            'afc-tipo', 'afc-monto-exacto', 'descuento-anticipos',
            'descuento-prestamos', 'descuento-alimentos',
            'forma-pago', 'banco-detalle'
        ];

        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('input', () => {
                if (id === 'empresa-rut' || id === 'empresa-rep-rut' || id === 'trabajador-rut') {
                    const caret = el.selectionStart;
                    el.value = formatRut(el.value);
                }
                updateAll();
            });

            el.addEventListener('change', () => {
                updateAll();
            });
        });

        // Toggle AFC exact input
        const afcTipo = document.getElementById('afc-tipo');
        if (afcTipo) {
            afcTipo.addEventListener('change', () => {
                const exactBox = document.getElementById('afc-exacto-box');
                if (exactBox) {
                    if (afcTipo.value === 'certificado') {
                        exactBox.classList.remove('hidden');
                    } else {
                        exactBox.classList.add('hidden');
                    }
                }
                updateAll();
            });
        }

        // Causal Change Handler
        const causalSelect = document.getElementById('causal-select');
        if (causalSelect) {
            causalSelect.addEventListener('change', () => {
                const avisoBox = document.getElementById('aviso-previo-box');
                const afcBox = document.getElementById('afc-config-box');
                const is161 = causalSelect.value === '161';

                if (avisoBox) avisoBox.style.display = is161 ? 'block' : 'none';
                if (afcBox) afcBox.style.display = is161 ? 'block' : 'none';
                updateAll();
            });
        }
    }

    // Pre-cargar datos desde URL o localStorage si viene de la calculadora general
    function loadFromUrlOrStorage() {
        const params = new URLSearchParams(window.location.search);

        const getVal = (paramKey, defaultVal = '') => {
            return params.get(paramKey) || localStorage.getItem('fini_' + paramKey) || defaultVal;
        };

        const setIfPresent = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) el.value = val;
        };

        setIfPresent('fecha-inicio', getVal('startDate'));
        setIfPresent('fecha-termino', getVal('endDate'));
        setIfPresent('sueldo-base', getVal('baseSalary'));
        setIfPresent('gratificacion', getVal('gratification'));
        setIfPresent('asignaciones', getVal('assignments'));
        setIfPresent('promedio-variables', getVal('variableAverage'));
        setIfPresent('vacaciones-pendientes', getVal('vacationDaysPending'));
        
        if (params.get('cause')) {
            const causalEl = document.getElementById('causal-select');
            if (causalEl) causalEl.value = params.get('cause');
        }

        // Default fecha-pago to today if empty
        const fechaPagoEl = document.getElementById('fecha-pago');
        if (fechaPagoEl && !fechaPagoEl.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            fechaPagoEl.value = `${yyyy}-${mm}-${dd}`;
        }
    }

    // Recalcular montos y actualizar la plantilla notarial
    function updateAll() {
        const formData = getFormData();
        const calcData = calculateFiniquito(formData);
        state.calcResult = calcData;

        renderSummary(calcData);
        renderNotaryDocument(formData, calcData);
    }

    // Extraer datos del formulario
    function getFormData() {
        const getV = (id) => document.getElementById(id)?.value?.trim() || '';
        const getN = (id) => {
            const raw = document.getElementById(id)?.value || '0';
            return parseFloat(raw.replace(/[^0-9]/g, '')) || 0;
        };
        const getChecked = (id) => document.getElementById(id)?.checked || false;

        return {
            empresaRazon: getV('empresa-razon') || '[RAZÓN SOCIAL DE LA EMPRESA]',
            empresaRut: getV('empresa-rut') || '[RUT EMPRESA]',
            empresaRepNombre: getV('empresa-rep-nombre') || '[NOMBRE REPRESENTANTE LEGAL]',
            empresaRepRut: getV('empresa-rep-rut') || '[RUT REPRESENTANTE]',
            empresaDomicilio: getV('empresa-domicilio') || '[DOMICILIO EMPLEADOR]',
            empresaCiudad: getV('empresa-ciudad') || 'Santiago',

            trabajadorNombre: getV('trabajador-nombre') || '[NOMBRE DEL TRABAJADOR]',
            trabajadorRut: getV('trabajador-rut') || '[RUT TRABAJADOR]',
            trabajadorCargo: getV('trabajador-cargo') || '[CARGO U OFICIO]',
            trabajadorDomicilio: getV('trabajador-domicilio') || '[DOMICILIO TRABAJADOR]',
            trabajadorCiudad: getV('trabajador-ciudad') || 'Santiago',

            fechaInicio: getV('fecha-inicio') || '2023-01-01',
            fechaTermino: getV('fecha-termino') || '2026-09-19',
            fechaPago: getV('fecha-pago') || '2026-09-19',
            causal: getV('causal-select') || '161',

            sueldoBase: getN('sueldo-base'),
            gratificacion: getN('gratificacion'),
            asignaciones: getN('asignaciones'),
            promedioVariables: getN('promedio-variables'),
            vacacionesPendientes: parseFloat(getV('vacaciones-pendientes')) || 0,
            avisoPrevio: getChecked('aviso-previo'),
            isExtremeZone: getChecked('zona-extrema'),

            afcTipo: getV('afc-tipo') || 'estimado',
            afcMontoExacto: getN('afc-monto-exacto'),
            descuentoAnticipos: getN('descuento-anticipos'),
            descuentoPrestamos: getN('descuento-prestamos'),
            descuentoAlimentos: getN('descuento-alimentos'),

            formaPago: getV('forma-pago') || 'transferencia',
            bancoDetalle: getV('banco-detalle') || 'cuenta bancaria informada por el trabajador'
        };
    }

    // Ejecutar motor de cálculo legal usando FiniquitoCalculator
    function calculateFiniquito(formData) {
        if (typeof FiniquitoCalculator === 'undefined') {
            console.error("FiniquitoCalculator no disponible");
            return null;
        }

        const afcExact = formData.afcTipo === 'certificado' ? formData.afcMontoExacto : null;
        const simulateAfc = formData.afcTipo !== 'ninguno';

        const calculator = new FiniquitoCalculator({
            startDate: formData.fechaInicio,
            endDate: formData.fechaTermino,
            baseSalary: formData.sueldoBase,
            gratification: formData.gratificacion,
            assignments: formData.assignments || formData.asignaciones,
            variableAverage: formData.promedioVariables,
            vacationDaysPending: formData.vacacionesPendientes,
            cause: formData.causal,
            noticeGiven: formData.avisoPrevio,
            simulateAFC: simulateAfc,
            afcExactAmount: afcExact,
            isExtremeZone: formData.isExtremeZone
        });

        const res = calculator.calculate();

        // Descuentos adicionales voluntarios o judiciales
        const totalDescuentosAdicionales = (formData.descuentoAnticipos || 0) +
            (formData.descuentoPrestamos || 0) +
            (formData.descuentoAlimentos || 0);

        // Descuento AFC aplicado
        const afcDescuento = res.afc && res.afc.applied ? res.afc.total : 0;
        const totalDescuentos = afcDescuento + totalDescuentosAdicionales;

        // Total haberes brutos
        const totalHaberes = (res.yearsOfServiceIndemnity?.total || 0) +
            (res.noticeIndemnity?.total || 0) +
            (res.vacationIndemnity?.total || 0) +
            (res.pendingRemuneration?.total || 0);

        // Saldo líquido final a pagar
        const saldoLiquidoFinal = Math.max(0, totalHaberes - totalDescuentos);

        return {
            ...res,
            totalHaberes,
            afcDescuento,
            totalDescuentosAdicionales,
            totalDescuentos,
            saldoLiquidoFinal
        };
    }

    // Actualizar el resumen numérico lateral / superior
    function renderSummary(calc) {
        if (!calc) return;

        const setT = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setT('resumen-ias', formatMoney(calc.yearsOfServiceIndemnity?.total || 0));
        setT('resumen-aviso', formatMoney(calc.noticeIndemnity?.total || 0));
        setT('resumen-vacaciones', formatMoney(calc.vacationIndemnity?.total || 0));
        setT('resumen-dias-pendientes', formatMoney(calc.pendingRemuneration?.total || 0));
        setT('resumen-total-haberes', formatMoney(calc.totalHaberes || 0));
        setT('resumen-descuentos', formatMoney(calc.totalDescuentos || 0));
        setT('resumen-liquido-pagar', formatMoney(calc.saldoLiquidoFinal || 0));

        // Letras resumen
        setT('resumen-liquido-palabras', numberToWords(calc.saldoLiquidoFinal || 0));
    }

    // Renderizar la plantilla notarial viva
    function renderNotaryDocument(f, c) {
        if (!c) return;

        // Título de Causal Legal
        let causalTexto = '';
        let causalFundamento = '';
        if (f.causal === '161') {
            causalTexto = 'Artículo 161 inciso 1º del Código del Trabajo (Necesidades de la Empresa)';
            causalFundamento = 'motivos de índole económica y de modernización o racionalización de los servicios de la empresa que hacen necesaria e impostergable la desvinculación';
        } else if (f.causal === '159-2') {
            causalTexto = 'Artículo 159 Nº 2 del Código del Trabajo (Renuncia Voluntaria del Trabajador)';
            causalFundamento = 'determinación personal y voluntaria del propio trabajador debidamente comunicada a la empleadora';
        } else if (f.causal === '159-4') {
            causalTexto = 'Artículo 159 Nº 4 del Código del Trabajo (Vencimiento del Plazo Convenido)';
            causalFundamento = 'llegada del plazo expresamente convenido por las partes en el respectivo contrato de trabajo';
        } else if (f.causal === '159-5') {
            causalTexto = 'Artículo 159 Nº 5 del Código del Trabajo (Conclusión del Trabajo o Servicio que dio Origen al Contrato)';
            causalFundamento = 'haber concluido de manera íntegra y efectiva la obra, faena o servicio para el cual fue contratado el trabajador';
        } else {
            causalTexto = 'Artículo 160 del Código del Trabajo';
            causalFundamento = 'las causales subjetivas e imputables previstas expresamente en la ley';
        }

        // Forma de pago texto legal
        let formaPagoTexto = '';
        if (f.formaPago === 'transferencia') {
            formaPagoTexto = `mediante transferencia electrónica de fondos a la cuenta bancaria del trabajador (${f.bancoDetalle})`;
        } else if (f.formaPago === 'cheque') {
            formaPagoTexto = `mediante cheque nominativo y cruzado a nombre del trabajador (${f.bancoDetalle})`;
        } else if (f.formaPago === 'vale-vista') {
            formaPagoTexto = `mediante Vale Vista bancario a nombre del trabajador emitido por entidad bancaria de la plaza`;
        } else {
            formaPagoTexto = `en dinero efectivo y moneda de curso legal al contado en este mismo acto`;
        }

        // Construir tabla de Haberes HTML
        let haberesRows = '';
        if (c.yearsOfServiceIndemnity && c.yearsOfServiceIndemnity.applied) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Indemnización Legal por Años de Servicio (${c.serviceTime.cappedIndemnityYears} años - Art. 163)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.yearsOfServiceIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.noticeIndemnity && c.noticeIndemnity.applied) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Indemnización Sustitutiva de Aviso Previo (Art. 161 inc. 2º / 162)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.noticeIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.vacationIndemnity && c.vacationIndemnity.total > 0) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Indemnización por Feriado Legal y Proporcional (${c.vacationIndemnity.details} - Art. 67 y 73)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.vacationIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.pendingRemuneration && c.pendingRemuneration.total > 0) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Remuneración por Días Trabajados en el Mes (${c.pendingRemuneration.daysWorked} días)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.pendingRemuneration.total)}</td>
                </tr>
            `;
        }
        haberesRows += `
            <tr class="bg-gray-50 font-semibold">
                <td class="py-1.5 px-2 border border-gray-300">TOTAL HABERES BRUTOS</td>
                <td class="py-1.5 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.totalHaberes)}</td>
            </tr>
        `;

        // Construir tabla de Descuentos HTML
        let descuentosRows = '';
        if (c.afcDescuento > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Deducción Aporte Empleador CIC AFC (Art. 13 Ley Nº 19.728)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(c.afcDescuento)}</td>
                </tr>
            `;
        }
        if (f.descuentoAnticipos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Descuento por Anticipos de Remuneración Otorgados</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoAnticipos)}</td>
                </tr>
            `;
        }
        if (f.descuentoPrestamos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Descuento Préstamo Caja de Compensación (CCAF)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoPrestamos)}</td>
                </tr>
            `;
        }
        if (f.descuentoAlimentos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Retención Judicial Pensión de Alimentos (Ley Nº 21.389)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoAlimentos)}</td>
                </tr>
            `;
        }

        if (c.totalDescuentos === 0) {
            descuentosRows = `
                <tr>
                    <td class="py-1 px-2 border border-gray-300 italic text-gray-500">Sin descuentos convencionales o judiciales que deducir</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">$0</td>
                </tr>
            `;
        }
        descuentosRows += `
            <tr class="bg-gray-50 font-semibold">
                <td class="py-1.5 px-2 border border-gray-300">TOTAL DESCUENTOS DEDUCIBLES</td>
                <td class="py-1.5 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(c.totalDescuentos)}</td>
            </tr>
        `;

        // Inyectar HTML en la previsualización del documento
        const docEl = document.getElementById('notary-document-body');
        if (!docEl) return;

        docEl.innerHTML = `
            <!-- Encabezado Notarial -->
            <div class="text-center pb-6 border-b border-gray-400">
                <h2 class="text-xl font-bold uppercase tracking-wider text-gray-900 font-serif">FINIQUITO DE CONTRATO DE TRABAJO</h2>
                <p class="text-xs uppercase text-gray-600 mt-1 font-serif">RATIFICADO ANTE MINISTRO DE FE — ARTÍCULO 177 CÓDIGO DEL TRABAJO DE CHILE</p>
            </div>

            <!-- Comparecencia -->
            <div class="mt-6 text-justify text-sm leading-relaxed font-serif text-gray-900 space-y-4">
                <p>
                    En la ciudad de <strong>${escapeHtml(f.empresaCiudad)}</strong>, República de Chile, a <strong>${formatLegalDate(f.fechaPago)}</strong>, comparecen por una parte, como empleadora, la sociedad <strong>${escapeHtml(f.empresaRazon)}</strong>, Rol Único Tributario Nº <strong>${escapeHtml(f.empresaRut)}</strong>, domiciliada para estos efectos en <strong>${escapeHtml(f.empresaDomicilio)}</strong>, de la ciudad de ${escapeHtml(f.empresaCiudad)}, en adelante e indistintamente denominada <em>"la Empleadora"</em>, representada legalmente por don(ña) <strong>${escapeHtml(f.empresaRepNombre)}</strong>, cédula nacional de identidad Nº <strong>${escapeHtml(f.empresaRepRut)}</strong>; y por la otra parte, como trabajador(a), don(ña) <strong>${escapeHtml(f.trabajadorNombre)}</strong>, cédula nacional de identidad Nº <strong>${escapeHtml(f.trabajadorRut)}</strong>, domiciliado(a) en <strong>${escapeHtml(f.trabajadorDomicilio)}</strong>, de la ciudad de ${escapeHtml(f.trabajadorCiudad)}, en adelante <em>"el(la) Trabajador(a)"</em>; quienes declaran y acuerdan otorgar el siguiente <strong>FINIQUITO DE CONTRATO DE TRABAJO</strong>:
                </p>

                <!-- Cláusula Primera -->
                <p>
                    <strong><u>PRIMERO:</u> ANTECEDENTES Y RELACIÓN LABORAL.</strong> Las partes dejan expresa y formal constancia de que don(ña) ${escapeHtml(f.trabajadorNombre)} prestó servicios continuos e ininterrumpidos para la Empleadora desde el <strong>${formatLegalDate(f.fechaInicio)}</strong> hasta el <strong>${formatLegalDate(f.fechaTermino)}</strong>, desempeñándose como <strong>${escapeHtml(f.trabajadorCargo)}</strong>, bajo régimen de subordinación y dependencia. La relación laboral tuvo una vigencia efectiva y continua de <strong>${c.serviceTime.years} años, ${c.serviceTime.months} meses y ${c.serviceTime.days} días</strong>.
                </p>

                <!-- Cláusula Segunda -->
                <p>
                    <strong><u>SEGUNDO:</u> TÉRMINO DE LA RELACIÓN Y CAUSAL LEGAL.</strong> Las partes declaran que la relación laboral habida entre ellas ha terminado en forma definitiva e irrevocable el día <strong>${formatLegalDate(f.fechaTermino)}</strong>, por la causal legal consagrada en el <strong>${causalTexto}</strong>, fundamentada en ${causalFundamento}.
                </p>

                <!-- Cláusula Tercera: Liquidación -->
                <div>
                    <p class="mb-2">
                        <strong><u>TERCERO:</u> LIQUIDACIÓN DE HABERES E INDEMNIZACIONES.</strong> Con ocasión del término de la relación laboral precedentemente señalada, la Empleadora practica la liquidación pormenorizada de todos y cada uno de los haberes e indemnizaciones que en derecho corresponden al(a la) Trabajador(a), conforme al siguiente detalle específico:
                    </p>
                    <table class="w-full text-xs border-collapse border border-gray-400 mt-2 mb-3 font-sans">
                        <thead>
                            <tr class="bg-gray-100 text-gray-800">
                                <th class="py-1 px-2 border border-gray-300 text-left">CONCEPTO / RUBRO LIQUIDADO</th>
                                <th class="py-1 px-2 border border-gray-300 text-right w-36">MONTO (CLP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${haberesRows}
                        </tbody>
                    </table>
                </div>

                <!-- Cláusula Cuarta: Descuentos -->
                <div>
                    <p class="mb-2">
                        <strong><u>CUARTO:</u> DESCUENTOS Y DEDUCCIONES LEGALES.</strong> De las sumas devengadas detalladas en la cláusula anterior, se deducen los siguientes rubros legal y convencionalmente procedentes:
                    </p>
                    <table class="w-full text-xs border-collapse border border-gray-400 mt-2 mb-3 font-sans">
                        <thead>
                            <tr class="bg-gray-100 text-gray-800">
                                <th class="py-1 px-2 border border-gray-300 text-left">DETALLE DEL DESCUENTO</th>
                                <th class="py-1 px-2 border border-gray-300 text-right w-36">MONTO (CLP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${descuentosRows}
                        </tbody>
                    </table>
                </div>

                <!-- Cláusula Quinta: Saldo Líquido -->
                <div class="p-3 bg-gray-50 border border-gray-300 rounded">
                    <p>
                        <strong><u>QUINTO:</u> SALDO LÍQUIDO A PAGAR Y FORMA DE PAGO.</strong> Deducidos los descuentos individualizados, resulta la suma líquida, neta y única a favor del(de la) Trabajador(a) ascendente a <strong>${formatMoney(c.saldoLiquidoFinal)} (${numberToWords(c.saldoLiquidoFinal)})</strong>, monto que la Empleadora paga ${formaPagoTexto}, recibiéndolo el(la) Trabajador(a) a su entera satisfacción, declarando no tener reclamo alguno respecto de su cuantía.
                    </p>
                </div>

                <!-- Cláusula Sexta: Ley Bustos -->
                <p>
                    <strong><u>SEXTO:</u> DECLARACIÓN JURADA DE COTIZACIONES PREVISIONALES (LEY Nº 19.631).</strong> Para dar estricto cumplimiento a lo prescrito en los incisos 5º al 9º del artículo 162 del Código del Trabajo (Ley Bustos), la Empleadora acredita y declara bajo juramento que tiene íntegramente pagadas y enteradas todas las imposiciones y cotizaciones previsionales del(de la) Trabajador(a) correspondientes a fondos de pensiones (AFP), salud (Fonasa/Isapre) y seguro de cesantía (AFC), devengadas hasta el último día del mes inmediatamente anterior al término de los servicios, adjuntándose al presente instrumento los certificados de cotizaciones correspondientes.
                </p>

                <!-- Cláusula Séptima: Ley 21.389 (Pensión Alimentos) -->
                <p>
                    <strong><u>SÉPTIMO:</u> CUMPLIMIENTO LEY Nº 21.389 (REGISTRO NACIONAL DE DEUDORES DE PENSIONES DE ALIMENTOS).</strong> En conformidad a lo establecido en los artículos 32 y 33 de la Ley Nº 21.389, la Empleadora deja constancia de haber consultado el Registro Nacional de Deudores de Pensiones de Alimentos del Servicio de Registro Civil e Identificación respecto del(de la) Trabajador(a). Se deja constancia de que no existen retenciones judiciales pendientes, o bien se ha practicado la retención y entero respectivo en la cuenta bancaria ordenada por el tribunal competente.
                </p>

                <!-- Cláusula Octava: Finiquito Amplio y Reserva -->
                <p>
                    <strong><u>OCTAVO:</u> FINIQUITO AMPLIO, PODER LIBERATORIO Y RESERVA DE DERECHOS.</strong> Salvas las reservas de derechos que el(la) Trabajador(a) estampe de su propio puño y letra o de conformidad con la Ley Nº 21.361, las partes declaran que con el pago de la suma antes señalada, la Empleadora nada le adeuda al(a la) Trabajador(a) por concepto de remuneraciones, horas extraordinarias, feriado legal o proporcional, asignaciones, indemnizaciones legales o convencionales, ni por ningún otro concepto de origen legal, contractual o extracontractual. Por consiguiente, el(la) Trabajador(a) otorga a la Empleadora el más amplio, total, completo e irrevocable finiquito, renunciando a toda acción judicial o administrativa posterior, salvo las excepciones legales ya referidas.
                </p>

                <!-- Cláusula Novena: Ejemplares -->
                <p>
                    <strong><u>NOVENO:</u> EJEMPLARES Y RATIFICACIÓN.</strong> El presente finiquito se extiende en 3 (tres) ejemplares de idéntico tenor, validez y fecha, quedando 1 en poder de la Empleadora, 1 en poder del(de la) Trabajador(a) y 1 en la Notaría actuante, siendo ratificado ante el Ministro de Fe que autoriza al pie.
                </p>
            </div>

            <!-- Sección de Firmas Notariales -->
            <div class="mt-12 pt-8 border-t border-gray-400 font-serif">
                <div class="grid grid-cols-2 gap-8 text-center text-xs">
                    <!-- Firma Empleador -->
                    <div class="flex flex-col items-center">
                        <div class="w-48 border-b border-gray-900 mb-2"></div>
                        <p class="font-bold uppercase text-gray-900">${escapeHtml(f.empresaRazon)}</p>
                        <p class="text-gray-600">RUT: ${escapeHtml(f.empresaRut)}</p>
                        <p class="text-gray-600">Por don(ña) ${escapeHtml(f.empresaRepNombre)}</p>
                        <p class="text-gray-500 text-[10px]">EMPLEADORA</p>
                    </div>

                    <!-- Firma Trabajador -->
                    <div class="flex flex-col items-center">
                        <div class="w-48 border-b border-gray-900 mb-2"></div>
                        <p class="font-bold uppercase text-gray-900">${escapeHtml(f.trabajadorNombre)}</p>
                        <p class="text-gray-600">RUT: ${escapeHtml(f.trabajadorRut)}</p>
                        <p class="text-gray-500 text-[10px]">TRABAJADOR(A)</p>
                    </div>
                </div>

                <!-- Recuadro Reserva de Derechos -->
                <div class="mt-8 p-3 border border-dashed border-gray-400 text-xs text-gray-700 bg-gray-50/50">
                    <p class="font-bold uppercase text-gray-800 text-[11px] mb-1">Espacio Exclusivo para Reserva de Derechos del Trabajador(a) (Ley Nº 21.361):</p>
                    <p class="italic text-[11px] text-gray-500 h-8 flex items-center">
                        [Si no formula reserva, cruzar con una línea. El trabajador conserva el derecho a reservar acciones laborales].
                    </p>
                </div>

                <!-- Ratificación Notarial -->
                <div class="mt-8 pt-4 border-t border-gray-300 text-center text-[11px] text-gray-600">
                    <p class="font-bold uppercase tracking-wider text-gray-800">AUTORIZACIÓN ANTE MINISTRO DE FE</p>
                    <p class="mt-1">
                        Autorizo las firmas estampadas precedentemente de don(ña) <strong>${escapeHtml(f.empresaRepNombre)}</strong> y de don(ña) <strong>${escapeHtml(f.trabajadorNombre)}</strong>, quienes previa exhibición de sus respectivas cédulas de identidad manifestaron haber leído y aceptado el contenido del presente instrumento.
                    </p>
                    <div class="mt-8 flex justify-center">
                        <div class="w-64 border-b border-gray-900 pb-1"></div>
                    </div>
                    <p class="text-gray-700 font-semibold mt-1">MINISTRO DE FE / NOTARIO PÚBLICO</p>
                </div>
            </div>
        `;
    }

    // Modal de Pago y Descarga
    function setupPaymentModal() {
        const triggerBtns = [
            document.getElementById('btn-unlock-pdf'),
            document.getElementById('btn-unlock-word'),
            document.getElementById('btn-primary-checkout')
        ];

        const modal = document.getElementById('payment-modal');
        const closeModalBtn = document.getElementById('btn-close-modal');
        const confirmPayBtn = document.getElementById('btn-confirm-payment');

        triggerBtns.forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (state.isPaid) {
                    // Si ya pagó, descarga directo
                    if (btn.id === 'btn-unlock-word') downloadWord();
                    else downloadPDF();
                    return;
                }
                if (modal) modal.classList.remove('hidden');
            });
        });

        if (closeModalBtn && modal) {
            closeModalBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Simulación / Conexión de Pago
        if (confirmPayBtn) {
            confirmPayBtn.addEventListener('click', () => {
                const emailInput = document.getElementById('checkout-email');
                if (emailInput && !emailInput.value.includes('@')) {
                    alert('Por favor, ingresa un correo electrónico válido para enviarte el respaldo.');
                    return;
                }

                confirmPayBtn.disabled = true;
                confirmPayBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando orden...
                `;

                // Simular validación Webpay/MercadoPago con éxito inmediato
                setTimeout(() => {
                    state.isPaid = true;
                    if (modal) modal.classList.add('hidden');

                    // Remover marcas de agua de la vista previa
                    const watermarks = document.querySelectorAll('.watermark-overlay');
                    watermarks.forEach(wm => wm.remove());

                    // Cambiar estados de botones de descarga
                    const unlockBar = document.getElementById('unlock-status-bar');
                    if (unlockBar) {
                        unlockBar.innerHTML = `
                            <div class="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <span class="material-icons text-emerald-600 text-lg">check_circle</span>
                                    <span class="text-xs font-semibold">¡Finiquito Oficial Desbloqueado! Descárgalo en PDF y Word:</span>
                                </div>
                                <div class="flex space-x-2">
                                    <button id="quick-pdf" class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm">
                                        Descargar PDF Oficial
                                    </button>
                                    <button id="quick-word" class="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm">
                                        Descargar Word (.docx)
                                    </button>
                                </div>
                            </div>
                        `;
                        document.getElementById('quick-pdf')?.addEventListener('click', downloadPDF);
                        document.getElementById('quick-word')?.addEventListener('click', downloadWord);
                    }

                    // Abrir diálogo de descarga inmediata
                    downloadPDF();
                }, 1200);
            });
        }
    }

    // Exportador a PDF Nativo
    function downloadPDF() {
        // Ejecutar impresión del navegador con estilos optimizados para papel Notarial Carta/Oficio
        window.print();
    }

    // Exportador a Word (.doc / .docx compatible)
    function downloadWord() {
        const docBody = document.getElementById('notary-document-body');
        if (!docBody) return;

        const f = getFormData();
        const htmlContent = `
            <!DOCTYPE html>
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Finiquito - ${escapeHtml(f.trabajadorNombre)}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; }
                    h2 { text-align: center; font-size: 14pt; margin-bottom: 4pt; }
                    p { text-align: justify; margin-bottom: 8pt; }
                    table { width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 8pt; font-family: Arial, sans-serif; font-size: 9.5pt; }
                    th, td { border: 1px solid #777; padding: 4pt 6pt; }
                    th { background-color: #f2f2f2; text-align: left; }
                    .text-right { text-align: right; }
                </style>
            </head>
            <body>
                ${docBody.innerHTML}
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', htmlContent], {
            type: 'application/msword;charset=utf-8'
        });

        const filename = `Finiquito_${f.trabajadorNombre.replace(/\s+/g, '_')}_${f.trabajadorRut}.doc`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Inicializar al cargar el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exportar al ámbito global para depuración o pruebas
    window.FiniquitoGenerator = {
        state,
        updateAll,
        downloadPDF,
        downloadWord,
        numberToWords
    };

})();
