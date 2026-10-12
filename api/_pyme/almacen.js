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
        },

        // ---------- datos de la empresa y de los trabajadores (siempre cifrados: la base solo ve bytes) ----------

        async obtenerEmpresa(cuentaId) {
            const r = await filas('SELECT id, datos_cifrados, version_clave FROM empresas WHERE cuenta_id = $1::uuid', [cuentaId]);
            return r[0] ? { id: r[0].id, datos: Buffer.from(r[0].datos_cifrados), version: Number(r[0].version_clave) } : null;
        },

        async guardarEmpresa(cuentaId, datos, version, ahoraIso) {
            const r = await filas(
                'INSERT INTO empresas (cuenta_id, datos_cifrados, version_clave, actualizada) VALUES ($1::uuid, $2::bytea, $3::smallint, $4::timestamptz) ' +
                'ON CONFLICT (cuenta_id) DO UPDATE SET datos_cifrados = EXCLUDED.datos_cifrados, version_clave = EXCLUDED.version_clave, actualizada = EXCLUDED.actualizada RETURNING id',
                [cuentaId, datos, version, ahoraIso]
            );
            return { id: r[0].id };
        },

        async listarTrabajadores(empresaId) {
            const r = await filas('SELECT id, activo, datos_cifrados, version_clave FROM trabajadores WHERE empresa_id = $1::uuid ORDER BY creado, id', [empresaId]);
            return r.map(x => ({ id: x.id, activo: !!x.activo, datos: Buffer.from(x.datos_cifrados), version: Number(x.version_clave) }));
        },

        /** Inserta solo si no se pasa del maximo de activos (la comprobacion y el INSERT son una sola sentencia). Devuelve true o false. */
        async crearTrabajador({ id, empresaId, activo, datos, version, ahoraIso, maxActivos }) {
            const r = await filas(
                'INSERT INTO trabajadores (id, empresa_id, activo, datos_cifrados, version_clave, creado, actualizado) ' +
                'SELECT $1::uuid, $2::uuid, $3::boolean, $4::bytea, $5::smallint, $6::timestamptz, $6::timestamptz ' +
                'WHERE $3::boolean = false OR (SELECT count(*) FROM trabajadores WHERE empresa_id = $2::uuid AND activo) < $7::int RETURNING id',
                [id, empresaId, activo, datos, version, ahoraIso, maxActivos]
            );
            return r.length === 1;
        },

        /** Actualiza un trabajador de esa empresa. Reactivar a uno inactivo tambien respeta el maximo. Devuelve true o false. */
        async actualizarTrabajador({ id, empresaId, activo, datos, version, ahoraIso, maxActivos }) {
            const r = await filas(
                'UPDATE trabajadores SET activo = $3::boolean, datos_cifrados = $4::bytea, version_clave = $5::smallint, actualizado = $6::timestamptz ' +
                'WHERE id = $1::uuid AND empresa_id = $2::uuid AND ($3::boolean = false OR activo OR ' +
                '(SELECT count(*) FROM trabajadores WHERE empresa_id = $2::uuid AND activo) < $7::int) RETURNING id',
                [id, empresaId, activo, datos, version, ahoraIso, maxActivos]
            );
            return r.length === 1;
        },

        async borrarTrabajador(id, empresaId) {
            const r = await filas('DELETE FROM trabajadores WHERE id = $1::uuid AND empresa_id = $2::uuid RETURNING id', [id, empresaId]);
            return r.length === 1;
        },

        // ---------- meses de liquidacion (cifrados; el periodo AAAA-MM va en claro) ----------

        async trabajadorDeEmpresa(id, empresaId) {
            const r = await filas('SELECT 1 FROM trabajadores WHERE id = $1::uuid AND empresa_id = $2::uuid', [id, empresaId]);
            return r.length === 1;
        },

        /** Meses guardados de la empresa; con `periodo` solo ese. */
        async listarMeses(empresaId, periodo) {
            const r = await filas(
                'SELECT m.trabajador_id, m.periodo, m.datos_cifrados, m.version_clave FROM meses m JOIN trabajadores t ON t.id = m.trabajador_id ' +
                'WHERE t.empresa_id = $1::uuid AND ($2::text IS NULL OR m.periodo = $2::text) ORDER BY m.periodo, t.creado, t.id',
                [empresaId, periodo || null]
            );
            return r.map(x => ({ trabajadorId: x.trabajador_id, periodo: x.periodo, datos: Buffer.from(x.datos_cifrados), version: Number(x.version_clave) }));
        },

        async obtenerMes(trabajadorId, empresaId, periodo) {
            const r = await filas(
                'SELECT m.datos_cifrados, m.version_clave FROM meses m JOIN trabajadores t ON t.id = m.trabajador_id ' +
                'WHERE m.trabajador_id = $1::uuid AND t.empresa_id = $2::uuid AND m.periodo = $3',
                [trabajadorId, empresaId, periodo]
            );
            return r[0] ? { datos: Buffer.from(r[0].datos_cifrados), version: Number(r[0].version_clave) } : null;
        },

        /** Crea o reemplaza el mes de un trabajador de esa empresa, sin pasar de `maxMeses` por trabajador. Devuelve true o false. */
        async guardarMes({ trabajadorId, empresaId, periodo, datos, version, ahoraIso, maxMeses }) {
            const r = await filas(
                'INSERT INTO meses (trabajador_id, periodo, datos_cifrados, version_clave, actualizado) ' +
                'SELECT t.id, $3, $4::bytea, $5::smallint, $6::timestamptz FROM trabajadores t WHERE t.id = $1::uuid AND t.empresa_id = $2::uuid ' +
                'AND ((SELECT count(*) FROM meses m WHERE m.trabajador_id = t.id) < $7::int OR EXISTS (SELECT 1 FROM meses m WHERE m.trabajador_id = t.id AND m.periodo = $3)) ' +
                'ON CONFLICT (trabajador_id, periodo) DO UPDATE SET datos_cifrados = EXCLUDED.datos_cifrados, version_clave = EXCLUDED.version_clave, actualizado = EXCLUDED.actualizado RETURNING id',
                [trabajadorId, empresaId, periodo, datos, version, ahoraIso, maxMeses]
            );
            return r.length === 1;
        },

        async borrarMes(trabajadorId, empresaId, periodo) {
            const r = await filas(
                'DELETE FROM meses m USING trabajadores t WHERE m.trabajador_id = t.id AND m.trabajador_id = $1::uuid AND t.empresa_id = $2::uuid AND m.periodo = $3 RETURNING m.id',
                [trabajadorId, empresaId, periodo]
            );
            return r.length === 1;
        },

        /** Fecha en que vence el pase vigente mas largo de la cuenta, en milisegundos, o null si no tiene. */
        async paseVigente(cuentaId, ahoraIso) {
            const r = await filas('SELECT max(vence) AS vence FROM pases WHERE cuenta_id = $1::uuid AND desde <= $2::timestamptz AND vence > $2::timestamptz', [cuentaId, ahoraIso]);
            return r[0] && r[0].vence ? new Date(r[0].vence).getTime() : null;
        },

        /** Borra la cuenta y, en cascada, sesiones, empresa, trabajadores, vacaciones, meses, documentos y pases. */
        async borrarCuenta(cuentaId) {
            await filas('DELETE FROM cuentas WHERE id = $1::uuid', [cuentaId]);
        }
    };
}

module.exports = { crearAlmacenSql };
