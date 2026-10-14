-- Asistente Laboral Pyme · 006: opiniones del piloto gratuito (14-oct-2026)
-- Lo que los usuarios cuentan desde el botón «Tu opinión»: qué funciona, qué no, qué agregarían. Texto libre de hasta 2.000 caracteres.
-- No se cifra (no es un dato del trabajador y el formulario pide no escribirlos); la cuenta queda enlazada para poder responder
-- solo si la persona marcó «puedes escribirme». Borrar la cuenta borra sus opiniones en cascada.

CREATE TABLE IF NOT EXISTS comentarios_piloto (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id  uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    tipo       text NOT NULL CHECK (tipo IN ('funciona', 'no_funciona', 'sugerencia', 'otro')),
    pantalla   text NOT NULL DEFAULT '' CHECK (char_length(pantalla) <= 40),
    texto      text NOT NULL CHECK (char_length(texto) BETWEEN 5 AND 2000),
    contacto   boolean NOT NULL DEFAULT false,
    creado     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comentarios_piloto_cuenta_idx ON comentarios_piloto (cuenta_id, creado DESC);
