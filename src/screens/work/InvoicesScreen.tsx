import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList, AppTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { INVOICE_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { portalService } from '../../services/api/portalService';
import type { CustomerInvoiceRecord, InvoiceDisplayStatus } from '../../types/invoice';

type InvoicesScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'EstimatesInvoicesTab'>,
  DrawerNavigationProp<AppDrawerParamList>
>;

type InvoiceStatus = InvoiceDisplayStatus;
type InvoiceItem = {
  recordId: string | number;
  id: string;
  title: string;
  dueDate: string;
  amount: string;
  status: InvoiceStatus;
  rawStatus?: string;
};

type FilterTab = 'all' | 'open' | 'paid';

function normalizeDisplayStatus(value?: string): InvoiceStatus {
  const raw = (value ?? '').trim();
  if (raw === 'Paid' || raw === 'Overdue' || raw === 'Due Soon') {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (lower === 'paid' || lower === 'complete' || lower === 'completed') {
    return 'Paid';
  }
  if (lower === 'overdue') {
    return 'Overdue';
  }
  return 'Due Soon';
}

function mapInvoiceRecord(record: CustomerInvoiceRecord): InvoiceItem {
  return {
    recordId: record.id,
    id: record.invoice_number ?? `INV-${record.id}`,
    title: record.title?.trim() || record.project_address?.trim() || `Invoice #${record.id}`,
    dueDate: record.due_label?.trim() || '—',
    amount: record.amount_formatted?.trim() || '$0.00',
    status: normalizeDisplayStatus(record.display_status ?? record.status),
    rawStatus: record.status,
  };
}

const INVOICE_ORANGE = '#EA580C';
const INVOICE_ORANGE_SOFT = '#FFEDD5';
const INVOICE_GREEN_TEXT = '#15803D';
const INVOICE_RED_TEXT = '#DC2626';

const invoiceHeroCardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      }
    : { elevation: 3 };

function HeroInvoiceIllustration({ width, height }: { width: number; height: number }): React.JSX.Element {
  const lineFill = '#B8D4FF';
  const docBlue = colors.primary;

  return (
    <Svg width={width} height={height} viewBox="0 0 120 100" accessibilityLabel="Invoices illustration">
      <G opacity={0.98}>
        {/* Main sheet — white rounded rectangle */}
        <Rect x={18} y={16} width={68} height={72} rx={10} ry={10} fill="#FFFFFF" />
        {/* Folded top-right corner (dog-ear) */}
        <Path d="M 74 16 L 86 16 L 86 28 L 74 22 Z" fill="#E8F1FC" />
        <Path d="M 74 16 L 84 16 L 74 24 Z" fill="#FFFFFF" />
        {/* Four “text” lines — varying lengths */}
        <Rect x={28} y={34} width={38} height={3.5} rx={1.75} fill={lineFill} />
        <Rect x={28} y={44} width={30} height={3.5} rx={1.75} fill={lineFill} />
        <Rect x={28} y={54} width={34} height={3.5} rx={1.75} fill={lineFill} />
        <Rect x={28} y={64} width={22} height={3.5} rx={1.75} fill={lineFill} />
      </G>
      {/* Coin / badge overlapping bottom-right */}
      <Circle cx={88} cy={72} r={21} fill="#FFFFFF" />
      <SvgText
        x={88}
        y={79}
        textAnchor="middle"
        fontSize={22}
        fontWeight="700"
        fill={docBlue}
      >
        $
      </SvgText>
    </Svg>
  );
}

function IconWallet({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="">
      <Path
        d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
        stroke="#FFFFFF"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M19 8h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4V8z"
        stroke="#FFFFFF"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={17} cy={13} r={1} fill="#FFFFFF" />
    </Svg>
  );
}

function InvoiceRowIcon({ status }: { status: InvoiceStatus }): React.JSX.Element {
  const accent =
    status === 'Paid' ? INVOICE_GREEN_TEXT : status === 'Overdue' ? INVOICE_RED_TEXT : INVOICE_ORANGE;
  const softBg =
    status === 'Paid' ? '#DCFCE7' : status === 'Overdue' ? '#FFE4E6' : INVOICE_ORANGE_SOFT;
  return (
    <View style={[invoiceRowIconStyles.wrap, { backgroundColor: softBg }]}>
      <Svg width={26} height={30} viewBox="0 0 26 30" style={invoiceRowIconStyles.clipboardSvg}>
        <Path
          d="M7 4h12a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          stroke={accent}
          strokeWidth={1.75}
          fill="none"
          strokeLinejoin="round"
        />
        <Path
          d="M9 4V3a1,1,0,0,1,1,-1h6a1,1,0,0,1,1,-1"
          stroke={accent}
          strokeWidth={1.75}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M9 12h8M9 16h8M9 20h5" stroke={accent} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
      <View style={[invoiceRowIconStyles.clockBadge, { backgroundColor: softBg }]}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Circle cx={7} cy={7} r={6} fill="#FFFFFF" stroke={accent} strokeWidth={1.4} />
          <Path d="M7 4v3.5l2 1.2" stroke={accent} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
    </View>
  );
}

const invoiceRowIconStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipboardSvg: { marginTop: 2 },
  clockBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function DownloadOutlineIcon({ size = 18 }: { size?: number }): React.JSX.Element {
  const stroke = size <= 16 ? 1.75 : 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Download">
      <Path d="M12 4v12" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" fill="none" />
      <Path d="M8 12l4 4 4-4" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M5 20h14" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function IconDocument({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="#FFFFFF"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M14 2v6h6" stroke="#FFFFFF" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M8 14h8M8 18h8" stroke="#FFFFFF" strokeWidth={1.75} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function InvoicesScreen(): React.JSX.Element {
  const navigation = useNavigation<InvoicesScreenNavigation>();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [openTotal, setOpenTotal] = useState('$0.00');
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await portalService.getInvoices();
      const mapped = (data.invoice ?? []).map(mapInvoiceRecord);
      setInvoices(mapped);
      setOpenTotal(data.summary?.open_balance_formatted ?? '$0.00');
      setTotalCount(data.summary?.total_count ?? mapped.length);
    } catch (error) {
      toastAlert('Invoices', error instanceof Error ? error.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInvoices();
    }, [loadInvoices]),
  );

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (activeFilter === 'open') {
      list = list.filter((invoice) => invoice.status !== 'Paid');
    } else if (activeFilter === 'paid') {
      list = list.filter((invoice) => invoice.status === 'Paid');
    }

    return applyListFilters(list, {
      searchQuery,
      searchFields: (invoice) => [
        invoice.id,
        invoice.title,
        invoice.dueDate,
        invoice.rawStatus ?? invoice.status,
        String(invoice.recordId),
      ],
      sort: sortBy,
      getName: (invoice) => invoice.title,
      getDate: (invoice) => invoice.dueDate,
    });
  }, [activeFilter, invoices, searchQuery, sortBy]);

  const filterActive = activeFilter !== 'all' || sortBy !== DEFAULT_SORT;

  const handleDownload = useCallback(async (invoice: InvoiceItem) => {
    try {
      const detail = await portalService.getInvoiceById(invoice.recordId);
      const inv = detail.Invoice as Record<string, unknown> | undefined;
      const amount = inv?.amount != null ? String(inv.amount) : invoice.amount;
      const status = inv?.status != null ? String(inv.status) : invoice.rawStatus ?? invoice.status;

      toastAlert(
        invoice.id,
        `Amount: ${invoice.amount}\nStatus: ${status}\n\nPDF download uses the same invoice data as the web portal. Full in-app PDF view can be added next.`,
      );
    } catch (error) {
      toastAlert('Download', error instanceof Error ? error.message : 'Unable to load invoice.');
    }
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
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search invoice by ID, project, or status"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadInvoices(true)} tintColor={colors.primary} />
        }
      >
        <View style={styles.heroCard}>
          <ImageBackground
            source={require('../../assets/images/hail-impact-background.png')}
            style={styles.heroBgImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />

          <View style={styles.heroInner}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  Estimates & Invoices
                </Text>
                <Text style={styles.heroSub} numberOfLines={2}>
                  Track billing status and outstanding{'\n'}balances in one place.
                </Text>
              </View>
              <View style={styles.heroIllustrationWrap}>
                <HeroInvoiceIllustration width={90} height={78} />
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardRow}>
                  <View style={styles.summaryIconBox}>
                    <IconWallet size={22} />
                  </View>
                  <View style={styles.summaryTextCol}>
                    <Text style={styles.summaryValue}>{openTotal}</Text>
                    <Text style={styles.summaryLabel}>Open balance</Text>
                  </View>
                </View>
              </View>
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardRow}>
                  <View style={styles.summaryIconBox}>
                    <IconDocument size={22} />
                  </View>
                  <View style={styles.summaryTextCol}>
                    <Text style={styles.summaryValue}>{String(totalCount).padStart(2, '0')}</Text>
                    <Text style={styles.summaryLabel}>Total invoices</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setActiveFilter('all')}
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveFilter('open')}
            style={[styles.filterPill, activeFilter === 'open' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'open' && styles.filterTextActive]}>Open</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveFilter('paid')}
            style={[styles.filterPill, activeFilter === 'paid' && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === 'paid' && styles.filterTextActive]}>Paid</Text>
          </Pressable>
        </View>

        <View style={styles.listWrap}>
          {loading && invoices.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null}

          {!loading && filteredInvoices.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No invoices found</Text>
              <Text style={styles.emptySub}>
                {searchQuery.trim() ? 'Try a different search term.' : 'Invoices for your projects will appear here.'}
              </Text>
            </View>
          ) : null}

          {filteredInvoices.map((invoice) => (
            <Pressable
              key={invoice.id}
              style={({ pressed }) => [styles.invoiceCard, pressed && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel={`${invoice.id}, ${invoice.title}`}
            >
              <View style={styles.invoiceRow}>
                <InvoiceRowIcon status={invoice.status} />
                <View style={styles.invoiceMain}>
                  <View style={styles.invoiceIdRow}>
                    <Text style={styles.invoiceId}>{invoice.id}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        invoice.status === 'Paid'
                          ? styles.statusPaid
                          : invoice.status === 'Due Soon'
                            ? styles.statusDueSoon
                            : styles.statusOverdue,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          invoice.status === 'Paid' && styles.statusPillTextPaid,
                          invoice.status === 'Due Soon' && styles.statusPillTextDueSoon,
                          invoice.status === 'Overdue' && styles.statusPillTextOverdue,
                        ]}
                      >
                        {invoice.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.invoiceTitle} numberOfLines={2}>
                    {invoice.title}
                  </Text>
                  <View style={styles.invoiceBottomRow}>
                    <Text style={styles.invoiceMeta} numberOfLines={1}>
                      {invoice.dueDate}
                    </Text>
                    <View style={styles.invoiceActions}>
                      <Text style={styles.invoiceAmount} numberOfLines={1} ellipsizeMode="tail">
                        {invoice.amount}
                      </Text>
                      <Pressable
                        style={({ pressed }) => [styles.invoiceDownloadBtn, pressed && styles.dim]}
                        onPress={() => void handleDownload(invoice)}
                        accessibilityRole="button"
                        accessibilityLabel={`Download ${invoice.id}`}
                      >
                        <DownloadOutlineIcon size={15} />
                      </Pressable>
                      <Text style={styles.invoiceChevron}>›</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={INVOICE_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={activeFilter === 'all' ? null : activeFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setSortBy(sort);
          if (!status) {
            setActiveFilter('all');
          } else if (status === 'paid') {
            setActiveFilter('paid');
          } else {
            setActiveFilter('open');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
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
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderTopWidth: 1,
    borderTopColor: '#5CAAF6',
    ...invoiceHeroCardShadow,
  },
  heroBgImage: {
    ...StyleSheet.absoluteFill,
  },
  heroInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  heroIllustrationWrap: {
    marginTop: -4,
    marginRight: -4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '400',
    marginTop: 4,
  },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  summaryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  summaryLabel: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '400', marginTop: 2 },
  filterRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#E9EDF5',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterText: { color: '#425067', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  listWrap: { marginTop: 12, gap: 12 },
  loadingBox: { paddingVertical: 32, alignItems: 'center' },
  emptyBox: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF5',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  invoiceMain: {
    flex: 1,
    minWidth: 0,
  },
  invoiceIdRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  invoiceId: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusPaid: { backgroundColor: '#DCFCE7' },
  statusDueSoon: { backgroundColor: '#FFEDD5' },
  statusOverdue: { backgroundColor: '#FFE4E6' },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextPaid: { color: INVOICE_GREEN_TEXT },
  statusPillTextDueSoon: { color: INVOICE_ORANGE },
  statusPillTextOverdue: { color: INVOICE_RED_TEXT },
  invoiceTitle: {
    marginTop: 4,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  invoiceBottomRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  invoiceMeta: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  invoiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 14,
  },
  invoiceAmount: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },
  invoiceDownloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  invoiceChevron: {
    color: '#9CA3AF',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 18,
    marginLeft: -2,
  },
  dim: { opacity: 0.88 },
});
