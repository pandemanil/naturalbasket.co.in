import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import DashboardTab from './DashboardTab';
import ProductsTab from './ProductsTab';
import OrdersTab from './OrdersTab';
import SettingsTab from './SettingsTab';

/** Client-side guard only for UX. Every admin API call is independently protected on the server. */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [username, setUsername] = useState('');

  useEffect(() => {
    api<{ authenticated: boolean; username: string | null }>('/admin/me')
      .then((r) => {
        if (r.authenticated) { setUsername(r.username ?? ''); setState('ok'); }
        else { setState('denied'); navigate('/admin/login', { replace: true }); }
      })
      .catch(() => { setState('denied'); navigate('/admin/login', { replace: true }); });
  }, [navigate]);

  async function logout() {
    await api('/admin/logout', { method: 'POST' }).catch(() => {});
    navigate('/admin/login', { replace: true });
  }

  if (state !== 'ok') return <p className="admin-loading" role="status">Checking your session…</p>;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to="/admin" className="brand"><img src="/images/logo.webp" alt="" width={36} height={36} /><span>Admin</span></Link>
        <nav aria-label="Admin">
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
          <Link to="/" target="_blank" rel="noopener noreferrer">View site</Link>
        </nav>
        <div className="admin-user">
          <span className="muted small">{username}</span>
          <button className="btn small" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="admin-main">
        <Routes>
          <Route index element={<DashboardTab />} />
          <Route path="products" element={<ProductsTab />} />
          <Route path="orders" element={<OrdersTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Routes>
      </main>
    </div>
  );
}
