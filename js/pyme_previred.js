/*
 * CalculoLaboral · archivo para Previred desde el Asistente Pyme (v1.0.0)
 * Funciona en el navegador (window.CLPymePrevired) y en Node (require).
 *
 *   armar({ periodo, empresa, items: [{ t, res }] })
 *       t   = ficha del trabajador; res = resultado de liquidacion_engine.calcular de su mes guardado
 *       → { texto, filas, errores, avisos, incluidos }
 *
 * Usa el generador de 105 campos (js/previred_generador.js). No se conecta con Previred: arma el archivo para
 * que el empleador lo revise y lo cargue con su clave. Lo que la ficha no tiene se rechaza con un error que
 * dice qué dato falta, en vez de adivinarlo.
 */
(function (root) {
    'use strict';

    var PREV = typeof module !== 'undefined' && module.exports ? require('./previred_generador.js') : root.CLPrevired;

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function ddmmaaaa(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(iso));
        return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
    }
    function lineaMonto(lista, prefijo) {
        for (var i = 0; i < (lista || []).length; i++) {
            if (texto(lista[i].concepto).toLowerCase().indexOf(prefijo) === 0) return lista[i].monto;
        }
        return 0;
    }
    function lineaEmpleador(res, clave) {
        var l = res.empleador && res.empleador.lineas || [];
        for (var i = 0; i < l.length; i++) if (l[i].clave === clave) return l[i].monto;
        return 0;
    }

    // Sin apellidos en la ficha se separan del nombre completo (los dos últimos): se avisa para que se revise.
    function partesNombre(t) {
        var ap = texto(t.apellidoPaterno), am = texto(t.apellidoMaterno);
        if (ap) {
            var nombres = texto(t.nombre);
            // «Nombre completo» trae también los apellidos: se quitan del final si coinciden
            var fin = (ap + ' ' + am).trim().toLowerCase();
            if (nombres.toLowerCase().slice(-fin.length) === fin) nombres = nombres.slice(0, nombres.length - fin.length).trim();
            return { apellidoPaterno: ap, apellidoMaterno: am, nombres: nombres, derivado: false };
        }
        var p = texto(t.nombre).split(/\s+/).filter(Boolean);
        if (p.length >= 3) return { apellidoPaterno: p[p.length - 2], apellidoMaterno: p[p.length - 1], nombres: p.slice(0, p.length - 2).join(' '), derivado: true };
        if (p.length === 2) return { apellidoPaterno: p[1], apellidoMaterno: '', nombres: p[0], derivado: true };
        return { apellidoPaterno: '', apellidoMaterno: '', nombres: p.join(' '), derivado: true };
    }

    function esChilena(nac) {
        var n = texto(nac).toLowerCase();
        return !n || n.indexOf('chile') === 0;
    }

    function movimiento(t, periodo) {
        // Retiro: el mes del término del contrato (movimiento 2, con la fecha de término)
        var fin = texto(t.fechaTermino);
        if (fin && fin.slice(0, 7) === periodo) return { codigo: '2', desde: '', hasta: ddmmaaaa(fin) };
        var ing = texto(t.fechaIngreso);
        if (ing && ing.slice(0, 7) === periodo) {
            var plazo = t.contrato === 'plazo_fijo' || t.contrato === 'obra';
            return { codigo: plazo ? '7' : '1', desde: ddmmaaaa(ing), hasta: '' };
        }
        return { codigo: '0', desde: '', hasta: '' };
    }

    function trabajador(t, res, periodo) {
        var n = partesNombre(t);
        var b = res.bases || {}, m = res.montos || {};
        var esFonasa = t.salud !== 'isapre';
        var leg = res.descuentosLegales || [];
        var salud7 = lineaMonto(leg, 'salud');   // la línea «Salud … (7%)»: lo obligatorio; el plan pactado va aparte
        var jornada = Number(t.jornadaHoras) || 0;
        return {
            rut: t.rut,
            apellidoPaterno: n.apellidoPaterno, apellidoMaterno: n.apellidoMaterno, nombres: n.nombres,
            sexo: t.sexo,
            nacionalidad: esChilena(t.nacionalidad) ? '0' : '1',
            afp: t.afp,
            salud: esFonasa ? 'Fonasa' : texto(t.isapreNombre),
            isapreMoneda: esFonasa ? '' : 'UF',
            planUF: t.isaprePlanUF,
            fun: t.fun || '',
            dias: b.dias,
            rentaAfp: b.baseAfp || 0,
            jornadaHoras: jornada,
            cotizacionAfp: m.afp || 0,
            sis: lineaEmpleador(res, 'sis'),
            cotizacionSalud: esFonasa ? (m.salud || 0) : 0,
            rentaIsapre: esFonasa ? 0 : (b.baseAfp || 0),
            cotizacionIsapre: esFonasa ? 0 : salud7,
            rentaMutual: b.baseAfp || 0,
            cotizacionMutual: lineaEmpleador(res, 'mutual'),
            rentaAfc: b.baseAfc || 0,
            aporteTrabajadorAfc: m.afc || 0,
            aporteEmpleadorAfc: lineaEmpleador(res, 'afc'),
            apvMonto: m.apv || 0,
            apvContrato: t.apvContrato || '',
            tramoAF: t.afTramo || 'D',
            cargas: t.afCargas || 0,
            asignacionFamiliar: lineaMonto(res.haberesNoImponibles, 'asignaci'),
            tipoTrabajador: '0',
            movimiento: movimiento(t, periodo),
            _derivado: n.derivado
        };
    }

    function armar(datos) {
        var empresa = datos.empresa || {}, periodo = datos.periodo;
        var items = datos.items || [];
        var errores = [], avisos = [], trabajadores = [];

        if (!texto(empresa.mutual)) errores.push('Falta la mutualidad de la empresa (ACHS, Mutual, IST o ISL): ponla en «Tu empresa».');

        items.forEach(function (it) {
            var t = it.t, res = it.res, quien = texto(t.nombre) || texto(t.rut);
            if (t.sexo !== 'M' && t.sexo !== 'F') { errores.push(quien + ': falta el sexo en su ficha (Previred lo pide).'); return; }
            if (!res || !res.bases || !res.montos) { errores.push(quien + ': su liquidación no se pudo calcular.'); return; }
            if (!res.empleador) { errores.push(quien + ': la liquidación no trae las cotizaciones del empleador.'); return; }
            if ((res.montos.apv || 0) > 0 && !texto(t.apvContrato)) { errores.push(quien + ': tiene APV y falta el número de contrato en su ficha.'); return; }
            if (lineaMonto(res.haberesNoImponibles, 'asignaci') > 0 && !t.afTramo) { errores.push(quien + ': recibe asignación familiar y falta el tramo en su ficha.'); return; }
            if (texto(t.fechaTermino) && texto(t.fechaTermino).slice(0, 7) === periodo && texto(t.fechaIngreso).slice(0, 7) === periodo) avisos.push(quien + ': ingresó y terminó en el mismo mes; Previred admite un solo movimiento por línea y el archivo informa el retiro. Revisa si necesita además el ingreso.');
            if (texto(t.fechaTermino).slice(0, 7) === periodo && res.bases.dias > Math.min(30, Number(texto(t.fechaTermino).slice(8, 10)))) { errores.push(quien + ': su liquidación guardada paga ' + res.bases.dias + ' días y el contrato terminó el ' + texto(t.fechaTermino).slice(8, 10) + '. Ábrela, vuelve a preparar el mes y guárdala de nuevo.'); return; }
            var x = trabajador(t, res, periodo);
            if (x._derivado) avisos.push(quien + ': los apellidos se separaron del nombre completo; revísalos en el archivo o agrégalos en su ficha.');
            delete x._derivado;
            if (t.fechaNacimiento) {
                var edad = (Number(periodo.slice(0, 4)) - Number(t.fechaNacimiento.slice(0, 4)));
                if (edad >= 60) avisos.push(quien + ': tiene ' + edad + ' años; revisa si en Previred corresponde un tipo de trabajador distinto de «activo» (pensionado o mayor de 65).');
            }
            trabajadores.push(x);
        });

        if (empresa.ccaf) avisos.push('La empresa está afiliada a una caja de compensación: el archivo informa la renta, pero no calcula sus cotizaciones ni créditos; revísalos en Previred.');
        var plazos = items.filter(function (it) { var t = it.t; return !texto(t.fechaTermino) && t.contrato === 'plazo_fijo' && texto(t.fechaTerminoPlazo).slice(0, 7) === periodo; }).map(function (it) { return texto(it.t.nombre) || texto(it.t.rut); });
        if (plazos.length) avisos.push('Su plazo fijo vence este mes y no tienen anotado el término del contrato: ' + plazos.join(', ') + '. Si no siguen, anota el término en su ficha para que salgan como retiro; si continúan, actualiza su contrato.');

        if (errores.length) return { texto: '', filas: [], errores: errores, avisos: avisos, incluidos: 0 };

        var salida = PREV.generar({ periodo: periodo, empleador: { mutual: empresa.mutual, ccaf: empresa.ccaf || '' }, trabajadores: trabajadores });
        return { texto: salida.texto, filas: salida.filas, errores: salida.errores, avisos: avisos.concat(salida.avisos || []), incluidos: salida.filas.length };
    }

    var api = { armar: armar, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymePrevired = api;
})(typeof window !== 'undefined' ? window : this);
