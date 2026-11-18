/*
 * CalculoLaboral · Controlador UI del Conector SII Automático en /demo-contadores (v1.0.0)
 * Conecta #suite-context-bar, #suite-torre, #suite-f29, #suite-importador y #dlg-sii-conexion
 * con /api/pyme/sii-* usando window.CLSii y window.CLSuiteSiiBridge.
 * Seguridad: nunca guarda claves tributarias ni certificados .pfx en localStorage.
 */
(function () {
    'use strict';

    var K_RUTS = 'cl-clientes-rut';
    var Sii = window.CLSii;
    var D = window.DemoCL;
    var Imp = window.CLImportadores;
    if (!Sii) return;

    var api = Sii.crearClienteApi();
    var tiendaVinculos = Sii.crearTiendaVinculos(window.localStorage);

    var sesion = {
        autenticado: false,
        email: '',
        gatewayConfigured: false,
        verificada: false
    };

    var syncEnCurso = {
        activo: false,
        clienteKey: '',
        mensaje: '',
        error: ''
    };

    var batchSync = {
        activo: false,
        total: 0,
        completadas: 0,
        empresaActual: '',
        estadosPorCompany: {}
    };

    var modalState = {
        metodo: 'CLAVE_TRIBUTARIA',
        clienteNombre: ''
    };

    function $(id) { return document.getElementById(id); }

    function bridge() { return window.CLSuiteSiiBridge || null; }

    function leerMapaRuts() {
        try {
            var raw = window.localStorage.getItem(K_RUTS);
            var obj = raw ? JSON.parse(raw) : {};
            return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
        } catch (e) { return {}; }
    }

    function guardarRutCliente(nombreCliente, rut) {
        var k = String(nombreCliente || '').trim().toLowerCase();
        if (!k) return '';
        var limpio = String(rut || '').trim();
        var formateado = limpio ? Sii.normalizarRut(limpio) : '';
        var mapa = leerMapaRuts();
        if (formateado) mapa[k] = formateado;
        else delete mapa[k];
        try { window.localStorage.setItem(K_RUTS, JSON.stringify(mapa)); } catch (e) { }
        return formateado;
    }

    function rutDeCliente(nombreCliente) {
        var k = String(nombreCliente || '').trim().toLowerCase();
        if (!k) return '';
        var v = tiendaVinculos.obtener(k);
        if (v && v.rut) return v.rut;
        var mapa = leerMapaRuts();
        if (mapa[k]) return mapa[k];
        var br = bridge();
        if (br && br.clienteClave() === k && $('liq-rut-empresa') && $('liq-rut-empresa').value.trim()) {
            return Sii.normalizarRut($('liq-rut-empresa').value.trim());
        }
        return '';
    }

    function clienteActivoNombre() {
        var br = bridge();
        if (br) return br.clienteNombre();
        var el = $('liq-cliente');
        return (el && el.value.trim()) || 'Panadería San Isidro SpA';
    }

    function vinculoDeCliente(nombreCliente) {
        var nom = nombreCliente || clienteActivoNombre();
        var v = tiendaVinculos.obtener(nom);
        if (v) return v;
        var rut = rutDeCliente(nom);
        if (!rut) return null;
        var todos = tiendaVinculos.listar();
        var rutNorm = Sii.normalizarRut(rut);
        var keys = Object.keys(todos);
        for (var i = 0; i < keys.length; i++) {
            if (todos[keys[i]] && todos[keys[i]].rut === rutNorm) return todos[keys[i]];
        }
        return null;
    }

    function estadoVisualCliente(nombreCliente) {
        var nom = nombreCliente || clienteActivoNombre();
        var k = nom.toLowerCase();
        var vinculo = vinculoDeCliente(nom);

        if (syncEnCurso.activo && syncEnCurso.clienteKey === k) {
            return { codigo: 'sincronizando', sello: 'Sincronizando...', pill: 'Sincronizando...', icono: 'sync', spin: true, vinculo: vinculo };
        }
        if (syncEnCurso.error && syncEnCurso.clienteKey === k) {
            return { codigo: 'error', sello: 'Revisar credencial', pill: 'SII: Revisar', icono: 'error_outline', spin: false, vinculo: vinculo };
        }
        if (vinculo && vinculo.lastErrorCode) {
            return { codigo: 'error', sello: 'Revisar credencial', pill: 'SII: Revisar', icono: 'error_outline', spin: false, vinculo: vinculo };
        }
        if (vinculo && vinculo.hasCredentials) {
            return { codigo: 'conectado', sello: 'SII Conectado', pill: 'SII: Conectado', icono: 'cloud_done', spin: false, vinculo: vinculo };
        }
        if (sesion.verificada && !sesion.autenticado) {
            return { codigo: 'sin_sesion', sello: 'Sesión requerida', pill: 'SII: Sesión', icono: 'account_circle', spin: false, vinculo: vinculo };
        }
        if (sesion.autenticado && !sesion.gatewayConfigured) {
            return { codigo: 'sin_configurar', sello: 'Conector en espera', pill: 'SII: En espera', icono: 'construction', spin: false, vinculo: vinculo };
        }
        return { codigo: 'local', sello: 'Modo CSV local', pill: 'SII: Modo CSV', icono: 'folder_open', spin: false, vinculo: vinculo };
    }

    function formatearFechaHora(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }

    function pintarContextBar() {
        var nom = clienteActivoNombre();
        var rut = rutDeCliente(nom);
        var inpRut = $('liq-rut');
        if (inpRut && document.activeElement !== inpRut && inpRut.value !== rut) {
            inpRut.value = rut;
        }
        var chipRut = $('ctx-rut-display');
        if (chipRut) {
            chipRut.textContent = rut || 'Sin RUT';
            chipRut.classList.toggle('sin-rut', !rut);
        }
        var inpLre = $('liq-rut-empresa');
        if (inpLre && rut && !inpLre.value.trim()) {
            inpLre.value = rut;
        }

        var est = estadoVisualCliente(nom);
        var pill = $('btn-ctx-sii-estado');
        var btnSync = $('btn-ctx-sii-sync');
        if (pill) {
            pill.className = 'sii-pill-estado' +
                (est.codigo === 'conectado' ? ' sii-pill-conectado' :
                    est.codigo === 'sincronizando' ? ' sii-pill-sync' :
                        est.codigo === 'error' ? ' sii-pill-error' :
                            (est.codigo === 'sin_sesion' || est.codigo === 'sin_configurar') ? ' sii-pill-aviso' : '');
            var ic = pill.querySelector('.material-icons');
            var tx = pill.querySelector('.sii-pill-txt');
            if (ic) {
                ic.textContent = est.icono;
                ic.classList.toggle('sii-spin', est.spin);
            }
            if (tx) tx.textContent = est.pill;
        }
        if (btnSync) {
            btnSync.hidden = !(est.codigo === 'conectado' && sesion.autenticado && sesion.gatewayConfigured);
            btnSync.disabled = syncEnCurso.activo;
        }
    }

    function pintarBannerF29(modelo) {
        var br = bridge();
        var nom = clienteActivoNombre();
        var per = br ? br.periodoActual() : '2026-11';
        var estVis = estadoVisualCliente(nom);
        var est = br ? br.leerEstadoActual() : {};

        var sello = $('f29-sii-sello');
        var meta = $('f29-sii-meta');
        var btnSync = $('btn-f29-sii-sync');
        var btnCred = $('btn-f29-sii-credenciales');
        var btnCredTxt = $('btn-f29-sii-cred-txt');
        var prog = $('f29-sii-progreso');
        var progTxt = $('f29-sii-progreso-txt');

        if (sello) {
            var clsSello = estVis.codigo === 'conectado' ? 'sello-emitida'
                : (estVis.codigo === 'sincronizando' || estVis.codigo === 'sin_sesion' || estVis.codigo === 'sin_configurar') ? 'sello-preparada'
                    : estVis.codigo === 'error' ? 'sello-riesgo' : 'sello-guardada';
            sello.className = 'sello ' + clsSello;
            sello.innerHTML = '<span class="material-icons' + (estVis.spin ? ' sii-spin' : '') + '" aria-hidden="true">' + estVis.icono + '</span>' + D.esc(estVis.sello);
        }

        if (meta) {
            if (estVis.codigo === 'conectado' && estVis.vinculo) {
                var metodo = estVis.vinculo.credentialKind === 'PFX_CERTIFICATE' ? 'Certificado .pfx' : 'Clave Tributaria';
                var fechaSync = est.siiSyncAt || estVis.vinculo.lastSyncAt;
                meta.textContent = 'Conectado vía ' + metodo + (fechaSync ? ' · Última sincronización: ' + formatearFechaHora(fechaSync) : ' · Listo para sincronizar período ' + per);
            } else if (estVis.codigo === 'sin_sesion') {
                meta.textContent = 'Inicia sesión con tu correo en el Asistente para enlazar esta empresa con el SII. El modo CSV local sigue disponible.';
            } else if (estVis.codigo === 'sin_configurar') {
                meta.textContent = 'Servicio automático en preparación en el servidor. Mientras tanto puedes subir el CSV del RCV debajo.';
            } else if (estVis.codigo === 'error') {
                meta.textContent = syncEnCurso.error || 'No se pudo completar la última consulta al SII. Revisa las credenciales o intenta nuevamente.';
            } else {
                meta.textContent = 'Operando con archivos descargados manualmente desde sii.cl. También puedes vincular la empresa para sincronizar automático.';
            }
        }

        if (btnSync) {
            btnSync.hidden = !(estVis.vinculo && estVis.vinculo.hasCredentials && sesion.autenticado && sesion.gatewayConfigured);
            btnSync.disabled = syncEnCurso.activo;
        }
        if (btnCred && btnCredTxt) {
            btnCredTxt.textContent = (estVis.vinculo && estVis.vinculo.hasCredentials) ? 'Gestionar credenciales SII' : 'Conectar empresa al SII';
        }
        if (prog && progTxt) {
            var mostrarProg = syncEnCurso.activo && syncEnCurso.clienteKey === nom.toLowerCase();
            prog.hidden = !mostrarProg;
            prog.classList.remove('es-error');
            if (mostrarProg) progTxt.textContent = syncEnCurso.mensaje || 'Sincronizando con SII Gateway...';
        }

        pintarContrasteF29(modelo, est);
    }

    function pintarContrasteF29(modelo, estActual) {
        var panel = $('f29-contraste-panel');
        var tbody = $('tbody-f29-contraste');
        var sello = $('f29-contraste-sello');
        var sub = $('f29-contraste-sub');
        if (!panel || !tbody) return;

        var f29Sii = estActual && estActual.siiF29Oficial;
        if (!f29Sii || !f29Sii.synced || !modelo || !modelo.f29) {
            panel.hidden = true;
            return;
        }

        var cmp = Sii.compararF29ConSii(modelo.f29, f29Sii);
        if (!cmp.comparable) {
            panel.hidden = true;
            return;
        }

        panel.hidden = false;
        if (sello) {
            sello.className = 'sello ' + (cmp.coincideTotal ? 'sello-emitida' : 'sello-preparada');
            sello.textContent = cmp.coincideTotal ? 'Cuadra al peso' : (cmp.diferencias.length + ' diferencia(s)');
        }
        if (sub) {
            var partes = [];
            if (f29Sii.estado) partes.push('Estado SII: ' + f29Sii.estado);
            if (f29Sii.folioDeclaracion) partes.push('Folio ' + f29Sii.folioDeclaracion);
            if (f29Sii.fechaPresentacion) partes.push('Fecha ' + f29Sii.fechaPresentacion);
            sub.textContent = partes.length ? partes.join(' · ') : 'Comparación entre el RCV procesado en la Suite y el resumen F29 recibido desde SII.';
        }

        var filas = [
            { cod: 538, glosa: 'Débito fiscal IVA (cód. 538)' },
            { cod: 537, glosa: 'Crédito fiscal IVA (cód. 537)' },
            { cod: 89, glosa: 'IVA determinado (cód. 89)' },
            { cod: 77, glosa: 'Remanente período siguiente (cód. 77)' },
            { cod: 151, glosa: 'Retención boletas honorarios (cód. 151)' },
            { cod: 48, glosa: 'Impuesto Único 2ª Cat. (cód. 48)' },
            { cod: 62, glosa: 'PPM neto determinado (cód. 62)' },
            { cod: 91, glosa: 'Total a pagar F29 (cód. 91)' }
        ];

        tbody.innerHTML = filas.filter(function (f) {
            return f29Sii.codigos[String(f.cod)] !== undefined || (modelo.f29.codigos[f.cod] || 0) !== 0;
        }).map(function (f) {
            var vLoc = Math.round(Number(modelo.f29.codigos[f.cod]) || 0);
            var vSii = f29Sii.codigos[String(f.cod)];
            var haySii = vSii !== undefined;
            var delta = haySii ? (vLoc - vSii) : 0;
            var estadoHtml = !haySii
                ? '<span class="texto-ayuda">Sin dato SII</span>'
                : (delta === 0
                    ? '<span class="sello sello-emitida">Coincide</span>'
                    : '<span class="f29-diferencia-aviso">Dif: ' + (delta > 0 ? '+' : '-') + D.money(Math.abs(delta)) + '</span>');
            return '<tr>' +
                '<td>' + D.esc(f.glosa) + '</td>' +
                '<td class="mono num">' + D.money(vLoc) + '</td>' +
                '<td class="mono num">' + (haySii ? D.money(vSii) : '—') + '</td>' +
                '<td>' + estadoHtml + '</td>' +
                '</tr>';
        }).join('');
    }

    function celdaTorre(clienteInfo, rutTxt) {
        var est = estadoVisualCliente(clienteInfo.nombre);
        var cls = est.codigo === 'conectado' ? 'sello-emitida'
            : (est.codigo === 'sincronizando' || est.codigo === 'sin_sesion' || est.codigo === 'sin_configurar') ? 'sello-preparada'
                : est.codigo === 'error' ? 'sello-riesgo' : 'sello-guardada';

        if (est.vinculo && est.vinculo.hasCredentials) {
            var estadoBatch = batchSync.estadosPorCompany[est.vinculo.companyId];
            var badgeCls = cls;
            var badgeIco = est.icono;
            var badgeTxt = est.codigo === 'conectado' ? 'Conectado' : est.sello;
            var spin = est.spin;
            if (estadoBatch === 'QUEUED') { badgeCls = 'sello-guardada'; badgeIco = 'schedule'; badgeTxt = 'En cola'; spin = false; }
            else if (estadoBatch === 'RUNNING') { badgeCls = 'sello-preparada'; badgeIco = 'sync'; badgeTxt = 'Sincronizando...'; spin = true; }
            else if (estadoBatch === 'COMPLETED') { badgeCls = 'sello-emitida'; badgeIco = 'cloud_done'; badgeTxt = 'Sincronizado'; spin = false; }
            else if (estadoBatch === 'ERROR') { badgeCls = 'sello-riesgo'; badgeIco = 'error_outline'; badgeTxt = 'Fallo'; spin = false; }

            return '<div class="torre-sii-celda">' +
                '<span class="sello ' + badgeCls + '" title="Empresa conectada al SII"><span class="material-icons' + (spin ? ' sii-spin' : '') + '" aria-hidden="true">' + badgeIco + '</span>' + D.esc(badgeTxt) + '</span>' +
                '<button type="button" class="btn-icono-chico" title="Sincronizar período" aria-label="Sincronizar período de ' + D.esc(clienteInfo.nombre) + '" data-sii-sync="' + D.esc(clienteInfo.nombre) + '"><span class="material-icons" aria-hidden="true">sync</span></button>' +
                '<button type="button" class="btn-icono-chico" title="Gestionar conexión SII" aria-label="Configurar SII de ' + D.esc(clienteInfo.nombre) + '" data-sii-config="' + D.esc(clienteInfo.nombre) + '"><span class="material-icons" aria-hidden="true">settings</span></button>' +
                '</div>';
        }
        return '<div class="torre-sii-celda">' +
            '<span class="sello ' + cls + '">' + D.esc(rutTxt ? 'Sin clave SII' : 'Modo CSV') + '</span>' +
            '<button type="button" class="btn btn-chico" data-sii-config="' + D.esc(clienteInfo.nombre) + '">Conectar</button>' +
            '</div>';
    }

    function filaActivaSync(clienteInfo) {
        var est = estadoVisualCliente(clienteInfo.nombre);
        return !!(est.vinculo && batchSync.estadosPorCompany[est.vinculo.companyId] === 'RUNNING');
    }

    // ---------- Sesión y descubrimiento de empresas en SII Gateway ----------
    async function revisarSesionYGateway() {
        try {
            var r = await fetch('/api/pyme/sesion', { headers: { accept: 'application/json' }, credentials: 'same-origin' });
            var j = await r.json();
            sesion.autenticado = !!(j && j.autenticado);
            sesion.email = (j && j.email) || '';
        } catch (e) {
            sesion.autenticado = false;
            sesion.email = '';
        }
        sesion.verificada = true;

        if (sesion.autenticado) {
            try {
                var cfg = await api.configEstado();
                sesion.gatewayConfigured = !!(cfg && cfg.configured);
            } catch (e2) {
                sesion.gatewayConfigured = false;
            }
            if (sesion.gatewayConfigured) {
                await reconciliarEmpresasGateway();
            }
        } else {
            sesion.gatewayConfigured = false;
        }
        pintarContextBar();
        var br = bridge();
        if (br) pintarBannerF29(br.calcularModelo());
    }

    async function reconciliarEmpresasGateway() {
        try {
            var res = await api.listarEmpresas();
            var items = Array.isArray(res.items) ? res.items : [];
            var mapaRuts = leerMapaRuts();
            items.forEach(function (emp) {
                if (!emp || !emp.id || !emp.rut) return;
                var rutFmt = Sii.normalizarRut(emp.rut);
                var nombreMatch = emp.razonSocial || rutFmt;
                // Buscar si algún cliente local tiene este mismo RUT
                var claves = Object.keys(mapaRuts);
                for (var i = 0; i < claves.length; i++) {
                    if (mapaRuts[claves[i]] === rutFmt) {
                        nombreMatch = claves[i];
                        break;
                    }
                }
                var previo = tiendaVinculos.obtener(nombreMatch) || {};
                tiendaVinculos.guardar(nombreMatch, {
                    companyId: emp.id,
                    rut: rutFmt,
                    razonSocial: emp.razonSocial || previo.razonSocial || nombreMatch,
                    siiEnv: emp.siiEnv || 'PRODUCTION',
                    hasCredentials: previo.hasCredentials || false,
                    credentialKind: previo.credentialKind || '',
                    lastSyncAt: emp.lastSyncAt || previo.lastSyncAt || null
                });
                // Consultar status real en segundo plano para actualizar hasCredentials
                api.estadoEmpresa(emp.id).then(function (stRes) {
                    var st = stRes && stRes.status;
                    if (!st) return;
                    var creds = Array.isArray(st.credentials) ? st.credentials : [];
                    var activa = creds.filter(function (c) { return c.isActive !== false; })[0] || creds[0] || null;
                    tiendaVinculos.guardar(nombreMatch, {
                        companyId: emp.id,
                        rut: rutFmt,
                        razonSocial: st.razonSocial || emp.razonSocial || nombreMatch,
                        siiEnv: st.siiEnv || 'PRODUCTION',
                        hasCredentials: Boolean(st.hasCredentials),
                        credentialKind: activa ? activa.kind : '',
                        lastSyncAt: st.lastSyncAt || null
                    });
                    pintarContextBar();
                    var br = bridge();
                    if (br) br.refrescarTodo();
                }).catch(function () { });
            });
        } catch (e) { /* silencioso si el gateway responde lento */ }
    }

    // ---------- Modal de Conexión SII ----------
    function mostrarFeedbackModal(texto, tipo) {
        var box = $('sii-dlg-feedback');
        if (!box) return;
        if (!texto) {
            box.hidden = true;
            box.textContent = '';
            return;
        }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'ok' ? 'ok' : 'error');
        box.textContent = texto;
    }

    function cambiarTabMetodo(metodo) {
        modalState.metodo = metodo === 'PFX_CERTIFICATE' ? 'PFX_CERTIFICATE' : 'CLAVE_TRIBUTARIA';
        var esClave = modalState.metodo === 'CLAVE_TRIBUTARIA';
        if ($('tab-metodo-clave')) {
            $('tab-metodo-clave').classList.toggle('activo', esClave);
            $('tab-metodo-clave').setAttribute('aria-selected', esClave ? 'true' : 'false');
        }
        if ($('tab-metodo-pfx')) {
            $('tab-metodo-pfx').classList.toggle('activo', !esClave);
            $('tab-metodo-pfx').setAttribute('aria-selected', !esClave ? 'true' : 'false');
        }
        if ($('panel-metodo-clave')) $('panel-metodo-clave').hidden = !esClave;
        if ($('panel-metodo-pfx')) $('panel-metodo-pfx').hidden = esClave;
    }

    function leerArchivoBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var arr = new Uint8Array(reader.result);
                var bin = '';
                for (var i = 0; i < arr.length; i += 8192) {
                    bin += String.fromCharCode.apply(null, arr.subarray(i, i + 8192));
                }
                resolve(window.btoa(bin));
            };
            reader.onerror = function () { reject(new Error('No pudimos leer el archivo .pfx.')); };
            reader.readAsArrayBuffer(file);
        });
    }

    async function abrirModalSii(nombreCliente) {
        var nom = nombreCliente || clienteActivoNombre();
        modalState.clienteNombre = nom;
        var rut = rutDeCliente(nom);
        var vinculo = vinculoDeCliente(nom);

        if ($('sii-dlg-empresa-nom')) $('sii-dlg-empresa-nom').textContent = nom;
        if ($('sii-dlg-empresa-rut')) $('sii-dlg-empresa-rut').textContent = rut || 'Sin RUT';
        if ($('sii-input-rut')) $('sii-input-rut').value = rut;
        if ($('sii-input-clave')) $('sii-input-clave').value = '';
        if ($('sii-pass-pfx')) $('sii-pass-pfx').value = '';
        if ($('sii-file-pfx')) $('sii-file-pfx').value = '';
        mostrarFeedbackModal('');

        if (!sesion.verificada) await revisarSesionYGateway();

        var sinSes = $('sii-dlg-sin-sesion');
        var btnGuardar = $('btn-sii-guardar');
        var btnRevocar = $('btn-sii-revocar');
        var btnEliminar = $('btn-sii-eliminar-empresa');
        var boxEstado = $('sii-dlg-estado-actual');

        if (sinSes) sinSes.hidden = sesion.autenticado;
        if (btnGuardar) btnGuardar.disabled = !sesion.autenticado || !sesion.gatewayConfigured;

        if (sesion.autenticado && !sesion.gatewayConfigured) {
            mostrarFeedbackModal('Falta configurar SII_GATEWAY_API_KEY en el servidor Vercel para conectar con https://connect.calculolaboral.cl. Mientras tanto usa la subida CSV.', 'error');
        }

        if (vinculo && vinculo.hasCredentials) {
            if (boxEstado) {
                boxEstado.hidden = false;
                var kindLbl = vinculo.credentialKind === 'PFX_CERTIFICATE' ? 'Certificado Digital .pfx' : 'Clave Tributaria SII';
                boxEstado.textContent = 'Empresa conectada mediante ' + kindLbl + (vinculo.lastSyncAt ? ' · Última sincronización: ' + formatearFechaHora(vinculo.lastSyncAt) : '') + '. Puedes actualizar las credenciales o revocarlas.';
            }
        } else if (boxEstado) {
            boxEstado.hidden = true;
        }

        if (btnRevocar) btnRevocar.hidden = !(sesion.autenticado && vinculo && vinculo.hasCredentials);
        if (btnEliminar) btnEliminar.hidden = !(sesion.autenticado && vinculo && vinculo.companyId);

        cambiarTabMetodo(vinculo && vinculo.credentialKind === 'PFX_CERTIFICATE' ? 'PFX_CERTIFICATE' : 'CLAVE_TRIBUTARIA');

        var dlg = $('dlg-sii-conexion');
        if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    }

    async function guardarConexionModal() {
        if (!sesion.autenticado) {
            mostrarFeedbackModal('Inicia sesión con tu correo antes de guardar credenciales.', 'error');
            return;
        }
        if (!sesion.gatewayConfigured) {
            mostrarFeedbackModal('El servidor aún no tiene configurada SII_GATEWAY_API_KEY.', 'error');
            return;
        }

        var nom = modalState.clienteNombre || clienteActivoNombre();
        var rutRaw = ($('sii-input-rut') && $('sii-input-rut').value.trim()) || '';
        if (!Sii.rutValido(rutRaw)) {
            mostrarFeedbackModal('Ingresa un RUT chileno válido con dígito verificador.', 'error');
            if ($('sii-input-rut')) $('sii-input-rut').focus();
            return;
        }
        var rutFmt = Sii.normalizarRut(rutRaw);
        guardarRutCliente(nom, rutFmt);
        if ($('liq-rut') && nom.toLowerCase() === clienteActivoNombre().toLowerCase()) $('liq-rut').value = rutFmt;
        if ($('liq-rut-empresa') && nom.toLowerCase() === clienteActivoNombre().toLowerCase()) $('liq-rut-empresa').value = rutFmt;

        var credPayload;
        if (modalState.metodo === 'CLAVE_TRIBUTARIA') {
            var clave = $('sii-input-clave') ? $('sii-input-clave').value : '';
            if (!clave.trim()) {
                mostrarFeedbackModal('Ingresa la Clave Tributaria del SII.', 'error');
                if ($('sii-input-clave')) $('sii-input-clave').focus();
                return;
            }
            var envSel = ($('sii-input-env') && $('sii-input-env').value) || 'PRODUCTION';
            credPayload = { kind: 'CLAVE_TRIBUTARIA', siiEnv: envSel, claveTributaria: clave };
        } else {
            var fileInp = $('sii-file-pfx');
            var passPfx = $('sii-pass-pfx') ? $('sii-pass-pfx').value : '';
            var archivo = fileInp && fileInp.files && fileInp.files[0];
            if (!archivo || !passPfx) {
                mostrarFeedbackModal('Selecciona el archivo .pfx/.p12 e ingresa su contraseña.', 'error');
                return;
            }
            var pfxBase64 = await leerArchivoBase64(archivo);
            credPayload = {
                kind: 'PFX_CERTIFICATE',
                siiEnv: 'PRODUCTION',
                pfxBase64: pfxBase64,
                pfxPassword: passPfx,
                certMetadata: { fileName: archivo.name }
            };
        }

        var btn = $('btn-sii-guardar');
        if (btn) btn.disabled = true;
        mostrarFeedbackModal('Registrando empresa y guardando credenciales cifradas...', 'ok');

        try {
            var vinculo = vinculoDeCliente(nom);
            var companyId = vinculo && vinculo.companyId;
            if (!companyId) {
                var existentes = await api.listarEmpresas(rutFmt);
                var encontrada = (existentes.items || [])[0];
                if (encontrada && encontrada.id) {
                    companyId = encontrada.id;
                } else {
                    var creada = await api.crearEmpresa({ rut: rutFmt, razonSocial: nom, siiEnv: credPayload.siiEnv || 'PRODUCTION', syncEnabled: true });
                    companyId = creada.company && creada.company.id;
                }
            }
            if (!companyId) throw new Error('No obtuvimos un identificador de empresa desde SII Gateway.');

            await api.guardarCredenciales(companyId, credPayload);

            // Limpiar secretos de la memoria del DOM de inmediato
            if ($('sii-input-clave')) $('sii-input-clave').value = '';
            if ($('sii-pass-pfx')) $('sii-pass-pfx').value = '';
            if ($('sii-file-pfx')) $('sii-file-pfx').value = '';

            tiendaVinculos.guardar(nom, {
                companyId: companyId,
                rut: rutFmt,
                razonSocial: nom,
                siiEnv: credPayload.siiEnv || 'PRODUCTION',
                hasCredentials: true,
                credentialKind: credPayload.kind,
                lastSyncAt: vinculo && vinculo.lastSyncAt ? vinculo.lastSyncAt : null
            });

            pintarContextBar();
            var br = bridge();
            if (br) br.refrescarTodo();

            var dlg = $('dlg-sii-conexion');
            if (dlg && dlg.open) dlg.close();
            if (D) D.avisar('Conexión SII guardada para ' + nom + '. Ya puedes sincronizar el período.');
        } catch (err) {
            mostrarFeedbackModal(err && err.message ? err.message : 'No pudimos guardar la conexión SII.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function revocarCredencialesModal() {
        var nom = modalState.clienteNombre || clienteActivoNombre();
        var vinculo = vinculoDeCliente(nom);
        if (!vinculo || !vinculo.companyId) return;
        try {
            await api.eliminarCredenciales(vinculo.companyId);
            tiendaVinculos.guardar(nom, Object.assign({}, vinculo, { hasCredentials: false, credentialKind: '' }));
            var dlg = $('dlg-sii-conexion');
            if (dlg && dlg.open) dlg.close();
            pintarContextBar();
            var br = bridge();
            if (br) br.refrescarTodo();
            if (D) D.avisar('Credenciales SII desconectadas para ' + nom + '.');
        } catch (err) {
            mostrarFeedbackModal(err && err.message ? err.message : 'No se pudieron revocar las credenciales.', 'error');
        }
    }

    async function eliminarEmpresaModal() {
        var nom = modalState.clienteNombre || clienteActivoNombre();
        var vinculo = vinculoDeCliente(nom);
        if (!vinculo || !vinculo.companyId) return;
        try {
            await api.eliminarEmpresa(vinculo.companyId);
            tiendaVinculos.eliminar(nom);
            var dlg = $('dlg-sii-conexion');
            if (dlg && dlg.open) dlg.close();
            pintarContextBar();
            var br = bridge();
            if (br) br.refrescarTodo();
            if (D) D.avisar('Empresa eliminada del conector SII.');
        } catch (err) {
            mostrarFeedbackModal(err && err.message ? err.message : 'No se pudo eliminar la empresa del conector.', 'error');
        }
    }

    // ---------- Sincronización asíncrona (Polling + Carga en Suite) ----------
    async function sincronizarMes(opts) {
        var o = opts || {};
        var br = bridge();
        if (!br) return;
        var nom = clienteActivoNombre();
        var per = br.periodoActual();
        var estActual = br.leerEstadoActual();

        if (estActual.cerradoTributario) {
            if (D) D.avisar('El período ' + per + ' está cerrado tributariamente. Reábrelo antes de sincronizar desde el SII.');
            return;
        }
        if (!sesion.autenticado || !sesion.gatewayConfigured) {
            abrirModalSii(nom);
            return;
        }
        var vinculo = vinculoDeCliente(nom);
        if (!vinculo || !vinculo.companyId || !vinculo.hasCredentials) {
            abrirModalSii(nom);
            return;
        }
        if (syncEnCurso.activo) return;

        syncEnCurso = {
            activo: true,
            clienteKey: nom.toLowerCase(),
            mensaje: 'Encolando sincronización SII (' + per + ')...',
            error: ''
        };
        pintarContextBar();
        pintarBannerF29(br.calcularModelo());

        try {
            var jobType = o.jobType || 'FULL_SYNC';
            var job = await api.sincronizarYEsperar(vinculo.companyId, {
                period: per,
                jobType: jobType,
                onEstado: function (j) {
                    var st = String((j && j.status) || 'QUEUED').toUpperCase();
                    syncEnCurso.mensaje = st === 'RUNNING'
                        ? 'Descargando documentos desde sii.cl (' + per + ')...'
                        : (st === 'COMPLETED' ? 'Procesando documentos en la Suite...' : 'Esperando turno de sincronización SII...');
                    pintarBannerF29(br.calcularModelo());
                }
            });

            var stFinal = String((job && job.status) || '').toUpperCase();
            if (stFinal === 'FAILED' || stFinal === 'ERROR' || stFinal === 'CANCELLED') {
                throw new Error((job && (job.errorMessage || job.error)) || 'La sincronización SII falló. Revisa tus credenciales.');
            }
            if (stFinal !== 'COMPLETED') {
                throw new Error('La sincronización sigue en curso en segundo plano. Vuelve a consultar en unos segundos.');
            }

            if (o.soloBhe) {
                var bheResp = await api.obtenerBhe(vinculo.companyId, { period: per, direction: 'RECIBIDA', all: true });
                var bheNorm = Sii.normalizarBheDesdeGateway(bheResp, { direction: 'RECIBIDA' });
                var bheParsed = Imp ? Imp.parsearBheSii(bheNorm.items, { periodo: per }) : { ok: true, boletas: bheNorm.items, anuladasOmitidas: 0, totalBruto: 0, codigo151: 0, advertencias: [] };
                br.guardarEstadoActual(function (est) {
                    est.bheBoletas = bheParsed.boletas || [];
                    est.bheAnuladas = bheParsed.anuladasOmitidas || 0;
                    est.bheAlertas = bheParsed.advertencias || [];
                    est.honorariosBruto = bheParsed.totalBruto || 0;
                    est.honorariosRetencionDirecta = bheParsed.codigo151 || 0;
                    est.siiSyncAt = new Date().toISOString();
                });
                syncEnCurso = { activo: false, clienteKey: '', mensaje: '', error: '' };
                tiendaVinculos.guardar(nom, Object.assign({}, vinculo, { lastSyncAt: new Date().toISOString() }));
                br.refrescarTodo();
                if (D) D.avisar('BHE sincronizadas desde SII: ' + (bheParsed.boletas || []).length + ' vigentes.');
                return;
            }

            // FULL_SYNC: traer RCV Ventas, RCV Compras (REGISTRO + PENDIENTE), BHE Recibidas y F29 oficial en paralelo
            var resultados = await Promise.all([
                api.obtenerRcv(vinculo.companyId, { period: per, operacion: 'VENTA', all: true }),
                api.obtenerRcv(vinculo.companyId, { period: per, operacion: 'COMPRA', all: true }),
                api.obtenerBhe(vinculo.companyId, { period: per, direction: 'RECIBIDA', all: true }).catch(function () { return null; }),
                api.obtenerF29(vinculo.companyId, { period: per }).catch(function () { return null; }),
                api.obtenerRcv(vinculo.companyId, { period: per, operacion: 'COMPRA', estadoContab: 'PENDIENTE', all: true }).catch(function () { return null; })
            ]);

            var ventasNorm = Sii.normalizarRcvDesdeGateway(resultados[0], 'ventas');
            var comprasNorm = Sii.normalizarRcvDesdeGateway(resultados[1], 'compras');
            var pendientesAcuse = Sii.normalizarPendientesDesdeGateway ? Sii.normalizarPendientesDesdeGateway(resultados[4]) : [];
            var bheNormFull = resultados[2] ? Sii.normalizarBheDesdeGateway(resultados[2], { direction: 'RECIBIDA' }) : null;
            var bheParsedFull = (bheNormFull && Imp) ? Imp.parsearBheSii(bheNormFull.items, { periodo: per }) : null;
            var f29Sii = resultados[3] ? Sii.normalizarF29DesdeGateway(resultados[3]) : null;
            var ahoraIso = new Date().toISOString();

            br.guardarEstadoActual(function (est) {
                est.ventasRows = ventasNorm.rows;
                est.ventasCsv = '';
                est.ventasArchivo = 'SII RCV Ventas (' + per + ')';
                est.comprasRows = comprasNorm.rows;
                est.comprasCsv = '';
                est.comprasArchivo = 'SII RCV Compras (' + per + ')';
                est.comprasPendientesAcuse = pendientesAcuse;
                if (bheParsedFull && bheParsedFull.ok) {
                    est.bheBoletas = bheParsedFull.boletas || [];
                    est.bheAnuladas = bheParsedFull.anuladasOmitidas || 0;
                    est.bheAlertas = bheParsedFull.advertencias || [];
                    est.honorariosBruto = bheParsedFull.totalBruto || 0;
                    est.honorariosRetencionDirecta = bheParsedFull.codigo151 || 0;
                }
                if (f29Sii && f29Sii.synced) {
                    est.siiF29Oficial = f29Sii;
                    if (!est.remanenteAnterior && f29Sii.remanenteAnterior > 0) {
                        est.remanenteAnterior = f29Sii.remanenteAnterior;
                    }
                } else {
                    est.siiF29Oficial = null;
                }
                est.siiSyncAt = ahoraIso;
            });

            tiendaVinculos.guardar(nom, Object.assign({}, vinculo, { lastSyncAt: ahoraIso, lastErrorCode: '' }));
            syncEnCurso = { activo: false, clienteKey: '', mensaje: '', error: '' };
            br.refrescarTodo();

            var avisoExtras = ventasNorm.avisos.concat(comprasNorm.avisos);
            if (D) {
                D.avisar('SII sincronizado (' + per + '): ' + ventasNorm.rows.length + ' ventas y ' + comprasNorm.rows.length + ' compras.' + (avisoExtras.length ? ' ' + avisoExtras[0] : ''));
            }
        } catch (err) {
            var msgErr = (err && err.message) ? err.message : 'Error al sincronizar con el SII.';
            syncEnCurso = { activo: false, clienteKey: nom.toLowerCase(), mensaje: '', error: msgErr };
            pintarContextBar();
            pintarBannerF29(br.calcularModelo());
            if (D) D.avisar(msgErr);
        }
    }

    function pintarProgresoBatch() {
        var panel = $('torre-sii-progreso-panel');
        var btn = $('btn-torre-sync-all');
        if (btn) btn.disabled = batchSync.activo;
        if (!panel) return;
        if (!batchSync.activo && batchSync.total === 0) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        var pct = batchSync.total > 0 ? Math.min(100, Math.round((batchSync.completadas / batchSync.total) * 100)) : 0;
        if ($('torre-sii-progreso-label')) {
            $('torre-sii-progreso-label').textContent = batchSync.activo
                ? ('Sincronizando ' + Math.min(batchSync.total, batchSync.completadas + 1) + ' de ' + batchSync.total + ' empresas conectadas...')
                : ('Cartera sincronizada (' + batchSync.completadas + ' de ' + batchSync.total + ')');
        }
        if ($('torre-sii-progreso-empresa')) {
            $('torre-sii-progreso-empresa').textContent = batchSync.empresaActual ? ('(' + batchSync.empresaActual + ')') : '';
        }
        if ($('torre-sii-progreso-pct')) $('torre-sii-progreso-pct').textContent = pct + '%';
        if ($('torre-sii-barra-fill')) $('torre-sii-barra-fill').style.width = pct + '%';
    }

    async function sincronizarCarteraCompleta() {
        var br = bridge();
        if (!br || batchSync.activo) return;
        if (!sesion.autenticado) {
            abrirModalSii(br.clienteNombre());
            return;
        }
        if (!sesion.gatewayConfigured) {
            if (D) D.avisar('El conector SII automático aún no está configurado en el servidor.');
            return;
        }

        var per = br.periodoActual();
        batchSync = { activo: true, total: 0, completadas: 0, empresaActual: 'Iniciando cola SII...', estadosPorCompany: {} };
        pintarProgresoBatch();

        try {
            var res = await api.iniciarSyncAll({ period: per });
            var batch = res.batch || res || {};
            var jobs = Array.isArray(batch.jobs) ? batch.jobs : [];
            if (!jobs.length) {
                batchSync = { activo: false, total: 0, completadas: 0, empresaActual: '', estadosPorCompany: {} };
                pintarProgresoBatch();
                if (D) D.avisar('No hay empresas con credenciales SII activas para sincronizar.');
                return;
            }

            // Mapear companyId / RUT -> nombre de cliente en la Suite
            var vinculos = tiendaVinculos.listar();
            var porCompId = {};
            Object.keys(vinculos).forEach(function (k) {
                var v = vinculos[k];
                if (v && v.companyId) porCompId[v.companyId] = v.razonSocial || k;
            });

            batchSync.total = jobs.length;
            jobs.forEach(function (j) { batchSync.estadosPorCompany[j.companyId] = 'QUEUED'; });
            pintarProgresoBatch();
            br.refrescarTodo();

            var terminadosOk = 0;
            var fallidos = 0;
            var JOB_FIN = { COMPLETED: true, PARTIAL: true, FAILED: true, ERROR: true, CANCELLED: true };

            for (var idx = 0; idx < jobs.length; idx++) {
                var jobItem = jobs[idx];
                var cid = jobItem.companyId;
                var nomCli = porCompId[cid] || jobItem.rut || cid;
                batchSync.empresaActual = nomCli;
                batchSync.estadosPorCompany[cid] = 'RUNNING';
                pintarProgresoBatch();
                br.refrescarTodo();

                var jobSt = { status: 'QUEUED' };
                for (var intento = 0; intento < 36; intento++) {
                    try {
                        var stRes = await api.estadoSync(cid, jobItem.jobId);
                        jobSt = stRes.job || {};
                    } catch (ePoll) {
                        jobSt = { status: 'ERROR' };
                        break;
                    }
                    var code = String(jobSt.status || 'QUEUED').toUpperCase();
                    if (JOB_FIN[code]) break;
                    await new Promise(function (r) { setTimeout(r, 1500); });
                }

                var codeFin = String(jobSt.status || '').toUpperCase();
                if (codeFin === 'COMPLETED' || codeFin === 'PARTIAL') {
                    try {
                        var rRes = await Promise.all([
                            api.obtenerRcv(cid, { period: per, operacion: 'VENTA', all: true }),
                            api.obtenerRcv(cid, { period: per, operacion: 'COMPRA', all: true }),
                            api.obtenerBhe(cid, { period: per, direction: 'RECIBIDA', all: true }).catch(function () { return null; }),
                            api.obtenerF29(cid, { period: per }).catch(function () { return null; }),
                            api.obtenerRcv(cid, { period: per, operacion: 'COMPRA', estadoContab: 'PENDIENTE', all: true }).catch(function () { return null; })
                        ]);
                        var vN = Sii.normalizarRcvDesdeGateway(rRes[0], 'ventas');
                        var cN = Sii.normalizarRcvDesdeGateway(rRes[1], 'compras');
                        var pN = Sii.normalizarPendientesDesdeGateway ? Sii.normalizarPendientesDesdeGateway(rRes[4]) : [];
                        var bN = rRes[2] ? Sii.normalizarBheDesdeGateway(rRes[2], { direction: 'RECIBIDA' }) : null;
                        var bP = (bN && Imp) ? Imp.parsearBheSii(bN.items, { periodo: per }) : null;
                        var fN = rRes[3] ? Sii.normalizarF29DesdeGateway(rRes[3]) : null;
                        var ts = new Date().toISOString();

                        if (typeof br.guardarEstadoParaCliente === 'function') {
                            br.guardarEstadoParaCliente(nomCli, per, function (est) {
                                est.ventasRows = vN.rows;
                                est.ventasCsv = '';
                                est.ventasArchivo = 'SII RCV Ventas (' + per + ')';
                                est.comprasRows = cN.rows;
                                est.comprasCsv = '';
                                est.comprasArchivo = 'SII RCV Compras (' + per + ')';
                                est.comprasPendientesAcuse = pN;
                                if (bP && bP.ok) {
                                    est.bheBoletas = bP.boletas || [];
                                    est.bheAnuladas = bP.anuladasOmitidas || 0;
                                    est.bheAlertas = bP.advertencias || [];
                                    est.honorariosBruto = bP.totalBruto || 0;
                                    est.honorariosRetencionDirecta = bP.codigo151 || 0;
                                }
                                if (fN && fN.synced) {
                                    est.siiF29Oficial = fN;
                                    if (!est.remanenteAnterior && fN.remanenteAnterior > 0) est.remanenteAnterior = fN.remanenteAnterior;
                                }
                                est.siiSyncAt = ts;
                            });
                        }
                        var vPrev = tiendaVinculos.obtener(nomCli) || { companyId: cid, rut: jobItem.rut || '', razonSocial: nomCli, hasCredentials: true };
                        tiendaVinculos.guardar(nomCli, Object.assign({}, vPrev, { lastSyncAt: ts, lastErrorCode: '' }));
                        batchSync.estadosPorCompany[cid] = 'COMPLETED';
                        terminadosOk += 1;
                    } catch (eData) {
                        batchSync.estadosPorCompany[cid] = 'ERROR';
                        fallidos += 1;
                    }
                } else {
                    batchSync.estadosPorCompany[cid] = 'ERROR';
                    fallidos += 1;
                }
                batchSync.completadas += 1;
                pintarProgresoBatch();
                br.refrescarTodo();
            }

            batchSync.activo = false;
            batchSync.empresaActual = '';
            pintarProgresoBatch();
            br.refrescarTodo();
            if (D) {
                D.avisar('Sincronización de cartera finalizada: ' + terminadosOk + ' OK' + (fallidos ? (', ' + fallidos + ' con fallo') : '') + '.');
            }
        } catch (errBatch) {
            batchSync = { activo: false, total: 0, completadas: 0, empresaActual: '', estadosPorCompany: {} };
            pintarProgresoBatch();
            br.refrescarTodo();
            if (D) D.avisar((errBatch && errBatch.message) || 'No se pudo iniciar la sincronización masiva.');
        }
    }

    // ---------- Boot & Listeners ----------
    document.addEventListener('DOMContentLoaded', function () {
        var inpRut = $('liq-rut');
        function confirmarRutBarra(conAviso) {
            if (!inpRut) return;
            var val = inpRut.value.trim();
            var nom = clienteActivoNombre();
            if (!val) { guardarRutCliente(nom, ''); pintarContextBar(); return; }
            if (!Sii.rutValido(val)) {
                if (conAviso && D) D.avisar('El RUT ingresado en la barra de cliente no es válido.');
                return;
            }
            var fmt = guardarRutCliente(nom, val);
            inpRut.value = fmt;
            if ($('liq-rut-empresa')) $('liq-rut-empresa').value = fmt;
            var br = bridge();
            if (br) br.refrescarTodo();
        }
        if (inpRut) {
            inpRut.addEventListener('blur', function () { confirmarRutBarra(true); });
            inpRut.addEventListener('change', function () { confirmarRutBarra(false); });
        }
        if ($('btn-guardar-cliente')) {
            $('btn-guardar-cliente').addEventListener('click', function () { confirmarRutBarra(false); });
        }

        if ($('btn-ctx-sii-estado')) $('btn-ctx-sii-estado').addEventListener('click', function () { abrirModalSii(); });
        if ($('btn-f29-sii-credenciales')) $('btn-f29-sii-credenciales').addEventListener('click', function () { abrirModalSii(); });
        if ($('btn-ctx-sii-sync')) $('btn-ctx-sii-sync').addEventListener('click', function () { sincronizarMes(); });
        if ($('btn-f29-sii-sync')) $('btn-f29-sii-sync').addEventListener('click', function () { sincronizarMes(); });
        if ($('btn-imp-bhe-sii')) $('btn-imp-bhe-sii').addEventListener('click', function () { sincronizarMes({ jobType: 'BHE_RECIBIDAS', soloBhe: true }); });
        if ($('btn-torre-sync-all')) $('btn-torre-sync-all').addEventListener('click', function () { sincronizarCarteraCompleta(); });

        if ($('tbody-torre-clientes')) {
            $('tbody-torre-clientes').addEventListener('click', function (ev) {
                var btnCfg = ev.target.closest('[data-sii-config]');
                if (btnCfg) {
                    var nomCfg = btnCfg.getAttribute('data-sii-config');
                    var br = bridge();
                    if (br && nomCfg && nomCfg.toLowerCase() !== br.clienteClave()) br.cambiarACliente(nomCfg);
                    abrirModalSii(nomCfg);
                    return;
                }
                var btnSync = ev.target.closest('[data-sii-sync]');
                if (btnSync) {
                    var nomSync = btnSync.getAttribute('data-sii-sync');
                    var br2 = bridge();
                    if (br2 && nomSync && nomSync.toLowerCase() !== br2.clienteClave()) br2.cambiarACliente(nomSync);
                    sincronizarMes();
                }
            });
        }

        // Modal controls
        var dlg = $('dlg-sii-conexion');
        function cerrarDlg() { if (dlg && dlg.open) dlg.close(); }
        if ($('btn-cerrar-sii-dlg')) $('btn-cerrar-sii-dlg').addEventListener('click', cerrarDlg);
        if ($('btn-sii-cancelar')) $('btn-sii-cancelar').addEventListener('click', cerrarDlg);
        if ($('btn-sii-ir-sesion')) $('btn-sii-ir-sesion').addEventListener('click', function () { window.open('/app', '_blank'); });
        if ($('tab-metodo-clave')) $('tab-metodo-clave').addEventListener('click', function () { cambiarTabMetodo('CLAVE_TRIBUTARIA'); });
        if ($('tab-metodo-pfx')) $('tab-metodo-pfx').addEventListener('click', function () { cambiarTabMetodo('PFX_CERTIFICATE'); });
        if ($('btn-sii-guardar')) $('btn-sii-guardar').addEventListener('click', guardarConexionModal);
        if ($('btn-sii-revocar')) $('btn-sii-revocar').addEventListener('click', revocarCredencialesModal);
        if ($('btn-sii-eliminar-empresa')) $('btn-sii-eliminar-empresa').addEventListener('click', eliminarEmpresaModal);

        if ($('btn-toggle-sii-pass') && $('sii-input-clave')) {
            $('btn-toggle-sii-pass').addEventListener('click', function () {
                var inp = $('sii-input-clave');
                var esPass = inp.type === 'password';
                inp.type = esPass ? 'text' : 'password';
                var ic = $('btn-toggle-sii-pass').querySelector('.material-icons');
                if (ic) ic.textContent = esPass ? 'visibility_off' : 'visibility';
            });
        }

        document.addEventListener('suite:refrescado', function (ev) {
            pintarContextBar();
            pintarBannerF29(ev && ev.detail ? ev.detail : null);
        });

        window.addEventListener('focus', function () {
            revisarSesionYGateway();
        });

        revisarSesionYGateway();
    });

    window.CLDemoSii = {
        rutDeCliente: rutDeCliente,
        guardarRutCliente: guardarRutCliente,
        celdaTorre: celdaTorre,
        filaActivaSync: filaActivaSync,
        abrirModalSii: abrirModalSii,
        sincronizarMes: sincronizarMes,
        sincronizarCarteraCompleta: sincronizarCarteraCompleta,
        revisarSesionYGateway: revisarSesionYGateway
    };
})();
