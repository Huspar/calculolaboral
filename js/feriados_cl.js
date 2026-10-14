/*
 * CalculoLaboral · feriados nacionales de Chile y aritmética de días hábiles (v1.0.0)
 *
 * Funciona en el navegador (window.CLFeriados) y en Node (require). Sin dependencias.
 *
 * Los feriados se CALCULAN con las reglas de la ley (no son una lista pegada a mano) y solo se ofrecen los años que se
 * verificaron (COBERTURA). Pedir un año sin cobertura lanza ErrorFeriados: es preferible no calcular a calcular un
 * plazo de feriado o de cotizaciones tratando un día festivo como hábil.
 *
 * Reglas aplicadas
 *  - Fijos: 1-ene, 1-may, 21-may, 16-jul, 15-ago, 18-sep, 19-sep, 1-nov, 8-dic, 25-dic.
 *  - Viernes Santo y Sábado Santo: calculados desde la fecha de Pascua.
 *  - San Pedro y San Pablo (29-jun) y Encuentro de Dos Mundos (12-oct), Ley 19.668: si caen martes, miércoles o jueves
 *    pasan al lunes anterior de esa misma semana; en otro caso se mantienen.
 *  - Iglesias Evangélicas y Protestantes (31-oct), Ley 20.299: si cae martes pasa al viernes anterior; si cae miércoles,
 *    al viernes siguiente. (Regla no ejercitada en 2026 ni 2027, años en que cae sábado y domingo.)
 *  - Fiestas Patrias, Ley 20.215: lunes 17-sep si el 18 y el 19 son martes y miércoles; viernes 20-sep si son miércoles y jueves.
 *  - Fiestas Patrias, Ley 20.983: viernes 17-sep si el 18 y el 19 caen sábado y domingo (feriado común, no irrenunciable).
 *  - Día Nacional de los Pueblos Indígenas, Ley 21.357: el día del solsticio de invierno del hemisferio sur, en hora de Chile
 *    (SOLSTICIO_INVIERNO).
 *
 * Alcance y límites
 *  - Solo feriados NACIONALES. Hay feriados locales o regionales (por ejemplo 7-jun en Arica y Parinacota) que no están aquí.
 *  - Una ley especial puede agregar feriados (elecciones, conmemoraciones): revisar al comenzar cada año.
 *  - Cuántos días hábiles cuenta un plazo depende de la norma: para el feriado anual el sábado es siempre inhábil (art. 69 CT);
 *    para otros plazos puede ser hábil. Las funciones reciben { sabadoHabil } para que cada llamador lo decida.
 *
 * Verificación: ver VERIFICACION. Para agregar un año: confirmar la lista oficial, sumar el año a COBERTURA y a
 * SOLSTICIO_INVIERNO, y agregar la lista esperada en tools/test_feriados.js.
 */
(function (root) {
    'use strict';

    function ErrorFeriados(mensaje) {
        this.name = 'ErrorFeriados';
        this.message = mensaje;
        this.stack = (new Error(mensaje)).stack;
    }
    ErrorFeriados.prototype = Object.create(Error.prototype);
    ErrorFeriados.prototype.constructor = ErrorFeriados;

    // Años verificados. Se amplía solo después de confirmar la lista oficial del año.
    var COBERTURA = [2026, 2027];

    // Día del solsticio de invierno (hemisferio sur) en hora de Chile. 2026: 21-jun 08:24 UTC = 04:24 en Chile.
    // 2027: 21-jun 14:11 UTC = 10:11 en Chile (calculado; confirmar con el calendario oficial de 2027).
    var SOLSTICIO_INVIERNO = { 2026: '06-21', 2027: '06-21' };

    var VERIFICACION = {
        2026: { estado: 'confirmado', verificado: '2026-10-12', nota: '16 feriados; 10 en día de semana y 6 en fin de semana (listado coincidente en varios medios y en Chileestuyo.cl)' },
        2027: { estado: 'calculado por ley', verificado: '2026-10-12', nota: '17 feriados. Traslados de la Ley 19.668 (28-jun y 11-oct) y Ley 20.983 (17-sep) aplicados por regla; solsticio calculado: confirmar el día de los Pueblos Indígenas con el calendario oficial de 2027' }
    };

    var NOTA_LOCALES = 'Solo feriados nacionales: no incluye feriados locales ni los que una ley especial agregue.';

    // ---------- fechas (siempre en UTC para no depender de la zona horaria del equipo) ----------
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function aIso(d) { return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()); }
    function deIso(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
        if (!m) throw new ErrorFeriados('Fecha invalida (se espera AAAA-MM-DD): ' + iso);
        var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        if (aIso(d) !== iso) throw new ErrorFeriados('Fecha inexistente: ' + iso);
        return d;
    }
    function sumarDias(d, n) { return new Date(d.getTime() + n * 86400000); }
    function fecha(anio, mes, dia) { return new Date(Date.UTC(anio, mes - 1, dia)); }
    function diaSemana(d) { return d.getUTCDay(); } // 0 domingo ... 6 sábado

    // Domingo de Pascua (algoritmo de Meeus/Jones/Butcher)
    function pascua(anio) {
        var a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
        var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
        return fecha(anio, mes, dia);
    }

    // Ley 19.668: martes, miércoles o jueves pasan al lunes anterior
    function lunesAnteriorSiMartesAJueves(d) {
        var s = diaSemana(d);
        return s >= 2 && s <= 4 ? sumarDias(d, -(s - 1)) : d;
    }

    // Calcula los feriados de un año según las reglas (sin mirar COBERTURA; para pruebas y para ampliar años).
    // opciones.sinSolsticio: omite el día de los Pueblos Indígenas (solo para comprobar las otras reglas en años sin solsticio cargado)
    function calcular(anio, opciones) {
        var lista = [];
        function agregar(d, nombre, base) { lista.push({ fecha: aIso(d), nombre: nombre, base: base }); }

        agregar(fecha(anio, 1, 1), 'Año Nuevo', 'Ley 2.977');
        var p = pascua(anio);
        agregar(sumarDias(p, -2), 'Viernes Santo', 'Ley 2.977');
        agregar(sumarDias(p, -1), 'Sábado Santo', 'Ley 2.977');
        agregar(fecha(anio, 5, 1), 'Día del Trabajo', 'Ley 2.977');
        agregar(fecha(anio, 5, 21), 'Día de las Glorias Navales', 'Ley 2.977');
        var sol = SOLSTICIO_INVIERNO[anio];
        if (sol) agregar(fecha(anio, +sol.slice(0, 2), +sol.slice(3, 5)), 'Día Nacional de los Pueblos Indígenas', 'Ley 21.357');
        else if (!(opciones && opciones.sinSolsticio)) throw new ErrorFeriados('Falta el dia del solsticio de invierno de ' + anio + ' (Ley 21.357)');
        agregar(lunesAnteriorSiMartesAJueves(fecha(anio, 6, 29)), 'San Pedro y San Pablo', 'Ley 19.668');
        agregar(fecha(anio, 7, 16), 'Día de la Virgen del Carmen', 'Ley 2.977');
        agregar(fecha(anio, 8, 15), 'Asunción de la Virgen', 'Ley 2.977');

        // Fiestas Patrias: 18 y 19 siempre; el 17 o el 20 según el día de la semana
        var s18 = diaSemana(fecha(anio, 9, 18));
        if (s18 === 2) agregar(fecha(anio, 9, 17), 'Fiestas Patrias (lunes 17)', 'Ley 20.215');           // 18 martes, 19 miércoles
        if (s18 === 6) agregar(fecha(anio, 9, 17), 'Fiestas Patrias (viernes 17)', 'Ley 20.983');         // 18 sábado, 19 domingo
        agregar(fecha(anio, 9, 18), 'Independencia Nacional (Fiestas Patrias)', 'Ley 2.977');
        agregar(fecha(anio, 9, 19), 'Día de las Glorias del Ejército', 'Ley 2.977');
        if (s18 === 3) agregar(fecha(anio, 9, 20), 'Fiestas Patrias (viernes 20)', 'Ley 20.215');         // 18 miércoles, 19 jueves

        agregar(lunesAnteriorSiMartesAJueves(fecha(anio, 10, 12)), 'Encuentro de Dos Mundos', 'Ley 19.668');

        var o31 = fecha(anio, 10, 31), s31 = diaSemana(o31);
        agregar(s31 === 2 ? sumarDias(o31, -4) : s31 === 3 ? sumarDias(o31, 2) : o31, 'Día de las Iglesias Evangélicas y Protestantes', 'Ley 20.299');
        agregar(fecha(anio, 11, 1), 'Día de Todos los Santos', 'Ley 2.977');
        agregar(fecha(anio, 12, 8), 'Inmaculada Concepción', 'Ley 2.977');
        agregar(fecha(anio, 12, 25), 'Navidad', 'Ley 2.977');

        lista.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
        return lista;
    }

    function cubre(anio) { return COBERTURA.indexOf(anio) >= 0; }
    function exigirCobertura(anio) {
        if (!cubre(anio)) {
            throw new ErrorFeriados('No hay feriados verificados para ' + anio + ' (cubre ' + COBERTURA.join(' y ') + '). No se calcula con datos incompletos.');
        }
    }

    var cache = {};
    function feriados(anio) {
        exigirCobertura(anio);
        if (!cache[anio]) cache[anio] = calcular(anio);
        return cache[anio].map(function (f) { return { fecha: f.fecha, nombre: f.nombre, base: f.base }; });
    }

    function indice(anio) {
        exigirCobertura(anio);
        if (!cache['i' + anio]) {
            var idx = {};
            feriados(anio).forEach(function (f) { idx[f.fecha] = f; });
            cache['i' + anio] = idx;
        }
        return cache['i' + anio];
    }

    function esFeriado(iso) { var d = deIso(iso); return !!indice(d.getUTCFullYear())[iso]; }
    function nombreFeriado(iso) { var d = deIso(iso), f = indice(d.getUTCFullYear())[iso]; return f ? f.nombre : null; }

    // Día hábil: no es domingo ni feriado, y el sábado solo cuenta si { sabadoHabil: true }
    function esDiaHabil(iso, opciones) {
        var d = deIso(iso), s = diaSemana(d);
        if (s === 0) return false;
        if (s === 6 && !(opciones && opciones.sabadoHabil)) return false;
        return !indice(d.getUTCFullYear())[iso];
    }

    // Si la fecha es hábil la devuelve; si no, el primer día hábil siguiente
    function siguienteDiaHabil(iso, opciones) {
        var d = deIso(iso);
        for (var i = 0; i < 40; i++) {
            var s = aIso(d);
            if (esDiaHabil(s, opciones)) return s;
            d = sumarDias(d, 1);
        }
        throw new ErrorFeriados('No se encontro un dia habil cerca de ' + iso);
    }

    // Fecha que resulta de contar n días hábiles después de la fecha dada (la fecha de partida no cuenta)
    function sumarDiasHabiles(iso, n, opciones) {
        if (!(n >= 0) || Math.floor(n) !== n) throw new ErrorFeriados('n debe ser un entero mayor o igual a 0');
        var d = deIso(iso), restan = n;
        var tope = 3650;
        while (restan > 0 && tope-- > 0) {
            d = sumarDias(d, 1);
            if (esDiaHabil(aIso(d), opciones)) restan--;
        }
        return aIso(d);
    }

    // Feriados entre dos fechas, ambas incluidas
    function feriadosEntre(desde, hasta) {
        var a = deIso(desde), b = deIso(hasta), salida = [];
        if (a > b) return salida;
        for (var y = a.getUTCFullYear(); y <= b.getUTCFullYear(); y++) {
            feriados(y).forEach(function (f) { if (f.fecha >= desde && f.fecha <= hasta) salida.push(f); });
        }
        return salida;
    }

    var api = {
        version: '1.0.0', ErrorFeriados: ErrorFeriados, COBERTURA: COBERTURA, VERIFICACION: VERIFICACION, NOTA_LOCALES: NOTA_LOCALES,
        cubre: cubre, feriados: feriados, esFeriado: esFeriado, nombreFeriado: nombreFeriado, esDiaHabil: esDiaHabil,
        siguienteDiaHabil: siguienteDiaHabil, sumarDiasHabiles: sumarDiasHabiles, feriadosEntre: feriadosEntre,
        _calcular: calcular, _pascua: function (anio) { return aIso(pascua(anio)); }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLFeriados = api;
})(typeof window !== 'undefined' ? window : this);
