/*
 * CálculoLaboral · Controlador UI del Portal Cliente Marca Blanca en /demo-contadores (Ola 3B)
 * Gestiona #dlg-portal-estudio y los accesos (#btn-rep-abrir-portal, #btn-torre-portal).
 * Ley 21.719: omite bancos, cuentas, licencias, contacto y descuentos personales en el snapshot.
 */
(function () {
    'use strict';

    var D = window.DemoCL;
    var Sii = window.CLSii;
    var api = Sii ? Sii.crearClienteApi() : null;
    var K_PREVIEW = 'cl_portal_estudio_preview';

    var sesion = { autenticado: false };

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return D && D.esc ? D.esc(v) : String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function val(id, def) {
        var el = $(id);
        return el && el.value ? el.value.trim() : (def || '');
    }

    function leerIdentidadEstudio() {
        return {
            nombre: val('rep-estudio-nombre', 'Estudio Contable Chile'),
            rut: val('rep-estudio-rut', '76.543.210-K'),
            contador: val('rep-contador-nombre', 'Contador Auditor'),
            pie: val('rep-estudio-pie', 'Documento informativo emitido para el cliente.')
        };
    }

    function enmascararRut(rut) {
        var s = String(rut || '').trim();
        var p = s.split('-');
        if (p.length !== 2) return s;
        var c = p[0].replace(/\D/g, '');
        if (c.length <= 4) return s;
        return '****' + c.slice(-4) + '-' + p[1];
    }

    function headersEstudio(esEscritura) {
        var h = { accept: 'application/json' };
        var estId = (Sii && Sii.estudioActivoId) ? Sii.estudioActivoId() : '';
        if (estId) h['x-cl-estudio'] = estId;
        if (esEscritura) {
            h['content-type'] = 'application/json';
            h['x-cl-pyme'] = '1';
        }
        return h;
    }

    function seccionesSeleccionadas() {
        return {
            f29: $('portal-opt-f29') ? $('portal-opt-f29').checked : true,
            pnl: $('portal-opt-pnl') ? $('portal-opt-pnl').checked : true,
            laboral: $('portal-opt-laboral') ? $('portal-opt-laboral').checked : true,
            buzon: $('portal-opt-buzon') ? $('portal-opt-buzon').checked : true
        };
    }

    function construirSnapshot(secciones) {
        var br = window.CLSuiteSiiBridge;
        var m = br && br.calcularModelo ? br.calcularModelo() : null;
        var est = leerIdentidadEstudio();
        var cliNom = (br && br.clienteNombre && br.clienteNombre()) || val('liq-cliente', 'Empresa Cliente');
        var cliRut = (window.CLDemoSii && window.CLDemoSii.rutDeCliente && window.CLDemoSii.rutDeCliente(cliNom)) || val('liq-rut-empresa', '');
        var periodo = (br && br.periodoActual && br.periodoActual()) || val('periodo', '2026-11');
        var estado = (m && m.estado) || {};
        var f29 = (m && m.f29) || {};
        var cods = f29.codigos || {};
        var pnl = (m && m.pnl) || {};

        var vencimientos = [];
        var resLiq = window.CLDemoLiquidaciones ? window.CLDemoLiquidaciones.resultados() : [];
        if (window.CLPrevalidador && window.CLPrevalidador.calendarioVencimientos) {
            vencimientos = window.CLPrevalidador.calendarioVencimientos({
                periodo: periodo,
                eventos: window.CLPrevalidador.eventosDeResultados(resLiq),
                trabajadoresCount: resLiq.length
            }).slice(0, 6).map(function (c) {
                return { titulo: c.titulo, fechaLimite: c.fechaLimite, estado: c.estado };
            });
        }

        var snap = {
            estudio: est,
            cliente: {
                nombre: cliNom,
                rut: cliRut,
                periodo: periodo,
                regimen: f29.regimenNombre || 'ProPyme 14 D3',
                cerradoTributario: !!estado.cerradoTributario
            },
            secciones: secciones
        };

        if (secciones.f29) {
            snap.f29 = {
                ivaDeterminado: Math.round(Number(cods[89]) || 0),
                retenciones: Math.round((Number(cods[48]) || 0) + (Number(cods[151]) || 0)),
                ppm: Math.round(Number(cods[62]) || 0),
                ppmTasa: Number(cods[115]) || 0,
                totalPagar: Math.round(Number(cods[91]) || 0),
                remanente: Math.round(Number(cods[77]) || 0),
                postergadoIva: Boolean(cods[756]),
                montoPostergado: Math.round(Number(cods[755]) || 0),
                vencimientos: vencimientos
            };
        }

        if (secciones.pnl) {
            snap.pnl = {
                ingresos: Math.round(Number(pnl.ingresosGiro) || 0),
                costos: Math.round(Number(pnl.costosDirectos) || 0),
                gastos: Math.round((Number(pnl.gastosRemuneraciones) || 0) + (Number(pnl.gastosOperacion) || 0)),
                resultado: Math.round(Number(pnl.resultadoAntesImpuesto) || 0)
            };
        }

        if (secciones.laboral) {
            var ok = resLiq.filter(function (r) { return r && !r.error; });
            var totHab = 0, totDesc = 0, totLiq = 0, totCosto = 0;
            var trabs = ok.map(function (r) {
                var rec = r.record || {};
                totHab += Math.round(Number(r.haberes) || 0);
                totDesc += Math.round(Number(r.descuentos) || 0);
                totLiq += Math.round(Number(r.liquido) || 0);
                totCosto += Math.round(Number(r.costo) || 0);
                return {
                    nombre: String(rec.nombre || 'Trabajador').slice(0, 100),
                    rut: enmascararRut(rec.rut),
                    dias: Math.round(Number(rec.dias) || 0),
                    haberes: Math.round(Number(r.haberes) || 0),
                    descuentosLegales: Math.round(Number(r.descuentos) || 0),
                    liquido: Math.round(Number(r.liquido) || 0)
                };
            });
            snap.laboral = {
                cantidadTrabajadores: ok.length,
                totalHaberes: totHab,
                totalDescuentos: totDesc,
                totalLiquido: totLiq,
                totalCostoEmpresa: totCosto,
                trabajadores: trabs
            };
        }

        return snap;
    }

    function feedback(texto, tipo) {
        var box = $('portal-dlg-feedback');
        if (!box) return;
        if (!texto) {
            box.hidden = true;
            box.textContent = '';
            return;
        }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'error' ? 'error' : 'ok');
        box.textContent = texto;
    }

    function fechaCorta(iso) {
        if (!iso) return 'Sin fecha';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function pintarResumenF29() {
        var br = window.CLSuiteSiiBridge;
        var m = br && br.calcularModelo ? br.calcularModelo() : null;
        if (!m || !m.f29 || !m.f29.codigos) return;
        var est = m.estado || {};
        var cerrado = !!est.cerradoTributario;
        var tieneDatos = !!((m.compras && m.compras.documentos && m.compras.documentos.length) ||
            (m.ventas && m.ventas.documentos && m.ventas.documentos.length));
        var fmt = function (n) { return '$' + Number(n || 0).toLocaleString('es-CL'); };
        if ($('portal-f29-periodo')) $('portal-f29-periodo').textContent = 'Período ' + m.periodo;
        if ($('portal-f29-estado')) {
            $('portal-f29-estado').textContent = cerrado
                ? 'Declarado'
                : (tieneDatos ? 'Pendiente de declaración' : 'Sin datos cargados');
        }
        if ($('portal-f29-monto')) $('portal-f29-monto').textContent = fmt(m.f29.codigos[91]);
        if ($('portal-f29-iva')) {
            $('portal-f29-iva').textContent = fmt(m.f29.codigos[538]) + ' / ' + fmt(m.f29.codigos[537]);
        }
        var noDeclarado = !cerrado && tieneDatos;
        if ($('portal-f29-aviso')) $('portal-f29-aviso').hidden = !noDeclarado;
        if ($('portal-f29-recordar-wrap')) $('portal-f29-recordar-wrap').hidden = !noDeclarado;
    }

    function textoResumenF29(conRecordatorio, enlace) {
        var br = window.CLSuiteSiiBridge;
        if (br && br.generarTextoWhatsapp) {
            var completo = br.generarTextoWhatsapp({
                incluirRecordatorio: !!conRecordatorio,
                portalUrl: enlace || ''
            });
            if (completo) return completo;
        }
        var m = br && br.calcularModelo ? br.calcularModelo() : null;
        var cliNom = (br && br.clienteNombre && br.clienteNombre()) || 'tu empresa';
        if (!m || !m.f29 || !m.f29.codigos) return '';
        var est = m.estado || {};
        var cerrado = !!est.cerradoTributario;
        var fmt = function (n) { return '$' + Number(n || 0).toLocaleString('es-CL'); };
        var lineas = [
            'Resumen ' + cliNom + ' · Período ' + m.periodo,
            'F29 del período: ' + (cerrado ? 'Declarado' : 'Pendiente de declaración') + ' · Total cód. 91: ' + fmt(m.f29.codigos[91]),
            'IVA débito ' + fmt(m.f29.codigos[538]) + ' / crédito ' + fmt(m.f29.codigos[537])
        ];
        if (conRecordatorio && !cerrado) {
            lineas.push('Recordatorio: declara y paga tu F29 en sii.cl dentro del plazo mensual (día 20 para facturador electrónico con pago por Internet; día 12 regla general / día 28 sin pago; si es inhábil, siguiente día hábil).');
        }
        if (enlace) lineas.push('Portal del cliente: ' + enlace);
        var est1 = leerIdentidadEstudio();
        lineas.push('— ' + (est1 && est1.nombre ? est1.nombre : 'Tu estudio contable'));
        return lineas.join('\n');
    }

    async function copiarResumenYEnlace() {
        var enlace = $('portal-enlace-url') ? $('portal-enlace-url').textContent.trim() : '';
        if (!enlace) {
            feedback('Genera primero el enlace del Portal; después copio el resumen con el link.', 'error');
            return;
        }
        var recordar = !($('portal-f29-recordar-wrap') && $('portal-f29-recordar-wrap').hidden) &&
            $('portal-f29-recordar') && $('portal-f29-recordar').checked;
        var texto = textoResumenF29(!!recordar, enlace);
        if (!texto) { feedback('No hay datos calculados para el resumen.', 'error'); return; }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(texto);
            feedback('Resumen con enlace copiado, listo para WhatsApp o correo.', 'ok');
            if (D && D.avisar) D.avisar('Resumen + enlace copiados al portapapeles.');
        } catch (e) {
            feedback('No pudimos copiar; selecciona el texto en la vista previa.', 'error');
        }
    }

    function limpiarEnlaceTemporal() {
        if ($('portal-enlace-creado-box')) $('portal-enlace-creado-box').hidden = true;
        if ($('portal-enlace-url')) $('portal-enlace-url').textContent = '';
    }

    function pintarCabeceraModal() {
        var br = window.CLSuiteSiiBridge;
        var est = leerIdentidadEstudio();
        var cliNom = (br && br.clienteNombre && br.clienteNombre()) || val('liq-cliente', 'Empresa Cliente');
        var cliRut = (window.CLDemoSii && window.CLDemoSii.rutDeCliente && window.CLDemoSii.rutDeCliente(cliNom)) || val('liq-rut-empresa', '') || 'Sin RUT';

        if ($('portal-dlg-cliente-nom')) $('portal-dlg-cliente-nom').textContent = cliNom;
        if ($('portal-dlg-cliente-rut')) $('portal-dlg-cliente-rut').textContent = cliRut;
        if ($('portal-dlg-estudio-nom')) $('portal-dlg-estudio-nom').textContent = est.nombre;
        if ($('portal-dlg-estudio-meta')) $('portal-dlg-estudio-meta').textContent = 'RUT ' + est.rut + ' · ' + est.contador;
    }

    function pintarTablaEnlaces(items) {
        var tbody = $('tbody-portal-enlaces');
        var vacio = $('portal-enlaces-vacio');
        var wrap = $('portal-enlaces-tabla-wrap');
        if (!tbody) return;
        var activos = (Array.isArray(items) ? items : []).filter(function (x) { return !x.revocado; });
        if (!activos.length) {
            tbody.innerHTML = '';
            if (vacio) vacio.hidden = false;
            if (wrap) wrap.hidden = true;
            return;
        }
        if (vacio) vacio.hidden = true;
        if (wrap) wrap.hidden = false;
        tbody.innerHTML = activos.map(function (it) {
            var s = it.secciones || {};
            var tags = [];
            if (s.f29) tags.push('F29');
            if (s.pnl) tags.push('P&L');
            if (s.laboral) tags.push('Laboral');
            if (s.buzon !== false) tags.push('Buzón');
            return '<tr>' +
                '<td><strong>' + esc(it.clienteNombre) + '</strong><br><span class="texto-ayuda mono">' + esc(it.periodo) + ' · ' + esc(it.accesos || 0) + ' visitas</span></td>' +
                '<td>' + esc(tags.join(', ')) + '</td>' +
                '<td class="mono">' + esc(fechaCorta(it.vence)) + '</td>' +
                '<td class="num"><button type="button" class="btn-peligro-texto btn-portal-revocar" data-portal-revocar="' + esc(it.id) + '">Revocar</button></td>' +
                '</tr>';
        }).join('');
    }

    var TIPO_BUZON_LBL = {
        cartola: 'Cartola bancaria',
        novedades: 'Novedades sueldo',
        otro: 'Documento'
    };
    var K_BUZON_DEMO = 'cl_suite_buzon_demo_items';
    var K_BUZON_SAL = 'cl_suite_buzon_salientes';
    var buzonCache = [];
    var buzonPlantillaActiva = 'portal';

    function base64ABytes(b64) {
        var bin = window.atob(String(b64 || ''));
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    }

    function textoABase64(str) {
        try {
            return window.btoa(unescape(encodeURIComponent(String(str || ''))));
        } catch (e) {
            return '';
        }
    }

    function feedbackVistaBuzon(texto, tipo) {
        var box = $('buzon-vista-feedback');
        if (!box) return;
        if (!texto) {
            box.hidden = true;
            box.textContent = '';
            return;
        }
        box.hidden = false;
        box.className = 'sii-feedback-box ' + (tipo === 'error' ? 'error' : 'ok');
        box.textContent = texto;
    }

    function leerItemsDemo() {
        try {
            var raw = window.localStorage.getItem(K_BUZON_DEMO);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }

    function guardarItemsDemo(lista) {
        try {
            window.localStorage.setItem(K_BUZON_DEMO, JSON.stringify(lista || []));
        } catch (e) { /* silencioso */ }
    }

    function crearEnviosDemo() {
        var br = window.CLSuiteSiiBridge;
        var cli = (br && br.clienteNombre && br.clienteNombre()) || val('liq-cliente', 'Panadería San Isidro SpA');
        var per = (br && br.periodoActual && br.periodoActual()) || '2026-11';
        var csvCartola = [
            'Fecha;Descripcion;Cargo;Abono;Saldo',
            per + '-03;Transferencia Cliente Factura 1042;;1450000;3820000',
            per + '-07;Pago Proveedor Harinas del Sur;620000;;3200000',
            per + '-12;Pago Imposiciones Previred;485000;;2715000',
            per + '-18;Abono Transbank Ventas Pos;;980000;3695000'
        ].join('\n');
        var novTxt = 'Novedades ' + per + ': 1 licencia medica tipo 1 (3 dias) y bono de produccion $85.000 para jefe de turno.';
        return [
            {
                id: 'demo-cartola-' + per,
                demo: true,
                clienteNombre: cli,
                periodo: per,
                tipo: 'cartola',
                nombreArchivo: 'cartola_banco_chile_' + per + '.csv',
                mimeType: 'text/csv',
                nota: 'Cartola cuenta corriente del mes para conciliación.',
                estado: 'nuevo',
                creado: new Date().toISOString(),
                contenidoBase64: textoABase64(csvCartola)
            },
            {
                id: 'demo-nov-' + per,
                demo: true,
                clienteNombre: cli,
                periodo: per,
                tipo: 'novedades',
                nombreArchivo: 'novedades_sueldo_' + per + '.txt',
                mimeType: 'text/plain',
                nota: 'Licencia médica de 3 días y bono de producción.',
                estado: 'nuevo',
                creado: new Date(Date.now() - 3600000 * 5).toISOString(),
                contenidoBase64: textoABase64(novTxt)
            }
        ];
    }

    function actualizarAlertasBuzon(items) {
        var lista = Array.isArray(items) ? items : [];
        var pendientes = lista.filter(function (x) { return x && x.estado !== 'procesado'; });
        var br = window.CLSuiteSiiBridge;
        var cliAct = (br && br.clienteNombre) ? String(br.clienteNombre() || '').trim().toLowerCase() : '';
        var perAct = (br && br.periodoActual) ? br.periodoActual() : '';
        var delCliente = pendientes.filter(function (x) {
            var mCli = !cliAct || String(x.clienteNombre || '').trim().toLowerCase() === cliAct;
            var mPer = !perAct || !x.periodo || x.periodo === perAct;
            return mCli && mPer;
        });

        var navBadge = $('nav-buzon-pend');
        if (navBadge) {
            navBadge.hidden = pendientes.length === 0;
            navBadge.textContent = String(pendientes.length);
        }

        var alertaBancos = $('bancos-buzon-alerta');
        var alertaTxt = $('bancos-buzon-txt');
        if (alertaBancos && alertaTxt) {
            if (delCliente.length > 0) {
                alertaBancos.hidden = false;
                alertaTxt.textContent = 'Tu cliente envió ' + delCliente.length + ' archivo(s) desde el Portal en este período.';
            } else {
                alertaBancos.hidden = true;
            }
        }

        var badgeRep = $('rep-portal-badge');
        if (badgeRep) {
            badgeRep.hidden = pendientes.length === 0;
            badgeRep.textContent = pendientes.length + ' nuevo(s)';
        }
    }

    function poblarFiltrosBuzon(items) {
        var selCli = $('buzon-filtro-cliente');
        var selPer = $('buzon-filtro-periodo');
        if (selCli) {
            var prevC = selCli.value;
            var clis = {};
            items.forEach(function (it) { if (it && it.clienteNombre) clis[it.clienteNombre] = true; });
            var htmlC = '<option value="">Todos los clientes</option>' + Object.keys(clis).sort().map(function (c) {
                return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
            }).join('');
            selCli.innerHTML = htmlC;
            if (prevC && clis[prevC]) selCli.value = prevC;
        }
        if (selPer) {
            var prevP = selPer.value;
            var pers = {};
            items.forEach(function (it) { if (it && it.periodo) pers[it.periodo] = true; });
            var htmlP = '<option value="">Todos los períodos</option>' + Object.keys(pers).sort().reverse().map(function (p) {
                return '<option value="' + esc(p) + '">' + esc(p) + '</option>';
            }).join('');
            selPer.innerHTML = htmlP;
            if (prevP && pers[prevP]) selPer.value = prevP;
        }
    }

    function filtrarItemsBuzon(items) {
        var fCli = $('buzon-filtro-cliente') ? $('buzon-filtro-cliente').value : '';
        var fPer = $('buzon-filtro-periodo') ? $('buzon-filtro-periodo').value : '';
        var fTipo = $('buzon-filtro-tipo') ? $('buzon-filtro-tipo').value : '';
        var fEst = $('buzon-filtro-estado') ? $('buzon-filtro-estado').value : 'pendiente';
        return items.filter(function (it) {
            if (!it) return false;
            if (fCli && it.clienteNombre !== fCli) return false;
            if (fPer && it.periodo !== fPer) return false;
            if (fTipo && it.tipo !== fTipo) return false;
            var proc = it.estado === 'procesado';
            if (fEst === 'pendiente' && proc) return false;
            if (fEst === 'procesado' && !proc) return false;
            return true;
        });
    }

    function pintarTablaBuzon(items) {
        buzonCache = Array.isArray(items) ? items : [];
        actualizarAlertasBuzon(buzonCache);
        poblarFiltrosBuzon(buzonCache);

        var demoStrip = $('buzon-demo-strip');
        if (demoStrip) demoStrip.hidden = sesion.autenticado;

        var filtrados = filtrarItemsBuzon(buzonCache);
        var conteo = $('buzon-resumen-conteo');
        if (conteo) {
            conteo.textContent = filtrados.length + (filtrados.length === 1 ? ' archivo' : ' archivos');
        }

        var tbody = $('tbody-suite-buzon');
        var movil = $('buzon-movil-lista');
        var wrap = $('buzon-tabla-wrap');
        var vacio = $('buzon-vacio');
        if (!tbody) return;

        if (!filtrados.length) {
            tbody.innerHTML = '';
            if (movil) { movil.innerHTML = ''; movil.hidden = true; }
            if (wrap) wrap.hidden = true;
            if (vacio) vacio.hidden = false;
            return;
        }
        if (vacio) vacio.hidden = true;
        if (wrap) wrap.hidden = false;
        if (movil) movil.hidden = false;

        tbody.innerHTML = filtrados.map(function (it) {
            var proc = it.estado === 'procesado';
            var selloCls = proc ? 'sello-emitida' : 'sello-preparada';
            var selloTxt = proc ? 'Procesado' : 'Pendiente';
            var esCartola = it.tipo === 'cartola' && /\.(csv|txt|tsv|xlsx|xls)$/i.test(String(it.nombreArchivo || ''));
            var fechaTxt = it.creado ? fechaCorta(it.creado) : '';
            return '<tr>' +
                '<td><strong>' + esc(it.nombreArchivo) + '</strong><br><span class="texto-ayuda">' + esc(it.clienteNombre) + ' · <span class="mono">' + esc(it.periodo) + '</span> · ' + esc(TIPO_BUZON_LBL[it.tipo] || it.tipo) + '</span></td>' +
                '<td>' + (it.nota ? esc(it.nota) : '<span class="texto-ayuda">Sin nota</span>') + (fechaTxt ? '<br><span class="texto-ayuda mono">' + esc(fechaTxt) + '</span>' : '') + '</td>' +
                '<td><span class="sello ' + selloCls + '">' + selloTxt + '</span></td>' +
                '<td class="num"><div class="match-acciones-fila" style="justify-content:flex-end">' +
                (esCartola ? '<button type="button" class="btn btn-chico btn-primario" data-buzon-aplicar="' + esc(it.id) + '">Aplicar a período</button>' : '') +
                '<button type="button" class="btn btn-chico" data-buzon-descargar="' + esc(it.id) + '">Descargar</button>' +
                '<button type="button" class="btn-texto" data-buzon-estado="' + esc(it.id) + '" data-buzon-next="' + (proc ? 'nuevo' : 'procesado') + '">' + (proc ? 'Reabrir' : 'Procesado') + '</button>' +
                '</div></td>' +
                '</tr>';
        }).join('');

        if (movil) {
            movil.innerHTML = filtrados.map(function (it) {
                var proc = it.estado === 'procesado';
                var selloCls = proc ? 'sello-emitida' : 'sello-preparada';
                var selloTxt = proc ? 'Procesado' : 'Pendiente';
                var esCartola = it.tipo === 'cartola' && /\.(csv|txt|tsv|xlsx|xls)$/i.test(String(it.nombreArchivo || ''));
                var fechaTxt = it.creado ? fechaCorta(it.creado) : '';
                return '<article class="buzon-movil-item">' +
                    '<div class="buzon-movil-head">' +
                    '<div><strong>' + esc(it.nombreArchivo) + '</strong><p class="texto-ayuda" style="margin:2px 0 0">' + esc(it.clienteNombre) + ' · <span class="mono">' + esc(it.periodo) + '</span> · ' + esc(TIPO_BUZON_LBL[it.tipo] || it.tipo) + '</p></div>' +
                    '<span class="sello ' + selloCls + '">' + selloTxt + '</span>' +
                    '</div>' +
                    (it.nota ? '<p class="buzon-movil-nota">' + esc(it.nota) + '</p>' : '') +
                    (fechaTxt ? '<p class="texto-ayuda mono" style="margin:0">' + esc(fechaTxt) + '</p>' : '') +
                    '<div class="buzon-movil-acciones">' +
                    (esCartola ? '<button type="button" class="btn btn-primario" data-buzon-aplicar="' + esc(it.id) + '">Aplicar a período</button>' : '') +
                    '<button type="button" class="btn" data-buzon-descargar="' + esc(it.id) + '">Descargar</button>' +
                    '<button type="button" class="btn-texto" data-buzon-estado="' + esc(it.id) + '" data-buzon-next="' + (proc ? 'nuevo' : 'procesado') + '">' + (proc ? 'Reabrir' : 'Marcar procesado') + '</button>' +
                    '</div>' +
                    '</article>';
            }).join('');
        }
    }

    function generarPlantillaSaliente(tipo) {
        buzonPlantillaActiva = tipo || 'portal';
        var br = window.CLSuiteSiiBridge;
        var cli = (br && br.clienteNombre && br.clienteNombre()) || val('liq-cliente', 'Empresa Cliente');
        var per = (br && br.periodoActual && br.periodoActual()) || '2026-11';
        var est = leerIdentidadEstudio();
        var m = br && br.calcularModelo ? br.calcularModelo() : null;
        var f29Total = m && m.f29 ? Math.round(Number(m.f29.total || 0)) : 0;
        var f29Fmt = '$' + f29Total.toLocaleString('es-CL');

        var badgeCli = $('buzon-sal-cliente');
        if (badgeCli) badgeCli.textContent = cli;

        Array.prototype.forEach.call(document.querySelectorAll('.buzon-tpl-btn'), function (b) {
            var act = b.getAttribute('data-buzon-tpl') === buzonPlantillaActiva;
            b.classList.toggle('activo', act);
            b.setAttribute('aria-pressed', act ? 'true' : 'false');
        });

        var asunto = '';
        var cuerpo = '';
        if (buzonPlantillaActiva === 'cartola') {
            asunto = 'Solicitud de cartola bancaria y respaldos ' + per + ' - ' + cli;
            cuerpo = 'Hola equipo de ' + cli + ',\n\nPara avanzar con la conciliación y el cierre de ' + per + ', necesitamos tu cartola bancaria (CSV o Excel) y novedades de sueldo del mes.\n\nPuedes subir los archivos de forma segura desde tu Portal Cliente Marca Blanca.\n\nSaludos,\n' + est.nombre;
        } else if (buzonPlantillaActiva === 'f29') {
            asunto = 'Recordatorio Formulario 29 período ' + per + ' - ' + cli;
            cuerpo = 'Hola equipo de ' + cli + ',\n\nTe compartimos el resumen preliminar del F29 para ' + per + ' (total estimado: ' + f29Fmt + '). Recuerda que el vencimiento legal para facturador electrónico con pago por Internet es el día 20 (día 12 regla general / día 28 sin pago).\n\nRevisa el detalle actualizado en tu Portal Cliente.\n\nSaludos,\n' + est.nombre;
        } else {
            asunto = 'Portal Cliente ' + per + ' disponible - ' + cli;
            cuerpo = 'Hola equipo de ' + cli + ',\n\nYa está disponible tu resumen mensual (' + per + ') en el Portal Cliente de ' + est.nombre + ': F29, Estado de Resultados, resumen laboral y buzón para subir respaldos.\n\n(Pega aquí el enlace seguro generado en Configurar Portal Cliente)\n\nSaludos,\n' + est.nombre;
        }
        if ($('buzon-sal-asunto')) $('buzon-sal-asunto').value = asunto;
        if ($('buzon-sal-mensaje')) $('buzon-sal-mensaje').value = cuerpo;
    }

    function leerSalientes() {
        try {
            var raw = window.localStorage.getItem(K_BUZON_SAL);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }

    function registrarSaliente(canal, asunto) {
        var br = window.CLSuiteSiiBridge;
        var cli = (br && br.clienteNombre && br.clienteNombre()) || val('liq-cliente', 'Empresa Cliente');
        var per = (br && br.periodoActual && br.periodoActual()) || '2026-11';
        var lista = leerSalientes();
        lista.unshift({
            fecha: new Date().toISOString(),
            cliente: cli,
            periodo: per,
            canal: canal,
            asunto: asunto
        });
        try {
            window.localStorage.setItem(K_BUZON_SAL, JSON.stringify(lista.slice(0, 12)));
        } catch (e) { /* silencioso */ }
        pintarSalientes();
    }

    function pintarSalientes() {
        var ul = $('buzon-sal-lista');
        var vacio = $('buzon-sal-vacio');
        if (!ul) return;
        var lista = leerSalientes();
        if (!lista.length) {
            ul.innerHTML = '';
            if (vacio) vacio.hidden = false;
            return;
        }
        if (vacio) vacio.hidden = true;
        ul.innerHTML = lista.slice(0, 5).map(function (it) {
            return '<li class="buzon-sal-item">' +
                '<div><strong>' + esc(it.asunto) + '</strong><span class="texto-ayuda">' + esc(it.cliente) + ' · ' + esc(it.canal) + '</span></div>' +
                '<span class="texto-ayuda mono">' + esc(fechaCorta(it.fecha)) + '</span>' +
                '</li>';
        }).join('');
    }

    async function cargarBuzonEstudio() {
        generarPlantillaSaliente(buzonPlantillaActiva);
        pintarSalientes();
        if (!sesion.autenticado) {
            pintarTablaBuzon(leerItemsDemo());
            return;
        }
        try {
            var res = await fetch('/api/pyme/portal-estudio-buzon', { credentials: 'same-origin', headers: headersEstudio(false) });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok && data.ok !== false) pintarTablaBuzon(data.items || []);
        } catch (e) { /* silencioso */ }
    }

    async function cargarSesionYEnlaces() {
        var sinSes = $('portal-dlg-sin-sesion');
        var btnGen = $('btn-portal-generar');
        var wrap = $('portal-enlaces-wrap');
        var buzonWrap = $('portal-buzon-wrap');
        try {
            var r = await fetch('/api/pyme/sesion', { credentials: 'same-origin' });
            var j = r.ok ? await r.json().catch(function () { return {}; }) : {};
            sesion.autenticado = Boolean(j && j.autenticado);
        } catch (e) {
            sesion.autenticado = false;
        }

        if (sinSes) sinSes.hidden = sesion.autenticado;
        if (btnGen) btnGen.disabled = !sesion.autenticado;
        if (wrap) wrap.hidden = !sesion.autenticado;
        if (buzonWrap) buzonWrap.hidden = false;

        if (!sesion.autenticado) {
            await cargarBuzonEstudio();
            return;
        }
        try {
            var res = await fetch('/api/pyme/portal-estudio', { credentials: 'same-origin', headers: headersEstudio(false) });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok && data.ok !== false) pintarTablaEnlaces(data.items || []);
        } catch (err) {
            feedback('No pudimos cargar los enlaces activos del portal.', 'error');
        }
        await cargarBuzonEstudio();
    }

    async function abrirDialogoPortal() {
        var dlg = $('dlg-portal-estudio');
        if (!dlg) return;
        limpiarEnlaceTemporal();
        feedback('');
        pintarCabeceraModal();
        pintarResumenF29();
        if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
        else dlg.setAttribute('open', 'open');
        await cargarSesionYEnlaces();
    }

    function abrirVistaPrevia() {
        var snap = construirSnapshot(seccionesSeleccionadas());
        try {
            window.localStorage.setItem(K_PREVIEW, JSON.stringify(snap));
        } catch (e) {
            feedback('No pudimos guardar la vista previa local en este navegador.', 'error');
            return;
        }
        window.open('/portal-estudio?preview=1', '_blank', 'noopener');
    }

    async function generarEnlace(ev) {
        if (ev) ev.preventDefault();
        if (!sesion.autenticado) {
            feedback('Inicia sesión primero o usa Vista previa Marca Blanca.', 'error');
            return;
        }
        var btn = $('btn-portal-generar');
        var sec = seccionesSeleccionadas();
        var dias = Number(val('portal-vigencia-dias', '15')) || 15;
        var snap = construirSnapshot(sec);
        feedback('');
        if (btn) btn.disabled = true;
        try {
            var res = await fetch('/api/pyme/portal-estudio', {
                method: 'POST',
                credentials: 'same-origin',
                headers: headersEstudio(true),
                body: JSON.stringify({ diasVigencia: dias, secciones: sec, snapshot: snap })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.ok === false) {
                throw new Error(data.error || 'No pudimos crear el enlace del portal.');
            }
            if ($('portal-enlace-url')) $('portal-enlace-url').textContent = data.enlace || '';
            if ($('portal-enlace-creado-box')) $('portal-enlace-creado-box').hidden = false;
            feedback('Enlace seguro creado. Cópialo ahora para enviarlo a tu cliente.', 'ok');
            await cargarSesionYEnlaces();
        } catch (err) {
            feedback((err && err.message) || 'Error al generar el enlace.', 'error');
        } finally {
            if (btn) btn.disabled = !sesion.autenticado;
        }
    }

    async function revocarEnlace(id) {
        if (!id) return;
        if (typeof window.confirm === 'function' && !window.confirm('¿Revocar este enlace del portal? El cliente perderá el acceso de inmediato.')) return;
        feedback('');
        try {
            var res = await fetch('/api/pyme/portal-estudio?id=' + encodeURIComponent(id), {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: headersEstudio(true),
                body: JSON.stringify({ id: id })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || data.ok === false) throw new Error(data.error || 'No pudimos revocar el enlace.');
            feedback('Enlace revocado correctamente.', 'ok');
            await cargarSesionYEnlaces();
        } catch (err) {
            feedback((err && err.message) || 'No pudimos revocar el enlace.', 'error');
        }
    }

    async function copiarEnlace() {
        var txt = $('portal-enlace-url') ? $('portal-enlace-url').textContent.trim() : '';
        if (!txt) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
            feedback('Enlace del portal copiado al portapapeles.', 'ok');
            if (D && D.avisar) D.avisar('Enlace del portal copiado.');
        } catch (e) {
            feedback('Selecciona el enlace y usa Ctrl+C.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var dlg = $('dlg-portal-estudio');
        if (!dlg) return;

        ['btn-rep-abrir-portal', 'btn-torre-portal', 'btn-buzon-abrir-portal', 'btn-buzon-vacio-portal'].forEach(function (id) {
            var b = $(id);
            if (b) b.addEventListener('click', abrirDialogoPortal);
        });
        if ($('btn-bancos-ver-buzon')) {
            $('btn-bancos-ver-buzon').addEventListener('click', function () {
                var br = window.CLSuiteSiiBridge;
                if (br && br.cambiarModulo) br.cambiarModulo('buzon');
                else abrirDialogoPortal();
            });
        }
        if ($('btn-portal-ir-buzon')) {
            $('btn-portal-ir-buzon').addEventListener('click', function () {
                cerrar();
                var br = window.CLSuiteSiiBridge;
                if (br && br.cambiarModulo) br.cambiarModulo('buzon');
            });
        }

        function cerrar() {
            limpiarEnlaceTemporal();
            if (dlg.open && typeof dlg.close === 'function') dlg.close();
            else dlg.removeAttribute('open');
        }
        if ($('btn-cerrar-portal-dlg')) $('btn-cerrar-portal-dlg').addEventListener('click', cerrar);
        if ($('btn-portal-listo')) $('btn-portal-listo').addEventListener('click', cerrar);
        dlg.addEventListener('close', limpiarEnlaceTemporal);

        if ($('btn-portal-ir-sesion')) {
            $('btn-portal-ir-sesion').addEventListener('click', function () { window.open('/app', '_blank'); });
        }
        if ($('btn-portal-ir-membrete')) {
            $('btn-portal-ir-membrete').addEventListener('click', function () {
                cerrar();
                if (window.CLSuiteSiiBridge && window.CLSuiteSiiBridge.cambiarModulo) {
                    window.CLSuiteSiiBridge.cambiarModulo('reportes');
                }
                if ($('rep-estudio-nombre')) $('rep-estudio-nombre').focus();
            });
        }
        if ($('btn-portal-vista-previa')) $('btn-portal-vista-previa').addEventListener('click', abrirVistaPrevia);
        if ($('form-portal-estudio')) $('form-portal-estudio').addEventListener('submit', generarEnlace);
        if ($('btn-portal-copiar-url')) $('btn-portal-copiar-url').addEventListener('click', copiarEnlace);
        if ($('btn-portal-copiar-resumen')) $('btn-portal-copiar-resumen').addEventListener('click', copiarResumenYEnlace);

        if ($('tbody-portal-enlaces')) {
            $('tbody-portal-enlaces').addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-portal-revocar]');
                if (btn) revocarEnlace(btn.getAttribute('data-portal-revocar'));
            });
        }

        async function manejarAccionBuzon(ev) {
            var btnAp = ev.target.closest('[data-buzon-aplicar]');
            var btnDesc = ev.target.closest('[data-buzon-descargar]');
            var btnEst = ev.target.closest('[data-buzon-estado]');
            if (!btnAp && !btnDesc && !btnEst) return;

            feedbackVistaBuzon('');
            if (btnEst) {
                var idE = btnEst.getAttribute('data-buzon-estado');
                var nextE = btnEst.getAttribute('data-buzon-next') || 'procesado';
                var localE = buzonCache.find(function (x) { return x && x.id === idE && x.demo; });
                if (localE) {
                    var demos = leerItemsDemo().map(function (x) {
                        return x.id === idE ? Object.assign({}, x, { estado: nextE }) : x;
                    });
                    guardarItemsDemo(demos);
                    pintarTablaBuzon(demos);
                    return;
                }
                try {
                    var rEst = await fetch('/api/pyme/portal-estudio-buzon?id=' + encodeURIComponent(idE), {
                        method: 'PUT',
                        credentials: 'same-origin',
                        headers: headersEstudio(true),
                        body: JSON.stringify({ id: idE, estado: nextE })
                    });
                    var jEst = await rEst.json().catch(function () { return {}; });
                    if (!rEst.ok || jEst.ok === false) throw new Error(jEst.error || 'No pudimos cambiar el estado.');
                    await cargarBuzonEstudio();
                } catch (err) {
                    feedbackVistaBuzon((err && err.message) || 'Error al actualizar estado.', 'error');
                }
                return;
            }

            var idItem = (btnAp && btnAp.getAttribute('data-buzon-aplicar')) || (btnDesc && btnDesc.getAttribute('data-buzon-descargar'));
            if (!idItem) return;

            try {
                var it = buzonCache.find(function (x) { return x && x.id === idItem && x.demo; });
                if (!it) {
                    var rIt = await fetch('/api/pyme/portal-estudio-buzon?id=' + encodeURIComponent(idItem), {
                        credentials: 'same-origin',
                        headers: headersEstudio(false)
                    });
                    var jIt = await rIt.json().catch(function () { return {}; });
                    if (!rIt.ok || jIt.ok === false || !jIt.item) throw new Error(jIt.error || 'No pudimos descargar el archivo.');
                    it = jIt.item;
                }

                if (btnAp) {
                    var br = window.CLSuiteSiiBridge;
                    if (!br || !br.importarCartolaBuffer) throw new Error('El importador bancario no está disponible.');
                    if (it.clienteNombre && br.cambiarACliente && String(br.clienteNombre() || '').trim().toLowerCase() !== String(it.clienteNombre).trim().toLowerCase()) {
                        br.cambiarACliente(it.clienteNombre);
                    }
                    var bytes = it.contenidoBase64 ? base64ABytes(it.contenidoBase64) : new TextEncoder().encode(it.nota || '');
                    var okCart = br.importarCartolaBuffer(it.nombreArchivo, bytes.buffer);
                    if (okCart) {
                        if (it.demo) {
                            var demosUp = leerItemsDemo().map(function (x) {
                                return x.id === it.id ? Object.assign({}, x, { estado: 'procesado' }) : x;
                            });
                            guardarItemsDemo(demosUp);
                            pintarTablaBuzon(demosUp);
                        } else {
                            await fetch('/api/pyme/portal-estudio-buzon?id=' + encodeURIComponent(it.id), {
                                method: 'PUT',
                                credentials: 'same-origin',
                                headers: headersEstudio(true),
                                body: JSON.stringify({ id: it.id, estado: 'procesado' })
                            });
                            await cargarBuzonEstudio();
                        }
                        if (br.cambiarModulo) br.cambiarModulo('bancos');
                        if (D && D.avisar) D.avisar('Cartola aplicada en Bancos y marcada como procesada.');
                    }
                } else if (btnDesc) {
                    var blob = it.contenidoBase64
                        ? new Blob([base64ABytes(it.contenidoBase64)], { type: it.mimeType || 'application/octet-stream' })
                        : new Blob([it.nota || ''], { type: 'text/plain;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = it.nombreArchivo || 'archivo-cliente';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                }
            } catch (err) {
                feedbackVistaBuzon((err && err.message) || 'No pudimos procesar el archivo.', 'error');
            }
        }

        if ($('tbody-suite-buzon')) $('tbody-suite-buzon').addEventListener('click', manejarAccionBuzon);
        if ($('buzon-movil-lista')) $('buzon-movil-lista').addEventListener('click', manejarAccionBuzon);

        ['buzon-filtro-cliente', 'buzon-filtro-periodo', 'buzon-filtro-tipo', 'buzon-filtro-estado'].forEach(function (id) {
            var el = $(id);
            if (el) el.addEventListener('change', function () { pintarTablaBuzon(buzonCache); });
        });

        if ($('btn-buzon-cargar-demo')) {
            $('btn-buzon-cargar-demo').addEventListener('click', function () {
                var demos = crearEnviosDemo();
                guardarItemsDemo(demos);
                if ($('buzon-filtro-estado')) $('buzon-filtro-estado').value = 'pendiente';
                pintarTablaBuzon(demos);
                feedbackVistaBuzon('Envíos de ejemplo cargados. Puedes probar "Aplicar a período" en la cartola CSV.', 'ok');
            });
        }
        if ($('btn-buzon-iniciar-sesion')) {
            $('btn-buzon-iniciar-sesion').addEventListener('click', function () {
                var btnEntrar = $('btn-entrar');
                if (btnEntrar) btnEntrar.click();
                else window.open('/app', '_blank');
            });
        }

        Array.prototype.forEach.call(document.querySelectorAll('.buzon-tpl-btn'), function (b) {
            b.addEventListener('click', function () {
                generarPlantillaSaliente(b.getAttribute('data-buzon-tpl'));
            });
        });
        if ($('btn-buzon-copiar-msg')) {
            $('btn-buzon-copiar-msg').addEventListener('click', async function () {
                var asunto = $('buzon-sal-asunto') ? $('buzon-sal-asunto').value.trim() : '';
                var msg = $('buzon-sal-mensaje') ? $('buzon-sal-mensaje').value.trim() : '';
                if (!msg) return;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(msg);
                    }
                    registrarSaliente('Copiado', asunto || 'Mensaje al cliente');
                    if (D && D.avisar) D.avisar('Mensaje copiado para enviar por WhatsApp o correo.');
                } catch (e) {
                    feedbackVistaBuzon('Selecciona el mensaje y cópialo con Ctrl+C.', 'error');
                }
            });
        }
        if ($('btn-buzon-abrir-mailto')) {
            $('btn-buzon-abrir-mailto').addEventListener('click', function () {
                var correo = $('buzon-sal-correo') ? $('buzon-sal-correo').value.trim() : '';
                var asunto = $('buzon-sal-asunto') ? $('buzon-sal-asunto').value.trim() : '';
                var msg = $('buzon-sal-mensaje') ? $('buzon-sal-mensaje').value.trim() : '';
                var href = 'mailto:' + encodeURIComponent(correo) + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(msg);
                registrarSaliente(correo ? ('Correo (' + correo + ')') : 'Correo', asunto || 'Mensaje al cliente');
                window.location.href = href;
            });
        }

        document.addEventListener('demo:cliente', cargarBuzonEstudio);
        document.addEventListener('demo:estudio-cambiado', cargarBuzonEstudio);
        cargarSesionYEnlaces();

        window.addEventListener('focus', function () {
            if (dlg.open && !sesion.autenticado) cargarSesionYEnlaces();
        });
    });

    window.CLDemoPortalEstudio = {
        abrirDialogoPortal: abrirDialogoPortal,
        construirSnapshot: construirSnapshot,
        refrescarBuzon: cargarBuzonEstudio
    };
})();
