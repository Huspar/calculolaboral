import os
import zipfile
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_shading(cell, color_hex):
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_header_banner(doc, title_text, subtitle_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "0F172A")
    set_cell_margins(cell, top=200, bottom=200, left=240, right=240)
    
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = p.add_run("CALCULOLABORAL.CL • FORMULARIO LEGAL EDITABLE 2026\n")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(8.5)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(56, 189, 248) # Sky blue
    
    run_title = p.add_run(title_text)
    run_title.font.name = "Arial"
    run_title.font.size = Pt(13)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(255, 255, 255)
    
    if subtitle_text:
        run_extra = p.add_run(f"\n{subtitle_text}")
        run_extra.font.name = "Arial"
        run_extra.font.size = Pt(9.5)
        run_extra.font.italic = True
        run_extra.font.color.rgb = RGBColor(203, 213, 225)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

def add_instruction_callout(doc, text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F8FAFC")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(f"📋 INSTRUCCIÓN PARA EL EMPLEADOR:\n{text}")
    run.font.name = "Arial"
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(71, 85, 105)
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

def create_model_1_art161(output_path):
    doc = Document()
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
        
    add_header_banner(doc, "CARTA DE AVISO DE TÉRMINO DE CONTRATO DE TRABAJO", "Artículo 161 Inciso Primero del Código del Trabajo (Necesidades de la Empresa)")
    
    add_instruction_callout(doc, 
        "1. Complete los campos entre corchetes [...] con la información real de su empresa y trabajador.\n"
        "2. Envíe copia física por Carta Certificada a través de Correos de Chile dentro de los 3 días hábiles siguientes a la separación (o 30 días de anticipación si no paga mes de aviso).\n"
        "3. Remita copia digital o presencial a la Inspección del Trabajo respectiva dentro del mismo plazo.\n"
        "4. Adjunte obligatoriamente el certificado de cotizaciones previsionales al día (Ley Bustos)."
    )
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("[CIUDAD], [DÍA] de [MES] de 2026.")
    r.font.name = "Arial"
    r.font.size = Pt(10)
    r.font.bold = True
    
    p_dest = doc.add_paragraph()
    p_dest.paragraph_format.space_after = Pt(14)
    p_dest.paragraph_format.line_spacing = 1.2
    runs_data = [
        ("Señor(a):\n", True),
        ("[NOMBRE COMPLETO DEL TRABAJADOR]\n", True),
        ("R.U.T.: [RUT DEL TRABAJADOR]\n", False),
        ("Cargo / Función: [CARGO QUE DESEMPEÑABA]\n", False),
        ("Domicilio contractual: [DIRECCIÓN REGISTRADA EN EL CONTRATO DE TRABAJO]\n", False),
        ("Ciudad / Comuna: [CIUDAD / COMUNA]\n", False),
        ("Presente.\n", True)
    ]
    for text, bold in runs_data:
        r = p_dest.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = bold
        
    body_paragraphs = [
        ("De nuestra consideración:", True),
        ("Por medio de la presente comunicación escrita, y en conformidad a lo establecido en el Artículo 161 Inciso Primero del Código del Trabajo, en relación con el Artículo 162 del mismo cuerpo legal, venimos en comunicar a usted el término del contrato de trabajo que lo vincula con la empresa [RAZÓN SOCIAL DE LA EMPRESA], R.U.T. [RUT EMPRESA], el cual se hará efectivo a contar del día [DÍA DE CESE] de [MES DE CESE] de 2026.", False),
        ("I. FUNDAMENTACIÓN TÉCNICA Y ECONÓMICA DE LA CAUSAL:", True),
        ("La causal legal invocada para fundamentar esta desvinculación es la de NECESIDADES DE LA EMPRESA, basada en razones técnicas y de modernización funcional derivadas de: [DETALLAR HECHOS OBJETIVOS, EJEMPLO: reestructuración global del departamento de operaciones / supresión definitiva del puesto de trabajo / baja sostenida en la demanda comercial del área / externalización de servicios no esenciales respaldada en balance financiero].", False),
        ("Específicamente, los hechos objetivos que justifican la decisión son los siguientes: [DESCRIBIR CON PRECISIÓN QUÉ TAREAS SE REORGANIZAN O POR QUÉ EL CARGO YA NO RESULTA INDISPENSABLE PARA LA CONTINUIDAD OPERATIVA]. La empresa deja expresa constancia de que este despido obedece estrictamente a motivos objetivos del establecimiento y en ningún caso a factores subjetivos del trabajador.", False),
        ("II. ESTADO DE COTIZACIONES PREVISIONALES (LEY BUSTOS):", True),
        ("Dando estricto cumplimiento a lo preceptuado en el inciso quinto del Artículo 162 del Código del Trabajo, se adjunta y acompaña formalmente a esta comunicación los certificados de cotizaciones previsionales emitidos por las instituciones de seguridad social correspondientes (AFP, FONASA o ISAPRE, y Administradora de Fondos de Cesantía AFC), que acreditan que todas sus imposiciones previsionales se encuentran íntegramente declaradas y pagadas hasta el último día del mes precedente al término de la relación laboral.", False),
        ("III. INDEMNIZACIONES Y FINIQUITO DE TRABAJO:", True),
        ("Conforme a la ley, dentro del plazo fatal de 10 (diez) días hábiles siguientes a la separación del trabajador, la empresa pondrá a su entera disposición en Notaría Pública el correspondiente Finiquito de Trabajo, en el cual se liquidarán detalladamente los siguientes haberes:", False),
        ("a) Remuneraciones adeudadas hasta el último día efectivamente laborado.\nb) Indemnización sustitutiva del aviso previo (en caso de no haberse otorgado con 30 días de anticipación).\nc) Indemnización por años de servicio y fracción superior a seis meses, conforme al Art. 163.\nd) Compensación en dinero por feriado legal y proporcional pendiente (Art. 73).\ne) Demás asignaciones o prestaciones contractuales devengadas a la fecha.", False),
        ("Agradeciendo sinceramente la colaboración y servicios prestados a nuestra organización durante el período de vigencia de su contrato, le saluda atentamente,", False)
    ]
    
    for text, bold in body_paragraphs:
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_after = Pt(8)
        r = p.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = bold
        
    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    
    # Signatures table
    tbl_sig = doc.add_table(rows=1, cols=2)
    tbl_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_sig.autofit = False
    tbl_sig.columns[0].width = Inches(3.2)
    tbl_sig.columns[1].width = Inches(3.2)
    
    c_emp = tbl_sig.cell(0, 0)
    p_emp = c_emp.paragraphs[0]
    p_emp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_emp.add_run("_________________________________________\n").font.name = "Arial"
    r_emp = p_emp.add_run("[NOMBRE REPRESENTANTE LEGAL]\nR.U.T.: [RUT REPRESENTANTE]\nRepresentante Legal\n[RAZÓN SOCIAL EMPRESA]\nR.U.T. Empresa: [RUT EMPRESA]")
    r_emp.font.name = "Arial"
    r_emp.font.size = Pt(8.5)
    
    c_tra = tbl_sig.cell(0, 1)
    p_tra = c_tra.paragraphs[0]
    p_tra.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tra.add_run("_________________________________________\n").font.name = "Arial"
    r_tra = p_tra.add_run("[NOMBRE DEL TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nCopia recepcionada personalmente el:\n____ / ____ / 2026   Hora: ____:____\n(Firma del Trabajador como acuse de recibo)")
    r_tra.font.name = "Arial"
    r_tra.font.size = Pt(8.5)
    
    doc.save(output_path)

def create_model_2_art160(output_path):
    doc = Document()
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
        
    add_header_banner(doc, "CARTA DE TÉRMINO DE CONTRATO POR CAUSAL DISCIPLINARIA", "Artículo 160 Número 3 del Código del Trabajo (Inasistencia Injustificada)")
    
    add_instruction_callout(doc, 
        "1. ATENCIÓN PLAZO LEGAL: La carta debe despacharse por Carta Certificada a Correos de Chile dentro de los 3 DÍAS HÁBILES siguientes a la separación del trabajador.\n"
        "2. Deberá remitir copia a la Inspección del Trabajo dentro del mismo plazo de 3 días.\n"
        "3. Conserve el Libro de Asistencia o reporte biométrico y el comprobante de seguimiento de Correos como prueba fundamental ante eventual reclamo en la DT."
    )
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("[CIUDAD], [DÍA] de [MES] de 2026.")
    r.font.name = "Arial"
    r.font.size = Pt(10)
    r.font.bold = True
    
    p_dest = doc.add_paragraph()
    p_dest.paragraph_format.space_after = Pt(14)
    p_dest.paragraph_format.line_spacing = 1.2
    runs_data = [
        ("Señor(a):\n", True),
        ("[NOMBRE COMPLETO DEL TRABAJADOR]\n", True),
        ("R.U.T.: [RUT DEL TRABAJADOR]\n", False),
        ("Cargo: [CARGO O FUNCIÓN]\n", False),
        ("Domicilio: [DIRECCIÓN REGISTRADA EN EL CONTRATO]\n", False),
        ("Comuna / Ciudad: [COMUNA / CIUDAD]\n", False),
        ("Presente.\n", True)
    ]
    for text, bold in runs_data:
        r = p_dest.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = bold
        
    body_paragraphs = [
        ("De nuestra consideración:", True),
        ("Por medio de la presente, comunicamos formalmente a usted que con fecha [DÍA DE TÉRMINO] de [MES DE TÉRMINO] de 2026, se ha resuelto poner término de manera inmediata y definitiva al contrato de trabajo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], R.U.T. [RUT EMPRESA].", False),
        ("I. CAUSAL LEGAL INVOCADA:", True),
        ("La causal legal aplicada para fundamentar este despido disciplinario es la establecida en el Artículo 160 Número 3 del Código del Trabajo, esto es: 'No concurrencia del trabajador a sus labores sin causa justificada durante dos días seguidos, dos lunes en el mes o un total de tres días durante igual período de tiempo'.", False),
        ("II. CIRCUNSTANCIAS Y HECHOS ESPECÍFICOS:", True),
        ("Los hechos concretos en que se sustenta esta determinación consisten en que usted no concurrió a prestar sus servicios habituales los siguientes días: [INDICAR DÍAS EXACTOS, EJEMPLO: lunes 12 y martes 13 de junio de 2026 / lunes 5 y lunes 19 de junio de 2026 / un total de tres días en el mes: días 4, 11 y 18], jornadas en las cuales debía cumplir funciones en nuestro establecimiento según su horario contractual convenido.", False),
        ("A la fecha de emisión y despacho de esta comunicación, usted no ha presentado licencia médica emitida por organismo de salud competente, ni ha justificado oportunamente ante esta administración la causa legítima de sus ausencias reiteradas, configurándose la causal legal descrita.", False),
        ("III. PREVISIÓN SOCIAL Y FINIQUITO:", True),
        ("En cumplimiento del Artículo 162 del Código del Trabajo, se acompaña a esta comunicación la certificación que acredita el pago íntegro y oportuno de sus cotizaciones previsionales de seguridad social (AFP, Salud y Seguro de Cesantía) correspondientes hasta el mes calendario anterior.", False),
        ("Hacemos presente que por tratarse de una causal imputable a falta del trabajador, no corresponde el pago de indemnización por años de servicio ni aviso previo. No obstante, su Finiquito de Trabajo con la liquidación de remuneraciones devengadas pendientes y compensación de vacaciones proporcionales (Art. 73) estará disponible en la Notaría [NOMBRE O NÚMERO DE NOTARÍA] dentro del plazo legal de 10 días hábiles.", False),
        ("Sin otro particular, le saluda atentamente,", False)
    ]
    
    for text, bold in body_paragraphs:
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_after = Pt(8)
        r = p.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = bold
        
    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    
    tbl_sig = doc.add_table(rows=1, cols=2)
    tbl_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_sig.autofit = False
    tbl_sig.columns[0].width = Inches(3.2)
    tbl_sig.columns[1].width = Inches(3.2)
    
    c_emp = tbl_sig.cell(0, 0)
    p_emp = c_emp.paragraphs[0]
    p_emp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_emp.add_run("_________________________________________\n").font.name = "Arial"
    r_emp = p_emp.add_run("[NOMBRE REPRESENTANTE LEGAL]\nR.U.T.: [RUT REPRESENTANTE]\nRepresentante Legal de\n[RAZÓN SOCIAL EMPRESA]")
    r_emp.font.name = "Arial"
    r_emp.font.size = Pt(8.5)
    
    c_tra = tbl_sig.cell(0, 1)
    p_tra = c_tra.paragraphs[0]
    p_tra.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tra.add_run("_________________________________________\n").font.name = "Arial"
    r_tra = p_tra.add_run("ACUSE DE RECIBO / COPIA TRABAJADOR\nNombre: [NOMBRE TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nFecha y hora de notificación:\n____ / ____ / 2026   ____:____ hrs.")
    r_tra.font.name = "Arial"
    r_tra.font.size = Pt(8.5)
    
    doc.save(output_path)

def create_checklist_doc(output_path):
    doc = Document()
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
        
    add_header_banner(doc, "CHECKLIST LEGAL Y PROTOCOLO DE DESVINCULACIÓN 2026", "Guía paso a paso para Pymes y Empleadores en Chile (Código del Trabajo y DT)")
    
    intro = doc.add_paragraph()
    r_intro = intro.add_run("Este documento resume los 5 pasos críticos que todo empleador o departamento de Recursos Humanos debe cumplir rigurosamente al emitir una carta de despido en Chile, evitando multas de la Inspección del Trabajo y demandas por despido injustificado (Art. 168).")
    r_intro.font.name = "Arial"
    r_intro.font.size = Pt(10)
    intro.paragraph_format.space_after = Pt(12)
    
    steps = [
        ("PASO 1: VERIFICAR Y DESCARGAR CERTIFICADOS DE COTIZACIONES (LEY BUSTOS)",
         "• Antes de entregar o enviar la carta, obtenga las planillas de Previred con timbre electrónico.\n"
         "• Todas las cotizaciones previsionales (AFP, Fonasa/Isapre, AFC y Seguro de Accidentes Laborales) deben estar totalmente PAGADAS hasta el último día del mes anterior al despido.\n"
         "• RIESGO GRAVE: Si hay deuda o solo declaración sin pago, el despido es NULO (el empleador debe seguir pagando remuneraciones hasta convalidar el despido)."),
        ("PASO 2: REDACCIÓN PRECISA Y OBJETIVA DE LOS HECHOS",
         "• Para Art. 161 (Necesidades de la Empresa): Exprese cifras, áreas afectadas o razones técnicas comprobables. Evite frases vagas como 'reorganización interna' sin fundamentación.\n"
         "• Para Art. 160 (Faltas Disciplinarias): Detalle fechas, horas y conductas exactas respaldadas en el libro de asistencia o actas."),
        ("PASO 3: RESPETAR LOS PLAZOS FATALES DE ENVÍO",
         "• Despido Art. 161: Con 30 días de anticipación; o de forma inmediata pagando la indemnización sustitutiva de aviso previo.\n"
         "• Despido Art. 160: Plazo máximo e improrrogable de 3 DÍAS HÁBILES desde que cesaron los servicios para despachar la carta certificada."),
        ("PASO 4: ENVÍO POR CARTA CERTIFICADA Y COMUNICACIÓN A LA DT",
         "• Despachar por carta certificada mediante Correos de Chile al domicilio contractual del trabajador.\n"
         "• Guardar el recibo de envío con número de seguimiento (voucher oficial).\n"
         "• Informar la carta a la Inspección del Trabajo por el portal Mi DT (empleadores) dentro del mismo plazo."),
        ("PASO 5: PREPARACIÓN Y PAGO DEL FINIQUITO EN 10 DÍAS HÁBILES (ART. 177)",
         "• El finiquito debe ponerse a disposición del trabajador y pagarse dentro de 10 días hábiles posteriores al término.\n"
         "• Debe contener la liquidación de sueldo, feriado proporcional y años de servicio (si corresponde).\n"
         "• Debe firmarse y ratificarse ante Notario Público, Ministro de Fe de la DT o vía electrónica en Mi DT.")
    ]
    
    for title, desc in steps:
        p_t = doc.add_paragraph()
        p_t.paragraph_format.space_before = Pt(8)
        p_t.paragraph_format.space_after = Pt(2)
        r_t = p_t.add_run(title)
        r_t.font.name = "Arial"
        r_t.font.size = Pt(10)
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(14, 165, 233)
        
        p_d = doc.add_paragraph()
        p_d.paragraph_format.space_after = Pt(8)
        p_d.paragraph_format.line_spacing = 1.2
        r_d = p_d.add_run(desc)
        r_d.font.name = "Arial"
        r_d.font.size = Pt(9.5)
        
    doc.save(output_path)

if __name__ == "__main__":
    os.makedirs("descargas", exist_ok=True)
    m1_path = "descargas/01_Modelo_Carta_Despido_Art161_Necesidades_Empresa_2026.docx"
    m2_path = "descargas/02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx"
    chk_path = "descargas/03_Checklist_Legal_Envio_Carta_Despido_y_Plazos_DT_2026.docx"
    zip_path = "descargas/Pack_Modelos_Cartas_Despido_Chile_2026.zip"
    
    print("Generando Modelo 1...")
    create_model_1_art161(m1_path)
    print("Generando Modelo 2...")
    create_model_2_art160(m2_path)
    print("Generando Checklist...")
    create_checklist_doc(chk_path)
    
    print("Comprimiendo en ZIP...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(m1_path, arcname="01_Modelo_Carta_Despido_Art161_Necesidades_Empresa_2026.docx")
        zipf.write(m2_path, arcname="02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx")
        zipf.write(chk_path, arcname="03_Checklist_Legal_Envio_Carta_Despido_y_Plazos_DT_2026.docx")
        
    print("Listo! Archivo generado:", zip_path, f"({os.path.getsize(zip_path)} bytes)")
