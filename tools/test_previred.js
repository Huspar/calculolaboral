/*
 * Pruebas del archivo de Previred (105 campos, formato variable por ";").
 *   node tools/test_previred.js
 *
 * No prueba contra Previred: verifica estructura, posiciones, digito verificador,
 * cuadre de montos y que los casos no soportados fallen con un error claro.
 */
'use strict';
const assert = require('assert');
const path = require('path');
const G = require(path.join(__dirname, '..', 'js', 'previred_generador.js'));

let ok = 0;
function caso(nombre, fn) {
    try { fn(); ok++; console.log('  ok  ' + nombre); }
    catch (e) { console.error('  FALLA  ' + nombre + '\n         ' + (e.message || e).split('\n').slice(0, 6).join('\n         ')); process.exitCode = 1; }
}

const empleador = { mutual: 'Mutual de Seguridad' };

const fonasa = {
    rut: '12.345.678-5', apellidoPaterno: 'Rojas', apellidoMaterno: 'Pérez', nombres: 'Camila',
    sexo: 'F', nacionalidad: '0', afp: 'Cuprum', salud: 'Fonasa', dias: 30,
    rentaAfp: 1419115, cotizacionAfp: 162347, sis: 25260, cotizacionSalud: 99338,
    rentaMutual: 1419115, cotizacionMutual: 13198,
    rentaAfc: 1419115, aporteTrabajadorAfc: 8515, aporteEmpleadorAfc: 34059
};

const isapre = {
    rut: '9.876.543-3', apellidoPaterno: 'Álvarez', apellidoMaterno: 'Soto', nombres: 'Rodrigo',
    sexo: 'M', nacionalidad: '0', afp: 'Habitat', salud: 'Colmena', dias: 30,
    rentaAfp: 2100000, cotizacionAfp: 243600, sis: 37380, rentaIsapre: 2100000,
    cotizacionIsapre: 147000, cotizacionPactada: 147000, isapreMoneda: 'PESOS', fun: 'FUN123',
    rentaMutual: 2100000, cotizacionMutual: 52500,
    rentaAfc: 2100000, aporteTrabajadorAfc: 12600, aporteEmpleadorAfc: 50400
};

const salida = G.generar({ periodo: '2026-10', empleador, trabajadores: [fonasa, isapre] });

caso('genera una linea por trabajador', () => {
    assert.strictEqual(salida.filas.length, 2);
    assert.ok(salida.texto.length > 0, JSON.stringify(salida.errores));
});

caso('cada linea tiene 105 campos', () => {
    salida.filas.forEach(f => assert.strictEqual(f.split(';').length, 105));
});

caso('el validador no encuentra problemas', () => {
    assert.deepStrictEqual(G.validar(salida.texto), []);
});

caso('Fonasa: salud 07 y cotizacion en el campo 70', () => {
    const f = salida.filas[0].split(';');
    assert.strictEqual(f[74], '07');
    assert.strictEqual(f[69], '99338');
    assert.strictEqual(f[77], '0');
});

caso('AFP Cuprum es 03 y Habitat 05', () => {
    const a = salida.filas[0].split(';');
    const b = salida.filas[1].split(';');
    assert.strictEqual(a[25], '03');
    assert.strictEqual(b[25], '05');
});

caso('Isapre: codigo, renta y cotizacion en 75, 77 y 80', () => {
    const f = salida.filas[1].split(';');
    assert.strictEqual(f[74], '04');
    assert.strictEqual(f[76], '2100000');
    assert.strictEqual(f[79], '147000');
    assert.strictEqual(f[77], '1'); // campo 78: moneda en pesos
});

caso('mutualidad y seguro de cesantia en sus campos', () => {
    const f = salida.filas[0].split(';');
    assert.strictEqual(f[95], '02');
    assert.strictEqual(f[99], '1419115');
    assert.strictEqual(f[101], '34059');
});

caso('periodo en formato mmaaaa', () => {
    assert.strictEqual(salida.filas[0].split(';')[8], '102026');
});

caso('un RUT con digito verificador malo no genera archivo', () => {
    const r = G.generar({ periodo: '2026-10', empleador, trabajadores: [Object.assign({}, fonasa, { rut: '12.345.678-9' })] });
    assert.strictEqual(r.texto, '');
    assert.ok(r.errores.length > 0, JSON.stringify(r.errores));
});

caso('un plan de Isapre en UF se rechaza en vez de adivinar', () => {
    const r = G.generar({ periodo: '2026-10', empleador, trabajadores: [Object.assign({}, isapre, { isapreMoneda: 'UF' })] });
    assert.strictEqual(r.texto, '');
    assert.ok(r.errores.some(e => /UF/.test(e)), JSON.stringify(r.errores));
});

caso('sin mutualidad del empleador no genera archivo', () => {
    const r = G.generar({ periodo: '2026-10', empleador: {}, trabajadores: [fonasa] });
    assert.strictEqual(r.texto, '');
    assert.ok(r.errores.some(e => /mutualidad/i.test(e)));
});

caso('el validador detecta una linea incompleta', () => {
    const roto = salida.filas[0].split(';').slice(0, 100).join(';');
    assert.ok(G.validar(roto).some(p => /105/.test(p)));
});

caso('sin periodo no genera archivo', () => {
    const r = G.generar({ empleador, trabajadores: [fonasa] });
    assert.strictEqual(r.texto, '');
    assert.ok(r.errores.some(e => /per/i.test(e)));
});

caso('un lote real del motor se convierte en 105 campos', () => {
    const E = require(path.join(__dirname, '..', 'js', 'liquidacion_engine.js'));
    const P = require(path.join(__dirname, '..', 'js', 'liquidacion_parametros.js'));
    const valores = Object.assign({}, P.vigenciaDe('2026-10'), P.RESPALDO['2026-10']);
    const det = E.calcular({
        trabajador: { sueldoBase: 1200000, afp: 'Cuprum', salud: 'fonasa', contrato: 'indefinido', jornadaHoras: 42, fechaIngreso: '2020-01-01', colacion: 0, movilizacion: 0 },
        mes: { diasTrabajados: 30, horasExtra: 0, comisiones: 0, gratificacion: 'legal' },
        periodo: '2026-10', tasaMutual: 0.93
    }, valores);
    const r = G.desdeLiquidaciones([{
        record: { rut: '12.345.678-5', nombre: 'Camila Rojas Fuentes', sexo: 'F', afp: 'Cuprum', salud: 'fonasa', dias: 30 },
        detalle: det
    }], { periodo: '2026-10', mutual: 'ACHS' });
    assert.deepStrictEqual(r.errores, []);
    const f = r.filas[0].split(';');
    assert.strictEqual(f.length, 105);
    assert.strictEqual(f[25], '03');                 // AFP Cuprum
    assert.strictEqual(f[74], '07');                 // Fonasa
    assert.strictEqual(f[2] + ' ' + f[3] + ' ' + f[4], 'Rojas Fuentes Camila');
    assert.strictEqual(f[95], '01');                 // ACHS
    assert.ok(Number(f[69]) > 0, 'cotizacion de salud');
    assert.ok(Number(f[101]) > 0, 'aporte empleador AFC');
});

caso('plan de Isapre en UF va al campo 79 con 4 decimales', () => {
    const r = G.generar({
        periodo: '2026-10', empleador,
        trabajadores: [Object.assign({}, isapre, { isapreMoneda: 'UF', planUF: 3.4 })]
    });
    assert.deepStrictEqual(r.errores, []);
    const f = r.filas[0].split(';');
    assert.strictEqual(f[77], '2');          // campo 78: moneda UF
    assert.strictEqual(f[78], '00034000');   // campo 79: plan en UF
});

caso('movimiento de personal, CCAF y centro de costos', () => {
    const r = G.generar({
        periodo: '2026-10', empleador: { mutual: 'ACHS', ccaf: 'Los Andes' },
        trabajadores: [Object.assign({}, fonasa, { centroCosto: 'Sucursal 2', movimiento: { codigo: '2', desde: '01-10-2026', hasta: '31-10-2026' } })]
    });
    assert.deepStrictEqual(r.errores, []);
    const f = r.filas[0].split(';');
    assert.strictEqual(f[14], '2');
    assert.strictEqual(f[15], '01-10-2026');
    assert.strictEqual(f[16], '31-10-2026');
    assert.strictEqual(f[82], '01');            // CCAF Los Andes
    assert.strictEqual(f[83], '1419115');       // renta imponible CCAF
    assert.strictEqual(f[104], 'Sucursal 2');
});

caso('un retiro sin fecha hasta no genera archivo', () => {
    const r = G.generar({
        periodo: '2026-10', empleador,
        trabajadores: [Object.assign({}, fonasa, { movimiento: { codigo: '2', desde: '01-10-2026' } })]
    });
    assert.strictEqual(r.texto, '');
    assert.ok(r.errores.some(e => /fecha/i.test(e)), JSON.stringify(r.errores));
});

caso('el texto del Excel se traduce a codigo de movimiento', () => {
    const base = {
        record: { rut: '12.345.678-5', nombre: 'Camila Rojas Fuentes', sexo: 'F', afp: 'Cuprum', salud: 'fonasa', dias: 30, contrato: 'plazo', movimiento: 'retiro', movHasta: '31-10-2026', centroCosto: 'Obra 1' },
        detalle: { bases: { baseAfp: 1000000, baseAfc: 1000000 }, descuentosLegales: [{ concepto: 'AFP Cuprum', monto: 114400 }, { concepto: 'Salud Fonasa', monto: 70000 }, { concepto: 'Seguro de cesantía', monto: 6000 }], empleador: { lineas: [{ clave: 'sis', monto: 17800 }, { clave: 'afc', monto: 24000 }, { clave: 'mutual', monto: 9300 }] } }
    };
    const r = G.desdeLiquidaciones([base], { periodo: '2026-10', mutual: 'ACHS' });
    assert.deepStrictEqual(r.errores, []);
    const f = r.filas[0].split(';');
    assert.strictEqual(f[14], '2');       // retiro
    assert.strictEqual(f[16], '31-10-2026');
    assert.strictEqual(f[104], 'Obra 1');
});

console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK (' + ok + ' comprobaciones)');
