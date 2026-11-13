/**
 * Motor de cálculo para finiquito de Trabajadora de Casa Particular en Chile.
 * Régimen especial: Arts. 146 a 150, Art. 148, Art. 161 inc. 2°, Art. 163 inc. 5° CT y Ley 21.269.
 */
(function (root) {
    'use strict';

    const DEFAULT_CONSTANTS = {
        UF: 41322.93,
        IMM: 553553,
        TOPE_INDEMNIZACION: 90,
        TOPE_IMPONIBLE_CASA_PARTICULAR_UF: 60,
        TASA_AFP_TODO_EVENTO_ACTUAL: 0.0111,   // Ley 21.269 (desde 01-10-2020)
        TASA_AFP_TODO_EVENTO_PREVIO: 0.0411,   // Anterior a 01-10-2020
        TASA_AFC_EMPLEADOR: 0.03,              // 2,2% CIC + 0,8% FCS
        FACTOR_VACACIONES_NORMAL: 1.25,
        FACTOR_VACACIONES_EXTREMA: 20 / 12,
        MAX_ANOS_INDEMNIZACION: 11,
        HOLIDAYS_2026: [],
        HOLIDAYS_2027: []
    };

    function getConstants() {
        return typeof CONSTANTS !== 'undefined' ? CONSTANTS : DEFAULT_CONSTANTS;
    }

    function parseUTCDate(str) {
        if (!str || typeof str !== 'string') return null;
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        const dt = new Date(Date.UTC(y, mo, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
        return dt;
    }

    function countWholeMonthsSplit(startDate, endDate) {
        const minStart = new Date(Date.UTC(1991, 0, 1));
        const effectiveStart = startDate > minStart ? startDate : minStart;
        if (endDate < effectiveStart) {
            return { totalMonths: 0, monthsBeforeOct2020: 0, monthsFromOct2020: 0, cappedMonths: 0 };
        }
        const ley21269Date = new Date(Date.UTC(2020, 9, 1)); // 2020-10-01
        const maxMonths = 11 * 12; // 132 meses (Art. 163 inc. 5° letra b) CT)

        let monthsBefore = 0;
        let monthsAfter = 0;
        let curYear = effectiveStart.getUTCFullYear();
        let curMonth = effectiveStart.getUTCMonth();
        const endPlusOne = new Date(endDate.getTime() + 86400000);
        const totalDiff = (endPlusOne.getUTCFullYear() - effectiveStart.getUTCFullYear()) * 12
            + (endPlusOne.getUTCMonth() - effectiveStart.getUTCMonth())
            + (endPlusOne.getUTCDate() >= effectiveStart.getUTCDate() ? 0 : -1);
        const rawMonths = Math.max(0, totalDiff);
        const cappedMonths = Math.min(rawMonths, maxMonths);

        for (let i = 0; i < cappedMonths; i++) {
            const monthDate = new Date(Date.UTC(curYear, curMonth + i, 1));
            if (monthDate < ley21269Date) monthsBefore++;
            else monthsAfter++;
        }

        return {
            totalMonths: rawMonths,
            cappedMonths,
            monthsBeforeOct2020: monthsBefore,
            monthsFromOct2020: monthsAfter
        };
    }

    function calculateServiceTime(startDate, endDate) {
        const end = new Date(endDate.getTime() + 86400000);
        let years = end.getUTCFullYear() - startDate.getUTCFullYear();
        let months = end.getUTCMonth() - startDate.getUTCMonth();
        let days = end.getUTCDate() - startDate.getUTCDate();

        if (days < 0) {
            months -= 1;
            days += 30;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
    }

    function calculateVacation(startDate, endDate, fullMonthlySalary, opts) {
        const C = getConstants();
        const isExtremeZone = Boolean(opts.isExtremeZone);
        const vacationDaysPending = Math.max(0, parseFloat(opts.vacationDaysPending) || 0);
        const vacationDaysTaken = Math.max(0, parseFloat(opts.vacationDaysTaken) || 0);
        const factor = isExtremeZone ? (C.FACTOR_VACACIONES_EXTREMA || (20 / 12)) : (C.FACTOR_VACACIONES_NORMAL || 1.25);

        const endPlusOne = new Date(endDate.getTime() + 86400000);
        const totalServiceDays = Math.max(0, Math.round((endPlusOne - startDate) / 86400000));
        // Feriado acumulado total si se descuentan tomados, o saldo pendiente + proporcional desde último aniversario
        const st = calculateServiceTime(startDate, endDate);
        const totalMonthsApprox = (st.years * 12) + st.months + (st.days / 30);

        let totalBusinessDays;
        if (opts.useTotalAccruedMode) {
            totalBusinessDays = Math.max(0, (totalMonthsApprox * factor) - vacationDaysTaken);
        } else {
            const lastAnniv = new Date(Date.UTC(endPlusOne.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
            if (lastAnniv > endPlusOne) {
                lastAnniv.setUTCFullYear(endPlusOne.getUTCFullYear() - 1);
            }
            let propMonths = endPlusOne.getUTCMonth() - lastAnniv.getUTCMonth();
            let propDays = endPlusOne.getUTCDate() - lastAnniv.getUTCDate();
            if (propDays < 0) {
                propMonths -= 1;
                propDays += 30;
            }
            if (propMonths < 0) {
                propMonths += 12;
            }
            const accruedCurrentYear = (propMonths + (propDays / 30)) * factor;
            totalBusinessDays = Math.max(0, accruedCurrentYear + vacationDaysPending - vacationDaysTaken);
        }

        const holidays = Array.from(new Set(
            [].concat(C.HOLIDAYS_2026 || [], C.HOLIDAYS_2027 || [], Array.isArray(opts.holidays) ? opts.holidays : [])
        ));

        let cur = new Date(endDate.getTime());
        cur.setUTCDate(cur.getUTCDate() + 1);

        const wholeBusiness = Math.floor(totalBusinessDays);
        const fracBusiness = totalBusinessDays - wholeBusiness;
        let bizCount = 0;
        let nonBizCount = 0;
        let safety = 0;

        while (bizCount < wholeBusiness && safety < 1500) {
            const dow = cur.getUTCDay();
            const iso = cur.toISOString().slice(0, 10);
            if (dow !== 0 && dow !== 6 && !holidays.includes(iso)) {
                bizCount += 1;
            } else {
                nonBizCount += 1;
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
            safety += 1;
        }

        const totalCalendarDays = totalBusinessDays + nonBizCount;
        const dailySalary = fullMonthlySalary / 30;
        const totalAmount = totalServiceDays > 0 ? Math.round(totalCalendarDays * dailySalary) : 0;

        return {
            businessDays: Number(totalBusinessDays.toFixed(2)),
            nonBusinessDays: nonBizCount,
            calendarDays: Number(totalCalendarDays.toFixed(2)),
            dailySalary: Math.round(dailySalary),
            total: totalAmount,
            debugFrac: fracBusiness
        };
    }

    function calculateCasaParticularFiniquito(input) {
        const C = getConstants();
        const startDate = parseUTCDate(input.startDate);
        const endDate = parseUTCDate(input.endDate);

        if (!startDate || !endDate || endDate < startDate) {
            return {
                error: 'La fecha de término debe ser posterior o igual a la fecha de inicio.',
                valid: false,
                employerTotal: 0,
                afpIndemnity: { estimatedTotal: 0, reportedTotal: 0, displayTotal: 0 },
                grandCombinedTotal: 0
            };
        }

        const ufValue = parseFloat(input.ufValue) || C.UF || 41322.93;
        const baseSalary = Math.max(0, parseInt(input.baseSalary, 10) || 0);
        const agreedGratification = Math.max(0, parseInt(input.agreedGratification, 10) || 0);
        const nonTaxableAssignments = Math.max(0, parseInt(input.nonTaxableAssignments, 10) || 0);
        const modalidad = input.modalidad === 'puertas_adentro' ? 'puertas_adentro' : 'puertas_afuera';
        const causal = input.causal || '161_2';
        const noticeGiven = Boolean(input.noticeGiven);
        const isExtremeZone = Boolean(input.isExtremeZone);

        const remuneracionImponible = baseSalary + agreedGratification;
        // Sueldo mensual devengado para aviso previo y días pendientes
        const remuneracionDevengada = remuneracionImponible + nonTaxableAssignments;
        // Feriado: remuneración íntegra diaria (sueldo base / 30; DT Ord. 836/46 excluye gratificación mensual si se conserva)
        const vacationDailyBase = baseSalary;

        const serviceTime = calculateServiceTime(startDate, endDate);

        // 1. Días trabajados pendientes del último mes
        const daysInEndMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate();
        const startedSameMonth = startDate.getUTCFullYear() === endDate.getUTCFullYear()
            && startDate.getUTCMonth() === endDate.getUTCMonth();
        const fromDay = startedSameMonth ? startDate.getUTCDate() : 1;
        let autoDays = endDate.getUTCDate() - fromDay + 1;
        if (endDate.getUTCDate() === daysInEndMonth) {
            autoDays = startedSameMonth ? Math.max(0, 30 - fromDay + 1) : 30;
        }
        autoDays = Math.max(0, Math.min(30, autoDays));

        const daysWorkedInput = (input.workedDaysMonth !== undefined && input.workedDaysMonth !== null && input.workedDaysMonth !== '')
            ? Math.max(0, Math.min(30, parseFloat(input.workedDaysMonth) || 0))
            : autoDays;
        const includePendingDays = input.includePendingDays !== false;
        const pendingPayTotal = includePendingDays ? Math.round((remuneracionDevengada / 30) * daysWorkedInput) : 0;

        // 2. Días adicionales Art. 150 letra d) puertas adentro pendientes (hasta 2 días libres por mes)
        const pendingRestDays = modalidad === 'puertas_adentro'
            ? Math.max(0, parseFloat(input.pendingRestDays) || 0)
            : 0;
        const pendingRestDaysPay = Math.round((remuneracionDevengada / 30) * pendingRestDays);

        // 3. Feriado proporcional / pendiente (Arts. 67 y 73 CT)
        const vacation = calculateVacation(startDate, endDate, vacationDailyBase, {
            isExtremeZone,
            vacationDaysPending: input.vacationDaysPending,
            vacationDaysTaken: input.vacationDaysTaken,
            holidays: input.holidays
        });

        // 4. Indemnización sustitutiva del aviso previo (solo Art. 161 inc. 2° sin aviso de 30 días)
        const noticeCap = Math.round(ufValue * (C.TOPE_INDEMNIZACION || 90));
        const noticeApplies = causal === '161_2' && !noticeGiven;
        const noticeAmount = noticeApplies ? Math.min(remuneracionDevengada, noticeCap) : 0;

        // 5. AFC trabajadora: 0% (Ley 21.269) -> NO hay descuento AFC al finiquito
        const afcWorkerDeduction = 0;

        const employerTotal = pendingPayTotal + pendingRestDaysPay + vacation.total + noticeAmount - afcWorkerDeduction;

        // 6. Cuenta AFP de Indemnización a Todo Evento (Art. 163 inc. 5° CT)
        // Tope de remuneración imponible: 60 UF (Compendio de Pensiones, Título V, N°10)
        const afpCapCLP = Math.round(ufValue * 60);
        const cappedBase60UF = Math.min(remuneracionImponible, afpCapCLP);
        const split = countWholeMonthsSplit(startDate, endDate);

        const monthlyContributionCurrent = Math.round(cappedBase60UF * 0.0111); // 1,11%
        const monthlyContributionPrevious = Math.round(cappedBase60UF * 0.0411); // 4,11% previo oct-2020
        const monthlyAFCBenefitEmployer = Math.round(remuneracionImponible * 0.03); // 3,0% AFC empleador (2,2% CIC + 0,8% FCS)

        const estimatedContribution = (split.monthsFromOct2020 * monthlyContributionCurrent)
            + (split.monthsBeforeOct2020 * monthlyContributionPrevious);

        const hasReportedBalance = input.afpSavedBalance !== undefined
            && input.afpSavedBalance !== null
            && input.afpSavedBalance !== ''
            && parseInt(input.afpSavedBalance, 10) > 0;
        const reportedTotal = hasReportedBalance ? Math.max(0, parseInt(input.afpSavedBalance, 10) || 0) : 0;
        const afpDisplayTotal = hasReportedBalance ? reportedTotal : estimatedContribution;

        return {
            valid: true,
            modalidad,
            causal,
            ufValue,
            serviceTime,
            economics: {
                baseSalary,
                agreedGratification,
                nonTaxableAssignments,
                remuneracionImponible,
                remuneracionDevengada,
                afpCap60UF: afpCapCLP,
                cappedBase60UF,
                isCapped60UF: remuneracionImponible > afpCapCLP,
                isBelowIMM: baseSalary > 0 && baseSalary < (C.IMM || 553553)
            },
            employerPayments: {
                daysWorked: includePendingDays ? daysWorkedInput : 0,
                pendingPayTotal,
                pendingRestDays,
                pendingRestDaysPay,
                vacation,
                noticeApplies,
                noticeAmount,
                afcWorkerDeduction,
                total: employerTotal
            },
            afpIndemnity: {
                monthsTotal: split.totalMonths,
                monthsCapped: split.cappedMonths,
                monthsBeforeOct2020: split.monthsBeforeOct2020,
                monthsFromOct2020: split.monthsFromOct2020,
                monthlyContributionCurrent,
                monthlyContributionPrevious,
                estimatedCapitalTotal: estimatedContribution,
                reportedTotal,
                usingReportedBalance: hasReportedBalance,
                displayTotal: afpDisplayTotal
            },
            monthlyEmployerCost: {
                afc3Percent: monthlyAFCBenefitEmployer,
                afp111Percent: monthlyContributionCurrent,
                total411Percent: monthlyAFCBenefitEmployer + monthlyContributionCurrent
            },
            grandCombinedTotal: employerTotal + afpDisplayTotal
        };
    }

    const api = {
        calculateCasaParticularFiniquito,
        calculateServiceTime,
        countWholeMonthsSplit,
        parseUTCDate
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CasaParticularCalculator = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
