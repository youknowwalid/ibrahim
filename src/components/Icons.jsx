const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const icons = {
  instagram: (p) => (
    <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg>
  ),
  facebook: (p) => (
    <svg {...base} {...p}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z" /></svg>
  ),
  twitter: (p) => (
    <svg {...base} {...p}><path d="M4 4l6.8 9.3L4.3 20H6l5.6-5.9L15.9 20H20l-7.1-9.7L19.2 4h-1.7l-5.2 5.5L8.3 4z" /></svg>
  ),
  youtube: (p) => (
    <svg {...base} {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></svg>
  ),
  tiktok: (p) => (
    <svg {...base} {...p}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 4c.4 2.4 2 4 4.5 4.2" /></svg>
  ),
  linkedin: (p) => (
    <svg {...base} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 10.5V16M8 7.8v.1M12 16v-5.5M12 13c0-1.7 1-2.6 2.3-2.6S16.5 11.300 16.500 13V16" /></svg>
  ),
  share: (p) => (
    <svg {...base} {...p}><circle cx="6" cy="12" r="2.3" /><circle cx="17.500" cy="6" r="2.300" /><circle cx="17.500" cy="18" r="2.300" /><path d="M8.100 11l7.300-4M8.100 13l7.300 4" /></svg>
  ),
  arrowUp: (p) => (
    <svg {...base} strokeWidth="1.2" width="22" height="22" {...p}><path d="M12 20V4M5.500 10.500L12 4l6.500 6.500" /></svg>
  ),
  close: (p) => (
    <svg {...base} strokeWidth="1.5" {...p}><path d="M5 5l14 14M19 5L5 19" /></svg>
  ),
  play: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" {...p}><path d="M8 5.500v13l11-6.500z" /></svg>
  ),
  chevronLeft: (p) => (
    <svg {...base} strokeWidth="1.5" {...p}><path d="M15 5l-7 7 7 7" /></svg>
  ),
  chevronRight: (p) => (
    <svg {...base} strokeWidth="1.5" {...p}><path d="M9 5l7 7-7 7" /></svg>
  ),
  external: (p) => (
    <svg {...base} width="14" height="14" strokeWidth="1.8" {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
  ),
};

export const socialLabels = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn' };

export function SocialLinks({ socials, className = 'social' }) {
  const list = (socials || []).filter((s) => s.url && icons[s.type]);
  if (!list.length) return null;
  return (
    <ul className={className}>
      {list.map((s) => {
        const Icon = icons[s.type];
        return (
          <li key={s.type}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[s.type] || s.type}>
              <Icon />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
