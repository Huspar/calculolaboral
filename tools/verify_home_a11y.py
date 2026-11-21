import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd='.')
time.sleep(1.5)

JS_NAME = '''(el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const walk = (node) => {
        if (node.nodeType === 1) {
            if (node.getAttribute('aria-hidden') === 'true') return '';
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return '';
            return Array.from(node.childNodes).map(walk).join(' ');
        }
        if (node.nodeType === 3) return node.textContent;
        return '';
    };
    return walk(el).replace(/\\s+/g, ' ').trim();
}'''

results = []
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8765/index.html', wait_until='networkidle')

        # 1) nombre accesible del boton de envio legal
        name = pg.evaluate(JS_NAME, pg.locator('#lawyer-submit-btn').element_handle())
        results.append(('nombre boton envio = "Enviar antecedentes para revisión legal"', name == 'Enviar antecedentes para revisión legal', repr(name)))

        # 2) H3 Garantias sin "verified"
        h3 = pg.evaluate(JS_NAME, pg.locator('h3', has_text='Garantías de transparencia').first.element_handle())
        results.append(('H3 Garantias = "Garantías de transparencia profesional"', h3 == 'Garantías de transparencia profesional', repr(h3)))

        # 3) summary FAQ: solo la pregunta
        first = pg.locator('details summary').first
        sname = pg.evaluate(JS_NAME, first.element_handle())
        ok3 = 'expand_more' not in sname and sname.startswith('¿')
        results.append(('summary FAQ sin expand_more', ok3, repr(sname[:70])))

        # 4) todos los interactivos con nombre accesible no vacio
        vacios = pg.evaluate('''Array.from(document.querySelectorAll('button, a, summary')).filter(el => {
            const lab = el.getAttribute('aria-label');
            if (lab && lab.trim()) return false;
            const walk = (n) => {
                if (n.nodeType === 1) {
                    if (n.getAttribute('aria-hidden') === 'true') return '';
                    if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return '';
                    return Array.from(n.childNodes).map(walk).join(' ');
                }
                if (n.nodeType === 3) return n.textContent;
                return '';
            };
            const nm = walk(el).replace(/\\s+/g, ' ').trim();
            const cs = window.getComputedStyle(el);
            return nm === '' && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && el.offsetParent !== null;
        }).map(el => el.tagName + '#' + el.id + '.' + el.className.slice(0, 40))''')
        results.append(('0 interactivos visibles sin nombre accesible', len(vacios) == 0, vacios))

        # 5) ningun nombre accesible contaminado con nombre de icono
        ICONS = ['gavel', 'verified', 'check_circle', 'expand_more', 'arrow_forward', 'menu', 'keyboard_arrow_down', 'calculate', 'payments']
        sucios = pg.evaluate('''(icons) => Array.from(document.querySelectorAll('button, a, summary, h1, h2, h3')).filter(el => {
            const walk = (n) => {
                if (n.nodeType === 1) {
                    if (n.getAttribute('aria-hidden') === 'true') return '';
                    if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return '';
                    return Array.from(n.childNodes).map(walk).join(' ');
                }
                if (n.nodeType === 3) return n.textContent;
                return '';
            };
            const nm = walk(el).replace(/\\s+/g, ' ').trim();
            return icons.some(ic => nm === ic || nm.startsWith(ic + ' ') || nm.includes(' ' + ic + ' ') || nm.endsWith(' ' + ic));
        }).length''', ICONS)
        results.append(('0 nombres accesibles con texto de icono', sucios == 0, sucios))

        # 6) nombre accesible del hamburger y flechas del carrusel
        menu = pg.evaluate(JS_NAME, pg.locator('button[aria-label="Abrir menú"]').element_handle())
        results.append(('hamburguesa = "Abrir menú"', menu == 'Abrir menú', repr(menu)))

        # 7) sin errores JS
        results.append(('cero errores JS', len(errors) == 0, errors[:3]))

        # 8) accesible name real del boton via ARIA de Playwright (role selector)
        found = pg.get_by_role('button', name='Enviar antecedentes para revisión legal').count()
        results.append(('get_by_role encuentra boton de envio por nombre exacto', found == 1, found))

        b.close()
finally:
    srv.terminate()

fails = 0
for label, ok, detail in results:
    print(('PASS' if ok else 'FAIL'), '|', label, '|', detail)
    if not ok:
        fails += 1
print('RESUMEN:', len(results) - fails, 'de', len(results), 'OK')
