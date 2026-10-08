"""Regenera el PDF del manual del Kit Ley 21.719 desde su HTML (api/assets/kit_datos_files).

Equivale a la parte del Kit Ley 21.719 de scripts/render_kit_manuals.mjs, pero con Playwright para Python,
que es lo que hay instalado en este equipo. Requiere Microsoft Edge.
Uso: python scripts/render_manual_datos_pdf.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api', 'assets', 'kit_datos_files')
HTML = os.path.join(BASE, '0_Manual_Instrucciones_Paso_a_Paso_Ley_21719.html')
PDF = os.path.join(BASE, '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf')
SALIDA = sys.argv[1] if len(sys.argv) > 1 else PDF

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge')
    page = browser.new_page()
    page.goto('file:///' + os.path.abspath(HTML).replace('\\', '/'), wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    page.pdf(path=SALIDA, prefer_css_page_size=True, print_background=True)
    browser.close()
print('ok', os.path.abspath(SALIDA))
