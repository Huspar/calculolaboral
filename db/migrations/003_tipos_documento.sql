-- Asistente Laboral Pyme · 003: tipos de documento que se agregaron después de la 001 (13-oct-2026)
-- El asistente registra también el anexo de contrato y el pacto de horas extra; la regla de la 001 los rechazaba.
-- Debe coincidir con TIPOS_DOCUMENTO de api/_pyme/datos.js (lo revisa tools/test_db_migrate.js).

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_tipo;
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo CHECK (tipo IN (
    'cert_antiguedad', 'cert_remuneraciones', 'comprobante_feriado',
    'carta_159_4', 'carta_161', 'amonestacion', 'anexo_datos',
    'contrato', 'anexo_42h', 'finiquito', 'liquidacion',
    'anexo_contrato', 'pacto_horas_extra'
));
