/*
 * Banco de casos de referencia: resultados esperados con su fuente (autoridad, ejemplos publicados por otros software
 * o conteo propio explicado). Cada archivo de tools/casos_referencia/ trae { modulo, casos: [{ id, fuente, entrada, esperado }] }.
 * Uso: node tools/test_casos_referencia.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const F = require('../js/feriados_cl.js');

// Cómo se corre cada módulo con la entrada de un caso
const MODULOS = {
    semana_corrida: function (e) {
        const SC = require('../js/semana_corrida.js');
        const lista = e.feriados;
        const esFeriado = lista ? function (iso) { return lista.indexOf(iso) >= 0; } : F.esFeriado;
        return SC.calcular(Object.assign({}, e, { esFeriado }));
    },
    honorarios: function (e) { return require('../js/pyme_honorarios.js').boleta(e); }
};

const carpeta = path.join(__dirname, 'casos_referencia');
let total = 0, fallas = 0;
fs.readdirSync(carpeta).filter(function (f) { return f.endsWith('.json'); }).sort().forEach(function (archivo) {
    const banco = JSON.parse(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    const correr = MODULOS[banco.modulo];
    assert.ok(correr, 'Módulo sin ejecutor: ' + banco.modulo);
    banco.casos.forEach(function (c) {
        total++;
        assert.ok(c.fuente && c.fuente.length > 20, c.id + ': falta la fuente del resultado esperado');
        try {
            const r = correr(c.entrada);
            Object.keys(c.esperado).forEach(function (k) {
                assert.deepStrictEqual(r[k], c.esperado[k], c.id + ' · ' + k + ': se obtuvo ' + JSON.stringify(r[k]) + ', se esperaba ' + JSON.stringify(c.esperado[k]));
            });
            console.log('  ok  ' + banco.modulo + ' · ' + c.id);
        } catch (err) {
            fallas++;
            console.log('  FALLA ' + banco.modulo + ' · ' + c.id + '\n        ' + err.message);
        }
    });
});
console.log('\n' + (total - fallas) + ' de ' + total + ' casos de referencia correctos');
if (fallas) process.exit(1);
