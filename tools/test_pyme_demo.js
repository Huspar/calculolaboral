// Pruebas del modo de ejemplo de /app (empresa ficticia en memoria, sin servidor): node tools/test_pyme_demo.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const B = require('./build_pyme_demo');
const D = require('../js/pyme_demo');
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const F = require('../js/feriados_cl');
const L = require('../js/pyme_liquidaciones');
const PEND = require('../js/pyme_pendientes');
const Rut = require('../js/rut_cl');

let ok = 0, pendientes = Promise.resolve();
function caso(nombre, fn) {
    pendientes = pendientes.then(async () => {
        try { await fn(); ok++; console.log('  ok  ' + nombre); } catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.stack || e.message).split('\n').slice(0, 14).join('\n         ')); process.exitCode = 1; }
    });
}

// El paquete del navegador, cargado como lo haría la página (con sus globales)
function servidor() {
    const ventana = { crypto: require('crypto').webcrypto, CLRut: Rut, CLLiquidacionParametros: P, CLFeriados: F, CLPymeVacaciones: require('../js/pyme_vacaciones') };
    ventana.window = ventana;
    vm.createContext(ventana);
    vm.runInContext(fs.readFileSync(B.SALIDA, 'utf8'), ventana);
    return ventana.CLPymeDemoServidor;
}
const valores = (p) => Object.assign({}, P.vigenciaDe(p), P.RESPALDO[p] || P.RESPALDO['2026-10']);
// Lo que hace el panel al abrir el ejemplo: guarda las liquidaciones de los dos meses con el motor
async function abrir(hoy, periodo) {
    const demo = await D.crear({ hoy, periodo, servidor: servidor() });
    const est = (await demo.api('estado')).datos;
    const [y, m] = periodo.split('-').map(Number), Pa = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
    for (const x of demo.meses(Pa, periodo)) {
        const t = est.trabajadores.find(w => Rut.formatear(w.rut) === Rut.formatear(x.rut));
        assert.ok(t, 'el plan de meses usa un RUT del ejemplo: ' + x.rut);
        const mes = Object.assign(L.mesBase(t, x.periodo), x.cambios, { cuotasPrestamo: L.cuotasDelMes(t, x.periodo) });
        const res = E.calcular({ trabajador: t, mes, periodo: x.periodo, tasaMutual: est.empresa.tasaMutual }, valores(x.periodo));
        const r = await demo.api('mes', { metodo: 'PUT', query: { trabajador: t.id, periodo: x.periodo }, cuerpo: { mes: Object.assign({}, mes, { calculo: L.resumen(res, valores(x.periodo), t) }) } });
        assert.ok(r.ok, JSON.stringify(r.datos));
    }
    return { demo, est, Pa };
}

caso('js/pyme_demo_servidor.js está al día con api/_pyme/datos.js, validar.js y el almacén en memoria', () => {
    assert.strictEqual(fs.readFileSync(B.SALIDA, 'utf8').replace(/\r\n/g, '\n'), B.armar(), 'corre node tools/build_pyme_demo.js');
});

caso('el ejemplo abre con la empresa, tres trabajadores y sin Pase (documentos con marca), con cupo de 5', async () => {
    const { demo, est } = await abrir('2026-10-14', '2026-10');
    assert.strictEqual(est.ejemplo, true);
    assert.strictEqual(est.empresa.razonSocial, 'Panadería Los Aromos SpA');
    assert.strictEqual(est.trabajadores.length, 3);
    assert.deepStrictEqual([est.limites.paseVence, est.limites.maxActivos, est.pase.venta], [null, 5, false]);
    assert.strictEqual((await demo.api('sesion')).datos.email, D.CORREO);
    const vac = (await demo.api('vacaciones')).datos.vacaciones, docs = (await demo.api('documentos')).datos.documentos;
    assert.deepStrictEqual([vac.length, docs.length], [3, 2]);
    assert.strictEqual((await demo.api('honorarios', { query: { periodo: '2026-10' } })).datos.boletas.length, 1);
    const meses = (await demo.api('meses', { query: { periodo: '2026-10' } })).datos.meses;
    assert.strictEqual(meses.length, 2, 'el mes de trabajo queda a medias: Bruno sin preparar');
    assert.strictEqual(meses.filter(x => x.mes.emitida).length, 1);
    assert.strictEqual((await demo.api('meses', { query: { periodo: '2026-09' } })).datos.meses.filter(x => x.mes.emitida).length, 3);
});

caso('valida como el servidor y respeta el cupo: el sexto trabajador activo no entra', async () => {
    const { demo } = await abrir('2026-10-14', '2026-10');
    const malo = await demo.api('trabajador', { metodo: 'POST', cuerpo: { trabajador: { nombre: 'Sin RUT' } } });
    assert.deepStrictEqual([malo.ok, malo.estado, malo.datos.codigo], [false, 400, 'validacion']);
    const nuevo = (rut) => ({ nombre: 'Persona ' + rut, rut, fechaIngreso: '2026-01-05', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 560000, afp: 'Modelo', salud: 'fonasa' });
    assert.ok((await demo.api('trabajador', { metodo: 'POST', cuerpo: { trabajador: nuevo('11.111.111-1') } })).ok);
    assert.ok((await demo.api('trabajador', { metodo: 'POST', cuerpo: { trabajador: nuevo('22.222.222-2') } })).ok);
    const sexto = await demo.api('trabajador', { metodo: 'POST', cuerpo: { trabajador: nuevo('33.333.333-3') } });
    assert.deepStrictEqual([sexto.ok, sexto.datos.codigo], [false, 'limite']);
});

caso('no envía correos, no crea enlaces ni compras y no tiene cuenta que borrar', async () => {
    const { demo, est } = await abrir('2026-10-14', '2026-10');
    for (const [ruta, o] of [['enlace-liquidacion', { metodo: 'POST', query: { trabajador: est.trabajadores[0].id, periodo: '2026-10' } }], ['avisos-correo', { metodo: 'PUT', cuerpo: { activo: true } }], ['comprar', { metodo: 'POST' }], ['borrar-cuenta', { metodo: 'POST' }], ['entrar', { metodo: 'POST' }]]) {
        const r = await demo.api(ruta, o);
        assert.deepStrictEqual([r.ok, r.datos.codigo], [false, 'ejemplo'], ruta);
        assert.ok(r.datos.error.length > 20, ruta);
    }
    assert.deepStrictEqual((await demo.api('avisos-correo')).datos, { ok: true, activo: false });
    assert.deepStrictEqual((await demo.api('enlaces-liquidacion', { query: { periodo: '2026-10' } })).datos.enlaces, []);
    const archivo = await demo.exportar();
    assert.strictEqual(archivo.trabajadores.length, 3);
});

caso('los avisos del mes muestran la licencia por tramitar, el plazo fijo por vencer y la Ley Karin', async () => {
    const { demo, est } = await abrir('2026-10-14', '2026-10');
    const meses = (await demo.api('meses', { query: { periodo: '2026-10' } })).datos.meses;
    const liq = {}; meses.forEach(x => { liq[x.trabajadorId] = x.mes; });
    const lista = PEND.pendientes(est, { hoy: '2026-10-14', P, F, ultimoRespaldo: new Date().toISOString(), liquidaciones: { periodo: '2026-10', meses: liq }, documentos: [] });
    const titulos = lista.map(p => p.titulo).join(' | ');
    assert.ok(/licencia/i.test(titulos), titulos);
    assert.ok(/plazo fijo vence/i.test(titulos), titulos);
    assert.ok(/Ley Karin/.test(titulos), titulos);
});

caso('las fechas se arman desde hoy: abre igual a comienzo de mes y en el cambio de año', async () => {
    for (const [hoy, periodo] of [['2026-11-03', '2026-10'], ['2027-01-05', '2026-12'], ['2027-03-31', '2027-03']]) {
        const { demo, est, Pa } = await abrir(hoy, periodo);
        assert.strictEqual(est.trabajadores.length, 3, hoy);
        assert.strictEqual((await demo.api('honorarios', { query: { periodo } })).datos.boletas.length, 1, hoy + ': la boleta cae en el mes de trabajo');
        assert.strictEqual((await demo.api('meses', { query: { periodo: Pa } })).datos.meses.length, 3, hoy);
        const bruno = est.trabajadores.find(t => t.contrato === 'plazo_fijo');
        assert.ok(bruno.fechaTerminoPlazo > hoy && bruno.fechaIngreso < hoy, hoy);
    }
});

pendientes.then(() => console.log('\n' + ok + ' pruebas correctas' + (process.exitCode ? ' (hay fallas)' : '')));
