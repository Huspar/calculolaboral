/*
 * CalculoLaboral · valores base de las liquidaciones del Asistente Pyme (v1.4.0). Funciona en el navegador (window.CLPymeLiquidaciones) y en Node.
 *
 *   diasBase(trabajador, 'AAAA-MM')  → días a pagar según ingreso y término de plazo fijo (mes comercial de 30 días); 0 si aún no ingresaba o ya terminó
 *   mesBase(trabajador, 'AAAA-MM')   → el mes con los valores por defecto (lo que se guarda al "preparar el mes"), con los
 *                                      bonos fijos de la ficha (t.bonosFijos: imponibles a bonosImponibles; pérdida de caja y
 *                                      desgaste de herramientas a otrosNoImponibles)
 *   resumen(resultado, mesValores, t) → { liquido, totalHaberes, totalImponible, totalDescuentos, uf, utm, y el desglose } para guardar junto al mes
 *   previred(registros)              → lo que se paga en Previred agrupado por institución, con los registros que traen desglose
 *   (desglose: montos retenidos al trabajador, cotizaciones del empleador y costo total; conDesglose: true)
 *   estadoDe(registro)               → 'sin_datos' | 'guardada' | 'emitida'
 *   mesBase también toma de la ficha las licencias y permisos del mes (t.ausencias, js/pyme_ausencias.js): mes.ausencias,
 *   los días trabajados sin la licencia ni el permiso sin goce, y los días de licencia (mes.diasLicencia).
 *   semanaCorridaMes(t, mes, 'AAAA-MM', { esFeriado, vacaciones }) → { aplica, monto, detalle, calculo, error }
 *                                      semana corrida (art. 45) sobre comisiones y tratos del mes, sin contar en el promedio
 *                                      las licencias y permisos del mes (mes.ausencias) ni las vacaciones registradas.
 *                                      Necesita js/semana_corrida.js. Con mes.scModo 'no' no se calcula.
 *
 * Préstamos con cuotas (lista "prestamos" de la ficha: { id, concepto, fecha, monto, cuotas, desde 'AAAA-MM', pausas [] }):
 *   cuotasDe(prestamo)               → [{ periodo, numero, monto }]: una cuota por mes desde "desde", saltando los meses de "pausas"
 *                                      (la cuota postergada pasa al final). Cuotas iguales; la última ajusta el redondeo.
 *   cuotasDelMes(t, 'AAAA-MM')       → [{ id, nombre, monto, numero, de }] lo que se descuenta ese mes (va en mes.cuotasPrestamo)
 *   estadoPrestamo(prestamo, 'AAAA-MM') → { descontado, saldo, pagadas, cuotas, proxima, ultima, pausado } al cierre de ese mes
 *   saldoPrestamos(t, 'AAAA-MM')     → saldo total de los préstamos al cierre de ese mes (para el finiquito)
 *   El anticipo fijo de la ficha (anticipoMensual) se descuenta completo cada mes y no cuenta para el 15% del art. 58.
 *
 * Son valores iniciales: la persona los revisa y corrige antes de guardar o imprimir.
 */
(function (root) {
    'use strict';

    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function ultimoDia(periodo) {
        var a = periodo.split('-').map(Number);
        return new Date(Date.UTC(a[0], a[1], 0)).getUTCDate();
    }

    function diasBase(t, periodo) {
        var inicio = periodo + '-01', fin = periodo + '-' + dos(ultimoDia(periodo));
        var ingreso = t && t.fechaIngreso, termino = t && t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : '';
        if (ingreso && ingreso > fin) return 0;
        if (termino && termino < inicio) return 0;
        var desde = ingreso && ingreso >= inicio ? Math.min(+ingreso.slice(8, 10), 30) : 1;
        var hasta = termino && termino <= fin ? Math.min(+termino.slice(8, 10), 30) : 30;
        return Math.max(0, Math.min(30, hasta - desde + 1));
    }

    function rangoContrato(t) { return { desde: t && t.fechaIngreso, hasta: t && t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : '' }; }
    // Días a pagar del mes con las licencias y permisos sin goce de la ficha
    function diasPropuestos(t, periodo) {
        var lista = (t && t.ausencias) || [];
        return lista.length ? AUS.diasTrabajados(lista, periodo, rangoContrato(t)) : diasBase(t, periodo);
    }

    function mesBase(t, periodo) {
        var grat = t && t.gratificacion === 'ninguna' ? 'ninguna' : t && t.gratificacion === 'pactada' ? 'manual' : 'legal';
        var aus = (t && t.ausencias) || [];
        return {
            diasTrabajados: diasPropuestos(t, periodo), diasLicencia: AUS.diasLicencia(aus, periodo), horasExtra: 0,
            gratificacion: grat, gratificacionMonto: 0, comisiones: 0, tratos: 0, bonosImponibles: bonosFijosDe(t, true),
            scModo: 'calcular', ausencias: AUS.delMes(aus, periodo).slice(0, 10), semanaCorrida: 0, semanaCorridaDetalle: '',
            viaticos: 0, asignacionFamiliar: 0, otrosNoImponibles: bonosFijosDe(t, false),
            apvMonto: 0, apvRegimen: 'B', anticipo: (t && t.anticipoMensual) || 0, creditoCCAF: 0, cuotaSindical: 0, otrosDescuentos: [],
            cuotasPrestamo: cuotasDelMes(t, periodo),
            emitida: '', calculo: null
        };
    }

    // Bonos fijos de la ficha como conceptos del mes (máximo 8 por lista, como acepta el servidor)
    function bonosFijosDe(t, imponibles) {
        return ((t && t.bonosFijos) || []).filter(function (b) { return (b.tipo === 'imponible') === imponibles && b.monto > 0; })
            .map(function (b) { return { nombre: b.nombre, monto: b.monto }; }).slice(0, 8);
    }

    // ---------- préstamos con cuotas ----------
    function sumarMes(periodo, n) {
        var a = periodo.split('-').map(Number), x = a[0] * 12 + (a[1] - 1) + n;
        return Math.floor(x / 12) + '-' + dos(x % 12 + 1);
    }

    function cuotasDe(p) {
        var lista = [];
        if (!p || !(p.monto > 0) || !(p.cuotas >= 1) || !/^\d{4}-\d{2}$/.test(String(p.desde || ''))) return lista;
        var pausas = {};
        (p.pausas || []).forEach(function (x) { pausas[x] = true; });
        var base = Math.floor(p.monto / p.cuotas), periodo = p.desde, guarda = 0;
        while (lista.length < p.cuotas && guarda++ < 600) {
            if (!pausas[periodo]) {
                var k = lista.length + 1;
                lista.push({ periodo: periodo, numero: k, monto: k === p.cuotas ? p.monto - base * (p.cuotas - 1) : base });
            }
            periodo = sumarMes(periodo, 1);
        }
        return lista;
    }

    function cuotasDelMes(t, periodo) {
        var salida = [];
        ((t && t.prestamos) || []).forEach(function (p) {
            var c = cuotasDe(p).filter(function (x) { return x.periodo === periodo; })[0];
            if (c) salida.push({ id: p.id, nombre: p.concepto || 'Préstamo', monto: c.monto, numero: c.numero, de: p.cuotas });
        });
        return salida;
    }

    function estadoPrestamo(p, periodo) {
        var lista = cuotasDe(p), hechas = lista.filter(function (c) { return c.periodo <= periodo; });
        var descontado = hechas.reduce(function (s, c) { return s + c.monto; }, 0);
        var proxima = lista.filter(function (c) { return c.periodo > periodo; })[0] || null;
        return {
            descontado: descontado, saldo: Math.max(0, (p.monto || 0) - descontado), pagadas: hechas.length, cuotas: p.cuotas || 0,
            proxima: proxima, ultima: lista.length ? lista[lista.length - 1].periodo : null,
            pausado: (p.pausas || []).indexOf(periodo) >= 0
        };
    }

    function saldoPrestamos(t, periodo) {
        return ((t && t.prestamos) || []).reduce(function (s, p) { return s + estadoPrestamo(p, periodo).saldo; }, 0);
    }

    function resumen(res, mesValores, t) {
        var c = {
            liquido: Math.max(0, Math.round(res.liquido)),
            totalHaberes: Math.round(res.totalHaberes),
            totalImponible: Math.round(res.totalImponible),
            totalDescuentos: Math.round(res.totalDescuentos),
            uf: mesValores.uf,
            utm: Math.round(mesValores.utm)
        };
        // Bases para el finiquito (v1.3.0): lo que no entra en la indemnización o en el feriado se ve por separado
        function suma(lista, prefijos) {
            return Math.round((lista || []).reduce(function (s, l) {
                return s + (prefijos.some(function (p) { return String(l.concepto).indexOf(p) === 0; }) ? Number(l.monto) || 0 : 0);
            }, 0));
        }
        if (res.haberesImponibles) {
            c.conBases = true;
            c.horasExtra = suma(res.haberesImponibles, ['Horas extra']);
            c.gratificacion = suma(res.haberesImponibles, ['Gratificación']);
            c.colMov = suma(res.haberesNoImponibles, ['Colación', 'Movilización']);
        }
        // Base del impuesto único del mes, para el resumen anual (Certificado N°6 y DDJJ 1887), desde la v1.5.0
        if (res.bases && typeof res.bases.baseTributable === 'number') c.baseTributable = Math.round(res.bases.baseTributable);
        if (res.montos && res.empleador) {
            var emp = {};
            res.empleador.lineas.forEach(function (l) { emp[l.clave] = l.monto; });
            c.conDesglose = true;
            c.afp = res.montos.afp; c.salud = res.montos.salud; c.afcTrabajador = res.montos.afc;
            c.impuesto = res.montos.impuesto; c.apv = res.montos.apv; c.creditoCCAF = res.montos.creditoCCAF;
            c.empAfp = emp.afp || 0; c.empSis = emp.sis || 0; c.empSeguroSocial = emp.seguroSocial || 0; c.empAfc = emp.afc || 0; c.empMutual = emp.mutual || 0;
            c.costoEmpleador = res.empleador.costoTotal;
            c.afpNombre = (t && t.afp) || '';
            c.saludInst = t && t.salud === 'isapre' ? 'isapre' : 'fonasa';
            c.isapreNombre = t && t.salud === 'isapre' ? String(t.isapreNombre || '').slice(0, 40) : '';
        }
        return c;
    }

    // Resumen de lo que se paga en Previred (estimación): { filas: [{ institucion, monto }], total, impuesto (va al SII), costo, incluidos }
    function previred(registros) {
        var filas = {}, orden = [], impuesto = 0, costo = 0, incluidos = 0;
        function sumar(nombre, monto) {
            if (!monto) return;
            if (!filas[nombre]) { filas[nombre] = 0; orden.push(nombre); }
            filas[nombre] += monto;
        }
        (registros || []).forEach(function (c) {
            if (!c || !c.conDesglose) return;
            incluidos++;
            sumar('AFP ' + (c.afpNombre || ''), (c.afp || 0) + (c.empAfp || 0));
            sumar(c.saludInst === 'isapre' ? 'Isapre ' + (c.isapreNombre || '') : 'Fonasa', c.salud || 0);
            sumar('Seguro de cesantía (AFC)', (c.afcTrabajador || 0) + (c.empAfc || 0));
            sumar('Seguro de invalidez y sobrevivencia (SIS)', c.empSis || 0);
            sumar('Seguro social (Ley 21.735)', c.empSeguroSocial || 0);
            sumar('Mutual o ISL', c.empMutual || 0);
            sumar('Ahorro previsional voluntario (APV)', c.apv || 0);
            sumar('Crédito de caja de compensación', c.creditoCCAF || 0);
            impuesto += c.impuesto || 0;
            costo += c.costoEmpleador || 0;
        });
        // Mismo orden que la planilla de Previred: AFP, salud, cesantía y seguro social, después lo demás
        var RANGO = [/^AFP/, /^(Fonasa|Isapre)/, /^Seguro de cesantía/, /^Seguro de invalidez/, /^Seguro social/, /^Mutual/, /^Ahorro/, /^Crédito/];
        function rango(k) { for (var i = 0; i < RANGO.length; i++) if (RANGO[i].test(k)) return i; return RANGO.length; }
        orden = orden.map(function (k, i) { return { k: k, i: i }; }).sort(function (a, b) { return rango(a.k) - rango(b.k) || a.i - b.i; }).map(function (x) { return x.k; });
        var lista = orden.map(function (k) { return { institucion: k.trim(), monto: filas[k] }; });
        return { filas: lista, total: lista.reduce(function (s, f) { return s + f.monto; }, 0), impuesto: impuesto, costo: costo, incluidos: incluidos };
    }

    // ---------- semana corrida ----------
    var SC = typeof module !== 'undefined' && module.exports ? require('./semana_corrida.js') : root.CLSemanaCorrida;
    var AUS = typeof module !== 'undefined' && module.exports ? require('./pyme_ausencias.js') : root.CLPymeAusencias;

    function semanaCorridaMes(t, mes, periodo, opc) {
        opc = opc || {};
        var variable = Math.max(0, Number(mes && mes.comisiones) || 0) + Math.max(0, Number(mes && mes.tratos) || 0);
        var vacio = { aplica: false, monto: 0, detalle: '', calculo: null, error: '' };
        if (!variable || (mes && mes.scModo === 'no')) return vacio;
        var ausencias = ((mes && mes.ausencias) || []).concat(opc.vacaciones || []).map(function (a) { return { desde: a.desde, hasta: a.hasta }; });
        try {
            var r = SC.calcular({
                periodo: periodo, distribucion: (t && t.distribucion) || '5', variable: variable, ausencias: ausencias,
                desde: t && t.fechaIngreso, hasta: t && t.contrato === 'plazo_fijo' ? t.fechaTerminoPlazo : '', esFeriado: opc.esFeriado
            });
            return { aplica: true, monto: r.monto, detalle: r.detalle, calculo: r, error: '' };
        } catch (err) {
            return { aplica: true, monto: 0, detalle: '', calculo: null, error: err.message || String(err) };
        }
    }

    function estadoDe(registro) {
        if (!registro) return 'sin_datos';
        return registro.emitida ? 'emitida' : 'guardada';
    }

    var api = {
        diasBase: diasBase, mesBase: mesBase, resumen: resumen, previred: previred, estadoDe: estadoDe,
        cuotasDe: cuotasDe, cuotasDelMes: cuotasDelMes, estadoPrestamo: estadoPrestamo, saldoPrestamos: saldoPrestamos, sumarMes: sumarMes,
        semanaCorridaMes: semanaCorridaMes, diasPropuestos: diasPropuestos,
        version: '1.5.0'
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeLiquidaciones = api;
})(typeof window !== 'undefined' ? window : this);
