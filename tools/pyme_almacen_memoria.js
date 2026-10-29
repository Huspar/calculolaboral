// Almacen en memoria con la misma interfaz que api/_pyme/almacen.js, para probar las cuentas sin base de datos.
'use strict';
const crypto = require('crypto');

function crearAlmacenMemoria() {
    const E = { enlaces: [], cuentas: [], sesiones: [], intentos: {}, auditoria: [], empresas: [], trabajadores: [], pases: [], meses: [], documentos: [], vacaciones: [], honorarios: [], avisos: [], enlaces: [], comentarios: [] };
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
        async registrarAuditoria(a) { E.auditoria.push(a); },

        // ---- empresa y trabajadores ----
        async obtenerEmpresa(cuentaId, empresaId) {
            const e = empresaId ? E.empresas.find(x => x.cuentaId === cuentaId && x.id === empresaId) : E.empresas.find(x => x.cuentaId === cuentaId);
            return e ? { id: e.id, datos: Buffer.from(e.datos), version: e.version } : null;
        },
        async listarEmpresas(cuentaId) {
            return E.empresas.filter(x => x.cuentaId === cuentaId).map(e => ({ id: e.id, datos: Buffer.from(e.datos), version: e.version }));
        },
        async guardarEmpresa(cuentaId, datos, version, ahoraIso, empresaId) {
            let e = empresaId ? E.empresas.find(x => x.cuentaId === cuentaId && x.id === empresaId) : E.empresas.find(x => x.cuentaId === cuentaId);
            if (!e && empresaId) return null;
            if (!e) { e = { id: crypto.randomUUID(), cuentaId }; E.empresas.push(e); }
            e.datos = Buffer.from(datos); e.version = version;
            return { id: e.id };
        },
        async crearEmpresa({ cuentaId, datos, version, maxEmpresas }) {
            if (E.empresas.filter(x => x.cuentaId === cuentaId).length >= maxEmpresas) return null;
            const e = { id: crypto.randomUUID(), cuentaId, datos: Buffer.from(datos), version };
            E.empresas.push(e);
            return { id: e.id };
        },
        async borrarEmpresa(cuentaId, empresaId) {
            if (!E.empresas.some(x => x.cuentaId === cuentaId && x.id === empresaId)) return false;
            const tids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            E.meses = E.meses.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.documentos = E.documentos.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.vacaciones = E.vacaciones.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.enlaces = E.enlaces.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.trabajadores = E.trabajadores.filter(x => x.empresaId !== empresaId);
            E.honorarios = E.honorarios.filter(x => x.empresaId !== empresaId);
            E.empresas = E.empresas.filter(x => x.id !== empresaId);
            return true;
        },
        async listarTrabajadores(empresaId) {
            return E.trabajadores.filter(x => x.empresaId === empresaId).map(x => ({ id: x.id, activo: x.activo, datos: Buffer.from(x.datos), version: x.version }));
        },
        async crearTrabajador({ id, empresaId, activo, datos, version, maxActivos }) {
            if (activo && E.trabajadores.filter(x => x.empresaId === empresaId && x.activo).length >= maxActivos) return false;
            E.trabajadores.push({ id, empresaId, activo, datos: Buffer.from(datos), version });
            return true;
        },
        async actualizarTrabajador({ id, empresaId, activo, datos, version, maxActivos }) {
            const t = E.trabajadores.find(x => x.id === id && x.empresaId === empresaId);
            if (!t) return false;
            if (activo && !t.activo && E.trabajadores.filter(x => x.empresaId === empresaId && x.activo).length >= maxActivos) return false;
            t.activo = activo; t.datos = Buffer.from(datos); t.version = version;
            return true;
        },
        async borrarTrabajador(id, empresaId) {
            const i = E.trabajadores.findIndex(x => x.id === id && x.empresaId === empresaId);
            if (i < 0) return false;
            E.meses = E.meses.filter(m => m.trabajadorId !== id);
            E.enlaces = E.enlaces.filter(m => m.trabajadorId !== id);
            E.documentos = E.documentos.filter(m => m.trabajadorId !== id);
            E.vacaciones = E.vacaciones.filter(m => m.trabajadorId !== id);
            E.trabajadores.splice(i, 1);
            return true;
        },
        // ---- meses de liquidacion ----
        async trabajadorDeEmpresa(id, empresaId) { return E.trabajadores.some(x => x.id === id && x.empresaId === empresaId); },
        async listarMeses(empresaId, periodo) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.meses.filter(m => ids.indexOf(m.trabajadorId) >= 0 && (!periodo || m.periodo === periodo))
                .map(m => ({ trabajadorId: m.trabajadorId, periodo: m.periodo, datos: Buffer.from(m.datos), version: m.version }));
        },
        async obtenerMes(trabajadorId, empresaId, periodo) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return null;
            const m = E.meses.find(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            return m ? { datos: Buffer.from(m.datos), version: m.version } : null;
        },
        async guardarMes({ trabajadorId, empresaId, periodo, datos, version, maxMeses }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            const m = E.meses.find(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            if (m) { m.datos = Buffer.from(datos); m.version = version; return true; }
            if (E.meses.filter(x => x.trabajadorId === trabajadorId).length >= maxMeses) return false;
            E.meses.push({ trabajadorId, periodo, datos: Buffer.from(datos), version });
            return true;
        },
        async borrarMes(trabajadorId, empresaId, periodo) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            const i = E.meses.findIndex(x => x.trabajadorId === trabajadorId && x.periodo === periodo);
            if (i < 0) return false;
            E.meses.splice(i, 1);
            return true;
        },
        // ---- liquidación compartida por enlace ----
        async crearEnlaceLiquidacion({ cuentaId, empresaId, trabajadorId, periodo, tokenHash, pagada, ahoraIso, venceIso }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            E.enlaces = E.enlaces.filter(x => !(x.trabajadorId === trabajadorId && x.periodo === periodo));
            E.enlaces.push({ tokenHash, cuentaId, trabajadorId, periodo, pagada, creado: ahoraIso, vence: venceIso, primeraVista: null, ultimaVista: null, vistas: 0 });
            return true;
        },
        async listarEnlacesLiquidacion(cuentaId, periodo) {
            return E.enlaces.filter(x => x.cuentaId === cuentaId && x.periodo === periodo).map(x => ({ trabajadorId: x.trabajadorId, periodo: x.periodo, creado: x.creado, vence: x.vence, primeraVista: x.primeraVista, ultimaVista: x.ultimaVista, vistas: x.vistas }));
        },
        async borrarEnlaceLiquidacion(cuentaId, trabajadorId, periodo) {
            const n = E.enlaces.length;
            E.enlaces = E.enlaces.filter(x => !(x.cuentaId === cuentaId && x.trabajadorId === trabajadorId && x.periodo === periodo));
            return E.enlaces.length < n;
        },
        async abrirEnlaceLiquidacion(tokenHash, ahoraIso) {
            const x = E.enlaces.find(e => e.tokenHash === tokenHash && t(e.vence) > t(ahoraIso));
            if (!x) return null;
            x.vistas++; x.ultimaVista = ahoraIso; x.primeraVista = x.primeraVista || ahoraIso;
            return { cuentaId: x.cuentaId, trabajadorId: x.trabajadorId, periodo: x.periodo, pagada: x.pagada };
        },
        // ---- opiniones del piloto ----
        async guardarComentario({ cuentaId, tipo, pantalla, texto, contacto, ahoraIso, maxPorDia }) {
            const hoy = E.comentarios.filter(c => c.cuentaId === cuentaId && t(c.creado) > t(ahoraIso) - 86400000).length;
            if (hoy >= maxPorDia) return null;
            const id = crypto.randomUUID();
            E.comentarios.push({ id, cuentaId, tipo, pantalla, texto, contacto, creado: ahoraIso });
            return id;
        },

        // ---- avisos por correo ----
        async obtenerAvisosCorreo(cuentaId) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            return a ? { activo: a.activo, ultimoEnvio: a.ultimoEnvio || null } : { activo: false, ultimoEnvio: null };
        },
        async guardarAvisosCorreo(cuentaId, activo) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            if (a) a.activo = activo; else E.avisos.push({ cuentaId, activo, enviados: {}, ultimoEnvio: null });
        },
        async cuentasConAvisos(limite) {
            return E.avisos.filter(a => a.activo).slice(0, limite).map(a => ({ cuentaId: a.cuentaId, email: (E.cuentas.find(c => c.id === a.cuentaId) || {}).email, enviados: JSON.parse(JSON.stringify(a.enviados)) }))
                .filter(a => a.email);
        },
        async registrarEnvioAvisos(cuentaId, enviados, ahoraIso) {
            const a = E.avisos.find(x => x.cuentaId === cuentaId);
            if (a) { a.enviados = JSON.parse(JSON.stringify(enviados)); a.ultimoEnvio = ahoraIso; }
        },
        // ---- boletas de honorarios ----
        async listarHonorarios(empresaId, periodo) {
            return E.honorarios.filter(h => h.empresaId === empresaId && (!periodo || h.periodo === periodo)).sort((a, b) => a.periodo < b.periodo ? -1 : 1)
                .map(h => ({ periodo: h.periodo, datos: Buffer.from(h.datos), version: h.version }));
        },
        async guardarHonorarios({ empresaId, periodo, datos, version, maxPeriodos }) {
            if (!E.empresas.some(x => x.id === empresaId)) return false;
            const h = E.honorarios.find(x => x.empresaId === empresaId && x.periodo === periodo);
            if (h) { h.datos = Buffer.from(datos); h.version = version; return true; }
            if (E.honorarios.filter(x => x.empresaId === empresaId).length >= maxPeriodos) return false;
            E.honorarios.push({ empresaId, periodo, datos: Buffer.from(datos), version });
            return true;
        },
        async borrarHonorarios(empresaId, periodo) {
            const i = E.honorarios.findIndex(x => x.empresaId === empresaId && x.periodo === periodo);
            if (i < 0) return false;
            E.honorarios.splice(i, 1);
            return true;
        },
        // ---- documentos emitidos ----
        async registrarDocumento({ trabajadorId, empresaId, tipo, ahoraIso, maximo }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            if (E.documentos.filter(d => d.trabajadorId === trabajadorId).length >= maximo) return false;
            E.documentos.push({ trabajadorId, tipo, emitido: new Date(ahoraIso).toISOString() });
            return true;
        },
        async listarDocumentos(empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.documentos.filter(d => ids.indexOf(d.trabajadorId) >= 0).map(d => Object.assign({}, d));
        },
        // ---- vacaciones ----
        async listarVacaciones(empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            return E.vacaciones.filter(v => ids.indexOf(v.trabajadorId) >= 0).map(v => ({ id: v.id, trabajadorId: v.trabajadorId, datos: Buffer.from(v.datos), version: v.version, creado: v.creado }));
        },
        async crearVacacion({ id, trabajadorId, empresaId, datos, version, ahoraIso, maximo }) {
            if (!E.trabajadores.some(x => x.id === trabajadorId && x.empresaId === empresaId)) return false;
            if (E.vacaciones.filter(v => v.trabajadorId === trabajadorId).length >= maximo) return false;
            E.vacaciones.push({ id, trabajadorId, datos: Buffer.from(datos), version, creado: new Date(ahoraIso).toISOString() });
            return true;
        },
        async borrarVacacion(id, empresaId) {
            const ids = E.trabajadores.filter(x => x.empresaId === empresaId).map(x => x.id);
            const i = E.vacaciones.findIndex(v => v.id === id && ids.indexOf(v.trabajadorId) >= 0);
            if (i < 0) return false;
            E.vacaciones.splice(i, 1);
            return true;
        },
        async paseVigente(cuentaId, ahoraIso) {
            const propios = E.pases.filter(p => p.cuentaId === cuentaId && t(p.vence) > t(ahoraIso));
            if (!propios.some(p => t(p.desde) <= t(ahoraIso))) return null;
            return Math.max.apply(null, propios.map(p => t(p.vence)));
        },
        async paseActual(cuentaId, ahoraIso) {
            const v = E.pases.filter(p => p.cuentaId === cuentaId && t(p.desde) <= t(ahoraIso) && t(p.vence) > t(ahoraIso)).sort((a, b) => t(b.vence) - t(a.vence))[0];
            return v ? { producto: v.producto, vence: t(v.vence) } : null;
        },
        async registrarPase({ cuentaId, producto, ordenFlow, dias, ahoraIso }) {
            if (E.pases.some(p => p.ordenFlow === ordenFlow)) return null;
            const ultimo = Math.max.apply(null, [t(ahoraIso)].concat(E.pases.filter(p => p.cuentaId === cuentaId).map(p => t(p.vence))));
            const vence = ultimo + dias * 86400000;
            E.pases.push({ cuentaId, producto, ordenFlow, desde: new Date(ultimo).toISOString(), vence: new Date(vence).toISOString() });
            return { desde: ultimo, vence };
        },
        async paseDeOrden(ordenFlow) {
            const p = E.pases.find(x => x.ordenFlow === ordenFlow);
            return p ? { cuentaId: p.cuentaId, producto: p.producto, vence: t(p.vence) } : null;
        },
        async buscarCuentaPorId(cuentaId) {
            const c = E.cuentas.find(x => x.id === cuentaId);
            return c ? { id: c.id, email: c.email } : null;
        },
        async borrarCuenta(cuentaId) {
            const emp = E.empresas.filter(x => x.cuentaId === cuentaId).map(x => x.id);
            const tids = E.trabajadores.filter(x => emp.indexOf(x.empresaId) >= 0).map(x => x.id);
            E.meses = E.meses.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.documentos = E.documentos.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.vacaciones = E.vacaciones.filter(m => tids.indexOf(m.trabajadorId) < 0);
            E.trabajadores = E.trabajadores.filter(x => emp.indexOf(x.empresaId) < 0);
            E.honorarios = E.honorarios.filter(x => emp.indexOf(x.empresaId) < 0);
            E.empresas = E.empresas.filter(x => x.cuentaId !== cuentaId);
            E.sesiones = E.sesiones.filter(x => x.cuentaId !== cuentaId);
            E.pases = E.pases.filter(x => x.cuentaId !== cuentaId);
            E.avisos = E.avisos.filter(x => x.cuentaId !== cuentaId);
            E.comentarios = E.comentarios.filter(x => x.cuentaId !== cuentaId);
            E.enlaces = E.enlaces.filter(x => x.cuentaId !== cuentaId);
            E.cuentas = E.cuentas.filter(x => x.id !== cuentaId);
        }
    };
}

module.exports = { crearAlmacenMemoria };
