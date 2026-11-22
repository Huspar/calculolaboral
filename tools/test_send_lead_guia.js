// Prueba del contenido de los correos de /api/send-lead tras los cambios del lead magnet (#11).
// No envia nada: stub de fetch que captura los POST a Resend.
process.env.RESEND_API_KEY = 'test-key';

const captured = [];
global.fetch = async (url, opts) => {
    captured.push({ url: String(url), body: opts && opts.body ? String(opts.body) : '' });
    return { ok: true, status: 200, json: async () => ({ id: 'test' }) };
};

const handler = require('../api/send-lead.js');

function makeRes() {
    return {
        statusCode: 200, ended: false, jsonBody: null,
        status(c) { this.statusCode = c; return this; },
        setHeader() { return this; },
        json(o) { this.jsonBody = o; this.ended = true; return this; },
        end() { this.ended = true; return this; }
    };
}

async function enviar(body) {
    const req = {
        method: 'POST',
        headers: { origin: 'https://calculolaboral.cl', 'content-length': String(JSON.stringify(body).length), 'x-forwarded-for': '190.' + Math.floor(Math.random() * 250) + '.1.1' },
        body: Object.assign({ website: '' }, body)
    };
    const res = makeRes();
    await handler(req, res);
    return res;
}

let fails = 0;
function check(name, cond) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + name);
    if (!cond) fails++;
}

(async () => {
    // 1. LeadMagnet: la guia ahora trae los CTAs
    captured.length = 0;
    let r = await enviar({ nombre: 'Ana Prueba', correo: 'ana@test.cl', telefono: '', tipo: 'LeadMagnet', fuente: 'Test - Guia', monto_calculado: '0' });
    const userMagnet = captured.filter(c => c.body.indexOf('ana@test.cl') !== -1).map(c => c.body).join('\n');
    check('LM1 respuesta ok', r.statusCode === 200 && r.jsonBody && r.jsonBody.success === true);
    check('LM2 CTA generador con utm de guia', userMagnet.indexOf('generador-finiquito-chile?utm_source=guia-finiquito') !== -1);
    check('LM3 CTA calculadora', userMagnet.indexOf('finiquito_calculator') !== -1);
    check('LM4 CTA revision legal', userMagnet.indexOf('finiquito_calculator#revision-caso') !== -1);
    check('LM5 enlace de la guia presente', userMagnet.indexOf('lead-magnet-finiquito.pdf') !== -1);

    // 2. AnexoChecklist: el anexo ya no recibe la guia del finiquito
    captured.length = 0;
    r = await enviar({ nombre: 'Employer Prueba', correo: 'emp@test.cl', telefono: '', tipo: 'AnexoChecklist', fuente: 'Test - Anexo', monto_calculado: '0' });
    const userAnexo = captured.filter(c => c.body.indexOf('emp@test.cl') !== -1).map(c => c.body).join('\n');
    check('AX1 respuesta ok', r.statusCode === 200 && r.jsonBody && r.jsonBody.success === true);
    check('AX2 lleva al generador de anexo', userAnexo.indexOf('generador-anexo-40-horas') !== -1);
    check('AX3 lleva al checklist DT', userAnexo.indexOf('checklist-fiscalizacion-dt-pymes-chile') !== -1);
    check('AX4 ya no manda la guia del finiquito', userAnexo.indexOf('lead-magnet-finiquito.pdf') === -1 && userAnexo.indexOf('Qu\u00e9 hago con mi finiquito') === -1);

    // 3. InformePDF finiquito: el informe con monto ahora incluye la guia de regalo
    captured.length = 0;
    r = await enviar({ nombre: 'Wilber Prueba', correo: 'wil@test.cl', telefono: '', tipo: 'InformePDF', producto: 'finiquito', fuente: 'Test - Informe', monto_calculado: '4132000' });
    const userFini = captured.filter(c => c.body.indexOf('wil@test.cl') !== -1).map(c => c.body).join('\n');
    check('IF1 respuesta ok', r.statusCode === 200 && r.jsonBody && r.jsonBody.success === true);
    check('IF2 monto calculado en el correo', userFini.indexOf('4.132.000') !== -1 || userFini.indexOf('4132000') !== -1);
    check('IF3 guia de regalo incluida', userFini.indexOf('lead-magnet-finiquito.pdf') !== -1);
    check('IF4 generador 9.990 presente', userFini.indexOf('$9.990') !== -1);

    // 4. InformePDF sueldo: sin la guia del finiquito
    captured.length = 0;
    r = await enviar({ nombre: 'Sueldo Prueba', correo: 'sue@test.cl', telefono: '', tipo: 'InformePDF', producto: 'sueldo_liquido', fuente: 'Test - Informe Sueldo', monto_calculado: '650000' });
    const userSueldo = captured.filter(c => c.body.indexOf('sue@test.cl') !== -1).map(c => c.body).join('\n');
    check('IS1 respuesta ok', r.statusCode === 200 && r.jsonBody && r.jsonBody.success === true);
    check('IS2 sin guia del finiquito', userSueldo.indexOf('lead-magnet-finiquito.pdf') === -1);

    console.log(fails ? ('\nTOTAL FAILS: ' + fails) : '\nTODAS LAS PRUEBAS CORRECTAS');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
