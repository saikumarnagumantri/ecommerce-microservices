import React, { useEffect, useState } from 'react';
import * as inventoryApi from '../api/inventory';
import * as productsApi from '../api/products';
import { InventoryRow } from '../api/types';
import { extractErrorMessage } from '../api/client';

const LOW_STOCK_THRESHOLD = 5;

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [inventory, products] = await Promise.all([
        inventoryApi.getInventory(),
        productsApi.getProducts({ limit: 100 }),
      ]);
      setRows(inventory);
      setNames(Object.fromEntries(products.data.map((p) => [p.id, p.name])));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load inventory'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRestock = async (productId: number) => {
    const quantity = Number(drafts[productId]);
    if (!quantity || quantity <= 0) return;
    setBusyId(productId);
    try {
      await inventoryApi.restock(productId, quantity);
      setDrafts((prev) => ({ ...prev, [productId]: '' }));
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not restock'));
    } finally {
      setBusyId(null);
    }
  };

  const onAdjust = async (productId: number, sign: 1 | -1) => {
    const raw = Number(drafts[productId]);
    if (!raw) return;
    setBusyId(productId);
    setError(null);
    try {
      await inventoryApi.adjustStock(productId, raw * sign);
      setDrafts((prev) => ({ ...prev, [productId]: '' }));
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not adjust stock'));
    } finally {
      setBusyId(null);
    }
  };

  const lowStockCount = rows.filter((r) => r.stock <= LOW_STOCK_THRESHOLD).length;

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Inventory</h1>
        {lowStockCount > 0 && <span className="pill pill-danger">{lowStockCount} low stock</span>}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>In stock</th>
              <th>Status</th>
              <th>Adjust quantity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={styles.empty}>Loading…</td></tr>
            ) : (
              rows.map((row) => {
                const isLow = row.stock <= LOW_STOCK_THRESHOLD;
                return (
                  <tr key={row.productId} style={isLow ? styles.lowRow : undefined}>
                    <td>{names[row.productId] ?? `Product #${row.productId}`}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{row.stock}</td>
                    <td>
                      <span className={`pill ${row.isAvailable ? (isLow ? 'pill-danger' : 'pill-ok') : 'pill-danger'}`}>
                        {row.isAvailable ? (isLow ? 'Low stock' : 'In stock') : 'Out of stock'}
                      </span>
                    </td>
                    <td>
                      <div style={styles.actionRow}>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          style={styles.qtyInput}
                          value={drafts[row.productId] ?? ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.productId]: e.target.value }))}
                        />
                        <button className="btn-secondary" style={styles.smallButton} disabled={busyId === row.productId} onClick={() => onRestock(row.productId)}>
                          Restock (+)
                        </button>
                        <button className="btn-ghost" style={styles.smallButton} disabled={busyId === row.productId} onClick={() => onAdjust(row.productId, -1)}>
                          Adjust (−)
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  empty: { textAlign: 'center', color: 'var(--muted)', padding: 24 },
  lowRow: { background: 'var(--danger-tint)' },
  actionRow: { display: 'flex', gap: 6, alignItems: 'center' },
  qtyInput: { width: 64, padding: '5px 8px' },
  smallButton: { fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' },
};
