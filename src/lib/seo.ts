import { useEffect } from 'react';

const SITE = 'https://naturalbasket.co.in';

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

// Sets the title, description, canonical link and robots tag for the current page.
export function usePageMeta(opts: { title: string; description: string; path: string; noindex?: boolean }) {
  const { title, description, path, noindex } = opts;
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', description);
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', SITE + path);
    setMeta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
  }, [title, description, path, noindex]);
}

// Publishes the product list as schema.org JSON-LD so search engines can show prices.
export function useProductSchema(products: { name: string; description: string; image_url: string | null; price_paise: number; in_stock: boolean; slug: string }[] | null) {
  useEffect(() => {
    if (!products || products.length === 0) return undefined;
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.name,
          description: p.description || p.name,
          ...(p.image_url ? { image: p.image_url.startsWith('http') ? p.image_url : SITE + p.image_url } : {}),
          brand: { '@type': 'Brand', name: 'Natural Basket' },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: (p.price_paise / 100).toFixed(2),
            availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: SITE + '/#shop',
          },
        },
      })),
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ld-products';
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [products]);
}
