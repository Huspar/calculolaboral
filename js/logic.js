/**
 * Pure Logic for Chile Severance Calculator (Finiquito)
 * Based on Chilean Labor Code 2026 Standards & Praxis Forense
 * VERSIÓN CORREGIDA - Encoding UTF-8 + Mejoras
 */

// Defensive check for global constants
if (typeof CONSTANTS === 'undefined') {
    console.error("CONSTANTS no definido. Asegúrese de cargar constants.js antes de logic.js");
}

class FiniquitoCalculator {
    constructor(data) {
        // Fechas
        this.startDate = new Date(data.startDate);
        this.endDate = new Date(data.endDate);

        // Desglose de Remuneración
        this.baseSalary = parseInt(data.baseSalary) || 0;
        this.gratification = parseInt(data.gratification) || 0;
        this.assignments = parseInt(data.assignments) || 0; // Colación + Movilización (Imponibles para Feriado)
        this.variableAverage = parseInt(data.variableAverage) || 0; // Promedio 3 últimos meses

        // Parámetros adicionales
        this.cause = data.cause || '161'; // Artículo del Código del Trabajo
        this.noticeGiven = data.noticeGiven || false; // Si se dio aviso previo
        this.enableIAS = data.enableIAS !== undefined ? data.enableIAS : true;
        this.enableNotice = data.enableNotice !== undefined ? data.enableNotice : true;
        this.enablePending = data.enablePending !== undefined ? data.enablePending : true;
        this.simulateAFC = data.simulateAFC !== undefined ? data.simulateAFC : true;
        this.afcExactAmount = (data.afcExactAmount === undefined || data.afcExactAmount === null || data.afcExactAmount === '')
            ? null : (parseFloat(data.afcExactAmount) || 0);
        // Feriados de todos los años cargados (el feriado proporcional puede cruzar al año siguiente)
        const known = typeof CONSTANTS !== 'undefined'
            ? [].concat(CONSTANTS.HOLIDAYS_2026 || [], CONSTANTS.HOLIDAYS_2027 || []) : [];
        this.holidays = Array.from(new Set((Array.isArray(data.holidays) ? data.holidays : []).concat(known)));
        // Contrato con fechas invertidas o vacías: no se calcula nada
        this.invalidDates = isNaN(this.startDate) || isNaN(this.endDate) || this.endDate < this.startDate;

        // Toggle: incluir asignaciones en cálculo de indemnización (IAS / Aviso)
        this.includeAssignmentsInIndemnity = data.includeAssignmentsInIndemnity !== undefined ?
            data.includeAssignmentsInIndemnity : true;

        // Toggle: incluir asignaciones en cálculo de vacaciones. Por defecto no: colación y movilización
        // no son remuneración (art. 41 inc. 2 CT) y el feriado se paga con la remuneración íntegra (art. 71)
        this.includeAssignmentsInVacation = data.includeAssignmentsInVacation !== undefined ?
            data.includeAssignmentsInVacation : false;

        // Totales calculados
        // Base de cálculo IAS y aviso (art. 172, tope 90 UF): incluye por defecto colación y movilización
        // regulares, según la jurisprudencia de la Corte Suprema
        this.taxableSalary = this.baseSalary + this.gratification + this.variableAverage +
            (this.includeAssignmentsInIndemnity ? this.assignments : 0);

        // Base de cálculo Feriado (remuneración íntegra): sin la gratificación mensual, que el trabajador
        // conserva por el mes del término (DT Ord. 836/46 de 2004)
        this.fullSalary = this.baseSalary + this.variableAverage +
            (this.includeAssignmentsInVacation ? this.assignments : 0);

        this.vacationDaysPending = parseFloat(data.vacationDaysPending) || 0; // Días hábiles pendientes
        this.isExtremeZone = data.isExtremeZone || false; // Zona extrema (20 días vs 15 días)

        // Use global constant for default UF if not provided
        const defaultUF = typeof CONSTANTS !== 'undefined' ? CONSTANTS.UF : 0;
        this.ufValue = parseFloat(data.ufValue) || defaultUF;

        // Factor de vacaciones según zona
        const factorNormal = typeof CONSTANTS !== 'undefined' ? CONSTANTS.FACTOR_VACACIONES_NORMAL : 1.25;
        const factorExtrema = typeof CONSTANTS !== 'undefined' ? CONSTANTS.FACTOR_VACACIONES_EXTREMA : 1.67;

        this.vacationFactor = this.isExtremeZone ? factorExtrema : factorNormal;

        // Remuneración imponible (sin colación ni movilización): base del aporte al seguro de cesantía
        this.imponibleSalary = this.baseSalary + this.gratification + this.variableAverage;
    }

    /**
     * Fecha de la UF para el tope de 90 UF: último día del mes anterior al pago (art. 172 inc. final)
     * @param {string} paymentDate - YYYY-MM-DD
     * @returns {string} YYYY-MM-DD
     */
    static ufCapDate(paymentDate) {
        const d = new Date(paymentDate);
        if (isNaN(d)) return null;
        const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
        return last.toISOString().slice(0, 10);
    }

    /**
     * Función principal que ejecuta todos los cálculos
     * @returns {Object} Resultado completo del finiquito
     */
    calculate() {
        if (this.invalidDates) return this.emptyResult('La fecha de término es anterior a la de inicio.');

        // 1. Calcular tiempo de servicio
        const serviceTime = this.calculateServiceTime();

        // 2. Calcular sueldo base con tope 90 UF (redondeado al peso)
        const topeIndemnizacion = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_INDEMNIZACION : 90;
        const salaryCap = Math.round(this.ufValue * topeIndemnizacion);
        const cappedSalary = Math.min(this.taxableSalary, salaryCap);
        const isCapped = this.taxableSalary > salaryCap;

        // 3. Calcular indemnizaciones
        const yearsOfServiceAmount = this.calculateYearsOfServiceIndemnity(serviceTime, cappedSalary);
        const noticeAmount = this.calculateNoticeIndemnity(cappedSalary);
        const vacationAmount = this.calculateVacationIndemnity();

        // 4. Calcular remuneración pendiente (días trabajados del último mes)
        const pendingRemuneration = this.enablePending 
            ? this.calculatePendingRemuneration() 
            : { daysWorked: 0, propBase: 0, propGrat: 0, propAssign: 0, propVariable: 0, total: 0 };

        // 5. Calcular total (el aporte AFC solo se imputa a la indemnización por años de servicio)
        const afc = this.calculateAFCDeduction(serviceTime, yearsOfServiceAmount.total);

        let total = yearsOfServiceAmount.total +
            noticeAmount.total +
            vacationAmount.total +
            pendingRemuneration.total;

        // Restar el aporte AFC si corresponde (Descuento al empleador)
        if (afc.applied) {
            total -= afc.total;
        }

        const indemnities = {
            yearsOfService: yearsOfServiceAmount,
            notice: noticeAmount,
            vacation: vacationAmount
        };

        return {
            serviceTime,
            economics: {
                baseSalary: this.baseSalary,
                gratification: this.gratification,
                assignments: this.assignments,
                variableAverage: this.variableAverage,
                fullSalary: this.fullSalary,
                cappedSalary,
                isCapped,
                salaryCap,
                ufValue: this.ufValue
            },
            indemnities,
            // Keep redundant for safety
            yearsOfServiceIndemnity: yearsOfServiceAmount,
            noticeIndemnity: noticeAmount,
            vacationIndemnity: vacationAmount,
            pendingRemuneration,
            afc,
            total
        };
    }

    emptyResult(error) {
        const zero = { total: 0, applied: false };
        const serviceTime = { years: 0, months: 0, days: 0, indemnityYears: 0, cappedIndemnityYears: 0 };
        const vacation = {
            total: 0, proportionalTotal: 0, pendingTotal: 0, proportionalDays: '0.00', pendingDays: 0,
            totalBusinessDays: '0.00', nonBusinessDays: 0, totalCalendarDays: '0.00', salaryPerDay: '0.00', details: ''
        };
        const pending = { daysWorked: 0, propBase: 0, propGrat: 0, propAssign: 0, propVariable: 0, total: 0 };
        return {
            error,
            serviceTime,
            economics: {
                baseSalary: this.baseSalary, gratification: this.gratification, assignments: this.assignments,
                variableAverage: this.variableAverage, fullSalary: this.fullSalary, cappedSalary: 0,
                isCapped: false, salaryCap: 0, ufValue: this.ufValue
            },
            indemnities: { yearsOfService: zero, notice: zero, vacation },
            yearsOfServiceIndemnity: zero,
            noticeIndemnity: zero,
            vacationIndemnity: vacation,
            pendingRemuneration: pending,
            afc: zero,
            total: 0
        };
    }

    /**
     * Calcula descuento AFC (Simulación)
     * @param {Object} serviceTime - Información de tiempo servido
     * @param {Number} iasTotal - Indemnización por años de servicio: el aporte solo se imputa a ella
     *                            y nunca la supera (art. 13 inc. 2 Ley 19.728)
     * @returns {Object} Monto y detalles
     */
    calculateAFCDeduction(serviceTime, iasTotal) {
        if (!this.simulateAFC || this.cause !== '161' || !(iasTotal > 0)) {
            return { total: 0, applied: false };
        }
        const cap = (n) => Math.max(0, Math.min(Math.round(n), Math.round(iasTotal)));

        // Monto según el certificado de la AFC (si se eligió certificado y no se ingresó, no se descuenta)
        if (this.afcExactAmount !== null) {
            const exact = isNaN(this.afcExactAmount) ? 0 : this.afcExactAmount;
            return {
                total: cap(exact),
                applied: cap(exact) > 0,
                percentage: "Certificado",
                reason: "Aporte del empleador a la cuenta individual según certificado de la AFC (art. 13 Ley 19.728)"
            };
        }

        // Estimación: 1,6% de la remuneración imponible actual (sin colación ni movilización, tope 135,2 UF)
        // por cada mes cotizado, con máximo 11 años por relación laboral. Los contratos anteriores al
        // 2-oct-2002 solo cotizan si se afiliaron voluntariamente: ahí se usa solo el certificado.
        if (this.startDate < new Date(Date.UTC(2002, 9, 2))) {
            return { total: 0, applied: false, reason: "Contrato anterior al seguro de cesantía: ingresa el monto del certificado de la AFC" };
        }
        const topeCesantiaUF = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_IMPONIBLE_CESANTIA : 135.2;
        const salaryCapCesantia = this.ufValue * topeCesantiaUF;
        const cappedCesantiaSalary = Math.min(this.imponibleSalary, salaryCapCesantia);

        const afcRate = (typeof CONSTANTS !== 'undefined' && CONSTANTS.AFC_INDEFINIDO_EMPLOYER_CIC) 
            ? CONSTANTS.AFC_INDEFINIDO_EMPLOYER_CIC 
            : 0.016; // 1.6% aporte empleador a CIC para contratos indefinidos
        const estimatedContributionPerMonth = cappedCesantiaSalary * afcRate;
        const from = this.startDate;
        const totalMonths = Math.min(132, Math.max(0,
            (this.endDate.getUTCFullYear() - from.getUTCFullYear()) * 12 +
            (this.endDate.getUTCMonth() - from.getUTCMonth()) +
            (this.endDate.getUTCDate() >= from.getUTCDate() ? 0 : -1)));
        const total = cap(estimatedContributionPerMonth * totalMonths);

        return {
            total,
            applied: total > 0,
            percentage: `${(afcRate * 100).toFixed(1)}%`,
            reason: "Aporte empleador a CIC 1,6% (Estimado según Art. 13 Ley 19.728)"
        };
    }

    /**
     * Calcula la remuneración pendiente (días trabajados del último mes)
     * @returns {Object} Desglose de remuneración pendiente
     */
    calculatePendingRemuneration() {
        // Días trabajados en el mes de término, con mes comercial de 30 días:
        // desde el 1 (o desde el ingreso, si fue ese mes) hasta el término. Si trabajó hasta
        // el último día del mes, son 30 (también en febrero o en meses de 31).
        const y = this.endDate.getUTCFullYear(), m = this.endDate.getUTCMonth();
        const monthStart = Date.UTC(y, m, 1);
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const startedThisMonth = this.startDate.getTime() > monthStart;
        const fromDay = startedThisMonth ? this.startDate.getUTCDate() : 1;
        let daysWorked = this.endDate.getUTCDate() - fromDay + 1;
        if (this.endDate.getUTCDate() === lastDay) daysWorked = startedThisMonth ? 30 - fromDay + 1 : 30;
        daysWorked = Math.max(0, Math.min(daysWorked, 30));

        const propBase = Math.round((this.baseSalary / 30) * daysWorked);
        const propGrat = Math.round((this.gratification / 30) * daysWorked);
        const propAssign = Math.round((this.assignments / 30) * daysWorked);
        const propVariable = Math.round((this.variableAverage / 30) * daysWorked);

        return {
            daysWorked,
            propBase,
            propGrat,
            propAssign,
            propVariable,
            total: propBase + propGrat + propAssign + propVariable
        };
    }

    /**
     * Calcula el tiempo de servicio y años computables para indemnización
     * @returns {Object} Años, meses, días de servicio
     */
    calculateServiceTime() {
        // El día de término se cuenta como trabajado: del 01-03-2023 al 28-02-2026 son 3 años justos
        const end = new Date(this.endDate.getTime() + 86400000);
        let years = end.getUTCFullYear() - this.startDate.getUTCFullYear();
        let months = end.getUTCMonth() - this.startDate.getUTCMonth();
        let days = end.getUTCDate() - this.startDate.getUTCDate();

        // Ajuste de días negativos
        if (days < 0) {
            months--;
            days += 30; // Aproximación estándar 30 días/mes
        }

        // Ajuste de meses negativos
        if (months < 0) {
            years--;
            months += 12;
        }

        // Años para indemnización (art. 163): exige al menos 1 año; la fracción superior
        // a 6 meses cuenta como un año más (6 meses exactos no)
        let indemnityYears = years;
        if (months > 6 || (months === 6 && days > 0)) {
            indemnityYears += 1;
        }
        if (years < 1) {
            indemnityYears = 0;
        }

        // Tope 11 años (Art. 163 - contratos post 1981)
        // Fecha límite exacta: 14 de agosto de 1981
        const TOPE_DATE = new Date("1981-08-14");

        let cappedIndemnityYears;

        if (this.startDate < TOPE_DATE) {
            // Contratos anteriores al 14 de agosto de 1981 NO tienen tope
            cappedIndemnityYears = indemnityYears;
        } else {
            // Aplica tope de 11 años
            cappedIndemnityYears = Math.min(indemnityYears, 11);
        }

        return {
            years,
            months,
            days,
            indemnityYears,
            cappedIndemnityYears
        };
    }

    /**
     * Calcula indemnización por años de servicio (solo Art. 161)
     * @param {Object} serviceTime - Tiempo de servicio calculado
     * @param {Number} cappedSalary - Sueldo topado a 90 UF
     * @returns {Object} Monto y detalles de indemnización
     */
    calculateYearsOfServiceIndemnity(serviceTime, cappedSalary) {
        // Solo aplica para despido sin causa justificada (Art. 161)
        // O si el usuario lo desactivó manualmente en modo avanzado
        if (this.cause !== '161' || !this.enableIAS) {
            return {
                total: 0,
                applied: false,
                reason: !this.enableIAS ? "Desactivado por usuario" : "Causal no aplica (Solo Art. 161)",
                yearsUsed: 0,
                salaryUsed: 0
            };
        }

        // Fórmula: 1 mes de sueldo por cada año trabajado (tope definido en calculateServiceTime)
        const total = Math.round(serviceTime.cappedIndemnityYears * cappedSalary);

        return {
            total,
            applied: total > 0,
            yearsUsed: serviceTime.cappedIndemnityYears,
            salaryUsed: cappedSalary,
            reason: `${serviceTime.cappedIndemnityYears} años × $${cappedSalary.toLocaleString()}`
        };
    }

    /**
     * Calcula indemnización sustitutiva del aviso previo
     * @param {Number} cappedSalary - Sueldo topado a 90 UF
     * @returns {Object} Monto y detalles
     */
    calculateNoticeIndemnity(cappedSalary) {
        // Solo aplica para Art. 161 sin aviso previo y si está habilitado
        if (this.cause !== '161' || !this.enableNotice) {
            return {
                total: 0,
                applied: false,
                reason: !this.enableNotice ? "Desactivado por usuario" : "Causal no aplica (Solo Art. 161)"
            };
        }

        if (this.noticeGiven) {
            return {
                total: 0,
                applied: false,
                reason: "Aviso previo fue dado"
            };
        }

        // Si no se dio aviso: 1 mes de indemnización (topado 90 UF)
        return {
            total: Math.round(cappedSalary),
            applied: true,
            reason: "Falta de aviso previo (30 días)"
        };
    }

    /**
     * Calcula indemnización por feriado (vacaciones)
     * Método forense: proyecta días calendario incluyendo fines de semana y feriados
     * @returns {Object} Monto y detalles del feriado
     */
    calculateVacationIndemnity() {
        // A. Calcular días hábiles proporcionales acumulados este año

        // Tiempo desde el último aniversario, contando el día de término como trabajado
        const end = new Date(this.endDate.getTime() + 86400000);
        const lastAnniversary = new Date(this.startDate);
        lastAnniversary.setUTCFullYear(end.getUTCFullYear());

        // Si el aniversario aún no llegó este año, retroceder 1 año
        if (lastAnniversary > end) {
            lastAnniversary.setUTCFullYear(end.getUTCFullYear() - 1);
        }

        // Calcular meses trabajados desde último aniversario
        let propMonths = end.getUTCMonth() - lastAnniversary.getUTCMonth();
        let propDays = end.getUTCDate() - lastAnniversary.getUTCDate();

        // Ajustar días negativos
        if (propDays < 0) {
            propMonths--;
            propDays += 30; // Aproximación estándar mes 30 días
        }

        // Ajustar meses negativos
        if (propMonths < 0) {
            propMonths += 12;
        }

        // Convertir a meses totales (con fracción de días)
        const totalPropMonths = propMonths + (propDays / 30);

        // Calcular días hábiles acumulados (1,25 días/mes normal, 20/12 en zonas extremas)
        const businessDaysAccrued = totalPropMonths * this.vacationFactor;

        // Sumar días hábiles pendientes de años anteriores
        const totalBusinessDays = businessDaysAccrued + this.vacationDaysPending;

        // B. Proyección Forense (Calendario Real)
        // Convertir días hábiles a días corridos (calendario)
        // incluyendo fines de semana y feriados

        let currentDate = new Date(this.endDate);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Empezar desde día siguiente

        let businessDaysCounter = 0;
        let nonBusinessDaysCounter = 0;
        let safetyCounter = 0; // Evitar loops infinitos

        // Iterar hasta completar todos los días hábiles
        while (businessDaysCounter < totalBusinessDays && safetyCounter < 1000) {
            const isWeekend = currentDate.getUTCDay() === 0 || currentDate.getUTCDay() === 6;
            const dateString = currentDate.toISOString().split('T')[0];
            const isHoliday = this.holidays.includes(dateString);

            if (!isWeekend && !isHoliday) {
                // Es día hábil
                businessDaysCounter++;
            } else {
                // Es fin de semana o feriado
                nonBusinessDaysCounter++;
            }

            // Avanzar al siguiente día
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            safetyCounter++;
        }

        // Total días corridos = hábiles + inhábiles
        const totalCalendarDays = totalBusinessDays + nonBusinessDaysCounter;

        // C. Valorización del Feriado

        // Base de cálculo: remuneración íntegra (sin gratificación mensual; asignaciones solo si se pide)
        let vacationBaseSalary = this.baseSalary + this.variableAverage;

        if (this.includeAssignmentsInVacation) {
            vacationBaseSalary += this.assignments;
        }

        // Valor día = Sueldo mensual / 30
        const dailySalary = vacationBaseSalary / 30;

        // Total = Días corridos × Valor día
        const total = totalCalendarDays * dailySalary;

        // D. Desglose entre proporcional y pendiente

        // Ratio de días proporcionales vs totales
        const ratioProp = totalBusinessDays > 0 ?
            businessDaysAccrued / totalBusinessDays : 0;

        return {
            total: Math.round(total),
            proportionalTotal: Math.round(total * ratioProp),
            pendingTotal: Math.round(total * (1 - ratioProp)),
            proportionalDays: businessDaysAccrued.toFixed(2),
            pendingDays: this.vacationDaysPending,
            totalBusinessDays: totalBusinessDays.toFixed(2),
            nonBusinessDays: nonBusinessDaysCounter,
            totalCalendarDays: totalCalendarDays.toFixed(2),
            salaryPerDay: dailySalary.toFixed(2),
            details: `Hábiles: ${totalBusinessDays.toFixed(2)} + Inhábiles: ${nonBusinessDaysCounter} = ${totalCalendarDays.toFixed(2)} días corridos`
        };
    }
}

// ============================================
// EXPORT
// ============================================

// Export for Node.js (backend testing)
if (typeof module !== 'undefined' && module.exports) {
    // Note: This requires CONSTANTS to be available in global or passed in
    module.exports = { FiniquitoCalculator };
}
// Export for Browser (frontend usage)
else if (typeof window !== 'undefined') {
    window.FiniquitoCalculator = FiniquitoCalculator;
}
