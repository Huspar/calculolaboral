/*
 * CalculoLaboral · parámetros del generador de liquidaciones (v3.2.0)
 *
 * Dos tipos de valores:
 * 1) UF al cierre del mes y UTM del mes: se piden a la API (js/liquidacion_valores.js). Aquí solo hay un RESPALDO
 *    con los meses ya confirmados (SII, a través de los indicadores previsionales de Previred), que sirve de
 *    control cruzado y de plan B si las dos APIs fallan.
 * 2) Valores que cambian pocas veces al año y que la API no entrega: ingreso mínimo, topes imponibles en UF,
 *    jornada máxima legal, comisiones AFP y cotizaciones de cargo del empleador (Ley 21.735 y SIS). Van en VIGENCIAS,
 *    ordenadas por el primer mes en que rigen. El generador usa la última vigencia con "desde" menor o igual al mes.
 *
 * Fuentes de las vigencias y del respaldo de enero a septiembre de 2026: indicadores previsionales mensuales de
 * Previred (previred.com/indicadores-previsionales), verificados el 12-oct-2026. Los nueve meses coinciden con la UF y la
 * UTM de la API y con los topes en pesos que publica Previred.
 *
 * Cuándo actualizar este archivo (2 o 3 veces al año, no todos los meses):
 * - Reajuste del ingreso mínimo, resolución de la Superintendencia de Pensiones con nuevos topes (cada febrero),
 *   cambio de comisión de una AFP o nueva etapa de la jornada (40 horas desde el 26-abr-2028): agregar una vigencia
 *   nueva con su fecha "desde" y su fuente.
 * - Cambio de la tasa del SIS (la Superintendencia la fija por períodos) o nueva etapa de la Ley 21.735 (4,25% desde las
 *   remuneraciones de agosto de 2027): agregar una vigencia con el nuevo objeto "empleador". Si un mes usa una tasa aún
 *   no publicada, su vigencia lleva empleador.porConfirmar y el asistente lo avisa.
 *
 * Meses después de ULTIMO_MES (solo el Asistente Pyme, que lo pide con valores.crear({ extender: true })): hasta
 * MESES_EXTENSION meses más se calculan con la última vigencia, marcada como estimada (vigenciaEstimada) y con aviso
 * visible. Así un cliente con pase no se queda sin liquidaciones mientras se cargan los valores del año siguiente.
 * La UF y la UTM de esos meses siguen viniendo de la API. El generador de liquidaciones del sitio no los ofrece.
 */
(function (root) {
    'use strict';

    // Cotización del trabajador: 10% más la comisión de cada AFP. Sin cambios de enero a septiembre de 2026.
    var AFP_2026 = {
        Capital: 0.1144,
        Cuprum: 0.1144,
        Habitat: 0.1127,
        Modelo: 0.1058,
        Planvital: 0.1116,
        Provida: 0.1145,
        Uno: 0.1046
    };

    // Cotizaciones de cargo del empleador sobre la remuneración imponible con tope de la AFP, según los indicadores de
    // Previred de cada mes (verificados el 13-oct-2026). Hasta julio de 2026: 0,1% a la AFP, 0,9% de seguro social
    // (expectativa de vida) y el SIS aparte. Desde agosto de 2026 (Ley 21.735): 3,5% en total, con el SIS incluido.
    var EMP_ENE = { afp: 0.001, seguroSocial: 0.009, seguroSocialDetalle: 'expectativa de vida', sis: 0.0154 };
    var EMP_ABR = { afp: 0.001, seguroSocial: 0.009, seguroSocialDetalle: 'expectativa de vida', sis: 0.0162 };
    var EMP_JUL = { afp: 0.001, seguroSocial: 0.009, seguroSocialDetalle: 'expectativa de vida', sis: 0.02 };
    var EMP_AGO = { afp: 0.001, seguroSocial: 0.0162, seguroSocialDetalle: 'rentabilidad protegida 0,9% y expectativa de vida 0,72%', sis: 0.0178 };
    // El Oficio 15.295 fija el SIS de 1,78% para las remuneraciones de agosto a octubre de 2026; para noviembre en adelante aún no se publica.
    var EMP_NOV = { afp: 0.001, seguroSocial: 0.0162, seguroSocialDetalle: 'rentabilidad protegida 0,9% y expectativa de vida 0,72%', sis: 0.0178, porConfirmar: true };

    var NOTA_44H = 'La jornada máxima legal en este mes era de 44 horas semanales (bajó a 42 el 26 de abril de 2026). Revisa la jornada del trabajador: cambia el valor de la hora extra.';

    var VIGENCIAS = [
        {
            desde: '2026-01',
            verificado: '2026-10-12',
            imm: 539000,
            topeAfpUF: 89.9,      // Previred, indicadores de enero de 2026
            topeAfcUF: 135.1,
            jornadaMaxima: 44,
            afp: AFP_2026,
            empleador: EMP_ENE,
            nota: NOTA_44H
        },
        {
            desde: '2026-02',
            verificado: '2026-10-12',
            imm: 539000,
            topeAfpUF: 90,        // Res. Ex. SP 237/2026 (desde el 1-feb-2026)
            topeAfcUF: 135.2,     // Res. Ex. SP 236/2026 (desde el 1-feb-2026)
            jornadaMaxima: 44,
            afp: AFP_2026,
            empleador: EMP_ENE,
            nota: NOTA_44H
        },
        {
            desde: '2026-04',
            verificado: '2026-10-12',
            imm: 539000,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 44,
            afp: AFP_2026,
            empleador: EMP_ABR,
            nota: 'El 26 de abril de 2026 la jornada máxima legal bajó de 44 a 42 horas semanales. La liquidación usa la jornada que indiques para todo el mes: revísala, porque cambia el valor de la hora extra.'
        },
        {
            desde: '2026-05',
            verificado: '2026-10-12',
            imm: 553553,          // Reajuste publicado el 22-jun-2026, con efecto desde las remuneraciones de mayo
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 42,
            afp: AFP_2026,
            empleador: EMP_ABR
        },
        {
            desde: '2026-07',
            verificado: '2026-10-13',
            imm: 553553,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 42,
            afp: AFP_2026,
            empleador: EMP_JUL    // SIS 2,00% para las remuneraciones de julio (Previred, julio de 2026)
        },
        {
            desde: '2026-08',
            verificado: '2026-10-13',
            imm: 553553,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 42,
            afp: AFP_2026,
            empleador: EMP_AGO    // Ley 21.735 y Oficio SP 15.295 (Previred, agosto y septiembre de 2026)
        },
        {
            desde: '2026-11',
            verificado: '2026-10-13',
            imm: 553553,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 42,
            afp: AFP_2026,
            empleador: EMP_NOV
        }
    ];

    // Notas por mes (solo cuando hay algo que el usuario deba saber de ese mes en particular)
    var NOTAS_MES = {
        '2026-05': 'El ingreso mínimo de $553.553 rige desde las remuneraciones de mayo de 2026 (se publicó el 22 de junio, con efecto retroactivo). Si ya pagaste mayo con $539.000, la diferencia se ajusta aparte.'
    };

    // Primer y último mes que ofrece el generador. El último se amplía al confirmar las vigencias siguientes.
    var PRIMER_MES = '2026-01';
    var ULTIMO_MES = '2026-12';
    var MESES_EXTENSION = 12;

    function sumarMeses(periodo, n) {
        var a = periodo.split('-').map(Number), t = a[0] * 12 + (a[1] - 1) + n, m = t % 12 + 1;
        return Math.floor(t / 12) + '-' + (m < 10 ? '0' : '') + m;
    }
    var ULTIMO_MES_EXTENDIDO = sumarMeses(ULTIMO_MES, MESES_EXTENSION);

    // Respaldo (UF del último día del mes y UTM del mes), confirmado con Previred y con la API el 12-oct-2026.
    var RESPALDO = {
        '2026-01': { uf: 39706.07, utm: 69751 },
        '2026-02': { uf: 39790.63, utm: 69611 },
        '2026-03': { uf: 39841.72, utm: 69889 },
        '2026-04': { uf: 40120.20, utm: 69889 },
        '2026-05': { uf: 40610.69, utm: 70588 },
        '2026-06': { uf: 40820.31, utm: 71506 },
        '2026-07': { uf: 40844.79, utm: 71649 },
        '2026-08': { uf: 40873.77, utm: 71649 },
        '2026-09': { uf: 41057.20, utm: 71721 },
        '2026-10': { uf: 41247.63, utm: 72151 }
    };

    var FUENTES = [
        'UF y UTM: Servicio de Impuestos Internos, consultados a través de mindicador.cl y findic.cl y contrastados con los indicadores de Previred',
        'Ingreso mínimo, topes imponibles y comisiones AFP: indicadores previsionales de Previred y resoluciones de la Superintendencia de Pensiones (Res. Ex. 236 y 237 de 2026)',
        'Jornada máxima legal: Ley 21.561 (44 horas hasta el 25-abr-2026; 42 horas desde el 26-abr-2026)',
        'Cotizaciones del empleador: indicadores previsionales de Previred de cada mes, Ley 21.735 y Oficio Ordinario SP 15.295 de 2026'
    ];

    function vigenciaDe(periodo) {
        var v = null;
        VIGENCIAS.forEach(function (x) { if (x.desde <= periodo) v = x; });
        return v;
    }

    function esEstimado(periodo) { return periodo > ULTIMO_MES && periodo <= ULTIMO_MES_EXTENDIDO; }

    // Vigencia de un mes posterior a ULTIMO_MES: la última conocida, marcada como estimada y con las tasas del empleador por confirmar
    function vigenciaEstimada(periodo) {
        if (!esEstimado(periodo)) return null;
        var base = VIGENCIAS[VIGENCIAS.length - 1], v = {};
        Object.keys(base).forEach(function (k) { v[k] = base[k]; });
        v.estimada = true;
        v.base = ULTIMO_MES;
        v.empleador = Object.assign({}, base.empleador, { porConfirmar: true });
        v.nota = periodo >= '2027-08' ? 'Desde las remuneraciones de agosto de 2027 el aporte del empleador de la Ley 21.735 sube de 3,5% a 4,25%. Mientras no carguemos los valores de ese mes, el costo para la empresa se calcula con la tasa anterior.' : '';
        return v;
    }

    // Lista de meses desde PRIMER_MES hasta "hasta" (por defecto ULTIMO_MES; nunca después de ULTIMO_MES_EXTENDIDO)
    function periodos(hasta) {
        var fin = hasta && hasta > ULTIMO_MES ? (hasta < ULTIMO_MES_EXTENDIDO ? hasta : ULTIMO_MES_EXTENDIDO) : ULTIMO_MES;
        var lista = [], a = PRIMER_MES.split('-').map(Number), z = fin.split('-').map(Number);
        var y = a[0], m = a[1];
        while (y < z[0] || (y === z[0] && m <= z[1])) {
            lista.push(y + '-' + (m < 10 ? '0' : '') + m);
            m++;
            if (m > 12) { m = 1; y++; }
        }
        return lista;
    }

    var api = {
        VIGENCIAS: VIGENCIAS, NOTAS_MES: NOTAS_MES, RESPALDO: RESPALDO, FUENTES: FUENTES, PRIMER_MES: PRIMER_MES, ULTIMO_MES: ULTIMO_MES,
        ULTIMO_MES_EXTENDIDO: ULTIMO_MES_EXTENDIDO, vigenciaDe: vigenciaDe, vigenciaEstimada: vigenciaEstimada, esEstimado: esEstimado,
        sumarMeses: sumarMeses, periodos: periodos
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionParametros = api;
})(typeof window !== 'undefined' ? window : this);
