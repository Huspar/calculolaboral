import os
import subprocess
import shutil
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_PATH = os.path.join(BASE_DIR, 'api', 'assets', 'kit_pyme_files', '00_Manual_Instrucciones_Blindaje_Laboral_Pyme.html')
PDF_OUT_1 = os.path.join(BASE_DIR, 'Kit_Blindaje_Laboral_Pyme_2026', '00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf')
PDF_OUT_2 = os.path.join(BASE_DIR, 'assets', '00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf')
PDF_OUT_3 = os.path.join(BASE_DIR, 'api', 'assets', 'kit_pyme_files', '00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf')

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]

def find_browser():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    return None

def generate_pdf():
    browser = find_browser()
    if not browser:
        raise RuntimeError("No Chrome or Edge browser executable found.")

    os.makedirs(os.path.dirname(PDF_OUT_1), exist_ok=True)
    os.makedirs(os.path.dirname(PDF_OUT_2), exist_ok=True)
    os.makedirs(os.path.dirname(PDF_OUT_3), exist_ok=True)

    file_url = f"file:///{HTML_PATH.replace(os.sep, '/')}"
    cmd = [
        browser,
        "--headless",
        "--disable-gpu",
        "--no-margins",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_OUT_1}",
        file_url
    ]

    print(f"Compiling PDF with: {browser}")
    print(f"Source HTML: {file_url}")
    print(f"Output: {PDF_OUT_1}")

    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    time.sleep(1)

    if not os.path.exists(PDF_OUT_1) or os.path.getsize(PDF_OUT_1) == 0:
        raise RuntimeError("PDF generation failed or output is empty.")

    size = os.path.getsize(PDF_OUT_1)
    print(f"Successfully generated {PDF_OUT_1} ({size} bytes)")

    # Copy to assets and api/assets
    shutil.copy2(PDF_OUT_1, PDF_OUT_2)
    print(f"Copied to {PDF_OUT_2}")
    shutil.copy2(PDF_OUT_1, PDF_OUT_3)
    print(f"Copied to {PDF_OUT_3}")

if __name__ == '__main__':
    generate_pdf()
