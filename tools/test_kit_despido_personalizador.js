const assert = require('assert');
const fs = require('fs');
const path = require('path');

require('../js/kit_despido_personalizador.js');
const P = globalThis.CLKitDespidoPersonalizador;

async function main() {
    let passed = 0;
    function test(name, fn) {
        return Promise.resolve().then(fn).then(() => {
            passed += 1;
            console.log(`PASS: ${name}`);
        });
    }

    const zipPath = path.join(__dirname, '..', 'api', 'assets', 'Pack_Cartas_Despido_por_Causal_Chile_2026.zip');
    const masterBuf = fs.readFileSync(zipPath);

    await test('parseZip decodes all 23 entries of Pack_Cartas_Despido_por_Causal_Chile_2026.zip', async () => {
        const entries = await P.parseZip(masterBuf);
        const files = entries.filter((e) => !e.isDir);
        assert.strictEqual(files.length, 23, `Expected 23 files, got ${files.length}`);
        const hasXlsx = files.some((e) => e.name === '22_Control_Despidos_Plazos_Art162_y_Cotizaciones_2026.xlsx');
        assert.ok(hasXlsx, 'Missing Excel control workbook in zip');
    });

    await test('CATALOGO matches every file inside Pack_Cartas_Despido_por_Causal_Chile_2026.zip', async () => {
        const entries = await P.parseZip(masterBuf);
        const names = new Set(entries.map((e) => e.name));
        assert.strictEqual(P.CATALOGO.length, 23);
        for (const item of P.CATALOGO) {
            assert.ok(names.has(item.zipPath), `Missing zipPath from CATALOGO: ${item.zipPath}`);
        }
    });

    await test('personalizeMasterZip replaces XML-escaped employer/worker/Excel tokens and preserves historical case brackets', async () => {
        const sample = {
            razonSocial: 'Comercial Norte & Sur SpA',
            rutEmpresa: '76.890.123-K',
            representante: 'Patricia Morales Ríos',
            rutRepresentante: '12.345.678-5',
            ciudad: 'Valparaíso',
            direccionEmpresa: 'Av. Pedro Montt 2100, Valparaíso',
            notaria: 'Notaría Fischer, Prat 656',
            fechaCarta: '13 de noviembre de 2026',
            diaTermino: '13',
            trabajadorNombre: 'Juan Pérez & Díaz',
            trabajadorRut: '18.234.567-2',
            trabajadorCargo: 'Encargado de Bodega',
            trabajadorDomicilio: 'Calle Yungay 440',
            trabajadorComuna: 'Viña del Mar',
            saludInstitucion: 'FONASA',
            mutualInstitucion: 'ACHS',
            mesCotizaciones: 'octubre de 2026'
        };

        const out = await P.personalizeMasterZip(masterBuf, sample);
        assert.strictEqual(out.filename, 'Pack_Cartas_Despido_Personalizado_76890123K.zip');
        assert.strictEqual(out.entriesCount, 23);

        const outEntries = await P.parseZip(out.bytes);
        const dec = new TextDecoder('utf-8');

        // 01_Carta_Art161
        const doc01 = outEntries.find((e) => e.name === '01_Carta_Art161_Necesidades_de_la_Empresa.docx');
        const doc01Inner = await P.parseZip(doc01.data);
        const doc01Xml = dec.decode(doc01Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc01Xml.includes('Comercial Norte &amp; Sur SpA'), 'Escaped & should be present in doc01');
        assert.ok(doc01Xml.includes('Juan Pérez &amp; Díaz'), 'Worker name replaced & escaped in doc01');
        assert.ok(doc01Xml.includes('Notaría Fischer, Prat 656'), 'Notaria replaced in doc01');
        assert.ok(!doc01Xml.includes('[RAZÓN SOCIAL EMPRESA]'), 'No leftover company placeholder in doc01');
        assert.ok(!doc01Xml.includes('[DÍA DE CESE]'), 'Cese day replaced in doc01');
        assert.ok(doc01Xml.includes('[TAREAS QUE SE REORGANIZAN'), 'Facts bracket must stay untouched');

        // 18_Citacion preserves [DESCRIBE BREVEMENTE...]
        const doc18 = outEntries.find((e) => e.name === '18_Citacion_y_Acta_de_Descargos.docx');
        const doc18Inner = await P.parseZip(doc18.data);
        const doc18Xml = dec.decode(doc18Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc18Xml.includes('[DESCRIBE BREVEMENTE LOS HECHOS QUE SE LE ATRIBUYEN]'), 'Facts prompt must stay untouched');
        assert.ok(doc18Xml.includes('[FECHA]'), 'Historical [FECHA] must NOT be overwritten');
        assert.ok(doc18Xml.includes('[HORA]'), '[HORA] must remain untouched');
        const doc18Paras = await P.extractDocPreviewText(doc18.data, 35);
        assert.ok(doc18Paras.some((t) => t.includes('el día [FECHA], a las [HORA]')), 'Historical [FECHA] intact in paragraph text');

        // 20_Estado preserves AFP [NOMBRE] and Comprobante [FECHA] while filling FONASA and ACHS
        const doc20 = outEntries.find((e) => e.name === '20_Estado_de_Pago_de_Cotizaciones_Previsionales.docx');
        const doc20Inner = await P.parseZip(doc20.data);
        const doc20Xml = dec.decode(doc20Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc20Xml.includes('[NOMBRE]'), 'AFP [NOMBRE] must remain untouched');
        assert.ok(doc20Xml.includes('[FECHA]'), 'Comprobante date [FECHA] must remain untouched');
        const doc20Paras = await P.extractDocPreviewText(doc20.data, 40);
        assert.ok(doc20Paras.some((t) => t.includes('AFP [NOMBRE]')), 'AFP [NOMBRE] intact in paragraph text');
        assert.ok(doc20Paras.some((t) => t.includes('de fecha [FECHA]')), 'Comprobante date [FECHA] intact in paragraph text');
        assert.ok(doc20Xml.includes('FONASA'), 'Salud institution replaced');
        assert.ok(doc20Xml.includes('ACHS'), 'Mutual institution replaced');

        // 22_Control XLSX sheet1
        const xlsx = outEntries.find((e) => e.name === '22_Control_Despidos_Plazos_Art162_y_Cotizaciones_2026.xlsx');
        const xlsxInner = await P.parseZip(xlsx.data);
        const sheet1Xml = dec.decode(xlsxInner.find((e) => e.name === 'xl/worksheets/sheet1.xml').data);
        assert.ok(sheet1Xml.includes('Comercial Norte &amp; Sur SpA'), 'Company name replaced in Excel sheet1');
        assert.ok(sheet1Xml.includes('Av. Pedro Montt 2100, Valparaíso'), 'Company address replaced in Excel sheet1');
        assert.ok(!sheet1Xml.includes('[RAZ&#211;N SOCIAL EMPRESA]'), 'Encoded company placeholder must be gone in Excel sheet1');

        // Preview extraction
        const paras = await P.extractDocPreviewText(doc01.data, 35);
        assert.ok(paras.some((t) => t.includes('Comercial Norte & Sur SpA')), 'Preview text decoded properly');
    });

    await test('filterByGrupo partitions 161, 160, 159, apoyo cleanly', () => {
        assert.strictEqual(P.filterByGrupo('todas').length, 23);
        assert.strictEqual(P.filterByGrupo('161').length, 2);
        assert.strictEqual(P.filterByGrupo('160').length, 11);
        assert.strictEqual(P.filterByGrupo('159').length, 3);
        assert.strictEqual(P.filterByGrupo('apoyo').length, 7);
    });

    console.log(`ALL PASSED: ${passed}/4`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
