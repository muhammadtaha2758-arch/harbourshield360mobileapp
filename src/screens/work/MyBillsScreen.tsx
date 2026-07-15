import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { BILL_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';

type BillStatus = 'Paid' | 'Pending' | 'Overdue';
type BillItem = {
  id: string;
  invoiceNumber: string;
  projectTitle: string;
  amount: string;
  dueDate: string;
  status: BillStatus;
};

const MOCK_BILLS: BillItem[] = [
  {
    id: 'b-1',
    invoiceNumber: 'INV-3042',
    projectTitle: 'Roof Damage Repair',
    amount: '$2,480.00',
    dueDate: 'Due May 20, 2026',
    status: 'Pending',
  },
  {
    id: 'b-2',
    invoiceNumber: 'INV-3027',
    projectTitle: 'Gutter Replacement',
    amount: '$860.00',
    dueDate: 'Due Apr 25, 2026',
    status: 'Overdue',
  },
  {
    id: 'b-3',
    invoiceNumber: 'INV-3019',
    projectTitle: 'Inspection & Assessment',
    amount: '$290.00',
    dueDate: 'Paid Apr 15, 2026',
    status: 'Paid',
  },
  {
    id: 'b-4',
    invoiceNumber: 'INV-3014',
    projectTitle: 'Material Advance',
    amount: '$1,420.00',
    dueDate: 'Paid Apr 08, 2026',
    status: 'Paid',
  },
];

const STATUS_FILTERS: Array<'All Status' | BillStatus> = ['All Status', 'Paid', 'Pending', 'Overdue'];

export function MyBillsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<AppDrawerParamList>>();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All Status' | BillStatus>('All Status');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredBills = useMemo(() => {
    let list = MOCK_BILLS;
    if (selectedStatus !== 'All Status') {
      list = list.filter((bill) => bill.status === selectedStatus);
    }
    return applyListFilters(list, {
      searchQuery: invoiceSearch,
      searchFields: (bill) => [bill.invoiceNumber, bill.projectTitle, bill.amount, bill.dueDate, bill.status],
      sort: sortBy,
      getName: (bill) => bill.projectTitle,
      getDate: (bill) => bill.dueDate,
    });
  }, [invoiceSearch, selectedStatus, sortBy]);

  const filterActive = selectedStatus !== 'All Status' || sortBy !== DEFAULT_SORT;

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
            value={invoiceSearch}
            onChangeText={setInvoiceSearch}
            placeholder="Search invoice number or project"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>My Bills</Text>
          <Text style={styles.heroSub}>Invoice history and payment status for all your projects.</Text>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillText}>{String(filteredBills.length).padStart(2, '0')} Invoices</Text>
          </View>
        </View>

        <View style={styles.statusFilterWrap}>
          <Text style={styles.filterLabel}>Status</Text>
          <Pressable style={styles.statusButton} onPress={() => setStatusMenuOpen((v) => !v)}>
            <Text style={styles.statusButtonText}>{selectedStatus}</Text>
            <Text style={styles.statusChevron}>{statusMenuOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {statusMenuOpen ? (
            <View style={styles.statusMenu}>
              {STATUS_FILTERS.map((status) => (
                <Pressable
                  key={status}
                  style={({ pressed }) => [styles.statusMenuItem, selectedStatus === status && styles.statusMenuItemActive, pressed && styles.dim]}
                  onPress={() => {
                    setSelectedStatus(status);
                    setStatusMenuOpen(false);
                  }}
                >
                  <Text style={[styles.statusMenuText, selectedStatus === status && styles.statusMenuTextActive]}>{status}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.listWrap}>
          {filteredBills.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No invoices found</Text>
              <Text style={styles.emptySub}>Try changing status filter or invoice search.</Text>
            </View>
          ) : (
            filteredBills.map((bill) => (
              <View key={bill.id} style={styles.billCard}>
                <View style={styles.billTop}>
                  <Text style={styles.billInvoiceNumber}>{bill.invoiceNumber}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      bill.status === 'Paid'
                        ? styles.statusPaid
                        : bill.status === 'Pending'
                          ? styles.statusPending
                          : styles.statusOverdue,
                    ]}
                  >
                    <Text style={styles.statusPillText}>{bill.status}</Text>
                  </View>
                </View>
                <Text style={styles.billProject}>{bill.projectTitle}</Text>
                <View style={styles.billMetaRow}>
                  <Text style={styles.billDueDate}>{bill.dueDate}</Text>
                  <Text style={styles.billAmount}>{bill.amount}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={BILL_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={selectedStatus === 'All Status' ? null : selectedStatus}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setSortBy(sort);
          if (!status) {
            setSelectedStatus('All Status');
          } else {
            setSelectedStatus(status as BillStatus);
          }
          setStatusMenuOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  profilePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  avatarWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.avatarSoftFill, alignItems: 'center', justifyContent: 'center' },
  avatarGlyph: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#4A5568', marginLeft: 10 },
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  searchShell: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingLeft: 12, paddingRight: 6, marginLeft: 10, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 8 },
  innerFilterBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.innerFilterBg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6 },
  summaryPill: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#2D74E8', paddingHorizontal: 12, paddingVertical: 5 },
  summaryPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  statusFilterWrap: { marginTop: 12 },
  filterLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  statusButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusButtonText: { color: '#24334E', fontSize: 13, fontWeight: '600' },
  statusChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  statusMenu: { marginTop: 5, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE3EE', overflow: 'hidden' },
  statusMenuItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  statusMenuItemActive: { backgroundColor: '#EEF4FF' },
  statusMenuText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  statusMenuTextActive: { color: colors.primary, fontWeight: '700' },
  listWrap: { marginTop: 12, gap: 10 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 18, alignItems: 'center' },
  emptyTitle: { color: '#24334E', fontSize: 16, fontWeight: '700' },
  emptySub: { marginTop: 6, color: '#6A7489', fontSize: 13, textAlign: 'center' },
  billCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 12 },
  billTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billInvoiceNumber: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPaid: { backgroundColor: '#E8F8EF' },
  statusPending: { backgroundColor: '#FFF2DA' },
  statusOverdue: { backgroundColor: '#FFE5E7' },
  statusPillText: { color: '#394150', fontSize: 11, fontWeight: '700' },
  billProject: { marginTop: 8, color: '#18263F', fontSize: 15, fontWeight: '600' },
  billMetaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billDueDate: { color: '#6A7489', fontSize: 12 },
  billAmount: { color: '#111827', fontSize: 16, fontWeight: '700' },
  dim: { opacity: 0.88 },
});
