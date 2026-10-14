// Carga datos de demostración en el servidor de desarrollo del Asistente (node tools/dev_pyme.js, base en memoria).
//
//   node tools/demo_pyme.js [http://localhost:3000]
//
// Crea la cuenta demo@ejemplo.cl (con el piloto gratuito activo tiene el cupo y los beneficios del Pase de 12 meses), la empresa ficticia "Panadería Los Aromos", tres trabajadores,
// vacaciones, un préstamo en cuotas, un anticipo fijo y las liquidaciones de septiembre y octubre de 2026 (calculadas con el mismo motor y la UF de respaldo).
// Al final imprime un enlace de acceso para entrar desde el navegador. Solo para desarrollo: nunca contra la base real.
'use strict';
const E = require('../js/liquidacion_engine');
const P = require('../js/liquidacion_parametros');
const L = require('../js/pyme_liquidaciones');

const BASE = process.argv[2] || 'http://localhost:3000';
const CORREO = 'demo@ejemplo.cl';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Solo se permite un servidor local.'); process.exit(1); }

let cookie = '';
async function pedir(ruta, opciones = {}) {
    const r = await fetch(BASE + ruta, Object.assign({ redirect: 'manual' }, opciones, {
        headers: Object.assign({ Cookie: cookie }, opciones.headers || {})
    }));
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return r;
}
async function api(ruta, metodo, cuerpo, query) {
    const q = new URLSearchParams(Object.assign({ ruta }, query || {})).toString();
    const r = await pedir('/api/pyme/' + ruta + '?' + q, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'X-CL-Pyme': '1', Origin: BASE },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(metodo + ' ' + ruta + ': ' + r.status + ' ' + JSON.stringify(d));
    return d;
}
async function enlaceNuevo() {
    await api('entrar', 'POST', { email: CORREO });
    const d = await (await pedir('/__dev/ultimo-enlace')).json();
    return d.enlace;
}

const EMPRESA = { razonSocial: 'Panadería Los Aromos SpA', rut: '76.543.210-3', giro: 'Panadería y pastelería', representante: 'Manuel Lagos Rojas', rutRepresentante: '12.345.678-5', direccion: 'Av. Alemania 0450', comuna: 'Temuco', ciudad: 'Temuco', tasaMutual: '0,93' };
const TRABAJADORES = [
    { nombre: 'Ana Pérez González', rut: '15.234.567-4', cargo: 'Panadera', fechaNacimiento: '1988-06-12', nacionalidad: 'Chilena', domicilio: 'Los Aromos 123', comuna: 'Temuco', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, distribucion: '6', sueldoBase: 650000, gratificacion: 'legal', colacion: 40000, movilizacion: 30000, afp: 'Modelo', salud: 'fonasa' },
    { nombre: 'Bruno Castillo Muñoz', rut: '19.876.543-0', cargo: 'Vendedor', fechaNacimiento: '1999-11-03', nacionalidad: 'Chilena', domicilio: 'Pasaje Ñielol 45', comuna: 'Temuco', fechaIngreso: '2026-05-04', contrato: 'plazo_fijo', fechaTerminoPlazo: '2026-10-31', renovaciones: 1, jornadaHoras: 42, distribucion: '6', sueldoBase: 560000, gratificacion: 'legal', afp: 'Uno', salud: 'fonasa' },
    { nombre: 'Carla Rojas Vidal', rut: '13.456.789-9', cargo: 'Encargada de local', fechaNacimiento: '1979-02-21', nacionalidad: 'Chilena', domicilio: 'Caupolicán 980', comuna: 'Temuco', fechaIngreso: '2014-08-01', contrato: 'indefinido', jornadaHoras: 42, distribucion: '5', sueldoBase: 900000, gratificacion: 'legal', colacion: 50000, movilizacion: 40000, afp: 'Habitat', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3.2, aniosOtrosEmpleadores: 6, anticipoMensual: 150000 }
];

function mesValores(periodo) {
    const v = P.vigenciaDe(periodo), r = P.RESPALDO[periodo];
    return { uf: r.uf, utm: r.utm, imm: v.imm, topeAfpUF: v.topeAfpUF, topeAfcUF: v.topeAfcUF, jornadaMaxima: v.jornadaMaxima, afp: v.afp, empleador: v.empleador };
}

(async function () {
    const enlace = await enlaceNuevo();
    const t = new URL(enlace).searchParams.get('t');
    const r = await pedir('/api/pyme/verificar?ruta=verificar', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE }, body: 't=' + encodeURIComponent(t) + '&acepto=on' });
    if (!cookie) throw new Error('No se pudo iniciar sesión (' + r.status + ')');
    // El piloto gratuito ya da el cupo de 5: no hace falta un pase de prueba

    await api('empresa', 'PUT', { empresa: EMPRESA });
    const ids = [];
    for (const tr of TRABAJADORES) ids.push((await api('trabajador', 'POST', { trabajador: tr })).trabajador.id);

    const prest = await api('prestamos', 'PUT', { prestamos: [{ concepto: 'Préstamo para reparar el techo', fecha: '2026-10-02', monto: 360000, cuotas: 6, desde: '2026-10' }] }, { trabajador: ids[0] });
    TRABAJADORES[0].prestamos = prest.trabajador.prestamos;

    await api('vacacion', 'POST', { vacacion: { tipo: 'ajuste', dias: 18, nota: 'Tomados antes de usar el asistente' } }, { trabajador: ids[0] });
    await api('vacacion', 'POST', { vacacion: { tipo: 'periodo', desde: '2026-10-19', hasta: '2026-10-23', nota: 'Vacaciones de primavera' } }, { trabajador: ids[0] });
    await api('vacacion', 'POST', { vacacion: { tipo: 'periodo', desde: '2026-12-28', hasta: '2027-01-08', nota: 'Verano' } }, { trabajador: ids[2] });

    for (const periodo of ['2026-09', '2026-10']) {
        const mv = mesValores(periodo);
        for (let i = 0; i < ids.length; i++) {
            const trab = TRABAJADORES[i];
            const mes = L.mesBase(trab, periodo);
            if (!mes.diasTrabajados) continue;
            if (i === 1) mes.comisiones = periodo === '2026-10' ? 85000 : 62000;
            if (i === 2) mes.horasExtra = 4;
            const res = E.calcular({ trabajador: trab, mes, periodo, tasaMutual: 0.93 }, mv);
            mes.calculo = L.resumen(res, mv, trab);
            mes.emitida = periodo === '2026-09' ? '2026-10-05' : i === 2 ? '2026-10-13' : '';
            await api('mes', 'PUT', { mes }, { trabajador: ids[i], periodo });
        }
    }
    await api('documento', 'POST', { tipo: 'cert_antiguedad' }, { trabajador: ids[2] });

    console.log('Datos de demostración cargados para ' + CORREO + '.');
    console.log('Entra desde el navegador con este enlace (vale 15 minutos):');
    console.log(await enlaceNuevo());
})().catch(e => { console.error(e.message); process.exit(1); });
