/**
 * Equipo del estudio (fase 2): quién puede entrar a la cuenta del titular y con qué rol.
 *
 *   crear({ almacen, datos, ahora })
 *     .listar(cuenta)                         → { ok, miembros: [{ id, email, rol, empresas, ultimoAcceso }], maximo, rolesQueSePuedenDar }
 *     .invitar(cuenta, { email, rol, empresas })
 *     .cambiar(cuenta, id, { rol, empresas })
 *     .quitar(cuenta, id)
 *     .resolver(sesion, estudioId)            → la sesión con el estudio, el rol y las empresas permitidas (o null si no tiene acceso)
 *     .estudiosDe(sesion)                     → los estudios a los que puede entrar esa persona
 *
 * No hay invitación con enlace aparte: la persona entra a calculolaboral.cl/app con SU correo (enlace de un solo uso, como siempre) y el
 * servidor la reconoce por ese correo. Así el correo queda comprobado por el mismo mecanismo de acceso y no hay otro enlace que se pueda reenviar.
 */
const { ROLES } = require('./permisos');

const MAX_PERSONAS = 5;                                // en total, incluida la persona titular
const ROLES_ASIGNABLES = ROLES.filter(r => r !== 'titular');
const CORREO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallo(estado, codigo, error) { return { ok: false, estado, codigo, error }; }

function crear({ almacen, datos, ahora }) {
    const reloj = ahora || Date.now;

    // Solo el titular da el rol de administrador (un administrador no se puede dar más poder del que tiene)
    function rolesPara(cuenta) { return cuenta.rol === 'titular' ? ROLES_ASIGNABLES : ROLES_ASIGNABLES.filter(r => r !== 'admin'); }

    async function empresasDelEstudio(cuenta) {
        const e = await datos.estado(Object.assign({}, cuenta, { empresaId: undefined, empresasPermitidas: null }));
        return e.ok ? (e.empresas || []).map(x => x.id) : [];
    }

    async function listar(cuenta) {
        const filas = await almacen.listarMiembros(cuenta.cuentaId);
        return { ok: true, miembros: filas.map(m => ({ id: m.id, email: m.email, rol: m.rol, empresas: m.empresas, ultimoAcceso: m.ultimoAcceso })), maximo: MAX_PERSONAS, rolesQueSePuedenDar: rolesPara(cuenta) };
    }

    async function validarEntrada(cuenta, rol, empresas) {
        if (rolesPara(cuenta).indexOf(rol) < 0) return fallo(403, 'rol', rol === 'admin' ? 'Solo el titular puede nombrar administradores.' : 'Ese rol no existe.');
        const propias = await empresasDelEstudio(cuenta);
        const lista = Array.isArray(empresas) ? empresas.filter(x => typeof x === 'string' && UUID.test(x)).map(x => x.toLowerCase()) : [];
        const unicas = lista.filter((x, i) => lista.indexOf(x) === i);
        if (unicas.some(x => propias.indexOf(x) < 0)) return fallo(400, 'empresa', 'Una de las empresas no es de este estudio.');
        // El administrador ve todo; el resto necesita al menos una empresa para poder trabajar
        if (rol !== 'admin' && !unicas.length) return fallo(400, 'empresa', 'Elige al menos una empresa para esa persona.');
        return { ok: true, empresas: rol === 'admin' ? [] : unicas };
    }

    async function invitar(cuenta, entrada) {
        const email = String((entrada && entrada.email) || '').trim().toLowerCase();
        if (!CORREO.test(email)) return fallo(400, 'correo', 'Escribe un correo válido.');
        if (email === String(cuenta.email || '').toLowerCase()) return fallo(400, 'correo', 'Ese es tu propio correo: ya eres el titular.');
        const v = await validarEntrada(cuenta, entrada.rol, entrada.empresas);
        if (!v.ok) return v;
        const existentes = await almacen.listarMiembros(cuenta.cuentaId);
        if (existentes.some(m => m.email === email)) return fallo(409, 'repetido', 'Esa persona ya está en el equipo.');
        if (existentes.length + 1 >= MAX_PERSONAS) return fallo(409, 'limite', 'El estudio llegó al máximo de ' + MAX_PERSONAS + ' personas (contándote a ti).');
        const m = await almacen.crearMiembro({ estudioId: cuenta.cuentaId, email, rol: entrada.rol, empresas: v.empresas, invitadoPor: cuenta.personaId || cuenta.cuentaId, ahoraIso: new Date(reloj()).toISOString(), maxMiembros: MAX_PERSONAS - 1 });
        if (!m) return fallo(409, 'limite', 'El estudio llegó al máximo de ' + MAX_PERSONAS + ' personas (contándote a ti).');
        return { ok: true, miembro: { id: m.id, email, rol: entrada.rol, empresas: v.empresas } };
    }

    async function cambiar(cuenta, id, entrada) {
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos a esa persona.');
        const actual = (await almacen.listarMiembros(cuenta.cuentaId)).find(m => m.id === id);
        if (!actual) return fallo(404, 'no_existe', 'No encontramos a esa persona.');
        // Un administrador no toca a otro administrador
        if (actual.rol === 'admin' && cuenta.rol !== 'titular') return fallo(403, 'rol', 'Solo el titular puede cambiar a un administrador.');
        const rol = entrada && entrada.rol ? entrada.rol : actual.rol;
        const v = await validarEntrada(cuenta, rol, entrada && entrada.empresas !== undefined ? entrada.empresas : actual.empresas);
        if (!v.ok) return v;
        await almacen.actualizarMiembro(cuenta.cuentaId, id, { rol, empresas: v.empresas });
        return { ok: true };
    }

    async function quitar(cuenta, id) {
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos a esa persona.');
        const actual = (await almacen.listarMiembros(cuenta.cuentaId)).find(m => m.id === id);
        if (!actual) return fallo(404, 'no_existe', 'No encontramos a esa persona.');
        if (actual.rol === 'admin' && cuenta.rol !== 'titular') return fallo(403, 'rol', 'Solo el titular puede quitar a un administrador.');
        await almacen.borrarMiembro(cuenta.cuentaId, id);
        return { ok: true };
    }

    // Con el estudio pedido (X-CL-Estudio) devuelve la sesión «como miembro»; sin él, o con el propio, la cuenta de la persona es la titular.
    async function resolver(s, estudioId) {
        if (!estudioId || estudioId === s.cuentaId) return Object.assign({}, s, { rol: 'titular', personaId: s.cuentaId, empresasPermitidas: null });
        const m = await almacen.buscarMiembro(estudioId, s.email);
        if (!m) return null;
        await almacen.tocarMiembro(m.id, new Date(reloj()).toISOString()).catch(() => {});
        return Object.assign({}, s, { cuentaId: estudioId, personaId: s.cuentaId, rol: m.rol, empresasPermitidas: m.rol === 'admin' ? null : m.empresas });
    }

    async function estudiosDe(s) {
        const filas = await almacen.estudiosDeMiembro(s.email);
        return [{ estudioId: s.cuentaId, rol: 'titular', titular: s.email, propio: true }].concat(filas.map(f => ({ estudioId: f.estudioId, rol: f.rol, titular: f.titular, propio: false })));
    }

    return { listar, invitar, cambiar, quitar, resolver, estudiosDe, MAX_PERSONAS };
}

module.exports = { crear, MAX_PERSONAS };
