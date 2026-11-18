// Pruebas unitarias de compartición multiusuario en Suite Contadores (alcance='suite') y ruta /api/pyme/estudio.
// Ejecutar: node tools/test_equipo_estudio_nube.js
'use strict';

const assert = require('assert');
const Equipo = require('../api/_pyme/equipo');
const rutas = require('../api/_pyme/rutas');

let ok = 0;
let cola = Promise.resolve();
function caso(nombre, fn) {
    cola = cola.then(async () => {
        try {
            await fn();
            ok++;
            console.log('  ok  ' + nombre);
        } catch (e) {
            console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message));
            process.exitCode = 1;
        }
    });
}

function resMock() {
    const out = { status: 200, headers: {}, body: null };
    return {
        out,
        set statusCode(c) { out.status = c; },
        get statusCode() { return out.status; },
        setHeader(k, v) { out.headers[k] = v; },
        end(raw) { out.body = raw ? JSON.parse(raw) : null; }
    };
}

const OWNER_UUID = '11111111-1111-4111-8111-111111111111';
const USER_UUID = '22222222-2222-4222-8222-222222222222';

caso('Equipo.invitar acepta alcance="suite" cuando el titular no tiene empresas /app', async () => {
    const miembros = [];
    const eq = Equipo.crear({
        almacen: {
            async listarMiembros() { return miembros.slice(); },
            async crearMiembro(item) {
                const creado = Object.assign({ id: 'm-' + (miembros.length + 1) }, item);
                miembros.push(creado);
                return creado;
            }
        },
        datos: {
            async estado() { return { empresas: [] }; }
        }
    });

    const cuenta = { cuentaId: OWNER_UUID, personaId: OWNER_UUID, email: 'titular@estudio.cl', rol: 'titular' };
    const rSuite = await eq.invitar(cuenta, { email: 'colega@estudio.cl', rol: 'contador', alcance: 'suite' });
    assert.strictEqual(rSuite.ok, true, JSON.stringify(rSuite));
    assert.strictEqual(rSuite.miembro.email, 'colega@estudio.cl');

    const rSinAlcance = await eq.invitar(cuenta, { email: 'otro@estudio.cl', rol: 'contador' });
    assert.strictEqual(rSinAlcance.ok, false);
});

caso('GET y PUT /api/pyme/estudio respetan X-CL-Estudio y permisos lectura vs contador', async () => {
    let guardado = null;
    let rolColega = 'contador';
    let vistoCuentaId = null;

    const manejar = rutas.crearRutas({
        env: {},
        siteUrl: 'https://calculolaboral.cl',
        auth: {
            async leerSesion() {
                return { autenticado: true, cuentaId: USER_UUID, personaId: USER_UUID, email: 'colega@estudio.cl', rol: 'titular' };
            },
            async permitirEscritura() { return true; },
            async registrar() {}
        },
        equipo: {
            async resolver(s, id) {
                if (id !== OWNER_UUID) return null;
                return { ...s, cuentaId: OWNER_UUID, rol: rolColega, empresasPermitidas: null };
            }
        },
        estudio: {
            async leer(cuentaId) {
                vistoCuentaId = cuentaId;
                return guardado || { ok: true, datos: { clientes: [{ id: 'c1', razonSocial: 'Demo' }] }, actualizadoEn: '2026-11-18T12:00:00Z' };
            },
            async guardar(cuentaId, body) {
                vistoCuentaId = cuentaId;
                guardado = { ok: true, datos: body, actualizadoEn: '2026-11-18T12:05:00Z' };
                return { ok: true, actualizadoEn: '2026-11-18T12:05:00Z' };
            }
        }
    });

    const getRes = resMock();
    await manejar(
        { method: 'GET', query: { ruta: 'estudio' }, headers: { cookie: 'cl_pyme=tok', 'x-cl-estudio': OWNER_UUID } },
        getRes
    );
    assert.strictEqual(getRes.out.status, 200, JSON.stringify(getRes.out.body));
    assert.strictEqual(vistoCuentaId, OWNER_UUID);
    assert.strictEqual(getRes.out.body.datos.clientes[0].id, 'c1');

    const putRes = resMock();
    await manejar(
        {
            method: 'PUT',
            query: { ruta: 'estudio' },
            headers: { cookie: 'cl_pyme=tok', 'x-cl-pyme': '1', 'content-type': 'application/json', 'x-cl-estudio': OWNER_UUID, origin: 'https://calculolaboral.cl' },
            body: { datos: { clientes: [{ id: 'c1', razonSocial: 'Actualizada' }] } }
        },
        putRes
    );
    assert.strictEqual(putRes.out.status, 200, JSON.stringify(putRes.out.body));
    assert.strictEqual(guardado.datos.clientes[0].razonSocial, 'Actualizada');

    // Rol lectura no puede escribir (403)
    rolColega = 'lectura';
    const denyRes = resMock();
    await manejar(
        {
            method: 'PUT',
            query: { ruta: 'estudio' },
            headers: { cookie: 'cl_pyme=tok', 'x-cl-pyme': '1', 'content-type': 'application/json', 'x-cl-estudio': OWNER_UUID, origin: 'https://calculolaboral.cl' },
            body: { datos: { clientes: [] } }
        },
        denyRes
    );
    assert.strictEqual(denyRes.out.status, 403, JSON.stringify(denyRes.out.body));
});

cola.then(() => {
    console.log(process.exitCode ? 'HAY FALLAS' : ('\n' + ok + ' pruebas correctas en Equipo y Nube Estudio'));
});
