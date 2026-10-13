/**
 * Release: v1.0.0
 * Fecha: Febrero 2026
 * Estado: Producción estable
 */

/**
 * Forensic Salary Calculator Engine (2026 Edition)
 * Refactored to use centralized constants.
 */

// Fallback Constants Removed to enforce Single Source of Truth via constants.js

class ForensicSalaryCalculator {
    constructor(data) {
        this.baseSalary = parseInt(data.baseSalary) || 0;
        this.gratificationType = data.gratificationType || 'legal_tope';
        this.gratificationAmount = parseInt(data.gratificationManual) || 0;
        this.overtimeHours = parseFloat(data.overtimeHours) || 0;
        this.bonusAmount = parseInt(data.bonusAmount) || 0;
        this.colacion = parseInt(data.colacion) || 0;
        this.movilizacion = parseInt(data.movilizacion) || 0;
        this.viaticos = parseInt(data.viaticos) || 0;
        this.afpName = data.afpName || 'Modelo';
        this.healthSystem = data.healthSystem || 'fonasa';
        this.isapreUF = parseFloat(data.isapreUF) || 0;
        this.contractType = data.contractType || 'indefinido';

        // Additional Discounts (Phase 2)
        // ccafAmount: cuota de crédito social CCAF. Es un descuento NO imponible: no rebaja
        // la base de AFP, salud ni impuesto; se resta del líquido después del impuesto.
        this.ccafAmount = parseInt(data.ccafAmount) || 0;
        this.apvAmount = parseInt(data.apvAmount) || 0;
        // apvRegime (opcional): 'B' (por defecto) rebaja la base del impuesto con tope de 50 UF
        // mensuales (art. 42 bis LIR); 'A' no rebaja la base (recibe la bonificación fiscal del 15%).
        this.apvRegime = String(data.apvRegime || 'B').toUpperCase() === 'A' ? 'A' : 'B';
        this.prestamos = parseInt(data.prestamos) || 0;
        this.pension = parseInt(data.pension) || 0;
        this.sindicato = parseInt(data.sindicato) || 0;
        this.otrosDescuentos = parseInt(data.otrosDescuentos) || 0;

        // jornada (opcional): horas ordinarias semanales pactadas, para el valor de la hora extra.
        // Por defecto 42 h (Ley 21.561, vigente desde el 26-abr-2026).
        const jornada = parseFloat(data.jornada);
        this.jornada = (jornada > 0 && jornada <= 45) ? jornada : 42;

        // El antiguo flag reduceSocialSecurityBaseByCCAFAPV se ignora: AFP y salud se calculan
        // siempre sobre el total imponible (con su tope), sin rebajar CCAF ni APV.
    }

    calculate() {
        try {
            // Robust Constants Logic: Window -> Global -> Default
            let C = null;

            // Potential source of constants
            if (typeof window !== 'undefined' && window.CONSTANTS) {
                C = window.CONSTANTS;
            } else if (typeof global !== 'undefined' && global.CONSTANTS) {
                C = global.CONSTANTS;
            } else if (typeof CONSTANTS !== 'undefined') {
                C = CONSTANTS;
            }

            if (!C) {
                throw new Error("CRITICAL: Global CONSTANTS not found. Ensure constants.js is loaded.");
            }

            // Paranoid Check: Only use candidate if it has valid numbers for critical indicators
            const isValid = (val) => typeof val === 'number' && !isNaN(val) && val > 0;

            if (!isValid(C.UF) || !isValid(C.UTM) || !isValid(C.IMM)) {
                throw new Error(`CRITICAL: Invalid Economic Indicators in CONSTANTS. UF=${C.UF}, UTM=${C.UTM}`);
            }

            // Final safety check for Brackets (API usually doesn't update these, but good to be safe)
            if (!C.TAX_BRACKETS || !Array.isArray(C.TAX_BRACKETS)) {
                throw new Error("CRITICAL: Missing TAX_BRACKETS in CONSTANTS.");
            }

            // PASO 1: Calcular Sueldo Imponible Base
            const baseSalary = this.baseSalary;
            // Hora extra: el sueldo base no puede ser inferior al ingreso mínimo proporcional a la
            // jornada (dictámenes DT Ord. 4725/331 de 1998 y 4262/210 de 2002). Factor DT exacto:
            // 1,5 × 28 / (30 × 4 × jornada) → 1,5/180 con 42 h (sin truncar a 0,0083333).
            const overtimeBase = Math.max(baseSalary, Math.round(C.IMM * this.jornada / 42));
            const overtimeFactor = 1.5 * 28 / (30 * 4 * this.jornada);
            const overtimeAmount = this.overtimeHours > 0 ? Math.round(overtimeBase * overtimeFactor * this.overtimeHours) : 0;
            const bonusAmount = this.bonusAmount;

            // Gratification
            let gratification = 0;
            if (this.gratificationType === 'manual') {
                gratification = this.gratificationAmount;
            } else if (this.gratificationType === 'legal_tope') {
                const monthlyCap = Math.round((C.TOPE_GRATIFICACION * C.IMM) / 12);
                const baseForGrat = baseSalary + overtimeAmount + bonusAmount;
                const theoretical25 = Math.round(baseForGrat * 0.25);
                gratification = Math.min(theoretical25, monthlyCap);
            }

            const totalTaxable = baseSalary + gratification + overtimeAmount + bonusAmount;

            // PASO 2: Rebaja de la base tributable. Solo el APV régimen B (tope 50 UF mensuales)
            // rebaja la base del impuesto. La cuota de crédito CCAF NO la rebaja.
            const apvTaxDeduction = this.apvRegime === 'B'
                ? Math.min(this.apvAmount, Math.round(50 * C.UF))
                : 0;
            const taxableForTax = totalTaxable - apvTaxDeduction;

            // Caps Logic (Standard: Caps apply to RAW Taxable, unrelated to CCAF/APV usually, but we follow strict logic)
            const capValueHealthAFP = Math.round(C.TOPE_IMPONIBLE_AFP * C.UF);
            const capValueAFC = Math.round(C.TOPE_IMPONIBLE_CESANTIA * C.UF);

            // AFP y salud se calculan sobre el total imponible con tope (CCAF y APV no lo rebajan)
            const taxableForSocialSecurity = Math.min(totalTaxable, capValueHealthAFP);
            const taxableForAFC = Math.min(totalTaxable, capValueAFC); // AFC siempre sobre totalTaxable

            // PASO 3: Descuento AFP
            const afpRate = C.AFP_RATES[this.afpName] || C.AFP_RATES['Modelo'];
            const afpAmount = Math.round(taxableForSocialSecurity * afpRate);

            // PASO 4: Descuento Salud
            let healthAmount = 0;
            const legal7 = Math.round(taxableForSocialSecurity * C.SALUD_LEGAL);
            if (this.healthSystem === 'fonasa') {
                healthAmount = legal7;
            } else {
                const planCost = Math.round(this.isapreUF * C.UF);
                healthAmount = Math.max(legal7, planCost);
            }

            // AFC
            let afcAmount = 0;
            if (this.contractType === 'indefinido') {
                // AFC worker part is calculated on taxableForAFC (tope vigente: ver CONSTANTS.TOPE_IMPONIBLE_CESANTIA)
                // If taxableForTax is reduced by CCAF, should AFC be reduced? Usually no. AFC is on contractual taxable.
                // I will use totalTaxable for AFC cap check, to be safer/standard.
                afcAmount = Math.round(Math.min(totalTaxable, capValueAFC) * C.AFC_INDEFINIDO_WORKER);
            }

            // PASO 5: Impuesto Único
            // Base = Imponible (menos APV régimen B) - (AFP + Salud + AFC)
            // La cotización de salud rebaja la base solo hasta el 7% de 90 UF (tope imponible):
            // el exceso de un plan Isapre no es deducible (fuente secundaria: Defontana,
            // "cálculo del impuesto único con Isapre"; art. 42 N°1 LIR).
            const healthTaxDeduction = Math.min(healthAmount, Math.round(C.SALUD_LEGAL * capValueHealthAFP));
            const taxBase = Math.max(0, taxableForTax - afpAmount - healthTaxDeduction - afcAmount);

            let taxAmount = 0;
            // Configuration-based Tax Calculation
            if (C.TAX_BRACKETS) {
                for (const bracket of C.TAX_BRACKETS) {
                    if (taxBase <= bracket.limit) {
                        taxAmount = (taxBase * bracket.factor) - bracket.rebate;
                        break;
                    }
                }
            }
            taxAmount = Math.max(0, Math.round(taxAmount));

            // PASO 6: Sueldo Líquido
            // Net = Total Taxable - APV - AFP - Health - AFC - Tax + NonTaxable - NonTaxableDiscounts (incl. CCAF)
            let netSalary = totalTaxable
                - this.apvAmount
                - afpAmount
                - healthAmount
                - afcAmount
                - taxAmount;

            const totalNonTaxableIncome = this.colacion + this.movilizacion + this.viaticos;
            netSalary += totalNonTaxableIncome;

            // PASO 7: Restar descuentos NO IMPONIBLES (crédito CCAF, préstamos, pensión, sindicato, otros)
            netSalary -= this.ccafAmount;
            netSalary -= this.prestamos;
            netSalary -= this.pension;
            netSalary -= this.sindicato;
            netSalary -= this.otrosDescuentos;

            return {
                economics: { UF: C.UF, UTM: C.UTM, IMM: C.IMM },
                details: {
                    baseSalary,
                    overtimeAmount,
                    gratification,
                    bonusAmount,
                    totalTaxable,

                    ccafAmount: this.ccafAmount,
                    apvAmount: this.apvAmount,
                    apvRegime: this.apvRegime,
                    apvTaxDeduction,
                    healthTaxDeduction,
                    overtimeBase,
                    jornada: this.jornada,

                    afpAmount,
                    healthAmount,
                    afcAmount,
                    taxBase,
                    taxAmount,

                    totalNonTaxableIncome,

                    prestamos: this.prestamos,
                    pension: this.pension,
                    sindicato: this.sindicato,
                    otrosDescuentos: this.otrosDescuentos,

                    netSalary: Math.round(netSalary)
                }
            };
        } catch (e) {
            console.error('Error en cálculo de sueldo:', e);
            if (typeof window !== 'undefined') {
                window.__lastCalculatorError = {
                    message: e.message,
                    stack: e.stack,
                    timestamp: new Date().toISOString()
                };
            }
            throw e;
        }
    }
}

/**
 * Cálculo inverso (líquido -> bruto): busca el sueldo base mínimo que entrega
 * al menos el líquido pedido, con los mismos haberes y descuentos de `data`.
 * El líquido crece con el sueldo base, así que basta una búsqueda binaria.
 */
ForensicSalaryCalculator.solveBaseForNet = function (data, targetNet) {
    const netFor = (base) => new ForensicSalaryCalculator(Object.assign({}, data, { baseSalary: base })).calculate().details.netSalary;
    targetNet = Math.max(0, Math.round(targetNet || 0));
    if (netFor(0) >= targetNet) return 0;
    let lo = 0, hi = Math.max(1000000, targetNet * 2);
    while (netFor(hi) < targetNet && hi < 1e10) hi *= 2;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (netFor(mid) >= targetNet) hi = mid; else lo = mid;
    }
    return hi;
};

// Export
if (typeof window !== 'undefined') {
    window.ForensicSalaryCalculator = ForensicSalaryCalculator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ForensicSalaryCalculator };
}
