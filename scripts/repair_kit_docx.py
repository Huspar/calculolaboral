"""Repara el orden de elementos OOXML en los .docx de un kit (sin tocar el contenido).

Word exige que los hijos de tcPr, tblPr, trPr, pPr, rPr y de los bordes sigan
el orden del esquema. Los documentos del Kit Blindaje traen, por ejemplo,
tcPr = [tcW, shd, tcMar, tcBorders] y tblPr con tblBorders al final, y Word
se niega a abrir algunos de ellos. Este script los reordena en su lugar.

Uso:
    python scripts/repair_kit_docx.py <zip_del_kit> [--check]
"""
import io
import sys
import zipfile

from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
ORDER = {
    'tcPr': ['cnfStyle', 'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'shd', 'noWrap', 'tcMar',
             'textDirection', 'tcFitText', 'vAlign', 'hideMark'],
    'tblPr': ['tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize', 'tblStyleColBandSize',
              'tblW', 'jc', 'tblCellSpacing', 'tblInd', 'tblBorders', 'shd', 'tblLayout', 'tblCellMar', 'tblLook'],
    'trPr': ['cnfStyle', 'divId', 'gridBefore', 'gridAfter', 'wBefore', 'wAfter', 'cantSplit', 'trHeight',
             'tblHeader', 'tblCellSpacing', 'jc', 'hidden'],
    'pPr': ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr',
            'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap',
            'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid',
            'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection',
            'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'],
    'rPr': ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline',
            'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w',
            'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign',
            'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'],
    'tcBorders': ['top', 'start', 'left', 'bottom', 'end', 'right', 'insideH', 'insideV', 'tl2br', 'tr2bl'],
    'tblBorders': ['top', 'start', 'left', 'bottom', 'end', 'right', 'insideH', 'insideV'],
}


def fix_part(xml_bytes):
    root = etree.fromstring(xml_bytes)
    changed = 0
    for tag, order in ORDER.items():
        for el in root.iter(W + tag):
            kids = [c for c in el if isinstance(c.tag, str)]
            # descarta duplicados conservando el ultimo (el mas reciente)
            seen, unique = {}, []
            for c in kids:
                seen[c.tag] = c
            for c in kids:
                if seen[c.tag] is c:
                    unique.append(c)
            known = [c for c in unique if c.tag.replace(W, '') in order]
            unknown = [c for c in unique if c.tag.replace(W, '') not in order]
            ordered = sorted(known, key=lambda c: order.index(c.tag.replace(W, ''))) + unknown
            if [id(c) for c in ordered] != [id(c) for c in kids]:
                for c in kids:
                    el.remove(c)
                for c in ordered:
                    el.append(c)
                changed += 1
    return etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True), changed


def repair_docx_bytes(data):
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    total = 0
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            content = src.read(info.filename)
            if info.filename.startswith('word/') and info.filename.endswith('.xml'):
                content, n = fix_part(content)
                total += n
            dst.writestr(info, content)
    return out.getvalue(), total


def repair_kit_zip(kit_zip, check_only=False):
    src = zipfile.ZipFile(kit_zip)
    out = io.BytesIO()
    report = []
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            if info.filename.lower().endswith('.docx'):
                data, n = repair_docx_bytes(data)
                report.append((n, info.filename))
            dst.writestr(info, data)
    if not check_only:
        with open(kit_zip, 'wb') as f:
            f.write(out.getvalue())
    return report


if __name__ == '__main__':
    path = sys.argv[1]
    for n, name in repair_kit_zip(path, check_only='--check' in sys.argv):
        print(f'{n:>4} reordenados  {name}')
