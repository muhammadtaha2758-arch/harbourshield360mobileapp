/** Same default center as project.vue / ProjectMapImageService when address is missing. */
const DEFAULT_CENTER = '12 Oaks Mall Rd, Novi, MI 48377, USA';

export type ProjectSatelliteMapHtmlConfig = {
  apiKey: string;
  address?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
};

/**
 * Satellite map via Google Maps JS API (project.vue uses Static Maps satellite;
 * WebView + JS API works reliably on device where Static Maps Image URLs often fail).
 */
export function buildProjectSatelliteMapHtml(config: ProjectSatelliteMapHtmlConfig): string {
  const apiKey = config.apiKey.replace(/'/g, "\\'");
  const rawAddress = (config.address ?? '').trim();
  const address =
    rawAddress && rawAddress.toLowerCase() !== 'none' ? rawAddress : DEFAULT_CENTER;
  const lat = config.lat != null ? Number(config.lat) : NaN;
  const lng = config.lng != null ? Number(config.lng) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const zoom = config.zoom ?? 17;

  const payload = JSON.stringify({
    address,
    lat: hasCoords ? lat : 0,
    lng: hasCoords ? lng : 0,
    zoom,
    geocodeAddress: !hasCoords,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #7d8b9a; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const CFG = ${payload};

    function initMap() {
      const center = { lat: CFG.lat, lng: CFG.lng };
      const map = new google.maps.Map(document.getElementById('map'), {
        center,
        zoom: CFG.zoom,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      if (CFG.geocodeAddress && CFG.address) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: CFG.address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const latLng = { lat: loc.lat(), lng: loc.lng() };
            map.setCenter(latLng);
          }
        });
      }
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"></script>
</body>
</html>`;
}
