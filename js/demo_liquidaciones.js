/*
 * CálculoLaboral · liquidaciones de sueldo en lote (demo para estudios contables).
 * Usa el motor del Asistente Pyme: /js/liquidacion_engine.js + /js/liquidacion_valores.js.
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var state = { records: [], results: [], archivo: '', mes: null, fuente: '', avisos: [] };
    var sinScroll = false;

    var AFP = { cuprum: 'Cuprum', habitat: 'Habitat', modelo: 'Modelo', planvital: 'Planvital', provida: 'Provida', uno: 'Uno' };

    var ALIAS = {
        rut: ['rut', 'rut_trabajador', 'rut_empleado'],
        nombre: ['nombre', 'nombre_trabajador', 'trabajador', 'empleado', 'nombre_completo', 'apellidos_nombres'],
        sueldo: ['sueldo_base', 'sueldo', 'base', 'remuneracion_base', 'sueldo_bruto'],
        dias: ['dias_trabajados', 'dias', 'dias_del_mes', 'dias_pagados'],
        afp: ['afp', 'administradora'],
        salud: ['salud', 'prevision', 'isapre_fonasa', 'sistema_de_salud'],
        plan: ['plan_isapre_uf', 'plan_isapre', 'plan_uf', 'isapre_plan_uf', 'plan_de_salud_uf'],
        contrato: ['contrato', 'tipo_de_contrato', 'tipo_contrato'],
        jornada: ['jornada', 'jornada_horas', 'horas_semanales', 'jornada_semanal'],
        ingreso: ['fecha_ingreso', 'ingreso', 'fecha_de_ingreso', 'fecha_inicio'],
        colacion: ['colacion', 'asignacion_colacion'],
        movilizacion: ['movilizacion', 'asignacion_movilizacion'],
        comisiones: ['comisiones', 'comision', 'bonos_imponibles'],
        horasExtra: ['horas_extra', 'horas_extras', 'hh_extra'],
        gratificacion: ['gratificacion', 'gratificacion_legal', 'gratificacion_monto']
    };

    // ------------------------------------------------------------ valores

    function periodoActual() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    }

    function valoresApi() {
        var P = window.CLLiquidacionParametros;
        return window.CLLiquidacionValores.crear({
            parametros: P,
            fetch: window.fetch ? window.fetch.bind(window) : null,
            storage: window.localStorage,
            extender: true
        });
    }

    function respaldo(periodo) {
        var P = window.CLLiquidacionParametros;
        var vig = P.vigenciaDe(periodo) || P.vigenciaEstimada(periodo);
        var base = P.RESPALDO[periodo] || P.RESPALDO['2026-10'] || { uf: 41247.63, utm: 72151 };
        if (!vig) return null;
        return {
            uf: base.uf, utm: base.utm, imm: vig.imm,
            topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF,
            jornadaMaxima: vig.jornadaMaxima, afp: vig.afp, empleador: vig.empleador || null
        };
    }

    function cargarPeriodo(silencioso) {
        var periodo = document.getElementById('periodo').value || periodoActual();
        var nota = document.getElementById('liq-fuente');
        var resp = respaldo(periodo);

        if (!resp) {
            nota.textContent = 'Ese período no está disponible en el motor.';
            return Promise.resolve(null);
        }

        state.mes = resp;
        pintarValores(resp);
        nota.textContent = 'Valores de referencia del período. Puedes corregirlos.';

        return valoresApi().obtener(periodo).then(function (r) {
            if (r && r.ok && r.mes) {
                state.mes = r.mes;
                state.fuente = (r.fuentes && r.fuentes.uf) ? r.fuentes.uf : 'API';
                state.avisos = r.avisos || [];
                pintarValores(r.mes);
                nota.textContent = 'UF y UTM cargadas del período' + (r.estimado ? ' (mes estimado)' : '') + '. Puedes corregirlas.';
            }
            return state.mes;
        }).catch(function () {
            if (!silencioso) D.avisar('No pudimos consultar la UF y la UTM; usamos los valores de referencia.');
            return state.mes;
        });
    }

    function pintarValores(mes) {
        document.getElementById('liq-uf').value = mes.uf;
        document.getElementById('liq-utm').value = mes.utm;
    }

    function mesEfectivo() {
        var base = state.mes || respaldo(document.getElementById('periodo').value);
        return Object.assign({}, base, {
            uf: D.parseNumber(document.getElementById('liq-uf').value) || base.uf,
            utm: D.parseNumber(document.getElementById('liq-utm').value) || base.utm
        });
    }

    // ------------------------------------------------------------ registros

    function normalizaAfp(v) {
        return AFP[D.norm(v)] || AFP[D.norm(v).replace(/[^a-z]/g, '')] || '';
    }

    function normalizaSalud(v) {
        var s = D.norm(v);
        if (!s) return 'fonasa';
        if (/isapre/.test(s)) return 'isapre';
        if (/fonasa/.test(s)) return 'fonasa';
        return 'fonasa';
    }

    function registro(m, i) {
        var grat = D.norm(m.gratificacion);
        var manual = D.parseNumber(m.gratificacion);
        return {
            fila: i + 2,
            rut: String(m.rut || '').trim(),
            nombre: String(m.nombre || '').trim() || 'Sin nombre',
            sueldo: D.parseNumber(m.sueldo),
            dias: D.parseNumber(m.dias) || 30,
            afp: normalizaAfp(m.afp),
            afpTexto: String(m.afp || '').trim(),
            salud: normalizaSalud(m.salud),
            planUF: D.parseNumber(m.plan),
            contrato: /plazo|fijo|obra|faena/.test(D.norm(m.contrato)) ? 'plazo' : 'indefinido',
            jornada: D.parseNumber(m.jornada) || 0,
            ingreso: D.parseDate(m.ingreso),
            colacion: D.parseNumber(m.colacion),
            movilizacion: D.parseNumber(m.movilizacion),
            comisiones: D.parseNumber(m.comisiones),
            horasExtra: D.parseNumber(m.horasExtra),
            gratificacion: grat === 'no' || grat === 'sin' ? 'no' : (manual > 0 && grat !== 'legal' ? 'manual' : 'legal'),
            gratificacionMonto: manual
        };
    }

    // ------------------------------------------------------------- cálculo

    // Tasa de mutual o ISL que el estudio escribe en el formulario (en %). Si queda vacia,
    // se usa la minima legal 0,93% que trae el campo por defecto.
    function tasaMutualElegida() {
        var el = document.getElementById('liq-tasa-mutual');
        var v = el ? D.parseNumber(el.value) : 0;
        return v > 0 ? v : 0.93;
    }

    function calcularTodo() {
        var mes = mesEfectivo();
        var periodo = document.getElementById('periodo').value;

        state.results = state.records.map(function (r) {
            var out = { record: r, error: '', avisos: [], liquido: 0, haberes: 0, descuentos: 0, costo: 0, detalle: null };

            if (!r.sueldo) { out.error = 'Falta el sueldo base'; return out; }
            if (!r.afp) { out.error = 'AFP no reconocida' + (r.afpTexto ? ' ("' + r.afpTexto + '")' : ''); return out; }
            if (r.salud === 'isapre' && !r.planUF) { out.error = 'Falta el plan de Isapre en UF'; return out; }
            if (r.dias <= 0) { out.error = 'Días trabajados en cero'; return out; }

            try {
                var res = window.CLLiquidacionEngine.calcular({
                    periodo: periodo,
                    tasaMutual: tasaMutualElegida(),
                    trabajador: {
                        sueldoBase: r.sueldo,
                        afp: r.afp,
                        salud: r.salud,
                        isaprePlanUF: r.planUF,
                        isapreNombre: 'Isapre',
                        contrato: r.contrato,
                        jornadaHoras: r.jornada || mes.jornadaMaxima,
                        fechaIngreso: r.ingreso,
                        colacion: r.colacion,
                        movilizacion: r.movilizacion
                    },
                    mes: {
                        diasTrabajados: r.dias,
                        horasExtra: r.horasExtra,
                        comisiones: r.comisiones,
                        gratificacion: r.gratificacion,
                        gratificacionMonto: r.gratificacionMonto
                    }
                }, mes);

                out.detalle = res;
                out.haberes = res.totalHaberes;
                out.descuentos = res.totalDescuentos;
                out.liquido = res.liquido;
                out.costo = res.empleador ? res.empleador.costoTotal : res.totalHaberes;
                out.avisos = (res.avisos || []).filter(function (a) { return a.nivel !== 'info'; })
                    .map(function (a) { return a.texto; });
                if (!res.listo) out.error = 'Revisa los datos: el documento no está listo para emitir.';
            } catch (err) {
                out.error = err && err.message ? err.message : 'Error de cálculo';
            }
            return out;
        });

        pintar();
    }

    function pintar() {
        var results = state.results;
        if (!results.length) return;

        var ok = results.filter(function (r) { return !r.error; });
        var errores = results.length - ok.length;
        var totalLiq = ok.reduce(function (s, r) { return s + r.liquido; }, 0);
        var totalHab = ok.reduce(function (s, r) { return s + r.haberes; }, 0);
        var totalCosto = ok.reduce(function (s, r) { return s + r.costo; }, 0);

        document.getElementById('results-liq').removeAttribute('hidden');
        document.getElementById('rows-liq').textContent = state.archivo;
        document.getElementById('l-workers').textContent = ok.length + (errores ? ' / ' + results.length : '');
        document.getElementById('l-liquido').textContent = D.money(totalLiq);
        document.getElementById('l-haberes').textContent = D.money(totalHab);
        document.getElementById('l-costo').textContent = D.money(totalCosto);

        document.getElementById('tbody-liq').innerHTML = results.map(function (r) {
            if (r.error) {
                return '<tr><td class="nom">' + D.esc(r.record.nombre) + '</td>' +
                    '<td class="mono">' + D.esc(r.record.rut || '—') + '</td>' +
                    '<td colspan="5" style="color:var(--risk)">' + D.esc(r.error) + '</td></tr>';
            }
            return '<tr>' +
                '<td class="nom">' + D.esc(r.record.nombre) + '</td>' +
                '<td class="mono">' + D.esc(r.record.rut || '—') + '</td>' +
                '<td>' + D.esc(r.record.afp) + '</td>' +
                '<td class="num">' + D.money(r.haberes) + '</td>' +
                '<td class="num">' + D.money(r.descuentos) + '</td>' +
                '<td class="num"><b>' + D.money(r.liquido) + '</b></td>' +
                '<td class="num">' + D.money(r.costo) + '</td>' +
                '</tr>';
        }).join('');

        var avisos = [];
        state.results.forEach(function (r) {
            r.avisos.forEach(function (a) { if (avisos.indexOf(a) === -1) avisos.push(a); });
        });
        var extra = (state.avisos || []).map(function (a) { return typeof a === 'string' ? a : (a.texto || ''); }).filter(Boolean);
        var caja = document.getElementById('warnings-liq');
        var partes = [];
        if (avisos.length) partes.push('<b>Revisar antes de pagar:</b><br>' + avisos.map(function (a) { return '· ' + D.esc(a); }).join('<br>'));
        if (extra.length) partes.push('<b>Del período:</b><br>' + extra.map(function (a) { return '· ' + D.esc(a); }).join('<br>'));
        if (!partes.length) partes.push('<b>Sin advertencias.</b> Todas las liquidaciones quedaron listas para emitir.');
        caja.innerHTML = partes.join('<div style="height:10px"></div>');

        if (!sinScroll && !document.getElementById('pane-liquidaciones').hasAttribute('hidden')) {
            document.getElementById('results-liq').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        sinScroll = false;
        construirImpresion();
    }

    // ---------------------------------------------------------------- PDF

    function filas(lista) {
        return (lista || []).map(function (l) {
            return '<tr><td>' + D.esc(l.concepto) + (l.detalle ? ' <span style="color:#6B7280">· ' + D.esc(l.detalle) + '</span>' : '') +
                '</td><td class="r">' + D.money(l.monto) + '</td></tr>';
        }).join('');
    }

    function construirImpresion() {
        var ok = state.results.filter(function (r) { return !r.error; });
        if (!ok.length) { document.getElementById('print-area').innerHTML = ''; return; }

        var periodo = document.getElementById('periodo').value;
        var totalLiq = ok.reduce(function (s, r) { return s + r.liquido; }, 0);
        var totalCosto = ok.reduce(function (s, r) { return s + r.costo; }, 0);
        var paginas = [];

        paginas.push('<div class="print-page">' +
            D.encabezado('Resumen de liquidaciones · ' + periodo, ok.length + ' trabajadores · líquido ' + D.money(totalLiq) + ' · costo empresa ' + D.money(totalCosto)) +
            '<table class="print-table"><thead><tr><th>Trabajador</th><th>RUT</th><th>AFP</th>' +
            '<th class="r">Haberes</th><th class="r">Descuentos</th><th class="r">Líquido</th><th class="r">Costo empresa</th></tr></thead><tbody>' +
            ok.map(function (r) {
                return '<tr><td>' + D.esc(r.record.nombre) + '</td><td>' + D.esc(r.record.rut || '—') + '</td><td>' + D.esc(r.record.afp) + '</td>' +
                    '<td class="r">' + D.money(r.haberes) + '</td><td class="r">' + D.money(r.descuentos) + '</td>' +
                    '<td class="r"><b>' + D.money(r.liquido) + '</b></td><td class="r">' + D.money(r.costo) + '</td></tr>';
            }).join('') +
            '<tr class="total"><td colspan="3">Totales</td><td class="r">' + D.money(ok.reduce(function (s, r) { return s + r.haberes; }, 0)) + '</td>' +
            '<td class="r">' + D.money(ok.reduce(function (s, r) { return s + r.descuentos; }, 0)) + '</td>' +
            '<td class="r">' + D.money(totalLiq) + '</td><td class="r">' + D.money(totalCosto) + '</td></tr>' +
            '</tbody></table>' + D.NOTA + '</div>');

        ok.forEach(function (r) {
            var d = r.detalle;
            paginas.push('<div class="print-page">' +
                D.encabezado('Liquidación de sueldo · ' + periodo, D.esc(r.record.nombre) + ' · ' + D.esc(r.record.rut || 'sin RUT')) +
                '<div class="print-data">' +
                '<div><b>Sueldo base:</b> ' + D.money(r.record.sueldo) + '</div>' +
                '<div><b>Días trabajados:</b> ' + D.num(r.record.dias, 0) + ' de 30</div>' +
                '<div><b>AFP:</b> ' + D.esc(r.record.afp) + '</div>' +
                '<div><b>Salud:</b> ' + (r.record.salud === 'isapre' ? 'Isapre (' + D.num(r.record.planUF) + ' UF)' : 'Fonasa') + '</div>' +
                '<div><b>Contrato:</b> ' + (r.record.contrato === 'indefinido' ? 'Indefinido' : 'Plazo fijo') + '</div>' +
                '<div><b>Fecha de ingreso:</b> ' + D.fechaCorta(r.record.ingreso) + '</div>' +
                '</div>' +
                '<div class="print-h3">Haberes</div>' +
                '<table class="print-table"><tbody>' + filas(d.haberesImponibles.concat(d.haberesNoImponibles)) +
                '<tr class="total"><td>Total haberes</td><td class="r">' + D.money(d.totalHaberes) + '</td></tr></tbody></table>' +
                '<div class="print-h3">Descuentos</div>' +
                '<table class="print-table"><tbody>' + filas(d.descuentosLegales.concat(d.otrosDescuentos)) +
                '<tr class="total"><td>Total descuentos</td><td class="r">' + D.money(d.totalDescuentos) + '</td></tr></tbody></table>' +
                '<table class="print-table" style="margin-top:10px"><tbody>' +
                '<tr class="total"><td>Líquido a pagar</td><td class="r">' + D.money(d.liquido) + '</td></tr></tbody></table>' +
                (d.empleador ? '<div class="print-h3">Costo del empleador</div><table class="print-table"><tbody>' +
                    filas(d.empleador.lineas) +
                    '<tr class="total"><td>Costo total</td><td class="r">' + D.money(d.empleador.costoTotal) + '</td></tr></tbody></table>' : '') +
                (r.avisos.length ? '<div class="print-flag">Observaciones: ' + D.esc(r.avisos.join(' ')) + '</div>' : '') +
                D.NOTA + '</div>');
        });

        document.getElementById('print-area').innerHTML = paginas.join('');
    }

    // ---------------------------------------------------------------- datos

    function cargar(rows, archivo) {
        var mapped = rows.map(function (r) { return D.mapaColumnas(r, ALIAS); })
            .filter(function (m) { return Object.keys(m).some(function (k) { return m[k] !== ''; }); });
        if (!mapped.length) { D.avisar('No encontramos columnas reconocibles. Revisa la plantilla.'); return; }

        state.archivo = archivo || '';
        state.records = mapped.map(registro);

        cargarPeriodo(true).then(function () { calcularTodo(); });
    }

    var EJEMPLO = [
        ['19.876.543-2', 'Camila Rojas Fuentes', 1450000, 30, 'Cuprum', 'Fonasa', '', 'indefinido', 42, '2018-04-02', 0, 180000, 0, 0],
        ['12.345.678-9', 'María González Pérez', 1200000, 30, 'Modelo', 'Isapre', 3.4, 'indefinido', 42, '2019-03-01', 0, 150000, 0, 6],
        ['9.876.543-2', 'Pedro Soto Ramírez', 850000, 30, 'Uno', 'Fonasa', '', 'plazo', 42, '2025-07-15', 0, 100000, 0, 0],
        ['16.543.210-K', 'Andrés Muñoz Tapia', 2350000, 30, 'Habitat', 'Isapre', 4.8, 'indefinido', 42, '2015-01-20', 250000, 0, 0, 4],
        ['20.111.222-3', 'Valentina Castro León', 780000, 30, 'Planvital', 'Fonasa', '', 'indefinido', 30, '2023-11-06', 0, 80000, 50000, 0],
        ['13.222.333-4', 'Rodrigo Álvarez Pinto', 3100000, 30, 'Provida', 'Isapre', 5.6, 'indefinido', 42, '2012-06-01', 300000, 0, 0, 0],
        ['21.444.555-6', 'Francisca Herrera Ríos', 690000, 20, 'Cuprum', 'Fonasa', '', 'plazo', 30, '2026-02-19', 0, 70000, 0, 0],
        ['10.999.888-7', 'Jorge Vergara Salas', 4200000, 30, 'Habitat', 'Isapre', 6.2, 'indefinido', 42, '2008-09-15', 380000, 0, 120000, 8],
        ['22.777.888-9', 'Daniela Núñez Bravo', 640000, 30, 'Modelo', 'Fonasa', '', 'indefinido', 42, '2025-01-13', 0, 60000, 0, 0],
        ['15.666.555-4', 'Mauricio Contreras Vidal', 1750000, 30, 'Uno', 'Isapre', 3.9, 'indefinido', 42, '2017-05-08', 0, 200000, 90000, 3]
    ];

    function cargarEjemplo() {
        var rows = EJEMPLO.map(function (r) {
            return {
                'RUT': r[0], 'Nombre': r[1], 'Sueldo base': r[2], 'Días trabajados': r[3], 'AFP': r[4],
                'Salud': r[5], 'Plan Isapre UF': r[6], 'Contrato': r[7], 'Jornada': r[8],
                'Fecha ingreso': r[9], 'Colación': r[10], 'Movilización': r[11],
                'Comisiones': r[12], 'Horas extra': r[13]
            };
        });
        cargar(rows, 'ejemplo-liquidaciones-' + document.getElementById('periodo').value + '.xlsx');
    }

    function exportar() {
        var filas = state.results.map(function (r) {
            return [r.record.rut, r.record.nombre, r.record.afp, r.record.salud === 'isapre' ? 'Isapre' : 'Fonasa',
                r.record.contrato, r.record.dias, Math.round(r.haberes), Math.round(r.descuentos),
                Math.round(r.liquido), Math.round(r.costo), r.error];
        });
        D.descargarCsv('liquidaciones-' + document.getElementById('periodo').value + '.csv',
            ['RUT', 'Trabajador', 'AFP', 'Salud', 'Contrato', 'Días', 'Haberes', 'Descuentos', 'Líquido', 'Costo empresa', 'Observación'],
            filas);
    }

    function plantilla() {
        var data = [
            ['RUT', 'Nombre', 'Sueldo base', 'Días trabajados', 'AFP', 'Salud', 'Plan Isapre UF', 'Contrato', 'Jornada', 'Fecha ingreso', 'Colación', 'Movilización', 'Comisiones', 'Horas extra', 'Gratificación'],
            ['12.345.678-9', 'María González Pérez', 1200000, 30, 'Modelo', 'Isapre', 3.4, 'indefinido', 42, '2019-03-01', 0, 150000, 0, 0, ''],
            ['9.876.543-2', 'Pedro Soto Ramírez', 850000, 30, 'Uno', 'Fonasa', '', 'plazo', 42, '2025-07-15', 0, 100000, 0, 0, ''],
            ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
        ];
        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 13 }, { wch: 15 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 9 }, { wch: 14 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 13 }];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');
        XLSX.writeFile(wb, 'plantilla-liquidaciones-calculolaboral.xlsx');
    }

    // ----------------------------------------------------------------- boot

    document.addEventListener('DOMContentLoaded', function () {
        var periodo = document.getElementById('periodo');
        var mes = periodoActual();
        if (+mes.slice(0, 4) === 2026 || +mes.slice(0, 4) > 2026) periodo.value = mes;

        cargarPeriodo(true);

        periodo.addEventListener('change', function () {
            cargarPeriodo(true).then(function () {
                if (state.records.length) calcularTodo();
            });
        });

        ['liq-uf', 'liq-utm', 'liq-tasa-mutual'].forEach(function (id) {
            var el = document.getElementById(id);
            el.addEventListener('change', function () { if (state.records.length) calcularTodo(); });
        });

        var drop = document.getElementById('drop-liq');
        var file = document.getElementById('file-liq');

        drop.addEventListener('click', function () { file.click(); });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
        drop.addEventListener('drop', function (e) {
            e.preventDefault();
            drop.classList.remove('over');
            if (e.dataTransfer.files.length) subir(e.dataTransfer.files[0]);
        });
        file.addEventListener('change', function () { if (file.files.length) subir(file.files[0]); });

        function subir(f) {
            D.leerArchivo(f).then(function (r) { cargar(r.rows, r.nombre); })
                .catch(function (e) { D.avisar('No pudimos leer el archivo: ' + e.message); });
        }

        document.getElementById('btn-sample-liq').addEventListener('click', function () {
            cargarPeriodo(true).then(cargarEjemplo);
        });
        document.getElementById('btn-template-liq').addEventListener('click', plantilla);
        document.getElementById('btn-csv-liq').addEventListener('click', exportar);
        document.getElementById('btn-print-liq').addEventListener('click', function () {
            construirImpresion();
            window.print();
        });

        document.addEventListener('demo:logo', function () {
            if (state.results.length) construirImpresion();
        });

        if (/[?&]demo=1/.test(location.search) && /[?&]tab=liq/.test(location.search)) {
            var radio = document.querySelector('input[name="modo"][value="liquidaciones"]');
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
            cargarPeriodo(true).then(function () { sinScroll = true; cargarEjemplo(); });
        }
    });
})();
