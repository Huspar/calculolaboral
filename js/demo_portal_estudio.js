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

    function base64ABytes(b64) {
        var bin = window.atob(String(b64 || ''));
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
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

    function pintarTablaBuzon(items) {
        var tbody = $('tbody-portal-buzon');
        var vacio = $('portal-buzon-vacio');
        var wrap = $('portal-buzon-tabla-wrap');
        if (!tbody) return;
        var lista = Array.isArray(items) ? items : [];
        actualizarAlertasBuzon(lista);
        if (!lista.length) {
            tbody.innerHTML = '';
            if (vacio) vacio.hidden = false;
            if (wrap) wrap.hidden = true;
            return;
        }
        if (vacio) vacio.hidden = true;
        if (wrap) wrap.hidden = false;
        tbody.innerHTML = lista.map(function (it) {
            var proc = it.estado === 'procesado';
            var selloCls = proc ? 'sello-emitida' : 'sello-preparada';
            var selloTxt = proc ? 'Procesado' : 'Pendiente';
            var esCartola = it.tipo === 'cartola' && /\.(csv|txt|tsv|xlsx|xls)$/i.test(String(it.nombreArchivo || ''));
            return '<tr>' +
                '<td><strong>' + esc(it.nombreArchivo) + '</strong><br><span class="texto-ayuda">' + esc(it.clienteNombre) + ' · <span class="mono">' + esc(it.periodo) + '</span> · ' + esc(TIPO_BUZON_LBL[it.tipo] || it.tipo) + '</span></td>' +
                '<td>' + (it.nota ? esc(it.nota) : '<span class="texto-ayuda">Sin nota</span>') + '</td>' +
                '<td><span class="sello ' + selloCls + '">' + selloTxt + '</span></td>' +
                '<td class="num"><div class="match-acciones-fila" style="justify-content:flex-end">' +
                (esCartola ? '<button type="button" class="btn btn-chico btn-primario" data-buzon-aplicar="' + esc(it.id) + '">Aplicar a período</button>' : '') +
                '<button type="button" class="btn btn-chico" data-buzon-descargar="' + esc(it.id) + '">Descargar</button>' +
                '<button type="button" class="btn-texto" data-buzon-estado="' + esc(it.id) + '" data-buzon-next="' + (proc ? 'nuevo' : 'procesado') + '">' + (proc ? 'Reabrir' : 'Procesado') + '</button>' +
                '</div></td>' +
                '</tr>';
        }).join('');
    }

    async function cargarBuzonEstudio() {
        if (!sesion.autenticado) {
            actualizarAlertasBuzon([]);
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
        if (buzonWrap) buzonWrap.hidden = !sesion.autenticado;

        if (!sesion.autenticado) {
            actualizarAlertasBuzon([]);
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

        ['btn-rep-abrir-portal', 'btn-torre-portal', 'btn-bancos-ver-buzon'].forEach(function (id) {
            var b = $(id);
            if (b) b.addEventListener('click', abrirDialogoPortal);
        });

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

        if ($('tbody-portal-buzon')) {
            $('tbody-portal-buzon').addEventListener('click', async function (ev) {
                var btnAp = ev.target.closest('[data-buzon-aplicar]');
                var btnDesc = ev.target.closest('[data-buzon-descargar]');
                var btnEst = ev.target.closest('[data-buzon-estado]');

                if (btnEst) {
                    var idE = btnEst.getAttribute('data-buzon-estado');
                    var nextE = btnEst.getAttribute('data-buzon-next') || 'procesado';
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
                        feedback((err && err.message) || 'Error al actualizar estado.', 'error');
                    }
                    return;
                }

                var idItem = (btnAp && btnAp.getAttribute('data-buzon-aplicar')) || (btnDesc && btnDesc.getAttribute('data-buzon-descargar'));
                if (!idItem) return;

                try {
                    var rIt = await fetch('/api/pyme/portal-estudio-buzon?id=' + encodeURIComponent(idItem), {
                        credentials: 'same-origin',
                        headers: headersEstudio(false)
                    });
                    var jIt = await rIt.json().catch(function () { return {}; });
                    if (!rIt.ok || jIt.ok === false || !jIt.item) throw new Error(jIt.error || 'No pudimos descargar el archivo.');
                    var it = jIt.item;

                    if (btnAp) {
                        var br = window.CLSuiteSiiBridge;
                        if (!br || !br.importarCartolaBuffer) throw new Error('El importador bancario no está disponible.');
                        if (it.clienteNombre && br.cambiarACliente && String(br.clienteNombre() || '').trim().toLowerCase() !== String(it.clienteNombre).trim().toLowerCase()) {
                            br.cambiarACliente(it.clienteNombre);
                        }
                        var bytes = it.contenidoBase64 ? base64ABytes(it.contenidoBase64) : new TextEncoder().encode(it.nota || '');
                        var okCart = br.importarCartolaBuffer(it.nombreArchivo, bytes.buffer);
                        if (okCart) {
                            await fetch('/api/pyme/portal-estudio-buzon?id=' + encodeURIComponent(it.id), {
                                method: 'PUT',
                                credentials: 'same-origin',
                                headers: headersEstudio(true),
                                body: JSON.stringify({ id: it.id, estado: 'procesado' })
                            });
                            cerrar();
                            if (br.cambiarModulo) br.cambiarModulo('bancos');
                            await cargarBuzonEstudio();
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
                    feedback((err && err.message) || 'No pudimos procesar el archivo.', 'error');
                }
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
        construirSnapshot: construirSnapshot
    };
})();
