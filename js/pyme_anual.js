/*
 * CalculoLaboral · resumen anual de remuneraciones por trabajador (v1.0.0)
 * Funciona en el navegador (window.CLPymeAnual) y en Node (require).
 *
 *   filaDesdeCalculo(periodo, calculo) → fila del mes desde el resumen guardado (si trae baseTributable), o null
 *   filaDesdeResultado(periodo, res)   → fila del mes desde el resultado del motor de liquidaciones
 *   resumen(anio, filas)               → { filas (con actualizados si hay factores), totales, actualizado: bool }
 *   csv({ empresa, anio }, trabajadores: [{ t, resumen }]) → planilla para el contador (punto y coma)
 *
 * Columnas del Certificado N°6 del SII (instrucciones del SII, «Certificado N°6 y DJ 1887»):
 *   (2) renta bruta = total imponible del mes; (3) cotizaciones de cargo del trabajador (AFP, salud, seguro de cesantía y APV
 *   régimen B) = (2) − (4); (4) renta afecta al impuesto único = base tributable; (5) impuesto único retenido; (6) mayor
 *   retención (no se usa: 0); (7) renta exenta (0); (8) renta no gravada = haberes no imponibles (colación, movilización,
 *   asignación familiar, viáticos); (9) rebaja zonas extremas DL 889 (0); (10) factor de actualización del SII;
 *   (11) a (16) = (4) a (9) por el factor. Los totales actualizados deben coincidir con la DDJJ 1887 (nota 1 del SII).
 * FACTORES: los publica el SII para cada año comercial (en diciembre o enero). Mientras no se carguen, el resumen muestra
 * los montos sin actualizar y lo dice: no es todavía el Certificado N°6.
 */
(function (root) {
    'use strict';

    // Año comercial → 12 factores (enero a diciembre), según la publicación del SII. Se agregan al publicarse.
    var FACTORES = {};
    var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    function fila(periodo, bruta, afecta, impuesto, noGravada) {
        return { periodo: periodo, mes: MESES[+periodo.slice(5, 7) - 1], rentaBruta: bruta, cotizaciones: bruta - afecta, rentaAfecta: afecta, impuesto: impuesto, noGravada: noGravada };
    }
    function filaDesdeCalculo(periodo, c) {
        if (!c || !c.conDesglose || typeof c.baseTributable !== 'number') return null;
        return fila(periodo, c.totalImponible, c.baseTributable, c.impuesto || 0, Math.max(0, (c.totalHaberes || 0) - (c.totalImponible || 0)));
    }
    function filaDesdeResultado(periodo, res) {
        return fila(periodo, res.totalImponible, Math.round(res.bases.baseTributable), res.montos.impuesto, res.totalNoImponible);
    }

    var CLAVES = ['rentaBruta', 'cotizaciones', 'rentaAfecta', 'impuesto', 'noGravada'];
    function resumen(anio, filas) {
        var f = FACTORES[anio] || null;
        var lista = (filas || []).slice().sort(function (a, b) { return a.periodo < b.periodo ? -1 : 1; }).map(function (x) {
            var y = Object.assign({}, x);
            if (f) {
                y.factor = f[+x.periodo.slice(5, 7) - 1];
                y.afectaAct = Math.round(x.rentaAfecta * y.factor);
                y.impuestoAct = Math.round(x.impuesto * y.factor);
                y.noGravadaAct = Math.round(x.noGravada * y.factor);
            }
            return y;
        });
        var tot = {};
        CLAVES.concat(f ? ['afectaAct', 'impuestoAct', 'noGravadaAct'] : []).forEach(function (k) { tot[k] = lista.reduce(function (s, x) { return s + (x[k] || 0); }, 0); });
        return { anio: anio, filas: lista, totales: tot, actualizado: !!f };
    }

    function celda(v) { v = String(v == null ? '' : v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    function csv(meta, lista) {
        var act = lista.some(function (x) { return x.resumen.actualizado; });
        var enc = ['RUT', 'Nombre', 'Meses con remuneración', 'Renta bruta', 'Cotizaciones del trabajador', 'Renta afecta al impuesto único', 'Impuesto único retenido', 'Renta no gravada']
            .concat(act ? ['Renta afecta actualizada', 'Impuesto retenido actualizado', 'Renta no gravada actualizada'] : []);
        var lineas = [celda('Resumen anual de remuneraciones ' + meta.anio + (act ? '' : ' (montos sin actualizar)')), [celda(meta.empresa.razonSocial || ''), celda('RUT ' + (meta.empresa.rut || ''))].join(';'), '', enc.map(celda).join(';')];
        lista.forEach(function (x) {
            var r = x.resumen, t = r.totales;
            lineas.push([x.t.rut, x.t.nombre, r.filas.map(function (f) { return +f.periodo.slice(5, 7); }).join(' '), t.rentaBruta, t.cotizaciones, t.rentaAfecta, t.impuesto, t.noGravada]
                .concat(act ? [t.afectaAct, t.impuestoAct, t.noGravadaAct] : []).map(celda).join(';'));
        });
        lineas.push('');
        lineas.push(celda(act ? 'Montos actualizados con los factores publicados por el SII para ' + meta.anio + '.' : 'Montos sin actualizar: el SII publica los factores de actualización de ' + meta.anio + ' al cerrar el año. Con ellos se emite el Certificado N°6 y se declara la DDJJ 1887.'));
        lineas.push(celda('Hecho con el Asistente Laboral Pyme a partir de las liquidaciones guardadas. Revísalo con tu contador antes de declarar; el asistente no genera el archivo de la DDJJ 1887.'));
        return lineas.join('\r\n') + '\r\n';
    }

    var api = { FACTORES: FACTORES, MESES: MESES, filaDesdeCalculo: filaDesdeCalculo, filaDesdeResultado: filaDesdeResultado, resumen: resumen, csv: csv, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeAnual = api;
})(typeof window !== 'undefined' ? window : this);
