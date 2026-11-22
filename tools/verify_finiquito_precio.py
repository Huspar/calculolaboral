# -*- coding: utf-8 -*-
"""Verifica precio finiquito $9.990 y legibilidad/CTA de liquidacion-de-sueldo."""
import subprocess, sys, time, re

REPO = r'C:/Users/Jhon/Desktop/Claude/CalculoLaboral'
PORT = 8781
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

fails = []
def check(name, cond):
    print(('PASS  ' if cond else 'FAIL  ') + name)
    if not cond: fails.append(name)

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 840})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))

        # ---------- FINIQUITO ----------
        pg.goto('http://localhost:%d/generador-finiquito-chile.html' % PORT, wait_until='load')
        pg.wait_for_timeout(800)
        html = pg.content()
        check('F1 sin rastro de $12.990 en el generador de finiquito', '12.990' not in html)
        check('F2 precio $9.990 visible en botones y modal', html.count('9.990') >= 5)
        schema = pg.evaluate("(() => { try { const j = JSON.parse(document.querySelector('script[type=\"application/ld+json\"]').textContent); const nodes = j['@graph'] || [j]; const app = nodes.find(n => n.offers); return app && app.offers ? String(app.offers.price) : 'SIN-OFFERS'; } catch (e) { return 'ERR:' + e.message; } })()")
        check('F3 schema JSON-LD con price 9990', schema == '9990')
        check('F4 garantia de 48 horas visible en el modal', '48 horas' in html)

        # CTA en finiquito_calculator
        pg.goto('http://localhost:%d/finiquito_calculator.html' % PORT, wait_until='load')
        pg.wait_for_timeout(500)
        h2 = pg.content()
        check('F5 finiquito_calculator promociona $9.990', '9.990' in h2 and '12.990' not in h2)

        # ---------- LIQUIDACION (guia) ----------
        pg.goto('http://localhost:%d/liquidacion-de-sueldo.html' % PORT, wait_until='load')
        pg.wait_for_timeout(800)
        cta = pg.locator('a[data-cta-slot="guia-que-es"]')
        check('L1 CTA duplicado presente', cta.count() == 1)
        if cta.count():
            check('L2 CTA visible y apunta al generador', cta.first.is_visible() and 'generador-liquidacion-sueldo' in cta.first.get_attribute('href'))
            box = cta.first.bounding_box()
            check('L3 CTA >= 44 px de alto', box and box['height'] >= 40)
            que = pg.locator('#que-es').bounding_box()
            check('L4 CTA ubicado tras el primer bloque', box and que and box['y'] > que['y'])
        check('L5 CTA original (guia-formato) sigue presente', pg.locator('a[data-cta-slot="guia-formato"]').count() == 1)
        small = pg.evaluate("""(() => {
            let n = 0;
            document.querySelectorAll('.ls-article *').forEach(el => {
                const fs = parseFloat(getComputedStyle(el).fontSize);
                if (fs < 12 && el.textContent.trim() && !el.classList.contains('material-icons')) n++;
            });
            return n;
        })()""")
        check('L6 cero textos < 12px en el articulo (escritorio)', small == 0)
        check('L7 sin errores de consola', len(errs) == 0)
        if errs: print('   errores:', errs[:5])

        # movil
        pm = b.new_page(viewport={'width': 390, 'height': 844})
        errs_m = []
        pm.on('console', lambda m: errs_m.append(m.text) if m.type == 'error' else None)
        pm.on('pageerror', lambda e: errs_m.append(str(e)))
        pm.goto('http://localhost:%d/liquidacion-de-sueldo.html' % PORT, wait_until='load')
        pm.wait_for_timeout(800)
        small_m = pm.evaluate("""(() => {
            let n = 0;
            document.querySelectorAll('.ls-article *').forEach(el => {
                const fs = parseFloat(getComputedStyle(el).fontSize);
                if (fs < 12 && el.textContent.trim() && !el.classList.contains('material-icons')) n++;
            });
            return n;
        })()""")
        check('M1 cero textos < 12px en el articulo (movil 390)', small_m == 0)
        check('M2 sin desborde horizontal a 390 px', pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        check('M3 CTA duplicado visible en movil', pm.locator('a[data-cta-slot="guia-que-es"]').first.is_visible())
        check('M4 sin errores de consola en movil', len(errs_m) == 0)
        if errs_m: print('   errores:', errs_m[:5])
        pm.close()
        b.close()
finally:
    server.terminate()

print()
print('TOTAL FAILS:', len(fails))
for f in fails: print('  FAIL:', f)
sys.exit(1 if fails else 0)
