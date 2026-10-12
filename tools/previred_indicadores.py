"""Lee los indicadores previsionales mensuales de Previred y muestra los valores que usa el generador de liquidaciones.

Uso (desde la raíz del repositorio):
    python -I tools/previred_indicadores.py 2026-10          un mes
    python -I tools/previred_indicadores.py 2026-01 2026-12  un rango de meses

Requiere: pymupdf (pip install pymupdf). Los PDF se guardan en una carpeta temporal del sistema, fuera del repositorio.
Muestra, por mes: UF de fin de mes, tope imponible AFP y de cesantía (en UF y en pesos), ingreso mínimo, tasas de
cotización del trabajador por AFP y el aviso "IMPORTANTE" del mes. Con eso se arma una vigencia nueva en
js/liquidacion_parametros.js y se confirman los topes en pesos (UF de fin de mes × tope en UF).
Fuente: https://www.previred.com/indicadores-previsionales/ (los indicadores de cada mes se publican en PDF).
"""
import os, re, sys, tempfile, urllib.request

import fitz  # pymupdf

PAGINA = 'https://www.previred.com/indicadores-previsionales/'
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
AFP = ['Capital', 'Cuprum', 'Habitat', 'PlanVital', 'Provida', 'Modelo', 'Uno']
CACHE = os.path.join(tempfile.gettempdir(), 'previred_indicadores')


def descargar(url, destino):
    if not os.path.exists(destino):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(destino, 'wb') as f:
            f.write(r.read())
    return destino


def enlaces():
    """{ 'AAAA-MM': url } con los PDF que lista la página de Previred."""
    req = urllib.request.Request(PAGINA, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    salida = {}
    for m in re.finditer(r'href="([^"]*Indicadores-Previsionales-Previred-([A-Za-zé]+)-(\d{4})[^"]*\.pdf)"', html, re.I):
        mes = m.group(2).lower()
        if mes in MESES:
            url = m.group(1)
            salida['%s-%02d' % (m.group(3), MESES.index(mes) + 1)] = url if url.startswith('http') else 'https://www.previred.com' + url
    return salida


def texto(pdf):
    return '\n'.join(p.get_text('text') for p in fitz.open(pdf))


def resumir(periodo, t):
    L = [x.strip() for x in t.split('\n')]
    print('=' * 72)
    print(periodo, '|', next((x for x in L if x.startswith('Para Cotizaciones a Pagar')), '(sin encabezado)'))
    print('Topes en UF:', sorted(set(x for x in L if re.match(r'Para (afiliados a una AFP|Seguro de Cesant)', x))))
    montos = [x for x in L[:16] if x.startswith('$')]
    if len(montos) >= 9:
        print('UF fin de mes: %s | tope AFP $: %s | ingreso mínimo: %s | tope cesantía $: %s' % (montos[0], montos[2], montos[3], montos[6]))
    else:
        print('Primeros montos:', montos)
    tasas = {}
    for i, x in enumerate(L):
        if x in AFP and i + 3 < len(L):
            tasas[x] = L[i + 1:i + 4]
    print('Tasas AFP (cargo trabajador, cargo empleador, total):', tasas)
    if 'IMPORTANTE' in L:
        i = L.index('IMPORTANTE')
        print('IMPORTANTE:', ' | '.join(L[i + 1:i + 9]))
    print('Revisa a mano el PDF si el orden de las tasas no es el esperado (algunos meses cambian el diseño).')


def main(args):
    if not args:
        print(__doc__)
        return 1
    desde, hasta = args[0], args[-1]
    os.makedirs(CACHE, exist_ok=True)
    urls = enlaces()
    meses = [p for p in sorted(urls) if desde <= p <= hasta]
    if not meses:
        print('No encontré PDF de Previred entre %s y %s. Meses disponibles: %s' % (desde, hasta, ', '.join(sorted(urls)) or 'ninguno'))
        return 1
    for p in meses:
        pdf = descargar(urls[p], os.path.join(CACHE, p + '.pdf'))
        resumir(p, texto(pdf))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
