/**
 * Cliente server-side para SII Gateway (https://connect.calculolaboral.cl).
 *
 * Aislado por cuenta (`x-account-id`) y autenticado con `x-api-key` solo en el servidor.
 * Nunca expone claves tributarias, certificados PFX ni la API key al navegador.
 */
'use strict';

const crypto = require('crypto');
const RutDefecto = require('../../js/rut_cl');

const DEFAULT_URL = 'https://connect.calculolaboral.cl';
const TIMEOUT_MS = 15000;
const MAX_LIMIT = 2000;
const MAX_PAGINAS = 10;

const JOB_TYPES = ['RCV_COMPRAS', 'RCV_VENTAS', 'BHE_EMITIDAS', 'BHE_RECIBIDAS', 'F29_SUMMARY', 'F22_SUMMARY', 'DDJJ_SUMMARY', 'TGR_DEBT', 'PREVIRED_STATUS', 'FULL_SYNC'];
const CREDENTIAL_KINDS = ['CLAVE_TRIBUTARIA', 'PFX_CERTIFICATE', 'PREVIRED_CREDENTIALS'];
const ESTADOS_TGR = ['IMPAGO', 'MOROSO', 'CONVENIO', 'PAGADO', 'SIN_DEUDA'];
const ESTADOS_PREVIRED = ['PAGADO', 'DECLARADO_NO_PAGADO', 'ATRASADO', 'SIN_MOVIMIENTO'];
const WEBHOOK_EVENTS = ['*', 'sync.completed', 'sync.failed', 'rcv.acuse_expiring', 'f29.due_alert', 'tgr.debt_detected', 'previred.overdue_detected', 'webhook.test'];
const OPERACIONES_RCV = ['COMPRA', 'VENTA'];
const ESTADOS_CONTAB = ['REGISTRO', 'PENDIENTE', 'NO_INCLUIR', 'RECLAMADO'];
const DIRECCIONES_BHE = ['EMITIDA', 'RECIBIDA', 'TERCEROS'];
const ENVS_SII = ['PRODUCTION', 'CERTIFICATION'];
const ACCIONES_ACUSE = ['ACD', 'RCD', 'ERM', 'RFP', 'RFT'];

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
        } else if (kind === 'PREVIRED_CREDENTIALS') {
            const rutUsuarioRaw = typeof b.rutUsuario === 'string' ? b.rutUsuario.trim() : '';
            const password = typeof b.password === 'string' ? b.password : '';
            if (!Rut.valido(rutUsuarioRaw)) {
                return { ok: false, estado: 400, codigo: 'rut_usuario_invalido', error: 'Ingresa un RUT válido de usuario PreviRed.' };
            }
            if (!password.trim()) {
                return { ok: false, estado: 400, codigo: 'password_requerida', error: 'Ingresa la clave de PreviRed.' };
            }
            payload = { kind, siiEnv, rutUsuario: Rut.formatear(rutUsuarioRaw), password };
        } else {
            return { ok: false, estado: 400, codigo: 'tipo_credencial_invalido', error: 'El tipo de credencial debe ser CLAVE_TRIBUTARIA, PFX_CERTIFICATE o PREVIRED_CREDENTIALS.' };
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
            if (CREDENTIAL_KINDS.indexOf(kind) < 0) {
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

    async function sincronizarTodas(cuentaId, { period, jobType } = {}) {
        const payload = {};
        if (period !== undefined && period !== null && String(period).trim() !== '') {
            const per = normalizarPeriodo(period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            payload.period = per;
        }
        if (jobType !== undefined && jobType !== null && String(jobType).trim() !== '') {
            const tipo = String(jobType).trim();
            if (JOB_TYPES.indexOf(tipo) < 0) {
                return { ok: false, estado: 400, codigo: 'job_type_invalido', error: 'Tipo de sincronización no válido.' };
            }
            payload.jobType = tipo;
        }
        const r = await pedir(cuentaId, 'POST', '/api/v1/accounting/sync-all', payload);
        if (!r.ok) return r;
        return { ok: true, estado: r.estado, batch: r.data };
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

    async function enviarAcuseRcv(cuentaId, companyId, entrada) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const b = entrada && typeof entrada === 'object' ? entrada : {};
        const tipoDoc = Number(b.tipoDoc);
        if (!Number.isInteger(tipoDoc) || tipoDoc < 1 || tipoDoc > 999) {
            return { ok: false, estado: 400, codigo: 'tipo_doc_invalido', error: 'Tipo de DTE inválido.' };
        }
        const folioNum = Number(b.folio);
        if (!Number.isInteger(folioNum) || folioNum <= 0) {
            return { ok: false, estado: 400, codigo: 'folio_invalido', error: 'El folio del documento debe ser mayor a cero.' };
        }
        if (!Rut.valido(b.rutEmisor)) {
            return { ok: false, estado: 400, codigo: 'rut_emisor_invalido', error: 'El RUT del emisor no es válido.' };
        }
        const accion = String(b.accion || '').trim().toUpperCase();
        if (ACCIONES_ACUSE.indexOf(accion) < 0) {
            return { ok: false, estado: 400, codigo: 'accion_invalida', error: 'Acción SII inválida (usa ACD, ERM, RCD, RFP o RFT).' };
        }
        const payload = {
            tipoDoc,
            folio: folioNum,
            rutEmisor: Rut.formatear(b.rutEmisor),
            accion
        };
        if (b.period) {
            const per = normalizarPeriodo(b.period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            payload.period = per;
        }
        if (typeof b.idempotencyKey === 'string' && b.idempotencyKey.trim()) {
            payload.idempotencyKey = b.idempotencyKey.trim().slice(0, 120);
        }
        const r = await pedir(
            cuentaId,
            'POST',
            '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/rcv/acuse',
            payload
        );
        if (!r.ok) return r;
        return { ok: true, acuse: r.data };
    }

    async function listarTokensMcp(cuentaId) {
        const r = await pedir(cuentaId, 'GET', '/api/v1/mcp/tokens');
        if (!r.ok) return r;
        const items = r.data && Array.isArray(r.data.items) ? r.data.items : [];
        return { ok: true, items };
    }

    async function crearTokenMcp(cuentaId, entrada) {
        const b = entrada && typeof entrada === 'object' ? entrada : {};
        const label = typeof b.label === 'string' ? b.label.trim().slice(0, 60) : '';
        const payload = label ? { label } : {};
        const r = await pedir(cuentaId, 'POST', '/api/v1/mcp/tokens', payload);
        if (!r.ok) return r;
        return { ok: true, estado: r.estado, token: r.data };
    }

    async function revocarTokenMcp(cuentaId, tokenId) {
        if (!idValido(tokenId)) {
            return { ok: false, estado: 400, codigo: 'token_invalido', error: 'Identificador de token MCP inválido.' };
        }
        const r = await pedir(cuentaId, 'DELETE', '/api/v1/mcp/tokens/' + encodeURIComponent(tokenId.trim()));
        if (!r.ok) return r;
        return Object.assign({ ok: true, revoked: true }, r.data || { id: tokenId.trim() });
    }


    function normalizarAnio(v) {
        if (v === undefined || v === null || String(v).trim() === '') return '';
        const s = String(v).trim();
        return /^20\d{2}$/.test(s) ? s : null;
    }

    async function obtenerF22(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const anio = normalizarAnio(opts.anioTributario);
        if (anio === null) return { ok: false, estado: 400, codigo: 'anio_invalido', error: 'Año tributario inválido (ej. 2026).' };
        const params = ['amountFormat=number'];
        if (anio) params.push('anioTributario=' + anio);
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/f22?' + params.join('&'));
        if (!r.ok) {
            if (r.estado === 404 || r.codigo === 'F22_NOT_SYNCED') {
                return { ok: true, synced: false, codigo: 'F22_NOT_SYNCED', summary: null };
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

    async function obtenerDdjj(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const anio = normalizarAnio(opts.anioTributario);
        if (anio === null) return { ok: false, estado: 400, codigo: 'anio_invalido', error: 'Año tributario inválido (ej. 2026).' };
        const params = ['amountFormat=number'];
        if (anio) params.push('anioTributario=' + anio);
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/ddjj?' + params.join('&'));
        if (!r.ok) {
            if (r.estado === 404) return { ok: true, synced: false, totalCount: 0, items: [] };
            return r;
        }
        const d = r.data || {};
        const items = Array.isArray(d.items) ? d.items : [];
        return {
            ok: true,
            synced: true,
            companyId: d.companyId || companyId.trim(),
            rut: d.rut || '',
            source: d.source || 'MIRROR_DB',
            totalCount: Number(d.totalCount) || items.length,
            items
        };
    }

    async function obtenerTgr(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const params = ['amountFormat=number'];
        if (opts.period !== undefined && opts.period !== null && String(opts.period).trim() !== '') {
            const per = normalizarPeriodo(opts.period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            params.push('period=' + per);
        }
        if (opts.estadoPago) {
            const estP = String(opts.estadoPago).trim().toUpperCase();
            if (ESTADOS_TGR.indexOf(estP) < 0) return { ok: false, estado: 400, codigo: 'estado_tgr_invalido', error: 'Estado TGR inválido.' };
            params.push('estadoPago=' + encodeURIComponent(estP));
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/tgr?' + params.join('&'));
        if (!r.ok) {
            if (r.estado === 404) return { ok: true, synced: false, totalCount: 0, totalAdeudado: 0, totalMultasIntereses: 0, items: [] };
            return r;
        }
        const d = r.data || {};
        const items = Array.isArray(d.items) ? d.items : [];
        return {
            ok: true,
            synced: true,
            companyId: d.companyId || companyId.trim(),
            rut: d.rut || '',
            source: d.source || 'MIRROR_DB',
            totalCount: Number(d.totalCount) || items.length,
            totalAdeudado: Number(d.totalAdeudado) || 0,
            totalMultasIntereses: Number(d.totalMultasIntereses) || 0,
            items
        };
    }

    async function obtenerPrevired(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        const params = ['amountFormat=number'];
        if (opts.period !== undefined && opts.period !== null && String(opts.period).trim() !== '') {
            const per = normalizarPeriodo(opts.period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            params.push('period=' + per);
        }
        if (opts.estado) {
            const est = String(opts.estado).trim().toUpperCase();
            if (ESTADOS_PREVIRED.indexOf(est) < 0) return { ok: false, estado: 400, codigo: 'estado_previred_invalido', error: 'Estado PreviRed inválido.' };
            params.push('estado=' + encodeURIComponent(est));
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/previred?' + params.join('&'));
        if (!r.ok) {
            if (r.estado === 404) return { ok: true, synced: false, totalCount: 0, totalDeudaEstimada: 0, hasLeyBustosRisk: false, items: [] };
            return r;
        }
        const d = r.data || {};
        const items = Array.isArray(d.items) ? d.items : [];
        return {
            ok: true,
            synced: true,
            companyId: d.companyId || companyId.trim(),
            rut: d.rut || '',
            source: d.source || 'MIRROR_DB',
            totalCount: Number(d.totalCount) || items.length,
            totalDeudaEstimada: Number(d.totalDeudaEstimada) || 0,
            hasLeyBustosRisk: Boolean(d.hasLeyBustosRisk),
            items
        };
    }

    async function obtenerAlertas(cuentaId, companyId, opts = {}) {
        if (!idValido(companyId)) return { ok: false, estado: 400, codigo: 'company_invalida', error: 'Identificador de empresa inválido.' };
        let qs = '';
        if (opts.period !== undefined && opts.period !== null && String(opts.period).trim() !== '') {
            const per = normalizarPeriodo(opts.period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            qs = '?period=' + per;
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/' + encodeURIComponent(companyId.trim()) + '/alerts' + qs);
        if (!r.ok) return r;
        const d = r.data || {};
        const alerts = Array.isArray(d.alerts) ? d.alerts : [];
        return {
            ok: true,
            companyId: d.companyId || companyId.trim(),
            rut: d.rut || '',
            period: d.period || '',
            totalAlerts: Number(d.totalAlerts) || alerts.length,
            alerts
        };
    }

    async function obtenerAlertasEstudio(cuentaId, opts = {}) {
        let qs = '';
        if (opts.period !== undefined && opts.period !== null && String(opts.period).trim() !== '') {
            const per = normalizarPeriodo(opts.period);
            if (!per) return { ok: false, estado: 400, codigo: 'periodo_invalido', error: 'Indica un período válido (YYYY-MM).' };
            qs = '?period=' + per;
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/accounting/alerts' + qs);
        if (!r.ok) return r;
        const d = r.data || {};
        const alerts = Array.isArray(d.alerts) ? d.alerts : [];
        return {
            ok: true,
            period: d.period || '',
            externalAccountId: d.externalAccountId || String(cuentaId),
            totalAlerts: Number(d.totalAlerts) || alerts.length,
            alerts
        };
    }

    function urlWebhookValida(rawUrl) {
        try {
            const u = new URL(String(rawUrl || '').trim());
            if (u.protocol !== 'https:') return null;
            const host = u.hostname.toLowerCase();
            if (!host || host === 'localhost' || host.endsWith('.local') || /^127\.0\.0\.1$|^0\.0\.0\.0$|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
                return null;
            }
            return u.toString();
        } catch (e) {
            return null;
        }
    }

    async function listarWebhooks(cuentaId) {
        const r = await pedir(cuentaId, 'GET', '/api/v1/webhooks');
        if (!r.ok) return r;
        const items = r.data && Array.isArray(r.data.items) ? r.data.items : [];
        return { ok: true, items };
    }

    async function crearWebhook(cuentaId, entrada) {
        const b = entrada && typeof entrada === 'object' ? entrada : {};
        const url = urlWebhookValida(b.url);
        if (!url) {
            return { ok: false, estado: 400, codigo: 'webhook_url_invalida', error: 'Ingresa una URL pública válida con HTTPS.' };
        }
        const rawEv = Array.isArray(b.events) ? b.events : [];
        const events = rawEv.map(x => String(x || '').trim()).filter((x, i, a) => x && WEBHOOK_EVENTS.indexOf(x) >= 0 && a.indexOf(x) === i);
        if (!events.length) {
            return { ok: false, estado: 400, codigo: 'webhook_eventos_invalidos', error: 'Selecciona al menos un evento válido para el webhook.' };
        }
        const payload = { url, events };
        if (typeof b.description === 'string' && b.description.trim()) {
            payload.description = b.description.trim().slice(0, 160);
        }
        const r = await pedir(cuentaId, 'POST', '/api/v1/webhooks', payload);
        if (!r.ok) return r;
        return { ok: true, estado: r.estado, webhook: r.data };
    }

    async function eliminarWebhook(cuentaId, webhookId) {
        if (!idValido(webhookId)) {
            return { ok: false, estado: 400, codigo: 'webhook_invalido', error: 'Identificador de webhook inválido.' };
        }
        const r = await pedir(cuentaId, 'DELETE', '/api/v1/webhooks/' + encodeURIComponent(webhookId.trim()));
        if (!r.ok) return r;
        return Object.assign({ ok: true, deleted: true }, r.data || { id: webhookId.trim() });
    }

    async function probarWebhook(cuentaId, webhookId) {
        if (!idValido(webhookId)) {
            return { ok: false, estado: 400, codigo: 'webhook_invalido', error: 'Identificador de webhook inválido.' };
        }
        const r = await pedir(cuentaId, 'POST', '/api/v1/webhooks/' + encodeURIComponent(webhookId.trim()) + '/test', {});
        if (!r.ok) return r;
        return { ok: true, test: r.data };
    }

    async function entregasWebhook(cuentaId, webhookId) {
        if (!idValido(webhookId)) {
            return { ok: false, estado: 400, codigo: 'webhook_invalido', error: 'Identificador de webhook inválido.' };
        }
        const r = await pedir(cuentaId, 'GET', '/api/v1/webhooks/' + encodeURIComponent(webhookId.trim()) + '/deliveries');
        if (!r.ok) return r;
        const items = r.data && Array.isArray(r.data.items) ? r.data.items : (Array.isArray(r.data) ? r.data : []);
        return { ok: true, items };
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
        sincronizarTodas,
        estadoSync,
        obtenerRcv,
        obtenerBhe,
        obtenerF29,
        enviarAcuseRcv,
        listarTokensMcp,
        crearTokenMcp,
        obtenerF22,
        obtenerDdjj,
        obtenerTgr,
        obtenerPrevired,
        obtenerAlertas,
        obtenerAlertasEstudio,
        listarWebhooks,
        crearWebhook,
        eliminarWebhook,
        probarWebhook,
        entregasWebhook,
        revocarTokenMcp,
        desconectarCuenta,
        normalizarPeriodo
    };
}

function verificarFirmaWebhook({ rawBody, signatureHeader, secret, ahoraSeg, toleranciaSeg = 300 } = {}) {
    if (!secret || typeof secret !== 'string') return { ok: false, motivo: 'sin_secreto' };
    if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) return { ok: false, motivo: 'sin_firma' };
    const partes = {};
    signatureHeader.split(',').forEach(seg => {
        const idx = seg.indexOf('=');
        if (idx > 0) partes[seg.slice(0, idx).trim()] = seg.slice(idx + 1).trim();
    });
    const ts = Number(partes.t);
    const sig = String(partes.v1 || '').toLowerCase();
    if (!Number.isInteger(ts) || ts <= 0 || !/^[0-9a-f]{64}$/.test(sig)) {
        return { ok: false, motivo: 'formato_invalido' };
    }
    const ahora = Number.isFinite(ahoraSeg) ? ahoraSeg : Math.floor(Date.now() / 1000);
    if (Math.abs(ahora - ts) > toleranciaSeg) {
        return { ok: false, motivo: 'firma_expirada' };
    }
    const cuerpo = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody == null ? '' : rawBody);
    const esperado = crypto.createHmac('sha256', secret).update(String(ts) + '.' + cuerpo, 'utf8').digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(esperado, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, motivo: 'firma_no_coincide' };
    }
    return { ok: true, timestamp: ts };
}

module.exports = { crear, normalizarPeriodo, idValido, verificarFirmaWebhook, WEBHOOK_EVENTS };
