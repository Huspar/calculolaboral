/**
 * Permisos del Asistente Pyme: una sola tabla de roles y acciones que usan todas las rutas (y que se prueba entera).
 *
 *   permitir(rol, accion)  → true o false (un rol o una acción desconocidos se rechazan)
 *   accionDe(ruta, metodo) → la acción que exige esa ruta, o null si cualquiera con sesión puede
 *
 * Hoy toda cuenta es «titular»; los demás roles entran con el equipo (propuesta-equipo-y-portal-cliente.md).
 * Dejar el control aquí, y no en cada ruta, es lo que evita que un permiso se olvide en una ruta nueva.
 */
const ROLES = ['titular', 'admin', 'contador', 'asistente', 'lectura'];

// Acción → roles que la tienen (la matriz de la propuesta)
const MATRIZ = {
    ver: ['titular', 'admin', 'contador', 'asistente', 'lectura'],
    ficha_editar: ['titular', 'admin', 'contador', 'asistente'],
    liquidar: ['titular', 'admin', 'contador'],            // guardar, emitir, honorarios y enlaces de liquidación
    descargar: ['titular', 'admin', 'contador'],           // Previred, LRE, nómina de pagos, asiento, enlaces
    empresa_gestionar: ['titular', 'admin'],               // crear, editar los datos o borrar una empresa
    respaldo: ['titular', 'admin'],                        // exportar todo
    equipo_gestionar: ['titular', 'admin'],
    actividad_ver: ['titular', 'admin'],
    cuenta_borrar: ['titular']
};

// Ruta y método → acción. Lo que no está aquí lo puede usar cualquier persona con sesión (su propia cuenta, avisos, opiniones).
const RUTAS = {
    estado: { GET: 'ver' }, meses: { GET: 'ver' }, honorarios: { GET: 'ver', PUT: 'liquidar' }, documentos: { GET: 'ver' }, vacaciones: { GET: 'ver' }, 'enlaces-liquidacion': { GET: 'ver' },
    empresa: { PUT: 'empresa_gestionar' }, empresas: { POST: 'empresa_gestionar', DELETE: 'empresa_gestionar' },
    trabajador: { POST: 'ficha_editar', PUT: 'ficha_editar', DELETE: 'ficha_editar' }, prestamos: { PUT: 'ficha_editar' }, ausencias: { PUT: 'ficha_editar' },
    documento: { POST: 'ficha_editar' }, vacacion: { POST: 'ficha_editar', DELETE: 'ficha_editar' }, importar: { POST: 'ficha_editar' },
    mes: { PUT: 'liquidar', DELETE: 'liquidar' }, 'enlace-liquidacion': { POST: 'liquidar', DELETE: 'liquidar' },
    exportar: { GET: 'respaldo' }, actividad: { GET: 'actividad_ver', POST: 'ver' }, 'borrar-cuenta': { POST: 'cuenta_borrar' }
};

function permitir(rol, accion) {
    return ROLES.indexOf(rol) >= 0 && Object.prototype.hasOwnProperty.call(MATRIZ, accion) && MATRIZ[accion].indexOf(rol) >= 0;
}
function accionDe(ruta, metodo) {
    const r = Object.prototype.hasOwnProperty.call(RUTAS, ruta) ? RUTAS[ruta] : null;
    return r && Object.prototype.hasOwnProperty.call(r, metodo) ? r[metodo] : null;
}

// Lo que el navegador avisa después de bajar un archivo (el archivo se arma en el navegador y el servidor no lo ve):
// avisa el rol que tiene permiso para esa descarga.
const DESCARGAS = { descarga_previred: 'descargar', descarga_lre: 'descargar', descarga_nomina: 'descargar', descarga_asiento: 'descargar', descarga_enlaces: 'descargar', descarga_libro: 'descargar' };

module.exports = { ROLES, MATRIZ, RUTAS, DESCARGAS, permitir, accionDe };
