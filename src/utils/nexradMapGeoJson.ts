import type { HailImpactTableRow } from '../types/dashboard';
import { canLoadNexradData, nexradService } from '../services/api/nexradService';

export type GeoJsonFeature = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates?: unknown;
  };
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

export type DashboardHailOverlay = {
  geoJson: GeoJsonFeatureCollection | null;
  dateKey: string | null;
  statusMessage: string;
};

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function featureNearAnchor(feature: GeoJsonFeature, anchorLat: number, anchorLng: number, radiusMiles: number): boolean {
  const geom = feature.geometry;
  if (!geom?.coordinates) {
    return false;
  }

  const checkPoint = (lng: number, lat: number) => haversineMiles(anchorLat, anchorLng, lat, lng) <= radiusMiles;

  const walk = (coords: unknown): boolean => {
    if (!Array.isArray(coords)) {
      return false;
    }
    if (typeof coords[0] === 'number' && coords.length >= 2) {
      return checkPoint(coords[0] as number, coords[1] as number);
    }
    for (let i = 0; i < coords.length; i += 1) {
      if (walk(coords[i])) {
        return true;
      }
    }
    return false;
  };

  return walk(geom.coordinates);
}

function normalizeRawGeoJson(raw: unknown): GeoJsonFeatureCollection | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as { type?: string; features?: unknown };
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return { type: 'FeatureCollection', features: data.features as GeoJsonFeature[] };
  }
  if (Array.isArray(data.features)) {
    return { type: 'FeatureCollection', features: data.features as GeoJsonFeature[] };
  }
  if (Array.isArray(raw)) {
    return { type: 'FeatureCollection', features: raw as GeoJsonFeature[] };
  }
  return null;
}

function flattenProcessedFeatures(raw: unknown): GeoJsonFeature[] {
  const collection = normalizeRawGeoJson(raw);
  if (!collection) {
    return [];
  }

  const out: GeoJsonFeature[] = [];
  for (const feature of collection.features) {
    if (!feature?.geometry || !feature.properties) {
      continue;
    }
    const geomType = feature.geometry.type;
    if (geomType === 'Polygon') {
      out.push({
        type: 'Feature',
        properties: { ...feature.properties, isNexrad: true },
        geometry: feature.geometry,
      });
      continue;
    }
    if (geomType === 'MultiPolygon' && Array.isArray(feature.geometry.coordinates)) {
      const multi = feature.geometry.coordinates as unknown[][];
      for (const polyCoords of multi) {
        if (!polyCoords?.[0] || (polyCoords[0] as unknown[]).length < 3) {
          continue;
        }
        out.push({
          type: 'Feature',
          properties: { ...feature.properties, isNexrad: true },
          geometry: { type: 'Polygon', coordinates: polyCoords },
        });
      }
    }
  }
  return out;
}

export function latestHailDateFromTable(rows?: HailImpactTableRow[] | null): string | null {
  if (!rows?.length) {
    return null;
  }
  const keys = rows
    .map((row) => {
      const raw = row.date_key || row.date;
      if (!raw) {
        return null;
      }
      const match = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : null;
    })
    .filter((key): key is string => Boolean(key));
  keys.sort((a, b) => b.localeCompare(a));
  return keys[0] ?? null;
}

export function latestHailDateFromHistory(
  records: Array<{ date?: string; report?: { dateTimeISO?: string } }>,
): string | null {
  const dates: Record<string, true> = {};
  records.forEach((item) => {
    let dateKey = item?.date;
    if (!dateKey && item?.report?.dateTimeISO) {
      dateKey = String(item.report.dateTimeISO).substring(0, 10);
    }
    if (dateKey && /^\d{4}-\d{2}-\d{2}/.test(dateKey)) {
      dates[dateKey.substring(0, 10)] = true;
    }
  });
  const sorted = Object.keys(dates).sort((a, b) => b.localeCompare(a));
  return sorted[0] ?? null;
}

export function buildHailOverlayForAnchor(
  raw: unknown,
  anchorLat: number,
  anchorLng: number,
  options?: { dateInCustomerList?: boolean },
): GeoJsonFeatureCollection | null {
  const processed = flattenProcessedFeatures(raw);
  if (processed.length === 0) {
    return null;
  }

  const radiusMiles = 10;
  let filtered = processed.filter((f) => featureNearAnchor(f, anchorLat, anchorLng, radiusMiles));

  if (filtered.length === 0 && options?.dateInCustomerList && processed.length > 0) {
    filtered = processed;
  }

  if (filtered.length === 0) {
    return null;
  }

  filtered.sort((a, b) => {
    const sizeA = parseFloat(String(a.properties?.hailsize ?? 0.5)) || 0.5;
    const sizeB = parseFloat(String(b.properties?.hailsize ?? 0.5)) || 0.5;
    return sizeA - sizeB;
  });

  return { type: 'FeatureCollection', features: filtered };
}

export async function loadDashboardHailOverlay(
  lat: number,
  lng: number,
  preferredDate?: string | null,
): Promise<DashboardHailOverlay> {
  if (!canLoadNexradData()) {
    return { geoJson: null, dateKey: null, statusMessage: 'Hail map preview unavailable in mock mode.' };
  }

  try {
    let dateKey = preferredDate?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    let dateInCustomerList = Boolean(dateKey);

    if (!dateKey) {
      const history = await nexradService.getHailImpactHistory(lat, lng);
      dateKey = latestHailDateFromHistory(history);
      dateInCustomerList = Boolean(dateKey);
      if (!dateKey) {
        return { geoJson: null, dateKey: null, statusMessage: 'No hail swaths near this property.' };
      }
    }

    const dateResponse = await nexradService.getLocalDateData(dateKey);
    if (!dateResponse.success || !dateResponse.data) {
      return {
        geoJson: null,
        dateKey,
        statusMessage: 'No polygon data for latest hail event.',
      };
    }

    const geoJson = buildHailOverlayForAnchor(dateResponse.data, lat, lng, { dateInCustomerList });
    if (!geoJson) {
      return {
        geoJson: null,
        dateKey,
        statusMessage: 'No hail swaths within 10 miles of this property.',
      };
    }

    return {
      geoJson,
      dateKey: dateResponse.date || dateKey,
      statusMessage: `Hail impact - ${dateResponse.date || dateKey}`,
    };
  } catch {
    return { geoJson: null, dateKey: null, statusMessage: 'Hail overlays unavailable.' };
  }
}
