/*
 * CalculoLaboral · Pack Asesora del Hogar al día (v1.0.0)
 * Genera en un flujo:
 *   1) Contrato individual de trabajadora de casa particular (Puertas Afuera / Puertas Adentro, Arts. 146-152 CT)
 *   2) 1a Liquidación de Sueldo (0% AFC trabajadora Ley 21.269, sin gratificación obligatoria Art. 47 CT)
 *   3) Costo Patronal Previred (1,11% tope 60 UF + 3,0% AFC tope 135,2 UF + 3,50% Ley 21.735 + 0,93% ISL tope 90 UF)
 *   4) Ficha de Puesta al Día (Mi DT 15 días corridos Art. 146 ter, Previred día 13, exención LRE <5 Art. 62 CT)
 *
 * Depende en navegador de: CLLiquidacionParametros, CLLiquidacionEngine, CLLiquidacionDocumento,
 * CLPrint, FiniquitoDocx y CLCheckout. También exporta helpers puros en Node para pruebas.
 */
(function (root, doc) {
    'use strict';

    var STORAGE_KEY = 'cl_casa_hogar_pack_v1';
    var MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var IMM_MAYOR = 553553;
    var IMM_MENOR_O_65 = 412938;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pesos(n) {
        return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
    }

    function num(v) {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        var s = String(v == null ? '' : v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
        var x = parseFloat(s);
        return isFinite(x) ? x : 0;
    }

    function numDecimal(v) {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        var s = String(v == null ? '' : v).trim().replace(',', '.');
        var x = parseFloat(s);
        return isFinite(x) ? x : 0;
    }

    function fechaLarga(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '___ de _________ de 2026';
        var p = iso.split('-');
        return Number(p[2]) + ' de ' + MESES_ES[Number(p[1]) - 1] + ' de ' + p[0];
    }

    function limpiarRut(v) {
        return String(v || '').toUpperCase().replace(/[^0-9K]/g, '');
    }

    function validarRut(rut) {
        var c = limpiarRut(rut);
        if (c.length < 7 || c.length > 9) return false;
        var cuerpo = c.slice(0, -1);
        var dv = c.slice(-1);
        if (!/^\d+$/.test(cuerpo)) return false;
        var suma = 0;
        var mult = 2;
        for (var i = cuerpo.length - 1; i >= 0; i--) {
            suma += Number(cuerpo[i]) * mult;
            mult = mult === 7 ? 2 : mult + 1;
        }
        var res = 11 - (suma % 11);
        var esperado = res === 11 ? '0' : res === 10 ? 'K' : String(res);
        return dv === esperado;
    }

    function formatoRut(rut) {
        var c = limpiarRut(rut);
        if (c.length < 2) return String(rut || '').trim();
        return c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + c.slice(-1);
    }

    function getParametros() {
        if (root.CLLiquidacionParametros) return root.CLLiquidacionParametros;
        if (typeof require === 'function') return require('./liquidacion_parametros.js');
        return null;
    }

    function getEngine() {
        if (root.CLLiquidacionEngine) return root.CLLiquidacionEngine;
        if (typeof require === 'function') return require('./liquidacion_engine.js');
        return null;
    }

    function getDocumento() {
        if (root.CLLiquidacionDocumento) return root.CLLiquidacionDocumento;
        if (typeof require === 'function') return require('./liquidacion_documento.js');
        return null;
    }

    function mesFallback(periodo) {
        var P = getParametros();
        var per = periodo || '2026-11';
        var vig = P && P.vigenciaDe ? P.vigenciaDe(per) : {
            uf: 41439.89,
            utm: 72440,
            imm: IMM_MAYOR,
            topeAfpUF: 90,
            topeAfcUF: 135.2,
            jornadaMaxima: 42,
            afp: { Modelo: 0.1058 },
            empleador: { afp: 0.001, seguroSocial: 0.0161, seguroSocialDetalle: 'rentabilidad protegida 0,9% y expectativa de vida 0,71%', sis: 0.0179 }
        };
        var resp = (P && P.RESPALDO && P.RESPALDO[per]) ? P.RESPALDO[per] : { uf: 41439.89, utm: 72440 };
        return Object.assign({}, vig, {
            uf: resp.uf || vig.uf || 41439.89,
            utm: resp.utm || vig.utm || 72440,
            afp: (P && P.AFP_2026) ? P.AFP_2026 : vig.afp
        });
    }

    function calcularPack(datos, mesOverride) {
        var eng = getEngine();
        if (!eng) throw new Error('Falta CLLiquidacionEngine');
        var d = datos || {};
        var periodo = d.periodo || '2026-11';
        var mes = mesOverride || mesFallback(periodo);
        var modalidad = d.modalidad === 'puertas_adentro' ? 'puertas_adentro' : 'puertas_afuera';
        var sueldoBase = Math.max(0, Math.round(num(d.sueldoBase)));
        var colacion = Math.max(0, Math.round(num(d.colacion)));
        var movilizacion = Math.max(0, Math.round(num(d.movilizacion)));
        var bonoVoluntario = d.gratificacionPactada ? Math.max(0, Math.round(num(d.gratificacionMonto))) : 0;
        var horas = modalidad === 'puertas_adentro' ? 42 : Math.min(42, Math.max(1, numDecimal(d.horasSemana) || 42));
        var dias = Math.min(30, Math.max(1, Math.round(num(d.diasTrabajados) || 30)));

        var entrada = {
            periodo: periodo,
            tasaMutual: numDecimal(d.tasaMutual) || 0.93,
            trabajador: {
                nombre: d.trabNombre || 'María Elena Pérez Soto',
                rut: d.trabRut || '',
                cargo: 'Trabajadora de Casa Particular (' + (modalidad === 'puertas_adentro' ? 'Puertas Adentro' : 'Puertas Afuera') + ')',
                sueldoBase: sueldoBase,
                colacion: colacion,
                movilizacion: movilizacion,
                afp: d.afp || 'Modelo',
                salud: d.salud === 'isapre' ? 'isapre' : 'fonasa',
                isapreNombre: d.isapreNombre || '',
                isaprePlanUF: numDecimal(d.isaprePlanUF),
                contrato: d.contratoTipo === 'plazo_fijo' ? 'plazo_fijo' : 'indefinido',
                jornadaHoras: horas,
                fechaIngreso: d.fechaIngreso || '',
                fechaNacimiento: d.trabFechaNac || '',
                casaParticular: true,
                modalidadCasa: modalidad
            },
            mes: {
                diasTrabajados: dias,
                gratificacion: bonoVoluntario > 0 ? 'manual' : 'no',
                gratificacionMonto: bonoVoluntario
            }
        };

        var res = eng.calcular(entrada, mes);
        var immRef = d.edadImm === 'especial' ? IMM_MENOR_O_65 : (mes.imm || IMM_MAYOR);
        var minimoJornada = (modalidad === 'puertas_afuera' && horas <= 30)
            ? Math.round(immRef * horas / (mes.jornadaMaxima || 42))
            : immRef;
        var bajoMinimo = sueldoBase > 0 && sueldoBase < minimoJornada;

        return {
            entrada: entrada,
            mes: mes,
            res: res,
            immRef: immRef,
            minimoJornada: minimoJornada,
            bajoMinimo: bajoMinimo
        };
    }

    function generarContratoHtml(d, calc) {
        var modalidad = d.modalidad === 'puertas_adentro' ? 'puertas_adentro' : 'puertas_afuera';
        var esPlazo = d.contratoTipo === 'plazo_fijo';
        var ciudad = esc((d.ciudad || 'Santiago').trim() || 'Santiago');
        var fechaTexto = fechaLarga(d.fechaFirma || d.fechaIngreso);
        var ingresoTexto = fechaLarga(d.fechaIngreso);
        var empNombre = esc((d.empNombre || '').trim() || '[Nombre completo Empleador/a]');
        var empRut = esc(d.empRut ? formatoRut(d.empRut) : '[XX.XXX.XXX-X]');
        var empDomicilio = esc((d.empDomicilio || '').trim() || '[Domicilio particular del hogar]');
        var trabNombre = esc((d.trabNombre || '').trim() || '[Nombre completo Trabajador/a]');
        var trabRut = esc(d.trabRut ? formatoRut(d.trabRut) : '[XX.XXX.XXX-X]');
        var trabNac = esc((d.trabNacionalidad || 'Chilena').trim());
        var trabEc = esc((d.trabEstadoCivil || 'Soltera').trim());
        var trabFechaNac = d.trabFechaNac ? fechaLarga(d.trabFechaNac) : '[DD de MMMM de AAAA]';
        var trabDom = esc((d.trabDomicilio || '').trim() || '[Domicilio del/de la Trabajador/a]');
        var funciones = esc((d.trabFunciones || '').trim() || 'Aseo general del hogar, lavado y planchado de ropa, preparación de alimentos y orden doméstico.');
        var lugarServ = esc((d.lugarServicios || d.empDomicilio || '').trim() || '[Domicilio del hogar empleador]');

        var horasSemana = Math.min(42, Math.max(1, numDecimal(d.horasSemana) || 42));
        var diasSemana = esc(d.diasSemana || '5');
        var colacionMin = Math.max(30, Math.round(num(d.colacionMin) || 60));
        var horarioDetalle = esc((d.horarioDetalle || '').trim() || 'Lunes a viernes de 08:30 a 17:24 horas, con ' + colacionMin + ' minutos diarios imputables a colación.');
        var sueldoBase = Math.max(0, Math.round(num(d.sueldoBase)));
        var afp = esc(d.afp || 'Modelo');
        var saludTexto = d.salud === 'isapre'
            ? ('Isapre ' + esc((d.isapreNombre || '').trim() || 'indicada por la trabajadora') + (numDecimal(d.isaprePlanUF) ? ' (plan pactado ' + numDecimal(d.isaprePlanUF).toLocaleString('es-CL') + ' UF)' : ''))
            : 'FONASA (cotización legal obligatoria del 7%)';

        var clausulaJornada = '';
        if (modalidad === 'puertas_adentro') {
            clausulaJornada =
                '<p><strong>SEGUNDO (Modalidad puertas adentro, jornada y descansos):</strong> La trabajadora prestará sus servicios bajo la modalidad de trabajadora de casa particular puertas adentro, residiendo en el hogar del/de la Empleador/a. Conforme al inciso final del artículo 149 del Código del Trabajo, no estará sujeta a horario fijo ni al tope semanal de 42 horas, teniendo derecho a un descanso absoluto mínimo de doce horas diarias. Entre el término de una jornada diaria y el inicio de la siguiente, el descanso será ininterrumpido y, normalmente, de un mínimo de nueve horas continuas; el exceso podrá fraccionarse durante la jornada e incluirá el lapso destinado a alimentación.</p>' +
                '<p>Conforme al artículo 150 del Código del Trabajo, tendrá derecho a descanso semanal en todos los días sábado, domingo y festivos que correspondan. Asimismo, de acuerdo con la letra d) del artículo 150 del Código del Trabajo, gozará de dos días de libre disposición remunerados por cada mes calendario, los que podrán acumularse de común acuerdo hasta por un período de tres meses y no podrán compensarse en dinero mientras se encuentre vigente el contrato.</p>';
        } else {
            clausulaJornada =
                '<p><strong>SEGUNDO (Modalidad puertas afuera, jornada de 42 horas y descansos):</strong> La trabajadora prestará sus servicios bajo la modalidad de trabajadora de casa particular puertas afuera. Conforme al artículo 149 del Código del Trabajo y la Ley N° 21.561, la jornada ordinaria semanal pactada será de <strong>' + horasSemana + ' horas semanales</strong> (dentro del máximo legal vigente de 42 horas semanales), distribuida en ' + diasSemana + ' días a la semana, en el siguiente horario: ' + horarioDetalle + '.</p>' +
                '<p>En conformidad con el artículo 149 letra e) del Código del Trabajo, el lapso continuo entre el inicio y término de la jornada diaria no podrá exceder de 12 horas, considerando dentro de él tanto la jornada efectiva como el tiempo destinado a descanso y alimentación (mínimo ' + colacionMin + ' minutos). Tendrá derecho a descanso semanal en día domingo y festivos legales (artículo 150 CT).</p>';
            if (horasSemana <= 30 && d.bolsaHoras) {
                clausulaJornada +=
                    '<p><strong>Pacto de bolsa de horas adicionales (Art. 149 letra d CT):</strong> Por tratarse de una jornada parcial no superior a 30 horas semanales, las partes acuerdan que, previa solicitud escrita y acuerdo para cada oportunidad, la trabajadora podrá realizar hasta un máximo de 12 horas semanales adicionales a su jornada ordinaria, no acumulables a otras semanas, las cuales se pagarán con un recargo no inferior al 50% sobre el valor de la hora ordinaria del sueldo convenido.</p>';
            }
        }

        var habitacionTexto = modalidad === 'puertas_adentro'
            ? 'Además, el/la Empleador/a proporcionará a la trabajadora habitación higiénica y alimentación adecuada de su exclusivo cargo, prestaciones que no son imputables al ingreso mínimo mensual ni al sueldo base pactado (artículo 151 del Código del Trabajo).'
            : 'Si el/la Empleador/a otorga alimentación en el hogar durante la jornada, será de su exclusivo cargo y en ningún caso imputable al ingreso mínimo mensual (artículo 151 del Código del Trabajo).';

        var asignaciones = [];
        if (num(d.colacion) > 0) asignaciones.push('asignación de colación mensual no imponible por ' + pesos(num(d.colacion)));
        if (num(d.movilizacion) > 0) asignaciones.push('asignación de movilización mensual no imponible por ' + pesos(num(d.movilizacion)));
        var extraAsig = asignaciones.length ? ' Adicionalmente, recibirá ' + asignaciones.join(' y ') + '.' : '';
        var gratNota = d.gratificacionPactada && num(d.gratificacionMonto) > 0
            ? 'Las partes pactan voluntariamente una asignación mensual imponible a título de bono o gratificación por ' + pesos(num(d.gratificacionMonto)) + '.'
            : 'Por tratarse de un empleador persona natural en labores domésticas del hogar sin fines de lucro, no resulta aplicable la gratificación legal obligatoria del artículo 47 del Código del Trabajo.';

        var clausulaDuracion = esPlazo
            ? 'El presente contrato tendrá duración de <strong>plazo fijo</strong> hasta el <strong>' + fechaLarga(d.fechaTermino) + '</strong>, sin perjuicio de su eventual renovación o transformación en contrato indefinido conforme al artículo 159 N° 4 del Código del Trabajo.'
            : 'El presente contrato tendrá duración <strong>indefinida</strong> a contar de la fecha de ingreso indicada.';
        if (d.periodoPrueba) {
            clausulaDuracion += ' De acuerdo con el artículo 147 del Código del Trabajo, las dos primeras semanas de vigencia se estimarán como período de prueba, pudiendo cualquiera de las partes poner término al contrato durante dicho lapso dando aviso con a lo menos tres días de anticipación y pagándose los días efectivamente trabajados.';
        }

        var tasaMutual = (numDecimal(d.tasaMutual) || 0.93).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return '' +
            '<h2>CONTRATO INDIVIDUAL DE TRABAJO DE TRABAJADORA DE CASA PARTICULAR</h2>' +
            '<div data-docx="recuadro">' +
                '<strong>Lugar y fecha:</strong> ' + ciudad + ', ' + fechaTexto + '<br>' +
                '<strong>Modalidad:</strong> ' + (modalidad === 'puertas_adentro' ? 'Puertas Adentro (Art. 149 inc. final y Art. 150 CT)' : 'Puertas Afuera (' + horasSemana + ' horas semanales, Ley 21.561)') + '<br>' +
                '<strong>Duración:</strong> ' + (esPlazo ? 'Plazo Fijo hasta ' + fechaLarga(d.fechaTermino) : 'Indefinido') + ' · <strong>Fecha de ingreso:</strong> ' + ingresoTexto +
            '</div>' +
            '<p>En ' + ciudad + ', a ' + fechaTexto + ', entre don/doña <strong>' + empNombre + '</strong>, cédula nacional de identidad N° <strong>' + empRut + '</strong>, domiciliado/a en ' + empDomicilio + ', en adelante "el/la Empleador/a"; y don/doña <strong>' + trabNombre + '</strong>, de nacionalidad ' + trabNac + ', cédula nacional de identidad N° <strong>' + trabRut + '</strong>, nacido/a el ' + trabFechaNac + ', estado civil ' + trabEc + ', domiciliado/a en ' + trabDom + ', en adelante "el/la Trabajador/a", se ha convenido el siguiente Contrato Individual de Trabajo de Casa Particular, regido por el Capítulo V del Título II del Libro I del Código del Trabajo (artículos 146 y siguientes):</p>' +
            '<p><strong>PRIMERO (Naturaleza de los servicios y lugar de desempeño):</strong> El/la Trabajador/a se obliga a ejecutar las labores propias de asistencia, aseo y atención del hogar particular del/de la Empleador/a, sin fines de lucro, en el domicilio ubicado en ' + lugarServ + '. Las funciones específicas comprenderán: ' + funciones + '</p>' +
            clausulaJornada +
            '<p><strong>TERCERO (Remuneración, habitación y alimentación):</strong> El/la Empleador/a pagará al/a la Trabajador/a un sueldo base bruto mensual de <strong>' + pesos(sueldoBase) + '</strong>.' + extraAsig + ' ' + habitacionTexto + ' ' + gratNota + '</p>' +
            '<p>Las remuneraciones se liquidarán y pagarán por períodos mensuales vencidos, a más tardar el ' + esc(d.diaPago || 'último día hábil del mes') + ', mediante ' + esc(d.formaPago || 'transferencia bancaria a cuenta de la trabajadora') + ', entregándose el comprobante escrito exigido por el artículo 54 del Código del Trabajo.</p>' +
            '<p><strong>CUARTO (Cotizaciones previsionales, Seguro de Cesantía e Indemnización a todo evento):</strong> El/la Empleador/a descontará de las remuneraciones imponibles las cotizaciones de AFP (' + afp + ') y Salud (' + saludTexto + '), y declarará y pagará mensualmente en Previred las cotizaciones legales dentro de los 13 días del mes siguiente:</p>' +
            '<p>a) <strong>Seguro de Cesantía (Ley N° 21.269):</strong> La trabajadora no efectúa cotización (0%). El/la Empleador/a aportará el 3,0% de cargo exclusivo (2,2% a cuenta individual CIC y 0,8% a Fondo de Cesantía Solidario FCS), hasta el tope imponible de 135,2 UF.<br>' +
            'b) <strong>Indemnización a todo evento (Art. 163 inc. 5° CT):</strong> El/la Empleador/a aportará mensualmente un 1,11% de la remuneración imponible (tope 60 UF, durante los primeros 11 años) en la AFP correspondiente.<br>' +
            'c) <strong>Reforma de Pensiones (Ley N° 21.735) y Seguro contra Accidentes (Ley N° 16.744 y SANNA):</strong> Aportes de cargo del/de la Empleador/a conforme a tasas vigentes (3,50% Ley 21.735 desde agosto de 2026: 0,10% AFP, 0,90% rentabilidad protegida y 2,50% seguro social que integra 1,79% SIS y 0,71% expectativa de vida; más ' + tasaMutual + '% ISL o mutual, tope 90 UF).</p>' +
            '<p><strong>QUINTO (Duración del contrato y período de prueba):</strong> ' + clausulaDuracion + '</p>' +
            '<p><strong>SEXTO (Fecha de ingreso, confidencialidad del hogar y registro en Mi DT):</strong> Se deja constancia de que la trabajadora ingresó al servicio del/de la Empleador/a con fecha ' + ingresoTexto + '. Ambas partes guardarán reserva respecto de la vida privada del hogar y de los datos personales tratados en él. El presente contrato será registrado por el/la Empleador/a en el portal Mi DT de la Dirección del Trabajo dentro de los quince días corridos siguientes a la celebración del contrato (artículo 146 ter del Código del Trabajo). Se firma en dos ejemplares de idéntico tenor, quedando uno en poder de cada parte.</p>' +
            '<div data-docx="firmas" class="dc-firmas">' +
                '<div><p>' + empNombre + '</p><p>RUT ' + empRut + ' · Empleador/a</p></div>' +
                '<div><p>' + trabNombre + '</p><p>RUT ' + trabRut + ' · Trabajador/a</p></div>' +
            '</div>';
    }

    function generarLiquidacionYFichaHtml(d, calc) {
        var docHelper = getDocumento();
        var res = calc.res;
        var emp = res.empleador;
        var b = res.bases;
        var perLabel = docHelper ? docHelper.capital(docHelper.nombreMes(d.periodo || '2026-11')) : (d.periodo || '2026-11');
        var enPalabras = docHelper ? docHelper.capital(docHelper.enPalabras(res.liquido)) : (pesos(res.liquido));
        var empNombre = esc((d.empNombre || '').trim() || '[Empleador/a]');
        var empRut = esc(d.empRut ? formatoRut(d.empRut) : '[XX.XXX.XXX-X]');
        var trabNombre = esc((d.trabNombre || '').trim() || '[Trabajador/a]');
        var trabRut = esc(d.trabRut ? formatoRut(d.trabRut) : '[XX.XXX.XXX-X]');
        var modalidadLabel = d.modalidad === 'puertas_adentro' ? 'Puertas Adentro (sin horario fijo, Art. 149 inc. final)' : ('Puertas Afuera (' + b.jornada + ' h semanales)');

        var rowsHab = res.haberesImponibles.map(function (l) {
            return '<tr><td>' + esc(l.concepto) + (l.detalle ? ' <span class="pack-det">(' + esc(l.detalle) + ')</span>' : '') + '</td><td class="pack-num">' + pesos(l.monto) + '</td></tr>';
        }).join('');
        var rowsNoImp = res.haberesNoImponibles.map(function (l) {
            return '<tr><td>' + esc(l.concepto) + ' <span class="pack-det">(No imponible)</span></td><td class="pack-num">' + pesos(l.monto) + '</td></tr>';
        }).join('');
        var rowsDesc = res.descuentosLegales.map(function (l) {
            return '<tr><td>' + esc(l.concepto) + (l.detalle ? ' <span class="pack-det">(' + esc(l.detalle) + ')</span>' : '') + '</td><td class="pack-num">' + pesos(l.monto) + '</td></tr>';
        }).join('');
        var rowsEmp = emp ? emp.lineas.map(function (l) {
            return '<tr><td>' + esc(l.concepto) + (l.detalle ? ' <span class="pack-det">(' + esc(l.detalle) + ')</span>' : '') + '</td><td class="pack-num">' + pesos(l.monto) + '</td></tr>';
        }).join('') : '';

        return '' +
            '<div class="pack-page-break">' +
                '<h2>1a LIQUIDACIÓN DE SUELDO · CASA PARTICULAR (ART. 54 CT)</h2>' +
                '<div class="pack-meta-grid">' +
                    '<div><strong>Empleador/a:</strong> ' + empNombre + ' (RUT ' + empRut + ')</div>' +
                    '<div><strong>Período:</strong> ' + esc(perLabel) + ' (' + b.dias + ' días)</div>' +
                    '<div><strong>Trabajadora:</strong> ' + trabNombre + ' (RUT ' + trabRut + ')</div>' +
                    '<div><strong>Modalidad:</strong> ' + esc(modalidadLabel) + '</div>' +
                    '<div><strong>AFP:</strong> ' + esc(d.afp || 'Modelo') + '</div>' +
                    '<div><strong>Salud:</strong> ' + (d.salud === 'isapre' ? esc(d.isapreNombre || 'Isapre') : 'FONASA 7%') + '</div>' +
                '</div>' +
                '<div class="pack-two-cols">' +
                    '<div>' +
                        '<h3>Haberes</h3>' +
                        '<table class="pack-tbl"><tbody>' +
                            rowsHab +
                            '<tr class="pack-sub"><td>Total Imponible</td><td class="pack-num">' + pesos(res.totalImponible) + '</td></tr>' +
                            rowsNoImp +
                            '<tr class="pack-tot"><td>Total Haberes</td><td class="pack-num">' + pesos(res.totalHaberes) + '</td></tr>' +
                        '</tbody></table>' +
                    '</div>' +
                    '<div>' +
                        '<h3>Descuentos Legales Trabajadora</h3>' +
                        '<table class="pack-tbl"><tbody>' +
                            rowsDesc +
                            '<tr class="pack-tot"><td>Total Descuentos</td><td class="pack-num">' + pesos(res.totalDescuentos) + '</td></tr>' +
                        '</tbody></table>' +
                    '</div>' +
                '</div>' +
                '<div class="pack-liquido-box">' +
                    '<div><strong>ALCANCE LÍQUIDO A PAGAR A LA TRABAJADORA</strong><br><small>Son: ' + esc(enPalabras) + '</small></div>' +
                    '<div class="pack-liquido-val">' + pesos(res.liquido) + '</div>' +
                '</div>' +
                '<div class="pack-emp-box">' +
                    '<h3>Desglose Mensual Costo Patronal en Previred (Cargo Empleador)</h3>' +
                    '<table class="pack-tbl"><tbody>' +
                        rowsEmp +
                        '<tr class="pack-sub"><td>Total Cotizaciones Empleador (Previred)</td><td class="pack-num">' + pesos(emp ? emp.total : 0) + '</td></tr>' +
                        '<tr class="pack-tot"><td>Costo Total Mensual del Hogar (Sueldo Bruto + Aportes Empleador)</td><td class="pack-num">' + pesos(emp ? emp.costoTotal : res.totalHaberes) + '</td></tr>' +
                    '</tbody></table>' +
                    '<p class="pack-nota">Valores referenciales con UF ' + calc.mes.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 }) + ' y UTM ' + pesos(calc.mes.utm) + '. Topes aplicados: 60 UF para indemnización 1,11%, 90 UF para AFP/Salud/Ley 21.735/ISL y 135,2 UF para Seguro de Cesantía 3,0%. Trabajadora mayor de 65 años o pensionada cotizante puede tener exención parcial en SIS/Ley 21.735.</p>' +
                '</div>' +
                '<div data-docx="firmas" class="dc-firmas pack-firmas-liq">' +
                    '<div><p>Recibí conforme liquidación y alcance líquido</p><p>' + trabNombre + ' · RUT ' + trabRut + '</p></div>' +
                    '<div><p>Empleador/a</p><p>' + empNombre + ' · RUT ' + empRut + '</p></div>' +
                '</div>' +
            '</div>' +
            '<div class="pack-ficha-box">' +
                '<h3>Ficha de Puesta al Día para Empleadores de Casa Particular (Chile 2026)</h3>' +
                '<ol>' +
                    '<li><strong>Registro en Mi DT (plazo 15 días corridos):</strong> Ingresa con tu ClaveÚnica a <em>midt.dirtrab.cl</em> como empleador persona natural y registra este contrato dentro de los 15 días corridos siguientes a la celebración del contrato (Art. 146 ter CT).</li>' +
                    '<li><strong>Alta y pago mensual en Previred (hasta el día 13):</strong> Crea tu cuenta en Previred en modalidad "Trabajador de Casa Particular". Ahí se genera la planilla con 0% AFC trabajadora, 3,0% AFC empleador, 1,11% indemnización a todo evento en AFP, 3,50% Ley 21.735 y 0,93% ISL. El pago electrónico vence el día 13 del mes siguiente (o el primer día hábil siguiente si cae inhábil).</li>' +
                    '<li><strong>Libro de Remuneraciones Electrónico (LRE):</strong> Si empleas menos de 5 trabajadores (hogar particular), estás exento de la obligación de llevar Libro Auxiliar de Remuneraciones / LRE (Art. 62 del Código del Trabajo). Conserva copias firmadas o comprobantes de transferencia y liquidaciones mensuales.</li>' +
                '</ol>' +
                '<p class="pack-nota">Documento de referencia basado en el Código del Trabajo vigente en Chile y parámetros Previred 2026. No constituye asesoría legal.</p>' +
            '</div>';
    }

    // --- DOM Controller (only runs in browser) ---
    if (typeof window === 'undefined' || !doc || !doc.addEventListener) {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                validarRut: validarRut,
                formatoRut: formatoRut,
                calcularPack: calcularPack,
                generarContratoHtml: generarContratoHtml,
                generarLiquidacionYFichaHtml: generarLiquidacionYFichaHtml
            };
        }
        return;
    }

    var activeTab = 'contrato';
    var unlockedOrder = null;
    var mesActualCache = null;

    function val(id) {
        var el = doc.getElementById(id);
        return el ? el.value : '';
    }
    function chk(id) {
        var el = doc.getElementById(id);
        return !!(el && el.checked);
    }

    function recolectarDatos() {
        var radMod = doc.querySelector('input[name="pack-modalidad"]:checked');
        return {
            modalidad: radMod ? radMod.value : 'puertas_afuera',
            contratoTipo: val('pack-contrato-tipo') || 'indefinido',
            fechaTermino: val('pack-fecha-termino'),
            fechaIngreso: val('pack-fecha-ingreso'),
            fechaFirma: val('pack-fecha-ingreso'),
            ciudad: val('pack-ciudad') || 'Santiago',
            periodoPrueba: chk('pack-periodo-prueba'),
            horasSemana: val('pack-horas-semana') || '42',
            diasSemana: val('pack-dias-semana') || '5',
            horarioDetalle: val('pack-horario'),
            colacionMin: val('pack-colacion-min') || '60',
            bolsaHoras: chk('pack-bolsa-horas'),
            empNombre: val('emp-nombre'),
            empRut: val('emp-rut'),
            empDomicilio: val('emp-domicilio'),
            lugarServicios: val('emp-domicilio'),
            empEmail: val('emp-email'),
            trabNombre: val('trab-nombre'),
            trabRut: val('trab-rut'),
            trabNacionalidad: val('trab-nacionalidad') || 'Chilena',
            trabEstadoCivil: val('trab-estado-civil') || 'Soltera',
            trabFechaNac: val('trab-fecha-nac'),
            trabDomicilio: val('trab-domicilio'),
            trabFunciones: val('trab-funciones'),
            periodo: val('pack-periodo') || '2026-11',
            diasTrabajados: val('pack-dias-trabajados') || '30',
            sueldoBase: val('pack-sueldo-base') || '553553',
            edadImm: val('pack-edad-imm') || 'normal',
            colacion: val('pack-colacion') || '0',
            movilizacion: val('pack-movilizacion') || '0',
            gratificacionPactada: chk('pack-gratificacion-pactada'),
            gratificacionMonto: val('pack-gratificacion-monto') || '0',
            afp: val('pack-afp') || 'Modelo',
            salud: val('pack-salud') || 'fonasa',
            isapreNombre: val('pack-isapre-nombre'),
            isaprePlanUF: val('pack-isapre-uf'),
            tasaMutual: val('pack-mutual') || '0.93',
            diaPago: val('pack-dia-pago') || 'último día hábil del mes',
            formaPago: val('pack-forma-pago') || 'transferencia bancaria a cuenta de la trabajadora'
        };
    }

    function syncVisibility() {
        var mod = (doc.querySelector('input[name="pack-modalidad"]:checked') || {}).value || 'puertas_afuera';
        var panelAfuera = doc.getElementById('panel-puertas-afuera');
        var panelAdentro = doc.getElementById('panel-puertas-adentro');
        if (panelAfuera) panelAfuera.classList.toggle('hidden', mod === 'puertas_adentro');
        if (panelAdentro) panelAdentro.classList.toggle('hidden', mod !== 'puertas_adentro');

        var panelTermino = doc.getElementById('wrap-fecha-termino');
        if (panelTermino) panelTermino.classList.toggle('hidden', val('pack-contrato-tipo') !== 'plazo_fijo');

        var wrapBolsa = doc.getElementById('wrap-bolsa-horas');
        if (wrapBolsa) wrapBolsa.classList.toggle('hidden', mod === 'puertas_adentro' || numDecimal(val('pack-horas-semana')) > 30);

        var wrapIsapre = doc.getElementById('wrap-isapre-fields');
        if (wrapIsapre) wrapIsapre.classList.toggle('hidden', val('pack-salud') !== 'isapre');

        var wrapGrat = doc.getElementById('wrap-grat-monto');
        if (wrapGrat) wrapGrat.classList.toggle('hidden', !chk('pack-gratificacion-pactada'));

        [['emp-rut', 'emp-rut-status'], ['trab-rut', 'trab-rut-status']].forEach(function (pair) {
            var input = doc.getElementById(pair[0]);
            var badge = doc.getElementById(pair[1]);
            if (!input || !badge) return;
            var raw = input.value.trim();
            if (!raw) { badge.textContent = ''; return; }
            if (validarRut(raw)) {
                badge.textContent = 'RUT válido';
                badge.className = 'text-[11px] font-semibold text-emerald-700 mt-1 block';
            } else {
                badge.textContent = 'Revisa el dígito verificador del RUT';
                badge.className = 'text-[11px] font-semibold text-amber-700 mt-1 block';
            }
        });
    }

    function setTab(tab) {
        activeTab = tab === 'liquidacion' ? 'liquidacion' : 'contrato';
        var btnC = doc.getElementById('tab-btn-contrato');
        var btnL = doc.getElementById('tab-btn-liquidacion');
        var panelC = doc.getElementById('pack-doc-contrato');
        var panelL = doc.getElementById('pack-doc-liquidacion');
        if (btnC) {
            btnC.setAttribute('aria-selected', String(activeTab === 'contrato'));
            btnC.classList.toggle('bg-[#00382E]', activeTab === 'contrato');
            btnC.classList.toggle('text-white', activeTab === 'contrato');
            btnC.classList.toggle('bg-slate-100', activeTab !== 'contrato');
            btnC.classList.toggle('text-slate-700', activeTab !== 'contrato');
        }
        if (btnL) {
            btnL.setAttribute('aria-selected', String(activeTab === 'liquidacion'));
            btnL.classList.toggle('bg-[#00382E]', activeTab === 'liquidacion');
            btnL.classList.toggle('text-white', activeTab === 'liquidacion');
            btnL.classList.toggle('bg-slate-100', activeTab !== 'liquidacion');
            btnL.classList.toggle('text-slate-700', activeTab !== 'liquidacion');
        }
        if (panelC) panelC.classList.toggle('hidden', activeTab !== 'contrato');
        if (panelL) panelL.classList.toggle('hidden', activeTab !== 'liquidacion');
    }

    function updateSummaryAndPreview() {
        var d = recolectarDatos();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}

        var calc = calcularPack(d, mesActualCache);
        var res = calc.res;
        var emp = res.empleador;

        var elLiquido = doc.getElementById('resumen-sueldo-liquido');
        var elCostoEmp = doc.getElementById('resumen-costo-empleador');
        var elCostoTotal = doc.getElementById('resumen-costo-total');
        var elAfc = doc.getElementById('resumen-afc-cero');
        var elAlertaImm = doc.getElementById('alerta-sueldo-minimo');

        if (elLiquido) elLiquido.textContent = pesos(res.liquido);
        if (elCostoEmp) elCostoEmp.textContent = pesos(emp ? emp.total : 0);
        if (elCostoTotal) elCostoTotal.textContent = pesos(emp ? emp.costoTotal : res.totalHaberes);
        if (elAfc) elAfc.textContent = d.modalidad === 'puertas_adentro' ? 'Puertas Adentro · 0% AFC trabajadora' : 'Puertas Afuera · 0% AFC trabajadora';
        if (elAlertaImm) {
            if (calc.bajoMinimo) {
                elAlertaImm.textContent = 'Atención: el sueldo base ingresado es inferior al ingreso mínimo vigente (' + pesos(calc.minimoJornada) + ').';
                elAlertaImm.classList.remove('hidden');
            } else {
                elAlertaImm.classList.add('hidden');
            }
        }

        var cEl = doc.getElementById('pack-doc-contrato');
        var lEl = doc.getElementById('pack-doc-liquidacion');
        if (cEl) cEl.innerHTML = generarContratoHtml(d, calc);
        if (lEl) lEl.innerHTML = generarLiquidacionYFichaHtml(d, calc);
    }

    function applyLockUI(unlocked) {
        var isUnlocked = !!unlocked;
        var sheet = doc.getElementById('notary-sheet');
        var overlay = doc.getElementById('watermark-overlay');
        var btnMain = doc.getElementById('btn-pack-comprar');
        var boxUnlocked = doc.getElementById('box-pack-desbloqueado');
        if (sheet) sheet.classList.toggle('protected-preview', !isUnlocked);
        if (overlay) overlay.classList.toggle('hidden', isUnlocked);
        if (btnMain && boxUnlocked) {
            btnMain.classList.toggle('hidden', isUnlocked);
            boxUnlocked.classList.toggle('hidden', !isUnlocked);
        }
    }

    function descargarWord() {
        var contratoEl = doc.getElementById('pack-doc-contrato');
        if (!contratoEl || !root.FiniquitoDocx) {
            alert('No se pudo cargar el exportador de Word. Recarga la página e inténtalo de nuevo.');
            return;
        }
        var d = recolectarDatos();
        var slug = (d.trabNombre || 'asesora-hogar').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
        var blob = root.FiniquitoDocx.toBlob(contratoEl, 'Contrato Casa Particular - ' + (d.trabNombre || 'Trabajadora'));
        var url = URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = url;
        a.download = 'Contrato_Casa_Particular_' + (slug || '2026') + '.docx';
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function imprimirPDF() {
        var d = recolectarDatos();
        var calc = calcularPack(d, mesActualCache);
        var htmlPack = generarContratoHtml(d, calc) + generarLiquidacionYFichaHtml(d, calc);
        var cssExtra =
            '@page{size:letter;margin:1.8cm;}' +
            'body{font-family:Georgia,"Times New Roman",serif;color:#0f172a;font-size:11.5pt;line-height:1.5;}' +
            'h2{text-align:center;font-size:13pt;text-transform:uppercase;margin:0 0 14px;letter-spacing:.4px;}' +
            'h3{font-size:11pt;color:#00382E;margin:14px 0 6px;}' +
            '[data-docx="recuadro"]{background:#f8fafc;border:1px solid #cbd5e1;padding:10px 14px;border-radius:6px;margin-bottom:12px;font-size:10pt;}' +
            '[data-docx="firmas"]{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:46px;text-align:center;font-size:10pt;}' +
            '[data-docx="firmas"] p:first-child{border-top:1px solid #0f172a;padding-top:6px;font-weight:bold;margin-bottom:2px;}' +
            'p{margin:0 0 9px;text-align:justify;}' +
            '.pack-page-break{page-break-before:always;padding-top:4px;}' +
            '.pack-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;background:#f8fafc;border:1px solid #cbd5e1;padding:10px 12px;border-radius:6px;font-size:9.5pt;margin-bottom:12px;font-family:Arial,sans-serif;}' +
            '.pack-two-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;}' +
            '.pack-tbl{width:100%;border-collapse:collapse;font-size:9.5pt;font-family:Arial,sans-serif;}' +
            '.pack-tbl td{padding:5px 6px;border-bottom:1px solid #e2e8f0;}' +
            '.pack-tbl .pack-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}' +
            '.pack-tbl .pack-sub td{font-weight:700;background:#f8fafc;}' +
            '.pack-tbl .pack-tot td{font-weight:800;background:#eef6f3;color:#00382E;}' +
            '.pack-det{color:#64748b;font-size:8.5pt;}' +
            '.pack-liquido-box{display:flex;justify-content:space-between;align-items:center;background:#00382E;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;font-family:Arial,sans-serif;}' +
            '.pack-liquido-val{font-size:16pt;font-weight:800;}' +
            '.pack-emp-box{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;background:#fff;margin-top:10px;}' +
            '.pack-ficha-box{border:1px solid #cbd5e1;border-radius:8px;padding:12px 14px;background:#f8fafc;margin-top:14px;font-size:9.5pt;font-family:Arial,sans-serif;}' +
            '.pack-ficha-box ol{margin:6px 0 6px 18px;padding:0;}' +
            '.pack-ficha-box li{margin-bottom:6px;}' +
            '.pack-nota{font-size:8.5pt;color:#475569;margin-top:6px;text-align:left;}';

        if (root.CLPrint && root.CLPrint.imprimir) {
            var cabecera = root.CLPrint.header({
                doctype: 'Pack Asesora del Hogar al día',
                date: root.CLPrint.fechaHoy(),
                folio: root.CLPrint.folio('CH')
            });
            root.CLPrint.imprimir({
                title: 'Pack Asesora del Hogar al día - Contrato y 1a Liquidación',
                html: cabecera + htmlPack,
                css: root.CLPrint.css() + cssExtra
            });
            return;
        }
        var win = root.open('', '_blank', 'width=900,height=1000');
        if (!win) { root.print(); return; }
        win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pack Asesora del Hogar</title><style>' + cssExtra + '</style></head><body>' + htmlPack + '<script>window.onload=function(){window.print();};<\/script></body></html>');
        win.document.close();
    }

    function mostrarModalExito() {
        var existing = doc.getElementById('pack-success-modal');
        if (existing) existing.remove();
        var prevFocus = doc.activeElement;
        var modal = doc.createElement('div');
        modal.id = 'pack-success-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'pack-modal-title');
        modal.className = 'fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs no-print';
        modal.innerHTML =
            '<div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">' +
                '<div class="w-14 h-14 bg-emerald-100 text-[#00382E] rounded-full flex items-center justify-center mx-auto mb-3">' +
                    '<span class="material-icons text-3xl text-emerald-700" aria-hidden="true">verified</span>' +
                '</div>' +
                '<span class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full uppercase tracking-wider">Pago Confirmado ($14.990 CLP)</span>' +
                '<h2 id="pack-modal-title" class="text-lg font-extrabold text-slate-900 mt-2">Tu Pack Asesora del Hogar está listo</h2>' +
                '<p class="text-sm text-slate-600 mt-1 leading-relaxed">Descarga el contrato en Word (.docx) o imprime el pack completo en PDF limpio (Contrato + 1a Liquidación + Ficha Mi DT / Previred).</p>' +
                '<div class="space-y-2.5 mt-5">' +
                    '<button type="button" id="modal-btn-docx" class="w-full btn-yellow-pill !py-3 !text-xs flex items-center justify-center gap-1.5 cursor-pointer" style="min-height:44px;">' +
                        '<span class="material-icons text-sm" aria-hidden="true">description</span>' +
                        '<span>Descargar Contrato Word (.docx editable)</span>' +
                    '</button>' +
                    '<button type="button" id="modal-btn-pdf" class="w-full btn-dark-pill !py-3 !text-xs flex items-center justify-center gap-1.5 cursor-pointer" style="min-height:44px;">' +
                        '<span class="material-icons text-sm" aria-hidden="true">picture_as_pdf</span>' +
                        '<span>Imprimir / Guardar Pack en PDF limpio</span>' +
                    '</button>' +
                    '<button type="button" id="modal-btn-close" class="w-full py-2.5 text-xs text-slate-700 hover:text-slate-900 font-semibold cursor-pointer bg-transparent border-0" style="min-height:44px;">' +
                        'Continuar revisando en pantalla' +
                    '</button>' +
                '</div>' +
            '</div>';
        doc.body.appendChild(modal);

        function cerrarModal() {
            doc.removeEventListener('keydown', onEsc);
            modal.remove();
            if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
        }
        function onEsc(e) {
            if (e.key === 'Escape') cerrarModal();
        }
        doc.addEventListener('keydown', onEsc);
        modal.addEventListener('click', function (e) { if (e.target === modal) cerrarModal(); });
        modal.querySelector('#modal-btn-docx').addEventListener('click', descargarWord);
        modal.querySelector('#modal-btn-pdf').addEventListener('click', imprimirPDF);
        modal.querySelector('#modal-btn-close').addEventListener('click', cerrarModal);
        modal.querySelector('#modal-btn-docx').focus();
    }

    function restoreState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            var s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return false;
            var textMap = {
                'pack-contrato-tipo': s.contratoTipo,
                'pack-fecha-termino': s.fechaTermino,
                'pack-fecha-ingreso': s.fechaIngreso,
                'pack-ciudad': s.ciudad,
                'pack-horas-semana': s.horasSemana,
                'pack-dias-semana': s.diasSemana,
                'pack-horario': s.horarioDetalle,
                'pack-colacion-min': s.colacionMin,
                'emp-nombre': s.empNombre,
                'emp-rut': s.empRut,
                'emp-domicilio': s.empDomicilio,
                'emp-email': s.empEmail,
                'trab-nombre': s.trabNombre,
                'trab-rut': s.trabRut,
                'trab-nacionalidad': s.trabNacionalidad,
                'trab-estado-civil': s.trabEstadoCivil,
                'trab-fecha-nac': s.trabFechaNac,
                'trab-domicilio': s.trabDomicilio,
                'trab-funciones': s.trabFunciones,
                'pack-periodo': s.periodo,
                'pack-dias-trabajados': s.diasTrabajados,
                'pack-sueldo-base': s.sueldoBase,
                'pack-edad-imm': s.edadImm,
                'pack-colacion': s.colacion,
                'pack-movilizacion': s.movilizacion,
                'pack-gratificacion-monto': s.gratificacionMonto,
                'pack-afp': s.afp,
                'pack-salud': s.salud,
                'pack-isapre-nombre': s.isapreNombre,
                'pack-isapre-uf': s.isaprePlanUF,
                'pack-mutual': s.tasaMutual,
                'pack-dia-pago': s.diaPago,
                'pack-forma-pago': s.formaPago
            };
            Object.keys(textMap).forEach(function (id) {
                var el = doc.getElementById(id);
                if (el && textMap[id] !== undefined && textMap[id] !== '') el.value = textMap[id];
            });
            if (s.modalidad) {
                var rad = doc.querySelector('input[name="pack-modalidad"][value="' + s.modalidad + '"]');
                if (rad) rad.checked = true;
            }
            [['pack-periodo-prueba', s.periodoPrueba], ['pack-bolsa-horas', s.bolsaHoras], ['pack-gratificacion-pactada', s.gratificacionPactada]].forEach(function (pair) {
                var el = doc.getElementById(pair[0]);
                if (el && typeof pair[1] === 'boolean') el.checked = pair[1];
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function cargarValoresMes(periodo) {
        var P = getParametros();
        var V = root.CLLiquidacionValores;
        if (!P || !V || !V.crear) return;
        try {
            var valSrv = V.crear({ parametros: P });
            valSrv.obtener(periodo || '2026-11').then(function (r) {
                if (r && r.ok && r.mes) {
                    mesActualCache = r.mes;
                    updateSummaryAndPreview();
                }
            }).catch(function () {});
        } catch (e) {}
    }

    doc.addEventListener('DOMContentLoaded', function () {
        var todayIso = new Date().toISOString().slice(0, 10);
        var restored = restoreState();
        var fIng = doc.getElementById('pack-fecha-ingreso');
        if (!restored && fIng && !fIng.value) fIng.value = todayIso;

        syncVisibility();
        updateSummaryAndPreview();
        applyLockUI(false);
        cargarValoresMes(val('pack-periodo') || '2026-11');

        var form = doc.getElementById('pack-casa-form');
        if (form) {
            var onUpdate = function (e) {
                if (e && e.target && e.target.id === 'pack-periodo') {
                    mesActualCache = null;
                    cargarValoresMes(e.target.value);
                }
                syncVisibility();
                updateSummaryAndPreview();
            };
            form.addEventListener('input', onUpdate);
            form.addEventListener('change', onUpdate);
        }

        var btnTabC = doc.getElementById('tab-btn-contrato');
        var btnTabL = doc.getElementById('tab-btn-liquidacion');
        if (btnTabC) btnTabC.addEventListener('click', function () { setTab('contrato'); });
        if (btnTabL) btnTabL.addEventListener('click', function () { setTab('liquidacion'); });

        var btnComprar = doc.getElementById('btn-pack-comprar');
        if (btnComprar) {
            btnComprar.addEventListener('click', function () {
                var d = recolectarDatos();
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
                if (!root.CLCheckout) {
                    alert('No se pudo cargar el módulo de pago. Recarga la página.');
                    return;
                }
                root.CLCheckout.buyKit('casahogar', {
                    nombre: d.empNombre || '',
                    empresa: 'Empleador Casa Particular'
                }, { askEmail: true, defaultEmail: d.empEmail || '' });
            });
        }

        var btnWord = doc.getElementById('btn-pack-docx');
        var btnPdf = doc.getElementById('btn-pack-pdf');
        if (btnWord) btnWord.addEventListener('click', descargarWord);
        if (btnPdf) btnPdf.addEventListener('click', imprimirPDF);

        var params = new URLSearchParams(root.location.search);
        if (params.get('p') === 'casahogar' && params.has('sig') && root.CLCheckout) {
            root.CLCheckout.unlockFromUrl('casahogar').then(function (u) {
                if (!u) return;
                unlockedOrder = u;
                applyLockUI(true);
                updateSummaryAndPreview();
                mostrarModalExito();
            });
        } else if (params.get('pago') === 'rechazado') {
            alert('El pago no se completó y no se realizó ningún cargo. Tus datos quedaron guardados.');
        }
    });
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
