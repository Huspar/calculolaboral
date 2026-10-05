// Genera los manuales PDF de los kits desde su HTML (api/assets/kit_*_files/*.html).
// Después, `python scripts/fix_kit_content.py` los copia dentro de los zip de los kits.
// Uso: node scripts/render_kit_manuals.mjs
// Requiere playwright-core (NODE_PATH o instalado) y Microsoft Edge.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const base = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api', 'assets');

const MANUALES = [
    ['kit_pyme_files/00_Manual_Instrucciones_Blindaje_Laboral_Pyme.html', 'kit_pyme_files/00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf'],
    ['kit_datos_files/0_Manual_Instrucciones_Paso_a_Paso_Ley_21719.html', 'kit_datos_files/0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf'],
];

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
for (const [html, pdf] of MANUALES) {
    await page.goto('file:///' + path.join(base, html).replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(base, pdf), preferCSSPageSize: true, printBackground: true });
    console.log('ok', pdf);
}
await browser.close();
