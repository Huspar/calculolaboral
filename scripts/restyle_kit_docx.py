"""Aplica la identidad visual vigente a los .docx de los kits (sin tocar el texto legal).

- Celeste de la marca antigua -> verde bosque #00382E.
- Encabezados de tabla azul marino -> verde bosque.
- Recuadro de guia: franja gruesa celeste -> recuadro menta con borde fino.
- Linea de guiones bajo el titulo -> filete verde de ancho completo.
- Encabezado del Kit Blindaje: la celda del titulo usa el ancho real de su columna.
- Runs sin fuente (firmas) -> Calibri, igual que el resto del documento.
- Orden de elementos OOXML corregido (ver repair_kit_docx.py).

Uso:
    python scripts/restyle_kit_docx.py <archivo.docx | kit.zip> [...]
    python scripts/restyle_kit_docx.py --blindaje api/assets/Kit_Blindaje_Laboral_Pyme_2026.zip
        (agrega la nota de version y renombra los archivos "Oficial")
"""
import io
import re
import sys
import zipfile

from lxml import etree

sys.path.insert(0, __import__('os').path.dirname(__file__))
from repair_kit_docx import fix_part  # noqa: E402

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W = '{%s}' % W_NS

FOREST = '00382E'
FOREST_50 = 'EEF6F3'
FOREST_200 = 'ADD6C9'

TEXT_COLORS = {'0EA5E9': FOREST, '0284C7': FOREST, '0369A1': FOREST, '02C4E7': FOREST}
FILLS = {'0F172A': FOREST, 'F0F9FF': FOREST_50, 'E0F2FE': FOREST_50, 'F0FDF4': FOREST_50}
BORDER_COLORS = {'0284C7': FOREST_200, '0EA5E9': FOREST_200}


def w(tag):
    return W + tag


def recolor(root):
    for el in root.iter(w('color')):
        v = (el.get(w('val')) or '').upper()
        if v in TEXT_COLORS:
            el.set(w('val'), TEXT_COLORS[v])
    for el in root.iter(w('shd')):
        v = (el.get(w('fill')) or '').upper()
        if v in FILLS:
            el.set(w('fill'), FILLS[v])


def soften_stripes(root):
    """Franjas laterales gruesas -> recuadro de 0,5 pt en los cuatro lados."""
    for borders in root.iter(w('tcBorders')):
        left = borders.find(w('left'))
        if left is None:
            continue
        color = (left.get(w('color')) or '').upper()
        size = int(left.get(w('sz')) or 0)
        if color in BORDER_COLORS and size >= 12:
            for side in ('top', 'left', 'bottom', 'right'):
                el = borders.find(w(side))
                if el is None:
                    el = etree.SubElement(borders, w(side))
                el.attrib.clear()
                el.set(w('val'), 'single')
                el.set(w('sz'), '4')
                el.set(w('space'), '0')
                el.set(w('color'), FOREST_200)
            tcpr = borders.getparent()
            shd = tcpr.find(w('shd'))
            if shd is not None:
                shd.set(w('fill'), FOREST_50)


def dashes_to_rule(root):
    """Parrafo con solo guiones -> parrafo vacio con borde inferior verde."""
    for p in root.iter(w('p')):
        texts = [t for t in p.iter(w('t'))]
        joined = ''.join(t.text or '' for t in texts)
        if len(joined) >= 20 and re.fullmatch(r'-+', joined.strip()):
            for t in texts:
                t.text = ''
            ppr = p.find(w('pPr'))
            if ppr is None:
                ppr = etree.Element(w('pPr'))
                p.insert(0, ppr)
            pbdr = ppr.find(w('pBdr'))
            if pbdr is None:
                pbdr = etree.SubElement(ppr, w('pBdr'))
            bottom = etree.SubElement(pbdr, w('bottom'))
            bottom.set(w('val'), 'single')
            bottom.set(w('sz'), '12')
            bottom.set(w('space'), '1')
            bottom.set(w('color'), FOREST)
            spacing = ppr.find(w('spacing'))
            if spacing is None:
                spacing = etree.SubElement(ppr, w('spacing'))
            spacing.set(w('before'), '0')
            spacing.set(w('after'), '160')
            spacing.set(w('line'), '120')
            spacing.set(w('lineRule'), 'exact')


def fit_cells_to_grid(root):
    """Celdas cuyo ancho declarado no coincide con la grilla de la tabla."""
    for tbl in root.iter(w('tbl')):
        grid = [int(g.get(w('w'))) for g in tbl.findall(w('tblGrid') + '/' + w('gridCol'))]
        for tr in tbl.findall(w('tr')):
            cells = tr.findall(w('tc'))
            if len(cells) != len(grid):
                continue
            for tc, gw in zip(cells, grid):
                tcw = tc.find(w('tcPr') + '/' + w('tcW'))
                if tcw is not None and tcw.get(w('type')) == 'dxa' and int(tcw.get(w('w'))) != gw:
                    tcw.set(w('w'), str(gw))


def default_font(root):
    """Runs sin rFonts toman la fuente del tema (serif en algunos equipos): fijar Calibri."""
    for r in root.iter(w('r')):
        if r.find(w('t')) is None:
            continue
        rpr = r.find(w('rPr'))
        if rpr is None:
            rpr = etree.Element(w('rPr'))
            r.insert(0, rpr)
        if rpr.find(w('rFonts')) is None:
            f = etree.Element(w('rFonts'))
            f.set(w('ascii'), 'Calibri')
            f.set(w('hAnsi'), 'Calibri')
            f.set(w('cs'), 'Calibri')
            rpr.insert(0, f)


# Frases que prometian mas de lo que un modelo puede asegurar (cada una vive en un solo run)
TEXT_FIXES = [
    ('GUIA PRACTICA DE APLICACION Y VALIDEZ LEGAL (DT / SUSESO)', 'GUÍA PRÁCTICA DE APLICACIÓN (DT / SUSESO)'),
    ('AVISO DE VALIDEZ LEGAL Y DELIMITACIÓN DE RESPONSABILIDAD (ART. 528 C.O.T.)', 'AVISO LEGAL Y LÍMITES DE RESPONSABILIDAD'),
    ('elaborados con estricta sujeción a la normativa laboral, decretos y circulares oficiales de la',
     'elaborados con base en la normativa laboral, decretos y circulares de la'),
    ('legalmente reservadas a abogados colegiados y habilitados conforme al artículo 528 del Código Orgánico de Tribunales de Chile.',
     'reservadas por la ley chilena a abogados habilitados. Si tu caso tiene particularidades, revisa los documentos con un abogado antes de firmarlos.'),
]

VERSION_MARK = 'Versión 2026.10'


def fix_texts(root):
    for t in root.iter(w('t')):
        for old, new in TEXT_FIXES:
            if t.text and old in t.text:
                t.text = t.text.replace(old, new)


def add_version_note(root, note):
    """Linea final pequena con version y alcance del modelo (una sola vez)."""
    body = root.find(w('body'))
    if body is None or VERSION_MARK in ''.join(t.text or '' for t in root.iter(w('t'))):
        return
    p = etree.Element(w('p'))
    ppr = etree.SubElement(p, w('pPr'))
    sp = etree.SubElement(ppr, w('spacing'))
    sp.set(w('before'), '120')
    sp.set(w('after'), '0')
    r = etree.SubElement(p, w('r'))
    rpr = etree.SubElement(r, w('rPr'))
    f = etree.SubElement(rpr, w('rFonts'))
    for k in ('ascii', 'hAnsi', 'cs'):
        f.set(w(k), 'Calibri')
    etree.SubElement(rpr, w('color')).set(w('val'), '64748B')
    etree.SubElement(rpr, w('sz')).set(w('val'), '14')
    t = etree.SubElement(r, w('t'))
    t.text = note
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    sect = body.find(w('sectPr'))
    if sect is not None:
        sect.addprevious(p)
    else:
        body.append(p)


def restyle_part(xml_bytes, is_body, note=None):
    root = etree.fromstring(xml_bytes)
    recolor(root)
    soften_stripes(root)
    fix_texts(root)
    if is_body:
        dashes_to_rule(root)
        fit_cells_to_grid(root)
        if note:
            add_version_note(root, note)
    default_font(root)
    data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    data, _ = fix_part(data)
    return data


def restyle_docx_bytes(data, note=None):
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            content = src.read(info.filename)
            name = info.filename
            if name.startswith('word/') and name.endswith('.xml') and (
                    name == 'word/document.xml' or re.match(r'word/(header|footer)\d*\.xml', name)):
                content = restyle_part(content, is_body=(name == 'word/document.xml'), note=note)
            dst.writestr(info, content)
    return out.getvalue()


def restyle_path(path, note=None, rename=None):
    """Reestiliza un .docx o todos los .docx de un .zip.

    note: linea de version que se agrega al final de cada documento.
    rename: {nombre_viejo: nombre_nuevo} para entradas del zip.
    """
    if path.lower().endswith('.docx'):
        with open(path, 'rb') as f:
            data = f.read()
        with open(path, 'wb') as f:
            f.write(restyle_docx_bytes(data, note))
        return [path]
    src = zipfile.ZipFile(path)
    out = io.BytesIO()
    done = []
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            if info.filename.lower().endswith('.docx'):
                data = restyle_docx_bytes(data, note)
                done.append(info.filename)
            for old, new in (rename or {}).items():
                if info.filename.endswith('/' + old) or info.filename == old:
                    info.filename = info.filename[:-len(old)] + new
            dst.writestr(info, data)
    src.close()
    with open(path, 'wb') as f:
        f.write(out.getvalue())
    return done


NOTE_BASE = (VERSION_MARK + ' (octubre de 2026). Modelo de referencia basado en la normativa vigente a esa fecha; '
             'no constituye asesoría legal. Si tu caso tiene particularidades, revísalo con un abogado antes de firmar.')
NOTE_LEY_21719 = NOTE_BASE + ' La Ley 21.719 rige desde el 1 de diciembre de 2026.'

# Nombres que sugerian un documento emitido por la autoridad
BLINDAJE_RENAME = {
    '03_Formulario_Oficial_Recepcion_Denuncia_Karin.docx': '03_Formulario_Recepcion_Denuncia_Karin.docx',
    '18_Checklist_Oficial_10_Documentos_Inspeccion_DT.docx': '18_Checklist_10_Documentos_Inspeccion_DT.docx',
}

if __name__ == '__main__':
    args = sys.argv[1:]
    blindaje = '--blindaje' in args
    for p in [a for a in args if not a.startswith('--')]:
        kw = {'note': NOTE_BASE, 'rename': BLINDAJE_RENAME} if blindaje else {}
        for name in restyle_path(p, **kw):
            print('restyled', name)
