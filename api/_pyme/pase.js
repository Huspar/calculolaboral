/**
 * Pase Pyme: compra, registro de la vigencia en la cuenta y desbloqueo de generadores para quien lo tiene.
 *
 * Reglas
 *  - El pase se asocia a una CUENTA (no a un correo escrito en la pagina de pago): la compra se crea desde una sesion valida y el
 *    id de la cuenta viaja en el pago de Flow como optional.cuenta, puesto por el servidor. Flow confirma el pago por su cuenta
 *    (flow-confirm) y recien ahi se registra el pase; el navegador nunca decide si alguien pago.
 *  - La orden de Flow es unica en la tabla: un aviso repetido del mismo pago no duplica la vigencia.
 *  - Comprar de nuevo extiende: el pase nuevo empieza cuando termina el que ya tenia la cuenta.
 *  - La venta esta cerrada por defecto: se abre con PYME_PASE_VENTA=1 en Vercel, cuando los textos de venta, el retracto y los
 *    Terminos esten resueltos con un abogado (ver docs/revision-legal-asistente-pyme.md, seccion 4).
 *  - Desbloqueo de generadores con pase: el contrato con cualquier pase; el finiquito solo con el de 12 meses.
 *
 * crear({ almacen, productos, flow, venta, ahora, piloto }) → { catalogo, ventaActiva, cobertura, comprar, confirmar, desbloqueo }
 *   productos: PRODUCTS de api/_flow.js; flow: { createPayment({ product, email, optional }), signUnlock(producto, orden) }
 *   venta: () → boolean. ahora: reloj en milisegundos.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Que pases desbloquean cada generador pagado
const COBERTURA = { contrato: ['pyme3', 'pyme12'], finiquito: ['pyme12'] };

function fallo(estado, codigo, error) { return { ok: false, estado, codigo, error }; }

function crear({ almacen, productos, flow, venta, ahora, piloto }) {
    const reloj = ahora || Date.now;
    const iso = () => new Date(reloj()).toISOString();
    const ids = () => Object.keys(productos).filter(k => productos[k].pase);

    /** Lo que el panel muestra para comprar: monto, duracion y su equivalente mensual (sin precios tachados ni descuentos). */
    function catalogo() {
        return ids().map(id => {
            const p = productos[id], meses = id === 'pyme12' ? 12 : 3;
            return { id, titulo: p.subject, monto: p.amount, dias: p.dias, meses, porMes: Math.round(p.amount / meses) };
        });
    }

    function ventaActiva() { return !!(venta && venta()); }

    async function comprar(cuenta, producto) {
        if (ids().indexOf(producto) < 0) return fallo(400, 'producto', 'Producto no válido.');
        if (!ventaActiva()) return fallo(403, 'venta_cerrada', 'El Pase Pyme todavía no está a la venta.');
        try {
            const pago = await flow.createPayment({ product: producto, email: cuenta.email, optional: { cuenta: cuenta.cuentaId } });
            if (!pago || !pago.url || !pago.token) throw new Error('Respuesta de Flow sin url/token');
            return { ok: true, url: `${pago.url}?token=${pago.token}` };
        } catch (err) {
            console.error('pase comprar:', String((err && err.message) || '').slice(0, 200));
            return fallo(502, 'flow', 'No pudimos conectar con Flow. Intenta de nuevo en unos minutos.');
        }
    }

    /**
     * Registra el pase de un pago ya verificado con Flow (pay = resultado de paymentStatus).
     * Devuelve { ok: true, vence, email, repetido } o { ok: false, motivo } con motivo: 'no_pagado' | 'sin_cuenta' | 'cuenta_inexistente'.
     */
    async function confirmar(pay) {
        const p = pay && productos[pay.product];
        if (!p || !p.pase || !pay.paid) return { ok: false, motivo: 'no_pagado' };
        const cuentaId = pay.optional && pay.optional.cuenta;
        if (typeof cuentaId !== 'string' || !UUID.test(cuentaId)) return { ok: false, motivo: 'sin_cuenta' };
        const cuenta = await almacen.buscarCuentaPorId(cuentaId);
        if (!cuenta) return { ok: false, motivo: 'cuenta_inexistente' };
        const nuevo = await almacen.registrarPase({ cuentaId, producto: pay.product, ordenFlow: pay.order, dias: p.dias, ahoraIso: iso() });
        if (nuevo) return { ok: true, vence: nuevo.vence, email: cuenta.email, repetido: false };
        const previo = await almacen.paseDeOrden(pay.order);
        return { ok: true, vence: previo ? previo.vence : null, email: cuenta.email, repetido: true };
    }

    /** Desbloqueo firmado de un generador para una cuenta con pase vigente que lo cubra. */
    async function desbloqueo(cuenta, producto) {
        if (!COBERTURA[producto]) return fallo(400, 'producto', 'Ese generador no está incluido en el pase.');
        let actual = await almacen.paseActual(cuenta.cuentaId, iso());
        // Durante el piloto gratuito toda cuenta cuenta como si tuviera el pase de 12 meses (api/_pyme/piloto.js)
        if (!actual && piloto && piloto.activo()) actual = { producto: piloto.producto, vence: Date.parse(piloto.vence()) };
        if (!actual) return fallo(403, 'sin_pase', 'Necesitas un Pase Pyme vigente.');
        if (COBERTURA[producto].indexOf(actual.producto) < 0) return fallo(403, 'pase_no_incluye', 'Tu pase actual no incluye este generador.');
        const orden = `PYME-${String(cuenta.cuentaId).slice(0, 8)}-${reloj()}`;
        return { ok: true, desbloqueo: flow.signUnlock(producto, orden) };
    }

    return { catalogo, ventaActiva, cobertura: () => JSON.parse(JSON.stringify(COBERTURA)), comprar, confirmar, desbloqueo };
}

module.exports = { crear, COBERTURA };
