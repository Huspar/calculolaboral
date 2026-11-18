// Pruebas unitarias del buzón de documentos del Portal Cliente (/portal-estudio).
// Ejecutar: node tools/test_portal_buzon.js
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const PortalEstudio = require('../api/_estudio/portal_estudio');
const Cifrado = require('../api/_pyme/cifrado');
const Permisos = require('../api/_pyme/permisos');

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

function crearMockConsulta() {
    const filasPortal = new Map();
    const filasBuzon = new Map();
    return async function consulta(sql, params) {
        const q = String(sql || '').replace(/\s+/g, ' ').trim();
        if (/^CREATE TABLE/i.test(q) || /^CREATE INDEX/i.test(q)) return [];

        if (/SELECT count\(\*\)::int AS n FROM portal_estudio\b/i.test(q)) {
            const [cuentaId] = params;
            const n = Array.from(filasPortal.values()).filter((r) => r.cuenta_id === cuentaId && !r.revocado).length;
            return [{ n }];
        }
        if (/INSERT INTO portal_estudio\s*\(/i.test(q)) {
            const [id, cuenta_id, cliente_nombre, cliente_rut, periodo, token_hash, secciones, datos_cifrados, version_clave, creado, vence] = params;
            filasPortal.set(id, {
                id,
                cuenta_id,
                cliente_nombre,
                cliente_rut,
                periodo,
                token_hash,
                secciones: typeof secciones === 'string' ? JSON.parse(secciones) : secciones,
                datos_cifrados,
                version_clave,
                creado,
                vence,
                revocado: null
            });
            return [];
        }
        if (/FROM portal_estudio WHERE token_hash/i.test(q)) {
            const [th] = params;
            return Array.from(filasPortal.values()).filter((r) => r.token_hash === th);
        }
        if (/SELECT count\(\*\)::int AS n FROM portal_estudio_buzon/i.test(q)) {
            const [portalId] = params;
            const n = Array.from(filasBuzon.values()).filter((r) => r.portal_id === portalId).length;
            return [{ n }];
        }
        if (/INSERT INTO portal_estudio_buzon/i.test(q)) {
            const [id, portal_id, cuenta_id, cliente_nombre, cliente_rut, periodo, tipo, nombre_archivo, mime_type, nota, tamano_bytes, datos_cifrados, version_clave, creado] = params;
            filasBuzon.set(id, {
                id,
                portal_id,
                cuenta_id,
                cliente_nombre,
                cliente_rut,
                periodo,
                tipo,
                nombre_archivo,
                mime_type,
                nota,
                estado: 'nuevo',
                tamano_bytes,
                datos_cifrados,
                version_clave,
                creado
            });
            return [];
        }
        if (/^UPDATE portal_estudio_buzon SET estado = \$3/i.test(q)) {
            const [id, cuentaId, estado] = params;
            const r = filasBuzon.get(id);
            if (!r || r.cuenta_id !== cuentaId) return [];
            r.estado = estado;
            return [{ id: r.id, estado: r.estado }];
        }
        if (/^DELETE FROM portal_estudio_buzon/i.test(q)) {
            const [id, cuentaId] = params;
            const r = filasBuzon.get(id);
            if (!r || r.cuenta_id !== cuentaId) return [];
            filasBuzon.delete(id);
            return [{ id }];
        }
        if (/FROM portal_estudio_buzon WHERE portal_id = \$1/i.test(q)) {
            const [portalId] = params;
            return Array.from(filasBuzon.values()).filter((r) => r.portal_id === portalId);
        }
        if (/FROM portal_estudio_buzon WHERE id = \$1::uuid AND cuenta_id = \$2::uuid/i.test(q)) {
            const [id, cuentaId] = params;
            return Array.from(filasBuzon.values()).filter((r) => r.id === id && r.cuenta_id === cuentaId);
        }
        if (/FROM portal_estudio_buzon WHERE cuenta_id = \$1/i.test(q)) {
            const [cuentaId] = params;
            return Array.from(filasBuzon.values()).filter((r) => r.cuenta_id === cuentaId);
        }
        return [];
    };
}

const SECRETO = 'secreto-buzon-pruebas-2026';
const CUENTA_UUID = '11111111-1111-4111-8111-111111111111';
const cifrado = Cifrado.crear({ claves: { 1: crypto.createHash('sha256').update('clave-test-buzon').digest() }, versionActual: 1 });

caso('Permisos incluyen portal-estudio-buzon y estudio con niveles esperados', () => {
    assert.deepStrictEqual(Permisos.RUTAS['portal-estudio-buzon'], {
        GET: 'ver',
        PUT: 'ficha_editar',
        DELETE: 'portal_gestionar'
    });
    assert.deepStrictEqual(Permisos.RUTAS.estudio, {
        GET: 'ver',
        PUT: 'ficha_editar'
    });
});

caso('Cliente sube archivo al buzón, se cifra con AES-256-GCM y contador lo lee, marca procesado y elimina', async () => {
    const mgr = PortalEstudio.crear({
        consulta: crearMockConsulta(),
        cifrado,
        ahora: () => Date.parse('2026-11-18T12:00:00Z')
    });
    const emitido = await mgr.crearEnlace(CUENTA_UUID, {
        secciones: { f29: true, laboral: true, resumen: true, buzon: true },
        snapshot: {
            cliente: { nombre: 'Comercial Norte Ltda.', rut: '76.123.456-7', periodo: '2026-11' },
            estudio: { nombre: 'Estudio Contable Sur' }
        }
    }, { secreto: SECRETO, siteUrl: 'https://calculolaboral.cl' });

    assert.strictEqual(emitido.ok, true, JSON.stringify(emitido));
    assert.strictEqual(emitido.secciones.buzon, true);
    const token = emitido.enlace.split('?t=')[1];

    const csvOriginal = 'Fecha;Descripcion;Cargo;Abono\n05/11/2026;Pago proveedor;120000;0\n';
    const subido = await mgr.subirAlBuzon(token, {
        tipo: 'cartola',
        nota: 'Cartola BancoEstado noviembre',
        nombreArchivo: 'cartola_nov.csv',
        mimeType: 'text/csv',
        contenidoBase64: Buffer.from(csvOriginal, 'utf8').toString('base64')
    }, { secreto: SECRETO });

    assert.strictEqual(subido.ok, true, JSON.stringify(subido));
    assert.strictEqual(subido.item.estado, 'nuevo');
    assert.strictEqual(subido.item.nombreArchivo, 'cartola_nov.csv');

    const listaCli = await mgr.listarBuzonCliente(token, { secreto: SECRETO });
    assert.strictEqual(listaCli.ok, true);
    assert.strictEqual(listaCli.items.length, 1);

    const listaEst = await mgr.listarBuzonEstudio(CUENTA_UUID);
    assert.strictEqual(listaEst.items.length, 1);

    const leido = await mgr.leerItemBuzon(CUENTA_UUID, subido.item.id);
    assert.strictEqual(leido.ok, true, JSON.stringify(leido));
    assert.strictEqual(
        Buffer.from(leido.item.contenidoBase64, 'base64').toString('utf8'),
        csvOriginal
    );

    const upd = await mgr.actualizarEstadoBuzon(CUENTA_UUID, subido.item.id, 'procesado');
    assert.strictEqual(upd.ok, true);
    assert.strictEqual(upd.estado, 'procesado');

    const del = await mgr.eliminarItemBuzon(CUENTA_UUID, subido.item.id);
    assert.strictEqual(del.ok, true);
    const postDel = await mgr.listarBuzonEstudio(CUENTA_UUID);
    assert.strictEqual(postDel.items.length, 0);
});

caso('Buzón rechaza extensión no permitida, archivo > 1 MB y portal con buzon deshabilitado', async () => {
    const mgr = PortalEstudio.crear({
        consulta: crearMockConsulta(),
        cifrado,
        ahora: () => Date.parse('2026-11-18T12:00:00Z')
    });

    const emitido = await mgr.crearEnlace(CUENTA_UUID, {
        secciones: { buzon: true },
        snapshot: { cliente: { nombre: 'Cliente 1', rut: '76.111.111-1', periodo: '2026-11' } }
    }, { secreto: SECRETO, siteUrl: 'https://calculolaboral.cl' });
    const tok1 = emitido.enlace.split('?t=')[1];

    const extMal = await mgr.subirAlBuzon(tok1, {
        nombreArchivo: 'virus.exe',
        contenidoBase64: Buffer.from('MZ').toString('base64')
    }, { secreto: SECRETO });
    assert.strictEqual(extMal.ok, false);
    assert.strictEqual(extMal.codigo, 'extension_invalida');

    const grande = Buffer.alloc(1024 * 1024 + 10, 65).toString('base64');
    const pesoMal = await mgr.subirAlBuzon(tok1, {
        nombreArchivo: 'gigante.csv',
        contenidoBase64: grande
    }, { secreto: SECRETO });
    assert.strictEqual(pesoMal.ok, false);
    assert.strictEqual(pesoMal.codigo, 'archivo_grande');

    const sinBuzon = await mgr.crearEnlace(CUENTA_UUID, {
        secciones: { buzon: false },
        snapshot: { cliente: { nombre: 'Cliente 2', rut: '76.222.222-2', periodo: '2026-11' } }
    }, { secreto: SECRETO, siteUrl: 'https://calculolaboral.cl' });
    const tok2 = sinBuzon.enlace.split('?t=')[1];

    const bloq = await mgr.subirAlBuzon(tok2, {
        nombreArchivo: 'cartola.csv',
        contenidoBase64: Buffer.from('a;b\n1;2').toString('base64')
    }, { secreto: SECRETO });
    assert.strictEqual(bloq.ok, false);
    assert.strictEqual(bloq.codigo, 'buzon_desactivado');
});

cola.then(() => {
    console.log(process.exitCode ? 'HAY FALLAS' : ('\n' + ok + ' pruebas correctas en Buzón Portal Estudio'));
});
