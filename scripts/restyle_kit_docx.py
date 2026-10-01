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


def restyle_part(xml_bytes, is_body):
    root = etree.fromstring(xml_bytes)
    recolor(root)
    soften_stripes(root)
    if is_body:
        dashes_to_rule(root)
        fit_cells_to_grid(root)
    default_font(root)
    data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    data, _ = fix_part(data)
    return data


def restyle_docx_bytes(data):
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            content = src.read(info.filename)
            name = info.filename
            if name.startswith('word/') and name.endswith('.xml') and (
                    name == 'word/document.xml' or re.match(r'word/(header|footer)\d*\.xml', name)):
                content = restyle_part(content, is_body=(name == 'word/document.xml'))
            dst.writestr(info, content)
    return out.getvalue()


def restyle_path(path):
    if path.lower().endswith('.docx'):
        with open(path, 'rb') as f:
            data = f.read()
        with open(path, 'wb') as f:
            f.write(restyle_docx_bytes(data))
        return [path]
    src = zipfile.ZipFile(path)
    out = io.BytesIO()
    done = []
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            if info.filename.lower().endswith('.docx'):
                data = restyle_docx_bytes(data)
                done.append(info.filename)
            dst.writestr(info, data)
    src.close()
    with open(path, 'wb') as f:
        f.write(out.getvalue())
    return done


if __name__ == '__main__':
    for p in sys.argv[1:]:
        for name in restyle_path(p):
            print('restyled', name)
