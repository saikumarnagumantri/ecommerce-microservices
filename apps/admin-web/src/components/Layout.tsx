import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/orders', label: 'Orders' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>SalesCart Admin</div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={styles.userBox}>
          <div style={styles.userName}>{user?.name}</div>
          <div style={styles.userEmail}>{user?.email}</div>
          <button className="btn-ghost" style={styles.logoutButton} onClick={logout}>Log out</button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
  },
  brand: { fontWeight: 800, fontSize: 16, marginBottom: 24, letterSpacing: '-0.01em' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navLink: {
    padding: '9px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--muted)',
    textDecoration: 'none',
  },
  navLinkActive: { background: 'var(--admin-tint)', color: 'var(--admin)' },
  userBox: { borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 },
  userName: { fontSize: 13, fontWeight: 700 },
  userEmail: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  logoutButton: { marginTop: 8, fontSize: 12, padding: 0 },
  main: { flex: 1, padding: '28px 32px', maxWidth: 1100, width: '100%' },
};
