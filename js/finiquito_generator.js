/**
 * Generador de Finiquito para Notaría (Chile 2026)
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

    // Pago del generador ($12.990 CLP) por la API de Flow
    // Flow: Webpay Plus, Servipag, Mach y tarjetas
    // El pago se crea en el servidor (/api/checkout, producto 'finiquito') y Flow lo confirma;
    // el desbloqueo llega firmado en la URL de retorno (ver js/checkout_consent.js).
    const unlockApi = () => window.CLCheckout || null;

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

        // Hasta 999.999 (sirve también para contar millones: "mil doscientos millones")
        function belowMillion(x) {
            const th = Math.floor(x / 1000), u = x % 1000, w = [];
            if (th === 1) w.push('mil');
            else if (th > 1) w.push(`${convertGroup(th)} mil`);
            if (u > 0) w.push(convertGroup(u));
            return w.join(' ');
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
                parts.push(`${belowMillion(millions)} millones`);
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

        const text = (Number(num) < 0 ? 'menos ' : '') + parts.join(' ').trim();

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
        // Recalcular cuando llegan los indicadores del día (UF y UTM para el impuesto)
        window.addEventListener('indicatorsUpdated', () => updateAll());
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
            'fecha-inicio', 'fecha-termino', 'fecha-pago', 'causal-select', 'causal-160',
            'sueldo-base', 'gratificacion', 'asignaciones', 'promedio-variables',
            'vacaciones-pendientes', 'aviso-previo', 'zona-extrema', 'incluir-dias', 'afp-select',
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
            setText('causal-160', data.causal160);

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
            if (data.incluirDias !== undefined) {
                const el = document.getElementById('incluir-dias');
                if (el) el.checked = !!data.incluirDias;
            }
            setText('afp-select', data.afp);
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
            // La calculadora manda 159_2; el selector usa 159-2. Si no existe, se avisa en vez de usar 161.
            const causalEl = document.getElementById('causal-select');
            const valor = String(params.get('cause')).replace('_', '-');
            if (causalEl) {
                if (Array.from(causalEl.options).some(o => o.value === valor)) {
                    causalEl.value = valor;
                } else {
                    alert('No reconocimos la causal de término que venía de la calculadora. Elígela en el paso 3.');
                }
            }
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

        // 3. Retorno desde Flow: el servidor firma el desbloqueo solo si el pago está confirmado
        const vieneDeFlow = params.get('p') === 'finiquito' && params.has('sig');
        if (unlockApi()) {
            unlockApi().unlockFromUrl('finiquito').then((u) => {
                if (u) applyPaymentSuccess(false, vieneDeFlow);
            });
        }
        if (params.get('pago') === 'rechazado') {
            setTimeout(() => {
                alert('El pago no se completó y no se hizo ningún cargo. Tu borrador de finiquito quedó guardado para que lo intentes de nuevo cuando quieras.');
            }, 500);
        }
    }

    // Comprobar si el finiquito está desbloqueado (firma del servidor vigente, 48 horas)
    function checkUnlockStatus(formData) {
        try {
            // Sin desbloqueo firmado por el servidor (o ya vencido) no hay documento limpio
            if (!unlockApi() || !unlockApi().storedUnlock('finiquito')) return false;
            const raw = localStorage.getItem('fini_unlock_payload');
            if (!raw) return false;
            const payload = JSON.parse(raw);
            if (!payload || !payload.expiresAt) return false;

            // 1. Validar expiración de 48 horas
            const now = Date.now();
            if (now > payload.expiresAt) {
                localStorage.removeItem('fini_unlock_payload');
                localStorage.removeItem('fini_paid_token');
                return false;
            }

            // El acceso dura 48 horas en este navegador y permite corregir cualquier dato, RUT incluido
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
                        <div class="stamp-subtitle">DESBLOQUEA PARA DESCARGAR</div>
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
        const is161 = rawData.causal === '161';
        const box160 = document.getElementById('causal-160-box');
        if (box160) box160.style.display = rawData.causal === '160' ? '' : 'none';
        const avisoBox = document.getElementById('aviso-previo-box');
        const afcBox = document.getElementById('afc-config-box');
        if (avisoBox) avisoBox.style.display = is161 ? 'block' : 'none';
        if (afcBox) afcBox.style.display = is161 ? 'block' : 'none';
        const prevBox = document.getElementById('prevision-box');
        if (prevBox) prevBox.style.display = rawData.incluirDias ? '' : 'none';
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
            causal160: getV('causal-160'),

            sueldoBase: getN('sueldo-base'),
            gratificacion: getN('gratificacion'),
            asignaciones: getN('asignaciones'),
            promedioVariables: getN('promedio-variables'),
            vacacionesPendientes: parseFloat(document.getElementById('vacaciones-pendientes')?.value) || 0,
            avisoPrevio: getChecked('aviso-previo'),
            isExtremeZone: getChecked('zona-extrema'),
            incluirDias: document.getElementById('incluir-dias') ? getChecked('incluir-dias') : true,
            afp: getV('afp-select') || 'Modelo',

            afcTipo: getV('afc-tipo') || 'estimado',
            afcMontoExacto: getN('afc-monto-exacto'),
            descuentoAnticipos: getN('descuento-anticipos'),
            descuentoPrestamos: getN('descuento-prestamos'),
            descuentoAlimentos: getN('descuento-alimentos'),

            formaPago: getV('forma-pago') || 'transferencia',
            bancoDetalle: getV('banco-detalle')
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

    // UF del último día del mes anterior al pago, para el tope de 90 UF (art. 172 inc. final).
    // Se busca en el historial de indicators.js; si no está, se pide a mindicador.cl y se recalcula.
    const ufCache = {};
    function ufParaTope(fechaPago) {
        const fecha = (typeof FiniquitoCalculator !== 'undefined' && FiniquitoCalculator.ufCapDate)
            ? FiniquitoCalculator.ufCapDate(fechaPago) : null;
        const actual = (typeof CONSTANTS !== 'undefined' && CONSTANTS.UF) || 0;
        if (!fecha) return actual;
        if (ufCache[fecha]) return ufCache[fecha];
        const series = [];
        try {
            if (typeof IndicatorsService !== 'undefined' && IndicatorsService.BASELINE_DATA) series.push(...IndicatorsService.BASELINE_DATA.uf);
            const hist = JSON.parse(localStorage.getItem('econIndicatorsHistory.v1') || 'null');
            if (hist && Array.isArray(hist.uf)) series.push(...hist.uf);
        } catch (e) {}
        const hit = series.find(x => x && String(x.fecha).slice(0, 10) === fecha);
        if (hit) return (ufCache[fecha] = Number(hit.valor));
        if (ufCache[fecha] === undefined && fecha <= new Date().toISOString().slice(0, 10)) {
            ufCache[fecha] = 0;
            const [y, m, d] = fecha.split('-');
            fetch(`https://mindicador.cl/api/uf/${d}-${m}-${y}`)
                .then(r => r.json())
                .then(j => {
                    const v = j && j.serie && j.serie[0] && Number(j.serie[0].valor);
                    if (v) { ufCache[fecha] = v; updateAll(); }
                })
                .catch(() => {});
        }
        return actual;
    }

    // Cotizaciones e impuesto del sueldo de los días trabajados (paga el trabajador; los retiene el empleador)
    function descuentosLegalesDias(pend, formData) {
        const vacio = { afp: 0, salud: 0, cesantia: 0, impuesto: 0, total: 0, afpNombre: formData.afp || 'Modelo' };
        if (!pend || !pend.total || typeof ForensicSalaryCalculator === 'undefined') return vacio;
        const plazoFijo = formData.causal === '159-4' || formData.causal === '159-5';
        const d = new ForensicSalaryCalculator({
            baseSalary: pend.propBase,
            gratificationType: 'manual',
            gratificationManual: pend.propGrat,
            bonusAmount: pend.propVariable,
            afpName: formData.afp || 'Modelo',
            healthSystem: 'fonasa',
            contractType: plazoFijo ? 'plazo_fijo' : 'indefinido'
        }).calculate();
        if (!d || !d.details) return vacio;
        const x = d.details;
        return {
            afp: x.afpAmount, salud: x.healthAmount, cesantia: x.afcAmount, impuesto: x.taxAmount,
            total: x.afpAmount + x.healthAmount + x.afcAmount + x.taxAmount,
            afpNombre: formData.afp || 'Modelo'
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
        const fechaPago = formData.fechaPago || formData.fechaTermino || '2026-09-19';

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
            isExtremeZone: !!formData.isExtremeZone,
            enablePending: formData.incluirDias !== false,
            // Tope de 90 UF con la UF del último día del mes anterior al pago (art. 172)
            ufValue: ufParaTope(fechaPago)
        });

        const res = calculator.calculate();
        const prevision = descuentosLegalesDias(res.pendingRemuneration, formData);

        // Descuentos adicionales voluntarios o judiciales
        const totalDescuentosAdicionales = (formData.descuentoAnticipos || 0) +
            (formData.descuentoPrestamos || 0) +
            (formData.descuentoAlimentos || 0);

        // Imputación del aporte AFC (solo a la indemnización por años de servicio)
        const afcDescuento = res.afc && res.afc.applied ? res.afc.total : 0;
        const totalDescuentos = afcDescuento + prevision.total + totalDescuentosAdicionales;

        // Total haberes brutos
        const totalHaberes = (res.yearsOfServiceIndemnity?.total || 0) +
            (res.noticeIndemnity?.total || 0) +
            (res.vacationIndemnity?.total || 0) +
            (res.pendingRemuneration?.total || 0);

        // Saldo líquido final a pagar (si los descuentos superan los haberes se avisa en pantalla)
        const saldoBruto = totalHaberes - totalDescuentos;
        const saldoLiquidoFinal = Math.max(0, saldoBruto);

        return {
            ...res,
            totalHaberes,
            saldoNegativo: saldoBruto < 0,
            prevision,
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
        setT('resumen-descuentos', '-' + formatMoney(calc.totalDescuentos || 0));
        setT('resumen-liquido-pagar', formatMoney(calc.saldoLiquidoFinal || 0));

        // Letras resumen
        setT('resumen-liquido-palabras', numberToWords(calc.saldoLiquidoFinal || 0));

        const alerta = document.getElementById('calc-alert');
        if (alerta) {
            const msg = calc.error
                ? calc.error + ' Revisa las fechas.'
                : (calc.saldoNegativo ? 'Los descuentos superan los haberes: revisa los montos antes de firmar.' : '');
            alerta.textContent = msg;
            alerta.classList.toggle('hidden', !msg);
        }
    }

    // Renderizar la plantilla notarial viva
    function renderNotaryDocument(f, c) {
        if (!c) return;

        // Causal legal y su fundamento (los hechos quedan en la carta de aviso, no se inventan aquí)
        const CAUSALES_160 = {
            '160-1a': 'Nº 1 letra a) (falta de probidad del trabajador en el desempeño de sus funciones)',
            '160-1b': 'Nº 1 letra b) (conductas de acoso sexual)',
            '160-1c': 'Nº 1 letra c) (vías de hecho ejercidas por el trabajador)',
            '160-1d': 'Nº 1 letra d) (injurias proferidas por el trabajador al empleador)',
            '160-1e': 'Nº 1 letra e) (conducta inmoral del trabajador que afecta a la empresa)',
            '160-1f': 'Nº 1 letra f) (conductas de acoso laboral)',
            '160-2': 'Nº 2 (negociaciones dentro del giro del negocio prohibidas por escrito en el contrato)',
            '160-3': 'Nº 3 (no concurrencia a sus labores sin causa justificada)',
            '160-4': 'Nº 4 (abandono del trabajo)',
            '160-5': 'Nº 5 (actos, omisiones o imprudencias temerarias que afectan la seguridad o la salud)',
            '160-6': 'Nº 6 (perjuicio material causado intencionalmente)',
            '160-7': 'Nº 7 (incumplimiento grave de las obligaciones que impone el contrato)'
        };
        const tt = 'el(la) Trabajador(a)';
        let causalTexto = '';
        let causalFundamento = '';
        if (f.causal === '161') {
            causalTexto = 'artículo 161 inciso primero del Código del Trabajo (necesidades de la empresa, establecimiento o servicio)';
            causalFundamento = `conforme a los hechos expresados en la comunicación escrita de término entregada a ${tt}`;
        } else if (f.causal === '159-1') {
            causalTexto = 'artículo 159 Nº 1 del Código del Trabajo (mutuo acuerdo de las partes)';
            causalFundamento = 'en virtud del acuerdo de ambas partes';
        } else if (f.causal === '159-2') {
            causalTexto = 'artículo 159 Nº 2 del Código del Trabajo (renuncia del trabajador)';
            causalFundamento = `en virtud de la renuncia presentada por ${tt}`;
        } else if (f.causal === '159-4') {
            causalTexto = 'artículo 159 Nº 4 del Código del Trabajo (vencimiento del plazo convenido en el contrato)';
            causalFundamento = 'por haber llegado el plazo convenido por las partes';
        } else if (f.causal === '159-5') {
            causalTexto = 'artículo 159 Nº 5 del Código del Trabajo (conclusión del trabajo o servicio que dio origen al contrato)';
            causalFundamento = 'por haber concluido la obra, faena o servicio que dio origen al contrato';
        } else {
            causalTexto = `artículo 160 ${CAUSALES_160[f.causal160] || '[Nº y letra de la causal]'} del Código del Trabajo`;
            causalFundamento = `conforme a los hechos expresados en la carta de despido entregada a ${tt}`;
        }
        const esDespido = !(f.causal === '159-1' || f.causal === '159-2');

        // Forma de pago texto legal
        const banco = escapeHtml(f.bancoDetalle);
        let formaPagoTexto = '';
        if (f.formaPago === 'transferencia') {
            formaPagoTexto = `mediante transferencia electrónica de fondos a la cuenta del(de la) Trabajador(a) (${banco})`;
        } else if (f.formaPago === 'cheque') {
            formaPagoTexto = `mediante cheque nominativo a nombre del(de la) Trabajador(a) (${banco})`;
        } else if (f.formaPago === 'vale-vista') {
            formaPagoTexto = 'mediante vale vista bancario a nombre del(de la) Trabajador(a)';
        } else {
            formaPagoTexto = 'en dinero efectivo';
        }
        const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

        // Construir tabla de Haberes HTML
        let haberesRows = '';
        if (c.yearsOfServiceIndemnity && c.yearsOfServiceIndemnity.applied) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Indemnización por años de servicio (${plural(c.serviceTime.cappedIndemnityYears, 'año', 'años')}, art. 163)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.yearsOfServiceIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.noticeIndemnity && c.noticeIndemnity.applied) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Indemnización sustitutiva del aviso previo (art. 161 inc. 2º y art. 162)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.noticeIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.vacationIndemnity && c.vacationIndemnity.total > 0) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Feriado legal y proporcional (${String(c.vacationIndemnity.totalCalendarDays).replace('.', ',')} días corridos, arts. 67 y 73)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.vacationIndemnity.total)}</td>
                </tr>
            `;
        }
        if (c.pendingRemuneration && c.pendingRemuneration.total > 0) {
            haberesRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Remuneración bruta por días trabajados en el mes (${c.pendingRemuneration.daysWorked} días)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.pendingRemuneration.total)}</td>
                </tr>
            `;
        }
        haberesRows += `
            <tr class="bg-gray-50 font-semibold">
                <td class="py-1.5 px-2 border border-gray-300">TOTAL HABERES</td>
                <td class="py-1.5 px-2 border border-gray-300 text-right font-mono">${formatMoney(c.totalHaberes)}</td>
            </tr>
        `;

        // Construir tabla de Descuentos HTML
        let descuentosRows = '';
        if (c.afcDescuento > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Imputación del aporte del empleador a la cuenta individual de cesantía (art. 13 Ley Nº 19.728)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(c.afcDescuento)}</td>
                </tr>
            `;
        }
        const pv = c.prevision || {};
        [
            [pv.afp, `Cotización AFP ${escapeHtml(pv.afpNombre || '')} sobre los días trabajados`],
            [pv.salud, 'Cotización de salud (7%) sobre los días trabajados'],
            [pv.cesantia, 'Seguro de cesantía del trabajador (0,6%) sobre los días trabajados'],
            [pv.impuesto, 'Impuesto único de segunda categoría sobre los días trabajados']
        ].forEach(([monto, texto]) => {
            if (monto > 0) {
                descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">${texto}</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(monto)}</td>
                </tr>
            `;
            }
        });
        if (f.descuentoAnticipos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Descuento por anticipos de remuneración</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoAnticipos)}</td>
                </tr>
            `;
        }
        if (f.descuentoPrestamos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Descuento de crédito social de Caja de Compensación (CCAF)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoPrestamos)}</td>
                </tr>
            `;
        }
        if (f.descuentoAlimentos > 0) {
            descuentosRows += `
                <tr>
                    <td class="py-1 px-2 border border-gray-300">Retención judicial de pensión de alimentos (art. 13 Ley Nº 14.908)</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(f.descuentoAlimentos)}</td>
                </tr>
            `;
        }

        if (c.totalDescuentos === 0) {
            descuentosRows = `
                <tr>
                    <td class="py-1 px-2 border border-gray-300 italic text-gray-500">Sin descuentos</td>
                    <td class="py-1 px-2 border border-gray-300 text-right font-mono">$0</td>
                </tr>
            `;
        }
        descuentosRows += `
            <tr class="bg-gray-50 font-semibold">
                <td class="py-1.5 px-2 border border-gray-300">TOTAL DESCUENTOS</td>
                <td class="py-1.5 px-2 border border-gray-300 text-right font-mono text-red-700">-${formatMoney(c.totalDescuentos)}</td>
            </tr>
        `;

        // Inyectar HTML en la previsualización del documento
        const docEl = document.getElementById('notary-document-body');
        if (!docEl) return;

        const st = c.serviceTime || { years: 0, months: 0, days: 0 };
        const montoAlimentos = f.descuentoAlimentos || 0;
        const clausulaSexto = esDespido
            ? `<strong><u>SEXTO:</u> COTIZACIONES PREVISIONALES.</strong> Para los efectos del artículo 162, inciso quinto y siguientes, del Código del Trabajo, la Empleadora declara que se encuentran íntegramente pagadas las cotizaciones previsionales y de seguridad social del(de la) Trabajador(a) devengadas hasta el último día del mes anterior al del término de los servicios, lo que acredita con los certificados de las instituciones respectivas, que se adjuntan y se exhiben al ministro de fe.`
            : `<strong><u>SEXTO:</u> COTIZACIONES PREVISIONALES.</strong> La Empleadora declara que se encuentran íntegramente pagadas las cotizaciones previsionales y de seguridad social del(de la) Trabajador(a) devengadas hasta el último día del mes anterior al del término de los servicios, lo que acredita con los certificados de las instituciones respectivas, que se adjuntan.`;
        const clausulaSeptimo = montoAlimentos > 0
            ? `<strong><u>SÉPTIMO:</u> PENSIÓN DE ALIMENTOS.</strong> Para los efectos del artículo 13 de la Ley Nº 14.908, modificado por la Ley Nº 21.389, la Empleadora declara que se encuentra sujeta a una orden judicial de retención de pensión de alimentos respecto del(de la) Trabajador(a), y que retuvo de las sumas de este finiquito <strong>${formatMoney(montoAlimentos)}</strong>, que entera en la cuenta ordenada por el tribunal, según los comprobantes que exhibe al ministro de fe.`
            : `<strong><u>SÉPTIMO:</u> PENSIÓN DE ALIMENTOS.</strong> Para los efectos del artículo 13 de la Ley Nº 14.908, modificado por la Ley Nº 21.389, la Empleadora declara que consultó el Registro Nacional de Deudores de Pensiones de Alimentos respecto del(de la) Trabajador(a) y que no se encuentra sujeta a una orden judicial de retención de pensión de alimentos respecto de él(ella).`;

        docEl.innerHTML = `
            <!-- Encabezado -->
            <div class="text-center pb-6 border-b border-gray-400">
                <h2 class="text-xl font-bold uppercase tracking-wider text-gray-900 font-serif">FINIQUITO DE CONTRATO DE TRABAJO</h2>
                <p class="text-xs uppercase text-gray-600 mt-1 font-serif">ARTÍCULO 177 DEL CÓDIGO DEL TRABAJO</p>
            </div>

            <!-- Comparecencia -->
            <div class="mt-6 text-justify text-sm leading-relaxed font-serif text-gray-900 space-y-4">
                <p>
                    En <strong>${escapeHtml(f.empresaCiudad)}</strong>, a <strong>${formatLegalDate(f.fechaPago)}</strong>, comparecen, por una parte, como empleadora, <strong>${escapeHtml(f.empresaRazon)}</strong>, RUT Nº <strong>${escapeHtml(f.empresaRut)}</strong>, con domicilio en <strong>${escapeHtml(f.empresaDomicilio)}</strong>, ${escapeHtml(f.empresaCiudad)}, representada por don/doña <strong>${escapeHtml(f.empresaRepNombre)}</strong>, cédula de identidad Nº <strong>${escapeHtml(f.empresaRepRut)}</strong>, en adelante <em>"la Empleadora"</em>; y, por la otra, don/doña <strong>${escapeHtml(f.trabajadorNombre)}</strong>, cédula de identidad Nº <strong>${escapeHtml(f.trabajadorRut)}</strong>, con domicilio en <strong>${escapeHtml(f.trabajadorDomicilio)}</strong>, ${escapeHtml(f.trabajadorCiudad)}, en adelante <em>"el(la) Trabajador(a)"</em>; quienes acuerdan el siguiente finiquito de contrato de trabajo:
                </p>

                <p>
                    <strong><u>PRIMERO:</u> RELACIÓN LABORAL.</strong> El(la) Trabajador(a) prestó servicios para la Empleadora desde el <strong>${formatLegalDate(f.fechaInicio)}</strong> hasta el <strong>${formatLegalDate(f.fechaTermino)}</strong>, como <strong>${escapeHtml(f.trabajadorCargo)}</strong>. La relación laboral tuvo una duración de <strong>${plural(st.years, 'año', 'años')}, ${plural(st.months, 'mes', 'meses')} y ${plural(st.days, 'día', 'días')}</strong>.
                </p>

                <p>
                    <strong><u>SEGUNDO:</u> TÉRMINO Y CAUSAL.</strong> El contrato de trabajo terminó el <strong>${formatLegalDate(f.fechaTermino)}</strong> por la causal del <strong>${causalTexto}</strong>, ${causalFundamento}.
                </p>

                <div>
                    <p class="mb-2">
                        <strong><u>TERCERO:</u> HABERES E INDEMNIZACIONES.</strong> Con motivo del término del contrato, la Empleadora liquida los siguientes haberes e indemnizaciones:
                    </p>
                    <table class="w-full text-xs border-collapse border border-gray-400 mt-2 mb-3 font-sans">
                        <thead>
                            <tr class="bg-gray-100 text-gray-800">
                                <th class="py-1 px-2 border border-gray-300 text-left">CONCEPTO</th>
                                <th class="py-1 px-2 border border-gray-300 text-right w-36">MONTO (CLP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${haberesRows}
                        </tbody>
                    </table>
                </div>

                <div>
                    <p class="mb-2">
                        <strong><u>CUARTO:</u> DESCUENTOS.</strong> De las sumas anteriores se descuentan los siguientes conceptos:
                    </p>
                    <table class="w-full text-xs border-collapse border border-gray-400 mt-2 mb-3 font-sans">
                        <thead>
                            <tr class="bg-gray-100 text-gray-800">
                                <th class="py-1 px-2 border border-gray-300 text-left">DESCUENTO</th>
                                <th class="py-1 px-2 border border-gray-300 text-right w-36">MONTO (CLP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${descuentosRows}
                        </tbody>
                    </table>
                </div>

                <div data-docx="recuadro" class="p-3 bg-gray-50 border border-gray-300 rounded">
                    <p>
                        <strong><u>QUINTO:</u> SALDO Y FORMA DE PAGO.</strong> Deducidos los descuentos, resulta un saldo líquido a favor del(de la) Trabajador(a) de <strong>${formatMoney(c.saldoLiquidoFinal)} (${numberToWords(c.saldoLiquidoFinal)})</strong>, que la Empleadora paga ${formaPagoTexto}, y que el(la) Trabajador(a) declara recibir en este acto, sin perjuicio de la reserva de derechos que formule.
                    </p>
                </div>

                <p>${clausulaSexto}</p>

                <p>${clausulaSeptimo}</p>

                <p>
                    <strong><u>OCTAVO:</u> PODER LIBERATORIO.</strong> Sin perjuicio de la reserva de derechos que el(la) Trabajador(a) formule en este instrumento, la que tendrá pleno valor, las partes declaran que con el pago del saldo señalado en la cláusula quinta quedan íntegramente pagados los conceptos detallados en las cláusulas tercera y cuarta, y que nada se adeudan por remuneraciones, feriado, horas extraordinarias ni indemnizaciones derivadas del contrato de trabajo y de su término, por lo que se otorgan el más amplio finiquito respecto de dichas materias. Este finiquito no comprende las cotizaciones previsionales y de seguridad social ni los derechos que la ley declara irrenunciables.
                </p>

                <p>
                    <strong><u>NOVENO:</u> EJEMPLARES.</strong> El presente finiquito se firma en tres ejemplares de igual tenor y fecha, quedando uno en poder del(de la) Trabajador(a), uno en poder de la Empleadora y el tercero a disposición del ministro de fe ante quien se ratifica, conforme al artículo 177 del Código del Trabajo.
                </p>
            </div>

            <!-- Reserva de derechos: antes de las firmas, con firma propia del trabajador -->
            <div data-docx="recuadro" class="mt-8 p-3 border border-dashed border-gray-400 text-xs text-gray-700 bg-gray-50/50 font-serif">
                <p class="font-bold uppercase text-gray-800 text-xs mb-1">Reserva de derechos del(de la) Trabajador(a) (artículo 177 del Código del Trabajo):</p>
                <p class="italic text-xs text-gray-500">[Escriba aquí de su puño y letra, antes de firmar, las materias que reserva. La reserva no impide recibir el pago de las sumas no discutidas. Si no formula reserva, cruce este espacio con una línea.]</p>
                <p class="text-xs text-gray-700 mt-6">Firma del(de la) Trabajador(a): ________________________________</p>
            </div>

            <!-- Firmas -->
            <div class="mt-12 pt-8 font-serif">
                <div data-docx="firmas" class="grid grid-cols-2 gap-8 text-center text-xs">
                    <div class="flex flex-col items-center">
                        <div class="w-48 border-b border-gray-900 mb-2"></div>
                        <p class="font-bold uppercase text-gray-900">${escapeHtml(f.empresaRazon)}</p>
                        <p class="text-gray-600">RUT: ${escapeHtml(f.empresaRut)}</p>
                        <p class="text-gray-600">p.p. ${escapeHtml(f.empresaRepNombre)}</p>
                        <p class="text-gray-500 text-xs">EMPLEADORA</p>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-48 border-b border-gray-900 mb-2"></div>
                        <p class="font-bold uppercase text-gray-900">${escapeHtml(f.trabajadorNombre)}</p>
                        <p class="text-gray-600">RUT: ${escapeHtml(f.trabajadorRut)}</p>
                        <p class="text-gray-500 text-xs">TRABAJADOR(A)</p>
                    </div>
                </div>

                <!-- Ratificación ante ministro de fe -->
                <div class="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
                    <p class="font-bold uppercase tracking-wider text-gray-800">RATIFICACIÓN ANTE MINISTRO DE FE</p>
                    <p class="mt-1">
                        Ratificó ante mí el presente finiquito don/doña <strong>${escapeHtml(f.trabajadorNombre)}</strong>, cédula de identidad Nº <strong>${escapeHtml(f.trabajadorRut)}</strong>, y lo firmó en representación de la Empleadora don/doña <strong>${escapeHtml(f.empresaRepNombre)}</strong>, cédula de identidad Nº <strong>${escapeHtml(f.empresaRepRut)}</strong>, quienes acreditaron su identidad. Doy fe.
                    </p>
                    <div class="mt-8 flex justify-center">
                        <div data-docx="linea" class="w-64 border-b border-gray-900 pb-1"></div>
                    </div>
                    <p class="text-gray-700 font-semibold mt-1">MINISTRO DE FE (artículo 177 del Código del Trabajo)</p>
                </div>
            </div>
        `;
    }

    // Datos mínimos para emitir el finiquito (se exigen antes de pagar y antes de enviar el correo)
    function datosFaltantes(raw) {
        const faltan = [];
        if (!raw.empresaRazon) faltan.push('razón social del empleador');
        if (!raw.empresaRut || !validateRut(raw.empresaRut)) faltan.push('RUT válido del empleador');
        if (!raw.empresaRepNombre) faltan.push('representante legal');
        if (!raw.trabajadorNombre) faltan.push('nombre del trabajador');
        if (!raw.trabajadorRut || !validateRut(raw.trabajadorRut)) faltan.push('RUT válido del trabajador');
        if (!raw.fechaInicio || !raw.fechaTermino || raw.fechaTermino < raw.fechaInicio) faltan.push('fechas de ingreso y término');
        if (!raw.sueldoBase) faltan.push('sueldo base');
        if (raw.causal === '160' && !raw.causal160) faltan.push('numeral del art. 160');
        return faltan;
    }

    function mostrarAvisoDatos(faltan) {
        const bar = document.getElementById('unlock-status-bar');
        if (!bar) return;
        const aviso = document.createElement('p');
        aviso.className = 'mt-2 text-xs font-semibold text-rose-700';
        aviso.textContent = 'Para enviarte el Word por correo, completa: ' + faltan.join(', ') + '. Luego usa «Enviar a mi correo».';
        bar.appendChild(aviso);
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

                const faltanEl = document.getElementById('checkout-faltan');
                const faltan = datosFaltantes(getRawFormData());
                const okEl = document.getElementById('checkout-datos-ok');
                if (okEl && !okEl.checked) faltan.push('confirmar que revisaste los datos');
                if (faltan.length) {
                    if (faltanEl) {
                        faltanEl.textContent = 'Antes de pagar, completa: ' + faltan.join(', ') + '.';
                        faltanEl.classList.remove('hidden');
                    }
                    return;
                }
                if (faltanEl) faltanEl.classList.add('hidden');

                if (emailInput && emailInput.value) {
                    localStorage.setItem('fini_customer_email', emailInput.value.trim());
                }

                // Guardar borrador completo en el navegador antes de salir a pagar
                saveDraftToStorage();

                if (!unlockApi()) {
                    alert('No pudimos iniciar el pago. Recarga la página e intenta de nuevo.');
                    return;
                }
                const original = confirmPayBtn.innerHTML;
                const datos = getRawFormData();
                // Aviso de retracto, pago creado en el servidor y salida a Flow
                unlockApi().buyKit('finiquito', {
                    email: emailInput ? emailInput.value.trim() : '',
                    nombre: datos.empresaRazon || '',
                    empresa: datos.empresaRazon || ''
                }, {
                    onAccept: () => {
                        confirmPayBtn.disabled = true;
                        confirmPayBtn.textContent = 'Conectando con Flow...';
                    },
                    onError: (mensaje) => {
                        confirmPayBtn.disabled = false;
                        confirmPayBtn.innerHTML = original;
                        alert(mensaje);
                    }
                });
            });
        }
    }

    // Despacho del finiquito (.docx) al correo electrónico del comprador
    let hasSentEmail = false;
    const MAX_ENVIOS_CORREO = 3; // mismo tope que api/send-finiquito.js

    async function dispatchFiniquitoEmail(formData, calcData, forceEmail = null) {
        const email = forceEmail || localStorage.getItem('fini_customer_email') || document.getElementById('checkout-email')?.value?.trim();
        if (!email || !email.includes('@')) return;

        if (!forceEmail && hasSentEmail) return;

        // Sin los datos mínimos no se envía un finiquito con textos de ejemplo
        const faltan = datosFaltantes(getRawFormData());
        if (faltan.length) {
            if (forceEmail) alert('Antes de enviarlo, completa: ' + faltan.join(', ') + '.');
            else mostrarAvisoDatos(faltan);
            return;
        }
        if (!forceEmail) hasSentEmail = true;

        const docBody = document.getElementById('notary-document-body');
        const htmlContent = docBody ? docBody.innerHTML : '';
        let docxBase64 = '';
        try {
            if (docBody && window.FiniquitoDocx) docxBase64 = window.FiniquitoDocx.toBase64(docBody, `Finiquito - ${formData.trabajadorNombre}`);
        } catch (e) {
            console.warn('No se pudo generar el .docx para el correo:', e);
        }

        try {
            // El servidor solo envía con el desbloqueo firmado tras el pago
            const unlock = unlockApi() ? unlockApi().storedUnlock('finiquito') : null;
            if (!unlock) return;

            // Envíos ya hechos con este pago: el automático sale una sola vez (aunque se reabra el enlace)
            // y cada reenvío usa el número siguiente, hasta el tope del servidor
            const llaveEnvios = 'fini_envios_correo_' + unlock.o;
            let enviados = 0;
            try { enviados = parseInt(localStorage.getItem(llaveEnvios) || '0', 10) || 0; } catch (e) {}
            if (!forceEmail && enviados >= 1) return;
            if (forceEmail && enviados >= MAX_ENVIOS_CORREO) {
                alert(`Ya enviaste este finiquito ${MAX_ENVIOS_CORREO} veces por correo. Descarga el Word desde esta página.`);
                return;
            }
            const intento = enviados + 1;

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
                    docxBase64,
                    filename: wordFilename(formData),
                    intento,
                    token: unlock.o,
                    unlock
                })
            });

            if (resp.ok) {
                try { localStorage.setItem(llaveEnvios, String(intento)); } catch (e) {}
                alert(`Enviamos el finiquito en Word a ${email}.`);
            } else {
                let msg = 'No pudimos enviar el correo. Descarga el Word desde esta página.';
                try { msg = (await resp.json()).error || msg; } catch (e) {}
                alert(msg);
            }
        } catch (e) {
            console.warn('Error al despachar finiquito por correo:', e);
        }
    }

    // Aplicar desbloqueo del finiquito pagado (48 horas)
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
            // Mismo vencimiento que el desbloqueo firmado por el servidor (48 horas)
            expiresAt: (unlockApi() && unlockApi().storedUnlock('finiquito') || {}).expiresAt || Date.now()
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
                                <span class="text-xs font-bold block text-emerald-950">¡Finiquito Notarial Desbloqueado!</span>
                                <span class="text-xs text-emerald-700">Acceso activo por 48 horas para don(ña) <strong>${escapeHtml(formData.trabajadorNombre)}</strong> (RUT: ${escapeHtml(formData.trabajadorRut)}).</span>
                            </div>
                        </div>
                        <button type="button" id="btn-reset-new-finiquito" class="text-xs text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer">
                            Limpiar el formulario
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="quick-pdf" class="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs">picture_as_pdf</span> Descargar Finiquito en PDF
                        </button>
                        <button type="button" id="quick-word" class="px-3.5 py-2 bg-forest-700 hover:bg-forest-800 active:bg-forest-900 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs">description</span> Descargar Word (.docx)
                        </button>
                        <button type="button" id="quick-resend-email" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors">
                            <span class="material-icons text-xs text-forest-600">email</span> ${customerEmail ? 'Reenviar a mi correo' : 'Enviar a mi correo'}
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
                if (confirm('Se borrarán los datos del formulario. Tu acceso de 48 horas sigue activo en este navegador.')) {
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

    // Exportador a Word: genera un .docx real con js/finiquito_docx.js
    function wordFilename(f) {
        const limpio = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        return `Finiquito_${limpio(f.trabajadorNombre) || 'Trabajador'}_${limpio(f.trabajadorRut)}.docx`;
    }

    function downloadWord() {
        if (!state.isPaid) {
            const modal = document.getElementById('payment-modal');
            if (modal) modal.classList.remove('hidden');
            return;
        }
        const docBody = document.getElementById('notary-document-body');
        if (!docBody || !window.FiniquitoDocx) return;

        const f = getFormData();
        const blob = window.FiniquitoDocx.toBlob(docBody, `Finiquito - ${f.trabajadorNombre}`);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = wordFilename(f);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);
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
    // Sin exponer el estado de pago: el desbloqueo solo lo da la firma del servidor
    window.FiniquitoGenerator = {
        updateAll,
        downloadPDF,
        downloadWord,
        numberToWords
    };

})();
