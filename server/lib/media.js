// Upload handling: images are auto-optimised (WebP + thumbnail), videos are stored as supplied.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { store, UPLOAD_DIR } from './store.js';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[media] sharp not installed — images will be stored without optimisation.');
}

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export const MAX_IMAGE = 30 * 1024 * 1024;
export const MAX_VIDEO = 400 * 1024 * 1024;

const slug = (s) =>
  String(s || 'file')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';

export function isAllowed(type) {
  return !!(IMAGE_TYPES[type] || VIDEO_TYPES[type]);
}
export function maxFor(type) {
  return VIDEO_TYPES[type] ? MAX_VIDEO : MAX_IMAGE;
}

export async function saveUpload({ buffer, type, originalName }) {
  const id = slug(originalName) + '-' + crypto.randomBytes(4).toString('hex');
  const created = new Date().toISOString();
  let entry;
  if (IMAGE_TYPES[type]) {
    if (sharp && type !== 'image/gif') {
      const img = sharp(buffer, { failOn: 'none' }).rotate();
      const full = await img.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const thumb = await img.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
      fs.writeFileSync(path.join(UPLOAD_DIR, id + '.webp'), full.data);
      fs.writeFileSync(path.join(UPLOAD_DIR, id + '-thumb.webp'), thumb);
      entry = { id, type: 'image', url: `/uploads/${id}.webp`, thumb: `/uploads/${id}-thumb.webp`, width: full.info.width, height: full.info.height, size: full.data.length };
    } else {
      const ext = IMAGE_TYPES[type];
      fs.writeFileSync(path.join(UPLOAD_DIR, `${id}.${ext}`), buffer);
      entry = { id, type: 'image', url: `/uploads/${id}.${ext}`, thumb: `/uploads/${id}.${ext}`, size: buffer.length };
    }
  } else {
    const ext = VIDEO_TYPES[type];
    fs.writeFileSync(path.join(UPLOAD_DIR, `${id}.${ext}`), buffer);
    entry = { id, type: 'video', url: `/uploads/${id}.${ext}`, thumb: '', size: buffer.length };
  }
  entry.name = String(originalName || id).slice(0, 120);
  entry.created = created;
  const media = store.getMedia();
  media.unshift(entry);
  store.saveMedia(media);
  return entry;
}

export function deleteMedia(id) {
  const media = store.getMedia();
  const m = media.find((x) => x.id === id);
  if (!m) return false;
  for (const u of [m.url, m.thumb]) {
    if (!u || !u.startsWith('/uploads/')) continue;
    const file = path.join(UPLOAD_DIR, path.basename(u));
    try {
      fs.unlinkSync(file);
    } catch {}
  }
  store.saveMedia(media.filter((x) => x.id !== id));
  return true;
}
