/**
 * GET /api/download?p=&o=&e=&sig=
 * Entrega el zip del kit solo con un enlace firmado por el servidor tras un pago
 * confirmado por Flow (ver _flow.js). Caduca a los 30 dias.
 */
const { PRODUCTS, verifyDownload } = require('./_flow');

module.exports = (req, res) => {
    const q = req.query || {};
    let ok = false;
    try {
        ok = verifyDownload({ p: q.p, o: q.o, e: q.e, sig: q.sig });
    } catch (err) {
        console.error('download:', err.message);
    }
    if (!ok) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(403).send('Enlace de descarga no válido o vencido. Escríbenos a contacto@calculolaboral.cl con tu número de orden.');
    }
    const p = PRODUCTS[q.p];
    const file = Buffer.from(p.zip(), 'base64');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${p.filename}"`);
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(file);
};
