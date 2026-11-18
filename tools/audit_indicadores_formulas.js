/*
 * Auditoría automatizada de indicadores económicos, disponibilidad en producción y fórmulas laborales.
 * Modos:
 *   node tools/audit_indicadores_formulas.js --diario [--json]
 *   node tools/audit_indicadores_formulas.js --completo [--json]
 *
 * Solo lectura sobre el código fuente; tools/previred_indicadores.py puede guardar el PDF mensual en tools/previred/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROD_URLS = [
    'https://calculolaboral.cl/',
    'https://calculolaboral.cl/sueldo_liquido.html',
    'https://calculolaboral.cl/finiquito_calculator.html',
    'https://calculolaboral.cl/demo-contadores',
    'https://calculolaboral.cl/app'
];
const TESTS_REQUIEREN_DB = new Set(['test_pyme_almacen_db.js']);

function fechaChile() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    const hoyISO = `${map.year}-${map.month}-${map.day}`;
    return {
        hoyISO,
        mesActual: `${map.year}-${map.month}`,
        diaMes: Number(map.day)
    };
}

async function fetchJson(url, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'CalculoLaboral-Audit/1.0' },
            signal: ctrl.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

async function checkProdUrl(url, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'CalculoLaboral-Audit/1.0' },
            signal: ctrl.signal
        });
        return { url, status: res.status, ok: res.ok };
    } catch (err) {
        return { url, status: 0, ok: false, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

function isoDatePrefix(raw) {
    const m = String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

function numValido(x) {
    return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

function parseClMoney(str) {
    if (!str) return null;
    const cleaned = String(str).replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function diffDaysISO(a, b) {
    const da = new Date(a + 'T00:00:00Z');
    const db = new Date(b + 'T00:00:00Z');
    return Math.round((db - da) / 86400000);
}

async function auditarDiario(ctx) {
    const { hoyISO, mesActual, diaMes } = ctx;
    const alertas = [];
    const advertencias = [];

    const apis = {};
    for (const [nombre, url] of [['findic', 'https://findic.cl/api'], ['mindicador', 'https://mindicador.cl/api']]) {
        try {
            const d = await fetchJson(url);
            const ufVal = Number(d?.uf?.valor);
            const ufFecha = isoDatePrefix(d?.uf?.fecha);
            const utmVal = Number(d?.utm?.valor);
            const utmFecha = isoDatePrefix(d?.utm?.fecha);
            const ipcVal = d?.ipc?.valor !== undefined ? Number(d.ipc.valor) : null;
            const ipcFecha = isoDatePrefix(d?.ipc?.fecha);
            apis[nombre] = {
                ok: numValido(ufVal) && numValido(utmVal),
                uf: { valor: ufVal, fecha: ufFecha },
                utm: { valor: utmVal, fecha: utmFecha },
                ipc: { valor: ipcVal, fecha: ipcFecha }
            };
            if (!apis[nombre].ok) {
                alertas.push(`${nombre}: respuesta sin UF o UTM numérica válida`);
            }
            if (ufFecha !== hoyISO) {
                alertas.push(`${nombre}: UF atrasada o distinta a hoy Chile (${ufFecha} vs ${hoyISO})`);
            }
            if (!utmFecha || utmFecha.slice(0, 7) !== mesActual) {
                const msg = `${nombre}: UTM (${utmFecha || 'sin fecha'}) no corresponde a ${mesActual}`;
                if (diaMes >= 2) alertas.push(msg);
                else advertencias.push(msg);
            }
            if (ipcFecha && diffDaysISO(ipcFecha, hoyISO) > 65) {
                advertencias.push(`${nombre}: IPC con fecha antigua (${ipcFecha})`);
            }
        } catch (err) {
            apis[nombre] = { ok: false, error: err.message };
            alertas.push(`${nombre}: error al consultar API (${err.message})`);
        }
    }

    if (apis.findic?.ok && apis.mindicador?.ok) {
        const diffUf = Math.abs(apis.findic.uf.valor - apis.mindicador.uf.valor);
        if (diffUf > 0.05) {
            alertas.push(`Discrepancia UF entre findic (${apis.findic.uf.valor}) y mindicador (${apis.mindicador.uf.valor})`);
        }
        const diffUtm = Math.abs(apis.findic.utm.valor - apis.mindicador.utm.valor);
        if (diffUtm > 1) {
            alertas.push(`Discrepancia UTM entre findic (${apis.findic.utm.valor}) y mindicador (${apis.mindicador.utm.valor})`);
        }
    }

    // Coherencia con CONSTANTS y parámetros del repo
    delete require.cache[require.resolve('../js/constants.js')];
    const CONSTANTS = require('../js/constants.js');
    const PARAMETROS = require('../js/liquidacion_parametros.js');

    const utmViva = apis.findic?.ok ? apis.findic.utm.valor : (apis.mindicador?.ok ? apis.mindicador.utm.valor : null);
    if (utmViva !== null && Math.abs(CONSTANTS.UTM - utmViva) > 1) {
        alertas.push(`CONSTANTS.UTM (${CONSTANTS.UTM}) difiere de UTM viva (${utmViva}) — revisar actualizar_utm.py`);
    }

    // Verificar tramos IUSC estáticos vs recalculateTaxBrackets(CONSTANTS.UTM)
    const copiaTramos = CONSTANTS.TAX_BRACKETS.map((t) => ({ ...t }));
    const tmpObj = { UTM: CONSTANTS.UTM, TAX_BRACKETS: [] };
    CONSTANTS.recalculateTaxBrackets.call(tmpObj, CONSTANTS.UTM);
    copiaTramos.forEach((tramo, idx) => {
        const calc = tmpObj.TAX_BRACKETS[idx];
        if (!calc) return;
        if (Number.isFinite(tramo.limit) && Math.abs(tramo.limit - calc.limit) > 2) {
            alertas.push(`CONSTANTS.TAX_BRACKETS[${idx}].limit (${tramo.limit}) no calza con UTM ${CONSTANTS.UTM} (${calc.limit})`);
        }
        if (Math.abs(tramo.rebate - calc.rebate) > 2) {
            alertas.push(`CONSTANTS.TAX_BRACKETS[${idx}].rebate (${tramo.rebate}) no calza con UTM ${CONSTANTS.UTM} (${calc.rebate})`);
        }
    });

    const respaldoMes = PARAMETROS.RESPALDO[mesActual];
    if (!respaldoMes) {
        const msg = `js/liquidacion_parametros.js sin RESPALDO para ${mesActual}`;
        if (diaMes >= 5) advertencias.push(msg);
    } else if (utmViva !== null && Math.abs(respaldoMes.utm - utmViva) > 1) {
        alertas.push(`RESPALDO[${mesActual}].utm (${respaldoMes.utm}) difiere de UTM viva (${utmViva})`);
    }

    // Producción en vivo
    const produccion = await Promise.all(PROD_URLS.map((u) => checkProdUrl(u)));
    produccion.forEach((p) => {
        if (!p.ok) {
            alertas.push(`Producción ${p.url} respondió HTTP ${p.status}${p.error ? ' (' + p.error + ')' : ''}`);
        }
    });

    return {
        alertas,
        advertencias,
        indicadores: {
            apis,
            constants: { UF_respaldo: CONSTANTS.UF, UTM: CONSTANTS.UTM, IMM: CONSTANTS.IMM },
            respaldoMes: respaldoMes || null
        },
        produccion
    };
}

function auditarPrevired(ctx, CONSTANTS, PARAMETROS, alertas, advertencias) {
    const proc = spawnSync('python', [path.join(ROOT, 'tools', 'previred_indicadores.py'), ctx.mesActual], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 30000
    });
    if (proc.status !== 0) {
        advertencias.push(`previred_indicadores.py ${ctx.mesActual} no completó (exit ${proc.status}): ${(proc.stderr || proc.stdout || '').trim().slice(0, 200)}`);
        return { ok: false, raw: (proc.stdout || proc.stderr || '').trim() };
    }
    const out = proc.stdout || '';
    const mUf = out.match(/UF fin de mes:\s*\$\s*([\d.,]+)/);
    const mTopeAfpPeso = out.match(/tope AFP \$:\s*\$\s*([\d.,]+)/);
    const mImm = out.match(/ingreso mínimo:\s*\$\s*([\d.,]+)/i);
    const mTopeCesPeso = out.match(/tope cesantía \$:\s*\$\s*([\d.,]+)/i);
    const mTopeAfpUf = out.match(/Para afiliados a una AFP\s*\(([\d.,]+)\s*UF\)/i);
    const mTopeCesUf = out.match(/Para Seguro de Cesantía\s*\(([\d.,]+)\s*UF\)/i);

    const parsed = {
        ufFinMes: mUf ? parseClMoney(mUf[1]) : null,
        topeAfpPesos: mTopeAfpPeso ? parseClMoney(mTopeAfpPeso[1]) : null,
        imm: mImm ? parseClMoney(mImm[1]) : null,
        topeCesantiaPesos: mTopeCesPeso ? parseClMoney(mTopeCesPeso[1]) : null,
        topeAfpUF: mTopeAfpUf ? parseClMoney(mTopeAfpUf[1]) : null,
        topeCesantiaUF: mTopeCesUf ? parseClMoney(mTopeCesUf[1]) : null
    };

    if (parsed.imm !== null && parsed.imm !== CONSTANTS.IMM) {
        alertas.push(`Previred IMM ($${parsed.imm}) difiere de CONSTANTS.IMM ($${CONSTANTS.IMM})`);
    }
    if (parsed.topeAfpUF !== null && Math.abs(parsed.topeAfpUF - CONSTANTS.TOPE_IMPONIBLE_AFP) > 0.01) {
        alertas.push(`Previred Tope AFP (${parsed.topeAfpUF} UF) difiere de CONSTANTS.TOPE_IMPONIBLE_AFP (${CONSTANTS.TOPE_IMPONIBLE_AFP} UF)`);
    }
    if (parsed.topeCesantiaUF !== null && Math.abs(parsed.topeCesantiaUF - CONSTANTS.TOPE_IMPONIBLE_CESANTIA) > 0.01) {
        alertas.push(`Previred Tope Cesantía (${parsed.topeCesantiaUF} UF) difiere de CONSTANTS.TOPE_IMPONIBLE_CESANTIA (${CONSTANTS.TOPE_IMPONIBLE_CESANTIA} UF)`);
    }
    const respaldo = PARAMETROS.RESPALDO[ctx.mesActual];
    if (respaldo && parsed.ufFinMes !== null && Math.abs(respaldo.uf - parsed.ufFinMes) > 0.05) {
        alertas.push(`Previred UF fin de mes (${parsed.ufFinMes}) difiere de RESPALDO[${ctx.mesActual}].uf (${respaldo.uf})`);
    }
    if (parsed.ufFinMes !== null && parsed.topeAfpPesos !== null) {
        const esp = Math.round(parsed.ufFinMes * CONSTANTS.TOPE_IMPONIBLE_AFP);
        if (Math.abs(esp - parsed.topeAfpPesos) > 2) {
            alertas.push(`Tope AFP $ calculado (${esp}) difiere de Previred (${parsed.topeAfpPesos})`);
        }
    }
    if (parsed.ufFinMes !== null && parsed.topeCesantiaPesos !== null) {
        const esp = Math.round(parsed.ufFinMes * CONSTANTS.TOPE_IMPONIBLE_CESANTIA);
        if (Math.abs(esp - parsed.topeCesantiaPesos) > 2) {
            alertas.push(`Tope Cesantía $ calculado (${esp}) difiere de Previred (${parsed.topeCesantiaPesos})`);
        }
    }
    return { ok: true, parsed };
}

function auditarConsistenciaInterna(ctx, CONSTANTS, PARAMETROS, alertas, advertencias) {
    const vig = PARAMETROS.vigenciaDe(ctx.mesActual);
    if (!vig) {
        alertas.push(`js/liquidacion_parametros.js sin vigencia para ${ctx.mesActual}`);
        return;
    }
    if (vig.imm !== CONSTANTS.IMM) {
        alertas.push(`IMM en vigenciaDe(${ctx.mesActual}) (${vig.imm}) difiere de CONSTANTS.IMM (${CONSTANTS.IMM})`);
    }
    if (Math.abs(vig.topeAfpUF - CONSTANTS.TOPE_IMPONIBLE_AFP) > 0.01) {
        alertas.push(`topeAfpUF en vigenciaDe(${ctx.mesActual}) (${vig.topeAfpUF}) difiere de CONSTANTS (${CONSTANTS.TOPE_IMPONIBLE_AFP})`);
    }
    if (Math.abs(vig.topeAfcUF - CONSTANTS.TOPE_IMPONIBLE_CESANTIA) > 0.01) {
        alertas.push(`topeAfcUF en vigenciaDe(${ctx.mesActual}) (${vig.topeAfcUF}) difiere de CONSTANTS (${CONSTANTS.TOPE_IMPONIBLE_CESANTIA})`);
    }
    Object.keys(CONSTANTS.AFP_RATES).forEach((afp) => {
        if (vig.afp[afp] !== CONSTANTS.AFP_RATES[afp]) {
            alertas.push(`Tasa AFP ${afp} difiere entre CONSTANTS (${CONSTANTS.AFP_RATES[afp]}) y liquidacion_parametros (${vig.afp[afp]})`);
        }
    });
    if (vig.empleador && vig.empleador.porConfirmar) {
        advertencias.push(`vigenciaDe(${ctx.mesActual}).empleador tiene porConfirmar=true (verificar SIS y Ley 21.735 en Previred/SP)`);
    }
}

function ejecutarTests(alertas) {
    const files = fs.readdirSync(path.join(ROOT, 'tools'))
        .filter((f) => f.startsWith('test_') && f.endsWith('.js'))
        .sort();
    const ejecutados = [];
    const fallaron = [];
    const omitidos = [];

    for (const f of files) {
        if (TESTS_REQUIEREN_DB.has(f)) {
            omitidos.push({ archivo: f, motivo: 'Requiere --entorno=pruebas con base Neon' });
            continue;
        }
        const proc = spawnSync('node', [path.join(ROOT, 'tools', f)], {
            cwd: ROOT,
            encoding: 'utf8',
            timeout: 30000
        });
        const ok = proc.status === 0;
        ejecutados.push({ archivo: f, ok, exitCode: proc.status });
        if (!ok) {
            const detalle = (proc.stderr || proc.stdout || '').trim().split(/\r?\n/).slice(-5).join(' | ');
            fallaron.push({ archivo: f, exitCode: proc.status, detalle });
            alertas.push(`Test fallido: tools/${f} (exit ${proc.status})`);
        }
    }
    return {
        totalEnCarpeta: files.length,
        ejecutados: ejecutados.length,
        pasaron: ejecutados.length - fallaron.length,
        fallaron,
        omitidos
    };
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const completo = args.has('--completo');
    const jsonOut = args.has('--json');
    const ctx = fechaChile();

    const diario = await auditarDiario(ctx);
    const resultado = {
        modo: completo ? 'completo' : 'diario',
        fechaChile: ctx.hoyISO,
        mesActual: ctx.mesActual,
        ok: diario.alertas.length === 0,
        alertas: diario.alertas,
        advertencias: diario.advertencias,
        indicadores: diario.indicadores,
        produccion: diario.produccion
    };

    if (completo) {
        const CONSTANTS = require('../js/constants.js');
        const PARAMETROS = require('../js/liquidacion_parametros.js');
        auditarConsistenciaInterna(ctx, CONSTANTS, PARAMETROS, resultado.alertas, resultado.advertencias);
        resultado.previred = auditarPrevired(ctx, CONSTANTS, PARAMETROS, resultado.alertas, resultado.advertencias);
        resultado.tests = ejecutarTests(resultado.alertas);
        resultado.ok = resultado.alertas.length === 0;
    }

    if (jsonOut) {
        console.log(JSON.stringify(resultado, null, 2));
    } else {
        console.log(`=== Auditoría ${resultado.modo.toUpperCase()} (${resultado.fechaChile}) ===`);
        console.log(`Estado: ${resultado.ok ? 'OK' : 'CON ALERTAS'} | Alertas: ${resultado.alertas.length} | Advertencias: ${resultado.advertencias.length}`);
        if (resultado.alertas.length) {
            console.log('\nALERTAS:');
            resultado.alertas.forEach((a) => console.log('  - ' + a));
        }
        if (resultado.advertencias.length) {
            console.log('\nADVERTENCIAS:');
            resultado.advertencias.forEach((w) => console.log('  - ' + w));
        }
        if (resultado.tests) {
            console.log(`\nTests Node: ${resultado.tests.pasaron}/${resultado.tests.ejecutados} pasaron (${resultado.tests.omitidos.length} omitido por requerir DB)`);
        }
    }

    process.exit(resultado.ok ? 0 : 1);
}

main().catch((err) => {
    console.error('Error fatal en auditoría:', err);
    process.exit(1);
});
