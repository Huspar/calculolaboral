/**
 * Convierte documentos HTML (#notary-document-body, contratos, anexos, Ley 21.719, cartas) en un .docx real.
 *
 * Genera WordprocessingML completo con estilos CalculoLaboral, encabezados/pies de página con paginación
 * (Página X de Y), incrustación de logotipo (PNG/JPEG data URL), tablas estilizadas y empaquetado ZIP sin
 * dependencias externas (funciona tanto en navegador como en Node).
 *
 * Marcas que lee del HTML:
 *   data-docx="firmas" / .dc-firmas -> tabla de columnas sin bordes con línea de firma en cada una
 *   data-docx="recuadro" / .dc-recibi -> recuadro con fondo suave, borde acentuado y keepTogether
 *   data-docx="linea"    -> línea de firma suelta (notario / ratificación)
 */
(function (root) {
    'use strict';

    // Carta (8,5" × 11"), márgenes de 2,5 cm (en twips)
    const PAGE = { w: 12240, h: 15840, margin: 1418 };
    const CONTENT_W = PAGE.w - PAGE.margin * 2; // 9404 twips
    const COLOR_BRAND = '00382E';
    const COLOR_MINT = 'EDF5F2';
    const COLOR_ZEBRA = 'F8FAF9';
    const COLOR_BORDER = 'CBD5E1';
    const COLOR_MUTED = '64748B';
    const COLOR_INK = '0F172A';

    function xmlEsc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function hasClass(el, name) {
        return !!(el && el.classList && typeof el.classList.contains === 'function' && el.classList.contains(name));
    }

    function attr(el, name) {
        return (el && typeof el.getAttribute === 'function' && el.getAttribute(name)) || '';
    }

    function styleHas(el, re) {
        return re.test(attr(el, 'style'));
    }

    function alignOf(el, fallback) {
        const st = attr(el, 'style');
        const m = /text-align\s*:\s*(left|right|center|justify)/i.exec(st);
        if (m) return m[1].toLowerCase() === 'justify' ? 'both' : m[1].toLowerCase();
        if (hasClass(el, 'text-center') || hasClass(el, 'dc-titulo')) return 'center';
        if (hasClass(el, 'text-right') || hasClass(el, 'dc-lugar')) return 'right';
        if (hasClass(el, 'text-left') || hasClass(el, 'dc-pie') || hasClass(el, 'dc-recibi') || hasClass(el, 'dc-copia')) return 'left';
        return fallback;
    }

    const BLOCK_TAGS = { p: 1, div: 1, table: 1, ul: 1, ol: 1, li: 1, h1: 1, h2: 1, h3: 1, h4: 1, header: 1, footer: 1, section: 1, article: 1 };

    function hasBlockChild(el) {
        return Array.from(el.childNodes || []).some(c => {
            if (c.nodeType !== 1) return false;
            const t = c.tagName.toLowerCase();
            return !!BLOCK_TAGS[t] || (t === 'br' && styleHas(c, /page-break-before\s*:\s*always/i));
        });
    }

    // ---------- Mini-parser HTML para Node cuando no hay DOM ----------

    function htmlUnescape(str) {
        return String(str)
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
            .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }

    function parseAttrs(raw) {
        const map = {};
        if (!raw) return map;
        const re = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
        let m;
        while ((m = re.exec(raw))) {
            map[m[1].toLowerCase()] = htmlUnescape(m[2] ?? m[3] ?? m[4] ?? '');
        }
        return map;
    }

    function makeMiniNode(tagName, attrs) {
        const clsSet = new Set(String((attrs && attrs.class) || '').split(/\s+/).filter(Boolean));
        const node = {
            nodeType: 1,
            tagName: tagName.toUpperCase(),
            childNodes: [],
            children: [],
            parentNode: null,
            classList: { contains: (c) => clsSet.has(c) },
            getAttribute: (k) => (attrs && Object.prototype.hasOwnProperty.call(attrs, k.toLowerCase()) ? attrs[k.toLowerCase()] : null),
            closest: function (sel) {
                const want = sel.toLowerCase();
                let cur = this.parentNode;
                while (cur && cur.nodeType === 1) {
                    if (cur.tagName.toLowerCase() === want) return cur;
                    cur = cur.parentNode;
                }
                return null;
            },
            querySelectorAll: function (sel) {
                const want = sel.toLowerCase();
                const res = [];
                (function walk(n) {
                    (n.childNodes || []).forEach(c => {
                        if (c.nodeType === 1) {
                            if (c.tagName.toLowerCase() === want) res.push(c);
                            walk(c);
                        }
                    });
                })(this);
                return res;
            },
            querySelector: function (sel) {
                return this.querySelectorAll(sel)[0] || null;
            }
        };
        Object.defineProperty(node, 'textContent', {
            get: function () {
                return this.childNodes.map(c => c.textContent || '').join('');
            }
        });
        return node;
    }

    function parseHtmlToMiniDom(html) {
        const rootNode = makeMiniNode('div', {});
        const stack = [rootNode];
        const VOID = { br: 1, hr: 1, img: 1, meta: 1, link: 1, input: 1 };
        const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
        let m;
        while ((m = re.exec(html))) {
            const top = stack[stack.length - 1];
            if (m[3] !== undefined) {
                top.childNodes.push({ nodeType: 3, textContent: htmlUnescape(m[3]) });
            } else if (m[1]) {
                const full = m[0];
                const tag = m[1].toLowerCase();
                if (full.charAt(1) === '/') {
                    for (let i = stack.length - 1; i > 0; i--) {
                        if (stack[i].tagName.toLowerCase() === tag) {
                            stack.length = i;
                            break;
                        }
                    }
                } else {
                    const el = makeMiniNode(tag, parseAttrs(m[2]));
                    el.parentNode = top;
                    top.childNodes.push(el);
                    top.children.push(el);
                    if (!VOID[tag] && !/\/\s*>$/.test(full)) {
                        stack.push(el);
                    }
                }
            }
        }
        return rootNode;
    }

    // ---------- Imágenes / Logotipo (PNG y JPEG base64) ----------

    function base64ToBytes(b64) {
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return new Uint8Array(Buffer.from(b64, 'base64'));
        }
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function bytesToBase64(bytes) {
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(bytes).toString('base64');
        }
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }

    function readImageDimensions(bytes, ext) {
        if (ext === 'png' && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
            const w = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
            const h = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
            if (w > 0 && h > 0) return { w, h };
        }
        if (ext === 'jpg' && bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
            let i = 2;
            while (i + 8 < bytes.length) {
                if (bytes[i] !== 0xFF) break;
                const marker = bytes[i + 1];
                const len = (bytes[i + 2] << 8) | bytes[i + 3];
                if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    const h = (bytes[i + 5] << 8) | bytes[i + 6];
                    const w = (bytes[i + 7] << 8) | bytes[i + 8];
                    if (w > 0 && h > 0) return { w, h };
                    break;
                }
                if (len < 2) break;
                i += 2 + len;
            }
        }
        return { w: 240, h: 80 };
    }

    function parseLogoDataUrl(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return null;
        const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
        if (!m) return null;
        const ext = m[1].toLowerCase() === 'png' ? 'png' : 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        try {
            const bytes = base64ToBytes(m[2].replace(/\s+/g, ''));
            if (bytes.length < 32 || bytes.length > 2 * 1024 * 1024) return null;
            const px = readImageDimensions(bytes, ext);
            const maxH = 431800; // 34 pt en EMUs
            const maxW = 1905000; // 150 pt en EMUs
            let cy = maxH;
            let cx = Math.round(cy * (px.w / px.h));
            if (cx > maxW) {
                cx = maxW;
                cy = Math.round(cx * (px.h / px.w));
            }
            return { ext, mime, bytes, cx: Math.max(127000, cx), cy: Math.max(127000, cy), file: `word/media/logo1.${ext}`, relTarget: `media/logo1.${ext}` };
        } catch (e) {
            return null;
        }
    }

    function findFirstLogoSrc(node) {
        let found = '';
        (function walk(n) {
            if (found || !n) return;
            if (n.nodeType === 1 && n.tagName && n.tagName.toLowerCase() === 'img') {
                const src = attr(n, 'src');
                if (/^data:image\/(png|jpeg|jpg);base64,/i.test(src)) {
                    found = src;
                    return;
                }
            }
            Array.from(n.childNodes || []).forEach(walk);
        })(node);
        return found;
    }

    function drawingXml(logo, relId) {
        return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
            `<wp:extent cx="${logo.cx}" cy="${logo.cy}"/>` +
            `<wp:docPr id="1" name="Logo Empresa"/>` +
            `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
            `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
            `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:nvPicPr><pic:cNvPr id="1" name="Logo Empresa"/><pic:cNvPicPr/></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logo.cx}" cy="${logo.cy}"/></a:xfrm>` +
            `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
            `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }

    // ---------- Paleta / tema del documento ----------

    function hasMetaClass(node) {
        let hit = false;
        (function walk(n) {
            if (hit || !n || n.nodeType !== 1) return;
            if (hasClass(n, 'meta') || hasClass(n, 'cl-doc-moderno')) { hit = true; return; }
            Array.from(n.childNodes || []).forEach(walk);
        })(node);
        return hit;
    }

    function detectTheme(rootEl, options) {
        const modern = options.estilo === 'moderno' || (options.estilo !== 'legal' && hasMetaClass(rootEl));
        if (modern) {
            return {
                modern: true,
                fontBody: options.fuente || 'Calibri',
                fontTable: options.fuenteTabla || 'Calibri',
                headingColor: COLOR_BRAND,
                hdrFill: COLOR_BRAND,
                hdrText: 'FFFFFF',
                hdrBorder: COLOR_BRAND,
                totalFill: COLOR_MINT,
                totalText: COLOR_BRAND,
                zebraFill: COLOR_ZEBRA,
                borderClr: COLOR_BORDER,
                boxFill: COLOR_ZEBRA,
                boxAccent: COLOR_BRAND
            };
        }
        return {
            modern: false,
            fontBody: options.fuente || 'Times New Roman',
            fontTable: options.fuenteTabla || 'Arial',
            headingColor: '',
            hdrFill: COLOR_MINT,
            hdrText: COLOR_BRAND,
            hdrBorder: COLOR_BRAND,
            totalFill: COLOR_MINT,
            totalText: COLOR_BRAND,
            zebraFill: COLOR_ZEBRA,
            borderClr: COLOR_BORDER,
            boxFill: COLOR_ZEBRA,
            boxAccent: COLOR_BRAND
        };
    }

    // ---------- runs ----------

    function runXml(text, fmt) {
        if (!text) return '';
        const rpr = [
            `<w:rFonts w:ascii="${fmt.font}" w:hAnsi="${fmt.font}" w:cs="${fmt.font}"/>`,
            fmt.bold ? '<w:b/><w:bCs/>' : '',
            fmt.italic ? '<w:i/><w:iCs/>' : '',
            fmt.caps ? '<w:caps/>' : '',
            fmt.color ? `<w:color w:val="${fmt.color}"/>` : '',
            `<w:sz w:val="${fmt.size}"/><w:szCs w:val="${fmt.size}"/>`,
            fmt.underline ? '<w:u w:val="single"/>' : ''
        ].join('');
        return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
    }

    function inlineRuns(node, fmt, out) {
        Array.from(node.childNodes || []).forEach(ch => {
            if (ch.nodeType === 3) {
                const t = ch.textContent.replace(/\s+/g, ' ');
                if (t) out.push({ text: t, fmt });
            } else if (ch.nodeType === 1) {
                const tag = ch.tagName.toLowerCase();
                if (tag === 'img' || tag === 'script' || tag === 'style' || hasClass(ch, 'lqd-marca')) return;
                const f = Object.assign({}, fmt);
                if (tag === 'strong' || tag === 'b' || hasClass(ch, 'font-bold') || hasClass(ch, 'font-semibold') || styleHas(ch, /font-weight\s*:\s*(bold|[6-9]00)/i)) f.bold = true;
                if (tag === 'em' || tag === 'i' || hasClass(ch, 'italic') || styleHas(ch, /font-style\s*:\s*italic/i)) f.italic = true;
                if (tag === 'u' || styleHas(ch, /text-decoration\s*:\s*underline/i)) f.underline = true;
                if (hasClass(ch, 'uppercase') || styleHas(ch, /text-transform\s*:\s*uppercase/i)) f.caps = true;
                if (tag === 'small') f.size = Math.min(f.size || 22, 17);
                if (tag === 'br') { out.push({ br: true }); return; }
                inlineRuns(ch, f, out);
            }
        });
        return out;
    }

    function runsXml(parts) {
        while (parts.length && parts[0].text !== undefined && !parts[0].text.trim()) parts.shift();
        while (parts.length && parts[parts.length - 1].text !== undefined && !parts[parts.length - 1].text.trim()) parts.pop();
        if (parts.length && parts[0].text) parts[0] = Object.assign({}, parts[0], { text: parts[0].text.replace(/^\s+/, '') });
        const last = parts.length - 1;
        if (last >= 0 && parts[last].text) parts[last] = Object.assign({}, parts[last], { text: parts[last].text.replace(/\s+$/, '') });
        return parts.map(p => p.br ? '<w:r><w:br/></w:r>' : runXml(p.text, p.fmt)).join('');
    }

    // ---------- párrafos ----------

    function paraXml(runs, opt) {
        opt = opt || {};
        let pbdr = '';
        if (opt.callout) {
            pbdr = `<w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="${COLOR_BORDER}"/>` +
                `<w:left w:val="single" w:sz="18" w:space="10" w:color="${COLOR_BRAND}"/>` +
                `<w:bottom w:val="single" w:sz="4" w:space="6" w:color="${COLOR_BORDER}"/>` +
                `<w:right w:val="single" w:sz="4" w:space="6" w:color="${COLOR_BORDER}"/></w:pBdr>`;
        } else if (opt.border) {
            pbdr = '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="6" w:color="${COLOR_BORDER}"/>`).join('') + '</w:pBdr>';
        } else if (opt.bottomLine || opt.topLine) {
            pbdr = '<w:pBdr>' +
                (opt.topLine ? `<w:top w:val="single" w:sz="${opt.lineSz || 6}" w:space="4" w:color="${opt.lineColor || '000000'}"/>` : '') +
                (opt.bottomLine ? `<w:bottom w:val="single" w:sz="${opt.lineSz || 6}" w:space="4" w:color="${opt.lineColor || '000000'}"/>` : '') +
                '</w:pBdr>';
        }
        const ppr = [
            opt.styleId ? `<w:pStyle w:val="${opt.styleId}"/>` : '',
            opt.keepNext ? '<w:keepNext/>' : '',
            opt.keepTogether ? '<w:keepTogether/>' : '',
            opt.tabs || '',
            pbdr,
            opt.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${opt.shade}"/>` : '',
            `<w:spacing w:before="${opt.before || 0}" w:after="${opt.after === undefined ? 120 : opt.after}" w:line="${opt.line || 276}" w:lineRule="auto"/>`,
            opt.indent ? `<w:ind w:left="${opt.indent}" w:right="${opt.indent}"/>` : '',
            `<w:jc w:val="${opt.align || 'both'}"/>`
        ].join('');
        return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
    }

    function baseFmt(el, font, size, color) {
        return {
            font,
            size,
            color: color || '',
            bold: hasClass(el, 'font-bold') || hasClass(el, 'font-semibold') || styleHas(el, /font-weight\s*:\s*(bold|[6-9]00)/i),
            italic: hasClass(el, 'italic') || styleHas(el, /font-style\s*:\s*italic/i),
            caps: hasClass(el, 'uppercase') || styleHas(el, /text-transform\s*:\s*uppercase/i)
        };
    }

    // ---------- tablas ----------

    const CELL_BORDERS_NONE = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tcBorders>';

    function cellBordersXml(theme, isHeader, isTotal) {
        const c = theme.borderClr;
        const b = theme.hdrBorder;
        if (isHeader) {
            return `<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="${b}"/>` +
                `<w:left w:val="single" w:sz="4" w:space="0" w:color="${c}"/>` +
                `<w:bottom w:val="single" w:sz="10" w:space="0" w:color="${b}"/>` +
                `<w:right w:val="single" w:sz="4" w:space="0" w:color="${c}"/></w:tcBorders>`;
        }
        if (isTotal) {
            return `<w:tcBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="${b}"/>` +
                `<w:left w:val="single" w:sz="4" w:space="0" w:color="${c}"/>` +
                `<w:bottom w:val="double" w:sz="6" w:space="0" w:color="${b}"/>` +
                `<w:right w:val="single" w:sz="4" w:space="0" w:color="${c}"/></w:tcBorders>`;
        }
        return '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${c}"/>`).join('') + '</w:tcBorders>';
    }

    function tableWidths(table, trs) {
        let maxCols = 0;
        trs.forEach(tr => {
            let cols = 0;
            Array.from(tr.children || []).forEach(cell => {
                cols += Math.max(1, parseInt(attr(cell, 'colspan') || '1', 10) || 1);
            });
            if (cols > maxCols) maxCols = cols;
        });
        maxCols = maxCols || 2;
        if (maxCols === 2 && !styleHas(table, /border\s*:\s*(none|0)/i)) {
            const amountW = 2400;
            return [CONTENT_W - amountW, amountW];
        }
        const firstRow = trs[0] ? Array.from(trs[0].children || []) : [];
        if (firstRow.length === maxCols) {
            const pcts = firstRow.map(c => {
                const m = /width\s*:\s*(\d+(?:\.\d+)?)%/i.exec(attr(c, 'style'));
                return m ? parseFloat(m[1]) : 0;
            });
            const sum = pcts.reduce((a, b) => a + b, 0);
            if (sum >= 90 && pcts.every(p => p > 0)) {
                const widths = pcts.map(p => Math.round((p / sum) * CONTENT_W));
                const diff = CONTENT_W - widths.reduce((a, b) => a + b, 0);
                widths[0] += diff;
                return widths;
            }
        }
        const colW = Math.floor(CONTENT_W / maxCols);
        const widths = Array.from({ length: maxCols }, () => colW);
        widths[0] += CONTENT_W - colW * maxCols;
        return widths;
    }

    function cellBodyXml(cell, fmt, align, topLineFirst) {
        const subBlocks = Array.from(cell.children || []).filter(c => BLOCK_TAGS[c.tagName.toLowerCase()]);
        if (subBlocks.length) {
            return subBlocks.map((b, idx) => {
                const bFmt = Object.assign({}, fmt, baseFmt(b, fmt.font, fmt.size, fmt.color));
                const hasTop = (idx === 0 && topLineFirst) || styleHas(b, /border-top\s*:/i);
                const bAlign = alignOf(b, align);
                const innerBlocks = Array.from(b.children || []).filter(c => BLOCK_TAGS[c.tagName.toLowerCase()]);
                if (innerBlocks.length) {
                    return innerBlocks.map((ib, j) => paraXml(
                        runsXml(inlineRuns(ib, Object.assign({}, bFmt, baseFmt(ib, fmt.font, fmt.size, fmt.color)), [])),
                        { align: alignOf(ib, bAlign), after: 20, before: 0, line: 240, topLine: j === 0 && hasTop }
                    )).join('');
                }
                return paraXml(runsXml(inlineRuns(b, bFmt, [])), { align: bAlign, after: 20, before: 0, line: 240, topLine: hasTop });
            }).join('');
        }
        return paraXml(runsXml(inlineRuns(cell, fmt, [])), { align, after: 0, before: 0, line: 240, topLine: topLineFirst });
    }

    function tableXml(table, ctx) {
        const theme = ctx.theme;
        const trs = Array.from(table.querySelectorAll('tr'));
        const widths = tableWidths(table, trs);
        const borderless = styleHas(table, /border\s*:\s*(none|0)/i);
        const isDcTabla = hasClass(table, 'dc-tabla');
        let rows = '';
        let dataRowIdx = 0;

        trs.forEach(tr => {
            const parentTag = tr.parentNode && tr.parentNode.tagName ? tr.parentNode.tagName.toLowerCase() : '';
            const header = parentTag === 'thead' || !!(tr.closest && tr.closest('thead'));
            const footer = parentTag === 'tfoot' || !!(tr.closest && tr.closest('tfoot'));
            const total = footer || hasClass(tr, 'font-semibold') || hasClass(tr, 'font-bold');
            const isDataRow = !borderless && !header && !total;
            const zebra = isDataRow && (dataRowIdx % 2 === 1);
            if (isDataRow) dataRowIdx++;

            let cells = '';
            let colIdx = 0;
            Array.from(tr.children || []).forEach(cell => {
                const cAlign = alignOf(cell, (hasClass(cell, 'text-right') || (isDcTabla && colIdx > 0)) ? 'right' : (borderless ? 'center' : 'left'));
                const span = Math.max(1, parseInt(attr(cell, 'colspan') || '1', 10) || 1);
                const cellW = span > 1 ? (widths.slice(colIdx, colIdx + span).reduce((a, b) => a + b, 0) || CONTENT_W) : (widths[colIdx] || widths[widths.length - 1]);
                colIdx += span;
                const isTh = cell.tagName.toLowerCase() === 'th';
                const rowHdr = header || isTh;
                const color = borderless ? '' : (rowHdr ? theme.hdrText : (total ? theme.totalText : COLOR_INK));
                const fmt = {
                    font: borderless ? theme.fontBody : theme.fontTable,
                    size: borderless ? 19 : 18,
                    color,
                    bold: !borderless && (rowHdr || total) || styleHas(cell, /font-weight\s*:\s*bold/i),
                    italic: hasClass(cell, 'italic')
                };
                const noCellBorder = borderless || styleHas(cell, /border\s*:\s*(none|0)/i);
                const shade = noCellBorder ? '' : (rowHdr ? theme.hdrFill : (total ? theme.totalFill : (zebra ? theme.zebraFill : '')));
                const borders = noCellBorder ? CELL_BORDERS_NONE : cellBordersXml(theme, rowHdr, total);
                cells += `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>` +
                    (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
                    borders +
                    (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '') +
                    `<w:vAlign w:val="${borderless ? 'top' : 'center'}"/></w:tcPr>` +
                    cellBodyXml(cell, fmt, cAlign, false) +
                    '</w:tc>';
            });
            rows += `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells}</w:tr>`;
        });

        const tblBorders = borderless
            ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>'
            : '';
        return (borderless ? paraXml('', { after: 160 }) : '') +
            '<w:tbl><w:tblPr><w:tblW w:w="' + CONTENT_W + '" w:type="dxa"/>' +
            '<w:tblLayout w:type="fixed"/>' + tblBorders +
            '<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/>' +
            '<w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>` +
            paraXml('', { after: 80 });
    }

    // Bloque .dc-firmas (Asistente Pyme): columnas sin bordes con línea sobre el nombre y <small> abajo
    function dcFirmasXml(grid, ctx) {
        const font = ctx.theme.fontBody;
        const cols = Array.from(grid.children || []);
        if (!cols.length) return '';
        const w = Math.floor(CONTENT_W / cols.length);
        let cells = '';
        cols.forEach(col => {
            let inner = paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 });
            const smalls = [];
            const nameParts = [];
            Array.from(col.childNodes || []).forEach(ch => {
                if (ch.nodeType === 3 && ch.textContent.trim()) nameParts.push({ text: ch.textContent.trim(), fmt: { font, size: 19, bold: true } });
                else if (ch.nodeType === 1 && ch.tagName.toLowerCase() === 'small') smalls.push(ch);
            });
            inner += paraXml(runsXml(nameParts.length ? nameParts : [{ text: '', fmt: { font, size: 19 } }]), { align: 'center', before: 160, after: 20, line: 240, topLine: true, indent: 300 });
            smalls.forEach(sm => {
                inner += paraXml(runsXml(inlineRuns(sm, { font, size: 17, color: COLOR_MUTED }, [])), { align: 'center', after: 0, line: 240, indent: 300 });
            });
            cells += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
        });
        const none = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
        return paraXml('', { after: 180 }) +
            `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${none}</w:tblPr>` +
            `<w:tblGrid>${cols.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
            `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr></w:tbl>` +
            paraXml('', { after: 120 });
    }

    // Bloque de firmas: dos columnas sin bordes; cada una con espacio para firmar, línea y datos
    function firmasXml(grid, ctx) {
        const font = ctx.theme.fontBody;
        const cols = Array.from(grid.children || []);
        const w = Math.floor(CONTENT_W / Math.max(1, cols.length));
        let cells = '';
        cols.forEach(col => {
            let inner = paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 });
            let first = true;
            Array.from(col.querySelectorAll('p')).forEach(p => {
                const fmt = baseFmt(p, font, 19);
                inner += paraXml(runsXml(inlineRuns(p, fmt, [])), { align: 'center', before: first ? 180 : 0, after: 20, line: 240, topLine: first, indent: 450 });
                first = false;
            });
            cells += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
        });
        const none = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
        return paraXml('', { after: 200 }) +
            `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${none}</w:tblPr>` +
            `<w:tblGrid>${cols.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
            `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr></w:tbl>` +
            paraXml('', { after: 120 });
    }

    // ---------- recorrido de bloques ----------

    function headingXml(el, ctx, size, align, caps, before, after, styleId) {
        const t = ctx.theme;
        const fmt = Object.assign({ font: t.fontBody, size, bold: true, caps: !!caps, color: t.headingColor }, baseFmt(el, t.fontBody, size, t.headingColor));
        return paraXml(runsXml(inlineRuns(el, fmt, [])), {
            styleId,
            align: alignOf(el, align),
            before: before || 0,
            after: after === undefined ? 90 : after,
            bottomLine: t.modern && styleId === 'Heading1',
            lineColor: COLOR_BRAND,
            lineSz: 8,
            keepNext: true
        });
    }

    function listXml(el, ordered, ctx) {
        const font = ctx.theme.fontBody;
        const out = [];
        let idx = 1;
        Array.from(el.childNodes || []).forEach(li => {
            if (li.nodeType !== 1 || li.tagName.toLowerCase() !== 'li') return;
            const prefix = ordered ? (idx++) + '. ' : '• ';
            const fmt = baseFmt(li, font, ctx.small ? 19 : 21);
            const parts = [{ text: prefix, fmt: Object.assign({}, fmt, { bold: ordered || ctx.theme.modern, color: ctx.theme.modern ? COLOR_BRAND : '' }) }];
            inlineRuns(li, fmt, parts);
            out.push(paraXml(runsXml(parts), { align: 'both', indent: 360, after: 70 }));
        });
        return out.join('');
    }

    function headXml(el, ctx) {
        const font = ctx.theme.fontBody;
        const parts = [];
        const div = el.querySelector && el.querySelector('div');
        const src = div || el;
        Array.from(src.childNodes || []).forEach(ch => {
            if (ch.nodeType !== 1 && ch.nodeType !== 3) return;
            if (ch.nodeType === 1 && ch.tagName.toLowerCase() === 'img') return;
            const txt = (ch.textContent || '').trim();
            if (!txt) return;
            if (parts.length) parts.push({ text: '  ·  ', fmt: { font, size: 18, color: COLOR_MUTED } });
            const isStrong = ch.nodeType === 1 && ch.tagName.toLowerCase() === 'strong';
            parts.push({ text: txt, fmt: { font, size: isStrong ? 21 : 18, bold: isStrong, color: isStrong ? COLOR_BRAND : COLOR_MUTED } });
        });

        const logo = ctx.logo && !ctx.logoPlaced ? ctx.logo : null;
        if (!parts.length && !logo) return '';
        if (logo) {
            ctx.logoPlaced = true;
            const wImg = 2300;
            const wTxt = CONTENT_W - wImg;
            const none = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('') +
                `</w:tblBorders><w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="${COLOR_BRAND}"/></w:tcBorders>`;
            const imgPara = `<w:p><w:pPr><w:spacing w:before="0" w:after="40"/><w:jc w:val="left"/></w:pPr>${drawingXml(logo, ctx.logoRelId)}</w:p>`;
            const txtPara = parts.length
                ? paraXml(runsXml(parts), { align: 'right', before: 40, after: 40 })
                : paraXml('', { after: 40 });
            const row = `<w:tr><w:tc><w:tcPr><w:tcW w:w="${wImg}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${imgPara}</w:tc>` +
                `<w:tc><w:tcPr><w:tcW w:w="${wTxt}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${txtPara}</w:tc></w:tr>`;
            return `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${none}` +
                `<w:tblBorders><w:bottom w:val="single" w:sz="8" w:space="0" w:color="${COLOR_BRAND}"/></w:tblBorders></w:tblPr>` +
                `<w:tblGrid><w:gridCol w:w="${wImg}"/><w:gridCol w:w="${wTxt}"/></w:tblGrid>${row}</w:tbl>` +
                paraXml('', { after: 140 });
        }
        return paraXml(runsXml(parts), { align: 'left', bottomLine: true, lineColor: COLOR_BRAND, lineSz: 8, after: 180 });
    }

    function blocks(node, ctx, out) {
        const font = ctx.theme.fontBody;
        Array.from(node.childNodes || []).forEach(ch => {
            if (ch.nodeType !== 1) return;
            const tag = ch.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'img' || hasClass(ch, 'lqd-marca')) return;

            const mark = attr(ch, 'data-docx');
            const center = ctx.center || hasClass(ch, 'text-center') || styleHas(ch, /text-align\s*:\s*center/i);
            const hasPageBreak = hasClass(ch, 'page-break-before') || styleHas(ch, /page-break-before\s*:\s*always/i);

            if (hasPageBreak && out.length) {
                out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
            }
            if (tag === 'br' || tag === 'hr') {
                if (tag === 'hr') out.push(paraXml('', { bottomLine: true, lineColor: COLOR_BORDER, after: 120, line: 120 }));
                return;
            }
            if (mark === 'firmas') { out.push(firmasXml(ch, ctx)); return; }
            if (hasClass(ch, 'dc-firmas')) { out.push(dcFirmasXml(ch, ctx)); return; }
            if (hasClass(ch, 'dc-head') || tag === 'header') {
                const h = headXml(ch, ctx);
                if (h) out.push(h);
                return;
            }
            if (mark === 'linea') {
                out.push(paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 }) +
                    paraXml('', { bottomLine: true, align: 'center', after: 0, line: 240, indent: 2600 }));
                return;
            }
            if (tag === 'table') { out.push(tableXml(ch, ctx)); return; }
            if (tag === 'ul' || tag === 'ol') { out.push(listXml(ch, tag === 'ol', ctx)); return; }
            if (tag === 'h1') { out.push(headingXml(ch, ctx, 28, ctx.theme.modern ? 'left' : 'center', !ctx.theme.modern, 60, 110, 'Heading1')); return; }
            if (tag === 'h2') {
                const a = alignOf(ch, 'center');
                out.push(headingXml(ch, ctx, a === 'left' ? 23 : 27, a, a === 'center' && !ctx.theme.modern, a === 'left' ? 150 : 0, 80, 'Heading2'));
                return;
            }
            if (tag === 'h3') { out.push(headingXml(ch, ctx, 22, 'left', false, 120, 60, 'Heading3')); return; }
            if (tag === 'h4') { out.push(headingXml(ch, ctx, 20, 'left', false, 80, 40)); return; }
            if (tag === 'p') {
                const esMeta = hasClass(ch, 'meta') || hasClass(ch, 'dc-pie');
                const size = ctx.small || hasClass(ch, 'text-xs') || esMeta ? 18 : 22;
                const fmt = baseFmt(ch, font, size, esMeta ? COLOR_MUTED : '');
                const indentMatch = /margin-left\s*:\s*(\d+)/i.exec(attr(ch, 'style'));
                const indent = indentMatch ? Math.min(1440, parseInt(indentMatch[1], 10) * 18) : 0;
                const align = alignOf(ch, center ? 'center' : (esMeta ? 'left' : 'both'));
                const topBorder = styleHas(ch, /border-top\s*:/i) || hasClass(ch, 'dc-pie');
                out.push(paraXml(runsXml(inlineRuns(ch, fmt, [])), {
                    align,
                    indent,
                    topLine: topBorder && hasClass(ch, 'dc-pie'),
                    lineColor: COLOR_BORDER,
                    callout: ctx.box,
                    keepTogether: ctx.box,
                    shade: ctx.box ? ctx.theme.boxFill : '',
                    keepNext: ctx.keepNext,
                    after: ctx.box ? 40 : 120
                }));
                return;
            }
            if (!hasBlockChild(ch)) {
                const fmt = baseFmt(ch, font, ctx.small || hasClass(ch, 'text-xs') ? 18 : 21);
                const parts = inlineRuns(ch, fmt, []);
                if (parts.length) {
                    const isBox = ctx.box || styleHas(ch, /border\s*:\s*1px/i);
                    out.push(paraXml(runsXml(parts), {
                        align: alignOf(ch, center ? 'center' : 'left'),
                        topLine: styleHas(ch, /border-top\s*:/i),
                        callout: isBox,
                        keepTogether: isBox,
                        shade: isBox ? ctx.theme.boxFill : '',
                        after: 90
                    }));
                }
                return;
            }
            const sub = Object.assign({}, ctx, {
                center,
                box: ctx.box || mark === 'recuadro' || styleHas(ch, /border\s*:\s*1px/i),
                small: ctx.small || hasClass(ch, 'text-xs')
            });
            const start = out.length;
            blocks(ch, sub, out);
            if (hasClass(ch, 'border-b') && center && out.length > start) {
                out.push(paraXml('', { bottomLine: true, lineColor: COLOR_BRAND, lineSz: 8, after: 220, line: 120 }));
            }
            if (mark === 'recuadro') out.push(paraXml('', { after: 120, line: 120 }));
            if (hasClass(ch, 'mt-8') || hasClass(ch, 'mt-12')) out.splice(start, 0, paraXml('', { after: 0, line: 240 }));
        });
        return out;
    }

    function resolveBodyEl(bodyOrHtml) {
        if (typeof bodyOrHtml !== 'string') return bodyOrHtml;
        if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
            const container = document.createElement('div');
            container.innerHTML = bodyOrHtml;
            return container;
        }
        return parseHtmlToMiniDom(bodyOrHtml);
    }

    // ---------- Encabezado, pie de página y estilos ----------

    function headerXml(title, theme) {
        const txt = xmlEsc(title || 'CálculoLaboral');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="${COLOR_BORDER}"/></w:pBdr>` +
            `<w:spacing w:before="0" w:after="60"/><w:jc w:val="right"/></w:pPr>` +
            `<w:r><w:rPr><w:rFonts w:ascii="${theme.fontTable}" w:hAnsi="${theme.fontTable}" w:cs="${theme.fontTable}"/>` +
            `<w:color w:val="${COLOR_MUTED}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>` +
            `<w:t xml:space="preserve">${txt}</w:t></w:r></w:p></w:hdr>`;
    }

    function fldRun(instr, font) {
        const rpr = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:color w:val="${COLOR_MUTED}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>`;
        return `<w:r>${rpr}<w:fldChar w:fldCharType="begin"/></w:r>` +
            `<w:r>${rpr}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>` +
            `<w:r>${rpr}<w:fldChar w:fldCharType="separate"/></w:r>` +
            `<w:r>${rpr}<w:t>1</w:t></w:r>` +
            `<w:r>${rpr}<w:fldChar w:fldCharType="end"/></w:r>`;
    }

    function footerXml(pieTexto, theme) {
        const font = theme.fontTable;
        const rpr = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:color w:val="${COLOR_MUTED}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>`;
        const leftTxt = xmlEsc(pieTexto || 'Documento generado con CálculoLaboral.cl');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs>` +
            `<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${COLOR_BORDER}"/></w:pBdr>` +
            `<w:spacing w:before="60" w:after="0"/><w:jc w:val="left"/></w:pPr>` +
            `<w:r>${rpr}<w:t xml:space="preserve">${leftTxt}</w:t></w:r>` +
            `<w:r>${rpr}<w:tab/><w:t xml:space="preserve">Página </w:t></w:r>` +
            fldRun('PAGE', font) +
            `<w:r>${rpr}<w:t xml:space="preserve"> de </w:t></w:r>` +
            fldRun('NUMPAGES', font) +
            '</w:p></w:ftr>';
    }

    function stylesXml(theme) {
        const f = theme.fontBody;
        const hClr = theme.headingColor ? `<w:color w:val="${theme.headingColor}"/>` : '';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>` +
            '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>' +
            '<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
            '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
            `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/>${hClr}<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>` +
            `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/>${hClr}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>` +
            `<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/>${hClr}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>` +
            '</w:styles>';
    }

    function contentTypesXml(logo) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            (logo ? `<Default Extension="${logo.ext}" ContentType="${logo.mime}"/>` : '') +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
            '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
            '</Types>';
    }

    const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>';

    function docRelsXml(logo) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
            (logo ? `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${logo.relTarget}"/>` : '') +
            '</Relationships>';
    }

    function coreXml(title) {
        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            `<dc:title>${xmlEsc(title)}</dc:title><dc:creator>CalculoLaboral.cl</dc:creator>` +
            `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
            `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    }

    function documentXml(rootEl, ctx, options) {
        let body = blocks(rootEl, ctx, []).join('');
        // Si se pasó logo explícito pero el HTML no tenía .dc-head/<header>, lo colocamos discreto al inicio
        if (ctx.logo && !ctx.logoPlaced) {
            body = `<w:p><w:pPr><w:spacing w:before="0" w:after="100"/><w:jc w:val="left"/></w:pPr>${drawingXml(ctx.logo, ctx.logoRelId)}</w:p>` + body;
        }
        const conHdr = options.mostrarHeader !== false;
        const conFtr = options.mostrarFooter !== false;
        const refs = (conHdr ? '<w:headerReference w:type="default" r:id="rId2"/>' : '') +
            (conFtr ? '<w:footerReference w:type="default" r:id="rId3"/><w:footerReference w:type="first" r:id="rId3"/>' : '');
        const titlePg = conHdr ? '<w:titlePg/>' : '';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
            `<w:body>${body}<w:sectPr>${refs}<w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/>` +
            `<w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" w:left="${PAGE.margin}" w:header="680" w:footer="680" w:gutter="0"/>` +
            `${titlePg}</w:sectPr></w:body></w:document>`;
    }

    // ---------- zip (delega en CLKitZipEngine) ----------

    function getZipEngine() {
        if (root.CLKitZipEngine) return root.CLKitZipEngine;
        if (typeof require === 'function') return require('./kit_zip_engine.js');
        throw new Error('Falta CLKitZipEngine (js/kit_zip_engine.js).');
    }

    function zip(files) {
        const enc = new TextEncoder();
        return getZipEngine().buildZipBytes(files.map(([name, payload]) => ({
            name,
            data: payload instanceof Uint8Array ? payload : enc.encode(payload)
        })));
    }

    function build(bodyEl, title, opts) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const docTitle = title || 'Documento';
        const rootEl = resolveBodyEl(bodyEl);
        const theme = detectTheme(rootEl, options);
        const logoSrc = options.logoDataUrl || findFirstLogoSrc(rootEl);
        const logo = parseLogoDataUrl(logoSrc);
        const ctx = { theme, logo, logoRelId: 'rId4', logoPlaced: false };

        const files = [
            ['[Content_Types].xml', contentTypesXml(logo)],
            ['_rels/.rels', ROOT_RELS],
            ['word/document.xml', documentXml(rootEl, ctx, options)],
            ['word/_rels/document.xml.rels', docRelsXml(logo)],
            ['word/styles.xml', stylesXml(theme)],
            ['word/header1.xml', headerXml(options.encabezadoTexto || docTitle, theme)],
            ['word/footer1.xml', footerXml(options.pieTexto || docTitle, theme)],
            ['docProps/core.xml', coreXml(docTitle)]
        ];
        if (logo) files.push([logo.file, logo.bytes]);
        return zip(files);
    }

    root.FiniquitoDocx = {
        MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        version: '1.3.0',
        build,
        toBlob: (bodyEl, title, opts) => new Blob([build(bodyEl, title, opts)], { type: root.FiniquitoDocx.MIME }),
        toBase64: (bodyEl, title, opts) => bytesToBase64(build(bodyEl, title, opts))
    };
})(typeof window !== 'undefined' ? window : globalThis);
