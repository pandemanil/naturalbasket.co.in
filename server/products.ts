import type { Env } from './env';
import { HttpError } from './http';
import { int, parseId, slugify, str, bool } from './validate';

export interface ProductRow {
  id: number; name: string; slug: string; description: string;
  category_id: number; category_name: string; category_slug: string;
  price_paise: number; unit: string; image_key: string | null;
  stock_quantity: number; is_available: number; is_featured: number;
  is_on_offer: number; is_hidden: number; created_at: string; updated_at: string;
}

const SORTS: Record<string, string> = {
  featured: 'p.is_featured DESC, p.name ASC',
  name: 'p.name ASC',
  price_asc: 'p.price_paise ASC, p.name ASC',
  price_desc: 'p.price_paise DESC, p.name ASC',
  newest: 'p.created_at DESC',
};

const BASE_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
  FROM products p JOIN categories c ON c.id = p.category_id`;

/** Shape sent to the public storefront. Exact stock counts are withheld; only in_stock is shared. */
export function publicProduct(p: ProductRow) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: { id: p.category_id, name: p.category_name, slug: p.category_slug },
    price_paise: p.price_paise,
    unit: p.unit,
    image_url: p.image_key ? `/api/images/${p.image_key}` : null,
    in_stock: p.stock_quantity > 0 && p.is_available === 1,
    is_featured: p.is_featured === 1,
    is_on_offer: p.is_on_offer === 1,
  };
}

export async function listPublicProducts(env: Env, url: URL) {
  const where = ['p.is_hidden = 0'];
  const binds: unknown[] = [];

  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }
  const cat = url.searchParams.get('category');
  if (cat) {
    where.push('c.slug = ?');
    binds.push(cat);
  }
  if (url.searchParams.get('offer') === '1') where.push('p.is_on_offer = 1');
  if (url.searchParams.get('in_stock') === '1') where.push('p.is_available = 1 AND p.stock_quantity > 0');

  const sort = SORTS[url.searchParams.get('sort') ?? 'featured'] ?? SORTS.featured;
  const { results } = await env.DB
    .prepare(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT 200`)
    .bind(...binds)
    .all<ProductRow>();
  return results.map(publicProduct);
}

export async function listCategories(env: Env) {
  const { results } = await env.DB.prepare('SELECT id, name, slug FROM categories ORDER BY sort_order, name').all();
  return results;
}

export async function getAdminProduct(env: Env, id: number): Promise<ProductRow> {
  const row = await env.DB.prepare(`${BASE_SELECT} WHERE p.id = ?`).bind(id).first<ProductRow>();
  if (!row) throw new HttpError(404, 'Product not found.');
  return row;
}

export interface ProductInput {
  name: string; slug: string; description: string; category_id: number;
  price_paise: number; unit: string; stock_quantity: number;
  is_available: number; is_featured: number; is_on_offer: number; is_hidden: number;
}

/** Validates an admin payload. Prices arrive as integer paise; the UI converts rupees. */
export function parseProductInput(body: Record<string, unknown>, existingSlug?: string): ProductInput {
  const name = str(body.name, 'Name', { min: 2, max: 120 });
  const slugRaw = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : slugify(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugRaw) || slugRaw.length > 80) {
    throw new HttpError(422, 'Slug may only contain lowercase letters, numbers and hyphens.', { slug: 'Invalid format' });
  }
  return {
    name,
    slug: existingSlug && !body.slug ? existingSlug : slugRaw,
    description: str(body.description, 'Description', { max: 1000, optional: true }),
    category_id: int(body.category_id, 'Category', 1, 1_000_000),
    price_paise: int(body.price_paise, 'Price', 0, 10_000_000),
    unit: str(body.unit, 'Unit', { min: 2, max: 40 }),
    stock_quantity: int(body.stock_quantity, 'Stock quantity', 0, 1_000_000),
    is_available: bool(body.is_available, 'Availability'),
    is_featured: bool(body.is_featured, 'Featured'),
    is_on_offer: bool(body.is_on_offer, 'On offer'),
    is_hidden: bool(body.is_hidden, 'Hidden'),
  };
}

export async function listAdminProducts(env: Env, url: URL) {
  const where: string[] = [];
  const binds: unknown[] = [];
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q) { where.push('(p.name LIKE ? OR p.slug LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
  const cat = url.searchParams.get('category_id');
  if (cat) { where.push('p.category_id = ?'); binds.push(parseId(cat, 'category')); }
  if (url.searchParams.get('status') === 'hidden') where.push('p.is_hidden = 1');
  if (url.searchParams.get('status') === 'low_stock') where.push('p.stock_quantity <= 5 AND p.is_hidden = 0');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { results } = await env.DB
    .prepare(`${BASE_SELECT} ${clause} ORDER BY p.name ASC LIMIT 500`)
    .bind(...binds)
    .all<ProductRow>();
  return results;
}

export async function createProduct(env: Env, body: Record<string, unknown>) {
  const input = parseProductInput(body);
  await ensureSlugFree(env, input.slug);
  const res = await env.DB.prepare(
    `INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity,
       is_available, is_featured, is_on_offer, is_hidden)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(input.name, input.slug, input.description, input.category_id, input.price_paise, input.unit,
    input.stock_quantity, input.is_available, input.is_featured, input.is_on_offer, input.is_hidden).run();
  return getAdminProduct(env, Number(res.meta.last_row_id));
}

export async function updateProduct(env: Env, id: number, body: Record<string, unknown>) {
  const current = await getAdminProduct(env, id);
  const input = parseProductInput(body, current.slug);
  if (input.slug !== current.slug) await ensureSlugFree(env, input.slug, id);
  await env.DB.prepare(
    `UPDATE products SET name=?, slug=?, description=?, category_id=?, price_paise=?, unit=?,
       stock_quantity=?, is_available=?, is_featured=?, is_on_offer=?, is_hidden=?,
       updated_at=datetime('now') WHERE id=?`
  ).bind(input.name, input.slug, input.description, input.category_id, input.price_paise, input.unit,
    input.stock_quantity, input.is_available, input.is_featured, input.is_on_offer, input.is_hidden, id).run();
  return getAdminProduct(env, id);
}

export async function deleteProduct(env: Env, id: number): Promise<string | null> {
  const product = await getAdminProduct(env, id);
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').bind(id).first<{ n: number }>();
  if ((used?.n ?? 0) > 0) {
    throw new HttpError(409, 'This product appears in past orders, so it cannot be deleted. Hide it instead.');
  }
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return product.image_key; // caller removes the R2 object
}

async function ensureSlugFree(env: Env, slug: string, exceptId?: number) {
  const row = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (row && row.id !== exceptId) {
    throw new HttpError(409, 'Another product already uses this URL slug.', { slug: 'Already in use' });
  }
}
