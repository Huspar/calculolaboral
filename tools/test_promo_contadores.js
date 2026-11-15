/*
 * Prueba del sistema promocional de Suite Contadores (anuncios en paginas tecnicas).
 * Ejecutar: node tools/test_promo_contadores.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RAIZ = path.join(__dirname, '..');
const ESPERADAS = [
    'liquidacion-de-sueldo',
    'generador-liquidacion-sueldo',
    'impuesto-unico-segunda-categoria',
    'como-generar-archivo-previred-lre-f29-chile',
    'calculadora-f29-chile',
    'balance-8-columnas-rli-propyme-excel'
];

const PROHIBIDAS = [
    /\boficial(?:es)?\b/i,
    /\bgarantiz\w*\b/i,
    /\bcumplimiento\s+(?:total|pleno)\b/i,
    /\bevita\s+multas\b/i,
    /\b100\s*%/i,
    /\bf29\s+al\s+peso\b/i,
    /\bal\s+peso\b/i,
    /\bdeclaraci[oó]n\s+autom[aá]tica\b/i,
    /\bcarga\s+directa\b/i,
    /\bintegrado\s+con\s+el\s+sii\b/i,
    /\bvalidado\b/i,
    /\brevisad[oa]\s+por\s+abogados\b/i,
    /\basesor[ií]a\b/i,
    /—/
];

function extraerBloque(html) {
    const m = html.match(/<aside class="cl-suite[\s\S]*?<\/aside>/);
    return m ? m[0] : null;
}

function run() {
    let ok = 0;

    // 1. Verificar que existe CSS y tiene tokens corporativos
    const cssPath = path.join(RAIZ, 'assets', 'css', 'promo-contadores.css');
    assert.ok(fs.existsSync(cssPath), 'Debe existir assets/css/promo-contadores.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('#00382E'), 'CSS debe usar #00382E');
    assert.ok(css.includes('44px'), 'Botones deben asegurar tap target de 44px');
    assert.ok(css.includes('@media print'), 'Debe ocultarse al imprimir');
    ok++;

    // 2. Verificar cada pagina esperada
    for (const slug of ESPERADAS) {
        const file = path.join(RAIZ, slug + '.html');
        assert.ok(fs.existsSync(file), 'Falta archivo ' + slug + '.html');
        const html = fs.readFileSync(file, 'utf8');

        assert.ok(html.includes('promo-contadores.css'), slug + ' debe enlazar promo-contadores.css');
        assert.ok(!html.includes('<!-- cl-asistente:inicio'), slug + ' no debe conservar bloque cl-asistente');
        assert.strictEqual((html.match(/<!-- cl-suite:inicio/g) || []).length, 1, slug + ' debe tener exactamente 1 bloque cl-suite');

        const bloque = extraerBloque(html);
        assert.ok(bloque, slug + ' debe renderizar <aside class="cl-suite">');
        assert.ok(bloque.includes('href="suite-contadores"'), slug + ' debe enlazar a suite-contadores');
        assert.ok(bloque.includes('href="demo-contadores"'), slug + ' debe enlazar a demo-contadores');
        assert.ok(bloque.includes('data-cta="suite-contadores"'), slug + ' debe tener data-cta="suite-contadores"');
        assert.ok(bloque.includes('data-cta-slot="' + slug + '-contadores-bloque"'), slug + ' debe tener slot de bloque');

        const tieneConsent = html.includes('checkout_consent.js');
        const tieneMedir = html.includes('medir_promo.js');
        assert.ok(tieneConsent !== tieneMedir, slug + ' debe cargar checkout_consent.js o medir_promo.js, nunca ambos ni ninguno');

        for (const rx of PROHIBIDAS) {
            assert.ok(!rx.test(bloque), slug + ' contiene expresion prohibida en bloque: ' + rx);
        }
        ok++;
    }

    console.log(ok + ' pruebas correctas en anuncios de Suite Contadores');
}

run();
