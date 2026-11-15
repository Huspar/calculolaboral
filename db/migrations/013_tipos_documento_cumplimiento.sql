-- Asistente Laboral Pyme · 013: tipos de documento de cumplimiento DT, Ley Karin, DS 44 y firma electrónica simple
-- Debe coincidir con TIPOS_DOCUMENTO de api/_pyme/datos.js (lo revisa tools/test_db_migrate.js).

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_tipo;
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo CHECK (tipo IN (
    'cert_antiguedad', 'cert_remuneraciones', 'comprobante_feriado',
    'carta_159_4', 'carta_161', 'amonestacion', 'anexo_datos',
    'constancia_rihs_irl', 'consentimiento_firma',
    'contrato', 'anexo_42h', 'finiquito', 'liquidacion',
    'anexo_contrato', 'pacto_horas_extra'
));
