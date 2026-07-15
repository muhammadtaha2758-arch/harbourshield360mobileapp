import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type { CustomerAgreement } from '../../types/portal';
import type { AgreementsStackParamList } from '../../navigation/types';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { AGREEMENT_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import {
  formatAgreementDate,
  getAgreementTitle,
  isAgreementSigned,
  openAgreementPublicView,
} from '../../utils/agreementHelpers';

type Nav = NativeStackNavigationProp<AgreementsStackParamList>;

export function AgreementsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<CustomerAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'signed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const list = await portalService.getAgreements();
      setItems(list);
    } catch (error) {
      toastAlert('Agreements', error instanceof Error ? error.message : 'Failed to load agreements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const openPublicAgreement = useCallback(async (item: CustomerAgreement) => {
    try {
      await openAgreementPublicView(item);
    } catch (error) {
      toastAlert('Agreements', error instanceof Error ? error.message : 'Could not open agreement.');
    }
  }, []);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeFilter === 'signed') {
      list = list.filter((item) => isAgreementSigned(item));
    } else if (activeFilter === 'pending') {
      list = list.filter((item) => !isAgreementSigned(item));
    }

    return applyListFilters(list, {
      searchQuery,
      searchFields: (item) => [
        getAgreementTitle(item),
        String(item.id ?? ''),
        String(item.signature_status ?? item.status ?? ''),
      ],
      sort: sortBy,
      getName: (item) => getAgreementTitle(item),
      getDate: (item) => formatAgreementDate(item.created_at ?? item.updated_at),
    });
  }, [activeFilter, items, searchQuery, sortBy]);

  const filterActive = activeFilter !== 'all' || sortBy !== DEFAULT_SORT;

  const signedCount = String(items.filter((item) => isAgreementSigned(item)).length).padStart(2, '0');
  const pendingCount = String(items.filter((item) => !isAgreementSigned(item)).length).padStart(2, '0');

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>

        <View style={styles.searchRow}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
          >
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search agreements by title or ID"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Agreements</Text>
          <Text style={styles.heroSub}>Review, sign and track all agreement status updates securely.</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{pendingCount}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{signedCount}</Text>
              <Text style={styles.summaryLabel}>Signed</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterPill, activeFilter === 'pending' && styles.filterPillActive]}
            onPress={() => setActiveFilter('pending')}
          >
            <Text style={[styles.filterText, activeFilter === 'pending' && styles.filterTextActive]}>Pending</Text>
          </Pressable>
          <Pressable
            style={[styles.filterPill, activeFilter === 'signed' && styles.filterPillActive]}
            onPress={() => setActiveFilter('signed')}
          >
            <Text style={[styles.filterText, activeFilter === 'signed' && styles.filterTextActive]}>Signed</Text>
          </Pressable>
        </View>

        {filteredItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {items.length === 0 ? 'No agreements yet' : 'No agreements found'}
            </Text>
            <Text style={styles.empty}>
              {items.length === 0
                ? 'When your provider sends you an agreement, it will appear here.'
                : 'Try a different search or filter, or pull to refresh.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredItems.map((item, index) => {
              const signed = isAgreementSigned(item);
              return (
                <View key={String(item.id ?? index)} style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [pressed && styles.cardPressed]}
                    onPress={() => navigation.navigate('AgreementDetail', { agreementId: String(item.id) })}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.cardId}>AG-{String(item.id ?? index).padStart(4, '0')}</Text>
                      <View style={[styles.statusPill, signed ? styles.statusSigned : styles.statusPending]}>
                        <Text style={styles.statusText}>{signed ? 'Signed' : 'Pending'}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{getAgreementTitle(item)}</Text>
                    <Text style={styles.date}>Sent {formatAgreementDate(String(item.created_at ?? ''))}</Text>
                  </Pressable>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, styles.actionBtnView, pressed && styles.dim]}
                      onPress={() => void openPublicAgreement(item)}
                    >
                      <Text style={styles.actionBtnViewText}>View</Text>
                    </Pressable>
                    {!signed ? (
                      <Pressable
                        style={({ pressed }) => [styles.actionBtn, styles.actionBtnSign, pressed && styles.dim]}
                        onPress={() => void openPublicAgreement(item)}
                      >
                        <Text style={styles.actionBtnSignText}>Sign</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={AGREEMENT_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={activeFilter === 'all' ? null : activeFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setSortBy(sort);
          if (!status) {
            setActiveFilter('all');
          } else if (status === 'signed') {
            setActiveFilter('signed');
          } else {
            setActiveFilter('pending');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.avatarSoftFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#4A5568', marginLeft: 10 },
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    marginLeft: 10,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  innerFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.innerFilterBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6,marginRight: 100 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2D74E8',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  summaryLabel: { color: '#DCE7FF', fontSize: 12, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: '#E9EDF5' },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { color: '#425067', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  listWrap: { marginTop: 12, gap: 10 },
  emptyWrap: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: { color: '#24334E', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  bodyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardId: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusSigned: {
    backgroundColor: '#E8F8EF',
  },
  statusPending: {
    backgroundColor: '#FFF2DA',
  },
  statusText: {
    color: '#394150',
    fontSize: 11,
    fontWeight: '700',
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  date: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E3EAF6',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnView: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#BFD7F1',
  },
  actionBtnViewText: {
    color: '#0F4C81',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnSign: {
    backgroundColor: colors.primary,
  },
  actionBtnSignText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dim: { opacity: 0.88 },
});
