/**
 * Release: v2.1.0
 * Fecha: Marzo 2026
 * Estado: Producción estable
 * Descripción: Servicio de indicadores económicos chilenos (UF, UTM) de alta disponibilidad.
 * Cuenta con arquitectura de doble proveedor (findic.cl primario, mindicador.cl fallback),
 * control de timeout estricto con AbortController, caché en localStorage y dataset base
 * offline para garantizar que el modal de historial y los valores diarios respondan instantáneamente.
 */

const IndicatorsService = {
    PRIMARY_API: 'https://findic.cl/api',
    FALLBACK_API: 'https://mindicador.cl/api',
    STORAGE_KEY: 'econIndicators.v1',
    HISTORY_STORAGE_KEY: 'econIndicatorsHistory.v1',
    TIMEOUT_MS: 3500,

    // Dataset base offline de contingencia (UF 30 días, UTM 12 meses)
    BASELINE_DATA: {
        uf: [
            {"fecha": "2026-09-20", "valor": 40975.41},
            {"fecha": "2026-09-19", "valor": 40967.24},
            {"fecha": "2026-09-18", "valor": 40959.08},
            {"fecha": "2026-09-17", "valor": 40950.91},
            {"fecha": "2026-09-16", "valor": 40942.75},
            {"fecha": "2026-09-15", "valor": 40934.58},
            {"fecha": "2026-09-14", "valor": 40926.41},
            {"fecha": "2026-09-13", "valor": 40918.25},
            {"fecha": "2026-09-12", "valor": 40910.1},
            {"fecha": "2026-09-11", "valor": 40901.94},
            {"fecha": "2026-09-10", "valor": 40893.78},
            {"fecha": "2026-09-09", "valor": 40885.63},
            {"fecha": "2026-09-08", "valor": 40884.32},
            {"fecha": "2026-09-07", "valor": 40883.0},
            {"fecha": "2026-09-06", "valor": 40881.68},
            {"fecha": "2026-09-05", "valor": 40880.36},
            {"fecha": "2026-09-04", "valor": 40879.04},
            {"fecha": "2026-09-03", "valor": 40877.73},
            {"fecha": "2026-09-02", "valor": 40876.41},
            {"fecha": "2026-09-01", "valor": 40875.09},
            {"fecha": "2026-08-31", "valor": 40873.77},
            {"fecha": "2026-08-30", "valor": 40872.45},
            {"fecha": "2026-08-29", "valor": 40871.14},
            {"fecha": "2026-08-28", "valor": 40869.82},
            {"fecha": "2026-08-27", "valor": 40868.5},
            {"fecha": "2026-08-26", "valor": 40867.18},
            {"fecha": "2026-08-25", "valor": 40865.87},
            {"fecha": "2026-08-24", "valor": 40864.55},
            {"fecha": "2026-08-23", "valor": 40863.23},
            {"fecha": "2026-08-22", "valor": 40861.91}
        ],
        utm: [
            {"fecha": "2026-09-01", "valor": 71721.0},
            {"fecha": "2026-08-01", "valor": 71649.0},
            {"fecha": "2026-07-01", "valor": 71649.0},
            {"fecha": "2026-06-01", "valor": 71506.0},
            {"fecha": "2026-05-01", "valor": 70588.0},
            {"fecha": "2026-04-01", "valor": 69889.0},
            {"fecha": "2026-03-01", "valor": 69889.0},
            {"fecha": "2026-02-01", "valor": 69611.0},
            {"fecha": "2026-01-01", "valor": 69751.0},
            {"fecha": "2025-12-01", "valor": 69542.0},
            {"fecha": "2025-11-01", "valor": 69542.0},
            {"fecha": "2025-10-01", "valor": 69265.0}
        ]
    },

    /** Validar que un valor sea un número positivo y finito */
    _isValid(val) {
        return typeof val === 'number' && isFinite(val) && val > 0;
    },

    /** Formatear fecha asegurando que no haya corrimiento por zona horaria UTC */
    _formatDate(dateStr) {
        if (!dateStr) return '';
        const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('es-CL');
    },

    /** Formatear mes y año para UTM (ej. Sep 2026) */
    _formatMonthYear(dateStr) {
        if (!dateStr) return '';
        const match = String(dateStr).match(/^(\d{4})-(\d{2})/);
        if (match) {
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const mIndex = parseInt(match[2], 10) - 1;
            return `${months[mIndex] || match[2]} ${match[1]}`;
        }
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    },

    /** Guardar indicadores diarios en localStorage */
    _saveToCache(uf, utm, imm) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                UF: uf, UTM: utm, IMM: imm,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Could not cache indicators:', e);
        }
    },

    /** Cargar indicadores diarios desde localStorage */
    _loadFromCache() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (this._isValid(parsed.UF) && this._isValid(parsed.UTM)) {
                return parsed;
            }
        } catch (e) {
            console.warn('Could not read cached indicators:', e);
        }
        return null;
    },

    /** Guardar series históricas en localStorage */
    _saveHistoryToCache(historyObj) {
        try {
            localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify({
                data: historyObj,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('No se pudo guardar historial en cache:', e);
        }
    },

    /** Cargar series históricas desde localStorage */
    _loadHistoryFromCache() {
        try {
            const raw = localStorage.getItem(this.HISTORY_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data) {
                return parsed.data;
            }
        } catch (e) {
            console.warn('Error al leer historial cacheado:', e);
        }
        return null;
    },

    /** Petición con AbortController y tiempo límite */
    async _fetchWithTimeout(url, timeoutMs = this.TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    },

    /** Petición con failover automático (Primario findic.cl -> Fallback mindicador.cl) */
    async _fetchWithFallback(endpointPath = '') {
        try {
            return await this._fetchWithTimeout(`${this.PRIMARY_API}${endpointPath}`);
        } catch (primaryErr) {
            console.warn(`Proveedor primario (${this.PRIMARY_API}${endpointPath}) no respondió a tiempo:`, primaryErr.message);
        }

        try {
            return await this._fetchWithTimeout(`${this.FALLBACK_API}${endpointPath}`);
        } catch (fallbackErr) {
            console.warn(`Proveedor secundario (${this.FALLBACK_API}${endpointPath}) no disponible:`, fallbackErr.message);
            throw fallbackErr;
        }
    },

    /** Apply validated values to global CONSTANTS and optionally dispatch event */
    _applyValues(uf, utm, imm, source) {
        if (typeof CONSTANTS === 'undefined') return false;

        const changed = (CONSTANTS.UF !== uf || CONSTANTS.UTM !== utm);

        CONSTANTS.UF = uf;
        CONSTANTS.UTM = utm;
        if (this._isValid(imm)) CONSTANTS.IMM = imm;

        if (typeof CONSTANTS.recalculateTaxBrackets === 'function') {
            CONSTANTS.recalculateTaxBrackets(utm);
        }

        console.log(`Indicators applied from ${source}: UF=${uf}, UTM=${utm}`);

        // Only dispatch if values actually changed (avoids unnecessary recalcs)
        if (changed) {
            document.dispatchEvent(new Event('indicatorsUpdated'));
        }

        return true;
    },

    // Cargar indicadores diarios
    async fetchDailyIndicators() {
        document.dispatchEvent(new CustomEvent('indicatorsLoading'));
        this._updateStatusDOM('loading');

        try {
            const data = await this._fetchWithFallback('');
            const uf = data.uf?.valor;
            const utm = data.utm?.valor;

            if (!this._isValid(uf) || !this._isValid(utm)) {
                throw new Error(`Valores no válidos: UF=${uf}, UTM=${utm}`);
            }

            this._applyValues(uf, utm, null, 'API');
            this._saveToCache(uf, utm, typeof CONSTANTS !== 'undefined' ? CONSTANTS.IMM : 553553);
            this.updateDOM(data);
            this._updateStatusDOM('success');
            document.dispatchEvent(new CustomEvent('indicatorsLoaded', { detail: { source: 'api' } }));

        } catch (error) {
            console.warn('Fallo en APIs en vivo, activando respaldo:', error);

            const cached = this._loadFromCache();
            if (cached) {
                this._applyValues(cached.UF, cached.UTM, cached.IMM, 'localStorage');
                const cachedDate = new Date(cached.timestamp);
                this._updateStatusDOM('fallback', cachedDate);
                this.updateDOM({
                    uf: { valor: cached.UF, fecha: cachedDate.toISOString() },
                    utm: { valor: cached.UTM, fecha: cachedDate.toISOString() }
                });
                document.dispatchEvent(new CustomEvent('indicatorsLoaded', { detail: { source: 'cache' } }));
            } else {
                const baselineUf = this.BASELINE_DATA.uf[0].valor;
                const baselineUtm = this.BASELINE_DATA.utm[0].valor;
                this._applyValues(baselineUf, baselineUtm, null, 'baseline');
                this.updateDOM({
                    uf: { valor: baselineUf, fecha: this.BASELINE_DATA.uf[0].fecha },
                    utm: { valor: baselineUtm, fecha: this.BASELINE_DATA.utm[0].fecha }
                });
                this._updateStatusDOM('error');
                document.dispatchEvent(new CustomEvent('indicatorsError'));
            }
        }
    },

    updateDOM(data) {
        const formatUF = (val) => new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);

        const formatUTM = (val) => new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0
        }).format(val);

        if (data.uf?.valor) {
            const formattedUF = formatUF(data.uf.valor);
            document.querySelectorAll('.uf-value').forEach(el => {
                el.textContent = formattedUF;
            });
        }

        if (data.utm?.valor) {
            const formattedUTM = formatUTM(data.utm.valor);
            document.querySelectorAll('.utm-value').forEach(el => {
                el.textContent = formattedUTM;
            });
        }

        const dateEl = document.querySelector('.indicators-date');
        if (dateEl && data.uf?.fecha) {
            dateEl.textContent = `Valores al ${this._formatDate(data.uf.fecha)}`;
        }

        const dateSmall = document.getElementById('indicators-date-dynamic');
        if (dateSmall && data.uf?.fecha) {
            dateSmall.textContent = this._formatDate(data.uf.fecha);
        }
    },

    _updateStatusDOM(state, fallbackDate) {
        const statusEl = document.getElementById('indicators-status');
        if (!statusEl) return;

        const configs = {
            loading: {
                text: 'Actualizando indicadores...',
                icon: 'sync',
                classes: 'text-slate-400 animate-pulse'
            },
            success: {
                text: 'Indicadores en línea ✓',
                icon: 'check_circle',
                classes: 'text-emerald-500'
            },
            fallback: {
                text: `Respaldo guardado${fallbackDate ? ' (' + this._formatDate(fallbackDate) + ')' : ''}`,
                icon: 'history',
                classes: 'text-amber-500'
            },
            error: {
                text: 'Valores vigentes (modo offline)',
                icon: 'info',
                classes: 'text-slate-400'
            }
        };

        const cfg = configs[state];
        if (!cfg) return;

        statusEl.className = `flex items-center gap-1 text-[10px] mt-1.5 transition-all duration-300 font-medium ${cfg.classes}`;
        statusEl.innerHTML = `<span class="material-icons text-[13px]">${cfg.icon}</span> ${cfg.text}`;
    },

    /** Renderizar filas en las tablas del modal de historial con diseño de alto contraste */
    _renderHistoryRows(ind, serie) {
        const body = document.getElementById(`${ind}-history-body`);
        if (!body) return;

        if (!Array.isArray(serie) || serie.length === 0) {
            body.innerHTML = '<tr><td colspan="2" class="p-3 text-center text-slate-400 text-xs italic">No disponible</td></tr>';
            return;
        }

        const limit = ind === 'utm' ? 12 : 30;
        const formatMoney = (val) => new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: ind === 'uf' ? 2 : 0,
            maximumFractionDigits: ind === 'uf' ? 2 : 0
        }).format(val);

        let html = '';
        serie.slice(0, limit).forEach(item => {
            const dateStr = ind === 'utm' ? this._formatMonthYear(item.fecha) : this._formatDate(item.fecha);
            const valStr = formatMoney(item.valor);
            html += `
                <tr class="border-b border-slate-100 hover:bg-slate-50/90 transition-colors">
                    <td class="py-1.5 px-1 sm:px-2 text-slate-700 font-medium text-[11px] sm:text-xs whitespace-nowrap">${dateStr}</td>
                    <td class="py-1.5 px-1 sm:px-2 text-emerald-600 font-bold font-mono text-[11px] sm:text-xs text-right whitespace-nowrap">${valStr}</td>
                </tr>
            `;
        });
        body.innerHTML = html;
    },

    // Cargar historial para el Modal
    async fetchHistory(indicators = ['uf', 'utm']) {
        const indicatorList = Array.isArray(indicators) ? indicators : [indicators];

        // 1. Mostrar de inmediato datos en caché si existen (0 ms de latencia percibida)
        const cachedHistory = this._loadHistoryFromCache();
        const updatedCache = cachedHistory ? { ...cachedHistory } : {};

        indicatorList.forEach(ind => {
            if (cachedHistory && cachedHistory[ind] && cachedHistory[ind].length > 0) {
                this._renderHistoryRows(ind, cachedHistory[ind]);
            } else {
                const body = document.getElementById(`${ind}-history-body`);
                if (body) {
                    body.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-slate-400 text-xs animate-pulse">Cargando datos...</td></tr>';
                }
            }
        });

        // 2. Consultar datos en vivo con failover y timeout
        await Promise.all(indicatorList.map(async (ind) => {
            try {
                const data = await this._fetchWithFallback(`/${ind}`);
                if (data && Array.isArray(data.serie) && data.serie.length > 0) {
                    this._renderHistoryRows(ind, data.serie);
                    updatedCache[ind] = data.serie;
                } else {
                    throw new Error(`Serie vacía para ${ind}`);
                }
            } catch (err) {
                console.warn(`No se pudo actualizar historial en vivo para ${ind}:`, err.message);
                // Si no había nada en caché visible, usar el dataset base
                if (!updatedCache[ind] || updatedCache[ind].length === 0) {
                    const fallbackSerie = this.BASELINE_DATA[ind] || [];
                    this._renderHistoryRows(ind, fallbackSerie);
                    updatedCache[ind] = fallbackSerie;
                }
            }
        }));

        // 3. Guardar historial consolidado
        this._saveHistoryToCache(updatedCache);
    },

    updateIndicatorDate() {
        const dateEl = document.getElementById('indicadores-fecha');
        if (dateEl) {
            const today = new Date();
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = today.toLocaleDateString('es-CL', options);
            dateEl.textContent = `Valores actualizados al ${formattedDate}`;
        }
    },

    init() {
        this.updateIndicatorDate();
        this.fetchDailyIndicators();

        const btnHistory = document.getElementById('btn-history');
        const modal = document.getElementById('history-modal');
        const btnClose = document.getElementById('btn-close-history');

        if (btnHistory && modal) {
            btnHistory.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.remove('hidden');
                this.fetchHistory(['uf', 'utm']);
            });
        }

        if (btnClose && modal) {
            btnClose.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });

            // Cerrar con tecla Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    IndicatorsService.init();
});

// Centralized GA4 Ad Click Telemetry (Soicos, Itaú, Abakos)
(function() {
    function trackAdClick(link) {
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var isSoicos = href.indexOf('ad.soicos.com') !== -1;
        var isItauShort = href === '/itau' || href.indexOf('/itau') !== -1;
        var isAbakosShort = href === '/abakos' || href.indexOf('/abakos') !== -1;
        var hasPartnerData = link.hasAttribute('data-partner') || link.hasAttribute('data-promo') || link.hasAttribute('data-ad-name');

        if (!isSoicos && !isItauShort && !isAbakosShort && !hasPartnerData) return;

        var adName = link.getAttribute('data-partner') || link.getAttribute('data-promo') || link.getAttribute('data-ad-name');
        if (!adName) {
            if (href.indexOf('1154903') !== -1 || href.indexOf('/abakos-emergencias') !== -1) adName = 'abakos_emergencias';
            else if (href.indexOf('1154772') !== -1 || href === '/abakos') adName = 'abakos_prestamos';
            else if (href.indexOf('1163773') !== -1 || isItauShort) adName = 'itau_cuenta_corriente';
            else adName = 'soicos_patrocinado';
        }

        var placement = link.getAttribute('data-placement') || link.getAttribute('data-ad-placement');
        if (!placement) {
            if (link.closest('#lead-section')) placement = 'lead_section';
            else if (link.closest('.dark-banner')) placement = 'dark_banner';
            else if (link.closest('#sueldo-calc-container') || link.closest('#finiquito-calc-container')) placement = 'calc_sidebar';
            else placement = 'in_content';
        }

        if (typeof window.gtag === 'function') {
            window.gtag('event', 'ad_click', {
                'event_category': 'Monetization',
                'event_label': adName,
                'ad_name': adName,
                'ad_placement': placement,
                'ad_destination': href,
                'page_location': window.location.href,
                'page_path': window.location.pathname,
                'transport_type': 'beacon'
            });
        }
    }

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link) {
            trackAdClick(link);
        }
    }, { capture: true, passive: true });
})();
