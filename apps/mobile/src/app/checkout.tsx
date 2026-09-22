import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as addressesApi from '../api/addresses';
import * as ordersApi from '../api/orders';
import { Address } from '../api/types';
import { extractErrorMessage } from '../api/client';
import { useCart } from '../context/CartContext';
import { colors, radius, spacing } from '../theme';

export default function CheckoutScreen() {
  const { cart, clear } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ line1: '', city: '', state: '', postalCode: '', country: 'India' });
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = async () => {
    const list = await addressesApi.listAddresses();
    setAddresses(list);
    const preferred = list.find((a) => a.isDefault) ?? list[0];
    setSelectedId(preferred?.id ?? null);
    setShowNewAddress(list.length === 0);
  };

  useEffect(() => {
    loadAddresses()
      .catch((err) => setError(extractErrorMessage(err, 'Could not load your addresses')))
      .finally(() => setLoadingAddresses(false));
  }, []);

  const onAddAddress = async () => {
    setError(null);
    try {
      const created = await addressesApi.addAddress(newAddress);
      await loadAddresses();
      setSelectedId(created.id);
      setShowNewAddress(false);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save that address'));
    }
  };

  const onPlaceOrder = async () => {
    if (!selectedId) return;
    setPlacing(true);
    setError(null);
    try {
      const order = await ordersApi.placeOrder(selectedId);
      await clear();
      router.replace(`/order/${order.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not place your order'));
    } finally {
      setPlacing(false);
    }
  };

  if (loadingAddresses) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Deliver to</Text>
      {addresses.map((a) => (
        <TouchableOpacity key={a.id} style={styles.addressCard} onPress={() => { setSelectedId(a.id); setShowNewAddress(false); }}>
          <View style={[styles.radio, selectedId === a.id && !showNewAddress && styles.radioSelected]} />
          <View style={styles.addressText}>
            <Text style={styles.addressLine}>{a.line1}{a.isDefault ? ' · Default' : ''}</Text>
            <Text style={styles.addressSub}>{a.city}, {a.state} {a.postalCode}, {a.country}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addNewToggle} onPress={() => setShowNewAddress((v) => !v)}>
        <Text style={styles.addNewText}>{showNewAddress ? 'Cancel' : '+ Add new address'}</Text>
      </TouchableOpacity>

      {showNewAddress && (
        <View style={styles.newAddressForm}>
          <TextInput style={styles.input} placeholder="Address line" value={newAddress.line1} onChangeText={(v) => setNewAddress((s) => ({ ...s, line1: v }))} />
          <TextInput style={styles.input} placeholder="City" value={newAddress.city} onChangeText={(v) => setNewAddress((s) => ({ ...s, city: v }))} />
          <TextInput style={styles.input} placeholder="State" value={newAddress.state} onChangeText={(v) => setNewAddress((s) => ({ ...s, state: v }))} />
          <TextInput style={styles.input} placeholder="Postal code" value={newAddress.postalCode} onChangeText={(v) => setNewAddress((s) => ({ ...s, postalCode: v }))} />
          <TextInput style={styles.input} placeholder="Country" value={newAddress.country} onChangeText={(v) => setNewAddress((s) => ({ ...s, country: v }))} />
          <TouchableOpacity
            style={styles.saveAddressButton}
            disabled={!newAddress.line1 || !newAddress.city || !newAddress.state || !newAddress.postalCode}
            onPress={onAddAddress}
          >
            <Text style={styles.saveAddressButtonText}>Save address</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.heading}>Payment</Text>
      <View style={styles.paymentRow}>
        <View style={[styles.radio, styles.radioSelected]} />
        <Text style={styles.paymentText}>Cash on delivery</Text>
      </View>
      <Text style={styles.paymentHint}>More payment options coming soon.</Text>

      <Text style={styles.heading}>Order summary</Text>
      {(cart?.items ?? []).map((i) => (
        <View key={i.productId} style={styles.summaryRow}>
          <Text style={styles.summaryName} numberOfLines={1}>{i.name} × {i.quantity}</Text>
          <Text style={styles.summaryPrice}>${i.subtotal.toLocaleString()}</Text>
        </View>
      ))}
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>${(cart?.total ?? 0).toLocaleString()}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.placeButton, (!selectedId || placing) && styles.placeButtonDisabled]}
        disabled={!selectedId || placing}
        onPress={onPlaceOrder}
      >
        {placing ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.placeButtonText}>Place order</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  addressText: { flex: 1 },
  addressLine: { fontSize: 14, fontWeight: '600', color: colors.text },
  addressSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  addNewToggle: { paddingVertical: spacing.sm },
  addNewText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  newAddressForm: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14 },
  saveAddressButton: { backgroundColor: colors.text, borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  saveAddressButtonText: { color: colors.surface, fontWeight: '700', fontSize: 13 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
  paymentText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  paymentHint: { fontSize: 11, color: colors.muted, marginTop: spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  summaryName: { flex: 1, fontSize: 13, color: colors.text, marginRight: spacing.sm },
  summaryPrice: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.lg },
  placeButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  placeButtonDisabled: { backgroundColor: colors.chip },
  placeButtonText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
});
