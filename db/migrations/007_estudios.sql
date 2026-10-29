-- Estudios contables: la capa de cuentas del producto para contadores.
--
-- Una cuenta (cuentas, la misma del Asistente Pyme: se entra con un enlace al correo)
-- guarda su estudio completo en una sola fila cifrada: clientes, nóminas cargadas e
-- historial de meses. La base nunca ve esos datos en claro.
--
-- Mismo criterio que el resto del esquema: datos_cifrados + version_clave (AES-256-GCM
-- hecho por la aplicación, ver api/_pyme/cifrado.js) y borrado en cascada con la cuenta.

CREATE TABLE IF NOT EXISTS estudios (
    cuenta_id       uuid PRIMARY KEY REFERENCES cuentas (id) ON DELETE CASCADE,
    datos_cifrados  bytea NOT NULL,
    version_clave   smallint NOT NULL,
    actualizado     timestamptz NOT NULL DEFAULT now(),
    creado          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE estudios IS 'Datos del estudio contable (clientes, nominas, historial) cifrados por cuenta';
