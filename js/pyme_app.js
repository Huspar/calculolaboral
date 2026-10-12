/*
 * CalculoLaboral · interfaz del Asistente Laboral Pyme (v1.0.0)
 * Entrar con enlace al correo, ficha de empresa y trabajadores (guardada cifrada en el servidor), pendientes del mes,
 * traer datos del generador de liquidaciones, descargar y eliminar los datos.
 * Requiere: rut_cl.js, liquidacion_parametros.js, feriados_cl.js y pyme_pendientes.js (antes que este archivo).
 * La API es /api/pyme/* (api/_pyme/rutas.js). Todo texto de usuario se escapa antes de mostrarse.
 */
(function () {
    'use strict';

    var Rut = window.CLRut, P = window.CLLiquidacionParametros, F = window.CLFeriados, PEND = window.CLPymePendientes;
    if (!Rut || !P || !F || !PEND || !document.getElementById('pm-panel')) return;

    var KEY_RESPALDO = 'cl_pyme_respaldo';
    var KEY_GENERADOR = 'cl_liq_v1';
    var KEY_IMPORTADO = 'cl_pyme_importado';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var AFPS = Object.keys(P.VIGENCIAS[P.VIGENCIAS.length - 1].afp).sort();

    var estado = null;      // lo último que dijo el servidor
    var editandoId = null;  // id del trabajador que se edita (null = nuevo)
    var logoActual = '';    // data URL del logo en el formulario de la empresa

    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function pesos(n) { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
    function fechaLarga(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1] + ' de ' + a[0]; }
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
        else if (tipo === 'uf') el.value = v ? String(v).replace('.', ',') : '';
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
            else if (tipo === 'uf') el.value = el.value.replace(/[^\d,.]/g, '');
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
        api('salir', { metodo: 'POST' }).then(function () { estado = null; mostrar('entrada'); });
    });

    // ---------- carga del estado ----------
    function cargar() {
        return api('estado').then(function (r) {
            if (sinSesion(r)) return;
            if (!r.ok) { mostrar('entrada', r.datos.error || 'No pudimos cargar tus datos.'); return; }
            estado = r.datos;
            dibujar();
            mostrar('panel');
        });
    }

    function dibujar() {
        $('pm-correo').textContent = estado.cuenta.email;
        dibujarEmpresa();
        dibujarTrabajadores();
        dibujarPendientes();
        dibujarImportar();
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
        txt += lim.paseVence ? 'Tu pase vence el ' + fechaLarga(lim.paseVence) + '.' : 'Sin pase puedes tener 1 trabajador activo; el Pase Pyme, que permitirá hasta 5, aún no está a la venta.';
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
        var lista = PEND.pendientes(estado, { hoy: hoyIso(), P: P, F: F, ultimoRespaldo: guardado(KEY_RESPALDO) });
        $('pm-pend').innerHTML = lista.length ? lista.map(function (p, i) {
            var accion = '';
            if (p.accion) {
                var etiqueta = { empresa: 'Completar empresa', 'trabajador-nuevo': 'Agregar trabajador', trabajador: 'Editar ficha', respaldo: 'Descargar respaldo' }[p.accion.tipo];
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
            estado = null;
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
