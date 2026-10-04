// A tiny in-memory imitation of the parts of Supabase the site uses (PostgREST, Auth, Storage),
// so the hosted version can be tested end to end without internet access.
import http from 'node:http';

export function startMock(port, { email = 'admin@anonna.example', password = 'Hosted-Pass-2026', anon = 'anon-key' } = {}) {
  const db = { content: null, backups: [], messages: [], media: [], files: new Map(), nextBackup: 1, nextMsg: 1, tokens: new Map(), log: [] };
  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    const bearer = (req.headers.authorization || '').replace('Bearer ', '');
    const user = db.tokens.get(bearer);
    db.log.push(`${req.method} ${url.pathname}${url.search}`);
    let body = null;
    if (buf.length && /json/.test(req.headers['content-type'] || '')) { try { body = JSON.parse(buf.toString()); } catch {} }
    const p = url.pathname;
    const q = (k) => { const v = url.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };


    // ---- storage
    if (p.startsWith('/storage/v1/object/public/uploads/')) {
      const f = db.files.get(decodeURIComponent(p.slice('/storage/v1/object/public/uploads/'.length)));
      if (!f) return json(res, 404, { message: 'not found' });
      res.writeHead(200, { 'Content-Type': f.type }); return res.end(f.buf);
    }
    if (req.headers.apikey !== anon) return json(res, 401, { message: 'Invalid API key' });

    // ---- auth
    if (p === '/auth/v1/token') {
      const g = url.searchParams.get('grant_type');
      if (g === 'password') {
        if (body.email !== email || body.password !== password) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      } else if (g === 'refresh_token') {
        if (!db.tokens.has('r:' + body.refresh_token)) return json(res, 400, { error: 'invalid_grant', error_description: 'bad refresh' });
      }
      const t = 'tok' + Math.random().toString(36).slice(2), r = 'ref' + Math.random().toString(36).slice(2);
      db.tokens.set(t, email); db.tokens.set('r:' + r, email);
      return json(res, 200, { access_token: t, refresh_token: r, expires_in: db.shortExpiry ? 5 : 3600, expires_at: Math.floor(Date.now() / 1000) + (db.shortExpiry ? 5 : 3600), user: { email } });
    }
    if (p === '/auth/v1/logout') { db.tokens.delete(bearer); return json(res, 204); }
    if (p === '/auth/v1/user' && req.method === 'PUT') {
      if (!user) return json(res, 401, { message: 'JWT expired' });
      if (!body.password || body.password.length < 6) return json(res, 422, { message: 'Password too short' });
      db.password = body.password; return json(res, 200, { email });
    }

    // ---- rpc
    if (p === '/rest/v1/rpc/is_admin') return json(res, 200, !!user);
    if (p === '/rest/v1/rpc/get_public_content') {
      if (db.failPublic) return json(res, 500, { message: 'boom' });
      if (!db.content) return json(res, 200, null);
      const c = JSON.parse(JSON.stringify(db.content));
      for (const k of ['featured', 'portfolio']) c.home[k].items = c.home[k].items.filter((i) => i.visible !== false);
      return json(res, 200, c);
    }

    // ---- messages: anyone may insert, only admin may read
    if (p === '/rest/v1/messages' && req.method === 'POST') {
      for (const k of ['first_name', 'email', 'message']) if (!body[k]) return json(res, 400, { message: 'check constraint violated' });
      db.messages.push({ id: db.nextMsg++, last_name: '', meeting_date: '', meeting_time: '', is_read: false, created_at: new Date().toISOString(), ...body });
      return json(res, 201);
    }
    if (!user) return json(res, p.startsWith('/rest') && req.method === 'GET' ? 200 : 401, p.startsWith('/rest') && req.method === 'GET' ? [] : { message: 'JWT expired' });
    if (p.startsWith('/storage/v1/object/uploads/')) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/uploads/'.length));
      if (req.method === 'POST') { if (db.files.has(key)) return json(res, 409, { message: 'exists' }); db.files.set(key, { buf, type: req.headers['content-type'] }); return json(res, 200, { Key: key }); }
      if (req.method === 'DELETE') { db.files.delete(key); return json(res, 200, {}); }
    }

    // ---- tables (admin only from here)
    if (p === '/rest/v1/site_content') {
      if (req.method === 'GET') return json(res, 200, db.content ? [{ content: db.content }] : []);
      if (req.method === 'POST') {
        if (db.content) db.backups.unshift({ id: db.nextBackup++, content: db.content, created_at: new Date().toISOString() });
        db.content = body.content; return json(res, 201);
      }
    }
    if (p === '/rest/v1/content_backups' && req.method === 'GET') {
      const id = q('id');
      return json(res, 200, db.backups.filter((b) => !id || String(b.id) === id).slice(0, 30));
    }
    if (p === '/rest/v1/messages') {
      const id = q('id');
      if (req.method === 'GET') return json(res, 200, [...db.messages].reverse());
      if (req.method === 'PATCH') { db.messages.filter((m) => String(m.id) === id).forEach((m) => Object.assign(m, body)); return json(res, 204); }
      if (req.method === 'DELETE') { db.messages = db.messages.filter((m) => String(m.id) !== id); return json(res, 204); }
    }
    if (p === '/rest/v1/media') {
      const id = q('id');
      if (req.method === 'GET') return json(res, 200, id ? db.media.filter((m) => m.id === id) : [...db.media].reverse());
      if (req.method === 'POST') { db.media.push({ created_at: new Date().toISOString(), ...body }); return json(res, 201); }
      if (req.method === 'DELETE') { db.media = db.media.filter((m) => m.id !== id); return json(res, 204); }
    }
    json(res, 404, { message: 'mock: unhandled ' + req.method + ' ' + p });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ db, close: () => server.close(), email, password })));
}
