import type { Env } from './env';
import { HttpError, json, readJson } from './http';
import { assertSameOrigin, clearSessionCookie, createSessionToken, readSession, requireAdmin, sessionCookie, verifyPassword } from './auth';
import { createProduct, deleteProduct, listAdminProducts, getAdminProduct, updateProduct, listPublicProducts } from './products';
import { createOrder, listOrders, updateOrderStatus, getOrderItems } from './orders';
import { deleteImage, serveImage, uploadProductImage } from './images';
import { int, str, parseId } from './validate';

const LOGIN_WINDOW_S = 15 * 60;
const LOGIN_MAX_FAILS = 5;

export async function adminLogin(env: Env, request: Request) {
  assertSameOrigin(request);
  const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const now = Math.floor(Date.now() / 1000);

  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE client_key = ? AND attempted_at > ?')
    .bind(clientKey, now - LOGIN_WINDOW_S).first<{ n: number }>();
  if ((fails?.n ?? 0) >= LOGIN_MAX_FAILS) {
    throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  }

  const body = await readJson<{ username?: unknown; password?: unknown }>(request, 1024);
  const username = str(body.username, 'Username', { max: 64 });
  const password = str(body.password, 'Password', { max: 256 });

  const passwordOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH ?? '');
  const userOk = username === env.ADMIN_USERNAME;
  if (!(passwordOk && userOk)) {
    await env.DB.prepare('INSERT INTO login_attempts (client_key, attempted_at) VALUES (?, ?)').bind(clientKey, now).run();
    throw new HttpError(401, 'Invalid username or password.');
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE client_key = ?').bind(clientKey).run();
  const token = await createSessionToken(env, username);
  return json({ ok: true, username }, 200, { 'set-cookie': sessionCookie(token) });
}

export async function adminLogout(request: Request) {
  assertSameOrigin(request);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

export async function adminMe(env: Env, request: Request) {
  const s = await readSession(env, request);
  return json({ authenticated: !!s, username: s?.username ?? null });
}

export async function dashboard(env: Env) {
  const [counts, lowStock, recent] = await Promise.all([
    env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM products WHERE is_hidden = 0 AND is_available = 1) AS live_products,
        (SELECT COUNT(*) FROM products WHERE is_hidden = 1) AS hidden_products,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
        (SELECT COUNT(*) FROM orders WHERE date(created_at, '+330 minutes') = date('now', '+330 minutes')) AS orders_today`
    ).first(),
    env.DB.prepare('SELECT id, name, stock_quantity, unit FROM products WHERE stock_quantity <= 5 AND is_hidden = 0 ORDER BY stock_quantity ASC LIMIT 20').all(),
    env.DB.prepare('SELECT id, order_number, status, customer_name, total_paise, created_at FROM orders ORDER BY created_at DESC, id DESC LIMIT 10').all(),
  ]);
  return json({ counts, low_stock: lowStock.results, recent_orders: recent.results });
}

export async function getSettings(env: Env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function putSettings(env: Env, body: Record<string, unknown>) {
  const delivery = int(body.delivery_charge_paise, 'Delivery charge', 0, 1_000_000);
  const minOrder = int(body.min_order_paise, 'Minimum order', 0, 10_000_000);
  const open = body.store_open === false ? '0' : '1';
  await env.DB.batch([
    env.DB.prepare("INSERT INTO settings (key, value) VALUES ('delivery_charge_paise', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(delivery)),
    env.DB.prepare("INSERT INTO settings (key, value) VALUES ('min_order_paise', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(minOrder)),
    env.DB.prepare("INSERT INTO settings (key, value) VALUES ('store_open', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(open),
  ]);
  return getSettings(env);
}

/** Routes for everything under /api/admin/*. Every branch calls requireAdmin first. */
export async function handleAdmin(env: Env, request: Request, path: string[]): Promise<Response> {
  const method = request.method;
  const isWrite = method !== 'GET';
  if (path.length === 1 && path[0] === 'login' && method === 'POST') return adminLogin(env, request);
  if (path.length === 1 && path[0] === 'logout' && method === 'POST') return adminLogout(request);
  if (path.length === 1 && path[0] === 'me' && method === 'GET') return adminMe(env, request);

  await requireAdmin(env, request);
  if (isWrite) assertSameOrigin(request);

  const [a, b, c] = path;
  if (a === 'dashboard' && method === 'GET') return dashboard(env);

  if (a === 'products' && !b) {
    if (method === 'GET') return json({ products: await listAdminProducts(env, new URL(request.url)) });
    if (method === 'POST') return json({ product: await createProduct(env, await readJson<Record<string, unknown>>(request)) }, 201);
  }
  if (a === 'products' && b) {
    const id = parseId(b);
    if (c === 'image') {
      if (method === 'POST') {
        const product = await getAdminProduct(env, id);
        const newKey = await uploadProductImage(env, id, request);
        await env.DB.prepare("UPDATE products SET image_key = ?, updated_at = datetime('now') WHERE id = ?").bind(newKey, id).run();
        await deleteImage(env, product.image_key); // remove the replaced image only after DB update
        return json({ product: await getAdminProduct(env, id) });
      }
      if (method === 'DELETE') {
        const product = await getAdminProduct(env, id);
        await env.DB.prepare("UPDATE products SET image_key = NULL, updated_at = datetime('now') WHERE id = ?").bind(id).run();
        await deleteImage(env, product.image_key);
        return json({ product: await getAdminProduct(env, id) });
      }
    }
    if (!c) {
      if (method === 'GET') return json({ product: await getAdminProduct(env, id) });
      if (method === 'PUT') return json({ product: await updateProduct(env, id, await readJson<Record<string, unknown>>(request)) });
      if (method === 'DELETE') {
        const key = await deleteProduct(env, id);
        await deleteImage(env, key);
        return json({ ok: true });
      }
    }
  }

  if (a === 'orders' && !b && method === 'GET') {
    return json({ orders: await listOrders(env, new URL(request.url).searchParams.get('status')) });
  }
  if (a === 'orders' && b && !c) {
    const id = parseId(b, 'order');
    if (method === 'GET') {
      const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
      if (!order) throw new HttpError(404, 'Order not found.');
      return json({ order, items: await getOrderItems(env, id) });
    }
    if (method === 'PATCH') {
      const body = await readJson<{ status?: unknown }>(request, 512);
      return json({ order: await updateOrderStatus(env, id, body.status) });
    }
  }

  if (a === 'settings') {
    if (method === 'GET') return json({ settings: await getSettings(env) });
    if (method === 'PUT') return json({ settings: await putSettings(env, await readJson<Record<string, unknown>>(request)) });
  }

  throw new HttpError(404, 'Not found.');
}

/** Public routes: product list, categories, settings for the storefront, order creation, images. */
export async function handlePublic(env: Env, request: Request, path: string[]): Promise<Response> {
  const method = request.method;
  const [a, ...rest] = path;

  if (a === 'products' && rest.length === 0 && method === 'GET') {
    return json({ products: await listPublicProducts(env, new URL(request.url)) });
  }
  if (a === 'categories' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, name, slug FROM categories ORDER BY sort_order, name').all();
    return json({ categories: results });
  }
  if (a === 'store' && method === 'GET') {
    const s = await getSettings(env);
    return json({
      delivery_charge_paise: Number(s.delivery_charge_paise ?? 0),
      min_order_paise: Number(s.min_order_paise ?? 0),
      store_open: s.store_open === '1',
    });
  }
  if (a === 'orders' && rest.length === 0 && method === 'POST') {
    assertSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request, 16_384);
    const order = await createOrder(env, body as never);
    return json({ order }, order.duplicate ? 200 : 201);
  }
  if (a === 'images' && method === 'GET') {
    return serveImage(env, rest.join('/'));
  }
  throw new HttpError(404, 'Not found.');
}
