/*
 * Genera una muestra del archivo de Previred y su hoja de revisión campo por campo.
 *   node tools/previred/muestra.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('../../js/previred_generador.js');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'especificacion-105.json'), 'utf8'));

const salida = G.generar({
    periodo: '2026-10',
    empleador: { mutual: 'Mutual de Seguridad' },
    trabajadores: [
        {
            rut: '12.345.678-5', apellidoPaterno: 'Rojas', apellidoMaterno: 'Pérez', nombres: 'Camila',
            sexo: 'F', nacionalidad: '0', afp: 'Cuprum', salud: 'Fonasa', dias: 30,
            rentaAfp: 1419115, cotizacionAfp: 162347, sis: 25260, cotizacionSalud: 99338,
            rentaMutual: 1419115, cotizacionMutual: 13198,
            rentaAfc: 1419115, aporteTrabajadorAfc: 8515, aporteEmpleadorAfc: 34059
        },
        {
            rut: '9.876.543-3', apellidoPaterno: 'Álvarez', apellidoMaterno: 'Soto', nombres: 'Rodrigo',
            sexo: 'M', nacionalidad: '0', afp: 'Habitat', salud: 'Colmena', dias: 30,
            rentaAfp: 2100000, cotizacionAfp: 243600, sis: 37380, rentaIsapre: 2100000,
            cotizacionIsapre: 147000, cotizacionPactada: 147000, isapreMoneda: 'PESOS', fun: 'FUN123',
            rentaMutual: 2100000, cotizacionMutual: 52500,
            rentaAfc: 2100000, aporteTrabajadorAfc: 12600, aporteEmpleadorAfc: 50400
        }
    ]
});

if (salida.errores.length) {
    console.error(salida.errores);
    process.exit(1);
}

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'muestra-2026-10.txt'), salida.texto, 'utf8');

// Hoja de revisión: qué va en cada uno de los 105 campos, para el primer trabajador
const fila = salida.filas[0].split(';');
const lineas = ['campo;nombre;valor;tipo'];
for (let i = 1; i <= 105; i++) {
    const meta = spec.campos[String(i)] || { nombre: '?', tipo: '?' };
    lineas.push([i, '"' + (meta.nombre || '').replace(/"/g, "'") + '"', '"' + (fila[i - 1] || '') + '"', meta.tipo || ''].join(';'));
}
fs.writeFileSync(path.join(dir, 'muestra-2026-10-campos.csv'), '\uFEFF' + lineas.join('\r\n'), 'utf8');

console.log('líneas', salida.filas.length, '| problemas del validador', G.validar(salida.texto).length);
console.log('archivo', path.join(dir, 'muestra-2026-10.txt'));
console.log('hoja de revisión', path.join(dir, 'muestra-2026-10-campos.csv'));
