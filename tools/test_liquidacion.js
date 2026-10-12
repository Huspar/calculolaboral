// Casos de referencia del generador de liquidaciones. Ejecutar: node tools/test_liquidacion.js
// Parte 1: motor de cálculo (resultados calculados a mano con los criterios de js/liquidacion_engine.js).
// Parte 2: obtención de la UF y la UTM desde la API, con control cruzado, respaldo y fallos simulados.
const { calcular } = require('../js/liquidacion_engine.js');
const P = require('../js/liquidacion_parametros.js');
const V = require('../js/liquidacion_valores.js');

let fallas = 0, total = 0;
function chequear(nombre, errores) {
    total++;
    if (errores.length) { fallas++; console.log('FALLA  ' + nombre + '\n   ' + errores.join('\n   ')); }
    else console.log('ok     ' + nombre);
}

// ---------- Parte 1: motor ----------
function mesDe(periodo) {
    const v = P.vigenciaDe(periodo), r = P.RESPALDO[periodo];
    return { uf: r.uf, utm: r.utm, imm: v.imm, topeAfpUF: v.topeAfpUF, topeAfcUF: v.topeAfcUF, jornadaMaxima: v.jornadaMaxima, afp: v.afp };
}
const base = (t, m) => ({
    trabajador: Object.assign({ contrato: 'indefinido', jornadaHoras: 42, afp: 'Modelo', salud: 'fonasa' }, t),
    mes: Object.assign({ diasTrabajados: 30, gratificacion: 'ninguna' }, m)
});
const linea = (lista, texto) => (lista.find(l => l.concepto.startsWith(texto)) || {}).monto;

const casos = [
    { nombre: 'Ingreso mínimo, Modelo, Fonasa (igual al ejemplo de la guía)', datos: base({ sueldoBase: 553553 }), mes: '2026-10',
      esperado: { AFP: 58566, 'Salud Fonasa': 38749, 'Seguro de cesantía': 3321, 'Impuesto único': 0, liquido: 452917 } },
    { nombre: 'Ingreso mínimo con gratificación legal', datos: base({ sueldoBase: 553553 }, { gratificacion: 'legal' }), mes: '2026-10',
      esperado: { 'Gratificación legal': 138388, totalImponible: 691941, AFP: 73207, 'Salud Fonasa': 48436, 'Seguro de cesantía': 4152, liquido: 566146 } },
    { nombre: 'Sobre el tope de 90 UF, Habitat, Isapre bajo el 7%', datos: base({ sueldoBase: 4000000, afp: 'Habitat', salud: 'isapre', isapreNombre: 'Banmédica', isaprePlanUF: 5 }), mes: '2026-10',
      esperado: { AFP: 418375, 'Salud Banmédica': 259860, 'Seguro de cesantía': 24000, 'Impuesto único': 138278, liquido: 3159487 } },
    { nombre: 'Medio mes, plazo fijo, horas extra y gratificación en el tope proporcional', datos: base({ sueldoBase: 800000, afp: 'Uno', contrato: 'plazo_fijo' }, { diasTrabajados: 15, horasExtra: 10, gratificacion: 'legal' }), mes: '2026-09',
      esperado: { 'Sueldo base': 400000, 'Horas extra': 66667, 'Gratificación legal': 109557, AFP: 60273, 'Salud Fonasa': 40336, 'Seguro de cesantía': undefined, liquido: 475615 } },
    { nombre: 'APV régimen B y descuentos pactados sobre el 15%', datos: base({ sueldoBase: 2500000, afp: 'Capital' }, { apvMonto: 100000, apvRegimen: 'B', otrosDescuentos: [{ nombre: 'Préstamo empresa', monto: 400000 }] }), mes: '2026-10',
      esperado: { AFP: 286000, 'Impuesto único': 37998, liquido: 1486002 }, aviso: 'artículo 58' },
    { nombre: 'Isapre sobre el 7% y sobre el tope de rebaja tributaria', datos: base({ sueldoBase: 3000000, afp: 'Provida', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 8 }), mes: '2026-10',
      esperado: { AFP: 343500, 'Salud Colmena': 210000, 'Adicional de salud': 119981, 'Impuesto único': 64748, liquido: 2243771 } },
    { nombre: 'Jornada parcial de 20 horas bajo el mínimo proporcional', datos: base({ sueldoBase: 200000, jornadaHoras: 20 }), mes: '2026-10',
      esperado: {}, aviso: 'ingreso mínimo para 20 horas' },
    // Enero a agosto: valores de Previred (ingreso mínimo $539.000 hasta abril, 44 horas hasta el 25-abr-2026, 89,9 UF en enero)
    { nombre: 'Enero 2026: ingreso mínimo $539.000, Modelo, Fonasa', datos: base({ sueldoBase: 539000, jornadaHoras: 44 }), mes: '2026-01',
      esperado: { AFP: 57026, 'Salud Fonasa': 37730, 'Seguro de cesantía': 3234, 'Impuesto único': 0, liquido: 441010 }, sinAviso: 'ingreso mínimo' },
    { nombre: 'Enero 2026: hora extra con jornada de 44 horas', datos: base({ sueldoBase: 600000, jornadaHoras: 44 }, { horasExtra: 10 }), mes: '2026-01',
      esperado: { 'Horas extra': 47727 } },
    { nombre: 'Septiembre 2026: una jornada de 44 horas se limita a 42 y avisa', datos: base({ sueldoBase: 600000, jornadaHoras: 44 }, { horasExtra: 10 }), mes: '2026-09',
      esperado: { 'Horas extra': 50000 }, aviso: 'supera la jornada máxima legal' },
    { nombre: 'Enero 2026: tope proporcional de media jornada usa 44 horas', datos: base({ sueldoBase: 250000, jornadaHoras: 22 }), mes: '2026-01',
      esperado: {}, aviso: 'ingreso mínimo para 22 horas semanales ($269.500)' },
    { nombre: 'Seguro de cesantía: 11 años cumplidos en un mes anterior, no se descuenta', datos: Object.assign(base({ sueldoBase: 553553, fechaIngreso: '2014-03-01' }), {}), mes: '2026-10',
      esperado: { AFP: 58566, 'Salud Fonasa': 38749, 'Seguro de cesantía': 0, liquido: 456238 }, aviso: 'cumplió 11 años' },
    { nombre: 'Seguro de cesantía: los 11 años se cumplen dentro del mes, se mantiene y avisa', datos: base({ sueldoBase: 553553, fechaIngreso: '2015-10-15' }), mes: '2026-10',
      esperado: { 'Seguro de cesantía': 3321, liquido: 452917 }, aviso: 'cumple 11 años' },
    { nombre: 'Seguro de cesantía: 10 años y 11 meses, se descuenta sin avisos de aniversario', datos: base({ sueldoBase: 553553, fechaIngreso: '2015-11-20' }), mes: '2026-10',
      esperado: { 'Seguro de cesantía': 3321 }, sinAviso: '11 años' },
    { nombre: 'Seguro de cesantía: plazo fijo no se descuenta y no hay aviso de 11 años', datos: base({ sueldoBase: 553553, contrato: 'plazo_fijo', fechaIngreso: '2010-01-01' }), mes: '2026-10',
      esperado: { 'Seguro de cesantía': undefined }, sinAviso: '11 años' }
];
for (const c of casos) {
    const res = calcular(Object.assign({}, c.datos, { periodo: c.mes }), mesDe(c.mes));
    const todas = res.haberesImponibles.concat(res.descuentosLegales, res.otrosDescuentos);
    const errores = [];
    for (const [clave, valor] of Object.entries(c.esperado)) {
        const real = clave in res ? res[clave] : linea(todas, clave);
        if (real !== valor) errores.push(`${clave}: esperado ${valor}, obtenido ${real}`);
    }
    if (c.aviso && !res.avisos.some(a => a.texto.includes(c.aviso))) errores.push(`falta el aviso "${c.aviso}"`);
    if (c.sinAviso && res.avisos.some(a => a.texto.includes(c.sinAviso))) errores.push(`no debía haber un aviso con "${c.sinAviso}"`);
    chequear('Motor · ' + c.nombre, errores);
}

// Topes imponibles en pesos de cada mes contra lo que publica Previred (UF de respaldo × tope en UF de la vigencia)
const PREVIRED_TOPES = {
    '2026-01': [3569576, 5364290], '2026-02': [3581157, 5379693], '2026-03': [3585755, 5386601], '2026-04': [3610818, 5424251],
    '2026-05': [3654962, 5490565], '2026-06': [3673828, 5518906], '2026-07': [3676031, 5522216], '2026-08': [3678639, 5526134],
    '2026-09': [3695148, 5550933]
};
{
    const errores = [];
    for (const [p, [afp, afc]] of Object.entries(PREVIRED_TOPES)) {
        const m = mesDe(p);
        const calcAfp = Math.round(m.topeAfpUF * m.uf), calcAfc = Math.round(m.topeAfcUF * m.uf);
        if (calcAfp !== afp) errores.push(`${p}: tope AFP ${calcAfp} ≠ Previred ${afp}`);
        if (calcAfc !== afc) errores.push(`${p}: tope cesantía ${calcAfc} ≠ Previred ${afc}`);
    }
    const imm = ['2026-01', '2026-04', '2026-05', '2026-12'].map(p => P.vigenciaDe(p).imm).join(',');
    if (imm !== '539000,539000,553553,553553') errores.push('ingreso mínimo por mes: ' + imm);
    const jm = ['2026-03', '2026-04', '2026-05'].map(p => P.vigenciaDe(p).jornadaMaxima).join(',');
    if (jm !== '44,44,42') errores.push('jornada máxima por mes: ' + jm);
    chequear('Parámetros · topes de enero a septiembre coinciden con Previred; ingreso mínimo y jornada por mes', errores);
}

// ---------- Parte 2: valores desde la API ----------
function respuesta(cuerpo, estado = 200) { return { ok: estado === 200, status: estado, json: async () => cuerpo }; }
function almacenFalso() {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), mapa: m };
}
// Simula mindicador.cl (fechas con hora) y findic.cl (fechas simples) con las series que se le indiquen
function fetchFalso({ mindicador, findic, registro, retrasoMindicador }) {
    return async (url) => {
        registro.push(url);
        if (retrasoMindicador && url.includes('mindicador')) await new Promise(r => setTimeout(r, retrasoMindicador));
        const prov = url.includes('mindicador') ? mindicador : findic;
        if (prov === 'caido') throw new Error('sin conexión');
        const [, tipo, resto] = url.match(/api\/(uf|utm)\/(.+)$/);
        const fecha = x => (url.includes('mindicador') ? x + 'T03:00:00.000Z' : x);
        if (tipo === 'uf') {
            const [d, m, a] = resto.split('-');
            const iso = `${a}-${m}-${d}`;
            const valor = prov.uf && prov.uf[iso];
            return respuesta({ serie: valor == null ? [] : [{ fecha: fecha(iso), valor }] });
        }
        return respuesta({ serie: Object.entries(prov.utm || {}).map(([mes, valor]) => ({ fecha: fecha(mes + '-01'), valor })) });
    };
}
const SERIE_OK = { uf: { '2026-09-30': 41057.2, '2026-10-31': 41247.63, '2026-11-30': 41400.5 }, utm: { '2026-09': 71721, '2026-10': 72151, '2026-11': 72440 } };
function crear(config, almacen = almacenFalso()) {
    const registro = [];
    const v = V.crear({ parametros: P, fetch: fetchFalso(Object.assign({ registro }, config)), storage: almacen });
    return { v, registro, almacen };
}

(async () => {
    let t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    let r = await t.v.obtener('2026-10');
    chequear('Valores · API responde y coincide con el respaldo', [
        r.ok ? '' : 'no ok', r.mes && r.mes.uf === 41247.63 ? '' : 'UF', r.mes && r.mes.utm === 72151 ? '' : 'UTM',
        r.fuentes && r.fuentes.uf === 'mindicador.cl' ? '' : 'fuente UF', r.avisos && r.avisos.length ? 'hay avisos' : '',
        r.mes && r.mes.imm === 553553 && r.mes.topeAfpUF === 90 ? '' : 'vigencia'
    ].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK, retrasoMindicador: 80 });
    r = await t.v.obtener('2026-10');
    chequear('Valores · gana el primer proveedor válido aunque el otro tarde', [r.ok && r.fuentes.uf === 'findic.cl' ? '' : 'esperó al lento (' + (r.fuentes && r.fuentes.uf) + ')'].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    await Promise.all([t.v.obtener('2026-09'), t.v.obtener('2026-10')]);
    const pedidosUtm = t.registro.filter(u => /\/utm\/2026$/.test(u)).length;
    chequear('Valores · la serie de la UTM del año se pide una sola vez por proveedor', [pedidosUtm === 2 ? '' : 'pedidos de UTM: ' + pedidosUtm].filter(Boolean));

    t = crear({ mindicador: 'caido', findic: SERIE_OK });
    r = await t.v.obtener('2026-10');
    chequear('Valores · mindicador cae y se usa findic', [r.ok && r.fuentes.uf === 'findic.cl' && r.fuentes.utm === 'findic.cl' ? '' : 'no usó findic'].filter(Boolean));

    t = crear({ mindicador: 'caido', findic: 'caido' });
    r = await t.v.obtener('2026-10');
    chequear('Valores · ambas APIs caen: respaldo con aviso y sin guardar', [
        r.ok && r.mes.uf === 41247.63 ? '' : 'no usó respaldo', r.avisos && r.avisos.length === 2 ? '' : 'avisos', t.almacen.mapa.size === 0 ? '' : 'guardó en caché'
    ].filter(Boolean));

    t = crear({ mindicador: 'caido', findic: 'caido' });
    r = await t.v.obtener('2026-11');
    chequear('Valores · ambas APIs caen y no hay respaldo (noviembre): no se emite', [!r.ok && /UF del 30 de noviembre/.test(r.mensaje) ? '' : 'debía bloquear'].filter(Boolean));

    t = crear({ mindicador: { uf: { '2026-10-31': 41999.99 }, utm: { '2026-10': 72151 } }, findic: 'caido' });
    r = await t.v.obtener('2026-10');
    chequear('Valores · la API difiere del SII: gana el respaldo y avisa', [
        r.ok && r.mes.uf === 41247.63 ? '' : 'no usó el SII', r.avisos && r.avisos.some(a => /no coincide/.test(a)) ? '' : 'sin aviso'
    ].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    r = await t.v.obtener('2026-11');
    chequear('Valores · noviembre sin respaldo, con API', [r.ok && r.mes.uf === 41400.5 && r.mes.utm === 72440 && r.mes.afp.Uno === 0.1046 ? '' : 'datos'].filter(Boolean));

    t = crear({ mindicador: { uf: {}, utm: SERIE_OK.utm }, findic: { uf: {}, utm: SERIE_OK.utm } });
    r = await t.v.obtener('2026-12');
    chequear('Valores · la UF de fin de mes aún no está publicada', [!r.ok && /todavía no está publicada/.test(r.mensaje) ? '' : 'debía avisar'].filter(Boolean));

    t = crear({ mindicador: { uf: { '2026-11-30': 100 }, utm: SERIE_OK.utm }, findic: 'caido' });
    r = await t.v.obtener('2026-11');
    chequear('Valores · UF fuera de rango se rechaza', [!r.ok ? '' : 'aceptó una UF de 100'].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    await t.v.obtener('2026-11');
    const antes = t.registro.length;
    r = await t.v.obtener('2026-11');
    chequear('Valores · el mes cerrado se guarda y no se vuelve a consultar', [t.registro.length === antes && r.ok && r.mes.uf === 41400.5 ? '' : 'volvió a consultar'].filter(Boolean));

    // La UF aún no está publicada; después se publica y se reintenta con "forzar": no debe quedar pegada la respuesta vacía
    const aun = { uf: {}, utm: SERIE_OK.utm }, yaPublicada = { uf: { '2026-11-30': 41400.5 }, utm: SERIE_OK.utm };
    const cfg = { mindicador: aun, findic: aun };
    const registro2 = [];
    const v2 = V.crear({ parametros: P, fetch: (u, o) => fetchFalso(Object.assign({ registro: registro2 }, cfg))(u, o), storage: almacenFalso() });
    r = await v2.obtener('2026-11');
    const antesDeForzar = r.ok;
    cfg.mindicador = yaPublicada; cfg.findic = yaPublicada;
    r = await v2.obtener('2026-11', true);
    chequear('Valores · al reintentar con "forzar" se vuelve a consultar una UF que ya se publicó', [!antesDeForzar && r.ok && r.mes.uf === 41400.5 ? '' : 'seguía sin disponible'].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    const [a, b] = await Promise.all([t.v.obtener('2026-09'), t.v.obtener('2026-09')]);
    chequear('Valores · dos consultas simultáneas comparten una sola petición', [a === b || t.registro.length <= 2 ? '' : 'duplicó peticiones (' + t.registro.length + ')'].filter(Boolean));

    t = crear({ mindicador: SERIE_OK, findic: SERIE_OK });
    const fuera = await Promise.all([t.v.obtener('2025-12'), t.v.obtener('2027-01')]);
    chequear('Valores · meses fuera del rango disponible', [fuera.every(x => !x.ok) && t.registro.length === 0 ? '' : 'debía rechazar sin consultar'].filter(Boolean));

    // Enero a agosto: sin API, cada mes usa su respaldo y su vigencia (ingreso mínimo, topes y jornada)
    t = crear({ mindicador: 'caido', findic: 'caido' });
    const esperado = { '2026-01': [539000, 89.9, 44], '2026-03': [539000, 90, 44], '2026-04': [539000, 90, 44], '2026-05': [553553, 90, 42], '2026-08': [553553, 90, 42] };
    const errMeses = [];
    for (const [p, [imm, topeAfp, jornada]] of Object.entries(esperado)) {
        const x = await t.v.obtener(p);
        if (!x.ok || x.mes.imm !== imm || x.mes.topeAfpUF !== topeAfp || x.mes.jornadaMaxima !== jornada) errMeses.push(p + ': ' + JSON.stringify(x.mes));
        if (x.ok && x.mes.uf !== P.RESPALDO[p].uf) errMeses.push(p + ': UF');
    }
    chequear('Valores · enero a agosto con respaldo: ingreso mínimo, topes y jornada de cada mes', errMeses);

    t = crear({ mindicador: 'caido', findic: 'caido' });
    const [ene, abr, may] = await Promise.all([t.v.obtener('2026-01'), t.v.obtener('2026-04'), t.v.obtener('2026-05')]);
    chequear('Valores · notas de los meses con cambios (jornada, ingreso mínimo retroactivo)', [
        ene.notas.some(n => /44 horas/.test(n)) ? '' : 'enero sin nota de 44 h',
        abr.notas.some(n => /26 de abril/.test(n)) ? '' : 'abril sin nota del cambio de jornada',
        may.notas.length === 1 && /553\.553/.test(may.notas[0]) ? '' : 'mayo sin nota de ingreso mínimo'
    ].filter(Boolean));

    console.log(fallas ? `\n${fallas} de ${total} caso(s) con diferencias` : `\nTodos los casos coinciden (${total})`);
    process.exit(fallas ? 1 : 0);
})();
