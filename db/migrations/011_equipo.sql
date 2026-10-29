-- Equipo del estudio (fase 2 de equipo y portal del cliente).
--
-- Una persona del equipo es un correo con un rol dentro de UN estudio (la cuenta del titular). No guarda datos del estudio ni claves:
-- al entrar con su propio correo (enlace de un solo uso, como todos) el servidor busca aqui a que estudios pertenece y con que rol.
-- Quitarla borra la fila y pierde el acceso en la siguiente peticion. `empresas` son las empresas asignadas (vacio = ninguna; para el
-- rol admin no se usa porque ve todas). El maximo de personas lo pone la aplicacion (api/_pyme/equipo.js).

CREATE TABLE IF NOT EXISTS miembros (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id    uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    email         text NOT NULL,
    rol           text NOT NULL CHECK (rol IN ('admin', 'contador', 'asistente', 'lectura')),
    empresas      jsonb NOT NULL DEFAULT '[]'::jsonb,
    invitado_por  uuid,
    creado        timestamptz NOT NULL DEFAULT now(),
    ultimo_acceso timestamptz,
    CONSTRAINT miembros_email_minuscula CHECK (email = lower(email) AND position('@' IN email) > 1),
    CONSTRAINT miembros_unico UNIQUE (estudio_id, email)
);
CREATE INDEX IF NOT EXISTS miembros_email_idx ON miembros (email);
