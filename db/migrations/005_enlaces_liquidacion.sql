-- Asistente Laboral Pyme · 005: liquidación compartida por enlace (14-oct-2026)
-- Un enlace por trabajador y mes. El token se guarda solo como huella (como los de acceso y sesión). La liquidación no se
-- copia: se arma al abrir el enlace desde el mes guardado (cifrado). Se registra cuándo se abrió y cuántas veces.
-- Borrar la cuenta o el trabajador borra los enlaces en cascada.

CREATE TABLE IF NOT EXISTS enlaces_liquidacion (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash     text NOT NULL UNIQUE,
    cuenta_id      uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    trabajador_id  uuid NOT NULL REFERENCES trabajadores (id) ON DELETE CASCADE,
    periodo        text NOT NULL,
    pagada         boolean NOT NULL DEFAULT false,
    creado         timestamptz NOT NULL DEFAULT now(),
    vence          timestamptz NOT NULL,
    primera_vista  timestamptz,
    ultima_vista   timestamptz,
    vistas         integer NOT NULL DEFAULT 0,
    CONSTRAINT enlaces_liquidacion_periodo CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT enlaces_liquidacion_vence CHECK (vence > creado),
    CONSTRAINT enlaces_liquidacion_unico UNIQUE (trabajador_id, periodo)
);
CREATE INDEX IF NOT EXISTS enlaces_liquidacion_cuenta_idx ON enlaces_liquidacion (cuenta_id, periodo);
