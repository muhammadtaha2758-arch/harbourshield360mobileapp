import React, { useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildProjectSatelliteMapHtml } from '../utils/projectSatelliteMapHtml';
import { buildProjectMapImageUrlFromAddress, getGoogleMapsApiKey } from '../utils/projectMapImage';

type Props = {
  address?: string | null;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Remount WebView when project changes (deck swipe). */
  mapKey?: string | number;
};

export function ProjectSatelliteMap({
  address,
  width = 640,
  height = 410,
  style,
  mapKey = 'default',
}: Props): React.JSX.Element {
  const apiKey = getGoogleMapsApiKey();
  const trimmedAddress = typeof address === 'string' ? address.trim() : '';

  const html = useMemo(() => {
    if (!apiKey) {
      return '';
    }
    return buildProjectSatelliteMapHtml({
      apiKey,
      address: trimmedAddress || undefined,
      zoom: 17,
    });
  }, [apiKey, trimmedAddress]);

  const staticFallbackUri = useMemo(() => {
    if (html) {
      return null;
    }
    return buildProjectMapImageUrlFromAddress(trimmedAddress || null, { width, height, zoom: 17 });
  }, [html, trimmedAddress, width, height]);

  if (html) {
    return (
      <WebView
        key={mapKey}
        source={{ html }}
        style={[styles.map, style]}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        pointerEvents="none"
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
        onError={() => undefined}
      />
    );
  }

  if (staticFallbackUri) {
    return (
      <Image
        key={mapKey}
        source={{ uri: staticFallbackUri, cache: 'reload' }}
        style={[styles.map, style]}
        resizeMode="cover"
      />
    );
  }

  return <View style={[styles.fallback, style]} />;
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7D8B9A',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#7D8B9A',
  },
});
