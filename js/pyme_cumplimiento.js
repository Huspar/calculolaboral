/*
 * CalculoLaboral · Motor puro de Cumplimiento Laboral DT, Ley Karin, DS 44/2024 y Firma Simple (v1.0.0)
 * Funciona en navegador (window.CLPymeCumplimiento) y Node (require).
 */
(function (root) {
    'use strict';

    var TIPOS_FIRMA_EXCLUIDOS = ['finiquito', 'carta_161', 'carta_159_4'];
    var TIPOS_FIRMA_PERMITIDOS = [
        'contrato', 'anexo_contrato', 'pacto_horas_extra', 'anexo_datos',
        'constancia_rihs_irl', 'consentimiento_firma', 'comprobante_feriado',
        'cert_antiguedad', 'cert_remuneraciones', 'amonestacion'
    ];

    function normFecha(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso) : ''; }

    function sumarDiasCorridos(iso, n) {
        if (!normFecha(iso)) return '';
        var p = iso.split('-').map(Number);
        var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }

    function diasEntre(aIso, bIso) {
        if (!normFecha(aIso) || !normFecha(bIso)) return 0;
        var a = aIso.split('-').map(Number), b = bIso.split('-').map(Number);
        return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
    }

    function esDiaHabil(iso, F) {
        if (!normFecha(iso)) return false;
        var p = iso.split('-').map(Number);
        var dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
        if (dow === 0 || dow === 6) return false;
        if (F && typeof F.esFeriado === 'function' && F.esFeriado(iso)) return false;
        return true;
    }

    function sumarDiasHabiles(iso, n, F) {
        if (!normFecha(iso) || n < 0) return '';
        var cur = iso, cont = 0, guard = 0;
        while (cont < n && guard < 400) {
            cur = sumarDiasCorridos(cur, 1);
            guard++;
            if (esDiaHabil(cur, F)) cont++;
        }
        return cur;
    }

    // SHA-256 determinístico en JS puro (respaldo síncrono + paridad con WebCrypto)
    function sha256Sync(str) {
        var utf8 = unescape(encodeURIComponent(String(str || '')));
        var bytes = [];
        for (var i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
        var bitLen = bytes.length * 8;
        bytes.push(0x80);
        while ((bytes.length % 64) !== 56) bytes.push(0);
        var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
        for (var s = 24; s >= 0; s -= 8) bytes.push((hi >>> s) & 0xff);
        for (var s2 = 24; s2 >= 0; s2 -= 8) bytes.push((lo >>> s2) & 0xff);

        var K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

        for (var off = 0; off < bytes.length; off += 64) {
            var W = new Array(64);
            for (var j = 0; j < 16; j++) {
                W[j] = ((bytes[off + j * 4] << 24) | (bytes[off + j * 4 + 1] << 16) | (bytes[off + j * 4 + 2] << 8) | bytes[off + j * 4 + 3]) >>> 0;
            }
            for (var j2 = 16; j2 < 64; j2++) {
                var s0 = rotr(W[j2 - 15], 7) ^ rotr(W[j2 - 15], 18) ^ (W[j2 - 15] >>> 3);
                var s1 = rotr(W[j2 - 2], 17) ^ rotr(W[j2 - 2], 19) ^ (W[j2 - 2] >>> 10);
                W[j2] = (W[j2 - 16] + s0 + W[j2 - 7] + s1) >>> 0;
            }
            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (var r = 0; r < 64; r++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = (e & f) ^ ((~e) & g);
                var temp1 = (h + S1 + ch + K[r] + W[r]) >>> 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var temp2 = (S0 + maj) >>> 0;
                h = g; g = f; f = e; e = (d + temp1) >>> 0;
                d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
            }
            H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
            H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
        }
        return H.map(function (v) { return ('00000000' + v.toString(16)).slice(-8); }).join('');
    }

    function hashTextoSha256(texto) {
        var str = String(texto || '');
        try {
            if (root.crypto && root.crypto.subtle && typeof TextEncoder !== 'undefined') {
                return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
                    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('00' + b.toString(16)).slice(-2); }).join('');
                }, function () { return sha256Sync(str); });
            }
        } catch (e) { /* usa respaldo sincrono */ }
        return Promise.resolve(sha256Sync(str));
    }

    function normalizarRutUlt4(rut) {
        var limpio = String(rut || '').toUpperCase().replace(/[^0-9K]/g, '');
        return limpio.length >= 4 ? limpio.slice(-4) : limpio;
    }

    function normCumplimientoDt(raw) {
        var c = raw && typeof raw === 'object' ? raw : {};
        return {
            trabajadoresPermanentes: Math.max(0, Number(c.trabajadoresPermanentes) || 0),
            riohsVigente: !!c.riohsVigente,
            riohsFecha: String(c.riohsFecha || ''),
            riohsRegistroDtIsp: !!c.riohsRegistroDtIsp,
            rihsVigente: !!c.rihsVigente,
            rihsFecha: String(c.rihsFecha || ''),
            cphsActivo: !!c.cphsActivo,
            asistenciaSistema: String(c.asistenciaSistema || ''),
            asistenciaResolucion: String(c.asistenciaResolucion || ''),
            canalKarinActivo: !!c.canalKarinActivo,
            canalKarinMedio: String(c.canalKarinMedio || ''),
            canalKarinFecha: String(c.canalKarinFecha || ''),
            previredAlDia: !!c.previredAlDia,
            jornadaRevisada42h: !!c.jornadaRevisada42h,
            carpetaLinkNotas: String(c.carpetaLinkNotas || '')
        };
    }

    function activosDe(estado) {
        return ((estado && estado.trabajadores) || []).filter(function (t) { return t.activo !== false; });
    }

    /**
     * Evalua todos los puntos obligatorios de una Carpeta de Fiscalizacion DT
     * y separa en un anexo independiente el bloque de Ley 21.719 (fiscaliza Agencia de Proteccion de Datos).
     */
    function evaluarCarpetaDt(estado, d, hoy) {
        var activos = activosDe(estado);
        var emp = (estado && estado.empresa) || {};
        var cd = normCumplimientoDt(d && d.cumplimientoDt);
        var perm = cd.trabajadoresPermanentes > 0 ? cd.trabajadoresPermanentes : activos.length;

        var conMiDt = activos.filter(function (t) { return !!t.midtRegistrado; }).length;
        var conIrl = activos.filter(function (t) { return !!t.irlEntrega; }).length;
        var conKarin = activos.filter(function (t) { return !!t.karinEntrega; }).length;
        var conAnexoDatos = activos.filter(function (t) { return !!t.anexoDatosEntrega; }).length;
        var sobre42h = activos.filter(function (t) { return Number(t.jornadaHoras) > 42; }).length;
        var requiereRiohs = perm >= 10;
        var requiereLre = perm >= 5;
        var requiereCphs = perm > 25;
        var requiereDeptoPrev = perm > 100;

        var itemsDt = [
            {
                id: 'empresa',
                grupo: 'Contratación y Mi DT',
                titulo: 'Identificación empresa, mutualidad y representante legal',
                norma: 'Arts. 10 y 507 CT · Ley 16.744',
                estado: (emp.razonSocial && emp.rut && emp.mutual) ? 'ok' : 'pendiente',
                detalle: (emp.razonSocial && emp.rut && emp.mutual)
                    ? ('Mutual: ' + emp.mutual + (emp.direccion ? ' · ' + emp.direccion : ''))
                    : 'Completa razón social, RUT y mutualidad en Empresa.',
                ruta: 'empresa'
            },
            {
                id: 'contratos_midt',
                grupo: 'Contratación y Mi DT',
                titulo: 'Contratos escritos y registro en portal Mi DT (plazo 15 días)',
                norma: 'Arts. 9 y 9 bis CT',
                estado: !activos.length ? 'pendiente' : (conMiDt === activos.length ? 'ok' : (conMiDt > 0 ? 'parcial' : 'pendiente')),
                detalle: activos.length
                    ? (conMiDt + ' de ' + activos.length + ' trabajadores marcados como registrados en Mi DT.')
                    : 'Agrega trabajadores para controlar sus contratos y registro Mi DT.',
                ruta: 'documentos'
            },
            {
                id: 'jornada_42h',
                grupo: 'Jornada y Asistencia',
                titulo: 'Jornada ordinaria <= 42h semanales (vigente desde 26-04-2026)',
                norma: 'Ley 21.561 (próximo hito: 40h el 26-04-2028)',
                estado: sobre42h > 0 ? 'riesgo' : ((activos.length > 0 && (cd.jornadaRevisada42h || sobre42h === 0)) ? 'ok' : 'pendiente'),
                detalle: sobre42h > 0
                    ? (sobre42h + ' ficha(s) superan las 42h semanales. Regulariza con anexo de jornada.')
                    : 'Todas las fichas activas cumplen <= 42h semanales.',
                ruta: 'trabajadores'
            },
            {
                id: 'asistencia',
                grupo: 'Jornada y Asistencia',
                titulo: 'Registro diario de asistencia válido',
                norma: 'Art. 33 CT · Res. Ex. N° 38/2024 DT (si es electrónico)',
                estado: cd.asistenciaSistema ? 'ok' : 'pendiente',
                detalle: cd.asistenciaSistema
                    ? ('Sistema: ' + ({ electronico_res38: 'Electrónico Res. Ex. 38/2024', libro_papel: 'Libro foliado en papel', reloj_control: 'Reloj control con tarjetas', no_aplica: 'Exento art. 22 inc. 2°' }[cd.asistenciaSistema] || cd.asistenciaSistema) + (cd.asistenciaResolucion ? ' (' + cd.asistenciaResolucion + ')' : ''))
                    : 'Indica cómo llevas la asistencia en la pestaña Carpeta DT.',
                ruta: 'carpeta'
            },
            {
                id: 'previred_lre',
                grupo: 'Remuneraciones y Previsión',
                titulo: 'Cotizaciones previsionales pagadas (Previred)' + (requiereLre ? ' y LRE en Mi DT' : ''),
                norma: 'Art. 58 CT · DL 3.500 · Art. 515 CT (LRE desde 5 trab.)',
                estado: cd.previredAlDia ? 'ok' : 'pendiente',
                detalle: cd.previredAlDia
                    ? ('Confirmado al día' + (requiereLre ? ' · LRE obligatorio para ' + perm + ' trab.' : ''))
                    : 'Declara si tus planillas Previred están pagadas antes del día 13.',
                ruta: 'carpeta'
            },
            {
                id: 'rihs',
                grupo: 'Reglamentos e Higiene (DS 44 / CT)',
                titulo: 'RIHS · Reglamento Interno de Higiene y Seguridad (toda empresa)',
                norma: 'DS N° 44/2024 (vigente desde 1-feb-2025, reemplaza DS 40 y 54)',
                estado: cd.rihsVigente ? 'ok' : 'pendiente',
                detalle: cd.rihsVigente
                    ? ('Vigente' + (cd.rihsFecha ? ' desde ' + cd.rihsFecha : ''))
                    : 'Obligatorio sin mínimo de trabajadores para toda empresa en Chile.',
                ruta: 'carpeta'
            },
            {
                id: 'riohs',
                grupo: 'Reglamentos e Higiene (DS 44 / CT)',
                titulo: 'RIOHS · Reglamento Interno de Orden, Higiene y Seguridad (>= 10 trab. perm.)',
                norma: 'Art. 153 CT (copia a DT y Seremi Salud en 5 días)',
                estado: !requiereRiohs ? 'no_aplica' : ((cd.riohsVigente && cd.riohsRegistroDtIsp) ? 'ok' : (cd.riohsVigente ? 'parcial' : 'pendiente')),
                detalle: !requiereRiohs
                    ? ('No exigible hoy (' + perm + ' trab. permanentes; obligatorio desde 10). Mantén el RIHS del DS 44.')
                    : (cd.riohsVigente ? (cd.riohsRegistroDtIsp ? 'Vigente y depositado en DT / Seremi Salud.' : 'Vigente, pero falta marcar depósito en DT y Seremi Salud.') : 'Obligatorio desde 10 trabajadores permanentes.'),
                ruta: 'carpeta'
            },
            {
                id: 'irl',
                grupo: 'Reglamentos e Higiene (DS 44 / CT)',
                titulo: 'IRL · Información de Riesgos Laborales antes de iniciar labores (ex ODI)',
                norma: 'Art. 15 DS N° 44/2024 (entregar al contratar y al cambiar procesos)',
                estado: !activos.length ? 'pendiente' : (conIrl === activos.length ? 'ok' : (conIrl > 0 ? 'parcial' : 'pendiente')),
                detalle: activos.length
                    ? (conIrl + ' de ' + activos.length + ' trabajadores con constancia IRL firmada.')
                    : 'Agrega trabajadores para controlar entregas IRL.',
                ruta: 'documentos'
            },
            {
                id: 'karin_protocolo',
                grupo: 'Ley Karin (Ley 21.643 + DS 21/2024)',
                titulo: 'Protocolo de prevención + canal confidencial de denuncias',
                norma: 'Art. 211-A CT · DS N° 21/2024 (obligatorio para toda empresa)',
                estado: (cd.canalKarinActivo && activos.length > 0 && conKarin === activos.length) ? 'ok' : ((cd.canalKarinActivo || conKarin > 0) ? 'parcial' : 'pendiente'),
                detalle: 'Canal: ' + (cd.canalKarinActivo ? 'activo' : 'sin definir') + ' · Entregado a ' + conKarin + '/' + activos.length + ' trabajadores.',
                ruta: 'karin'
            }
        ];

        if (requiereCphs) {
            itemsDt.push({
                id: 'cphs',
                grupo: 'Reglamentos e Higiene (DS 44 / CT)',
                titulo: 'Comité Paritario de Higiene y Seguridad (CPHS, > 25 trabajadores)',
                norma: 'Ley 16.744 · DS N° 44/2024',
                estado: cd.cphsActivo ? 'ok' : 'riesgo',
                detalle: cd.cphsActivo ? 'CPHS constituido y en funcionamiento.' : 'Con más de 25 trabajadores por faena/sucursal corresponde constituir CPHS.',
                ruta: 'carpeta'
            });
        }
        if (requiereDeptoPrev) {
            itemsDt.push({
                id: 'depto_prev',
                grupo: 'Reglamentos e Higiene (DS 44 / CT)',
                titulo: 'Departamento de Prevención de Riesgos (> 100 trabajadores)',
                norma: 'Art. 66 Ley 16.744 · DS 44/2024',
                estado: 'aviso',
                detalle: 'Con más de 100 trabajadores se requiere Departamento de Prevención dirigido por experto.',
                ruta: 'carpeta'
            });
        }

        // Anexo separado: Ley 21.719 (fiscaliza Agencia de Proteccion de Datos, NO la DT)
        var dObj = d || {};
        var enc = Array.isArray(dObj.encargados) ? dObj.encargados : [];
        var dpaOk = enc.length > 0 && enc.every(function (x) { return !!x.dpaFirmado; });
        var arcopAb = (dObj.solicitudesArcop || []).filter(function (x) { return x.estado === 'pendiente'; }).length;
        var brAb = (dObj.brechas || []).filter(function (x) { return x.estado === 'abierta'; }).length;
        var anexoPrivacidad = [
            {
                id: 'datos_canal',
                titulo: 'Responsable y canal de privacidad configurado',
                estado: (dObj.correoPrivacidad && dObj.responsableDatos) ? 'ok' : 'pendiente',
                detalle: dObj.correoPrivacidad ? ('Canal: ' + dObj.correoPrivacidad) : 'Falta correo de privacidad y responsable en Datos 21.719.',
                ruta: 'datos'
            },
            {
                id: 'datos_anexos',
                titulo: 'Anexos de tratamiento de datos laborales',
                estado: !activos.length ? 'pendiente' : (conAnexoDatos === activos.length ? 'ok' : (conAnexoDatos > 0 ? 'parcial' : 'pendiente')),
                detalle: conAnexoDatos + ' de ' + activos.length + ' trabajadores con anexo de datos personales.',
                ruta: 'datos'
            },
            {
                id: 'datos_dpa',
                titulo: 'Acuerdos DPA con proveedores externos y RAT',
                estado: (dpaOk && (dObj.rat || []).length > 0) ? 'ok' : ((enc.length > 0 || (dObj.rat || []).length > 0) ? 'parcial' : 'pendiente'),
                detalle: enc.filter(function (x) { return x.dpaFirmado; }).length + ' de ' + enc.length + ' proveedores con DPA · ' + (dObj.rat || []).length + ' actividades RAT.',
                ruta: 'datos'
            },
            {
                id: 'datos_incidentes',
                titulo: 'Solicitudes ARCOP y brechas de seguridad (Art. 14 sexies)',
                estado: brAb > 0 ? 'riesgo' : (arcopAb > 0 ? 'parcial' : 'ok'),
                detalle: brAb > 0 ? (brAb + ' incidente(s) abierto(s)') : (arcopAb > 0 ? (arcopAb + ' solicitud(es) en curso') : 'Sin alertas abiertas.'),
                ruta: 'datos'
            }
        ];

        var exigibles = itemsDt.filter(function (x) { return x.estado !== 'no_aplica' && x.estado !== 'aviso'; });
        var puntosDt = exigibles.reduce(function (acc, it) {
            return acc + (it.estado === 'ok' ? 1 : it.estado === 'parcial' ? 0.5 : 0);
        }, 0);
        var pctDt = exigibles.length ? Math.round((puntosDt / exigibles.length) * 100) : 0;

        return {
            permanentes: perm,
            requiereRiohs: requiereRiohs,
            requiereLre: requiereLre,
            requiereCphs: requiereCphs,
            requiereDeptoPrev: requiereDeptoPrev,
            itemsDt: itemsDt,
            anexoPrivacidad: anexoPrivacidad,
            pctDt: pctDt,
            dtListos: exigibles.filter(function (x) { return x.estado === 'ok'; }).length,
            dtTotalExigibles: exigibles.length,
            cumplimientoDt: cd,
            hoy: hoy || ''
        };
    }

    /** Calcula los plazos legales obligatorios de una denuncia Ley Karin (DS 21/2024 + Ley 21.643). */
    function evaluarCasoKarin(caso, hoy, F) {
        var fRec = normFecha(caso && caso.fechaRecepcion);
        var venceDecision3d = fRec ? sumarDiasHabiles(fRec, 3, F) : '';
        var venceInvestigacion30d = fRec ? sumarDiasHabiles(fRec, 30, F) : '';
        var baseInf = normFecha(caso && caso.fechaInformeDt) || venceInvestigacion30d;
        var venceInformeDt2d = venceInvestigacion30d ? sumarDiasHabiles(venceInvestigacion30d, 2, F) : '';
        var basePron = normFecha(caso && caso.fechaDerivacionDt) || normFecha(caso && caso.fechaInformeDt);
        var vencePronunciamiento30d = basePron ? sumarDiasCorridos(basePron, 30) : '';
        var baseMed = normFecha(caso && caso.fechaPronunciamientoDt) || normFecha(caso && caso.fechaInformeDt);
        var venceMedidas15d = baseMed ? sumarDiasCorridos(baseMed, 15) : '';

        var vencido = false, proximo = false, hitoActivo = 'En seguimiento';
        if (caso && caso.estado !== 'cerrada' && caso.estado !== 'medidas_aplicadas') {
            if (!caso.fechaResguardo) {
                hitoActivo = 'Aplicar medidas de resguardo INMEDIATAS';
                if (hoy && fRec && hoy > fRec) vencido = true;
            } else if (caso.denunciadoInvolucraEmpleador && caso.estado !== 'derivada_dt' && !caso.fechaDerivacionDt) {
                hitoActivo = 'Derivar OBLIGATORIAMENTE a la DT (vence ' + venceDecision3d + ')';
                if (hoy && venceDecision3d) {
                    if (hoy > venceDecision3d) vencido = true;
                    else if (diasEntre(hoy, venceDecision3d) <= 1) proximo = true;
                }
            } else if (caso.estado === 'recibida' || caso.estado === 'resguardo') {
                hitoActivo = 'Iniciar investigación o derivar a DT (vence ' + venceDecision3d + ')';
                if (hoy && venceDecision3d && hoy > venceDecision3d) vencido = true;
            } else if (caso.estado === 'investigando') {
                hitoActivo = 'Término investigación máx. 30 d. hábiles sin prórroga (' + venceInvestigacion30d + ')';
                if (hoy && venceInvestigacion30d) {
                    if (hoy > venceInvestigacion30d) vencido = true;
                    else if (diasEntre(hoy, venceInvestigacion30d) <= 5) proximo = true;
                }
            } else if (caso.estado === 'informe_dt') {
                hitoActivo = 'Aplicar sanciones/medidas dentro de 15 días corridos' + (venceMedidas15d ? ' (' + venceMedidas15d + ')' : '');
                if (hoy && venceMedidas15d && hoy > venceMedidas15d) vencido = true;
            } else if (caso.estado === 'derivada_dt') {
                hitoActivo = 'En revisión por Inspección del Trabajo (30d pronunc. aprox.: ' + (vencePronunciamiento30d || 'pendiente') + ')';
            }
        } else if (caso) {
            hitoActivo = caso.estado === 'cerrada' ? 'Cerrado con respaldo documental' : 'Medidas aplicadas';
        }

        return {
            venceDecision3d: venceDecision3d,
            venceInvestigacion30d: venceInvestigacion30d,
            venceInformeDt2d: venceInformeDt2d,
            vencePronunciamiento30d: vencePronunciamiento30d,
            venceMedidas15d: venceMedidas15d,
            baseInforme: baseInf,
            vencido: vencido,
            proximo: proximo,
            hitoActivo: hitoActivo
        };
    }

    /** Diagnóstico unificado 0-100% ponderando DT + Karin + Ley 21.719. */
    function diagnosticoCumplimiento(estado, d, hoy, F) {
        var carpeta = evaluarCarpetaDt(estado, d, hoy);
        var activos = activosDe(estado);
        var dObj = d || {};
        var cd = carpeta.cumplimientoDt;
        var denuncias = Array.isArray(dObj.denunciasKarin) ? dObj.denunciasKarin : [];
        var casosAlerta = denuncias.filter(function (c) { return evaluarCasoKarin(c, hoy, F).vencido; }).length;

        // Sub-score Karin (0-100)
        var conKarin = activos.filter(function (t) { return !!t.karinEntrega; }).length;
        var ptsKarin = (cd.canalKarinActivo ? 50 : 0) + (activos.length ? Math.round((conKarin / activos.length) * 50) : 50);
        if (casosAlerta > 0) ptsKarin = Math.max(0, ptsKarin - 25);

        // Sub-score Datos 21.719 (0-100)
        var anexoMap = { ok: 1, parcial: 0.5, pendiente: 0, riesgo: 0 };
        var sumAnexo = carpeta.anexoPrivacidad.reduce(function (a, x) { return a + (anexoMap[x.estado] || 0); }, 0);
        var ptsDatos = carpeta.anexoPrivacidad.length ? Math.round((sumAnexo / carpeta.anexoPrivacidad.length) * 100) : 0;

        var score = Math.round(carpeta.pctDt * 0.45 + ptsKarin * 0.25 + ptsDatos * 0.30);
        var nivel = score >= 85 ? 'Alto (blindaje operativo)' : score >= 60 ? 'Intermedio (con brechas por cerrar)' : 'Bajo (riesgo ante fiscalización)';

        var brechas = [];
        carpeta.itemsDt.forEach(function (it) {
            if (it.estado === 'riesgo' || it.estado === 'pendiente' || it.estado === 'parcial') {
                brechas.push({ origen: 'DT / DS 44', prioridad: it.estado === 'riesgo' ? 1 : 2, titulo: it.titulo, detalle: it.detalle, ruta: it.ruta });
            }
        });
        if (casosAlerta > 0) {
            brechas.unshift({ origen: 'Ley Karin', prioridad: 0, titulo: 'Plazo de denuncia Ley Karin vencido o urgente', detalle: 'Revisa los plazos legales en la pestaña Ley Karin (resguardo inmediato / 3d / 30d).', ruta: 'karin' });
        }
        carpeta.anexoPrivacidad.forEach(function (it) {
            if (it.estado !== 'ok') {
                brechas.push({ origen: 'Ley 21.719 (Agencia)', prioridad: it.estado === 'riesgo' ? 1 : 3, titulo: it.titulo, detalle: it.detalle, ruta: 'datos' });
            }
        });
        brechas.sort(function (a, b) { return a.prioridad - b.prioridad; });

        return {
            score: score,
            nivel: nivel,
            bloques: { dt: carpeta.pctDt, karin: ptsKarin, datos: ptsDatos },
            brechasPrioritarias: brechas,
            casosKarinAlerta: casosAlerta
        };
    }

    /** Construye la matriz por trabajador para Documentos laborales > Matriz por lote y firma simple. */
    function resumenMatrizDocumentos(estado, d) {
        var activos = activosDe(estado);
        var firmas = Array.isArray(d && d.documentosFirma) ? d.documentosFirma : [];
        var pendientesFirmaTotal = 0, firmadosTotal = 0;

        var filas = activos.map(function (t) {
            var docsT = firmas.filter(function (f) { return f.trabajadorId === t.id && f.estado !== 'anulado'; });
            var pendientesT = docsT.filter(function (f) { return f.estado === 'pendiente_firma' || f.estado === 'pendiente_envio'; });
            var firmadosT = docsT.filter(function (f) { return f.estado === 'firmado'; });
            pendientesFirmaTotal += pendientesT.length;
            firmadosTotal += firmadosT.length;

            var okContrato = !!(t.fechaIngreso && t.sueldoBase > 0 && t.midtRegistrado);
            var okKarin = !!t.karinEntrega;
            var okIrl = !!t.irlEntrega;
            var okDatos = !!t.anexoDatosEntrega;
            var okFirma = !!(t.consentimientoElectronico && t.correoPersonal);
            var completados = [okContrato, okKarin, okIrl, okDatos, okFirma].filter(Boolean).length;

            return {
                trabajador: t,
                okContrato: okContrato,
                okKarin: okKarin,
                okIrl: okIrl,
                okDatos: okDatos,
                okFirma: okFirma,
                pct: Math.round((completados / 5) * 100),
                docsFirma: docsT,
                pendientesFirma: pendientesT,
                firmados: firmadosT
            };
        });

        return {
            filas: filas,
            totalTrabajadores: activos.length,
            pendientesFirmaTotal: pendientesFirmaTotal,
            firmadosTotal: firmadosTotal,
            conConsentimiento: filas.filter(function (f) { return f.okFirma; }).length
        };
    }

    function escHtml(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Genera el documento imprimible Índice / Carpeta de Fiscalización DT. */
    function construirIndiceCarpetaDtHtml(estado, d, hoy) {
        var emp = (estado && estado.empresa) || {};
        var evalDt = evaluarCarpetaDt(estado, d, hoy);
        var diag = diagnosticoCumplimiento(estado, d, hoy);
        var matriz = resumenMatrizDocumentos(estado, d);
        var etiquetaEst = { ok: 'OK / Al día', parcial: 'Parcial', pendiente: 'Pendiente', riesgo: 'Alerta / Riesgo', no_aplica: 'No exigible (<10)', aviso: 'Revisar' };

        var filasDt = evalDt.itemsDt.map(function (it) {
            return '<tr><td><strong>' + escHtml(it.grupo) + '</strong></td><td>' + escHtml(it.titulo) + '<br><small style="color:#4b5563">' + escHtml(it.norma) + '</small></td><td><strong>' + escHtml(etiquetaEst[it.estado] || it.estado) + '</strong></td><td>' + escHtml(it.detalle) + '</td></tr>';
        }).join('');

        var filasPriv = evalDt.anexoPrivacidad.map(function (it) {
            return '<tr><td>' + escHtml(it.titulo) + '</td><td><strong>' + escHtml(etiquetaEst[it.estado] || it.estado) + '</strong></td><td>' + escHtml(it.detalle) + '</td></tr>';
        }).join('');

        var filasTrab = matriz.filas.map(function (f) {
            var t = f.trabajador;
            return '<tr><td>' + escHtml(t.nombre) + '<br><small>' + escHtml(t.rut) + '</small></td><td>' + (f.okContrato ? 'OK Mi DT' : 'Pendiente') + '</td><td>' + (t.karinEntrega || 'Pendiente') + '</td><td>' + (t.irlEntrega || 'Pendiente') + '</td><td>' + (t.anexoDatosEntrega || 'Pendiente') + '</td><td>' + escHtml(t.correoPersonal || 'Sin email personal') + '</td></tr>';
        }).join('');

        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Carpeta de Fiscalización DT · ' + escHtml(emp.razonSocial || 'Empresa') + '</title>' +
            '<style>body{font-family:Calibri,Arial,sans-serif;color:#111827;margin:28px;font-size:10.5pt;line-height:1.45}h1{color:#00382E;font-size:15pt;margin:0 0 4px}h2{color:#00382E;font-size:12pt;margin:18px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top;font-size:9.5pt}th{background:#f3f6f4;color:#00382E}.meta{color:#4b5563;font-size:9.5pt}.kpi{background:#f3f6f4;padding:10px 14px;border-radius:6px;margin:10px 0}.nota{font-size:9pt;color:#4b5563;margin-top:16px}@media print{body{margin:14mm}}</style></head><body>' +
            '<h1>Índice de Carpeta de Fiscalización Laboral (DT / DS 44)</h1>' +
            '<p class="meta"><strong>' + escHtml(emp.razonSocial || 'Mi Empresa') + '</strong> · RUT ' + escHtml(emp.rut || '-') + (emp.direccion ? ' · ' + escHtml(emp.direccion + (emp.comuna ? ', ' + emp.comuna : '')) : '') + ' · Fecha emisión: ' + escHtml(hoy || '-') + '</p>' +
            '<div class="kpi"><strong>Nivel de preparación DT: ' + evalDt.pctDt + '%</strong> (' + evalDt.dtListos + '/' + evalDt.dtTotalExigibles + ' ítems exigibles al día) · Trabajadores permanentes declarados: <strong>' + evalDt.permanentes + '</strong> · Blindaje integral: <strong>' + diag.score + '%</strong></div>' +
            '<h2>1. Obligaciones laborales y de prevención fiscalizables por la DT</h2>' +
            '<table><thead><tr><th>Ámbito</th><th>Obligación y norma</th><th>Estado</th><th>Respaldo</th></tr></thead><tbody>' + filasDt + '</tbody></table>' +
            '<h2>2. Detalle por trabajador activo</h2>' +
            '<table><thead><tr><th>Trabajador</th><th>Contrato / Mi DT</th><th>Ley Karin</th><th>IRL (ex ODI)</th><th>Anexo Datos</th><th>Correo firma simple</th></tr></thead><tbody>' + (filasTrab || '<tr><td colspan="6">Sin trabajadores activos</td></tr>') + '</tbody></table>' +
            '<h2>3. Anexo separado: Protección de Datos Personales (Ley N° 21.719)</h2>' +
            '<p class="meta">Nota normativa: la Ley N° 21.719 (vigente desde el 1-dic-2026) es fiscalizada por la <strong>Agencia de Protección de Datos Personales</strong>, no por la Dirección del Trabajo. Se adjunta solo como respaldo ordenado de cumplimiento empresarial.</p>' +
            '<table><thead><tr><th>Control</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>' + filasPriv + '</tbody></table>' +
            (evalDt.cumplimientoDt.carpetaLinkNotas ? '<p><strong>Notas de ubicación de respaldos:</strong> ' + escHtml(evalDt.cumplimientoDt.carpetaLinkNotas) + '</p>' : '') +
            '<p class="nota">Documento auxiliar generado en Asistente Laboral Pyme (calculolaboral.cl). No reemplaza asesoría jurídica ni la certificación oficial de sistemas ante la DT.</p>' +
            '</body></html>';
    }

    var api = {
        TIPOS_FIRMA_EXCLUIDOS: TIPOS_FIRMA_EXCLUIDOS,
        TIPOS_FIRMA_PERMITIDOS: TIPOS_FIRMA_PERMITIDOS,
        sumarDiasCorridos: sumarDiasCorridos,
        sumarDiasHabiles: sumarDiasHabiles,
        diasEntre: diasEntre,
        esDiaHabil: esDiaHabil,
        sha256Sync: sha256Sync,
        hashTextoSha256: hashTextoSha256,
        normalizarRutUlt4: normalizarRutUlt4,
        normCumplimientoDt: normCumplimientoDt,
        evaluarCarpetaDt: evaluarCarpetaDt,
        evaluarCasoKarin: evaluarCasoKarin,
        diagnosticoCumplimiento: diagnosticoCumplimiento,
        resumenMatrizDocumentos: resumenMatrizDocumentos,
        construirIndiceCarpetaDtHtml: construirIndiceCarpetaDtHtml,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeCumplimiento = api;
})(typeof window !== 'undefined' ? window : this);
