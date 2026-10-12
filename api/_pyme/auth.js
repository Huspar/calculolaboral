/**
 * Cuentas del Asistente Pyme: entrar con un enlace enviado al correo, sin contrasenas.
 *
 * Flujo
 *  1. solicitarAcceso({ email, ip }): crea un token de un solo uso (15 min) y envia el enlace. Responde siempre igual,
 *     exista o no la cuenta, para no revelar quien tiene cuenta. Limita solicitudes por correo y por IP.
 *  2. previsualizar(token): el enlace abre una pagina intermedia que muestra el correo (enmascarado) y pide confirmar.
 *     No consume el token: asi los escaneos automaticos de los correos no lo gastan.
 *  3. completar({ token, acepto, ip }): consume el token (una sola vez), crea o actualiza la cuenta, registra la aceptacion
 *     de la clausula de encargo si corresponde y abre una sesion de 30 dias.
 *  4. leerSesion(tokenSesion) y cerrar(tokenSesion).
 *
 * Todo lo que toca la base o el correo llega por dependencias (almacen, enviarCorreo, ahora): se prueba sin red.
 * En la base solo se guardan huellas HMAC de tokens, correos e IP (ver tokens.js).
 */
const T = require('./tokens');

const MINUTOS_ENLACE = 15;
const DIAS_SESION = 30;
const RENOVAR_CUANDO_QUEDAN_DIAS = 15;
const LIMITE_CORREO_POR_HORA = 5;
const LIMITE_IP_POR_HORA = 20;
const MAX_LARGO_CORREO = 254;
const FORMATO_CORREO = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

/** Correo en minusculas o null si no tiene forma de correo. */
function normalizarCorreo(valor) {
    if (typeof valor !== 'string') return null;
    const c = valor.trim().toLowerCase();
    if (!c || c.length > MAX_LARGO_CORREO || !FORMATO_CORREO.test(c)) return null;
    return c;
}

/** "ana.perez@ejemplo.cl" → "a***@e***.cl" (para mostrar en la pagina de confirmacion). */
function enmascarar(correo) {
    const [local, dominio] = correo.split('@');
    const punto = dominio.lastIndexOf('.');
    return local.charAt(0) + '***@' + dominio.charAt(0) + '***' + dominio.slice(punto);
}

function inicioDeHora(ms) {
    const d = new Date(ms);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
}

function crear(deps) {
    const { almacen, enviarCorreo, secreto, siteUrl } = deps;
    const ahora = deps.ahora || Date.now;

    async function auditar(evento, cuentaId, ip) {
        try {
            await almacen.registrarAuditoria({ cuentaId: cuentaId || null, evento, ipHash: T.huellaIp(secreto, ip), cuando: new Date(ahora()).toISOString() });
        } catch (e) { /* la auditoria no debe impedir el acceso */ }
    }

    /**
     * Devuelve { ok: true } siempre que el correo sea valido, se haya enviado o no (no revela nada de la cuenta).
     * { ok: false, motivo: 'correo' } si el formato no es de correo, { ok: false, motivo: 'limite' } si esta IP pidio demasiados enlaces.
     */
    async function solicitarAcceso({ email, ip }) {
        const correo = normalizarCorreo(email);
        if (!correo) return { ok: false, motivo: 'correo' };
        const ms = ahora();
        const ventana = inicioDeHora(ms);

        await almacen.limpiar(new Date(ms).toISOString());

        const porIp = await almacen.sumarIntento(T.huellaIp(secreto, ip) + ':entrar', ventana);
        if (porIp > LIMITE_IP_POR_HORA) {
            await auditar('acceso_limitado_ip', null, ip);
            return { ok: false, motivo: 'limite' };
        }
        const porCorreo = await almacen.sumarIntento(T.huellaCorreo(secreto, correo) + ':entrar', ventana);
        if (porCorreo > LIMITE_CORREO_POR_HORA) {
            // Misma respuesta que si se hubiera enviado: no se confirma nada y no se llena la casilla de nadie
            await auditar('acceso_limitado_correo', null, ip);
            return { ok: true };
        }

        const token = T.nuevoToken();
        const vence = new Date(ms + MINUTOS_ENLACE * 60000);
        const tokenHash = T.huellaToken(secreto, 'acceso', token);
        await almacen.crearEnlace({ email: correo, tokenHash, creado: new Date(ms).toISOString(), vence: vence.toISOString() });
        // clave: identifica este envio (el servicio de correo descarta un duplicado con la misma clave)
        await enviarCorreo({ to: correo, enlace: `${siteUrl}/api/pyme/verificar?t=${token}`, vence, clave: tokenHash.slice(0, 40) });
        await auditar('acceso_solicitado', null, ip);
        return { ok: true };
    }

    /** Antes de consumir el token: ¿es valido?, ¿a quien corresponde?, ¿hay que aceptar la clausula? */
    async function previsualizar(token) {
        if (!T.tokenValido(token)) return { valido: false };
        const enlace = await almacen.buscarEnlace(T.huellaToken(secreto, 'acceso', token), new Date(ahora()).toISOString());
        if (!enlace) return { valido: false };
        const cuenta = await almacen.buscarCuentaPorEmail(enlace.email);
        return { valido: true, correoEnmascarado: enmascarar(enlace.email), requiereAceptar: !(cuenta && cuenta.aceptoEncargo) };
    }

    /**
     * Consume el token y abre la sesion. { ok: true, sesion: { token, vence } }
     * o { ok: false, motivo: 'invalido' | 'aceptar' } (con 'aceptar' el token sigue sin usarse).
     */
    async function completar({ token, acepto, ip }) {
        if (!T.tokenValido(token)) return { ok: false, motivo: 'invalido' };
        const ms = ahora();
        const iso = new Date(ms).toISOString();
        const hash = T.huellaToken(secreto, 'acceso', token);

        const enlace = await almacen.buscarEnlace(hash, iso);
        if (!enlace) return { ok: false, motivo: 'invalido' };
        const existente = await almacen.buscarCuentaPorEmail(enlace.email);
        const hayAceptacion = !!(existente && existente.aceptoEncargo);
        if (!hayAceptacion && acepto !== true && acepto !== 'on' && acepto !== '1' && acepto !== 'true') {
            return { ok: false, motivo: 'aceptar' };
        }

        // Atomico: dos clics o dos dispositivos con el mismo enlace, solo uno entra
        const correo = await almacen.consumirEnlace(hash, iso);
        if (!correo) return { ok: false, motivo: 'invalido' };

        const cuenta = await almacen.upsertCuenta(correo, hayAceptacion ? null : iso, iso);
        const tokenSesion = T.nuevoToken();
        const vence = new Date(ms + DIAS_SESION * 86400000);
        await almacen.crearSesion({ cuentaId: cuenta.id, tokenHash: T.huellaToken(secreto, 'sesion', tokenSesion), creada: iso, vence: vence.toISOString() });
        await auditar(hayAceptacion ? 'acceso_ok' : 'acceso_ok_acepta_encargo', cuenta.id, ip);
        return { ok: true, sesion: { token: tokenSesion, vence: vence.getTime() } };
    }

    /** { autenticado: false } o { autenticado: true, cuentaId, email, renovada?: { token, vence } }. */
    async function leerSesion(tokenSesion) {
        if (!T.tokenValido(tokenSesion)) return { autenticado: false };
        const ms = ahora();
        const hash = T.huellaToken(secreto, 'sesion', tokenSesion);
        const s = await almacen.buscarSesion(hash, new Date(ms).toISOString());
        if (!s) return { autenticado: false };
        const salida = { autenticado: true, cuentaId: s.cuentaId, email: s.email };
        if (s.vence - ms < RENOVAR_CUANDO_QUEDAN_DIAS * 86400000) {
            const nuevoVence = ms + DIAS_SESION * 86400000;
            await almacen.extenderSesion(s.sesionId, new Date(nuevoVence).toISOString());
            salida.renovada = { token: tokenSesion, vence: nuevoVence };
        }
        return salida;
    }

    async function cerrar(tokenSesion, ip) {
        if (!T.tokenValido(tokenSesion)) return { ok: true };
        const hash = T.huellaToken(secreto, 'sesion', tokenSesion);
        const s = await almacen.buscarSesion(hash, new Date(ahora()).toISOString());
        await almacen.revocarSesion(hash, new Date(ahora()).toISOString());
        if (s) await auditar('sesion_cerrada', s.cuentaId, ip);
        return { ok: true };
    }

    return { solicitarAcceso, previsualizar, completar, leerSesion, cerrar };
}

module.exports = {
    crear, normalizarCorreo, enmascarar,
    MINUTOS_ENLACE, DIAS_SESION, LIMITE_CORREO_POR_HORA, LIMITE_IP_POR_HORA
};
