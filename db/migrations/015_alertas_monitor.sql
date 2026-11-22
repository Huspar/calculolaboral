-- Monitor Tributario y Previsional · 015: lista pública de suscriptores de alertas (22-nov-2026)
-- Opt-in con confirmación por correo (doble opt-in), independiente de las cuentas del Asistente Pyme.
-- El correo se guarda en minúsculas. token_hash es la huella SHA-256 del token de confirmación;
-- baja_clave es un secreto aleatorio en claro que solo viaja en el enlace de darse de baja.
-- Datos mínimos: correo y origen. Nada más.

CREATE TABLE IF NOT EXISTS suscriptores_alertas (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    correo      text NOT NULL,
    origen      text NOT NULL DEFAULT 'monitor',
    estado      text NOT NULL DEFAULT 'pendiente',   -- pendiente | activo | baja
    token_hash  text NOT NULL,
    baja_clave  text NOT NULL,
    creado      timestamptz NOT NULL DEFAULT now(),
    confirmado  timestamptz,
    dado_baja   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS suscriptores_alertas_correo_uq ON suscriptores_alertas (correo);
CREATE INDEX IF NOT EXISTS suscriptores_alertas_activo_idx ON suscriptores_alertas (estado) WHERE estado = 'activo';
