import http.server
import socketserver
import threading
import time
import os
from playwright.sync_api import sync_playwright

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def test_page_over_http(filename='index.html'):
    port = 8765
    httpd = socketserver.TCPServer(('', port), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.3)

    os.makedirs('tools/screenshots', exist_ok=True)
    print(f"=== Testing http://localhost:{port}/{filename} ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto(f'http://localhost:{port}/{filename}')

        for width in [390, 768, 1024, 1280, 1440, 1920]:
            page.set_viewport_size({'width': width, 'height': 800})
            page.wait_for_timeout(200)
            
            footer = page.locator('footer')
            curve = page.locator('.teal-footer-curve').bounding_box()
            inner = page.locator('.footer-inner-container').bounding_box()
            logo = page.locator('footer .w-9.h-9').bounding_box()
            wordmark = page.locator('footer span:has-text("cálculolaboral")').bounding_box()
            overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
            
            clearance = logo['x'] - curve['x']
            print(f"Viewport {width:4d}px: logo x={logo['x']:.1f}, w={logo['width']:.1f} | clearance={clearance:.1f}px | overflow={overflow}")
            
            # Screenshot of footer
            footer.screenshot(path=f'tools/screenshots/{filename.replace(".html", "")}_{width}px.png')
            
        browser.close()
    httpd.shutdown()

if __name__ == '__main__':
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
    test_page_over_http(target)
