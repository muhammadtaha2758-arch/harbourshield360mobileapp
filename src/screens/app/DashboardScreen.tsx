import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { loadMobileConfig } from '../../services/api/configService';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { DashboardMap } from '../../components/DashboardMap';
import type { DashboardHailSlide, DashboardMapCenter } from '../../types/dashboard';
import { parseDashboardPayload, type DashboardStats } from '../../utils/dashboardMapping';
import { latestHailDateFromTable } from '../../utils/nexradMapGeoJson';
import { setGoogleMapsApiKey } from '../../utils/projectMapImage';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { matchesSearchQuery } from '../../utils/listFiltering';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { DASHBOARD_HAIL_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import JobIconSvg from '../../assets/icons/job-icon.svg';
import ScheduleIconSvg from '../../assets/icons/schedule-icon.svg';
import RequestIconSvg from '../../assets/icons/request-icon.svg';
import MapIconSvg from '../../assets/icons/map-icon.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = SCREEN_WIDTH;
const CARD_INNER_WIDTH = PAGE_WIDTH - 32;

interface PromoSlide {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  isHail?: boolean;
  maxHailInches?: number;
}

const DEFAULT_PROMO_SLIDES: PromoSlide[] = [
  {
    id: '1',
    title: 'Season readiness',
    subtitle: 'Review your coverage before storm season.',
    date: '',
    isHail: false,
  },
];

function formatStat(n: number): string {
  return String(n).padStart(2, '0');
}

function PersonOutlineGlyph(): React.JSX.Element {
  return (
    <View style={styles.personGlyph}>
      <View style={styles.personHeadRing} />
      <View style={styles.personShoulders} />
    </View>
  );
}

function HamburgerGlyph(): React.JSX.Element {
  return (
    <View style={styles.hamburger}>
      <View style={[styles.hamburgerLine, styles.hamburgerLineFirst]} />
      <View style={styles.hamburgerLine} />
      <View style={styles.hamburgerLine} />
    </View>
  );
}

function PromoCard({ item, onViewMore }: { item: PromoSlide; onViewMore: () => void }): React.JSX.Element {
  return (
    <View style={styles.promoCardOuter}>
      <View style={styles.promoCard}>
        <ImageBackground
          source={require('../../assets/images/hail-impact-background.png')}
          style={styles.promoBgImage}
          resizeMode="cover"
        />
        <View style={styles.promoContent}>
          <View style={styles.promoWarnBadge}>
            <Text style={styles.promoWarn}>⚠</Text>
          </View>
          <Text style={styles.promoTitle}>{item.title}</Text>
          <Text style={styles.promoSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
          {item.date ? <Text style={styles.promoDate}>{item.date}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.promoCta, pressed && styles.promoCtaPressed]}
            onPress={onViewMore}
            accessibilityRole="button"
            accessibilityLabel="View more hail and map details"
          >
            <Text style={styles.promoCtaText}>View More</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  onPress?: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={({ pressed }) => [styles.statCard, pressed && styles.headerPressableDim]} onPress={onPress}>
      <View>
        <View style={styles.statIconWrap}>{icon}</View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </Pressable>
  );
}

function hailSlideToPromo(slide: DashboardHailSlide): PromoSlide {
  return {
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    date: slide.date,
    isHail: slide.maxHailInches > 0 || slide.title.toLowerCase().includes('hail'),
    maxHailInches: slide.maxHailInches,
  };
}

export function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [stats, setStats] = useState<DashboardStats>({ activeJobs: 0, schedules: 0, requestedServices: 0 });
  const [allPromoSlides, setAllPromoSlides] = useState<PromoSlide[]>(DEFAULT_PROMO_SLIDES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<DashboardMapCenter | null>(null);
  const [preferredHailDate, setPreferredHailDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [dashboardScrollEnabled, setDashboardScrollEnabled] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const mapSectionOffsetY = useRef(0);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      await loadMobileConfig();
      const payload = await portalService.getDashboard();
      const mapsKey = payload.google_maps_api_key?.trim();
      if (mapsKey) {
        setGoogleMapsApiKey(mapsKey);
      }
      const parsed = parseDashboardPayload(payload);
      setStats(parsed.stats);
      setMapCenter(parsed.map ?? null);
      setPreferredHailDate(latestHailDateFromTable(payload.hail_table));
      const slides = parsed.slides.map(hailSlideToPromo);
      setAllPromoSlides(slides.length > 0 ? slides : DEFAULT_PROMO_SLIDES);
      setCarouselIndex(0);
    } catch (error) {
      toastAlert('Dashboard', error instanceof Error ? error.message : 'Unable to load dashboard.');
    } finally {
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => setHasLoadedOnce(true));
  }, [loadDashboard]);

  const promoSlides = useMemo(() => {
    let list = allPromoSlides;
    if (statusFilter === 'hail') {
      list = list.filter((slide) => slide.isHail !== false && (slide.maxHailInches ?? 0) > 0);
    }
    return applyListFilters(list, {
      searchQuery,
      searchFields: (slide) => [slide.title, slide.subtitle, slide.date],
      sort: sortBy,
      getName: (slide) => slide.title,
      getDate: (slide) => slide.date,
    });
  }, [allPromoSlides, searchQuery, sortBy, statusFilter]);

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;
  const hasSearch = searchQuery.trim().length > 0;

  const statCards = useMemo(
    () => [
      { key: 'jobs', label: 'Active Jobs', tab: 'ProjectsTab', value: formatStat(stats.activeJobs), icon: 'jobs' as const },
      { key: 'schedule', label: 'Schedules', tab: 'ScheduleTab', value: formatStat(stats.schedules), icon: 'schedule' as const },
      {
        key: 'services',
        label: 'Requested Services',
        tab: 'ServiceRequestsTab',
        value: formatStat(stats.requestedServices),
        icon: 'services' as const,
      },
    ],
    [stats.activeJobs, stats.requestedServices, stats.schedules],
  );

  const visibleStatCards = useMemo(() => {
    if (!hasSearch) {
      return statCards;
    }
    return statCards.filter((card) => matchesSearchQuery(searchQuery, [card.label, card.key]));
  }, [hasSearch, searchQuery, statCards]);

  const onCarouselScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / PAGE_WIDTH);
    setCarouselIndex(Math.min(Math.max(idx, 0), Math.max(promoSlides.length - 1, 0)));
  }, [promoSlides.length]);

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const navigateToTab = useCallback(
    (tabName: string) => {
      navigation.navigate(tabName as never);
    },
    [navigation],
  );

  const scrollToInteractiveMap = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, mapSectionOffsetY.current - 12),
      animated: true,
    });
  }, []);

  const onPromoViewMore = useCallback(() => {
    scrollToInteractiveMap();
  }, [scrollToInteractiveMap]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.headerPressableDim]} />
        </View>

        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            onPress={openDrawer}
            style={({ pressed }) => [styles.iconTile, pressed && styles.headerPressableDim]}
          >
            <HamburgerGlyph />
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search alerts, jobs, schedule, or services"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      {!hasLoadedOnce ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={dashboardScrollEnabled}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} tintColor={colors.primary} />
          }
        >
          <View style={styles.carouselWrap}>
            {promoSlides.length === 0 && hasSearch ? (
              <SearchResultsEmpty
                query={searchQuery}
                onClear={() => {
                  setSearchQuery('');
                  setStatusFilter(null);
                  setSortBy(DEFAULT_SORT);
                }}
              />
            ) : null}
            <FlatList
              data={promoSlides}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              initialScrollIndex={0}
              initialNumToRender={promoSlides.length}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onCarouselScroll}
              onScrollEndDrag={onCarouselScroll}
              getItemLayout={(_, index) => ({
                length: PAGE_WIDTH,
                offset: PAGE_WIDTH * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={styles.carouselPage}>
                  <PromoCard item={item} onViewMore={onPromoViewMore} />
                </View>
              )}
            />
            <View style={styles.dotsRow}>
              {promoSlides.map((slide, i) => (
                <View
                  key={slide.id}
                  style={[styles.dot, i === carouselIndex ? styles.dotActive : styles.dotInactive]}
                />
              ))}
            </View>
          </View>

          {visibleStatCards.length > 0 ? (
            <View style={styles.statsRow}>
              {visibleStatCards.map((card) => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  icon={
                    card.icon === 'jobs' ? (
                      <JobIconSvg width={28} height={24} accessibilityLabel="Active jobs" />
                    ) : card.icon === 'schedule' ? (
                      <ScheduleIconSvg width={26} height={26} accessibilityLabel="Schedules" />
                    ) : (
                      <RequestIconSvg width={22} height={26} accessibilityLabel="Requested services" />
                    )
                  }
                  onPress={() => navigateToTab(card.tab)}
                />
              ))}
            </View>
          ) : hasSearch ? (
            <SearchResultsEmpty
              query={searchQuery}
              message="Try keywords like jobs, schedule, or services."
              onClear={() => {
                setSearchQuery('');
                setStatusFilter(null);
                setSortBy(DEFAULT_SORT);
              }}
            />
          ) : null}

          <View
            style={styles.mapSection}
            onLayout={(event) => {
              mapSectionOffsetY.current = event.nativeEvent.layout.y;
            }}
          >
              <View style={styles.mapSectionHeader}>
                <View style={styles.mapIconWrap}>
                  <MapIconSvg width={22} height={20} accessibilityLabel="Map" />
                </View>
                <View style={styles.mapTitleBlock}>
                  <Text style={styles.mapTitle}>Canvassing Map</Text>
                  <Text style={styles.mapSubtitle}>
                    Comprehensive map with hail impact data and property information.
                  </Text>
                </View>
              </View>
              <DashboardMap
                map={mapCenter}
                preferredHailDate={preferredHailDate}
                onScrollEnabledChange={setDashboardScrollEnabled}
              />
            
          </View>
        </ScrollView>
      )}

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter dashboard"
        statusOptions={DASHBOARD_HAIL_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={statusFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setStatusFilter(status);
          setSortBy(sort);
          setCarouselIndex(0);
        }}
      />
    </SafeAreaView>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      }
    : { elevation: 3 };

const headerLift =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      }
    : { elevation: 2 };

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '72%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    ...headerLift,
  },
  headerPressableDim: {
    opacity: 0.88,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.avatarSoftFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personGlyph: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 22,
    paddingTop: 2,
  },
  personHeadRing: {
    width: 9,
    height: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  personShoulders: {
    marginTop: 1,
    width: 14,
    height: 7,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: colors.primaryDark,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginLeft: 10,
  },
  chevron: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 6,
    marginTop: 1,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...headerLift,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
    ...headerLift,
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
  hamburger: {
    justifyContent: 'center',
  },
  hamburgerLine: {
    width: 18,
    height: 2,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    marginTop: 4,
  },
  hamburgerLineFirst: {
    marginTop: 0,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  carouselWrap: {
    marginTop: 16,
  },
  carouselPage: {
    width: PAGE_WIDTH,
    alignItems: 'center',
  },
  promoCardOuter: {
    width: CARD_INNER_WIDTH,
    alignSelf: 'center',
  },
  promoCard: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 168,
    borderTopWidth: 1,
    borderTopColor: '#5CAAF6',
    ...cardShadow,
  },
  promoBgImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  promoContent: {
    padding: 18,
    paddingTop: 16,
  },
  promoWarnBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#BFD9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promoWarn: {
    color: '#1E4D9C',
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '600',
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  promoSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  promoDate: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginBottom: 12,
  },
  promoCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  promoCtaPressed: {
    opacity: 0.92,
  },
  promoCtaText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: 14,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    height: 107,
    justifyContent: 'space-between',
    ...cardShadow,
  },
  statIconWrap: {
    marginBottom: 3,
    justifyContent: 'flex-start',
    width: 29,
    height: 29,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.primary,
    alignSelf: 'flex-end',
    marginTop: -5,
  },
  mapSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
   
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
   
    paddingTop: 16,
    paddingBottom: 10,
  },
  mapIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#b3d8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitleBlock: {
    flex: 1,
    paddingTop: 2,
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  mapSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '400',
    lineHeight: 15,
    marginBottom: 8,
  },
});
