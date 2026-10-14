/*
 * CalculoLaboral · documento de la liquidación de sueldo (v1.0.0)
 * Convierte el resultado de CLLiquidacionEngine.calcular() en el HTML de la liquidación. Lo usan el generador de
 * liquidaciones y el Asistente Pyme, para que las dos páginas entreguen exactamente el mismo documento.
 *
 *   documento(empresa, trabajador, mes, resultado, { periodo, pagada, ejemplo, fuentes }) → texto HTML
 *     pagada: false agrega la marca de agua "Vista previa"; ejemplo: true agrega el aviso de ejemplo.
 *
 * Todo texto que viene del usuario se escapa. Las clases (.lqd-*) se definen en el CSS de cada página.
 */
(function (root) {
    'use strict';

    var VAL = (typeof module !== 'undefined' && module.exports) ? require('./liquidacion_valores') : root.CLLiquidacionValores;
    var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function pesos(x) { return '$' + Math.round(x || 0).toLocaleString('es-CL'); }
    function nombreMes(p) { var a = p.split('-'); return MESES_ES[+a[1] - 1] + ' ' + a[0]; }
    function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function fecha(iso) { if (!iso) return ''; var a = iso.split('-'); return a.length === 3 ? a[2] + '-' + a[1] + '-' + a[0] : iso; }
    function limpiarRut(v) { return String(v || '').toUpperCase().replace(/[^0-9K]/g, ''); }
    function formatoRut(v) {
        var c = limpiarRut(v);
        if (c.length < 2) return c;
        return c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
    }

    // Monto en palabras para la línea "Son:"
    var UNI = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    var DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    var CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    function cientos(n) {
        if (n === 100) return 'cien';
        var c = Math.floor(n / 100), r = n % 100, t = [];
        if (c) t.push(CEN[c]);
        if (r) t.push(r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' y ' + UNI[r % 10] : ''));
        return t.join(' ');
    }
    function enPalabras(n) {
        n = Math.round(Math.abs(n));
        if (!n) return 'cero pesos';
        var mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000, t = [];
        if (mill) t.push(mill === 1 ? 'un millón' : cientos(mill) + ' millones');
        if (miles) t.push(miles === 1 ? 'mil' : cientos(miles) + ' mil');
        if (resto) t.push(cientos(resto));
        return t.join(' ') + (mill && !miles && !resto ? ' de pesos' : ' pesos');
    }

    function tablaLineas(lineas) {
        return lineas.map(function (l) {
            return '<tr><th scope="row">' + esc(l.concepto) + (l.detalle ? '<small>' + esc(l.detalle) + '</small>' : '') + '</th><td>' + pesos(l.monto) + '</td></tr>';
        }).join('');
    }
    function contrato(c) { return c === 'plazo_fijo' ? 'Plazo fijo' : c === 'obra' ? 'Por obra o faena' : 'Indefinido'; }

    function documento(em, t, m, res, opciones) {
        var b = res.bases;
        var fu = opciones.fuentes || {};
        var datos = [
            ['Trabajador', esc(t.nombre)], ['RUT', esc(formatoRut(t.rut))],
            ['Cargo', esc(t.cargo || '—')], ['Fecha de ingreso', esc(fecha(t.fechaIngreso) || '—')],
            ['Contrato', contrato(t.contrato)], ['Jornada', b.jornada + ' h semanales'],
            ['AFP', esc(t.afp)], ['Salud', t.salud === 'isapre' ? esc(t.isapreNombre || 'Isapre') : 'Fonasa'],
            ['Días trabajados', String(b.dias)]
        ];
        if (m.diasLicencia) datos.push(['Días de licencia', String(Math.round(m.diasLicencia))]);
        return '' +
            (opciones.ejemplo ? '<p class="lqd-ejemplo">Ejemplo · completa el formulario para ver tu liquidación</p>' : '') +
            '<header class="lqd-head">' +
                '<div class="lqd-emp">' + (em.logo ? '<img src="' + em.logo + '" alt="">' : '') +
                    '<div><strong>' + esc(em.razonSocial) + '</strong><span>RUT ' + esc(formatoRut(em.rut)) + '</span>' + (em.direccion ? '<span>' + esc(em.direccion) + '</span>' : '') + '</div></div>' +
                '<div class="lqd-title"><h2>Liquidación de sueldo</h2><p>' + capital(nombreMes(opciones.periodo)) + '</p></div>' +
            '</header>' +
            '<dl class="lqd-datos">' + datos.map(function (d) { return '<div><dt>' + d[0] + '</dt><dd>' + d[1] + '</dd></div>'; }).join('') + '</dl>' +
            '<div class="lqd-cols">' +
                '<section><h3>Haberes</h3><table><tbody>' +
                    '<tr class="lqd-grupo"><th colspan="2">Imponibles</th></tr>' + tablaLineas(res.haberesImponibles) +
                    '<tr class="lqd-sub"><th scope="row">Total imponible</th><td>' + pesos(res.totalImponible) + '</td></tr>' +
                    (res.haberesNoImponibles.length ? '<tr class="lqd-grupo"><th colspan="2">No imponibles</th></tr>' + tablaLineas(res.haberesNoImponibles) +
                    '<tr class="lqd-sub"><th scope="row">Total no imponible</th><td>' + pesos(res.totalNoImponible) + '</td></tr>' : '') +
                    '</tbody><tfoot><tr><th scope="row">Total haberes</th><td>' + pesos(res.totalHaberes) + '</td></tr></tfoot></table></section>' +
                '<section><h3>Descuentos</h3><table><tbody>' +
                    '<tr class="lqd-grupo"><th colspan="2">Legales</th></tr>' + tablaLineas(res.descuentosLegales) +
                    '<tr class="lqd-sub"><th scope="row">Total descuentos legales</th><td>' + pesos(res.totalLegales) + '</td></tr>' +
                    (res.otrosDescuentos.length ? '<tr class="lqd-grupo"><th colspan="2">Otros descuentos</th></tr>' + tablaLineas(res.otrosDescuentos) +
                    '<tr class="lqd-sub"><th scope="row">Total otros descuentos</th><td>' + pesos(res.totalOtros) + '</td></tr>' : '') +
                    '</tbody><tfoot><tr><th scope="row">Total descuentos</th><td>' + pesos(res.totalDescuentos) + '</td></tr></tfoot></table></section>' +
            '</div>' +
            '<div class="lqd-total"><div><span>Alcance líquido a pagar</span><small>Son: ' + capital(enPalabras(res.liquido)) + '</small></div><strong>' + pesos(res.liquido) + '</strong></div>' +
            '<dl class="lqd-bases">' +
                '<div><dt>Tope imponible AFP y salud</dt><dd>' + pesos(b.topeAfp) + '</dd></div>' +
                '<div><dt>Base tributable</dt><dd>' + pesos(b.baseTributable) + '</dd></div>' +
                '<div><dt>UF al ' + VAL.fechaLarga(opciones.periodo) + '</dt><dd>' + b.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 }) + (fu.uf ? '<small>' + esc(fu.uf) + '</small>' : '') + '</dd></div>' +
                '<div><dt>UTM del mes</dt><dd>' + pesos(b.utm) + (fu.utm ? '<small>' + esc(fu.utm) + '</small>' : '') + '</dd></div>' +
            '</dl>' +
            '<p class="lqd-recibi">Recibí conforme el alcance líquido de la presente liquidación y copia de ella.</p>' +
            '<div class="lqd-firmas"><div><span></span>Firma del trabajador</div><div><span></span>Firma y timbre del empleador</div></div>' +
            (opciones.pagada ? '' : '<div class="lqd-marca" aria-hidden="true"><span>Vista previa</span></div>');
    }

    var api = { documento: documento, enPalabras: enPalabras, formatoRut: formatoRut, nombreMes: nombreMes, capital: capital, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionDocumento = api;
})(typeof window !== 'undefined' ? window : this);
