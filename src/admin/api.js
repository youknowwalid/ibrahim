// Small wrapper for the admin API. On the hosted (Supabase) version the same calls are served by ./sb.js;
// on the self-hosted Node version they go to /api/admin/* on the local server.
import * as sb from '../lib/sb.js';

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
  sb.onSbUnauthorized(fn);
};

const defaults = () => import('../../server/seed-content.js').then((m) => JSON.parse(JSON.stringify(m.defaultContent)));

async function sbRequest(method, url, body) {
  const u = url.replace(/^\/api\/admin\//, '');
  const [route, id] = u.split('/');
  const key = `${method} ${route}${id ? '/:id' : ''}`;
  switch (key) {
    case 'GET me': return sb.me();
    case 'POST login': await sb.login(body.username, body.password); return { ok: true };
    case 'POST logout': return sb.logout();
    case 'GET content': return sb.getContent(defaults);
    case 'PUT content': return sb.saveContent(body);
    case 'POST content/:id': if (id === 'reset') return sb.saveContent(await defaults()); break;
    case 'GET backups': return sb.listBackups();
    case 'POST backups/:id': if (id === 'restore') return sb.restoreBackup(body.id); break;
    case 'GET media': return sb.listMedia();
    case 'DELETE media/:id': return sb.removeMedia(id);
    case 'GET messages': return sb.listMessages();
    case 'PATCH messages/:id': return sb.markMessage(id, body.read);
    case 'DELETE messages/:id': return sb.removeMessage(id);
    case 'POST password': return sb.changePassword(body.current, body.password);
  }
  throw new Error('Unknown request: ' + key);
}

async function request(method, url, body) {
  if (sb.isSB()) return sbRequest(method, url, body);
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'admin', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401 && !url.endsWith('/login')) onUnauthorized();
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Something went wrong.'), { status: res.status });
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
  upload(file, onProgress) {
    if (sb.isSB()) return sb.upload(file, onProgress);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload?name=' + encodeURIComponent(file.name));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-Requested-With', 'admin');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        let d = null;
        try { d = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status === 401) onUnauthorized();
        xhr.status >= 200 && xhr.status < 300 ? resolve(d) : reject(new Error(d?.error || 'Upload failed.'));
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.send(file);
    });
  },
};

export const getIn = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function setIn(obj, path, value) {
  const keys = path.split('.');
  const rec = (o, i) => {
    const copy = Array.isArray(o) ? [...o] : { ...(o || {}) };
    copy[keys[i]] = i === keys.length - 1 ? value : rec(o?.[keys[i]], i + 1);
    return copy;
  };
  return rec(obj, 0);
}
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
