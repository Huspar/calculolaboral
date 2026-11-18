/**
 * Cliente server-side para SII Gateway (https://connect.calculolaboral.cl).
 *
 * Aislado por cuenta (`x-account-id`) y autenticado con `x-api-key` solo en el servidor.
 * Nunca expone claves tributarias, certificados PFX ni la API key al navegador.
 */
'use strict';

const RutDefecto = require('../../js/rut_cl');

const DEFAULT_URL = 'https://connect.calculolaboral.cl';
const TIMEOUT_MS = 15000;
const MAX_LIMIT = 2000;
const MAX_PAGINAS = 10;

const JOB_TYPES = ['RCV_COMPRAS', 'RCV_VENTAS', 'BHE_EMITIDAS', 'BHE_RECIBIDAS', 'F29_SUMMARY', 'FULL_SYNC'];
const OPERACIONES_RCV = ['COMPRA', 'VENTA'];
const ESTADOS_CONTAB = ['REGISTRO', 'PENDIENTE', 'NO_INCLUIR', 'RECLAMADO'];
const DIRECCIONES_BHE = ['EMITIDA', 'RECIBIDA', 'TERCEROS'];
const ENVS_SII = ['PRODUCTION', 'CERTIFICATION'];

function idValido(v) {
    return typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v.trim());
}

function normalizarPeriodo(v) {
    const s = String(v == null ? '' : v).trim();
    const m = /^(\d{4})-?(0[1-9]|1[0-2])$/.exec(s);
    return m ? (m[1] + m[2]) : '';
}

function crear({ env = process.env, fetchFn = globalThis.fetch, Rut = RutDefecto, timeoutMs = TIMEOUT_MS } = {}) {
    function config() {
        const baseUrl = String(env.SII_GATEWAY_URL || DEFAULT_URL).trim().replace(/\/+$/, '');
        const apiKey = String(env.SII_GATEWAY_API_KEY || '').trim();
        return { baseUrl, apiKey, configured: Boolean(apiKey) };
    }

    function errorNoConfigurado() {
        return {
            ok: false,
            estado: 503,
            codigo: 'sii_gateway_no_configurado',
            error: 'La conexión automática al SII aún no está configurada en el servidor (falta SII_GATEWAY_API_KEY).'
        };
    }

    async function pedir(cuentaId, metodo, ruta, body) {
        const cfg = config();
        if (!cfg.apiKey) return errorNoConfigurado();
        if (!fetchFn) {
            return { ok: false, estado: 503, codigo: 'fetch_no_disponible', error: 'El entorno de ejecución no soporta solicitudes HTTP.' };
        }
        if (!cuentaId || typeof cuentaId !== 'string') {
            return { ok: false, estado: 400, codigo: 'cuenta_invalida', error: 'Falta identificar la cuenta del estudio.' };
        }

        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
        const headers = {
            'x-api-key': cfg.apiKey,
            'x-account-id': String(cuentaId),
            'accept': 'application/json'
        };
        const opts = { method: metodo, headers };
        if (ctrl) opts.signal = ctrl.signal;
        if (body !== undefined) {
            headers['content-type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetchFn(cfg.baseUrl + ruta, opts);
        } catch (err) {
            if (timer) clearTimeout(timer);
            const esTimeout = err && err.name === 'AbortError';
            return {
                ok: false,
                estado: esTimeout ? 504 : 502,
                codigo: esTimeout ? 'sii_gateway_timeout' : 'sii_gateway_inalcanzable',
                error: esTimeout
                    ? 'El servicio SII Gateway tardó demasiado en responder. Intenta nuevamente.'
                    : 'No pudimos conectar con el servicio SII Gateway.'
            };
        }
        if (timer) clearTimeout(timer);

        let data = null;
        const texto = typeof res.text === 'function' ? await res.text() : '';
        if (texto) {
            try { data = JSON.parse(texto); } catch (e) { data = null; }
        }

        if (res.ok) {
            return { ok: true, estado: res.status, data };
        }
        const codigo = (data && (data.code || data.codigo)) ? String(data.code || data.codigo) : 'sii_gateway_error';
        const mensaje = (data && (data.message || data.error))
            ? String(data.message || data.error)
            : ('SII Gateway respondió con error HTTP ' + res.status + '.');
        return { ok: false, estado: res.status || 502, codigo, error: mensaje };
    }

    function estadoConfiguracion() {
        const c = config();
        return { ok: true, configured: c.configured, baseUrl: c.baseUrl };
    }

    async function listarEmpresas(cuentaId, { rut } = {}) {
        let q = '';
        if (rut !== undefined && rut !== null && String(rut).trim() !== '') {
            const limpio = Rut.limpiar(rut);
            if (!limpio) return { ok: false, estado: 400, codigo: 'rut_invalido', error: 'El RUT ingresado no es válido.' };
            q = '?rut=' + encodeURIComponent(Rut.formatear(limpio));
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/companies' + q);
        if (!r.ok) return r;
        const items = r.data && Array.isArray(r.data.items) ? r.data.items : [];
        return { ok: true, items };
    }

    async function crearEmpresa(cuentaId, entrada) {
        const b = entrada && typeof entrada === 'object' ? entrada : {};
        if (!Rut.valido(b.rut)) {
            return { ok: false, estado: 400, codigo: 'rut_invalido', error: 'Ingresa un RUT de empresa válido con dígito verificador.' };
        }
        const razonSocial = String(b.razonSocial || '').trim().slice(0, 160);
        if (!razonSocial) {
            return { ok: false, estado: 400, codigo: 'razon_social_requerida', error: 'Ingresa la razón social de la empresa.' };
        }
        const siiEnv = ENVS_SII.indexOf(b.siiEnv) >= 0 ? b.siiEnv : 'PRODUCTION';
        const payload = {
            rut: Rut.formatear(b.rut),
            razonSocial,
            siiEnv,
            syncEnabled: b.syncEnabled === undefined ? true : Boolean(b.syncEnabled),
            externalAccountId: String(cuentaId)
        };
        if (b.giro) payload.giro = String(b.giro).trim().slice(0, 120);

        const r = await pedir(cuentaId, 'POST', '/api/v1/companies', payload);
        if (!r.ok) return r;
        return { ok: true, estado: r.estado, company: r.data };
    }

    async function eliminarEmpresa(cuentaId, companyId) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const r = await pedir(cuentaId, 'DELETE', '/api/v1/companies/' + encodeURIComponent(companyId.trim()));
        if (!r.ok) return r;
        return { ok: true, deleted: true, companyId: (r.data && r.data.companyId) || companyId.trim() };
    }

    async function estadoEmpresa(cuentaId, companyId) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const r = await pedir(cuentaId, 'GET', '/api/v1/companies/' + encodeURIComponent(companyId.trim()) + '/status');
        if (!r.ok) return r;
        return { ok: true, status: r.data };
    }

    async function guardarCredenciales(cuentaId, companyId, entrada) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const b = entrada && typeof entrada === 'object' ? entrada : {};
        const kind = b.kind;
        const siiEnv = ENVS_SII.indexOf(b.siiEnv) >= 0 ? b.siiEnv : 'PRODUCTION';
        let payload;

        if (kind === 'CLAVE_TRIBUTARIA') {
            const claveTributaria = typeof b.claveTributaria === 'string' ? b.claveTributaria : '';
            if (!claveTributaria.trim()) {
                return { ok: false, estado: 400, codigo: 'clave_requerida', error: 'Ingresa la Clave Tributaria del SII.' };
            }
            payload = { kind, siiEnv, claveTributaria };
        } else if (kind === 'PFX_CERTIFICATE') {
            const pfxBase64 = typeof b.pfxBase64 === 'string' ? b.pfxBase64.trim() : '';
            const pfxPassword = typeof b.pfxPassword === 'string' ? b.pfxPassword : '';
            if (!pfxBase64 || !pfxPassword) {
                return { ok: false, estado: 400, codigo: 'pfx_incompleto', error: 'Adjunta el archivo .pfx y su contraseña.' };
            }
            payload = { kind, siiEnv, pfxBase64, pfxPassword };
            if (b.certMetadata && typeof b.certMetadata === 'object' && !Array.isArray(b.certMetadata)) {
                payload.certMetadata = b.certMetadata;
            }
        } else {
            return { ok: false, estado: 400, codigo: 'tipo_credencial_invalido', error: 'El tipo de credencial debe ser CLAVE_TRIBUTARIA o PFX_CERTIFICATE.' };
        }

        const r = await pedir(cuentaId, 'POST', '/api/v1/companies/' + encodeURIComponent(companyId.trim()) + '/credentials', payload);
        if (!r.ok) return r;
        const d = r.data || {};
        return {
            ok: true,
            credential: {
                id: d.id,
                companyId: d.companyId || companyId.trim(),
                kind: d.kind || kind,
                siiEnv: d.siiEnv || siiEnv,
                isActive: d.isActive !== false,
                lastValidatedAt: d.lastValidatedAt || null,
                lastErrorCode: d.lastErrorCode || null,
                createdAt: d.createdAt || null,
                updatedAt: d.updatedAt || null
            }
        };
    }

    async function eliminarCredenciales(cuentaId, companyId, { kind, siiEnv } = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const params = [];
        if (kind) {
            if (kind !== 'CLAVE_TRIBUTARIA' && kind !== 'PFX_CERTIFICATE') {
                return { ok: false, estado: 400, codigo: 'tipo_credencial_invalido', error: 'Tipo de credencial inválido.' };
            }
            params.push('kind=' + encodeURIComponent(kind));
        }
        if (siiEnv) {
            if (ENVS_SII.indexOf(siiEnv) < 0) {
                return { ok: false, estado: 400, codigo: 'env_invalido', error: 'Ambiente SII inválido.' };
            }
            params.push('siiEnv=' + encodeURIComponent(siiEnv));
        }
        const qs = params.length ? ('?' + params.join('&')) : '';
        const r = await pedir(cuentaId, 'DELETE', '/api/v1/companies/' + encodeURIComponent(companyId.trim()) + '/credentials' + qs);
        if (!r.ok) return r;
        return { ok: true, deletedCount: (r.data && typeof r.data.deletedCount === 'number') ? r.data.deletedCount : 0 };
    }

    async function iniciarSync(cuentaId, companyId, { period, jobType } = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const per = normalizarPeriodo(period);
        if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
        const tipo = jobType ? String(jobType) : 'FULL_SYNC';
        if (JOB_TYPES.indexOf(tipo) < 0) {
            return { ok: false, estado: 400, codigo: 'job_type_invalido', error: 'Tipo de sincronización no válido.' };
        }
        const r = await pedir(
            cuentaId,
            'POST',
            '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/sync',
            { period: per, jobType: tipo }
        );
        if (!r.ok) return r;
        return { ok: true, estado: r.estado, job: r.data };
    }

    async function estadoSync(cuentaId, companyId, jobId) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        if (!idValido(jobId)) return { ok: false, estado: 400, codigo: 'job_invalido', error: 'Identificador de sincronización inválido.' };
        const r = await pedir(
            cuentaId,
            'GET',
            '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/sync/' + encodeURIComponent(jobId.trim())
        );
        if (!r.ok) return r;
        return { ok: true, job: r.data };
    }

    async function obtenerRcv(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const per = normalizarPeriodo(opts.period);
        if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
        if (opts.operacion && OPERACIONES_RCV.indexOf(opts.operacion) < 0) {
            return { ok: false, estado: 400, codigo: 'operacion_invalida', error: 'Operación RCV inválida (usa COMPRA o VENTA).' };
        }
        if (opts.estadoContab && ESTADOS_CONTAB.indexOf(opts.estadoContab) < 0) {
            return { ok: false, estado: 400, codigo: 'estado_contab_invalido', error: 'Estado contable RCV inválido.' };
        }

        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(opts.limit) || MAX_LIMIT));
        let offset = Math.max(0, Number(opts.offset) || 0);
        const traerTodo = opts.all === true || opts.all === '1' || opts.all === 1;

        const baseParams = ['period=' + per, 'amountFormat=number', 'limit=' + limit];
        if (opts.operacion) baseParams.push('operacion=' + encodeURIComponent(opts.operacion));
        if (opts.estadoContab) baseParams.push('estadoContab=' + encodeURIComponent(opts.estadoContab));

        let acumulado = null;
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
            const qs = '?' + baseParams.concat(['offset=' + offset]).join('&');
            const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/rcv' + qs);
            if (!r.ok) return r;
            const d = r.data || {};
            const docs = Array.isArray(d.documents) ? d.documents : [];
            if (!acumulado) {
                acumulado = Object.assign({}, d, { documents: docs.slice() });
            } else {
                acumulado.documents = acumulado.documents.concat(docs);
            }
            const totalCount = Number(d.totalCount) || acumulado.documents.length;
            if (!traerTodo || docs.length < limit || acumulado.documents.length >= totalCount) {
                break;
            }
            offset += docs.length;
        }
        return { ok: true, rcv: acumulado };
    }

    async function obtenerBhe(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const per = normalizarPeriodo(opts.period);
        if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
        if (opts.direction && DIRECCIONES_BHE.indexOf(opts.direction) < 0) {
            return { ok: false, estado: 400, codigo: 'direccion_bhe_invalida', error: 'Dirección BHE inválida.' };
        }

        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(opts.limit) || MAX_LIMIT));
        let offset = Math.max(0, Number(opts.offset) || 0);
        const traerTodo = opts.all === true || opts.all === '1' || opts.all === 1;

        const baseParams = ['period=' + per, 'amountFormat=number', 'limit=' + limit];
        if (opts.direction) baseParams.push('direction=' + encodeURIComponent(opts.direction));

        let acumulado = null;
        for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
            const qs = '?' + baseParams.concat(['offset=' + offset]).join('&');
            const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/bhe' + qs);
            if (!r.ok) return r;
            const d = r.data || {};
            const items = Array.isArray(d.items) ? d.items : [];
            if (!acumulado) {
                acumulado = Object.assign({}, d, { items: items.slice() });
            } else {
                acumulado.items = acumulado.items.concat(items);
            }
            const totalCount = Number(d.totalCount) || acumulado.items.length;
            if (!traerTodo || items.length < limit || acumulado.items.length >= totalCount) {
                break;
            }
            offset += items.length;
        }
        return { ok: true, bhe: acumulado };
    }

    async function obtenerF29(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const per = normalizarPeriodo(opts.period);
        if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
        const r = await pedir(
            cuentaId,
            'GET',
            '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/f29?period=' + per + '&amountFormat=number'
        );
        if (!r.ok) {
            if (r.estado === 404 || r.codigo === 'F29_NOT_SYNCED') {
                return { ok: true, synced: false, codigo: 'F29_NOT_SYNCED', summary: null };
            }
            return r;
        }
        const d = r.data || {};
        return {
            ok: true,
            synced: Boolean(d.summary),
            companyId: d.companyId || companyId.trim(),
            rut: d.rut || '',
            source: d.source || 'MIRROR_DB',
            summary: d.summary || null
        };
    }

    /** Limpieza en cascada al eliminar la cuenta en CalculoLaboral (Ley 21.719). */
    async function desconectarCuenta(cuentaId) {
        if (!config().configured) return { ok: true, skipped: true, deletedCompanies: 0 };
        const lista = await listarEmpresas(cuentaId);
        if (!lista.ok) return { ok: false, error: lista.error, deletedCompanies: 0 };
        let borradas = 0;
        for (let i = 0; i < lista.items.length; i++) {
            const id = lista.items[i] && lista.items[i].id;
            if (!id) continue;
            const d = await eliminarEmpresa(cuentaId, String(id));
            if (d.ok) borradas++;
        }
        return { ok: true, skipped: false, deletedCompanies: borradas };
    }

    return {
        estadoConfiguracion,
        listarEmpresas,
        crearEmpresa,
        eliminarEmpresa,
        estadoEmpresa,
        guardarCredenciales,
        eliminarCredenciales,
        iniciarSync,
        estadoSync,
        obtenerRcv,
        obtenerBhe,
        obtenerF29,
        desconectarCuenta,
        normalizarPeriodo
    };
}

module.exports = { crear, normalizarPeriodo, idValido };
