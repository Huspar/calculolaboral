/*
 * CalculoLaboral · importar trabajadores desde planillas (v2.0.0)
 * Funciona en el navegador (window.CLPymeImportar) y en Node (require).
 *
 * Soporta cuatro formatos detectados automáticamente:
 *   - plantilla : plantilla Excel/CSV estándar de CálculoLaboral
 *   - previred  : archivo plano de nómina Previred (105 campos separados por ";", sin encabezado)
 *   - lre       : CSV de carga masiva del Libro de Remuneraciones Electrónico (DT)
 *   - generica  : cualquier Excel (.xlsx/.xls) o CSV de otro sistema o planilla propia
 *
 * API:
 *   plantilla() / plantillaXlsx(xlsxMod)
 *   leerCsv(texto) / leerXlsx(buffer, xlsxMod)
 *   detectarFormato(filas)             → { tipo, etiqueta, periodo? }
 *   analizar(filas, { rut, afps })     → { formato, etiqueta, periodo, faltantesComunes, totalFilas, filas: [{ fila, datos, errores, avisos, meta, faltaNombre }] }
 *   revisar(filas, { rut, afps })      → [{ fila, datos, errores, avisos, meta, faltaNombre }]
 */
(function (root) {
    'use strict';

    // Columnas de la plantilla, en orden. "req": obligatoria.
    var COLUMNAS = [
        { k: 'nombre', titulo: 'Nombre completo', req: true },
        { k: 'rut', titulo: 'RUT', req: true },
        { k: 'cargo', titulo: 'Cargo' },
        { k: 'fechaIngreso', titulo: 'Fecha de ingreso (dd-mm-aaaa)' },
        { k: 'contrato', titulo: 'Contrato (indefinido, plazo fijo u obra)' },
        { k: 'fechaTerminoPlazo', titulo: 'Término del plazo fijo (dd-mm-aaaa)' },
        { k: 'jornadaHoras', titulo: 'Jornada semanal (horas)' },
        { k: 'distribucion', titulo: 'Días de trabajo a la semana (5 o 6)' },
        { k: 'sueldoBase', titulo: 'Sueldo base' },
        { k: 'colacion', titulo: 'Colación mensual' },
        { k: 'movilizacion', titulo: 'Movilización mensual' },
        { k: 'gratificacion', titulo: 'Gratificación (legal, ninguna o pactada)' },
        { k: 'afp', titulo: 'AFP' },
        { k: 'salud', titulo: 'Salud (Fonasa o Isapre)' },
        { k: 'isapreNombre', titulo: 'Nombre de la Isapre' },
        { k: 'isaprePlanUF', titulo: 'Plan de Isapre (UF)' },
        { k: 'fechaNacimiento', titulo: 'Fecha de nacimiento (dd-mm-aaaa)' },
        { k: 'nacionalidad', titulo: 'Nacionalidad' },
        { k: 'domicilio', titulo: 'Domicilio' },
        { k: 'comuna', titulo: 'Comuna' }
    ];
    var MAX_FILAS = 50;

    var PREVIRED_AFP = { '03': 'Cuprum', '05': 'Habitat', '08': 'Provida', '29': 'PlanVital', '33': 'Capital', '34': 'Modelo', '35': 'Uno' };
    var PREVIRED_SALUD = {
        '01': 'Banmédica', '02': 'Consalud', '03': 'Vida Tres', '04': 'Colmena', '05': 'Cruz Blanca',
        '07': 'Fonasa', '10': 'Nueva Masvida', '11': 'Codelco', '12': 'Banco Estado', '25': 'Cruz del Norte', '44': 'Esencial'
    };
    var LRE_AFP = { '6': 'Provida', '11': 'PlanVital', '13': 'Cuprum', '14': 'Habitat', '19': 'Uno', '31': 'Capital', '103': 'Modelo' };
    var LRE_SALUD = {
        '102': 'Fonasa', '1': 'Cruz Blanca', '3': 'Banmédica', '4': 'Colmena', '5': 'Codelco',
        '9': 'Consalud', '12': 'Vida Tres', '37': 'Chuquicamata', '38': 'Cruz del Norte',
        '39': 'Fusat', '40': 'Banco Estado', '41': 'Río Blanco', '42': 'San Lorenzo',
        '43': 'Nueva Masvida', '44': 'Esencial'
    };
    var ISAPRES_CONOCIDAS = [
        'banmedica', 'consalud', 'vidatres', 'vida tres', 'colmena', 'cruzblanca', 'cruz blanca',
        'nuevamasvida', 'nueva masvida', 'masvida', 'esencial', 'codelco', 'fundacion', 'bancoestado',
        'banco estado', 'cruzdelnorte', 'cruz del norte', 'chuquicamata', 'fusat', 'rioblanco', 'sanlorenzo'
    ];
    var ALIAS_GEN = {
        nombre: ['nombre completo', 'nombre', 'trabajador', 'empleado', 'colaborador', 'nombre trabajador', 'nombre y apellido', 'nombres y apellidos', 'apellido y nombre'],
        nombres: ['nombres', 'primer nombre'],
        apellidoPaterno: ['apellido paterno', 'paterno', 'primer apellido', 'ap paterno'],
        apellidoMaterno: ['apellido materno', 'materno', 'segundo apellido', 'ap materno'],
        apellidos: ['apellidos'],
        rut: ['rut', 'run', 'rut trabajador', 'run trabajador', 'cedula', 'r u t'],
        cargo: ['cargo', 'puesto', 'rol', 'funcion', 'ocupacion'],
        fechaIngreso: ['fecha de ingreso', 'fecha ingreso', 'ingreso', 'fecha inicio', 'fecha inicio contrato', 'inicio contrato', 'fecha contratacion'],
        contrato: ['contrato', 'tipo de contrato', 'tipo contrato'],
        fechaTerminoPlazo: ['termino del plazo fijo', 'termino plazo fijo', 'fecha termino', 'fecha de termino', 'termino contrato', 'vencimiento contrato'],
        jornadaHoras: ['jornada semanal', 'jornada', 'horas semanales', 'horas pactadas', 'horas contrato'],
        distribucion: ['dias de trabajo a la semana', 'dias semanales', 'dias trabajo', 'distribucion semanal', 'distribucion jornada'],
        sueldoBase: ['sueldo base', 'sueldo', 'salario base', 'sueldo pactado', 'remuneracion base'],
        colacion: ['colacion mensual', 'colacion', 'asignacion de colacion', 'asignacion colacion', 'bono colacion'],
        movilizacion: ['movilizacion mensual', 'movilizacion', 'asignacion de movilizacion', 'asignacion movilizacion', 'locomocion'],
        gratificacion: ['gratificacion', 'tipo gratificacion', 'gratificacion legal'],
        afp: ['afp', 'prevision', 'fondo de pensiones', 'fondo pensiones', 'administradora'],
        salud: ['salud', 'sistema de salud', 'prevision salud', 'sistema salud', 'fonasa / isapre', 'isapre / fonasa', 'isapre o fonasa', 'institucion de salud', 'institucion salud'],
        isapreNombre: ['nombre de la isapre', 'nombre isapre', 'isapre'],
        isaprePlanUF: ['plan de isapre', 'plan isapre', 'plan uf', 'pactado uf', 'uf isapre', 'valor plan uf'],
        fechaNacimiento: ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento', 'f nacimiento'],
        nacionalidad: ['nacionalidad', 'pais origen'],
        domicilio: ['domicilio', 'direccion', 'calle'],
        comuna: ['comuna', 'ciudad'],
        sexo: ['sexo', 'genero'],
        banco: ['banco', 'institucion bancaria'],
        tipoCuenta: ['tipo de cuenta', 'tipo cuenta'],
        numeroCuenta: ['numero de cuenta', 'numero cuenta', 'nro cuenta', 'cuenta bancaria']
    };

    function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    function clave(titulo) { return sinTildes(String(titulo).split('(')[0]).replace(/[_.:/-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function str(v) { return v == null ? '' : String(v).trim(); }
    function textoBonito(s) { return str(s).replace(/\s+/g, ' '); }

    function campoCsv(v) {
        v = String(v == null ? '' : v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function plantilla() {
        return COLUMNAS.map(function (c) { return campoCsv(c.titulo); }).join(';') + '\r\n';
    }

    function detectarSeparador(texto) {
        var primeras = texto.split(/\r?\n/).slice(0, 5).join('\n');
        var sc = (primeras.match(/;/g) || []).length;
        var cm = (primeras.match(/,/g) || []).length;
        var tb = (primeras.match(/\t/g) || []).length;
        if (tb > sc && tb > cm) return '\t';
        return sc >= cm ? ';' : ',';
    }

    function leerCsv(texto) {
        texto = String(texto || '').replace(/^\uFEFF/, '');
        var sep = detectarSeparador(texto);
        var filas = [], fila = [], campo = '', comillas = false;
        for (var i = 0; i < texto.length; i++) {
            var ch = texto[i];
            if (comillas) {
                if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
                else if (ch === '"') comillas = false;
                else campo += ch;
            } else if (ch === '"') comillas = true;
            else if (ch === sep) { fila.push(campo); campo = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && texto[i + 1] === '\n') i++;
                fila.push(campo); filas.push(fila); fila = []; campo = '';
            } else campo += ch;
        }
        if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
        return filas.filter(function (f) { return f.some(function (x) { return String(x).trim() !== ''; }); });
    }

    // "15-03-2022", "15/03/2022", "15.03.2022", "2022-03-15" o Date de Excel → "2022-03-15"; '' si viene vacía; null si no se entiende
    function fecha(v) {
        if (v instanceof Date && !isNaN(v.getTime())) {
            var dUtc = new Date(v.getTime() + 43200000);
            var ay = dUtc.getUTCFullYear(), am = dUtc.getUTCMonth() + 1, ad = dUtc.getUTCDate();
            return ay + '-' + (am < 10 ? '0' : '') + am + '-' + (ad < 10 ? '0' : '') + ad;
        }
        v = String(v == null ? '' : v).trim();
        if (!v) return '';
        var m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(v) || null, a, me, d;
        if (m) { a = +m[1]; me = +m[2]; d = +m[3]; }
        else if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(v))) { d = +m[1]; me = +m[2]; a = +m[3]; }
        else return null;
        var f = new Date(Date.UTC(a, me - 1, d));
        if (f.getUTCFullYear() !== a || f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d) return null;
        return a + '-' + (me < 10 ? '0' : '') + me + '-' + (d < 10 ? '0' : '') + d;
    }

    // "$650.000", "650000", "650.000" o número 650000 → 650000; '' vacío; null si no es un monto en pesos
    function monto(v) {
        if (typeof v === 'number') {
            if (!isFinite(v) || v < 0 || Math.abs(v - Math.round(v)) > 1e-6) return null;
            return Math.round(v);
        }
        v = String(v == null ? '' : v).replace(/\s|\$/g, '');
        if (!v) return '';
        if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(v)) return null;
        return parseInt(v.replace(/\./g, ''), 10);
    }

    function decimal(v) {
        if (typeof v === 'number') {
            if (!isFinite(v) || v < 0) return null;
            return Math.round(v * 100) / 100;
        }
        v = String(v == null ? '' : v).trim().replace(',', '.');
        if (!v) return '';
        return /^\d+(\.\d+)?$/.test(v) ? Math.round(parseFloat(v) * 100) / 100 : null;
    }

    function opcion(v, mapa) {
        var s = sinTildes(v);
        if (!s) return '';
        return Object.prototype.hasOwnProperty.call(mapa, s) ? mapa[s] : null;
    }

    function mapaAfps(lista) {
        var m = {};
        (lista || []).forEach(function (a) { m[sinTildes(a)] = a; });
        return m;
    }

    function resolverAfp(raw, afps) {
        var lim = sinTildes(String(raw || '').replace(/^afp\s+/i, ''));
        if (!lim) return '';
        if (afps[lim]) return afps[lim];
        var claves = Object.keys(afps);
        for (var i = 0; i < claves.length; i++) {
            if (lim.indexOf(claves[i]) >= 0) return afps[claves[i]];
        }
        return null;
    }

    function validarRutCampo(rutCrudo, opc, d, errores) {
        if (!rutCrudo) { errores.push('falta el RUT'); return; }
        if (opc.rut && !opc.rut.valido(rutCrudo)) { errores.push('el RUT no es válido'); return; }
        d.rut = opc.rut ? opc.rut.formatear(rutCrudo) : rutCrudo;
    }

    // --- 1. Detección automática del formato ---
    function esFilaPrevired(f) {
        if (!Array.isArray(f) || f.length < 90 || f.length > 120) return false;
        var cuerpo = str(f[0]).replace(/\./g, '');
        var dv = str(f[1]).toUpperCase();
        if (!/^\d{5,9}$/.test(cuerpo) || !/^[\dK]$/.test(dv)) return false;
        var sexo = str(f[5]).toUpperCase();
        var per = str(f[8]);
        var regimen = str(f[10]).toUpperCase();
        return (sexo === 'M' || sexo === 'F' || regimen === 'AFP' || regimen === 'IPS' || regimen === 'INP' || /^\d{6}$/.test(per));
    }

    function esEncabezadoLre(f) {
        if (!Array.isArray(f) || f.length < 5) return false;
        var hits = 0;
        var tieneRut = false;
        f.forEach(function (cell) {
            var raw = str(cell);
            var k = clave(raw);
            if (raw === '1101' || /\b1101\b/.test(raw) || k === 'rut trabajador') { tieneRut = true; hits++; }
            else if (/\b(1102|1105|1106|1107|1141|1143|2101|5201|5501)\b/.test(raw)) hits++;
            else if (k === 'fecha inicio contrato' || k === 'fonasa isapre' || k === 'sueldo' || k === 'total haberes' || k === 'total liquido') hits++;
        });
        return tieneRut && hits >= 3;
    }

    function indicePorAlias(fila) {
        var enc = fila.map(clave);
        var idx = {};
        Object.keys(ALIAS_GEN).forEach(function (k) {
            var aliases = ALIAS_GEN[k];
            for (var a = 0; a < aliases.length; a++) {
                var pos = enc.indexOf(aliases[a]);
                if (pos >= 0) { idx[k] = pos; break; }
            }
        });
        if (idx.rut === undefined) {
            for (var i = 0; i < enc.length; i++) {
                if (/\brut\b|\brun\b/.test(enc[i])) { idx.rut = i; break; }
            }
        }
        return idx;
    }

    function detectarFormato(filas) {
        if (!filas || !filas.length) return { tipo: 'vacio', etiqueta: 'Archivo vacío' };
        if (esFilaPrevired(filas[0])) {
            var pRaw = str(filas[0][8]);
            var per = /^\d{6}$/.test(pRaw) ? (pRaw.slice(2, 6) + '-' + pRaw.slice(0, 2)) : '';
            return { tipo: 'previred', etiqueta: 'Archivo de nómina Previred (105 campos)', periodo: per, filaEncabezado: -1 };
        }
        for (var i = 0; i < Math.min(filas.length, 4); i++) {
            if (esEncabezadoLre(filas[i])) {
                return { tipo: 'lre', etiqueta: 'Libro de Remuneraciones Electrónico (LRE · DT)', filaEncabezado: i };
            }
        }
        // Revisar si coincide exactamente con la plantilla propia en fila 0
        var enc0 = filas[0].map(clave);
        var indicePlantilla = {};
        COLUMNAS.forEach(function (c) { var p = enc0.indexOf(clave(c.titulo)); if (p >= 0) indicePlantilla[c.k] = p; });
        if (indicePlantilla.nombre !== undefined && indicePlantilla.rut !== undefined && Object.keys(indicePlantilla).length >= 10) {
            return { tipo: 'plantilla', etiqueta: 'Plantilla estándar de CálculoLaboral', indice: indicePlantilla, filaEncabezado: 0 };
        }
        // Buscar mejor fila de encabezados en las primeras 10 filas (para Excel exportados de otros sistemas)
        var mejor = null;
        for (var r = 0; r < Math.min(filas.length, 10); r++) {
            var idx = indicePorAlias(filas[r]);
            var score = Object.keys(idx).length;
            if ((idx.rut !== undefined || idx.nombre !== undefined || idx.nombres !== undefined) && score >= 2) {
                if (!mejor || score > mejor.score) mejor = { fila: r, idx: idx, score: score };
            }
        }
        if (mejor) {
            return { tipo: 'generica', etiqueta: 'Planilla Excel/CSV (detección automática de columnas)', indice: mejor.idx, filaEncabezado: mejor.fila };
        }
        return { tipo: 'plantilla', etiqueta: 'Planilla tabular', indice: indicePlantilla, filaEncabezado: 0 };
    }

    // --- 2. Parser de Previred (105 campos) ---
    function revisarPrevired(filas, opc, det) {
        var afps = mapaAfps(opc.afps);
        var vistos = {};
        var orden = [];

        for (var i = 0; i < filas.length && orden.length < MAX_FILAS; i++) {
            var f = filas[i];
            var nroFila = i + 1;
            if (!Array.isArray(f) || f.length < 20) continue;

            var cuerpo = str(f[0]).replace(/\./g, ''), dv = str(f[1]).toUpperCase();
            var rutCrudo = cuerpo && dv ? (cuerpo + '-' + dv) : '';
            var d = {}, errores = [], avisos = [], meta = {};

            validarRutCampo(rutCrudo, opc, d, errores);
            var pat = textoBonito(f[2]).slice(0, 30);
            var mat = textoBonito(f[3]).slice(0, 30);
            var nom = textoBonito(f[4]).slice(0, 30);
            if (pat) d.apellidoPaterno = pat;
            if (mat) d.apellidoMaterno = mat;
            d.nombre = [nom, pat, mat].filter(Boolean).join(' ').slice(0, 80);
            if (!d.nombre) errores.push('falta el nombre');

            var sx = str(f[5]).toUpperCase();
            if (sx === 'M' || sx === 'F') d.sexo = sx;
            if (str(f[6]) === '0') d.nacionalidad = 'Chilena';

            var tt = str(f[11]);
            if (tt === '1') d.pension = 'vejez_cotiza';
            else if (tt === '2') d.pension = 'vejez_no_cotiza';
            else if (tt === '3') d.pension = 'mayor65';

            var movCod = str(f[14]), movDesde = str(f[15]), movHasta = str(f[16]);
            if (movCod === '1' || movCod === '7' || movCod === '8') {
                var fi = fecha(movDesde);
                if (fi) d.fechaIngreso = fi;
                if (movCod === '7') {
                    d.contrato = 'plazo_fijo';
                    var ft = fecha(movHasta);
                    if (ft) d.fechaTerminoPlazo = ft;
                }
            }

            var tramo = str(f[17]).toUpperCase();
            if (/^[ABCD]$/.test(tramo)) d.afTramo = tramo;
            var cargas = str(f[18]);
            if (/^\d+$/.test(cargas) && +cargas > 0) d.afCargas = Math.min(20, +cargas);

            var codAfp = str(f[25]).padStart(2, '0');
            if (codAfp && codAfp !== '00' && PREVIRED_AFP[codAfp]) {
                var afpNorm = resolverAfp(PREVIRED_AFP[codAfp], afps) || PREVIRED_AFP[codAfp];
                if (!Object.keys(afps).length || afps[sinTildes(afpNorm)]) d.afp = afpNorm;
            }
            var rImp = monto(f[26]);
            if (typeof rImp === 'number' && rImp > 0) {
                meta.rentaImponible = rImp;
                d.sueldoBase = rImp;
                meta.sueldoEsImponible = true;
            }
            if (!d.contrato) d.contrato = 'indefinido';
            var necesitaRevisar = !d.fechaIngreso || !!meta.sueldoEsImponible || !movCod || movCod === '0';

            var apvCont = textoBonito(f[40]).slice(0, 20);
            if (apvCont) d.apvContrato = apvCont;

            var codSal = str(f[74]).padStart(2, '0');
            if (codSal === '07') {
                d.salud = 'fonasa';
            } else if (codSal && PREVIRED_SALUD[codSal]) {
                d.salud = 'isapre';
                d.isapreNombre = PREVIRED_SALUD[codSal];
                var fun = textoBonito(f[75]).slice(0, 16);
                if (fun) d.fun = fun;
                if (str(f[77]) === '2') {
                    var crudoUf = str(f[78]);
                    if (/^\d{5,8}$/.test(crudoUf)) {
                        var ufVal = Math.round((parseInt(crudoUf, 10) / 10000) * 100) / 100;
                        if (ufVal > 0 && ufVal <= 99.99) d.isaprePlanUF = ufVal;
                    } else {
                        var ufDec = decimal(crudoUf);
                        if (typeof ufDec === 'number' && ufDec > 0 && ufDec <= 99.99) d.isaprePlanUF = ufDec;
                    }
                }
            }

            if (str(f[92]) === '2') avisos.push('Jornada parcial: confirma sus horas semanales en la ficha');
            avisos.push(meta.rentaImponible
                ? ('Previred informa renta imponible $' + meta.rentaImponible.toLocaleString('es-CL') + ': confirma el sueldo base y fecha de ingreso en la ficha')
                : 'Previred no incluye sueldo base ni fecha de ingreso: complétalos en la ficha');

            var lineaTipo = str(f[13]) || '00';
            var claveRut = d.rut || ('fila-' + nroFila);
            if (vistos[claveRut]) {
                // Línea secundaria del mismo trabajador (ej. subsidio o movimiento): complementar fechaIngreso si faltaba
                var prev = vistos[claveRut];
                if (!prev.datos.fechaIngreso && d.fechaIngreso) prev.datos.fechaIngreso = d.fechaIngreso;
                if (!prev.datos.fechaTerminoPlazo && d.fechaTerminoPlazo) {
                    prev.datos.contrato = d.contrato || prev.datos.contrato;
                    prev.datos.fechaTerminoPlazo = d.fechaTerminoPlazo;
                }
                if (lineaTipo === '00' && prev.lineaTipo !== '00') {
                    prev.datos = Object.assign({}, prev.datos, d);
                    prev.lineaTipo = '00';
                }
                continue;
            }
            var item = { fila: nroFila, datos: d, errores: errores, avisos: avisos, meta: meta, faltaNombre: false, necesitaRevisar: necesitaRevisar, lineaTipo: lineaTipo };
            vistos[claveRut] = item;
            orden.push(item);
        }
        return orden.map(function (it) { delete it.lineaTipo; return it; });
    }

    // --- 3. Parser de LRE (Libro de Remuneraciones Electrónico DT) ---
    function mapaColumnasLre(encRow) {
        var m = {};
        encRow.forEach(function (cell, idx) {
            var raw = str(cell);
            var codMatch = /(?:^|\D)(1101|1102|1103|1107|1109|1111|1114|1141|1143|2101|2106|2301|2302)(?:\D|$)/.exec(raw);
            if (codMatch && m[codMatch[1]] === undefined) { m[codMatch[1]] = idx; return; }
            var k = clave(raw);
            if (k === 'rut trabajador') m['1101'] = idx;
            else if (k === 'fecha inicio contrato') m['1102'] = idx;
            else if (k === 'fecha de termino de contrato' || k === 'fecha termino de contrato') m['1103'] = idx;
            else if (k === 'codigo tipo de jornada') m['1107'] = idx;
            else if (k === 'pensionado por vejez') m['1109'] = idx;
            else if (k === 'numero cargas familiares legales autorizadas') m['1111'] = idx;
            else if (k === 'tramo asignacion familiar') m['1114'] = idx;
            else if (k === 'afp') m['1141'] = idx;
            else if (k === 'fonasa isapre') m['1143'] = idx;
            else if (k === 'sueldo') m['2101'] = idx;
            else if (k === 'gratificacion') m['2106'] = idx;
            else if (k === 'colacion total mensual') m['2301'] = idx;
            else if (k === 'movilizacion total mensual') m['2302'] = idx;
            else if ((k === 'nombre' || k === 'nombre completo' || k === 'trabajador') && m.nombre === undefined) m.nombre = idx;
        });
        return m;
    }

    function revisarLre(filas, opc, det) {
        var start = det.filaEncabezado;
        var col = mapaColumnasLre(filas[start]);
        var afps = mapaAfps(opc.afps);
        var salida = [];
        for (var i = start + 1; i < filas.length && salida.length < MAX_FILAS; i++) {
            var f = filas[i];
            function v(k) { return col[k] === undefined ? '' : str(f[col[k]]); }
            var d = {}, errores = [], avisos = [], meta = {};

            validarRutCampo(v('1101'), opc, d, errores);
            var nom = col.nombre !== undefined ? textoBonito(f[col.nombre]).slice(0, 80) : '';
            var faltaNombre = !nom;
            if (nom) d.nombre = nom;
            else {
                errores.push('falta el nombre (el LRE de la DT no incluye nombres)');
                avisos.push('El LRE no incluye nombres: escríbelo en la vista previa');
            }

            var fi = fecha(col['1102'] !== undefined ? f[col['1102']] : '');
            if (fi === null) errores.push('la fecha de inicio no es válida');
            else if (fi) d.fechaIngreso = fi;

            var jor = v('1107');
            if (jor === '201') avisos.push('Jornada parcial en LRE: confirma horas semanales en la ficha');
            if (v('1109') === '1') d.pension = 'vejez_cotiza';

            var codAfp = String(parseInt(v('1141'), 10) || '');
            var rawAfp = v('1141');
            if (LRE_AFP[codAfp]) {
                d.afp = resolverAfp(LRE_AFP[codAfp], afps) || LRE_AFP[codAfp];
            } else if (rawAfp && rawAfp !== '0') {
                var afpRes = resolverAfp(rawAfp, afps);
                if (afpRes) d.afp = afpRes;
            }

            var rawSal = v('1143');
            var codSal = String(parseInt(rawSal, 10) || '');
            if (codSal === '102' || codSal === '99' || sinTildes(rawSal) === 'fonasa') {
                d.salud = 'fonasa';
            } else if (LRE_SALUD[codSal]) {
                d.salud = 'isapre';
                d.isapreNombre = LRE_SALUD[codSal];
            } else if (rawSal && rawSal !== '0') {
                d.salud = 'isapre';
                d.isapreNombre = rawSal.slice(0, 40);
            }

            var cargas = v('1111');
            if (/^\d+$/.test(cargas) && +cargas > 0) d.afCargas = Math.min(20, +cargas);
            var tramo = v('1114').toUpperCase();
            if (/^[ABCD]$/.test(tramo)) d.afTramo = tramo;

            var sb = col['2101'] !== undefined ? monto(f[col['2101']]) : '';
            if (typeof sb === 'number' && sb > 0) d.sueldoBase = sb;
            var colac = col['2301'] !== undefined ? monto(f[col['2301']]) : '';
            if (typeof colac === 'number' && colac > 0) d.colacion = colac;
            var mov = col['2302'] !== undefined ? monto(f[col['2302']]) : '';
            if (typeof mov === 'number' && mov > 0) d.movilizacion = mov;
            var grat = col['2106'] !== undefined ? monto(f[col['2106']]) : '';
            if (typeof grat === 'number' && grat > 0) d.gratificacion = 'legal';

            salida.push({ fila: i + 1, datos: d, errores: errores, avisos: avisos, meta: meta, faltaNombre: faltaNombre });
        }
        return salida;
    }

    // --- 4. Parser de plantilla propia o Excel/CSV genérico ---
    function esNombreIsapre(s) {
        var k = sinTildes(s);
        if (!k || k === 'fonasa' || k === 'isapre') return false;
        return ISAPRES_CONOCIDAS.some(function (n) { return k.indexOf(n) >= 0; });
    }

    function revisarTabular(filas, opc, det) {
        var start = det.filaEncabezado || 0;
        var indice = det.indice || {};
        var afps = mapaAfps(opc.afps);
        var esGenerica = det.tipo === 'generica';

        return filas.slice(start + 1, start + 1 + MAX_FILAS).map(function (f, n) {
            var errores = [], avisos = [], d = {};
            function valCrudo(k) { return indice[k] === undefined ? '' : f[indice[k]]; }
            function val(k) { var x = valCrudo(k); return x == null ? '' : String(x).trim(); }

            var nombre = val('nombre').replace(/\s+/g, ' ');
            if (!nombre && (indice.nombres !== undefined || indice.apellidoPaterno !== undefined || indice.apellidos !== undefined)) {
                nombre = [val('nombres'), val('apellidoPaterno'), val('apellidoMaterno'), val('apellidos')]
                    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
            }
            d.nombre = nombre;
            if (!d.nombre) errores.push('falta el nombre');
            else if (d.nombre.length > 80) errores.push('el nombre tiene más de 80 caracteres');

            validarRutCampo(val('rut'), opc, d, errores);

            ['cargo', 'nacionalidad', 'domicilio', 'comuna', 'isapreNombre', 'banco', 'numeroCuenta'].forEach(function (k) {
                var x = val(k); if (x) d[k] = x;
            });
            [['fechaIngreso', 'la fecha de ingreso'], ['fechaTerminoPlazo', 'el término del plazo fijo'], ['fechaNacimiento', 'la fecha de nacimiento']].forEach(function (p) {
                var x = fecha(valCrudo(p[0]));
                if (x === null) errores.push(p[1] + ' no es una fecha (usa dd-mm-aaaa)');
                else if (x) d[p[0]] = x;
            });
            ['sueldoBase', 'colacion', 'movilizacion'].forEach(function (k) {
                var c = valCrudo(k);
                var x = monto(c);
                if (x === null) errores.push('«' + val(k) + '» no es un monto en pesos');
                else if (x !== '') d[k] = x;
            });
            var j = val('jornadaHoras');
            if (j) {
                var jNum = j.replace(/\s*h(?:oras|rs)?\.?$/i, '');
                if (/^\d{1,2}$/.test(jNum) && +jNum >= 1 && +jNum <= 45) d.jornadaHoras = +jNum;
                else errores.push('la jornada debe ser un número de horas entre 1 y 45');
            }
            var di = val('distribucion');
            if (di) {
                var diNum = di.replace(/\s*d[ií]as?$/i, '');
                if (diNum === '5' || diNum === '6') d.distribucion = diNum;
                else errores.push('los días de trabajo a la semana deben ser 5 o 6');
            }
            var c = opcion(val('contrato'), { 'indefinido': 'indefinido', 'plazo fijo': 'plazo_fijo', 'plazo_fijo': 'plazo_fijo', 'fijo': 'plazo_fijo', 'obra': 'obra', 'obra o faena': 'obra', 'por obra': 'obra', 'faena': 'obra' });
            if (c === null) errores.push('el contrato debe ser indefinido, plazo fijo u obra');
            else if (c) d.contrato = c;
            if (d.contrato === 'plazo_fijo' && !d.fechaTerminoPlazo) errores.push('falta el término del plazo fijo');

            var g = opcion(val('gratificacion'), { 'legal': 'legal', 'si': 'legal', '25%': 'legal', 'ninguna': 'ninguna', 'no': 'ninguna', 'sin gratificacion': 'ninguna', 'pactada': 'pactada' });
            if (g === null) errores.push('la gratificación debe ser legal, ninguna o pactada');
            else if (g) d.gratificacion = g;

            var a = val('afp');
            if (a) {
                var an = resolverAfp(a, afps);
                if (an) d.afp = an;
                else errores.push('AFP «' + a + '» desconocida');
            }

            var rawSalud = val('salud');
            if (esGenerica && esNombreIsapre(rawSalud)) {
                d.salud = 'isapre';
                if (!d.isapreNombre) d.isapreNombre = rawSalud.slice(0, 40);
            } else {
                var s = opcion(rawSalud, { 'fonasa': 'fonasa', 'isapre': 'isapre' });
                if (s === null) errores.push('la salud debe ser Fonasa o Isapre');
                else if (s) d.salud = s;
                else if (d.isapreNombre && esGenerica) d.salud = 'isapre';
            }

            var plan = decimal(valCrudo('isaprePlanUF'));
            if (plan === null) errores.push('el plan de Isapre debe ser un número en UF (por ejemplo 4,2)');
            else if (plan !== '') d.isaprePlanUF = plan;
            if (d.salud === 'isapre' && !d.isapreNombre) errores.push('falta el nombre de la Isapre');

            var sx = sinTildes(val('sexo'));
            if (sx === 'm' || sx === 'masculino' || sx === 'hombre') d.sexo = 'M';
            else if (sx === 'f' || sx === 'femenino' || sx === 'mujer') d.sexo = 'F';

            var tc = opcion(val('tipoCuenta'), { 'corriente': 'corriente', 'cuenta corriente': 'corriente', 'vista': 'vista', 'cuenta vista': 'vista', 'rut': 'vista', 'cuenta rut': 'vista', 'ahorro': 'ahorro', 'cuenta de ahorro': 'ahorro' });
            if (tc) d.tipoCuenta = tc;

            return { fila: start + n + 2, datos: d, errores: errores, avisos: avisos, meta: {}, faltaNombre: false };
        });
    }

    function analizar(filas, opc) {
        opc = opc || {};
        if (!filas || !filas.length) return { formato: 'vacio', etiqueta: 'Archivo vacío', periodo: '', totalFilas: 0, filas: [] };
        var det = detectarFormato(filas);
        var resultado;
        if (det.tipo === 'previred') resultado = revisarPrevired(filas, opc, det);
        else if (det.tipo === 'lre') resultado = revisarLre(filas, opc, det);
        else resultado = revisarTabular(filas, opc, det);

        var totalFilas = det.tipo === 'previred' ? filas.length : Math.max(0, filas.length - (det.filaEncabezado + 1));
        var colsReconocidas = [];
        if (det.indice) {
            var etiquetasCol = { nombre: 'Nombre', nombres: 'Nombres', rut: 'RUT', cargo: 'Cargo', fechaIngreso: 'Ingreso', contrato: 'Contrato', sueldoBase: 'Sueldo base', colacion: 'Colación', movilizacion: 'Movilización', afp: 'AFP', salud: 'Salud', isapreNombre: 'Isapre', isaprePlanUF: 'Plan UF' };
            Object.keys(det.indice).forEach(function (k) {
                if (etiquetasCol[k] && colsReconocidas.indexOf(etiquetasCol[k]) < 0) colsReconocidas.push(etiquetasCol[k]);
            });
        }
        return {
            formato: det.tipo,
            etiqueta: det.etiqueta,
            periodo: det.periodo || '',
            columnasDetectadas: colsReconocidas,
            totalFilas: totalFilas,
            filas: resultado
        };
    }

    function revisar(filas, opc) {
        return analizar(filas, opc).filas;
    }

    var esNode = typeof module !== 'undefined' && module.exports;
    function EX() { return esNode ? require('./pyme_excel.js') : root.CLPymeExcel; }

    function plantillaXlsx(xlsxMod) {
        var enc = COLUMNAS.map(function (c) { return c.titulo; });
        var anchos = COLUMNAS.map(function (c) { return Math.min(Math.max(Math.ceil(c.titulo.length * 0.72) + 4, 15), 34); });
        anchos[0] = 28; anchos[1] = 15; anchos[2] = 22;
        var filas = [enc];
        for (var i = 0; i < 8; i++) filas.push(new Array(COLUMNAS.length).fill(''));
        return EX().construirLibro([{
            nombre: 'Trabajadores',
            filas: filas,
            anchos: anchos,
            textos: { 1: true, 3: true, 5: true, 16: true },
            monedas: { 8: true, 9: true, 10: true },
            decimales: { 15: true },
            alinear: { 1: 'center', 3: 'center', 5: 'center', 6: 'center', 7: 'center', 16: 'center' },
            estilo: {
                encabezadoFila: 0,
                filasEntrada: [1, 2, 3, 4, 5, 6, 7, 8],
                congelarFila: 1,
                orientacion: 'landscape',
                zebra: true
            }
        }], xlsxMod);
    }

    function leerXlsx(buffer, xlsxMod) {
        return EX().filasDesdeBuffer(buffer, xlsxMod);
    }

    var api = {
        COLUMNAS: COLUMNAS, MAX_FILAS: MAX_FILAS,
        plantilla: plantilla, plantillaXlsx: plantillaXlsx,
        leerCsv: leerCsv, leerXlsx: leerXlsx,
        detectarFormato: detectarFormato, analizar: analizar, revisar: revisar,
        _fecha: fecha, _monto: monto, version: '2.0.0'
    };
    if (esNode) module.exports = api;
    else root.CLPymeImportar = api;
})(typeof window !== 'undefined' ? window : this);
