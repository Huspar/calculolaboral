/**
 * Release: v1.0.0
 * Fecha: Febrero 2026
 * Estado: Producción estable
 */

/**
 * Centralized Economic Constants for Cálculo Laboral
 * Values updated for February 2026
 */

const CONSTANTS = {
    // Economic Indicators
    UF: 39682.99,
    UTM: 69611,
    IMM: 539000,

    // Legal Caps (Topes Imponibles)
    TOPE_IMPONIBLE_AFP: 89.9,      // UF
    TOPE_IMPONIBLE_CESANTIA: 135.1, // UF
    TOPE_INDEMNIZACION: 90,        // UF
    TOPE_GRATIFICACION: 4.75,      // IMM

    // Vacation Factors
    FACTOR_VACACIONES_NORMAL: 1.25, // Days per month (15 días / 12 meses)
    FACTOR_VACACIONES_EXTREMA: 1.67, // Days per month (20 días / 12 meses - Zonas Extremas)

    // Feriados 2026 Chile (días inhábiles)
    HOLIDAYS_2026: [
        "2026-01-01", // Año Nuevo
        "2026-04-03", // Viernes Santo
        "2026-04-04", // Sábado Santo
        "2026-05-01", // Día del Trabajo
        "2026-05-21", // Día de las Glorias Navales
        "2026-06-29", // San Pedro y San Pablo
        "2026-07-16", // Día de la Virgen del Carmen
        "2026-08-15", // Asunción de la Virgen
        "2026-09-18", // Día de la Independencia
        "2026-09-19", // Día de las Glorias del Ejército
        "2026-10-12", // Día del Encuentro de Dos Mundos
        "2026-10-31", // Día de las Iglesias Evangélicas
        "2026-11-01", // Día de Todos los Santos
        "2026-12-08", // Inmaculada Concepción
        "2026-12-25"  // Navidad
    ],

    // Rates
    SALUD_LEGAL: 0.07,
    AFC_INDEFINIDO_WORKER: 0.006,
    AFC_PLAZO_FIJO_WORKER: 0.0,
    FACTOR_HORA_EXTRA_42H: 0.0089286, // (1/168 * 1.5)

    // Income Tax Brackets (Impuesto Segunda Categoría) - Feb 2026
    TAX_BRACKETS: [
        { limit: 939748.50, factor: 0, rebate: 0 },
        { limit: 2088330.00, factor: 0.04, rebate: 37589.94 },
        { limit: 3480550.00, factor: 0.08, rebate: 121123.14 },
        { limit: 4872770.00, factor: 0.135, rebate: 312553.39 },
        { limit: 6264990.00, factor: 0.23, rebate: 775466.54 },
        { limit: 8353320.00, factor: 0.304, rebate: 1239075.80 },
        { limit: 21579410.00, factor: 0.35, rebate: 1623328.52 },
        { limit: Infinity, factor: 0.40, rebate: 2702299.02 }
    ],

    // AFP Rates (For reference/fallback)
    AFP_RATES: {
        'Capital': 0.1144,
        'Cuprum': 0.1144,
        'Habitat': 0.1127,
        'Modelo': 0.1058,
        'Planvital': 0.1116,
        'Provida': 0.1145,
        'Uno': 0.1069
    }
};

// Universal Export
if (typeof window !== 'undefined') {
    window.CONSTANTS = CONSTANTS;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
