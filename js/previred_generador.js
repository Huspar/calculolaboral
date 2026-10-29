/*
 * CálculoLaboral — archivo de nómina para Previred, formato largo variable por ";"
 * (105 campos, versión 58 del documento oficial: tools/previred/especificacion-105.json).
 *
 * Uso:
 *   var salida = CLPrevired.generar({ periodo: '2026-10', empleador: {...}, trabajadores: [...] });
 *   salida.texto    // el .txt
 *   salida.errores  // si hay algo, NO se debe subir el archivo
 *   salida.avisos   // cosas que el contador debe revisar
 *
 * Nada de esto se conecta con Previred: genera el archivo y lo valida.
 * Lo que la v1 no cubre se rechaza con un error explícito en vez de adivinar.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CLPrevired = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SEP = ';';
    var CAMPOS = 105;

    // Tablas de equivalencia del documento oficial
    var AFP = { cuprum: '03', habitat: '05', provida: '08', planvital: '29', capital: '33', modelo: '34', uno: '35' };
    var SALUD = {
        'banmedica': '01', 'consalud': '02', 'vidatres': '03', 'colmena': '04', 'cruzblanca': '05',
        'nuevamasvida': '10', 'codelco': '11', 'bcoestado': '12', 'cruzdelnorte': '25', 'fonasa': '07'
    };
    var MUTUAL = {
        'achs': '01', 'asociacionchilenadeseguridad': '01',
        'mutual': '02', 'mutualdeseguridad': '02', 'cchc': '02',
        'ist': '03', 'institutodeseguridaddeltrabajo': '03',
        'isl': '00', 'sinmutual': '00'
    };
    var CCAF = { losandes: '01', araucana: '02', losheroes: '03', '18septiembre': '06' };

    function texto(v) {
        return String(v === null || v === undefined ? '' : v).trim();
    }
    function entero(v) {
        var n = Number(v);
        return isFinite(n) ? String(Math.round(n)) : '0';
    }
    function monto(v) {
        var n = Math.round(Number(v) || 0);
        return n > 0 ? String(n) : '0';
    }
    function sinTildes(s) {
        return texto(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }
    /* Nombres en ASCII: el archivo viaja como texto plano y evita dudas de codificación. */
    function ascii(s) {
        return texto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
    }
    function mmAAAA(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(texto(periodo));
        return m ? (m[2] + m[1]) : '';
    }
    function partirRut(rut) {
        var s = texto(rut).replace(/[.,\s]/g, '').toUpperCase();
        var m = /^(\d{1,9})-?([\dK])$/.exec(s);
        return m ? { cuerpo: m[1], dv: m[2] } : null;
    }
    function dvValido(cuerpo, dv) {
        var suma = 0, mult = 2;
        for (var i = cuerpo.length - 1; i >= 0; i--) {
            suma += Number(cuerpo.charAt(i)) * mult;
            mult = mult === 7 ? 2 : mult + 1;
        }
        var resto = 11 - (suma % 11);
        var esperado = resto === 11 ? '0' : (resto === 10 ? 'K' : String(resto));
        return esperado === String(dv).toUpperCase();
    }
    function codigoDe(tabla, valor, nombre) {
        var k = sinTildes(valor);
        if (tabla[k]) return tabla[k];
        var claves = Object.keys(tabla).sort(function (a, b) { return b.length - a.length; });
        for (var i = 0; i < claves.length; i++) {
            if (claves[i].length >= 3 && k.indexOf(claves[i]) >= 0) return tabla[claves[i]];
        }
        throw new Error(nombre + ' no reconocida: "' + texto(valor) + '"');
    }

    /* Una línea de 105 campos. Devuelve array de strings. */
    function lineas(t, e) {
        var r = partirRut(t.rut);
        if (!r) throw new Error('RUT inválido: "' + texto(t.rut) + '"');
        if (!dvValido(r.cuerpo, r.dv)) throw new Error('Dígito verificador incorrecto en ' + r.cuerpo + '-' + r.dv);

        var per = mmAAAA(e.periodo);
        if (!per) throw new Error('Período inválido: "' + texto(e.periodo) + '" (se espera AAAA-MM)');

        var afpCodigo = codigoDe(AFP, t.afp, 'AFP');
        var saludCodigo = codigoDe(SALUD, t.salud, 'Institución de salud');
        var mutualCodigo = codigoDe(MUTUAL, e.mutual, 'Mutualidad');
        var ccafCodigo = e.ccaf ? codigoDe(CCAF, e.ccaf, 'CCAF') : '00';
        var esFonasa = saludCodigo === '07';

        if (!esFonasa && !t.rentaIsapre) throw new Error('Isapre sin renta imponible.');
        if (!esFonasa && !t.cotizacionIsapre) throw new Error('Isapre sin cotización obligatoria.');
        if (!esFonasa && texto(t.isapreMoneda) === 'UF') throw new Error('Isapre en UF: la v1 no informa planes en UF. Se resuelve con el piloto.');
        if (!t.cotizacionAfp && afpCodigo !== '00') throw new Error('Falta la cotización de AFP.');
        if (!t.cotizacionMutual) throw new Error('Falta la cotización de mutualidad.');

        var c = [];
        c[1] = r.cuerpo;                                     // RUT trabajador
        c[2] = r.dv;                                         // DV
        c[3] = ascii(t.apellidoPaterno).slice(0, 30);
        c[4] = ascii(t.apellidoMaterno).slice(0, 30);
        c[5] = ascii(t.nombres).slice(0, 30);
        c[6] = texto(t.sexo).toUpperCase() === 'F' ? 'F' : 'M';
        c[7] = texto(t.nacionalidad) === '1' ? '1' : '0';      // 0 chileno, 1 extranjero
        c[8] = '01';                                          // tipo nómina: remuneraciones del mes
        c[9] = per;                                           // período desde mmaaaa
        c[10] = '';                                           // período hasta
        c[11] = 'AFP';
        c[12] = '0';                                          // trabajador activo
        c[13] = entero(t.dias || 30);
        c[14] = '00';                                         // línea principal
        c[15] = '0';                                          // sin movimiento en el mes
        c[16] = '';
        c[17] = '';
        c[18] = 'D';                                          // sin derecho a asignación familiar
        c[19] = '0';
        c[20] = '0';
        c[21] = '0';
        c[22] = '0';
        c[23] = '0';
        c[24] = '0';
        c[25] = 'N';
        c[26] = afpCodigo;
        c[27] = monto(t.rentaAfp);
        c[28] = monto(t.cotizacionAfp);
        c[29] = monto(t.sis);
        c[30] = '0';
        c[31] = '0';
        c[32] = '0';                                          // por confirmar en la especificación
        c[33] = '0';
        c[34] = '0';
        c[35] = '';
        c[36] = '';
        c[37] = '';
        c[38] = '0';                                          // por confirmar en la especificación
        c[39] = '0';
        c[40] = '0';
        c[41] = '';
        c[42] = '0';
        c[43] = '0';
        c[44] = '0';
        c[45] = '0';
        c[46] = '';
        c[47] = '0';
        c[48] = '0';
        c[49] = '0';
        c[50] = '0';
        c[51] = '';
        c[52] = '';
        c[53] = '';
        c[54] = '';
        c[55] = '0';
        c[56] = '';
        c[57] = '';
        c[58] = '0';
        c[59] = '0';
        c[60] = '0';
        c[61] = '0';
        c[62] = '0';
        c[63] = '0';
        c[64] = '0';
        c[65] = '0';
        c[66] = '0';
        c[67] = '0';
        c[68] = '0';
        c[69] = '0';
        c[70] = esFonasa ? monto(t.cotizacionSalud) : '0';
        c[71] = '0';                                          // cotización ISL
        c[72] = '0';
        c[73] = '0';
        c[74] = '0';
        c[75] = saludCodigo;
        c[76] = esFonasa ? '' : texto(t.fun).slice(0, 16);
        c[77] = esFonasa ? '0' : monto(t.rentaIsapre);
        c[78] = esFonasa ? '0' : '1';                         // 1 pesos, 2 UF
        c[79] = esFonasa ? '0' : monto(t.cotizacionPactada || t.cotizacionIsapre);
        c[80] = esFonasa ? '0' : monto(t.cotizacionIsapre);
        c[81] = '0';
        c[82] = '0';
        c[83] = ccafCodigo;
        c[84] = ccafCodigo === '00' ? '0' : monto(t.rentaAfp);
        c[85] = '0';
        c[86] = '0';
        c[87] = '0';
        c[88] = '0';
        c[89] = '0';
        c[90] = '0';
        c[91] = '0';
        c[92] = '0';
        c[93] = '0';
        c[94] = '0';
        c[95] = '';
        c[96] = mutualCodigo;
        c[97] = monto(t.rentaMutual || t.rentaAfp);
        c[98] = monto(t.cotizacionMutual);
        c[99] = '0';
        c[100] = monto(t.rentaAfc || t.rentaAfp);
        c[101] = monto(t.aporteTrabajadorAfc);
        c[102] = monto(t.aporteEmpleadorAfc);
        c[103] = '0';
        c[104] = '';
        c[105] = ascii(t.centroCosto).slice(0, 20);

        var salida = [];
        for (var i = 1; i <= CAMPOS; i++) {
            var v = c[i];
            if (v === undefined) v = i >= 85 && i <= 94 ? '0' : '';
            salida.push(texto(v));
        }
        return salida;
    }

    function generar(datos) {
        var errores = [], avisos = [], filas = [];
        var e = {};
        var src = datos.empleador || {};
        for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) e[k] = src[k];
        if (!e.periodo) e.periodo = datos.periodo;
        if (!datos.periodo) errores.push('Falta el período.');
        if (!e.mutual) errores.push('Falta la mutualidad del empleador (ACHS, Mutual o IST).');

        (datos.trabajadores || []).forEach(function (t, i) {
            var quien = texto(t.nombres) + ' ' + texto(t.apellidoPaterno) || ('fila ' + (i + 1));
            try {
                filas.push(lineas(t, e).join(SEP));
            } catch (err) {
                errores.push(quien.trim() + ': ' + err.message);
            }
        });

        if (!filas.length && !errores.length) errores.push('No hay trabajadores.');
        if (errores.length) return { texto: '', filas: filas, errores: errores, avisos: avisos };

        return { texto: filas.join('\r\n') + '\r\n', filas: filas, errores: [], avisos: avisos };
    }

    /* Revisa un archivo ya armado: 105 campos, dígitos en los numéricos, DV. */
    function validar(textoArchivo) {
        var problemas = [];
        var lineasArchivo = textoArchivo.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (!lineasArchivo.length) problemas.push('El archivo está vacío.');
        lineasArchivo.forEach(function (l, i) {
            var f = l.split(SEP);
            if (f.length !== CAMPOS) problemas.push('Línea ' + (i + 1) + ': tiene ' + f.length + ' campos y deben ser ' + CAMPOS + '.');
            if (f.length > 1 && !dvValido(f[0], f[1])) problemas.push('Línea ' + (i + 1) + ': RUT ' + f[0] + '-' + f[1] + ' con dígito verificador incorrecto.');
            [27, 28, 29, 70, 77, 79, 80, 97, 98, 100, 101, 102].forEach(function (n) {
                if (f[n] !== undefined && !/^\d+$/.test(f[n])) problemas.push('Línea ' + (i + 1) + ', campo ' + n + ': "' + f[n] + '" no es numérico.');
            });
        });
        return problemas;
    }

    return { generar: generar, validar: validar, campos: CAMPOS, tablas: { AFP: AFP, SALUD: SALUD, MUTUAL: MUTUAL, CCAF: CCAF }, partirRut: partirRut, dvValido: dvValido };
}));
