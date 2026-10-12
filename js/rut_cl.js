/*
 * CalculoLaboral · RUT chileno (v1.0.0). Funciona en el navegador (window.CLRut) y en Node (require).
 *   limpiar("12.345.678-5") → "123456785"     formatear("123456785") → "12.345.678-5"     valido("12.345.678-5") → true
 * Dígito verificador por módulo 11. Acepta de 7 a 8 dígitos más el verificador (RUT de personas y empresas).
 */
(function (root) {
    'use strict';

    function limpiar(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^0-9K]/g, ''); }

    function formatear(v) {
        var c = limpiar(v);
        if (c.length < 2) return c;
        return c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
    }

    function valido(v) {
        var c = limpiar(v);
        if (c.length < 8 || c.length > 9 || /K/.test(c.slice(0, -1))) return false;
        var cuerpo = c.slice(0, -1), dv = c.slice(-1), suma = 0, m = 2;
        for (var i = cuerpo.length - 1; i >= 0; i--) { suma += +cuerpo[i] * m; m = m === 7 ? 2 : m + 1; }
        var r = 11 - (suma % 11);
        return dv === (r === 11 ? '0' : r === 10 ? 'K' : String(r));
    }

    var api = { limpiar: limpiar, formatear: formatear, valido: valido };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLRut = api;
})(typeof window !== 'undefined' ? window : this);
