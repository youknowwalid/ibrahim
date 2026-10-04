import { createContext, useContext, useEffect, useState } from 'react';
import { isSB, publicContent } from './sb.js';

const Ctx = createContext(null);

export function ContentProvider({ children }) {
  const [content, setContent] = useState(() => window.__CONTENT__ || null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (content) return;
    if (isSB()) {
      // Hosted version: read from the database; fall back to the bundled starting content if it is empty or unreachable.
      publicContent()
        .then((c) => c || Promise.reject())
        .catch(() => import('../../server/seed-content.js').then((m) => m.defaultContent))
        .then(setContent)
        .catch(() => setError(true));
      return;
    }
    fetch('/api/content')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setContent)
      .catch(() => setError(true));
  }, [content]);
  if (error) return <p style={{ padding: 40, fontFamily: 'sans-serif' }}>The site could not be loaded. Please refresh the page.</p>;
  if (!content) return <div className="boot" aria-busy="true" />;
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}

export const useContent = () => useContext(Ctx);
