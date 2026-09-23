import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as ordersApi from '../api/orders';
import { CancelReason, ItemDispatchStatus, OrderDetail, OrderStatus, PartialDispatchReason } from '../api/types';
import { extractErrorMessage } from '../api/client';

const STATUS_PILL: Record<OrderStatus, string> = {
  PLACED: 'pill-neutral',
  CONFIRMED: 'pill-neutral',
  DISPATCHED: 'pill-neutral',
  PARTIALLY_DISPATCHED: 'pill-warning',
  DELIVERED: 'pill-ok',
  CANCELLED: 'pill-danger',
};

const ITEM_STATUS_PILL: Record<ItemDispatchStatus, string> = {
  PENDING: 'pill-neutral',
  DISPATCHED: 'pill-ok',
  UNAVAILABLE: 'pill-danger',
};

const PARTIAL_DISPATCH_REASONS: Array<{ value: PartialDispatchReason; label: string }> = [
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'ITEM_DAMAGED', label: 'Item damaged' },
  { value: 'ITEM_DISCONTINUED', label: 'Item discontinued' },
  { value: 'COURIER_LIMIT', label: 'Courier weight/size limit' },
  { value: 'OTHER', label: 'Other' },
];

const CANCEL_REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: 'CUSTOMER_REQUESTED', label: 'Customer requested' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'DUPLICATE_ORDER', label: 'Duplicate order' },
  { value: 'SUSPECTED_FRAUD', label: 'Suspected fraud' },
  { value: 'UNDELIVERABLE_ADDRESS', label: 'Undeliverable address' },
  { value: 'OTHER', label: 'Other' },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchSelected, setDispatchSelected] = useState<Set<number>>(new Set());
  const [dispatchReason, setDispatchReason] = useState<PartialDispatchReason | ''>('');
  const [dispatchComment, setDispatchComment] = useState('');
  const [cancelReason, setCancelReason] = useState<CancelReason | ''>('');
  const [cancelComment, setCancelComment] = useState('');

  const load = () => {
    ordersApi
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        setDispatchSelected(new Set(o.items.map((i) => i.productId)));
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this order')));
  };

  useEffect(load, [orderId]);

  const runAction = async (action: () => Promise<OrderDetail>) => {
    setBusy(true);
    setError(null);
    try {
      setOrder(await action());
    } catch (err) {
      setError(extractErrorMessage(err, 'That action could not be completed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleDispatchItem = (productId: number) => {
    setDispatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  if (error && !order) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }
  if (!order) {
    return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  }

  const isPartialSelection = dispatchSelected.size > 0 && dispatchSelected.size < order.items.length;
  const dispatchDisabled =
    busy || !carrier || !trackingNumber || dispatchSelected.size === 0 ||
    (isPartialSelection && (!dispatchReason || !dispatchComment));
  const showItemPills = order.status !== 'PLACED' && order.status !== 'CONFIRMED';

  return (
    <div>
      <button className="btn-ghost" style={{ padding: 0, marginBottom: 12, fontSize: 12 }} onClick={() => navigate('/orders')}>← Back to orders</button>

      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>{order.orderCode}</h1>
          <p style={styles.subId}>Internal #{order.id} · {order.publicId}</p>
        </div>
        <span className={`pill ${STATUS_PILL[order.status]}`}>{order.status}</span>
      </div>

      <div style={styles.columns}>
        <div className="card" style={styles.card}>
          <h2 style={styles.sectionHeading}>Items</h2>
          {order.items.map((item) => (
            <div key={item.productId} style={styles.itemRow}>
              <span>
                {item.name} × {item.quantity}
                {showItemPills && (
                  <span className={`pill ${ITEM_STATUS_PILL[item.dispatchStatus]}`} style={{ marginLeft: 8 }}>
                    {item.dispatchStatus}
                  </span>
                )}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{'₹'}{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ ...styles.itemRow, ...styles.totalRow }}>
            <strong>Total</strong>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{'₹'}{order.totalAmount.toLocaleString()}</strong>
          </div>
          <div style={styles.itemRow}>
            <span style={{ color: 'var(--muted)' }}>Payment</span>
            <span>{order.paymentMethod === 'COD' ? 'Cash on delivery' : order.paymentMethod}</span>
          </div>

          <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Ship to</h2>
          <p style={styles.address}>
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
            {order.shippingAddress.country}
          </p>

          <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Timeline</h2>
          {order.events.map((e, i) => (
            <div key={i} style={styles.eventRow}>
              <span style={styles.eventStatus}>{e.status}</span>
              <span style={styles.eventDate}>{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}

          {order.shipment && (
            <>
              <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Tracking</h2>
              <p style={styles.address}>{order.shipment.carrier} · {order.shipment.trackingNumber}</p>
              {order.shipment.isPartial && (
                <p style={{ ...styles.address, color: 'var(--danger)', marginTop: 6 }}>
                  Partial dispatch — {order.shipment.reason}: {order.shipment.comment}
                </p>
              )}
            </>
          )}
        </div>

        <div className="card" style={styles.actionsCard}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

          {order.status === 'PLACED' && (
            <button className="btn-primary" style={styles.actionButton} disabled={busy} onClick={() => runAction(() => ordersApi.confirmOrder(order.id))}>
              Confirm order
            </button>
          )}

          {order.status === 'CONFIRMED' && (
            <div>
              <label style={styles.label}>Carrier</label>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="BlueDart" />
              <label style={styles.label}>Tracking number</label>
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="BD48217730IN" />

              <label style={styles.label}>Items to dispatch now</label>
              {order.items.map((item) => (
                <label key={item.productId} style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={dispatchSelected.has(item.productId)}
                    onChange={() => toggleDispatchItem(item.productId)}
                  />
                  {item.name} × {item.quantity}
                </label>
              ))}

              {isPartialSelection && (
                <>
                  <label style={styles.label}>Reason held-back items aren't shipping</label>
                  <select value={dispatchReason} onChange={(e) => setDispatchReason(e.target.value as PartialDispatchReason)}>
                    <option value="">Select a reason…</option>
                    {PARTIAL_DISPATCH_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <label style={styles.label}>Comment</label>
                  <textarea value={dispatchComment} onChange={(e) => setDispatchComment(e.target.value)} rows={2} />
                </>
              )}

              <button
                className="btn-primary"
                style={styles.actionButton}
                disabled={dispatchDisabled}
                onClick={() =>
                  runAction(() =>
                    ordersApi.dispatchOrder(
                      order.id,
                      carrier,
                      trackingNumber,
                      Array.from(dispatchSelected),
                      isPartialSelection ? (dispatchReason as PartialDispatchReason) : undefined,
                      isPartialSelection ? dispatchComment : undefined,
                    ),
                  )
                }
              >
                {isPartialSelection
                  ? `Dispatch partially (${dispatchSelected.size} of ${order.items.length} items)`
                  : 'Dispatch (all items)'}
              </button>
            </div>
          )}

          {(order.status === 'DISPATCHED' || order.status === 'PARTIALLY_DISPATCHED') && (
            <button className="btn-primary" style={styles.actionButton} disabled={busy} onClick={() => runAction(() => ordersApi.deliverOrder(order.id))}>
              Mark delivered
            </button>
          )}

          {(order.status === 'PLACED' || order.status === 'CONFIRMED') && (
            <div>
              <label style={styles.label}>Cancellation reason</label>
              <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value as CancelReason)}>
                <option value="">Select a reason…</option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <label style={styles.label}>Comment</label>
              <textarea value={cancelComment} onChange={(e) => setCancelComment(e.target.value)} rows={2} />
              <button
                className="btn-danger"
                style={styles.actionButton}
                disabled={busy || !cancelReason || !cancelComment}
                onClick={() => runAction(() => ordersApi.cancelOrder(order.id, cancelReason as CancelReason, cancelComment))}
              >
                Cancel order
              </button>
            </div>
          )}

          {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No further actions — this order is {order.status.toLowerCase()}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 800, margin: 0 },
  subId: { fontSize: 11, color: 'var(--muted)', margin: '2px 0 0', fontFamily: 'monospace' },
  columns: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' },
  card: { padding: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 10px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 },
  totalRow: { borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8 },
  address: { fontSize: 13, lineHeight: 1.6, margin: 0 },
  eventRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dotted var(--line)' },
  eventStatus: { fontWeight: 600 },
  eventDate: { color: 'var(--muted)' },
  actionsCard: { padding: 20, background: 'var(--admin-tint)', border: '1px solid var(--admin)' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 10, marginBottom: 4 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' },
  actionButton: { width: '100%', marginTop: 14, padding: '9px 0', fontSize: 13 },
};
