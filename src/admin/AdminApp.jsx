import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { api, getIn, setIn, setUnauthorizedHandler } from './api.js';
import { SECTIONS } from './schema.js';
import { ConfirmProvider, Field, MediaPicker, useConfirm } from './fields.jsx';

/* ================= login ================= */
function Login({ onDone }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post('/api/admin/login', { username: u, password: p });
      onDone();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm adm-login">
      <form onSubmit={submit} className="adm-card">
        <h1>Admin sign in</h1>
        <p className="adm-help">Manage the text, photos, videos and press features on your website.</p>
        <div className="adm-field"><label htmlFor="lu">Username</label><input id="lu" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} autoFocus required /></div>
        <div className="adm-field"><label htmlFor="lp">Password</label><input id="lp" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></div>
        {err && <p className="adm-error" role="alert">{err}</p>}
        <button className="adm-btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="adm-help center"><a href="/">← Back to the website</a></p>
      </form>
    </div>
  );
}

/* ================= shell ================= */
export default function AdminApp() {
  return (
    <ConfirmProvider>
      <Gate />
    </ConfirmProvider>
  );
}

function Gate() {
  const [me, setMe] = useState(undefined);
  const refresh = useCallback(() => api.get('/api/admin/me').then(setMe).catch(() => setMe(null)), []);
  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    refresh();
    document.title = 'Admin';
  }, []);
  if (me === undefined) return <div className="adm adm-login"><p className="adm-help">Loading…</p></div>;
  if (!me) return <Login onDone={refresh} />;
  return <Shell me={me} refreshMe={refresh} onSignedOut={() => setMe(null)} />;
}

function Shell({ me, refreshMe, onSignedOut }) {
  const { path, navigate } = useRouter();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(null);
  const [base, setBase] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loadErr, setLoadErr] = useState('');

  const sectionId = path.replace(/^\/admin\/?/, '') || 'dashboard';
  const dirty = draft && JSON.stringify(draft) !== base;

  const load = useCallback(async () => {
    try {
      const c = await api.get('/api/admin/content');
      setDraft(c);
      setBase(JSON.stringify(c));
    } catch (e) {
      setLoadErr(e.message);
    }
  }, []);
  const countUnread = useCallback(() => api.get('/api/admin/messages').then((m) => setUnread(m.filter((x) => !x.read).length)).catch(() => {}), []);
  useEffect(() => { load(); countUnread(); }, []);
  useEffect(() => { if (me.mustChange && sectionId !== 'account') navigate('/admin/account', { replace: true }); }, [me.mustChange, sectionId]);
  useEffect(() => { setNavOpen(false); window.scrollTo(0, 0); }, [sectionId]);

  const say = (msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await api.put('/api/admin/content', draft);
      setBase(JSON.stringify(draft));
      say('Saved — your website is updated.');
    } catch (e) {
      say(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, draft]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [save, dirty]);

  const discard = async () => {
    if (await confirm({ title: 'Discard all unsaved changes?', message: 'Your edits since the last save will be lost.', confirmLabel: 'Discard', danger: true })) {
      setDraft(JSON.parse(base));
    }
  };
  const signOut = async () => {
    if (dirty && !(await confirm({ title: 'You have unsaved changes', message: 'Sign out anyway and lose them?', confirmLabel: 'Sign out', danger: true }))) return;
    await api.post('/api/admin/logout').catch(() => {});
    onSignedOut();
  };

  if (loadErr) return <div className="adm adm-login"><p className="adm-error">{loadErr}</p></div>;
  if (!draft) return <div className="adm adm-login"><p className="adm-help">Loading…</p></div>;

  const section = SECTIONS.find((s) => s.id === sectionId);
  const groups = ['Home page', 'Other pages', 'Whole website'].map((g) => [g, SECTIONS.filter((s) => s.group === g)]);
  const titles = { dashboard: 'Dashboard', messages: 'Messages', media: 'Media library', account: 'Account & password' };
  const title = section ? section.label : titles[sectionId] || 'Not found';
  const isContent = !!section;

  return (
    <div className="adm">
      <aside className={'adm-side' + (navOpen ? ' open' : '')}>
        <div className="adm-brand">
          <strong>{draft.site.name}</strong>
          <span>Website admin</span>
        </div>
        <nav aria-label="Admin">
          <Link to="/admin" className={sectionId === 'dashboard' ? 'on' : ''}>🏠 Dashboard</Link>
          <Link to="/admin/messages" className={sectionId === 'messages' ? 'on' : ''}>✉ Messages {unread > 0 && <span className="adm-count">{unread}</span>}</Link>
          <Link to="/admin/media" className={sectionId === 'media' ? 'on' : ''}>🖼 Media library</Link>
          {groups.map(([g, list]) => (
            <div key={g} className="adm-navgroup">
              <h2>{g}</h2>
              {list.map((s) => <Link key={s.id} to={`/admin/${s.id}`} className={sectionId === s.id ? 'on' : ''}>{s.label}</Link>)}
            </div>
          ))}
          <div className="adm-navgroup">
            <h2>Account</h2>
            <Link to="/admin/account" className={sectionId === 'account' ? 'on' : ''}>🔑 Password</Link>
            <a href="/" target="_blank" rel="noopener">↗ View website</a>
            <button onClick={signOut}>⎋ Sign out</button>
          </div>
        </nav>
      </aside>
      {navOpen && <div className="adm-scrim" onClick={() => setNavOpen(false)} />}
      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-burger" aria-label="Open admin menu" onClick={() => setNavOpen(true)}>☰</button>
          <h1>{title}</h1>
          {isContent && (
            <div className="adm-savebar">
              <span className={'adm-status' + (dirty ? ' dirty' : '')} role="status">{saving ? 'Saving…' : dirty ? '● Unsaved changes' : '✓ All changes saved'}</span>
              <button className="adm-btn" onClick={discard} disabled={!dirty || saving}>Discard</button>
              <button className="adm-btn primary" onClick={save} disabled={!dirty || saving}>Save changes</button>
            </div>
          )}
        </header>
        <main className="adm-content">
          {sectionId === 'dashboard' && <Dashboard draft={draft} dirty={dirty} unread={unread} reload={load} say={say} />}
          {isContent && <SectionEditor key={section.id} section={section} draft={draft} setDraft={setDraft} />}
          {sectionId === 'messages' && <Messages onChange={countUnread} say={say} />}
          {sectionId === 'media' && <MediaLibrary draft={draft} say={say} />}
          {sectionId === 'account' && <Account me={me} refreshMe={refreshMe} say={say} />}
          {!isContent && !titles[sectionId] && <p>That page does not exist. <Link to="/admin">Go to the dashboard</Link></p>}
        </main>
        {isContent && (
          <div className="adm-floatsave" aria-hidden={!dirty}>
            {dirty && <button className="adm-btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>}
          </div>
        )}
      </div>
      {toast && <div className={'adm-toast ' + toast.kind} role="status" aria-live="polite">{toast.msg}</div>}
    </div>
  );
}

/* ================= content editor ================= */
function SectionEditor({ section, draft, setDraft }) {
  const addr = useMemo(() => ({ get: (k) => getIn(draft, k), set: (k, v) => setDraft((d) => setIn(d, k, v)) }), [draft]);
  return (
    <div className="adm-section">
      {section.intro && <p className="adm-intro">{section.intro}</p>}
      <div className="adm-card">
        {section.fields.map((f) => <Field key={f.path} field={f} addr={addr} />)}
      </div>
    </div>
  );
}

/* ================= dashboard ================= */
function Dashboard({ draft, dirty, unread, reload, say }) {
  const confirm = useConfirm();
  const [backups, setBackups] = useState([]);
  const [media, setMedia] = useState([]);
  useEffect(() => {
    api.get('/api/admin/backups').then(setBackups).catch(() => {});
    api.get('/api/admin/media').then(setMedia).catch(() => {});
  }, []);
  const feat = draft.home.featured.items;
  const noSocials = !(draft.site.socials || []).some((s) => s.url);
  const todo = [
    noSocials && ['Add your social media links', 'site', 'No profile links are set yet, so no social icons are shown.'],
    feat.filter((f) => f.visible !== false).length < 3 && ['Add more press features', 'featured', 'Add real articles, interviews or videos in the Featured section.'],
    !draft.home.stats.items.length && ['Add your stats cards', 'stats', 'The stats row is empty.'],
  ].filter(Boolean);

  const restore = async (b) => {
    if (dirty && !(await confirm({ title: 'Unsaved changes will be lost', message: 'Restoring a backup replaces everything currently on the website and in the editor.', confirmLabel: 'Restore', danger: true }))) return;
    if (!dirty && !(await confirm({ title: 'Restore this backup?', message: 'The website will go back to how it was at that time.', confirmLabel: 'Restore' }))) return;
    try {
      await api.post('/api/admin/backups/restore', { id: b.id });
      await reload();
      api.get('/api/admin/backups').then(setBackups);
      say('Backup restored.');
    } catch (e) { say(e.message, 'error'); }
  };
  const reset = async () => {
    if (!(await confirm({ title: 'Reset all text and layout to the starting content?', message: 'Your uploaded photos stay in the media library. A backup of the current version is kept so you can undo this.', confirmLabel: 'Reset everything', danger: true }))) return;
    try {
      await api.post('/api/admin/content/reset');
      await reload();
      api.get('/api/admin/backups').then(setBackups);
      say('Content reset to the starting version.');
    } catch (e) { say(e.message, 'error'); }
  };
  const fmt = (s) => {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)-(\d\d)/.exec(s);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toLocaleString() : s;
  };
  return (
    <div className="adm-dash">
      <div className="adm-cards">
        <Link to="/admin/messages" className="adm-stat"><b>{unread}</b><span>unread message{unread === 1 ? '' : 's'}</span></Link>
        <Link to="/admin/featured" className="adm-stat"><b>{feat.length}</b><span>featured item{feat.length === 1 ? '' : 's'}</span></Link>
        <Link to="/admin/portfolio" className="adm-stat"><b>{draft.home.portfolio.items.length}</b><span>portfolio cards</span></Link>
        <Link to="/admin/media" className="adm-stat"><b>{media.length}</b><span>files in library</span></Link>
      </div>
      <div className="adm-card">
        <h2>Welcome 👋</h2>
        <p>Use the menu on the left to change anything on your website. Edit, then press <strong>Save changes</strong> (or Ctrl + S) — the live website updates straight away.</p>
        <p><a className="adm-btn primary" href="/" target="_blank" rel="noopener">View website ↗</a> <Link className="adm-btn" to="/admin/featured">Add a press feature</Link> <Link className="adm-btn" to="/admin/media">Upload photos</Link></p>
      </div>
      {todo.length > 0 && (
        <div className="adm-card">
          <h2>Suggestions</h2>
          <ul className="adm-todo">{todo.map(([t, to, d]) => <li key={to}><Link to={`/admin/${to}`}><strong>{t}</strong></Link><span>{d}</span></li>)}</ul>
        </div>
      )}
      <div className="adm-card">
        <h2>Backups &amp; undo</h2>
        <p className="adm-help">Every time you press Save, the previous version is kept automatically (the latest 30). Restore one if you change your mind.</p>
        {backups.length === 0 ? <p className="adm-hint">No backups yet — one is created the first time you save.</p> : (
          <ul className="adm-backups">
            {backups.slice(0, 8).map((b) => (
              <li key={b.id}><span>{fmt(b.created)}</span><button className="adm-btn" onClick={() => restore(b)}>Restore</button></li>
            ))}
          </ul>
        )}
        <p><button className="adm-btn danger" onClick={reset}>Reset to starting content…</button></p>
      </div>
    </div>
  );
}

/* ================= messages ================= */
function Messages({ onChange, say }) {
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.get('/api/admin/messages').then(setList).catch((e) => say(e.message, 'error'));
  useEffect(() => { load(); }, []);
  const mark = async (m, read) => {
    await api.patch(`/api/admin/messages/${m.id}`, { read }).catch((e) => say(e.message, 'error'));
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, read } : x)));
    onChange();
  };
  const del = async (m) => {
    if (!(await confirm({ title: 'Delete this message?', message: `From ${m.firstName} ${m.lastName}. This cannot be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    await api.del(`/api/admin/messages/${m.id}`).catch((e) => say(e.message, 'error'));
    setList((l) => l.filter((x) => x.id !== m.id));
    onChange();
  };
  if (!list) return <p className="adm-hint">Loading…</p>;
  if (!list.length) return <div className="adm-card"><p>No messages yet. Messages sent from the Contact page will appear here.</p></div>;
  return (
    <ul className="adm-msgs">
      {list.map((m) => {
        const isOpen = open === m.id;
        return (
          <li key={m.id} className={(m.read ? '' : 'unread ') + (isOpen ? 'open' : '')}>
            <button className="adm-msg-head" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : m.id); if (!m.read) mark(m, true); }}>
              <span className="dot" aria-label={m.read ? 'Read' : 'Unread'} />
              <strong>{m.firstName} {m.lastName}</strong>
              <span className="snip">{m.message.slice(0, 90)}</span>
              <time>{new Date(m.created).toLocaleString()}</time>
            </button>
            {isOpen && (
              <div className="adm-msg-body">
                <dl>
                  <dt>Email</dt><dd><a href={`mailto:${m.email}`}>{m.email}</a></dd>
                  <dt>Requested meeting</dt><dd>{m.date} at {m.time}</dd>
                </dl>
                <p className="body">{m.message}</p>
                <p>
                  <a className="adm-btn primary" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message')}`}>Reply by email</a>{' '}
                  <button className="adm-btn" onClick={() => mark(m, false)}>Mark unread</button>{' '}
                  <button className="adm-btn danger" onClick={() => del(m)}>Delete</button>
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ================= media library ================= */
function MediaLibrary({ draft, say }) {
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const used = useMemo(() => JSON.stringify(draft), [draft]);
  useEffect(() => { api.get('/api/admin/media').then(setItems).catch((e) => say(e.message, 'error')); }, []);
  const upload = async (files) => {
    for (const f of files) {
      setBusy((b) => b + 1);
      try {
        const e = await api.upload(f);
        setItems((l) => [e, ...(l || [])]);
        say(`Uploaded ${f.name}`);
      } catch (e) {
        say(`${f.name}: ${e.message}`, 'error');
      } finally {
        setBusy((b) => b - 1);
      }
    }
  };
  const del = async (m) => {
    const inUse = used.includes(m.url);
    if (!(await confirm({ title: `Delete “${m.name}”?`, message: inUse ? 'This file is currently used on your website — it will show as a broken picture until you replace it.' : 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/api/admin/media/${m.id}`);
      setItems((l) => l.filter((x) => x.id !== m.id));
    } catch (e) { say(e.message, 'error'); }
  };
  const copy = async (m) => {
    const url = location.origin + m.url;
    try { await navigator.clipboard.writeText(url); say('Link copied.'); } catch { say(url); }
  };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]); }} className={'adm-medialib' + (drag ? ' drag' : '')}>
      <p className="adm-intro">Upload pictures (JPG, PNG, WebP) and videos (MP4, WebM). Pictures are resized and optimised automatically so the website stays fast. Then pick them in any section.</p>
      <p>
        <button className="adm-btn primary" onClick={() => input.current.click()} disabled={busy > 0}>{busy ? `Uploading ${busy}…` : '⬆ Upload files'}</button>
        <input ref={input} type="file" hidden multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
        <span className="adm-hint"> …or drag files anywhere onto this page</span>
      </p>
      {!items ? <p className="adm-hint">Loading…</p> : (
        <ul className="adm-lib">
          {items.map((m) => (
            <li key={m.id} className="adm-libitem">
              <div className="th">{m.type === 'video' ? <span className="vid">▶ Video</span> : <img src={m.thumb || m.url} alt="" loading="lazy" />}</div>
              <div className="meta">
                <strong title={m.name}>{m.name}</strong>
                <small>{m.type === 'video' ? 'Video' : `${m.width || '?'}×${m.height || '?'}`} · {Math.round((m.size || 0) / 1024) > 1024 ? ((m.size || 0) / 1048576).toFixed(1) + ' MB' : Math.round((m.size || 0) / 1024) + ' KB'}</small>
                {used.includes(m.url) && <span className="adm-badge ok">In use</span>}
              </div>
              <div className="act"><button className="adm-btn" onClick={() => copy(m)}>Copy link</button><button className="adm-btn danger" onClick={() => del(m)}>Delete</button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================= account ================= */
function Account({ me, refreshMe, say }) {
  const [f, setF] = useState({ current: '', username: '', password: '', again: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.password.length < 8) return setErr('Your new password must be at least 8 characters.');
    if (f.password !== f.again) return setErr('The two new passwords do not match.');
    setBusy(true);
    try {
      await api.post('/api/admin/password', { current: f.current, username: f.username, password: f.password });
      setF({ current: '', username: '', password: '', again: '' });
      await refreshMe();
      say('Password changed.');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="adm-card narrow" onSubmit={submit}>
      {me.mustChange && <p className="adm-notice">Welcome! Please choose your own password before you continue. Your first-time password was shown when the website was installed (it is also in the file <code>data/ADMIN-LOGIN.txt</code>).</p>}
      <p className="adm-help">Signed in as <strong>{me.user}</strong></p>
      <div className="adm-field"><label htmlFor="ac">Current password</label><input id="ac" type="password" autoComplete="current-password" value={f.current} onChange={set('current')} required /></div>
      <div className="adm-field"><label htmlFor="au">New username (optional)</label><input id="au" autoComplete="username" value={f.username} onChange={set('username')} placeholder={me.user} /></div>
      <div className="adm-field"><label htmlFor="ap">New password</label><input id="ap" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} /></div>
      <div className="adm-field"><label htmlFor="aa">New password again</label><input id="aa" type="password" autoComplete="new-password" value={f.again} onChange={set('again')} required /></div>
      {err && <p className="adm-error" role="alert">{err}</p>}
      <button className="adm-btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
