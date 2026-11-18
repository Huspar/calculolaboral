// Pruebas del Portal Cliente Marca Blanca del estudio: node tools/test_portal_estudio.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const Est = require('../api/_estudio/datos');
const PE = require('../api/_estudio/portal_estudio');
const A = require('../api/_pyme/auth');
const T = require('../api/_pyme/tokens');
const Cif = require('../api/_pyme/cifrado');
const D = require('../api/_pyme/datos');
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

function montar({ rolOverride = null } = {}) {
    const reloj = { t: Date.parse('2026-11-18T12:00:00Z') };
    const almacen = crearAlmacenMemoria();
    const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
    const cifrado = Cif.crear(Cif.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
    const filasPortal = [];

    const consulta = async (sql, params) => {
        if (/CREATE TABLE/i.test(sql)) return [];
        if (/SELECT count\(\*\)/i.test(sql)) {
            const [cuentaId, ahoraIso] = params;
            const n = filasPortal.filter(r => r.cuenta_id === cuentaId && !r.revocado && new Date(r.vence).getTime() > new Date(ahoraIso).getTime()).length;
            return [{ n }];
        }
        if (/INSERT INTO portal_estudio/i.test(sql)) {
            const [id, cuenta_id, cliente_nombre, cliente_rut, periodo, token_hash, seccionesJson, datos_cifrados, version_clave, creado, vence] = params;
            filasPortal.push({
                id, cuenta_id, cliente_nombre, cliente_rut, periodo, token_hash,
                secciones: JSON.parse(seccionesJson), datos_cifrados, version_clave,
                creado, vence, revocado: null, ultimo_acceso: null, accesos: 0
            });
            return [];
        }
        if (/FROM portal_estudio\s+WHERE cuenta_id/i.test(sql)) {
            return filasPortal.filter(r => r.cuenta_id === params[0]).slice().reverse();
        }
        if (/UPDATE portal_estudio\s+SET revocado/i.test(sql)) {
            const [id, cuentaId, ahoraIso] = params;
            const f = filasPortal.find(r => r.id === id && r.cuenta_id === cuentaId);
            if (!f) return [];
            if (!f.revocado) f.revocado = ahoraIso;
            return [{ id: f.id, revocado: f.revocado }];
        }
        if (/FROM portal_estudio\s+WHERE token_hash/i.test(sql)) {
            const f = filasPortal.find(r => r.token_hash === params[0]);
            return f ? [f] : [];
        }
        if (/UPDATE portal_estudio SET accesos/i.test(sql)) {
            const f = filasPortal.find(r => r.id === params[0]);
            if (f) { f.accesos++; f.ultimo_acceso = params[1]; }
            return [];
        }
        return [];
    };

    const estudio = Est.crear({ consulta, cifrado, ahora: () => reloj.t });
    const enviados = [];
    const auth = A.crear({ almacen, secreto, siteUrl: SITIO, ahora: () => reloj.t, enviarCorreo: async m => enviados.push(m) });
    const authRol = Object.assign({}, auth, {
        leerSesion: async (t) => {
            const s = await auth.leerSesion(t);
            return s.autenticado && rolOverride && rolOverride.rol ? Object.assign({}, s, { rol: rolOverride.rol }) : s;
        }
    });
    const datos = D.crear({ almacen, cifrado, ahora: () => reloj.t });
    const rutas = crearRutas({
        auth: authRol,
        datos,
        estudio,
        env: { VERCEL_ENV: 'production', PYME_SESSION_SECRET: secreto.toString('base64') },
        siteUrl: SITIO
    });

    async function entrar(correo) {
        await auth.solicitarAcceso({ email: correo, ip: '10.0.0.1' });
        const token = new URL(enviados[enviados.length - 1].enlace).searchParams.get('t');
        const r = await auth.completar({ token, acepto: true, ip: '10.0.0.1' });
        return { cookie: 'cl_pyme=' + r.sesion.token };
    }

    return { rutas, entrar, reloj, filasPortal };
}

function pedir(rutas, o) {
    const req = { method: o.metodo || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
    const res = {
        statusCode: 0, headers: {}, cuerpo: '',
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end(c) { this.cuerpo = c || ''; }
    };
    return Promise.resolve(rutas(req, res)).then(() => {
        try { res.json = JSON.parse(res.cuerpo); } catch (e) { res.json = null; }
        return res;
    });
}

const SNAPSHOT_SUCIO = {
    estudio: { nombre: 'Consultores Andinos SpA', rut: '76.111.222-3', contador: 'Ana Contador', pie: 'Confidencial' },
    cliente: { nombre: 'Panadería San Isidro SpA', rut: '76.543.210-3', periodo: '2026-11', regimen: 'ProPyme 14 D3' },
    f29: { ivaDeterminado: 150000, retenciones: 20000, ppm: 12500, totalPagar: 182500 },
    pnl: { ingresos: 10000000, costos: 4000000, gastos: 3000000, resultado: 3000000 },
    laboral: {
        cantidadTrabajadores: 1,
        totalHaberes: 950000,
        totalDescuentos: 180000,
        totalLiquido: 770000,
        totalCostoEmpresa: 1010000,
        trabajadores: [{
            nombre: 'Camila Rojas',
            rut: '15.234.567-4',
            dias: 30,
            haberes: 950000,
            descuentosLegales: 180000,
            liquido: 770000,
            banco: 'BancoEstado',
            numeroCuenta: '99887766',
            email: 'camila@privado.cl',
            diagnostico: 'Licencia reservada',
            pensionAlimentos: 120000,
            cuotaSindical: 5000
        }]
    }
};

caso('sanitizarSnapshot omite bancos, contacto, diagnostico, pensiones y enmascara RUT', () => {
    const s = PE.sanitizarSnapshot(SNAPSHOT_SUCIO, { f29: true, pnl: true, laboral: true });
    const t = s.laboral.trabajadores[0];
    assert.strictEqual(t.rut, '****4567-4');
    assert.strictEqual(t.banco, undefined);
    assert.strictEqual(t.numeroCuenta, undefined);
    assert.strictEqual(t.email, undefined);
    assert.strictEqual(t.diagnostico, undefined);
    assert.strictEqual(t.pensionAlimentos, undefined);
    assert.strictEqual(t.cuotaSindical, undefined);
    assert.ok(/21\.719/.test(s.leyendaLegal));
});

caso('portal-estudio crea enlace cifrado con hash, abre sin sesion, cuenta accesos y revoca en 1 clic', async () => {
    const m = montar();
    const { cookie } = await m.entrar('estudio@ejemplo.cl');

    const creado = await pedir(m.rutas, {
        query: { ruta: 'portal-estudio' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { diasVigencia: 15, secciones: { f29: true, pnl: false, laboral: true }, snapshot: SNAPSHOT_SUCIO }
    });
    assert.strictEqual(creado.statusCode, 200);
    assert.ok(creado.json.enlace.includes('/portal-estudio?t='));
    const tok = new URL(creado.json.enlace).searchParams.get('t');
    assert.ok(!JSON.stringify(m.filasPortal).includes(tok), 'el token en claro nunca queda en DB');

    const lista = await pedir(m.rutas, { query: { ruta: 'portal-estudio' }, headers: { cookie } });
    assert.strictEqual(lista.statusCode, 200);
    assert.strictEqual(lista.json.items.length, 1);

    const abierto = await pedir(m.rutas, { query: { ruta: 'portal-estudio', t: tok } });
    assert.strictEqual(abierto.statusCode, 200);
    assert.strictEqual(abierto.json.portal.f29.totalPagar, 182500);
    assert.strictEqual(abierto.json.portal.pnl, undefined, 'seccion desactivada no se incluye');
    assert.strictEqual(abierto.json.portal.laboral.trabajadores[0].banco, undefined);
    assert.strictEqual(m.filasPortal[0].accesos, 1);

    const rev = await pedir(m.rutas, {
        query: { ruta: 'portal-estudio', id: creado.json.id },
        metodo: 'DELETE',
        headers: Object.assign({}, JSON_OK, { cookie })
    });
    assert.strictEqual(rev.statusCode, 200);

    const trasRev = await pedir(m.rutas, { query: { ruta: 'portal-estudio', t: tok } });
    assert.strictEqual(trasRev.statusCode, 410);
    assert.strictEqual(trasRev.json.codigo, 'enlace_revocado');
});

caso('portal-estudio vence al pasar el TTL y respeta permisos de rol', async () => {
    const m = montar();
    const { cookie } = await m.entrar('ttl@ejemplo.cl');
    const creado = await pedir(m.rutas, {
        query: { ruta: 'portal-estudio' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie }),
        body: { diasVigencia: 7, secciones: { f29: true }, snapshot: SNAPSHOT_SUCIO }
    });
    const tok = new URL(creado.json.enlace).searchParams.get('t');
    m.reloj.t += 8 * 86400000;
    const vencido = await pedir(m.rutas, { query: { ruta: 'portal-estudio', t: tok } });
    assert.strictEqual(vencido.statusCode, 410);
    assert.strictEqual(vencido.json.codigo, 'enlace_vencido');

    const rol = { rol: 'contador' };
    const mRol = montar({ rolOverride: rol });
    const sesRol = await mRol.entrar('cont@ejemplo.cl');
    const denegado = await pedir(mRol.rutas, {
        query: { ruta: 'portal-estudio' },
        metodo: 'POST',
        headers: Object.assign({}, JSON_OK, { cookie: sesRol.cookie }),
        body: { diasVigencia: 7, snapshot: SNAPSHOT_SUCIO }
    });
    assert.strictEqual(denegado.statusCode, 403);
});

cola.then(() => {
    console.log(process.exitCode ? 'HAY FALLAS' : (ok + ' pruebas correctas en Portal Estudio Marca Blanca'));
});
