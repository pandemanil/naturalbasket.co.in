import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { paiseToRupeesInput, rupeesToPaise } from '../lib/money';

export default function SettingsTab() {
  const [delivery, setDelivery] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [open, setOpen] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ settings: Record<string, string> }>('/admin/settings')
      .then((r) => {
        setDelivery(paiseToRupeesInput(Number(r.settings.delivery_charge_paise ?? 0)));
        setMinOrder(paiseToRupeesInput(Number(r.settings.min_order_paise ?? 0)));
        setOpen(r.settings.store_open !== '0');
      })
      .catch((e) => setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not load settings.' }))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (Number.isNaN(rupeesToPaise(delivery))) errs.delivery = 'Enter an amount such as 30 or 0';
    if (Number.isNaN(rupeesToPaise(minOrder))) errs.minOrder = 'Enter an amount such as 200 or 0';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setMessage(null);
    try {
      await api('/admin/settings', { method: 'PUT', json: {
        delivery_charge_paise: rupeesToPaise(delivery),
        min_order_paise: rupeesToPaise(minOrder),
        store_open: open,
      } });
      setMessage({ kind: 'ok', text: 'Settings saved.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Store settings</h1>
      {loading ? <p role="status">Loading…</p> : (
        <form className="panel narrow" onSubmit={save} noValidate>
          <div className="form-group">
            <label htmlFor="s-delivery">Delivery charge (₹)</label>
            <input id="s-delivery" inputMode="decimal" value={delivery} onChange={(e) => setDelivery(e.target.value)} aria-invalid={!!errors.delivery} />
            <span className="muted small">Enter 0 to say delivery is confirmed on chat.</span>
            {errors.delivery && <span className="field-error">{errors.delivery}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="s-min">Minimum order (₹)</label>
            <input id="s-min" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} aria-invalid={!!errors.minOrder} />
            <span className="muted small">Enter 0 for no minimum.</span>
            {errors.minOrder && <span className="field-error">{errors.minOrder}</span>}
          </div>
          <label className="check">
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Accepting orders
          </label>
          {message && <p className={`notice ${message.kind === 'error' ? 'error' : 'ok'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </form>
      )}
    </>
  );
}
