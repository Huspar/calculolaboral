/**
 * Mini proxy server-side (Vercel Serverless Function) para Suite Contadores v2 <-> SII Gateway.
 *
 * - Mantiene SII_GATEWAY_API_KEY exclusivamente en variables de entorno del servidor.
 * - Reenvía x-api-key + x-account-id hacia SII_GATEWAY_BASE_URL (https://connect.calculolaboral.cl).
 * - Aplica lista blanca estricta de rutas y query params permitidos (sin SSRF).
 * - Protege escrituras sensibles y verifica sesión firmada cuando APP_SESSION_SECRET está configurado.
 */
'use strict';

const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://connect.calculolaboral.cl';
const TIMEOUT_MS = 15000;

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const ALLOWED_PATH_PATTERNS = [
  /^\/api\/v1\/companies(\/[a-zA-Z0-9_-]{1,100}(\/status)?)?$/,
  /^\/api\/v1\/accounting\/[a-zA-Z0-9_-]{1,100}\/(sync|sync-range|sync\/[a-zA-Z0-9_-]{1,100}|rcv|bhe|bhe\/annual|f29|alerts|previred|tgr|ddjj|f22|parser-health)$/,
  /^\/api\/v1\/studio\/chart$/,
  /^\/api\/v1\/studio\/morning-report(\/(history|generate))?$/,
  /^\/api\/v1\/studio\/companies\/[a-zA-Z0-9_-]{1,100}\/(supplier-rules|bank-rules|period-closures|lre-history|aux-docs(\/[a-zA-Z0-9_-]{1,100})?)$/,
  /^\/api\/v1\/mcp\/tokens(\/[a-zA-Z0-9_-]{1,100})?$/,
  /^\/api\/v1\/mcp\/access-logs$/,
  /^\/api\/v1\/sync\/batch(\/[a-zA-Z0-9_-]{1,100})?$/
];

const CREDENTIALS_PATH_PATTERN = /^\/api\/v1\/companies\/[a-zA-Z0-9_-]{1,100}\/credentials$/;

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function verifySessionToken(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    return h === 'calculolaboral.cl' || h.endsWith('.calculolaboral.cl') || h.endsWith('.vercel.app') || h === 'localhost' || h === '127.0.0.1';
  } catch (_) {
    return false;
  }
}

function splitPathAndQuery(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s.startsWith('/api/v1/') || s.includes('..') || s.includes('\\')) return null;
  const qIdx = s.indexOf('?');
  const pathname = qIdx >= 0 ? s.slice(0, qIdx) : s;
  const search = qIdx >= 0 ? s.slice(qIdx) : '';
  return { pathname, search };
}

function createHandler({ env = process.env, fetchFn = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  return async function studioProxyHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const method = String(req.method || 'GET').toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
      return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const origin = req.headers && (req.headers.origin || req.headers.referer);
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
    }

    const baseUrl = String(env.SII_GATEWAY_BASE_URL || env.SII_GATEWAY_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
    const apiKey = String(env.SII_GATEWAY_API_KEY || '').trim();
    const defaultAccountId = String(env.SII_GATEWAY_ACCOUNT_ID || 'calculo-laboral').trim();
    const sessionSecret = String(env.APP_SESSION_SECRET || '').trim();

    const query = req.query || {};
    const cookies = parseCookies(req.headers && req.headers.cookie);
    const session = sessionSecret ? verifySessionToken(cookies.cl_studio_session, sessionSecret) : null;

    if (query.action === 'status' && method === 'GET') {
      return res.status(200).json({
        ok: true,
        configured: Boolean(apiKey),
        sessionRequired: Boolean(sessionSecret),
        authenticated: Boolean(session),
        mode: apiKey ? 'connected' : 'demo-local'
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        error: 'SII_GATEWAY_NOT_CONFIGURED',
        message: 'Falta SII_GATEWAY_API_KEY en las variables de entorno del servidor.'
      });
    }

    const parsed = splitPathAndQuery(query.path);
    if (!parsed) {
      return res.status(400).json({ ok: false, error: 'INVALID_UPSTREAM_PATH' });
    }

    const isCredsRoute = CREDENTIALS_PATH_PATTERN.test(parsed.pathname);
    const isStandardRoute = ALLOWED_PATH_PATTERNS.some((re) => re.test(parsed.pathname));
    if (!isStandardRoute && !isCredsRoute) {
      return res.status(403).json({ ok: false, error: 'PATH_NOT_ALLOWED' });
    }

    if (sessionSecret && !session) {
      return res.status(401).json({ ok: false, error: 'SESSION_REQUIRED' });
    }
    if (isCredsRoute && !session) {
      return res.status(401).json({ ok: false, error: 'SESSION_REQUIRED_FOR_CREDENTIALS' });
    }

    const accountId = (session && session.accountId) ? String(session.accountId) : defaultAccountId;
    const upstreamUrl = baseUrl + parsed.pathname + parsed.search;

    if (typeof fetchFn !== 'function') {
      return res.status(503).json({ ok: false, error: 'FETCH_UNAVAILABLE' });
    }

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const headers = {
        'x-api-key': apiKey,
        'x-account-id': accountId,
        'accept': 'application/json'
      };
      const opts = { method, headers };
      if (ctrl) opts.signal = ctrl.signal;
      if (method !== 'GET' && method !== 'DELETE' && req.body !== undefined) {
        headers['content-type'] = 'application/json';
        opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const upstream = await fetchFn(upstreamUrl, opts);
      ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach((h) => {
        const val = upstream.headers && typeof upstream.headers.get === 'function' ? upstream.headers.get(h) : null;
        if (val !== null) res.setHeader(h, val);
      });

      const text = await upstream.text();
      let data = null;
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
      return res.status(upstream.status).json(data);
    } catch (err) {
      const aborted = err && err.name === 'AbortError';
      return res.status(aborted ? 504 : 502).json({
        ok: false,
        error: aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE'
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

const handler = createHandler();
handler.createHandler = createHandler;
handler.verifySessionToken = verifySessionToken;
module.exports = handler;
