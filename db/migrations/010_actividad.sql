-- Registro de actividad del estudio (fase 1 de equipo y portal del cliente).
--
-- Quien hizo que, en que empresa y cuando. NO guarda montos ni datos de trabajadores: solo el tipo de accion y ids.
-- `actor_id` es la cuenta de la persona; hoy es la misma de `cuenta_id` (una persona por cuenta) y con el equipo sera
-- la persona que actuo dentro del estudio. Se borra con la cuenta y se limpia a los 24 meses (api/_pyme/almacen.js).

CREATE TABLE IF NOT EXISTS actividad (
    id          bigserial PRIMARY KEY,
    cuenta_id   uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    empresa_id  uuid,
    actor_id    uuid,
    accion      text NOT NULL CHECK (char_length(accion) BETWEEN 1 AND 60),
    origen      text NOT NULL DEFAULT 'servidor' CHECK (origen IN ('servidor', 'cliente')),
    ip_hash     text,
    cuando      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actividad_cuenta_idx ON actividad (cuenta_id, cuando DESC);
