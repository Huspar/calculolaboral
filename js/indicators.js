/**
 * Indicators Service for CalculadorasChile
 * Fetches real-time data from mindicador.cl
 * P1: Added localStorage cache and validation
 */

const IndicatorsService = {
    API_URL: 'https://mindicador.cl/api',
    STORAGE_KEY: 'econIndicators.v1',

    /** Validate that a value is a positive finite number */
    _isValid(val) {
        return typeof val === 'number' && isFinite(val) && val > 0;
    },

    /** Save validated indicators to localStorage */
    _saveToCache(uf, utm, imm) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                UF: uf, UTM: utm, IMM: imm,
                timestamp: Date.now()
            }));
        } catch (e) {
            // localStorage may be unavailable (private browsing, quota, etc.)
            console.warn('Could not cache indicators:', e);
        }
    },

    /** Load indicators from localStorage (returns null if missing/invalid) */
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

    /** Apply validated values to global CONSTANTS and optionally dispatch event */
    _applyValues(uf, utm, imm, source) {
        if (typeof CONSTANTS === 'undefined') return false;

        const changed = (CONSTANTS.UF !== uf || CONSTANTS.UTM !== utm);

        CONSTANTS.UF = uf;
        CONSTANTS.UTM = utm;
        if (this._isValid(imm)) CONSTANTS.IMM = imm;

        console.log(`Indicators applied from ${source}: UF=${uf}, UTM=${utm}`);

        // Only dispatch if values actually changed (avoids unnecessary recalcs)
        if (changed) {
            document.dispatchEvent(new Event('indicatorsUpdated'));
        }

        return true;
    },

    // Fetch Daily Indicators
    async fetchDailyIndicators() {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            const uf = data.uf?.valor;
            const utm = data.utm?.valor;

            // Validate before applying
            if (!this._isValid(uf) || !this._isValid(utm)) {
                throw new Error(`Invalid API values: UF=${uf}, UTM=${utm}`);
            }

            // Apply and cache
            this._applyValues(uf, utm, null, 'API');
            this._saveToCache(uf, utm, typeof CONSTANTS !== 'undefined' ? CONSTANTS.IMM : 539000);

            // Update DOM
            this.updateDOM(data);

        } catch (error) {
            console.warn('API fetch failed, trying localStorage fallback:', error);

            // Fallback 1: localStorage
            const cached = this._loadFromCache();
            if (cached) {
                this._applyValues(cached.UF, cached.UTM, cached.IMM, 'localStorage');
            }
            // Fallback 2: hardcoded defaults already in CONSTANTS — no action needed
        }
    },

    updateDOM(data) {
        const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

        const ufEl = document.querySelector('.uf-value');
        if (ufEl) ufEl.textContent = formatMoney(data.uf.valor);

        const utmEl = document.querySelector('.utm-value');
        if (utmEl) utmEl.textContent = formatMoney(data.utm.valor);

        const dateEl = document.querySelector('.indicators-date');
        if (dateEl) {
            const date = new Date(data.uf.fecha);
            dateEl.textContent = `Valores del día ${date.toLocaleDateString('es-CL')}`;
        }
    },

    // Fetch History for Modal
    async fetchHistory(indicators = 'uf') {
        const indicatorList = Array.isArray(indicators) ? indicators : [indicators];

        // Initial loading state for relevant columns
        indicatorList.forEach(ind => {
            const body = document.getElementById(`${ind}-history-body`);
            if (body) {
                body.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-slate-400 text-[10px]">Cargando...</td></tr>';
            }
        });

        try {
            const results = await Promise.all(indicatorList.map(async (ind) => {
                try {
                    const response = await fetch(`${this.API_URL}/${ind}`);
                    if (!response.ok) throw new Error(`Error loading ${ind}`);
                    const data = await response.json();
                    return { ind, data, error: null };
                } catch (e) {
                    return { ind, data: null, error: e.message };
                }
            }));

            results.forEach(({ ind, data, error }) => {
                const body = document.getElementById(`${ind}-history-body`);
                if (!body) return;

                if (error || !data || !data.serie) {
                    body.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-red-400 text-[10px] italic">No disponible</td></tr>`;
                    return;
                }

                const limit = ind === 'utm' ? 12 : 30;
                let html = '';

                data.serie.slice(0, limit).forEach(item => {
                    const date = new Date(item.fecha).toLocaleDateString('es-CL');
                    const value = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.valor);
                    html += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td class="p-2 px-3 text-slate-300 text-[10px]">${date}</td>
                            <td class="p-2 px-3 text-emerald-400 font-bold text-[10px] text-right">${value}</td>
                        </tr>
                    `;
                });
                body.innerHTML = html;
            });

        } catch (globalError) {
            console.error('FetchHistory Global Error:', globalError);
        }
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
        // Update the "Values updated at" header date
        this.updateIndicatorDate();

        // Fetch on load
        this.fetchDailyIndicators();

        // Bind History Button
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

        // Close on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    IndicatorsService.init();
});
