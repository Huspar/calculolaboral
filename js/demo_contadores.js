/*
 * CálculoLaboral · finiquitos en lote (demo para estudios contables).
 * Reutiliza el motor público (/js/logic.js). Todo se calcula en el navegador.
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var state = { records: [], results: [], archivo: '' };
    var sinScroll = false;

    var ALIAS = {
        rut: ['rut', 'rut_trabajador', 'rut_empleado'],
        nombre: ['nombre', 'nombre_trabajador', 'trabajador', 'empleado', 'nombre_completo', 'apellidos_nombres'],
        inicio: ['fecha_ingreso', 'ingreso', 'fecha_de_ingreso', 'fecha_inicio', 'desde', 'fecha_contrato'],
        termino: ['fecha_termino', 'termino', 'fecha_de_termino', 'fecha_egreso', 'fecha_fin', 'hasta', 'fecha_baja'],
        sueldo: ['sueldo_base', 'sueldo', 'base', 'remuneracion_base', 'sueldo_bruto'],
        gratificacion: ['gratificacion', 'gratificacion_legal', 'grat'],
        asignaciones: ['colacion_movilizacion', 'colacion_y_movilizacion', 'asignaciones', 'asignacion', 'colacion', 'movilizacion'],
        variables: ['promedio_variables', 'variables', 'promedio_variable', 'variable', 'promedio_ultimos_3_meses'],
        vacaciones: ['dias_vacaciones_pendientes', 'vacaciones_pendientes', 'dias_vacaciones', 'vacaciones', 'dias_pendientes'],
        causal: ['causal', 'causa', 'articulo', 'art', 'causal_de_termino']
    };

    function causal(v) {
        var s = D.norm(v);
        if (!s) return '161';
        var m = s.match(/(159|160|161|163)/);
        if (m) return m[1];
        if (/necesidades|empresa/.test(s)) return '161';
        if (/renuncia|mutuo|voluntari/.test(s)) return '159';
        if (/justificad/.test(s)) return '160';
        if (/obra|faena/.test(s)) return '163';
        return '161';
    }

    function registro(m, i) {
        return {
            fila: i + 2,
            rut: String(m.rut || '').trim(),
            nombre: String(m.nombre || '').trim() || 'Sin nombre',
            inicio: D.parseDate(m.inicio),
            termino: D.parseDate(m.termino),
            sueldo: D.parseNumber(m.sueldo),
            gratificacion: D.parseNumber(m.gratificacion),
            asignaciones: D.parseNumber(m.asignaciones),
            variables: D.parseNumber(m.variables),
            vacaciones: D.parseNumber(m.vacaciones),
            causal: causal(m.causal)
        };
    }

    function calcularTodo(records) {
        var uf = D.parseNumber(document.getElementById('uf-value').value) ||
            (typeof CONSTANTS !== 'undefined' ? CONSTANTS.UF : 41130.94);
        var feriados = (typeof CONSTANTS !== 'undefined' && CONSTANTS.HOLIDAYS_2026) ? CONSTANTS.HOLIDAYS_2026 : [];

        state.results = records.map(function (r) {
            var out = {
                record: r, error: '', warnings: [], notes: [],
                serviceTime: { indemnityYears: 0 },
                ias: 0, notice: 0, vacation: 0, pending: 0, afc: 0, total: 0
            };

            if (!r.inicio || !r.termino) { out.error = 'Falta la fecha de ingreso o de término'; return out; }
            if (!r.sueldo) { out.error = 'Falta el sueldo base'; return out; }

            try {
                var calc = new FiniquitoCalculator({
                    startDate: r.inicio, endDate: r.termino,
                    baseSalary: r.sueldo, gratification: r.gratificacion,
                    assignments: r.asignaciones, variableAverage: r.variables,
                    vacationDaysPending: r.vacaciones, cause: r.causal,
                    noticeGiven: false,
                    includeAssignmentsInIndemnity: true,
                    includeAssignmentsInVacation: false,
                    enableIAS: true, enableNotice: true, enablePending: true,
                    simulateAFC: true, ufValue: uf, holidays: feriados
                });
                var res = calc.calculate();
                if (res.error) { out.error = res.error; return out; }

                out.serviceTime = res.serviceTime;
                out.ias = res.indemnities.yearsOfService.total || 0;
                out.notice = res.indemnities.notice.total || 0;
                out.vacation = res.indemnities.vacation.total || 0;
                out.pending = res.pendingRemuneration ? res.pendingRemuneration.total : 0;
                out.afc = res.afc ? res.afc.total : 0;
                out.total = res.total || 0;

                if (res.economics && res.economics.isCapped) {
                    out.warnings.push('Sueldo sobre el tope de 90 UF (' + D.money(res.economics.salaryCap) + '): la indemnización se calculó con el tope.');
                }
                if (r.causal !== '161') {
                    out.notes.push('Causal ' + r.causal + ': no se liquidó indemnización por años de servicio ni aviso previo.');
                }
                if (res.afc && res.afc.applied) {
                    out.notes.push('Se descontó el aporte AFC del art. 13 de la Ley 19.728.');
                }
            } catch (err) {
                out.error = 'Error de cálculo: ' + (err && err.message ? err.message : 'desconocido');
            }
            return out;
        });

        pintar();
    }

    function pintar() {
        var results = state.results;
        if (!results.length) return;

        var ok = results.filter(function (r) { return !r.error; });
        var total = ok.reduce(function (s, r) { return s + r.total; }, 0);
        var errores = results.length - ok.length;
        var warns = [], notes = [];

        results.forEach(function (r) {
            r.warnings.forEach(function (w) { if (warns.indexOf(w) === -1) warns.push(w); });
            r.notes.forEach(function (w) { if (notes.indexOf(w) === -1) notes.push(w); });
        });

        document.getElementById('results-fin').removeAttribute('hidden');
        document.getElementById('rows-fin').textContent = state.archivo;
        document.getElementById('t-workers').textContent = ok.length + (errores ? ' / ' + results.length : '');
        document.getElementById('t-total').textContent = D.money(total);
        document.getElementById('t-avg').textContent = D.money(ok.length ? total / ok.length : 0);
        var errEl = document.getElementById('t-errors');
        errEl.textContent = errores;
        errEl.className = errores ? 'bad' : '';

        // Etiquetas para la vista de tarjetas (<=700px): salen del propio thead
        // para que no se despeguen de la tabla si cambia una columna.
        var cols = Array.prototype.map.call(document.querySelectorAll('#results-fin thead th'), function (th) {
            return th.textContent.trim();
        });
        function et(i) { return ' data-l="' + D.esc(cols[i] || '') + '"'; }

        document.getElementById('tbody-fin').innerHTML = results.map(function (r) {
            if (r.error) {
                return '<tr>' +
                    '<td class="nom"' + et(0) + '>' + D.esc(r.record.nombre) + '</td>' +
                    '<td class="mono"' + et(1) + '>' + D.esc(r.record.rut || '—') + '</td>' +
                    '<td colspan="6" style="color:var(--danger)">' + D.esc(r.error) + '</td>' +
                    '</tr>';
            }
            return '<tr>' +
                '<td class="nom"' + et(0) + '>' + D.esc(r.record.nombre) +
                (r.warnings.length ? '<span class="demo-badge" title="' + D.esc(r.warnings.join(' ')) + '">Tope 90 UF</span>' : '') + '</td>' +
                '<td class="mono"' + et(1) + '>' + D.esc(r.record.rut || '—') + '</td>' +
                '<td class="num"' + et(2) + '>' + D.num(r.serviceTime.indemnityYears) + '</td>' +
                '<td class="num"' + et(3) + '>' + D.money(r.ias) + '</td>' +
                '<td class="num"' + et(4) + '>' + D.money(r.notice) + '</td>' +
                '<td class="num"' + et(5) + '>' + D.money(r.vacation) + '</td>' +
                '<td class="num"' + et(6) + '>' + D.money(r.pending) + '</td>' +
                '<td class="num"' + et(7) + '><b>' + D.money(r.total) + '</b></td>' +
                '</tr>';
        }).join('');

        var partes = [];
        if (warns.length) partes.push('<b>Revisar antes de emitir:</b><br>' + warns.map(function (w) { return '· ' + D.esc(w); }).join('<br>'));
        if (notes.length) partes.push('<b>Notas del cálculo:</b><br>' + notes.map(function (w) { return '· ' + D.esc(w); }).join('<br>'));
        if (!partes.length) partes.push('<b>Sin advertencias.</b> Todos los cálculos usaron los datos de la nómina.');
        document.getElementById('warnings-fin').innerHTML = partes.join('<div style="height:10px"></div>');

        var card = document.getElementById('results-fin');
        if (!sinScroll && card.scrollIntoView && !document.getElementById('pane-finiquitos').hasAttribute('hidden')) {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        sinScroll = false;
        construirImpresion();
    }

    // ---------------------------------------------------------------- PDF

    function construirImpresion() {
        var ok = state.results.filter(function (r) { return !r.error; });
        var grande = ok.reduce(function (s, r) { return s + r.total; }, 0);
        var paginas = [];

        paginas.push('<div class="print-page">' +
            D.encabezado('Resumen del lote de finiquitos', ok.length + ' trabajadores · total ' + D.money(grande)) +
            '<table class="print-table"><thead><tr>' +
            '<th>Trabajador</th><th>RUT</th><th>Años</th><th class="r">Indemnización</th><th class="r">Aviso</th><th class="r">Vacaciones</th><th class="r">Pendiente</th><th class="r">Total</th>' +
            '</tr></thead><tbody>' +
            ok.map(function (r) {
                return '<tr><td>' + D.esc(r.record.nombre) + '</td><td>' + D.esc(r.record.rut || '—') + '</td>' +
                    '<td>' + D.num(r.serviceTime.indemnityYears) + '</td>' +
                    '<td class="r">' + D.money(r.ias) + '</td><td class="r">' + D.money(r.notice) + '</td>' +
                    '<td class="r">' + D.money(r.vacation) + '</td><td class="r">' + D.money(r.pending) + '</td>' +
                    '<td class="r"><b>' + D.money(r.total) + '</b></td></tr>';
            }).join('') +
            '<tr class="total"><td colspan="7">Total del lote</td><td class="r">' + D.money(grande) + '</td></tr>' +
            '</tbody></table>' + D.NOTA + '</div>');

        ok.forEach(function (r) {
            paginas.push('<div class="print-page">' +
                D.encabezado('Finiquito de trabajo', D.esc(r.record.nombre) + ' · ' + D.esc(r.record.rut || 'sin RUT')) +
                '<div class="print-data">' +
                '<div><b>Fecha de ingreso:</b> ' + D.fechaCorta(r.record.inicio) + '</div>' +
                '<div><b>Fecha de término:</b> ' + D.fechaCorta(r.record.termino) + '</div>' +
                '<div><b>Causal:</b> artículo ' + D.esc(r.record.causal) + '</div>' +
                '<div><b>Sueldo base:</b> ' + D.money(r.record.sueldo) + '</div>' +
                '<div><b>Años de servicio:</b> ' + D.num(r.serviceTime.indemnityYears) + '</div>' +
                '<div><b>Vacaciones pendientes:</b> ' + D.num(r.record.vacaciones) + ' días hábiles</div>' +
                '</div>' +
                '<table class="print-table"><thead><tr><th>Concepto</th><th class="r">Monto</th></tr></thead><tbody>' +
                '<tr><td>Indemnización por años de servicio</td><td class="r">' + D.money(r.ias) + '</td></tr>' +
                '<tr><td>Indemnización sustitutiva del aviso previo</td><td class="r">' + D.money(r.notice) + '</td></tr>' +
                '<tr><td>Feriado proporcional y pendiente</td><td class="r">' + D.money(r.vacation) + '</td></tr>' +
                '<tr><td>Remuneraciones pendientes del último mes</td><td class="r">' + D.money(r.pending) + '</td></tr>' +
                (r.afc ? '<tr><td>Menos: aporte AFC imputable (Ley 19.728)</td><td class="r">-' + D.money(r.afc) + '</td></tr>' : '') +
                '<tr class="total"><td>Total a pagar</td><td class="r">' + D.money(r.total) + '</td></tr>' +
                '</tbody></table>' +
                (r.warnings.length ? '<div class="print-flag">Observaciones: ' + D.esc(r.warnings.join(' ')) + '</div>' : '') +
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
        calcularTodo(state.records);
    }

    var EJEMPLO = [
        ['19.876.543-2', 'Camila Rojas Fuentes', '2018-04-02', '2026-10-31', 1450000, 0, 180000, 0, 5, '161'],
        ['12.345.678-9', 'María González Pérez', '2019-03-01', '2026-10-31', 1200000, 0, 150000, 0, 7.5, '161'],
        ['9.876.543-2', 'Pedro Soto Ramírez', '2022-07-15', '2026-10-31', 850000, 0, 100000, 60000, 0, '159'],
        ['16.543.210-K', 'Andrés Muñoz Tapia', '2015-01-20', '2026-10-31', 2350000, 0, 250000, 120000, 12, '161'],
        ['20.111.222-3', 'Valentina Castro León', '2023-11-06', '2026-10-31', 780000, 0, 80000, 0, 3.75, '159'],
        ['13.222.333-4', 'Rodrigo Álvarez Pinto', '2012-06-01', '2026-10-31', 3100000, 0, 300000, 210000, 20, '161'],
        ['21.444.555-6', 'Francisca Herrera Ríos', '2024-02-19', '2026-10-31', 690000, 0, 70000, 0, 6.25, '160'],
        ['10.999.888-7', 'Jorge Vergara Salas', '2008-09-15', '2026-10-31', 4200000, 0, 380000, 0, 15, '161'],
        ['22.777.888-9', 'Daniela Núñez Bravo', '2025-01-13', '2026-10-31', 640000, 0, 60000, 0, 1.25, '159'],
        ['15.666.555-4', 'Mauricio Contreras Vidal', '2017-05-08', '2026-10-31', 1750000, 0, 200000, 90000, 9, '161'],
        ['18.333.222-1', 'Paula Sandoval Meza', '2021-10-04', '2026-10-31', 980000, 0, 120000, 0, 4.5, '161'],
        ['11.555.444-8', 'Ricardo Espinoza Lara', '2010-02-22', '2026-10-31', 2900000, 0, 260000, 150000, 18, '161']
    ];

    function cargarEjemplo() {
        var rows = EJEMPLO.map(function (r) {
            return {
                'RUT': r[0], 'Nombre': r[1], 'Fecha ingreso': r[2], 'Fecha término': r[3],
                'Sueldo base': r[4], 'Gratificación': r[5], 'Colación y movilización': r[6],
                'Promedio variables': r[7], 'Días vacaciones pendientes': r[8], 'Causal': r[9]
            };
        });
        cargar(rows, 'ejemplo-12-trabajadores.xlsx');
    }

    function exportar() {
        var filas = state.results.map(function (r) {
            return [r.record.rut, r.record.nombre, r.record.inicio, r.record.termino, r.record.causal,
                r.serviceTime.indemnityYears || 0, Math.round(r.ias), Math.round(r.notice),
                Math.round(r.vacation), Math.round(r.pending), Math.round(r.afc), Math.round(r.total)];
        });
        D.descargarCsv('finiquitos-lote.csv',
            ['RUT', 'Trabajador', 'Fecha ingreso', 'Fecha término', 'Causal', 'Años', 'Indemnización', 'Aviso previo', 'Vacaciones', 'Rem. pendiente', 'AFC', 'Total'],
            filas);
    }

    function plantilla() {
        var data = [
            ['RUT', 'Nombre', 'Fecha ingreso', 'Fecha término', 'Sueldo base', 'Gratificación', 'Colación y movilización', 'Promedio variables', 'Días vacaciones pendientes', 'Causal'],
            ['12.345.678-9', 'María González Pérez', '2019-03-01', '2026-10-31', 1200000, 0, 150000, 0, 7.5, '161'],
            ['9.876.543-2', 'Pedro Soto Ramírez', '2022-07-15', '2026-10-31', 850000, 0, 100000, 60000, 0, '159'],
            ['', '', '', '', '', '', '', '', '', '']
        ];
        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 21 }, { wch: 16 }, { wch: 21 }, { wch: 9 }];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Nomina');
        XLSX.writeFile(wb, 'plantilla-finiquitos-calculolaboral.xlsx');
    }

    // ----------------------------------------------------------------- boot

    document.addEventListener('DOMContentLoaded', function () {
        var uf = document.getElementById('uf-value');
        var ufDef = (typeof CONSTANTS !== 'undefined' ? CONSTANTS.UF : 41130.94);
        // Si el motor de liquidaciones tiene la UF del mes en curso, úsala para que ambos módulos coincidan.
        if (window.CLLiquidacionParametros && window.CLLiquidacionParametros.RESPALDO) {
            var d = new Date();
            var p = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
            var r = window.CLLiquidacionParametros.RESPALDO[p];
            if (r && r.uf) ufDef = r.uf;
        }
        uf.value = ufDef;
        uf.addEventListener('change', function () { if (state.records.length) calcularTodo(state.records); });

        var drop = document.getElementById('drop-fin');
        var file = document.getElementById('file-fin');

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

        document.getElementById('btn-sample-fin').addEventListener('click', cargarEjemplo);
        document.getElementById('btn-template-fin').addEventListener('click', plantilla);
        document.getElementById('btn-csv-fin').addEventListener('click', exportar);
        document.getElementById('btn-print-fin').addEventListener('click', function () {
            construirImpresion();
            window.print();
        });

        document.addEventListener('demo:logo', function () {
            if (state.results.length) construirImpresion();
        });

        if (/[?&]demo=1/.test(location.search) && !/[?&]tab=liq/.test(location.search)) { sinScroll = true; cargarEjemplo(); }
    });
})();
