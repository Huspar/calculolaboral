/**
 * Avisos por correo del Asistente Pyme: una vez al día (tarea programada de Vercel) revisa las cuentas que los activaron y
 * manda un correo con los avisos urgentes o importantes del Cierre del mes (los mismos de js/pyme_pendientes.js).
 *
 *  - Solo cuentas con la preferencia activa (apagada por defecto; se activa en «Mi cuenta»).
 *  - Un aviso no se repite antes de 7 días. Si no hay avisos nuevos, no se manda nada.
 *  - Cada correo trae un enlace firmado para darse de baja (página con confirmación, para que un revisor de enlaces del
 *    correo no la apague solo).
 *  - Sin datos personales en los registros: solo cuántas cuentas se revisaron y cuántos correos salieron.
 *
 * crear({ almacen, datos, enviar, secreto, siteUrl, ahora, P, F }) → { correr(), firmaBaja(cuentaId), validarBaja(token) }
 */
const crypto = require('crypto');
const C = require('./correo');
const PEND = require('../../js/pyme_pendientes.js');

const DIAS_REPETIR = 7, DIAS_GUARDAR = 45, MAX_CUENTAS_POR_CORRIDA = 300;

function hoyChile(ms) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
function diasEntre(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

function crear({ almacen, datos, enviar, secreto, siteUrl, ahora, P, F }) {
    const reloj = ahora || Date.now;

    function firmaBaja(cuentaId) {
        const f = crypto.createHmac('sha256', secreto).update('baja-avisos|' + cuentaId, 'utf8').digest('base64url').slice(0, 32);
        return cuentaId + '.' + f;
    }
    function validarBaja(token) {
        const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(String(token || ''));
        if (!m) return null;
        const esperado = firmaBaja(m[1]).split('.')[1];
        const a = Buffer.from(m[2]), b = Buffer.from(esperado);
        return a.length === b.length && crypto.timingSafeEqual(a, b) ? m[1] : null;
    }

    async function correr() {
        const hoy = hoyChile(reloj());
        const cuentas = await almacen.cuentasConAvisos(MAX_CUENTAS_POR_CORRIDA);
        const r = { revisadas: 0, enviados: 0, errores: 0 };
        for (const c of cuentas) {
            r.revisadas++;
            try {
                const cuenta = { cuentaId: c.cuentaId, email: c.email };
                const est = await datos.estado(cuenta);
                if (!est.ok || !est.empresa) continue;
                const docs = (await datos.documentos(cuenta)).documentos || [];
                // El respaldo y los demás avisos informativos no van por correo
                const lista = PEND.pendientes(est, { hoy, P, F, ultimoRespaldo: hoy, documentos: docs })
                    .filter(a => a.nivel === 'urgente' || a.nivel === 'aviso');
                const previos = c.enviados || {};
                const nuevos = lista.filter(a => !previos[a.id] || diasEntre(previos[a.id], hoy) >= DIAS_REPETIR);
                if (!nuevos.length) continue;
                const correo = C.correoAvisos({ avisos: lista, nuevos: nuevos.map(a => a.id), enlaceApp: siteUrl + '/app', enlaceBaja: siteUrl + '/api/pyme/avisos-baja?t=' + firmaBaja(c.cuentaId), razonSocial: est.empresa.razonSocial });
                await enviar({ to: c.email, asunto: correo.asunto, html: correo.html, texto: correo.texto, clave: 'pyme-avisos-' + c.cuentaId + '-' + hoy });
                const enviados = {};
                Object.keys(previos).forEach(k => { if (diasEntre(previos[k], hoy) < DIAS_GUARDAR) enviados[k] = previos[k]; });
                lista.forEach(a => { if (nuevos.indexOf(a) >= 0) enviados[a.id] = hoy; });
                await almacen.registrarEnvioAvisos(c.cuentaId, enviados, new Date(reloj()).toISOString());
                r.enviados++;
            } catch (e) {
                r.errores++;
                console.error('pyme avisos:', e && e.name, String((e && e.message) || '').slice(0, 120));
            }
        }
        return r;
    }

    return { correr, firmaBaja, validarBaja, hoyChile: () => hoyChile(reloj()) };
}

module.exports = { crear, hoyChile, DIAS_REPETIR };
