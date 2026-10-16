import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { formatPaise } from '../lib/money';

const STATUSES = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];
const NEXT: Record<Status, Status[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
const LABEL: Record<Status, string> = {
  pending: 'Pending', confirmed: 'Confirmed', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};

interface OrderRow {
  id: number; order_number: string; status: Status; customer_name: string; mobile: string;
  address: string; city: string; pincode: string; notes: string;
  subtotal_paise: number; delivery_paise: number; total_paise: number; created_at: string;
}
interface OrderItem { product_name: string; unit: string; quantity: number; unit_price_paise: number; line_total_paise: number }

export default function OrdersTab() {
  const [filter, setFilter] = useState<'' | Status>('');
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ order: OrderRow; items: OrderItem[] } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ orders: OrderRow[] }>(`/admin/orders${filter ? `?status=${filter}` : ''}`)
    .then((r) => setOrders(r.orders))
    .catch((e) => setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not load orders.' }));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  useEffect(() => {
    if (open === null) { setDetail(null); return; }
    api<{ order: OrderRow; items: OrderItem[] }>(`/admin/orders/${open}`).then(setDetail).catch(() => setDetail(null));
  }, [open]);

  async function setStatus(id: number, status: Status) {
    setBusy(true);
    try {
      await api(`/admin/orders/${id}`, { method: 'PATCH', json: { status } });
      setMessage({ kind: 'ok', text: `Order moved to "${LABEL[status]}".` });
      await load();
      setOpen(id); // refresh detail
      setDetail(null);
      api<{ order: OrderRow; items: OrderItem[] }>(`/admin/orders/${id}`).then(setDetail);
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Status update failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head"><h1>Orders</h1></div>
      <p className="muted small">Orders are <strong>requests</strong> until you confirm them. Payment is not collected here, so no order is marked as paid.</p>
      {message && <p className={`notice ${message.kind === 'error' ? 'error' : 'ok'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as '' | Status)} aria-label="Filter orders by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>
      {orders === null ? <p role="status">Loading orders…</p> : orders.length === 0 ? <div className="empty-state"><p>No orders yet.</p></div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Placed</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.order_number}</strong></td>
                  <td>{o.customer_name}<div className="muted small">{o.mobile}</div></td>
                  <td>{formatPaise(o.total_paise)}</td>
                  <td><span className={`status status-${o.status}`}>{LABEL[o.status]}</span></td>
                  <td className="small">{new Date(o.created_at + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  <td><button className="btn small" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Close' : 'View'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open !== null && detail && (
        <section className="panel order-detail" aria-label="Order details">
          <h2>{detail.order.order_number}</h2>
          <p><strong>{detail.order.customer_name}</strong> · {detail.order.mobile}<br />{detail.order.address}, {detail.order.city} – {detail.order.pincode}</p>
          {detail.order.notes && <p><em>Notes:</em> {detail.order.notes}</p>}
          <ul>{detail.items.map((i, idx) => <li key={idx}>{i.product_name} ({i.unit}) × {i.quantity} — {formatPaise(i.line_total_paise)}</li>)}</ul>
          <p>Subtotal {formatPaise(detail.order.subtotal_paise)} · Delivery {formatPaise(detail.order.delivery_paise)} · <strong>Total {formatPaise(detail.order.total_paise)}</strong></p>
          <div className="actions">
            {NEXT[detail.order.status].length === 0 && <span className="muted">No further status changes.</span>}
            {NEXT[detail.order.status].map((s) => (
              <button key={s} className={s === 'cancelled' ? 'btn danger-outline small' : 'btn primary small'} disabled={busy}
                onClick={() => setStatus(detail.order.id, s)}>
                Mark {LABEL[s]}
              </button>
            ))}
          </div>
          {detail.order.status !== 'cancelled' && <p className="muted small">Cancelling returns the ordered quantities to stock.</p>}
        </section>
      )}
    </>
  );
}
