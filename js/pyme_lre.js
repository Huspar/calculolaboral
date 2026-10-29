/*
 * CalculoLaboral · Libro de Remuneraciones Electrónico (LRE) desde el Asistente Pyme (v1.0.0)
 * Funciona en el navegador (window.CLPymeLre) y en Node (require).
 *
 *   armar({ periodo, empresa, items: [{ t, res, diasLicencia, diasVacaciones }], plantilla })
 *       t = ficha del trabajador; res = resultado de liquidacion_engine.calcular de su mes guardado
 *       → { texto, nombreArchivo, errores, avisos, incluidos, filas }
 *
 * Clasifica cada línea de la liquidación en el código del LRE (js/lre_generador.js) y deja que el generador arme el archivo.
 * Una línea que no se puede clasificar con certeza detiene el archivo: se dice cuál es, no se adivina.
 */
(function (root) {
    'use strict';

    var LRE = typeof module !== 'undefined' && module.exports ? require('./lre_generador.js') : root.CLLre;

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function norm(s) { return texto(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function empieza(s, p) { return norm(s).indexOf(norm(p)) === 0; }

    function codImponible(l) {
        var c = l.concepto;
        if (empieza(c, 'Sueldo base')) return '2101';
        if (empieza(c, 'Horas extra')) return '2102';
        if (empieza(c, 'Comisiones')) return '2103';
        if (empieza(c, 'Semana corrida')) return '2104';
        if (empieza(c, 'Tratos')) return '2112';
        if (empieza(c, 'Gratificación')) return '2106';
        if (l.detalle === 'Bono imponible') return '2111';
        return null;
    }
    // Los no imponibles con nombre libre se clasifican solo si el nombre dice claramente qué son (art. 41 del Código del Trabajo)
    var NO_IMPONIBLES_LIBRES = [
        [/perdida de caja|caja/, '2304'], [/desgaste|herramienta/, '2305'], [/gastos? por causa|causa del trabajo/, '2306'],
        [/cambio de residencia|residencia/, '2307'], [/sala cuna/, '2308'], [/teletrabajo|distancia/, '2309'], [/alojamiento/, '2310'],
        [/traslaci/, '2312'], [/viatico/, '2303'], [/colacion/, '2301'], [/movilizacion/, '2302'],
        [/feriado/, '2313'], [/anos de servicio|años de servicio|ano de servicio/, '2314'], [/sustitutiva|aviso previo/, '2315'], [/fuero/, '2316']
    ];
    function codNoImponible(l) {
        var c = l.concepto;
        if (empieza(c, 'Colación')) return '2301';
        if (empieza(c, 'Movilización')) return '2302';
        if (empieza(c, 'Viáticos')) return '2303';
        if (empieza(c, 'Asignación familiar')) return '2311';
        if (l.detalle === 'No imponible') {
            var n = norm(c);
            for (var i = 0; i < NO_IMPONIBLES_LIBRES.length; i++) if (NO_IMPONIBLES_LIBRES[i][0].test(n)) return NO_IMPONIBLES_LIBRES[i][1];
        }
        return null;
    }
    function codLegal(l) {
        var c = l.concepto;
        if (/^AFP /.test(c)) return '3141';
        if (empieza(c, 'Adicional de salud')) return '3144';
        if (empieza(c, 'Salud')) return '3143';
        if (empieza(c, 'Seguro de cesantía')) return '3151';
        if (empieza(c, 'Impuesto único')) return '3161';
        if (empieza(c, 'APV régimen A')) return '3155';
        if (empieza(c, 'APV régimen B')) return '3156';
        return null;
    }
    function codOtro(l) {
        var c = l.concepto;
        if (empieza(c, 'Anticipo de sueldo')) return '3188';
        if (empieza(c, 'Crédito caja de compensación')) return '3110';
        if (empieza(c, 'Cuota sindical')) return '3171';
        if (l.detalle === 'Pactado por escrito') return '3185';
        if (/^Cuota \d+ de \d+$|^Cuota de préstamo$/.test(l.detalle || '')) return '3188';
        return null;
    }
    var COTIZACIONES = ['3141', '3143', '3144', '3151', '3146', '3147', '3154', '3155', '3156', '3157', '3158'];
    var IMPUESTOS = ['3161', '3163', '3164', '3165', '3166', '3167'];

    function sumar(v, cods) { return cods.reduce(function (s, c) { return s + (v[c] || 0); }, 0); }
    function acumular(v, cod, monto) { v[cod] = (v[cod] || 0) + monto; }

    function trabajador(t, res, extra, errores) {
        var quien = texto(t.nombre) || texto(t.rut), v = {}, mal = [];
        if (texto(t.fechaTermino).slice(0, 7) === extra.periodo && res.bases && res.bases.dias > Math.min(30, Number(texto(t.fechaTermino).slice(8, 10)))) {
            errores.push(quien + ': su liquidación guardada paga ' + res.bases.dias + ' días y el contrato terminó el ' + texto(t.fechaTermino).slice(8, 10) + '. Ábrela, vuelve a preparar el mes y guárdala de nuevo.');
            return null;
        }
        function clasificar(lineas, fn, tipo) {
            (lineas || []).forEach(function (l) {
                if (!(l.monto > 0)) return;
                var c = fn(l);
                if (!c) mal.push(tipo + ' «' + l.concepto + '»'); else acumular(v, c, Math.round(l.monto));
            });
        }
        clasificar(res.haberesImponibles, codImponible, 'el haber imponible');
        clasificar(res.haberesNoImponibles, codNoImponible, 'el haber no imponible');
        clasificar(res.descuentosLegales, codLegal, 'el descuento');
        clasificar(res.otrosDescuentos, codOtro, 'el descuento');
        if (mal.length) {
            errores.push(quien + ': no se pudo clasificar en el LRE ' + mal.join(', ') + '. Ponle un nombre que diga qué es (por ejemplo «Pérdida de caja» o «Desgaste de herramientas» en no imponibles) o informa esa línea en Mi DT.');
            return null;
        }

        ((res.empleador && res.empleador.lineas) || []).forEach(function (l) {
            var c = { afc: '4151', mutual: '4152', sis: '4155' }[l.clave];
            if (c && l.monto > 0) acumular(v, c, Math.round(l.monto));
        });

        // Totales: se arman con lo clasificado y tienen que cuadrar con la liquidación
        var hab = Object.keys(v).filter(function (c) { return c.charAt(0) === '2'; });
        var des = Object.keys(v).filter(function (c) { return c.charAt(0) === '3'; });
        v['5201'] = sumar(v, hab);
        v['5210'] = sumar(v, hab.filter(function (c) { return c.slice(0, 2) === '21'; }));
        v['5220'] = sumar(v, hab.filter(function (c) { return c.slice(0, 2) === '22'; }));
        v['5230'] = sumar(v, hab.filter(function (c) { return c.slice(0, 2) === '23'; }));
        v['5240'] = sumar(v, hab.filter(function (c) { return c.slice(0, 2) === '24'; }));
        v['5301'] = sumar(v, des);
        v['5341'] = sumar(v, COTIZACIONES);
        v['5361'] = sumar(v, IMPUESTOS);
        v['5362'] = v['3162'] || 0;
        v['5302'] = v['5301'] - v['5341'] - v['5361'] - v['5362'];
        v['5410'] = sumar(v, Object.keys(v).filter(function (c) { return c.charAt(0) === '4'; }));
        v['5501'] = v['5201'] - v['5301'];
        // Indemnizaciones del finiquito (cód. 2313 a 2316): sin impuesto salvo las tributables (2417, 2418)
        var indem = sumar(v, ['2313', '2314', '2315', '2316', '2331']), indemTrib = sumar(v, ['2417', '2418']);
        if (indem || indemTrib) { v['5502'] = indem + indemTrib; v['5564'] = indemTrib; v['5565'] = indem; }
        if (v['5201'] !== Math.round(res.totalHaberes) || v['5301'] !== Math.round(res.totalDescuentos) || v['5501'] !== Math.round(res.liquido)) {
            errores.push(quien + ': los conceptos clasificados no cuadran con su liquidación (haberes ' + v['5201'] + ' de ' + Math.round(res.totalHaberes) + ', descuentos ' + v['5301'] + ' de ' + Math.round(res.totalDescuentos) + ').');
            return null;
        }
        var cargas = Math.max(0, Math.round(Number(t.afCargas) || 0));
        if (v['2311'] > 0 && !t.afTramo) {
            errores.push(quien + ': recibe asignación familiar y falta el tramo en su ficha.');
            return null;
        }
        return {
            rut: t.rut, nombre: t.nombre, fechaIngreso: t.fechaIngreso, afp: t.afp,
            salud: t.salud === 'isapre' ? 'isapre' : 'fonasa', isapreNombre: t.isapreNombre,
            fechaTermino: t.fechaTermino, causalTermino: t.causalTermino, pension: t.pension, rutSindicato: t.rutSindicato,
            jornadaHoras: t.jornadaHoras, dias: res.bases && res.bases.dias,
            diasLicencia: extra.diasLicencia, diasVacaciones: extra.diasVacaciones,
            cargas: cargas, tramo: v['2311'] > 0 ? t.afTramo : '', conApv: (v['3155'] || 0) + (v['3156'] || 0) > 0,
            v: v
        };
    }

    function armar(datos) {
        var empresa = datos.empresa || {}, periodo = datos.periodo, errores = [], avisos = [], trabajadores = [];
        (datos.items || []).forEach(function (it) {
            if (!it.res || !it.res.bases || !it.res.montos) {
                errores.push((texto(it.t.nombre) || texto(it.t.rut)) + ': su liquidación no se pudo calcular.');
                return;
            }
            var x = trabajador(it.t, it.res, Object.assign({ periodo: periodo }, it), errores);
            if (x) trabajadores.push(x);
        });
        var hayLey21735 = (datos.items || []).some(function (it) {
            return it.res && it.res.empleador && it.res.empleador.lineas.some(function (l) { return (l.clave === 'seguroSocial' || l.clave === 'afp') && l.monto > 0; });
        });
        if (hayLey21735) avisos.push('Los aportes del empleador de la Ley 21.735 (cuenta individual y seguro social) no tienen un código en el suplemento del LRE vigente: no van en el archivo. Revisa si Mi DT los pide.');
        var plazosL = (datos.items || []).filter(function (it) { var t = it.t; return !texto(t.fechaTermino) && t.contrato === 'plazo_fijo' && texto(t.fechaTerminoPlazo).slice(0, 7) === periodo; }).map(function (it) { return texto(it.t.nombre) || texto(it.t.rut); });
        if (plazosL.length) avisos.push('Su plazo fijo vence este mes y no tienen anotado el término del contrato: ' + plazosL.join(', ') + '. Si no siguen, anota el término en su ficha para que el libro los informe con su causal.');
        avisos.push('La comuna y la región de prestación de servicios se toman de la comuna de la empresa.');
        if (errores.length) return { texto: '', filas: [], errores: errores, avisos: avisos, incluidos: 0, nombreArchivo: '' };

        var s = LRE.generar({ periodo: periodo, empleador: empresa, trabajadores: trabajadores, plantilla: datos.plantilla });
        return { texto: s.texto, filas: s.filas, errores: s.errores, avisos: avisos.concat(s.avisos), incluidos: s.filas.length, nombreArchivo: s.nombreArchivo };
    }

    var api = { armar: armar, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeLre = api;
})(typeof window !== 'undefined' ? window : this);
