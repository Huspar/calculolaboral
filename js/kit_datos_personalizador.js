/* Personalizador Web del Kit Ley 21.719 (client-side, zero datos enviados al servidor) */
(function (root) {
    'use strict';

    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fechaHoyLarga() {
        var d = new Date();
        return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    function or(val, fallback) {
        var s = String(val == null ? '' : val).trim();
        return s || fallback;
    }

    function slugRut(rut) {
        return String(rut || 'empresa').replace(/[^0-9kK]/g, '').toUpperCase() || 'empresa';
    }

    // Mini empaquetador ZIP (Store sin compresión) para juntar los 6 .docx personalizados en un solo .zip
    var CRC_TAB = (function () {
        var t = new Uint32Array(256);
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(u8) {
        var c = 0xffffffff;
        for (var i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function buildZip(entries) {
        var enc = new TextEncoder();
        var locals = [], centrals = [], offset = 0;
        for (var i = 0; i < entries.length; i++) {
            var nameBytes = enc.encode(entries[i].name);
            var data = entries[i].data;
            var crc = crc32(data);
            var lfh = new Uint8Array(30 + nameBytes.length);
            var lv = new DataView(lfh.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true);
            lv.setUint32(22, data.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lfh.set(nameBytes, 30);
            locals.push(lfh, data);

            var cdh = new Uint8Array(46 + nameBytes.length);
            var cv = new DataView(cdh.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, data.length, true);
            cv.setUint32(24, data.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint32(42, offset, true);
            cdh.set(nameBytes, 46);
            centrals.push(cdh);
            offset += lfh.length + data.length;
        }
        var cSize = centrals.reduce(function (a, b) { return a + b.length; }, 0);
        var eocd = new Uint8Array(22);
        var ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(8, entries.length, true);
        ev.setUint16(10, entries.length, true);
        ev.setUint32(12, cSize, true);
        ev.setUint32(16, offset, true);
        return new Blob(locals.concat(centrals, [eocd]), { type: 'application/zip' });
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
            etiqueta: 'Para firmar con cada trabajador (Art. 154 ter CT y Res. 38 DT)',
            build: function (d) {
                var biom = d.usaBiometria
                    ? '<p><strong>CLÁUSULA CUARTA: SISTEMA DE CONTROL DE ASISTENCIA Y OPCIÓN BIOMÉTRICA (RES. EXENTA N° 38/2024 DT).</strong> En cumplimiento de la Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo, el Trabajador toma conocimiento de que la empresa dispone de un sistema automatizado de control de asistencia. En caso de utilizar tecnología biométrica (huella o rostro), los datos capturados se almacenan únicamente como patrones matemáticos encriptados y no como imágenes reconstruibles. El Empleador garantiza expresamente al Trabajador el derecho a optar por un método de marcaje alternativo no biométrico (tarjeta magnética, clave/PIN o aplicación), sin que su negativa pueda constituir falta laboral, represalia o causal de despido.</p>'
                    : '<p><strong>CLÁUSULA CUARTA: CONTROL DE ASISTENCIA.</strong> El Trabajador toma conocimiento de que el registro de jornada se efectúa mediante método no biométrico autorizado conforme a la Resolución Exenta N° 38/2024 de la Dirección del Trabajo, utilizándose dichos registros exclusivamente para el control de jornada y cálculo de remuneraciones.</p>';
                var herr = d.usaHerramientas
                    ? '<p><strong>CLÁUSULA QUINTA: HERRAMIENTAS CORPORATIVAS Y POLÍTICA DE DISPOSITIVOS.</strong> Los correos electrónicos corporativos, computadores, teléfonos y cuentas asignadas por <strong>' + esc(d.razonSocial) + '</strong> son herramientas de trabajo de propiedad exclusiva de la empresa. El Empleador podrá implementar medidas de ciberseguridad proporcionales, respetando en todo momento el derecho a la intimidad y honra del Trabajador, quedando vedada la inspección intrusiva de comunicaciones estrictamente personales.</p>'
                    : '';
                return headerDoc('ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO · PROTECCIÓN DE DATOS PERSONALES', 'Ley N° 19.628 modificada por Ley N° 21.719 · Art. 154 ter del Código del Trabajo · Res. Exenta N° 38/2024 DT') +
                    '<p>En <strong>' + esc(d.ciudad) + '</strong>, a <strong>' + esc(d.fecha) + '</strong>, entre:</p>' +
                    '<p>1. <strong>' + esc(d.razonSocial) + '</strong>, RUT N° <strong>' + esc(d.rutEmpresa) + '</strong>, domiciliada en ' + esc(d.direccion) + ', representada legalmente por don/doña ' + esc(d.representante) + ' (RUT ' + esc(d.rutRepresentante) + '), en adelante el «Empleador» o «Responsable del Tratamiento»; y</p>' +
                    '<p>2. Don/Doña <strong>' + esc(d.trabajadorNombre) + '</strong>, cédula nacional de identidad N° <strong>' + esc(d.trabajadorRut) + '</strong>, en adelante el «Trabajador» o «Titular de los Datos»;</p>' +
                    '<p>Se ha convenido y suscrito el siguiente ANEXO AL CONTRATO DE TRABAJO:</p>' +
                    '<p><strong>CLÁUSULA PRIMERA: ANTECEDENTES Y MARCO NORMATIVO.</strong> Las partes declaran que la Ley N° 21.719 modifica la Ley N° 19.628 sobre protección y tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales, y que conforme al artículo 154 ter del Código del Trabajo el Empleador debe mantener reserva de toda la información y datos privados del Trabajador a que tenga acceso con ocasión de la relación laboral.</p>' +
                    '<p><strong>CLÁUSULA SEGUNDA: CATEGORÍAS DE DATOS Y FINALIDAD.</strong> El Trabajador toma conocimiento y autoriza al Empleador a tratar exclusivamente los datos personales estrictamente necesarios para: (a) gestión laboral (liquidaciones, transferencias bancarias, retenciones judiciales, pago de cotizaciones en Previred y finiquitos); (b) reportes legales obligatorios al SII, Dirección del Trabajo (portal Mi DT), AFP, Isapre o Fonasa; y (c) prevención de riesgos y seguridad ocupacional conforme a la Ley N° 16.744.</p>' +
                    '<p><strong>CLÁUSULA TERCERA: DATOS SENSIBLES DE SALUD (LICENCIAS MÉDICAS).</strong> Las licencias médicas, diagnósticos y exámenes ocupacionales son datos sensibles de especial protección. El Empleador limita su acceso exclusivamente al personal encargado de su tramitación ante COMPIN, Isapre o mutualidad, prohibiendo su divulgación a jefaturas directas o terceros ajenos a dicha tramitación.</p>' +
                    biom + herr +
                    '<p><strong>CLÁUSULA SEXTA: ENCARGADOS DE TRATAMIENTO (PROVEEDORES EXTERNOS).</strong> El Trabajador es informado de que el Empleador puede contratar proveedores externos (contador externo, software de nómina o servicios en la nube) en calidad de Encargados de Tratamiento bajo contrato vinculante con iguales deberes de reserva y seguridad.</p>' +
                    '<p><strong>CLÁUSULA SÉPTIMA: EJERCICIO DE DERECHOS ARCOP.</strong> El Trabajador podrá ejercer en cualquier momento sus derechos de Acceso, Rectificación, Cancelación, Oposición, Portabilidad y Bloqueo escribiendo al correo <strong>' + esc(d.correoPrivacidad) + '</strong>. La empresa acusará recibo y responderá dentro del plazo legal de treinta (30) días corridos contado desde su recepción, prorrogable por una sola vez hasta por otros treinta días corridos conforme al artículo 11 de la Ley N° 19.628.</p>' +
                    '<p><strong>CLÁUSULA OCTAVA: PLAZO DE CONSERVACIÓN.</strong> Terminada la relación laboral, los datos se conservarán durante los plazos legales de prescripción laboral y tributaria (hasta 5 años tras el término y 6 años para respaldo contable/tributario según Art. 200 del Código Tributario), tras lo cual se procederá a su bloqueo y posterior eliminación o anonimización segura.</p>' +
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
            etiqueta: 'Para publicar en sitio web y entregar a clientes',
            build: function (d) {
                return headerDoc('POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES', d.razonSocial + ' · RUT ' + d.rutEmpresa) +
                    '<p><strong>1. IDENTIFICACIÓN DEL RESPONSABLE DEL TRATAMIENTO.</strong> El responsable del tratamiento de los datos personales recopilados a través del sitio web <strong>' + esc(d.sitioWeb) + '</strong>, canales de venta presencial, WhatsApp corporativo y formularios digitales es <strong>' + esc(d.razonSocial) + '</strong>, RUT N° <strong>' + esc(d.rutEmpresa) + '</strong>, domiciliada en ' + esc(d.direccion) + ', correo electrónico de privacidad: <strong>' + esc(d.correoPrivacidad) + '</strong>.</p>' +
                    '<p><strong>2. PRINCIPIOS DE TRATAMIENTO (LEY N° 19.628 MODIFICADA POR LEY N° 21.719).</strong> La empresa trata los datos conforme a los principios de licitud y lealtad, finalidad específica, proporcionalidad y minimización, calidad y exactitud, seguridad y confidencialidad.</p>' +
                    '<p><strong>3. DATOS QUE RECOPILAMOS Y FINALIDADES.</strong> Recopilamos datos identificatorios y de facturación (nombre, RUT, correo, teléfono y dirección de despacho) para procesar ventas, emitir documentos tributarios ante el SII y coordinar despachos; datos de atención al cliente para responder cotizaciones o soporte; y cookies técnicas o analíticas necesarias para el funcionamiento del sitio.</p>' +
                    '<p><strong>4. BASES DE LICITUD.</strong> El tratamiento se funda en la ejecución de relaciones contractuales o precontractuales con el cliente, el cumplimiento de obligaciones legales y tributarias (Código Tributario y Ley N° 19.496), y el consentimiento previo, expreso e informado cuando corresponda (revocable en todo momento).</p>' +
                    '<p><strong>5. ENCARGADOS DE TRATAMIENTO.</strong> ' + esc(d.razonSocial) + ' no vende ni arrienda bases de datos personales a terceros. Solo comparte datos estrictamente necesarios con proveedores tecnológicos (pasarelas de pago, hosting, correo y despacho) que operan bajo deberes contractuales de confidencialidad y seguridad.</p>' +
                    '<p><strong>6. DERECHOS ARCOP Y CANAL DE ATENCIÓN.</strong> Todo titular puede ejercer sus derechos de Acceso, Rectificación, Supresión (Cancelación), Oposición, Portabilidad y Bloqueo escribiendo a <strong>' + esc(d.correoPrivacidad) + '</strong>. ' + esc(d.razonSocial) + ' acusará recibo y responderá dentro del plazo legal de treinta (30) días corridos contado desde su recepción, prorrogable por una sola vez hasta por otros treinta días (Art. 11 Ley N° 19.628).</p>' +
                    '<p><strong>7. PLAZOS DE CONSERVACIÓN Y AGENCIA.</strong> Los antecedentes comerciales y tributarios se resguardan durante la relación comercial y el plazo legal de prescripción tributaria (6 años conforme al Código Tributario). Si el titular estima que su solicitud no ha sido atendida oportunamente, puede recurrir ante la Agencia de Protección de Datos Personales de Chile.</p>' +
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
                    '<p><strong>1. OBJETO Y ALCANCE (ART. 15 BIS).</strong> El Encargado tratará datos personales por cuenta exclusiva del Responsable para prestar el servicio de <strong>' + esc(d.proveedorServicio) + '</strong> respecto de datos de <strong>' + esc(d.proveedorTitulares) + '</strong> durante la vigencia del contrato principal.</p>' +
                    '<p><strong>2. OBLIGACIONES DEL ENCARGADO.</strong> (a) Tratar los datos solo conforme a las instrucciones documentadas del Responsable; (b) asegurar deber de confidencialidad de todo su personal; (c) implementar medidas técnicas y organizativas proporcionales al riesgo (control de accesos, cifrado, respaldos); (d) no subcontratar sub-encargados sin autorización escrita del Responsable; y (e) asistir al Responsable para responder solicitudes ARCOP dentro del plazo legal de treinta (30) días corridos.</p>' +
                    '<p><strong>3. NOTIFICACIÓN DE BRECHAS (META 72 HORAS).</strong> Si el Encargado detecta una vulneración o filtración que comprometa datos del Responsable, deberá informarlo dentro de las <strong>24 horas</strong> siguientes al correo <strong>' + esc(d.correoPrivacidad) + '</strong>, facilitando el cumplimiento del Art. 14 sexies de la ley (estándar operativo interno de 72 horas ante la Agencia).</p>' +
                    '<p><strong>4. TÉRMINO DEL SERVICIO.</strong> Concluido el contrato, el Encargado deberá devolver o destruir de forma segura e irrecuperable las bases de datos y copias existentes dentro de 30 días, salvo conservación exigida por ley.</p>' +
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
            titulo: 'Protocolo de Brechas de Seguridad 72h',
            etiqueta: 'Procedimiento interno + anexo de reporte a la APDP (Art. 14 sexies)',
            build: function (d) {
                return headerDoc('PROTOCOLO OPERATIVO DE GESTIÓN Y NOTIFICACIÓN DE BRECHAS DE SEGURIDAD', d.razonSocial + ' · RUT ' + d.rutEmpresa + ' · Art. 14 sexies Ley N° 19.628 reformada') +
                    '<p><strong>1. OBJETIVO.</strong> Establecer la respuesta inmediata de <strong>' + esc(d.razonSocial) + '</strong> ante cualquier filtración, robo de equipos, acceso ilícito o envío erróneo que afecte datos personales, coordinando la evaluación y eventual notificación a la Agencia de Protección de Datos Personales (APDP) sin dilaciones indebidas (meta operativa de 72 horas desde la detección confirmada).</p>' +
                    '<p><strong>2. RESPONSABLE DE COORDINACIÓN INTERNA.</strong> Toda sospecha o incidente debe escalarse de inmediato a <strong>' + esc(d.responsableInterno) + '</strong> a través de <strong>' + esc(d.correoPrivacidad) + '</strong>.</p>' +
                    '<p><strong>3. FASES OPERATIVAS:</strong><br>' +
                    '• <strong>Fase 1 · Contención (0 a 12 h):</strong> aislar equipo comprometido, revocar sesiones y cambiar contraseñas.<br>' +
                    '• <strong>Fase 2 · Evaluación (12 a 36 h):</strong> identificar si se expusieron datos comunes o sensibles (salud/biometría) y cuántos titulares están afectados.<br>' +
                    '• <strong>Fase 3 · Notificación a APDP (36 a 72 h):</strong> remitir el reporte si la brecha entraña riesgo para derechos de titulares.<br>' +
                    '• <strong>Fase 4 · Comunicación y bitácora (+72 h):</strong> avisar a titulares en casos graves y dejar constancia en la hoja <em>Bitácora Brechas 72h</em> del libro Excel RAT.</p>' +
                    '<table style="width:100%;border-collapse:collapse;margin-top:12pt;font-size:9.5pt;">' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;background:#EEF6F3;font-weight:700;" colspan="2">ANEXO: FICHA DE REPORTE A LA AGENCIA DE PROTECCIÓN DE DATOS (APDP)</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;width:36%;"><strong>Responsable</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">' + esc(d.razonSocial) + ' · RUT ' + esc(d.rutEmpresa) + '</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Contacto oficial</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">' + esc(d.responsableInterno) + ' · ' + esc(d.correoPrivacidad) + '</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Fecha/Hora del incidente</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">[Completar al ocurrir el incidente]</td></tr>' +
                    '<tr><td style="border:1px solid #CBD5E1;padding:6pt;"><strong>Categorías de datos y medidas</strong></td><td style="border:1px solid #CBD5E1;padding:6pt;">[Describir datos expuestos y contención aplicada]</td></tr>' +
                    '</table>' + footerNota();
            }
        },
        {
            id: 'formulario_arcop',
            num: 'DOC 6',
            archivo: '6_Formulario_Solicitud_Derechos_ARCOP.docx',
            titulo: 'Formulario Estándar Derechos ARCOP',
            etiqueta: 'Canal formal para clientes y trabajadores (plazo legal 30 días)',
            build: function (d) {
                return headerDoc('FORMULARIO DE SOLICITUD DE EJERCICIO DE DERECHOS ARCOP', d.razonSocial + ' · RUT ' + d.rutEmpresa + ' · Canal: ' + d.correoPrivacidad) +
                    '<p>El presente formulario permite a cualquier titular de datos (cliente, trabajador, ex-trabajador o proveedor) solicitar formalmente ante <strong>' + esc(d.razonSocial) + '</strong> (RUT <strong>' + esc(d.rutEmpresa) + '</strong>), al correo <strong>' + esc(d.correoPrivacidad) + '</strong> o en ' + esc(d.direccion) + ', el ejercicio de los derechos reconocidos en la Ley N° 19.628 modificada por la Ley N° 21.719.</p>' +
                    '<p><strong>1. DATOS DEL TITULAR SOLICITANTE</strong><br>Nombre completo: _____________________________________________________________<br>RUT / Documento: _________________________________________ Teléfono: ___________________<br>Correo de notificación: __________________________________________________________<br>Relación con la empresa: [ ] Cliente &nbsp; [ ] Trabajador &nbsp; [ ] Ex-trabajador &nbsp; [ ] Proveedor</p>' +
                    '<p><strong>2. DERECHO QUE SOLICITA EJERCER</strong><br>' +
                    '[ ] ACCESO (conocer sus datos y copia) &nbsp;&nbsp; [ ] RECTIFICACIÓN (corregir datos inexactos)<br>' +
                    '[ ] SUPRESIÓN / CANCELACIÓN (eliminar datos) &nbsp;&nbsp; [ ] OPOSICIÓN (no recibir publicidad)<br>' +
                    '[ ] PORTABILIDAD (copia digital estructurada) &nbsp;&nbsp; [ ] BLOQUEO (suspensión temporal)</p>' +
                    '<p><strong>3. DETALLE DE LA SOLICITUD:</strong><br>__________________________________________________________________________________<br>__________________________________________________________________________________</p>' +
                    '<p><strong>PLAZO LEGAL (ART. 11 LEY N° 19.628):</strong> ' + esc(d.razonSocial) + ' acusará recibo y responderá dentro de <strong>treinta (30) días corridos</strong> desde la recepción (prorrogable por una sola vez hasta por otros 30 días en casos justificados).</p>' +
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
})(typeof window !== 'undefined' ? window : this);
