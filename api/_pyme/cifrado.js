/**
 * Cifrado de los datos del Asistente Pyme (AES-256-GCM).
 *
 * Todo dato personal (trabajadores, empresa, vacaciones, meses de liquidacion) se cifra aqui antes de llegar a la base:
 * quien vea la base de Neon sin la clave no puede leerlo.
 *
 * Formato de lo que se guarda (bytea): [vector 12 bytes][etiqueta 16 bytes][texto cifrado]. La version de la clave
 * va aparte, en la columna version_clave, para poder rotarla.
 *
 * Contexto: cada dato se cifra "atado" a un texto (por ejemplo "trabajadores:<uuid>"). Si alguien copia el contenido
 * cifrado de una fila a otra, o a la cuenta de otro cliente, el descifrado falla. Usar siempre un contexto distinto
 * por tabla y por registro.
 *
 * Claves (variables de entorno en Vercel, 32 bytes aleatorios en base64):
 *   PYME_DATA_KEY       version 1
 *   PYME_DATA_KEY_2..9  versiones siguientes, para rotar (ver tools/pyme_rotar_clave.js cuando exista)
 *   PYME_DATA_KEY_VERSION  version con la que se cifra (por defecto 1)
 * Perder la clave de una version deja ilegibles los datos cifrados con ella: respaldarla fuera de Vercel.
 *
 * Los errores no incluyen el contenido ni la clave.
 */
const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';
const LARGO_IV = 12;
const LARGO_TAG = 16;
const LARGO_CLAVE = 32;
const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;

class ErrorCifrado extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = 'ErrorCifrado';
    }
}

/** Convierte una clave en base64 a Buffer de 32 bytes o falla con un mensaje claro (sin mostrar la clave). */
function leerClave(texto, nombre) {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (!limpio) throw new ErrorCifrado(`${nombre} no esta configurada`);
    if (!BASE64_32_BYTES.test(limpio)) throw new ErrorCifrado(`${nombre} debe ser 32 bytes en base64 (44 caracteres, termina en "=")`);
    const clave = Buffer.from(limpio, 'base64');
    if (clave.length !== LARGO_CLAVE) throw new ErrorCifrado(`${nombre} debe medir 32 bytes`);
    if (clave.every(b => b === clave[0])) throw new ErrorCifrado(`${nombre} no es una clave aleatoria`);
    return clave;
}

/** Lee las claves del entorno: { claves: { 1: Buffer, 2: Buffer... }, versionActual }. */
function clavesDesdeEntorno(env) {
    env = env || process.env;
    const claves = {};
    claves[1] = leerClave(env.PYME_DATA_KEY, 'PYME_DATA_KEY');
    for (let v = 2; v <= 9; v++) {
        if (env['PYME_DATA_KEY_' + v]) claves[v] = leerClave(env['PYME_DATA_KEY_' + v], 'PYME_DATA_KEY_' + v);
    }
    const versionActual = env.PYME_DATA_KEY_VERSION ? Number(env.PYME_DATA_KEY_VERSION) : 1;
    if (!Number.isInteger(versionActual) || !claves[versionActual]) {
        throw new ErrorCifrado('PYME_DATA_KEY_VERSION apunta a una version sin clave configurada');
    }
    return { claves, versionActual };
}

function exigirContexto(contexto) {
    if (typeof contexto !== 'string' || contexto.length < 3) throw new ErrorCifrado('Falta el contexto del dato (por ejemplo "trabajadores:<id>")');
    return Buffer.from(contexto, 'utf8');
}

/**
 * crear({ claves, versionActual }) → { cifrar, descifrar, recifrar, versionActual }
 * Sin argumentos usa las variables de entorno.
 */
function crear(config) {
    const { claves, versionActual } = config || clavesDesdeEntorno();
    if (!claves || !claves[versionActual]) throw new ErrorCifrado('No hay clave para la version actual');

    /** Cifra un objeto o valor JSON. Devuelve { datos: Buffer, version } para guardar en datos_cifrados y version_clave. */
    function cifrar(valor, contexto) {
        const aad = exigirContexto(contexto);
        const json = JSON.stringify(valor);
        if (json === undefined) throw new ErrorCifrado('El valor no se puede serializar');
        const iv = crypto.randomBytes(LARGO_IV);
        const cifrador = crypto.createCipheriv(ALGORITMO, claves[versionActual], iv, { authTagLength: LARGO_TAG });
        cifrador.setAAD(aad);
        const cuerpo = Buffer.concat([cifrador.update(json, 'utf8'), cifrador.final()]);
        return { datos: Buffer.concat([iv, cifrador.getAuthTag(), cuerpo]), version: versionActual };
    }

    /** Descifra lo guardado. Falla si el contenido fue alterado, si el contexto no coincide o si falta la clave de esa version. */
    function descifrar(datos, version, contexto) {
        const aad = exigirContexto(contexto);
        const clave = claves[version];
        if (!clave) throw new ErrorCifrado(`No hay clave configurada para la version ${version}`);
        const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(datos || []);
        if (buf.length < LARGO_IV + LARGO_TAG + 1) throw new ErrorCifrado('Dato cifrado incompleto');
        const iv = buf.subarray(0, LARGO_IV);
        const tag = buf.subarray(LARGO_IV, LARGO_IV + LARGO_TAG);
        const cuerpo = buf.subarray(LARGO_IV + LARGO_TAG);
        try {
            const descifrador = crypto.createDecipheriv(ALGORITMO, clave, iv, { authTagLength: LARGO_TAG });
            descifrador.setAAD(aad);
            descifrador.setAuthTag(tag);
            const json = Buffer.concat([descifrador.update(cuerpo), descifrador.final()]).toString('utf8');
            return JSON.parse(json);
        } catch (e) {
            // Mensaje unico: no distingue clave equivocada de contenido alterado ni de contexto distinto
            throw new ErrorCifrado('No se pudo descifrar el dato (clave, contexto o contenido no coinciden)');
        }
    }

    /** Descifra con la version guardada y vuelve a cifrar con la actual. Para rotar la clave. */
    function recifrar(datos, version, contexto) {
        return cifrar(descifrar(datos, version, contexto), contexto);
    }

    return { cifrar, descifrar, recifrar, versionActual };
}

module.exports = { crear, clavesDesdeEntorno, leerClave, ErrorCifrado, LARGO_IV, LARGO_TAG };
