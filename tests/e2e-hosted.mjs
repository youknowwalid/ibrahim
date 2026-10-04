// End-to-end test of the HOSTED (Vercel + Supabase) version, using a static server that mimics Vercel's
// rewrites and an in-memory Supabase imitation.   Run:  node tests/e2e-hosted.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMock } from './mock-supabase.mjs';

const root = path.resolve(import.meta.dirname, '..');
const FIX = path.join(import.meta.dirname, 'fixtures');
const WEB = 3200, API = 3201, BASE = `http://localhost:${WEB}`;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'af-hosted-'));
const b = spawnSync('node', ['scripts/build.mjs'], { cwd: root, env: { ...process.env, DIST_DIR: out, SUPABASE_URL: `http://localhost:${API}`, SUPABASE_KEY: 'anon-key' }, encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(2); }

const mock = await startMock(API);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
// same behaviour as vercel.json: real files first, everything else (except /assets, /uploads) → index.html
const web = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
    if (/^\/(assets|uploads)\//.test(p)) { res.writeHead(404); return res.end(); }
    f = path.join(out, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(WEB);
process.on('exit', () => { web.close(); mock.close(); });

const results = [];
let grp = '';
const group = (n) => { grp = n; console.log(`\n== ${n}`); };
async function check(name, fn) {
  try { await fn(); results.push({ ok: true }); console.log('  ✓', name); }
  catch (e) { results.push({ ok: false, name, err: e.message }); console.log('  ✗', name, '\n     ', e.message.split('\n').slice(0, 3).join('\n      ')); }
}
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errs = [];
async function open(w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|gstatic|Failed to load resource|net::|youtube|ytimg/.test(m.text())) errs.push(`[console] ${m.text()}`); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return { page, ctx };
}
const settle = async (p, ms = 500) => { await p.waitForLoadState('load'); await p.waitForTimeout(ms); };

group('Public site (database empty → bundled starting content)');
{
  const { page, ctx } = await open();
  await page.goto(BASE + '/'); await settle(page);
  await check('home renders from the starting content; baked page title', async () => {
    ok((await page.title()).includes('Anonna Fatima'));
    eq((await page.textContent('h1.hero-title')).trim(), 'Anonna Fatima');
    ok(await page.$eval('.hero-img', (i) => i.complete && i.naturalWidth > 0), 'hero image served from /uploads');
  });
  await check('featured cards open a modal with the description', async () => {
    eq(await page.$$eval('.feat-card', (c) => c.length), 4);
    await page.click('.feat-card >> nth=0');
    await page.waitForSelector('.fmodal');
    ok((await page.textContent('.fm-desc')).includes('Miss Grand Bangladesh 2026'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.fmodal', { state: 'detached' });
  });
  for (const r of ['/about', '/lookbook', '/contact']) {
    await check(`deep link ${r} works (SPA rewrite)`, async () => {
      await page.goto(BASE + r); await settle(page, 300);
      ok(await page.isVisible('main.page'));
    });
  }
  await check('unknown URL shows the not-found page', async () => {
    await page.goto(BASE + '/nope'); await settle(page, 300);
    ok(await page.isVisible('h1:has-text("Page not found")'));
  });
  await ctx.close();
}

group('Contact form → database');
{
  const { page, ctx } = await open();
  await page.goto(BASE + '/contact'); await settle(page);
  await check('validation errors shown', async () => {
    await page.click('button[type=submit]');
    ok((await page.$$('.field-error')).length >= 4);
  });
  await check('valid message is stored in the database', async () => {
    await page.fill('#cf-firstName', 'Vera'); await page.fill('#cf-lastName', 'Visitor');
    await page.fill('#cf-email', 'visitor@example.com');
    await page.fill('#cf-date', new Date(Date.now() + 864e5 * 3).toISOString().slice(0, 10));
    await page.selectOption('#cf-time', { index: 2 });
    await page.fill('#cf-message', 'Hello, I would like to book you for a shoot.');
    await page.click('button[type=submit]');
    await page.waitForSelector('.form-done');
    eq(mock.db.messages.length, 1);
    eq(mock.db.messages[0].first_name, 'Vera');
    eq(mock.db.messages[0].email, 'visitor@example.com');
  });
  await ctx.close();
}

group('Admin (hosted)');
const { page: ap, ctx: actx } = await open(1360, 900);
const field = (label) => ap.locator(`.adm-field:has(> label:text-is("${label}")), .adm-field:has(> .adm-label:text-is("${label}"))`).first();
const save = async () => { await ap.click('.adm-savebar .adm-btn.primary'); await ap.waitForSelector('.adm-toast:has-text("Saved")'); await ap.waitForFunction(() => document.querySelector('.adm-status')?.textContent.includes('All changes saved')); };
await ap.goto(BASE + '/admin'); await settle(ap, 400);
await check('wrong password is rejected', async () => {
  await ap.fill('#lu', 'admin'); await ap.fill('#lp', 'nope'); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-error');
  ok(!(await ap.isVisible('.adm-dash')));
});
await check('sign in with "admin" + password; dashboard loads and content is auto-created', async () => {
  await ap.fill('#lp', mock.password); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-dash');
  ok(mock.db.content && mock.db.content.site.name === 'Anonna Fatima', 'seeded');
  ok((await ap.textContent('.adm-brand')).includes('Anonna Fatima'));
});
await check('inbox shows the visitor message; read/unread/delete work', async () => {
  await ap.waitForSelector('.adm-count');
  await ap.click('.adm-side a:has-text("Messages")');
  await ap.click('.adm-msg-head');
  ok((await ap.textContent('.adm-msg-body')).includes('book you for a shoot'));
  await ap.waitForFunction(() => !document.querySelector('.adm-count'));
  eq(mock.db.messages[0].is_read, true);
  await ap.click('button:has-text("Mark unread")');
  await ap.waitForSelector('.adm-count');
  await ap.click('.adm-msg-body button:has-text("Delete")');
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForSelector('text=No messages yet');
  eq(mock.db.messages.length, 0);
});
await check('edit hero text → Save → public site shows it from the database', async () => {
  await ap.click('.adm-side a:has-text("Home · Hero")');
  await field('Big name on the opening picture').locator('input').fill('Anonna Fatima ✦');
  await save();
  eq(mock.db.content.home.hero.title, 'Anonna Fatima ✦');
  const pub = await open();
  await pub.page.goto(BASE + '/'); await settle(pub.page, 500);
  eq((await pub.page.textContent('h1.hero-title')).trim(), 'Anonna Fatima ✦');
  await pub.ctx.close();
});
await check('hidden featured items are not shown publicly', async () => {
  const c = JSON.parse(JSON.stringify(mock.db.content));
  c.home.featured.items[0].visible = false;
  mock.db.content = c;
  const pub = await open();
  await pub.page.goto(BASE + '/'); await settle(pub.page, 500);
  eq(await pub.page.$$eval('.feat-card', (e) => e.length), 3);
  await pub.ctx.close();
});
await check('add a featured item in the admin and it appears on the site', async () => {
  await ap.click('.adm-side a:has-text("Home · Featured")');
  await ap.click('button:has-text("+ Add featured item")');
  const body = ap.locator('.adm-item.open .adm-item-body');
  await body.locator('.adm-field:has(> label:text-is("Title / headline")) input').fill('Hosted test feature');
  await body.locator('.adm-field:has(label:text-is("Picture or video")) input').first().fill('/uploads/anonna-05.webp');
  await body.locator('.adm-field:has(label:has-text("Description")) textarea').fill('Description for hosted test.');
  await save();
  const pub = await open();
  await pub.page.goto(BASE + '/'); await settle(pub.page, 400);
  await pub.page.click('.feat-card:has-text("Hosted test feature")');
  await pub.page.waitForSelector('.fm-img');
  ok((await pub.page.textContent('.fm-desc')).includes('Description for hosted test'));
  await pub.ctx.close();
});
await check('media library lists built-in photos; uploading a picture stores resized WebP files', async () => {
  await ap.click('.adm-side a:has-text("Media library")');
  await ap.waitForSelector('.adm-lib');
  const before = await ap.$$eval('.adm-libitem', (e) => e.length);
  ok(before >= 11, 'built-in photos listed: ' + before);
  await ap.setInputFiles('input[type=file]', path.join(FIX, 'upload-test.png'));
  await ap.waitForFunction((n) => document.querySelectorAll('.adm-libitem').length === n + 1, before, { timeout: 15000 });
  eq(mock.db.media.length, 1);
  ok(/\.webp$/.test(mock.db.media[0].url) && mock.db.files.size === 2, 'files stored');
  const src = await ap.$eval('.adm-libitem:first-child img', (i) => i.src);
  ok(src.includes(`:${API}/storage/v1/object/public/uploads/`), src);
  ok(await ap.$eval('.adm-libitem:first-child img', (i) => new Promise((r) => (i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(true), i.onerror = () => r(false))))), 'image loads');
});
await check('upload a video', async () => {
  await ap.setInputFiles('input[type=file]', path.join(FIX, 'test.webm'));
  await ap.waitForFunction(() => document.querySelectorAll('.adm-libitem .vid').length === 1, null, { timeout: 15000 });
  eq(mock.db.media.length, 2);
});
await check('picker inside a section can choose an uploaded picture', async () => {
  await ap.click('.adm-side a:has-text("Contact page")');
  await ap.locator('.adm-field:has(label:text-is("Picture next to the form")) button:has-text("Change")').first().click();
  await ap.waitForSelector('.adm-modal .adm-tile');
  await ap.click('.adm-modal .adm-tile >> nth=0');
  await ap.click('.adm-modal button:has-text("Use this file")');
  await ap.waitForSelector('.adm-status:has-text("Unsaved")');
  await ap.click('.adm-savebar .adm-btn:has-text("Discard")'); await ap.click('.adm-dialog button:has-text("Discard")');
});
await check('delete an uploaded file removes it from storage', async () => {
  await ap.click('.adm-side a:has-text("Media library")');
  await ap.waitForSelector('.adm-lib');
  await ap.locator('.adm-libitem:first-child button:has-text("Delete")').click();
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForFunction(() => document.querySelectorAll('.adm-libitem .vid').length === 0);
  eq(mock.db.media.length, 1);
});
await check('built-in photos cannot be deleted (friendly message)', async () => {
  await ap.locator('.adm-libitem:last-child button:has-text("Delete")').click();
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForSelector('.adm-toast.error');
});
await check('backups are listed and can be restored', async () => {
  await ap.click('.adm-side a:has-text("Dashboard")');
  await ap.waitForSelector('.adm-backups li');
  ok((await ap.locator('.adm-backups li').count()) >= 2);
  const n = await ap.locator('.adm-backups li').count();
  await ap.locator('.adm-backups li').nth(n - 1).locator('button').click();
  await ap.click('.adm-dialog button:has-text("Restore")');
  await ap.waitForSelector('.adm-toast:has-text("restored")');
  eq(mock.db.content.home.hero.title, 'Anonna Fatima');
});
await check('reset to starting content works', async () => {
  await ap.click('button:has-text("Reset to starting content")');
  await ap.click('.adm-dialog button:has-text("Reset everything")');
  await ap.waitForSelector('.adm-toast:has-text("reset")');
  eq(mock.db.content.home.featured.items.length, 4);
});
await check('session survives a reload; expired tokens refresh silently', async () => {
  await ap.reload(); await ap.waitForSelector('.adm-dash');
  mock.db.shortExpiry = false;
  await ap.evaluate(() => { const s = JSON.parse(localStorage.getItem('af_admin_session')); s.expires_at = 1; localStorage.setItem('af_admin_session', JSON.stringify(s)); });
  await ap.reload(); await ap.waitForSelector('.adm-dash');
  ok(mock.db.log.some((l) => l.includes('grant_type=refresh_token')), 'refreshed');
});
await check('change password: wrong current rejected, new one accepted', async () => {
  await ap.click('.adm-side a:has-text("Password")');
  await ap.fill('#ac', 'wrong'); await ap.fill('#ap', 'Brand-New-Pass-1'); await ap.fill('#aa', 'Brand-New-Pass-1');
  await ap.click('button:has-text("Change password")');
  await ap.waitForSelector('.adm-error');
  await ap.fill('#ac', mock.password);
  await ap.click('button:has-text("Change password")');
  await ap.waitForSelector('.adm-toast:has-text("Password changed")');
  eq(mock.db.password, 'Brand-New-Pass-1');
});
await check('sign out returns to login and blocks the dashboard', async () => {
  await ap.click('.adm-side button:has-text("Sign out")');
  await ap.waitForSelector('#lu');
  await ap.goto(BASE + '/admin'); await ap.waitForSelector('#lu');
});

group('Resilience & security');
await check('site still renders if the database is down', async () => {
  mock.db.failPublic = true;
  const { page, ctx } = await open();
  await page.goto(BASE + '/'); await settle(page, 500);
  eq((await page.textContent('h1.hero-title')).trim(), 'Anonna Fatima');
  await ctx.close();
  mock.db.failPublic = false;
});
await check('anonymous visitors cannot read content tables, messages or media', async () => {
  for (const t of ['messages', 'media', 'site_content', 'content_backups']) {
    const r = await fetch(`http://localhost:${API}/rest/v1/${t}?select=*`, { headers: { apikey: 'anon-key', Authorization: 'Bearer anon-key' } });
    const d = await r.json();
    ok(Array.isArray(d) ? d.length === 0 : true, t);
  }
});
await check('no page errors during the whole run', async () => { eq(errs.join('\n'), ''); });

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
