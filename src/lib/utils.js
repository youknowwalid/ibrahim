import { useEffect, useRef, useState } from 'react';

export const cx = (...a) => a.filter(Boolean).join(' ');

/** Add `.in` to elements when they scroll into view (fade-up reveal like the Gleam template). */
export function useReveal(options) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px', ...options }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

/** Parse a media URL into something the modal can display. */
export function parseMedia(url, kind) {
  const u = (url || '').trim();
  if (!u) return { type: 'none' };
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return { type: 'embed', provider: 'youtube', id: m[1], src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1`, poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return { type: 'embed', provider: 'vimeo', id: m[1], src: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, poster: '' };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return { type: 'video', src: u };
  if (kind === 'video') return { type: 'embed', provider: 'other', src: u, poster: '' };
  return { type: 'image', src: u };
}

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const focusStyle = (focus) => (focus ? { objectPosition: focus } : undefined);

export function useScrollY(threshold) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return past;
}

export function useLockBody(locked) {
  useEffect(() => {
    if (!locked) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    const prev = document.body.style.cssText;
    document.body.style.overflow = 'hidden';
    if (sw > 0) document.body.style.paddingRight = sw + 'px';
    return () => {
      document.body.style.cssText = prev;
    };
  }, [locked]);
}
