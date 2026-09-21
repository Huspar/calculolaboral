import os
import zipfile
import base64
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT_DIR = os.path.join(BASE_DIR, 'Kit_Blindaje_Laboral_Pyme_2026')
ZIP_OUT_ROOT = os.path.join(BASE_DIR, 'Kit_Blindaje_Laboral_Pyme_2026.zip')
ZIP_OUT_API = os.path.join(BASE_DIR, 'api', 'assets', 'Kit_Blindaje_Laboral_Pyme_2026.zip')
ZIP_OUT_ASSETS = os.path.join(BASE_DIR, 'assets', 'Kit_Blindaje_Laboral_Pyme_2026.zip')
BASE64_OUT = os.path.join(BASE_DIR, 'api', 'assets', 'kit-base64.js')

def build_zip():
    print(f"Packaging from: {KIT_DIR}")
    
    with zipfile.ZipFile(ZIP_OUT_ROOT, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(KIT_DIR):
            for file in files:
                full_path = os.path.join(root, file)
                # Preserve folder structure relative to BASE_DIR so it has Kit_Blindaje_Laboral_Pyme_2026 prefix
                rel_path = os.path.relpath(full_path, BASE_DIR)
                zf.write(full_path, arcname=rel_path)
                print(f"Added: {rel_path} ({os.path.getsize(full_path)} bytes)")

    size = os.path.getsize(ZIP_OUT_ROOT)
    print(f"\nSuccessfully built {ZIP_OUT_ROOT} ({size} bytes)")

    # Copy to api/assets and assets
    shutil.copy2(ZIP_OUT_ROOT, ZIP_OUT_API)
    print(f"Copied to {ZIP_OUT_API}")
    shutil.copy2(ZIP_OUT_ROOT, ZIP_OUT_ASSETS)
    print(f"Copied to {ZIP_OUT_ASSETS}")

    # Generate base64 for api/assets/kit-base64.js
    with open(ZIP_OUT_ROOT, 'rb') as f:
        b64_str = base64.b64encode(f.read()).decode('utf-8')

    with open(BASE64_OUT, 'w', encoding='utf-8') as f:
        f.write('// In-memory base64 package for Vercel Serverless Function (Kit Blindaje Laboral Pyme 2026)\n')
        f.write(f'module.exports = "{b64_str}";\n')

    print(f"Updated {BASE64_OUT} ({len(b64_str)} base64 chars)")

if __name__ == '__main__':
    build_zip()
