import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError, type Category } from '../lib/api';
import { formatPaise, paiseToRupeesInput, rupeesToPaise } from '../lib/money';
import ConfirmDialog from './ConfirmDialog';

export interface AdminProduct {
  id: number; name: string; slug: string; description: string;
  category_id: number; category_name: string; category_slug: string;
  price_paise: number; unit: string; image_key: string | null; stock_quantity: number;
  is_available: number; is_featured: number; is_on_offer: number; is_hidden: number;
}

const UNIT_SUGGESTIONS = ['per kg', 'per litre', 'per 100 g', 'per 250 g', 'per 500 g', 'per 200 g', 'per 150 g', 'per piece', 'per bunch'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp';

type Toast = { kind: 'ok' | 'error'; text: string } | null;

export default function ProductsTab() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);
  const [confirm, setConfirm] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [p, c] = await Promise.all([
        api<{ products: AdminProduct[] }>(`/admin/products${status ? `?status=${status}` : ''}`),
        api<{ categories: Category[] }>('/categories'),
      ]);
      setProducts(p.products);
      setCategories(c.categories);
    } catch (e) {
      setToast({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not load products.' });
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  useEffect(() => {
    const id = params.get('edit');
    if (id && products) {
      const found = products.find((p) => p.id === Number(id));
      if (found) setEditing(found);
      setParams({}, { replace: true });
    }
  }, [params, products, setParams]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const n = search.trim().toLowerCase();
    return n ? products.filter((p) => p.name.toLowerCase().includes(n) || p.slug.includes(n)) : products;
  }, [products, search]);

  async function toggle(product: AdminProduct, field: 'is_hidden' | 'is_featured' | 'is_on_offer' | 'is_available') {
    try {
      await api(`/admin/products/${product.id}`, {
        method: 'PUT',
        json: { ...toPayload(product), [field]: !product[field] },
      });
      setToast({ kind: 'ok', text: 'Product updated.' });
      load();
    } catch (e) {
      setToast({ kind: 'error', text: e instanceof ApiError ? e.message : 'Update failed.' });
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`/admin/products/${confirm.id}`, { method: 'DELETE' });
      setToast({ kind: 'ok', text: `"${confirm.name}" deleted.` });
      setConfirm(null);
      load();
    } catch (e) {
      setToast({ kind: 'error', text: e instanceof ApiError ? e.message : 'Delete failed.' });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add product</button>
      </div>

      {toast && <p className={`notice ${toast.kind === 'error' ? 'error' : 'ok'}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.text}</p>}

      <div className="toolbar">
        <input type="search" placeholder="Search by name or slug" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter products">
          <option value="">All products</option>
          <option value="hidden">Hidden only</option>
          <option value="low_stock">Low stock (≤5)</option>
        </select>
      </div>

      {products === null ? <p role="status">Loading products…</p> : filtered.length === 0 ? (
        <div className="empty-state"><p>No products found.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Price</th><th>Unit</th><th>Stock</th><th>Flags</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={p.is_hidden ? 'row-hidden' : ''}>
                  <td><strong>{p.name}</strong><div className="muted small">{p.slug}</div></td>
                  <td>{p.category_name}</td>
                  <td>{formatPaise(p.price_paise)}</td>
                  <td>{p.unit}</td>
                  <td className={p.stock_quantity <= 5 ? 'warn' : ''}>{p.stock_quantity}{!p.is_available && <div className="muted small">Unavailable</div>}</td>
                  <td className="flags">
                    {p.is_featured ? <span className="tag">Featured</span> : null}
                    {p.is_on_offer ? <span className="tag">Offer</span> : null}
                    {p.is_hidden ? <span className="tag muted-tag">Hidden</span> : null}
                  </td>
                  <td className="actions">
                    <button className="btn small" onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn small" onClick={() => toggle(p, 'is_hidden')}>{p.is_hidden ? 'Restore' : 'Hide'}</button>
                    <button className="btn small danger-outline" onClick={() => setConfirm(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setToast({ kind: 'ok', text: msg }); setEditing(null); load(); }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title="Delete product?"
          message={`"${confirm.name}" will be permanently removed, including its photo. Products that appear in past orders cannot be deleted; hide them instead.`}
          confirmLabel="Delete permanently"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function toPayload(p: AdminProduct) {
  return {
    name: p.name, slug: p.slug, description: p.description, category_id: p.category_id,
    price_paise: p.price_paise, unit: p.unit, stock_quantity: p.stock_quantity,
    is_available: !!p.is_available, is_featured: !!p.is_featured, is_on_offer: !!p.is_on_offer, is_hidden: !!p.is_hidden,
  };
}

function ProductModal(props: {
  product: AdminProduct | null; categories: Category[];
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const { product } = props;
  const [current, setCurrent] = useState<AdminProduct | null>(product);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    category_id: String(product?.category_id ?? props.categories[0]?.id ?? ''),
    price: product ? paiseToRupeesInput(product.price_paise) : '',
    unit: product?.unit ?? 'per kg',
    stock_quantity: String(product?.stock_quantity ?? 0),
    is_available: product ? !!product.is_available : true,
    is_featured: product ? !!product.is_featured : false,
    is_on_offer: product ? !!product.is_on_offer : false,
    is_hidden: product ? !!product.is_hidden : false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Use lowercase letters, numbers and hyphens';
    if (!form.category_id) e.category_id = 'Choose a category';
    if (Number.isNaN(rupeesToPaise(form.price))) e.price = 'Enter a price such as 150 or 65.50';
    if (form.unit.trim().length < 2) e.unit = 'Enter a unit such as "per kg"';
    if (!/^\d+$/.test(form.stock_quantity) || Number(form.stock_quantity) > 1_000_000) e.stock_quantity = 'Enter a whole number, 0 or more';
    return e;
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim(),
      category_id: Number(form.category_id),
      price_paise: rupeesToPaise(form.price),
      unit: form.unit.trim(),
      stock_quantity: Number(form.stock_quantity),
      is_available: form.is_available,
      is_featured: form.is_featured,
      is_on_offer: form.is_on_offer,
      is_hidden: form.is_hidden,
    };
    try {
      let saved: AdminProduct;
      if (current) {
        saved = (await api<{ product: AdminProduct }>(`/admin/products/${current.id}`, { method: 'PUT', json: payload })).product;
      } else {
        saved = (await api<{ product: AdminProduct }>('/admin/products', { method: 'POST', json: payload })).product;
      }
      setCurrent(saved);
      props.onSaved(current ? 'Product saved. Changes are live on the storefront.' : 'Product added. Changes are live on the storefront.');
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.details ?? {});
      setFormError(ae.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File | undefined) {
    setImageError('');
    if (!current) { setImageError('Save the product first, then add its photo.'); return; }
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { setImageError('Image must be 2 MB or smaller.'); return; }
    if (!ACCEPTED.split(',').includes(file.type)) { setImageError('Only JPG, PNG or WebP images are allowed.'); return; }
    setImageBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api<{ product: AdminProduct }>(`/admin/products/${current.id}/image`, { method: 'POST', body });
      setCurrent(res.product);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setImageBusy(false);
    }
  }

  async function deleteImageNow() {
    if (!current) return;
    setImageBusy(true);
    try {
      const res = await api<{ product: AdminProduct }>(`/admin/products/${current.id}/image`, { method: 'DELETE' });
      setCurrent(res.product);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'Could not remove image.');
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="page-head">
          <h2 id="product-modal-title">{current ? `Edit: ${current.name}` : 'Add product'}</h2>
          <button className="btn small" onClick={props.onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={save} noValidate className="product-form">
          <Field label="Name" id="p-name" value={form.name} error={errors.name} onChange={(v) => set('name', v)} />
          <Field label="URL slug (optional — generated from name)" id="p-slug" value={form.slug} error={errors.slug} onChange={(v) => set('slug', v.toLowerCase())} placeholder="e.g. farm-tomatoes" />
          <div className="form-group">
            <label htmlFor="p-cat">Category</label>
            <select id="p-cat" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} aria-invalid={!!errors.category_id}>
              {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.category_id && <span className="field-error">{errors.category_id}</span>}
          </div>
          <div className="two-col">
            <Field label="Price (₹)" id="p-price" inputMode="decimal" value={form.price} error={errors.price} onChange={(v) => set('price', v)} placeholder="e.g. 150 or 65.50" />
            <div className="form-group">
              <label htmlFor="p-unit">Unit</label>
              <input id="p-unit" list="unit-options" value={form.unit} onChange={(e) => set('unit', e.target.value)} aria-invalid={!!errors.unit} />
              <datalist id="unit-options">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
              {errors.unit && <span className="field-error">{errors.unit}</span>}
            </div>
          </div>
          <div className="two-col">
            <Field label="Stock quantity" id="p-stock" inputMode="numeric" value={form.stock_quantity} error={errors.stock_quantity} onChange={(v) => set('stock_quantity', v)} />
          </div>
          <div className="form-group">
            <label htmlFor="p-desc">Description</label>
            <textarea id="p-desc" rows={3} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <fieldset className="flags-fieldset">
            <legend>Visibility</legend>
            <Check label="Available to order" checked={form.is_available} onChange={(v) => set('is_available', v)} />
            <Check label="Featured on homepage" checked={form.is_featured} onChange={(v) => set('is_featured', v)} />
            <Check label="On offer" checked={form.is_on_offer} onChange={(v) => set('is_on_offer', v)} />
            <Check label="Hidden from storefront" checked={form.is_hidden} onChange={(v) => set('is_hidden', v)} />
          </fieldset>

          <fieldset className="image-fieldset">
            <legend>Photo</legend>
            {current?.image_key ? (
              <div className="image-current">
                <img src={`/api/images/${current.image_key}`} alt={`${current.name} current photo`} width={120} height={90} />
                <button type="button" className="btn small danger-outline" onClick={deleteImageNow} disabled={imageBusy}>Remove photo</button>
              </div>
            ) : (
              <p className="muted small">No photo yet — a placeholder is shown on the storefront.</p>
            )}
            <input type="file" accept={ACCEPTED} disabled={imageBusy || !current} onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} aria-label="Upload product photo" />
            <p className="muted small">JPG, PNG or WebP, up to 2 MB. Uploading a new photo replaces the old one.</p>
            {imageBusy && <p role="status">Uploading…</p>}
            {imageError && <p className="notice error" role="alert">{imageError}</p>}
          </fieldset>

          {formError && <p className="notice error" role="alert">{formError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={props.onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : current ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field(props: { label: string; id: string; value: string; error?: string; onChange: (v: string) => void; inputMode?: 'decimal' | 'numeric'; placeholder?: string }) {
  return (
    <div className="form-group">
      <label htmlFor={props.id}>{props.label}</label>
      <input id={props.id} value={props.value} inputMode={props.inputMode} placeholder={props.placeholder}
        aria-invalid={!!props.error} onChange={(e) => props.onChange(e.target.value)} />
      {props.error && <span className="field-error">{props.error}</span>}
    </div>
  );
}

function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} /> {props.label}
    </label>
  );
}
