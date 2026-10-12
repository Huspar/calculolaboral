/*
 * CalculoLaboral · parámetros del generador de liquidaciones (v2.0.0)
 *
 * Dos tipos de valores:
 * 1) UF al cierre del mes y UTM del mes: se piden a la API (js/liquidacion_valores.js). Aquí solo hay un RESPALDO
 *    con los meses ya confirmados en el SII, que sirve de control cruzado y de plan B si las dos APIs fallan.
 * 2) Valores que cambian pocas veces al año y que la API no entrega: ingreso mínimo, topes imponibles en UF y
 *    comisiones AFP. Van en VIGENCIAS, ordenadas por el primer mes en que rigen. El generador usa la última
 *    vigencia con "desde" menor o igual al mes de la liquidación.
 *
 * Cuándo actualizar este archivo (2 o 3 veces al año, no todos los meses):
 * - Reajuste del ingreso mínimo, resolución de la Superintendencia de Pensiones con nuevos topes (cada febrero)
 *   o cambio de comisión de una AFP: agregar una vigencia nueva con su fecha "desde" y su fuente.
 * - Si se quiere habilitar más meses hacia atrás, confirmar antes las vigencias de esos meses.
 */
(function (root) {
    'use strict';

    var VIGENCIAS = [
        {
            desde: '2026-05',
            verificado: '2026-10-12',
            imm: 553553,          // Ley de reajuste del ingreso mínimo, vigente desde mayo de 2026
            topeAfpUF: 90,        // Res. Ex. SP 237/2026 (desde el 1-feb-2026)
            topeAfcUF: 135.2,     // Res. Ex. SP 236/2026 (desde el 1-feb-2026)
            afp: {                // 10% + comisión de cada AFP (Superintendencia de Pensiones)
                Capital: 0.1144,
                Cuprum: 0.1144,
                Habitat: 0.1127,
                Modelo: 0.1058,
                Planvital: 0.1116,
                Provida: 0.1145,
                Uno: 0.1046
            }
        }
    ];

    // Primer y último mes que ofrece el generador. El último se amplía al confirmar las vigencias siguientes.
    var PRIMER_MES = '2026-09';
    var ULTIMO_MES = '2026-12';

    // Respaldo confirmado en el SII (UF del último día del mes y UTM del mes). No es la fuente principal.
    var RESPALDO = {
        '2026-09': { uf: 41057.20, utm: 71721 },
        '2026-10': { uf: 41247.63, utm: 72151 }
    };

    var FUENTES = [
        'UF y UTM: Servicio de Impuestos Internos, consultados a través de mindicador.cl y findic.cl',
        'Topes imponibles: Superintendencia de Pensiones (Res. Ex. 236 y 237 de 2026)',
        'Ingreso mínimo: ley de reajuste vigente desde mayo de 2026',
        'Comisiones AFP: Superintendencia de Pensiones'
    ];

    function vigenciaDe(periodo) {
        var v = null;
        VIGENCIAS.forEach(function (x) { if (x.desde <= periodo) v = x; });
        return v;
    }

    function periodos() {
        var lista = [], a = PRIMER_MES.split('-').map(Number), z = ULTIMO_MES.split('-').map(Number);
        var y = a[0], m = a[1];
        while (y < z[0] || (y === z[0] && m <= z[1])) {
            lista.push(y + '-' + (m < 10 ? '0' : '') + m);
            m++;
            if (m > 12) { m = 1; y++; }
        }
        return lista;
    }

    var api = { VIGENCIAS: VIGENCIAS, RESPALDO: RESPALDO, FUENTES: FUENTES, PRIMER_MES: PRIMER_MES, ULTIMO_MES: ULTIMO_MES, vigenciaDe: vigenciaDe, periodos: periodos };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionParametros = api;
})(typeof window !== 'undefined' ? window : this);
