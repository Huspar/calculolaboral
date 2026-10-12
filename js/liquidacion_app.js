/*
 * CalculoLaboral · interfaz del generador de liquidaciones de sueldo (v1.0.0)
 * Datos en localStorage (nunca se envían al servidor), vista previa en vivo, respaldo en JSON y cobro con
 * CLCheckout.buyKit('liquidacion'). El pago desbloquea por 48 h la liquidación de ese trabajador y ese mes.
 * Requiere: liquidacion_parametros.js, liquidacion_engine.js y checkout_consent.js (antes que este archivo).
 */
(function () {
    'use strict';

    var P = window.CLLiquidacionParametros;
    var E = window.CLLiquidacionEngine;
    var form = document.getElementById('lq-form');
    if (!P || !E || !form) return;

    var KEY = 'cl_liq_v1';
    var KEY_PAGOS = 'cl_liq_pagos';
    var KEY_PEND = 'cl_liq_pendiente';
    var PRODUCTO = 'liquidacion';
    var PRECIO = '$2.990';
    var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var PERIODOS = Object.keys(P.MESES).sort().reverse();
    var AFPS = Object.keys(P.MESES[PERIODOS[0]].afp);

    var $ = function (id) { return document.getElementById(id); };
    var doc = $('lq-doc');
    var btn = $('lq-descargar');
    var btnTxt = $('lq-descargar-txt');
    var estado = $('lq-estado');
    var ultimo = null;

    // ---------- almacenamiento ----------
    function leer(k, def) {
        try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; }
    }
    function escribir(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
    function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function nuevoTrabajador() {
        return { id: uid(), nombre: '', rut: '', cargo: '', fechaIngreso: '', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 0, afp: 'Modelo', salud: 'fonasa', isapreNombre: '', isaprePlanUF: 0, colacion: 0, movilizacion: 0 };
    }
    function nuevoMes() {
        return { diasTrabajados: 30, diasLicencia: 0, horasExtra: 0, gratificacion: 'legal', gratificacionMonto: 0, comisiones: 0, bonosImponibles: [], viaticos: 0, asignacionFamiliar: 0, otrosNoImponibles: [], apvMonto: 0, apvRegimen: 'B', anticipo: 0, creditoCCAF: 0, cuotaSindical: 0, otrosDescuentos: [] };
    }
    function estadoInicial() {
        var t = nuevoTrabajador();
        return { v: 1, empresa: { razonSocial: '', rut: '', direccion: '', logo: '' }, trabajadores: [t], sel: t.id, periodo: PERIODOS[0], meses: {} };
    }

    var S = leer(KEY, null);
    if (!S || S.v !== 1 || !Array.isArray(S.trabajadores) || !S.trabajadores.length) S = estadoInicial();
    if (PERIODOS.indexOf(S.periodo) < 0) S.periodo = PERIODOS[0];
    if (!S.trabajadores.some(function (t) { return t.id === S.sel; })) S.sel = S.trabajadores[0].id;

    var guardarPend = null;
    function guardar() {
        clearTimeout(guardarPend);
        guardarPend = setTimeout(function () { escribir(KEY, S); }, 250);
    }
    function trabajador() {
        return S.trabajadores.find(function (t) { return t.id === S.sel; }) || S.trabajadores[0];
    }
    function claveMes() { return S.sel + '|' + S.periodo; }
    function mes() {
        if (!S.meses[claveMes()]) S.meses[claveMes()] = nuevoMes();
        return S.meses[claveMes()];
    }

    // ---------- formato ----------
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function pesos(x) { return '$' + Math.round(x || 0).toLocaleString('es-CL'); }
    function nombreMes(p) { var a = p.split('-'); return MESES_ES[+a[1] - 1] + ' ' + a[0]; }
    function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function soloDigitos(v) { return parseInt(String(v || '').replace(/\D/g, ''), 10) || 0; }
    function decimal(v) { var x = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isFinite(x) && x > 0 ? x : 0; }
    function fmtDecimal(x) { return x ? String(x).replace('.', ',') : ''; }
    function fecha(iso) { if (!iso) return ''; var a = iso.split('-'); return a.length === 3 ? a[2] + '-' + a[1] + '-' + a[0] : iso; }

    function limpiarRut(v) { return String(v || '').toUpperCase().replace(/[^0-9K]/g, ''); }
    function formatoRut(v) {
        var c = limpiarRut(v);
        if (c.length < 2) return c;
        var cuerpo = c.slice(0, -1), dv = c.slice(-1);
        return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
    }
    function rutValido(v) {
        var c = limpiarRut(v);
        if (c.length < 8 || c.length > 9) return false;
        var cuerpo = c.slice(0, -1), dv = c.slice(-1), s = 0, m = 2;
        for (var i = cuerpo.length - 1; i >= 0; i--) { s += +cuerpo[i] * m; m = m === 7 ? 2 : m + 1; }
        var r = 11 - (s % 11);
        return dv === (r === 11 ? '0' : r === 10 ? 'K' : String(r));
    }

    // Monto en palabras para la línea "Son:"
    var UNI = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    var DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    var CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    function cientos(n) {
        if (n === 100) return 'cien';
        var c = Math.floor(n / 100), r = n % 100, t = [];
        if (c) t.push(CEN[c]);
        if (r) t.push(r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' y ' + UNI[r % 10] : ''));
        return t.join(' ');
    }
    function enPalabras(n) {
        n = Math.round(Math.abs(n));
        if (!n) return 'cero pesos';
        var mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000, t = [];
        if (mill) t.push(mill === 1 ? 'un millón' : cientos(mill) + ' millones');
        if (miles) t.push(miles === 1 ? 'mil' : cientos(miles) + ' mil');
        if (resto) t.push(cientos(resto));
        return t.join(' ') + (mill && !miles && !resto ? ' de pesos' : ' pesos');
    }

    // ---------- pagos ----------
    function pagos() {
        var todos = leer(KEY_PAGOS, {}), vigentes = {}, ahora = Date.now();
        Object.keys(todos).forEach(function (o) { if (todos[o] && todos[o].expiresAt > ahora) vigentes[o] = todos[o]; });
        return vigentes;
    }
    function pagoActual() {
        var t = trabajador(), rut = limpiarRut(t.rut), lista = pagos();
        var o = Object.keys(lista).find(function (k) { return lista[k].rut === rut && lista[k].periodo === S.periodo; });
        return o ? lista[o] : null;
    }
    function registrarPago(u) {
        var pend = leer(KEY_PEND, null);
        if (!u || !pend) return null;
        var todos = pagos();
        if (!todos[u.o]) todos[u.o] = { rut: pend.rut, periodo: pend.periodo, id: pend.id, expiresAt: u.expiresAt };
        escribir(KEY_PAGOS, todos);
        try { localStorage.removeItem(KEY_PEND); } catch (e) {}
        return todos[u.o];
    }

    // ---------- formulario ----------
    function objetivo(k) {
        var p = k.split('.');
        if (p[0] === 'empresa') return [S.empresa, p[1]];
        if (p[0] === 't') return [trabajador(), p[1]];
        if (p[0] === 'm') return [mes(), p[1]];
        return [S, p[0]];
    }
    function mostrarValor(el, v) {
        var tipo = el.getAttribute('data-tipo');
        if (tipo === 'pesos') el.value = v ? pesos(v) : '';
        else if (tipo === 'uf' || tipo === 'dec') el.value = fmtDecimal(v);
        else if (tipo === 'rut') el.value = formatoRut(v);
        else if (tipo === 'num') el.value = v || v === 0 ? String(v) : '';
        else el.value = v == null ? '' : v;
    }
    function leerValor(el) {
        var tipo = el.getAttribute('data-tipo');
        if (tipo === 'pesos' || tipo === 'num') return soloDigitos(el.value);
        if (tipo === 'uf' || tipo === 'dec') return decimal(el.value);
        if (tipo === 'rut') return limpiarRut(el.value);
        return el.value;
    }

    function llenarSelects() {
        $('lq-t-afp').innerHTML = AFPS.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
        $('lq-periodo').innerHTML = PERIODOS.map(function (p) { return '<option value="' + p + '">' + capital(nombreMes(p)) + '</option>'; }).join('');
    }
    function llenarTrabajadores() {
        $('lq-sel').innerHTML = S.trabajadores.map(function (t, i) {
            return '<option value="' + t.id + '">' + esc(t.nombre || 'Trabajador ' + (i + 1)) + '</option>';
        }).join('');
        $('lq-sel').value = S.sel;
        $('lq-borrar').hidden = S.trabajadores.length < 2;
    }
    function filaLista(path, item) {
        var ph = form.querySelector('[data-lista="' + path + '"]').getAttribute('data-ph');
        return '<div class="lq-row">' +
            '<input type="text" maxlength="60" aria-label="Concepto" placeholder="' + esc(ph) + '" data-campo="nombre" value="' + esc(item.nombre) + '">' +
            '<input type="text" inputmode="numeric" aria-label="Monto" placeholder="$0" data-campo="monto" value="' + (item.monto ? pesos(item.monto) : '') + '">' +
            '<button type="button" class="lq-x" aria-label="Quitar" data-quitar><span class="material-icons" aria-hidden="true">close</span></button></div>';
    }
    function pintarListas() {
        form.querySelectorAll('[data-lista]').forEach(function (cont) {
            var path = cont.getAttribute('data-lista'), lista = objetivo(path)[0][objetivo(path)[1]] || [];
            cont.innerHTML = lista.map(function (it) { return filaLista(path, it); }).join('');
        });
    }
    function pintarFormulario() {
        form.querySelectorAll('[data-k]').forEach(function (el) {
            var o = objetivo(el.getAttribute('data-k'));
            mostrarValor(el, o[0][o[1]]);
        });
        pintarListas();
        llenarTrabajadores();
        visibilidad();
        var logo = S.empresa.logo;
        $('lq-logo-prev').hidden = !logo;
        $('lq-logo-quitar').hidden = !logo;
        if (logo) $('lq-logo-prev').src = logo;
    }
    function visibilidad() {
        var t = trabajador(), m = mes();
        form.querySelectorAll('[data-si]').forEach(function (el) {
            var c = el.getAttribute('data-si');
            el.hidden = !((c === 'isapre' && t.salud === 'isapre') || (c === 'grat-manual' && m.gratificacion === 'manual') || (c === 'apv' && m.apvMonto > 0));
        });
    }

    form.addEventListener('input', function (e) {
        var el = e.target;
        if (el.hasAttribute('data-k')) {
            var o = objetivo(el.getAttribute('data-k'));
            o[0][o[1]] = leerValor(el);
            if (el.getAttribute('data-k') === 'periodo' || el.getAttribute('data-k') === 't.nombre') llenarTrabajadores();
            if (el.getAttribute('data-k') === 'periodo') pintarFormulario();
        } else if (el.hasAttribute('data-campo')) {
            var cont = el.closest('[data-lista]'), path = cont.getAttribute('data-lista');
            var filas = Array.prototype.slice.call(cont.querySelectorAll('.lq-row'));
            var oo = objetivo(path);
            oo[0][oo[1]] = filas.map(function (f) {
                return { nombre: f.querySelector('[data-campo="nombre"]').value, monto: soloDigitos(f.querySelector('[data-campo="monto"]').value) };
            });
        } else return;
        visibilidad();
        guardar();
        render();
    });
    form.addEventListener('change', function (e) {
        // Al salir del campo, se muestra con formato ($, puntos, RUT)
        var el = e.target;
        if (el.hasAttribute('data-k') && el.getAttribute('data-tipo')) {
            var o = objetivo(el.getAttribute('data-k'));
            mostrarValor(el, o[0][o[1]]);
        } else if (el.getAttribute('data-campo') === 'monto') {
            var v = soloDigitos(el.value);
            el.value = v ? pesos(v) : '';
        }
    });
    form.addEventListener('click', function (e) {
        var add = e.target.closest('[data-agregar]');
        if (add) {
            var path = add.getAttribute('data-agregar'), o = objetivo(path);
            o[0][o[1]] = (o[0][o[1]] || []).concat([{ nombre: '', monto: 0 }]).slice(0, 8);
            pintarListas();
            var cont = form.querySelector('[data-lista="' + path + '"]');
            var ult = cont.querySelector('.lq-row:last-child input');
            if (ult) ult.focus();
            guardar();
            return;
        }
        var quitar = e.target.closest('[data-quitar]');
        if (quitar) {
            var fila = quitar.closest('.lq-row'), c2 = fila.parentNode, p2 = c2.getAttribute('data-lista');
            var idx = Array.prototype.indexOf.call(c2.children, fila), o2 = objetivo(p2);
            o2[0][o2[1]].splice(idx, 1);
            pintarListas();
            guardar();
            render();
        }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    $('lq-sel').addEventListener('change', function () {
        S.sel = this.value;
        pintarFormulario();
        guardar();
        render();
    });
    $('lq-nuevo').addEventListener('click', function () {
        var t = nuevoTrabajador();
        var base = trabajador();
        t.afp = base.afp;
        S.trabajadores.push(t);
        S.sel = t.id;
        pintarFormulario();
        guardar();
        render();
        $('lq-t-nombre').focus();
    });
    $('lq-borrar').addEventListener('click', function () {
        var t = trabajador();
        if (S.trabajadores.length < 2) return;
        if (!window.confirm('¿Eliminar a ' + (t.nombre || 'este trabajador') + ' y sus meses guardados en este navegador?')) return;
        S.trabajadores = S.trabajadores.filter(function (x) { return x.id !== t.id; });
        Object.keys(S.meses).forEach(function (k) { if (k.indexOf(t.id + '|') === 0) delete S.meses[k]; });
        S.sel = S.trabajadores[0].id;
        pintarFormulario();
        guardar();
        render();
    });

    // Logo: se reduce a 360 × 160 px como máximo para no llenar el almacenamiento
    $('lq-logo').addEventListener('change', function () {
        var file = this.files && this.files[0];
        this.value = '';
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { window.alert('La imagen pesa más de 5 MB. Usa una más liviana.'); return; }
        var reader = new FileReader();
        reader.onload = function () {
            var img = new Image();
            img.onload = function () {
                var k = Math.min(1, 360 / img.width, 160 / img.height);
                var c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(img.width * k));
                c.height = Math.max(1, Math.round(img.height * k));
                var ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                S.empresa.logo = c.toDataURL('image/jpeg', 0.88);
                pintarFormulario();
                guardar();
                render();
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
    $('lq-logo-quitar').addEventListener('click', function () {
        S.empresa.logo = '';
        pintarFormulario();
        guardar();
        render();
    });

    // Respaldo
    $('lq-exportar').addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'respaldo-liquidaciones-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        $('lq-backup-msg').textContent = 'Respaldo descargado. Guárdalo en un lugar seguro: contiene RUT y sueldos.';
    });
    $('lq-importar').addEventListener('change', function () {
        var file = this.files && this.files[0];
        this.value = '';
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var d = JSON.parse(reader.result);
                if (!d || d.v !== 1 || !Array.isArray(d.trabajadores) || !d.trabajadores.length || !d.empresa) throw new Error('formato');
                if (!window.confirm('Esto reemplaza los datos de este navegador por los del respaldo. ¿Continuar?')) return;
                S = d;
                if (PERIODOS.indexOf(S.periodo) < 0) S.periodo = PERIODOS[0];
                if (!S.trabajadores.some(function (t) { return t.id === S.sel; })) S.sel = S.trabajadores[0].id;
                S.meses = S.meses || {};
                escribir(KEY, S);
                pintarFormulario();
                render();
                $('lq-backup-msg').textContent = 'Respaldo cargado: ' + S.trabajadores.length + ' trabajador(es).';
            } catch (err) {
                $('lq-backup-msg').textContent = 'Ese archivo no es un respaldo del generador de liquidaciones.';
            }
        };
        reader.readAsText(file);
    });

    // ---------- validación y vista previa ----------
    var EJEMPLO = {
        empresa: { razonSocial: 'Empresa de Ejemplo SpA', rut: '761234567', direccion: 'Av. Principal 123, Santiago', logo: '' },
        trabajador: { nombre: 'Persona de ejemplo', rut: '123456785', cargo: 'Vendedora', fechaIngreso: '2025-03-01', contrato: 'indefinido', jornadaHoras: 42, sueldoBase: 650000, afp: 'Modelo', salud: 'fonasa', colacion: 40000, movilizacion: 30000 },
        mes: { diasTrabajados: 30, gratificacion: 'legal', horasExtra: 4 }
    };
    function faltantes() {
        var f = [], t = trabajador(), em = S.empresa;
        if (!String(em.razonSocial || '').trim()) f.push(['lq-emp-razon', 'la razón social de la empresa']);
        if (!rutValido(em.rut)) f.push(['lq-emp-rut', 'un RUT de empresa válido']);
        if (!String(t.nombre || '').trim()) f.push(['lq-t-nombre', 'el nombre del trabajador']);
        if (!rutValido(t.rut)) f.push(['lq-t-rut', 'un RUT de trabajador válido']);
        if (!t.sueldoBase) f.push(['lq-t-sueldo', 'el sueldo base']);
        return f;
    }
    function vacio() {
        var t = trabajador();
        return !t.sueldoBase && !String(t.nombre || '').trim() && !String(S.empresa.razonSocial || '').trim();
    }

    function tablaLineas(lineas) {
        return lineas.map(function (l) {
            return '<tr><th scope="row">' + esc(l.concepto) + (l.detalle ? '<small>' + esc(l.detalle) + '</small>' : '') + '</th><td>' + pesos(l.monto) + '</td></tr>';
        }).join('');
    }
    function contrato(c) { return c === 'plazo_fijo' ? 'Plazo fijo' : c === 'obra' ? 'Por obra o faena' : 'Indefinido'; }

    function documento(em, t, m, res, opciones) {
        var b = res.bases;
        var datos = [
            ['Trabajador', esc(t.nombre)], ['RUT', esc(formatoRut(t.rut))],
            ['Cargo', esc(t.cargo || '—')], ['Fecha de ingreso', esc(fecha(t.fechaIngreso) || '—')],
            ['Contrato', contrato(t.contrato)], ['Jornada', b.jornada + ' h semanales'],
            ['AFP', esc(t.afp)], ['Salud', t.salud === 'isapre' ? esc(t.isapreNombre || 'Isapre') : 'Fonasa'],
            ['Días trabajados', String(b.dias)]
        ];
        if (m.diasLicencia) datos.push(['Días de licencia', String(Math.round(m.diasLicencia))]);
        return '' +
            (opciones.ejemplo ? '<p class="lqd-ejemplo">Ejemplo · completa el formulario para ver tu liquidación</p>' : '') +
            '<header class="lqd-head">' +
                '<div class="lqd-emp">' + (em.logo ? '<img src="' + em.logo + '" alt="">' : '') +
                    '<div><strong>' + esc(em.razonSocial) + '</strong><span>RUT ' + esc(formatoRut(em.rut)) + '</span>' + (em.direccion ? '<span>' + esc(em.direccion) + '</span>' : '') + '</div></div>' +
                '<div class="lqd-title"><h2>Liquidación de sueldo</h2><p>' + capital(nombreMes(opciones.periodo)) + '</p></div>' +
            '</header>' +
            '<dl class="lqd-datos">' + datos.map(function (d) { return '<div><dt>' + d[0] + '</dt><dd>' + d[1] + '</dd></div>'; }).join('') + '</dl>' +
            '<div class="lqd-cols">' +
                '<section><h3>Haberes</h3><table><tbody>' +
                    '<tr class="lqd-grupo"><th colspan="2">Imponibles</th></tr>' + tablaLineas(res.haberesImponibles) +
                    '<tr class="lqd-sub"><th scope="row">Total imponible</th><td>' + pesos(res.totalImponible) + '</td></tr>' +
                    (res.haberesNoImponibles.length ? '<tr class="lqd-grupo"><th colspan="2">No imponibles</th></tr>' + tablaLineas(res.haberesNoImponibles) +
                    '<tr class="lqd-sub"><th scope="row">Total no imponible</th><td>' + pesos(res.totalNoImponible) + '</td></tr>' : '') +
                    '</tbody><tfoot><tr><th scope="row">Total haberes</th><td>' + pesos(res.totalHaberes) + '</td></tr></tfoot></table></section>' +
                '<section><h3>Descuentos</h3><table><tbody>' +
                    '<tr class="lqd-grupo"><th colspan="2">Legales</th></tr>' + tablaLineas(res.descuentosLegales) +
                    '<tr class="lqd-sub"><th scope="row">Total descuentos legales</th><td>' + pesos(res.totalLegales) + '</td></tr>' +
                    (res.otrosDescuentos.length ? '<tr class="lqd-grupo"><th colspan="2">Otros descuentos</th></tr>' + tablaLineas(res.otrosDescuentos) +
                    '<tr class="lqd-sub"><th scope="row">Total otros descuentos</th><td>' + pesos(res.totalOtros) + '</td></tr>' : '') +
                    '</tbody><tfoot><tr><th scope="row">Total descuentos</th><td>' + pesos(res.totalDescuentos) + '</td></tr></tfoot></table></section>' +
            '</div>' +
            '<div class="lqd-total"><div><span>Alcance líquido a pagar</span><small>Son: ' + capital(enPalabras(res.liquido)) + '</small></div><strong>' + pesos(res.liquido) + '</strong></div>' +
            '<dl class="lqd-bases">' +
                '<div><dt>Tope imponible AFP y salud</dt><dd>' + pesos(b.topeAfp) + '</dd></div>' +
                '<div><dt>Base tributable</dt><dd>' + pesos(b.baseTributable) + '</dd></div>' +
                '<div><dt>UF al cierre del mes</dt><dd>' + b.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 }) + '</dd></div>' +
                '<div><dt>UTM del mes</dt><dd>' + pesos(b.utm) + '</dd></div>' +
            '</dl>' +
            '<p class="lqd-recibi">Recibí conforme el alcance líquido de la presente liquidación y copia de ella.</p>' +
            '<div class="lqd-firmas"><div><span></span>Firma del trabajador</div><div><span></span>Firma y timbre del empleador</div></div>' +
            (opciones.pagada ? '' : '<div class="lqd-marca" aria-hidden="true"><span>Vista previa</span></div>');
    }

    function render() {
        var ejemplo = vacio();
        var em = ejemplo ? EJEMPLO.empresa : S.empresa;
        var t = ejemplo ? EJEMPLO.trabajador : trabajador();
        var m = ejemplo ? Object.assign(nuevoMes(), EJEMPLO.mes) : mes();
        var pago = ejemplo ? null : pagoActual();
        var res;
        try {
            res = E.calcular({ trabajador: t, mes: m }, P.MESES[S.periodo]);
        } catch (err) {
            doc.innerHTML = '<p class="lqd-error">' + esc(err.message) + '</p>';
            btn.disabled = true;
            return;
        }
        ultimo = res;
        doc.innerHTML = documento(em, t, m, res, { periodo: S.periodo, pagada: !!pago, ejemplo: ejemplo });
        doc.classList.toggle('lqd-pagada', !!pago);

        // Avisos y datos que faltan
        var falta = ejemplo ? [] : faltantes();
        var avisos = ejemplo ? [] : res.avisos.slice();
        var html = '';
        if (falta.length) {
            html += '<div class="lq-aviso lq-aviso-falta"><span class="material-icons" aria-hidden="true">edit_note</span><p>Para descargar falta ' +
                falta.map(function (f) { return '<a href="#' + f[0] + '" data-ir="' + f[0] + '">' + f[1] + '</a>'; }).join(', ') + '.</p></div>';
        }
        avisos.forEach(function (a) {
            var icono = a.nivel === 'error' ? 'error' : a.nivel === 'aviso' ? 'warning' : 'info';
            html += '<div class="lq-aviso lq-aviso-' + a.nivel + '"><span class="material-icons" aria-hidden="true">' + icono + '</span><p>' + esc(a.texto) + '</p></div>';
        });
        $('lq-avisos').innerHTML = html;

        var listo = !ejemplo && !falta.length && res.listo;
        btn.disabled = !listo;
        if (pago) {
            btnTxt.textContent = 'Descargar PDF';
            var vence = new Date(pago.expiresAt);
            estado.innerHTML = '<span class="material-icons" aria-hidden="true">check_circle</span> Pagada. Puedes corregir y descargar hasta el ' +
                vence.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }) + ' a las ' +
                vence.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' h';
            estado.className = 'lq-estado lq-estado-ok';
        } else {
            btnTxt.textContent = 'Descargar PDF · ' + PRECIO;
            estado.textContent = ejemplo ? 'Completa el formulario: la vista previa se actualiza mientras escribes.' : (listo ? 'Revisa la vista previa antes de pagar.' : '');
            estado.className = 'lq-estado';
        }
    }

    $('lq-avisos').addEventListener('click', function (e) {
        var a = e.target.closest('[data-ir]');
        if (!a) return;
        e.preventDefault();
        var el = $(a.getAttribute('data-ir'));
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); }
    });

    // ---------- descarga y pago ----------
    function imprimir() {
        var t = trabajador();
        var titulo = document.title;
        document.title = 'Liquidacion ' + (t.nombre || 'trabajador').trim() + ' ' + S.periodo;
        var restaurar = function () { document.title = titulo; window.removeEventListener('afterprint', restaurar); };
        window.addEventListener('afterprint', restaurar);
        window.print();
        setTimeout(restaurar, 2000);
    }

    btn.addEventListener('click', function () {
        if (btn.disabled) return;
        if (pagoActual()) { imprimir(); return; }
        if (!window.CLCheckout) { window.alert('No pudimos iniciar el pago. Recarga la página e intenta de nuevo.'); return; }
        escribir(KEY, S);
        var t = trabajador();
        escribir(KEY_PEND, { id: t.id, rut: limpiarRut(t.rut), periodo: S.periodo });
        var original = btnTxt.textContent;
        window.CLCheckout.buyKit(PRODUCTO, {
            nombre: String(S.empresa.razonSocial || '').slice(0, 80),
            empresa: String(S.empresa.razonSocial || '').slice(0, 100)
        }, {
            askEmail: true,
            onAccept: function () { btn.disabled = true; btnTxt.textContent = 'Conectando con Flow…'; },
            onError: function (msg) { btn.disabled = false; btnTxt.textContent = original; window.alert(msg); }
        });
    });

    // ---------- valores del mes (tabla informativa) ----------
    function tablaValores() {
        var cont = $('lq-valores');
        if (!cont) return;
        cont.innerHTML = '<table><caption>Valores oficiales usados por el generador</caption><thead><tr><th scope="col">Mes</th><th scope="col">UF al cierre</th><th scope="col">UTM</th><th scope="col">Ingreso mínimo</th><th scope="col">Tope AFP y salud</th><th scope="col">Tope cesantía</th></tr></thead><tbody>' +
            PERIODOS.map(function (p) {
                var v = P.MESES[p];
                return '<tr><th scope="row">' + capital(nombreMes(p)) + '</th><td>' + v.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 }) + '</td><td>' + pesos(v.utm) + '</td><td>' + pesos(v.imm) + '</td><td>' + pesos(v.topeAfpUF * v.uf) + '</td><td>' + pesos(v.topeAfcUF * v.uf) + '</td></tr>';
            }).join('') + '</tbody></table><p class="lq-help">Fuentes: ' + P.FUENTES.join(' · ') + '.</p>';
    }

    // ---------- inicio ----------
    llenarSelects();
    pintarFormulario();
    tablaValores();
    render();

    var q = new URLSearchParams(window.location.search);
    if (window.CLCheckout) {
        window.CLCheckout.track('view_item', PRODUCTO);
        var vieneDeFlow = q.get('p') === PRODUCTO && q.has('sig');
        window.CLCheckout.unlockFromUrl(PRODUCTO).then(function (u) {
            if (!vieneDeFlow || !u) return;
            var p = registrarPago(u);
            if (p) {
                if (S.trabajadores.some(function (t) { return t.id === p.id; })) S.sel = p.id;
                S.periodo = p.periodo;
                escribir(KEY, S);
                pintarFormulario();
            }
            render();
            estado.scrollIntoView({ block: 'center' });
        });
    }
    if (q.get('pago') === 'rechazado') {
        estado.textContent = 'El pago no se completó y no se hizo ningún cargo. Tus datos siguen guardados.';
        estado.className = 'lq-estado lq-estado-error';
    }
})();
