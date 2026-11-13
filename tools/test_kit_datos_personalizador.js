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

    console.log(`\nALL PASSED: ${passed}/${passed}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
