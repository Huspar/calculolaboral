/* Personalizador Web del Kit Ley 21.719 (client-side, zero datos enviados al servidor) */
(function (root) {
    'use strict';

    function getZipEngine() {
        var eng = root.CLKitZipEngine || (typeof require === 'function' ? require('./kit_zip_engine.js') : null);
        if (!eng) throw new Error('Falta CLKitZipEngine (js/kit_zip_engine.js).');
        return eng;
    }

    var Zip = getZipEngine();
    var esc = Zip.escXml;
    var fechaHoyLarga = Zip.fechaHoyLarga;
    var or = Zip.or;
    var slugRut = Zip.slugRut;

    function buildZip(entries) {
        return new Blob([Zip.buildZipBytes(entries)], { type: 'application/zip' });
    }

    function headerDoc(titulo, subtitulo) {
        return '<p style="text-align:center;font-weight:700;font-size:13pt;margin:0 0 4pt 0;color:#00382E;">' + esc(titulo) + '</p>' +
            '<p style="text-align:center;font-size:9.5pt;color:#4B5563;margin:0 0 14pt 0;">' + esc(subtitulo) + '</p>';
    }

    function footerNota() {
        return '<p style="margin-top:16pt;padding-top:8pt;border-top:1px solid #CBD5E1;font-size:8.5pt;color:#4B5563;">' +
            'Modelo de referencia basado en la Ley N° 19.628 modificada por la Ley N° 21.719 (rige desde el 1 de diciembre de 2026); no constituye asesoría legal. Si tu caso tiene particularidades, revísalo con un abogado antes de firmar.</p>';
    }

    function normData(raw) {
        raw = raw || {};
        return {
            razonSocial: or(raw.razonSocial, '[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]'),
            rutEmpresa: or(raw.rutEmpresa, '[RUT EMPRESA]'),
            ciudad: or(raw.ciudad, '[CIUDAD]'),
            direccion: or(raw.direccion, '[DIRECCIÓN COMERCIAL, COMUNA, CIUDAD]'),
            sitioWeb: or(raw.sitioWeb, '[SITIO WEB DE LA EMPRESA]'),
            correoPrivacidad: or(raw.correoPrivacidad, '[CORREO DE PRIVACIDAD DE LA EMPRESA]'),
            representante: or(raw.representante, '[NOMBRE DEL REPRESENTANTE LEGAL]'),
            rutRepresentante: or(raw.rutRepresentante, '[RUT REPRESENTANTE]'),
            responsableInterno: or(raw.responsableInterno, or(raw.representante, '[NOMBRE Y CARGO DEL RESPONSABLE INTERNO]')),
            fecha: or(raw.fecha, fechaHoyLarga()),
            trabajadorNombre: or(raw.trabajadorNombre, '[NOMBRE COMPLETO DEL TRABAJADOR]'),
            trabajadorRut: or(raw.trabajadorRut, '[RUT TRABAJADOR]'),
            usaBiometria: raw.usaBiometria !== false,
            usaHerramientas: raw.usaHerramientas !== false,
            proveedorNombre: or(raw.proveedorNombre, '[NOMBRE DEL PROVEEDOR / CONTADOR / SOFTWARE]'),
            proveedorRut: or(raw.proveedorRut, '[RUT PROVEEDOR]'),
            proveedorServicio: or(raw.proveedorServicio, 'contabilidad, software de nómina o servicios en la nube'),
            proveedorTitulares: or(raw.proveedorTitulares, 'trabajadores, clientes o proveedores'),
            adoptaModeloPrev: raw.adoptaModeloPrev === true
        };
    }

    var DOCUMENTOS = [
        {
            id: 'anexo_laboral',
            num: 'DOC 1',
            archivo: '1_Anexo_Laboral_Datos_Personales_Ley_21719.docx',
            titulo: 'Anexo Laboral de Datos Personales',
            etiqueta: 'Para firmar con cada trabajador (Art. 154 ter CT, Arts. 16 a 16 ter Ley 19.628 y Res. 38 DT)',
            build: function (d) {
                var biom = d.usaBiometria
                    ? '<p><strong>CLÁUSULA CUARTA: SISTEMA DE CONTROL DE ASISTENCIA Y CONSENTIMIENTO EXPRESO BIOMÉTRICO (ART. 16 TER Y RES. EXENTA N° 38/2024 DT).</strong> En cumplimiento del artículo 16 ter de la Ley N° 19.628 y de la Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo, el Trabajador toma conocimiento de que la empresa dispone de un sistema automatizado de control de asistencia que puede operar mediante reconocimiento biométrico (huella o rostro), exclusivamente para registrar su jornada laboral y calcular remuneraciones mientras dure el contrato. Los datos capturados se almacenan únicamente como patrones matemáticos encriptados y no como imágenes reconstruibles. El Empleador garantiza expresamente al Trabajador el derecho a optar por un método de marcaje alternativo no biométrico (tarjeta magnética, clave/PIN o aplicación), sin que su negativa o retiro del consentimiento pueda constituir falta laboral, represalia o causal de despido.</p>'
                    : '<p><strong>CLÁUSULA CUARTA: CONTROL DE ASISTENCIA.</strong> El Trabajador toma conocimiento de que el registro de jornada se efectúa mediante método no biométrico autorizado conforme a la Resolución Exenta N° 38/2024 de la Dirección del Trabajo, utilizándose dichos registros exclusivamente para el control de jornada y cálculo de remuneraciones.</p>';
                var herr = d.usaHerramientas
                    ? '<p><strong>CLÁUSULA QUINTA: HERRAMIENTAS CORPORATIVAS Y POLÍTICA DE DISPOSITIVOS.</strong> Los correos electrónicos corporativos, computadores, teléfonos y cuentas asignadas por <strong>' + esc(d.razonSocial) + '</strong> son herramientas de trabajo de propiedad exclusiva de la empresa. El Empleador podrá implementar medidas de ciberseguridad proporcionales, respetando en todo momento el derecho a la intimidad y honra del Trabajador, quedando vedada la inspección intrusiva de comunicaciones estrictamente personales.</p>'
                    : '';
                return headerDoc('ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO · PROTECCIÓN DE DATOS PERSONALES', 'Ley N° 19.628 modificada por Ley N° 21.719 · Art. 154 ter del Código del Trabajo · Res. Exenta N° 38/2024 DT') +
                    '<p>En <strong>' + esc(d.ciudad) + '</strong>, a <strong>' + esc(d.fecha) + '</strong>, entre:</p>' +
                    '<p>1. <strong>' + esc(d.razonSocial) + '</strong>, RUT N° <strong>' + esc(d.rutEmpresa) + '</strong>, domiciliada en ' + esc(d.direccion) + ', representada legalmente por don/doña ' + esc(d.representante) + ' (RUT ' + esc(d.rutRepresentante) + '), en adelante el «Empleador» o «Responsable del Tratamiento»; y</p>' +
                    '<p>2. Don/Doña <strong>' + esc(d.trabajadorNombre) + '</strong>, cédula nacional de identidad N° <strong>' + esc(d.trabajadorRut) + '</strong>, en adelante el «Trabajador» o «Titular de los Datos»;</p>' +
                    '<p>Se ha convenido y suscrito el siguiente ANEXO AL CONTRATO DE TRABAJO:</p>' +
                    '<p><strong>CLÁUSULA PRIMERA: ANTECEDENTES Y MARCO NORMATIVO.</strong> Las partes declaran que la Ley N° 21.719 modifica la Ley N° 19.628 sobre protección y tratamiento de los datos personales (vigente desde el 1 de diciembre de 2026) y crea la Agencia de Protección de Datos Personales, y que conforme al artículo 154 ter del Código del Trabajo el Empleador debe mantener reserva de toda la información y datos privados del Trabajador a que tenga acceso con ocasión de la relación laboral. Este anexo no constituye un consentimiento universal para finalidades ajenas a la relación de trabajo.</p>' +
                    '<p><strong>CLÁUSULA SEGUNDA: CATEGORÍAS DE DATOS Y BASE DE LICITUD (ART. 16 LETRA E).</strong> Conforme al artículo 16 letra e) y al artículo 13 de la Ley N° 19.628, el Empleador tratará exclusivamente los datos personales estrictamente necesarios para el cumplimiento de obligaciones laborales y de seguridad social: (a) gestión laboral (liquidaciones, transferencias bancarias, retenciones judiciales, pago de cotizaciones en Previred y finiquitos); (b) reportes legales obligatorios al SII, Dirección del Trabajo (portal Mi DT), AFP, Isapre o Fonasa; y (c) prevención de riesgos ocupacionales conforme a la Ley N° 16.744. Los datos sobre antecedentes penales o infracciones administrativas quedan sujetos a la reserva del artículo 25 de la Ley N° 19.628.</p>' +
                    '<p><strong>CLÁUSULA TERCERA: DATOS SENSIBLES DE SALUD (ART. 16 BIS).</strong> Conforme al artículo 16 bis de la Ley N° 19.628 y al artículo 154 ter del Código del Trabajo, las licencias médicas, diagnósticos y exámenes ocupacionales son datos sensibles con prohibición reforzada. El Empleador solo los trata en los casos calificados por la ley, limitando su acceso al personal encargado de su tramitación ante COMPIN, Isapre, Fonasa o mutualidad, y prohibiendo su divulgación a jefaturas directas o terceros ajenos a dicha tramitación.</p>' +
                    biom + herr +
                    '<p><strong>CLÁUSULA SEXTA: ENCARGADOS DE TRATAMIENTO Y TRANSFERENCIAS (ARTS. 15 BIS, 27 Y 28).</strong> El Trabajador es informado de que el Empleador puede contratar proveedores externos (contador externo, software de nómina o servicios en la nube) en calidad de Encargados de Tratamiento bajo contrato escrito (art. 15 bis), con prohibición de subdelegar sin autorización escrita y sujetando cualquier alojamiento fuera de Chile a las garantías legales de transferencia internacional.</p>' +
                    '<p><strong>CLÁUSULA SÉPTIMA: EJERCICIO DE DERECHOS ARCOPS Y BLOQUEO.</strong> El Trabajador podrá ejercer gratuitamente sus derechos de Acceso, Rectificación, Supresión, Oposición, Portabilidad (cuando el tratamiento sea automatizado y basado en consentimiento, art. 9) y Bloqueo (art. 8 ter) escribiendo a <strong>' + esc(d.correoPrivacidad) + '</strong>. La empresa acusará recibo y responderá dentro de treinta (30) días corridos, prorrogables una sola vez hasta por otros treinta días corridos; en caso de denegación o falta de respuesta, el Trabajador podrá reclamar ante la Agencia de Protección de Datos Personales dentro de 30 días hábiles (art. 11).</p>' +
                    '<p><strong>CLÁUSULA OCTAVA: PLAZO DE CONSERVACIÓN.</strong> Terminada la relación laboral, los datos se conservarán durante los plazos legales de prescripción laboral (2 años desde el término de los servicios, art. 510 del Código del Trabajo) y de respaldo contable/tributario (hasta 6 años según artículos 17 y 200 del Código Tributario), tras lo cual se procederá a su bloqueo y posterior supresión o anonimización segura.</p>' +
                    '<p>Para constancia, se firma el presente anexo en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada parte.</p>' +
                    '<table style="width:100%;margin-top:26pt;border-collapse:collapse;"><tr>' +
                    '<td style="width:50%;text-align:center;vertical-align:top;padding:12pt;">____________________________<br><strong>' + esc(d.razonSocial) + '</strong><br>RUT ' + esc(d.rutEmpresa) + '<br>Empleador / Responsable</td>' +
                    '<td style="width:50%;text-align:center;vertical-align:top;padding:12pt;">____________________________<br><strong>' + esc(d.trabajadorNombre) + '</strong><br>RUT ' + esc(d.trabajadorRut) + '<br>Trabajador / Titular</td>' +
                    '</tr></table>' + footerNota();
            }
        },
        {
            id: 'politica_privacidad',
            num: 'DOC 2',
            archivo: '2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx',
            titulo: 'Política de Privacidad Web y Clientes',
            etiqueta: 'Para publicar en sitio web con los requisitos del Art. 14 ter',
            build: function (d) {
                return headerDoc('POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES', d.razonSocial + ' · RUT ' + d.rutEmpresa) +
                    '<p><strong>1. IDENTIFICACIÓN DEL RESPONSABLE Y CONTACTO (ART. 14 TER).</strong> El responsable del tratamiento de los datos personales recopilados a través de <strong>' + esc(d.sitioWeb) + '</strong>, atención presencial, WhatsApp corporativo y formularios digitales es <strong>' + esc(d.razonSocial) + '</strong>, RUT N° <strong>' + esc(d.rutEmpresa) + '</strong>, domiciliada en ' + esc(d.direccion) + '. Responsable interno de privacidad: <strong>' + esc(d.responsableInterno) + '</strong>, correo de contacto: <strong>' + esc(d.correoPrivacidad) + '</strong>.</p>' +
                    '<p><strong>2. CATEGORÍAS DE DATOS, TITULARES, FUENTE Y FINALIDADES.</strong> Tratamos datos identificatorios, de contacto y facturación proporcionados directamente por clientes, prospectos, proveedores y trabajadores para: (a) procesar compras, emitir documentos tributarios ante el SII y coordinar entregas; (b) responder cotizaciones y soporte; y (c) cumplir deberes laborales y previsionales. La empresa no aplica decisiones exclusivamente automatizadas con efectos jurídicos significativos sobre clientes sin intervención humana (o informará su lógica y revisión humana en caso de usarlas).</p>' +
                    '<p><strong>3. BASES DE LICITUD Y RETIRO DEL CONSENTIMIENTO.</strong> El tratamiento se funda en la ejecución contractual, obligaciones legales y tributarias (Código Tributario, Código del Trabajo y Ley N° 19.496), interés legítimo proporcional y consentimiento previo, expreso e informado cuando corresponda. Cuando la base sea el consentimiento, el titular puede retirarlo gratuitamente en cualquier momento escribiendo a <strong>' + esc(d.correoPrivacidad) + '</strong>.</p>' +
                    '<p><strong>4. DESTINATARIOS, ENCARGADOS Y TRANSFERENCIAS INTERNACIONALES (ARTS. 15 BIS, 27 Y 28).</strong> ' + esc(d.razonSocial) + ' no vende bases de datos. Solo comunica datos por deber legal (SII, DT, tribunales) o a encargados tecnológicos (contador, hosting, software de nómina o correo) bajo contrato escrito. Cuando estos proveedores operen servidores fuera de Chile, la transferencia se respalda en país con nivel adecuado de protección o cláusulas contractuales y garantías equivalentes conforme a los artículos 27 y 28 de la ley.</p>' +
                    '<p><strong>5. MEDIDAS DE SEGURIDAD Y CONSERVACIÓN.</strong> Aplicamos control de accesos, contraseñas robustas, respaldos y resguardo proporcional al riesgo (art. 14 quinquies). Conservamos antecedentes comerciales y tributarios hasta 6 años conforme al Código Tributario, antecedentes laborales al menos 2 años desde el término de los servicios (art. 510 Código del Trabajo), y consultas comerciales por un plazo definido no indefinido.</p>' +
                    '<p><strong>6. DERECHOS ARCOPS, BLOQUEO Y RECLAMO ANTE LA AGENCIA (ARTS. 4 A 11).</strong> Todo titular puede ejercer gratuitamente sus derechos de Acceso, Rectificación, Supresión, Oposición, Portabilidad (en tratamientos automatizados basados en consentimiento, art. 9) y Bloqueo temporal (art. 8 ter) escribiendo a <strong>' + esc(d.correoPrivacidad) + '</strong>. ' + esc(d.razonSocial) + ' acusará recibo y responderá dentro de <strong>30 días corridos</strong> (prorrogables una vez por otros 30 días). Si la solicitud es rechazada o no se responde en plazo, el titular puede reclamar ante la Agencia de Protección de Datos Personales dentro de <strong>30 días hábiles</strong>.</p>' +
                    '<p><em>Última actualización: ' + esc(d.fecha) + '.</em></p>' + footerNota();
            }
        },
        {
            id: 'clausula_dpa',
            num: 'DOC 3',
            archivo: '3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx',
            titulo: 'Anexo DPA Proveedores / Encargados',
            etiqueta: 'Para firmar con contador, software de nómina o nube (Art. 15 bis)',
            build: function (d) {
                return headerDoc('ANEXO DE TRATAMIENTO DE DATOS PERSONALES (DPA)', 'Entre Responsable y Encargado del Tratamiento · Art. 15 bis Ley N° 19.628 reformada por Ley N° 21.719') +
                    '<p>En <strong>' + esc(d.ciudad) + '</strong>, a <strong>' + esc(d.fecha) + '</strong>, entre <strong>' + esc(d.razonSocial) + '</strong> (RUT <strong>' + esc(d.rutEmpresa) + '</strong>), representada por ' + esc(d.representante) + ', en adelante el «Responsable», y <strong>' + esc(d.proveedorNombre) + '</strong> (RUT <strong>' + esc(d.proveedorRut) + '</strong>), en adelante el «Encargado», se conviene el presente Anexo de Tratamiento de Datos Personales:</p>' +
                    '<p><strong>1. OBJETO, DURACIÓN, FINALIDAD, DATOS Y TITULARES (ART. 15 BIS).</strong> El Encargado tratará datos personales por cuenta exclusiva del Responsable únicamente para la finalidad de prestar el servicio de <strong>' + esc(d.proveedorServicio) + '</strong>, durante toda la vigencia del contrato principal y hasta el término de la devolución o supresión de copias. El tratamiento comprende datos identificatorios, laborales, previsionales, de contacto o tributarios correspondientes a las categorías de titulares: <strong>' + esc(d.proveedorTitulares) + '</strong>.</p>' +
                    '<p><strong>2. OBLIGACIONES Y DERECHOS DE LAS PARTES.</strong> (a) Tratar los datos solo conforme a las instrucciones documentadas del Responsable y sin fines propios; (b) garantizar confidencialidad vinculante de su personal; (c) aplicar medidas técnicas y organizativas proporcionales al riesgo (control de accesos, cifrado, respaldos, art. 14 quinquies); (d) prohibición de subdelegar el tratamiento en subencargados sin autorización previa y por escrito del Responsable, exigiendo a todo subencargado autorizado idénticas obligaciones; (e) sujetar cualquier alojamiento o transferencia fuera de Chile a las garantías de los arts. 27 y 28; y (f) asistir al Responsable para responder solicitudes ARCOPS y bloqueo en el plazo legal de 30 días corridos.</p>' +
                    '<p><strong>3. NOTIFICACIÓN DE BRECHAS SIN DILACIONES INDEBIDAS (ART. 14 SEXIES).</strong> Si el Encargado detecta una vulneración de seguridad que comprometa datos del Responsable, deberá informarlo sin dilaciones indebidas (y operativamente dentro de 24 horas) al correo <strong>' + esc(d.correoPrivacidad) + '</strong>, entregando naturaleza, categorías de datos, número aproximado de titulares y medidas adoptadas para permitir al Responsable cumplir oportunamente el art. 14 sexies ante la Agencia y los titulares.</p>' +
                    '<p><strong>4. TÉRMINO DEL SERVICIO.</strong> Concluido el contrato, el Encargado devolverá al Responsable o suprimirá de forma segura e irrecuperable las bases de datos y copias existentes dentro de 30 días, salvo deber legal de conservación.</p>' +
                    '<table style="width:100%;margin-top:26pt;border-collapse:collapse;"><tr>' +
                    '<td style="width:50%;text-align:center;vertical-align:top;padding:12pt;">____________________________<br><strong>' + esc(d.razonSocial) + '</strong><br>RUT ' + esc(d.rutEmpresa) + '<br>Responsable del Tratamiento</td>' +
                    '<td style="width:50%;text-align:center;vertical-align:top;padding:12pt;">____________________________<br><strong>' + esc(d.proveedorNombre) + '</strong><br>RUT ' + esc(d.proveedorRut) + '<br>Encargado del Tratamiento</td>' +
                    '</tr></table>' + footerNota();
            }
        },
        {
            id: 'protocolo_brechas',
            num: 'DOC 5',
            archivo: '5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx',
            titulo: 'Protocolo de Brechas de Seguridad (Art. 14 sexies)',
            etiqueta: 'Procedimiento interno y reporte sin dilaciones indebidas ante la APDP',
            build: function (d) {
                return headerDoc('PROTOCOLO DE GESTIÓN Y NOTIFICACIÓN DE BRECHAS DE SEGURIDAD', d.razonSocial + ' · RUT ' + d.rutEmpresa + ' · Art. 14 sexies Ley N° 19.628 reformada') +
                    '<p><strong>1. REGLA LEGAL Y OBJETIVO.</strong> Establecer la respuesta inmediata de <strong>' + esc(d.razonSocial) + '</strong> ante cualquier destrucción, filtración, pérdida o alteración accidental o ilícita de datos personales. Conforme al <strong>artículo 14 sexies</strong>, cuando exista un riesgo razonable para los derechos y libertades de los titulares, se debe reportar a la Agencia de Protección de Datos Personales <strong>sin dilaciones indebidas</strong> (la ley chilena no fija un plazo cerrado de 72 horas; este protocolo usa 72 horas únicamente como meta operativa interna máxima).</p>' +
                    '<p><strong>2. RESPONSABLE DE COORDINACIÓN INTERNA.</strong> Todo incidente debe escalarse de inmediato a <strong>' + esc(d.responsableInterno) + '</strong> al correo <strong>' + esc(d.correoPrivacidad) + '</strong>.</p>' +
                    '<p><strong>3. FASES OPERATIVAS Y REGISTRO OBLIGATORIO:</strong><br>' +
                    '• <strong>Fase 1 · Contención inmediata:</strong> aislar equipo o cuenta comprometida, revocar sesiones y rotar contraseñas.<br>' +
                    '• <strong>Fase 2 · Evaluación legal:</strong> determinar naturaleza del incidente, efectos probables, categorías de datos y número aproximado de titulares afectados.<br>' +
                    '• <strong>Fase 3 · Reporte a la Agencia sin dilaciones indebidas:</strong> remitir los antecedentes si existe riesgo razonable para los derechos de las personas.<br>' +
                    '• <strong>Fase 4 · Notificación a titulares afectados:</strong> obligatoria en lenguaje claro cuando involucre datos sensibles, de niños o niñas menores de 14 años o datos financieros/bancarios/comerciales, dejando registro en la bitácora.</p>' +
                    '<table style="width:100%;border-collapse:collapse;margin-top:12pt;font-size:9.5pt;">' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;background:#EEF6F3;font-weight:700;" colspan="2">ANEXO: REGISTRO Y FICHA DE REPORTE DE BRECHA (ART. 14 SEXIES)</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;width:36%;"><strong>Responsable</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">' + esc(d.razonSocial) + ' · RUT ' + esc(d.rutEmpresa) + '</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Contacto oficial</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">' + esc(d.responsableInterno) + ' · ' + esc(d.correoPrivacidad) + '</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Fecha/Hora y naturaleza</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">[Indicar fecha, hora y qué ocurrió]</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Categorías y N° de afectados</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">[Ej. 15 clientes · datos de contacto o salud]</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Efectos y medidas adoptadas</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">[Describir consecuencias probables, contención y aviso a titulares]</td></tr>' +
                    '</table>' + footerNota();
            }
        },
        {
            id: 'formulario_arcop',
            num: 'DOC 6',
            archivo: '6_Formulario_Solicitud_Derechos_ARCOP.docx',
            titulo: 'Formulario Estándar Derechos ARCOPS y Bloqueo',
            etiqueta: 'Canal formal para clientes y trabajadores (plazo legal 30 días corridos)',
            build: function (d) {
                return headerDoc('FORMULARIO DE SOLICITUD DE DERECHOS ARCOPS Y BLOQUEO', d.razonSocial + ' · RUT ' + d.rutEmpresa + ' · Canal: ' + d.correoPrivacidad) +
                    '<p>El presente formulario permite a cualquier titular de datos (cliente, trabajador, ex-trabajador o proveedor) solicitar formalmente ante <strong>' + esc(d.razonSocial) + '</strong> (RUT <strong>' + esc(d.rutEmpresa) + '</strong>), al correo <strong>' + esc(d.correoPrivacidad) + '</strong> o en ' + esc(d.direccion) + ', el ejercicio gratuito de los derechos reconocidos en los artículos 4 a 11 de la Ley N° 19.628 modificada por la Ley N° 21.719.</p>' +
                    '<p><strong>1. DATOS DEL TITULAR SOLICITANTE</strong><br>Nombre completo: _____________________________________________________________<br>RUT / Documento: _________________________________________ Teléfono: ___________________<br>Correo de notificación: __________________________________________________________<br>Relación con la empresa: [ ] Cliente &nbsp; [ ] Trabajador &nbsp; [ ] Ex-trabajador &nbsp; [ ] Proveedor</p>' +
                    '<p><strong>2. DERECHO QUE SOLICITA EJERCER</strong><br>' +
                    '[ ] ACCESO (conocer sus datos y copia) &nbsp;&nbsp; [ ] RECTIFICACIÓN (corregir datos inexactos)<br>' +
                    '[ ] SUPRESIÓN (eliminar datos sin base legal) &nbsp;&nbsp; [ ] OPOSICIÓN (no recibir publicidad / fines)<br>' +
                    '[ ] PORTABILIDAD (tratamiento automatizado basado en consentimiento, art. 9) &nbsp;&nbsp; [ ] BLOQUEO (suspensión temporal, art. 8 ter)</p>' +
                    '<p><strong>3. DETALLE DE LA SOLICITUD:</strong><br>__________________________________________________________________________________<br>__________________________________________________________________________________</p>' +
                    '<p><strong>PLAZO LEGAL Y RECLAMO (ART. 11 LEY N° 19.628):</strong> ' + esc(d.razonSocial) + ' acusará recibo y responderá dentro de <strong>treinta (30) días corridos</strong> desde la recepción (prorrogable por una sola vez hasta por otros 30 días corridos). Si la solicitud fuere denegada o no recibiere respuesta dentro de plazo, el titular podrá reclamar ante la Agencia de Protección de Datos Personales dentro de <strong>treinta (30) días hábiles</strong>.</p>' +
                    '<p style="margin-top:18pt;">Firma del Titular: ______________________________ &nbsp;&nbsp; Fecha: ____ / ____ / 202__</p>' + footerNota();
            }
        },
        {
            id: 'autodiagnostico_dpo',
            num: 'DOC 7',
            archivo: '7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx',
            titulo: 'Evaluación y Designación Interna (DPO)',
            etiqueta: 'Constancia de evaluación de Delegado de Protección de Datos',
            build: function (d) {
                var decision = d.adoptaModeloPrev
                    ? 'La empresa decide adoptar un Modelo de Prevención de Infracciones voluntario y designa como Delegado/Responsable de Protección de Datos a <strong>' + esc(d.responsableInterno) + '</strong> (' + esc(d.correoPrivacidad) + ').'
                    : 'La empresa deja constancia de que su designación formal de DPO es voluntaria conforme a la Ley N° 21.719 y designa como <strong>Responsable Interno de Coordinación de Privacidad</strong> a <strong>' + esc(d.responsableInterno) + '</strong> (' + esc(d.correoPrivacidad) + ').';
                return headerDoc('EVALUACIÓN Y CONSTANCIA SOBRE DELEGADO DE PROTECCIÓN DE DATOS (DPO)', d.razonSocial + ' · RUT ' + d.rutEmpresa + ' · Fecha: ' + d.fecha) +
                    '<p><strong>1. MARCO LEGAL.</strong> La Ley N° 21.719 contempla la figura del Delegado de Protección de Datos (DPO) como parte del modelo de prevención de infracciones voluntario para empresas privadas.</p>' +
                    '<table style="width:100%;border-collapse:collapse;margin:10pt 0;font-size:9.5pt;">' +
                    '<tr style="background:#00382E;color:#FFFFFF;"><th style="padding:6pt;text-align:left;border:1px solid #CBD5E1;">Criterio evaluado</th><th style="padding:6pt;width:16%;border:1px solid #CBD5E1;">Estado</th></tr>' +
                    '<tr><td style="padding:6pt;border:1px solid #CBD5E1;">¿Adoptará un modelo formal voluntario de prevención de infracciones?</td><td style="padding:6pt;text-align:center;border:1px solid #CBD5E1;">' + (d.adoptaModeloPrev ? 'SÍ' : 'NO') + '</td></tr>' +
                    '<tr><td style="padding:6pt;border:1px solid #CBD5E1;">¿Realiza tratamiento habitual de datos sensibles (salud/biometría) o de menores a gran escala?</td><td style="padding:6pt;text-align:center;border:1px solid #CBD5E1;">' + (d.usaBiometria ? 'Revisar escala' : 'No a gran escala') + '</td></tr>' +
                    '<tr><td style="padding:6pt;border:1px solid #CBD5E1;">Canal único habilitado para titulares ARCOP y Agencia</td><td style="padding:6pt;text-align:center;border:1px solid #CBD5E1;">' + esc(d.correoPrivacidad) + '</td></tr>' +
                    '</table>' +
                    '<p><strong>2. DECISIÓN DOCUMENTADA DE LA EMPRESA.</strong> ' + decision + '</p>' +
                    '<p style="margin-top:24pt;">____________________________<br><strong>' + esc(d.representante) + '</strong><br>RUT ' + esc(d.rutRepresentante) + '<br>Representante Legal · ' + esc(d.razonSocial) + ' · ' + esc(d.fecha) + '</p>' + footerNota();
            }
        }
    ];

    function buildDocHtml(docId, formValues) {
        var d = normData(formValues);
        var doc = DOCUMENTOS.filter(function (x) { return x.id === docId; })[0];
        if (!doc) return null;
        return { doc: doc, data: d, html: doc.build(d) };
    }

    function descargarArchivo(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 120);
    }

    function exportarUno(docId, formValues) {
        if (!root.FiniquitoDocx || !root.FiniquitoDocx.toBlob) return;
        var res = buildDocHtml(docId, formValues);
        if (!res) return;
        var blob = root.FiniquitoDocx.toBlob(res.html, res.doc.titulo + ' · ' + res.data.razonSocial, res.doc.archivo);
        descargarArchivo(blob, res.doc.archivo);
    }

    function exportarTodosZip(formValues) {
        if (!root.FiniquitoDocx || !root.FiniquitoDocx.toBlob) return Promise.reject(new Error('Falta FiniquitoDocx'));
        var d = normData(formValues);
        return Promise.all(DOCUMENTOS.map(function (doc) {
            var html = doc.build(d);
            var blob = root.FiniquitoDocx.toBlob(html, doc.titulo + ' · ' + d.razonSocial, doc.archivo);
            return blob.arrayBuffer().then(function (ab) {
                return { name: doc.archivo, data: new Uint8Array(ab) };
            });
        })).then(function (entries) {
            var zipBlob = buildZip(entries);
            descargarArchivo(zipBlob, 'Kit_Ley_21719_Word_Personalizados_' + slugRut(d.rutEmpresa) + '.zip');
        });
    }

    root.CLKitDatosPersonalizador = {
        DOCUMENTOS: DOCUMENTOS,
        normData: normData,
        buildDocHtml: buildDocHtml,
        exportarUno: exportarUno,
        exportarTodosZip: exportarTodosZip,
        buildZip: buildZip
    };
})(typeof window !== 'undefined' ? window : globalThis);
