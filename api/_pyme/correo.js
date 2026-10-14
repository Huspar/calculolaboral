/**
 * Textos del Asistente Pyme que salen del servidor: el correo con el enlace de acceso y las paginas intermedias.
 * Son funciones puras (devuelven texto) para poder revisarlas y probarlas sin enviar nada.
 */
const { escapeHtml } = require('./http');

const MARCA = '#00382E';

function correoAcceso({ enlace, minutos }) {
    const asunto = 'Tu enlace para entrar a Cálculo Laboral';
    const texto = [
        'Pediste entrar al Asistente Laboral Pyme.',
        '',
        `Este enlace sirve una sola vez y vence en ${minutos} minutos:`,
        enlace,
        '',
        'Si no fuiste tú, ignora este correo: no se hace ningún cambio en tu cuenta.',
        '¿Dudas? Responde este correo.'
    ].join('\n');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:${MARCA}">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Pediste entrar al <strong>Asistente Laboral Pyme</strong>. Este enlace sirve una sola vez y vence en ${minutos} minutos.</p>
  <p style="margin:0 0 20px"><a href="${escapeHtml(enlace)}" style="display:inline-block;background:${MARCA};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Entrar al asistente</a></p>
  <p style="margin:0 0 16px;font-size:12px;color:#475569">Si el botón no funciona, copia esta dirección en tu navegador:<br><span style="word-break:break-all">${escapeHtml(enlace)}</span></p>
  <p style="margin:0 0 16px;font-size:12px;color:#475569">Si no fuiste tú, ignora este correo: no se hace ningún cambio en tu cuenta.</p>
  <p style="margin:0;font-size:13px;color:#64748b">¿Dudas? Responde este correo.</p>
</div></body></html>`;
    return { asunto, texto, html };
}

/** Correo con los avisos del mes. "avisos": [{ id, nivel, titulo, texto }]; "nuevos": ids que motivan el envío. */
function correoAvisos({ avisos, nuevos, enlaceApp, enlaceBaja, razonSocial }) {
    const urgentes = avisos.filter(a => a.nivel === 'urgente').length;
    const asunto = urgentes ? `Tienes ${urgentes === 1 ? 'un aviso urgente' : urgentes + ' avisos urgentes'} en el Asistente Laboral Pyme` : 'Avisos de este mes en el Asistente Laboral Pyme';
    const texto = [
        `Avisos de ${razonSocial || 'tu empresa'} en el Asistente Laboral Pyme:`,
        '',
        ...avisos.map(a => `${a.nivel === 'urgente' ? '[Urgente] ' : ''}${a.titulo}. ${a.texto}`),
        '',
        `Revísalos en el asistente: ${enlaceApp}`,
        '',
        'Estos avisos son una ayuda y no reemplazan revisar los plazos en la fuente (Dirección del Trabajo, Previred, SII).',
        `Para dejar de recibirlos: ${enlaceBaja}`
    ].join('\n');
    const filas = avisos.map(a => `<li style="margin:0 0 12px"><strong style="color:${a.nivel === 'urgente' ? '#BE123C' : '#0f172a'}">${a.nivel === 'urgente' ? 'Urgente · ' : ''}${escapeHtml(a.titulo)}</strong>${nuevos.indexOf(a.id) >= 0 ? '' : ' <span style="color:#64748b;font-size:12px">(ya te lo avisamos)</span>'}<br><span style="font-size:13px;color:#334155">${escapeHtml(a.texto)}</span></li>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
  <p style="margin:0 0 16px;font-size:20px;font-weight:700;letter-spacing:-.01em">Cálculo<span style="color:${MARCA}">Laboral</span></p>
  <p style="margin:0 0 16px;font-size:14px;color:#334155">Avisos de <strong>${escapeHtml(razonSocial || 'tu empresa')}</strong> en el Asistente Laboral Pyme:</p>
  <ul style="margin:0 0 20px;padding-left:18px">${filas}</ul>
  <p style="margin:0 0 20px"><a href="${escapeHtml(enlaceApp)}" style="display:inline-block;background:${MARCA};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px">Abrir el asistente</a></p>
  <p style="margin:0 0 12px;font-size:12px;color:#475569">Estos avisos son una ayuda y no reemplazan revisar los plazos en la fuente (Dirección del Trabajo, Previred, SII).</p>
  <p style="margin:0;font-size:12px;color:#64748b">Recibes este correo porque activaste los avisos en tu cuenta. <a href="${escapeHtml(enlaceBaja)}" style="color:${MARCA}">Dejar de recibirlos</a>.</p>
</div></body></html>`;
    return { asunto, texto, html };
}

const ESTILO = `<style>
body{margin:0;padding:24px;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55}
.t{max-width:480px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px}
h1{margin:0 0 12px;font-size:20px}p{margin:0 0 14px;font-size:14px;color:#334155}
.m{font-weight:700;color:#0f172a}.e{color:#b91c1c;font-size:13px}
button{background:${MARCA};color:#ffffff !important;border:0;border-radius:12px;font-weight:700;font-size:14px;padding:12px 20px;cursor:pointer}
label{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#334155;margin:0 0 16px}a{color:${MARCA}}
</style>`;

function pagina(titulo, cuerpo) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="origin"><title>${escapeHtml(titulo)} · Cálculo Laboral</title>${ESTILO}</head>
<body><div class="t">${cuerpo}</div></body></html>`;
}

/** Pagina que abre el enlace del correo: pide confirmar (y aceptar la clausula la primera vez). */
function paginaConfirmar({ token, correoEnmascarado, requiereAceptar, error }) {
    const aceptar = requiereAceptar
        ? `<label><input type="checkbox" name="acepto" value="1" required> <span>Acepto los <a href="/terminos#asistente-pyme">Términos</a> y la cláusula de encargo de tratamiento de datos, y declaro haber leído la <a href="/privacidad#asistente-pyme">Política de Privacidad</a>.</span></label>`
        : '';
    return pagina('Entrar al asistente', `<h1>Entrar al Asistente Laboral Pyme</h1>
<p>Vas a entrar con la cuenta <span class="m">${escapeHtml(correoEnmascarado)}</span>. Si no pediste entrar, cierra esta página.</p>
${error ? `<p class="e">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/api/pyme/verificar">
<input type="hidden" name="t" value="${escapeHtml(token)}">
${aceptar}
<button type="submit">Entrar</button>
</form>`);
}

function paginaMensaje(titulo, texto) {
    return pagina(titulo, `<h1>${escapeHtml(titulo)}</h1><p>${escapeHtml(texto)}</p><p><a href="/app">Volver al asistente</a></p>`);
}

/** Página del enlace de baja: pide confirmar con un botón (un revisor automático de enlaces no la apaga solo). */
function paginaBajaAvisos({ token }) {
    return pagina('Dejar de recibir avisos', `<h1>Dejar de recibir los avisos por correo</h1>
<p>Ya no te enviaremos los avisos del Asistente Laboral Pyme. Tus datos y tu cuenta no cambian, y puedes volver a activarlos en «Mi cuenta».</p>
<form method="post" action="/api/pyme/avisos-baja">
<input type="hidden" name="t" value="${escapeHtml(token)}">
<button type="submit">Dejar de recibirlos</button>
</form>`);
}

module.exports = { correoAcceso, correoAvisos, paginaConfirmar, paginaMensaje, paginaBajaAvisos };
