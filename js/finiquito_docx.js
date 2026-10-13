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
        return el.classList && el.classList.contains(name);
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
                const f = Object.assign({}, fmt);
                if (tag === 'strong' || tag === 'b' || hasClass(ch, 'font-bold') || hasClass(ch, 'font-semibold')) f.bold = true;
                if (tag === 'em' || tag === 'i' || hasClass(ch, 'italic')) f.italic = true;
                if (tag === 'u') f.underline = true;
                if (hasClass(ch, 'uppercase')) f.caps = true;
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
            bold: hasClass(el, 'font-bold') || hasClass(el, 'font-semibold'),
            italic: hasClass(el, 'italic'),
            caps: hasClass(el, 'uppercase')
        };
    }

    // ---------- tablas ----------

    const CELL_BORDERS = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('') + '</w:tcBorders>';

    function tableXml(table) {
        const amountW = 2300;
        const widths = [CONTENT_W - amountW, amountW];
        let rows = '';
        table.querySelectorAll('tr').forEach(tr => {
            const header = !!tr.closest('thead');
            const total = hasClass(tr, 'font-semibold') || hasClass(tr, 'font-bold');
            let cells = '';
            Array.from(tr.children).forEach((cell, i) => {
                const right = hasClass(cell, 'text-right');
                const fmt = { font: FONT_TABLE, size: 18, bold: header || total, italic: hasClass(cell, 'italic') };
                const shade = header ? 'E7E6E6' : (total ? 'F2F2F2' : '');
                cells += `<w:tc><w:tcPr><w:tcW w:w="${widths[i] || amountW}" w:type="dxa"/>${CELL_BORDERS}` +
                    (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '') +
                    '<w:vAlign w:val="center"/></w:tcPr>' +
                    paraXml(runsXml(inlineRuns(cell, fmt, [])), { align: right ? 'right' : 'left', after: 0, before: 0, line: 240 }) +
                    '</w:tc>';
            });
            rows += `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells}</w:tr>`;
        });
        return '<w:tbl><w:tblPr><w:tblW w:w="' + CONTENT_W + '" w:type="dxa"/>' +
            '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>' +
            '<w:bottom w:w="50" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
            `<w:tblGrid><w:gridCol w:w="${widths[0]}"/><w:gridCol w:w="${widths[1]}"/></w:tblGrid>${rows}</w:tbl>` +
            paraXml('', { after: 60 });
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

    function blocks(node, ctx, out) {
        node.childNodes.forEach(ch => {
            if (ch.nodeType !== 1) return;
            const tag = ch.tagName.toLowerCase();
            const mark = ch.getAttribute('data-docx');
            const center = ctx.center || hasClass(ch, 'text-center');

            if (mark === 'firmas') { out.push(firmasXml(ch)); return; }
            if (mark === 'linea') {
                out.push(paraXml('', { after: 0, line: 240 }) + paraXml('', { after: 0, line: 240 }) +
                    paraXml('', { bottomLine: true, align: 'center', after: 0, line: 240, indent: 2600 }));
                return;
            }
            if (tag === 'table') { out.push(tableXml(ch)); return; }
            if (tag === 'h2') {
                out.push(paraXml(runsXml(inlineRuns(ch, { font: FONT_BODY, size: 28, bold: true, caps: true }, [])), { align: 'center', after: 60 }));
                return;
            }
            if (tag === 'p') {
                const fmt = baseFmt(ch, FONT_BODY, ctx.small || hasClass(ch, 'text-xs') ? 19 : 22);
                out.push(paraXml(runsXml(inlineRuns(ch, fmt, [])), {
                    align: center ? 'center' : 'both',
                    border: ctx.box,
                    shade: ctx.box ? 'F2F2F2' : '',
                    keepNext: ctx.keepNext,
                    after: ctx.box ? 0 : 120
                }));
                return;
            }
            // contenedores: el encabezado lleva una línea bajo el título
            const sub = Object.assign({}, ctx, {
                center,
                box: ctx.box || mark === 'recuadro',
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

    function documentXml(bodyEl) {
        const body = blocks(bodyEl, {}, []).join('');
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

    // ---------- zip (método store) ----------

    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function zip(files) {
        const enc = new TextEncoder();
        const chunks = [];
        const central = [];
        let offset = 0;
        files.forEach(([name, text]) => {
            const nameB = enc.encode(name);
            const data = enc.encode(text);
            const crc = crc32(data);
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true); // nombres en UTF-8
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, nameB.length, true);
            chunks.push(new Uint8Array(local.buffer), nameB, data);

            const cen = new DataView(new ArrayBuffer(46));
            cen.setUint32(0, 0x02014b50, true);
            cen.setUint16(4, 20, true);
            cen.setUint16(6, 20, true);
            cen.setUint16(8, 0x0800, true);
            cen.setUint32(16, crc, true);
            cen.setUint32(20, data.length, true);
            cen.setUint32(24, data.length, true);
            cen.setUint16(28, nameB.length, true);
            cen.setUint32(42, offset, true);
            central.push(new Uint8Array(cen.buffer), nameB);
            offset += 30 + nameB.length + data.length;
        });
        const cenSize = central.reduce((s, c) => s + c.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, cenSize, true);
        end.setUint32(16, offset, true);
        const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
        const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
        let p = 0;
        all.forEach(c => { out.set(c, p); p += c.length; });
        return out;
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
})(window);
