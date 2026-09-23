import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as ordersApi from '../api/orders';
import { OrderStatus, OrderSummary } from '../api/types';
import { extractErrorMessage } from '../api/client';

const CONFIRMABLE: OrderStatus[] = ['PLACED'];

const STATUS_TABS: Array<{ value: OrderStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'PARTIALLY_DISPATCHED', label: 'Partially dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_PILL: Record<OrderStatus, string> = {
  PLACED: 'pill-neutral',
  CONFIRMED: 'pill-neutral',
  DISPATCHED: 'pill-neutral',
  PARTIALLY_DISPATCHED: 'pill-warning',
  DELIVERED: 'pill-ok',
  CANCELLED: 'pill-danger',
};

export default function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    ordersApi
      .getOrders({ status: status === 'ALL' ? undefined : status, limit: 50 })
      .then((result) => setOrders(result.data))
      .catch((err) => setError(extractErrorMessage(err, 'Could not load orders')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSelected(new Set());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const confirmableSelected = orders.filter((o) => selected.has(o.id) && CONFIRMABLE.includes(o.status));

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllConfirmable = () => {
    const confirmableIds = orders.filter((o) => CONFIRMABLE.includes(o.status)).map((o) => o.id);
    const allSelected = confirmableIds.length > 0 && confirmableIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(confirmableIds));
  };

  const onBulkConfirm = async () => {
    if (confirmableSelected.length === 0) return;
    setConfirming(true);
    setError(null);
    setBulkMessage(null);
    try {
      const result = await ordersApi.confirmOrdersBulk(confirmableSelected.map((o) => o.id));
      setBulkMessage(
        `Confirmed ${result.confirmed.length} order(s).` +
          (result.failed.length > 0 ? ` Failed: ${result.failed.map((f) => `#${f.orderId} (${f.error})`).join(', ')}` : ''),
      );
      setSelected(new Set());
      load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Bulk confirm failed'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Orders</h1>
        {confirmableSelected.length > 0 && (
          <button type="button" className="btn-primary" style={styles.bulkButton} disabled={confirming} onClick={onBulkConfirm}>
            {confirming ? 'Confirming…' : `Confirm ${confirmableSelected.length} selected`}
          </button>
        )}
      </div>

      <div style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={status === tab.value ? 'btn-primary' : 'btn-secondary'}
            style={styles.tab}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {bulkMessage && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{bulkMessage}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={orders.some((o) => CONFIRMABLE.includes(o.status)) && orders.filter((o) => CONFIRMABLE.includes(o.status)).every((o) => selected.has(o.id))}
                  onChange={toggleSelectAllConfirmable}
                  title="Select all confirmable orders"
                />
              </th>
              <th>Order</th>
              <th>Placed</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={styles.empty}>Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} style={styles.empty}>No orders in this view.</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!CONFIRMABLE.includes(o.status)}
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelected(o.id)}
                    />
                  </td>
                  <td>
                    <Link to={`/orders/${o.id}`} style={styles.link}>{o.orderCode}</Link>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${o.totalAmount.toLocaleString()}</td>
                  <td><span className={`pill ${STATUS_PILL[o.status]}`}>{o.status}</span></td>
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
  bulkButton: { fontSize: 13, padding: '9px 16px' },
  tabs: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  tab: { fontSize: 12, padding: '7px 14px' },
  empty: { textAlign: 'center', color: 'var(--muted)', padding: 24 },
  link: { color: 'var(--admin)', fontWeight: 700, textDecoration: 'none' },
};
