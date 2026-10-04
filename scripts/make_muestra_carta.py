"""Genera la muestra de una carta del Pack de Cartas de Despido para la pagina de venta.

Arma una réplica HTML de las dos páginas de la carta del Art. 160 N° 7 con el texto real del pack:
página 1 (hoja de instrucciones) y página 2 (la carta limpia, con los campos resaltados). Luego se
fotografían con Playwright y se convierten a WebP (scripts/make_muestra_carta.mjs). Como la muestra
es una imagen, el texto no se puede seleccionar ni copiar desde la página.

Uso: python scripts/make_muestra_carta.py <salida.html>
"""
import html
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_pack_despido import COMUN, REVISA, NOTA, numerar  # noqa: E402
from pack_despido_content import CARTAS, COTIZ, FINIQ_160  # noqa: E402

ARCHIVO = '12_Carta_Art160_N7_Incumplimiento_Grave_del_Contrato.docx'


def esc(t):
    return html.escape(t).replace('\n', '<br>')


def campos(t):
    """Resalta en amarillo los campos [ ... ] (corchetes balanceados), igual que en el documento Word."""
    out, buf, depth = '', '', 0
    for ch in t:
        if ch == '[':
            if depth == 0:
                out += esc(buf)
                buf = ''
            depth += 1
            buf += ch
        elif ch == ']' and depth > 0:
            buf += ch
            depth -= 1
            if depth == 0:
                out += '<mark>%s</mark>' % esc(buf)
                buf = ''
        else:
            buf += ch
    return out + esc(buf)


def main(out):
    c = next(x for x in CARTAS if x['archivo'] == ARCHIVO)
    pasos = list(COMUN) + c['box']
    bullets = ''.join('<div class="b">• %s</div>' % esc(p) for p in pasos)
    revisa = ''.join('<div class="r">☐&nbsp; %s</div>' % esc(r) for r in REVISA)
    hechos = ''.join('<p>%s</p>' % campos(h) for h in c['hechos'])
    doc = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{{box-sizing:border-box}}
body{{margin:0;background:#fff;font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;color:#1E293B}}
.page{{width:816px;height:1056px;padding:62px 62px;position:relative;overflow:hidden;background:#fff}}
.hd{{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:4px}}
.hd .k{{font-size:8.5pt;font-weight:bold;color:#00382E}}
.hd .t{{font-size:12pt;font-weight:bold;color:#0F172A;margin-top:2px}}
.hd .c{{font-size:8.5pt;font-weight:bold;color:#64748B}}
.rule{{border-bottom:2px solid #00382E;margin:6px 0 14px}}
.box{{background:#EEF6F3;border:1px solid #ADD6C9;padding:9px 12px;font-size:9pt;color:#475569;line-height:1.4}}
.box h5{{margin:0 0 3px;font-size:8.5pt;color:#0F172A}}
.b{{margin:2px 0}}
h4{{font-size:10pt;margin:16px 0 4px;color:#1E293B}}
.r{{font-size:10pt;margin:3px 0;color:#0F172A}}
.note{{font-size:7pt;color:#64748B;margin-top:14px;line-height:1.35}}
.ft{{position:absolute;left:62px;right:62px;bottom:34px;text-align:center;font-size:7.5pt;color:#64748B}}
p{{font-size:10pt;line-height:1.38;margin:0 0 8px;color:#0F172A}}
h3{{font-size:10pt;margin:11px 0 4px;color:#1E293B}}
mark{{background:#FFFF00;color:inherit}}
.sig{{display:flex;gap:30px;margin-top:20px;text-align:center;font-size:9pt}}
.sig div{{flex:1;line-height:1.35}}
.sig b{{display:block;font-size:9pt}}
.sig small{{color:#475569;font-size:8.5pt}}
.mark{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}}
.mark span{{transform:rotate(-30deg);font-size:96px;font-weight:bold;letter-spacing:.12em;color:rgba(15,23,42,.06);white-space:nowrap}}
</style></head><body>

<div class="page" id="page1">
<div class="hd"><div><div class="k">PACK CARTAS DE DESPIDO | {esc(c['subtitulo'])}</div><div class="t">{esc(c['titulo'])}</div></div><div class="c">DESPIDO-12</div></div>
<div class="rule"></div>
<div class="box"><h5>INSTRUCCIONES PARA EL EMPLEADOR</h5>{bullets}</div>
<h4>ANTES DE ENVIAR, REVISA</h4>{revisa}
<div class="note">{esc(NOTA)}</div>
<div class="ft">CálculoLaboral.cl · Pack de Cartas de Despido 2026 · Modelo de referencia</div>
<div class="mark"><span>MUESTRA</span></div>
</div>

<div class="page" id="page2">
<p><b>{campos('[CIUDAD], [DÍA] de [MES] de [AÑO].')}</b></p>
<p><b>Señor(a):<br>{campos('[NOMBRE COMPLETO DEL TRABAJADOR]')}</b><br>R.U.T.: {campos('[RUT DEL TRABAJADOR]')}<br>Cargo: {campos('[CARGO O FUNCIÓN]')}<br>Domicilio: {campos('[DIRECCIÓN REGISTRADA EN EL CONTRATO]')}<br>Comuna / Ciudad: {campos('[COMUNA / CIUDAD]')}</p>
<p><b>De nuestra consideración:</b></p>
<p>{campos(c['intro'])}</p>
<h3>I. CAUSAL LEGAL INVOCADA:</h3><p>{campos(c['causal'])}</p>
<h3>II. HECHOS EN QUE SE FUNDA:</h3>{hechos}
<h3>III. ESTADO DE PAGO DE COTIZACIONES PREVISIONALES:</h3><p>{campos(COTIZ)}</p>
<h3>IV. FINIQUITO:</h3><p>{campos(FINIQ_160)}</p>
<p>Sin otro particular, le saluda atentamente,</p>
<div class="sig"><div>_____________________________________<b>POR LA EMPRESA (REPRESENTANTE LEGAL)</b><small>{campos('[NOMBRE REPRESENTANTE LEGAL]')}<br>R.U.T.: {campos('[RUT REPRESENTANTE]')}</small></div><div>_____________________________________<b>ACUSE DE RECIBO / COPIA TRABAJADOR</b><small>Nombre: {campos('[NOMBRE TRABAJADOR]')}<br>R.U.T.: {campos('[RUT TRABAJADOR]')}</small></div></div>
<div class="mark"><span>MUESTRA</span></div>
</div>

</body></html>'''
    open(out, 'w', encoding='utf-8').write(doc)
    print('ok', out)


if __name__ == '__main__':
    main(sys.argv[1])
