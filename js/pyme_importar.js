/*
 * CalculoLaboral · importar trabajadores desde una planilla CSV (v1.0.0)
 * Funciona en el navegador (window.CLPymeImportar) y en Node (require).
 *
 *   plantilla()                        → texto CSV (separado por punto y coma) con los encabezados
 *   leerCsv(texto)                     → filas (arreglos de texto); detecta ";" o "," y respeta comillas
 *   revisar(filas, { rut, afps })      → [{ fila, datos, errores: [] }]  (rut: CLRut; afps: nombres de AFP válidos)
 *
 * La revisión es una ayuda para corregir antes de enviar: el servidor vuelve a validar cada trabajador al importarlo.
 * Excel guarda la planilla como «CSV UTF-8 (delimitado por comas)», que en Chile usa punto y coma.
 */
(function (root) {
    'use strict';

    // Columnas de la plantilla, en orden. "req": obligatoria.
    var COLUMNAS = [
        { k: 'nombre', titulo: 'Nombre completo', req: true },
        { k: 'rut', titulo: 'RUT', req: true },
        { k: 'cargo', titulo: 'Cargo' },
        { k: 'fechaIngreso', titulo: 'Fecha de ingreso (dd-mm-aaaa)' },
        { k: 'contrato', titulo: 'Contrato (indefinido, plazo fijo u obra)' },
        { k: 'fechaTerminoPlazo', titulo: 'Término del plazo fijo (dd-mm-aaaa)' },
        { k: 'jornadaHoras', titulo: 'Jornada semanal (horas)' },
        { k: 'distribucion', titulo: 'Días de trabajo a la semana (5 o 6)' },
        { k: 'sueldoBase', titulo: 'Sueldo base' },
        { k: 'colacion', titulo: 'Colación mensual' },
        { k: 'movilizacion', titulo: 'Movilización mensual' },
        { k: 'gratificacion', titulo: 'Gratificación (legal, ninguna o pactada)' },
        { k: 'afp', titulo: 'AFP' },
        { k: 'salud', titulo: 'Salud (Fonasa o Isapre)' },
        { k: 'isapreNombre', titulo: 'Nombre de la Isapre' },
        { k: 'isaprePlanUF', titulo: 'Plan de Isapre (UF)' },
        { k: 'fechaNacimiento', titulo: 'Fecha de nacimiento (dd-mm-aaaa)' },
        { k: 'nacionalidad', titulo: 'Nacionalidad' },
        { k: 'domicilio', titulo: 'Domicilio' },
        { k: 'comuna', titulo: 'Comuna' }
    ];
    var MAX_FILAS = 50;

    function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
    function clave(titulo) { return sinTildes(String(titulo).split('(')[0]).replace(/\s+/g, ' '); }

    function campoCsv(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function plantilla() {
        return COLUMNAS.map(function (c) { return campoCsv(c.titulo); }).join(';') + '\r\n';
    }

    function leerCsv(texto) {
        texto = String(texto || '').replace(/^﻿/, '');
        var primera = texto.split(/\r?\n/)[0] || '';
        var sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
        var filas = [], fila = [], campo = '', comillas = false;
        for (var i = 0; i < texto.length; i++) {
            var ch = texto[i];
            if (comillas) {
                if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
                else if (ch === '"') comillas = false;
                else campo += ch;
            } else if (ch === '"') comillas = true;
            else if (ch === sep) { fila.push(campo); campo = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && texto[i + 1] === '\n') i++;
                fila.push(campo); filas.push(fila); fila = []; campo = '';
            } else campo += ch;
        }
        if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
        return filas.filter(function (f) { return f.some(function (x) { return String(x).trim() !== ''; }); });
    }

    // "15-03-2022", "15/03/2022", "15.03.2022" o "2022-03-15" → "2022-03-15"; '' si viene vacía; null si no se entiende
    function fecha(v) {
        v = String(v || '').trim();
        if (!v) return '';
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v) || null, a, me, d;
        if (m) { a = +m[1]; me = +m[2]; d = +m[3]; }
        else if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(v))) { d = +m[1]; me = +m[2]; a = +m[3]; }
        else return null;
        var f = new Date(Date.UTC(a, me - 1, d));
        if (f.getUTCFullYear() !== a || f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d) return null;
        return a + '-' + (me < 10 ? '0' : '') + me + '-' + (d < 10 ? '0' : '') + d;
    }
    // "$650.000", "650000" o "650.000" → 650000; '' vacío; null si no es un monto en pesos
    function monto(v) {
        v = String(v || '').replace(/\s|\$/g, '');
        if (!v) return '';
        if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(v)) return null;
        return parseInt(v.replace(/\./g, ''), 10);
    }
    function decimal(v) {
        v = String(v || '').trim().replace(',', '.');
        if (!v) return '';
        return /^\d+(\.\d+)?$/.test(v) ? Math.round(parseFloat(v) * 100) / 100 : null;
    }
    function opcion(v, mapa) {
        var s = sinTildes(v);
        if (!s) return '';
        return Object.prototype.hasOwnProperty.call(mapa, s) ? mapa[s] : null;
    }

    function revisar(filas, opc) {
        opc = opc || {};
        if (!filas || !filas.length) return [];
        var encabezado = filas[0].map(clave), indice = {};
        COLUMNAS.forEach(function (c) { var i = encabezado.indexOf(clave(c.titulo)); if (i >= 0) indice[c.k] = i; });
        var afps = {};
        (opc.afps || []).forEach(function (a) { afps[sinTildes(a)] = a; });
        return filas.slice(1, MAX_FILAS + 1).map(function (f, n) {
            var errores = [], d = {};
            function val(k) { return indice[k] === undefined ? '' : String(f[indice[k]] || '').trim(); }
            d.nombre = val('nombre').replace(/\s+/g, ' ');
            if (!d.nombre) errores.push('falta el nombre');
            else if (d.nombre.length > 80) errores.push('el nombre tiene más de 80 caracteres');
            var rut = val('rut');
            if (!rut) errores.push('falta el RUT');
            else if (opc.rut && !opc.rut.valido(rut)) errores.push('el RUT no es válido');
            else d.rut = opc.rut ? opc.rut.formatear(rut) : rut;
            ['cargo', 'nacionalidad', 'domicilio', 'comuna', 'isapreNombre'].forEach(function (k) { var x = val(k); if (x) d[k] = x; });
            [['fechaIngreso', 'la fecha de ingreso'], ['fechaTerminoPlazo', 'el término del plazo fijo'], ['fechaNacimiento', 'la fecha de nacimiento']].forEach(function (p) {
                var x = fecha(val(p[0]));
                if (x === null) errores.push(p[1] + ' no es una fecha (usa dd-mm-aaaa)');
                else if (x) d[p[0]] = x;
            });
            ['sueldoBase', 'colacion', 'movilizacion'].forEach(function (k) {
                var x = monto(val(k));
                if (x === null) errores.push('«' + val(k) + '» no es un monto en pesos');
                else if (x !== '') d[k] = x;
            });
            var j = val('jornadaHoras');
            if (j) { if (/^\d{1,2}$/.test(j) && +j >= 1 && +j <= 45) d.jornadaHoras = +j; else errores.push('la jornada debe ser un número de horas entre 1 y 45'); }
            var di = val('distribucion');
            if (di) { if (di === '5' || di === '6') d.distribucion = di; else errores.push('los días de trabajo a la semana deben ser 5 o 6'); }
            var c = opcion(val('contrato'), { 'indefinido': 'indefinido', 'plazo fijo': 'plazo_fijo', 'plazo_fijo': 'plazo_fijo', 'obra': 'obra', 'obra o faena': 'obra', 'por obra': 'obra' });
            if (c === null) errores.push('el contrato debe ser indefinido, plazo fijo u obra'); else if (c) d.contrato = c;
            if (d.contrato === 'plazo_fijo' && !d.fechaTerminoPlazo) errores.push('falta el término del plazo fijo');
            var g = opcion(val('gratificacion'), { 'legal': 'legal', 'ninguna': 'ninguna', 'no': 'ninguna', 'pactada': 'pactada' });
            if (g === null) errores.push('la gratificación debe ser legal, ninguna o pactada'); else if (g) d.gratificacion = g;
            var a = val('afp');
            if (a) { var an = afps[sinTildes(a.replace(/^afp\s+/i, ''))]; if (an) d.afp = an; else errores.push('AFP «' + a + '» desconocida'); }
            var s = opcion(val('salud'), { 'fonasa': 'fonasa', 'isapre': 'isapre' });
            if (s === null) errores.push('la salud debe ser Fonasa o Isapre'); else if (s) d.salud = s;
            var plan = decimal(val('isaprePlanUF'));
            if (plan === null) errores.push('el plan de Isapre debe ser un número en UF (por ejemplo 4,2)'); else if (plan !== '') d.isaprePlanUF = plan;
            if (d.salud === 'isapre' && !d.isapreNombre) errores.push('falta el nombre de la Isapre');
            return { fila: n + 2, datos: d, errores: errores };
        });
    }

    var api = { COLUMNAS: COLUMNAS, MAX_FILAS: MAX_FILAS, plantilla: plantilla, leerCsv: leerCsv, revisar: revisar, _fecha: fecha, _monto: monto, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeImportar = api;
})(typeof window !== 'undefined' ? window : this);
