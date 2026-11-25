/*
 * CalculoLaboral · utilidades compartidas para generar y leer archivos Excel (.xlsx) reales (v2.0.0)
 * Funciona en el navegador (window.CLPymeExcel) y en Node (require).
 * Carga /assets/vendor/xlsx.full.min.js bajo demanda la primera vez que se necesita en el navegador.
 * Incluye motor OOXML de estilos, alineaciones, bordes, alturas, merges, inmovilización e impresión.
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

    function utf8Encode(str) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'utf8'));
        var bin = unescape(encodeURIComponent(str)), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    }

    function utf8Decode(bytes) {
        if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return decodeURIComponent(escape(bin));
    }

    function colLetra(c) {
        var s = '', n = c + 1;
        while (n > 0) {
            var m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    function aConjunto(arr) {
        var map = {};
        if (Array.isArray(arr)) arr.forEach(function (v) { map[v] = true; });
        else if (typeof arr === 'number') map[arr] = true;
        return map;
    }

    function celdasEnMerge(merges) {
        var map = {};
        (merges || []).forEach(function (m) {
            if (!m || !m.s || !m.e) return;
            for (var r = m.s.r; r <= m.e.r; r++) {
                for (var c = m.s.c; c <= m.e.c; c++) {
                    map[r + ':' + c] = m;
                }
            }
        });
        return map;
    }

    function dedupMerges(merges) {
        var vistos = {}, out = [];
        (merges || []).forEach(function (m) {
            if (!m || !m.s || !m.e) return;
            if (m.s.r === m.e.r && m.s.c === m.e.c) return;
            var k = m.s.r + ':' + m.s.c + '-' + m.e.r + ':' + m.e.c;
            if (!vistos[k]) { vistos[k] = true; out.push(m); }
        });
        return out;
    }

    function anchosColumnas(filas, anchosExplicitos, optEstilo) {
        var est = optEstilo || {};
        var ignorar = Object.assign({}, aConjunto(est.tituloFilas), aConjunto(est.subtituloFilas), aConjunto(est.notasFilas), aConjunto(est.seccionFilas));
        var metas = aConjunto(est.metaFilas);
        var encIdx = typeof est.encabezadoFila === 'number' ? est.encabezadoFila : -1;
        var grpSet = aConjunto(est.grupoFilas);

        var maxCols = 0;
        (filas || []).forEach(function (f) { if (f && f.length > maxCols) maxCols = f.length; });
        var largos = new Array(maxCols);
        for (var c = 0; c < maxCols; c++) largos[c] = 10;

        (filas || []).forEach(function (f, r) {
            if (!f || ignorar[r] || grpSet[r]) return;
            if (metas[r] && f.slice(1).every(function (x) { return x == null || x === ''; })) return;
            if (f.length === 1 && maxCols > 1 && r !== encIdx) return;
            if (f.length > 1 && f[0] != null && f[0] !== '' && f.slice(1).every(function (x) { return x == null || x === ''; }) && r !== encIdx && maxCols > 2) return;

            for (var c = 0; c < f.length; c++) {
                var v = f[c];
                if (v == null || v === '') continue;
                var txt;
                if (typeof v === 'number' && isFinite(v)) {
                    txt = Number.isInteger(v) ? ('$ ' + Math.abs(v).toLocaleString('es-CL') + (v < 0 ? '-' : '')) : v.toFixed(2);
                } else {
                    txt = String(v);
                }
                if (r === encIdx) {
                    // Los encabezados se envuelven en 2 líneas si son largos para no deformar columnas numéricas
                    var palabras = txt.split(/\s+/);
                    var maxPal = palabras.reduce(function (m, p) { return Math.max(m, p.length); }, 0);
                    var anchoHdr = txt.length <= 16 ? txt.length : Math.max(maxPal + 2, Math.ceil(txt.length / 2) + 2);
                    if (anchoHdr > largos[c]) largos[c] = anchoHdr;
                } else {
                    var lineas = txt.split(/\r?\n/);
                    var maxL = lineas.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
                    if (maxL > largos[c]) largos[c] = maxL;
                }
            }
        });

        return largos.map(function (n, idx) {
            var exp = anchosExplicitos && anchosExplicitos[idx];
            if (typeof exp === 'number' && exp > 0) return { wch: exp };
            if (exp && typeof exp.wch === 'number') return { wch: exp.wch };
            return { wch: Math.min(Math.max(n + 3, 11), 44) };
        });
    }

    // ---------- Motor OOXML de estilos (XLSX.CFB) ----------
    // Soporta paleta por tema activo de la Suite (slate, editorial, cobalto) y verde marca (#00382E) por defecto para /app.
    var PALETAS = {
        verde: {
            primary: 'FF00382E',
            dark: 'FF00261F',
            group: 'FF0B4F41',
            headerBorder: 'FF1B5E50',
            soft: 'FFEDF5F2',
            totalText: 'FF00382E',
            subText: 'FFD1FAE5',
            zebra: 'FFF8FAF9',
            secBg: 'FFE2E8F0',
            subBg: 'FFF1F5F9',
            border: 'FFCBD5E1',
            secBorder: 'FF94A3B8'
        },
        slate: {
            primary: 'FF0F172A',
            dark: 'FF1E293B',
            group: 'FF3730A3',
            headerBorder: 'FF4F46E5',
            soft: 'FFEEF2FF',
            totalText: 'FF1E1B4B',
            subText: 'FFC7D2FE',
            zebra: 'FFF8FAFC',
            secBg: 'FFE2E8F0',
            subBg: 'FFF1F5F9',
            border: 'FFCBD5E1',
            secBorder: 'FF94A3B8'
        },
        editorial: {
            primary: 'FF7C2D12',
            dark: 'FF9A3412',
            group: 'FFC2410C',
            headerBorder: 'FFEA580C',
            soft: 'FFFFF7ED',
            totalText: 'FF7C2D12',
            subText: 'FFFED7AA',
            zebra: 'FFFAF8F5',
            secBg: 'FFF5F0EB',
            subBg: 'FFF3ECE4',
            border: 'FFD6D3D1',
            secBorder: 'FFA8A29E'
        },
        cobalto: {
            primary: 'FF1E3A8A',
            dark: 'FF172554',
            group: 'FF1D4ED8',
            headerBorder: 'FF2563EB',
            soft: 'FFEFF6FF',
            totalText: 'FF1E3A8A',
            subText: 'FFDBEAFE',
            zebra: 'FFF8FAFC',
            secBg: 'FFE2E8F0',
            subBg: 'FFF1F5F9',
            border: 'FFCBD5E1',
            secBorder: 'FF94A3B8'
        }
    };

    function resolverTema(explicito) {
        if (explicito && PALETAS[explicito]) return explicito;
        if (typeof document !== 'undefined') {
            var panel = document.querySelector('#pm-panel.syn-theme, [data-syn-theme]');
            if (panel) {
                var attr = panel.getAttribute('data-syn-theme');
                if (attr && PALETAS[attr]) return attr;
                try {
                    var ls = window.localStorage && window.localStorage.getItem('cl_suite_theme');
                    if (ls && PALETAS[ls]) return ls;
                } catch (e) {}
                return 'slate';
            }
        }
        return 'verde';
    }

    var NUM_FMTS = {
        gen: 0,
        text: 49,
        int: 3,
        money: 164,
        dec: 165
    };

    var ROLES = {
        titulo:     { font: 1, fill: 2, border: 2, defAlign: 'left',   wrap: 1, vAlign: 'center' },
        subtitulo:  { font: 2, fill: 3, border: 0, defAlign: 'left',   wrap: 1, vAlign: 'center' },
        meta:       { font: 3, fill: 4, border: 4, defAlign: 'left',   wrap: 1, vAlign: 'center' },
        grupo:      { font: 8, fill: 6, border: 2, defAlign: 'center', wrap: 1, vAlign: 'center' },
        encabezado: { font: 4, fill: 2, border: 2, defAlign: 'center', wrap: 1, vAlign: 'center' },
        dato:       { font: 0, fill: 9, border: 1, defAlign: 'left',   wrap: 0, vAlign: 'center' },
        zebra:      { font: 0, fill: 5, border: 1, defAlign: 'left',   wrap: 0, vAlign: 'center' },
        subtotal:   { font: 7, fill: 10, border: 5, defAlign: 'left',  wrap: 0, vAlign: 'center' },
        total:      { font: 5, fill: 4, border: 3, defAlign: 'left',   wrap: 0, vAlign: 'center' },
        seccion:    { font: 7, fill: 7, border: 5, defAlign: 'left',   wrap: 1, vAlign: 'center' },
        nota:       { font: 6, fill: 0, border: 0, defAlign: 'left',   wrap: 1, vAlign: 'center' },
        aviso:      { font: 6, fill: 8, border: 4, defAlign: 'left',   wrap: 1, vAlign: 'center' }
    };

    function crearRegistroEstilos(temaNombre) {
        var pal = PALETAS[resolverTema(temaNombre)] || PALETAS.verde;
        var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
        var indice = { 'default': 0 };

        function obtener(role, align, fmt, wrapExtra) {
            var r = ROLES[role] || ROLES.dato;
            var h = align || r.defAlign;
            var f = fmt || 'gen';
            var w = wrapExtra ? 1 : r.wrap;
            var clave = role + '|' + h + '|' + f + '|' + w;
            if (indice[clave] !== undefined) return indice[clave];
            var numId = NUM_FMTS[f] !== undefined ? NUM_FMTS[f] : 0;
            var xf = '<xf numFmtId="' + numId + '" fontId="' + r.font + '" fillId="' + r.fill + '" borderId="' + r.border + '" xfId="0"' +
                ' applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
                '<alignment horizontal="' + h + '" vertical="' + r.vAlign + '"' + (w ? ' wrapText="1"' : '') + '/>' +
                '</xf>';
            var idx = xfs.length;
            xfs.push(xf);
            indice[clave] = idx;
            return idx;
        }

        function xml() {
            return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
                '<numFmts count="2">' +
                '<numFmt numFmtId="164" formatCode="&quot;$ &quot;#,##0;-&quot;$ &quot;#,##0;&quot;$ 0&quot;"/>' +
                '<numFmt numFmtId="165" formatCode="#,##0.00"/>' +
                '</numFmts>' +
                '<fonts count="9">' +
                '<font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><sz val="9.5"/><color rgb="' + pal.subText + '"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="10"/><color rgb="' + pal.totalText + '"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="10.5"/><color rgb="' + pal.totalText + '"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><i/><sz val="9"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>' +
                '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
                '</fonts>' +
                '<fills count="11">' +
                '<fill><patternFill patternType="none"/></fill>' +
                '<fill><patternFill patternType="gray125"/></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.primary + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.dark + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.soft + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.zebra + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.group + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.secBg + '"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>' +
                '<fill><patternFill patternType="solid"><fgColor rgb="' + pal.subBg + '"/></patternFill></fill>' +
                '</fills>' +
                '<borders count="6">' +
                '<border><left/><right/><top/><bottom/><diagonal/></border>' +
                '<border><left style="thin"><color rgb="' + pal.border + '"/></left><right style="thin"><color rgb="' + pal.border + '"/></right><top style="thin"><color rgb="' + pal.border + '"/></top><bottom style="thin"><color rgb="' + pal.border + '"/></bottom><diagonal/></border>' +
                '<border><left style="thin"><color rgb="' + pal.headerBorder + '"/></left><right style="thin"><color rgb="' + pal.headerBorder + '"/></right><top style="thin"><color rgb="' + pal.primary + '"/></top><bottom style="medium"><color rgb="' + pal.headerBorder + '"/></bottom><diagonal/></border>' +
                '<border><left style="thin"><color rgb="' + pal.border + '"/></left><right style="thin"><color rgb="' + pal.border + '"/></right><top style="medium"><color rgb="' + pal.primary + '"/></top><bottom style="double"><color rgb="' + pal.primary + '"/></bottom><diagonal/></border>' +
                '<border><left style="thin"><color rgb="' + pal.border + '"/></left><right style="thin"><color rgb="' + pal.border + '"/></right><top style="thin"><color rgb="' + pal.border + '"/></top><bottom style="thin"><color rgb="' + pal.border + '"/></bottom><diagonal/></border>' +
                '<border><left style="thin"><color rgb="' + pal.secBorder + '"/></left><right style="thin"><color rgb="' + pal.secBorder + '"/></right><top style="thin"><color rgb="' + pal.secBorder + '"/></top><bottom style="thin"><color rgb="' + pal.secBorder + '"/></bottom><diagonal/></border>' +
                '</borders>' +
                '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
                '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>' +
                '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
                '</styleSheet>';
        }

        return { obtener: obtener, xml: xml };
    }

    function inferirEstiloPorDefecto(h, filas, maxCols) {
        var est = Object.assign({}, (h && h.estilo) || {});
        if (h && h.estilo) return est;
        // Sin descriptor explícito: si la fila 0 es la cabecera de tabla (plantilla), estilizamos fila 0
        if (!filas || !filas.length) return est;
        est.encabezadoFila = 0;
        est.congelarFila = 1;
        est.zebra = true;
        return est;
    }

    function calcularPlanHoja(h, filas, maxCols, regEstilos, colsWch) {
        var est = inferirEstiloPorDefecto(h, filas, maxCols);
        var textos = (h && h.textos) || {};
        var monedas = (h && h.monedas) || {};
        var decimales = (h && h.decimales) || {};
        var alinear = (h && h.alinear) || {};
        var fmtEntero = !(h && h.formatoEntero === false);

        var sTitulo = aConjunto(est.tituloFilas);
        var sSub = aConjunto(est.subtituloFilas);
        var sMeta = aConjunto(est.metaFilas);
        var sGrupo = aConjunto(est.grupoFilas);
        var encRow = typeof est.encabezadoFila === 'number' ? est.encabezadoFila : -1;
        var sSubtot = aConjunto(est.subtotalFilas);
        var sTot = aConjunto(est.totalesFilas);
        var sSec = aConjunto(est.seccionFilas);
        var sNotas = aConjunto(est.notasFilas);
        var sAvisos = aConjunto(est.avisosFilas);
        var sEntrada = aConjunto(est.filasEntrada);

        // Construir merges completos
        var merges = (est.merges || []).slice();
        if (maxCols > 1) {
            filas.forEach(function (f, r) {
                if (sTitulo[r] || sSub[r] || sNotas[r] || sAvisos[r] || sSec[r]) {
                    merges.push({ s: { r: r, c: 0 }, e: { r: r, c: maxCols - 1 } });
                } else if (sMeta[r] && (!f || f.slice(1).every(function (x) { return x == null || x === ''; }))) {
                    merges.push({ s: { r: r, c: 0 }, e: { r: r, c: maxCols - 1 } });
                }
            });
        }
        merges = dedupMerges(merges);
        var mergeMap = celdasEnMerge(merges);

        var anchoTotalChars = colsWch.reduce(function (s, o) { return s + (o.wch || 12); }, 0);
        var cellStyleAt = {};
        var alturas = {};
        var tablaEmpezada = false;
        var dataIdx = 0;

        for (var r = 0; r < filas.length; r++) {
            var fila = filas[r] || [];
            var esVacia = fila.every(function (x) { return x == null || x === ''; });
            if (r === encRow) { tablaEmpezada = true; dataIdx = 0; }

            var rolFila = null;
            if (sTitulo[r]) rolFila = 'titulo';
            else if (sSub[r]) rolFila = 'subtitulo';
            else if (sMeta[r]) rolFila = 'meta';
            else if (sGrupo[r]) rolFila = 'grupo';
            else if (r === encRow) rolFila = 'encabezado';
            else if (sTot[r]) rolFila = 'total';
            else if (sSubtot[r]) rolFila = 'subtotal';
            else if (sSec[r]) rolFila = 'seccion';
            else if (sNotas[r]) rolFila = 'nota';
            else if (sAvisos[r]) rolFila = 'aviso';
            else if (sEntrada[r] || (!esVacia && (tablaEmpezada || r > encRow))) {
                rolFila = (est.zebra !== false && dataIdx % 2 === 1) ? 'zebra' : 'dato';
                dataIdx++;
            }

            // Altura de fila
            var hExplicit = est.alturas && est.alturas[r];
            if (typeof hExplicit === 'number') {
                alturas[r] = hExplicit;
            } else if (rolFila === 'titulo') {
                alturas[r] = 30;
            } else if (rolFila === 'subtitulo') {
                var txtSub = String(fila[0] || '');
                var lSub = Math.max(1, Math.ceil(txtSub.length / Math.max(45, anchoTotalChars * 0.9)));
                alturas[r] = Math.max(22, lSub * 14 + 8);
            } else if (rolFila === 'meta') {
                alturas[r] = 22;
            } else if (rolFila === 'grupo') {
                alturas[r] = 24;
            } else if (rolFila === 'encabezado') {
                var maxHdrLines = fila.reduce(function (mx, v, c) {
                    var s = String(v == null ? '' : v);
                    var w = (colsWch[c] && colsWch[c].wch) || 12;
                    return Math.max(mx, Math.ceil(s.length / Math.max(8, w - 2)));
                }, 1);
                alturas[r] = Math.min(46, Math.max(26, maxHdrLines * 14 + 10));
            } else if (rolFila === 'total' || rolFila === 'subtotal') {
                alturas[r] = rolFila === 'total' ? 23 : 21;
            } else if (rolFila === 'seccion') {
                alturas[r] = 22;
            } else if (rolFila === 'nota' || rolFila === 'aviso') {
                var txtNota = String(fila[0] || '');
                var lNota = Math.max(1, Math.ceil(txtNota.length / Math.max(50, anchoTotalChars * 0.92)));
                alturas[r] = Math.max(20, lNota * 14 + 6);
            } else if (esVacia && !rolFila) {
                alturas[r] = 9;
            } else if (sEntrada[r] && esVacia) {
                alturas[r] = 21;
            } else {
                var maxLineasDato = fila.reduce(function (mx, v, ci) {
                    if (v == null || v === '') return mx;
                    var s = String(v);
                    var enM = !!mergeMap[r + ':' + ci];
                    var cap = Math.max(8, ((colsWch[ci] && colsWch[ci].wch) || 12) - 2);
                    var ls = s.split(/\r?\n/).reduce(function (acc, linea) {
                        return acc + (enM || typeof v !== 'string' ? 1 : Math.max(1, Math.ceil(linea.length / cap)));
                    }, 0);
                    return Math.max(mx, ls);
                }, 1);
                alturas[r] = maxLineasDato > 1 ? Math.min(72, maxLineasDato * 14 + 6) : 20;
            }

            if (!rolFila) continue;

            for (var c = 0; c < maxCols; c++) {
                var val = fila[c];
                var enMerge = !!mergeMap[r + ':' + c];
                if (rolFila === 'nota' && !enMerge && (val == null || val === '') && c > 0) continue;

                var fmt = 'gen';
                var align = alinear[c];
                if (rolFila === 'titulo') {
                    align = est.centrarTitulo ? 'center' : 'left';
                } else if (rolFila === 'subtitulo' || rolFila === 'meta' || rolFila === 'seccion' || rolFila === 'nota' || rolFila === 'aviso') {
                    align = 'left';
                } else if (rolFila === 'grupo') {
                    align = 'center';
                } else if (rolFila === 'encabezado') {
                    align = align || ((monedas[c] || decimales[c] || textos[c]) ? (monedas[c] || decimales[c] ? 'right' : 'center') : 'left');
                    if (est.centrarEncabezados) align = 'center';
                } else {
                    var esNum = typeof val === 'number' && isFinite(val) && !textos[c];
                    if (textos[c]) {
                        fmt = 'text';
                        align = align || 'center';
                    } else if (esNum) {
                        if (monedas === true || monedas[c]) fmt = 'money';
                        else if (decimales[c]) fmt = 'dec';
                        else if (fmtEntero && Number.isInteger(val)) fmt = 'int';
                        align = align || 'right';
                    } else if ((val == null || val === '' || rolFila === 'total') && (monedas === true || monedas[c])) {
                        fmt = 'money';
                        align = align || 'right';
                    } else if ((val == null || val === '' || rolFila === 'total') && decimales[c]) {
                        fmt = 'dec';
                        align = align || 'right';
                    } else {
                        align = align || 'left';
                    }
                }
                var colW = (colsWch[c] && colsWch[c].wch) || 12;
                var wrapDato = typeof val === 'string' && (val.indexOf('\n') >= 0 || (!enMerge && val.length > Math.max(8, colW - 2)));
                cellStyleAt[colLetra(c) + (r + 1)] = regEstilos.obtener(rolFila, align, fmt, wrapDato);
            }
        }

        // Última fila de datos para AutoFilter
        var lastDataRow = Math.max(encRow + 1, filas.length);
        for (var rr = filas.length - 1; rr > encRow; rr--) {
            if (!sNotas[rr] && !sAvisos[rr] && !sTot[rr] && filas[rr] && filas[rr].some(function (x) { return x != null && x !== ''; })) {
                lastDataRow = rr + 1;
                break;
            }
        }

        return {
            est: est,
            merges: merges,
            alturas: alturas,
            cellStyleAt: cellStyleAt,
            encRow: encRow,
            lastDataRow: lastDataRow,
            maxCols: maxCols
        };
    }

    function parchearHojaXml(xml, plan) {
        var est = plan.est;
        var maxCols = Math.max(1, plan.maxCols);
        var lastCol = colLetra(maxCols - 1);

        // 1) Injectar sheetPr (fitToPage="1") antes de <dimension
        var sheetPr = '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
        if (/<sheetPr[\s>]/.test(xml)) {
            xml = xml.replace(/<sheetPr[\s\S]*?<\/sheetPr>/, sheetPr);
        } else {
            xml = xml.replace('<dimension', sheetPr + '<dimension');
        }

        // 2) Reemplazar sheetViews (gridlines + pane congelado)
        var freezeR = typeof est.congelarFila === 'number' ? est.congelarFila : 0;
        var freezeC = typeof est.congelarCol === 'number' ? est.congelarCol : 0;
        var paneXml = '';
        if (freezeR > 0 || freezeC > 0) {
            var topLeft = colLetra(freezeC) + (freezeR + 1);
            var activePane = freezeR > 0 && freezeC > 0 ? 'bottomRight' : (freezeR > 0 ? 'bottomLeft' : 'topRight');
            paneXml = '<pane' + (freezeC > 0 ? ' xSplit="' + freezeC + '"' : '') +
                (freezeR > 0 ? ' ySplit="' + freezeR + '"' : '') +
                ' topLeftCell="' + topLeft + '" activePane="' + activePane + '" state="frozen"/>';
        }
        var svXml = '<sheetViews><sheetView showGridLines="1" workbookViewId="0">' + paneXml + '</sheetView></sheetViews>';
        xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, svXml);

        // 3) Actualizar altura de filas y atributos s="..." de cada celda
        xml = xml.replace(/<row\s+r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, function (m, rStr, attrs, inner) {
            var r0 = parseInt(rStr, 10) - 1;
            var ht = plan.alturas[r0];
            var cleanAttrs = attrs.replace(/\s*(ht|customHeight)="[^"]*"/g, '');
            var htAttr = ht ? (' ht="' + ht + '" customHeight="1"') : '';
            var newInner = inner.replace(/<c\s+r="([A-Z]+\d+)"([^>]*?)(\/?)>/g, function (cm, addr, cattrs, selfClose) {
                var sIdx = plan.cellStyleAt[addr];
                var stripped = cattrs.replace(/\s*s="\d+"/, '');
                if (sIdx === undefined) return '<c r="' + addr + '"' + stripped + selfClose + '>';
                return '<c r="' + addr + '" s="' + sIdx + '"' + stripped + selfClose + '>';
            });
            return '<row r="' + rStr + '"' + cleanAttrs + htAttr + '>' + newInner + '</row>';
        });

        // 4) AutoFilter (después de </sheetData>, antes de <mergeCells / <ignoredErrors / </worksheet>)
        var afterData = '';
        if (est.autoFiltro && plan.encRow >= 0 && plan.lastDataRow > plan.encRow + 1) {
            afterData += '<autoFilter ref="A' + (plan.encRow + 1) + ':' + lastCol + plan.lastDataRow + '"/>';
        }

        // 5) PageMargins + PageSetup (Carta, fitToWidth=1, fitToHeight=0)
        var ori = est.orientacion || (maxCols >= 6 ? 'landscape' : 'portrait');
        var printXml = '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.25" footer="0.25"/>' +
            '<pageSetup paperSize="1" orientation="' + ori + '" fitToWidth="1" fitToHeight="0"/>';

        if (afterData) {
            xml = xml.replace('</sheetData>', '</sheetData>' + afterData);
        }
        if (xml.indexOf('<ignoredErrors') >= 0) {
            xml = xml.replace('<ignoredErrors', printXml + '<ignoredErrors');
        } else {
            xml = xml.replace('</worksheet>', printXml + '</worksheet>');
        }

        return xml;
    }

    /**
     * Construye un libro .xlsx real (Uint8Array) a partir de [{ nombre, filas, anchos?, textos?, monedas?, decimales?, alinear?, formatoEntero?, estilo? }].
     */
    function construirLibro(hojas, xlsxMod) {
        var XLSX = resolverXlsx(xlsxMod);
        if (!XLSX) throw new Error('Falta SheetJS (XLSX) para generar el archivo .xlsx.');
        var wb = XLSX.utils.book_new();
        var lista = Array.isArray(hojas) ? hojas : [hojas];
        var temaExplicito = (lista[0] && lista[0].tema) || (lista[0] && lista[0].estilo && lista[0].estilo.tema) || null;
        var regEstilos = crearRegistroEstilos(temaExplicito);
        var planes = [];

        lista.forEach(function (h, idx) {
            var filas = (h && h.filas) || [];
            var textos = (h && h.textos) || {};
            var fmtEntero = !(h && h.formatoEntero === false);
            var maxCols = 0;
            filas.forEach(function (f) { if (f && f.length > maxCols) maxCols = f.length; });

            var colsWch = anchosColumnas(filas, h && h.anchos, h && h.estilo);
            var plan = calcularPlanHoja(h || {}, filas, maxCols, regEstilos, colsWch);
            planes.push(plan);

            var ws = {};
            for (var r = 0; r < filas.length; r++) {
                var fila = filas[r] || [];
                for (var c = 0; c < maxCols; c++) {
                    var val = c < fila.length ? fila[c] : undefined;
                    var addr = XLSX.utils.encode_cell({ r: r, c: c });
                    if (val === null || val === undefined || val === '') {
                        if (plan.cellStyleAt[addr] !== undefined) {
                            ws[addr] = { t: 's', v: '' };
                            if (textos[c]) ws[addr].z = '@';
                        }
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
            ws['!cols'] = colsWch;
            if (plan.merges && plan.merges.length) ws['!merges'] = plan.merges;
            XLSX.utils.book_append_sheet(wb, ws, nombreHoja((h && h.nombre) || ('Hoja' + (idx + 1))));
        });

        var rawOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var rawBytes = rawOut instanceof Uint8Array ? rawOut : new Uint8Array(rawOut);

        if (XLSX.CFB && typeof XLSX.CFB.read === 'function') {
            var cfb = XLSX.CFB.read(rawBytes, { type: 'array' });
            var stylesEntry = XLSX.CFB.find(cfb, '/xl/styles.xml');
            if (stylesEntry) {
                var sBytes = utf8Encode(regEstilos.xml());
                stylesEntry.content = sBytes;
                stylesEntry.size = sBytes.length;
            }
            planes.forEach(function (plan, idx) {
                var shEntry = XLSX.CFB.find(cfb, '/xl/worksheets/sheet' + (idx + 1) + '.xml');
                if (!shEntry) return;
                var xml = utf8Decode(shEntry.content);
                var patchedXml = parchearHojaXml(xml, plan);
                var pBytes = utf8Encode(patchedXml);
                shEntry.content = pBytes;
                shEntry.size = pBytes.length;
            });
            var patched = XLSX.CFB.write(cfb, { type: 'array', fileType: 'zip' });
            return patched instanceof Uint8Array ? patched : new Uint8Array(patched);
        }

        return rawBytes;
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
        resolverTema: resolverTema,
        version: '2.1.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeExcel = api;
})(typeof window !== 'undefined' ? window : this);
