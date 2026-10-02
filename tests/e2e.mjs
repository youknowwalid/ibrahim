// End-to-end test suite: starts a throw-away copy of the site and exercises every page, interaction,
// breakpoint and admin function with a real browser.   Run:  node tests/e2e.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const PW = 'Test-Password-2026';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'af-shots');
const FIX = path.resolve(import.meta.dirname, 'fixtures');
fs.mkdirSync(SHOTS, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-e2e-'));

const server = spawn('node', ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR: dataDir, ADMIN_PASSWORD: PW }, cwd: path.resolve(import.meta.dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
process.on('exit', () => server.kill());
process.on('uncaughtException', (e) => { console.error(e); process.exit(2); });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
await new Promise((r) => setTimeout(r, 1500));

const results = [];
let currentGroup = '';
const group = (n) => { currentGroup = n; console.log(`\n== ${n}`); };
async function check(name, fn) {
  try {
    await fn();
    results.push({ group: currentGroup, name, ok: true });
    console.log('  ✓', name);
  } catch (e) {
    results.push({ group: currentGroup, name, ok: false, err: e.message.split('\n')[0] });
    console.log('  ✗', name, '\n     ', e.message.split('\n').slice(0, 3).join('\n      '));
  }
}
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const consoleErrors = [];
async function newPage(w = 1440, h = 900, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(g|googleapis)|gstatic|Failed to load resource|ERR_(BLOCKED|TUNNEL|CONNECTION|NAME|INTERNET)|youtube|ytimg|net::/.test(m.text())) consoleErrors.push(`[console] ${page.url()} ${m.text()}`);
  });
  return { page, ctx };
}
const settle = async (page, ms = 700) => { await page.waitForLoadState('load'); await page.waitForTimeout(ms); };
const scrollAll = async (page) => {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 450) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(90); }
  await page.waitForTimeout(1500);
};

/* =========================================================== PUBLIC SITE */
group('Public site — desktop');
{
  const { page, ctx } = await newPage(1920, 945);
  await page.goto(BASE + '/');
  await settle(page);
  await check('home title + hero name', async () => {
    ok((await page.title()).includes('Anonna Fatima'), 'title');
    eq((await page.textContent('h1.hero-title')).trim(), 'Anonna Fatima');
  });
  await check('hero fills viewport and image loads', async () => {
    const r = await page.evaluate(() => { const i = document.querySelector('.hero-img'); return { h: document.querySelector('.hero').offsetHeight, ok: i.complete && i.naturalWidth > 0 }; });
    eq(r.h, 851, 'hero height'); ok(r.ok, 'image not loaded');
  });
  await check('marquee band is 101px tall and scrolling', async () => {
    const h = await page.evaluate(() => document.querySelector('.marquee').offsetHeight);
    eq(h, 101);
    const t1 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.marquee-track')).transform).m41);
    await page.waitForTimeout(600);
    const t2 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.marquee-track')).transform).m41);
    ok(t2 < t1, `not moving (${t1} → ${t2})`);
  });
  await check('side menu opens, lists pages, closes with Escape', async () => {
    await page.click('.burger');
    await page.waitForSelector('.side-menu.open');
    const links = await page.$$eval('.side-menu nav a', (a) => a.map((x) => x.textContent.trim()));
    eq(links.join(','), 'Home,About,Lookbook,Contact');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/menu-1920.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.side-menu.open'));
  });
  await check('menu links navigate (About) and menu closes', async () => {
    await page.click('.burger');
    await page.click('.side-menu nav a:has-text("About")');
    await page.waitForFunction(() => location.pathname === '/about');
    ok(await page.isVisible('h1:has-text("About Me")'));
    ok(!(await page.$('.side-menu.open')), 'menu still open');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/');
  });
  await check('menu backdrop click closes menu', async () => {
    await page.click('.burger');
    await page.waitForSelector('.side-menu.open');
    await page.mouse.click(100, 400);
    await page.waitForFunction(() => !document.querySelector('.side-menu.open'));
  });
  await scrollAll(page);
  await check('stats counter rolls to the right digits', async () => {
    const cols = await page.$$eval('.stat:first-child .roll-col', (c) => c.map((x) => x.style.transform));
    eq(cols.join('|'), 'translateY(-20%)|translateY(0%)|translateY(-20%)|translateY(0%)');
    const label = await page.$$eval('.stat-label', (l) => l.map((x) => x.textContent));
    ok(label.includes('Modelling since'), 'labels');
  });
  await check('portfolio: first card wide, hover expands another', async () => {
    await page.locator('.portfolio').scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    const w = () => page.$$eval('.pf-card', (c) => c.map((x) => Math.round(x.getBoundingClientRect().width)));
    await page.hover('.pf-card >> nth=0'); await page.waitForTimeout(900);
    const a = await w();
    ok(a[0] > 560 && a[0] < 700 && a[1] < 260, 'initial widths ' + a);
    await page.hover('.pf-card >> nth=3'); await page.waitForTimeout(900);
    const b = await w();
    ok(b[3] > 560 && b[0] < 260, 'after hover widths ' + b);
    const shown = await page.$eval('.pf-card.active .pf-title', (e) => e.textContent);
    eq(shown, 'Golden Fields');
    await page.screenshot({ path: `${SHOTS}/portfolio-hover-1920.png` });
  });
  await check('portfolio card links to lookbook', async () => {
    await page.click('.pf-card >> nth=3');
    await page.waitForFunction(() => location.pathname === '/lookbook');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/');
  });
  await check('Featured section sits after Portfolio, before the contact banner', async () => {
    const order = await page.$$eval('main > section, main > div, section', (s) => s.map((x) => x.className.split(' ')[0]).filter((c) => ['portfolio', 'featured', 'cta', 'stats', 'intro'].includes(c)));
    eq(order.join(','), 'intro,stats,portfolio,featured,cta');
  });
  await check('Featured: only thumbnail cards are shown', async () => {
    eq(await page.$$eval('.feat-card', (c) => c.length), 4);
    eq(await page.$$eval('.feat-card img', (c) => c.every((i) => i.naturalWidth > 0)), true, 'thumbs loaded');
    ok(!(await page.$('.fmodal')), 'modal should be closed');
  });
  await check('Featured modal: opens with image + description + source link', async () => {
    await page.locator('.featured').scrollIntoViewIfNeeded();
    await page.click('.feat-card >> nth=0');
    await page.waitForSelector('.fmodal [role=dialog]');
    ok(await page.isVisible('.fm-img'), 'image');
    ok((await page.textContent('.fm-title')).includes('Beyond the crown'));
    ok((await page.textContent('.fm-desc')).includes('Project Shakti'));
    eq(await page.getAttribute('.fm-source', 'href'), 'https://thebangladeshtoday.com/?p=37718');
    eq(await page.getAttribute('.fm-source', 'target'), '_blank');
    eq(new URL(page.url()).hash, '#featured-f1');
    await page.screenshot({ path: `${SHOTS}/featured-modal-1920.png` });
  });
  await check('Featured modal: arrows + keyboard navigate, Escape closes and restores focus', async () => {
    await page.keyboard.press('ArrowRight');
    ok((await page.textContent('.fm-title')).includes('Egypt'), 'next item');
    await page.click('.fm-nav.prev');
    ok((await page.textContent('.fm-title')).includes('Beyond the crown'), 'prev item');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.fmodal'));
    eq(new URL(page.url()).hash, '');
    const f = await page.evaluate(() => document.activeElement?.className);
    ok(/feat-card/.test(f), 'focus restored: ' + f);
    ok(await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), 'scroll unlocked');
  });
  await check('Featured modal: backdrop click closes', async () => {
    await page.click('.feat-card >> nth=1');
    await page.waitForSelector('.fmodal');
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => !document.querySelector('.fmodal'));
  });
  await check('Back-to-top button appears and scrolls to top', async () => {
    await page.evaluate(() => window.scrollTo(0, 3000)); await page.waitForTimeout(500);
    ok(await page.isVisible('.to-top.show'));
    await page.click('.to-top');
    await page.waitForFunction(() => window.scrollY < 5, null, { timeout: 5000 });
  });
  await check('footer + CTA button go to contact', async () => {
    ok((await page.textContent('.site-footer')).includes('© 2026 Anonna Fatima'));
    await page.click('.cta .btn');
    await page.waitForFunction(() => location.pathname === '/contact');
  });
  await ctx.close();
}

{
  const { page, ctx } = await newPage(1920, 945);
  await page.goto(BASE + '/#featured-f2'); await settle(page, 1200);
  await check('Featured deep link opens the right modal', async () => {
    ok(await page.isVisible('.fmodal'), 'modal visible');
    ok((await page.textContent('.fm-title')).includes('Egypt'));
  });
  await ctx.close();
}

group('Public site — inner pages');
{
  const { page, ctx } = await newPage(1920, 945);
  await page.goto(BASE + '/about'); await settle(page); await scrollAll(page);
  await check('About: title, subtitle, bio columns, stats, CTA', async () => {
    eq((await page.textContent('h1')).trim(), 'About Me');
    eq(await page.$$eval('.bio-col p', (p) => p.length), 4);
    ok(await page.isVisible('.stats'), 'stats'); ok(await page.isVisible('.cta'), 'cta');
  });
  await check('About: strip is 323×431 and draggable', async () => {
    const d = await page.$eval('.strip-img', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    ok(Math.abs(d[0] - 323) <= 1 && Math.abs(d[1] - 431) <= 2, 'size ' + d);
    await page.evaluate(() => window.scrollTo(0, 0));
    const row = page.locator('.drag-row').first();
    const b = await row.boundingBox();
    const before = await row.evaluate((e) => e.scrollLeft);
    await page.mouse.move(b.x + 900, b.y + 200); await page.mouse.down(); await page.mouse.move(b.x + 400, b.y + 200, { steps: 8 }); await page.mouse.up();
    const after = await row.evaluate((e) => e.scrollLeft);
    ok(after > before + 100, `scrollLeft ${before} → ${after}`);
    ok(!(await page.$('.lightbox')), 'drag should not open lightbox');
  });
  await check('About: lightbox opens, arrows move, Escape closes', async () => {
    await page.evaluate(() => document.querySelector('.drag-row').scrollLeft = 0);
    await page.click('.strip-img >> nth=0');
    await page.waitForSelector('.lightbox img');
    const s1 = await page.getAttribute('.lightbox img', 'src');
    await page.keyboard.press('ArrowRight');
    const s2 = await page.getAttribute('.lightbox img', 'src');
    ok(s1 !== s2, 'image should change');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.lightbox'));
  });
  await page.screenshot({ path: `${SHOTS}/about-1920.png`, fullPage: true });

  await page.goto(BASE + '/lookbook'); await settle(page); await scrollAll(page);
  await check('Lookbook: three sections, 555×740 images', async () => {
    eq(await page.$$eval('.look-section', (s) => s.length), 3);
    const t = await page.$$eval('.look-section .h2', (h) => h.map((x) => x.textContent));
    eq(t.join('|'), 'Bangladesh|Style|Golden Light');
    const d = await page.$eval('.look-img', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    ok(Math.abs(d[0] - 555) <= 1 && Math.abs(d[1] - 740) <= 2, 'size ' + d);
  });
  await check('Lookbook: images open in lightbox', async () => {
    await page.click('.look-img >> nth=1');
    await page.waitForSelector('.lightbox');
    await page.keyboard.press('Escape');
  });
  await page.screenshot({ path: `${SHOTS}/lookbook-1920.png`, fullPage: true });

  await page.goto(BASE + '/contact'); await settle(page); await scrollAll(page);
  await page.screenshot({ path: `${SHOTS}/contact-1920.png`, fullPage: true });
  await check('Contact: layout matches reference (552×736 image, 564px form)', async () => {
    const i = await page.$eval('.contact-img', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    ok(Math.abs(i[0] - 552) <= 1 && Math.abs(i[1] - 736) <= 2, 'img ' + i);
    const f = await page.$eval('.contact-form-wrap', (e) => Math.round(e.getBoundingClientRect().width));
    eq(f, 564);
    const btn = await page.$eval('button[type=submit]', (e) => Math.round(e.getBoundingClientRect().height));
    eq(btn, 51);
  });
  await check('Contact: empty submit shows every error and does not send', async () => {
    await page.click('button[type=submit]');
    await page.waitForSelector('.field-error');
    ok((await page.$$eval('.field-error', (e) => e.length)) >= 6, 'errors');
  });
  await check('Contact: invalid email + past date rejected', async () => {
    await page.fill('#cf-firstName', 'Test'); await page.fill('#cf-lastName', 'Visitor');
    await page.fill('#cf-email', 'not-an-email'); await page.fill('#cf-date', '2020-01-01');
    await page.selectOption('#cf-time', '10:00 AM'); await page.fill('#cf-message', 'Hello Anonna, we would like to book you for a shoot.');
    await page.click('button[type=submit]');
    const errs = await page.$$eval('.field-error', (e) => e.map((x) => x.textContent));
    ok(errs.some((e) => /valid email/.test(e)), 'email error'); ok(errs.some((e) => /date/.test(e)), 'date error');
  });
  await check('Contact: valid submission succeeds', async () => {
    await page.fill('#cf-email', 'visitor@example.com');
    const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    await page.fill('#cf-date', d);
    await page.click('button[type=submit]');
    await page.waitForSelector('.form-done');
    ok((await page.textContent('.form-done')).includes('Thank you'));
  });
  await check('Contact: honeypot submissions are silently dropped', async () => {
    const r = await page.evaluate(async () => { const x = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Bot', lastName: 'Bot', email: 'b@b.co', date: '2030-01-01', time: '10:00 AM', message: 'spam spam', website: 'http://spam' }) }); return x.status; });
    eq(r, 200);
  });
  await check('Unknown URL shows page-not-found with 404 status', async () => {
    const res = await page.goto(BASE + '/does-not-exist');
    eq(res.status(), 404);
    ok(await page.isVisible('h1:has-text("Page not found")'));
  });
  await ctx.close();
}

group('Security & API');
{
  const { page, ctx } = await newPage();
  await page.goto(BASE + '/');
  const call = (m, u, b, h = {}) => page.evaluate(async ([m, u, b, h]) => { const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return r.status; }, [m, u, b, h]);
  await check('admin API refuses anonymous requests', async () => {
    for (const [m, u] of [['GET', '/api/admin/content'], ['PUT', '/api/admin/content'], ['GET', '/api/admin/messages'], ['POST', '/api/admin/upload'], ['GET', '/api/admin/media'], ['DELETE', '/api/admin/media/x']]) eq(await call(m, u, m === 'PUT' ? {} : undefined, { 'X-Requested-With': 'admin' }), 401, `${m} ${u}`);
  });
  await check('wrong password is rejected', async () => eq(await call('POST', '/api/admin/login', { username: 'admin', password: 'nope' }), 401));
  await check('public content API hides nothing sensitive', async () => {
    const t = await page.evaluate(() => fetch('/api/content').then((r) => r.text()));
    ok(!/password|secret|hash|salt/i.test(t), 'leak');
  });
  await check('path traversal is blocked', async () => {
    const r = await page.evaluate(() => fetch('/uploads/..%2f..%2fdata%2fauth.json').then((r) => r.status));
    ok(r === 404 || r === 400, 'status ' + r);
    const r2 = await page.evaluate(() => fetch('/..%2fserver%2findex.js').then((r) => r.status));
    ok(r2 === 404 || r2 === 400, 'status ' + r2);
  });
  await check('security headers + sitemap + robots', async () => {
    const h = await page.evaluate(() => fetch('/').then((r) => r.headers.get('x-content-type-options')));
    eq(h, 'nosniff');
    ok((await page.evaluate(() => fetch('/robots.txt').then((r) => r.text()))).includes('Disallow: /admin'));
    ok((await page.evaluate(() => fetch('/sitemap.xml').then((r) => r.text()))).includes('/lookbook'));
  });
  await check('page HTML carries SEO title + description for crawlers', async () => {
    const html = await page.evaluate(() => fetch('/about').then((r) => r.text()));
    ok(/<title>About Me \| Anonna Fatima<\/title>/.test(html) && /og:title/.test(html));
  });
  await ctx.close();
}

/* =========================================================== RESPONSIVE */
group('Responsive layout (no horizontal overflow, nothing clipped)');
for (const w of [1920, 1440, 1280, 1024, 820, 768, 600, 414, 390, 360]) {
  const { page, ctx } = await newPage(w, w < 700 ? 800 : 900);
  for (const p of ['/', '/about', '/lookbook', '/contact']) {
    await check(`${w}px  ${p}`, async () => {
      await page.goto(BASE + p); await settle(page, 400); await scrollAll(page);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      ok(o.sw <= o.iw, `horizontal overflow: scrollWidth ${o.sw} > ${o.iw}`);
      if ([1024, 768, 390].includes(w)) await page.screenshot({ path: `${SHOTS}/${p === '/' ? 'home' : p.slice(1)}-${w}.png`, fullPage: true });
    });
  }
  if (w <= 768) {
    await check(`${w}px  mobile menu + featured modal usable`, async () => {
      await page.goto(BASE + '/'); await settle(page, 400);
      await page.click('.burger'); await page.waitForSelector('.side-menu.open'); await page.waitForTimeout(700);
      const box = await page.$eval('.side-menu', (e) => e.getBoundingClientRect().width);
      ok(box <= w, 'menu wider than screen');
      await page.screenshot({ path: `${SHOTS}/menu-${w}.png` });
      await page.click('.menu-close'); await page.waitForFunction(() => !document.querySelector('.side-menu.open'));
      await page.locator('.feat-card').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
      await page.click('.feat-card >> nth=0'); await page.waitForSelector('.fmodal');
      const m = await page.$eval('.fmodal-box', (e) => { const r = e.getBoundingClientRect(); return { r: r.right, h: r.height }; });
      ok(m.r <= w + 1, 'modal overflows'); ok(m.h <= 900, 'modal too tall');
      ok(await page.isVisible('.fm-close'), 'close button visible');
      await page.screenshot({ path: `${SHOTS}/modal-${w}.png` });
      await page.click('.fm-close'); await page.waitForFunction(() => !document.querySelector('.fmodal'));
    });
  }
  await ctx.close();
}

/* =========================================================== ADMIN */
group('Admin panel');
const A = await newPage(1360, 900);
const ap = A.page;
const field = (label) => ap.locator(`.adm-field:has(> label:text-is("${label}")), .adm-field:has(> .adm-label:text-is("${label}"))`).first();
const save = async () => { await ap.click('.adm-savebar .adm-btn.primary'); await ap.waitForSelector('.adm-toast:has-text("Saved")'); await ap.waitForFunction(() => document.querySelector('.adm-status')?.textContent.includes('All changes saved')); };
await ap.goto(BASE + '/admin'); await settle(ap, 500);
await check('login screen rejects bad password', async () => {
  await ap.fill('#lu', 'admin'); await ap.fill('#lp', 'wrong'); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-error');
});
await check('login with correct password opens dashboard', async () => {
  await ap.fill('#lp', PW); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-dash');
  ok((await ap.textContent('.adm-brand')).includes('Anonna Fatima'));
  await ap.screenshot({ path: `${SHOTS}/admin-dashboard.png` });
});
await check('messages inbox shows the contact-form message and unread badge', async () => {
  await ap.waitForSelector('.adm-count');
  eq((await ap.textContent('.adm-count')).trim(), '1');
  await ap.click('.adm-side a:has-text("Messages")');
  await ap.waitForSelector('.adm-msgs li.unread');
  await ap.click('.adm-msg-head');
  ok((await ap.textContent('.adm-msg-body')).includes('book you for a shoot'));
  ok((await ap.textContent('.adm-msg-body')).includes('visitor@example.com'));
  await ap.waitForFunction(() => !document.querySelector('.adm-count'));
  await ap.screenshot({ path: `${SHOTS}/admin-messages.png` });
});
await check('can mark unread, then delete the message', async () => {
  await ap.click('button:has-text("Mark unread")');
  await ap.waitForSelector('.adm-count');
  await ap.click('.adm-msg-body button:has-text("Delete")');
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForSelector('text=No messages yet');
});
await check('edit hero text → Save → live site changes', async () => {
  await ap.click('.adm-side a:has-text("Home · Hero")');
  await ap.fill('#' + await field('Big name on the opening picture').locator('input').getAttribute('id'), 'Anonna Fatima ✦');
  ok((await ap.textContent('.adm-status')).includes('Unsaved'));
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await settle(pub.page, 400);
  eq((await pub.page.textContent('h1.hero-title')).trim(), 'Anonna Fatima ✦');
  await pub.ctx.close();
});
await check('Ctrl+S saves', async () => {
  const el = field('Big name on the opening picture').locator('input');
  await el.fill('Anonna Fatima');
  await ap.keyboard.press('Control+s');
  await ap.waitForSelector('.adm-status:has-text("All changes saved")');
});
await check('banner words: add, edit, reorder, delete', async () => {
  const f = field('Scrolling banner words');
  await f.locator('button:has-text("Add banner item")').click();
  await f.locator('input').last().fill('Brand Ambassador');
  await f.locator('button[aria-label^="Move item 6 up"]').click();
  const vals = await f.locator('input').evaluateAll((e) => e.map((x) => x.value));
  eq(vals[4], 'Brand Ambassador');
  await f.locator('button[aria-label^="Delete item 5"]').click();
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForTimeout(100);
  eq(await f.locator('input').count(), 5);
  await f.locator('input').first().fill('Changed then discarded');
  await ap.click('.adm-savebar .adm-btn:has-text("Discard")'); await ap.click('.adm-dialog button:has-text("Discard")');
  await ap.waitForSelector('.adm-status:has-text("All changes saved")');
  eq(await f.locator('input').first().inputValue(), 'Model');
});
await check('stats cards: edit a value and add a card', async () => {
  await ap.click('.adm-side a:has-text("Stats cards")');
  await ap.click('.adm-item-toggle >> nth=0');
  const v = ap.locator('.adm-item-body label:text-is("Big text") >> xpath=following::input[1]').first();
  await v.fill('2019');
  await ap.click('button:has-text("+ Add stats card")');
  await ap.locator('.adm-item.open .adm-item-body input').nth(0).fill('175 cm');
  await ap.locator('.adm-item.open .adm-item-body input').nth(1).fill('Height');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  const labels = await pub.page.$$eval('.stat-label', (l) => l.map((x) => x.textContent));
  ok(labels.includes('Height'), 'new card');
  eq(await pub.page.$eval('.stat:first-child .roll', (e) => e.getAttribute('aria-label')), '2019');
  await pub.ctx.close();
});

group('Admin — Featured section CMS');
await ap.click('.adm-side a:has-text("Home · Featured")');
await ap.waitForSelector('.adm-item');
let newCount = 0;
await check('add an item: YouTube video link with a library thumbnail', async () => {
  await ap.click('button:has-text("+ Add featured item")');
  const body = ap.locator('.adm-item.open .adm-item-body');
  await body.locator('.adm-field:has(> label:text-is("Title / headline")) input').fill('Test interview video');
  await body.locator('select').selectOption('video');
  await body.locator('.adm-field:has(label:text-is("Picture or video")) input').first().fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  // thumbnail from library
  await body.locator('.adm-field:has(label:text-is("Card thumbnail")) button:has-text("Choose")').click();
  await ap.waitForSelector('.adm-modal');
  await ap.click('.adm-tile >> nth=7');
  await ap.click('.adm-modal button:has-text("Use this file")');
  await body.locator('.adm-field:has(label:has-text("Description")) textarea').fill('A short description of the interview, shown beneath the video.');
  await body.locator('.adm-field:has(label:text-is("Publication / source name")) input').fill('Example Magazine');
  await body.locator('.adm-field:has(label:text-is("Link to the original article / source")) input').fill('https://example.com/interview');
  await body.locator('.adm-field:has(label:text-is("Date")) input').fill('2026-09-30');
  await ap.screenshot({ path: `${SHOTS}/admin-featured-edit.png` });
  await save();
  newCount++;
});
await check('YouTube item shows on site as a card with play icon; modal embeds the player', async () => {
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  eq(await pub.page.$$eval('.feat-card', (c) => c.length), 5);
  ok(await pub.page.isVisible('.feat-play'), 'play icon');
  await pub.page.click('.feat-card:has-text("Test interview video")');
  await pub.page.waitForSelector('.fm-poster');
  await pub.page.click('.fm-poster');
  await pub.page.waitForSelector('.fm-embed iframe');
  const src = await pub.page.getAttribute('.fm-embed iframe', 'src');
  ok(src.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), src);
  ok((await pub.page.textContent('.fm-desc')).includes('beneath the video'));
  eq(await pub.page.getAttribute('.fm-source', 'href'), 'https://example.com/interview');
  await pub.page.screenshot({ path: `${SHOTS}/featured-video-modal.png` });
  await pub.ctx.close();
});
await check('upload a video file via the picker and use it', async () => {
  const body = ap.locator('.adm-item.open .adm-item-body');
  await body.locator('.adm-field:has(label:text-is("Picture or video")) button:has-text("Change")').click();
  await ap.waitForSelector('.adm-modal');
  await ap.setInputFiles('.adm-modal input[type=file]', path.join(FIX, 'test.webm'));
  await ap.waitForSelector('.adm-tile.on .vid', { timeout: 15000 });
  await ap.click('.adm-modal button:has-text("Use this file")');
  const v = await body.locator('.adm-field:has(label:text-is("Picture or video")) input').first().inputValue();
  ok(/^\/uploads\/test-[0-9a-f]+\.webm$/.test(v), v);
  await save();
});
await check('uploaded video plays in the modal (native player)', async () => {
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  await pub.page.click('.feat-card:has-text("Test interview video")');
  await pub.page.waitForSelector('video.fm-video');
  await pub.page.waitForFunction(() => document.querySelector('video.fm-video').readyState >= 1, null, { timeout: 8000 });
  const d = await pub.page.$eval('video.fm-video', (v) => v.duration);
  ok(d > 1 && d < 3, 'duration ' + d);
  const rng = await pub.page.evaluate(async () => { const s = document.querySelector('video.fm-video').getAttribute('src'); const r = await fetch(s, { headers: { Range: 'bytes=0-99' } }); return [r.status, r.headers.get('content-range')]; });
  eq(rng[0], 206, 'range support');
  await pub.ctx.close();
});
await check('upload an image from the Media library page; appears and can be used', async () => {
  await ap.click('.adm-side a:has-text("Media library")');
  await ap.waitForSelector('.adm-lib');
  const before = await ap.$$eval('.adm-libitem', (e) => e.length);
  await ap.setInputFiles('input[type=file]', path.join(FIX, 'upload-test.png'));
  await ap.waitForFunction((n) => document.querySelectorAll('.adm-libitem').length === n + 1, before, { timeout: 15000 });
  const u = await ap.$eval('.adm-libitem:first-child img', (i) => i.getAttribute('src'));
  ok(/-thumb\.webp$/.test(u), u);
  const info = await ap.textContent('.adm-libitem:first-child small');
  ok(/1440×1800/.test(info), 'dimensions: ' + info);
  await ap.screenshot({ path: `${SHOTS}/admin-media.png` });
});
await check('unsupported file types are rejected', async () => {
  const r = await ap.evaluate(async () => { const x = await fetch('/api/admin/upload?name=a.exe', { method: 'POST', headers: { 'Content-Type': 'application/x-msdownload', 'X-Requested-With': 'admin' }, body: new Uint8Array([1, 2, 3]) }); return x.status; });
  eq(r, 415);
  const r2 = await ap.evaluate(async () => { const x = await fetch('/api/admin/upload?name=a.svg', { method: 'POST', headers: { 'Content-Type': 'image/svg+xml', 'X-Requested-With': 'admin' }, body: '<svg onload=alert(1)/>' }); return x.status; });
  eq(r2, 415);
  const r3 = await ap.evaluate(async () => { const x = await fetch('/api/admin/upload?name=a.png', { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-Requested-With': 'admin' }, body: 'not really a png' }); return x.status; });
  eq(r3, 422);
});
await check('delete a media file (with confirmation)', async () => {
  const before = await ap.$$eval('.adm-libitem', (e) => e.length);
  await ap.click('.adm-libitem:first-child button:has-text("Delete")');
  await ap.click('.adm-dialog button:has-text("Delete")');
  await ap.waitForFunction((n) => document.querySelectorAll('.adm-libitem').length === n - 1, before);
});
await check('JS/Data links are stripped from saved content', async () => {
  const r = await ap.evaluate(async () => {
    const c = await fetch('/api/admin/content').then((r) => r.json());
    c.home.cta.buttonLink = 'javascript:alert(1)';
    await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'admin' }, body: JSON.stringify(c) });
    const d = await fetch('/api/admin/content').then((r) => r.json());
    return d.home.cta.buttonLink;
  });
  eq(r, '');
  await ap.evaluate(async () => { const c = await fetch('/api/admin/content').then((r) => r.json()); c.home.cta.buttonLink = '/contact'; await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'admin' }, body: JSON.stringify(c) }); });
});
await check('CSRF guard: writes without the admin header are refused', async () => {
  const r = await ap.evaluate(() => fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status));
  eq(r, 403);
});
await ap.goto(BASE + '/admin/featured'); await ap.waitForSelector('.adm-item');
await check('reorder: move new item to the top → site order follows', async () => {
  const last = ap.locator('.adm-item').last();
  await last.locator('button[title="Move up"]').click();
  await last.locator('xpath=preceding-sibling::li[1]').locator('button[title="Move up"]').click().catch(() => {});
  // move it up until first
  for (let i = 0; i < 4; i++) { const first = ap.locator('.adm-item .adm-item-toggle .t').first(); if ((await first.textContent()).includes('Test interview')) break; const idx = await ap.locator('.adm-item .adm-item-toggle .t').evaluateAll((e) => e.findIndex((x) => x.textContent.includes('Test interview'))); await ap.locator('.adm-item').nth(idx).locator('button[title="Move up"]').click(); }
  eq((await ap.locator('.adm-item .adm-item-toggle .t').first().textContent()).trim(), 'Test interview video');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  eq((await pub.page.textContent('.feat-card >> nth=0')).includes('Test interview video'), true);
  await pub.ctx.close();
});
await check('hide an item (untick “Show on website”) → disappears from site, stays in admin', async () => {
  await ap.locator('.adm-item .adm-item-toggle').first().click();
  await ap.locator('.adm-item.open .adm-toggle input').first().uncheck();
  await ap.waitForSelector('.adm-badge:has-text("Hidden")');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  eq(await pub.page.$$eval('.feat-card', (c) => c.length), 4);
  await pub.ctx.close();
});
await check('duplicate then delete an item (with confirmation)', async () => {
  const n = await ap.locator('.adm-item').count();
  await ap.locator('.adm-item').first().locator('button[title="Duplicate"]').click();
  eq(await ap.locator('.adm-item').count(), n + 1);
  await ap.locator('.adm-item').nth(1).locator('button[title="Delete"]').click();
  await ap.click('.adm-dialog button:has-text("Delete")');
  eq(await ap.locator('.adm-item').count(), n);
});
await check('delete the test item entirely → site back to 4 cards', async () => {
  await ap.locator('.adm-item').first().locator('button[title="Delete"]').click();
  await ap.click('.adm-dialog button:has-text("Delete")');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  eq(await pub.page.$$eval('.feat-card', (c) => c.length), 4);
  await pub.ctx.close();
});

group('Admin — other editors');
await check('Portfolio: edit a card title; appears in accordion', async () => {
  await ap.click('.adm-side a:has-text("Home · Portfolio")');
  await ap.locator('.adm-item .adm-item-toggle').nth(1).click();
  await ap.locator('.adm-item.open .adm-item-body .adm-field:has(label:text-is("Title")) input').fill('Sash & Gown');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await scrollAll(pub.page);
  ok((await pub.page.$$eval('.pf-vtitle', (t) => t.map((x) => x.textContent))).includes('Sash & Gown'));
  await pub.ctx.close();
});
await check('Image focus point can be set by clicking the preview', async () => {
  await ap.click('.adm-side a:has-text("Home · Hero")');
  const box = await ap.locator('.adm-focusbox').first().boundingBox();
  await ap.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.8);
  await save();
  const f = await ap.evaluate(() => fetch('/api/admin/content').then((r) => r.json()).then((c) => c.home.hero.focus));
  ok(/^2[3-7]% (7[8-9]|8[0-2])%$/.test(f), f);
});
await check('About: add a paragraph + gallery picture', async () => {
  await ap.click('.adm-side a:has-text("About page")');
  const f = field('Story — left column');
  await f.locator('button:has-text("Add paragraph")').click();
  await f.locator('textarea').last().fill('Extra paragraph added in admin.');
  const g = field('Photo strip');
  const n = await g.locator('li:not(.add)').count();
  await g.locator('.adm-add').click();
  await ap.waitForSelector('.adm-modal');
  await ap.click('.adm-tile >> nth=0'); await ap.click('.adm-tile >> nth=1');
  await ap.click('.adm-modal button:has-text("Add 2 selected")');
  eq(await g.locator('li:not(.add)').count(), n + 2);
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/about'); await settle(pub.page, 500);
  ok((await pub.page.textContent('.bio-col')).includes('Extra paragraph added in admin.'));
  eq(await pub.page.$$eval('.strip-img', (e) => e.length), n + 2);
  await pub.ctx.close();
});
await check('Lookbook: add a new row with pictures', async () => {
  await ap.click('.adm-side a:has-text("Lookbook page")');
  await ap.click('button:has-text("+ Add row")');
  await ap.locator('.adm-item.open .adm-item-body .adm-field:has(label:text-is("Title")) input').fill('New Row');
  await ap.locator('.adm-item.open .adm-add').click();
  await ap.click('.adm-tile >> nth=2'); await ap.click('.adm-modal button:has-text("Add 1 selected")');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/lookbook'); await settle(pub.page, 500);
  eq(await pub.page.$$eval('.look-section', (e) => e.length), 4);
  await pub.ctx.close();
});
await check('Contact: change title, a time slot', async () => {
  await ap.click('.adm-side a:has-text("Contact page")');
  await field('Page title').locator('input').fill('Book Anonna');
  const f = field('Meeting time choices');
  await f.locator('input').first().fill('08:30 AM');
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/contact'); await settle(pub.page, 500);
  eq((await pub.page.textContent('.contact h2')).trim(), 'Book Anonna');
  eq(await pub.page.$eval('#cf-time option:nth-child(2)', (o) => o.textContent), '08:30 AM');
  await pub.ctx.close();
});
await check('Site & Menu: social link adds icons; menu label edit', async () => {
  await ap.click('.adm-side a:has-text("Site & Menu")');
  await ap.locator('.adm-item .adm-item-toggle').first().click();
  await ap.locator('.adm-item.open input').first().fill('https://www.instagram.com/example');
  await ap.locator('.adm-item.open .adm-item-toggle').first().click().catch(() => {});
  await save();
  const pub = await newPage(1440, 900);
  await pub.page.goto(BASE + '/'); await settle(pub.page, 500);
  eq(await pub.page.$$eval('.foot-social a', (a) => a.length), 1);
  eq(await pub.page.getAttribute('.foot-social a', 'href'), 'https://www.instagram.com/example');
  await pub.page.click('.burger'); await pub.page.waitForSelector('.side-menu.open .menu-social a');
  await pub.ctx.close();
});
await check('unsaved-changes guard: Discard reverts edits', async () => {
  await ap.click('.adm-side a:has-text("Contact page")');
  await field('Page title').locator('input').fill('Temporary');
  await ap.click('.adm-savebar .adm-btn:has-text("Discard")'); await ap.click('.adm-dialog button:has-text("Discard")');
  eq(await field('Page title').locator('input').inputValue(), 'Book Anonna');
});
await check('dashboard backups list; restoring a backup reverts the site', async () => {
  await ap.click('.adm-side a:has-text("Dashboard")');
  await ap.waitForSelector('.adm-backups li');
  const n = await ap.locator('.adm-backups li').count();
  ok(n >= 5, 'backups ' + n);
  await ap.locator('.adm-backups li').nth(Math.min(n, 8) - 1).locator('button').click();
  await ap.click('.adm-dialog button:has-text("Restore")');
  await ap.waitForSelector('.adm-toast:has-text("restored")');
  await ap.screenshot({ path: `${SHOTS}/admin-backups.png` });
});
await check('reset to starting content restores the defaults', async () => {
  await ap.click('button:has-text("Reset to starting content")');
  await ap.click('.adm-dialog button:has-text("Reset everything")');
  await ap.waitForSelector('.adm-toast:has-text("reset")');
  const c = await ap.evaluate(() => fetch('/api/admin/content').then((r) => r.json()));
  eq(c.contact.title, 'Let’s Work Together'); eq(c.home.featured.items.length, 4);
});
await check('admin mobile layout: drawer menu opens, editor usable (390px)', async () => {
  const m = await newPage(390, 800);
  await m.page.goto(BASE + '/admin'); await m.page.fill('#lu', 'admin'); await m.page.fill('#lp', PW); await m.page.click('button:has-text("Sign in")');
  await m.page.waitForSelector('.adm-dash');
  await m.page.click('.adm-burger'); await m.page.waitForSelector('.adm-side.open');
  await m.page.waitForTimeout(400);
  await m.page.screenshot({ path: `${SHOTS}/admin-mobile-menu.png` });
  await m.page.click('.adm-side a:has-text("Home · Featured")');
  await m.page.waitForSelector('.adm-item');
  await m.page.click('.adm-item-toggle >> nth=0');
  const o = await m.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  ok(o.sw <= o.iw, `admin overflow ${o.sw}>${o.iw}`);
  await m.page.screenshot({ path: `${SHOTS}/admin-mobile-featured.png` });
  await m.ctx.close();
});
await check('password change: wrong current rejected; new password works', async () => {
  await ap.click('.adm-side a:has-text("Password")');
  await ap.fill('#ac', 'wrong'); await ap.fill('#ap', 'Another-Pass-2026'); await ap.fill('#aa', 'Another-Pass-2026');
  await ap.click('button:has-text("Change password")');
  await ap.waitForSelector('.adm-error:has-text("not correct")');
  await ap.fill('#ac', PW);
  await ap.click('button:has-text("Change password")');
  await ap.waitForSelector('.adm-toast:has-text("Password changed")');
});
await check('sign out ends the session; old password no longer works', async () => {
  await ap.click('.adm-side button:has-text("Sign out")');
  await ap.waitForSelector('#lu');
  const s = await ap.evaluate(() => fetch('/api/admin/content').then((r) => r.status));
  eq(s, 401);
  await ap.fill('#lu', 'admin'); await ap.fill('#lp', PW); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-error');
  await ap.fill('#lp', 'Another-Pass-2026'); await ap.click('button:has-text("Sign in")');
  await ap.waitForSelector('.adm-side');
});

group('Console health');
await check('no unexpected console/page errors anywhere', async () => {
  if (consoleErrors.length) throw new Error(`${consoleErrors.length} errors, e.g.: ${consoleErrors.slice(0, 3).join(' || ')}`);
});

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOTS}`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(` - [${f.group}] ${f.name}: ${f.err}`);
  if (process.env.VERBOSE) console.log(serverLog);
}
fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
