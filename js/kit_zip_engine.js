/* Motor cliente ZIP / OpenXML compartido para personalizadores web (zero datos enviados al servidor) */
(function (root) {
    'use strict';

    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    function or(val, fallback) {
        var s = String(val == null ? '' : val).trim();
        return s || fallback;
    }

    function slugRut(rut) {
        return String(rut || 'empresa').replace(/[^0-9kK]/g, '').toUpperCase() || 'empresa';
    }

    function fechaHoyLarga() {
        var d = new Date();
        return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    function escXml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function splitFechaDiaMesAnio(fechaTexto) {
        var s = String(fechaTexto || '').trim();
        var m = s.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?/i);
        var d = new Date();
        if (m) {
            return {
                dia: m[1],
                mes: m[2].toLowerCase(),
                anio: m[3] || String(d.getFullYear())
            };
        }
        return {
            dia: String(d.getDate()),
            mes: MESES[d.getMonth()],
            anio: String(d.getFullYear())
        };
    }

    function toNumericEntities(s) {
        return String(s).replace(/[^\x00-\x7f]/g, function (ch) {
            return '&#' + ch.charCodeAt(0) + ';';
        });
    }

    function applyXmlReplacements(xmlStr, pairs, useXmlEscape) {
        var out = String(xmlStr);
        for (var i = 0; i < pairs.length; i++) {
            var target = pairs[i][0];
            var rep = useXmlEscape ? escXml(pairs[i][1]) : String(pairs[i][1]);
            if (out.indexOf(target) !== -1) {
                out = out.split(target).join(rep);
            }
            var encodedTarget = toNumericEntities(target);
            if (encodedTarget !== target && out.indexOf(encodedTarget) !== -1) {
                out = out.split(encodedTarget).join(rep);
            }
        }
        return out;
    }

    var CRC_TAB = (function () {
        var t = new Uint32Array(256);
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(u8) {
        var c = 0xffffffff;
        for (var i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function inflateRaw(u8) {
        if (typeof DecompressionStream !== 'undefined') {
            var ds = new DecompressionStream('deflate-raw');
            var writer = ds.writable.getWriter();
            writer.write(u8);
            writer.close();
            return new Response(ds.readable).arrayBuffer().then(function (ab) {
                return new Uint8Array(ab);
            });
        }
        if (typeof require === 'function') {
            var zlib = require('zlib');
            return Promise.resolve(new Uint8Array(zlib.inflateRawSync(Buffer.from(u8))));
        }
        return Promise.reject(new Error('Tu navegador no soporta descompresión ZIP nativa (DecompressionStream).'));
    }

    function readU16(v, off) { return v.getUint16(off, true); }
    function readU32(v, off) { return v.getUint32(off, true); }

    function parseZip(arrayBuffer) {
        var u8 = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
        var v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        var eocdOffset = -1;
        var minOff = Math.max(0, u8.length - 65557);
        for (var i = u8.length - 22; i >= minOff; i--) {
            if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset < 0) return Promise.reject(new Error('El archivo no es un ZIP válido.'));

        var totalEntries = readU16(v, eocdOffset + 10);
        var cdOffset = readU32(v, eocdOffset + 16);
        var dec = new TextDecoder('utf-8');
        var cursor = cdOffset;
        var items = [];

        for (var idx = 0; idx < totalEntries; idx++) {
            if (readU32(v, cursor) !== 0x02014b50) {
                return Promise.reject(new Error('Encabezado central ZIP dañado.'));
            }
            var method = readU16(v, cursor + 10);
            var compSize = readU32(v, cursor + 20);
            var uncompSize = readU32(v, cursor + 24);
            var nameLen = readU16(v, cursor + 28);
            var extraLen = readU16(v, cursor + 30);
            var commentLen = readU16(v, cursor + 32);
            var lfhOff = readU32(v, cursor + 42);
            var name = dec.decode(u8.subarray(cursor + 46, cursor + 46 + nameLen));
            cursor += 46 + nameLen + extraLen + commentLen;

            var lfhNameLen = readU16(v, lfhOff + 26);
            var lfhExtraLen = readU16(v, lfhOff + 28);
            var dataStart = lfhOff + 30 + lfhNameLen + lfhExtraLen;
            var payload = u8.subarray(dataStart, dataStart + compSize);
            items.push({ name: name, method: method, size: uncompSize, payload: payload });
        }

        return Promise.all(items.map(function (it) {
            if (it.name.endsWith('/')) return { name: it.name, data: new Uint8Array(0), isDir: true };
            if (it.method === 0) return { name: it.name, data: it.payload, isDir: false };
            if (it.method === 8) {
                return inflateRaw(it.payload).then(function (out) {
                    return { name: it.name, data: out, isDir: false };
                });
            }
            return Promise.reject(new Error('Método ZIP no soportado (' + it.method + ') en ' + it.name));
        }));
    }

    function buildZipBytes(entries) {
        var enc = new TextEncoder();
        var locals = [], centrals = [], offset = 0;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].isDir) continue;
            var nameBytes = enc.encode(entries[i].name);
            var data = entries[i].data;
            var crc = crc32(data);
            var lfh = new Uint8Array(30 + nameBytes.length);
            var lv = new DataView(lfh.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true);
            lv.setUint32(22, data.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lfh.set(nameBytes, 30);
            locals.push(lfh, data);

            var cdh = new Uint8Array(46 + nameBytes.length);
            var cv = new DataView(cdh.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, data.length, true);
            cv.setUint32(24, data.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint32(42, offset, true);
            cdh.set(nameBytes, 46);
            centrals.push(cdh);
            offset += lfh.length + data.length;
        }
        var cSize = centrals.reduce(function (a, b) { return a + b.length; }, 0);
        var eocd = new Uint8Array(22);
        var ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(8, centrals.length, true);
        ev.setUint16(10, centrals.length, true);
        ev.setUint32(12, cSize, true);
        ev.setUint32(16, offset, true);

        var totalLen = offset + cSize + 22;
        var out = new Uint8Array(totalLen);
        var pos = 0;
        for (var j = 0; j < locals.length; j++) { out.set(locals[j], pos); pos += locals[j].length; }
        for (var k = 0; k < centrals.length; k++) { out.set(centrals[k], pos); pos += centrals[k].length; }
        out.set(eocd, pos);
        return out;
    }

    function personalizeOfficePackage(packageBytes, pairs, matchTarget) {
        var enc = new TextEncoder();
        var dec = new TextDecoder('utf-8');
        var pred = typeof matchTarget === 'function'
            ? matchTarget
            : function (name) { return matchTarget.indexOf(name) !== -1; };
        return parseZip(packageBytes).then(function (innerEntries) {
            var updated = innerEntries.map(function (entry) {
                if (entry.isDir) return entry;
                if (pred(entry.name)) {
                    var xml = dec.decode(entry.data);
                    var nextXml = applyXmlReplacements(xml, pairs, true);
                    return { name: entry.name, data: enc.encode(nextXml), isDir: false };
                }
                return entry;
            });
            return buildZipBytes(updated);
        });
    }

    function personalizeEntryBytes(zipPath, rawBytes, pairs) {
        var lower = String(zipPath || '').toLowerCase();
        if (lower.endsWith('.docx')) {
            return personalizeOfficePackage(rawBytes, pairs, function (name) {
                return name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(name);
            });
        }
        if (lower.endsWith('.xlsx')) {
            return personalizeOfficePackage(rawBytes, pairs, function (name) {
                return name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
            });
        }
        return Promise.resolve(rawBytes);
    }

    function personalizeMasterZip(masterZipBuffer, pairs, outputFilename) {
        return parseZip(masterZipBuffer).then(function (entries) {
            var fileEntries = entries.filter(function (e) { return !e.isDir; });
            return Promise.all(fileEntries.map(function (e) {
                return personalizeEntryBytes(e.name, e.data, pairs).then(function (outData) {
                    return { name: e.name, data: outData };
                });
            })).then(function (outEntries) {
                return {
                    filename: outputFilename,
                    bytes: buildZipBytes(outEntries),
                    entriesCount: outEntries.length
                };
            });
        });
    }

    function extractDocPreviewText(docxBytes, maxParagraphs) {
        var dec = new TextDecoder('utf-8');
        return parseZip(docxBytes).then(function (entries) {
            var docEntry = entries.filter(function (e) { return e.name === 'word/document.xml'; })[0];
            if (!docEntry) return [];
            var xml = dec.decode(docEntry.data);
            var paras = [];
            var reP = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
            var reT = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
            var pm;
            while ((pm = reP.exec(xml)) !== null) {
                var text = '';
                var tm;
                reT.lastIndex = 0;
                while ((tm = reT.exec(pm[1])) !== null) {
                    text += tm[1]
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"');
                }
                text = text.trim();
                if (text) paras.push(text);
                if (maxParagraphs && paras.length >= maxParagraphs) break;
            }
            return paras;
        });
    }

    var api = {
        MESES: MESES,
        or: or,
        slugRut: slugRut,
        fechaHoyLarga: fechaHoyLarga,
        escXml: escXml,
        splitFechaDiaMesAnio: splitFechaDiaMesAnio,
        toNumericEntities: toNumericEntities,
        applyXmlReplacements: applyXmlReplacements,
        parseZip: parseZip,
        buildZipBytes: buildZipBytes,
        personalizeOfficePackage: personalizeOfficePackage,
        personalizeEntryBytes: personalizeEntryBytes,
        personalizeMasterZip: personalizeMasterZip,
        extractDocPreviewText: extractDocPreviewText
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.CLKitZipEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
