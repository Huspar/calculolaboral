/*
 * Verificación headless del motor que usa la demo de contadores.
 * Carga constants.js y logic.js en un mismo contexto y calcula un finiquito
 * con los mismos parámetros que envía js/demo_contadores.js.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });

for (const f of ['js/constants.js', 'js/logic.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}

const probe = `
(function () {
    const UF = CONSTANTS.UF;
    const cases = [
        { nombre: 'Camila Rojas', startDate: '2018-04-02', endDate: '2026-10-31', baseSalary: 1450000, assignments: 180000, vacationDaysPending: 5, cause: '161' },
        { nombre: 'Rodrigo Alvarez', startDate: '2012-06-01', endDate: '2026-10-31', baseSalary: 3100000, assignments: 300000, variableAverage: 210000, vacationDaysPending: 20, cause: '161' },
        { nombre: 'Jorge Vergara (tope)', startDate: '2008-09-15', endDate: '2026-10-31', baseSalary: 4200000, assignments: 380000, vacationDaysPending: 15, cause: '161' },
        { nombre: 'Pedro Soto (renuncia)', startDate: '2022-07-15', endDate: '2026-10-31', baseSalary: 850000, assignments: 100000, variableAverage: 60000, vacationDaysPending: 0, cause: '159' }
    ];
    return cases.map(function (c) {
        const calc = new FiniquitoCalculator({
            startDate: c.startDate, endDate: c.endDate,
            baseSalary: c.baseSalary, gratification: 0,
            assignments: c.assignments, variableAverage: c.variableAverage || 0,
            vacationDaysPending: c.vacationDaysPending, cause: c.cause,
            noticeGiven: false, includeAssignmentsInIndemnity: true,
            includeAssignmentsInVacation: false, enableIAS: true, enableNotice: true,
            enablePending: true, simulateAFC: true, ufValue: UF,
            holidays: CONSTANTS.HOLIDAYS_2026
        });
        const r = calc.calculate();
        return {
            nombre: c.nombre,
            error: r.error || '',
            aniosIndemnizables: r.serviceTime.indemnityYears,
            tope: r.economics.isCapped,
            topeMonto: r.economics.salaryCap,
            indemnizacion: r.indemnities.yearsOfService.total,
            aviso: r.indemnities.notice.total,
            vacaciones: r.indemnities.vacation.total,
            pendiente: r.pendingRemuneration.total,
            afc: r.afc.total,
            total: r.total
        };
    });
})()
`;

const out = vm.runInContext(probe, ctx, { filename: 'probe.js' });

let fallos = 0;
for (const c of out) {
    const ok = !c.error && c.total > 0;
    if (!ok) fallos++;
    console.log(
        (ok ? 'OK  ' : 'FALLA') + '  ' + c.nombre.padEnd(24) +
        ' total=' + String(Math.round(c.total)).padStart(9) +
        '  anios=' + String(c.aniosIndemnizables).padStart(5) +
        '  ias=' + String(Math.round(c.indemnizacion)).padStart(9) +
        '  tope=' + c.tope
        + (c.error ? '  error=' + c.error : '')
    );
}

// Comprobaciones de coherencia
const camila = out[0];
const pedro = out[3];
const checks = [
    ['Camila (161) tiene indemnización', camila.indemnizacion > 0],
    ['Camila tiene vacaciones pagadas', camila.vacaciones > 0],
    ['Pedro (159) no tiene indemnización', pedro.indemnizacion === 0 && pedro.aviso === 0],
    ['Jorge supera el tope de 90 UF', out[2].tope === true],
    ['El tope se aplica a la indemnización', out[2].indemnizacion > 0 && out[2].topeMonto > 0],
    ['Todos los totales son positivos', out.every(c => c.total > 0)]
];
for (const [label, cond] of checks) {
    if (!cond) fallos++;
    console.log((cond ? 'OK  ' : 'FALLA') + '  ' + label);
}
console.log(fallos === 0 ? '\nTODO OK (' + (out.length + checks.length) + ' comprobaciones)' : '\n' + fallos + ' FALLAS');
process.exit(fallos === 0 ? 0 : 1);
