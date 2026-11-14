#!/usr/bin/env python3
"""Actualiza 4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx con 3 pestañas operacionales
(Control ARCOP 30d, Proveedores y DPA, Bitácora Brechas 72h) y regenera api/assets/kit-datos-base64.js.
"""
from __future__ import annotations

import base64
import datetime as dt
import io
import pathlib
import zipfile
from copy import copy

import openpyxl
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = pathlib.Path(__file__).resolve().parent.parent
KIT_DIR = ROOT / 'api' / 'assets' / 'kit_datos_files'
XLSX_PATH = KIT_DIR / '4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx'
B64_JS_PATH = ROOT / 'api' / 'assets' / 'kit-datos-base64.js'

ZIP_FILES = [
    '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf',
    '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.docx',
    '1_Anexo_Laboral_Datos_Personales_Ley_21719.docx',
    '2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx',
    '3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx',
    '4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx',
    '5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx',
    '6_Formulario_Solicitud_Derechos_ARCOP.docx',
    '7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx',
]

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
    ws['A3'] = 'Empresa Responsable:'
    ws['A3'].font = FONT_META_LBL
    ws['A3'].fill = FILL_MINT
    ws['A3'].alignment = Alignment(horizontal='left', vertical='center', indent=1)

    ws.merge_cells('C3:D3')
    ws['C3'] = "='📋 Registro RAT'!C3"
    ws['C3'].font = FONT_META_VAL
    ws['C3'].fill = FILL_MINT
    ws['C3'].alignment = Alignment(horizontal='left', vertical='center')

    ws['E3'] = 'RUT:'
    ws['E3'].font = FONT_META_LBL
    ws['E3'].fill = FILL_MINT
    ws['E3'].alignment = Alignment(horizontal='right', vertical='center')

    ws['F3'] = "='📋 Registro RAT'!F3"
    ws['F3'].font = FONT_META_VAL
    ws['F3'].fill = FILL_MINT
    ws['F3'].alignment = Alignment(horizontal='center', vertical='center')

    ws.merge_cells('G3:H3')
    ws['G3'] = extra_label
    ws['G3'].font = FONT_META_LBL
    ws['G3'].fill = FILL_MINT
    ws['G3'].alignment = Alignment(horizontal='right', vertical='center')

    if max_col > 9:
        ws.merge_cells(f'I3:{last_col}3')
    ws['I3'] = extra_formula
    ws['I3'].font = FONT_META_VAL
    ws['I3'].fill = FILL_MINT
    ws['I3'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[3].height = 26

    for c in range(1, max_col + 1):
        ws.cell(3, c).fill = FILL_MINT
        ws.cell(3, c).border = CELL_BORDER

    ws.merge_cells(f'A4:{last_col}4')
    ws['A4'] = hint
    ws['A4'].font = FONT_HINT
    ws['A4'].alignment = Alignment(horizontal='left', vertical='center', wrap_text=True, indent=1)
    ws.row_dimensions[4].height = 24


def style_headers(ws, headers: list[tuple[str, float, str]], row: int = 5):
    ws.row_dimensions[row].height = 32
    for idx, (label, width, _) in enumerate(headers, start=1):
        cell = ws.cell(row, idx, label)
        cell.font = FONT_TH
        cell.fill = FILL_FOREST
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = CELL_BORDER
        ws.column_dimensions[get_column_letter(idx)].width = width


def add_status_rules(ws, cell_range: str, green_values: list[str], amber_values: list[str], red_values: list[str]):
    for val in green_values:
        ws.conditional_formatting.add(cell_range, CellIsRule(operator='equal', formula=[f'"{val}"'], fill=FILL_OK, font=FONT_OK))
    for val in amber_values:
        ws.conditional_formatting.add(cell_range, CellIsRule(operator='equal', formula=[f'"{val}"'], fill=FILL_WARN, font=FONT_WARN))
    for val in red_values:
        ws.conditional_formatting.add(cell_range, CellIsRule(operator='equal', formula=[f'"{val}"'], fill=FILL_RISK, font=FONT_RISK))


def build_arcop_sheet(wb: openpyxl.Workbook):
    title = '⏳ Control ARCOP 30d'
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    ws.sheet_properties.tabColor = '0F5E4F'

    cols = [
        ('ID Solicitud', 13, 'center'),
        ('Fecha Recepción', 16, 'center'),
        ('Titular Solicitante', 24, 'left'),
        ('Relación', 15, 'center'),
        ('Derecho Ejercido', 22, 'left'),
        ('Canal de Ingreso', 18, 'left'),
        ('Vencimiento (+30d)', 18, 'center'),
        ('Días Restantes', 15, 'center'),
        ('Estado', 22, 'center'),
        ('Semáforo', 20, 'center'),
        ('Fecha Respuesta / Evidencia', 34, 'left'),
    ]
    setup_banner(
        ws, len(cols),
        'CONTROL DE SOLICITUDES ARCOP (PLAZO LEGAL 30 DÍAS CORRIDOS)',
        'Artículo 11 Ley N° 19.628 modificada por Ley N° 21.719 · Registro interno de vencimientos y respuestas',
        'Anota cada solicitud en una fila nueva (puedes editar o borrar las filas de ejemplo). Las columnas Vencimiento (+30d), Días Restantes y Semáforo se calculan automáticamente.',
        'Fecha de referencia (Hoy):', '=TODAY()'
    )
    ws['I3'].number_format = 'yyyy-mm-dd'
    style_headers(ws, cols)

    today = dt.date.today()
    ejemplos = [
        ('ARC-01', today - dt.timedelta(days=27), '[EJEMPLO] Camila Rojas', 'Ex-trabajador', 'Acceso', 'privacidad@tuempresa.cl', 'Pendiente', 'Recopilar carpeta y liquidaciones históricas antes de vencer el día 30.'),
        ('ARC-02', today - dt.timedelta(days=38), '[EJEMPLO] Comercial Norte', 'Cliente', 'Oposición', 'Formulario web', 'Respondida', f'Baja ejecutada el {(today - dt.timedelta(days=32)).isoformat()} · Respuesta enviada por correo.'),
    ]
    for r in range(6, 26):
        ws.row_dimensions[r].height = 30
        fill = FILL_ZEBRA if r % 2 == 0 else FILL_WHITE
        ex = ejemplos[r - 6] if r - 6 < len(ejemplos) else None
        vals = [
            ex[0] if ex else f'ARC-{r - 5:02d}',
            ex[1] if ex else None,
            ex[2] if ex else None,
            ex[3] if ex else None,
            ex[4] if ex else None,
            ex[5] if ex else None,
            f'=IF(B{r}="","",B{r}+30)',
            f'=IF(OR(B{r}="",I{r}="Respondida",I{r}="Rechazada con fundamento"),"—",G{r}-TODAY())',
            ex[6] if ex else None,
            f'=IF(B{r}="","",IF(OR(I{r}="Respondida",I{r}="Rechazada con fundamento"),"Al día (cerrada)",IF(G{r}-TODAY()<0,"Vencida",IF(G{r}-TODAY()<=5,"Urgente (<=5 días)","En plazo"))))',
            ex[7] if ex else None,
        ]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(r, c, v)
            cell.fill = FILL_AMBER_INPUT if (ex is None and c in (2, 3, 5, 9)) else fill
            cell.border = CELL_BORDER
            cell.font = FONT_CODE if c == 1 else (FONT_BODY_BOLD if c in (7, 8, 10) else FONT_BODY)
            cell.alignment = Alignment(horizontal=cols[c - 1][2], vertical='center', wrap_text=True)
            if c in (2, 7):
                cell.number_format = 'yyyy-mm-dd'
            elif c == 8:
                cell.number_format = '0'

    ws.merge_cells('A26:B26')
    ws['A26'] = 'Resumen rápido:'
    ws['A26'].font = FONT_META_LBL
    ws['A26'].fill = FILL_MINT
    ws['A26'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.merge_cells('C26:K26')
    ws['C26'] = '="Vencidas: "&COUNTIF(J6:J25,"Vencida")&"  ·  Urgentes (<=5d): "&COUNTIF(J6:J25,"Urgente (<=5 días)")&"  ·  En plazo: "&COUNTIF(J6:J25,"En plazo")&"  ·  Cerradas al día: "&COUNTIF(J6:J25,"Al día (cerrada)")'
    ws['C26'].font = FONT_META_VAL
    ws['C26'].fill = FILL_MINT
    ws.row_dimensions[26].height = 24
    for c in range(1, len(cols) + 1):
        ws.cell(26, c).fill = FILL_MINT
        ws.cell(26, c).border = CELL_BORDER

    dv_rel = DataValidation(type='list', formula1='"Trabajador,Ex-trabajador,Cliente,Prospecto,Proveedor,Otro"', allow_blank=True)
    dv_der = DataValidation(type='list', formula1='"Acceso,Rectificación,Supresión / Cancelación,Oposición,Portabilidad,Bloqueo"', allow_blank=True)
    dv_est = DataValidation(type='list', formula1='"Pendiente,En curso,Prórroga (+30d),Respondida,Rechazada con fundamento"', allow_blank=True)
    ws.add_data_validation(dv_rel); dv_rel.add('D6:D25')
    ws.add_data_validation(dv_der); dv_der.add('E6:E25')
    ws.add_data_validation(dv_est); dv_est.add('I6:I25')
    add_status_rules(ws, 'J6:J25', ['Al día (cerrada)', 'En plazo'], ['Urgente (<=5 días)'], ['Vencida'])
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1


def build_proveedores_sheet(wb: openpyxl.Workbook):
    title = '🤝 Proveedores y DPA'
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    ws.sheet_properties.tabColor = '00382E'

    cols = [
        ('ID', 10, 'center'),
        ('Proveedor / Encargado', 26, 'left'),
        ('Servicio', 22, 'left'),
        ('Datos que Trata', 30, 'left'),
        ('Titulares', 20, 'left'),
        ('País Alojamiento', 18, 'center'),
        ('Estado Cláusula DPA', 20, 'center'),
        ('Fecha Firma DPA', 16, 'center'),
        ('Contacto Privacidad', 26, 'left'),
        ('Semáforo', 18, 'center'),
    ]
    setup_banner(
        ws, len(cols),
        'INVENTARIO DE PROVEEDORES Y CONTRATOS DPA (ART. 15 BIS)',
        'Control de encargados de tratamiento externos (contador, remuneraciones, nube, control de asistencia)',
        'Lista aquí los proveedores externos que acceden a datos de tus trabajadores o clientes. Adjunta el Documento 3 (Cláusula DPA) a quienes aparezcan «Pendiente DPA».',
        'Resumen DPA:', '="Al día: "&COUNTIF(J6:J25,"Al día")&"  ·  Pendientes: "&COUNTIF(J6:J25,"Pendiente DPA")'
    )
    style_headers(ws, cols)

    ejemplos = [
        ('DPA-01', '[EJEMPLO] Estudio Contable Externo', 'Contabilidad y RR.HH.', 'Nombre, RUT, liquidaciones, cotizaciones', 'Trabajadores y honorarios', 'Chile', 'Pendiente', None, 'contacto@estudiocontable.cl'),
        ('DPA-02', '[EJEMPLO] Software de Remuneraciones', 'Emisión liquidaciones y LRE', 'Fichas laborales, sueldos, cuentas bancarias', 'Trabajadores activos y retiro', 'Chile / Brasil', 'Firmada', dt.date(2026, 10, 15), 'privacidad@proveedor-erp.cl'),
        ('DPA-03', '[EJEMPLO] Proveedor Hosting / Correo', 'Correo corporativo y web', 'Correos, formularios de clientes, respaldos', 'Clientes y trabajadores', 'EE.UU. / UE', 'En gestión', None, 'privacy@hosting-nube.com'),
        ('DPA-04', '[EJEMPLO] Reloj Control Res. 38 DT', 'Registro de jornada', 'RUT, marca horario, patrón biométrico/PIN', 'Trabajadores dependientes', 'Chile', 'Pendiente', None, 'soporte@relojcontrol.cl'),
    ]
    for r in range(6, 26):
        ws.row_dimensions[r].height = 30
        fill = FILL_ZEBRA if r % 2 == 0 else FILL_WHITE
        ex = ejemplos[r - 6] if r - 6 < len(ejemplos) else None
        vals = [
            ex[0] if ex else f'DPA-{r - 5:02d}',
            ex[1] if ex else None,
            ex[2] if ex else None,
            ex[3] if ex else None,
            ex[4] if ex else None,
            ex[5] if ex else None,
            ex[6] if ex else None,
            ex[7] if ex else None,
            ex[8] if ex else None,
            f'=IF(B{r}="","",IF(G{r}="Firmada","Al día",IF(G{r}="En gestión","En trámite","Pendiente DPA")))',
        ]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(r, c, v)
            cell.fill = FILL_AMBER_INPUT if (ex is None and c in (2, 3, 7)) else fill
            cell.border = CELL_BORDER
            cell.font = FONT_CODE if c == 1 else (FONT_BODY_BOLD if c == 10 else FONT_BODY)
            cell.alignment = Alignment(horizontal=cols[c - 1][2], vertical='center', wrap_text=True)
            if c == 8:
                cell.number_format = 'yyyy-mm-dd'

    dv_dpa = DataValidation(type='list', formula1='"Pendiente,En gestión,Firmada,No aplica"', allow_blank=True)
    ws.add_data_validation(dv_dpa); dv_dpa.add('G6:G25')
    add_status_rules(ws, 'J6:J25', ['Al día'], ['En trámite'], ['Pendiente DPA'])
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1


def build_brechas_sheet(wb: openpyxl.Workbook):
    title = '🚨 Bitácora Brechas 72h'
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    ws.sheet_properties.tabColor = 'BE123C'

    cols = [
        ('ID Incidente', 13, 'center'),
        ('Fecha Detección', 16, 'center'),
        ('Tipo de Incidente', 22, 'left'),
        ('Resumen y Causa Raíz', 30, 'left'),
        ('Datos Afectados', 24, 'left'),
        ('N° Titulares Aprox.', 16, 'center'),
        ('Riesgo Titulares', 16, 'center'),
        ('Meta 72h (+3 días)', 18, 'center'),
        ('¿Reportado a APDP?', 18, 'center'),
        ('¿Titulares Notif.?', 18, 'center'),
        ('Contención y Estado Final', 32, 'left'),
    ]
    setup_banner(
        ws, len(cols),
        'BITÁCORA DE INCIDENTES Y BRECHAS DE SEGURIDAD (META 72 HORAS)',
        'Artículo 14 sexies Ley N° 19.628 reformada por Ley N° 21.719 · Registro histórico para fiscalizaciones',
        'Registra todo incidente real o sospechado (incluso los contenidos sin riesgo alto) para dejar trazabilidad. Si involucra riesgo para los titulares, usa Documento 5 para notificar sin dilaciones indebidas.',
        'Total registrados:', '=COUNTA(B6:B20)'
    )
    style_headers(ws, cols)

    ejemplos = [
        ('BRE-01', dt.date(2026, 10, 20), '[EJEMPLO] Error envío correo', 'Envío de planilla sin copia oculta a 12 clientes.', 'Nombre y correo (datos comunes)', 12, 'Bajo', 'No aplica', 'Sí', 'Cerrado · Correo aclaratorio enviado y capacitación interna ejecutada.'),
    ]
    for r in range(6, 21):
        ws.row_dimensions[r].height = 32
        fill = FILL_ZEBRA if r % 2 == 0 else FILL_WHITE
        ex = ejemplos[r - 6] if r - 6 < len(ejemplos) else None
        vals = [
            ex[0] if ex else f'BRE-{r - 5:02d}',
            ex[1] if ex else None,
            ex[2] if ex else None,
            ex[3] if ex else None,
            ex[4] if ex else None,
            ex[5] if ex else None,
            ex[6] if ex else None,
            f'=IF(B{r}="","",B{r}+3)',
            ex[7] if ex else None,
            ex[8] if ex else None,
            ex[9] if ex else None,
        ]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(r, c, v)
            cell.fill = FILL_AMBER_INPUT if (ex is None and c in (2, 3, 7, 9)) else fill
            cell.border = CELL_BORDER
            cell.font = FONT_CODE if c == 1 else (FONT_BODY_BOLD if c in (7, 8) else FONT_BODY)
            cell.alignment = Alignment(horizontal=cols[c - 1][2], vertical='center', wrap_text=True)
            if c in (2, 8):
                cell.number_format = 'yyyy-mm-dd'

    dv_tipo = DataValidation(type='list', formula1='"Ciberataque / Phishing,Extravío o robo de equipo,Error envío correo / publicación,Acceso no autorizado proveedor,Otro incidente"', allow_blank=True)
    dv_riesgo = DataValidation(type='list', formula1='"Bajo,Medio,Alto"', allow_blank=True)
    dv_notif = DataValidation(type='list', formula1='"Sí (dentro de 72h),Sí (fuera de 72h),Pendiente,No aplica"', allow_blank=True)
    ws.add_data_validation(dv_tipo); dv_tipo.add('C6:C20')
    ws.add_data_validation(dv_riesgo); dv_riesgo.add('G6:G20')
    ws.add_data_validation(dv_notif); dv_notif.add('I6:J20')
    add_status_rules(ws, 'G6:G20', ['Bajo'], ['Medio'], ['Alto'])
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1


def update_guia_rapida(wb: openpyxl.Workbook):
    ws = wb['📌 Guía Rápida']
    if ws['A38'].value == '6. PESTAÑAS DE CONTROL OPERACIONAL (NUEVAS)' or any(
        str(ws.cell(r, 1).value or '').startswith('7. PESTAÑAS DE CONTROL') for r in range(38, ws.max_row + 1)
    ):
        return
    # Descombinar pie actual en fila 41 y agregar sección 7 + mover pie a fila 47
    disclaimer = ws['A41'].value
    disclaimer_font = copy(ws['A41'].font)
    disclaimer_align = copy(ws['A41'].alignment)
    sec_font = copy(ws['A38'].font)
    sec_fill = copy(ws['A38'].fill)
    body_font = copy(ws['A39'].font)

    if 'A41:H41' in [str(m) for m in ws.merged_cells.ranges]:
        ws.unmerge_cells('A41:H41')
    ws['A41'] = None

    ws.merge_cells('A41:H41')
    ws['A41'] = '7. PESTAÑAS DE CONTROL OPERACIONAL (ARCOP, PROVEEDORES DPA Y BRECHAS)'
    ws['A41'].font = sec_font
    ws['A41'].fill = sec_fill
    ws.row_dimensions[41].height = ws.row_dimensions[38].height or 22

    rows_info = [
        ('⏳ Control ARCOP 30d', 'Registra aquí cada solicitud de acceso, rectificación, eliminación, oposición o portabilidad. El archivo calcula los 30 días corridos de plazo legal y marca el semáforo en rojo/ámbar/verde.'),
        ('🤝 Proveedores y DPA', 'Controla qué proveedores externos (contador, software de remuneraciones, nube, reloj control) ya firmaron el Anexo DPA (Documento 3) y cuáles siguen pendientes.'),
        ('🚨 Bitácora Brechas 72h', 'Deja trazabilidad cronológica de cualquier incidente de seguridad o filtración, la meta operativa de 72 horas y si requirió aviso a la Agencia o a los titulares.'),
    ]
    for offset, (tab_lbl, desc) in enumerate(rows_info, start=42):
        ws.cell(offset, 1, tab_lbl).font = FONT_META_LBL
        ws.cell(offset, 1).alignment = Alignment(horizontal='left', vertical='center')
        ws.merge_cells(f'B{offset}:H{offset}')
        ws.cell(offset, 2, desc).font = body_font
        ws.cell(offset, 2).alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
        ws.row_dimensions[offset].height = 30
        for c in range(1, 9):
            ws.cell(offset, c).border = CELL_BORDER

    ws.merge_cells('A46:H46')
    ws['A46'] = disclaimer
    ws['A46'].font = disclaimer_font
    ws['A46'].alignment = disclaimer_align
    ws.row_dimensions[46].height = 24


def rebuild_zip_and_js():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name in ZIP_FILES:
            p = KIT_DIR / name
            if not p.exists():
                raise FileNotFoundError(f'Falta archivo del kit: {p}')
            zf.write(p, arcname=name)
    zip_data = buf.getvalue()
    (ROOT / 'api' / 'assets' / 'Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip').write_bytes(zip_data)
    b64 = base64.b64encode(zip_data).decode('ascii')
    B64_JS_PATH.write_text(f'module.exports = "{b64}";\n', encoding='utf-8')
    return len(zip_data), len(b64)


def main():
    wb = openpyxl.load_workbook(XLSX_PATH)
    update_guia_rapida(wb)
    build_arcop_sheet(wb)
    build_proveedores_sheet(wb)
    build_brechas_sheet(wb)
    wb.save(XLSX_PATH)
    zip_bytes, b64_len = rebuild_zip_and_js()
    print(f'Excel actualizado OK ({len(wb.sheetnames)} hojas: {wb.sheetnames})')
    print(f'kit-datos-base64.js actualizado OK (ZIP {zip_bytes} bytes -> base64 {b64_len} chars)')


if __name__ == '__main__':
    main()
