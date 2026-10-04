/*
 * CalculoLaboral · descarga del pack gratuito Ley Karin a cambio del correo
 * Envía el lead a /api/send-lead (tipo ProtocoloKarin) y entrega los enlaces de descarga.
 */
(function () {
    'use strict';

    var form = document.getElementById('lead-karin');
    if (!form) return;

    var BASE = '/descargas/';
    var PACK = 'Pack_Ley_Karin_Basico_2026.zip';
    var DOCS = [
        ['01_Estructura_Protocolo_Ley_Karin_2026.docx', 'Estructura del protocolo (para completar)'],
        ['02_Formulario_Recepcion_Denuncia_Ley_Karin_2026.docx', 'Formulario de recepción de denuncia'],
        ['03_Comprobante_Entrega_Protocolo_Ley_Karin_2026.docx', 'Comprobante de entrega al trabajador']
    ];
    var renderedAt = Date.now();
    var error = form.querySelector('.cl-lead__error');
    var ok = document.getElementById('lead-karin-ok');
    var btn = form.querySelector('button[type="submit"]');

    function medir(evento, params) {
        if (typeof window.gtag === 'function') window.gtag('event', evento, params || {});
    }

    function mostrarError(msg) {
        error.textContent = msg;
        error.hidden = false;
    }

    function entregar(correoEnviado) {
        var lista = DOCS.map(function (d) {
            return '<li><a href="' + BASE + d[0] + '" download>' + d[1] + ' (.docx)</a></li>';
        }).join('');
        ok.innerHTML =
            '<strong>' + (correoEnviado ? 'Listo, también te lo enviamos por correo.' : 'Tu descarga está lista.') + '</strong>' +
            '<p style="margin:6px 0 8px">Si la descarga no empezó sola, usa estos enlaces:</p>' +
            '<p style="margin:0 0 6px"><a href="' + BASE + PACK + '" download><strong>Descargar los 3 documentos (.zip)</strong></a></p>' +
            '<ul style="margin:0;padding-left:18px">' + lista + '</ul>';
        form.hidden = true;
        ok.hidden = false;
        ok.focus();
        var a = document.createElement('a');
        a.href = BASE + PACK;
        a.download = PACK;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        error.hidden = true;
        var nombre = form.nombre.value.trim();
        var correo = form.correo.value.trim();
        if (!nombre || !correo) return mostrarError('Completa tu nombre y correo.');
        if (!form.consentimiento.checked) return mostrarError('Debes aceptar la política de privacidad.');

        btn.disabled = true;
        var empresa = form.empresa.value.trim();
        fetch('/api/send-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                correo: correo,
                tipo: 'ProtocoloKarin',
                fuente: 'Guía Protocolo Ley Karin (Pack Word)',
                detalle: empresa ? 'Empresa / Pyme: ' + empresa : 'Descarga pack Ley Karin básico',
                website: form.website.value,
                form_rendered_at: renderedAt
            })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
            });
        }).then(function () {
            medir('generate_lead', { currency: 'CLP', value: 0, lead_type: 'ProtocoloKarin_Word' });
            entregar(true);
        }).catch(function (err) {
            btn.disabled = false;
            medir('lead_error', { lead_type: 'ProtocoloKarin_Word', motivo: String(err.message).slice(0, 80) });
            if (/correo|corporativo/i.test(err.message)) return mostrarError(err.message);
            entregar(false);
        });
    });
})();
