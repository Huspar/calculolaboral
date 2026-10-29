/*
 * CalculoLaboral · novedades del mes por planilla (Asistente Pyme, v1.0.0)
 * Funciona en el navegador (window.CLPymeNovedades) y en Node (require).
 *
 *   plantilla(trabajadores)                       → CSV con una fila por trabajador (RUT y nombre) para llenar las novedades
 *   revisar(filas, trabajadores, rut)             → { cambios: [{ t, nov }], errores: [{ fila, motivo }], sinFila: [nombres] }
 *   aplicar(mesBase, nov)                         → el mes con las novedades encima (lo que va vacío en la planilla queda como estaba)
 *
 * Las novedades son lo que cambia cada mes y no está en la ficha: días, horas extra, comisiones, tratos, un bono imponible, viáticos,
 * anticipo, cuota sindical, crédito de la caja y APV. Un bono no imponible no se acepta por planilla: solo corresponde a lo que
 * enumera el art. 41 del Código del Trabajo y se anota en la liquidación.
 */
(function (root) {
    'use strict';

    var COLUMNAS = [
        { k: 'rut', titulo: 'RUT' }, { k: 'nombre', titulo: 'Nombre (solo para guiarte)' },
        { k: 'dias', titulo: 'Días trabajados', tipo: 'dias' }, { k: 'horasExtra', titulo: 'Horas extra', tipo: 'decimal' },
        { k: 'comisiones', titulo: 'Comisiones', tipo: 'monto' }, { k: 'tratos', titulo: 'Tratos', tipo: 'monto' },
        { k: 'bono', titulo: 'Bono imponible', tipo: 'monto' }, { k: 'viaticos', titulo: 'Viáticos', tipo: 'monto' },
        { k: 'anticipo', titulo: 'Anticipo', tipo: 'monto' }, { k: 'cuotaSindical', titulo: 'Cuota sindical', tipo: 'monto' },
        { k: 'creditoCCAF', titulo: 'Crédito caja de compensación', tipo: 'monto' }, { k: 'apv', titulo: 'APV', tipo: 'monto' }
    ];
    var MAX_MONTO = 50000000;

    function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' '); }
    function celda(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function plantilla(trabajadores) {
        var lineas = [COLUMNAS.map(function (c) { return celda(c.titulo); }).join(';')];
        (trabajadores || []).forEach(function (t) {
            lineas.push([t.rut, t.nombre].map(celda).join(';') + ';'.repeat(COLUMNAS.length - 2));
        });
        return lineas.join('\r\n') + '\r\n';
    }

    function monto(v) {
        v = String(v || '').replace(/\s|\$/g, '');
        if (!v) return '';
        if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(v)) return null;
        var n = parseInt(v.replace(/\./g, ''), 10);
        return n <= MAX_MONTO ? n : null;
    }
    function decimal(v) {
        v = String(v || '').trim().replace(',', '.');
        if (!v) return '';
        if (!/^\d+(\.\d+)?$/.test(v)) return null;
        var n = parseFloat(v);
        return n <= 300 ? Math.round(n * 100) / 100 : null;
    }
    function dias(v) {
        v = String(v || '').trim().replace(',', '.');
        if (!v) return '';
        if (!/^\d+(\.\d+)?$/.test(v)) return null;
        var n = parseFloat(v);
        return n <= 30 && n === Math.floor(n) ? n : null;
    }
    var LECTOR = { monto: monto, decimal: decimal, dias: dias };

    function revisar(filas, trabajadores, rut) {
        var salida = { cambios: [], errores: [], sinFila: [] };
        if (!filas || filas.length < 2) { salida.errores.push({ fila: 1, motivo: 'La planilla no tiene filas debajo de los encabezados.' }); return salida; }
        var enc = filas[0].map(function (h) { return sinTildes(String(h).split('(')[0]); });
        var pos = {};
        COLUMNAS.forEach(function (c) { var i = enc.indexOf(sinTildes(c.titulo.split('(')[0])); if (i >= 0) pos[c.k] = i; });
        if (pos.rut === undefined) { salida.errores.push({ fila: 1, motivo: 'Falta la columna «RUT». Descarga la plantilla y úsala tal cual.' }); return salida; }
        var porRut = {};
        (trabajadores || []).forEach(function (t) { porRut[rut.limpiar(t.rut)] = t; });
        var vistos = {}, conFila = {};
        filas.slice(1).forEach(function (f, i) {
            var n = i + 2, rutFila = String(f[pos.rut] || '').trim();
            if (!rutFila) return;
            var limpio = rut.limpiar(rutFila);
            if (!rut.valido(rutFila)) { salida.errores.push({ fila: n, motivo: 'El RUT «' + rutFila + '» no es válido.' }); return; }
            var t = porRut[limpio];
            if (!t) { salida.errores.push({ fila: n, motivo: 'El RUT ' + rutFila + ' no es de ningún trabajador de este mes.' }); return; }
            if (vistos[limpio]) { salida.errores.push({ fila: n, motivo: t.nombre + ' aparece dos veces.' }); return; }
            vistos[limpio] = true;
            var nov = {}, malos = [];
            COLUMNAS.forEach(function (c) {
                if (!c.tipo || pos[c.k] === undefined) return;
                var crudo = String(f[pos[c.k]] == null ? '' : f[pos[c.k]]).trim();
                if (!crudo) return;
                var v = LECTOR[c.tipo](crudo);
                if (v === null) malos.push('«' + c.titulo + '» no es un valor válido (' + crudo + ')');
                else if (v !== '') nov[c.k] = v;
            });
            if (malos.length) { salida.errores.push({ fila: n, motivo: t.nombre + ': ' + malos.join('; ') + '.' }); return; }
            conFila[limpio] = true;
            salida.cambios.push({ t: t, nov: nov });
        });
        (trabajadores || []).forEach(function (t) { if (!conFila[rut.limpiar(t.rut)]) salida.sinFila.push(t.nombre); });
        return salida;
    }

    function aplicar(base, nov) {
        var m = Object.assign({}, base);
        if (nov.dias !== undefined) m.diasTrabajados = nov.dias;
        if (nov.horasExtra !== undefined) m.horasExtra = nov.horasExtra;
        if (nov.comisiones !== undefined) m.comisiones = nov.comisiones;
        if (nov.tratos !== undefined) m.tratos = nov.tratos;
        if (nov.bono) m.bonosImponibles = (base.bonosImponibles || []).filter(function (b) { return b.nombre !== 'Bono del mes'; }).concat([{ nombre: 'Bono del mes', monto: nov.bono }]).slice(0, 8);
        else if (nov.bono === 0) m.bonosImponibles = (base.bonosImponibles || []).filter(function (b) { return b.nombre !== 'Bono del mes'; });
        if (nov.viaticos !== undefined) m.viaticos = nov.viaticos;
        if (nov.anticipo !== undefined) m.anticipo = nov.anticipo;
        if (nov.cuotaSindical !== undefined) m.cuotaSindical = nov.cuotaSindical;
        if (nov.creditoCCAF !== undefined) m.creditoCCAF = nov.creditoCCAF;
        if (nov.apv !== undefined) m.apvMonto = nov.apv;
        return m;
    }

    var api = { COLUMNAS: COLUMNAS, plantilla: plantilla, revisar: revisar, aplicar: aplicar, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeNovedades = api;
})(typeof window !== 'undefined' ? window : this);
