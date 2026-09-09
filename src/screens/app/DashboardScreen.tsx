import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { loadMobileConfig } from '../../services/api/configService';
import { portalService } from '../../services/api/portalService';
import { useAuth } from '../../context/AuthContext';
import { navigateToProfileTab } from '../../navigation/navigateToProfileTab';
import { getProfileHeaderDisplayName } from '../../components/PortalProfileHeaderButton';
import { UserAvatar } from '../../components/UserAvatar';
import { colors } from '../../theme/colors';
import { DashboardMap, type DashboardMapHandle } from '../../components/DashboardMap';
import type { DashboardHailSlide, DashboardMapCenter } from '../../types/dashboard';
import { parseDashboardPayload, type DashboardStats } from '../../utils/dashboardMapping';
import { latestHailDateFromTable } from '../../utils/nexradMapGeoJson';
import { setGoogleMapsApiKey } from '../../utils/projectMapImage';
import { subscriptionPlanLabel } from '../../utils/profileMapping';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { SearchResultsEmpty } from '../../components/SearchResultsEmpty';
import { matchesSearchQuery } from '../../utils/listFiltering';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import {
  DEFAULT_WEATHER_COORDS,
  fetchCurrentWeather,
  type WeatherCondition,
  type WeatherSnapshot,
} from '../../services/api/weatherService';
import { DASHBOARD_HAIL_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import JobIconSvg from '../../assets/icons/job-icon.svg';
import ScheduleIconSvg from '../../assets/icons/schedule-icon.svg';
import RequestIconSvg from '../../assets/icons/request-icon.svg';
import MapIconSvg from '../../assets/icons/map-icon.svg';

const HEADER_BLUE = '#1A4FD8';
const HEADER_BLUE_MID = '#2B63E8';
const HEADER_BLUE_DEEP = '#0E3BB8';

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

function HamburgerGlyph(): React.JSX.Element {
  return (
    <View style={styles.hamburger}>
      <View style={[styles.hamburgerLine, styles.hamburgerLineFirst]} />
      <View style={styles.hamburgerLine} />
      <View style={styles.hamburgerLine} />
    </View>
  );
}

function WhiteBellIcon(): React.JSX.Element {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M18 16v-5a6 6 0 1 0-12 0v5l-1.8 1.8A1 1 0 0 0 5 20h14a1 1 0 0 0 .8-1.6L18 16Z"
        stroke="#FFFFFF"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M10 20a2 2 0 0 0 4 0" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function WeatherIcon({ condition }: { condition: WeatherCondition }): React.JSX.Element {
  if (condition === 'clear') {
    return (
      <Svg width={36} height={28} viewBox="0 0 36 28" fill="none" accessibilityElementsHidden>
        <Circle cx={18} cy={14} r={8} fill="#F6C344" />
      </Svg>
    );
  }

  if (condition === 'rain' || condition === 'storm') {
    return (
      <Svg width={36} height={28} viewBox="0 0 36 28" fill="none" accessibilityElementsHidden>
        <Ellipse cx={18} cy={12} rx={12} ry={7} fill="#FFFFFF" />
        <Path d="M12 20l-1.5 4M18 20l-1.5 4M24 20l-1.5 4" stroke="#B8D4FF" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (condition === 'snow') {
    return (
      <Svg width={36} height={28} viewBox="0 0 36 28" fill="none" accessibilityElementsHidden>
        <Ellipse cx={18} cy={12} rx={12} ry={7} fill="#FFFFFF" />
        <Path d="M12 20l0 3M18 20l0 3M24 20l0 3" stroke="#E8F1FF" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (condition === 'cloudy' || condition === 'fog') {
    return (
      <Svg width={36} height={28} viewBox="0 0 36 28" fill="none" accessibilityElementsHidden>
        <Ellipse cx={14} cy={16} rx={11} ry={7} fill="#FFFFFF" />
        <Ellipse cx={23} cy={17} rx={9} ry={6} fill="#F3F7FF" />
      </Svg>
    );
  }

  // partlyCloudy (default) — matches mock sun behind cloud
  return (
    <Svg width={36} height={28} viewBox="0 0 36 28" fill="none" accessibilityElementsHidden>
      <Circle cx={24} cy={11} r={7} fill="#F6C344" />
      <Ellipse cx={14} cy={18} rx={11} ry={7} fill="#FFFFFF" />
      <Ellipse cx={22} cy={19} rx={8} ry={5.5} fill="#F3F7FF" />
    </Svg>
  );
}

function HeaderWaveBackground(): React.JSX.Element {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 220" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLinearGradient id="dashHeaderGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={HEADER_BLUE_DEEP} />
            <Stop offset="0.45" stopColor={HEADER_BLUE} />
            <Stop offset="1" stopColor={HEADER_BLUE_MID} />
          </SvgLinearGradient>
        </Defs>
        <Path d="M0 0h390v220H0z" fill="url(#dashHeaderGrad)" />
        <Path
          d="M-40 40C40 10 90 90 160 70C230 50 280 0 360 30C420 52 450 100 480 80V230H-40V40Z"
          fill="rgba(255,255,255,0.06)"
        />
        <Path
          d="M-30 110C50 80 110 150 190 130C270 110 310 60 400 95C450 115 470 160 510 150V240H-30V110Z"
          fill="rgba(255,255,255,0.05)"
        />
        <Path
          d="M-20 160C70 140 130 200 210 185C290 170 340 130 430 155V240H-20V160Z"
          fill="rgba(10,40,140,0.18)"
        />
      </Svg>
    </View>
  );
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good Morning';
  }
  if (hour < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

function formatWeatherLocation(map: DashboardMapCenter | null): string {
  const address = map?.address?.trim();
  if (address) {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const city = parts[parts.length - 2];
      const stateZip = parts[parts.length - 1];
      const state = stateZip.split(/\s+/)[0];
      if (city && state) {
        return `${city}, ${state}`;
      }
    }
    return parts[0];
  }
  if (map?.zip_code?.trim()) {
    return map.zip_code.trim();
  }
  return 'Your area';
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
            accessibilityLabel="Show Impact"
          >
            <Text style={styles.promoCtaText}>Show Impact</Text>
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
  const { user } = useAuth();
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
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<DashboardMapHandle>(null);
  const mapSectionOffsetY = useRef(0);

  const displayName = useMemo(() => getProfileHeaderDisplayName(user, true), [user]);
  const [greetingLine, setGreetingLine] = useState(
    () => `${timeOfDayGreeting()}! Your home is protected.`,
  );
  const weatherLocation = useMemo(() => formatWeatherLocation(mapCenter), [mapCenter]);

  useFocusEffect(
    useCallback(() => {
      const refreshGreeting = () => {
        setGreetingLine(`${timeOfDayGreeting()}! Your home is protected.`);
      };
      refreshGreeting();
      const timer = setInterval(refreshGreeting, 60_000);
      return () => clearInterval(timer);
    }, []),
  );
  const mapPlanName = useMemo(() => {
    if (!user) {
      return null;
    }
    const named =
      (typeof user.plan_name === 'string' && user.plan_name) ||
      (typeof user.plan_display === 'string' && user.plan_display) ||
      (typeof user.PlanName === 'string' && user.PlanName) ||
      '';
    if (named) {
      return named;
    }
    const planId = user.subscriptions_plan ?? user.SubscriptionsPlan;
    if (planId != null && String(planId).trim() !== '') {
      return subscriptionPlanLabel(String(planId));
    }
    return null;
  }, [user]);

  const loadWeather = useCallback(async (latitude: number, longitude: number) => {
    try {
      const snapshot = await fetchCurrentWeather(latitude, longitude);
      setWeather(snapshot);
    } catch {
      // Keep last known weather; header stays usable without a toast.
    }
  }, []);

  const resolveWeatherCoords = useCallback((map: DashboardMapCenter | null | undefined) => {
    const lat = Number(map?.latitude);
    const lng = Number(map?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      return { latitude: lat, longitude: lng };
    }
    return DEFAULT_WEATHER_COORDS;
  }, []);

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

      const coords = resolveWeatherCoords(parsed.map);
      await loadWeather(coords.latitude, coords.longitude);
    } catch (error) {
      toastAlert('Dashboard', error instanceof Error ? error.message : 'Unable to load dashboard.');
    } finally {
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [loadWeather, resolveWeatherCoords]);

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

  const openProfile = useCallback(() => {
    navigateToProfileTab(navigation as Parameters<typeof navigateToProfileTab>[0]);
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
    // Open after scroll so the map is in view when the sheet appears.
    setTimeout(() => {
      mapRef.current?.openImpact();
    }, 350);
  }, [scrollToInteractiveMap]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BLUE_DEEP} />

      <View style={styles.headerBlue}>
        <HeaderWaveBackground />

        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <Image
              source={require('../../assets/images/harbour-logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="HarborShield logo"
            />
            <View style={styles.brandTextBlock}>
              <Text style={styles.brandTitle}>HARBORSHIELD360</Text>
              <Text style={styles.brandTagline}>Protecting What Matters Most</Text>
            </View>
          </View>
          <NotificationBellPressable
            icon={<WhiteBellIcon />}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.headerPressableDim]}
          />
        </View>

        <View style={styles.userWeatherRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${displayName}, open profile`}
            onPress={openProfile}
            style={({ pressed }) => [styles.userBlock, pressed && styles.headerPressableDim]}
          >
            <UserAvatar
              avatar={user?.avatar}
              avatarUrl={user?.avatar_url}
              size={40}
              radius={20}
              fallbackVariant="light"
            />
            <View style={styles.userTextBlock}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userGreeting} numberOfLines={2}>
                {greetingLine}
              </Text>
            </View>
          </Pressable>

          <View style={styles.weatherBlock}>
            <WeatherIcon condition={weather?.condition ?? 'partlyCloudy'} />
            <View style={styles.weatherTextBlock}>
              <Text style={styles.weatherTemp}>
                {weather ? `${weather.temperatureF}°F` : '—°F'}
              </Text>
              <Text style={styles.weatherLocation} numberOfLines={1}>
                {weatherLocation}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.whiteSheet}>
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
                ref={mapRef}
                map={mapCenter}
                preferredHailDate={preferredHailDate}
                planName={mapPlanName}
                onScrollEnabledChange={setDashboardScrollEnabled}
              />
            </View>
          </ScrollView>
        )}
      </View>

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
    backgroundColor: HEADER_BLUE_DEEP,
  },
  headerBlue: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingRight: 12,
  },
  brandLogo: {
    width: 42,
    height: 42,
  },
  brandTextBlock: {
    marginLeft: 10,
    flexShrink: 1,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userTextBlock: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  userGreeting: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 16,
  },
  weatherBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  weatherTextBlock: {
    marginLeft: 6,
    alignItems: 'flex-start',
  },
  weatherTemp: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  weatherLocation: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '400',
    maxWidth: 110,
  },
  whiteSheet: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -14,
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  headerPressableDim: {
    opacity: 0.88,
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
    marginBottom: 4,
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
    marginHorizontal: -16,
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
