/*
 * CalculoLaboral · aviso antes de pagar
 * Antes de salir a Flow, el comprador confirma que entiende que el producto
 * es digital, de entrega inmediata y sin derecho a retracto (art. 3 bis letra b,
 * Ley 19.496). Cubre los enlaces a flow.cl/btn.php, las redirecciones hechas
 * desde JS con window.CLCheckout.go(url, opciones) y los kits, que crean el
 * pago en el servidor tras window.CLCheckout.confirm(alAceptar, opciones).
 */
(function () {
    'use strict';

    if (window.CLCheckout) return;

    var FLOW_LINK = /^https:\/\/www\.flow\.cl\/btn\.php\?token=/;
    var TERMS_URL = '/terminos#retracto';

    var CSS = '' +
        '.clc-dialog{border:0;padding:0;border-radius:18px;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);' +
        'color:#0f172a;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06),0 24px 48px -12px rgba(0,40,32,.28);font-family:inherit}' +
        '.clc-dialog::backdrop{background:rgba(0,38,31,.45)}' +
        '.clc-dialog[open]{animation:clc-in .18s cubic-bezier(.2,0,0,1)}' +
        '@keyframes clc-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
        '@media (prefers-reduced-motion:reduce){.clc-dialog[open]{animation:none}}' +
        '.clc-body{padding:22px 22px 18px}' +
        '.clc-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#00382E;background:#EEF6F3;' +
        'border:1px solid #D6EBE4;border-radius:999px;padding:3px 10px}' +
        '.clc-title{margin:12px 0 6px;font-size:19px;line-height:1.2;font-weight:700;letter-spacing:-.01em;text-wrap:balance}' +
        '.clc-lead{margin:0 0 14px;font-size:14px;line-height:1.5;color:#475569}' +
        '.clc-list{margin:0 0 16px;padding:0;list-style:none;display:grid;gap:8px}' +
        '.clc-list li{position:relative;padding-left:18px;font-size:13.5px;line-height:1.45;color:#334155}' +
        '.clc-list li:before{content:"";position:absolute;left:3px;top:.55em;width:6px;height:6px;border-radius:2px;background:#00382E}' +
        '.clc-check{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;' +
        'font-size:13.5px;line-height:1.45;color:#0f172a;transition:border-color .15s,background-color .15s}' +
        '.clc-check:hover{border-color:#ADD6C9}' +
        '.clc-check.clc-nudge{border-color:#FFB703;background:#FFF8E6}' +
        '.clc-check input{flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:#00382E;cursor:pointer}' +
        '.clc-check a{color:#0F5E4F;font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
        '.clc-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 22px 20px;flex-wrap:wrap-reverse}' +
        '.clc-btn{appearance:none;border:0;border-radius:12px;padding:11px 18px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;' +
        'transition:background-color .15s,opacity .15s,scale .15s}' +
        '.clc-btn:active{scale:.96}' +
        '.clc-btn:focus-visible{outline:2px solid #FFB703;outline-offset:2px}' +
        '.clc-ghost{background:#f1f5f9;color:#334155}' +
        '.clc-ghost:hover{background:#e2e8f0}' +
        '.clc-primary{background:#00382E;color:#fff!important}' +
        '.clc-primary:hover{background:#002820}' +
        '.clc-primary[aria-disabled="true"]{opacity:.45;cursor:not-allowed}' +
        '.clc-email{display:grid;gap:6px;margin:0 0 12px}' +
        '.clc-email label{font-size:13px;font-weight:600;color:#0f172a}' +
        '.clc-email input{font:inherit;font-size:16px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;color:#0f172a;background:#fff}' +
        '.clc-email input:focus{outline:2px solid #00382E;outline-offset:1px;border-color:#00382E}' +
        '.clc-email input[aria-invalid="true"]{border-color:#e11d48}' +
        '.clc-email small{font-size:12px;color:#64748b}' +
        '@media (max-width:420px){.clc-actions .clc-btn{flex:1 1 100%}}';

    var dialog, checkbox, label, confirmBtn, emailWrap, emailInput, pending = null;
    var EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

    function build() {
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        dialog = document.createElement('dialog');
        dialog.className = 'clc-dialog';
        dialog.setAttribute('aria-labelledby', 'clc-title');
        dialog.setAttribute('aria-describedby', 'clc-lead');
        dialog.innerHTML =
            '<div class="clc-body">' +
                '<span class="clc-kicker">Paso previo al pago</span>' +
                '<h2 class="clc-title" id="clc-title">Antes de ir a pagar</h2>' +
                '<p class="clc-lead" id="clc-lead">Estás comprando un producto digital que recibes de inmediato.</p>' +
                '<ul class="clc-list">' +
                    '<li>Por ser contenido digital de entrega inmediata, no aplica el derecho a retracto (art. 3 bis letra b, Ley 19.496).</li>' +
                    '<li>Si un archivo falla o no te llega, te lo reenviamos en un máximo de 24 horas hábiles.</li>' +
                    '<li>Son modelos de referencia basados en la normativa vigente; no reemplazan la asesoría de un abogado.</li>' +
                '</ul>' +
                '<div class="clc-email" hidden><label for="clc-email">Correo para el comprobante</label>' +
                    '<input type="email" id="clc-email" autocomplete="email" inputmode="email" placeholder="tu@empresa.cl">' +
                    '<small>Ahí te llega la confirmación del pago.</small></div>' +
                '<label class="clc-check"><input type="checkbox" id="clc-accept">' +
                    '<span>Leí estas condiciones y acepto los <a href="' + TERMS_URL + '" target="_blank" rel="noopener">Términos y condiciones</a>.</span>' +
                '</label>' +
            '</div>' +
            '<div class="clc-actions">' +
                '<button type="button" class="clc-btn clc-ghost" data-clc="cancel">Volver</button>' +
                '<button type="button" class="clc-btn clc-primary" data-clc="ok" aria-disabled="true">Continuar al pago</button>' +
            '</div>';
        document.body.appendChild(dialog);

        checkbox = dialog.querySelector('#clc-accept');
        label = dialog.querySelector('.clc-check');
        confirmBtn = dialog.querySelector('[data-clc="ok"]');
        emailWrap = dialog.querySelector('.clc-email');
        emailInput = dialog.querySelector('#clc-email');
        emailInput.addEventListener('input', function () { emailInput.removeAttribute('aria-invalid'); });

        checkbox.addEventListener('change', function () {
            confirmBtn.setAttribute('aria-disabled', checkbox.checked ? 'false' : 'true');
            if (checkbox.checked) label.classList.remove('clc-nudge');
        });
        confirmBtn.addEventListener('click', function () {
            if (!checkbox.checked) {
                // Se mantiene enfocable: al tocarlo sin aceptar, se resalta la casilla
                label.classList.add('clc-nudge');
                checkbox.focus();
                return;
            }
            var email = emailInput.value.trim();
            if (pending && pending.askEmail && !EMAIL_RE.test(email)) {
                emailInput.setAttribute('aria-invalid', 'true');
                emailInput.focus();
                return;
            }
            var job = pending;
            pending = null;
            dialog.close();
            if (job) job.onAccept(email);
        });
        dialog.querySelector('[data-clc="cancel"]').addEventListener('click', function () { dialog.close(); });
        dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
        dialog.addEventListener('close', function () {
            if (pending && typeof pending.onCancel === 'function') pending.onCancel();
            pending = null;
        });
    }

    /**
     * Muestra el aviso; si el comprador acepta, ejecuta onAccept(correo).
     * opciones: { onCancel: function, askEmail: boolean (pide el correo en el aviso) }
     */
    function confirm(onAccept, options) {
        options = options || {};
        if (!dialog) build();
        if (typeof dialog.showModal !== 'function') {
            // Navegadores sin <dialog>: confirmacion nativa con el mismo contenido
            var ok = window.confirm('Producto digital de entrega inmediata: no aplica el derecho a retracto ' +
                '(art. 3 bis letra b, Ley 19.496). ¿Aceptas los Términos y condiciones y continúas al pago?');
            var mail = options.askEmail ? (window.prompt('Correo para el comprobante:') || '').trim() : '';
            if (ok && (!options.askEmail || EMAIL_RE.test(mail))) onAccept(mail);
            else if (typeof options.onCancel === 'function') options.onCancel();
            return;
        }
        pending = { onAccept: onAccept, onCancel: options.onCancel, askEmail: !!options.askEmail };
        emailWrap.hidden = !options.askEmail;
        if (options.defaultEmail && !emailInput.value) emailInput.value = options.defaultEmail;
        emailInput.removeAttribute('aria-invalid');
        checkbox.checked = false;
        confirmBtn.setAttribute('aria-disabled', 'true');
        label.classList.remove('clc-nudge');
        if (!dialog.open) dialog.showModal();
        if (options.askEmail) emailInput.focus(); else checkbox.focus();
    }

    /** Muestra el aviso y, si el comprador acepta, abre el pago. opciones: { newTab, onCancel } */
    function go(url, options) {
        options = options || {};
        confirm(function () {
            if (options.newTab) window.open(url, '_blank', 'noopener');
            else window.location.href = url;
        }, options);
    }

    function onLinkClick(e) {
        if (e.defaultPrevented || (e.type === 'auxclick' && e.button !== 1)) return;
        // Botones de compra declarativos: <button data-clc-buy="informe">
        var buy = e.target.closest && e.target.closest('[data-clc-buy]');
        if (buy && e.type === 'click') {
            e.preventDefault();
            buyKit(buy.getAttribute('data-clc-buy'), {}, { askEmail: true });
            return;
        }
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || !FLOW_LINK.test(a.href)) return;
        e.preventDefault();
        var newTab = a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
        go(a.href, { newTab: newTab });
    }

    document.addEventListener('click', onLinkClick, true);
    document.addEventListener('auxclick', onLinkClick, true);

    /**
     * Compra (kit o generador): aviso, pago creado en el servidor (/api/checkout) y salida a Flow.
     * buyer: { email, nombre, empresa, telefono, rubro }
     * opciones: { onAccept, onCancel, onError(mensaje), askEmail (si buyer no trae correo), defaultEmail }
     */
    function buyKit(product, buyer, options) {
        options = options || {};
        function fail(message) {
            message = message || 'No pudimos conectar con Flow. Intenta de nuevo en unos minutos.';
            if (typeof options.onError === 'function') options.onError(message);
            else window.alert(message);
        }
        confirm(function (email) {
            if (typeof options.onAccept === 'function') options.onAccept();
            var payload = { product: product };
            for (var k in buyer) if (Object.prototype.hasOwnProperty.call(buyer, k)) payload[k] = buyer[k];
            if (options.askEmail) payload.email = email;
            fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function (r) {
                return r.json().then(function (data) { return { ok: r.ok, data: data }; });
            }).then(function (res) {
                if (res.ok && res.data.url) window.location.href = res.data.url;
                else fail(res.data && res.data.error);
            }).catch(function () { fail(); });
        }, { onCancel: options.onCancel, askEmail: options.askEmail, defaultEmail: options.defaultEmail });
    }

    /*
     * Desbloqueo de generadores. Al volver de Flow la URL trae ?p=&o=&e=&sig= firmados por
     * el servidor; /api/unlock los valida y se guardan hasta que vencen (48 h).
     * El documento se arma en el navegador, asi que esto cierra el desbloqueo por URL
     * (?pago=exito), no protege contra quien edite el codigo de la pagina.
     */
    function storedUnlock(product) {
        try {
            var u = JSON.parse(localStorage.getItem('cl_unlock_' + product) || 'null');
            if (u && u.p === product && u.expiresAt > Date.now()) return u;
            localStorage.removeItem('cl_unlock_' + product);
        } catch (e) {}
        return null;
    }

    function unlockFromUrl(product) {
        var q = new URLSearchParams(window.location.search);
        if (q.get('p') !== product || !q.get('sig')) return Promise.resolve(storedUnlock(product));
        var u = { p: product, o: q.get('o'), e: q.get('e'), sig: q.get('sig') };
        ['p', 'o', 'e', 'sig'].forEach(function (k) { q.delete(k); });
        try {
            var rest = q.toString();
            window.history.replaceState({}, document.title, window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
        } catch (e) {}
        return fetch('/api/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u)
        }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            if (!d || !d.ok) return storedUnlock(product);
            u.expiresAt = d.expiresAt;
            try { localStorage.setItem('cl_unlock_' + product, JSON.stringify(u)); } catch (e) {}
            return u;
        }).catch(function () { return storedUnlock(product); });
    }

    window.CLCheckout = { go: go, confirm: confirm, buyKit: buyKit, unlockFromUrl: unlockFromUrl, storedUnlock: storedUnlock };
})();
