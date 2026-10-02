import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { useContent } from '../lib/content.jsx';
import { cx, useLockBody, useScrollY } from '../lib/utils.js';
import { icons, SocialLinks } from './Icons.jsx';

export function Header({ light }) {
  const { site } = useContent();
  const { path } = useRouter();
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  useLockBody(open);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && (setOpen(false), btn.current?.focus());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className={cx('site-header', light && 'is-light')}>
        <Link to="/" className="logo" aria-label={`${site.name} — home`}>
          {site.logoText || site.name}
        </Link>
        <button ref={btn} className="burger" aria-label="Open menu" aria-expanded={open} aria-controls="side-menu" onClick={() => setOpen(true)}>
          <span />
          <span />
        </button>
      </header>
      <div className={cx('menu-backdrop', open && 'open')} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="side-menu" className={cx('side-menu', open && 'open')} aria-hidden={!open} {...(!open ? { inert: '' } : {})}>
        <button className="menu-close" aria-label="Close menu" onClick={() => { setOpen(false); btn.current?.focus(); }}>
          <icons.close width={26} height={26} />
        </button>
        <nav aria-label="Main">
          <ul>
            {site.menu.map((m) => (
              <li key={m.path + m.label}>
                <Link to={m.path} className={cx(path === m.path && 'active')} aria-current={path === m.path ? 'page' : undefined}>
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SocialLinks socials={site.socials} className="social menu-social" />
      </aside>
    </>
  );
}

export function Footer() {
  const { site } = useContent();
  return (
    <footer className="site-footer">
      <p className="foot-left">{site.copyright}</p>
      <SocialLinks socials={site.socials} className="social foot-social" />
      <p className="foot-right">{site.footerRight}</p>
    </footer>
  );
}

export function BackToTop() {
  const show = useScrollY(500);
  return (
    <button className={cx('to-top', show && 'show')} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} tabIndex={show ? 0 : -1}>
      <icons.arrowUp />
    </button>
  );
}
