/*
 * CalculoLaboral · nómina de pagos y asiento contable del mes (Asistente Pyme, v1.0.0)
 * Funciona en el navegador (window.CLPymePagos) y en Node (require).
 *
 *   nomina({ periodoNombre, items: [{ t, res }] })  → { texto, incluidos, omitidos: [{ nombre, motivo }], total }
 *   asiento({ periodoNombre, cuentas, items })      → { texto, filas, debe, haber, cuadra }
 *   CUENTAS                                         → [{ k, glosa, lado }] las cuentas del asiento, para pedir los códigos
 *
 * Nómina: una planilla genérica (RUT, nombre, banco, tipo y número de cuenta, monto líquido). No es el formato de ningún banco:
 * cada banco pide el suyo y solo se agregan los que se pueden confirmar con su documentación pública. No transfiere nada.
 * Asiento: una línea por concepto con el código de cuenta que el contador puso para esa empresa; debe y haber cuadran siempre
 * porque salen de la misma liquidación (haberes + aportes del empleador = líquido + descuentos + aportes del empleador).
 */
(function (root) {
    'use strict';

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function celda(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function fila(c) { return c.map(celda).join(';'); }
    function entero(n) { return Math.round(Number(n) || 0); }

    var TIPOS_CUENTA = { corriente: 'Cuenta corriente', vista: 'Cuenta vista o RUT', ahorro: 'Cuenta de ahorro' };

    function nomina(datos) {
        var lineas = [], incluidos = 0, omitidos = [], total = 0;
        lineas.push(fila(['Nómina de pagos de ' + datos.periodoNombre, '', '', '', '', '', '']));
        lineas.push(fila(['Planilla genérica para revisar: no es el formato de ningún banco y no transfiere nada.', '', '', '', '', '', '']));
        lineas.push('');
        lineas.push(fila(['RUT', 'Nombre', 'Banco', 'Tipo de cuenta', 'Número de cuenta', 'Monto a pagar', 'Glosa']));
        (datos.items || []).forEach(function (it) {
            var t = it.t, monto = entero(it.res && it.res.liquido), quien = texto(t.nombre) || texto(t.rut);
            if (monto <= 0) { omitidos.push({ nombre: quien, motivo: 'su líquido es cero.' }); return; }
            var faltan = [];
            if (!texto(t.banco)) faltan.push('banco');
            if (!TIPOS_CUENTA[t.tipoCuenta]) faltan.push('tipo de cuenta');
            if (!/^\d{4,20}$/.test(texto(t.numeroCuenta).replace(/[\s.-]/g, ''))) faltan.push('número de cuenta');
            if (faltan.length) { omitidos.push({ nombre: quien, motivo: 'falta ' + faltan.join(', ') + ' en su ficha.' }); return; }
            lineas.push(fila([texto(t.rut), quien, texto(t.banco), TIPOS_CUENTA[t.tipoCuenta], texto(t.numeroCuenta).replace(/[\s.-]/g, ''), monto, 'Remuneración ' + datos.periodoNombre]));
            incluidos++; total += monto;
        });
        lineas.push('');
        lineas.push(fila(['', 'Total', '', '', '', total, '']));
        return { texto: lineas.join('\r\n') + '\r\n', incluidos: incluidos, omitidos: omitidos, total: total };
    }

    // Cuentas del asiento: el contador pone el código de cada una (el de su plan de cuentas); si no pone ninguno sale solo la glosa
    var CUENTAS = [
        { k: 'sueldos', glosa: 'Sueldos y haberes imponibles', lado: 'debe' },
        { k: 'noImponibles', glosa: 'Haberes no imponibles (colación, movilización y otros)', lado: 'debe' },
        { k: 'cotEmpleador', glosa: 'Cotizaciones de cargo del empleador', lado: 'debe' },
        { k: 'liquido', glosa: 'Remuneraciones por pagar', lado: 'haber' },
        { k: 'afp', glosa: 'AFP por pagar', lado: 'haber' },
        { k: 'salud', glosa: 'Salud por pagar', lado: 'haber' },
        { k: 'cesantia', glosa: 'Seguro de cesantía por pagar', lado: 'haber' },
        { k: 'seguros', glosa: 'SIS y seguro social por pagar', lado: 'haber' },
        { k: 'mutual', glosa: 'Mutual o ISL por pagar', lado: 'haber' },
        { k: 'impuesto', glosa: 'Impuesto único por pagar', lado: 'haber' },
        { k: 'apv', glosa: 'APV por pagar', lado: 'haber' },
        { k: 'otros', glosa: 'Anticipos, préstamos y otros descuentos', lado: 'haber' }
    ];

    function linea(res, clave) {
        var l = (res.empleador && res.empleador.lineas) || [];
        for (var i = 0; i < l.length; i++) if (l[i].clave === clave) return entero(l[i].monto);
        return 0;
    }

    function asiento(datos) {
        var m = {};
        CUENTAS.forEach(function (c) { m[c.k] = 0; });
        var errores = [];
        (datos.items || []).forEach(function (it) {
            var r = it.res;
            if (!r || !r.montos || !r.empleador) { errores.push((texto(it.t && it.t.nombre) || 'Un trabajador') + ': su liquidación no trae las cotizaciones del empleador.'); return; }
            var emp = { afp: linea(r, 'afp'), sis: linea(r, 'sis'), ss: linea(r, 'seguroSocial'), afc: linea(r, 'afc'), mutual: linea(r, 'mutual') };
            m.sueldos += entero(r.totalImponible);
            m.noImponibles += entero(r.totalNoImponible);
            m.cotEmpleador += emp.afp + emp.sis + emp.ss + emp.afc + emp.mutual;
            m.liquido += entero(r.liquido);
            m.afp += entero(r.montos.afp) + emp.afp;
            m.salud += entero(r.montos.salud);
            m.cesantia += entero(r.montos.afc) + emp.afc;
            m.seguros += emp.sis + emp.ss;
            m.mutual += emp.mutual;
            m.impuesto += entero(r.montos.impuesto);
            m.apv += entero(r.montos.apv);
            m.otros += entero(r.totalOtros);
        });
        var cuentas = datos.cuentas || {}, filas = [], debe = 0, haber = 0;
        CUENTAS.forEach(function (c) {
            if (!m[c.k]) return;
            filas.push({ cuenta: texto(cuentas[c.k]), glosa: c.glosa, debe: c.lado === 'debe' ? m[c.k] : 0, haber: c.lado === 'haber' ? m[c.k] : 0 });
            if (c.lado === 'debe') debe += m[c.k]; else haber += m[c.k];
        });
        var lineas = [];
        lineas.push(fila(['Asiento de remuneraciones de ' + datos.periodoNombre, '', '', '']));
        lineas.push(fila(['Hecho con el Asistente Laboral Pyme a partir de las liquidaciones guardadas. Revísalo antes de contabilizarlo.', '', '', '']));
        lineas.push('');
        lineas.push(fila(['Cuenta', 'Glosa', 'Debe', 'Haber']));
        filas.forEach(function (f) { lineas.push(fila([f.cuenta, f.glosa, f.debe || '', f.haber || ''])); });
        lineas.push('');
        lineas.push(fila(['', 'Totales', debe, haber]));
        return { texto: lineas.join('\r\n') + '\r\n', filas: filas, debe: debe, haber: haber, cuadra: debe === haber, errores: errores, sinCodigos: filas.filter(function (f) { return !f.cuenta; }).length };
    }

    var api = { nomina: nomina, asiento: asiento, CUENTAS: CUENTAS, TIPOS_CUENTA: TIPOS_CUENTA, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymePagos = api;
})(typeof window !== 'undefined' ? window : this);
