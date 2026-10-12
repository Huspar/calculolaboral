// Casos de referencia del generador de liquidaciones. Ejecutar: node tools/test_liquidacion.js
// Cada resultado esperado se calculó a mano con los criterios documentados en js/liquidacion_engine.js.
const { calcular } = require('../js/liquidacion_engine.js');
const { MESES } = require('../js/liquidacion_parametros.js');

const base = (t, m) => ({
    trabajador: Object.assign({ contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa' }, t),
    mes: Object.assign({ diasTrabajados: 30, gratificacion: 'ninguna' }, m)
});
const linea = (lista, texto) => (lista.find(l => l.concepto.startsWith(texto)) || {}).monto;

const casos = [
    {
        nombre: 'Ingreso mínimo, Modelo, Fonasa (igual al ejemplo de la guía)',
        datos: base({ sueldoBase: 553553 }), mes: '2026-10',
        esperado: { AFP: 58566, 'Salud Fonasa': 38749, 'Seguro de cesantía': 3321, 'Impuesto único': 0, liquido: 452917 }
    },
    {
        nombre: 'Ingreso mínimo con gratificación legal',
        datos: base({ sueldoBase: 553553 }, { gratificacion: 'legal' }), mes: '2026-10',
        esperado: { 'Gratificación legal': 138388, totalImponible: 691941, AFP: 73207, 'Salud Fonasa': 48436, 'Seguro de cesantía': 4152, liquido: 566146 }
    },
    {
        nombre: 'Sobre el tope de 90 UF, Habitat, Isapre bajo el 7%',
        datos: base({ sueldoBase: 4000000, afp: 'Habitat', salud: 'isapre', isapreNombre: 'Banmédica', isaprePlanUF: 5 }), mes: '2026-10',
        esperado: { AFP: 418375, 'Salud Banmédica': 259860, 'Seguro de cesantía': 24000, 'Impuesto único': 138278, liquido: 3159487 }
    },
    {
        nombre: 'Medio mes, plazo fijo, horas extra y gratificación en el tope proporcional',
        datos: base({ sueldoBase: 800000, afp: 'Uno', contrato: 'plazo_fijo' }, { diasTrabajados: 15, horasExtra: 10, gratificacion: 'legal' }), mes: '2026-09',
        esperado: { 'Sueldo base': 400000, 'Horas extra': 66667, 'Gratificación legal': 109557, AFP: 60273, 'Salud Fonasa': 40336, 'Seguro de cesantía': undefined, liquido: 475615 }
    },
    {
        nombre: 'APV régimen B y descuentos pactados sobre el 15%',
        datos: base({ sueldoBase: 2500000, afp: 'Capital' }, { apvMonto: 100000, apvRegimen: 'B', otrosDescuentos: [{ nombre: 'Préstamo empresa', monto: 400000 }] }), mes: '2026-10',
        esperado: { AFP: 286000, 'Impuesto único': 37998, liquido: 1486002 },
        aviso: 'artículo 58'
    },
    {
        nombre: 'Isapre sobre el 7% y sobre el tope de rebaja tributaria',
        datos: base({ sueldoBase: 3000000, afp: 'Provida', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 8 }), mes: '2026-10',
        esperado: { AFP: 343500, 'Salud Colmena': 210000, 'Adicional de salud': 119981, 'Impuesto único': 64748, liquido: 2243771 }
    },
    {
        nombre: 'Jornada parcial de 20 horas bajo el mínimo proporcional',
        datos: base({ sueldoBase: 200000, jornadaHoras: 20 }), mes: '2026-10',
        esperado: {},
        aviso: 'ingreso mínimo para 20 horas'
    }
];

let fallas = 0;
for (const c of casos) {
    const res = calcular(c.datos, MESES[c.mes]);
    const todas = res.haberesImponibles.concat(res.descuentosLegales, res.otrosDescuentos);
    const errores = [];
    for (const [clave, valor] of Object.entries(c.esperado)) {
        const real = clave in res ? res[clave] : linea(todas, clave);
        if (real !== valor) errores.push(`${clave}: esperado ${valor}, obtenido ${real}`);
    }
    if (c.aviso && !res.avisos.some(a => a.texto.includes(c.aviso))) errores.push(`falta el aviso "${c.aviso}"`);
    if (errores.length) { fallas++; console.log('FALLA  ' + c.nombre + '\n   ' + errores.join('\n   ')); }
    else console.log('ok     ' + c.nombre);
}
console.log(fallas ? `\n${fallas} caso(s) con diferencias` : `\nTodos los casos coinciden (${casos.length})`);
process.exit(fallas ? 1 : 0);
