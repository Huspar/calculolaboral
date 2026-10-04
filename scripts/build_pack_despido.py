"""Arma el Pack de Cartas de Despido por Causal (producto de pago) a partir de los modelos gratuitos.

Salida (no publica; se entrega solo tras el pago confirmado por Flow):
  api/assets/pack_despido_files/*.docx
  api/assets/Pack_Cartas_Despido_por_Causal_Chile_2026.zip
  api/assets/pack-despido-base64.js

Uso: python scripts/build_pack_despido.py
"""
import base64
import copy
import os
import shutil
import sys
import zipfile

import docx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_despido_content import CARTAS, DOCS_EXTRA, FINIQ_159, FINIQ_160, COTIZ, GUIA  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FREE = os.path.join(BASE, 'descargas')
OUT_DIR = os.path.join(BASE, 'api', 'assets', 'pack_despido_files')
ZIP_PATH = os.path.join(BASE, 'api', 'assets', 'Pack_Cartas_Despido_por_Causal_Chile_2026.zip')
B64_PATH = os.path.join(BASE, 'api', 'assets', 'pack-despido-base64.js')
TEMPLATE = os.path.join(FREE, '02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx')
ZIP_NAME = 'Pack_Cartas_Despido_por_Causal_Chile_2026.zip'
BRAND = 'CALCULOLABORAL.CL • PACK CARTAS DE DESPIDO 2026\n'

# Posiciones de las piezas en el modelo base (hijos directos del body)
T_HEAD, T_BOX, P_DATE, P_ADDR, P_SALUT, P_BODY, P_HEAD, P_CLOSE, P_SPACER, T_SIG = 0, 2, 4, 5, 6, 7, 8, 16, 17, 18


class Builder:
    def __init__(self):
        self.doc = docx.Document(TEMPLATE)
        body = self.doc.element.body
        kids = [k for k in body.iterchildren() if not k.tag.endswith('sectPr')]
        self.sect = [k for k in body.iterchildren() if k.tag.endswith('sectPr')][0]
        self.part = {n: copy.deepcopy(kids[i]) for n, i in dict(
            head=T_HEAD, box=T_BOX, date=P_DATE, addr=P_ADDR, salut=P_SALUT, body=P_BODY, h=P_HEAD,
            close=P_CLOSE, spacer=P_SPACER, sig=T_SIG).items()}
        for k in kids:
            body.remove(k)
        self.body = body

    # --- helpers de piezas -------------------------------------------------
    def _add(self, el):
        self.sect.addprevious(el)
        return el

    def _para(self, name, *segments):
        el = copy.deepcopy(self.part[name])
        p = docx.text.paragraph.Paragraph(el, self.doc)
        runs = p.runs
        proto = runs[0]._r
        for r in runs[1:]:
            r._r.getparent().remove(r._r)
        for i, (text, bold) in enumerate(segments):
            if i == 0:
                r = runs[0]
            else:
                new = copy.deepcopy(proto)
                p._p.append(new)
                r = docx.text.run.Run(new, p)
            r.text = text
            r.bold = bold
        return self._add(el)

    def head(self, title, subtitle):
        el = copy.deepcopy(self.part['head'])
        t = docx.table.Table(el, self.doc)
        runs = t.cell(0, 0).paragraphs[0].runs
        runs[0].text = BRAND
        runs[1].text = title
        runs[2].text = '\n' + subtitle
        self._add(el)
        self.spacer()

    def box(self, text):
        el = copy.deepcopy(self.part['box'])
        t = docx.table.Table(el, self.doc)
        t.cell(0, 0).paragraphs[0].runs[0].text = text
        self._add(el)
        self.spacer()

    def spacer(self):
        self._add(copy.deepcopy(self.part['spacer']))

    def date(self):
        self._para('date', ('[CIUDAD], [DÍA] de [MES] de [AÑO].', True))

    def addr(self):
        self._add(copy.deepcopy(self.part['addr']))

    def salut(self):
        self._add(copy.deepcopy(self.part['salut']))

    def heading(self, text):
        self._para('h', (text, True))

    def text(self, t):
        self._para('body', (t, False))

    def lead(self, bold, rest):
        self._para('body', (bold, True), (rest, False))

    def close(self, t='Sin otro particular, le saluda atentamente,'):
        self._para('close', (t, False))
        self.spacer()

    def sig(self, right=None):
        el = copy.deepcopy(self.part['sig'])
        t = docx.table.Table(el, self.doc)
        cell = t.cell(0, 1)
        for p in cell.paragraphs:
            for r in p.runs:
                r.text = r.text.replace('____ / ____ / 2026', '____ / ____ / ________')
        if right:
            runs = cell.paragraphs[0].runs
            runs[1].text = right
        self._add(el)

    def save(self, path):
        self.doc.save(path)


def numerar(items):
    return '\n'.join('%d. %s' % (i + 1, t) for i, t in enumerate(items))


PLAZO_3 = ('PLAZO: entrega la carta en mano o envíala por carta certificada al domicilio del contrato dentro de los '
           '3 DÍAS HÁBILES siguientes a la separación del trabajador, con copia a la Inspección del Trabajo en el mismo plazo.')
COMUN = [
    'Completa los campos entre corchetes [...] con datos reales y borra las alternativas que no apliquen.',
    PLAZO_3,
    'Adjunta los comprobantes de pago de cotizaciones al día (AFP, salud y seguro de cesantía). Sin ellos el despido no produce efecto (Art. 162).',
    'En un juicio solo podrás defender los hechos que escribas en esta carta (Art. 454 N° 1): descríbelos con fechas, horas, lugares y personas.',
]
COMUN_159 = [
    'Completa los campos entre corchetes [...] con datos reales y borra las alternativas que no apliquen.',
]


def build_carta(c):
    b = Builder()
    b.head(c['titulo'], c['subtitulo'])
    plazo = c.get('plazo', 3)
    if plazo == 6:
        pasos = [COMUN[0],
                 'PLAZO: para esta causal la carta se entrega o envía por carta certificada dentro de los 6 DÍAS HÁBILES siguientes a la separación del trabajador, con copia a la Inspección del Trabajo en el mismo plazo.'] + COMUN[2:]
    elif c.get('pasos_propios'):
        pasos = c['pasos_propios']
    else:
        pasos = list(COMUN)
    pasos = pasos + c.get('box', [])
    b.box('📋 INSTRUCCIÓN PARA EL EMPLEADOR:\n' + numerar(pasos))
    b.date()
    b.addr()
    b.salut()
    b.text(c['intro'])
    b.heading('I. CAUSAL LEGAL INVOCADA:')
    b.text(c['causal'])
    b.heading(c.get('h2', 'II. HECHOS EN QUE SE FUNDA:'))
    for h in c['hechos']:
        b.text(h)
    b.heading('III. ESTADO DE PAGO DE COTIZACIONES PREVISIONALES:')
    b.text(COTIZ)
    b.heading('IV. FINIQUITO:')
    b.text(c['finiquito'])
    for extra in c.get('cierre_extra', []):
        b.text(extra)
    b.close(c.get('cierre', 'Sin otro particular, le saluda atentamente,'))
    b.sig()
    return b


def build_extra(d):
    b = Builder()
    b.head(d['titulo'], d['subtitulo'])
    if d.get('box'):
        b.box('📋 ' + d['box_titulo'] + '\n' + numerar(d['box']))
    for kind, *args in d['body']:
        if kind == 'date':
            b.date()
        elif kind == 'addr':
            b.addr()
        elif kind == 'salut':
            b.salut()
        elif kind == 'h':
            b.heading(args[0])
        elif kind == 't':
            b.text(args[0])
        elif kind == 'l':
            b.lead(args[0], args[1])
        elif kind == 'close':
            b.close(*args)
        elif kind == 'sig':
            b.sig(*args)
        elif kind == 'sp':
            b.spacer()
    return b


def main():
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)
    built = []

    # Guía de uso primero
    g = build_extra(GUIA)
    g.save(os.path.join(OUT_DIR, GUIA['archivo']))
    built.append(GUIA['archivo'])

    # Modelos gratuitos incluidos tal cual
    for src, dst in [('01_Modelo_Carta_Despido_Art161_Necesidades_Empresa_2026.docx', '01_Carta_Art161_Necesidades_de_la_Empresa.docx'),
                     ('02_Modelo_Carta_Despido_Art160_N3_Inasistencia_Injustificada_2026.docx', '02_Carta_Art160_N3_Inasistencia_Injustificada.docx')]:
        shutil.copy(os.path.join(FREE, src), os.path.join(OUT_DIR, dst))
        built.append(dst)

    for c in CARTAS:
        c = dict(c)
        c['finiquito'] = FINIQ_160 if c['tipo'] == '160' else FINIQ_159 if c['tipo'] == '159' else c['finiquito']
        build_carta(c).save(os.path.join(OUT_DIR, c['archivo']))
        built.append(c['archivo'])

    for d in DOCS_EXTRA:
        build_extra(d).save(os.path.join(OUT_DIR, d['archivo']))
        built.append(d['archivo'])

    built.sort()
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in built:
            z.write(os.path.join(OUT_DIR, name), arcname=name)
    data = open(ZIP_PATH, 'rb').read()
    with open(B64_PATH, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// In-memory base64 package for Vercel Serverless Function (Pack Cartas de Despido por Causal 2026)\n')
        f.write('module.exports = "%s";\n' % base64.b64encode(data).decode())
    print('ok', len(built), 'documentos', len(data), 'bytes')
    for n in built:
        print(' ', n)


if __name__ == '__main__':
    main()
