import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api, type Category, type PublicProduct } from '../lib/api';
import { useCart } from '../lib/cart';
import { formatPaise } from '../lib/money';
import ProductImage from '../components/ProductImage';

// The 3D farm (three.js) loads only on the home page, in its own chunk.
const FarmSection = lazy(() => import('../farm/FarmSection'));

type Sort = 'featured' | 'name' | 'price_asc' | 'price_desc';

export default function ShopPage() {
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const { add, lines } = useCart();

  useEffect(() => {
    Promise.all([api<{ products: PublicProduct[] }>('/products'), api<{ categories: Category[] }>('/categories')])
      .then(([p, c]) => { setProducts(p.products); setCategories(c.categories); })
      .catch((e: Error) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    if (!products) return [];
    const needle = q.trim().toLowerCase();
    let list = products.filter((p) =>
      (!category || p.category.slug === category) &&
      (!inStockOnly || p.in_stock) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle)));
    const sorted = [...list];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price_asc') sorted.sort((a, b) => a.price_paise - b.price_paise);
    if (sort === 'price_desc') sorted.sort((a, b) => b.price_paise - a.price_paise);
    if (sort === 'featured') sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.name.localeCompare(b.name));
    return sorted;
  }, [products, q, category, sort, inStockOnly]);

  const inBasket = (id: number) => lines.find((l) => l.productId === id)?.qty ?? 0;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-floaters" aria-hidden="true">
          <span className="float f1">🥕</span><span className="float f2">🍅</span>
          <span className="float f3">🥛</span><span className="float f4">🌿</span>
          <span className="float f5">🧺</span><span className="float f6">🫒</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Farm-to-home · Hyderabad</p>
          <h1 id="hero-title">Nature's Goodness. Delivered.</h1>
          <p>Farm-fresh vegetables, traditional snacks, natural milk products, cold-pressed oils and premium spices.</p>
          <a className="btn primary" href="#shop">Shop fresh items</a>
        </div>
      </section>

      <Suspense fallback={<div className="farm-placeholder" aria-hidden="true" />}>
        <FarmSection />
      </Suspense>

      <section id="shop" className="shop" aria-labelledby="shop-title">
        <h2 id="shop-title">Shop</h2>

        <div className="toolbar">
          <label className="search">
            <span className="sr-only">Search products</span>
            <input type="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Sort products</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="featured">Featured</option>
              <option value="name">Name A–Z</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> In stock only
          </label>
        </div>

        <div className="tabs" role="group" aria-label="Filter by category">
          <button className={!category ? 'tab active' : 'tab'} aria-pressed={!category} onClick={() => setCategory('')}>All</button>
          {categories.map((c) => (
            <button key={c.slug} className={category === c.slug ? 'tab active' : 'tab'} aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </button>
          ))}
        </div>

        {error && <p className="notice error" role="alert">Could not load products: {error}</p>}
        {!products && !error && <p className="notice" role="status">Loading fresh products…</p>}
        {products && visible.length === 0 && (
          <div className="empty-state">
            <p>No products match your search.</p>
            <button className="btn" onClick={() => { setQ(''); setCategory(''); setInStockOnly(false); }}>Clear filters</button>
          </div>
        )}

        <div className="product-grid">
          {visible.map((p) => (
            <article className="product-card" key={p.id}>
              {p.is_on_offer && <span className="badge">Offer</span>}
              <div className="product-img"><ProductImage src={p.image_url} alt={p.name} /></div>
              <h3>{p.name}</h3>
              <p className="muted">{p.unit}</p>
              <p className="price">{formatPaise(p.price_paise)}</p>
              {!p.in_stock && <p className="stock out">Out of stock</p>}
              <button className="btn primary full" disabled={!p.in_stock} onClick={() => add(p.id)} aria-label={`Add ${p.name} to basket`}>
                {!p.in_stock ? 'Unavailable' : inBasket(p.id) ? `In basket (${inBasket(p.id)}) · Add` : 'Add to basket'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
