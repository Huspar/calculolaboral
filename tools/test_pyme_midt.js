// Pruebas de la hoja guía para registrar el contrato en Mi DT: node tools/test_pyme_midt.js
'use strict';
const assert = require('assert');
const M = require('../js/pyme_midt');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const EMP = { razonSocial: 'Panadería Los Aromos SpA', rut: '76.543.210-3', representante: 'Marta Díaz', rutRepresentante: '11.111.111-1', direccion: 'Av. Alemania 0450', comuna: 'Temuco' };
const T = (extra) => Object.assign({ nombre: 'Ana Pérez González', rut: '15.234.567-4', domicilio: 'Los Aromos 12', comuna: 'Temuco', cargo: 'Panadera', fechaIngreso: '2026-10-05', contrato: 'indefinido', jornadaHoras: 42, distribucion: '6', sueldoBase: 650000, colacion: 40000, movilizacion: 30000, gratificacion: 'legal' }, extra);
const valor = (h, campo) => { for (const e of h.etapas) { const f = e.filas.find(x => x.campo === campo); if (f) return f.valor; } return undefined; };

caso('las 4 etapas en el orden del formulario de la DT', () => {
    assert.deepStrictEqual(M.hoja(EMP, T()).etapas.map(e => e.titulo), ['1. Identificación de las partes', '2. Funciones y lugar de prestación de los servicios', '3. Remuneraciones', '4. Jornada de trabajo y otras estipulaciones']);
});
caso('plazo del contrato: 15 días corridos desde el ingreso (más seguro que los 15 hábiles que indica la DT)', () => {
    const p = M.hoja(EMP, T()).plazos[0];
    assert.ok(/20 de octubre de 2026/.test(p), p);
    assert.ok(/15 días hábiles/.test(p));
});
caso('remuneraciones y jornada salen de la ficha', () => {
    const h = M.hoja(EMP, T({ bonosFijos: [{ tipo: 'imponible', nombre: 'Bono de responsabilidad', monto: 50000 }, { tipo: 'perdida_caja', nombre: 'Asignación de pérdida de caja', monto: 15000 }], anticipoMensual: 200000 }));
    assert.strictEqual(valor(h, 'Sueldo base (imponible)'), '$650.000');
    assert.strictEqual(valor(h, 'Bono de responsabilidad (imponible)'), '$50.000');
    assert.strictEqual(valor(h, 'Asignación de pérdida de caja (no imponible)'), '$15.000');
    assert.strictEqual(valor(h, 'Asignación de colación (no imponible)'), '$40.000');
    assert.strictEqual(valor(h, 'Anticipo de remuneración'), 'Sí, mensual ($200.000)');
    assert.strictEqual(valor(h, 'Días de distribución'), 'Lunes a sábado');
    assert.strictEqual(valor(h, 'Número de días'), '6');
    assert.strictEqual(valor(h, 'Duración de la jornada'), '42 horas semanales');
    assert.strictEqual(valor(h, 'Término del contrato'), undefined, 'sin plazo fijo no hay término');
});
caso('plazo fijo con su término; lo que falta en la ficha se marca', () => {
    const h = M.hoja({ razonSocial: 'X' }, T({ contrato: 'plazo_fijo', fechaTerminoPlazo: '', cargo: '' }));
    assert.strictEqual(valor(h, 'Tipo de contrato'), 'Plazo fijo');
    assert.strictEqual(valor(h, 'Término del contrato'), 'Falta en la ficha');
    assert.strictEqual(valor(h, 'Cargo'), 'Falta en la ficha');
    assert.strictEqual(valor(h, 'Representante del empleador'), 'Falta en la ficha');
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
