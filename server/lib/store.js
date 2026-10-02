// Tiny JSON file store with atomic writes and automatic backups. No database needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultContent } from '../seed-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SEED_UPLOADS = path.join(ROOT, 'seed', 'uploads');

for (const d of [DATA_DIR, UPLOAD_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const files = {
  content: path.join(DATA_DIR, 'content.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  media: path.join(DATA_DIR, 'media.json'),
  auth: path.join(DATA_DIR, 'auth.json'),
};

// Copy the bundled photos into the uploads folder the first time the server runs.
export function seedUploads() {
  if (!fs.existsSync(SEED_UPLOADS)) return;
  const manifest = readJson(path.join(SEED_UPLOADS, '_manifest.json'), []);
  const media = readJson(files.media, []);
  const known = new Set(media.map((m) => m.url));
  for (const m of manifest) {
    for (const suffix of ['.webp', '-thumb.webp']) {
      const src = path.join(SEED_UPLOADS, m.id + suffix);
      const dst = path.join(UPLOAD_DIR, m.id + suffix);
      if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
    }
    const url = `/uploads/${m.id}.webp`;
    if (!known.has(url)) {
      media.push({
        id: m.id,
        type: 'image',
        url,
        thumb: `/uploads/${m.id}-thumb.webp`,
        name: `Anonna photo ${m.id.split('-')[1]}`,
        width: m.w,
        height: m.h,
        size: m.kb * 1024,
        created: new Date().toISOString(),
      });
    }
  }
  writeJsonAtomic(files.media, media);
}

export const store = {
  getContent() {
    const c = readJson(files.content, null);
    if (c) return c;
    writeJsonAtomic(files.content, defaultContent);
    return structuredClone(defaultContent);
  },
  saveContent(content) {
    // keep a rolling set of backups so edits can always be undone
    if (fs.existsSync(files.content)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(files.content, path.join(BACKUP_DIR, `content-${stamp}.json`));
      const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('content-')).sort();
      for (const f of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
    writeJsonAtomic(files.content, content);
  },
  listBackups() {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('content-'))
      .sort()
      .reverse()
      .map((f) => ({ id: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size, created: f.slice(8, -5) }));
  },
  readBackup(id) {
    if (!/^content-[\w-]+\.json$/.test(id)) return null;
    return readJson(path.join(BACKUP_DIR, id), null);
  },
  resetContent() {
    this.saveContent(structuredClone(defaultContent));
  },
  getMessages: () => readJson(files.messages, []),
  saveMessages: (m) => writeJsonAtomic(files.messages, m),
  getMedia: () => readJson(files.media, []),
  saveMedia: (m) => writeJsonAtomic(files.media, m),
  getAuth: () => readJson(files.auth, null),
  saveAuth: (a) => writeJsonAtomic(files.auth, a),
};
