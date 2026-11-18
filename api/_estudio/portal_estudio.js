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
const MAX_ARCHIVO_BUZON = 1024 * 1024;
const MAX_ENVIOS_PORTAL = 20;
const TIPOS_BUZON = ['cartola', 'novedades', 'otro'];
const ESTADOS_BUZON = ['nuevo', 'procesado'];
const EXT_BUZON = /\.(csv|xlsx|xls|txt|tsv|pdf|json)$/i;

const LEYENDA_LEGAL = 'Acceso informativo emitido exclusivamente para el representante autorizado de la empresa cliente por su estudio contable (en calidad de encargado del tratamiento, Ley N° 21.719 y art. 154 ter del Código del Trabajo). Este enlace temporal y revocable permite revisar resúmenes y enviar respaldos cifrados al estudio contable, sin constituir declaración oficial presentada ante el SII, Previred o la Dirección del Trabajo. Prohibida su difusión o reenvío a terceros no autorizados.';

const DDL_PORTAL = `
CREATE TABLE IF NOT EXISTS portal_estudio (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id      uuid NOT NULL,
    cliente_nombre text NOT NULL,
    cliente_rut    text NOT NULL DEFAULT '',
    periodo        text NOT NULL,
    token_hash     text NOT NULL UNIQUE,
    secciones      jsonb NOT NULL DEFAULT '{"f29": true, "pnl": true, "laboral": true, "buzon": true}'::jsonb,
    datos_cifrados bytea NOT NULL,
    version_clave  integer NOT NULL DEFAULT 1,
    creado         timestamptz NOT NULL DEFAULT now(),
    vence          timestamptz NOT NULL,
    revocado       timestamptz,
    ultimo_acceso  timestamptz,
    accesos        integer NOT NULL DEFAULT 0
);`;

const DDL_BUZON = `
CREATE TABLE IF NOT EXISTS portal_estudio_buzon (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id      uuid NOT NULL,
    cuenta_id      uuid NOT NULL,
    cliente_nombre text NOT NULL,
    cliente_rut    text NOT NULL DEFAULT '',
    periodo        text NOT NULL,
    tipo           text NOT NULL DEFAULT 'cartola',
    nombre_archivo text NOT NULL DEFAULT '',
    mime_type      text NOT NULL DEFAULT 'application/octet-stream',
    nota           text NOT NULL DEFAULT '',
    estado         text NOT NULL DEFAULT 'nuevo',
    tamano_bytes   integer NOT NULL DEFAULT 0,
    datos_cifrados bytea NOT NULL,
    version_clave  integer NOT NULL DEFAULT 1,
    creado         timestamptz NOT NULL DEFAULT now()
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
        laboral: s.laboral !== false,
        buzon: s.buzon !== false
    };
    if (!out.f29 && !out.pnl && !out.laboral && !out.buzon) out.f29 = true;
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
    let tablaBuzonLista = false;

    async function asegurarTabla() {
        if (tablaLista) return;
        try {
            await consulta(DDL_PORTAL, []);
        } catch (e) { /* en entornos de prueba con mock en memoria puede ignorarse */ }
        tablaLista = true;
    }

    async function asegurarTablaBuzon() {
        await asegurarTabla();
        if (tablaBuzonLista) return;
        try {
            await consulta(DDL_BUZON, []);
        } catch (e) { /* en entornos de prueba con mock en memoria puede ignorarse */ }
        tablaBuzonLista = true;
    }

    async function validarTokenPortal(token, secreto) {
        const tk = texto(token, 128);
        if (!tk || tk.length < 20) return { ok: false, error: fallo(404, 'enlace_invalido', 'Este enlace no es válido.') };
        await asegurarTabla();
        const tokenHash = T.huellaToken(secreto, 'portal-estudio', tk);
        const filas = await consulta(
            `SELECT id, cuenta_id, cliente_nombre, cliente_rut, periodo, secciones, datos_cifrados, version_clave, vence, revocado
               FROM portal_estudio
              WHERE token_hash = $1
              LIMIT 1`,
            [tokenHash]
        );
        if (!filas.length) return { ok: false, error: fallo(404, 'enlace_invalido', 'Este enlace no existe o fue eliminado.') };
        const f = filas[0];
        if (f.revocado) return { ok: false, error: fallo(410, 'enlace_revocado', 'Este enlace fue revocado por tu estudio contable.') };
        const ahoraMs = reloj();
        if (new Date(f.vence).getTime() <= ahoraMs) {
            return { ok: false, error: fallo(410, 'enlace_vencido', 'Este enlace venció. Solicita uno nuevo a tu estudio contable.') };
        }
        return { ok: true, fila: f, tokenHash, ahoraMs };
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

    async function subirAlBuzon(token, entrada, { secreto }) {
        const val = await validarTokenPortal(token, secreto);
        if (!val.ok) return val.error;
        const f = val.fila;
        const sec = normalizarSecciones(f.secciones);
        if (!sec.buzon) {
            return fallo(403, 'buzon_desactivado', 'El buzón de archivos no está habilitado para este enlace.');
        }

        const b = entrada && typeof entrada === 'object' ? entrada : {};
        const tipo = TIPOS_BUZON.indexOf(String(b.tipo || '')) >= 0 ? String(b.tipo) : 'cartola';
        const nota = texto(b.nota, 600);
        const nombreArchivo = texto(b.nombreArchivo, 160).replace(/[\\/:*?"<>|]/g, '_');
        const mimeType = texto(b.mimeType, 120) || 'application/octet-stream';
        const contenidoBase64 = typeof b.contenidoBase64 === 'string' ? b.contenidoBase64.replace(/\s+/g, '') : '';

        if (!contenidoBase64 && !nota) {
            return fallo(400, 'envio_vacio', 'Adjunta un archivo o escribe una nota de novedades para el estudio.');
        }
        if (nombreArchivo && contenidoBase64 && !EXT_BUZON.test(nombreArchivo)) {
            return fallo(400, 'extension_invalida', 'Formato no permitido. Usa CSV, Excel (.xlsx/.xls), TXT, PDF o JSON.');
        }

        let tamanoBytes = 0;
        if (contenidoBase64) {
            if (!/^[A-Za-z0-9+/=]+$/.test(contenidoBase64)) {
                return fallo(400, 'archivo_invalido', 'El archivo no tiene una codificación válida.');
            }
            const buf = Buffer.from(contenidoBase64, 'base64');
            tamanoBytes = buf.length;
            if (!tamanoBytes) return fallo(400, 'archivo_vacio', 'El archivo está vacío.');
            if (tamanoBytes > MAX_ARCHIVO_BUZON) {
                return fallo(413, 'archivo_grande', 'El archivo supera el máximo permitido de 1 MB.');
            }
        } else {
            tamanoBytes = Buffer.byteLength(nota, 'utf8');
        }

        await asegurarTablaBuzon();
        const cntRows = await consulta(
            'SELECT count(*)::int AS n FROM portal_estudio_buzon WHERE portal_id = $1::uuid',
            [f.id]
        );
        if (cntRows[0] && Number(cntRows[0].n) >= MAX_ENVIOS_PORTAL) {
            return fallo(409, 'limite_buzon', 'Este enlace alcanzó el máximo de archivos permitidos (' + MAX_ENVIOS_PORTAL + ').');
        }

        const payload = JSON.stringify({
            nombreArchivo: nombreArchivo || ('novedades-' + f.periodo + '.txt'),
            mimeType: contenidoBase64 ? mimeType : 'text/plain;charset=utf-8',
            nota,
            contenidoBase64
        });
        const c = cifrado.cifrar(payload, 'portal-buzon:' + f.cuenta_id);
        const id = crypto.randomUUID();
        const ahoraIso = new Date(val.ahoraMs).toISOString();
        const nombreFinal = nombreArchivo || ('novedades-' + f.periodo + '.txt');

        await consulta(
            `INSERT INTO portal_estudio_buzon
               (id, portal_id, cuenta_id, cliente_nombre, cliente_rut, periodo, tipo, nombre_archivo, mime_type, nota, estado, tamano_bytes, datos_cifrados, version_clave, creado)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, 'nuevo', $11, $12, $13, $14::timestamptz)`,
            [
                id,
                f.id,
                f.cuenta_id,
                f.cliente_nombre,
                f.cliente_rut || '',
                f.periodo,
                tipo,
                nombreFinal,
                contenidoBase64 ? mimeType : 'text/plain;charset=utf-8',
                nota,
                tamanoBytes,
                c.datos,
                c.version,
                ahoraIso
            ]
        );

        return {
            ok: true,
            item: {
                id,
                tipo,
                nombreArchivo: nombreFinal,
                nota,
                estado: 'nuevo',
                tamanoBytes,
                creado: ahoraIso
            }
        };
    }

    async function listarBuzonCliente(token, { secreto }) {
        const val = await validarTokenPortal(token, secreto);
        if (!val.ok) return val.error;
        await asegurarTablaBuzon();
        const filas = await consulta(
            `SELECT id, tipo, nombre_archivo, nota, estado, tamano_bytes, creado
               FROM portal_estudio_buzon
              WHERE portal_id = $1::uuid
              ORDER BY creado DESC
              LIMIT 30`,
            [val.fila.id]
        );
        return {
            ok: true,
            items: (filas || []).map(r => ({
                id: r.id,
                tipo: r.tipo,
                nombreArchivo: r.nombre_archivo,
                nota: r.nota || '',
                estado: r.estado || 'nuevo',
                tamanoBytes: Number(r.tamano_bytes) || 0,
                creado: r.creado
            }))
        };
    }

    async function listarBuzonEstudio(cuentaId) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para ver el buzón de clientes.');
        await asegurarTablaBuzon();
        const filas = await consulta(
            `SELECT id, portal_id, cliente_nombre, cliente_rut, periodo, tipo, nombre_archivo, mime_type, nota, estado, tamano_bytes, creado
               FROM portal_estudio_buzon
              WHERE cuenta_id = $1::uuid
              ORDER BY creado DESC
              LIMIT 100`,
            [cuentaId]
        );
        return {
            ok: true,
            items: (filas || []).map(r => ({
                id: r.id,
                portalId: r.portal_id,
                clienteNombre: r.cliente_nombre,
                clienteRut: r.cliente_rut || '',
                periodo: r.periodo,
                tipo: r.tipo,
                nombreArchivo: r.nombre_archivo,
                mimeType: r.mime_type || 'application/octet-stream',
                nota: r.nota || '',
                estado: r.estado || 'nuevo',
                tamanoBytes: Number(r.tamano_bytes) || 0,
                creado: r.creado
            }))
        };
    }

    async function leerItemBuzon(cuentaId, id) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para abrir este archivo.');
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese envío.');
        await asegurarTablaBuzon();
        const filas = await consulta(
            `SELECT id, portal_id, cliente_nombre, cliente_rut, periodo, tipo, nombre_archivo, mime_type, nota, estado, tamano_bytes, datos_cifrados, version_clave, creado
               FROM portal_estudio_buzon
              WHERE id = $1::uuid AND cuenta_id = $2::uuid
              LIMIT 1`,
            [id, cuentaId]
        );
        if (!filas.length) return fallo(404, 'no_existe', 'No encontramos ese envío en tu estudio.');
        const r = filas[0];
        let dec;
        try {
            dec = JSON.parse(cifrado.descifrar(r.datos_cifrados, Number(r.version_clave), 'portal-buzon:' + cuentaId));
        } catch (e) {
            return fallo(500, 'datos_ilegibles', 'No pudimos descifrar este envío.');
        }
        return {
            ok: true,
            item: {
                id: r.id,
                portalId: r.portal_id,
                clienteNombre: r.cliente_nombre,
                clienteRut: r.cliente_rut || '',
                periodo: r.periodo,
                tipo: r.tipo,
                nombreArchivo: dec.nombreArchivo || r.nombre_archivo,
                mimeType: dec.mimeType || r.mime_type || 'application/octet-stream',
                nota: dec.nota != null ? dec.nota : (r.nota || ''),
                estado: r.estado || 'nuevo',
                tamanoBytes: Number(r.tamano_bytes) || 0,
                creado: r.creado,
                contenidoBase64: dec.contenidoBase64 || ''
            }
        };
    }

    async function actualizarEstadoBuzon(cuentaId, id, estado) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para actualizar este envío.');
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese envío.');
        const est = ESTADOS_BUZON.indexOf(String(estado || '')) >= 0 ? String(estado) : 'procesado';
        await asegurarTablaBuzon();
        const filas = await consulta(
            `UPDATE portal_estudio_buzon
                SET estado = $3
              WHERE id = $1::uuid AND cuenta_id = $2::uuid
              RETURNING id, estado`,
            [id, cuentaId, est]
        );
        if (!filas.length) return fallo(404, 'no_existe', 'No encontramos ese envío en tu estudio.');
        return { ok: true, id: filas[0].id, estado: filas[0].estado };
    }

    async function eliminarItemBuzon(cuentaId, id) {
        if (!cuentaId) return fallo(401, 'sin_sesion', 'Inicia sesión para eliminar este envío.');
        if (!UUID.test(String(id || ''))) return fallo(404, 'no_existe', 'No encontramos ese envío.');
        await asegurarTablaBuzon();
        const filas = await consulta(
            `DELETE FROM portal_estudio_buzon
              WHERE id = $1::uuid AND cuenta_id = $2::uuid
              RETURNING id`,
            [id, cuentaId]
        );
        if (!filas.length) return fallo(404, 'no_existe', 'No encontramos ese envío en tu estudio.');
        return { ok: true, id: filas[0].id };
    }

    return {
        crearEnlace,
        listarEnlaces,
        revocarEnlace,
        abrirEnlace,
        subirAlBuzon,
        listarBuzonCliente,
        listarBuzonEstudio,
        leerItemBuzon,
        actualizarEstadoBuzon,
        eliminarItemBuzon,
        sanitizarSnapshot,
        LEYENDA_LEGAL
    };
}

module.exports = { crear, sanitizarSnapshot, normalizarSecciones, enmascararRut, LEYENDA_LEGAL };
