/*
 * CalculoLaboral · Modulo operacional Ley 21.719 (Proteccion de Datos Personales) en /app/datos-personales.
 * Controla checklist de cumplimiento, cruce de anexos con nomina, encargados DPA (Art. 15 bis),
 * bandeja ARCOP (30 dias corridos, Art. 11), bitacora de incidentes (72h, Art. 14 sexies) e inventario RAT (Art. 14 ter).
 */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var DEF = { correoPrivacidad: '', responsableDatos: '', checklist: { protocoloBrechas: false, ratRevisado: false }, encargados: [], solicitudesArcop: [], brechas: [], rat: [] };
    var TAB_VALIDOS = ['resumen', 'trabajadores', 'encargados', 'arcop', 'brechas'];
    var DERECHOS = { acceso: 'Acceso (Art. 5)', rectificacion: 'Rectificación (Art. 6)', cancelacion: 'Cancelación / Supresión (Art. 7)', oposicion: 'Oposición (Art. 8)', portabilidad: 'Portabilidad (Art. 9)' };
    var CALIDADES = { trabajador: 'Trabajador activo', ex_trabajador: 'Ex-trabajador', cliente: 'Cliente', contacto: 'Contacto comercial' };
    var ORIGENES = { equipo: 'Equipo perdido o robado', malware: 'Malware / ransomware', correo: 'Envío de correo erróneo', acceso: 'Acceso no autorizado', otro: 'Otro incidente' };
    var EST_BRECHA = { abierta: 'Abierta (en ventana 72h)', notificada: 'Notificada a la Agencia', cerrada_sin_riesgo: 'Cerrada sin riesgo relevante' };

    var RAT_BASE = [
        { actividad: 'Gestión de personal y remuneraciones', baseLegal: 'Ejecución de contrato / Código del Trabajo', datosTratados: 'RUT, domicilio, sueldo, AFP, salud y licencias médicas', plazoConservacion: '5 años tras término de la relación laboral' },
        { actividad: 'Facturación y clientes', baseLegal: 'Obligación tributaria (SII) y contrato mercantil', datosTratados: 'Razón social, RUT, dirección y correo de contacto', plazoConservacion: '6 años tributarios (Código Tributario)' },
        { actividad: 'Control de acceso / CCTV (si aplica)', baseLegal: 'Interés legítimo de seguridad y resguardo', datosTratados: 'Registros audiovisuales o acceso al local', plazoConservacion: '30 días corridos de ciclo de respaldo' }
    ];

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function aMs(iso) { var a = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); }
    function sumarDias(iso, n) { var d = new Date(aMs(iso) + n * 86400000); return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function diasEntre(desde, hasta) { return Math.round((aMs(hasta) - aMs(desde)) / 86400000); }
    function plural(n, u, v) { return n + ' ' + (n === 1 ? u : v); }
    function clonar(x) { return JSON.parse(JSON.stringify(x || DEF)); }

    function normDatos(d) {
        var x = clonar(Object.assign({}, DEF, d || {}));
        x.checklist = Object.assign({ protocoloBrechas: false, ratRevisado: false }, x.checklist || {});
        if (!Array.isArray(x.encargados)) x.encargados = [];
        if (!Array.isArray(x.solicitudesArcop)) x.solicitudesArcop = [];
        if (!Array.isArray(x.brechas)) x.brechas = [];
        if (!Array.isArray(x.rat)) x.rat = [];
        return x;
    }

    function montarUI(ctx) {
        var esc = ctx.esc;
        var tabActual = 'resumen';
        var guardando = false;

        function dActual() {
            var e = ctx.getEstado();
            return normDatos(e && e.datosLey21719);
        }

        function fecha(iso) { return iso ? ctx.fechaCortaAnio(iso) : '—'; }

        function arcopInfo(s, hoy) {
            var vence = sumarDias(s.fechaRecepcion, s.prorroga ? 60 : 30);
            var restan = diasEntre(hoy, vence);
            var cls = restan <= 7 ? 'urgente' : restan <= 14 ? 'aviso' : 'ok';
            var txt = restan < 0 ? 'Vencida (' + plural(-restan, 'día', 'días') + ')' : restan === 0 ? 'Vence hoy' : plural(restan, 'día restante', 'días restantes');
            return { vence: vence, restan: restan, cls: cls, txt: txt };
        }

        function resumenControles(est, d, hoy) {
            var activos = ((est && est.trabajadores) || []).filter(function (t) { return t.activo; });
            var conAnexo = activos.filter(function (t) { return !!t.anexoDatosEntrega; }).length;
            var dpaFirmados = d.encargados.filter(function (p) { return !!p.dpaFirmado; }).length;
            var arcopAbiertas = d.solicitudesArcop.filter(function (s) { return s.estado === 'pendiente'; });
            var arcopUrgentes = arcopAbiertas.filter(function (s) { return arcopInfo(s, hoy).restan <= 7; }).length;
            var brechasAbiertas = d.brechas.filter(function (b) { return b.estado === 'abierta'; }).length;

            var c1 = activos.length > 0 && conAnexo === activos.length;
            var c2 = d.encargados.length > 0 && dpaFirmados === d.encargados.length;
            var c3 = !!(d.correoPrivacidad && d.correoPrivacidad.indexOf('@') > 0);
            var c4 = !!d.checklist.protocoloBrechas;
            var c5 = !!d.checklist.ratRevisado && d.rat.length > 0;
            var hechos = [c1, c2, c3, c4, c5].filter(Boolean).length;

            return {
                activos: activos, conAnexo: conAnexo, dpaFirmados: dpaFirmados,
                arcopAbiertas: arcopAbiertas.length, arcopUrgentes: arcopUrgentes,
                brechasAbiertas: brechasAbiertas, hechos: hechos,
                pct: Math.round((hechos / 5) * 100),
                checks: [c1, c2, c3, c4, c5]
            };
        }

        function actualizarInsignia() {
            var chip = $('nav-chip-datos-personales');
            var est = ctx.getEstado();
            if (!chip || !est || !est.empresa) { if (chip) chip.hidden = true; return; }
            var r = resumenControles(est, dActual(), ctx.hoyIso());
            var alertas = r.arcopUrgentes + r.brechasAbiertas;
            if (alertas > 0) {
                chip.textContent = String(alertas);
                chip.className = 'app-nav-chip cerrado';
                chip.hidden = false;
            } else {
                chip.hidden = true;
            }
        }

        function guardarDatos(nuevo, textoOk, luego) {
            if (guardando) return;
            guardando = true;
            var msgEl = $('dp-estado-msg');
            if (msgEl) msgEl.textContent = 'Guardando…';
            ctx.api('datos-personales', { metodo: 'PUT', cuerpo: { datosLey21719: nuevo } }).then(function (r) {
                guardando = false;
                if (!r.ok) {
                    if (msgEl) { msgEl.className = 'lq-estado error'; msgEl.textContent = (r.datos && r.datos.error) || 'No pudimos guardar los cambios.'; }
                    return;
                }
                ctx.setDatosLey(r.datos.datosLey21719);
                if (msgEl) { msgEl.className = 'lq-estado ok'; msgEl.textContent = textoOk || 'Cambios guardados.'; }
                actualizarInsignia();
                dibujar(tabActual);
                if (typeof ctx.alCambiar === 'function') ctx.alCambiar();
                if (luego) luego();
            });
        }

        function descargarWord(titulo, cuerpoHtml, nombreArchivo) {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {};
            var d = dActual();
            var estilo = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111827;line-height:1.45;margin:28px;}h1{font-size:14pt;color:#00382E;margin:0 0 6px;}h2{font-size:11.5pt;color:#00382E;margin:14px 0 4px;}p,li{margin:4px 0 8px;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-size:10pt;}th{background:#f3f6f4;} .meta{color:#4b5563;font-size:9.5pt;margin-bottom:14px;}';
            var encabezado = '<h1>' + esc(titulo) + '</h1><p class="meta"><strong>' + esc(emp.razonSocial || 'Mi Empresa') + '</strong> · RUT ' + esc(emp.rut || '—') + (d.correoPrivacidad ? ' · Canal privacidad: ' + esc(d.correoPrivacidad) : '') + ' · Fecha: ' + esc(ctx.hoyIso()) + '</p>';
            var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>' + estilo + '</style></head><body>' + encabezado + cuerpoHtml + '<p class="meta" style="margin-top:18px">Documento de referencia operacional Ley N° 21.719 generado desde el Asistente Laboral Pyme. No reemplaza la revisión legal individual.</p></body></html>';
            var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = nombreArchivo.replace(/[^a-zA-Z0-9._-]+/g, '-') + '.doc';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        }

        function modeloDpaWord(prov) {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {};
            var cuerpo = '<p><strong>CLÁUSULA DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (ART. 15 BIS LEY N° 21.719)</strong></p>' +
                '<p>Entre <strong>' + esc(emp.razonSocial || 'Responsable') + '</strong> (RUT ' + esc(emp.rut || '—') + '), en adelante el <strong>Responsable del tratamiento</strong>, y <strong>' + esc(prov.nombre) + '</strong> (' + esc(prov.servicio || 'Proveedor de servicios') + '), en adelante el <strong>Encargado o Mandatario del tratamiento</strong>, se deja constancia de las siguientes obligaciones aplicables a los datos personales tratados por cuenta del Responsable:</p>' +
                '<ol>' +
                '<li><strong>Finalidad e instrucciones:</strong> El Encargado tratará los datos («' + esc(prov.datosTratados || 'datos laborales, previsionales o de clientes') + '») exclusivamente para prestar el servicio contratado y siguiendo las instrucciones documentadas del Responsable, sin utilizarlos para fines propios ni comercialización.</li>' +
                '<li><strong>Confidencialidad:</strong> El Encargado garantiza que su personal y colaboradores autorizados mantienen compromiso expreso de reserva y secreto profesional.</li>' +
                '<li><strong>Seguridad:</strong> Implementará medidas técnicas y organizativas proporcionales para resguardar la confidencialidad, integridad y disponibilidad de los datos.</li>' +
                '<li><strong>Subcontratación:</strong> No podrá delegar ni subcontratar el tratamiento en terceros sin autorización escrita del Responsable, imponiendo al subencargado las mismas obligaciones.</li>' +
                '<li><strong>Brechas y derechos ARCOP:</strong> Notificará sin dilación indebida al Responsable cualquier incidente de seguridad que afecte datos personales y colaborará en la atención de solicitudes ARCOP dentro del plazo legal de 30 días corridos.</li>' +
                '<li><strong>Devolución o destrucción:</strong> Concluido el servicio, devolverá o eliminará de forma segura los datos personales, salvo obligación legal de conservación.</li>' +
                '</ol>' +
                '<p style="margin-top:26px">______________________________ &nbsp;&nbsp;&nbsp;&nbsp; ______________________________<br>Responsable del tratamiento &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Encargado (' + esc(prov.nombre) + ')</p>';
            descargarWord('Cláusula DPA Art. 15 bis · ' + prov.nombre, cuerpo, 'DPA-Art15bis-' + prov.nombre);
        }

        function modeloRespuestaArcopWord(sol) {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {};
            var cuerpo = '<p><strong>RESPUESTA FORMAL A SOLICITUD DE DERECHOS ARCOP (LEY N° 21.719, ART. 11)</strong></p>' +
                '<p><strong>Titular solicitante:</strong> ' + esc(sol.nombre) + (sol.rut ? ' (RUT ' + esc(sol.rut) + ')' : '') + '<br>' +
                '<strong>Derecho ejercido:</strong> ' + esc(DERECHOS[sol.derecho] || sol.derecho) + '<br>' +
                '<strong>Fecha de recepción:</strong> ' + esc(sol.fechaRecepcion) + '</p>' +
                '<p>Estimado/a ' + esc(sol.nombre) + ':</p>' +
                '<p>En respuesta a su solicitud de <strong>' + esc(DERECHOS[sol.derecho] || sol.derecho) + '</strong> ingresada el ' + esc(sol.fechaRecepcion) + ' ante <strong>' + esc(emp.razonSocial || 'nuestra empresa') + '</strong>, informamos dentro del plazo legal de 30 días corridos lo siguiente:</p>' +
                '<p><em>[Seleccionar y completar según corresponda: Aceptación total / Aceptación parcial / Denegación fundada en obligación legal o contractual vigente. Indicar en su caso el detalle de los datos entregados, corregidos o bloqueados.]</em></p>' +
                '<p>Si tiene consultas adicionales o no está conforme con la respuesta, puede escribir a nuestro canal de privacidad (' + esc(dActual().correoPrivacidad || 'correo de privacidad de la empresa') + ') o recurrir ante la Agencia de Protección de Datos Personales.</p>' +
                '<p style="margin-top:24px">Atentamente,<br><strong>' + esc(emp.representante || emp.razonSocial || 'Responsable') + '</strong><br>' + esc(emp.razonSocial || '') + '</p>';
            descargarWord('Respuesta Solicitud ARCOP · ' + sol.nombre, cuerpo, 'Respuesta-ARCOP-' + sol.nombre);
        }

        function modeloRatWord(rat) {
            var cuerpo = '<p><strong>REGISTRO SIMPLIFICADO DE ACTIVIDADES DE TRATAMIENTO (RAT · ART. 14 TER LEY N° 21.719)</strong></p>' +
                '<table><thead><tr><th>Actividad</th><th>Base de licitud</th><th>Categorías de datos</th><th>Plazo de conservación</th></tr></thead><tbody>' +
                (rat.length ? rat.map(function (x) {
                    return '<tr><td>' + esc(x.actividad) + '</td><td>' + esc(x.baseLegal) + '</td><td>' + esc(x.datosTratados) + '</td><td>' + esc(x.plazoConservacion) + '</td></tr>';
                }).join('') : '<tr><td colspan="4">Sin actividades registradas.</td></tr>') +
                '</tbody></table>';
            descargarWord('Inventario RAT Ley 21.719', cuerpo, 'RAT-Ley-21719');
        }

        function pintarResumen(est, d, res) {
            var segs = [0, 1, 2, 3, 4].map(function (i) {
                return '<span class="dp-seg' + (res.checks[i] ? ' hecho' : '') + '"></span>';
            }).join('');
            var estadoBadge = res.hechos === 5
                ? '<span class="sello sello-emitida">Controles mínimos al día</span>'
                : res.hechos >= 3
                    ? '<span class="sello sello-preparada">En implementación</span>'
                    : '<span class="sello sello-sin">Por iniciar</span>';

            var items = [
                { ok: res.checks[0], warn: !res.checks[0] && res.activos.length > 0, tit: 'Anexo laboral de protección de datos', desc: res.activos.length ? ('Llevas ' + res.conAnexo + ' de ' + plural(res.activos.length, 'trabajador activo', 'trabajadores activos') + ' con entrega anotada.') : 'Agrega trabajadores para emitir el anexo Ley 21.719.', btn: 'Anexos trabajadores', tab: 'trabajadores' },
                { ok: res.checks[1], warn: d.encargados.length > 0 && !res.checks[1], tit: 'Contratos o cláusulas DPA con proveedores (Art. 15 bis)', desc: d.encargados.length ? ('Llevas ' + res.dpaFirmados + ' de ' + plural(d.encargados.length, 'encargado', 'encargados') + ' con DPA firmado.') : 'Registra a tu contador, software de nómina o nube con acceso a datos.', btn: 'Revisar proveedores', tab: 'encargados' },
                { ok: res.checks[2], warn: !res.checks[2], tit: 'Canal formal de recepción ARCOP (Arts. 4 a 11)', desc: res.checks[2] ? ('Correo configurado: ' + d.correoPrivacidad + '.') : 'Define el correo al que titulares y trabajadores envían solicitudes.', btn: 'Bandeja ARCOP', tab: 'arcop' },
                { ok: res.checks[3], warn: res.brechasAbiertas > 0, tit: 'Protocolo de notificación de brechas (72 horas, Art. 14 sexies)', desc: res.brechasAbiertas > 0 ? ('Hay ' + plural(res.brechasAbiertas, 'incidente abierto', 'incidentes abiertos') + ' por revisar.') : (res.checks[3] ? 'Protocolo interno definido y revisado.' : 'Marca el control abajo una vez acordado quién reporta en caso de filtración.'), btn: 'Ver bitácora 72h', tab: 'brechas' },
                { ok: res.checks[4], warn: false, tit: 'Inventario básico de tratamientos (RAT interno, Art. 14 ter)', desc: d.rat.length ? (plural(d.rat.length, 'actividad documentada', 'actividades documentadas') + ' (personal, facturación, accesos).') : 'Carga las 3 actividades habituales de tu pyme.', btn: 'Revisar RAT', tab: 'brechas' }
            ];

            return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h2>Avance de cumplimiento Ley 21.719</h2><p class="texto-ayuda">Vigencia en Chile desde el 1 de diciembre de 2026. Controles recomendados de referencia (no reemplaza asesoría legal individual).</p></div>' + estadoBadge + '</div>' +
                '<div class="panel-cuerpo">' +
                '<div class="dp-progreso-head"><span>' + res.hechos + ' de 5 controles básicos completados</span><strong class="mono">' + res.pct + '%</strong></div>' +
                '<div class="dp-progreso" aria-hidden="true">' + segs + '</div>' +
                '<div class="dp-checklist">' + items.map(function (it) {
                    var ico = it.ok ? 'check_circle' : it.warn ? 'schedule' : 'radio_button_unchecked';
                    var cls = it.ok ? 'ok' : it.warn ? 'aviso' : 'neutro';
                    return '<div class="dp-check-item"><span class="material-icons dp-check-icon ' + cls + '" aria-hidden="true">' + ico + '</span><div class="dp-check-info"><strong>' + esc(it.tit) + '</strong><p>' + esc(it.desc) + '</p></div><div class="dp-check-accion"><button type="button" class="btn btn-chico" data-dp-ir="' + it.tab + '">' + esc(it.btn) + '</button></div></div>';
                }).join('') + '</div></div></div>' +
                '<div class="panel"><div class="panel-head"><div><h2>Configuración del canal de privacidad</h2><p class="texto-ayuda">Estos datos aparecen en el modelo de respuesta ARCOP y en el deber de información.</p></div></div>' +
                '<form class="panel-cuerpo" id="dp-form-config">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-cfg-correo">Correo de privacidad (solicitudes ARCOP)</label><input id="dp-cfg-correo" type="email" maxlength="120" value="' + esc(d.correoPrivacidad) + '" placeholder="privacidad@tuempresa.cl"></div>' +
                '<div class="lq-field"><label for="dp-cfg-resp">Responsable interno en la empresa <span class="lq-opt">(opcional)</span></label><input id="dp-cfg-resp" type="text" maxlength="80" value="' + esc(d.responsableDatos) + '" placeholder="Nombre del encargado o representante"></div>' +
                '<div class="lq-field pm-check lq-span2"><label><input id="dp-cfg-brechas" type="checkbox"' + (d.checklist.protocoloBrechas ? ' checked' : '') + '> Tenemos definido a quién avisar internamente ante una pérdida o filtración de datos (ventana 72h)</label></div>' +
                '<div class="lq-field pm-check lq-span2"><label><input id="dp-cfg-rat" type="checkbox"' + (d.checklist.ratRevisado ? ' checked' : '') + '> Revisamos el inventario simplificado de tratamientos (RAT) en la última pestaña</label></div>' +
                '</div>' +
                '<div class="form-acciones"><button type="submit" class="btn btn-primario">Guardar configuración</button></div>' +
                '</form></div>';
        }

        function pintarTrabajadores(est) {
            var activos = ((est && est.trabajadores) || []).filter(function (t) { return t.activo; });
            if (!activos.length) {
                return '<div class="panel"><div class="panel-cuerpo"><p class="vacio">Aún no hay trabajadores activos. Agrégalos desde Trabajadores para gestionar su anexo Ley 21.719.</p></div></div>';
            }
            var filas = activos.map(function (t) {
                var sello = t.anexoDatosEntrega
                    ? (t.anexoDatosConstancia ? '<span class="sello sello-emitida">Firmado</span>' : '<span class="sello sello-preparada">Entregado sin firma</span>')
                    : '<span class="sello sello-sin">Pendiente</span>';
                var q = 't=' + encodeURIComponent(t.id) + '&d=anexo_datos';
                return '<tr><td><strong>' + esc(t.nombre) + '</strong><br><span class="mono" style="font-size:12px;color:var(--muted)">' + esc(t.rut) + '</span></td>' +
                    '<td class="ocultar-movil">' + esc(t.cargo || '—') + '</td>' +
                    '<td>' + sello + '</td>' +
                    '<td class="mono">' + fecha(t.anexoDatosEntrega) + '</td>' +
                    '<td class="celda-acciones"><div class="acciones-pila">' +
                    '<a class="btn btn-chico" href="/app/documentos?' + esc(q) + '" data-ruta="documentos" data-query="' + esc(q) + '">Generar anexo</a>' +
                    (t.anexoDatosConstancia ? '' : '<button type="button" class="btn-texto" data-dp-anexo="' + esc(t.id) + '">Marcar firmado hoy</button>') +
                    '</div></td></tr>';
            }).join('');
            return '<div class="panel"><div class="panel-head"><div><h2>Anexo Ley 21.719 por trabajador</h2><p class="texto-ayuda">Usa el generador del asistente para emitir el anexo prellenado con la ficha y marca aquí cuando lo firme.</p></div></div>' +
                '<div class="tabla-wrap"><table class="tabla"><caption class="sr-only">Estado de anexo Ley 21.719 por trabajador activo</caption>' +
                '<thead><tr><th>Trabajador</th><th class="ocultar-movil">Cargo</th><th>Estado</th><th>Fecha</th><th><span class="sr-only">Acciones</span></th></tr></thead>' +
                '<tbody>' + filas + '</tbody></table></div></div>';
        }

        function pintarEncargados(d) {
            var rows = d.encargados.length ? d.encargados.map(function (p) {
                var sello = p.dpaFirmado ? '<span class="sello sello-emitida">DPA firmado</span>' : '<span class="sello sello-preparada">Pendiente DPA</span>';
                var acc = '<button type="button" class="btn btn-chico" data-dp-dpa-word="' + esc(p.id) + '">Modelo DPA</button>' +
                    (!p.dpaFirmado ? ' <button type="button" class="btn-texto" data-dp-dpa-ok="' + esc(p.id) + '">Marcar firmado</button>' : '') +
                    ' <button type="button" class="btn-texto lq-danger" data-dp-dpa-del="' + esc(p.id) + '">Quitar</button>';
                return { html: '<tr><td><strong>' + esc(p.nombre) + '</strong><br><span style="font-size:12px;color:var(--muted)">' + esc(p.servicio || '') + '</span></td><td class="ocultar-movil">' + esc(p.datosTratados || '—') + '</td><td>' + sello + '</td><td class="mono">' + fecha(p.fechaFirma) + '</td><td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>', card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(p.nombre) + '</strong>' + sello + '</div><p class="texto-ayuda" style="margin:4px 0">' + esc(p.servicio || '') + (p.datosTratados ? ' · ' + esc(p.datosTratados) : '') + '</p><div class="acciones-pila" style="margin-top:8px">' + acc + '</div></div>' };
            }) : [];
            return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h2>Proveedores y encargados del tratamiento (Art. 15 bis)</h2><p class="texto-ayuda">Todo externo que procese datos por cuenta de tu empresa requiere cláusula o contrato DPA.</p></div><div class="v-acciones"><button type="button" class="btn btn-chico" id="dp-btn-sugerir-dpa">Sugerir habituales</button><button type="button" class="btn btn-chico btn-primario" id="dp-btn-abrir-dpa">Agregar encargado</button></div></div>' +
                '<form class="panel-cuerpo" id="dp-form-dpa" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-dpa-nom">Nombre o razón social</label><input id="dp-dpa-nom" type="text" maxlength="80" required placeholder="Ej. Estudio Contable o Software"></div>' +
                '<div class="lq-field"><label for="dp-dpa-serv">Servicio prestado</label><input id="dp-dpa-serv" type="text" maxlength="80" placeholder="Contabilidad, remuneraciones, correo"></div>' +
                '<div class="lq-field lq-span2"><label for="dp-dpa-datos">Datos tratados</label><input id="dp-dpa-datos" type="text" maxlength="120" placeholder="Liquidaciones, RUT, licencias médicas, clientes"></div>' +
                '<div class="lq-field"><label for="dp-dpa-fecha">Fecha firma DPA <span class="lq-opt">(opcional)</span></label><input id="dp-dpa-fecha" type="date"></div>' +
                '<div class="lq-field pm-check"><label><input id="dp-dpa-firmado" type="checkbox"> Cláusula DPA firmada</label></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-dpa-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Guardar encargado</button></div></form>' +
                (rows.length ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><thead><tr><th>Encargado</th><th class="ocultar-movil">Datos tratados</th><th>Estado</th><th>Firma</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + rows.map(function (r) { return r.html; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + rows.map(function (r) { return r.card; }).join('') + '</div>' : '<div class="panel-cuerpo"><p class="vacio">Aún no registras proveedores encargados. Usa «Sugerir habituales» o agrega uno.</p></div>') +
                '</div>';
        }

        function pintarArcop(d, hoy) {
            var ordenadas = d.solicitudesArcop.slice().sort(function (a, b) {
                if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
                if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
                return a.fechaRecepcion < b.fechaRecepcion ? -1 : 1;
            });
            var body = ordenadas.length ? ordenadas.map(function (s) {
                var info = arcopInfo(s, hoy);
                var badge = s.estado === 'pendiente'
                    ? '<span class="arcop-dias-badge ' + info.cls + '">' + esc(info.txt) + '</span>'
                    : '<span class="sello sello-emitida">' + (s.estado === 'denegada' ? 'Denegada fundada' : 'Respondida') + (s.fechaRespuesta ? ' · ' + fecha(s.fechaRespuesta) : '') + '</span>';
                var acc = '<button type="button" class="btn btn-chico" data-dp-arcop-word="' + esc(s.id) + '">Modelo respuesta</button>';
                if (s.estado === 'pendiente') {
                    if (!s.prorroga) acc += ' <button type="button" class="btn-texto" data-dp-arcop-prorroga="' + esc(s.id) + '">+30d prórroga</button>';
                    acc += ' <button type="button" class="btn-texto" data-dp-arcop-ok="' + esc(s.id) + '">Marcar respondida</button>';
                }
                acc += ' <button type="button" class="btn-texto lq-danger" data-dp-arcop-del="' + esc(s.id) + '">Quitar</button>';
                var row = '<tr><td><strong>' + esc(s.nombre) + '</strong><br><span style="font-size:12px;color:var(--muted)">' + esc(CALIDADES[s.calidad] || s.calidad) + (s.rut ? ' · ' + esc(s.rut) : '') + '</span></td>' +
                    '<td>' + esc(DERECHOS[s.derecho] || s.derecho) + '</td>' +
                    '<td class="mono">' + fecha(s.fechaRecepcion) + '<br><span style="font-size:11.5px;color:var(--muted)">Vence: ' + fecha(info.vence) + '</span></td>' +
                    '<td>' + badge + '</td>' +
                    '<td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>';
                var card = '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(s.nombre) + '</strong>' + badge + '</div><p class="texto-ayuda" style="margin:4px 0">' + esc(DERECHOS[s.derecho] || s.derecho) + ' · Vence ' + fecha(info.vence) + '</p><div class="acciones-pila" style="margin-top:8px">' + acc + '</div></div>';
                return { row: row, card: card };
            }) : [];

            return '<div class="panel"><div class="panel-head"><div><h2>Bandeja ARCOP (plazo legal 30 días corridos, Art. 11)</h2><p class="texto-ayuda">Toda solicitud de acceso, rectificación, supresión, oposición o portabilidad debe responderse en 30 días corridos (prorrogable una vez por 30 días en casos complejos).</p></div><button type="button" class="btn btn-chico btn-primario" id="dp-btn-abrir-arcop">Registrar solicitud</button></div>' +
                '<form class="panel-cuerpo" id="dp-form-arcop" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-arc-nom">Titular solicitante</label><input id="dp-arc-nom" type="text" maxlength="80" required placeholder="Nombre completo"></div>' +
                '<div class="lq-field"><label for="dp-arc-rut">RUT <span class="lq-opt">(opcional)</span></label><input id="dp-arc-rut" type="text" maxlength="14" placeholder="12.345.678-5"></div>' +
                '<div class="lq-field"><label for="dp-arc-correo">Correo de respuesta <span class="lq-opt">(opcional)</span></label><input id="dp-arc-correo" type="email" maxlength="120" placeholder="titular@correo.cl"></div>' +
                '<div class="lq-field"><label for="dp-arc-cal">Calidad</label><select id="dp-arc-cal"><option value="trabajador">Trabajador activo</option><option value="ex_trabajador">Ex-trabajador</option><option value="cliente">Cliente</option><option value="contacto">Contacto comercial</option></select></div>' +
                '<div class="lq-field"><label for="dp-arc-der">Derecho ejercido</label><select id="dp-arc-der"><option value="acceso">Acceso (Art. 5)</option><option value="rectificacion">Rectificación (Art. 6)</option><option value="cancelacion">Cancelación / Supresión (Art. 7)</option><option value="oposicion">Oposición (Art. 8)</option><option value="portabilidad">Portabilidad (Art. 9)</option></select></div>' +
                '<div class="lq-field"><label for="dp-arc-fecha">Fecha de recepción</label><input id="dp-arc-fecha" type="date" required value="' + esc(hoy) + '"></div>' +
                '<div class="lq-field lq-span2"><label for="dp-arc-notas">Resumen o respaldo <span class="lq-opt">(opcional)</span></label><input id="dp-arc-notas" type="text" maxlength="200" placeholder="Detalle breve de lo solicitado"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-arcop-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Guardar solicitud</button></div></form>' +
                (body.length ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><thead><tr><th>Titular</th><th>Derecho</th><th>Recepción / Vencimiento</th><th>Plazo</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + body.map(function (b) { return b.row; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + body.map(function (b) { return b.card; }).join('') + '</div>' : '<div class="panel-cuerpo"><p class="vacio">No hay solicitudes ARCOP registradas. Cuando recibas una por correo o carta, regístrala aquí para controlar el plazo de 30 días.</p></div>') +
                '</div>';
        }

        function pintarBrechasYRat(d, hoy) {
            var brechasHtml = d.brechas.length ? d.brechas.map(function (b) {
                var sello = b.estado === 'abierta'
                    ? '<span class="sello sello-riesgo">' + esc(EST_BRECHA.abierta) + '</span>'
                    : '<span class="sello sello-emitida">' + esc(EST_BRECHA[b.estado] || b.estado) + '</span>';
                var acc = '';
                if (b.estado === 'abierta') {
                    acc += '<button type="button" class="btn btn-chico" data-dp-br-notif="' + esc(b.id) + '">Marcar notificada</button> ';
                    acc += '<button type="button" class="btn-texto" data-dp-br-cerrar="' + esc(b.id) + '">Sin riesgo relevante</button> ';
                }
                acc += '<button type="button" class="btn-texto lq-danger" data-dp-br-del="' + esc(b.id) + '">Quitar</button>';
                return '<tr><td class="mono">' + esc(b.fechaHora) + '</td><td><strong>' + esc(ORIGENES[b.origen] || b.origen) + '</strong>' + (b.datosComprometidos ? '<br><span style="font-size:12px;color:var(--muted)">' + esc(b.datosComprometidos) + '</span>' : '') + '</td><td>' + sello + '</td><td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>';
            }).join('') : '<tr><td colspan="4" class="vacio">Sin incidentes de seguridad registrados.</td></tr>';

            var ratHtml = d.rat.length ? d.rat.map(function (x) {
                return '<tr><td><strong>' + esc(x.actividad) + '</strong></td><td>' + esc(x.baseLegal || '—') + '</td><td class="ocultar-movil">' + esc(x.datosTratados || '—') + '</td><td>' + esc(x.plazoConservacion || '—') + '</td><td class="celda-acciones"><button type="button" class="btn-texto lq-danger" data-dp-rat-del="' + esc(x.id) + '">Quitar</button></td></tr>';
            }).join('') : '<tr><td colspan="5" class="vacio">Sin actividades registradas en el inventario. Usa «Cargar 3 actividades base».</td></tr>';

            return '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h2>Bitácora de incidentes de seguridad (ventana 72h, Art. 14 sexies)</h2><p class="texto-ayuda">Registra filtraciones, pérdida de equipos con bases de datos o envíos erróneos para documentar medidas y notificación a la Agencia.</p></div><button type="button" class="btn btn-chico" id="dp-btn-abrir-brecha">Registrar incidente</button></div>' +
                '<form class="panel-cuerpo" id="dp-form-brecha" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-br-fecha">Fecha y hora del hallazgo</label><input id="dp-br-fecha" type="text" maxlength="20" required value="' + esc(hoy + ' 09:00') + '"></div>' +
                '<div class="lq-field"><label for="dp-br-orig">Origen</label><select id="dp-br-orig"><option value="equipo">Equipo perdido o robado</option><option value="correo">Envío de correo erróneo</option><option value="acceso">Acceso no autorizado</option><option value="malware">Malware / ransomware</option><option value="otro">Otro incidente</option></select></div>' +
                '<div class="lq-field lq-span2"><label for="dp-br-datos">Datos potencialmente afectados</label><input id="dp-br-datos" type="text" maxlength="160" placeholder="Ej. Nombres y liquidaciones de 3 trabajadores"></div>' +
                '<div class="lq-field lq-span2"><label for="dp-br-med">Medidas inmediatas adoptadas</label><input id="dp-br-med" type="text" maxlength="200" placeholder="Ej. Cambio de contraseñas, revocación de sesión y aviso a afectados"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-br-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Registrar en bitácora</button></div></form>' +
                '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Hallazgo</th><th>Detalle</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + brechasHtml + '</tbody></table></div></div>' +

                '<div class="panel"><div class="panel-head"><div><h2>Registro de Actividades de Tratamiento (RAT simplificado, Art. 14 ter)</h2><p class="texto-ayuda">Inventario interno de qué datos trata la pyme, bajo qué base legal y por cuánto tiempo los guarda.</p></div><div class="v-acciones"><button type="button" class="btn btn-chico" id="dp-btn-rat-base">Cargar 3 actividades base</button><button type="button" class="btn btn-chico" id="dp-btn-rat-word">Descargar RAT (.doc)</button><button type="button" class="btn btn-chico btn-primario" id="dp-btn-abrir-rat">Agregar actividad</button></div></div>' +
                '<form class="panel-cuerpo" id="dp-form-rat" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-rat-act">Actividad o proceso</label><input id="dp-rat-act" type="text" maxlength="80" required placeholder="Ej. Postulaciones y currículums"></div>' +
                '<div class="lq-field"><label for="dp-rat-base">Base de licitud</label><input id="dp-rat-base" type="text" maxlength="80" placeholder="Consentimiento o medidas precontractuales"></div>' +
                '<div class="lq-field"><label for="dp-rat-datos">Datos tratados</label><input id="dp-rat-datos" type="text" maxlength="140" placeholder="Nombre, correo, experiencia laboral"></div>' +
                '<div class="lq-field"><label for="dp-rat-plazo">Plazo de conservación</label><input id="dp-rat-plazo" type="text" maxlength="80" placeholder="6 meses desde cierre del proceso"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-rat-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Agregar al RAT</button></div></form>' +
                '<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Actividad</th><th>Base legal</th><th class="ocultar-movil">Datos tratados</th><th>Conservación</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + ratHtml + '</tbody></table></div></div>';
        }

        function dibujar(tab) {
            var vista = document.querySelector('[data-vista="datos-personales"]');
            if (!vista) return;
            var est = ctx.getEstado();
            if (!est || !est.empresa) {
                $('dp-vacio').hidden = false;
                $('dp-contenido').hidden = true;
                return;
            }
            $('dp-vacio').hidden = true;
            $('dp-contenido').hidden = false;

            if (tab && TAB_VALIDOS.indexOf(tab) >= 0) tabActual = tab;
            var hoy = ctx.hoyIso(), d = dActual(), res = resumenControles(est, d, hoy);

            $('dp-kpi-anexos').textContent = res.conAnexo + ' / ' + res.activos.length;
            $('dp-kpi-anexos-sub').textContent = res.activos.length ? (res.conAnexo < res.activos.length ? plural(res.activos.length - res.conAnexo, 'pendiente de entrega', 'pendientes de entrega') : 'Toda la nómina al día') : 'Sin trabajadores activos';
            $('dp-kpi-anexos-sub').className = res.activos.length && res.conAnexo < res.activos.length ? 'texto-ayuda dp-amber-texto' : 'texto-ayuda';

            $('dp-kpi-dpa').textContent = res.dpaFirmados + ' / ' + d.encargados.length;
            $('dp-kpi-arcop').textContent = String(res.arcopAbiertas);
            $('dp-kpi-arcop-sub').textContent = res.arcopUrgentes ? (plural(res.arcopUrgentes, 'vence pronto (≤7 días)', 'vencen pronto (≤7 días)')) : (res.arcopAbiertas ? 'En plazo legal de 30 días' : 'Sin solicitudes pendientes');
            $('dp-kpi-arcop').parentElement.classList.toggle('vence-pronto', res.arcopUrgentes > 0);

            $('dp-kpi-brechas').textContent = String(res.brechasAbiertas);
            $('dp-kpi-brechas').parentElement.classList.toggle('dp-riesgo', res.brechasAbiertas > 0);

            Array.prototype.forEach.call(vista.querySelectorAll('[data-dp-tab]'), function (b) {
                var activo = b.getAttribute('data-dp-tab') === tabActual;
                b.classList.toggle('activo', activo);
                b.setAttribute('aria-selected', activo ? 'true' : 'false');
            });

            var cont = $('dp-panel-activo');
            if (tabActual === 'resumen') cont.innerHTML = pintarResumen(est, d, res);
            else if (tabActual === 'trabajadores') cont.innerHTML = pintarTrabajadores(est);
            else if (tabActual === 'encargados') cont.innerHTML = pintarEncargados(d);
            else if (tabActual === 'arcop') cont.innerHTML = pintarArcop(d, hoy);
            else cont.innerHTML = pintarBrechasYRat(d, hoy);
        }

        function enlazarEventos() {
            var vista = document.querySelector('[data-vista="datos-personales"]');
            if (!vista || vista.dataset.enlazado) return;
            vista.dataset.enlazado = '1';

            vista.addEventListener('click', function (e) {
                var t = e.target;
                var tabBtn = t.closest('[data-dp-tab]') || t.closest('[data-dp-ir]');
                if (tabBtn) {
                    dibujar(tabBtn.getAttribute('data-dp-tab') || tabBtn.getAttribute('data-dp-ir'));
                    return;
                }
                if (t.closest('#dp-btn-nueva-solicitud')) {
                    dibujar('arcop');
                    var fa = $('dp-form-arcop'); if (fa) { fa.hidden = false; $('dp-arc-nom').focus(); }
                    return;
                }
                if (t.closest('#dp-btn-registrar-brecha')) {
                    dibujar('brechas');
                    var fb = $('dp-form-brecha'); if (fb) { fb.hidden = false; $('dp-br-fecha').focus(); }
                    return;
                }
                if (t.closest('#dp-btn-abrir-dpa')) { $('dp-form-dpa').hidden = false; $('dp-dpa-nom').focus(); return; }
                if (t.closest('#dp-dpa-cancelar')) { $('dp-form-dpa').hidden = true; return; }
                if (t.closest('#dp-btn-abrir-arcop')) { $('dp-form-arcop').hidden = false; $('dp-arc-nom').focus(); return; }
                if (t.closest('#dp-arcop-cancelar')) { $('dp-form-arcop').hidden = true; return; }
                if (t.closest('#dp-btn-abrir-brecha')) { $('dp-form-brecha').hidden = false; $('dp-br-fecha').focus(); return; }
                if (t.closest('#dp-br-cancelar')) { $('dp-form-brecha').hidden = true; return; }
                if (t.closest('#dp-btn-abrir-rat')) { $('dp-form-rat').hidden = false; $('dp-rat-act').focus(); return; }
                if (t.closest('#dp-rat-cancelar')) { $('dp-form-rat').hidden = true; return; }

                if (t.closest('#dp-btn-sugerir-dpa')) {
                    var d = dActual();
                    var exist = d.encargados.map(function (x) { return x.nombre.toLowerCase(); });
                    var sugs = [
                        { nombre: 'Estudio Contable / Contador(a)', servicio: 'Contabilidad y remuneraciones', datosTratados: 'Liquidaciones, RUT, licencias y Previred', dpaFirmado: false, fechaFirma: '', notas: '' },
                        { nombre: 'Software de Remuneraciones (Cálculo Laboral)', servicio: 'Cálculo laboral y gestión', datosTratados: 'Cálculo de sueldos, contratos y finiquitos', dpaFirmado: false, fechaFirma: '', notas: '' },
                        { nombre: 'Servicio de Correo y Nube', servicio: 'Correo corporativo y respaldo', datosTratados: 'Documentos de clientes y trabajadores', dpaFirmado: false, fechaFirma: '', notas: '' }
                    ];
                    var agregados = 0;
                    sugs.forEach(function (s) {
                        if (exist.indexOf(s.nombre.toLowerCase()) < 0) { d.encargados.push(s); agregados++; }
                    });
                    if (!agregados) return;
                    guardarDatos(d, 'Agregamos los proveedores habituales para revisar su DPA.');
                    return;
                }

                if (t.closest('#dp-btn-rat-base')) {
                    var dr = dActual();
                    var ya = dr.rat.map(function (x) { return x.actividad.toLowerCase(); });
                    var sum = 0;
                    RAT_BASE.forEach(function (item) {
                        if (ya.indexOf(item.actividad.toLowerCase()) < 0) { dr.rat.push(Object.assign({}, item)); sum++; }
                    });
                    if (!sum) return;
                    dr.checklist.ratRevisado = true;
                    guardarDatos(dr, 'Cargamos las 3 actividades base en tu registro RAT.');
                    return;
                }

                if (t.closest('#dp-btn-rat-word')) { modeloRatWord(dActual().rat); return; }

                var bAnexo = t.closest('[data-dp-anexo]');
                if (bAnexo) {
                    var idT = bAnexo.getAttribute('data-dp-anexo');
                    var est = ctx.getEstado();
                    var trab = (est.trabajadores || []).find(function (x) { return x.id === idT; });
                    if (!trab) return;
                    var copia = clonar(trab);
                    delete copia.id;
                    copia.anexoDatosEntrega = ctx.hoyIso();
                    copia.anexoDatosConstancia = true;
                    ctx.api('trabajador', { metodo: 'PUT', query: { id: idT }, cuerpo: { trabajador: copia } }).then(function (r) {
                        if (!r.ok) { $('dp-estado-msg').textContent = (r.datos && r.datos.error) || 'No pudimos actualizar al trabajador.'; return; }
                        ctx.actualizarTrabajadorLocal(r.datos.trabajador);
                        $('dp-estado-msg').className = 'lq-estado ok';
                        $('dp-estado-msg').textContent = 'Marcamos el anexo Ley 21.719 de ' + trab.nombre + ' como firmado.';
                        dibujar('trabajadores');
                        if (typeof ctx.alCambiar === 'function') ctx.alCambiar();
                    });
                    return;
                }

                var dpaWord = t.closest('[data-dp-dpa-word]');
                if (dpaWord) {
                    var pW = dActual().encargados.find(function (x) { return x.id === dpaWord.getAttribute('data-dp-dpa-word'); });
                    if (pW) modeloDpaWord(pW);
                    return;
                }
                var dpaOk = t.closest('[data-dp-dpa-ok]');
                if (dpaOk) {
                    var dd = dActual(), idD = dpaOk.getAttribute('data-dp-dpa-ok');
                    dd.encargados.forEach(function (x) { if (x.id === idD) { x.dpaFirmado = true; x.fechaFirma = x.fechaFirma || ctx.hoyIso(); } });
                    guardarDatos(dd, 'Marcamos el contrato DPA como firmado.');
                    return;
                }
                var dpaDel = t.closest('[data-dp-dpa-del]');
                if (dpaDel) {
                    var dd2 = dActual(), idD2 = dpaDel.getAttribute('data-dp-dpa-del');
                    dd2.encargados = dd2.encargados.filter(function (x) { return x.id !== idD2; });
                    guardarDatos(dd2, 'Quitamos al proveedor del listado.');
                    return;
                }

                var arcWord = t.closest('[data-dp-arcop-word]');
                if (arcWord) {
                    var sW = dActual().solicitudesArcop.find(function (x) { return x.id === arcWord.getAttribute('data-dp-arcop-word'); });
                    if (sW) modeloRespuestaArcopWord(sW);
                    return;
                }
                var arcPr = t.closest('[data-dp-arcop-prorroga]');
                if (arcPr) {
                    var da = dActual(), idA = arcPr.getAttribute('data-dp-arcop-prorroga');
                    da.solicitudesArcop.forEach(function (x) { if (x.id === idA) x.prorroga = true; });
                    guardarDatos(da, 'Aplicamos prórroga legal única de 30 días adicionales (Art. 11 inc. 2).');
                    return;
                }
                var arcOk = t.closest('[data-dp-arcop-ok]');
                if (arcOk) {
                    var da2 = dActual(), idA2 = arcOk.getAttribute('data-dp-arcop-ok');
                    da2.solicitudesArcop.forEach(function (x) { if (x.id === idA2) { x.estado = 'respondida'; x.fechaRespuesta = ctx.hoyIso(); } });
                    guardarDatos(da2, 'Solicitud ARCOP marcada como respondida.');
                    return;
                }
                var arcDel = t.closest('[data-dp-arcop-del]');
                if (arcDel) {
                    var da3 = dActual(), idA3 = arcDel.getAttribute('data-dp-arcop-del');
                    da3.solicitudesArcop = da3.solicitudesArcop.filter(function (x) { return x.id !== idA3; });
                    guardarDatos(da3, 'Solicitud ARCOP eliminada.');
                    return;
                }

                var brNotif = t.closest('[data-dp-br-notif]') || t.closest('[data-dp-br-cerrar]');
                if (brNotif) {
                    var db = dActual(), esN = !!t.closest('[data-dp-br-notif]'), idB = (t.closest('[data-dp-br-notif]') || t.closest('[data-dp-br-cerrar]')).getAttribute(esN ? 'data-dp-br-notif' : 'data-dp-br-cerrar');
                    db.brechas.forEach(function (x) { if (x.id === idB) { x.estado = esN ? 'notificada' : 'cerrada_sin_riesgo'; if (esN) x.fechaNotificacion = ctx.hoyIso(); } });
                    guardarDatos(db, esN ? 'Incidente marcado como notificado a la Agencia.' : 'Incidente cerrado sin riesgo relevante.');
                    return;
                }
                var brDel = t.closest('[data-dp-br-del]');
                if (brDel) {
                    var db2 = dActual(), idB2 = brDel.getAttribute('data-dp-br-del');
                    db2.brechas = db2.brechas.filter(function (x) { return x.id !== idB2; });
                    guardarDatos(db2, 'Incidente quitado de la bitácora.');
                    return;
                }
                var ratDel = t.closest('[data-dp-rat-del]');
                if (ratDel) {
                    var dr2 = dActual(), idR = ratDel.getAttribute('data-dp-rat-del');
                    dr2.rat = dr2.rat.filter(function (x) { return x.id !== idR; });
                    guardarDatos(dr2, 'Actividad eliminada del RAT.');
                }
            });

            vista.addEventListener('submit', function (e) {
                e.preventDefault();
                var f = e.target;
                if (f.id === 'dp-form-config') {
                    var d = dActual();
                    d.correoPrivacidad = $('dp-cfg-correo').value.trim();
                    d.responsableDatos = $('dp-cfg-resp').value.trim();
                    d.checklist.protocoloBrechas = $('dp-cfg-brechas').checked;
                    d.checklist.ratRevisado = $('dp-cfg-rat').checked;
                    guardarDatos(d, 'Configuración de protección de datos guardada.');
                } else if (f.id === 'dp-form-dpa') {
                    var dd = dActual();
                    var fechaF = $('dp-dpa-fecha').value;
                    dd.encargados.push({
                        nombre: $('dp-dpa-nom').value.trim(),
                        servicio: $('dp-dpa-serv').value.trim(),
                        datosTratados: $('dp-dpa-datos').value.trim(),
                        dpaFirmado: $('dp-dpa-firmado').checked || !!fechaF,
                        fechaFirma: fechaF || ($('dp-dpa-firmado').checked ? ctx.hoyIso() : ''),
                        notas: ''
                    });
                    guardarDatos(dd, 'Proveedor encargado agregado.');
                } else if (f.id === 'dp-form-arcop') {
                    var da = dActual();
                    var rut = $('dp-arc-rut').value.trim();
                    if (rut && window.CLRut && !window.CLRut.valido(rut)) {
                        $('dp-estado-msg').className = 'lq-estado error';
                        $('dp-estado-msg').textContent = 'El RUT del solicitante no es válido.';
                        return;
                    }
                    da.solicitudesArcop.push({
                        nombre: $('dp-arc-nom').value.trim(),
                        rut: rut && window.CLRut ? window.CLRut.formatear(rut) : '',
                        correo: $('dp-arc-correo').value.trim(),
                        calidad: $('dp-arc-cal').value,
                        derecho: $('dp-arc-der').value,
                        fechaRecepcion: $('dp-arc-fecha').value,
                        prorroga: false,
                        estado: 'pendiente',
                        fechaRespuesta: '',
                        notas: $('dp-arc-notas').value.trim()
                    });
                    guardarDatos(da, 'Solicitud ARCOP registrada con control de 30 días.');
                } else if (f.id === 'dp-form-brecha') {
                    var db = dActual();
                    db.checklist.protocoloBrechas = true;
                    db.brechas.push({
                        fechaHora: $('dp-br-fecha').value.trim(),
                        origen: $('dp-br-orig').value,
                        datosComprometidos: $('dp-br-datos').value.trim(),
                        medidas: $('dp-br-med').value.trim(),
                        estado: 'abierta',
                        fechaNotificacion: ''
                    });
                    guardarDatos(db, 'Incidente registrado en bitácora (ventana 72h).');
                } else if (f.id === 'dp-form-rat') {
                    var dr = dActual();
                    dr.checklist.ratRevisado = true;
                    dr.rat.push({
                        actividad: $('dp-rat-act').value.trim(),
                        baseLegal: $('dp-rat-base').value.trim(),
                        datosTratados: $('dp-rat-datos').value.trim(),
                        plazoConservacion: $('dp-rat-plazo').value.trim()
                    });
                    guardarDatos(dr, 'Actividad agregada al RAT.');
                }
            });
        }

        enlazarEventos();
        return { dibujar: dibujar, actualizarInsignia: actualizarInsignia, TAB_VALIDOS: TAB_VALIDOS };
    }

    window.CLPymeDatosLey = { montarUI: montarUI };
})();
