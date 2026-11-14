/**
 * Que hace flow-confirm cuando Flow avisa el pago de un Pase Pyme (pay = resultado de paymentStatus, ya verificado con Flow).
 * Registra la vigencia en la cuenta, envia el comprobante al correo de la cuenta y avisa al dueño. Si el pago no se puede
 * asociar a una cuenta, avisa al dueño para resolverlo a mano y responde bien a Flow (reintentar no lo arreglaria).
 * Si el comprobante falla se lanza el error: Flow vuelve a avisar y, como la orden es unica, solo se reintenta el correo.
 */
async function procesarPagoPase(pay, { pase, deliverPase, notifyOwner }) {
    const r = await pase.confirmar(pay);
    if (r.ok) {
        await deliverPase(Object.assign({}, pay, { email: r.email }), r.vence);
        await notifyOwner(Object.assign({}, pay, { email: r.email }), r.repetido ? 'Aviso repetido de un Pase Pyme ya registrado.' : 'Venta confirmada por Flow; Pase Pyme registrado en la cuenta.');
        return { estado: r.repetido ? 'repetido' : 'registrado', vence: r.vence };
    }
    if (r.motivo === 'sin_cuenta' || r.motivo === 'cuenta_inexistente') {
        await notifyOwner(pay, 'Pago de Pase Pyme confirmado por Flow, pero no se pudo asociar a una cuenta (' + r.motivo + '): asígnalo a mano o reembolsa.');
        return { estado: 'sin_cuenta', motivo: r.motivo };
    }
    return { estado: 'ignorado', motivo: r.motivo };
}

/**
 * Que hace flow-confirm cuando Flow avisa la compra del Kit Ley 21.719 (producto: 'datos').
 * Asigna 60 dias de pase pyme12 (anclado al fin del piloto si sigue activo) antes de enviar el kit
 * para incluir la vigencia y el enlace de acceso en el mismo correo de entrega.
 * Si falla el registro en BD, avisa al dueno pero no bloquea el envio del kit pagado.
 */
async function procesarKitConPase(pay, { pase, notifyOwner }) {
    try {
        const svc = typeof pase === 'function' ? pase() : pase;
        if (!svc || typeof svc.otorgarPorKit !== 'function') return null;
        const r = await svc.otorgarPorKit(pay);
        if (r && r.ok) {
            return { paseVence: r.vence, paseEmail: r.email, paseRepetido: r.repetido };
        }
        if (notifyOwner) {
            await notifyOwner(pay, 'Venta Kit Ley 21.719 sin pase automático (' + ((r && r.motivo) || 'sin detalle') + ').');
        }
    } catch (err) {
        console.error('flow-confirm: error otorgando pase por kit', pay && pay.commerceOrder, err);
        if (notifyOwner) {
            try { await notifyOwner(pay, 'Venta Kit Ley 21.719 confirmada, pero falló asignar pase automático: ' + err.message); } catch (_) {}
        }
    }
    return null;
}

module.exports = { procesarPagoPase, procesarKitConPase };
