/*
 * CalculoLaboral · Simulador público DJ 1887 y Certificado N°6 (v1.0.0)
 * Reutiliza CLRenta (js/contadores_renta.js), CLPymeExcel (js/pyme_excel.js) y CLPrint (js/print_brand.js).
 */
(function (root, doc) {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pesos(n) {
        return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
    }

    function entero(v) {
        if (typeof v === 'number') return isFinite(v) ? Math.max(0, Math.round(v)) : 0;
        var s = String(v == null ? '' : v).replace(/[^\d]/g, '');
        return s ? parseInt(s, 10) : 0;
    }

    function limpiarRut(rut) {
        return String(rut == null ? '' : rut).replace(/[^0-9kK]/g, '').toUpperCase();
    }

    function formatearRut(rut) {
        var c = limpiarRut(rut);
        if (c.length < 2) return String(rut || '').trim();
        return c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
    }

    function ejemploTrabajadores() {
        return [
            { rut: '16.450.112-3', nombre: 'Camila Andrea Soto Pérez', meses: 12, imponible: 9600000, cotizaciones: 1689600, impuesto: 0, mayorRetencion: 0, noGravada: 720000, exenta: 0, zonasExtremas: 0, prestamo: 0 },
            { rut: '14.920.330-K', nombre: 'Matías Ignacio Rojas Vidal', meses: 12, imponible: 21600000, cotizaciones: 3801600, impuesto: 412000, mayorRetencion: 0, noGravada: 960000, exenta: 0, zonasExtremas: 0, prestamo: 0 },
            { rut: '18.105.774-8', nombre: 'Valentina Paz Muñoz Araya', meses: 8, imponible: 6400000, cotizaciones: 1126400, impuesto: 0, mayorRetencion: 0, noGravada: 480000, exenta: 120000, zonasExtremas: 0, prestamo: 0 }
        ];
    }

    function partirLinea(linea, sep) {
        var out = [], cur = '', q = false;
        for (var i = 0; i < linea.length; i++) {
            var ch = linea.charAt(i);
            if (ch === '"') {
                if (q && linea.charAt(i + 1) === '"') { cur += '"'; i++; }
                else q = !q;
            } else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        out.push(cur.trim());
        return out;
    }

    function parsearPlanillaTexto(texto) {
        var limpio = String(texto == null ? '' : texto).replace(/^\uFEFF/, '').trim();
        if (!limpio) return [];
        var lineas = limpio.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        if (!lineas.length) return [];
        var sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
        var filas = lineas.map(function (l) { return partirLinea(l, sep); });
        return parsearFilas(filas);
    }

    function normHdr(s) {
        return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    function parsearFilas(filas) {
        if (!Array.isArray(filas) || !filas.length) return [];
        var idxH = 0;
        var hdr = (filas[0] || []).map(normHdr);
        var tieneCabecera = hdr.some(function (h) { return /rut|nombre|imponible|bruta|renta|impuesto/.test(h); });
        if (!tieneCabecera && filas.length > 1) {
            for (var i = 1; i < Math.min(filas.length, 6); i++) {
                var cand = (filas[i] || []).map(normHdr);
                if (cand.some(function (h) { return /rut/.test(h); }) && cand.some(function (h) { return /imponible|bruta|renta/.test(h); })) {
                    idxH = i; hdr = cand; tieneCabecera = true; break;
                }
            }
        }
        var col = function (rx, fallback) {
            if (!tieneCabecera) return fallback;
            for (var j = 0; j < hdr.length; j++) if (rx.test(hdr[j])) return j;
            return -1;
        };
        var cRut = col(/rut/, 0);
        var cNom = col(/nombre|trabajador|razon/, 1);
        var cMes = col(/mes/, 2);
        var cImp = col(/imponible|bruta|sueldo/, 3);
        var cCot = col(/cotiz|previs/, 4);
        var cIus = col(/impuesto|iusc/, 5);
        var cNoG = col(/no gravad|no imponible|colacion|movil/, 6);
        var cExe = col(/exent/, 7);
        var cPres = col(/prestamo|21\.?252/, -1);

        var start = tieneCabecera ? idxH + 1 : 0;
        var out = [];
        for (var r = start; r < filas.length; r++) {
            var f = filas[r];
            if (!f || !f.length) continue;
            var rutRaw = String(f[cRut] || '').trim();
            if (!limpiarRut(rutRaw) || /total/i.test(rutRaw)) continue;
            var imponible = cImp >= 0 ? entero(f[cImp]) : 0;
            var cotiz = cCot >= 0 ? entero(f[cCot]) : 0;
            if (!imponible && !cotiz) continue;
            out.push({
                rut: formatearRut(rutRaw),
                nombre: cNom >= 0 && f[cNom] ? String(f[cNom]).trim() : 'Trabajador',
                meses: cMes >= 0 ? Math.min(12, Math.max(1, entero(f[cMes]) || 12)) : 12,
                imponible: imponible,
                cotizaciones: cotiz,
                impuesto: cIus >= 0 ? entero(f[cIus]) : 0,
                mayorRetencion: 0,
                noGravada: cNoG >= 0 ? entero(f[cNoG]) : 0,
                exenta: cExe >= 0 ? entero(f[cExe]) : 0,
                zonasExtremas: 0,
                prestamo: cPres >= 0 ? entero(f[cPres]) : 0
            });
        }
        return out;
    }

    function calcularResumenDj1887(trabajadores, opciones) {
        var Renta = root.CLRenta || (typeof require === 'function' ? require('./contadores_renta.js') : null);
        if (!Renta) throw new Error('Falta CLRenta (js/contadores_renta.js).');
        var opts = opciones || {};
        var anioComercial = Number(opts.anioComercial) || 2026;
        var provisorio = anioComercial >= 2026; // AT 2027 sin factores SII hasta ene-2027
        var factor = Number(opts.factorActualizacion) > 0 ? Number(opts.factorActualizacion) : 1;

        var registros = (trabajadores || []).filter(function (t) { return limpiarRut(t.rut); }).map(function (t) {
            var imp = entero(t.imponible);
            var cot = entero(t.cotizaciones);
            var neta = Math.max(0, imp - cot);
            return {
                rut: formatearRut(t.rut),
                nombre: t.nombre || 'Trabajador',
                mesesCantidad: Math.min(12, Math.max(1, entero(t.meses) || 12)),
                sueldoImponible: imp,
                cotizacionesPrevisionales: cot,
                rentaNeta: neta,
                impuestoUnico: entero(t.impuesto),
                mayorRetencion: entero(t.mayorRetencion),
                rentaNoGravada: entero(t.noGravada),
                rentaExenta: entero(t.exenta),
                rebajaZonasExtremas: entero(t.zonasExtremas),
                prestamoLey21252: entero(t.prestamo),
                factorActualizacion: factor
            };
        });

        // Para AT 2026 usa generarDj1887(anioTributario: 2026); para comercial 2026 / AT 2027 genera simulacion provisoria factor 1,00 sin romper el bloqueo normativo de CLRenta.
        var dj = Renta.generarDj1887(registros, { anioTributario: 2026, factorActualizacion: factor });
        dj.anioComercial = anioComercial;
        dj.anioTributarioVisual = anioComercial + 1;
        dj.esProvisorio = provisorio;
        dj.avisoNormativo = provisorio
            ? 'Simulación provisoria AT 2027 (año comercial 2026) con factor ' + factor.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' sujeta a Circular SII de enero 2027 y Resolución DDJJ AT 2027. El préstamo Ley 21.252 (C33) es nominal.'
            : 'Simulación AT 2026 (año comercial 2025) con factor ' + factor.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' según Circular SII N° 5/2026.';
        return dj;
    }

    if (typeof window === 'undefined' || !doc || !doc.addEventListener) {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                ejemploTrabajadores: ejemploTrabajadores,
                parsearPlanillaTexto: parsearPlanillaTexto,
                parsearFilas: parsearFilas,
                calcularResumenDj1887: calcularResumenDj1887
            };
        }
        return;
    }

    var filasTrab = ejemploTrabajadores();
    var ultimoDj = null;

    function val(id) { var el = doc.getElementById(id); return el ? el.value : ''; }

    function renderTablaEditable() {
        var tbody = doc.getElementById('dj-input-body');
        if (!tbody) return;
        tbody.innerHTML = filasTrab.map(function (t, i) {
            return '<tr>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="rut" type="text" value="' + esc(t.rut) + '" class="w-28 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="nombre" type="text" value="' + esc(t.nombre) + '" class="w-44 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="meses" type="number" min="1" max="12" value="' + esc(t.meses) + '" class="w-16 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="imponible" type="number" min="0" value="' + esc(t.imponible) + '" class="w-28 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="cotizaciones" type="number" min="0" value="' + esc(t.cotizaciones) + '" class="w-28 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="impuesto" type="number" min="0" value="' + esc(t.impuesto) + '" class="w-24 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="noGravada" type="number" min="0" value="' + esc(t.noGravada) + '" class="w-24 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2"><input data-idx="' + i + '" data-campo="exenta" type="number" min="0" value="' + esc(t.exenta) + '" class="w-24 px-2 py-1.5 min-h-[44px] rounded-lg border border-slate-300 text-xs font-mono-num text-right"></td>' +
                '<td class="p-2 text-right"><button type="button" data-del="' + i + '" class="min-h-[44px] px-2.5 text-rose-700 font-bold text-xs cursor-pointer bg-transparent border-0" aria-label="Eliminar trabajador">Quitar</button></td>' +
            '</tr>';
        }).join('');

        tbody.querySelectorAll('input').forEach(function (inp) {
            inp.addEventListener('input', function () {
                var idx = Number(inp.getAttribute('data-idx'));
                var campo = inp.getAttribute('data-campo');
                if (!filasTrab[idx]) return;
                filasTrab[idx][campo] = (campo === 'rut' || campo === 'nombre') ? inp.value : entero(inp.value);
                calcularYMostrar();
            });
        });
        tbody.querySelectorAll('[data-del]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = Number(btn.getAttribute('data-del'));
                filasTrab.splice(idx, 1);
                renderTablaEditable();
                calcularYMostrar();
            });
        });
    }

    function calcularYMostrar() {
        var anioCom = Number(val('dj-anio-comercial')) || 2026;
        var factor = parseFloat(String(val('dj-factor') || '1').replace(',', '.')) || 1;
        var dj = calcularResumenDj1887(filasTrab, { anioComercial: anioCom, factorActualizacion: factor });
        ultimoDj = dj;

        var set = function (id, txt) { var el = doc.getElementById(id); if (el) el.textContent = txt; };
        set('dj-kpi-trab', String(dj.totales.trabajadores));
        set('dj-kpi-neta', pesos(dj.totales.rentaNeta));
        set('dj-kpi-imp', pesos(dj.totales.impuestoUnico));
        set('dj-kpi-nograv', pesos(dj.totales.rentaNoGravada));
        set('dj-aviso-normativo', dj.avisoNormativo);

        var outDj = doc.getElementById('dj-out-1887');
        if (outDj) {
            outDj.innerHTML = dj.filas.map(function (f) {
                return '<tr>' +
                    '<td class="p-2.5 font-mono-num text-xs whitespace-nowrap">' + esc(f.C2_rut) + '</td>' +
                    '<td class="p-2.5 text-xs">' + esc(f.nombre) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs font-bold">' + pesos(f.C3_rentaNeta) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(f.C4_impuestoUnico) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(f.C6_rentaNoGravada) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(f.C7_rentaExenta) + '</td>' +
                '</tr>';
            }).join('');
        }

        var outC6 = doc.getElementById('dj-out-cert6');
        if (outC6) {
            outC6.innerHTML = dj.certificadosN6.map(function (c) {
                return '<tr>' +
                    '<td class="p-2.5 font-mono-num text-xs whitespace-nowrap">' + esc(c.rut) + '</td>' +
                    '<td class="p-2.5 text-xs">' + esc(c.nombre) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(c.col2_sueldoImponible) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(c.col3_cotizacionesPrevisionales) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs font-bold">' + pesos(c.col11_rentaNetaActualizada) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(c.col12_impuestoActualizado) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(c.col14_rentaExentaActualizada) + '</td>' +
                    '<td class="p-2.5 text-right font-mono-num text-xs">' + pesos(c.col15_rentaNoGravadaActualizada) + '</td>' +
                '</tr>';
            }).join('');
        }
    }

    function descargarExcel() {
        if (!ultimoDj || !root.CLPymeExcel) return;
        var filas1887 = [
            ['Borrador Declaracion Jurada 1887 (AT ' + ultimoDj.anioTributarioVisual + ') - CalculoLaboral.cl'],
            [ultimoDj.avisoNormativo],
            [],
            ['RUT Trabajador (C2)', 'Nombre', 'Renta Neta Pagada (C3)', 'Impuesto Unico (C4)', 'Mayor Retencion (C5)', 'Renta No Gravada (C6)', 'Renta Exenta (C7)', 'Zonas Extremas (C8)', 'Prestamo Ley 21252 (C33)']
        ];
        ultimoDj.filas.forEach(function (f) {
            filas1887.push([f.C2_rut, f.nombre, f.C3_rentaNeta, f.C4_impuestoUnico, f.C5_mayorRetencion, f.C6_rentaNoGravada, f.C7_rentaExenta, f.C8_rebajaZonasExtremas, f.C33_prestamoLey21252]);
        });
        var filasCert6 = [
            ['Certificado N°6 SII (Columnas 7 Exenta y 8 No Gravada invertidas frente a DJ 1887)'],
            [],
            ['RUT', 'Nombre', 'Meses', 'Col 2 Sueldo Imponible', 'Col 3 Cotizaciones', 'Col 4 Renta Afecta', 'Col 5 Impuesto Unico', 'Col 7 Exenta', 'Col 8 No Gravada', 'Col 10 Factor', 'Col 11 Afecta Act.', 'Col 12 Impuesto Act.', 'Col 14 Exenta Act.', 'Col 15 No Gravada Act.']
        ];
        ultimoDj.certificadosN6.forEach(function (c) {
            filasCert6.push([c.rut, c.nombre, c.col1_meses, c.col2_sueldoImponible, c.col3_cotizacionesPrevisionales, c.col4_rentaNeta, c.col5_impuestoUnico, c.col7_rentaExenta, c.col8_rentaNoGravada, c.col10_factorActualizacion, c.col11_rentaNetaActualizada, c.col12_impuestoActualizado, c.col14_rentaExentaActualizada, c.col15_rentaNoGravadaActualizada]);
        });
        root.CLPymeExcel.descargarXlsx('Borrador_DJ1887_CertN6_AT' + ultimoDj.anioTributarioVisual + '.xlsx', [
            { nombre: 'DJ 1887', filas: filas1887, monedas: { 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true }, estilo: { tituloFilas: [0], encabezadoFila: 3 } },
            { nombre: 'Certificado N6', filas: filasCert6, monedas: { 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 10: true, 11: true, 12: true, 13: true }, estilo: { tituloFilas: [0], encabezadoFila: 2 } }
        ]);
    }

    doc.addEventListener('DOMContentLoaded', function () {
        renderTablaEditable();
        calcularYMostrar();

        var btnAdd = doc.getElementById('btn-dj-agregar');
        if (btnAdd) {
            btnAdd.addEventListener('click', function () {
                filasTrab.push({ rut: '', nombre: 'Nuevo trabajador', meses: 12, imponible: 6642636, cotizaciones: 1170000, impuesto: 0, mayorRetencion: 0, noGravada: 0, exenta: 0, zonasExtremas: 0, prestamo: 0 });
                renderTablaEditable();
                calcularYMostrar();
            });
        }

        var btnEj = doc.getElementById('btn-dj-ejemplo');
        if (btnEj) {
            btnEj.addEventListener('click', function () {
                filasTrab = ejemploTrabajadores();
                renderTablaEditable();
                calcularYMostrar();
            });
        }

        var fileInp = doc.getElementById('dj-file-import');
        if (fileInp) {
            fileInp.addEventListener('change', function () {
                var f = fileInp.files && fileInp.files[0];
                if (!f) return;
                if (/\.(xlsx|xls)$/i.test(f.name) && root.CLPymeExcel) {
                    f.arrayBuffer().then(function (buf) {
                        return root.CLPymeExcel.asegurarXlsx().then(function (XLSX) {
                            var parsed = parsearFilas(root.CLPymeExcel.filasDesdeBuffer(buf, XLSX));
                            if (parsed.length) { filasTrab = parsed; renderTablaEditable(); calcularYMostrar(); }
                            else alert('No reconocimos filas con RUT y Sueldo Imponible en el Excel.');
                        });
                    });
                } else {
                    var r = new FileReader();
                    r.onload = function () {
                        var parsed = parsearPlanillaTexto(String(r.result || ''));
                        if (parsed.length) { filasTrab = parsed; renderTablaEditable(); calcularYMostrar(); }
                        else alert('No reconocimos filas con RUT y Sueldo Imponible en el CSV.');
                    };
                    r.readAsText(f, 'ISO-8859-1');
                }
            });
        }

        ['dj-anio-comercial', 'dj-factor'].forEach(function (id) {
            var el = doc.getElementById(id);
            if (el) el.addEventListener('change', calcularYMostrar);
        });

        var btnXlsx = doc.getElementById('btn-dj-xlsx');
        if (btnXlsx) btnXlsx.addEventListener('click', descargarExcel);

        var t1 = doc.getElementById('tab-dj-1887');
        var t2 = doc.getElementById('tab-dj-cert6');
        var p1 = doc.getElementById('panel-dj-1887');
        var p2 = doc.getElementById('panel-dj-cert6');
        if (t1 && t2 && p1 && p2) {
            t1.addEventListener('click', function () {
                t1.setAttribute('aria-selected', 'true'); t2.setAttribute('aria-selected', 'false');
                t1.className = 'min-h-[44px] px-4 py-2 rounded-full text-xs font-bold bg-[#00382E] text-white cursor-pointer';
                t2.className = 'min-h-[44px] px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer';
                p1.classList.remove('hidden'); p2.classList.add('hidden');
            });
            t2.addEventListener('click', function () {
                t2.setAttribute('aria-selected', 'true'); t1.setAttribute('aria-selected', 'false');
                t2.className = 'min-h-[44px] px-4 py-2 rounded-full text-xs font-bold bg-[#00382E] text-white cursor-pointer';
                t1.className = 'min-h-[44px] px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-700 cursor-pointer';
                p2.classList.remove('hidden'); p1.classList.add('hidden');
            });
        }

        if (root.CLPrint) {
            root.CLPrint.conectarImpresion('btn-dj-print', function () {
                if (!ultimoDj) return { html: '' };
                var escFn = root.CLPrint.esc;
                var rowsHtml = ultimoDj.certificadosN6.map(function (c) {
                    return '<tr><td>' + escFn(c.rut) + '</td><td>' + escFn(c.nombre) + '</td><td class="v">' + escFn(pesos(c.col2_sueldoImponible)) + '</td><td class="v">' + escFn(pesos(c.col3_cotizacionesPrevisionales)) + '</td><td class="v">' + escFn(pesos(c.col11_rentaNetaActualizada)) + '</td><td class="v">' + escFn(pesos(c.col12_impuestoActualizado)) + '</td><td class="v">' + escFn(pesos(c.col14_rentaExentaActualizada)) + '</td><td class="v">' + escFn(pesos(c.col15_rentaNoGravadaActualizada)) + '</td></tr>';
                }).join('');
                return {
                    html: root.CLPrint.header({ doctype: 'Certificado N°6 y DJ 1887 (Borrador)', date: root.CLPrint.fechaHoy(), folio: root.CLPrint.folio('DJ1887') }) +
                        '<h1 class="clr-title">Resumen DJ 1887 y Certificado N°6 (AT ' + escFn(ultimoDj.anioTributarioVisual) + ')</h1>' +
                        '<p class="clr-sub">' + escFn(ultimoDj.avisoNormativo) + '</p>' +
                        '<table class="clr-t"><thead><tr><th>RUT</th><th>Nombre</th><th class="v">Imponible (2)</th><th class="v">Cotiz. (3)</th><th class="v">Renta Neta (11)</th><th class="v">IUSC (12)</th><th class="v">Exenta (14)</th><th class="v">No Grav. (15)</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
                        '<footer class="clr-foot">CálculoLaboral · calculolaboral.cl/calculadora-dj-1887-chile · Modelo referencial sin asesoría tributaria.</footer>'
                };
            });
        }
    });
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
