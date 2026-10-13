/*
 * CalculoLaboral · software del Asistente Laboral Pyme en /app (v1.1.0)
 * Marco con menú lateral y rutas propias (/app, /app/trabajadores, /app/trabajadores/<id>/<pestaña>, /app/liquidaciones[/<id>],
 * /app/documentos?t=&d=, /app/vacaciones?t=, /app/calendario, /app/contratos, /app/empresa, /app/cuenta). Inicio es el cierre del mes: una fila por trabajador con el
 * estado de su liquidación, la franja de cifras, el panel de detalle y los avisos del mes.
 * Hereda del panel anterior (js/pyme_app.js) la entrada por correo, la ficha de empresa y trabajadores, las liquidaciones por mes,
 * los documentos (contrato, anexos y finiquito incluidos, sin salir del asistente), el Pase Pyme y los datos de la cuenta.
 * Requiere: rut_cl.js, liquidacion_parametros.js, liquidacion_valores.js, liquidacion_engine.js, liquidacion_documento.js, feriados_cl.js,
 * pyme_pendientes.js, pyme_liquidaciones.js, pyme_docs.js y pyme_vacaciones.js (antes que este archivo). La API es /api/pyme/*.
 * Todo texto de usuario se escapa antes de mostrarse.
 */
(function () {
    'use strict';

    var Rut = window.CLRut, P = window.CLLiquidacionParametros, F = window.CLFeriados, PEND = window.CLPymePendientes;
    var L = window.CLPymeLiquidaciones, E = window.CLLiquidacionEngine, VL = window.CLLiquidacionValores, DOC = window.CLLiquidacionDocumento, PD = window.CLPymeDocs;
    var VAC = window.CLPymeVacaciones;
    if (!Rut || !P || !F || !PEND || !L || !E || !VL || !DOC || !PD || !VAC || !document.getElementById('pm-panel')) return;

    var KEY_RESPALDO = 'cl_pyme_respaldo';
    var KEY_GENERADOR = 'cl_liq_v1';
    var KEY_IMPORTADO = 'cl_pyme_importado';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    var AFPS = Object.keys(P.VIGENCIAS[P.VIGENCIAS.length - 1].afp).sort();

    var estado = null;        // lo último que dijo el servidor
    var volvioDePago = false; // el aviso de ?pase= se atiende una sola vez
    var editandoId = null;    // id del trabajador cuya ficha está abierta (null = nuevo)
    var logoActual = '';      // data URL del logo en el formulario de la empresa
    var inicioSel = null;     // trabajador elegido en la grilla del cierre
    var vacSel = null;        // trabajador elegido en Vacaciones
    var vacCache = [];        // registros de vacaciones de la empresa (descifrados por el servidor)
    var docsCache = [];       // historial de documentos emitidos (tipo y fecha)
    var docPrefill = null;    // valores que trae la dirección para el comprobante de feriado

    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function pesos(n) { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
    function fechaLarga(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1] + ' de ' + a[0]; }
    function fechaCorta(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' ' + MESES_CORTOS[+a[1] - 1]; }
    function fechaCortaAnio(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' ' + MESES_CORTOS[+a[1] - 1] + ' ' + a[0]; }
    // Fecha de un instante (vencimiento del pase) en hora de Chile, para que de noche no se corra un día
    function isoChile(iso) {
        try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch (e) { return String(iso).slice(0, 10); }
    }
    function fechaVence(iso) { return fechaLarga(isoChile(iso)); }
    function guardado(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
    function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

    // ---------- API ----------
    function api(ruta, o) {
        o = o || {};
        var url = '/api/pyme/' + ruta + (o.query ? '?' + new URLSearchParams(o.query).toString() : '');
        var init = { method: o.metodo || 'GET', credentials: 'same-origin', headers: {} };
        if (init.method !== 'GET') {
            init.headers['Content-Type'] = 'application/json';
            init.headers['X-CL-Pyme'] = '1';
            init.body = JSON.stringify(o.cuerpo || {});
        }
        return fetch(url, init).then(function (r) {
            return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, estado: r.status, datos: d || {} }; });
        }, function () {
            return { ok: false, estado: 0, datos: { error: 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.' } };
        });
    }

    // Confirmación o error visible arriba del contenido
    function avisoGlobal(tipo, texto) {
        var icono = { ok: 'check_circle', info: 'info', error: 'error' }[tipo];
        $('pm-aviso-global').innerHTML = texto ? '<div class="lq-aviso lq-aviso-' + (tipo === 'error' ? 'error' : 'info') + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + '</p></div>' : '';
    }

    // Sesión vencida en cualquier llamada: vuelve a la entrada con un aviso
    function sinSesion(r) {
        if (r.estado === 401) { mostrar('entrada', 'Tu sesión venció. Entra de nuevo con tu correo.'); return true; }
        return false;
    }

    // ---------- pantallas generales ----------
    function mostrar(vista, nota) {
        $('pm-cargando').hidden = vista !== 'cargando';
        $('pm-fallo').hidden = vista !== 'fallo';
        $('pm-entrada').hidden = vista !== 'entrada';
        $('pm-panel').hidden = vista !== 'panel';
        if (vista === 'entrada') {
            document.title = 'Entrar · Asistente Laboral Pyme';
            $('pm-entrar-form').hidden = false;
            $('pm-entrar-listo').hidden = true;
            $('pm-entrar-error').hidden = true;
            var n = $('pm-entrada-nota');
            n.hidden = !nota;
            if (nota) n.querySelector('p').textContent = nota;
        }
    }

    function mensaje(el, tipo, texto) {
        el.className = 'lq-estado' + (tipo === 'ok' ? ' lq-estado-ok' : tipo === 'error' ? ' lq-estado-error' : '');
        el.textContent = texto || '';
    }

    // Confirmación propia (en vez de window.confirm): nombra la consecuencia en el botón y devuelve el foco
    function confirmar(titulo, texto, etiqueta) {
        var dlg = $('app-confirmar'), previo = document.activeElement;
        if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(titulo + ' ' + texto));
        $('app-confirmar-titulo').textContent = titulo;
        $('app-confirmar-texto').textContent = texto;
        $('app-confirmar-ok').textContent = etiqueta;
        return new Promise(function (resolver) {
            dlg.addEventListener('close', function alCerrar() {
                dlg.removeEventListener('close', alCerrar);
                if (previo && previo.focus && document.contains(previo)) previo.focus();
                resolver(dlg.returnValue === 'ok');
            });
            dlg.returnValue = '';
            dlg.showModal();
            $('app-confirmar-cancelar').focus();
        });
    }

    // ---------- rutas ----------
    var VISTAS = { '': 'inicio', trabajadores: 'trabajadores', vacaciones: 'vacaciones', liquidaciones: 'liquidaciones', documentos: 'documentos', calendario: 'calendario', contratos: 'contratos', empresa: 'empresa', cuenta: 'cuenta' };
    var TITULOS = { inicio: 'Cierre del mes', trabajadores: 'Trabajadores', trabajador: 'Trabajador', vacaciones: 'Vacaciones', liquidaciones: 'Liquidaciones', documentos: 'Documentos', calendario: 'Calendario', contratos: 'Contratos y finiquitos', empresa: 'Empresa', cuenta: 'Mi cuenta' };
    var vistaActual = null;

    function rutaActual() { return window.location.pathname.replace(/^\/app\/?/, '').replace(/\/+$/, ''); }
    function navegar(ruta, opciones) {
        opciones = opciones || {};
        var url = '/app' + (ruta ? '/' + ruta : '') + (opciones.query ? '?' + opciones.query : '');
        try {
            if (opciones.reemplazar) window.history.replaceState({}, '', url); else window.history.pushState({}, '', url);
        } catch (e) { window.location.href = url; return; }
        cerrarMenu(true);
        dibujarRuta();
        if (!opciones.sinScroll) window.scrollTo(0, 0);
        if (!opciones.reemplazar) enfocarTitulo();
    }
    // Al cambiar de sección el foco pasa al título: el lector de pantalla anuncia dónde está y el teclado parte de ahí
    function enfocarTitulo() {
        var h = document.querySelector('.vista:not([hidden]) .v-titulo');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.addEventListener('popstate', function () { if (estado) dibujarRuta(); });

    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-ruta]');
        if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navegar(a.getAttribute('data-ruta'), { query: a.getAttribute('data-query') || '' });
    });

    function dibujarRuta() {
        if (!estado) return;
        var partes = rutaActual().split('/'), base = partes[0] || '';
        var vista = VISTAS.hasOwnProperty(base) ? VISTAS[base] : null;
        if (vista === null) { navegar('', { reemplazar: true }); return; }
        if (base === 'trabajadores' && partes[1]) vista = 'trabajador';
        if (vista !== vistaActual) avisoGlobal('', '');
        vistaActual = vista;
        Array.prototype.forEach.call(document.querySelectorAll('.vista'), function (s) { s.hidden = s.getAttribute('data-vista') !== vista; });
        Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
            if (a.getAttribute('data-nav') === base) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        if (['', 'trabajadores', 'liquidaciones', 'calendario'].indexOf(base) < 0) $('app-mas').setAttribute('aria-current', 'page'); else $('app-mas').removeAttribute('aria-current');
        document.title = TITULOS[vista] + ' · Asistente Laboral Pyme';
        if (vista === 'inicio') dibujarInicio();
        else if (vista === 'trabajadores') dibujarTrabajadores();
        else if (vista === 'trabajador') abrirCarpeta(partes[1], partes[2] || 'ficha');
        else if (vista === 'liquidaciones') rutaLiquidaciones(partes[1]);
        else if (vista === 'documentos') rutaDocumentos();
        else if (vista === 'vacaciones') rutaVacaciones();
        else if (vista === 'calendario') dibujarCalendario();
        else if (vista === 'contratos') dibujarContratos();
        else if (vista === 'empresa') dibujarEmpresa();
        else if (vista === 'cuenta') dibujarCuenta();
        contarVista(vista === 'trabajador' ? 'trabajadores/' + (partes[1] === 'nuevo' ? 'nuevo' : 'carpeta/' + (partes[2] || 'ficha')) : base);
    }

    // Visitas en GA4 con rutas genéricas: nunca se envían ids de trabajadores
    function contarVista(ruta) {
        try { if (window.gtag) window.gtag('event', 'page_view', { page_title: document.title, page_location: window.location.origin + '/app' + (ruta ? '/' + ruta : '') }); } catch (e) { /* sin analítica */ }
    }

    // Menú en pantallas chicas
    var disparadorMenu = null;
    function inertar(si) { ['app-principal', 'app-barra'].forEach(function (id) { var el = $(id); if (el) { if (si) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } }); }
    function cerrarMenu(sinFoco) {
        var estabaAbierto = $('pm-panel').classList.contains('menu-abierto');
        $('pm-panel').classList.remove('menu-abierto'); $('app-menu').setAttribute('aria-expanded', 'false'); $('app-mas').setAttribute('aria-expanded', 'false');
        inertar(false);
        if (estabaAbierto && sinFoco !== true && disparadorMenu && disparadorMenu.focus) disparadorMenu.focus();
    }
    function abrirMenu(disparador) {
        disparadorMenu = disparador;
        $('pm-panel').classList.add('menu-abierto');
        $('app-mas').setAttribute('aria-expanded', 'true');
        inertar(true);
        var primero = $('app-cerrar'); if (primero) primero.focus();
    }
    $('app-menu').addEventListener('click', function () { if ($('pm-panel').classList.contains('menu-abierto')) cerrarMenu(); else abrirMenu($('app-menu')); });
    $('app-mas').addEventListener('click', function () { abrirMenu($('app-mas')); });
    $('app-cerrar').addEventListener('click', function () { cerrarMenu(); });
    $('app-velo').addEventListener('click', function () { cerrarMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('pm-panel').classList.contains('menu-abierto')) cerrarMenu(); });

    // ---------- campos de formulario ----------
    function valorDe(el) {
        if (el.type === 'checkbox') return el.checked;
        var tipo = el.getAttribute('data-tipo'), v = el.value.trim();
        if (tipo === 'pesos' || tipo === 'num') return v === '' ? '' : parseInt(v.replace(/\D/g, ''), 10) || 0;
        return v;
    }
    function ponerValor(el, v) {
        if (el.type === 'checkbox') { el.checked = !!v; return; }
        var tipo = el.getAttribute('data-tipo');
        if (v === undefined || v === null || v === '') { el.value = ''; return; }
        if (tipo === 'pesos') el.value = v > 0 ? pesos(v) : '';
        else if (tipo === 'uf' || tipo === 'dec') el.value = v ? String(v).replace('.', ',') : '';
        else el.value = String(v);
    }
    function recoger(form) {
        var o = {};
        Array.prototype.forEach.call(form.querySelectorAll('[data-k]'), function (el) { o[el.getAttribute('data-k')] = valorDe(el); });
        return o;
    }
    function llenar(form, datos) {
        Array.prototype.forEach.call(form.querySelectorAll('[data-k]'), function (el) { ponerValor(el, datos[el.getAttribute('data-k')]); });
    }
    function limpiarErrores(form) {
        Array.prototype.forEach.call(form.querySelectorAll('[data-error]'), function (p) { p.hidden = true; p.textContent = ''; });
        Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (el) { el.removeAttribute('aria-invalid'); });
    }
    function mostrarErrores(form, errores) {
        var primero = null;
        Object.keys(errores || {}).forEach(function (k) {
            var p = form.querySelector('[data-error="' + k + '"]'), campo = form.querySelector('[data-k="' + k + '"]');
            if (p) { p.textContent = errores[k]; p.hidden = false; }
            if (campo) { campo.setAttribute('aria-invalid', 'true'); if (!primero) primero = campo; }
        });
        if (primero) primero.focus();
    }
    function aplicarMascaras(form) {
        form.addEventListener('blur', function (e) {
            var el = e.target, tipo = el.getAttribute && el.getAttribute('data-tipo');
            if (!tipo) return;
            if (tipo === 'rut') el.value = Rut.formatear(el.value);
            else if (tipo === 'pesos') { var n = parseInt(el.value.replace(/\D/g, ''), 10); el.value = n > 0 ? pesos(n) : ''; }
        }, true);
        form.addEventListener('input', function (e) {
            var el = e.target, tipo = el.getAttribute && el.getAttribute('data-tipo');
            if (tipo === 'num') el.value = el.value.replace(/\D/g, '');
            else if (tipo === 'uf' || tipo === 'dec') el.value = el.value.replace(/[^\d,.]/g, '');
        });
    }
    function condicionales() {
        var f = $('pm-trab-form');
        var contrato = f.querySelector('[data-k="contrato"]').value, salud = f.querySelector('[data-k="salud"]').value;
        Array.prototype.forEach.call(f.querySelectorAll('[data-si-contrato]'), function (el) { el.hidden = el.getAttribute('data-si-contrato') !== contrato; });
        Array.prototype.forEach.call(f.querySelectorAll('[data-si-salud]'), function (el) { el.hidden = el.getAttribute('data-si-salud') !== salud; });
    }

    // ---------- entrar y salir ----------
    $('pm-entrar-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var correo = $('pm-email').value.trim(), err = $('pm-entrar-error'), btn = $('pm-entrar-btn');
        err.hidden = true;
        if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(correo)) { err.textContent = 'Escribe un correo válido.'; err.hidden = false; $('pm-email').focus(); return; }
        btn.disabled = true;
        api('entrar', { metodo: 'POST', cuerpo: { email: correo } }).then(function (r) {
            btn.disabled = false;
            if (r.ok) { $('pm-entrar-form').hidden = true; $('pm-entrar-listo').hidden = false; return; }
            err.textContent = r.datos.error || 'No pudimos enviar el enlace. Intenta de nuevo.';
            err.hidden = false;
        });
    });
    $('pm-otro-correo').addEventListener('click', function () {
        $('pm-entrar-form').hidden = false; $('pm-entrar-listo').hidden = true; $('pm-email').value = ''; $('pm-email').focus();
    });
    $('pm-reintentar').addEventListener('click', function () { mostrar('cargando'); arrancar(); });
    $('pm-salir').addEventListener('click', function () {
        api('salir', { metodo: 'POST' }).then(function () { reiniciar(); mostrar('entrada'); });
    });

    // Olvida todo lo que se cargó de la cuenta (al salir o al eliminarla)
    function reiniciar() {
        estado = null; mesesCache = {}; editando = null; periodoSel = null; ultimasImpresas = []; inicioSel = null; vistaActual = null;
        vacSel = null; vacCache = []; docsCache = []; docPrefill = null;
        docSel = { trabajadorId: null, tipo: null, datos: {}, intento: false, listo: false };
        $('print-section').innerHTML = '';
        $('pm-liq-editor').hidden = true;
    }

    // ---------- carga del estado ----------
    function cargar() {
        return api('estado').then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) {
                // Sin conexión o falla del servidor: la sesión puede seguir vigente, así que se ofrece reintentar en vez de pedir el correo
                if (r.estado === 0 || r.estado >= 500) { $('pm-fallo-texto').textContent = r.estado === 0 ? 'Revisa tu conexión a internet e intenta de nuevo. Tus datos siguen guardados.' : 'Tuvimos un problema en nuestro servidor. Intenta de nuevo en unos minutos; tus datos siguen guardados.'; mostrar('fallo'); return; }
                mostrar('entrada', r.datos.error || 'No pudimos cargar tus datos.'); return;
            }
            estado = r.datos;
            if (!periodoSel) periodoSel = periodoPorDefecto();
            dibujarMarco();
            mostrar('panel');
            if (!volvioDePago) { volvioDePago = true; volverDePago(); }
            dibujarRuta();
            return Promise.all([cargarLiquidaciones(), cargarExtras()]);
        });
    }

    // Vacaciones e historial de documentos: se cargan aparte y redibujan solo lo que los muestra
    function cargarExtras() {
        return Promise.all([api('vacaciones'), api('documentos')]).then(function (rs) {
            if (rs.some(sinSesion)) return;
            if (rs[0].ok) vacCache = rs[0].datos.vacaciones || [];
            if (rs[1].ok) docsCache = rs[1].datos.documentos || [];
            redibujarExtras();
        });
    }
    function redibujarExtras() {
        if (!estado) return;
        if (vistaActual === 'inicio') dibujarInicio();
        else if (vistaActual === 'vacaciones') dibujarVacaciones();
        else if (vistaActual === 'calendario') dibujarCalendario();
        else if (vistaActual === 'documentos') dibujarHistorialDocs();
        else if (vistaActual === 'contratos') dibujarContratos();
        else if (vistaActual === 'trabajador') {
            var p = rutaActual().split('/');
            if (p[2] === 'vacaciones' || p[2] === 'documentos') abrirCarpeta(p[1], p[2]);
        }
    }
    function vacDe(id) { return vacCache.filter(function (v) { return v.trabajadorId === id; }); }
    function resumenVac(t) { return VAC.resumen(t, vacDe(t.id), hoyIso()); }
    function textoDias(n) { return plural(n, 'día', 'días'); }
    function rangoCorto(desde, hasta) {
        if (desde === hasta) return fechaCorta(desde);
        return desde.slice(0, 7) === hasta.slice(0, 7) ? (+desde.slice(8)) + ' al ' + fechaCorta(hasta) : fechaCorta(desde) + ' al ' + fechaCorta(hasta);
    }

    // Lo que se ve en todas las pantallas: empresa en el menú, cuenta y pase en la barra
    function dibujarMarco() {
        var e = estado.empresa;
        $('app-empresa-nombre').textContent = e ? e.razonSocial : 'Tu empresa';
        $('app-empresa-rut').textContent = e ? 'RUT ' + Rut.formatear(e.rut) : 'Faltan los datos de la empresa';
        $('pm-correo').textContent = estado.cuenta.email;
        $('cuenta-correo').textContent = estado.cuenta.email;
        var lim = estado.limites, caja = $('app-pase'), txt = $('app-pase-texto');
        caja.classList.remove('vigente', 'porvencer');
        if (lim.paseVence && Date.parse(lim.paseVence) > Date.now()) {
            var dias = PEND.dias(hoyIso(), isoChile(lim.paseVence));
            caja.classList.add(dias <= 15 ? 'porvencer' : 'vigente');
            txt.textContent = 'Pase vigente hasta el ' + fechaCortaAnio(isoChile(lim.paseVence));
        } else {
            txt.textContent = 'Sin Pase Pyme';
        }
        dibujarImportar();
        dibujarPase();
    }

    // ---------- empresa ----------
    function dibujarEmpresa() {
        var f = $('pm-emp-form');
        limpiarErrores(f);
        llenar(f, estado.empresa || {});
        logoActual = (estado.empresa && estado.empresa.logo) || '';
        dibujarLogo();
        mensaje($('pm-emp-estado'), '', '');
    }
    function dibujarLogo() {
        var caja = $('pm-logo-prev');
        caja.hidden = !logoActual;
        caja.innerHTML = logoActual ? '<img class="pm-logo-prev" src="' + esc(logoActual) + '" alt="Logo de la empresa">' : '';
        $('pm-logo-quitar').hidden = !logoActual;
    }
    $('pm-logo').addEventListener('change', function (e) {
        var archivo = e.target.files && e.target.files[0], f = $('pm-emp-form');
        limpiarErrores(f);
        if (!archivo) return;
        if (['image/png', 'image/jpeg', 'image/webp'].indexOf(archivo.type) < 0 || archivo.size > 100 * 1024) {
            mostrarErrores(f, { logo: 'El logo debe ser una imagen PNG, JPG o WebP de hasta 100 KB.' });
            e.target.value = '';
            return;
        }
        var lector = new FileReader();
        lector.onload = function () { logoActual = String(lector.result); dibujarLogo(); };
        lector.readAsDataURL(archivo);
    });
    $('pm-logo-quitar').addEventListener('click', function () { logoActual = ''; $('pm-logo').value = ''; dibujarLogo(); });

    $('pm-emp-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = $('pm-emp-form'), datos = recoger(f), est = $('pm-emp-estado');
        datos.logo = logoActual;
        limpiarErrores(f);
        mensaje(est, '', 'Guardando…');
        api('empresa', { metodo: 'PUT', cuerpo: { empresa: datos } }).then(function (r) {
            if (sinSesion(r)) return;
            if (r.ok) { cargar().then(function () { mensaje($('pm-emp-estado'), 'ok', 'Guardado.'); }); return; }
            mostrarErrores(f, r.datos.errores);
            mensaje(est, 'error', r.datos.error || 'No pudimos guardar.');
        });
    });

    // ---------- trabajadores: lista ----------
    function textoContrato(t) { return t.contrato === 'plazo_fijo' ? 'Plazo fijo' : t.contrato === 'obra' ? 'Por obra o faena' : 'Indefinido'; }
    // Vencimiento del plazo fijo con su tono: ámbar a 30 días o menos, rose si ya venció
    function vencePlazo(t) {
        if (t.contrato !== 'plazo_fijo' || !t.fechaTerminoPlazo) return null;
        var faltan = PEND.dias(hoyIso(), t.fechaTerminoPlazo);
        return { texto: (faltan < 0 ? 'venció el ' : faltan === 0 ? 'vence hoy' : 'vence el ') + (faltan === 0 ? '' : fechaCorta(t.fechaTerminoPlazo)), clase: faltan < 0 ? 'vencido' : faltan <= 30 ? 'vence-pronto' : '' };
    }
    function celdaContrato(t) {
        var v = vencePlazo(t);
        return '<td class="celda-contrato ocultar-movil">' + esc(textoContrato(t)) + (v ? '<small class="' + v.clase + '">' + esc(v.texto) + '</small>' : '') + '</td>';
    }

    function dibujarTrabajadores() {
        var lista = estado.trabajadores || [], activosN = lista.filter(function (t) { return t.activo; }).length, lim = estado.limites;
        $('trab-panel').hidden = !lista.length;
        $('trab-vacio').hidden = !!lista.length;
        $('trab-vacio-txt').textContent = estado.empresa ? 'Con sus datos guardados, cada liquidación y documento se arma solo.' : 'Primero guarda los datos de la empresa: van en el membrete de cada documento.';
        $('pm-trab-lista').innerHTML = lista.map(function (t) {
            var v = vencePlazo(t);
            return '<tr class="fila" tabindex="0" data-id="' + esc(t.id) + '">' +
                '<td class="celda-nombre"><strong>' + esc(t.nombre) + '</strong><span>' + esc(t.cargo || 'Sin cargo registrado') + '</span></td>' +
                '<td class="fecha ocultar-movil">' + esc(Rut.formatear(t.rut)) + '</td>' +
                '<td class="celda-contrato">' + esc(textoContrato(t)) + (v ? '<small class="' + v.clase + '">' + esc(v.texto) + '</small>' : '') + '</td>' +
                '<td class="num ocultar-movil">' + (t.sueldoBase ? pesos(t.sueldoBase) : '<span class="vacio">Falta</span>') + '</td>' +
                '<td>' + (t.activo ? '<span class="sello sello-guardada">Activo</span>' : '<span class="sello sello-inactivo">Inactivo</span>') + '</td>' +
                '<td class="chev"><span class="material-icons" aria-hidden="true">chevron_right</span></td></tr>';
        }).join('');
        var txt = activosN + ' de ' + lim.maxActivos + ' trabajadores activos. ';
        txt += lim.paseVence ? 'Tu pase vence el ' + fechaVence(lim.paseVence) + '.' : 'Sin pase puedes tener 1 trabajador activo; con el Pase Pyme, hasta 5.';
        $('pm-trab-limite').textContent = txt;
        $('pm-trab-nuevo').disabled = !estado.empresa;
        $('pm-trab-nuevo').title = estado.empresa ? '' : 'Primero guarda los datos de la empresa';
    }
    $('pm-trab-nuevo').addEventListener('click', function () { navegar('trabajadores/nuevo'); });
    function abrirFilaTrabajador(e) {
        var fila = e.target.closest('tr[data-id]');
        if (fila) navegar('trabajadores/' + fila.getAttribute('data-id'));
    }
    $('pm-trab-lista').addEventListener('click', abrirFilaTrabajador);
    $('pm-trab-lista').addEventListener('keydown', function (e) { if (e.key === 'Enter') abrirFilaTrabajador(e); });

    // ---------- carpeta del trabajador ----------
    function abrirCarpeta(id, tab) {
        var nuevo = id === 'nuevo', t = nuevo ? null : trabajadorPorId(id);
        if (!nuevo && !t) { navegar('trabajadores', { reemplazar: true }); return; }
        if (nuevo && !estado.empresa) { navegar('empresa', { reemplazar: true }); avisoGlobal('info', 'Primero guarda los datos de la empresa.'); return; }
        if (['ficha', 'liquidaciones', 'vacaciones', 'prestamos', 'documentos'].indexOf(tab) < 0) tab = 'ficha';
        if (nuevo) tab = 'ficha';
        $('carp-miga').textContent = nuevo ? 'Nuevo trabajador' : t.nombre;
        document.title = (nuevo ? 'Nuevo trabajador' : t.nombre) + ' · Asistente Laboral Pyme';
        $('carp-nombre').textContent = nuevo ? 'Nuevo trabajador' : t.nombre;
        $('carp-tabs').hidden = nuevo;
        $('carp-acciones').hidden = nuevo;
        $('carp-resumen').innerHTML = nuevo ? '<span>Completa la ficha: sus datos llegan solos a cada liquidación y documento.</span>' : resumenCarpeta(t);
        if (!nuevo) {
            Array.prototype.forEach.call($('carp-tabs').querySelectorAll('a'), function (a) {
                var k = a.getAttribute('data-tab');
                a.href = '/app/trabajadores/' + t.id + (k === 'ficha' ? '' : '/' + k);
                a.setAttribute('data-ruta', 'trabajadores/' + t.id + (k === 'ficha' ? '' : '/' + k));
                if (k === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
            });
            $('carp-ir-liq-txt').textContent = 'Liquidación de ' + nombrePeriodo(periodoSel || periodoPorDefecto());
            $('carp-ir-liq').setAttribute('data-ruta', 'liquidaciones/' + t.id);
            $('carp-ir-liq').href = '/app/liquidaciones/' + t.id;
            $('carp-ir-doc').setAttribute('data-ruta', 'documentos');
            $('carp-ir-doc').setAttribute('data-query', 't=' + encodeURIComponent(t.id));
            $('carp-ir-doc').href = '/app/documentos?t=' + encodeURIComponent(t.id);
        }
        $('carp-ficha').hidden = tab !== 'ficha';
        $('carp-liq').hidden = tab !== 'liquidaciones';
        $('carp-vac').hidden = tab !== 'vacaciones';
        $('carp-prest').hidden = tab !== 'prestamos';
        $('carp-docs').hidden = tab !== 'documentos';
        if (tab === 'ficha') abrirTrabajador(t);
        else if (tab === 'liquidaciones') dibujarCarpetaLiq(t);
        else if (tab === 'vacaciones') dibujarCarpetaVac(t);
        else if (tab === 'prestamos') dibujarCarpetaPrest(t);
        else dibujarCarpetaDocs(t);
    }

    function resumenCarpeta(t) {
        var partes = [];
        if (t.cargo) partes.push('<span>' + esc(t.cargo) + '</span>');
        partes.push('<span class="mono">' + esc(Rut.formatear(t.rut)) + '</span>');
        if (t.fechaIngreso) partes.push('<span>Ingresó el <span class="mono">' + esc(fechaCortaAnio(t.fechaIngreso)) + '</span></span>');
        var v = vencePlazo(t);
        partes.push('<span' + (v && v.clase ? ' class="' + v.clase + '"' : '') + '>' + esc(textoContrato(t)) + (v ? ', ' + esc(v.texto) : '') + '</span>');
        if (t.sueldoBase) partes.push('<span>Sueldo base <span class="mono">' + pesos(t.sueldoBase) + '</span></span>');
        if (!t.activo) partes.push('<span class="sello sello-inactivo">Inactivo</span>');
        return partes.join('');
    }

    function abrirTrabajador(t) {
        var f = $('pm-trab-form');
        editandoId = t ? t.id : null;
        limpiarErrores(f);
        $('pm-trab-error').hidden = true;
        mensaje($('pm-trab-estado'), '', '');
        var base = { contrato: 'indefinido', jornadaHoras: 42, distribucion: '5', gratificacion: 'legal', afp: 'Modelo', salud: 'fonasa', renovaciones: 0, aniosOtrosEmpleadores: 0, activo: true };
        llenar(f, t || base);
        bonosFicha = JSON.parse(JSON.stringify((t && t.bonosFijos) || []));
        pintarBonosFicha();
        $('pm-t-activo-campo').hidden = !t;
        $('carp-borrar').hidden = !t;
        $('pm-trab-cancelar').textContent = t ? 'Descartar cambios' : 'Cancelar';
        $('pm-trab-guardar').lastChild.textContent = t ? 'Guardar cambios' : 'Guardar trabajador';
        condicionales();
        if (!t) $('pm-t-nombre').focus();
    }

    // --- bonos y asignaciones fijas de la ficha ---
    var bonosFicha = [];
    var NOMBRES_NO_IMPONIBLES = { perdida_caja: 'Asignación de pérdida de caja', desgaste_herramientas: 'Desgaste de herramientas' };
    function pintarBonosFicha() {
        $('pm-t-bonos').innerHTML = bonosFicha.map(function (b) {
            var imp = (b.tipo || 'imponible') === 'imponible';
            return '<div class="lq-row lq-row-bono"><select aria-label="Tipo" data-bono="tipo">' +
                '<option value="imponible"' + (imp ? ' selected' : '') + '>Bono imponible</option>' +
                '<option value="perdida_caja"' + (b.tipo === 'perdida_caja' ? ' selected' : '') + '>Pérdida de caja (no imponible)</option>' +
                '<option value="desgaste_herramientas"' + (b.tipo === 'desgaste_herramientas' ? ' selected' : '') + '>Desgaste de herramientas (no imponible)</option></select>' +
                '<input type="text" maxlength="60" aria-label="Nombre del bono" data-bono="nombre" placeholder="Bono de responsabilidad" value="' + esc(imp ? (b.nombre || '') : NOMBRES_NO_IMPONIBLES[b.tipo]) + '"' + (imp ? '' : ' disabled') + '>' +
                '<input type="text" inputmode="numeric" aria-label="Monto mensual" data-bono="monto" placeholder="$0" value="' + (b.monto ? pesos(b.monto) : '') + '">' +
                '<button type="button" class="lq-x" aria-label="Quitar" data-bono-quitar><span class="material-icons" aria-hidden="true">close</span></button></div>';
        }).join('');
        $('pm-t-bonos-agregar').hidden = bonosFicha.length >= 8;
    }
    function leerBonosFicha() {
        bonosFicha = Array.prototype.map.call($('pm-t-bonos').querySelectorAll('.lq-row-bono'), function (f) {
            var tipo = f.querySelector('[data-bono="tipo"]').value;
            return { tipo: tipo, nombre: tipo === 'imponible' ? f.querySelector('[data-bono="nombre"]').value : NOMBRES_NO_IMPONIBLES[tipo], monto: Math.min(MONTO_MAX, parseInt(f.querySelector('[data-bono="monto"]').value.replace(/\D/g, ''), 10) || 0) };
        });
    }
    $('pm-t-bonos').addEventListener('change', function (e) {
        if (e.target.getAttribute('data-bono') === 'tipo') { leerBonosFicha(); pintarBonosFicha(); }
        if (e.target.getAttribute('data-bono') === 'monto') { var v = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0; e.target.value = v ? pesos(v) : ''; }
    });
    $('pm-t-bonos').addEventListener('click', function (e) {
        var b = e.target.closest('[data-bono-quitar]');
        if (!b) return;
        leerBonosFicha();
        bonosFicha.splice(Array.prototype.indexOf.call($('pm-t-bonos').children, b.closest('.lq-row-bono')), 1);
        pintarBonosFicha();
    });
    $('pm-t-bonos-agregar').addEventListener('click', function () {
        leerBonosFicha();
        bonosFicha.push({ tipo: 'imponible', nombre: '', monto: 0 });
        pintarBonosFicha();
        var ult = $('pm-t-bonos').querySelector('.lq-row-bono:last-child input[data-bono="nombre"]');
        if (ult) ult.focus();
    });

    $('pm-trab-cancelar').addEventListener('click', function () {
        if (!editandoId) { navegar('trabajadores'); return; }
        abrirTrabajador(trabajadorPorId(editandoId));
        mensaje($('pm-trab-estado'), '', 'Volvimos a los datos guardados.');
    });
    $('pm-trab-form').addEventListener('change', function (e) { if (e.target.matches('[data-k="contrato"],[data-k="salud"]')) condicionales(); });

    $('pm-trab-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = $('pm-trab-form'), datos = recoger(f), err = $('pm-trab-error'), id = editandoId;
        leerBonosFicha();
        datos.bonosFijos = bonosFicha.filter(function (b) { return b.monto > 0 || (b.nombre || '').trim(); });
        limpiarErrores(f);
        err.hidden = true;
        mensaje($('pm-trab-estado'), '', 'Guardando…');
        var llamada = id ? api('trabajador', { metodo: 'PUT', query: { id: id }, cuerpo: { trabajador: datos } }) : api('trabajador', { metodo: 'POST', cuerpo: { trabajador: datos } });
        llamada.then(function (r) {
            if (sinSesion(r)) return;
            if (r.ok) {
                var tr = r.datos.trabajador || {};
                cargar().then(function () {
                    if (!id && tr.id) navegar('trabajadores/' + tr.id, { reemplazar: true });
                    avisoGlobal('ok', (id ? 'Guardamos los cambios de ' : 'Agregamos a ') + (tr.nombre || 'la persona') + '.');
                });
                return;
            }
            mensaje($('pm-trab-estado'), '', '');
            mostrarErrores(f, r.datos.errores);
            err.textContent = r.datos.error || 'No pudimos guardar.';
            err.hidden = false;
        });
    });

    $('carp-borrar').addEventListener('click', function () {
        var t = trabajadorPorId(editandoId);
        if (!t) return;
        confirmar('¿Eliminar a ' + t.nombre + '?', 'Sus datos, liquidaciones y documentos registrados se borran de forma definitiva. No se puede deshacer.', 'Eliminar trabajador').then(function (si) {
            if (!si) return;
            api('trabajador', { metodo: 'DELETE', query: { id: t.id } }).then(function (r) {
                if (sinSesion(r)) return;
                if (!r.ok) { avisoGlobal('error', r.datos.error || 'No pudimos eliminar.'); return; }
                mesesCache = {};
                cargar().then(function () { navegar('trabajadores', { reemplazar: true }); avisoGlobal('ok', 'Eliminamos a ' + t.nombre + '.'); });
            });
        });
    });

    // Últimos 12 meses del trabajador (desde su ingreso), con el estado de cada liquidación
    function periodosDe(t) {
        var limite = periodoPorDefecto();
        return PERIODOS.filter(function (p) { return p <= limite && (!t.fechaIngreso || p >= t.fechaIngreso.slice(0, 7)); }).slice(0, 12);
    }
    function dibujarCarpetaLiq(t) {
        var periodos = periodosDe(t), cuerpo = $('carp-liq-filas');
        if (!periodos.length) { cuerpo.innerHTML = '<tr><td colspan="4" class="vacio">Todavía no hay meses de remuneración desde su ingreso.</td></tr>'; return; }
        var faltan = periodos.filter(function (p) { return !mesesCache[p]; });
        if (faltan.length) cuerpo.innerHTML = '<tr><td colspan="4" class="vacio">Cargando sus liquidaciones…</td></tr>';
        Promise.all(faltan.map(cargarMeses)).then(function () {
            if (vistaActual !== 'trabajador' || $('carp-liq').hidden || rutaActual().split('/')[1] !== t.id) return;
            cuerpo.innerHTML = periodos.map(function (p) {
                var reg = mesesDe(p)[t.id], est = L.estadoDe(reg);
                return '<tr class="fila" tabindex="0" data-periodo="' + p + '">' +
                    '<td><strong style="font-weight:600">' + esc(mayuscula(nombrePeriodo(p))) + '</strong></td>' +
                    '<td>' + selloLiq(reg, est, L.diasBase(t, p)) + '</td>' +
                    '<td class="num">' + (reg && reg.calculo ? pesos(reg.calculo.liquido) : '<span class="vacio">—</span>') + '</td>' +
                    '<td class="chev"><span class="material-icons" aria-hidden="true">chevron_right</span></td></tr>';
            }).join('');
            cuerpo.setAttribute('data-trabajador', t.id);
        });
    }
    function abrirMesDeCarpeta(e) {
        var fila = e.target.closest('tr[data-periodo]'), id = $('carp-liq-filas').getAttribute('data-trabajador');
        if (!fila || !id) return;
        cambiarPeriodo(fila.getAttribute('data-periodo'), true);
        navegar('liquidaciones/' + id);
    }
    $('carp-liq-filas').addEventListener('click', abrirMesDeCarpeta);
    $('carp-liq-filas').addEventListener('keydown', function (e) { if (e.key === 'Enter') abrirMesDeCarpeta(e); });

    function dibujarCarpetaVac(t) {
        var r = resumenVac(t);
        $('carp-vac-resumen').innerHTML = resumenVacHtml(t, r);
        $('carp-vac-registrar').href = '/app/vacaciones?t=' + encodeURIComponent(t.id);
        $('carp-vac-registrar').setAttribute('data-ruta', 'vacaciones');
        $('carp-vac-registrar').setAttribute('data-query', 't=' + encodeURIComponent(t.id));
        var regs = ordenarVac(vacDe(t.id));
        $('carp-vac-filas').innerHTML = regs.length ? regs.map(function (v) {
            return '<tr><td>' + esc(v.tipo === 'periodo' ? rangoCorto(v.desde, v.hasta) + ' ' + v.hasta.slice(0, 4) : 'Antes de usar el asistente') + '</td><td class="num">' + v.dias + '</td><td class="ocultar-movil">' + esc(v.nota || '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="3" class="vacio">Aún no registras vacaciones de esta persona.</td></tr>';
    }

    // ---------- préstamos con cuotas (van en la ficha; las cuotas se descuentan solas en cada liquidación) ----------
    var prestSel = null; // trabajador cuya pestaña de préstamos está abierta
    function datosPrest() {
        return {
            concepto: $('pm-p-concepto').value.replace(/\s+/g, ' ').trim() || 'Préstamo', fecha: $('pm-p-fecha').value,
            monto: parseInt($('pm-p-monto').value.replace(/\D/g, ''), 10) || 0, cuotas: parseInt($('pm-p-cuotas').value.replace(/\D/g, ''), 10) || 0,
            desde: $('pm-p-desde').value, pausas: []
        };
    }
    // Remuneración mensual aproximada (sueldo, gratificación legal, colación y movilización) para el tope del 15% del art. 58
    function remuneracionEstimada(t) {
        var vig = P.vigenciaDe(hoyIso().slice(0, 7)) || P.VIGENCIAS[P.VIGENCIAS.length - 1], base = t.sueldoBase || 0;
        var grat = t.gratificacion === 'legal' ? Math.min(Math.round(base * 0.25), Math.round(4.75 * vig.imm / 12)) : 0;
        return base + grat + (t.colacion || 0) + (t.movilizacion || 0);
    }
    function sumaCuotas(lista) { return lista.reduce(function (s, c) { return s + c.monto; }, 0); }
    function calcPrest() {
        var t = trabajadorPorId(prestSel), p = datosPrest(), caja = $('pm-prest-calc'), html = '';
        function aviso(nivel, icono, texto) { html += '<div class="lq-aviso lq-aviso-' + nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + '</p></div>'; }
        if (t && p.monto > 0 && p.cuotas >= 1 && p.cuotas <= 48 && p.desde) {
            var c = L.cuotasDe(p), ult = c[c.length - 1];
            aviso('info', 'event_repeat', (p.cuotas === 1 ? 'Una cuota de ' + pesos(c[0].monto) + ' en la liquidación de ' + nombrePeriodo(p.desde) + '.'
                : plural(p.cuotas, 'cuota', 'cuotas') + ' de ' + pesos(c[0].monto) + (ult.monto !== c[0].monto ? ' (la última de ' + pesos(ult.monto) + ')' : '') + ', de ' + nombrePeriodo(c[0].periodo) + ' a ' + nombrePeriodo(ult.periodo) + '.'));
            var rem = remuneracionEstimada(t), tope = Math.floor(rem * E.TOPE_DESCUENTOS_PACTADOS), otras = sumaCuotas(L.cuotasDelMes(t, p.desde));
            if (rem > 0 && c[0].monto + otras > tope) {
                var libre = tope - otras, minimo = libre > 0 ? Math.ceil(p.monto / libre) : 0;
                aviso('aviso', 'warning', 'La cuota' + (otras ? ', sumada a las de otros préstamos (' + pesos(otras) + '),' : '') + ' pasa del 15% de su remuneración aproximada (' + pesos(tope) + ' de ' + pesos(rem) + ', art. 58). ' +
                    (minimo && minimo <= 48 ? 'Con ' + minimo + ' cuotas o más queda dentro del límite.' : 'Reduce el monto o reparte el préstamo en más cuotas.'));
            }
        }
        caja.innerHTML = html;
    }
    function opcionesDesde() {
        var hoy = hoyIso().slice(0, 7), sel = $('pm-p-desde'), lista = [];
        for (var i = -2; i <= 12; i++) lista.push(L.sumarMes(hoy, i));
        sel.innerHTML = lista.map(function (p) { return '<option value="' + p + '">' + esc(mayuscula(nombrePeriodo(p))) + '</option>'; }).join('');
        sel.value = periodoSel && lista.indexOf(periodoSel) >= 0 ? periodoSel : hoy;
    }
    function limpiarFormPrest() {
        ['pm-p-concepto', 'pm-p-monto', 'pm-p-cuotas'].forEach(function (id) { $(id).value = ''; });
        $('pm-p-fecha').value = hoyIso();
        opcionesDesde();
        $('pm-prest-error').hidden = true;
        $('pm-prest-calc').innerHTML = '';
    }
    function dibujarCarpetaPrest(t) {
        if (prestSel !== t.id) { prestSel = t.id; limpiarFormPrest(); mensaje($('pm-prest-estado'), '', ''); }
        var ref = periodoSel || periodoPorDefecto(), lista = (t.prestamos || []).slice().sort(function (a, b) { return a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : 0; });
        $('carp-prest-filas').innerHTML = lista.length ? lista.map(function (p) {
            var e = L.estadoPrestamo(p, ref), primera = L.cuotasDe(p)[0];
            var detalle = (p.cuotas > 1 ? nombrePeriodo(p.desde) + ' a ' + nombrePeriodo(e.ultima) : nombrePeriodo(p.desde)) + ((p.pausas || []).length ? ' · ' + plural(p.pausas.length, 'cuota postergada', 'cuotas postergadas') : '');
            return '<tr><td class="celda-nombre"><strong>' + esc(p.concepto) + '</strong><span>' + esc(detalle) + '</span></td>' +
                '<td class="num ocultar-movil">' + pesos(p.monto) + '</td>' +
                '<td class="celda-cuotas">' + (e.saldo === 0 ? 'Pagado' : e.pagadas + ' de ' + p.cuotas) + (p.cuotas > 1 && primera ? '<small class="mono">' + pesos(primera.monto) + ' c/u</small>' : '') + '</td>' +
                '<td class="num">' + pesos(e.saldo) + '</td>' +
                '<td><button type="button" class="btn-texto" data-prest-borrar="' + esc(p.id) + '">Eliminar</button></td></tr>';
        }).join('') : '<tr><td colspan="5" class="vacio">Sin préstamos registrados. Cuando registres uno, cada cuota se descuenta sola en su liquidación.</td></tr>';
        var pie = '';
        if (lista.length) pie += '<p class="texto-ayuda">Avance y saldo al cierre de ' + esc(nombrePeriodo(ref)) + ' (el mes elegido arriba). Si en una liquidación postergas una cuota, pasa al final del préstamo.</p>';
        pie += '<p class="texto-ayuda">' + (t.anticipoMensual ? 'Anticipo fijo de cada mes: <span class="mono">' + pesos(t.anticipoMensual) + '</span>. Se cambia en la ficha.' : 'Si le pagas un anticipo fijo cada mes, indícalo en la ficha: se descuenta solo.') + '</p>';
        $('carp-prest-pie').innerHTML = pie;
    }
    // Reemplaza la lista de préstamos en el servidor y en la memoria local; devuelve true si se guardó
    function guardarPrestamos(t, lista, est) {
        mensaje(est, '', 'Guardando…');
        return api('prestamos', { metodo: 'PUT', query: { trabajador: t.id }, cuerpo: { prestamos: lista } }).then(function (r) {
            if (sinSesion(r)) return false;
            if (!r.ok) { mensaje(est, 'error', r.datos.error || 'No pudimos guardar.'); return false; }
            var tr = r.datos.trabajador;
            estado.trabajadores = estado.trabajadores.map(function (x) { return x.id === tr.id ? tr : x; });
            if (editando && editando.id === tr.id) editando.t = tr;
            mensaje(est, '', '');
            return true;
        });
    }
    $('pm-prest-form').addEventListener('input', calcPrest);
    $('pm-prest-form').addEventListener('change', calcPrest);
    $('pm-prest-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var t = trabajadorPorId(prestSel), p = datosPrest(), err = $('pm-prest-error');
        if (!t) return;
        err.hidden = true;
        var falta = p.concepto.length > 60 ? 'El concepto puede tener hasta 60 caracteres.'
            : !p.fecha ? 'Indica la fecha en que entregaste el préstamo.'
            : !(p.monto >= 1000) ? 'Indica el monto prestado (desde $1.000).'
            : !(p.cuotas >= 1 && p.cuotas <= 48) ? 'Indica entre 1 y 48 cuotas.'
            : p.desde < p.fecha.slice(0, 7) ? 'La primera cuota no puede ser antes del mes en que entregaste el préstamo.' : '';
        if (falta) { err.textContent = falta; err.hidden = false; return; }
        guardarPrestamos(t, (t.prestamos || []).concat([p]), $('pm-prest-estado')).then(function (ok) {
            if (!ok) return;
            var nuevo = trabajadorPorId(t.id);
            limpiarFormPrest();
            dibujarCarpetaPrest(nuevo);
            mensaje($('pm-prest-estado'), 'ok', 'Registramos el préstamo. La primera cuota se descuenta en la liquidación de ' + nombrePeriodo(p.desde) + '.');
        });
    });
    $('carp-prest-filas').addEventListener('click', function (e) {
        var b = e.target.closest('[data-prest-borrar]'), t = trabajadorPorId(prestSel);
        if (!b || !t) return;
        var id = b.getAttribute('data-prest-borrar'), p = (t.prestamos || []).filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        confirmar('¿Eliminar «' + p.concepto + '»?', 'Deja de descontarse en las liquidaciones que aún no emites. Las ya emitidas no cambian.', 'Eliminar préstamo').then(function (si) {
            if (!si) return;
            guardarPrestamos(t, t.prestamos.filter(function (x) { return x.id !== id; }), $('pm-prest-estado')).then(function (ok) {
                if (!ok) return;
                dibujarCarpetaPrest(trabajadorPorId(t.id));
                mensaje($('pm-prest-estado'), 'ok', 'Eliminamos el préstamo.');
            });
        });
    });

    function dibujarCarpetaDocs(t) {
        var hist = docsCache.filter(function (d) { return d.trabajadorId === t.id; }).slice().reverse();
        $('carp-docs-hist').innerHTML = hist.length ? hist.slice(0, 50).map(function (d) { return filaHistorial(d, false); }).join('') : '<tr><td colspan="3" class="vacio">Todavía no emites documentos para esta persona desde el asistente.</td></tr>';
        $('carp-docs-lista').innerHTML = PD.TIPOS.map(function (d) {
            var q = 't=' + encodeURIComponent(t.id) + '&d=' + encodeURIComponent(d.id);
            return '<a class="gen-item" href="/app/documentos?' + q + '" data-ruta="documentos" data-query="' + esc(q) + '"><strong>' + esc(d.titulo) + '<span class="material-icons" aria-hidden="true">chevron_right</span></strong><span>' + esc(d.descripcion) + '</span></a>';
        }).join('');
    }

    // ---------- avisos del mes ----------
    var ICONO = { urgente: 'error', aviso: 'warning', info: 'info' };
    var pendientesActuales = [];
    function calcularPendientes() {
        var toca = PEND.periodoLiquidacion(hoyIso()), liq = null;
        if (toca && mesesCache[toca.periodo]) {
            var mapa = mesesCache[toca.periodo];
            liq = { periodo: toca.periodo, registros: Object.keys(mapa).map(function (id) { return { trabajadorId: id, emitida: mapa[id].emitida || '' }; }) };
        }
        pendientesActuales = PEND.pendientes(estado, { hoy: hoyIso(), P: P, F: F, ultimoRespaldo: guardado(KEY_RESPALDO), liquidaciones: liq, documentos: docsCache });
        return pendientesActuales;
    }
    function dibujarPendientes() {
        if (!estado) return;
        var lista = calcularPendientes();
        $('pm-pend').innerHTML = lista.length ? lista.map(function (p, i) {
            var accion = '';
            if (p.accion) {
                var etiqueta = { empresa: 'Completar empresa', 'trabajador-nuevo': 'Agregar trabajador', trabajador: 'Ver ficha', respaldo: 'Descargar respaldo', liquidaciones: 'Ver el mes', documento: 'Emitir contrato' }[p.accion.tipo];
                accion = '<button type="button" class="btn-texto" data-pend="' + i + '">' + esc(etiqueta) + '</button>';
            }
            return '<li class="n-' + p.nivel + '"><span class="material-icons" aria-hidden="true">' + ICONO[p.nivel] + '</span><div><strong>' + esc(p.titulo) + '</strong><p>' + esc(p.texto) + '</p></div>' + accion + '</li>';
        }).join('') : '<li class="n-info"><span class="material-icons" aria-hidden="true">check_circle</span><div><strong>No tienes avisos este mes.</strong></div></li>';
        if (vistaActual === 'inicio' && inicioSel) dibujarDetalle(inicioSel, false);
    }
    $('pm-pend').addEventListener('click', function (e) {
        var b = e.target.closest('[data-pend]');
        if (!b) return;
        var p = pendientesActuales[+b.getAttribute('data-pend')], a = p && p.accion;
        if (!a) return;
        if (a.tipo === 'empresa') navegar('empresa');
        else if (a.tipo === 'trabajador-nuevo') navegar('trabajadores/nuevo');
        else if (a.tipo === 'trabajador') navegar('trabajadores/' + a.id);
        else if (a.tipo === 'documento') navegar('documentos', { query: 't=' + encodeURIComponent(a.id) + '&d=' + encodeURIComponent(a.doc) });
        else if (a.tipo === 'respaldo') exportar();
        else if (a.tipo === 'liquidaciones') { cambiarPeriodo(a.periodo); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });

    // ---------- Inicio: cierre del mes ----------
    function filasDelMes() {
        var guardados = mesesDe(periodoSel);
        return activos().map(function (t) {
            var reg = guardados[t.id], dias = L.diasBase(t, periodoSel), est = L.estadoDe(reg);
            return { t: t, reg: reg, est: est, corresponde: !!reg || dias > 0 };
        });
    }
    function selloLiq(reg, est, dias) {
        if (!reg && dias === 0) return '<span class="sello sello-no">No corresponde</span>';
        if (est === 'emitida') return '<span class="sello sello-emitida">Emitida' + (reg && reg.emitida ? ' · ' + esc(fechaCorta(reg.emitida)) : '') + '</span>';
        if (est === 'guardada') return '<span class="sello sello-guardada">Preparada</span>';
        return '<span class="sello sello-sin">Sin preparar</span>';
    }

    // Próximo vencimiento a la vista: cotizaciones (día 10 o el hábil siguiente), plazos fijos y el pase
    function proximoVencimiento() {
        var hoy = hoyIso(), lista = [], a = hoy.split('-').map(Number);
        if (activos().length) {
            var y = a[0], m = a[1];
            if (a[2] > 13) { m++; if (m > 12) { m = 1; y++; } }
            var dia10 = y + '-' + dos(m) + '-10', plazo = dia10;
            try { plazo = F.siguienteDiaHabil(dia10); } catch (e) { /* año sin feriados verificados */ }
            var mesCot = m === 1 ? 12 : m - 1;
            if (plazo >= hoy) lista.push({ fecha: plazo, texto: 'Cotizaciones de ' + MESES[mesCot - 1] });
        }
        activos().forEach(function (t) {
            if (t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && t.fechaTerminoPlazo >= hoy) lista.push({ fecha: t.fechaTerminoPlazo, texto: 'Plazo fijo de ' + t.nombre.split(' ')[0] });
        });
        if (estado.limites.paseVence) { var pv = isoChile(estado.limites.paseVence); if (pv >= hoy) lista.push({ fecha: pv, texto: 'Vence tu Pase Pyme' }); }
        lista.sort(function (x, z) { return x.fecha < z.fecha ? -1 : x.fecha > z.fecha ? 1 : 0; });
        return lista[0] || null;
    }

    function dibujarInicio() {
        if (!estado) return;
        var nombreMes = nombrePeriodo(periodoSel);
        $('ini-titulo').textContent = 'Cierre de ' + nombreMes;
        $('ini-caption').textContent = 'Trabajadores y estado de su liquidación de ' + nombreMes;
        var sinEmpresa = !estado.empresa, sinTrabajadores = !(estado.trabajadores || []).length;
        var arranque = sinEmpresa || sinTrabajadores;
        $('ini-primeros').hidden = !arranque;
        $('ini-tabla-panel').hidden = arranque;
        $('ini-detalle').hidden = arranque;
        $('ini-cierre').classList.toggle('sin-detalle', arranque);
        $('ini-acciones').hidden = arranque;
        $('ini-avance').hidden = arranque;
        if (arranque) {
            $('ini-sub').textContent = 'Tres pasos y tu primer cierre de mes queda listo.';
            $('ini-cifras').innerHTML = '';
            $('ini-cifras').hidden = true;
            var pasos = [
                { hecho: !sinEmpresa, bloqueado: false, titulo: 'Datos de la empresa', texto: 'Razón social y RUT para el membrete de cada documento.', ruta: 'empresa', boton: sinEmpresa ? 'Completar' : 'Revisar' },
                { hecho: !sinTrabajadores, bloqueado: sinEmpresa, titulo: 'Tu primer trabajador', texto: 'Su ficha: contrato, jornada, sueldo, AFP y salud.', ruta: 'trabajadores/nuevo', boton: 'Agregar' },
                { hecho: false, bloqueado: true, titulo: 'Liquidaciones del mes', texto: 'Con la empresa y un trabajador guardados, preparas el mes en un clic.', ruta: '', boton: '' }
            ];
            $('ini-primeros-lista').innerHTML = pasos.map(function (p) {
                return '<li class="' + (p.hecho ? 'hecho' : p.bloqueado ? 'bloqueado' : '') + '"><div><strong>' + esc(p.titulo) + '</strong><p>' + esc(p.texto) + '</p></div>' +
                    (p.boton && !p.bloqueado ? '<a class="btn btn-chico' + (p.hecho ? '' : ' btn-primario') + '" href="/app/' + p.ruta + '" data-ruta="' + p.ruta + '">' + esc(p.boton) + '</a>' : '<span></span>') + '</li>';
            }).join('');
            return;
        }
        $('ini-cifras').hidden = false;

        var filas = filasDelMes(), cuentan = filas.filter(function (f) { return f.corresponde; });
        var emitidas = cuentan.filter(function (f) { return f.est === 'emitida'; }).length;
        var preparadas = cuentan.filter(function (f) { return f.est === 'guardada'; }).length;
        var sin = cuentan.length - emitidas - preparadas;
        var sub = cuentan.length ? emitidas + ' de ' + plural(cuentan.length, 'liquidación emitida', 'liquidaciones emitidas') : 'Ningún trabajador activo tiene liquidación en este mes.';
        if (cuentan.length && preparadas) sub += ' · ' + plural(preparadas, 'preparada', 'preparadas') + ' sin emitir';
        if (cuentan.length && sin) sub += ' · ' + sin + ' sin preparar';
        $('ini-sub').textContent = sub;
        $('ini-avance').innerHTML = cuentan.map(function (f) { return '<i class="' + (f.est === 'emitida' ? 'ok' : f.est === 'guardada' ? 'guardada' : '') + '"></i>'; }).join('');

        var paraPreparar = filas.filter(function (f) { return f.corresponde && f.est === 'sin_datos'; }).length;
        $('ini-preparar').hidden = paraPreparar === 0;
        $('ini-preparar-txt').textContent = 'Preparar las que faltan (' + paraPreparar + ')';
        $('ini-imprimir').disabled = (emitidas + preparadas) === 0;
        $('ini-marcar-fila').hidden = !ultimasImpresas.length;
        $('ini-marcar').textContent = textoMarcar();

        // Franja de cifras
        var conCalculo = cuentan.filter(function (f) { return f.reg && f.reg.calculo; });
        var total = conCalculo.reduce(function (s, f) { return s + (f.reg.calculo.liquido || 0); }, 0);
        var conCosto = cuentan.filter(function (f) { return f.reg && f.reg.calculo && f.reg.calculo.conDesglose; });
        var costo = conCosto.reduce(function (s, f) { return s + (f.reg.calculo.costoEmpleador || 0); }, 0);
        var prox = proximoVencimiento();
        var proxDias = prox ? PEND.dias(hoyIso(), prox.fecha) : null, proxClase = prox && proxDias <= 3 ? ' vence-pronto' : '';
        var proxFecha = proxDias === 0 ? 'Hoy' : proxDias === 1 ? 'Mañana' : prox ? fechaCorta(prox.fecha) : '';
        $('ini-cifras').innerHTML =
            '<div><dt>Líquido a pagar en ' + esc(MESES[+periodoSel.slice(5) - 1]) + '</dt><dd>' + pesos(total) + '<small>' + esc(conCalculo.length + ' de ' + cuentan.length) + '</small></dd></div>' +
            (conCosto.length ? '<div><dt>Costo para la empresa</dt><dd>' + pesos(costo) + '<small>' + esc(conCosto.length + ' de ' + cuentan.length) + '</small></dd></div>'
                : '<div><dt>Costo para la empresa</dt><dd class="texto">Se calcula al guardar las liquidaciones</dd></div>') +
            '<div><dt>Próximo vencimiento</dt><dd class="texto' + proxClase + '">' + (prox ? '<span' + (proxDias > 1 ? ' class="mono"' : '') + '>' + esc(proxFecha) + '</span> · ' + esc(prox.texto) : 'Nada en los próximos días') + '</dd></div>';

        // Grilla
        if (!inicioSel || !filas.some(function (f) { return f.t.id === inicioSel; })) {
            var pendiente = filas.filter(function (f) { return f.corresponde && f.est !== 'emitida'; })[0];
            inicioSel = (pendiente || filas[0] || {}).t ? (pendiente || filas[0]).t.id : null;
        }
        $('ini-filas').innerHTML = filas.length ? filas.map(function (f) {
            var sel = f.t.id === inicioSel, reg = f.reg;
            return '<tr class="fila" data-id="' + esc(f.t.id) + '" aria-current="' + sel + '" tabindex="' + (sel ? '0' : '-1') + '">' +
                '<td class="celda-nombre"><strong>' + esc(f.t.nombre) + '</strong><span>' + esc(f.t.cargo || textoContrato(f.t)) + '</span></td>' +
                celdaContrato(f.t) +
                celdaVac(f.t) +
                '<td class="ocultar-movil">' + selloLiq(reg, f.est, f.corresponde ? 1 : 0) + '</td>' +
                '<td class="num"><span>' + (reg && reg.calculo ? pesos(reg.calculo.liquido) : '<span class="vacio">—</span>') + '</span><span class="solo-movil">' + selloLiq(reg, f.est, f.corresponde ? 1 : 0) + '</span></td>' +
                '<td class="chev"><span class="material-icons" aria-hidden="true">chevron_right</span></td></tr>';
        }).join('') : '<tr><td colspan="6" class="vacio">No tienes trabajadores activos. Actívalos desde su ficha.</td></tr>';
        if (inicioSel) dibujarDetalle(inicioSel, false); else $('ini-detalle-cuerpo').innerHTML = '<p class="detalle-vacio">Elige a un trabajador para ver el detalle.</p>';
    }

    // Vacaciones en la grilla: el período que cae en el mes o, si no hay, el saldo
    function celdaVac(t) {
        var ini = periodoSel + '-01', fin = periodoSel + '-31';
        var p = vacDe(t.id).filter(function (v) { return v.tipo === 'periodo' && v.desde <= fin && v.hasta >= ini; })[0];
        if (!t.fechaIngreso) return '<td class="ocultar-movil vacio">—</td>';
        var r = resumenVac(t);
        return '<td class="celda-contrato ocultar-movil"><span class="mono' + (r.saldo < 0 ? ' vencido' : '') + '">' + r.saldo + '</span> de saldo<small>' + (p ? esc(rangoCorto(p.desde, p.hasta)) + ', ' + textoDias(p.dias) : 'sin vacaciones este mes') + '</small></td>';
    }

    function elegirFila(id, enfocar) {
        if (!id) return;
        inicioSel = id;
        Array.prototype.forEach.call($('ini-filas').querySelectorAll('tr[data-id]'), function (tr) {
            var sel = tr.getAttribute('data-id') === id;
            tr.setAttribute('aria-current', sel ? 'true' : 'false');
            tr.tabIndex = sel ? 0 : -1;
            if (sel && enfocar) tr.focus();
        });
        dibujarDetalle(id, !enfocar);
    }
    $('ini-filas').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) elegirFila(tr.getAttribute('data-id'), false);
    });
    $('ini-filas').addEventListener('keydown', function (e) {
        var filas = Array.prototype.slice.call($('ini-filas').querySelectorAll('tr[data-id]'));
        var i = filas.findIndex(function (tr) { return tr.getAttribute('data-id') === inicioSel; });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var j = Math.max(0, Math.min(filas.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
            if (filas[j]) elegirFila(filas[j].getAttribute('data-id'), true);
        } else if (e.key === 'Enter' && inicioSel) {
            navegar('liquidaciones/' + inicioSel);
        }
    });

    function dibujarDetalle(id, animar) {
        var cuerpo = $('ini-detalle-cuerpo'), t = trabajadorPorId(id);
        if (!t) { cuerpo.innerHTML = '<p class="detalle-vacio">Elige a un trabajador para ver el detalle.</p>'; return; }
        var reg = mesesDe(periodoSel)[id], est = L.estadoDe(reg), dias = L.diasBase(t, periodoSel), nombreMes = nombrePeriodo(periodoSel);
        var corresponde = !!reg || dias > 0, v = vencePlazo(t);
        var html = '<h2>' + esc(t.nombre) + '</h2><p class="detalle-meta">' + esc(t.cargo || 'Sin cargo registrado') + ' · <span class="mono">' + esc(Rut.formatear(t.rut)) + '</span></p>';
        html += '<dl class="detalle-dl">' +
            '<div><dt>Liquidación de ' + esc(nombreMes) + '</dt><dd>' + selloLiq(reg, est, corresponde ? 1 : 0) + '</dd></div>' +
            '<div><dt>Líquido a pagar</dt><dd class="mono">' + (reg && reg.calculo ? pesos(reg.calculo.liquido) : '—') + '</dd></div>' +
            (reg && reg.calculo && reg.calculo.conDesglose ? '<div><dt>Costo para la empresa</dt><dd class="mono">' + pesos(reg.calculo.costoEmpleador) + '</dd></div>' : '') +
            '<div><dt>Emitida</dt><dd class="mono">' + (reg && reg.emitida ? esc(fechaCortaAnio(reg.emitida)) : '—') + '</dd></div>' +
            '<div><dt>Contrato</dt><dd' + (v && v.clase ? ' class="' + v.clase + '"' : '') + '>' + esc(textoContrato(t)) + (v ? ', ' + esc(v.texto) : '') + '</dd></div>' +
            '<div><dt>Sueldo base</dt><dd class="mono">' + (t.sueldoBase ? pesos(t.sueldoBase) : '—') + '</dd></div>' +
            '<div><dt>Vacaciones</dt><dd>' + textoVacDetalle(t) + '</dd></div></dl>';
        var suyos = pendientesActuales.filter(function (p) { return p.accion && p.accion.tipo === 'trabajador' && p.accion.id === id; });
        if (suyos.length) {
            html += '<div class="detalle-avisos">' + suyos.map(function (p) {
                var clase = p.nivel === 'urgente' ? 'error' : p.nivel === 'aviso' ? 'aviso' : 'info';
                return '<div class="lq-aviso lq-aviso-' + clase + '"><span class="material-icons" aria-hidden="true">' + ICONO[p.nivel] + '</span><p>' + esc(mayuscula(p.titulo.replace(t.nombre + ': ', ''))) + '</p></div>';
            }).join('') + '</div>';
        }
        html += '<div class="detalle-acciones">';
        if (!corresponde) {
            html += '<p class="texto-ayuda">' + esc(t.fechaIngreso && t.fechaIngreso > periodoSel + '-31' ? 'No corresponde liquidación: ingresa el ' + fechaLarga(t.fechaIngreso) + '.' : 'No corresponde liquidación: su contrato terminó antes de este mes.') + '</p>';
        } else if (est === 'sin_datos') {
            html += '<a class="btn btn-primario" href="/app/liquidaciones/' + esc(id) + '" data-ruta="liquidaciones/' + esc(id) + '"><span class="material-icons" aria-hidden="true">playlist_add</span>Preparar su liquidación</a>';
        } else if (est === 'guardada') {
            html += '<a class="btn btn-primario" href="/app/liquidaciones/' + esc(id) + '" data-ruta="liquidaciones/' + esc(id) + '"><span class="material-icons" aria-hidden="true">edit_note</span>Revisar la liquidación</a>' +
                '<button type="button" class="btn" data-det="imprimir" data-id="' + esc(id) + '"><span class="material-icons" aria-hidden="true">print</span>Imprimir</button>' +
                '<button type="button" class="btn" data-det="marcar" data-id="' + esc(id) + '"><span class="material-icons" aria-hidden="true">task_alt</span>Marcar como emitida</button>';
        } else {
            html += '<button type="button" class="btn btn-primario" data-det="imprimir" data-id="' + esc(id) + '"><span class="material-icons" aria-hidden="true">print</span>Imprimir de nuevo</button>' +
                '<a class="btn" href="/app/liquidaciones/' + esc(id) + '" data-ruta="liquidaciones/' + esc(id) + '"><span class="material-icons" aria-hidden="true">visibility</span>Ver la liquidación</a>';
        }
        html += '</div><div class="detalle-enlaces">' +
            '<a class="btn-texto" href="/app/trabajadores/' + esc(id) + '" data-ruta="trabajadores/' + esc(id) + '">Ver su carpeta</a>' +
            '<a class="btn-texto" href="/app/documentos?t=' + encodeURIComponent(id) + '" data-ruta="documentos" data-query="t=' + esc(encodeURIComponent(id)) + '">Emitir un documento</a>' +
            (est === 'emitida' ? '<button type="button" class="btn-texto" data-det="desmarcar" data-id="' + esc(id) + '">Quitar la marca de emitida</button>' : '') + '</div>';
        if (!animar) { cuerpo.innerHTML = html; return; }
        cuerpo.classList.add('cambiando');
        window.setTimeout(function () { cuerpo.innerHTML = html; cuerpo.classList.remove('cambiando'); }, 90);
    }
    function textoVacDetalle(t) {
        if (!t.fechaIngreso) return '—';
        var r = resumenVac(t);
        if (r.actual) return 'De vacaciones hasta el ' + esc(fechaCorta(r.actual.hasta));
        return '<span class="mono' + (r.saldo < 0 ? ' vencido' : '') + '">' + r.saldo + '</span> de saldo' + (r.proximo ? ' · desde el ' + esc(fechaCorta(r.proximo.desde)) : '');
    }

    $('ini-detalle').addEventListener('click', function (e) {
        var b = e.target.closest('[data-det]');
        if (!b) return;
        var id = b.getAttribute('data-id'), accion = b.getAttribute('data-det');
        if (accion === 'imprimir') imprimirMeses([id], $('ini-estado'));
        else if (accion === 'marcar') marcarEmitidas([id], hoyIso(), $('ini-estado'));
        else if (accion === 'desmarcar') marcarEmitidas([id], '', $('ini-estado'));
    });
    $('ini-preparar').addEventListener('click', function () { prepararMes($('ini-estado')); });
    $('ini-imprimir').addEventListener('click', function () { imprimirMeses(activos().map(function (t) { return t.id; }), $('ini-estado')); });
    $('ini-marcar').addEventListener('click', function () { marcarEmitidas(ultimasImpresas.slice(), hoyIso(), $('ini-estado')); });

    // ---------- documentos ----------
    var docSel = { trabajadorId: null, tipo: null, datos: {}, intento: false, listo: false };

    function ufHoy() { try { return typeof CONSTANTS !== 'undefined' && CONSTANTS.UF > 30000 ? CONSTANTS.UF : 0; } catch (e) { return 0; } }

    function ctxDoc() {
        var t = trabajadorPorId(docSel.trabajadorId);
        if (!t || !estado || !estado.empresa) return null;
        var meses = {};
        PD.periodosPromedio(hoyIso()).forEach(function (p) { var m = mesesCache[p] && mesesCache[p][t.id]; if (m) meses[p] = m; });
        return { empresa: estado.empresa, t: t, hoy: hoyIso(), meses: meses, uf: ufHoy(), F: F, vac: vacDe(t.id), saldoPrestamos: function (p) { return L.saldoPrestamos(t, p); } };
    }

    // /app/documentos?t=<trabajador>&d=<tipo>: deja elegidos a la persona y el documento
    function rutaDocumentos() {
        var q = new URLSearchParams(window.location.search), t = q.get('t'), d = q.get('d'), forzar = false;
        if (d === 'comprobante_feriado' && t && q.get('inicio')) {
            docPrefill = { t: t, tipo: d, valores: { fechaInicio: q.get('inicio'), diasHabiles: String(+q.get('dias') || ''), saldoAntes: String(+q.get('saldo') || 0) } };
            forzar = true;
        }
        if (t && trabajadorPorId(t) && t !== docSel.trabajadorId) { docSel.trabajadorId = t; forzar = true; }
        if (d && PD.TIPOS.some(function (x) { return x.id === d; }) && d !== docSel.tipo) { docSel.tipo = d; forzar = true; }
        dibujarDocumentos(forzar);
    }

    function dibujarDocumentos(forzar) {
        if (!estado) return;
        var lista = estado.trabajadores || [], hay = lista.length > 0 && !!estado.empresa;
        $('pm-doc-vacio-panel').hidden = hay;
        $('pm-doc-vacio').textContent = !estado.empresa ? 'Primero guarda los datos de la empresa y agrega a un trabajador.' : 'Agrega primero a un trabajador para preparar sus documentos.';
        $('doc-editor').hidden = !hay;
        if (!hay) return;
        var selT = $('pm-doc-trab'), selD = $('pm-doc-tipo');
        selT.innerHTML = lista.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.nombre) + (t.activo ? '' : ' (inactivo)') + '</option>'; }).join('');
        if (!selD.options.length) selD.innerHTML = PD.GRUPOS.map(function (g) {
            return '<optgroup label="' + esc(g[1]) + '">' + PD.TIPOS.filter(function (t) { return t.grupo === g[0]; }).map(function (t) { return '<option value="' + t.id + '">' + esc(t.titulo) + '</option>'; }).join('') + '</optgroup>';
        }).join('');
        var cambio = forzar || !trabajadorPorId(docSel.trabajadorId) || !docSel.tipo;
        if (!trabajadorPorId(docSel.trabajadorId)) docSel.trabajadorId = lista[0].id;
        if (!docSel.tipo) docSel.tipo = PD.TIPOS[0].id;
        selT.value = docSel.trabajadorId;
        selD.value = docSel.tipo;
        notaMarcaDoc();
        if (cambio) abrirDoc(); else vistaDoc();
        dibujarHistorialDocs();
        // Si se cargaron los documentos emitidos después, los avisos del contrato se actualizan
        dibujarPendientes();
    }

    // El finiquito sale sin marca solo con el Pase de 12 meses (igual que el generador de finiquitos); el contrato según la cobertura del pase; los demás, con cualquier pase
    function docPagado(tipo) { return tipo === 'finiquito' || tipo === 'contrato' ? cubiertoPorPase(tipo) : tienePase(); }
    function notaMarcaDoc() {
        var tipo = docSel.tipo, texto;
        var w = $('pm-doc-word');
        if (w) { w.disabled = !docPagado(tipo); w.title = docPagado(tipo) ? '' : 'Disponible con el Pase Pyme' + (tipo === 'finiquito' ? ' de 12 meses' : ''); }
        if (docPagado(tipo)) texto = 'Con tu pase vigente ' + (tipo === 'finiquito' ? 'el finiquito sale' : 'los documentos salen') + ' sin marca de agua y puedes descargarlos en Word para editarlos. Revisa cada documento antes de entregarlo.';
        else if (tipo === 'finiquito') texto = 'El finiquito lleva la marca «Vista previa» salvo con el Pase Pyme de 12 meses. ' + textoPaseVenta() + ' Revisa el documento antes de firmarlo.';
        else texto = 'Sin Pase Pyme los documentos llevan la marca «Vista previa». ' + textoPaseVenta() + ' Revisa cada documento antes de entregarlo.';
        $('pm-doc-nota-marca').textContent = texto;
    }

    var NOMBRES_DOC = { anexo_42h: 'Anexo de 42 horas', liquidacion: 'Liquidación de sueldo' };
    function nombreDoc(tipo) { var x = PD.TIPOS.filter(function (d) { return d.id === tipo; })[0]; return x ? x.titulo : (NOMBRES_DOC[tipo] || tipo); }
    function filaHistorial(d, conNombre) {
        var t = trabajadorPorId(d.trabajadorId), puede = t && PD.TIPOS.some(function (x) { return x.id === d.tipo; });
        var q = 't=' + encodeURIComponent(d.trabajadorId) + '&d=' + encodeURIComponent(d.tipo);
        return '<tr><td class="fecha">' + esc(fechaCortaAnio(isoChile(d.emitido))) + '</td>' + (conNombre ? '<td>' + esc(t ? t.nombre : 'Trabajador eliminado') + '</td>' : '') + '<td>' + esc(nombreDoc(d.tipo)) + '</td>' +
            '<td style="text-align:right">' + (puede ? '<a class="btn-texto" href="/app/documentos?' + esc(q) + '" data-ruta="documentos" data-query="' + esc(q) + '">Preparar de nuevo</a>' : '') + '</td></tr>';
    }
    function dibujarHistorialDocs() {
        var lista = docsCache.slice().reverse().slice(0, 60);
        $('doc-hist-filas').innerHTML = lista.length ? lista.map(function (d) { return filaHistorial(d, true); }).join('') : '<tr><td colspan="4" class="vacio">Todavía no emites documentos desde el asistente.</td></tr>';
    }

    // Cambia de persona o de documento: carga lo que haga falta y propone los valores iniciales
    function abrirDoc() {
        var tipo = docSel.tipo, id = docSel.trabajadorId;
        docSel.intento = false;
        $('pm-doc-post').hidden = true;
        $('pm-doc-post').innerHTML = '';
        var info = PD.TIPOS.filter(function (x) { return x.id === tipo; })[0];
        $('pm-doc-descripcion').textContent = info ? info.descripcion : '';
        notaMarcaDoc();
        var faltan = (tipo === 'cert_remuneraciones' || tipo === 'carta_161' || tipo === 'finiquito') ? PD.periodosPromedio(hoyIso()).filter(function (p) { return !mesesCache[p]; }) : [];
        Promise.all(faltan.map(cargarMeses)).then(function () {
            if (!estado || docSel.tipo !== tipo || docSel.trabajadorId !== id) return;
            var c = ctxDoc();
            if (!c) return;
            docSel.datos = PD.valoresIniciales(tipo, c);
            if (docPrefill && docPrefill.tipo === tipo && docPrefill.t === id) Object.assign(docSel.datos, docPrefill.valores);
            else if (tipo === 'comprobante_feriado' && c.t.fechaIngreso && !docSel.datos.saldoAntes) docSel.datos.saldoAntes = String(Math.max(0, resumenVac(c.t).saldo));
            docPrefill = null;
            dibujarFormDoc();
            vistaDoc();
        });
    }

    function dibujarFormDoc() {
        var form = $('pm-doc-form'), campos = PD.campos(docSel.tipo);
        form.hidden = false;
        form.innerHTML = campos.map(function (c) {
            return campoDocHtml(c);
        }).join('');
        visibilidadDoc();
    }
    // Muestra solo los campos que corresponden a la ficha y a lo elegido (por ejemplo, el nuevo sueldo en un anexo de sueldo)
    function visibilidadDoc() {
        var c = ctxDoc();
        if (!c) return;
        PD.campos(docSel.tipo).forEach(function (campo) {
            var el = $('pm-doc-form').querySelector('[data-campo-doc="' + campo.k + '"]');
            if (el) el.hidden = !PD.campoVisible(campo, c, docSel.datos);
        });
    }
    function campoDocHtml(c) {
        {
            var id = 'pm-d-' + c.k, v = docSel.datos[c.k], ayuda = c.ayuda ? '<p class="lq-help">' + esc(c.ayuda) + '</p>' : '', err = '<p class="pm-error" data-derror="' + c.k + '" hidden></p>';
            var opc = c.req || c.tipo === 'check' ? '' : ' <span class="lq-opt">(opcional)</span>';
            if (c.tipo === 'check') return '<div class="lq-field pm-check lq-span2" data-campo-doc="' + c.k + '"><label><input type="checkbox" id="' + id + '" data-dk="' + c.k + '"' + (v === true ? ' checked' : '') + '> <span>' + esc(c.etiqueta) + '</span></label>' + ayuda + err + '</div>';
            var ctrl;
            if (c.tipo === 'select') ctrl = '<select id="' + id + '" data-dk="' + c.k + '">' + c.opciones.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
            else if (c.tipo === 'textarea') ctrl = '<textarea id="' + id + '" data-dk="' + c.k + '" rows="5" maxlength="' + c.max + '">' + esc(v) + '</textarea>';
            else if (c.tipo === 'fecha') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" type="date" value="' + esc(v) + '">';
            else if (c.tipo === 'pesos') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" data-tipo="pesos" type="text" inputmode="numeric" value="' + (v > 0 ? esc(pesos(v)) : '') + '" placeholder="$0">';
            else if (c.tipo === 'numero') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" data-tipo="num" type="text" inputmode="numeric" maxlength="3" value="' + esc(v) + '">';
            else if (c.tipo === 'decimal') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" type="text" inputmode="decimal" maxlength="6" value="' + esc(v) + '" placeholder="Cálculo del asistente">';
            else ctrl = '<input id="' + id + '" data-dk="' + c.k + '" type="text" maxlength="' + (c.max || 100) + '" value="' + esc(v) + '">';
            var ancho = c.tipo === 'textarea' ? ' lq-span2' : '';
            return '<div class="lq-field' + ancho + '" data-campo-doc="' + c.k + '"><label for="' + id + '">' + esc(c.etiqueta) + opc + '</label>' + ctrl + ayuda + err + '</div>';
        }
    }

    function valorCampoDoc(el) {
        if (el.type === 'checkbox') return el.checked;
        var tipo = el.getAttribute('data-tipo'), v = el.value;
        if (tipo === 'pesos') return parseInt(v.replace(/\D/g, ''), 10) || 0;
        if (tipo === 'num') return v.replace(/\D/g, '');
        return v;
    }
    var horarioAnexo = '';   // última distribución propuesta en el anexo de jornada (se reemplaza mientras nadie la edite)
    $('pm-doc-form').addEventListener('input', function (e) {
        if (!e.target.hasAttribute('data-dk')) return;
        var k = e.target.getAttribute('data-dk');
        docSel.datos[k] = valorCampoDoc(e.target);
        if (docSel.tipo === 'anexo_contrato' && k === 'nuevaJornada' && +docSel.datos.nuevaJornada > 0) {
            var t = trabajadorPorId(docSel.trabajadorId), h = $('pm-d-nuevoHorario');
            if (t && h && (!docSel.datos.nuevoHorario || docSel.datos.nuevoHorario === horarioAnexo)) {
                horarioAnexo = PD.horarioPropuesto({ jornadaHoras: +docSel.datos.nuevaJornada, distribucion: t.distribucion });
                docSel.datos.nuevoHorario = horarioAnexo;
                h.value = horarioAnexo;
            }
        }
        vistaDoc();
    });
    $('pm-doc-form').addEventListener('change', function (e) {
        var el = e.target;
        if (!el.hasAttribute('data-dk')) return;
        docSel.datos[el.getAttribute('data-dk')] = valorCampoDoc(el);
        if (el.getAttribute('data-tipo') === 'pesos') el.value = docSel.datos[el.getAttribute('data-dk')] > 0 ? pesos(docSel.datos[el.getAttribute('data-dk')]) : '';
        if (el.tagName === 'SELECT') visibilidadDoc();
        vistaDoc();
    });
    $('pm-doc-form').addEventListener('submit', function (e) { e.preventDefault(); });

    function vistaDoc() {
        var c = ctxDoc();
        if (!c || !docSel.tipo) return;
        var v = PD.validar(docSel.tipo, c, docSel.datos);
        docSel.listo = v.puedeEmitir;
        // Los errores de campos vacíos solo se muestran después de intentar imprimir; los demás, apenas hay un valor
        Array.prototype.forEach.call($('pm-doc-form').querySelectorAll('[data-derror]'), function (p) {
            var k = p.getAttribute('data-derror'), msg = v.errores[k], valor = docSel.datos[k];
            var ver = !!msg && (docSel.intento || (valor !== '' && valor !== undefined && valor !== false && valor !== 0));
            p.textContent = ver ? msg : '';
            p.hidden = !ver;
            var campo = $('pm-d-' + k);
            if (campo) { if (ver) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid'); }
        });
        var html = '';
        function aviso(nivel, icono, texto, extra) { html += '<div class="lq-aviso lq-aviso-' + nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + (extra || '') + '</p></div>'; }
        if (v.faltaFicha.length) {
            var conT = v.faltaFicha.filter(function (x) { return x.de === 't'; }), conE = v.faltaFicha.filter(function (x) { return x.de === 'e'; });
            var texto = 'Falta en la ficha: ' + v.faltaFicha.map(function (x) { return x.etiqueta; }).join(', ') + '. ';
            var botones = (conT.length ? ' <button type="button" class="lq-link" data-doc-ficha="t">Completar la ficha del trabajador</button>' : '') + (conE.length ? ' <button type="button" class="lq-link" data-doc-ficha="e">Completar la empresa</button>' : '');
            aviso('aviso', 'edit_note', texto, botones);
        }
        v.bloqueos.forEach(function (t) { aviso('error', 'error', t); });
        v.avisos.forEach(function (a) { aviso(a.nivel, a.nivel === 'aviso' ? 'warning' : 'info', a.texto); });
        $('pm-doc-avisos').innerHTML = html;

        var marco = $('pm-doc-marco'), doc = $('pm-doc-doc');
        $('pm-doc-acciones').hidden = false;
        if (v.puedeEmitir) {
            var pagada = docPagado(docSel.tipo);
            try {
                doc.innerHTML = PD.generar(docSel.tipo, c, docSel.datos, { pagada: pagada }).html;
                doc.classList.toggle('lqd-pagada', pagada);
                marco.hidden = false;
            } catch (err) { marco.hidden = true; mensaje($('pm-doc-estado'), 'error', 'No pudimos armar el documento: ' + err.message); return; }
            mensaje($('pm-doc-estado'), '', '');
        } else {
            marco.hidden = true;
            doc.innerHTML = '';
            mensaje($('pm-doc-estado'), '', 'Completa los datos obligatorios para ver el documento.');
        }
    }

    $('pm-doc-avisos').addEventListener('click', function (e) {
        var b = e.target.closest('[data-doc-ficha]');
        if (!b) return;
        if (b.getAttribute('data-doc-ficha') === 'e') navegar('empresa');
        else navegar('trabajadores/' + docSel.trabajadorId);
    });
    $('pm-doc-trab').addEventListener('change', function (e) { docSel.trabajadorId = e.target.value; abrirDoc(); });
    $('pm-doc-tipo').addEventListener('change', function (e) { docSel.tipo = e.target.value; abrirDoc(); });

    $('pm-doc-imprimir').addEventListener('click', function () {
        var c = ctxDoc();
        if (!c) return;
        if (!docSel.listo) {
            docSel.intento = true;
            vistaDoc();
            var primero = $('pm-doc-form').querySelector('[aria-invalid="true"]');
            if (primero) primero.focus(); else $('pm-doc-avisos').scrollIntoView({ behavior: 'smooth', block: 'center' });
            mensaje($('pm-doc-estado'), 'error', 'Faltan datos para emitir el documento.');
            return;
        }
        var d;
        try { d = PD.generar(docSel.tipo, c, docSel.datos, { pagada: docPagado(docSel.tipo) }); } catch (err) { mensaje($('pm-doc-estado'), 'error', err.message); return; }
        imprimirHojas([d.html], d.titulo + ' ' + c.t.nombre);
        anotarEmision(c, 'Enviado a imprimir.');
    });

    // Anota la emisión (solo tipo y fecha) y, tras un anexo, ofrece pasar el cambio a la ficha
    function anotarEmision(c, inicio) {
        var id = docSel.trabajadorId, tipo = docSel.tipo, datos = Object.assign({}, docSel.datos);
        api('documento', { metodo: 'POST', query: { trabajador: id }, cuerpo: { tipo: tipo } }).then(function (r) {
            if (sinSesion(r)) return;
            if (r.ok) { docsCache.push({ trabajadorId: id, tipo: tipo, emitido: new Date().toISOString() }); dibujarHistorialDocs(); dibujarPendientes(); }
            mensaje($('pm-doc-estado'), r.ok ? 'ok' : 'error', r.ok ? inicio + ' Anotamos que lo emitiste (solo el tipo de documento y la fecha, nunca su texto).' : inicio + ' No pudimos anotar la emisión: ' + (r.datos.error || 'intenta de nuevo.'));
        });
        if (tipo === 'anexo_contrato') ofrecerActualizarFicha(c.t, datos);
    }

    // Cambios del anexo que se pueden pasar a la ficha
    function cambiosDeAnexo(t, d) {
        switch (d.materia) {
            case 'sueldo': return { campos: { sueldoBase: Number(d.nuevoSueldo) }, texto: 'el sueldo base a ' + pesos(Number(d.nuevoSueldo)) };
            case 'jornada': return { campos: { jornadaHoras: Number(d.nuevaJornada) }, texto: 'la jornada a ' + Number(d.nuevaJornada) + ' horas semanales' };
            case 'cargo': return { campos: { cargo: String(d.nuevoCargo || '').trim().slice(0, 60) }, texto: 'el cargo a «' + String(d.nuevoCargo || '').trim() + '»' };
            case 'prorroga': return { campos: { fechaTerminoPlazo: d.nuevoTermino, renovaciones: Math.min(5, (t.renovaciones || 0) + 1) }, texto: 'el vencimiento al ' + fechaLarga(d.nuevoTermino) + ' y sumar la renovación' };
            case 'indefinido': return { campos: { contrato: 'indefinido' }, texto: 'el contrato a indefinido' };
            default: return null;
        }
    }
    function ofrecerActualizarFicha(t, d) {
        var cambio = cambiosDeAnexo(t, d), caja = $('pm-doc-post');
        if (!cambio) { caja.hidden = true; return; }
        var cuando = d.materia !== 'prorroga' && d.vigencia > hoyIso() ? ' Como rige desde el ' + fechaLarga(d.vigencia) + ', puedes hacerlo ahora o volver cuando empiece.' : '';
        caja.innerHTML = '<div class="lq-aviso lq-aviso-info"><span class="material-icons" aria-hidden="true">sync</span><p>Cuando el anexo esté firmado, actualiza la ficha de ' + esc(t.nombre) + ': cambia ' + esc(cambio.texto) + ' para las próximas liquidaciones y documentos.' + esc(cuando) +
            ' <button type="button" class="lq-link" id="pm-doc-actualizar">Actualizar la ficha</button></p></div>';
        caja.hidden = false;
        $('pm-doc-actualizar').addEventListener('click', function () {
            var actual = trabajadorPorId(t.id);
            if (!actual) return;
            var datos = Object.assign({}, actual, cambio.campos);
            delete datos.id; delete datos.prestamos;
            this.disabled = true;
            api('trabajador', { metodo: 'PUT', query: { id: t.id }, cuerpo: { trabajador: datos } }).then(function (r) {
                if (sinSesion(r)) return;
                if (!r.ok) { caja.innerHTML = '<div class="lq-aviso lq-aviso-error"><span class="material-icons" aria-hidden="true">error</span><p>' + esc(r.datos.error || 'No pudimos actualizar la ficha.') + ' Revísala en la carpeta del trabajador.</p></div>'; return; }
                cargar().then(function () { caja.innerHTML = '<div class="lq-aviso lq-aviso-info"><span class="material-icons" aria-hidden="true">check_circle</span><p>Actualizamos la ficha de ' + esc(t.nombre) + '.</p></div>'; });
            });
        });
    }

    // Word: el mismo documento como archivo .doc para editarlo (solo sin marca de agua, es decir, con el pase que lo cubre)
    var ESTILO_WORD = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4;color:#111}' +
        '.dc-head{border-bottom:2px solid #00382E;padding-bottom:6pt;margin-bottom:12pt}.dc-head strong{font-size:12pt}.dc-head span{color:#475569;font-size:9pt}' +
        '.dc-titulo{text-align:center;font-size:13pt;text-transform:uppercase;color:#00382E;margin:6pt 0 12pt}.dc-lugar{text-align:right;margin:0 0 10pt}' +
        '.dc-p{text-align:justify;margin:0 0 8pt}.dc-lista{margin:0 0 8pt 18pt}.dc-tabla{width:100%;border-collapse:collapse;margin:0 0 10pt}' +
        '.dc-tabla th,.dc-tabla td{border-bottom:1px solid #ddd;padding:3pt;text-align:left;font-weight:normal}.dc-tabla td{text-align:right}' +
        '.dc-firma{text-align:center;margin-top:30pt;font-weight:bold}.dc-firma small{color:#475569;font-weight:normal}.dc-recibi,.dc-copia{font-size:9.5pt;margin-top:14pt}' +
        '.dc-pie{font-size:8pt;color:#64748b;border-top:1px solid #ddd;margin-top:18pt;padding-top:4pt}';
    function htmlParaWord(html) {
        return html.replace(/<img[^>]*>/g, '')
            .replace(/<div class="dc-firma"><span><\/span>/g, '<div class="dc-firma"><p>_______________________________</p>')
            .replace(/<small>/g, '<br><small>')
            .replace(/<\/strong><span>/g, '</strong><br><span>')
            .replace(/<\/span><span>/g, '</span><br><span>');
    }
    $('pm-doc-word').addEventListener('click', function () {
        var c = ctxDoc();
        if (!c || !docPagado(docSel.tipo)) return;
        if (!docSel.listo) { docSel.intento = true; vistaDoc(); mensaje($('pm-doc-estado'), 'error', 'Faltan datos para emitir el documento.'); return; }
        var d;
        try { d = PD.generar(docSel.tipo, c, docSel.datos, { pagada: true }); } catch (err) { mensaje($('pm-doc-estado'), 'error', err.message); return; }
        var archivo = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(d.titulo) + '</title><style>' + ESTILO_WORD + '</style></head><body>' + htmlParaWord(d.html) + '</body></html>';
        var blob = new Blob(['\ufeff', archivo], { type: 'application/msword' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (d.titulo + ' ' + c.t.nombre).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.doc';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        anotarEmision(c, 'Descargamos el documento en Word.');
    });

    // ---------- vacaciones ----------
    function ordenarVac(regs) {
        return regs.slice().sort(function (a, b) { var x = a.tipo === 'periodo' ? a.desde : a.fecha, y = b.tipo === 'periodo' ? b.desde : b.fecha; return x < y ? 1 : x > y ? -1 : 0; });
    }
    function resumenVacHtml(t, r) {
        var d = r.derecho, html = '<p class="texto-ayuda">Saldo estimado</p><p class="saldo-grande' + (r.saldo < 0 ? ' negativo' : '') + '">' + r.saldo + '<small>días hábiles</small></p>';
        html += '<dl class="detalle-dl">' +
            '<div><dt>Corresponden por ' + plural(d.anios, 'año completo', 'años completos') + '</dt><dd class="mono">' + d.total + '</dd></div>' +
            '<div><dt>Registrados como tomados</dt><dd class="mono">' + r.tomados + '</dd></div>' +
            (d.proximo ? '<div><dt>El ' + esc(fechaCortaAnio(d.proximo)) + ' suma</dt><dd class="mono">' + d.anual + '</dd></div>' : '') +
            (r.actual ? '<div><dt>De vacaciones</dt><dd>' + esc(rangoCorto(r.actual.desde, r.actual.hasta)) + '</dd></div>' : r.proximo ? '<div><dt>Próximas</dt><dd>' + esc(rangoCorto(r.proximo.desde, r.proximo.hasta)) + '</dd></div>' : '') +
            '</dl>';
        if (r.avisos.length) html += '<div class="detalle-avisos">' + r.avisos.map(function (a) { return '<div class="lq-aviso lq-aviso-' + a.nivel + '"><span class="material-icons" aria-hidden="true">' + (a.nivel === 'aviso' ? 'warning' : 'info') + '</span><p>' + esc(a.texto) + '</p></div>'; }).join('') + '</div>';
        if (d.porAnio.length) {
            html += '<details class="det-anios"><summary><span class="material-icons" aria-hidden="true">chevron_right</span>Días por año de servicio</summary><table class="tabla"><thead><tr><th scope="col">Año</th><th scope="col">Desde</th><th scope="col" class="num">Días</th></tr></thead><tbody>' +
                d.porAnio.map(function (x) { return '<tr><td>' + x.anio + '</td><td class="fecha">' + esc(fechaCortaAnio(x.desde)) + '</td><td class="num">' + x.dias + (x.progresivo ? ' <small class="vacio">(' + x.progresivo + ' progresivo)</small>' : '') + '</td></tr>'; }).join('') + '</tbody></table></details>';
        }
        return html;
    }

    function rutaVacaciones() {
        var t = new URLSearchParams(window.location.search).get('t');
        if (t && trabajadorPorId(t)) vacSel = t;
        dibujarVacaciones();
    }
    function dibujarVacaciones() {
        var lista = estado.trabajadores || [];
        $('vac-vacio').hidden = lista.length > 0;
        $('vac-contenido').hidden = !lista.length;
        if (!lista.length) return;
        if (!trabajadorPorId(vacSel)) vacSel = (lista.filter(function (t) { return t.activo; })[0] || lista[0]).id;
        $('vac-filas').innerHTML = lista.map(function (t) {
            var r = resumenVac(t), sel = t.id === vacSel, ahora = r.actual ? 'De vacaciones hasta el ' + fechaCorta(r.actual.hasta) : r.proximo ? rangoCorto(r.proximo.desde, r.proximo.hasta) : '—';
            return '<tr class="fila" tabindex="0" data-id="' + esc(t.id) + '" aria-current="' + sel + '">' +
                '<td class="celda-nombre"><strong>' + esc(t.nombre) + '</strong><span>' + esc(t.fechaIngreso ? 'Ingresó el ' + fechaCortaAnio(t.fechaIngreso) : 'Falta la fecha de ingreso') + (t.activo ? '' : ' · inactivo') + '</span></td>' +
                '<td class="num ocultar-movil">' + (t.fechaIngreso ? r.derecho.total : '—') + '</td>' +
                '<td class="num ocultar-movil">' + r.tomados + '</td>' +
                '<td class="num"><strong' + (r.saldo < 0 ? ' class="vencido"' : '') + '>' + (t.fechaIngreso ? r.saldo : '—') + '</strong></td>' +
                '<td class="ocultar-movil">' + esc(ahora) + '</td>' +
                '<td class="chev"><span class="material-icons" aria-hidden="true">chevron_right</span></td></tr>';
        }).join('');
        var sel = $('vac-trab');
        sel.innerHTML = lista.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.nombre) + '</option>'; }).join('');
        sel.value = vacSel;
        dibujarDetalleVac();
        calcularVac();
    }
    function dibujarDetalleVac() {
        var t = trabajadorPorId(vacSel);
        if (!t) { $('vac-detalle').innerHTML = ''; return; }
        var r = resumenVac(t), regs = ordenarVac(vacDe(t.id));
        var filas = regs.length ? regs.map(function (v) {
            var acciones = '';
            if (v.tipo === 'periodo') {
                var saldoAntes = Math.max(0, r.saldo + v.dias);
                var q = 't=' + encodeURIComponent(t.id) + '&d=comprobante_feriado&inicio=' + v.desde + '&dias=' + v.dias + '&saldo=' + saldoAntes;
                acciones += '<a class="btn-texto" href="/app/documentos?' + esc(q) + '" data-ruta="documentos" data-query="' + esc(q) + '">Comprobante</a> ';
            }
            acciones += '<button type="button" class="btn-texto lq-danger" data-vborrar="' + esc(v.id) + '">Eliminar</button>';
            return '<tr><td class="celda-periodo"><span>' + esc(v.tipo === 'periodo' ? rangoCorto(v.desde, v.hasta) + ' ' + v.hasta.slice(0, 4) : 'Antes de usar el asistente') + '</span><small class="solo-movil">' + textoDias(v.dias) + ' hábiles</small>' + (v.nota ? '<small class="vacio">' + esc(v.nota) + '</small>' : '') + '</td>' +
                '<td class="num ocultar-movil">' + v.dias + '</td><td class="celda-acciones"><div class="acciones-pila">' + acciones + '</div></td></tr>';
        }).join('') : '<tr><td colspan="3" class="vacio">Aún no registras vacaciones de esta persona. Si tomó días antes de usar el asistente, regístralos para que el saldo cuadre.</td></tr>';
        $('vac-detalle').innerHTML = '<div class="panel"><div class="panel-head"><h2>' + esc(t.nombre) + '</h2></div><div class="panel-cuerpo">' + resumenVacHtml(t, r) + '</div>' +
            '<div class="tabla-wrap"><table class="tabla"><caption class="sr-only">Vacaciones registradas</caption><thead><tr><th scope="col">Período</th><th scope="col" class="num ocultar-movil">Días hábiles</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + filas + '</tbody></table></div></div>';
    }
    function elegirVac(id) {
        vacSel = id;
        Array.prototype.forEach.call($('vac-filas').querySelectorAll('tr[data-id]'), function (tr) { tr.setAttribute('aria-current', tr.getAttribute('data-id') === id ? 'true' : 'false'); });
        $('vac-trab').value = id;
        dibujarDetalleVac();
        calcularVac();
    }
    $('vac-filas').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) elegirVac(tr.getAttribute('data-id')); });
    $('vac-filas').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') elegirVac(tr.getAttribute('data-id')); });
    $('vac-trab').addEventListener('change', function (e) { elegirVac(e.target.value); });

    function tipoVac() { var r = document.querySelector('input[name="vac-tipo"]:checked'); return r ? r.value : 'periodo'; }
    function limpiarErroresVac() { Array.prototype.forEach.call($('vac-form').querySelectorAll('[data-verror]'), function (p) { p.hidden = true; p.textContent = ''; }); }
    // Cuenta los días hábiles del período mientras se escribe (el servidor vuelve a contarlos al guardar)
    function calcularVac() {
        var tipo = tipoVac(), caja = $('vac-calculo'), t = trabajadorPorId(vacSel);
        Array.prototype.forEach.call($('vac-form').querySelectorAll('[data-vac]'), function (el) { el.hidden = el.getAttribute('data-vac') !== tipo; });
        caja.innerHTML = '';
        if (!t) return;
        var saldo = resumenVac(t).saldo, dias = 0, detalle = '';
        if (tipo === 'periodo') {
            var desde = $('vac-desde').value, hasta = $('vac-hasta').value;
            if (!desde || !hasta) return;
            try {
                var r = VAC.diasHabiles(desde, hasta, F);
                dias = r.dias;
                var fuera = [];
                if (r.sabados) fuera.push(plural(r.sabados, 'sábado', 'sábados'));
                if (r.feriados.length) fuera.push('feriado' + (r.feriados.length > 1 ? 's' : '') + ' (' + r.feriados.map(function (f) { return f.nombre; }).join(', ') + ')');
                detalle = fuera.length ? ' No cuentan: ' + fuera.join(' ni ') + ', además de los domingos.' : '';
            } catch (err) {
                caja.innerHTML = '<div class="lq-aviso lq-aviso-error"><span class="material-icons" aria-hidden="true">error</span><p>' + esc(err instanceof F.ErrorFeriados ? 'Por ahora solo podemos contar días hábiles de los años con feriados verificados.' : err.message) + '</p></div>';
                return;
            }
        } else {
            dias = parseInt($('vac-dias').value, 10) || 0;
            if (!dias) return;
        }
        var queda = saldo - dias;
        caja.innerHTML = '<div class="lq-aviso lq-aviso-' + (queda < 0 ? 'aviso' : 'info') + '"><span class="material-icons" aria-hidden="true">' + (queda < 0 ? 'warning' : 'info') + '</span><p><strong>' + textoDias(dias) + ' hábiles.</strong>' + esc(detalle) + ' Saldo después de registrarlos: ' + queda + '.' + (queda < 0 ? ' Supera los días que corresponden por años completos.' : '') + '</p></div>';
    }
    $('vac-form').addEventListener('input', calcularVac);
    $('vac-form').addEventListener('change', calcularVac);
    $('vac-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var tipo = tipoVac(), id = vacSel, est = $('vac-estado');
        limpiarErroresVac();
        var cuerpo = tipo === 'periodo' ? { tipo: 'periodo', desde: $('vac-desde').value, hasta: $('vac-hasta').value, nota: $('vac-nota').value } : { tipo: 'ajuste', dias: parseInt($('vac-dias').value, 10) || 0, nota: $('vac-nota').value };
        mensaje(est, '', 'Guardando…');
        api('vacacion', { metodo: 'POST', query: { trabajador: id }, cuerpo: { vacacion: cuerpo } }).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) {
                Object.keys(r.datos.errores || {}).forEach(function (k) { var p = $('vac-form').querySelector('[data-verror="' + k + '"]'); if (p) { p.textContent = r.datos.errores[k]; p.hidden = false; } });
                mensaje(est, 'error', r.datos.error || 'No pudimos guardar.');
                return;
            }
            vacCache.push(r.datos.vacacion);
            $('vac-desde').value = ''; $('vac-hasta').value = ''; $('vac-dias').value = ''; $('vac-nota').value = '';
            dibujarVacaciones();
            mensaje($('vac-estado'), 'ok', 'Guardamos ' + textoDias(r.datos.vacacion.dias) + ' hábiles para ' + trabajadorPorId(id).nombre + '.');
        });
    });
    $('vac-detalle').addEventListener('click', function (e) {
        var b = e.target.closest('[data-vborrar]');
        if (!b) return;
        var id = b.getAttribute('data-vborrar');
        confirmar('¿Eliminar este registro de vacaciones?', 'El saldo del trabajador se vuelve a calcular.', 'Eliminar registro').then(function (si) {
            if (!si) return;
            api('vacacion', { metodo: 'DELETE', query: { id: id } }).then(function (r) {
                if (sinSesion(r)) return;
                if (!r.ok) { mensaje($('vac-estado'), 'error', r.datos.error || 'No pudimos eliminarlo.'); return; }
                vacCache = vacCache.filter(function (v) { return v.id !== id; });
                dibujarVacaciones();
                mensaje($('vac-estado'), 'ok', 'Eliminamos el registro.');
            });
        });
    });

    // ---------- calendario ----------
    function sumarDiasIso(iso, n) { var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000); return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    // Eventos del mes: { fecha, tipo, texto, ruta?, query? } ordenados por fecha
    function eventosDelMes(periodo) {
        var y = +periodo.slice(0, 4), m = +periodo.slice(5, 7), ini = periodo + '-01', ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate(), fin = periodo + '-' + dos(ultimo);
        var ev = [], sinFeriados = false;
        try { F.feriadosEntre(ini, fin).forEach(function (f) { ev.push({ fecha: f.fecha, tipo: 'feriado', texto: f.nombre }); }); } catch (e) { sinFeriados = true; }
        if (activos().length) {
            var mesAnt = m === 1 ? 12 : m - 1, dia10 = periodo + '-10', plazo = dia10;
            try { plazo = F.siguienteDiaHabil(dia10); } catch (e) { /* sin feriados verificados */ }
            ev.push({ fecha: plazo, tipo: 'cotiz', texto: 'Cotizaciones de ' + MESES[mesAnt - 1] });
            if (periodo + '-13' !== plazo) ev.push({ fecha: periodo + '-13', tipo: 'previred', texto: 'Último día por internet en Previred' });
        }
        (estado.trabajadores || []).forEach(function (t) {
            var nombre = t.nombre.split(' ')[0];
            if (t.activo && t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && t.fechaTerminoPlazo >= ini && t.fechaTerminoPlazo <= fin) ev.push({ fecha: t.fechaTerminoPlazo, tipo: 'plazo', texto: 'Vence el plazo fijo de ' + nombre, ruta: 'trabajadores/' + t.id });
            if (t.activo && t.fechaIngreso) { var reg = PEND.plazoRegistroDT(t.fechaIngreso); if (reg >= ini && reg <= fin) ev.push({ fecha: reg, tipo: 'dt', texto: 'Registrar en Mi DT el contrato de ' + nombre, ruta: 'trabajadores/' + t.id }); }
            if (t.activo && t.fechaIngreso && t.fechaIngreso < ini) {
                var k = y - +t.fechaIngreso.slice(0, 4), aniv = k >= 1 ? VAC.aniversario(t.fechaIngreso, k) : null;
                if (aniv && aniv >= ini && aniv <= fin) ev.push({ fecha: aniv, tipo: 'aniv', texto: nombre + ' cumple ' + plural(k, 'año', 'años'), ruta: 'vacaciones', query: 't=' + encodeURIComponent(t.id) });
            }
            vacDe(t.id).forEach(function (v) {
                if (v.tipo !== 'periodo' || v.hasta < ini || v.desde > fin) return;
                for (var d = v.desde < ini ? ini : v.desde; d <= v.hasta && d <= fin; d = sumarDiasIso(d, 1)) ev.push({ fecha: d, tipo: 'vac', texto: nombre + ' de vacaciones', ruta: 'vacaciones', query: 't=' + encodeURIComponent(t.id), vac: v, primero: d === v.desde || d === ini });
            });
        });
        if (estado.limites.paseVence) { var pv = isoChile(estado.limites.paseVence); if (pv >= ini && pv <= fin) ev.push({ fecha: pv, tipo: 'pase', texto: 'Vence tu Pase Pyme', ruta: 'cuenta' }); }
        var orden = { feriado: 0, cotiz: 1, previred: 2, plazo: 3, dt: 3, pase: 4, vac: 5, aniv: 6 };
        ev.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : orden[a.tipo] - orden[b.tipo]; });
        return { eventos: ev, sinFeriados: sinFeriados, ini: ini, fin: fin, ultimo: ultimo };
    }
    function chipEvento(e) {
        var cls = 'cal-ev ev-' + e.tipo, txt = esc(e.texto);
        if (e.ruta) return '<a class="' + cls + '" href="/app/' + e.ruta + (e.query ? '?' + esc(e.query) : '') + '" data-ruta="' + e.ruta + '"' + (e.query ? ' data-query="' + esc(e.query) + '"' : '') + ' title="' + txt + '">' + txt + '</a>';
        return '<span class="' + cls + '" title="' + txt + '">' + txt + '</span>';
    }
    function dibujarCalendario() {
        var nombreMes = nombrePeriodo(periodoSel), r = eventosDelMes(periodoSel), hoy = hoyIso();
        $('cal-titulo').textContent = 'Calendario de ' + nombreMes;
        var porDia = {};
        r.eventos.forEach(function (e) { (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });
        var primero = new Date(Date.UTC(+periodoSel.slice(0, 4), +periodoSel.slice(5, 7) - 1, 1)).getUTCDay(), antes = (primero + 6) % 7, celdas = [];
        for (var i = antes; i > 0; i--) celdas.push({ iso: sumarDiasIso(r.ini, -i), fuera: true });
        for (var d = 1; d <= r.ultimo; d++) celdas.push({ iso: periodoSel + '-' + dos(d), fuera: false });
        while (celdas.length % 7) celdas.push({ iso: sumarDiasIso(celdas[celdas.length - 1].iso, 1), fuera: true });
        $('cal-grilla').innerHTML = celdas.map(function (c, idx) {
            var evs = c.fuera ? [] : (porDia[c.iso] || []), dow = idx % 7;
            var clases = 'cal-dia' + (c.fuera ? ' fuera' : '') + (c.iso === hoy ? ' hoy' : '') + (dow >= 5 ? ' finde' : '') + (evs.some(function (e) { return e.tipo === 'feriado'; }) ? ' feriado' : '') + (evs.length ? ' tiene-ev' : '');
            var visibles = evs.slice(0, 3), resto = evs.length - visibles.length;
            return '<div class="' + clases + '" role="listitem" aria-label="' + esc(fechaLarga(c.iso) + (evs.length ? ': ' + evs.map(function (e) { return e.texto; }).join(', ') : '')) + '">' +
                '<span class="cal-num">' + (+c.iso.slice(8)) + '</span>' + visibles.map(chipEvento).join('') + (resto > 0 ? '<span class="cal-mas">y ' + resto + ' más</span>' : '') + '</div>';
        }).join('');
        // Lista del mes: los días de un mismo período de vacaciones se muestran una sola vez
        var lista = r.eventos.filter(function (e) { return e.tipo !== 'vac' || e.primero; });
        $('cal-lista-titulo').textContent = mayuscula(nombreMes);
        $('cal-lista').innerHTML = lista.length ? lista.map(function (e) {
            var texto = e.tipo === 'vac' ? e.texto.replace(' de vacaciones', '') + ': vacaciones del ' + rangoCorto(e.vac.desde, e.vac.hasta) : e.texto;
            var accion = e.ruta ? '<a class="btn-texto" href="/app/' + e.ruta + (e.query ? '?' + esc(e.query) : '') + '" data-ruta="' + e.ruta + '"' + (e.query ? ' data-query="' + esc(e.query) + '"' : '') + '>Ver</a>' : '';
            return '<li><span class="fecha-ev">' + esc(fechaCorta(e.fecha)) + '</span><div><strong>' + esc(texto) + '</strong></div>' + accion + '</li>';
        }).join('') : '<li><span></span><div><strong>Nada registrado este mes.</strong></div></li>';
        $('cal-nota').textContent = r.sinFeriados ? 'Este año aún no tiene los feriados verificados: no aparecen en el calendario.' : 'Los feriados son los nacionales; no incluye feriados regionales ni locales.';
    }

    // ---------- contratos y finiquitos: contrato, anexos y término de cada persona (documentos del asistente) ----------
    function cubiertoPorPase(producto) {
        var cob = estado && estado.pase && estado.pase.cobertura, lim = estado && estado.limites;
        return !!(cob && lim && lim.paseVence && cob[producto] && cob[producto].indexOf(lim.paseProducto) >= 0);
    }
    var ANEXOS_DOC = ['anexo_contrato', 'pacto_horas_extra', 'anexo_datos', 'anexo_42h'];
    function docsDe(id, tipos) { return docsCache.filter(function (d) { return d.trabajadorId === id && tipos.indexOf(d.tipo) >= 0; }); }
    function dibujarContratos() {
        var lista = (estado.trabajadores || []).slice().sort(function (a, b) { return (b.activo ? 1 : 0) - (a.activo ? 1 : 0); });
        var hay = lista.length > 0 && !!estado.empresa;
        $('gen-vacio').hidden = hay;
        $('pm-gen').hidden = !hay;
        if (!hay) return;
        $('gen-filas').innerHTML = lista.map(function (t) {
            var contratos = docsDe(t.id, ['contrato']), anexos = docsDe(t.id, ANEXOS_DOC), c = contratos[contratos.length - 1], v = vencePlazo(t);
            function enlace(tipo, texto, primario) {
                var q = 't=' + encodeURIComponent(t.id) + '&d=' + tipo;
                return '<a class="' + (primario ? 'btn btn-chico' : 'btn-texto') + '" href="/app/documentos?' + esc(q) + '" data-ruta="documentos" data-query="' + esc(q) + '">' + esc(texto) + '</a>';
            }
            var meta = textoContrato(t) + (v ? ', ' + v.texto : '') + (t.activo ? '' : ' · inactivo');
            return '<tr><td class="celda-nombre"><strong>' + esc(t.nombre) + '</strong><span>' + esc(meta) + '</span></td>' +
                '<td>' + (c ? '<span class="sello sello-emitida">Emitido · ' + esc(fechaCortaAnio(isoChile(c.emitido))) + '</span>' : '<span class="sello sello-sin">Sin emitir aquí</span>') + '</td>' +
                '<td class="ocultar-movil celda-cuotas">' + (anexos.length ? plural(anexos.length, 'documento', 'documentos') + '<small>último el ' + esc(fechaCortaAnio(isoChile(anexos[anexos.length - 1].emitido))) + '</small>' : '<span class="vacio">—</span>') + '</td>' +
                '<td class="celda-acciones"><div class="gen-acciones">' +
                enlace('contrato', c ? 'Contrato' : 'Emitir contrato', !c) + enlace('anexo_contrato', 'Anexo') + enlace('pacto_horas_extra', 'Horas extra') + enlace('finiquito', 'Finiquito') +
                '</div></td></tr>';
        }).join('');
        var nota = cubiertoPorPase('contrato') ? 'Con tu pase vigente el contrato, los anexos y el pacto de horas extra salen sin marca de agua y en Word.' : 'Sin Pase Pyme los documentos llevan la marca «Vista previa». ' + textoPaseVenta();
        nota += cubiertoPorPase('finiquito') ? ' El finiquito también está incluido.' : ' El finiquito sin marca viene con el Pase de 12 meses.';
        $('pm-gen-nota').textContent = nota + ' «Sin emitir aquí» solo significa que no se emitió desde el asistente.';
    }

    // ---------- Pase Pyme y cuenta ----------
    var KEY_COMPRA_GA = 'cl_pyme_compra_ga';
    var NOMBRE_PASE = { pyme3: '3 meses', pyme12: '12 meses' };

    function ventaPase() { return !!(estado && estado.pase && estado.pase.venta); }
    function textoPaseVenta() { return ventaPase() ? 'Puedes comprarlo en «Mi cuenta».' : 'El Pase Pyme aún no está a la venta.'; }

    function dibujarCuenta() { dibujarPase(); dibujarImportar(); }
    function dibujarPase() {
        if (!estado) return;
        var lim = estado.limites, cat = (estado.pase && estado.pase.productos) || [];
        var vigente = !!lim.paseVence;
        $('pm-pase-estado').textContent = vigente
            ? 'Tu Pase Pyme (' + (NOMBRE_PASE[lim.paseProducto] || '') + ') está vigente hasta el ' + fechaVence(lim.paseVence) + '. Si compras otro, empieza cuando termina este.'
            : 'Tu cuenta no tiene un pase vigente: puedes tener 1 trabajador activo y los documentos salen con marca de agua.';
        var caja = $('pm-pase-opciones');
        if (!ventaPase()) { caja.innerHTML = '<p class="texto-ayuda">El Pase Pyme aún no está a la venta.</p>'; return; }
        caja.innerHTML = cat.map(function (p) {
            return '<div class="pm-pase-op"><div><strong>Pase de ' + esc(NOMBRE_PASE[p.id] || p.titulo) + '</strong>' +
                '<span class="pm-pase-precio">' + pesos(p.monto) + '</span>' +
                '<span class="pm-pase-mes">Equivale a ' + pesos(p.porMes) + ' al mes</span></div>' +
                '<button type="button" class="btn" data-comprar="' + esc(p.id) + '"><span class="material-icons" aria-hidden="true">shopping_cart</span>' + (vigente ? 'Agregar ' : 'Comprar ') + esc(NOMBRE_PASE[p.id] || p.titulo) + '</button></div>';
        }).join('');
    }

    $('pm-pase-opciones').addEventListener('click', function (e) {
        var b = e.target.closest('[data-comprar]');
        if (!b || !window.CLCheckout) return;
        var producto = b.getAttribute('data-comprar'), est = $('pm-pase-msg');
        mensaje(est, '', '');
        window.CLCheckout.buyKit(producto, {}, {
            endpoint: '/api/pyme/comprar',
            headers: { 'X-CL-Pyme': '1' },
            variante: 'servicio',
            onAccept: function () { b.disabled = true; mensaje(est, '', 'Conectando con Flow…'); },
            onCancel: function () { mensaje(est, '', ''); },
            onError: function (msg) { b.disabled = false; mensaje(est, 'error', msg); }
        });
    });

    // Al volver de Flow (?pase=ok|pendiente|rechazado): la confirmación del pago llega al servidor aparte, por eso se consulta unos segundos
    function volverDePago() {
        var q = new URLSearchParams(window.location.search), res = q.get('pase'), orden = q.get('o') || '';
        if (!res) return;
        navegar('cuenta', { reemplazar: true });
        var est = $('pm-pase-msg');
        if (res === 'rechazado') { mensaje(est, 'error', 'El pago no se completó y no se hizo ningún cargo.'); return; }
        if (res === 'pendiente') { mensaje(est, '', 'Tu pago está pendiente en Flow. Cuando se confirme, tu pase aparecerá aquí.'); return; }
        if (res !== 'ok') return;
        mensaje(est, '', 'Recibimos tu pago. Estamos activando tu pase…');
        var intentos = 0;
        (function consultar() {
            api('estado').then(function (r) {
                if (sinSesion(r)) return;
                var vence = r.ok && r.datos.limites && r.datos.limites.paseVence;
                var antes = estado && estado.limites && estado.limites.paseVence;
                if (vence && (!antes || vence !== antes || intentos > 0)) {
                    estado = r.datos;
                    dibujarMarco();
                    dibujarRuta();
                    mensaje($('pm-pase-msg'), 'ok', 'Tu pase está activo hasta el ' + fechaVence(vence) + '. Te enviamos el comprobante por correo.');
                    registrarCompraGA(r.datos.limites && r.datos.limites.paseProducto, orden);
                    return;
                }
                if (++intentos < 8) { window.setTimeout(consultar, 2500); return; }
                mensaje($('pm-pase-msg'), '', 'Tu pago está en proceso. Si en unos minutos no ves tu pase, escríbenos a contacto@calculolaboral.cl con el número de orden ' + orden + '.');
            });
        })();
    }
    // La venta se cuenta una vez por orden en GA4
    function registrarCompraGA(producto, orden) {
        if (!producto || !orden || !window.CLCheckout) return;
        try {
            if (window.localStorage.getItem(KEY_COMPRA_GA + orden) === '1') return;
            window.localStorage.setItem(KEY_COMPRA_GA + orden, '1');
        } catch (e) { /* sin almacenamiento */ }
        window.CLCheckout.track('purchase', producto, { transaction_id: orden });
    }

    // ---------- traer datos del generador de liquidaciones ----------
    function leerGenerador() {
        var crudo = guardado(KEY_GENERADOR);
        if (!crudo) return null;
        try {
            var g = JSON.parse(crudo);
            if (!g || g.v !== 1 || !Array.isArray(g.trabajadores)) return null;
            var emp = g.empresa || {};
            var empresaOk = !!(emp.razonSocial && Rut.valido(emp.rut));
            var trabajadores = g.trabajadores.filter(function (t) { return t && t.nombre && t.rut; }).map(function (t) {
                return {
                    nombre: t.nombre, rut: t.rut, cargo: t.cargo || '', fechaIngreso: t.fechaIngreso || '', contrato: t.contrato || 'indefinido',
                    jornadaHoras: t.jornadaHoras || 42, sueldoBase: t.sueldoBase || 0, colacion: t.colacion || 0, movilizacion: t.movilizacion || 0,
                    afp: t.afp || 'Modelo', salud: t.salud || 'fonasa', isapreNombre: t.isapreNombre || '', isaprePlanUF: t.isaprePlanUF || 0
                };
            });
            if (!empresaOk && !trabajadores.length) return null;
            return { empresa: empresaOk ? { razonSocial: emp.razonSocial, rut: emp.rut, direccion: emp.direccion || '', logo: emp.logo || '' } : null, trabajadores: trabajadores };
        } catch (e) { return null; }
    }
    function dibujarImportar() {
        var g = guardado(KEY_IMPORTADO) ? null : leerGenerador();
        $('pm-sec-importar').hidden = !g;
        if (!g) return;
        var partes = [];
        if (g.empresa && !estado.empresa) partes.push('la empresa «' + g.empresa.razonSocial + '»'); // si la cuenta ya tiene empresa, no se reemplaza
        if (g.trabajadores.length) partes.push(g.trabajadores.length + (g.trabajadores.length === 1 ? ' trabajador' : ' trabajadores'));
        $('pm-sec-importar').hidden = !partes.length;
        $('pm-imp-resumen').textContent = partes.join(' y ');
    }
    $('pm-imp-btn').addEventListener('click', function () {
        var g = leerGenerador(), est = $('pm-imp-estado');
        if (!g) return;
        var empresaNueva = estado.empresa ? null : g.empresa; // la empresa que ya está guardada no se reemplaza
        if (!estado.empresa && !g.empresa) { mensaje(est, 'error', 'Primero completa los datos de tu empresa: en el generador faltan la razón social o el RUT.'); return; }
        mensaje(est, '', 'Copiando…');
        api('importar', { metodo: 'POST', cuerpo: { empresa: empresaNueva || undefined, trabajadores: g.trabajadores } }).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { mensaje(est, 'error', r.datos.error || 'No pudimos copiar los datos.'); return; }
            var d = r.datos, omit = d.omitidos || [];
            var txt = 'Listo: ' + (d.empresa ? 'empresa y ' : '') + d.importados + (d.importados === 1 ? ' trabajador copiado.' : ' trabajadores copiados.');
            if (omit.length) txt += ' No se copiaron ' + omit.length + ': ' + omit.map(function (o) { return o.nombre + ' (' + { limite: 'supera el límite de tu cuenta', repetido: 'ya estaba', invalido: 'datos incompletos o inválidos' }[o.motivo] + ')'; }).join('; ') + '.';
            guardar(KEY_IMPORTADO, '1');
            cargar().then(function () { avisoGlobal('info', txt); });
        });
    });

    // ---------- liquidaciones de sueldo ----------
    // Del más nuevo al más antiguo, hasta el mes en curso aunque pase del último mes con valores cargados (esos van con valores estimados y aviso)
    var PERIODOS = P.periodos(hoyIso().slice(0, 7)).slice().reverse();
    var ALMACEN_LOCAL = null;
    try { ALMACEN_LOCAL = window.localStorage; } catch (e) { ALMACEN_LOCAL = null; }
    var VALORES = VL.crear({ parametros: P, fetch: function (u, o) { return window.fetch(u, o); }, storage: ALMACEN_LOCAL, extender: true });
    var VAL = {};            // valores por mes: { estado: 'cargando' | 'ok' | 'error', ok, mes, fuentes, avisos, notas, mensaje }
    var mesesCache = {};     // periodo → { trabajadorId: mes guardado }
    var periodoSel = null;   // mes que se está viendo (el de la barra superior)
    var editando = null;     // { id, t, mes, nota, guardado } mientras el editor está abierto
    var ultimasImpresas = [];
    var MONTO_MAX = 50000000;

    function periodoPorDefecto() {
        var a = hoyIso().split('-').map(Number), y = a[0], m = a[1];
        if (a[2] <= 10) { m--; if (m < 1) { m = 12; y--; } }
        var p = y + '-' + dos(m);
        if (p < P.PRIMER_MES) p = P.PRIMER_MES;
        if (p > PERIODOS[0]) p = PERIODOS[0];
        return p;
    }
    function nombrePeriodo(p) { var a = p.split('-'); return MESES[+a[1] - 1] + ' ' + a[0]; }
    function mayuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function tienePase() { return !!(estado && estado.limites && estado.limites.paseVence && Date.parse(estado.limites.paseVence) > Date.now()); }
    function activos() { return ((estado && estado.trabajadores) || []).filter(function (t) { return t.activo; }); }
    function trabajadorPorId(id) { return ((estado && estado.trabajadores) || []).filter(function (t) { return t.id === id; })[0]; }
    function mesesDe(periodo) { return mesesCache[periodo] || {}; }
    function numero(v) { return v === '' || v == null ? 0 : v; }
    function decimal(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(x) && x > 0 ? x : 0; }
    function textoMarcar() { return 'Marcar ' + (ultimasImpresas.length === 1 ? 'la liquidación impresa como emitida' : 'las ' + ultimasImpresas.length + ' impresas como emitidas'); }

    function cargarMeses(periodo) {
        return api('meses', { query: { periodo: periodo } }).then(function (r) {
            if (sinSesion(r)) return false;
            if (r.ok) {
                var mapa = {};
                (r.datos.meses || []).forEach(function (x) { mapa[x.trabajadorId] = x.mes; });
                mesesCache[periodo] = mapa;
            }
            return r.ok;
        });
    }

    function cargarValores(periodo, forzar) {
        var actual = VAL[periodo];
        if (actual && (actual.estado === 'cargando' || (actual.estado === 'ok' && !forzar))) return;
        VAL[periodo] = { estado: 'cargando', ok: false };
        VALORES.obtener(periodo, !!forzar).then(function (r) {
            VAL[periodo] = Object.assign({ estado: r.ok ? 'ok' : 'error' }, r);
        }, function () {
            VAL[periodo] = { estado: 'error', ok: false, mensaje: 'No pudimos consultar la UF y la UTM de ese mes. Intenta de nuevo en unos minutos.' };
        }).then(function () {
            if (!estado) return;
            if (periodo === periodoSel) { dibujarLiquidaciones(); if (editando) vistaPrevia(); }
        });
    }

    // Carga los meses guardados que hacen falta (el que se ve y el de los avisos) y vuelve a dibujar
    function cargarLiquidaciones() {
        if (!periodoSel) periodoSel = periodoPorDefecto();
        var toca = PEND.periodoLiquidacion(hoyIso());
        var periodos = [periodoSel];
        if (toca && toca.periodo !== periodoSel && PERIODOS.indexOf(toca.periodo) >= 0) periodos.push(toca.periodo);
        dibujarLiquidaciones();
        cargarValores(periodoSel);
        return Promise.all(periodos.map(function (p) { return mesesCache[p] ? true : cargarMeses(p); })).then(function () {
            if (!estado) return;
            dibujarLiquidaciones();
            dibujarPendientes();
        });
    }

    // Selector de mes de la barra superior
    function dibujarSelectorMes() {
        var sel = $('app-mes');
        if (!sel.options.length) sel.innerHTML = PERIODOS.map(function (p) { return '<option value="' + p + '">' + esc(mayuscula(nombrePeriodo(p))) + '</option>'; }).join('');
        sel.value = periodoSel;
        var i = PERIODOS.indexOf(periodoSel);
        $('app-mes-ant').disabled = i < 0 || i >= PERIODOS.length - 1;
        $('app-mes-sig').disabled = i <= 0;
    }
    function cambiarPeriodo(p, sinCargar) {
        if (!p || p === periodoSel || PERIODOS.indexOf(p) < 0) return;
        periodoSel = p;
        ultimasImpresas = [];
        cerrarMes();
        mensaje($('pm-liq-estado'), '', '');
        mensaje($('ini-estado'), '', '');
        if (vistaActual === 'liquidaciones' && rutaActual() !== 'liquidaciones') navegar('liquidaciones', { reemplazar: true, sinScroll: true });
        if (!sinCargar) cargarLiquidaciones(); else dibujarSelectorMes();
        if (vistaActual === 'trabajador' || vistaActual === 'calendario') dibujarRuta();
    }
    $('app-mes').addEventListener('change', function (e) { cambiarPeriodo(e.target.value); });
    $('app-mes-ant').addEventListener('click', function () { cambiarPeriodo(PERIODOS[PERIODOS.indexOf(periodoSel) + 1]); });
    $('app-mes-sig').addEventListener('click', function () { cambiarPeriodo(PERIODOS[PERIODOS.indexOf(periodoSel) - 1]); });

    function valoresAviso() {
        var caja = $('pm-liq-valores'), v = VAL[periodoSel], html = '';
        function aviso(nivel, icono, texto) { html += '<div class="lq-aviso lq-aviso-' + nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + '</p></div>'; }
        if (!v || v.estado === 'cargando') aviso('info', 'hourglass_empty', 'Consultando la UF y la UTM de ' + nombrePeriodo(periodoSel) + '…');
        else if (!v.ok) aviso('error', 'error', v.mensaje || 'No se pudieron obtener los valores del mes.');
        else {
            (v.avisos || []).forEach(function (t) { aviso('aviso', 'warning', t); });
            (v.notas || []).forEach(function (t) { aviso('info', 'info', t); });
            if (v.vigencia && !v.estimado && v.vigencia.verificado.slice(0, 7) < periodoSel) {
                aviso('info', 'info', 'El ingreso mínimo, los topes y las comisiones AFP son los vigentes al ' + v.vigencia.verificado.split('-').reverse().join('-') + '. Confirma que no cambiaron antes de emitir las liquidaciones.');
            }
        }
        caja.innerHTML = html;
    }

    function dibujarLiquidaciones() {
        if (!estado) return;
        dibujarSelectorMes();
        $('liq-titulo').textContent = 'Liquidaciones de ' + nombrePeriodo(periodoSel);
        valoresAviso();

        var lista = activos(), guardados = mesesDe(periodoSel);
        $('pm-liq-vacio').hidden = lista.length > 0;
        $('liq-panel').hidden = !lista.length;
        $('pm-liq-acciones').hidden = !lista.length;
        $('pm-liq-nota-marca').textContent = tienePase()
            ? 'Con tu pase vigente las liquidaciones salen sin marca de agua. Revisa cada una antes de entregarla.'
            : 'Sin Pase Pyme las liquidaciones llevan la marca «Vista previa». ' + textoPaseVenta() + ' Revisa cada liquidación antes de entregarla.';

        var porPreparar = 0, guardadas = 0, porEmitir = 0;
        $('pm-liq-lista').innerHTML = lista.map(function (t) {
            var reg = guardados[t.id], dias = L.diasBase(t, periodoSel), est = L.estadoDe(reg), meta = '', acciones = '';
            if (!reg && dias === 0) {
                meta = t.fechaIngreso && t.fechaIngreso > periodoSel + '-31' ? 'Ingresa el ' + fechaLarga(t.fechaIngreso) + '.' : 'Su contrato a plazo fijo terminó antes de este mes.';
            } else {
                if (est === 'sin_datos') { porPreparar++; porEmitir++; }
                else {
                    guardadas++;
                    if (est !== 'emitida') porEmitir++;
                    if (est !== 'emitida' && !reg.calculo) meta = 'Guardada sin cálculo: ábrela para calcularla.';
                }
                acciones = '<button type="button" class="btn btn-chico" data-liq="editar" data-id="' + esc(t.id) + '"><span class="material-icons" aria-hidden="true">' + (reg ? 'edit' : 'playlist_add') + '</span>' + (reg ? 'Abrir' : 'Preparar') + '</button>';
                if (reg) {
                    acciones += '<button type="button" class="btn-texto" data-liq="imprimir" data-id="' + esc(t.id) + '">Imprimir</button>' +
                        '<button type="button" class="btn-texto" data-liq="' + (est === 'emitida' ? 'desmarcar' : 'marcar') + '" data-id="' + esc(t.id) + '">' + (est === 'emitida' ? 'Quitar marca' : 'Marcar emitida') + '</button>';
                }
                acciones = '<div class="acciones-pila acciones-fila">' + acciones + '</div>';
            }
            var abierta = editando && editando.id === t.id;
            return '<tr' + (abierta ? ' aria-current="true" class="fila"' : '') + '><td class="celda-nombre"><strong>' + esc(t.nombre) + '</strong><span>' + esc(meta || t.cargo || textoContrato(t)) + '</span></td>' +
                '<td>' + selloLiq(reg, est, dias) + '</td>' +
                '<td class="num">' + (reg && reg.calculo ? pesos(reg.calculo.liquido) : '<span class="vacio">—</span>') + '</td>' +
                '<td class="celda-acciones">' + acciones + '</td></tr>';
        }).join('');
        $('pm-liq-preparar').hidden = porPreparar === 0;
        $('pm-liq-imprimir-todas').disabled = guardadas === 0;
        $('pm-liq-marcar').hidden = !ultimasImpresas.length;
        $('pm-liq-marcar').textContent = textoMarcar();
        $('nav-liq-n').textContent = porEmitir ? String(porEmitir) : '';
        $('nav-liq-n').title = porEmitir ? plural(porEmitir, 'liquidación por emitir', 'liquidaciones por emitir') + ' en ' + nombrePeriodo(periodoSel) : '';
        dibujarPrevired();
        if (vistaActual === 'inicio') dibujarInicio();
    }

    // Lo que se paga en Previred en el mes, agrupado por institución, con las liquidaciones guardadas que traen el desglose
    function dibujarPrevired() {
        var guardados = mesesDe(periodoSel), ids = Object.keys(guardados);
        var regs = ids.map(function (id) { return guardados[id] && guardados[id].calculo; });
        var r = L.previred(regs), caja = $('liq-previred');
        caja.hidden = !ids.length;
        if (!ids.length) return;
        $('liq-previred-titulo').textContent = 'Para pagar en Previred por ' + nombrePeriodo(periodoSel);
        $('liq-previred-filas').innerHTML = r.filas.length ? r.filas.map(function (f) {
            return '<tr><td>' + esc(f.institucion) + '</td><td class="num">' + pesos(f.monto) + '</td></tr>';
        }).join('') : '<tr><td colspan="2" class="vacio">Guarda las liquidaciones del mes para ver el resumen.</td></tr>';
        $('liq-previred-total').textContent = pesos(r.total);
        var faltan = ids.filter(function (id) { var c = guardados[id] && guardados[id].calculo; return !c || !c.conDesglose; })
            .map(function (id) { var t = trabajadorPorId(id); return t ? t.nombre : null; }).filter(Boolean);
        var pie = '';
        if (r.incluidos) pie += '<p>Costo total para la empresa en ' + esc(MESES[+periodoSel.slice(5) - 1]) + ': <strong class="mono">' + pesos(r.costo) + '</strong> (sueldos y cotizaciones del empleador).</p>';
        if (r.impuesto) pie += '<p>Impuesto único retenido: <strong class="mono">' + pesos(r.impuesto) + '</strong>. No se paga en Previred: se declara y paga en el Formulario 29 del SII.</p>';
        if (faltan.length) pie += '<p>No incluye a ' + esc(faltan.join(', ')) + ': abre su liquidación y guárdala de nuevo para sumarla.</p>';
        pie += '<p>Es una estimación con las tasas de Previred de ' + esc(nombrePeriodo(periodoSel)) + '. El monto exacto lo calcula Previred al declarar. Si tu empresa está afiliada a una caja de compensación, parte del 7% de Fonasa se paga a la caja.</p>';
        $('liq-previred-pie').innerHTML = pie;
    }

    // /app/liquidaciones/<id>: abre el editor de esa persona en el mes de la barra
    function rutaLiquidaciones(id) {
        dibujarLiquidaciones();
        if (!id) { if (editando) cerrarMes(); return; }
        if (!trabajadorPorId(id)) { navegar('liquidaciones', { reemplazar: true }); return; }
        var abrir = function () { if (vistaActual === 'liquidaciones' && rutaActual() === 'liquidaciones/' + id) abrirMes(id); };
        if (mesesCache[periodoSel]) abrir(); else cargarMeses(periodoSel).then(function () { dibujarLiquidaciones(); abrir(); });
    }

    // --- editor de un mes ---
    function listaFilas(path) {
        var ph = document.querySelector('[data-lista="' + path + '"]').getAttribute('data-ph');
        return (editando.mes[path] || []).map(function (it) {
            return '<div class="lq-row"><input type="text" maxlength="60" aria-label="Concepto" placeholder="' + esc(ph) + '" data-campo="nombre" value="' + esc(it.nombre) + '">' +
                '<input type="text" inputmode="numeric" aria-label="Monto" placeholder="$0" data-campo="monto" value="' + (it.monto ? pesos(it.monto) : '') + '">' +
                '<button type="button" class="lq-x" aria-label="Quitar" data-quitar><span class="material-icons" aria-hidden="true">close</span></button></div>';
        }).join('');
    }
    function pintarListas() {
        Array.prototype.forEach.call($('pm-liq-form').querySelectorAll('[data-lista]'), function (c) { c.innerHTML = listaFilas(c.getAttribute('data-lista')); });
    }
    function leerLista(cont) {
        return Array.prototype.map.call(cont.querySelectorAll('.lq-row'), function (f) {
            return { nombre: f.querySelector('[data-campo="nombre"]').value, monto: Math.min(MONTO_MAX, parseInt(f.querySelector('[data-campo="monto"]').value.replace(/\D/g, ''), 10) || 0) };
        });
    }
    function leerMesForm() {
        var o = recoger($('pm-liq-form')), m = editando.mes;
        // Los topes son los que acepta el servidor: así un error de tipeo no impide guardar
        ['diasTrabajados', 'diasLicencia'].forEach(function (k) { m[k] = Math.min(30, numero(o[k])); });
        ['gratificacionMonto', 'comisiones', 'tratos', 'viaticos', 'asignacionFamiliar', 'apvMonto', 'anticipo', 'creditoCCAF', 'cuotaSindical'].forEach(function (k) { m[k] = Math.min(MONTO_MAX, numero(o[k])); });
        m.horasExtra = Math.min(300, decimal(o.horasExtra));
        m.gratificacion = o.gratificacion;
        m.apvRegimen = o.apvRegimen;
        m.scModo = o.scModo === 'no' ? 'no' : 'calcular';
    }
    function visibilidadMes() {
        var m = editando.mes;
        Array.prototype.forEach.call($('pm-liq-form').querySelectorAll('[data-si]'), function (el) {
            var c = el.getAttribute('data-si');
            var variable = (m.comisiones || 0) + (m.tratos || 0) > 0;
            el.hidden = !((c === 'grat-manual' && m.gratificacion === 'manual') || (c === 'apv' && m.apvMonto > 0) ||
                (c === 'sc' && variable) || (c === 'sc-calcular' && variable && m.scModo !== 'no'));
        });
    }

    function abrirMes(id) {
        var t = trabajadorPorId(id);
        if (!t) return;
        var reg = mesesDe(periodoSel)[id], nota = '';
        var mes = reg ? JSON.parse(JSON.stringify(reg)) : L.mesBase(t, periodoSel);
        mes.cuotasPrestamo = cuotasVigentes(t, reg, periodoSel);
        if (!reg && mes.diasTrabajados < 30) nota = 'Pusimos ' + mes.diasTrabajados + ' días trabajados según su fecha de ingreso o de término de contrato (mes de 30 días). Confírmalo.';
        editando = { id: id, t: t, mes: mes, nota: nota, guardado: !!reg };
        llenar($('pm-liq-form'), mes);
        pintarListas();
        pintarAusencias();
        dibujarCuotasMes();
        visibilidadMes();
        $('pm-liq-editor-titulo').textContent = t.nombre + ' · ' + mayuscula(nombrePeriodo(periodoSel));
        $('pm-liq-quitar').hidden = !reg;
        mensaje($('pm-liq-editor-estado'), '', '');
        $('pm-liq-editor').hidden = false;
        dibujarLiquidaciones();
        vistaPrevia();
        $('pm-liq-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function cerrarMes() { editando = null; $('pm-liq-editor').hidden = true; }

    // Cuotas del mes: las de la ficha mientras la liquidación no esté emitida; una vez emitida, las que se guardaron con ella
    function cuotasVigentes(t, reg, periodo) { return reg && reg.emitida ? (reg.cuotasPrestamo || []) : L.cuotasDelMes(t, periodo); }
    function conCuotas(t, reg, periodo) { return Object.assign({}, reg, { cuotasPrestamo: cuotasVigentes(t, reg, periodo) }); }

    function dibujarCuotasMes() {
        var caja = $('pm-liq-cuotas'), t = editando.t, m = editando.mes, emitida = !!m.emitida, p = periodoSel;
        var cuotas = m.cuotasPrestamo || [];
        var pausados = emitida ? [] : (t.prestamos || []).filter(function (x) { return (x.pausas || []).indexOf(p) >= 0; });
        if (!cuotas.length && !pausados.length) { caja.hidden = true; caja.innerHTML = ''; return; }
        var ruta = 'trabajadores/' + t.id + '/prestamos';
        var html = '<p class="lq-help">Cuotas de préstamos de este mes (<a href="/app/' + esc(ruta) + '" data-ruta="' + esc(ruta) + '">ver préstamos</a>):</p><div class="cuotas-lista">';
        cuotas.forEach(function (c) {
            html += '<div class="cuota-fila"><span><strong>' + esc(c.nombre) + '</strong><small>Cuota ' + c.numero + ' de ' + c.de + '</small></span><span class="mono">' + pesos(c.monto) + '</span>' +
                (emitida ? '' : '<button type="button" class="btn-texto" data-cuota="pausar" data-id="' + esc(c.id) + '">Postergar</button>') + '</div>';
        });
        pausados.forEach(function (x) {
            html += '<div class="cuota-fila cuota-pausada"><span><strong>' + esc(x.concepto) + '</strong><small>Postergada: pasa al final del préstamo</small></span><span class="mono">$0</span>' +
                '<button type="button" class="btn-texto" data-cuota="reanudar" data-id="' + esc(x.id) + '">Descontar</button></div>';
        });
        html += '</div>';
        if (emitida) html += '<p class="lq-help">La liquidación está emitida: las cuotas quedan como se emitieron.</p>';
        caja.innerHTML = html;
        caja.hidden = false;
    }
    $('pm-liq-cuotas').addEventListener('click', function (e) {
        var b = e.target.closest('[data-cuota]');
        if (!b || !editando) return;
        var t = editando.t, id = b.getAttribute('data-id'), p = periodoSel, pausar = b.getAttribute('data-cuota') === 'pausar', est = $('pm-liq-editor-estado');
        var lista = (t.prestamos || []).map(function (x) {
            if (x.id !== id) return x;
            var pz = (x.pausas || []).filter(function (y) { return y !== p; });
            if (pausar) pz.push(p);
            return Object.assign({}, x, { pausas: pz });
        });
        b.disabled = true;
        guardarPrestamos(t, lista, est).then(function (ok) {
            if (!editando || periodoSel !== p) return;
            if (!ok) { b.disabled = false; return; }
            editando.mes.cuotasPrestamo = L.cuotasDelMes(editando.t, p);
            dibujarCuotasMes();
            vistaPrevia();
            mensaje(est, '', (pausar ? 'Postergamos la cuota al final del préstamo.' : 'La cuota vuelve a descontarse este mes.') + (editando.guardado ? ' Guarda el mes para que la liquidación quede con el cambio.' : ''));
        });
    });

    // Vacaciones registradas que tocan el mes (para la semana corrida no cuentan como días que debió trabajar)
    function vacacionesDelMes(id, periodo) {
        var ini = periodo + '-01', fin = periodo + '-31';
        return vacDe(id).filter(function (v) { return v.tipo === 'periodo' && v.desde && v.hasta && v.desde <= fin && v.hasta >= ini; });
    }
    // El mes con la semana corrida calculada (art. 45). Una liquidación emitida queda con el monto con que se emitió.
    function conSemanaCorrida(t, mes, periodo) {
        if (mes.emitida) return { mes: mes, sc: null };
        var sc = L.semanaCorridaMes(t, mes, periodo, { esFeriado: F.esFeriado, vacaciones: vacacionesDelMes(t.id, periodo) });
        return { mes: Object.assign({}, mes, { semanaCorrida: sc.monto, semanaCorridaDetalle: sc.detalle }), sc: sc };
    }

    // Calcula con el motor del generador de liquidaciones; devuelve { res, val, sc } o null si faltan los valores del mes
    function calcularMes(t, mes, periodo) {
        var val = VAL[periodo];
        if (!val) { cargarValores(periodo); return null; }
        if (val.estado !== 'ok') return null;
        var tasaMutual = estado && estado.empresa ? estado.empresa.tasaMutual : 0;
        var c = conSemanaCorrida(t, mes, periodo);
        try {
            var res = E.calcular({ trabajador: t, mes: c.mes, periodo: periodo, tasaMutual: tasaMutual }, val.mes);
            if (c.sc && c.sc.error) {
                res.avisos.push({ nivel: 'error', texto: 'No pudimos calcular la semana corrida: ' + c.sc.error });
                res.listo = false;
            }
            return { res: res, val: val, sc: c.sc };
        } catch (err) { return { error: err.message }; }
    }

    // --- licencias y permisos del mes (semana corrida) ---
    function pintarAusencias() {
        var p = periodoSel, ini = p + '-01', fin = p + '-' + dos(new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7), 0)).getUTCDate());
        $('pm-liq-aus').innerHTML = (editando.mes.ausencias || []).map(function (a) {
            return '<div class="lq-row lq-row-aus"><select aria-label="Tipo" data-aus="tipo"><option value="licencia"' + (a.tipo === 'permiso' ? '' : ' selected') + '>Licencia médica</option><option value="permiso"' + (a.tipo === 'permiso' ? ' selected' : '') + '>Permiso</option></select>' +
                '<label class="aus-fecha aus-desde">Desde<input type="date" data-aus="desde" min="' + ini + '" max="' + fin + '" value="' + esc(a.desde || '') + '"></label>' +
                '<label class="aus-fecha aus-hasta">Hasta<input type="date" data-aus="hasta" min="' + ini + '" max="' + fin + '" value="' + esc(a.hasta || '') + '"></label>' +
                '<button type="button" class="lq-x" aria-label="Quitar" data-aus-quitar><span class="material-icons" aria-hidden="true">close</span></button></div>';
        }).join('');
        $('pm-liq-aus-agregar').hidden = (editando.mes.ausencias || []).length >= 10;
    }
    // Solo se guardan las filas con las dos fechas y en orden; las incompletas quedan en pantalla hasta completarlas
    function leerAusencias() {
        var filas = $('pm-liq-aus').querySelectorAll('.lq-row-aus');
        editando.mes.ausencias = Array.prototype.map.call(filas, function (f) {
            return { tipo: f.querySelector('[data-aus="tipo"]').value, desde: f.querySelector('[data-aus="desde"]').value, hasta: f.querySelector('[data-aus="hasta"]').value };
        });
    }
    // Días corridos de licencia médica dentro del mes (sin repetir días si dos licencias se cruzan)
    function diasLicenciaEnMes(lista, periodo) {
        var dias = {};
        ausenciasValidas(lista).forEach(function (a) {
            if (a.tipo === 'permiso') return;
            for (var d = a.desde; d <= a.hasta; d = sumarDiasIso(d, 1)) if (d.slice(0, 7) === periodo) dias[d] = true;
        });
        return Math.min(30, Object.keys(dias).length);
    }
    function ausenciasValidas(lista) { return (lista || []).filter(function (a) { return a.desde && a.hasta && a.desde <= a.hasta; }); }
    $('pm-liq-aus').addEventListener('input', function () { if (!editando) return; leerAusencias(); vistaPrevia(); });
    $('pm-liq-aus').addEventListener('click', function (e) {
        var b = e.target.closest('[data-aus-quitar]');
        if (!b || !editando) return;
        var fila = b.closest('.lq-row-aus');
        editando.mes.ausencias.splice(Array.prototype.indexOf.call($('pm-liq-aus').children, fila), 1);
        pintarAusencias();
        vistaPrevia();
    });
    $('pm-liq-aus-agregar').addEventListener('click', function () {
        if (!editando) return;
        editando.mes.ausencias = (editando.mes.ausencias || []).concat([{ tipo: 'licencia', desde: '', hasta: '' }]).slice(0, 10);
        pintarAusencias();
        var ult = $('pm-liq-aus').querySelector('.lq-row-aus:last-child select');
        if (ult) ult.focus();
    });

    // Resumen de la semana corrida bajo sus campos: de dónde sale el monto
    function dibujarSemanaCorrida(sc, m) {
        var caja = $('pm-liq-sc');
        if (m && m.emitida) {
            caja.innerHTML = '<p>La liquidación está emitida: la semana corrida queda como se emitió' + (m.semanaCorrida ? ', <strong>' + pesos(m.semanaCorrida) + '</strong>' + (m.semanaCorridaDetalle ? ' (' + esc(m.semanaCorridaDetalle) + ')' : '') : ' (sin semana corrida)') + '. Quita la marca de emitida para recalcularla.</p>';
            return;
        }
        if (!sc || !sc.aplica) { caja.innerHTML = ''; return; }
        if (sc.error) { caja.innerHTML = '<p>' + esc('No pudimos calcularla: ' + sc.error) + '</p>'; return; }
        var r = sc.calculo, html = '';
        if (r.divisor > 0) {
            html += '<p>Semana corrida: <strong>' + pesos(r.monto) + '</strong></p>' +
                '<p class="sc-nota">' + pesos(r.variable) + ' de comisiones y tratos ÷ ' + plural(r.divisor, 'día', 'días') + ' que debió trabajar = <span class="mono">' + pesos(r.promedioDiario) + '</span> por día, × ' + plural(r.multiplicador, 'domingo o festivo', 'domingos y festivos') + '.</p>';
        } else {
            html += '<p>No corresponde semana corrida este mes: no hubo días que debiera trabajar (licencia, permiso o vacaciones todo el período).</p>';
        }
        var fuera = [];
        if (r.habilesAusencia) fuera.push(plural(r.habilesAusencia, 'día hábil', 'días hábiles'));
        if (r.descansoAusencia) fuera.push(plural(r.descansoAusencia, 'domingo o festivo', 'domingos o festivos'));
        if (fuera.length) html += '<p class="sc-nota">No se contaron ' + fuera.join(' ni ') + ' de licencias, permisos o vacaciones.</p>';
        if (r.festivosSabado.length) html += '<p class="sc-nota">El festivo del ' + r.festivosSabado.map(fechaCorta).join(' y del ') + ' cae en sábado, fuera de una jornada de lunes a viernes: no se paga como semana corrida.</p>';
        html += '<p class="sc-nota">Se usa el promedio del mes, como lo hacen los software de remuneraciones. La Dirección del Trabajo la calcula semana a semana (Ord. 833 de 2024): si las comisiones cambian mucho entre semanas, revisa el cálculo semanal con tu contador.</p>';
        caja.innerHTML = html;
    }

    function vistaPrevia() {
        if (!editando || !estado || !estado.empresa) return;
        var doc = $('pm-liq-doc'), avisos = $('pm-liq-avisos'), m = editando.mes, val = VAL[periodoSel];
        var r = calcularMes(editando.t, m, periodoSel);
        // La semana corrida no depende de la UF ni la UTM: se muestra aunque esos valores aún se estén consultando
        dibujarSemanaCorrida(r && !r.error ? r.sc : conSemanaCorrida(editando.t, m, periodoSel).sc, m);
        if (!r || r.error) {
            doc.innerHTML = '<p class="' + (r && r.error ? 'lqd-error' : 'lqd-cargando') + '">' + esc(r && r.error ? r.error : val && val.estado === 'error' ? (val.mensaje || 'No se pudieron obtener los valores del mes.') : 'Consultando la UF y la UTM de ' + nombrePeriodo(periodoSel) + '…') + '</p>';
            doc.classList.remove('lqd-pagada');
            avisos.innerHTML = '';
            $('pm-liq-imprimir').disabled = true;
            return;
        }
        var pagada = tienePase();
        doc.innerHTML = DOC.documento(estado.empresa, editando.t, m, r.res, { periodo: periodoSel, pagada: pagada, fuentes: r.val.fuentes });
        doc.classList.toggle('lqd-pagada', pagada);
        var lista = [];
        if (editando.nota) lista.push({ nivel: 'aviso', texto: editando.nota });
        var diasLic = diasLicenciaEnMes(m.ausencias, periodoSel), diasBaseMes = L.diasBase(editando.t, periodoSel);
        if (diasLic && !m.emitida && m.diasTrabajados > Math.max(0, diasBaseMes - diasLic)) lista.push({ nivel: 'aviso', texto: 'Anotaste ' + plural(diasLic, 'día', 'días') + ' de licencia médica: el empleador no paga esos días (los cubre el subsidio de la Compin, la Isapre o la caja). Revisa «Días trabajados» (hoy dice ' + m.diasTrabajados + ').' });
        if (m.gratificacion === 'manual' && !m.gratificacionMonto) lista.push({ nivel: 'aviso', texto: 'La gratificación es de monto fijo pactado: indica el monto, o cambia a «Legal mensual» o «No se paga este mes».' });
        r.res.avisos.forEach(function (a) { lista.push(a); });
        if (r.res.empleador) r.res.empleador.avisos.forEach(function (a) { lista.push(a); });
        dibujarCosto(r.res);
        avisos.innerHTML = lista.map(function (a) {
            var icono = a.nivel === 'error' ? 'error' : a.nivel === 'aviso' ? 'warning' : 'info';
            return '<div class="lq-aviso lq-aviso-' + a.nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(a.texto) + '</p></div>';
        }).join('');
        $('pm-liq-imprimir').disabled = !r.res.listo;
    }

    // Costo del trabajador para la empresa: lo bruto más las cotizaciones de cargo del empleador
    function dibujarCosto(res) {
        var caja = $('pm-liq-costo'), e = res && res.empleador;
        caja.hidden = !e;
        if (!e) return;
        $('pm-liq-costo-cuerpo').innerHTML = '<dl class="detalle-dl costo-dl">' +
            '<div><dt>Total de haberes<small>Lo que gana el trabajador antes de descuentos</small></dt><dd class="mono">' + pesos(res.totalHaberes) + '</dd></div>' +
            e.lineas.map(function (l) { return '<div><dt>' + esc(l.concepto) + '<small>' + esc(l.detalle) + '</small></dt><dd class="mono">' + pesos(l.monto) + '</dd></div>'; }).join('') +
            '<div class="costo-total"><dt>Costo total del mes</dt><dd class="mono">' + pesos(e.costoTotal) + '</dd></div></dl>' +
            '<p class="texto-ayuda">Las cotizaciones del empleador no se descuentan al trabajador ni aparecen en su liquidación. Es una estimación con las tasas de Previred del mes: el monto exacto lo calcula Previred al declarar.</p>';
    }

    $('pm-liq-form').addEventListener('input', function (e) {
        if (!editando) return;
        var el = e.target;
        if (el.hasAttribute('data-campo')) { var c = el.closest('[data-lista]'); editando.mes[c.getAttribute('data-lista')] = leerLista(c); }
        else if (el.hasAttribute('data-k')) leerMesForm();
        else return;
        visibilidadMes();
        vistaPrevia();
    });
    $('pm-liq-form').addEventListener('change', function (e) {
        var el = e.target;
        if (el.getAttribute('data-campo') === 'monto') { var v = parseInt(el.value.replace(/\D/g, ''), 10) || 0; el.value = v ? pesos(v) : ''; }
    });
    $('pm-liq-form').addEventListener('click', function (e) {
        if (!editando) return;
        var add = e.target.closest('[data-agregar]');
        if (add) {
            var path = add.getAttribute('data-agregar');
            editando.mes[path] = (editando.mes[path] || []).concat([{ nombre: '', monto: 0 }]).slice(0, 8);
            pintarListas();
            var ult = $('pm-liq-form').querySelector('[data-lista="' + path + '"] .lq-row:last-child input');
            if (ult) ult.focus();
            return;
        }
        var quitar = e.target.closest('[data-quitar]');
        if (quitar) {
            var fila = quitar.closest('.lq-row'), cont = fila.parentNode, p = cont.getAttribute('data-lista');
            editando.mes[p].splice(Array.prototype.indexOf.call(cont.children, fila), 1);
            pintarListas();
            vistaPrevia();
        }
    });
    $('pm-liq-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $('pm-liq-cerrar').addEventListener('click', function () { cerrarMes(); navegar('liquidaciones', { reemplazar: true, sinScroll: true }); });

    // Guarda un mes (con el resultado calculado si hay valores del mes) y actualiza la memoria local
    function guardarRegistro(id, mes) {
        var t = trabajadorPorId(id), periodo = periodoSel, previo = mesesDe(periodo)[id];
        // Las cuotas se toman de la ficha, salvo al editar una liquidación que ya estaba emitida (quedan las emitidas)
        if (t && !(previo && previo.emitida && mes.emitida)) mes = Object.assign({}, mes, { cuotasPrestamo: L.cuotasDelMes(t, periodo) });
        mes = Object.assign({}, mes, { ausencias: ausenciasValidas(mes.ausencias) });
        if (t) mes = conSemanaCorrida(t, mes, periodo).mes;
        var c = t ? calcularMes(t, mes, periodo) : null;
        var cuerpo = Object.assign({}, mes, { calculo: c && c.res ? (c.res.listo ? L.resumen(c.res, c.val.mes, t) : null) : (mes.calculo || null) });
        return api('mes', { metodo: 'PUT', query: { trabajador: id, periodo: periodo }, cuerpo: { mes: cuerpo } }).then(function (r) {
            if (r.ok) { mesesCache[periodo] = mesesCache[periodo] || {}; mesesCache[periodo][id] = r.datos.mes; }
            return r;
        });
    }

    $('pm-liq-guardar').addEventListener('click', function () {
        if (!editando) return;
        var id = editando.id, est = $('pm-liq-editor-estado');
        mensaje(est, '', 'Guardando…');
        guardarRegistro(id, editando.mes).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { mensaje(est, 'error', (r.datos.errores ? Object.keys(r.datos.errores).map(function (k) { return r.datos.errores[k]; }).join(' ') : r.datos.error) || 'No pudimos guardar.'); return; }
            editando.mes = JSON.parse(JSON.stringify(r.datos.mes));
            editando.guardado = true;
            dibujarCuotasMes();
            $('pm-liq-quitar').hidden = false;
            mensaje(est, 'ok', 'Guardado.');
            dibujarLiquidaciones();
            dibujarPendientes();
        });
    });
    $('pm-liq-quitar').addEventListener('click', function () {
        if (!editando) return;
        var id = editando.id, periodo = periodoSel;
        confirmar('¿Quitar la liquidación de ' + nombrePeriodo(periodo) + ' de ' + editando.t.nombre + '?', 'Se borran los datos guardados de ese mes. No se puede deshacer.', 'Quitar liquidación').then(function (si) {
            if (!si) return;
            api('mes', { metodo: 'DELETE', query: { trabajador: id, periodo: periodo } }).then(function (r) {
                if (sinSesion(r)) return;
                if (!r.ok) { mensaje($('pm-liq-editor-estado'), 'error', r.datos.error || 'No pudimos quitarla.'); return; }
                if (mesesCache[periodo]) delete mesesCache[periodo][id];
                cerrarMes();
                navegar('liquidaciones', { reemplazar: true, sinScroll: true });
                dibujarPendientes();
                mensaje($('pm-liq-estado'), 'ok', 'Quitamos esa liquidación.');
            });
        });
    });

    // --- lista del mes ---
    $('pm-liq-lista').addEventListener('click', function (e) {
        var b = e.target.closest('[data-liq]');
        if (!b) return;
        var id = b.getAttribute('data-id'), accion = b.getAttribute('data-liq');
        if (accion === 'editar') return navegar('liquidaciones/' + id, { sinScroll: true });
        if (accion === 'imprimir') return imprimirMeses([id], $('pm-liq-estado'));
        if (!mesesDe(periodoSel)[id]) return;
        marcarEmitidas([id], accion === 'marcar' ? hoyIso() : '', $('pm-liq-estado'));
    });

    function prepararMes(est) {
        var pendientes = activos().filter(function (t) { return !mesesDe(periodoSel)[t.id] && L.diasBase(t, periodoSel) > 0; });
        if (!pendientes.length) return;
        if (!VAL[periodoSel] || VAL[periodoSel].estado === 'cargando') { mensaje(est, 'error', 'Espera a que terminemos de consultar la UF y la UTM del mes.'); return; }
        mensaje(est, '', 'Preparando ' + plural(pendientes.length, 'liquidación', 'liquidaciones') + '…');
        var hechas = 0, fallo = null;
        pendientes.reduce(function (p, t) {
            return p.then(function () {
                if (fallo) return;
                return guardarRegistro(t.id, L.mesBase(t, periodoSel)).then(function (r) { if (r.ok) hechas++; else fallo = r; });
            });
        }, Promise.resolve()).then(function () {
            if (fallo && sinSesion(fallo)) return;
            dibujarLiquidaciones();
            dibujarPendientes();
            if (fallo) mensaje(est, 'error', 'Preparamos ' + hechas + ' y paramos: ' + (fallo.datos.error || 'no pudimos guardar.'));
            else mensaje(est, 'ok', 'Preparamos ' + plural(hechas, 'liquidación', 'liquidaciones') + ' con los valores base (días según el ingreso, gratificación según la ficha, sin horas extra ni descuentos). Ábrelas para agregar lo del mes antes de imprimir.');
        });
    }
    $('pm-liq-preparar').addEventListener('click', function () { prepararMes($('pm-liq-estado')); });

    function marcarEmitidas(ids, fecha, est) {
        var hechas = 0, fallo = null;
        mensaje(est, '', 'Guardando…');
        ids.reduce(function (p, id) {
            return p.then(function () {
                var reg = mesesDe(periodoSel)[id];
                if (fallo || !reg) return;
                return guardarRegistro(id, Object.assign({}, reg, { emitida: fecha })).then(function (r) { if (r.ok) hechas++; else fallo = r; });
            });
        }, Promise.resolve()).then(function () {
            if (fallo && sinSesion(fallo)) return;
            if (!fecha) ultimasImpresas = []; else ultimasImpresas = ultimasImpresas.filter(function (x) { return ids.indexOf(x) < 0; });
            dibujarLiquidaciones();
            dibujarPendientes();
            mensaje(est, fallo ? 'error' : 'ok', fallo ? (fallo.datos.error || 'No pudimos guardar.') : (fecha ? 'Marcamos ' + plural(hechas, 'liquidación', 'liquidaciones') + ' como emitida' + (hechas === 1 ? '.' : 's.') : 'Quitamos la marca de emitida.'));
        });
    }
    $('pm-liq-marcar').addEventListener('click', function () { marcarEmitidas(ultimasImpresas.slice(), hoyIso(), $('pm-liq-estado')); });

    // --- impresión ---
    function imprimirHojas(htmls, titulo) {
        var cont = $('print-section'), pagada = tienePase();
        cont.innerHTML = htmls.map(function (h) { return '<section class="pm-hoja"><article class="lq-doc' + (pagada ? ' lqd-pagada' : '') + '">' + h + '</article></section>'; }).join('');
        var anterior = document.title;
        document.title = titulo;
        var restaurar = function () { document.title = anterior; window.removeEventListener('afterprint', restaurar); };
        window.addEventListener('afterprint', restaurar);
        window.print();
        setTimeout(restaurar, 2000);
    }
    // Imprime los meses guardados de esos trabajadores (en el orden de la ficha); avisa los que no se pudieron calcular
    function imprimirMeses(ids, est) {
        var val = VAL[periodoSel];
        if (!val || val.estado !== 'ok') { mensaje(est, 'error', val && val.estado === 'error' ? (val.mensaje || 'No se pudieron obtener los valores del mes.') : 'Espera a que terminemos de consultar la UF y la UTM del mes.'); return; }
        var hojas = [], impresas = [], omitidas = [];
        activos().forEach(function (t) {
            var reg = mesesDe(periodoSel)[t.id];
            if (ids.indexOf(t.id) < 0 || !reg) return;
            reg = conCuotas(t, reg, periodoSel);
            var r = calcularMes(t, reg, periodoSel);
            if (!r || r.error || !r.res.listo) { omitidas.push(t.nombre); return; }
            hojas.push(DOC.documento(estado.empresa, t, reg, r.res, { periodo: periodoSel, pagada: tienePase(), fuentes: r.val.fuentes }));
            impresas.push(t.id);
        });
        if (!hojas.length) { mensaje(est, 'error', omitidas.length ? 'Revisa los datos de ' + omitidas.join(', ') + ': la liquidación tiene errores y no se puede imprimir.' : 'No hay liquidaciones preparadas para imprimir.'); return; }
        ultimasImpresas = impresas.filter(function (id) { var reg = mesesDe(periodoSel)[id]; return reg && !reg.emitida; });
        dibujarLiquidaciones();
        mensaje(est, omitidas.length ? 'error' : '', omitidas.length ? 'No se imprimieron las de ' + omitidas.join(', ') + ' porque tienen errores: ábrelas y corrígelas.' : '');
        imprimirHojas(hojas, impresas.length === 1 ? 'Liquidacion ' + trabajadorPorId(impresas[0]).nombre + ' ' + periodoSel : 'Liquidaciones ' + periodoSel);
    }
    $('pm-liq-imprimir-todas').addEventListener('click', function () { imprimirMeses(activos().map(function (t) { return t.id; }), $('pm-liq-estado')); });
    $('pm-liq-imprimir').addEventListener('click', function () {
        if (!editando || $('pm-liq-imprimir').disabled) return;
        var r = calcularMes(editando.t, editando.mes, periodoSel);
        if (!r || r.error || !r.res.listo) return;
        imprimirHojas([DOC.documento(estado.empresa, editando.t, editando.mes, r.res, { periodo: periodoSel, pagada: tienePase(), fuentes: r.val.fuentes })], 'Liquidacion ' + editando.t.nombre + ' ' + periodoSel);
    });

    // ---------- mis datos ----------
    function exportar() {
        var est = $('pm-exportar-estado');
        mensaje(est, '', 'Preparando…');
        return fetch('/api/pyme/exportar', { credentials: 'same-origin' }).then(function (r) {
            if (r.status === 401) { mostrar('entrada', 'Tu sesión venció. Entra de nuevo con tu correo.'); return null; }
            if (!r.ok) throw new Error('http');
            return r.blob();
        }).then(function (blob) {
            if (!blob) return;
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'calculolaboral-datos-' + hoyIso() + '.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
            guardar(KEY_RESPALDO, new Date().toISOString());
            mensaje(est, 'ok', 'Archivo descargado.');
            avisoGlobal('ok', 'Descargamos el respaldo con todos tus datos.');
            dibujarPendientes();
        }).catch(function () { mensaje(est, 'error', 'No pudimos preparar el archivo. Intenta de nuevo.'); avisoGlobal('error', 'No pudimos preparar el respaldo. Intenta de nuevo.'); });
    }
    $('pm-exportar').addEventListener('click', exportar);

    $('pm-borrar-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var err = $('pm-borrar-error'), correo = $('pm-borrar-email').value.trim();
        err.hidden = true;
        if (correo.toLowerCase() !== estado.cuenta.email) { err.textContent = 'Escribe tu correo exactamente como aparece arriba.'; err.hidden = false; return; }
        api('borrar-cuenta', { metodo: 'POST', cuerpo: { confirmar: correo } }).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { err.textContent = r.datos.error || 'No pudimos eliminar la cuenta.'; err.hidden = false; return; }
            reiniciar();
            $('pm-borrar-email').value = '';
            mostrar('entrada', 'Tu cuenta y todos sus datos fueron eliminados.');
        });
    });

    // ---------- inicio ----------
    $('pm-t-afp').innerHTML = AFPS.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
    aplicarMascaras($('pm-emp-form'));
    aplicarMascaras($('pm-trab-form'));
    aplicarMascaras($('pm-prest-form'));
    function arrancar() {
        api('sesion').then(function (r) {
            if (r.estado === 0 || r.estado >= 500) { mostrar('fallo'); return; }
            if (r.datos && r.datos.autenticado) cargar(); else mostrar('entrada');
        });
    }
    mostrar('cargando');
    arrancar();
})();
