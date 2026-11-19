/*
 * CálculoLaboral · Asistente Guiado para Carga Masiva LRE en Mi DT (Ola 3B)
 * Muestra estado de pre-validación, nombre exacto de archivo (rut_aaaamm.csv),
 * totales de control Categoría 5 del Manual LRE y guía en 4 pasos hacia midt.dirtrab.cl.
 */
(function () {
    'use strict';

    var D = window.DemoCL;

    function $(id) { return document.getElementById(id); }

    function val(id) {
        var el = $(id);
        return el ? String(el.value || '').trim() : '';
    }

    function money(n) {
        if (D && D.money) return D.money(n);
        return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
    }

    function esc(v) {
        if (D && D.esc) return D.esc(v);
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function nombreArchivoEsperado(rutEmpresa, periodo) {
        var limpio = String(rutEmpresa || '').replace(/[.\-\s]/g, '').toUpperCase();
        var per = String(periodo || '').replace('-', '');
        if (!limpio || !/^\d{6}$/.test(per)) return 'RUTEMPLEADOR_AAAAMM.csv';
        return limpio + '_' + per + '.csv';
    }

    function calcularTotalesLre() {
        var results = window.CLDemoLiquidaciones ? window.CLDemoLiquidaciones.resultados() : [];
        var ok = results.filter(function (r) { return r && !r.error && r.detalle; });
        var periodo = val('periodo') || '2026-11';
        var rutEmpresa = val('liq-rut-empresa');
        var mutual = val('liq-mutual');
        var ccaf = val('liq-ccaf');
        var comuna = val('liq-comuna');

        var tot = {
            trabajadores: ok.length,
            imponible: 0,
            haberes: 0,
            descuentos: 0,
            aportesEmpleador: 0,
            liquido: 0,
            archivo: nombreArchivoEsperado(rutEmpresa, periodo),
            erroresLre: []
        };

        var d = new Date(periodo + '-15T12:00:00');
        var periodoNombre = isNaN(d) ? periodo : d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
        if (window.CLDemoArchivos && ok.length && rutEmpresa && comuna && mutual) {
            var gen = window.CLDemoArchivos.lre(ok, {
                periodo: periodo,
                periodoNombre: periodoNombre,
                empresa: { rut: rutEmpresa, comuna: comuna, mutual: mutual, ccaf: ccaf }
            });
            if (gen && gen.nombreArchivo) tot.archivo = gen.nombreArchivo;
            if (gen && Array.isArray(gen.errores) && gen.errores.length) tot.erroresLre = gen.errores;
            if (gen && gen.texto && window.CLLreColumns !== false) {
                var lineas = gen.texto.trim().split(/\r?\n/);
                if (lineas.length > 1) {
                    var cols = lineas[0].split(';');
                    var idx = function (cod) {
                        for (var i = 0; i < cols.length; i++) {
                            if (cols[i].indexOf('(' + cod + ')') >= 0 || cols[i].trim() === cod) return i;
                        }
                        return -1;
                    };
                    var i5210 = idx('5210'), i5220 = idx('5220'), i5201 = idx('5201'),
                        i5301 = idx('5301'), i5410 = idx('5410'), i5501 = idx('5501');
                    if (i5201 >= 0 && i5301 >= 0 && i5501 >= 0) {
                        for (var j = 1; j < lineas.length; j++) {
                            var f = lineas[j].split(';');
                            tot.imponible += (Number(f[i5210]) || 0) + (Number(f[i5220]) || 0);
                            tot.haberes += Number(f[i5201]) || 0;
                            tot.descuentos += Number(f[i5301]) || 0;
                            if (i5410 >= 0) tot.aportesEmpleador += Number(f[i5410]) || 0;
                            tot.liquido += Number(f[i5501]) || 0;
                        }
                        return tot;
                    }
                }
            }
        }

        // Respaldo directo desde liquidaciones calculadas si aun falta comuna o RUT
        ok.forEach(function (r) {
            var b = (r.detalle && r.detalle.bases) || {};
            var emp = (r.detalle && r.detalle.empleador) || {};
            tot.imponible += Math.round(Number(b.totalImponible || b.baseAfp || r.haberes) || 0);
            tot.haberes += Math.round(Number(r.haberes) || 0);
            tot.descuentos += Math.round(Number(r.descuentos) || 0);
            tot.aportesEmpleador += Math.round(Number(emp.total) || 0);
            tot.liquido += Math.round(Number(r.liquido) || 0);
        });

        return tot;
    }

    function pintarGuia() {
        var results = window.CLDemoLiquidaciones ? window.CLDemoLiquidaciones.resultados() : [];
        var tot = calcularTotalesLre();
        var bloqueos = [];

        if (window.CLPrevalidador) {
            var ev = window.CLPrevalidador.evaluar({
                resultados: results,
                periodo: val('periodo'),
                mutual: val('liq-mutual'),
                ccaf: val('liq-ccaf'),
                comuna: val('liq-comuna'),
                rutEmpresa: val('liq-rut-empresa'),
                previred: window.CLPrevired,
                archivos: window.CLDemoArchivos,
                exigirLre: true
            });
            ev.generales.forEach(function (g) {
                if (g.nivel === 'rojo' && (g.origen === 'LRE' || g.origen === 'Datos')) bloqueos.push(g.texto);
            });
            ev.trabajadores.forEach(function (t) {
                (t.hallazgos || []).forEach(function (h) {
                    if (h.nivel === 'rojo' && (h.origen === 'LRE' || h.origen === 'Datos' || h.origen === 'Cálculo')) {
                        bloqueos.push(t.nombre + ': ' + h.texto);
                    }
                });
            });
        }
        tot.erroresLre.forEach(function (e) {
            if (bloqueos.indexOf(e) < 0) bloqueos.push(e);
        });

        var sello = $('midt-lre-sello');
        var lista = $('midt-lre-errores-lista');
        if (sello && lista) {
            if (!tot.trabajadores) {
                sello.className = 'sello sello-preparada';
                sello.textContent = 'Carga o calcula una nómina primero';
                lista.hidden = true;
                lista.innerHTML = '';
            } else if (bloqueos.length) {
                sello.className = 'sello sello-riesgo';
                sello.textContent = bloqueos.length + ' errores bloqueantes antes de subir';
                lista.hidden = false;
                lista.innerHTML = bloqueos.slice(0, 8).map(function (b) {
                    return '<li class="preval-hallazgo-item rojo"><span>' + esc(b) + '</span></li>';
                }).join('');
            } else {
                sello.className = 'sello sello-emitida';
                sello.textContent = 'Listo para carga masiva en Mi DT';
                lista.hidden = true;
                lista.innerHTML = '';
            }
        }

        if ($('midt-lre-archivo')) $('midt-lre-archivo').textContent = tot.archivo;
        if ($('midt-lre-cnt-trab')) $('midt-lre-cnt-trab').textContent = String(tot.trabajadores);
        if ($('midt-lre-tot-imponible')) $('midt-lre-tot-imponible').textContent = money(tot.imponible);
        if ($('midt-lre-tot-descuentos')) $('midt-lre-tot-descuentos').textContent = money(tot.descuentos);
        if ($('midt-lre-tot-liquido')) $('midt-lre-tot-liquido').textContent = money(tot.liquido);

        // Bandeja LRE: estado actual de la empresa activa dentro del modal.
        if (window.CLDemoBandejaLre && typeof window.CLDemoBandejaLre.pintarBarraModal === 'function') {
            window.CLDemoBandejaLre.pintarBarraModal();
        }

        return tot;
    }

    function descargarCsvExactoMiDt() {
        var results = window.CLDemoLiquidaciones ? window.CLDemoLiquidaciones.resultados() : [];
        var ok = results.filter(function (r) { return r && !r.error && r.detalle; });
        if (!ok.length) {
            if (D && D.avisar) D.avisar('Primero carga y calcula la nómina.');
            return;
        }
        var periodo = val('periodo');
        var d = new Date(periodo + '-15T12:00:00');
        var periodoNombre = isNaN(d) ? periodo : d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
        var s = window.CLDemoArchivos.lre(ok, {
            periodo: periodo,
            periodoNombre: periodoNombre,
            empresa: {
                rut: val('liq-rut-empresa'),
                comuna: val('liq-comuna'),
                mutual: val('liq-mutual'),
                ccaf: val('liq-ccaf')
            }
        });
        if (s.errores && s.errores.length) {
            pintarGuia();
            if (D && D.avisar) D.avisar('Corrige los errores bloqueantes marcados arriba antes de descargar el LRE.');
            return;
        }
        var bytes = window.CLLre.bytesAnsi(s.texto);
        var blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = s.nombreArchivo; // Nombre exacto Mi DT: rutempleador_aaaamm.csv
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        if (D && D.avisar) D.avisar('Archivo ' + s.nombreArchivo + ' descargado con el formato exacto de Mi DT.');
        // Bandeja LRE (js/demo_bandeja_lre.js): confirmación manual de estado tras descargar.
        if (window.CLDemoBandejaLre && typeof window.CLDemoBandejaLre.postDescargaModal === 'function') {
            window.CLDemoBandejaLre.postDescargaModal(s.nombreArchivo);
        }
    }

    async function copiar(texto, okMsg) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(texto);
            if (D && D.avisar) D.avisar(okMsg);
        } catch (e) {
            if (D && D.avisar) D.avisar('Selecciona el texto y copia con Ctrl+C.');
        }
    }

    function abrirGuia() {
        var dlg = $('dlg-midt-lre');
        if (!dlg) return;
        pintarGuia();
        if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
        else dlg.setAttribute('open', 'open');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var dlg = $('dlg-midt-lre');
        if (!dlg) return;

        if ($('btn-midt-lre-guia')) $('btn-midt-lre-guia').addEventListener('click', abrirGuia);

        function cerrar() {
            if (dlg.open && typeof dlg.close === 'function') dlg.close();
            else dlg.removeAttribute('open');
        }
        if ($('btn-cerrar-midt-lre')) $('btn-cerrar-midt-lre').addEventListener('click', cerrar);
        if ($('btn-midt-lre-cerrar')) $('btn-midt-lre-cerrar').addEventListener('click', cerrar);
        if ($('btn-midt-descargar-lre')) $('btn-midt-descargar-lre').addEventListener('click', descargarCsvExactoMiDt);
        if ($('btn-midt-copiar-archivo')) {
            $('btn-midt-copiar-archivo').addEventListener('click', function () {
                var txt = $('midt-lre-archivo') ? $('midt-lre-archivo').textContent.trim() : '';
                if (txt) copiar(txt, 'Nombre de archivo LRE copiado.');
            });
        }
        if ($('btn-midt-copiar-totales')) {
            $('btn-midt-copiar-totales').addEventListener('click', function () {
                var t = calcularTotalesLre();
                var resumen = [
                    'Cuadratura LRE Mi DT (' + t.archivo + ')',
                    'Trabajadores: ' + t.trabajadores,
                    'Haberes imponibles (5210+5220): ' + money(t.imponible),
                    'Total haberes (5201): ' + money(t.haberes),
                    'Total descuentos (5301): ' + money(t.descuentos),
                    'Total aportes empleador (5410): ' + money(t.aportesEmpleador),
                    'Líquido a pagar (5501): ' + money(t.liquido)
                ].join('\n');
                copiar(resumen, 'Totales de control LRE copiados.');
            });
        }
    });

    window.CLDemoMidt = {
        abrirGuia: abrirGuia,
        calcularTotalesLre: calcularTotalesLre
    };
})();
