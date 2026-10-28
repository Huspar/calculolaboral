/* Compara producción contra origin/main (no contra el árbol de trabajo). */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const git = cmd => execSync('git ' + cmd, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function h1(h) { const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; }
function desc(h) { const m = h.match(/<meta[^>]*name=["']description["'][^>]*>/i); if (!m) return ''; const c = m[0].match(/content=["']([\s\S]*?)["']/i); return c ? c[1].replace(/\s+/g, ' ').trim() : ''; }

(async () => {
    const sm = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const urls = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    const difs = [];

    for (const u of urls) {
        let rel = u.replace('https://calculolaboral.cl', '').replace(/^\//, '') || 'index.html';
        if (rel.endsWith('/')) rel += 'index.html';
        if (!rel.endsWith('.html')) rel += '.html';

        let base;
        try { base = git('show origin/main:' + rel); } catch (e) { difs.push([rel, 'no está en origin/main']); continue; }

        let prod;
        try { prod = await (await fetch(u)).text(); } catch (e) { difs.push([rel, 'no se pudo consultar']); continue; }

        const campos = [];
        if (h1(prod) !== h1(base)) campos.push('H1');
        if (desc(prod) !== desc(base)) campos.push('descripción');
        if (campos.length) difs.push([rel, campos.join(' + ')]);
    }

    console.log('Páginas revisadas:', urls.length);
    console.log('Con diferencias frente a origin/main:', difs.length);
    difs.forEach(([f, c]) => console.log(' -', f, '→', c));
})();
