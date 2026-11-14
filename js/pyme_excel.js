/*
 * CalculoLaboral · utilidades compartidas para generar y leer archivos Excel (.xlsx) reales (v1.0.0)
 * Funciona en el navegador (window.CLPymeExcel) y en Node (require).
 * Carga /assets/vendor/xlsx.full.min.js bajo demanda la primera vez que se necesita en el navegador.
 */
(function (root) {
    'use strict';

    var MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var cargaPendiente = null;

    function resolverXlsx(explicito) {
        if (explicito) return explicito;
        if (root.XLSX) return root.XLSX;
        if (typeof module !== 'undefined' && module.exports) return require('../assets/vendor/xlsx.full.min.js');
        return null;
    }

    function asegurarXlsx() {
        var mod = resolverXlsx();
        if (mod) return Promise.resolve(mod);
        if (cargaPendiente) return cargaPendiente;
        cargaPendiente = new Promise(function (res, rej) {
            var s = document.createElement('script');
            s.src = '/assets/vendor/xlsx.full.min.js';
            s.onload = function () {
                if (root.XLSX) res(root.XLSX);
                else { cargaPendiente = null; rej(new Error('No se pudo inicializar el lector Excel.')); }
            };
            s.onerror = function () { cargaPendiente = null; rej(new Error('No pudimos cargar el módulo de Excel (.xlsx).')); };
            document.head.appendChild(s);
        });
        return cargaPendiente;
    }

    function nombreHoja(nombre) {
        var limpio = String(nombre || 'Hoja1').replace(/[\\/?*[\]:]/g, ' ').trim();
        return (limpio || 'Hoja1').slice(0, 31);
    }

    function anchosColumnas(filas, anchosExplicitos) {
        var maxCols = 0;
        (filas || []).forEach(function (f) { if (f && f.length > maxCols) maxCols = f.length; });
        var largos = new Array(maxCols);
        for (var c = 0; c < maxCols; c++) largos[c] = 10;

        (filas || []).forEach(function (f) {
            if (!f) return;
            for (var c = 0; c < f.length; c++) {
                var v = f[c];
                if (v == null || v === '') continue;
                var txt = typeof v === 'number' && Number.isInteger(v) ? v.toLocaleString('es-CL') : String(v);
                // Las notas largas en filas iniciales o finales no deben ensanchar en exceso las columnas de datos
                if (f.length === 1 || (c === 0 && f.slice(1).every(function (x) { return x == null || x === ''; }))) continue;
                if (txt.length > largos[c]) largos[c] = txt.length;
            }
        });

        return largos.map(function (n, idx) {
            var exp = anchosExplicitos && anchosExplicitos[idx];
            if (typeof exp === 'number' && exp > 0) return { wch: exp };
            if (exp && typeof exp.wch === 'number') return { wch: exp.wch };
            return { wch: Math.min(Math.max(n + 3, 10), 46) };
        });
    }

    /**
     * Construye un libro .xlsx real (Uint8Array) a partir de [{ nombre, filas, anchos?, textos?, formatoEntero? }].
     * - Números finitos -> celda numérica real ('n'), con formato '#,##0' si es entero (salvo formatoEntero === false).
     * - Textos -> celda de texto ('s') con formato '@' para preservar siempre ceros a la izquierda (RUT, cuentas, códigos).
     */
    function construirLibro(hojas, xlsxMod) {
        var XLSX = resolverXlsx(xlsxMod);
        if (!XLSX) throw new Error('Falta SheetJS (XLSX) para generar el archivo .xlsx.');
        var wb = XLSX.utils.book_new();
        var lista = Array.isArray(hojas) ? hojas : [hojas];

        lista.forEach(function (h, idx) {
            var filas = (h && h.filas) || [];
            var textos = (h && h.textos) || {};
            var fmtEntero = !(h && h.formatoEntero === false);
            var maxCols = 0;
            filas.forEach(function (f) { if (f && f.length > maxCols) maxCols = f.length; });

            var ws = {};
            for (var r = 0; r < filas.length; r++) {
                var fila = filas[r] || [];
                for (var c = 0; c < fila.length; c++) {
                    var val = fila[c];
                    var addr = XLSX.utils.encode_cell({ r: r, c: c });
                    if (val === null || val === undefined || val === '') {
                        if (textos[c] && r > 0) ws[addr] = { t: 's', v: '', z: '@' };
                        continue;
                    }
                    if (typeof val === 'number' && isFinite(val) && !textos[c]) {
                        ws[addr] = { t: 'n', v: val };
                        if (fmtEntero && Number.isInteger(val)) ws[addr].z = '#,##0';
                    } else {
                        ws[addr] = { t: 's', v: String(val), z: '@' };
                    }
                }
            }
            if (filas.length && maxCols) {
                ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: maxCols - 1 } });
            } else {
                ws['!ref'] = 'A1';
            }
            ws['!cols'] = anchosColumnas(filas, h && h.anchos);
            XLSX.utils.book_append_sheet(wb, ws, nombreHoja((h && h.nombre) || ('Hoja' + (idx + 1))));
        });

        var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return out instanceof Uint8Array ? out : new Uint8Array(out);
    }

    function filasDesdeBuffer(buffer, xlsxMod) {
        var XLSX = resolverXlsx(xlsxMod);
        if (!XLSX) throw new Error('Falta SheetJS (XLSX) para leer el archivo .xlsx.');
        var data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        var wb = XLSX.read(data, { type: 'array', cellDates: true });
        var nombre = wb.SheetNames && wb.SheetNames[0];
        if (!nombre) return [];
        var ws = wb.Sheets[nombre];
        var filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        return filas.filter(function (f) {
            return Array.isArray(f) && f.some(function (x) { return x !== null && x !== undefined && String(x).trim() !== ''; });
        });
    }

    function descargarBytes(nombreArchivo, bytes) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: MIME_XLSX }));
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }

    function descargarXlsx(nombreArchivo, hojas) {
        return asegurarXlsx().then(function (XLSX) {
            var bytes = construirLibro(hojas, XLSX);
            descargarBytes(nombreArchivo, bytes);
            return bytes;
        });
    }

    var api = {
        MIME_XLSX: MIME_XLSX,
        asegurarXlsx: asegurarXlsx,
        construirLibro: construirLibro,
        filasDesdeBuffer: filasDesdeBuffer,
        descargarBytes: descargarBytes,
        descargarXlsx: descargarXlsx,
        version: '1.0.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeExcel = api;
})(typeof window !== 'undefined' ? window : this);
