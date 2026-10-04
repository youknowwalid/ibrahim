// Bundles the React app with esbuild into dist/ (hashed assets + index.html template).
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { defaultContent } from '../server/seed-content.js';

const root = path.resolve(import.meta.dirname, '..');
const dist = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(root, 'dist');
const watch = process.argv.includes('--watch');

export const options = {
  entryPoints: [path.join(root, 'src/main.jsx')],
  outdir: path.join(dist, 'assets'),
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
  loader: { '.svg': 'dataurl' },
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    // Public Supabase URL + anon key (safe to ship; protected by Row Level Security). Empty => self-hosted Node mode only.
    __SB__: process.env.SUPABASE_URL
      ? JSON.stringify({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_KEY || '' })
      : fs.existsSync(path.join(root, 'supabase.config.json')) ? fs.readFileSync(path.join(root, 'supabase.config.json'), 'utf8') : 'null',
  },
  metafile: true,
  logLevel: 'info',
};

function writeHtml(meta) {
  const outs = Object.entries(meta.outputs);
  const js = outs.find(([f, o]) => f.endsWith('.js') && o.entryPoint);
  const css = outs.find(([f]) => f.endsWith('.css'));
  const rel = (f) => '/' + path.relative(dist, path.join(root, f)).split(path.sep).join('/');
  let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  html = html.replace('<!--ASSETS_CSS-->', css ? `<link rel="stylesheet" href="${rel(css[0])}">` : '');
  html = html.replace('<!--ASSETS_JS-->', `<script type="module" src="${rel(js[0])}"></script>`);
  fs.writeFileSync(path.join(dist, 'server-template.html'), html); // placeholders kept for the Node server
  // Static hosting (Vercel): bake search/social tags from the starting content; the live text still comes from the database.
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const c = defaultContent;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const share = c.site.shareImage && host ? `https://${host}${c.site.shareImage}` : '';
  const seo = [
    `<title>${esc(c.site.seoTitle)}</title>`,
    `<meta name="description" content="${esc(c.site.seoDescription)}">`,
    `<meta property="og:type" content="website"><meta property="og:title" content="${esc(c.site.seoTitle)}"><meta property="og:description" content="${esc(c.site.seoDescription)}">`,
    share ? `<meta property="og:image" content="${esc(share)}"><meta name="twitter:card" content="summary_large_image">` : '',
  ].join('\n');
  html = html.replace('<!--SEO-->', () => seo).replace('<!--STATE-->', '');
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  // Starting photos (also served by the Node server from /seed/uploads).
  fs.cpSync(path.join(root, 'seed/uploads'), path.join(dist, 'uploads'), { recursive: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  if (watch) {
    const ctx = await esbuild.context({
      ...options,
      plugins: [{ name: 'html', setup: (b) => b.onEnd((r) => r.metafile && writeHtml(r.metafile)) }],
    });
    await ctx.watch();
    console.log('watching…');
  } else {
    const r = await esbuild.build(options);
    writeHtml(r.metafile);
    const size = Object.entries(r.metafile.outputs).map(([f, o]) => `${path.relative(dist, path.join(root, f))}  ${(o.bytes / 1024).toFixed(1)} kB`);
    console.log('\nBuilt:\n  ' + size.join('\n  '));
  }
}
