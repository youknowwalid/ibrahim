// Light validation + sanitising for content saved from the admin panel.
const REQUIRED = ['site', 'home', 'about', 'lookbook', 'contact'];

function clean(v, depth = 0) {
  if (depth > 12) return null;
  if (typeof v === 'string') {
    const s = v.slice(0, 20000);
    // never allow script-bearing links in any field
    return /^\s*(javascript|data:text|vbscript):/i.test(s) ? '' : s;
  }
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      o[k] = clean(val, depth + 1);
    }
    return o;
  }
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
  return null;
}

export function validateContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Content must be an object.' };
  for (const k of REQUIRED) if (!input[k] || typeof input[k] !== 'object') return { error: `Missing section: ${k}` };
  if (!Array.isArray(input.site.menu)) return { error: 'Menu must be a list.' };
  if (!input.home.portfolio || !Array.isArray(input.home.portfolio.items)) return { error: 'Portfolio items must be a list.' };
  if (!input.home.featured || !Array.isArray(input.home.featured.items)) return { error: 'Featured items must be a list.' };
  if (!Array.isArray(input.lookbook.sections)) return { error: 'Lookbook sections must be a list.' };
  return { value: clean(input) };
}

export function validateMessage(b) {
  const str = (x, n) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
  const msg = {
    firstName: str(b.firstName, 80),
    lastName: str(b.lastName, 80),
    email: str(b.email, 200),
    date: str(b.date, 40),
    time: str(b.time, 40),
    message: str(b.message, 5000),
  };
  const errors = {};
  if (!msg.firstName) errors.firstName = 'Please enter your first name.';
  if (!msg.lastName) errors.lastName = 'Please enter your last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.email)) errors.email = 'Please enter a valid email address.';
  if (!msg.date) errors.date = 'Please choose a date.';
  if (!msg.time) errors.time = 'Please choose a time.';
  if (msg.message.length < 2) errors.message = 'Please write a short message.';
  return Object.keys(errors).length ? { errors } : { value: msg };
}
