/*
 * CalculoLaboral · lógica de datos del Asistente para el modo de ejemplo (GENERADO por tools/build_pyme_demo.js: no editar a mano).
 * Contiene api/_pyme/validar.js, api/_pyme/datos.js, tools/pyme_almacen_memoria.js tal cual, con un require() mínimo.
 * Requiere rut_cl.js, liquidacion_parametros.js, feriados_cl.js y pyme_vacaciones.js antes. Expone window.CLPymeDemoServidor.
 */
(function (root) {
    'use strict';
    var hex = function (n) { var b = new Uint8Array(n); root.crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); };
    var externos = {
        crypto: {
            randomUUID: function () { if (root.crypto.randomUUID) return root.crypto.randomUUID(); var h = hex(16); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32); },
            randomBytes: function (n) { var h = hex(n); return { toString: function () { return h; } }; }
        },
        CLRut: root.CLRut, CLLiquidacionParametros: root.CLLiquidacionParametros, CLFeriados: root.CLFeriados, CLPymeVacaciones: root.CLPymeVacaciones
    };
    // Sin cifrado, el almacén guarda texto: Buffer.from() solo copia
    var BufferMinimo = { from: function (x) { return x; } };
    var fabricas = {}, cache = {};
    function definir(id, mapa, fabrica) { fabricas[id] = { mapa: mapa, fabrica: fabrica }; }
    function cargar(id) {
        if (cache[id]) return cache[id].exports;
        var f = fabricas[id], module = { exports: {} };
        cache[id] = module;
        f.fabrica(module, module.exports, function (nombre) {
            var destino = f.mapa[nombre];
            if (!destino) throw new Error('Módulo no empaquetado: ' + nombre);
            if (destino.charAt(0) === '@') { var e = externos[destino.slice(1)]; if (!e) throw new Error('Falta ' + destino.slice(1)); return e; }
            return cargar(destino);
        }, BufferMinimo);
        return module.exports;
    }

    // ---- api/_pyme/validar.js ----
    definir("validar", {"crypto":"@crypto","../../js/rut_cl":"@CLRut","../../js/liquidacion_parametros":"@CLLiquidacionParametros","../../js/feriados_cl":"@CLFeriados","../../js/pyme_vacaciones":"@CLPymeVacaciones"}, function (module, exports, require, Buffer) {
/**
 * Validacion de lo que el cliente envia al Asistente Pyme (empresa y trabajadores).
 *
 * Solo se aceptan los campos de la lista (lo demas se descarta: no se guarda basura ni campos inesperados) y cada uno se
 * normaliza: textos recortados y con largo maximo, RUT con digito verificador y formato estandar, fechas AAAA-MM-DD reales,
 * numeros enteros dentro de un rango. Devuelve { ok: true, valor } o { ok: false, errores: { campo: mensaje } }.
 */
const crypto = require('crypto');
const Rut = require('../../js/rut_cl');
const P = require('../../js/liquidacion_parametros');
const F = require('../../js/feriados_cl');
const VAC = require('../../js/pyme_vacaciones');

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
    // Cotización total de la mutual o el ISL en % (0,90 básica + 0,03 SANNA + adicional de la empresa)
    tasaMutual: { t: 'decimal', min: 0.93, max: 8, def: 0.93 },
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
    // Anticipo que se paga todos los meses (quincena): se propone en cada liquidación nueva
    anticipoMensual: { t: 'entero', min: 0, max: 50000000, def: 0 },
    // Reajuste por IPC pactado en el contrato: el asistente avisa en el mes que corresponde
    reajusteIPC: { t: 'enum', valores: ['no', 'semestral', 'anual'], def: 'no' },
    reajusteMes: { t: 'entero', min: 1, max: 12, def: 1 },
    // Ley Karin (art. 211-A): fecha en que se dio a conocer el protocolo de prevención y si hay constancia firmada
    karinEntrega: { t: 'fecha' },
    karinConstancia: { t: 'bool', def: false },
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

// ---------- préstamos con cuotas (van en la ficha del trabajador) ----------
const MAX_PRESTAMOS = 12, MAX_CUOTAS = 48, MAX_PAUSAS = 24;
const ID_PRESTAMO = /^[a-z0-9]{6,20}$/;
const MENSAJES_PRESTAMO = {
    concepto: 'El concepto puede tener hasta 60 caracteres.',
    fecha: 'Indica la fecha en que entregaste el préstamo.',
    monto: 'El monto debe estar entre $1.000 y $50.000.000.',
    cuotas: `Las cuotas deben ser entre 1 y ${MAX_CUOTAS}.`,
    desde: 'Indica el mes de la primera cuota.',
    pausas: 'Los meses postergados no son válidos.'
};

// Devuelve la lista normalizada o undefined (con errores.prestamos). Los préstamos nuevos (sin id) reciben uno.
function validarPrestamos(v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_PRESTAMOS) { errores.prestamos = `Puedes registrar hasta ${MAX_PRESTAMOS} préstamos por trabajador. Elimina los que ya terminaron.`; return undefined; }
    const salida = [], usados = {};
    for (const it of v) {
        if (!it || typeof it !== 'object' || Array.isArray(it)) { errores.prestamos = 'Los préstamos no tienen el formato esperado.'; return undefined; }
        const e = {};
        let id = typeof it.id === 'string' && ID_PRESTAMO.test(it.id) ? it.id : '';
        while (!id || usados[id]) id = crypto.randomBytes(6).toString('hex');
        usados[id] = true;
        const concepto = normalizar('concepto', { t: 'texto', max: 60, def: 'Préstamo' }, it.concepto, e) || 'Préstamo';
        const fecha = normalizar('fecha', { t: 'fecha', req: true }, it.fecha, e);
        const monto = normalizar('monto', { t: 'entero', min: 1000, max: MONTO_MAX, req: true }, it.monto, e);
        const cuotas = normalizar('cuotas', { t: 'entero', min: 1, max: MAX_CUOTAS, req: true }, it.cuotas, e);
        const desde = validarPeriodo(it.desde) ? it.desde : (e.desde = true, '');
        let pausas = [];
        if (!vacio(it.pausas)) {
            if (!Array.isArray(it.pausas) || it.pausas.length > MAX_PAUSAS || !it.pausas.every(validarPeriodo)) e.pausas = true;
            else pausas = Array.from(new Set(it.pausas)).filter(p => !desde || p >= desde).sort();
        }
        const primero = Object.keys(MENSAJES_PRESTAMO).find(k => e[k]);
        if (primero) { errores.prestamos = MENSAJES_PRESTAMO[primero]; return undefined; }
        if (desde < fecha.slice(0, 7)) { errores.prestamos = 'La primera cuota no puede ser antes del mes en que entregaste el préstamo.'; return undefined; }
        salida.push({ id, concepto, fecha, monto, cuotas, desde, pausas });
    }
    return salida;
}

// ---------- bonos y asignaciones fijas de cada mes (van en la ficha) ----------
// Imponibles con el nombre que ponga el empleador; no imponibles solo las asignaciones del art. 41 inc. 2 que no son
// remuneración: pérdida de caja y desgaste de herramientas (colación y movilización tienen sus propios campos).
const MAX_BONOS_FIJOS = 8;
const BONOS_NO_IMPONIBLES = { perdida_caja: 'Asignación de pérdida de caja', desgaste_herramientas: 'Desgaste de herramientas' };
function validarBonosFijos(v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_BONOS_FIJOS) { errores.bonosFijos = `Puedes registrar hasta ${MAX_BONOS_FIJOS} bonos o asignaciones fijas.`; return undefined; }
    const salida = [];
    for (const it of v) {
        const e = {};
        const tipo = normalizar('tipo', { t: 'enum', valores: ['imponible'].concat(Object.keys(BONOS_NO_IMPONIBLES)), def: 'imponible' }, it && it.tipo, e);
        const monto = normalizar('monto', { t: 'entero', min: 1, max: MONTO_MAX, req: true }, it && it.monto, e);
        let nombre = tipo === 'imponible' ? normalizar('nombre', { t: 'texto', max: 60, req: true }, it && it.nombre, e) : BONOS_NO_IMPONIBLES[tipo];
        if (e.tipo) { errores.bonosFijos = 'El tipo de un bono no es válido.'; return undefined; }
        if (e.nombre) { errores.bonosFijos = 'Ponle nombre a cada bono imponible (hasta 60 caracteres).'; return undefined; }
        if (e.monto) { errores.bonosFijos = 'Indica el monto de cada bono o asignación (hasta $50.000.000).'; return undefined; }
        salida.push({ tipo, nombre, monto });
    }
    return salida;
}

function validarTrabajador(entrada) {
    const r = validar(CAMPOS_TRABAJADOR, entrada);
    if (!r.ok) return r;
    const v = r.valor, errores = {};
    // Sin "prestamos" en la entrada se conservan los guardados (lo resuelve datos.js); con la lista, se valida y reemplaza
    if (entrada.prestamos !== undefined) {
        const p = validarPrestamos(entrada.prestamos, errores);
        if (p !== undefined) v.prestamos = p;
    }
    // Lo mismo con los bonos fijos y las licencias y permisos
    if (entrada.ausencias !== undefined) {
        const a = validarAusencias(entrada.ausencias, errores);
        if (a !== undefined) v.ausencias = a;
    }
    if (entrada.bonosFijos !== undefined) {
        const b = validarBonosFijos(entrada.bonosFijos, errores);
        if (b !== undefined) v.bonosFijos = b;
    }
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
    tratos: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    // Semana corrida (art. 45): se calcula en el navegador con js/semana_corrida.js y se guarda el monto usado
    scModo: { t: 'enum', valores: ['calcular', 'no'], def: 'calcular' },
    semanaCorrida: { t: 'entero', min: 0, max: MONTO_MAX, def: 0 },
    semanaCorridaDetalle: { t: 'texto', max: 80 },
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
const MAX_CUOTAS_MES = 12;
const DESGLOSE_MES = ['afp', 'salud', 'afcTrabajador', 'impuesto', 'apv', 'creditoCCAF', 'empAfp', 'empSis', 'empSeguroSocial', 'empAfc', 'empMutual', 'costoEmpleador'];

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

// Cuotas de préstamos descontadas en el mes (copia de lo que había en la ficha al guardar: el mes emitido no cambia si después se edita el préstamo)
function cuotasMes(v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_CUOTAS_MES) { errores.cuotasPrestamo = 'Las cuotas de préstamos no tienen el formato esperado.'; return undefined; }
    const salida = [];
    for (const it of v) {
        const e = {};
        const id = it && typeof it.id === 'string' && ID_PRESTAMO.test(it.id) ? it.id : '';
        const nombre = normalizar('nombre', { t: 'texto', max: 60, def: 'Préstamo' }, it && it.nombre, e) || 'Préstamo';
        const monto = normalizar('monto', { t: 'entero', min: 0, max: MONTO_MAX, def: 0 }, it && it.monto, e);
        const numero = normalizar('numero', { t: 'entero', min: 1, max: MAX_CUOTAS, req: true }, it && it.numero, e);
        const de = normalizar('de', { t: 'entero', min: 1, max: MAX_CUOTAS, req: true }, it && it.de, e);
        if (!id || Object.keys(e).length || numero > de) { errores.cuotasPrestamo = 'Las cuotas de préstamos no tienen el formato esperado.'; return undefined; }
        if (monto > 0) salida.push({ id, nombre, monto, numero, de });
    }
    return salida;
}

// Licencias médicas y permisos del mes (fechas): no cuentan en el promedio de la semana corrida. Sin diagnóstico ni otro dato de salud.
const MAX_AUSENCIAS_MES = 10;
const TIPOS_AUSENCIA = ['licencia', 'permiso', 'sin_goce'];

// Licencias y permisos registrados en la ficha (cada mes toma los suyos). Solo tipo y fechas.
const MAX_AUSENCIAS = 60, MAX_DIAS_AUSENCIA = 366;
function validarAusencias(v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_AUSENCIAS) { errores.ausencias = `Puedes registrar hasta ${MAX_AUSENCIAS} licencias o permisos por trabajador. Elimina los más antiguos.`; return undefined; }
    const salida = [], usados = {};
    for (const it of v) {
        if (!it || typeof it !== 'object' || Array.isArray(it)) { errores.ausencias = 'Las licencias y permisos no tienen el formato esperado.'; return undefined; }
        const e = {};
        let id = typeof it.id === 'string' && ID_PRESTAMO.test(it.id) ? it.id : '';
        while (!id || usados[id]) id = crypto.randomBytes(6).toString('hex');
        usados[id] = true;
        const tipo = normalizar('tipo', { t: 'enum', valores: TIPOS_AUSENCIA, def: 'licencia' }, it.tipo, e);
        const desde = normalizar('desde', { t: 'fecha', req: true }, it.desde, e);
        const hasta = normalizar('hasta', { t: 'fecha', req: true }, it.hasta, e);
        if (e.tipo) { errores.ausencias = 'El tipo de ausencia no es válido.'; return undefined; }
        if (e.desde || e.hasta) { errores.ausencias = 'Indica las fechas de inicio y término.'; return undefined; }
        if (hasta < desde) { errores.ausencias = 'La fecha de término no puede ser anterior a la de inicio.'; return undefined; }
        if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1 > MAX_DIAS_AUSENCIA) { errores.ausencias = 'Registra cada licencia o permiso por separado (hasta un año cada uno).'; return undefined; }
        salida.push({ id, tipo, desde, hasta });
    }
    salida.sort((a, b) => a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0);
    return salida;
}
function ausenciasMes(v, errores) {
    if (vacio(v)) return [];
    if (!Array.isArray(v) || v.length > MAX_AUSENCIAS_MES) { errores.ausencias = `Máximo ${MAX_AUSENCIAS_MES} licencias o permisos en el mes.`; return undefined; }
    const salida = [];
    for (const it of v) {
        const e = {};
        const tipo = normalizar('tipo', { t: 'enum', valores: TIPOS_AUSENCIA, def: 'licencia' }, it && it.tipo, e);
        const desde = normalizar('desde', { t: 'fecha', req: true }, it && it.desde, e);
        const hasta = normalizar('hasta', { t: 'fecha', req: true }, it && it.hasta, e);
        if (Object.keys(e).length || hasta < desde) { errores.ausencias = 'Revisa las fechas de cada licencia o permiso (desde y hasta).'; return undefined; }
        salida.push({ tipo, desde, hasta });
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
    // Base del impuesto único del mes (resumen anual; desde la v1.5.0 de pyme_liquidaciones)
    if (v.baseTributable !== undefined && v.baseTributable !== null) c.baseTributable = normalizar('baseTributable', { t: 'entero', min: 0, max: 200000000, def: 0 }, v.baseTributable, e);
    // Bases para el finiquito: horas extra, gratificación y colación + movilización del mes (desde la v1.3.0 de pyme_liquidaciones)
    if (v.conBases === true) {
        c.conBases = true;
        ['horasExtra', 'gratificacion', 'colMov'].forEach(function (k) { c[k] = normalizar(k, { t: 'entero', min: 0, max: 200000000, def: 0 }, v[k], e); });
    }
    // Desglose para el resumen de Previred y el costo del empleador (desde la v1.1.0 de pyme_liquidaciones)
    if (v.conDesglose === true) {
        c.conDesglose = true;
        DESGLOSE_MES.forEach(function (k) { c[k] = normalizar(k, { t: 'entero', min: 0, max: 200000000, def: 0 }, v[k], e); });
        c.afpNombre = normalizar('afpNombre', { t: 'enum', valores: AFPS, def: '' }, v.afpNombre, e);
        c.saludInst = normalizar('saludInst', { t: 'enum', valores: ['fonasa', 'isapre'], def: 'fonasa' }, v.saludInst, e);
        c.isapreNombre = normalizar('isapreNombre', { t: 'texto', max: 40 }, v.isapreNombre, e);
    }
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
    const cuotas = cuotasMes(entrada.cuotasPrestamo, errores);
    if (cuotas !== undefined) valor.cuotasPrestamo = cuotas;
    const aus = ausenciasMes(entrada.ausencias, errores);
    if (aus !== undefined) valor.ausencias = aus;
    const c = calculoMes(entrada.calculo, errores);
    if (c !== undefined) valor.calculo = c;
    if (valor.apvMonto === 0) valor.apvRegimen = 'B';
    return Object.keys(errores).length ? { ok: false, errores } : { ok: true, valor };
}

// Boletas de honorarios del mes: el nombre y el RUT del prestador van cifrados; la retención se calcula con js/pyme_honorarios.js
const MAX_BOLETAS_MES = 60;
function validarHonorarios(entrada, periodo) {
    if (vacio(entrada)) return { ok: true, valor: [] };
    if (!Array.isArray(entrada) || entrada.length > MAX_BOLETAS_MES) return { ok: false, errores: { boletas: `Puedes registrar hasta ${MAX_BOLETAS_MES} boletas en un mes.` } };
    const salida = [];
    for (let i = 0; i < entrada.length; i++) {
        const it = entrada[i], e = {}, n = i + 1;
        if (!it || typeof it !== 'object' || Array.isArray(it)) return { ok: false, errores: { boletas: 'Las boletas no tienen el formato esperado.' } };
        const fecha = normalizar('fecha', { t: 'fecha', req: true }, it.fecha, e);
        const nombre = normalizar('nombre', { t: 'texto', max: 80, req: true }, it.nombre, e);
        const rut = normalizar('rut', { t: 'rut', req: true }, it.rut, e);
        const numero = normalizar('numero', { t: 'entero', min: 0, max: 9999999999, def: 0 }, it.numero, e);
        const bruto = normalizar('bruto', { t: 'entero', min: 1, max: MONTO_MAX, req: true }, it.bruto, e);
        const retiene = normalizar('retiene', { t: 'enum', valores: ['empresa', 'prestador'], def: 'empresa' }, it.retiene, e);
        if (e.fecha || (fecha && fecha.slice(0, 7) !== periodo)) return { ok: false, errores: { boletas: `Boleta ${n}: la fecha debe ser de este mes.` } };
        if (e.nombre) return { ok: false, errores: { boletas: `Boleta ${n}: indica el nombre de quien la emitió (hasta 80 caracteres).` } };
        if (e.rut) return { ok: false, errores: { boletas: `Boleta ${n}: el RUT no es válido.` } };
        if (e.bruto) return { ok: false, errores: { boletas: `Boleta ${n}: indica el monto bruto (hasta $50.000.000).` } };
        if (Object.keys(e).length) return { ok: false, errores: { boletas: `Boleta ${n}: revisa los datos.` } };
        salida.push({ fecha, nombre, rut, numero, bruto, retiene });
    }
    salida.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
    return { ok: true, valor: salida };
}

// Vacaciones: un período (desde, hasta; los días hábiles los cuenta el servidor) o un ajuste con los días tomados antes de usar el asistente
function textoNota(v, errores) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v !== 'string') { errores.nota = 'La nota debe ser texto.'; return ''; }
    const t = v.replace(/\s+/g, ' ').trim();
    if (t.length > 120) errores.nota = 'La nota puede tener hasta 120 caracteres.';
    return t.slice(0, 120);
}
function validarVacacion(entrada, hoy) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { ok: false, errores: { _: 'Los datos no tienen el formato esperado.' } };
    const errores = {};
    const nota = textoNota(entrada.nota, errores);
    if (entrada.tipo === 'ajuste') {
        const dias = Number(entrada.dias);
        if (!Number.isInteger(dias) || dias < 1 || dias > 200) errores.dias = 'Indica entre 1 y 200 días hábiles.';
        return Object.keys(errores).length ? { ok: false, errores } : { ok: true, valor: { tipo: 'ajuste', fecha: hoy, dias, nota } };
    }
    if (entrada.tipo !== 'periodo') return { ok: false, errores: { tipo: 'Tipo de registro no válido.' } };
    if (!esFechaIso(entrada.desde)) errores.desde = 'Indica el primer día de vacaciones.';
    if (!esFechaIso(entrada.hasta)) errores.hasta = 'Indica el último día de vacaciones.';
    if (Object.keys(errores).length) return { ok: false, errores };
    let r;
    try { r = VAC.diasHabiles(entrada.desde, entrada.hasta, F); } catch (e) {
        const msg = e instanceof F.ErrorFeriados ? 'Por ahora solo podemos contar días hábiles dentro de los años con feriados verificados (' + F.COBERTURA[0] + ' y ' + F.COBERTURA[F.COBERTURA.length - 1] + ').' : e.message;
        return { ok: false, errores: { hasta: msg } };
    }
    if (r.dias < 1) return { ok: false, errores: { hasta: 'En ese período no hay días hábiles de feriado.' } };
    return { ok: true, valor: { tipo: 'periodo', desde: entrada.desde, hasta: entrada.hasta, dias: r.dias, nota } };
}

module.exports = { validarMes, validarHonorarios, validarAusencias, validarPeriodo, validarEmpresa, validarTrabajador, validarPrestamos, validarVacacion, esFechaIso, CAMPOS_EMPRESA, CAMPOS_TRABAJADOR, CAMPOS_MES, AFPS, MAX_LOGO, MAX_PRESTAMOS, MAX_CUOTAS };

    });

    // ---- api/_pyme/datos.js ----
    definir("datos", {"crypto":"@crypto","./validar":"validar"}, function (module, exports, require, Buffer) {
/**
 * Datos del Asistente Pyme: empresa y trabajadores de una cuenta.
 *
 * Reglas
 *  - Todo dato personal se cifra aqui (AES-256-GCM) antes de pasar al almacen; la base solo ve bytes.
 *  - Cada dato se cifra atado a su cuenta (y a su id en el caso de los trabajadores): copiarlo a otra fila o cuenta lo inutiliza.
 *  - Limite de trabajadores activos: 1 sin pase y 5 con pase vigente. Lo aplica el servidor en la misma sentencia SQL del INSERT.
 *  - No puede haber dos trabajadores con el mismo RUT en una empresa, y se permiten hasta 50 en total (activos + inactivos).
 *  - Los préstamos con cuotas van dentro de la ficha (cifrados con ella). Guardar la ficha sin la lista los conserva.
 *  - Las boletas de honorarios van en una fila cifrada por empresa y mes (tabla honorarios, migración 002).
 *
 * Todas las funciones devuelven { ok: true, ... } o { ok: false, estado, codigo, error, errores? } (estado = codigo HTTP).
 */
const crypto = require('crypto');
const V = require('./validar');

const MAX_SIN_PASE = 1;
const MAX_CON_PASE = 5;
const MAX_TOTAL = 50;
const MAX_MESES_POR_TRABAJADOR = 120;
const MAX_DOCUMENTOS_POR_TRABAJADOR = 500;
const TIPOS_DOCUMENTO = ['anexo_contrato', 'pacto_horas_extra', 'cert_antiguedad', 'cert_remuneraciones', 'comprobante_feriado', 'carta_159_4', 'carta_161', 'amonestacion', 'anexo_datos', 'contrato', 'anexo_42h', 'finiquito', 'liquidacion'];
const MAX_VACACIONES_POR_TRABAJADOR = 200;
const MAX_MESES_HONORARIOS = 120;
const VERSION_EXPORTACION = 5;

function fallo(estado, codigo, error, errores) {
    const r = { ok: false, estado, codigo, error };
    if (errores) r.errores = errores;
    return r;
}

function crear({ almacen, cifrado, ahora, piloto }) {
    const reloj = ahora || Date.now;
    const iso = () => new Date(reloj()).toISOString();
    const ctxEmpresa = (cuentaId) => `empresas:${cuentaId}`;
    const ctxTrabajador = (cuentaId, id) => `trabajadores:${cuentaId}:${id}`;
    const ctxMes = (cuentaId, id, periodo) => `meses:${cuentaId}:${id}:${periodo}`;
    const ctxVacacion = (cuentaId, trabajadorId, id) => `vacaciones:${cuentaId}:${trabajadorId}:${id}`;
    const ctxHonorarios = (cuentaId, periodo) => `honorarios:${cuentaId}:${periodo}`;

    async function limites(cuentaId) {
        const vence = await almacen.paseVigente(cuentaId, iso());
        // Piloto gratuito (api/_pyme/piloto.js): mientras dure, lo mismo que el Pase de 12 meses, salvo que la cuenta tenga un pase pagado que dure más
        if (piloto && piloto.activo() && (!vence || vence < Date.parse(piloto.vence()))) {
            return { maxActivos: MAX_CON_PASE, paseVence: piloto.vence(), paseProducto: piloto.producto, piloto: true, pilotoHasta: piloto.fechaFin() };
        }
        const actual = vence ? await almacen.paseActual(cuentaId, iso()) : null;
        return { maxActivos: vence ? MAX_CON_PASE : MAX_SIN_PASE, paseVence: vence ? new Date(vence).toISOString() : null, paseProducto: actual ? actual.producto : null };
    }

    async function leerTrabajadores(cuentaId, empresaId) {
        const filas = await almacen.listarTrabajadores(empresaId);
        return filas.map(f => Object.assign({ id: f.id }, cifrado.descifrar(f.datos, f.version, ctxTrabajador(cuentaId, f.id)), { activo: f.activo }));
    }

    /** Todo lo que el panel necesita para dibujarse. */
    async function estado(cuenta) {
        const lim = await limites(cuenta.cuentaId);
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return { ok: true, cuenta: { email: cuenta.email }, empresa: null, trabajadores: [], limites: lim, maxTotal: MAX_TOTAL };
        const empresa = cifrado.descifrar(fila.datos, fila.version, ctxEmpresa(cuenta.cuentaId));
        const trabajadores = await leerTrabajadores(cuenta.cuentaId, fila.id);
        return { ok: true, cuenta: { email: cuenta.email }, empresa, trabajadores, limites: lim, maxTotal: MAX_TOTAL };
    }

    async function guardarEmpresa(cuenta, entrada) {
        const v = V.validarEmpresa(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos de la empresa.', v.errores);
        const c = cifrado.cifrar(v.valor, ctxEmpresa(cuenta.cuentaId));
        await almacen.guardarEmpresa(cuenta.cuentaId, c.datos, c.version, iso());
        return { ok: true, empresa: v.valor };
    }

    async function crearTrabajador(cuenta, entrada) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(409, 'sin_empresa', 'Primero guarda los datos de la empresa.');
        const v = V.validarTrabajador(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos del trabajador.', v.errores);
        const existentes = await leerTrabajadores(cuenta.cuentaId, fila.id);
        if (existentes.length >= MAX_TOTAL) return fallo(409, 'limite_total', `Una empresa puede tener hasta ${MAX_TOTAL} trabajadores en el asistente.`);
        if (existentes.some(t => t.rut === v.valor.rut)) return fallo(409, 'rut_repetido', 'Ya existe un trabajador con este RUT.', { rut: 'Ya existe un trabajador con este RUT.' });
        const lim = await limites(cuenta.cuentaId);
        const id = crypto.randomUUID();
        const { activo, ...datos } = v.valor;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const creado = await almacen.crearTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!creado) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    async function actualizarTrabajador(cuenta, id, entrada) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const v = V.validarTrabajador(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos del trabajador.', v.errores);
        const existentes = await leerTrabajadores(cuenta.cuentaId, fila.id);
        const actual = existentes.find(t => t.id === id);
        if (!actual) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        if (existentes.some(t => t.id !== id && t.rut === v.valor.rut)) return fallo(409, 'rut_repetido', 'Ya existe un trabajador con este RUT.', { rut: 'Ya existe un trabajador con este RUT.' });
        if (v.valor.prestamos === undefined && Array.isArray(actual.prestamos)) v.valor.prestamos = actual.prestamos;
        if (v.valor.bonosFijos === undefined && Array.isArray(actual.bonosFijos)) v.valor.bonosFijos = actual.bonosFijos;
        if (v.valor.ausencias === undefined && Array.isArray(actual.ausencias)) v.valor.ausencias = actual.ausencias;
        const lim = await limites(cuenta.cuentaId);
        const { activo, ...datos } = v.valor;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const ok = await almacen.actualizarTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!ok) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    /** Reemplaza una lista de la ficha ('prestamos' o 'ausencias') sin tocar el resto. */
    async function guardarListaFicha(cuenta, id, clave, lista, validador) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const t = (await leerTrabajadores(cuenta.cuentaId, fila.id)).find(x => x.id === id);
        if (!t) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const errores = {};
        const valor = validador(lista, errores);
        if (valor === undefined) return fallo(400, 'validacion', errores[clave], errores);
        const { id: _id, activo, ...datos } = t;
        datos[clave] = valor;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const lim = await limites(cuenta.cuentaId);
        const ok = await almacen.actualizarTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!ok) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    /** Reemplaza las licencias y permisos de un trabajador. */
    async function guardarAusencias(cuenta, id, lista) { return guardarListaFicha(cuenta, id, 'ausencias', lista, V.validarAusencias); }

    /** Reemplaza la lista de préstamos de un trabajador (agregar, eliminar o postergar una cuota). */
    async function guardarPrestamos(cuenta, id, lista) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const t = (await leerTrabajadores(cuenta.cuentaId, fila.id)).find(x => x.id === id);
        if (!t) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const errores = {};
        const prestamos = V.validarPrestamos(lista, errores);
        if (prestamos === undefined) return fallo(400, 'validacion', errores.prestamos, errores);
        const { id: _id, activo, ...datos } = t;
        datos.prestamos = prestamos;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const lim = await limites(cuenta.cuentaId);
        const ok = await almacen.actualizarTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!ok) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    async function borrarTrabajador(cuenta, id) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.borrarTrabajador(id, fila.id))) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        return { ok: true };
    }

    /**
     * Importa empresa y trabajadores (por ejemplo, los que el usuario tenia en el generador de liquidaciones).
     * La empresa existente solo se reemplaza si viene con datos validos. Los trabajadores que ya existen por RUT se saltan.
     */
    async function importar(cuenta, entrada) {
        if (!entrada || typeof entrada !== 'object') return fallo(400, 'validacion', 'No hay datos para importar.');
        const salida = { ok: true, empresa: false, importados: 0, omitidos: [] };
        if (entrada.empresa) {
            const r = await guardarEmpresa(cuenta, entrada.empresa);
            if (!r.ok) return Object.assign(r, { error: 'Los datos de la empresa no son válidos: ' + Object.keys(r.errores || {}).join(', ') });
            salida.empresa = true;
        }
        const lista = Array.isArray(entrada.trabajadores) ? entrada.trabajadores.slice(0, MAX_TOTAL) : [];
        for (const t of lista) {
            const r = await crearTrabajador(cuenta, t);
            const nombre = (t && typeof t.nombre === 'string' && t.nombre.slice(0, 80)) || 'Sin nombre';
            if (r.ok) salida.importados++;
            else if (r.codigo === 'sin_empresa') return fallo(409, 'sin_empresa', 'Primero guarda los datos de la empresa.');
            else salida.omitidos.push({ nombre, motivo: r.codigo === 'limite' ? 'limite' : r.codigo === 'rut_repetido' ? 'repetido' : 'invalido', detalle: r.errores || null });
        }
        return salida;
    }

    /** Meses guardados de todos los trabajadores (o solo de un periodo), descifrados. */
    async function leerMeses(cuentaId, empresaId, periodo) {
        const filas = await almacen.listarMeses(empresaId, periodo);
        return filas.map(f => ({ trabajadorId: f.trabajadorId, periodo: f.periodo, mes: cifrado.descifrar(f.datos, f.version, ctxMes(cuentaId, f.trabajadorId, f.periodo)) }));
    }

    async function meses(cuenta, periodo) {
        if (!V.validarPeriodo(periodo)) return fallo(400, 'periodo', 'El periodo debe tener el formato AAAA-MM.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return { ok: true, periodo, meses: [] };
        return { ok: true, periodo, meses: await leerMeses(cuenta.cuentaId, fila.id, periodo) };
    }

    async function guardarMes(cuenta, trabajadorId, periodo, entrada) {
        if (!esUuid(trabajadorId)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        if (!V.validarPeriodo(periodo)) return fallo(400, 'periodo', 'El periodo debe tener el formato AAAA-MM.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.trabajadorDeEmpresa(trabajadorId, fila.id))) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const v = V.validarMes(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos del mes.', v.errores);
        const c = cifrado.cifrar(v.valor, ctxMes(cuenta.cuentaId, trabajadorId, periodo));
        const ok = await almacen.guardarMes({ trabajadorId, empresaId: fila.id, periodo, datos: c.datos, version: c.version, ahoraIso: iso(), maxMeses: MAX_MESES_POR_TRABAJADOR });
        if (!ok) return fallo(409, 'limite_meses', `Cada trabajador puede tener hasta ${MAX_MESES_POR_TRABAJADOR} meses guardados. Elimina los más antiguos.`);
        return { ok: true, trabajadorId, periodo, mes: v.valor };
    }

    async function borrarMes(cuenta, trabajadorId, periodo) {
        if (!esUuid(trabajadorId) || !V.validarPeriodo(periodo)) return fallo(404, 'no_existe', 'No encontramos ese mes.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.borrarMes(trabajadorId, fila.id, periodo))) return fallo(404, 'no_existe', 'No encontramos ese mes.');
        return { ok: true };
    }

    /** Anota que se emitió un documento (solo el tipo y la fecha: el texto nunca se guarda). */
    async function registrarDocumento(cuenta, trabajadorId, tipo) {
        if (!esUuid(trabajadorId)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        if (TIPOS_DOCUMENTO.indexOf(tipo) < 0) return fallo(400, 'tipo', 'Tipo de documento no válido.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.trabajadorDeEmpresa(trabajadorId, fila.id))) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const ok = await almacen.registrarDocumento({ trabajadorId, empresaId: fila.id, tipo, ahoraIso: iso(), maximo: MAX_DOCUMENTOS_POR_TRABAJADOR });
        if (!ok) return fallo(409, 'limite_documentos', 'Ya hay demasiados documentos registrados para este trabajador.');
        return { ok: true };
    }

    /** Historial de documentos emitidos de la empresa (tipo y fecha). */
    async function documentos(cuenta) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        return { ok: true, documentos: fila ? await almacen.listarDocumentos(fila.id) : [] };
    }

    // ---------- vacaciones ----------
    async function leerVacaciones(cuentaId, empresaId) {
        const filas = await almacen.listarVacaciones(empresaId);
        return filas.map(f => Object.assign({ id: f.id, trabajadorId: f.trabajadorId, creado: f.creado }, cifrado.descifrar(f.datos, f.version, ctxVacacion(cuentaId, f.trabajadorId, f.id))));
    }

    async function vacaciones(cuenta) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        return { ok: true, vacaciones: fila ? await leerVacaciones(cuenta.cuentaId, fila.id) : [] };
    }

    /** Registra un período de vacaciones (los días hábiles los cuenta el servidor) o un ajuste de días tomados antes. */
    async function guardarVacacion(cuenta, trabajadorId, entrada) {
        if (!esUuid(trabajadorId)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.trabajadorDeEmpresa(trabajadorId, fila.id))) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const v = V.validarVacacion(entrada, iso().slice(0, 10));
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos de las vacaciones.', v.errores);
        if (v.valor.tipo === 'periodo') {
            const otro = (await leerVacaciones(cuenta.cuentaId, fila.id)).find(x => x.trabajadorId === trabajadorId && x.tipo === 'periodo' && x.desde <= v.valor.hasta && v.valor.desde <= x.hasta);
            if (otro) return fallo(409, 'se_cruza', 'Se cruza con otro período registrado (' + otro.desde + ' al ' + otro.hasta + ').', { desde: 'Se cruza con otro período registrado.' });
        }
        const id = crypto.randomUUID();
        const c = cifrado.cifrar(v.valor, ctxVacacion(cuenta.cuentaId, trabajadorId, id));
        const ok = await almacen.crearVacacion({ id, trabajadorId, empresaId: fila.id, datos: c.datos, version: c.version, ahoraIso: iso(), maximo: MAX_VACACIONES_POR_TRABAJADOR });
        if (!ok) return fallo(409, 'limite_vacaciones', 'Ya hay demasiados registros de vacaciones para este trabajador.');
        return { ok: true, vacacion: Object.assign({ id, trabajadorId, creado: iso() }, v.valor) };
    }

    async function borrarVacacion(cuenta, id) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos ese registro.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.borrarVacacion(id, fila.id))) return fallo(404, 'no_existe', 'No encontramos ese registro.');
        return { ok: true };
    }

    // ---------- boletas de honorarios ----------
    async function leerHonorarios(cuentaId, empresaId, periodo) {
        const filas = await almacen.listarHonorarios(empresaId, periodo);
        return filas.map(f => ({ periodo: f.periodo, boletas: cifrado.descifrar(f.datos, f.version, ctxHonorarios(cuentaId, f.periodo)) }));
    }

    async function honorarios(cuenta, periodo) {
        if (!V.validarPeriodo(periodo)) return fallo(400, 'periodo', 'El periodo debe tener el formato AAAA-MM.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return { ok: true, periodo, boletas: [] };
        const r = await leerHonorarios(cuenta.cuentaId, fila.id, periodo);
        return { ok: true, periodo, boletas: r[0] ? r[0].boletas : [] };
    }

    /** Reemplaza las boletas del mes; una lista vacía borra el mes. */
    async function guardarHonorarios(cuenta, periodo, entrada) {
        if (!V.validarPeriodo(periodo)) return fallo(400, 'periodo', 'El periodo debe tener el formato AAAA-MM.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(409, 'sin_empresa', 'Primero guarda los datos de la empresa.');
        const v = V.validarHonorarios(entrada, periodo);
        if (!v.ok) return fallo(400, 'validacion', v.errores.boletas, v.errores);
        if (!v.valor.length) {
            await almacen.borrarHonorarios(fila.id, periodo);
            return { ok: true, periodo, boletas: [] };
        }
        const c = cifrado.cifrar(v.valor, ctxHonorarios(cuenta.cuentaId, periodo));
        const ok = await almacen.guardarHonorarios({ empresaId: fila.id, periodo, datos: c.datos, version: c.version, ahoraIso: iso(), maxPeriodos: MAX_MESES_HONORARIOS });
        if (!ok) return fallo(409, 'limite_honorarios', `Puedes guardar boletas de hasta ${MAX_MESES_HONORARIOS} meses. Elimina las de los meses más antiguos.`);
        return { ok: true, periodo, boletas: v.valor };
    }

    // ---------- avisos por correo (preferencia de la cuenta) ----------
    async function avisosCorreo(cuenta) {
        return Object.assign({ ok: true }, await almacen.obtenerAvisosCorreo(cuenta.cuentaId));
    }
    async function guardarAvisosCorreo(cuenta, activo) {
        if (typeof activo !== 'boolean') return fallo(400, 'validacion', 'Indica si quieres recibir los avisos por correo.');
        await almacen.guardarAvisosCorreo(cuenta.cuentaId, activo, iso());
        return { ok: true, activo };
    }

    async function leerDocumentosExport(cuenta) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        return fila ? almacen.listarDocumentos(fila.id) : [];
    }

    async function leerMesesExport(cuenta) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        return fila ? leerMeses(cuenta.cuentaId, fila.id, null) : [];
    }

    async function leerHonorariosExport(cuenta) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        return fila ? leerHonorarios(cuenta.cuentaId, fila.id, null) : [];
    }

    /** Todo lo guardado, descifrado, para que la persona lo descargue. */
    async function exportar(cuenta) {
        const e = await estado(cuenta);
        return {
            ok: true,
            archivo: {
                formato: 'calculolaboral-asistente-pyme',
                version: VERSION_EXPORTACION,
                exportado: iso(),
                cuenta: { email: cuenta.email },
                empresa: e.empresa,
                trabajadores: e.trabajadores,
                meses: await leerMesesExport(cuenta),
                documentos: await leerDocumentosExport(cuenta),
                vacaciones: (await vacaciones(cuenta)).vacaciones,
                honorarios: await leerHonorariosExport(cuenta)
            }
        };
    }

    async function borrarCuenta(cuenta, confirmar) {
        if (typeof confirmar !== 'string' || confirmar.trim().toLowerCase() !== cuenta.email) {
            return fallo(400, 'confirmacion', 'Escribe tu correo exactamente para confirmar que quieres eliminar la cuenta.');
        }
        await almacen.borrarCuenta(cuenta.cuentaId);
        return { ok: true };
    }

    return { estado, guardarEmpresa, crearTrabajador, actualizarTrabajador, guardarPrestamos, guardarAusencias, borrarTrabajador, meses, guardarMes, borrarMes, registrarDocumento, documentos, vacaciones, guardarVacacion, borrarVacacion, honorarios, guardarHonorarios, avisosCorreo, guardarAvisosCorreo, importar, exportar, borrarCuenta };
}

function limiteTexto(lim) {
    return lim.paseVence
        ? `Tu pase permite hasta ${MAX_CON_PASE} trabajadores activos.`
        : `Sin pase puedes tener ${MAX_SIN_PASE} trabajador activo. Con el Pase Pyme son hasta ${MAX_CON_PASE}.`;
}

function esUuid(s) { return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }

module.exports = { crear, MAX_SIN_PASE, MAX_CON_PASE, MAX_TOTAL, MAX_MESES_POR_TRABAJADOR, MAX_MESES_HONORARIOS, MAX_DOCUMENTOS_POR_TRABAJADOR, MAX_VACACIONES_POR_TRABAJADOR, TIPOS_DOCUMENTO, VERSION_EXPORTACION };

    });

    // ---- tools/pyme_almacen_memoria.js ----
    definir("almacen", {"crypto":"@crypto"}, function (module, exports, require, Buffer) {
// Almacen en memoria con la misma interfaz que api/_pyme/almacen.js, para probar las cuentas sin base de datos.
'use strict';
const crypto = require('crypto');

function crearAlmacenMemoria() {
    const E = { enlaces: [], cuentas: [], sesiones: [], intentos: {}, auditoria: [], empresas: [], trabajadores: [], pases: [], meses: [], documentos: [], vacaciones: [], honorarios: [], avisos: [], enlaces: [], comentarios: [] };
    const t = iso => Date.parse(iso);

    return {
        _estado: E,
        async limpiar(ahoraIso) {
            E.enlaces = E.enlaces.filter(e => t(e.vence) >= t(ahoraIso) - 86400000);
            E.sesiones = E.sesiones.filter(s => t(s.vence) >= t(ahoraIso) - 86400000);
            Object.keys(E.intentos).forEach(k => { if (t(E.intentos[k].ventana) < t(ahoraIso) - 2 * 86400000) delete E.intentos[k]; });
        },
        async sumarIntento(clave, ventanaIso) {
            const k = clave + '|' + ventanaIso;
            E.intentos[k] = E.intentos[k] || { ventana: ventanaIso, cuenta: 0 };
            return ++E.intentos[k].cuenta;
        },
        async crearEnlace({ email, tokenHash, creado, vence }) {
            if (E.enlaces.some(e => e.tokenHash === tokenHash)) throw new Error('token_hash repetido');
            E.enlaces.push({ email, tokenHash, creado, vence, usado: null });
        },
        async buscarEnlace(tokenHash, ahoraIso) {
            const e = E.enlaces.find(x => x.tokenHash === tokenHash && !x.usado && t(x.vence) > t(ahoraIso));
            return e ? { email: e.email } : null;
        },
        async consumirEnlace(tokenHash, ahoraIso) {
            const e = E.enlaces.find(x => x.tokenHash === tokenHash && !x.usado && t(x.vence) > t(ahoraIso));
            if (!e) return null;
            e.usado = ahoraIso;
            return e.email;
        },
        async buscarCuentaPorEmail(email) {
            const c = E.cuentas.find(x => x.email === email);
            return c ? { id: c.id, aceptoEncargo: !!c.aceptoEncargo } : null;
        },
        async upsertCuenta(email, aceptoIso, ahoraIso) {
            let c = E.cuentas.find(x => x.email === email);
            if (!c) { c = { id: crypto.randomUUID(), email, aceptoEncargo: null, creada: ahoraIso }; E.cuentas.push(c); }
            c.ultimoAcceso = ahoraIso;
            c.aceptoEncargo = c.aceptoEncargo || aceptoIso || null;
            return { id: c.id };
        },
        async crearSesion({ cuentaId, tokenHash, creada, vence }) {
            if (E.sesiones.some(s => s.tokenHash === tokenHash)) throw new Error('token_hash repetido');
            E.sesiones.push({ id: crypto.randomUUID(), cuentaId, tokenHash, creada, vence, revocada: null });
        },
        async buscarSesion(tokenHash, ahoraIso) {
            const s = E.sesiones.find(x => x.tokenHash === tokenHash && !x.revocada && t(x.vence) > t(ahoraIso));
            if (!s) return null;
            const c = E.cuentas.find(x => x.id === s.cuentaId);
            return { sesionId: s.id, cuentaId: s.cuentaId, email: c.email, vence: t(s.vence) };
        },
        async extenderSesion(sesionId, venceIso) { E.sesiones.find(x => x.id === sesionId).vence = venceIso; },
        async revocarSesion(tokenHash, ahoraIso) {
            const s = E.sesiones.find(x => x.tokenHash === tokenHash && !x.revocada);
            if (s) s.revocada = ahoraIso;
        },
        async registrarAuditoria(a) { E.auditoria.push(a); },

        // ---- empresa y trabajadores ----
        async obtenerEmpresa(cuentaId) {
            const e = E.empresas.find(x => x.cuentaId === cuentaId);
            return e ? { id: e.id, datos: Buffer.from(e.datos), version: e.version } : null;
        },
        async guardarEmpresa(cuentaId, datos, version) {
            let e = E.empresas.find(x => x.cuentaId === cuentaId);
            if (!e) { e = { id: crypto.randomUUID(), cuentaId }; E.empresas.push(e); }
            e.datos = Buffer.from(datos); e.version = version;
            return { id: e.id };
        },
        async listarTrabajadores(empresaId) {
            return E.trabajadores.filter(x => x.empresaId === empresaId).map(x => ({ id: x.id, activo: x.activo, datos: Buffer.from(x.datos), version: x.version }));
        },
        async crearTrabajador({ id, empresaId, activo, datos, version, maxActivos }) {
            if (activo && E.trabajadores.filter(x => x.empresaId === empresaId && x.activo).length >= maxActivos) return false;
            E.trabajadores.push({ id, empresaId, activo, datos: Buffer.from(datos), version });
            return true;
        },
        async actualizarTrabajador({ id, empresaId, activo, datos, version, maxActivos }) {
            const t = E.trabajadores.find(x => x.id === id && x.empresaId === empresaId);
            if (!t) return false;
            if (activo && !t.activo && E.trabajadores.filter(x => x.empresaId === empresaId && x.activo).length >= maxActivos) return false;
            t.activo = activo; t.datos = Buffer.from(datos); t.version = version;
            return true;
        },
        async borrarTrabajador(id, empresaId) {
            const i = E.trabajadores.findIndex(x => x.id === id && x.empresaId === empresaId);
            if (i < 0) return false;
            E.meses = E.meses.filter(m => m.trabajadorId !== id);
            E.enlaces = E.enlaces.filter(m => m.trabajadorId !== id);
            E.documentos = E.documentos.filter(m => m.trabajadorId !== id);
            E.vacaciones = E.vacaciones.filter(m => m.trabajadorId !== id);
            E.trabajadores.splice(i, 1);
            return true;
        },
        // ---- meses de liquidacion ----
        async trabajadorDeEmpresa(id, empresaId) { return E.trabajadores.some(x => x.id === id && x.empresaId === empresaId); },
        async listarMeses(empresaId, periodo) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.meses.filter(m => ids.indexOf(m.trabajadorId) >= 0 && (!periodo || m.periodo === periodo))
                .map(m => ({ trabajadorId: m.trabajadorId, periodo: m.periodo, datos: Buffer.from(m.datos), version: m.version }));
        },
        async obtenerMes(trabajadorId, empresaId, periodo) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return null;
            const m = E.meses.find(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            return m ? { datos: Buffer.from(m.datos), version: m.version } : null;
        },
        async guardarMes({ trabajadorId, empresaId, periodo, datos, version, maxMeses }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            const m = E.meses.find(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            if (m) { m.datos = Buffer.from(datos); m.version = version; return true; }
            if (E.meses.filter(x => x.trabajadorId === trabajadorId).length >= maxMeses) return false;
            E.meses.push({ trabajadorId, periodo, datos: Buffer.from(datos), version });
            return true;
        },
        async borrarMes(trabajadorId, empresaId, periodo) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            const i = E.meses.findIndex(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            if (i < 0) return false;
            E.meses.splice(i, 1);
            return true;
        },
        // ---- liquidación compartida por enlace ----
        async crearEnlaceLiquidacion({ cuentaId, empresaId, trabajadorId, periodo, tokenHash, pagada, ahoraIso, venceIso }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            E.enlaces = E.enlaces.filter(x => !(x.trabajadorId === trabajadorId && x.periodo === periodo));
            E.enlaces.push({ tokenHash, cuentaId, trabajadorId, periodo, pagada, creado: ahoraIso, vence: venceIso, primeraVista: null, ultimaVista: null, vistas: 0 });
            return true;
        },
        async listarEnlacesLiquidacion(cuentaId, periodo) {
            return E.enlaces.filter(x => x.cuentaId === cuentaId && x.periodo === periodo).map(x => ({ trabajadorId: x.trabajadorId, periodo: x.periodo, creado: x.creado, vence: x.vence, primeraVista: x.primeraVista, ultimaVista: x.ultimaVista, vistas: x.vistas }));
        },
        async borrarEnlaceLiquidacion(cuentaId, trabajadorId, periodo) {
            const n = E.enlaces.length;
            E.enlaces = E.enlaces.filter(x => !(x.cuentaId === cuentaId && x.trabajadorId === trabajadorId && x.periodo === periodo));
            return E.enlaces.length < n;
        },
        async abrirEnlaceLiquidacion(tokenHash, ahoraIso) {
            const x = E.enlaces.find(e => e.tokenHash === tokenHash && t(e.vence) > t(ahoraIso));
            if (!x) return null;
            x.vistas++; x.ultimaVista = ahoraIso; x.primeraVista = x.primeraVista || ahoraIso;
            return { cuentaId: x.cuentaId, trabajadorId: x.trabajadorId, periodo: x.periodo, pagada: x.pagada };
        },
        // ---- opiniones del piloto ----
        async guardarComentario({ cuentaId, tipo, pantalla, texto, contacto, ahoraIso, maxPorDia }) {
            const hoy = E.comentarios.filter(c => c.cuentaId === cuentaId && t(c.creado) > t(ahoraIso) - 86400000).length;
            if (hoy >= maxPorDia) return null;
            const id = crypto.randomUUID();
            E.comentarios.push({ id, cuentaId, tipo, pantalla, texto, contacto, creado: ahoraIso });
            return id;
        },

        // ---- avisos por correo ----
        async obtenerAvisosCorreo(cuentaId) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            return a ? { activo: a.activo, ultimoEnvio: a.ultimoEnvio || null } : { activo: false, ultimoEnvio: null };
        },
        async guardarAvisosCorreo(cuentaId, activo) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            if (a) a.activo = activo; else E.avisos.push({ cuentaId, activo, enviados: {}, ultimoEnvio: null });
        },
        async cuentasConAvisos(limite) {
            return E.avisos.filter(a => a.activo).slice(0, limite).map(a => ({ cuentaId: a.cuentaId, email: (E.cuentas.find(c => c.id === a.cuentaId) || {}).email, enviados: JSON.parse(JSON.stringify(a.enviados)) }))
                .filter(a => a.email);
        },
        async registrarEnvioAvisos(cuentaId, enviados, ahoraIso) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            if (a) { a.enviados = JSON.parse(JSON.stringify(enviados)); a.ultimoEnvio = ahoraIso; }
        },
        // ---- boletas de honorarios ----
        async listarHonorarios(empresaId, periodo) {
            return E.honorarios.filter(h => h.empresaId === empresaId && (!periodo || h.periodo === periodo)).sort((a, b) => a.periodo < b.periodo ? -1 : 1)
                .map(h => ({ periodo: h.periodo, datos: Buffer.from(h.datos), version: h.version }));
        },
        async guardarHonorarios({ empresaId, periodo, datos, version, maxPeriodos }) {
            if (!E.empresas.some(x => x.id === empresaId)) return false;
            const h = E.honorarios.find(x => x.empresaId === empresaId && x.periodo === periodo);
            if (h) { h.datos = Buffer.from(datos); h.version = version; return true; }
            if (E.honorarios.filter(x => x.empresaId === empresaId).length >= maxPeriodos) return false;
            E.honorarios.push({ empresaId, periodo, datos: Buffer.from(datos), version });
            return true;
        },
        async borrarHonorarios(empresaId, periodo) {
            const i = E.honorarios.findIndex(x => x.empresaId === empresaId && x.periodo === periodo);
            if (i < 0) return false;
            E.honorarios.splice(i, 1);
            return true;
        },
        // ---- documentos emitidos ----
        async registrarDocumento({ trabajadorId, empresaId, tipo, ahoraIso, maximo }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            if (E.documentos.filter(d => d.trabajadorId === trabajadorId).length >= maximo) return false;
            E.documentos.push({ trabajadorId, tipo, emitido: new Date(ahoraIso).toISOString() });
            return true;
        },
        async listarDocumentos(empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.documentos.filter(d => ids.indexOf(d.trabajadorId) >= 0).map(d => Object.assign({}, d));
        },
        // ---- vacaciones ----
        async listarVacaciones(empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.vacaciones.filter(v => ids.indexOf(v.trabajadorId) >= 0).map(v => ({ id: v.id, trabajadorId: v.trabajadorId, datos: Buffer.from(v.datos), version: v.version, creado: v.creado }));
        },
        async crearVacacion({ id, trabajadorId, empresaId, datos, version, ahoraIso, maximo }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            if (E.vacaciones.filter(v => v.trabajadorId === trabajadorId).length >= maximo) return false;
            E.vacaciones.push({ id, trabajadorId, datos: Buffer.from(datos), version, creado: new Date(ahoraIso).toISOString() });
            return true;
        },
        async borrarVacacion(id, empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            const i = E.vacaciones.findIndex(v => v.id === id && ids.indexOf(v.trabajadorId) >= 0);
            if (i < 0) return false;
            E.vacaciones.splice(i, 1);
            return true;
        },
        async paseVigente(cuentaId, ahoraIso) {
            const propios = E.pases.filter(p => p.cuentaId === cuentaId && t(p.vence) > t(ahoraIso));
            if (!propios.some(p => t(p.desde) <= t(ahoraIso))) return null;
            return Math.max.apply(null, propios.map(p => t(p.vence)));
        },
        async paseActual(cuentaId, ahoraIso) {
            const v = E.pases.filter(p => p.cuentaId === cuentaId && t(p.desde) <= t(ahoraIso) && t(p.vence) > t(ahoraIso)).sort((a, b) => t(b.vence) - t(a.vence))[0];
            return v ? { producto: v.producto, vence: t(v.vence) } : null;
        },
        async registrarPase({ cuentaId, producto, ordenFlow, dias, ahoraIso }) {
            if (E.pases.some(p => p.ordenFlow === ordenFlow)) return null;
            const ultimo = Math.max.apply(null, [t(ahoraIso)].concat(E.pases.filter(p => p.cuentaId === cuentaId).map(p => t(p.vence))));
            const vence = ultimo + dias * 86400000;
            E.pases.push({ cuentaId, producto, ordenFlow, desde: new Date(ultimo).toISOString(), vence: new Date(vence).toISOString() });
            return { desde: ultimo, vence };
        },
        async paseDeOrden(ordenFlow) {
            const p = E.pases.find(x => x.ordenFlow === ordenFlow);
            return p ? { cuentaId: p.cuentaId, producto: p.producto, vence: t(p.vence) } : null;
        },
        async buscarCuentaPorId(cuentaId) {
            const c = E.cuentas.find(x => x.id === cuentaId);
            return c ? { id: c.id, email: c.email } : null;
        },
        async borrarCuenta(cuentaId) {
            const emp = E.empresas.filter(x => x.cuentaId === cuentaId).map(x => x.id);
            const tids = E.trabajadores.filter(x => emp.indexOf(x.empresaId) >= 0).map(x => x.id);
            E.meses = E.meses.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.documentos = E.documentos.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.vacaciones = E.vacaciones.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.trabajadores = E.trabajadores.filter(x => emp.indexOf(x.empresaId) < 0);
            E.honorarios = E.honorarios.filter(x => emp.indexOf(x.empresaId) < 0);
            E.empresas = E.empresas.filter(x => x.cuentaId !== cuentaId);
            E.sesiones = E.sesiones.filter(x => x.cuentaId !== cuentaId);
            E.pases = E.pases.filter(x => x.cuentaId !== cuentaId);
            E.avisos = E.avisos.filter(x => x.cuentaId !== cuentaId);
            E.comentarios = E.comentarios.filter(x => x.cuentaId !== cuentaId);
            E.enlaces = E.enlaces.filter(x => x.cuentaId !== cuentaId);
            E.cuentas = E.cuentas.filter(x => x.id !== cuentaId);
        }
    };
}

module.exports = { crearAlmacenMemoria };

    });

    root.CLPymeDemoServidor = { datos: function () { return cargar('datos'); }, almacen: function () { return cargar('almacen'); } };
})(typeof window !== 'undefined' ? window : this);
