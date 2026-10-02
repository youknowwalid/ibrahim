// Password hashing (scrypt), signed session cookies and light rate limiting. No dependencies.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { store, DATA_DIR } from './store.js';

const SESSION_MS = 12 * 60 * 60 * 1000;
export const COOKIE = 'af_admin';

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const b of crypto.randomBytes(12)) out += alphabet[b % alphabet.length];
  return out;
}

// Creates the admin account the first time the server starts.
export function ensureAdmin() {
  let auth = store.getAuth();
  if (auth) return null;
  const password = process.env.ADMIN_PASSWORD || randomPassword();
  const salt = crypto.randomBytes(16).toString('hex');
  auth = {
    username: process.env.ADMIN_USER || 'admin',
    salt,
    hash: hash(password, salt),
    secret: crypto.randomBytes(32).toString('hex'),
    mustChange: !process.env.ADMIN_PASSWORD,
  };
  store.saveAuth(auth);
  if (!process.env.ADMIN_PASSWORD) {
    fs.writeFileSync(
      path.join(DATA_DIR, 'ADMIN-LOGIN.txt'),
      `Admin panel login\n=================\nAddress:  /admin\nUsername: ${auth.username}\nPassword: ${password}\n\nYou will be asked to choose your own password the first time you sign in.\nDelete this file afterwards.\n`
    );
  }
  return { username: auth.username, password: process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : password };
}

export function checkLogin(username, password) {
  const auth = store.getAuth();
  if (!auth || typeof username !== 'string' || typeof password !== 'string') return false;
  const a = Buffer.from(hash(password, auth.salt), 'hex');
  const b = Buffer.from(auth.hash, 'hex');
  return username.trim().toLowerCase() === auth.username.toLowerCase() && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function changeCredentials({ username, password }) {
  const auth = store.getAuth();
  const salt = crypto.randomBytes(16).toString('hex');
  auth.salt = salt;
  auth.hash = hash(password, salt);
  if (username) auth.username = username;
  auth.mustChange = false;
  auth.secret = crypto.randomBytes(32).toString('hex'); // signs everyone out
  store.saveAuth(auth);
  try {
    fs.unlinkSync(path.join(DATA_DIR, 'ADMIN-LOGIN.txt'));
  } catch {}
}

export function makeToken() {
  const auth = store.getAuth();
  const exp = Date.now() + SESSION_MS;
  const payload = `${auth.username}.${exp}`;
  const sig = crypto.createHmac('sha256', auth.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function readSession(req) {
  const auth = store.getAuth();
  if (!auth) return null;
  const cookie = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!cookie) return null;
  try {
    const raw = Buffer.from(cookie.slice(COOKIE.length + 1), 'base64url').toString();
    const i = raw.lastIndexOf('.');
    const payload = raw.slice(0, i);
    const sig = raw.slice(i + 1);
    const expect = crypto.createHmac('sha256', auth.secret).update(payload).digest('hex');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const [user, exp] = [payload.slice(0, payload.lastIndexOf('.')), Number(payload.slice(payload.lastIndexOf('.') + 1))];
    if (!exp || exp < Date.now()) return null;
    return { user, mustChange: !!auth.mustChange };
  } catch {
    return null;
  }
}

export function cookieHeader(token, secure) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
export function clearCookieHeader() {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

const buckets = new Map();
// returns true when the caller is over the limit
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}
