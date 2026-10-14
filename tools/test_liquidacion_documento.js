// Pruebas del documento de liquidacion compartido (generador y Asistente Pyme): node tools/test_liquidacion_documento.js
'use strict';
const assert = require('assert');
const E = require('../js/liquidacion_engine');
const D = require('../js/liquidacion_documento');
const P = require('../js/liquidacion_parametros');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + e.message); process.exitCode = 1; } }

const vig = P.vigenciaDe('2026-09');
const MES_VALORES = { uf: 41000.5, utm: 72151, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp };
const EMP = { razonSocial: 'Panadería <b>La Espiga</b> Ltda.', rut: '768451230', direccion: 'Av. "Principal" 123', logo: '' };
const TRAB = { nombre: 'María & Pérez', rut: '123456785', cargo: 'Panadera', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 650000, afp: 'Modelo', salud: 'fonasa', colacion: 40000 };
const res = E.calcular({ trabajador: TRAB, mes: { diasTrabajados: 30 }, periodo: '2026-09' }, MES_VALORES);

caso('el documento trae membrete, datos, haberes, descuentos, líquido en palabras y firmas', () => {
    const h = D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', pagada: true });
    ['Liquidación de sueldo', 'Septiembre 2026', '12.345.678-5', 'Panadera', '15-03-2022', 'Haberes', 'Descuentos', 'Alcance líquido a pagar', 'Son:', 'Firma del trabajador', 'Firma y timbre del empleador', 'UF al 30 de septiembre'].forEach(t => assert.ok(h.includes(t), t));
    assert.ok(h.includes('$' + Math.round(res.liquido).toLocaleString('es-CL')));
});
caso('lo que escribe el usuario se escapa', () => {
    const h = D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', pagada: true });
    assert.ok(!h.includes('<b>La Espiga</b>') && h.includes('&lt;b&gt;La Espiga&lt;/b&gt;'));
    assert.ok(h.includes('María &amp; Pérez') && h.includes('Av. &quot;Principal&quot; 123'));
});
caso('sin pago lleva la marca de agua "Vista previa"; pagada no', () => {
    assert.ok(D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', pagada: false }).includes('lqd-marca'));
    assert.ok(!D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', pagada: true }).includes('lqd-marca'));
    assert.ok(D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', ejemplo: true }).includes('lqd-ejemplo'));
});
caso('días de licencia e Isapre aparecen solo si corresponden', () => {
    const t = Object.assign({}, TRAB, { salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 4 });
    const h = D.documento(EMP, t, { diasLicencia: 3 }, E.calcular({ trabajador: t, mes: { diasTrabajados: 27 }, periodo: '2026-09' }, MES_VALORES), { periodo: '2026-09', pagada: true });
    assert.ok(h.includes('Colmena') && h.includes('Días de licencia'));
    assert.ok(!D.documento(EMP, TRAB, {}, res, { periodo: '2026-09', pagada: true }).includes('Días de licencia'));
});
caso('monto en palabras', () => {
    assert.strictEqual(D.enPalabras(0), 'cero pesos');
    assert.strictEqual(D.enPalabras(1000000), 'un millón de pesos');
    assert.strictEqual(D.enPalabras(612345), 'seiscientos doce mil trescientos cuarenta y cinco pesos');
    assert.strictEqual(D.enPalabras(21000), 'veintiún mil pesos');
    assert.strictEqual(D.enPalabras(100000), 'cien mil pesos');
});
console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
