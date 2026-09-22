import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { CartItem } from '../../api/types';
import { colors, radius, spacing } from '../../theme';

function CartRow({ item, onChangeQuantity, onRemove }: {
  item: CartItem;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {!item.isAvailable && <Text style={styles.unavailable}>Currently unavailable</Text>}
        <Text style={styles.rowPrice}>${item.price.toLocaleString()}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepperButton} onPress={() => onChangeQuantity(item.quantity - 1)}>
          <Text style={styles.stepperButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{item.quantity}</Text>
        <TouchableOpacity style={styles.stepperButton} onPress={() => onChangeQuantity(item.quantity + 1)}>
          <Text style={styles.stepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onRemove}>
        <Text style={styles.remove}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CartScreen() {
  const { cart, isLoading, refresh, setQuantity, removeItem } = useCart();
  const [busyProductId, setBusyProductId] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const onChangeQuantity = async (productId: number, quantity: number) => {
    setBusyProductId(productId);
    try {
      await setQuantity(productId, quantity);
    } finally {
      setBusyProductId(null);
    }
  };

  const onRemove = async (productId: number) => {
    setBusyProductId(productId);
    try {
      await removeItem(productId);
    } finally {
      setBusyProductId(null);
    }
  };

  if (isLoading && !cart) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const items = cart?.items ?? [];
  const hasUnavailable = items.some((i) => !i.isAvailable);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.productId)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
        renderItem={({ item }) => (
          <View>
            {busyProductId === item.productId && <ActivityIndicator style={styles.rowLoader} size="small" />}
            <CartRow
              item={item}
              onChangeQuantity={(q) => onChangeQuantity(item.productId, q)}
              onRemove={() => onRemove(item.productId)}
            />
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${(cart?.total ?? 0).toLocaleString()}</Text>
          </View>
          {hasUnavailable && <Text style={styles.warning}>Remove unavailable items to continue.</Text>}
          <TouchableOpacity
            style={[styles.checkoutButton, hasUnavailable && styles.checkoutButtonDisabled]}
            disabled={hasUnavailable}
            onPress={() => router.push('/checkout')}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
  rowLoader: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  unavailable: { fontSize: 11, color: colors.danger, marginTop: 2 },
  rowPrice: { fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  stepperButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  stepperButtonText: { fontSize: 16, color: colors.text },
  stepperValue: { minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  remove: { fontSize: 11, color: colors.danger, fontWeight: '600' },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.muted },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  warning: { fontSize: 12, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  checkoutButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  checkoutButtonDisabled: { backgroundColor: colors.chip },
  checkoutButtonText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
});
