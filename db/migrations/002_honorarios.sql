-- Asistente Laboral Pyme · 002: boletas de honorarios recibidas por la empresa (13-oct-2026)
-- Una fila por empresa y mes con la lista de boletas cifrada (nombre y RUT del prestador van dentro de datos_cifrados).
-- Borrar la cuenta borra la empresa y, en cascada, estas filas.

CREATE TABLE IF NOT EXISTS honorarios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    periodo         text NOT NULL,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    actualizado     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT honorarios_periodo_formato CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT honorarios_unico UNIQUE (empresa_id, periodo)
);
