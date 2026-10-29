/**
 * Portal del cliente (fase 3 de equipo y portal del cliente).
 *
 *   crear({ almacen, datos, ahora })
 *     .listar(cuenta, empresaId)
 *     .invitar(cuenta, { empresaId, email, secciones })
 *     .cambiar(cuenta, id, { secciones })
 *     .quitar(cuenta, id)
 *     .portalesDe(sesion)
 *     .obtenerDatos(sesion, { empresaId, periodo })
 *     .obtenerLiquidacion(sesion, { empresaId, trabajadorId, periodo })
 *
 * Vista de solo lectura para el cliente del estudio: resumen del mes de su empresa,
 * avisos del mes y, si el estudio lo activa, liquidaciones emitidas (PDF) sin datos bancarios.
 */
const CORREO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POR_EMPRESA = 1; // límite del piloto: 1 cliente con portal por empresa

function fallo(estado, codigo, error) { return { ok: false, estado, codigo, error }; }

function normalizarSecciones(sec) {
    return {
        resumen: sec && sec.resumen !== false, // por defecto activo
        liquidaciones: !!(sec && sec.liquidaciones),
        documentos: !!(sec && sec.documentos)
    };
}

function crear({ almacen, datos, ahora }) {
    const reloj = ahora || Date.now;

    async function validarEmpresaPropia(cuenta, empresaId) {
        if (!UUID.test(String(empresaId || ''))) return null;
        const e = await datos.estado(Object.assign({}, cuenta, { empresaId }));
        return (e.ok && e.empresaId === empresaId) ? e : null;
    }

    // ---------- gestión por parte del estudio (titular y administrador) ----------
    async function listar(cuenta, empresaId) {
        const est = await validarEmpresaPropia(cuenta, empresaId);
        if (!est) return fallo(404, 'no_existe', 'No encontramos esa empresa en tu cuenta.');
        const filas = await almacen.listarPortalClientes(cuenta.cuentaId, empresaId);
        return { ok: true, clientes: filas, maxPorEmpresa: MAX_POR_EMPRESA };
    }

    async function invitar(cuenta, entrada) {
        const empresaId = String(entrada?.empresaId || '').toLowerCase();
        const est = await validarEmpresaPropia(cuenta, empresaId);
        if (!est) return fallo(404, 'no_existe', 'No encontramos esa empresa en tu cuenta.');

        const email = String(entrada?.email || '').trim().toLowerCase();
        if (!CORREO.test(email)) return fallo(400, 'correo', 'Escribe un correo válido.');
        if (email === String(cuenta.email || '').toLowerCase()) return fallo(400, 'correo', 'Ese es tu propio correo.');

        const existentes = await almacen.listarPortalClientes(cuenta.cuentaId, empresaId);
        if (existentes.some(c => c.email === email)) return fallo(409, 'repetido', 'Esa persona ya tiene acceso al portal de esta empresa.');
        if (existentes.length >= MAX_POR_EMPRESA) return fallo(409, 'limite', 'El piloto permite 1 acceso al portal por empresa.');

        const secciones = normalizarSecciones(entrada?.secciones);
        const m = await almacen.crearPortalCliente({
            estudioId: cuenta.cuentaId, empresaId, email, secciones,
            invitadoPor: cuenta.personaId || cuenta.cuentaId,
            ahoraIso: new Date(reloj()).toISOString(),
            maxPorEmpresa: MAX_POR_EMPRESA
        });
        if (!m) return fallo(409, 'limite', 'El piloto permite 1 acceso al portal por empresa.');
        return { ok: true, cliente: { id: m.id, empresaId, email, secciones } };
    }

    async function cambiar(cuenta, id, entrada) {
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese acceso.');
        const todos = await almacen.listarPortalClientes(cuenta.cuentaId);
        const actual = todos.find(c => c.id === id);
        if (!actual) return fallo(404, 'no_existe', 'No encontramos ese acceso.');

        const secciones = normalizarSecciones(entrada?.secciones);
        await almacen.actualizarPortalCliente(cuenta.cuentaId, id, { secciones });
        return { ok: true };
    }

    async function quitar(cuenta, id) {
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese acceso.');
        const ok = await almacen.borrarPortalCliente(cuenta.cuentaId, id);
        return ok ? { ok: true } : fallo(404, 'no_existe', 'No encontramos ese acceso.');
    }

    // ---------- consulta por parte del cliente del portal ----------
    async function portalesDe(sesion) {
        if (!sesion || !sesion.email) return [];
        const filas = await almacen.buscarPortalPorEmail(sesion.email);
        const lista = [];
        for (const f of filas) {
            const e = await datos.estado({ cuentaId: f.estudioId, empresaId: f.empresaId }).catch(() => null);
            if (e && e.ok && e.empresa) {
                lista.push({
                    id: f.id,
                    estudioId: f.estudioId,
                    empresaId: f.empresaId,
                    razonSocial: e.empresa.razonSocial || 'Sin nombre',
                    rut: e.empresa.rut || '',
                    titular: f.titular,
                    secciones: f.secciones
                });
            }
        }
        return lista;
    }

    async function obtenerDatos(sesion, { empresaId, periodo }) {
        if (!sesion || !sesion.email) return fallo(401, 'sin_sesion', 'Sesión no válida.');
        if (!UUID.test(String(empresaId || ''))) return fallo(400, 'empresa', 'Empresa no válida.');

        const membresias = await almacen.buscarPortalPorEmail(sesion.email);
        const acceso = membresias.find(m => m.empresaId === empresaId);
        if (!acceso) return fallo(403, 'sin_acceso', 'No tienes acceso al portal de esta empresa.');

        await almacen.tocarPortalCliente(acceso.id, new Date(reloj()).toISOString()).catch(() => {});

        const cEstudio = { cuentaId: acceso.estudioId, empresaId: acceso.empresaId };
        const est = await datos.estado(cEstudio);
        if (!est || !est.ok || !est.empresa) return fallo(404, 'no_existe', 'No encontramos los datos de esta empresa.');

        const sec = normalizarSecciones(acceso.secciones);
        const per = periodo && /^[0-9]{4}-[0-9]{2}$/.test(periodo) ? periodo : new Date(reloj()).toISOString().slice(0, 7);

        // Datos empresa (públicos solamente, jamás claves ni cuentas)
        const empresaPub = {
            id: est.empresaId,
            razonSocial: est.empresa.razonSocial || '',
            rut: est.empresa.rut || '',
            giro: est.empresa.giro || '',
            direccion: est.empresa.direccion || '',
            comuna: est.empresa.comuna || ''
        };

        const trabajadores = est.trabajadores || [];
        const activos = trabajadores.filter(t => t.activo);
        const mesesResp = await datos.meses(cEstudio, per).catch(() => ({ ok: true, meses: [] }));
        const listaMeses = (mesesResp && Array.isArray(mesesResp.meses)) ? mesesResp.meses : [];
        const mapaMeses = {};
        listaMeses.forEach(x => { if (x.trabajadorId && x.mes) mapaMeses[x.trabajadorId] = x.mes; });

        let liquidacionesGuardadas = 0, liquidacionesEmitidas = 0, liquidoTotal = 0, costoTotal = 0;

        Object.keys(mapaMeses).forEach(id => {
            const m = mapaMeses[id];
            if (!m) return;
            liquidacionesGuardadas++;
            if (m.emitida) liquidacionesEmitidas++;
            if (m.calculo) {
                liquidoTotal += Number(m.calculo.liquido) || 0;
                costoTotal += Number(m.calculo.costoTotal || m.calculo.costoEmpleador) || 0;
            }
        });

        // Avisos visibles de la empresa: plazos fijos por vencer
        const avisos = [];
        const hoyIso = new Date(reloj()).toISOString().slice(0, 10);
        activos.forEach(t => {
            const termino = t.fechaTermino || (t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : '');
            if (termino && termino >= hoyIso) {
                const diasRestantes = Math.round((Date.parse(termino) - Date.parse(hoyIso)) / 86400000);
                if (diasRestantes <= 30) {
                    avisos.push({
                        tipo: diasRestantes <= 7 ? 'urgente' : 'importante',
                        titulo: 'Plazo fijo por vencer',
                        texto: `${t.nombre} ${t.apellido}: el contrato vence el ${termino} (${diasRestantes} días restantes).`
                    });
                }
            }
        });

        const respuesta = {
            ok: true,
            estudioId: acceso.estudioId,
            empresa: empresaPub,
            estudio: { titular: acceso.titular },
            secciones: sec,
            periodo: per,
            resumen: {
                trabajadoresActivos: activos.length,
                liquidacionesGuardadas,
                liquidacionesEmitidas,
                liquidoTotal,
                costoTotal,
                cotizacionesPrevired: liquidacionesEmitidas > 0 ? 'estimadas' : 'pendientes'
            },
            avisos
        };

        // Sección Liquidaciones (si está activa por el estudio)
        if (sec.liquidaciones) {
            respuesta.liquidaciones = [];
            activos.forEach(t => {
                const m = mapaMeses[t.id];
                if (m && m.emitida && m.calculo) {
                    // NUNCA datos bancarios ni sueldo base ni detalles íntimos
                    respuesta.liquidaciones.push({
                        trabajadorId: t.id,
                        nombre: t.nombre || '',
                        apellido: t.apellido || '',
                        rut: t.rut || '',
                        cargo: t.cargo || '',
                        liquido: m.calculo.liquido || 0,
                        emitida: true,
                        fechaEmision: m.fechaEmision || null
                    });
                }
            });
        }

        // Sección Documentos (si está activa por el estudio)
        if (sec.documentos) {
            const docsResp = await datos.documentos(cEstudio).catch(() => ({ ok: true, documentos: [] }));
            respuesta.documentos = (docsResp && docsResp.documentos) || [];
        }

        return respuesta;
    }

    async function obtenerLiquidacion(sesion, { empresaId, trabajadorId, periodo }) {
        if (!sesion || !sesion.email) return fallo(401, 'sin_sesion', 'Sesión no válida.');
        if (!UUID.test(String(empresaId || '')) || !UUID.test(String(trabajadorId || ''))) return fallo(400, 'params', 'Parámetros no válidos.');

        const membresias = await almacen.buscarPortalPorEmail(sesion.email);
        const acceso = membresias.find(m => m.empresaId === empresaId);
        if (!acceso) return fallo(403, 'sin_acceso', 'No tienes acceso al portal de esta empresa.');

        const sec = normalizarSecciones(acceso.secciones);
        if (!sec.liquidaciones) return fallo(403, 'seccion_inactiva', 'La sección de liquidaciones no está activa para este portal.');

        const cEstudio = { cuentaId: acceso.estudioId, empresaId: acceso.empresaId };
        const est = await datos.estado(cEstudio);
        if (!est || !est.ok) return fallo(404, 'no_existe', 'Empresa no encontrada.');

        const trab = (est.trabajadores || []).find(t => t.id === trabajadorId);
        if (!trab) return fallo(404, 'no_existe', 'Trabajador no encontrado.');

        const per = periodo && /^[0-9]{4}-[0-9]{2}$/.test(periodo) ? periodo : new Date(reloj()).toISOString().slice(0, 7);
        const mesesResp = await datos.meses(cEstudio, per);
        const listaMeses = (mesesResp && Array.isArray(mesesResp.meses)) ? mesesResp.meses : [];
        const entry = listaMeses.find(x => x.trabajadorId === trabajadorId);
        const mes = entry && entry.mes;
        if (!mes || !mes.emitida) return fallo(404, 'no_emitida', 'Esta liquidación no está emitida.');

        // Sanitización estricta: borrar datos bancarios del trabajador
        const trabSanitizado = Object.assign({}, trab, {
            banco: '', tipoCuenta: '', numeroCuenta: ''
        });

        return {
            ok: true,
            estudioId: acceso.estudioId,
            empresa: est.empresa,
            trabajador: trabSanitizado,
            mes,
            periodo: per
        };
    }

    return { listar, invitar, cambiar, quitar, portalesDe, obtenerDatos, obtenerLiquidacion, MAX_POR_EMPRESA };
}

module.exports = { crear, MAX_POR_EMPRESA };
