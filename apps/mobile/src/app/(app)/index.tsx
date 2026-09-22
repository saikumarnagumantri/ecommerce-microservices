import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as productsApi from '../../api/products';
import { Category, ProductSummary } from '../../api/types';
import { extractErrorMessage } from '../../api/client';
import ProductCard from '../../components/ProductCard';
import { colors, radius, spacing } from '../../theme';

const PAGE_LIMIT = 20;

export default function ProductListScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      try {
        const result = await productsApi.getProducts({
          page: targetPage,
          limit: PAGE_LIMIT,
          search: search || undefined,
          categoryId: selectedCategory ?? undefined,
        });
        setProducts((prev) => (replace ? result.data : [...prev, ...result.data]));
        setPage(result.page);
        setTotalPages(result.totalPages);
        setError(null);
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not load products'));
      }
    },
    [search, selectedCategory],
  );

  // Reload from page 1 whenever the search term or category changes.
  useEffect(() => {
    setLoading(true);
    load(1, true).finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, true);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    await load(page + 1, false);
    setLoadingMore(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search products"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        data={[{ id: null, name: 'All' } as { id: number | null; name: string }, ...categories]}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, selectedCategory === item.id && styles.chipActive]}
            onPress={() => setSelectedCategory(item.id)}
          >
            <Text style={[styles.chipText, selectedCategory === item.id && styles.chipTextActive]}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator style={styles.centerLoader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products match your search.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  search: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  chipRow: { flexGrow: 0, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.chip,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  grid: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xl },
  centerLoader: { marginTop: spacing.xxl },
  footerLoader: { marginVertical: spacing.lg },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.xl },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
