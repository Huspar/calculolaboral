/*
 * CalculoLaboral · muestra el anuncio de la cuenta corriente de Itaú solo a quien puede calificar por renta.
 * Itaú pide renta líquida mensual desde $800.000 (itau.cl/personas/plan-cuenta-corriente, revisado el 17-oct-2026;
 * si cambia, se cambia aquí y en los textos de los anuncios). Cada calculadora ya sabe algo de la renta del visitante,
 * y el anuncio se oculta si no alcanza. Mientras no haya dato, se muestra con sus requisitos.
 *
 * Marca el bloque con data-itau-renta="..." según la fuente del dato:
 *   liquido   (por defecto) sueldo líquido calculado en #headerNetSalary; se oculta si es menor a $800.000.
 *   base      sueldo base que escribe el visitante en #he-sueldo-base; se oculta bajo $1.000.000 (líquido cercano a $820.000).
 *   impuesto  impuesto único calculado en #iu-total; se oculta si es $0 (el impuesto empieza sobre ~13,5 UTM, cerca del mínimo de Itaú).
 *   valorhora sueldo que escribe el visitante en la calculadora de valor hora (#vh-sueldo); se oculta bajo $1.000.000,
 *             igual que «base»: con Fonasa y la AFP más cara, $1.000.000 bruto deja unos $809.000 líquidos.
 *
 * Dentro del bloque, un elemento con data-itau-monto recibe el monto leído, para que el aviso hable del sueldo
 * de la persona. Al mostrarse por primera vez, el bloque envía a GA4 «ver_anuncio» (ad_name y ad_placement, este
 * último desde data-placement del bloque), para comparar cuántos lo vieron con los clics de «ad_click».
 */
(function () {
    'use strict';
    var FUENTES = {
        liquido: { id: 'headerNetSalary', minimo: 800000, ocultarEnCero: false },
        base: { id: 'he-sueldo-base', minimo: 1000000, ocultarEnCero: true },
        impuesto: { id: 'iu-total', minimo: 1, ocultarEnCero: true },
        valorhora: { id: 'vh-sueldo', minimo: 1000000, ocultarEnCero: true }
    };

    function valor(el) {
        var t = el.value !== undefined && el.tagName === 'INPUT' ? el.value : el.textContent;
        return parseInt(String(t).replace(/[^\d]/g, ''), 10) || 0;
    }

    function enlazar(bloque) {
        var f = FUENTES[bloque.getAttribute('data-itau-renta') || 'liquido'];
        var origen = f && document.getElementById(f.id);
        if (!origen) return;
        var monto = bloque.querySelector('[data-itau-monto]');
        var visto = false;
        function actualizar() {
            var v = valor(origen);
            var ocultar = (v > 0 || f.ocultarEnCero) && v < f.minimo;
            bloque.style.display = ocultar ? 'none' : '';
            if (monto && v) monto.textContent = '$' + v.toLocaleString('es-CL');
            if (!ocultar && !visto && typeof window.gtag === 'function') {
                visto = true;
                window.gtag('event', 'ver_anuncio', {
                    ad_name: 'itau_cuenta_corriente',
                    ad_placement: bloque.getAttribute('data-placement') || bloque.getAttribute('data-itau-renta') || 'liquido'
                });
            }
        }
        if (origen.tagName === 'INPUT') {
            origen.addEventListener('input', actualizar);
            origen.addEventListener('change', actualizar);
        } else {
            new MutationObserver(actualizar).observe(origen, { childList: true, characterData: true, subtree: true });
        }
        actualizar();
    }

    var bloques = document.querySelectorAll('[data-itau-renta]');
    for (var i = 0; i < bloques.length; i++) enlazar(bloques[i]);
})();
