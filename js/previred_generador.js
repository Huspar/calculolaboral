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
    /* Plan de Isapre en UF: 8 dígitos con 4 decimales implícitos (4,0241 -> 00040241). */
    function ufPlan(v) {
        var n = Math.round(Number(v) * 10000);
        var s = String(n > 0 ? n : 0);
        while (s.length < 8) s = '0' + s;
        return s;
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
        var esPlanUF = !esFonasa && texto(t.isapreMoneda).toUpperCase() === 'UF';

        if (!esFonasa && !t.rentaIsapre) throw new Error('Isapre sin renta imponible.');
        if (!esFonasa && !t.cotizacionIsapre) throw new Error('Isapre sin cotización obligatoria.');
        if (!esFonasa && texto(t.isapreMoneda).toUpperCase() === 'UF' && !(Number(t.planUF) > 0)) {
            throw new Error('Isapre en UF sin plan pactado.');
        }
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
        var tipoTrab = texto(t.tipoTrabajador) || '0';
        if (!/^[0-3]$/.test(tipoTrab)) throw new Error('Tipo de trabajador inválido: "' + tipoTrab + '"');
        c[12] = tipoTrab;                                     // 0 activo, 1/2 pensionado, 3 mayor de 65
        c[13] = entero(t.dias || 30);
        c[14] = '00';                                         // línea principal
        var mov = t.movimiento || {};
        var movCodigo = texto(mov.codigo || '0');
        if (!/^\d{1,2}$/.test(movCodigo)) throw new Error('Código de movimiento inválido: "' + movCodigo + '"');
        var fechaOk = /^\d{2}-\d{2}-\d{4}$/;
        if (movCodigo !== '0') {
            if (movCodigo === '2') {
                if (!fechaOk.test(texto(mov.hasta))) throw new Error('El retiro necesita fecha de término en formato dd-mm-aaaa.');
            } else if (!fechaOk.test(texto(mov.desde))) {
                throw new Error('El movimiento de personal necesita fecha desde en formato dd-mm-aaaa.');
            }
        }
        c[15] = movCodigo;                                    // movimiento de personal
        c[16] = movCodigo === '0' ? '' : texto(mov.desde);
        c[17] = movCodigo === '0' ? '' : texto(mov.hasta);
        var tramo = String(texto(t.tramoAF) || 'D').toUpperCase();
        if (!/^[ABCD]$/.test(tramo)) throw new Error('Tramo de asignación familiar inválido: "' + texto(t.tramoAF) + '"');
        var cargas = Math.max(0, Math.round(Number(t.cargas) || 0));
        c[18] = tramo;
        c[19] = String(cargas);
        c[20] = '0';
        c[21] = '0';
        c[22] = monto(t.asignacionFamiliar);
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
        // 40 a 43: APV del trabajador en su propia AFP (tabla 12: forma de pago 1 = directa).
        var apv = Math.max(0, Math.round(Number(t.apvMonto) || 0));
        c[40] = apv > 0 ? afpCodigo : '0';
        c[41] = apv > 0 ? texto(t.apvContrato).slice(0, 20) : '';
        c[42] = apv > 0 ? '1' : '0';
        c[43] = monto(apv);
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
        c[78] = esFonasa ? '0' : (esPlanUF ? '2' : '1');
        c[79] = esFonasa ? '0' : (esPlanUF ? ufPlan(t.planUF) : monto(t.cotizacionPactada || t.cotizacionIsapre));
        c[80] = esFonasa ? '0' : monto(t.cotizacionIsapre);
        c[81] = '0';
        c[82] = '0';
        c[83] = ccafCodigo;
        c[84] = ccafCodigo === '00' ? '0' : monto(t.rentaAfp);
        c[85] = ccafCodigo === '00' ? '0' : monto(t.creditoCCAF);   // créditos personales de la caja, retenidos al trabajador
        c[86] = '0';
        c[87] = '0';
        c[88] = '0';
        c[89] = '0';
        c[90] = '0';
        c[91] = '0';
        // 92 a 95: desde la versión 100 del formulario son licencia, jornada y las dos
        // cotizaciones del 1,62% del empleador (0,72% expectativa de vida y 0,90% rentabilidad
        // protegida). La 0,90% no se aplica a la RIMA; la 0,72% sí.
        var rima = Math.max(0, Math.round(Number(t.rima) || 0));
        var baseSeguro = Math.max(0, Math.round(Number(t.rentaAfp) || 0));
        var jornadaHoras = Number(t.jornadaHoras) || 0;
        c[92] = monto(rima);
        c[93] = jornadaHoras > 0 && jornadaHoras <= 30 ? '2' : '1';
        c[94] = monto(Math.round((baseSeguro + rima) * 0.0072));
        c[95] = monto(Math.round(baseSeguro * 0.0090));
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

    /* Arma el archivo a partir del lote de liquidaciones de la demo. */
    function partesNombre(record) {
        var ap = ascii(record.apPaterno);
        var am = ascii(record.apMaterno);
        var nom = ascii(record.nombres);
        if (nom) return { apellidoPaterno: ap, apellidoMaterno: am, nombres: nom };
        var p = ascii(record.nombre).split(/\s+/).filter(Boolean);
        if (p.length >= 3) {
            return { apellidoPaterno: p[p.length - 2], apellidoMaterno: p[p.length - 1], nombres: p.slice(0, p.length - 2).join(' ') };
        }
        if (p.length === 2) return { apellidoPaterno: p[1], apellidoMaterno: '', nombres: p[0] };
        return { apellidoPaterno: '', apellidoMaterno: '', nombres: p.join(' ') };
    }

    function buscarMonto(lista, prefijo) {
        for (var i = 0; i < (lista || []).length; i++) {
            if (texto(lista[i].concepto).toLowerCase().indexOf(prefijo) === 0) return lista[i].monto;
        }
        return 0;
    }

    function buscarClave(lista, clave) {
        for (var i = 0; i < (lista || []).length; i++) {
            if (lista[i].clave === clave) return lista[i].monto;
        }
        return 0;
    }

    /* Movimiento de personal (Tabla 7): texto del Excel -> código de Previred. */
    function codigoMovimiento(valor, contrato) {
        var v = sinTildes(valor);
        if (!v || v === '0' || v.indexOf('sin') === 0 || v.indexOf('ningun') === 0) return '0';
        if (v.indexOf('retiro') === 0 || v.indexOf('baja') === 0 || v.indexOf('finiquito') === 0) return '2';
        if (v.indexOf('alta') === 0 || v.indexOf('contrat') === 0 || v.indexOf('ingreso') === 0) {
            return /plazo|fijo|obra|faena/.test(sinTildes(contrato)) ? '7' : '1';
        }
        if (/^\d{1,2}$/.test(v)) return v;
        throw new Error('Movimiento de personal no reconocido: "' + texto(valor) + '"');
    }

    function desdeLiquidaciones(resultados, opciones) {
        var o = opciones || {};
        var trabajadores = (resultados || []).filter(function (r) { return r && r.detalle && !r.error; }).map(function (r) {
            var rec = r.record || {}, d = r.detalle || {}, emp = d.empleador || {};
            var n = partesNombre(rec);
            var esFonasa = rec.salud !== 'isapre';
            return {
                rut: rec.rut,
                apellidoPaterno: n.apellidoPaterno,
                apellidoMaterno: n.apellidoMaterno,
                nombres: n.nombres,
                sexo: rec.sexo,
                nacionalidad: rec.nacionalidad || '0',
                afp: rec.afp,
                salud: esFonasa ? 'Fonasa' : (rec.isapreNombre || ''),
                isapreMoneda: esFonasa ? '' : 'UF',
                planUF: rec.planUF,
                fun: rec.fun || '',
                dias: rec.dias,
                rentaAfp: d.bases ? d.bases.baseAfp : 0,
                jornadaHoras: rec.jornada,
                rima: rec.rima,
                cotizacionAfp: buscarMonto(d.descuentosLegales, 'afp'),
                sis: buscarClave(emp.lineas, 'sis'),
                cotizacionSalud: buscarMonto(d.descuentosLegales, 'salud'),
                rentaIsapre: esFonasa ? 0 : (d.bases ? d.bases.baseAfp : 0),
                cotizacionIsapre: esFonasa ? 0 : buscarMonto(d.descuentosLegales, 'salud'),
                rentaMutual: d.bases ? d.bases.baseAfp : 0,
                cotizacionMutual: buscarClave(emp.lineas, 'mutual'),
                rentaAfc: d.bases ? d.bases.baseAfc : 0,
                aporteTrabajadorAfc: buscarMonto(d.descuentosLegales, 'seguro de cesant'),
                aporteEmpleadorAfc: buscarClave(emp.lineas, 'afc'),
                centroCosto: rec.centroCosto,
                nacionalidad: rec.nacionalidad,
                tipoTrabajador: rec.tipoTrabajador,
                creditoCCAF: d.montos ? d.montos.creditoCCAF : 0,
                apvMonto: rec.apvMonto,
                apvContrato: rec.apvContrato,
                tramoAF: rec.tramoAF,
                cargas: rec.cargas,
                asignacionFamiliar: buscarMonto(d.haberesNoImponibles, 'asignaci'),
                movimiento: {
                    codigo: codigoMovimiento(rec.movimiento, rec.contrato),
                    desde: rec.movDesde,
                    hasta: rec.movHasta
                }
            };
        });
        return generar({ periodo: o.periodo, empleador: { mutual: o.mutual, ccaf: o.ccaf }, trabajadores: trabajadores });
    }

    /* Suma de cotizaciones del archivo, para cuadrar contra las liquidaciones. */
    function totales(filas) {
        var t = { afp: 0, sis: 0, salud: 0, mutual: 0, afcTrabajador: 0, afcEmpleador: 0, lineas: 0, total: 0 };
        (filas || []).forEach(function (l) {
            var f = l.split(SEP);
            if (f.length !== CAMPOS) return;
            t.lineas++;
            t.afp += Number(f[27]) || 0;
            t.sis += Number(f[28]) || 0;
            t.salud += (Number(f[69]) || 0) + (Number(f[79]) || 0);
            t.mutual += Number(f[97]) || 0;
            t.afcTrabajador += Number(f[100]) || 0;
            t.afcEmpleador += Number(f[101]) || 0;
        });
        t.total = t.afp + t.sis + t.salud + t.mutual + t.afcTrabajador + t.afcEmpleador;
        return t;
    }

    return { generar: generar, desdeLiquidaciones: desdeLiquidaciones, validar: validar, totales: totales, campos: CAMPOS, tablas: { AFP: AFP, SALUD: SALUD, MUTUAL: MUTUAL, CCAF: CCAF }, partirRut: partirRut, dvValido: dvValido };
}));
