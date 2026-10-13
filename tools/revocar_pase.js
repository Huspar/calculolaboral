#!/usr/bin/env node
/*
 * Da de baja un Pase Pyme despues de reembolsarlo en Flow (reembolso de 14 dias corridos de los Terminos, seccion 12).
 *
 *   node tools/revocar_pase.js --entorno=pruebas --orden=7777            muestra el pase y lo que haria, sin tocar nada
 *   node tools/revocar_pase.js --entorno=produccion --orden=7777 --confirmar
 *
 * Orden: el numero de orden de Flow (flowOrder) que figura en el correo [VENTA] y en el comprobante.
 * Pasos de un reembolso: 1) reembolsar el pago en el panel de Flow; 2) correr este script; 3) avisar a quien lo pidio.
 *
 * La cadena de conexion se lee de DATABASE_URL_MIGRACION (nunca por argumento), igual que tools/db_migrate.js.
 * Solo borra la fila del pase (no toca la cuenta ni sus datos): la cuenta vuelve al plan gratuito.
 * Si la cuenta tiene otro pase que empieza despues de este (pases apilados), avisa y no borra: al borrar el primero
 * quedaria un hueco sin cobertura antes del segundo y hay que decidirlo a mano.
 */
'use strict';

function leerArgs(argv) {
    const a = {};
    argv.slice(2).forEach(x => { const m = /^--([a-z-]+)(?:=(.*))?$/.exec(x); if (m) a[m[1]] = m[2] === undefined ? true : m[2]; });
    return a;
}

/** Decide que hacer con un pase y los demas de su cuenta. Pura: la usan las pruebas. */
function planRevocacion(pase, otrosPases) {
    if (!pase) return { accion: 'nada', motivo: 'No hay un pase con esa orden.' };
    const posteriores = otrosPases.filter(p => new Date(p.desde) >= new Date(pase.desde) && p.orden_flow !== pase.orden_flow);
    if (posteriores.length) return { accion: 'detener', motivo: 'La cuenta tiene ' + posteriores.length + ' pase(s) posterior(es) apilado(s): al borrar este quedaria un hueco. Decidelo a mano.' };
    return { accion: 'borrar', motivo: '' };
}

async function main() {
    const args = leerArgs(process.argv);
    const entorno = args.entorno;
    const orden = args.orden;
    if (!['pruebas', 'produccion'].includes(entorno) || !orden || orden === true) {
        console.error('Uso: node tools/revocar_pase.js --entorno=pruebas|produccion --orden=<orden de Flow> [--confirmar]');
        process.exit(2);
    }
    const url = (process.env.DATABASE_URL_MIGRACION || '').trim();
    if (!url) { console.error('Falta la variable DATABASE_URL_MIGRACION (cargala desde el portapapeles; no la pases por argumento).'); process.exit(2); }
    const { Client } = require('pg');
    const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await cliente.connect();
    try {
        const host = new URL(url).host;
        console.log('Servidor: ' + host + ' (' + entorno + ')');
        const r = await cliente.query('SELECT p.id, p.cuenta_id, p.producto, p.orden_flow, p.desde, p.vence, c.email FROM pases p JOIN cuentas c ON c.id = p.cuenta_id WHERE p.orden_flow = $1', [String(orden)]);
        const pase = r.rows[0];
        const otros = pase ? (await cliente.query('SELECT orden_flow, desde, vence FROM pases WHERE cuenta_id = $1', [pase.cuenta_id])).rows : [];
        const plan = planRevocacion(pase, otros);
        if (pase) console.log('Pase: ' + pase.producto + ' de ' + pase.email + ', desde ' + new Date(pase.desde).toISOString() + ' hasta ' + new Date(pase.vence).toISOString());
        if (plan.accion !== 'borrar') { console.log(plan.motivo); process.exit(plan.accion === 'nada' ? 1 : 3); }
        if (entorno === 'produccion' && !args.confirmar) { console.log('Produccion: agrega --confirmar para borrar el pase.'); process.exit(0); }
        if (!args.confirmar) { console.log('Sin --confirmar no se borra nada. Agrega --confirmar para dar de baja este pase.'); process.exit(0); }
        const d = await cliente.query('DELETE FROM pases WHERE id = $1', [pase.id]);
        console.log('Pase dado de baja (' + d.rowCount + ' fila). La cuenta vuelve al plan gratuito. Recuerda haber reembolsado el pago en Flow y avisar a quien lo pidio.');
    } finally { await cliente.end(); }
}

if (require.main === module) main().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
module.exports = { planRevocacion, leerArgs };
