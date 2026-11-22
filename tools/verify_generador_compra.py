# -*- coding: utf-8 -*-
"""Verifica las mejoras de compra del generador de liquidaciones (feedback + barra movil)."""
import subprocess, sys, time, os

REPO = r'C:/Users/Jhon/Desktop/Claude/CalculoLaboral'
PORT = 8777

def dv_rut(num):
    s, f = 0, 2
    for d in reversed(str(num)):
        s += int(d) * f
        f = 2 if f == 7 else f + 1
    r = 11 - (s % 11)
    return '0' if r == 11 else 'K' if r == 10 else str(r)

RUT_EMP = '76.123.456-' + dv_rut(76123456)
RUT_TRAB = '12.345.678-' + dv_rut(12345678)

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

        # ---------- ESCRITORIO ----------
        pg = b.new_page(viewport={'width': 1280, 'height': 840})
        errors = []
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://localhost:%d/generador-liquidacion-sueldo.html' % PORT, wait_until='load')
        pg.wait_for_selector('#lq-doc *', timeout=20000)
        pg.wait_for_timeout(1200)

        check('E1 barra existe en el DOM', pg.evaluate("!!document.getElementById('lq-barra-compra')"))
        check('E2 barra oculta en escritorio (CSS)', pg.evaluate("getComputedStyle(document.getElementById('lq-barra-compra')).display === 'none'"))

        # clic en comprar con formulario vacio -> feedback
        pg.evaluate('window.scrollTo(0, 0)')
        try:
            pg.wait_for_function("document.getElementById('lq-estado').textContent.indexOf('Completa el formulario') >= 0", timeout=25000)
        except Exception:
            pass
        pg.locator('.lq-comp-btn', has_text='Comprar solo esta liquidación').first.click()
        pg.wait_for_timeout(500)
        estado = pg.locator('#lq-estado').inner_text()
        check('E3 feedback lista los faltantes', 'Para comprar falta completar' in estado and 'razón social' in estado and 'sueldo base' in estado)
        check('E4 foco va al primer campo faltante', pg.evaluate("(document.activeElement && document.activeElement.id) || ''") == 'lq-emp-razon')

        # completar el formulario -> boton habilitado -> modal de checkout (sin pagar)
        pg.fill('#lq-emp-razon', 'Comercial Los Aromos SpA')
        pg.fill('#lq-emp-rut', RUT_EMP)
        pg.fill('#lq-t-nombre', 'María Pérez Soto')
        pg.fill('#lq-t-rut', RUT_TRAB)
        pg.fill('#lq-t-sueldo', '650000')
        pg.locator('#lq-t-sueldo').blur()
        try:
            pg.wait_for_function("document.getElementById('lq-descargar').disabled === false", timeout=25000)
            check('E5 botón se habilita al completar', True)
        except Exception:
            check('E5 botón se habilita al completar', False)
        pg.locator('.lq-comp-btn', has_text='Comprar solo esta liquidación').first.click()
        try:
            pg.wait_for_selector('#clc-title', timeout=8000)
            check('E6 clic habilitado abre el modal de pago', pg.locator('#clc-title').inner_text() == 'Antes de ir a pagar')
            pg.locator('[data-clc="cancel"]').click()
            pg.wait_for_timeout(300)
            check('E7 modal se puede cerrar sin pagar', not pg.locator('#clc-title').is_visible())
        except Exception:
            check('E6 clic habilitado abre el modal de pago', False)
            check('E7 modal se puede cerrar sin pagar', False)

        check('E8 sin errores de consola en escritorio', len(errors) == 0)
        if errors: print('   errores:', errors[:5])
        pg.close()

        # ---------- MOVIL 390 ----------
        pm = b.new_page(viewport={'width': 390, 'height': 844})
        errors_m = []
        pm.on('console', lambda m: errors_m.append(m.text) if m.type == 'error' else None)
        pm.on('pageerror', lambda e: errors_m.append(str(e)))
        pm.goto('http://localhost:%d/generador-liquidacion-sueldo.html' % PORT, wait_until='load')
        pm.wait_for_selector('#lq-doc *', timeout=20000)
        pm.wait_for_timeout(1200)

        check('M1 sin desborde horizontal a 390 px', pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        check('M2 barra oculta arriba del todo', pm.evaluate("document.getElementById('lq-barra-compra').hidden === true"))

        # barra visible cuando la vista previa entra pero la zona de compra no
        pm.evaluate("var el = document.getElementById('lq-doc'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8)")
        pm.wait_for_timeout(700)
        vis = pm.evaluate("var b = document.getElementById('lq-barra-compra'); !b.hidden && getComputedStyle(b).display !== 'none'")
        check('M3 barra visible con vista previa en pantalla', vis)
        if vis:
            box = pm.locator('#lq-barra-btn').bounding_box()
            check('M4 botón de barra >= 44 px de alto', box and box['height'] >= 44)
            txt = pm.locator('#lq-barra-txt').inner_text()
            check('M5 barra muestra precio', 'Descargar PDF' in txt and '2.990' in txt)

        # clic en barra con formulario vacio -> mismo feedback
        try:
            pm.wait_for_function("document.getElementById('lq-estado').textContent.indexOf('Completa el formulario') >= 0", timeout=25000)
        except Exception:
            pass
        pm.locator('#lq-barra-btn').click()
        pm.wait_for_timeout(400)
        est = pm.locator('#lq-estado').inner_text()
        check('M6 clic en barra con datos faltantes da feedback', 'Para comprar falta completar' in est)

        # completar y comprar desde la barra
        pm.fill('#lq-emp-razon', 'Comercial Los Aromos SpA')
        pm.fill('#lq-emp-rut', RUT_EMP)
        pm.fill('#lq-t-nombre', 'María Pérez Soto')
        pm.fill('#lq-t-rut', RUT_TRAB)
        pm.fill('#lq-t-sueldo', '650000')
        pm.locator('#lq-t-sueldo').blur()
        try:
            pm.wait_for_function("document.getElementById('lq-descargar').disabled === false", timeout=25000)
            ok = True
        except Exception:
            ok = False
        check('M7 botón habilitado en móvil', ok)
        # dejar la vista previa en pantalla sin la zona de compra
        pm.evaluate("var el = document.getElementById('lq-doc'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8)")
        pm.wait_for_timeout(600)
        pm.locator('#lq-barra-btn').click()
        try:
            pm.wait_for_selector('#clc-title', timeout=8000)
            check('M8 comprar desde la barra abre el modal', pm.locator('#clc-title').is_visible())
            pm.locator('[data-clc="cancel"]').click()
            pm.wait_for_timeout(300)
        except Exception:
            check('M8 comprar desde la barra abre el modal', False)

        check('M9 sin errores de consola en móvil', len(errors_m) == 0)
        if errors_m: print('   errores:', errors_m[:5])

        # barra no aparece en impresión
        pm.emulate_media(media='print')
        check('M10 barra oculta al imprimir', pm.evaluate("getComputedStyle(document.getElementById('lq-barra-compra')).display === 'none'"))
        pm.emulate_media(media='screen')

        pm.close()
        b.close()
finally:
    server.terminate()

print()
print('RESULTADO: %d/%d PASS' % (len([1]), len([])) if False else '')
print('TOTAL FAILS:', len(fails))
for f in fails: print('  FAIL:', f)
sys.exit(1 if fails else 0)
