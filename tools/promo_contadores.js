/*
 * Pone o actualiza el bloque de Suite Contadores en las paginas tecnicas del sitio.
 * No usar palabras prohibidas: oficial, garantiza, cumplimiento total, evita multas,
 * validado, F29 al peso, declaracion automatica, asesoría, revisado por abogados.
 * Uso:
 *   node tools/promo_contadores.js           # agrega o actualiza todas
 *   node tools/promo_contadores.js --revisar # solo revisa sin tocar archivos
 *   node tools/promo_contadores.js --quitar  # borra el bloque de todas
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const INICIO = '<!-- cl-suite:inicio (lo genera tools/promo_contadores.js: no editar a mano) -->';
const FIN = '<!-- cl-suite:fin -->';
const CSS = '<link rel="stylesheet" href="/assets/css/promo-contadores.css?v=1.0.0">';
const MEDIR = '<script src="/js/medir_promo.js?v=1.1.0" defer></script>';

const PAGINAS = {
    'liquidacion-de-sueldo': {
        titulo: '¿Preparas liquidaciones y nóminas de varios clientes cada mes?',
        texto: 'En Suite Contadores cargas la nómina por Excel o TXT, calculas liquidaciones y finiquitos en lote por empresa y generas Previred (105 campos) y LRE (147 columnas) sin pedir claves.',
        antes: '<section class="mt-10 pt-6 border-t border-slate-200 no-print" aria-labelledby="fuentes-titulo">'
    },
    'generador-liquidacion-sueldo': {
        titulo: '¿Calculas liquidaciones todos los meses para varias empresas?',
        texto: 'Este generador emite una liquidación puntual. En Suite Contadores calculas nóminas completas por cliente, exportas PDF por trabajador y generas el archivo Previred para revisar y subir.',
        antes: '<section class="ls-section" id="preguntas">'
    },
    'impuesto-unico-segunda-categoria': {
        titulo: 'Suma el Código 48 del F29 directo desde la nómina del cliente',
        texto: 'Suite Contadores toma el impuesto único de las liquidaciones del mes, lee los CSV de compras y ventas del SII y arma el borrador de F29 y el Balance de 8 Columnas en tu navegador.',
        antes: '<section class="mt-10 pt-6 border-t border-slate-200 no-print" aria-labelledby="fuentes-titulo">'
    },
    'como-generar-archivo-previred-lre-f29-chile': {
        titulo: 'Genera el TXT Previred, el CSV LRE y el borrador F29 por cliente',
        texto: 'Calcula la nómina del período y descarga el archivo plano de 105 campos y el Libro LRE de 147 columnas listos para revisar y cargar en Previred y Mi DT, sin entregar claves.',
        antes: '<section aria-labelledby="fuentes-titulo" class="mt-10 pt-6 border-t border-slate-200 no-print">'
    }
};

function eolDe(t) { return t.includes('\r\n') ? '\r\n' : '\n'; }

function bloqueHtml(slug, cfg, eol) {
    const h = [
        INICIO,
        '<aside class="cl-suite no-print" aria-labelledby="cl-suite-t">',
        '<div class="cl-suite-cuerpo">',
        '<p class="cl-suite-kicker">Suite Contadores · Acceso anticipado 90 días gratis</p>',
        '<p class="cl-suite-titulo" id="cl-suite-t">' + cfg.titulo + '</p>',
        '<p>' + cfg.texto + '</p>',
        '</div>',
        '<div class="cl-suite-acciones">',
        '<a class="cl-suite-btn" href="suite-contadores" data-cta="suite-contadores" data-cta-name="Suite Contadores" data-cta-slot="' + slug + '-contadores-bloque">Ver Suite Contadores</a>',
        '<a class="cl-suite-link" href="demo-contadores" data-cta="suite-contadores" data-cta-name="Suite Contadores" data-cta-slot="' + slug + '-contadores-demo">Probar demo con ejemplo</a>',
        '</div>',
        '</aside>',
        FIN
    ].join(eol);
    return h;
}

function quitarDe(html) {
    let s = html.replace(/\r?\n?[ \t]*<!-- cl-suite:inicio[\s\S]*?<!-- cl-suite:fin -->[ \t]*/g, '');
    s = s.replace(/\r?\n?[ \t]*<link[^>]+promo-contadores\.css[^>]*>[ \t]*/g, '');
    return s;
}

function actualizar(slug, soloRevisar, quitar) {
    const archivo = path.join(RAIZ, slug + '.html');
    const orig = fs.readFileSync(archivo, 'utf8');
    const eol = eolDe(orig);

    if (quitar) {
        const limpio = quitarDe(orig);
        if (limpio !== orig && !soloRevisar) fs.writeFileSync(archivo, limpio, 'utf8');
        return limpio === orig ? 'limpia' : (soloRevisar ? 'cambiaria' : 'quitado');
    }

    const cfg = PAGINAS[slug];
    let s = orig
        .replace(/<!-- cl-suite:inicio[\s\S]*?<!-- cl-suite:fin -->/, '')
        .replace(/\r?\n?[ \t]*<!-- cl-asistente:inicio[\s\S]*?<!-- cl-asistente:fin -->[ \t]*/g, '')
        .replace(/\r?\n?[ \t]*<link[^>]+promo-asistente\.css[^>]*>[ \t]*/g, '')
        .trimEnd();

    if (!s.includes('promo-contadores.css')) {
        const iHead = s.indexOf('</head>');
        if (iHead < 0) throw new Error('Sin </head> en ' + slug);
        s = s.slice(0, iHead) + CSS + eol + s.slice(iHead);
    }
    if (s.includes('checkout_consent.js')) {
        s = s.replace(/\r?\n?[ \t]*<script[^>]+medir_promo\.js[^>]*><\/script>[ \t]*/g, '');
    } else if (!s.includes('medir_promo.js')) {
        const iBody = s.lastIndexOf('</body>');
        if (iBody < 0) throw new Error('Sin </body> en ' + slug);
        s = s.slice(0, iBody) + MEDIR + eol + s.slice(iBody);
    }

    const block = bloqueHtml(slug, cfg, eol);
    if (!cfg.antes || !s.includes(cfg.antes)) {
        throw new Error('No encontre ancla "' + cfg.antes + '" en ' + slug);
    }
    const i = s.indexOf(cfg.antes);
    const prevClean = s.slice(0, i).replace(/[ \t\r\n]+$/, '');
    s = prevClean + eol + block + eol + s.slice(i);
    if (!s.endsWith(eol)) s += eol;

    const hayBloque = orig.includes(INICIO) && orig.includes(FIN);
    if (s === orig) return 'igual';
    if (!soloRevisar) fs.writeFileSync(archivo, s, 'utf8');
    return hayBloque ? 'actualizado' : 'agregado';
}

const args = process.argv.slice(2);
const revisar = args.includes('--revisar');
const quitar = args.includes('--quitar');

const resumen = { agregado: 0, actualizado: 0, igual: 0, quitado: 0, limpia: 0, cambiaria: 0 };
for (const slug of Object.keys(PAGINAS)) {
    const r = actualizar(slug, revisar, quitar);
    resumen[r] = (resumen[r] || 0) + 1;
    if (r !== 'igual' && r !== 'limpia') console.log(r + ': ' + slug + '.html');
}
console.log(JSON.stringify(resumen));
