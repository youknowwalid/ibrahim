// Converts the original photos supplied by Anonna into web-ready images (full + thumbnail).
// Usage: node scripts/seed-media.mjs [sourceDir]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = process.argv[2] || '/mnt/user-data/uploads';
const out = path.resolve('seed/uploads');
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort();
let i = 0;
const report = [];
for (const f of files) {
  i++;
  const id = 'anonna-' + String(i).padStart(2, '0');
  const img = sharp(path.join(src, f), { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const long = Math.max(meta.width, meta.height);
  const full = await img.clone().resize({ width: meta.width >= meta.height ? 2000 : 1400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(out, id + '.webp'), full.data);
  const thumb = await img.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  fs.writeFileSync(path.join(out, id + '-thumb.webp'), thumb);
  report.push({ id, from: f, w: full.info.width, h: full.info.height, kb: Math.round(full.data.length / 1024) });
}
console.table(report);
fs.writeFileSync(path.join(out, '_manifest.json'), JSON.stringify(report, null, 2));
