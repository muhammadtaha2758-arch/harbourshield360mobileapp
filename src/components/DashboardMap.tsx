import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import type { DashboardMapCenter } from '../types/dashboard';
import { buildDashboardMapHtml } from '../utils/dashboardMapHtml';
import { getGoogleMapsApiKey } from '../utils/projectMapImage';
import { loadDashboardHailOverlay, type DashboardHailOverlay } from '../utils/nexradMapGeoJson';
import { ImpactReportSheet } from './ImpactReportSheet';

type Props = {
  map?: DashboardMapCenter | null;
  preferredHailDate?: string | null;
  /** Subscription / plan name for bronze|silver|gold|platinum shield marker. */
  planName?: string | null;
  /** Disable parent ScrollView while the user pans/zooms the map. */
  onScrollEnabledChange?: (enabled: boolean) => void;
};

export type DashboardMapHandle = {
  openImpact: () => void;
};

const DEFAULT_CENTER = { lat: 38.9072, lng: -77.0369 };

const EMPTY_HAIL: DashboardHailOverlay = {
  geoJson: null,
  dateKey: null,
  statusMessage: '',
};

function resolveMapCoords(map?: DashboardMapCenter | null): { lat: number; lng: number } | null {
  const lat = map?.latitude != null ? Number(map.latitude) : NaN;
  const lng = map?.longitude != null ? Number(map.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return null;
}

function ExpandIcon(): React.JSX.Element {
  return (
    <View style={styles.expandIcon} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.expandArm, styles.expandArmTopLeft]} />
      <View style={[styles.expandArm, styles.expandArmTopRight]} />
      <View style={[styles.expandArm, styles.expandArmBottomLeft]} />
      <View style={[styles.expandArm, styles.expandArmBottomRight]} />
    </View>
  );
}

type MapWebViewProps = {
  html: string;
  webViewKey: string;
  style?: StyleProp<ViewStyle>;
};

function MapWebView({ html, webViewKey, style }: MapWebViewProps): React.JSX.Element {
  return (
    <WebView
      key={webViewKey}
      source={{ html }}
      style={[styles.webview, style]}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      androidLayerType="hardware"
      nestedScrollEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      cacheEnabled
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      onError={() => undefined}
    />
  );
}

export const DashboardMap = forwardRef<DashboardMapHandle, Props>(function DashboardMap(
  { map, preferredHailDate, planName, onScrollEnabledChange },
  ref,
): React.JSX.Element {
  const apiKey = getGoogleMapsApiKey();
  const coords = resolveMapCoords(map);
  const lat = coords?.lat ?? DEFAULT_CENTER.lat;
  const lng = coords?.lng ?? DEFAULT_CENTER.lng;
  const hasCoords = coords != null;
  const [hailOverlay, setHailOverlay] = useState<DashboardHailOverlay>(EMPTY_HAIL);
  const [hailLoading, setHailLoading] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const [selectedHailDate, setSelectedHailDate] = useState<string | null>(null);

  const effectiveHailDate = selectedHailDate ?? preferredHailDate ?? null;

  useImperativeHandle(
    ref,
    () => ({
      openImpact: () => {
        if (hasCoords) {
          setImpactOpen(true);
        }
      },
    }),
    [hasCoords],
  );

  useEffect(() => {
    if (!hasCoords) {
      setHailOverlay(EMPTY_HAIL);
      return;
    }

    let cancelled = false;
    setHailLoading(true);
    loadDashboardHailOverlay(lat, lng, effectiveHailDate)
      .then((result) => {
        if (!cancelled) {
          setHailOverlay(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHailOverlay({
            geoJson: null,
            dateKey: null,
            statusMessage: 'Hail overlays unavailable.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasCoords, lat, lng, effectiveHailDate]);

  const html = useMemo(() => {
    if (!apiKey) {
      return '';
    }
    return buildDashboardMapHtml({
      apiKey,
      lat: hasCoords ? lat : 0,
      lng: hasCoords ? lng : 0,
      address: map?.address?.trim() || '',
      zoom: hasCoords ? 17 : 14,
      geocodeAddress: !hasCoords && Boolean(map?.address?.trim()),
      hailGeoJson: hailOverlay.geoJson,
      hailStatus: hailOverlay.statusMessage,
      planName,
    });
  }, [apiKey, hasCoords, lat, lng, map?.address, hailOverlay.geoJson, hailOverlay.statusMessage, planName]);

  const webViewKey = `${hasCoords ? `${lat}-${lng}` : 'geo'}-${hailOverlay.dateKey ?? 'none'}-${hailOverlay.geoJson?.features?.length ?? 0}`;

  const releaseParentScroll = useCallback(() => {
    onScrollEnabledChange?.(true);
  }, [onScrollEnabledChange]);

  const lockParentScroll = useCallback(() => {
    onScrollEnabledChange?.(false);
  }, [onScrollEnabledChange]);

  const openFullscreen = useCallback(() => {
    lockParentScroll();
    setFullscreenOpen(true);
  }, [lockParentScroll]);

  const closeFullscreen = useCallback(() => {
    setFullscreenOpen(false);
    releaseParentScroll();
  }, [releaseParentScroll]);

  const mapUnavailable = !apiKey || !html;

  return (
    <>
      <View style={styles.clip}>
        <View
          style={styles.mapFrame}
          onTouchStart={lockParentScroll}
          onTouchEnd={releaseParentScroll}
          onTouchCancel={releaseParentScroll}
        >
          {mapUnavailable ? (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>Interactive map</Text>
              <Text style={styles.fallbackText}>
                {apiKey
                  ? map?.address?.trim() || 'Add a property address in Profile.'
                  : 'Loading map configuration...'}
              </Text>
            </View>
          ) : (
            <MapWebView html={html} webViewKey={webViewKey} />
          )}

          {hailLoading ? (
            <View style={styles.hailLoadingBadge} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.hailLoadingText}>Loading hail…</Text>
            </View>
          ) : null}

          {!mapUnavailable && hasCoords ? (
            <Pressable
              style={({ pressed }) => [styles.impactBtn, pressed && styles.fullscreenBtnPressed]}
              onPress={() => setImpactOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Show Impact"
            >
              <Text style={styles.impactBtnText}>Show Impact</Text>
            </Pressable>
          ) : null}

          {!mapUnavailable ? (
            <Pressable
              style={({ pressed }) => [styles.fullscreenBtn, pressed && styles.fullscreenBtnPressed]}
              onPress={openFullscreen}
              accessibilityRole="button"
              accessibilityLabel="Open map in full screen"
            >
              <ExpandIcon />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chevronBar}>
          <Text style={styles.chevron}>▼</Text>
        </View>
      </View>

      <Modal visible={fullscreenOpen} animationType="slide" onRequestClose={closeFullscreen}>
        <SafeAreaView style={styles.fullscreenSafe} edges={['top', 'bottom']}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Interactive Map</Text>
            <View style={styles.fullscreenHeaderActions}>
              {hasCoords ? (
                <Pressable
                  style={({ pressed }) => [styles.impactBtnHeader, pressed && styles.fullscreenBtnPressed]}
                  onPress={() => setImpactOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Show Impact"
                >
                  <Text style={styles.impactBtnText}>Show Impact</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.fullscreenCloseBtn, pressed && styles.fullscreenBtnPressed]}
                onPress={closeFullscreen}
                accessibilityRole="button"
                accessibilityLabel="Close full screen map"
              >
                <Text style={styles.fullscreenCloseText}>✕</Text>
              </Pressable>
            </View>
          </View>
          <View
            style={styles.fullscreenMapWrap}
            onTouchStart={lockParentScroll}
            onTouchEnd={releaseParentScroll}
            onTouchCancel={releaseParentScroll}
          >
            {!mapUnavailable ? (
              <MapWebView html={html} webViewKey={`${webViewKey}-fullscreen`} style={styles.fullscreenWebview} />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      {hasCoords ? (
        <ImpactReportSheet
          visible={impactOpen}
          lat={lat}
          lng={lng}
          address={map?.address}
          onClose={() => setImpactOpen(false)}
          onShowOnMap={(dateKey) => {
            setSelectedHailDate(dateKey);
            setFullscreenOpen(true);
          }}
        />
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  clip: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8EEF8',
  },
  mapFrame: {
    height: 300,
    position: 'relative',
    backgroundColor: '#DDE8F8',
    overflow: 'hidden',
  },
  webview: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#DDE8F8',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDE8F8',
  },
  hailLoadingBadge: {
    position: 'absolute',
    left: 10,
    top: 48,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hailLoadingText: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '600',
  },
  impactBtn: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  impactBtnHeader: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  impactBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fullscreenBtn: {
    position: 'absolute',
    right: 10,
    top: 48,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,116,232,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  fullscreenBtnPressed: {
    opacity: 0.88,
  },
  expandIcon: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  expandArm: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: colors.primary,
  },
  expandArmTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  expandArmTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  expandArmBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  expandArmBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  fallback: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  fallbackText: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  chevronBar: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chevron: {
    color: colors.primary,
    fontSize: 12,
  },
  fullscreenSafe: {
    flex: 1,
    backgroundColor: colors.dashboardCanvas,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E3EAF6',
    backgroundColor: '#FFFFFF',
  },
  fullscreenHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullscreenTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fullscreenCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  fullscreenMapWrap: {
    flex: 1,
    backgroundColor: '#DDE8F8',
  },
  fullscreenWebview: {
    flex: 1,
  },
});
