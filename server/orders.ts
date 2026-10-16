import type { Env } from './env';
import { HttpError } from './http';
import { int, str } from './validate';

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

interface OrderBody {
  customer_name: unknown; mobile: unknown; address: unknown; city: unknown;
  pincode: unknown; notes: unknown; idempotency_key: unknown;
  items: unknown;
}

function newOrderNumber(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return `NB-${ymd}-${String(rand).padStart(5, '0')}`;
}

async function findByKey(env: Env, key: string) {
  return env.DB.prepare('SELECT order_number, total_paise, delivery_paise, subtotal_paise FROM orders WHERE idempotency_key = ?')
    .bind(key).first<{ order_number: string; total_paise: number; delivery_paise: number; subtotal_paise: number }>();
}

export async function createOrder(env: Env, raw: OrderBody) {
  // 1. Validate customer details
  const customer_name = str(raw.customer_name, 'Full name', { min: 2, max: 100 });
  const mobileRaw = str(raw.mobile, 'Mobile number', { max: 15 }).replace(/\s|-/g, '');
  if (!/^[6-9]\d{9}$/.test(mobileRaw)) {
    throw new HttpError(422, 'Enter a valid 10-digit mobile number.', { mobile: 'Invalid mobile number' });
  }
  const address = str(raw.address, 'Delivery address', { min: 10, max: 500 });
  const city = str(raw.city ?? 'Hyderabad', 'City', { max: 60 });
  const pincode = str(raw.pincode, 'Pincode', { max: 6 });
  if (!/^\d{6}$/.test(pincode)) throw new HttpError(422, 'Enter a valid 6-digit pincode.', { pincode: 'Invalid pincode' });
  const notes = str(raw.notes, 'Order notes', { max: 500, optional: true });
  const key = str(raw.idempotency_key, 'Request key', { min: 16, max: 64 });

  // 2. Duplicate submission (double tap / retry): return the original order unchanged
  const existing = await findByKey(env, key);
  if (existing) return { ...existing, duplicate: true, whatsapp_url: null as string | null, items: [] as unknown[] };

  // 3. Validate items
  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 30) {
    throw new HttpError(422, 'Your basket must contain between 1 and 30 items.');
  }
  const requested = new Map<number, number>();
  for (const item of raw.items as Array<{ product_id: unknown; quantity: unknown }>) {
    const pid = int(item?.product_id, 'Product', 1, 1_000_000_000);
    const qty = int(item?.quantity, 'Quantity', 1, 50);
    requested.set(pid, (requested.get(pid) ?? 0) + qty);
  }
  const ids = [...requested.keys()];

  // 4. Load CURRENT prices and availability from the database — never trust the browser
  const placeholders = ids.map(() => '?').join(',');
  const { results: products } = await env.DB
    .prepare(`SELECT id, name, unit, price_paise, stock_quantity, is_available, is_hidden
              FROM products WHERE id IN (${placeholders})`)
    .bind(...ids).all<{ id: number; name: string; unit: string; price_paise: number; stock_quantity: number; is_available: number; is_hidden: number }>();
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: Array<{ id: number; name: string; unit: string; price: number; qty: number; total: number }> = [];
  for (const [pid, qty] of requested) {
    const p = byId.get(pid);
    if (!p || p.is_hidden === 1 || p.is_available !== 1) {
      throw new HttpError(409, 'One or more items in your basket are no longer available. Please review your basket.');
    }
    if (p.stock_quantity < qty) {
      throw new HttpError(409, `Only ${p.stock_quantity} left of ${p.name}. Please reduce the quantity.`);
    }
    lines.push({ id: pid, name: p.name, unit: p.unit, price: p.price_paise, qty, total: p.price_paise * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  // 5. Store settings: open/closed, minimum order, delivery charge
  const { results: settingRows } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  if (settings.store_open !== '1') throw new HttpError(503, 'We are not accepting orders right now. Please try again later.');
  const minOrder = Number(settings.min_order_paise ?? 0);
  const delivery = Number(settings.delivery_charge_paise ?? 0);
  if (subtotal < minOrder) {
    throw new HttpError(422, `Minimum order is ${formatRupees(minOrder)}. Your subtotal is ${formatRupees(subtotal)}.`);
  }
  const total = subtotal + delivery;

  // 6. Atomic write: order + items + stock decrement. If any stock check fails, everything rolls back.
  const orderNumber = newOrderNumber();
  const orderInsert = env.DB.prepare(
    `INSERT INTO orders (order_number, status, customer_name, mobile, address, city, pincode, notes,
       subtotal_paise, delivery_paise, total_paise, idempotency_key)
     VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(orderNumber, customer_name, mobileRaw, address, city, pincode, notes, subtotal, delivery, total, key);

  const statements: D1PreparedStatement[] = [orderInsert];
  for (const l of lines) {
    statements.push(env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, unit, unit_price_paise, quantity, line_total_paise)
       VALUES ((SELECT id FROM orders WHERE order_number = ?), ?, ?, ?, ?, ?, ?)`
    ).bind(orderNumber, l.id, l.name, l.unit, l.price, l.qty, l.total));
    statements.push(env.DB.prepare(
      `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`
    ).bind(l.qty, l.id));
  }

  try {
    await env.DB.batch(statements);
  } catch (err) {
    // Concurrent duplicate with the same key → return the winner's order
    const winner = await findByKey(env, key);
    if (winner) return { ...winner, duplicate: true, whatsapp_url: null as string | null, items: [] as unknown[] };
    // Otherwise the stock CHECK constraint (stock_quantity >= 0) rejected the batch
    console.error('order batch failed', err);
    throw new HttpError(409, 'Stock changed while you were ordering. Please review your basket and try again.');
  }

  // 7. Build WhatsApp message from server-verified data (shared by the customer, not a payment)
  const itemText = lines.map((l, i) => `${i + 1}. ${l.name} (${l.unit}) x${l.qty} - ${formatRupees(l.total)}`).join('\n');
  const message = [
    `*NEW ORDER REQUEST - NATURAL BASKET*`,
    `Order No: ${orderNumber}`,
    `Customer: ${customer_name}`,
    `Mobile: ${mobileRaw}`,
    ``,
    `*Items*`,
    itemText,
    ``,
    `Subtotal: ${formatRupees(subtotal)}`,
    `Delivery: ${delivery > 0 ? formatRupees(delivery) : 'To be confirmed on chat'}`,
    `Total: ${formatRupees(total)}${delivery > 0 ? '' : ' (plus delivery, if any)'}`,
    ``,
    `Address: ${address}, ${city} - ${pincode}`,
    notes ? `Notes: ${notes}` : '',
    ``,
    `Payment: not yet collected`,
  ].filter((l) => l !== '').join('\n');
  const whatsapp_url = `https://wa.me/${env.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return {
    order_number: orderNumber,
    status: 'pending' as const,
    subtotal_paise: subtotal,
    delivery_paise: delivery,
    total_paise: total,
    items: lines.map((l) => ({ name: l.name, unit: l.unit, quantity: l.qty, unit_price_paise: l.price, line_total_paise: l.total })),
    whatsapp_url,
    duplicate: false,
  };
}

export async function listOrders(env: Env, status: string | null) {
  const valid = status && Object.prototype.hasOwnProperty.call(STATUS_FLOW, status) ? status : null;
  const { results } = await env.DB.prepare(
    `SELECT * FROM orders ${valid ? 'WHERE status = ?' : ''} ORDER BY created_at DESC, id DESC LIMIT 200`
  ).bind(...(valid ? [valid] : [])).all();
  return results;
}

export async function updateOrderStatus(env: Env, id: number, next: unknown) {
  if (typeof next !== 'string') throw new HttpError(422, 'Status is required.');
  const order = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first<{ id: number; status: string }>();
  if (!order) throw new HttpError(404, 'Order not found.');
  if (!(STATUS_FLOW[order.status] ?? []).includes(next)) {
    throw new HttpError(409, `Cannot change an order from "${order.status}" to "${next}".`);
  }
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?`).bind(next, id, order.status),
  ];
  // Cancelling returns stock to inventory (only once, guarded by the status check above)
  if (next === 'cancelled') {
    const { results: items } = await env.DB.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?')
      .bind(id).all<{ product_id: number; quantity: number }>();
    for (const it of items) {
      statements.push(env.DB.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').bind(it.quantity, it.product_id));
    }
  }
  await env.DB.batch(statements);
  return env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
}

export async function getOrderItems(env: Env, id: number) {
  const { results } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(id).all();
  return results;
}
