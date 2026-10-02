import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api, getIn, setIn } from './api.js';
import { parseMedia } from '../lib/utils.js';

/* ---------- confirm dialog (replaces native confirm()) ---------- */
const ConfirmCtx = createContext(null);
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => {
    state.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="adm-modal-bg" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
            <h3 id="cf-t">{state.title}</h3>
            {state.message && <p>{state.message}</p>}
            <div className="adm-dialog-actions">
              <button className="adm-btn" onClick={() => close(false)} autoFocus>Cancel</button>
              <button className={'adm-btn ' + (state.danger ? 'danger' : 'primary')} onClick={() => close(true)}>{state.confirmLabel || 'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- media picker ---------- */
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

export function MediaPicker({ accept = 'image', multiple = false, onClose, onPick }) {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState([]); // {name, progress}
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(accept === 'any' ? 'all' : 'image');
  const [link, setLink] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    api.get('/api/admin/media').then(setItems).catch((e) => setError(e.message));
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const upload = async (files) => {
    setError('');
    for (const file of files) {
      const ok = accept === 'any' ? /^(image|video)\//.test(file.type) : /^image\//.test(file.type);
      if (!ok) {
        setError(`“${file.name}” is not a supported ${accept === 'any' ? 'picture or video' : 'picture'} file.`);
        continue;
      }
      const tag = { name: file.name, progress: 0, id: Math.random() };
      setBusy((b) => [...b, tag]);
      try {
        const entry = await api.upload(file, (p) => setBusy((b) => b.map((x) => (x.id === tag.id ? { ...x, progress: p } : x))));
        setItems((l) => [entry, ...(l || [])]);
        setSelected((s) => (multiple ? [...s, entry.url] : [entry.url]));
      } catch (e) {
        setError(`${file.name}: ${e.message}`);
      } finally {
        setBusy((b) => b.filter((x) => x.id !== tag.id));
      }
    }
  };

  const toggle = (url) => setSelected((s) => (multiple ? (s.includes(url) ? s.filter((x) => x !== url) : [...s, url]) : [url]));
  const shown = (items || []).filter((m) => filter === 'all' || m.type === filter);
  const done = () => onPick(multiple ? selected : selected[0]);

  return (
    <div className="adm-modal-bg" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'adm-modal' + (drag ? ' drag' : '')} role="dialog" aria-modal="true" aria-label="Choose a file"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]); }}>
        <header className="adm-modal-head">
          <h3>{accept === 'any' ? 'Choose a picture or video' : 'Choose a picture'}</h3>
          <button className="adm-icon" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="adm-modal-tools">
          <button className="adm-btn primary" onClick={() => input.current.click()}>⬆ Upload from your computer</button>
          <input ref={input} type="file" hidden multiple accept={accept === 'any' ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*'} onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
          {accept === 'any' && (
            <div className="adm-seg" role="tablist">
              {[['all', 'All'], ['image', 'Pictures'], ['video', 'Videos']].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
          )}
          <span className="adm-hint">…or drag files here</span>
        </div>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <div className="adm-media-grid">
          {busy.map((b) => (
            <div className="adm-tile busy" key={b.id}><span>Uploading…</span><div className="bar"><i style={{ width: `${Math.round(b.progress * 100)}%` }} /></div><small>{b.name}</small></div>
          ))}
          {items === null && <p className="adm-hint">Loading…</p>}
          {items && !shown.length && !busy.length && <p className="adm-hint">Nothing here yet — upload your first file.</p>}
          {shown.map((m) => {
            const on = selected.includes(m.url);
            return (
              <button key={m.id} className={'adm-tile' + (on ? ' on' : '')} onClick={() => toggle(m.url)} onDoubleClick={() => !multiple && onPick(m.url)} aria-pressed={on} title={m.name}>
                {m.type === 'video' ? <span className="vid">▶ Video</span> : <img src={m.thumb || m.url} alt="" loading="lazy" />}
                <small>{m.name}</small>
                {on && <b className="tick">✓</b>}
              </button>
            );
          })}
        </div>
        <footer className="adm-modal-foot">
          {!multiple && (
            <form className="adm-linkform" onSubmit={(e) => { e.preventDefault(); link.trim() && onPick(link.trim()); }}>
              <input placeholder="Or paste a web link (https://…)" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Web link" />
              <button className="adm-btn" disabled={!link.trim()}>Use link</button>
            </form>
          )}
          <span className="spacer" />
          <button className="adm-btn" onClick={onClose}>Cancel</button>
          <button className="adm-btn primary" disabled={!selected.length} onClick={done}>{multiple ? `Add ${selected.length || ''} selected` : 'Use this file'}</button>
        </footer>
      </div>
    </div>
  );
}

/* ---------- basic inputs ---------- */
function Label({ id, field, children }) {
  return (
    <div className="adm-field">
      <label htmlFor={id}>{field.label}</label>
      {children}
      {field.help && <p className="adm-help">{field.help}</p>}
    </div>
  );
}

function ImageField({ field, value, onChange, focus, onFocus, accept = 'image' }) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const m = parseMedia(value);
  const box = useRef(null);
  const setFocus = (e) => {
    if (!onFocus || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onFocus(`${x}% ${y}%`);
  };
  const [fx, fy] = (focus || '50% 50%').split(' ').map((n) => parseFloat(n));
  return (
    <Label id={id} field={field}>
      <div className="adm-imgfield">
        <div className="adm-thumbbox">
          {!value && <div className="adm-empty">No file chosen</div>}
          {value && m.type === 'video' && <video src={value} muted preload="metadata" />}
          {value && m.type === 'embed' && (m.poster ? <img src={m.poster} alt="" /> : <div className="adm-empty">Video link</div>)}
          {value && m.type === 'image' && (
            <div className={'adm-focusbox' + (onFocus ? ' pick' : '')} ref={box} onClick={setFocus} title={onFocus ? 'Click to choose the focus point' : undefined}>
              <img src={value} alt="" />
              {onFocus && <span className="adm-cross" style={{ left: `${fx}%`, top: `${fy}%` }} />}
            </div>
          )}
        </div>
        <div className="adm-imgctl">
          <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Choose a file or paste a link" />
          <div className="row">
            <button type="button" className="adm-btn primary" onClick={() => setPicking(true)}>{value ? 'Change…' : 'Choose / upload…'}</button>
            {value && <button type="button" className="adm-btn" onClick={() => onChange('')}>Remove</button>}
          </div>
          {onFocus && value && m.type === 'image' && <p className="adm-help">Click the picture to choose the part that should stay in view when it is cropped.</p>}
        </div>
      </div>
      {picking && <MediaPicker accept={accept} onClose={() => setPicking(false)} onPick={(u) => { onChange(u); setPicking(false); }} />}
    </Label>
  );
}

function Move({ i, n, onMove, onRemove, onDup, label }) {
  return (
    <span className="adm-move">
      <button type="button" className="adm-icon" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={`Move ${label} up`} title="Move up">↑</button>
      <button type="button" className="adm-icon" disabled={i === n - 1} onClick={() => onMove(i, i + 1)} aria-label={`Move ${label} down`} title="Move down">↓</button>
      {onDup && <button type="button" className="adm-icon" onClick={() => onDup(i)} aria-label={`Duplicate ${label}`} title="Duplicate">⧉</button>}
      {onRemove && <button type="button" className="adm-icon danger" onClick={() => onRemove(i)} aria-label={`Delete ${label}`} title="Delete">🗑</button>}
    </span>
  );
}
const move = (arr, from, to) => {
  const a = [...arr];
  a.splice(to, 0, a.splice(from, 1)[0]);
  return a;
};

function StringList({ field, value, onChange }) {
  const list = value || [];
  const confirm = useConfirm();
  return (
    <div className="adm-field">
      <span className="adm-label">{field.label}</span>
      {field.help && <p className="adm-help">{field.help}</p>}
      <ul className="adm-strings">
        {list.map((s, i) => (
          <li key={i}>
            {field.multiline ? (
              <textarea rows={4} value={s} aria-label={`${field.label} ${i + 1}`} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
            ) : (
              <input value={s} aria-label={`${field.label} ${i + 1}`} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
            )}
            <Move i={i} n={list.length} label={`item ${i + 1}`} onMove={(a, b) => onChange(move(list, a, b))}
              onRemove={async (k) => (!list[k].trim() || (await confirm({ title: 'Delete this line?', message: list[k].slice(0, 120), confirmLabel: 'Delete', danger: true }))) && onChange(list.filter((_, j) => j !== k))} />
          </li>
        ))}
      </ul>
      <button type="button" className="adm-btn" onClick={() => onChange([...list, ''])}>+ {field.addLabel || 'Add'}</button>
    </div>
  );
}

function ImageList({ field, value, onChange }) {
  const list = value || [];
  const [picking, setPicking] = useState(false);
  return (
    <div className="adm-field">
      <span className="adm-label">{field.label}</span>
      {field.help && <p className="adm-help">{field.help}</p>}
      <ul className="adm-gallery">
        {list.map((u, i) => (
          <li key={u + i}>
            <img src={u} alt="" />
            <Move i={i} n={list.length} label={`picture ${i + 1}`} onMove={(a, b) => onChange(move(list, a, b))} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
          </li>
        ))}
        <li className="add"><button type="button" className="adm-add" onClick={() => setPicking(true)}>+ Add pictures</button></li>
      </ul>
      {picking && <MediaPicker multiple onClose={() => setPicking(false)} onPick={(urls) => { onChange([...list, ...urls]); setPicking(false); }} />}
    </div>
  );
}

/* ---------- generic field + list renderer ---------- */
export function Field({ field, addr }) {
  const k = field.path ?? field.key;
  const value = addr.get(k);
  const set = (v) => addr.set(k, v);
  const id = useId();
  switch (field.type) {
    case 'text':
      return <Label id={id} field={field}><input id={id} value={value ?? ''} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} /></Label>;
    case 'date':
      return <Label id={id} field={field}><input id={id} type="date" value={value ?? ''} onChange={(e) => set(e.target.value)} /></Label>;
    case 'textarea':
      return <Label id={id} field={field}><textarea id={id} rows={field.rows || 4} value={value ?? ''} onChange={(e) => set(e.target.value)} /></Label>;
    case 'select':
      return (
        <Label id={id} field={field}>
          <select id={id} value={value ?? field.options[0][0]} onChange={(e) => set(e.target.value)}>
            {field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Label>
      );
    case 'toggle':
      return (
        <div className="adm-field adm-toggle">
          <label><input type="checkbox" checked={value !== false && !!value} onChange={(e) => set(e.target.checked)} /> <span>{field.label}</span></label>
          {field.help && <p className="adm-help">{field.help}</p>}
        </div>
      );
    case 'image':
    case 'media': {
      const fk = field.focusPath ?? field.focusKey;
      return (
        <ImageField field={field} value={value} onChange={set} accept={field.type === 'media' ? 'any' : 'image'}
          focus={fk ? addr.get(fk) : undefined} onFocus={fk ? (v) => addr.set(fk, v) : undefined} />
      );
    }
    case 'images': return <ImageList field={field} value={value} onChange={set} />;
    case 'strings': return <StringList field={field} value={value} onChange={set} />;
    case 'list': return <ObjectList field={field} value={value} onChange={set} />;
    default: return null;
  }
}

function ObjectList({ field, value, onChange }) {
  const list = value || [];
  const confirm = useConfirm();
  const [open, setOpen] = useState(() => (list.length <= 1 ? 0 : -1));
  const title = (it, i) => {
    const t = typeof field.itemTitle === 'function' ? field.itemTitle(it) : it[field.itemTitle];
    return (t || '').toString().trim() || `Item ${i + 1}`;
  };
  const update = (i, item) => onChange(list.map((x, j) => (j === i ? item : x)));
  const add = () => {
    onChange([...list, field.newItem()]);
    setOpen(list.length);
  };
  const remove = async (i) => {
    if (await confirm({ title: `Delete “${title(list[i], i)}”?`, message: 'This removes it from the website once you press Save. You can undo by restoring a backup from the Dashboard.', confirmLabel: 'Delete', danger: true })) {
      onChange(list.filter((_, j) => j !== i));
      setOpen(-1);
    }
  };
  const dup = (i) => {
    const copy = structuredClone(list[i]);
    if (copy.id) copy.id = Math.random().toString(36).slice(2, 8);
    onChange([...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
    setOpen(i + 1);
  };
  const full = field.max && list.length >= field.max;
  return (
    <div className="adm-field">
      <span className="adm-label">{field.label} <em>({list.length})</em></span>
      {field.help && <p className="adm-help">{field.help}</p>}
      <ul className="adm-list">
        {list.map((it, i) => {
          const isOpen = open === i;
          const thumb = field.thumbKey ? getIn(it, field.thumbKey) : null;
          const hidden = it.visible === false;
          const addr = { get: (k) => getIn(it, k), set: (k, v) => update(i, setIn(it, k, v)) };
          return (
            <li key={it.id || i} className={'adm-item' + (isOpen ? ' open' : '') + (hidden ? ' hidden' : '')}>
              <div className="adm-item-head">
                <button type="button" className="adm-item-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span className="chev">{isOpen ? '▾' : '▸'}</span>
                  {thumb && <img src={thumb} alt="" />}
                  <span className="t">{title(it, i)}</span>
                  {hidden && <span className="adm-badge">Hidden</span>}
                </button>
                {!field.fixed && <Move i={i} n={list.length} label={title(it, i)} onMove={(a, b) => onChange(move(list, a, b))} onRemove={remove} onDup={field.newItem ? dup : undefined} />}
              </div>
              {isOpen && (
                <div className="adm-item-body">
                  {field.fields.map((f) => <Field key={f.key} field={f} addr={addr} />)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!field.fixed && <button type="button" className="adm-btn" disabled={full} onClick={add}>+ Add {field.addLabel || 'item'}{full ? ` (maximum ${field.max})` : ''}</button>}
    </div>
  );
}
