-- Portal del cliente (fase 3 de equipo y portal del cliente).
--
-- Un cliente del portal es una persona (por su correo) autorizada a consultar UNA empresa en solo lectura.
-- No tiene acceso al estudio ni a otras empresas. Solo ve las secciones que el estudio le activa (resumen por defecto).
-- Quitarlo borra la fila y pierde acceso en la siguiente peticion.
-- Limite del piloto: 1 cliente con portal por empresa (hasta 25 empresas).

CREATE TABLE IF NOT EXISTS portal_clientes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id    uuid NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
    empresa_id    uuid NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
    email         text NOT NULL,
    secciones     jsonb NOT NULL DEFAULT '{"resumen": true, "liquidaciones": false, "documentos": false}'::jsonb,
    invitado_por  uuid,
    creado        timestamptz NOT NULL DEFAULT now(),
    ultimo_acceso timestamptz,
    CONSTRAINT portal_clientes_email_minuscula CHECK (email = lower(email) AND position('@' IN email) > 1),
    CONSTRAINT portal_clientes_empresa_unica UNIQUE (empresa_id, email)
);
CREATE INDEX IF NOT EXISTS portal_clientes_email_idx ON portal_clientes (email);
CREATE INDEX IF NOT EXISTS portal_clientes_empresa_idx ON portal_clientes (empresa_id);
