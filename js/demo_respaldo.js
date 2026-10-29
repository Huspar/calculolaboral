/*
 * Respaldo del estudio en un archivo: clientes, nóminas e historial.
 * Sirve para mover el trabajo de un computador a otro mientras no haya cuentas.
 *   var R = CLRespaldo.crear(localStorage);
 *   R.exportar() -> texto JSON
 *   R.importar(texto) -> { clientes, meses, reemplazados }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CLRespaldo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var VERSION = 1;
    var K_CLIENTES = 'cl-clientes-liq';
    var K_HISTORIAL = 'cl-historial-liq';

    function crear(almacen) {
        function leerJson(clave, porDefecto) {
            try {
                var t = almacen.getItem(clave);
                if (!t) return porDefecto;
                var v = JSON.parse(t);
                return (v && typeof v === 'object') ? v : porDefecto;
            } catch (e) { return porDefecto; }
        }

        function exportar() {
            var clientes = leerJson(K_CLIENTES, []);
            var historial = leerJson(K_HISTORIAL, {});
            return JSON.stringify({
                version: VERSION,
                aplicacion: 'CalculoLaboral demo contadores',
                generado: new Date().toISOString(),
                clientes: Array.isArray(clientes) ? clientes : [],
                historial: historial
            }, null, 1);
        }

        function importar(texto) {
            var datos;
            try { datos = JSON.parse(texto); }
            catch (e) { throw new Error('El archivo no es un respaldo válido (no es JSON).'); }
            if (!datos || datos.version !== VERSION) throw new Error('Respaldo de otra versión o incompleto.');
            if (!Array.isArray(datos.clientes)) throw new Error('El respaldo no trae la lista de clientes.');

            var actuales = leerJson(K_CLIENTES, []);
            if (!Array.isArray(actuales)) actuales = [];
            var porNombre = {};
            actuales.forEach(function (c) { porNombre[String(c.nombre).toLowerCase()] = c; });
            var reemplazados = 0;
            datos.clientes.forEach(function (c) {
                if (!c || !c.nombre || !Array.isArray(c.filas)) return;
                var k = String(c.nombre).toLowerCase();
                if (porNombre[k]) reemplazados++;
                porNombre[k] = c;
            });
            var lista = Object.keys(porNombre).map(function (k) { return porNombre[k]; });

            var hist = leerJson(K_HISTORIAL, {});
            if (!hist || typeof hist !== 'object') hist = {};
            if (datos.historial && typeof datos.historial === 'object') {
                Object.keys(datos.historial).forEach(function (k) {
                    if (Array.isArray(datos.historial[k])) hist[k] = datos.historial[k];
                });
            }

            try {
                almacen.setItem(K_CLIENTES, JSON.stringify(lista));
                almacen.setItem(K_HISTORIAL, JSON.stringify(hist));
            } catch (e) {
                throw new Error('No hay espacio en el navegador para restaurar el respaldo.');
            }

            var meses = 0;
            Object.keys(hist).forEach(function (k) { meses += Array.isArray(hist[k]) ? hist[k].length : 0; });
            return { clientes: lista.length, meses: meses, reemplazados: reemplazados };
        }

        return { exportar: exportar, importar: importar };
    }

    return { crear: crear, VERSION: VERSION };
}));
