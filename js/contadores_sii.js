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

    // ---------- Cliente HTTP hacia /api/pyme/sii-* ----------
    function crearClienteApi(fetchFn) {
        var f = fetchFn || (typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);

        async function llamar(ruta, opts) {
            if (!f) throw new Error('fetch no disponible');
            var o = opts || {};
            var headers = Object.assign({ accept: 'application/json' }, o.headers || {});
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
                return llamar('sii-sync?companyId=' + encodeURIComponent(companyId), {
                    method: 'POST',
                    body: { period: periodoGateway(o.period), jobType: o.jobType || 'FULL_SYNC' }
                });
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

    var apiExport = {
        K_VINCULOS: K_VINCULOS,
        normalizarRut: normalizarRut,
        rutValido: rutValido,
        periodoGateway: periodoGateway,
        periodoUi: periodoUi,
        compactarRcvFila: compactarRcvFila,
        normalizarRcvDesdeGateway: normalizarRcvDesdeGateway,
        normalizarBheDesdeGateway: normalizarBheDesdeGateway,
        normalizarF29DesdeGateway: normalizarF29DesdeGateway,
        compararF29ConSii: compararF29ConSii,
        podarRespaldoParaLimite: podarRespaldoParaLimite,
        crearTiendaVinculos: crearTiendaVinculos,
        crearClienteApi: crearClienteApi,
        version: '1.0.0'
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = apiExport;
    else root.CLSii = apiExport;
})(typeof window !== 'undefined' ? window : this);
