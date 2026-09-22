import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/products" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/products', { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message.includes('admin accounts') ? err.message : extractErrorMessage(err, 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={onSubmit}>
        <h1 style={styles.title}>SalesCart Admin</h1>
        <p style={styles.subtitle}>Sign in to manage products, inventory and orders.</p>

        <label style={styles.label} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@salescart.dev"
          autoFocus
        />

        <label style={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" className="btn-primary" style={styles.button} disabled={!email || !password || submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card: { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)', padding: 36, width: 360, display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  subtitle: { color: 'var(--muted)', fontSize: 13, margin: '4px 0 20px' },
  label: { fontSize: 12, color: 'var(--muted)', marginTop: 14, marginBottom: 6, fontWeight: 600 },
  error: { color: 'var(--danger)', fontSize: 13, marginTop: 14 },
  button: { marginTop: 24, padding: '10px 0', fontSize: 14 },
};
