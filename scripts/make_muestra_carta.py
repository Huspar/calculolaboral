"""Genera la muestra de una carta del Pack de Cartas de Despido para la pagina de venta.

Arma una réplica HTML de la primera página de la carta (Art. 160 N° 7) con el texto real
del pack, y la deja en el directorio indicado; luego se fotografía con Playwright y se
convierte a WebP (ver scripts/make_muestra_carta.mjs). Como la muestra es una imagen, el
texto no se puede seleccionar ni copiar desde la página.

Uso: python scripts/make_muestra_carta.py <salida.html>
"""
import html
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_pack_despido import COMUN, numerar  # noqa: E402
from pack_despido_content import CARTAS, COTIZ, FINIQ_160  # noqa: E402

ARCHIVO = '12_Carta_Art160_N7_Incumplimiento_Grave_del_Contrato.docx'


def esc(t):
    return html.escape(t).replace('\n', '<br>')


def main(out):
    c = next(x for x in CARTAS if x['archivo'] == ARCHIVO)
    pasos = list(COMUN) + c['box']
    hechos = ''.join('<p>%s</p>' % esc(h) for h in c['hechos'])
    doc = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{{box-sizing:border-box}}
body{{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000}}
.page{{width:816px;height:1056px;padding:77px;position:relative;overflow:hidden;background:#fff}}
.head{{background:#0F172A;color:#fff;padding:14px 16px;border-radius:4px}}
.head .k{{font-size:8.5pt;font-weight:bold;color:#38BDF8;letter-spacing:.02em}}
.head .t{{font-size:13pt;font-weight:bold;margin-top:3px}}
.head .s{{font-size:8.5pt;color:#CBD5E1;margin-top:3px}}
.box{{background:#F8FAFC;border:1px solid #CBD5E1;padding:10px 14px;margin:14px 0;font-size:8.5pt;color:#475569;line-height:1.45}}
.box b{{color:#0F172A}}
p{{font-size:10pt;line-height:1.38;margin:0 0 9px}}
h4{{font-size:10pt;margin:11px 0 5px}}
.sig{{display:flex;gap:40px;margin-top:22px;font-size:9pt}}
.sig div{{flex:1;border-top:1px solid #000;padding-top:4px;line-height:1.35}}
.mark{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}}
.mark span{{transform:rotate(-30deg);font-size:96px;font-weight:bold;letter-spacing:.12em;color:rgba(15,23,42,.07);white-space:nowrap}}
.fade{{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 78%)}}
</style></head><body><div class="page" id="page">
<div class="head"><div class="k">CALCULOLABORAL.CL • PACK CARTAS DE DESPIDO 2026</div><div class="t">{esc(c['titulo'])}</div><div class="s">{esc(c['subtitulo'])}</div></div>
<div class="box"><b>📋 INSTRUCCIÓN PARA EL EMPLEADOR:</b><br>{esc(numerar(pasos))}</div>
<p><b>[CIUDAD], [DÍA] de [MES] de [AÑO].</b></p>
<p><b>Señor(a):<br>[NOMBRE COMPLETO DEL TRABAJADOR]</b><br>R.U.T.: [RUT DEL TRABAJADOR]<br>Cargo: [CARGO O FUNCIÓN]<br>Domicilio: [DIRECCIÓN REGISTRADA EN EL CONTRATO]</p>
<p><b>De nuestra consideración:</b></p>
<p>{esc(c['intro'])}</p>
<h4>I. CAUSAL LEGAL INVOCADA:</h4><p>{esc(c['causal'])}</p>
<h4>II. HECHOS EN QUE SE FUNDA:</h4>{hechos}
<h4>III. ESTADO DE PAGO DE COTIZACIONES PREVISIONALES:</h4><p>{esc(COTIZ)}</p>
<h4>IV. FINIQUITO:</h4><p>{esc(FINIQ_160)}</p>
<div class="sig"><div>[NOMBRE REPRESENTANTE LEGAL]<br>R.U.T.: [RUT REPRESENTANTE]</div><div>ACUSE DE RECIBO / COPIA TRABAJADOR<br>Nombre: [NOMBRE TRABAJADOR]</div></div>
<div class="mark"><span>MUESTRA</span></div>
<div class="fade"></div>
</div></body></html>'''
    open(out, 'w', encoding='utf-8').write(doc)
    print('ok', out)


if __name__ == '__main__':
    main(sys.argv[1])
