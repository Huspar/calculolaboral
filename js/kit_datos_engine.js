/**
 * Motor de Generación y Descarga del Kit Ley 21.719 (Protección de Datos Personales Chile 2026)
 * Normativa: Ley N° 21.719 (Reforma Ley 19.628), Código del Trabajo (Art. 154 bis y ter),
 * Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo (DT).
 * Producto Digital: $29.990 CLP (Cálculo Laboral Chile - calculolaboral.cl)
 */

(function () {
    'use strict';

    var FLOW_TOKEN = 'o239ec984dd911e87ccd82adfb0db0756abfca63'; // Token Flow oficial Kit Ley 21.719 ($29.990)
    var FLOW_CHECKOUT_URL = 'https://www.flow.cl/btn.php?token=' + FLOW_TOKEN;

    // Helper: Escapar HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper: Formato de Fecha Actual
    function getFechaActualTexto() {
        var d = new Date();
        var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
    }

    // =========================================================================
    // INSTRUMENTO 1: ANEXO LABORAL DE TRATAMIENTO DE DATOS PERSONALES (TRABAJADOR)
    // =========================================================================
    function generarAnexoLaboralHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]';
        var rutEmpresa = datos.rutEmpresa || '[RUT EMPRESA]';
        var trabajador = datos.trabajador || '[NOMBRE COMPLETO DEL TRABAJADOR]';
        var rutTrabajador = datos.rutTrabajador || '[RUT TRABAJADOR]';
        var ciudad = datos.ciudad || 'Santiago';
        var fecha = datos.fecha || getFechaActualTexto();

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 24px; text-transform: uppercase;">
                    ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO<br>
                    AUTORIZACIÓN, TRATAMIENTO Y PROTECCIÓN DE DATOS PERSONALES<br>
                    <span style="font-size: 10pt; font-weight: normal;">(Conforme a la Ley N° 21.719, Arts. 154 bis y ter del Código del Trabajo y Res. Exenta N° 38/2024 de la Dirección del Trabajo)</span>
                </p>

                <p>
                    En <strong>${escapeHtml(ciudad)}</strong>, a <strong>${escapeHtml(fecha)}</strong>, entre:
                </p>
                <p style="margin-left: 20px;">
                    1. <strong>${escapeHtml(empresa)}</strong>, Rol Único Tributario N° <strong>${escapeHtml(rutEmpresa)}</strong>, representada legalmente según consta en el contrato de trabajo principal, en adelante denominada indistintamente el "Empleador" o el "Responsable del Tratamiento"; y
                </p>
                <p style="margin-left: 20px;">
                    2. Don/Doña <strong>${escapeHtml(trabajador)}</strong>, cédula nacional de identidad N° <strong>${escapeHtml(rutTrabajador)}</strong>, en adelante denominado el "Trabajador" o el "Titular de los Datos";
                </p>
                <p>
                    Se ha convenido y suscrito el siguiente <strong>ANEXO AL CONTRATO DE TRABAJO</strong>:
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA PRIMERA: ANTECEDENTES Y MARCO NORMATIVO.
                </p>
                <p>
                    Las partes declaran que con fecha 13 de diciembre de 2024 fue promulgada la Ley N° 21.719 que regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales, y que en conformidad con los artículos 154 bis y 154 ter del Código del Trabajo, el Empleador se encuentra legalmente obligado a custodiar bajo estricta reserva y confidencialidad toda la información privada y sensible del Trabajador devengada con ocasión de la relación laboral.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA SEGUNDA: CATEGORÍAS DE DATOS Y FINALIDAD DEL TRATAMIENTO.
                </p>
                <p>
                    El Trabajador toma conocimiento y autoriza al Empleador a tratar exclusivamente los datos personales estrictamente necesarios para:
                </p>
                <ul style="margin-left: 25px;">
                    <li><strong>Gestión de la Relación Laboral:</strong> Confección y pago de remuneraciones, liquidaciones de sueldo, transferencias bancarias, retenciones judiciales (pensiones de alimentos), pago de cotizaciones previsionales en Previred y gestión de finiquitos ante la Dirección del Trabajo.</li>
                    <li><strong>Cumplimiento Legal y Previsional:</strong> Envío de reportes al Servicio de Impuestos Internos (SII), Dirección del Trabajo (portal Mi DT) y Administradoras de Fondos de Pensiones / Isapre / Fonasa.</li>
                    <li><strong>Prevención de Riesgos y Seguridad Ocupacional:</strong> Control de exámenes de salud laboral conforme a la Ley 16.744 y reglamento interno de orden, higiene y seguridad.</li>
                </ul>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA TERCERA: TRATAMIENTO DE DATOS SENSIBLES DE SALUD (LICENCIAS MÉDICAS).
                </p>
                <p>
                    En virtud del artículo 12 de la Ley N° 21.719 y el artículo 154 bis del Código del Trabajo, los antecedentes relativos al estado de salud del Trabajador, tales como licencias médicas, diagnósticos y exámenes ocupacionales, constituyen <strong>datos sensibles de especial protección</strong>. El Empleador se compromete formalmente a que el acceso a dichos antecedentes quedará estrictamente limitado al personal de Recursos Humanos encargado de la tramitación previsional (COMPIN/Isapre), prohibiéndose expresamente su divulgación a jefaturas directas o a terceros ajenos a la tramitación legal.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA CUARTA: SISTEMA DE CONTROL DE ASISTENCIA Y OPCIÓN BIOMÉTRICA (RES. EXENTA N° 38/2024 DT).
                </p>
                <p>
                    En cumplimiento estricto del dictamen y Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo:
                </p>
                <ul style="margin-left: 25px;">
                    <li>El Trabajador toma conocimiento de que la empresa dispone de un sistema automatizado de control de asistencia. En caso de utilizar tecnología biométrica (huella dactilar o reconocimiento facial), el Empleador declara que los datos capturados se almacenan únicamente como patrones o algoritmos matemáticos encriptados y no como imágenes reconstructibles de la huella o rostro.</li>
                    <li><strong>Garantía de Alternativa No Biométrica:</strong> El Empleador garantiza expresamente al Trabajador el derecho a optar por un método de marcaje alternativo no biométrico (tarjeta magnética, clave/PIN o aplicación), sin que su negativa a utilizar biometría pueda constituir falta laboral, represalia o causal de despido.</li>
                    <li>Los datos de asistencia no serán utilizados para ningún fin distinto al registro de jornada y cálculo de remuneraciones.</li>
                </ul>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA QUINTA: HERRAMIENTAS CORPORATIVAS Y POLÍTICA DE DISPOSITIVOS.
                </p>
                <p>
                    Los correos electrónicos corporativos, computadores, teléfonos y cuentas asignadas por el Empleador son herramientas de trabajo de propiedad exclusiva de la empresa. El Trabajador se compromete a utilizarlas para los fines de sus funciones. El Empleador podrá implementar medidas de ciberseguridad proporcionales (antivirus, filtros de navegación), respetando en todo momento el derecho a la intimidad y la honra del dependiente, quedando vedada la inspección intrusiva de comunicaciones de carácter estrictamente personal.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA SEXTA: ENCARGADOS DE TRATAMIENTO (PROVEEDORES EXTERNOS).
                </p>
                <p>
                    El Trabajador es informado de que el Empleador puede contratar los servicios de proveedores tecnológicos externos debidamente homologados (empresas de software de recursos humanos, contadores auditores o servidores en la nube) en calidad de "Encargados de Tratamiento", quienes actuarán bajo contrato vinculante con iguales deberes de reserva y ciberseguridad.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA SÉPTIMA: EJERCICIO DE DERECHOS ARCOP.
                </p>
                <p>
                    El Trabajador podrá en todo momento ejercer sus derechos de <strong>Acceso, Rectificación, Cancelación, Oposición, Portabilidad y Bloqueo</strong> de sus datos personales, dirigiéndose por escrito al correo institucional: <strong>${escapeHtml(datos.emailContacto || 'privacidad@empresa.cl')}</strong>, el cual será respondido dentro del plazo legal fatal de treinta (30) días corridos contado desde la recepción de la solicitud, de conformidad con lo establecido en el artículo 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719).
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    CLÁUSULA OCTAVA: PLAZO DE CONSERVACIÓN.
                </p>
                <p>
                    Terminada la relación laboral, los datos del Trabajador se conservarán durante la vigencia del contrato y hasta por 5 años posteriores a su término (plazo de prescripción de acciones laborales según los Arts. 480 y 510 del Código del Trabajo), salvo la documentación de respaldo contable, previsional y tributario que se resguardará por 6 años (según el Art. 200 del Código Tributario), tras lo cual se procederá a su bloqueo y posterior eliminación o anonimización segura.
                </p>

                <p style="margin-top: 20px;">
                    Para constancia, se firma el presente anexo en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada una de las partes.
                </p>

                <table style="width: 100%; margin-top: 60px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; text-align: center; vertical-align: top; padding: 0 20px;">
                            <div style="border-top: 1px solid #000; padding-top: 8px;">
                                <strong>${escapeHtml(empresa)}</strong><br>
                                RUT N° ${escapeHtml(rutEmpresa)}<br>
                                <em>EMPLEADOR / RESPONSABLE</em>
                            </div>
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top; padding: 0 20px;">
                            <div style="border-top: 1px solid #000; padding-top: 8px;">
                                <strong>${escapeHtml(trabajador)}</strong><br>
                                C.I. N° ${escapeHtml(rutTrabajador)}<br>
                                <em>TRABAJADOR / TITULAR DE DATOS</em>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    }

    // =========================================================================
    // INSTRUMENTO 2: POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS (CLIENTES & WEB)
    // =========================================================================
    function generarPoliticaPrivacidadHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]';
        var rutEmpresa = datos.rutEmpresa || '[RUT EMPRESA]';
        var web = datos.sitioWeb || 'https://www.empresa.cl';
        var email = datos.emailContacto || 'privacidad@empresa.cl';
        var direccion = datos.direccion || '[DIRECCIÓN COMERCIAL, COMUNA, CIUDAD]';
        var fecha = datos.fecha || getFechaActualTexto();

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 8px; text-transform: uppercase;">
                    POLÍTICA GENERAL DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES
                </p>
                <p style="text-align: center; font-size: 10pt; color: #555; margin-bottom: 24px;">
                    Conforme a la Ley N° 21.719 sobre Protección y Tratamiento de Datos Personales de la República de Chile<br>
                    Última actualización: ${escapeHtml(fecha)}
                </p>

                <p>
                    <strong>1. IDENTIFICACIÓN DEL RESPONSABLE DEL TRATAMIENTO:</strong><br>
                    El responsable del tratamiento de los datos personales recopilados a través del sitio web <strong>${escapeHtml(web)}</strong>, canales de venta presencial, WhatsApp corporativo y formularios digitales es <strong>${escapeHtml(empresa)}</strong>, Rol Único Tributario N° <strong>${escapeHtml(rutEmpresa)}</strong>, domiciliada en <strong>${escapeHtml(direccion)}</strong>, correo electrónico de contacto: <strong>${escapeHtml(email)}</strong> (en adelante, la "Empresa").
                </p>

                <p>
                    <strong>2. PRINCIPIOS DE TRATAMIENTO APLICADOS (ARTÍCULO 4 LEY 21.719):</strong><br>
                    La Empresa trata los datos de conformidad con los principios rectores de:
                    <ul style="margin-left: 20px;">
                        <li><strong>Licitud y Lealtad:</strong> Los datos se tratan solo mediando base legal expresa (consentimiento, contrato o cumplimiento de obligación legal).</li>
                        <li><strong>Finalidad Específica:</strong> Los datos se recopilan únicamente para fines explícitos y determinados.</li>
                        <li><strong>Proporcionalidad y Minimización:</strong> Solo se solicita la información estrictamente necesaria para cumplir con el servicio contratado.</li>
                        <li><strong>Calidad y Exactitud:</strong> Se adoptan medidas razonables para mantener los datos veraces y actualizados.</li>
                        <li><strong>Seguridad y Confidencialidad:</strong> Aplicación de controles técnicos y organizativos para evitar accesos no autorizados, hackeos, pérdidas o alteraciones.</li>
                    </ul>
                </p>

                <p>
                    <strong>3. DATOS QUE RECOPILAMOS Y FINALIDADES:</strong><br>
                    La Empresa podrá recopilar:
                    <ul style="margin-left: 20px;">
                        <li><strong>Datos Identificatorios y de Contacto:</strong> Nombre completo, RUT, correo electrónico, teléfono y dirección de despacho, con la finalidad de procesar compras, emitir facturas/boletas electrónicas según normas del SII y gestionar envíos.</li>
                        <li><strong>Datos de Atención al Cliente:</strong> Consultas formuladas por formularios de contacto o WhatsApp, con la finalidad de brindar soporte técnico y cotizaciones comerciales.</li>
                        <li><strong>Datos de Navegación (Cookies):</strong> Dirección IP, tipo de navegador y páginas visitadas para fines estadísticos y de rendimiento del sitio web.</li>
                    </ul>
                </p>

                <p>
                    <strong>4. BASES DE LICITUD (LEGITIMACIÓN):</strong><br>
                    El tratamiento de datos se fundamenta en:
                    <ul style="margin-left: 20px;">
                        <li>La ejecución de una relación contractual o medidas precontractuales solicitadas por el cliente (Art. 13 letra a Ley 21.719).</li>
                        <li>El cumplimiento de obligaciones tributarias, comerciales y de protección al consumidor (Ley 19.496 y Código Tributario).</li>
                        <li>El consentimiento libre, previo, expreso e informado del usuario para comunicaciones promocionales (revocable en cualquier momento).</li>
                    </ul>
                </p>

                <p>
                    <strong>5. TRANSFERENCIA Y ENCARGADOS DE TRATAMIENTO:</strong><br>
                    La Empresa no comercializa, arrienda ni vende bases de datos personales a terceros bajo ninguna circunstancia. Los datos podrán comunicarse a proveedores tecnológicos de pasarelas de pago (Transbank, Flow, Mercado Pago), empresas de courier logístico y servicios de facturación, quienes operan en calidad de "Encargados de Tratamiento" sujetos a estrictos contratos de confidencialidad.
                </p>

                <p>
                    <strong>6. DERECHOS DE LOS TITULARES (DERECHOS ARCOP):</strong><br>
                    Conforme a los artículos 5° al 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719), todo titular de datos goza de los siguientes derechos inalienables:
                    <ul style="margin-left: 20px;">
                        <li><strong>Acceso:</strong> Solicitar confirmación de qué datos suyos se tratan y obtener copia de ellos.</li>
                        <li><strong>Rectificación:</strong> Modificar datos inexactos, incompletos o desactualizados.</li>
                        <li><strong>Supresión (Cancelación):</strong> Exigir la eliminación de sus datos cuando ya no sean necesarios para la finalidad originaria.</li>
                        <li><strong>Oposición:</strong> Negarse al uso de sus datos para fines comerciales o publicidad directa.</li>
                        <li><strong>Portabilidad:</strong> Recibir sus datos en un formato digital estructurado, común y de lectura mecánica.</li>
                        <li><strong>Bloqueo:</strong> Suspender provisionalmente el tratamiento mientras se resuelve una impugnación de exactitud.</li>
                    </ul>
                    Para ejercer estos derechos, el titular debe enviar su solicitud formal al correo <strong>${escapeHtml(email)}</strong> acreditando fehacientemente su identidad. La Empresa acusará recibo y responderá fundadamente dentro del plazo legal fatal de <strong>treinta (30) días corridos</strong> contado desde su recepción (Artículo 11 Ley N° 19.628).
                </p>

                <p>
                    <strong>7. PLAZOS DE RETENCIÓN DE INFORMACIÓN:</strong><br>
                    Los datos de clientes se conservarán mientras dure la relación comercial y durante el plazo de 6 años establecido por el Código Tributario para fiscalizaciones contables, tras lo cual serán eliminados o anonimizados.
                </p>

                <p>
                    <strong>8. AGENCIA DE PROTECCIÓN DE DATOS PERSONALES:</strong><br>
                    En caso de que el titular considere que sus derechos no han sido satisfechos oportunamente, tiene el derecho de recurrir ante la <strong>Agencia de Protección de Datos Personales</strong> de Chile de conformidad a los procedimientos sancionatorios de la ley.
                </p>
            </div>
        `;
    }

    // =========================================================================
    // INSTRUMENTO 3: CLÁUSULA DPA PARA CONTRATOS CON PROVEEDORES (ENCARGADO)
    // =========================================================================
    function generarClausulaDPAHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE TU EMPRESA]';
        var rutEmpresa = datos.rutEmpresa || '[RUT TU EMPRESA]';
        var proveedor = datos.proveedor || '[NOMBRE DEL PROVEEDOR / CONTADOR / SOFTWARE]';
        var rutProveedor = datos.rutProveedor || '[RUT PROVEEDOR]';
        var fecha = datos.fecha || getFechaActualTexto();

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 24px; text-transform: uppercase;">
                    ANEXO DE TRATAMIENTO DE DATOS PERSONALES (DPA - DATA PROCESSING AGREEMENT)<br>
                    ENTRE RESPONSABLE Y ENCARGADO DEL TRATAMIENTO<br>
                    <span style="font-size: 10pt; font-weight: normal;">(Conforme al Artículo 14 bis y 14 ter de la Ley N° 21.719 de Chile)</span>
                </p>

                <p>
                    El presente Anexo de Tratamiento de Datos Personales se suscribe entre <strong>${escapeHtml(empresa)}</strong> (RUT ${escapeHtml(rutEmpresa)}), en adelante el "Responsable", y <strong>${escapeHtml(proveedor)}</strong> (RUT ${escapeHtml(rutProveedor)}), en adelante el "Encargado", como parte integrante del contrato de prestación de servicios vigente entre las partes.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    1. OBJETO Y ALCANCE DEL TRATAMIENTO.
                </p>
                <p>
                    El Encargado tratará por cuenta del Responsable los datos personales necesarios para la prestación del servicio encomendado (contabilidad, nómina, alojamiento en la nube, soporte o desarrollo de software), comprometiéndose a no utilizarlos para ninguna otra finalidad propia ni de terceros.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    2. OBLIGACIONES LEGALES DEL ENCARGADO (ARTÍCULO 14 BIS).
                </p>
                <p>
                    El Encargado se obliga expresamente a:
                </p>
                <ul style="margin-left: 25px;">
                    <li>Tratar los datos únicamente siguiendo las instrucciones documentadas del Responsable.</li>
                    <li>Garantizar que todo su personal con acceso a los datos esté sujeto a un deber formal de confidencialidad perpetuo.</li>
                    <li>Implementar medidas técnicas y organizativas de seguridad adecuadas para garantizar un nivel de seguridad proporcional al riesgo (cifrado, control de accesos, copias de seguridad).</li>
                    <li>No subcontratar a otro proveedor ("Sub-encargado") sin la autorización previa y escrita del Responsable.</li>
                    <li>Asistir al Responsable en la tramitación y respuesta oportuna de los derechos ARCOP de los titulares dentro del plazo legal fatal de treinta (30) días corridos.</li>
                </ul>

                <p style="font-weight: bold; margin-top: 16px;">
                    3. NOTIFICACIÓN DE INCIDENTES Y BRECHAS (ESTÁNDAR OPERATIVO 72 HORAS).
                </p>
                <p>
                    En caso de que el Encargado sufra un incidente de seguridad, vulneración, filtración, hackeo o pérdida que comprometa los datos personales del Responsable, estará legalmente obligado a notificar al Responsable a más tardar dentro de las <strong>24 horas siguientes</strong> a haber tomado conocimiento del hecho, entregando la descripción del incidente, datos afectados y medidas correctivas inmediatas, a fin de que el Responsable pueda cumplir con la obligación de notificar a la Agencia de Protección de Datos Personales sin dilaciones indebidas (conforme al Art. 14 sexies de la Ley N° 19.628 reformada), adoptando el estándar operativo y mejor práctica internacional recomendada de un plazo máximo de 72 horas.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    4. DESTINO FINAL DE LOS DATOS TRAS EL TÉRMINO DEL SERVICIO.
                </p>
                <p>
                    Finalizada la prestación del servicio principal, el Encargado deberá, a elección del Responsable, devolver íntegramente o destruir de forma segura e irrecuperable todas las bases de datos y copias existentes, emitiendo un certificado formal de destrucción.
                </p>

                <p style="font-weight: bold; margin-top: 16px;">
                    5. RESPONSABILIDAD E INDEMNIDAD.
                </p>
                <p>
                    El incumplimiento de las obligaciones aquí previstas por parte del Encargado hará aplicables las sanciones de la Ley N° 21.719, debiendo el Encargado indemnizar íntegramente al Responsable por cualquier multa cursada por la Agencia de Protección de Datos Personales o reclamos judiciales derivados directamente de su negligencia o dolo.
                </p>

                <table style="width: 100%; margin-top: 50px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; text-align: center; vertical-align: top; padding: 0 20px;">
                            <div style="border-top: 1px solid #000; padding-top: 8px;">
                                <strong>${escapeHtml(empresa)}</strong><br>
                                RUT N° ${escapeHtml(rutEmpresa)}<br>
                                <em>RESPONSABLE DEL TRATAMIENTO</em>
                            </div>
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top; padding: 0 20px;">
                            <div style="border-top: 1px solid #000; padding-top: 8px;">
                                <strong>${escapeHtml(proveedor)}</strong><br>
                                RUT N° ${escapeHtml(rutProveedor)}<br>
                                <em>ENCARGADO DEL TRATAMIENTO</em>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    }

    // =========================================================================
    // INSTRUMENTO 4: REGISTRO DE ACTIVIDADES DE TRATAMIENTO (RAT) OFICIAL (CSV/EXCEL)
    // =========================================================================
    function generarRATCsvContent(datos) {
        var empresa = datos.empresa || 'Mi Empresa SpA';
        var rut = datos.rutEmpresa || '77.123.456-7';

        var rows = [
            ['REGISTRO DE ACTIVIDADES DE TRATAMIENTO DE DATOS PERSONALES (RAT) - LEY N° 21.719 (ART. 14 TER)'],
            ['Empresa Responsable:', empresa, 'RUT:', rut, 'Fecha de Actualización:', getFechaActualTexto()],
            [''],
            [
                'ID',
                'Área / Proceso',
                'Categoría de Datos',
                'Tipo de Titulares',
                'Finalidad Principal',
                'Base Legal (Licitud)',
                '¿Datos Sensibles?',
                'Destinatarios / Encargados',
                'Plazo de Conservación',
                'Medidas de Seguridad Aplicadas'
            ],
            [
                'RAT-01',
                'Recursos Humanos',
                'Nombre, RUT, Sueldos, Cuentas Bancarias, Domicilio',
                'Trabajadores Activos y Ex-trabajadores',
                'Pago de remuneraciones, imposiciones previsionales y gestión contractual',
                'Ejecución de contrato laboral y mandato legal Código del Trabajo',
                'NO',
                'Previred, Banco pagador, Software de Nómina, Dirección del Trabajo',
                'Hasta 5 años tras término relación laboral (Arts. 480 y 510 CT) y 6 años respaldo tributario/previsional (Art. 200 CTrib)',
                'Acceso restringido con clave 2FA, servidor cifrado'
            ],
            [
                'RAT-02',
                'Recursos Humanos',
                'Licencias Médicas, Exámenes Ocupacionales, Diagnósticos',
                'Trabajadores Dependientes',
                'Tramitación de subsidios por incapacidad laboral y seguridad ocupacional',
                'Obligación legal (Ley 16.744, DFL 1)',
                'SÍ (Salud)',
                'COMPIN, Isapres, Mutual de Seguridad. Prohibido acceso a jefaturas',
                '5 años desde emisión',
                'Carpeta digital confidencial con acceso exclusivo a Encargado RRHH'
            ],
            [
                'RAT-03',
                'Operaciones / RRHH',
                'Patrones matemáticos biométricos (huella dactilar / rostro)',
                'Personal afecto a control de asistencia',
                'Registro y control de jornada ordinaria y extraordinaria',
                'Cumplimiento legal Art. 33 Código del Trabajo y Res. Exenta 38/2024 DT',
                'SÍ (Biométrico)',
                'Proveedor del reloj control de asistencia certificado',
                'Durante la vigencia del contrato de trabajo',
                'Plantillas encriptadas sin almacenamiento de imágenes reales. Alternativa no biométrica disponible'
            ],
            [
                'RAT-04',
                'Ventas & Facturación',
                'Nombre, RUT, Dirección de envío, Correo, Teléfono',
                'Clientes Compradores',
                'Emisión de boletas/facturas electrónicas y despacho de pedidos',
                'Ejecución contractual y obligación tributaria SII',
                'NO',
                'Servicio de Impuestos Internos, Pasarela de Pago, Courier de despacho',
                '6 años (Prescripción tributaria SII)',
                'Cifrado SSL/TLS en web, pasarela PCI-DSS compliance'
            ],
            [
                'RAT-05',
                'Marketing & Comercial',
                'Nombre, Correo electrónico, Teléfono móvil',
                'Prospectos y Clientes que consintieron',
                'Envío de newsletter, promociones comerciales y cotizaciones',
                'Consentimiento expreso e informado del titular',
                'NO',
                'Plataforma de Email Marketing / CRM comercial',
                'Hasta que el titular revoque el consentimiento (Derecho de Oposición)',
                'Enlace directo de desuscripción (opt-out) en cada correo enviado'
            ],
            [
                'RAT-06',
                'Seguridad Física',
                'Grabaciones de video en circuito cerrado (CCTV)',
                'Clientes, trabajadores y visitantes',
                'Seguridad de las instalaciones y prevención de delitos',
                'Interés legítimo en seguridad patrimonial y física',
                'NO',
                'Tribunales de Justicia o Ministerio Público (solo ante requerimiento judicial)',
                '30 días continuos (salvo investigación judicial en curso)',
                'Sobreescritura automática cada 30 días, servidor de video bajo llave'
            ]
        ];

        return rows.map(function(row) {
            return row.map(function(cell) {
                var escaped = String(cell).replace(/"/g, '""');
                return '"' + escaped + '"';
            }).join(';');
        }).join('\r\n');
    }

    // =========================================================================
    // INSTRUMENTO 5: PROTOCOLO DE GESTIÓN Y NOTIFICACIÓN DE BRECHAS (72 HORAS)
    // =========================================================================
    function generarProtocoloBrechasHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]';
        var rutEmpresa = datos.rutEmpresa || '[RUT EMPRESA]';
        var fecha = datos.fecha || getFechaActualTexto();

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 24px; text-transform: uppercase;">
                    PROTOCOLO OPERATIVO DE GESTIÓN Y NOTIFICACIÓN DE BRECHAS DE SEGURIDAD<br>
                    <span style="font-size: 10pt; font-weight: normal;">(Conforme al Artículo 14 sexies de la Ley N° 19.628, modificada por Ley N° 21.719 - Notificación sin dilaciones indebidas y Estándar Operativo de 72 Horas)</span>
                </p>

                <p>
                    <strong>1. OBJETIVO:</strong><br>
                    Establecer las directrices de acción inmediata ante cualquier violación de seguridad, filtración, robo, pérdida, acceso no autorizado o alteración de datos personales custodiados por <strong>${escapeHtml(empresa)}</strong> (RUT ${escapeHtml(rutEmpresa)}), garantizando la contención del daño y el cumplimiento de la obligación legal de notificar a la Agencia de Protección de Datos Personales a la mayor brevedad posible y sin dilaciones indebidas (Art. 14 sexies), adoptando como estándar operativo interno y mejor práctica internacional recomendada un plazo máximo de <strong>72 horas</strong> desde la detección del incidente.
                </p>

                <p>
                    <strong>2. CLASIFICACIÓN DE INCIDENTES DE SEGURIDAD:</strong><br>
                    Se considera brecha de seguridad:
                    <ul style="margin-left: 20px;">
                        <li><strong>Acceso Ilícito / Ciberataque:</strong> Infección por Ransomware, phishing exitoso con acceso a bases de datos o cuentas de correo corporativas.</li>
                        <li><strong>Pérdida o Robo de Dispositivos:</strong> Extravío de notebooks, teléfonos móviles o discos duros con información de clientes o nóminas no encriptadas.</li>
                        <li><strong>Error Humano Operativo:</strong> Envío masivo de correos con datos personales sin copia oculta (BCC), o publicación accidental de archivos confidenciales.</li>
                    </ul>
                </p>

                <p>
                    <strong>3. PROTOCOLO DE RESPUESTA EN 4 PASOS:</strong>
                </p>
                <ol style="margin-left: 25px;">
                    <li><strong>FASE 1: Detección y Contención (Horas 0 a 12):</strong>
                        Desconectar inmediatamente de la red los equipos comprometidos, cambiar contraseñas de accesos administrativos, revocar tokens de sesión y aislar el servidor afectado.
                    </li>
                    <li><strong>FASE 2: Evaluación Forense y del Impacto (Horas 12 a 36):</strong>
                        Determinar qué categorías de datos fueron expuestas (datos comunes vs. datos sensibles de salud/biometría) y estimar el número aproximado de titulares afectados.
                    </li>
                    <li><strong>FASE 3: Notificación Formal a la Agencia (Horas 36 a 72):</strong>
                        Si la brecha entraña un riesgo para los derechos de los titulares, remitir el reporte oficial a la Agencia de Protección de Datos Personales sin dilación indebida, estableciendo como meta de cumplimiento operativo interno no superar las 72 horas desde que se tuvo conocimiento confirmado del incidente.
                    </li>
                    <li><strong>FASE 4: Notificación a Titulares y Mitigación (Posterior a 72 Horas):</strong>
                        Si el riesgo es de gravedad, comunicar directamente a los afectados las medidas que deben tomar (ej. cambio de claves bancarias) y registrar el incidente en la Bitácora Histórica del RAT.
                    </li>
                </ol>

                <p style="font-weight: bold; margin-top: 24px; text-transform: uppercase;">
                    ANEXO: MODELO DE FORMULARIO DE REPORTE DE BRECHA A LA AGENCIA (72 HORAS)
                </p>
                <div style="border: 1px solid #333; padding: 16px; background-color: #fdfdfd; margin-top: 10px;">
                    <p style="margin: 4px 0;"><strong>A:</strong> AGENCIA DE PROTECCIÓN DE DATOS PERSONALES DE CHILE (APDP)</p>
                    <p style="margin: 4px 0;"><strong>DE:</strong> ${escapeHtml(empresa)} | RUT: ${escapeHtml(rutEmpresa)}</p>
                    <p style="margin: 4px 0;"><strong>FECHA Y HORA DEL INCIDENTE:</strong> [Indicar fecha y hora exacta del suceso]</p>
                    <p style="margin: 4px 0;"><strong>FECHA Y HORA DE DETECCIÓN:</strong> [Indicar cuándo se tomó conocimiento]</p>
                    <p style="margin: 8px 0;"><strong>1. NATURALEZA DE LA VULNERACIÓN:</strong><br>[ ] Confidencialidad (Divulgación/Acceso no autorizado)<br>[ ] Integridad (Alteración indebida)<br>[ ] Disponibilidad (Pérdida/Destrucción o Ransomware)</p>
                    <p style="margin: 8px 0;"><strong>2. CATEGORÍAS Y NÚMERO APROXIMADO DE AFECTADOS:</strong><br>[Describir si son clientes o trabajadores, y cantidad estimada]</p>
                    <p style="margin: 8px 0;"><strong>3. CONSECUENCIAS Y RIESGOS PREVISIBLES:</strong><br>[Describir eventuales perjuicios económicos o reputacionales]</p>
                    <p style="margin: 8px 0;"><strong>4. MEDIDAS CORRECTIVAS ADOPTADAS O PROPUESTAS:</strong><br>[Detallar parches, desconexión y contención realizada]</p>
                    <p style="margin: 8px 0;"><strong>5. PERSONA DE CONTACTO INSTITUCIONAL:</strong><br>Nombre: [Responsable]<br>Teléfono: [Teléfono]<br>Correo: [Email de contacto]</p>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // BONUS: FORMULARIO DE EJERCICIO DE DERECHOS ARCOP
    // =========================================================================
    function generarFormularioARCOPHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE LA EMPRESA]';
        var rutEmpresa = datos.rutEmpresa || '[RUT EMPRESA]';
        var email = datos.emailContacto || 'privacidad@empresa.cl';

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 24px; text-transform: uppercase;">
                    FORMULARIO OFICIAL DE SOLICITUD DE EJERCICIO DE DERECHOS ARCOP<br>
                    <span style="font-size: 10pt; font-weight: normal;">(Acceso, Rectificación, Supresión, Oposición, Portabilidad y Bloqueo - Ley N° 21.719)</span>
                </p>

                <p>
                    El presente formulario permite a cualquier titular de datos (cliente, trabajador, proveedor o usuario) solicitar ante <strong>${escapeHtml(empresa)}</strong> (RUT ${escapeHtml(rutEmpresa)}) el ejercicio formal de sus derechos reconocidos en los artículos 5° al 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719).
                </p>

                <div style="border: 1px solid #333; padding: 16px; margin-top: 14px;">
                    <p style="font-weight: bold; margin-top: 0;">1. DATOS DEL TITULAR SOLICITANTE:</p>
                    <p style="margin: 4px 0;">Nombre Completo: ___________________________________________________________</p>
                    <p style="margin: 4px 0;">RUT / Documento de Identidad: _________________________________________________</p>
                    <p style="margin: 4px 0;">Correo Electrónico de Notificación: _____________________________________________</p>
                    <p style="margin: 4px 0;">Teléfono de Contacto: _________________________________________________________</p>
                    <p style="margin: 4px 0;">Calidad del Titular: [ ] Cliente [ ] Trabajador [ ] Ex-trabajador [ ] Proveedor [ ] Otro</p>

                    <p style="font-weight: bold; margin-top: 16px;">2. DERECHO QUE SOLICITA EJERCER (Marcar con una X):</p>
                    <p style="margin: 4px 0;">[ ] <strong>ACCESO:</strong> Deseo conocer qué datos personales míos posee la empresa y su tratamiento.</p>
                    <p style="margin: 4px 0;">[ ] <strong>RECTIFICACIÓN:</strong> Solicito corregir o actualizar datos inexactos o incompletos.</p>
                    <p style="margin: 4px 0;">[ ] <strong>SUPRESIÓN / CANCELACIÓN:</strong> Solicito eliminar mis datos por haber expirado la finalidad.</p>
                    <p style="margin: 4px 0;">[ ] <strong>OPOSICIÓN:</strong> Solicito que mis datos no sean utilizados para publicidad ni promociones.</p>
                    <p style="margin: 4px 0;">[ ] <strong>PORTABILIDAD:</strong> Solicito copia de mis datos en formato interoperable (CSV/XML).</p>
                    <p style="margin: 4px 0;">[ ] <strong>BLOQUEO:</strong> Solicito la suspensión cautelar temporal del tratamiento de mis datos.</p>

                    <p style="font-weight: bold; margin-top: 16px;">3. DESCRIPCIÓN DE LA SOLICITUD Y ANTECEDENTES DE RESPALDO:</p>
                    <div style="border: 1px dashed #666; height: 90px; padding: 6px; margin-top: 4px;">
                        [Indique aquí el detalle de los datos a rectificar, eliminar o consultar]
                    </div>

                    <p style="font-size: 9.5pt; color: #444; margin-top: 16px;">
                        <em>Nota Legal: La empresa acusará recibo de esta solicitud y emitirá respuesta formal fundada dentro del plazo legal fatal de treinta (30) días corridos contado desde la recepción íntegra del formulario y la verificación fehaciente de identidad (Artículo 11 de la Ley N° 19.628). Enviar este formulario firmado al correo: <strong>${escapeHtml(email)}</strong>.</em>
                    </p>

                    <div style="margin-top: 40px; text-align: center;">
                        ________________________________________________<br>
                        <strong>Firma del Titular Solicitante</strong><br>
                        RUT N°: _____________________
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // INSTRUMENTO 7: EVALUACIÓN Y TEST DE AUTODIAGNÓSTICO DPO (DELEGADO DE DATOS)
    // =========================================================================
    function generarTestDPOHTML(datos) {
        var empresa = datos.empresa || '[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]';
        var rutEmpresa = datos.rutEmpresa || '[RUT EMPRESA]';
        var fecha = datos.fecha || getFechaActualTexto();

        return `
            <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify;">
                <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 6px; text-transform: uppercase;">
                    EVALUACIÓN Y TEST DE AUTODIAGNÓSTICO LEGAL<br>
                    ¿NECESITA MI EMPRESA NOMBRAR UN DELEGADO DE PROTECCIÓN DE DATOS (DPO)?
                </p>
                <p style="text-align: center; font-size: 10pt; color: #444; margin-bottom: 22px;">
                    Criterios de Obligatoriedad y Régimen de Exención para Micro, Pequeñas y Medianas Empresas (MIPYMES)<br>
                    Conforme a la Ley N° 21.719 que reforma la Ley N° 19.628 de Protección de Datos Personales de Chile
                </p>

                <p style="background-color: #f4f6f8; border-left: 4px solid #0284c7; padding: 10px 14px; margin-bottom: 18px;">
                    <strong>Empresa Evaluada:</strong> ${escapeHtml(empresa)} &nbsp;|&nbsp; <strong>RUT:</strong> ${escapeHtml(rutEmpresa)} &nbsp;|&nbsp; <strong>Fecha de Evaluación:</strong> ${escapeHtml(fecha)}
                </p>

                <p style="font-weight: bold; margin-top: 14px;">
                    1. MARCO LEGAL Y REGLA GENERAL: ¿ES OBLIGATORIO EL DPO PARA LAS PYMES EN CHILE?
                </p>
                <p>
                    <strong>NO, COMO REGLA GENERAL.</strong> La Ley N° 21.719 introduce la figura del Delegado de Protección de Datos (DPO u Oficial de Privacidad) inspirada en el estándar internacional (RGPD Art. 37). Sin embargo, el legislador chileno consagró que para las empresas privadas la designación es <strong>VOLUNTARIA</strong>, salvo que concurra alguna de las causales taxativas de excepción legal que se evalúan a continuación.
                </p>

                <p style="font-weight: bold; margin-top: 18px;">
                    2. TEST DE EVALUACIÓN RÁPIDA DE OBLIGATORIEDAD (4 PREGUNTAS):
                </p>
                <p style="font-size: 10pt; color: #333; margin-bottom: 10px;">
                    Marque con una <strong>X</strong> la opción que corresponda a las operaciones habituales de su empresa:
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5pt;" border="1" cellpadding="8">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="width: 75%; text-align: left; padding: 8px;">Criterio de Evaluación Legal</th>
                            <th style="width: 12%; text-align: center; padding: 8px;">SÍ</th>
                            <th style="width: 13%; text-align: center; padding: 8px;">NO</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <strong>1. Entidad Pública o Estatal:</strong><br>
                                ¿Es su empresa un organismo de la Administración del Estado, servicio público, municipio o empresa pública estatal?
                            </td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                        </tr>
                        <tr>
                            <td>
                                <strong>2. Observación Masiva y Sistemática de Personas:</strong><br>
                                ¿La actividad principal y medular de la empresa radica en operaciones que requieren un seguimiento, rastreo geográfico masivo, scoring predictivo financiero continuado o perfilamiento sistemático a gran escala de miles de ciudadanos (ej. telecomunicaciones masivas, aseguradoras de alcance nacional o burós crediticios)?
                            </td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                        </tr>
                        <tr>
                            <td>
                                <strong>3. Tratamiento a Gran Escala de Datos Sensibles:</strong><br>
                                ¿El giro principal de la empresa consiste en el tratamiento a gran escala de datos relativos a salud médica, genética o antecedentes penales (ej. laboratorios clínicos, hospitales privados, clínicas masivas)?<br>
                                <em style="font-size: 9pt; color: #555;">*Nota Legal DT: El almacenamiento interno de licencias médicas de su propia nómina de trabajadores o la huella del reloj control NO califica como tratamiento masivo a gran escala.</em>
                            </td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                        </tr>
                        <tr>
                            <td>
                                <strong>4. Regulación Financiera Sectorial Expresa:</strong><br>
                                ¿Se encuentra la empresa sujeta a una instrucción vinculante de la Comisión para el Mercado Financiero (CMF) o Superintendencia que le exija expresamente nombrar un oficial de cumplimiento de datos?
                            </td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                            <td style="text-align: center; vertical-align: middle;">[ &nbsp; ]</td>
                        </tr>
                    </tbody>
                </table>

                <p style="font-weight: bold; margin-top: 20px;">
                    3. RESULTADO Y DICTAMEN LEGAL DE LA EVALUACIÓN:
                </p>
                <div style="border: 2px solid #0284c7; background-color: #f0f9ff; padding: 14px; border-radius: 6px;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #0369a1; font-size: 11.5pt;">
                        [ ✔ ] DICTAMEN: EMPRESA EXENTA DE LA OBLIGACIÓN DE NOMBRAR DPO
                    </p>
                    <p style="margin: 0; font-size: 10.5pt; color: #0f172a;">
                        Si ha respondido <strong>"NO" a las cuatro preguntas</strong>, su empresa <strong>NO ESTÁ OBLIGADA POR LA LEY N° 21.719 A DESIGNAR UN DELEGADO DE PROTECCIÓN DE DATOS (DPO)</strong>, ni contratar personal adicional para este cargo. Su empresa da pleno cumplimiento normativo implementando los 6 instrumentos operativos de este Kit (Anexo Laboral con opción biométrica DT, Política Web, DPA Proveedores, RAT en Excel, Protocolo de Brechas y Formulario ARCOP).
                    </p>
                </div>

                <p style="font-weight: bold; margin-top: 18px;">
                    4. RECOMENDACIÓN PRÁCTICA DE GOBERNANZA PYME (COSTO CERO):
                </p>
                <p>
                    Aunque no esté obligada a nombrar un DPO formal ante la Agencia, la mejor práctica de gestión interna recomendada para la Pyme es designar a un <strong>"Coordinador Interno de Privacidad"</strong> (rol funcional que puede asumir el Encargado de Recursos Humanos, el Contador o el Gerente General), cuyas funciones operativas son:
                </p>
                <ul style="margin-left: 25px;">
                    <li>Centralizar la recepción de correos de solicitudes de derechos ARCOP y responder en el plazo legal de 30 días corridos.</li>
                    <li>Mantener actualizado el Registro de Actividades de Tratamiento (RAT en Excel) una vez al año.</li>
                    <li>Actuar como punto de enlace y activar el Protocolo de Brechas en caso de filtración informática o pérdida de equipos.</li>
                </ul>

                <p style="margin-top: 26px; font-size: 10pt; color: #555; text-align: center;">
                    Certificado de Autodiagnóstico archivado por <strong>${escapeHtml(empresa)}</strong> para acreditar diligencia y responsabilidad proactiva (Accountability) ante la Agencia de Protección de Datos Personales.
                </p>
            </div>
        `;
    }

    // =========================================================================
    // DESCARGADORES NATIVOS (BLOB WORD .DOC Y CSV EXCEL)
    // =========================================================================
    function descargarDocumentoWord(htmlContent, filename) {
        var htmlDocumento = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>${filename}</title>
                <!--[if gte mso 9]>
                <xml>
                <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>100</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
                </xml>
                <![endif]-->
                <style>
                    @page Section1 {
                        size: 21.0cm 29.7cm; /* A4 */
                        margin: 2.5cm 2.5cm 2.5cm 2.5cm;
                        mso-header-margin: 35.4pt;
                        mso-footer-margin: 35.4pt;
                        mso-paper-source: 0;
                    }
                    div.Section1 { page: Section1; }
                    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; }
                </style>
            </head>
            <body>
                <div class="Section1">
                    ${htmlContent}
                </div>
            </body>
            </html>
        `;

        var blob = new Blob(['\ufeff', htmlDocumento], {
            type: 'application/msword;charset=utf-8'
        });

        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function descargarRATXlsx(datos) {
        var content = generarRATCsvContent(datos);
        var blob = new Blob(['\ufeff', content], {
            type: 'text/csv;charset=utf-8;'
        });

        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        var nombreLimpio = (datos.empresa || 'Empresa').replace(/\s+/g, '_');
        link.download = `Registro_Actividades_Tratamiento_RAT_Ley_21719_${nombreLimpio}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Helper para descarga de assets oficiales nativos (.docx, .xlsx, .pdf, .zip)
    function descargarArchivoAsset(url, filename) {
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Descargar Manual PDF oficial
    function descargarManualPDF() {
        descargarArchivoAsset('assets/0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf', '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf');
    }

    // Descargar Manual Word (.docx) oficial
    function descargarManualDoc() {
        descargarArchivoAsset('assets/0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.docx', '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.docx');
    }

    // Descarga masiva del Kit completo (Archivo ZIP oficial con los 9 instrumentos y guía)
    function descargarKitCompleto(datos) {
        descargarArchivoAsset('Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip', 'Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip');
    }

    // Descargas individuales nativas (.docx y .xlsx)
    function descargarAnexoLaboral(datos) {
        descargarArchivoAsset('assets/1_Anexo_Laboral_Datos_Personales_Ley_21719.docx', '1_Anexo_Laboral_Datos_Personales_Ley_21719.docx');
    }

    function descargarPoliticaPrivacidad(datos) {
        descargarArchivoAsset('assets/2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx', '2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx');
    }

    function descargarClausulaDPA(datos) {
        descargarArchivoAsset('assets/3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx', '3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx');
    }

    function descargarRAT(datos) {
        descargarArchivoAsset('assets/4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx', '4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx');
    }

    function descargarProtocoloBrechas(datos) {
        descargarArchivoAsset('assets/5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx', '5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx');
    }

    function descargarFormularioARCOP(datos) {
        descargarArchivoAsset('assets/6_Formulario_Solicitud_Derechos_ARCOP.docx', '6_Formulario_Solicitud_Derechos_ARCOP.docx');
    }

    function descargarTestDPO(datos) {
        descargarArchivoAsset('assets/7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx', '7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx');
    }

    // Exportar al objeto global
    window.KitDatosEngine = {
        generarAnexoLaboralHTML: generarAnexoLaboralHTML,
        generarPoliticaPrivacidadHTML: generarPoliticaPrivacidadHTML,
        generarClausulaDPAHTML: generarClausulaDPAHTML,
        generarRATCsvContent: generarRATCsvContent,
        generarProtocoloBrechasHTML: generarProtocoloBrechasHTML,
        generarFormularioARCOPHTML: generarFormularioARCOPHTML,
        generarTestDPOHTML: generarTestDPOHTML,
        descargarDocumentoWord: descargarDocumentoWord,
        descargarRATXlsx: descargarRATXlsx,
        descargarKitCompleto: descargarKitCompleto,
        descargarManualPDF: descargarManualPDF,
        descargarManualDoc: descargarManualDoc,
        descargarAnexoLaboral: descargarAnexoLaboral,
        descargarPoliticaPrivacidad: descargarPoliticaPrivacidad,
        descargarClausulaDPA: descargarClausulaDPA,
        descargarRAT: descargarRATXlsx,
        descargarProtocoloBrechas: descargarProtocoloBrechas,
        descargarFormularioARCOP: descargarFormularioARCOP,
        descargarTestDPO: descargarTestDPO,
        FLOW_CHECKOUT_URL: FLOW_CHECKOUT_URL
    };

})();
