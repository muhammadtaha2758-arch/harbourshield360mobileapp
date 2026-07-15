import { env } from '../config/env';
import type { CustomerJob } from '../types/portal';

/** Same default as customer portal when address is missing. */
const DEFAULT_MAP_CENTER = '12 Oaks Mall Rd, Novi, MI 48377, USA';

let runtimeGoogleMapsApiKey = env.googleMapsApiKey.trim();

export function setGoogleMapsApiKey(key: string): void {
  runtimeGoogleMapsApiKey = key.trim();
}

export function getGoogleMapsApiKey(): string {
  return runtimeGoogleMapsApiKey;
}

export type ProjectMapImageOptions = {
  width?: number;
  height?: number;
  zoom?: number;
};

/**
 * Prefer API-provided map_image_url (built server-side like web getProjectImage).
 * Otherwise build the same Google Static Maps URL client-side when a key is available.
 */
export function getProjectMapImageUrl(
  job: CustomerJob | null,
  options?: ProjectMapImageOptions,
): string | null {
  const fromApi =
    typeof job?.map_image_url === 'string' && job.map_image_url.trim().length > 0
      ? job.map_image_url.trim()
      : null;

  if (fromApi) {
    return fromApi;
  }

  return buildProjectMapImageUrlFromAddress(
    typeof job?.customer_address === 'string' ? job.customer_address : null,
    options,
  );
}

/** Matches project.vue getProjectImage() — dynamic URL per address at render time. */
export function buildProjectMapImageUrlFromAddress(
  address: string | null | undefined,
  options?: ProjectMapImageOptions,
): string | null {
  const key = runtimeGoogleMapsApiKey;
  if (!key) {
    return null;
  }

  const rawAddress = typeof address === 'string' ? address.trim() : '';
  const center =
    rawAddress && rawAddress.toLowerCase() !== 'none' ? rawAddress : DEFAULT_MAP_CENTER;

  const width = Math.min(640, Math.max(300, Math.round(options?.width ?? 640)));
  const height = Math.min(640, Math.max(150, Math.round(options?.height ?? 400)));
  const zoom = options?.zoom ?? 17;

  const centerEncoded = encodeURIComponent(center);

  return `https://maps.googleapis.com/maps/api/staticmap?center=${centerEncoded}&zoom=${zoom}&size=${width}x${height}&maptype=satellite&key=${encodeURIComponent(key)}`;
}

/** Satellite static map centered on lat/lng with a property marker (dashboard / full-map marker). */
export function buildSatelliteMapUrlFromLatLng(
  latitude: number,
  longitude: number,
  options?: ProjectMapImageOptions,
): string | null {
  const key = runtimeGoogleMapsApiKey;
  if (!key || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const width = Math.min(640, Math.max(300, Math.round(options?.width ?? 640)));
  const height = Math.min(640, Math.max(200, Math.round(options?.height ?? 360)));
  const zoom = options?.zoom ?? 17;
  const marker = `color:red%7C${latitude},${longitude}`;

  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}` +
    `&zoom=${zoom}&size=${width}x${height}&maptype=satellite&markers=${marker}` +
    `&key=${encodeURIComponent(key)}`
  );
}
