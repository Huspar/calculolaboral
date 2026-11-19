/* Pruebas del proxy server-side SII Gateway en api/_estudio/sii_gateway.js y api/_pyme/rutas.js: node tools/test_sii_gateway.js */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const SiiGateway = require('../api/_estudio/sii_gateway');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
const Rut = require('../js/rut_cl');
const { crearRutas } = require('../api/_pyme/rutas');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');

let ok = 0;
let cola = Promise.resolve();
function caso(nombre, fn) {
    cola = cola.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); }
        catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message)); process.exitCode = 1; }
    });
}

const SITIO = 'https://calculolaboral.cl';
const JSON_OK = { 'content-type': 'application/json', 'x-cl-pyme': '1', origin: SITIO };
const rutValido = (c) => {
    let s = 0, m = 2;
    for (let i = String(c).length - 1; i >= 0; i--) { s += +String(c)[i] * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    return Rut.formatear(c + (r === 11 ? '0' : r === 10 ? 'K' : String(r)));
};

function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = {
        statusCode: 0,
        headers: {},
        cuerpo: '',
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end(c) { this.cuerpo = c || ''; }
    };
    return Promise.resolve(rutas(req, res)).then(() => {
        try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; }
        return res;
    });
}

function montar({ apiKey = 'gw-secret-test-key', rolOverride = null, mockFetch } = {}) {
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, enviarCorreo: async m => enviados.push(m) });
    const datos = D.crear({ almacen, cifrado });
    const llamadasFetch = [];
    const fetchFn = mockFetch || (async (url, opts) => {
        llamadasFetch.push({ url, method: opts.method, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : null });
        const u = new URL(url);
        const path = u.pathname;
        if (path === '/api/v1/companies' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ items: [{ id: 'cmp_1', rut: '76.543.210-3', razonSocial: 'Panaderia SpA' }] }) };
        }
        if (path === '/api/v1/companies' && opts.method === 'POST') {
            const b = JSON.parse(opts.body);
            return { ok: true, status: 201, text: async () => JSON.stringify(Object.assign({ id: 'cmp_nueva', tenantId: 't_1' }, b)) };
        }
        if (path === '/api/v1/companies/cmp_1' && opts.method === 'DELETE') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ deleted: true, companyId: 'cmp_1' }) };
        }
        if (path === '/api/v1/companies/cmp_1/status' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', hasCredentials: true, credentials: [{ id: 'cr_1', kind: 'CLAVE_TRIBUTARIA', isActive: true }], latestJob: null }) };
        }
        if (path === '/api/v1/companies/cmp_1/credentials' && opts.method === 'POST') {
            return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'cr_1', companyId: 'cmp_1', kind: JSON.parse(opts.body).kind, siiEnv: 'PRODUCTION', isActive: true, claveTributaria: 'NO_DEBE_PASAR' }) };
        }
        if (path === '/api/v1/companies/cmp_1/credentials' && opts.method === 'DELETE') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ deletedCount: 1 }) };
        }
        if (path === '/api/v1/accounting/cmp_1/sync' && opts.method === 'POST') {
            return { ok: true, status: 202, text: async () => JSON.stringify({ jobId: 'job_99', bullmqJobId: 'bq_99', status: 'QUEUED' }) };
        }
        if (path === '/api/v1/accounting/cmp_1/sync/job_99' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ jobId: 'job_99', status: 'COMPLETED' }) };
        }
        if (path === '/api/v1/accounting/cmp_1/rcv/acuse' && opts.method === 'POST') {
            const b = JSON.parse(opts.body || '{}');
            if (b.folio === 999) {
                return { ok: false, status: 422, text: async () => JSON.stringify({ code: 'PFX_REQUIRED_FOR_ACUSE', message: 'Se requiere certificado digital .pfx para enviar acuses al SII.' }) };
            }
            return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, idempotent: false, companyId: 'cmp_1', tipoDoc: b.tipoDoc, folio: b.folio, rutEmisor: b.rutEmisor, accion: b.accion, estadoContab: (b.accion === 'ACD' || b.accion === 'ERM') ? 'REGISTRO' : 'RECLAMADO', fechaAcuse: '2026-11-18T13:30:00Z' }) };
        }
        if (path === '/api/v1/mcp/tokens' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ items: [{ id: 'tok_1', label: 'Oficina', prefix: 'smcp_live_abc', createdAt: '2026-11-18T12:00:00Z', lastUsedAt: null, revokedAt: null }] }) };
        }
        if (path === '/api/v1/mcp/tokens' && opts.method === 'POST') {
            const b = JSON.parse(opts.body || '{}');
            return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'tok_2', label: b.label || '', prefix: 'smcp_live_xyz', createdAt: '2026-11-18T13:00:00Z', lastUsedAt: null, revokedAt: null, token: 'smcp_live_xyz_secreto_unico' }) };
        }
        if (path === '/api/v1/mcp/tokens/tok_1' && opts.method === 'DELETE') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ revoked: true, id: 'tok_1', revokedAt: '2026-11-18T13:05:00Z' }) };
        }
        if (path === '/api/v1/accounting/sync-all' && opts.method === 'POST') {
            return { ok: true, status: 202, text: async () => JSON.stringify({ period: '202611', enqueuedCount: 1, skippedCount: 0, jobs: [{ companyId: 'cmp_1', rut: '76.543.210-3', jobId: 'job_all_1' }] }) };
        }
        if (path === '/api/v1/accounting/cmp_1/rcv' && opts.method === 'GET') {
            const offset = Number(u.searchParams.get('offset') || 0);
            const docs = offset === 0
                ? [{ tipoDoc: 33, folio: 100, montoNeto: 100000, montoIvaRecuperable: 19000, montoTotal: 119000, operacion: 'VENTA', estadoContab: 'REGISTRO' }]
                : [{ tipoDoc: 33, folio: 101, montoNeto: 200000, montoIvaRecuperable: 38000, montoTotal: 238000, operacion: 'VENTA', estadoContab: 'REGISTRO' }];
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', period: '202611', totalCount: 2, documents: docs }) };
        }
        if (path === '/api/v1/accounting/cmp_1/bhe' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', period: '202611', totalCount: 1, items: [{ numeroBoleta: 12, montoBruto: 100000, montoRetencion: 15250, montoLiquido: 84750, estado: 'VIGENTE' }] }) };
        }
        if (path === '/api/v1/accounting/cmp_1/f29' && opts.method === 'GET') {
            return { ok: false, status: 404, text: async () => JSON.stringify({ code: 'F29_NOT_SYNCED', message: 'Sin F29' }) };
        }
        if (path === '/api/v1/accounting/cmp_1/f22' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', rut: '76.543.210-3', source: 'SII_PORTAL', summary: { anioTributario: 2026, estado: 'OBSERVADO', montoResultado: 1250000 } }) };
        }
        if (path === '/api/v1/accounting/cmp_1/ddjj' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', rut: '76.543.210-3', source: 'SII_PORTAL', totalCount: 1, items: [{ codigo: '1887', estado: 'ACEPTADA', anioTributario: 2026 }] }) };
        }
        if (path === '/api/v1/accounting/cmp_1/tgr' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', rut: '76.543.210-3', source: 'TGR_PORTAL', totalCount: 1, totalAdeudado: 450000, totalMultasIntereses: 25000, items: [{ folio: 'F-901', estadoPago: 'PENDIENTE', montoTotal: 450000 }] }) };
        }
        if (path === '/api/v1/accounting/cmp_1/previred' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', rut: '76.543.210-3', source: 'PREVIRED_PORTAL', totalCount: 1, totalDeudaEstimada: 380000, hasLeyBustosRisk: true, items: [{ periodo: '202611', estado: 'MOROSO', deudaEstimada: 380000 }] }) };
        }
        if (path === '/api/v1/accounting/cmp_1/alerts' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ companyId: 'cmp_1', rut: '76.543.210-3', period: '202611', totalAlerts: 1, alerts: [{ code: 'PREVIRED_UNPAID_OR_OVERDUE', severity: 'CRITICAL', amountAtRisk: 380000, title: 'Cotizaciones impagas', detail: 'Riesgo Ley Bustos' }] }) };
        }
        if (path === '/api/v1/accounting/alerts' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ period: '202611', externalAccountId: 'acct_1', totalAlerts: 2, alerts: [{ companyId: 'cmp_1', rut: '76.543.210-3', code: 'TGR_DEBT_OR_UNPAID', severity: 'WARNING', amountAtRisk: 450000, title: 'Deuda TGR pendiente' }, { companyId: 'cmp_1', rut: '76.543.210-3', code: 'PREVIRED_UNPAID_OR_OVERDUE', severity: 'CRITICAL', amountAtRisk: 380000, title: 'PreviRed impago' }] }) };
        }
        if (path === '/api/v1/webhooks' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ items: [{ id: 'wh_1', url: 'https://www.calculolaboral.cl/api/pyme/gateway-webhook', events: ['*'], active: true }] }) };
        }
        if (path === '/api/v1/webhooks' && opts.method === 'POST') {
            const b = JSON.parse(opts.body || '{}');
            return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'wh_nueva', url: b.url, events: b.events, description: b.description || '', signingSecret: 'whsec_test_secret_123', active: true }) };
        }
        if (path === '/api/v1/webhooks/wh_1' && opts.method === 'DELETE') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ deleted: true, id: 'wh_1' }) };
        }
        if (path === '/api/v1/webhooks/wh_1/test' && opts.method === 'POST') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, delivered: true, statusCode: 200 }) };
        }
        if (path === '/api/v1/webhooks/wh_1/deliveries' && opts.method === 'GET') {
            return { ok: true, status: 200, text: async () => JSON.stringify({ items: [{ id: 'del_1', event: 'webhook.test', status: 'DELIVERED', statusCode: 200, createdAt: '2026-11-19T12:00:00Z' }] }) };
        }
        return { ok: false, status: 404, text: async () => JSON.stringify({ error: 'Not found' }) };
    });

    const siiGateway = SiiGateway.crear({
        env: { SII_GATEWAY_URL: 'https://connect.calculolaboral.cl', SII_GATEWAY_API_KEY: apiKey },
        fetchFn
    });
    const authRol = Object.assign({}, auth, {
        leerSesion: async (t) => {
            const s = await auth.leerSesion(t);
            return s.autenticado && rolOverride && rolOverride.rol ? Object.assign({}, s, { rol: rolOverride.rol }) : s;
        }
    });
    const estudiosMem = new Map();
    const estudio = {
        leer: async (id) => ({ ok: true, datos: estudiosMem.has(id) ? JSON.parse(JSON.stringify(estudiosMem.get(id))) : {} }),
        guardar: async (id, d) => { estudiosMem.set(id, JSON.parse(JSON.stringify(d || {}))); return { ok: true }; }
    };
    const rutas = crearRutas({ auth: authRol, datos, estudio, env: { VERCEL_ENV: 'production' }, siteUrl: SITIO, siiGateway });

    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.1' });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cookie: 'cl_pyme=' + r.sesion.token, cuenta: await auth.leerSesion(r.sesion.token) };
    }
    return { rutas, entrar, llamadasFetch, almacen, estudiosMem };
}

caso('sin SII_GATEWAY_API_KEY devuelve 503 controlado sin llamar al gateway ni exponer secretos', async () => {
    const m = montar({ apiKey: '' });
    const { cookie } = await m.entrar('sin-clave@ejemplo.cl');
    const st = await pedir(m.rutas, { query: { ruta: 'sii-estado' }, headers: { cookie } });
    assert.strictEqual(st.statusCode, 200);
    assert.strictEqual(st.json.configured, false);

    const emp = await pedir(m.rutas, { query: { ruta: 'sii-empresas' }, headers: { cookie } });
    assert.strictEqual(emp.statusCode, 503);
    assert.strictEqual(emp.json.codigo, 'sii_gateway_no_configurado');
    assert.strictEqual(m.llamadasFetch.length, 0);
});

caso('rechaza solicitudes sin sesión (401) o sin cabecera CSRF (403)', async () => {
    const m = montar();
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'sii-empresas' } })).statusCode, 401);
    const { cookie } = await m.entrar('csrf@ejemplo.cl');
    assert.strictEqual((await pedir(m.rutas, { query: { ruta: 'sii-empresas' }, metodo: 'POST', headers: { cookie }, body: { rut: rutValido(76543210), razonSocial: 'Test' } })).statusCode, 403);
});

caso('inyecta x-api-key y x-account-id del usuario autenticado y nunca filtra secretos', async () => {
    const m = montar();
    const { cookie, cuenta } = await m.entrar('estudio@ejemplo.cl');
    const rut = rutValido(76543210);

    const cr = await pedir(m.rutas, {
        query: { ruta: 'sii-empresas' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { rut, razonSocial: 'Panaderia San Isidro SpA' }
    });
    assert.strictEqual(cr.statusCode, 200);
    assert.strictEqual(cr.json.company.id, 'cmp_nueva');
    assert.strictEqual(m.llamadasFetch[0].headers['x-api-key'], 'gw-secret-test-key');
    assert.strictEqual(m.llamadasFetch[0].headers['x-account-id'], cuenta.cuentaId);
    assert.strictEqual(m.llamadasFetch[0].body.externalAccountId, cuenta.cuentaId);

    const cred = await pedir(m.rutas, {
        query: { ruta: 'sii-credenciales', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { kind: 'CLAVE_TRIBUTARIA', claveTributaria: 'mi-clave-secreta-123' }
    });
    assert.strictEqual(cred.statusCode, 200);
    assert.strictEqual(cred.json.credential.kind, 'CLAVE_TRIBUTARIA');
    const crudoResp = JSON.stringify(cred.json);
    assert.ok(!crudoResp.includes('mi-clave-secreta-123') && !crudoResp.includes('NO_DEBE_PASAR') && !crudoResp.includes('gw-secret-test-key'));

    const actCrudo = JSON.stringify(m.almacen._estado.actividad);
    assert.ok(!actCrudo.includes('mi-clave-secreta-123') && !actCrudo.includes('gw-secret-test-key'));
});

caso('respeta permisos por rol: lectura no muta y contador sincroniza pero no cambia credenciales', async () => {
    const rol = { rol: 'contador' };
    const m = montar({ rolOverride: rol });
    const { cookie } = await m.entrar('equipo@ejemplo.cl');

    const sync = await pedir(m.rutas, {
        query: { ruta: 'sii-sync', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { period: '2026-11', jobType: 'FULL_SYNC' }
    });
    assert.strictEqual(sync.statusCode, 200);
    assert.strictEqual(sync.json.job.jobId, 'job_99');

    const cred = await pedir(m.rutas, {
        query: { ruta: 'sii-credenciales', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { kind: 'CLAVE_TRIBUTARIA', claveTributaria: 'abc' }
    });
    assert.strictEqual(cred.statusCode, 403);
    assert.strictEqual(cred.json.codigo, 'sin_permiso');
});

caso('pagina RCV con limit=1 cuando all=1, lee BHE y maneja 404 F29_NOT_SYNCED', async () => {
    const m = montar();
    const { cookie } = await m.entrar('datos@ejemplo.cl');

    const rcv = await pedir(m.rutas, {
        query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'rcv', period: '2026-11', limit: '1', all: '1' },
        headers: { cookie }
    });
    assert.strictEqual(rcv.statusCode, 200);
    assert.strictEqual(rcv.json.rcv.documents.length, 2);
    assert.ok(m.llamadasFetch[0].url.includes('amountFormat=number'));
    assert.ok(m.llamadasFetch[0].url.includes('period=202611'));

    const bhe = await pedir(m.rutas, {
        query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'bhe', period: '202611' },
        headers: { cookie }
    });
    assert.strictEqual(bhe.statusCode, 200);
    assert.strictEqual(bhe.json.bhe.items[0].montoRetencion, 15250);

    const f29 = await pedir(m.rutas, {
        query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'f29', period: '2026-11' },
        headers: { cookie }
    });
    assert.strictEqual(f29.statusCode, 200);
    assert.strictEqual(f29.json.synced, false);
    assert.strictEqual(f29.json.codigo, 'F29_NOT_SYNCED');
});

caso('borrar-cuenta limpia empresas vinculadas en SII Gateway (Ley 21.719)', async () => {
    const m = montar();
    const { cookie } = await m.entrar('baja@ejemplo.cl');
    const del = await pedir(m.rutas, {
        query: { ruta: 'borrar-cuenta' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { confirmar: 'baja@ejemplo.cl' }
    });
    assert.strictEqual(del.statusCode, 200);
    assert.ok(m.llamadasFetch.some(c => c.method === 'DELETE' && c.url.endsWith('/api/v1/companies/cmp_1')));
});

caso('sii-sync-all encola sincronización batch por cuenta y valida período', async () => {
    const m = montar();
    const { cookie, cuenta } = await m.entrar('batch@ejemplo.cl');
    const bad = await pedir(m.rutas, {
        query: { ruta: 'sii-sync-all' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { period: 'invalido' }
    });
    assert.strictEqual(bad.statusCode, 400);

    const okBatch = await pedir(m.rutas, {
        query: { ruta: 'sii-sync-all' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { period: '2026-11' }
    });
    assert.strictEqual(okBatch.statusCode, 200);
    assert.strictEqual(okBatch.json.batch.enqueuedCount, 1);
    assert.strictEqual(m.llamadasFetch[0].headers['x-account-id'], cuenta.cuentaId);
    assert.deepStrictEqual(m.llamadasFetch[0].body, { period: '202611' });
});

caso('mcp-tokens lista, crea y revoca tokens con aislamiento por cuenta y permiso de rol', async () => {
    const sinSes = await pedir(montar().rutas, { query: { ruta: 'mcp-tokens' } });
    assert.strictEqual(sinSes.statusCode, 401);

    const m = montar();
    const { cookie, cuenta } = await m.entrar('mcp@ejemplo.cl');
    const lista = await pedir(m.rutas, { query: { ruta: 'mcp-tokens' }, headers: { cookie } });
    assert.strictEqual(lista.statusCode, 200);
    assert.strictEqual(lista.json.items.length, 1);
    assert.strictEqual(lista.json.items[0].id, 'tok_1');
    assert.strictEqual(m.llamadasFetch[0].headers['x-account-id'], cuenta.cuentaId);

    const creado = await pedir(m.rutas, {
        query: { ruta: 'mcp-tokens' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { label: 'Claude Oficina' }
    });
    assert.strictEqual(creado.statusCode, 200);
    assert.strictEqual(creado.json.token.token, 'smcp_live_xyz_secreto_unico');
    assert.deepStrictEqual(m.llamadasFetch[1].body, { label: 'Claude Oficina' });

    const revBad = await pedir(m.rutas, {
        query: { ruta: 'mcp-tokens', id: 'bad/id' },
        metodo: 'DELETE',
        headers: Object.assign({}, JSON_OK, { cookie })
    });
    assert.strictEqual(revBad.statusCode, 400);

    const revOk = await pedir(m.rutas, {
        query: { ruta: 'mcp-tokens', id: 'tok_1' },
        metodo: 'DELETE',
        headers: Object.assign({}, JSON_OK, { cookie })
    });
    assert.strictEqual(revOk.statusCode, 200);
    assert.strictEqual(revOk.json.revoked, true);

    const rolLectura = { rol: 'lectura' };
    const mLec = montar({ rolOverride: rolLectura });
    const sesLec = await mLec.entrar('lector@ejemplo.cl');
    const denegado = await pedir(mLec.rutas, {
        query: { ruta: 'mcp-tokens' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie: sesLec.cookie }),
        body: {}
    });
    assert.strictEqual(denegado.statusCode, 403);
});

caso('sii-acuse valida campos, reenvía PFX_REQUIRED_FOR_ACUSE y envía ERM al gateway', async () => {
    const m = montar();
    const { cookie } = await m.entrar('acuse@ejemplo.cl');
    const badAcc = await pedir(m.rutas, {
        query: { ruta: 'sii-acuse', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { tipoDoc: 33, folio: 120, rutEmisor: rutValido(76111222), accion: 'XYZ' }
    });
    assert.strictEqual(badAcc.statusCode, 400);

    const sinPfx = await pedir(m.rutas, {
        query: { ruta: 'sii-acuse', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { tipoDoc: 33, folio: 999, rutEmisor: rutValido(76111222), accion: 'ERM' }
    });
    assert.strictEqual(sinPfx.statusCode, 422);
    assert.strictEqual(sinPfx.json.codigo, 'PFX_REQUIRED_FOR_ACUSE');

    const okErm = await pedir(m.rutas, {
        query: { ruta: 'sii-acuse', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { tipoDoc: 33, folio: 120, rutEmisor: rutValido(76111222), accion: 'ERM', period: '2026-11' }
    });
    assert.strictEqual(okErm.statusCode, 200);
    assert.strictEqual(okErm.json.acuse.estadoContab, 'REGISTRO');
    assert.strictEqual(m.llamadasFetch[1].body.period, '202611');
});

caso('credenciales PREVIRED_CREDENTIALS guarda y revoca sin filtrar password', async () => {
    const m = montar();
    const { cookie } = await m.entrar('previred@ejemplo.cl');
    const bad = await pedir(m.rutas, {
        query: { ruta: 'sii-credenciales', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { kind: 'PREVIRED_CREDENTIALS', rutUsuario: rutValido(15234567) }
    });
    assert.strictEqual(bad.statusCode, 400);

    const okCred = await pedir(m.rutas, {
        query: { ruta: 'sii-credenciales', companyId: 'cmp_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { kind: 'PREVIRED_CREDENTIALS', rutUsuario: rutValido(15234567), password: 'mi-pass-previred-99' }
    });
    assert.strictEqual(okCred.statusCode, 200);
    assert.strictEqual(okCred.json.credential.kind, 'PREVIRED_CREDENTIALS');
    assert.ok(!JSON.stringify(okCred.json).includes('mi-pass-previred-99'));
    assert.ok(!JSON.stringify(m.almacen._estado.actividad).includes('mi-pass-previred-99'));

    const del = await pedir(m.rutas, {
        query: { ruta: 'sii-credenciales', companyId: 'cmp_1', kind: 'PREVIRED_CREDENTIALS', siiEnv: 'PRODUCTION' },
        metodo: 'DELETE',
        headers: Object.assign({}, JSON_OK, { cookie })
    });
    assert.strictEqual(del.statusCode, 200);
    assert.strictEqual(del.json.deletedCount, 1);
});

caso('nuevos jobTypes y endpoints f22, ddjj, tgr, previred, alerts y alerts-all', async () => {
    const m = montar();
    const { cookie } = await m.entrar('modulos@ejemplo.cl');
    for (const jt of ['F22_SUMMARY', 'DDJJ_SUMMARY', 'TGR_DEBT', 'PREVIRED_STATUS']) {
        const r = await pedir(m.rutas, {
            query: { ruta: 'sii-sync', companyId: 'cmp_1' },
            metodo: 'POST',
            headers: Object.assign({}, JSON_OK, { cookie }),
            body: { period: '2026-11', jobType: jt }
        });
        assert.strictEqual(r.statusCode, 200);
    }
    const batchTgr = await pedir(m.rutas, {
        query: { ruta: 'sii-sync-all' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { period: '2026-11', jobType: 'TGR_DEBT' }
    });
    assert.strictEqual(batchTgr.statusCode, 200);
    assert.strictEqual(m.llamadasFetch[4].body.jobType, 'TGR_DEBT');

    const f22 = await pedir(m.rutas, { query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'f22', anioTributario: '2026' }, headers: { cookie } });
    assert.strictEqual(f22.statusCode, 200);
    assert.strictEqual(f22.json.summary.estado, 'OBSERVADO');

    const ddjj = await pedir(m.rutas, { query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'ddjj', anioTributario: '2026' }, headers: { cookie } });
    assert.strictEqual(ddjj.statusCode, 200);
    assert.strictEqual(ddjj.json.items[0].codigo, '1887');

    const tgr = await pedir(m.rutas, { query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'tgr', period: '2026-11' }, headers: { cookie } });
    assert.strictEqual(tgr.statusCode, 200);
    assert.strictEqual(tgr.json.totalAdeudado, 450000);

    const prev = await pedir(m.rutas, { query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'previred', period: '2026-11' }, headers: { cookie } });
    assert.strictEqual(prev.statusCode, 200);
    assert.strictEqual(prev.json.hasLeyBustosRisk, true);

    const al = await pedir(m.rutas, { query: { ruta: 'sii-datos', companyId: 'cmp_1', tipo: 'alerts', period: '2026-11' }, headers: { cookie } });
    assert.strictEqual(al.statusCode, 200);
    assert.strictEqual(al.json.totalAlerts, 1);

    const allAl = await pedir(m.rutas, { query: { ruta: 'sii-datos', tipo: 'alerts-all', period: '2026-11' }, headers: { cookie } });
    assert.strictEqual(allAl.statusCode, 200);
    assert.strictEqual(allAl.json.totalAlerts, 2);
});

caso('sii-webhooks CRUD, test, entregas y permiso de lectura', async () => {
    const m = montar();
    const { cookie, cuenta } = await m.entrar('wh@ejemplo.cl');

    const lista = await pedir(m.rutas, { query: { ruta: 'sii-webhooks' }, headers: { cookie } });
    assert.strictEqual(lista.statusCode, 200);
    assert.strictEqual(lista.json.items.length, 1);

    const creado = await pedir(m.rutas, {
        query: { ruta: 'sii-webhooks' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { url: 'https://www.calculolaboral.cl/api/pyme/gateway-webhook', events: ['sync.completed', 'tgr.debt_detected'], description: 'Estudio' }
    });
    assert.strictEqual(creado.statusCode, 200);
    assert.strictEqual(creado.json.webhook.signingSecret, 'whsec_test_secret_123');
    assert.strictEqual(m.estudiosMem.get(cuenta.cuentaId).gatewayWebhookConfig.signingSecret, 'whsec_test_secret_123');

    const prueba = await pedir(m.rutas, {
        query: { ruta: 'sii-webhooks', action: 'test', webhookId: 'wh_1' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { webhookId: 'wh_1' }
    });
    assert.strictEqual(prueba.statusCode, 200);
    assert.strictEqual(prueba.json.test.delivered, true);

    const ent = await pedir(m.rutas, { query: { ruta: 'sii-webhooks', webhookId: 'wh_1', deliveries: '1' }, headers: { cookie } });
    assert.strictEqual(ent.statusCode, 200);
    assert.strictEqual(ent.json.items[0].event, 'webhook.test');

    const del = await pedir(m.rutas, { query: { ruta: 'sii-webhooks', webhookId: 'wh_1' }, metodo: 'DELETE', headers: Object.assign({}, JSON_OK, { cookie }) });
    assert.strictEqual(del.statusCode, 200);
    assert.strictEqual(del.json.deleted, true);

    const mLec = montar({ rolOverride: { rol: 'lectura' } });
    const sesL = await mLec.entrar('lecwh@ejemplo.cl');
    const forb = await pedir(mLec.rutas, {
        query: { ruta: 'sii-webhooks' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie: sesL.cookie }),
        body: { url: 'https://www.calculolaboral.cl/api/pyme/gateway-webhook', events: ['*'] }
    });
    assert.strictEqual(forb.statusCode, 403);
});

caso('gateway-webhook verifica HMAC-SHA256, rechaza firma inválida/expirada y guarda máx 25 avisos', async () => {
    const m = montar();
    const { cookie, cuenta } = await m.entrar('receptor@ejemplo.cl');
    const creado = await pedir(m.rutas, {
        query: { ruta: 'sii-webhooks' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { url: 'https://www.calculolaboral.cl/api/pyme/gateway-webhook', events: ['*'] }
    });
    assert.strictEqual(creado.statusCode, 200);
    const secret = 'whsec_test_secret_123';

    const payload = JSON.stringify({ externalAccountId: cuenta.cuentaId, companyId: 'cmp_1', severity: 'CRITICAL', title: 'Deuda PreviRed detectada' });
    const ahora = Math.floor(Date.now() / 1000);
    const firmaOk = 't=' + ahora + ',v1=' + crypto.createHmac('sha256', secret).update(ahora + '.' + payload).digest('hex');

    // Firma alterada -> 401
    const mala = await pedir(m.rutas, {
        query: { ruta: 'gateway-webhook' },
        metodo: 'POST',
        headers: { 'content-type': 'application/json', 'x-sii-signature': 't=' + ahora + ',v1=' + '0'.repeat(64), 'x-sii-event': 'previred.overdue_detected', 'x-sii-delivery': 'del_bad' },
        body: JSON.parse(payload)
    });
    assert.strictEqual(mala.statusCode, 401);

    // Timestamp expirado (>5 min) -> 401
    const viejoTs = ahora - 400;
    const firmaVieja = 't=' + viejoTs + ',v1=' + crypto.createHmac('sha256', secret).update(viejoTs + '.' + payload).digest('hex');
    const exp = await pedir(m.rutas, {
        query: { ruta: 'gateway-webhook' },
        metodo: 'POST',
        headers: { 'content-type': 'application/json', 'x-sii-signature': firmaVieja, 'x-sii-event': 'previred.overdue_detected', 'x-sii-delivery': 'del_old' },
        body: JSON.parse(payload)
    });
    assert.strictEqual(exp.statusCode, 401);

    // 27 entregas válidas -> 200 y tope de 25 en estudio.gatewayWebhooks.ultimosAvisos
    for (let i = 0; i < 27; i++) {
        const bodyObj = { externalAccountId: cuenta.cuentaId, companyId: 'cmp_1', severity: 'CRITICAL', title: 'Aviso #' + i };
        const raw = JSON.stringify(bodyObj);
        const sig = 't=' + ahora + ',v1=' + crypto.createHmac('sha256', secret).update(ahora + '.' + raw).digest('hex');
        const req = { method: 'POST', query: { ruta: 'gateway-webhook' }, headers: { 'content-type': 'application/json', 'x-sii-signature': sig, 'x-sii-event': 'tgr.debt_detected', 'x-sii-delivery': 'del_' + i }, rawBody: raw, body: bodyObj };
        const res = { statusCode: 0, headers: {}, cuerpo: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(c) { this.cuerpo = c || ''; } };
        await m.rutas(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(JSON.parse(res.cuerpo).received, true);
    }
    const rec = await pedir(m.rutas, { query: { ruta: 'sii-webhooks', recibidos: '1' }, headers: { cookie } });
    assert.strictEqual(rec.statusCode, 200);
    assert.strictEqual(rec.json.receptor.configurado, true);
    assert.strictEqual(rec.json.receptor.ultimosAvisos.length, 25);
    assert.strictEqual(rec.json.receptor.ultimosAvisos[0].deliveryId, 'del_26');
});

cola.then(() => {
    console.log(process.exitCode ? 'HAY FALLAS' : (ok + ' pruebas correctas en SII Gateway proxy'));
});
