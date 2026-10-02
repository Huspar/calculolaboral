/**
 * POST /api/flow-confirm  (llamado por Flow, servidor a servidor, con "token")
 * Verifica el pago con Flow y, si esta pagado, envia el kit al comprador.
 * Flow reintenta si no recibe 200; los correos usan una llave de idempotencia
 * por orden, asi un reintento no duplica el envio.
 */
const { paymentStatus, deliverKit, readToken } = require('./_flow');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end();
    }
    const token = readToken(req);
    if (!token) return res.status(400).end();

    try {
        const pay = await paymentStatus(token);
        if (pay.paid && pay.email) {
            await deliverKit(pay);
        } else {
            console.info('flow-confirm: pago no confirmado', pay.commerceOrder, 'estado', pay.status);
        }
        return res.status(200).end();
    } catch (err) {
        // Sin 200, Flow vuelve a intentar mas tarde
        console.error('flow-confirm:', err.message);
        return res.status(500).end();
    }
};
