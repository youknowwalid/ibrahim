import { lazy, Suspense, useEffect } from 'react';
import { Router, useRouter } from './lib/router.jsx';
import { ContentProvider, useContent } from './lib/content.jsx';
import { BackToTop, Footer, Header } from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Lookbook from './pages/Lookbook.jsx';
import Contact from './pages/Contact.jsx';
import NotFound from './pages/NotFound.jsx';

const Admin = lazy(() => import('./admin/AdminApp.jsx'));

function Site() {
  const { path } = useRouter();
  const c = useContent();
  useEffect(() => {
    const titles = { '/': c.site.seoTitle, '/about': `${c.about.title} | ${c.site.name}`, '/lookbook': `Lookbook | ${c.site.name}`, '/contact': `${c.contact.title} | ${c.site.name}` };
    document.title = titles[path] || `Page not found | ${c.site.name}`;
  }, [path]);
  const pages = { '/': Home, '/about': About, '/lookbook': Lookbook, '/contact': Contact };
  const Page = pages[path] || NotFound;
  // header text is white over the dark home hero, dark elsewhere
  return (
    <>
      <Header light={path === '/'} />
      <main key={path} className="page">
        <Page />
      </main>
      <Footer />
      <BackToTop />
    </>
  );
}

function Routes() {
  const { path } = useRouter();
  if (path === '/admin' || path.startsWith('/admin/'))
    return (
      <Suspense fallback={<div className="boot" />}>
        <Admin />
      </Suspense>
    );
  return (
    <ContentProvider>
      <Site />
    </ContentProvider>
  );
}

export default function App() {
  return (
    <Router>
      <Routes />
    </Router>
  );
}
