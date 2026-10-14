/**
 * Piezas del Asistente Pyme que comparten varias funciones de Vercel (la API del asistente y flow-confirm):
 * la conexion a Neon y el servicio del Pase. Se arman una sola vez por instancia de la funcion.
 */
const { crearAlmacenSql } = require('./almacen');
const { crear: crearPase } = require('./pase');
const Piloto = require('./piloto');

let almacenMemo = null;
let paseMemo = null;

function almacen() {
    if (almacenMemo) return almacenMemo;
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL no configurada');
    const { neon } = require('@neondatabase/serverless');
    almacenMemo = crearAlmacenSql(neon(url));
    return almacenMemo;
}

function pase() {
    if (paseMemo) return paseMemo;
    const flow = require('../_flow');
    paseMemo = crearPase({
        almacen: almacen(),
        productos: flow.PRODUCTS,
        flow: { createPayment: flow.createPayment, signUnlock: flow.signUnlock },
        venta: () => process.env.PYME_PASE_VENTA === '1',
        piloto: Piloto.crear(process.env)
    });
    return paseMemo;
}

/** Despues de un error de configuracion que se corrige sin redesplegar. */
function olvidar() { almacenMemo = null; paseMemo = null; }

module.exports = { almacen, pase, olvidar };
