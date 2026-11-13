/**
 * Motor interactivo del Generador de Anexo de Contrato de Trabajo (Chile 2026).
 * Art. 11 del Código del Trabajo: toda modificación del contrato individual debe consignarse por escrito.
 * Reutiliza window.FiniquitoDocx para generar .docx editable sin dependencias externas.
 */
(function (window, document) {
    'use strict';

    var STORAGE_KEY = 'anexo_contrato_builder_state_v1';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var unlockedOrder = null;

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtCLP(num) {
        var n = Math.round(Number(num) || 0);
        return '$' + n.toLocaleString('es-CL');
    }

    function fmtFechaLarga(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '____ de ____________ de 2026';
        var parts = iso.split('-');
        var y = parts[0];
        var m = parseInt(parts[1], 10) - 1;
        var d = parseInt(parts[2], 10);
        return d + ' de ' + (MESES[m] || '') + ' de ' + y;
    }

    function val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function checked(id) {
        var el = document.getElementById(id);
        return !!(el && el.checked);
    }

    function numeroOrdinal(idx) {
        var ords = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO'];
        return ords[idx] || ('CLÁUSULA ' + (idx + 1));
    }

    function recolectarDatos() {
        return {
            ciudad: val('anexo-ciudad') || 'Santiago',
            fechaAnexo: val('anexo-fecha'),
            fechaContratoBase: val('contrato-fecha-base'),
            empresaNombre: val('empresa-razon'),
            empresaRut: val('empresa-rut'),
            empresaDomicilio: val('empresa-domicilio'),
            empresaRep: val('empresa-rep'),
            empresaRepRut: val('empresa-rep-rut'),
            empresaEmail: val('empresa-email'),
            trabNombre: val('trab-nombre'),
            trabRut: val('trab-rut'),
            trabDomicilio: val('trab-domicilio'),
            trabCargoActual: val('trab-cargo-actual'),

            incSueldo: checked('chk-mod-sueldo'),
            sueldoNuevo: Number(val('sueldo-nuevo').replace(/\D/g, '')) || 0,
            gratificacionModo: val('gratificacion-modo') || 'mantener',
            asignacionColacion: Number(val('asignacion-colacion').replace(/\D/g, '')) || 0,
            asignacionMovilizacion: Number(val('asignacion-movilizacion').replace(/\D/g, '')) || 0,

            incCargo: checked('chk-mod-cargo'),
            cargoNuevo: val('cargo-nuevo'),
            funcionesNuevas: val('funciones-nuevas'),
            lugarNuevo: val('lugar-nuevo'),

            incJornada: checked('chk-mod-jornada'),
            horasSemanales: val('jornada-horas') || '42',
            horarioDetalle: val('jornada-detalle'),
            colacionMinutos: val('jornada-colacion') || '60',

            incPlazo: checked('chk-mod-plazo'),
            plazoTipo: val('plazo-tipo') || 'indefinido',
            plazoNuevaFecha: val('plazo-nueva-fecha'),

            incTeletrabajo: checked('chk-mod-teletrabajo'),
            teleModalidad: val('tele-modalidad') || 'hibrida',
            teleDiasRemoto: val('tele-dias-remoto'),
            teleAsignacionInternet: Number(val('tele-asignacion').replace(/\D/g, '')) || 0,
            teleDesconexion: val('tele-desconexion') || '12 horas continuas entre jornadas',

            incLibre: checked('chk-mod-libre'),
            libreTitulo: val('libre-titulo') || 'Acuerdo Complementario',
            libreTexto: val('libre-texto'),

            fechaVigencia: val('anexo-vigencia')
        };
    }

    function construirHtmlAnexo(d) {
        var modCount = [d.incSueldo, d.incCargo, d.incJornada, d.incPlazo, d.incTeletrabajo, d.incLibre].filter(Boolean).length;
        var ciudadTxt = esc(d.ciudad || 'Santiago');
        var fechaTxt = fmtFechaLarga(d.fechaAnexo);
        var fechaBaseTxt = fmtFechaLarga(d.fechaContratoBase);
        var empNombre = esc(d.empresaNombre || '[RAZÓN SOCIAL DE LA EMPRESA]');
        var empRut = esc(d.empresaRut || '[XX.XXX.XXX-X]');
        var empDom = esc(d.empresaDomicilio || '[DOMICILIO COMPLETO DE LA EMPRESA]');
        var empRep = esc(d.empresaRep || '[NOMBRE REPRESENTANTE LEGAL]');
        var empRepRut = esc(d.empresaRepRut || '[XX.XXX.XXX-X]');
        var trabNombre = esc(d.trabNombre || '[NOMBRE COMPLETO DEL TRABAJADOR/A]');
        var trabRut = esc(d.trabRut || '[XX.XXX.XXX-X]');
        var trabDom = esc(d.trabDomicilio || '[DOMICILIO DEL TRABAJADOR/A]');
        var cargoActual = esc(d.trabCargoActual || '[CARGO ACTUAL]');
        var vigenciaTxt = fmtFechaLarga(d.fechaVigencia || d.fechaAnexo);

        var clausulas = [];

        clausulas.push(
            '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Antecedentes del contrato vigente:</strong> Las partes dejan constancia de que mantienen vigente un contrato individual de trabajo suscrito con fecha ' +
            fechaBaseTxt + ', en virtud del cual el/la Trabajador(a) presta servicios en el cargo de <strong>' + cargoActual + '</strong>. En cumplimiento de lo dispuesto en el artículo 11 del Código del Trabajo, las partes acuerdan modificar y complementar dicho instrumento mediante el presente Anexo de Contrato de Trabajo.</p>'
        );

        if (d.incSueldo) {
            var sueldoStr = d.sueldoNuevo > 0 ? fmtCLP(d.sueldoNuevo) : '[MONTO EN PESOS]';
            var gratTxt = '';
            if (d.gratificacionModo === 'tope-475') {
                gratTxt = ' Adicionalmente, se estipula gratificación legal mensual garantizada equivalente al 25% de las remuneraciones imponibles devengadas, con tope mensual de un duodécimo de 4,75 Ingresos Mínimos Mensuales conforme al artículo 50 del Código del Trabajo.';
            } else if (d.gratificacionModo === 'art-47') {
                gratTxt = ' La gratificación legal se regirá conforme a las utilidades líquidas de la empresa según el artículo 47 del Código del Trabajo.';
            } else {
                gratTxt = ' Se mantienen inalteradas las demás estipulaciones vigentes sobre gratificación legal.';
            }
            var asigParts = [];
            if (d.asignacionColacion > 0) asigParts.push('asignación de colación no imponible de ' + fmtCLP(d.asignacionColacion) + ' mensuales');
            if (d.asignacionMovilizacion > 0) asigParts.push('asignación de movilización no imponible de ' + fmtCLP(d.asignacionMovilizacion) + ' mensuales');
            var asigTxt = asigParts.length ? (' Asimismo, se fija una ' + asigParts.join(' y una ') + ', de acuerdo con el artículo 41 inciso 2° del Código del Trabajo.') : '';

            clausulas.push(
                '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Modificación de remuneración:</strong> A contar de la fecha de vigencia del presente anexo, el sueldo base mensual bruto pactado para el/la Trabajador(a) será de <strong>' +
                esc(sueldoStr) + '</strong>, pagadero por mes vencido dentro de los últimos cinco días hábiles del mes respectivo mediante transferencia electrónica a la cuenta informada por el/la Trabajador(a).' +
                gratTxt + asigTxt + '</p>'
            );
        }

        if (d.incCargo) {
            var cNuevo = esc(d.cargoNuevo || '[NUEVO CARGO]');
            var funcs = esc(d.funcionesNuevas || 'las funciones propias del nuevo cargo asignado y aquellas directamente conexas que permitan la correcta operación del área');
            var lugarTxt = d.lugarNuevo ? (' Asimismo, las partes acuerdan que los servicios se prestarán principalmente en <strong>' + esc(d.lugarNuevo) + '</strong>.') : '';
            clausulas.push(
                '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Cambio de cargo, funciones y lugar de trabajo:</strong> Por mutuo acuerdo de las partes, el/la Trabajador(a) pasará a desempeñarse en el cargo de <strong>' +
                cNuevo + '</strong>, asumiendo principalmente las siguientes funciones y responsabilidades: ' + funcs + '.' + lugarTxt + '</p>'
            );
        }

        if (d.incJornada) {
            var hrs = esc(d.horasSemanales || '42');
            var col = esc(d.colacionMinutos || '60');
            var det = esc(d.horarioDetalle || ('Lunes a viernes, distribuyendo las ' + hrs + ' horas semanales de forma uniforme de acuerdo con la jornada ordinaria pactada por la empresa.'));
            clausulas.push(
                '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Modificación de jornada laboral (Ley N° 21.561):</strong> Las partes acuerdan adecuar la jornada ordinaria de trabajo a un total de <strong>' +
                hrs + ' horas semanales</strong>, en conformidad con el artículo 22 del Código del Trabajo y la gradualidad de la Ley N° 21.561. Dicha jornada se distribuirá en los siguientes días y horarios: ' +
                det + ' El/la Trabajador(a) dispondrá de un descanso diario intermedio para colación de <strong>' + col + ' minutos</strong>, período que no se imputará a la jornada trabajada.</p>'
            );
        }

        if (d.incPlazo) {
            if (d.plazoTipo === 'indefinido') {
                clausulas.push(
                    '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Transformación a contrato indefinido:</strong> Las partes convienen expresamente en transformar el contrato individual de trabajo vigente, pactado originalmente a plazo fijo, en un <strong>contrato de duración indefinida</strong>, reconociéndose para todos los efectos legales la antigüedad laboral continua desde la fecha de ingreso original indicada en el contrato base.</p>'
                );
            } else {
                var nFecha = fmtFechaLarga(d.plazoNuevaFecha);
                clausulas.push(
                    '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Prórroga de plazo fijo:</strong> En conformidad con lo establecido en el artículo 159 N° 4 del Código del Trabajo, las partes acuerdan prorrogar por única vez el contrato de trabajo a plazo fijo hasta el día <strong>' +
                    nFecha + '</strong>, fecha en que concluirá salvo estipulación escrita en contrario o verificación de causales legales de término.</p>'
                );
            }
        }

        if (d.incTeletrabajo) {
            var modTxt = d.teleModalidad === 'total'
                ? 'modalidad de teletrabajo o trabajo a distancia total (100% remoto)'
                : ('modalidad híbrida combinando trabajo presencial y trabajo a distancia (' + esc(d.teleDiasRemoto || 'días remotos definidos semanalmente según coordinación escrita') + ')');
            var asigTeleTxt = d.teleAsignacionInternet > 0
                ? (' El Empleador proporcionará o reembolsará una asignación mensual de ' + fmtCLP(d.teleAsignacionInternet) + ' destinada a compensar costos operacionales de conectividad, internet y energía eléctrica conforme al artículo 152 quáter L.')
                : ' El Empleador proveerá los equipos, herramientas y materiales necesarios para el desempeño seguro de las labores, asumiendo los costos de operación y mantenimiento conforme al artículo 152 quáter L del Código del Trabajo.';
            clausulas.push(
                '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Pacto de trabajo a distancia o teletrabajo (Ley N° 21.220):</strong> Conforme al Capítulo IX del Título II del Libro I del Código del Trabajo, las partes acuerdan que los servicios se prestarán bajo <strong>' +
                modTxt + '</strong>, desde el domicilio particular del Trabajador(a) u otro lugar libremente elegido en territorio nacional. El/la Trabajador(a) gozará en todo caso de su derecho irrenunciable a <strong>desconexión digital mínima de ' +
                esc(d.teleDesconexion) + '</strong>, lapso en el cual no estará obligado a responder comunicaciones ni requerimientos laborales.' + asigTeleTxt + ' El mecanismo de supervisión y control será la entrega de objetivos y reportes periódicos ante su jefatura directa, respetando el deber de protección de la vida y salud conforme al DS N° 18.</p>'
            );
        }

        if (d.incLibre) {
            clausulas.push(
                '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. ' + esc(d.libreTitulo) + ':</strong> ' +
                esc(d.libreTexto || '[Escriba aquí los acuerdos adicionales pactados por las partes conforme al Código del Trabajo.]') + '</p>'
            );
        }

        if (modCount === 0) {
            clausulas.push(
                '<p class="leading-relaxed mb-3 italic text-slate-600">Selecciona al menos un bloque de modificación en el formulario de la izquierda (sueldo, cargo, jornada, plazo, teletrabajo o acuerdo complementario) para generar las cláusulas del anexo.</p>'
            );
        }

        clausulas.push(
            '<p class="leading-relaxed mb-3"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Vigencia y subsistencia de estipulaciones:</strong> Las modificaciones contenidas en este Anexo regirán a contar del <strong>' +
            vigenciaTxt + '</strong>. En todo lo no modificado expresamente por el presente instrumento, continuarán plenamente vigentes todas las demás cláusulas y obligaciones establecidas en el contrato individual de trabajo primitivo y sus anexos anteriores.</p>'
        );

        clausulas.push(
            '<p class="leading-relaxed mb-4"><strong class="font-bold">' + numeroOrdinal(clausulas.length) + '. Registro y ejemplares:</strong> El presente Anexo se extiende y firma en dos ejemplares de idéntico tenor y fecha, quedando uno en poder de cada parte. El Empleador actualizará el registro electrónico laboral en el portal de la Dirección del Trabajo (Mi DT) dentro del plazo legal de 15 días corridos desde su suscripción.</p>'
        );

        return (
            '<div class="space-y-3 text-slate-900 font-serif text-[13px] leading-relaxed">' +
                '<h2 class="text-center font-bold uppercase text-base tracking-wide mb-3">ANEXO DE CONTRATO INDIVIDUAL DE TRABAJO</h2>' +
                '<div data-docx="recuadro" class="p-3 bg-slate-50 border border-slate-300 rounded mb-3 text-xs">' +
                    '<p class="mb-1"><strong class="font-bold">Lugar y Fecha:</strong> ' + ciudadTxt + ', ' + fechaTxt + '</p>' +
                    '<p class="mb-1"><strong class="font-bold">Empleador:</strong> ' + empNombre + ' (RUT ' + empRut + ')</p>' +
                    '<p class="mb-0"><strong class="font-bold">Trabajador(a):</strong> ' + trabNombre + ' (RUT ' + trabRut + ')</p>' +
                '</div>' +
                '<p class="leading-relaxed mb-3">En ' + ciudadTxt + ', a ' + fechaTxt + ', entre <strong>' + empNombre + '</strong>, RUT <strong>' + empRut + '</strong>, representada legalmente por don/doña <strong>' + empRep + '</strong>, RUT <strong>' + empRepRut + '</strong>, ambos domiciliados en ' + empDom + ', en adelante el <strong>"Empleador"</strong>; y don/doña <strong>' + trabNombre + '</strong>, RUT <strong>' + trabRut + '</strong>, domiciliado(a) en ' + trabDom + ', en adelante el <strong>"Trabajador(a)"</strong>; se ha convenido celebrar el siguiente Anexo de Contrato Individual de Trabajo:</p>' +
                clausulas.join('') +
                '<div data-docx="firmas" class="grid grid-cols-2 gap-8 text-center text-xs mt-10 pt-4">' +
                    '<div>' +
                        '<p class="font-bold uppercase pt-2 border-t border-slate-900">' + empNombre + '</p>' +
                        '<p>RUT ' + empRut + '</p>' +
                        '<p>p.p. Empleador</p>' +
                    '</div>' +
                    '<div>' +
                        '<p class="font-bold uppercase pt-2 border-t border-slate-900">' + trabNombre + '</p>' +
                        '<p>RUT ' + trabRut + '</p>' +
                        '<p>Trabajador(a)</p>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderPreview() {
        var datos = recolectarDatos();
        var bodyEl = document.getElementById('notary-document-body');
        if (bodyEl) bodyEl.innerHTML = construirHtmlAnexo(datos);

        var activeChips = [];
        if (datos.incSueldo) activeChips.push('Sueldo / Haberes');
        if (datos.incCargo) activeChips.push('Cargo / Lugar');
        if (datos.incJornada) activeChips.push('Jornada ' + (datos.horasSemanales || '42') + 'h');
        if (datos.incPlazo) activeChips.push(datos.plazoTipo === 'indefinido' ? 'Paso a Indefinido' : 'Prórroga Plazo Fijo');
        if (datos.incTeletrabajo) activeChips.push('Teletrabajo Ley 21.220');
        if (datos.incLibre) activeChips.push('Acuerdo Libre');

        var badge = document.getElementById('anexo-resumen-modulos');
        if (badge) {
            badge.textContent = activeChips.length ? activeChips.join(' · ') : 'Sin cláusulas marcadas';
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
        } catch (e) {}
    }

    function applyLockUI(isUnlocked) {
        var sheet = document.getElementById('notary-sheet');
        var overlay = document.getElementById('watermark-overlay');
        var btnMain = document.getElementById('btn-anexo-comprar');
        var boxUnlocked = document.getElementById('box-anexo-desbloqueado');

        if (sheet) {
            if (isUnlocked) sheet.classList.remove('protected-preview');
            else sheet.classList.add('protected-preview');
        }
        if (overlay) {
            if (isUnlocked) overlay.classList.add('hidden');
            else overlay.classList.remove('hidden');
        }
        if (btnMain && boxUnlocked) {
            if (isUnlocked) {
                btnMain.classList.add('hidden');
                boxUnlocked.classList.remove('hidden');
            } else {
                btnMain.classList.remove('hidden');
                boxUnlocked.classList.add('hidden');
            }
        }
    }

    function descargarWord() {
        var bodyEl = document.getElementById('notary-document-body');
        if (!bodyEl || !window.FiniquitoDocx) {
            alert('No se pudo inicializar el exportador de Word. Recarga la página e inténtalo de nuevo.');
            return;
        }
        var d = recolectarDatos();
        var slugName = (d.trabNombre || 'trabajador').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
        var blob = window.FiniquitoDocx.toBlob(bodyEl, 'Anexo de Contrato de Trabajo - ' + (d.trabNombre || 'Trabajador'));
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'Anexo_Contrato_' + (slugName || '2026') + '.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function imprimirPDF() {
        var bodyEl = document.getElementById('notary-document-body');
        if (!bodyEl) return;
        var win = window.open('', '_blank', 'width=850,height=1000');
        if (!win) {
            window.print();
            return;
        }
        win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Anexo de Contrato de Trabajo</title>' +
            '<style>@page{size:letter;margin:2.2cm;}body{font-family:Georgia,"Times New Roman",serif;color:#0f172a;font-size:12pt;line-height:1.55;}' +
            'h2{text-align:center;font-size:14pt;text-transform:uppercase;margin:0 0 18px;letter-spacing:.5px;}' +
            '[data-docx="recuadro"]{background:#f8fafc;border:1px solid #cbd5e1;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:10.5pt;}' +
            '[data-docx="firmas"]{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:64px;text-align:center;font-size:10pt;}' +
            '[data-docx="firmas"] p:first-child{border-top:1px solid #0f172a;padding-top:6px;font-weight:bold;text-transform:uppercase;}' +
            'p{margin:0 0 10px;text-align:justify;}</style></head><body>' +
            bodyEl.innerHTML +
            '<script>window.onload=function(){window.print();};<\/script></body></html>');
        win.document.close();
    }

    function restoreState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            var s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return false;
            var map = {
                'anexo-ciudad': s.ciudad,
                'anexo-fecha': s.fechaAnexo,
                'contrato-fecha-base': s.fechaContratoBase,
                'empresa-razon': s.empresaNombre,
                'empresa-rut': s.empresaRut,
                'empresa-domicilio': s.empresaDomicilio,
                'empresa-rep': s.empresaRep,
                'empresa-rep-rut': s.empresaRepRut,
                'empresa-email': s.empresaEmail,
                'trab-nombre': s.trabNombre,
                'trab-rut': s.trabRut,
                'trab-domicilio': s.trabDomicilio,
                'trab-cargo-actual': s.trabCargoActual,
                'sueldo-nuevo': s.sueldoNuevo || '',
                'gratificacion-modo': s.gratificacionModo,
                'asignacion-colacion': s.asignacionColacion || '',
                'asignacion-movilizacion': s.asignacionMovilizacion || '',
                'cargo-nuevo': s.cargoNuevo,
                'funciones-nuevas': s.funcionesNuevas,
                'lugar-nuevo': s.lugarNuevo,
                'jornada-horas': s.horasSemanales,
                'jornada-detalle': s.horarioDetalle,
                'jornada-colacion': s.colacionMinutos,
                'plazo-tipo': s.plazoTipo,
                'plazo-nueva-fecha': s.plazoNuevaFecha,
                'tele-modalidad': s.teleModalidad,
                'tele-dias-remoto': s.teleDiasRemoto,
                'tele-asignacion': s.teleAsignacionInternet || '',
                'tele-desconexion': s.teleDesconexion,
                'libre-titulo': s.libreTitulo,
                'libre-texto': s.libreTexto,
                'anexo-vigencia': s.fechaVigencia
            };
            Object.keys(map).forEach(function (id) {
                var el = document.getElementById(id);
                if (el && map[id] !== undefined && map[id] !== '') el.value = map[id];
            });
            var checks = {
                'chk-mod-sueldo': s.incSueldo,
                'chk-mod-cargo': s.incCargo,
                'chk-mod-jornada': s.incJornada,
                'chk-mod-plazo': s.incPlazo,
                'chk-mod-teletrabajo': s.incTeletrabajo,
                'chk-mod-libre': s.incLibre
            };
            Object.keys(checks).forEach(function (id) {
                var el = document.getElementById(id);
                if (el && typeof checks[id] === 'boolean') el.checked = checks[id];
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function syncSectionPanels() {
        var pairs = [
            ['chk-mod-sueldo', 'panel-mod-sueldo'],
            ['chk-mod-cargo', 'panel-mod-cargo'],
            ['chk-mod-jornada', 'panel-mod-jornada'],
            ['chk-mod-plazo', 'panel-mod-plazo'],
            ['chk-mod-teletrabajo', 'panel-mod-teletrabajo'],
            ['chk-mod-libre', 'panel-mod-libre']
        ];
        pairs.forEach(function (pair) {
            var chk = document.getElementById(pair[0]);
            var panel = document.getElementById(pair[1]);
            if (chk && panel) panel.classList.toggle('hidden', !chk.checked);
        });
        var plazoTipo = document.getElementById('plazo-tipo');
        var plazoFechaGroup = document.getElementById('group-plazo-fecha');
        if (plazoTipo && plazoFechaGroup) {
            plazoFechaGroup.classList.toggle('hidden', plazoTipo.value !== 'prorroga');
        }
        var teleMod = document.getElementById('tele-modalidad');
        var teleDiasGroup = document.getElementById('group-tele-dias');
        if (teleMod && teleDiasGroup) {
            teleDiasGroup.classList.toggle('hidden', teleMod.value !== 'hibrida');
        }
    }

    function mostrarModalExitoAnexo(d, porPase) {
        var modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs no-print';
        modal.innerHTML =
            '<div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">' +
                '<div class="w-14 h-14 bg-emerald-100 text-[#00382E] rounded-full flex items-center justify-center mx-auto mb-3">' +
                    '<span class="material-icons text-3xl text-emerald-700">verified</span>' +
                '</div>' +
                '<span class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full uppercase tracking-wider">' +
                    (porPase ? 'Incluido en tu Pase Pyme' : 'Pago Confirmado ($7.990 CLP)') +
                '</span>' +
                '<h2 class="text-lg font-extrabold text-slate-900 mt-2">¡Tu Anexo de Contrato está listo!</h2>' +
                '<p class="text-sm text-slate-600 mt-1 leading-relaxed">' +
                    (porPase ? 'Tu Pase Pyme está vigente.' : 'Confirmamos tu pago en Flow.cl.') + ' Descarga tu documento editable en Word (.docx) o PDF limpio sin marca de agua.' +
                '</p>' +
                '<div class="space-y-2.5 mt-5">' +
                    '<button type="button" id="modal-btn-docx" class="w-full btn-yellow-pill !py-3 !text-xs flex items-center justify-center gap-1.5 cursor-pointer">' +
                        '<span class="material-icons text-sm">description</span>' +
                        '<span>Descargar en Word (.docx editable)</span>' +
                    '</button>' +
                    '<button type="button" id="modal-btn-pdf" class="w-full btn-dark-pill !py-3 !text-xs flex items-center justify-center gap-1.5 cursor-pointer">' +
                        '<span class="material-icons text-sm">picture_as_pdf</span>' +
                        '<span>Imprimir / Guardar PDF limpio</span>' +
                    '</button>' +
                    '<button type="button" id="modal-btn-close" class="w-full py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer bg-transparent border-0">' +
                        'Continuar editando en pantalla' +
                    '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.querySelector('#modal-btn-docx').addEventListener('click', descargarWord);
        modal.querySelector('#modal-btn-pdf').addEventListener('click', imprimirPDF);
        modal.querySelector('#modal-btn-close').addEventListener('click', function () { modal.remove(); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var todayIso = new Date().toISOString().slice(0, 10);
        var fechaInput = document.getElementById('anexo-fecha');
        var vigInput = document.getElementById('anexo-vigencia');

        var restored = restoreState();
        if (!restored) {
            if (fechaInput && !fechaInput.value) fechaInput.value = todayIso;
            if (vigInput && !vigInput.value) vigInput.value = todayIso;
        }

        var params = new URLSearchParams(window.location.search);
        var preset = params.get('tipo');
        if (preset && { sueldo: 1, cargo: 1, jornada: 1, plazo: 1, teletrabajo: 1, libre: 1 }[preset]) {
            ['sueldo', 'cargo', 'jornada', 'plazo', 'teletrabajo', 'libre'].forEach(function (k) {
                var c = document.getElementById('chk-mod-' + k);
                if (c) c.checked = (k === preset);
            });
        }

        syncSectionPanels();
        renderPreview();
        applyLockUI(false);

        document.querySelectorAll('#anexo-form input, #anexo-form select, #anexo-form textarea').forEach(function (el) {
            el.addEventListener('input', function () {
                syncSectionPanels();
                renderPreview();
            });
            el.addEventListener('change', function () {
                syncSectionPanels();
                renderPreview();
            });
        });

        var btnComprar = document.getElementById('btn-anexo-comprar');
        if (btnComprar) {
            btnComprar.addEventListener('click', function () {
                var datos = recolectarDatos();
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (e) {}
                if (!window.CLCheckout) {
                    alert('No se pudo cargar el módulo de pago. Recarga la página.');
                    return;
                }
                window.CLCheckout.buyKit('anexo', {
                    nombre: datos.empresaRep || datos.empresaNombre || '',
                    empresa: datos.empresaNombre || ''
                }, { askEmail: true, defaultEmail: datos.empresaEmail || '' });
            });
        }

        var btnWord = document.getElementById('btn-anexo-docx');
        var btnPdf = document.getElementById('btn-anexo-pdf');
        if (btnWord) btnWord.addEventListener('click', descargarWord);
        if (btnPdf) btnPdf.addEventListener('click', imprimirPDF);

        if (params.get('p') === 'anexo' && params.has('sig') && window.CLCheckout) {
            window.CLCheckout.unlockFromUrl('anexo').then(function (u) {
                if (!u) return;
                unlockedOrder = u;
                applyLockUI(true);
                renderPreview();
                mostrarModalExitoAnexo(recolectarDatos(), String(u.o || '').indexOf('PYME-') === 0);
            });
        } else if (params.get('pago') === 'rechazado') {
            alert('El pago no se completó y no se realizó ningún cargo. Tu borrador quedó guardado para intentarlo nuevamente.');
        }
    });
})(window, document);
