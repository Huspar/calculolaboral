/*
 * CalculoLaboral · documentos laborales del Asistente Pyme (v1.0.0). Funciona en el navegador (window.CLPymeDocs) y en Node.
 *
 * Siete modelos de referencia que se arman con los datos guardados de la empresa y del trabajador:
 *   cert_antiguedad, cert_remuneraciones, comprobante_feriado, carta_159_4, carta_161, amonestacion, anexo_datos
 *
 *   TIPOS                                  lista { id, titulo, descripcion }
 *   campos(tipo)                           campos que se piden además de la ficha
 *   valoresIniciales(tipo, ctx)            valores propuestos para esos campos
 *   validar(tipo, ctx, datos)              { errores, faltaFicha, bloqueos, avisos, puedeEmitir }
 *   generar(tipo, ctx, datos, { pagada })  { titulo, html }  (pagada: false agrega la marca "Vista previa")
 *   periodosPromedio(hoy)                  los 3 meses completos anteriores (para el promedio líquido del certificado)
 *
 * ctx = { empresa, t (trabajador), hoy: 'AAAA-MM-DD', meses: { 'AAAA-MM': mes guardado }, uf, F (feriados) }
 *
 * Reglas
 *  - Un documento solo se emite con todos sus campos obligatorios: no quedan corchetes ni espacios en blanco.
 *  - Lo que escribe la persona se escapa antes de entrar al HTML.
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

    var TIPOS = [
        { id: 'cert_antiguedad', titulo: 'Certificado de antigüedad', descripcion: 'Acredita desde cuándo trabaja la persona en la empresa y cuánto tiempo lleva.' },
        { id: 'cert_remuneraciones', titulo: 'Certificado de remuneraciones', descripcion: 'Sueldo y asignaciones registrados; con el promedio líquido de los últimos 3 meses si están guardados.' },
        { id: 'comprobante_feriado', titulo: 'Comprobante de feriado', descripcion: 'Fecha de inicio, días hábiles, reintegro y saldo, con firma de ambas partes.' },
        { id: 'carta_159_4', titulo: 'Carta de término por vencimiento del plazo fijo (art. 159 N°4)', descripcion: 'Comunica el término de un contrato a plazo fijo e informa el estado de las cotizaciones.' },
        { id: 'carta_161', titulo: 'Carta de término por necesidades de la empresa (art. 161)', descripcion: 'Con los hechos, las indemnizaciones, el estado de las cotizaciones y la copia a la Inspección.' },
        { id: 'amonestacion', titulo: 'Amonestación escrita', descripcion: 'Deja constancia de un incumplimiento y de la obligación que se incumplió.' },
        { id: 'anexo_datos', titulo: 'Anexo de protección de datos personales', descripcion: 'Anexo al contrato sobre el tratamiento de los datos del trabajador (Ley 21.719, rige desde el 1-dic-2026).' }
    ];

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
    function sumarDiasIso(iso, n) { var d = new Date(aMs(iso) + n * 86400000); return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function mesAnterior(iso) { var a = iso.split('-').map(Number), m = a[1] - 1, y = a[0]; if (m < 1) { m = 12; y--; } return y + '-' + dos(m); }
    function rutFmt(v) { var c = String(v || '').toUpperCase().replace(/[^0-9K]/g, ''); return c.length < 2 ? c : c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1); }
    function parrafos(texto) {
        return String(texto || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return '<p class="dc-p">' + esc(l) + '</p>'; }).join('');
    }
    function contratoTxt(c) { return c === 'plazo_fijo' ? 'a plazo fijo' : c === 'obra' ? 'por obra o faena determinada' : 'indefinido'; }
    function lugar(ctx, datos) { return (datos.ciudad ? datos.ciudad + ', ' : '') + fechaLarga(datos.fecha || ctx.hoy); }

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
            { k: 'saldoAntes', tipo: 'numero', etiqueta: 'Días hábiles disponibles antes de este feriado', req: true, min: 0, max: 200, ayuda: 'Es el saldo que le queda a la persona según tu registro de vacaciones. El sistema no sabe cuántos días ya tomó.' },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha del comprobante', req: true }
        ],
        carta_159_4: [
            { k: 'fechaTermino', tipo: 'fecha', etiqueta: 'Fecha de término del contrato', req: true },
            { k: 'ciudad', tipo: 'texto', etiqueta: 'Ciudad', req: true, max: 60 },
            { k: 'fecha', tipo: 'fecha', etiqueta: 'Fecha de la carta', req: true },
            { k: 'entrega', tipo: 'select', etiqueta: 'Cómo se comunica', req: true, opciones: [['personal', 'Entrega personal al trabajador'], ['certificada', 'Carta certificada al domicilio del contrato']] },
            { k: 'finiquito', tipo: 'select', etiqueta: 'Finiquito', req: true, opciones: [['presencial', 'Se otorgará y pagará de forma presencial'], ['electronico', 'Se otorgará y pagará de forma electrónica']] },
            { k: 'cotizaciones', tipo: 'check', etiqueta: 'Confirmo que las cotizaciones previsionales están pagadas íntegramente hasta el último día del mes anterior al término y tengo los comprobantes para adjuntar', req: true }
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
            { k: 'cotizaciones', tipo: 'check', etiqueta: 'Confirmo que las cotizaciones previsionales están pagadas íntegramente hasta el último día del mes anterior al término y tengo los comprobantes para adjuntar', req: true }
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
            case 'cert_antiguedad': Object.assign(v, { destinatario: '', fechaTermino: '' }); break;
            case 'cert_remuneraciones': Object.assign(v, { destinatario: '', incluirPromedio: false }); break;
            case 'comprobante_feriado': Object.assign(v, { fechaInicio: '', diasHabiles: '', saldoAntes: '' }); break;
            case 'carta_159_4': Object.assign(v, { fechaTermino: t.fechaTerminoPlazo || '', entrega: 'personal', finiquito: 'presencial', cotizaciones: false }); break;
            case 'carta_161': Object.assign(v, { fechaTermino: '', hechos: '', aviso: 'sustitutiva', remuneracion: ultimaRemuneracionPropuesta(ctx), entrega: 'personal', finiquito: 'presencial', sinLicencia: false, sinFuero: false, cotizaciones: false }); break;
            case 'amonestacion': Object.assign(v, { fechaHechos: '', obligacion: '', hechos: '', reglamento: 'si' }); break;
            case 'anexo_datos': Object.assign(v, { correoPrivacidad: '', biometria: false, herramientas: false, encargados: false }); break;
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
        cert_antiguedad: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }, { de: 't', k: 'cargo', etiqueta: 'el cargo' }]),
        cert_remuneraciones: BASE_FICHA.concat([{ de: 't', k: 'sueldoBase', etiqueta: 'el sueldo base', num: true }]),
        comprobante_feriado: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        carta_159_4: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        carta_161: BASE_FICHA.concat([{ de: 't', k: 'fechaIngreso', etiqueta: 'la fecha de ingreso' }]),
        amonestacion: BASE_FICHA,
        anexo_datos: BASE_FICHA
    };

    function validar(tipo, ctx, datos) {
        var errores = {}, bloqueos = [], avisos = [], falta = [];
        var t = ctx.t, d = datos || {};
        if (!CAMPOS[tipo]) return { errores: { _: 'Documento desconocido.' }, faltaFicha: [], bloqueos: [], avisos: [], puedeEmitir: false };
        exigirFicha(ctx, FICHA[tipo], falta);

        // Campos obligatorios y formatos
        CAMPOS[tipo].forEach(function (c) {
            var v = d[c.k];
            if (c.tipo === 'check') { if (c.req && v !== true) errores[c.k] = 'Debes confirmarlo para emitir el documento.'; return; }
            if (vacio(v)) { if (c.req) errores[c.k] = 'Este dato es obligatorio.'; return; }
            if (c.tipo === 'fecha' && !esFecha(v)) errores[c.k] = 'La fecha no es válida.';
            if (c.tipo === 'numero') { var n = Number(v); if (!Number.isInteger(n) || n < c.min || n > c.max) errores[c.k] = 'Debe ser un número entero entre ' + c.min + ' y ' + c.max + '.'; }
            if (c.tipo === 'pesos' && !(Number(v) > 0)) errores[c.k] = 'Indica un monto mayor que cero.';
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
        if (tipo === 'comprobante_feriado') validarFeriado(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'carta_159_4') validar1594(ctx, d, errores, bloqueos, avisos);
        if (tipo === 'carta_161') validar161(ctx, d, errores, bloqueos, avisos);
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
        avisos.push({ nivel: 'info', texto: 'Si el empleador no pagó íntegramente las cotizaciones al momento del despido, este no produce el efecto de poner término al contrato (art. 162).' });
    }

    function plazoComunicacion(ctx, fechaTermino) {
        try { return ctx.F.sumarDiasHabiles(fechaTermino, 3, { sabadoHabil: true }); } catch (e) { return null; }
    }

    function calcular161(ctx, d) {
        return indemnizacion(ctx.t.fechaIngreso, d.fechaTermino, Number(d.remuneracion), ctx.uf);
    }

    function validar161(ctx, d, errores, bloqueos, avisos) {
        var t = ctx.t;
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

    var GENERADORES = {
        cert_antiguedad: generarCertAntiguedad, cert_remuneraciones: generarCertRemuneraciones, comprobante_feriado: generarComprobanteFeriado,
        carta_159_4: generarCarta1594, carta_161: generarCarta161, amonestacion: generarAmonestacion, anexo_datos: generarAnexoDatos
    };

    function generar(tipo, ctx, datos, opciones) {
        var v = validar(tipo, ctx, datos);
        if (!v.puedeEmitir) throw new Error('El documento tiene datos pendientes: no se puede emitir.');
        var titulo = TIPOS.filter(function (x) { return x.id === tipo; })[0].titulo;
        return { titulo: titulo, html: GENERADORES[tipo](ctx, datos, !!(opciones && opciones.pagada)) };
    }

    var api = {
        TIPOS: TIPOS, VERSION_TEXTOS: VERSION_TEXTOS, PIE: PIE, campos: campos, valoresIniciales: valoresIniciales, validar: validar, generar: generar,
        periodosPromedio: periodosPromedio, indemnizacion: indemnizacion, antiguedad: antiguedad, antiguedadTxt: antiguedadTxt, plazoComunicacion: plazoComunicacion,
        MIN_HECHOS_161: MIN_HECHOS_161, MIN_HECHOS_AMON: MIN_HECHOS_AMON, version: '1.0.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeDocs = api;
})(typeof window !== 'undefined' ? window : this);
