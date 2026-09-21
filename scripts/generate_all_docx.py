import os
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'api', 'assets', 'kit_datos_files')
ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')

def create_base_doc(top=0.8, bottom=0.8, left=0.9, right=0.9):
    doc = docx.Document()
    for s in doc.sections:
        s.top_margin = Inches(top)
        s.bottom_margin = Inches(bottom)
        s.left_margin = Inches(left)
        s.right_margin = Inches(right)
        s.page_width = Inches(8.27)  # A4
        s.page_height = Inches(11.69)
    return doc

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    margins = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(margins)

def prevent_row_split(table):
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def add_header_brand(doc, doc_number_text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.space_before = Pt(0)
    
    run_brand = p.add_run("CÁLCULO LABORAL CHILE  |  PLATAFORMA LEGALTECH\n")
    run_brand.font.name = 'Calibri'
    run_brand.font.size = Pt(8.5)
    run_brand.font.bold = True
    run_brand.font.color.rgb = RGBColor(2, 132, 199)

    run_meta = p.add_run(f"Kit Ley N° 21.719 de Protección de Datos Personales  •  {doc_number_text}")
    run_meta.font.name = 'Calibri'
    run_meta.font.size = Pt(8.5)
    run_meta.font.color.rgb = RGBColor(100, 116, 139)

def add_title(doc, title_text, subtitle_text=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(title_text)
    run.font.name = 'Calibri'
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor(15, 23, 42)

    if subtitle_text:
        p2 = doc.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_after = Pt(12)
        p2.paragraph_format.keep_with_next = True
        run2 = p2.add_run(subtitle_text)
        run2.font.name = 'Calibri'
        run2.font.size = Pt(9)
        run2.font.italic = True
        run2.font.color.rgb = RGBColor(71, 85, 105)

def add_heading(doc, text, space_before=10, space_after=3):
    """
    CRÍTICO: Los encabezados SIEMPRE están alineados a la izquierda (LEFT).
    Esto impide 100% que Word expanda o separe las palabras con espacios gigantes
    cuando el usuario tiene configurada la justificación completa.
    """
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(10.5)
    run.font.bold = True
    run.font.color.rgb = RGBColor(2, 132, 199)
    return p

def add_body(doc, text, bold_prefix=None, space_after=5, line_spacing=1.15):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.name = 'Calibri'
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_b.font.color.rgb = RGBColor(15, 23, 42)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(30, 41, 59)
    return p

def add_bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.name = 'Calibri'
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_b.font.color.rgb = RGBColor(15, 23, 42)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(30, 41, 59)

def add_callout(doc, title, body, bg_hex="F0F9FF"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.47)
    cell = table.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    prevent_row_split(table)
    
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(2)
    r1 = p.add_run(title + "\n")
    r1.font.name = 'Calibri'
    r1.font.size = Pt(9.5)
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(2, 132, 199)
    
    r2 = p.add_run(body)
    r2.font.name = 'Calibri'
    r2.font.size = Pt(9)
    r2.font.color.rgb = RGBColor(51, 65, 85)
    
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_after = Pt(4)

def add_signature_block(doc, left_title, left_sub, right_title, right_sub):
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(24)
    p_sp.paragraph_format.keep_with_next = True
    
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.columns[0].width = Inches(3.2)
    table.columns[1].width = Inches(3.2)
    prevent_row_split(table)
    
    c1 = table.cell(0, 0)
    p1 = c1.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p1.add_run("_________________________________________\n")
    r1.font.color.rgb = RGBColor(100, 116, 139)
    r1_b = p1.add_run(left_title + "\n")
    r1_b.bold = True
    r1_b.font.size = Pt(9)
    r1_s = p1.add_run(left_sub)
    r1_s.font.size = Pt(8)
    r1_s.font.color.rgb = RGBColor(71, 85, 105)

    c2 = table.cell(0, 1)
    p2 = c2.paragraphs[0]
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run("_________________________________________\n")
    r2.font.color.rgb = RGBColor(100, 116, 139)
    r2_b = p2.add_run(right_title + "\n")
    r2_b.bold = True
    r2_b.font.size = Pt(9)
    r2_s = p2.add_run(right_sub)
    r2_s.font.size = Pt(8)
    r2_s.font.color.rgb = RGBColor(71, 85, 105)


# =========================================================================
# DOC 0: MANUAL DE USO E INSTRUCCIONES PASO A PASO
# =========================================================================
def build_doc_0():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.85, right=0.85)
    add_header_brand(doc, "Documento 0 Oficial  •  Guía Maestra de Implementación")
    add_title(doc, "MANUAL DE USO E IMPLEMENTACIÓN RÁPIDA", 
              "Kit LegalTech Ley N° 21.719 de Protección de Datos Personales (Chile 2026)\nGuía práctica paso a paso para Micro, Pequeñas y Medianas Empresas (MiPymes)")
    
    add_callout(doc, "PRINCIPIO BÁSICO PARA EL EMPRESARIO PYME (PARA NO ABOGADOS):",
                "La Ley N° 21.719 y la Dirección del Trabajo (DT) no exigen que una pyme instale costosos servidores ni gaste $2.000.000 en estudios jurídicos. Lo que la ley exige formalmente es el Principio de Responsabilidad y Diligencia Debida: demostrar por escrito que cuidas los datos de tus dependientes y clientes, que los contratos contienen cláusulas de confidencialidad y que sabes qué hacer si ocurre un incidente.",
                bg_hex="F0FDF4")
    
    add_heading(doc, "1. LA RUTA DE IMPLEMENTACIÓN EN 3 PASOS (15 MINUTOS)")
    add_body(doc, "Imprime el Documento 1 (Anexo Laboral). Complétalo con el nombre de tu empresa, RUT y los datos de cada trabajador. Fírmalo junto a la entrega de la liquidación de sueldo y archívalo en la carpeta de personal. Con esto cumples la Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo sobre relojes control y blindas la confidencialidad de licencias médicas.", bold_prefix="PASO 1 (HOY MISMO - ÁREA LABORAL): ")
    add_body(doc, "Abre el Documento 4 (Excel RAT). En la Fila 3, cambia [NOMBRE DE TU EMPRESA] y [RUT EMPRESA] por tus datos reales y guárdalo en tu computador. Publica el Documento 2 (Política de Privacidad) en el pie de tu sitio web o imprímela para tenerla disponible ante clientes.", bold_prefix="PASO 2 (ESTA SEMANA - ÁREA ADMINISTRATIVA Y WEB): ")
    add_body(doc, "Archiva los Documentos 3, 5, 6 y 7 en la carpeta digital de administración. Servirán como prueba de cumplimiento si la Dirección del Trabajo o la Agencia de Protección de Datos Personales (APDP) te fiscalizan.", bold_prefix="PASO 3 (DE RESGUARDO - PROTOCOLOS DE EMERGENCIA): ")

    # Salto de página para que la tabla comparativa de sectores quede 100% entera en la Página 2
    doc.add_page_break()

    add_header_brand(doc, "Documento 0 Oficial  •  Guía Práctica por Sectores y Rubros")
    add_heading(doc, "2. GUÍA POR RUBROS Y SECTORES: ¿ES ESTANDARIZADO O DIFERENTE?")
    add_body(doc, "La ley es IDÉNTICA para todas las empresas de Chile. El 85% del tratamiento de datos (sueldos, boletas, facturas, contratos y licencias médicas) es exactamente el mismo en cualquier rubro. Si perteneces a un sector con particularidades operativas, revisa la siguiente tabla:")

    table = doc.add_table(rows=7, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    prevent_row_split(table)

    headers = ["Rubro / Sector", "¿Qué datos específicos maneja?", "Instrucción de aplicación con el Kit"]
    for i, h in enumerate(headers):
        c = table.cell(0, i)
        set_cell_background(c, "0F172A")
        set_cell_margins(c, top=80, bottom=80, left=90, right=90)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(h)
        r.font.name = 'Calibri'
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    rows_data = [
        ("Servicios B2B, Talleres, Fábricas y Oficinas", "Nómina de trabajadores, emisión de facturas a clientes empresa y proveedores.", "100% Plug & Play. No requiere modificar ninguna cláusula. Usa el kit tal cual viene pre-rellenado."),
        ("Comercio Online (E-commerce) y Tiendas", "Direcciones de despacho a particulares, teléfonos y pasarelas de pago (Transbank, Flow, etc.).", "Publica el Documento 2 en tu web. En el Excel RAT, mantén activa la fila RAT-05 (Ventas web) y nombra a los couriers en Columna H."),
        ("Transporte, Logística y Fletes", "Geolocalización (GPS) en camiones, furgones o motocicletas asignadas a choferes.", "En el Documento 1 (Anexo), deja constancia de que los vehículos tienen GPS por seguridad de ruta. En el RAT añade la fila RAT-07: Rastreo GPS."),
        ("Salud y Bienestar (Clínicas, Dentistas)", "Fichas clínicas y diagnósticos médicos de pacientes particulares (Datos Sensibles).", "Recaba consentimiento expreso en ficha de ingreso y firma obligatoriamente el Documento 3 (DPA) con tu software médico en la nube."),
        ("Educación, Jardines y Academias", "Datos e imágenes de menores de 14 años.", "La ley exige que la autorización la firme obligatoriamente el padre, madre o tutor legal en la ficha de matrícula."),
        ("Locales Comerciales Abiertos a Público", "Cámaras de seguridad (CCTV) con grabación continua de clientes.", "Mantén activa la fila RAT-06 en el Excel y coloca un letrero visible en el acceso: 'Zona videovigilada conforme a la Ley N° 21.719'.")
    ]

    for row_idx, data in enumerate(rows_data, start=1):
        bg = "F8FAFC" if row_idx % 2 == 0 else "FFFFFF"
        for col_idx, text in enumerate(data):
            c = table.cell(row_idx, col_idx)
            set_cell_background(c, bg)
            set_cell_margins(c, top=60, bottom=60, left=80, right=80)
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(text)
            r.font.name = 'Calibri'
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(30, 41, 59)
            if col_idx == 0:
                r.font.bold = True

    # Salto de página para que el FAQ y el Checklist queden enteros en la Página 3
    doc.add_page_break()

    add_header_brand(doc, "Documento 0 Oficial  •  Preguntas Frecuentes y Checklist de Blindaje")
    add_heading(doc, "3. PREGUNTAS FRECUENTES (FAQ) DE DUEÑOS Y GERENTES DE PYMES")
    add_body(doc, "No. Ninguna ley exige enviar copias al Estado. Se custodian internamente en la empresa y se exhiben únicamente cuando la Dirección del Trabajo o la Agencia APDP fiscalizan.", bold_prefix="¿Tengo que enviar estos documentos a alguna entidad del Estado? ")
    add_body(doc, "La Dirección del Trabajo (Res. Ex. N° 38/2024) prohíbe despedirlo o sancionarlo. Debes ofrecerle una alternativa no biométrica (tarjeta magnética, clave o libro). Al tener firmado nuestro Documento 1, tu empresa queda blindada.", bold_prefix="¿Qué pasa si un trabajador se niega a poner la huella en el reloj control? ")
    add_body(doc, "Abre inmediatamente el Documento 5 (Protocolo de Brechas). Sigue los 4 pasos: aislar el equipo, evaluar qué datos se vieron afectados y remitir el reporte a la Agencia sin dilaciones indebidas (meta 72 horas).", bold_prefix="¿Qué hacer ante un hackeo o robo de computador con datos? ")
    add_body(doc, "No. Las micro, pequeñas y medianas empresas están legalmente exentas. Para acreditarlo formalmente ante cualquier inspector, firma el Documento 7 (Test DPO) incluido en este kit.", bold_prefix="¿Debo contratar a un Delegado de Protección de Datos (DPO)? ")

    add_heading(doc, "4. CHECKLIST DE BLINDAJE TOTAL (LISTA DE COTEJO)")
    add_bullet(doc, "Todos los trabajadores contratados tienen firmado el anexo de datos personales y huella archivado en su carpeta de personal.", bold_prefix="[  ] Documento 1 (Anexo Laboral): ")
    add_bullet(doc, "Texto visible en el pie de página de la web o anexado a correos de cotizaciones y disponible en recepción.", bold_prefix="[  ] Documento 2 (Política de Privacidad): ")
    add_bullet(doc, "Suscrito con el contador externo de la empresa y con los proveedores de software o hosting.", bold_prefix="[  ] Documento 3 (Cláusula DPA): ")
    add_bullet(doc, "Planilla completada con el Nombre y RUT en la Fila 3, archivada en formato Excel y PDF en el computador de administración.", bold_prefix="[  ] Documento 4 (Registro RAT): ")
    add_bullet(doc, "Procedimiento conocido por administración ante cualquier sospecha de hackeo, pérdida de laptop o filtración.", bold_prefix="[  ] Documento 5 (Protocolo de Brechas 72h): ")
    add_bullet(doc, "Plantilla lista para responder reclamos de clientes o trabajadores en el plazo legal fatal de 30 días corridos.", bold_prefix="[  ] Documento 6 (Formulario ARCOP): ")
    add_bullet(doc, "Test de 4 preguntas firmado por el representante legal que acredita la exención formal de contratar un DPO.", bold_prefix="[  ] Documento 7 (Test DPO): ")

    return doc


# =========================================================================
# DOC 1: ANEXO LABORAL DE TRATAMIENTO DE DATOS PERSONALES
# =========================================================================
def build_doc_1():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.9, right=0.9)
    add_header_brand(doc, "Documento 1 Oficial  •  Formato Word Editable (.docx)")
    add_title(doc, "ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO\nAUTORIZACIÓN, TRATAMIENTO Y PROTECCIÓN DE DATOS PERSONALES",
              "(Conforme a la Ley N° 21.719, Arts. 154 bis y ter del Código del Trabajo y Res. Exenta N° 38/2024 de la Dirección del Trabajo)")
    
    add_body(doc, "En [CIUDAD], a [FECHA ACTUAL], entre:")
    add_body(doc, "1. [NOMBRE DE LA EMPRESA / RAZÓN SOCIAL], Rol Único Tributario N° [RUT EMPRESA], representada legalmente según consta en el contrato de trabajo principal, en adelante denominada indistintamente el 'Empleador' o el 'Responsable del Tratamiento'; y")
    add_body(doc, "2. Don/Doña [NOMBRE COMPLETO DEL TRABAJADOR], cédula nacional de identidad N° [RUT TRABAJADOR], en adelante denominado el 'Trabajador' o el 'Titular de los Datos';")
    add_body(doc, "Se ha convenido y suscrito el siguiente ANEXO AL CONTRATO DE TRABAJO:")

    add_heading(doc, "CLÁUSULA PRIMERA: ANTECEDENTES Y MARCO NORMATIVO.")
    add_body(doc, "Las partes declaran que con fecha 13 de diciembre de 2024 fue promulgada la Ley N° 21.719 que regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales, y que en conformidad con los artículos 154 bis y 154 ter del Código del Trabajo, el Empleador se encuentra legalmente obligado a custodiar bajo estricta reserva y confidencialidad toda la información privada y sensible del Trabajador devengada con ocasión de la relación laboral.")

    add_heading(doc, "CLÁUSULA SEGUNDA: CATEGORÍAS DE DATOS Y FINALIDAD DEL TRATAMIENTO.")
    add_body(doc, "El Trabajador toma conocimiento y autoriza al Empleador a tratar exclusivamente los datos personales estrictamente necesarios para:")
    add_bullet(doc, "Confección y pago de remuneraciones, liquidaciones de sueldo, transferencias bancarias, retenciones judiciales (pensiones de alimentos), pago de cotizaciones previsionales en Previred y gestión de finiquitos ante la Dirección del Trabajo.", bold_prefix="Gestión de la Relación Laboral: ")
    add_bullet(doc, "Envío de reportes al Servicio de Impuestos Internos (SII), Dirección del Trabajo (portal Mi DT) y Administradoras de Fondos de Pensiones / Isapre / Fonasa.", bold_prefix="Cumplimiento Legal y Previsional: ")
    add_bullet(doc, "Control de exámenes de salud laboral conforme a la Ley 16.744 y reglamento interno de orden, higiene y seguridad.", bold_prefix="Prevención de Riesgos y Seguridad Ocupacional: ")

    add_heading(doc, "CLÁUSULA TERCERA: TRATAMIENTO DE DATOS SENSIBLES DE SALUD (LICENCIAS MÉDICAS).")
    add_body(doc, "En virtud del artículo 12 de la Ley N° 21.719 y el artículo 154 bis del Código del Trabajo, los antecedentes relativos al estado de salud del Trabajador, tales como licencias médicas, diagnósticos y exámenes ocupacionales, constituyen datos sensibles de especial protección. El Empleador se compromete formalmente a que el acceso a dichos antecedentes quedará estrictamente limitado al personal de Recursos Humanos encargado de la tramitación previsional (COMPIN/Isapre), prohibiéndose expresamente su divulgación a jefaturas directas o a terceros ajenos a la tramitación legal.")

    add_heading(doc, "CLÁUSULA CUARTA: SISTEMA DE CONTROL DE ASISTENCIA Y OPCIÓN BIOMÉTRICA (RES. EXENTA N° 38/2024 DT).")
    add_body(doc, "En cumplimiento estricto del dictamen y Resolución Exenta N° 38 de 2024 de la Dirección del Trabajo:")
    add_bullet(doc, "El Trabajador toma conocimiento de que la empresa dispone de un sistema automatizado de control de asistencia. En caso de utilizar tecnología biométrica (huella dactilar o reconocimiento facial), el Empleador declara que los datos capturados se almacenan únicamente como patrones o algoritmos matemáticos encriptados y no como imágenes reconstructibles de la huella o rostro.")
    add_bullet(doc, "El Empleador garantiza expresamente al Trabajador el derecho a optar por un método de marcaje alternativo no biométrico (tarjeta magnética, clave/PIN o aplicación), sin que su negativa a utilizar biometría pueda constituir falta laboral, represalia o causal de despido.", bold_prefix="Garantía de Alternativa No Biométrica: ")
    add_bullet(doc, "Los datos de asistencia no serán utilizados para ningún fin distinto al registro de jornada y cálculo de remuneraciones.")

    add_heading(doc, "CLÁUSULA QUINTA: HERRAMIENTAS CORPORATIVAS Y POLÍTICA DE DISPOSITIVOS.")
    add_body(doc, "Los correos electrónicos corporativos, computadores, teléfonos y cuentas asignadas por el Empleador son herramientas de trabajo de propiedad exclusiva de la empresa. El Trabajador se compromete a utilizarlas para los fines de sus funciones. El Empleador podrá implementar medidas de ciberseguridad proporcionales (antivirus, filtros de navegación), respetando en todo momento el derecho a la intimidad y la honra del dependiente, quedando vedada la inspección intrusiva de comunicaciones de carácter estrictamente personal.")

    add_heading(doc, "CLÁUSULA SEXTA: ENCARGADOS DE TRATAMIENTO (PROVEEDORES EXTERNOS).")
    add_body(doc, "El Trabajador es informado de que el Empleador puede contratar los servicios de proveedores tecnológicos externos debidamente homologados (empresas de software de recursos humanos, contadores auditores o servidores en la nube) en calidad de 'Encargados de Tratamiento', quienes actuarán bajo contrato vinculante con iguales deberes de reserva y ciberseguridad.")

    add_heading(doc, "CLÁUSULA SÉPTIMA: EJERCICIO DE DERECHOS ARCOP.")
    add_body(doc, "El Trabajador podrá en todo momento ejercer sus derechos de Acceso, Rectificación, Cancelación, Oposición, Portabilidad y Bloqueo de sus datos personales, dirigiéndose por escrito al correo institucional: privacidad@empresa.cl, el cual será respondido dentro del plazo legal fatal de treinta (30) días corridos contado desde la recepción de la solicitud, de conformidad con lo establecido en el artículo 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719).")

    add_heading(doc, "CLÁUSULA OCTAVA: PLAZO DE CONSERVACIÓN.")
    add_body(doc, "Terminada la relación laboral, los datos del Trabajador se conservarán durante la vigencia del contrato y hasta por 5 años posteriores a su término (plazo de prescripción de acciones laborales según los Arts. 480 y 510 del Código del Trabajo), salvo la documentación de respaldo contable, previsional y tributario que se resguardará por 6 años (según el Art. 200 del Código Tributario), tras lo cual se procederá a su bloqueo y posterior eliminación o anonimización segura.")

    add_body(doc, "Para constancia, se firma el presente anexo en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada una de las partes.")

    add_signature_block(doc,
                        "[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]", "RUT N° [RUT EMPRESA]\nEMPLEADOR / RESPONSABLE",
                        "[NOMBRE DEL TRABAJADOR]", "C.I. N° [RUT TRABAJADOR]\nTRABAJADOR / TITULAR DE DATOS")
    return doc


# =========================================================================
# DOC 2: POLÍTICA DE PRIVACIDAD WEB Y CLIENTES
# =========================================================================
def build_doc_2():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.9, right=0.9)
    add_header_brand(doc, "Documento 2 Oficial  •  Formato Word Editable (.docx)")
    add_title(doc, "POLÍTICA GENERAL DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES",
              "Conforme a la Ley N° 21.719 sobre Protección y Tratamiento de Datos Personales de la República de Chile\nDocumento para publicación en sitio web y entrega a clientes comerciales")

    # TÍTULO 1: Alineado a la izquierda, sin caracteres extraños ni saltos justificables
    add_heading(doc, "1. IDENTIFICACIÓN DEL RESPONSABLE DEL TRATAMIENTO")
    add_body(doc, "El responsable del tratamiento de los datos personales recopilados a través del sitio web https://www.empresa.cl, canales de venta presencial, WhatsApp corporativo y formularios digitales es [NOMBRE DE LA EMPRESA / RAZÓN SOCIAL], Rol Único Tributario N° [RUT EMPRESA], domiciliada en [DIRECCIÓN COMERCIAL, COMUNA, CIUDAD], correo electrónico de contacto: privacidad@empresa.cl (en adelante, la 'Empresa').")

    # TÍTULO 2
    add_heading(doc, "2. PRINCIPIOS DE TRATAMIENTO APLICADOS (ARTÍCULO 4 LEY 21.719)")
    add_body(doc, "La Empresa trata los datos de conformidad con los principios rectores de la legislación chilena:")
    add_bullet(doc, "Los datos se tratan solo mediando base legal expresa (consentimiento, contrato o cumplimiento de obligación legal).", bold_prefix="Licitud y Lealtad: ")
    add_bullet(doc, "Los datos se recopilan únicamente para fines explícitos y determinados.", bold_prefix="Finalidad Específica: ")
    add_bullet(doc, "Solo se solicita la información estrictamente necesaria para cumplir con el servicio contratado.", bold_prefix="Proporcionalidad y Minimización: ")
    add_bullet(doc, "Se adoptan medidas razonables para mantener los datos veraces y actualizados.", bold_prefix="Calidad y Exactitud: ")
    add_bullet(doc, "Aplicación de controles técnicos y organizativos para evitar accesos no autorizados, hackeos, pérdidas o alteraciones.", bold_prefix="Seguridad y Confidencialidad: ")

    # TÍTULO 3 (EL QUE SE VEÍA SEPARADO EN LA FOTO)
    # Al ser un add_heading independiente alineado a la izquierda, NUNCA se expandirá ni separará
    add_heading(doc, "3. DATOS QUE RECOPILAMOS Y FINALIDADES")
    add_body(doc, "La Empresa podrá recopilar los siguientes antecedentes personales:")
    add_bullet(doc, "Nombre completo, RUT, correo electrónico, teléfono y dirección de despacho, con la finalidad de procesar compras, emitir facturas/boletas electrónicas según normas del SII y gestionar envíos logísticos.", bold_prefix="Datos Identificatorios y de Facturación: ")
    add_bullet(doc, "Consultas formuladas por formularios de contacto o WhatsApp, con la finalidad de brindar soporte técnico y cotizaciones comerciales.", bold_prefix="Datos de Atención al Cliente: ")
    add_bullet(doc, "Dirección IP, tipo de navegador y páginas visitadas para fines estadísticos y de rendimiento del sitio web.", bold_prefix="Datos de Navegación (Cookies): ")

    # TÍTULO 4
    add_heading(doc, "4. BASES DE LICITUD (LEGITIMACIÓN)")
    add_body(doc, "El tratamiento de datos se fundamenta en las siguientes causales de licitud:")
    add_bullet(doc, "La ejecución de una relación contractual o medidas precontractuales solicitadas por el cliente (Art. 13 letra a Ley 21.719).")
    add_bullet(doc, "El cumplimiento de obligaciones tributarias, comerciales y de protección al consumidor (Ley 19.496 y Código Tributario).")
    add_bullet(doc, "El consentimiento libre, previo, expreso e informado del usuario para comunicaciones promocionales (revocable en cualquier momento).")

    # TÍTULO 5
    add_heading(doc, "5. TRANSFERENCIA Y ENCARGADOS DE TRATAMIENTO")
    add_body(doc, "La Empresa no comercializa, arrienda ni vende bases de datos personales a terceros bajo ninguna circunstancia. Los datos podrán comunicarse a proveedores tecnológicos de pasarelas de pago (Transbank, Flow, Mercado Pago), empresas de courier logístico y servicios de facturación, quienes operan en calidad de 'Encargados de Tratamiento' sujetos a estrictos contratos de confidencialidad.")

    # TÍTULO 6
    add_heading(doc, "6. DERECHOS DE LOS TITULARES (DERECHOS ARCOP)")
    add_body(doc, "Conforme a los artículos 5° al 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719), todo titular de datos goza de los siguientes derechos inalienables:")
    add_bullet(doc, "Solicitar confirmación de qué datos suyos se tratan y obtener copia de ellos.", bold_prefix="Acceso: ")
    add_bullet(doc, "Modificar datos inexactos, incompletos o desactualizados.", bold_prefix="Rectificación: ")
    add_bullet(doc, "Exigir la eliminación de sus datos cuando ya no sean necesarios para la finalidad originaria.", bold_prefix="Supresión (Cancelación): ")
    add_bullet(doc, "Negarse al uso de sus datos para fines comerciales o publicidad directa.", bold_prefix="Oposición: ")
    add_bullet(doc, "Recibir sus datos en un formato digital estructurado, común y de lectura mecánica.", bold_prefix="Portabilidad: ")
    add_bullet(doc, "Suspender provisionalmente el tratamiento mientras se resuelve una impugnación de exactitud.", bold_prefix="Bloqueo: ")
    add_body(doc, "Para ejercer estos derechos, el titular debe enviar su solicitud formal al correo privacidad@empresa.cl acreditando su identidad. La Empresa acusará recibo y responderá fundadamente dentro del plazo legal fatal de treinta (30) días corridos contado desde su recepción (Artículo 11 Ley N° 19.628).")

    # TÍTULO 7
    add_heading(doc, "7. PLAZOS DE RETENCIÓN DE INFORMACIÓN")
    add_body(doc, "Los datos de clientes se conservarán mientras dure la relación comercial y durante el plazo de 6 años establecido por el Código Tributario para fiscalizaciones contables, tras lo cual serán eliminados o anonimizados.")

    # TÍTULO 8
    add_heading(doc, "8. AGENCIA DE PROTECCIÓN DE DATOS PERSONALES")
    add_body(doc, "En caso de que el titular considere que sus derechos no han sido satisfechos oportunamente, tiene el derecho de recurrir ante la Agencia de Protección de Datos Personales de Chile de conformidad a los procedimientos sancionatorios de la ley.")
    return doc


# =========================================================================
# DOC 3: CLÁUSULA DPA PROVEEDORES Y ENCARGADOS
# =========================================================================
def build_doc_3():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.9, right=0.9)
    add_header_brand(doc, "Documento 3 Oficial  •  Formato Word Editable (.docx)")
    add_title(doc, "ANEXO DE TRATAMIENTO DE DATOS PERSONALES (DPA)\nENTRE RESPONSABLE Y ENCARGADO DEL TRATAMIENTO",
              "(Conforme al Artículo 14 bis y 14 ter de la Ley N° 21.719 de Chile)")

    add_body(doc, "El presente Anexo de Tratamiento de Datos Personales (Data Processing Agreement) se suscribe entre [NOMBRE DE TU EMPRESA] (RUT [RUT TU EMPRESA]), en adelante el 'Responsable', y [NOMBRE DEL PROVEEDOR / CONTADOR / SOFTWARE] (RUT [RUT PROVEEDOR]), en adelante el 'Encargado', como parte integrante del contrato de prestación de servicios vigente entre las partes.")

    add_heading(doc, "1. OBJETO Y ALCANCE DEL TRATAMIENTO.")
    add_body(doc, "El Encargado tratará por cuenta del Responsable los datos personales necesarios para la prestación del servicio encomendado (contabilidad, nómina, alojamiento en la nube, soporte o desarrollo de software), comprometiéndose a no utilizarlos para ninguna otra finalidad propia ni de terceros.")

    add_heading(doc, "2. OBLIGACIONES LEGALES DEL ENCARGADO (ARTÍCULO 14 BIS).")
    add_bullet(doc, "Tratar los datos únicamente siguiendo las instrucciones documentadas del Responsable.")
    add_bullet(doc, "Garantizar que todo su personal con acceso a los datos esté sujeto a un deber formal de confidencialidad perpetuo.")
    add_bullet(doc, "Implementar medidas técnicas y organizativas de seguridad adecuadas para garantizar un nivel de seguridad proporcional al riesgo (cifrado, control de accesos, copias de seguridad).")
    add_bullet(doc, "No subcontratar a otro proveedor ('Sub-encargado') sin la autorización previa y escrita del Responsable.")
    add_bullet(doc, "Asistir al Responsable en la tramitación y respuesta oportuna de los derechos ARCOP de los titulares dentro del plazo legal fatal de treinta (30) días corridos.")

    add_heading(doc, "3. NOTIFICACIÓN DE INCIDENTES Y BRECHAS (ESTÁNDAR OPERATIVO 72 HORAS).")
    add_body(doc, "En caso de que el Encargado sufra un incidente de seguridad, vulneración, filtración, hackeo o pérdida que comprometa los datos personales del Responsable, estará legalmente obligado a notificar al Responsable a más tardar dentro de las 24 horas siguientes a haber tomado conocimiento del hecho, entregando la descripción del incidente, datos afectados y medidas correctivas inmediatas, a fin de que el Responsable pueda cumplir con la obligación de notificar a la Agencia de Protección de Datos Personales sin dilaciones indebidas (conforme al Art. 14 sexies de la Ley N° 19.628 reformada), adoptando el estándar operativo y mejor práctica internacional recomendada de un plazo máximo de 72 horas.")

    add_heading(doc, "4. DESTINO FINAL DE LOS DATOS TRAS EL TÉRMINO DEL SERVICIO.")
    add_body(doc, "Finalizada la prestación del servicio principal, el Encargado deberá, a elección del Responsable, devolver íntegramente o destruir de forma segura e irrecuperable todas las bases de datos y copias existentes, emitiendo un certificado formal de destrucción.")

    add_heading(doc, "5. RESPONSABILIDAD E INDEMNIDAD.")
    add_body(doc, "El incumplimiento de las obligaciones aquí previstas por parte del Encargado hará aplicables las sanciones de la Ley N° 21.719, debiendo el Encargado indemnizar íntegramente al Responsable por cualquier multa cursada por la Agencia de Protección de Datos Personales o reclamos judiciales derivados directamente de su negligencia o dolo.")

    add_signature_block(doc,
                        "[NOMBRE DE TU EMPRESA]", "RUT N° [RUT TU EMPRESA]\nRESPONSABLE DEL TRATAMIENTO",
                        "[NOMBRE DEL PROVEEDOR]", "RUT N° [RUT PROVEEDOR]\nENCARGADO DEL TRATAMIENTO")
    return doc


# =========================================================================
# DOC 5: PROTOCOLO DE BRECHAS DE SEGURIDAD 72H (CORRECCIÓN RECUADRO PARTIDO)
# =========================================================================
def build_doc_5():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.85, right=0.85)
    add_header_brand(doc, "Documento 5 Oficial  •  Formato Word Editable (.docx)")
    add_title(doc, "PROTOCOLO OPERATIVO DE GESTIÓN Y NOTIFICACIÓN DE BRECHAS DE SEGURIDAD",
              "(Conforme al Artículo 14 sexies de la Ley N° 19.628 reformada por Ley N° 21.719 - Estándar Operativo 72 Horas)")

    add_heading(doc, "1. OBJETIVO")
    add_body(doc, "Establecer las directrices de acción inmediata ante cualquier violación de seguridad, filtración, robo, pérdida, acceso no autorizado o alteración de datos personales custodiados por [NOMBRE DE LA EMPRESA] (RUT [RUT EMPRESA]), garantizando la contención del daño y el cumplimiento de la obligación legal de notificar a la Agencia de Protección de Datos Personales a la mayor brevedad posible y sin dilaciones indebidas (Art. 14 sexies), adoptando como estándar operativo interno y mejor práctica internacional recomendada un plazo máximo de 72 horas desde la detección del incidente.")

    add_heading(doc, "2. CLASIFICACIÓN DE INCIDENTES DE SEGURIDAD")
    add_bullet(doc, "Infección por Ransomware, phishing exitoso con acceso a bases de datos o cuentas de correo corporativas.", bold_prefix="Acceso Ilícito / Ciberataque: ")
    add_bullet(doc, "Extravío de notebooks, teléfonos móviles o discos duros con información de clientes o nóminas no encriptadas.", bold_prefix="Pérdida o Robo de Dispositivos: ")
    add_bullet(doc, "Envío masivo de correos con datos personales sin copia oculta (BCC), o publicación accidental de archivos confidenciales.", bold_prefix="Error Humano Operativo: ")

    add_heading(doc, "3. PROTOCOLO DE RESPUESTA EN 4 FASES")
    add_body(doc, "Desconectar inmediatamente de la red los equipos comprometidos, cambiar contraseñas de accesos administrativos, revocar tokens de sesión y aislar el servidor afectado.", bold_prefix="FASE 1: Detección y Contención (Horas 0 a 12): ")
    add_body(doc, "Determinar qué categorías de datos fueron expuestas (datos comunes vs. datos sensibles de salud/biometría) y estimar el número aproximado de titulares afectados.", bold_prefix="FASE 2: Evaluación Forense y del Impacto (Horas 12 a 36): ")
    add_body(doc, "Si la brecha entraña un riesgo para los derechos de los titulares, remitir el reporte oficial a la Agencia de Protección de Datos Personales sin dilación indebida, estableciendo como meta de cumplimiento operativo interno no superar las 72 horas desde que se tuvo conocimiento confirmado del incidente.", bold_prefix="FASE 3: Notificación Formal a la Agencia (Horas 36 a 72): ")
    add_body(doc, "Si el riesgo es de gravedad, comunicar directamente a los afectados las medidas que deben tomar (ej. cambio de claves bancarias) y registrar el incidente en la Bitácora Histórica del RAT.", bold_prefix="FASE 4: Notificación a Titulares y Mitigación (Posterior a 72 Horas): ")

    # =========================================================================
    # CORRECCIÓN VITAL DEL RECUADRO:
    # Agregamos salto de página explícito ANTES del Anexo del Formulario.
    # Con esto, la FASE 4 cierra limpiamente la Página 1, y el recuadro del Formulario
    # se imprime 100% ENTERO e INTACTO en la Página 2, sin partirse por la mitad.
    # =========================================================================
    doc.add_page_break()

    add_header_brand(doc, "Documento 5 Oficial  •  Anexo: Formulario de Notificación APDP")
    add_heading(doc, "ANEXO: FORMULARIO OFICIAL DE REPORTE DE BRECHA A LA AGENCIA (72 HORAS)")
    add_body(doc, "Complete el siguiente formulario y remítalo a los canales oficiales de la Agencia de Protección de Datos Personales en caso de un incidente calificado:")
    
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    prevent_row_split(table)
    
    c = table.cell(0, 0)
    set_cell_background(c, "F8FAFC")
    set_cell_margins(c, top=100, bottom=100, left=130, right=130)
    
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    lines = [
        ("A: ", "AGENCIA DE PROTECCIÓN DE DATOS PERSONALES DE CHILE (APDP)"),
        ("DE: ", "[NOMBRE DE LA EMPRESA] | RUT: [RUT EMPRESA]"),
        ("FECHA Y HORA DEL INCIDENTE: ", "[Indicar fecha y hora exacta del suceso]"),
        ("FECHA Y HORA DE DETECCIÓN: ", "[Indicar cuándo se tomó conocimiento confirmado]"),
        ("1. NATURALEZA DE LA VULNERACIÓN: ", "\n[  ] Confidencialidad (Divulgación o acceso no autorizado)\n[  ] Integridad (Alteración o modificación indebida)\n[  ] Disponibilidad (Pérdida, destrucción o secuestro por Ransomware)"),
        ("2. CATEGORÍAS Y NÚMERO APROXIMADO DE AFECTADOS: ", "\n[Describir si son clientes o trabajadores, y cantidad aproximada]"),
        ("3. CONSECUENCIAS Y RIESGOS PREVISIBLES: ", "\n[Describir eventuales perjuicios económicos, patrimoniales o reputacionales]"),
        ("4. MEDIDAS CORRECTIVAS ADOPTADAS O PROPUESTAS: ", "\n[Detallar parches, desconexión de red, reseteo de claves y contención realizada]"),
        ("5. PERSONA DE CONTACTO INSTITUCIONAL DE RESPUESTA: ", "\nNombre del Representante: [Nombre y Cargo]\nTeléfono Directo: [Teléfono]\nCorreo Electrónico Oficial: [Email]")
    ]
    for b_prefix, text in lines:
        rb = p.add_run(b_prefix)
        rb.font.bold = True
        rb.font.size = Pt(9)
        rt = p.add_run(text + "\n")
        rt.font.size = Pt(9)

    return doc


# =========================================================================
# DOC 6: FORMULARIO DE DERECHOS ARCOP (DISEÑADO EXACTO EN 1 SOLA PÁGINA)
# =========================================================================
def build_doc_6():
    # Márgenes compactos de 0.65 pulgadas para asegurar 1 sola página completa
    doc = create_base_doc(top=0.6, bottom=0.6, left=0.75, right=0.75)
    add_header_brand(doc, "Documento 6 Oficial  •  Formulario Imprimible en 1 Página (.docx)")
    add_title(doc, "FORMULARIO OFICIAL DE SOLICITUD DE EJERCICIO DE DERECHOS ARCOP",
              "(Acceso, Rectificación, Supresión, Oposición, Portabilidad y Bloqueo - Ley N° 21.719)")

    add_body(doc, "El presente formulario permite a cualquier titular de datos (cliente, trabajador, ex-trabajador, proveedor o usuario) solicitar ante [NOMBRE DE LA EMPRESA] (RUT [RUT EMPRESA]) el ejercicio formal de sus derechos reconocidos en los artículos 5° al 11 de la Ley N° 19.628 (modificada por la Ley N° 21.719).", space_after=3)

    add_heading(doc, "1. DATOS DEL TITULAR SOLICITANTE", space_before=6, space_after=2)
    add_body(doc, "Nombre Completo: ____________________________________________________________________", space_after=2)
    add_body(doc, "RUT / Documento de Identidad: ________________________________________________________", space_after=2)
    add_body(doc, "Correo Electrónico de Notificación: ____________________________________________________", space_after=2)
    add_body(doc, "Teléfono Móvil de Contacto: _________________________________________________________", space_after=2)
    add_body(doc, "Calidad del Titular:   [  ] Cliente     [  ] Trabajador     [  ] Ex-trabajador     [  ] Proveedor     [  ] Otro", space_after=4)

    add_heading(doc, "2. DERECHO QUE SOLICITA EJERCER (Marcar con una X)", space_before=6, space_after=2)
    add_bullet(doc, "Deseo conocer qué datos personales míos posee la empresa y su tratamiento.", bold_prefix="[  ] ACCESO: ")
    add_bullet(doc, "Solicito corregir o actualizar datos inexactos, incompletos o desactualizados.", bold_prefix="[  ] RECTIFICACIÓN: ")
    add_bullet(doc, "Solicito eliminar mis datos por haber expirado la finalidad o plazo legal.", bold_prefix="[  ] SUPRESIÓN / CANCELACIÓN: ")
    add_bullet(doc, "Solicito que mis datos no sean utilizados para fines publicitarios o comerciales.", bold_prefix="[  ] OPOSICIÓN: ")
    add_bullet(doc, "Solicito copia de mis datos en formato estructurado, interoperable y de lectura mecánica.", bold_prefix="[  ] PORTABILIDAD: ")
    add_bullet(doc, "Solicito la suspensión cautelar temporal del tratamiento mientras se resuelve mi solicitud.", bold_prefix="[  ] BLOQUEO: ")

    add_heading(doc, "3. DETALLE DE LA SOLICITUD Y ANTECEDENTES DE RESPALDO", space_before=6, space_after=2)
    
    # Cuadro delimitado para que el usuario escriba a mano o en computador
    table_desc = doc.add_table(rows=1, cols=1)
    table_desc.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_desc.columns[0].width = Inches(6.7)
    prevent_row_split(table_desc)
    c_desc = table_desc.cell(0, 0)
    set_cell_background(c_desc, "FAFAFA")
    set_cell_margins(c_desc, top=60, bottom=60, left=100, right=100)
    p_desc = c_desc.paragraphs[0]
    p_desc.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_desc = p_desc.add_run("[Indique detalladamente los datos que solicita acceder, rectificar, cancelar o bloquear, acompañando los documentos de respaldo correspondientes si aplica]:\n\n\n")
    r_desc.font.size = Pt(8.5)
    r_desc.font.color.rgb = RGBColor(100, 116, 139)

    add_callout(doc, "PLAZO LEGAL FATAL DE RESPUESTA (ARTÍCULO 11 LEY N° 19.628):",
                "La Empresa acusará recibo formal de esta solicitud y emitirá respuesta fundada dentro del plazo fatal de treinta (30) días corridos contado desde la recepción íntegra del formulario y la verificación fehaciente de la identidad del solicitante. Enviar este formulario firmado a: privacidad@empresa.cl.",
                bg_hex="FFFBEB")

    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.space_before = Pt(14)
    p_sig.paragraph_format.space_after = Pt(0)
    p_sig.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p_sig.add_run("_____________________________________________________\nFirma del Titular Solicitante  •  RUT: _____________________\nFecha: _____ / _____ / 2026")
    r.font.size = Pt(9)
    r.font.bold = True
    return doc


# =========================================================================
# DOC 7: TEST AUTODIAGNÓSTICO DPO
# =========================================================================
def build_doc_7():
    doc = create_base_doc(top=0.8, bottom=0.8, left=0.85, right=0.85)
    add_header_brand(doc, "Documento 7 Oficial  •  Formato Word Editable (.docx)")
    add_title(doc, "EVALUACIÓN Y TEST DE AUTODIAGNÓSTICO LEGAL\n¿NECESITA MI EMPRESA NOMBRAR UN DELEGADO DE PROTECCIÓN DE DATOS (DPO)?",
              "Criterios de Obligatoriedad y Régimen de Exención para Micro, Pequeñas y Medianas Empresas (MIPYMES)\nConforme a la Ley N° 21.719 que reforma la Ley N° 19.628 de Protección de Datos Personales de Chile")

    add_callout(doc, "DATOS DE LA EMPRESA EVALUADA:",
                "Empresa: [NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]\nRUT: [RUT EMPRESA]\nFecha de Evaluación: [FECHA ACTUAL]",
                bg_hex="F0F9FF")

    add_heading(doc, "1. MARCO LEGAL Y REGLA GENERAL: ¿ES OBLIGATORIO EL DPO PARA LAS PYMES?")
    add_body(doc, "NO, COMO REGLA GENERAL. La Ley N° 21.719 introduce la figura del Delegado de Protección de Datos (DPO u Oficial de Privacidad) inspirada en el estándar internacional (RGPD Art. 37). Sin embargo, el legislador chileno consagró que para las empresas privadas la designación es VOLUNTARIA, salvo que concurra alguna de las causales taxativas de excepción legal que se evalúan a continuación.")

    add_heading(doc, "2. TEST DE EVALUACIÓN RÁPIDA DE OBLIGATORIEDAD (4 PREGUNTAS)")
    add_body(doc, "Marque con una X la opción que corresponda a las operaciones habituales de su empresa:")

    table = doc.add_table(rows=5, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.columns[0].width = Inches(4.8)
    table.columns[1].width = Inches(0.85)
    table.columns[2].width = Inches(0.85)
    prevent_row_split(table)

    headers = ["Criterio de Evaluación Legal", "SÍ", "NO"]
    for i, h in enumerate(headers):
        c = table.cell(0, i)
        set_cell_background(c, "0F172A")
        set_cell_margins(c, top=80, bottom=80, left=90, right=90)
        p = c.paragraphs[0]
        if i > 0:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(h)
        r.font.name = 'Calibri'
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    questions = [
        ("1. ¿Su entidad es un órgano de la Administración del Estado, Municipalidad o empresa pública?", " ", "[ X ]"),
        ("2. ¿La actividad principal de su empresa consiste en operaciones que requieren una observación habitual y sistemática masiva de personas (ej: empresas de telecomunicaciones, bancos, burós de crédito)?", " ", "[ X ]"),
        ("3. ¿La actividad principal de su empresa consiste en el tratamiento masivo y a gran escala de datos sensibles de salud o condenas penales (ej: grandes hospitales, laboratorios farmacéuticos)?", " ", "[ X ]"),
        ("4. ¿El volumen de titulares tratados en su negocio supera habitualmente el 10% de la población del país?", " ", "[ X ]")
    ]

    for idx, (q, si, no) in enumerate(questions, start=1):
        bg = "F8FAFC" if idx % 2 == 0 else "FFFFFF"
        c0 = table.cell(idx, 0)
        set_cell_background(c0, bg)
        set_cell_margins(c0, top=60, bottom=60, left=80, right=80)
        p0 = c0.paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r0 = p0.add_run(q)
        r0.font.name = 'Calibri'
        r0.font.size = Pt(8.5)

        c1 = table.cell(idx, 1)
        set_cell_background(c1, bg)
        set_cell_margins(c1, top=60, bottom=60, left=40, right=40)
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p1.add_run(si)
        r1.font.size = Pt(8.5)

        c2 = table.cell(idx, 2)
        set_cell_background(c2, bg)
        set_cell_margins(c2, top=60, bottom=60, left=40, right=40)
        p2 = c2.paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(no)
        r2.font.size = Pt(8.5)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(16, 185, 129)

    add_heading(doc, "3. DICTAMEN Y CONCLUSIÓN JURÍDICA")
    add_body(doc, "Al haber respondido 'NO' a las cuatro preguntas del test, se certifica legalmente que la empresa NO se encuentra en ninguna de las causales taxativas de obligatoriedad y está 100% EXENTA de contratar o designar a un Delegado de Protección de Datos (DPO). Las funciones de coordinación y respuesta ante la Agencia pueden ser ejercidas internamente por la administración o gerencia general sin costo adicional.")

    add_signature_block(doc,
                        "[NOMBRE DEL REPRESENTANTE LEGAL]", "RUT N° [RUT REPRESENTANTE]\nGERENTE GENERAL / ADMINISTRADOR",
                        "[NOMBRE DE LA EMPRESA / RAZÓN SOCIAL]", "RUT N° [RUT EMPRESA]\nFECHA DE CERTIFICACIÓN: [FECHA ACTUAL]")

    return doc


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ASSETS_DIR, exist_ok=True)

    builders = [
        ("0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.docx", build_doc_0),
        ("1_Anexo_Laboral_Datos_Personales_Ley_21719.docx", build_doc_1),
        ("2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx", build_doc_2),
        ("3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx", build_doc_3),
        ("5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx", build_doc_5),
        ("6_Formulario_Solicitud_Derechos_ARCOP.docx", build_doc_6),
        ("7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx", build_doc_7)
    ]

    for filename, builder in builders:
        doc = builder()
        out_path = os.path.join(OUTPUT_DIR, filename)
        doc.save(out_path)
        print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")

        # Also copy to assets/ for direct HTTP downloads
        asset_path = os.path.join(ASSETS_DIR, filename)
        doc.save(asset_path)
        print(f"Copied to {asset_path}")

if __name__ == "__main__":
    main()
