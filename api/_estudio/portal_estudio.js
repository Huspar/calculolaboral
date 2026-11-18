/**
 * Portal Cliente Marca Blanca del Estudio Contable (Ola 3B, Ley N° 21.719 / Art. 154 ter CT).
 *
 * - Token aleatorio de 256 bits entregado una sola vez; en DB solo queda la huella HMAC-SHA256.
 * - Snapshot sanitizado en servidor (omite cuentas bancarias, contacto personal, diagnósticos médicos,
 *   pensiones de alimentos, cuotas sindicales, créditos CCAF y detalle de cargas) y cifrado con AES-256-GCM.
 * - Vigencia configurable (7, 15 o 30 días; defecto 15 días) y revocación inmediata en 1 clic.
 */
'use strict';

const crypto = require('crypto');
const T = require('../_pyme/tokens');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIAS_PERMITIDOS = [7, 15, 30];
const MAX_ENLACES_CUENTA = 100;

const LEYENDA_LEGAL = 'Acceso de solo lectura e informativo. Esta vista contiene información tributaria y laboral confidencial puesta a disposición exclusivamente para el representante autorizado de la empresa cliente por su estudio contable (en calidad de encargado del tratamiento, Ley N° 21.719 y art. 154 ter del Código del Trabajo). Este enlace temporal y revocable no permite modificar datos ni constituye declaración oficial presentada ante el SII, Previred o la Dirección del Trabajo. Prohibida su difusión o reenvío a terceros no autorizados.';

const DDL_PORTAL = `
CREATE TABLE IF NOT EXISTS portal_estudio (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id      uuid NOT NULL,
    cliente_nombre text NOT NULL,
    cliente_rut    text NOT NULL DEFAULT '',
    periodo        text NOT NULL,
    token_hash     text NOT NULL UNIQUE,
    secciones      jsonb NOT NULL DEFAULT '{"f29": true, "pnl": true, "laboral": true}'::jsonb,
    datos_cifrados bytea NOT NULL,
    version_clave  integer NOT NULL DEFAULT 1,
    creado         timestamptz NOT NULL DEFAULT now(),
    vence          timestamptz NOT NULL,
    revocado       timestamptz,
    ultimo_acceso  timestamptz,
    accesos        integer NOT NULL DEFAULT 0
);`;

function fallo(estado, codigo, error) {
    return { ok: false, estado, codigo, error };
}

function texto(v, max) {
    const s = String(v == null ? '' : v).trim();
    return max ? s.slice(0, max) : s;
}

function entero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
}

function enmascararRut(rut) {
    const s = texto(rut, 16);
    if (!s) return '';
    const partes = s.split('-');
    if (partes.length !== 2) return s;
    const cuerpo = partes[0].replace(/\D/g, '');
    if (cuerpo.length <= 4) return s;
    return '****' + cuerpo.slice(-4) + '-' + partes[1];
}

function normalizarSecciones(sec) {
    const s = sec && typeof sec === 'object' ? sec : {};
    const out = {
        f29: s.f29 !== false,
        pnl: s.pnl !== false,
        laboral: s.laboral !== false
    };
    if (!out.f29 && !out.pnl && !out.laboral) out.f29 = true;
    return out;
}

function sanitizarSnapshot(entrada, secciones) {
    const src = entrada && typeof entrada === 'object' ? entrada : {};
    const sec = normalizarSecciones(secciones);
    const est = src.estudio && typeof src.estudio === 'object' ? src.estudio : {};
    const cli = src.cliente && typeof src.cliente === 'object' ? src.cliente : {};

    const snapshot = {
        version: 1,
        estudio: {
            nombre: texto(est.nombre, 120) || 'Estudio Contable',
            rut: texto(est.rut, 20),
            contador: texto(est.contador, 100),
            pie: texto(est.pie, 240)
        },
        cliente: {
            nombre: texto(cli.nombre, 140) || 'Empresa Cliente',
            rut: texto(cli.rut, 20),
            periodo: texto(cli.periodo, 7),
            regimen: texto(cli.regimen, 60),
            cerradoTributario: Boolean(cli.cerradoTributario)
        },
        secciones: sec,
        leyendaLegal: LEYENDA_LEGAL
    };

    if (sec.f29 && src.f29 && typeof src.f29 === 'object') {
        const vencs = Array.isArray(src.f29.vencimientos) ? src.f29.vencimientos.slice(0, 10) : [];
        snapshot.f29 = {
            ivaDeterminado: entero(src.f29.ivaDeterminado),
            retenciones: entero(src.f29.retenciones),
            ppm: entero(src.f29.ppm),
            totalPagar: entero(src.f29.totalPagar),
            remanente: entero(src.f29.remanente),
            postergadoIva: Boolean(src.f29.postergadoIva),
            montoPostergado: entero(src.f29.montoPostergado),
            vencimientos: vencs.map(v => ({
                titulo: texto(v && v.titulo, 120),
                fechaLimite: texto(v && v.fechaLimite, 20),
                estado: texto(v && v.estado, 20)
            })).filter(v => v.titulo)
        };
    }

    if (sec.pnl && src.pnl && typeof src.pnl === 'object') {
        snapshot.pnl = {
            ingresos: entero(src.pnl.ingresos),
            costos: entero(src.pnl.costos),
            gastos: entero(src.pnl.gastos),
            resultado: entero(src.pnl.resultado)
        };
    }

    if (sec.laboral && src.laboral && typeof src.laboral === 'object') {
        const listaRaw = Array.isArray(src.laboral.trabajadores) ? src.laboral.trabajadores.slice(0, 200) : [];
        // Ley 21.719 y Art. 154 ter CT: omitir bancos, cuentas, contacto, domicilio, licencias medicas, pension alimentos, sindicato y cargas.
        const trabajadores = listaRaw.map(t => ({
            nombre: texto(t && t.nombre, 100),
            rut: enmascararRut(t && t.rut),
            dias: entero(t && t.dias),
            haberes: entero(t && t.haberes),
            descuentosLegales: entero(t && t.descuentosLegales),
            liquido: entero(t && t.liquido)
        })).filter(t => t.nombre);

        snapshot.laboral = {
            cantidadTrabajadores: entero(src.laboral.cantidadTrabajadores || trabajadores.length),
            totalHaberes: entero(src.laboral.totalHaberes),
            totalDescuentos: entero(src.laboral.totalDescuentos),
            totalLiquido: entero(src.laboral.totalLiquido),
            totalCostoEmpresa: entero(src.laboral.totalCostoEmpresa),
            trabajadores
        };
    }

    return snapshot;
}

function crear({ consulta, cifrado, ahora }) {
    const reloj = ahora || Date.now;
    let tablaLista = false;

    async function asegurarTabla() {
        if (tablaLista) return;
        try {
            await consulta(DDL_PORTAL, []);
        } catch (e) { /* en entornos de prueba con mock en memoria puede ignorarse */ }
        tablaLista = true;
    }

    async function crearEnlace(cuentaId, entrada, { secreto, siteUrl }) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para crear enlaces del portal.');
        const secRaw = entrada && entrada.secciones;
        const secciones = normalizarSecciones(secRaw);
        const snapshot = sanitizarSnapshot(entrada && entrada.snapshot, secciones);

        if (!/^\d{4}-\d{2}$/.test(snapshot.cliente.periodo)) {
            return fallo(400, 'periodo_invalido', 'Indica un período válido (AAAA-MM).');
        }

        const diasReq = Number(entrada && entrada.diasVigencia);
        const dias = DIAS_PERMITIDOS.indexOf(diasReq) >= 0 ? diasReq : 15;
        const ahoraMs = reloj();
        const venceIso = new Date(ahoraMs + dias * 86400000).toISOString();
        const ahoraIso = new Date(ahoraMs).toISOString();

        const json = JSON.stringify(snapshot);
        if (Buffer.byteLength(json, 'utf8') > 512 * 1024) {
            return fallo(413, 'snapshot_grande', 'El resumen del portal supera el tamaño máximo permitido.');
        }

        await asegurarTabla();
        const actuales = await consulta(
            'SELECT count(*)::int AS n FROM portal_estudio WHERE cuenta_id = $1::uuid AND revocado IS NULL AND vence > $2::timestamptz',
            [cuentaId, ahoraIso]
        );
        if (actuales[0] && Number(actuales[0].n) >= MAX_ENLACES_CUENTA) {
            return fallo(409, 'limite_portales', 'Alcanzaste el límite de enlaces activos simultáneos.');
        }

        const token = T.nuevoToken();
        const tokenHash = T.huellaToken(secreto, 'portal-estudio', token);
        const c = cifrado.cifrar(json, 'portal-estudio:' + tokenHash);
        const id = crypto.randomUUID();

        await consulta(
            `INSERT INTO portal_estudio
               (id, cuenta_id, cliente_nombre, cliente_rut, periodo, token_hash, secciones, datos_cifrados, version_clave, creado, vence)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::timestamptz, $11::timestamptz)`,
            [
                id,
                cuentaId,
                snapshot.cliente.nombre,
                snapshot.cliente.rut,
                snapshot.cliente.periodo,
                tokenHash,
                JSON.stringify(secciones),
                c.datos,
                c.version,
                ahoraIso,
                venceIso
            ]
        );

        const base = String(siteUrl || '').replace(/\/+$/, '');
        return {
            ok: true,
            id,
            enlace: base + '/portal-estudio?t=' + token,
            vence: venceIso,
            secciones,
            clienteNombre: snapshot.cliente.nombre,
            periodo: snapshot.cliente.periodo
        };
    }

    async function listarEnlaces(cuentaId) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para ver los enlaces.');
        await asegurarTabla();
        const filas = await consulta(
            `SELECT id, cliente_nombre, cliente_rut, periodo, secciones, creado, vence, revocado, ultimo_acceso, accesos
               FROM portal_estudio
              WHERE cuenta_id = $1::uuid
              ORDER BY creado DESC
              LIMIT 50`,
            [cuentaId]
        );
        return {
            ok: true,
            items: (filas || []).map(f => ({
                id: f.id,
                clienteNombre: f.cliente_nombre,
                clienteRut: f.cliente_rut || '',
                periodo: f.periodo,
                secciones: f.secciones || { f29: true, pnl: true, laboral: true },
                creado: f.creado,
                vence: f.vence,
                revocado: f.revocado || null,
                ultimoAcceso: f.ultimo_acceso || null,
                accesos: Number(f.accesos) || 0
            }))
        };
    }

    async function revocarEnlace(cuentaId, id) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para revocar enlaces.');
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese enlace.');
        await asegurarTabla();
        const ahoraIso = new Date(reloj()).toISOString();
        const filas = await consulta(
            `UPDATE portal_estudio
                SET revocado = COALESCE(revocado, $3::timestamptz)
              WHERE id = $1::uuid AND cuenta_id = $2::uuid
              RETURNING id, revocado`,
            [id, cuentaId, ahoraIso]
        );
        if (!filas.length) return fallo(404, 'no_existe', 'No encontramos ese enlace en tu estudio.');
        return { ok: true, id: filas[0].id, revocado: filas[0].revocado };
    }

    async function abrirEnlace(token, { secreto }) {
        const tk = texto(token, 128);
        if (!tk || tk.length < 20) return fallo(404, 'enlace_invalido', 'Este enlace no es válido.');
        await asegurarTabla();
        const tokenHash = T.huellaToken(secreto, 'portal-estudio', tk);
        const filas = await consulta(
            `SELECT id, datos_cifrados, version_clave, vence, revocado
               FROM portal_estudio
              WHERE token_hash = $1
              LIMIT 1`,
            [tokenHash]
        );
        if (!filas.length) return fallo(404, 'enlace_invalido', 'Este enlace no existe o fue eliminado.');
        const f = filas[0];
        if (f.revocado) return fallo(410, 'enlace_revocado', 'Este enlace fue revocado por tu estudio contable.');
        const ahoraMs = reloj();
        if (new Date(f.vence).getTime() <= ahoraMs) {
            return fallo(410, 'enlace_vencido', 'Este enlace venció. Solicita uno nuevo a tu estudio contable.');
        }

        let snapshot;
        try {
            const raw = cifrado.descifrar(f.datos_cifrados, Number(f.version_clave), 'portal-estudio:' + tokenHash);
            snapshot = JSON.parse(raw);
        } catch (e) {
            return fallo(500, 'datos_ilegibles', 'No pudimos abrir el resumen de este enlace.');
        }

        const ahoraIso = new Date(ahoraMs).toISOString();
        try {
            await consulta(
                'UPDATE portal_estudio SET accesos = accesos + 1, ultimo_acceso = $2::timestamptz WHERE id = $1::uuid',
                [f.id, ahoraIso]
            );
        } catch (e) { /* no impedir lectura si falla contador */ }

        return {
            ok: true,
            portal: Object.assign({}, snapshot, { vence: f.vence })
        };
    }

    return {
        crearEnlace,
        listarEnlaces,
        revocarEnlace,
        abrirEnlace,
        sanitizarSnapshot,
        LEYENDA_LEGAL
    };
}

module.exports = { crear, sanitizarSnapshot, normalizarSecciones, enmascararRut, LEYENDA_LEGAL };
