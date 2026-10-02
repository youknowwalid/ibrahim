import { useState } from 'react';
import { Link } from '../lib/router.jsx';
import { useContent } from '../lib/content.jsx';
import { cx, focusStyle } from '../lib/utils.js';
import { Cta, Marquee, Reveal, Stats } from '../components/Bits.jsx';
import { Featured } from '../components/Featured.jsx';

function Hero() {
  const { home } = useContent();
  const h = home.hero;
  return (
    <section className="hero">
      {h.image && <img className="hero-img" src={h.image} alt="" fetchpriority="high" style={focusStyle(h.focus)} />}
      <div className="hero-shade" />
      <h1 className="hero-title">{h.title}</h1>
    </section>
  );
}

function Intro() {
  const { home, site } = useContent();
  const i = home.intro;
  return (
    <section className="intro">
      <div className="intro-left">
        <Reveal as="h3" className="h3">{i.heading}</Reveal>
        <Reveal as="p" className="body" delay={100}>{i.text}</Reveal>
        {i.imageLandscape && (
          <Reveal className="intro-img landscape" delay={150}>
            <img src={i.imageLandscape} alt={`${site.name} — portrait`} loading="lazy" decoding="async" style={focusStyle(i.imageLandscapeFocus)} />
          </Reveal>
        )}
      </div>
      <div className="intro-right">
        {i.imagePortrait && (
          <Reveal className="intro-img portrait">
            <img src={i.imagePortrait} alt={`${site.name} — portrait`} loading="lazy" decoding="async" style={focusStyle(i.imagePortraitFocus)} />
          </Reveal>
        )}
        <Reveal as="p" className="body intro-text-right" delay={100}>{i.textRight}</Reveal>
      </div>
    </section>
  );
}

function Portfolio() {
  const { home, site } = useContent();
  const p = home.portfolio;
  const items = (p.items || []).filter((x) => x.visible !== false);
  const [active, setActive] = useState(0);
  if (!items.length) return null;
  return (
    <section className="portfolio">
      <Reveal as="h2" className="h2 center">{p.heading}</Reveal>
      {p.text && <Reveal as="p" className="section-lead center" delay={80}>{p.text}</Reveal>}
      <Reveal className="pf-row" delay={120} role="list">
        {items.map((it, idx) => {
          const on = idx === Math.min(active, items.length - 1);
          const inner = (
            <>
              <img src={it.image} alt={`${site.name} — ${it.title}`} loading="lazy" decoding="async" style={focusStyle(it.focus)} />
              <span className="pf-shade" />
              <span className="pf-vert" aria-hidden="true">
                <span className="pf-cat">{it.category}</span>
                <span className="pf-vtitle">{it.title}</span>
              </span>
              <span className="pf-info">
                <span className="pf-cat">{it.category}</span>
                <span className="pf-title">{it.title}</span>
                {it.description && <span className="pf-desc">{it.description}</span>}
              </span>
            </>
          );
          const props = {
            className: cx('pf-card', on && 'active'),
            onMouseEnter: () => setActive(idx),
            onFocus: () => setActive(idx),
            role: 'listitem',
            'aria-label': `${it.category}: ${it.title}`,
          };
          return it.link ? (
            <Link key={it.id} to={it.link} {...props}>{inner}</Link>
          ) : (
            <div key={it.id} tabIndex={0} {...props}>{inner}</div>
          );
        })}
      </Reveal>
    </section>
  );
}

export default function Home() {
  const { home } = useContent();
  return (
    <>
      <Hero />
      <Marquee items={home.marquee} />
      <Intro />
      <Stats stats={home.stats} />
      <Portfolio />
      <Featured />
      <Cta cta={home.cta} />
    </>
  );
}
