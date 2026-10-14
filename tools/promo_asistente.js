#!/usr/bin/env node
/*
 * Pone (o actualiza) el bloque que promociona el Asistente Laboral Pyme en las páginas donde corresponde (14-oct-2026).
 *
 *   node tools/promo_asistente.js            escribe los bloques
 *   node tools/promo_asistente.js --revisar  falla si alguna página no coincide con esta lista (lo usa tools/test_promo_asistente.js)
 *   node tools/promo_asistente.js --quitar   quita todos los bloques (por ejemplo, al terminar el piloto)
 *
 * Cada bloque va entre <!-- cl-asistente:inicio --> y <!-- cl-asistente:fin -->, antes de «Fuentes» o «Te puede servir». Los estilos viven en
 * assets/css/polish.css (clase .cl-asistente), así que no se toca el encabezado ni el pie de ninguna página.
 * Solo páginas para quien EMPLEA o paga remuneraciones: no las de trabajadores (sueldo líquido, reclamos, renuncia, etc.).
 * Al terminar el piloto (31-dic-2026): cambia KICKER y los textos que lo mencionan, y vuelve a correr este script.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CSS = '/assets/css/promo-asistente.css?v=1.0.1';
const LINK_CSS = '<link rel="stylesheet" href="' + CSS + '">';
const INICIO = '<!-- cl-asistente:inicio (lo genera tools/promo_asistente.js: no editar a mano) -->';
const FIN = '<!-- cl-asistente:fin -->';
const KICKER = 'Asistente Laboral Pyme · Piloto gratuito hasta el 31 de diciembre';

// Qué dice cada página: por qué el asistente le sirve a quien está leyendo (sin prometer lo que no hace)
const PAGINAS = {
    // Con bloque propio escrito a mano en la página (portada y portal de empleadores): aquí solo se asegura la hoja de estilos
    'index': { manual: true },
    'para-empleadores': { manual: true },
    'liquidacion-de-sueldo': { titulo: '¿Haces las liquidaciones de tu equipo cada mes?', texto: 'Guardas los datos de cada trabajador una sola vez y el asistente prepara las liquidaciones del mes, con gratificación y horas extra, para imprimirlas todas juntas. Hasta 5 trabajadores.' },
    'generador-liquidacion-sueldo': { titulo: '¿Tienes más de una persona que liquidar?', texto: 'Este generador cobra por liquidación y deja tus datos solo en tu navegador. En el asistente los guardas cifrados una vez y preparas el mes completo de tus trabajadores, gratis durante el piloto.', antes: '<section class="ls-section" id="preguntas">' },
    'calculadora-horas-extras': { titulo: 'Las horas extra de tu equipo, mes a mes', texto: 'En el asistente agregas las horas extra de cada trabajador y se calculan en su liquidación del mes, junto con el resto de sus haberes y descuentos.' },
    'calculadora-costo-empresa-chile': { titulo: 'Cuánto te cuesta cada trabajador, mes a mes', texto: 'El asistente calcula el costo para la empresa de cada trabajador y proyecta cómo sube con el aporte del empleador de la reforma de pensiones hasta 2033.' },
    'gratificacion-legal-chile': { titulo: 'La gratificación, ya incluida en cada liquidación', texto: 'Dejas definida la gratificación en la ficha de cada trabajador y el asistente la calcula en sus liquidaciones del mes.' },
    'impuesto-unico-segunda-categoria': { titulo: 'El impuesto retenido del mes, a la vista', texto: 'El asistente suma el impuesto único retenido de las liquidaciones guardadas y el de tus boletas de honorarios, para que lo revises antes de declarar el Formulario 29.' },
    'calculadora-sueldo-part-time': { titulo: 'Tus trabajadores part-time, bien liquidados', texto: 'El asistente aplica el ingreso mínimo proporcional en las jornadas parciales de hasta 30 horas y te avisa si el sueldo base queda bajo el mínimo.' },
    'generador-contrato-trabajo-chile': { titulo: '¿Vas a contratar a más de una persona?', texto: 'En el asistente guardas los datos una vez y emites el contrato, los anexos y el pacto de horas extra de cada trabajador sin volver a escribirlos.' },
    'generador-finiquito-chile': { titulo: 'El finiquito con los datos que ya guardaste', texto: 'El asistente arma el finiquito con la ficha y el registro de vacaciones de cada trabajador, con el feriado ya calculado.' },
    'finiquito_calculator': { titulo: 'Del cálculo al documento, con los datos de tu equipo', texto: 'Si tienes trabajadores, el asistente guarda sus datos y arma el finiquito con el feriado calculado desde su registro de vacaciones.' },
    'calculadora-vacaciones': { titulo: 'Lleva las vacaciones de todo tu equipo', texto: 'El asistente guarda el registro de vacaciones de cada trabajador, descuenta los días hábiles, muestra su saldo y avisa quién suma días por feriado progresivo.' },
    'ley-40-horas-chile-2026': { titulo: 'La jornada de 40 horas en los costos de tu equipo', texto: 'El asistente muestra cuánto sube el valor de la hora extra con la jornada de 40 horas y cómo cambia el costo de tu equipo a medida que avanza la reforma de pensiones.' },
    'sueldo-minimo-chile-2026': { titulo: 'Entérate cuando el mínimo te deja bajo la ley', texto: 'Cuando cambia el ingreso mínimo, el asistente te avisa qué trabajadores quedan con el sueldo base por debajo y te deja preparado el anexo.' },
    'protocolo-ley-karin-empresas': { titulo: 'Anota quién ya conoce el protocolo', texto: 'El asistente registra en la ficha de cada trabajador la fecha en que se le dio a conocer el protocolo y te avisa a quién le falta. No es un canal de denuncias.' },
    'checklist-fiscalizacion-dt-pymes-chile': { titulo: 'Los plazos del mes, sin llevarlos de memoria', texto: 'El asistente te avisa los contratos a plazo fijo por vencer, el plazo para registrar contratos en Mi DT, las licencias por tramitar y el pago de cotizaciones.' },
    'kit-cumplimiento-laboral-pymes': { titulo: 'Complementa el kit con tus liquidaciones y plazos', texto: 'El kit trae los documentos de cumplimiento. El asistente guarda los datos de tus trabajadores, prepara sus liquidaciones y te avisa los plazos del mes.' },
    'carta-de-despido-chile': { titulo: 'La carta de término, con los datos de la ficha', texto: 'El asistente arma las cartas de término del art. 159 N°4 y del art. 161 con los datos ya guardados de cada trabajador, y calcula el feriado del finiquito.' },
    'despido-necesidades-empresa-articulo-161': { titulo: 'La carta y el finiquito, con los datos ya guardados', texto: 'Con la ficha del trabajador, el asistente arma la carta del art. 161 y el finiquito, con el feriado calculado desde su registro de vacaciones.' },
    'finiquito-por-renuncia-voluntaria': { titulo: 'El finiquito con el feriado ya calculado', texto: 'El asistente arma el finiquito con la ficha del trabajador y su registro de vacaciones, para que revises el documento antes de firmarlo.' },
    'como-calcular-finiquito-chile': { titulo: 'Calcula y arma el finiquito de tu trabajador', texto: 'El asistente guarda los datos de cada trabajador y arma el finiquito con el feriado calculado desde su registro de vacaciones.' },
    'como-calcular-sueldo-liquido-paso-a-paso': { titulo: 'Si pagas sueldos, deja que el asistente haga el mes', texto: 'El asistente aplica estas mismas reglas a cada trabajador de tu empresa y prepara las liquidaciones del mes, con la UF y la UTM de cada período.' },
    'pack-cartas-despido-chile': { titulo: '¿Necesitas también la liquidación y el finiquito?', texto: 'El asistente guarda los datos de tus trabajadores, arma sus liquidaciones del mes y el finiquito con el feriado calculado, sin volver a escribirlos.' }
};

const ANTES = [
    /<section[^>]*aria-labelledby="fuentes-titulo"/,
    /<section[^>]*aria-labelledby="relacionados-titulo"/,
    /<aside class="ls-cta-final"/
];

function escapar(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function bloque(slug, cfg, nl) {
    const cta = (lugar) => `data-cta="asistente-pyme" data-cta-name="Asistente Laboral Pyme" data-cta-slot="${slug}-${lugar}"`;
    return [
        INICIO,
        '<aside class="cl-asistente no-print" aria-labelledby="cl-asistente-t">',
        '<div class="cl-asistente-cuerpo">',
        `<p class="cl-asistente-kicker">${escapar(KICKER)}</p>`,
        `<p class="cl-asistente-titulo" id="cl-asistente-t">${escapar(cfg.titulo)}</p>`,
        `<p>${escapar(cfg.texto)}</p>`,
        '</div>',
        '<div class="cl-asistente-acciones">',
        `<a class="cl-asistente-btn" href="asistente-laboral-pyme" ${cta('bloque')}>Conocer el asistente</a>`,
        `<a class="cl-asistente-link" href="app/ejemplo" ${cta('ejemplo')}>Ver un ejemplo, sin cuenta</a>`,
        '</div>',
        '</aside>',
        FIN
    ].join(nl) + nl;
}

/** Asegura (o quita) el enlace a la hoja de estilos del bloque, justo antes de cerrar el head. */
function conCss(html, poner) {
    const nl = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const re = /[ \t]*<link rel="stylesheet" href="\/assets\/css\/promo-asistente\.css[^>]*>(\r?\n)?/;
    html = html.replace(re, '');
    if (!poner) return html;
    const i = html.indexOf('</head>');
    if (i < 0) throw new Error('Página sin </head>');
    return html.slice(0, i) + LINK_CSS + nl + html.slice(i);
}

function sinBloque(html) {
    const i = html.indexOf(INICIO);
    if (i < 0) return html;
    const j = html.indexOf(FIN, i);
    if (j < 0) throw new Error('Bloque sin cierre');
    let fin = j + FIN.length;
    if (html.substr(fin, 2) === '\r\n') fin += 2; else if (html[fin] === '\n') fin += 1;
    return html.slice(0, i) + html.slice(fin);
}

/** html con el bloque de la página (o sin él si cfg es null). */
function aplicar(html, slug, cfg) {
    if (cfg && cfg.manual) return conCss(html, true);
    const nl = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    html = sinBloque(html);
    if (!cfg) return conCss(html, false);
    let pos = -1;
    if (cfg.antes) pos = html.indexOf(cfg.antes);
    else for (const re of ANTES) { const m = re.exec(html); if (m) { pos = m.index; break; } }
    if (pos < 0) throw new Error('No encontré dónde poner el bloque en ' + slug);
    // Al comienzo de su línea
    const inicioLinea = html.lastIndexOf('\n', pos) + 1;
    return conCss(html.slice(0, inicioLinea) + bloque(slug, cfg, nl) + html.slice(inicioLinea), true);
}

const archivo = (slug) => path.join(RAIZ, slug + '.html');

if (require.main === module) {
    const revisar = process.argv.indexOf('--revisar') >= 0, quitar = process.argv.indexOf('--quitar') >= 0;
    let malas = 0;
    // Las páginas que ya tienen un bloque pero ya no están en la lista, también se limpian
    const todas = fs.readdirSync(RAIZ).filter(f => /\.html$/.test(f)).map(f => f.replace(/\.html$/, ''));
    for (const slug of todas) {
        const html = fs.readFileSync(archivo(slug), 'utf8');
        const cfg = quitar ? null : PAGINAS[slug] || null;
        if (!cfg && html.indexOf(INICIO) < 0 && html.indexOf('promo-asistente.css') < 0) continue;
        const nuevo = aplicar(html, slug, cfg);
        if (nuevo === html) continue;
        if (revisar) { console.error('Desactualizada: ' + slug + '.html'); malas++; } else { fs.writeFileSync(archivo(slug), nuevo); console.log((cfg ? (cfg.manual ? 'Hoja de estilos en ' : 'Bloque en ') : 'Sin bloque en ') + slug + '.html'); }
    }
    for (const slug of Object.keys(PAGINAS)) if (!fs.existsSync(archivo(slug))) { console.error('No existe ' + slug + '.html'); malas++; }
    if (revisar) { if (malas) process.exit(1); console.log('Bloques del asistente al día en ' + Object.keys(PAGINAS).length + ' páginas'); }
}
module.exports = { PAGINAS, aplicar, sinBloque, conCss, INICIO, FIN, KICKER, CSS };
