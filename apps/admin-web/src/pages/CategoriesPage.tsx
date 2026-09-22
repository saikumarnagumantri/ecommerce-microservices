import React, { useEffect, useState } from 'react';
import * as categoriesApi from '../api/categories';
import { Category } from '../api/types';
import { extractErrorMessage } from '../api/client';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    categoriesApi
      .getCategories()
      .then(setCategories)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load categories')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await categoriesApi.createCategory({ name, parentId: parentId ? Number(parentId) : null });
      setName('');
      setParentId('');
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create this category'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    setError(null);
    try {
      await categoriesApi.deleteCategory(id);
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not delete this category — it may still have products in it'));
    }
  };

  const nameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <h1 style={styles.title}>Categories</h1>

      <form className="card" style={styles.formCard} onSubmit={onCreate}>
        <h2 style={styles.sectionHeading}>New category</h2>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={styles.label}>Parent category (optional)</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">None (top-level)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" style={styles.saveButton} disabled={saving || !name.trim()}>
          {saving ? 'Creating…' : 'Create category'}
        </button>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Parent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={styles.empty}>Loading…</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={3} style={styles.empty}>No categories yet.</td></tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.parentId ? nameById[c.parentId] ?? `#${c.parentId}` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn-ghost" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => onDelete(c.id)}>
                      Delete
                    </button>
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
  title: { fontSize: 22, fontWeight: 800, margin: '0 0 16px' },
  formCard: { padding: 20, marginBottom: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 12px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 },
  saveButton: { marginTop: 16, fontSize: 13, padding: '9px 20px' },
  empty: { textAlign: 'center', color: 'var(--muted)', padding: 24 },
};
