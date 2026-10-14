#!/usr/bin/env node
/*
 * Arma js/pyme_demo_servidor.js: la lógica de datos del servidor del Asistente (api/_pyme/datos.js, api/_pyme/validar.js y el
 * almacén en memoria de las pruebas) empaquetada para correr en el navegador, solo para el modo de ejemplo de /app.
 *
 *   node tools/build_pyme_demo.js            escribe el archivo
 *   node tools/build_pyme_demo.js --revisar  falla si el archivo no coincide con las fuentes (lo usa tools/test_pyme_demo.js)
 *
 * Así el ejemplo valida y guarda exactamente como el servidor, sin copiar reglas a mano. No incluye cifrado, sesiones ni la base:
 * el ejemplo vive en la memoria de la pestaña y se pierde al cerrarla.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'js', 'pyme_demo_servidor.js');

// Módulos empaquetados y cómo se resuelve cada require() que hacen
const MODULOS = [
    { id: 'validar', archivo: 'api/_pyme/validar.js', requires: { crypto: '@crypto', '../../js/rut_cl': '@CLRut', '../../js/liquidacion_parametros': '@CLLiquidacionParametros', '../../js/feriados_cl': '@CLFeriados', '../../js/pyme_vacaciones': '@CLPymeVacaciones' } },
    { id: 'datos', archivo: 'api/_pyme/datos.js', requires: { crypto: '@crypto', './validar': 'validar' } },
    { id: 'almacen', archivo: 'tools/pyme_almacen_memoria.js', requires: { crypto: '@crypto' } }
];

function armar() {
    const partes = MODULOS.map(m => {
        const fuente = fs.readFileSync(path.join(RAIZ, m.archivo), 'utf8').replace(/\r\n/g, '\n');
        return '    // ---- ' + m.archivo + ' ----\n' +
            '    definir(' + JSON.stringify(m.id) + ', ' + JSON.stringify(m.requires) + ', function (module, exports, require, Buffer) {\n' +
            fuente.replace(/^#!.*\n/, '') + '\n    });\n';
    });
    return '/*\n' +
        ' * CalculoLaboral · lógica de datos del Asistente para el modo de ejemplo (GENERADO por tools/build_pyme_demo.js: no editar a mano).\n' +
        ' * Contiene ' + MODULOS.map(m => m.archivo).join(', ') + ' tal cual, con un require() mínimo.\n' +
        ' * Requiere rut_cl.js, liquidacion_parametros.js, feriados_cl.js y pyme_vacaciones.js antes. Expone window.CLPymeDemoServidor.\n' +
        ' */\n' +
        '(function (root) {\n' +
        "    'use strict';\n" +
        '    var hex = function (n) { var b = new Uint8Array(n); root.crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return (x < 16 ? \'0\' : \'\') + x.toString(16); }).join(\'\'); };\n' +
        '    var externos = {\n' +
        '        crypto: {\n' +
        '            randomUUID: function () { if (root.crypto.randomUUID) return root.crypto.randomUUID(); var h = hex(16); return h.slice(0, 8) + \'-\' + h.slice(8, 12) + \'-4\' + h.slice(13, 16) + \'-\' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + \'-\' + h.slice(20, 32); },\n' +
        '            randomBytes: function (n) { var h = hex(n); return { toString: function () { return h; } }; }\n' +
        '        },\n' +
        '        CLRut: root.CLRut, CLLiquidacionParametros: root.CLLiquidacionParametros, CLFeriados: root.CLFeriados, CLPymeVacaciones: root.CLPymeVacaciones\n' +
        '    };\n' +
        '    // Sin cifrado, el almacén guarda texto: Buffer.from() solo copia\n' +
        '    var BufferMinimo = { from: function (x) { return x; } };\n' +
        '    var fabricas = {}, cache = {};\n' +
        '    function definir(id, mapa, fabrica) { fabricas[id] = { mapa: mapa, fabrica: fabrica }; }\n' +
        '    function cargar(id) {\n' +
        '        if (cache[id]) return cache[id].exports;\n' +
        '        var f = fabricas[id], module = { exports: {} };\n' +
        '        cache[id] = module;\n' +
        '        f.fabrica(module, module.exports, function (nombre) {\n' +
        '            var destino = f.mapa[nombre];\n' +
        '            if (!destino) throw new Error(\'Módulo no empaquetado: \' + nombre);\n' +
        '            if (destino.charAt(0) === \'@\') { var e = externos[destino.slice(1)]; if (!e) throw new Error(\'Falta \' + destino.slice(1)); return e; }\n' +
        '            return cargar(destino);\n' +
        '        }, BufferMinimo);\n' +
        '        return module.exports;\n' +
        '    }\n\n' +
        partes.join('\n') + '\n' +
        '    root.CLPymeDemoServidor = { datos: function () { return cargar(\'datos\'); }, almacen: function () { return cargar(\'almacen\'); } };\n' +
        '})(typeof window !== \'undefined\' ? window : this);\n';
}

if (require.main === module) {
    const contenido = armar();
    if (process.argv.indexOf('--revisar') >= 0) {
        const actual = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8').replace(/\r\n/g, '\n') : '';
        if (actual !== contenido) { console.error('js/pyme_demo_servidor.js no está al día: corre node tools/build_pyme_demo.js'); process.exit(1); }
        console.log('js/pyme_demo_servidor.js al día');
    } else {
        fs.writeFileSync(SALIDA, contenido);
        console.log('Escrito ' + path.relative(RAIZ, SALIDA) + ' (' + Math.round(contenido.length / 1024) + ' KB)');
    }
}
module.exports = { armar, SALIDA };
