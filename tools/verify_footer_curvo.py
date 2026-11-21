import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

PAGES = [
    'generador-anexo-contrato-chile.html',
    'personalizar-kit-blindaje.html',
    'personalizar-kit-datos.html',
    'personalizar-kit-despido.html',
]

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd='.')
time.sleep(1.5)

JS = '''() => {
    const c = document.querySelector('.teal-footer-curve');
    const cs = getComputedStyle(c);
    const inner = c.querySelector('.footer-inner-container');
    return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderTopLeftRadius,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        alto: Math.round(c.getBoundingClientRect().height),
        texto: c.innerText.replace(/\\s+/g, ' ').slice(0, 80),
    };
}'''

fails = 0
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for w in (1280, 1024, 390):
            pg = b.new_page(viewport={'width': w, 'height': 900})
            for p in PAGES:
                errors = []
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.goto(f'http://127.0.0.1:8765/{p}', wait_until='networkidle')
                d = pg.evaluate(JS)
                ok = d['bg'] == 'rgb(0, 56, 46)' and d['color'] == 'rgb(255, 255, 255)' and d['overflow'] <= 0 and not errors
                if w == 1280:
                    ok = ok and d['radius'] == '96px'
                print(('PASS' if ok else 'FAIL'), '|', w, 'px |', p, '|', d)
                if not ok:
                    fails += 1
            pg.close()
        b.close()
finally:
    srv.terminate()

print('FALLAS:', fails)
