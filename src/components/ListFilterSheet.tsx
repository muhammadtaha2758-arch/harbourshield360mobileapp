import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import type { FilterOption, ListFilterValues, SortFilterOption, SortOption } from '../types/listFilters';
import { DEFAULT_SORT } from '../types/listFilters';
import { STANDARD_SORT_OPTIONS } from '../constants/listFilterPresets';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  statusOptions?: FilterOption[];
  sortOptions?: SortFilterOption[];
  initialStatus: string | null;
  initialSort: SortOption;
  onApply: (values: ListFilterValues) => void;
};

function labelForStatus(options: FilterOption[], value: string | null): string | null {
  if (!value) {
    return null;
  }
  return options.find((o) => o.value === value)?.label ?? value;
}

function labelForSort(options: SortFilterOption[], value: SortOption): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function ListFilterSheet({
  visible,
  onClose,
  title = 'Filters & sort',
  statusOptions = [],
  sortOptions = STANDARD_SORT_OPTIONS,
  initialStatus,
  initialSort,
  onApply,
}: Props): React.JSX.Element {
  const [draftStatus, setDraftStatus] = useState<string | null>(initialStatus);
  const [draftSort, setDraftSort] = useState<SortOption>(initialSort);
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [sortExpanded, setSortExpanded] = useState(true);

  useEffect(() => {
    if (visible) {
      setDraftStatus(initialStatus);
      setDraftSort(initialSort);
    }
  }, [visible, initialStatus, initialSort]);

  const resetAll = (): void => {
    setDraftStatus(null);
    setDraftSort(DEFAULT_SORT);
  };

  const apply = (): void => {
    onApply({ status: draftStatus, sort: draftSort });
    onClose();
  };

  const statusLabel = labelForStatus(statusOptions, draftStatus);
  const sortLabel = labelForSort(sortOptions, draftSort);
  const hasSelection =
    draftStatus != null || (sortOptions.length > 0 && draftSort !== DEFAULT_SORT);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeBtn}>×</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Selected filters</Text>
            {hasSelection ? (
              <View style={styles.tagRow}>
                {statusLabel ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{statusLabel}</Text>
                    <Pressable onPress={() => setDraftStatus(null)} hitSlop={8}>
                      <Text style={styles.tagClear}>×</Text>
                    </Pressable>
                  </View>
                ) : null}
                {sortOptions.length > 0 && draftSort !== DEFAULT_SORT ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{sortLabel}</Text>
                    <Pressable onPress={() => setDraftSort(DEFAULT_SORT)} hitSlop={8}>
                      <Text style={styles.tagClear}>×</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable onPress={resetAll}>
                  <Text style={styles.resetLink}>Reset all</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.noneText}>None</Text>
            )}
          </View>

          {statusOptions.length > 0 ? (
            <View style={styles.section}>
              <Pressable style={styles.sectionHeader} onPress={() => setStatusExpanded((v) => !v)}>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.expandIcon}>{statusExpanded ? '−' : '+'}</Text>
              </Pressable>
              {statusExpanded
                ? statusOptions.map((option) => {
                    const selected = draftStatus === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => setDraftStatus(selected ? null : option.value)}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                        {selected ? <Text style={styles.tick}>✓</Text> : null}
                      </Pressable>
                    );
                  })
                : null}
            </View>
          ) : null}

          {sortOptions.length > 0 ? (
            <View style={styles.section}>
              <Pressable style={styles.sectionHeader} onPress={() => setSortExpanded((v) => !v)}>
                <Text style={styles.sectionTitle}>Sort by</Text>
                <Text style={styles.expandIcon}>{sortExpanded ? '−' : '+'}</Text>
              </Pressable>
              {sortExpanded
                ? sortOptions.map((option) => {
                    const selected = draftSort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => setDraftSort(option.value)}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                        {selected ? <Text style={styles.tick}>✓</Text> : null}
                      </Pressable>
                    );
                  })
                : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]} onPress={apply}>
            <Text style={styles.applyBtnText}>Apply filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  body: {
    maxHeight: 420,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  expandIcon: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginRight: 4,
  },
  tagClear: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  resetLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  noneText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  optionRowSelected: {
    backgroundColor: '#F0F6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optionText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  tick: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnPressed: {
    opacity: 0.9,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
