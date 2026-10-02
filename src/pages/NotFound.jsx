import { Link } from '../lib/router.jsx';
export default function NotFound() {
  return (
    <section className="page-head notfound">
      <h1 className="h1 center">Page not found</h1>
      <p className="lead center">The page you are looking for does not exist.</p>
      <p className="center"><Link to="/" className="btn">Back to home</Link></p>
    </section>
  );
}
