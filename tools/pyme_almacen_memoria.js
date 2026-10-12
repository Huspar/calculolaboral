// Almacen en memoria con la misma interfaz que api/_pyme/almacen.js, para probar las cuentas sin base de datos.
'use strict';
const crypto = require('crypto');

function crearAlmacenMemoria() {
    const E = { enlaces: [], cuentas: [], sesiones: [], intentos: {}, auditoria: [] };
    const t = iso => Date.parse(iso);

    return {
        _estado: E,
        async limpiar(ahoraIso) {
            E.enlaces = E.enlaces.filter(e => t(e.vence) >= t(ahoraIso) - 86400000);
            E.sesiones = E.sesiones.filter(s => t(s.vence) >= t(ahoraIso) - 86400000);
            Object.keys(E.intentos).forEach(k => { if (t(E.intentos[k].ventana) < t(ahoraIso) - 2 * 86400000) delete E.intentos[k]; });
        },
        async sumarIntento(clave, ventanaIso) {
            const k = clave + '|' + ventanaIso;
            E.intentos[k] = E.intentos[k] || { ventana: ventanaIso, cuenta: 0 };
            return ++E.intentos[k].cuenta;
        },
        async crearEnlace({ email, tokenHash, creado, vence }) {
            if (E.enlaces.some(e => e.tokenHash === tokenHash)) throw new Error('token_hash repetido');
            E.enlaces.push({ email, tokenHash, creado, vence, usado: null });
        },
        async buscarEnlace(tokenHash, ahoraIso) {
            const e = E.enlaces.find(x => x.tokenHash === tokenHash && !x.usado && t(x.vence) > t(ahoraIso));
            return e ? { email: e.email } : null;
        },
        async consumirEnlace(tokenHash, ahoraIso) {
            const e = E.enlaces.find(x => x.tokenHash === tokenHash && !x.usado && t(x.vence) > t(ahoraIso));
            if (!e) return null;
            e.usado = ahoraIso;
            return e.email;
        },
        async buscarCuentaPorEmail(email) {
            const c = E.cuentas.find(x => x.email === email);
            return c ? { id: c.id, aceptoEncargo: !!c.aceptoEncargo } : null;
        },
        async upsertCuenta(email, aceptoIso, ahoraIso) {
            let c = E.cuentas.find(x => x.email === email);
            if (!c) { c = { id: crypto.randomUUID(), email, aceptoEncargo: null, creada: ahoraIso }; E.cuentas.push(c); }
            c.ultimoAcceso = ahoraIso;
            c.aceptoEncargo = c.aceptoEncargo || aceptoIso || null;
            return { id: c.id };
        },
        async crearSesion({ cuentaId, tokenHash, creada, vence }) {
            if (E.sesiones.some(s => s.tokenHash === tokenHash)) throw new Error('token_hash repetido');
            E.sesiones.push({ id: crypto.randomUUID(), cuentaId, tokenHash, creada, vence, revocada: null });
        },
        async buscarSesion(tokenHash, ahoraIso) {
            const s = E.sesiones.find(x => x.tokenHash === tokenHash && !x.revocada && t(x.vence) > t(ahoraIso));
            if (!s) return null;
            const c = E.cuentas.find(x => x.id === s.cuentaId);
            return { sesionId: s.id, cuentaId: s.cuentaId, email: c.email, vence: t(s.vence) };
        },
        async extenderSesion(sesionId, venceIso) { E.sesiones.find(x => x.id === sesionId).vence = venceIso; },
        async revocarSesion(tokenHash, ahoraIso) {
            const s = E.sesiones.find(x => x.tokenHash === tokenHash && !x.revocada);
            if (s) s.revocada = ahoraIso;
        },
        async registrarAuditoria(a) { E.auditoria.push(a); }
    };
}

module.exports = { crearAlmacenMemoria };
