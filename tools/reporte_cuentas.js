#!/usr/bin/env node
/*
 * Reporte de solo lectura de cuentas, solicitudes de acceso y uso del Asistente Pyme en Neon.
 *
 *   node tools/reporte_cuentas.js              resumen legible en consola (hora Chile)
 *   node tools/reporte_cuentas.js --json       salida JSON estructurada (para rutinas u otros scripts)
 *   node tools/reporte_cuentas.js --env=RUTA   lee DATABASE_URL desde archivo .env temporal (sin argumentos con secretos)
 *
 * Nunca descifra datos personales (empresas/trabajadores) ni imprime secretos o tokens.
 */
'use strict';

const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

function leerEnvArchivo(ruta) {
    const raw = fs.readFileSync(ruta, 'utf8');
    const out = {};
    for (const linea of raw.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
        if (!m) continue;
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[m[1]] = val;
    }
    return out;
}

function fmtChile(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

async function consultar(dbUrl) {
    const sql = neon(dbUrl);
    const tablas = await sql.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tiene = new Set(tablas.map(t => t.tablename));

    const cuentas = await sql.query(`
        SELECT c.id, c.email, c.creada, c.ultimo_acceso, c.acepto_encargo,
            (SELECT count(*)::int FROM empresas e WHERE e.cuenta_id = c.id) AS empresas,
            (SELECT count(*)::int FROM trabajadores t JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = c.id) AS trabajadores,
            (SELECT count(*)::int FROM trabajadores t JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = c.id AND t.activo) AS trabajadores_activos,
            (SELECT count(*)::int FROM meses m JOIN trabajadores t ON t.id = m.trabajador_id JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = c.id) AS meses,
            (SELECT count(*)::int FROM documentos d JOIN trabajadores t ON t.id = d.trabajador_id JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = c.id) AS documentos,
            (SELECT count(*)::int FROM vacaciones v JOIN trabajadores t ON t.id = v.trabajador_id JOIN empresas e ON e.id = t.empresa_id WHERE e.cuenta_id = c.id) AS vacaciones,
            (SELECT count(*)::int FROM sesiones s WHERE s.cuenta_id = c.id AND s.revocada IS NULL AND s.vence > now()) AS sesiones_activas
        FROM cuentas c
        ORDER BY c.creada DESC
    `);

    const actividadPorCuenta = tiene.has('actividad')
        ? await sql.query('SELECT cuenta_id, count(*)::int AS total, max(cuando) AS ultima FROM actividad GROUP BY cuenta_id')
        : [];
    const actMap = new Map(actividadPorCuenta.map(a => [a.cuenta_id, a]));

    const enlaces = await sql.query('SELECT email, creado, vence, usado FROM enlaces_acceso ORDER BY creado DESC LIMIT 50');
    const auditoria = await sql.query('SELECT evento, count(*)::int AS total, max(cuando) AS ultima FROM auditoria GROUP BY evento ORDER BY ultima DESC');

    const accionesPorCuenta = tiene.has('actividad')
        ? await sql.query('SELECT cuenta_id, accion, count(*)::int AS total, max(cuando) AS ultima FROM actividad GROUP BY cuenta_id, accion ORDER BY ultima DESC')
        : [];
    const accMap = new Map();
    for (const r of accionesPorCuenta) {
        if (!accMap.has(r.cuenta_id)) accMap.set(r.cuenta_id, []);
        accMap.get(r.cuenta_id).push({ accion: r.accion, total: r.total, ultima: r.ultima });
    }

    return {
        generado: new Date().toISOString(),
        totales: {
            cuentas: cuentas.length,
            cuentasReales: cuentas.filter(c => !/@example\.invalid$/i.test(c.email)).length,
            conUso: cuentas.filter(c => c.empresas > 0 || c.trabajadores > 0 || c.meses > 0 || c.documentos > 0 || (actMap.get(c.id)?.total || 0) > 0).length
        },
        cuentas: cuentas.map(c => {
            const act = actMap.get(c.id);
            return Object.assign({}, c, {
                actividadTotal: act ? act.total : 0,
                ultimaActividad: act ? act.ultima : null,
                acciones: accMap.get(c.id) || []
            });
        }),
        enlacesVigentesORecientes: enlaces,
        auditoria
    };
}

function imprimirTexto(rep) {
    console.log(`Reporte Asistente Pyme (${fmtChile(rep.generado)} Chile)`);
    console.log(`Cuentas: ${rep.totales.cuentas} (${rep.totales.cuentasReales} reales) · Con uso efectivo: ${rep.totales.conUso}\n`);
    for (const c of rep.cuentas) {
        const uso = `${c.empresas} emp / ${c.trabajadores} trab / ${c.meses} liq / ${c.documentos} docs / ${c.actividadTotal} acc`;
        const det = c.acciones.length ? ' [' + c.acciones.map(a => `${a.accion}:${a.total}`).join(', ') + ']' : '';
        console.log(`- ${c.email} | creada ${fmtChile(c.creada)} | último acceso ${fmtChile(c.ultimo_acceso)} | ${uso}${det}`);
    }
    if (rep.enlacesVigentesORecientes.length) {
        console.log('\nEnlaces aún en tabla enlaces_acceso:');
        for (const e of rep.enlacesVigentesORecientes) {
            console.log(`- ${e.email} | pedido ${fmtChile(e.creado)} | ${e.usado ? 'usado ' + fmtChile(e.usado) : 'SIN USAR (vence ' + fmtChile(e.vence) + ')'}`);
        }
    }
    console.log('\nResumen auditoría:');
    for (const a of rep.auditoria) {
        console.log(`- ${a.evento}: ${a.total} (último ${fmtChile(a.ultima)})`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const envArg = args.find(a => a.startsWith('--env='));
    let dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_MIGRACION || '';
    if (envArg) {
        const parsed = leerEnvArchivo(envArg.slice(6));
        dbUrl = parsed.DATABASE_URL || parsed.DATABASE_URL_MIGRACION || dbUrl;
    }
    if (!dbUrl) {
        console.error('Falta DATABASE_URL (o --env=RUTA).');
        process.exit(1);
    }
    const rep = await consultar(dbUrl);
    if (json) console.log(JSON.stringify(rep, null, 2));
    else imprimirTexto(rep);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
