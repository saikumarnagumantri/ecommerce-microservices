import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OrderStatus } from '../api/types';
import { colors, spacing } from '../theme';

const STEPS: OrderStatus[] = ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'];

/** PARTIALLY_DISPATCHED occupies the same progress slot as DISPATCHED — it's an alternate outcome of the same step, not a fifth step. */
function stepIndex(status: OrderStatus): number {
  if (status === 'PARTIALLY_DISPATCHED') return STEPS.indexOf('DISPATCHED');
  return STEPS.indexOf(status);
}

interface Props {
  status: OrderStatus;
  events: { status: OrderStatus; createdAt: string }[];
}

export default function StatusTimeline({ status, events }: Props) {
  if (status === 'CANCELLED') {
    const cancelledAt = events.find((e) => e.status === 'CANCELLED')?.createdAt;
    return (
      <View style={styles.cancelledRow}>
        <View style={[styles.dot, styles.dotCancelled]} />
        <View>
          <Text style={styles.stepLabelCancelled}>Cancelled</Text>
          {cancelledAt && <Text style={styles.stepDate}>{new Date(cancelledAt).toLocaleString()}</Text>}
        </View>
      </View>
    );
  }

  const currentIndex = stepIndex(status);

  return (
    <View>
      {STEPS.map((step, i) => {
        const isDispatchStep = step === 'DISPATCHED';
        const event = events.find((e) => e.status === step || (isDispatchStep && e.status === 'PARTIALLY_DISPATCHED'));
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const label =
          isDispatchStep && status === 'PARTIALLY_DISPATCHED'
            ? 'Partially dispatched'
            : step.charAt(0) + step.slice(1).toLowerCase();
        return (
          <View key={step} style={styles.row}>
            <View style={styles.dotColumn}>
              <View style={[styles.dot, done && styles.dotDone, isCurrent && styles.dotCurrent]} />
              {i < STEPS.length - 1 && <View style={[styles.line, i < currentIndex && styles.lineDone]} />}
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent, !done && styles.stepLabelPending]}>
                {label}
              </Text>
              {event && <Text style={styles.stepDate}>{new Date(event.createdAt).toLocaleString()}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dotColumn: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  dotDone: { borderColor: colors.success, backgroundColor: colors.success },
  dotCurrent: { borderColor: colors.primary, backgroundColor: colors.primary },
  dotCancelled: { borderColor: colors.danger, backgroundColor: colors.danger },
  line: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  stepText: { flex: 1, paddingBottom: spacing.md, marginLeft: spacing.sm },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  stepLabelCurrent: { color: colors.primary },
  stepLabelPending: { color: colors.muted, fontWeight: '400' },
  stepLabelCancelled: { fontSize: 14, fontWeight: '700', color: colors.danger },
  stepDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cancelledRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
