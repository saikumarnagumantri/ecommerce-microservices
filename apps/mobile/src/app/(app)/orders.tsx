import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as ordersApi from '../../api/orders';
import { OrderSummary } from '../../api/types';
import { extractErrorMessage } from '../../api/client';
import { useOrdersBadge } from '../../context/OrdersContext';
import { colors, radius, spacing } from '../../theme';

const STATUS_COLORS: Record<string, string> = {
  PLACED: colors.primary,
  CONFIRMED: colors.primary,
  DISPATCHED: colors.primary,
  PARTIALLY_DISPATCHED: colors.primary,
  DELIVERED: colors.success,
  CANCELLED: colors.danger,
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refresh: refreshOrdersBadge } = useOrdersBadge();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      ordersApi
        .getOrders()
        .then((result) => { if (!cancelled) setOrders(result.data); })
        .catch((err) => { if (!cancelled) setError(extractErrorMessage(err, 'Could not load your orders')); })
        .finally(() => { if (!cancelled) setLoading(false); });
      void refreshOrdersBadge();
      return () => { cancelled = true; };
    }, [refreshOrdersBadge]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      ListEmptyComponent={<Text style={styles.empty}>You haven't placed any orders yet.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
          <View>
            <Text style={styles.orderId}>{item.orderCode}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.amount}>${item.totalAmount.toLocaleString()}</Text>
            <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger },
  list: { padding: spacing.md },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.text },
  date: { fontSize: 12, color: colors.muted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text },
  status: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
