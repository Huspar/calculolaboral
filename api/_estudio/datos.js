/**
 * Datos del estudio contable (capa de cuentas).
 *
 * Una cuenta guarda su estudio completo en una fila cifrada de `estudios`
 * (migración 007): clientes, nóminas e historial. La base solo ve bytes.
 * El cifrado va atado a la cuenta ("estudios:<cuentaId>"): copiar la fila a otra
 * cuenta la deja ilegible.
 */
const LIMITE_BYTES = 2 * 1024 * 1024;

function crear({ consulta, cifrado }) {
    async function leer(cuentaId) {
        const filas = await consulta(
            'SELECT datos_cifrados, version_clave, actualizado FROM estudios WHERE cuenta_id = $1::uuid',
            [cuentaId]
        );
        if (!filas.length) return { ok: true, datos: null, actualizado: null };
        const texto = cifrado.descifrar(filas[0].datos_cifrados, Number(filas[0].version_clave), 'estudios:' + cuentaId);
        let datos;
        try { datos = JSON.parse(texto); }
        catch (e) { return { ok: false, estado: 500, codigo: 'datos_ilegibles', error: 'El estudio guardado no se puede leer.' }; }
        return { ok: true, datos: datos, actualizado: filas[0].actualizado };
    }

    async function guardar(cuentaId, datos) {
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
            return { ok: false, estado: 400, codigo: 'datos_invalidos', error: 'Faltan los datos del estudio.' };
        }
        let texto;
        try { texto = JSON.stringify(datos); }
        catch (e) { return { ok: false, estado: 400, codigo: 'datos_invalidos', error: 'Los datos del estudio no se pueden guardar.' }; }
        if (Buffer.byteLength(texto, 'utf8') > LIMITE_BYTES) {
            return { ok: false, estado: 413, codigo: 'datos_muy_grandes', error: 'El estudio supera el tamaño permitido (2 MB).' };
        }

        const c = cifrado.cifrar(texto, 'estudios:' + cuentaId);
        await consulta(
            `INSERT INTO estudios (cuenta_id, datos_cifrados, version_clave, actualizado)
             VALUES ($1::uuid, $2, $3, now())
             ON CONFLICT (cuenta_id) DO UPDATE
               SET datos_cifrados = EXCLUDED.datos_cifrados,
                   version_clave = EXCLUDED.version_clave,
                   actualizado = now()`,
            [cuentaId, c.datos, c.version]
        );
        return { ok: true };
    }

    return { leer: leer, guardar: guardar, LIMITE_BYTES: LIMITE_BYTES };
}

module.exports = { crear, LIMITE_BYTES };
