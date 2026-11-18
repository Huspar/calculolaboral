/*
 * CálculoLaboral · Pre-validador de cumplimiento laboral (Ola 3, v1.1.0)
 * Revisa trabajador por trabajador, ANTES de descargar, si el archivo Previred (105 campos) y el CSV del LRE se pueden
 * armar sin errores, y calcula el calendario de vencimientos del período según normativa 2026 (DT / Previred / SP).
 *
 *   evaluar({ resultados, periodo, mutual, ccaf, comuna, rutEmpresa, uf, topeAfpUF, topeAfcUF, hoy, plazos, holidays, previred, archivos, exigirLre })
 *     → { estadoGeneral, conteo, generales, notas, trabajadores, calendario }
 *   calendarioVencimientos({ periodo, hoy, plazos, holidays, eventos, trabajadoresCount })
 *
 * Funciona en el navegador (window.CLPrevalidador) y en Node (require).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(
        typeof require === 'function' ? safeRequire('./constants') : root.CONSTANTS,
        typeof require === 'function' ? safeRequire('./lre_tablas') : root.CLLreTablas
    );
    else root.CLPrevalidador = factory(root.CONSTANTS, root.CLLreTablas);

    function safeRequire(m) {
        try { return require(m); } catch (e) { return null; }
    }
}(typeof self !== 'undefined' ? self : this, function (CONSTANTS, LRE_TABLAS) {
    'use strict';

    // Parámetros de plazos (normativa 2026). Se pueden sobrescribir desde fuera.
    var PLAZOS = {
        previredDia: 13,               // día fijo del mes siguiente para declarar y pagar por vía electrónica (Art. 19 DL 3.500)
        lreDiasHabiles: 15,            // primeros 15 días hábiles (lun-vie) del mes siguiente (Art. 3° N° 4 DS 14/2023 y Art. 62 CT)
        contratoDiasHabiles: 15,       // registro de contrato y anexos en Mi DT (15 días hábiles, Art. 9 bis CT / DS 14/2023)
        terminoGeneralHabiles: 10,     // Art. 159 N° 1-3 (mutuo acuerdo, renuncia, muerte)
        terminoCortoHabiles: 3,        // Art. 159 N° 4-5 y Art. 160 (lun-sáb conservador)
        terminoSeisHabiles: 6,         // Art. 159 N° 6 y Art. 163 bis (lun-sáb conservador)
        afcImputacionHabiles: 5,       // imputación saldo AFC en Art. 161
        umbralLreObligatorio: 5,       // obligatorio desde 5 o más trabajadores (Art. 62 CT)
        umbralCritico: 3,              // días restantes para marcar en rojo
        umbralProximo: 7               // días restantes para marcar en ámbar
    };

    var FERIADOS_BASE = [
        '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-21',
        '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12',
        '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
        '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21', '2027-06-21',
        '2027-06-28', '2027-07-16', '2027-08-15', '2027-09-17', '2027-09-18', '2027-09-19',
        '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08', '2027-12-25'
    ];

    function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
    function norm(s) { return texto(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

    function mapaFeriados(extra) {
        var set = {};
        var fuentes = [];
        if (Array.isArray(extra)) fuentes = fuentes.concat(extra);
        else {
            if (CONSTANTS && Array.isArray(CONSTANTS.HOLIDAYS_2026)) fuentes = fuentes.concat(CONSTANTS.HOLIDAYS_2026);
            if (CONSTANTS && Array.isArray(CONSTANTS.HOLIDAYS_2027)) fuentes = fuentes.concat(CONSTANTS.HOLIDAYS_2027);
            if (!fuentes.length) fuentes = FERIADOS_BASE;
        }
        fuentes.forEach(function (f) {
            var iso = texto(f).slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) set[iso] = true;
        });
        return set;
    }

    function partesPeriodo(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(texto(periodo));
        return m ? { anio: Number(m[1]), mes: Number(m[2]) } : null;
    }

    function utcDia(anio, mes1a12, dia) { return Date.UTC(anio, mes1a12 - 1, dia); }

    function isoDeMs(ms) {
        var d = new Date(ms);
        return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
    }

    function msDeIso(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(iso));
        return m ? utcDia(Number(m[1]), Number(m[2]), Number(m[3])) : null;
    }

    function aIso(valor) {
        var s = texto(valor);
        var m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
        if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
        return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
    }

    function hoyMs(hoy) {
        if (hoy instanceof Date) return utcDia(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
        var ms = msDeIso(hoy);
        if (ms !== null) return ms;
        var n = new Date();
        return utcDia(n.getFullYear(), n.getMonth() + 1, n.getDate());
    }

    /* Suma N días hábiles descontando feriados. Por defecto lunes a viernes (Art. 25 Ley 19.880); con sabadoHabil=true incluye sábados (Art. 162 CT). */
    function sumarDiasHabiles(ms, n, opts) {
        var o = opts || {};
        var sabadoHabil = Boolean(o.sabadoHabil);
        var feriados = o.feriadosMap || mapaFeriados(o.holidays);
        var cur = ms;
        var contados = 0;
        while (contados < n) {
            cur += 86400000;
            var dow = new Date(cur).getUTCDay();
            if (dow === 0) continue;
            if (!sabadoHabil && dow === 6) continue;
            if (feriados[isoDeMs(cur)]) continue;
            contados++;
        }
        return cur;
    }

    function clasificarPlazo(diasRestantes, plazos) {
        if (diasRestantes < 0) return 'vencido';
        if (diasRestantes <= plazos.umbralCritico) return 'critico';
        if (diasRestantes <= plazos.umbralProximo) return 'proximo';
        return 'ok';
    }

    function fusionarPlazos(extra) {
        var p = {};
        Object.keys(PLAZOS).forEach(function (k) { p[k] = PLAZOS[k]; });
        if (extra && typeof extra === 'object') Object.keys(extra).forEach(function (k) { if (extra[k] !== undefined) p[k] = extra[k]; });
        return p;
    }

    function reglaCausalTermino(causal, plazos) {
        var c = norm(causal);
        if (!c) return { dias: plazos.terminoGeneralHabiles, sabadoHabil: false, etiqueta: plazos.terminoGeneralHabiles + ' días hábiles (Art. 159 N° 1-3 / referencia)' };
        if (c === '18' || c === '19' || /necesidad|desahucio|161/.test(c)) {
            return { dias: 0, afcDias: plazos.afcImputacionHabiles, sabadoHabil: true, etiqueta: 'Simultáneo al aviso (Art. 161) · ' + plazos.afcImputacionHabiles + ' d. hábiles imputación AFC' };
        }
        if (c === '8' || c === '20' || /fortuito|fuerza mayor|concursal|163/.test(c)) {
            return { dias: plazos.terminoSeisHabiles, sabadoHabil: true, etiqueta: plazos.terminoSeisHabiles + ' días hábiles lun-sáb (Art. 159 N° 6 / 163 bis)' };
        }
        if (c === '6' || c === '7' || /^1[1-6]$/.test(c) || /^2[4-9]$/.test(c) || /plazo|obra|faena|160|probidad|abandono|inasistencia|incumplimiento|acoso|injuria/.test(c)) {
            return { dias: plazos.terminoCortoHabiles, sabadoHabil: true, etiqueta: plazos.terminoCortoHabiles + ' días hábiles lun-sáb (Art. 159 N° 4-5 / Art. 160)' };
        }
        return { dias: plazos.terminoGeneralHabiles, sabadoHabil: false, etiqueta: plazos.terminoGeneralHabiles + ' días hábiles (Art. 159 N° 1-3)' };
    }

    /* Calendario: Previred día 13 fijo + LRE 15 primeros días hábiles + contratos/anexos (15 d. hábiles) + términos según causal. */
    function calendarioVencimientos(o) {
        var op = o || {};
        var per = partesPeriodo(op.periodo);
        var plazos = fusionarPlazos(op.plazos);
        var feriadosMap = mapaFeriados(op.holidays);
        var ref = hoyMs(op.hoy);
        var items = [];
        if (!per) return items;

        var mesSig = per.mes === 12 ? 1 : per.mes + 1;
        var anioSig = per.mes === 12 ? per.anio + 1 : per.anio;

        function agregar(id, titulo, ms, detalle, extra) {
            var dias = Math.round((ms - ref) / 86400000);
            var it = { id: id, titulo: titulo, fechaLimite: isoDeMs(ms), diasRestantes: dias, estado: clasificarPlazo(dias, plazos), detalle: detalle || '' };
            if (extra) Object.keys(extra).forEach(function (k) { it[k] = extra[k]; });
            items.push(it);
        }

        agregar('previred', 'Previred · declarar y pagar cotizaciones', utcDia(anioSig, mesSig, plazos.previredDia),
            'Día ' + plazos.previredDia + ' fijo (pago electrónico) del período ' + op.periodo + ': no se prorroga en sábado, domingo o festivo (Art. 19 D.L. 3.500).');

        // Primeros 15 días hábiles (lun-vie sin festivos) del mes siguiente: partimos del día 0 del mes siguiente (último día del mes del período).
        var lreMs = sumarDiasHabiles(utcDia(anioSig, mesSig, 0), plazos.lreDiasHabiles, { sabadoHabil: false, feriadosMap: feriadosMap });
        var cantTrab = Number(op.trabajadoresCount);
        var notaLre = isFinite(cantTrab) && cantTrab > 0 && cantTrab < plazos.umbralLreObligatorio
            ? 'Voluntario con menos de ' + plazos.umbralLreObligatorio + ' trabajadores (obligatorio desde ' + plazos.umbralLreObligatorio + '+, Art. 62 CT).'
            : 'Primeros ' + plazos.lreDiasHabiles + ' días hábiles del mes siguiente (Art. 3° N° 4 D.S. 14/2023).';
        agregar('lre', 'Libro de Remuneraciones Electrónico (Mi DT)', lreMs, notaLre);

        (Array.isArray(op.eventos) ? op.eventos : []).forEach(function (ev, i) {
            var base = msDeIso(ev.fecha);
            if (base === null) return;
            if (ev.tipo === 'contrato') {
                agregar('contrato-' + i, 'Registrar contrato en Mi DT · ' + ev.nombre,
                    sumarDiasHabiles(base, plazos.contratoDiasHabiles, { sabadoHabil: false, feriadosMap: feriadosMap }),
                    'Celebración ' + ev.fecha + ' · ' + plazos.contratoDiasHabiles + ' días hábiles (Art. 9 bis CT / D.S. 14/2023).',
                    { nombre: ev.nombre });
            } else if (ev.tipo === 'anexo') {
                agregar('anexo-' + i, 'Registrar anexo en Mi DT · ' + ev.nombre,
                    sumarDiasHabiles(base, plazos.contratoDiasHabiles, { sabadoHabil: false, feriadosMap: feriadosMap }),
                    'Modificación ' + ev.fecha + ' · ' + plazos.contratoDiasHabiles + ' días hábiles (Art. 3° N° 2 D.S. 14/2023).',
                    { nombre: ev.nombre });
            } else if (ev.tipo === 'termino') {
                var regla = reglaCausalTermino(ev.causal, plazos);
                var limiteMs = regla.dias > 0
                    ? sumarDiasHabiles(base, regla.dias, { sabadoHabil: regla.sabadoHabil, feriadosMap: feriadosMap })
                    : base;
                agregar('termino-' + i, 'Registrar término en Mi DT · ' + ev.nombre, limiteMs,
                    'Término ' + ev.fecha + ' · ' + regla.etiqueta + '.',
                    { nombre: ev.nombre, causal: ev.causal || '' });
            }
        });

        items.sort(function (a, b) { return a.diasRestantes - b.diasRestantes; });
        return items;
    }

    function eventosDeResultados(resultados) {
        var out = [];
        (resultados || []).forEach(function (r) {
            var rec = (r && r.record) || {};
            var mov = norm(rec.movimiento);
            var nombre = texto(rec.nombre) || texto(rec.rut) || 'Trabajador';
            if (/^(alta|contrat|ingreso)/.test(mov)) {
                var fi = aIso(rec.movDesde) || aIso(rec.ingreso);
                if (fi) out.push({ tipo: 'contrato', fecha: fi, nombre: nombre });
            } else if (/^(anexo|modif)/.test(mov)) {
                var fa = aIso(rec.movDesde);
                if (fa) out.push({ tipo: 'anexo', fecha: fa, nombre: nombre });
            } else if (/^(retiro|baja|finiquito)/.test(mov)) {
                var ft = aIso(rec.fechaTermino) || aIso(rec.movHasta);
                if (ft) out.push({ tipo: 'termino', fecha: ft, nombre: nombre, causal: texto(rec.causalTermino) });
            }
        });
        return out;
    }

    function limpiarMensaje(msg, nombre) {
        var s = texto(msg);
        var prefijo = texto(nombre) + ':';
        return s.indexOf(prefijo) === 0 ? texto(s.slice(prefijo.length)) : s;
    }

    function rutCanon(rut) {
        return texto(rut).replace(/[.,\s-]/g, '').toUpperCase();
    }

    function rutValido(rut, previred) {
        if (!previred || !previred.partirRut || !previred.dvValido) return true;
        var r = previred.partirRut(rut);
        return !!(r && previred.dvValido(r.cuerpo, r.dv));
    }

    function comunaValidaEnTabla(comuna) {
        if (!LRE_TABLAS || !LRE_TABLAS.COMUNAS) return true;
        var v = texto(comuna);
        if (!v) return false;
        if (/^\d{4,5}$/.test(v) && LRE_TABLAS.COMUNAS[v]) return true;
        var k = norm(v);
        return Object.keys(LRE_TABLAS.COMUNAS).some(function (cod) {
            return norm(LRE_TABLAS.COMUNAS[cod]) === k;
        });
    }

    function buscarClaveMonto(lista, clave) {
        for (var i = 0; i < (lista || []).length; i++) {
            if (lista[i] && lista[i].clave === clave) return Number(lista[i].monto) || 0;
        }
        return 0;
    }

    function buscarConceptoMonto(lista, regex) {
        var total = 0;
        for (var i = 0; i < (lista || []).length; i++) {
            if (lista[i] && regex.test(texto(lista[i].concepto))) total += Number(lista[i].monto) || 0;
        }
        return total;
    }

    function nivelDe(hallazgos) {
        if (hallazgos.some(function (h) { return h.nivel === 'rojo'; })) return 'rojo';
        if (hallazgos.some(function (h) { return h.nivel === 'amarillo'; })) return 'amarillo';
        return 'verde';
    }

    function topesDePeriodo(op) {
        var per = texto(op.periodo);
        var uf = Number(op.uf) || 0;
        var topeAfpUF = Number(op.topeAfpUF) || (per === '2026-01' ? 89.9 : 90.0);
        var topeAfcUF = Number(op.topeAfcUF) || (per === '2026-01' ? 135.1 : 135.2);
        if (!uf && CONSTANTS && CONSTANTS.TOPES_IMPONIBLES) {
            if (!op.topeAfpUF && CONSTANTS.TOPES_IMPONIBLES.AFP_UF && per !== '2026-01') topeAfpUF = CONSTANTS.TOPES_IMPONIBLES.AFP_UF;
            if (!op.topeAfcUF && CONSTANTS.TOPES_IMPONIBLES.AFC_UF && per !== '2026-01') topeAfcUF = CONSTANTS.TOPES_IMPONIBLES.AFC_UF;
        }
        return {
            uf: uf,
            topeAfpPesos: uf > 0 ? Math.round(topeAfpUF * uf) : 0,
            topeAfcPesos: uf > 0 ? Math.round(topeAfcUF * uf) : 0
        };
    }

    function evaluar(o) {
        var op = o || {};
        var plazos = fusionarPlazos(op.plazos);
        var resultados = Array.isArray(op.resultados) ? op.resultados : [];
        var previred = op.previred;
        var archivos = op.archivos;
        var generales = [];
        var trabajadores = [];
        var notas = [];

        var mutual = texto(op.mutual);
        var empresaRutOk = rutValido(op.rutEmpresa, previred) && texto(op.rutEmpresa) !== '';
        var exigeLre = Boolean(op.exigirLre) || resultados.length >= plazos.umbralLreObligatorio;
        var comunaTxt = texto(op.comuna);
        var comunaOk = Boolean(comunaTxt) && comunaValidaEnTabla(comunaTxt);

        if (!partesPeriodo(op.periodo)) generales.push({ nivel: 'rojo', origen: 'Datos', texto: 'Período inválido (se espera AAAA-MM).', campo: 'periodo' });
        if (!mutual) generales.push({ nivel: 'rojo', origen: 'Previred', texto: 'Falta la mutualidad del empleador (ACHS, Mutual o IST).', campo: 'liq-mutual' });
        if (!empresaRutOk) generales.push({ nivel: 'rojo', origen: 'LRE', texto: 'Falta el RUT de la empresa o no es válido: el LRE lo usa en el nombre del archivo.', campo: 'liq-rut-empresa' });
        if (!comunaTxt) {
            generales.push({
                nivel: exigeLre ? 'rojo' : 'amarillo',
                origen: 'LRE',
                texto: exigeLre
                    ? 'Falta la comuna de prestación de servicios: es obligatoria en LRE (nómina de ' + resultados.length + ' trabajadores).'
                    : 'Falta la comuna de prestación de servicios: el LRE la exige por trabajador si decides cargarlo.',
                campo: 'liq-comuna'
            });
        } else if (!comunaOk) {
            generales.push({
                nivel: exigeLre ? 'rojo' : 'amarillo',
                origen: 'LRE',
                texto: 'Comuna "' + comunaTxt + '" no reconocida en la tabla oficial de la Dirección del Trabajo.',
                campo: 'liq-comuna'
            });
        }
        if (!resultados.length) generales.push({ nivel: 'amarillo', origen: 'Datos', texto: 'Aún no hay nómina calculada: carga el Excel de liquidaciones.' });

        if (resultados.length > 0 && resultados.length < plazos.umbralLreObligatorio) {
            notas.push('Nómina con menos de ' + plazos.umbralLreObligatorio + ' trabajadores: el LRE en Mi DT es voluntario para esta empresa (obligatorio desde ' + plazos.umbralLreObligatorio + ' o más, Art. 62 CT).');
        }

        var rutsVistos = {};
        resultados.forEach(function (r) {
            var k = rutCanon(r && r.record && r.record.rut);
            if (k) rutsVistos[k] = (rutsVistos[k] || 0) + 1;
        });

        var topes = topesDePeriodo(op);

        resultados.forEach(function (r, idx) {
            var rec = (r && r.record) || {};
            var nombre = texto(rec.nombre) || texto(rec.rut) || ('Fila ' + (idx + 1));
            var hallazgos = [];
            var movNorm = norm(rec.movimiento);
            var esRetiro = /^(retiro|baja|finiquito)/.test(movNorm);
            var tipoTrab = texto(rec.tipoTrabajador) || '0';
            var licDias = Number(rec.licenciaDias || rec.diasLicencia) || 0;
            var rima = Number(rec.rima) || 0;

            if (r && r.error) {
                hallazgos.push({ nivel: 'rojo', origen: 'Cálculo', texto: r.error });
            } else {
                if (!rutValido(rec.rut, previred) || !texto(rec.rut)) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Datos', texto: 'RUT faltante o con dígito verificador incorrecto.' });
                } else if (rutsVistos[rutCanon(rec.rut)] > 1) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Datos', texto: 'RUT duplicado en la nómina: Previred y LRE no admiten dos líneas principales para el mismo trabajador.' });
                }

                var dias = Number(rec.dias);
                if (isFinite(dias)) {
                    if (Math.floor(dias) !== dias) {
                        hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Los días trabajados deben ser un número entero (' + dias + ').' });
                    }
                    if (dias < 0 || dias > 30) {
                        hallazgos.push({ nivel: 'rojo', origen: 'Datos', texto: 'Días trabajados fuera de rango (0 a 30): ' + dias + '.' });
                    }
                    if (dias + licDias > 30) {
                        hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Días trabajados (' + dias + ') + días de licencia (' + licDias + ') superan 30 días en el mes.' });
                    }
                    if (dias === 0 && licDias === 0 && rima === 0 && (!movNorm || movNorm === '0' || /^sin/.test(movNorm))) {
                        hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Trabajador con 0 días trabajados sin movimiento de personal ni licencia médica informada.' });
                    }
                    if (dias > 0 && dias < 30 && licDias === 0 && rima === 0 && (!movNorm || movNorm === '0' || /^sin/.test(movNorm))) {
                        hallazgos.push({ nivel: 'amarillo', origen: 'Previred', texto: 'Trabajador con ' + dias + ' días (< 30) sin movimiento de personal (alta, retiro o licencia).' });
                    }
                }

                if ((licDias > 0 || rima > 0) && movNorm !== '3' && !/licencia|subsidio|reposo/.test(movNorm)) {
                    hallazgos.push({ nivel: 'amarillo', origen: 'Previred', texto: 'Tiene días de licencia o RIMA informada sin movimiento código 3 (Subsidio/Licencia).' });
                }

                if (Number(r.liquido) < 0) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Datos', texto: 'Líquido negativo: descuentos superan los haberes.' });
                }

                if (esRetiro) {
                    var ft = aIso(rec.fechaTermino) || aIso(rec.movHasta);
                    if (!ft) hallazgos.push({ nivel: 'rojo', origen: 'LRE', texto: 'Retiro/término sin fecha de término informada.' });
                    if (!texto(rec.causalTermino)) hallazgos.push({ nivel: 'rojo', origen: 'LRE', texto: 'Retiro/término sin causal legal de término informada (obligatoria en LRE).' });
                }

                if (rec.contrato === 'plazo' && !aIso(rec.fechaTermino)) {
                    hallazgos.push({ nivel: 'amarillo', origen: 'LRE', texto: 'Contrato a plazo fijo sin fecha de término del plazo.' });
                }

                // Validaciones previsionales 2026 (pensionados, >65 años y topes imponibles)
                var d = r.detalle || {};
                var descLeg = d.descuentosLegales || [];
                var empLineas = (d.empleador && d.empleador.lineas) || [];
                var mAfp = buscarConceptoMonto(descLeg, /^afp/i);
                var mAfcTrab = buscarConceptoMonto(descLeg, /^seguro de cesant/i);
                var mAfcEmp = buscarClaveMonto(empLineas, 'afc');
                var mSis = buscarClaveMonto(empLineas, 'sis');
                var mSegSoc = buscarClaveMonto(empLineas, 'seguroSocial');

                if ((tipoTrab === '1' || tipoTrab === '2') && (mAfcTrab > 0 || mAfcEmp > 0)) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Pensionado por vejez (tipo ' + tipoTrab + ') no debe cotizar Seguro de Cesantía (Art. 2° Ley 19.728).' });
                }
                if (tipoTrab === '2' && (mAfp > 0 || mSis > 0)) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Pensionado que no cotiza (tipo 2) presenta cotización AFP o SIS mayor a cero.' });
                }
                if ((tipoTrab === '1' || tipoTrab === '3') && (mSis > 0 || mSegSoc > 0)) {
                    hallazgos.push({ nivel: 'amarillo', origen: 'Previred', texto: 'Trabajador tipo ' + tipoTrab + ' (pensionado o >65 años): revisa exención de SIS y Seguro Social en Previred.' });
                }
                if (topes.topeAfpPesos > 0 && d.bases && Number(d.bases.baseAfp) > topes.topeAfpPesos + 5) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Base imponible AFP/Salud ($' + Math.round(d.bases.baseAfp) + ') excede tope legal (' + topes.topeAfpPesos + ').' });
                }
                if (topes.topeAfcPesos > 0 && d.bases && Number(d.bases.baseAfc) > topes.topeAfcPesos + 5) {
                    hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: 'Base imponible AFC ($' + Math.round(d.bases.baseAfc) + ') excede tope legal (' + topes.topeAfcPesos + ').' });
                }

                (Array.isArray(r.avisos) ? r.avisos : []).forEach(function (a) {
                    hallazgos.push({ nivel: 'amarillo', origen: 'Cálculo', texto: texto(a) });
                });

                if (previred && previred.desdeLiquidaciones && mutual) {
                    try {
                        var pr = previred.desdeLiquidaciones([r], { periodo: op.periodo, mutual: mutual, ccaf: op.ccaf });
                        (pr.errores || []).forEach(function (e) {
                            var msg = limpiarMensaje(e, rec.nombre);
                            if (!hallazgos.some(function (h) { return h.texto === msg; })) {
                                hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: msg });
                            }
                        });
                        if (!(pr.errores || []).length && previred.validar) {
                            previred.validar(pr.texto).forEach(function (e) {
                                hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: e });
                            });
                        }
                    } catch (ePre) {
                        hallazgos.push({ nivel: 'rojo', origen: 'Previred', texto: texto(ePre && ePre.message) || 'No se pudo armar la línea de Previred.' });
                    }
                }

                if (archivos && archivos.lre && empresaRutOk && mutual && comunaOk) {
                    try {
                        var lr = archivos.lre([r], {
                            periodo: op.periodo,
                            periodoNombre: op.periodo,
                            empresa: { rut: op.rutEmpresa, comuna: comunaTxt, mutual: mutual, ccaf: op.ccaf }
                        });
                        (lr.errores || []).forEach(function (e) {
                            var msgLre = limpiarMensaje(e, rec.nombre);
                            if (!hallazgos.some(function (h) { return h.texto === msgLre; })) {
                                hallazgos.push({ nivel: 'rojo', origen: 'LRE', texto: msgLre });
                            }
                        });
                        (lr.avisos || []).forEach(function (a) {
                            var txt = texto(a);
                            if (txt.indexOf(texto(rec.nombre) + ':') === 0 && texto(rec.nombre)) {
                                hallazgos.push({ nivel: 'amarillo', origen: 'LRE', texto: limpiarMensaje(txt, rec.nombre) });
                            } else if (notas.indexOf(txt) < 0) {
                                notas.push(txt);
                            }
                        });
                    } catch (eLre) {
                        hallazgos.push({ nivel: 'rojo', origen: 'LRE', texto: texto(eLre && eLre.message) || 'No se pudo armar la fila del LRE.' });
                    }
                }
            }

            trabajadores.push({ nombre: nombre, rut: texto(rec.rut), nivel: nivelDe(hallazgos), hallazgos: hallazgos });
        });

        var conteo = { rojo: 0, amarillo: 0, verde: 0 };
        generales.forEach(function (g) { if (g.nivel === 'rojo') conteo.rojo++; else if (g.nivel === 'amarillo') conteo.amarillo++; });
        trabajadores.forEach(function (t) { conteo[t.nivel]++; });
        var estadoGeneral = conteo.rojo > 0 ? 'rojo' : (conteo.amarillo > 0 ? 'amarillo' : 'verde');

        return {
            estadoGeneral: estadoGeneral,
            conteo: conteo,
            generales: generales,
            notas: notas,
            trabajadores: trabajadores,
            calendario: calendarioVencimientos({
                periodo: op.periodo,
                hoy: op.hoy,
                plazos: plazos,
                holidays: op.holidays,
                eventos: eventosDeResultados(resultados),
                trabajadoresCount: resultados.length
            })
        };
    }

    return {
        PLAZOS: PLAZOS,
        evaluar: evaluar,
        calendarioVencimientos: calendarioVencimientos,
        eventosDeResultados: eventosDeResultados,
        sumarDiasHabiles: sumarDiasHabiles,
        version: '1.1.0'
    };
}));
