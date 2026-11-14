#!/usr/bin/env node
/*
 * Asigna retroactivamente 60 dias de Pase Pyme (producto 'pyme12') a compradores historicos del Kit Ley 21.719.
 * Si el piloto gratuito sigue activo (hasta 2026-12-31), la vigencia de los 60 dias corre desde max(ahora, fin_piloto),
 * dejando el pase activo desde ahora hasta esa fecha (~1 de marzo de 2027).
 *
 *   node tools/otorgar_pase_kit.js --entorno=pruebas --correos=a@pyme.cl,b@pyme.cl --dry
 *   node tools/otorgar_pase_kit.js --entorno=pruebas --archivo=compradores_kit.csv
 *   node tools/otorgar_pase_kit.js --entorno=produccion --archivo=compradores_kit.csv --confirmar-produccion
 *
 * Formato de archivo (CSV/TXT, una entrada por linea; ignora vacias y comentarios con #):
 *   correo@empresa.cl
 *   correo@empresa.cl,123456        (opcional: numero de orden Flow -> usa orden_flow = 'KIT-123456', igual que el webhook)
 *
 * La cadena de conexion se lee de DATABASE_URL_MIGRACION (nunca por argumento), igual que tools/db_migrate.js.
 * Es idempotente: repetir el mismo correo u orden de Flow no duplica el pase (ON CONFLICT (orden_flow) DO NOTHING).
 * No envia correos ni modifica acepto_encargo de cuentas existentes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Piloto = require('../api/_pyme/piloto');

const CORREO_OK = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const DIAS_POR_DEFECTO = 60;
const PRODUCTO_PASE = 'pyme12';

function leerArgs(argv) {
    const a = {};
    argv.slice(2).forEach(x => {
        const m = /^--([a-z-]+)(?:=(.*))?$/.exec(x);
        if (m) a[m[1]] = m[2] === undefined ? true : m[2];
    });
    return a;
}

/** Limpia encabezado CSV tipico ("email", "correo") y separa "correo[,ordenFlow]". */
function parsearListaCorreos(texto, prefijo) {
    const pref = (prefijo && String(prefijo).trim()) || 'KIT-RETRO';
    const entradas = [];
    const vistos = new Set();
    const lineas = String(texto || '').split(/\r?\n/);

    for (let i = 0; i < lineas.length; i++) {
        const bruta = lineas[i].trim();
        if (!bruta || bruta.startsWith('#')) continue;
        const partes = bruta.split(/[;,\t]+/).map(s => s.trim().replace(/^["']|["']$/g, ''));
        const email = (partes[0] || '').toLowerCase();
        if (i === 0 && (email === 'email' || email === 'correo' || email === 'mail')) continue;
        if (!CORREO_OK.test(email)) {
            throw new Error('Correo invalido en linea ' + (i + 1) + ': ' + partes[0]);
        }
        const orden = partes[1] ? partes[1].trim() : '';
        const ordenFlow = ordenParaEntrada(email, orden, pref);
        const clave = email + '|' + ordenFlow;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        entradas.push({ email, ordenFlow });
    }
    return entradas;
}

/** Genera orden_flow determinista para garantizar idempotencia en re-ejecuciones y compatibilidad con el webhook. */
function ordenParaEntrada(email, ordenExplicita, prefijo) {
    if (ordenExplicita) {
        return ordenExplicita.startsWith('KIT-') ? ordenExplicita : 'KIT-' + ordenExplicita;
    }
    const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 12);
    return prefijo + '-' + hash;
}

function leerEntradas(args) {
    const prefijo = typeof args.prefijo === 'string' && args.prefijo ? args.prefijo : 'KIT-RETRO';
    if (typeof args.archivo === 'string' && args.archivo) {
        const abs = path.resolve(args.archivo);
        return parsearListaCorreos(fs.readFileSync(abs, 'utf8'), prefijo);
    }
    if (typeof args.correos === 'string' && args.correos) {
        const lineas = args.correos.split(',').map(s => s.trim()).filter(Boolean).join('\n');
        return parsearListaCorreos(lineas, prefijo);
    }
    return [];
}

/** Calcula fecha estimada de vencimiento (para vista previa --dry) dada la fecha base del ultimo pase o ahora. */
function calcularFechaVencimiento({ ahoraIso, ultimoVenceIso, venceDesdeIso, dias }) {
    const ahoraMs = Date.parse(ahoraIso);
    const ultimoMs = ultimoVenceIso ? Date.parse(ultimoVenceIso) : ahoraMs;
    const desdeMs = Math.max(ahoraMs, ultimoMs);
    const anclaMs = venceDesdeIso ? Math.max(desdeMs, Date.parse(venceDesdeIso)) : desdeMs;
    return {
        desdeIso: new Date(desdeMs).toISOString(),
        venceIso: new Date(anclaMs + dias * 86400000).toISOString(),
    };
}

async function ejecutarAsignacion(cliente, entradas, { dias, ahoraIso, venceDesdeIso, dry }) {
    const resultados = [];
    for (const item of entradas) {
        const existente = await cliente.query('SELECT id FROM pases WHERE orden_flow = $1', [item.ordenFlow]);
        if (existente.rows.length) {
            resultados.push({ email: item.email, ordenFlow: item.ordenFlow, estado: 'ya_existia' });
            continue;
        }
        const cuentaRes = await cliente.query('SELECT id FROM cuentas WHERE email = $1', [item.email]);
        const cuentaId = cuentaRes.rows[0] ? cuentaRes.rows[0].id : null;
        let ultimoVenceIso = null;
        if (cuentaId) {
            const ult = await cliente.query('SELECT max(vence) AS vence FROM pases WHERE cuenta_id = $1::uuid', [cuentaId]);
            if (ult.rows[0] && ult.rows[0].vence) ultimoVenceIso = new Date(ult.rows[0].vence).toISOString();
        }
        if (dry) {
            const prev = calcularFechaVencimiento({ ahoraIso, ultimoVenceIso, venceDesdeIso, dias });
            resultados.push({
                email: item.email,
                ordenFlow: item.ordenFlow,
                estado: 'pendiente',
                cuentaNueva: !cuentaId,
                venceIso: prev.venceIso,
            });
            continue;
        }

        await cliente.query('BEGIN');
        try {
            const up = await cliente.query(
                'INSERT INTO cuentas (email, acepto_encargo, ultimo_acceso, creada) ' +
                'VALUES ($1, NULL, $2::timestamptz, $2::timestamptz) ' +
                'ON CONFLICT (email) DO UPDATE SET ultimo_acceso = COALESCE(cuentas.ultimo_acceso, EXCLUDED.ultimo_acceso) ' +
                'RETURNING id',
                [item.email, ahoraIso]
            );
            const idCuenta = up.rows[0].id;
            const ins = await cliente.query(
                'WITH base AS (SELECT greatest($4::timestamptz, coalesce((SELECT max(vence) FROM pases WHERE cuenta_id = $1::uuid), $4::timestamptz)) AS desde) ' +
                'INSERT INTO pases (cuenta_id, producto, orden_flow, desde, vence) ' +
                'SELECT $1::uuid, $2, $3, base.desde, greatest(base.desde, coalesce($6::timestamptz, base.desde)) + make_interval(days => $5::int) FROM base ' +
                'ON CONFLICT (orden_flow) DO NOTHING RETURNING desde, vence',
                [idCuenta, PRODUCTO_PASE, item.ordenFlow, ahoraIso, dias, venceDesdeIso]
            );
            await cliente.query('COMMIT');
            resultados.push({
                email: item.email,
                ordenFlow: item.ordenFlow,
                estado: ins.rows[0] ? 'otorgado' : 'ya_existia',
                venceIso: ins.rows[0] ? new Date(ins.rows[0].vence).toISOString() : null,
            });
        } catch (err) {
            await cliente.query('ROLLBACK');
            throw err;
        }
    }
    return resultados;
}

async function main() {
    const args = leerArgs(process.argv);
    const entorno = args.entorno;
    const dias = args.dias ? Number(args.dias) : DIAS_POR_DEFECTO;
    if (!['pruebas', 'produccion'].includes(entorno) || !Number.isInteger(dias) || dias <= 0 || dias > 730) {
        console.error('Uso: node tools/otorgar_pase_kit.js --entorno=pruebas|produccion (--correos=a@b.cl,c@d.cl | --archivo=ruta.csv) [--dias=60] [--prefijo=KIT-RETRO] [--dry] [--confirmar-produccion]');
        process.exit(2);
    }

    const entradas = leerEntradas(args);
    if (!entradas.length) {
        console.error('Indica al menos un correo con --correos=... o --archivo=...');
        process.exit(2);
    }

    const url = (process.env.DATABASE_URL_MIGRACION || '').trim();
    if (!url) {
        console.error('Falta la variable DATABASE_URL_MIGRACION (cargala en el entorno; no la pases por argumento).');
        process.exit(2);
    }

    const confirmado = Boolean(args.confirmar || args['confirmar-produccion']);
    const dry = Boolean(args.dry) || (entorno === 'produccion' && !confirmado);

    const ahoraIso = new Date().toISOString();
    const piloto = Piloto.crear(process.env, () => Date.parse(ahoraIso));
    const venceDesdeIso = piloto.activo() ? piloto.vence() : null;

    const { Client } = require('pg');
    const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await cliente.connect();
    try {
        const host = new URL(url).host;
        console.log('Servidor: ' + host + ' (' + entorno + ')' + (dry ? ' [MODO DRY / VISTA PREVIA]' : ''));
        console.log('Entradas: ' + entradas.length + ', producto: ' + PRODUCTO_PASE + ', dias: ' + dias + (venceDesdeIso ? ', ancla piloto: ' + venceDesdeIso : ''));

        const res = await ejecutarAsignacion(cliente, entradas, { dias, ahoraIso, venceDesdeIso, dry });
        res.forEach(r => {
            console.log(' - ' + r.email + ' | ' + r.ordenFlow + ' | ' + r.estado + (r.venceIso ? ' -> hasta ' + r.venceIso : ''));
        });

        if (dry && entorno === 'produccion' && !args.dry && !confirmado) {
            console.log('Produccion: no se escribio nada. Agrega --confirmar-produccion para aplicar.');
        }
    } finally {
        await cliente.end();
    }
}

if (require.main === module) {
    main().catch(e => {
        console.error('Error: ' + e.message);
        process.exit(1);
    });
}

module.exports = { leerArgs, parsearListaCorreos, ordenParaEntrada, calcularFechaVencimiento, ejecutarAsignacion };
