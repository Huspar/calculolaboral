/**
 * Liquidación compartida por enlace: el empleador crea un enlace para que el trabajador vea su liquidación del mes.
 *
 *  - El token (256 bits) se entrega una vez; en la base queda solo su huella. Vence a los 60 días y se puede anular.
 *  - La liquidación no se copia: al abrir el enlace se arma desde el mes guardado, con el mismo motor y el mismo documento
 *    que ve el empleador (js/liquidacion_engine.js y js/liquidacion_documento.js).
 *  - Se registra la primera y la última apertura y cuántas veces se abrió. No es firma ni aceptación: un revisor automático
 *    de enlaces del correo o de la mensajería también puede abrirlo (la pantalla del empleador lo dice).
 *
 * crear({ almacen, datos, secreto, siteUrl, ahora }) → { crearEnlace(cuenta, trabajadorId, periodo), listar(cuenta, periodo),
 *   anular(cuenta, trabajadorId, periodo), abrir(token) → { ok, html? } }
 */
const T = require('./tokens');
const V = require('./validar');
const E = require('../../js/liquidacion_engine.js');
const P = require('../../js/liquidacion_parametros.js');
const DOC = require('../../js/liquidacion_documento.js');

const DIAS_VIGENCIA = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallo(estado, codigo, error) { return { ok: false, estado, codigo, error }; }

function valoresDelMes(periodo, calculo) {
    const vig = periodo >= P.PRIMER_MES && periodo <= P.ULTIMO_MES ? P.vigenciaDe(periodo) : (P.vigenciaEstimada ? P.vigenciaEstimada(periodo) : null);
    if (!vig || !calculo || !calculo.uf || !calculo.utm) return null;
    return { uf: calculo.uf, utm: calculo.utm, imm: vig.imm, topeAfpUF: vig.topeAfpUF, topeAfcUF: vig.topeAfcUF, jornadaMaxima: vig.jornadaMaxima, afp: vig.afp, empleador: vig.empleador || null };
}

function crear({ almacen, datos, secreto, siteUrl, ahora }) {
    const reloj = ahora || Date.now;
    const iso = () => new Date(reloj()).toISOString();

    async function mesGuardado(cuenta, trabajadorId, periodo) {
        const m = await datos.meses(cuenta, periodo);
        const x = m.ok && (m.meses || []).find(r => r.trabajadorId === trabajadorId);
        return x ? x.mes : null;
    }

    async function crearEnlace(cuenta, trabajadorId, periodo) {
        if (!UUID.test(String(trabajadorId || '')) || !V.validarPeriodo(periodo)) return fallo(404, 'no_existe', 'No encontramos esa liquidación.');
        const est = await datos.estado(cuenta);
        const t = est.ok && (est.trabajadores || []).find(x => x.id === trabajadorId);
        const mes = t ? await mesGuardado(cuenta, trabajadorId, periodo) : null;
        if (!mes || !mes.calculo) return fallo(409, 'sin_mes', 'Primero guarda la liquidación de ese mes.');
        const fila = await almacen.obtenerEmpresa(cuenta.cuentaId);
        const token = T.nuevoToken();
        const vence = new Date(reloj() + DIAS_VIGENCIA * 86400000).toISOString();
        const ok = await almacen.crearEnlaceLiquidacion({ cuentaId: cuenta.cuentaId, empresaId: fila.id, trabajadorId, periodo, tokenHash: T.huellaToken(secreto, 'liquidacion', token), pagada: !!(est.limites && est.limites.paseVence), ahoraIso: iso(), venceIso: vence });
        if (!ok) return fallo(404, 'no_existe', 'No encontramos esa liquidación.');
        return { ok: true, enlace: siteUrl + '/api/pyme/liquidacion?t=' + token, vence };
    }

    async function listar(cuenta, periodo) {
        if (!V.validarPeriodo(periodo)) return fallo(400, 'periodo', 'El periodo debe tener el formato AAAA-MM.');
        return { ok: true, enlaces: await almacen.listarEnlacesLiquidacion(cuenta.cuentaId, periodo) };
    }

    async function anular(cuenta, trabajadorId, periodo) {
        if (!UUID.test(String(trabajadorId || '')) || !V.validarPeriodo(periodo)) return fallo(404, 'no_existe', 'No encontramos ese enlace.');
        if (!(await almacen.borrarEnlaceLiquidacion(cuenta.cuentaId, trabajadorId, periodo))) return fallo(404, 'no_existe', 'No encontramos ese enlace.');
        return { ok: true };
    }

    /** Abre el enlace: devuelve el HTML del documento, o ok: false si no vale. */
    async function abrir(token) {
        if (!T.tokenValido(token)) return { ok: false };
        const e = await almacen.abrirEnlaceLiquidacion(T.huellaToken(secreto, 'liquidacion', token), iso());
        if (!e) return { ok: false };
        const cuenta = { cuentaId: e.cuentaId };
        const est = await datos.estado(cuenta);
        const t = est.ok && (est.trabajadores || []).find(x => x.id === e.trabajadorId);
        const mes = t ? await mesGuardado(cuenta, e.trabajadorId, e.periodo) : null;
        const valores = mes ? valoresDelMes(e.periodo, mes.calculo) : null;
        if (!t || !mes || !valores || !est.empresa) return { ok: false };
        const res = E.calcular({ trabajador: t, mes, periodo: e.periodo, tasaMutual: est.empresa.tasaMutual }, valores);
        return { ok: true, periodo: e.periodo, empresa: est.empresa.razonSocial, html: DOC.documento(est.empresa, t, mes, res, { periodo: e.periodo, pagada: e.pagada }), pagada: e.pagada };
    }

    return { crearEnlace, listar, anular, abrir };
}

module.exports = { crear, DIAS_VIGENCIA, valoresDelMes };
