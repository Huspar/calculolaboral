/**
 * POST /api/unlock  { p, o, e, sig }
 * Confirma que un desbloqueo de generador (finiquito, contrato, informe) lo firmo
 * el servidor tras un pago verificado con Flow. Responde { ok, expiresAt }.
 */
const { PRODUCTS, verifyDownload } = require('./_flow');

module.exports = (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false });
    }
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    let ok = false;
    try {
        ok = !!(PRODUCTS[b.p] && PRODUCTS[b.p].unlock) && verifyDownload({ p: b.p, o: b.o, e: b.e, sig: b.sig });
    } catch (err) {
        console.error('unlock:', err.message);
    }
    if (!ok) return res.status(403).json({ ok: false });
    return res.status(200).json({ ok: true, expiresAt: Number(b.e) * 1000 });
};
