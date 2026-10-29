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

    /**
     * Una sentencia que cuenta filas y luego inserta (para respetar un maximo) NO es atomica por si sola: con READ COMMITTED,
     * dos pedidos simultaneos ven el mismo conteo y ambos insertan. Se corre en una transaccion que primero toma un candado
     * (por empresa, trabajador o cuenta) y recien despues ejecuta la sentencia, que asi parte con una vista nueva de la base.
     */
    async function conCandado(clave, texto, parametros) {
        const res = await sql.transaction([
            sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [clave]),
            sql.query(texto, parametros || [])
        ]);
        return res[1];
    }

    return {
        /** Consulta cruda para los modulos que traen su propio SQL (por ejemplo el estudio del contador). */
        consulta: (texto, parametros) => filas(texto, parametros),

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

        /** La empresa pedida de la cuenta, o la primera si no se indica cual. */
        async obtenerEmpresa(cuentaId, empresaId) {
            const r = empresaId
                ? await filas('SELECT id, datos_cifrados, version_clave FROM empresas WHERE cuenta_id = $1::uuid AND id = $2::uuid', [cuentaId, empresaId])
                : await filas('SELECT id, datos_cifrados, version_clave FROM empresas WHERE cuenta_id = $1::uuid ORDER BY creada, id LIMIT 1', [cuentaId]);
            return r[0] ? { id: r[0].id, datos: Buffer.from(r[0].datos_cifrados), version: Number(r[0].version_clave) } : null;
        },

        /** Todas las empresas de la cuenta, de la mas antigua a la mas nueva. */
        async listarEmpresas(cuentaId) {
            const r = await filas('SELECT id, datos_cifrados, version_clave FROM empresas WHERE cuenta_id = $1::uuid ORDER BY creada, id', [cuentaId]);
            return r.map(f => ({ id: f.id, datos: Buffer.from(f.datos_cifrados), version: Number(f.version_clave) }));
        },

        /** Guarda una empresa existente (devuelve null si no es de la cuenta). Sin `empresaId`, la primera; si la cuenta no tiene ninguna, la crea. */
        async guardarEmpresa(cuentaId, datos, version, ahoraIso, empresaId) {
            if (empresaId) {
                const r = await filas(
                    'UPDATE empresas SET datos_cifrados = $3::bytea, version_clave = $4::smallint, actualizada = $5::timestamptz WHERE id = $2::uuid AND cuenta_id = $1::uuid RETURNING id',
                    [cuentaId, empresaId, datos, version, ahoraIso]
                );
                return r[0] ? { id: r[0].id } : null;
            }
            const r = await conCandado('empresas:' + cuentaId,
                'WITH act AS (UPDATE empresas SET datos_cifrados = $2::bytea, version_clave = $3::smallint, actualizada = $4::timestamptz ' +
                'WHERE id = (SELECT id FROM empresas WHERE cuenta_id = $1::uuid ORDER BY creada, id LIMIT 1) RETURNING id), ' +
                'ins AS (INSERT INTO empresas (cuenta_id, datos_cifrados, version_clave, creada, actualizada) SELECT $1::uuid, $2::bytea, $3::smallint, $4::timestamptz, $4::timestamptz ' +
                'WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE cuenta_id = $1::uuid) RETURNING id) ' +
                'SELECT id FROM act UNION ALL SELECT id FROM ins',
                [cuentaId, datos, version, ahoraIso]
            );
            return { id: r[0].id };
        },

        /** Agrega otra empresa a la cuenta, sin pasar de `maxEmpresas`. Devuelve { id } o null si ya esta en el maximo. */
        async crearEmpresa({ cuentaId, datos, version, ahoraIso, maxEmpresas }) {
            const r = await conCandado('empresas:' + cuentaId,
                'INSERT INTO empresas (cuenta_id, datos_cifrados, version_clave, creada, actualizada) SELECT $1::uuid, $2::bytea, $3::smallint, $4::timestamptz, $4::timestamptz ' +
                'WHERE (SELECT count(*) FROM empresas WHERE cuenta_id = $1::uuid) < $5::int RETURNING id',
                [cuentaId, datos, version, ahoraIso, maxEmpresas]
            );
            return r[0] ? { id: r[0].id } : null;
        },

        /** Borra la empresa y, en cascada, sus trabajadores, meses, honorarios y enlaces. Devuelve true o false. */
        async borrarEmpresa(cuentaId, empresaId) {
            const r = await filas('DELETE FROM empresas WHERE id = $2::uuid AND cuenta_id = $1::uuid RETURNING id', [cuentaId, empresaId]);
            return r.length > 0;
        },

        async listarTrabajadores(empresaId) {
            const r = await filas('SELECT id, activo, datos_cifrados, version_clave FROM trabajadores WHERE empresa_id = $1::uuid ORDER BY creado, id', [empresaId]);
            return r.map(x => ({ id: x.id, activo: !!x.activo, datos: Buffer.from(x.datos_cifrados), version: Number(x.version_clave) }));
        },

        /** Inserta solo si no se pasa del maximo de activos (la comprobacion y el INSERT son una sola sentencia). Devuelve true o false. */
        async crearTrabajador({ id, empresaId, activo, datos, version, ahoraIso, maxActivos }) {
            const r = await conCandado('trabajadores:' + empresaId,
                'INSERT INTO trabajadores (id, empresa_id, activo, datos_cifrados, version_clave, creado, actualizado) ' +
                'SELECT $1::uuid, $2::uuid, $3::boolean, $4::bytea, $5::smallint, $6::timestamptz, $6::timestamptz ' +
                'WHERE $3::boolean = false OR (SELECT count(*) FROM trabajadores WHERE empresa_id = $2::uuid AND activo) < $7::int RETURNING id',
                [id, empresaId, activo, datos, version, ahoraIso, maxActivos]
            );
            return r.length === 1;
        },

        /** Actualiza un trabajador de esa empresa. Reactivar a uno inactivo tambien respeta el maximo. Devuelve true o false. */
        async actualizarTrabajador({ id, empresaId, activo, datos, version, ahoraIso, maxActivos }) {
            const r = await conCandado('trabajadores:' + empresaId,
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
            const r = await conCandado('meses:' + trabajadorId,
                // La CTE solo expone el id del trabajador: leer `trabajadores` directo en el INSERT ... SELECT dejaba "datos_cifrados" ambiguo
                'WITH permitido AS (SELECT t.id AS trabajador_id FROM trabajadores t WHERE t.id = $1::uuid AND t.empresa_id = $2::uuid ' +
                'AND ((SELECT count(*) FROM meses m WHERE m.trabajador_id = t.id) < $7::int OR EXISTS (SELECT 1 FROM meses m WHERE m.trabajador_id = t.id AND m.periodo = $3::text))) ' +
                'INSERT INTO meses (trabajador_id, periodo, datos_cifrados, version_clave, actualizado) ' +
                'SELECT permitido.trabajador_id, $3::text, $4::bytea, $5::smallint, $6::timestamptz FROM permitido ' +
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

        // ---------- liquidación compartida por enlace (migración 005) ----------

        /** Crea el enlace del trabajador y mes (reemplaza el anterior) si el trabajador es de la cuenta. Devuelve true o false. */
        async crearEnlaceLiquidacion({ cuentaId, empresaId, trabajadorId, periodo, tokenHash, pagada, ahoraIso, venceIso }) {
            const r = await conCandado('enlaces:' + trabajadorId,
                'WITH permitido AS (SELECT t.id FROM trabajadores t WHERE t.id = $3::uuid AND t.empresa_id = $2::uuid) ' +
                'INSERT INTO enlaces_liquidacion (token_hash, cuenta_id, trabajador_id, periodo, pagada, creado, vence) ' +
                'SELECT $5, $1::uuid, permitido.id, $4::text, $6::boolean, $7::timestamptz, $8::timestamptz FROM permitido ' +
                'ON CONFLICT (trabajador_id, periodo) DO UPDATE SET token_hash = EXCLUDED.token_hash, pagada = EXCLUDED.pagada, creado = EXCLUDED.creado, vence = EXCLUDED.vence, primera_vista = NULL, ultima_vista = NULL, vistas = 0 RETURNING id',
                [cuentaId, empresaId, trabajadorId, periodo, tokenHash, pagada, ahoraIso, venceIso]
            );
            return r.length === 1;
        },

        async listarEnlacesLiquidacion(cuentaId, periodo) {
            const r = await filas(
                'SELECT trabajador_id, periodo, creado, vence, primera_vista, ultima_vista, vistas FROM enlaces_liquidacion WHERE cuenta_id = $1::uuid AND periodo = $2 ORDER BY creado',
                [cuentaId, periodo]
            );
            const iso = (v) => v ? new Date(v).toISOString() : null;
            return r.map(x => ({ trabajadorId: x.trabajador_id, periodo: x.periodo, creado: iso(x.creado), vence: iso(x.vence), primeraVista: iso(x.primera_vista), ultimaVista: iso(x.ultima_vista), vistas: Number(x.vistas) }));
        },

        async borrarEnlaceLiquidacion(cuentaId, trabajadorId, periodo) {
            const r = await filas('DELETE FROM enlaces_liquidacion WHERE cuenta_id = $1::uuid AND trabajador_id = $2::uuid AND periodo = $3 RETURNING id', [cuentaId, trabajadorId, periodo]);
            return r.length === 1;
        },

        /** Abre un enlace vigente: suma la vista en la misma sentencia y devuelve a qué liquidación corresponde. */
        async abrirEnlaceLiquidacion(tokenHash, ahoraIso) {
            const r = await filas(
                'UPDATE enlaces_liquidacion SET vistas = vistas + 1, ultima_vista = $2::timestamptz, primera_vista = COALESCE(primera_vista, $2::timestamptz) ' +
                'WHERE token_hash = $1 AND vence > $2::timestamptz RETURNING cuenta_id, trabajador_id, periodo, pagada',
                [tokenHash, ahoraIso]
            );
            return r[0] ? { cuentaId: r[0].cuenta_id, trabajadorId: r[0].trabajador_id, periodo: r[0].periodo, pagada: r[0].pagada === true } : null;
        },

        // ---------- avisos por correo (preferencia y avisos ya enviados; migración 004) ----------

        async obtenerAvisosCorreo(cuentaId) {
            const r = await filas('SELECT activo, ultimo_envio FROM avisos_correo WHERE cuenta_id = $1::uuid', [cuentaId]);
            return r[0] ? { activo: r[0].activo === true, ultimoEnvio: r[0].ultimo_envio ? new Date(r[0].ultimo_envio).toISOString() : null } : { activo: false, ultimoEnvio: null };
        },

        async guardarAvisosCorreo(cuentaId, activo, ahoraIso) {
            await filas(
                'INSERT INTO avisos_correo (cuenta_id, activo, actualizado) VALUES ($1::uuid, $2::boolean, $3::timestamptz) ' +
                'ON CONFLICT (cuenta_id) DO UPDATE SET activo = EXCLUDED.activo, actualizado = EXCLUDED.actualizado',
                [cuentaId, activo, ahoraIso]
            );
        },

        /** Cuentas con los avisos activos, las que llevan más tiempo sin correo primero. */
        async cuentasConAvisos(limite) {
            const r = await filas(
                'SELECT a.cuenta_id, c.email, a.enviados FROM avisos_correo a JOIN cuentas c ON c.id = a.cuenta_id WHERE a.activo ' +
                'ORDER BY a.ultimo_envio NULLS FIRST LIMIT $1::int',
                [limite]
            );
            return r.map(x => ({ cuentaId: x.cuenta_id, email: x.email, enviados: x.enviados || {} }));
        },

        async registrarEnvioAvisos(cuentaId, enviados, ahoraIso) {
            await filas('UPDATE avisos_correo SET enviados = $2::jsonb, ultimo_envio = $3::timestamptz WHERE cuenta_id = $1::uuid', [cuentaId, JSON.stringify(enviados), ahoraIso]);
        },

        // ---------- opiniones del piloto (migración 006) ----------

        /** Guarda una opinión sin pasar de `maxPorDia` en las últimas 24 horas por cuenta. Devuelve el id o null si ya llegó al máximo. */
        async guardarComentario({ cuentaId, tipo, pantalla, texto, contacto, ahoraIso, maxPorDia }) {
            const r = await conCandado('comentarios:' + cuentaId,
                'INSERT INTO comentarios_piloto (cuenta_id, tipo, pantalla, texto, contacto, creado) ' +
                'SELECT $1::uuid, $2, $3, $4, $5::boolean, $6::timestamptz ' +
                "WHERE (SELECT count(*) FROM comentarios_piloto WHERE cuenta_id = $1::uuid AND creado > $6::timestamptz - interval '24 hours') < $7::int RETURNING id",
                [cuentaId, tipo, pantalla, texto, contacto, ahoraIso, maxPorDia]
            );
            return r[0] ? r[0].id : null;
        },

        // ---------- boletas de honorarios (una fila cifrada por empresa y mes; migración 002) ----------

        async listarHonorarios(empresaId, periodo) {
            const r = await filas(
                'SELECT periodo, datos_cifrados, version_clave FROM honorarios WHERE empresa_id = $1::uuid AND ($2::text IS NULL OR periodo = $2::text) ORDER BY periodo',
                [empresaId, periodo || null]
            );
            return r.map(x => ({ periodo: x.periodo, datos: Buffer.from(x.datos_cifrados), version: Number(x.version_clave) }));
        },

        /** Crea o reemplaza las boletas del mes, sin pasar de `maxPeriodos` meses por empresa. Devuelve true o false. */
        async guardarHonorarios({ empresaId, periodo, datos, version, ahoraIso, maxPeriodos }) {
            const r = await conCandado('honorarios:' + empresaId,
                'INSERT INTO honorarios (empresa_id, periodo, datos_cifrados, version_clave, actualizado) ' +
                'SELECT $1::uuid, $2::text, $3::bytea, $4::smallint, $5::timestamptz ' +
                'WHERE (SELECT count(*) FROM honorarios h WHERE h.empresa_id = $1::uuid) < $6::int OR EXISTS (SELECT 1 FROM honorarios h WHERE h.empresa_id = $1::uuid AND h.periodo = $2::text) ' +
                'ON CONFLICT (empresa_id, periodo) DO UPDATE SET datos_cifrados = EXCLUDED.datos_cifrados, version_clave = EXCLUDED.version_clave, actualizado = EXCLUDED.actualizado RETURNING id',
                [empresaId, periodo, datos, version, ahoraIso, maxPeriodos]
            );
            return r.length === 1;
        },

        async borrarHonorarios(empresaId, periodo) {
            const r = await filas('DELETE FROM honorarios WHERE empresa_id = $1::uuid AND periodo = $2 RETURNING id', [empresaId, periodo]);
            return r.length === 1;
        },

        // ---------- registro de documentos emitidos (solo el tipo y la fecha, nunca el texto) ----------

        /** Registra un documento emitido para un trabajador de esa empresa, sin pasar de `maximo` registros por trabajador. Devuelve true o false. */
        async registrarDocumento({ trabajadorId, empresaId, tipo, ahoraIso, maximo }) {
            const r = await conCandado('documentos:' + trabajadorId,
                'INSERT INTO documentos (trabajador_id, tipo, emitido) SELECT t.id, $3, $4::timestamptz FROM trabajadores t WHERE t.id = $1::uuid AND t.empresa_id = $2::uuid ' +
                'AND (SELECT count(*) FROM documentos d WHERE d.trabajador_id = t.id) < $5::int RETURNING id',
                [trabajadorId, empresaId, tipo, ahoraIso, maximo]
            );
            return r.length === 1;
        },

        // ---------- vacaciones (cifradas, con el mismo candado por trabajador que los meses) ----------

        async listarVacaciones(empresaId) {
            const r = await filas(
                'SELECT v.id, v.trabajador_id, v.datos_cifrados, v.version_clave, v.creado FROM vacaciones v JOIN trabajadores t ON t.id = v.trabajador_id ' +
                'WHERE t.empresa_id = $1::uuid ORDER BY v.creado, v.id',
                [empresaId]
            );
            return r.map(x => ({ id: x.id, trabajadorId: x.trabajador_id, datos: Buffer.from(x.datos_cifrados), version: Number(x.version_clave), creado: new Date(x.creado).toISOString() }));
        },

        /** Agrega un registro de vacaciones a un trabajador de esa empresa, sin pasar de `maximo` por trabajador. Devuelve true o false. */
        async crearVacacion({ id, trabajadorId, empresaId, datos, version, ahoraIso, maximo }) {
            const r = await conCandado('vacaciones:' + trabajadorId,
                'WITH permitido AS (SELECT t.id AS trabajador_id FROM trabajadores t WHERE t.id = $2::uuid AND t.empresa_id = $3::uuid ' +
                'AND (SELECT count(*) FROM vacaciones v WHERE v.trabajador_id = t.id) < $7::int) ' +
                'INSERT INTO vacaciones (id, trabajador_id, datos_cifrados, version_clave, creado) ' +
                'SELECT $1::uuid, permitido.trabajador_id, $4::bytea, $5::smallint, $6::timestamptz FROM permitido RETURNING id',
                [id, trabajadorId, empresaId, datos, version, ahoraIso, maximo]
            );
            return r.length === 1;
        },

        async borrarVacacion(id, empresaId) {
            const r = await filas(
                'DELETE FROM vacaciones v USING trabajadores t WHERE v.trabajador_id = t.id AND v.id = $1::uuid AND t.empresa_id = $2::uuid RETURNING v.id',
                [id, empresaId]
            );
            return r.length === 1;
        },

        async listarDocumentos(empresaId) {
            const r = await filas(
                'SELECT d.trabajador_id, d.tipo, d.emitido FROM documentos d JOIN trabajadores t ON t.id = d.trabajador_id WHERE t.empresa_id = $1::uuid ORDER BY d.emitido, d.id',
                [empresaId]
            );
            return r.map(x => ({ trabajadorId: x.trabajador_id, tipo: x.tipo, emitido: new Date(x.emitido).toISOString() }));
        },

        /**
         * Fecha hasta la que llega el pase de la cuenta, en milisegundos, o null si hoy no tiene uno vigente.
         * Si compro otro pase mientras tenia uno, el segundo empieza cuando termina el primero: cuenta la vigencia total.
         */
        async paseVigente(cuentaId, ahoraIso) {
            const r = await filas(
                'SELECT max(vence) FILTER (WHERE vence > $2::timestamptz) AS vence, coalesce(bool_or(desde <= $2::timestamptz AND vence > $2::timestamptz), false) AS activo FROM pases WHERE cuenta_id = $1::uuid',
                [cuentaId, ahoraIso]
            );
            return r[0] && r[0].activo && r[0].vence ? new Date(r[0].vence).getTime() : null;
        },

        /** Producto del pase que esta en curso ahora (el de mayor vigencia entre los activos), o null. */
        async paseActual(cuentaId, ahoraIso) {
            const r = await filas(
                'SELECT producto, vence FROM pases WHERE cuenta_id = $1::uuid AND desde <= $2::timestamptz AND vence > $2::timestamptz ORDER BY vence DESC LIMIT 1',
                [cuentaId, ahoraIso]
            );
            return r[0] ? { producto: r[0].producto, vence: new Date(r[0].vence).getTime() } : null;
        },

        /**
         * Registra un pase pagado. La orden de Flow es unica: si Flow avisa dos veces el mismo pago no se duplica (devuelve null).
         * Empieza cuando termina el ultimo pase de la cuenta, o ahora si no tiene ninguno vigente. Todo en una sentencia.
         */
        async registrarPase({ cuentaId, producto, ordenFlow, dias, ahoraIso }) {
            const r = await conCandado('pases:' + cuentaId,
                'WITH base AS (SELECT greatest($4::timestamptz, coalesce((SELECT max(vence) FROM pases WHERE cuenta_id = $1::uuid), $4::timestamptz)) AS desde) ' +
                'INSERT INTO pases (cuenta_id, producto, orden_flow, desde, vence) SELECT $1::uuid, $2, $3, base.desde, base.desde + make_interval(days => $5::int) FROM base ' +
                'ON CONFLICT (orden_flow) DO NOTHING RETURNING desde, vence',
                [cuentaId, producto, ordenFlow, ahoraIso, dias]
            );
            return r[0] ? { desde: new Date(r[0].desde).getTime(), vence: new Date(r[0].vence).getTime() } : null;
        },

        /** Pase ya registrado para una orden de Flow (para responder igual a un aviso repetido). */
        async paseDeOrden(ordenFlow) {
            const r = await filas('SELECT cuenta_id, producto, vence FROM pases WHERE orden_flow = $1', [ordenFlow]);
            return r[0] ? { cuentaId: r[0].cuenta_id, producto: r[0].producto, vence: new Date(r[0].vence).getTime() } : null;
        },

        async buscarCuentaPorId(cuentaId) {
            const r = await filas('SELECT id, email FROM cuentas WHERE id = $1::uuid', [cuentaId]);
            return r[0] ? { id: r[0].id, email: r[0].email } : null;
        },

        /** Borra la cuenta y, en cascada, sesiones, empresa, trabajadores, vacaciones, meses, documentos, honorarios y pases. */
        async borrarCuenta(cuentaId) {
            await filas('DELETE FROM cuentas WHERE id = $1::uuid', [cuentaId]);
        }
    };
}

module.exports = { crearAlmacenSql };
