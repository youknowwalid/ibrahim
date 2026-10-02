import { useState } from 'react';
import { useContent } from '../lib/content.jsx';
import { Cta, DragRow, Lightbox, Reveal, Stats } from '../components/Bits.jsx';

export default function About() {
  const { about, home, site } = useContent();
  const [lb, setLb] = useState(null);
  const imgs = (about.images || []).filter(Boolean);
  return (
    <>
      <section className="page-head about-head">
        <Reveal as="h1" className="h1 center">{about.title}</Reveal>
        {about.subtitle && <Reveal as="p" className="lead center" delay={100}>{about.subtitle}</Reveal>}
      </section>
      {imgs.length > 0 && (
        <Reveal className="about-strip" delay={150}>
          <DragRow label="Photo gallery — drag or scroll to see more">
            {imgs.map((src, i) => (
              <button key={src + i} className="strip-img" onClick={() => setLb(i)} aria-label={`Open photo ${i + 1}`}>
                <img src={src} alt={`${site.name} — photo ${i + 1}`} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" draggable="false" />
              </button>
            ))}
          </DragRow>
        </Reveal>
      )}
      <section className="about-bio">
        <div className="bio-col">
          {(about.left || []).map((t, i) => (
            <Reveal as="p" className="body" key={i} delay={i * 80}>{t}</Reveal>
          ))}
        </div>
        <div className="bio-col">
          {(about.right || []).map((t, i) => (
            <Reveal as="p" className="body" key={i} delay={i * 80}>{t}</Reveal>
          ))}
        </div>
      </section>
      {about.showStats !== false && <Stats stats={home.stats} />}
      <Cta cta={home.cta} />
      <Lightbox images={imgs} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </>
  );
}
