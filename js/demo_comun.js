/*
 * CálculoLaboral · utilidades compartidas de la demo para estudios contables.
 * Sin dependencias: parseo de números y fechas chilenas, lectura de Excel/CSV,
 * encabezado de los documentos y cambio de pestaña.
 */
(function (root) {
    'use strict';

    var state = { logo: null };

    function norm(s) {
        return String(s == null ? '' : s)
            .trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function money(n) {
        var v = Math.round(Number(n) || 0);
        return '$' + v.toLocaleString('es-CL');
    }

    function num(n, dec) {
        var v = Number(n) || 0;
        return v.toLocaleString('es-CL', { maximumFractionDigits: dec == null ? 2 : dec });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // "1.450.000", "1,450,000", "1450000,50", "$ 1.450.000" -> número
    function parseNumber(v) {
        if (v == null || v === '') return 0;
        if (typeof v === 'number') return v;
        var s = String(v).replace(/[^\d.,\-]/g, '');
        if (!s) return 0;

        var lastComma = s.lastIndexOf(',');
        var lastDot = s.lastIndexOf('.');
        var dec = '';

        if (lastComma > -1 && lastDot > -1) {
            dec = lastComma > lastDot ? ',' : '.';
        } else if (lastComma > -1) {
            dec = /^\d{1,3}(,\d{3})+$/.test(s) ? '' : ',';
        } else if (lastDot > -1) {
            dec = /^\d{1,3}(\.\d{3})+$/.test(s) ? '' : '.';
        }

        if (dec) {
            s = s.split(dec === ',' ? '.' : ',').join('');
            s = s.replace(dec, '.');
        } else {
            s = s.replace(/[.,]/g, '');
        }

        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function isoFromDate(d) {
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }

    function parseDate(v) {
        if (v == null || v === '') return '';
        if (v instanceof Date && !isNaN(v)) {
            return isoFromDate(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
        }
        if (typeof v === 'number' && v > 20000 && v < 80000) {
            return isoFromDate(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000));
        }
        var s = String(v).trim();
        var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
        m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (m) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
        var d = new Date(s);
        if (!isNaN(d)) return isoFromDate(d);
        return '';
    }

    function fechaCorta(iso) {
        if (!iso) return '—';
        var p = String(iso).split('-');
        return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
    }

    function hoy() {
        var d = new Date();
        return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    // ------------------------------------------------------------- archivos

    // Lee la primera hoja y devuelve las filas como objetos { encabezado: valor }.
    function leerArchivo(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            var esCsv = /\.csv$/i.test(file.name);

            reader.onload = function (e) {
                try {
                    var wb = esCsv
                        ? XLSX.read(e.target.result, { type: 'string', raw: false })
                        : XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
                    var sheet = wb.Sheets[wb.SheetNames[0]];
                    var rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
                    resolve({ nombre: file.name, rows: rows });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = function () { reject(new Error('No pudimos leer el archivo.')); };

            if (esCsv) reader.readAsText(file, 'UTF-8');
            else reader.readAsArrayBuffer(file);
        });
    }

    function mapaColumnas(row, alias) {
        var normed = {};
        Object.keys(row).forEach(function (k) { normed[norm(k)] = row[k]; });
        var out = {};
        Object.keys(alias).forEach(function (campo) {
            var clave = alias[campo].filter(function (a) {
                return normed[a] !== undefined && normed[a] !== '';
            })[0];
            out[campo] = clave ? normed[clave] : '';
        });
        return out;
    }

    function descargar(blob, nombre) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }

    function descargarCsv(nombre, encabezados, filas) {
        var lineas = [encabezados.join(';')].concat(filas.map(function (f) {
            return f.map(function (v) {
                return String(v == null ? '' : v).replace(/;/g, ',');
            }).join(';');
        }));
        descargar(new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nombre);
    }

    // ------------------------------------------------------------- estudio

    function estudio() {
        var input = document.getElementById('study-name');
        return {
            nombre: (input && input.value.trim()) || 'Estudio contable',
            logo: state.logo
        };
    }

    function encabezado(titulo, subtitulo) {
        var e = estudio();
        var izq = e.logo
            ? '<img src="' + e.logo + '" alt="">'
            : '<div class="print-estudio">' + esc(e.nombre) + '</div>';
        return '<div class="print-head">' +
            '<div>' + izq + '</div>' +
            '<div class="print-meta">' + (e.logo ? esc(e.nombre) + '<br>' : '') + 'Emitido el ' + hoy() + '</div>' +
            '</div>' +
            '<div class="print-title">' + esc(titulo) + '</div>' +
            '<div class="print-sub">' + subtitulo + '</div>';
    }

    var NOTA = '<div class="print-note">Documento de trabajo generado con CálculoLaboral. Los montos son referenciales, ' +
        'se calcularon con los indicadores del período y deben ser revisados por el profesional responsable antes de su firma. ' +
        'CálculoLaboral no presta asesoría legal.</div>';

    function imprimir(paginas) {
        document.getElementById('print-area').innerHTML = paginas.join('');
        window.print();
    }

    function avisar(texto) {
        var caja = document.createElement('div');
        caja.textContent = texto;
        caja.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;' +
            'background:#00382E;color:#fff;padding:10px 16px;border-radius:10px;font:600 13px/1.4 Geist,system-ui;box-shadow:0 8px 24px rgba(0,0,0,.18)';
        document.body.appendChild(caja);
        setTimeout(function () { caja.remove(); }, 3200);
    }

    // ----------------------------------------------------------------- boot

    document.addEventListener('DOMContentLoaded', function () {
        var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="modo"]'));
        var panes = {
            finiquitos: [document.getElementById('pane-finiquitos'), document.getElementById('results-fin')],
            liquidaciones: [document.getElementById('pane-liquidaciones'), document.getElementById('results-liq')]
        };

        function aplicar(modo) {
            Object.keys(panes).forEach(function (k) {
                panes[k].forEach(function (el) {
                    if (!el) return;
                    if (k === modo) el.removeAttribute('hidden');
                    else el.setAttribute('hidden', '');
                });
            });
            document.dispatchEvent(new CustomEvent('demo:modo', { detail: modo }));
        }

        radios.forEach(function (r) {
            r.addEventListener('change', function () { if (r.checked) aplicar(r.value); });
        });
        var activo = radios.filter(function (r) { return r.checked; })[0];
        aplicar(activo ? activo.value : 'finiquitos');

        // Logo
        var logoInput = document.getElementById('logo-input');
        var btnLogo = document.getElementById('btn-logo');
        if (btnLogo && logoInput) {
            btnLogo.addEventListener('click', function () { logoInput.click(); });
            logoInput.addEventListener('change', function () {
                var f = logoInput.files[0];
                if (!f) return;
                if (f.size > 400 * 1024) { avisar('El logo supera los 400 KB. Usa una imagen más liviana.'); return; }
                var fr = new FileReader();
                fr.onload = function (e) {
                    state.logo = e.target.result;
                    document.getElementById('logo-preview').innerHTML = '<img src="' + state.logo + '" alt="Logo del estudio">';
                    document.dispatchEvent(new CustomEvent('demo:logo'));
                };
                fr.readAsDataURL(f);
            });
        }

        var nombre = document.getElementById('study-name');
        if (nombre) nombre.addEventListener('input', function () {
            document.dispatchEvent(new CustomEvent('demo:logo'));
        });
    });

    root.DemoCL = {
        norm: norm, money: money, num: num, esc: esc,
        parseNumber: parseNumber, parseDate: parseDate,
        fechaCorta: fechaCorta, hoy: hoy,
        leerArchivo: leerArchivo, mapaColumnas: mapaColumnas,
        descargar: descargar, descargarCsv: descargarCsv,
        estudio: estudio, encabezado: encabezado, NOTA: NOTA,
        imprimir: imprimir, avisar: avisar
    };
})(window);
