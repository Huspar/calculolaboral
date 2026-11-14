/**
 * Convierte el finiquito ya renderizado (#notary-document-body) en un .docx real.
 *
 * Antes se descargaba el HTML con extensión .doc: Word lo abría con un aviso de formato
 * y sin las clases de Tailwind, así que perdía las líneas de firma, los bordes de las
 * tablas y la alineación de los montos. Aquí se recorre el DOM y se escribe WordprocessingML,
 * empaquetado en un zip sin compresión (no requiere librerías).
 *
 * Marcas que lee del HTML (las pone renderNotaryDocument en finiquito_generator.js):
 *   data-docx="firmas"   -> tabla de 2 columnas sin bordes, con línea de firma en cada una
 *   data-docx="recuadro" -> párrafos con borde y fondo gris claro
 *   data-docx="linea"    -> línea de firma suelta (la del notario)
 */
(function (root) {
    'use strict';

    const FONT_BODY = 'Times New Roman';
    const FONT_TABLE = 'Arial';
    // Carta, márgenes de 2,5 cm (en twips)
    const PAGE = { w: 12240, h: 15840, margin: 1418 };
    const CONTENT_W = PAGE.w - PAGE.margin * 2;

    function xmlEsc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function hasClass(el, name) {
        return !!(el && el.classList && el.classList.contains(name));
    }

    function attr(el, name) {
        return (el && el.getAttribute && el.getAttribute(name)) || '';
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
        return Array.from(el.childNodes).some(c => {
            if (c.nodeType !== 1) return false;
            const t = c.tagName.toLowerCase();
            return !!BLOCK_TAGS[t] || (t === 'br' && styleHas(c, /page-break-before\s*:\s*always/i));
        });
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

    // Recorre nodos en línea; el espacio en blanco del HTML se colapsa como lo haría el navegador
    function inlineRuns(node, fmt, out) {
        node.childNodes.forEach(ch => {
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
        // quitar espacios al inicio y al final del párrafo
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
        const ppr = [
            opt.keepNext ? '<w:keepNext/>' : '',
            opt.border ? '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="4" w:color="808080"/>`).join('') + '</w:pBdr>' : '',
            opt.bottomLine ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : '',
            opt.topLine ? '<w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : '',
            opt.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${opt.shade}"/>` : '',
            `<w:spacing w:before="${opt.before || 0}" w:after="${opt.after === undefined ? 120 : opt.after}" w:line="${opt.line || 276}" w:lineRule="auto"/>`,
            opt.indent ? `<w:ind w:left="${opt.indent}" w:right="${opt.indent}"/>` : '',
            `<w:jc w:val="${opt.align || 'both'}"/>`
        ].join('');
        return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
    }

    function baseFmt(el, font, size) {
        return {
            font,
            size,
            bold: hasClass(el, 'font-bold') || hasClass(el, 'font-semibold') || styleHas(el, /font-weight\s*:\s*(bold|[6-9]00)/i),
            italic: hasClass(el, 'italic') || styleHas(el, /font-style\s*:\s*italic/i),
            caps: hasClass(el, 'uppercase') || styleHas(el, /text-transform\s*:\s*uppercase/i)
        };
    }

    // ---------- tablas ----------

    const CELL_BORDERS = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('') + '</w:tcBorders>';
    const CELL_BORDERS_NONE = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tcBorders>';

    function tableWidths(table, trs) {
        let maxCols = 0;
        trs.forEach(tr => {
            let cols = 0;
            Array.from(tr.children).forEach(cell => {
                cols += Math.max(1, parseInt(attr(cell, 'colspan') || '1', 10) || 1);
            });
            if (cols > maxCols) maxCols = cols;
        });
        maxCols = maxCols || 2;
        if (maxCols === 2 && !styleHas(table, /border\s*:\s*(none|0)/i)) {
            const amountW = 2300;
            return [CONTENT_W - amountW, amountW];
        }
        const firstRow = trs[0] ? Array.from(trs[0].children) : [];
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
        const subBlocks = Array.from(cell.children).filter(c => BLOCK_TAGS[c.tagName.toLowerCase()]);
        if (subBlocks.length) {
            return subBlocks.map((b, idx) => {
                const bFmt = Object.assign({}, fmt, baseFmt(b, fmt.font, fmt.size));
                const hasTop = (idx === 0 && topLineFirst) || styleHas(b, /border-top\s*:/i);
                const bAlign = alignOf(b, align);
                // Recursivamente extraer sublíneas si hay hijos div dentro (ej: contrato firma box)
                const innerBlocks = Array.from(b.children).filter(c => BLOCK_TAGS[c.tagName.toLowerCase()]);
                if (innerBlocks.length) {
                    return innerBlocks.map((ib, j) => paraXml(
                        runsXml(inlineRuns(ib, Object.assign({}, bFmt, baseFmt(ib, fmt.font, fmt.size)), [])),
                        { align: alignOf(ib, bAlign), after: 20, before: 0, line: 240, topLine: j === 0 && hasTop }
                    )).join('');
                }
                return paraXml(runsXml(inlineRuns(b, bFmt, [])), { align: bAlign, after: 20, before: 0, line: 240, topLine: hasTop });
            }).join('');
        }
        return paraXml(runsXml(inlineRuns(cell, fmt, [])), { align, after: 0, before: 0, line: 240, topLine: topLineFirst });
    }

    function tableXml(table) {
        const trs = Array.from(table.querySelectorAll('tr'));
        const widths = tableWidths(table, trs);
        const borderless = styleHas(table, /border\s*:\s*(none|0)/i);
        const isDcTabla = hasClass(table, 'dc-tabla');
        let rows = '';
        trs.forEach(tr => {
            const parentTag = tr.parentNode && tr.parentNode.tagName ? tr.parentNode.tagName.toLowerCase() : '';
            const header = parentTag === 'thead' || !!(tr.closest && tr.closest('thead'));
            const footer = parentTag === 'tfoot' || !!(tr.closest && tr.closest('tfoot'));
            const total = footer || hasClass(tr, 'font-semibold') || hasClass(tr, 'font-bold');
            let cells = '';
            let colIdx = 0;
            Array.from(tr.children).forEach(cell => {
                const cAlign = alignOf(cell, (hasClass(cell, 'text-right') || (isDcTabla && colIdx > 0)) ? 'right' : (borderless ? 'center' : 'left'));
                const span = Math.max(1, parseInt(attr(cell, 'colspan') || '1', 10) || 1);
                const cellW = span > 1 ? (widths.slice(colIdx, colIdx + span).reduce((a, b) => a + b, 0) || CONTENT_W) : (widths[colIdx] || widths[widths.length - 1]);
                colIdx += span;
                const isTh = cell.tagName.toLowerCase() === 'th';
                const fmt = {
                    font: borderless ? FONT_BODY : FONT_TABLE,
                    size: borderless ? 19 : 18,
                    bold: !borderless && (header || total || isTh) || styleHas(cell, /font-weight\s*:\s*bold/i),
                    italic: hasClass(cell, 'italic')
                };
                const noCellBorder = borderless || styleHas(cell, /border\s*:\s*(none|0)/i);
                const shade = noCellBorder ? '' : ((header || isTh) ? 'E7E6E6' : (total ? 'F2F2F2' : ''));
                cells += `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>` +
                    (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
                    (noCellBorder ? CELL_BORDERS_NONE : CELL_BORDERS) +
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
        return (borderless ? paraXml('', { after: 180 }) : '') +
            '<w:tbl><w:tblPr><w:tblW w:w="' + CONTENT_W + '" w:type="dxa"/>' +
            '<w:tblLayout w:type="fixed"/>' + tblBorders +
            '<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>' +
            '<w:bottom w:w="50" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>` +
            paraXml('', { after: 60 });
    }

    // Bloque .dc-firmas (Asistente Pyme): columnas sin bordes con línea sobre el nombre y <small> abajo
    function dcFirmasXml(grid) {
        const cols = Array.from(grid.children);
        if (!cols.length) return '';
        const w = Math.floor(CONTENT_W / cols.length);
        let cells = '';
        cols.forEach(col => {
            let inner = paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 });
            const smalls = [];
            const nameParts = [];
            Array.from(col.childNodes).forEach(ch => {
                if (ch.nodeType === 3 && ch.textContent.trim()) nameParts.push({ text: ch.textContent.trim(), fmt: { font: FONT_BODY, size: 19, bold: true } });
                else if (ch.nodeType === 1 && ch.tagName.toLowerCase() === 'small') smalls.push(ch);
            });
            inner += paraXml(runsXml(nameParts.length ? nameParts : [{ text: '', fmt: { font: FONT_BODY, size: 19 } }]), { align: 'center', after: 0, line: 240, topLine: true, indent: 300 });
            smalls.forEach(sm => {
                inner += paraXml(runsXml(inlineRuns(sm, { font: FONT_BODY, size: 17 }, [])), { align: 'center', after: 0, line: 240, indent: 300 });
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

    // Bloque de firmas: dos columnas sin bordes; cada una con espacio para firmar, línea y datos
    function firmasXml(grid) {
        const cols = Array.from(grid.children);
        const w = Math.floor(CONTENT_W / cols.length);
        let cells = '';
        cols.forEach(col => {
            let inner = paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 });
            let first = true;
            col.querySelectorAll('p').forEach(p => {
                const fmt = baseFmt(p, FONT_BODY, 19);
                inner += paraXml(runsXml(inlineRuns(p, fmt, [])), { align: 'center', after: 0, line: 240, topLine: first, indent: 500 });
                first = false;
            });
            cells += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
        });
        const none = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
        return paraXml('', { after: 240 }) +
            `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${none}</w:tblPr>` +
            `<w:tblGrid>${cols.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
            `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr></w:tbl>` +
            paraXml('', { after: 120 });
    }

    // ---------- recorrido de bloques ----------

    function headingXml(el, size, align, caps, before, after) {
        const fmt = Object.assign({ font: FONT_BODY, size, bold: true, caps: !!caps }, baseFmt(el, FONT_BODY, size));
        return paraXml(runsXml(inlineRuns(el, fmt, [])), {
            align: alignOf(el, align),
            before: before || 0,
            after: after === undefined ? 80 : after,
            keepNext: true
        });
    }

    function listXml(el, ordered, ctx) {
        const out = [];
        let idx = 1;
        Array.from(el.childNodes).forEach(li => {
            if (li.nodeType !== 1 || li.tagName.toLowerCase() !== 'li') return;
            const prefix = ordered ? (idx++) + '. ' : '• ';
            const fmt = baseFmt(li, FONT_BODY, ctx.small ? 19 : 21);
            const parts = [{ text: prefix, fmt: Object.assign({}, fmt, { bold: ordered }) }];
            inlineRuns(li, fmt, parts);
            out.push(paraXml(runsXml(parts), { align: 'both', indent: 360, after: 60 }));
        });
        return out.join('');
    }

    function headXml(el) {
        const parts = [];
        const div = el.querySelector && el.querySelector('div');
        const src = div || el;
        Array.from(src.childNodes).forEach(ch => {
            if (ch.nodeType !== 1 && ch.nodeType !== 3) return;
            if (ch.nodeType === 1 && ch.tagName.toLowerCase() === 'img') return;
            const txt = (ch.textContent || '').trim();
            if (!txt) return;
            if (parts.length) parts.push({ text: '  ·  ', fmt: { font: FONT_BODY, size: 18 } });
            const isStrong = ch.nodeType === 1 && ch.tagName.toLowerCase() === 'strong';
            parts.push({ text: txt, fmt: { font: FONT_BODY, size: isStrong ? 21 : 18, bold: isStrong } });
        });
        if (!parts.length) return '';
        return paraXml(runsXml(parts), { align: 'left', bottomLine: true, after: 180 });
    }

    function blocks(node, ctx, out) {
        Array.from(node.childNodes).forEach(ch => {
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
                if (tag === 'hr') out.push(paraXml('', { bottomLine: true, after: 120, line: 120 }));
                return;
            }
            if (mark === 'firmas') { out.push(firmasXml(ch)); return; }
            if (hasClass(ch, 'dc-firmas')) { out.push(dcFirmasXml(ch)); return; }
            if (hasClass(ch, 'dc-head') || tag === 'header') {
                const h = headXml(ch);
                if (h) out.push(h);
                return;
            }
            if (mark === 'linea') {
                out.push(paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 }) +
                    paraXml('', { bottomLine: true, align: 'center', after: 0, line: 240, indent: 2600 }));
                return;
            }
            if (tag === 'table') { out.push(tableXml(ch)); return; }
            if (tag === 'ul' || tag === 'ol') { out.push(listXml(ch, tag === 'ol', ctx)); return; }
            if (tag === 'h1') { out.push(headingXml(ch, 28, 'center', true, 60, 100)); return; }
            if (tag === 'h2') {
                const a = alignOf(ch, 'center');
                out.push(headingXml(ch, a === 'left' ? 24 : 28, a, a === 'center', a === 'left' ? 140 : 0, 80));
                return;
            }
            if (tag === 'h3') { out.push(headingXml(ch, 22, 'left', false, 120, 60)); return; }
            if (tag === 'h4') { out.push(headingXml(ch, 20, 'left', false, 80, 40)); return; }
            if (tag === 'p') {
                const fmt = baseFmt(ch, FONT_BODY, ctx.small || hasClass(ch, 'text-xs') || hasClass(ch, 'dc-pie') ? 18 : 22);
                const indentMatch = /margin-left\s*:\s*(\d+)/i.exec(attr(ch, 'style'));
                const indent = indentMatch ? Math.min(1440, parseInt(indentMatch[1], 10) * 18) : 0;
                const align = alignOf(ch, center ? 'center' : 'both');
                const topBorder = styleHas(ch, /border-top\s*:/i) || hasClass(ch, 'dc-pie');
                out.push(paraXml(runsXml(inlineRuns(ch, fmt, [])), {
                    align,
                    indent,
                    topLine: topBorder && hasClass(ch, 'dc-pie'),
                    border: ctx.box,
                    shade: ctx.box ? 'F2F2F2' : '',
                    keepNext: ctx.keepNext,
                    after: ctx.box ? 0 : 120
                }));
                return;
            }
            // Contenedor: si no tiene hijos de bloque (e.g. div con solo texto/<strong>/<br>), trátalo como párrafo para no perder texto
            if (!hasBlockChild(ch)) {
                const fmt = baseFmt(ch, FONT_BODY, ctx.small || hasClass(ch, 'text-xs') ? 18 : 21);
                const parts = inlineRuns(ch, fmt, []);
                if (parts.length) {
                    out.push(paraXml(runsXml(parts), {
                        align: alignOf(ch, center ? 'center' : 'left'),
                        topLine: styleHas(ch, /border-top\s*:/i),
                        border: ctx.box || styleHas(ch, /border\s*:\s*1px/i),
                        shade: ctx.box ? 'F2F2F2' : '',
                        after: 80
                    }));
                }
                return;
            }
            // Contenedores con bloques hijos
            const sub = Object.assign({}, ctx, {
                center,
                box: ctx.box || mark === 'recuadro' || styleHas(ch, /border\s*:\s*1px/i),
                small: ctx.small || hasClass(ch, 'text-xs')
            });
            const start = out.length;
            blocks(ch, sub, out);
            if (hasClass(ch, 'border-b') && center && out.length > start) {
                out.push(paraXml('', { bottomLine: true, after: 240, line: 120 }));
            }
            if (mark === 'recuadro') out.push(paraXml('', { after: 120, line: 120 }));
            if (hasClass(ch, 'mt-8') || hasClass(ch, 'mt-12')) out.splice(start, 0, paraXml('', { after: 0, line: 240 }));
        });
        return out;
    }

    function resolveBodyEl(bodyOrHtml) {
        if (typeof bodyOrHtml !== 'string') return bodyOrHtml;
        const container = document.createElement('div');
        container.innerHTML = bodyOrHtml;
        return container;
    }

    function documentXml(bodyEl) {
        const body = blocks(resolveBodyEl(bodyEl), {}, []).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            `<w:body>${body}<w:sectPr><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/>` +
            `<w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" w:left="${PAGE.margin}" w:header="709" w:footer="709" w:gutter="0"/>` +
            '</w:sectPr></w:body></w:document>';
    }

    const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}" w:eastAsia="${FONT_BODY}"/>` +
        '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>' +
        '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '</w:styles>';

    const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>';

    const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>';

    const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>';

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

    // ---------- zip (delega en CLKitZipEngine) ----------

    function getZipEngine() {
        if (root.CLKitZipEngine) return root.CLKitZipEngine;
        if (typeof require === 'function') return require('./kit_zip_engine.js');
        throw new Error('Falta CLKitZipEngine (js/kit_zip_engine.js).');
    }

    function zip(files) {
        const enc = new TextEncoder();
        return getZipEngine().buildZipBytes(files.map(([name, text]) => ({
            name: name,
            data: enc.encode(text)
        })));
    }

    function build(bodyEl, title) {
        return zip([
            ['[Content_Types].xml', CONTENT_TYPES],
            ['_rels/.rels', ROOT_RELS],
            ['word/document.xml', documentXml(bodyEl)],
            ['word/_rels/document.xml.rels', DOC_RELS],
            ['word/styles.xml', STYLES],
            ['docProps/core.xml', coreXml(title || 'Finiquito')]
        ]);
    }

    function toBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }

    root.FiniquitoDocx = {
        MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        build,
        toBlob: (bodyEl, title) => new Blob([build(bodyEl, title)], { type: root.FiniquitoDocx.MIME }),
        toBase64: (bodyEl, title) => toBase64(build(bodyEl, title))
    };
})(typeof window !== 'undefined' ? window : globalThis);
