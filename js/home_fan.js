/*
 * Abanico de calculadoras de la portada (index.html).
 * Las tarjetas vienen escritas en el HTML (con su enlace, para buscadores y sin JS);
 * este script solo las ordena en abanico y maneja la interacción:
 *  - clic o toque en una tarjeta de atrás: la trae al frente (no navega)
 *  - clic en la tarjeta del frente: abre la calculadora
 *  - flechas, puntos, teclado (← →) y arrastre lateral para pasar de tarjeta
 * Eventos GA4: fan_card_front (tarjeta traída al frente) y fan_card_open (calculadora abierta).
 */
(function () {
    var fan = document.getElementById('clf-fan');
    if (!fan) return;
    var cards = Array.prototype.slice.call(fan.querySelectorAll('.clf-card'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('#clf-dots button'));
    var n = cards.length;
    var active = 0;
    var capName = document.getElementById('clf-cap-n');
    var capIdx = document.getElementById('clf-cap-i');
    var cta = document.getElementById('clf-cta');
    var ctaText = document.getElementById('clf-cta-t');

    function medir(evento, params) {
        if (typeof window.gtag === 'function') window.gtag('event', evento, params);
    }

    function offset(i) {
        var o = ((i - active) % n + n) % n;
        return o > n / 2 ? o - n : o;
    }

    function layout() {
        cards.forEach(function (el, i) {
            var o = offset(i);
            var a = Math.abs(o);
            el.style.setProperty('--o', o);
            el.style.zIndex = 20 - a;
            el.classList.toggle('is-active', o === 0);
            el.classList.toggle('clf-o3', a >= 3);
        });
        dots.forEach(function (d, i) { d.setAttribute('aria-current', i === active ? 'true' : 'false'); });
        var c = cards[active];
        if (capName) capName.textContent = c.getAttribute('data-name');
        if (capIdx) capIdx.textContent = (active + 1) + ' de ' + n;
        if (cta) cta.href = c.getAttribute('href');
        if (ctaText) ctaText.textContent = c.getAttribute('data-name');
    }

    function setActive(i, metodo) {
        var nuevo = ((i % n) + n) % n;
        if (nuevo === active) return;
        active = nuevo;
        layout();
        medir('fan_card_front', { card: cards[active].getAttribute('data-fan'), metodo: metodo });
    }

    document.getElementById('clf-next').addEventListener('click', function () { setActive(active + 1, 'flecha'); });
    document.getElementById('clf-prev').addEventListener('click', function () { setActive(active - 1, 'flecha'); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { setActive(i, 'punto'); }); });

    // Arrastre lateral (dedo o mouse)
    var x0 = null;
    var arrastro = false;
    var ultimoPuntero = 0;
    fan.addEventListener('pointerdown', function (e) {
        x0 = e.clientX;
        arrastro = false;
        ultimoPuntero = Date.now();
    });
    window.addEventListener('pointerup', function (e) {
        if (x0 === null) return;
        var dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) {
            arrastro = true;
            setActive(dx < 0 ? active + 1 : active - 1, 'arrastre');
            setTimeout(function () { arrastro = false; }, 60);
        }
    });

    cards.forEach(function (el, i) {
        el.addEventListener('dragstart', function (e) { e.preventDefault(); });
        el.addEventListener('click', function (e) {
            if (arrastro) { e.preventDefault(); return; }
            if (i !== active) {
                // Tarjeta de atrás: solo viene al frente
                e.preventDefault();
                setActive(i, 'clic');
                return;
            }
            medir('fan_card_open', { card: el.getAttribute('data-fan'), desde: 'tarjeta' });
        });
        // Con teclado (Tab), la tarjeta enfocada pasa al frente. Un toque también enfoca
        // la tarjeta (en el celular, después de soltar el dedo), así que se ignora el foco
        // que llega justo tras un puntero: de eso se encarga el clic.
        el.addEventListener('focus', function () {
            if (Date.now() - ultimoPuntero > 800 && i !== active) setActive(i, 'teclado');
        });
    });

    fan.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        setActive(e.key === 'ArrowRight' ? active + 1 : active - 1, 'teclado');
        cards[active].focus({ preventScroll: true });
    });

    if (cta) cta.addEventListener('click', function () {
        medir('fan_card_open', { card: cards[active].getAttribute('data-fan'), desde: 'boton' });
    });

    layout();
})();
