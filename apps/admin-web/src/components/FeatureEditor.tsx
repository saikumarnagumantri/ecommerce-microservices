import React, { useEffect, useState } from 'react';
import * as productsApi from '../api/products';
import { ProductFeature } from '../api/types';
import { extractErrorMessage } from '../api/client';

interface Props {
  productId: number;
  features: ProductFeature[];
  onSaved: () => void;
}

export default function FeatureEditor({ productId, features, onSaved }: Props) {
  const [rows, setRows] = useState<Array<{ label: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(features.map((f) => ({ label: f.label, value: f.value })));
  }, [features]);

  const updateRow = (index: number, field: 'label' | 'value', text: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: text } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { label: '', value: '' }]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const clean = rows.filter((r) => r.label.trim() && r.value.trim());
      await productsApi.replaceFeatures(productId, clean);
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save features'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={styles.rows}>
        {rows.map((row, i) => (
          <div key={i} style={styles.row}>
            <div style={styles.reorder}>
              <button type="button" className="btn-ghost" style={styles.reorderBtn} disabled={i === 0} onClick={() => moveRow(i, -1)}>▲</button>
              <button type="button" className="btn-ghost" style={styles.reorderBtn} disabled={i === rows.length - 1} onClick={() => moveRow(i, 1)}>▼</button>
            </div>
            <input placeholder="Label (e.g. Battery)" value={row.label} onChange={(e) => updateRow(i, 'label', e.target.value)} />
            <input placeholder="Value (e.g. Up to 14h)" value={row.value} onChange={(e) => updateRow(i, 'value', e.target.value)} />
            <button type="button" className="btn-ghost" style={styles.removeBtn} onClick={() => removeRow(i)}>✕</button>
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary" style={styles.addButton} onClick={addRow}>+ Add feature</button>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

      <button type="button" className="btn-primary" style={styles.saveButton} onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save features'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  rows: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'grid', gridTemplateColumns: '32px 1fr 1.3fr 28px', gap: 8, alignItems: 'center' },
  reorder: { display: 'flex', flexDirection: 'column', gap: 1 },
  reorderBtn: { padding: 0, fontSize: 9, lineHeight: '12px', background: 'transparent', color: 'var(--muted)' },
  removeBtn: { padding: 0, color: 'var(--danger)', fontSize: 13, background: 'transparent' },
  addButton: { marginTop: 10, fontSize: 12, padding: '6px 12px' },
  saveButton: { marginTop: 16, fontSize: 13 },
};
