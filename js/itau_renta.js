/*
 * CalculoLaboral · muestra el anuncio de la cuenta corriente de Itaú solo a quien puede calificar por renta.
 * Itaú pide renta líquida mensual desde $800.000 (itau.cl/personas/plan-cuenta-corriente, revisado el 17-oct-2026;
 * si cambia, se cambia aquí y en los textos de los anuncios). La calculadora de sueldo líquido ya sabe el líquido del
 * visitante: si es menor al mínimo, el anuncio se oculta. Mientras no haya cálculo, se muestra con sus requisitos.
 * Marca con data-itau-renta el bloque que debe ocultarse.
 */
(function () {
    'use strict';
    var MINIMO = 800000;
    var origen = document.getElementById('headerNetSalary');
    var bloques = document.querySelectorAll('[data-itau-renta]');
    if (!origen || !bloques.length) return;

    function liquido() { return parseInt(String(origen.textContent).replace(/[^\d]/g, ''), 10) || 0; }

    function actualizar() {
        var v = liquido();
        var ocultar = v > 0 && v < MINIMO;
        for (var i = 0; i < bloques.length; i++) bloques[i].style.display = ocultar ? 'none' : '';
    }

    new MutationObserver(actualizar).observe(origen, { childList: true, characterData: true, subtree: true });
    actualizar();
})();
