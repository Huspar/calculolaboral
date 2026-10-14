#!/usr/bin/env node
/*
 * Servidor local para probar el Asistente Pyme de punta a punta SIN base de datos ni correo (solo desarrollo).
 *
 *   node tools/dev_pyme.js [puerto]        (por defecto 3000)  →  http://localhost:3000/app
 *
 * - Sirve los archivos del sitio (con URLs limpias) y el software en /app y sus subrutas (todas sirven app.html).
 * - /api/pyme/* usa el mismo enrutador de produccion con una base EN MEMORIA (se borra al apagarlo) y claves aleatorias.
 * - No envia correos: el enlace de acceso se imprime en la terminal y queda en http://localhost:3000/__dev/ultimo-enlace
 * - http://localhost:3000/__dev/pase?email=ana@ejemplo.cl[&producto=pyme12]  da un pase de 30 dias a esa cuenta (para probar el limite de 5).
 * - http://localhost:3000/__dev/avisos  corre la tarea diaria de avisos por correo (los correos se imprimen y quedan en /__dev/ultimos-avisos).
 * - La compra del Pase usa un Flow SIMULADO: /__dev/flow?token=...&resultado=ok|rechazado|pendiente confirma o rechaza el pago y vuelve
 *   al panel. La venta esta abierta aqui (en produccion se abre con PYME_PASE_VENTA=1). No se llama a Flow ni a Resend.
 *
 * MODO SANDBOX DE FLOW: con FLOW_API_URL=https://sandbox.flow.cl/api, FLOW_API_KEY y FLOW_SECRET_KEY del sandbox, la compra del Pase usa
 * el Flow de pruebas de verdad y los mismos manejadores de produccion (flow-return y flow-confirm). Flow no puede llamar a localhost,
 * asi que al volver el comprador (/api/flow-return) este servidor hace antes la llamada de confirmacion que haria Flow. Los correos
 * (Resend) no se envian: se imprimen en la terminal. La base sigue en memoria.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { crearRutas } = require('../api/_pyme/rutas');
const { crear: crearAuth } = require('../api/_pyme/auth');
const { crear: crearDatos } = require('../api/_pyme/datos');
const Cifrado = require('../api/_pyme/cifrado');
const T = require('../api/_pyme/tokens');
const { crearAlmacenMemoria } = require('./pyme_almacen_memoria');
const SANDBOX = /^https:\/\/sandbox\.flow\.cl\//.test(process.env.FLOW_API_URL || '');
if (SANDBOX) {
    if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) { console.error('Modo sandbox: faltan FLOW_API_KEY / FLOW_SECRET_KEY del sandbox.'); process.exit(1); }
    process.env.SITE_URL = 'http://localhost:' + (Number(process.argv[2]) || 3000);
    process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'dev';
    // Solo Resend se simula; Flow (sandbox) se llama de verdad
    const fetchReal = global.fetch;
    global.fetch = async (url, opts) => {
        if (String(url).indexOf('api.resend.com') >= 0) {
            const m = JSON.parse((opts && opts.body) || '{}');
            console.log('\n[correo simulado] para ' + (m.to || []).join(', ') + ' | ' + m.subject + '\n');
            return { ok: true, status: 200, json: async () => ({ id: 'simulado' }), text: async () => '' };
        }
        return fetchReal(url, opts);
    };
}
process.env.FLOW_API_KEY = process.env.FLOW_API_KEY || 'dev';
process.env.FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || 'dev-secreto';
const Flow = require('../api/_flow');
const { crear: crearPase } = require('../api/_pyme/pase');

const PUERTO = Number(process.argv[2]) || 3000;
const RAIZ = path.join(__dirname, '..');
const SITIO = 'http://localhost:' + PUERTO;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

const almacen = crearAlmacenMemoria();
const secreto = T.secretoDesdeEntorno({ PYME_SESSION_SECRET: crypto.randomBytes(32).toString('base64') });
const cifrado = Cifrado.crear(Cifrado.clavesDesdeEntorno({ PYME_DATA_KEY: crypto.randomBytes(32).toString('base64') }));
let ultimoEnlace = null;
const auth = crearAuth({
    almacen, secreto, siteUrl: SITIO,
    enviarCorreo: async ({ to, enlace }) => { ultimoEnlace = enlace; console.log('\n[correo simulado] para ' + to + ':\n  ' + enlace + '\n'); }
});
const datos = crearDatos({ almacen, cifrado });
// Flow simulado: el pago queda pendiente hasta abrir /__dev/flow
const pagosDev = {};
let nPago = 0;
const pase = crearPase({
    almacen, productos: Flow.PRODUCTS,
    flow: SANDBOX ? Flow : {
        createPayment: async ({ product, email, optional }) => { const token = 'DEVTOKEN' + (++nPago); pagosDev[token] = { product, email, optional, order: 'DEV-' + nPago }; return { url: SITIO + '/__dev/flow', token }; },
        signUnlock: Flow.signUnlock
    },
    venta: () => true
});
const avisosEnviados = [];
const avisos = require('../api/_pyme/avisos').crear({
    almacen, datos, secreto, siteUrl: SITIO, P: require('../js/liquidacion_parametros.js'), F: require('../js/feriados_cl.js'),
    enviar: async (m) => { avisosEnviados.push(m); console.log('\n[correo simulado] avisos para ' + m.to + ' | ' + m.asunto + '\n'); }
});
const enlaces = require('../api/_pyme/enlaces').crear({ almacen, datos, secreto, siteUrl: SITIO });
const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'development' }, siteUrl: SITIO, pase, avisos, enlaces });
// Los manejadores de produccion (flow-confirm) piden el servicio del Pase a servicios.js: se les entrega el de memoria
if (SANDBOX) { const rs = require.resolve('../api/_pyme/servicios'); require.cache[rs] = { id: rs, filename: rs, loaded: true, exports: { pase: () => pase, almacen: () => almacen } }; }

// Adaptador minimo de Vercel (res.status / res.json) para correr los manejadores de api/ tal cual
function adaptar(res) {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    return res;
}

function leerCuerpo(req) {
    return new Promise((resolver) => {
        const partes = [];
        req.on('data', c => partes.push(c));
        req.on('end', () => {
            const texto = Buffer.concat(partes).toString('utf8');
            if (!texto) return resolver(undefined);
            const tipo = String(req.headers['content-type'] || '');
            try {
                resolver(tipo.indexOf('application/json') === 0 ? JSON.parse(texto) : tipo.indexOf('application/x-www-form-urlencoded') === 0 ? Object.fromEntries(new URLSearchParams(texto)) : texto);
            } catch (e) { resolver(undefined); }
        });
    });
}

function estatico(url, res) {
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/') ruta = '/index.html';
    // Como la regla de vercel.json: /app y sus subrutas sirven el software
    if (ruta === '/app' || ruta.indexOf('/app/') === 0) ruta = '/app.html';
    if (ruta === '/asistente-pyme') { res.statusCode = 301; res.setHeader('Location', '/app'); return res.end(); }
    let archivo = path.join(RAIZ, ruta);
    if (!archivo.startsWith(RAIZ)) { res.statusCode = 403; return res.end('Prohibido'); }
    if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        if (fs.existsSync(archivo + '.html')) archivo += '.html';
        else { res.statusCode = 404; return res.end('No encontrado'); }
    }
    res.setHeader('Content-Type', TIPOS[path.extname(archivo)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(archivo).pipe(res);
}

http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, SITIO);
        if (url.pathname === '/__dev/ultimo-enlace') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ enlace: ultimoEnlace })); }
        if (url.pathname === '/__dev/avisos') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(await avisos.correr())); }
        if (url.pathname === '/__dev/ultimos-avisos') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(avisosEnviados.slice(-5))); }
        if (url.pathname === '/__dev/pase') {
            const correo = (url.searchParams.get('email') || '').toLowerCase();
            const cuenta = await almacen.buscarCuentaPorEmail(correo);
            if (!cuenta) { res.statusCode = 404; return res.end('No hay cuenta con ese correo'); }
            almacen._estado.pases.push({ cuentaId: cuenta.id, producto: url.searchParams.get('producto') === 'pyme12' ? 'pyme12' : 'pyme3', ordenFlow: 'DEV-PASE-' + Date.now(), desde: new Date(Date.now() - 86400000).toISOString(), vence: new Date(Date.now() + 30 * 86400000).toISOString() });
            return res.end('Pase de 30 dias agregado a ' + correo);
        }
        if (url.pathname === '/api/unlock') {
            // La misma funcion de produccion, con el pequeño adaptador de Vercel (res.status / res.json)
            req.body = await leerCuerpo(req);
            adaptar(res); return require("../api/unlock")(req, res);
        }
        if (SANDBOX && url.pathname === '/api/flow-return') {
            // Flow vuelve al comprador aqui con el token. Antes se hace la llamada de confirmacion que en produccion hace Flow (servidor a servidor).
            req.body = await leerCuerpo(req);
            req.query = Object.fromEntries(url.searchParams);
            const falso = { statusCode: 200, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, end() { return this; } };
            await require('../api/flow-confirm')({ method: 'POST', body: req.body, query: req.query, headers: {} }, falso);
            console.log('[flow sandbox] flow-confirm respondio ' + falso.statusCode + ' (200 = pase registrado en la cuenta de memoria)');
            return require('../api/flow-return')(req, adaptar(res));
        }
        if (url.pathname === '/__dev/flow') {
            const p = pagosDev[url.searchParams.get('token')];
            if (!p) { res.statusCode = 404; return res.end('Pago simulado desconocido'); }
            const resultado = url.searchParams.get('resultado') || 'ok';
            const destino = '/app/cuenta?pase=' + (resultado === 'ok' ? 'ok&o=' + p.order : resultado);
            if (resultado === 'ok') {
                const r = await pase.confirmar({ paid: true, product: p.product, order: p.order, optional: p.optional });
                console.log('[flow simulado] ' + p.product + ' -> ' + JSON.stringify(r));
            }
            res.statusCode = 303; res.setHeader('Location', SITIO + destino); return res.end();
        }
        const m = /^\/api\/pyme\/([a-z-]+)$/.exec(url.pathname);
        if (m) {
            req.query = Object.assign(Object.fromEntries(url.searchParams), { ruta: m[1] });
            req.body = await leerCuerpo(req);
            return await rutas(req, res);
        }
        return estatico(url, res);
    } catch (e) {
        console.error(e);
        res.statusCode = 500;
        res.end('Error');
    }
}).listen(PUERTO, () => console.log('Asistente Pyme (desarrollo, base en memoria): ' + SITIO + '/app'));
