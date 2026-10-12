/**
 * Datos del Asistente Pyme: empresa y trabajadores de una cuenta.
 *
 * Reglas
 *  - Todo dato personal se cifra aqui (AES-256-GCM) antes de pasar al almacen; la base solo ve bytes.
 *  - Cada dato se cifra atado a su cuenta (y a su id en el caso de los trabajadores): copiarlo a otra fila o cuenta lo inutiliza.
 *  - Limite de trabajadores activos: 1 sin pase y 5 con pase vigente. Lo aplica el servidor en la misma sentencia SQL del INSERT.
 *  - No puede haber dos trabajadores con el mismo RUT en una empresa, y se permiten hasta 50 en total (activos + inactivos).
 *
 * Todas las funciones devuelven { ok: true, ... } o { ok: false, estado, codigo, error, errores? } (estado = codigo HTTP).
 */
const crypto = require('crypto');
const V = require('./validar');

const MAX_SIN_PASE = 1;
const MAX_CON_PASE = 5;
const MAX_TOTAL = 50;
const VERSION_EXPORTACION = 1;

function fallo(estado, codigo, error, errores) {
    const r = { ok: false, estado, codigo, error };
    if (errores) r.errores = errores;
    return r;
}

function crear({ almacen, cifrado, ahora }) {
    const reloj = ahora || Date.now;
    const iso = () => new Date(reloj()).toISOString();
    const ctxEmpresa = (cuentaId) => `empresas:${cuentaId}`;
    const ctxTrabajador = (cuentaId, id) => `trabajadores:${cuentaId}:${id}`;

    async function limites(cuentaId) {
        const vence = await almacen.paseVigente(cuentaId, iso());
        return { maxActivos: vence ? MAX_CON_PASE : MAX_SIN_PASE, paseVence: vence ? new Date(vence).toISOString() : null };
    }

    async function leerTrabajadores(cuentaId, empresaId) {
        const filas = await almacen.listarTrabajadores(empresaId);
        return filas.map(f => Object.assign({ id: f.id }, cifrado.descifrar(f.datos, f.version, ctxTrabajador(cuentaId, f.id)), { activo: f.activo }));
    }

    /** Todo lo que el panel necesita para dibujarse. */
    async function estado(cuenta) {
        const lim = await limites(cuenta.cuentaId);
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return { ok: true, cuenta: { email: cuenta.email }, empresa: null, trabajadores: [], limites: lim, maxTotal: MAX_TOTAL };
        const empresa = cifrado.descifrar(fila.datos, fila.version, ctxEmpresa(cuenta.cuentaId));
        const trabajadores = await leerTrabajadores(cuenta.cuentaId, fila.id);
        return { ok: true, cuenta: { email: cuenta.email }, empresa, trabajadores, limites: lim, maxTotal: MAX_TOTAL };
    }

    async function guardarEmpresa(cuenta, entrada) {
        const v = V.validarEmpresa(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos de la empresa.', v.errores);
        const c = cifrado.cifrar(v.valor, ctxEmpresa(cuenta.cuentaId));
        await almacen.guardarEmpresa(cuenta.cuentaId, c.datos, c.version, iso());
        return { ok: true, empresa: v.valor };
    }

    async function crearTrabajador(cuenta, entrada) {
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(409, 'sin_empresa', 'Primero guarda los datos de la empresa.');
        const v = V.validarTrabajador(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos del trabajador.', v.errores);
        const existentes = await leerTrabajadores(cuenta.cuentaId, fila.id);
        if (existentes.length >= MAX_TOTAL) return fallo(409, 'limite_total', `Una empresa puede tener hasta ${MAX_TOTAL} trabajadores en el asistente.`);
        if (existentes.some(t => t.rut === v.valor.rut)) return fallo(409, 'rut_repetido', 'Ya existe un trabajador con este RUT.', { rut: 'Ya existe un trabajador con este RUT.' });
        const lim = await limites(cuenta.cuentaId);
        const id = crypto.randomUUID();
        const { activo, ...datos } = v.valor;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const creado = await almacen.crearTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!creado) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    async function actualizarTrabajador(cuenta, id, entrada) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const v = V.validarTrabajador(entrada);
        if (!v.ok) return fallo(400, 'validacion', 'Revisa los datos del trabajador.', v.errores);
        const existentes = await leerTrabajadores(cuenta.cuentaId, fila.id);
        if (!existentes.some(t => t.id === id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        if (existentes.some(t => t.id !== id && t.rut === v.valor.rut)) return fallo(409, 'rut_repetido', 'Ya existe un trabajador con este RUT.', { rut: 'Ya existe un trabajador con este RUT.' });
        const lim = await limites(cuenta.cuentaId);
        const { activo, ...datos } = v.valor;
        const c = cifrado.cifrar(datos, ctxTrabajador(cuenta.cuentaId, id));
        const ok = await almacen.actualizarTrabajador({ id, empresaId: fila.id, activo, datos: c.datos, version: c.version, ahoraIso: iso(), maxActivos: lim.maxActivos });
        if (!ok) return fallo(409, 'limite', limiteTexto(lim));
        return { ok: true, trabajador: Object.assign({ id }, datos, { activo }) };
    }

    async function borrarTrabajador(cuenta, id) {
        if (!esUuid(id)) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        if (!fila || !(await almacen.borrarTrabajador(id, fila.id))) return fallo(404, 'no_existe', 'No encontramos al trabajador.');
        return { ok: true };
    }

    /**
     * Importa empresa y trabajadores (por ejemplo, los que el usuario tenia en el generador de liquidaciones).
     * La empresa existente solo se reemplaza si viene con datos validos. Los trabajadores que ya existen por RUT se saltan.
     */
    async function importar(cuenta, entrada) {
        if (!entrada || typeof entrada !== 'object') return fallo(400, 'validacion', 'No hay datos para importar.');
        const salida = { ok: true, empresa: false, importados: 0, omitidos: [] };
        if (entrada.empresa) {
            const r = await guardarEmpresa(cuenta, entrada.empresa);
            if (!r.ok) return Object.assign(r, { error: 'Los datos de la empresa no son válidos: ' + Object.keys(r.errores || {}).join(', ') });
            salida.empresa = true;
        }
        const lista = Array.isArray(entrada.trabajadores) ? entrada.trabajadores.slice(0, MAX_TOTAL) : [];
        for (const t of lista) {
            const r = await crearTrabajador(cuenta, t);
            const nombre = (t && typeof t.nombre === 'string' && t.nombre.slice(0, 80)) || 'Sin nombre';
            if (r.ok) salida.importados++;
            else if (r.codigo === 'sin_empresa') return fallo(409, 'sin_empresa', 'Primero guarda los datos de la empresa.');
            else salida.omitidos.push({ nombre, motivo: r.codigo === 'limite' ? 'limite' : r.codigo === 'rut_repetido' ? 'repetido' : 'invalido', detalle: r.errores || null });
        }
        return salida;
    }

    /** Todo lo guardado, descifrado, para que la persona lo descargue. */
    async function exportar(cuenta) {
        const e = await estado(cuenta);
        return {
            ok: true,
            archivo: {
                formato: 'calculolaboral-asistente-pyme',
                version: VERSION_EXPORTACION,
                exportado: iso(),
                cuenta: { email: cuenta.email },
                empresa: e.empresa,
                trabajadores: e.trabajadores
            }
        };
    }

    async function borrarCuenta(cuenta, confirmar) {
        if (typeof confirmar !== 'string' || confirmar.trim().toLowerCase() !== cuenta.email) {
            return fallo(400, 'confirmacion', 'Escribe tu correo exactamente para confirmar que quieres eliminar la cuenta.');
        }
        await almacen.borrarCuenta(cuenta.cuentaId);
        return { ok: true };
    }

    return { estado, guardarEmpresa, crearTrabajador, actualizarTrabajador, borrarTrabajador, importar, exportar, borrarCuenta };
}

function limiteTexto(lim) {
    return lim.paseVence
        ? `Tu pase permite hasta ${MAX_CON_PASE} trabajadores activos.`
        : `Sin pase puedes tener ${MAX_SIN_PASE} trabajador activo. Con el Pase Pyme son hasta ${MAX_CON_PASE}.`;
}

function esUuid(s) { return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }

module.exports = { crear, MAX_SIN_PASE, MAX_CON_PASE, MAX_TOTAL, VERSION_EXPORTACION };
