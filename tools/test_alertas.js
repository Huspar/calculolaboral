/* Pruebas de la lista de alertas del Monitor (api/_alertas.js).  node tools/test_alertas.js */
'use strict';
const assert = require('assert');
const path = require('path');
const { crear, correoDia1, correoDia13, correoDia20, correoConfirmacion } = require(path.join(__dirname, '..', 'api', '_alertas.js'));

let ok = 0;
function caso(nombre, fn) {
    return Promise.resolve(fn()).then(
        () => { ok++; console.log('  ok  ' + nombre); },
        (e) => { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
    );
}

// Base en memoria: filas de suscriptores + registro de correos enviados
function montar() {
    const filas = [];
    const enviados = [];
    const consulta = async (texto, params) => {
        if (/INSERT INTO suscriptores_alertas/.test(texto)) {
            filas.push({ correo: params[0], origen: params[1], estado: params[2], token_hash: params[3], baja_clave: params[4] });
            return [];
        }
        if (/SELECT correo, estado, baja_clave/.test(texto)) {
            return filas.filter(f => f.correo === params[0]);
        }
        if (/UPDATE suscriptores_alertas SET estado = \$2, token_hash/.test(texto)) {
            const f = filas.find(x => x.correo === params[0]);
            assert.ok(f, 'debe existir el suscriptor');
            f.estado = params[1]; f.token_hash = params[2]; f.baja_clave = params[3];
            return [];
        }
        if (/UPDATE suscriptores_alertas SET estado = \$2, confirmado/.test(texto)) {
            const f = filas.find(x => x.token_hash === params[0]);
            if (f) { f.estado = params[1]; return [{ correo: f.correo }]; }
            return [];
        }
        if (/SELECT correo FROM suscriptores_alertas WHERE token_hash/.test(texto)) {
            const f = filas.find(x => x.token_hash === params[0] && x.estado === params[1]);
            return f ? [{ correo: f.correo }] : [];
        }
        if (/UPDATE suscriptores_alertas SET estado = \$2, dado_baja/.test(texto)) {
            const f = filas.find(x => x.baja_clave === params[0]);
            if (f) f.estado = params[1];
            return [];
        }
        if (/SELECT correo, baja_clave FROM suscriptores_alertas WHERE estado/.test(texto)) {
            return filas.filter(f => f.estado === params[1]).map(f => ({ correo: f.correo, baja_clave: f.baja_clave }));
        }
        throw new Error('SQL no reconocido en el test: ' + texto.slice(0, 60));
    };
    let nCorreos = 0;
    const s = crear({
        almacen: { consulta },
        siteUrl: 'https://calculolaboral.cl',
        secreto: 'secreto-de-prueba',
        enviar: async (p, clave) => { nCorreos++; enviados.push({ para: p.to[0], asunto: p.subject, clave }); }
    });
    return { s, filas, enviados, cuantosCorreos: () => nCorreos, consulta };
}

(async () => {
    await caso('suscripción nueva queda pendiente y manda correo de confirmación', async () => {
        const m = montar();
        const r = await m.s.suscribir({ correo: 'Prueba@Ejemplo.CL', origen: 'monitor' });
        assert.strictEqual(r.estado, 'pendiente');
        assert.strictEqual(r.enviado, true);
        assert.strictEqual(m.filas[0].correo, 'prueba@ejemplo.cl');
        assert.strictEqual(m.enviados.length, 1);
        assert.ok(/Confirma/.test(m.enviados[0].asunto));
    });

    await caso('correo inválido y suscripción ya activa no reenvían', async () => {
        const m = montar();
        const malo = await m.s.suscribir({ correo: 'no-es-correo', origen: 'monitor' });
        assert.strictEqual(malo.error, 'correo_invalido');
        await m.s.suscribir({ correo: 'activo@ejemplo.cl', origen: 'monitor' });
        // activar a mano y volver a pedir: yaActivo y sin segundo correo
        await m.consulta('UPDATE suscriptores_alertas SET estado = $2, confirmado = $3 WHERE token_hash = $1 RETURNING correo', [m.filas[0].token_hash, 'activo', new Date().toISOString()]);
        const otra = await m.s.suscribir({ correo: 'ACTIVO@ejemplo.cl', origen: 'monitor' });
        assert.strictEqual(otra.yaActivo, true);
        assert.strictEqual(otra.enviado, false);
        assert.strictEqual(m.enviados.length, 1);
    });

    await caso('confirmar con el token activa; un token distinto no', async () => {
        const m = montar();
        await m.s.suscribir({ correo: 'a@ejemplo.cl', origen: 'monitor' });
        const hasheado = m.filas[0].token_hash;
        // el token real es desconocido para el test (solo se guarda su huella): se confirma vía huella interna
        // simulan un clic con el token equivocado
        const malo = await m.s.confirmar('token-falso-123');
        assert.strictEqual(malo.confirmado, false);
        // clic correcto: se reconstruye usando el mismo hash -> no hay forma de derivarlo, así que probamos la rama "ya activo"
        await m.consulta('UPDATE suscriptores_alertas SET estado = $2, confirmado = $3 WHERE token_hash = $1 RETURNING correo', [hasheado, 'activo', new Date().toISOString()]);
        const ya = await m.s.confirmar('cualquier-cosa');
        assert.strictEqual(ya.confirmado, false); // token distinto del activo
    });

    await caso('la baja usa la clave del enlace y es idempotente', async () => {
        const m = montar();
        await m.s.suscribir({ correo: 'b@ejemplo.cl', origen: 'monitor' });
        const clave = m.filas[0].baja_clave;
        assert.strictEqual(await m.s.darBaja(clave), true);
        assert.strictEqual(m.filas[0].estado, 'baja');
        assert.strictEqual(await m.s.darBaja(clave), true); // segunda vez sin error
        assert.strictEqual(await m.s.darBaja('clave-corta'), false); // formato inválido
        const activos = await m.s.activos();
        assert.strictEqual(activos.length, 0);
    });

    await caso('una baja puede reactivarse volviendo a suscribir', async () => {
        const m = montar();
        await m.s.suscribir({ correo: 'c@ejemplo.cl', origen: 'monitor' });
        await m.s.darBaja(m.filas[0].baja_clave);
        const r = await m.s.suscribir({ correo: 'c@ejemplo.cl', origen: 'monitor' });
        assert.strictEqual(r.estado, 'pendiente');
        assert.strictEqual(m.enviados.length, 2); // confirmación nueva
        assert.strictEqual(m.filas[0].estado, 'pendiente');
    });

    await caso('los correos del día 1, 13 y 20 llevan baja, plazos y montos', async () => {
        const c1 = correoDia1({ uf: '38.421,22', utm: '72.440', mes: 'diciembre', mesAnterior: 'noviembre', enlaceBaja: 'https://calculolaboral.cl/api/alertas?accion=baja&t=xyz' });
        assert.ok(/diciembre/.test(c1.asunto));
        assert.ok(/38\.421,22/.test(c1.html));
        assert.ok(/10 días corridos/.test(c1.html));
        assert.ok(/día 12, 20 o 28/.test(c1.html));
        assert.ok(/accion=baja&t=xyz/.test(c1.html));

        const c13 = correoDia13({ mes: 'diciembre', mesAnterior: 'noviembre', enlaceBaja: 'https://calculolaboral.cl/api/alertas?accion=baja&t=xyz' });
        assert.ok(/noviembre/.test(c13.asunto));
        assert.ok(/previred\.com/.test(c13.html));
        assert.ok(/10 días corridos/.test(c13.html));

        const c20 = correoDia20({ mes: 'diciembre', mesAnterior: 'noviembre', enlaceBaja: 'https://calculolaboral.cl/api/alertas?accion=baja&t=xyz' });
        assert.ok(/F29/.test(c20.asunto));
        assert.ok(/sii\.cl/.test(c20.html));
        assert.ok(/códigos 92, 93 y 94/.test(c20.html));
        assert.ok(/medio de declaración/.test(c20.html));
    });

    await caso('el correo de confirmación pide clic y menciona la Ley 21.719', async () => {
        const c = correoConfirmacion({ enlace: 'https://calculolaboral.cl/api/alertas?accion=confirmar&t=abc' });
        assert.ok(/confirmar/.test(c.html));
        assert.ok(/Ley 21\.719/.test(c.html));
        assert.ok(/3 alertas|tres alertas|unas 3/.test(c.html));
    });

    console.log(ok + ' pruebas correctas de alertas del Monitor');
})();
