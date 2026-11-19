/*
 * CalculoLaboral · Adaptador y normalizadores para SII Gateway (Suite Contadores, v1.0.0)
 * Convierte respuestas de /api/pyme/sii-* (connect.calculolaboral.cl) al formato de
 * CLContadoresF29, CLImportadores y CLContabilidad.
 * Funciona en navegador (window.CLSii) y Node (require).
 * Seguridad: nunca guarda claves tributarias, PFX ni API keys en localStorage.
 */
(function (root) {
    'use strict';

    var K_VINCULOS = 'cl-sii-vinculos';
    var JOB_TERMINALES = { COMPLETED: true, FAILED: true, CANCELLED: true, ERROR: true };

    function entero(v) {
        if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
        if (v == null || v === '') return 0;
        var s = String(v).trim().replace(/\$/g, '').replace(/\s+/g, '');
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
        var n = Math.round(Number(s));
        return isFinite(n) ? n : 0;
    }

    function rutModulo() {
        if (typeof module !== 'undefined' && module.exports) {
            try { return require('./rut_cl.js'); } catch (e) { return null; }
        }
        return root.CLRut || null;
    }

    function normalizarRut(v) {
        var R = rutModulo();
        if (R && R.formatear) return R.formatear(v);
        var clean = String(v == null ? '' : v).toUpperCase().replace(/[^0-9K]/g, '');
        if (clean.length < 2) return String(v || '').trim();
        return clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + clean.slice(-1);
    }

    function rutValido(v) {
        var R = rutModulo();
        if (R && R.valido) return R.valido(v);
        var clean = String(v == null ? '' : v).toUpperCase().replace(/[^0-9K]/g, '');
        return clean.length >= 8 && clean.length <= 9;
    }

    function periodoGateway(periodo) {
        var s = String(periodo == null ? '' : periodo).trim();
        var m = /^(\d{4})-?(0[1-9]|1[0-2])$/.exec(s);
        return m ? (m[1] + m[2]) : '';
    }

    function periodoUi(periodo) {
        var s = String(periodo == null ? '' : periodo).trim();
        var m = /^(\d{4})-?(0[1-9]|1[0-2])$/.exec(s);
        return m ? (m[1] + '-' + m[2]) : '';
    }

    function compactarRcvFila(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var row = {
            tipo_doc: entero(raw.tipoDoc !== undefined ? raw.tipoDoc : raw.tipo_doc),
            folio: raw.folio != null ? String(raw.folio) : '',
            rut_contraparte: String(raw.rutContraparte || raw.rut_contraparte || raw.rut || '').trim(),
            razon_social_contraparte: String(raw.razonSocialContraparte || raw.razon_social_contraparte || raw.razonSocial || '').trim().slice(0, 120),
            fecha_emision: String(raw.fechaEmision || raw.fecha_emision || raw.fecha || '').slice(0, 10),
            monto_exento: entero(raw.montoExento !== undefined ? raw.montoExento : (raw.monto_exento !== undefined ? raw.monto_exento : raw.exento)),
            monto_neto: entero(raw.montoNeto !== undefined ? raw.montoNeto : (raw.monto_neto !== undefined ? raw.monto_neto : raw.neto)),
            monto_iva_recuperable: entero(raw.montoIvaRecuperable !== undefined ? raw.montoIvaRecuperable : (raw.monto_iva_recuperable !== undefined ? raw.monto_iva_recuperable : raw.iva)),
            monto_iva_no_rec: entero(raw.montoIvaNoRecuperable !== undefined ? raw.montoIvaNoRecuperable : (raw.monto_iva_no_rec !== undefined ? raw.monto_iva_no_rec : raw.ivaNoRec)),
            iva_uso_comun: entero(raw.montoIvaUsoComun !== undefined ? raw.montoIvaUsoComun : (raw.iva_uso_comun !== undefined ? raw.iva_uso_comun : raw.ivaUsoComun)),
            monto_activo_fijo: entero(raw.montoNetoActivoFijo !== undefined ? raw.montoNetoActivoFijo : (raw.monto_activo_fijo !== undefined ? raw.monto_activo_fijo : raw.netoActivoFijo)),
            monto_iva_activo_fijo: entero(raw.montoIvaActivoFijo !== undefined ? raw.montoIvaActivoFijo : (raw.monto_iva_activo_fijo !== undefined ? raw.monto_iva_activo_fijo : raw.ivaActivoFijo)),
            monto_total: entero(raw.montoTotal !== undefined ? raw.montoTotal : (raw.monto_total !== undefined ? raw.monto_total : raw.total)),
            tipo_transaccion: String(raw.tipoTransaccion || raw.tipo_transaccion || raw.tipoCompra || '1').trim()
        };
        if (!row.monto_total) {
            row.monto_total = row.monto_exento + row.monto_neto + row.monto_iva_recuperable + row.monto_iva_no_rec + row.iva_uso_comun + row.monto_iva_activo_fijo;
        }
        return row;
    }

    function normalizarRcvDesdeGateway(resp, modo) {
        var rcv = (resp && resp.rcv) ? resp.rcv : (resp || {});
        var docs = Array.isArray(rcv.documents) ? rcv.documents : [];
        var modoUpper = modo === 'compras' ? 'COMPRA' : (modo === 'ventas' ? 'VENTA' : '');
        var rows = [];
        var pendientesCount = 0;
        var reclamadosCount = 0;
        var noIncluirCount = 0;

        docs.forEach(function (d) {
            if (!d || typeof d !== 'object') return;
            var op = String(d.operacion || '').toUpperCase();
            if (modoUpper && op && op !== modoUpper) return;

            var estado = String(d.estadoContab || 'REGISTRO').toUpperCase();
            if (estado === 'PENDIENTE') { pendientesCount++; return; }
            if (estado === 'RECLAMADO') { reclamadosCount++; return; }
            if (estado === 'NO_INCLUIR') { noIncluirCount++; return; }

            var compacta = compactarRcvFila(d);
            if (compacta && compacta.tipo_doc > 0) rows.push(compacta);
        });

        var avisos = [];
        if (pendientesCount > 0) avisos.push(pendientesCount + ' documento(s) en estado PENDIENTE de acuse (no incluidos en el F29/crédito).');
        if (reclamadosCount > 0) avisos.push(reclamadosCount + ' documento(s) RECLAMADO(s) excluidos del cálculo.');
        if (noIncluirCount > 0) avisos.push(noIncluirCount + ' documento(s) marcados como NO_INCLUIR excluidos.');

        return {
            period: periodoUi(rcv.period || ''),
            rows: rows,
            totalCount: Number(rcv.totalCount) || docs.length,
            registroCount: rows.length,
            pendientesCount: pendientesCount,
            reclamadosCount: reclamadosCount,
            noIncluirCount: noIncluirCount,
            totals: rcv.totals || null,
            avisos: avisos
        };
    }

    function parseFechaDiaUtc(fechaStr) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaStr || '').trim());
        if (!m) return null;
        return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    function calcularPlazoAcuse(fechaRecepcion, fechaEmision, fechaRef) {
        var baseStr = String(fechaRecepcion || fechaEmision || '').slice(0, 10);
        var baseMs = parseFechaDiaUtc(baseStr);
        var refMs = fechaRef instanceof Date
            ? Date.UTC(fechaRef.getFullYear(), fechaRef.getMonth(), fechaRef.getDate())
            : (parseFechaDiaUtc(fechaRef) || Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
        if (baseMs == null) {
            return { fechaBase: '', diasTranscurridos: 0, diasRestantes: 8, estadoPlazo: 'seguro' };
        }
        var dias = Math.max(0, Math.floor((refMs - baseMs) / 86400000));
        var restantes = Math.max(0, 8 - dias);
        var estadoPlazo = dias > 8 ? 'tacito' : (restantes <= 3 ? 'critico' : 'seguro');
        return {
            fechaBase: baseStr,
            diasTranscurridos: dias,
            diasRestantes: restantes,
            estadoPlazo: estadoPlazo
        };
    }

    function normalizarPendientesDesdeGateway(resp, fechaRef) {
        var rcv = (resp && resp.rcv) ? resp.rcv : (resp || {});
        var docs = Array.isArray(rcv.documents) ? rcv.documents : [];
        var items = [];
        docs.forEach(function (d) {
            if (!d || typeof d !== 'object') return;
            var op = String(d.operacion || '').toUpperCase();
            if (op && op !== 'COMPRA') return;
            var est = String(d.estadoContab || '').toUpperCase();
            if (est && est !== 'PENDIENTE') return;
            var fechaRec = String(d.fechaRecepcion || d.fechaRecepcionSii || d.fechaEmision || '').slice(0, 10);
            var fechaEmi = String(d.fechaEmision || '').slice(0, 10);
            var plazo = calcularPlazoAcuse(fechaRec, fechaEmi, fechaRef);
            var iva = entero(d.montoIvaRecuperable !== undefined ? d.montoIvaRecuperable : d.montoIva);
            var total = entero(d.montoTotal !== undefined ? d.montoTotal : (entero(d.montoNeto) + iva));
            items.push({
                id: String(d.id || (entero(d.tipoDoc) + '-' + String(d.folio || '') + '-' + String(d.rutContraparte || ''))),
                tipoDoc: entero(d.tipoDoc),
                folio: d.folio != null ? String(d.folio) : '',
                rut: String(d.rutContraparte || '').trim(),
                razonSocial: String(d.razonSocialContraparte || '').trim().slice(0, 120),
                fechaEmision: fechaEmi,
                fechaRecepcion: fechaRec,
                fechaAcuse: d.fechaAcuse ? String(d.fechaAcuse).slice(0, 10) : '',
                neto: entero(d.montoNeto),
                iva: iva,
                total: total,
                diasTranscurridos: plazo.diasTranscurridos,
                diasRestantes: plazo.diasRestantes,
                estadoPlazo: plazo.estadoPlazo,
                decisionLocal: ''
            });
        });
        items.sort(function (a, b) { return a.diasRestantes - b.diasRestantes || b.total - a.total; });
        return items;
    }

    function normalizarBheDesdeGateway(resp, opts) {
        var bhe = (resp && resp.bhe) ? resp.bhe : (resp || {});
        var items = Array.isArray(bhe.items) ? bhe.items : [];
        var dirFiltro = (opts && opts.direction) ? String(opts.direction).toUpperCase() : '';
        var normalizadas = [];

        items.forEach(function (it) {
            if (!it || typeof it !== 'object') return;
            var dir = String(it.direction || 'RECIBIDA').toUpperCase();
            if (dirFiltro && dir !== dirFiltro) return;
            var esEmitida = dir === 'EMITIDA';
            var rut = esEmitida ? (it.rutReceptor || it.rutEmisor || '') : (it.rutEmisor || it.rutReceptor || '');
            var razon = esEmitida ? (it.nombreReceptor || it.nombreEmisor || '') : (it.nombreEmisor || it.nombreReceptor || '');
            normalizadas.push({
                folio: it.numeroBoleta != null ? String(it.numeroBoleta) : String(it.folio || ''),
                fecha: String(it.fechaEmision || it.fecha || '').slice(0, 10),
                estado: String(it.estado || 'VIGENTE').toUpperCase(),
                rut: String(rut).trim(),
                razonSocial: String(razon || 'Prestador de servicios').trim(),
                bruto: entero(it.montoBruto !== undefined ? it.montoBruto : it.bruto),
                retenido: entero(it.montoRetencion !== undefined ? it.montoRetencion : it.retenido),
                liquido: entero(it.montoLiquido !== undefined ? it.montoLiquido : it.liquido),
                direction: dir
            });
        });

        return {
            period: periodoUi(bhe.period || ''),
            items: normalizadas,
            totalCount: Number(bhe.totalCount) || items.length,
            totals: bhe.totals || null
        };
    }

    function normalizarF29DesdeGateway(resp) {
        var data = resp || {};
        var s = data.summary || null;
        if (!s || typeof s !== 'object') {
            return {
                synced: false,
                period: '',
                folioDeclaracion: '',
                estado: '',
                fechaPresentacion: '',
                remanenteAnterior: 0,
                impuestoUnico48: 0,
                codigos: {}
            };
        }

        var codigosRaw = s.codigosJson;
        if (typeof codigosRaw === 'string') {
            try { codigosRaw = JSON.parse(codigosRaw); } catch (e) { codigosRaw = {}; }
        }
        var codigos = {};
        if (codigosRaw && typeof codigosRaw === 'object' && !Array.isArray(codigosRaw)) {
            Object.keys(codigosRaw).forEach(function (k) {
                var numCod = String(k).replace(/^0+/, '') || k;
                codigos[numCod] = entero(codigosRaw[k]);
            });
        }

        function fijarSiFalta(cod, val) {
            if (codigos[cod] === undefined && val !== undefined && val !== null) {
                codigos[cod] = entero(val);
            }
        }
        fijarSiFalta('538', s.debitoFiscalIva);
        fijarSiFalta('537', s.creditoFiscalIva);
        fijarSiFalta('504', s.remanenteAnterior);
        fijarSiFalta('77', s.remanenteSiguiente);
        fijarSiFalta('62', s.ppmNetoDeterminado);
        fijarSiFalta('151', s.retencionHonorarios);
        fijarSiFalta('48', s.impuestoUnicoTrabajadores);
        fijarSiFalta('91', s.totalAPagar);
        if (codigos['89'] === undefined && codigos['538'] !== undefined && codigos['537'] !== undefined) {
            var dif = codigos['538'] - codigos['537'];
            codigos['89'] = dif > 0 ? dif : 0;
            if (codigos['77'] === undefined) codigos['77'] = dif < 0 ? Math.abs(dif) : 0;
        }

        return {
            synced: true,
            period: periodoUi(s.period || ''),
            folioDeclaracion: s.folioDeclaracion ? String(s.folioDeclaracion) : '',
            estado: s.estado ? String(s.estado) : '',
            fechaPresentacion: s.fechaPresentacion ? String(s.fechaPresentacion).slice(0, 10) : '',
            remanenteAnterior: codigos['504'] || entero(s.remanenteAnterior),
            impuestoUnico48: codigos['48'] || entero(s.impuestoUnicoTrabajadores),
            codigos: codigos
        };
    }

    var ETIQUETAS_F29 = {
        538: 'Total débitos fiscales',
        537: 'Total créditos fiscales',
        89: 'IVA determinado',
        77: 'Remanente período siguiente',
        48: 'Impuesto Único trabajadores',
        151: 'Retención honorarios',
        62: 'PPM neto determinado',
        91: 'Total a pagar F29'
    };

    function compararF29ConSii(f29Local, f29Sii) {
        if (!f29Local || !f29Local.codigos || !f29Sii || !f29Sii.synced) {
            return { comparable: false, coincideTotal: false, diferencias: [] };
        }
        var cods = [538, 537, 89, 77, 48, 151, 62, 91];
        var diffs = [];
        cods.forEach(function (c) {
            var vSii = f29Sii.codigos[String(c)];
            if (vSii === undefined) return;
            var vLoc = entero(f29Local.codigos[c]);
            var delta = vLoc - entero(vSii);
            if (delta !== 0) {
                diffs.push({
                    codigo: c,
                    nombre: ETIQUETAS_F29[c] || ('Cód. ' + c),
                    local: vLoc,
                    sii: entero(vSii),
                    delta: delta
                });
            }
        });
        return {
            comparable: true,
            coincideTotal: diffs.length === 0,
            diferencias: diffs
        };
    }

    /**
     * Si el JSON del estudio se acerca al tope de 2 MB de Neon (api/_estudio/datos.js),
     * compacta las filas RCV de períodos sincronizados con SII y conserva la marca `siiSyncAt`
     * para poder re-consultarlas desde el espejo PostgreSQL de SII Gateway en <100ms.
     */
    function podarRespaldoParaLimite(contable, maxBytes) {
        var limite = maxBytes || (1700 * 1024);
        if (!contable || typeof contable !== 'object') return contable;
        var texto = JSON.stringify(contable);
        if (texto.length <= limite) return contable;

        var copia = JSON.parse(texto);
        var claves = Object.keys(copia).sort();
        // Primera pasada: quitar CSV crudo si ya existen rows parseadas
        for (var i = 0; i < claves.length && JSON.stringify(copia).length > limite; i++) {
            var reg = copia[claves[i]];
            if (!reg || typeof reg !== 'object') continue;
            if (Array.isArray(reg.ventasRows) && reg.ventasRows.length) reg.ventasCsv = '';
            if (Array.isArray(reg.comprasRows) && reg.comprasRows.length) reg.comprasCsv = '';
        }
        // Segunda pasada: si aún supera el límite, podar filas detalladas en períodos sincronizados desde SII (del más antiguo al más reciente)
        for (var j = 0; j < claves.length - 1 && JSON.stringify(copia).length > limite; j++) {
            var r2 = copia[claves[j]];
            if (!r2 || typeof r2 !== 'object') continue;
            if (r2.siiSyncAt) {
                r2.ventasRows = null;
                r2.comprasRows = null;
            }
        }
        return copia;
    }

    // ---------- Almacén ligero de vínculos en navegador (sin secretos) ----------
    function crearTiendaVinculos(almacen) {
        var store = almacen || (typeof window !== 'undefined' ? window.localStorage : null);
        function leerTodo() {
            if (!store) return {};
            try {
                var raw = store.getItem(K_VINCULOS);
                var obj = raw ? JSON.parse(raw) : {};
                return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
            } catch (e) { return {}; }
        }
        function guardarTodo(obj) {
            if (!store) return false;
            try { store.setItem(K_VINCULOS, JSON.stringify(obj)); return true; }
            catch (e) { return false; }
        }
        function clave(nombreCliente) {
            return String(nombreCliente || '').trim().toLowerCase();
        }
        function obtener(nombreCliente) {
            var k = clave(nombreCliente);
            return k ? (leerTodo()[k] || null) : null;
        }
        function guardar(nombreCliente, meta) {
            var k = clave(nombreCliente);
            if (!k || !meta || !meta.companyId) return null;
            var todo = leerTodo();
            todo[k] = {
                companyId: String(meta.companyId),
                rut: meta.rut ? normalizarRut(meta.rut) : '',
                razonSocial: String(meta.razonSocial || nombreCliente).trim(),
                siiEnv: meta.siiEnv || 'PRODUCTION',
                hasCredentials: Boolean(meta.hasCredentials),
                credentialKind: meta.credentialKind || '',
                hasPreviredCredentials: Boolean(meta.hasPreviredCredentials),
                previredRutUsuario: meta.previredRutUsuario ? normalizarRut(meta.previredRutUsuario) : '',
                lastSyncAt: meta.lastSyncAt || null,
                updatedAt: new Date().toISOString()
            };
            guardarTodo(todo);
            return todo[k];
        }
        function eliminar(nombreCliente) {
            var k = clave(nombreCliente);
            if (!k) return;
            var todo = leerTodo();
            delete todo[k];
            guardarTodo(todo);
        }
        function listar() { return leerTodo(); }
        return { obtener: obtener, guardar: guardar, eliminar: eliminar, listar: listar };
    }

    function estudioActivoId() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return String(window.localStorage.getItem('cl-estudio-activo') || '').trim();
            }
        } catch (e) { /* sin almacenamiento */ }
        return '';
    }

    // ---------- Cliente HTTP hacia /api/pyme/sii-* ----------
    function crearClienteApi(fetchFn) {
        var f = fetchFn || (typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);

        async function llamar(ruta, opts) {
            if (!f) throw new Error('fetch no disponible');
            var o = opts || {};
            var headers = Object.assign({ accept: 'application/json' }, o.headers || {});
            var estId = estudioActivoId();
            if (estId && !headers['x-cl-estudio']) headers['x-cl-estudio'] = estId;
            var reqOpts = { method: o.method || 'GET', credentials: 'same-origin', headers: headers };
            if (o.method && o.method !== 'GET' && o.method !== 'HEAD') {
                headers['x-cl-pyme'] = '1';
                headers['content-type'] = 'application/json';
                reqOpts.body = JSON.stringify(o.body || {});
            }
            var res = await f('/api/pyme/' + ruta, reqOpts);
            var json = {};
            try { json = await res.json(); } catch (e) { json = {}; }
            if (!res.ok || json.ok === false) {
                var err = new Error(json.error || ('Error HTTP ' + res.status));
                err.status = res.status;
                err.codigo = json.codigo || '';
                err.payload = json;
                throw err;
            }
            return json;
        }

        return {
            configEstado: function () { return llamar('sii-estado'); },
            listarEmpresas: function (rut) {
                var q = rut ? ('?rut=' + encodeURIComponent(normalizarRut(rut))) : '';
                return llamar('sii-empresas' + q);
            },
            crearEmpresa: function (payload) {
                return llamar('sii-empresas', { method: 'POST', body: payload });
            },
            eliminarEmpresa: function (companyId) {
                return llamar('sii-empresas?id=' + encodeURIComponent(companyId), { method: 'DELETE', body: { companyId: companyId } });
            },
            estadoEmpresa: function (companyId) {
                return llamar('sii-estado?companyId=' + encodeURIComponent(companyId));
            },
            guardarCredenciales: function (companyId, payload) {
                return llamar('sii-credenciales?companyId=' + encodeURIComponent(companyId), { method: 'POST', body: payload });
            },
            eliminarCredenciales: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId)];
                if (o.kind) params.push('kind=' + encodeURIComponent(o.kind));
                if (o.siiEnv) params.push('siiEnv=' + encodeURIComponent(o.siiEnv));
                return llamar('sii-credenciales?' + params.join('&'), { method: 'DELETE', body: { companyId: companyId } });
            },
            iniciarSync: function (companyId, opts) {
                var o = opts || {};
                var jt = o.jobType || o.type || 'FULL_SYNC';
                if (jt === 'ALL') jt = 'FULL_SYNC';
                return llamar('sii-sync?companyId=' + encodeURIComponent(companyId), {
                    method: 'POST',
                    body: { period: periodoGateway(o.period), jobType: jt }
                });
            },
            iniciarSyncAll: function (opts) {
                var o = opts || {};
                var body = {};
                if (o.period) body.period = periodoGateway(o.period);
                var jt = o.jobType || o.type || '';
                if (jt && jt !== 'ALL') body.jobType = jt;
                return llamar('sii-sync-all', { method: 'POST', body: body });
            },
            estadoSync: function (companyId, jobId) {
                return llamar('sii-sync?companyId=' + encodeURIComponent(companyId) + '&jobId=' + encodeURIComponent(jobId));
            },
            obtenerRcv: function (companyId, opts) {
                var o = opts || {};
                var params = [
                    'companyId=' + encodeURIComponent(companyId),
                    'tipo=rcv',
                    'period=' + encodeURIComponent(periodoGateway(o.period)),
                    'all=' + (o.all === false ? '0' : '1')
                ];
                if (o.operacion) params.push('operacion=' + encodeURIComponent(o.operacion));
                if (o.estadoContab) params.push('estadoContab=' + encodeURIComponent(o.estadoContab));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerBhe: function (companyId, opts) {
                var o = opts || {};
                var params = [
                    'companyId=' + encodeURIComponent(companyId),
                    'tipo=bhe',
                    'period=' + encodeURIComponent(periodoGateway(o.period)),
                    'all=' + (o.all === false ? '0' : '1')
                ];
                if (o.direction) params.push('direction=' + encodeURIComponent(o.direction));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerF29: function (companyId, opts) {
                var o = opts || {};
                var params = [
                    'companyId=' + encodeURIComponent(companyId),
                    'tipo=f29',
                    'period=' + encodeURIComponent(periodoGateway(o.period))
                ];
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerF22: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId), 'tipo=f22'];
                if (o.anioTributario) params.push('anioTributario=' + encodeURIComponent(String(o.anioTributario)));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerDdjj: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId), 'tipo=ddjj'];
                if (o.anioTributario) params.push('anioTributario=' + encodeURIComponent(String(o.anioTributario)));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerTgr: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId), 'tipo=tgr'];
                if (o.period) params.push('period=' + encodeURIComponent(periodoGateway(o.period)));
                if (o.estadoPago) params.push('estadoPago=' + encodeURIComponent(o.estadoPago));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerPrevired: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId), 'tipo=previred'];
                if (o.period) params.push('period=' + encodeURIComponent(periodoGateway(o.period)));
                if (o.estado) params.push('estado=' + encodeURIComponent(o.estado));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerAlertas: function (companyId, opts) {
                var o = opts || {};
                var params = ['companyId=' + encodeURIComponent(companyId), 'tipo=alerts'];
                if (o.period) params.push('period=' + encodeURIComponent(periodoGateway(o.period)));
                return llamar('sii-datos?' + params.join('&'));
            },
            obtenerAlertasEstudio: function (opts) {
                var o = opts || {};
                var params = ['tipo=alerts-all'];
                if (o.period) params.push('period=' + encodeURIComponent(periodoGateway(o.period)));
                return llamar('sii-datos?' + params.join('&'));
            },
            listarWebhooks: function () {
                return llamar('sii-webhooks');
            },
            estadoReceptorWebhook: function () {
                return llamar('sii-webhooks?recibidos=1');
            },
            crearWebhook: function (payload) {
                return llamar('sii-webhooks', { method: 'POST', body: payload });
            },
            eliminarWebhook: function (webhookId) {
                return llamar('sii-webhooks?webhookId=' + encodeURIComponent(webhookId), {
                    method: 'DELETE',
                    body: { webhookId: webhookId }
                });
            },
            probarWebhook: function (webhookId) {
                return llamar('sii-webhooks?action=test&webhookId=' + encodeURIComponent(webhookId), {
                    method: 'POST',
                    body: { webhookId: webhookId, action: 'test' }
                });
            },
            entregasWebhook: function (webhookId) {
                return llamar('sii-webhooks?webhookId=' + encodeURIComponent(webhookId) + '&deliveries=1');
            },
            enviarAcuseRcv: function (companyId, payload) {
                var p = Object.assign({}, payload || {});
                if (p.period) p.period = periodoGateway(p.period);
                return llamar('sii-acuse?companyId=' + encodeURIComponent(companyId), { method: 'POST', body: p });
            },
            listarTokensMcp: function () {
                return llamar('mcp-tokens');
            },
            crearTokenMcp: function (label) {
                var body = label ? { label: String(label).trim().slice(0, 60) } : {};
                return llamar('mcp-tokens', { method: 'POST', body: body });
            },
            revocarTokenMcp: function (tokenId) {
                return llamar('mcp-tokens?id=' + encodeURIComponent(tokenId), { method: 'DELETE', body: { id: tokenId } });
            },
            sincronizarYEsperar: async function (companyId, opts) {
                var o = opts || {};
                var inicio = await this.iniciarSync(companyId, { period: o.period, jobType: o.jobType || 'FULL_SYNC' });
                var job = inicio.job || {};
                var jobId = job.jobId || job.id;
                if (typeof o.onEstado === 'function') o.onEstado(job);
                if (!jobId) return job;

                var maxIntentos = o.maxIntentos || 36; // ~72s con intervalo 2s
                var intervaloMs = o.intervaloMs || 2000;
                for (var i = 0; i < maxIntentos; i++) {
                    var st = String(job.status || '').toUpperCase();
                    if (JOB_TERMINALES[st]) return job;
                    await new Promise(function (r) { setTimeout(r, intervaloMs); });
                    var res = await this.estadoSync(companyId, jobId);
                    job = res.job || {};
                    if (typeof o.onEstado === 'function') o.onEstado(job);
                }
                return job;
            }
        };
    }

    // ---------- Normalizadores TGR, PreviRed, DDJJ, F22 y Alertas ----------
    var WEBHOOK_EVENTOS = [
        { id: '*', label: 'Todos los eventos (*)' },
        { id: 'sync.completed', label: 'Sincronización lista (sync.completed)' },
        { id: 'sync.failed', label: 'Error de sincronización (sync.failed)' },
        { id: 'rcv.acuse_expiring', label: 'Acuse RCV por vencer (rcv.acuse_expiring)' },
        { id: 'f29.due_alert', label: 'Alerta vencimiento F29 (f29.due_alert)' },
        { id: 'tgr.debt_detected', label: 'Deuda TGR detectada (tgr.debt_detected)' },
        { id: 'previred.overdue_detected', label: 'Mora PreviRed detectada (previred.overdue_detected)' },
        { id: 'webhook.test', label: 'Evento de prueba (webhook.test)' }
    ];

    function metaModuloAlerta(alerta) {
        var code = String((alerta && alerta.code) || '').toUpperCase();
        if (code === 'RCV_ACUSE_EXPIRING' || code.indexOf('RCV') === 0) {
            return { modulo: 'RCV', etiqueta: 'RCV (Acuses)', vista: 'f29', textoDefecto: 'Acuse de recibo RCV por vencer (plazo 8 días)' };
        }
        if (code === 'F29_DUE_PENDING' || code.indexOf('F29') === 0) {
            return { modulo: 'F29', etiqueta: 'Formulario 29', vista: 'f29', textoDefecto: 'F29 del período pendiente de declaración' };
        }
        if (code === 'TGR_DEBT_OR_UNPAID' || code.indexOf('TGR') === 0) {
            return { modulo: 'TGR', etiqueta: 'TGR (Tesorería)', vista: 'f29', textoDefecto: 'Deuda o giro impago registrado en Tesorería' };
        }
        if (code === 'PREVIRED_UNPAID_OR_OVERDUE' || code.indexOf('PREVIRED') === 0) {
            return { modulo: 'PREVIRED', etiqueta: 'PreviRed', vista: 'remuneraciones', textoDefecto: 'Cotizaciones PreviRed impagas o atrasadas' };
        }
        if (code === 'DDJJ_OBSERVED' || code.indexOf('DDJJ') === 0 || code.indexOf('F22') === 0) {
            return { modulo: 'DDJJ', etiqueta: 'DDJJ / Renta', vista: 'ddjj', textoDefecto: 'Declaración Jurada observada por el SII' };
        }
        return { modulo: 'SII', etiqueta: 'SII', vista: 'f29', textoDefecto: 'Alerta tributaria detectada' };
    }

    function resumirTgrDesdeGateway(resp) {
        if (!resp || resp.synced === false) {
            return { synced: false, estado: '', selloCls: 'sello-guardada', selloTexto: 'TGR: Sin consultar', totalAdeudado: 0, totalMultasIntereses: 0, totalCount: 0, items: [] };
        }
        var items = Array.isArray(resp.items) ? resp.items : [];
        var deuda = Math.round(Number(resp.totalAdeudado || 0)) || 0;
        var multas = Math.round(Number(resp.totalMultasIntereses || 0)) || 0;
        var estado = '';
        for (var i = 0; i < items.length; i++) {
            var ep = String(items[i].estadoPago || items[i].estado || '').toUpperCase();
            if (ep === 'MOROSO' || ep === 'IMPAGO') { estado = ep; break; }
            if (ep === 'CONVENIO' && !estado) estado = ep;
            if (!estado && ep) estado = ep;
        }
        if (!estado) estado = deuda > 0 ? 'MOROSO' : 'SIN_DEUDA';
        var mapa = {
            PAGADO: { cls: 'sello-emitida', txt: 'TGR: Pagado' },
            SIN_DEUDA: { cls: 'sello-emitida', txt: 'TGR: Sin deuda' },
            CONVENIO: { cls: 'sello-preparada', txt: 'TGR: Con convenio vigente' },
            PENDIENTE: { cls: 'sello-preparada', txt: 'TGR: Pendiente' },
            IMPAGO: { cls: 'sello-riesgo', txt: 'TGR: Impago' },
            MOROSO: { cls: 'sello-riesgo', txt: 'TGR: Moroso' }
        };
        var info = mapa[estado] || (deuda > 0 ? mapa.MOROSO : mapa.SIN_DEUDA);
        return {
            synced: true,
            estado: estado,
            selloCls: info.cls,
            selloTexto: info.txt,
            totalAdeudado: deuda,
            totalMultasIntereses: multas,
            totalCount: Number(resp.totalCount || items.length) || 0,
            items: items
        };
    }

    function resumirPreviredDesdeGateway(resp) {
        if (!resp || resp.synced === false) {
            return { synced: false, estado: '', selloCls: 'sello-guardada', selloTexto: 'Sin consultar', badgeCorto: 'Sin conectar', totalDeudaEstimada: 0, hasLeyBustosRisk: false, period: '', items: [] };
        }
        var items = Array.isArray(resp.items) ? resp.items : [];
        var deuda = Math.round(Number(resp.totalDeudaEstimada || 0)) || 0;
        var riesgo = Boolean(resp.hasLeyBustosRisk);
        var estado = '';
        var perItem = '';
        for (var i = 0; i < items.length; i++) {
            var st = String(items[i].estado || '').toUpperCase();
            if (!perItem && items[i].periodo) perItem = String(items[i].periodo);
            if (st === 'ATRASADO' || st === 'MOROSO') { estado = 'ATRASADO'; break; }
            if (st === 'DECLARADO_NO_PAGADO') estado = 'DECLARADO_NO_PAGADO';
            else if (!estado && st) estado = st;
        }
        if (!estado) {
            if (riesgo || deuda > 0) estado = 'ATRASADO';
            else if (items.length === 0) estado = 'SIN_MOVIMIENTO';
            else estado = 'PAGADO';
        }
        var mapa = {
            PAGADO: { cls: 'sello-emitida', txt: 'Pagado', corto: 'Pagado' },
            SIN_MOVIMIENTO: { cls: 'sello-guardada', txt: 'Sin movimiento', corto: 'Sin mov.' },
            DECLARADO_NO_PAGADO: { cls: 'sello-preparada', txt: 'Declarado sin pago', corto: 'Declarado sin pago' },
            ATRASADO: { cls: 'sello-riesgo', txt: 'Atrasado / Con deuda', corto: 'Atrasado' }
        };
        var info = mapa[estado] || mapa.SIN_MOVIMIENTO;
        return {
            synced: true,
            estado: estado,
            selloCls: info.cls,
            selloTexto: info.txt,
            badgeCorto: info.corto,
            totalDeudaEstimada: deuda,
            hasLeyBustosRisk: riesgo,
            period: periodoUi(perItem),
            items: items
        };
    }

    function normalizarDdjjDesdeGateway(resp) {
        if (!resp || resp.synced === false) return { synced: false, totalCount: 0, observadasCount: 0, items: [] };
        var items = Array.isArray(resp.items) ? resp.items : [];
        var norm = items.map(function (it) {
            var cod = String(it.codigo || it.formulario || it.formCode || '').replace(/^DJ\s*/i, '').trim();
            var est = String(it.estado || it.status || 'RECIBIDA').toUpperCase();
            var tab = '1887';
            if (cod === '1879') tab = '1879';
            else if (cod === '1947' || cod === '1948') tab = '1947';
            else if (cod === 'CPT') tab = 'cpt';
            return {
                codigo: cod || 'DDJJ',
                estado: est,
                esObservada: est.indexOf('OBSERV') >= 0 || est.indexOf('RECHAZ') >= 0,
                folio: String(it.folio || it.numeroAtencion || ''),
                fechaEnvio: String(it.fechaEnvio || it.submittedAt || '').slice(0, 10),
                observacion: String(it.observacion || it.observation || it.detalle || ''),
                tabDestino: tab
            };
        });
        return {
            synced: true,
            totalCount: Number(resp.totalCount || norm.length) || 0,
            observadasCount: norm.filter(function (x) { return x.esObservada; }).length,
            items: norm
        };
    }

    function compararF22ConSii(f22Local, f22Resp) {
        var localSaldo = f22Local
            ? (f22Local.esTransparente ? 0 : (f22Local.saldoAPagar > 0 ? f22Local.saldoAPagar : -Number(f22Local.devolucionF22 || 0)))
            : 0;
        if (!f22Resp || f22Resp.synced === false || !f22Resp.summary) {
            return { synced: false, folio: 'Sin folio', estado: 'Sin datos SII', selloCls: 'sello-guardada', resultadoSii: 0, resultadoLocal: localSaldo, diferencia: 0 };
        }
        var s = f22Resp.summary;
        var est = String(s.estado || s.status || 'PROPUESTA').toUpperCase();
        var resSii = Math.round(Number(s.montoResultado != null ? s.montoResultado : (s.saldoAPagar != null ? s.saldoAPagar : (s.devolucion != null ? -Number(s.devolucion) : 0)))) || 0;
        var selloCls = est.indexOf('OBSERV') >= 0 ? 'sello-riesgo' : (est.indexOf('PRESENT') >= 0 || est.indexOf('ACEPT') >= 0 ? 'sello-emitida' : 'sello-preparada');
        return {
            synced: true,
            anioTributario: s.anioTributario || '',
            folio: (s.folio ? ('Folio ' + s.folio + ' · ') : '') + est,
            estado: est,
            selloCls: selloCls,
            resultadoSii: resSii,
            resultadoLocal: localSaldo,
            diferencia: resSii - localSaldo
        };
    }

    var apiExport = {
        K_VINCULOS: K_VINCULOS,
        normalizarRut: normalizarRut,
        rutValido: rutValido,
        periodoGateway: periodoGateway,
        periodoUi: periodoUi,
        compactarRcvFila: compactarRcvFila,
        normalizarRcvDesdeGateway: normalizarRcvDesdeGateway,
        normalizarPendientesDesdeGateway: normalizarPendientesDesdeGateway,
        calcularPlazoAcuse: calcularPlazoAcuse,
        normalizarBheDesdeGateway: normalizarBheDesdeGateway,
        normalizarF29DesdeGateway: normalizarF29DesdeGateway,
        compararF29ConSii: compararF29ConSii,
        podarRespaldoParaLimite: podarRespaldoParaLimite,
        crearTiendaVinculos: crearTiendaVinculos,
        estudioActivoId: estudioActivoId,
        crearClienteApi: crearClienteApi,
        WEBHOOK_EVENTOS: WEBHOOK_EVENTOS,
        metaModuloAlerta: metaModuloAlerta,
        resumirTgrDesdeGateway: resumirTgrDesdeGateway,
        resumirPreviredDesdeGateway: resumirPreviredDesdeGateway,
        normalizarDdjjDesdeGateway: normalizarDdjjDesdeGateway,
        compararF22ConSii: compararF22ConSii,
        version: '1.2.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = apiExport;
    else root.CLSii = apiExport;
})(typeof window !== 'undefined' ? window : this);
