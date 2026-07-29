import { env } from '../../config/env';
import { httpClient } from './httpClient';

const getError = (error: unknown, fallback: string): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
};

export type HailImpactHistoryRecord = {
  date?: string;
  report?: {
    dateTimeISO?: string;
    hailIN?: number | string;
    detail?: Record<string, unknown>;
  };
  hail_size?: number | string;
  max_hail?: number | string;
  distance_mi?: number | string;
};

type HailImpactHistoryResponse = {
  success?: boolean;
  response?: HailImpactHistoryRecord[];
};

export type NexradLocalDateResponse = {
  success?: boolean;
  date?: string;
  data?: unknown;
  message?: string;
};

export const nexradService = {
  async getHailImpactHistory(lat: number, lng: number): Promise<HailImpactHistoryRecord[]> {
    try {
      const response = await httpClient.get<HailImpactHistoryResponse>('nexrad/hail-impact-history', {
        params: { lat, lng },
      });
      return Array.isArray(response.data?.response) ? response.data.response : [];
    } catch (error) {
      throw getError(error, 'Unable to load hail impact history.');
    }
  },

  async getLocalDateData(dateKey: string): Promise<NexradLocalDateResponse> {
    try {
      const response = await httpClient.get<NexradLocalDateResponse>('nexrad/local-date-data', {
        params: { date: dateKey },
      });
      return response.data ?? { success: false };
    } catch (error) {
      throw getError(error, 'Unable to load hail map data.');
    }
  },
};

/** Skip HTTP when app runs fully offline mock auth (no nexrad without a session). */
export function canLoadNexradData(): boolean {
  return env.useMockAuth !== true;
}
