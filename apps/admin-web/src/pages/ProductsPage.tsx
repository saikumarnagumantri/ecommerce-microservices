import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as productsApi from '../api/products';
import { ProductSummary } from '../api/types';
import { extractErrorMessage } from '../api/client';
import BulkCreateModal from '../components/BulkCreateModal';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const load = () => {
    setLoading(true);
    productsApi
      .getProducts({ search: search || undefined, limit: 50 })
      .then((result) => setProducts(result.data))
      .catch((err) => setError(extractErrorMessage(err, 'Could not load products')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(load, 250); // debounce search
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Products</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" style={styles.newButton} onClick={() => setShowBulkModal(true)}>
            Bulk create
          </button>
          <Link to="/products/new" className="btn-primary" style={styles.newButton}>+ New product</Link>
        </div>
      </div>

      {showBulkModal && (
        <BulkCreateModal
          onClose={() => setShowBulkModal(false)}
          onDone={() => {
            setShowBulkModal(false);
            load();
          }}
        />
      )}

      <input
        style={styles.search}
        placeholder="Search by name or brand"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Brand</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={styles.empty}>Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} style={styles.empty}>No products found.</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/products/${p.id}`} style={styles.nameLink}>{p.name}</Link>
                  </td>
                  <td>{p.brand}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${p.discountPrice.toLocaleString()}
                    {p.discountPrice < p.originalPrice && (
                      <span style={styles.strike}>${p.originalPrice.toLocaleString()}</span>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${p.isAvailable ? 'pill-ok' : 'pill-danger'}`}>
                      {p.isAvailable ? 'In stock' : p.forceOutOfStock ? 'Out of stock (manual)' : 'Out of stock'}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${p.isActive ? 'pill-ok' : 'pill-neutral'}`}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  newButton: { textDecoration: 'none', fontSize: 13, padding: '9px 16px' },
  search: { maxWidth: 320, marginBottom: 16 },
  empty: { textAlign: 'center', color: 'var(--muted)', padding: 24 },
  nameLink: { color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' },
  strike: { color: 'var(--muted)', textDecoration: 'line-through', marginLeft: 6, fontSize: 12 },
};
