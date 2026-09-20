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

    // Configuración de Pasarela de Pago Oficial ($12.990 CLP)
    // Botón oficial Flow.cl (Webpay Plus, Servipag, Mach, Tarjetas de Débito y Crédito)
    const PAYMENT_GATEWAY_URL = 'https://www.flow.cl/btn.php?token=w2204f3d0b4ae200fcd0b91d5e497fc703716a16';

    // Helper: Formateador de RUT chileno (12.345.678-K)
    function formatRut(value) {
        if (!value) return '';
        const strVal = String(value).trim();
        // Si es un token de plantilla entre corchetes, no formatear como RUT
        if (strVal.startsWith('[') && strVal.endsWith(']')) return '';
        let clean = strVal.replace(/[^0-9kK]/g, '').toUpperCase();
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
        let clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
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

    // Helper: Formateador de números con separador de miles chileno
    function formatThousands(val) {
        if (val === undefined || val === null || val === '') return '';
        const clean = String(val).replace(/[^0-9]/g, '');
        if (!clean) return '';
        const num = parseInt(clean, 10);
        return isNaN(num) ? '' : num.toLocaleString('es-CL');
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

    // Helper: Conversor riguroso de cifras a palabras en español jurídico (pesos chilenos)
    function numberToWords(num) {
        const n = Math.round(Math.abs(Number(num) || 0));
        if (n === 0) return 'cero pesos';
        if (n === 1) return 'un peso';

        const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
        const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
        const twenties = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
        const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

        function convertGroup(g) {
            if (g === 0) return '';
            if (g === 100) return 'cien';
            const h = Math.floor(g / 100);
            const rem = g % 100;
            const words = [];
            if (h > 0) words.push(hundreds[h]);
            if (rem > 0) {
                if (rem < 10) {
                    words.push(units[rem]);
                } else if (rem >= 10 && rem <= 19) {
                    words.push(teens[rem - 10]);
                } else if (rem >= 20 && rem <= 29) {
                    words.push(twenties[rem - 20]);
                } else {
                    const t = Math.floor(rem / 10);
                    const u = rem % 10;
                    if (u === 0) {
                        words.push(tens[t]);
                    } else {
                        words.push(`${tens[t]} y ${units[u]}`);
                    }
                }
            }
            return words.join(' ');
        }

        const millions = Math.floor(n / 1000000);
        const remainder = n % 1000000;
        const thousands = Math.floor(remainder / 1000);
        const unitsGroup = remainder % 1000;

        const parts = [];
        if (millions > 0) {
            if (millions === 1) {
                parts.push('un millón');
            } else {
                parts.push(`${convertGroup(millions)} millones`);
            }
        }

        if (thousands > 0) {
            if (thousands === 1) {
                parts.push('mil');
            } else {
                parts.push(`${convertGroup(thousands)} mil`);
            }
        }

        if (unitsGroup > 0) {
            parts.push(convertGroup(unitsGroup));
        }

        const text = parts.join(' ').trim();

        // En español, si termina en 'millón' o 'millones' exactos, se agrega la preposición 'de pesos'
        if (millions > 0 && thousands === 0 && unitsGroup === 0) {
            return `${text} de pesos`;
        } else {
            return `${text} pesos`;
        }
    }

    // Inicialización del generador
    function init() {
        bindInputs();
        loadFromUrlOrStorage();
        updateAll();
        setupPaymentModal();
        setupCopyProtection();
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

        const currencyIds = new Set([
            'sueldo-base', 'gratificacion', 'asignaciones', 'promedio-variables',
            'afc-monto-exacto', 'descuento-anticipos', 'descuento-prestamos', 'descuento-alimentos'
        ]);

        const rutIds = new Set(['empresa-rut', 'empresa-rep-rut', 'trabajador-rut']);

        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('input', () => {
                if (rutIds.has(id)) {
                    el.value = formatRut(el.value);
                } else if (currencyIds.has(id)) {
                    const clean = el.value.replace(/[^0-9]/g, '');
                    if (clean) {
                        const num = parseInt(clean, 10);
                        el.value = num.toLocaleString('es-CL');
                    } else {
                        el.value = '';
                    }
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

    function isBracketedToken(val) {
        if (typeof val !== 'string') return false;
        const trimmed = val.trim();
        return trimmed.startsWith('[') && trimmed.endsWith(']');
    }

    // Persistencia local de borrador para evitar pérdida de datos si el usuario va al portal de pago
    function saveDraftToStorage() {
        try {
            const rawData = getRawFormData();
            localStorage.setItem('fini_draft_payload', JSON.stringify(rawData));
        } catch (e) {
            console.warn('No se pudo guardar borrador local', e);
        }
    }

    function loadDraftFromStorage() {
        try {
            const saved = localStorage.getItem('fini_draft_payload');
            if (!saved) return;
            const data = JSON.parse(saved);

            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null && val !== '' && !isBracketedToken(val)) {
                    el.value = val;
                }
            };

            const setRut = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null && val !== '' && !isBracketedToken(val)) {
                    el.value = formatRut(val);
                }
            };

            const setMoney = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null && val !== '' && !isBracketedToken(val)) {
                    const num = parseFloat(String(val).replace(/[^0-9]/g, ''));
                    el.value = !isNaN(num) && num > 0 ? num.toLocaleString('es-CL') : (num === 0 ? '0' : '');
                }
            };

            setText('empresa-razon', data.empresaRazon);
            setRut('empresa-rut', data.empresaRut);
            setText('empresa-rep-nombre', data.empresaRepNombre);
            setRut('empresa-rep-rut', data.empresaRepRut);
            setText('empresa-domicilio', data.empresaDomicilio);
            setText('empresa-ciudad', data.empresaCiudad);

            setText('trabajador-nombre', data.trabajadorNombre);
            setRut('trabajador-rut', data.trabajadorRut);
            setText('trabajador-cargo', data.trabajadorCargo);
            setText('trabajador-domicilio', data.trabajadorDomicilio);
            setText('trabajador-ciudad', data.trabajadorCiudad);

            setText('fecha-inicio', data.fechaInicio);
            setText('fecha-termino', data.fechaTermino);
            setText('fecha-pago', data.fechaPago);
            setText('causal-select', data.causal);

            setMoney('sueldo-base', data.sueldoBase);
            setMoney('gratificacion', data.gratificacion);
            setMoney('asignaciones', data.asignaciones);
            setMoney('promedio-variables', data.promedioVariables);
            setText('vacaciones-pendientes', data.vacacionesPendientes);

            setText('afc-tipo', data.afcTipo);
            setMoney('afc-monto-exacto', data.afcMontoExacto);
            setMoney('descuento-anticipos', data.descuentoAnticipos);
            setMoney('descuento-prestamos', data.descuentoPrestamos);
            setMoney('descuento-alimentos', data.descuentoAlimentos);

            setText('forma-pago', data.formaPago);
            setText('banco-detalle', data.bancoDetalle);

            if (data.avisoPrevio !== undefined) {
                const el = document.getElementById('aviso-previo');
                if (el) el.checked = !!data.avisoPrevio;
            }
            if (data.isExtremeZone !== undefined) {
                const el = document.getElementById('zona-extrema');
                if (el) el.checked = !!data.isExtremeZone;
            }
        } catch (e) {
            console.warn('No se pudo cargar borrador local', e);
        }
    }

    // Pre-cargar datos desde URL o localStorage si viene de la calculadora general o retorna de la pasarela
    function loadFromUrlOrStorage() {
        // 1. Cargar borrador guardado en el navegador si existe
        loadDraftFromStorage();

        // 2. Parámetros de URL
        const params = new URLSearchParams(window.location.search);

        const getVal = (paramKey, defaultVal = '') => {
            return params.get(paramKey) || localStorage.getItem('fini_' + paramKey) || defaultVal;
        };

        const setTextIfPresent = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && !isBracketedToken(val)) el.value = val;
        };

        const setMoneyIfPresent = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && !isBracketedToken(val)) {
                const num = parseFloat(String(val).replace(/[^0-9]/g, ''));
                if (!isNaN(num)) el.value = num.toLocaleString('es-CL');
            }
        };

        setTextIfPresent('fecha-inicio', getVal('startDate'));
        setTextIfPresent('fecha-termino', getVal('endDate'));
        setMoneyIfPresent('sueldo-base', getVal('baseSalary'));
        setMoneyIfPresent('gratificacion', getVal('gratification'));
        setMoneyIfPresent('asignaciones', getVal('assignments'));
        setMoneyIfPresent('promedio-variables', getVal('variableAverage'));
        setTextIfPresent('vacaciones-pendientes', getVal('vacationDaysPending'));
        
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

        // 3. Verificar si retorna con pago exitoso desde Flow o si tiene token válido para este trabajador
        const isPaidUrl = params.get('pago') === 'exito' || params.get('status') === 'approved' || params.get('status') === '2' || params.get('paid') === 'true';

        if (isPaidUrl) {
            setTimeout(() => {
                applyPaymentSuccess(false, true);
            }, 300);
        } else if (checkUnlockStatus(getRawFormData())) {
            setTimeout(() => {
                applyPaymentSuccess(false, false);
            }, 300);
        } else if (params.get('pago') === 'fallo' || params.get('status') === 'rejected' || params.get('status') === '3' || params.get('status') === '4') {
            setTimeout(() => {
                alert('El pago no fue completado o fue cancelado. Tu borrador de finiquito se encuentra guardado para que puedas volver a intentar cuando lo desees.');
            }, 500);
        }
    }

    // Comprobar si el finiquito actual está desbloqueado legítimamente (48 horas y mismo RUT)
    function checkUnlockStatus(formData) {
        try {
            const raw = localStorage.getItem('fini_unlock_payload');
            if (!raw) return false;
            const payload = JSON.parse(raw);
            if (!payload || !payload.expiresAt || !payload.trabajadorRut) return false;

            // 1. Validar expiración de 48 horas
            const now = Date.now();
            if (now > payload.expiresAt) {
                localStorage.removeItem('fini_unlock_payload');
                localStorage.removeItem('fini_paid_token');
                return false;
            }

            // 2. Validar que corresponda al mismo trabajador
            const cleanCurrent = (formData.trabajadorRut || '').replace(/[^0-9kK]/g, '').toUpperCase();
            const cleanPaid = (payload.trabajadorRut || '').replace(/[^0-9kK]/g, '').toUpperCase();

            if (cleanCurrent.length >= 7 && cleanPaid.length >= 7 && cleanCurrent !== cleanPaid) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    // Bloquear nuevamente el documento si se cambia a otro trabajador
    function lockDocument() {
        state.isPaid = false;
        document.body.classList.remove('paid-unlocked');

        const printArea = document.getElementById('notary-print-area');
        const docBody = document.getElementById('notary-document-body');
        if (printArea) printArea.classList.add('protected-preview', 'select-none');
        if (docBody) docBody.classList.add('protected-preview', 'select-none');

        // Restaurar overlay de marca de agua si no existe
        if (!document.getElementById('doc-watermark-overlay') && printArea) {
            const wmOverlay = document.createElement('div');
            wmOverlay.className = 'watermark-overlay';
            wmOverlay.id = 'doc-watermark-overlay';
            wmOverlay.innerHTML = `
                <div class="watermark-stamp-container">
                    <div class="watermark-stamp-box">
                        <span class="stamp-badge">Cálculo Laboral Chile</span>
                        <div class="stamp-title">VISTA PREVIA</div>
                        <div class="stamp-subtitle">DOCUMENTO OFICIAL NO VÁLIDO PARA FIRMA NOTARIAL</div>
                        <button type="button" id="btn-watermark-unlock" class="stamp-cta">
                            <span class="material-icons text-sm" aria-hidden="true">lock_open</span>
                            Desbloquear Word + PDF ($12.990)
                        </button>
                    </div>
                </div>
            `;
            printArea.prepend(wmOverlay);
            document.getElementById('btn-watermark-unlock')?.addEventListener('click', () => {
                document.getElementById('payment-modal')?.classList.remove('hidden');
            });
        }

        const unlockBar = document.getElementById('unlock-status-bar');
        if (unlockBar) unlockBar.innerHTML = '';
    }

    // Recalcular montos y actualizar la plantilla notarial
    function updateAll() {
        const rawData = getRawFormData();
        const displayData = getDisplayFormData(rawData);
        const calcData = calculateFiniquito(rawData);
        state.calcResult = calcData;

        // Validar vigencia de 48 horas y coincidencia de RUT
        const isLegitUnlocked = checkUnlockStatus(rawData);
        if (state.isPaid && !isLegitUnlocked) {
            lockDocument();
        } else if (!state.isPaid && isLegitUnlocked) {
            applyPaymentSuccess(false, false);
        }

        renderSummary(calcData);
        renderNotaryDocument(displayData, calcData);
        saveDraftToStorage();
    }

    // Extraer datos brutos del formulario (solo lo que el usuario ingresó)
    function getRawFormData() {
        const getV = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            const val = el.value.trim();
            return isBracketedToken(val) ? '' : val;
        };
        const getN = (id) => {
            const el = document.getElementById(id);
            if (!el) return 0;
            const raw = el.value || '0';
            return parseFloat(raw.replace(/[^0-9]/g, '')) || 0;
        };
        const getChecked = (id) => document.getElementById(id)?.checked || false;

        return {
            empresaRazon: getV('empresa-razon'),
            empresaRut: getV('empresa-rut'),
            empresaRepNombre: getV('empresa-rep-nombre'),
            empresaRepRut: getV('empresa-rep-rut'),
            empresaDomicilio: getV('empresa-domicilio'),
            empresaCiudad: getV('empresa-ciudad') || 'Santiago',

            trabajadorNombre: getV('trabajador-nombre'),
            trabajadorRut: getV('trabajador-rut'),
            trabajadorCargo: getV('trabajador-cargo'),
            trabajadorDomicilio: getV('trabajador-domicilio'),
            trabajadorCiudad: getV('trabajador-ciudad') || 'Santiago',

            fechaInicio: getV('fecha-inicio') || '2023-03-01',
            fechaTermino: getV('fecha-termino') || '2026-09-19',
            fechaPago: getV('fecha-pago') || '2026-09-19',
            causal: getV('causal-select') || '161',

            sueldoBase: getN('sueldo-base'),
            gratificacion: getN('gratificacion'),
            asignaciones: getN('asignaciones'),
            promedioVariables: getN('promedio-variables'),
            vacacionesPendientes: parseFloat(document.getElementById('vacaciones-pendientes')?.value) || 0,
            avisoPrevio: getChecked('aviso-previo'),
            isExtremeZone: getChecked('zona-extrema'),

            afcTipo: getV('afc-tipo') || 'estimado',
            afcMontoExacto: getN('afc-monto-exacto'),
            descuentoAnticipos: getN('descuento-anticipos'),
            descuentoPrestamos: getN('descuento-prestamos'),
            descuentoAlimentos: getN('descuento-alimentos'),

            formaPago: getV('forma-pago') || 'transferencia',
            bancoDetalle: getV('banco-detalle') || 'BancoEstado Cuenta RUT'
        };
    }

    // Datos para vista previa del documento legal (con textos de reemplazo solo para la vista previa notarial)
    function getDisplayFormData(raw) {
        return {
            ...raw,
            empresaRazon: raw.empresaRazon || '[Razón Social del Empleador]',
            empresaRut: raw.empresaRut || '[RUT Empleador]',
            empresaRepNombre: raw.empresaRepNombre || '[Nombre del Representante Legal]',
            empresaRepRut: raw.empresaRepRut || '[RUT Representante]',
            empresaDomicilio: raw.empresaDomicilio || '[Domicilio del Empleador]',
            empresaCiudad: raw.empresaCiudad || 'Santiago',

            trabajadorNombre: raw.trabajadorNombre || '[Nombre Completo del Trabajador]',
            trabajadorRut: raw.trabajadorRut || '[RUT del Trabajador]',
            trabajadorCargo: raw.trabajadorCargo || '[Cargo u Oficio]',
            trabajadorDomicilio: raw.trabajadorDomicilio || '[Domicilio del Trabajador]',
            trabajadorCiudad: raw.trabajadorCiudad || 'Santiago',

            fechaInicio: raw.fechaInicio || '2023-03-01',
            fechaTermino: raw.fechaTermino || '2026-09-19',
            fechaPago: raw.fechaPago || '2026-09-19',
            causal: raw.causal || '161',

            formaPago: raw.formaPago || 'transferencia',
            bancoDetalle: raw.bancoDetalle || 'cuenta bancaria informada por el trabajador'
        };
    }

    // Compatibilidad para funciones secundarias
    function getFormData() {
        return getDisplayFormData(getRawFormData());
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
            startDate: formData.fechaInicio || '2023-03-01',
            endDate: formData.fechaTermino || '2026-09-19',
            baseSalary: formData.sueldoBase || 0,
            gratification: formData.gratificacion || 0,
            assignments: formData.asignaciones || 0,
            variableAverage: formData.promedioVariables || 0,
            vacationDaysPending: formData.vacacionesPendientes || 0,
            cause: formData.causal || '161',
            noticeGiven: !!formData.avisoPrevio,
            simulateAFC: simulateAfc,
            afcExactAmount: afcExact,
            isExtremeZone: !!formData.isExtremeZone
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
            document.getElementById('btn-primary-checkout'),
            document.getElementById('btn-watermark-unlock')
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

                if (emailInput && emailInput.value) {
                    localStorage.setItem('fini_customer_email', emailInput.value.trim());
                }

                // Guardar borrador completo en el navegador antes de salir a pagar
                saveDraftToStorage();

                // Si hay URL de pasarela externa configurada (Flow, Webpay, MercadoPago), redirigir directamente
                if (PAYMENT_GATEWAY_URL && PAYMENT_GATEWAY_URL.trim().length > 0) {
                    confirmPayBtn.disabled = true;
                    confirmPayBtn.innerHTML = `
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Redirigiendo a pasarela segura...
                    `;
                    window.location.href = PAYMENT_GATEWAY_URL;
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

                // Simular validación con éxito inmediato si no hay gateway configurado
                setTimeout(() => {
                    applyPaymentSuccess(true, true);
                }, 1200);
            });
        }
    }

    // Despacho de finiquito oficial (.doc) al correo electrónico del comprador
    let hasSentEmail = false;

    async function dispatchFiniquitoEmail(formData, calcData, forceEmail = null) {
        const email = forceEmail || localStorage.getItem('fini_customer_email') || document.getElementById('checkout-email')?.value?.trim();
        if (!email || !email.includes('@')) return;

        if (!forceEmail && hasSentEmail) return;
        if (!forceEmail) hasSentEmail = true;

        const docBody = document.getElementById('notary-document-body');
        const htmlContent = docBody ? docBody.innerHTML : '';

        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token') || 'flow';

            const resp = await fetch('/api/send-finiquito', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    empresaRazon: formData.empresaRazon,
                    empresaRut: formData.empresaRut,
                    trabajadorNombre: formData.trabajadorNombre,
                    trabajadorRut: formData.trabajadorRut,
                    saldoLiquido: calcData?.saldoLiquidoFinal || 0,
                    htmlContent,
                    token
                })
            });

            if (resp.ok) {
                alert(`✅ ¡Copia de respaldo enviada exitosamente a ${email} con el documento Word adjunto!`);
            }
        } catch (e) {
            console.warn('Error al despachar finiquito por correo:', e);
        }
    }

    // Aplicar desbloqueo exitoso de finiquito oficial con regla de 48 horas
    function applyPaymentSuccess(immediateDownload = true, sendEmail = true) {
        state.isPaid = true;

        const formData = getFormData();
        const calcData = state.calcResult || calculateFiniquito(formData);

        // Guardar payload de desbloqueo válido por 48 horas para este trabajador
        const unlockPayload = {
            trabajadorRut: formData.trabajadorRut,
            trabajadorNombre: formData.trabajadorNombre,
            empresaRazon: formData.empresaRazon,
            unlockedAt: Date.now(),
            expiresAt: Date.now() + (48 * 60 * 60 * 1000) // 48 horas exactas
        };
        try {
            localStorage.setItem('fini_unlock_payload', JSON.stringify(unlockPayload));
            localStorage.setItem('fini_paid_token', 'true');
        } catch (e) {}

        const modal = document.getElementById('payment-modal');
        if (modal) modal.classList.add('hidden');

        // Remover marcas de agua de la vista previa
        const watermarks = document.querySelectorAll('.watermark-overlay');
        watermarks.forEach(wm => wm.remove());

        // Desbloquear selección y copia en la vista previa
        const printArea = document.getElementById('notary-print-area');
        const docBody = document.getElementById('notary-document-body');
        if (printArea) printArea.classList.remove('protected-preview', 'select-none');
        if (docBody) docBody.classList.remove('protected-preview', 'select-none');
        document.body.classList.add('paid-unlocked');

        // Ocultar toast si estaba visible
        hideCopyBlockedToast();

        // Despachar finiquito por correo automáticamente si corresponde
        if (sendEmail) {
            dispatchFiniquitoEmail(formData, calcData);
        }

        // Cambiar estados de botones de descarga
        const unlockBar = document.getElementById('unlock-status-bar');
        if (unlockBar) {
            const customerEmail = localStorage.getItem('fini_customer_email') || '';
            unlockBar.innerHTML = `
                <div class="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl shadow-sm animate-in fade-in duration-200 space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
                        <div class="flex items-center space-x-2">
                            <span class="material-icons text-emerald-600 text-2xl">verified</span>
                            <div>
                                <span class="text-xs font-bold block text-emerald-950">¡Finiquito Notarial Oficial Desbloqueado!</span>
                                <span class="text-[11px] text-emerald-700">Garantía activa de 48 horas para don(ña) <strong>${escapeHtml(formData.trabajadorNombre)}</strong> (RUT: ${escapeHtml(formData.trabajadorRut)}).</span>
                            </div>
                        </div>
                        <button type="button" id="btn-reset-new-finiquito" class="text-[11px] text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer">
                            Crear finiquito para otro trabajador
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="quick-pdf" class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs">picture_as_pdf</span> Descargar PDF Oficial
                        </button>
                        <button type="button" id="quick-word" class="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs">description</span> Descargar Word (.docx)
                        </button>
                        <button type="button" id="quick-resend-email" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs text-sky-600">email</span> ${customerEmail ? 'Reenviar a mi correo' : 'Enviar a mi correo'}
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('quick-pdf')?.addEventListener('click', downloadPDF);
            document.getElementById('quick-word')?.addEventListener('click', downloadWord);
            document.getElementById('quick-resend-email')?.addEventListener('click', () => {
                const targetEmail = prompt('Ingresa el correo al que deseas enviar el documento Word editable:', customerEmail || '');
                if (targetEmail && targetEmail.includes('@')) {
                    localStorage.setItem('fini_customer_email', targetEmail.trim());
                    dispatchFiniquitoEmail(formData, calcData, targetEmail.trim());
                }
            });
            document.getElementById('btn-reset-new-finiquito')?.addEventListener('click', () => {
                if (confirm('¿Deseas iniciar un nuevo finiquito para otro trabajador? El documento volverá a su estado protegido con marcas de agua.')) {
                    localStorage.removeItem('fini_unlock_payload');
                    localStorage.removeItem('fini_paid_token');
                    localStorage.removeItem('fini_draft_payload');
                    window.location.href = window.location.pathname;
                }
            });
        }

        // Abrir diálogo de descarga si se solicitó
        if (immediateDownload) {
            downloadPDF();
        }
    }

    // Lógica Anti-Copia para proteger la vista previa
    let toastTimeout = null;

    function showCopyBlockedToast() {
        const toast = document.getElementById('copy-blocked-toast');
        if (!toast) return;

        toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            hideCopyBlockedToast();
        }, 4500);
    }

    function hideCopyBlockedToast() {
        const toast = document.getElementById('copy-blocked-toast');
        if (!toast) return;
        toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }

    function setupCopyProtection() {
        const printArea = document.getElementById('notary-print-area');
        if (!printArea) return;

        // 1. Bloquear clic derecho (menú contextual) sobre la vista previa
        printArea.addEventListener('contextmenu', (e) => {
            if (!state.isPaid) {
                e.preventDefault();
                showCopyBlockedToast();
            }
        });

        // 2. Bloquear eventos copy y cut sobre el documento
        printArea.addEventListener('copy', (e) => {
            if (!state.isPaid) {
                e.preventDefault();
                e.stopPropagation();
                showCopyBlockedToast();
            }
        });

        printArea.addEventListener('cut', (e) => {
            if (!state.isPaid) {
                e.preventDefault();
                e.stopPropagation();
                showCopyBlockedToast();
            }
        });

        // 3. Bloquear inicio de selección y arrastre con ratón
        printArea.addEventListener('selectstart', (e) => {
            if (!state.isPaid) {
                e.preventDefault();
            }
        });

        printArea.addEventListener('dragstart', (e) => {
            if (!state.isPaid) {
                e.preventDefault();
            }
        });

        // 4. Atajos de teclado en la ventana (Ctrl+C, Ctrl+X, Ctrl+P)
        window.addEventListener('keydown', (e) => {
            if (state.isPaid) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            if (!isCtrl) return;

            // Bloquear Ctrl+P para evitar imprimir directamente saltándose el pago
            if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                downloadPDF();
                return;
            }

            // Bloquear Ctrl+C o Ctrl+X si están copiando en el área de vista previa
            if (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X') {
                const activeEl = document.activeElement;
                // Si el foco está en un input o select del formulario, permitir copiar sus propios datos
                const isFormInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
                if (isFormInput) return;

                const selection = window.getSelection();
                const textSelected = selection ? selection.toString() : '';
                const isInPrintArea = printArea.contains(activeEl) || (selection && selection.anchorNode && printArea.contains(selection.anchorNode));

                if (isInPrintArea || textSelected.length > 0) {
                    e.preventDefault();
                    showCopyBlockedToast();
                }
            }
        });

        // 5. Botones del Toast
        const toastCloseBtn = document.getElementById('toast-close-btn');
        if (toastCloseBtn) {
            toastCloseBtn.addEventListener('click', hideCopyBlockedToast);
        }

        const toastUnlockBtn = document.getElementById('toast-unlock-btn');
        if (toastUnlockBtn) {
            toastUnlockBtn.addEventListener('click', () => {
                hideCopyBlockedToast();
                const modal = document.getElementById('payment-modal');
                if (modal) modal.classList.remove('hidden');
            });
        }
    }

    // Exportador a PDF Nativo
    function downloadPDF() {
        if (!state.isPaid) {
            const modal = document.getElementById('payment-modal');
            if (modal) modal.classList.remove('hidden');
            return;
        }
        // Ejecutar impresión del navegador con estilos optimizados para papel Notarial Carta/Oficio
        window.print();
    }

    // Exportador a Word (.doc / .docx compatible)
    function downloadWord() {
        if (!state.isPaid) {
            const modal = document.getElementById('payment-modal');
            if (modal) modal.classList.remove('hidden');
            return;
        }
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
