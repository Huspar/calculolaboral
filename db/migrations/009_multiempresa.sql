-- Varias empresas por cuenta, paso 2: se quita la restriccion de una sola empresa por cuenta.
--
-- Hasta ahora empresas.cuenta_id era UNICO. Un estudio contable maneja una empresa por cliente.
-- Todo lo demas ya colgaba de empresas.id (trabajadores, meses, honorarios, enlaces) y no cambia.
-- El maximo de empresas por cuenta lo pone la aplicacion (api/_pyme/datos.js), no la base.
-- Se aplica DESPUES de publicar el codigo que ya no usa ON CONFLICT (cuenta_id) (ver 008_empresas_creada.sql).

ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_cuenta_id_key;
