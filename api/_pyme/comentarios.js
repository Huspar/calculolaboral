/**
 * Opiniones del piloto gratuito: lo que funciona, lo que no y qué agregarían los usuarios (decisión del dueño, 14-oct-2026).
 *
 *   crear({ almacen, enviar, destino, ahora }) → { guardar(cuenta, entrada) }
 *   enviar: ({ to, reply_to, asunto, html, texto, clave }) → Promise (opcional; si falla la opinión igual queda guardada)
 *
 * Reglas
 *  - No es obligatoria: ninguna función del asistente depende de haber opinado.
 *  - Texto libre de 5 a 2.000 caracteres; el formulario pide no escribir datos de los trabajadores y aquí no se leen ni se usan.
 *  - Máximo 5 opiniones por cuenta en 24 horas (lo aplica la propia sentencia SQL).
 *  - Se avisa al equipo por correo. El correo de la persona solo viaja si marcó «puedes escribirme»; en ese caso se responde a ella.
 */
const C = require('./correo');

const MAX_POR_DIA = 5;
const MIN_TEXTO = 5, MAX_TEXTO = 2000;
const PANTALLA = /^[a-z0-9/_-]{0,40}$/;

function fallo(estado, codigo, error) { return { ok: false, estado, codigo, error }; }

function crear({ almacen, enviar, destino, ahora }) {
    const reloj = ahora || Date.now;

    async function guardar(cuenta, entrada) {
        const e = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
        const tipo = e.tipo;
        if (!Object.prototype.hasOwnProperty.call(C.TIPOS_COMENTARIO, tipo)) return fallo(400, 'validacion', 'Elige qué quieres contarnos.');
        const texto = typeof e.texto === 'string' ? e.texto.replace(/\r\n/g, '\n').trim() : '';
        if (texto.length < MIN_TEXTO) return fallo(400, 'validacion', 'Cuéntanos un poco más (al menos 5 caracteres).');
        if (texto.length > MAX_TEXTO) return fallo(400, 'validacion', `El mensaje puede tener hasta ${MAX_TEXTO} caracteres.`);
        const pantalla = typeof e.pantalla === 'string' && PANTALLA.test(e.pantalla) ? e.pantalla : '';
        const contacto = e.contacto === true;
        const fecha = new Date(reloj()).toISOString();
        const id = await almacen.guardarComentario({ cuentaId: cuenta.cuentaId, tipo, pantalla, texto, contacto, ahoraIso: fecha, maxPorDia: MAX_POR_DIA });
        if (!id) return fallo(429, 'limite_comentarios', `Ya nos enviaste ${MAX_POR_DIA} opiniones hoy. Gracias: escríbenos mañana con lo que falte.`);
        if (enviar && destino) {
            try {
                const c = C.correoComentario({ tipo, texto, pantalla, contacto, email: cuenta.email, fecha });
                await enviar({ to: destino, reply_to: contacto ? cuenta.email : undefined, asunto: c.asunto, html: c.html, texto: c.texto, clave: 'pyme-comentario-' + id });
            } catch (err) {
                // La opinión ya quedó guardada: el aviso por correo es un extra
                console.error('pyme comentario: no se pudo avisar por correo:', String((err && err.message) || '').slice(0, 120));
            }
        }
        return { ok: true, id };
    }

    return { guardar };
}

module.exports = { crear, MAX_POR_DIA, MIN_TEXTO, MAX_TEXTO };
