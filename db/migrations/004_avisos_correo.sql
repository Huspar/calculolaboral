-- Asistente Laboral Pyme · 004: avisos por correo (14-oct-2026)
-- Preferencia de la cuenta (apagada por defecto) y registro de los avisos ya enviados, para no repetirlos.
-- "enviados" guarda solo identificadores de aviso (tipo y id interno del trabajador) con su fecha: ningún dato personal.
-- Borrar la cuenta borra esta fila en cascada.

CREATE TABLE IF NOT EXISTS avisos_correo (
    cuenta_id     uuid PRIMARY KEY REFERENCES cuentas (id) ON DELETE CASCADE,
    activo        boolean NOT NULL DEFAULT false,
    enviados      jsonb NOT NULL DEFAULT '{}'::jsonb,
    ultimo_envio  timestamptz,
    actualizado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avisos_correo_activo_idx ON avisos_correo (activo) WHERE activo;
