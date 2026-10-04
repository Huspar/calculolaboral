// Fotografía las dos páginas de la muestra (HTML generado por make_muestra_carta.py) como PNG.
// Uso: node scripts/make_muestra_carta.mjs <entrada.html> <salida-hoja.png> <salida-carta.png>
// Requiere playwright-core y Microsoft Edge instalado.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const [, , input, outHoja, outCarta] = process.argv;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
await page.goto('file:///' + input.replace(/\\/g, '/'));
await page.locator('#page1').screenshot({ path: outHoja });
await page.locator('#page2').screenshot({ path: outCarta });
await browser.close();
console.log('ok');
