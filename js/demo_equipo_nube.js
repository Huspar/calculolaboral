/*
 * CálculoLaboral · Sincronización automática en la nube y Multiusuario por Estudio (/demo-contadores)
 * Conecta #cloud-sync-pill, #estudio-selector, #estudio-selector-side y #dlg-equipo-estudio
 * con /api/pyme/sesion, /api/pyme/estudio y /api/pyme/equipo (header X-CL-Estudio).
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var K_ESTUDIO = 'cl-estudio-activo';
    var K_CLIENTES = 'cl-clientes-liq';
    var K_HISTORIAL = 'cl-historial-liq';
    var K_SUITE = 'cl-suite-contable';

    var estado = {
        autenticado: false,
        email: '',
        rol: 'titular',
        estudios: [],
        estudioActivo: '',
        subiendo: false,
        pendiente: false,
        timer: null,
        ultimoError: ''
    };

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return D && D.esc ? D.esc(v) : String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function estudioActivoId() {
        try { return String(window.localStorage.getItem(K_ESTUDIO) || '').trim(); }
        catch (e) { return ''; }
    }

    function fijarEstudioActivo(id) {
        estado.estudioActivo = String(id || '').trim();
        try {
            if (estado.estudioActivo) window.localStorage.setItem(K_ESTUDIO, estado.estudioActivo);
            else window.localStorage.removeItem(K_ESTUDIO);
        } catch (e) { }
    }

    function headersApi(esEscritura) {
        var h = { accept: 'application/json' };
        var estId = estudioActivoId();
        if (estId) h['x-cl-estudio'] = estId;
        if (esEscritura) {
            h['content-type'] = 'application/json';
            h['x-cl-pyme'] = '1';
        }
        return h;
    }

    function pintarPillNube(modo, detalle) {
        var pill = $('cloud-sync-pill');
        if (!pill) return;
        var ic = pill.querySelector('.material-icons');
        var txt = pill.querySelector('.cloud-sync-txt');
        if (modo === 'ok') {
            pill.className = 'cloud-sync-pill ok';
            if (ic) ic.textContent = 'cloud_done';
            if (txt) txt.textContent = 'Nube al día';
            pill.setAttribute('aria-label', 'Nube al día. Clic para sincronizar ahora.');
        } else if (modo === 'sync') {
            pill.className = 'cloud-sync-pill sync';
            if (ic) ic.textContent = 'sync';
            if (txt) txt.textContent = 'Guardando...';
            pill.setAttribute('aria-label', 'Guardando cambios en la nube');
        } else if (modo === 'err') {
            pill.className = 'cloud-sync-pill err';
            if (ic) ic.textContent = 'cloud_off';
            if (txt) txt.textContent = 'Reintentar';
            pill.setAttribute('aria-label', detalle || 'Error al sincronizar. Clic para reintentar.');
        } else {
            pill.className = 'cloud-sync-pill';
            if (ic) ic.textContent = 'cloud_queue';
            if (txt) txt.textContent = 'Solo local';
            pill.setAttribute('aria-label', 'Modo local sin sesión. Clic para iniciar sesión.');
        }
        if (ic) ic.classList.toggle('sii-spin', modo === 'sync');
    }

    function pintarSelectoresEstudio() {
        var lista = estado.estudios || [];
        var mostrar = estado.autenticado && lista.length > 1;
        var opcionesHtml = lista.map(function (e) {
            var etiqueta = (e.propio ? 'Mi estudio (' : 'Equipo: ') + (e.titular || e.estudioId) + (e.propio ? ')' : (' · ' + e.rol));
            return '<option value="' + esc(e.estudioId) + '"' + (e.estudioId === estado.estudioActivo ? ' selected' : '') + '>' + esc(etiqueta) + '</option>';
        }).join('');

        ['estudio-selector', 'estudio-selector-side'].forEach(function (id) {
            var sel = $(id);
            if (!sel) return;
            sel.hidden = !mostrar;
            if (mostrar) sel.innerHTML = opcionesHtml;
        });

        var estActual = lista.filter(function (x) { return x.estudioId === estado.estudioActivo; })[0];
        var disp = $('study-name-display');
        if (disp && estActual && !estActual.propio && estActual.titular) {
            disp.textContent = 'Estudio ' + estActual.titular;
        }
    }

    function almacenLocalVacio() {
        try {
            var suiteRaw = window.localStorage.getItem(K_SUITE);
            var cliRaw = window.localStorage.getItem(K_CLIENTES);
            var suiteObj = suiteRaw ? JSON.parse(suiteRaw) : {};
            var cliArr = cliRaw ? JSON.parse(cliRaw) : [];
            var hasSuite = suiteObj && typeof suiteObj === 'object' && Object.keys(suiteObj).length > 0;
            var hasCli = Array.isArray(cliArr) && cliArr.length > 0;
            return !hasSuite && !hasCli;
        } catch (e) {
            return true;
        }
    }

    function limpiarAlmacenLocal() {
        try {
            window.localStorage.setItem(K_SUITE, '{}');
            window.localStorage.setItem(K_CLIENTES, '[]');
            window.localStorage.setItem(K_HISTORIAL, '{}');
        } catch (e) { }
    }

    function aplicarDatosNubeLocal(datos) {
        if (!datos || !window.CLRespaldo) return false;
        var res = window.CLRespaldo.crear(window.localStorage).importar(JSON.stringify(datos));
        if (window.CLDemoLiquidaciones && typeof window.CLDemoLiquidaciones.refrescarTrasImportar === 'function') {
            window.CLDemoLiquidaciones.refrescarTrasImportar();
        }
        if (window.CLSuiteSiiBridge && typeof window.CLSuiteSiiBridge.refrescarTodo === 'function') {
            window.CLSuiteSiiBridge.refrescarTodo();
        }
        return res;
    }

    async function bajarDesdeNube(opciones) {
        var o = opciones || {};
        if (!estado.autenticado) return false;
        pintarPillNube('sync');
        try {
            var res = await fetch('/api/pyme/estudio', {
                credentials: 'same-origin',
                headers: headersApi(false)
            });
            var json = await res.json().catch(function () { return {}; });
            if (!res.ok || json.ok === false) {
                throw new Error(json.error || 'No pudimos leer el estudio desde la nube.');
            }
            if (json.rol) estado.rol = json.rol;
            if (o.reemplazar) limpiarAlmacenLocal();
            if (json.datos) {
                aplicarDatosNubeLocal(json.datos);
                if (!o.silencioso && D && D.avisar) D.avisar('Cartera sincronizada desde la nube.');
            } else if (o.reemplazar) {
                if (window.CLDemoLiquidaciones && typeof window.CLDemoLiquidaciones.refrescarTrasImportar === 'function') {
                    window.CLDemoLiquidaciones.refrescarTrasImportar();
                }
                if (window.CLSuiteSiiBridge && typeof window.CLSuiteSiiBridge.refrescarTodo === 'function') {
                    window.CLSuiteSiiBridge.refrescarTodo();
                }
            }
            pintarPillNube('ok');
            return true;
        } catch (err) {
            estado.ultimoError = (err && err.message) || 'Error de conexión';
            pintarPillNube('err', estado.ultimoError);
            if (!o.silencioso && D && D.avisar) D.avisar(estado.ultimoError);
            return false;
        }
    }

    async function subirAhora(silencioso) {
        if (!estado.autenticado || !window.CLRespaldo) return false;
        if (estado.rol === 'lectura') {
            pintarPillNube('ok');
            return false;
        }
        if (estado.subiendo) {
            estado.pendiente = true;
            return false;
        }
        var payload;
        try {
            payload = JSON.parse(window.CLRespaldo.crear(window.localStorage).exportar());
        } catch (e) {
            if (!silencioso && D && D.avisar) D.avisar('No se pudo preparar el respaldo.');
            return false;
        }

        estado.subiendo = true;
        pintarPillNube('sync');
        try {
            var res = await fetch('/api/pyme/estudio', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: headersApi(true),
                body: JSON.stringify({ datos: payload })
            });
            var json = await res.json().catch(function () { return {}; });
            if (!res.ok || json.ok === false) {
                throw new Error(json.error || 'No se pudo guardar en la nube.');
            }
            estado.ultimoError = '';
            pintarPillNube('ok');
            if (!silencioso && D && D.avisar) D.avisar('Estudio guardado en tu cuenta.');
            return true;
        } catch (err) {
            estado.ultimoError = (err && err.message) || 'No se pudo guardar en la nube.';
            pintarPillNube('err', estado.ultimoError);
            if (!silencioso && D && D.avisar) D.avisar(estado.ultimoError);
            return false;
        } finally {
            estado.subiendo = false;
            if (estado.pendiente) {
                estado.pendiente = false;
                programarSubida();
            }
        }
    }

    function programarSubida() {
        if (!estado.autenticado || estado.rol === 'lectura') return;
        if (estado.timer) clearTimeout(estado.timer);
        pintarPillNube('sync');
        estado.timer = setTimeout(function () {
            estado.timer = null;
            subirAhora(true);
        }, 2000);
    }

    async function revisarSesion() {
        try {
            var res = await fetch('/api/pyme/sesion', { credentials: 'same-origin', headers: { accept: 'application/json' } });
            var j = res.ok ? await res.json().catch(function () { return {}; }) : {};
            estado.autenticado = Boolean(j && j.autenticado);
            estado.email = (j && j.email) || '';
            estado.estudios = (j && Array.isArray(j.estudios)) ? j.estudios : [];
        } catch (e) {
            estado.autenticado = false;
            estado.email = '';
            estado.estudios = [];
        }

        var cuentaEl = $('cuenta-estado');
        var btnEntrar = $('btn-entrar');
        if (cuentaEl) {
            cuentaEl.textContent = estado.autenticado ? estado.email : 'sin sesión';
            cuentaEl.classList.toggle('con-sesion', estado.autenticado);
        }
        if (btnEntrar) btnEntrar.hidden = estado.autenticado;

        if (!estado.autenticado) {
            fijarEstudioActivo('');
            pintarSelectoresEstudio();
            pintarPillNube('local');
            return;
        }

        if (estado.estudios.length > 1) {
            var saved = estudioActivoId();
            var match = estado.estudios.filter(function (x) { return x.estudioId === saved; })[0];
            if (!match) match = estado.estudios.filter(function (x) { return x.propio; })[0] || estado.estudios[0];
            fijarEstudioActivo(match.estudioId);
            estado.rol = match.rol || 'titular';
        } else {
            fijarEstudioActivo('');
            estado.rol = 'titular';
        }

        pintarSelectoresEstudio();
        if (almacenLocalVacio()) {
            await bajarDesdeNube({ silencioso: true, reemplazar: false });
        } else {
            pintarPillNube('ok');
        }
    }

    async function cambiarEstudio(nuevoId) {
        var id = String(nuevoId || '').trim();
        if (!id || id === estado.estudioActivo) return;
        fijarEstudioActivo(id);
        var match = (estado.estudios || []).filter(function (x) { return x.estudioId === id; })[0];
        estado.rol = match ? (match.rol || 'contador') : 'titular';
        pintarSelectoresEstudio();
        await bajarDesdeNube({ silencioso: false, reemplazar: true });
        document.dispatchEvent(new CustomEvent('demo:estudio-cambiado', { detail: { estudioId: id } }));
    }

    // ---------- Modal Equipo del Estudio (#dlg-equipo-estudio) ----------
    var ROLES_LABELS = {
        titular: 'Titular',
        admin: 'Administrador',
        contador: 'Contador',
        asistente: 'Asistente',
        lectura: 'Solo lectura'
    };

    function feedbackEquipo(texto, tipo) {
        var box = $('equipo-dlg-feedback');
        if (!box) return;
        if (!texto) { box.hidden = true; box.textContent = ''; return; }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'error' ? 'error' : 'ok');
        box.textContent = texto;
    }

    async function cargarEquipoModal() {
        var sinSes = $('equipo-dlg-sin-sesion');
        var form = $('form-equipo-invitar');
        var tbody = $('tbody-equipo-miembros');
        var cupo = $('equipo-cupo-badge');
        var vacio = $('equipo-vacio-nota');
        var btnInv = $('btn-equipo-invitar');

        if (!estado.autenticado) {
            if (sinSes) sinSes.hidden = false;
            if (form) form.hidden = true;
            if (tbody) tbody.innerHTML = '';
            if (cupo) cupo.textContent = '1 de 5 miembros';
            if (vacio) vacio.hidden = true;
            return;
        }
        if (sinSes) sinSes.hidden = true;
        if (form) form.hidden = false;
        feedbackEquipo('');

        try {
            var res = await fetch('/api/pyme/equipo', { credentials: 'same-origin', headers: headersApi(false) });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.ok === false) {
                if (res.status === 403) {
                    if (form) form.hidden = true;
                    feedbackEquipo('Solo el titular o administrador de este estudio puede gestionar el equipo.', 'error');
                    return;
                }
                throw new Error(data.error || 'No pudimos cargar el equipo.');
            }
            var miembros = Array.isArray(data.miembros) ? data.miembros : [];
            var maxP = Number(data.maximo) || 5;
            var totalPersonas = 1 + miembros.length;
            if (cupo) cupo.textContent = totalPersonas + ' de ' + maxP + ' miembros';
            if (btnInv) btnInv.disabled = totalPersonas >= maxP;
            if (vacio) vacio.hidden = miembros.length > 0;

            var selRol = $('equipo-inv-rol');
            if (selRol && Array.isArray(data.rolesQueSePuedenDar)) {
                var puedeAdmin = data.rolesQueSePuedenDar.indexOf('admin') >= 0;
                Array.prototype.forEach.call(selRol.options, function (opt) {
                    if (opt.value === 'admin') opt.disabled = !puedeAdmin;
                });
            }

            if (tbody) {
                tbody.innerHTML = miembros.map(function (m) {
                    var estadoCls = m.ultimoAcceso ? 'sello-emitida' : 'sello-preparada';
                    var estadoTxt = m.ultimoAcceso ? 'Activo' : 'Invitado';
                    return '<tr>' +
                        '<td><strong>' + esc(m.email) + '</strong></td>' +
                        '<td>' + esc(ROLES_LABELS[m.rol] || m.rol) + '</td>' +
                        '<td><span class="sello ' + estadoCls + '">' + estadoTxt + '</span></td>' +
                        '<td class="num"><button type="button" class="btn-peligro-texto" data-equipo-quitar="' + esc(m.id) + '">Quitar</button></td>' +
                        '</tr>';
                }).join('');
            }
        } catch (err) {
            feedbackEquipo((err && err.message) || 'No pudimos cargar la lista del equipo.', 'error');
        }
    }

    async function invitarMiembro(ev) {
        if (ev) ev.preventDefault();
        var emailEl = $('equipo-inv-email');
        var rolEl = $('equipo-inv-rol');
        var btnInv = $('btn-equipo-invitar');
        var email = emailEl ? emailEl.value.trim() : '';
        var rol = rolEl ? rolEl.value : 'contador';
        if (!email) {
            feedbackEquipo('Escribe el correo electrónico del colega.', 'error');
            if (emailEl) emailEl.focus();
            return;
        }

        feedbackEquipo('');
        if (btnInv) btnInv.disabled = true;
        try {
            // Consultar si hay empresas en /app; si no hay ninguna, usar alcance:'suite'
            var estRes = await fetch('/api/pyme/estado', { credentials: 'same-origin', headers: headersApi(false) });
            var estJson = estRes.ok ? await estRes.json().catch(function () { return {}; }) : {};
            var empresasIds = Array.isArray(estJson.empresas) ? estJson.empresas.map(function (x) { return x.id; }).filter(Boolean) : [];
            var body = { email: email, rol: rol, empresas: empresasIds };
            if (!empresasIds.length) body.alcance = 'suite';

            var res = await fetch('/api/pyme/equipo', {
                method: 'POST',
                credentials: 'same-origin',
                headers: headersApi(true),
                body: JSON.stringify(body)
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.ok === false) {
                throw new Error(data.error || 'No pudimos invitar a esa persona.');
            }
            if (emailEl) emailEl.value = '';
            feedbackEquipo('Invitación registrada. Tu colega podrá entrar en /app o /demo-contadores usando su correo ' + email + '.', 'ok');
            await cargarEquipoModal();
        } catch (err) {
            feedbackEquipo((err && err.message) || 'No pudimos invitar a ese usuario.', 'error');
        } finally {
            if (btnInv) btnInv.disabled = false;
        }
    }

    async function quitarMiembro(id) {
        if (!id) return;
        if (typeof window.confirm === 'function' && !window.confirm('¿Quitar a este integrante del estudio? Perderá acceso inmediato.')) return;
        try {
            var res = await fetch('/api/pyme/equipo?id=' + encodeURIComponent(id), {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: headersApi(true),
                body: JSON.stringify({})
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.ok === false) throw new Error(data.error || 'No pudimos quitar al miembro.');
            feedbackEquipo('Miembro quitado del estudio.', 'ok');
            await cargarEquipoModal();
        } catch (err) {
            feedbackEquipo((err && err.message) || 'Error al quitar miembro.', 'error');
        }
    }

    function abrirModalEquipo() {
        var dlg = $('dlg-equipo-estudio');
        if (!dlg) return;
        if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
        else dlg.setAttribute('open', 'open');
        cargarEquipoModal();
    }

    document.addEventListener('DOMContentLoaded', function () {
        revisarSesion();

        var pill = $('cloud-sync-pill');
        if (pill) {
            pill.addEventListener('click', function () {
                if (!estado.autenticado) {
                    window.open('/app', '_blank');
                    return;
                }
                subirAhora(false);
            });
        }

        ['estudio-selector', 'estudio-selector-side'].forEach(function (id) {
            var sel = $(id);
            if (sel) {
                sel.addEventListener('change', function () {
                    cambiarEstudio(sel.value);
                });
            }
        });

        var dlg = $('dlg-equipo-estudio');
        function cerrarDlgEquipo() {
            if (!dlg) return;
            if (dlg.open && typeof dlg.close === 'function') dlg.close();
            else dlg.removeAttribute('open');
        }
        if ($('btn-equipo-estudio')) $('btn-equipo-estudio').addEventListener('click', abrirModalEquipo);
        if ($('btn-cerrar-equipo-dlg')) $('btn-cerrar-equipo-dlg').addEventListener('click', cerrarDlgEquipo);
        if ($('btn-equipo-listo')) $('btn-equipo-listo').addEventListener('click', cerrarDlgEquipo);
        if ($('btn-equipo-ir-sesion')) $('btn-equipo-ir-sesion').addEventListener('click', function () { window.open('/app', '_blank'); });
        if ($('form-equipo-invitar')) $('form-equipo-invitar').addEventListener('submit', invitarMiembro);
        if ($('tbody-equipo-miembros')) {
            $('tbody-equipo-miembros').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-equipo-quitar]');
                if (btn) quitarMiembro(btn.getAttribute('data-equipo-quitar'));
            });
        }

        window.addEventListener('focus', function () {
            if (!estado.autenticado) revisarSesion();
        });
    });

    window.CLSuiteNube = {
        programarSubida: programarSubida,
        subirAhora: subirAhora,
        bajarDesdeNube: bajarDesdeNube,
        revisarSesion: revisarSesion,
        estudioActivoId: estudioActivoId
    };
})();
