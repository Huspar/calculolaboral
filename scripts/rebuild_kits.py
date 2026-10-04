"""Aplica el formato "hoja de instrucciones + documento limpio" a los documentos Word de los kits de pago.

- Kit Blindaje: encabezado + guía de uso quedan en la página 1; el documento empieza limpio en la página 2.
- Kit Datos (Ley 21.719): se quita la línea de marca que encabezaba cada documento de trabajo.
- En ambos, los campos [ ... ] se resaltan en amarillo.

Es idempotente: un documento que ya tiene el formato nuevo no se vuelve a transformar.
Uso: python scripts/rebuild_kits.py
"""
import base64
import io
import os
import sys
import zipfile

import docx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docs_layout as L  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, 'api', 'assets')

KITS = {
    'blindaje': dict(zip='Kit_Blindaje_Laboral_Pyme_2026.zip', b64='kit-base64.js',
                     header='// In-memory base64 package for Vercel Serverless Function (Kit Blindaje Laboral Pyme 2026)\n',
                     skip=('00_INSTRUCCIONES_Y_GUIA',)),
    'datos': dict(zip='Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip', b64='kit-datos-base64.js', header='',
                  skip=('0_MANUAL',)),
}


def transform_blindaje(data):
    d = docx.Document(io.BytesIO(data))
    changed = L.split_kit_doc(d)
    if not changed:
        return data, False
    out = io.BytesIO()
    d.save(out)
    return out.getvalue(), True


def transform_datos(data):
    d = docx.Document(io.BytesIO(data))
    kids = [k for k in d.element.body.iterchildren() if not k.tag.endswith('sectPr')]
    first = L.Paragraph(kids[0], d) if kids and kids[0].tag == L.W_P else None
    changed = False
    if first is not None and first.text.strip().startswith('CálculoLaboral.cl'):
        kids[0].getparent().remove(kids[0])
        changed = True
    if L.highlight_fields(d) or changed:
        out = io.BytesIO()
        d.save(out)
        return out.getvalue(), True
    return data, False


def main():
    for key, cfg in KITS.items():
        path = os.path.join(ASSETS, cfg['zip'])
        src = zipfile.ZipFile(path)
        buf = io.BytesIO()
        n_ok = 0
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as dst:
            for info in src.infolist():
                data = src.read(info.filename)
                name = info.filename.split('/')[-1]
                if name.lower().endswith('.docx') and not any(name.startswith(s) for s in cfg['skip']):
                    fn = transform_blindaje if key == 'blindaje' else transform_datos
                    data, changed = fn(data)
                    n_ok += 1 if changed else 0
                    print(' ', 'ok ' if changed else '-- ', name)
                dst.writestr(info, data)
        src.close()
        open(path, 'wb').write(buf.getvalue())
        with open(os.path.join(ASSETS, cfg['b64']), 'w', encoding='utf-8', newline='\n') as f:
            f.write(cfg['header'])
            f.write('module.exports = "%s";\n' % base64.b64encode(buf.getvalue()).decode())
        print(key, ':', n_ok, 'documentos transformados', len(buf.getvalue()), 'bytes')


if __name__ == '__main__':
    main()
