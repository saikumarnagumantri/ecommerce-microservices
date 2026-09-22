import React, { useState } from 'react';
import * as productsApi from '../api/products';
import { ProductInput } from '../api/products';
import { extractErrorMessage } from '../api/client';

const PLACEHOLDER = `[
  {
    "name": "Wireless Mouse",
    "description": "Ergonomic 2.4GHz wireless mouse.",
    "categoryId": 1,
    "brand": "TechNova",
    "originalPrice": 25,
    "discountPrice": 20,
    "initialStock": 50
  }
]`;

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function BulkCreateModal({ onClose, onDone }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdCount: number; failed: Array<{ index: number; error: string }> } | null>(null);

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    let products: ProductInput[];
    try {
      products = JSON.parse(text);
      if (!Array.isArray(products) || products.length === 0) {
        throw new Error('Expected a non-empty JSON array of products');
      }
    } catch (err) {
      setError(err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON');
      return;
    }

    setSaving(true);
    try {
      const response = await productsApi.createProductsBulk(products);
      setResult({ createdCount: response.created.length, failed: response.failed });
      if (response.failed.length === 0) {
        onDone();
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Bulk create failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.heading}>Bulk create products</h2>
        <p style={styles.hint}>
          Paste a JSON array of products (each with name, description, categoryId, brand, originalPrice,
          discountPrice, and optional initialStock). Each row is created independently, one initial
          inventory row per product.
        </p>
        <textarea
          style={styles.textarea}
          rows={12}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
        {result && (
          <p style={{ fontSize: 13, color: result.failed.length > 0 ? 'var(--danger)' : 'var(--ok)' }}>
            Created {result.createdCount} product(s).
            {result.failed.length > 0 && (
              <> Failed: {result.failed.map((f) => `#${f.index} (${f.error})`).join(', ')}</>
            )}
          </p>
        )}
        <div style={styles.actions}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={saving || !text.trim()} onClick={onSubmit}>
            {saving ? 'Creating…' : 'Create all'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: { width: 560, maxWidth: '90vw', padding: 24 },
  heading: { fontSize: 16, fontWeight: 800, margin: '0 0 8px' },
  hint: { fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 },
  textarea: { width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 10, boxSizing: 'border-box' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
};
