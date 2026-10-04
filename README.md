# Anonna Fatima — Portfolio Website

A complete personal website (public site + admin panel) built as a faithful React recreation of the Pixpa “Gleam” template,
with a new **Featured** section for real press, interviews and videos.

* **Public pages:** Home · About · Lookbook · Contact
* **Admin panel:** `/admin` — edit every word, photo, video, link and press feature without touching code
* **Two ways to run it:** hosted on **Vercel + Supabase** (this repo deploys automatically — see below), or on your own computer / any Node host with everything stored in the `data/` folder

---

## 0. Hosted on Vercel (how this repo is set up)

Every push to the main branch is built and published by Vercel (`vercel.json` — build `npm run build`, output `dist/`, no settings needed).
The site is a static React app; its content, messages, admin login and uploaded photos/videos live in a free **Supabase** project
(`supabase.config.json` holds the public project URL and public key — these are meant to be public; the database rules (Row Level Security)
let visitors only read published content and send contact messages, and only the admin account can change anything).

* **Admin:** `https://<your-site>/admin` — sign in with the username/password you were given, then change the password under *Password*.
* **Backups:** every save keeps the previous version (latest 30) — see the Dashboard.
* Test it: `node tests/e2e-hosted.mjs` (uses a simulated Supabase, no internet needed).

## 1. See it on your computer (5 minutes)

1. Install **Node.js** (the “LTS” version) from <https://nodejs.org> — one-time, just click Next.
2. Start the website:
   * **Windows:** double-click `start-website.bat`
   * **Mac:** double-click `start-website.command` (first time: right-click → Open)
   * Any system, in a terminal: `node server/index.js`
3. Open <http://localhost:3000> to see the site and <http://localhost:3000/admin> for the admin panel.
4. **First login:** the username and a one-time password are printed in the black window and saved in `data/ADMIN-LOGIN.txt`.
   You will be asked to choose your own password straight away.

## 2. Put it on the internet

The site is a small Node.js app. Any Node host works (Render, Railway, Fly.io, a VPS, cPanel “Node.js App”…). Typical settings:

| Setting | Value |
|---|---|
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Environment | `ADMIN_PASSWORD` = a strong password you choose (optional) |
| **Persistent disk** | mount a disk at the `data` folder (or set `DATA_DIR`) — **without this, edits and uploads are lost whenever the host restarts** |

Then connect your own domain in the host's dashboard. The site works behind HTTPS automatically (secure cookies are used when the host reports https).

## 3. Using the admin panel

Sign in at `yourwebsite.com/admin`. The menu on the left lists every part of the site.
Edit → press **Save changes** (or Ctrl + S) → the live site updates instantly. Every save keeps a backup (Dashboard → *Backups & undo*).

| To change… | Go to… |
|---|---|
| Name, footer, social icons, menu | Site & Menu |
| Opening picture and scrolling banner | Home · Hero & Banner |
| Intro text and the two pictures | Home · Introduction |
| The small “At a Glance” number cards | Home · Stats cards |
| The hover-to-expand photo cards | Home · Portfolio |
| **Press / interviews / videos** | **Home · Featured** |
| Bottom pink contact banner | Home · Contact banner |
| Story + photo strip | About page |
| Photo rows | Lookbook page |
| Form wording, picture, meeting times | Contact page |
| Messages from the contact form | Messages |
| All uploaded photos & videos | Media library |

### Adding a press feature (Home · Featured → “+ Add featured item”)
1. **Title** — the headline. **Publication**, **Date**, **Kind of feature** and **Author** are shown in the pop-up.
2. **Picture or video** — pick/upload a file, or paste a YouTube / Vimeo / direct video link.
3. **Card thumbnail** — the small picture visitors see on the page (required for videos).
4. **Description** — shown under the picture/video in the pop-up.
5. **Link to the original** — the button under the description (e.g. “Read on The Daily Star”).
6. Press **Save changes**. Untick **Show on website** to hide an item without deleting it.

Visitors only see the thumbnail cards; clicking one opens a clean window with the full picture/video and your description. Arrow keys / Esc work too, and each item has a shareable link such as `yourwebsite.com/#featured-f1`.

### Photos and videos
* Upload from **Media library** or from the **Choose / upload…** button on any picture field. Photos are automatically resized and converted to fast-loading WebP (this needs the one-time `npm install`, which hosts run for you; without it photos are stored as-is).
* Videos: MP4 or WebM up to 400 MB. For very large videos, uploading to YouTube/Vimeo and pasting the link is faster for visitors.
* Click a picture's preview in the editor to choose the **focus point** — the part that stays visible when the picture is cropped.

## 4. Things to fill in (nothing here was invented)

Only information that could be verified from public sources is on the site; everything else is left for you.

* **Social media links** — Site & Menu → Social media links (icons appear once a link is entered).
* **Measurements** (height, bust, waist, hips, dress & shoe size) — add them as cards in *Home · Stats cards* if you want them shown.
* **More press** — add any further articles, interviews, magazine features or videos to *Home · Featured*.
* **Fonts** — the site uses Google's *Manrope* and *Roboto* (as the original template does); they load from Google when a visitor opens the page.

## 5. For developers

```
server/        dependency-free Node server (static files, JSON API, auth, uploads)
src/           React app (esbuild bundle) — pages/, components/, admin/
seed/uploads/  the original photos, optimised
data/          created on first run: content.json, messages.json, media, uploads/, backups/
tests/e2e.mjs  113-check browser test suite (needs Playwright):  node tests/e2e.mjs
```
`npm run build` bundles the site into `dist/` (already included). `npm run dev` rebuilds on change.
Admin security: scrypt-hashed password, HttpOnly SameSite=Strict session cookie, login rate-limiting, CSRF header check, upload type allow-list, link sanitising.
