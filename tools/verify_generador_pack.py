# -*- coding: utf-8 -*-
"""Prueba end-to-end del pack de 5 liquidaciones ($9.990) sin pagar de verdad:
simula el retorno de Flow via localStorage (storedUnlock) y verifica el credito por credito."""
import subprocess, sys, time

REPO = r'C:/Users/Jhon/Desktop/Claude/CalculoLaboral'
PORT = 8785
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', REPO],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

fails = []
def check(name, cond):
    print(('PASS  ' if cond else 'FAIL  ') + name)
    if not cond: fails.append(name)

def dv_rut(num):
    s, f = 0, 2
    for d in reversed(str(num)):
        s += int(d) * f
        f = 2 if f == 7 else f + 1
    r = 11 - (s % 11)
    return '0' if r == 11 else 'K' if r == 10 else str(r)

RUT_EMP = '76.123.456-' + dv_rut(76123456)
RUTS_TRAB = ['12.345.678-' + dv_rut(12345678),
             '11.111.111-' + dv_rut(11111111),
             '13.131.313-' + dv_rut(13131313),
             '14.141.414-' + dv_rut(14141414),
             '15.151.515-' + dv_rut(15151515),
             '16.161.616-' + dv_rut(16161616)]
URL = 'http://localhost:%d/generador-liquidacion-sueldo.html' % PORT

def llenar_trabajador(pg, nombre, rut, sueldo='650000'):
    pg.fill('#lq-t-nombre', nombre)
    pg.fill('#lq-t-rut', rut)
    pg.fill('#lq-t-sueldo', sueldo)
    pg.locator('#lq-t-sueldo').blur()

try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 840})
        pg.add_init_script("window.print = function(){ window.__printed = (window.__printed||0)+1; };")
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))

        # P1: estado inicial, botón y FAQ del pack
        pg.goto(URL, wait_until='load')
        pg.wait_for_selector('#lq-doc *', timeout=20000)
        pg.wait_for_timeout(1200)
        check('P1 boton pack visible con precio', pg.locator('#lq-comp-pack-btn').is_visible() and 'Pack de 5' in pg.locator('#lq-comp-pack-txt').inner_text())
        check('P2 FAQ del pack presente', pg.locator('details.lq-faq summary', has_text='varias liquidaciones este mes').count() == 1)
        b1 = pg.locator('#lq-comp-pack-btn').bounding_box()
        check('P3 boton pack >= 44 px', b1 and b1['height'] >= 44)

        # P2: flujo de compra del pack desde el boton (modal de Flow, sin pagar)
        pg.fill('#lq-emp-razon', 'Comercial Los Aromos SpA')
        pg.fill('#lq-emp-rut', RUT_EMP)
        llenar_trabajador(pg, 'Ana Trabajadora Uno', RUTS_TRAB[0])
        try:
            pg.wait_for_function("document.getElementById('lq-descargar').disabled === false", timeout=25000)
        except Exception:
            pass
        pg.locator('#lq-comp-pack-btn').click()
        pg.wait_for_selector('#clc-title', timeout=8000)
        check('P4 boton pack abre el modal de pago', pg.locator('#clc-title').is_visible())
        pg.locator('[data-clc="cancel"]').click()
        pg.wait_for_timeout(300)

        # P3: retorno simulado de Flow con el unlock del pack
        pg.evaluate("""(() => {
            localStorage.setItem('cl_unlock_liquidacion5', JSON.stringify({ p: 'liquidacion5', o: 'GL5-TEST-1', e: String(Math.floor(Date.now()/1000)), sig: 'test', expiresAt: Date.now() + 48*3600*1000 }));
        })()""")
        pg.goto(URL + '?p=liquidacion5&o=GL5-TEST-1&e=' + str(int(time.time())) + '&sig=test', wait_until='load')
        pg.wait_for_timeout(2000)
        st = pg.evaluate("""(() => {
            const packs = JSON.parse(localStorage.getItem('cl_liq_packs') || '{}');
            const pagos = JSON.parse(localStorage.getItem('cl_liq_pagos') || '{}');
            const pack = packs['GL5-TEST-1'];
            return { restantes: pack ? pack.restantes : null,
                     bound: Object.keys(pagos).length,
                     estado: document.getElementById('lq-estado').textContent,
                     btn: document.getElementById('lq-comp-pack-txt').textContent };
        })()""")
        check('P5 pack creado y primer credito consumido (4 de 5)', st['restantes'] == 4)
        check('P6 primer credito ligado al trabajador pendiente', st['bound'] >= 1)
        check('P7 estado muestra pack', 'quedan 4 liquidaciones' in st['estado'].lower() or 'Te quedan 4' in st['estado'])
        check('P8 boton pack muestra restantes', 'Quedan 4' in st['btn'])

        # P4: descargar worker A de nuevo (ya cubierto, no consume)
        pg.locator('#lq-descargar').click()
        pg.wait_for_timeout(400)
        printed = pg.evaluate('window.__printed || 0')
        rest = pg.evaluate("JSON.parse(localStorage.getItem('cl_liq_packs')||'{}')['GL5-TEST-1'].restantes")
        check('P9 re-descarga del mismo trabajador no consume credito', printed == 1 and rest == 4)

        # P5: consumir los 4 restantes con trabajadores nuevos
        for i, (nombre, rut) in enumerate([('Benito Dos', RUTS_TRAB[1]), ('Carla Tres', RUTS_TRAB[2]), ('Diego Cuatro', RUTS_TRAB[3]), ('Elena Cinco', RUTS_TRAB[4])]):
            pg.locator('#lq-nuevo').click()
            pg.wait_for_timeout(300)
            llenar_trabajador(pg, nombre, rut)
            pg.wait_for_timeout(400)
            pg.locator('#lq-descargar').click()
            pg.wait_for_timeout(500)
            rest = pg.evaluate("JSON.parse(localStorage.getItem('cl_liq_packs')||'{}')['GL5-TEST-1'].restantes")
            modal = pg.locator('#clc-title').count() and pg.locator('#clc-title').is_visible()
            check('P10.%d worker %d consume credito (restantes=%s, sin modal)' % (i + 1, i + 2, rest), rest == 3 - i and not modal)

        printed = pg.evaluate('window.__printed || 0')
        check('P11 cinco descargas impresas en total', printed == 5)

        # P6: pack agotado -> nuevo trabajador vuelve al flujo de compra individual
        pg.locator('#lq-nuevo').click()
        pg.wait_for_timeout(300)
        llenar_trabajador(pg, 'Felipe Seis', RUTS_TRAB[5])
        pg.wait_for_timeout(400)
        pg.locator('#lq-descargar').click()
        try:
            pg.wait_for_selector('#clc-title', timeout=8000)
            check('P12 pack agotado vuelve al checkout individual', pg.locator('#clc-title').is_visible())
            pg.locator('[data-clc="cancel"]').click()
        except Exception:
            check('P12 pack agotado vuelve al checkout individual', False)
        pg.wait_for_timeout(300)
        btn_txt = pg.locator('#lq-comp-pack-txt').inner_text()
        check('P13 boton pack vuelve al precio tras agotarse', 'Pack de 5' in btn_txt and '9.990' in btn_txt)

        # P7: boton pack sin creditos abre el checkout del pack
        pg.locator('#lq-comp-pack-btn').click()
        try:
            pg.wait_for_selector('#clc-title', timeout=8000)
            check('P14 comprar pack otra vez abre el modal', pg.locator('#clc-title').is_visible())
            pg.locator('[data-clc="cancel"]').click()
        except Exception:
            check('P14 comprar pack otra vez abre el modal', False)

        errs_reales = [e for e in errs if '501' not in e and 'api/unlock' not in e]
        check('P15 sin errores de consola (se tolera el 501 del /api/unlock local)', len(errs_reales) == 0)
        if errs_reales: print('   errores:', errs_reales[:6])
        pg.close()

        # movil
        pm = b.new_page(viewport={'width': 390, 'height': 844})
        pm.goto(URL, wait_until='load')
        pm.wait_for_timeout(1000)
        check('M1 sin desborde a 390 px', pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        pm.locator('#lq-comp-pack-btn').scroll_into_view_if_needed()
        check('M2 boton pack visible en movil', pm.locator('#lq-comp-pack-btn').is_visible())
        bm = pm.locator('#lq-comp-pack-btn').bounding_box()
        check('M3 boton pack >= 44 px en movil', bm and bm['height'] >= 44)
        pm.close()
        b.close()
finally:
    server.terminate()

print()
print('TOTAL FAILS:', len(fails))
for f in fails: print('  FAIL:', f)
sys.exit(1 if fails else 0)
