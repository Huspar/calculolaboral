/*
 * Historial de meses cerrados por cliente, en el navegador (demo, no producto).
 *   var H = CLHistorial.crear(localStorage);
 *   H.cerrar('Panadería Los Aromos', '2026-10', { trabajadores: 12, liquido: 17420713, costo: 22402654 });
 *   H.listar('Panadería Los Aromos') -> [{ periodo, trabajadores, liquido, costo, cerrado }]
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CLHistorial = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var CLAVE = 'cl-historial-liq';
    var MAXIMO_MESES = 24;

    function crear(almacen) {
        function leer() {
            try {
                var t = almacen.getItem(CLAVE);
                var o = t ? JSON.parse(t) : {};
                return (o && typeof o === 'object') ? o : {};
            } catch (e) { return {}; }
        }
        function escribir(o) {
            try { almacen.setItem(CLAVE, JSON.stringify(o)); return true; }
            catch (e) { return false; }
        }
        function clave(nombre) { return String(nombre || '').trim().toLowerCase(); }

        function cerrar(nombre, periodo, totales) {
            var k = clave(nombre);
            if (!k) throw new Error('Falta el nombre del cliente.');
            if (!/^\d{4}-\d{2}$/.test(String(periodo || ''))) throw new Error('Período inválido: se espera AAAA-MM.');
            var t = totales || {};
            var o = leer();
            var meses = (o[k] || []).filter(function (m) { return m.periodo !== periodo; });
            meses.push({
                periodo: periodo,
                trabajadores: Math.round(Number(t.trabajadores) || 0),
                liquido: Math.round(Number(t.liquido) || 0),
                costo: Math.round(Number(t.costo) || 0),
                cerrado: new Date().toISOString()
            });
            meses.sort(function (a, b) { return a.periodo < b.periodo ? 1 : -1; });
            o[k] = meses.slice(0, MAXIMO_MESES);
            return escribir(o);
        }

        function listar(nombre) {
            var k = clave(nombre);
            var o = leer();
            return (o[k] || []).map(function (m) {
                return { periodo: m.periodo, trabajadores: m.trabajadores || 0, liquido: m.liquido || 0, costo: m.costo || 0, cerrado: m.cerrado || '' };
            });
        }

        function borrar(nombre) {
            var o = leer();
            delete o[clave(nombre)];
            return escribir(o);
        }

        return { cerrar: cerrar, listar: listar, borrar: borrar };
    }

    return { crear: crear, CLAVE: CLAVE };
}));
