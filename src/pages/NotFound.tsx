import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';
export default function NotFound() {
  usePageMeta({ title: 'Page not found | Natural Basket', description: 'This page could not be found.', path: '/', noindex: true });
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p><Link to="/">Back to the shop</Link></p>
    </div>
  );
}
