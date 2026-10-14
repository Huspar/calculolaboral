// Pruebas de la promoción del Asistente Laboral Pyme en el sitio: node tools/test_promo_asistente.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Pr = require('./promo_asistente');

const RAIZ = path.join(__dirname, '..');
let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }
const leer = (slug) => fs.readFileSync(path.join(RAIZ, slug + '.html'), 'utf8');
const slugs = Object.keys(Pr.PAGINAS);
const conBloque = slugs.filter(s => !Pr.PAGINAS[s].manual);

caso('cada página de la lista tiene su bloque al día (corre node tools/promo_asistente.js si falla)', () => {
    conBloque.forEach(s => {
        const html = leer(s);
        assert.strictEqual(Pr.aplicar(html, s, Pr.PAGINAS[s]), html, s + ' desactualizada');
        assert.strictEqual(html.split(Pr.INICIO).length - 1, 1, s + ': el bloque debe estar una sola vez');
    });
});

caso('solo las páginas de la lista tienen el bloque o la hoja de estilos (nada en páginas de trabajadores, legales ni en el propio asistente)', () => {
    fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)).forEach(f => {
        const slug = f.replace(/\.html$/, ''), html = leer(slug);
        const tiene = html.indexOf(Pr.INICIO) >= 0 || html.indexOf('promo-asistente.css') >= 0;
        assert.strictEqual(tiene, slugs.indexOf(slug) >= 0, slug);
    });
    ['simulador-despido-injustificado-chile', 'reclamar-despido-injustificado-chile', 'que-hacer-si-no-te-pagan-el-finiquito', 'carta-de-renuncia-chile', 'terminos', 'privacidad', 'asistente-laboral-pyme', 'app', 'compra-exitosa'].forEach(s => {
        assert.ok(slugs.indexOf(s) < 0, s + ' no debe llevar el bloque');
    });
});

caso('el bloque no toca el encabezado ni el pie: va antes de «Fuentes», «Te puede servir» o el cierre de la página, nunca dentro del footer ni del header', () => {
    conBloque.forEach(s => {
        const html = leer(s), i = html.indexOf(Pr.INICIO);
        assert.ok(i > html.indexOf('<body'), s);
        const pie = html.indexOf('<footer');
        assert.ok(pie < 0 || i < pie, s + ': el bloque quedó después del pie');
        assert.ok(html.slice(0, i).split('<header').length === html.slice(0, i).split('</header>').length, s + ': el bloque quedó dentro de un header');
    });
});

caso('textos sin promesas ni palabras prohibidas (oficial, abogados, evita multas, garantiza, precios tachados) y sin colores fuera de la marca', () => {
    const prohibidas = /oficial|garantiza|evita multas|100\s?%|cumplimiento (pleno|total)|ahorras|precio normal|revisad[oa] por abogados|validad[oa]/i;
    const textos = conBloque.map(s => Pr.PAGINAS[s].titulo + ' ' + Pr.PAGINAS[s].texto).concat([Pr.KICKER]);
    textos.forEach(t => assert.ok(!prohibidas.test(t), t));
    const css = fs.readFileSync(path.join(RAIZ, 'assets/css/promo-asistente.css'), 'utf8');
    assert.ok(!/gradient|sky-|blue|indigo|violet|purple|orange/i.test(css), 'la hoja de estilos usa degradados o colores fuera de la marca');
    assert.ok(/#00382E/i.test(css) && /#FFB703/i.test(css));
});

caso('cada bloque lleva su seguimiento de GA4 (data-cta) y apunta solo a páginas que existen', () => {
    conBloque.forEach(s => {
        const html = leer(s), b = html.slice(html.indexOf(Pr.INICIO), html.indexOf(Pr.FIN));
        assert.ok(b.indexOf('data-cta="asistente-pyme"') >= 0 && b.indexOf('data-cta-slot="' + s + '-bloque"') >= 0 && b.indexOf('data-cta-slot="' + s + '-ejemplo"') >= 0, s);
    });
    assert.ok(fs.existsSync(path.join(RAIZ, 'asistente-laboral-pyme.html')) && fs.existsSync(path.join(RAIZ, 'app.html')));
    const vercel = fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8');
    assert.ok(/"\/app\/:ruta\*"/.test(vercel), 'app/ejemplo se sirve con la regla de /app');
});

caso('la hoja de estilos de la promoción no se carga dos veces ni queda en páginas sin bloque', () => {
    slugs.forEach(s => assert.strictEqual(leer(s).split('promo-asistente.css').length - 1, 1, s));
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
