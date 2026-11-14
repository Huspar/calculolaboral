const assert = require('assert');

require('../js/kit_zip_engine.js');
require('../js/finiquito_docx.js');
require('../js/kit_datos_personalizador.js');

const Zip = globalThis.CLKitZipEngine;
const FD = globalThis.FiniquitoDocx;
const P = globalThis.CLKitDatosPersonalizador;

async function main() {
    let passed = 0;
    function test(name, fn) {
        return Promise.resolve().then(fn).then(() => {
            passed += 1;
            console.log(`PASS: ${name}`);
        });
    }

    await test('CLKitDatosPersonalizador exposes 6 documents and escapes XML/HTML entities', () => {
        assert.strictEqual(P.DOCUMENTOS.length, 6);
        const res = P.buildDocHtml(P.DOCUMENTOS[0].id, {
            razonSocial: 'Comercial Norte & Sur SpA',
            rutEmpresa: '76.543.210-K'
        });
        assert.ok(res && res.html.includes('Comercial Norte &amp; Sur SpA'));
    });

    await test('CLKitDatosPersonalizador.buildZip delegates to CLKitZipEngine and produces valid parseable ZIP', async () => {
        const blob = P.buildZip([
            { name: '01_Prueba.txt', data: new TextEncoder().encode('Hola Ley 21.719') },
            { name: '02_Datos.txt', data: new TextEncoder().encode('Norte & Sur') }
        ]);
        const ab = await blob.arrayBuffer();
        const entries = await Zip.parseZip(new Uint8Array(ab));
        assert.strictEqual(entries.length, 2);
        assert.strictEqual(new TextDecoder().decode(entries[0].data), 'Hola Ley 21.719');
        assert.strictEqual(new TextDecoder().decode(entries[1].data), 'Norte & Sur');
    });

    await test('FiniquitoDocx.build parses string HTML via DOM stub and packages valid DOCX ZIP through CLKitZipEngine', async () => {
        const fakeTextNode = (txt) => ({ nodeType: 3, textContent: txt });
        const fakeEl = (tag, children = [], attrs = {}) => ({
            nodeType: 1,
            tagName: tag.toUpperCase(),
            childNodes: children,
            children: children.filter((c) => c.nodeType === 1),
            classList: { contains: () => false },
            getAttribute: (k) => (k in attrs ? attrs[k] : null),
            closest: () => null,
            querySelectorAll: (sel) => (sel === 'tr' ? children : []),
            tagNameLower: tag.toLowerCase()
        });
        const prevDoc = globalThis.document;
        globalThis.document = {
            createElement: () => {
                const el = {
                    nodeType: 1,
                    childNodes: [],
                    set innerHTML(val) {
                        assert.ok(typeof val === 'string' && val.includes('Responsable'));
                        const row1 = fakeEl('tr', [
                            fakeEl('td', [fakeTextNode('ANEXO')], { colspan: '2' })
                        ]);
                        const row2 = fakeEl('tr', [
                            fakeEl('th', [fakeTextNode('Responsable')]),
                            fakeEl('td', [fakeTextNode('Norte & Sur SpA')])
                        ]);
                        this.childNodes = [
                            fakeEl('p', [fakeTextNode('Texto inicial')]),
                            fakeEl('table', [row1, row2])
                        ];
                    }
                };
                return el;
            }
        };
        try {
            const bytes = FD.build('<p>Texto inicial</p><table><tr><td colspan="2">ANEXO</td></tr><tr><th>Responsable</th></tr></table>', 'Doc Test');
            const entries = await Zip.parseZip(bytes);
            const names = entries.map((e) => e.name);
            assert.ok(names.includes('word/document.xml'));
            const docXml = new TextDecoder().decode(entries.find((e) => e.name === 'word/document.xml').data);
            assert.ok(docXml.includes('<w:gridSpan w:val="2"/>'), 'Expected colspan gridSpan in word/document.xml');
            assert.ok(docXml.includes('Norte &amp; Sur SpA'));
        } finally {
            globalThis.document = prevDoc;
        }
    });

    await test('FiniquitoDocx.build renders h1, h3, ol/li, .dc-firmas, 3-col tables and page breaks', async () => {
        const fakeTextNode = (txt) => ({ nodeType: 3, textContent: txt });
        const fakeEl = (tag, children = [], attrs = {}, classes = []) => {
            const cls = new Set(classes);
            const node = {
                nodeType: 1,
                tagName: tag.toUpperCase(),
                childNodes: children,
                children: children.filter((c) => c.nodeType === 1),
                parentNode: null,
                classList: { contains: (c) => cls.has(c) },
                getAttribute: (k) => (k in attrs ? attrs[k] : null),
                closest: () => null,
                querySelectorAll: (sel) => (sel === 'tr' ? children.filter((c) => c.tagName === 'TR') : [])
            };
            children.forEach((c) => { if (c && c.nodeType === 1) c.parentNode = node; });
            return node;
        };
        const prevDoc = globalThis.document;
        globalThis.document = {
            createElement: () => ({
                nodeType: 1,
                set innerHTML(_val) {
                    const tabla3 = fakeEl('table', [
                        fakeEl('tr', [fakeEl('th', [fakeTextNode('Op')]), fakeEl('th', [fakeTextNode('Riesgo')]), fakeEl('th', [fakeTextNode('Mitigación')])]),
                        fakeEl('tr', [fakeEl('td', [fakeTextNode('Biometría')]), fakeEl('td', [fakeTextNode('Medio')]), fakeEl('td', [fakeTextNode('PIN alternativo')])])
                    ]);
                    const firmas = fakeEl('div', [
                        fakeEl('div', [fakeTextNode('Empleador SpA'), fakeEl('small', [fakeTextNode('RUT 76.111.111-1')])], {}, ['dc-firma']),
                        fakeEl('div', [fakeTextNode('Trabajador'), fakeEl('small', [fakeTextNode('RUT 15.222.222-2')])], {}, ['dc-firma'])
                    ], {}, ['dc-firmas']);
                    this.childNodes = [
                        fakeEl('h1', [fakeTextNode('Contrato de Trabajo')]),
                        fakeEl('h3', [fakeTextNode('Cláusula Primera')]),
                        fakeEl('ol', [fakeEl('li', [fakeTextNode('Elaborar pan')]), fakeEl('li', [fakeTextNode('Atender caja')])]),
                        tabla3,
                        firmas,
                        fakeEl('br', [], { style: 'page-break-before:always' }),
                        fakeEl('p', [fakeTextNode('Anexo página 2')])
                    ];
                }
            })
        };
        try {
            const bytes = FD.build('ignored-stub', 'Contrato Extendido');
            const entries = await Zip.parseZip(bytes);
            const docXml = new TextDecoder().decode(entries.find((e) => e.name === 'word/document.xml').data);
            assert.ok(docXml.includes('Contrato de Trabajo'), 'Expected h1 text');
            assert.ok(docXml.includes('Cláusula Primera'), 'Expected h3 text');
            assert.ok(docXml.includes('1. ') && docXml.includes('Elaborar pan') && docXml.includes('2. '), 'Expected numbered list');
            assert.strictEqual((docXml.match(/<w:gridCol /g) || []).length, 5, 'Expected 3 gridCols on 3-col table + 2 gridCols on .dc-firmas');
            assert.ok(docXml.includes('Empleador SpA') && docXml.includes('RUT 15.222.222-2'), 'Expected .dc-firmas text');
            assert.ok(docXml.includes('<w:br w:type="page"/>'), 'Expected page break in DOCX');
            assert.ok(docXml.includes('Anexo página 2'), 'Expected content after page break');
        } finally {
            globalThis.document = prevDoc;
        }
    });

    console.log(`\nALL PASSED: ${passed}/${passed}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
