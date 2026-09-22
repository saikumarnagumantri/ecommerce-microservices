import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProductSummary } from '../api/types';
import { colors, radius, spacing } from '../theme';

interface Props {
  product: ProductSummary;
  onPress: () => void;
}

export default function ProductCard({ product, onPress }: Props) {
  const hasDiscount = product.discountPrice < product.originalPrice;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageWrap}>
        {product.primaryImageUrl ? (
          <Image source={{ uri: product.primaryImageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {!product.isAvailable && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Out of stock</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.brand}>{product.brand}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>${product.discountPrice.toLocaleString()}</Text>
        {hasDiscount && <Text style={styles.originalPrice}>${product.originalPrice.toLocaleString()}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, margin: spacing.xs },
  imageWrap: { aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.chip },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: colors.chip },
  badge: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { color: colors.surface, fontSize: 10, fontWeight: '600' },
  name: { marginTop: spacing.sm, fontSize: 13, fontWeight: '600', color: colors.text },
  brand: { fontSize: 11, color: colors.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xs },
  price: { fontSize: 14, fontWeight: '700', color: colors.text },
  originalPrice: { fontSize: 11, color: colors.muted, textDecorationLine: 'line-through' },
});
