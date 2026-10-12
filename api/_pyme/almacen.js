/**
 * Acceso a la base (Neon Postgres) para las cuentas del Asistente Pyme.
 *
 * crearAlmacenSql(sql): `sql` es la funcion de @neondatabase/serverless (neon(DATABASE_URL)); se usa sql.query(texto, parametros).
 * Todas las consultas llevan parametros ($1, $2...): nunca se arma SQL con texto del usuario.
 * La misma interfaz la implementa tools/pyme_almacen_memoria.js para las pruebas sin base de datos.
 *
 * Los tiempos llegan como texto ISO desde auth.js (un solo reloj) y las fechas de vencimiento se devuelven en milisegundos.
 */

function crearAlmacenSql(sql) {
    async function filas(texto, parametros) {
        return sql.query(texto, parametros || []);
    }

    return {
        /** Borra lo vencido hace mas de un dia (enlaces, sesiones) o de 2 dias (contadores de intentos). */
        async limpiar(ahoraIso) {
            await filas("DELETE FROM enlaces_acceso WHERE vence < $1::timestamptz - interval '1 day'", [ahoraIso]);
            await filas("DELETE FROM sesiones WHERE vence < $1::timestamptz - interval '1 day'", [ahoraIso]);
            await filas("DELETE FROM intentos WHERE ventana < $1::timestamptz - interval '2 days'", [ahoraIso]);
        },

        /** Suma 1 al contador de la ventana y devuelve el total. */
        async sumarIntento(clave, ventanaIso) {
            const r = await filas(
                'INSERT INTO intentos (clave, ventana, cuenta) VALUES ($1, $2::timestamptz, 1) ' +
                'ON CONFLICT (clave, ventana) DO UPDATE SET cuenta = intentos.cuenta + 1 RETURNING cuenta',
                [clave, ventanaIso]
            );
            return Number(r[0].cuenta);
        },

        async crearEnlace({ email, tokenHash, creado, vence }) {
            await filas(
                'INSERT INTO enlaces_acceso (email, token_hash, creado, vence) VALUES ($1, $2, $3::timestamptz, $4::timestamptz)',
                [email, tokenHash, creado, vence]
            );
        },

        /** Enlace sin usar y vigente, sin consumirlo. */
        async buscarEnlace(tokenHash, ahoraIso) {
            const r = await filas(
                'SELECT email FROM enlaces_acceso WHERE token_hash = $1 AND usado IS NULL AND vence > $2::timestamptz',
                [tokenHash, ahoraIso]
            );
            return r[0] ? { email: r[0].email } : null;
        },

        /** Consume el enlace en una sola sentencia: si dos peticiones llegan a la vez, solo una recibe el correo. */
        async consumirEnlace(tokenHash, ahoraIso) {
            const r = await filas(
                'UPDATE enlaces_acceso SET usado = $2::timestamptz WHERE token_hash = $1 AND usado IS NULL AND vence > $2::timestamptz RETURNING email',
                [tokenHash, ahoraIso]
            );
            return r[0] ? r[0].email : null;
        },

        async buscarCuentaPorEmail(email) {
            const r = await filas('SELECT id, acepto_encargo FROM cuentas WHERE email = $1', [email]);
            return r[0] ? { id: r[0].id, aceptoEncargo: !!r[0].acepto_encargo } : null;
        },

        /** Crea la cuenta o actualiza su ultimo acceso. La aceptacion del encargo se guarda una sola vez (la primera). */
        async upsertCuenta(email, aceptoIso, ahoraIso) {
            const r = await filas(
                'INSERT INTO cuentas (email, acepto_encargo, ultimo_acceso, creada) VALUES ($1, $2::timestamptz, $3::timestamptz, $3::timestamptz) ' +
                'ON CONFLICT (email) DO UPDATE SET ultimo_acceso = $3::timestamptz, ' +
                'acepto_encargo = COALESCE(cuentas.acepto_encargo, EXCLUDED.acepto_encargo) RETURNING id',
                [email, aceptoIso, ahoraIso]
            );
            return { id: r[0].id };
        },

        async crearSesion({ cuentaId, tokenHash, creada, vence }) {
            await filas(
                'INSERT INTO sesiones (cuenta_id, token_hash, creada, vence) VALUES ($1, $2, $3::timestamptz, $4::timestamptz)',
                [cuentaId, tokenHash, creada, vence]
            );
        },

        async buscarSesion(tokenHash, ahoraIso) {
            const r = await filas(
                'SELECT s.id AS sesion_id, s.vence, c.id AS cuenta_id, c.email FROM sesiones s JOIN cuentas c ON c.id = s.cuenta_id ' +
                'WHERE s.token_hash = $1 AND s.revocada IS NULL AND s.vence > $2::timestamptz',
                [tokenHash, ahoraIso]
            );
            if (!r[0]) return null;
            return { sesionId: r[0].sesion_id, cuentaId: r[0].cuenta_id, email: r[0].email, vence: new Date(r[0].vence).getTime() };
        },

        async extenderSesion(sesionId, venceIso) {
            await filas('UPDATE sesiones SET vence = $2::timestamptz WHERE id = $1', [sesionId, venceIso]);
        },

        async revocarSesion(tokenHash, ahoraIso) {
            await filas('UPDATE sesiones SET revocada = $2::timestamptz WHERE token_hash = $1 AND revocada IS NULL', [tokenHash, ahoraIso]);
        },

        async registrarAuditoria({ cuentaId, evento, ipHash, cuando }) {
            await filas('INSERT INTO auditoria (cuenta_id, evento, ip_hash, cuando) VALUES ($1, $2, $3, $4::timestamptz)', [cuentaId, evento, ipHash, cuando]);
        }
    };
}

module.exports = { crearAlmacenSql };
