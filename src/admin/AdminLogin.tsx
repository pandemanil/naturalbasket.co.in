import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/admin/login', { method: 'POST', json: { username, password } });
      setPassword('');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Try again.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="panel login-panel" onSubmit={submit}>
        <img src="/images/logo.webp" alt="Natural Basket" width={64} height={64} />
        <h1>Admin sign in</h1>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="btn primary full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
