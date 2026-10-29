/*
 * Clientes del estudio en el navegador: cada cliente guarda su última nómina cargada.
 * Es de la demo, no del producto: vive en localStorage, no hay cuentas ni servidor.
 *   var C = CLClientes.crear(window.localStorage);
 *   C.guardar('Panadería Los Aromos', filas, 'nomina.xlsx');
 *   C.listar() -> [{ nombre, archivo, guardado }]
 *   C.obtener('...') -> { nombre, filas, archivo }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CLClientes = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var CLAVE = 'cl-clientes-liq';
    var MAXIMO = 40;

    function crear(almacen) {
        function leer() {
            try {
                var t = almacen.getItem(CLAVE);
                var lista = t ? JSON.parse(t) : [];
                return Array.isArray(lista) ? lista : [];
            } catch (e) { return []; }
        }
        function escribir(lista) {
            try { almacen.setItem(CLAVE, JSON.stringify(lista)); return true; }
            catch (e) { return false; }
        }
        function normal(v) { return String(v || '').trim().slice(0, 60); }

        function listar() {
            return leer().map(function (c) {
                return { nombre: c.nombre, archivo: c.archivo || '', guardado: c.guardado || '', trabajadores: (c.filas || []).length };
            });
        }
        function obtener(nombre) {
            var n = normal(nombre).toLowerCase();
            var c = leer().filter(function (x) { return String(x.nombre).toLowerCase() === n; })[0];
            return c ? { nombre: c.nombre, filas: c.filas || [], archivo: c.archivo || '' } : null;
        }
        function guardar(nombre, filas, archivo) {
            var n = normal(nombre);
            if (!n) throw new Error('Falta el nombre del cliente.');
            if (!Array.isArray(filas) || !filas.length) throw new Error('No hay nómina para guardar.');
            var lista = leer().filter(function (x) { return String(x.nombre).toLowerCase() !== n.toLowerCase(); });
            lista.unshift({ nombre: n, filas: filas, archivo: archivo || '', guardado: new Date().toISOString() });
            return escribir(lista.slice(0, MAXIMO));
        }
        function borrar(nombre) {
            var n = normal(nombre).toLowerCase();
            return escribir(leer().filter(function (x) { return String(x.nombre).toLowerCase() !== n; }));
        }
        return { listar: listar, obtener: obtener, guardar: guardar, borrar: borrar };
    }

    return { crear: crear, CLAVE: CLAVE };
}));
