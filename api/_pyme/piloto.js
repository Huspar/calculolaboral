/**
 * Piloto gratuito del Asistente Pyme (decisión del dueño, 14-oct-2026): hasta el 31 de diciembre de 2026 toda cuenta tiene lo mismo
 * que el Pase de 12 meses (hasta 5 trabajadores activos, documentos sin marca de agua, Word y generadores incluidos) sin pagar.
 * A cambio se pide opinión, pero no es obligatoria.
 *
 *   crear(env, ahora) → { activo(), vence(), producto }
 *
 *  - La fecha vive aquí, no en una variable de Vercel: no hay nada que configurar y termina sola.
 *  - Para cerrarlo antes: PYME_PILOTO_FIN=1 en Vercel (y redesplegar). Una cuenta con un Pase pagado que dure más sigue con el suyo.
 *  - Al terminar, la cuenta vuelve a las funciones gratuitas (1 trabajador activo), igual que cuando vence un Pase.
 */
// 31-dic-2026 a las 23:59:59 hora de Chile (UTC-3 en verano)
const VENCE = '2027-01-01T02:59:59.000Z';
const FECHA_FIN = '2026-12-31'; // el mismo día, como fecha de Chile (para mostrarla y contar los días que faltan)
const PRODUCTO = 'pyme12';

function crear(env, ahora) {
    const reloj = ahora || Date.now;
    const cerrado = () => !!(env && env.PYME_PILOTO_FIN === '1');
    return {
        producto: PRODUCTO,
        vence: () => VENCE,
        fechaFin: () => FECHA_FIN,
        activo: () => !cerrado() && reloj() < Date.parse(VENCE)
    };
}

module.exports = { crear, VENCE, FECHA_FIN, PRODUCTO };
