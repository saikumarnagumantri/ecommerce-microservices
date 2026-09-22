import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as productsApi from '../api/products';
import { Category, ProductDetail } from '../api/types';
import { extractErrorMessage } from '../api/client';
import FeatureEditor from '../components/FeatureEditor';
import MediaManager from '../components/MediaManager';

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  originalPrice: string;
  discountPrice: string;
  initialStock: string;
}

const EMPTY_FORM: FormState = { name: '', description: '', categoryId: '', brand: '', originalPrice: '', discountPrice: '', initialStock: '0' };

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const productId = id ? Number(id) : null;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  const loadProduct = () => {
    if (!productId) return;
    productsApi
      .getProduct(productId)
      .then((p) => {
        setProduct(p);
        setForm({
          name: p.name,
          description: p.description,
          categoryId: String(p.categoryId),
          brand: p.brand,
          originalPrice: String(p.originalPrice),
          discountPrice: String(p.discountPrice),
          initialStock: '0',
        });
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this product')))
      .finally(() => setLoading(false));
  };

  useEffect(loadProduct, [productId]);

  const update = (field: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      categoryId: Number(form.categoryId),
      brand: form.brand,
      originalPrice: Number(form.originalPrice),
      discountPrice: Number(form.discountPrice),
    };
    try {
      if (isNew) {
        const created = await productsApi.createProduct({ ...payload, initialStock: Number(form.initialStock) || 0 });
        navigate(`/products/${created.id}`, { replace: true });
      } else if (productId) {
        const updated = await productsApi.updateProduct(productId, payload);
        setProduct(updated);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save this product'));
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async () => {
    if (!productId || !product) return;
    const updated = await productsApi.updateProduct(productId, { isActive: !product.isActive });
    setProduct(updated);
  };

  const onToggleForceOutOfStock = async () => {
    if (!productId || !product) return;
    const updated = await productsApi.updateProduct(productId, { forceOutOfStock: !product.forceOutOfStock });
    setProduct(updated);
  };

  if (loading) {
    return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  }

  const priceInvalid = Number(form.discountPrice) > Number(form.originalPrice) && form.originalPrice !== '' && form.discountPrice !== '';

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>{isNew ? 'New product' : `Edit · ${product?.name}`}</h1>
        {!isNew && product && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={product.forceOutOfStock ? 'btn-danger' : 'btn-secondary'} onClick={onToggleForceOutOfStock}>
              {product.forceOutOfStock ? 'Unmark out of stock' : 'Mark out of stock'}
            </button>
            <button type="button" className={product.isActive ? 'btn-danger' : 'btn-secondary'} onClick={onToggleActive}>
              {product.isActive ? 'Hide product' : 'Reactivate'}
            </button>
          </div>
        )}
      </div>

      <div style={styles.columns}>
        <form className="card" style={styles.formCard} onSubmit={onSubmit}>
          <h2 style={styles.sectionHeading}>Details</h2>

          <label style={styles.label}>Name</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />

          <label style={styles.label}>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} required />

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Category</label>
              <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)} required>
                <option value="" disabled>Choose one</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Brand</label>
              <input value={form.brand} onChange={(e) => update('brand', e.target.value)} required />
            </div>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Original price</label>
              <input type="number" min="0" value={form.originalPrice} onChange={(e) => update('originalPrice', e.target.value)} required />
            </div>
            <div>
              <label style={styles.label}>Discount price</label>
              <input type="number" min="0" value={form.discountPrice} onChange={(e) => update('discountPrice', e.target.value)} required />
            </div>
          </div>
          {priceInvalid && <p style={styles.warning}>Discount price cannot exceed the original price.</p>}

          {isNew && (
            <>
              <label style={styles.label}>Initial stock</label>
              <input type="number" min="0" value={form.initialStock} onChange={(e) => update('initialStock', e.target.value)} />
            </>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

          <button type="submit" className="btn-primary" style={styles.saveButton} disabled={saving || priceInvalid}>
            {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </button>
        </form>

        {!isNew && product && (
          <div style={styles.sideColumn}>
            <div className="card" style={styles.sideCard}>
              <h2 style={styles.sectionHeading}>Features</h2>
              <FeatureEditor productId={product.id} features={product.features} onSaved={loadProduct} />
            </div>
            <div className="card" style={styles.sideCard}>
              <h2 style={styles.sectionHeading}>Media</h2>
              <MediaManager productId={product.id} media={product.media} onChanged={loadProduct} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 800, margin: 0 },
  columns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  formCard: { padding: 20, display: 'flex', flexDirection: 'column' },
  sideColumn: { display: 'flex', flexDirection: 'column', gap: 20 },
  sideCard: { padding: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 12px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 12, marginBottom: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  warning: { color: 'var(--danger)', fontSize: 12, marginTop: 6 },
  saveButton: { marginTop: 20, fontSize: 13, alignSelf: 'flex-start', padding: '9px 20px' },
};
