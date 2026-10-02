import { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { useContent } from '../lib/content.jsx';
import { cx, useReveal } from '../lib/utils.js';

/** Fade-up scroll reveal wrapper. */
export function Reveal({ as: Tag = 'div', delay = 0, className, children, style, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={cx('reveal', shown && 'in', className)} style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/** Infinite horizontal marquee band. */
export function Marquee({ items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  const group = (k) => (
    <ul className="marquee-group" aria-hidden={k > 0 ? 'true' : undefined} key={k}>
      {list.map((t, i) => (
        <li key={i}>
          <span>{t}</span>
          <i aria-hidden="true">★</i>
        </li>
      ))}
    </ul>
  );
  // repeat so one half is always wider than any screen
  const reps = Math.max(2, Math.ceil(2600 / (list.join('').length * 14 + list.length * 80)));
  return (
    <div className="marquee" role="marquee" aria-label={list.join(', ')}>
      <div className="marquee-track" style={{ '--marquee-time': `${Math.max(30, reps * list.length * 6)}s` }}>
        {Array.from({ length: reps * 2 }, (_, k) => group(k))}
      </div>
    </div>
  );
}

/** Rolling-digit counter: digits scroll up from 0 once visible. */
export function RollingValue({ value, go }) {
  const chars = String(value).split('');
  return (
    <span className="roll" aria-label={String(value)}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="roll-digit" aria-hidden="true" key={i}>
            <span className="roll-col" style={{ transform: go ? `translateY(${-Number(ch) * 10}%)` : 'translateY(0)', transitionDelay: `${i * 90}ms` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="roll-static" aria-hidden="true" key={i}>
            {ch === ' ' ? ' ' : ch}
          </span>
        )
      )}
    </span>
  );
}

export function Stats({ stats }) {
  const [ref, shown] = useReveal({ threshold: 0.25 });
  if (!stats?.items?.length) return null;
  return (
    <section className="stats">
      <Reveal as="h2" className="h2 center">
        {stats.heading}
      </Reveal>
      <div className="stats-grid" ref={ref}>
        {stats.items.map((s, i) => (
          <Reveal className="stat" key={i} delay={i * 80}>
            <div className="stat-value">
              <RollingValue value={s.value} go={shown} />
            </div>
            <div className="stat-label">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Cta({ cta }) {
  if (!cta) return null;
  return (
    <section className="cta">
      <Reveal as="h2" className="cta-text">
        {cta.text}
      </Reveal>
      <Reveal delay={150}>
        <Link to={cta.buttonLink || '/contact'} className="btn">
          {cta.buttonLabel}
        </Link>
      </Reveal>
    </section>
  );
}

/** Horizontal strip you can drag with the mouse, swipe on touch, or scroll with trackpad/keys. */
export function DragRow({ children, className, label }) {
  const ref = useRef(null);
  const st = useRef({ down: false, x: 0, left: 0, moved: 0 });
  const [dragging, setDragging] = useState(false);

  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = ref.current;
    st.current = { down: true, x: e.clientX, left: el.scrollLeft, moved: 0 };
  };
  useEffect(() => {
    const move = (e) => {
      const s = st.current;
      if (!s.down) return;
      const dx = e.clientX - s.x;
      s.moved = Math.max(s.moved, Math.abs(dx));
      if (s.moved > 5) setDragging(true);
      ref.current.scrollLeft = s.left - dx;
    };
    const up = () => {
      if (!st.current.down) return;
      st.current.down = false;
      setTimeout(() => setDragging(false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);
  // swallow the click that ends a drag so images are not opened by accident
  const onClickCapture = (e) => {
    if (st.current.moved > 5) {
      e.preventDefault();
      e.stopPropagation();
      st.current.moved = 0;
    }
  };
  return (
    <div
      ref={ref}
      className={cx('drag-row', dragging && 'dragging', className)}
      onPointerDown={onDown}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function Lightbox({ images, index, onClose, onIndex }) {
  useEffect(() => {
    if (index == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, images.length]);
  if (index == null) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={onClose}>
      <button className="lb-close" aria-label="Close" onClick={onClose}>×</button>
      {images.length > 1 && (
        <>
          <button className="lb-nav prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }}>‹</button>
          <button className="lb-nav next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }}>›</button>
        </>
      )}
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
