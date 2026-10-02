import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
const isInternal = (href) => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');

export function Router({ children }) {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname.replace(/(.)\/+$/, '$1'), hash: window.location.hash }));

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onPop = () => setLoc({ path: window.location.pathname.replace(/(.)\/+$/, '$1'), hash: window.location.hash });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (!isInternal(to)) {
      window.location.href = to;
      return;
    }
    const url = new URL(to, window.location.origin);
    const next = { path: url.pathname.replace(/(.)\/+$/, '$1'), hash: url.hash };
    if (url.pathname + url.hash === window.location.pathname + window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
    setLoc(next);
    if (!next.hash) window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ ...loc, navigate }), [loc, navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

export function Link({ to, href, children, onClick, ...rest }) {
  const { navigate } = useRouter();
  const target = to ?? href;
  const internal = isInternal(target);
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || !internal || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || rest.target === '_blank') return;
    e.preventDefault();
    navigate(target);
  };
  const external = !internal && /^https?:/.test(target || '');
  return (
    <a href={target} onClick={handle} {...(external ? { rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
    </a>
  );
}
