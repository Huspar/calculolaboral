"""Formato común de los documentos Word que entrega el sitio (kits, packs y modelos gratuitos).

Principio: la hoja de instrucciones (marca, guía de uso, advertencias) va sola en la página 1 y el
documento de trabajo (carta, anexo, acta) empieza limpio en la página 2, sin marca ni notas internas,
para poder enviarlo o firmarlo tal cual. Los campos por completar se resaltan en amarillo.
"""
import copy

import docx
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.text.run import Run

BRAND = '00382E'
W_P, W_R, W_T, W_BR, W_RPR, W_TBL = qn('w:p'), qn('w:r'), qn('w:t'), qn('w:br'), qn('w:rPr'), qn('w:tbl')


# ------------------------------------------------------------------ resaltado de campos [ ... ]
def _segments(text):
    """Parte un texto en (fragmento, es_campo). Un campo es un bloque [ ... ] con corchetes balanceados."""
    out, buf, depth, start = [], '', 0, None
    for i, ch in enumerate(text):
        if ch == '[':
            if depth == 0:
                if buf:
                    out.append((buf, False))
                buf = ''
            depth += 1
            buf += ch
        elif ch == ']' and depth > 0:
            buf += ch
            depth -= 1
            if depth == 0:
                out.append((buf, True))
                buf = ''
        else:
            buf += ch
    if buf:
        out.append((buf, False))
    return out


def _highlight_run(r_el, paragraph):
    """Divide un run en runs más pequeños y resalta en amarillo los campos [ ... ]. Devuelve cuántos resaltó."""
    kids = [k for k in r_el if k.tag != W_RPR]
    if not any(k.tag == W_T and k.text and '[' in k.text for k in kids):
        return 0
    rpr = r_el.find(W_RPR)
    new_runs, count = [], 0

    def make(children, highlight):
        r = OxmlElement('w:r')
        if rpr is not None:
            r.append(copy.deepcopy(rpr))
        for c in children:
            r.append(c)
        if highlight:
            Run(r, paragraph).font.highlight_color = WD_COLOR_INDEX.YELLOW
        return r

    for k in kids:
        if k.tag == W_T and k.text:
            for seg, es_campo in _segments(k.text):
                t = OxmlElement('w:t')
                t.text = seg
                t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                new_runs.append(make([t], es_campo))
                count += 1 if es_campo else 0
        else:
            new_runs.append(make([copy.deepcopy(k)], False))
    parent = r_el.getparent()
    idx = parent.index(r_el)
    parent.remove(r_el)
    for j, nr in enumerate(new_runs):
        parent.insert(idx + j, nr)
    return count


def highlight_fields(doc, after=None):
    """Resalta los campos [ ... ] de todo el cuerpo que viene después del elemento `after` (o de todo el cuerpo)."""
    body = doc.element.body
    started = after is None
    total = 0
    for top in list(body):
        if not started:
            if top is after:
                started = True
            continue
        for p_el in list(top.iter(W_P)):
            par = Paragraph(p_el, doc)
            for r_el in list(p_el.findall(W_R)):
                total += _highlight_run(r_el, par)
    return total


# ------------------------------------------------------------------ hoja de instrucciones + documento limpio
def section_break_paragraph(doc):
    """Párrafo que cierra la sección 1 (hoja de instrucciones): lleva una copia del sectPr final."""
    final = doc.element.body.find(qn('w:sectPr'))
    p = OxmlElement('w:p')
    ppr = OxmlElement('w:pPr')
    ppr.append(copy.deepcopy(final))
    p.append(ppr)
    return p


def unlink_final_footer(doc):
    """La sección del documento de trabajo no hereda el pie de página de la hoja de instrucciones."""
    final = doc.element.body.find(qn('w:sectPr'))
    for ref in final.findall(qn('w:footerReference')):
        final.remove(ref)
    doc.sections[-1].footer.is_linked_to_previous = False


def title_paragraph(text, font='Calibri', size=26, color=BRAND):
    """Título centrado del documento de trabajo (la hoja de instrucciones ya lo lleva en el encabezado)."""
    p = OxmlElement('w:p')
    ppr = OxmlElement('w:pPr')
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), '0')
    spacing.set(qn('w:after'), '200')
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'center')
    ppr.append(spacing)
    ppr.append(jc)
    p.append(ppr)
    r = OxmlElement('w:r')
    rpr = OxmlElement('w:rPr')
    fonts = OxmlElement('w:rFonts')
    fonts.set(qn('w:ascii'), font)
    fonts.set(qn('w:hAnsi'), font)
    rpr.append(fonts)
    rpr.append(OxmlElement('w:b'))
    col = OxmlElement('w:color')
    col.set(qn('w:val'), color)
    rpr.append(col)
    sz = OxmlElement('w:sz')
    sz.set(qn('w:val'), str(size))
    rpr.append(sz)
    r.append(rpr)
    t = OxmlElement('w:t')
    t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    r.append(t)
    p.append(r)
    return p


def is_kit_layout(doc):
    kids = [k for k in doc.element.body.iterchildren() if not k.tag.endswith('sectPr')]
    if len(kids) < 5 or kids[0].tag != W_TBL or kids[2].tag != W_TBL:
        return False
    head, box = Table(kids[0], doc), Table(kids[2], doc)
    return len(head.columns) == 2 and len(box.columns) == 1 and len(box.rows) == 1


def has_split(doc):
    """¿Ya tiene la hoja de instrucciones separada (dos secciones)?"""
    return len(doc.sections) > 1


def split_kit_doc(doc, titulo=None):
    """Documentos de los kits: [encabezado][guía de uso][cuerpo] -> hoja de instrucciones + documento limpio con su título."""
    if has_split(doc) or not is_kit_layout(doc):
        return False
    body = doc.element.body
    kids = [k for k in body.iterchildren() if not k.tag.endswith('sectPr')]
    head, box = kids[0], kids[2]
    if titulo is None:
        titulo = Table(head, doc).cell(0, 0).paragraphs[1].text.strip()
    # la nota de versión / modelo de referencia pasa a la hoja de instrucciones
    last = kids[-1]
    nota = None
    if last.tag == W_P and Paragraph(last, doc).text.strip().startswith('Versión 20'):
        nota = last
        body.remove(last)
    sect_p = section_break_paragraph(doc)
    if nota is not None:
        box.addnext(nota)
        nota.addnext(sect_p)
    else:
        box.addnext(sect_p)
    sect_p.addnext(title_paragraph(titulo))
    unlink_final_footer(doc)
    highlight_fields(doc, after=sect_p)
    return True
