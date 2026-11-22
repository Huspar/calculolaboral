# -*- coding: utf-8 -*-
"""Verifica la red de enlaces de la campana de diciembre."""
import subprocess, sys, time

REPO = r'C:/Users/Jhon/Desktop/Claude/CalculoLaboral'
PORT = 8783
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

fails = []
def check(name, cond):
    print(('PASS  ' if cond else 'FAIL  ') + name)
    if not cond: fails.append(name)

PAGES = ['index.html', 'liquidacion-de-sueldo.html', 'sueldo_liquido.html', 'finiquito_calculator.html',
         'calculadora-vacaciones.html', 'gratificacion-legal-chile.html', 'calculadora-sueldo-part-time.html']

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 840})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))

        for page in PAGES:
            pg.goto('http://localhost:%d/%s' % (PORT, page), wait_until='load')
            pg.wait_for_timeout(600)
            n = pg.locator('a[href*="aguinaldo-navidad-cierre-laboral-diciembre-2026"]').count()
            esperado = 2 if page == 'index.html' else 1
            check('%s: %d enlace(s) a la guia de diciembre' % (page, esperado), n == esperado)
            # el/los enlaces deben vivir dentro de un ul/li o dropdown valido (no huerfanos)
            ok_dom = pg.evaluate("""(() => {
                const links = document.querySelectorAll('a[href*="aguinaldo-navidad-cierre-laboral-diciembre-2026"]');
                return Array.from(links).every(l => l.closest('li') || l.closest('nav') || l.parentElement.tagName === 'DIV');
            })()""")
            check('%s: enlaces dentro de listas/contenedores' % page, ok_dom)
        check('consola sin errores (todas las paginas)', len(errs) == 0)
        if errs: print('   errores:', errs[:6])
        pg.close()

        # movil: home y guia de liquidacion sin desborde y con enlace visible
        pm = b.new_page(viewport={'width': 390, 'height': 844})
        for page in ['index.html', 'liquidacion-de-sueldo.html']:
            pm.goto('http://localhost:%d/%s' % (PORT, page), wait_until='load')
            pm.wait_for_timeout(600)
            check('%s movil: sin desborde a 390 px' % page, pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
            vis = pm.evaluate("""(() => {
                const links = Array.from(document.querySelectorAll('a[href*="aguinaldo-navidad-cierre-laboral-diciembre-2026"]'));
                const visibles = links.filter(l => l.offsetParent !== null);
                const el = visibles.length ? visibles[visibles.length - 1] : links[links.length - 1];
                el.scrollIntoView({ block: 'center', behavior: 'instant' });
                const r = el.getBoundingClientRect();
                return { hay: visibles.length > 0, dentro: r.top < window.innerHeight && r.bottom > 0 };
            })()""")
            check('%s movil: enlace de diciembre visible' % page, vis['hay'] and vis['dentro'])
        pm.close()
        b.close()
finally:
    server.terminate()

print()
print('TOTAL FAILS:', len(fails))
for f in fails: print('  FAIL:', f)
sys.exit(1 if fails else 0)
