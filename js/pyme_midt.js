/*
 * CalculoLaboral · hoja guía para registrar el contrato en Mi DT (v1.0.0)
 * Funciona en el navegador (window.CLPymeMiDT) y en Node (require).
 *
 *   hoja(empresa, trabajador) → { plazos: [texto], antes: [texto], etapas: [{ titulo, filas: [{ campo, valor, nota }] }] }
 *
 * Ordenada como el formulario «Registro de Contrato de Trabajo» del Registro Electrónico Laboral de la DT (guía rápida
 * versión 10-ene-2024): 1) identificación de las partes, 2) funciones y lugar de prestación de los servicios,
 * 3) remuneraciones, 4) jornada de trabajo y otras estipulaciones. No registra nada: el empleador lo hace con su ClaveÚnica.
 * Plazos (art. 9 bis del Código del Trabajo, Ley 21.327): el contrato dentro de 15 días desde su celebración (la DT indica
 * «15 días hábiles»; la hoja usa días corridos para ir seguro); los términos dentro de los plazos de los arts. 162 y 163 bis
 * y, en los casos del art. 159 N°1, 2 y 3, dentro de 10 días hábiles desde la separación; la imputación del seguro de
 * cesantía dentro de 5 días desde la firma del finiquito.
 */
(function (root) {
    'use strict';

    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    function fecha(iso) { if (!iso) return ''; var a = iso.split('-'); return +a[2] + ' de ' + MESES[+a[1] - 1] + ' de ' + a[0]; }
    function pesos(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL'); }
    function sumarDias(iso, n) {
        var a = iso.split('-').map(Number), d = new Date(Date.UTC(a[0], a[1] - 1, a[2]) + n * 86400000);
        return d.getUTCFullYear() + '-' + (d.getUTCMonth() < 9 ? '0' : '') + (d.getUTCMonth() + 1) + '-' + (d.getUTCDate() < 10 ? '0' : '') + d.getUTCDate();
    }
    var CONTRATOS = { indefinido: 'Indefinido', plazo_fijo: 'Plazo fijo', obra: 'Por obra o faena' };
    var GRATIF = { legal: 'Legal del art. 50 (25% de lo devengado, con tope de 4,75 ingresos mínimos al año)', pactada: 'Pactada en el contrato (copia la cláusula)', ninguna: 'Sin gratificación pactada (revisa si la empresa está obligada, art. 47)' };

    function hoja(e, t) {
        e = e || {}; t = t || {};
        var fila = function (campo, valor, nota) { return { campo: campo, valor: valor || '', nota: nota || '' }; };
        var falta = 'Falta en la ficha';
        var plazos = [];
        if (t.fechaIngreso) {
            plazos.push('Contrato: si se firmó el día de ingreso (' + fecha(t.fechaIngreso) + '), regístralo a más tardar el ' + fecha(sumarDias(t.fechaIngreso, 15)) +
                '. La ley da 15 días desde la firma (art. 9 bis) y la DT indica 15 días hábiles: contamos días corridos para que no se te pase.');
        } else plazos.push('Contrato: dentro de los 15 días siguientes a su firma (art. 9 bis).');
        plazos.push('Cambios del contrato: registra cada anexo firmado en «Registro de anexo de contrato».');
        plazos.push('Término: en los plazos de los arts. 162 y 163 bis; si es por mutuo acuerdo, renuncia o muerte (art. 159 N°1, 2 y 3), dentro de 10 días hábiles desde la separación. La imputación del seguro de cesantía, dentro de 5 días desde la firma del finiquito.');

        var antes = [
            'El contrato firmado por ambas partes.',
            'Tu ClaveÚnica. Si la empresa es persona jurídica, entra quien esté habilitado como representante laboral electrónico en Mi DT.',
            'El correo electrónico personal y el RUT de ' + (t.nombre ? t.nombre.split(' ')[0] : 'la persona') + '.',
            'Entra a mi.dt.gob.cl → perfil Empleador → Registro electrónico laboral → Registro de contrato de trabajo.'
        ];

        var diasTxt = String(t.distribucion) === '6' ? 'Lunes a sábado' : 'Lunes a viernes';
        var imponibles = [fila('Sueldo base (imponible)', t.sueldoBase ? pesos(t.sueldoBase) : falta)];
        var noImp = [];
        (t.bonosFijos || []).forEach(function (b) {
            if (b.tipo === 'imponible') imponibles.push(fila(b.nombre + ' (imponible)', pesos(b.monto)));
            else noImp.push(fila(b.nombre + ' (no imponible)', pesos(b.monto)));
        });
        if (t.colacion) noImp.unshift(fila('Asignación de colación (no imponible)', pesos(t.colacion)));
        if (t.movilizacion) noImp.unshift(fila('Asignación de movilización (no imponible)', pesos(t.movilizacion)));

        var etapas = [
            { titulo: '1. Identificación de las partes', filas: [
                fila('Lugar de celebración', e.comuna || e.ciudad || '', e.comuna || e.ciudad ? '' : 'La comuna donde se firmó el contrato.'),
                fila('Fecha de suscripción', t.fechaIngreso ? fecha(t.fechaIngreso) : '', 'La fecha en que se firmó el contrato' + (t.fechaIngreso ? ', si fue el día de ingreso.' : '.')),
                fila('Empleador', (e.razonSocial || falta) + (e.rut ? ', RUT ' + e.rut : ''), 'Mi DT los trae del SII: revisa que coincidan.'),
                fila('Representante del empleador', e.representante ? e.representante + (e.rutRepresentante ? ', RUT ' + e.rutRepresentante : '') : falta),
                fila('Trabajador', (t.nombre || falta) + (t.rut ? ', RUT ' + t.rut : ''), 'Nombre, nacionalidad, fecha de nacimiento y sexo los trae el Registro Civil.'),
                fila('Domicilio del trabajador', [t.domicilio, t.comuna].filter(Boolean).join(', ') || falta),
                fila('¿Cambió de domicilio por esta contratación?', '', 'Si fue así, indica la región y comuna de donde venía.'),
                fila('Inclusión laboral (Ley 21.015)', '', 'Marca si tiene discapacidad o pensión de invalidez acreditada ante la empresa, con la fecha en que la acreditó.')
            ] },
            { titulo: '2. Funciones y lugar de prestación de los servicios', filas: [
                fila('Cargo', t.cargo || falta),
                fila('Funciones', '', 'Copia las funciones del contrato (hasta 300 caracteres).'),
                fila('Lugar de prestación de los servicios', [e.direccion, e.comuna].filter(Boolean).join(', ') || falta, 'Si trabaja en otro lugar o para una empresa principal (subcontratación), indícalo.')
            ] },
            { titulo: '3. Remuneraciones', filas: imponibles.concat(noImp).concat([
                fila('Gratificación', GRATIF[t.gratificacion || 'legal']),
                fila('Período de pago', 'Mensual'),
                fila('Forma de pago', '', 'La del contrato: transferencia, depósito, cheque, vale vista o efectivo.'),
                fila('Anticipo de remuneración', t.anticipoMensual ? 'Sí, mensual (' + pesos(t.anticipoMensual) + ')' : 'No'),
                fila('Remuneraciones y asignaciones', '', 'Copia la cláusula de remuneraciones del contrato, con la gratificación.')
            ]) },
            { titulo: '4. Jornada de trabajo y otras estipulaciones', filas: [
                fila('Sistema de distribución de jornada', 'Ordinaria', 'Si tienes un sistema excepcional autorizado por la DT, indica su resolución y fecha.'),
                fila('Duración de la jornada', t.jornadaHoras ? t.jornadaHoras + ' horas semanales' : falta),
                fila('Número de días', String(t.distribucion) === '6' ? '6' : '5'),
                fila('Días de distribución', diasTxt),
                fila('Distribución de jornada', '', 'Copia la cláusula de jornada del contrato, con el horario y el tiempo de colación.'),
                fila('Exceptuado del descanso en domingos y festivos (art. 38)', 'No', 'Solo si el contrato lo dice y la actividad está en el art. 38.'),
                fila('Otras estipulaciones', '', 'Copia las cláusulas que no hayas puesto en los pasos anteriores.'),
                fila('Tipo de contrato', CONTRATOS[t.contrato || 'indefinido']),
                fila('Inicio de la relación laboral', t.fechaIngreso ? fecha(t.fechaIngreso) : falta),
                t.contrato === 'plazo_fijo' ? fila('Término del contrato', t.fechaTerminoPlazo ? fecha(t.fechaTerminoPlazo) : falta) : null,
                fila('Declaración jurada', '', 'Al final activas la declaración de veracidad (art. 210 del Código Penal): revisa todo antes.')
            ].filter(Boolean) }
        ];
        return { plazos: plazos, antes: antes, etapas: etapas };
    }

    var api = { hoja: hoja, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeMiDT = api;
})(typeof window !== 'undefined' ? window : this);
