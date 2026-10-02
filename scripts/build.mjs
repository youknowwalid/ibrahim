// Bundles the React app with esbuild into dist/ (hashed assets + index.html template).
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
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
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
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
  fs.writeFileSync(path.join(dist, 'index.html'), html);
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
