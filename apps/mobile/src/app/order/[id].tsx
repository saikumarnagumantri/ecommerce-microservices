import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ordersApi from '../../api/orders';
import { OrderDetail } from '../../api/types';
import { extractErrorMessage } from '../../api/client';
import StatusTimeline from '../../components/StatusTimeline';
import { colors, radius, spacing } from '../../theme';

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: colors.muted,
  DISPATCHED: colors.success,
  UNAVAILABLE: colors.danger,
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    ordersApi
      .getOrder(orderId)
      .then(setOrder)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this order')));
  }, [orderId]);

  useFocusEffect(load);

  const canCancel = order?.status === 'PLACED' || order?.status === 'CONFIRMED';

  const onCancel = () => {
    Alert.alert('Cancel order?', 'This cannot be undone.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            setOrder(await ordersApi.cancelOrder(orderId));
          } catch (err) {
            Alert.alert('Could not cancel', extractErrorMessage(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.orderId}>{order.orderCode}</Text>
          <Text style={styles.orderSubId}>Internal #{order.id}</Text>
        </View>
        <Text style={styles.status}>{order.status}</Text>
      </View>

      <View style={styles.section}>
        <StatusTimeline status={order.status} events={order.events} />
      </View>

      {order.shipment && (
        <View style={styles.trackingBox}>
          <Text style={styles.sectionHeading}>Tracking</Text>
          <Text style={styles.trackingNumber}>{order.shipment.trackingNumber}</Text>
          <Text style={styles.trackingCarrier}>Carrier: {order.shipment.carrier}</Text>
          {order.shipment.isPartial && (
            <Text style={[styles.trackingCarrier, { color: colors.danger, marginTop: 4 }]}>
              Partial dispatch — {order.shipment.reason}: {order.shipment.comment}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.sectionHeading}>Items</Text>
      {order.items.map((item) => {
        const showPill = order.status !== 'PLACED' && order.status !== 'CONFIRMED';
        return (
          <View key={item.productId} style={styles.itemRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name} × {item.quantity}</Text>
              {showPill && (
                <Text style={[styles.itemStatus, { color: ITEM_STATUS_COLORS[item.dispatchStatus] }]}>{item.dispatchStatus}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>${(item.price * item.quantity).toLocaleString()}</Text>
          </View>
        );
      })}
      <View style={[styles.itemRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>${order.totalAmount.toLocaleString()}</Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemName}>Payment</Text>
        <Text style={styles.itemPrice}>{order.paymentMethod === 'COD' ? 'Cash on delivery' : order.paymentMethod}</Text>
      </View>

      <Text style={styles.sectionHeading}>Delivery address</Text>
      <Text style={styles.addressText}>
        {order.shippingAddress.line1}
        {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
        {'\n'}{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
        {'\n'}{order.shippingAddress.country}
      </Text>

      {canCancel && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={cancelling}>
          {cancelling ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.cancelButtonText}>Cancel order</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  orderId: { fontSize: 18, fontWeight: '800', color: colors.text },
  orderSubId: { fontSize: 11, color: colors.muted, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  section: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  trackingBox: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  sectionHeading: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  trackingNumber: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  trackingCarrier: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  itemName: { flex: 1, fontSize: 13, color: colors.text, marginRight: spacing.sm },
  itemStatus: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase' },
  itemPrice: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm, marginBottom: spacing.lg },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  addressText: { fontSize: 13, color: colors.text, lineHeight: 20, marginBottom: spacing.lg },
  cancelButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  cancelButtonText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
