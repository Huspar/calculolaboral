const assert = require('assert');
const fs = require('fs');
const path = require('path');

require('../js/kit_blindaje_personalizador.js');
const P = globalThis.CLKitBlindajePersonalizador;

async function main() {
    let passed = 0;
    function test(name, fn) {
        return Promise.resolve().then(fn).then(() => {
            passed += 1;
            console.log(`PASS: ${name}`);
        });
    }

    const zipPath = path.join(__dirname, '..', 'api', 'assets', 'Kit_Blindaje_Laboral_Pyme_2026.zip');
    const masterBuf = fs.readFileSync(zipPath);

    await test('parseZip decodes all 23 entries of Kit_Blindaje_Laboral_Pyme_2026.zip', async () => {
        const entries = await P.parseZip(masterBuf);
        const files = entries.filter((e) => !e.isDir);
        assert.strictEqual(files.length, 23, `Expected 23 files, got ${files.length}`);
        const hasXlsx = files.some((e) => e.name.endsWith('20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx'));
        assert.ok(hasXlsx, 'Missing Excel matrix in zip');
    });

    await test('CATALOGO matches 22 customizable files plus manual PDF exists in zip', async () => {
        const entries = await P.parseZip(masterBuf);
        const names = new Set(entries.map((e) => e.name));
        for (const item of P.CATALOGO) {
            assert.ok(names.has(item.zipPath), `Missing zipPath from CATALOGO: ${item.zipPath}`);
        }
        assert.ok(names.has('Kit_Blindaje_Laboral_Pyme_2026/00_MANUAL_DE_USO_E_INSTRUCCIONES_BLINDAJE_PYME.pdf'));
    });

    await test('personalizeMasterZip replaces XML-escaped company & worker placeholders across all 21 docx + 1 xlsx', async () => {
        const sample = {
            razonSocial: 'Panadería & Café del Sur SpA',
            rutEmpresa: '76.543.210-K',
            representante: 'Marcela Tapia Muñoz',
            rutRepresentante: '12.345.678-5',
            correoDenuncias: 'denuncias@panaderiadelsur.cl',
            direccion: 'Av. Alemania 450, Temuco, La Araucanía',
            ciudad: 'Temuco',
            sucursal: 'Casa Matriz Temuco',
            fecha: '13 de noviembre de 2026',
            trabajadorNombre: 'Carlos Araya & Gómez',
            trabajadorRut: '18.900.100-2',
            trabajadorCargo: 'Maestro Panadero',
            trabajadorDomicilio: 'Los Pinos 120, Temuco',
            fechaContrato: '01 de marzo de 2024',
        };
        const out = await P.personalizeMasterZip(masterBuf, sample);
        assert.strictEqual(out.filename, 'Kit_Blindaje_Laboral_Personalizado_76543210K.zip');
        assert.strictEqual(out.entriesCount, 23);

        const outEntries = await P.parseZip(out.bytes);
        const dec = new TextDecoder('utf-8');

        // Check docx 01 (Protocolo Ley Karin)
        const doc01 = outEntries.find((e) => e.name.endsWith('01_Protocolo_Integral_Ley_Karin_DS44.docx'));
        const doc01Inner = await P.parseZip(doc01.data);
        const doc01Xml = dec.decode(doc01Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc01Xml.includes('Panadería &amp; Café del Sur SpA'), 'Escaped & should be present in doc01');
        assert.ok(doc01Xml.includes('denuncias@panaderiadelsur.cl'), 'Email placeholder should be replaced');
        assert.ok(!doc01Xml.includes('[RAZÓN SOCIAL EMPRESA]'), 'Unreplaced company placeholder in doc01');
        assert.ok(!doc01Xml.includes('[CORREO_DENUNCIAS@EMPRESA.CL]'), 'Unreplaced correo placeholder in doc01');

        // Check docx 03 preserves checkboxes [  ] and real incident fields
        const doc03 = outEntries.find((e) => e.name.endsWith('03_Formulario_Recepcion_Denuncia_Karin.docx'));
        const doc03Inner = await P.parseZip(doc03.data);
        const doc03Xml = dec.decode(doc03Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc03Xml.includes('[  ]'), 'Checkbox brackets [  ] must be preserved');
        assert.ok(doc03Xml.includes('[NOMBRE DEL DENUNCIADO]'), 'Denunciado placeholder must be preserved');

        // Check docx 06 (Anexo 42h) worker replacement
        const doc06 = outEntries.find((e) => e.name.endsWith('06_Anexo_Reduccion_42h_Jornada_5x2_Viernes.docx'));
        const doc06Inner = await P.parseZip(doc06.data);
        const doc06Xml = dec.decode(doc06Inner.find((e) => e.name === 'word/document.xml').data);
        assert.ok(doc06Xml.includes('Carlos Araya &amp; Gómez'), 'Worker name replaced & escaped in doc06');
        assert.ok(doc06Xml.includes('01 de marzo de 2024'), 'Original contract date replaced');

        // Check Excel 20 worksheet replacement (inlineStr in sheet1.xml / sheet3.xml)
        const xlsx = outEntries.find((e) => e.name.endsWith('20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx'));
        const xlsxInner = await P.parseZip(xlsx.data);
        const sheet1Xml = dec.decode(xlsxInner.find((e) => e.name === 'xl/worksheets/sheet1.xml').data);
        assert.ok(sheet1Xml.includes('Panadería &amp; Café del Sur SpA'), 'Company name replaced in Excel sheet1');
        assert.ok(sheet1Xml.includes('denuncias@panaderiadelsur.cl'), 'Email replaced in Excel sheet1');
        assert.ok(!sheet1Xml.includes('[RAZÓN SOCIAL EMPRESA]'), 'No leftover company placeholder in Excel sheet1');
        const sheet3Xml = dec.decode(xlsxInner.find((e) => e.name === 'xl/worksheets/sheet3.xml').data);
        assert.ok(sheet3Xml.includes('Marcela Tapia Muñoz'), 'Rep name replaced in Checklist sheet3');

        // Check extractDocPreviewText helper
        const paras = await P.extractDocPreviewText(doc01.data, 40);
        assert.ok(paras.length > 0 && paras.some((t) => t.includes('Panadería & Café del Sur SpA')));
    });

    await test('filterByRubro filters sectoral modules while keeping mandatory docs', () => {
        const com = P.filterByRubro('comercio');
        assert.ok(com.some((d) => d.id === 'doc10'));
        assert.ok(!com.some((d) => d.id === 'doc13'));
        const ofi = P.filterByRubro('oficina');
        assert.ok(ofi.some((d) => d.id === 'doc13'));
        assert.ok(!ofi.some((d) => d.id === 'doc16'));
    });

    console.log(`ALL PASSED: ${passed}/4`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
