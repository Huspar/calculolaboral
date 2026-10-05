"""Genera los formatos gratuitos de liquidación de sueldo (Excel y Word).

Salida:
    descargas/formato-liquidacion-de-sueldo.xlsx  (con fórmulas, ejemplo con el ingreso mínimo)
    descargas/formato-liquidacion-de-sueldo.docx  (modelo en blanco para llenar a mano)

Valores 2026: ingreso mínimo $553.553, UTM $71.721, tramos del impuesto único en UTM
(los mismos de js/constants.js) y tasas AFP con comisión.

Uso: python tools/generar_formato_liquidacion.py
"""
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT_XLSX = ROOT / "descargas" / "formato-liquidacion-de-sueldo.xlsx"
OUT_DOCX = ROOT / "descargas" / "formato-liquidacion-de-sueldo.docx"

FOREST = "00382E"
AMBER = "FFB703"
SLATE = "475569"

IMM = 553553
UTM = 71721
UF = 40975.41
AFP = [
    ("Modelo", 0.1058), ("Uno", 0.1069), ("PlanVital", 0.1116), ("Habitat", 0.1127),
    ("Capital", 0.1144), ("Cuprum", 0.1144), ("Provida", 0.1145),
]
# (desde UTM, factor, rebaja UTM)
TRAMOS = [
    (0, 0, 0), (13.5, 0.04, 0.54), (30, 0.08, 1.74), (50, 0.135, 4.49),
    (70, 0.23, 11.14), (90, 0.304, 17.8), (120, 0.35, 23.32), (310, 0.40, 38.82),
]

MONEY = '"$"#,##0;-"$"#,##0'


def build_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "Liquidación"
    par = wb.create_sheet("Parámetros")

    # ---------- Hoja de parámetros ----------
    bold = Font(bold=True)
    par["A1"] = "Parámetros 2026 (actualízalos cuando cambien)"
    par["A1"].font = Font(bold=True, size=12, color=FOREST)
    par["A3"], par["B3"] = "UTM del mes", UTM
    par["A4"], par["B4"] = "UF del último día del mes", UF
    par["A5"], par["B5"] = "Tope imponible AFP y salud (UF)", 89.9
    par["A6"], par["B6"] = "Tope imponible seguro de cesantía (UF)", 135.1
    par["A7"], par["B7"] = "Ingreso mínimo mensual", IMM
    for r in (3, 4, 7):
        par[f"B{r}"].number_format = MONEY
    par["A9"], par["B9"] = "AFP", "Tasa total (10% + comisión)"
    par["A9"].font = par["B9"].font = bold
    for i, (name, rate) in enumerate(AFP, start=10):
        par[f"A{i}"], par[f"B{i}"] = name, rate
        par[f"B{i}"].number_format = "0.00%"
    afp_last = 9 + len(AFP)

    t0 = afp_last + 2
    par[f"A{t0}"], par[f"B{t0}"], par[f"C{t0}"] = "Impuesto único: desde (UTM)", "Factor", "Rebaja (UTM)"
    for c in "ABC":
        par[f"{c}{t0}"].font = bold
    for i, (desde, factor, rebaja) in enumerate(TRAMOS, start=t0 + 1):
        par[f"A{i}"], par[f"B{i}"], par[f"C{i}"] = desde, factor, rebaja
        par[f"B{i}"].number_format = "0.0%"
    tr_first, tr_last = t0 + 1, t0 + len(TRAMOS)
    par.column_dimensions["A"].width = 40
    par.column_dimensions["B"].width = 26
    par.column_dimensions["C"].width = 14

    # ---------- Hoja de liquidación ----------
    ws.column_dimensions["A"].width = 44
    ws.column_dimensions["B"].width = 22
    ws.sheet_view.showGridLines = False

    head_fill = PatternFill("solid", fgColor=FOREST)
    sect_fill = PatternFill("solid", fgColor="E8F0EE")
    total_fill = PatternFill("solid", fgColor="FFF4D6")
    input_fill = PatternFill("solid", fgColor="FFFBEA")
    thin = Side(style="thin", color="CBD5E1")
    box = Border(top=thin, bottom=thin, left=thin, right=thin)

    ws.merge_cells("A1:B1")
    ws["A1"] = "LIQUIDACIÓN DE SUELDO"
    ws["A1"].font = Font(bold=True, size=14, color="FFFFFF")
    ws["A1"].fill = head_fill
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 26
    ws.merge_cells("A2:B2")
    ws["A2"] = "Las celdas amarillas se llenan a mano. El resto se calcula solo."
    ws["A2"].font = Font(italic=True, size=9, color=SLATE)

    row = 4

    def section(title):
        nonlocal row
        ws.merge_cells(f"A{row}:B{row}")
        ws[f"A{row}"] = title
        ws[f"A{row}"].font = Font(bold=True, color=FOREST)
        ws[f"A{row}"].fill = sect_fill
        row += 1

    def line(label, value=None, formula=None, money=True, entry=False, strong=False, fill=None):
        nonlocal row
        ws[f"A{row}"] = label
        cell = ws[f"B{row}"]
        cell.value = formula if formula is not None else value
        if money:
            cell.number_format = MONEY
        cell.alignment = Alignment(horizontal="right")
        for c in (ws[f"A{row}"], cell):
            c.border = box
            if strong:
                c.font = Font(bold=True)
            if fill:
                c.fill = fill
        if entry:
            cell.fill = input_fill
        ref = f"B{row}"
        row += 1
        return ref

    section("Datos del empleador")
    line("Razón social", "", money=False, entry=True)
    line("RUT empleador", "", money=False, entry=True)
    line("Dirección", "", money=False, entry=True)
    row += 1

    section("Datos del trabajador")
    line("Nombre completo", "", money=False, entry=True)
    line("RUT trabajador", "", money=False, entry=True)
    line("Cargo", "", money=False, entry=True)
    line("Fecha de ingreso", "", money=False, entry=True)
    contrato = line("Tipo de contrato", "Indefinido", money=False, entry=True)
    afp = line("AFP", "Modelo", money=False, entry=True)
    salud = line("Sistema de salud", "Fonasa", money=False, entry=True)
    isapre = line("Plan Isapre pactado en pesos (si aplica)", 0, entry=True)
    line("Período (mes y año)", "", money=False, entry=True)
    line("Días trabajados", 30, money=False, entry=True)
    row += 1

    dv_contrato = DataValidation(type="list", formula1='"Indefinido,Plazo fijo"', allow_blank=False)
    dv_afp = DataValidation(type="list", formula1=f"='Parámetros'!$A$10:$A${afp_last}", allow_blank=False)
    dv_salud = DataValidation(type="list", formula1='"Fonasa,Isapre"', allow_blank=False)
    for dv, ref in ((dv_contrato, contrato), (dv_afp, afp), (dv_salud, salud)):
        ws.add_data_validation(dv)
        dv.add(ref)

    section("Haberes imponibles")
    base = line("Sueldo base", IMM, entry=True)
    grat = line("Gratificación", 0, entry=True)
    hhee = line("Horas extra", 0, entry=True)
    bonos = line("Comisiones y bonos", 0, entry=True)
    imponible = line("Total imponible", formula=f"=SUM({base}:{bonos})", strong=True)
    row += 1

    section("Haberes no imponibles")
    col = line("Colación", 0, entry=True)
    line("Movilización", 0, entry=True)
    via = line("Viáticos", 0, entry=True)
    no_imp = line("Total no imponible", formula=f"=SUM({col}:{via})", strong=True)
    haberes = line("TOTAL HABERES", formula=f"={imponible}+{no_imp}", strong=True, fill=total_fill)
    row += 1

    tope = "'Parámetros'!$B$5*'Parámetros'!$B$4"
    tope_ces = "'Parámetros'!$B$6*'Parámetros'!$B$4"
    section("Descuentos legales")
    d_afp = line(
        "AFP (10% + comisión)",
        formula=f"=ROUND(MIN({imponible},{tope})*VLOOKUP({afp},'Parámetros'!$A$10:$B${afp_last},2,FALSE),0)",
    )
    salud7 = f"ROUND(MIN({imponible},{tope})*0.07,0)"
    d_salud = line(
        "Salud (7% Fonasa o plan Isapre)",
        formula=f'=IF({salud}="Isapre",MAX({salud7},{isapre}),{salud7})',
    )
    d_ces = line(
        "Seguro de cesantía (0,6% si es indefinido)",
        formula=f'=IF({contrato}="Indefinido",ROUND(MIN({imponible},{tope_ces})*0.006,0),0)',
    )
    rli = line(
        "Renta tributable (base del impuesto)",
        formula=f"={imponible}-{d_afp}-MIN({d_salud},{salud7})-{d_ces}",
    )
    utm = "'Parámetros'!$B$3"
    tramos_a = f"'Parámetros'!$A${tr_first}:$A${tr_last}"
    tramos_b = f"'Parámetros'!$B${tr_first}:$B${tr_last}"
    tramos_c = f"'Parámetros'!$C${tr_first}:$C${tr_last}"
    d_imp = line(
        "Impuesto único de segunda categoría",
        formula=(
            f"=MAX(0,ROUND({rli}*LOOKUP({rli}/{utm},{tramos_a},{tramos_b})"
            f"-LOOKUP({rli}/{utm},{tramos_a},{tramos_c})*{utm},0))"
        ),
    )
    row += 1

    section("Otros descuentos")
    ant = line("Anticipos", 0, entry=True)
    otros = line("Otros descuentos autorizados", 0, entry=True)
    descuentos = line(
        "TOTAL DESCUENTOS",
        formula=f"={d_afp}+{d_salud}+{d_ces}+{d_imp}+{ant}+{otros}",
        strong=True,
        fill=total_fill,
    )
    row += 1
    liquido = line("ALCANCE LÍQUIDO A PAGAR", formula=f"={haberes}-{descuentos}", strong=True)
    ws[liquido].fill = PatternFill("solid", fgColor=AMBER)
    ws[liquido.replace("B", "A")].fill = PatternFill("solid", fgColor=AMBER)
    row += 2

    ws.merge_cells(f"A{row}:B{row}")
    ws[f"A{row}"] = "Certifico que he recibido de mi empleador, a mi entera satisfacción, el alcance líquido de la presente liquidación."
    ws[f"A{row}"].alignment = Alignment(wrap_text=True)
    ws[f"A{row}"].font = Font(size=9, color=SLATE)
    ws.row_dimensions[row].height = 30
    row += 3
    ws[f"A{row}"] = "______________________________"
    ws[f"B{row}"] = "______________________"
    row += 1
    ws[f"A{row}"] = "Firma del trabajador"
    ws[f"B{row}"] = "Fecha"
    row += 2
    ws.merge_cells(f"A{row}:B{row}")
    ws[f"A{row}"] = "Formato gratuito de calculolaboral.cl/liquidacion-de-sueldo. Es un modelo de referencia; revisa los valores con tu contrato."
    ws[f"A{row}"].font = Font(size=8, italic=True, color=SLATE)

    ws.print_area = f"A1:B{row}"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    wb.save(OUT_XLSX)


def _shade(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def build_docx():
    doc = Document()
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(1.8)
        s.left_margin = s.right_margin = Cm(2)
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("LIQUIDACIÓN DE SUELDO")
    r.bold = True
    r.font.size = Pt(15)
    r.font.color.rgb = RGBColor.from_string(FOREST)
    p = doc.add_paragraph("Período: ____________________ de 20____")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    def table(title, rows, amounts=True):
        h = doc.add_paragraph()
        hr = h.add_run(title.upper())
        hr.bold = True
        hr.font.size = Pt(9.5)
        hr.font.color.rgb = RGBColor.from_string(FOREST)
        h.paragraph_format.space_before = Pt(8)
        h.paragraph_format.space_after = Pt(2)
        tb = doc.add_table(rows=0, cols=2)
        tb.style = "Table Grid"
        tb.alignment = WD_TABLE_ALIGNMENT.CENTER
        for label in rows:
            strong = label.isupper()
            cells = tb.add_row().cells
            cells[0].width = Cm(11)
            cells[1].width = Cm(6)
            run = cells[0].paragraphs[0].add_run(label)
            run.bold = strong
            cells[1].paragraphs[0].add_run("$" if amounts else "")
            cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT if amounts else WD_ALIGN_PARAGRAPH.LEFT
            if strong:
                _shade(cells[0], "FFF4D6")
                _shade(cells[1], "FFF4D6")

    table("Datos del empleador", ["Razón social", "RUT", "Dirección"], amounts=False)
    table(
        "Datos del trabajador",
        ["Nombre completo", "RUT", "Cargo", "Fecha de ingreso", "Tipo de contrato",
         "AFP", "Sistema de salud (Fonasa o Isapre)", "Días trabajados"],
        amounts=False,
    )
    table("Haberes imponibles", ["Sueldo base", "Gratificación", "Horas extra", "Comisiones y bonos", "TOTAL IMPONIBLE"])
    table("Haberes no imponibles", ["Colación", "Movilización", "Viáticos", "TOTAL NO IMPONIBLE", "TOTAL HABERES"])
    table(
        "Descuentos",
        ["AFP (10% + comisión)", "Salud (7% Fonasa o plan Isapre)", "Seguro de cesantía (0,6% contrato indefinido)",
         "Impuesto único de segunda categoría", "Anticipos", "Otros descuentos autorizados", "TOTAL DESCUENTOS"],
    )
    table("Resultado", ["ALCANCE LÍQUIDO A PAGAR"])

    doc.add_paragraph()
    c = doc.add_paragraph(
        "Certifico que he recibido de mi empleador, a mi entera satisfacción, el alcance líquido "
        "de la presente liquidación y que no tengo cargo ni cobro alguno que hacer por los conceptos que comprende."
    )
    c.runs[0].font.size = Pt(9)
    doc.add_paragraph()
    doc.add_paragraph()
    f = doc.add_table(rows=2, cols=2)
    f.alignment = WD_TABLE_ALIGNMENT.CENTER
    f.cell(0, 0).text = "______________________________"
    f.cell(0, 1).text = "______________________________"
    f.cell(1, 0).text = "Firma del empleador"
    f.cell(1, 1).text = "Firma del trabajador"
    for i in range(2):
        for j in range(2):
            f.cell(i, j).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()
    n = doc.add_paragraph(
        "Formato gratuito de calculolaboral.cl/liquidacion-de-sueldo. Es un modelo de referencia: "
        "los montos dependen de tu contrato, tu AFP y tu sistema de salud. "
        "Puedes calcular los tuyos en calculolaboral.cl/sueldo_liquido."
    )
    n.runs[0].font.size = Pt(8)
    n.runs[0].italic = True
    n.runs[0].font.color.rgb = RGBColor.from_string(SLATE[0:6])
    doc.core_properties.title = "Formato de liquidación de sueldo"
    doc.core_properties.author = "Cálculo Laboral"
    doc.save(OUT_DOCX)


if __name__ == "__main__":
    build_xlsx()
    build_docx()
    print(f"OK: {OUT_XLSX.relative_to(ROOT)} y {OUT_DOCX.relative_to(ROOT)}")
