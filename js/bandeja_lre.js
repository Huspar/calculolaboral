/*
 * CalculoLaboral · Bandeja de estados LRE por empresa (Suite Contadores) v1.0.0
 *
 * El LRE se declara a mano en el portal Mi DT de la Direccion del Trabajo:
 * esta bandeja solo registra el estado de cada empresa del contador para el
 * periodo activo y calcula el plazo legal (dentro de los primeros 15 dias
 * habiles del mes siguiente al pago, art. 62 CT / Res. Ex. 285-2021 DT).
 *
 * Funciona en el navegador (window.CLBandejaLre) y en Node (require). Sin dependencias.
 * La persistencia sigue el patron de js/demo_clientes.js: crear(window.localStorage).
 *
 * No guarda credenciales ni se conecta a Mi DT: el contador marca a mano.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./feriados_cl'));
    else root.CLBandejaLre = factory(root.CLFeriados);
}(typeof self !== 'undefined' ? self : this, function (CLFeriados) {
    'use strict';

    var CLAVE = 'cl-bandeja-lre';

    // Estados del ciclo de declaracion LRE. `siguiente` permite ciclar con un boton.
    var ESTADOS = {
        pendiente: { etiqueta: 'Pendiente de subir', siguiente: 'enviado' },
        enviado: { etiqueta: 'Enviado a Mi DT', siguiente: 'cargado' },
        cargado: { etiqueta: 'Cargado en Mi DT', siguiente: 'rectificar' },
        observado: { etiqueta: 'Observado por Mi DT', siguiente: 'rectificar' },
        rectificar: { etiqueta: 'Pendiente de rectificación', siguiente: 'enviado' }
    };
    var ESTADO_DEFECTO = 'pendiente';

    // ---------- periodo ----------
    function normalizarPeriodo(periodo) {
        var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || '').trim());
        if (!m) return null;
        var anio = +m[1], mes = +m[2];
        if (mes < 1 || mes > 12) return null;
        return { anio: anio, mes: mes, texto: m[0] };
    }

    function esPeriodoValido(periodo) { return !!normalizarPeriodo(periodo); }

    // ---------- plazo legal ----------
    // Vencimiento: el 15.o dia habil del mes siguiente al periodo pagado (sabado inhabil).
    // Exige que feriados_cl cubra el anio del vencimiento; si no, lo reporta en `cubierto: false`.
    function vencimientoLre(periodo) {
        var p = normalizarPeriodo(periodo);
        if (!p) return null;
        var anioV = p.mes === 12 ? p.anio + 1 : p.anio;
        var mesV = p.mes === 12 ? 1 : p.mes + 1;
        var dos = function (n) { return n < 10 ? '0' + n : String(n); };
        var inicio = anioV + '-' + dos(mesV) + '-01';
        if (!CLFeriados || !CLFeriados.cubre || !CLFeriados.cubre(anioV)) {
            return { cubierto: false, vence: null, anio: anioV, mes: mesV };
        }
        // El plazo son los primeros 15 dias habiles del mes (inclusive):
        // primer habil del mes + 14 habiles mas.
        var primerHabil = CLFeriados.siguienteDiaHabil(inicio, { sabadoHabil: false });
        var vence = CLFeriados.sumarDiasHabiles(primerHabil, 14, { sabadoHabil: false });
        return { cubierto: true, vence: vence, anio: anioV, mes: mesV };
    }

    // Dias habiles restantes desde `hoyIso` hasta el vencimiento inclusive
    // (el dia de hoy cuenta: hoy == vencimiento devuelve 1, quedan 1 para declarar).
    // Negativo = vencido hace N dias habiles.
    function diasHabilesRestantes(periodo, hoyIso) {
        var v = vencimientoLre(periodo);
        if (!v || !v.cubierto || !hoyIso) return null;
        if (hoyIso > v.vence) {
            // cuenta habiles entre el vencimiento y hoy (exclusivo) en sentido inverso
            var n = 0, cur = v.vence;
            while (cur < hoyIso && n < 400) {
                var d = new Date(cur + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + 1);
                var iso = d.toISOString().slice(0, 10);
                if (CLFeriados.esDiaHabil(iso, { sabadoHabil: false })) n++;
                cur = iso;
            }
            return -n;
        }
        // cuenta habiles estrictamente despues de hoy, hasta el vencimiento inclusive
        var m = 0, cur2 = hoyIso;
        while (cur2 < v.vence && m < 400) {
            var d2 = new Date(cur2 + 'T00:00:00Z');
            d2.setUTCDate(d2.getUTCDate() + 1);
            cur2 = d2.toISOString().slice(0, 10);
            if (CLFeriados.esDiaHabil(cur2, { sabadoHabil: false })) m++;
        }
        if (m === 0) m = 1; // hoy inhábil pero dentro del plazo: el vencimiento sigue disponible
        return m;
    }

    // ---------- almacenamiento ----------
    function crear(almacen) {
        function leer() {
            try {
                var t = almacen.getItem(CLAVE);
                var datos = t ? JSON.parse(t) : {};
                return datos && typeof datos === 'object' ? datos : {};
            } catch (e) { return {}; }
        }
        function escribir(datos) {
            try { almacen.setItem(CLAVE, JSON.stringify(datos)); return true; }
            catch (e) { return false; }
        }
        function normalCliente(nombre) { return String(nombre || '').trim().slice(0, 120); }
        function normalPeriodoClave(periodo) {
            var p = normalizarPeriodo(periodo);
            return p ? p.texto : null;
        }

        function estados(periodo) {
            var k = normalPeriodoClave(periodo);
            if (!k) return {};
            var datos = leer();
            var per = datos[k] || {};
            var salida = {};
            Object.keys(per).forEach(function (cli) {
                var e = per[cli] || {};
                salida[cli] = {
                    estado: ESTADOS[e.estado] ? e.estado : ESTADO_DEFECTO,
                    etiqueta: (ESTADOS[e.estado] || ESTADOS[ESTADO_DEFECTO]).etiqueta,
                    fecha: e.fecha || ''
                };
            });
            return salida;
        }

        function obtener(periodo, cliente) {
            var est = estados(periodo);
            return est[normalCliente(cliente)] || null;
        }

        function marcar(periodo, cliente, estado, fechaIso) {
            var k = normalPeriodoClave(periodo);
            var c = normalCliente(cliente);
            if (!k || !c) throw new Error('Se requiere periodo AAAA-MM y nombre de cliente.');
            if (!ESTADOS[estado]) throw new Error('Estado desconocido: ' + estado);
            var datos = leer();
            datos[k] = datos[k] || {};
            datos[k][c] = {
                estado: estado,
                fecha: fechaIso || new Date().toISOString()
            };
            return escribir(datos);
        }

        // Marca el estado siguiente del ciclo (boton que cicla); devuelve el nuevo estado.
        function avanzar(periodo, cliente) {
            var actual = (obtener(periodo, cliente) || { estado: ESTADO_DEFECTO }).estado;
            var siguiente = ESTADOS[actual].siguiente;
            marcar(periodo, cliente, siguiente);
            return siguiente;
        }

        function borrar(periodo, cliente) {
            var k = normalPeriodoClave(periodo);
            var c = normalCliente(cliente);
            if (!k) return false;
            var datos = leer();
            if (c) {
                if (!datos[k] || !(c in datos[k])) return true;
                delete datos[k][c];
            } else {
                delete datos[k];
            }
            return escribir(datos);
        }

        // Resumen por periodo para pintar KPIs de la bandeja.
        function resumen(periodo, clientes) {
            var est = estados(periodo);
            var lista = (clientes || Object.keys(est)).map(function (cli) {
                return cli in est ? cli : normalCliente(cli);
            });
            var conteo = { pendiente: 0, enviado: 0, cargado: 0, observado: 0, rectificar: 0, total: 0 };
            lista.forEach(function (cli) {
                var e = est[cli];
                var estKey = e ? e.estado : ESTADO_DEFECTO;
                conteo[estKey] = (conteo[estKey] || 0) + 1;
                conteo.total++;
            });
            return conteo;
        }

        return {
            estados: estados,
            obtener: obtener,
            marcar: marcar,
            avanzar: avanzar,
            borrar: borrar,
            resumen: resumen
        };
    }

    return {
        CLAVE: CLAVE,
        ESTADOS: ESTADOS,
        ESTADO_DEFECTO: ESTADO_DEFECTO,
        esPeriodoValido: esPeriodoValido,
        vencimientoLre: vencimientoLre,
        diasHabilesRestantes: diasHabilesRestantes,
        crear: crear
    };
}));
