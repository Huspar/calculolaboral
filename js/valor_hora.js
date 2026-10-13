/*
 * CalculoLaboral · calculadora "¿Cuánto vale tu hora?" (Ley 40 horas)
 * Fórmula DT para remuneración mensual:
 *   valor hora = (sueldo ÷ 30) × 28 ÷ (jornada semanal × 4)
 *   hora extra = valor hora × 1,5
 *   día        = sueldo ÷ 30
 * Si el sueldo es menor al ingreso mínimo proporcional a la jornada, la hora se
 * calcula sobre ese mínimo (dictámenes DT 4725/331 y 4262/210).
 */
(function () {
    'use strict';

    var root = document.querySelector('[data-valor-hora]');
    if (!root) return;

    var sueldoInput = root.querySelector('[name="vh-sueldo"]');
    var extrasInput = root.querySelector('[name="vh-extras"]');
    var jornadas = root.querySelectorAll('[data-jornada]');
    var out = function (k) { return root.querySelector('[data-vh="' + k + '"]'); };
    var jornada = 42;
    var medido = false;

    function clp(n) {
        return '$' + Math.round(n).toLocaleString('es-CL');
    }

    function leerSueldo() {
        var d = (sueldoInput.value || '').replace(/\D/g, '');
        return d ? parseInt(d, 10) : 0;
    }

    function calcular() {
        var sueldo = leerSueldo();
        var extras = Math.max(0, parseFloat((extrasInput.value || '0').replace(',', '.')) || 0);
        // Sueldo bajo el ingreso mínimo: la hora se calcula sobre el IMM proporcional a la jornada
        // (dictámenes DT Ord. 4725/331 de 1998 y 4262/210 de 2002). Menores de 18 y mayores de 65
        // años tienen un IMM de $412.938; aquí se usa el IMM general.
        var imm = (window.CONSTANTS && window.CONSTANTS.IMM) ? window.CONSTANTS.IMM : 553553;
        var immProp = Math.round(imm * jornada / 42);
        var base = sueldo ? Math.max(sueldo, immProp) : 0;
        var nota = out('imm-nota');
        if (nota) {
            nota.hidden = !(sueldo && sueldo < immProp);
            var notaMonto = out('imm-prop');
            if (notaMonto) notaMonto.textContent = clp(immProp);
        }
        var hora = base / 30 * 28 / (jornada * 4);
        var extra = hora * 1.5;
        out('hora').textContent = sueldo ? clp(hora) : '—';
        out('extra').textContent = sueldo ? clp(extra) : '—';
        out('dia').textContent = sueldo ? clp(sueldo / 30) : '—';
        out('jornada').textContent = jornada;
        var total = out('total');
        total.textContent = sueldo && extras ? clp(extra * extras) : '—';
        out('total-fila').hidden = !(sueldo && extras);
        out('extras-n').textContent = extras ? String(extras).replace('.', ',') : '0';
        if (!medido && sueldo && typeof window.gtag === 'function') {
            medido = true;
            window.gtag('event', 'calcular_valor_hora', { jornada: jornada });
        }
    }

    sueldoInput.addEventListener('input', function () {
        var d = sueldoInput.value.replace(/\D/g, '').slice(0, 9);
        sueldoInput.value = d ? parseInt(d, 10).toLocaleString('es-CL') : '';
        calcular();
    });
    extrasInput.addEventListener('input', calcular);
    Array.prototype.forEach.call(jornadas, function (b) {
        b.addEventListener('click', function () {
            jornada = parseInt(b.getAttribute('data-jornada'), 10);
            Array.prototype.forEach.call(jornadas, function (x) {
                x.setAttribute('aria-pressed', String(x === b));
            });
            calcular();
        });
    });

    calcular();
})();
