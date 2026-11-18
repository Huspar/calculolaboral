-- Portal Cliente Marca Blanca del Estudio Contable (Ley N° 21.719).
-- Token almacenado solo como huella HMAC-SHA256; snapshot cifrado con AES-256-GCM.
-- Vigencia corta configurable (7 a 30 dias) y revocacion inmediata en 1 clic.

CREATE TABLE IF NOT EXISTS portal_estudio (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id      uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    cliente_nombre text NOT NULL,
    cliente_rut    text NOT NULL DEFAULT '',
    periodo        text NOT NULL,
    token_hash     text NOT NULL UNIQUE,
    secciones      jsonb NOT NULL DEFAULT '{"f29": true, "pnl": true, "laboral": true}'::jsonb,
    datos_cifrados bytea NOT NULL,
    version_clave  integer NOT NULL DEFAULT 1,
    creado         timestamptz NOT NULL DEFAULT now(),
    vence          timestamptz NOT NULL,
    revocado       timestamptz,
    ultimo_acceso  timestamptz,
    accesos        integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS portal_estudio_cuenta_idx ON portal_estudio (cuenta_id, creado DESC);
CREATE INDEX IF NOT EXISTS portal_estudio_hash_idx ON portal_estudio (token_hash);
