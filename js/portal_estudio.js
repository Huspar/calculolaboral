/*
 * CálculoLaboral · Vista autónoma del Portal Cliente Marca Blanca (/portal-estudio)
 * Solo lectura. Lee ?t=<token> desde /api/pyme/portal-estudio o ?preview=1 desde localStorage.
 */
(function () {
    'use strict';

    var LEYENDA_DEFECTO = 'Acceso de solo lectura e informativo. Esta vista contiene información tributaria y laboral confidencial puesta a disposición exclusivamente para el representante autorizado de la empresa cliente por su estudio contable (en calidad de encargado del tratamiento, Ley N° 21.719 y art. 154 ter del Código del Trabajo). Este enlace temporal y revocable no permite modificar datos ni constituye declaración oficial presentada ante el SII, Previred o la Dirección del Trabajo. Prohibida su difusión o reenvío a terceros no autorizados.';

    var MAX_ARCHIVO_BYTES = 1024 * 1024;
    var EXT_PERMITIDAS = /\.(csv|xlsx|xls|pdf|txt|tsv|json)$/i;
    var TIPO_LABELS = {
        cartola: 'Cartola bancaria',
        novedades: 'Novedades de sueldo',
        otro: 'Documento del mes'
    };
    var DEMO_CATALOG = {
        'san-isidro': {
            estudio: { nombre: 'Asesorías Pérez Ltda.', contador: 'Camila Vega', pie: 'Portal Marca Blanca emitido por Asesorías Pérez Ltda.' },
            cliente: { id: 'san-isidro', nombre: 'Panadería San Isidro SpA', rut: '76.543.210-3', periodo: 'Noviembre 2026', cerradoTributario: false },
            f29: { ivaDeterminado: 1527300, retenciones: 727679, ppm: 24125, totalPagar: 2279104, vencimientos: [{ titulo: 'Acuses 8 días (Ley 19.983)', fechaLimite: '2 por vencer', estado: 'critico' }, { titulo: 'PreviRed', fechaLimite: 'Día 13 · Al día', estado: 'ok' }, { titulo: 'Declaración F29 SII', fechaLimite: '20/11/2026', estado: 'proximo' }] },
            pnl: { ingresos: 18400000, costos: 7460337, gastos: 10960000, resultado: -20337 },
            laboral: { cantidadTrabajadores: 6, totalHaberes: 7630000, totalLiquido: 6398400, totalCostoEmpresa: 8060000, trabajadores: [] },
            secciones: { buzon: true }
        },
        'andes-sur': {
            estudio: { nombre: 'Asesorías Pérez Ltda.', contador: 'Camila Vega', pie: 'Portal Marca Blanca emitido por Asesorías Pérez Ltda.' },
            cliente: { id: 'andes-sur', nombre: 'Constructora Andes Sur Ltda.', rut: '77.128.450-7', periodo: 'Noviembre 2026', cerradoTributario: false },
            f29: { ivaDeterminado: 2890000, retenciones: 314000, ppm: 340000, totalPagar: 3544000, vencimientos: [{ titulo: 'PreviRed · Ley Bustos', fechaLimite: 'Regularizar', estado: 'critico' }, { titulo: 'Declaración F29 SII', fechaLimite: '20/11/2026', estado: 'proximo' }] },
            pnl: { ingresos: 42500000, costos: 24100000, gastos: 9800000, resultado: 8600000 },
            laboral: { cantidadTrabajadores: 2, totalHaberes: 3400000, totalLiquido: 2890000, totalCostoEmpresa: 3610000, trabajadores: [] },
            secciones: { buzon: true }
        },
        'dental-providencia': {
            estudio: { nombre: 'Asesorías Pérez Ltda.', contador: 'Diego Soto', pie: 'Portal Marca Blanca emitido por Asesorías Pérez Ltda.' },
            cliente: { id: 'dental-providencia', nombre: 'Clínica Dental Providencia SpA', rut: '76.901.332-6', periodo: 'Noviembre 2026', cerradoTributario: false },
            f29: { ivaDeterminado: 0, retenciones: 480000, ppm: 160000, totalPagar: 640000, vencimientos: [{ titulo: 'Cartola Banco BCI', fechaLimite: 'Pendiente subir', estado: 'proximo' }, { titulo: 'Declaración F29 SII', fechaLimite: '20/11/2026', estado: 'proximo' }] },
            pnl: { ingresos: 14200000, costos: 3200000, gastos: 4900000, resultado: 6100000 },
            laboral: { cantidadTrabajadores: 1, totalHaberes: 1100000, totalLiquido: 912000, totalCostoEmpresa: 1165000, trabajadores: [] },
            secciones: { buzon: true }
        }
    };

    var buzonState = {
        token: '',
        clienteId: '',
        esPreview: false,
        archivo: null
    };

    function $(id) { return document.getElementById(id); }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function money(n) {
        var v = Math.round(Number(n) || 0);
        var signo = v < 0 ? '-' : '';
        return signo + '$' + Math.abs(v).toLocaleString('es-CL');
    }

    function fechaCorta(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function mostrarError(titulo, desc, sello) {
        if ($('pe-estado-cargando')) $('pe-estado-cargando').hidden = true;
        if ($('pe-contenido')) $('pe-contenido').hidden = true;
        if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = true;
        if ($('pe-estado-error')) $('pe-estado-error').hidden = false;
        if ($('pe-error-sello') && sello) $('pe-error-sello').textContent = sello;
        if ($('pe-error-titulo') && titulo) $('pe-error-titulo').textContent = titulo;
        if ($('pe-error-desc') && desc) $('pe-error-desc').textContent = desc;
    }

    function pintarPortal(portal, esPreview) {
        if ($('pe-estado-cargando')) $('pe-estado-cargando').hidden = true;
        if ($('pe-estado-error')) $('pe-estado-error').hidden = true;
        if ($('pe-banner-preview')) $('pe-banner-preview').hidden = !esPreview;

        var tieneBuzon = Boolean(portal && (!portal.secciones || portal.secciones.buzon !== false));
        if (!portal || (!portal.f29 && !portal.pnl && !portal.laboral && !tieneBuzon)) {
            if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = false;
            return;
        }
        if ($('pe-estado-vacio')) $('pe-estado-vacio').hidden = true;
        if ($('pe-contenido')) $('pe-contenido').hidden = false;

        var est = portal.estudio || {};
        var cli = portal.cliente || {};
        if ($('pe-estudio-nombre')) $('pe-estudio-nombre').textContent = est.nombre || 'Estudio Contable';
        if ($('pe-estudio-meta')) {
            var meta = [];
            if (est.rut) meta.push('RUT ' + est.rut);
            if (est.contador) meta.push(est.contador);
            $('pe-estudio-meta').textContent = meta.join(' · ');
        }
        if ($('pe-cliente-nombre')) $('pe-cliente-nombre').textContent = cli.nombre || 'Empresa Cliente';
        if ($('pe-cliente-rut')) $('pe-cliente-rut').textContent = cli.rut || 'Sin RUT';
        if ($('pe-periodo-badge')) $('pe-periodo-badge').textContent = cli.periodo || '';

        if (portal.f29 && $('pe-card-f29')) {
            $('pe-card-f29').hidden = false;
            if ($('pe-f29-estado')) {
                $('pe-f29-estado').textContent = cli.cerradoTributario ? 'Período cerrado' : 'Período abierto';
                $('pe-f29-estado').className = 'sello ' + (cli.cerradoTributario ? 'sello-emitida' : 'sello-preparada');
            }
            if ($('pe-f29-iva')) $('pe-f29-iva').textContent = money(portal.f29.ivaDeterminado);
            if ($('pe-f29-ret')) $('pe-f29-ret').textContent = money(portal.f29.retenciones);
            if ($('pe-f29-ppm')) $('pe-f29-ppm').textContent = money(portal.f29.ppm);
            if ($('pe-f29-total')) $('pe-f29-total').textContent = money(portal.f29.totalPagar);

            var notaF29 = $('pe-f29-nota');
            if (notaF29) {
                if (portal.f29.postergadoIva) {
                    notaF29.hidden = false;
                    notaF29.textContent = 'Postergación de IVA (Cód. 756) activa: ' + money(portal.f29.montoPostergado) + ' diferidos a 2 meses.';
                } else if (portal.f29.remanente > 0) {
                    notaF29.hidden = false;
                    notaF29.textContent = 'Remanente de crédito fiscal a favor (Cód. 77): ' + money(portal.f29.remanente) + '.';
                } else {
                    notaF29.hidden = true;
                }
            }

            var ul = $('pe-lista-vencimientos');
            if (ul) {
                var vencs = Array.isArray(portal.f29.vencimientos) ? portal.f29.vencimientos : [];
                ul.innerHTML = vencs.map(function (v) {
                    var cls = v.estado === 'vencido' || v.estado === 'critico' ? 'sello-riesgo' : (v.estado === 'proximo' ? 'sello-preparada' : 'sello-emitida');
                    return '<li class="preval-hallazgo-item">' +
                        '<span>' + esc(v.titulo) + '</span>' +
                        '<span class="sello ' + cls + ' mono">' + esc(v.fechaLimite) + '</span>' +
                        '</li>';
                }).join('');
            }
        }

        if (portal.pnl && $('pe-card-pnl')) {
            $('pe-card-pnl').hidden = false;
            if ($('pe-pnl-ingresos')) $('pe-pnl-ingresos').textContent = money(portal.pnl.ingresos);
            if ($('pe-pnl-costos')) $('pe-pnl-costos').textContent = money(portal.pnl.costos);
            if ($('pe-pnl-gastos')) $('pe-pnl-gastos').textContent = money(portal.pnl.gastos);
            if ($('pe-pnl-resultado')) $('pe-pnl-resultado').textContent = money(portal.pnl.resultado);
        }

        if (portal.laboral && $('pe-card-laboral')) {
            $('pe-card-laboral').hidden = false;
            if ($('pe-lab-cnt')) $('pe-lab-cnt').textContent = String(portal.laboral.cantidadTrabajadores || 0);
            if ($('pe-lab-haberes')) $('pe-lab-haberes').textContent = money(portal.laboral.totalHaberes);
            if ($('pe-lab-liquido')) $('pe-lab-liquido').textContent = money(portal.laboral.totalLiquido);
            if ($('pe-lab-costo')) $('pe-lab-costo').textContent = money(portal.laboral.totalCostoEmpresa);

            var trab = Array.isArray(portal.laboral.trabajadores) ? portal.laboral.trabajadores : [];
            var wrap = $('pe-lab-tabla-wrap');
            var tbody = $('tbody-pe-trabajadores');
            if (wrap && tbody && trab.length) {
                wrap.hidden = false;
                tbody.innerHTML = trab.map(function (t) {
                    return '<tr>' +
                        '<td><strong>' + esc(t.nombre) + '</strong></td>' +
                        '<td class="mono">' + esc(t.rut || '') + '</td>' +
                        '<td class="mono num">' + esc(t.dias) + '</td>' +
                        '<td class="mono num">' + money(t.haberes) + '</td>' +
                        '<td class="mono num"><strong>' + money(t.liquido) + '</strong></td>' +
                        '</tr>';
                }).join('');
            } else if (wrap) {
                wrap.hidden = true;
            }
        }

        if ($('pe-card-buzon')) {
            $('pe-card-buzon').hidden = !tieneBuzon;
        }

        if ($('pe-estudio-pie')) $('pe-estudio-pie').textContent = est.pie || 'Documento informativo emitido por tu estudio contable.';
        if ($('pe-leyenda-legal')) $('pe-leyenda-legal').textContent = portal.leyendaLegal || LEYENDA_DEFECTO;
        if ($('pe-vence-txt')) {
            $('pe-vence-txt').textContent = portal.vence ? ('Válido hasta: ' + fechaCorta(portal.vence)) : 'Vista previa';
        }
    }

    function feedbackBuzon(texto, tipo) {
        var box = $('pe-buzon-feedback');
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

    function pintarListaBuzon(items) {
        var ul = $('pe-buzon-lista');
        var vacio = $('pe-buzon-vacio');
        if (!ul || !vacio) return;
        var lista = Array.isArray(items) ? items : [];
        if (!lista.length) {
            ul.innerHTML = '';
            vacio.hidden = false;
            return;
        }
        vacio.hidden = true;
        ul.innerHTML = lista.map(function (it) {
            var estCls = it.estado === 'procesado' ? 'sello-emitida' : 'sello-guardada';
            var estTxt = it.estado === 'procesado' ? 'Procesado por el estudio' : 'Enviado';
            var tipoTxt = TIPO_LABELS[it.tipo] || 'Documento';
            var kb = Math.max(1, Math.round((Number(it.tamanoBytes) || 0) / 1024));
            return '<li class="pe-buzon-item">' +
                '<div>' +
                '<strong>' + esc(it.nombreArchivo) + '</strong> <span class="app-nav-chip">' + esc(tipoTxt) + '</span>' +
                '<div class="texto-ayuda mono" style="margin-top:2px">' + esc(fechaCorta(it.creado)) + ' · ' + kb + ' KB</div>' +
                (it.nota ? '<p class="texto-ayuda" style="margin:4px 0 0">' + esc(it.nota) + '</p>' : '') +
                '</div>' +
                '<span class="sello ' + estCls + '">' + esc(estTxt) + '</span>' +
                '</li>';
        }).join('');
    }

    async function cargarHistorialBuzon() {
        if (!buzonState.token || buzonState.esPreview) {
            pintarListaBuzon([]);
            return;
        }
        try {
            var res = await fetch('/api/pyme/portal-estudio-buzon?t=' + encodeURIComponent(buzonState.token), {
                headers: { accept: 'application/json' }
            });
            var j = res.ok ? await res.json().catch(function () { return {}; }) : {};
            if (res.ok && j.ok !== false) pintarListaBuzon(j.items || []);
        } catch (e) { /* silencioso */ }
    }

    function seleccionarArchivoBuzon(file) {
        var estEl = $('pe-buzon-file-estado');
        var dropEl = $('pe-buzon-drop');
        var titEl = $('pe-buzon-drop-titulo');
        var btnQuitar = $('btn-pe-buzon-quitar');
        if (dropEl) {
            dropEl.classList.remove('tiene-archivo', 'tiene-error');
        }
        if (btnQuitar) btnQuitar.hidden = true;
        if (!file) {
            buzonState.archivo = null;
            if (titEl) titEl.textContent = 'Arrastra tu archivo o haz clic para seleccionarlo';
            if (estEl) estEl.textContent = 'Ningún archivo seleccionado · Máx. 1 MB (.csv, .xlsx, .xls, .pdf, .txt)';
            return;
        }
        if (!EXT_PERMITIDAS.test(file.name)) {
            buzonState.archivo = null;
            if (dropEl) dropEl.classList.add('tiene-error');
            if (estEl) estEl.textContent = 'Formato no admitido (' + file.name + ')';
            feedbackBuzon('Usa archivos CSV, Excel (.xlsx/.xls), TXT o PDF.', 'error');
            return;
        }
        if (file.size > MAX_ARCHIVO_BYTES) {
            buzonState.archivo = null;
            if (dropEl) dropEl.classList.add('tiene-error');
            if (estEl) estEl.textContent = 'Archivo supera el máximo de 1 MB';
            feedbackBuzon('El archivo supera el límite de 1 MB. Comprime o exporta solo el mes.', 'error');
            return;
        }
        feedbackBuzon('');
        buzonState.archivo = file;
        var kb = Math.max(1, Math.round(file.size / 1024));
        if (dropEl) dropEl.classList.add('tiene-archivo');
        if (titEl) titEl.textContent = 'Archivo listo para enviar';
        if (estEl) estEl.textContent = file.name + ' · ' + kb + ' KB';
        if (btnQuitar) btnQuitar.hidden = false;
    }

    function leerArchivoBase64(file) {
        return new Promise(function (resolve, reject) {
            var rd = new FileReader();
            rd.onload = function () {
                var res = String(rd.result || '');
                var idx = res.indexOf(',');
                resolve(idx >= 0 ? res.slice(idx + 1) : res);
            };
            rd.onerror = function () { reject(new Error('No pudimos leer el archivo seleccionado.')); };
            rd.readAsDataURL(file);
        });
    }

    function loadLocalBuzon(cid) {
        try {
            var raw = window.localStorage.getItem('cl_portal_demo_buzon_' + (cid || 'preview'));
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    function saveLocalBuzon(cid, items) {
        try {
            window.localStorage.setItem('cl_portal_demo_buzon_' + (cid || 'preview'), JSON.stringify(items));
        } catch (_) {}
    }

    async function enviarAlBuzon(ev) {
        if (ev) ev.preventDefault();
        var notaEl = $('pe-buzon-nota');
        var tipoEl = $('pe-buzon-tipo');
        var btn = $('btn-pe-buzon-enviar');
        var nota = notaEl ? notaEl.value.trim() : '';
        var tipo = tipoEl ? tipoEl.value : 'cartola';

        if (!buzonState.archivo && !nota) {
            feedbackBuzon('Adjunta un archivo o escribe una nota para tu contador.', 'error');
            return;
        }
        if (buzonState.esPreview) {
            var prevItems = loadLocalBuzon(buzonState.clienteId);
            prevItems.unshift({
                nombreArchivo: buzonState.archivo ? buzonState.archivo.name : 'Nota sin adjunto.txt',
                tipo: tipo,
                tamanoBytes: buzonState.archivo ? buzonState.archivo.size : 1024,
                nota: nota,
                creado: new Date().toISOString(),
                estado: 'enviado'
            });
            saveLocalBuzon(buzonState.clienteId, prevItems);
            if (notaEl) notaEl.value = '';
            if ($('pe-buzon-archivo')) $('pe-buzon-archivo').value = '';
            seleccionarArchivoBuzon(null);
            pintarListaBuzon(prevItems);
            feedbackBuzon('Documento enviado en modo demostración. En producción llega cifrado a la Bandeja de tu estudio en /demo-contadores.', 'ok');
            return;
        }

        feedbackBuzon('Enviando documento cifrado al estudio...', 'ok');
        if (btn) btn.disabled = true;
        try {
            var base64 = buzonState.archivo ? await leerArchivoBase64(buzonState.archivo) : '';
            var res = await fetch('/api/pyme/portal-estudio-buzon?t=' + encodeURIComponent(buzonState.token), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({
                    tipo: tipo,
                    nota: nota,
                    nombreArchivo: buzonState.archivo ? buzonState.archivo.name : '',
                    mimeType: buzonState.archivo ? (buzonState.archivo.type || 'application/octet-stream') : 'text/plain',
                    contenidoBase64: base64
                })
            });
            var json = await res.json().catch(function () { return {}; });
            if (!res.ok || json.ok === false) {
                throw new Error(json.error || 'No pudimos enviar el documento.');
            }
            if (notaEl) notaEl.value = '';
            if ($('pe-buzon-archivo')) $('pe-buzon-archivo').value = '';
            seleccionarArchivoBuzon(null);
            feedbackBuzon('Enviado de forma segura a tu estudio contable.', 'ok');
            await cargarHistorialBuzon();
        } catch (err) {
            feedbackBuzon((err && err.message) || 'Error al enviar el documento.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        var qs = new URLSearchParams(window.location.search || '');
        var clienteId = (qs.get('cliente') || qs.get('empresa') || '').trim();
        var preview = qs.get('preview') === '1' || Boolean(clienteId);
        var token = (qs.get('t') || '').trim();
        buzonState.esPreview = preview && !token;
        buzonState.clienteId = clienteId || 'preview';
        buzonState.token = token;

        var drop = $('pe-buzon-drop');
        var inp = $('pe-buzon-archivo');
        var btnQuitar = $('btn-pe-buzon-quitar');
        if (btnQuitar) {
            btnQuitar.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (inp) inp.value = '';
                seleccionarArchivoBuzon(null);
            });
        }
        if (drop && inp) {
            drop.addEventListener('click', function (ev) {
                if (ev.target && ev.target.closest && ev.target.closest('#btn-pe-buzon-quitar')) return;
                inp.click();
            });
            drop.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inp.click(); }
            });
            drop.addEventListener('dragover', function (ev) { ev.preventDefault(); drop.classList.add('over'); });
            drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
            drop.addEventListener('drop', function (ev) {
                ev.preventDefault();
                drop.classList.remove('over');
                if (ev.dataTransfer.files && ev.dataTransfer.files[0]) seleccionarArchivoBuzon(ev.dataTransfer.files[0]);
            });
            inp.addEventListener('change', function () {
                if (inp.files && inp.files[0]) seleccionarArchivoBuzon(inp.files[0]);
            });
        }
        if ($('form-pe-buzon')) $('form-pe-buzon').addEventListener('submit', enviarAlBuzon);

        if (preview && !token) {
            try {
                var raw = (clienteId && window.localStorage.getItem('cl_portal_demo_' + clienteId))
                    || window.localStorage.getItem('cl_portal_estudio_preview');
                var parsed = raw ? JSON.parse(raw) : (DEMO_CATALOG[clienteId] || DEMO_CATALOG['san-isidro']);
                pintarPortal(parsed, true);
                pintarListaBuzon(loadLocalBuzon(buzonState.clienteId));
            } catch (e) {
                mostrarError('No pudimos cargar la vista previa', 'Vuelve a generar el enlace desde el panel del estudio.', 'Error local');
            }
            return;
        }

        if (!token) {
            mostrarError('Enlace incompleto', 'Falta el código de acceso en la dirección. Pide el enlace completo a tu estudio contable.', 'Enlace inválido');
            return;
        }

        try {
            var res = await fetch('/api/pyme/portal-estudio?t=' + encodeURIComponent(token), {
                headers: { accept: 'application/json' }
            });
            var json = await res.json().catch(function () { return {}; });
            if (!res.ok || json.ok === false) {
                var titulo = json.codigo === 'enlace_revocado'
                    ? 'Este enlace fue revocado'
                    : (json.codigo === 'enlace_vencido' ? 'Este enlace venció' : 'Enlace no disponible');
                mostrarError(titulo, json.error || 'Solicita un nuevo enlace a tu estudio contable.', 'Acceso cerrado');
                return;
            }
            pintarPortal(json.portal, false);
            cargarHistorialBuzon();
        } catch (err) {
            mostrarError('Error de conexión', 'No pudimos conectar con el servidor. Intenta nuevamente en unos minutos.', 'Sin conexión');
        }
    });
})();
