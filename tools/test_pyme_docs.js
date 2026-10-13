// Pruebas de los documentos laborales del Asistente Pyme: node tools/test_pyme_docs.js
'use strict';
const assert = require('assert');
const D = require('../js/pyme_docs');
const F = require('../js/feriados_cl');

let ok = 0;
function caso(nombre, fn) { try { fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n         ')); process.exitCode = 1; } }

const EMPRESA = { razonSocial: 'Panadería <La Espiga> Ltda.', rut: '76.845.123-0', representante: 'Manuel Lagos', rutRepresentante: '12.345.678-5', direccion: 'Av. Principal 123', comuna: 'Temuco', ciudad: 'Temuco', logo: '' };
const TRAB = (extra) => Object.assign({ id: 't1', nombre: 'María Pérez Soto', rut: '12.345.678-5', cargo: 'Vendedora', domicilio: 'Calle 1', comuna: 'Temuco', fechaIngreso: '2020-03-15', contrato: 'indefinido', renovaciones: 0, sueldoBase: 650000, colacion: 40000, movilizacion: 30000, gratificacion: 'legal', distribucion: '5', activo: true }, extra);
const ctx = (t, extra) => Object.assign({ empresa: EMPRESA, t: t || TRAB(), hoy: '2026-10-12', meses: {}, uf: 41130.94, F }, extra);
const MES = (liquido) => ({ calculo: { liquido, totalHaberes: liquido + 100000, totalImponible: liquido + 50000, totalDescuentos: 100000, uf: 41000, utm: 72000 } });
// Mes guardado con el desglose de las bases (pyme_liquidaciones v1.3.0): horas extra 20.000, gratificación 100.000, colación + movilización 70.000
const MESB = (liquido) => ({ calculo: Object.assign({}, MES(liquido).calculo, { conBases: true, horasExtra: 20000, gratificacion: 100000, colMov: 70000 }) });
const valido = (tipo, c, extra) => Object.assign(D.valoresIniciales(tipo, c), extra);
const HECHOS = 'Desde marzo las ventas de la sucursal cayeron un 40% respecto del año anterior y se cerró el turno de tarde, por lo que el cargo de vendedora de ese turno dejó de ser necesario.';

caso('hay once tipos en tres grupos y todos tienen campos y generador', () => {
    assert.strictEqual(D.TIPOS.length, 11);
    D.TIPOS.forEach(t => assert.ok(D.campos(t.id).length > 0 && D.GRUPOS.some(g => g[0] === t.grupo), t.id));
});
caso('sin completar los datos obligatorios no se puede emitir ni generar', () => {
    const c = ctx();
    D.TIPOS.forEach(t => {
        const v = D.validar(t.id, c, { ciudad: '', fecha: c.hoy });
        assert.ok(!v.puedeEmitir, t.id);
        assert.throws(() => D.generar(t.id, c, { ciudad: '', fecha: c.hoy }), /pendientes/, t.id);
    });
});
caso('falta de datos en la ficha se informa por separado y bloquea', () => {
    const c = ctx(TRAB({ fechaIngreso: '', cargo: '' }));
    const v = D.validar('cert_antiguedad', c, D.valoresIniciales('cert_antiguedad', c));
    assert.deepStrictEqual(v.faltaFicha.map(x => x.k).sort(), ['cargo', 'fechaIngreso']);
    assert.ok(!v.puedeEmitir);
    const sinEmp = ctx(); sinEmp.empresa = Object.assign({}, EMPRESA, { razonSocial: '' });
    assert.strictEqual(D.validar('amonestacion', sinEmp, {}).faltaFicha[0].k, 'razonSocial');
});

caso('antigüedad: años, meses y días completos', () => {
    assert.deepStrictEqual(D.antiguedad('2020-03-15', '2026-10-12'), { anios: 6, meses: 6, dias: 27 });
    assert.deepStrictEqual(D.antiguedad('2026-01-31', '2026-03-01'), { anios: 0, meses: 1, dias: 1 });
    assert.strictEqual(D.antiguedadTxt({ anios: 1, meses: 0, dias: 0 }), '1 año');
    assert.strictEqual(D.antiguedadTxt({ anios: 2, meses: 3, dias: 4 }), '2 años, 3 meses y 4 días');
});
caso('certificado de antigüedad: datos de la ficha, escapa el HTML y marca de agua según el pase', () => {
    const c = ctx(), d = valido('cert_antiguedad', c, { destinatario: 'Caja <b>X</b>' });
    assert.ok(D.validar('cert_antiguedad', c, d).puedeEmitir);
    const h = D.generar('cert_antiguedad', c, d, { pagada: true }).html;
    ['Certificado de antigüedad', '12.345.678-5', 'Vendedora', '15 de marzo de 2020', '6 años, 6 meses y 27 días', '12 de octubre de 2026', 'Temuco, 12 de octubre de 2026', 'no constituye asesoría legal'].forEach(t => assert.ok(h.includes(t), t));
    assert.ok(h.includes('Panadería &lt;La Espiga&gt; Ltda.') && !h.includes('<La Espiga>'));
    assert.ok(h.includes('Caja &lt;b&gt;X&lt;/b&gt;') && !h.includes('<b>X</b>'));
    assert.ok(!h.includes('lqd-marca'));
    assert.ok(D.generar('cert_antiguedad', c, d, { pagada: false }).html.includes('lqd-marca'));
    assert.ok(!/\[[A-ZÁÉÍÓÚ ]+\]/.test(h), 'no quedan corchetes');
});
caso('certificado de antigüedad: con fecha de término habla en pasado; no admite fechas incoherentes', () => {
    const c = ctx(), d = valido('cert_antiguedad', c, { fechaTermino: '2026-09-30' });
    const h = D.generar('cert_antiguedad', c, d, { pagada: true }).html;
    assert.ok(h.includes('se desempeñó') && h.includes('hasta el 30 de septiembre de 2026') && h.includes('6 años, 6 meses y 15 días'));
    assert.ok(D.validar('cert_antiguedad', c, valido('cert_antiguedad', c, { fechaTermino: '2019-01-01' })).errores.fechaTermino);
    assert.ok(D.validar('cert_antiguedad', c, valido('cert_antiguedad', c, { fecha: '2019-01-01' })).errores.fecha);
});

caso('certificado de remuneraciones: sueldo y asignaciones de la ficha', () => {
    const c = ctx(), d = valido('cert_remuneraciones', c);
    const h = D.generar('cert_remuneraciones', c, d, { pagada: true }).html;
    ['$650.000', '$40.000', '$30.000', 'Gratificación legal', 'Certificado de remuneraciones'].forEach(t => assert.ok(h.includes(t), t));
    assert.ok(!h.includes('Promedio'));
});
caso('certificado de remuneraciones: el promedio exige los 3 meses anteriores con su cálculo', () => {
    assert.deepStrictEqual(D.periodosPromedio('2026-10-12'), ['2026-09', '2026-08', '2026-07']);
    assert.deepStrictEqual(D.periodosPromedio('2026-01-05'), ['2025-12', '2025-11', '2025-10']);
    const sin = ctx(), d = valido('cert_remuneraciones', sin, { incluirPromedio: true });
    const v = D.validar('cert_remuneraciones', sin, d);
    assert.ok(!v.puedeEmitir && v.bloqueos[0].includes('septiembre de 2026') && v.bloqueos[0].includes('julio de 2026'));
    const con = ctx(TRAB(), { meses: { '2026-09': MES(600000), '2026-08': MES(610000), '2026-07': MES(620000) } });
    const h = D.generar('cert_remuneraciones', con, d, { pagada: true }).html;
    assert.ok(h.includes('$600.000') && h.includes('$610.000') && h.includes('$620.000') && h.includes('Promedio') && h.includes('$610.000'));
    const incompleto = ctx(TRAB(), { meses: { '2026-09': MES(600000), '2026-08': { calculo: null }, '2026-07': MES(620000) } });
    assert.ok(!D.validar('cert_remuneraciones', incompleto, d).puedeEmitir);
});

caso('comprobante de feriado: días hábiles sin sábados, domingos ni feriados, reintegro y saldo', () => {
    const c = ctx(), d = valido('comprobante_feriado', c, { fechaInicio: '2026-10-12', diasHabiles: '5', saldoAntes: '15' });
    const v = D.validar('comprobante_feriado', c, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    assert.ok(v.avisos.some(a => a.texto.indexOf('no es día hábil') >= 0), 'el 12-oct-2026 es feriado');
    const h = D.generar('comprobante_feriado', c, d, { pagada: true }).html;
    ['13 de octubre de 2026', '19 de octubre de 2026', '20 de octubre de 2026', '<td>10</td>'].forEach(t => assert.ok(h.includes(t), t));
    assert.ok(h.includes('Reintegro a sus labores'));
});
caso('comprobante de feriado: no puede superar el saldo, ni empezar antes del ingreso; año sin calendario bloquea', () => {
    const c = ctx();
    assert.ok(D.validar('comprobante_feriado', c, valido('comprobante_feriado', c, { fechaInicio: '2026-11-02', diasHabiles: '16', saldoAntes: '15' })).errores.diasHabiles);
    assert.ok(D.validar('comprobante_feriado', c, valido('comprobante_feriado', c, { fechaInicio: '2019-11-02', diasHabiles: '5', saldoAntes: '15' })).errores.fechaInicio);
    const v = D.validar('comprobante_feriado', c, valido('comprobante_feriado', c, { fechaInicio: '2029-01-08', diasHabiles: '5', saldoAntes: '15' }));
    assert.ok(!v.puedeEmitir && v.bloqueos[0].indexOf('2026 y 2027') >= 0);
    ['0', '-1', 'x', '1.5', '61'].forEach(n => assert.ok(D.validar('comprobante_feriado', c, valido('comprobante_feriado', c, { fechaInicio: '2026-11-02', diasHabiles: n, saldoAntes: '15' })).errores.diasHabiles, n));
});
caso('comprobante de feriado: avisa de la jornada de 6 días y de menos de un año de servicio', () => {
    const v6 = D.validar('comprobante_feriado', ctx(TRAB({ distribucion: '6' })), valido('comprobante_feriado', ctx(), { fechaInicio: '2026-11-02', diasHabiles: '5', saldoAntes: '15' }));
    assert.ok(v6.avisos.some(a => a.texto.indexOf('lunes a sábado') >= 0));
    const nuevo = ctx(TRAB({ fechaIngreso: '2026-03-01' }));
    assert.ok(D.validar('comprobante_feriado', nuevo, valido('comprobante_feriado', nuevo, { fechaInicio: '2026-11-02', diasHabiles: '5', saldoAntes: '5' })).avisos.some(a => a.texto.indexOf('menos de un año') >= 0));
});

caso('plazo de comunicación: tres días hábiles contando el sábado, sin domingos ni feriados', () => {
    assert.strictEqual(D.plazoComunicacion(ctx(), '2026-10-16'), '2026-10-20');
    assert.strictEqual(D.plazoComunicacion(ctx(), '2026-10-09'), '2026-10-14'); // sáb 10, lun 12 es feriado, mar 13, mié 14
});
caso('carta del art. 159 N°4: solo para contratos a plazo fijo con menos de dos renovaciones', () => {
    const pf = TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-01-10', fechaTerminoPlazo: '2026-10-31', renovaciones: 0 });
    const c = ctx(pf), d = valido('carta_159_4', c, { cotizaciones: true });
    assert.strictEqual(d.fechaTermino, '2026-10-31');
    const v = D.validar('carta_159_4', c, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    assert.ok(v.avisos.some(a => a.texto.indexOf('3 de noviembre de 2026') >= 0 || a.texto.indexOf('4 de noviembre de 2026') >= 0), v.avisos.map(a => a.texto).join('|'));
    const h = D.generar('carta_159_4', c, d, { pagada: true }).html;
    ['artículo 159 N°4', 'vencimiento del plazo convenido', '31 de octubre de 2026', 'hasta septiembre de 2026', 'artículo 162', 'Inspección del Trabajo', 'reserva de derechos', 'presencial'].forEach(t => assert.ok(h.includes(t), t));
    assert.ok(h.includes('terminará'));
    assert.ok(!D.validar('carta_159_4', ctx(TRAB()), valido('carta_159_4', ctx(TRAB()), { fechaTermino: '2026-10-31', cotizaciones: true })).puedeEmitir, 'indefinido');
    assert.ok(!D.validar('carta_159_4', ctx(TRAB({ contrato: 'plazo_fijo', renovaciones: 2 })), valido('carta_159_4', c, { fechaTermino: '2026-10-31', cotizaciones: true })).puedeEmitir, 'segunda renovación');
});
caso('cartas de término: la advertencia de cotizaciones va primero y como aviso (art. 162)', () => {
    const c = ctx(TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-01-10', fechaTerminoPlazo: '2026-10-31' }));
    ['carta_159_4', 'carta_161'].forEach(id => {
        const a = D.validar(id, c, valido(id, c, { cotizaciones: true })).avisos[0];
        assert.strictEqual(a.nivel, 'aviso', id);
        assert.ok(/no produce el efecto de poner término al contrato \(art\. 162\)/.test(a.texto) && /abogado/.test(a.texto), id);
        const etiqueta = D.campos(id).find(f => f.k === 'cotizaciones').etiqueta;
        assert.ok(/art\. 162/.test(etiqueta), id + ': la casilla recuerda la consecuencia');
    });
});
caso('carta del art. 159 N°4: exige confirmar las cotizaciones; finiquito electrónico lleva el aviso de voluntariedad', () => {
    const pf = TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-01-10', fechaTerminoPlazo: '2026-10-31' }), c = ctx(pf);
    assert.ok(D.validar('carta_159_4', c, valido('carta_159_4', c)).errores.cotizaciones);
    const h = D.generar('carta_159_4', c, valido('carta_159_4', c, { cotizaciones: true, finiquito: 'electronico', entrega: 'certificada' }), { pagada: true }).html;
    assert.ok(h.includes('forma electrónica') && h.includes('voluntario') && h.includes('carta certificada'));
    const vencida = D.generar('carta_159_4', c, valido('carta_159_4', c, { cotizaciones: true, fechaTermino: '2026-10-05' }), { pagada: true }).html;
    assert.ok(vencida.includes('terminó'));
});
caso('carta del art. 159 N°4: avisa si la duración supera un año y si falta el domicilio para la carta certificada', () => {
    const pf = TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2025-01-10', fechaTerminoPlazo: '2026-10-31', domicilio: '' }), c = ctx(pf);
    const v = D.validar('carta_159_4', c, valido('carta_159_4', c, { cotizaciones: true, entrega: 'certificada' }));
    assert.ok(v.avisos.some(a => a.texto.indexOf('no puede exceder de un año') >= 0));
    assert.ok(v.avisos.some(a => a.texto.indexOf('domicilio') >= 0));
});

caso('indemnización: 30 días por año y fracción superior a 6 meses, tope de 11 años y de 90 UF', () => {
    const i = D.indemnizacion('2020-03-15', '2026-10-20', 800000, null);
    assert.deepStrictEqual([i.aniosPago, i.porAnios], [7, 5600000]);
    assert.strictEqual(D.indemnizacion('2020-03-15', '2026-09-15', 800000, null).aniosPago, 6, '6 años y exactamente 6 meses no suma');
    assert.strictEqual(D.indemnizacion('2020-03-15', '2026-09-16', 800000, null).aniosPago, 7);
    assert.strictEqual(D.indemnizacion('2005-01-10', '2026-10-20', 800000, null).aniosPago, 11);
    assert.strictEqual(D.indemnizacion('2026-01-10', '2026-10-20', 800000, null).aniosPago, 0, 'menos de un año');
    const topada = D.indemnizacion('2020-03-15', '2026-10-20', 5000000, 41130.94);
    assert.deepStrictEqual([topada.topada, topada.base, topada.porAnios], [true, 3701785, 3701785 * 7]);
    assert.strictEqual(D.indemnizacion('1975-01-10', '2026-10-20', 800000, null).aniosPago, 52, 'sin tope antes de agosto de 1981');
});
caso('carta del art. 161: hechos concretos, confirmaciones y montos de las indemnizaciones', () => {
    const c = ctx(), base = { fechaTermino: '2026-10-20', hechos: HECHOS, remuneracion: 800000, sinLicencia: true, sinFuero: true, cotizaciones: true };
    const d = valido('carta_161', c, base);
    const v = D.validar('carta_161', c, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    const h = D.generar('carta_161', c, d, { pagada: true }).html;
    ['artículo 161 inciso primero', 'necesidades de la empresa', 'ventas de la sucursal', '7 años × $800.000', '$5.600.000', 'sustitutiva del aviso previo', '$6.400.000', 'oferta irrevocable', 'un solo acto', 'reserva de derechos', 'Inspección del Trabajo'].forEach(t => assert.ok(h.includes(t), t));
    const ant = D.generar('carta_161', c, valido('carta_161', c, Object.assign({}, base, { aviso: 'anticipacion', fecha: '2026-09-01' })), { pagada: true }).html;
    assert.ok(!ant.includes('Indemnización sustitutiva del aviso previo (art. 162)') && ant.includes('$5.600.000') && ant.includes('treinta días de anticipación'));
});
caso('carta del art. 161: rechaza hechos genéricos o con corchetes, falta de confirmaciones y avisos mal fechados', () => {
    const c = ctx(), base = { fechaTermino: '2026-10-20', hechos: HECHOS, remuneracion: 800000, sinLicencia: true, sinFuero: true, cotizaciones: true };
    const v = (extra) => D.validar('carta_161', c, valido('carta_161', c, Object.assign({}, base, extra)));
    assert.ok(v({ hechos: 'Necesidades de la empresa.' }).errores.hechos);
    assert.ok(v({ hechos: HECHOS + ' [completar]' }).errores.hechos);
    assert.ok(v({ sinLicencia: false }).errores.sinLicencia);
    assert.ok(v({ sinFuero: false }).errores.sinFuero);
    assert.ok(v({ cotizaciones: false }).errores.cotizaciones);
    assert.ok(v({ remuneracion: 0 }).errores.remuneracion);
    assert.ok(v({ aviso: 'anticipacion', fecha: '2026-10-10' }).errores.fechaTermino, 'menos de 30 días');
    assert.ok(!v({ aviso: 'anticipacion', fecha: '2026-09-20' }).errores.fechaTermino);
    assert.ok(v({ fechaTermino: '2020-03-15' }).errores.fechaTermino);
});
caso('carta del art. 161: informa el tope de 90 UF y la falta de UF', () => {
    const c = ctx(), v = D.validar('carta_161', c, valido('carta_161', c, { fechaTermino: '2026-10-20', hechos: HECHOS, remuneracion: 5000000, sinLicencia: true, sinFuero: true, cotizaciones: true }));
    assert.ok(v.avisos.some(a => a.texto.indexOf('90 UF') >= 0));
    const sinUf = ctx(TRAB(), { uf: 0 });
    assert.ok(D.validar('carta_161', sinUf, valido('carta_161', sinUf, { fechaTermino: '2026-10-20', hechos: HECHOS, remuneracion: 800000, sinLicencia: true, sinFuero: true, cotizaciones: true })).avisos.some(a => a.texto.indexOf('UF de hoy') >= 0));
});
caso('carta del art. 161: propone la base de la indemnización (DT: con colación y movilización, sin horas extra)', () => {
    // sin liquidación guardada: sueldo base 650.000 + colación 40.000 + movilización 30.000
    assert.strictEqual(D.valoresIniciales('carta_161', ctx()).remuneracion, 720000);
    // con liquidación guardada sin desglose (versiones anteriores) vale lo mismo que sin ella
    assert.strictEqual(D.valoresIniciales('carta_161', ctx(TRAB(), { meses: { '2026-09': MES(700000) } })).remuneracion, 720000);
    // con desglose: imponible 750.000 - horas extra 20.000 + colación y movilización 70.000
    assert.strictEqual(D.valoresIniciales('carta_161', ctx(TRAB(), { meses: { '2026-09': MESB(700000) } })).remuneracion, 800000);
});
caso('finiquito: el feriado se propone sin gratificación mensual, horas extra, colación ni movilización', () => {
    const v0 = D.valoresIniciales('finiquito', ctx());
    assert.strictEqual(v0.remFeriado, 650000);        // sin liquidación: el sueldo base
    assert.strictEqual(v0.remuneracion, 720000);      // la indemnización sí lleva colación y movilización
    const v1 = D.valoresIniciales('finiquito', ctx(TRAB(), { meses: { '2026-09': MESB(700000) } }));
    assert.strictEqual(v1.remFeriado, 630000);        // 750.000 imponible - 20.000 horas extra - 100.000 gratificación
    assert.strictEqual(v1.remuneracion, 800000);
});
caso('textos de ayuda: la base de la indemnización incluye colación y movilización; la del feriado no incluye gratificación', () => {
    const ayuda = (tipo, k) => D.campos(tipo).find(c => c.k === k).ayuda;
    assert.ok(/colación y movilización que se pagan mensualmente/.test(ayuda('finiquito', 'remuneracion')) && !/excluye[^.;]*colación/i.test(ayuda('finiquito', 'remuneracion')));
    assert.ok(/colación y movilización que se pagan mensualmente/.test(ayuda('carta_161', 'remuneracion')) && !/excluye[^.;]*colación/i.test(ayuda('carta_161', 'remuneracion')));
    assert.ok(/No incluye la gratificación mensual/.test(ayuda('finiquito', 'remFeriado')) && /836\/46/.test(ayuda('finiquito', 'remFeriado')));
});

caso('amonestación: hechos concretos y mención al reglamento solo si existe', () => {
    const c = ctx(), d = valido('amonestacion', c, { fechaHechos: '2026-10-05', obligacion: 'cumplir el horario de ingreso pactado en el contrato', hechos: 'El lunes 5 de octubre ingresó a las 09:40 horas, cuando su horario de ingreso es a las 09:00, sin dar aviso previo.' });
    assert.ok(D.validar('amonestacion', c, d).puedeEmitir);
    const h = D.generar('amonestacion', c, d, { pagada: true }).html;
    assert.ok(h.includes('art. 154 N°10') && h.includes('descargos') && h.includes('toma conocimiento'));
    const sin = D.generar('amonestacion', c, Object.assign({}, d, { reglamento: 'no' }), { pagada: true }).html;
    assert.ok(!sin.includes('154') && sin.includes('deja constancia'));
    assert.ok(D.validar('amonestacion', c, Object.assign({}, d, { hechos: 'Llegó tarde.' })).errores.hechos);
    assert.ok(D.validar('amonestacion', c, Object.assign({}, d, { fecha: '2026-10-01' })).errores.fecha);
    assert.ok(D.validar('amonestacion', c, d).avisos.some(a => a.texto.indexOf('acoso') >= 0));
});
caso('anexo de datos: cláusulas fijas y opcionales, numeradas en orden', () => {
    const c = ctx(), base = valido('anexo_datos', c, { correoPrivacidad: 'privacidad@laespiga.cl' });
    assert.ok(D.validar('anexo_datos', c, base).puedeEmitir);
    const minimo = D.generar('anexo_datos', c, base, { pagada: true }).html;
    assert.ok(minimo.includes('CLÁUSULA QUINTA') && !minimo.includes('CLÁUSULA SEXTA') && !minimo.includes('biométric') && !minimo.includes('Herramientas corporativas'));
    const todo = D.generar('anexo_datos', c, Object.assign({}, base, { biometria: true, herramientas: true, encargados: true }), { pagada: true }).html;
    ['CLÁUSULA OCTAVA', 'CLÁUSULA SÉPTIMA', 'alternativo', 'Herramientas corporativas', 'Encargados de tratamiento', 'privacidad@laespiga.cl', 'artículo 154 ter', '1 de diciembre de 2026', 'Ley N° 21.719'].forEach(t => assert.ok(todo.includes(t), t));
    assert.ok(D.validar('anexo_datos', c, Object.assign({}, base, { correoPrivacidad: 'no-es-correo' })).errores.correoPrivacidad);
    assert.ok(D.validar('anexo_datos', c, Object.assign({}, base, { correoPrivacidad: '' })).errores.correoPrivacidad);
});
caso('ningún documento deja corchetes de relleno ni la palabra undefined/null/NaN', () => {
    const pf = TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-01-10', fechaTerminoPlazo: '2026-10-31' });
    const casos = [
        ['cert_antiguedad', ctx(), {}], ['cert_remuneraciones', ctx(), {}],
        ['comprobante_feriado', ctx(), { fechaInicio: '2026-11-02', diasHabiles: '5', saldoAntes: '15' }],
        ['carta_159_4', ctx(pf), { cotizaciones: true }],
        ['carta_161', ctx(), { fechaTermino: '2026-10-20', hechos: HECHOS, remuneracion: 800000, sinLicencia: true, sinFuero: true, cotizaciones: true }],
        ['amonestacion', ctx(), { fechaHechos: '2026-10-05', obligacion: 'cumplir el horario', hechos: 'El lunes 5 de octubre ingresó a las 09:40 horas, cuando su horario de ingreso es a las 09:00, sin dar aviso previo.' }],
        ['anexo_datos', ctx(), { correoPrivacidad: 'a@b.cl' }]
    ];
    casos.forEach(([tipo, c, extra]) => {
        const h = D.generar(tipo, c, valido(tipo, c, extra), { pagada: true }).html;
        assert.ok(!/undefined|null|NaN|\[\s*\]/.test(h), tipo);
        assert.ok(!/\[[^\]]*\]/.test(h.replace(/<[^>]*>/g, '')), tipo + ' tiene corchetes');
    });
});


// ---------- finiquito ----------
const ANA = (extra) => TRAB(Object.assign({ nombre: 'Ana Pérez', fechaIngreso: '2022-03-15', sueldoBase: 650000 }, extra));
const VAC_ANA = [{ tipo: 'ajuste', dias: 18 }, { tipo: 'periodo', desde: '2026-10-19', hasta: '2026-10-23', dias: 5 }];
const fin = (c, extra) => Object.assign(D.valoresIniciales('finiquito', c), { fechaTermino: '2026-10-30', fecha: '2026-11-03', cotizaciones: true }, extra);

caso('finiquito: feriado pendiente del registro más el proporcional desde el último aniversario', () => {
    const c = ctx(ANA(), { vac: VAC_ANA });
    const p = D.propuestaFeriado(c, '2026-10-30');
    // 4 años completos (60 días) menos 23 tomados = 37; del 15-mar al 30-oct: 7 meses y 16 días × 1,25 = 9,42
    assert.strictEqual(p.pendientes, 37);
    assert.strictEqual(p.proporcionales, 9.42);
    assert.strictEqual(p.total, 46.42);
    // zona extrema: 20 días al año, 1,67 por mes
    assert.strictEqual(D.propuestaFeriado(ctx(ANA({ zonaExtrema: true }), { vac: [] }), '2026-10-30').proporcionales, 12.56);
});
caso('finiquito: días hábiles a corridos desde el día siguiente al término (sábados, domingos y feriados del período)', () => {
    // término viernes 30-oct-2026: 2 hábiles son lunes 2 y martes 3 de noviembre (sábado 31-oct y domingo 1-nov son inhábiles)
    const r = D.diasCorridos(ctx(), '2026-10-30', 2.5);
    assert.strictEqual(r.inhabiles, 2);
    assert.strictEqual(r.corridos, 4.5);
    assert.strictEqual(r.hasta, '2026-11-04');       // el 0,5 se toma el día hábil siguiente (miércoles 4)
});
caso('finiquito: si los días completos terminan en viernes, el fin de semana antes de la fracción también cuenta', () => {
    // término sábado 19-sep-2026: 10 hábiles terminan el viernes 2-oct; la fracción de 0,42 cae el lunes 5-oct,
    // con sábado 3 y domingo 4 en medio. Inhábiles: 20, 26, 27 de septiembre y 3 y 4 de octubre.
    const r = D.diasCorridos(ctx(), '2026-09-19', 10.42);
    assert.strictEqual(r.inhabiles, 5);
    assert.strictEqual(r.corridos, 15.42);
    assert.strictEqual(r.hasta, '2026-10-05');
    // sin fracción no hay fin de semana de más
    assert.strictEqual(D.diasCorridos(ctx(), '2026-09-19', 10).corridos, 13);
    // la fracción que cae entre semana no suma inhábiles: 9,54 hábiles desde el sábado 19-sep
    const s = D.diasCorridos(ctx(), '2026-09-19', 9.54);
    assert.strictEqual(s.inhabiles, 3);
    assert.strictEqual(s.corridos, 12.54);
});
caso('finiquito por art. 161: años de servicio, sustitutiva, feriado y total', () => {
    const c = ctx(ANA(), { vac: VAC_ANA });
    const d = fin(c, { causal: '161' });
    const v = D.validar('finiquito', c, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    const r = D.calcularFiniquito(c, d, []);
    assert.strictEqual(r.ias, 3600000);          // 4 años y 7 meses: 5 años × $720.000 (sueldo, colación y movilización)
    assert.strictEqual(r.sustitutiva, 720000);
    assert.strictEqual(r.feriado.habiles, 46.42);
    assert.strictEqual(r.feriado.monto, Math.round(r.feriado.corridos * 650000 / 30));
    assert.strictEqual(r.total, r.ias + r.sustitutiva + r.feriado.monto);
    const html = D.generar('finiquito', c, d, { pagada: true }).html;
    assert.ok(html.indexOf('artículo 161 inciso primero') >= 0 && html.indexOf('Ministro de fe') >= 0 && html.indexOf('Reserva de derechos') >= 0);
    assert.ok(html.indexOf('&lt;La Espiga&gt;') >= 0, 'escapa la razón social');
    assert.ok(html.indexOf('Vista previa') < 0);
    assert.ok(D.generar('finiquito', c, d, { pagada: false }).html.indexOf('Vista previa') >= 0);
});
caso('finiquito por renuncia: sin indemnizaciones; los días escritos a mano reemplazan el cálculo', () => {
    const c = ctx(ANA(), { vac: VAC_ANA });
    const d = fin(c, { causal: '159_2', diasFeriado: '10,5' });
    const r = D.calcularFiniquito(c, d, []);
    assert.strictEqual(r.ias + r.sustitutiva, 0);
    assert.strictEqual(r.feriado.habiles, 10.5);
    assert.strictEqual(r.feriado.usaPropuesta, false);
    const v = D.validar('finiquito', c, d);
    assert.ok(v.puedeEmitir);
    assert.ok(v.avisos.some(a => /renuncia/.test(a.texto) && /177/.test(a.texto)));
    assert.ok(!v.avisos.some(a => /despido no produce/.test(a.texto)), 'la advertencia del art. 162 es para despidos');
});
caso('finiquito: validaciones (fechas, causal, descuentos y plazo fijo)', () => {
    const c = ctx(ANA(), { vac: VAC_ANA });
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '161', fecha: '2026-10-20' })).errores.fecha);
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '161', remuneracion: '' })).errores.remuneracion);
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '159_2', descuentoAfc: 50000 })).errores.descuentoAfc);
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '161', descuentoAfc: 9000000 })).errores.descuentoAfc, 'el aporte AFC no puede superar la indemnización');
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '159_2', otrosDescuentos: 99000000 })).errores.otrosDescuentos);
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '159_2', diasFeriado: '3,456' })).errores.diasFeriado);
    assert.ok(D.validar('finiquito', c, fin(c, { causal: '159_4' })).bloqueos.length, 'contrato indefinido no puede terminar por 159 N°4');
    const pf = ctx(ANA({ contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-30', renovaciones: 2 }), { vac: [] });
    assert.ok(D.validar('finiquito', pf, fin(pf, { causal: '159_4' })).bloqueos.some(b => /indefinida/.test(b)));
    assert.ok(!D.validar('finiquito', c, fin(c, { causal: '159_2', cotizaciones: false })).puedeEmitir);
});
caso('finiquito: avisa el saldo de préstamos al mes de término, sin descontarlo solo', () => {
    const L = require('../js/pyme_liquidaciones');
    const t = ANA({ prestamos: [{ id: 'abc123', concepto: 'Préstamo', fecha: '2026-09-01', monto: 300000, cuotas: 6, desde: '2026-09', pausas: [] }] });
    const c = ctx(t, { vac: VAC_ANA, saldoPrestamos: p => L.saldoPrestamos(t, p) });
    const v = D.validar('finiquito', c, fin(c, { causal: '159_2' }));
    assert.ok(v.avisos.some(a => /saldo de \$200\.000/.test(a.texto) && /por escrito/.test(a.texto)), JSON.stringify(v.avisos.map(a => a.texto)));
    const sin = ctx(ANA(), { vac: VAC_ANA, saldoPrestamos: () => 0 });
    assert.ok(!D.validar('finiquito', sin, fin(sin, { causal: '159_2' })).avisos.some(a => /saldo de/.test(a.texto)));
});

// ---------- contrato, anexo y pacto de horas extra ----------
const FICHA_CONTRATO = (extra) => TRAB(Object.assign({ nacionalidad: 'Chilena', fechaNacimiento: '1990-05-20', fechaIngreso: '2026-10-05', jornadaHoras: 42 }, extra));
const FUNCIONES = 'Atender a los clientes en el local\n- Ordenar y reponer la mercadería\n3. Cerrar la caja al final del turno';

caso('montos en palabras', () => {
    assert.strictEqual(D.pesosEnLetras(650000), 'seiscientos cincuenta mil pesos');
    assert.strictEqual(D.pesosEnLetras(1000000), 'un millón de pesos');
    assert.strictEqual(D.pesosEnLetras(1521000), 'un millón quinientos veintiún mil pesos');
    assert.strictEqual(D.pesosEnLetras(100000), 'cien mil pesos');
    assert.strictEqual(D.pesosEnLetras(553553), 'quinientos cincuenta y tres mil quinientos cincuenta y tres pesos');
});
caso('contrato: exige los datos del art. 10 en la ficha y arma las cláusulas con la ficha', () => {
    const sinNac = ctx(FICHA_CONTRATO({ nacionalidad: '', fechaNacimiento: '' }));
    const f = D.validar('contrato', sinNac, valido('contrato', sinNac, { funciones: FUNCIONES })).faltaFicha.map(x => x.k);
    assert.deepStrictEqual(f.sort(), ['fechaNacimiento', 'nacionalidad']);
    const c = ctx(FICHA_CONTRATO());
    const d = valido('contrato', c, { funciones: FUNCIONES, confidencialidad: true });
    assert.strictEqual(d.horario, 'de lunes a viernes, de 08:30 a 17:54 horas, con un descanso de 60 minutos para colación, que no se considera trabajado');
    assert.strictEqual(d.lugarTrabajo, 'Av. Principal 123, Temuco');
    const v = D.validar('contrato', c, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    const h = D.generar('contrato', c, d, { pagada: true }).html;
    ['seiscientos cincuenta mil pesos', 'de nacionalidad chilena', 'nacido/a el 20 de mayo de 1990', '42 horas semanales', '4,75 ingresos mínimos', 'colación por $40.000', 'duración indefinida', 'Ley N° 21.643', 'SÉPTIMO: Confidencialidad.', '<li>Ordenar y reponer la mercadería</li>', '<li>Cerrar la caja al final del turno</li>', 'Panadería &lt;La Espiga&gt; Ltda.'].forEach(s => assert.ok(h.indexOf(s) >= 0, s));
    assert.ok(h.indexOf('[') < 0 && h.indexOf('undefined') < 0);
    assert.ok(v.avisos.some(a => /Mi DT/.test(a.texto)));
});
caso('contrato: plazo fijo, obra, jornada parcial, gratificación pactada y avisos', () => {
    const pf = ctx(FICHA_CONTRATO({ contrato: 'plazo_fijo', fechaTerminoPlazo: '' }));
    assert.ok(D.validar('contrato', pf, valido('contrato', pf, { funciones: FUNCIONES })).faltaFicha.some(x => x.k === 'fechaTerminoPlazo'));
    const pf2 = ctx(FICHA_CONTRATO({ contrato: 'plazo_fijo', fechaTerminoPlazo: '2027-01-04' }));
    assert.ok(D.generar('contrato', pf2, valido('contrato', pf2, { funciones: FUNCIONES }), { pagada: true }).html.indexOf('hasta el 4 de enero de 2027') >= 0);
    const ob = ctx(FICHA_CONTRATO({ contrato: 'obra' }));
    assert.ok(D.validar('contrato', ob, valido('contrato', ob, { funciones: FUNCIONES })).errores.nombreObra);
    const pa = ctx(FICHA_CONTRATO({ gratificacion: 'pactada', jornadaHoras: 20 }));
    const vpa = D.validar('contrato', pa, valido('contrato', pa, { funciones: FUNCIONES }));
    assert.ok(vpa.errores.gratificacionPactada);
    assert.ok(vpa.avisos.some(a => /jornada parcial/.test(a.texto)));
    assert.ok(!D.campoVisible(D.campos('contrato').find(x => x.k === 'gratificacionPactada'), c0(), {}));
    const tarde = ctx(FICHA_CONTRATO({ fechaIngreso: '2026-09-01' }));
    assert.ok(D.validar('contrato', tarde, valido('contrato', tarde, { funciones: FUNCIONES, fecha: '2026-10-12' })).avisos.some(a => /dentro de 15 días/.test(a.texto)));
    const larga = ctx(FICHA_CONTRATO({ jornadaHoras: 44 }));
    assert.ok(D.validar('contrato', larga, valido('contrato', larga, { funciones: FUNCIONES })).bloqueos.length);
    const sinKarin = ctx(FICHA_CONTRATO());
    assert.ok(D.validar('contrato', sinKarin, valido('contrato', sinKarin, { funciones: FUNCIONES, protocolo: false })).avisos.some(a => /Ley Karin/.test(a.texto)));
});
function c0() { return ctx(FICHA_CONTRATO()); }
caso('anexo: sueldo, jornada, cargo, prórroga e indefinido', () => {
    const c = ctx(TRAB());
    let d = valido('anexo_contrato', c, { materia: 'sueldo', nuevoSueldo: 700000 });
    assert.strictEqual(d.vigencia, '2026-11-01');
    assert.ok(D.validar('anexo_contrato', c, d).puedeEmitir);
    assert.ok(D.generar('anexo_contrato', c, d, { pagada: true }).html.indexOf('setecientos mil pesos') >= 0);
    assert.ok(D.validar('anexo_contrato', c, Object.assign({}, d, { nuevoSueldo: 600000 })).avisos.some(a => /rebaja/.test(a.texto)));
    assert.ok(D.validar('anexo_contrato', c, Object.assign({}, d, { nuevoSueldo: '' })).errores.nuevoSueldo);
    d = valido('anexo_contrato', c, { materia: 'jornada', nuevaJornada: '43', nuevoHorario: 'de lunes a viernes' });
    assert.ok(/42 horas/.test(D.validar('anexo_contrato', c, d).errores.nuevaJornada));
    d = valido('anexo_contrato', c, { materia: 'cargo', nuevoCargo: 'Encargada de local', nuevasFunciones: 'Abrir y cerrar el local' });
    assert.ok(D.generar('anexo_contrato', c, d, { pagada: true }).html.indexOf('Encargada de local') >= 0);
    // prórroga
    const pf = ctx(TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-05-04', fechaTerminoPlazo: '2026-10-31', renovaciones: 0 }));
    d = valido('anexo_contrato', pf, { nuevoTermino: '2027-01-31', fecha: '2026-10-20' });
    assert.strictEqual(d.materia, 'prorroga');
    let v = D.validar('anexo_contrato', pf, d);
    assert.ok(v.puedeEmitir, JSON.stringify(v));
    assert.ok(v.avisos.some(a => /más de un año/.test(a.texto)) === false);
    assert.ok(D.generar('anexo_contrato', pf, d, { pagada: true }).html.indexOf('hasta el <strong>31 de enero de 2027</strong>') >= 0);
    assert.ok(D.validar('anexo_contrato', pf, Object.assign({}, d, { nuevoTermino: '2027-06-30' })).avisos.some(a => /más de un año/.test(a.texto)));
    assert.ok(D.validar('anexo_contrato', pf, Object.assign({}, d, { nuevoTermino: '2026-10-15' })).errores.nuevoTermino);
    assert.ok(D.validar('anexo_contrato', pf, Object.assign({}, d, { fecha: '2026-11-03' })).avisos.some(a => /ya es indefinido/.test(a.texto)));
    const pf2 = ctx(TRAB({ contrato: 'plazo_fijo', fechaIngreso: '2026-05-04', fechaTerminoPlazo: '2026-10-31', renovaciones: 1 }));
    assert.ok(D.validar('anexo_contrato', pf2, valido('anexo_contrato', pf2, { nuevoTermino: '2027-01-31' })).bloqueos.some(b => /segunda renovación/.test(b)));
    assert.ok(D.validar('anexo_contrato', c, valido('anexo_contrato', c, { materia: 'indefinido' })).bloqueos.length, 'ya es indefinido');
    assert.ok(D.validar('anexo_contrato', pf, valido('anexo_contrato', pf, { materia: 'indefinido' })).puedeEmitir);
});
caso('pacto de horas extra: hasta 3 meses y 2 horas por día', () => {
    const c = ctx(TRAB());
    const d = valido('pacto_horas_extra', c, { motivo: 'Aumento de pedidos por las fiestas de fin de año.' });
    assert.deepStrictEqual([d.desde, d.hasta], ['2026-10-12', '2027-01-11']);
    assert.ok(D.validar('pacto_horas_extra', c, d).puedeEmitir);
    assert.ok(D.validar('pacto_horas_extra', c, Object.assign({}, d, { hasta: '2027-01-12' })).errores.hasta);
    assert.ok(D.validar('pacto_horas_extra', c, Object.assign({}, d, { maxDiarias: '3' })).errores.maxDiarias);
    const h = D.generar('pacto_horas_extra', c, d, { pagada: true }).html;
    assert.ok(h.indexOf('máximo de 2 horas por día') >= 0 && h.indexOf('cincuenta por ciento') >= 0);
});

console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : ''));
