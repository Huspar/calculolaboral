/* Compara los scripts que sirve producción con los que existen en el repo. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

(async () => {
    const sm = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const urls = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    const refs = new Set();
    const errores = [];

    for (const u of urls) {
        try {
            const r = await fetch(u);
            const h = await r.text();
            for (const m of h.matchAll(/<script[^>]+src=["'](\/js\/[^"'?]+)/g)) {
                refs.add(m[1].replace('/js/', ''));
            }
        } catch (e) {
            errores.push(u + ' :: ' + e.message);
        }
    }

    const local = new Set(fs.readdirSync(path.join(root, 'js')));
    const faltan = [...refs].filter(f => !local.has(f));

    console.log('URLs del sitemap:', urls.length);
    console.log('Scripts referenciados en producción:', refs.size);
    console.log('Faltan en el repo:', faltan.length ? faltan.join(', ') : '(ninguno)');
    if (errores.length) console.log('No se pudieron revisar:', errores.length);
})();
