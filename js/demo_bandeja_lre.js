/*
 * CalculoLaboral · UI de la Bandeja LRE por empresa (Suite Contadores) v1.0.0
 *
 * Arquitectura visual según Shared/diseno-arquitectura-bandeja-lre-2026-11-19.md:
 * 3er tab "bandeja-lre" en Remuneraciones, banner de plazo legal con CLFeriados,
 * 4 KPIs, filtros + búsqueda, tabla multiempresa con marca manual de 5 estados,
 * integración con el modal de guía LRE (#dlg-midt-lre) y acceso cruzado desde
 * Liquidaciones. Los estados viven en js/bandeja_lre.js (localStorage).
 *
 * No se conecta a Mi DT ni guarda credenciales: el contador marca a mano.
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var B = window.CLBandejaLre;
    var K_SUITE = 'cl-suite-contable';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    var bandeja = B ? B.crear(window.localStorage) : null;
    var filtro = { chip: 'todas', buscar: '', obligatorias: false };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return D && D.esc ? D.esc(v) : String(v == null ? '' : v); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
    function fechaCorta(iso) { var s = String(iso || '').slice(0, 10); var p = s.split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; }
    function avisar(txt) { if (D && D.avisar) D.avisar(txt); }

    // ---------------------------------------------------------------- fuentes
    function periodoActual() {
        var el = $('periodo');
        return (el && el.value) ? el.value : '2026-11';
    }

    function nombreMesPeriodo(per) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(per || ''));
        return m ? (MESES[+m[2] - 1] + ' ' + m[1]) : per;
    }

    function leerTodoAlmacen() {
        try {
            var raw = window.localStorage.getItem(K_SUITE);
            var p = raw ? JSON.parse(raw) : {};
            return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
        } catch (e) { return {}; }
    }

    function clientesCartera() {
        var porKey = {};
        function reg(nombre, trabajadores, esActivo) {
            var nom = String(nombre || '').trim();
            if (!nom) return;
            var k = nom.toLowerCase();
            if (!porKey[k]) porKey[k] = { clave: k, nombre: nom, trabajadores: 0, esActivo: false };
            if ((trabajadores || 0) > porKey[k].trabajadores) porKey[k].trabajadores = trabajadores;
            if (esActivo) porKey[k].esActivo = true;
        }
        var activo = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre)
            ? window.CLSuiteSiiBridge.clienteNombre() : '';
        var resLiq = (window.CLDemoLiquidaciones && window.CLDemoLiquidaciones.resultados)
            ? window.CLDemoLiquidaciones.resultados().filter(function (r) { return r && !r.error; }) : [];
        reg(activo, resLiq.length, true);
        var tienda = (window.CLClientes && window.CLClientes.crear) ? window.CLClientes.crear(window.localStorage) : null;
        var guardados = tienda ? tienda.listar() : [];
        guardados.forEach(function (g) { reg(g.nombre, g.trabajadores || 0, false); });
        Object.keys(leerTodoAlmacen()).forEach(function (k) {
            var parts = k.split('::');
            if (parts[0]) reg(parts[0], 0, false);
        });
        return Object.keys(porKey).sort().map(function (k) { return porKey[k]; });
    }

    function rutDe(nombre) {
        var rut = (window.CLDemoSii && window.CLDemoSii.rutDeCliente) ? window.CLDemoSii.rutDeCliente(nombre) : '';
        if (!rut && window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteClave
            && String(nombre || '').toLowerCase() === window.CLSuiteSiiBridge.clienteClave()) {
            var el = $('liq-rut-empresa');
            rut = el ? el.value.trim() : '';
        }
        return rut || '';
    }

    // Cruce Previred-LRE: el contador ya generó el archivo Previred del período
    // (señal de cotizaciones por pagar/pagadas) pero la bandeja sigue sin LRE declarado.
    function previredGeneradoDe(nombre, per) {
        var k = String(nombre || '').trim().toLowerCase() + '::' + per;
        var st = leerTodoAlmacen()[k];
        return !!(st && st.previredGenerado);
    }

    function esCruce(nombre, per, estado) {
        if (estado !== 'pendiente' && estado !== 'enviado') return false;
        return previredGeneradoDe(nombre, per);
    }

    function registrarPreviredGenerado() {
        var nombre = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre)
            ? window.CLSuiteSiiBridge.clienteNombre() : '';
        if (!nombre || !window.CLSuiteSiiBridge || !window.CLSuiteSiiBridge.guardarEstadoParaCliente) return;
        window.CLSuiteSiiBridge.guardarEstadoParaCliente(nombre, periodoActual(), function (est) {
            est.previredGenerado = hoyIso();
        });
        pintar();
    }

    function csvNombreEsperado(nombre, per) {
        var rut = rutDe(nombre);
        if (!rut) return 'RUT pendiente';
        var limpio = rut.replace(/[.\-\s]/g, '').toUpperCase();
        return limpio + '_' + String(per || '').replace('-', '') + '.csv';
    }

    // ---------------------------------------------------------------- sellos y filas
    function claseSello(estado, obligatoria) {
        if (estado === 'cargado') return 'sello sello-emitida';
        if (estado === 'enviado') return 'sello sello-lre-enviado';
        if (estado === 'observado') return 'sello sello-preparada';
        if (estado === 'rectificar') return 'sello sello-riesgo';
        return obligatoria ? 'sello sello-preparada' : 'sello sello-guardada';
    }

    function filaVisible(c, estado, obligatoria) {
        if (filtro.obligatorias && !obligatoria) return false;
        if (filtro.buscar) {
            var q = filtro.buscar.toLowerCase();
            var rut = rutDe(c.nombre).toLowerCase();
            if (c.nombre.toLowerCase().indexOf(q) < 0 && rut.indexOf(q) < 0) return false;
        }
        if (filtro.chip === 'todas') return true;
        if (filtro.chip === 'pendiente') return estado === 'pendiente';
        if (filtro.chip === 'enviado') return estado === 'enviado';
        if (filtro.chip === 'cargado') return estado === 'cargado';
        if (filtro.chip === 'alerta') return estado === 'observado' || estado === 'rectificar';
        return true;
    }

    function filaHtml(c, est) {
        var obligatoria = c.trabajadores >= 5;
        var estado = est ? est.estado : 'pendiente';
        var fechaISO = est && est.fecha ? String(est.fecha).slice(0, 10) : '';
        var rut = rutDe(c.nombre);
        var cruce = esCruce(c.nombre, periodoActual(), estado);
        var opciones = Object.keys(B.ESTADOS).map(function (k) {
            return '<option value="' + k + '"' + (k === estado ? ' selected' : '') + '>' + B.ESTADOS[k].etiqueta + '</option>';
        }).join('');
        return '<tr' + (cruce ? ' class="lre-fila-cruce"' : '') + '>' +
            '<td data-l="Empresa"><strong>' + esc(c.nombre) + '</strong>' + (c.esActivo ? ' <span class="app-nav-chip">En uso</span>' : '') +
            '<span class="lre-rut mono">' + (rut ? esc(rut) : 'Sin RUT') + '</span></td>' +
            '<td data-l="Dotación">' + (c.trabajadores
                ? c.trabajadores + ' trab. <span class="' + (obligatoria ? 'lre-dot-obligatoria' : 'lre-dot-opcional') + '">' + (obligatoria ? 'Obligatoria' : 'Opcional (<5)') + '</span>'
                : '<span class="texto-ayuda">Sin nómina</span>') + '</td>' +
            '<td data-l="Archivo CSV"><code class="mono lre-csv-nombre">' + esc(csvNombreEsperado(c.nombre, periodoActual())) + '</code>' +
            (cruce ? '<span class="lre-cruce-chip" role="status"><span class="material-icons" aria-hidden="true">sync_problem</span> Previred listo y LRE sin declarar</span>' : '') +
            '</td>' +
            '<td data-l="Estado LRE"><div class="lre-estado-celda">' +
            '<select class="lre-estado-select" data-lre-cliente="' + esc(c.nombre) + '" aria-label="Estado LRE de ' + esc(c.nombre) + '">' + opciones + '</select>' +
            (fechaISO ? '<span class="lre-fecha-fila">Marcado <input type="date" class="lre-fecha-input" data-lre-fecha="' + esc(c.nombre) + '" value="' + esc(fechaISO) + '" aria-label="Fecha de marca LRE de ' + esc(c.nombre) + '"></span>' : '') +
            '</div></td>' +
            '<td data-l="Acciones"><div class="lre-acciones-celda">' +
            (estado === 'pendiente' ? '<button type="button" class="btn btn-chico" data-lre-avanzar="' + esc(c.nombre) + '" data-lre-destino="enviado">Marcar enviado</button>' : '') +
            (estado === 'enviado' ? '<button type="button" class="btn btn-chico btn-primario" data-lre-avanzar="' + esc(c.nombre) + '" data-lre-destino="cargado">Confirmar OK</button>' : '') +
            '<button type="button" class="btn btn-chico" data-lre-guia="' + esc(c.nombre) + '">Guía LRE</button>' +
            '<button type="button" class="btn btn-chico" data-lre-nomina="' + esc(c.nombre) + '">Ir a nómina</button>' +
            '</div></td>' +
            '</tr>';
    }

    // ---------------------------------------------------------------- pintado
    function pintarBanner(lista, est, per) {
        var banner = $('lre-plazo-banner');
        if (!banner) return;
        var nota = 'Obligatorio para empresas con 5 o más trabajadores. Marca el estado a mano después de subir el archivo CSV en midt.dirtrab.cl.';
        var v = B.vencimientoLre(per);
        if (!v) {
            banner.className = 'suite-preval-strip warn';
            banner.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">info</span><strong>Período no válido</strong><span>Elige un período AAAA-MM para calcular el plazo legal LRE.</span></span>';
            return;
        }
        if (!v.cubierto) {
            banner.className = 'suite-preval-strip warn';
            banner.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">info</span>' +
                '<strong>Plazo referencial LRE ' + esc(nombreMesPeriodo(per)) + '</strong>' +
                '<span>15 días hábiles del mes siguiente (feriados nacionales de ' + v.anio + ' pendientes de confirmación). El marcado manual queda disponible de todos modos.</span></span>' +
                '<span class="texto-ayuda">' + nota + '</span>';
            return;
        }
        var hoy = hoyIso();
        var rest = B.diasHabilesRestantes(per, hoy);
        var venceTxt = fechaCorta(v.vence);
        var obligatoriasSinOk = lista.filter(function (c) {
            return c.trabajadores >= 5 && (!est[c.nombre] || est[c.nombre].estado !== 'cargado');
        }).length;
        var cruces = lista.filter(function (c) {
            var estado = est[c.nombre] ? est[c.nombre].estado : 'pendiente';
            return esCruce(c.nombre, per, estado);
        }).length;
        var strip = 'ok';
        var selloHtml = '';
        if (rest === null) {
            strip = 'warn';
            selloHtml = '<span class="sello sello-preparada">Plazo referencial</span>';
        } else if (rest > 5) {
            strip = 'ok';
            selloHtml = '<span class="sello sello-emitida">Quedan ' + rest + ' días hábiles</span>';
        } else if (rest >= 1 && hoy !== v.vence) {
            strip = 'warn';
            selloHtml = '<span class="sello sello-preparada">Quedan ' + rest + ' días hábiles</span>';
        } else if (hoy === v.vence) {
            strip = 'err';
            selloHtml = '<span class="sello sello-riesgo">Vence hoy</span>';
        } else if (obligatoriasSinOk === 0) {
            strip = 'ok';
            selloHtml = '<span class="sello sello-emitida">Cartera al día</span>';
        } else {
            strip = 'err';
            selloHtml = '<span class="sello sello-riesgo">Vencido hace ' + Math.abs(rest) + ' días hábiles</span>';
        }
        if (cruces > 0) {
            selloHtml += '<span class="sello lre-cruce-chip"><span class="material-icons" aria-hidden="true">sync_problem</span>' +
                cruces + (cruces === 1 ? ' empresa' : ' empresas') + ' con Previred listo y LRE sin declarar</span>';
        }
        banner.className = 'suite-preval-strip ' + strip;
        banner.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">' +
            (strip === 'err' ? 'schedule' : 'event_available') + '</span>' +
            '<strong>Plazo legal LRE ' + esc(nombreMesPeriodo(per)) + ': hasta el ' + venceTxt + '</strong>' +
            '<span>15 días hábiles del mes siguiente al pago</span></span>' +
            '<span class="suite-preval-strip-der">' + selloHtml + '</span>' +
            '<span class="texto-ayuda" style="flex-basis:100%">' + nota + '</span>';
    }

    function pintarKpis(lista, est) {
        var total = lista.length;
        var obligatorias = lista.filter(function (c) { return c.trabajadores >= 5; }).length;
        var pendientes = lista.filter(function (c) { return !est[c.nombre] || est[c.nombre].estado === 'pendiente'; }).length;
        var ok = lista.filter(function (c) { return est[c.nombre] && est[c.nombre].estado === 'cargado'; }).length;
        var alerta = lista.filter(function (c) {
            return est[c.nombre] && (est[c.nombre].estado === 'observado' || est[c.nombre].estado === 'rectificar');
        }).length;
        var obligPendientes = lista.filter(function (c) {
            return c.trabajadores >= 5 && (!est[c.nombre] || est[c.nombre].estado === 'pendiente');
        }).length;
        if ($('lre-k-total')) $('lre-k-total').textContent = String(total);
        if ($('lre-k-obligatorias')) $('lre-k-obligatorias').textContent = obligatorias + ' con 5+ trab.';
        if ($('lre-k-pendientes')) {
            $('lre-k-pendientes').textContent = String(pendientes);
            $('lre-k-pendientes').classList.toggle('amarillo', pendientes > 0);
        }
        if ($('lre-k-ok')) $('lre-k-ok').textContent = String(ok);
        if ($('lre-k-alerta')) {
            $('lre-k-alerta').textContent = String(alerta);
            $('lre-k-alerta').classList.toggle('rojo', alerta > 0);
        }
        if ($('lre-tab-badge')) {
            $('lre-tab-badge').hidden = obligPendientes === 0;
            $('lre-tab-badge').textContent = String(obligPendientes);
        }
    }

    function pintarPill(est) {
        var pill = $('liq-lre-estado-pill');
        if (!pill) return;
        var activo = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre) ? window.CLSuiteSiiBridge.clienteNombre() : '';
        var estAct = activo ? (est[activo] || null) : null;
        var estado = estAct ? estAct.estado : 'pendiente';
        var obligatoria = (window.CLDemoLiquidaciones && window.CLDemoLiquidaciones.resultados)
            ? window.CLDemoLiquidaciones.resultados().filter(function (r) { return r && !r.error; }).length >= 5 : false;
        pill.className = claseSello(estado, obligatoria);
        pill.textContent = 'LRE: ' + B.ESTADOS[estado].etiqueta;
    }

    function pintar() {
        if (!bandeja) return;
        var per = periodoActual();
        var lista = clientesCartera();
        var est = bandeja.estados(per);
        pintarBanner(lista, est, per);
        pintarKpis(lista, est);
        pintarPill(est);
        var tbody = $('tbody-bandeja-lre');
        if (!tbody) return;
        var vacio = $('lre-bandeja-vacio');
        var sinFiltro = $('lre-bandeja-sin-filtro');
        if (!lista.length) {
            tbody.innerHTML = '';
            if (vacio) vacio.hidden = false;
            if (sinFiltro) sinFiltro.hidden = true;
            return;
        }
        if (vacio) vacio.hidden = true;
        var visibles = lista.filter(function (c) {
            var estado = est[c.nombre] ? est[c.nombre].estado : 'pendiente';
            return filaVisible(c, estado, c.trabajadores >= 5);
        });
        if (!visibles.length) {
            tbody.innerHTML = '';
            if (sinFiltro) sinFiltro.hidden = false;
            return;
        }
        if (sinFiltro) sinFiltro.hidden = true;
        tbody.innerHTML = visibles.map(function (c) {
            return filaHtml(c, est[c.nombre] || null);
        }).join('');
    }

    // ---------------------------------------------------------------- acciones
    function irABandeja() {
        var radio = document.querySelector('input[name="modo"][value="bandeja-lre"]');
        if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (radio) {
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.cambiarModulo) {
            window.CLSuiteSiiBridge.cambiarModulo('remuneraciones');
        }
    }

    function irANomina(nombre) {
        if (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.cambiarACliente) {
            window.CLSuiteSiiBridge.cambiarACliente(nombre);
            if (window.CLSuiteSiiBridge.refrescarTodo) window.CLSuiteSiiBridge.refrescarTodo();
        }
        var radio = document.querySelector('input[name="modo"][value="liquidaciones"]');
        if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        avisar('Trabajando la nómina de ' + nombre + '.');
    }

    function abrirGuiaDe(nombre) {
        if (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.cambiarACliente) {
            window.CLSuiteSiiBridge.cambiarACliente(nombre);
            if (window.CLSuiteSiiBridge.refrescarTodo) window.CLSuiteSiiBridge.refrescarTodo();
        }
        if (window.CLDemoMidt && window.CLDemoMidt.abrirGuia) {
            window.CLDemoMidt.abrirGuia();
        }
    }

    function marcarEstado(nombre, estado, fechaIso) {
        if (!bandeja) return;
        bandeja.marcar(periodoActual(), nombre, estado, fechaIso || undefined);
        pintar();
    }

    // Barra de estado actual dentro del modal de guía LRE.
    function pintarBarraModal() {
        var barra = $('midt-lre-bandeja-barra');
        if (!barra || !bandeja) return;
        var activo = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre) ? window.CLSuiteSiiBridge.clienteNombre() : '';
        if (!activo) { barra.innerHTML = ''; return; }
        var est = bandeja.obtener(periodoActual(), activo);
        var estado = est ? est.estado : 'pendiente';
        var obligatoria = (window.CLDemoLiquidaciones && window.CLDemoLiquidaciones.resultados)
            ? window.CLDemoLiquidaciones.resultados().filter(function (r) { return r && !r.error; }).length >= 5 : false;
        barra.innerHTML = '<span>Estado actual en bandeja de <strong>' + esc(activo) + '</strong>: ' +
            '<span class="' + claseSello(estado, obligatoria) + '">' + B.ESTADOS[estado].etiqueta + '</span>' +
            (est && est.fecha ? ' <span class="mono">marcado ' + fechaCorta(est.fecha) + '</span>' : '') +
            '</span>';
    }

    // Confirmación posterior a la descarga del CSV (nunca marca en silencio).
    function postDescargaModal(nombreArchivo) {
        var caja = $('midt-lre-post-descarga');
        if (!caja || !bandeja) return;
        caja.hidden = false;
        caja.innerHTML =
            '<span>Archivo <code class="mono">' + esc(nombreArchivo || '') + '</code> descargado. Cuando lo subas en midt.dirtrab.cl, marca a mano el estado de esta empresa:</span>' +
            '<span class="lre-post-botones">' +
            '<button type="button" class="btn btn-chico" id="btn-midt-marcar-enviado">Marcar Enviado a Mi DT</button>' +
            '<button type="button" class="btn btn-chico btn-primario" id="btn-midt-marcar-ok">Marcar Cargado (OK)</button>' +
            '<button type="button" class="btn-texto" id="btn-midt-ir-bandeja">Ver bandeja completa</button>' +
            '</span>';
    }

    function postDescargaLiq() {
        var strip = $('liq-lre-post-strip');
        if (!strip || !bandeja) return;
        var bLre = $('badge-err-lre');
        var conErrores = bLre && !bLre.hidden;
        var hayNomina = (window.CLDemoLiquidaciones && window.CLDemoLiquidaciones.resultados)
            ? window.CLDemoLiquidaciones.resultados().some(function (r) { return r && !r.error; }) : false;
        if (conErrores || !hayNomina) { strip.hidden = true; return; }
        strip.hidden = false;
        strip.innerHTML = '<span class="suite-preval-strip-izq"><span class="material-icons" aria-hidden="true">task_alt</span>' +
            '<strong>CSV LRE generado para la empresa activa.</strong>' +
            '<span>Cuando lo subas en midt.dirtrab.cl, marca su estado:</span></span>' +
            '<span class="lre-post-botones">' +
            '<button type="button" class="btn btn-chico" data-lre-strip="enviado">Marcar Enviado a Mi DT</button>' +
            '<button type="button" class="btn btn-chico btn-primario" data-lre-strip="cargado">Marcar Cargado (OK)</button>' +
            '<button type="button" class="btn-texto" data-lre-strip="ocultar">Ocultar</button>' +
            '</span>';
    }

    // ---------------------------------------------------------------- eventos
    document.addEventListener('DOMContentLoaded', function () {
        if (!bandeja) return;

        var tbody = $('tbody-bandeja-lre');
        if (tbody) {
            tbody.addEventListener('change', function (ev) {
                var el = ev.target;
                var cliente = el.getAttribute('data-lre-cliente');
                if (cliente) {
                    marcarEstado(cliente, el.value);
                    avisar('Estado LRE de ' + cliente + ': ' + B.ESTADOS[el.value].etiqueta + '.');
                    return;
                }
                var fechaEl = el.getAttribute('data-lre-fecha');
                if (fechaEl && el.value) {
                    var actual = bandeja.obtener(periodoActual(), fechaEl);
                    marcarEstado(fechaEl, actual ? actual.estado : 'pendiente', el.value + 'T12:00:00');
                    avisar('Fecha de marca LRE de ' + fechaEl + ' ajustada al ' + fechaCorta(el.value) + '.');
                }
            });
            tbody.addEventListener('click', function (ev) {
                var btn = ev.target.closest('button');
                if (!btn) return;
                var avanzar = btn.getAttribute('data-lre-avanzar');
                if (avanzar) {
                    marcarEstado(avanzar, btn.getAttribute('data-lre-destino'));
                    avisar('Estado LRE de ' + avanzar + ': ' + B.ESTADOS[btn.getAttribute('data-lre-destino')].etiqueta + '.');
                    return;
                }
                var guia = btn.getAttribute('data-lre-guia');
                if (guia) { abrirGuiaDe(guia); return; }
                var nomina = btn.getAttribute('data-lre-nomina');
                if (nomina) irANomina(nomina);
            });
        }

        var filtros = $('lre-filtros');
        if (filtros) {
            filtros.addEventListener('click', function (ev) {
                var chip = ev.target.closest('[data-lre-filtro]');
                if (!chip) return;
                filtro.chip = chip.getAttribute('data-lre-filtro');
                Array.prototype.forEach.call(filtros.querySelectorAll('.fin-chip'), function (c) {
                    var act = c === chip;
                    c.classList.toggle('activo', act);
                    c.setAttribute('aria-selected', act ? 'true' : 'false');
                });
                pintar();
            });
        }
        var buscar = $('lre-bandeja-buscar');
        if (buscar) buscar.addEventListener('input', function () { filtro.buscar = buscar.value.trim(); pintar(); });
        var chk = $('lre-filtro-obligatorias');
        if (chk) chk.addEventListener('change', function () { filtro.obligatorias = chk.checked; pintar(); });

        if ($('btn-lre-mostrar-todas')) {
            $('btn-lre-mostrar-todas').addEventListener('click', function () {
                filtro = { chip: 'todas', buscar: '', obligatorias: false };
                if (buscar) buscar.value = '';
                if (chk) chk.checked = false;
                var f = $('lre-filtros');
                if (f) Array.prototype.forEach.call(f.querySelectorAll('.fin-chip'), function (c) {
                    var act = c.getAttribute('data-lre-filtro') === 'todas';
                    c.classList.toggle('activo', act);
                    c.setAttribute('aria-selected', act ? 'true' : 'false');
                });
                pintar();
            });
        }
        if ($('btn-lre-ir-cartera') && window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.cambiarModulo) {
            $('btn-lre-ir-cartera').addEventListener('click', function () { window.CLSuiteSiiBridge.cambiarModulo('torre'); });
        }
        if ($('btn-liq-ir-bandeja-lre')) {
            $('btn-liq-ir-bandeja-lre').addEventListener('click', irABandeja);
        }

        // Confirmaciones post-descarga dentro del modal de guía LRE.
        var postDlg = $('midt-lre-post-descarga');
        if (postDlg) {
            postDlg.addEventListener('click', function (ev) {
                var btn = ev.target.closest('button');
                if (!btn) return;
                var activo = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre) ? window.CLSuiteSiiBridge.clienteNombre() : '';
                if (!activo) return;
                if (btn.id === 'btn-midt-marcar-enviado') {
                    marcarEstado(activo, 'enviado');
                    postDlg.hidden = true;
                    avisar('Estado LRE de ' + activo + ': Enviado a Mi DT.');
                } else if (btn.id === 'btn-midt-marcar-ok') {
                    marcarEstado(activo, 'cargado');
                    postDlg.hidden = true;
                    avisar('Estado LRE de ' + activo + ': Cargado (OK).');
                } else if (btn.id === 'btn-midt-ir-bandeja') {
                    postDlg.hidden = true;
                    var dlg = $('dlg-midt-lre');
                    if (dlg && dlg.open && typeof dlg.close === 'function') dlg.close();
                    irABandeja();
                }
            });
        }

        // Aviso discreto al generar el CSV desde el botón "Libro LRE" de Liquidaciones.
        if ($('btn-lre-liq')) {
            $('btn-lre-liq').addEventListener('click', function () { setTimeout(postDescargaLiq, 60); });
        }

        // Cruce Previred-LRE: registrar que el archivo Previred del período quedó listo
        // (el generador escribe "Archivo Previred listo" en #warnings-liq al tener éxito).
        if ($('btn-previred-liq')) {
            $('btn-previred-liq').addEventListener('click', function () {
                setTimeout(function () {
                    var caja = $('warnings-liq');
                    if (caja && /Archivo Previred listo/i.test(caja.textContent || '')) {
                        registrarPreviredGenerado();
                    }
                }, 250);
            });
        }
        var stripLiq = $('liq-lre-post-strip');
        if (stripLiq) {
            stripLiq.addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-lre-strip]');
                if (!btn) return;
                var acc = btn.getAttribute('data-lre-strip');
                if (acc === 'ocultar') { stripLiq.hidden = true; return; }
                var activo = (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.clienteNombre) ? window.CLSuiteSiiBridge.clienteNombre() : '';
                if (!activo) return;
                marcarEstado(activo, acc);
                stripLiq.hidden = true;
                avisar('Estado LRE de ' + activo + ': ' + B.ESTADOS[acc].etiqueta + '.');
            });
        }

        // Repintar cuando la suite recalcula (cambio de cliente, período, nómina).
        document.addEventListener('suite:refrescado', pintar);
        var periodoEl = $('periodo');
        if (periodoEl) periodoEl.addEventListener('change', pintar);
        document.addEventListener('demo:modo', function (ev) {
            if (ev.detail === 'bandeja-lre') pintar();
        });

        pintar();
    });

    window.CLDemoBandejaLre = {
        pintar: pintar,
        pintarBarraModal: pintarBarraModal,
        postDescargaModal: postDescargaModal
    };
})();
