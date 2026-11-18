/*
 * CálculoLaboral · Controlador UI del Conector Claude (MCP) en /demo-contadores (Ola 3, v1.0.0)
 * Gestiona #dlg-mcp-claude y los disparadores (#btn-rep-abrir-mcp, #btn-torre-mcp, #btn-side-mcp)
 * contra /api/pyme/mcp-tokens en modo de solo lectura. Nunca persiste tokens en claro.
 */
(function () {
    'use strict';

    var Sii = window.CLSii;
    var D = window.DemoCL;
    if (!Sii) return;

    var api = Sii.crearClienteApi();
    var URL_MCP = 'https://connect.calculolaboral.cl/mcp';
    var PLACEHOLDER_TOKEN = '<TU_TOKEN_MCP>';

    var estado = {
        autenticado: false,
        configured: false,
        cargando: false
    };

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return D && D.esc ? D.esc(v) : String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function plantillaConfig(token) {
        return JSON.stringify({
            mcpServers: {
                'calculolaboral-sii': {
                    command: 'npx',
                    args: [
                        '-y',
                        'mcp-remote',
                        URL_MCP,
                        '--header',
                        'x-mcp-token:' + (token || PLACEHOLDER_TOKEN)
                    ]
                }
            }
        }, null, 2);
    }

    function feedback(texto, tipo) {
        var box = $('mcp-dlg-feedback');
        if (!box) return;
        if (!texto) {
            box.hidden = true;
            box.textContent = '';
            return;
        }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'error' ? 'error' : 'ok');
        box.textContent = texto;
    }

    function limpiarTokenTemporal() {
        var box = $('mcp-token-creado-box');
        var val = $('mcp-token-valor');
        var pre = $('mcp-config-json');
        if (val) val.textContent = '';
        if (box) box.hidden = true;
        if (pre) pre.textContent = plantillaConfig(PLACEHOLDER_TOKEN);
    }

    function fechaCorta(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    async function copiarTexto(texto, okMsg) {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(texto);
            } else {
                var ta = document.createElement('textarea');
                ta.value = texto;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            feedback(okMsg, 'ok');
            if (D && D.avisar) D.avisar(okMsg);
        } catch (e) {
            feedback('No pudimos copiar automáticamente. Selecciona el texto y usa Ctrl+C.', 'error');
        }
    }

    function pintarTokens(items) {
        var tbody = $('tbody-mcp-tokens');
        var vacio = $('mcp-tokens-vacio');
        var wrap = $('mcp-tokens-tabla-wrap');
        if (!tbody) return;
        var activos = (Array.isArray(items) ? items : []).filter(function (t) { return !t.revokedAt; });
        if (!activos.length) {
            tbody.innerHTML = '';
            if (vacio) vacio.hidden = false;
            if (wrap) wrap.hidden = true;
            return;
        }
        if (vacio) vacio.hidden = true;
        if (wrap) wrap.hidden = false;
        tbody.innerHTML = activos.map(function (t) {
            return '<tr>' +
                '<td><strong>' + esc(t.label || 'Token sin etiqueta') + '</strong></td>' +
                '<td class="mono">' + esc(t.prefix || 'smcp_live_...') + '</td>' +
                '<td class="mono">' + esc(fechaCorta(t.createdAt)) + '</td>' +
                '<td class="mono">' + esc(t.lastUsedAt ? fechaCorta(t.lastUsedAt) : 'Sin uso aún') + '</td>' +
                '<td class="num"><button type="button" class="btn-peligro-texto btn-mcp-revocar" data-mcp-revocar="' + esc(t.id) + '">Revocar</button></td>' +
                '</tr>';
        }).join('');
    }

    async function cargarEstadoYTokens() {
        var sinSes = $('mcp-dlg-sin-sesion');
        var noCfg = $('mcp-dlg-no-config');
        var cont = $('mcp-dlg-contenido-activo');
        estado.cargando = true;
        try {
            var rSes = await fetch('/api/pyme/sesion', { credentials: 'same-origin' });
            var jSes = rSes.ok ? await rSes.json().catch(function () { return {}; }) : {};
            estado.autenticado = Boolean(jSes && jSes.autenticado);
        } catch (e) {
            estado.autenticado = false;
        }

        if (!estado.autenticado) {
            if (sinSes) sinSes.hidden = false;
            if (noCfg) noCfg.hidden = true;
            if (cont) cont.hidden = true;
            estado.cargando = false;
            return;
        }

        try {
            var st = await api.configEstado();
            estado.configured = Boolean(st && st.configured);
        } catch (e2) {
            estado.configured = false;
        }

        if (!estado.configured) {
            if (sinSes) sinSes.hidden = true;
            if (noCfg) noCfg.hidden = false;
            if (cont) cont.hidden = true;
            estado.cargando = false;
            return;
        }

        if (sinSes) sinSes.hidden = true;
        if (noCfg) noCfg.hidden = true;
        if (cont) cont.hidden = false;

        try {
            var res = await api.listarTokensMcp();
            pintarTokens(res.items || []);
        } catch (err) {
            if (err && (err.status === 503 || err.codigo === 'sii_gateway_no_configurado')) {
                if (noCfg) noCfg.hidden = false;
                if (cont) cont.hidden = true;
            } else {
                feedback((err && err.message) || 'No pudimos cargar los tokens MCP.', 'error');
            }
        }
        estado.cargando = false;
    }

    async function abrirDialogoMcp() {
        var dlg = $('dlg-mcp-claude');
        if (!dlg) return;
        limpiarTokenTemporal();
        feedback('');
        if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
        else dlg.setAttribute('open', 'open');
        await cargarEstadoYTokens();
    }

    async function generarToken(ev) {
        if (ev) ev.preventDefault();
        var btn = $('btn-mcp-generar-token');
        var inp = $('mcp-token-label');
        var label = inp ? inp.value.trim() : '';
        feedback('');
        if (btn) btn.disabled = true;
        try {
            var res = await api.crearTokenMcp(label);
            var tk = (res && res.token) || {};
            var secreto = tk.token || '';
            if (secreto) {
                if ($('mcp-token-valor')) $('mcp-token-valor').textContent = secreto;
                if ($('mcp-token-creado-box')) $('mcp-token-creado-box').hidden = false;
                if ($('mcp-config-json')) $('mcp-config-json').textContent = plantillaConfig(secreto);
            }
            if (inp) inp.value = '';
            var lista = await api.listarTokensMcp();
            pintarTokens(lista.items || []);
            feedback('Token MCP generado. Cópialo ahora antes de cerrar esta ventana.', 'ok');
        } catch (err) {
            feedback((err && err.message) || 'No pudimos generar el token MCP.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function revocarToken(tokenId) {
        if (!tokenId) return;
        if (typeof window.confirm === 'function' && !window.confirm('¿Revocar este token MCP? Claude perderá el acceso de inmediato.')) return;
        feedback('');
        try {
            await api.revocarTokenMcp(tokenId);
            var lista = await api.listarTokensMcp();
            pintarTokens(lista.items || []);
            feedback('Token revocado correctamente.', 'ok');
        } catch (err) {
            feedback((err && err.message) || 'No pudimos revocar el token.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var dlg = $('dlg-mcp-claude');
        if (!dlg) return;

        ['btn-rep-abrir-mcp', 'btn-torre-mcp', 'btn-side-mcp'].forEach(function (id) {
            var b = $(id);
            if (b) b.addEventListener('click', abrirDialogoMcp);
        });

        function cerrar() {
            limpiarTokenTemporal();
            if (dlg.open && typeof dlg.close === 'function') dlg.close();
            else dlg.removeAttribute('open');
        }

        if ($('btn-cerrar-mcp-dlg')) $('btn-cerrar-mcp-dlg').addEventListener('click', cerrar);
        if ($('btn-mcp-listo')) $('btn-mcp-listo').addEventListener('click', cerrar);
        dlg.addEventListener('close', limpiarTokenTemporal);

        if ($('btn-mcp-ir-sesion')) {
            $('btn-mcp-ir-sesion').addEventListener('click', function () { window.open('/app', '_blank'); });
        }
        if ($('form-mcp-token')) {
            $('form-mcp-token').addEventListener('submit', generarToken);
        }
        if ($('btn-mcp-copiar-token')) {
            $('btn-mcp-copiar-token').addEventListener('click', function () {
                var val = $('mcp-token-valor') ? $('mcp-token-valor').textContent.trim() : '';
                if (val) copiarTexto(val, 'Token MCP copiado al portapapeles.');
            });
        }
        if ($('btn-mcp-copiar-url')) {
            $('btn-mcp-copiar-url').addEventListener('click', function () {
                copiarTexto(URL_MCP, 'URL del servidor MCP copiada.');
            });
        }
        if ($('btn-mcp-copiar-json')) {
            $('btn-mcp-copiar-json').addEventListener('click', function () {
                var pre = $('mcp-config-json') ? $('mcp-config-json').textContent : plantillaConfig(PLACEHOLDER_TOKEN);
                copiarTexto(pre, 'Configuración JSON para Claude Desktop copiada.');
            });
        }
        if ($('tbody-mcp-tokens')) {
            $('tbody-mcp-tokens').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-mcp-revocar]');
                if (btn) revocarToken(btn.getAttribute('data-mcp-revocar'));
            });
        }

        window.addEventListener('focus', function () {
            if (dlg.open && !estado.autenticado) cargarEstadoYTokens();
        });
    });

    window.CLDemoMcp = {
        abrirDialogoMcp: abrirDialogoMcp,
        cargarEstadoYTokens: cargarEstadoYTokens
    };
})();
