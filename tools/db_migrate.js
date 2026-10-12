#!/usr/bin/env node
/*
 * Aplica las migraciones de db/migrations/*.sql a la base de Neon del Asistente Pyme.
 *
 *   node tools/db_migrate.js --entorno=pruebas             aplica las pendientes a la rama "pruebas"
 *   node tools/db_migrate.js --entorno=pruebas --estado    solo muestra aplicadas y pendientes
 *   node tools/db_migrate.js --entorno=pruebas --dry       muestra lo que aplicaria, sin tocar la base
 *   node tools/db_migrate.js --entorno=produccion --confirmar-produccion
 *
 * La cadena de conexion se lee de la variable de entorno DATABASE_URL_MIGRACION (nunca por argumento, para que no
 * quede en el historial). Usa la conexion DIRECTA (sin "-pooler") de la rama que corresponda al entorno.
 * Antes de tocar nada el script muestra el servidor (sin usuario ni clave) y pide --confirmar-produccion para produccion.
 *
 * Cada migracion corre en una transaccion y queda registrada en schema_migraciones con su huella (SHA-256).
 * Si una migracion ya aplicada cambia de contenido, el script se detiene: una migracion aplicada no se edita,
 * se agrega una nueva.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR_MIGRACIONES = path.join(__dirname, '..', 'db', 'migrations');
const NOMBRE_VALIDO = /^(\d{3})_[a-z0-9_]+\.sql$/;
const BLOQUEO = 727274; // clave del bloqueo para que dos ejecuciones no corran a la vez

function huella(texto) {
    return crypto.createHash('sha256').update(texto.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

// Lee las migraciones del disco, ordenadas por numero. Rechaza nombres mal formados y numeros repetidos.
function listarMigraciones(dir) {
    const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const vistos = {};
    return archivos.map(function (nombre) {
        const m = NOMBRE_VALIDO.exec(nombre);
        if (!m) throw new Error('Nombre de migracion invalido: ' + nombre + ' (use 001_descripcion_en_minusculas.sql)');
        if (vistos[m[1]]) throw new Error('Numero de migracion repetido: ' + m[1] + ' (' + vistos[m[1]] + ' y ' + nombre + ')');
        vistos[m[1]] = nombre;
        const sql = fs.readFileSync(path.join(dir, nombre), 'utf8');
        return { nombre: nombre, sql: sql, huella: huella(sql) };
    });
}

// Divide lo ya aplicado en: pendientes, aplicadas sin cambios y alteradas (huella distinta)
function planear(migraciones, aplicadas) {
    const porNombre = {};
    aplicadas.forEach(function (a) { porNombre[a.nombre] = a; });
    const plan = { pendientes: [], aplicadas: [], alteradas: [], huerfanas: [] };
    migraciones.forEach(function (m) {
        const a = porNombre[m.nombre];
        if (!a) plan.pendientes.push(m);
        else if (a.huella !== m.huella) plan.alteradas.push(m);
        else plan.aplicadas.push(m);
        delete porNombre[m.nombre];
    });
    plan.huerfanas = Object.keys(porNombre); // registradas en la base pero sin archivo
    return plan;
}

// Servidor de la cadena de conexion, sin usuario ni clave
function servidorDe(url) {
    try { return new URL(url).host; } catch (e) { return null; }
}

function leerArgumentos(argv) {
    const a = { entorno: null, estado: false, dry: false, confirmarProduccion: false };
    argv.forEach(function (x) {
        if (x.indexOf('--entorno=') === 0) a.entorno = x.slice(10);
        else if (x === '--estado') a.estado = true;
        else if (x === '--dry') a.dry = true;
        else if (x === '--confirmar-produccion') a.confirmarProduccion = true;
        else throw new Error('Argumento desconocido: ' + x);
    });
    if (a.entorno !== 'pruebas' && a.entorno !== 'produccion') throw new Error('Falta --entorno=pruebas o --entorno=produccion');
    if (a.entorno === 'produccion' && !a.confirmarProduccion && !a.estado && !a.dry) {
        throw new Error('Para aplicar en produccion agrega --confirmar-produccion');
    }
    return a;
}

async function main() {
    const args = leerArgumentos(process.argv.slice(2));
    const url = process.env.DATABASE_URL_MIGRACION;
    if (!url) throw new Error('Falta la variable de entorno DATABASE_URL_MIGRACION (conexion directa de la rama ' + args.entorno + ')');
    const servidor = servidorDe(url);
    if (!servidor) throw new Error('DATABASE_URL_MIGRACION no es una direccion valida');
    if (servidor.indexOf('-pooler') >= 0) throw new Error('Usa la conexion directa (sin "-pooler"): el bloqueo de migraciones lo necesita');

    const migraciones = listarMigraciones(DIR_MIGRACIONES);
    console.log('Entorno: ' + args.entorno + ' | servidor: ' + servidor + ' | migraciones en disco: ' + migraciones.length);

    const { Client } = require('pg');
    const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await cliente.connect();
    try {
        await cliente.query('SELECT pg_advisory_lock($1)', [BLOQUEO]);
        await cliente.query(
            'CREATE TABLE IF NOT EXISTS schema_migraciones (' +
            'nombre text PRIMARY KEY, huella text NOT NULL, aplicada timestamptz NOT NULL DEFAULT now())'
        );
        const aplicadas = (await cliente.query('SELECT nombre, huella FROM schema_migraciones ORDER BY nombre')).rows;
        const plan = planear(migraciones, aplicadas);

        console.log('Aplicadas: ' + plan.aplicadas.length + ' | pendientes: ' + plan.pendientes.length);
        plan.pendientes.forEach(m => console.log('  pendiente: ' + m.nombre));
        if (plan.huerfanas.length) console.log('Aviso: registradas en la base pero sin archivo: ' + plan.huerfanas.join(', '));
        if (plan.alteradas.length) {
            throw new Error('Migraciones ya aplicadas que cambiaron de contenido: ' + plan.alteradas.map(m => m.nombre).join(', ') +
                '. No se editan: agrega una migracion nueva.');
        }
        if (args.estado || args.dry) {
            if (args.dry) console.log('(--dry: no se aplico nada)');
            return;
        }
        for (const m of plan.pendientes) {
            await cliente.query('BEGIN');
            try {
                await cliente.query(m.sql);
                await cliente.query('INSERT INTO schema_migraciones (nombre, huella) VALUES ($1, $2)', [m.nombre, m.huella]);
                await cliente.query('COMMIT');
                console.log('  aplicada: ' + m.nombre);
            } catch (e) {
                await cliente.query('ROLLBACK');
                throw new Error('Fallo ' + m.nombre + ' (se deshizo): ' + e.message);
            }
        }
        console.log(plan.pendientes.length ? 'Listo.' : 'Nada que aplicar.');
    } finally {
        try { await cliente.query('SELECT pg_advisory_unlock($1)', [BLOQUEO]); } catch (e) { /* conexion ya cerrada */ }
        await cliente.end();
    }
}

if (require.main === module) {
    main().catch(function (e) {
        console.error('Error: ' + e.message);
        process.exit(1);
    });
}

module.exports = { huella, listarMigraciones, planear, servidorDe, leerArgumentos, NOMBRE_VALIDO };
