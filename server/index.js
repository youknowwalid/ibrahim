// Dependency-free production server: serves the React build, the public API and the admin API.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { store, seedUploads, ROOT, UPLOAD_DIR } from './lib/store.js';
import * as auth from './lib/auth.js';
import { saveUpload, deleteMedia, isAllowed, maxFor } from './lib/media.js';
import { validateContent, validateMessage } from './lib/validate.js';

const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(ROOT, 'dist');

seedUploads();
store.getContent();
const created = auth.ensureAdmin();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff2': 'font/woff2', '.map': 'application/json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml']);

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}
const json = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > limit) return reject(Object.assign(new Error('Too large'), { status: 413 }));
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 2 * 1024 * 1024) {
  const buf = await readBody(req, limit);
  try {
    return JSON.parse(buf.toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'ip';

// ---------- public content ----------
function publicContent() {
  const c = store.getContent();
  const out = structuredClone(c);
  out.home.featured.items = (out.home.featured.items || []).filter((i) => i.visible !== false);
  out.home.portfolio.items = (out.home.portfolio.items || []).filter((i) => i.visible !== false);
  return out;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pageMeta = {
  '/': (c) => [c.site.seoTitle, c.site.seoDescription],
  '/about': (c) => [`${c.about.title} | ${c.site.name}`, c.about.subtitle],
  '/lookbook': (c) => [`Lookbook | ${c.site.name}`, `Photo lookbook of ${c.site.name}.`],
  '/contact': (c) => [`${c.contact.title} | ${c.site.name}`, c.contact.subtitle],
  '/admin': (c) => [`Admin | ${c.site.name}`, ''],
};

let htmlCache = { mtime: 0, text: '' };
function renderIndex(req, pathname) {
  const file = path.join(DIST, 'server-template.html');
  const stat = fs.statSync(file);
  if (htmlCache.mtime !== stat.mtimeMs) htmlCache = { mtime: stat.mtimeMs, text: fs.readFileSync(file, 'utf8') };
  const c = pathname.startsWith('/admin') ? store.getContent() : publicContent();
  const key = pathname.startsWith('/admin') ? '/admin' : pathname.replace(/\/+$/, '') || '/';
  const [title, desc] = (pageMeta[key] || pageMeta['/'])(c);
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const share = c.site.shareImage ? origin + c.site.shareImage : '';
  const seo = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">`,
    share ? `<meta property="og:image" content="${esc(share)}"><meta name="twitter:card" content="summary_large_image">` : '',
    `<link rel="canonical" href="${esc(origin + (key === '/' ? '/' : key))}">`,
    pathname.startsWith('/admin') ? '<meta name="robots" content="noindex,nofollow">' : '',
  ].join('\n');
  // Content is embedded so the first paint needs no extra request.
  const safe = JSON.stringify(c).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const state = `<script>window.__LOCAL__=1;window.__CONTENT__=${safe}</script>`;
  return htmlCache.text.replace('<!--SEO-->', () => seo).replace('<!--STATE-->', () => (pathname.startsWith('/admin') ? '<script>window.__LOCAL__=1</script>' : state));
}

// ---------- static files ----------
const gzCache = new Map();
function serveFile(req, res, file, { immutable = false } = {}) {
  let stat;
  try {
    stat = fs.statSync(file);
    if (!stat.isFile()) return false;
  } catch {
    return false;
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Last-Modified': stat.mtime.toUTCString(),
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    'Accept-Ranges': 'bytes',
  };
  const etag = `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;
  headers.ETag = etag;
  if (req.headers['if-none-match'] === etag) {
    send(res, 304, '', headers);
    return true;
  }
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mov')) {
    let start = range[1] ? parseInt(range[1], 10) : 0;
    let end = range[2] ? parseInt(range[2], 10) : stat.size - 1;
    if (!range[1] && range[2]) {
      start = Math.max(0, stat.size - parseInt(range[2], 10));
      end = stat.size - 1;
    }
    end = Math.min(end, stat.size - 1);
    if (start > end || start >= stat.size) {
      send(res, 416, '', { 'Content-Range': `bytes */${stat.size}` });
      return true;
    }
    res.writeHead(206, { ...SECURITY, ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end(), true;
    fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (wantsGzip) {
    const k = file + stat.mtimeMs;
    let gz = gzCache.get(k);
    if (!gz) {
      gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 });
      gzCache.set(k, gz);
    }
    send(res, 200, req.method === 'HEAD' ? '' : gz, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': gz.length });
    return true;
  }
  res.writeHead(200, { ...SECURITY, ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(file).pipe(res);
  return true;
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, decodeURIComponent(rel)));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}

// ---------- API ----------
async function handleApi(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === '/api/content' && method === 'GET') return json(res, 200, publicContent());

  if (p === '/api/contact' && method === 'POST') {
    if (auth.rateLimited('contact:' + clientIp(req), 5, 10 * 60 * 1000)) return json(res, 429, { error: 'Too many messages — please try again in a few minutes.' });
    const body = await readJson(req, 50 * 1024);
    if (body.website) return json(res, 200, { ok: true }); // honeypot: bots fill this in
    const v = validateMessage(body);
    if (v.errors) return json(res, 422, { errors: v.errors });
    const messages = store.getMessages();
    messages.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...v.value, read: false, created: new Date().toISOString() });
    store.saveMessages(messages.slice(0, 2000));
    return json(res, 201, { ok: true });
  }

  if (p === '/api/admin/login' && method === 'POST') {
    if (auth.rateLimited('login:' + clientIp(req), 8, 5 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Please wait a few minutes.' });
    const body = await readJson(req, 10 * 1024);
    if (!auth.checkLogin(body.username, body.password)) {
      await new Promise((r) => setTimeout(r, 400));
      return json(res, 401, { error: 'Incorrect username or password.' });
    }
    const secure = (req.headers['x-forwarded-proto'] || '') === 'https';
    return json(res, 200, { ok: true, mustChange: !!store.getAuth().mustChange }, { 'Set-Cookie': auth.cookieHeader(auth.makeToken(), secure) });
  }
  if (p === '/api/admin/logout' && method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookieHeader() });

  if (p.startsWith('/api/admin/')) {
    const session = auth.readSession(req);
    if (!session) return json(res, 401, { error: 'Please sign in.' });
    if (method !== 'GET' && req.headers['x-requested-with'] !== 'admin') return json(res, 403, { error: 'Bad request.' });

    if (p === '/api/admin/me') return json(res, 200, { user: session.user, mustChange: session.mustChange });

    if (p === '/api/admin/content') {
      if (method === 'GET') return json(res, 200, store.getContent());
      if (method === 'PUT') {
        const body = await readJson(req, 5 * 1024 * 1024);
        const v = validateContent(body);
        if (v.error) return json(res, 422, { error: v.error });
        store.saveContent(v.value);
        return json(res, 200, { ok: true, savedAt: new Date().toISOString() });
      }
    }
    if (p === '/api/admin/content/reset' && method === 'POST') {
      store.resetContent();
      return json(res, 200, store.getContent());
    }
    if (p === '/api/admin/backups' && method === 'GET') return json(res, 200, store.listBackups());
    if (p === '/api/admin/backups/restore' && method === 'POST') {
      const body = await readJson(req, 10 * 1024);
      const c = store.readBackup(String(body.id || ''));
      if (!c) return json(res, 404, { error: 'Backup not found.' });
      store.saveContent(c);
      return json(res, 200, c);
    }

    if (p === '/api/admin/media' && method === 'GET') return json(res, 200, store.getMedia());
    if (p === '/api/admin/upload' && method === 'POST') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!isAllowed(type)) return json(res, 415, { error: 'Unsupported file type. Use JPG, PNG, WebP, GIF, MP4 or WebM.' });
      const buffer = await readBody(req, maxFor(type));
      if (!buffer.length) return json(res, 400, { error: 'Empty file.' });
      try {
        const entry = await saveUpload({ buffer, type, originalName: decodeURIComponent(url.searchParams.get('name') || 'upload') });
        return json(res, 201, entry);
      } catch (e) {
        console.error('[upload]', e);
        return json(res, 422, { error: 'That file could not be processed. Please try a different image.' });
      }
    }
    const mm = /^\/api\/admin\/media\/([\w-]+)$/.exec(p);
    if (mm && method === 'DELETE') return deleteMedia(mm[1]) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Not found.' });

    if (p === '/api/admin/messages' && method === 'GET') return json(res, 200, store.getMessages());
    const msg = /^\/api\/admin\/messages\/([\w-]+)$/.exec(p);
    if (msg) {
      const all = store.getMessages();
      const i = all.findIndex((m) => m.id === msg[1]);
      if (i < 0) return json(res, 404, { error: 'Not found.' });
      if (method === 'PATCH') {
        const body = await readJson(req, 1024);
        all[i].read = !!body.read;
        store.saveMessages(all);
        return json(res, 200, all[i]);
      }
      if (method === 'DELETE') {
        all.splice(i, 1);
        store.saveMessages(all);
        return json(res, 200, { ok: true });
      }
    }

    if (p === '/api/admin/password' && method === 'POST') {
      const body = await readJson(req, 10 * 1024);
      const current = store.getAuth();
      if (!auth.checkLogin(current.username, body.current)) return json(res, 403, { error: 'Your current password is not correct.' });
      if (typeof body.password !== 'string' || body.password.length < 8) return json(res, 422, { error: 'New password must be at least 8 characters.' });
      const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim().slice(0, 40) : current.username;
      auth.changeCredentials({ username, password: body.password });
      const secure = (req.headers['x-forwarded-proto'] || '') === 'https';
      return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader(auth.makeToken(), secure) });
    }
  }
  return json(res, 404, { error: 'Not found.' });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    if (p.startsWith('/uploads/')) {
      const f = safeJoin(UPLOAD_DIR, p.slice(9));
      if (f && serveFile(req, res, f, { immutable: true })) return;
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    }
    if (p === '/robots.txt') {
      const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`, { 'Content-Type': 'text/plain' });
    }
    if (p === '/sitemap.xml') {
      const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      const urls = ['/', '/about', '/lookbook', '/contact'].map((u) => `<url><loc>${origin}${u}</loc></url>`).join('');
      return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { 'Content-Type': 'application/xml' });
    }
    if (p !== '/' && path.extname(p)) {
      const f = safeJoin(DIST, p.slice(1));
      if (f && serveFile(req, res, f, { immutable: /^\/assets\//.test(p) })) return;
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    }
    // every page route is handled by the React app
    const known = ['/', '/about', '/lookbook', '/contact'];
    const clean = p.replace(/\/+$/, '') || '/';
    const status = known.includes(clean) || clean.startsWith('/admin') ? 200 : 404;
    const body = renderIndex(req, p);
    return send(res, status, req.method === 'HEAD' ? '' : body, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { error: status === 413 ? 'That file is too large.' : status === 500 ? 'Something went wrong.' : e.message });
  }
});

server.requestTimeout = 10 * 60 * 1000;
server.listen(PORT, () => {
  console.log(`\n  Anonna Fatima — portfolio running at http://localhost:${PORT}`);
  console.log(`  Admin panel:                         http://localhost:${PORT}/admin`);
  if (created) console.log(`\n  First-time admin login → username: ${created.username}   password: ${created.password}\n  (also saved in data/ADMIN-LOGIN.txt; you will be asked to change it)\n`);
});
