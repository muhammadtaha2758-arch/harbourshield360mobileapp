import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
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
import { portalService } from '../../services/api/portalService';
import type { CustomerInvoiceRecord } from '../../types/invoice';

type MyBillsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'MyBillsTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

type BillStatus = 'Paid' | 'Pending' | 'Overdue';

type BillItem = {
  recordId: string | number;
  id: string;
  invoiceNumber: string;
  projectTitle: string;
  amount: string;
  dueDate: string;
  status: BillStatus;
  rawStatus?: string;
};

type BillDetailState = {
  bill: BillItem;
  loading: boolean;
  amount?: string;
  status?: string;
  dueDate?: string;
  project?: string;
  itemCount?: number;
  total?: string;
};

function mapBillStatus(value?: string): BillStatus {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'paid' || raw === 'complete' || raw === 'completed') {
    return 'Paid';
  }
  if (raw === 'overdue') {
    return 'Overdue';
  }
  return 'Pending';
}

function mapInvoiceRecord(record: CustomerInvoiceRecord): BillItem {
  return {
    recordId: record.id,
    id: String(record.id),
    invoiceNumber: record.invoice_number ?? `INV-${record.id}`,
    projectTitle: record.title?.trim() || record.project_address?.trim() || `Invoice #${record.id}`,
    amount: record.amount_formatted?.trim() || '$0.00',
    dueDate: record.due_label?.trim() || '—',
    status: mapBillStatus(record.display_status ?? record.status),
    rawStatus: record.status,
  };
}

const STATUS_FILTERS: Array<'All Status' | BillStatus> = ['All Status', 'Paid', 'Pending', 'Overdue'];

export function MyBillsScreen(): React.JSX.Element {
  const navigation = useNavigation<MyBillsNavigation>();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All Status' | BillStatus>('All Status');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<BillDetailState | null>(null);

  const loadBills = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await portalService.getInvoices();
      const mapped = (data.invoice ?? []).map(mapInvoiceRecord);
      setBills(mapped);
      setTotalCount(data.summary?.total_count ?? mapped.length);
    } catch (error) {
      toastAlert('My Bills', error instanceof Error ? error.message : 'Failed to load bills.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBills();
    }, [loadBills]),
  );

  const filteredBills = useMemo(() => {
    let list = bills;
    if (selectedStatus !== 'All Status') {
      list = list.filter((bill) => bill.status === selectedStatus);
    }
    return applyListFilters(list, {
      searchQuery: invoiceSearch,
      searchFields: (bill) => [
        bill.invoiceNumber,
        bill.projectTitle,
        bill.amount,
        bill.dueDate,
        bill.status,
        bill.rawStatus ?? '',
        String(bill.recordId),
      ],
      sort: sortBy,
      getName: (bill) => bill.projectTitle,
      getDate: (bill) => bill.dueDate,
    });
  }, [bills, invoiceSearch, selectedStatus, sortBy]);

  const filterActive = selectedStatus !== 'All Status' || sortBy !== DEFAULT_SORT;

  const openBillDetail = useCallback(async (bill: BillItem) => {
    setDetail({ bill, loading: true });
    try {
      const response = await portalService.getInvoiceById(bill.recordId);
      const inv = response.Invoice as Record<string, unknown> | undefined;
      const items = Array.isArray(response.items) ? response.items : [];
      const totals = response.totals as Record<string, unknown> | undefined;
      const amountRaw = inv?.amount ?? totals?.total;
      const amount =
        amountRaw != null
          ? typeof amountRaw === 'number'
            ? `$${amountRaw.toFixed(2)}`
            : String(amountRaw)
          : bill.amount;
      const status = inv?.status != null ? String(inv.status) : bill.rawStatus ?? bill.status;
      const dueDate =
        inv?.due_date != null && String(inv.due_date).trim() !== ''
          ? String(inv.due_date)
          : bill.dueDate;
      const project =
        (typeof inv?.project_address === 'string' && inv.project_address) ||
        (typeof inv?.customer_address === 'string' && inv.customer_address) ||
        bill.projectTitle;
      const total =
        totals?.total != null
          ? typeof totals.total === 'number'
            ? `$${Number(totals.total).toFixed(2)}`
            : String(totals.total)
          : amount;

      setDetail({
        bill,
        loading: false,
        amount,
        status,
        dueDate,
        project,
        itemCount: items.length,
        total,
      });
    } catch (error) {
      setDetail(null);
      toastAlert('My Bills', error instanceof Error ? error.message : 'Unable to load bill details.');
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);

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

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadBills(true)} tintColor={colors.primary} />
          }
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>My Bills</Text>
            <Text style={styles.heroSub}>Invoice history and payment status for all your projects.</Text>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>{String(totalCount).padStart(2, '0')} Invoices</Text>
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
                    style={({ pressed }) => [
                      styles.statusMenuItem,
                      selectedStatus === status && styles.statusMenuItemActive,
                      pressed && styles.dim,
                    ]}
                    onPress={() => {
                      setSelectedStatus(status);
                      setStatusMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.statusMenuText, selectedStatus === status && styles.statusMenuTextActive]}
                    >
                      {status}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.listWrap}>
            {filteredBills.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No invoices found</Text>
                <Text style={styles.emptySub}>
                  {bills.length === 0
                    ? 'When project invoices are issued, they will appear here.'
                    : 'Try changing status filter or invoice search.'}
                </Text>
              </View>
            ) : (
              filteredBills.map((bill) => (
                <Pressable
                  key={bill.id}
                  style={({ pressed }) => [styles.billCard, pressed && styles.dim]}
                  onPress={() => void openBillDetail(bill)}
                  accessibilityRole="button"
                  accessibilityLabel={`View bill ${bill.invoiceNumber}`}
                >
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
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}

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

      <Modal visible={detail != null} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={closeDetail} accessibilityLabel="Close bill details" />
          <SafeAreaView edges={['bottom']} style={styles.detailSheetSafe}>
            <View style={styles.detailSheet}>
              {detail ? (
                <>
                  <Text style={styles.detailHeading}>{detail.bill.invoiceNumber}</Text>
                  <Text style={styles.detailSub}>{detail.bill.projectTitle}</Text>

                  {detail.loading ? (
                    <View style={styles.detailLoading}>
                      <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                  ) : (
                    <View style={styles.detailRows}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount</Text>
                        <Text style={styles.detailValue}>{detail.amount ?? detail.bill.amount}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{detail.status ?? detail.bill.status}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Due</Text>
                        <Text style={styles.detailValue}>{detail.dueDate ?? detail.bill.dueDate}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Project</Text>
                        <Text style={styles.detailValue}>{detail.project ?? detail.bill.projectTitle}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Line items</Text>
                        <Text style={styles.detailValue}>{String(detail.itemCount ?? 0)}</Text>
                      </View>
                      <View style={[styles.detailRow, styles.detailRowLast]}>
                        <Text style={styles.detailLabel}>Total</Text>
                        <Text style={styles.detailValueBold}>{detail.total ?? detail.bill.amount}</Text>
                      </View>
                    </View>
                  )}

                  <Pressable
                    style={({ pressed }) => [styles.detailCloseBtn, pressed && styles.dim]}
                    onPress={closeDetail}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Text style={styles.detailCloseText}>Close</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
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
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6 },
  summaryPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#2D74E8',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  summaryPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  statusFilterWrap: { marginTop: 12 },
  filterLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  statusButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusButtonText: { color: '#24334E', fontSize: 13, fontWeight: '600' },
  statusChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  statusMenu: {
    marginTop: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE3EE',
    overflow: 'hidden',
  },
  statusMenuItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  statusMenuItemActive: { backgroundColor: '#EEF4FF' },
  statusMenuText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  statusMenuTextActive: { color: colors.primary, fontWeight: '700' },
  listWrap: { marginTop: 12, gap: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#24334E', fontSize: 16, fontWeight: '700' },
  emptySub: { marginTop: 6, color: '#6A7489', fontSize: 13, textAlign: 'center' },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
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
  detailRoot: { flex: 1, justifyContent: 'flex-end' },
  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  detailSheetSafe: { width: '100%' },
  detailSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  detailHeading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  detailSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 14 },
  detailLoading: { paddingVertical: 28, alignItems: 'center' },
  detailRows: {
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    marginBottom: 12,
  },
  detailRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  detailValue: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  detailValueBold: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  detailCloseBtn: { paddingVertical: 14, alignItems: 'center' },
  detailCloseText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
