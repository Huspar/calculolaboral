/*
 * CalculoLaboral · movimiento compartido (Fase 1)
 * Cuando una cifra grande de resultado deja de cambiar (por ejemplo, tras
 * mover un control), se "asienta" con un fundido breve para confirmar que
 * el monto mostrado es el nuevo. El valor ya esta visible antes de animar.
 */
(function () {
    'use strict';

    if (!('MutationObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var MIN_FONT_PX = 26;
    var SETTLE_DELAY_MS = 140;

    function isResultFigure(el) {
        if (!el || el.closest('header, footer, nav, .no-print-figure')) return false;
        // Sin exigir digitos: al cargar, muchas cifras aun muestran "$ —"
        return parseFloat(window.getComputedStyle(el).fontSize) >= MIN_FONT_PX;
    }

    function settle(el) {
        el.classList.remove('cl-settle');
        void el.offsetWidth; // reinicia la animacion
        el.classList.add('cl-settle');
    }

    function watch(el) {
        var timer = null;
        var observer = new MutationObserver(function () {
            window.clearTimeout(timer);
            timer = window.setTimeout(function () { settle(el); }, SETTLE_DELAY_MS);
        });
        observer.observe(el, { childList: true, characterData: true, subtree: true });
        el.addEventListener('animationend', function (e) {
            if (e.animationName === 'cl-settle') el.classList.remove('cl-settle');
        });
    }

    function init() {
        var candidates = document.querySelectorAll('main .font-mono, main .font-mono-num, main [id*="total" i], main [id*="result" i], main [id*="liquido" i], main [id*="monto" i]');
        var seen = new Set();
        candidates.forEach(function (el) {
            if (seen.has(el) || !isResultFigure(el)) return;
            // Evita observar padre e hijo a la vez
            for (var p = el.parentElement; p; p = p.parentElement) {
                if (seen.has(p)) return;
            }
            seen.add(el);
            watch(el);
        });
    }

    // Navegacion de calculadoras: deja visible la pestaña activa en moviles
    function revealCurrentTab() {
        var current = document.querySelector('.cl-calcnav [aria-current="page"]');
        if (!current) return;
        var track = current.parentElement;
        if (track.scrollWidth <= track.clientWidth) return;
        track.scrollLeft = current.offsetLeft - (track.clientWidth - current.offsetWidth) / 2;
    }

    function start() {
        init();
        revealCurrentTab();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
