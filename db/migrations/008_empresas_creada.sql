-- Varias empresas por cuenta, paso 1: fecha de creacion de cada empresa (para ordenarlas).
--
-- Es un cambio que el codigo anterior no nota, asi que se aplica ANTES de publicar el codigo nuevo.
-- El paso 2 (009_multiempresa.sql) quita la restriccion de una empresa por cuenta y se aplica DESPUES.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS creada timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS empresas_cuenta_idx ON empresas (cuenta_id, creada, id);
