#!/usr/bin/env python3
"""Construye 20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx (5 hojas operacionales),
lo inserta de forma idempotente en api/assets/Kit_Blindaje_Laboral_Pyme_2026.zip
y regenera api/assets/kit-base64.js.
"""
from __future__ import annotations

import base64
import datetime as dt
import io
import pathlib
import zipfile

import openpyxl
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = pathlib.Path(__file__).resolve().parent.parent
KIT_DIR = ROOT / 'api' / 'assets' / 'kit_pyme_files'
XLSX_PATH = KIT_DIR / '20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx'
ZIP_PATH = ROOT / 'api' / 'assets' / 'Kit_Blindaje_Laboral_Pyme_2026.zip'
B64_JS_PATH = ROOT / 'api' / 'assets' / 'kit-base64.js'
XLSX_ZIP_ENTRY = (
    'Kit_Blindaje_Laboral_Pyme_2026/04_Carpeta_Personal_Y_Auditoria_DT/'
    '20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx'
)

FILL_FOREST = PatternFill('solid', fgColor='00382E')
FILL_DEEP = PatternFill('solid', fgColor='00261F')
FILL_MINT = PatternFill('solid', fgColor='ECF5F2')
FILL_AMBER_INPUT = PatternFill('solid', fgColor='FFF3B0')
FILL_ZEBRA = PatternFill('solid', fgColor='F8FAFC')
FILL_WHITE = PatternFill('solid', fgColor='FFFFFF')
FILL_SECTION = PatternFill('solid', fgColor='F1F5F9')

FONT_TITLE = Font(name='Calibri', size=13, bold=True, color='FFFFFF')
FONT_SUB = Font(name='Calibri', size=9.5, bold=False, color='CBD5E1')
FONT_META_LBL = Font(name='Calibri', size=9.5, bold=True, color='00382E')
FONT_META_VAL = Font(name='Calibri', size=9.5, bold=True, color='111827')
FONT_HINT = Font(name='Calibri', size=9.5, italic=True, color='475569')
FONT_TH = Font(name='Calibri', size=9.5, bold=True, color='FFFFFF')
FONT_CODE = Font(name='Consolas', size=9.5, bold=True, color='00382E')
FONT_BODY = Font(name='Calibri', size=9.5, bold=False, color='111827')
FONT_BODY_BOLD = Font(name='Calibri', size=9.5, bold=True, color='111827')

BORDER_THIN = Side(style='thin', color='CBD5E1')
CELL_BORDER = Border(left=BORDER_THIN, right=BORDER_THIN, top=BORDER_THIN, bottom=BORDER_THIN)

FONT_OK = Font(name='Calibri', size=9.5, bold=True, color='065F46')
FILL_OK = PatternFill('solid', fgColor='ECFDF5')
FONT_WARN = Font(name='Calibri', size=9.5, bold=True, color='7A4F00')
FILL_WARN = PatternFill('solid', fgColor='FFF7E0')
FONT_RISK = Font(name='Calibri', size=9.5, bold=True, color='9F1239')
FILL_RISK = PatternFill('solid', fgColor='FFF1F2')


def setup_banner(ws, max_col: int, title: str, subtitle: str, hint: str, extra_label: str, extra_formula: str):
    last_col = get_column_letter(max_col)
    ws.views.sheetView[0].showGridLines = True
    ws.freeze_panes = 'A6'

    ws.merge_cells(f'A1:{last_col}1')
    ws['A1'] = title
    ws['A1'].font = FONT_TITLE
    ws['A1'].fill = FILL_FOREST
    ws['A1'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[1].height = 32

    ws.merge_cells(f'A2:{last_col}2')
    ws['A2'] = subtitle
    ws['A2'].font = FONT_SUB
    ws['A2'].fill = FILL_DEEP
    ws['A2'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[2].height = 20

    ws.merge_cells('A3:B3')
    ws['A3'] = 'Empresa / Razón Social:'
    ws['A3'].font = FONT_META_LBL
    ws['A3'].fill = FILL_MINT
    ws['A3'].alignment = Alignment(horizontal='left', vertical='center', indent=1)

    ws.merge_cells('C3:E3')
    ws['C3'] = "='Guía Rápida'!C6"
    ws['C3'].font = FONT_META_VAL
    ws['C3'].fill = FILL_MINT
    ws['C3'].alignment = Alignment(horizontal='left', vertical='center', indent=1)

    ws['F3'] = 'RUT:'
    ws['F3'].font = FONT_META_LBL
    ws['F3'].fill = FILL_MINT
    ws['F3'].alignment = Alignment(horizontal='right', vertical='center')

    ws['G3'] = "='Guía Rápida'!C7"
    ws['G3'].font = FONT_META_VAL
    ws['G3'].fill = FILL_MINT
    ws['G3'].alignment = Alignment(horizontal='left', vertical='center', indent=1)

    ws['H3'] = extra_label
    ws['H3'].font = FONT_META_LBL
    ws['H3'].fill = FILL_MINT
    ws['H3'].alignment = Alignment(horizontal='right', vertical='center')

    if max_col > 9:
        ws.merge_cells(f'I3:{last_col}3')
    ws['I3'] = extra_formula
    ws['I3'].font = FONT_META_VAL
    ws['I3'].fill = FILL_MINT
    ws['I3'].alignment = Alignment(horizontal='left', vertical='center', indent=1)

    for col in range(1, max_col + 1):
        ws.cell(3, col).border = CELL_BORDER
        if ws.cell(3, col).fill.fill_type is None:
            ws.cell(3, col).fill = FILL_MINT
    ws.row_dimensions[3].height = 22

    ws.merge_cells(f'A4:{last_col}4')
    ws['A4'] = hint
    ws['A4'].font = FONT_HINT
    ws['A4'].fill = FILL_ZEBRA
    ws['A4'].alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
    ws.row_dimensions[4].height = 22


def style_headers(ws, row: int, headers: list[str], widths: list[int]):
    ws.row_dimensions[row].height = 28
    for idx, (h, w) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row, idx, h)
        c.font = FONT_TH
        c.fill = FILL_FOREST
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        c.border = CELL_BORDER
        ws.column_dimensions[get_column_letter(idx)].width = w


def add_semaforo_rules(ws, rng: str, ok_words: list[str], warn_words: list[str], risk_words: list[str]):
    for w in ok_words:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator='equal', formula=[f'"{w}"'], fill=FILL_OK, font=FONT_OK)
        )
    for w in warn_words:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator='equal', formula=[f'"{w}"'], fill=FILL_WARN, font=FONT_WARN)
        )
    for w in risk_words:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator='equal', formula=[f'"{w}"'], fill=FILL_RISK, font=FONT_RISK)
        )


def build_guia_sheet(wb: openpyxl.Workbook):
    ws = wb.active
    ws.title = 'Guía Rápida'
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells('A1:F1')
    ws['A1'] = 'MATRIZ DE CONTROL LABORAL PYME 2026 · DIRECCIÓN DEL TRABAJO Y LEY KARIN'
    ws['A1'].font = FONT_TITLE
    ws['A1'].fill = FILL_FOREST
    ws['A1'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[1].height = 34

    ws.merge_cells('A2:F2')
    ws['A2'] = 'Hoja maestra de implementación: completa una vez los datos en amarillo y todo el libro se actualiza solo'
    ws['A2'].font = FONT_SUB
    ws['A2'].fill = FILL_DEEP
    ws['A2'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[2].height = 20

    ws.merge_cells('A4:F4')
    ws['A4'] = '1. IDENTIFICACIÓN DE LA EMPRESA (CELDAS AMARILLAS = EDITABLES)'
    ws['A4'].font = FONT_META_LBL
    ws['A4'].fill = FILL_MINT
    ws['A4'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[4].height = 24

    hoy = dt.date.today().strftime('%d/%m/%Y')
    meta_rows = [
        ('Razón Social / Nombre Empleador', '[RAZÓN SOCIAL EMPRESA]', 'Se enlaza automáticamente al encabezado de todas las hojas.'),
        ('RUT Empresa', '[RUT EMPRESA]', 'Ejemplo: 76.123.456-7.'),
        ('Representante Legal / Responsable', '[NOMBRE REPRESENTANTE LEGAL]', 'Persona encargada de firmar anexos y recibir notificaciones DT.'),
        ('Correo Canal Denuncias Ley Karin', '[CORREO_DENUNCIAS@EMPRESA.CL]', 'Canal interno obligatorio en el Protocolo Ley Karin (Ley 21.643).'),
        ('Rubro Principal', 'Comercio / Oficinas / Faena', 'Define qué carpeta del Módulo 3 del Kit debes priorizar.'),
        ('Fecha última revisión interna', hoy, 'Actualiza esta fecha cada vez que audites la carpeta.'),
    ]
    for offset, (lbl, val, desc) in enumerate(meta_rows, start=6):
        ws.merge_cells(f'A{offset}:B{offset}')
        c_lbl = ws.cell(offset, 1, lbl)
        c_lbl.font = FONT_BODY_BOLD
        c_lbl.fill = FILL_ZEBRA
        c_lbl.alignment = Alignment(horizontal='left', vertical='center', indent=1)

        ws.merge_cells(f'C{offset}:D{offset}')
        c_val = ws.cell(offset, 3, val)
        c_val.font = FONT_META_VAL
        c_val.fill = FILL_AMBER_INPUT
        c_val.alignment = Alignment(horizontal='left', vertical='center', indent=1)

        ws.merge_cells(f'E{offset}:F{offset}')
        c_desc = ws.cell(offset, 5, desc)
        c_desc.font = FONT_HINT
        c_desc.fill = FILL_WHITE
        c_desc.alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)

        for col in range(1, 7):
            ws.cell(offset, col).border = CELL_BORDER
        ws.row_dimensions[offset].height = 23

    # Section 2: Structure of workbook
    ws.merge_cells('A13:F13')
    ws['A13'] = '2. QUÉ ENCONTRARÁS EN CADA PESTAÑA Y CÓMO IMPLEMENTAR EL KIT EN 5 PASOS'
    ws['A13'].font = FONT_META_LBL
    ws['A13'].fill = FILL_MINT
    ws['A13'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[13].height = 24

    pasos = [
        ('Paso 1 · Pestaña Panel Resumen', 'Revisa el avance porcentual del checklist DT, cuántos trabajadores tienen Protocolo Ley Karin entregado y sus anexos de 42h firmados.'),
        ('Paso 2 · Pestaña Checklist DT 10 Puntos', 'Marca el estado de los documentos que suele pedir la Dirección del Trabajo (Arts. 9, 9 bis Mi DT, 33, 54, LRE >=5, RIOHS >=10, Ley Karin, Ley 40h).'),
        ('Paso 3 · Pestaña Trabajadores y 42h', 'Lista a cada persona contratada, registra si está en Mi DT dentro de los 15 días (Art. 9 bis), si firmó recibo del Protocolo Karin y si aplica anexo 42h.'),
        ('Paso 4 · Pestaña Matriz Riesgos Karin', 'Evalúa factores psicosociales y violencia externa (DS 44) asignando responsable, plazo y medidas de prevención.'),
        ('Paso 5 · Archivos Word (.docx)', 'Usa /personalizar-kit-blindaje en calculolaboral.cl (incluido con tu compra) o edita los .docx del ZIP en Microsoft Word antes de imprimir o firmar.'),
    ]
    for i, (titulo, detalle) in enumerate(pasos, start=14):
        ws.merge_cells(f'A{i}:B{i}')
        c1 = ws.cell(i, 1, titulo)
        c1.font = FONT_BODY_BOLD
        c1.fill = FILL_WHITE if i % 2 == 0 else FILL_ZEBRA
        c1.alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)

        ws.merge_cells(f'C{i}:F{i}')
        c2 = ws.cell(i, 3, detalle)
        c2.font = FONT_BODY
        c2.fill = FILL_WHITE if i % 2 == 0 else FILL_ZEBRA
        c2.alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
        for col in range(1, 7):
            ws.cell(i, col).border = CELL_BORDER
        ws.row_dimensions[i].height = 28

    # Section 3: Rubros guide
    ws.merge_cells('A20:F20')
    ws['A20'] = '3. ÁRBOL RÁPIDO POR RUBRO: QUÉ ARCHIVOS WORD PRIORIZAR'
    ws['A20'].font = FONT_META_LBL
    ws['A20'].fill = FILL_MINT
    ws['A20'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[20].height = 24

    rubros = [
        ('Todas las empresas (desde 1 trabajador)', 'Módulo 1 (01 a 05B Ley Karin) + Módulo 2 (06, 07 o 08 según jornada 42h; 09 si corrige Art. 22) + Módulo 4 (18 y 19 DT).'),
        ('Comercio, Gastronomía y Retail (Rama A)', 'Suma docs 10 (propinas Art. 64), 11 (violencia de clientes en Ley Karin) y 12 (turnos rotativos Art. 38) + Anexo 07 (6x1).'),
        ('Oficinas, Servicios y Tecnología (Rama B)', 'Suma docs 13 (teletrabajo Ley 21.220), 14 (desconexión digital 12h) y 15 (herramientas/internet Art. 41) + Anexo 06 o 08.'),
        ('Logística, Faenas y Terreno (Rama C)', 'Suma docs 16 (registro de asistencia en ruta) y 17 (viáticos y movilización no imponibles Art. 41).'),
    ]
    for idx, (r_tit, r_doc) in enumerate(rubros, start=21):
        ws.merge_cells(f'A{idx}:B{idx}')
        ws.cell(idx, 1, r_tit).font = FONT_BODY_BOLD
        ws.cell(idx, 1).fill = FILL_ZEBRA
        ws.cell(idx, 1).alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
        ws.merge_cells(f'C{idx}:F{idx}')
        ws.cell(idx, 3, r_doc).font = FONT_BODY
        ws.cell(idx, 3).fill = FILL_WHITE
        ws.cell(idx, 3).alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
        for col in range(1, 7):
            ws.cell(idx, col).border = CELL_BORDER
        ws.row_dimensions[idx].height = 26

    ws.merge_cells('A26:F26')
    ws['A26'] = (
        'Nota legal: Este libro Excel y los modelos Word son herramientas operativas de referencia basadas en el Código del Trabajo, '
        'la Ley N° 21.643 (Ley Karin), el DS N° 44 y la Ley N° 21.561 (40 Horas, tramo de 42 horas vigentes en 2026). '
        'No reemplazan el registro oficial en Mi DT, el pago en Previred ni asesoría jurídica particular.'
    )
    ws['A26'].font = FONT_HINT
    ws['A26'].fill = FILL_WARN
    ws['A26'].alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
    for col in range(1, 7):
        ws.cell(26, col).border = CELL_BORDER
    ws.row_dimensions[26].height = 36

    widths = [22, 16, 20, 20, 26, 26]
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w


def build_resumen_sheet(wb: openpyxl.Workbook):
    ws = wb.create_sheet('Panel Resumen')
    setup_banner(
        ws, 6,
        'PANEL RESUMEN DE CUMPLIMIENTO LABORAL 2026',
        'Indicadores automáticos conectados por fórmula a Checklist DT, Trabajadores y Matriz Ley Karin',
        'No edites las celdas de cálculo: actualiza el Checklist, el registro de Trabajadores y la Matriz y vuelve aquí.',
        'Avance DT:',
        '=IF(COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"<>No aplica")=0,0,COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"Cumple")/COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"<>No aplica"))'
    )
    ws['I3'].number_format = '0%'

    style_headers(ws, 5, ['Área de Control', 'Indicador', 'Cantidad / Valor', 'Meta / Base', 'Estado', 'Qué revisar si está en alerta'], [24, 34, 16, 16, 18, 42])

    kpis = [
        (
            'Checklist Inspección DT',
            'Puntos marcados como Cumple',
            '=COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"Cumple")',
            '=COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"Cumple")+COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"En curso")+COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"Pendiente")',
            '=IF(C6>=D6,"Al día",IF(C6>=D6*0.7,"En progreso","Atención"))',
            'Abre Checklist DT 10 Puntos y prioriza los marcados como Pendiente.'
        ),
        (
            'Checklist Inspección DT',
            'Puntos pendientes sin iniciar',
            '=COUNTIF(\'Checklist DT 10 Puntos\'!H6:H25,"Pendiente")',
            0,
            '=IF(C7=0,"Al día","Urgente")',
            'Cada punto pendiente tiene su archivo .docx asignado en la columna E.'
        ),
        (
            'Registro Mi DT (Art. 9 bis)',
            'Trabajadores ingresados en Mi DT',
            '=COUNTIF(\'Trabajadores y 42h\'!F6:F85,"Sí")',
            '=COUNTA(\'Trabajadores y 42h\'!B6:B85)',
            '=IF(D8=0,"Sin datos",IF(C8>=D8,"Al día","Atención"))',
            'Todo contrato nuevo debe registrarse en Mi DT dentro de 15 días.'
        ),
        (
            'Difusión Ley Karin',
            'Trabajadores con comprobante firmado',
            '=COUNTIF(\'Trabajadores y 42h\'!G6:G85,"Sí")',
            '=COUNTA(\'Trabajadores y 42h\'!B6:B85)',
            '=IF(D9=0,"Sin datos",IF(C9>=D9,"Al día","Urgente"))',
            'Emite y haz firmar el archivo 05 o 05B del Módulo Ley Karin.'
        ),
        (
            'Jornada 42h (Ley 21.561)',
            'Anexos 42h emitidos o exentos (part-time)',
            '=COUNTIF(\'Trabajadores y 42h\'!I6:I85,"Sí")+COUNTIF(\'Trabajadores y 42h\'!I6:I85,"No aplica")',
            '=COUNTA(\'Trabajadores y 42h\'!B6:B85)',
            '=IF(D10=0,"Sin datos",IF(C10>=D10,"Al día","Atención"))',
            'Si un trabajador excede 42h en 2026 o es falso Art. 22, usa Docs 06-09.'
        ),
        (
            'Matriz Riesgos Ley Karin',
            'Riesgos de nivel Alto aún Pendientes / En curso',
            '=COUNTIFS(\'Matriz Riesgos Karin (DS 44)\'!E6:E45,"Alto",\'Matriz Riesgos Karin (DS 44)\'!I6:I45,"<>Implementada")',
            0,
            '=IF(C11=0,"Al día","Urgente")',
            'Revisa los riesgos altos en la pestaña Matriz y asigna medida y plazo.'
        ),
        (
            'Reglas según dotación',
            'Total trabajadores activos en la tabla',
            '=COUNTA(\'Trabajadores y 42h\'!B6:B85)',
            'LRE >=5 · RIOHS >=10',
            '=IF(C12>=10,"Exige LRE + RIOHS",IF(C12>=5,"Exige LRE (Art. 62)","Microempresa (<5)"))',
            'Desde 5 trabajadores es obligatorio declarar el LRE; desde 10, Reglamento Interno.'
        ),
    ]

    for row_idx, item in enumerate(kpis, start=6):
        fill = FILL_WHITE if row_idx % 2 == 0 else FILL_ZEBRA
        for col_idx, val in enumerate(item, start=1):
            c = ws.cell(row_idx, col_idx, val)
            c.font = FONT_BODY_BOLD if col_idx in (3, 5) else FONT_BODY
            c.fill = fill
            c.border = CELL_BORDER
            c.alignment = Alignment(
                horizontal='center' if col_idx in (3, 4, 5) else 'left',
                vertical='center',
                wrap_text=True,
                indent=0 if col_idx in (3, 4, 5) else 1,
            )
        ws.row_dimensions[row_idx].height = 28

    add_semaforo_rules(ws, 'E6:E12', ['Al día', 'Microempresa (<5)'], ['En progreso', 'Atención', 'Exige LRE (Art. 62)', 'Sin datos'], ['Urgente', 'Exige LRE + RIOHS'])

    ws.merge_cells('A14:F14')
    ws['A14'] = 'RECORDATORIO NORMATIVO 2026: Jornada máxima ordinaria vigente = 42 horas semanales (desde 26 de abril de 2026) · Plazo envío carta despido = 3 días hábiles · Registro Mi DT = 15 días corridos.'
    ws['A14'].font = FONT_HINT
    ws['A14'].fill = FILL_MINT
    ws['A14'].alignment = Alignment(horizontal='left', vertical='center', indent=1, wrap_text=True)
    for col in range(1, 7):
        ws.cell(14, col).border = CELL_BORDER
    ws.row_dimensions[14].height = 28


def build_checklist_sheet(wb: openpyxl.Workbook):
    ws = wb.create_sheet('Checklist DT 10 Puntos')
    setup_banner(
        ws, 10,
        'CHECKLIST PREVENTIVO DE INSPECCIÓN DT (10 OBLIGACIONES CLAVE + GESTIÓN)',
        'Basado en el Código del Trabajo, Ley N° 21.643 (Ley Karin), DS N° 44 y Ley N° 21.561 (40 Horas)',
        'Elige el Estado en la columna H (Cumple / En curso / Pendiente / No aplica). El semáforo y el Panel Resumen se calculan solos.',
        'Cumplidos:',
        '=COUNTIF(H6:H25,"Cumple")&" / "&COUNTIF(H6:H25,"<>No aplica")'
    )

    headers = [
        'N°', 'Obligación / Documento en Carpeta', 'Aplica desde', 'Norma legal',
        'Archivo del Kit sugerido', 'Responsable', 'Última revisión', 'Estado',
        'Semáforo', 'Observaciones / Respaldo físico o digital'
    ]
    widths = [6, 36, 16, 20, 32, 20, 14, 15, 14, 34]
    style_headers(ws, 5, headers, widths)

    items = [
        (1, 'Contratos individuales firmados y actualizados', '1 trabajador', 'Art. 9 y 10 CT', 'Generador Contrato (sitio)', '[NOMBRE REPRESENTANTE LEGAL]', '', 'Pendiente', 'Verificar firma en 2 ejemplares (15 días máx. o 5 días si obra <30d).'),
        (2, 'Registro de contrato y término en portal Mi DT', '1 trabajador', 'Art. 9 bis CT / Ley 21.327', 'Módulo DT · Portal Mi DT', '[NOMBRE REPRESENTANTE LEGAL]', '', 'Pendiente', 'Plazo legal de 15 días corridos desde ingreso o término.'),
        (3, 'Anexos de reducción de jornada a 42 horas semanales', 'Jornada completa 2026', 'Ley 21.561 · Art. 11 CT', 'Docs 06, 07, 08 o 09 (.docx)', '[NOMBRE REPRESENTANTE LEGAL]', '', 'Pendiente', 'Mantener remuneración base sin descuentos.'),
        (4, 'Control de asistencia diario (libro, reloj o sistema DT)', '1 trabajador (no Art. 22)', 'Art. 33 CT · Res. Ex. 38', 'Doc 16 (si faena/terreno)', 'Administración', '', 'Pendiente', 'Sumar totales semanales y firma/validación si es libro físico.'),
        (5, 'Liquidaciones de sueldo mensuales con comprobante de pago', '1 trabajador', 'Art. 54 y 54 bis CT', 'Asistente / Generador sitio', 'Contabilidad / RRHH', '', 'Pendiente', 'Guardar transferencia bancaria o firma de recepción.'),
        (6, 'Planillas de cotizaciones pagadas (AFP, Salud, AFC, Mutual)', '1 trabajador', 'DL 3.500 · Art. 162 CT', 'Previred mensual', 'Contabilidad / RRHH', '', 'Pendiente', 'Al día antes de las 13:45 del día 13 (pago electrónico).'),
        (7, 'Protocolo Integral de Prevención Ley Karin implementado', '1 trabajador', 'Ley 21.643 · DS 44 · Circ. 3813', 'Doc 01 y Doc 11 (.docx)', '[NOMBRE REPRESENTANTE LEGAL]', '', 'Pendiente', 'Debe incluir canal de denuncias claro y medidas de resguardo.'),
        (8, 'Difusión y comprobante firmado de entrega Ley Karin', '1 trabajador', 'Art. 154 bis CT / Ley 21.643', 'Docs 05 y 05B (.docx)', '[NOMBRE REPRESENTANTE LEGAL]', '', 'Pendiente', 'Guardar acta firmada por cada persona trabajadora.'),
        (9, 'Matriz de riesgos psicosociales evaluada (CEAL-SM / DS 44)', '1 trabajador', 'DS 44 Mintrab · Ley 21.643', 'Doc 02 (.docx) + pestaña Matriz', 'Prevención / Admin.', '', 'Pendiente', 'Actualizar anualmente o tras un evento o denuncia.'),
        (10, 'Carpeta de feriados, permisos y comprobantes firmados', '1 trabajador', 'Arts. 67 a 70 CT', 'Asistente / Comprobante feriado', 'Administración', '', 'Pendiente', 'Cada feriado tomado requiere comprobante firmado en duplicado.'),
        (11, 'Libro de Remuneraciones Electrónico (LRE) en Mi DT', '5 o más trabajadores', 'Art. 62 CT · Ley 21.327', 'Declaración mensual Mi DT', 'Estudio Contable', '', 'No aplica', 'Cambiar a Pendiente o Cumple si la empresa alcanza 5 trabajadores.'),
        (12, 'Reglamento Interno de Orden, Higiene y Seguridad (RIOHS)', '10 o más trabajadores', 'Art. 153 CT', 'Docs 01 y 19 (guía)', 'Dirección / Asesoría', '', 'No aplica', 'Obligatorio desde 10 trabajadores permanentes (incluye Protocolo Karin).'),
    ]

    dv_estado = DataValidation(type='list', formula1='"Cumple,En curso,Pendiente,No aplica"', allow_blank=True)
    ws.add_data_validation(dv_estado)

    for row_offset, row_data in enumerate(items, start=6):
        n, obl, aplica, norma, arch, resp, frev, est, obs = row_data
        fill = FILL_WHITE if row_offset % 2 == 0 else FILL_ZEBRA
        vals = [
            n, obl, aplica, norma, arch, resp, frev, est,
            f'=IF(H{row_offset}="","",IF(H{row_offset}="Cumple","OK",IF(H{row_offset}="No aplica","N/A",IF(H{row_offset}="En curso","REVISAR","ALERTA"))))',
            obs,
        ]
        for col_idx, v in enumerate(vals, start=1):
            c = ws.cell(row_offset, col_idx, v)
            c.border = CELL_BORDER
            c.fill = FILL_AMBER_INPUT if col_idx == 8 else fill
            c.font = FONT_CODE if col_idx == 1 else (FONT_BODY_BOLD if col_idx in (2, 9) else FONT_BODY)
            c.alignment = Alignment(
                horizontal='center' if col_idx in (1, 7, 8, 9) else 'left',
                vertical='center',
                wrap_text=True,
                indent=0 if col_idx in (1, 7, 8, 9) else 1,
            )
        ws.row_dimensions[row_offset].height = 30

    # Extra blank rows 18..25 for company-specific audit items
    for row_offset in range(18, 26):
        fill = FILL_WHITE if row_offset % 2 == 0 else FILL_ZEBRA
        for col_idx in range(1, 11):
            c = ws.cell(row_offset, col_idx)
            c.border = CELL_BORDER
            c.fill = FILL_AMBER_INPUT if col_idx == 8 else fill
            c.font = FONT_BODY_BOLD if col_idx == 9 else FONT_BODY
            if col_idx == 9:
                c.value = f'=IF(H{row_offset}="","",IF(H{row_offset}="Cumple","OK",IF(H{row_offset}="No aplica","N/A",IF(H{row_offset}="En curso","REVISAR","ALERTA"))))'
            c.alignment = Alignment(horizontal='center' if col_idx in (1, 7, 8, 9) else 'left', vertical='center', wrap_text=True)
        ws.row_dimensions[row_offset].height = 24

    dv_estado.add('H6:H25')
    add_semaforo_rules(ws, 'H6:H25', ['Cumple'], ['En curso'], ['Pendiente'])
    add_semaforo_rules(ws, 'I6:I25', ['OK'], ['REVISAR', 'N/A'], ['ALERTA'])


def build_trabajadores_sheet(wb: openpyxl.Workbook):
    ws = wb.create_sheet('Trabajadores y 42h')
    setup_banner(
        ws, 12,
        'CONTROL POR TRABAJADOR · MI DT, LEY KARIN Y ANEXO 42 HORAS',
        'Seguimiento individual de carpeta laboral para evitar brechas al contratar o fiscalizar',
        'Reemplaza las 2 filas de ejemplo y agrega una fila por cada trabajador activo (hasta fila 85).',
        'Total activos:',
        '=COUNTA(B6:B85)'
    )

    headers = [
        'RUT', 'Nombre completo', 'Cargo', 'Fecha ingreso', 'Tipo contrato',
        'En Mi DT (Art. 9 bis)', 'Protocolo Karin', 'Jornada vigente',
        'Anexo 42h emitido', 'Anexo del Kit sugerido', 'Estado carpeta', 'Notas / Vencimiento plazo'
    ]
    widths = [14, 26, 20, 14, 15, 16, 15, 16, 16, 26, 15, 28]
    style_headers(ws, 5, headers, widths)

    samples = [
        ('18.234.567-8', 'Juan Pérez Soto (Ejemplo)', 'Vendedor Retail', '01/03/2025', 'Indefinido', 'Sí', 'Sí', '42h (6x1)', 'Sí', '07_Anexo_Reduccion_42h_6x1', 'Ejemplo Comercio 6x1'),
        ('19.876.543-2', 'María González Ruiz (Ejemplo)', 'Asistente Adm.', '15/06/2026', 'Plazo fijo', 'Sí', 'Pendiente', '42h (5x2)', 'No aplica', '06_Anexo_Reduccion_42h_5x2', 'Falta firmar recibo Doc 05 Ley Karin'),
    ]

    dv_contrato = DataValidation(type='list', formula1='"Indefinido,Plazo fijo,Obra o faena"', allow_blank=True)
    dv_si_pend = DataValidation(type='list', formula1='"Sí,Pendiente,No aplica"', allow_blank=True)
    dv_si_pend_2 = DataValidation(type='list', formula1='"Sí,Pendiente"', allow_blank=True)
    dv_jornada = DataValidation(type='list', formula1='"42h (5x2),42h (6x1),40h,Part-time <=30h,Art. 22 inc. 2"', allow_blank=True)
    for dv in (dv_contrato, dv_si_pend, dv_si_pend_2, dv_jornada):
        ws.add_data_validation(dv)

    for row_idx in range(6, 86):
        fill = FILL_WHITE if row_idx % 2 == 0 else FILL_ZEBRA
        sample = samples[row_idx - 6] if row_idx - 6 < len(samples) else None
        for col_idx in range(1, 13):
            c = ws.cell(row_idx, col_idx)
            c.border = CELL_BORDER
            c.fill = FILL_AMBER_INPUT if col_idx in (6, 7, 9) else fill
            c.font = FONT_BODY_BOLD if col_idx == 11 else FONT_BODY
            if col_idx == 11:
                c.value = (
                    f'=IF(B{row_idx}="","",IF(AND(F{row_idx}="Sí",G{row_idx}="Sí",'
                    f'OR(I{row_idx}="Sí",I{row_idx}="No aplica")),"Completa","Pendiente"))'
                )
            elif sample is not None:
                val = sample[col_idx - 1] if col_idx < 11 else sample[10]
                c.value = val
            c.alignment = Alignment(
                horizontal='center' if col_idx in (1, 4, 5, 6, 7, 8, 9, 11) else 'left',
                vertical='center',
                wrap_text=True,
                indent=0 if col_idx in (1, 4, 5, 6, 7, 8, 9, 11) else 1,
            )
        ws.row_dimensions[row_idx].height = 24

    dv_contrato.add('E6:E85')
    dv_si_pend.add('F6:F85')
    dv_si_pend_2.add('G6:G85')
    dv_jornada.add('H6:H85')
    dv_si_pend.add('I6:I85')
    add_semaforo_rules(ws, 'F6:G85', ['Sí'], ['No aplica'], ['Pendiente'])
    add_semaforo_rules(ws, 'I6:I85', ['Sí'], ['No aplica'], ['Pendiente'])
    add_semaforo_rules(ws, 'K6:K85', ['Completa'], [], ['Pendiente'])


def build_matriz_sheet(wb: openpyxl.Workbook):
    ws = wb.create_sheet('Matriz Riesgos Karin (DS 44)')
    setup_banner(
        ws, 9,
        'MATRIZ DE RIESGOS PSICOSOCIALES Y VIOLENCIA LABORAL (LEY KARIN · DS N° 44)',
        'Registro preventivo de situaciones de acoso laboral, sexual y violencia externa ejercida por terceros/clientes',
        'Evalúa cada área o puesto, define medidas concretas y lleva el seguimiento en la columna I (Estado).',
        'Riesgos Altos abiertos:',
        '=COUNTIFS(E6:E45,"Alto",I6:I45,"<>Implementada")'
    )

    headers = [
        'ID', 'Categoría (Ley 21.643 / DS 44)', 'Situación o factor de riesgo',
        'Área / Cargos expuestos', 'Nivel de riesgo', 'Medida preventiva / Resguardo',
        'Responsable', 'Plazo', 'Estado'
    ]
    widths = [10, 26, 36, 22, 14, 38, 20, 14, 15]
    style_headers(ws, 5, headers, widths)

    rows = [
        ('RK-01', 'Violencia externa de terceros', 'Agresiones verbales, amenazas o reclamos agresivos de clientes o público en caja/atención.', 'Ventas / Mesón / Despacho', 'Alto', 'Implementar cartel de trato respetuoso, botón o protocolo de derivación a jefatura y Doc 11.', '[NOMBRE REPRESENTANTE LEGAL]', 'Inmediato', 'Pendiente'),
        ('RK-02', 'Acoso laboral / Liderazgo', 'Instrucciones ambiguas, sobrecarga sistemática o trato humillante en supervisión diaria.', 'Todas las áreas / Jefaturas', 'Medio', 'Difundir Protocolo Ley Karin (Doc 01), capacitar en liderazgo respetuoso y fijar metas claras.', '[NOMBRE REPRESENTANTE LEGAL]', '30 días', 'En curso'),
        ('RK-03', 'Acoso sexual / Ambiente', 'Comentarios inapropiados, hostigamiento digital (WhatsApp/correo) o en turnos aislados.', 'Toda la empresa / Turnos tarde', 'Alto', 'Habilitar canal confidencial ([CORREO_DENUNCIAS@EMPRESA.CL]) y entregar comprobante Doc 05.', '[NOMBRE REPRESENTANTE LEGAL]', 'Inmediato', 'Pendiente'),
        ('RK-04', 'Desconexión y Teletrabajo', 'Mensajes o requerimientos fuera del horario pactado afectando descanso mínimo de 12 horas.', 'Oficina / Remoto / Híbrido', 'Medio', 'Anexo de Desconexión Digital 12h (Doc 14) y programar envíos de correo dentro de jornada.', 'Jefatura directa', '15 días', 'Pendiente'),
        ('RK-05', 'Trabajo en terreno / Ruta', 'Exposición a conflictos en entregas domiciliarias o con clientes sin apoyo presencial.', 'Choferes / Técnicos en ruta', 'Medio', 'Protocolo de retiro seguro ante amenaza y línea directa de soporte con supervisión.', 'Operaciones / Prevención', '30 días', 'Pendiente'),
        ('RK-06', 'Reserva de denuncias', 'Riesgo de filtración de identidad de denunciantes o acceso no autorizado a actas.', 'Administración / RRHH', 'Alto', 'Resguardar carpeta separada con acceso restringido y usar Acta Resguardo 3 días (Doc 04).', '[NOMBRE REPRESENTANTE LEGAL]', 'Inmediato', 'Pendiente'),
    ]

    dv_nivel = DataValidation(type='list', formula1='"Alto,Medio,Bajo"', allow_blank=True)
    dv_est = DataValidation(type='list', formula1='"Implementada,En curso,Pendiente"', allow_blank=True)
    ws.add_data_validation(dv_nivel)
    ws.add_data_validation(dv_est)

    for row_idx in range(6, 46):
        fill = FILL_WHITE if row_idx % 2 == 0 else FILL_ZEBRA
        data = rows[row_idx - 6] if row_idx - 6 < len(rows) else None
        for col_idx in range(1, 10):
            c = ws.cell(row_idx, col_idx)
            c.border = CELL_BORDER
            c.fill = FILL_AMBER_INPUT if col_idx in (5, 9) else fill
            c.font = FONT_CODE if col_idx == 1 else (FONT_BODY_BOLD if col_idx in (5, 9) else FONT_BODY)
            if data is not None:
                c.value = data[col_idx - 1]
            c.alignment = Alignment(
                horizontal='center' if col_idx in (1, 5, 8, 9) else 'left',
                vertical='center',
                wrap_text=True,
                indent=0 if col_idx in (1, 5, 8, 9) else 1,
            )
        ws.row_dimensions[row_idx].height = 34 if data is not None else 24

    dv_nivel.add('E6:E45')
    dv_est.add('I6:I45')
    add_semaforo_rules(ws, 'E6:E45', ['Bajo'], ['Medio'], ['Alto'])
    add_semaforo_rules(ws, 'I6:I45', ['Implementada'], ['En curso'], ['Pendiente'])


def build_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    build_guia_sheet(wb)
    build_resumen_sheet(wb)
    build_checklist_sheet(wb)
    build_trabajadores_sheet(wb)
    build_matriz_sheet(wb)

    KIT_DIR.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    wb.save(buf)
    data = buf.getvalue()
    XLSX_PATH.write_bytes(data)
    return data


def rebuild_zip_and_b64(xlsx_bytes: bytes):
    assert ZIP_PATH.exists(), f'Falta ZIP maestro: {ZIP_PATH}'
    with zipfile.ZipFile(ZIP_PATH, 'r') as zin:
        entries = [(info, zin.read(info.filename)) for info in zin.infolist() if info.filename != XLSX_ZIP_ENTRY]

    tmp_zip = ZIP_PATH.with_suffix('.zip.tmp')
    with zipfile.ZipFile(tmp_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for info, raw in entries:
            zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zi, raw)
        zout.writestr(XLSX_ZIP_ENTRY, xlsx_bytes)

    tmp_zip.replace(ZIP_PATH)
    zip_bytes = ZIP_PATH.read_bytes()
    b64 = base64.b64encode(zip_bytes).decode('ascii')
    js_content = (
        '// In-memory base64 package for Vercel Serverless Function (Kit Blindaje Laboral Pyme 2026)\n'
        f'module.exports = "{b64}";\n'
    )
    B64_JS_PATH.write_text(js_content, encoding='utf-8')
    print(f'OK: xlsx={len(xlsx_bytes)} bytes | zip={len(zip_bytes)} bytes | entries={len(entries) + 1} | b64_js={len(js_content)} bytes')


def main():
    xlsx_bytes = build_xlsx()
    rebuild_zip_and_b64(xlsx_bytes)


if __name__ == '__main__':
    main()
