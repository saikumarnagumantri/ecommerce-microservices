import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProductFeature } from '../api/types';
import { colors, spacing } from '../theme';

export default function FeatureTable({ features }: { features: ProductFeature[] }) {
  if (features.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Features</Text>
      {features.map((f) => (
        <View key={f.label} style={styles.row}>
          <Text style={styles.label}>{f.label}</Text>
          <Text style={styles.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  heading: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 13, color: colors.muted, flex: 1 },
  value: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
});
