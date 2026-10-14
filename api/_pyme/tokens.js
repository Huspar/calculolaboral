/**
 * Tokens y huellas del Asistente Pyme.
 *
 * Los tokens de acceso (enlace por correo) y de sesion (cookie) se generan al azar y en la base se guarda solo su huella
 * HMAC-SHA256 con PYME_SESSION_SECRET: quien robe la base no puede reconstruir ni usar un token, ni siquiera probando.
 * Las IP y los correos que se usan para limitar solicitudes tambien se guardan solo como huella.
 *
 * PYME_SESSION_SECRET: 32 bytes aleatorios en base64 (mismo formato que PYME_DATA_KEY).
 */
const crypto = require('crypto');
const { leerClave } = require('./cifrado');

const BYTES_TOKEN = 32;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function secretoDesdeEntorno(env) {
    env = env || process.env;
    return leerClave(env.PYME_SESSION_SECRET, 'PYME_SESSION_SECRET');
}

/** Token aleatorio de 256 bits en base64url (43 caracteres). Se entrega una sola vez al usuario. */
function nuevoToken() {
    return crypto.randomBytes(BYTES_TOKEN).toString('base64url');
}

/** El formato correcto, antes de consultar la base (evita consultas con basura). */
function tokenValido(token) {
    return typeof token === 'string' && FORMATO_TOKEN.test(token);
}

function huella(secreto, dominio, valor) {
    return crypto.createHmac('sha256', secreto).update(dominio + '|' + String(valor), 'utf8').digest('hex');
}

/** Huella de un token de acceso o de sesion (distintos dominios: uno no sirve como el otro). */
function huellaToken(secreto, tipo, token) {
    if (tipo !== 'acceso' && tipo !== 'sesion' && tipo !== 'liquidacion') throw new Error('Tipo de token desconocido');
    return huella(secreto, 'token-' + tipo, token);
}

/** Huella del correo (en minusculas y sin espacios) o de la IP, para contar solicitudes sin guardarlos. */
function huellaCorreo(secreto, correo) {
    return huella(secreto, 'correo', String(correo).trim().toLowerCase());
}
function huellaIp(secreto, ip) {
    return huella(secreto, 'ip', String(ip).trim());
}

module.exports = { secretoDesdeEntorno, nuevoToken, tokenValido, huellaToken, huellaCorreo, huellaIp };
