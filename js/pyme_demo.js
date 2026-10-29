/*
 * CalculoLaboral · modo de ejemplo del Asistente Laboral Pyme (v1.0.0)
 * Funciona en el navegador (window.CLPymeDemo) y en Node (require, para las pruebas).
 *
 *   crear({ hoy: 'AAAA-MM-DD', periodo: 'AAAA-MM', servidor }) → Promise<{ api(ruta, o), exportar(), meses(Pa, P), CORREO }>
 *   (periodo: el mes de trabajo que abre el panel; por defecto el de hoy)
 *
 * Una empresa ficticia («Panadería Los Aromos SpA») con tres trabajadores, préstamo, vacaciones, una licencia médica y una boleta
 * de honorarios, con fechas relativas a hoy para que siempre haya avisos del mes. Vive en la memoria de la pestaña: no hay cuenta,
 * no se llama al servidor y todo se pierde al salir o al cerrar la pestaña.
 * Valida y guarda con la misma lógica del servidor (js/pyme_demo_servidor.js, generado desde api/_pyme/datos.js y validar.js).
 * Las liquidaciones de los dos meses las guarda el propio panel (meses()) para que se calculen igual que las del usuario.
 * El ejemplo no tiene Pase: los documentos salen con la marca «Vista previa» (no sirve para emitir documentos sin pagar).
 */
(function (root) {
    'use strict';

    var CORREO = 'ejemplo@calculolaboral.cl';
    var SIN_CIFRADO = {
        cifrar: function (v) { return { datos: JSON.stringify(v), version: 1 }; },
        descifrar: function (d) { return JSON.parse(d); }
    };
    var NO_DISPONIBLE = {
        'enlace-liquidacion': 'En el ejemplo no se crean enlaces para el trabajador. Con tu cuenta, el enlace se abre desde el celular.',
        'avisos-correo': 'En el ejemplo no se envían correos. Con tu cuenta puedes recibir los avisos del mes en tu correo.',
        comprar: 'En el ejemplo no se compra el Pase. Entra con tu correo para usar el asistente con tu empresa.',
        desbloqueo: 'En el ejemplo no se compra el Pase.',
        'borrar-cuenta': 'El ejemplo no tiene una cuenta que eliminar: usa «Salir del ejemplo».',
        entrar: 'Sal del ejemplo para entrar con tu correo.',
        comentario: 'En el ejemplo no se guardan opiniones. Entra con tu correo para contarnos qué piensas.'
    };

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function sumarDias(iso, n) {
        var a = iso.split('-').map(Number), d = new Date(Date.UTC(a[0], a[1] - 1, a[2]) + n * 86400000);
        return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
    }
    function sumarMeses(periodo, n) {
        var a = periodo.split('-').map(Number), m = a[0] * 12 + (a[1] - 1) + n;
        return Math.floor(m / 12) + '-' + dos(m % 12 + 1);
    }
    function finDeMes(periodo) {
        var a = periodo.split('-').map(Number);
        return periodo + '-' + dos(new Date(Date.UTC(a[0], a[1], 0)).getUTCDate());
    }

    // La empresa y las personas del ejemplo. Nombres y RUT inventados (RUT con dígito verificador válido).
    function semilla(hoy, P) {
        return {
            empresa: { razonSocial: 'Panadería Los Aromos SpA', mutual: 'ACHS', rut: '76.543.210-3', giro: 'Panadería y pastelería', representante: 'Manuel Lagos Rojas', rutRepresentante: '12.345.678-5', direccion: 'Av. Alemania 0450', comuna: 'Temuco', ciudad: 'Temuco', tasaMutual: '0,93' },
            trabajadores: [
                { nombre: 'Ana Pérez González', rut: '15.234.567-4', cargo: 'Panadera', sexo: 'F', banco: 'BancoEstado', tipoCuenta: 'vista', numeroCuenta: '12345678', fechaNacimiento: '1988-06-12', nacionalidad: 'Chilena', domicilio: 'Los Aromos 123', comuna: 'Temuco', fechaIngreso: '2022-03-15', contrato: 'indefinido', jornadaHoras: 42, distribucion: '6', sueldoBase: 650000, gratificacion: 'legal', colacion: 40000, movilizacion: 30000, afp: 'Modelo', salud: 'fonasa', karinEntrega: '2024-08-01' },
                // Plazo fijo que vence en 12 días, con comisiones (semana corrida), una licencia médica en curso y sin el protocolo de la Ley Karin anotado
                { nombre: 'Bruno Castillo Muñoz', rut: '19.876.543-0', cargo: 'Vendedor', sexo: 'M', banco: 'Banco de Chile', tipoCuenta: 'corriente', numeroCuenta: '000123456789', fechaNacimiento: '1999-11-03', nacionalidad: 'Chilena', domicilio: 'Pasaje Ñielol 45', comuna: 'Temuco', fechaIngreso: sumarMeses(P, -4) + '-01', contrato: 'plazo_fijo', fechaTerminoPlazo: sumarDias(hoy, 12), renovaciones: 1, jornadaHoras: 42, distribucion: '6', sueldoBase: 560000, gratificacion: 'legal', afp: 'Uno', salud: 'fonasa', ausencias: [{ tipo: 'licencia', desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 3) }] },
                { nombre: 'Carla Rojas Vidal', rut: '13.456.789-9', cargo: 'Encargada de local', sexo: 'F', fechaNacimiento: '1979-02-21', nacionalidad: 'Chilena', domicilio: 'Caupolicán 980', comuna: 'Temuco', fechaIngreso: '2014-08-01', contrato: 'indefinido', jornadaHoras: 42, distribucion: '5', sueldoBase: 900000, gratificacion: 'legal', colacion: 50000, movilizacion: 40000, afp: 'Habitat', salud: 'isapre', isapreNombre: 'Colmena', isaprePlanUF: 3.2, aniosOtrosEmpleadores: 6, anticipoMensual: 150000, karinEntrega: '2024-08-01' }
            ]
        };
    }

    // Liquidaciones del ejemplo: el mes anterior emitido completo y el mes de trabajo a medias (una emitida, una guardada, una por hacer)
    function planMeses(Pa, P, hoy) {
        var emitidaPa = P + '-05' <= hoy ? P + '-05' : hoy, emitidaP = hoy < finDeMes(P) ? hoy : finDeMes(P);
        return [
            { periodo: Pa, rut: '15.234.567-4', cambios: { emitida: emitidaPa } },
            { periodo: Pa, rut: '19.876.543-0', cambios: { comisiones: 62000, emitida: emitidaPa } },
            { periodo: Pa, rut: '13.456.789-9', cambios: { horasExtra: 4, emitida: emitidaPa } },
            { periodo: P, rut: '15.234.567-4', cambios: {} },
            { periodo: P, rut: '13.456.789-9', cambios: { horasExtra: 4, emitida: emitidaP } }
        ];
    }

    function crear(o) {
        var S = (o && o.servidor) || root.CLPymeDemoServidor;
        if (!S) return Promise.reject(new Error('Falta pyme_demo_servidor.js'));
        var hoy = o.hoy, ahora = function () { return Date.now(); }, iso = function () { return new Date(ahora()).toISOString(); };
        var almacen = S.almacen().crearAlmacenMemoria();
        var datos = S.datos().crear({ almacen: almacen, cifrado: SIN_CIFRADO, ahora: ahora });
        var P = o.periodo || hoy.slice(0, 7), s = null, sem = semilla(hoy, P);
        var fechaBoleta = hoy < finDeMes(P) ? (hoy.slice(0, 7) === P ? hoy : P + '-01') : finDeMes(P);

        function exigir(r, que) { if (!r.ok) throw new Error('Ejemplo: no se pudo guardar ' + que + ' (' + (r.error || r.codigo) + ')'); return r; }

        return almacen.upsertCuenta(CORREO, iso(), iso()).then(function (c) {
            s = { cuentaId: c.id, email: CORREO };
            // Cupo de 5 trabajadores como con el Pase; el panel igual lo trata como sin pase (documentos con marca «Vista previa»)
            return almacen.registrarPase({ cuentaId: s.cuentaId, producto: 'pyme12', ordenFlow: 'EJEMPLO', dias: 365, ahoraIso: iso() });
        }).then(function () {
            return datos.guardarEmpresa(s, sem.empresa).then(function (r) { exigir(r, 'la empresa'); });
        }).then(function () {
            return sem.trabajadores.reduce(function (p, t) {
                return p.then(function (ids) { return datos.crearTrabajador(s, t).then(function (r) { exigir(r, t.nombre); ids.push(r.trabajador.id); return ids; }); });
            }, Promise.resolve([]));
        }).then(function (ids) {
            var Pa = sumarMeses(P, -1);
            return Promise.all([
                datos.guardarPrestamos(s, ids[0], [{ concepto: 'Préstamo para reparar el techo', fecha: Pa + '-02', monto: 360000, cuotas: 6, desde: Pa }]).then(function (r) { exigir(r, 'el préstamo'); }),
                datos.guardarVacacion(s, ids[0], { tipo: 'ajuste', dias: 18, nota: 'Tomados antes de usar el asistente' }).then(function (r) { exigir(r, 'las vacaciones'); }),
                datos.guardarVacacion(s, ids[2], { tipo: 'ajuste', dias: 160, nota: 'Tomados antes de usar el asistente' }).then(function (r) { exigir(r, 'las vacaciones'); }),
                datos.guardarVacacion(s, ids[2], { tipo: 'periodo', desde: sumarDias(hoy, 21), hasta: sumarDias(hoy, 25), nota: 'Vacaciones de primavera' }).then(function (r) { exigir(r, 'las vacaciones'); }),
                datos.registrarDocumento(s, ids[0], 'contrato').then(function (r) { exigir(r, 'un documento'); }),
                datos.registrarDocumento(s, ids[2], 'cert_antiguedad').then(function (r) { exigir(r, 'un documento'); }),
                datos.guardarHonorarios(s, P, [{ fecha: fechaBoleta, nombre: 'Contadora Paula Soto', rut: '16.789.012-1', numero: 245, bruto: 180000, retiene: 'empresa' }]).then(function (r) { exigir(r, 'la boleta'); })
            ]);
        }).then(function () {
            return { api: api, exportar: exportar, meses: function (Pa, Pm) { return planMeses(Pa, Pm, hoy); }, CORREO: CORREO };
        });

        function responder(r) {
            if (r.ok) return { ok: true, estado: 200, datos: r };
            return { ok: false, estado: r.estado || 400, datos: { ok: false, codigo: r.codigo, error: r.error, errores: r.errores } };
        }
        function cortar(texto) { return { ok: false, estado: 400, datos: { ok: false, codigo: 'ejemplo', error: texto } }; }

        // Mismas rutas y respuestas que /api/pyme/* (api/_pyme/rutas.js), sin sesión ni límite de escrituras
        function api(ruta, o) {
            o = o || {};
            var m = o.metodo || 'GET', q = o.query || {}, b = o.cuerpo || {};
            var hecho = function (pr) { return pr.then(responder); };
            if (ruta === 'sesion') return Promise.resolve({ ok: true, estado: 200, datos: { autenticado: true, email: CORREO } });
            if (ruta === 'salir') return Promise.resolve({ ok: true, estado: 200, datos: { ok: true } });
            if (ruta === 'avisos-correo' && m === 'GET') return Promise.resolve({ ok: true, estado: 200, datos: { ok: true, activo: false } });
            if (ruta === 'enlaces-liquidacion') return Promise.resolve({ ok: true, estado: 200, datos: { ok: true, enlaces: [] } });
            if (NO_DISPONIBLE[ruta]) return Promise.resolve(cortar(NO_DISPONIBLE[ruta]));
            if (ruta === 'estado') return datos.estado(s).then(function (r) {
                if (r.ok) {
                    r.limites = { maxActivos: r.limites.maxActivos, paseVence: null, paseProducto: null };
                    r.pase = { venta: false, productos: [], cobertura: {} };
                    r.ejemplo = true;
                }
                return responder(r);
            });
            if (ruta === 'empresa') return hecho(datos.guardarEmpresa(s, b.empresa));
            if (ruta === 'trabajador') return hecho(m === 'POST' ? datos.crearTrabajador(s, b.trabajador) : m === 'PUT' ? datos.actualizarTrabajador(s, q.id, b.trabajador) : datos.borrarTrabajador(s, q.id));
            if (ruta === 'ausencias') return hecho(datos.guardarAusencias(s, q.trabajador, b.ausencias));
            if (ruta === 'prestamos') return hecho(datos.guardarPrestamos(s, q.trabajador, b.prestamos));
            if (ruta === 'meses') return hecho(datos.meses(s, q.periodo));
            if (ruta === 'mes') return hecho(m === 'PUT' ? datos.guardarMes(s, q.trabajador, q.periodo, b.mes) : datos.borrarMes(s, q.trabajador, q.periodo));
            if (ruta === 'honorarios') return hecho(m === 'GET' ? datos.honorarios(s, q.periodo) : datos.guardarHonorarios(s, q.periodo, b.boletas));
            if (ruta === 'documento') return hecho(datos.registrarDocumento(s, q.trabajador, b.tipo));
            if (ruta === 'documentos') return hecho(datos.documentos(s));
            if (ruta === 'vacaciones') return hecho(datos.vacaciones(s));
            if (ruta === 'vacacion') return hecho(m === 'POST' ? datos.guardarVacacion(s, q.trabajador, b.vacacion) : datos.borrarVacacion(s, q.id));
            if (ruta === 'importar') return hecho(datos.importar(s, b));
            return Promise.resolve({ ok: false, estado: 404, datos: { ok: false, error: 'No encontrado.' } });
        }
        function exportar() { return datos.exportar(s).then(function (r) { return r.archivo; }); }
    }

    var api = { crear: crear, CORREO: CORREO, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeDemo = api;
})(typeof window !== 'undefined' ? window : this);
