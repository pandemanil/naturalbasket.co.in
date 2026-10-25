import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type PublicProduct } from '../lib/api';
import { useCart } from '../lib/cart';
import { formatPaise } from '../lib/money';
import ProductImage from '../components/ProductImage';
import { usePageMeta } from '../lib/seo';

interface StoreSettings { delivery_charge_paise: number; min_order_paise: number; store_open: boolean }
interface PlacedOrder {
  order_number: string; status: string; subtotal_paise: number; delivery_paise: number; total_paise: number;
  items: Array<{ name: string; unit: string; quantity: number; line_total_paise: number }>;
  whatsapp_url: string | null;
}

const emptyForm = { customer_name: '', mobile: '', address: '', city: 'Hyderabad', pincode: '', notes: '' };

export default function BasketPage() {
  const { lines, setQty, remove, clear } = useCart();
  usePageMeta({ title: 'Your basket | Natural Basket', description: 'Review your Natural Basket order and send it on WhatsApp.', path: '/basket', noindex: true });
  const [catalogue, setCatalogue] = useState<PublicProduct[] | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // One key per checkout attempt. Retries reuse it, so a double tap cannot create two orders.
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    Promise.all([api<{ products: PublicProduct[] }>('/products'), api<StoreSettings>('/store')])
      .then(([p, s]) => { setCatalogue(p.products); setSettings(s); })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!catalogue) return [];
    return lines
      .map((l) => ({ line: l, product: catalogue.find((p) => p.id === l.productId) }))
      .filter((r): r is { line: typeof lines[number]; product: PublicProduct } => !!r.product);
  }, [lines, catalogue]);

  const subtotal = rows.reduce((s, r) => s + r.product.price_paise * r.line.qty, 0);
  const delivery = settings?.delivery_charge_paise ?? 0;
  const minOrder = settings?.min_order_paise ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;

  const update = (field: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');
    const next: Record<string, string> = {};
    if (form.customer_name.trim().length < 2) next.customer_name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) next.mobile = 'Enter a valid 10-digit mobile number';
    if (form.address.trim().length < 10) next.address = 'Enter your full delivery address';
    if (!/^\d{6}$/.test(form.pincode.trim())) next.pincode = 'Enter a 6-digit pincode';
    if (rows.length === 0) next.items = 'Your basket is empty';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await api<{ order: PlacedOrder }>('/orders', {
        method: 'POST',
        json: {
          ...form,
          idempotency_key: idemKey,
          items: rows.map((r) => ({ product_id: r.line.productId, quantity: r.line.qty })),
        },
      });
      clear();
      setPlaced(res.order);
      setIdemKey(crypto.randomUUID());
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.details ?? {});
      setSubmitError(apiErr.message);
      // Refresh prices/stock so the customer sees what changed
      api<{ products: PublicProduct[] }>('/products').then((p) => setCatalogue(p.products)).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  if (placed) {
    return (
      <section className="confirmation" aria-labelledby="conf-title">
        <h1 id="conf-title">Order request received</h1>
        <p className="notice">
          Your order number is <strong>{placed.order_number}</strong>. Status: <strong>Pending confirmation</strong>.
          This is a request, not a confirmed or paid order. We will confirm availability, delivery charges and payment on WhatsApp.
        </p>
        <ul className="summary">
          {placed.items.map((i) => (
            <li key={i.name}>{i.name} ({i.unit}) × {i.quantity} — {formatPaise(i.line_total_paise)}</li>
          ))}
        </ul>
        <p>Subtotal {formatPaise(placed.subtotal_paise)} · Delivery {placed.delivery_paise > 0 ? formatPaise(placed.delivery_paise) : 'to be confirmed on chat'}</p>
        <p><strong>Total: {formatPaise(placed.total_paise)}</strong></p>
        {placed.whatsapp_url && (
          <a className="btn whatsapp" href={placed.whatsapp_url} target="_blank" rel="noopener noreferrer">Send order on WhatsApp</a>
        )}
        <p><Link to="/">Continue shopping</Link></p>
      </section>
    );
  }

  return (
    <div className="basket-layout">
      <section className="panel" aria-labelledby="basket-title">
        <h1 id="basket-title">Your basket</h1>
        {loadError && <p className="notice error" role="alert">{loadError}</p>}
        {!catalogue && !loadError && <p role="status">Loading prices…</p>}
        {catalogue && rows.length === 0 && (
          <div className="empty-state">
            <p>Your basket is empty.</p>
            <Link className="btn primary" to="/">Browse products</Link>
          </div>
        )}
        <ul className="basket-lines">
          {rows.map(({ line, product }) => (
            <li key={line.productId}>
              <div className="line-thumb"><ProductImage src={product.image_url} alt={product.name} /></div>
              <div className="line-info">
                <strong>{product.name}</strong>
                <span className="muted">{product.unit} · {formatPaise(product.price_paise)} each</span>
                {!product.in_stock && <span className="stock out">Currently out of stock</span>}
              </div>
              <div className="qty" role="group" aria-label={`Quantity for ${product.name}`}>
                <button onClick={() => setQty(line.productId, line.qty - 1)} aria-label="Decrease quantity">−</button>
                <span aria-live="polite">{line.qty}</span>
                <button onClick={() => setQty(line.productId, line.qty + 1)} aria-label="Increase quantity" disabled={line.qty >= 50}>+</button>
              </div>
              <div className="line-total">{formatPaise(product.price_paise * line.qty)}</div>
              <button className="link-btn" onClick={() => remove(line.productId)}>Remove</button>
            </li>
          ))}
        </ul>
        {rows.length > 0 && (
          <div className="totals">
            <div><span>Subtotal</span><span>{formatPaise(subtotal)}</span></div>
            <div><span>Delivery</span><span>{delivery > 0 ? formatPaise(delivery) : 'Confirmed on chat'}</span></div>
            <div className="grand"><span>Estimated total</span><span>{formatPaise(subtotal + delivery)}</span></div>
            {belowMin && <p className="notice error">Minimum order is {formatPaise(minOrder)}. Add {formatPaise(minOrder - subtotal)} more to checkout.</p>}
            <button className="btn link-btn" onClick={clear}>Empty basket</button>
          </div>
        )}
        {settings && !settings.store_open && <p className="notice error">We are not accepting orders right now.</p>}
      </section>

      <section className="panel" aria-labelledby="checkout-title">
        <h2 id="checkout-title">Delivery details</h2>
        <form onSubmit={submit} noValidate>
          <Field label="Full name" id="customer_name" value={form.customer_name} error={errors.customer_name} onChange={(v) => update('customer_name', v)} autoComplete="name" />
          <Field label="WhatsApp mobile" id="mobile" type="tel" inputMode="numeric" value={form.mobile} error={errors.mobile} onChange={(v) => update('mobile', v)} autoComplete="tel" placeholder="10-digit number" />
          <Field label="Delivery address" id="address" textarea value={form.address} error={errors.address} onChange={(v) => update('address', v)} autoComplete="street-address" placeholder="House no, street, area, landmark" />
          <div className="two-col">
            <Field label="City" id="city" value={form.city} error={errors.city} onChange={(v) => update('city', v)} autoComplete="address-level2" />
            <Field label="Pincode" id="pincode" inputMode="numeric" value={form.pincode} error={errors.pincode} onChange={(v) => update('pincode', v)} autoComplete="postal-code" />
          </div>
          <Field label="Order notes (optional)" id="notes" textarea value={form.notes} error={errors.notes} onChange={(v) => update('notes', v)} />
          {errors.items && <p className="notice error" role="alert">{errors.items}</p>}
          {submitError && <p className="notice error" role="alert">{submitError}</p>}
          <button className="btn primary full" type="submit" disabled={submitting || rows.length === 0 || belowMin || !settings?.store_open}>
            {submitting ? 'Sending request…' : 'Send order request'}
          </button>
          <p className="muted small">Sending a request does not charge you. Your order is confirmed by us on WhatsApp.</p>
        </form>
      </section>
    </div>
  );
}

function Field(props: {
  label: string; id: string; value: string; error?: string; onChange: (v: string) => void;
  textarea?: boolean; type?: string; inputMode?: 'numeric' | 'text' | 'tel'; autoComplete?: string; placeholder?: string;
}) {
  const common = {
    id: props.id, value: props.value, placeholder: props.placeholder, autoComplete: props.autoComplete,
    'aria-invalid': !!props.error, 'aria-describedby': props.error ? `${props.id}-err` : undefined,
    onChange: (e: { target: { value: string } }) => props.onChange(e.target.value),
  };
  return (
    <div className="form-group">
      <label htmlFor={props.id}>{props.label}</label>
      {props.textarea
        ? <textarea rows={3} {...common} />
        : <input type={props.type ?? 'text'} inputMode={props.inputMode} {...common} />}
      {props.error && <span className="field-error" id={`${props.id}-err`}>{props.error}</span>}
    </div>
  );
}
