import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type { ScheduleEvent } from '../../types/portal';
import type { AppDrawerParamList } from '../../navigation/types';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { SCHEDULE_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters, parseSortableDate } from '../../utils/listFiltering';
import ScheduleIconSvg from '../../assets/icons/schedule-icon.svg';
import { AddEventModal } from './AddEventModal';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekSunday(d: Date): Date {
  const t = stripTime(d);
  const dow = t.getDay();
  t.setDate(t.getDate() - dow);
  return t;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function eventStart(e: ScheduleEvent): string {
  return String(e.startDateTime || e.start_date_time || e.date || '');
}

function eventEnd(e: ScheduleEvent): string {
  return String(e.endDateTime || e.end_date_time || '');
}

function normalizeDateInput(raw: string): string {
  // API may return Laravel-style fractional seconds (e.g. .000000Z)
  return raw.trim().replace(/(\.\d{3})\d+(?=(Z|[+-]\d{2}:?\d{2})$)/i, '$1');
}

function formatDateTimeDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '—';
  }

  for (const value of [trimmed, normalizeDateInput(trimmed)]) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
    }
  }

  return trimmed;
}

function pickEventField(e: ScheduleEvent, keys: string[]): string {
  for (const k of keys) {
    const v = e[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return String(v);
    }
  }
  return '';
}

function eventDateKey(e: ScheduleEvent): string | null {
  const raw = eventStart(e);
  if (!raw) {
    return null;
  }
  const parsed = new Date(normalizeDateInput(raw));
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalYmd(parsed);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  return null;
}

function eventTitle(e: ScheduleEvent): string {
  return String(e.title || 'Event');
}

export function ScheduleScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<AppDrawerParamList>>();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(() => stripTime(new Date()));
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await portalService.getSchedule();
      if (data.success) {
        setEvents(data.events || []);
      } else {
        setEvents([]);
        if (data.message) {
          toastAlert('Schedule', data.message);
        }
      }
    } catch (error) {
      toastAlert('Schedule', error instanceof Error ? error.message : 'Failed to load schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load(false).catch(() => setLoading(false));
  }, [load]);

  const selectedDayKey = useMemo(() => formatLocalYmd(selectedDay), [selectedDay]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    let list = events;
    if (statusFilter === 'upcoming') {
      list = list.filter((event) => parseSortableDate(eventStart(event)) >= now);
    } else if (statusFilter === 'past') {
      list = list.filter((event) => {
        const start = parseSortableDate(eventStart(event));
        return start > 0 && start < now;
      });
    }

    return applyListFilters(list, {
      searchQuery,
      searchFields: (event) => [
        eventTitle(event),
        String(event.description ?? ''),
        String(event.type ?? ''),
        eventStart(event),
      ],
      sort: sortBy,
      getName: (event) => eventTitle(event),
      getDate: (event) => eventStart(event),
    });
  }, [events, searchQuery, sortBy, statusFilter]);

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;

  const hasSearch = searchQuery.trim().length > 0;

  const eventsForSelectedDay = useMemo(() => {
    if (hasSearch) {
      return filteredEvents;
    }
    return filteredEvents.filter((event) => eventDateKey(event) === selectedDayKey);
  }, [filteredEvents, hasSearch, selectedDayKey]);

  const weekDays = useMemo(() => {
    const start = startOfWeekSunday(selectedDay);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDay]);

  const shiftWeekBy = useCallback((deltaWeeks: number) => {
    setSelectedDay((prev) => {
      const ws = startOfWeekSunday(prev);
      const dayIndex = Math.round((stripTime(prev).getTime() - ws.getTime()) / 86400000);
      const newWeekStart = addDays(ws, deltaWeeks * 7);
      return addDays(newWeekStart, dayIndex);
    });
  }, []);

  const totalEvents = String(events.length).padStart(2, '0');
  const todayEvents = useMemo(() => {
    const todayKey = formatLocalYmd(stripTime(new Date()));
    return String(events.filter((event) => eventDateKey(event) === todayKey).length).padStart(2, '0');
  }, [events]);

  if (loading && events.length === 0) {
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
            placeholder="Search events by title, type, or date"
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
      

      

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Calendar</Text>
            <View style={styles.calendarHeaderRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                hitSlop={8}
                style={({ pressed }) => [styles.weekNavBtn, pressed && styles.dim]}
                onPress={() => shiftWeekBy(-1)}
              >
                <Text style={styles.weekNavGlyph}>‹</Text>
              </Pressable>
              <ScheduleIconSvg width={22} height={22} accessibilityLabel="Calendar" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next week"
                hitSlop={8}
                style={({ pressed }) => [styles.weekNavBtn, pressed && styles.dim]}
                onPress={() => shiftWeekBy(1)}
              >
                <Text style={styles.weekNavGlyph}>›</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((day, index) => {
              const key = formatLocalYmd(day);
              const isSelected = key === selectedDayKey;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.dayCell, isSelected && styles.dayCellSelected, pressed && !isSelected && styles.dim]}
                  onPress={() => setSelectedDay(stripTime(day))}
                >
                  <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{DAY_LABELS[index]}</Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.addEventBtn, pressed && styles.dim]} onPress={() => setAddEventOpen(true)}>
          <Text style={styles.addEventBtnText}>+ Add event</Text>
        </Pressable>


        <Text style={styles.daySectionLabel}>
          {hasSearch ? 'Matching events' : formatDisplayLongDate(selectedDay)}
        </Text>

        {eventsForSelectedDay.length === 0 ? (
          hasSearch || filterActive ? (
            <SearchResultsEmpty
              query={searchQuery}
              onClear={() => {
                setSearchQuery('');
                setStatusFilter(null);
                setSortBy(DEFAULT_SORT);
              }}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No events this day</Text>
              <Text style={styles.empty}>Try another date or pull to refresh.</Text>
            </View>
          )
        ) : (
          <View style={styles.listWrap}>
            {eventsForSelectedDay.map((item, index) => (
              <Pressable
                key={String(item.id ?? index)}
                style={({ pressed }) => [styles.card, pressed && styles.dim]}
                onPress={() => setDetailEvent(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{eventTitle(item)}</Text>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{String(item.type || 'Event')}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>Starts: {formatDateTimeDisplay(eventStart(item))}</Text>
                {item.description ? <Text style={styles.desc}>{String(item.description)}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <AddEventModal
        visible={addEventOpen}
        calendarDate={selectedDay}
        onClose={() => setAddEventOpen(false)}
        onCreated={() => load(true)}
      />

      <Modal
        visible={detailEvent != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailEvent(null)}
      >
        <View style={styles.detailModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailEvent(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={styles.detailModalSheet}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle} numberOfLines={2}>
                {detailEvent ? eventTitle(detailEvent) : ''}
              </Text>
              <Pressable onPress={() => setDetailEvent(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.detailModalClose}>✕</Text>
              </Pressable>
            </View>
            {detailEvent ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailModalBody}>
                <View style={styles.detailPillRow}>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{String(detailEvent.type || 'Event')}</Text>
                  </View>
                  {detailEvent.status ? (
                    <View style={[styles.typePill, styles.statusPillInModal]}>
                      <Text style={styles.statusPillTextInModal}>{String(detailEvent.status)}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.detailSectionLabel}>When</Text>
                <View style={styles.detailWhenRow}>
                  <Text style={styles.detailInlineLabel}>Starts</Text>
                  <Text style={styles.detailWhenValue}>{formatDateTimeDisplay(eventStart(detailEvent))}</Text>
                </View>
                <View style={styles.detailWhenRow}>
                  <Text style={styles.detailInlineLabel}>Ends</Text>
                  <Text style={styles.detailWhenValue}>{formatDateTimeDisplay(eventEnd(detailEvent))}</Text>
                </View>

                {detailEvent.description ? (
                  <>
                    <Text style={styles.detailSectionLabel}>Description</Text>
                    <Text style={styles.detailDescription}>{String(detailEvent.description)}</Text>
                  </>
                ) : null}

                {pickEventField(detailEvent, ['job_id', 'jobId']) ? (
                  <>
                    <Text style={styles.detailSectionLabel}>Job</Text>
                    <Text style={styles.detailMono}>{pickEventField(detailEvent, ['job_id', 'jobId'])}</Text>
                  </>
                ) : null}

                {pickEventField(detailEvent, ['customer_name', 'customerName']) ? (
                  <>
                    <Text style={styles.detailSectionLabel}>Customer</Text>
                    <Text style={styles.detailParagraph}>{pickEventField(detailEvent, ['customer_name', 'customerName'])}</Text>
                  </>
                ) : null}
                {pickEventField(detailEvent, ['customer_address', 'address']) ? (
                  <Text style={styles.detailParagraph}>{pickEventField(detailEvent, ['customer_address', 'address'])}</Text>
                ) : null}
                {pickEventField(detailEvent, ['customer_zip', 'zip', 'zip_code']) ? (
                  <Text style={styles.detailParagraph}>{pickEventField(detailEvent, ['customer_zip', 'zip', 'zip_code'])}</Text>
                ) : null}
                {pickEventField(detailEvent, ['customer_phone', 'phone']) ? (
                  <Text style={styles.detailParagraph}>{pickEventField(detailEvent, ['customer_phone', 'phone'])}</Text>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={SCHEDULE_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={statusFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setStatusFilter(status);
          setSortBy(sort);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
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
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6, marginTop: 1 },
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
    fontWeight: '400',
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
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, fontWeight: '400', marginTop: 0 },
  addEventBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addEventBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2D74E8',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '500' },
  summaryLabel: { color: '#DCE7FF', fontSize: 12, fontWeight: '500', marginTop: 1 },
  calendarCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  calendarHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekNavBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavGlyph: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayLabelSelected: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  daySectionLabel: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  emptyWrap: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
  },
  listWrap: { marginTop: 12, gap: 10 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    padding: 14,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  typePill: {
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },
  desc: {
    color: colors.textPrimary,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  detailModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  detailModalTitle: {
    flex: 1,
    color: '#1D2D44',
    fontSize: 18,
    fontWeight: '700',
  },
  detailModalClose: {
    color: '#4B5563',
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  detailModalBody: {
    paddingBottom: 12,
  },
  detailPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusPillInModal: {
    backgroundColor: '#E8F2FF',
  },
  statusPillTextInModal: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  detailSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
  },
  detailWhenRow: {
    marginBottom: 10,
  },
  detailInlineLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailWhenValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  detailDescription: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  detailParagraph: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 4,
  },
  detailMono: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  dim: { opacity: 0.88 },
});
