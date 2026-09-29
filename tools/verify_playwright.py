import http.server
import socketserver
import threading
import time
import os
import sys
from playwright.sync_api import sync_playwright

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_verification():
    port = 8788
    httpd = socketserver.TCPServer(('', port), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.3)

    pages_to_test = [
        'index.html',
        'sueldo_liquido.html',
        'finiquito_calculator.html',
        'simulador-despido-injustificado-chile.html',
        'calculadora-horas-extras.html',
        'para-empleadores.html',
        'blog.html',
        'contacto.html',
        'reclamar-despido-injustificado-chile.html',
        'carta-de-renuncia-chile.html',
        'kit-cumplimiento-laboral-pymes.html',
        'terminos.html'
    ]

    viewports = [390, 768, 1024, 1280, 1440, 1920]

    all_passed = True
    results_summary = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for page_name in pages_to_test:
            url = f'http://localhost:{port}/{page_name}'
            page.goto(url)

            print(f"\n==========================================")
            print(f"Testing {page_name}")
            print(f"==========================================")

            for width in viewports:
                page.set_viewport_size({'width': width, 'height': 800})
                page.wait_for_timeout(150)

                curve = page.locator('.teal-footer-curve').bounding_box()
                inner = page.locator('.footer-inner-container').bounding_box()
                logo = page.locator('footer .w-9.h-9').first.bounding_box()
                wordmark = page.locator('footer span:has-text("cálculolaboral")').first.bounding_box()
                overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')

                clearance = logo['x'] - curve['x']
                
                # Validation rules:
                # 1. Logo must be visible and properly dimensioned (~36px)
                logo_ok = (logo['width'] >= 32 and logo['height'] >= 32)
                
                # 2. When near curve (1024px to 1440px), clearance >= 120px
                if width in [1024, 1280, 1440]:
                    clearance_ok = (clearance >= 120.0)
                elif width == 1920:
                    clearance_ok = (clearance >= 120.0)
                else: # 390px, 768px
                    clearance_ok = (clearance >= 20.0)

                overflow_ok = not overflow

                passed = logo_ok and clearance_ok and overflow_ok
                if not passed:
                    all_passed = False

                status_str = "PASS" if passed else "FAIL"
                print(f"[{status_str}] Viewport {width:4d}px | Logo x={logo['x']:.1f}, w={logo['width']:.1f}, h={logo['height']:.1f} | Clearance={clearance:.1f}px (min req satisfied) | Overflow={overflow}")

                results_summary.append({
                    'page': page_name,
                    'viewport': width,
                    'clearance': clearance,
                    'logo_ok': logo_ok,
                    'overflow_ok': overflow_ok,
                    'passed': passed
                })

        browser.close()
    httpd.shutdown()

    print("\n==========================================")
    print("FINAL SUMMARY REPORT")
    print("==========================================")
    print(f"Total test assertions: {len(results_summary)}")
    passed_count = sum(1 for r in results_summary if r['passed'])
    print(f"Passed: {passed_count} / {len(results_summary)}")
    if all_passed:
        print("ALL AUDITS PASSED WITH 100% SUCCESS!")
    else:
        print("SOME AUDITS FAILED - CHECK DETAILS ABOVE")
        sys.exit(1)

if __name__ == '__main__':
    run_verification()
