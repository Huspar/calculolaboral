-- Asistente Laboral Pyme: esquema inicial (Neon Postgres, region Sao Paulo)
--
-- Reglas de este esquema:
-- * Todo dato personal (nombre, RUT, sueldo, domicilio, vacaciones, meses de liquidacion) va en columnas
--   datos_cifrados (AES-256-GCM hecho por la aplicacion, ver api/_pyme/cifrado.js). La base nunca ve esos datos en claro.
-- * version_clave identifica con que version de PYME_DATA_KEY se cifro cada fila (permite rotar la clave).
-- * Los tokens de acceso y de sesion se guardan solo como hash SHA-256.
-- * Borrar una cuenta borra todo en cascada. Solo queda un evento en "auditoria", sin datos personales.

CREATE TABLE IF NOT EXISTS cuentas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text NOT NULL,
    creada          timestamptz NOT NULL DEFAULT now(),
    ultimo_acceso   timestamptz,
    acepto_encargo  timestamptz,
    CONSTRAINT cuentas_email_minuscula CHECK (email = lower(email) AND position('@' IN email) > 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_email_idx ON cuentas (email);

CREATE TABLE IF NOT EXISTS enlaces_acceso (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL,
    token_hash  text NOT NULL UNIQUE,
    creado      timestamptz NOT NULL DEFAULT now(),
    vence       timestamptz NOT NULL,
    usado       timestamptz
);
CREATE INDEX IF NOT EXISTS enlaces_acceso_email_idx ON enlaces_acceso (email, creado DESC);
CREATE INDEX IF NOT EXISTS enlaces_acceso_vence_idx ON enlaces_acceso (vence);

CREATE TABLE IF NOT EXISTS sesiones (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id   uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,
    creada      timestamptz NOT NULL DEFAULT now(),
    vence       timestamptz NOT NULL,
    revocada    timestamptz
);
CREATE INDEX IF NOT EXISTS sesiones_cuenta_idx ON sesiones (cuenta_id);
CREATE INDEX IF NOT EXISTS sesiones_vence_idx ON sesiones (vence);

CREATE TABLE IF NOT EXISTS empresas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id       uuid NOT NULL UNIQUE REFERENCES cuentas (id) ON DELETE CASCADE,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    actualizada     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trabajadores (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    activo          boolean NOT NULL DEFAULT true,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    creado          timestamptz NOT NULL DEFAULT now(),
    actualizado     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trabajadores_empresa_idx ON trabajadores (empresa_id);

CREATE TABLE IF NOT EXISTS vacaciones (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id   uuid NOT NULL REFERENCES trabajadores (id) ON DELETE CASCADE,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    creado          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vacaciones_trabajador_idx ON vacaciones (trabajador_id);

CREATE TABLE IF NOT EXISTS meses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id   uuid NOT NULL REFERENCES trabajadores (id) ON DELETE CASCADE,
    periodo         text NOT NULL,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    actualizado     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meses_periodo_formato CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT meses_unico UNIQUE (trabajador_id, periodo)
);

-- Registro de documentos emitidos: solo el tipo y la fecha, nunca el texto
CREATE TABLE IF NOT EXISTS documentos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id   uuid NOT NULL REFERENCES trabajadores (id) ON DELETE CASCADE,
    tipo            text NOT NULL,
    emitido         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documentos_tipo CHECK (tipo IN (
        'cert_antiguedad', 'cert_remuneraciones', 'comprobante_feriado',
        'carta_159_4', 'carta_161', 'amonestacion', 'anexo_datos',
        'contrato', 'anexo_42h', 'finiquito', 'liquidacion'
    ))
);
CREATE INDEX IF NOT EXISTS documentos_trabajador_idx ON documentos (trabajador_id, emitido DESC);

-- Pases pagados con Flow. orden_flow unico: un pago no puede registrarse dos veces.
CREATE TABLE IF NOT EXISTS pases (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id   uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    producto    text NOT NULL,
    orden_flow  text NOT NULL UNIQUE,
    desde       timestamptz NOT NULL,
    vence       timestamptz NOT NULL,
    CONSTRAINT pases_producto CHECK (producto IN ('pyme3', 'pyme12')),
    CONSTRAINT pases_vigencia CHECK (vence > desde)
);
CREATE INDEX IF NOT EXISTS pases_cuenta_idx ON pases (cuenta_id, vence DESC);

-- Limite de solicitudes (enlaces de acceso por correo y por IP). La clave es un hash, no el correo ni la IP.
CREATE TABLE IF NOT EXISTS intentos (
    clave   text NOT NULL,
    ventana timestamptz NOT NULL,
    cuenta  integer NOT NULL DEFAULT 0,
    PRIMARY KEY (clave, ventana)
);
CREATE INDEX IF NOT EXISTS intentos_ventana_idx ON intentos (ventana);

-- Auditoria sin datos personales. Sin clave foranea: sobrevive al borrado de la cuenta.
CREATE TABLE IF NOT EXISTS auditoria (
    id          bigserial PRIMARY KEY,
    cuenta_id   uuid,
    evento      text NOT NULL,
    ip_hash     text,
    cuando      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auditoria_cuenta_idx ON auditoria (cuenta_id, cuando DESC);
