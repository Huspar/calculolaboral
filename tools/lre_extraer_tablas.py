"""Extrae del manual y del suplemento del Libro de Remuneraciones Electronico (DT) las columnas y la tabla de comunas.

Uso: python tools/lre_extraer_tablas.py <manual.pdf> <suplemento.pdf>   (necesita pdftotext)
Escribe js/lre_tablas.js. Fuentes:
  manual     https://static-content.api.dirtrab.cl/dt-docs/lre/lre_instrucciones_de_carga.pdf   (Anexo 1: columnas, orden y obligatoriedad)
  suplemento https://www.dt.gob.cl/portal/1626/articles-119843_recurso_4.pdf                      (nombres con tildes y tabla de comunas)
"""
import json, re, subprocess, sys, os

def texto(pdf):
    return subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', pdf, '-'], capture_output=True, check=True).stdout.decode('utf-8', 'replace')

manual, suplemento = texto(sys.argv[1]).split('\n'), texto(sys.argv[2]).split('\n')

anexo = []
for l in manual:
    m = re.match(r'^(\d{4}) (.+?) (?:Int|Date|Tinyint|tinyint|Float)\s+(\d+) (OBLIGATORIO|OPCIONAL)\s*$', l.strip())
    if m: anexo.append((m.group(1), m.group(2), m.group(4) == 'OBLIGATORIO'))

nombres = {}
for l in suplemento:
    m = re.search(r'^\s*\d+\)\s+(.*?)\s*\(c[óo]d\s*(\d{4})\)', l.replace('\x0c', ''))
    if m and m.group(2) not in nombres: nombres[m.group(2)] = m.group(1).strip()
# Tres conceptos no estan en el indice del suplemento
nombres.setdefault('2306', 'Gastos por causa del trabajo (Art 41)')
nombres.setdefault('3164', 'Impuesto retenido por reliquidación remuneraciones devengadas en otros períodos')
nombres.setdefault('3165', 'Diferencia de impuesto por reliquidación remuneraciones devengadas en este período')

a = next(n for n, l in enumerate(suplemento) if l.replace('\x0c', '').startswith('6) Comuna de prestación') and n > 100)
b = next(n for n, l in enumerate(suplemento) if n > a and '7) Tipo de impuesto' in l)
comunas, pend = {}, None
for l in suplemento[a + 3:b]:
    s = l.replace('\x0c', '').strip()
    m = re.match(r'^(\d{4,5}) (.+)$', s)
    if m:
        pend = int(m.group(1)); comunas[pend] = m.group(2).strip()
    elif pend and s and not re.match(r'^\d+$', s) and not s.startswith(('Comuna', 'Código', 'Se debe')):
        comunas[pend] += ' ' + s

columnas = [{'c': c, 'n': nombres[c], 'o': o} for c, _, o in anexo]
assert len(columnas) == 147 and len(comunas) >= 340, (len(columnas), len(comunas))
destino = os.path.join(os.path.dirname(__file__), '..', 'js', 'lre_tablas.js')
with open(destino, 'w', encoding='utf-8', newline='\n') as f:
    f.write('/* GENERADO por tools/lre_extraer_tablas.py a partir del manual y el suplemento del LRE de la Dirección del Trabajo: no editar a mano.\n'
            ' * COLUMNAS: orden y obligatoriedad del Anexo 1 del manual; COMUNAS: código de comuna de prestación de servicios (cód 1106). */\n')
    f.write('(function (root) {\n    var T = {\n')
    f.write('        COLUMNAS: ' + json.dumps(columnas, ensure_ascii=False) + ',\n')
    f.write('        COMUNAS: ' + json.dumps({str(k): v for k, v in sorted(comunas.items())}, ensure_ascii=False) + '\n    };\n')
    f.write("    if (typeof module === 'object' && module.exports) module.exports = T; else root.CLLreTablas = T;\n})(typeof self !== 'undefined' ? self : this);\n")
print('columnas', len(columnas), 'comunas', len(comunas))
