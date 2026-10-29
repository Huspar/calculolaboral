/*
 * CálculoLaboral — archivo de carga masiva del Libro de Remuneraciones Electrónico (LRE) de la Dirección del Trabajo.
 *
 * Formato (manual de usuarios del LRE, §6.2 y §7; suplemento técnico):
 *   - CSV o TXT con ";" como separador, una fila de encabezados y una fila por trabajador.
 *   - Se informan todas las columnas del Anexo 1 en su orden; las opcionales sin dato van vacías.
 *   - Fechas dd/mm/aaaa, RUT con guion y sin puntos, montos enteros mayores o iguales a cero.
 *   - Codificación ANSI (Windows-1252). Nombre del archivo: rutempleador_aaaamm (RUT sin guion, con dígito verificador).
 *
 * Uso:
 *   var s = CLLre.generar({ periodo: '2026-10', empleador: { rut, mutual, ccaf, comuna }, trabajadores: [t, ...], plantilla: '<primera línea del CSV base de Mi DT>' });
 *   s.texto  s.errores (si hay, NO se debe cargar)  s.avisos  s.nombreArchivo
 * Cada trabajador: { rut, nombre, fechaIngreso (AAAA-MM-DD), afp, salud, isapreNombre, jornadaHoras, dias, diasLicencia, diasVacaciones,
 *                    cargas, tramo, conApv (bool), v: { '2101': monto, ... } } con los montos ya clasificados por código del LRE.
 *
 * Nada de esto se conecta con la Dirección del Trabajo: arma el archivo para que el empleador lo cargue con su clave.
 * Lo que no se puede informar con certeza se rechaza con un error que dice qué falta, en vez de adivinarlo.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./lre_tablas.js'));
    else root.CLLre = factory(root.CLLreTablas);
}(typeof self !== 'undefined' ? self : this, function (TABLAS) {
    'use strict';

    var SEP = ';';
    var COLUMNAS = TABLAS.COLUMNAS;
    var COMUNAS = TABLAS.COMUNAS;

    // Tablas de validación del Anexo 2 del manual
    var AFP = { provida: 6, planvital: 11, cuprum: 13, habitat: 14, uno: 19, capital: 31, modelo: 103 };
    var SALUD = {
        fonasa: 102, cruzblanca: 1, banmedica: 3, colmena: 4, codelco: 5, consalud: 9, vidatres: 12, chuquicamata: 37,
        cruzdelnorte: 38, fusat: 39, bancoestado: 40, fundacion: 40, rioblanco: 41, sanlorenzo: 42, nuevamasvida: 43, esencial: 44, sinisapre: 99
    };
    var CCAF = { losandes: 1, laaraucana: 2, losheroes: 3, '18deseptiembre': 4 };
    var MUTUAL = { achs: 1, asociacionchilenadeseguridad: 1, mutual: 2, mutualdeseguridad: 2, ist: 3, institutodeseguridaddeltrabajo: 3, isl: 0, sinmutual: 0 };

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function norm(s) {
        return texto(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    }
    function codigoDe(tabla, valor, nombre) {
        var k = norm(valor);
        if (k && Object.prototype.hasOwnProperty.call(tabla, k)) return tabla[k];
        var claves = Object.keys(tabla).sort(function (a, b) { return b.length - a.length; });
        for (var i = 0; i < claves.length; i++) {
            if (claves[i].length >= 4 && k.indexOf(claves[i]) >= 0) return tabla[claves[i]];
        }
        throw new Error(nombre + ' no reconocida: "' + texto(valor) + '"');
    }

    // Comuna por nombre o por código → { codigo, region }. La región son los 1 o 2 primeros dígitos del código de comuna.
    var POR_NOMBRE = null;
    function comunaDe(valor) {
        var v = texto(valor);
        if (/^\d{4,5}$/.test(v) && COMUNAS[v]) return { codigo: Number(v), region: Math.floor(Number(v) / 1000) };
        if (!POR_NOMBRE) {
            POR_NOMBRE = {};
            Object.keys(COMUNAS).forEach(function (c) { POR_NOMBRE[norm(COMUNAS[c])] = Number(c); });
        }
        var k = norm(v);
        if (!k || !POR_NOMBRE[k]) throw new Error('Comuna de prestación de servicios no reconocida: "' + v + '" (debe ser una comuna de Chile, como en la tabla de la DT)');
        var c = POR_NOMBRE[k];
        return { codigo: c, region: Math.floor(c / 1000) };
    }

    function partirRut(rut) {
        var s = texto(rut).replace(/[.,\s]/g, '').toUpperCase();
        var m = /^(\d{1,9})-?([\dK])$/.exec(s);
        return m ? { cuerpo: String(Number(m[1])), dv: m[2] } : null;
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
    function rutLre(rut) {
        var r = partirRut(rut);
        if (!r) throw new Error('RUT inválido: "' + texto(rut) + '"');
        if (!dvValido(r.cuerpo, r.dv)) throw new Error('Dígito verificador incorrecto en ' + r.cuerpo + '-' + r.dv);
        return r.cuerpo + '-' + r.dv;
    }
    function ddmmaaaa(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(iso));
        return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
    }
    function entero(v) {
        var n = Math.round(Number(v) || 0);
        return n > 0 ? String(n) : '0';
    }

    // Columnas del archivo: las del Anexo 1, o las de la plantilla que el empleador descargó de Mi DT (su primera línea).
    function columnasDe(plantilla) {
        var base = COLUMNAS.map(function (c) { return { c: c.c, enc: c.n, o: c.o }; });
        if (!texto(plantilla)) return { columnas: base, errores: [] };
        var linea = String(plantilla).replace(/^﻿/, '').split(/\r?\n/)[0];
        var porCodigo = {}, porNombre = {};
        // Dos conceptos pueden llamarse casi igual (la indemnización a todo evento está en identificación y en haberes): se toma el primero libre
        base.forEach(function (c) { porCodigo[c.c] = c; (porNombre[norm(c.enc)] = porNombre[norm(c.enc)] || []).push(c); });
        var salida = [], errores = [], vistos = {};
        linea.split(SEP).forEach(function (h) {
            var enc = h.replace(/^"|"$/g, '').trim();
            if (!enc) return;
            var c = (porNombre[norm(enc)] || []).filter(function (x) { return !vistos[x.c]; })[0];
            if (!c) { var m = /(?:^|\D)(\d{4})(?:\D|$)/.exec(enc); if (m) c = porCodigo[m[1]]; }
            if (!c) { errores.push('El encabezado «' + enc + '» de tu plantilla no coincide con ningún concepto del LRE.'); return; }
            if (vistos[c.c]) { errores.push('El encabezado «' + enc + '» está repetido en tu plantilla.'); return; }
            vistos[c.c] = true;
            salida.push({ c: c.c, enc: enc, o: c.o });
        });
        base.forEach(function (c) { if (c.o && !vistos[c.c]) errores.push('Tu plantilla no trae la columna obligatoria «' + c.enc + '».'); });
        return { columnas: salida, errores: errores };
    }

    // Valores de identificación por código del LRE para un trabajador
    function identificacion(t, e, periodo) {
        var v = {};
        var com = comunaDe(e.comuna);
        var tieneIsapre = norm(t.salud) !== 'fonasa';
        var jornada = Number(t.jornadaHoras) || 0;
        var tramo = texto(t.tramo).toUpperCase();
        if (tramo && !/^[ABCDS]$/.test(tramo)) throw new Error('Tramo de asignación familiar inválido: "' + texto(t.tramo) + '"');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto(t.fechaIngreso))) throw new Error('Falta la fecha de ingreso en su ficha.');
        if (texto(t.fechaIngreso).slice(0, 7) > periodo) throw new Error('La fecha de ingreso es posterior al período.');
        v['1101'] = rutLre(t.rut);
        v['1102'] = ddmmaaaa(t.fechaIngreso);
        if (texto(t.fechaTermino)) {
            if (texto(t.fechaTermino).slice(0, 7) !== periodo) throw new Error('El término del contrato (' + ddmmaaaa(t.fechaTermino) + ') no cae en el período del archivo.');
            if (!/^\d{1,2}$/.test(texto(t.causalTermino))) throw new Error('Falta la causal del término del contrato.');
            if (texto(t.fechaTermino) <= texto(t.fechaIngreso)) throw new Error('La fecha de término debe ser posterior a la de inicio del contrato.');
            v['1103'] = ddmmaaaa(t.fechaTermino);
            v['1104'] = texto(t.causalTermino);
        }
        v['1105'] = String(com.region);
        v['1106'] = String(com.codigo);
        v['1170'] = '1';                                       // impuesto único de segunda categoría
        v['1146'] = '0';                                       // no es técnico extranjero exento
        v['1107'] = jornada > 0 && jornada <= 30 ? '201' : '101';   // parcial (art. 40 bis) u ordinaria (art. 22)
        v['1108'] = '0';
        v['1109'] = /^vejez/.test(texto(t.pension)) ? '1' : '0';
        v['1141'] = String(codigoDe(AFP, t.afp, 'AFP'));
        v['1142'] = '0';
        v['1143'] = String(tieneIsapre ? codigoDe(SALUD, t.isapreNombre, 'Isapre') : SALUD.fonasa);
        v['1151'] = '1';
        v['1110'] = String(e.ccaf ? codigoDe(CCAF, e.ccaf, 'Caja de compensación') : 0);
        v['1152'] = String(codigoDe(MUTUAL, e.mutual, 'Mutualidad'));
        var cargas = Math.max(0, Math.round(Number(t.cargas) || 0));
        if (cargas > 0) v['1111'] = String(cargas);
        if (tramo) v['1114'] = tramo;
        v['1115'] = entero(t.dias);
        if (Number(t.diasLicencia) > 0) v['1116'] = entero(t.diasLicencia);
        if (Number(t.diasVacaciones) > 0) v['1117'] = entero(t.diasVacaciones);
        if (t.v && Number(t.v['3171']) > 0) {
            if (!texto(t.rutSindicato)) throw new Error('Paga cuota sindical y falta el RUT del sindicato en su ficha.');
            v['1171'] = rutLre(t.rutSindicato);
        }
        v['1118'] = '0';
        v['1155'] = t.conApv ? '1' : '0';
        v['1157'] = '0';
        v['1131'] = '0';
        return v;
    }

    function fila(t, e, periodo, columnas) {
        var v = identificacion(t, e, periodo);
        var montos = t.v || {};
        Object.keys(montos).forEach(function (k) {
            var m = Math.round(Number(montos[k]) || 0);
            if (m < 0) throw new Error('El concepto ' + k + ' tiene un monto negativo.');
            if (m > 0) v[k] = String(m);
        });
        return columnas.map(function (c) {
            var val = v[c.c];
            if (val === undefined || val === '') {
                // Obligatorio sin dato: los montos obligatorios van en cero; el resto es un dato que falta
                if (!c.o) return '';
                if (/^[2-5]/.test(c.c)) return '0';
                throw new Error('Falta el dato obligatorio «' + c.enc + '».');
            }
            return val;
        });
    }

    function generar(datos) {
        var errores = [], avisos = [], filas = [];
        var e = datos.empleador || {};
        var periodo = texto(datos.periodo);
        if (!/^\d{4}-\d{2}$/.test(periodo)) errores.push('Período inválido: "' + periodo + '" (se espera AAAA-MM).');
        var rutEmp = partirRut(e.rut);
        if (!rutEmp || !dvValido(rutEmp.cuerpo, rutEmp.dv)) errores.push('Falta el RUT de la empresa o no es válido: se usa en el nombre del archivo.');
        var cols = columnasDe(datos.plantilla);
        cols.errores.forEach(function (x) { errores.push(x); });

        if (!errores.length) {
            (datos.trabajadores || []).forEach(function (t, i) {
                var quien = texto(t.nombre) || texto(t.rut) || ('fila ' + (i + 1));
                try { filas.push(fila(t, e, periodo, cols.columnas).join(SEP)); }
                catch (err) { errores.push(quien + ': ' + err.message); }
            });
            if (!filas.length && !errores.length) errores.push('No hay trabajadores.');
        }
        var nombreArchivo = rutEmp ? rutEmp.cuerpo + rutEmp.dv + '_' + periodo.replace('-', '') + '.csv' : '';
        if (errores.length) return { texto: '', filas: filas, errores: errores, avisos: avisos, nombreArchivo: nombreArchivo };
        var encabezado = cols.columnas.map(function (c) { return c.enc; }).join(SEP);
        return { texto: [encabezado].concat(filas).join('\r\n') + '\r\n', filas: filas, errores: [], avisos: avisos, nombreArchivo: nombreArchivo, columnas: cols.columnas };
    }

    // Windows-1252: los caracteres de 0 a 255 se copian tal cual; el resto se reemplaza por «?»
    function bytesAnsi(s) {
        var out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            out[i] = c < 256 ? c : 63;
        }
        return out;
    }

    // Revisa un archivo ya armado: columnas, RUT, fechas y montos (las validaciones de forma del manual §7.1)
    function validar(textoArchivo, plantilla) {
        var problemas = [];
        var cols = columnasDe(plantilla).columnas;
        var lineas = textoArchivo.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (lineas.length < 2) return ['El archivo no tiene filas de trabajadores.'];
        var enc = lineas[0].split(SEP);
        if (enc.length !== cols.length) problemas.push('El encabezado tiene ' + enc.length + ' columnas y deben ser ' + cols.length + '.');
        lineas.slice(1).forEach(function (l, i) {
            var f = l.split(SEP), n = i + 2;
            if (f.length !== cols.length) { problemas.push('Línea ' + n + ': tiene ' + f.length + ' columnas y deben ser ' + cols.length + '.'); return; }
            cols.forEach(function (c, k) {
                var x = f[k];
                if (c.o && x === '') problemas.push('Línea ' + n + ': falta «' + c.enc + '».');
                if (x === '') return;
                if (c.c === '1101' && !/^\d{1,9}-[\dK]$/.test(x)) problemas.push('Línea ' + n + ': RUT con formato incorrecto («' + x + '»).');
                else if (c.c === '1101') { var r = partirRut(x); if (!dvValido(r.cuerpo, r.dv)) problemas.push('Línea ' + n + ': RUT ' + x + ' con dígito verificador incorrecto.'); }
                if ((c.c === '1102' || c.c === '1103') && !/^\d{2}\/\d{2}\/\d{4}$/.test(x)) problemas.push('Línea ' + n + ': la fecha «' + x + '» debe ser dd/mm/aaaa.');
                if (/^[2-5]/.test(c.c) && !/^\d+$/.test(x)) problemas.push('Línea ' + n + ': «' + c.enc + '» debe ser un monto entero (llegó «' + x + '»).');
            });
        });
        return problemas;
    }

    return { generar: generar, validar: validar, bytesAnsi: bytesAnsi, columnasDe: columnasDe, comunaDe: comunaDe, rutLre: rutLre, columnas: COLUMNAS, tablas: { AFP: AFP, SALUD: SALUD, CCAF: CCAF, MUTUAL: MUTUAL } };
}));
