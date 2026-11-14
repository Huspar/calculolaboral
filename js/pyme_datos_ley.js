/*
 * CalculoLaboral · Modulo operacional Ley 21.719 (Proteccion de Datos Personales) en /app/datos-personales.
 * Recorrido guiado en 4 pasos (contacto, trabajadores, proveedores y radar nube/IA, inventario y EIPD),
 * generador de politica web (Art. 14 ter), canal de atencion y bandeja de solicitudes ARCOPS+Bloqueo e incidentes (Art. 14 sexies).
 */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var DEF = { correoPrivacidad: '', responsableDatos: '', checklist: { protocoloBrechas: false, ratRevisado: false }, encargados: [], solicitudesArcop: [], brechas: [], rat: [] };
    var MAPA_TABS = {
        inicio: 'inicio',
        trabajadores: 'trabajadores',
        proveedores: 'proveedores',
        inventario: 'inventario',
        solicitudes: 'solicitudes',
        // Compatibilidad con enlaces profundos previos (pyme_pendientes.js y marcadores)
        resumen: 'inicio',
        guia: 'inicio',
        encargados: 'proveedores',
        dpa: 'proveedores',
        rat: 'inventario',
        arcop: 'solicitudes',
        brechas: 'solicitudes'
    };
    var DERECHOS = {
        acceso: 'Ver sus datos (Acceso)',
        rectificacion: 'Corregir un dato (Rectificación)',
        supresion: 'Borrar sus datos (Supresión)',
        oposicion: 'Dejar de recibir avisos (Oposición)',
        portabilidad: 'Llevarse copia digital (Portabilidad, art. 9)',
        bloqueo: 'Suspender uso temporalmente (Bloqueo, art. 8 ter)'
    };
    var ETIQUETAS_DERECHO = Object.assign({ cancelacion: 'Borrar sus datos (Supresión)' }, DERECHOS);
    var CALIDADES = { trabajador: 'Trabajador activo', ex_trabajador: 'Ex-trabajador', cliente: 'Cliente', contacto: 'Contacto comercial' };
    var ORIGENES = {
        equipo: 'Robo o pérdida de computador o celular',
        malware: 'Acceso no autorizado o virus informático',
        correo: 'Correo enviado por error a otra persona',
        acceso: 'Ingreso indebido con claves o cuentas',
        otro: 'Otro incidente'
    };
    var NATURALEZAS_BRECHA = [
        'Acceso no autorizado a cuenta o sistema',
        'Pérdida o robo de equipo con datos',
        'Envío erróneo de archivo o correo a tercero',
        'Alteración o destrucción accidental de registros'
    ];
    var EFECTOS_BRECHA = [
        'Exposición de datos laborales, de sueldo o salud',
        'Riesgo de suplantación de identidad o fraude',
        'Afectación acotada de contacto sin perjuicio patrimonial'
    ];
    var EST_BRECHA = { abierta: 'Sin dilaciones indebidas (meta 72h)', notificada: 'Notificada a la Agencia', cerrada_sin_riesgo: 'Cerrada sin riesgo relevante' };

    var RADAR_NUBE = [
        { key: 'google', chip: '+ Google Workspace / Gmail (EE. UU.)', nombre: 'Google Workspace / Gmail', servicio: 'Correo corporativo y documentos en la nube', datosTratados: 'Correos, archivos de clientes y trabajadores', pais: 'EE. UU.', notas: 'Cláusulas estándar de tratamiento (DPA) aceptadas en contrato Google; transferencia internacional Arts. 27-28.' },
        { key: 'ms365', chip: '+ Microsoft 365 / Outlook (EE. UU.)', nombre: 'Microsoft 365 / Outlook', servicio: 'Correo y ofimática en la nube', datosTratados: 'Correos, planillas y documentos laborales', pais: 'EE. UU.', notas: 'Cláusulas estándar (DPA Microsoft) aceptadas en contrato; transferencia internacional Arts. 27-28.' },
        { key: 'meta', chip: '+ WhatsApp Business / Meta (EE. UU.)', nombre: 'WhatsApp Business / Meta', servicio: 'Mensajería comercial y atención a clientes', datosTratados: 'Nombres, teléfonos y consultas comerciales', pais: 'EE. UU.', notas: 'Términos comerciales Meta; evitar circular licencias médicas o datos sensibles (Art. 16 bis).' },
        { key: 'mailchimp', chip: '+ Mailchimp / Email Mkt (EE. UU.)', nombre: 'Mailchimp / Email Marketing', servicio: 'Envío de campañas y avisos comerciales', datosTratados: 'Nombres y correos de clientes o suscriptores', pais: 'EE. UU.', notas: 'Cláusulas estándar de transferencia internacional (Arts. 27-28); respetar derecho de oposición (Art. 8).' },
        { key: 'hosting', chip: '+ Hosting internacional (AWS / Vercel)', nombre: 'Hosting internacional (AWS / Vercel)', servicio: 'Alojamiento de sitio web y formularios', datosTratados: 'Formularios de contacto y registros de acceso web', pais: 'EE. UU.', notas: 'DPA estándar de infraestructura en la nube; transferencia internacional Arts. 27-28.' },
        { key: 'ia', chip: '+ Herramientas de IA (ChatGPT / Claude)', nombre: 'Herramientas de IA (ChatGPT / Claude)', servicio: 'Asistencia de redacción o análisis con IA', datosTratados: 'Textos operativos (sin cargar RUT ni salud de personas)', pais: 'EE. UU.', notas: 'Activar privacidad sin entrenamiento con datos y no subir datos sensibles ni nóminas identificables (Arts. 16 bis y 27).' }
    ];

    var CASOS_EIPD = {
        cctv: {
            id: 'dp-eipd-cctv',
            titulo: 'Cámaras hacia la vía pública o acceso común',
            resumen: 'Riesgo: Captación de terceros ajenos. Mitigación: Ángulo ajustado a perímetro propio y letrero visible.',
            riesgo: 'Vigilancia sistemática de zona de acceso público y captación incidental de transeúntes o áreas íntimas.',
            mitigacion: 'Enfocar solo accesos o cajas, prohibir cámaras en baños o descanso (Art. 154 ter CT), ciclo acotado de sobrescritura y letrero visible con correo de contacto.'
        },
        bio: {
            id: 'dp-eipd-bio',
            titulo: 'Reloj biométrico (huella o reconocimiento facial)',
            resumen: 'Riesgo: Dato sensible irreparable. Mitigación: Plantilla hash cifrada y alternativa no biométrica (Res. 38 DT).',
            riesgo: 'Tratamiento de datos biométricos sensibles irreparables ante eventual filtración o falta de voluntariedad laboral.',
            mitigacion: 'Consentimiento expreso separado (Art. 16 ter), almacenamiento como algoritmo cifrado no reconstruible y entrega permanente de alternativa no biométrica (Res. Ex. 38/2024 DT).'
        },
        gps: {
            id: 'dp-eipd-gps',
            titulo: 'GPS en vehículos o geolocalización de personal',
            resumen: 'Riesgo: Invasión de vida privada. Mitigación: Registro activo solo en jornada laboral con aviso previo.',
            riesgo: 'Seguimiento continuo fuera de horario laboral o inferencia de vida privada de conductores y personal en terreno.',
            mitigacion: 'Informar tipo de dato, finalidad y duración (Art. 16 sexies), activar solo en jornada pactada y restringir historial a coordinación operativa.'
        }
    };

    // Cinco preguntas cotidianas que generan inventario sin confundir el RAT con obligación del Art. 14 ter
    var PREGUNTAS_RAT = [
        {
            key: 'trabajadores',
            pregunta: '1. ¿Tienes trabajadores contratados?',
            ayuda: 'Guardas RUT, domicilio, sueldo, salud, AFP y licencias médicas para contratos, liquidaciones y Previred.',
            meta: 'Motivo legal: Obligación laboral (Art. 16 letra e) · Plazo: 2 años (Art. 510 CT) / 6 años tributario',
            patron: /personal|remuneracion|trabajador/i,
            rat: {
                actividad: 'Gestión de personal y remuneraciones',
                baseLegal: 'Obligación laboral y seguridad social (Art. 16 letra e)',
                datosTratados: 'RUT, domicilio, sueldo, AFP, salud y licencias médicas (Art. 16 bis)',
                plazoConservacion: '2 años prescripción laboral (Art. 510 CT) y hasta 6 años tributario'
            }
        },
        {
            key: 'facturas',
            pregunta: '2. ¿Emites facturas o boletas a tus clientes?',
            ayuda: 'Guardas razón social, RUT, dirección y correos de contacto para emitir documentos tributarios y cobrar.',
            meta: 'Motivo legal: Obligación tributaria ante el SII · Plazo: Hasta 6 años (Arts. 17 y 200 Cód. Tributario)',
            patron: /facturac|boleta|sii|cobranz/i,
            rat: {
                actividad: 'Facturación y cobranza a clientes',
                baseLegal: 'Obligación tributaria ante el SII y contrato comercial',
                datosTratados: 'Nombre o razón social, RUT, dirección y correo de contacto',
                plazoConservacion: 'Hasta 6 años tributarios (Arts. 17 y 200 Código Tributario)'
            }
        },
        {
            key: 'cctv',
            pregunta: '3. ¿Tienes cámaras de seguridad o control de acceso en tu local u oficina?',
            ayuda: 'Registras imágenes de video o ingresos de personas por motivos de seguridad.',
            meta: 'Motivo legal: Seguridad proporcional de personas y bienes · Plazo: Mínimo operativo (ej. 30 días de sobrescritura)',
            patron: /c[aá]mara|videovigilancia|acceso/i,
            rat: {
                actividad: 'Cámaras de seguridad y control de acceso',
                baseLegal: 'Interés legítimo proporcional de seguridad de personas y bienes',
                datosTratados: 'Imágenes de video y registro de ingreso al recinto',
                plazoConservacion: 'Mínimo operativo de seguridad (práctica de 30 días por ciclo)'
            }
        },
        {
            key: 'comercial',
            pregunta: '4. ¿Envías presupuestos, cotizaciones o promociones por WhatsApp o correo?',
            ayuda: 'Guardas nombres, teléfonos o correos de clientes y prospectos para cotizar y contactarlos.',
            meta: 'Motivo legal: Relación comercial y consentimiento · Plazo: 2 años desde último contacto o retiro del permiso',
            patron: /cotizacion|promocion|comercial|prospecto/i,
            rat: {
                actividad: 'Cotizaciones y contacto comercial',
                baseLegal: 'Relación comercial y consentimiento revocable del titular',
                datosTratados: 'Nombre, teléfono, correo electrónico e historial de cotizaciones',
                plazoConservacion: '2 años desde la última interacción o hasta oposición (Art. 8)'
            }
        },
        {
            key: 'web',
            pregunta: '5. ¿Pides datos en un formulario de contacto en tu sitio web?',
            ayuda: 'Recibes consultas web con nombre, teléfono o correo de quienes te escriben.',
            meta: 'Motivo legal: Responder la consulta solicitada · Plazo: 1 año tras cierre de consulta',
            patron: /formulario web|consultas web|sitio web/i,
            rat: {
                actividad: 'Consultas desde formulario del sitio web',
                baseLegal: 'Consentimiento al enviar la consulta solicitada',
                datosTratados: 'Nombre, correo electrónico, teléfono y mensaje de consulta',
                plazoConservacion: '1 año desde el cierre de la consulta'
            }
        }
    ];

    function sumarDiasIso(iso, n) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
        var p = iso.split('-').map(Number);
        var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
        return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
    }

    function diasEntre(aIso, bIso) {
        if (!aIso || !bIso) return 0;
        var a = aIso.split('-').map(Number), b = bIso.split('-').map(Number);
        return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
    }

    function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }

    function normDatos(raw) {
        var r = raw && typeof raw === 'object' ? raw : {};
        var ck = r.checklist && typeof r.checklist === 'object' ? r.checklist : {};
        return {
            correoPrivacidad: String(r.correoPrivacidad || ''),
            responsableDatos: String(r.responsableDatos || ''),
            checklist: { protocoloBrechas: !!ck.protocoloBrechas, ratRevisado: !!ck.ratRevisado },
            encargados: Array.isArray(r.encargados) ? r.encargados.slice() : [],
            solicitudesArcop: Array.isArray(r.solicitudesArcop) ? r.solicitudesArcop.slice() : [],
            brechas: Array.isArray(r.brechas) ? r.brechas.slice() : [],
            rat: Array.isArray(r.rat) ? r.rat.slice() : []
        };
    }

    function clonar(o) { return JSON.parse(JSON.stringify(o)); }

    function coincidePregunta(ratRow, preg) {
        var txt = String((ratRow && ratRow.actividad) || '');
        return preg.patron.test(txt) || txt.toLowerCase() === preg.rat.actividad.toLowerCase();
    }

    function esPreguntaAutomatica(ratRow) {
        return PREGUNTAS_RAT.some(function (p) { return coincidePregunta(ratRow, p); });
    }

    function copiarTexto(texto, elEstado, okMsg) {
        function hecho() {
            if (elEstado) { elEstado.className = 'lq-estado ok'; elEstado.textContent = okMsg; }
        }
        function respaldo() {
            var ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); hecho(); } catch (e) { if (elEstado) { elEstado.className = 'lq-estado error'; elEstado.textContent = 'No pudimos copiar automáticamente; selecciona el cuadro y presiona Ctrl+C.'; } }
            ta.remove();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(hecho, respaldo);
        } else {
            respaldo();
        }
    }

    function abrirDialogo(dlg) {
        if (!dlg) return;
        if (typeof dlg.showModal === 'function') {
            if (!dlg.open) dlg.showModal();
        } else {
            dlg.setAttribute('open', '');
        }
    }

    function cerrarDialogo(dlg) {
        if (!dlg) return;
        if (typeof dlg.close === 'function') {
            if (dlg.open) dlg.close();
        } else {
            dlg.removeAttribute('open');
        }
    }

    function montarUI(ctx) {
        var esc = ctx.esc;
        var tabActual = 'inicio';
        var guardando = false;
        var configAbierta = false;
        var polFmt = 'texto';

        function dActual() {
            var e = ctx.getEstado();
            return normDatos(e && e.datosLey21719);
        }

        function fecha(iso) { return iso ? esc(ctx.fechaCortaAnio(iso)) : '-'; }

        function resumenControles(est, d, hoy) {
            var activos = (est.trabajadores || []).filter(function (t) { return t.activo !== false; });
            var conAnexo = activos.filter(function (t) { return !!t.anexoDatosEntrega; }).length;
            var dpaFirmados = d.encargados.filter(function (x) { return !!x.dpaFirmado; }).length;
            var arcopPend = d.solicitudesArcop.filter(function (x) { return x.estado === 'pendiente'; });
            var arcopUrgentes = arcopPend.filter(function (x) {
                var vence = sumarDiasIso(x.fechaRecepcion, x.prorroga ? 60 : 30);
                return diasEntre(hoy, vence) <= 7;
            }).length;
            var brechasAbiertas = d.brechas.filter(function (x) { return x.estado === 'abierta'; }).length;

            // Cuatro hitos del recorrido inicial en orden
            var p1 = !!(d.correoPrivacidad && d.responsableDatos);
            var p2 = activos.length > 0 && conAnexo === activos.length;
            var p3 = d.encargados.length > 0 && dpaFirmados === d.encargados.length;
            var p4 = d.rat.length > 0 && d.checklist.ratRevisado;
            var completados = [p1, p2, p3, p4].filter(Boolean).length;

            return {
                activos: activos,
                conAnexo: conAnexo,
                dpaFirmados: dpaFirmados,
                arcopAbiertas: arcopPend.length,
                arcopUrgentes: arcopUrgentes,
                brechasAbiertas: brechasAbiertas,
                completados: completados,
                pasosOk: [p1, p2, p3, p4]
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
            if (msgEl) { msgEl.className = 'lq-estado'; msgEl.textContent = 'Guardando cambios...'; }
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
            var encabezado = '<h1>' + esc(titulo) + '</h1><p class="meta"><strong>' + esc(emp.razonSocial || 'Mi Empresa') + '</strong> · RUT ' + esc(emp.rut || '-') + (d.correoPrivacidad ? ' · Canal privacidad: ' + esc(d.correoPrivacidad) : '') + ' · Fecha: ' + esc(ctx.hoyIso()) + '</p>';
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
            var hayIntl = !!(prov.transferenciaInternacional || (prov.pais && !/^chile$/i.test(String(prov.pais).trim())));
            var clIntl = hayIntl
                ? '<li><strong>Transferencia internacional de datos (Arts. 27 y 28):</strong> Debido a que el servicio opera o almacena datos fuera de Chile (' + esc(prov.pais || 'extranjero') + '), el Proveedor acredita garantías equivalentes mediante cláusulas contractuales tipo, normas corporativas vinculantes o país adecuado conforme a las instrucciones de la Agencia.</li>'
                : '';
            var cuerpo = '<p><strong>ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (ART. 15 BIS LEY N° 19.628 / LEY N° 21.719)</strong></p>' +
                '<p>Entre <strong>' + esc(emp.razonSocial || 'Responsable') + '</strong> (RUT ' + esc(emp.rut || '-') + '), en adelante el <strong>Responsable</strong>, y <strong>' + esc(prov.nombre) + '</strong> (' + esc(prov.servicio || 'Proveedor de servicios') + '), en adelante el <strong>Proveedor o Encargado</strong>, se dejan por escrito las obligaciones exigidas por el artículo 15 bis:</p>' +
                '<table><tr><th>Objeto y finalidad</th><td>' + esc(prov.servicio || 'Prestación de servicios contratados') + '</td></tr>' +
                '<tr><th>Duración</th><td>' + esc(prov.duracion || 'Durante la vigencia del contrato principal de servicios') + '</td></tr>' +
                '<tr><th>Tipos de datos y titulares</th><td>' + esc(prov.datosTratados || 'Datos identificatorios, laborales, previsionales o de contacto de trabajadores, clientes y proveedores') + '</td></tr>' +
                (prov.pais ? '<tr><th>País de alojamiento</th><td>' + esc(prov.pais) + '</td></tr>' : '') + '</table>' +
                '<ol>' +
                '<li><strong>Uso exclusivo y derechos/obligaciones:</strong> El Proveedor tratará los datos únicamente para prestar el servicio contratado según instrucciones documentadas del Responsable, sin comercializarlos ni utilizarlos para fines propios.</li>' +
                '<li><strong>Reserva y confidencialidad:</strong> Su personal autorizado mantendrá reserva estricta y vinculante sobre la información personal a la que acceda.</li>' +
                '<li><strong>Resguardo y seguridad (Art. 14 quinquies):</strong> Aplicará medidas técnicas y organizativas proporcionales al riesgo contra extravío, alteración o acceso no autorizado.</li>' +
                '<li><strong>Subdelegación prohibida sin autorización:</strong> No podrá delegar el tratamiento en subencargados sin autorización previa y por escrito del Responsable.</li>' +
                clIntl +
                '<li><strong>Colaboración ante solicitudes e incidentes (Art. 14 sexies):</strong> Avisará sin dilaciones indebidas (y operativamente en un máximo de 24 horas) al Responsable ante cualquier vulneración de seguridad, y apoyará la respuesta de derechos ARCOPS y bloqueo dentro de los 30 días corridos legales.</li>' +
                '<li><strong>Devolución o supresión al término:</strong> Terminado el servicio, devolverá o suprimirá de forma segura e irrecuperable los datos y copias, salvo obligación legal de conservación.</li>' +
                '</ol>' +
                '<p style="margin-top:28px">______________________________ &nbsp;&nbsp;&nbsp;&nbsp; ______________________________<br>' + esc(emp.razonSocial || 'Responsable') + ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ' + esc(prov.nombre) + '</p>';
            descargarWord('Acuerdo proveedor ' + prov.nombre, cuerpo, 'Acuerdo-proveedor-' + prov.nombre);
        }

        function modeloRespuestaArcopWord(sol) {
            var der = ETIQUETAS_DERECHO[sol.derecho] || sol.derecho;
            var vence = sumarDiasIso(sol.fechaRecepcion, sol.prorroga ? 60 : 30);
            var cuerpo = '<p><strong>COMPROBANTE DE RESPUESTA A SOLICITUD DE DATOS PERSONALES (ARTS. 4 A 11 LEY N° 19.628)</strong></p>' +
                '<table><tr><th>Titular solicitante</th><td>' + esc(sol.nombre) + ' (' + esc(sol.rut || 'RUT sin indicar') + ')</td></tr>' +
                '<tr><th>Relación con la empresa</th><td>' + esc(CALIDADES[sol.calidad] || sol.calidad) + '</td></tr>' +
                '<tr><th>Derecho ejercido</th><td>' + esc(der) + '</td></tr>' +
                '<tr><th>Fecha de recepción</th><td>' + esc(sol.fechaRecepcion) + '</td></tr>' +
                '<tr><th>Plazo legal máximo</th><td>' + esc(vence) + (sol.prorroga ? ' (incluye prórroga legal única de 30 días corridos)' : ' (30 días corridos)') + '</td></tr></table>' +
                '<h2>Detalle de la respuesta fundada entregada</h2>' +
                '<p>' + (sol.notas ? esc(sol.notas) : '[Indica aquí el resultado concreto: copia entregada, rectificación, supresión, bloqueo temporal aplicado, oposición o motivo legal fundado de conservación/denegación].') + '</p>' +
                '<p>Este trámite es gratuito (salvo acceso o portabilidad reiterados más de una vez por trimestre, art. 10). Si consideras que la solicitud fue denegada injustificadamente o no respondida en plazo, puedes reclamar ante la <strong>Agencia de Protección de Datos Personales dentro de 30 días hábiles</strong> conforme al artículo 11 de la Ley N° 19.628 (modificada por Ley N° 21.719).</p>';
            descargarWord('Respuesta solicitud datos ' + sol.nombre, cuerpo, 'Respuesta-solicitud-' + sol.nombre);
        }

        function modeloConsentimientoBioWord() {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {}, d = dActual();
            var cuerpo = '<p><strong>CONSENTIMIENTO EXPRESO DE CONTROL BIOMÉTRICO Y OPCIÓN NO BIOMÉTRICA (ART. 16 TER LEY 19.628 Y RES. EX. N° 38/2024 DT)</strong></p>' +
                '<p>En __________, a ' + esc(ctx.hoyIso()) + ', entre <strong>' + esc(emp.razonSocial || 'Empleador') + '</strong> (RUT ' + esc(emp.rut || '-') + ') y el/la trabajador(a) ______________________________, RUT _______________:</p>' +
                '<ol>' +
                '<li><strong>Sistema utilizado y almacenamiento (Art. 16 ter):</strong> El sistema de control de asistencia captura patrones biométricos (huella dactilar o rostro) convertidos en algoritmos matemáticos cifrados, sin almacenar imágenes reconstruibles.</li>' +
                '<li><strong>Finalidad y período de uso:</strong> Los datos se usarán exclusivamente para registrar la jornada laboral y calcular remuneraciones mientras dure la relación de trabajo, suprimiéndose al término de esta salvo deber legal de respaldo de asistencia.</li>' +
                '<li><strong>Alternativa obligatoria no biométrica (Res. Ex. 38/2024 DT):</strong> La empresa garantiza siempre un método no biométrico (clave/PIN, tarjeta o aplicación web) sin represalias ni perjuicios si el trabajador prefiere no usar biometría.</li>' +
                '<li><strong>Derechos y retiro del consentimiento:</strong> Puedes retirar este consentimiento en cualquier momento y ejercer acceso, rectificación, supresión, oposición y bloqueo escribiendo a <strong>' + esc(d.correoPrivacidad || '[correo de privacidad]') + '</strong>.</li>' +
                '</ol>' +
                '<p><strong>Elección del trabajador (marca una opción):</strong><br>' +
                '[ ] AUTORIZO expresamente el registro biométrico de mi asistencia.<br>' +
                '[ ] PREFIERO utilizar el método alternativo no biométrico (PIN, tarjeta o clave).</p>' +
                '<p style="margin-top:26px">______________________________ &nbsp;&nbsp;&nbsp;&nbsp; ______________________________<br>' + esc(emp.razonSocial || 'Empleador') + ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Firma del Trabajador</p>';
            descargarWord('Consentimiento biometrico y alternativa Res 38 DT', cuerpo, 'Consentimiento-biometrico-Res38');
        }

        function modeloEipdWord(claves) {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {}, d = dActual();
            var filas = claves.map(function (k) {
                var c = CASOS_EIPD[k];
                return '<tr><td><strong>' + esc(c.titulo) + '</strong></td><td>' + esc(c.riesgo) + '</td><td>' + esc(c.mitigacion) + '</td></tr>';
            }).join('');
            var cuerpo = '<p><strong>EVALUACIÓN DE IMPACTO EN PROTECCIÓN DE DATOS PERSONALES (EIPD, ART. 15 TER LEY 19.628 / LEY 21.719)</strong></p>' +
                '<p>Conforme al artículo 15 ter de la Ley N° 19.628, el responsable evalúa previamente los riesgos y medidas de mitigación para operaciones de mayor sensibilidad (art. 34 quáter letra k sanciona omitirla cuando corresponde):</p>' +
                '<table><tr><th>Responsable interno (Art. 50)</th><td>' + esc(d.responsableDatos || 'Dueño / Administración') + ' (' + esc(d.correoPrivacidad || 'Sin correo configurado') + ')</td></tr>' +
                '<tr><th>Necesidad y proporcionalidad</th><td>Los tratamientos evaluados responden a control de jornada, seguridad patrimonial u operación logística, limitando acceso, duración y alcance al mínimo indispensable (privacidad desde el diseño, art. 14 quáter).</td></tr></table>' +
                '<table><thead><tr><th>Operación evaluada</th><th>Riesgo identificado</th><th>Medidas concretas de mitigación</th></tr></thead><tbody>' + filas + '</tbody></table>' +
                '<p style="margin-top:24px">Aprobado por: ______________________________ (' + esc(emp.razonSocial || 'Responsable') + ' · ' + esc(ctx.hoyIso()) + ')</p>';
            descargarWord('Evaluacion de Impacto EIPD Art 15 ter', cuerpo, 'Evaluacion-Impacto-EIPD');
        }

        function construirPoliticaWeb() {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {}, d = dActual();
            var nombre = emp.razonSocial || 'Nuestra empresa';
            var rut = emp.rut ? ' (RUT ' + emp.rut + ')' : '';
            var correo = d.correoPrivacidad || '[configura tu correo de privacidad en el Paso 1]';
            var resp = d.responsableDatos ? ' Encargado interno (Art. 50): ' + d.responsableDatos + '.' : '';
            var act = d.rat.length ? d.rat : [
                { actividad: 'Atención de consultas y clientes', baseLegal: 'Relación comercial y consentimiento revocable', datosTratados: 'Nombre, correo y teléfono de contacto', plazoConservacion: '2 años desde el último contacto o retiro del permiso' }
            ];
            var encIntl = d.encargados.filter(function (p) { return p.transferenciaInternacional || (p.pais && !/^chile$/i.test(String(p.pais).trim())); });
            var txtIntl = encIntl.length
                ? 'Se realizan transferencias internacionales hacia: ' + encIntl.map(function (p) { return p.nombre + ' (' + (p.pais || 'extranjero') + ')'; }).join(', ') + ', respaldadas por país adecuado o cláusulas contractuales conforme a los arts. 27 y 28.'
                : 'Si contratamos servicios en la nube fuera de Chile, la transferencia internacional cumple país adecuado o cláusulas contractuales con garantías equivalentes (Arts. 27 y 28).';

            var textoLista = act.map(function (r, idx) {
                return (idx + 1) + '. ' + r.actividad + ': ' + (r.datosTratados || 'datos de identificación y contacto') + '. Base de licitud: ' + (r.baseLegal || 'cumplimiento legal o contractual') + '. Conservación: ' + (r.plazoConservacion || '2 años laboral art. 510 CT / hasta 6 años tributario') + '.';
            }).join('\n');

            var texto = 'POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES (ART. 14 TER LEY N° 19.628 / LEY N° 21.719)\n' +
                nombre + rut + '\n' +
                'Actualizada el ' + ctx.hoyIso() + '\n\n' +
                '1. Responsable y contacto\n' +
                nombre + rut + ' resguarda los datos personales entregados directamente por clientes, trabajadores y proveedores conforme a la Ley N° 21.719.' + resp + ' Contacto: ' + correo + '.\n\n' +
                '2. Datos, titulares, bases de licitud y conservación\n' +
                textoLista + '\n\n' +
                '3. Destinatarios, encargados y transferencias internacionales (Arts. 15 bis, 27 y 28)\n' +
                'No vendemos datos personales. Solo comunicamos antecedentes por obligación legal (SII, DT, previsional) o a proveedores encargados bajo contrato escrito. ' + txtIntl + '\n\n' +
                '4. Seguridad, retiro del consentimiento y decisiones automatizadas\n' +
                'Aplicamos control de accesos, resguardo cifrado y medidas proporcionales al riesgo (Art. 14 quinquies). Puedes retirar tu consentimiento cuando esta sea la base de licitud. No aplicamos decisiones exclusivamente automatizadas con efectos jurídicos significativos sin opción de revisión humana (Art. 8 bis).\n\n' +
                '5. Derechos ARCOPS, bloqueo y reclamo ante la Agencia (Arts. 4 a 11)\n' +
                'Puedes solicitar acceso, rectificación, supresión, oposición, portabilidad (en tratamientos automatizados basados en consentimiento, Art. 9) y bloqueo temporal (Art. 8 ter) escribiendo gratis a ' + correo + '. Responderemos en máximo 30 días corridos (prorrogables una vez por otros 30). Si denegamos o no respondemos a tiempo, puedes reclamar ante la Agencia de Protección de Datos Personales dentro de 30 días hábiles.';

            var htmlLista = act.map(function (r) {
                return '    <li><strong>' + esc(r.actividad) + ':</strong> ' + esc(r.datosTratados || 'datos de contacto') + '. Base de licitud: ' + esc(r.baseLegal || 'ley o contrato') + '. Conservación: ' + esc(r.plazoConservacion || 'plazo legal aplicable') + '.</li>';
            }).join('\n');

            var html = '<article class="politica-privacidad">\n' +
                '  <h2>Política de privacidad (Art. 14 ter Ley 19.628)</h2>\n' +
                '  <p><strong>' + esc(nombre) + '</strong>' + esc(rut) + ' resguarda los datos personales entregados directamente por clientes, trabajadores y proveedores conforme a la Ley N° 21.719.' + (d.responsableDatos ? ' Encargado interno (Art. 50): ' + esc(d.responsableDatos) + '.' : '') + '</p>\n' +
                '  <h3>Datos tratados, bases de licitud y conservación</h3>\n' +
                '  <ul>\n' + htmlLista + '\n  </ul>\n' +
                '  <h3>Destinatarios, seguridad y transferencias internacionales</h3>\n' +
                '  <p>Aplicamos medidas de seguridad proporcionales al riesgo (Art. 14 quinquies). Solo compartimos datos por deber legal o con encargados bajo contrato escrito (Art. 15 bis). ' + esc(txtIntl) + ' No aplicamos decisiones automatizadas sin revisión humana (Art. 8 bis).</p>\n' +
                '  <h3>Derechos ARCOPS, bloqueo y reclamo ante la Agencia</h3>\n' +
                '  <p>Para ejercer acceso, rectificación, supresión, oposición, portabilidad (Art. 9), bloqueo (Art. 8 ter) o retirar tu consentimiento, escribe a <a href="mailto:' + esc(correo) + '">' + esc(correo) + '</a>. Responderemos dentro de 30 días corridos (prorrogables una vez por 30); ante negativa o falta de respuesta puedes reclamar ante la Agencia dentro de 30 días hábiles.</p>\n' +
                '</article>';

            return { texto: texto, html: html };
        }

        function construirCanalAtencion() {
            var est = ctx.getEstado(), emp = (est && est.empresa) || {}, d = dActual();
            var correo = (d.correoPrivacidad || '').trim();
            var nombre = emp.razonSocial || 'nuestra empresa';
            var asunto = encodeURIComponent('Solicitud de datos personales (Ley 21.719) - ' + nombre);
            var cuerpo = encodeURIComponent(
                'Hola ' + nombre + ',\n\n' +
                'Solicito ejercer mis derechos sobre mis datos personales:\n' +
                '- Nombre completo: \n' +
                '- RUT: \n' +
                '- Qué necesito (ver mis datos / corregir / eliminar / dejar de recibir avisos): \n' +
                '- Detalle adicional: \n'
            );
            var mailto = correo ? 'mailto:' + correo + '?subject=' + asunto + '&body=' + cuerpo : '';
            var htmlBoton = correo
                ? '<a href="' + esc(mailto) + '">Ejercer derechos sobre mis datos personales (' + esc(correo) + ')</a>'
                : '';
            var textoWa = correo
                ? 'Para ver, corregir o pedir la eliminación de tus datos personales en ' + nombre + ', escríbenos a ' + correo + ' indicando tu nombre completo, RUT y qué solicitud necesitas realizar. Te responderemos dentro de 30 días corridos.'
                : '';
            return { correo: correo, mailto: mailto, htmlBoton: htmlBoton, textoWa: textoWa };
        }

        function actualizarModalPolitica() {
            var d = dActual();
            var aviso = $('dp-pol-aviso');
            if (aviso) aviso.hidden = !!d.correoPrivacidad;
            var pol = construirPoliticaWeb();
            var prev = $('dp-pol-preview');
            if (prev) prev.value = polFmt === 'html' ? pol.html : pol.texto;
            var dlg = $('dp-dialogo-politica');
            if (dlg) {
                Array.prototype.forEach.call(dlg.querySelectorAll('[data-dp-pol-fmt]'), function (b) {
                    var act = b.getAttribute('data-dp-pol-fmt') === polFmt;
                    b.classList.toggle('activo', act);
                    b.setAttribute('aria-selected', act ? 'true' : 'false');
                });
            }
        }

        function actualizarModalCanal() {
            var c = construirCanalAtencion();
            var aviso = $('dp-can-aviso'), cuerpo = $('dp-can-cuerpo');
            if (aviso) aviso.hidden = !!c.correo;
            if (cuerpo) cuerpo.hidden = !c.correo;
            if ($('dp-can-mailto')) $('dp-can-mailto').value = c.mailto;
            if ($('dp-can-html')) $('dp-can-html').value = c.htmlBoton;
            if ($('dp-can-wa')) $('dp-can-wa').value = c.textoWa;
            if ($('dp-btn-copiar-enlace-canal')) $('dp-btn-copiar-enlace-canal').disabled = !c.correo;
            if ($('dp-btn-copiar-canal-wa')) $('dp-btn-copiar-canal-wa').disabled = !c.correo;
        }

        function pintarInicio(est, d, res) {
            var c = d.correoPrivacidad, r = d.responsableDatos;
            var segs = res.pasosOk.map(function (ok) { return '<span class="dp-seg' + (ok ? ' hecho' : '') + '"></span>'; }).join('');
            var subP1 = res.pasosOk[0]
                ? 'Correo: ' + esc(c) + ' · Responsable: ' + esc(r)
                : 'Define el correo donde te escribirán si alguien pide ver o borrar sus datos, y quién responde en la empresa.';
            var subP2 = res.activos.length
                ? 'Formaliza por escrito cómo usas los datos laborales y de salud. Van ' + res.conAnexo + ' de ' + res.activos.length + ' firmados.'
                : 'Cuando agregues trabajadores en la sección Personas, podrás generar y registrar aquí sus anexos.';
            var subP3 = d.encargados.length
                ? 'Quienes prestan servicios y ven datos (contador, software, nube) deben comprometerse a no usarlos para otros fines. Van ' + res.dpaFirmados + ' de ' + d.encargados.length + ' con acuerdo.'
                : 'Anota a tu contador, software de remuneraciones o servicio de correo para descargar su acuerdo de confidencialidad.';
            var subP4 = res.pasosOk[3]
                ? 'Tienes ' + plural(d.rat.length, 'actividad documentada', 'actividades documentadas') + ' con su motivo legal y plazo de conservación.'
                : 'Responde 5 preguntas simples sobre tu negocio para armar la lista de datos automáticamente.';

            var sello = function (ok, txtOk, txtPend) {
                return '<span class="sello ' + (ok ? 'sello-emitida' : 'sello-preparada') + '">' + esc(ok ? txtOk : txtPend) + '</span>';
            };

            var formConfigHtml = '<form id="dp-form-config" class="panel-cuerpo"' + (configAbierta ? '' : ' hidden') + ' style="border-top:1px solid var(--line);background:var(--surface-2);margin-top:14px;border-radius:var(--radius-sm)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-cfg-correo">Correo para solicitudes de privacidad</label><input id="dp-cfg-correo" type="email" maxlength="120" value="' + esc(c) + '" placeholder="privacidad@tuempresa.cl" required><p class="lq-help">Puede ser el correo del dueño, administración o uno dedicado.</p></div>' +
                '<div class="lq-field"><label for="dp-cfg-resp">Nombre del responsable interno</label><input id="dp-cfg-resp" type="text" maxlength="80" value="' + esc(r) + '" placeholder="Nombre y apellido de quien responde" required></div>' +
                '</div>' +
                '<div class="form-acciones" style="margin-top:12px">' +
                '<button type="button" class="btn-texto" id="dp-cfg-cancelar">Cerrar</button>' +
                '<button type="submit" class="btn btn-primario">Guardar contacto</button>' +
                '</div>' +
                '</form>';

            return '<div class="panel" style="margin-bottom:16px">' +
                '<div class="panel-head"><div><h2>Recorrido para poner tu empresa al día</h2><p class="texto-ayuda">Sigue estos 4 pasos en orden. No necesitas conocimientos legales: el asistente arma los documentos por ti.</p></div></div>' +
                '<div class="panel-cuerpo">' +
                '<div class="dp-progreso-head"><strong>' + res.completados + ' de 4 pasos completos</strong><span>' + (res.completados === 4 ? 'Empresa al día para fiscalización' : 'Completa el paso pendiente') + '</span></div>' +
                '<div class="dp-progreso" aria-label="Avance de cumplimiento: ' + res.completados + ' de 4 pasos">' + segs + '</div>' +
                '<div class="dp-pasos-guia">' +
                '<div class="dp-paso-item' + (res.pasosOk[0] ? ' completado' : '') + '"><span class="dp-paso-num" aria-hidden="true">1</span><div class="dp-paso-info"><div class="dp-paso-top"><strong>Contacto y responsable de privacidad</strong>' + sello(res.pasosOk[0], 'Configurado', 'Pendiente') + '</div><p>' + subP1 + '</p></div><div class="dp-paso-accion"><button type="button" class="btn btn-chico' + (res.pasosOk[0] ? '' : ' btn-primario') + '" id="dp-btn-toggle-config">' + (res.pasosOk[0] ? 'Editar correo' : 'Configurar correo') + '</button></div></div>' +
                formConfigHtml +
                '<div class="dp-paso-item' + (res.pasosOk[1] ? ' completado' : '') + '"><span class="dp-paso-num" aria-hidden="true">2</span><div class="dp-paso-info"><div class="dp-paso-top"><strong>Trabajadores al día con su anexo</strong>' + sello(res.pasosOk[1], res.conAnexo + ' de ' + res.activos.length + ' firmados', res.activos.length ? (res.conAnexo + ' de ' + res.activos.length + ' firmados') : 'Sin personal') + '</div><p>' + esc(subP2) + '</p></div><div class="dp-paso-accion"><button type="button" class="btn btn-chico" data-dp-ir="trabajadores">Revisar trabajadores</button></div></div>' +
                '<div class="dp-paso-item' + (res.pasosOk[2] ? ' completado' : '') + '"><span class="dp-paso-num" aria-hidden="true">3</span><div class="dp-paso-info"><div class="dp-paso-top"><strong>Proveedores externos que ven datos</strong>' + sello(res.pasosOk[2], res.dpaFirmados + ' con acuerdo', d.encargados.length ? (res.dpaFirmados + ' de ' + d.encargados.length + ' firmados') : 'Pendiente') + '</div><p>' + esc(subP3) + '</p></div><div class="dp-paso-accion"><button type="button" class="btn btn-chico" data-dp-ir="proveedores">Revisar proveedores</button></div></div>' +
                '<div class="dp-paso-item' + (res.pasosOk[3] ? ' completado' : '') + '"><span class="dp-paso-num" aria-hidden="true">4</span><div class="dp-paso-info"><div class="dp-paso-top"><strong>Qué datos guardas en tu empresa</strong>' + sello(res.pasosOk[3], plural(d.rat.length, 'actividad', 'actividades'), 'Sin responder') + '</div><p>' + esc(subP4) + '</p></div><div class="dp-paso-accion"><button type="button" class="btn btn-chico" data-dp-ir="inventario">Completar preguntas</button></div></div>' +
                '</div>' +
                '<div class="dp-tools-grid">' +
                '<div class="dp-tool-card"><div><strong>Política de privacidad para tu sitio web</strong><p>Genera el texto y el código HTML con los datos de tu empresa para publicarlo en minutos.</p></div><div><button type="button" class="btn btn-chico" id="dp-btn-politica-card"><span class="material-icons" aria-hidden="true">description</span>Ver y copiar política web</button></div></div>' +
                '<div class="dp-tool-card"><div><strong>Canal de atención para clientes y personas</strong><p>' + (c ? 'Enlace directo configurado hacia <span class="mono">' + esc(c) + '</span> para recibir solicitudes ordenadas.' : 'Configura tu correo en el Paso 1 para obtener tu enlace de atención listo para compartir.') + '</p></div><div><button type="button" class="btn btn-chico" id="dp-btn-canal-card"><span class="material-icons" aria-hidden="true">link</span>Abrir canal de solicitudes</button></div></div>' +
                '</div></div></div>';
        }

        function pintarTrabajadores(est, d) {
            var activos = (est.trabajadores || []).filter(function (t) { return t.activo !== false; });
            var avisoCorreo = !d.correoPrivacidad
                ? '<div class="lq-aviso lq-aviso-aviso" style="margin:12px 16px 0"><span class="material-icons" aria-hidden="true">info</span><div><strong>Te conviene configurar tu correo en el Paso 1 primero</strong><p>Así el anexo laboral se prellenará solo con el correo de contacto de tu empresa.</p></div><button type="button" class="btn btn-chico" id="dp-trab-ir-paso1">Ir al Paso 1</button></div>'
                : '';

            var avisoBio = '<div class="lq-aviso dp-aviso-bio" style="margin-top:16px">' +
                '<span class="material-icons" aria-hidden="true">fingerprint</span>' +
                '<div><strong>¿Usas reloj biométrico (huella o rostro)?</strong>' +
                '<p>La Ley 21.719 (Art. 16 ter) y la Resolución Exenta N° 38/2024 de la Dirección del Trabajo exigen consentimiento expreso separado y ofrecer siempre una alternativa no biométrica (clave, PIN o tarjeta).</p></div>' +
                '<button type="button" class="btn btn-chico" id="dp-btn-consentimiento-bio"><span class="material-icons" aria-hidden="true">download</span>Consentimiento biométrico (.doc)</button>' +
                '</div>';

            if (!activos.length) {
                return '<div class="panel"><div class="panel-head"><h2>Anexo laboral de protección de datos</h2></div><div class="panel-cuerpo"><p class="vacio">No hay trabajadores activos registrados en esta empresa. Agrega trabajadores en la sección Personas para generar sus anexos con un clic.</p><div class="form-acciones"><a class="btn btn-primario" href="/app/trabajadores" data-ruta="trabajadores">Ir a Personas</a></div></div></div>' + avisoBio;
            }

            var filas = activos.map(function (t) {
                var ok = !!t.anexoDatosEntrega;
                var sello = ok ? '<span class="sello sello-emitida">Firmado</span>' : '<span class="sello sello-sin">Pendiente</span>';
                var q = 't=' + encodeURIComponent(t.id) + '&d=anexo_datos';
                var btnGen = '<a class="btn btn-chico" href="/app/documentos?' + esc(q) + '" data-ruta="documentos" data-query="' + esc(q) + '">Generar anexo</a>';
                var btnMarcar = '<button type="button" class="btn-texto" data-dp-anexo="' + esc(t.id) + '">' + (ok ? 'Actualizar fecha a hoy' : 'Marcar firmado hoy') + '</button>';
                return {
                    html: '<tr><td><strong>' + esc(t.nombre) + '</strong><br><span class="mono" style="font-size:12px;color:var(--muted)">' + esc(t.rut || '') + '</span></td>' +
                        '<td class="ocultar-movil">' + esc(t.cargo || '-') + '</td>' +
                        '<td>' + sello + '</td>' +
                        '<td class="mono">' + fecha(t.anexoDatosEntrega) + '</td>' +
                        '<td class="celda-acciones"><div class="acciones-pila">' + btnGen + ' ' + btnMarcar + '</div></td></tr>',
                    card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(t.nombre) + '</strong>' + sello + '</div>' +
                        '<p class="texto-ayuda" style="margin:4px 0"><span class="mono">' + esc(t.rut || '') + '</span> · ' + esc(t.cargo || 'Sin cargo') + ' · Firma: <span class="mono">' + fecha(t.anexoDatosEntrega) + '</span></p>' +
                        '<div class="acciones-pila" style="margin-top:8px">' + btnGen + ' ' + btnMarcar + '</div></div>'
                };
            });

            return '<div class="panel"><div class="panel-head"><div><h2>Anexo laboral de protección de datos</h2><p class="texto-ayuda">Genera el documento con los datos que ya guardaste en la ficha del trabajador. Una vez firmado, anota la fecha aquí para mantener tu registro al día.</p></div></div>' +
                avisoCorreo +
                '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><caption class="sr-only">Anexo de protección de datos por trabajador</caption><thead><tr><th scope="col">Trabajador y RUT</th><th scope="col" class="ocultar-movil">Cargo</th><th scope="col">Estado</th><th scope="col">Fecha de firma</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + filas.map(function (f) { return f.html; }).join('') + '</tbody></table></div>' +
                '<div class="panel-cuerpo fin-cards-lista">' + filas.map(function (f) { return f.card; }).join('') + '</div></div>' +
                avisoBio;
        }

        function pintarProveedores(d) {
            var existentes = d.encargados.map(function (p) { return String(p.nombre || '').toLowerCase(); });
            var radarChips = RADAR_NUBE.map(function (r) {
                var ya = existentes.indexOf(r.nombre.toLowerCase()) >= 0;
                return '<button type="button" class="btn dp-radar-chip' + (ya ? ' activo' : '') + '" data-radar="' + esc(r.key) + '"' + (ya ? ' disabled' : '') + '>' +
                    esc(ya ? r.chip.replace(/^\+\s*/, '✓ ') : r.chip) + '</button>';
            }).join('');

            var rows = d.encargados.map(function (p) {
                var esIntl = p.transferenciaInternacional || (p.pais && !/^chile$/i.test(String(p.pais).trim()));
                var sello = (p.dpaFirmado ? '<span class="sello sello-emitida">Acuerdo firmado</span>' : '<span class="sello sello-preparada">Pendiente firma</span>') +
                    (esIntl ? ' <span class="sello sello-guardada">Transf. ' + esc(p.pais || 'extranjero') + '</span>' : '');
                var acc = '<button type="button" class="btn btn-chico" data-dp-dpa-word="' + esc(p.id) + '">Descargar acuerdo (.doc)</button>' +
                    (!p.dpaFirmado ? ' <button type="button" class="btn-texto" data-dp-dpa-ok="' + esc(p.id) + '">Marcar firmado</button>' : '') +
                    ' <button type="button" class="btn-texto lq-danger" data-dp-dpa-del="' + esc(p.id) + '">Quitar</button>';
                var sub = [p.servicio, p.duracion].filter(Boolean).join(' · ');
                return {
                    html: '<tr><td><strong>' + esc(p.nombre) + '</strong><br><span style="font-size:12px;color:var(--muted)">' + esc(sub) + '</span></td>' +
                        '<td class="ocultar-movil">' + esc(p.datosTratados || '-') + '</td>' +
                        '<td>' + sello + '</td>' +
                        '<td class="mono">' + fecha(p.fechaFirma) + '</td>' +
                        '<td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>',
                    card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(p.nombre) + '</strong><div>' + sello + '</div></div>' +
                        '<p class="texto-ayuda" style="margin:4px 0">' + esc(sub) + (p.datosTratados ? ' · ' + esc(p.datosTratados) : '') + '</p>' +
                        '<div class="acciones-pila" style="margin-top:8px">' + acc + '</div></div>'
                };
            });

            return '<div class="panel"><div class="panel-head"><div><h2>Proveedores externos y transferencias nube / IA</h2><p class="texto-ayuda">Todo externo que procese datos por cuenta de tu empresa requiere un acuerdo formal (DPA, Art. 15 bis). Si el servicio aloja datos fuera de Chile, decláralo para respaldar la transferencia internacional (Arts. 27 y 28).</p></div><div class="v-acciones"><button type="button" class="btn btn-chico" id="dp-btn-sugerir-dpa">Sugerir habituales</button><button type="button" class="btn btn-chico btn-primario" id="dp-btn-abrir-dpa">Agregar proveedor</button></div></div>' +
                '<div class="dp-radar-box"><div class="dp-radar-head"><span class="material-icons" aria-hidden="true">public</span><strong>Radar Nube e IA (1 clic)</strong><span class="texto-ayuda">Agrega herramientas extranjeras que ya usas y actualiza tu política web automáticamente</span></div><div class="dp-radar-chips">' + radarChips + '</div></div>' +
                '<form class="panel-cuerpo" id="dp-form-dpa" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-dpa-nom">Nombre o razón social</label><input id="dp-dpa-nom" type="text" maxlength="80" required placeholder="Ej. Estudio Contable o Software"></div>' +
                '<div class="lq-field"><label for="dp-dpa-serv">Servicio prestado</label><input id="dp-dpa-serv" type="text" maxlength="80" placeholder="Contabilidad, remuneraciones, correo"></div>' +
                '<div class="lq-field lq-span2"><label for="dp-dpa-datos">Qué datos ve este proveedor</label><input id="dp-dpa-datos" type="text" maxlength="120" placeholder="Liquidaciones, RUT, licencias médicas, clientes"></div>' +
                '<div class="lq-field"><label for="dp-dpa-pais">País donde procesa o aloja datos</label><input id="dp-dpa-pais" type="text" maxlength="50" value="Chile" placeholder="Ej. Chile o EE. UU."></div>' +
                '<div class="lq-field"><label for="dp-dpa-dur">Duración del encargo <span class="lq-opt">(opcional)</span></label><input id="dp-dpa-dur" type="text" maxlength="80" placeholder="Ej. Vigencia del contrato de servicio"></div>' +
                '<div class="lq-field"><label for="dp-dpa-fecha">Fecha firma del acuerdo <span class="lq-opt">(opcional)</span></label><input id="dp-dpa-fecha" type="date"></div>' +
                '<div class="lq-field pm-check"><label><input id="dp-dpa-intl" type="checkbox"> Implica transferencia internacional (fuera de Chile)</label></div>' +
                '<div class="lq-field pm-check"><label><input id="dp-dpa-firmado" type="checkbox"> Acuerdo de confidencialidad firmado</label></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-dpa-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Guardar proveedor</button></div></form>' +
                (rows.length
                    ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><caption class="sr-only">Proveedores externos con acceso a datos</caption><thead><tr><th scope="col">Proveedor y servicio</th><th scope="col" class="ocultar-movil">Qué datos ve</th><th scope="col">Estado</th><th scope="col">Firma</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + rows.map(function (r) { return r.html; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + rows.map(function (r) { return r.card; }).join('') + '</div>'
                    : '<div class="panel-cuerpo"><p class="vacio">Aún no agregas proveedores externos. Presiona «Sugerir habituales» o usa el Radar Nube arriba para vincular tus herramientas de inmediato.</p></div>') +
                '</div>';
        }

        function pintarInventario(est, d) {
            var activos = (est.trabajadores || []).filter(function (t) { return t.activo !== false; });
            var sinResponder = !d.checklist.ratRevisado && !d.rat.length;

            var preguntasHtml = PREGUNTAS_RAT.map(function (p) {
                var marcado = sinResponder
                    ? (p.key === 'trabajadores' ? activos.length > 0 : p.key === 'facturas')
                    : d.rat.some(function (row) { return coincidePregunta(row, p); });
                return '<label class="dp-pregunta-card">' +
                    '<input type="checkbox" name="dp-preg-rat" value="' + esc(p.key) + '"' + (marcado ? ' checked' : '') + '>' +
                    '<div class="dp-pregunta-cuerpo"><strong>' + esc(p.pregunta) + '</strong><p>' + esc(p.ayuda) + '</p><span class="dp-pregunta-meta">' + esc(p.meta) + '</span></div>' +
                    '</label>';
            }).join('');

            var rows = d.rat.map(function (r) {
                return {
                    html: '<tr><td><strong>' + esc(r.actividad) + '</strong></td><td class="ocultar-movil">' + esc(r.datosTratados || '-') + '</td><td>' + esc(r.baseLegal || '-') + '</td><td>' + esc(r.plazoConservacion || '-') + '</td><td class="celda-acciones"><button type="button" class="btn-texto lq-danger" data-dp-rat-del="' + esc(r.id) + '">Quitar</button></td></tr>',
                    card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(r.actividad) + '</strong></div><p class="texto-ayuda" style="margin:4px 0"><strong>Datos:</strong> ' + esc(r.datosTratados || '-') + '<br><strong>Motivo:</strong> ' + esc(r.baseLegal || '-') + '<br><strong>Plazo:</strong> ' + esc(r.plazoConservacion || '-') + '</p><div class="acciones-pila" style="margin-top:8px"><button type="button" class="btn-texto lq-danger" data-dp-rat-del="' + esc(r.id) + '">Quitar</button></div></div>'
                };
            });

            return '<div class="panel" style="margin-bottom:16px">' +
                '<div class="panel-head"><div><h2>Qué datos guardas en tu empresa</h2><p class="texto-ayuda">Ten claridad de qué datos almacenas, por qué motivo legal los usas y cuándo debes eliminarlos. Este inventario alimenta tu política pública (Art. 14 ter). Marca las preguntas que correspondan a tu negocio para armar tu lista automáticamente.</p></div></div>' +
                '<div class="panel-cuerpo">' +
                '<form id="dp-form-cuestionario-datos" class="dp-preguntas-lista">' +
                preguntasHtml +
                '<div class="form-acciones" style="margin-top:6px"><button type="submit" class="btn btn-primario" id="dp-btn-guardar-preguntas">Guardar y actualizar lista de datos</button></div>' +
                '</form></div></div>' +
                '<div class="panel">' +
                '<div class="panel-head"><div><h2>Lista de actividades y plazos generada</h2><p class="texto-ayuda">Puedes descargar este inventario listo para fiscalización o agregar otro proceso específico de tu negocio.</p></div><div class="v-acciones"><button type="button" class="btn btn-chico" id="dp-btn-rat-word"><span class="material-icons" aria-hidden="true">download</span>Descargar inventario (.doc)</button><button type="button" class="btn btn-chico" id="dp-btn-abrir-rat">Agregar otra actividad</button></div></div>' +
                '<form class="panel-cuerpo" id="dp-form-rat" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-rat-act">Actividad o proceso del negocio</label><input id="dp-rat-act" type="text" maxlength="80" required placeholder="Ej. Despacho a domicilio"></div>' +
                '<div class="lq-field"><label for="dp-rat-base">Motivo legal por el que guardas estos datos</label><select id="dp-rat-base">' +
                '<option value="Ejecución de contrato o entrega del servicio">Ejecución de contrato o entrega del servicio</option>' +
                '<option value="Obligación legal o tributaria (SII / Trabajo)">Obligación legal o tributaria (SII / Trabajo)</option>' +
                '<option value="Consentimiento expreso de la persona">Consentimiento expreso de la persona</option>' +
                '<option value="Seguridad de personas e instalaciones">Seguridad de personas e instalaciones</option>' +
                '</select></div>' +
                '<div class="lq-field"><label for="dp-rat-datos">Qué datos se guardan</label><input id="dp-rat-datos" type="text" maxlength="140" placeholder="Nombre, dirección de entrega y teléfono"></div>' +
                '<div class="lq-field"><label for="dp-rat-plazo">Tiempo que se conservan</label><input id="dp-rat-plazo" type="text" maxlength="80" placeholder="Ej. 1 año tras la entrega"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-rat-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Agregar a la lista</button></div></form>' +
                (rows.length
                    ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><caption class="sr-only">Lista de actividades con datos personales</caption><thead><tr><th scope="col">Actividad o proceso</th><th scope="col" class="ocultar-movil">Qué datos se guardan</th><th scope="col">Motivo legal</th><th scope="col">Tiempo que se conservan</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + rows.map(function (r) { return r.html; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + rows.map(function (r) { return r.card; }).join('') + '</div>'
                    : '<div class="panel-cuerpo"><p class="vacio">Aún no respondes las preguntas de tu negocio. Marca las casillas arriba para generar tu lista de datos en segundos.</p></div>') +
                '</div>' +
                '<div class="panel dp-panel-eipd" style="margin-top:16px">' +
                '<div class="panel-head"><div><h2>Evaluación de Impacto Express (EIPD, Art. 15 ter)</h2><p class="texto-ayuda">Si utilizas vigilancia hacia la vía pública, biometría o rastreo GPS, la Ley 21.719 exige evaluar riesgos previamente. Marca los casos que apliquen para descargar tu informe de respaldo.</p></div></div>' +
                '<div class="panel-cuerpo">' +
                '<div class="dp-eipd-grid">' +
                ['cctv', 'bio', 'gps'].map(function (k) {
                    var c = CASOS_EIPD[k];
                    return '<label class="dp-eipd-card"><input type="checkbox" id="' + esc(c.id) + '" name="dp-eipd" value="' + esc(k) + '"><div><strong>' + esc(c.titulo) + '</strong><p>' + esc(c.resumen) + '</p></div></label>';
                }).join('') +
                '</div>' +
                '<div class="form-acciones" style="margin-top:12px"><button type="button" class="btn btn-primario" id="dp-btn-descargar-eipd"><span class="material-icons" aria-hidden="true">download</span>Descargar Evaluación de Impacto (.doc)</button></div>' +
                '</div></div>';
        }

        function pintarSolicitudesYBrechas(d, hoy) {
            var ordenadas = d.solicitudesArcop.slice().sort(function (a, b) {
                if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
                if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
                return a.fechaRecepcion < b.fechaRecepcion ? -1 : 1;
            });

            var filasArcop = ordenadas.map(function (s) {
                var vence = sumarDiasIso(s.fechaRecepcion, s.prorroga ? 60 : 30);
                var restan = diasEntre(hoy, vence);
                var estadoSello;
                if (s.estado === 'respondida') {
                    estadoSello = '<span class="sello sello-emitida">Respondida (' + fecha(s.fechaRespuesta) + ')</span>';
                } else if (restan < 0) {
                    estadoSello = '<span class="sello sello-riesgo">Vencida (' + (-restan) + 'd)</span>';
                } else if (restan === 0) {
                    estadoSello = '<span class="sello sello-riesgo">Vence hoy</span>';
                } else if (restan <= 10) {
                    estadoSello = '<span class="sello sello-preparada">' + plural(restan, 'día restante', 'días restantes') + '</span>';
                } else {
                    estadoSello = '<span class="sello sello-emitida">' + plural(restan, 'día restante', 'días restantes') + '</span>';
                }
                var der = ETIQUETAS_DERECHO[s.derecho] || s.derecho;
                var acc = '<button type="button" class="btn btn-chico" data-dp-arcop-word="' + esc(s.id) + '">Descargar respuesta (.doc)</button>' +
                    (s.estado === 'pendiente' && !s.prorroga ? ' <button type="button" class="btn-texto" data-dp-arcop-prorroga="' + esc(s.id) + '">Prórroga +30d</button>' : '') +
                    (s.estado === 'pendiente' ? ' <button type="button" class="btn-texto" data-dp-arcop-ok="' + esc(s.id) + '">Marcar respondida</button>' : '') +
                    ' <button type="button" class="btn-texto lq-danger" data-dp-arcop-del="' + esc(s.id) + '">Eliminar</button>';
                return {
                    html: '<tr><td><strong>' + esc(s.nombre) + '</strong><br><span class="mono" style="font-size:12px;color:var(--muted)">' + esc(s.rut || s.correo || '') + '</span></td>' +
                        '<td>' + esc(der) + '<br><span style="font-size:12px;color:var(--muted)">' + esc(CALIDADES[s.calidad] || s.calidad) + '</span></td>' +
                        '<td class="mono">' + fecha(s.fechaRecepcion) + '<br><span style="font-size:11.5px;color:var(--muted)">Límite ' + fecha(vence) + '</span></td>' +
                        '<td>' + estadoSello + '</td>' +
                        '<td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>',
                    card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(s.nombre) + '</strong>' + estadoSello + '</div>' +
                        '<p class="texto-ayuda" style="margin:4px 0">' + esc(der) + ' · Recibida <span class="mono">' + fecha(s.fechaRecepcion) + '</span> · Límite <span class="mono">' + fecha(vence) + '</span></p>' +
                        '<div class="acciones-pila" style="margin-top:8px">' + acc + '</div></div>'
                };
            });

            var filasBrechas = d.brechas.map(function (b) {
                var cls = b.estado === 'abierta' ? 'sello-riesgo' : (b.estado === 'notificada' ? 'sello-emitida' : 'sello-guardada');
                var sello = '<span class="sello ' + cls + '">' + esc(EST_BRECHA[b.estado] || b.estado) + '</span>';
                var acc = (b.estado === 'abierta'
                    ? '<button type="button" class="btn btn-chico" data-dp-br-notif="' + esc(b.id) + '">Notificada a la Agencia</button> <button type="button" class="btn-texto" data-dp-br-cerrar="' + esc(b.id) + '">Cerrar sin riesgo</button> '
                    : '') + '<button type="button" class="btn-texto lq-danger" data-dp-br-del="' + esc(b.id) + '">Quitar</button>';
                var detalleBrecha = [b.datosComprometidos, b.naturaleza, b.afectados ? (b.afectados + ' personas') : ''].filter(Boolean).join(' · ');
                return {
                    html: '<tr><td class="mono">' + esc(b.fechaHora) + '</td><td><strong>' + esc(ORIGENES[b.origen] || b.origen) + '</strong><br><span style="font-size:12px;color:var(--muted)">' + esc(detalleBrecha) + '</span></td><td>' + sello + '</td><td class="celda-acciones"><div class="acciones-pila">' + acc + '</div></td></tr>',
                    card: '<div class="fin-card-item"><div class="fin-card-top"><strong>' + esc(ORIGENES[b.origen] || b.origen) + '</strong>' + sello + '</div><p class="texto-ayuda" style="margin:4px 0"><span class="mono">' + esc(b.fechaHora) + '</span>' + (detalleBrecha ? ' · ' + esc(detalleBrecha) : '') + '</p><div class="acciones-pila" style="margin-top:8px">' + acc + '</div></div>'
                };
            });

            return '<div class="panel" id="dp-bloque-arcop" style="margin-bottom:16px">' +
                '<div class="panel-head"><div><h2>Solicitudes de personas (Derechos ARCOPS + Bloqueo)</h2><p class="texto-ayuda">Cualquier cliente o trabajador puede pedir ver, corregir, suprimir, oponerse, portar o bloquear temporalmente sus datos (arts. 5 al 9). La Ley 21.719 da 30 días corridos para responder (prorrogables 30 días más) y 30 días hábiles para reclamar ante la Agencia.</p></div><button type="button" class="btn btn-chico btn-primario" id="dp-btn-abrir-arcop"><span class="material-icons" aria-hidden="true">add</span>Registrar solicitud recibida</button></div>' +
                '<form class="panel-cuerpo" id="dp-form-arcop" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-arc-nom">Nombre completo de quien solicita</label><input id="dp-arc-nom" type="text" maxlength="80" required></div>' +
                '<div class="lq-field"><label for="dp-arc-rut">RUT o identificación <span class="lq-opt">(opcional)</span></label><input id="dp-arc-rut" type="text" maxlength="16" data-tipo="rut" placeholder="12.345.678-9"></div>' +
                '<div class="lq-field"><label for="dp-arc-correo">Correo electrónico de respuesta <span class="lq-opt">(opcional)</span></label><input id="dp-arc-correo" type="email" maxlength="120"></div>' +
                '<div class="lq-field"><label for="dp-arc-cal">Quién es</label><select id="dp-arc-cal">' + Object.keys(CALIDADES).map(function (k) { return '<option value="' + k + '">' + esc(CALIDADES[k]) + '</option>'; }).join('') + '</select></div>' +
                '<div class="lq-field"><label for="dp-arc-der">Qué solicita</label><select id="dp-arc-der">' + Object.keys(DERECHOS).map(function (k) { return '<option value="' + k + '">' + esc(DERECHOS[k]) + '</option>'; }).join('') + '</select></div>' +
                '<div class="lq-field"><label for="dp-arc-fecha">Fecha en que recibiste la solicitud</label><input id="dp-arc-fecha" type="date" value="' + esc(hoy) + '" required></div>' +
                '<div class="lq-field lq-span2"><label for="dp-arc-notas">Detalle de la solicitud o respuesta <span class="lq-opt">(opcional)</span></label><input id="dp-arc-notas" type="text" maxlength="300" placeholder="Ej. Pide copia de sus últimas 6 liquidaciones"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-arcop-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Guardar e iniciar cronómetro (30 días)</button></div></form>' +
                (filasArcop.length
                    ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><caption class="sr-only">Solicitudes de personas registradas</caption><thead><tr><th scope="col">Titular</th><th scope="col">Qué pide</th><th scope="col">Recibida y límite</th><th scope="col">Plazo restante</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + filasArcop.map(function (f) { return f.html; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + filasArcop.map(function (f) { return f.card; }).join('') + '</div>'
                    : '<div class="panel-cuerpo"><p class="vacio">No tienes solicitudes de personas pendientes. Cuando un cliente o trabajador te pida ver o borrar sus datos, regístralo aquí para controlar el plazo legal de 30 días.</p></div>') +
                '</div>' +

                '<div class="panel" id="dp-bloque-brechas">' +
                '<div class="panel-head"><div><h2>Registro de incidentes y filtraciones (Art. 14 sexies)</h2><p class="texto-ayuda">Si ocurre un incidente de seguridad (robo de equipo, hackeo o envío por error de liquidaciones), regístralo aquí con los detalles del art. 14 sexies. La ley exige avisar a la Agencia sin dilaciones indebidas cuando haya riesgo razonable (usa 72 horas como meta operativa interna).</p></div><button type="button" class="btn btn-chico" id="dp-btn-abrir-brecha"><span class="material-icons" aria-hidden="true">warning_amber</span>Registrar incidente</button></div>' +
                '<form class="panel-cuerpo" id="dp-form-brecha" hidden style="border-bottom:1px solid var(--line);background:var(--surface-2)">' +
                '<div class="lq-grid">' +
                '<div class="lq-field"><label for="dp-br-fecha">Fecha y hora del hallazgo</label><input id="dp-br-fecha" type="text" maxlength="25" value="' + esc(hoy + ' 10:00') + '" required></div>' +
                '<div class="lq-field"><label for="dp-br-orig">Qué ocurrió</label><select id="dp-br-orig">' + Object.keys(ORIGENES).map(function (k) { return '<option value="' + k + '">' + esc(ORIGENES[k]) + '</option>'; }).join('') + '</select></div>' +
                '<div class="lq-field"><label for="dp-br-nat">Naturaleza del incidente (Art. 14 sexies)</label><select id="dp-br-nat">' + NATURALEZAS_BRECHA.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select></div>' +
                '<div class="lq-field"><label for="dp-br-efectos">Posibles efectos para las personas</label><select id="dp-br-efectos">' + EFECTOS_BRECHA.map(function (ef) { return '<option value="' + esc(ef) + '">' + esc(ef) + '</option>'; }).join('') + '</select></div>' +
                '<div class="lq-field lq-span2"><label for="dp-br-datos">Qué datos se vieron comprometidos</label><input id="dp-br-datos" type="text" maxlength="160" placeholder="Ej. Nombres y liquidaciones de 2 personas" required></div>' +
                '<div class="lq-field"><label for="dp-br-num">N° aproximado de afectados <span class="lq-opt">(opcional)</span></label><input id="dp-br-num" type="number" min="0" max="999999" placeholder="Ej. 5"></div>' +
                '<div class="lq-field pm-check"><label><input id="dp-br-notif-titular" type="checkbox"> Corresponde notificar también a las personas afectadas</label></div>' +
                '<div class="lq-field lq-span2"><label for="dp-br-med">Medidas inmediatas adoptadas</label><input id="dp-br-med" type="text" maxlength="300" placeholder="Ej. Cambio de contraseñas, bloqueo de equipo y aviso a afectados"></div>' +
                '</div><div class="form-acciones"><button type="button" class="btn-texto" id="dp-br-cancelar">Cancelar</button><button type="submit" class="btn btn-primario">Registrar en bitácora</button></div></form>' +
                (filasBrechas.length
                    ? '<div class="tabla-wrap tabla-financiera-escritorio"><table class="tabla"><caption class="sr-only">Incidentes de seguridad registrados</caption><thead><tr><th scope="col">Cuándo</th><th scope="col">Incidente y datos afectados</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + filasBrechas.map(function (b) { return b.html; }).join('') + '</tbody></table></div><div class="panel-cuerpo fin-cards-lista">' + filasBrechas.map(function (b) { return b.card; }).join('') + '</div>'
                    : '<div class="panel-cuerpo"><p class="vacio">No hay incidentes de seguridad registrados. Esta bitácora se utiliza únicamente cuando ocurra una pérdida de datos, robo de equipo o filtración.</p></div>') +
                '</div>';
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

            var destinoRaw = tab || tabActual;
            if (destinoRaw && MAPA_TABS[destinoRaw]) tabActual = MAPA_TABS[destinoRaw];
            var hoy = ctx.hoyIso(), d = dActual(), res = resumenControles(est, d, hoy);

            $('dp-kpi-avance').textContent = res.completados + ' / 4';
            $('dp-kpi-avance-sub').textContent = res.completados === 4 ? 'Empresa al día' : (res.completados === 0 ? 'Por iniciar' : 'Faltan ' + plural(4 - res.completados, 'paso', 'pasos'));
            $('dp-kpi-avance-sub').className = res.completados < 4 ? 'texto-ayuda dp-amber-texto' : 'texto-ayuda';

            $('dp-kpi-anexos').textContent = res.conAnexo + ' / ' + res.activos.length;
            $('dp-kpi-anexos-sub').textContent = res.activos.length ? (res.conAnexo < res.activos.length ? plural(res.activos.length - res.conAnexo, 'pendiente de firma', 'pendientes de firma') : 'Toda la nómina al día') : 'Sin trabajadores activos';
            $('dp-kpi-anexos-sub').className = res.activos.length && res.conAnexo < res.activos.length ? 'texto-ayuda dp-amber-texto' : 'texto-ayuda';

            $('dp-kpi-dpa').textContent = res.dpaFirmados + ' / ' + d.encargados.length;
            if ($('dp-kpi-dpa-sub')) $('dp-kpi-dpa-sub').textContent = d.encargados.length ? (res.dpaFirmados < d.encargados.length ? plural(d.encargados.length - res.dpaFirmados, 'pendiente de acuerdo', 'pendientes de acuerdo') : 'Proveedores con acuerdo') : 'Contador, software y nube';

            $('dp-kpi-arcop').textContent = String(res.arcopAbiertas);
            $('dp-kpi-arcop-sub').textContent = res.brechasAbiertas
                ? plural(res.brechasAbiertas, 'incidente abierto (sin dilaciones)', 'incidentes abiertos (sin dilaciones)')
                : (res.arcopUrgentes ? plural(res.arcopUrgentes, 'vence pronto (≤7 días)', 'vencen pronto (≤7 días)') : (res.arcopAbiertas ? 'En plazo legal de 30 días' : 'Plazo legal de 30 días'));
            $('dp-kpi-arcop').parentElement.classList.toggle('vence-pronto', res.arcopUrgentes > 0 && !res.brechasAbiertas);
            $('dp-kpi-arcop').parentElement.classList.toggle('dp-riesgo', res.brechasAbiertas > 0);

            Array.prototype.forEach.call(vista.querySelectorAll('[data-dp-tab]'), function (b) {
                var activo = b.getAttribute('data-dp-tab') === tabActual;
                b.classList.toggle('activo', activo);
                b.setAttribute('aria-selected', activo ? 'true' : 'false');
            });

            var cont = $('dp-panel-activo');
            if (tabActual === 'inicio') cont.innerHTML = pintarInicio(est, d, res);
            else if (tabActual === 'trabajadores') cont.innerHTML = pintarTrabajadores(est, d);
            else if (tabActual === 'proveedores') cont.innerHTML = pintarProveedores(d);
            else if (tabActual === 'inventario') cont.innerHTML = pintarInventario(est, d);
            else cont.innerHTML = pintarSolicitudesYBrechas(d, hoy);

            // Foco en enlace profundo hacia un sub-bloque de Solicitudes y brechas
            if (destinoRaw === 'brechas' && $('dp-bloque-brechas')) {
                var bb = $('dp-bloque-brechas');
                if (typeof bb.scrollIntoView === 'function') bb.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (destinoRaw === 'arcop' && $('dp-bloque-arcop')) {
                var ba = $('dp-bloque-arcop');
                if (typeof ba.scrollIntoView === 'function') ba.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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
                if (t.closest('#dp-btn-toggle-config') || t.closest('#dp-trab-ir-paso1')) {
                    configAbierta = t.closest('#dp-trab-ir-paso1') ? true : !configAbierta;
                    dibujar('inicio');
                    if (configAbierta && $('dp-cfg-correo')) $('dp-cfg-correo').focus();
                    return;
                }
                if (t.closest('#dp-cfg-cancelar')) {
                    configAbierta = false;
                    dibujar('inicio');
                    return;
                }
                if (t.closest('#dp-btn-politica-modal') || t.closest('#dp-btn-politica-card')) {
                    polFmt = 'texto';
                    if ($('dp-pol-estado')) { $('dp-pol-estado').className = 'lq-estado'; $('dp-pol-estado').textContent = ''; }
                    actualizarModalPolitica();
                    abrirDialogo($('dp-dialogo-politica'));
                    return;
                }
                if (t.closest('#dp-btn-canal-modal') || t.closest('#dp-btn-canal-card')) {
                    if ($('dp-can-estado')) { $('dp-can-estado').className = 'lq-estado'; $('dp-can-estado').textContent = ''; }
                    actualizarModalCanal();
                    abrirDialogo($('dp-dialogo-canal'));
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
                    var estSug = ctx.getEstado() || {};
                    var empSug = estSug.empresa || {};
                    var exist = d.encargados.map(function (x) { return x.nombre.toLowerCase(); });
                    var nomContador = empSug.estudioNombre || 'Estudio Contable / Contador(a)';
                    var sugs = [
                        { nombre: nomContador, servicio: 'Contabilidad y declaraciones mensuales', datosTratados: 'Liquidaciones, sueldos, RUT, licencias y ventas', dpaFirmado: false, fechaFirma: '', notas: '' },
                        { nombre: 'Cálculo Laboral', servicio: 'Software de remuneraciones y gestión pyme', datosTratados: 'Nómina, contratos, liquidaciones y finiquitos', dpaFirmado: false, fechaFirma: '', notas: '' },
                        { nombre: 'Servicio de Correo y Nube', servicio: 'Correo corporativo y almacenamiento de respaldos', datosTratados: 'Documentos de clientes y trabajadores', dpaFirmado: false, fechaFirma: '', notas: '' }
                    ];
                    var agregados = 0;
                    sugs.forEach(function (s) {
                        if (exist.indexOf(s.nombre.toLowerCase()) < 0) { d.encargados.push(s); agregados++; }
                    });
                    if (!agregados) {
                        if ($('dp-estado-msg')) { $('dp-estado-msg').className = 'lq-estado'; $('dp-estado-msg').textContent = 'Los proveedores habituales ya están en tu lista.'; }
                        return;
                    }
                    guardarDatos(d, 'Agregamos los proveedores habituales para revisar su acuerdo.');
                    return;
                }

                var btnRadar = t.closest('[data-radar]');
                if (btnRadar) {
                    var rk = btnRadar.getAttribute('data-radar');
                    var rd = RADAR_NUBE.find(function (x) { return x.key === rk; });
                    if (rd) {
                        var drd = dActual();
                        var yaR = drd.encargados.some(function (p) { return (p.nombre || '').toLowerCase() === rd.nombre.toLowerCase(); });
                        if (yaR) {
                            if ($('dp-estado-msg')) { $('dp-estado-msg').className = 'lq-estado'; $('dp-estado-msg').textContent = rd.nombre + ' ya está registrado.'; }
                            return;
                        }
                        drd.encargados.push({
                            nombre: rd.nombre,
                            servicio: rd.servicio,
                            datosTratados: rd.datosTratados,
                            pais: rd.pais,
                            duracion: 'Vigencia del servicio en la nube',
                            transferenciaInternacional: true,
                            dpaFirmado: true,
                            fechaFirma: ctx.hoyIso(),
                            notas: rd.notas
                        });
                        guardarDatos(drd, rd.nombre + ' agregado al mapa internacional y reflejado en tu política.');
                    }
                    return;
                }

                if (t.closest('#dp-btn-consentimiento-bio')) { modeloConsentimientoBioWord(); return; }
                if (t.closest('#dp-btn-descargar-eipd')) {
                    var clavesEipd = Array.prototype.map.call(vista.querySelectorAll('input[name="dp-eipd"]:checked'), function (inp) { return inp.value; });
                    if (!clavesEipd.length) {
                        if ($('dp-estado-msg')) { $('dp-estado-msg').className = 'lq-estado error'; $('dp-estado-msg').textContent = 'Marca al menos un caso de riesgo (cámaras, reloj biométrico o GPS) para generar la EIPD.'; }
                        return;
                    }
                    modeloEipdWord(clavesEipd);
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
                        if (!r.ok) { $('dp-estado-msg').className = 'lq-estado error'; $('dp-estado-msg').textContent = (r.datos && r.datos.error) || 'No pudimos actualizar al trabajador.'; return; }
                        ctx.actualizarTrabajadorLocal(r.datos.trabajador);
                        actualizarInsignia();
                        $('dp-estado-msg').className = 'lq-estado ok';
                        $('dp-estado-msg').textContent = 'Firma de anexo anotada para ' + trab.nombre + '.';
                        dibujar('trabajadores');
                        if (typeof ctx.alCambiar === 'function') ctx.alCambiar();
                    });
                    return;
                }

                var dpaWord = t.closest('[data-dp-dpa-word]');
                if (dpaWord) {
                    var p = dActual().encargados.find(function (x) { return x.id === dpaWord.getAttribute('data-dp-dpa-word'); });
                    if (p) modeloDpaWord(p);
                    return;
                }
                var dpaOk = t.closest('[data-dp-dpa-ok]');
                if (dpaOk) {
                    var d2 = dActual(), idP = dpaOk.getAttribute('data-dp-dpa-ok');
                    d2.encargados.forEach(function (x) { if (x.id === idP) { x.dpaFirmado = true; x.fechaFirma = x.fechaFirma || ctx.hoyIso(); } });
                    guardarDatos(d2, 'Acuerdo con proveedor marcado como firmado.');
                    return;
                }
                var dpaDel = t.closest('[data-dp-dpa-del]');
                if (dpaDel) {
                    var d3 = dActual(), idPd = dpaDel.getAttribute('data-dp-dpa-del');
                    d3.encargados = d3.encargados.filter(function (x) { return x.id !== idPd; });
                    guardarDatos(d3, 'Proveedor quitado de la lista.');
                    return;
                }

                var arcWord = t.closest('[data-dp-arcop-word]');
                if (arcWord) {
                    var sol = dActual().solicitudesArcop.find(function (x) { return x.id === arcWord.getAttribute('data-dp-arcop-word'); });
                    if (sol) modeloRespuestaArcopWord(sol);
                    return;
                }
                var arcProrr = t.closest('[data-dp-arcop-prorroga]');
                if (arcProrr) {
                    var da = dActual(), idA = arcProrr.getAttribute('data-dp-arcop-prorroga');
                    da.solicitudesArcop.forEach(function (x) { if (x.id === idA) x.prorroga = true; });
                    guardarDatos(da, 'Aplicamos prórroga legal única de 30 días adicionales.');
                    return;
                }
                var arcOk = t.closest('[data-dp-arcop-ok]');
                if (arcOk) {
                    var da2 = dActual(), idA2 = arcOk.getAttribute('data-dp-arcop-ok');
                    da2.solicitudesArcop.forEach(function (x) { if (x.id === idA2) { x.estado = 'respondida'; x.fechaRespuesta = ctx.hoyIso(); } });
                    guardarDatos(da2, 'Solicitud marcada como respondida.');
                    return;
                }
                var arcDel = t.closest('[data-dp-arcop-del]');
                if (arcDel) {
                    var da3 = dActual(), idA3 = arcDel.getAttribute('data-dp-arcop-del');
                    da3.solicitudesArcop = da3.solicitudesArcop.filter(function (x) { return x.id !== idA3; });
                    guardarDatos(da3, 'Solicitud eliminada.');
                    return;
                }

                var brNotif = t.closest('[data-dp-br-notif]') || t.closest('[data-dp-br-cerrar]');
                if (brNotif) {
                    var db = dActual(), esN = !!t.closest('[data-dp-br-notif]'), idB = brNotif.getAttribute(esN ? 'data-dp-br-notif' : 'data-dp-br-cerrar');
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
                    guardarDatos(dr2, 'Actividad quitada de tu lista.');
                }
            });

            vista.addEventListener('submit', function (e) {
                e.preventDefault();
                var f = e.target;
                if (f.id === 'dp-form-config') {
                    var d = dActual();
                    d.correoPrivacidad = $('dp-cfg-correo').value.trim();
                    d.responsableDatos = $('dp-cfg-resp').value.trim();
                    configAbierta = false;
                    guardarDatos(d, 'Correo y responsable de privacidad guardados.');
                } else if (f.id === 'dp-form-dpa') {
                    var dd = dActual();
                    var fechaF = $('dp-dpa-fecha').value;
                    var paisDpa = ($('dp-dpa-pais').value || 'Chile').trim();
                    dd.encargados.push({
                        nombre: $('dp-dpa-nom').value.trim(),
                        servicio: $('dp-dpa-serv').value.trim(),
                        datosTratados: $('dp-dpa-datos').value.trim(),
                        pais: paisDpa,
                        duracion: $('dp-dpa-dur').value.trim(),
                        transferenciaInternacional: $('dp-dpa-intl').checked || !/^chile$/i.test(paisDpa),
                        dpaFirmado: $('dp-dpa-firmado').checked || !!fechaF,
                        fechaFirma: fechaF,
                        notas: ''
                    });
                    guardarDatos(dd, 'Proveedor agregado.');
                } else if (f.id === 'dp-form-cuestionario-datos') {
                    var dc = dActual();
                    var marcados = {};
                    Array.prototype.forEach.call(f.querySelectorAll('input[name="dp-preg-rat"]:checked'), function (inp) {
                        marcados[inp.value] = true;
                    });
                    // Conservar actividades agregadas manualmente y regenerar las de preguntas marcadas
                    var personalizadas = dc.rat.filter(function (row) { return !esPreguntaAutomatica(row); });
                    var nuevas = [];
                    PREGUNTAS_RAT.forEach(function (p) {
                        if (marcados[p.key]) nuevas.push(Object.assign({}, p.rat));
                    });
                    dc.rat = nuevas.concat(personalizadas).slice(0, 25);
                    dc.checklist.ratRevisado = true;
                    guardarDatos(dc, 'Lista de datos actualizada con tus respuestas.');
                } else if (f.id === 'dp-form-arcop') {
                    var da = dActual();
                    da.solicitudesArcop.push({
                        nombre: $('dp-arc-nom').value.trim(),
                        rut: $('dp-arc-rut').value.trim(),
                        correo: $('dp-arc-correo').value.trim(),
                        calidad: $('dp-arc-cal').value,
                        derecho: $('dp-arc-der').value,
                        fechaRecepcion: $('dp-arc-fecha').value,
                        prorroga: false,
                        estado: 'pendiente',
                        fechaRespuesta: '',
                        notas: $('dp-arc-notas').value.trim()
                    });
                    guardarDatos(da, 'Solicitud registrada con control de 30 días.');
                } else if (f.id === 'dp-form-brecha') {
                    var db = dActual();
                    db.checklist.protocoloBrechas = true;
                    db.brechas.push({
                        fechaHora: $('dp-br-fecha').value.trim(),
                        origen: $('dp-br-orig').value,
                        naturaleza: $('dp-br-nat').value,
                        efectos: $('dp-br-efectos').value,
                        datosComprometidos: $('dp-br-datos').value.trim(),
                        afectados: ($('dp-br-num').value || '').trim(),
                        notificarTitulares: $('dp-br-notif-titular').checked,
                        medidas: $('dp-br-med').value.trim(),
                        estado: 'abierta',
                        fechaNotificacion: ''
                    });
                    guardarDatos(db, 'Incidente registrado (reportar sin dilaciones indebidas, Art. 14 sexies).');
                } else if (f.id === 'dp-form-rat') {
                    var dr = dActual();
                    dr.checklist.ratRevisado = true;
                    dr.rat.push({
                        actividad: $('dp-rat-act').value.trim(),
                        baseLegal: $('dp-rat-base').value.trim(),
                        datosTratados: $('dp-rat-datos').value.trim(),
                        plazoConservacion: $('dp-rat-plazo').value.trim()
                    });
                    guardarDatos(dr, 'Actividad agregada a la lista.');
                }
            });

            // Eventos de modales (Politica web y Canal de solicitudes)
            var dlgPol = $('dp-dialogo-politica');
            if (dlgPol && !dlgPol.dataset.enlazado) {
                dlgPol.dataset.enlazado = '1';
                dlgPol.addEventListener('click', function (e) {
                    var t = e.target;
                    if (t.closest('#dp-pol-cerrar') || t.closest('#dp-pol-cerrar-btn')) { cerrarDialogo(dlgPol); return; }
                    if (t.closest('#dp-pol-ir-paso1')) {
                        cerrarDialogo(dlgPol);
                        configAbierta = true;
                        dibujar('inicio');
                        if ($('dp-cfg-correo')) $('dp-cfg-correo').focus();
                        return;
                    }
                    var fmtBtn = t.closest('[data-dp-pol-fmt]');
                    if (fmtBtn) {
                        polFmt = fmtBtn.getAttribute('data-dp-pol-fmt');
                        actualizarModalPolitica();
                        return;
                    }
                    if (t.closest('#dp-btn-copiar-politica-txt')) {
                        copiarTexto(construirPoliticaWeb().texto, $('dp-pol-estado'), 'Política en texto copiada al portapapeles.');
                        return;
                    }
                    if (t.closest('#dp-btn-copiar-politica-html')) {
                        copiarTexto(construirPoliticaWeb().html, $('dp-pol-estado'), 'Código HTML de la política copiado.');
                    }
                });
            }

            var dlgCan = $('dp-dialogo-canal');
            if (dlgCan && !dlgCan.dataset.enlazado) {
                dlgCan.dataset.enlazado = '1';
                dlgCan.addEventListener('click', function (e) {
                    var t = e.target;
                    if (t.closest('#dp-can-cerrar')) { cerrarDialogo(dlgCan); return; }
                    if (t.closest('#dp-can-ir-paso1')) {
                        cerrarDialogo(dlgCan);
                        configAbierta = true;
                        dibujar('inicio');
                        if ($('dp-cfg-correo')) $('dp-cfg-correo').focus();
                        return;
                    }
                    if (t.closest('#dp-can-registrar')) {
                        cerrarDialogo(dlgCan);
                        dibujar('solicitudes');
                        if ($('dp-form-arcop')) { $('dp-form-arcop').hidden = false; $('dp-arc-nom').focus(); }
                        return;
                    }
                    if (t.closest('#dp-btn-copiar-enlace-canal')) {
                        var c = construirCanalAtencion();
                        if (c.mailto) copiarTexto(c.mailto, $('dp-can-estado'), 'Enlace directo de atención copiado.');
                        return;
                    }
                    if (t.closest('#dp-btn-copiar-canal-wa')) {
                        var cw = construirCanalAtencion();
                        if (cw.textoWa) copiarTexto(cw.textoWa, $('dp-can-estado'), 'Texto para WhatsApp y pie de página copiado.');
                    }
                });
            }
        }

        enlazarEventos();
        return {
            dibujar: dibujar,
            actualizarInsignia: actualizarInsignia,
            TAB_VALIDOS: Object.keys(MAPA_TABS),
            construirPoliticaWeb: construirPoliticaWeb,
            construirCanalAtencion: construirCanalAtencion
        };
    }

    window.CLPymeDatosLey = { montarUI: montarUI, PREGUNTAS_RAT: PREGUNTAS_RAT, MAPA_TABS: MAPA_TABS };
})();
