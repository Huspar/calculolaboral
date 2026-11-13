// Pruebas del motor de finiquito de trabajadora de casa particular: node tools/test_casa_particular.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.CONSTANTS = undefined;
const { calculateCasaParticularFiniquito, countWholeMonthsSplit } = require('../js/casa_particular_logic');

let ok = 0;
function caso(nombre, fn) {
    try {
        fn();
        ok += 1;
        console.log('  ok  ' + nombre);
    } catch (e) {
        console.error('  FALLA  ' + nombre + '\n         ' + e.message);
        process.exitCode = 1;
    }
}

caso('desahucio Art. 161 inc. 2 sin aviso: incluye mes de aviso, días trabajados, feriado y aporte 1,11% AFP separado del pago empleador', () => {
    const r = calculateCasaParticularFiniquito({
        startDate: '2024-01-01',
        endDate: '2026-01-31',
        modalidad: 'puertas_afuera',
        causal: '161_2',
        noticeGiven: false,
        baseSalary: 600000,
        ufValue: 41322.93,
        workedDaysMonth: 30,
        vacationDaysPending: 0,
        vacationDaysTaken: 0
    });
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.employerPayments.noticeApplies, true);
    assert.strictEqual(r.employerPayments.noticeAmount, 600000);
    assert.strictEqual(r.employerPayments.pendingPayTotal, 600000);
    assert.strictEqual(r.employerPayments.afcWorkerDeduction, 0);
    assert.strictEqual(r.afpIndemnity.monthsCapped, 25);
    assert.strictEqual(r.afpIndemnity.monthlyContributionCurrent, Math.round(600000 * 0.0111));
    assert.strictEqual(r.afpIndemnity.estimatedCapitalTotal, 25 * Math.round(600000 * 0.0111));
    assert.strictEqual(r.employerPayments.total, 600000 + 600000 + r.employerPayments.vacation.total);
    assert.strictEqual(r.grandCombinedTotal, r.employerPayments.total + r.afpIndemnity.displayTotal);
});

caso('renuncia voluntaria Art. 159 N°2: no paga aviso previo pero sí mantiene retiro completo de la AFP a todo evento', () => {
    const r = calculateCasaParticularFiniquito({
        startDate: '2023-06-01',
        endDate: '2026-05-31',
        modalidad: 'puertas_afuera',
        causal: '159_2',
        noticeGiven: false,
        baseSalary: 553553,
        ufValue: 41322.93
    });
    assert.strictEqual(r.employerPayments.noticeApplies, false);
    assert.strictEqual(r.employerPayments.noticeAmount, 0);
    assert.strictEqual(r.afpIndemnity.monthsCapped, 36);
    assert.ok(r.afpIndemnity.estimatedCapitalTotal > 0);
});

caso('puertas adentro con días libres mensuales Art. 150 letra d) pendientes y saldo exacto AFP informado', () => {
    const r = calculateCasaParticularFiniquito({
        startDate: '2025-01-01',
        endDate: '2026-10-31',
        modalidad: 'puertas_adentro',
        causal: '148',
        baseSalary: 750000,
        pendingRestDays: 2,
        workedDaysMonth: 30,
        afpSavedBalance: 320000,
        ufValue: 41322.93
    });
    assert.strictEqual(r.employerPayments.pendingRestDays, 2);
    assert.strictEqual(r.employerPayments.pendingRestDaysPay, 50000); // (750000/30)*2
    assert.strictEqual(r.employerPayments.noticeAmount, 0);
    assert.strictEqual(r.afpIndemnity.usingReportedBalance, true);
    assert.strictEqual(r.afpIndemnity.displayTotal, 320000);
});

caso('tope de remuneración imponible de 60 UF en aporte 1,11% AFP y tope de 11 años (132 meses)', () => {
    const uf = 40000;
    const r = calculateCasaParticularFiniquito({
        startDate: '2010-01-01',
        endDate: '2025-12-31',
        modalidad: 'puertas_afuera',
        causal: '160',
        baseSalary: 3200000, // sobre 60 UF (2.400.000)
        ufValue: uf
    });
    assert.strictEqual(r.economics.isCapped60UF, true);
    assert.strictEqual(r.economics.afpCap60UF, 2400000);
    assert.strictEqual(r.afpIndemnity.monthsCapped, 132);
    assert.strictEqual(r.afpIndemnity.monthlyContributionCurrent, Math.round(2400000 * 0.0111));
});

caso('tramo previo a oct 2020 usa 4,11% AFP y posterior a oct 2020 usa 1,11% AFP + 3,0% AFC empleador', () => {
    const split = countWholeMonthsSplit(new Date(Date.UTC(2019, 9, 1)), new Date(Date.UTC(2021, 9, 31)));
    assert.strictEqual(split.monthsBeforeOct2020, 12);
    assert.strictEqual(split.monthsFromOct2020, 13);
    assert.strictEqual(split.cappedMonths, 25);
});

if (!process.exitCode) {
    console.log('Total pruebas Casa Particular OK: ' + ok);
}
