/*
 * CálculoLaboral · Vista autónoma del Portal Cliente Marca Blanca (/portal-estudio)
 * Solo lectura. Lee ?t=<token> desde /api/pyme/portal-estudio o ?preview=1 desde localStorage.
 */
(function () {
    'use strict';

    var LEYENDA_DEFECTO = 'Acceso de solo lectura e informativo. Esta vista contiene información tributaria y laboral confidencial puesta a disposición exclusivamente para el representante autorizado de la empresa cliente por su estudio contable (en calidad de encargado del tratamiento, Ley N° 21.719 y art. 154 ter del Código del Trabajo). Este enlace temporal y revocable no permite modificar datos ni constituye declaración oficial presentada ante el SII, Previred o la Dirección del Trabajo. Prohibida su difusión o reenvío a terceros no autorizados.';

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function money(n) {
        var v = Math.round(Number(n) || 0);
        var signo = v < 0 ? '-' : '';
        return signo + '$' + Math.abs(v).toLocaleString('es-CL');
    }

    function fechaCorta(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function mostrarError(titulo, desc, sello) {
        if ($('pe-estado-cargando')) $('pe-estado-cargando').hidden = true;
        if ($('pe-contenido')) $('pe-contenido').hidden = true;
        if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = true;
        if ($('pe-estado-error')) $('pe-estado-error').hidden = false;
        if ($('pe-error-sello') && sello) $('pe-error-sello').textContent = sello;
        if ($('pe-error-titulo') && titulo) $('pe-error-titulo').textContent = titulo;
        if ($('pe-error-desc') && desc) $('pe-error-desc').textContent = desc;
    }

    function pintarPortal(portal, esPreview) {
        if ($('pe-estado-cargando')) $('pe-estado-cargando').hidden = true;
        if ($('pe-estado-error')) $('pe-estado-error').hidden = true;
        if ($('pe-banner-preview')) $('pe-banner-preview').hidden = !esPreview;

        if (!portal || (!portal.f29 && !portal.pnl && !portal.laboral)) {
            if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = false;
            return;
        }
        if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = true;
        if ($('pe-contenido')) $('pe-contenido').hidden = false;

        var est = portal.estudio || {};
        var cli = portal.cliente || {};
        if ($('pe-estudio-nombre')) $('pe-estudio-nombre').textContent = est.nombre || 'Estudio Contable';
        if ($('pe-estudio-meta')) {
            var meta = [];
            if (est.rut) meta.push('RUT ' + est.rut);
            if (est.contador) meta.push(est.contador);
            $('pe-estudio-meta').textContent = meta.join(' · ');
        }
        if ($('pe-cliente-nombre')) $('pe-cliente-nombre').textContent = cli.nombre || 'Empresa Cliente';
        if ($('pe-cliente-rut')) $('pe-cliente-rut').textContent = cli.rut || 'Sin RUT';
        if ($('pe-periodo-badge')) $('pe-periodo-badge').textContent = cli.periodo || '';

        if (portal.f29 && $('pe-card-f29')) {
            $('pe-card-f29').hidden = false;
            if ($('pe-f29-estado')) {
                $('pe-f29-estado').textContent = cli.cerradoTributario ? 'Período cerrado' : 'Período abierto';
                $('pe-f29-estado').className = 'sello ' + (cli.cerradoTributario ? 'sello-emitida' : 'sello-preparada');
            }
            if ($('pe-f29-iva')) $('pe-f29-iva').textContent = money(portal.f29.ivaDeterminado);
            if ($('pe-f29-ret')) $('pe-f29-ret').textContent = money(portal.f29.retenciones);
            if ($('pe-f29-ppm')) $('pe-f29-ppm').textContent = money(portal.f29.ppm);
            if ($('pe-f29-total')) $('pe-f29-total').textContent = money(portal.f29.totalPagar);

            var notaF29 = $('pe-f29-nota');
            if (notaF29) {
                if (portal.f29.postergadoIva) {
                    notaF29.hidden = false;
                    notaF29.textContent = 'Postergación de IVA (Cód. 756) activa: ' + money(portal.f29.montoPostergado) + ' diferidos a 2 meses.';
                } else if (portal.f29.remanente > 0) {
                    notaF29.hidden = false;
                    notaF29.textContent = 'Remanente de crédito fiscal a favor (Cód. 77): ' + money(portal.f29.remanente) + '.';
                } else {
                    notaF29.hidden = true;
                }
            }

            var ul = $('pe-lista-vencimientos');
            if (ul) {
                var vencs = Array.isArray(portal.f29.vencimientos) ? portal.f29.vencimientos : [];
                ul.innerHTML = vencs.map(function (v) {
                    var cls = v.estado === 'vencido' || v.estado === 'critico' ? 'sello-riesgo' : (v.estado === 'proximo' ? 'sello-preparada' : 'sello-emitida');
                    return '<li class="preval-hallazgo-item">' +
                        '<span>' + esc(v.titulo) + '</span>' +
                        '<span class="sello ' + cls + ' mono">' + esc(v.fechaLimite) + '</span>' +
                        '</li>';
                }).join('');
            }
        }

        if (portal.pnl && $('pe-card-pnl')) {
            $('pe-card-pnl').hidden = false;
            if ($('pe-pnl-ingresos')) $('pe-pnl-ingresos').textContent = money(portal.pnl.ingresos);
            if ($('pe-pnl-costos')) $('pe-pnl-costos').textContent = money(portal.pnl.costos);
            if ($('pe-pnl-gastos')) $('pe-pnl-gastos').textContent = money(portal.pnl.gastos);
            if ($('pe-pnl-resultado')) $('pe-pnl-resultado').textContent = money(portal.pnl.resultado);
        }

        if (portal.laboral && $('pe-card-laboral')) {
            $('pe-card-laboral').hidden = false;
            if ($('pe-lab-cnt')) $('pe-lab-cnt').textContent = String(portal.laboral.cantidadTrabajadores || 0);
            if ($('pe-lab-haberes')) $('pe-lab-haberes').textContent = money(portal.laboral.totalHaberes);
            if ($('pe-lab-liquido')) $('pe-lab-liquido').textContent = money(portal.laboral.totalLiquido);
            if ($('pe-lab-costo')) $('pe-lab-costo').textContent = money(portal.laboral.totalCostoEmpresa);

            var trab = Array.isArray(portal.laboral.trabajadores) ? portal.laboral.trabajadores : [];
            var wrap = $('pe-lab-tabla-wrap');
            var tbody = $('tbody-pe-trabajadores');
            if (wrap && tbody && trab.length) {
                wrap.hidden = false;
                tbody.innerHTML = trab.map(function (t) {
                    return '<tr>' +
                        '<td><strong>' + esc(t.nombre) + '</strong></td>' +
                        '<td class="mono">' + esc(t.rut || '') + '</td>' +
                        '<td class="mono num">' + esc(t.dias) + '</td>' +
                        '<td class="mono num">' + money(t.haberes) + '</td>' +
                        '<td class="mono num"><strong>' + money(t.liquido) + '</strong></td>' +
                        '</tr>';
                }).join('');
            } else if (wrap) {
                wrap.hidden = true;
            }
        }

        if ($('pe-estudio-pie')) $('pe-estudio-pie').textContent = est.pie || 'Documento informativo emitido por tu estudio contable.';
        if ($('pe-leyenda-legal')) $('pe-leyenda-legal').textContent = portal.leyendaLegal || LEYENDA_DEFECTO;
        if ($('pe-vence-txt')) {
            $('pe-vence-txt').textContent = portal.vence ? ('Válido hasta: ' + fechaCorta(portal.vence)) : 'Vista previa';
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        var qs = new URLSearchParams(window.location.search || '');
        var preview = qs.get('preview') === '1';
        var token = (qs.get('t') || '').trim();

        if (preview) {
            try {
                var raw = window.localStorage.getItem('cl_portal_estudio_preview');
                if (!raw) {
                    mostrarError('No hay vista previa disponible', 'Abre Portal Cliente en /demo-contadores y pulsa Vista previa Marca Blanca.', 'Sin datos');
                    return;
                }
                pintarPortal(JSON.parse(raw), true);
            } catch (e) {
                mostrarError('No pudimos cargar la vista previa', 'Vuelve a generar la vista previa desde el panel del estudio.', 'Error local');
            }
            return;
        }

        if (!token) {
            mostrarError('Enlace incompleto', 'Falta el código de acceso en la dirección. Pide el enlace completo a tu estudio contable.', 'Enlace inválido');
            return;
        }

        try {
            var res = await fetch('/api/pyme/portal-estudio?t=' + encodeURIComponent(token), {
                headers: { accept: 'application/json' }
            });
            var json = await res.json().catch(function () { return {}; });
            if (!res.ok || json.ok === false) {
                var titulo = json.codigo === 'enlace_revocado'
                    ? 'Este enlace fue revocado'
                    : (json.codigo === 'enlace_vencido' ? 'Este enlace venció' : 'Enlace no disponible');
                mostrarError(titulo, json.error || 'Solicita un nuevo enlace a tu estudio contable.', 'Acceso cerrado');
                return;
            }
            pintarPortal(json.portal, false);
        } catch (err) {
            mostrarError('Error de conexión', 'No pudimos conectar con el servidor. Intenta nuevamente en unos minutos.', 'Sin conexión');
        }
    });
})();
