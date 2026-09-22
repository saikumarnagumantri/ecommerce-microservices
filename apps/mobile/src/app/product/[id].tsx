import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as productsApi from '../../api/products';
import { ProductDetail } from '../../api/types';
import { extractErrorMessage } from '../../api/client';
import { useCart } from '../../context/CartContext';
import MediaCarousel from '../../components/MediaCarousel';
import FeatureTable from '../../components/FeatureTable';
import { colors, radius, spacing } from '../../theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  useEffect(() => {
    productsApi
      .getProduct(productId)
      .then(setProduct)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this product')));
  }, [productId]);

  const onAddToCart = async () => {
    setAdding(true);
    setAddedMessage(null);
    try {
      const { wasCapped } = await addItem(productId, 1);
      setAddedMessage(wasCapped ? 'Added — quantity limited by available stock.' : 'Added to cart.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not add this to your cart'));
    } finally {
      setAdding(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const hasDiscount = product.discountPrice < product.originalPrice;

  return (
    <View style={styles.container}>
      <ScrollView>
        <MediaCarousel media={product.media} />

        <View style={styles.body}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>${product.discountPrice.toLocaleString()}</Text>
            {hasDiscount && <Text style={styles.originalPrice}>${product.originalPrice.toLocaleString()}</Text>}
            <View style={[styles.stockPill, product.isAvailable ? styles.stockPillOk : styles.stockPillBad]}>
              <Text style={[styles.stockPillText, product.isAvailable ? styles.stockOkText : styles.stockBadText]}>
                {product.isAvailable ? `In stock · ${product.stock}` : 'Out of stock'}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {/* The feature table sits directly below the media it describes, not buried under a separate tab. */}
          <FeatureTable features={product.features} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {addedMessage && <Text style={styles.addedMessage}>{addedMessage}</Text>}
        <TouchableOpacity
          style={[styles.addButton, (!product.isAvailable || adding) && styles.addButtonDisabled]}
          disabled={!product.isAvailable || adding}
          onPress={onAddToCart}
        >
          {adding ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.addButtonText}>{product.isAvailable ? 'Add to cart' : 'Out of stock'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.danger, textAlign: 'center' },
  body: { padding: spacing.lg },
  brand: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  price: { fontSize: 20, fontWeight: '800', color: colors.text },
  originalPrice: { fontSize: 14, color: colors.muted, textDecorationLine: 'line-through' },
  stockPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999, marginLeft: 'auto' },
  stockPillOk: { backgroundColor: '#E4F3EB' },
  stockPillBad: { backgroundColor: '#F8E8E7' },
  stockPillText: { fontSize: 11, fontWeight: '700' },
  stockOkText: { color: colors.success },
  stockBadText: { color: colors.danger },
  description: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: spacing.lg },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  addedMessage: { fontSize: 12, color: colors.success, textAlign: 'center', marginBottom: spacing.sm },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  addButtonDisabled: { backgroundColor: colors.chip },
  addButtonText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
});
