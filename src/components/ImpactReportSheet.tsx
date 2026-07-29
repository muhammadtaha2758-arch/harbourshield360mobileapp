import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import {
  nexradService,
  type HailImpactHistoryRecord,
} from '../services/api/nexradService';

export type ImpactHistoryRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  hailLabel: string;
  distanceLabel: string;
};

type Props = {
  visible: boolean;
  lat: number;
  lng: number;
  address?: string;
  onClose: () => void;
  /** When user taps a hail event, show that date’s swaths on the map. */
  onShowOnMap?: (dateKey: string) => void;
};

function formatDateLabel(iso?: string, fallbackDate?: string): string {
  const raw = iso || fallbackDate || '';
  if (!raw) {
    return 'Unknown date';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.slice(0, 10);
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function dateKeyFromRecord(record: HailImpactHistoryRecord): string {
  const iso = record.report?.dateTimeISO || record.date || '';
  const match = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? String(iso).slice(0, 10);
}

function hailSizeLabel(record: HailImpactHistoryRecord): string {
  const detail = record.report?.detail as Record<string, unknown> | undefined;
  const candidates = [
    detail?.hailIN,
    detail?.hailSizeIN,
    detail?.hailCM,
    record.report?.hailIN,
    (record as Record<string, unknown>).hail_size,
    (record as Record<string, unknown>).max_hail,
  ];
  for (const value of candidates) {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (Number.isFinite(n) && n > 0) {
      // If value looks like cm (> 5), convert roughly; else treat as inches.
      const inches = n > 5 ? n / 2.54 : n;
      return `${inches.toFixed(2)} in`;
    }
  }
  return 'Hail reported';
}

function distanceLabel(record: HailImpactHistoryRecord): string {
  const detail = record.report?.detail as Record<string, unknown> | undefined;
  const miles = detail?.distanceMI ?? detail?.distance_mi ?? (record as Record<string, unknown>).distance_mi;
  const n = typeof miles === 'number' ? miles : parseFloat(String(miles ?? ''));
  if (Number.isFinite(n)) {
    return `${n.toFixed(1)} mi away`;
  }
  return 'Near property';
}

function mapHistoryToRows(records: HailImpactHistoryRecord[]): ImpactHistoryRow[] {
  const rows = records.map((record, index) => {
    const dateKey = dateKeyFromRecord(record);
    return {
      id: `${dateKey}-${index}`,
      dateKey,
      dateLabel: formatDateLabel(record.report?.dateTimeISO, record.date),
      hailLabel: hailSizeLabel(record),
      distanceLabel: distanceLabel(record),
    };
  });

  rows.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  return rows;
}

export function ImpactReportSheet({
  visible,
  lat,
  lng,
  address,
  onClose,
  onShowOnMap,
}: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImpactHistoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await nexradService.getHailImpactHistory(lat, lng);
      setRows(mapHistoryToRows(history));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Unable to load impact history.');
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    void load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Show Impact</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {address?.trim() || `Property at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close impact report"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Hail impact history</Text>
          <Text style={styles.bannerBody}>
            Events within about 10 miles of this property (last 5 years). Tap a row to show that
            storm on the map.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading impact data…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No hail impacts found</Text>
            <Text style={styles.emptyBody}>
              There are no recorded hail swaths near this property in the available history.
            </Text>
          </View>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <ScrollView contentContainerStyle={styles.listContent}>
            {rows.map((row) => (
              <Pressable
                key={row.id}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => {
                  onShowOnMap?.(row.dateKey);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Show hail impact on ${row.dateLabel}`}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowDate}>{row.dateLabel}</Text>
                  <Text style={styles.rowMeta}>{row.distanceLabel}</Text>
                </View>
                <Text style={styles.rowHail}>{row.hailLabel}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3EAF6',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#667085',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  bannerBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#344054',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 10,
    color: '#667085',
    fontSize: 13,
  },
  errorText: {
    color: '#B42318',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E3EAF6',
  },
  rowMain: {
    flex: 1,
    paddingRight: 10,
  },
  rowDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#667085',
  },
  rowHail: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
});
