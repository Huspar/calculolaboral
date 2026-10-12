/*
 * CalculoLaboral · valores oficiales por mes para el generador de liquidaciones
 *
 * Un mes solo aparece en el generador cuando todos sus valores están confirmados con la fuente.
 * - uf: UF del último día del mes de la remuneración (SII). Se usa para los topes imponibles y el plan de Isapre.
 * - utm: UTM del mes (SII). Fija los tramos del impuesto único.
 * - imm: ingreso mínimo mensual vigente en el mes.
 * - topeAfpUF / topeAfcUF: topes imponibles (Superintendencia de Pensiones, Res. Ex. 237 y 236 de 2026).
 * - afp: cotización obligatoria del trabajador (10% + comisión de cada AFP).
 * Para agregar un mes: copiar el anterior, actualizar con las fuentes y anotar la fecha de revisión.
 */
(function (root) {
    'use strict';

    var AFP_2026 = {
        Capital: 0.1144,
        Cuprum: 0.1144,
        Habitat: 0.1127,
        Modelo: 0.1058,
        Planvital: 0.1116,
        Provida: 0.1145,
        Uno: 0.1046
    };

    var MESES = {
        '2026-09': {
            uf: 41057.20,   // UF al 30-09-2026
            utm: 71721,
            imm: 553553,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            afp: AFP_2026,
            revisado: '2026-10-12'
        },
        '2026-10': {
            uf: 41247.63,   // UF al 31-10-2026
            utm: 72151,
            imm: 553553,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            afp: AFP_2026,
            revisado: '2026-10-12'
        }
    };

    var FUENTES = [
        'UF y UTM: Servicio de Impuestos Internos (sii.cl, valores y fechas)',
        'Topes imponibles: Superintendencia de Pensiones (Res. Ex. 236 y 237 de 2026)',
        'Ingreso mínimo: Ley de reajuste vigente desde mayo de 2026',
        'Comisiones AFP: Superintendencia de Pensiones'
    ];

    var api = { MESES: MESES, FUENTES: FUENTES };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionParametros = api;
})(typeof window !== 'undefined' ? window : this);
