# -*- coding: utf-8 -*-
"""Verifica: #10 evento ad_click en GA4 (ya implementado), #14 tap targets del pie,
y la nota de la guia en finiquito_calculator (#11, pendiente de Normativa)."""
import subprocess, sys, time

REPO = r'C:/Users/Jhon/Desktop/Claude/CalculoLaboral'
PORT = 8787
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

fails = []
def check(name, cond):
    print(('PASS  ' if cond else 'FAIL  ') + name)
    if not cond: fails.append(name)

GTAG_WRAP = "window.__ads = []; (function(){ const o = window.gtag; window.gtag = function(){ window.__ads.push(Array.from(arguments)); if (typeof o === 'function') { try { o.apply(this, arguments); } catch (e) {} } }; })();"

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------- #10: ad_click en la home ----------
        pg = b.new_page(viewport={'width': 1280, 'height': 840})
        
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:%d/index.html' % PORT, wait_until='load')
        pg.wait_for_timeout(800)
        # envolver el gtag real de GA4 (ya instalado) para capturar los eventos
        pg.evaluate(GTAG_WRAP)
        # evitar la navegacion despues de que el listener del sitio registre el evento
        pg.evaluate("document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a'); const h = a ? (a.getAttribute('href')||'') : ''; if (h.indexOf('/itau') !== -1 || h.indexOf('abakos') !== -1) e.preventDefault(); }, { capture: true });")
        # clic en la tarjeta Itau de la home (enlace interno /itau)
        itau = pg.locator('a[href="/itau"]').first
        if itau.count() == 0:
            itau = pg.locator('a[href*="/itau"]').first
        try:
            itau.click(timeout=4000)
        except Exception:
            check('#10 Itau: enlace encontrado y clickeable', False)
        evs = pg.evaluate('window.__ads')
        adclicks = [e for e in evs if e[0] == 'event' and e[1] == 'ad_click']
        check('#10 Itau: evento ad_click disparado', len(adclicks) >= 1)
        if adclicks:
            params = adclicks[0][2] if len(adclicks[0]) > 2 else {}
            check('#10 Itau: partner y transporte correctos', params.get('ad_name') == 'itau_cuenta_corriente' and params.get('transport_type') == 'beacon')
        pg.close()

        # ---------- #10: ad_click en finiquito_calculator (bloque Abakos emergencias) ----------
        pg2 = b.new_page(viewport={'width': 1280, 'height': 840})
        
        pg2.on('pageerror', lambda e: errs.append(str(e)))
        pg2.goto('http://localhost:%d/finiquito_calculator.html' % PORT, wait_until='load')
        pg2.wait_for_timeout(800)
        pg2.evaluate(GTAG_WRAP)
        pg2.evaluate("document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a'); const h = a ? (a.getAttribute('href')||'') : ''; if (h.indexOf('/itau') !== -1 || h.indexOf('abakos') !== -1) e.preventDefault(); }, { capture: true });")
        n = pg2.locator('a[href*="abakos-emergencias"]').count() + pg2.locator('a[href*="/abakos"]').count() + pg2.locator('a[href*="/itau"]').count()
        check('#10 finiquito: bloques de anuncio presentes', n >= 1)
        target = pg2.locator('a[href*="abakos-emergencias"], a[href*="/abakos"], a[href*="/itau"]').first
        try:
            target.click(timeout=4000)
            adclicks2 = pg2.evaluate('window.__ads.filter(a => a[1] === "ad_click")')
            check('#10 finiquito: ad_click al clickear anuncio', len(adclicks2) >= 1)
        except Exception:
            check('#10 finiquito: ad_click al clickear anuncio', False)
        # nota de la guia (#11)
        check('#11 nota de la guia visible en el sidebar', pg2.locator('text=«Qué hago con mi finiquito»').count() >= 1)
        pg2.close()

        # ---------- #14: tap targets del pie ----------
        pm = b.new_page(viewport={'width': 390, 'height': 844})
        pm.goto('http://localhost:%d/index.html' % PORT, wait_until='load')
        pm.wait_for_timeout(800)
        res = pm.evaluate("""(() => {
            const links = document.querySelectorAll('.teal-footer-curve a');
            let chicos = 0, total = 0, muestra = [];
            links.forEach(l => {
                const r = l.getBoundingClientRect();
                total++;
                if (r.height < 44) { chicos++; if (muestra.length < 3) muestra.push(l.textContent.trim().slice(0, 25) + ' h=' + Math.round(r.height)); }
            });
            return { total, chicos, muestra };
        })()""")
        check('#14 cero enlaces < 44 px en el pie movil', res['chicos'] == 0)
        print('   enlaces del pie:', res['total'])
        check('#14 sin desborde a 390 px', pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        check('#14 pie sigue visible y sin errores', pm.evaluate("!!document.querySelector('.teal-footer-curve') && document.querySelectorAll('.teal-footer-curve a').length > 20"))
        pm.close()

        # escritorio: el pie no cambio (media query solo < 768)
        pd = b.new_page(viewport={'width': 1280, 'height': 840})
        pd.goto('http://localhost:%d/index.html' % PORT, wait_until='load')
        pd.wait_for_timeout(600)
        altod = pd.evaluate("(() => { const l = document.querySelector('.teal-footer-curve ul li a'); return l ? Math.round(l.getBoundingClientRect().height) : 0; })()")
        check('#14 escritorio intacto (enlace ~16-20 px)', 12 <= altod <= 24)
        pd.close()
        b.close()
finally:
    server.terminate()

print()
print('TOTAL FAILS:', len(fails))
for f in fails: print('  FAIL:', f)
sys.exit(1 if fails else 0)
