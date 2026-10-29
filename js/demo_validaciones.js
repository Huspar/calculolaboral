/*
 * Revisión previa de una nómina antes de pagar. Detecta lo que después rechaza
 * Previred o lo que termina en un pago mal hecho. No calcula: solo revisa.
 *   CLValidar.lote(records, { imm: 553553 }) -> [{ fila, nombre, rut, nivel, texto }]
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CLValidar = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var AFPS = ['cuprum', 'habitat', 'modelo', 'planvital', 'provida', 'uno'];

    function limpiarRut(rut) {
        return String(rut || '').replace(/[.,\s]/g, '').toUpperCase();
    }

    function dvValido(rut) {
        var s = limpiarRut(rut);
        var m = /^(\d{1,9})-?([\dK])$/.exec(s);
        if (!m) return false;
        var cuerpo = m[1], dv = m[2], suma = 0, mult = 2;
        for (var i = cuerpo.length - 1; i >= 0; i--) {
            suma += Number(cuerpo.charAt(i)) * mult;
            mult = mult === 7 ? 2 : mult + 1;
        }
        var resto = 11 - (suma % 11);
        var esperado = resto === 11 ? '0' : (resto === 10 ? 'K' : String(resto));
        return esperado === dv;
    }

    function lote(records, opciones) {
        var o = opciones || {};
        var salida = [];
        var vistos = {};

        (records || []).forEach(function (r, i) {
            var fila = i + 2; // la fila 1 es el encabezado del Excel
            var quien = r.nombre || 'Sin nombre';
            function add(nivel, texto) {
                salida.push({ fila: fila, indice: i, nombre: quien, rut: r.rut || '', nivel: nivel, texto: texto });
            }

            if (!r.rut) add('error', 'Sin RUT: Previred lo rechaza.');
            else if (!dvValido(r.rut)) add('error', 'RUT con dígito verificador incorrecto.');

            var clave = limpiarRut(r.rut);
            if (clave) {
                if (vistos[clave]) add('error', 'RUT repetido con la fila ' + vistos[clave] + '.');
                else vistos[clave] = fila;
            }

            if (!r.afp) add('error', 'AFP no reconocida: el archivo no se puede armar.');
            else if (AFPS.indexOf(String(r.afp).toLowerCase()) === -1) add('error', 'AFP fuera de la lista (Cuprum, Habitat, Modelo, Planvital, Provida, Uno).');

            if (r.salud === 'isapre' && !(r.planUF > 0)) add('error', 'Isapre sin plan en UF.');

            if (!(r.dias > 0)) add('error', 'Días trabajados en cero.');
            else if (r.dias > 30) add('aviso', 'Días trabajados sobre 30: revisa si corresponde.');

            if (!(r.sueldo > 0)) add('error', 'Sueldo base en cero.');
            else if (o.imm && r.sueldo < o.imm) add('aviso', 'Sueldo bajo el mínimo (' + o.imm + '): puede ser jornada parcial, pero conviene revisarlo.');

            if (r.ingreso) {
                var d = new Date(r.ingreso);
                if (!isNaN(d.getTime()) && d.getTime() > Date.now()) add('aviso', 'Fecha de ingreso futura.');
            }

            if (r.licenciaDias > 30) add('error', 'Días de licencia sobre 30.');
            if (r.cargas > 0 && !/^[ABCD]$/.test(String(r.tramoAF || ''))) add('aviso', 'Tiene cargas familiares sin tramo: la asignación familiar no se paga.');
        });

        return salida;
    }

    return { lote: lote, dvValido: dvValido };
}));
