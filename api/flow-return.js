/**
 * POST /api/flow-return  (el navegador del comprador vuelve desde Flow con "token")
 * Consulta el pago y redirige a /compra-exitosa con un enlace de descarga firmado,
 * o de vuelta a la pagina del producto si el pago no se completo.
 */
const { PRODUCTS, SITE_URL, paymentStatus, downloadQuery, readToken } = require('./_flow');

function redirect(res, path) {
    res.setHeader('Location', SITE_URL + path);
    return res.status(303).end();
}

module.exports = async (req, res) => {
    const token = readToken(req);
    if (!token) return redirect(res, '/compra-exitosa');

    try {
        const pay = await paymentStatus(token);
        if (pay.product && PRODUCTS[pay.product].pase) {
            // Pase Pyme: de vuelta al asistente, que consulta su cuenta para mostrar la vigencia
            if (pay.paid) return redirect(res, `/asistente-pyme?pase=ok&o=${encodeURIComponent(pay.order)}`);
            return redirect(res, `/asistente-pyme?pase=${pay.pending ? 'pendiente' : 'rechazado'}`);
        }
        if (pay.paid) {
            // Kits: pagina de descarga. Generadores: vuelven a su pagina con el desbloqueo firmado.
            const dest = PRODUCTS[pay.product].unlock ? PRODUCTS[pay.product].page : '/compra-exitosa';
            return redirect(res, `${dest}?${downloadQuery(pay.product, pay.order)}`);
        }
        if (pay.pending) {
            return redirect(res, `/compra-exitosa?estado=pendiente&p=${pay.product || ''}`);
        }
        const page = pay.product ? PRODUCTS[pay.product].page : '/para-empleadores';
        return redirect(res, `${page}?pago=rechazado`);
    } catch (err) {
        console.error('flow-return:', err.message);
        return redirect(res, '/compra-exitosa?estado=error');
    }
};
