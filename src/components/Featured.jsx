import { useCallback, useEffect, useRef, useState } from 'react';
import { useContent } from '../lib/content.jsx';
import { useRouter } from '../lib/router.jsx';
import { cx, formatDate, parseMedia, useLockBody } from '../lib/utils.js';
import { icons } from './Icons.jsx';
import { Reveal } from './Bits.jsx';

const thumbOf = (item) => {
  if (item.thumbnail) return item.thumbnail;
  const m = parseMedia(item.mediaUrl, item.kind);
  if (m.type === 'image') return m.src;
  return m.poster || '';
};
const isVideo = (item) => {
  const m = parseMedia(item.mediaUrl, item.kind);
  return m.type === 'video' || m.type === 'embed';
};

function Card({ item, onOpen, index }) {
  const thumb = thumbOf(item);
  const video = isVideo(item);
  return (
    <Reveal as="li" className="feat-item" delay={(index % 3) * 100}>
      <button className="feat-card" onClick={(e) => onOpen(item.id, e.currentTarget)} aria-haspopup="dialog" aria-label={`${item.title}${item.publication ? ' — ' + item.publication : ''}${video ? ' (video)' : ''}`}>
        <span className="feat-thumb">
          {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : <span className="feat-blank" />}
          {video && (
            <span className="feat-play" aria-hidden="true">
              <icons.play />
            </span>
          )}
        </span>
        <span className="feat-cap">
          <span className="feat-pub">{[item.type, item.publication].filter(Boolean).join(' · ')}</span>
          <span className="feat-title">{item.title}</span>
        </span>
      </button>
    </Reveal>
  );
}

function MediaView({ item }) {
  const m = parseMedia(item.mediaUrl, item.kind);
  const [playing, setPlaying] = useState(false);
  if (m.type === 'image') return <img className="fm-img" src={m.src} alt={item.title} />;
  if (m.type === 'video')
    return <video className="fm-video" src={m.src} poster={item.thumbnail || undefined} controls playsInline autoPlay preload="metadata" />;
  if (m.type === 'embed') {
    if (!playing && (item.thumbnail || m.poster))
      return (
        <button className="fm-poster" onClick={() => setPlaying(true)} aria-label={`Play video: ${item.title}`}>
          <img src={item.thumbnail || m.poster} alt="" />
          <span className="feat-play big" aria-hidden="true">
            <icons.play />
          </span>
        </button>
      );
    return (
      <div className="fm-embed">
        <iframe src={m.src} title={item.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  return null;
}

export function FeaturedModal({ items, index, onClose, onIndex }) {
  const item = items[index];
  const box = useRef(null);
  useLockBody(true);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && items.length > 1) onIndex((index + 1) % items.length);
      else if (e.key === 'ArrowLeft' && items.length > 1) onIndex((index - 1 + items.length) % items.length);
      else if (e.key === 'Tab') {
        // keep keyboard focus inside the dialog
        const f = [...box.current.querySelectorAll('a[href],button,[tabindex="0"],iframe,video[controls]')].filter((x) => !x.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length]);

  const meta = [item.type, item.publication, formatDate(item.date)].filter(Boolean);
  return (
    <div className="fmodal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fmodal-box" role="dialog" aria-modal="true" aria-labelledby="fm-title" ref={box} tabIndex={-1}>
        <button className="fm-close" aria-label="Close" onClick={onClose}>
          <icons.close width={22} height={22} />
        </button>
        <div className="fm-media" key={item.id}>
          <MediaView item={item} />
        </div>
        <div className="fm-body">
          {meta.length > 0 && <p className="fm-meta">{meta.join(' · ')}</p>}
          <h3 id="fm-title" className="fm-title">{item.title}</h3>
          {item.author && <p className="fm-author">By {item.author}</p>}
          {item.description && <p className="fm-desc">{item.description}</p>}
          {item.sourceUrl && (
            <a className="btn fm-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              {item.sourceLabel || 'Read the full story'} <icons.external />
            </a>
          )}
        </div>
        {items.length > 1 && (
          <>
            <button className="fm-nav prev" aria-label="Previous" onClick={() => onIndex((index - 1 + items.length) % items.length)}><icons.chevronLeft /></button>
            <button className="fm-nav next" aria-label="Next" onClick={() => onIndex((index + 1) % items.length)}><icons.chevronRight /></button>
          </>
        )}
      </div>
    </div>
  );
}

export function Featured() {
  const { home } = useContent();
  const { hash } = useRouter();
  const f = home.featured;
  const items = (f.items || []).filter((i) => i.visible !== false);
  const [open, setOpen] = useState(null); // index
  const opener = useRef(null);

  const openById = useCallback((id, el) => {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    opener.current = el || null;
    setOpen(i);
    history.replaceState({}, '', `#featured-${id}`);
  }, [items]);
  const close = useCallback(() => {
    setOpen(null);
    history.replaceState({}, '', window.location.pathname);
    opener.current?.focus?.();
  }, []);
  const go = (i) => {
    setOpen(i);
    history.replaceState({}, '', `#featured-${items[i].id}`);
  };

  // deep links like /#featured-f1 open the modal directly
  useEffect(() => {
    const m = /^#featured-(.+)$/.exec(hash || '');
    if (m && open == null) openById(decodeURIComponent(m[1]));
  }, []);

  if (!items.length) return null;
  return (
    <section className="featured" id="featured">
      <Reveal as="h2" className="h2 center">{f.heading}</Reveal>
      {f.text && <Reveal as="p" className="section-lead center" delay={80}>{f.text}</Reveal>}
      <ul className="feat-grid">
        {items.map((it, i) => (
          <Card key={it.id} item={it} index={i} onOpen={openById} />
        ))}
      </ul>
      {open != null && items[open] && <FeaturedModal items={items} index={open} onClose={close} onIndex={go} />}
    </section>
  );
}
