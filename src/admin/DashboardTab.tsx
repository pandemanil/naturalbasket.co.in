import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { formatPaise } from '../lib/money';

interface Dashboard {
  counts: { total_products: number; live_products: number; hidden_products: number; pending_orders: number; orders_today: number };
  low_stock: Array<{ id: number; name: string; stock_quantity: number; unit: string }>;
  recent_orders: Array<{ id: number; order_number: string; status: string; customer_name: string; total_paise: number; created_at: string }>;
}

export default function DashboardTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Dashboard>('/admin/dashboard').then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load dashboard.'));
  }, []);
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!data) return <p role="status">Loading dashboard…</p>;
  const c = data.counts;
  return (
    <>
      <h1>Dashboard</h1>
      <div className="metrics">
        <Metric label="Products" value={c.total_products} />
        <Metric label="Live on site" value={c.live_products} />
        <Metric label="Hidden" value={c.hidden_products} />
        <Metric label="Orders today" value={c.orders_today} />
        <Metric label="Pending requests" value={c.pending_orders} />
        <Metric label="Low stock (≤5)" value={data.low_stock.length} />
      </div>
      <div className="two-col">
        <section className="panel">
          <h2>Low stock</h2>
          {data.low_stock.length === 0 ? <p className="muted">Everything is well stocked.</p> : (
            <ul>{data.low_stock.map((p) => <li key={p.id}><Link to={`/admin/products?edit=${p.id}`}>{p.name}</Link> — {p.stock_quantity} left ({p.unit})</li>)}</ul>
          )}
        </section>
        <section className="panel">
          <h2>Recent orders</h2>
          {data.recent_orders.length === 0 ? <p className="muted">No orders yet.</p> : (
            <ul>{data.recent_orders.map((o) => <li key={o.id}><Link to={`/admin/orders?open=${o.id}`}>{o.order_number}</Link> · {o.customer_name} · {formatPaise(o.total_paise)} · <em>{o.status.replace('_', ' ')}</em></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span className="muted small">{label}</span><strong>{value}</strong></div>;
}
