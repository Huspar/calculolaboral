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
        this.ccafAmount = parseInt(data.ccafAmount) || 0;
        this.apvAmount = parseInt(data.apvAmount) || 0;
        this.prestamos = parseInt(data.prestamos) || 0;
        this.pension = parseInt(data.pension) || 0;
        this.sindicato = parseInt(data.sindicato) || 0;
        this.otrosDescuentos = parseInt(data.otrosDescuentos) || 0;

        // P1 Feature Flag: Should CCAF/APV reduce the base for AFP/Salud?
        // Default false = AFP/Salud on totalTaxable (standard, less complaints)
        // true = AFP/Salud on taxableForTax (reduced by CCAF/APV, strict mode)
        this.reduceSocialSecurityBase = !!data.reduceSocialSecurityBaseByCCAFAPV;
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
            const overtimeAmount = Math.round(this.baseSalary * C.FACTOR_HORA_EXTRA_42H * this.overtimeHours);
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

            // PASO 2: Restar descuentos IMPONIBLES (CCAF, APV)
            // Reducen la base tributable.
            const taxableForTax = totalTaxable - this.ccafAmount - this.apvAmount;

            // Caps Logic (Standard: Caps apply to RAW Taxable, unrelated to CCAF/APV usually, but we follow strict logic)
            const capValueHealthAFP = Math.round(C.TOPE_IMPONIBLE_AFP * C.UF);
            const capValueAFC = Math.round(C.TOPE_IMPONIBLE_CESANTIA * C.UF);

            // CCAF/APV Feature Flag: decide base for social security contributions
            // Option A (default, flag OFF): AFP/Salud on totalTaxable (topeado) — standard
            // Option B (flag ON): AFP/Salud on taxableForTax (reduced by CCAF/APV) — strict/alternative
            const ssBase = this.reduceSocialSecurityBase ? taxableForTax : totalTaxable;
            const taxableForSocialSecurity = Math.min(ssBase, capValueHealthAFP);
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
                // AFC worker part is calculated on taxableForAFC (usually max 122.6 or 135.1 UF)
                // If taxableForTax is reduced by CCAF, should AFC be reduced? Usually no. AFC is on contractual taxable.
                // I will use totalTaxable for AFC cap check, to be safer/standard.
                afcAmount = Math.round(Math.min(totalTaxable, capValueAFC) * C.AFC_INDEFINIDO_WORKER);
            }

            // PASO 5: Impuesto Único
            // Base = Imponible Ajustado - (AFP + Salud + AFC)
            // Imponible Ajustado ya tiene descontado CCAF y APV.
            const taxBase = Math.max(0, taxableForTax - afpAmount - healthAmount - afcAmount);

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
            // Net = Total Taxable - CCAF - APV - AFP - Health - AFC - Tax + NonTaxable - NonTaxableDiscounts
            let netSalary = totalTaxable
                - this.ccafAmount
                - this.apvAmount
                - afpAmount
                - healthAmount
                - afcAmount
                - taxAmount;

            const totalNonTaxableIncome = this.colacion + this.movilizacion + this.viaticos;
            netSalary += totalNonTaxableIncome;

            // PASO 7: Restar descuentos NO IMPONIBLES
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

// Export
if (typeof window !== 'undefined') {
    window.ForensicSalaryCalculator = ForensicSalaryCalculator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ForensicSalaryCalculator };
}
