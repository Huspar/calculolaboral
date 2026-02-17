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
        this.simulateAFC = data.simulateAFC !== undefined ? data.simulateAFC : true;
        this.holidays = Array.isArray(data.holidays) ? data.holidays : (typeof CONSTANTS !== 'undefined' ? CONSTANTS.HOLIDAYS_2026 : []);

        // Toggle: incluir asignaciones en cálculo de indemnización (IAS / Aviso)
        this.includeAssignmentsInIndemnity = data.includeAssignmentsInIndemnity !== undefined ?
            data.includeAssignmentsInIndemnity : true;

        // Toggle: incluir asignaciones en cálculo de vacaciones
        this.includeAssignmentsInVacation = data.includeAssignmentsInVacation !== undefined ?
            data.includeAssignmentsInVacation : true;

        // Totales calculados
        // Base de cálculo IAS (Indemnización por Años de Servicio - Topada 90 UF)
        // Por defecto NO incluye asignaciones (colación/movilización) para IAS/Aviso
        this.taxableSalary = this.baseSalary + this.gratification + this.variableAverage +
            (this.includeAssignmentsInIndemnity ? this.assignments : 0);

        // Base de cálculo Feriado (Remuneración Íntegra)
        // Por defecto SÍ las incluye según criterio común/judicial
        this.fullSalary = this.baseSalary + this.gratification + this.variableAverage +
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
    }

    /**
     * Función principal que ejecuta todos los cálculos
     * @returns {Object} Resultado completo del finiquito
     */
    calculate() {
        // 1. Calcular tiempo de servicio
        const serviceTime = this.calculateServiceTime();

        // 2. Calcular sueldo base con tope 90 UF
        const topeIndemnizacion = typeof CONSTANTS !== 'undefined' ? CONSTANTS.TOPE_INDEMNIZACION : 90;
        const salaryCap = this.ufValue * topeIndemnizacion;
        const cappedSalary = Math.min(this.taxableSalary, salaryCap);
        const isCapped = this.taxableSalary > salaryCap;

        // 3. Calcular indemnizaciones
        const yearsOfServiceAmount = this.calculateYearsOfServiceIndemnity(serviceTime, cappedSalary);
        const noticeAmount = this.calculateNoticeIndemnity(cappedSalary);
        const vacationAmount = this.calculateVacationIndemnity();

        // 4. Calcular remuneración pendiente (días trabajados del último mes)
        const pendingRemuneration = this.calculatePendingRemuneration();

        // 5. Calcular total
        const afc = this.calculateAFCDeduction(serviceTime, cappedSalary);

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
            afc: this.calculateAFCDeduction(serviceTime, cappedSalary),
            total
        };
    }

    /**
     * Calcula descuento AFC (Simulación)
     * @param {Object} serviceTime - Información de tiempo servido
     * @param {Number} cappedSalary - Sueldo base topado
     * @returns {Object} Monto y detalles
     */
    calculateAFCDeduction(serviceTime, cappedSalary) {
        if (!this.simulateAFC || this.cause !== '161') {
            return { total: 0, applied: false };
        }

        // Estimación: 0.6% de remuneración mensual por el tiempo trabajado
        // En la vida real depende del saldo exacto en la cuenta CIC
        const afcRate = typeof CONSTANTS !== 'undefined' ? CONSTANTS.AFC_INDEFINIDO_WORKER : 0.006;
        const estimatedContributionPerMonth = cappedSalary * afcRate;
        const totalMonths = (serviceTime.years * 12) + serviceTime.months;
        const total = Math.round(estimatedContributionPerMonth * totalMonths);

        return {
            total,
            applied: true,
            percentage: `${(afcRate * 100).toFixed(1)}%`,
            reason: "Aporte empleador a cuenta individual (Estimado)"
        };
    }

    /**
     * Calcula la remuneración pendiente (días trabajados del último mes)
     * @returns {Object} Desglose de remuneración pendiente
     */
    calculatePendingRemuneration() {
        // Días trabajados en el mes de término
        // Ej: Si termina el 9 de febrero = 9 días trabajados
        // Se usa divisor comercial de 30 días para cálculo proporcional
        const daysWorked = Math.min(this.endDate.getUTCDate(), 30);

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
        let years = this.endDate.getUTCFullYear() - this.startDate.getUTCFullYear();
        let months = this.endDate.getUTCMonth() - this.startDate.getUTCMonth();
        let days = this.endDate.getUTCDate() - this.startDate.getUTCDate();

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

        // Cálculo de años para indemnización (fracción ≥ 6 meses redondea arriba)
        let indemnityYears = years;
        if (months >= 6) {
            indemnityYears += 1;
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
        const total = serviceTime.cappedIndemnityYears * cappedSalary;

        return {
            total,
            applied: true,
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
            total: cappedSalary,
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

        // Encontrar último aniversario antes del término
        const lastAnniversary = new Date(this.startDate);
        lastAnniversary.setUTCFullYear(this.endDate.getUTCFullYear());

        // Si el aniversario aún no llegó este año, retroceder 1 año
        if (lastAnniversary > this.endDate) {
            lastAnniversary.setUTCFullYear(this.endDate.getUTCFullYear() - 1);
        }

        // Calcular meses trabajados desde último aniversario
        let propMonths = this.endDate.getUTCMonth() - lastAnniversary.getUTCMonth();
        let propDays = this.endDate.getUTCDate() - lastAnniversary.getUTCDate();

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

        // Calcular días hábiles acumulados (1.25 días/mes normal, 1.67 zonas extremas)
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

        // Base de cálculo: Remuneración íntegra (puede incluir o no asignaciones)
        let vacationBaseSalary = this.baseSalary + this.gratification + this.variableAverage;

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
