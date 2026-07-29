import { env } from '../config/env';
import { resolveHarbourShieldMarkerIcon } from './harbourShieldMapMarkers';

export type DashboardMapHtmlConfig = {
  apiKey: string;
  lat: number;
  lng: number;
  address?: string;
  zoom?: number;
  geocodeAddress?: boolean;
  /** Pre-loaded hail polygons from RN (avoids WebView fetch / CORS). */
  hailGeoJson?: { type: string; features: unknown[] } | null;
  hailStatus?: string;
  /** Subscription / plan name for bronze|silver|gold|platinum shield. */
  planName?: string | null;
};

/**
 * Interactive Google Map + NEXRAD hail swaths (same stack as web full-map.vue / home.vue).
 * Rendered inside react-native-webview because Static Maps URLs often fail in the RN Image component.
 */
export function buildDashboardMapHtml(config: DashboardMapHtmlConfig): string {
  const apiBase = env.apiBaseUrl.replace(/\/$/, '');
  const lat = Number(config.lat);
  const lng = Number(config.lng);
  const zoom = config.zoom ?? 17;
  const apiKey = config.apiKey.replace(/'/g, "\\'");
  const address = (config.address ?? '').replace(/'/g, "\\'");
  const markerIconUrl = resolveHarbourShieldMarkerIcon(config.planName);

  const payload = JSON.stringify({
    apiBase,
    lat,
    lng,
    zoom,
    address,
    geocodeAddress: config.geocodeAddress === true,
    hailGeoJson: config.hailGeoJson ?? null,
    hailStatus: config.hailStatus ?? '',
    markerIconUrl,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map {
      margin: 0; padding: 0; height: 100%; width: 100%; background: #dde8f8;
      touch-action: none; overscroll-behavior: none;
    }
    #status {
      position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
      background: rgba(255,255,255,0.92); color: #1d2d44; font: 12px/16px sans-serif;
      padding: 6px 10px; text-align: center;
    }
    #address-chip {
      position: absolute; top: 10px; left: 10px; z-index: 2;
      max-width: calc(100% - 156px);
      background: rgba(255,255,255,0.92); border-radius: 8px; padding: 6px 10px;
      color: #1d2d44; font: 600 11px/14px sans-serif;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      pointer-events: none;
    }
    #legend {
      position: absolute; left: 8px; bottom: 36px; z-index: 2;
      background: rgba(255,255,255,0.94); border-radius: 8px; padding: 6px 8px;
      display: flex; flex-wrap: wrap; gap: 6px 8px; max-width: 92%;
    }
    .legend-item { display: flex; align-items: center; gap: 4px; font: 600 9px/11px sans-serif; color: #344054; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="address-chip"></div>
  <div id="legend"></div>
  <div id="status">Loading map...</div>
  <script>
    const CFG = ${payload};
    let map = null;
    let propertyMarker = null;

    function setStatus(msg) {
      const el = document.getElementById('status');
      if (el) el.textContent = msg || '';
    }

    function getHailSizeColor(hailsize) {
      const size = parseFloat(hailsize) || 0.5;
      if (size >= 3.0) return '#5c0000';
      if (size >= 2.75) return '#880e4f';
      if (size >= 2.5) return '#6a1b9a';
      if (size >= 2.25) return '#8e24aa';
      if (size >= 2.0) return '#c2185b';
      if (size >= 1.75) return '#b71c1c';
      if (size >= 1.5) return '#d32f2f';
      if (size >= 1.25) return '#e53935';
      if (size >= 1.0) return '#ff1744';
      if (size > 0.5) return '#ff5722';
      return '#ffea00';
    }

    function haversineMiles(lat1, lng1, lat2, lng2) {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function featureNearAnchor(feature, anchorLat, anchorLng, radiusMiles) {
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) return false;
      const checkPoint = (lng, lat) => haversineMiles(anchorLat, anchorLng, lat, lng) <= radiusMiles;

      const walk = (coords) => {
        if (!Array.isArray(coords)) return false;
        if (typeof coords[0] === 'number' && coords.length >= 2) {
          return checkPoint(coords[0], coords[1]);
        }
        for (let i = 0; i < coords.length; i += 1) {
          if (walk(coords[i])) return true;
        }
        return false;
      };
      return walk(geom.coordinates);
    }

    function clearHailLayers() {
      if (!map || !map.data) return;
      map.data.forEach((f) => {
        if (f.getProperty('hailsize') !== undefined) {
          map.data.remove(f);
        }
      });
    }

    function renderGeoJson(geoJson) {
      if (!map || !geoJson) return;
      clearHailLayers();
      const features = Array.isArray(geoJson.features) ? geoJson.features : [];
      const filtered = features.filter((f) =>
        featureNearAnchor(f, CFG.lat, CFG.lng, 10)
      );
      const collection = {
        type: 'FeatureCollection',
        features: filtered.length > 0 ? filtered : features,
      };
      map.data.addGeoJson(collection);
      map.data.setStyle((feature) => {
        const stateName = feature.getProperty('name');
        if (stateName) {
          return { visible: false };
        }
        if (feature.getProperty('hailsize') === undefined) {
          return { visible: false };
        }
        const hailsize = parseFloat(feature.getProperty('hailsize')) || 0.5;
        const color = getHailSizeColor(hailsize);
        return {
          strokeColor: color,
          strokeOpacity: 0.72,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.28,
          clickable: true,
          visible: true,
        };
      });
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: CFG.lat, lng: CFG.lng });
      map.data.forEach((f) => {
        if (f.getGeometry) {
          f.getGeometry().forEachLatLng((ll) => bounds.extend(ll));
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      }
    }

    async function loadHailOverlays() {
      try {
        const historyUrl = CFG.apiBase + '/nexrad/hail-impact-history?lat=' + CFG.lat + '&lng=' + CFG.lng;
        const historyRes = await fetch(historyUrl, { headers: { Accept: 'application/json' } });
        const historyJson = await historyRes.json();
        const records = (historyJson && historyJson.response) || [];
        const dates = {};
        records.forEach((item) => {
          let dateKey = item && item.date;
          if (!dateKey && item && item.report && item.report.dateTimeISO) {
            dateKey = String(item.report.dateTimeISO).substring(0, 10);
          }
          if (dateKey) dates[dateKey] = true;
        });
        const sortedDates = Object.keys(dates).sort((a, b) => b.localeCompare(a));
        if (sortedDates.length === 0) {
          setStatus('No hail swaths near this property.');
          return;
        }
        const dateKey = sortedDates[0];
        const dataUrl = CFG.apiBase + '/nexrad/local-date-data?date=' + encodeURIComponent(dateKey);
        const dataRes = await fetch(dataUrl, { headers: { Accept: 'application/json' } });
        const dataJson = await dataRes.json();
        if (!dataJson || !dataJson.success || !dataJson.data) {
          setStatus('No polygon data for latest hail event.');
          return;
        }
        renderGeoJson(dataJson.data);
        setStatus('Hail impact - ' + dateKey);
      } catch (e) {
        setStatus('Hail overlays unavailable.');
      }
    }

    async function resolveCenter() {
      if (!CFG.geocodeAddress || !CFG.address) {
        return { lat: CFG.lat, lng: CFG.lng };
      }
      return new Promise((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: CFG.address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
            return;
          }
          resolve({ lat: CFG.lat, lng: CFG.lng });
        });
      });
    }

    async function initMap() {
      const center = await resolveCenter();
      CFG.lat = center.lat;
      CFG.lng = center.lng;

      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: CFG.lat, lng: CFG.lng },
        zoom: CFG.zoom,
        mapTypeId: 'hybrid',
        gestureHandling: 'greedy',
        isFractionalZoomEnabled: true,
        zoomControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        },
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        padding: { top: 8, right: 48, bottom: 72, left: 8 },
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        ],
      });

      propertyMarker = new google.maps.Marker({
        map,
        position: { lat: CFG.lat, lng: CFG.lng },
        title: CFG.address || 'Property',
        icon: CFG.markerIconUrl
          ? {
              url: CFG.markerIconUrl,
              scaledSize: new google.maps.Size(36, 48),
              anchor: new google.maps.Point(18, 48),
            }
          : undefined,
      });

      const chip = document.getElementById('address-chip');
      if (chip) {
        chip.textContent = CFG.address || '';
        chip.style.display = CFG.address ? 'block' : 'none';
      }

      const legendEl = document.getElementById('legend');
      if (legendEl) {
        const legendItems = [
          ['0.5', '#ffea00'],
          ['1', '#ff1744'],
          ['1.5', '#d32f2f'],
          ['2', '#c2185b'],
          ['2.5', '#6a1b9a'],
          ['3+', '#5c0000'],
        ];
        legendEl.innerHTML = legendItems
          .map(
            ([label, color]) =>
              '<span class="legend-item"><span class="legend-dot" style="background:' +
              color +
              '"></span>' +
              label +
              '"</span>',
          )
          .join('');
      }

      if (CFG.hailGeoJson && CFG.hailGeoJson.features && CFG.hailGeoJson.features.length > 0) {
        renderGeoJson(CFG.hailGeoJson);
        setStatus(CFG.hailStatus || 'Hail impact');
      } else {
        setStatus('Loading hail data...');
        await loadHailOverlays();
      }
    }

    window.__hsInitMap = initMap;
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization&callback=__hsInitMap"></script>
</body>
</html>`;
}
