/*
 * CalculoLaboral · interfaz del Asistente Laboral Pyme (v1.3.0)
 * Entrar con enlace al correo, ficha de empresa y trabajadores (guardada cifrada en el servidor), pendientes del mes,
 * liquidaciones de sueldo guardadas por mes (vista previa, imprimir todas), documentos laborales (certificados, cartas, anexos),
 * enlaces a los generadores con los datos cargados, Pase Pyme (compra con Flow, vigencia y desbloqueo de generadores),
 * traer datos del generador, descargar y eliminar los datos.
 * Requiere: rut_cl.js, liquidacion_parametros.js, liquidacion_valores.js, liquidacion_engine.js, liquidacion_documento.js, feriados_cl.js,
 * pyme_pendientes.js, pyme_liquidaciones.js y pyme_docs.js (antes que este archivo).
 * La API es /api/pyme/* (api/_pyme/rutas.js). Todo texto de usuario se escapa antes de mostrarse.
 */
(function () {
    'use strict';

    var Rut = window.CLRut, P = window.CLLiquidacionParametros, F = window.CLFeriados, PEND = window.CLPymePendientes;
    var L = window.CLPymeLiquidaciones, E = window.CLLiquidacionEngine, VL = window.CLLiquidacionValores, DOC = window.CLLiquidacionDocumento, PD = window.CLPymeDocs;
    if (!Rut || !P || !F || !PEND || !L || !E || !VL || !DOC || !PD || !document.getElementById('pm-panel')) return;

    var KEY_RESPALDO = 'cl_pyme_respaldo';
    var KEY_GENERADOR = 'cl_liq_v1';
    var KEY_IMPORTADO = 'cl_pyme_importado';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var AFPS = Object.keys(P.VIGENCIAS[P.VIGENCIAS.length - 1].afp).sort();

    var estado = null;      // lo último que dijo el servidor
    var volvioDePago = false; // el aviso de ?pase= se atiende una sola vez
    var editandoId = null;  // id del trabajador que se edita (null = nuevo)
    var logoActual = '';    // data URL del logo en el formulario de la empresa

    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function pesos(n) { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
    function fechaLarga(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1] + ' de ' + a[0]; }
    // Fecha de un instante (vencimiento del pase) en hora de Chile, para que de noche no se corra un día
    function fechaVence(iso) {
        try { return fechaLarga(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))); } catch (e) { return fechaLarga(iso); }
    }
    function guardado(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

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

    // Confirmación o error visible arriba del panel
    function avisoGlobal(tipo, texto) {
        var icono = { ok: 'check_circle', info: 'info', error: 'error' }[tipo];
        $('pm-aviso-global').innerHTML = texto ? '<div class="lq-aviso lq-aviso-' + (tipo === 'error' ? 'error' : 'info') + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + '</p></div>' : '';
    }

    // Sesión vencida en cualquier llamada: vuelve a la entrada con un aviso
    function sinSesion(r) {
        if (r.estado === 401) { mostrar('entrada', 'Tu sesión venció. Entra de nuevo con tu correo.'); return true; }
        return false;
    }

    // ---------- vistas ----------
    function mostrar(vista, nota) {
        $('pm-cargando').hidden = vista !== 'cargando';
        $('pm-entrada').hidden = vista !== 'entrada';
        $('pm-panel').hidden = vista !== 'panel';
        if (vista === 'entrada') {
            $('pm-entrar-form').hidden = false;
            $('pm-entrar-listo').hidden = true;
            $('pm-entrar-error').hidden = true;
            var n = $('pm-entrada-nota');
            n.hidden = !nota;
            if (nota) n.querySelector('p').textContent = nota;
        }
    }

    function mensaje(el, tipo, texto) {
        el.className = 'lq-estado pm-estado' + (tipo === 'ok' ? ' lq-estado-ok' : tipo === 'error' ? ' lq-estado-error' : '');
        el.textContent = texto || '';
    }

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
    $('pm-salir').addEventListener('click', function () {
        api('salir', { metodo: 'POST' }).then(function () { reiniciar(); mostrar('entrada'); });
    });

    // Olvida todo lo que se cargó de la cuenta (al salir o al eliminarla)
    function reiniciar() {
        estado = null; mesesCache = {}; editando = null; periodoSel = null; ultimasImpresas = [];
        docSel = { trabajadorId: null, tipo: null, datos: {}, intento: false, listo: false };
        $('print-section').innerHTML = '';
        $('pm-liq-editor').hidden = true;
    }

    // ---------- carga del estado ----------
    function cargar() {
        return api('estado').then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { mostrar('entrada', r.datos.error || 'No pudimos cargar tus datos.'); return; }
            estado = r.datos;
            mesesCache = {};
            dibujar();
            mostrar('panel');
            cargarLiquidaciones();
            if (!volvioDePago) { volvioDePago = true; volverDePago(); }
        });
    }

    function dibujar() {
        $('pm-correo').textContent = estado.cuenta.email;
        dibujarEmpresa();
        dibujarTrabajadores();
        dibujarPendientes();
        dibujarImportar();
        dibujarDocumentos();
        dibujarPase();
        dibujarNotaGeneradores();
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
        var img = $('pm-logo-prev');
        img.hidden = !logoActual;
        if (logoActual) img.src = logoActual; else img.removeAttribute('src');
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
            if (r.ok) { cargar().then(function () { mensaje(est, 'ok', 'Guardado.'); }); return; }
            mostrarErrores(f, r.datos.errores);
            mensaje(est, 'error', r.datos.error || 'No pudimos guardar.');
        });
    });

    // ---------- trabajadores ----------
    function resumenTrabajador(t) {
        var partes = [];
        if (t.cargo) partes.push(esc(t.cargo));
        partes.push('<span class="pm-mono">' + esc(t.rut) + '</span>');
        if (t.sueldoBase) partes.push('sueldo base <span class="pm-mono">' + pesos(t.sueldoBase) + '</span>');
        partes.push(esc(t.jornadaHoras) + ' h semanales');
        partes.push(t.contrato === 'plazo_fijo' ? 'plazo fijo' : t.contrato === 'obra' ? 'por obra' : 'indefinido');
        return partes.join(' · ');
    }

    function dibujarTrabajadores() {
        var lista = estado.trabajadores || [], activos = lista.filter(function (t) { return t.activo; }).length, lim = estado.limites;
        $('pm-trab-lista').innerHTML = lista.map(function (t) {
            return '<li class="pm-trab"><div class="pm-trab-datos"><span class="pm-trab-nombre">' + esc(t.nombre) +
                (t.activo ? '' : '<span class="pm-insignia">Inactivo</span>') + '</span><span class="pm-trab-meta">' + resumenTrabajador(t) + '</span></div>' +
                '<div class="pm-trab-acciones"><button type="button" class="lq-btn-sec" data-accion="editar" data-id="' + esc(t.id) + '"><span class="material-icons" aria-hidden="true">edit</span>Editar</button>' +
                '<button type="button" class="lq-link pm-danger" data-accion="borrar" data-id="' + esc(t.id) + '">Eliminar</button></div></li>';
        }).join('');
        var txt = 'Trabajadores activos: ' + activos + ' de ' + lim.maxActivos + '. ';
        txt += lim.paseVence ? 'Tu pase vence el ' + fechaVence(lim.paseVence) + '.' : 'Sin pase puedes tener 1 trabajador activo; con el Pase Pyme son hasta 5. ' + textoPaseVenta();
        $('pm-trab-limite').textContent = txt;
        $('pm-trab-nuevo').disabled = !estado.empresa;
        $('pm-trab-nuevo').title = estado.empresa ? '' : 'Primero guarda los datos de la empresa';
    }

    function abrirTrabajador(t) {
        var f = $('pm-trab-form');
        editandoId = t ? t.id : null;
        limpiarErrores(f);
        $('pm-trab-error').hidden = true;
        mensaje($('pm-trab-estado'), '', '');
        var base = { contrato: 'indefinido', jornadaHoras: 42, distribucion: '5', gratificacion: 'legal', afp: 'Modelo', salud: 'fonasa', renovaciones: 0, aniosOtrosEmpleadores: 0, activo: true };
        llenar(f, t || base);
        $('pm-trab-form-titulo').textContent = t ? 'Editar a ' + t.nombre : 'Nuevo trabajador';
        $('pm-t-activo-campo').hidden = !t;
        condicionales();
        f.hidden = false;
        f.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('pm-t-nombre').focus();
    }
    function cerrarTrabajador() { $('pm-trab-form').hidden = true; editandoId = null; }

    $('pm-trab-nuevo').addEventListener('click', function () { abrirTrabajador(null); });
    $('pm-trab-cancelar').addEventListener('click', cerrarTrabajador);
    $('pm-trab-form').addEventListener('change', function (e) { if (e.target.matches('[data-k="contrato"],[data-k="salud"]')) condicionales(); });

    $('pm-trab-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = $('pm-trab-form'), datos = recoger(f), err = $('pm-trab-error');
        limpiarErrores(f);
        err.hidden = true;
        mensaje($('pm-trab-estado'), '', 'Guardando…');
        var llamada = editandoId ? api('trabajador', { metodo: 'PUT', query: { id: editandoId }, cuerpo: { trabajador: datos } }) : api('trabajador', { metodo: 'POST', cuerpo: { trabajador: datos } });
        llamada.then(function (r) {
            if (sinSesion(r)) return;
            if (r.ok) { var nombre = r.datos.trabajador && r.datos.trabajador.nombre; cerrarTrabajador(); cargar().then(function () { avisoGlobal('ok', 'Guardamos los datos de ' + nombre + '.'); }); return; }
            mensaje($('pm-trab-estado'), '', '');
            mostrarErrores(f, r.datos.errores);
            err.textContent = r.datos.error || 'No pudimos guardar.';
            err.hidden = false;
        });
    });

    $('pm-trab-lista').addEventListener('click', function (e) {
        var b = e.target.closest('[data-accion]');
        if (!b) return;
        var id = b.getAttribute('data-id'), t = (estado.trabajadores || []).filter(function (x) { return x.id === id; })[0];
        if (!t) return;
        if (b.getAttribute('data-accion') === 'editar') return abrirTrabajador(t);
        if (!window.confirm('¿Eliminar a ' + t.nombre + '? Sus datos se borran de forma definitiva.')) return;
        api('trabajador', { metodo: 'DELETE', query: { id: id } }).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { avisoGlobal('error', r.datos.error || 'No pudimos eliminar.'); return; }
            cargar().then(function () { avisoGlobal('ok', 'Eliminamos a ' + t.nombre + '.'); });
        });
    });

    // ---------- pendientes ----------
    var ICONO = { urgente: 'error', aviso: 'warning', info: 'info' };
    function dibujarPendientes() {
        var toca = PEND.periodoLiquidacion(hoyIso()), liq = null;
        if (toca && mesesCache[toca.periodo]) {
            var mapa = mesesCache[toca.periodo];
            liq = { periodo: toca.periodo, registros: Object.keys(mapa).map(function (id) { return { trabajadorId: id, emitida: mapa[id].emitida || '' }; }) };
        }
        var lista = PEND.pendientes(estado, { hoy: hoyIso(), P: P, F: F, ultimoRespaldo: guardado(KEY_RESPALDO), liquidaciones: liq });
        $('pm-pend').innerHTML = lista.length ? lista.map(function (p, i) {
            var accion = '';
            if (p.accion) {
                var etiqueta = { empresa: 'Completar empresa', 'trabajador-nuevo': 'Agregar trabajador', trabajador: 'Editar ficha', respaldo: 'Descargar respaldo', liquidaciones: 'Ver liquidaciones' }[p.accion.tipo];
                accion = '<div class="pm-p-accion"><button type="button" class="lq-link" data-pend="' + i + '">' + esc(etiqueta) + '</button></div>';
            }
            return '<li class="pm-p-' + p.nivel + '"><span class="material-icons" aria-hidden="true">' + ICONO[p.nivel] + '</span><div class="pm-p-cuerpo"><strong>' + esc(p.titulo) + '</strong><p>' + esc(p.texto) + '</p>' + accion + '</div></li>';
        }).join('') : '<li class="pm-p-info"><span class="material-icons" aria-hidden="true">check_circle</span><div class="pm-p-cuerpo"><strong>No tienes pendientes por ahora.</strong></div></li>';
        $('pm-pend')._lista = lista;
    }
    $('pm-pend').addEventListener('click', function (e) {
        var b = e.target.closest('[data-pend]');
        if (!b) return;
        var p = $('pm-pend')._lista[+b.getAttribute('data-pend')], a = p && p.accion;
        if (!a) return;
        if (a.tipo === 'empresa') { $('pm-sec-empresa').scrollIntoView({ behavior: 'smooth' }); $('pm-e-razon').focus(); }
        else if (a.tipo === 'trabajador-nuevo') abrirTrabajador(null);
        else if (a.tipo === 'trabajador') abrirTrabajador((estado.trabajadores || []).filter(function (t) { return t.id === a.id; })[0]);
        else if (a.tipo === 'respaldo') exportar();
        else if (a.tipo === 'liquidaciones') {
            periodoSel = a.periodo; ultimasImpresas = []; cerrarMes();
            cargarLiquidaciones();
            $('pm-sec-liquidaciones').scrollIntoView({ behavior: 'smooth' });
        }
    });

    // ---------- documentos ----------
    var docSel = { trabajadorId: null, tipo: null, datos: {}, intento: false, listo: false };

    function ufHoy() { try { return typeof CONSTANTS !== 'undefined' && CONSTANTS.UF > 30000 ? CONSTANTS.UF : 0; } catch (e) { return 0; } }

    function ctxDoc() {
        var t = trabajadorPorId(docSel.trabajadorId);
        if (!t || !estado || !estado.empresa) return null;
        var meses = {};
        PD.periodosPromedio(hoyIso()).forEach(function (p) { var m = mesesCache[p] && mesesCache[p][t.id]; if (m) meses[p] = m; });
        return { empresa: estado.empresa, t: t, hoy: hoyIso(), meses: meses, uf: ufHoy(), F: F };
    }

    function dibujarDocumentos() {
        if (!estado) return;
        var lista = estado.trabajadores || [], hay = lista.length > 0 && !!estado.empresa;
        $('pm-doc-vacio').hidden = hay;
        $('pm-doc-vacio').textContent = !estado.empresa ? 'Primero guarda los datos de la empresa y agrega a un trabajador para preparar sus documentos.' : 'Agrega primero a un trabajador para preparar sus documentos.';
        $('pm-doc-selectores').hidden = !hay;
        $('pm-gen').hidden = !hay;
        if (!hay) { $('pm-doc-descripcion').textContent = ''; $('pm-doc-avisos').innerHTML = ''; $('pm-doc-form').hidden = true; $('pm-doc-marco').hidden = true; $('pm-doc-acciones').hidden = true; return; }
        var selT = $('pm-doc-trab'), selD = $('pm-doc-tipo');
        selT.innerHTML = lista.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.nombre) + (t.activo ? '' : ' (inactivo)') + '</option>'; }).join('');
        if (!selD.options.length) selD.innerHTML = PD.TIPOS.map(function (t) { return '<option value="' + t.id + '">' + esc(t.titulo) + '</option>'; }).join('');
        var cambio = !trabajadorPorId(docSel.trabajadorId) || !docSel.tipo;
        if (!trabajadorPorId(docSel.trabajadorId)) docSel.trabajadorId = lista[0].id;
        if (!docSel.tipo) docSel.tipo = PD.TIPOS[0].id;
        selT.value = docSel.trabajadorId;
        selD.value = docSel.tipo;
        $('pm-doc-nota-marca').textContent = tienePase()
            ? 'Con tu pase vigente los documentos salen sin marca de agua. Revisa cada documento antes de entregarlo.'
            : 'Sin Pase Pyme los documentos llevan la marca «Vista previa». ' + textoPaseVenta() + ' Revisa cada documento antes de entregarlo.';
        enlacesGeneradores();
        if (cambio) abrirDoc(); else vistaDoc();
    }

    function enlacesGeneradores() {
        var q = '?desde=pyme&t=' + encodeURIComponent(docSel.trabajadorId || '');
        $('pm-gen-contrato').href = 'generador-contrato-trabajo-chile' + q;
        $('pm-gen-anexo42').href = 'generador-anexo-40-horas' + q;
        $('pm-gen-finiquito').href = 'generador-finiquito-chile' + q;
    }

    // Cambia de persona o de documento: carga lo que haga falta y propone los valores iniciales
    function abrirDoc() {
        var tipo = docSel.tipo, id = docSel.trabajadorId;
        docSel.intento = false;
        var info = PD.TIPOS.filter(function (x) { return x.id === tipo; })[0];
        $('pm-doc-descripcion').textContent = info ? info.descripcion : '';
        var faltan = (tipo === 'cert_remuneraciones' || tipo === 'carta_161') ? PD.periodosPromedio(hoyIso()).filter(function (p) { return !mesesCache[p]; }) : [];
        Promise.all(faltan.map(cargarMeses)).then(function () {
            if (!estado || docSel.tipo !== tipo || docSel.trabajadorId !== id) return;
            var c = ctxDoc();
            if (!c) return;
            docSel.datos = PD.valoresIniciales(tipo, c);
            dibujarFormDoc();
            vistaDoc();
        });
    }

    function dibujarFormDoc() {
        var form = $('pm-doc-form'), campos = PD.campos(docSel.tipo);
        form.hidden = false;
        form.innerHTML = campos.map(function (c) {
            var id = 'pm-d-' + c.k, v = docSel.datos[c.k], ayuda = c.ayuda ? '<p class="lq-help">' + esc(c.ayuda) + '</p>' : '', err = '<p class="pm-error" data-derror="' + c.k + '" hidden></p>';
            var opc = c.req || c.tipo === 'check' ? '' : ' <span class="lq-opt">(opcional)</span>';
            if (c.tipo === 'check') return '<div class="lq-field pm-check lq-span2"><label><input type="checkbox" id="' + id + '" data-dk="' + c.k + '"' + (v === true ? ' checked' : '') + '> <span>' + esc(c.etiqueta) + '</span></label>' + ayuda + err + '</div>';
            var ctrl;
            if (c.tipo === 'select') ctrl = '<select id="' + id + '" data-dk="' + c.k + '">' + c.opciones.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
            else if (c.tipo === 'textarea') ctrl = '<textarea id="' + id + '" data-dk="' + c.k + '" rows="5" maxlength="' + c.max + '">' + esc(v) + '</textarea>';
            else if (c.tipo === 'fecha') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" type="date" value="' + esc(v) + '">';
            else if (c.tipo === 'pesos') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" data-tipo="pesos" type="text" inputmode="numeric" value="' + (v > 0 ? esc(pesos(v)) : '') + '" placeholder="$0">';
            else if (c.tipo === 'numero') ctrl = '<input id="' + id + '" data-dk="' + c.k + '" data-tipo="num" type="text" inputmode="numeric" maxlength="3" value="' + esc(v) + '">';
            else ctrl = '<input id="' + id + '" data-dk="' + c.k + '" type="text" maxlength="' + (c.max || 100) + '" value="' + esc(v) + '">';
            var ancho = c.tipo === 'textarea' ? ' lq-span2' : '';
            return '<div class="lq-field' + ancho + '"><label for="' + id + '">' + esc(c.etiqueta) + opc + '</label>' + ctrl + ayuda + err + '</div>';
        }).join('');
    }

    function valorCampoDoc(el) {
        if (el.type === 'checkbox') return el.checked;
        var tipo = el.getAttribute('data-tipo'), v = el.value;
        if (tipo === 'pesos') return parseInt(v.replace(/\D/g, ''), 10) || 0;
        if (tipo === 'num') return v.replace(/\D/g, '');
        return v;
    }
    $('pm-doc-form').addEventListener('input', function (e) {
        if (!e.target.hasAttribute('data-dk')) return;
        docSel.datos[e.target.getAttribute('data-dk')] = valorCampoDoc(e.target);
        vistaDoc();
    });
    $('pm-doc-form').addEventListener('change', function (e) {
        var el = e.target;
        if (!el.hasAttribute('data-dk')) return;
        docSel.datos[el.getAttribute('data-dk')] = valorCampoDoc(el);
        if (el.getAttribute('data-tipo') === 'pesos') el.value = docSel.datos[el.getAttribute('data-dk')] > 0 ? pesos(docSel.datos[el.getAttribute('data-dk')]) : '';
        vistaDoc();
    });

    function vistaDoc() {
        var c = ctxDoc();
        if (!c || !docSel.tipo) return;
        var v = PD.validar(docSel.tipo, c, docSel.datos);
        docSel.listo = v.puedeEmitir;
        // Los errores de campos vacíos solo se muestran después de intentar imprimir; los demás, apenas hay un valor
        Array.prototype.forEach.call($('pm-doc-form').querySelectorAll('[data-derror]'), function (p) {
            var k = p.getAttribute('data-derror'), msg = v.errores[k], valor = docSel.datos[k];
            var mostrar = !!msg && (docSel.intento || (valor !== '' && valor !== undefined && valor !== false && valor !== 0));
            p.textContent = mostrar ? msg : '';
            p.hidden = !mostrar;
            var campo = $('pm-d-' + k);
            if (campo) { if (mostrar) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid'); }
        });
        var html = '';
        function aviso(nivel, icono, texto, extra) { html += '<div class="lq-aviso lq-aviso-' + nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + (extra || '') + '</p></div>'; }
        if (v.faltaFicha.length) {
            var conT = v.faltaFicha.filter(function (x) { return x.de === 't'; }), conE = v.faltaFicha.filter(function (x) { return x.de === 'e'; });
            var texto = 'Falta en la ficha: ' + v.faltaFicha.map(function (x) { return x.etiqueta; }).join(', ') + '. ';
            var botones = (conT.length ? ' <button type="button" class="lq-link" data-doc-ficha="t">Editar ficha del trabajador</button>' : '') + (conE.length ? ' <button type="button" class="lq-link" data-doc-ficha="e">Completar empresa</button>' : '');
            aviso('aviso', 'edit_note', texto, botones);
        }
        v.bloqueos.forEach(function (t) { aviso('error', 'error', t); });
        v.avisos.forEach(function (a) { aviso(a.nivel, a.nivel === 'aviso' ? 'warning' : 'info', a.texto); });
        $('pm-doc-avisos').innerHTML = html;

        var marco = $('pm-doc-marco'), doc = $('pm-doc-doc');
        $('pm-doc-acciones').hidden = false;
        if (v.puedeEmitir) {
            var pagada = tienePase();
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
        if (b.getAttribute('data-doc-ficha') === 'e') { $('pm-sec-empresa').scrollIntoView({ behavior: 'smooth' }); $('pm-e-razon').focus(); }
        else abrirTrabajador(trabajadorPorId(docSel.trabajadorId));
    });
    $('pm-doc-trab').addEventListener('change', function (e) { docSel.trabajadorId = e.target.value; enlacesGeneradores(); abrirDoc(); });
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
        try { d = PD.generar(docSel.tipo, c, docSel.datos, { pagada: tienePase() }); } catch (err) { mensaje($('pm-doc-estado'), 'error', err.message); return; }
        var id = docSel.trabajadorId, tipo = docSel.tipo;
        imprimirHojas([d.html], d.titulo + ' ' + c.t.nombre);
        api('documento', { metodo: 'POST', query: { trabajador: id }, cuerpo: { tipo: tipo } }).then(function (r) {
            if (sinSesion(r)) return;
            mensaje($('pm-doc-estado'), r.ok ? 'ok' : 'error', r.ok ? 'Enviado a imprimir. Anotamos que lo emitiste (solo el tipo de documento y la fecha, nunca su texto).' : 'Se envió a imprimir, pero no pudimos anotar la emisión: ' + (r.datos.error || 'intenta de nuevo.'));
        });
    });

    // ---------- Pase Pyme ----------
    var KEY_COMPRA_GA = 'cl_pyme_compra_ga';
    var NOMBRE_PASE = { pyme3: '3 meses', pyme12: '12 meses' };

    function ventaPase() { return !!(estado && estado.pase && estado.pase.venta); }
    // Dónde se habla del pase en otros textos: si se vende, se señala la tarjeta; si no, se dice que aún no está a la venta
    function textoPaseVenta() { return ventaPase() ? 'Puedes comprarlo en la sección «Pase Pyme».' : 'El Pase Pyme aún no está a la venta.'; }

    function dibujarPase() {
        if (!estado) return;
        var lim = estado.limites, cat = (estado.pase && estado.pase.productos) || [];
        var vigente = !!lim.paseVence;
        $('pm-pase-estado').textContent = vigente
            ? 'Tu Pase Pyme (' + (NOMBRE_PASE[lim.paseProducto] || '') + ') está vigente hasta el ' + fechaVence(lim.paseVence) + '. Si compras otro, empieza cuando termina este.'
            : 'Tu cuenta no tiene un pase vigente: puedes tener 1 trabajador activo y los documentos salen con marca de agua.';
        var caja = $('pm-pase-opciones');
        if (!ventaPase()) { caja.innerHTML = '<p class="lq-help">El Pase Pyme aún no está a la venta.</p>'; return; }
        caja.innerHTML = cat.map(function (p) {
            return '<div class="pm-pase-op"><div><strong>' + esc(NOMBRE_PASE[p.id] || p.titulo) + '</strong>' +
                '<span class="pm-pase-precio">' + pesos(p.monto) + '</span>' +
                '<span class="pm-pase-mes">equivale a ' + pesos(p.porMes) + ' al mes</span></div>' +
                '<button type="button" class="lq-btn-sec" data-comprar="' + esc(p.id) + '"><span class="material-icons" aria-hidden="true">shopping_cart</span>' + (vigente ? 'Agregar ' : 'Comprar ') + esc(NOMBRE_PASE[p.id] || p.titulo) + '</button></div>';
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
        try { window.history.replaceState({}, document.title, window.location.pathname + window.location.hash); } catch (e) { /* sin historial */ }
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
                    dibujar();
                    mensaje(est, 'ok', 'Tu pase está activo hasta el ' + fechaVence(vence) + '. Te enviamos el comprobante por correo.');
                    registrarCompraGA(producto3(r.datos), orden);
                    return;
                }
                if (++intentos < 8) { window.setTimeout(consultar, 2500); return; }
                mensaje(est, '', 'Tu pago está en proceso. Si en unos minutos no ves tu pase, escríbenos a contacto@calculolaboral.cl con el número de orden ' + orden + '.');
            });
        })();
    }
    function producto3(datos) { return datos.limites && datos.limites.paseProducto; }
    // La venta se cuenta una vez por orden en GA4
    function registrarCompraGA(producto, orden) {
        if (!producto || !orden || !window.CLCheckout) return;
        try {
            if (window.localStorage.getItem(KEY_COMPRA_GA + orden) === '1') return;
            window.localStorage.setItem(KEY_COMPRA_GA + orden, '1');
        } catch (e) { /* sin almacenamiento */ }
        window.CLCheckout.track('purchase', producto, { transaction_id: orden });
    }

    // Generadores incluidos en el pase: se pide un desbloqueo firmado al servidor y se deja guardado antes de abrir el generador
    var DESBLOQUEOS = { 'pm-gen-contrato': 'contrato', 'pm-gen-finiquito': 'finiquito' };
    function cubiertoPorPase(producto) {
        var cob = estado && estado.pase && estado.pase.cobertura, lim = estado && estado.limites;
        return !!(cob && lim && lim.paseVence && cob[producto] && cob[producto].indexOf(lim.paseProducto) >= 0);
    }
    function dibujarNotaGeneradores() {
        var partes = [];
        if (cubiertoPorPase('contrato')) partes.push('el contrato se abre desbloqueado con tu pase');
        if (cubiertoPorPase('finiquito')) partes.push('el finiquito se abre desbloqueado con tu pase');
        $('pm-gen-nota').textContent = partes.length ? 'Con tu pase vigente: ' + partes.join(' y ') + ' (por 48 horas cada vez que lo abras desde aquí).' : '';
    }
    $('pm-gen').addEventListener('click', function (e) {
        var a = e.target.closest('a[id]');
        var producto = a && DESBLOQUEOS[a.id];
        if (!producto || !cubiertoPorPase(producto) || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        var destino = a.href;
        api('desbloqueo', { metodo: 'POST', cuerpo: { producto: producto } }).then(function (r) {
            // El desbloqueo firmado viaja en la dirección, como al volver de un pago: el generador lo valida con /api/unlock
            if (r.ok && r.datos.desbloqueo) {
                var d = r.datos.desbloqueo;
                destino += '&' + new URLSearchParams({ p: d.p, o: d.o, e: d.e, sig: d.sig }).toString();
            }
            window.location.href = destino;
        });
    });

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
    var PERIODOS = P.periodos().slice().reverse();
    var ALMACEN_LOCAL = null;
    try { ALMACEN_LOCAL = window.localStorage; } catch (e) { ALMACEN_LOCAL = null; }
    var VALORES = VL.crear({ parametros: P, fetch: function (u, o) { return window.fetch(u, o); }, storage: ALMACEN_LOCAL });
    var VAL = {};            // valores por mes: { estado: 'cargando' | 'ok' | 'error', ok, mes, fuentes, avisos, notas, mensaje }
    var mesesCache = {};     // periodo → { trabajadorId: mes guardado }
    var periodoSel = null;   // mes que se está viendo
    var editando = null;     // { id, t, mes, nota, guardado } mientras el editor está abierto
    var ultimasImpresas = [];
    var MONTO_MAX = 50000000;

    function periodoPorDefecto() {
        var a = hoyIso().split('-').map(Number), y = a[0], m = a[1];
        if (a[2] <= 10) { m--; if (m < 1) { m = 12; y--; } }
        var p = y + '-' + dos(m);
        if (p < P.PRIMER_MES) p = P.PRIMER_MES;
        if (p > P.ULTIMO_MES) p = P.ULTIMO_MES;
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

    // Carga los meses guardados que el panel necesita (el que se ve y el de los avisos) y vuelve a dibujar
    function cargarLiquidaciones() {
        if (!periodoSel) periodoSel = periodoPorDefecto();
        var toca = PEND.periodoLiquidacion(hoyIso());
        var periodos = [periodoSel];
        if (toca && toca.periodo !== periodoSel && toca.periodo >= P.PRIMER_MES && toca.periodo <= P.ULTIMO_MES) periodos.push(toca.periodo);
        dibujarLiquidaciones();
        cargarValores(periodoSel);
        return Promise.all(periodos.map(cargarMeses)).then(function () {
            if (!estado) return;
            dibujarLiquidaciones();
            dibujarPendientes();
        });
    }

    function valoresAviso() {
        var caja = $('pm-liq-valores'), v = VAL[periodoSel], html = '';
        function aviso(nivel, icono, texto) { html += '<div class="lq-aviso lq-aviso-' + nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(texto) + '</p></div>'; }
        if (!v || v.estado === 'cargando') aviso('info', 'hourglass_empty', 'Consultando la UF y la UTM de ' + nombrePeriodo(periodoSel) + '…');
        else if (!v.ok) aviso('error', 'error', v.mensaje || 'No se pudieron obtener los valores del mes.');
        else {
            (v.avisos || []).forEach(function (t) { aviso('aviso', 'warning', t); });
            (v.notas || []).forEach(function (t) { aviso('info', 'info', t); });
            if (v.vigencia && v.vigencia.verificado.slice(0, 7) < periodoSel) {
                aviso('info', 'info', 'El ingreso mínimo, los topes y las comisiones AFP son los vigentes al ' + v.vigencia.verificado.split('-').reverse().join('-') + '. Confirma que no cambiaron antes de emitir las liquidaciones.');
            }
        }
        caja.innerHTML = html;
    }

    function dibujarLiquidaciones() {
        if (!estado) return;
        var sel = $('pm-liq-periodo');
        if (!sel.options.length) sel.innerHTML = PERIODOS.map(function (p) { return '<option value="' + p + '">' + esc(mayuscula(nombrePeriodo(p))) + '</option>'; }).join('');
        sel.value = periodoSel;
        valoresAviso();

        var lista = activos(), guardados = mesesDe(periodoSel);
        $('pm-liq-vacio').hidden = lista.length > 0;
        $('pm-liq-acciones').hidden = !lista.length;
        $('pm-liq-nota-marca').textContent = tienePase()
            ? 'Con tu pase vigente las liquidaciones salen sin marca de agua. Revisa cada una antes de entregarla.'
            : 'Sin Pase Pyme las liquidaciones llevan la marca «Vista previa». ' + textoPaseVenta() + ' Revisa cada liquidación antes de entregarla.';

        var porPreparar = 0, guardadas = 0;
        $('pm-liq-lista').innerHTML = lista.map(function (t) {
            var reg = guardados[t.id], dias = L.diasBase(t, periodoSel), est = L.estadoDe(reg), sello, meta, acciones = '';
            if (!reg && dias === 0) {
                sello = '<span class="pm-liq-sello">No corresponde</span>';
                meta = t.fechaIngreso && t.fechaIngreso > periodoSel + '-31' ? 'Ingresa el ' + fechaLarga(t.fechaIngreso) + '.' : 'Su contrato a plazo fijo terminó antes de este mes.';
            } else {
                if (est === 'sin_datos') { porPreparar++; sello = '<span class="pm-liq-sello">Sin preparar</span>'; meta = 'Aún no hay datos de este mes.'; }
                else {
                    guardadas++;
                    sello = '<span class="pm-liq-sello pm-liq-sello-ok">' + (est === 'emitida' ? 'Emitida el ' + esc(fechaLarga(reg.emitida)) : 'Guardada') + '</span>';
                    meta = reg.calculo ? 'Líquido a pagar <span class="pm-mono">' + pesos(reg.calculo.liquido) + '</span>' : 'Guardada sin cálculo: ábrela para calcularla.';
                }
                acciones = '<button type="button" class="lq-btn-sec" data-liq="editar" data-id="' + esc(t.id) + '"><span class="material-icons" aria-hidden="true">' + (reg ? 'edit' : 'playlist_add') + '</span>' + (reg ? 'Editar' : 'Preparar') + '</button>';
                if (reg) {
                    acciones += '<button type="button" class="lq-link" data-liq="imprimir" data-id="' + esc(t.id) + '">Imprimir</button>' +
                        '<button type="button" class="lq-link" data-liq="' + (est === 'emitida' ? 'desmarcar' : 'marcar') + '" data-id="' + esc(t.id) + '">' + (est === 'emitida' ? 'Quitar marca de emitida' : 'Marcar emitida') + '</button>';
                }
            }
            return '<li class="pm-liq"><div class="pm-liq-datos"><span class="pm-liq-nombre">' + esc(t.nombre) + '</span><span class="pm-liq-meta">' + sello + meta + '</span></div><div class="pm-liq-acc">' + acciones + '</div></li>';
        }).join('');
        $('pm-liq-preparar').hidden = porPreparar === 0;
        $('pm-liq-imprimir-todas').disabled = guardadas === 0;
        $('pm-liq-marcar').hidden = !ultimasImpresas.length;
        $('pm-liq-marcar').textContent = 'Marcar ' + (ultimasImpresas.length === 1 ? 'la liquidación impresa como emitida' : 'las ' + ultimasImpresas.length + ' impresas como emitidas');
    }

    $('pm-liq-periodo').addEventListener('change', function (e) {
        periodoSel = e.target.value;
        ultimasImpresas = [];
        cerrarMes();
        mensaje($('pm-liq-estado'), '', '');
        cargarLiquidaciones();
    });

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
        ['gratificacionMonto', 'comisiones', 'viaticos', 'asignacionFamiliar', 'apvMonto', 'anticipo', 'creditoCCAF', 'cuotaSindical'].forEach(function (k) { m[k] = Math.min(MONTO_MAX, numero(o[k])); });
        m.horasExtra = Math.min(300, decimal(o.horasExtra));
        m.gratificacion = o.gratificacion;
        m.apvRegimen = o.apvRegimen;
    }
    function visibilidadMes() {
        var m = editando.mes;
        Array.prototype.forEach.call($('pm-liq-form').querySelectorAll('[data-si]'), function (el) {
            var c = el.getAttribute('data-si');
            el.hidden = !((c === 'grat-manual' && m.gratificacion === 'manual') || (c === 'apv' && m.apvMonto > 0));
        });
    }

    function abrirMes(id) {
        var t = trabajadorPorId(id);
        if (!t) return;
        var guardado = mesesDe(periodoSel)[id], nota = '';
        var mes = guardado ? JSON.parse(JSON.stringify(guardado)) : L.mesBase(t, periodoSel);
        if (!guardado && mes.diasTrabajados < 30) nota = 'Pusimos ' + mes.diasTrabajados + ' días trabajados según su fecha de ingreso o de término de contrato (mes de 30 días). Confírmalo.';
        editando = { id: id, t: t, mes: mes, nota: nota, guardado: !!guardado };
        llenar($('pm-liq-form'), mes);
        pintarListas();
        visibilidadMes();
        $('pm-liq-editor-titulo').textContent = 'Liquidación de ' + mayuscula(nombrePeriodo(periodoSel)) + ' · ' + t.nombre;
        $('pm-liq-quitar').hidden = !guardado;
        mensaje($('pm-liq-editor-estado'), '', '');
        $('pm-liq-editor').hidden = false;
        vistaPrevia();
        $('pm-liq-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function cerrarMes() { editando = null; $('pm-liq-editor').hidden = true; }

    // Calcula con el motor del generador de liquidaciones; devuelve { res, val } o null si faltan los valores del mes
    function calcularMes(t, mes, periodo) {
        var val = VAL[periodo];
        if (!val) { cargarValores(periodo); return null; }
        if (val.estado !== 'ok') return null;
        try { return { res: E.calcular({ trabajador: t, mes: mes, periodo: periodo }, val.mes), val: val }; } catch (err) { return { error: err.message }; }
    }

    function vistaPrevia() {
        if (!editando || !estado || !estado.empresa) return;
        var doc = $('pm-liq-doc'), avisos = $('pm-liq-avisos'), m = editando.mes, val = VAL[periodoSel];
        var r = calcularMes(editando.t, m, periodoSel);
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
        if (m.gratificacion === 'manual' && !m.gratificacionMonto) lista.push({ nivel: 'aviso', texto: 'La gratificación es de monto fijo pactado: indica el monto, o cambia a «Legal mensual» o «No se paga este mes».' });
        r.res.avisos.forEach(function (a) { lista.push(a); });
        avisos.innerHTML = lista.map(function (a) {
            var icono = a.nivel === 'error' ? 'error' : a.nivel === 'aviso' ? 'warning' : 'info';
            return '<div class="lq-aviso lq-aviso-' + a.nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(a.texto) + '</p></div>';
        }).join('');
        $('pm-liq-imprimir').disabled = !r.res.listo;
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
    $('pm-liq-cerrar').addEventListener('click', cerrarMes);

    // Guarda un mes (con el resultado calculado si hay valores del mes) y actualiza la memoria local
    function guardarRegistro(id, mes) {
        var t = trabajadorPorId(id), c = t ? calcularMes(t, mes, periodoSel) : null;
        var cuerpo = Object.assign({}, mes, { calculo: c && c.res ? (c.res.listo ? L.resumen(c.res, c.val.mes) : null) : (mes.calculo || null) });
        return api('mes', { metodo: 'PUT', query: { trabajador: id, periodo: periodoSel }, cuerpo: { mes: cuerpo } }).then(function (r) {
            if (r.ok) { mesesCache[periodoSel] = mesesCache[periodoSel] || {}; mesesCache[periodoSel][id] = r.datos.mes; }
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
            $('pm-liq-quitar').hidden = false;
            mensaje(est, 'ok', 'Guardado.');
            dibujarLiquidaciones();
            dibujarPendientes();
        });
    });
    $('pm-liq-quitar').addEventListener('click', function () {
        if (!editando || !window.confirm('¿Quitar la liquidación de ' + nombrePeriodo(periodoSel) + ' de ' + editando.t.nombre + '? Se borran los datos guardados de ese mes.')) return;
        var id = editando.id;
        api('mes', { metodo: 'DELETE', query: { trabajador: id, periodo: periodoSel } }).then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { mensaje($('pm-liq-editor-estado'), 'error', r.datos.error || 'No pudimos quitarla.'); return; }
            if (mesesCache[periodoSel]) delete mesesCache[periodoSel][id];
            cerrarMes();
            dibujarLiquidaciones();
            dibujarPendientes();
            mensaje($('pm-liq-estado'), 'ok', 'Quitamos esa liquidación.');
        });
    });

    // --- lista del mes ---
    $('pm-liq-lista').addEventListener('click', function (e) {
        var b = e.target.closest('[data-liq]');
        if (!b) return;
        var id = b.getAttribute('data-id'), accion = b.getAttribute('data-liq');
        if (accion === 'editar') return abrirMes(id);
        if (accion === 'imprimir') return imprimirMeses([id]);
        var reg = mesesDe(periodoSel)[id];
        if (!reg) return;
        marcarEmitidas([id], accion === 'marcar' ? hoyIso() : '');
    });

    $('pm-liq-preparar').addEventListener('click', function () {
        var est = $('pm-liq-estado'), pendientes = activos().filter(function (t) { return !mesesDe(periodoSel)[t.id] && L.diasBase(t, periodoSel) > 0; });
        if (!pendientes.length) return;
        if (!VAL[periodoSel] || VAL[periodoSel].estado === 'cargando') { mensaje(est, 'error', 'Espera a que terminemos de consultar la UF y la UTM del mes.'); return; }
        mensaje(est, '', 'Preparando ' + pendientes.length + (pendientes.length === 1 ? ' liquidación…' : ' liquidaciones…'));
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
            else mensaje(est, 'ok', 'Preparamos ' + hechas + (hechas === 1 ? ' liquidación' : ' liquidaciones') + ' con los valores base (días según el ingreso, gratificación según la ficha, sin horas extra ni descuentos). Ábrelas para agregar lo del mes antes de imprimir.');
        });
    });

    function marcarEmitidas(ids, fecha) {
        var est = $('pm-liq-estado'), hechas = 0, fallo = null;
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
            mensaje(est, fallo ? 'error' : 'ok', fallo ? (fallo.datos.error || 'No pudimos guardar.') : (fecha ? 'Marcamos ' + hechas + (hechas === 1 ? ' liquidación' : ' liquidaciones') + ' como emitida' + (hechas === 1 ? '.' : 's.') : 'Quitamos la marca de emitida.'));
        });
    }
    $('pm-liq-marcar').addEventListener('click', function () { marcarEmitidas(ultimasImpresas.slice(), hoyIso()); });

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
    function imprimirMeses(ids) {
        var est = $('pm-liq-estado'), val = VAL[periodoSel];
        if (!val || val.estado !== 'ok') { mensaje(est, 'error', val && val.estado === 'error' ? (val.mensaje || 'No se pudieron obtener los valores del mes.') : 'Espera a que terminemos de consultar la UF y la UTM del mes.'); return; }
        var hojas = [], impresas = [], omitidas = [];
        activos().forEach(function (t) {
            var reg = mesesDe(periodoSel)[t.id];
            if (ids.indexOf(t.id) < 0 || !reg) return;
            var r = calcularMes(t, reg, periodoSel);
            if (!r || r.error || !r.res.listo) { omitidas.push(t.nombre); return; }
            hojas.push(DOC.documento(estado.empresa, t, reg, r.res, { periodo: periodoSel, pagada: tienePase(), fuentes: r.val.fuentes }));
            impresas.push(t.id);
        });
        if (!hojas.length) { mensaje(est, 'error', omitidas.length ? 'Revisa los datos de ' + omitidas.join(', ') + ': la liquidación tiene errores y no se puede imprimir.' : 'No hay liquidaciones guardadas para imprimir.'); return; }
        ultimasImpresas = impresas;
        dibujarLiquidaciones();
        mensaje(est, omitidas.length ? 'error' : '', omitidas.length ? 'No se imprimieron las de ' + omitidas.join(', ') + ' porque tienen errores: ábrelas y corrígelas.' : '');
        imprimirHojas(hojas, impresas.length === 1 ? 'Liquidacion ' + trabajadorPorId(impresas[0]).nombre + ' ' + periodoSel : 'Liquidaciones ' + periodoSel);
    }
    $('pm-liq-imprimir-todas').addEventListener('click', function () {
        imprimirMeses(activos().map(function (t) { return t.id; }));
    });
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
            dibujarPendientes();
        }).catch(function () { mensaje(est, 'error', 'No pudimos preparar el archivo. Intenta de nuevo.'); });
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
    mostrar('cargando');
    api('sesion').then(function (r) {
        if (r.datos && r.datos.autenticado) cargar(); else mostrar('entrada');
    });
})();
