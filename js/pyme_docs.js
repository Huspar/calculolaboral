/*
 * CalculoLaboral · documentos laborales del Asistente Pyme (v1.3.0). Funciona en el navegador (window.CLPymeDocs) y en Node.
 *
 * Once modelos de referencia que se arman con los datos guardados de la empresa y del trabajador:
 *   contratación: contrato, anexo_contrato, pacto_horas_extra, anexo_datos
 *   durante la relación: cert_antiguedad, cert_remuneraciones, comprobante_feriado, amonestacion
 *   término: carta_159_4, carta_161, finiquito
 *
 *   TIPOS                                  lista { id, titulo, descripcion, grupo }
 *   GRUPOS                                 [[id, nombre]] en el orden en que se muestran
 *   pesosEnLetras(n)                       monto en palabras ("seiscientos cincuenta mil pesos")
 *   horarioPropuesto(t)                    distribución de la jornada propuesta según la ficha (horas y días)
 *   campos(tipo)                           campos que se piden además de la ficha
 *   valoresIniciales(tipo, ctx)            valores propuestos para esos campos
 *   validar(tipo, ctx, datos)              { errores, faltaFicha, bloqueos, avisos, puedeEmitir }
 *   generar(tipo, ctx, datos, { pagada })  { titulo, html }  (pagada: false agrega la marca "Vista previa")
 *   periodosPromedio(hoy)                  los 3 meses completos anteriores (para el promedio líquido del certificado)
 *
 * ctx = { empresa, t (trabajador), hoy: 'AAAA-MM-DD', meses: { 'AAAA-MM': mes guardado }, uf, F (feriados), vac (registros de vacaciones) }
 *
 * Finiquito: feriado pendiente (saldo del registro de vacaciones a la fecha de término) más el proporcional desde el último
 * aniversario (15 o 20 días hábiles al año, art. 73), convertido a días corridos desde el día siguiente al término
 * (sábados, domingos y feriados que caen en el período se suman) y pagado con la remuneración mensual / 30. Indemnización por
 * años de servicio y sustitutiva del aviso solo con el art. 161 (arts. 162, 163 y 172).
 *
 * Reglas
 *  - Un documento solo se emite con todos sus campos obligatorios: no quedan corchetes ni espacios en blanco.
 *  - Lo que escribe la persona se escapa antes de entrar al HTML.
 *  - Contrato (art. 10): lugar y fecha, partes con nacionalidad y fechas de nacimiento e ingreso, cargo y funciones, lugar, jornada,
 *    remuneración y su pago, duración y beneficios adicionales. Anexo (art. 11): modificación por escrito firmada por ambas partes.
 *    Pacto de horas extra (arts. 31 y 32): hasta 2 horas por día, por escrito, por necesidades temporales y hasta por 3 meses.
 *  - Normas citadas (texto vigente verificado el 12-oct-2026 en la edición de octubre de 2026 del Código del Trabajo que publica la
 *    Dirección del Trabajo): art. 67 a 70 (feriado), 154 N°10 (sanciones del reglamento), 159 N°4 (plazo fijo), 161 (necesidades de la
 *    empresa), 162 (comunicación de término), 163 y 172 (indemnización y su base), 169 (efectos de la carta del art. 161).
 *  - Son modelos de referencia: llevan al pie "no constituye asesoría legal" y no prometen validez.
 */
(function (root) {
    'use strict';

    var VERSION_TEXTOS = '2026.10';
    var PIE = 'Modelo de referencia basado en la normativa vigente; no constituye asesoría legal.';
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var ORDINALES = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA', 'SÉPTIMA', 'OCTAVA', 'NOVENA', 'DÉCIMA'];
    var MIN_HECHOS_161 = 80, MIN_HECHOS_AMON = 40;
    var TOPE_UF_INDEMNIZACION = 90, TOPE_ANIOS_INDEMNIZACION = 11;

    var GRUPOS = [['contratacion', 'Contratación y cambios de contrato'], ['relacion', 'Durante la relación laboral'], ['termino', 'Término del contrato']];
    var JORNADA_MAXIMA = 42, JORNADA_PARCIAL = 30, MAX_HE_DIARIAS = 2;

    var TIPOS = [
        { id: 'contrato', grupo: 'contratacion', titulo: 'Contrato de trabajo', descripcion: 'Contrato individual con el cargo, la jornada, la remuneración y la duración de la ficha (art. 10). Se registra en Mi DT dentro de 15 días desde la firma.' },
        { id: 'anexo_contrato', grupo: 'contratacion', titulo: 'Anexo de contrato (cambio de sueldo, jornada, cargo o plazo)', descripcion: 'Deja por escrito un cambio del contrato firmado por ambas partes (art. 11): nuevo sueldo, nueva jornada, nuevo cargo, prórroga del plazo fijo o paso a indefinido.' },
        { id: 'pacto_horas_extra', grupo: 'contratacion', titulo: 'Pacto de horas extraordinarias', descripcion: 'Acuerdo escrito para trabajar horas extra por una necesidad temporal, hasta 2 horas por día y por un máximo de 3 meses (arts. 31 y 32).' },
        { id: 'cert_antiguedad', grupo: 'relacion', titulo: 'Certificado de antigüedad', descripcion: 'Acredita desde cuándo trabaja la persona en la empresa y cuánto tiempo lleva.' },
        { id: 'cert_remuneraciones', grupo: 'relacion', titulo: 'Certificado de remuneraciones', descripcion: 'Sueldo y asignaciones registrados; con el promedio líquido de los últimos 3 meses si están guardados.' },
        { id: 'comprobante_feriado', grupo: 'relacion', titulo: 'Comprobante de feriado', descripcion: 'Fecha de inicio, días hábiles, reintegro y saldo, con firma de ambas partes.' },
        { id: 'carta_159_4', grupo: 'termino', titulo: 'Carta de término por vencimiento del plazo fijo (art. 159 N°4)', descripcion: 'Comunica el término de un contrato a plazo fijo e informa el estado de las cotizaciones.' },
        { id: 'carta_161', grupo: 'termino', titulo: 'Carta de término por necesidades de la empresa (art. 161)', descripcion: 'Con los hechos, las indemnizaciones, el estado de las cotizaciones y la copia a la Inspección.' },
        { id: 'amonestacion', grupo: 'relacion', titulo: 'Amonestación escrita', descripcion: 'Deja constancia de un incumplimiento y de la obligación que se incumplió.' },
        { id: 'anexo_datos', grupo: 'contratacion', titulo: 'Anexo de protección de datos personales', descripcion: 'Anexo al contrato sobre el tratamiento de los datos del trabajador (Ley 21.719, rige desde el 1-dic-2026).' },
        { id: 'finiquito', grupo: 'termino', titulo: 'Finiquito', descripcion: 'Con el feriado pendiente y proporcional calculado desde el registro de vacaciones, las indemnizaciones si corresponden y los descuentos. Se firma ante ministro de fe.' }
    ];

    var CAUSALES_FINIQUITO = {
        '159_4': 'vencimiento del plazo convenido en el contrato (artículo 159 N°4 del Código del Trabajo)',
        '159_2': 'renuncia voluntaria del trabajador (artículo 159 N°2 del Código del Trabajo)',
        '159_1': 'mutuo acuerdo de las partes (artículo 159 N°1 del Código del Trabajo)',
        '161': 'necesidades de la empresa, establecimiento o servicio (artículo 161 inciso primero del Código del Trabajo)'
    };
    var FORMAS_PAGO = { transferencia: 'transferencia electrónica a la cuenta del Trabajador', vale_vista: 'vale vista bancario a nombre del Trabajador', cheque: 'cheque nominativo a nombre del Trabajador', efectivo: 'dinero en efectivo' };
    function vacMod() { return root.CLPymeVacaciones || (typeof require === 'function' ? require('./pyme_vacaciones') : null); }

    // ---------- utilidades ----------
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function pesos(n) { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }
    function fechaLarga(iso) { var a = String(iso).slice(0, 10).split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1] + ' de ' + a[0]; }
    function mesAnio(iso) { var a = String(iso).slice(0, 7).split('-'); return MESES[+a[1] - 1] + ' de ' + a[0]; }
    function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
    function aMs(iso) { var a = iso.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
    function dias(desde, hasta) { return Math.round((aMs(hasta) - aMs(desde)) / 86400000); }
    function esFecha(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(aMs(s)); }
    function vacio(v) { return v === undefined || v === null || String(v).trim() === ''; }
    function textoUsuario(v) { return String(v == null ? '' : v).replace(/[ \t]+/g, ' ').trim(); }
    function numDecimal(v) { var s = String(v == null ? '' : v).trim().replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(s)) return null; return Number(s); }
    function decTxt(n) { return (Math.round(n * 100) / 100).toLocaleString('es-CL', { maximumFractionDigits: 2 }); }
    function sumarDiasIso(iso, n) { var d = new Date(aMs(iso) + n * 86400000); return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function mesAnterior(iso) { var a = iso.split('-').map(Number), m = a[1] - 1, y = a[0]; if (m < 1) { m = 12; y--; } return y + '-' + dos(m); }
    function rutFmt(v) { var c = String(v || '').toUpperCase().replace(/[^0-9K]/g, ''); return c.length < 2 ? c : c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1); }
    function parrafos(texto) {
        return String(texto || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return '<p class="dc-p">' + esc(l) + '</p>'; }).join('');
    }
    function contratoTxt(c) { return c === 'plazo_fijo' ? 'a plazo fijo' : c === 'obra' ? 'por obra o faena determinada' : 'indefinido'; }
    function lugar(ctx, datos) { return (datos.ciudad ? datos.ciudad + ', ' : '') + fechaLarga(datos.fecha || ctx.hoy); }

    // Monto en palabras para los contratos y anexos ("seiscientos cincuenta mil pesos", "un millón de pesos")
    var UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
        'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    var DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    var CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    function grupoLetras(n) {
        if (n === 100) return 'cien';
        var c = Math.floor(n / 100), r = n % 100, p = [];
        if (c) p.push(CENTENAS[c]);
        if (r) p.push(r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ' y ' + UNIDADES[r % 10] : ''));
        return p.join(' ');
    }
    function pesosEnLetras(monto) {
        var n = Math.round(Math.abs(Number(monto) || 0));
        if (n === 0) return 'cero pesos';
        var mill = Math.floor(n / 1000000), miles = Math.floor(n / 1000) % 1000, resto = n % 1000, p = [];
        if (mill) p.push(mill === 1 ? 'un millón' : grupoLetras(mill) + ' millones');
        if (miles) p.push(miles === 1 ? 'mil' : grupoLetras(miles) + ' mil');
        if (resto) p.push(grupoLetras(resto));
        return p.join(' ') + (mill && !miles && !resto ? ' de pesos' : n === 1 ? ' peso' : ' pesos');
    }
    function montoTxt(n) { return pesos(n) + ' (' + pesosEnLetras(n) + ')'; }
    function horaTxt(min) { return dos(Math.floor(min / 60) % 24) + ':' + dos(min % 60); }
    // Distribución propuesta: jornada de la ficha repartida en partes iguales entre 5 o 6 días, desde las 08:30, con colación de 60 minutos si el día pasa de 5 horas
    function horarioPropuesto(t) {
        var horas = Math.min(JORNADA_MAXIMA, Math.max(1, Number(t && t.jornadaHoras) || JORNADA_MAXIMA)), seis = t && t.distribucion === '6';
        var diaria = Math.round(horas * 60 / (seis ? 6 : 5)), colacion = diaria > 300 ? 60 : 0, inicio = 8 * 60 + 30;
        return (seis ? 'de lunes a sábado' : 'de lunes a viernes') + ', de ' + horaTxt(inicio) + ' a ' + horaTxt(inicio + diaria + colacion) + ' horas' +
            (colacion ? ', con un descanso de ' + colacion + ' minutos para colación, que no se considera trabajado' : '');
    }
    function sumarMesesIso(iso, n) {
        var a = iso.split('-').map(Number), x = a[0] * 12 + (a[1] - 1) + n, y = Math.floor(x / 12), m = x % 12;
        var ult = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        return y + '-' + dos(m + 1) + '-' + dos(Math.min(a[2], ult));
    }

    // Años, meses y días completos entre dos fechas
    function antiguedad(desde, hasta) {
        // Meses completos desde la fecha de inicio (un día 31 se lleva al último día del mes más corto) y los días que sobran
        var d = desde.split('-').map(Number), h = hasta.split('-').map(Number);
        var total = (h[0] - d[0]) * 12 + (h[1] - d[1]);
        function conMeses(n) {
            var anio = d[0] + Math.floor((d[1] - 1 + n) / 12), mes = (d[1] - 1 + n) % 12;
            var ult = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
            return Date.UTC(anio, mes, Math.min(d[2], ult));
        }
        var fin = Date.UTC(h[0], h[1] - 1, h[2]);
        while (total > 0 && conMeses(total) > fin) total--;
        var dd = total >= 0 ? Math.round((fin - conMeses(total)) / 86400000) : 0;
        return { anios: Math.floor(Math.max(0, total) / 12), meses: Math.max(0, total) % 12, dias: Math.max(0, dd) };
    }
    function antiguedadTxt(a) {
        var p = [];
        if (a.anios) p.push(plural(a.anios, 'año', 'años'));
        if (a.meses) p.push(plural(a.meses, 'mes', 'meses'));
        if (a.dias || !p.length) p.push(plural(a.dias, 'día', 'días'));
        return p.length > 1 ? p.slice(0, -1).join(', ') + ' y ' + p[p.length - 1] : p[0];
    }

    // Indemnización por años de servicio del art. 163 inciso 2: 30 días de la última remuneración mensual por cada año de servicio y fracción
    // superior a seis meses, con tope de 11 años (330 días) y con la remuneración limitada a 90 UF (art. 172).
    function indemnizacion(ingreso, termino, base, uf) {
        var a = antiguedad(ingreso, termino);
        var anios = a.anios + (a.meses > 6 || (a.meses === 6 && a.dias > 0) ? 1 : 0);
        var antes1981 = ingreso < '1981-08-14';
        var aniosPago = a.anios < 1 ? 0 : (antes1981 ? anios : Math.min(anios, TOPE_ANIOS_INDEMNIZACION));
        var tope = uf ? Math.round(uf * TOPE_UF_INDEMNIZACION) : null;
        var baseUsada = tope && base > tope ? tope : base;
        return { antiguedad: a, aniosPago: aniosPago, base: baseUsada, topada: !!(tope && base > tope), tope: tope, porAnios: Math.round(baseUsada * aniosPago), antes1981: antes1981 };
    }

    function periodosPromedio(hoy) {
        var salida = [], p = hoy.slice(0, 7);
        for (var i = 0; i < 3; i++) { p = mesAnterior(p + '-01'); salida.push(p); }
        return salida;
    }

    // ---------- campos pedidos por cada documento ----------
    var CAMPOS = {
        contrato: [
            { k: 'fechaInicio', tipo: 'fecha', etiqueta: 'Fecha de ingreso (inicio de los servicios)', req: true, ayuda: 'La de la ficha. El contrato se firma dentro de 15 días desde el ingreso (5 días si es por obra o a plazo de menos de 30 días: art. 9).' },
            { k: 'funciones', tipo: 'textarea', etiqueta: 'Funciones del cargo', req: true, max: 1500, ayuda: 'Una función por línea, con verbos concretos. Por ejemplo: «Elaborar pan y productos de pastelería según las recetas de la empresa».' },
            { k: 'lugarTrabajo', tipo: 'texto', etiqueta: 'Lugar donde se prestan los servicios', req: true, max: 160 },
            { k: 'horario', tipo: 'textarea', etiqueta: 'Distribución de la jornada (días y horario)', req: true, max: 600, ayuda: 'Propuesta con la jornada y los días de la ficha. Ajústala al horario real; la jornada semanal sale de la ficha.' },
            { k: 'gratificacionPactada', tipo: 'texto', etiqueta: 'Gratificación convencional pactada', max: 200, ayuda: 'Solo si en la ficha la gratificación es «Pactada». Por ejemplo: «$80.000 mensuales». No puede ser inferior a la legal (art. 46).', si: { ficha: 'gratificacion', v: ['pactada'] } },
            { k: 'comisiones', tipo: 'texto', etiqueta: 'Comisiones', max: 200, ayuda: 'Si gana comisiones: cómo se calculan (por ejemplo, «3% de las ventas netas del mes»). Con comisiones corresponde además la semana corrida (art. 45).' },
            { k: 'nombreObra', tipo: 'texto', etiqueta: 'Obra o faena para la que se contrata', max: 160, si: { ficha: 'contrato', v: ['obra'] } },
            { k: 'pago', tipo: 'select', etiqueta: 'Cuándo se paga el sueldo', req: true, opciones: [['ultimo', 'El último día hábil de cada mes'], ['primeros5', 'Dentro de los primeros 5 días hábiles del mes siguiente']] },
            { k: 'formaPago', tipo: 'select', etiqueta: 'Cómo se paga', req: true, opciones: [['transferencia', 'Transferencia electrónica'], ['vale_vista', 'Vale vista'], ['cheque', 'Cheque nominativo'], ['efectivo', 'Efectivo']] },
            { k: 'beneficios', tipo: 'textarea', etiqueta: 'Beneficios adicionales', max: 600, ayuda: 'Solo si entregas habitación, alimentación, uniforme u otras prestaciones en especie (art. 10 N°6).' },
            { k: 'reglamento', tipo: 'check', etiqueta: 'La empresa tiene reglamento interno de orden, higiene y seguridad y le entrega una copia', ayuda: 'Obligatorio desde 10 trabajadores (art. 153).' },
            { k: 'protocolo', tipo: 'check', etiqueta: 'La empresa tiene protocolo de prevención del acoso y la violencia en el trabajo (Ley Karin) y se lo informa', ayuda: 'Todo empleador debe tenerlo desde el 1 de agosto de 2024 (Ley 21.643).' },
            { k: 'confidencialidad', tipo: 'check', etiqueta: 'Agregar una cláusula de confidencialidad', ayuda: 'Reserva sobre la información de la empresa y sus clientes durante el contrato.' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de firma', req: true }
        ],
        anexo_contrato: [
            { k: 'materia', tipo: 'select', etiqueta: 'Qué cambia', req: true, opciones: [['sueldo', 'El sueldo base'], ['jornada', 'La jornada de trabajo'], ['cargo', 'El cargo y las funciones'], ['prorroga', 'Se prorroga el plazo fijo'], ['indefinido', 'Pasa a contrato indefinido'], ['otro', 'Otro cambio (lo escribo yo)']] },
            { k: 'vigencia', tipo: 'fecha', etiqueta: 'Desde cuándo rige el cambio', ayuda: 'Para el sueldo, conviene que sea el primer día de un mes.', si: { k: 'materia', v: ['sueldo', 'jornada', 'cargo', 'indefinido', 'otro'] } },
            { k: 'nuevoSueldo', tipo: 'pesos', etiqueta: 'Nuevo sueldo base mensual', si: { k: 'materia', v: ['sueldo'] } },
            { k: 'nuevaJornada', tipo: 'numero', etiqueta: 'Nueva jornada semanal (horas)', min: 1, max: 45, si: { k: 'materia', v: ['jornada'] } },
            { k: 'nuevoHorario', tipo: 'textarea', etiqueta: 'Nueva distribución de la jornada (días y horario)', max: 600, si: { k: 'materia', v: ['jornada'] } },
            { k: 'nuevoCargo', tipo: 'texto', etiqueta: 'Nuevo cargo', max: 60, si: { k: 'materia', v: ['cargo'] } },
            { k: 'nuevasFunciones', tipo: 'textarea', etiqueta: 'Nuevas funciones', max: 1500, ayuda: 'Una función por línea.', si: { k: 'materia', v: ['cargo'] } },
            { k: 'nuevoTermino', tipo: 'fecha', etiqueta: 'Nueva fecha de vencimiento del contrato', si: { k: 'materia', v: ['prorroga'] } },
            { k: 'textoLibre', tipo: 'textarea', etiqueta: 'Cambio que se acuerda', max: 1500, ayuda: 'Escribe la cláusula tal como debe quedar. Por ejemplo, un bono permanente o un cambio del lugar de trabajo.', si: { k: 'materia', v: ['otro'] } },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de firma', req: true }
        ],
        pacto_horas_extra: [
            { k: 'desde', tipo: 'fecha', etiqueta: 'Rige desde', req: true },
            { k: 'hasta', tipo: 'fecha', etiqueta: 'Rige hasta', req: true, ayuda: 'Máximo 3 meses. Se puede renovar con otro pacto escrito.' },
            { k: 'maxDiarias', tipo: 'numero', etiqueta: 'Máximo de horas extra por día', req: true, min: 1, max: MAX_HE_DIARIAS },
            { k: 'motivo', tipo: 'textarea', etiqueta: 'Necesidad o situación temporal que las justifica', req: true, max: 600, ayuda: 'Por ejemplo: «Aumento de pedidos por las fiestas de fin de año». Las horas extra no pueden ser permanentes.' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de firma', req: true }
        ],
        cert_antiguedad: [
            { k: 'destinatario', tipo: 'texto', etiqueta: 'Para presentar ante', max: 100, ayuda: 'Por ejemplo: una caja de compensación, un banco o «los fines que estime convenientes».' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha del certificado', req: true },
            { k: 'fechaTermino', tipo: 'fecha', etiqueta: 'Fecha de término (solo si ya no trabaja en la empresa)' }
        ],
        cert_remuneraciones: [
            { k: 'destinatario', tipo: 'texto', etiqueta: 'Para presentar ante', max: 100, ayuda: 'Por ejemplo: una caja de compensación, un banco o «los fines que estime convenientes».' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha del certificado', req: true },
            { k: 'incluirPromedio', tipo: 'check', etiqueta: 'Incluir el promedio del líquido pagado en los últimos 3 meses', ayuda: 'Solo se puede si tienes guardadas las liquidaciones de esos 3 meses.' }
        ],
        comprobante_feriado: [
            { k: 'fechaInicio', tipo: 'fecha', etiqueta: 'Primer día de feriado', req: true },
            { k: 'diasHabiles', tipo: 'numero', etiqueta: 'Días hábiles de feriado', req: true, min: 1, max: 60 },
            { k: 'saldoAntes', tipo: 'numero', etiqueta: 'Días hábiles disponibles antes de este feriado', req: true, min: 0, max: 200, ayuda: 'Es el saldo que le queda a la persona antes de este feriado. Si llevas su registro en «Vacaciones», lo proponemos desde ahí: revísalo.' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha del comprobante', req: true }
        ],
        carta_159_4: [
            { k: 'fechaTermino', tipo: 'fecha', etiqueta: 'Fecha de término del contrato', req: true },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de la carta', req: true },
            { k: 'entrega', tipo: 'select', etiqueta: 'Cómo se comunica', req: true, opciones: [['personal', 'Entrega personal al trabajador'], ['certificada', 'Carta certificada al domicilio del contrato']] },
            { k: 'finiquito', tipo: 'select', etiqueta: 'Finiquito', req: true, opciones: [['presencial', 'Se otorgará y pagará de forma presencial'], ['electronico', 'Se otorgará y pagará de forma electrónica']] },
            { k: 'cotizaciones', tipo: 'check', etiqueta: 'Confirmo que las cotizaciones previsionales están pagadas íntegramente hasta el último día del mes anterior al término y tengo los comprobantes para adjuntar (si no lo están, el despido no pone término al contrato: art. 162)', req: true }
        ],
        carta_161: [
            { k: 'fechaTermino', tipo: 'fecha', etiqueta: 'Fecha de término del contrato', req: true },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de la carta', req: true },
            { k: 'hechos', tipo: 'textarea', etiqueta: 'Hechos concretos en que se funda la causal', req: true, max: 2000, ayuda: 'Describe lo que ocurrió en tu empresa (por ejemplo, baja de ventas con cifras y fechas, cierre de una sección). Mínimo ' + MIN_HECHOS_161 + ' caracteres. Un texto genérico puede dejar la causal sin respaldo.' },
            { k: 'aviso', tipo: 'select', etiqueta: 'Aviso previo', req: true, opciones: [['sustitutiva', 'Pago la indemnización sustitutiva del aviso previo'], ['anticipacion', 'Aviso con 30 días de anticipación o más']] },
            { k: 'remuneracion', tipo: 'pesos', etiqueta: 'Última remuneración mensual (base de la indemnización)', req: true, ayuda: 'Incluye todo lo que percibe por sus servicios al terminar el contrato (sueldo, bonos permanentes, gratificación mensual si se paga cada mes). Excluye asignación familiar, horas extra, colación, movilización y beneficios esporádicos o de una sola vez al año (art. 172). Si es variable, es el promedio de los últimos 3 meses.' },
            { k: 'entrega', tipo: 'select', etiqueta: 'Cómo se comunica', req: true, opciones: [['personal', 'Entrega personal al trabajador'], ['certificada', 'Carta certificada al domicilio del contrato']] },
            { k: 'finiquito', tipo: 'select', etiqueta: 'Finiquito', req: true, opciones: [['presencial', 'Se otorgará y pagará de forma presencial'], ['electronico', 'Se otorgará y pagará de forma electrónica']] },
            { k: 'sinLicencia', tipo: 'check', etiqueta: 'Confirmo que el trabajador no está con licencia médica por enfermedad común, accidente del trabajo o enfermedad profesional', req: true },
            { k: 'sinFuero', tipo: 'check', etiqueta: 'Confirmo que el trabajador no tiene fuero (maternal, sindical u otro)', req: true },
            { k: 'cotizaciones', tipo: 'check', etiqueta: 'Confirmo que las cotizaciones previsionales están pagadas íntegramente hasta el último día del mes anterior al término y tengo los comprobantes para adjuntar (si no lo están, el despido no pone término al contrato: art. 162)', req: true }
        ],
        amonestacion: [
            { k: 'fechaHechos', tipo: 'fecha', etiqueta: 'Fecha de los hechos', req: true },
            { k: 'obligacion', tipo: 'texto', etiqueta: 'Obligación que se incumplió', req: true, max: 200, ayuda: 'Por ejemplo: «cumplir el horario de ingreso pactado en el contrato».' },
            { k: 'hechos', tipo: 'textarea', etiqueta: 'Qué ocurrió', req: true, max: 1500, ayuda: 'Hechos concretos y verificables, sin juicios sobre la persona. Mínimo ' + MIN_HECHOS_AMON + ' caracteres.' },
            { k: 'reglamento', tipo: 'select', etiqueta: 'Reglamento interno', req: true, opciones: [['si', 'La conducta está sancionada en el reglamento interno de la empresa'], ['no', 'La empresa no tiene reglamento interno o no lo contempla']] },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de la carta', req: true }
        ],
        anexo_datos: [
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha del anexo', req: true },
            { k: 'correoPrivacidad', tipo: 'texto', etiqueta: 'Correo para ejercer los derechos sobre los datos', req: true, max: 120, ayuda: 'Es el correo de la empresa al que el trabajador escribirá sus solicitudes.' },
            { k: 'biometria', tipo: 'check', etiqueta: 'La empresa controla la asistencia con huella o reconocimiento facial', ayuda: 'Agrega la cláusula de alternativa no biométrica.' },
            { k: 'herramientas', tipo: 'check', etiqueta: 'La empresa entrega correo, computador o teléfono de trabajo', ayuda: 'Agrega la cláusula de herramientas corporativas.' },
            { k: 'encargados', tipo: 'check', etiqueta: 'La empresa usa proveedores externos con datos de los trabajadores (contador, software de remuneraciones, nube)', ayuda: 'Agrega la cláusula de encargados de tratamiento.' }
        ],
        finiquito: [
            { k: 'causal', tipo: 'select', etiqueta: 'Causal de término', req: true, opciones: [['159_4', 'Vencimiento del plazo convenido (art. 159 N°4)'], ['159_2', 'Renuncia del trabajador (art. 159 N°2)'], ['159_1', 'Mutuo acuerdo de las partes (art. 159 N°1)'], ['161', 'Necesidades de la empresa (art. 161)']] },
            { k: 'fechaTermino', tipo: 'fecha', etiqueta: 'Fecha de término del contrato', req: true },
            { k: 'remFeriado', tipo: 'pesos', etiqueta: 'Remuneración mensual para el feriado', req: true, ayuda: 'Sueldo y lo que se paga en forma fija cada mes (por ejemplo, la gratificación mensual). Si la remuneración es variable, el promedio de los últimos 3 meses (art. 71). El valor del día es este monto dividido por 30.' },
            { k: 'diasFeriado', tipo: 'decimal', etiqueta: 'Días hábiles de feriado por pagar', min: 0, max: 200, ayuda: 'Déjalo vacío para usar el cálculo del asistente: el saldo del registro de vacaciones más el feriado proporcional desde el último aniversario.' },
            { k: 'remuneracion', tipo: 'pesos', etiqueta: 'Última remuneración mensual (base de la indemnización)', ayuda: 'Solo para la causal del art. 161. Incluye lo que percibe por sus servicios (sueldo, bonos permanentes, gratificación mensual); excluye asignación familiar, horas extra, colación, movilización y beneficios esporádicos (art. 172).' },
            { k: 'aviso', tipo: 'select', etiqueta: 'Aviso previo (solo art. 161)', opciones: [['sustitutiva', 'Pago la indemnización sustitutiva del aviso previo'], ['anticipacion', 'Avisé con 30 días de anticipación o más']] },
            { k: 'remPendiente', tipo: 'pesos', etiqueta: 'Remuneración pendiente del último mes', ayuda: 'Solo si los días trabajados del mes de término no se pagan en su liquidación de sueldo.' },
            { k: 'descuentoAfc', tipo: 'pesos', etiqueta: 'Aporte del empleador al seguro de cesantía que se descuenta', ayuda: 'Solo con el art. 161: el monto del certificado de la AFC (art. 13 de la Ley 19.728). Si no lo tienes, déjalo vacío.' },
            { k: 'otrosDescuentos', tipo: 'pesos', etiqueta: 'Otros descuentos autorizados por escrito', ayuda: 'Anticipos o préstamos que el trabajador autorizó a descontar del finiquito.' },
            { k: 'formaPago', tipo: 'select', etiqueta: 'Forma de pago', req: true, opciones: [['transferencia', 'Transferencia electrónica'], ['vale_vista', 'Vale vista'], ['cheque', 'Cheque nominativo'], ['efectivo', 'Efectivo']] },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de firma del finiquito', req: true },
            { k: 'cotizaciones', tipo: 'check', etiqueta: 'Confirmo que las cotizaciones previsionales están pagadas íntegramente hasta el último día del mes anterior al término y tengo los certificados para acreditarlo ante el ministro de fe', req: true }
        ]
    };

    function campos(tipo) { return (CAMPOS[tipo] || []).map(function (c) { return Object.assign({}, c); }); }

    function ultimaRemuneracionPropuesta(ctx) {
        var t = ctx.t, p = periodosPromedio(ctx.hoy)[0], m = ctx.meses && ctx.meses[p];
        if (m && m.calculo && m.calculo.totalImponible) return m.calculo.totalImponible;
        return t.sueldoBase || '';
    }

    function valoresIniciales(tipo, ctx) {
        var e = ctx.empresa, t = ctx.t;
        var v = { ciudad: e.ciudad || e.comuna || '', fecha: ctx.hoy };
        switch (tipo) {
            case 'contrato': Object.assign(v, {
                fechaInicio: t.fechaIngreso || '', funciones: '', lugarTrabajo: [e.direccion, e.comuna].filter(Boolean).join(', '), horario: horarioPropuesto(t),
                gratificacionPactada: '', comisiones: '', nombreObra: '', pago: 'ultimo', formaPago: 'transferencia', beneficios: '', reglamento: false, protocolo: true, confidencialidad: false,
                fecha: t.fechaIngreso && t.fechaIngreso > ctx.hoy ? t.fechaIngreso : ctx.hoy
            }); break;
            case 'anexo_contrato': Object.assign(v, {
                materia: t.contrato === 'plazo_fijo' ? 'prorroga' : 'sueldo', vigencia: (function () { var p = ctx.hoy.slice(0, 7).split('-').map(Number), m = p[1] + 1, y = p[0]; if (m > 12) { m = 1; y++; } return y + '-' + dos(m) + '-01'; })(),
                nuevoSueldo: '', nuevaJornada: '', nuevoHorario: '', nuevoCargo: '', nuevasFunciones: '', nuevoTermino: '', textoLibre: ''
            }); break;
            case 'pacto_horas_extra': Object.assign(v, { desde: ctx.hoy, hasta: sumarDiasIso(sumarMesesIso(ctx.hoy, 3), -1), maxDiarias: '2', motivo: '' }); break;
            case 'cert_antiguedad': Object.assign(v, { destinatario: '', fechaTermino: '' }); break;
            case 'cert_remuneraciones': Object.assign(v, { destinatario: '', incluirPromedio: false }); break;
            case 'comprobante_feriado': Object.assign(v, { fechaInicio: '', diasHabiles: '', saldoAntes: '' }); break;
            case 'carta_159_4': Object.assign(v, { fechaTermino: t.fechaTerminoPlazo || '', entrega: 'personal', finiquito: 'presencial', cotizaciones: false }); break;
            case 'carta_161': Object.assign(v, { fechaTermino: '', hechos: '', aviso: 'sustitutiva', remuneracion: ultimaRemuneracionPropuesta(ctx), entrega: 'personal', finiquito: 'presencial', sinLicencia: false, sinFuero: false, cotizaciones: false }); break;
            case 'amonestacion': Object.assign(v, { fechaHechos: '', obligacion: '', hechos: '', reglamento: 'si' }); break;
            case 'anexo_datos': Object.assign(v, { correoPrivacidad: '', biometria: false, herramientas: false, encargados: false }); break;
            case 'finiquito': Object.assign(v, { causal: t.contrato === 'plazo_fijo' ? '159_4' : '159_2', fechaTermino: t.contrato === 'plazo_fijo' ? (t.fechaTerminoPlazo || '') : '', remFeriado: ultimaRemuneracionPropuesta(ctx), diasFeriado: '', remuneracion: ultimaRemuneracionPropuesta(ctx), aviso: 'sustitutiva', remPendiente: '', descuentoAfc: '', otrosDescuentos: '', formaPago: 'transferencia', cotizaciones: false }); break;
        }
        return v;
    }

    // ---------- validación ----------
    function exigirFicha(ctx, lista, falta) {
        lista.forEach(function (c) {
            var origen = c.de === 'e' ? ctx.empresa : ctx.t;
            var v = origen[c.k];
            if (c.num ? !(v > 0) : vacio(v)) falta.push({ k: c.k, de: c.de, etiqueta: c.etiqueta });
        });
    }
    var BASE_FICHA = [
        { de: 'e', k: 'razonSocial', etiqueta: 'la razón social de la empresa' }, { de: 'e', k: 'rut', etiqueta: 'el RUT de la empresa' },
        { de: 't', k: 'nombre', etiqueta: 'el nombre del trabajador' }, { de: 't', k: 'rut', etiqueta: 'el RUT del trabajador' }
    ];
    var FICHA = {
        contrato: BASE_FICHA.concat([
            { de: 't', k: 'nacionalidad', etiqueta: 'la nacionalidad' }, { de: 't', k: 'fechaNacimiento', etiqueta: 'la fecha de nacimiento' },
            { de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }, { de: 't', k: 'cargo', etiqueta: 'el cargo' },
            { de: 't', k: 'sueldoBase', etiqueta: 'el sueldo base', num: true }, { de: 't', k: 'jornadaHoras', etiqueta: 'la jornada semanal', num: true }
        ]),
        anexo_contrato: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        pacto_horas_extra: BASE_FICHA,
        cert_antiguedad: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }, { de: 't', k: 'cargo', etiqueta: 'el cargo' }]),
        cert_remuneraciones: BASE_FICHA.concat([{ de: 't', k: 'sueldoBase', etiqueta: 'el sueldo base', num: true }]),
        comprobante_feriado: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        carta_159_4: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        carta_161: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        amonestacion: BASE_FICHA,
        anexo_datos: BASE_FICHA,
        finiquito: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }])
    };

    function validar(tipo, ctx, datos) {
        var errores = {}, bloqueos = [], avisos = [], falta = [];
        var t = ctx.t, d = datos || {};
        if (!CAMPOS[tipo]) return { errores: { _: 'Documento desconocido.' }, faltaFicha: [], bloqueos: [], avisos: [], puedeEmitir: false };
        exigirFicha(ctx, FICHA[tipo], falta);

        // Campos obligatorios y formatos
        CAMPOS[tipo].forEach(function (c) {
            var v = d[c.k];
            if (!campoVisible(c, ctx, d)) return;
            if (c.tipo === 'check') { if (c.req && v !== true) errores[c.k] = 'Debes confirmarlo para emitir el documento.'; return; }
            if (vacio(v)) { if (c.req) errores[c.k] = 'Este dato es obligatorio.'; return; }
            if (c.tipo === 'fecha' && !esFecha(v)) errores[c.k] = 'La fecha no es válida.';
            if (c.tipo === 'numero') { var n = Number(v); if (!Number.isInteger(n) || n < c.min || n > c.max) errores[c.k] = 'Debe ser un número entero entre ' + c.min + ' y ' + c.max + '.'; }
            if (c.tipo === 'pesos' && !(Number(v) > 0) && c.req) errores[c.k] = 'Indica un monto mayor que cero.';
            if (c.tipo === 'decimal') { var x = numDecimal(v); if (x === null || x < c.min || x > c.max) errores[c.k] = 'Debe ser un número entre ' + c.min + ' y ' + c.max + ' (con hasta dos decimales).'; }
            if (c.tipo === 'select' && !c.opciones.some(function (o) { return o[0] === v; })) errores[c.k] = 'Elige una opción.';
            if ((c.tipo === 'texto' || c.tipo === 'textarea') && String(v).length > c.max) errores[c.k] = 'Máximo ' + c.max + ' caracteres.';
        });
        var f = function (k) { return d[k]; };

        if (tipo === 'cert_antiguedad') {
            if (t.fechaIngreso && esFecha(f('fecha')) && f('fecha') < t.fechaIngreso) errores.fecha = 'No puede ser anterior a la fecha de ingreso.';
            if (!vacio(f('fechaTermino')) && esFecha(f('fechaTermino'))) {
                if (t.fechaIngreso && f('fechaTermino') < t.fechaIngreso) errores.fechaTermino = 'No puede ser anterior a la fecha de ingreso.';
            } else if (t.activo === false) avisos.push({ nivel: 'info', texto: 'Este trabajador está marcado como inactivo. Si ya no trabaja en la empresa, indica la fecha de término.' });
        }
        if (tipo === 'cert_remuneraciones' && f('incluirPromedio') === true) {
            var faltan = periodosPromedio(f('fecha') && esFecha(f('fecha')) ? f('fecha') : ctx.hoy).filter(function (p) { var m = ctx.meses && ctx.meses[p]; return !(m && m.calculo && m.calculo.liquido > 0); });
            if (faltan.length) bloqueos.push('Para incluir el promedio faltan las liquidaciones guardadas (con su cálculo) de: ' + faltan.map(mesAnio).join(', ') + '. Guárdalas en la sección de liquidaciones o desmarca el promedio.');
        }
        if (tipo === 'contrato') validarContrato(ctx, d, errores, bloqueos, avisos, falta);
        if (tipo === 'anexo_contrato') validarAnexo(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'pacto_horas_extra') validarPactoHE(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'comprobante_feriado') validarFeriado(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'carta_159_4') validar1594(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'carta_161') validar161(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'finiquito') validarFiniquito(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'amonestacion') {
            if (!vacio(f('hechos')) && textoUsuario(f('hechos')).length < MIN_HECHOS_AMON) errores.hechos = 'Describe los hechos con más detalle (mínimo ' + MIN_HECHOS_AMON + ' caracteres).';
            if (esFecha(f('fechaHechos')) && esFecha(f('fecha')) && f('fecha') < f('fechaHechos')) errores.fecha = 'No puede ser anterior a la fecha de los hechos.';
            if (f('reglamento') === 'si') avisos.push({ nivel: 'info', texto: 'Las sanciones del reglamento interno solo pueden ser amonestación verbal o escrita y multa de hasta el 25% de la remuneración diaria (art. 154 N°10). Confirma que esta conducta y su sanción están en tu reglamento y que seguiste el procedimiento que él establece (art. 154 N°11).' });
            if (f('reglamento') === 'no') avisos.push({ nivel: 'aviso', texto: 'Sin reglamento interno (o si no contempla esta conducta), la carta no es una sanción prevista en él: sirve como constancia del hecho y de que se informó a la persona.' });
            avisos.push({ nivel: 'info', texto: 'Si los hechos son de acoso sexual, laboral o violencia en el trabajo, no uses este documento: corresponde seguir el protocolo de prevención de tu empresa.' });
        }
        if (tipo === 'anexo_datos' && !vacio(f('correoPrivacidad')) && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(f('correoPrivacidad')).trim())) errores.correoPrivacidad = 'Escribe un correo válido.';

        var puedeEmitir = !Object.keys(errores).length && !bloqueos.length && !falta.length;
        return { errores: errores, faltaFicha: falta, bloqueos: bloqueos, avisos: avisos, puedeEmitir: puedeEmitir };
    }

    // Un campo con "si" solo se pide (y se muestra) cuando la ficha o otro campo tienen uno de esos valores
    function campoVisible(c, ctx, d) {
        if (!c.si) return true;
        var valor = c.si.ficha ? ctx.t[c.si.ficha] : (d || {})[c.si.k];
        return c.si.v.indexOf(valor) >= 0;
    }

    function validarContrato(ctx, d, errores, bloqueos, avisos, falta) {
        var t = ctx.t, e = ctx.empresa;
        if (t.contrato === 'plazo_fijo' && !t.fechaTerminoPlazo) falta.push({ k: 'fechaTerminoPlazo', de: 't', etiqueta: 'la fecha de vencimiento del plazo fijo' });
        if (t.contrato === 'obra' && vacio(d.nombreObra)) errores.nombreObra = 'Indica la obra o faena.';
        if (t.gratificacion === 'pactada' && vacio(d.gratificacionPactada)) errores.gratificacionPactada = 'Indica la gratificación pactada.';
        if (t.jornadaHoras > JORNADA_MAXIMA) bloqueos.push('La jornada de la ficha (' + t.jornadaHoras + ' horas) supera la jornada máxima legal de ' + JORNADA_MAXIMA + ' horas semanales vigente desde el 26 de abril de 2026 (Ley 21.561). Corrígela en la ficha.');
        if (esFecha(d.fechaInicio) && t.fechaIngreso && d.fechaInicio !== t.fechaIngreso) avisos.push({ nivel: 'aviso', texto: 'La fecha de ingreso del contrato (' + fechaLarga(d.fechaInicio) + ') no coincide con la de la ficha (' + fechaLarga(t.fechaIngreso) + '). Corrige la que esté mal: se usa para las vacaciones, la antigüedad y el finiquito.' });
        if (t.contrato === 'plazo_fijo' && esFecha(d.fechaInicio) && esFecha(t.fechaTerminoPlazo)) {
            if (t.fechaTerminoPlazo <= d.fechaInicio) errores.fechaInicio = 'Debe ser anterior al vencimiento del plazo fijo de la ficha.';
            else if (t.fechaTerminoPlazo > sumarDiasIso(sumarMesesIso(d.fechaInicio, 12), -1)) avisos.push({ nivel: 'aviso', texto: 'El plazo fijo no puede exceder de un año (dos para gerentes o personas con título profesional o técnico de educación superior: art. 159 N°4). Revisa el vencimiento de la ficha.' });
        }
        if (esFecha(d.fecha) && esFecha(d.fechaInicio)) {
            var plazo = t.contrato === 'obra' ? 5 : 15;
            var atraso = dias(d.fechaInicio, d.fecha);
            if (atraso > 60) avisos.push({ nivel: 'aviso', texto: 'Esta persona ingresó hace ' + plural(atraso, 'día', 'días') + '. Si ya tiene un contrato firmado, no firmes uno nuevo: deja los cambios en un anexo. Si nunca lo tuvo, fírmenlo cuanto antes con su fecha real de ingreso: la ley pide el contrato escrito dentro de ' + plazo + ' días desde la incorporación (art. 9).' });
            else if (atraso > plazo) avisos.push({ nivel: 'aviso', texto: 'El contrato se firma ' + plural(atraso, 'día', 'días') + ' después del ingreso. La ley pide firmarlo dentro de ' + plazo + ' días desde la incorporación (art. 9; 5 días en los contratos por obra o de menos de 30 días). Fírmenlo cuanto antes.' });
        }
        if (t.jornadaHoras > 0 && t.jornadaHoras <= JORNADA_PARCIAL) avisos.push({ nivel: 'info', texto: 'Con ' + t.jornadaHoras + ' horas semanales es un contrato de jornada parcial (art. 40 bis). El sueldo no puede ser menor que el ingreso mínimo proporcional a esas horas.' });
        if (t.gratificacion === 'ninguna') avisos.push({ nivel: 'aviso', texto: 'La ficha dice que no se paga gratificación. Si la empresa tiene utilidades, la ley obliga a gratificar (arts. 47 y 50): el contrato remite a esas normas.' });
        if (!vacio(d.comisiones)) avisos.push({ nivel: 'info', texto: 'Con comisiones, el trabajador tiene derecho a la semana corrida: domingos y festivos pagados según el promedio de lo variable (art. 45). Recuerda agregarla en las liquidaciones.' });
        if (d.protocolo !== true) avisos.push({ nivel: 'aviso', texto: 'Todo empleador debe tener un protocolo de prevención del acoso sexual, laboral y de la violencia en el trabajo e informarlo a sus trabajadores (Ley 21.643, Ley Karin). El Kit Blindaje Laboral del sitio trae uno.' });
        if (!e.direccion) avisos.push({ nivel: 'info', texto: 'Falta la dirección de la empresa: el contrato sale sin el domicilio del empleador. Puedes agregarla en «Empresa».' });
        if (!t.domicilio) avisos.push({ nivel: 'info', texto: 'Falta el domicilio del trabajador en su ficha: conviene que el contrato lo indique (es donde se envían las cartas certificadas).' });
        avisos.push({ nivel: 'info', texto: 'Después de firmarlo, entrega un ejemplar al trabajador y registra el contrato en el portal Mi DT de la Dirección del Trabajo dentro de 15 días desde la firma (art. 9 bis).' });
    }

    function validarAnexo(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t, m = d.materia;
        if (m !== 'prorroga') { if (vacio(d.vigencia)) errores.vigencia = 'Indica desde cuándo rige el cambio.'; else if (!esFecha(d.vigencia)) errores.vigencia = 'La fecha no es válida.'; }
        if (m === 'sueldo') {
            if (!(Number(d.nuevoSueldo) > 0)) errores.nuevoSueldo = 'Indica el nuevo sueldo base.';
            else if (t.sueldoBase && Number(d.nuevoSueldo) < t.sueldoBase) avisos.push({ nivel: 'aviso', texto: 'El nuevo sueldo es menor que el actual (' + pesos(t.sueldoBase) + '). Una rebaja solo es válida con el acuerdo del trabajador, que lo firma en este anexo, y nunca bajo el ingreso mínimo.' });
        }
        if (m === 'jornada') {
            var h = Number(d.nuevaJornada);
            if (vacio(d.nuevaJornada)) errores.nuevaJornada = 'Indica la nueva jornada semanal.';
            else if (!Number.isInteger(h) || h < 1) errores.nuevaJornada = 'Debe ser un número entero de horas.';
            else if (h > JORNADA_MAXIMA) errores.nuevaJornada = 'La jornada máxima legal es de ' + JORNADA_MAXIMA + ' horas semanales (baja a 40 el 26 de abril de 2028).';
            if (vacio(d.nuevoHorario)) errores.nuevoHorario = 'Indica los días y el horario.';
            if (h > 0 && h <= JORNADA_PARCIAL && t.jornadaHoras > JORNADA_PARCIAL) avisos.push({ nivel: 'info', texto: 'Pasa a jornada parcial (art. 40 bis): revisa que el sueldo sea al menos el ingreso mínimo proporcional a las nuevas horas.' });
        }
        if (m === 'cargo') {
            if (vacio(d.nuevoCargo)) errores.nuevoCargo = 'Indica el nuevo cargo.';
            if (vacio(d.nuevasFunciones)) errores.nuevasFunciones = 'Indica las nuevas funciones.';
        }
        if (m === 'prorroga') {
            if (t.contrato !== 'plazo_fijo' || !t.fechaTerminoPlazo) bloqueos.push('La ficha no tiene un contrato a plazo fijo con fecha de vencimiento: no hay plazo que prorrogar.');
            else if (t.renovaciones >= 1) bloqueos.push('Este contrato ya fue renovado una vez: una segunda renovación lo convierte en indefinido por ley (art. 159 N°4). Elige «Pasa a contrato indefinido».');
            if (vacio(d.nuevoTermino)) errores.nuevoTermino = 'Indica la nueva fecha de vencimiento.';
            else if (!esFecha(d.nuevoTermino)) errores.nuevoTermino = 'La fecha no es válida.';
            else if (t.fechaTerminoPlazo && d.nuevoTermino <= t.fechaTerminoPlazo) errores.nuevoTermino = 'Debe ser posterior al vencimiento actual (' + fechaLarga(t.fechaTerminoPlazo) + ').';
            else if (t.fechaIngreso && d.nuevoTermino > sumarDiasIso(sumarMesesIso(t.fechaIngreso, 12), -1)) avisos.push({ nivel: 'aviso', texto: 'Con la prórroga, el contrato a plazo fijo suma más de un año desde el ingreso. El plazo fijo no puede exceder de un año (dos para gerentes o personas con título profesional o técnico); si lo excede, se entiende indefinido (art. 159 N°4).' });
            if (t.fechaTerminoPlazo && esFecha(d.fecha) && d.fecha > t.fechaTerminoPlazo) avisos.push({ nivel: 'aviso', texto: 'La prórroga se firma después del vencimiento (' + fechaLarga(t.fechaTerminoPlazo) + '). Si el trabajador siguió trabajando después de esa fecha con conocimiento del empleador, el contrato ya es indefinido (art. 159 N°4).' });
        }
        if (m === 'indefinido' && t.contrato === 'indefinido') bloqueos.push('El contrato de la ficha ya es indefinido.');
        if (m === 'indefinido' && t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && esFecha(d.vigencia) && d.vigencia > sumarDiasIso(t.fechaTerminoPlazo, 1)) avisos.push({ nivel: 'aviso', texto: 'El plazo fijo vence el ' + fechaLarga(t.fechaTerminoPlazo) + ': el paso a indefinido debe regir a más tardar desde el día siguiente (' + fechaLarga(sumarDiasIso(t.fechaTerminoPlazo, 1)) + '). Si sigue trabajando después del vencimiento, ya es indefinido por ley.' });
        if (m === 'otro' && vacio(d.textoLibre)) errores.textoLibre = 'Escribe el cambio que se acuerda.';
        avisos.push({ nivel: 'info', texto: 'El anexo se firma por ambas partes y se guarda junto al contrato (art. 11). Si registraste el contrato en Mi DT, registra también este anexo.' });
    }

    function validarPactoHE(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
        if (esFecha(d.desde) && esFecha(d.hasta)) {
            if (d.hasta < d.desde) errores.hasta = 'Debe ser posterior a la fecha de inicio.';
            else if (d.hasta > sumarDiasIso(sumarMesesIso(d.desde, 3), -1)) errores.hasta = 'El pacto puede durar hasta 3 meses (art. 32): termina a más tardar el ' + fechaLarga(sumarDiasIso(sumarMesesIso(d.desde, 3), -1)) + '.';
        }
        if (esFecha(d.fecha) && esFecha(d.desde) && d.fecha > d.desde) avisos.push({ nivel: 'aviso', texto: 'El pacto se firma después de la fecha en que empieza a regir. Las horas extra deben pactarse por escrito antes de trabajarse.' });
        if (t.jornadaHoras > 0 && t.jornadaHoras <= JORNADA_PARCIAL) avisos.push({ nivel: 'info', texto: 'En jornada parcial, la jornada ordinaria más las horas extra no puede superar la jornada máxima legal (art. 40 bis).' });
        avisos.push({ nivel: 'info', texto: 'Las horas extra se pagan con un recargo del 50% sobre el sueldo convenido, junto con la remuneración del mes, y deben quedar en el registro de asistencia. Se ingresan en la liquidación del mes.' });
    }

    function feriadosOk(ctx, bloqueos, fn) {
        try { return fn(); } catch (e) {
            bloqueos.push('El calendario de feriados del sitio solo cubre 2026 y 2027, así que no podemos calcular los plazos de esas fechas. Revisa las fechas.');
            return null;
        }
    }

    function calcularFeriado(ctx, d, bloqueos) {
        var F = ctx.F;
        return feriadosOk(ctx, bloqueos, function () {
            var inicio = F.siguienteDiaHabil(d.fechaInicio); // el sábado es siempre inhábil para el feriado (art. 69)
            var n = Number(d.diasHabiles);
            var ultimo = F.sumarDiasHabiles(inicio, n - 1);
            var reintegro = F.siguienteDiaHabil(sumarDiasIso(ultimo, 1));
            var feriados = F.feriadosEntre(inicio, ultimo);
            return { inicio: inicio, ultimo: ultimo, reintegro: reintegro, feriados: feriados };
        });
    }

    function validarFeriado(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
        if (t.fechaIngreso && esFecha(d.fechaInicio) && d.fechaInicio < t.fechaIngreso) errores.fechaInicio = 'No puede ser anterior a la fecha de ingreso.';
        if (!errores.diasHabiles && !errores.saldoAntes && !vacio(d.diasHabiles) && !vacio(d.saldoAntes) && Number(d.diasHabiles) > Number(d.saldoAntes)) errores.diasHabiles = 'Supera los días disponibles (' + Number(d.saldoAntes) + ').';
        if (esFecha(d.fechaInicio) && !errores.fechaInicio && !errores.diasHabiles && !vacio(d.diasHabiles)) {
            var r = calcularFeriado(ctx, d, bloqueos);
            if (r) {
                if (r.inicio !== d.fechaInicio) avisos.push({ nivel: 'aviso', texto: 'El ' + fechaLarga(d.fechaInicio) + ' no es día hábil (sábado, domingo o feriado): el feriado se cuenta desde el ' + fechaLarga(r.inicio) + '.' });
                if (r.feriados.length) avisos.push({ nivel: 'info', texto: 'En el período hay feriados nacionales (' + r.feriados.map(function (x) { return x.nombre; }).join(', ') + '): no se cuentan como días hábiles.' });
            }
        }
        if (t.distribucion === '6') avisos.push({ nivel: 'aviso', texto: 'Esta persona trabaja de lunes a sábado, pero para el feriado el sábado es siempre inhábil (art. 69): no se cuenta como día de feriado. El reintegro que figura es el siguiente día hábil; confirma si el sábado posterior al término se trabaja.' });
        avisos.push({ nivel: 'info', texto: 'El feriado debe ser continuo, pero el exceso sobre diez días hábiles puede fraccionarse de común acuerdo (art. 70). También puede acumularse por acuerdo hasta por dos períodos consecutivos.' });
        if (t.fechaIngreso && esFecha(ctx.hoy) && dias(t.fechaIngreso, ctx.hoy) < 365) avisos.push({ nivel: 'aviso', texto: 'La persona lleva menos de un año de servicio: el feriado anual de 15 días hábiles corresponde a quienes tienen más de un año (art. 67). Antes, solo procede el feriado proporcional.' });
    }

    // Advertencia de las cartas de termino: va primero y como aviso (no como dato informativo)
    function avisoCotizaciones() {
        return { nivel: 'aviso', texto: 'Antes de entregar la carta, revisa las cotizaciones: si no están pagadas íntegramente (AFP, salud y seguro de cesantía, hasta el último día del mes anterior al término), el despido no produce el efecto de poner término al contrato (art. 162). Si hay cotizaciones atrasadas, consulta con un abogado antes de entregar la carta.' };
    }

    function validar1594(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
        if (t.contrato !== 'plazo_fijo') bloqueos.push('Este trabajador no tiene contrato a plazo fijo en su ficha. Esta carta es solo para el vencimiento del plazo convenido (art. 159 N°4).');
        if (t.contrato === 'plazo_fijo' && t.renovaciones >= 2) bloqueos.push('Con dos o más renovaciones, el contrato pasó a ser de duración indefinida (art. 159 N°4, inciso final). No corresponde invocar el vencimiento del plazo.');
        if (t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && esFecha(d.fechaTermino) && d.fechaTermino !== t.fechaTerminoPlazo) avisos.push({ nivel: 'aviso', texto: 'La fecha de término (' + fechaLarga(d.fechaTermino) + ') no coincide con la de la ficha (' + fechaLarga(t.fechaTerminoPlazo) + '). Si el trabajador siguió trabajando después del vencimiento con conocimiento tuyo, el contrato pasó a ser indefinido.' });
        if (t.fechaIngreso && esFecha(d.fechaTermino) && d.fechaTermino <= t.fechaIngreso) errores.fechaTermino = 'Debe ser posterior a la fecha de ingreso.';
        if (t.fechaIngreso && esFecha(d.fechaTermino)) {
            var meses = antiguedad(t.fechaIngreso, d.fechaTermino);
            if (meses.anios >= 1 && (meses.meses > 0 || meses.dias > 0 || meses.anios > 1)) avisos.push({ nivel: 'aviso', texto: 'El contrato a plazo fijo no puede exceder de un año (dos para gerentes o personas con título profesional o técnico de una institución de educación superior): la duración total es de ' + antiguedadTxt(meses) + '. Revísalo.' });
        }
        if (esFecha(d.fecha) && esFecha(d.fechaTermino)) { var pl = plazoComunicacion(ctx, d.fechaTermino); if (pl) avisos.push({ nivel: 'info', texto: 'Entrega la carta (o envíala certificada) y manda copia a la Inspección del Trabajo a más tardar el ' + fechaLarga(pl) + ': tres días hábiles después de la separación (art. 162). Para este plazo cuenta el sábado como día hábil; los domingos y feriados no.' }); }
        if (d.entrega === 'certificada' && vacio(t.domicilio)) avisos.push({ nivel: 'aviso', texto: 'Falta el domicilio del trabajador en su ficha. La carta certificada debe enviarse al domicilio señalado en el contrato.' });
        avisos.unshift(avisoCotizaciones());
    }

    function plazoComunicacion(ctx, fechaTermino) {
        try { return ctx.F.sumarDiasHabiles(fechaTermino, 3, { sabadoHabil: true }); } catch (e) { return null; }
    }

    function calcular161(ctx, d) {
        return indemnizacion(ctx.t.fechaIngreso, d.fechaTermino, Number(d.remuneracion), ctx.uf);
    }

    function validar161(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
        avisos.unshift(avisoCotizaciones());
        if (t.fechaIngreso && esFecha(d.fechaTermino) && d.fechaTermino <= t.fechaIngreso) errores.fechaTermino = 'Debe ser posterior a la fecha de ingreso.';
        if (!vacio(d.hechos) && textoUsuario(d.hechos).length < MIN_HECHOS_161) errores.hechos = 'Describe los hechos con más detalle (mínimo ' + MIN_HECHOS_161 + ' caracteres).';
        if (!vacio(d.hechos) && /[\[\]]/.test(d.hechos)) errores.hechos = 'Quita los corchetes: el texto debe quedar completo.';
        if (d.aviso === 'anticipacion' && esFecha(d.fecha) && esFecha(d.fechaTermino) && dias(d.fecha, d.fechaTermino) < 30) errores.fechaTermino = 'Con aviso de 30 días, la carta debe entregarse al menos 30 días antes del término. Cambia las fechas o paga la indemnización sustitutiva.';
        if (esFecha(d.fecha) && esFecha(d.fechaTermino) && d.fecha > d.fechaTermino && d.aviso === 'anticipacion') errores.fecha = 'La carta con aviso previo debe ser anterior al término.';
        if (t.fechaIngreso && esFecha(d.fechaTermino) && !errores.fechaTermino && Number(d.remuneracion) > 0) {
            var ind = calcular161(ctx, d);
            if (ind.antes1981) avisos.push({ nivel: 'aviso', texto: 'El contrato comenzó antes del 14 de agosto de 1981: el tope de 11 años no se aplica. Revisa el cálculo.' });
            if (ind.topada) avisos.push({ nivel: 'info', texto: 'La remuneración supera las 90 UF, que es el máximo que considera la ley para las indemnizaciones (art. 172). Se calculó con ' + pesos(ind.tope) + ', usando la UF de hoy; la ley usa la del último día del mes anterior al pago.' });
            if (!ctx.uf) avisos.push({ nivel: 'aviso', texto: 'No pudimos cargar la UF de hoy: el tope de 90 UF no se aplicó. Revisa que la remuneración no lo supere.' });
            if (ind.antiguedad.anios < 1) avisos.push({ nivel: 'info', texto: 'Con menos de un año de servicio no corresponde la indemnización por años de servicio (art. 163).' });
            avisos.push({ nivel: 'info', texto: 'La indemnización por años de servicio es de 30 días de la última remuneración mensual por cada año y fracción superior a seis meses, con un máximo de 330 días (art. 163), y se reajusta según el IPC con intereses (art. 173). Debe pagarse en un solo acto al firmar el finiquito (art. 169).' });
        }
        if (esFecha(d.fechaTermino)) avisos.push({ nivel: 'info', texto: 'Entrega la carta al trabajador y envía copia a la Inspección del Trabajo (art. 162). La carta supone una oferta irrevocable de pago de las indemnizaciones que indica (art. 169).' });
        if (d.entrega === 'certificada' && vacio(t.domicilio)) avisos.push({ nivel: 'aviso', texto: 'Falta el domicilio del trabajador en su ficha. La carta certificada debe enviarse al domicilio señalado en el contrato.' });
        avisos.push({ nivel: 'info', texto: 'Las necesidades de la empresa deben ser reales y estar acreditadas: si el trabajador la impugna, el tribunal puede ordenar recargos sobre la indemnización (art. 168).' });
    }

    // ---------- finiquito ----------
    // Días hábiles de feriado a pagar: saldo pendiente del registro y proporcional desde el último aniversario (art. 73)
    function propuestaFeriado(ctx, fechaTermino) {
        var t = ctx.t, VAC = vacMod();
        if (!VAC || !esFecha(t.fechaIngreso) || !esFecha(fechaTermino) || fechaTermino <= t.fechaIngreso) return null;
        var r = VAC.resumen(t, ctx.vac || [], fechaTermino);
        var k = VAC.aniosCompletos(t.fechaIngreso, fechaTermino);
        var desde = k > 0 ? VAC.aniversario(t.fechaIngreso, k) : t.fechaIngreso;
        var a = antiguedad(desde, sumarDiasIso(fechaTermino, 1));   // el día del término se cuenta
        var base = t.zonaExtrema ? VAC.BASE_EXTREMA : VAC.BASE;
        var proporcionales = Math.round((a.anios * 12 + a.meses + a.dias / 30) * base / 12 * 100) / 100;
        var pendientes = Math.max(0, r.saldo);
        return { pendientes: pendientes, proporcionales: proporcionales, total: Math.round((pendientes + proporcionales) * 100) / 100, desde: desde, base: base, saldoNegativo: r.saldo < 0 };
    }

    // Convierte días hábiles en días corridos desde el día siguiente al término: se suman los sábados, domingos y feriados del período
    function diasCorridos(ctx, fechaTermino, habiles) {
        var enteros = Math.floor(habiles + 1e-9), fraccion = Math.round((habiles - enteros) * 100) / 100;
        var d = fechaTermino, contados = 0, inhabiles = 0, tope = 400;
        while (contados < enteros && tope-- > 0) {
            d = sumarDiasIso(d, 1);
            if (ctx.F.esDiaHabil(d)) contados++; else inhabiles++;
        }
        return { corridos: Math.round((enteros + inhabiles + fraccion) * 100) / 100, inhabiles: inhabiles, hasta: d };
    }

    function calcularFiniquito(ctx, d, bloqueos) {
        var t = ctx.t, c = { causal: d.causal };
        var prop = propuestaFeriado(ctx, d.fechaTermino);
        var habiles = !vacio(d.diasFeriado) && numDecimal(d.diasFeriado) !== null ? numDecimal(d.diasFeriado) : (prop ? prop.total : 0);
        var conv = habiles > 0 ? feriadosOk(ctx, bloqueos || [], function () { return diasCorridos(ctx, d.fechaTermino, habiles); }) : { corridos: 0, inhabiles: 0 };
        var valorDia = Number(d.remFeriado) > 0 ? Number(d.remFeriado) / 30 : 0;
        c.feriado = { habiles: habiles, propuesta: prop, usaPropuesta: vacio(d.diasFeriado), corridos: conv ? conv.corridos : 0, inhabiles: conv ? conv.inhabiles : 0, valorDia: valorDia, monto: conv ? Math.round(conv.corridos * valorDia) : 0 };
        c.ias = 0; c.sustitutiva = 0; c.ind = null;
        if (d.causal === '161' && Number(d.remuneracion) > 0 && esFecha(d.fechaTermino) && esFecha(t.fechaIngreso)) {
            c.ind = indemnizacion(t.fechaIngreso, d.fechaTermino, Number(d.remuneracion), ctx.uf);
            c.ias = c.ind.porAnios;
            c.sustitutiva = d.aviso === 'sustitutiva' ? c.ind.base : 0;
        }
        c.remPendiente = Number(d.remPendiente) > 0 ? Math.round(Number(d.remPendiente)) : 0;
        c.afc = d.causal === '161' && Number(d.descuentoAfc) > 0 ? Math.round(Number(d.descuentoAfc)) : 0;
        c.otros = Number(d.otrosDescuentos) > 0 ? Math.round(Number(d.otrosDescuentos)) : 0;
        c.haberes = c.ias + c.sustitutiva + c.feriado.monto + c.remPendiente;
        c.descuentos = c.afc + c.otros;
        c.total = c.haberes - c.descuentos;
        return c;
    }

    function validarFiniquito(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
        if (t.fechaIngreso && esFecha(d.fechaTermino) && d.fechaTermino <= t.fechaIngreso) errores.fechaTermino = 'Debe ser posterior a la fecha de ingreso.';
        if (esFecha(d.fecha) && esFecha(d.fechaTermino) && d.fecha < d.fechaTermino) errores.fecha = 'El finiquito se firma el día del término o después.';
        if (d.causal === '161' && !(Number(d.remuneracion) > 0)) errores.remuneracion = 'Con la causal del art. 161 indica la última remuneración mensual.';
        if (d.causal !== '161' && Number(d.descuentoAfc) > 0) errores.descuentoAfc = 'Este descuento solo procede con la causal del art. 161.';
        if (d.causal === '159_4') {
            if (t.contrato !== 'plazo_fijo') bloqueos.push('Este trabajador no tiene contrato a plazo fijo en su ficha. El vencimiento del plazo (art. 159 N°4) solo procede en contratos a plazo fijo.');
            else if (t.renovaciones >= 2) bloqueos.push('Con dos o más renovaciones, el contrato pasó a ser de duración indefinida (art. 159 N°4, inciso final). No corresponde invocar el vencimiento del plazo.');
        }
        if (!esFecha(d.fechaTermino) || errores.fechaTermino) return;
        var c = calcularFiniquito(ctx, d, bloqueos);
        if (d.causal === '161' || d.causal === '159_4') avisos.unshift({ nivel: 'aviso', texto: 'Antes de firmar, revisa las cotizaciones: si al término no estaban pagadas íntegramente (AFP, salud y seguro de cesantía, hasta el último día del mes anterior), el despido no produce el efecto de poner término al contrato (art. 162). Si hay cotizaciones atrasadas, consulta con un abogado antes de firmar.' });
        if (c.feriado.propuesta) {
            var p = c.feriado.propuesta;
            var txt = 'Feriado: ' + (c.feriado.usaPropuesta ? 'usamos ' : 'el asistente calcula ') + decTxt(p.total) + ' días hábiles: ' + decTxt(p.pendientes) + ' de saldo pendiente según el registro de vacaciones y ' + decTxt(p.proporcionales) + ' proporcionales desde el ' + fechaLarga(p.desde) + ' (' + decTxt(p.base / 12) + ' por mes, art. 73).';
            if (c.feriado.habiles > 0) txt += ' Equivalen a ' + decTxt(c.feriado.corridos) + ' días corridos contados desde el día siguiente al término (' + plural(c.feriado.inhabiles, 'día inhábil', 'días inhábiles') + ' incluidos).';
            avisos.push({ nivel: 'info', texto: txt + ' Revisa que el registro de vacaciones esté completo.' });
            if (p.saldoNegativo) avisos.push({ nivel: 'aviso', texto: 'El registro de vacaciones tiene más días tomados que los que correspondían: no se descontó del finiquito. Revísalo antes de firmar.' });
        }
        if (c.ind) {
            if (c.ind.antes1981) avisos.push({ nivel: 'aviso', texto: 'El contrato comenzó antes del 14 de agosto de 1981: el tope de 11 años no se aplica. Revisa el cálculo.' });
            if (c.ind.topada) avisos.push({ nivel: 'info', texto: 'La remuneración supera las 90 UF, el máximo que considera la ley para las indemnizaciones (art. 172). Se calculó con ' + pesos(c.ind.tope) + ', usando la UF de hoy; la ley usa la del último día del mes anterior al pago.' });
            if (c.ind.antiguedad.anios < 1) avisos.push({ nivel: 'info', texto: 'Con menos de un año de servicio no corresponde la indemnización por años de servicio (art. 163).' });
            if (!ctx.uf) avisos.push({ nivel: 'aviso', texto: 'No pudimos cargar la UF de hoy: el tope de 90 UF no se aplicó. Revisa que la remuneración no lo supere.' });
        }
        if (c.afc > 0) {
            if (c.afc > c.ias) errores.descuentoAfc = 'No puede superar la indemnización por años de servicio (' + pesos(c.ias) + ').';
            avisos.push({ nivel: 'aviso', texto: 'El aporte del empleador al seguro de cesantía solo se descuenta de la indemnización por años de servicio del art. 161 (art. 13 de la Ley 19.728). Si el despido se declara injustificado, este descuento puede ser cuestionado: consulta antes de aplicarlo.' });
        }
        if (c.otros > 0) avisos.push({ nivel: 'info', texto: 'Descuenta solo anticipos o préstamos que el trabajador autorizó por escrito, y guarda ese documento.' });
        var saldo = typeof ctx.saldoPrestamos === 'function' ? ctx.saldoPrestamos(d.fechaTermino.slice(0, 7)) : 0;
        if (saldo > 0) avisos.push({ nivel: 'aviso', texto: 'Según los préstamos registrados, después de la cuota de la última liquidación queda un saldo de ' + pesos(saldo) + '. Solo puedes descontarlo del finiquito si el trabajador lo autorizó por escrito: en ese caso, súmalo en «Otros descuentos».' });
        if (c.total < 0) errores.otrosDescuentos = 'Los descuentos superan lo que se paga.';
        if (d.causal === '159_2') avisos.push({ nivel: 'info', texto: 'La renuncia debe constar por escrito y estar firmada por el trabajador y ratificada ante un ministro de fe (o hecha en el sitio de la Dirección del Trabajo): si no, no puede invocarse (art. 177). Adjúntala al finiquito.' });
        if (d.causal === '159_1') avisos.push({ nivel: 'info', texto: 'El mutuo acuerdo debe constar por escrito y ratificarse ante ministro de fe (art. 177). Este finiquito lo deja por escrito al firmarlo ante el ministro de fe.' });
        avisos.push({ nivel: 'info', texto: 'El finiquito debe otorgarse y su pago ponerse a disposición del trabajador dentro de los 10 días hábiles siguientes a la separación, y se firma ante ministro de fe (inspector del trabajo, notario, oficial del Registro Civil o secretario municipal) o en forma electrónica en el sitio de la Dirección del Trabajo (art. 177). El ministro de fe te pedirá acreditar el pago de las cotizaciones.' });
        avisos.push({ nivel: 'info', texto: 'Registra el término del contrato en el portal Mi DT dentro del plazo de la causal (art. 9 bis).' });
    }

    // ---------- armado de los documentos ----------
    function encabezado(e) {
        return '<header class="dc-head">' + (e.logo ? '<img src="' + esc(e.logo) + '" alt="">' : '') +
            '<div><strong>' + esc(e.razonSocial) + '</strong><span>RUT ' + esc(rutFmt(e.rut)) + '</span>' +
            (e.direccion ? '<span>' + esc([e.direccion, e.comuna].filter(Boolean).join(', ')) + '</span>' : '') + '</div></header>';
    }
    function firmaEmpleador(e) {
        return '<div class="dc-firma"><span></span>' + esc(e.representante || e.razonSocial) + '<small>' + (e.representante ? 'p.p. ' + esc(e.razonSocial) + ' · ' : '') + 'RUT ' + esc(rutFmt(e.representante && e.rutRepresentante ? e.rutRepresentante : e.rut)) + '</small><small>Empleador</small></div>';
    }
    function firmaTrabajador(t, texto) {
        return '<div class="dc-firma"><span></span>' + esc(t.nombre) + '<small>RUT ' + esc(rutFmt(t.rut)) + '</small><small>' + esc(texto || 'Trabajador') + '</small></div>';
    }
    function envolver(e, titulo, cuerpo, pagada) {
        return encabezado(e) + '<h2 class="dc-titulo">' + esc(titulo) + '</h2>' + cuerpo +
            '<p class="dc-pie">' + esc(PIE) + ' Versión de los textos: ' + VERSION_TEXTOS + '.</p>' +
            (pagada ? '' : '<div class="lqd-marca" aria-hidden="true"><span>Vista previa</span></div>');
    }
    function destinatarioTxt(d) { return d.destinatario ? esc(textoUsuario(d.destinatario)) : 'los fines que estime convenientes'; }
    function estaEnTiempo(f1, f2) { return f1 > f2 ? 'terminó' : 'terminará'; }

    // Comparecencia del contrato y de los anexos
    function partes(ctx, completa) {
        var e = ctx.empresa, t = ctx.t;
        var rep = e.representante ? ', representada por don/doña ' + esc(e.representante) + (e.rutRepresentante ? ', cédula de identidad N° ' + esc(rutFmt(e.rutRepresentante)) : '') : '';
        var domE = e.direccion ? ', con domicilio en ' + esc([e.direccion, e.comuna].filter(Boolean).join(', ')) : '';
        var datosT = completa ? ', de nacionalidad ' + esc(textoUsuario(t.nacionalidad).toLowerCase()) + ', nacido/a el ' + esc(fechaLarga(t.fechaNacimiento)) : '';
        var domT = t.domicilio ? ', con domicilio en ' + esc([t.domicilio, t.comuna].filter(Boolean).join(', ')) : '';
        return 'entre <strong>' + esc(e.razonSocial) + '</strong>, RUT ' + esc(rutFmt(e.rut)) + rep + domE + ', en adelante el «Empleador», y don/doña <strong>' + esc(t.nombre) + '</strong>' + datosT + ', cédula de identidad N° ' + esc(rutFmt(t.rut)) + domT + ', en adelante el «Trabajador»';
    }
    function listaFunciones(texto) {
        var l = String(texto || '').split(/\n+/).map(function (x) { return textoUsuario(x).replace(/^[-•*\d.)\s]+/, ''); }).filter(Boolean);
        return '<ol class="dc-lista">' + l.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    }
    var ORD_M = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO'];
    function numerador() { var n = 0; return function (titulo) { return '<p class="dc-p"><strong>' + ORD_M[n++] + ': ' + esc(titulo) + '.</strong></p>'; }; }
    var PAGO_TXT = { ultimo: 'por mes vencido, el último día hábil de cada mes', primeros5: 'por mes vencido, dentro de los primeros cinco días hábiles del mes siguiente' };
    function jornadaTxt(horas) { return horas + ' horas semanales' + (horas <= JORNADA_PARCIAL ? ', en régimen de jornada parcial (art. 40 bis del Código del Trabajo)' : ''); }

    function generarContrato(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, cl = numerador(), cuerpo = '';
        cuerpo += '<p class="dc-p">En ' + esc(textoUsuario(d.ciudad)) + ', a ' + esc(fechaLarga(d.fecha)) + ', ' + partes(ctx, true) + ', se ha convenido el siguiente contrato individual de trabajo:</p>';
        cuerpo += cl('Naturaleza de los servicios') + '<p class="dc-p">El Trabajador se obliga a prestar servicios personales bajo subordinación y dependencia del Empleador en el cargo de <strong>' + esc(t.cargo) + '</strong>, con las siguientes funciones:</p>' + listaFunciones(d.funciones) +
            '<p class="dc-p">Además, realizará otras labores similares que se relacionen directamente con su cargo.</p>';
        cuerpo += cl('Lugar de trabajo') + '<p class="dc-p">Los servicios se prestarán en ' + esc(textoUsuario(d.lugarTrabajo)) + '.</p>';
        cuerpo += cl('Jornada de trabajo') + '<p class="dc-p">La jornada ordinaria de trabajo será de ' + esc(jornadaTxt(t.jornadaHoras)) + ', distribuida ' + esc(textoUsuario(d.horario).replace(/\.$/, '')) + '.</p>' +
            '<p class="dc-p">Solo podrán trabajarse horas extraordinarias para atender necesidades o situaciones temporales de la empresa, con un máximo de dos por día y previo pacto escrito de vigencia no superior a tres meses. Se pagarán con un recargo del 50% sobre el sueldo convenido (arts. 31 y 32 del Código del Trabajo).</p>';
        var rem = '<p class="dc-p">El Empleador pagará al Trabajador un sueldo base mensual de <strong>' + esc(montoTxt(t.sueldoBase)) + '</strong>.</p>';
        if (t.gratificacion === 'legal') rem += '<p class="dc-p">Además, pagará mensualmente una gratificación equivalente al 25% de lo devengado en el mes por remuneraciones mensuales, con un tope anual de 4,75 ingresos mínimos mensuales, conforme al artículo 50 del Código del Trabajo.</p>';
        else if (t.gratificacion === 'pactada') rem += '<p class="dc-p">Las partes acuerdan una gratificación convencional consistente en ' + esc(textoUsuario(d.gratificacionPactada)) + ', que no podrá ser inferior a la que resulte de aplicar las normas legales (art. 46 del Código del Trabajo).</p>';
        else rem += '<p class="dc-p">La gratificación, si correspondiere, se regirá por los artículos 46 y siguientes del Código del Trabajo.</p>';
        if (!vacio(d.comisiones)) rem += '<p class="dc-p">El Trabajador percibirá también comisiones, consistentes en ' + esc(textoUsuario(d.comisiones)) + ', y la semana corrida que corresponda conforme al artículo 45 del Código del Trabajo.</p>';
        var asig = [];
        if (t.colacion > 0) asig.push('colación por ' + montoTxt(t.colacion));
        if (t.movilizacion > 0) asig.push('movilización por ' + montoTxt(t.movilizacion));
        if (asig.length) rem += '<p class="dc-p">El Empleador pagará además mensualmente una asignación de ' + esc(asig.join(' y una asignación de ')) + ', que no constituyen remuneración (art. 41 del Código del Trabajo).</p>';
        rem += '<p class="dc-p">Las remuneraciones se pagarán ' + esc(PAGO_TXT[d.pago] || PAGO_TXT.ultimo) + ', mediante ' + esc(FORMAS_PAGO[d.formaPago] || FORMAS_PAGO.transferencia) + ', previa deducción de los impuestos y las cotizaciones de seguridad social que correspondan y de los demás descuentos que autorice la ley (art. 58). Junto con el pago se entregará al Trabajador un comprobante con el detalle de lo pagado y de los descuentos (art. 54).</p>';
        cuerpo += cl('Remuneración') + rem;
        if (!vacio(d.beneficios)) cuerpo += cl('Beneficios adicionales') + parrafos(d.beneficios);
        var duracion;
        if (t.contrato === 'plazo_fijo') duracion = 'El Trabajador ingresó al servicio del Empleador el ' + fechaLarga(d.fechaInicio) + '. El presente contrato es a plazo fijo y durará hasta el ' + fechaLarga(t.fechaTerminoPlazo) + ' (art. 159 N°4 del Código del Trabajo).';
        else if (t.contrato === 'obra') duracion = 'El Trabajador ingresó al servicio del Empleador el ' + fechaLarga(d.fechaInicio) + '. El presente contrato se celebra para la obra o faena «' + textoUsuario(d.nombreObra) + '» y terminará al concluir el trabajo o servicio que le dio origen (art. 159 N°5 del Código del Trabajo).';
        else duracion = 'El Trabajador ingresó al servicio del Empleador el ' + fechaLarga(d.fechaInicio) + '. El presente contrato es de duración indefinida.';
        cuerpo += cl('Duración') + '<p class="dc-p">' + esc(duracion) + '</p>';
        var normas = '<p class="dc-p">El Trabajador se obliga a cumplir las instrucciones que le imparta el Empleador en relación con su trabajo' + (d.reglamento === true ? ' y el Reglamento Interno de Orden, Higiene y Seguridad de la empresa, del que declara recibir una copia gratuita en este acto (art. 156 del Código del Trabajo)' : '') + '.</p>';
        if (d.protocolo === true) normas += '<p class="dc-p">El Empleador declara contar con un protocolo de prevención del acoso sexual, del acoso laboral y de la violencia en el trabajo, que el Trabajador declara conocer, y se compromete a promover un trato digno y respetuoso (Ley N° 21.643).</p>';
        cuerpo += cl('Obligaciones y normas internas') + normas;
        if (d.confidencialidad === true) cuerpo += cl('Confidencialidad') + '<p class="dc-p">El Trabajador se obliga a guardar reserva, durante la vigencia de este contrato, sobre la información de la empresa, de sus clientes y de sus proveedores a la que acceda con motivo de su trabajo, y a no usarla para fines ajenos a sus funciones.</p>';
        cuerpo += cl('Registro y ejemplares') + '<p class="dc-p">El Empleador registrará este contrato en el sitio electrónico de la Dirección del Trabajo (art. 9 bis del Código del Trabajo). En lo no previsto, rigen las normas del Código del Trabajo. El presente contrato se firma en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada parte; el Trabajador declara recibir el suyo en este acto.</p>';
        cuerpo += '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t) + '</div>';
        return envolver(e, 'Contrato individual de trabajo', cuerpo, pagada);
    }

    function generarAnexoContrato(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, cambio, desde = d.materia !== 'prorroga' ? 'A contar del ' + fechaLarga(d.vigencia) + ', ' : '';
        switch (d.materia) {
            case 'sueldo': cambio = '<p class="dc-p">' + esc(desde) + 'el sueldo base mensual del Trabajador será de <strong>' + esc(montoTxt(Number(d.nuevoSueldo))) + '</strong>' + (t.sueldoBase ? ', en reemplazo del sueldo base de ' + esc(pesos(t.sueldoBase)) : '') + '.</p>'; break;
            case 'jornada': cambio = '<p class="dc-p">' + esc(desde) + 'la jornada ordinaria de trabajo será de ' + esc(jornadaTxt(Number(d.nuevaJornada))) + ', distribuida ' + esc(textoUsuario(d.nuevoHorario).replace(/\.$/, '')) + '.</p>'; break;
            case 'cargo': cambio = '<p class="dc-p">' + esc(desde) + 'el Trabajador se desempeñará en el cargo de <strong>' + esc(textoUsuario(d.nuevoCargo)) + '</strong>, con las siguientes funciones:</p>' + listaFunciones(d.nuevasFunciones); break;
            case 'prorroga': cambio = '<p class="dc-p">Las partes acuerdan prorrogar el contrato de trabajo a plazo fijo, cuyo vencimiento era el ' + esc(fechaLarga(t.fechaTerminoPlazo)) + ', hasta el <strong>' + esc(fechaLarga(d.nuevoTermino)) + '</strong>.</p>'; break;
            case 'indefinido': cambio = '<p class="dc-p">' + esc(desde) + 'el contrato de trabajo pasa a ser de <strong>duración indefinida</strong>, manteniéndose la antigüedad del Trabajador desde su fecha de ingreso.</p>'; break;
            default: cambio = parrafos(d.textoLibre);
        }
        var cuerpo = '<p class="dc-p">En ' + esc(textoUsuario(d.ciudad)) + ', a ' + esc(fechaLarga(d.fecha)) + ', ' + partes(ctx, false) + ', se acuerda el siguiente anexo al contrato de trabajo del Trabajador, que ingresó al servicio el ' + esc(fechaLarga(t.fechaIngreso)) + ' (art. 11 del Código del Trabajo):</p>' +
            '<p class="dc-p"><strong>PRIMERO:</strong> Las partes acuerdan modificar el contrato de trabajo en lo siguiente:</p>' + cambio +
            '<p class="dc-p"><strong>SEGUNDO:</strong> En todo lo que no se modifica por este anexo, sigue rigiendo íntegramente el contrato de trabajo y sus anexos anteriores.</p>' +
            '<p class="dc-p"><strong>TERCERO:</strong> El presente anexo se firma en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada parte.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t) + '</div>';
        return envolver(e, 'Anexo de contrato de trabajo', cuerpo, pagada);
    }

    function generarPactoHE(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, n = Number(d.maxDiarias);
        var cuerpo = '<p class="dc-p">En ' + esc(textoUsuario(d.ciudad)) + ', a ' + esc(fechaLarga(d.fecha)) + ', ' + partes(ctx, false) + ', se acuerda el siguiente pacto de horas extraordinarias:</p>' +
            '<p class="dc-p"><strong>PRIMERO:</strong> Las partes acuerdan que el Trabajador podrá trabajar horas extraordinarias, con un máximo de ' + esc(plural(n, 'hora', 'horas')) + ' por día, para atender la siguiente necesidad o situación temporal de la empresa:</p>' + parrafos(d.motivo) +
            '<p class="dc-p"><strong>SEGUNDO:</strong> Este pacto rige desde el ' + esc(fechaLarga(d.desde)) + ' hasta el ' + esc(fechaLarga(d.hasta)) + ', plazo que no excede de tres meses, y solo podrá renovarse por acuerdo escrito de las partes (art. 32 del Código del Trabajo).</p>' +
            '<p class="dc-p"><strong>TERCERO:</strong> Las horas extraordinarias se pagarán con un recargo del cincuenta por ciento sobre el sueldo convenido para la jornada ordinaria, junto con las remuneraciones del mes en que se trabajen, y se registrarán en el sistema de control de asistencia de la empresa (arts. 32 y 33 del Código del Trabajo).</p>' +
            '<p class="dc-p"><strong>CUARTO:</strong> El presente pacto se firma en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada parte.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t) + '</div>';
        return envolver(e, 'Pacto de horas extraordinarias', cuerpo, pagada);
    }

    function generarCertAntiguedad(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, hasta = vacio(d.fechaTermino) ? d.fecha : d.fechaTermino;
        var a = antiguedad(t.fechaIngreso, hasta);
        var servicio = vacio(d.fechaTermino)
            ? 'se desempeña en esta empresa como <strong>' + esc(t.cargo) + '</strong>, con contrato ' + contratoTxt(t.contrato) + ', desde el ' + esc(fechaLarga(t.fechaIngreso)) + '.'
            : 'se desempeñó en esta empresa como <strong>' + esc(t.cargo) + '</strong>, con contrato ' + contratoTxt(t.contrato) + ', desde el ' + esc(fechaLarga(t.fechaIngreso)) + ' hasta el ' + esc(fechaLarga(d.fechaTermino)) + '.';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' +
            '<p class="dc-p">' + esc(e.razonSocial) + ', RUT ' + esc(rutFmt(e.rut)) + ', certifica que don/doña <strong>' + esc(t.nombre) + '</strong>, cédula de identidad N° ' + esc(rutFmt(t.rut)) + ', ' + servicio + '</p>' +
            '<p class="dc-p">' + (vacio(d.fechaTermino) ? 'A la fecha de este certificado' : 'Durante la relación laboral') + ', la antigüedad es de <strong>' + esc(antiguedadTxt(a)) + '</strong>.</p>' +
            '<p class="dc-p">Se extiende el presente certificado a petición del interesado/a, para ser presentado ante ' + destinatarioTxt(d) + '.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + '</div>';
        return envolver(e, 'Certificado de antigüedad', cuerpo, pagada);
    }

    function generarCertRemuneraciones(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t;
        var filas = [['Sueldo base mensual', t.sueldoBase]];
        if (t.gratificacion === 'legal') filas.push(['Gratificación legal (art. 50 del Código del Trabajo)', null]);
        if (t.gratificacion === 'pactada') filas.push(['Gratificación pactada', null]);
        if (t.colacion > 0) filas.push(['Asignación de colación', t.colacion]);
        if (t.movilizacion > 0) filas.push(['Asignación de movilización', t.movilizacion]);
        var tabla = '<table class="dc-tabla"><tbody>' + filas.map(function (f) { return '<tr><th scope="row">' + esc(f[0]) + '</th><td>' + (f[1] == null ? 'Según la ley y lo pactado' : pesos(f[1])) + '</td></tr>'; }).join('') + '</tbody></table>';
        var promedio = '';
        if (d.incluirPromedio === true) {
            var ps = periodosPromedio(d.fecha), suma = 0;
            var lineas = ps.slice().reverse().map(function (p) { var l = ctx.meses[p].calculo.liquido; suma += l; return '<tr><th scope="row">' + esc(mesAnio(p)) + '</th><td>' + pesos(l) + '</td></tr>'; });
            promedio = '<p class="dc-p">Líquido pagado en los últimos tres meses:</p><table class="dc-tabla"><tbody>' + lineas.join('') + '</tbody><tfoot><tr><th scope="row">Promedio</th><td>' + pesos(suma / 3) + '</td></tr></tfoot></table>';
        }
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' +
            '<p class="dc-p">' + esc(e.razonSocial) + ', RUT ' + esc(rutFmt(e.rut)) + ', certifica que don/doña <strong>' + esc(t.nombre) + '</strong>, cédula de identidad N° ' + esc(rutFmt(t.rut)) + ', ' +
            (t.cargo ? 'se desempeña como <strong>' + esc(t.cargo) + '</strong>, ' : 'trabaja en esta empresa, ') + 'con contrato ' + contratoTxt(t.contrato) + (t.fechaIngreso ? ' desde el ' + esc(fechaLarga(t.fechaIngreso)) : '') + ', y que sus remuneraciones registradas son las siguientes:</p>' +
            tabla + promedio +
            '<p class="dc-p">Los montos corresponden a los registrados por el empleador a la fecha de este certificado. Se extiende a petición del interesado/a, para ser presentado ante ' + destinatarioTxt(d) + '.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + '</div>';
        return envolver(e, 'Certificado de remuneraciones', cuerpo, pagada);
    }

    function generarComprobanteFeriado(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, r = calcularFeriado(ctx, d, []);
        var n = Number(d.diasHabiles), saldoAntes = Number(d.saldoAntes), saldoDespues = saldoAntes - n;
        var tabla = '<table class="dc-tabla"><tbody>' +
            '<tr><th scope="row">Primer día de feriado</th><td>' + esc(fechaLarga(r.inicio)) + '</td></tr>' +
            '<tr><th scope="row">Último día de feriado</th><td>' + esc(fechaLarga(r.ultimo)) + '</td></tr>' +
            '<tr><th scope="row">Días hábiles de feriado</th><td>' + n + '</td></tr>' +
            '<tr><th scope="row">Reintegro a sus labores</th><td>' + esc(fechaLarga(r.reintegro)) + '</td></tr>' +
            '<tr><th scope="row">Días hábiles disponibles antes de este feriado</th><td>' + saldoAntes + '</td></tr>' +
            '<tr><th scope="row">Días hábiles disponibles después de este feriado</th><td>' + saldoDespues + '</td></tr>' +
            '</tbody></table>';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' +
            '<p class="dc-p">' + esc(e.razonSocial) + ', RUT ' + esc(rutFmt(e.rut)) + ', otorga a don/doña <strong>' + esc(t.nombre) + '</strong>, RUT ' + esc(rutFmt(t.rut)) + (t.cargo ? ', ' + esc(t.cargo) : '') + ', feriado anual con remuneración íntegra, en los siguientes términos:</p>' +
            tabla +
            '<p class="dc-p">Para el cómputo del feriado el día sábado se considera siempre inhábil, y no se cuentan los domingos ni los feriados (art. 69 del Código del Trabajo).</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t, 'Trabajador · recibe conforme') + '</div>';
        return envolver(e, 'Comprobante de feriado', cuerpo, pagada);
    }

    function textoEstadoCotizaciones(ctx, d) {
        var hasta = mesAnterior(d.fechaTermino);
        return 'Para dar cumplimiento al artículo 162 del Código del Trabajo, informamos que las cotizaciones previsionales (AFP, salud y seguro de cesantía) devengadas hasta el último día del mes anterior al del término, es decir, hasta ' + mesAnio(hasta + '-01') + ', se encuentran pagadas íntegramente, lo que se acredita con los comprobantes que se adjuntan a esta carta.';
    }
    function textoFiniquito(d) {
        var base = d.finiquito === 'electronico'
            ? 'El finiquito se otorgará y pagará en forma electrónica. Es voluntario para usted aceptar, firmar y recibir el pago en forma electrónica, y siempre podrá optar por la actuación presencial ante un ministro de fe.'
            : 'El finiquito se otorgará y pagará en forma presencial ante un ministro de fe.';
        return base + ' Al momento de suscribir el finiquito, si lo estima necesario, podrá formular reserva de derechos.';
    }
    function destinatarioCarta(ctx) {
        var t = ctx.t;
        return '<p class="dc-dest">Señor/a <strong>' + esc(t.nombre) + '</strong><br>RUT ' + esc(rutFmt(t.rut)) + (t.domicilio ? '<br>' + esc([t.domicilio, t.comuna].filter(Boolean).join(', ')) : '') + '</p>';
    }
    function medioTxt(d) { return d.entrega === 'certificada' ? 'carta certificada enviada al domicilio señalado en su contrato de trabajo' : 'entrega personal'; }

    function generarCarta1594(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t;
        var verbo = estaEnTiempo(d.fecha, d.fechaTermino);
        var reno = t.renovaciones === 1 ? ' Este contrato ha sido renovado una vez.' : '';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' + destinatarioCarta(ctx) +
            '<p class="dc-ref"><strong>Ref.:</strong> Comunicación de término de contrato de trabajo, artículo 159 N°4 del Código del Trabajo.</p>' +
            '<p class="dc-p">Por medio de la presente, y en cumplimiento de lo dispuesto en el artículo 162 del Código del Trabajo, le comunicamos que su contrato de trabajo a plazo fijo, que comenzó el ' + esc(fechaLarga(t.fechaIngreso)) + ', ' + verbo + ' el <strong>' + esc(fechaLarga(d.fechaTermino)) + '</strong>, por la causal del <strong>artículo 159 N°4 del Código del Trabajo: vencimiento del plazo convenido en el contrato</strong>.</p>' +
            '<p class="dc-p"><strong>Hechos en que se funda:</strong> el contrato de trabajo se celebró a plazo fijo, con vencimiento el ' + esc(fechaLarga(d.fechaTermino)) + ', plazo que se cumple en esa fecha.' + esc(reno) + '</p>' +
            '<p class="dc-p">' + esc(textoEstadoCotizaciones(ctx, d)) + '</p>' +
            '<p class="dc-p">' + esc(textoFiniquito(d)) + '</p>' +
            '<p class="dc-p">Esta comunicación se le hace llegar por ' + esc(medioTxt(d)) + ', y se envía copia a la Inspección del Trabajo respectiva.</p>' +
            '<p class="dc-p">Agradecemos los servicios prestados.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + '</div>' +
            '<p class="dc-recibi">Recibí copia de esta carta: ______________________ &nbsp; Fecha: ____ / ____ / ________</p>' +
            '<p class="dc-copia">Copia: Inspección del Trabajo.</p>';
        return envolver(e, 'Comunicación de término de contrato por vencimiento del plazo', cuerpo, pagada);
    }

    function generarCarta161(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, ind = calcular161(ctx, d);
        var sust = d.aviso === 'sustitutiva' ? ind.base : 0, total = ind.porAnios + sust;
        var lineas = [];
        if (ind.aniosPago > 0) lineas.push('<tr><th scope="row">Indemnización por años de servicio (art. 163): ' + plural(ind.aniosPago, 'año', 'años') + ' × ' + pesos(ind.base) + '</th><td>' + pesos(ind.porAnios) + '</td></tr>');
        if (sust > 0) lineas.push('<tr><th scope="row">Indemnización sustitutiva del aviso previo (art. 162): una remuneración mensual</th><td>' + pesos(sust) + '</td></tr>');
        var tabla = '<table class="dc-tabla"><tbody>' + lineas.join('') + '</tbody><tfoot><tr><th scope="row">Monto total a pagar</th><td>' + pesos(total) + '</td></tr></tfoot></table>';
        var verbo = estaEnTiempo(d.fecha, d.fechaTermino);
        var avisoTxt = d.aviso === 'sustitutiva'
            ? 'Como esta comunicación no se da con treinta días de anticipación, se paga la indemnización sustitutiva del aviso previo, equivalente a la última remuneración mensual devengada.'
            : 'Esta comunicación se da con treinta días de anticipación o más, por lo que no corresponde la indemnización sustitutiva del aviso previo.';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' + destinatarioCarta(ctx) +
            '<p class="dc-ref"><strong>Ref.:</strong> Comunicación de término de contrato de trabajo, artículo 161 inciso primero del Código del Trabajo.</p>' +
            '<p class="dc-p">Por medio de la presente, y en cumplimiento de lo dispuesto en el artículo 162 del Código del Trabajo, le comunicamos que su contrato de trabajo ' + verbo + ' el <strong>' + esc(fechaLarga(d.fechaTermino)) + '</strong>, por la causal del <strong>artículo 161 inciso primero del Código del Trabajo: necesidades de la empresa, establecimiento o servicio</strong>.</p>' +
            '<p class="dc-p"><strong>Hechos en que se funda:</strong></p>' + parrafos(d.hechos) +
            '<p class="dc-p">' + esc(avisoTxt) + '</p>' +
            '<p class="dc-p">De acuerdo con lo dispuesto en el artículo 162 inciso cuarto, informamos que el monto total a pagar es:</p>' + tabla +
            '<p class="dc-p">Esta comunicación supone una oferta irrevocable de pago de las indemnizaciones indicadas, que se pagarán en un solo acto al momento de extender el finiquito (art. 169 letra a). Además, se pagarán en el finiquito las remuneraciones y demás prestaciones que se adeuden, incluido el feriado que corresponda.</p>' +
            '<p class="dc-p">' + esc(textoEstadoCotizaciones(ctx, d)) + '</p>' +
            '<p class="dc-p">' + esc(textoFiniquito(d)) + '</p>' +
            '<p class="dc-p">Esta comunicación se le hace llegar por ' + esc(medioTxt(d)) + ', y se envía copia a la Inspección del Trabajo respectiva.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + '</div>' +
            '<p class="dc-recibi">Recibí copia de esta carta: ______________________ &nbsp; Fecha: ____ / ____ / ________</p>' +
            '<p class="dc-copia">Copia: Inspección del Trabajo.</p>';
        return envolver(e, 'Comunicación de término de contrato por necesidades de la empresa', cuerpo, pagada);
    }

    function generarAmonestacion(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t;
        var base = d.reglamento === 'si'
            ? 'Esta amonestación escrita se aplica conforme al reglamento interno de la empresa (art. 154 N°10 del Código del Trabajo).'
            : 'Esta carta deja constancia de los hechos descritos y de que se le informó de ellos.';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' + destinatarioCarta(ctx) +
            '<p class="dc-ref"><strong>Ref.:</strong> Amonestación escrita.</p>' +
            '<p class="dc-p">Por medio de la presente le informamos que el ' + esc(fechaLarga(d.fechaHechos)) + ' se constataron los hechos que se describen a continuación, que constituyen un incumplimiento de su obligación de <strong>' + esc(textoUsuario(d.obligacion)) + '</strong>.</p>' +
            '<p class="dc-p"><strong>Hechos:</strong></p>' + parrafos(d.hechos) +
            '<p class="dc-p">' + esc(base) + ' Le solicitamos corregir esta conducta en lo sucesivo.</p>' +
            '<p class="dc-p">Usted puede dejar constancia por escrito de sus descargos o aclaraciones, que se agregarán a su carpeta.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t, 'Trabajador · toma conocimiento') + '</div>' +
            '<p class="dc-recibi">Fecha de recepción: ____ / ____ / ________ &nbsp; Observaciones del trabajador: ____________________________</p>';
        return envolver(e, 'Amonestación escrita', cuerpo, pagada);
    }

    function generarAnexoDatos(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, n = 0;
        function clausula(titulo, texto) { var o = ORDINALES[n++]; return '<p class="dc-p"><strong>CLÁUSULA ' + o + ': ' + esc(titulo) + '.</strong></p>' + (Array.isArray(texto) ? texto.map(function (x) { return '<p class="dc-p">' + esc(x) + '</p>'; }).join('') : '<p class="dc-p">' + esc(texto) + '</p>'); }
        var cl = [];
        cl.push(clausula('Antecedentes y marco normativo', 'Las partes declaran que se publicó la Ley N° 21.719, que regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales, y que, de conformidad con el artículo 154 ter del Código del Trabajo, el Empleador debe mantener reserva de toda la información y datos privados del Trabajador a que tenga acceso con ocasión de la relación laboral.'));
        cl.push(clausula('Categorías de datos y finalidad del tratamiento', [
            'El Trabajador toma conocimiento y autoriza al Empleador a tratar los datos personales estrictamente necesarios para:',
            'Gestión de la relación laboral: confección y pago de remuneraciones y liquidaciones de sueldo, transferencias bancarias, retenciones judiciales, pago de cotizaciones previsionales y gestión de finiquitos.',
            'Cumplimiento legal y previsional: envío de información al Servicio de Impuestos Internos, a la Dirección del Trabajo y a las administradoras de fondos de pensiones, Isapre o Fonasa.',
            'Prevención de riesgos y seguridad ocupacional: control de exámenes de salud laboral conforme a la Ley N° 16.744 y al reglamento interno de orden, higiene y seguridad.'
        ]));
        cl.push(clausula('Tratamiento de datos sensibles de salud', 'Los antecedentes relativos al estado de salud del Trabajador, tales como licencias médicas, diagnósticos y exámenes ocupacionales, son datos sensibles de especial protección. El Empleador se compromete a que el acceso a ellos quede limitado al personal encargado de la tramitación previsional, y a no divulgarlos a jefaturas directas ni a terceros ajenos a esa tramitación.'));
        if (d.biometria === true) cl.push(clausula('Control de asistencia y opción biométrica', [
            'El Trabajador toma conocimiento de que la empresa dispone de un sistema automatizado de control de asistencia con tecnología biométrica (huella dactilar o reconocimiento facial). El Empleador declara que los datos capturados se almacenan únicamente como patrones o algoritmos matemáticos y no como imágenes reconstruibles de la huella o del rostro.',
            'El Empleador garantiza al Trabajador el derecho a optar por un método de marcaje alternativo no biométrico (tarjeta, clave o aplicación), sin que su negativa a usar biometría pueda constituir falta laboral, represalia o causal de despido.',
            'Los datos de asistencia no se utilizarán para un fin distinto al registro de la jornada y al cálculo de las remuneraciones.'
        ]));
        if (d.herramientas === true) cl.push(clausula('Herramientas corporativas', 'Los correos electrónicos, computadores, teléfonos y cuentas asignados por el Empleador son herramientas de trabajo de propiedad de la empresa, que el Trabajador se compromete a usar para los fines de sus funciones. El Empleador podrá aplicar medidas de ciberseguridad proporcionales, respetando el derecho a la intimidad y la honra del Trabajador, sin inspeccionar comunicaciones de carácter estrictamente personal.'));
        if (d.encargados === true) cl.push(clausula('Encargados de tratamiento', 'El Trabajador es informado de que el Empleador puede contratar proveedores externos (contadores, software de remuneraciones, servicios en la nube) en calidad de encargados de tratamiento, que actuarán bajo contrato con deberes de reserva y seguridad equivalentes.'));
        cl.push(clausula('Ejercicio de derechos', 'El Trabajador podrá ejercer sus derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de sus datos personales escribiendo a ' + textoUsuario(d.correoPrivacidad) + ', y su solicitud será respondida dentro del plazo que establece la ley.'));
        cl.push(clausula('Plazo de conservación', 'Terminada la relación laboral, los datos del Trabajador se conservarán durante el tiempo necesario para cumplir las obligaciones laborales, previsionales y tributarias que correspondan, y luego se bloquearán y eliminarán o anonimizarán de forma segura.'));
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' +
            '<p class="dc-p">Entre <strong>' + esc(e.razonSocial) + '</strong>, RUT ' + esc(rutFmt(e.rut)) + (e.representante ? ', representada por ' + esc(e.representante) : '') + ', en adelante el «Empleador» o «Responsable del tratamiento», y don/doña <strong>' + esc(t.nombre) + '</strong>, cédula de identidad N° ' + esc(rutFmt(t.rut)) + ', en adelante el «Trabajador» o «Titular de los datos», se acuerda el siguiente anexo al contrato de trabajo:</p>' +
            cl.join('') +
            '<p class="dc-p">Para constancia, se firma el presente anexo en dos ejemplares del mismo tenor y fecha, quedando uno en poder de cada parte.</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t, 'Trabajador · titular de los datos') + '</div>' +
            '<p class="dc-copia">La Ley N° 21.719 rige desde el 1 de diciembre de 2026.</p>';
        return envolver(e, 'Anexo de contrato de trabajo · Tratamiento y protección de datos personales', cuerpo, pagada);
    }

    function generarFiniquito(ctx, d, pagada) {
        var e = ctx.empresa, t = ctx.t, c = calcularFiniquito(ctx, d, []);
        var filas = [];
        if (c.ias > 0) filas.push(['Indemnización por años de servicio (art. 163): ' + plural(c.ind.aniosPago, 'año', 'años') + ' × ' + pesos(c.ind.base), c.ias]);
        if (c.sustitutiva > 0) filas.push(['Indemnización sustitutiva del aviso previo (art. 162)', c.sustitutiva]);
        if (c.feriado.monto > 0) filas.push(['Feriado pendiente y proporcional: ' + decTxt(c.feriado.habiles) + ' días hábiles, equivalentes a ' + decTxt(c.feriado.corridos) + ' días corridos', c.feriado.monto]);
        if (c.remPendiente > 0) filas.push(['Remuneración pendiente del último mes', c.remPendiente]);
        if (c.afc > 0) filas.push(['Menos: aporte del empleador al seguro de cesantía imputado a la indemnización (art. 13 de la Ley 19.728)', -c.afc]);
        if (c.otros > 0) filas.push(['Menos: descuentos autorizados por escrito por el Trabajador', -c.otros]);
        var tabla = '<table class="dc-tabla"><tbody>' + filas.map(function (f) { return '<tr><th scope="row">' + esc(f[0]) + '</th><td>' + (f[1] < 0 ? '− ' + pesos(-f[1]) : pesos(f[1])) + '</td></tr>'; }).join('') +
            (filas.length ? '' : '<tr><th scope="row">Sin montos por pagar</th><td>' + pesos(0) + '</td></tr>') +
            '</tbody><tfoot><tr><th scope="row">Total a pagar</th><td>' + pesos(c.total) + '</td></tr></tfoot></table>';
        var rep = e.representante ? ', representada por don/doña ' + esc(e.representante) + (e.rutRepresentante ? ', RUT ' + esc(rutFmt(e.rutRepresentante)) : '') : '';
        var domE = e.direccion ? ', con domicilio en ' + esc([e.direccion, e.comuna].filter(Boolean).join(', ')) : '';
        var domT = t.domicilio ? ', con domicilio en ' + esc([t.domicilio, t.comuna].filter(Boolean).join(', ')) : '';
        var feriadoTxt = c.feriado.monto > 0 ? '<p class="dc-p">El feriado se calcula sobre ' + esc(decTxt(c.feriado.habiles)) + ' días hábiles, que contados desde el día siguiente al término y agregando los sábados, domingos y feriados del período equivalen a ' + esc(decTxt(c.feriado.corridos)) + ' días corridos, con un valor diario de ' + pesos(c.feriado.valorDia) + ' (remuneración mensual de ' + pesos(Number(d.remFeriado)) + ' dividida por 30).</p>' : '';
        var cuerpo = '<p class="dc-lugar">' + esc(lugar(ctx, d)) + '</p>' +
            '<p class="dc-p">Entre <strong>' + esc(e.razonSocial) + '</strong>, RUT ' + esc(rutFmt(e.rut)) + rep + domE + ', en adelante el «Empleador», y don/doña <strong>' + esc(t.nombre) + '</strong>, cédula de identidad N° ' + esc(rutFmt(t.rut)) + domT + ', en adelante el «Trabajador», se deja constancia del siguiente finiquito de contrato de trabajo:</p>' +
            '<p class="dc-p"><strong>PRIMERO:</strong> El Trabajador prestó servicios al Empleador' + (t.cargo ? ' como ' + esc(t.cargo) : '') + ', con contrato ' + contratoTxt(t.contrato) + ', desde el ' + esc(fechaLarga(t.fechaIngreso)) + ' hasta el ' + esc(fechaLarga(d.fechaTermino)) + ', fecha en que terminó la relación laboral por la causal de ' + esc(CAUSALES_FINIQUITO[d.causal]) + '.</p>' +
            '<p class="dc-p"><strong>SEGUNDO:</strong> En este acto el Empleador paga al Trabajador las siguientes sumas:</p>' + tabla + feriadoTxt +
            '<p class="dc-p"><strong>TERCERO:</strong> La suma total de ' + pesos(c.total) + ' se paga mediante ' + esc(FORMAS_PAGO[d.formaPago] || FORMAS_PAGO.transferencia) + '.</p>' +
            '<p class="dc-p"><strong>CUARTO:</strong> El Empleador declara que las cotizaciones previsionales del Trabajador (AFP, salud y seguro de cesantía) se encuentran pagadas íntegramente hasta ' + esc(mesAnio(mesAnterior(d.fechaTermino) + '-01')) + ', lo que acredita con los certificados correspondientes.</p>' +
            '<p class="dc-p"><strong>QUINTO:</strong> El Trabajador declara recibir las sumas indicadas a su entera satisfacción y que, sin perjuicio de la reserva de derechos que formule al firmar, el Empleador nada le adeuda por remuneraciones, feriado, indemnizaciones ni otro concepto derivado de la relación laboral o de su término, por lo que le otorga el más amplio finiquito.</p>' +
            '<p class="dc-p"><strong>SEXTO:</strong> Este finiquito se firma ante ministro de fe, como exige el artículo 177 del Código del Trabajo, en tantos ejemplares como partes, quedando uno en poder de cada una.</p>' +
            '<p class="dc-recibi">Reserva de derechos del Trabajador: ________________________________________________</p>' +
            '<div class="dc-firmas">' + firmaEmpleador(e) + firmaTrabajador(t) + '<div class="dc-firma"><span></span>Ministro de fe<small>Nombre, firma y timbre</small></div></div>';
        return envolver(e, 'Finiquito de contrato de trabajo', cuerpo, pagada);
    }

    var GENERADORES = {
        contrato: generarContrato, anexo_contrato: generarAnexoContrato, pacto_horas_extra: generarPactoHE,
        cert_antiguedad: generarCertAntiguedad, cert_remuneraciones: generarCertRemuneraciones, comprobante_feriado: generarComprobanteFeriado,
        carta_159_4: generarCarta1594, carta_161: generarCarta161, amonestacion: generarAmonestacion, anexo_datos: generarAnexoDatos,
        finiquito: generarFiniquito
    };

    function generar(tipo, ctx, datos, opciones) {
        var v = validar(tipo, ctx, datos);
        if (!v.puedeEmitir) throw new Error('El documento tiene datos pendientes: no se puede emitir.');
        var titulo = TIPOS.filter(function (x) { return x.id === tipo; })[0].titulo;
        return { titulo: titulo, html: GENERADORES[tipo](ctx, datos, !!(opciones && opciones.pagada)) };
    }

    var api = {
        TIPOS: TIPOS, GRUPOS: GRUPOS, VERSION_TEXTOS: VERSION_TEXTOS, PIE: PIE, campos: campos, campoVisible: campoVisible, valoresIniciales: valoresIniciales, validar: validar, generar: generar,
        pesosEnLetras: pesosEnLetras, horarioPropuesto: horarioPropuesto,
        periodosPromedio: periodosPromedio, indemnizacion: indemnizacion, antiguedad: antiguedad, antiguedadTxt: antiguedadTxt, plazoComunicacion: plazoComunicacion,
        propuestaFeriado: propuestaFeriado, diasCorridos: diasCorridos, calcularFiniquito: calcularFiniquito,
        MIN_HECHOS_161: MIN_HECHOS_161, MIN_HECHOS_AMON: MIN_HECHOS_AMON, version: '1.3.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeDocs = api;
})(typeof window !== 'undefined' ? window : this);
