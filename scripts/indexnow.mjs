// Avisa a IndexNow (Bing y otros buscadores) de páginas nuevas o modificadas.
// Ejecutar DESPUÉS de publicar en producción (los buscadores leen la página en vivo).
//
//   node scripts/indexnow.mjs --changed          páginas .html cambiadas en el último commit (HEAD~1..HEAD)
//   node scripts/indexnow.mjs --changed=main~3   páginas .html cambiadas desde esa referencia de git
//   node scripts/indexnow.mjs --all              todas las URL de sitemap.xml
//   node scripts/indexnow.mjs ley-40-horas-chile-2026 sueldo_liquido   URL o nombres de página concretos
//   Agregar --dry para ver la lista sin enviar nada.
//
// La clave es pública por diseño: el archivo <clave>.txt en la raíz del sitio demuestra que el dominio es nuestro.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'calculolaboral.cl';
const KEY = '0359a0bf81d1fbe3c661316e3e63a540';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NO_INDEXAR = /^(404|compra-exitosa|_template|home-v2|ejemplo)/;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const rest = args.filter(a => a !== '--dry');
const urlDe = nombre => (nombre === 'index' ? `https://${HOST}/` : `https://${HOST}/${nombre}`);

function desdeSitemap() {
  const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

function desdeGit(ref) {
  const salida = execFileSync('git', ['diff', '--name-only', ref, 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const enSitemap = new Set(desdeSitemap());
  return salida.split(/\r?\n/)
    .filter(f => /^[^/]+\.html$/.test(f))
    .map(f => f.replace(/\.html$/, ''))
    .filter(n => !NO_INDEXAR.test(n))
    .map(urlDe)
    .filter(u => enSitemap.has(u));
}

let urls = [];
for (const a of rest) {
  if (a === '--all') urls.push(...desdeSitemap());
  else if (a === '--changed') urls.push(...desdeGit('HEAD~1'));
  else if (a.startsWith('--changed=')) urls.push(...desdeGit(a.slice('--changed='.length)));
  else if (a.startsWith('https://')) urls.push(a);
  else urls.push(urlDe(a.replace(/\.html$/, '')));
}
urls = [...new Set(urls)];

if (!urls.length) {
  console.log('No hay URL para enviar. Usa --changed, --all o nombres de página.');
  process.exit(0);
}
console.log(`${urls.length} URL:`);
urls.forEach(u => console.log('  ' + u));
if (dry) { console.log('(modo --dry: no se envió nada)'); process.exit(0); }

const resp = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls })
});
// 200 = recibido; 202 = recibido, la clave se validará después; 4xx = revisar clave/URL
console.log(`IndexNow respondió ${resp.status} ${resp.statusText}`);
if (resp.status >= 400) {
  console.log(await resp.text());
  process.exit(1);
}
