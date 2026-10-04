// Minimal Supabase client (PostgREST + GoTrue + Storage) using plain fetch — no dependencies.
// The URL and anon key are public by design; all protection is done by Row Level Security in the database.
/* global __SB__ */
const cfg = typeof __SB__ !== 'undefined' ? __SB__ : null;

export const isSB = () => !!(cfg && cfg.url && cfg.key) && !(typeof window !== 'undefined' && window.__LOCAL__);
export const sbUrl = () => cfg.url;
export const ADMIN_DOMAIN = 'anonna.example';

const KEY = 'af_admin_session';
let mem = null;
const store = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || mem; } catch { return mem; }
  },
  set(s) {
    mem = s;
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {}
  },
};

const err = (message, status) => Object.assign(new Error(message), { status });
const nice = (d, fallback) => d?.message || d?.msg || d?.error_description || d?.error || fallback;

async function raw(path, { method = 'GET', body, token, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(cfg.url + path, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: 'Bearer ' + (token || cfg.key),
        ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    });
  } catch {
    throw err('Could not reach the server — check your connection.', 0);
  }
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw err(nice(data, 'Something went wrong.'), res.status);
  return data;
}

/* ---------- public ---------- */
export const publicContent = () => raw('/rest/v1/rpc/get_public_content', { method: 'POST', body: {} });

export async function sendMessage(v) {
  await raw('/rest/v1/messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: {
      first_name: v.firstName.trim(),
      last_name: v.lastName.trim(),
      email: v.email.trim(),
      meeting_date: v.date,
      meeting_time: v.time,
      message: v.message.trim(),
    },
  });
}

/* ---------- auth ---------- */
let unauthorized = () => {};
export const onSbUnauthorized = (fn) => (unauthorized = fn);

async function session() {
  let s = store.get();
  if (!s) throw err('Please sign in.', 401);
  if (s.expires_at - 60 < Date.now() / 1000) {
    try {
      s = await grant('refresh_token', { refresh_token: s.refresh_token });
    } catch {
      store.set(null);
      unauthorized();
      throw err('Your session has expired. Please sign in again.', 401);
    }
  }
  return s;
}

async function grant(type, body) {
  const d = await raw('/auth/v1/token?grant_type=' + type, { method: 'POST', body });
  const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), email: d.user?.email };
  store.set(s);
  return s;
}

async function authed(path, opts = {}) {
  const s = await session();
  try {
    return await raw(path, { ...opts, token: s.access_token });
  } catch (e) {
    if (e.status === 401 || e.status === 403 && /jwt/i.test(e.message)) {
      store.set(null);
      unauthorized();
    }
    throw e;
  }
}

const isAdmin = async () => (await authed('/rest/v1/rpc/is_admin', { method: 'POST', body: {} })) === true;

export async function login(username, password) {
  const email = username.includes('@') ? username.trim() : `${username.trim()}@${ADMIN_DOMAIN}`;
  let s;
  try {
    s = await grant('password', { email, password });
  } catch (e) {
    if (e.status === 0) throw e;
    throw err('That username or password is not right.', 401);
  }
  if (!(await isAdmin())) {
    store.set(null);
    throw err('That account is not allowed to manage this website.', 403);
  }
  return s;
}

export async function me() {
  const s = store.get();
  if (!s) throw err('Not signed in', 401);
  if (!(await isAdmin())) {
    store.set(null);
    throw err('Not signed in', 401);
  }
  return { user: (store.get() || s).email || 'admin', mustChange: false };
}

export async function logout() {
  const s = store.get();
  store.set(null);
  if (s) await raw('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(() => {});
}

export async function changePassword(current, password) {
  const s = store.get();
  await grant('password', { email: s.email, password: current }).catch(() => {
    throw err('Your current password is not right.', 400);
  });
  await authed('/auth/v1/user', { method: 'PUT', body: { password } });
}

/* ---------- content ---------- */
const JSONH = { 'Content-Type': 'application/json' };
export async function getContent(getDefault) {
  const rows = await authed('/rest/v1/site_content?id=eq.1&select=content');
  if (rows.length) return rows[0].content;
  const content = await getDefault();
  await saveContent(content);
  return content;
}
export const saveContent = (content) =>
  authed('/rest/v1/site_content?on_conflict=id', {
    method: 'POST',
    headers: { ...JSONH, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { id: 1, content },
  });

export async function listBackups() {
  const rows = await authed('/rest/v1/content_backups?select=id,created_at&order=id.desc&limit=30');
  return rows.map((r) => ({ id: r.id, created: new Date(r.created_at).toISOString().slice(0, 19).replace(/:/g, '-') }));
}
export async function restoreBackup(id) {
  const rows = await authed(`/rest/v1/content_backups?id=eq.${encodeURIComponent(id)}&select=content`);
  if (!rows.length) throw err('That backup no longer exists.', 404);
  await saveContent(rows[0].content);
}

/* ---------- messages ---------- */
export async function listMessages() {
  const rows = await authed('/rest/v1/messages?select=*&order=created_at.desc&limit=500');
  return rows.map((m) => ({
    id: m.id, firstName: m.first_name, lastName: m.last_name, email: m.email,
    date: m.meeting_date, time: m.meeting_time, message: m.message, read: m.is_read, created: m.created_at,
  }));
}
export const markMessage = (id, read) =>
  authed(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...JSONH, Prefer: 'return=minimal' }, body: { is_read: !!read } });
export const removeMessage = (id) => authed(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

/* ---------- media ---------- */
const pubBase = () => `${cfg.url}/storage/v1/object/public/uploads/`;
const toEntry = (r) => ({ id: r.id, name: r.name, url: r.url, thumb: r.thumb || '', type: r.kind, size: r.size, width: r.width || 0, height: r.height || 0 });

export async function listMedia() {
  const rows = await authed('/rest/v1/media?select=*&order=created_at.desc&limit=1000');
  let builtin = [];
  try {
    const m = await (await fetch('/uploads/_manifest.json')).json();
    builtin = m.map((x) => ({
      id: x.id, name: `Photo ${x.id.replace(/\D/g, '')}`, url: `/uploads/${x.id}.webp`, thumb: `/uploads/${x.id}-thumb.webp`,
      type: 'image', size: (x.kb || 0) * 1024, width: x.w, height: x.h, builtin: true,
    }));
  } catch {}
  return [...rows.map(toEntry), ...builtin];
}

const pathOf = (url) => (url && url.startsWith(pubBase()) ? decodeURIComponent(url.slice(pubBase().length)) : null);
export async function removeMedia(id) {
  const rows = await authed(`/rest/v1/media?id=eq.${encodeURIComponent(id)}&select=url,thumb`);
  if (!rows.length) throw err('Built-in photos cannot be deleted — you can simply stop using them in the sections.', 400);
  for (const p of [pathOf(rows[0].url), pathOf(rows[0].thumb)].filter(Boolean))
    await authed(`/storage/v1/object/uploads/${p.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' }).catch(() => {});
  await authed(`/rest/v1/media?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be read.')); };
    img.src = url;
  });
}
function toWebp(img, max) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('Could not process that picture.'))), 'image/webp', 0.85));
}

function putObject(path, blob, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${cfg.url}/storage/v1/object/uploads/${path.split('/').map(encodeURIComponent).join('/')}`);
    xhr.setRequestHeader('apikey', cfg.key);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let d = null;
      try { d = JSON.parse(xhr.responseText); } catch {}
      reject(err(nice(d, 'Upload failed.'), xhr.status));
    };
    xhr.onerror = () => reject(err('Upload failed — check your connection.', 0));
    xhr.send(blob);
  });
}

const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
export async function upload(file, onProgress) {
  const s = await session();
  const id = rid();
  const isVideo = file.type.startsWith('video/');
  if (!isVideo && !file.type.startsWith('image/')) throw err('Please choose a picture or a video.', 400);
  if (file.size > 50 * 1024 * 1024) throw err('That file is larger than 50 MB.', 400);
  const base = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'file';
  let row;
  if (isVideo) {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const path = `${id}.${ext}`;
    await putObject(path, file, s.access_token, onProgress);
    row = { id, name: file.name, url: pubBase() + path, thumb: '', kind: 'video', size: file.size };
  } else if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    const ext = file.type === 'image/gif' ? 'gif' : 'svg';
    const path = `${id}.${ext}`;
    await putObject(path, file, s.access_token, onProgress);
    row = { id, name: file.name, url: pubBase() + path, thumb: '', kind: 'image', size: file.size };
  } else {
    const img = await loadImage(file);
    const full = await toWebp(img, 2400);
    const th = await toWebp(img, 640);
    await putObject(`${id}.webp`, full.blob, s.access_token, (p) => onProgress?.(p * 0.8));
    await putObject(`${id}-thumb.webp`, th.blob, s.access_token, (p) => onProgress?.(0.8 + p * 0.2));
    row = { id, name: file.name || base, url: pubBase() + `${id}.webp`, thumb: pubBase() + `${id}-thumb.webp`, kind: 'image', size: full.blob.size, width: full.w, height: full.h };
  }
  await authed('/rest/v1/media', { method: 'POST', headers: { ...JSONH, Prefer: 'return=minimal' }, body: row });
  return toEntry(row);
}
