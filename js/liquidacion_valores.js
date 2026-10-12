/*
 * CalculoLaboral · valores del mes para el generador de liquidaciones (v1.0.0)
 *
 * obtener(periodo "YYYY-MM") → Promise<{ ok, mes, fuentes, avisos, mensaje }>
 *   mes: { uf, utm, imm, topeAfpUF, topeAfcUF, afp }  (lo que espera CLLiquidacionEngine.calcular)
 *
 * Reglas:
 * - UF: la del último día del mes de la remuneración. UTM: la del mes. Se consultan a la vez mindicador.cl y
 *   findic.cl (los mismos proveedores del resto del sitio) y se toma el primer valor válido. findic.cl no
 *   publica la UF de fechas futuras, así que para fin de mes en curso responde solo mindicador.cl.
 * - Un valor de la API solo se acepta si pasa un control de rango. Si el mes tiene respaldo confirmado en el SII y
 *   el valor de la API difiere, se usa el respaldo y se avisa.
 * - Si las dos APIs fallan, se usa el respaldo (si existe). Sin API y sin respaldo, el mes no se puede emitir.
 * - Un mes ya cerrado no cambia: el resultado se guarda en el navegador y se reutiliza, así la misma liquidación
 *   da siempre los mismos montos.
 * - Valores de ingreso mínimo, topes y AFP: vigencias de js/liquidacion_parametros.js.
 */
(function (root) {
    'use strict';

    var PROVEEDORES = [
        { nombre: 'mindicador.cl', base: 'https://mindicador.cl/api' },
        { nombre: 'findic.cl', base: 'https://findic.cl/api' }
    ];
    var TIMEOUT_MS = 15000; // mindicador.cl a veces tarda más de 8 s
    var CLAVE_CACHE = 'cl_liq_vals_';
    var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    function dosDigitos(n) { return n < 10 ? '0' + n : String(n); }
    function ultimoDia(periodo) {
        var a = periodo.split('-').map(Number);
        return new Date(Date.UTC(a[0], a[1], 0)).getUTCDate();
    }
    function fechaApi(periodo) { return dosDigitos(ultimoDia(periodo)) + '-' + periodo.slice(5, 7) + '-' + periodo.slice(0, 4); }
    function fechaIso(periodo) { return periodo + '-' + dosDigitos(ultimoDia(periodo)); }
    function fechaLarga(periodo) { return ultimoDia(periodo) + ' de ' + MESES_ES[+periodo.slice(5, 7) - 1]; }
    function ufValida(x) { return typeof x === 'number' && isFinite(x) && x > 30000 && x < 70000; }
    function utmValida(x) { return typeof x === 'number' && isFinite(x) && x > 50000 && x < 150000; }

    function crear(opciones) {
        opciones = opciones || {};
        var P = opciones.parametros;
        var pedir = opciones.fetch;
        var almacen = opciones.storage || null;
        var enCurso = {};

        function leerCache(periodo) {
            try { var v = JSON.parse(almacen.getItem(CLAVE_CACHE + periodo) || 'null'); return v && ufValida(v.uf) && utmValida(v.utm) ? v : null; } catch (e) { return null; }
        }
        function guardarCache(periodo, v) {
            try { almacen.setItem(CLAVE_CACHE + periodo, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
        }

        // Una misma dirección se pide una sola vez durante 30 s (p. ej. la serie de la UTM del año para varios meses a la vez).
        // Así una respuesta vacía de "UF aún no publicada" no se queda pegada: pasado ese tiempo, o al forzar, se vuelve a consultar.
        var memoJson = {};
        function pedirJson(url) {
            if (memoJson[url] && Date.now() - memoJson[url].ts < 30000) return memoJson[url].p;
            var control = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = setTimeout(function () { if (control) control.abort(); }, TIMEOUT_MS);
            var p = Promise.resolve(pedir(url, control ? { signal: control.signal } : undefined)).then(function (r) {
                clearTimeout(timer);
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            }, function (e) { clearTimeout(timer); throw e; });
            memoJson[url] = { p: p, ts: Date.now() };
            p.catch(function () { delete memoJson[url]; });
            return p;
        }

        // Consulta los dos proveedores a la vez y toma el primer valor válido; devuelve { valor, fuente } o null
        function desdeApi(ruta, extraer) {
            return new Promise(function (resolver) {
                var pendientes = PROVEEDORES.length;
                function fin() { pendientes--; if (pendientes === 0) resolver(null); }
                PROVEEDORES.forEach(function (prov) {
                    pedirJson(prov.base + ruta).then(function (data) {
                        var valor = extraer(data);
                        if (valor == null) fin();
                        else resolver({ valor: valor, fuente: prov.nombre });
                    }).catch(fin);
                });
            });
        }

        function pedirUf(periodo) {
            var iso = fechaIso(periodo);
            return desdeApi('/uf/' + fechaApi(periodo), function (d) {
                var s = d && Array.isArray(d.serie) ? d.serie : [];
                var fila = s.filter(function (x) { return x && String(x.fecha).slice(0, 10) === iso; })[0];
                return fila && ufValida(Number(fila.valor)) ? Number(fila.valor) : null;
            });
        }
        function pedirUtm(periodo) {
            return desdeApi('/utm/' + periodo.slice(0, 4), function (d) {
                var s = d && Array.isArray(d.serie) ? d.serie : [];
                var fila = s.filter(function (x) { return x && String(x.fecha).slice(0, 7) === periodo; })[0];
                return fila && utmValida(Number(fila.valor)) ? Number(fila.valor) : null;
            });
        }

        // Elige entre API y respaldo; devuelve { valor, fuente, aviso }
        function resolver(nombre, desdeLaApi, respaldo, iguales, etiqueta) {
            if (desdeLaApi && respaldo != null && !iguales(desdeLaApi.valor, respaldo)) {
                return { valor: respaldo, fuente: 'Respaldo del sitio (SII)', aviso: 'La ' + nombre + ' de la API (' + etiqueta(desdeLaApi.valor) + ') no coincide con la confirmada en el SII (' + etiqueta(respaldo) + '): se usó la del SII.' };
            }
            if (desdeLaApi) return { valor: desdeLaApi.valor, fuente: desdeLaApi.fuente };
            if (respaldo != null) return { valor: respaldo, fuente: 'Respaldo del sitio (SII)', aviso: 'No pudimos consultar la ' + nombre + ' en línea: se usó el valor confirmado en el SII.' };
            return null;
        }

        function armar(periodo, uf, utm, vig) {
            return { uf: uf, utm: utm, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, afp: vig.afp };
        }

        function calcular(periodo) {
            var vig = P.vigenciaDe(periodo);
            if (!vig || periodo < P.PRIMER_MES || periodo > P.ULTIMO_MES) {
                return Promise.resolve({ ok: false, mensaje: 'Ese mes todavía no está disponible en el generador.' });
            }
            var cache = almacen ? leerCache(periodo) : null;
            var respaldo = P.RESPALDO[periodo] || null;
            if (cache) {
                return Promise.resolve({ ok: true, mes: armar(periodo, cache.uf, cache.utm, vig), fuentes: cache.fuentes, avisos: cache.avisos || [], vigencia: vig });
            }
            return Promise.all([pedirUf(periodo), pedirUtm(periodo)]).then(function (r) {
                var uf = resolver('UF del ' + fechaLarga(periodo), r[0], respaldo && respaldo.uf, function (a, b) { return Math.abs(a - b) < 0.005; }, function (x) { return '$' + x.toLocaleString('es-CL', { minimumFractionDigits: 2 }); });
                var utm = resolver('UTM del mes', r[1], respaldo && respaldo.utm, function (a, b) { return a === b; }, function (x) { return '$' + Math.round(x).toLocaleString('es-CL'); });
                if (!uf) {
                    return { ok: false, mensaje: 'La UF del ' + fechaLarga(periodo) + ' todavía no está publicada o no pudimos consultarla. Intenta de nuevo en unos minutos; la UF de fin de mes se publica alrededor del día 9 de ese mes.' };
                }
                if (!utm) {
                    return { ok: false, mensaje: 'No pudimos obtener la UTM de ese mes. Intenta de nuevo en unos minutos.' };
                }
                var avisos = [uf.aviso, utm.aviso].filter(Boolean);
                var fuentes = { uf: uf.fuente, utm: utm.fuente };
                // Un mes cerrado no cambia: se guarda para repetir los mismos montos. Con respaldo de emergencia no se guarda.
                if (almacen && !avisos.length) guardarCache(periodo, { uf: uf.valor, utm: utm.valor, fuentes: fuentes, avisos: [], guardado: new Date().toISOString() });
                return { ok: true, mes: armar(periodo, uf.valor, utm.valor, vig), fuentes: fuentes, avisos: avisos, vigencia: vig };
            });
        }

        function obtener(periodo, forzar) {
            if (forzar && !enCurso[periodo]) memoJson = {};
            if (!enCurso[periodo]) {
                enCurso[periodo] = calcular(periodo).then(function (r) { delete enCurso[periodo]; return r; }, function (e) { delete enCurso[periodo]; throw e; });
            }
            return enCurso[periodo];
        }

        return { obtener: obtener, fechaLarga: fechaLarga };
    }

    var api = { crear: crear, fechaLarga: fechaLarga, version: '1.0.0' };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLLiquidacionValores = api;
})(typeof window !== 'undefined' ? window : this);
