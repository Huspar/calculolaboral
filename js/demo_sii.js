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

    var alertasState = {
        items: [],
        filtroSev: 'TODAS',
        filtroModulo: 'TODOS'
    };

    var previredPorCliente = {};

    var webhooksState = {
        items: [],
        deliveriesWebhookId: '',
        receptor: { configurado: false, ultimoEvento: null, ultimosAvisos: [] }
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
                cargarAlertasEstudio().catch(function () { });
            }
        } else {
            sesion.gatewayConfigured = false;
        }
        pintarContextBar();
        var br = bridge();
        if (br) {
            var mAct = br.calcularModelo();
            pintarBannerF29(mAct);
            pintarPanelesModulos(mAct);
        }
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
                    var siiCreds = creds.filter(function (c) { return c.isActive !== false && c.kind !== 'PREVIRED_CREDENTIALS'; });
                    var activaSii = siiCreds[0] || null;
                    var activaPrev = creds.filter(function (c) { return c.isActive !== false && c.kind === 'PREVIRED_CREDENTIALS'; })[0] || null;
                    var prevV = tiendaVinculos.obtener(nombreMatch) || {};
                    tiendaVinculos.guardar(nombreMatch, {
                        companyId: emp.id,
                        rut: rutFmt,
                        razonSocial: st.razonSocial || emp.razonSocial || nombreMatch,
                        siiEnv: st.siiEnv || 'PRODUCTION',
                        hasCredentials: siiCreds.length > 0 ? true : (Boolean(st.hasCredentials) && !activaPrev),
                        credentialKind: activaSii ? activaSii.kind : '',
                        hasPreviredCredentials: Boolean(activaPrev) || Boolean(prevV.hasPreviredCredentials),
                        previredRutUsuario: (activaPrev && activaPrev.rutUsuario) || prevV.previredRutUsuario || '',
                        lastSyncAt: st.lastSyncAt || prevV.lastSyncAt || null
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
        if (metodo === 'PFX_CERTIFICATE') modalState.metodo = 'PFX_CERTIFICATE';
        else if (metodo === 'PREVIRED_CREDENTIALS') modalState.metodo = 'PREVIRED_CREDENTIALS';
        else modalState.metodo = 'CLAVE_TRIBUTARIA';

        var esClave = modalState.metodo === 'CLAVE_TRIBUTARIA';
        var esPfx = modalState.metodo === 'PFX_CERTIFICATE';
        var esPrev = modalState.metodo === 'PREVIRED_CREDENTIALS';

        if ($('tab-metodo-clave')) {
            $('tab-metodo-clave').classList.toggle('activo', esClave);
            $('tab-metodo-clave').setAttribute('aria-selected', esClave ? 'true' : 'false');
        }
        if ($('tab-metodo-pfx')) {
            $('tab-metodo-pfx').classList.toggle('activo', esPfx);
            $('tab-metodo-pfx').setAttribute('aria-selected', esPfx ? 'true' : 'false');
        }
        if ($('tab-metodo-previred')) {
            $('tab-metodo-previred').classList.toggle('activo', esPrev);
            $('tab-metodo-previred').setAttribute('aria-selected', esPrev ? 'true' : 'false');
        }
        if ($('panel-metodo-clave')) $('panel-metodo-clave').hidden = !esClave;
        if ($('panel-metodo-pfx')) $('panel-metodo-pfx').hidden = !esPfx;
        if ($('panel-metodo-previred')) $('panel-metodo-previred').hidden = !esPrev;

        var vinculo = vinculoDeCliente(modalState.clienteNombre || clienteActivoNombre());
        if ($('btn-sii-guardar')) {
            $('btn-sii-guardar').innerHTML = '<span class="material-icons" aria-hidden="true">check</span>' +
                (esPrev ? 'Guardar PreviRed' : 'Guardar y conectar');
        }
        if ($('btn-sii-revocar')) {
            $('btn-sii-revocar').hidden = esPrev || !(sesion.autenticado && vinculo && vinculo.hasCredentials);
        }
        if ($('btn-previred-revocar')) {
            $('btn-previred-revocar').hidden = !esPrev || !(sesion.autenticado && vinculo && vinculo.hasPreviredCredentials);
        }
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

    function estadoConexionCliente(nombreCliente) {
        var v = vinculoDeCliente(nombreCliente);
        return {
            autenticado: sesion.autenticado,
            gatewayConfigured: sesion.gatewayConfigured,
            companyId: v ? (v.companyId || '') : '',
            hasCredentials: Boolean(v && v.hasCredentials),
            credentialKind: v ? (v.credentialKind || '') : '',
            tienePfx: Boolean(v && v.hasCredentials && v.credentialKind === 'PFX_CERTIFICATE')
        };
    }

    async function abrirModalSii(nombreCliente, opts) {
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
        if ($('previred-input-pass')) {
            $('previred-input-pass').value = '';
            $('previred-input-pass').type = 'password';
            $('previred-input-pass').placeholder = (vinculo && vinculo.hasPreviredCredentials)
                ? 'Clave guardada (escribe una nueva solo para reemplazar)'
                : 'Ingresa o reemplaza la clave PreviRed';
        }
        if ($('previred-input-rut-usuario')) {
            $('previred-input-rut-usuario').value = (vinculo && vinculo.previredRutUsuario) ? vinculo.previredRutUsuario : '';
        }
        if ($('previred-estado-boveda')) {
            var tienePrev = Boolean(vinculo && vinculo.hasPreviredCredentials);
            $('previred-estado-boveda').hidden = !tienePrev;
            if (tienePrev && $('previred-boveda-meta')) {
                $('previred-boveda-meta').textContent = (vinculo.previredRutUsuario ? ('RUT usuario ' + vinculo.previredRutUsuario + '. ') : 'RUT usuario conectado. ') + 'La clave permanece oculta y cifrada.';
            }
        }
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

        var met = (opts && opts.metodo) || (vinculo && vinculo.credentialKind === 'PFX_CERTIFICATE' ? 'PFX_CERTIFICATE' : 'CLAVE_TRIBUTARIA');
        cambiarTabMetodo(met);

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

        var vinculoPrev = vinculoDeCliente(nom);
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
        } else if (modalState.metodo === 'PFX_CERTIFICATE') {
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
        } else {
            var rutUsrRaw = $('previred-input-rut-usuario') ? $('previred-input-rut-usuario').value.trim() : '';
            var passPrev = $('previred-input-pass') ? $('previred-input-pass').value : '';
            if (!Sii.rutValido(rutUsrRaw)) {
                mostrarFeedbackModal('Ingresa el RUT usuario válido de quien accede a PreviRed.', 'error');
                if ($('previred-input-rut-usuario')) $('previred-input-rut-usuario').focus();
                return;
            }
            var rutUsrFmt = Sii.normalizarRut(rutUsrRaw);
            if (!passPrev.trim()) {
                mostrarFeedbackModal(
                    (vinculoPrev && vinculoPrev.hasPreviredCredentials)
                        ? 'La clave PreviRed ya está en bóveda; ingresa una nueva clave solo si deseas reemplazarla.'
                        : 'Ingresa la clave de acceso a PreviRed.',
                    'error'
                );
                if ($('previred-input-pass')) $('previred-input-pass').focus();
                return;
            }
            credPayload = {
                kind: 'PREVIRED_CREDENTIALS',
                siiEnv: 'PRODUCTION',
                rutUsuario: rutUsrFmt,
                password: passPrev
            };
        }

        var btn = $('btn-sii-guardar');
        if (btn) btn.disabled = true;
        mostrarFeedbackModal('Registrando empresa y guardando credenciales cifradas...', 'ok');

        try {
            var vinculo = vinculoPrev;
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
            if ($('previred-input-pass')) $('previred-input-pass').value = '';

            var esPrev = credPayload.kind === 'PREVIRED_CREDENTIALS';
            tiendaVinculos.guardar(nom, {
                companyId: companyId,
                rut: rutFmt,
                razonSocial: nom,
                siiEnv: esPrev ? ((vinculo && vinculo.siiEnv) || 'PRODUCTION') : (credPayload.siiEnv || 'PRODUCTION'),
                hasCredentials: esPrev ? Boolean(vinculo && vinculo.hasCredentials) : true,
                credentialKind: esPrev ? ((vinculo && vinculo.credentialKind) || '') : credPayload.kind,
                hasPreviredCredentials: esPrev ? true : Boolean(vinculo && vinculo.hasPreviredCredentials),
                previredRutUsuario: esPrev ? credPayload.rutUsuario : ((vinculo && vinculo.previredRutUsuario) || ''),
                lastSyncAt: vinculo && vinculo.lastSyncAt ? vinculo.lastSyncAt : null
            });

            pintarContextBar();
            var br = bridge();
            if (br) br.refrescarTodo();

            var dlg = $('dlg-sii-conexion');
            if (dlg && dlg.open) dlg.close();
            if (D) D.avisar((esPrev ? 'Credenciales PreviRed guardadas para ' : 'Conexión SII guardada para ') + nom + '.');
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
            await api.eliminarCredenciales(vinculo.companyId, {
                kind: vinculo.credentialKind || 'CLAVE_TRIBUTARIA',
                siiEnv: vinculo.siiEnv || 'PRODUCTION'
            });
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

    async function revocarPreviredModal() {
        var nom = modalState.clienteNombre || clienteActivoNombre();
        var vinculo = vinculoDeCliente(nom);
        if (!vinculo || !vinculo.companyId) return;
        try {
            await api.eliminarCredenciales(vinculo.companyId, { kind: 'PREVIRED_CREDENTIALS', siiEnv: 'PRODUCTION' });
            tiendaVinculos.guardar(nom, Object.assign({}, vinculo, { hasPreviredCredentials: false, previredRutUsuario: '' }));
            delete previredPorCliente[nom.toLowerCase()];
            if ($('previred-estado-boveda')) $('previred-estado-boveda').hidden = true;
            if ($('btn-previred-revocar')) $('btn-previred-revocar').hidden = true;
            if ($('previred-input-pass')) {
                $('previred-input-pass').value = '';
                $('previred-input-pass').placeholder = 'Ingresa o reemplaza la clave PreviRed';
            }
            var br = bridge();
            if (br) br.refrescarTodo();
            if (D) D.avisar('Credenciales PreviRed desconectadas para ' + nom + '.');
        } catch (err) {
            mostrarFeedbackModal(err && err.message ? err.message : 'No se pudieron revocar las credenciales PreviRed.', 'error');
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
        var selTipo = $('torre-sync-tipo') ? $('torre-sync-tipo').value : 'ALL';
        var jtAll = (selTipo && selTipo !== 'ALL') ? selTipo : 'FULL_SYNC';
        batchSync = { activo: true, total: 0, completadas: 0, empresaActual: 'Iniciando cola SII...', estadosPorCompany: {} };
        pintarProgresoBatch();

        try {
            var res = await api.iniciarSyncAll({ period: per, jobType: jtAll });
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

    // ---------- TGR, PreviRed, DDJJ/F22, Alertas y Webhooks ----------
    function resolverNombrePorCompany(companyId, rutFallback) {
        var vinculos = tiendaVinculos.listar();
        var keys = Object.keys(vinculos);
        var rutNorm = rutFallback ? Sii.normalizarRut(rutFallback) : '';
        for (var i = 0; i < keys.length; i++) {
            var v = vinculos[keys[i]];
            if (v && ((companyId && v.companyId === companyId) || (rutNorm && v.rut === rutNorm))) {
                return v.razonSocial || keys[i];
            }
        }
        return rutFallback || companyId || '';
    }

    function estadoPreviredCliente(nombre) {
        var k = String(nombre || '').trim().toLowerCase();
        if (!k) return null;
        if (previredPorCliente[k]) return previredPorCliente[k];
        var br = bridge();
        if (br && k === br.clienteClave()) {
            var est = br.leerEstadoActual();
            if (est && est.siiPrevired) return Sii.resumirPreviredDesdeGateway(est.siiPrevired);
        }
        return null;
    }

    function pintarTgr(modelo) {
        var br = bridge();
        if (!br) return;
        var per = br.periodoActual();
        var est = (modelo && modelo.estado) || br.leerEstadoActual();
        var res = Sii.resumirTgrDesdeGateway(est ? est.siiTgr : null);
        if ($('f29-tgr-periodo')) $('f29-tgr-periodo').textContent = 'Período ' + per;
        if ($('f29-tgr-sello')) $('f29-tgr-sello').className = 'sello ' + res.selloCls;
        if ($('f29-tgr-sello-txt')) $('f29-tgr-sello-txt').textContent = res.selloTexto;
        if ($('f29-tgr-total')) $('f29-tgr-total').textContent = D ? D.money(res.totalAdeudado) : ('$' + res.totalAdeudado);
        if ($('f29-tgr-multas')) $('f29-tgr-multas').textContent = D ? D.money(res.totalMultasIntereses) : ('$' + res.totalMultasIntereses);
        if ($('f29-tgr-meta')) {
            $('f29-tgr-meta').textContent = res.synced
                ? ('Consultado en TGR (' + res.totalCount + ' registro(s)).' + (res.totalAdeudado > 0 ? ' Revisa giros o convenios pendientes.' : ' Sin deuda registrada para el período.'))
                : 'Consulta el estado real de pago, convenios o morosidades en Tesorería General de la República.';
        }
    }

    function pintarPrevired(modelo) {
        var br = bridge();
        if (!br) return;
        var nom = clienteActivoNombre();
        var per = br.periodoActual();
        var est = (modelo && modelo.estado) || br.leerEstadoActual();
        var res = Sii.resumirPreviredDesdeGateway(est ? est.siiPrevired : null);
        if (res.synced) previredPorCliente[nom.toLowerCase()] = res;

        if ($('rem-previred-sello')) $('rem-previred-sello').className = 'sello ' + res.selloCls;
        if ($('rem-previred-sello-txt')) $('rem-previred-sello-txt').textContent = res.selloTexto;
        if ($('rem-previred-deuda')) $('rem-previred-deuda').textContent = D ? D.money(res.totalDeudaEstimada) : ('$' + res.totalDeudaEstimada);
        if ($('rem-previred-periodo')) $('rem-previred-periodo').textContent = res.synced ? (res.period || per) : 'Sin sync';
        if ($('rem-previred-meta')) {
            $('rem-previred-meta').textContent = res.synced
                ? ('Estado oficial en PreviRed: ' + res.selloTexto + (res.totalDeudaEstimada > 0 ? ' · Deuda estimada declarada.' : ' · Cotizaciones al día.'))
                : 'Conecta la clave PreviRed de la empresa para verificar cotizaciones declaradas y pagadas.';
        }
        if ($('rem-ley-bustos-alert')) $('rem-ley-bustos-alert').hidden = !res.hasLeyBustosRisk;
    }

    function pintarDdjjYF22(modelo) {
        var br = bridge();
        if (!br) return;
        var est = (modelo && modelo.estado) || br.leerEstadoActual();
        var anio = ($('ddjj-anio') && $('ddjj-anio').value) || '2026';

        // Barra superior Renta SII
        var ddjjNorm = Sii.normalizarDdjjDesdeGateway(est ? est.siiDdjj : null);
        var f22Comp = Sii.compararF22ConSii(modelo ? modelo.f22 : null, est ? est.siiF22 : null);

        if ($('ddjj-sii-sello') && $('ddjj-sii-sello-txt')) {
            if (ddjjNorm.synced && ddjjNorm.observadasCount > 0) {
                $('ddjj-sii-sello').className = 'sello sello-riesgo';
                $('ddjj-sii-sello-txt').textContent = ddjjNorm.observadasCount + ' DDJJ observada(s)';
            } else if (ddjjNorm.synced || f22Comp.synced) {
                $('ddjj-sii-sello').className = 'sello sello-emitida';
                $('ddjj-sii-sello-txt').textContent = 'Renta AT ' + anio + ' sincronizada';
            } else {
                $('ddjj-sii-sello').className = 'sello sello-guardada';
                $('ddjj-sii-sello-txt').textContent = 'Renta SII sin sincronizar';
            }
        }

        // Panel DDJJ SII
        var panelDdjj = $('ddjj-sii-estado-panel');
        if (panelDdjj) {
            panelDdjj.hidden = !ddjjNorm.synced;
            if ($('ddjj-sii-at-lbl')) $('ddjj-sii-at-lbl').textContent = 'AT ' + anio;
            if ($('ddjj-sii-obs-badge')) {
                $('ddjj-sii-obs-badge').hidden = ddjjNorm.observadasCount === 0;
                $('ddjj-sii-obs-badge').className = ddjjNorm.observadasCount > 0 ? 'sello sello-riesgo' : 'sello sello-guardada';
                $('ddjj-sii-obs-badge').textContent = ddjjNorm.observadasCount + ' observada(s)';
            }
            if ($('tbody-ddjj-sii')) {
                $('tbody-ddjj-sii').innerHTML = ddjjNorm.items.length
                    ? ddjjNorm.items.map(function (it) {
                        var cls = it.esObservada ? 'sello-riesgo' : 'sello-emitida';
                        return '<tr>' +
                            '<td class="mono"><strong>DJ ' + D.esc(it.codigo) + '</strong></td>' +
                            '<td><span class="sello ' + cls + '">' + D.esc(it.estado) + '</span></td>' +
                            '<td class="mono">' + D.esc([it.fechaEnvio, it.folio ? ('Folio ' + it.folio) : ''].filter(Boolean).join(' · ') || 'Sin folio') + '</td>' +
                            '<td>' + (it.observacion ? D.esc(it.observacion) : '<span class="texto-ayuda">Sin observaciones</span>') + '</td>' +
                            '<td class="num"><button type="button" class="btn btn-chico" data-ddjj-abrir-tab="' + D.esc(it.tabDestino) + '">Abrir borrador</button></td>' +
                            '</tr>';
                    }).join('')
                    : '<tr><td colspan="5" class="texto-ayuda">Sin Declaraciones Juradas registradas en SII para AT ' + D.esc(anio) + '.</td></tr>';
            }
            if ($('ddjj-sii-cards')) {
                $('ddjj-sii-cards').innerHTML = ddjjNorm.items.map(function (it) {
                    var cls = it.esObservada ? 'sello-riesgo' : 'sello-emitida';
                    return '<article class="fin-card">' +
                        '<div class="fin-card-top"><strong class="mono">DJ ' + D.esc(it.codigo) + '</strong><span class="sello ' + cls + '">' + D.esc(it.estado) + '</span></div>' +
                        '<div class="fin-card-datos"><span class="mono">' + D.esc(it.folio || it.fechaEnvio || 'Sin folio') + '</span><span>' + D.esc(it.observacion || 'Sin observaciones') + '</span></div>' +
                        '<div class="fin-card-pie"><button type="button" class="btn btn-chico" data-ddjj-abrir-tab="' + D.esc(it.tabDestino) + '">Abrir borrador</button></div>' +
                        '</article>';
                }).join('');
            }
        }

        // Panel contraste F22
        var panelF22 = $('f22-sii-resumen-panel');
        if (panelF22) {
            panelF22.hidden = !f22Comp.synced;
            if (f22Comp.synced) {
                if ($('f22-sii-at-lbl')) $('f22-sii-at-lbl').textContent = 'AT ' + (f22Comp.anioTributario || anio);
                if ($('f22-sii-estado-sello')) {
                    $('f22-sii-estado-sello').className = 'sello ' + f22Comp.selloCls;
                    $('f22-sii-estado-sello').textContent = f22Comp.estado;
                }
                if ($('f22-sii-folio')) $('f22-sii-folio').textContent = f22Comp.folio;
                if ($('f22-sii-monto')) $('f22-sii-monto').textContent = D ? D.money(f22Comp.resultadoSii) : ('$' + f22Comp.resultadoSii);
                if ($('f22-sii-local')) $('f22-sii-local').textContent = D ? D.money(f22Comp.resultadoLocal) : ('$' + f22Comp.resultadoLocal);
                if ($('f22-sii-diff')) $('f22-sii-diff').textContent = D ? D.money(f22Comp.diferencia) : ('$' + f22Comp.diferencia);
            }
        }
    }

    function pintarPanelesModulos(modelo) {
        pintarTgr(modelo);
        pintarPrevired(modelo);
        pintarDdjjYF22(modelo);
    }

    function pintarAlertasEstudio() {
        var tbody = $('tbody-torre-alertas');
        var cards = $('torre-alertas-cards');
        var vacio = $('torre-alertas-vacio');
        var items = Array.isArray(alertasState.items) ? alertasState.items : [];

        var cntTodas = items.length;
        var cntCrit = 0;
        var cntWarn = 0;
        var cntInfo = 0;
        items.forEach(function (a) {
            var s = String(a.severity || 'INFO').toUpperCase();
            if (s === 'CRITICAL') cntCrit += 1;
            else if (s === 'WARNING') cntWarn += 1;
            else cntInfo += 1;
        });

        if ($('torre-alertas-total-pill')) $('torre-alertas-total-pill').textContent = String(cntTodas);
        if ($('torre-sev-cnt-todas')) $('torre-sev-cnt-todas').textContent = String(cntTodas);
        if ($('torre-sev-cnt-crit')) $('torre-sev-cnt-crit').textContent = String(cntCrit);
        if ($('torre-sev-cnt-warn')) $('torre-sev-cnt-warn').textContent = String(cntWarn);
        if ($('torre-sev-cnt-info')) $('torre-sev-cnt-info').textContent = String(cntInfo);

        var visibles = items.filter(function (a) {
            var sevOk = alertasState.filtroSev === 'TODAS' || String(a.severity || 'INFO').toUpperCase() === alertasState.filtroSev;
            var mod = Sii.metaModuloAlerta(a).modulo;
            var modOk = alertasState.filtroModulo === 'TODOS' || mod === alertasState.filtroModulo;
            return sevOk && modOk;
        });

        var riesgoTotal = visibles.reduce(function (acc, a) { return acc + (Number(a.amountAtRisk || 0) || 0); }, 0);
        if ($('torre-alerta-riesgo-total')) $('torre-alerta-riesgo-total').textContent = D ? D.money(riesgoTotal) : ('$' + riesgoTotal);
        if (vacio) vacio.hidden = visibles.length > 0;
        if ($('torre-alertas-tabla-wrap')) $('torre-alertas-tabla-wrap').hidden = visibles.length === 0;

        function badgeSev(sev) {
            var s = String(sev || 'INFO').toUpperCase();
            if (s === 'CRITICAL') return '<span class="sello sello-riesgo">Crítica</span>';
            if (s === 'WARNING') return '<span class="sello sello-preparada">Preventiva</span>';
            return '<span class="sello sello-guardada">Informativa</span>';
        }

        if (tbody) {
            tbody.innerHTML = visibles.map(function (a) {
                var meta = Sii.metaModuloAlerta(a);
                var empNom = a.razonSocial || resolverNombrePorCompany(a.companyId, a.rut);
                var monto = Number(a.amountAtRisk || 0) || 0;
                return '<tr>' +
                    '<td>' + badgeSev(a.severity) + '</td>' +
                    '<td><strong>' + D.esc(empNom) + '</strong>' + (a.rut ? '<div class="mono texto-ayuda">' + D.esc(Sii.normalizarRut(a.rut)) + '</div>' : '') + '</td>' +
                    '<td><span class="app-nav-chip">' + D.esc(meta.modulo) + '</span></td>' +
                    '<td><strong>' + D.esc(a.title || meta.textoDefecto) + '</strong>' + (a.detail ? '<div class="texto-ayuda">' + D.esc(a.detail) + '</div>' : '') + '</td>' +
                    '<td class="mono num">' + (monto > 0 ? D.money(monto) : '-') + '</td>' +
                    '<td class="num"><button type="button" class="btn btn-chico" data-alerta-trabajar="' + D.esc(empNom) + '" data-alerta-vista="' + D.esc(meta.vista) + '">Revisar cliente</button></td>' +
                    '</tr>';
            }).join('');
        }

        if (cards) {
            cards.innerHTML = visibles.map(function (a) {
                var meta = Sii.metaModuloAlerta(a);
                var empNom = a.razonSocial || resolverNombrePorCompany(a.companyId, a.rut);
                var monto = Number(a.amountAtRisk || 0) || 0;
                return '<article class="fin-card">' +
                    '<div class="fin-card-top"><div><strong>' + D.esc(empNom) + '</strong><div class="mono texto-ayuda">' + D.esc(meta.etiqueta) + '</div></div>' + badgeSev(a.severity) + '</div>' +
                    '<div><strong>' + D.esc(a.title || meta.textoDefecto) + '</strong>' + (a.detail ? '<p class="texto-ayuda" style="margin:4px 0 0">' + D.esc(a.detail) + '</p>' : '') + '</div>' +
                    '<div class="fin-card-datos"><span>En riesgo: <strong class="mono">' + (monto > 0 ? D.money(monto) : '$0') + '</strong></span></div>' +
                    '<div class="fin-card-pie"><button type="button" class="btn btn-chico" data-alerta-trabajar="' + D.esc(empNom) + '" data-alerta-vista="' + D.esc(meta.vista) + '">Revisar cliente</button></div>' +
                    '</article>';
            }).join('');
        }
    }

    async function cargarAlertasEstudio() {
        var br = bridge();
        if (!sesion.autenticado || !sesion.gatewayConfigured) {
            pintarAlertasEstudio();
            return;
        }
        try {
            var per = br ? br.periodoActual() : undefined;
            var res = await api.obtenerAlertasEstudio({ period: per });
            alertasState.items = Array.isArray(res.alerts) ? res.alerts : [];
        } catch (e) {
            alertasState.items = [];
        }
        pintarAlertasEstudio();
    }

    async function sincronizarModuloCliente(nombreCliente, jobType, opts) {
        var o = opts || {};
        var br = bridge();
        if (!br) return;
        var nom = nombreCliente || clienteActivoNombre();
        var per = br.periodoActual();
        var anio = ($('ddjj-anio') && $('ddjj-anio').value) || '2026';

        if (!sesion.autenticado || !sesion.gatewayConfigured) {
            abrirModalSii(nom, jobType === 'PREVIRED_STATUS' ? { metodo: 'PREVIRED_CREDENTIALS' } : undefined);
            return;
        }
        var vinculo = vinculoDeCliente(nom);
        if (!vinculo || !vinculo.companyId) {
            abrirModalSii(nom, jobType === 'PREVIRED_STATUS' ? { metodo: 'PREVIRED_CREDENTIALS' } : undefined);
            return;
        }
        if (jobType === 'PREVIRED_STATUS' && !vinculo.hasPreviredCredentials && !vinculo.hasCredentials) {
            abrirModalSii(nom, { metodo: 'PREVIRED_CREDENTIALS' });
            return;
        }
        if (jobType !== 'PREVIRED_STATUS' && !vinculo.hasCredentials) {
            abrirModalSii(nom);
            return;
        }

        var btn = o.btn || null;
        if (btn) btn.disabled = true;
        if (D) D.avisar('Consultando ' + jobType + ' para ' + nom + '...');

        try {
            var jt = (jobType && jobType !== 'ALL') ? jobType : 'FULL_SYNC';
            var job = await api.sincronizarYEsperar(vinculo.companyId, { period: per, jobType: jt, maxIntentos: 24, intervaloMs: 1200 });
            var stFinal = String((job && job.status) || '').toUpperCase();
            if (stFinal === 'FAILED' || stFinal === 'ERROR' || stFinal === 'CANCELLED') {
                throw new Error((job && (job.errorMessage || job.error)) || ('No se pudo completar ' + jt + '.'));
            }

            if (jt === 'TGR_DEBT' || jt === 'FULL_SYNC') {
                var tgr = await api.obtenerTgr(vinculo.companyId, { period: per }).catch(function () { return null; });
                if (tgr) {
                    br.guardarEstadoParaCliente(nom, per, function (est) { est.siiTgr = tgr; });
                }
            }
            if (jt === 'PREVIRED_STATUS' || jt === 'FULL_SYNC') {
                var prev = await api.obtenerPrevired(vinculo.companyId, { period: per }).catch(function () { return null; });
                if (prev) {
                    previredPorCliente[nom.toLowerCase()] = Sii.resumirPreviredDesdeGateway(prev);
                    br.guardarEstadoParaCliente(nom, per, function (est) { est.siiPrevired = prev; });
                }
            }
            if (jt === 'DDJJ_SUMMARY' || jt === 'FULL_SYNC') {
                var ddjj = await api.obtenerDdjj(vinculo.companyId, { anioTributario: anio }).catch(function () { return null; });
                if (ddjj) {
                    br.guardarEstadoParaCliente(nom, per, function (est) { est.siiDdjj = ddjj; });
                }
            }
            if (jt === 'F22_SUMMARY' || jt === 'FULL_SYNC') {
                var f22 = await api.obtenerF22(vinculo.companyId, { anioTributario: anio }).catch(function () { return null; });
                if (f22) {
                    br.guardarEstadoParaCliente(nom, per, function (est) { est.siiF22 = f22; });
                }
            }

            br.refrescarTodo();
            cargarAlertasEstudio().catch(function () { });
            if (D) D.avisar('Datos actualizados (' + jt + ') para ' + nom + '.');
        } catch (err) {
            if (D) D.avisar((err && err.message) || ('Error al consultar ' + jobType + '.'));
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ---------- Webhooks del Estudio ----------
    function mostrarFeedbackWebhook(texto, tipo) {
        var box = $('wh-dlg-feedback');
        if (!box) return;
        if (!texto) { box.hidden = true; box.textContent = ''; return; }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'ok' ? 'ok' : 'error');
        box.textContent = texto;
    }

    function pintarWebhooksModal() {
        var r = webhooksState.receptor || {};
        if ($('wh-receptor-sello')) {
            $('wh-receptor-sello').className = 'sello ' + (r.configurado ? 'sello-emitida' : 'sello-guardada');
            $('wh-receptor-sello').textContent = r.configurado ? 'HMAC activo' : 'Sin verificar';
        }
        if ($('wh-receptor-ultimo')) {
            $('wh-receptor-ultimo').textContent = r.ultimoEvento ? formatearFechaHora(r.ultimoEvento) : 'Sin registros';
        }

        var items = Array.isArray(webhooksState.items) ? webhooksState.items : [];
        if ($('wh-lista-vacio')) $('wh-lista-vacio').hidden = items.length > 0;
        if ($('tbody-wh-lista')) {
            $('tbody-wh-lista').innerHTML = items.map(function (w) {
                var evs = Array.isArray(w.events) ? w.events.join(', ') : '*';
                return '<tr>' +
                    '<td><div class="mono wh-url-txt">' + D.esc(w.url || '') + '</div><div class="texto-ayuda mono">' + D.esc(evs) + '</div></td>' +
                    '<td><span class="sello ' + (w.active !== false ? 'sello-emitida' : 'sello-guardada') + '">' + (w.active !== false ? 'Activo' : 'Inactivo') + '</span></td>' +
                    '<td class="num"><div class="wh-card-acciones">' +
                    '<button type="button" class="btn btn-chico" data-wh-test="' + D.esc(w.id) + '">Probar</button>' +
                    '<button type="button" class="btn btn-chico" data-wh-logs="' + D.esc(w.id) + '">Envíos</button>' +
                    '<button type="button" class="btn btn-chico" data-wh-eliminar="' + D.esc(w.id) + '">Eliminar</button>' +
                    '</div></td>' +
                    '</tr>';
            }).join('');
        }
        if ($('wh-lista-cards')) {
            $('wh-lista-cards').innerHTML = items.map(function (w) {
                var evs = Array.isArray(w.events) ? w.events.join(', ') : '*';
                return '<article class="fin-card">' +
                    '<div class="fin-card-top"><span class="mono wh-url-txt">' + D.esc(w.url || '') + '</span><span class="sello ' + (w.active !== false ? 'sello-emitida' : 'sello-guardada') + '">' + (w.active !== false ? 'Activo' : 'Inactivo') + '</span></div>' +
                    '<div class="texto-ayuda mono">' + D.esc(evs) + '</div>' +
                    '<div class="wh-card-acciones">' +
                    '<button type="button" class="btn btn-chico" data-wh-test="' + D.esc(w.id) + '">Probar</button>' +
                    '<button type="button" class="btn btn-chico" data-wh-logs="' + D.esc(w.id) + '">Envíos</button>' +
                    '<button type="button" class="btn btn-chico" data-wh-eliminar="' + D.esc(w.id) + '">Eliminar</button>' +
                    '</div></article>';
            }).join('');
        }
    }

    async function cargarWebhooksModal() {
        if (!sesion.autenticado || !sesion.gatewayConfigured) {
            pintarWebhooksModal();
            return;
        }
        try {
            var res = await Promise.all([
                api.listarWebhooks(),
                api.estadoReceptorWebhook().catch(function () { return null; })
            ]);
            webhooksState.items = (res[0] && Array.isArray(res[0].items)) ? res[0].items : [];
            if (res[1] && res[1].receptor) webhooksState.receptor = res[1].receptor;
        } catch (err) {
            mostrarFeedbackWebhook(err && err.message ? err.message : 'No pudimos cargar los webhooks.', 'error');
        }
        pintarWebhooksModal();
    }

    async function abrirModalWebhooks() {
        mostrarFeedbackWebhook('');
        if ($('wh-secret-box')) $('wh-secret-box').hidden = true;
        if ($('wh-deliveries-panel')) $('wh-deliveries-panel').hidden = true;
        if ($('wh-input-url-err')) $('wh-input-url-err').hidden = true;
        if (!sesion.verificada) await revisarSesionYGateway();
        if (!sesion.autenticado) {
            mostrarFeedbackWebhook('Inicia sesión con tu correo para administrar webhooks del estudio.', 'error');
        } else if (!sesion.gatewayConfigured) {
            mostrarFeedbackWebhook('Falta SII_GATEWAY_API_KEY en el servidor para habilitar webhooks.', 'error');
        }
        var dlg = $('dlg-webhooks-estudio');
        if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
        cargarWebhooksModal();
    }

    async function crearWebhookSubmit(ev) {
        if (ev) ev.preventDefault();
        mostrarFeedbackWebhook('');
        if ($('wh-input-url-err')) $('wh-input-url-err').hidden = true;
        var url = ($('wh-input-url') && $('wh-input-url').value.trim()) || '';
        if (!/^https:\/\/.+/i.test(url)) {
            if ($('wh-input-url-err')) {
                $('wh-input-url-err').hidden = false;
                $('wh-input-url-err').textContent = 'Ingresa una URL válida que comience con https://.';
            }
            if ($('wh-input-url')) $('wh-input-url').focus();
            return;
        }
        var checks = document.querySelectorAll('#wh-eventos-grupo input[name="wh-evento"]:checked');
        var events = Array.prototype.map.call(checks, function (c) { return c.value; });
        if (!events.length) {
            mostrarFeedbackWebhook('Selecciona al menos un evento para suscribir.', 'error');
            return;
        }
        var btn = $('btn-wh-crear');
        if (btn) btn.disabled = true;
        try {
            var r = await api.crearWebhook({ url: url, events: events });
            var wh = r && r.webhook ? r.webhook : {};
            if (wh.signingSecret && $('wh-secret-box') && $('wh-secret-valor')) {
                $('wh-secret-valor').textContent = wh.signingSecret;
                $('wh-secret-box').hidden = false;
            }
            if ($('wh-input-url')) $('wh-input-url').value = '';
            mostrarFeedbackWebhook('Webhook registrado correctamente.', 'ok');
            await cargarWebhooksModal();
        } catch (err) {
            mostrarFeedbackWebhook(err && err.message ? err.message : 'No pudimos crear el webhook.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function verEntregasWebhook(id) {
        try {
            var r = await api.entregasWebhook(id);
            var wh = webhooksState.items.filter(function (x) { return x.id === id; })[0];
            var items = Array.isArray(r.items) ? r.items : [];
            webhooksState.deliveriesWebhookId = id;
            if ($('wh-deliveries-panel')) $('wh-deliveries-panel').hidden = false;
            if ($('wh-deliveries-url')) $('wh-deliveries-url').textContent = (wh && wh.url) ? wh.url : id;
            if ($('tbody-wh-deliveries')) {
                $('tbody-wh-deliveries').innerHTML = items.length
                    ? items.map(function (d) {
                        var stOk = d.statusCode >= 200 && d.statusCode < 300;
                        return '<tr>' +
                            '<td class="mono">' + D.esc(formatearFechaHora(d.createdAt || d.attemptedAt || '')) + '</td>' +
                            '<td class="mono">' + D.esc(d.event || '') + '</td>' +
                            '<td><span class="sello ' + (stOk ? 'sello-emitida' : 'sello-riesgo') + '">' + D.esc(String(d.statusCode || d.status || '-')) + '</span></td>' +
                            '<td class="mono num">' + D.esc(String(d.attempts || d.attempt || 1)) + '</td>' +
                            '</tr>';
                    }).join('')
                    : '<tr><td colspan="4" class="texto-ayuda">Sin entregas registradas todavía.</td></tr>';
            }
        } catch (err) {
            mostrarFeedbackWebhook(err && err.message ? err.message : 'No pudimos leer las entregas.', 'error');
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
                var btnSel = ev.target.closest('[data-torre-sync-id]');
                if (btnSel) {
                    var nomSel = btnSel.getAttribute('data-torre-sync-nombre') || btnSel.getAttribute('data-torre-sync-id');
                    var selTipo = $('torre-sync-tipo') ? $('torre-sync-tipo').value : 'ALL';
                    var jt = (selTipo && selTipo !== 'ALL') ? selTipo : 'FULL_SYNC';
                    if (jt === 'FULL_SYNC') {
                        var brSel = bridge();
                        if (brSel && nomSel && nomSel.toLowerCase() !== brSel.clienteClave()) brSel.cambiarACliente(nomSel);
                        sincronizarMes();
                    } else {
                        sincronizarModuloCliente(nomSel, jt, { btn: btnSel });
                    }
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

        // Alertas consolidadas en Torre
        if ($('btn-torre-alertas-refresh')) {
            $('btn-torre-alertas-refresh').addEventListener('click', function () { cargarAlertasEstudio(); });
        }
        if ($('torre-alertas-sev-filtros')) {
            $('torre-alertas-sev-filtros').addEventListener('click', function (ev) {
                var chip = ev.target.closest('[data-alerta-sev]');
                if (!chip) return;
                alertasState.filtroSev = chip.getAttribute('data-alerta-sev') || 'TODAS';
                Array.prototype.forEach.call($('torre-alertas-sev-filtros').querySelectorAll('[data-alerta-sev]'), function (b) {
                    var act = b === chip;
                    b.classList.toggle('activo', act);
                    b.setAttribute('aria-selected', act ? 'true' : 'false');
                });
                pintarAlertasEstudio();
            });
        }
        if ($('torre-alerta-modulo')) {
            $('torre-alerta-modulo').addEventListener('change', function () {
                alertasState.filtroModulo = $('torre-alerta-modulo').value || 'TODOS';
                pintarAlertasEstudio();
            });
        }
        function onAlertaRevisar(ev) {
            var btn = ev.target.closest('[data-alerta-trabajar]');
            if (!btn) return;
            var nom = btn.getAttribute('data-alerta-trabajar');
            var vista = btn.getAttribute('data-alerta-vista') || 'f29';
            var br = bridge();
            if (!br) return;
            if (nom) br.cambiarACliente(nom);
            br.cambiarModulo(vista);
        }
        if ($('tbody-torre-alertas')) $('tbody-torre-alertas').addEventListener('click', onAlertaRevisar);
        if ($('torre-alertas-cards')) $('torre-alertas-cards').addEventListener('click', onAlertaRevisar);

        // Botones TGR, PreviRed, DDJJ y F22
        if ($('btn-f29-tgr-sync')) {
            $('btn-f29-tgr-sync').addEventListener('click', function () {
                sincronizarModuloCliente(clienteActivoNombre(), 'TGR_DEBT', { btn: $('btn-f29-tgr-sync') });
            });
        }
        if ($('btn-rem-previred-cred')) {
            $('btn-rem-previred-cred').addEventListener('click', function () {
                abrirModalSii(clienteActivoNombre(), { metodo: 'PREVIRED_CREDENTIALS' });
            });
        }
        if ($('btn-rem-previred-sync')) {
            $('btn-rem-previred-sync').addEventListener('click', function () {
                sincronizarModuloCliente(clienteActivoNombre(), 'PREVIRED_STATUS', { btn: $('btn-rem-previred-sync') });
            });
        }
        if ($('btn-rem-ley-bustos-ver')) {
            $('btn-rem-ley-bustos-ver').addEventListener('click', function () {
                var rFin = document.querySelector('input[name="modo"][value="finiquitos"]');
                if (rFin) {
                    rFin.checked = true;
                    rFin.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        if ($('btn-ddjj-sii-sync-ddjj')) {
            $('btn-ddjj-sii-sync-ddjj').addEventListener('click', function () {
                sincronizarModuloCliente(clienteActivoNombre(), 'DDJJ_SUMMARY', { btn: $('btn-ddjj-sii-sync-ddjj') });
            });
        }
        if ($('btn-ddjj-sii-sync-f22')) {
            $('btn-ddjj-sii-sync-f22').addEventListener('click', function () {
                sincronizarModuloCliente(clienteActivoNombre(), 'F22_SUMMARY', { btn: $('btn-ddjj-sii-sync-f22') });
            });
        }
        function onDdjjAbrirTab(ev) {
            var btn = ev.target.closest('[data-ddjj-abrir-tab]');
            if (!btn) return;
            var tab = btn.getAttribute('data-ddjj-abrir-tab');
            var target = document.querySelector('[data-subddjj="' + tab + '"]');
            if (target) target.click();
        }
        if ($('tbody-ddjj-sii')) $('tbody-ddjj-sii').addEventListener('click', onDdjjAbrirTab);
        if ($('ddjj-sii-cards')) $('ddjj-sii-cards').addEventListener('click', onDdjjAbrirTab);

        // Modal Webhooks
        var dlgWh = $('dlg-webhooks-estudio');
        if ($('btn-torre-webhooks')) $('btn-torre-webhooks').addEventListener('click', abrirModalWebhooks);
        if ($('btn-cerrar-wh-dlg')) $('btn-cerrar-wh-dlg').addEventListener('click', function () { if (dlgWh && dlgWh.open) dlgWh.close(); });
        if ($('btn-wh-usar-receptor') && $('wh-input-url')) {
            $('btn-wh-usar-receptor').addEventListener('click', function () {
                $('wh-input-url').value = window.location.origin + '/api/pyme/gateway-webhook';
            });
        }
        if ($('form-wh-crear')) $('form-wh-crear').addEventListener('submit', crearWebhookSubmit);
        if ($('btn-wh-copiar-secret') && $('wh-secret-valor')) {
            $('btn-wh-copiar-secret').addEventListener('click', function () {
                var val = $('wh-secret-valor').textContent || '';
                if (!val) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(val).then(function () {
                        mostrarFeedbackWebhook('Secreto HMAC copiado al portapapeles.', 'ok');
                    }).catch(function () { });
                }
            });
        }
        if ($('btn-wh-cerrar-deliveries') && $('wh-deliveries-panel')) {
            $('btn-wh-cerrar-deliveries').addEventListener('click', function () { $('wh-deliveries-panel').hidden = true; });
        }
        async function onWebhookAccion(ev) {
            var bTest = ev.target.closest('[data-wh-test]');
            if (bTest) {
                try {
                    await api.probarWebhook(bTest.getAttribute('data-wh-test'));
                    mostrarFeedbackWebhook('Evento de prueba enviado.', 'ok');
                } catch (err) {
                    mostrarFeedbackWebhook(err && err.message ? err.message : 'No se pudo probar el webhook.', 'error');
                }
                return;
            }
            var bLogs = ev.target.closest('[data-wh-logs]');
            if (bLogs) {
                verEntregasWebhook(bLogs.getAttribute('data-wh-logs'));
                return;
            }
            var bDel = ev.target.closest('[data-wh-eliminar]');
            if (bDel) {
                var idDel = bDel.getAttribute('data-wh-eliminar');
                try {
                    await api.eliminarWebhook(idDel);
                    if (webhooksState.deliveriesWebhookId === idDel && $('wh-deliveries-panel')) {
                        $('wh-deliveries-panel').hidden = true;
                    }
                    mostrarFeedbackWebhook('Webhook eliminado.', 'ok');
                    await cargarWebhooksModal();
                } catch (err) {
                    mostrarFeedbackWebhook(err && err.message ? err.message : 'No se pudo eliminar el webhook.', 'error');
                }
            }
        }
        if ($('tbody-wh-lista')) $('tbody-wh-lista').addEventListener('click', onWebhookAccion);
        if ($('wh-lista-cards')) $('wh-lista-cards').addEventListener('click', onWebhookAccion);

        // Modal controls
        var dlg = $('dlg-sii-conexion');
        function cerrarDlg() { if (dlg && dlg.open) dlg.close(); }
        if ($('btn-cerrar-sii-dlg')) $('btn-cerrar-sii-dlg').addEventListener('click', cerrarDlg);
        if ($('btn-sii-cancelar')) $('btn-sii-cancelar').addEventListener('click', cerrarDlg);
        if ($('btn-sii-ir-sesion')) $('btn-sii-ir-sesion').addEventListener('click', function () { window.open('/app', '_blank'); });
        if ($('tab-metodo-clave')) $('tab-metodo-clave').addEventListener('click', function () { cambiarTabMetodo('CLAVE_TRIBUTARIA'); });
        if ($('tab-metodo-pfx')) $('tab-metodo-pfx').addEventListener('click', function () { cambiarTabMetodo('PFX_CERTIFICATE'); });
        if ($('tab-metodo-previred')) $('tab-metodo-previred').addEventListener('click', function () { cambiarTabMetodo('PREVIRED_CREDENTIALS'); });
        if ($('btn-sii-guardar')) $('btn-sii-guardar').addEventListener('click', guardarConexionModal);
        if ($('btn-sii-revocar')) $('btn-sii-revocar').addEventListener('click', revocarCredencialesModal);
        if ($('btn-previred-revocar')) $('btn-previred-revocar').addEventListener('click', revocarPreviredModal);
        if ($('btn-toggle-previred-pass') && $('previred-input-pass')) {
            $('btn-toggle-previred-pass').addEventListener('click', function () {
                var inp = $('previred-input-pass');
                var esPass = inp.type === 'password';
                inp.type = esPass ? 'text' : 'password';
                var ic = $('btn-toggle-previred-pass').querySelector('.material-icons');
                if (ic) ic.textContent = esPass ? 'visibility_off' : 'visibility';
            });
        }
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
            var det = ev && ev.detail ? ev.detail : null;
            pintarContextBar();
            pintarBannerF29(det);
            pintarPanelesModulos(det);
        });

        window.addEventListener('focus', function () {
            revisarSesionYGateway();
        });

        revisarSesionYGateway();
    });

    function alertasParaCliente(nombreCliente) {
        var objetivo = String(nombreCliente || '').trim().toLowerCase();
        var items = Array.isArray(alertasState.items) ? alertasState.items : [];
        return items.filter(function (a) {
            if (!objetivo) return true;
            var empNom = String(a.razonSocial || resolverNombrePorCompany(a.companyId, a.rut) || '').trim().toLowerCase();
            return empNom === objetivo;
        }).map(function (a) {
            var meta = Sii.metaModuloAlerta(a);
            return {
                modulo: meta.modulo,
                severity: String(a.severity || 'INFO').toUpperCase(),
                title: a.title || meta.textoDefecto,
                detail: a.detail || '',
                amountAtRisk: Number(a.amountAtRisk || 0) || 0
            };
        });
    }

    window.CLDemoSii = {
        rutDeCliente: rutDeCliente,
        guardarRutCliente: guardarRutCliente,
        celdaTorre: celdaTorre,
        filaActivaSync: filaActivaSync,
        abrirModalSii: abrirModalSii,
        estadoConexionCliente: estadoConexionCliente,
        sincronizarMes: sincronizarMes,
        sincronizarCarteraCompleta: sincronizarCarteraCompleta,
        revisarSesionYGateway: revisarSesionYGateway,
        estadoPreviredCliente: estadoPreviredCliente,
        cargarAlertasEstudio: cargarAlertasEstudio,
        alertasParaCliente: alertasParaCliente
    };
})();
