import { useState } from 'react';
import { useContent } from '../lib/content.jsx';
import { DragRow, Lightbox, Reveal } from '../components/Bits.jsx';

function Section({ s, site }) {
  const [lb, setLb] = useState(null);
  const imgs = (s.images || []).filter(Boolean);
  return (
    <section className="look-section">
      <Reveal as="p" className="look-cat">{s.category}</Reveal>
      <Reveal as="h2" className="h2" delay={80}>{s.title}</Reveal>
      {imgs.length > 0 && (
        <Reveal delay={150}>
          <DragRow className="look-row" label={`${s.title} — drag or scroll to see more`}>
            {imgs.map((src, i) => (
              <button key={src + i} className="look-img" onClick={() => setLb(i)} aria-label={`Open photo ${i + 1} of ${s.title}`}>
                <img src={src} alt={`${site.name} — ${s.title}, photo ${i + 1}`} loading="lazy" decoding="async" draggable="false" />
              </button>
            ))}
          </DragRow>
        </Reveal>
      )}
      <Lightbox images={imgs} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </section>
  );
}

export default function Lookbook() {
  const { lookbook, site } = useContent();
  return (
    <div className="lookbook">
      {lookbook.sections.map((s) => (
        <Section key={s.id} s={s} site={site} />
      ))}
    </div>
  );
}
