/*
 * Regresion: la tasa de mutual del formulario tiene que llegar al motor.
 * Bug encontrado el 28-10-2026: el campo "Tasa mutual (%)" existia pero
 * js/demo_liquidaciones.js no lo pasaba, asi que el costo empresa salia
 * siempre con el minimo 0,93%.
 *
 *   node tools/test_tasa_mutual.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const E = require(path.join(root, 'js', 'liquidacion_engine'));
const P = require(path.join(root, 'js', 'liquidacion_parametros'));

const valores = Object.assign({}, P.vigenciaDe('2026-10'), P.RESPALDO['2026-10']);
const trabajador = {
    sueldoBase: 1200000, afp: 'Cuprum', salud: 'fonasa', contrato: 'indefinido',
    jornadaHoras: 42, fechaIngreso: '2020-01-01', colacion: 0, movilizacion: 0
};
const mes = { diasTrabajados: 30, horasExtra: 0, comisiones: 0, gratificacion: 'legal' };

function mutual(tasa) {
    const r = E.calcular({ trabajador, mes, periodo: '2026-10', tasaMutual: tasa }, valores);
    return r.empleador.lineas.find(l => l.clave === 'mutual');
}
function costo(tasa) {
    return E.calcular({ trabajador, mes, periodo: '2026-10', tasaMutual: tasa }, valores).empleador.costoTotal;
}

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; }
}

const base = E.calcular({ trabajador, mes, periodo: '2026-10', tasaMutual: 2.5 }, valores).bases.baseAfp;

caso('0,93% cobra el minimo legal', () => {
    assert.strictEqual(mutual(0.93).monto, Math.round(base * 0.0093));
});
caso('2,5% cambia el monto de la mutual', () => {
    assert.strictEqual(mutual(2.5).monto, Math.round(base * 0.025));
});
caso('sin tasa usa 0,93%', () => {
    assert.strictEqual(mutual(undefined).monto, mutual(0.93).monto);
});
caso('una tasa mas alta sube el costo empresa', () => {
    assert.ok(costo(2.5) > costo(0.93), 'el costo empresa debe subir con la tasa');
});
caso('la demo pasa la tasa del formulario al motor', () => {
    const src = fs.readFileSync(path.join(root, 'js', 'demo_liquidaciones.js'), 'utf8');
    assert.ok(/tasaMutual:\s*tasaMutualElegida\(\)/.test(src), 'falta pasar tasaMutual en calcularTodo');
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
