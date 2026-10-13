#!/usr/bin/env node
/*
 * Servidor local para probar el Asistente Pyme de punta a punta SIN base de datos ni correo (solo desarrollo).
 *
 *   node tools/dev_pyme.js [puerto]        (por defecto 3000)  →  http://localhost:3000/asistente-pyme
 *
 * - Sirve los archivos del sitio (con URLs limpias: /asistente-pyme → asistente-pyme.html).
 * - /api/pyme/* usa el mismo enrutador de produccion con una base EN MEMORIA (se borra al apagarlo) y claves aleatorias.
 * - No envia correos: el enlace de acceso se imprime en la terminal y queda en http://localhost:3000/__dev/ultimo-enlace
 * - http://localhost:3000/__dev/pase?email=ana@ejemplo.cl[&producto=pyme12]  da un pase de 30 dias a esa cuenta (para probar el limite de 5).
 * - La compra del Pase usa un Flow SIMULADO: /__dev/flow?token=...&resultado=ok|rechazado|pendiente confirma o rechaza el pago y vuelve
 *   al panel. La venta esta abierta aqui (en produccion se abre con PYME_PASE_VENTA=1). No se llama a Flow ni a Resend.
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
    flow: {
        createPayment: async ({ product, email, optional }) => { const token = 'DEVTOKEN' + (++nPago); pagosDev[token] = { product, email, optional, order: 'DEV-' + nPago }; return { url: SITIO + '/__dev/flow', token }; },
        signUnlock: Flow.signUnlock
    },
    venta: () => true
});
const rutas = crearRutas({ auth, datos, env: { VERCEL_ENV: 'development' }, siteUrl: SITIO, pase });

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
            res.status = (c) => { res.statusCode = c; return res; };
            res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
            return require('../api/unlock')(req, res);
        }
        if (url.pathname === '/__dev/flow') {
            const p = pagosDev[url.searchParams.get('token')];
            if (!p) { res.statusCode = 404; return res.end('Pago simulado desconocido'); }
            const resultado = url.searchParams.get('resultado') || 'ok';
            const destino = '/asistente-pyme?pase=' + (resultado === 'ok' ? 'ok&o=' + p.order : resultado);
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
}).listen(PUERTO, () => console.log('Asistente Pyme (desarrollo, base en memoria): ' + SITIO + '/asistente-pyme'));
