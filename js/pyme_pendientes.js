/*
 * CalculoLaboral · pendientes del mes del Asistente Pyme (v1.1.0). Funciona en el navegador (window.CLPymePendientes) y en Node.
 *
 *   pendientes(estado, { hoy: 'AAAA-MM-DD', P: parametros, F: feriados, ultimoRespaldo: 'ISO' | null, liquidaciones: { periodo, registros: [{ trabajadorId, emitida }] } })
 *   periodoLiquidacion(hoy) → { periodo, cuando: 'anterior' | 'actual' } | null   (el mes cuyas liquidaciones se cargan para el aviso)
 *     → [{ id, nivel: 'urgente' | 'aviso' | 'info', titulo, texto, accion? }]   (ordenados: urgente, aviso, info)
 *
 * Solo avisos que se pueden calcular con certeza a partir de la ficha: nada de montos de Previred ni de decisiones legales.
 * Cada aviso dice en qué norma se apoya. Los plazos de cotizaciones se muestran con la advertencia de confirmarlos en Previred
 * (fuentes secundarias; ver docs/asistente-pyme.md, sección 8).
 */
(function (root) {
    'use strict';

    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var ORDEN = { urgente: 0, aviso: 1, info: 2 };

    function aMs(iso) { var a = iso.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
    function dias(desde, hasta) { return Math.round((aMs(hasta) - aMs(desde)) / 86400000); }
    function pesos(n) { return '$' + Math.round(n).toLocaleString('es-CL'); }
    function fechaLarga(iso) { var a = iso.split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1]; }
    function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
    function dos(n) { return n < 10 ? '0' + n : String(n); }

    // Años completos entre dos fechas
    function anios(desde, hasta) {
        var d = desde.split('-').map(Number), h = hasta.split('-').map(Number);
        var n = h[0] - d[0];
        if (h[1] < d[1] || (h[1] === d[1] && h[2] < d[2])) n--;
        return Math.max(0, n);
    }

    // Mes de remuneración que toca preparar: hasta el día 10 el mes anterior; desde el 25 el mes en curso; entre medio, ninguno.
    function periodoLiquidacion(hoy) {
        var a = hoy.split('-').map(Number);
        if (a[2] <= 10) {
            var m = a[1] - 1, y = a[0];
            if (m < 1) { m = 12; y--; }
            return { periodo: y + '-' + dos(m), cuando: 'anterior' };
        }
        if (a[2] >= 25) return { periodo: hoy.slice(0, 7), cuando: 'actual' };
        return null;
    }
    function nombreMes(p) { var a = p.split('-'); return MESES[+a[1] - 1] + ' ' + a[0]; }

    function pendientes(estado, opciones) {
        var hoy = opciones.hoy, P = opciones.P, F = opciones.F;
        var lista = [];
        function agregar(id, nivel, titulo, texto, accion) { lista.push({ id: id, nivel: nivel, titulo: titulo, texto: texto, accion: accion || null }); }

        if (!estado || !estado.empresa) {
            agregar('empresa', 'info', 'Completa los datos de tu empresa', 'Se usan en el membrete de las liquidaciones y de los documentos. Es el primer paso.', { tipo: 'empresa' });
            return ordenar(lista);
        }
        var activos = (estado.trabajadores || []).filter(function (t) { return t.activo; });
        if (!estado.trabajadores || !estado.trabajadores.length) {
            agregar('trabajador-nuevo', 'info', 'Agrega a tu primer trabajador', 'Con sus datos guardados puedes emitir su liquidación y sus documentos sin volver a escribirlos.', { tipo: 'trabajador-nuevo' });
        }

        var periodo = hoy.slice(0, 7);
        // Solo dentro de los meses verificados: fuera de ellos el ingreso mínimo ya puede haberse reajustado
        var vig = P && P.vigenciaDe && periodo >= P.PRIMER_MES && periodo <= P.ULTIMO_MES ? P.vigenciaDe(periodo) : null;

        activos.forEach(function (t) {
            var acc = { tipo: 'trabajador', id: t.id };
            if (!t.fechaIngreso) {
                agregar('ingreso-' + t.id, 'aviso', t.nombre + ': falta la fecha de ingreso', 'Se necesita para el certificado de antigüedad, las vacaciones y el finiquito.', acc);
            }
            if (!t.sueldoBase) {
                agregar('sueldo-' + t.id, 'aviso', t.nombre + ': falta el sueldo base', 'Sin el sueldo base no se puede calcular la liquidación.', acc);
            } else if (vig && vig.imm) {
                var minimo = t.jornadaHoras >= vig.jornadaMaxima ? vig.imm : Math.round(vig.imm * t.jornadaHoras / vig.jornadaMaxima);
                if (t.sueldoBase < minimo) {
                    agregar('minimo-' + t.id, 'aviso', t.nombre + ': sueldo base bajo el ingreso mínimo',
                        'El sueldo base (' + pesos(t.sueldoBase) + ') es menor que el ingreso mínimo de ' + pesos(vig.imm) + ' para jornada completa' +
                        (minimo !== vig.imm ? ', que para su jornada de ' + t.jornadaHoras + ' horas equivale a ' + pesos(minimo) : '') + '. Revísalo.', acc);
                }
            }

            if (t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo) {
                var faltan = dias(hoy, t.fechaTerminoPlazo);
                var apoyo = ' Según el art. 159 N°4 del Código del Trabajo, si el trabajador sigue después de esa fecha o el contrato se renueva por segunda vez, pasa a ser indefinido.';
                var reno = t.renovaciones >= 1 ? ' Ya tiene ' + plural(t.renovaciones, 'renovación', 'renovaciones') + '.' : '';
                if (faltan < 0) {
                    agregar('plazo-' + t.id, 'urgente', t.nombre + ': el plazo fijo ya venció', 'Venció el ' + fechaLarga(t.fechaTerminoPlazo) + ' (hace ' + plural(-faltan, 'día', 'días') + ').' + apoyo, acc);
                } else if (faltan <= 30) {
                    agregar('plazo-' + t.id, faltan <= 7 ? 'urgente' : 'aviso', t.nombre + ': el plazo fijo vence ' + (faltan === 0 ? 'hoy' : 'en ' + plural(faltan, 'día', 'días')),
                        'Vence el ' + fechaLarga(t.fechaTerminoPlazo) + '.' + reno + apoyo, acc);
                }
            }

            if (t.fechaIngreso || t.aniosOtrosEmpleadores) {
                var total = (t.fechaIngreso ? anios(t.fechaIngreso, hoy) : 0) + (t.aniosOtrosEmpleadores || 0);
                var extra = total >= 10 ? Math.floor((total - 10) / 3) : 0;
                if (extra > 0) {
                    agregar('progresivo-' + t.id, 'info', t.nombre + ': feriado progresivo',
                        'Con ' + total + ' años de trabajo (contando los de otros empleadores, hasta 10) le corresponde ' + plural(extra, 'día hábil adicional', 'días hábiles adicionales') + ' de feriado (art. 68).', acc);
                }
            }
        });

        // Liquidaciones del mes sin emitir (solo si el panel cargó los meses de ese periodo)
        var liq = opciones.liquidaciones, toca = periodoLiquidacion(hoy);
        if (liq && toca && liq.periodo === toca.periodo && P && toca.periodo >= P.PRIMER_MES && toca.periodo <= P.ULTIMO_MES) {
            var finMes = toca.periodo + '-31';
            var emitidas = {};
            (liq.registros || []).forEach(function (r) { if (r.emitida) emitidas[r.trabajadorId] = true; });
            var sin = activos.filter(function (t) { return (!t.fechaIngreso || t.fechaIngreso <= finMes) && !emitidas[t.id]; });
            if (sin.length) {
                agregar('liquidaciones', toca.cuando === 'anterior' ? 'aviso' : 'info', 'Liquidaciones de ' + nombreMes(toca.periodo) + ' sin emitir',
                    plural(sin.length, 'trabajador', 'trabajadores') + ' sin liquidación emitida: ' + sin.map(function (t) { return t.nombre; }).join(', ') + '.', { tipo: 'liquidaciones', periodo: toca.periodo });
            }
        }

        // Cotizaciones del mes anterior: del día 1 al 13 de cada mes
        var diaHoy = +hoy.slice(8, 10);
        if (diaHoy <= 13 && activos.length) {
            var a = hoy.split('-').map(Number), mesAnt = a[1] === 1 ? 12 : a[1] - 1, anioAnt = a[1] === 1 ? a[0] - 1 : a[0];
            var dia10 = hoy.slice(0, 8) + '10', plazo10 = dia10;
            try { plazo10 = F.siguienteDiaHabil(dia10); } catch (e) { /* año sin feriados verificados: se muestra el día 10 sin corrimiento */ }
            var dia13 = hoy.slice(0, 8) + '13';
            var restan = dias(hoy, plazo10);
            var nivel = restan < 0 ? 'urgente' : restan <= 3 ? 'aviso' : 'info';
            agregar('cotizaciones', nivel, 'Cotizaciones de ' + MESES[mesAnt - 1] + ' ' + anioAnt,
                'Declaración y pago hasta el ' + fechaLarga(plazo10) + (plazo10 !== dia10 ? ' (el 10 cae en día inhábil)' : '') + '. Si pagas por internet en Previred, hasta el ' + fechaLarga(dia13) + '. Confirma el plazo exacto en Previred.');
        }

        // Pase por vencer
        if (estado.limites && estado.limites.paseVence) {
            var faltaPase = dias(hoy, estado.limites.paseVence.slice(0, 10));
            if (faltaPase >= 0 && faltaPase <= 15) {
                agregar('pase', faltaPase <= 3 ? 'urgente' : 'aviso', 'Tu pase vence ' + (faltaPase === 0 ? 'hoy' : 'en ' + plural(faltaPase, 'día', 'días')),
                    'Al vencer, tu cuenta vuelve a las funciones gratuitas (1 trabajador activo y documentos con marca de agua). Tus datos se conservan.');
            }
        }

        // Notas normativas del mes
        if (P && P.NOTAS_MES && P.NOTAS_MES[periodo]) agregar('nota-mes', 'info', 'Dato del mes', P.NOTAS_MES[periodo]);

        // Respaldo
        var ult = opciones.ultimoRespaldo ? String(opciones.ultimoRespaldo).slice(0, 10) : null;
        if (!ult) {
            agregar('respaldo', 'aviso', 'Descarga un respaldo de tus datos', 'Un archivo con todo lo que guardaste. Úsalo para tener una copia propia.', { tipo: 'respaldo' });
        } else if (dias(ult, hoy) > 30) {
            agregar('respaldo', 'aviso', 'Hace ' + dias(ult, hoy) + ' días que no descargas un respaldo', 'Descarga uno nuevo para tener una copia propia al día.', { tipo: 'respaldo' });
        }

        return ordenar(lista);
    }

    function ordenar(lista) {
        return lista.map(function (x, i) { return { x: x, i: i }; })
            .sort(function (a, b) { return ORDEN[a.x.nivel] - ORDEN[b.x.nivel] || a.i - b.i; })
            .map(function (e) { return e.x; });
    }

    var api = { pendientes: pendientes, periodoLiquidacion: periodoLiquidacion, anios: anios, dias: dias, version: '1.1.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymePendientes = api;
})(typeof window !== 'undefined' ? window : this);
