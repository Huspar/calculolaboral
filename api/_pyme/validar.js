/**
 * Validacion de lo que el cliente envia al Asistente Pyme (empresa y trabajadores).
 *
 * Solo se aceptan los campos de la lista (lo demas se descarta: no se guarda basura ni campos inesperados) y cada uno se
 * normaliza: textos recortados y con largo maximo, RUT con digito verificador y formato estandar, fechas AAAA-MM-DD reales,
 * numeros enteros dentro de un rango. Devuelve { ok: true, valor } o { ok: false, errores: { campo: mensaje } }.
 */
const Rut = require('../../js/rut_cl');
const P = require('../../js/liquidacion_parametros');

const AFPS = Object.keys(P.VIGENCIAS[P.VIGENCIAS.length - 1].afp);
const MAX_LOGO = 150000; // caracteres del data URL (~110 KB de imagen)
const LOGO_FORMATO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

function esFechaIso(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s && s >= '1900-01-01' && s <= '2100-12-31';
}

// Cada campo: tipo y reglas. 'req' obliga a que venga con valor.
const CAMPOS_EMPRESA = {
    razonSocial: { t: 'texto', max: 100, req: true },
    rut: { t: 'rut', req: true },
    giro: { t: 'texto', max: 100 },
    representante: { t: 'texto', max: 80 },
    rutRepresentante: { t: 'rut' },
    direccion: { t: 'texto', max: 120 },
    comuna: { t: 'texto', max: 60 },
    ciudad: { t: 'texto', max: 60 },
    logo: { t: 'logo' }
};

const CAMPOS_TRABAJADOR = {
    nombre: { t: 'texto', max: 80, req: true },
    rut: { t: 'rut', req: true },
    nacionalidad: { t: 'texto', max: 40 },
    fechaNacimiento: { t: 'fecha' },
    domicilio: { t: 'texto', max: 120 },
    comuna: { t: 'texto', max: 60 },
    cargo: { t: 'texto', max: 60 },
    fechaIngreso: { t: 'fecha' },
    contrato: { t: 'enum', valores: ['indefinido', 'plazo_fijo', 'obra'], def: 'indefinido' },
    fechaTerminoPlazo: { t: 'fecha' },
    renovaciones: { t: 'entero', min: 0, max: 5, def: 0 },
    jornadaHoras: { t: 'entero', min: 1, max: 45, def: 42 },
    distribucion: { t: 'enum', valores: ['5', '6'], def: '5' },
    sueldoBase: { t: 'entero', min: 0, max: 50000000, def: 0 },
    colacion: { t: 'entero', min: 0, max: 5000000, def: 0 },
    movilizacion: { t: 'entero', min: 0, max: 5000000, def: 0 },
    gratificacion: { t: 'enum', valores: ['legal', 'ninguna', 'pactada'], def: 'legal' },
    afp: { t: 'enum', valores: AFPS, def: 'Modelo' },
    salud: { t: 'enum', valores: ['fonasa', 'isapre'], def: 'fonasa' },
    isapreNombre: { t: 'texto', max: 40 },
    isaprePlanUF: { t: 'decimal', min: 0, max: 99.99, def: 0 },
    zonaExtrema: { t: 'bool', def: false },
    aniosOtrosEmpleadores: { t: 'entero', min: 0, max: 10, def: 0 },
    activo: { t: 'bool', def: true }
};

function vacio(v) { return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); }

function normalizar(nombre, regla, v, errores) {
    if (vacio(v)) {
        if (regla.req) { errores[nombre] = 'Este dato es obligatorio.'; return undefined; }
        return regla.def !== undefined ? regla.def : (regla.t === 'bool' ? false : '');
    }
    switch (regla.t) {
        case 'texto': {
            if (typeof v !== 'string') { errores[nombre] = 'Debe ser texto.'; return undefined; }
            const s = v.replace(/\s+/g, ' ').trim();
            if (s.length > regla.max) { errores[nombre] = `Máximo ${regla.max} caracteres.`; return undefined; }
            return s;
        }
        case 'rut':
            if (typeof v !== 'string' || !Rut.valido(v)) { errores[nombre] = 'El RUT no es válido.'; return undefined; }
            return Rut.formatear(v);
        case 'fecha':
            if (!esFechaIso(v)) { errores[nombre] = 'La fecha no es válida.'; return undefined; }
            return v;
        case 'enum':
            if (regla.valores.indexOf(v) < 0) { errores[nombre] = 'Opción no válida.'; return undefined; }
            return v;
        case 'entero': {
            const n = typeof v === 'number' ? v : (/^-?\d+$/.test(String(v).trim()) ? Number(v) : NaN);
            if (!Number.isInteger(n) || n < regla.min || n > regla.max) { errores[nombre] = `Debe ser un número entero entre ${regla.min} y ${regla.max}.`; return undefined; }
            return n;
        }
        case 'decimal': {
            const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
            if (!isFinite(n) || n < regla.min || n > regla.max) { errores[nombre] = `Debe ser un número entre ${regla.min} y ${regla.max}.`; return undefined; }
            return Math.round(n * 100) / 100;
        }
        case 'bool':
            if (typeof v !== 'boolean') { errores[nombre] = 'Debe ser verdadero o falso.'; return undefined; }
            return v;
        case 'logo':
            if (typeof v !== 'string' || v.length > MAX_LOGO || !LOGO_FORMATO.test(v)) { errores[nombre] = 'El logo debe ser una imagen PNG, JPG o WebP de hasta 100 KB.'; return undefined; }
            return v;
        default:
            errores[nombre] = 'Campo no soportado.';
            return undefined;
    }
}

function validar(campos, entrada) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, errores: { _: 'Los datos no tienen el formato esperado.' } };
    const errores = {}, valor = {};
    Object.keys(campos).forEach(function (k) {
        const r = normalizar(k, campos[k], entrada[k], errores);
        if (r !== undefined) valor[k] = r;
    });
    return Object.keys(errores).length ? { ok: false, errores } : { ok: true, valor };
}

function validarEmpresa(entrada) { return validar(CAMPOS_EMPRESA, entrada); }

function validarTrabajador(entrada) {
    const r = validar(CAMPOS_TRABAJADOR, entrada);
    if (!r.ok) return r;
    const v = r.valor, errores = {};
    if (v.contrato === 'plazo_fijo') {
        if (!v.fechaTerminoPlazo) errores.fechaTerminoPlazo = 'Indica la fecha en que vence el contrato a plazo fijo.';
        else if (v.fechaIngreso && v.fechaTerminoPlazo <= v.fechaIngreso) errores.fechaTerminoPlazo = 'Debe ser posterior a la fecha de ingreso.';
    } else {
        v.fechaTerminoPlazo = '';
        v.renovaciones = 0;
    }
    if (v.salud === 'fonasa') { v.isapreNombre = ''; v.isaprePlanUF = 0; }
    if (v.fechaNacimiento && v.fechaIngreso && v.fechaIngreso < v.fechaNacimiento) errores.fechaIngreso = 'No puede ser anterior a la fecha de nacimiento.';
    return Object.keys(errores).length ? { ok: false, errores } : { ok: true, valor: v };
}

// ---------- meses de liquidacion ----------
// Lo que cambia de un mes a otro (el "mes" del generador de liquidaciones). El sueldo base y la AFP vienen de la ficha.
const PERIODO_FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/;
const PERIODO_MIN = '2020-01', PERIODO_MAX = '2100-12';
const MAX_LISTA = 8;
const MONTO_MAX = 50000000;

const CAMPOS_MES = {
    diasTrabajados: { t: 'entero', min: 0, max: 30, def: 30 },
    diasLicencia: { t: 'entero', min: 0, max: 30, def: 0 },
    horasExtra: { t: 'decimal', min: 0, max: 300, def: 0 },
    gratificacion: { t: 'enum', valores: ['legal', 'manual', 'ninguna'], def: 'legal' },
    gratificacionMonto: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    comisiones: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    viaticos: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    asignacionFamiliar: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    apvMonto: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    apvRegimen: { t: 'enum', valores: ['A', 'B'], def: 'B' },
    anticipo: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    creditoCCAF: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    cuotaSindical: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    emitida: { t: 'fecha' }
};
const LISTAS_MES = ['bonosImponibles', 'otrosNoImponibles', 'otrosDescuentos'];

function listaMes(nombre, v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_LISTA) { errores[nombre] = `Máximo ${MAX_LISTA} conceptos.`; return undefined; }
    const salida = [];
    for (const it of v) {
        const e = {};
        const n = normalizar('nombre', { t: 'texto', max: 60 }, it && it.nombre, e);
        const m = normalizar('monto', { t: 'entero', min: 0, max: MONTO_MAX, def: 0 }, it && it.monto, e);
        if (e.nombre || e.monto) { errores[nombre] = 'Revisa el nombre (hasta 60 caracteres) y el monto de cada concepto.'; return undefined; }
        if (n && m > 0) salida.push({ nombre: n, monto: m });
    }
    return salida;
}

// Resultado calculado en el navegador al guardar: sirve para el certificado de remuneraciones y para mostrar el mes sin recalcular.
function calculoMes(v, errores) {
    if (vacio(v)) return null;
    if (typeof v !== 'object' || Array.isArray(v)) { errores.calculo = 'El resultado del cálculo no tiene el formato esperado.'; return undefined; }
    const e = {}, c = {};
    ['liquido', 'totalHaberes', 'totalImponible', 'totalDescuentos'].forEach(function (k) {
        c[k] = normalizar(k, { t: 'entero', min: 0, max: 200000000, def: 0 }, v[k], e);
    });
    c.uf = normalizar('uf', { t: 'decimal', min: 30000, max: 70000, req: true }, v.uf, e);
    c.utm = normalizar('utm', { t: 'entero', min: 50000, max: 150000, req: true }, v.utm, e);
    if (Object.keys(e).length) { errores.calculo = 'El resultado del cálculo no tiene el formato esperado.'; return undefined; }
    return c;
}

function validarPeriodo(p) { return typeof p === 'string' && PERIODO_FORMATO.test(p) && p >= PERIODO_MIN && p <= PERIODO_MAX; }

function validarMes(entrada) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, errores: { _: 'Los datos no tienen el formato esperado.' } };
    const r = validar(CAMPOS_MES, entrada);
    const errores = r.ok ? {} : Object.assign({}, r.errores);
    const valor = r.ok ? r.valor : {};
    LISTAS_MES.forEach(function (k) {
        const l = listaMes(k, entrada[k], errores);
        if (l !== undefined) valor[k] = l;
    });
    const c = calculoMes(entrada.calculo, errores);
    if (c !== undefined) valor.calculo = c;
    if (valor.apvMonto === 0) valor.apvRegimen = 'B';
    return Object.keys(errores).length ? { ok: false, errores } : { ok: true, valor };
}

module.exports = { validarMes, validarPeriodo, validarEmpresa, validarTrabajador, esFechaIso, CAMPOS_EMPRESA, CAMPOS_TRABAJADOR, CAMPOS_MES, AFPS, MAX_LOGO };
