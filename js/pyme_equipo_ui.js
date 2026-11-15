/*
 * CalculoLaboral · Módulo UI de Personal, Equipo, Aprobaciones 1-Clic y Mi Portal (/app)
 * Complementa app_pyme.js, pyme_vacaciones.js, pyme_ausencias.js y liquidacion_engine.js.
 * Funciona en navegador (window.CLPymeEquipoUI) y en Node (require) para pruebas unitarias.
 */
(function (root) {
    'use strict';

    var PESOS_FMT = new Intl.NumberFormat('es-CL');
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function pesos(n) {
        return '$' + PESOS_FMT.format(Math.round(Number(n) || 0));
    }
    function dos(n) { return n < 10 ? '0' + n : String(n); }
    function sumarDias(iso, n) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
        var a = iso.split('-').map(Number);
        var d = new Date(Date.UTC(a[0], a[1] - 1, a[2]) + n * 86400000);
        return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
    }
    function diasEntre(desde, hasta) {
        var a = String(desde).split('-').map(Number), b = String(hasta).split('-').map(Number);
        var da = Date.UTC(a[0], a[1] - 1, a[2]), db = Date.UTC(b[0], b[1] - 1, b[2]);
        return Math.round((db - da) / 86400000);
    }
    function iniciales(nombre) {
        var p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
        if (!p.length) return 'CL';
        if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
        return (p[0][0] + p[1][0]).toUpperCase();
    }
    function fechaCorta(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
        var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
        var a = iso.split('-');
        return (+a[2]) + ' ' + m[+a[1] - 1] + ' ' + a[0];
    }

    // Clasificación de área para organigrama liviano sin exigir campo manual previo
    function clasificarAreaTrabajador(t) {
        if (t && t.area && String(t.area).trim()) return String(t.area).trim();
        var cargo = String((t && t.cargo) || '').toLowerCase();
        if (/admin|contab|finanz|geren|jef|encargad|supervis|rrhh|rr\.hh/.test(cargo)) {
            return 'Administración y Supervisión';
        }
        if (/panad|pastel|cocin|horne|bodeg|taller|producc|maestr|operari/.test(cargo)) {
            return 'Producción y Taller';
        }
        if (/vend|cajer|local|tienda|mostrador|comercial|atencion|atención|despach/.test(cargo)) {
            return 'Ventas y Atención';
        }
        return 'Equipo Operativo';
    }

    function iconoArea(area) {
        if (/producc/i.test(area)) return 'bakery_dining';
        if (/vent/i.test(area)) return 'point_of_sale';
        if (/admin/i.test(area)) return 'admin_panel_settings';
        return 'groups';
    }

    // Misma fórmula exacta que js/liquidacion_engine.js: (sueldoBase / 30 * 28 / (4 * jornada) * 1.5)
    function calcularMontoHorasExtra(sueldoBase, jornadaHoras, horasExtra) {
        var sb = Number(sueldoBase) || 0;
        var j = Number(jornadaHoras) || 42;
        var h = Number(horasExtra) || 0;
        if (sb <= 0 || j <= 0 || h <= 0) return 0;
        var valorHora = sb / 30 * 28 / (4 * j) * 1.5;
        return Math.round(valorHora * h);
    }

    function contarDiasHabilesSimple(desde, hasta, F, VAC) {
        if (!desde || !hasta || hasta < desde) return 0;
        if (VAC && F && typeof VAC.diasHabiles === 'function') {
            try { return VAC.diasHabiles(desde, hasta, F).dias; } catch (e) { /* fallback si el año no tiene tabla */ }
        }
        var c = 0, a = desde.split('-').map(Number), fin = hasta.split('-').map(Number);
        var d = Date.UTC(a[0], a[1] - 1, a[2]), df = Date.UTC(fin[0], fin[1] - 1, fin[2]);
        while (d <= df) {
            var s = new Date(d).getUTCDay();
            if (s >= 1 && s <= 5) c++;
            d += 86400000;
        }
        return c;
    }

    function resumenEquipoKpis(o) {
        var trabajadores = (o && o.trabajadores) || [];
        var hoy = (o && o.hoy) || '';
        var vacCache = (o && o.vacCache) || [];
        var solicitudes = (o && o.solicitudes) || [];
        var activos = trabajadores.filter(function (t) { return t && t.activo !== false; });
        var indefinidos = activos.filter(function (t) { return t.contrato === 'indefinido'; }).length;
        var plazoFijo = activos.filter(function (t) { return t.contrato === 'plazo_fijo'; }).length;
        var ausentes = [];
        var porVencer = [];

        activos.forEach(function (t) {
            var enLic = (t.ausencias || []).some(function (a) {
                return a.desde && a.hasta && a.desde <= hoy && a.hasta >= hoy;
            });
            var enVac = vacCache.some(function (v) {
                return v.trabajadorId === t.id && v.tipo === 'periodo' && v.desde <= hoy && v.hasta >= hoy;
            });
            if (enLic || enVac) {
                ausentes.push(t.nombre + (enLic ? ' (Licencia)' : ' (Vacaciones)'));
            }
            if (t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && hoy) {
                var faltan = diasEntre(hoy, t.fechaTerminoPlazo);
                if (faltan >= 0 && faltan <= 30) {
                    porVencer.push({ nombre: t.nombre, dias: faltan });
                }
            }
        });

        var pendientes = solicitudes.filter(function (s) { return s.estado === 'pendiente'; });
        var pendVac = pendientes.filter(function (s) { return s.tipo === 'vacaciones' || s.tipo === 'permiso'; }).length;
        var pendHe = pendientes.filter(function (s) { return s.tipo === 'horas_extra'; }).length;

        return {
            activos: activos.length,
            indefinidos: indefinidos,
            plazoFijo: plazoFijo,
            ausentesHoy: ausentes.length,
            ausentesDetalle: ausentes,
            plazosPorVencer: porVencer.length,
            porVencerLista: porVencer,
            solicitudesPendientes: pendientes.length,
            pendientesVac: pendVac,
            pendientesHe: pendHe
        };
    }

    function construirOrganigrama(o) {
        var empresa = (o && o.empresa) || {};
        var trabajadores = ((o && o.trabajadores) || []).filter(function (t) { return t && t.activo !== false; });
        var vacCache = (o && o.vacCache) || [];
        var hoy = (o && o.hoy) || '';
        var mapa = {};

        trabajadores.forEach(function (t) {
            var area = clasificarAreaTrabajador(t);
            if (!mapa[area]) mapa[area] = [];
            var lic = (t.ausencias || []).filter(function (a) { return a.desde <= hoy && a.hasta >= hoy; })[0];
            var vac = vacCache.filter(function (v) { return v.trabajadorId === t.id && v.tipo === 'periodo' && v.desde <= hoy && v.hasta >= hoy; })[0];
            var estadoBadge = lic ? { texto: 'Licencia hasta ' + fechaCorta(lic.hasta), clase: 'sello-preparada' }
                : vac ? { texto: 'Vacaciones hasta ' + fechaCorta(vac.hasta), clase: 'sello-preparada' }
                : { texto: 'Activo hoy', clase: 'sello-emitida' };
            var vence = (t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo && hoy) ? diasEntre(hoy, t.fechaTerminoPlazo) : null;
            mapa[area].push({
                id: t.id,
                nombre: t.nombre,
                iniciales: iniciales(t.nombre),
                cargo: t.cargo || 'Colaborador',
                contratoTexto: t.contrato === 'plazo_fijo' ? ('Plazo fijo' + (vence !== null && vence >= 0 && vence <= 30 ? ' (vence en ' + vence + ' d)' : '')) : 'Indefinido',
                estado: estadoBadge,
                alerta: !!(lic || vac || (vence !== null && vence <= 30))
            });
        });

        var areas = Object.keys(mapa).map(function (area) {
            return {
                nombre: area,
                icono: iconoArea(area),
                cantidad: mapa[area].length,
                miembros: mapa[area]
            };
        });

        return {
            lider: {
                nombre: empresa.representante || 'Dirección General',
                iniciales: iniciales(empresa.representante || 'DG'),
                cargo: empresa.razonSocial || 'Representante Legal'
            },
            areas: areas
        };
    }

    function novedadesDelMesResumen(o) {
        var trabajadores = (o && o.trabajadores) || [];
        var mesesPeriodo = (o && o.mesesPeriodo) || {};
        var vacCache = (o && o.vacCache) || [];
        var periodo = (o && o.periodo) || '';
        var ini = periodo + '-01', fin = periodo + '-31';
        var items = [];

        trabajadores.forEach(function (t) {
            if (!t || t.activo === false) return;
            var reg = mesesPeriodo[t.id];
            if (reg && Number(reg.horasExtra) > 0) {
                var montoHe = calcularMontoHorasExtra(t.sueldoBase, t.jornadaHoras || 42, reg.horasExtra);
                items.push({
                    tipo: 'horas_extra',
                    icono: 'more_time',
                    clase: 'he',
                    trabajador: t.nombre,
                    texto: '+' + reg.horasExtra + ' hrs extra al 50% (+' + pesos(montoHe) + ')'
                });
            }
            var lic = (t.ausencias || []).filter(function (a) { return a.desde <= fin && a.hasta >= ini; })[0];
            if (lic) {
                var diasLic = Math.max(1, diasEntre(lic.desde < ini ? ini : lic.desde, lic.hasta > fin ? fin : lic.hasta) + 1);
                items.push({
                    tipo: 'licencia',
                    icono: 'medical_services',
                    clase: 'lic',
                    trabajador: t.nombre,
                    texto: diasLic + ' ' + (diasLic === 1 ? 'día' : 'días') + ' de ' + (lic.tipo === 'licencia' ? 'licencia médica' : 'ausencia') + ' en el mes'
                });
            }
            var vac = vacCache.filter(function (v) { return v.trabajadorId === t.id && v.tipo === 'periodo' && v.desde <= fin && v.hasta >= ini; })[0];
            if (vac) {
                items.push({
                    tipo: 'vacaciones',
                    icono: 'beach_access',
                    clase: 'vac',
                    trabajador: t.nombre,
                    texto: vac.dias + ' días de vacaciones (con goce íntegro Art. 67)'
                });
            }
        });
        return items;
    }

    function crearSolicitudesIniciales(o) {
        var trabajadores = (o && o.trabajadores) || [];
        var hoy = (o && o.hoy) || '2026-11-15';
        var F = o && o.F, VAC = o && o.VAC;
        var bruno = trabajadores.filter(function (t) { return /bruno/i.test(t.nombre); })[0] || trabajadores[1] || trabajadores[0];
        var ana = trabajadores.filter(function (t) { return /ana/i.test(t.nombre); })[0] || trabajadores[0];
        var carla = trabajadores.filter(function (t) { return /carla/i.test(t.nombre); })[0] || trabajadores[2];
        var lista = [];

        if (bruno) {
            var d1 = sumarDias(hoy, 14), d2 = sumarDias(hoy, 18);
            var dh = contarDiasHabilesSimple(d1, d2, F, VAC);
            lista.push({
                id: 'sol-vac-demo-1',
                trabajadorId: bruno.id,
                nombre: bruno.nombre,
                cargo: bruno.cargo || 'Vendedor',
                tipo: 'vacaciones',
                desde: d1,
                hasta: d2,
                dias: dh || 3,
                nota: 'Descanso fin de año en familia',
                fechaSolicitud: sumarDias(hoy, -2),
                estado: 'pendiente'
            });
        }
        if (ana) {
            lista.push({
                id: 'sol-he-demo-1',
                trabajadorId: ana.id,
                nombre: ana.nombre,
                cargo: ana.cargo || 'Panadera',
                tipo: 'horas_extra',
                fecha: sumarDias(hoy, -1),
                horas: 4,
                nota: 'Horneado especial pedidos fin de semana',
                fechaSolicitud: hoy,
                estado: 'pendiente'
            });
        }
        if (carla) {
            lista.push({
                id: 'sol-perm-demo-1',
                trabajadorId: carla.id,
                nombre: carla.nombre,
                cargo: carla.cargo || 'Encargada de local',
                tipo: 'permiso',
                desde: sumarDias(hoy, -5),
                hasta: sumarDias(hoy, -5),
                dias: 1,
                nota: 'Trámite bancario autorizado',
                fechaSolicitud: sumarDias(hoy, -7),
                estado: 'aprobada'
            });
        }
        return lista;
    }

    function aprobarSolicitudEnLista(lista, id) {
        return (lista || []).map(function (s) {
            return s.id === id ? Object.assign({}, s, { estado: 'aprobada' }) : s;
        });
    }

    function rechazarSolicitudEnLista(lista, id, motivo) {
        return (lista || []).map(function (s) {
            return s.id === id ? Object.assign({}, s, { estado: 'rechazada', motivoRechazo: motivo || 'No autorizada por carga operativa' }) : s;
        });
    }

    function montarUI(ctx) {
        var solicitudes = [];
        var sembradoParaEmpresa = null;
        var tabTrab = 'lista';
        var portalTrabId = null;
        var tipoFormPortal = 'vacaciones';
        var cargandoPeriodos = {};

        function $(id) { return document.getElementById(id); }

        function asegurarSolicitudes() {
            var est = ctx.getEstado();
            if (!est) return;
            var clave = (est.empresaId || 'demo') + '|' + (ctx.esEjemplo() ? 'ejemplo' : 'real');
            if (sembradoParaEmpresa === clave) return;
            sembradoParaEmpresa = clave;
            if (ctx.esEjemplo()) {
                solicitudes = crearSolicitudesIniciales({
                    trabajadores: est.trabajadores || [],
                    vacCache: ctx.getVacCache(),
                    hoy: ctx.hoyIso(),
                    periodo: ctx.getPeriodo(),
                    F: root.CLFeriadosCL,
                    VAC: root.CLPymeVacaciones
                });
            } else {
                solicitudes = [];
            }
        }

        function trabajadorPortal() {
            var est = ctx.getEstado();
            var trabs = ((est && est.trabajadores) || []).filter(function (t) { return t.activo !== false; });
            if (!trabs.length) return null;
            var found = trabs.filter(function (t) { return t.id === portalTrabId; })[0];
            if (found) return found;
            // En demo priorizamos Bruno Castillo (tiene plazo fijo, comisiones y solicitud pendiente)
            var pref = trabs.filter(function (t) { return /bruno/i.test(t.nombre); })[0] || trabs[0];
            portalTrabId = pref.id;
            return pref;
        }

        function dibujarMiPortal() {
            asegurarSolicitudes();
            var est = ctx.getEstado();
            if (!est) return;
            var t = trabajadorPortal();
            var emp = est.empresa || {};
            if (!t) {
                $('portal-trab-saludo').textContent = 'Sin trabajadores activos';
                $('portal-trab-cargo').textContent = 'Agrega primero una persona en Trabajadores para previsualizar Mi Portal.';
                return;
            }

            var selWrap = $('portal-demo-switcher');
            var selEl = $('portal-demo-trab-sel');
            var trabs = (est.trabajadores || []).filter(function (x) { return x.activo !== false; });
            if (selWrap && selEl) {
                selWrap.hidden = trabs.length <= 1;
                selEl.innerHTML = trabs.map(function (x) {
                    return '<option value="' + esc(x.id) + '">' + esc(x.nombre) + ' (' + esc(x.cargo || 'Equipo') + ')</option>';
                }).join('');
                selEl.value = t.id;
            }

            var contratoTxt = t.contrato === 'plazo_fijo' && t.fechaTerminoPlazo
                ? 'Contrato a plazo fijo (hasta ' + fechaCorta(t.fechaTerminoPlazo) + ')'
                : (t.contrato === 'plazo_fijo' ? 'Contrato a plazo fijo' : 'Contrato indefinido');
            $('portal-trab-saludo').textContent = 'Hola, ' + t.nombre;
            $('portal-trab-cargo').textContent = (t.cargo || 'Colaborador') + ' en ' + (emp.razonSocial || 'tu empresa') + ' · ' + contratoTxt;

            var pActual = ctx.getPeriodo();
            var pAnt = ctx.mesAnteriorDe(pActual);
            var regActual = ctx.getMesTrabajador(pActual, t.id);
            var regAnt = ctx.getMesTrabajador(pAnt, t.id);
            var regMostrar = (regActual && regActual.calculo) ? { p: pActual, reg: regActual } : (regAnt && regAnt.calculo) ? { p: pAnt, reg: regAnt } : null;

            if (regMostrar) {
                $('portal-liq-label').textContent = 'Sueldo líquido (' + ctx.nombrePeriodo(regMostrar.p) + ')';
                $('portal-liq-monto').textContent = pesos(regMostrar.reg.calculo.liquido || 0);
                $('portal-liq-meta').textContent = (regMostrar.reg.emitida ? 'Emitida' : 'Preparada') + (t.banco ? ' · ' + t.banco : '');
                $('btn-portal-descargar-liq').disabled = false;
                $('btn-portal-descargar-liq').setAttribute('data-periodo-liq', regMostrar.p);
            } else {
                $('portal-liq-label').textContent = 'Última liquidación';
                $('portal-liq-monto').textContent = 'Pendiente';
                $('portal-liq-meta').textContent = 'Tu empleador aún no prepara este período';
                $('btn-portal-descargar-liq').disabled = true;
                if (pAnt && ctx.asegurarMesesPeriodo && !cargandoPeriodos[pAnt]) {
                    cargandoPeriodos[pAnt] = true;
                    ctx.asegurarMesesPeriodo(pAnt).then(function () {
                        dibujarMiPortal();
                    });
                }
            }

            var vacRes = root.CLPymeVacaciones && t.fechaIngreso
                ? root.CLPymeVacaciones.resumen(t, ctx.getVacCache().filter(function (v) { return v.trabajadorId === t.id; }), ctx.hoyIso())
                : { saldo: 0, derecho: { anios: 0 } };
            $('portal-vac-saldo').textContent = t.fechaIngreso ? (vacRes.saldo + ' días') : 'Por calcular';
            $('portal-vac-meta').textContent = vacRes.derecho && vacRes.derecho.anios === 0
                ? 'Feriado proporcional acumulado desde tu ingreso'
                : 'Días hábiles legales disponibles (Arts. 67–69 CT)';

            var heMes = Number(regActual && regActual.horasExtra) || 0;
            var heMonto = calcularMontoHorasExtra(t.sueldoBase, t.jornadaHoras || 42, heMes);
            $('portal-he-total').textContent = heMes + ' horas';
            $('portal-he-meta').textContent = heMes > 0
                ? 'Recargo 50% legal (+' + pesos(heMonto) + ' en liquidación)'
                : 'Sin horas extra imputadas en ' + ctx.nombrePeriodo(pActual);

            var mias = solicitudes.filter(function (s) { return s.trabajadorId === t.id; });
            var solCont = $('portal-solicitudes-filas');
            if (!mias.length) {
                solCont.innerHTML = '<div class="revisar-hoy-vacio"><span class="material-icons" aria-hidden="true">event_available</span><p>No tienes solicitudes pendientes ni enviadas este mes.</p></div>';
            } else {
                solCont.innerHTML = mias.map(function (s) {
                    var chipClase = s.estado === 'aprobada' ? 'sello-emitida' : s.estado === 'rechazada' ? 'sello-riesgo' : 'sello-preparada';
                    var chipTxt = s.estado === 'aprobada' ? 'Aprobada' : s.estado === 'rechazada' ? 'Rechazada' : 'En revisión';
                    var ico = s.tipo === 'horas_extra' ? 'more_time' : 'beach_access';
                    var titulo = s.tipo === 'horas_extra'
                        ? ('Horas extras: ' + s.horas + ' hrs al 50% (' + fechaCorta(s.fecha) + ')')
                        : ((s.tipo === 'permiso' ? 'Permiso: ' : 'Vacaciones: ') + s.dias + ' días hábiles (' + fechaCorta(s.desde) + ' al ' + fechaCorta(s.hasta) + ')');
                    var sub = 'Solicitada el ' + fechaCorta(s.fechaSolicitud) + (s.nota ? ' · ' + s.nota : '');
                    if (s.estado === 'rechazada' && s.motivoRechazo) sub += ' · Motivo: ' + s.motivoRechazo;
                    return '<div class="revisar-item ' + (s.estado === 'aprobada' ? 'ok' : s.estado === 'rechazada' ? 'riesgo' : 'aviso') + '">' +
                        '<div class="revisar-item-info"><strong><span class="material-icons portal-sol-ico" aria-hidden="true">' + ico + '</span>' + esc(titulo) + '</strong><span>' + esc(sub) + '</span></div>' +
                        '<div class="revisar-item-der"><span class="sello ' + chipClase + '">' + esc(chipTxt) + '</span></div></div>';
                }).join('');
            }

            var docs = [
                { doc: 'Contrato de trabajo (' + (t.contrato === 'plazo_fijo' ? 'plazo fijo' : 'indefinido') + ')', fecha: fechaCorta(t.fechaIngreso || ctx.hoyIso()), ok: true, label: 'Vigente', tipoDoc: 'contrato' },
                { doc: 'Anexo adecuación Ley 40 Horas (' + (t.jornadaHoras || 42) + ' hrs semanales)', fecha: fechaCorta(t.anexoDatosEntrega || '2026-04-26'), ok: true, label: 'Firmado', tipoDoc: 'anexo_40h' },
                { doc: 'Constancia Protocolo Ley Karin', fecha: t.karinEntrega ? fechaCorta(t.karinEntrega) : 'Pendiente', ok: !!t.karinEntrega, label: t.karinEntrega ? 'Recibido' : 'Por entregar', tipoDoc: 'karin' }
            ];
            $('portal-docs-filas').innerHTML = docs.map(function (d) {
                return '<tr><td><strong>' + esc(d.doc) + '</strong></td><td class="fecha">' + esc(d.fecha) + '</td>' +
                    '<td><span class="sello ' + (d.ok ? 'sello-emitida' : 'sello-preparada') + '">' + esc(d.label) + '</span></td>' +
                    '<td class="celda-acciones"><button type="button" class="btn-texto" data-portal-doc="' + esc(d.tipoDoc) + '"><span class="material-icons" aria-hidden="true">description</span>Ver</button></td></tr>';
            }).join('');
        }

        function abrirFormPortal(tipo) {
            tipoFormPortal = tipo === 'horas_extra' ? 'horas_extra' : 'vacaciones';
            var box = $('portal-solicitud-box');
            if (!box) return;
            box.hidden = false;
            $('portal-sol-titulo').textContent = tipoFormPortal === 'horas_extra' ? 'Registrar horas extras realizadas' : 'Solicitar vacaciones o permiso';
            $('portal-sol-vac-campos').hidden = tipoFormPortal === 'horas_extra';
            $('portal-sol-he-campos').hidden = tipoFormPortal !== 'horas_extra';
            var hoy = ctx.hoyIso();
            if (tipoFormPortal === 'horas_extra') {
                $('portal-sol-fecha-he').value = hoy;
                $('portal-sol-horas').value = '2';
            } else {
                $('portal-sol-desde').value = sumarDias(hoy, 7);
                $('portal-sol-hasta').value = sumarDias(hoy, 9);
            }
            $('portal-sol-nota').value = '';
            $('portal-sol-estado').textContent = '';
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function dibujarAprobaciones() {
            asegurarSolicitudes();
            var panel = $('panel-aprobaciones-equipo');
            if (!panel) return;
            var est = ctx.getEstado();
            if (!est || !(est.trabajadores || []).length) {
                panel.hidden = true;
                return;
            }
            var pendientes = solicitudes.filter(function (s) { return s.estado === 'pendiente'; });
            panel.hidden = false;
            $('aprob-pendientes-n').textContent = pendientes.length + (pendientes.length === 1 ? ' pendiente' : ' pendientes');

            if (!pendientes.length) {
                $('aprobaciones-grid').innerHTML = '<div class="revisar-hoy-vacio aprobaciones-vacio"><span class="material-icons" aria-hidden="true">check_circle</span><p>Todas las solicitudes del equipo están resueltas.</p></div>';
                return;
            }

            $('aprobaciones-grid').innerHTML = pendientes.map(function (s) {
                var t = (est.trabajadores || []).filter(function (x) { return x.id === s.trabajadorId; })[0];
                var isHe = s.tipo === 'horas_extra';
                var ico = isHe ? 'more_time' : 'beach_access';
                var badge = isHe ? 'Horas extras 50%' : (s.tipo === 'permiso' ? 'Permiso' : 'Vacaciones legales');
                var detalleFecha = isHe
                    ? ('<strong>' + s.horas + ' horas extra al 50%</strong>: ' + fechaCorta(s.fecha) + (s.nota ? ' (' + esc(s.nota) + ')' : ''))
                    : ('<strong>' + s.dias + ' días hábiles</strong>: del ' + fechaCorta(s.desde) + ' al ' + fechaCorta(s.hasta) + (s.nota ? ' (' + esc(s.nota) + ')' : ''));

                var impactoTxt = '';
                if (isHe && t) {
                    var montoHe = calcularMontoHorasExtra(t.sueldoBase, t.jornadaHoras || 42, s.horas);
                    impactoTxt = 'Suma <strong>+' + pesos(montoHe) + '</strong> imponible en liquidación de ' + esc(ctx.nombrePeriodo(ctx.getPeriodo())) + '. Se integra a Previred y cód. 1007 del LRE.';
                } else if (t && root.CLPymeVacaciones && t.fechaIngreso) {
                    var res = root.CLPymeVacaciones.resumen(t, ctx.getVacCache().filter(function (v) { return v.trabajadorId === t.id; }), ctx.hoyIso());
                    var nuevoSaldo = res.saldo - (Number(s.dias) || 0);
                    impactoTxt = 'Saldo actual: <strong>' + res.saldo + ' días</strong> → quedará en <strong>' + nuevoSaldo + ' días</strong>. Emite comprobante legal Art. 67 CT y no descuenta sueldo.';
                } else {
                    impactoTxt = 'Se descuenta del registro del colaborador y queda respaldo con fecha.';
                }

                return '<article class="aprobacion-card" data-sol-id="' + esc(s.id) + '">' +
                    '<div class="aprobacion-top">' +
                    '<span class="material-icons aprobacion-ico ' + (isHe ? 'he' : 'vac') + '" aria-hidden="true">' + ico + '</span>' +
                    '<div class="aprobacion-titular"><strong>' + esc(s.nombre) + '</strong><span class="aprobacion-cargo">' + esc(s.cargo) + '</span></div>' +
                    '<span class="sello ' + (isHe ? 'sello-emitida' : 'sello-preparada') + '">' + esc(badge) + '</span>' +
                    '</div>' +
                    '<div class="aprobacion-detalle"><p class="aprobacion-fechas">' + detalleFecha + '</p>' +
                    '<div class="aprobacion-impacto"><span class="material-icons" aria-hidden="true">' + (isHe ? 'receipt_long' : 'info') + '</span><p>' + impactoTxt + '</p></div>' +
                    '</div>' +
                    '<div class="aprobacion-acciones">' +
                    '<button type="button" class="btn btn-chico btn-primario" data-aprob-accion="aprobar" data-sol-id="' + esc(s.id) + '"><span class="material-icons" aria-hidden="true">check</span><span>' + (isHe ? 'Aprobar e imputar a sueldo' : 'Aprobar y registrar') + '</span></button>' +
                    '<button type="button" class="btn-texto lq-danger" data-aprob-accion="rechazar" data-sol-id="' + esc(s.id) + '">Rechazar</button>' +
                    '</div></article>';
            }).join('');
        }

        function dibujarKpisYOrganigrama() {
            asegurarSolicitudes();
            var est = ctx.getEstado();
            if (!est) return;
            var lista = est.trabajadores || [];
            var kpisEl = $('trab-equipo-kpis');
            var tabsEl = $('trab-subtabs');
            var orgWrap = $('vista-organigrama-wrap');
            var trabPanel = $('trab-panel');
            if (!lista.length) {
                if (kpisEl) kpisEl.hidden = true;
                if (tabsEl) tabsEl.hidden = true;
                if (orgWrap) orgWrap.hidden = true;
                return;
            }
            if (kpisEl) {
                kpisEl.hidden = false;
                var k = resumenEquipoKpis({
                    trabajadores: lista,
                    vacCache: ctx.getVacCache(),
                    hoy: ctx.hoyIso(),
                    solicitudes: solicitudes
                });
                kpisEl.innerHTML =
                    '<div class="fin-kpi"><span class="fin-kpi-label">Colaboradores activos</span><strong class="fin-kpi-val mono">' + k.activos + '</strong><span class="fin-kpi-meta">' + k.indefinidos + ' indefinidos · ' + k.plazoFijo + ' plazo fijo</span></div>' +
                    '<div class="fin-kpi"><span class="fin-kpi-label">Ausentes hoy</span><strong class="fin-kpi-val mono">' + k.ausentesHoy + '</strong><span class="fin-kpi-meta">' + esc(k.ausentesDetalle[0] || 'Equipo completo disponible') + '</span></div>' +
                    '<div class="fin-kpi' + (k.plazosPorVencer > 0 ? ' fin-kpi-destacado riesgo' : '') + '"><span class="fin-kpi-label">Plazos fijos (30 días)</span><strong class="fin-kpi-val mono' + (k.plazosPorVencer > 0 ? ' riesgo' : '') + '">' + k.plazosPorVencer + '</strong><span class="fin-kpi-meta">' + esc(k.porVencerLista[0] ? ('Vence en ' + k.porVencerLista[0].dias + ' d: ' + k.porVencerLista[0].nombre) : 'Sin vencimientos próximos') + '</span></div>' +
                    '<div class="fin-kpi fin-kpi-destacado"><span class="fin-kpi-label">Solicitudes por revisar</span><strong class="fin-kpi-val mono ok">' + k.solicitudesPendientes + '</strong><span class="fin-kpi-meta">' + k.pendientesVac + ' permiso/vac · ' + k.pendientesHe + ' horas extra</span></div>';
            }

            if (tabsEl) {
                tabsEl.hidden = false;
                $('tab-trab-lista').classList.toggle('activo', tabTrab === 'lista');
                $('tab-trab-lista').setAttribute('aria-selected', tabTrab === 'lista' ? 'true' : 'false');
                $('tab-trab-lista-txt').textContent = 'Fichas y lista (' + lista.length + ')';
                $('tab-trab-organigrama').classList.toggle('activo', tabTrab === 'organigrama');
                $('tab-trab-organigrama').setAttribute('aria-selected', tabTrab === 'organigrama' ? 'true' : 'false');
            }
            if (trabPanel) trabPanel.hidden = tabTrab !== 'lista';
            if (orgWrap) {
                orgWrap.hidden = tabTrab !== 'organigrama';
                if (tabTrab === 'organigrama') {
                    var org = construirOrganigrama({
                        empresa: est.empresa,
                        trabajadores: lista,
                        vacCache: ctx.getVacCache(),
                        hoy: ctx.hoyIso()
                    });
                    orgWrap.innerHTML =
                        '<div class="org-nivel-gerencia"><div class="org-card org-card-lider">' +
                        '<div class="org-avatar">' + esc(org.lider.iniciales) + '</div>' +
                        '<div class="org-datos"><span class="org-rol-tag">Dirección General</span><strong>' + esc(org.lider.nombre) + '</strong><span>' + esc(org.lider.cargo) + '</span></div>' +
                        '</div></div>' +
                        '<div class="org-conector-vertical" aria-hidden="true"></div>' +
                        '<div class="org-areas-grid">' +
                        org.areas.map(function (a) {
                            return '<div class="org-area-columna"><div class="org-area-cabecera">' +
                                '<span class="material-icons" aria-hidden="true">' + esc(a.icono) + '</span>' +
                                '<div><h3>' + esc(a.nombre) + '</h3><span class="org-area-count">' + a.cantidad + (a.cantidad === 1 ? ' persona' : ' personas') + '</span></div></div>' +
                                '<div class="org-area-miembros">' +
                                a.miembros.map(function (m) {
                                    return '<button type="button" class="org-card org-card-btn' + (m.alerta ? ' alerta' : '') + '" data-org-trab="' + esc(m.id) + '">' +
                                        '<div class="org-avatar">' + esc(m.iniciales) + '</div>' +
                                        '<div class="org-datos"><strong>' + esc(m.nombre) + '</strong><span>' + esc(m.cargo) + ' · ' + esc(m.contratoTexto) + '</span>' +
                                        '<span class="sello ' + esc(m.estado.clase) + '">' + esc(m.estado.texto) + '</span></div></button>';
                                }).join('') +
                                '</div></div>';
                        }).join('') +
                        '</div>';
                }
            }
        }

        function dibujarNovedadesCierre() {
            var widget = $('ini-novedades-widget');
            if (!widget) return;
            var est = ctx.getEstado();
            if (!est || !est.empresa || !(est.trabajadores || []).length) {
                widget.hidden = true;
                return;
            }
            var items = novedadesDelMesResumen({
                trabajadores: est.trabajadores || [],
                mesesPeriodo: ctx.getMesesPeriodo(ctx.getPeriodo()),
                vacCache: ctx.getVacCache(),
                periodo: ctx.getPeriodo()
            });
            widget.hidden = !items.length;
            if (!items.length) return;
            $('ini-novedades-grid').innerHTML = items.map(function (it) {
                return '<div class="novedad-chip-item ' + esc(it.clase) + '">' +
                    '<span class="material-icons" aria-hidden="true">' + esc(it.icono) + '</span>' +
                    '<div><strong>' + esc(it.trabajador) + '</strong>: ' + esc(it.texto) + '</div>' +
                    '</div>';
            }).join('');
        }

        if ($('portal-demo-trab-sel')) {
            $('portal-demo-trab-sel').addEventListener('change', function (e) {
                portalTrabId = e.target.value;
                dibujarMiPortal();
            });
        }
        if ($('btn-portal-descargar-liq')) {
            $('btn-portal-descargar-liq').addEventListener('click', function () {
                var t = trabajadorPortal();
                var p = $('btn-portal-descargar-liq').getAttribute('data-periodo-liq') || ctx.getPeriodo();
                if (t) ctx.imprimirLiquidacionTrabajador(t, p);
            });
        }
        if ($('btn-portal-pedir-vac')) {
            $('btn-portal-pedir-vac').addEventListener('click', function () { abrirFormPortal('vacaciones'); });
        }
        if ($('btn-portal-pedir-he')) {
            $('btn-portal-pedir-he').addEventListener('click', function () { abrirFormPortal('horas_extra'); });
        }
        if ($('portal-sol-cancelar')) {
            $('portal-sol-cancelar').addEventListener('click', function () {
                if ($('portal-solicitud-box')) $('portal-solicitud-box').hidden = true;
            });
        }
        if ($('portal-solicitud-form')) {
            $('portal-solicitud-form').addEventListener('submit', function (e) {
                e.preventDefault();
                asegurarSolicitudes();
                var t = trabajadorPortal();
                if (!t) return;
                var nota = ($('portal-sol-nota').value || '').trim();
                var nueva = null;
                if (tipoFormPortal === 'horas_extra') {
                    var fecha = $('portal-sol-fecha-he').value;
                    var horas = parseFloat($('portal-sol-horas').value) || 0;
                    if (!fecha || horas <= 0 || horas > 48) {
                        $('portal-sol-estado').textContent = 'Ingresa una fecha y cantidad de horas válida (1 a 48).';
                        return;
                    }
                    nueva = {
                        id: 'sol-he-' + Date.now(),
                        trabajadorId: t.id,
                        nombre: t.nombre,
                        cargo: t.cargo || 'Colaborador',
                        tipo: 'horas_extra',
                        fecha: fecha,
                        horas: horas,
                        nota: nota || 'Solicitud enviada desde Mi Portal',
                        fechaSolicitud: ctx.hoyIso(),
                        estado: 'pendiente'
                    };
                } else {
                    var desde = $('portal-sol-desde').value;
                    var hasta = $('portal-sol-hasta').value;
                    if (!desde || !hasta || hasta < desde) {
                        $('portal-sol-estado').textContent = 'Revisa las fechas de inicio y término.';
                        return;
                    }
                    var dh = contarDiasHabilesSimple(desde, hasta, root.CLFeriadosCL, root.CLPymeVacaciones) || 1;
                    nueva = {
                        id: 'sol-vac-' + Date.now(),
                        trabajadorId: t.id,
                        nombre: t.nombre,
                        cargo: t.cargo || 'Colaborador',
                        tipo: 'vacaciones',
                        desde: desde,
                        hasta: hasta,
                        dias: dh,
                        nota: nota || 'Solicitud enviada desde Mi Portal',
                        fechaSolicitud: ctx.hoyIso(),
                        estado: 'pendiente'
                    };
                }
                solicitudes.unshift(nueva);
                $('portal-solicitud-box').hidden = true;
                dibujarMiPortal();
                ctx.avisoGlobal('ok', 'Solicitud enviada. Cambia a Dueño Pyme > Vacaciones y permisos para aprobarla en 1 clic.');
            });
        }
        if ($('portal-docs-filas')) {
            $('portal-docs-filas').addEventListener('click', function (e) {
                var btn = e.target.closest('[data-portal-doc]');
                if (!btn) return;
                var t = trabajadorPortal();
                if (!t) return;
                ctx.navegar('documentos', { query: 't=' + encodeURIComponent(t.id) + '&d=' + encodeURIComponent(btn.getAttribute('data-portal-doc')) });
            });
        }

        if ($('panel-aprobaciones-equipo')) {
            $('panel-aprobaciones-equipo').addEventListener('click', function (e) {
                var btn = e.target.closest('[data-aprob-accion]');
                if (!btn) return;
                var accion = btn.getAttribute('data-aprob-accion');
                var id = btn.getAttribute('data-sol-id');
                var sol = solicitudes.filter(function (s) { return s.id === id; })[0];
                if (!sol) return;
                if (accion === 'rechazar') {
                    ctx.confirmar('¿Rechazar esta solicitud de ' + sol.nombre + '?', 'El colaborador verá el rechazo en su portal y no se aplicarán cambios en sus días ni en su liquidación.', 'Rechazar solicitud').then(function (ok) {
                        if (!ok) return;
                        solicitudes = rechazarSolicitudEnLista(solicitudes, id, 'No autorizada para este período');
                        dibujarAprobaciones();
                        dibujarKpisYOrganigrama();
                        ctx.avisoGlobal('ok', 'Solicitud de ' + sol.nombre + ' rechazada.');
                    });
                    return;
                }
                btn.disabled = true;
                var p = sol.tipo === 'horas_extra'
                    ? ctx.imputarHorasExtraTrabajador(sol.trabajadorId, sol.horas)
                    : ctx.registrarVacacionAprobada(sol.trabajadorId, sol);
                Promise.resolve(p).then(function (ok) {
                    if (ok === false) { btn.disabled = false; return; }
                    solicitudes = aprobarSolicitudEnLista(solicitudes, id);
                    dibujarAprobaciones();
                    dibujarKpisYOrganigrama();
                    dibujarNovedadesCierre();
                }).catch(function () {
                    btn.disabled = false;
                });
            });
        }

        if ($('tab-trab-lista')) {
            $('tab-trab-lista').addEventListener('click', function () {
                tabTrab = 'lista';
                dibujarKpisYOrganigrama();
            });
        }
        if ($('tab-trab-organigrama')) {
            $('tab-trab-organigrama').addEventListener('click', function () {
                tabTrab = 'organigrama';
                dibujarKpisYOrganigrama();
            });
        }
        if ($('vista-organigrama-wrap')) {
            $('vista-organigrama-wrap').addEventListener('click', function (e) {
                var card = e.target.closest('[data-org-trab]');
                if (card) ctx.navegar('trabajadores/' + card.getAttribute('data-org-trab'));
            });
        }

        return {
            dibujarMiPortal: dibujarMiPortal,
            dibujarAprobaciones: dibujarAprobaciones,
            dibujarKpisYOrganigrama: dibujarKpisYOrganigrama,
            dibujarNovedadesCierre: dibujarNovedadesCierre,
            limpiarEjemplo: function () { sembradoParaEmpresa = null; solicitudes = []; portalTrabId = null; tabTrab = 'lista'; cargandoPeriodos = {}; }
        };
    }

    var api = {
        clasificarAreaTrabajador: clasificarAreaTrabajador,
        calcularMontoHorasExtra: calcularMontoHorasExtra,
        resumenEquipoKpis: resumenEquipoKpis,
        construirOrganigrama: construirOrganigrama,
        novedadesDelMesResumen: novedadesDelMesResumen,
        crearSolicitudesIniciales: crearSolicitudesIniciales,
        aprobarSolicitudEnLista: aprobarSolicitudEnLista,
        rechazarSolicitudEnLista: rechazarSolicitudEnLista,
        montarUI: montarUI,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CLPymeEquipoUI = api;
})(typeof window !== 'undefined' ? window : this);
