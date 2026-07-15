import { AxiosError } from 'axios';
import { env } from '../../config/env';
import { httpClient } from './httpClient';
import { setGoogleMapsApiKey } from '../../utils/projectMapImage';

let configLoaded = false;

export async function loadMobileConfig(): Promise<void> {
  if (configLoaded && env.googleMapsApiKey) {
    return;
  }

  try {
    const response = await httpClient.get<{
      success?: boolean;
      data?: { google_maps_api_key?: string };
    }>('mobile/config');

    const key = response.data?.data?.google_maps_api_key?.trim() ?? '';
    if (key) {
      setGoogleMapsApiKey(key);
      configLoaded = true;
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    if (__DEV__) {
      console.warn('[configService] mobile/config failed', axiosError.message);
    }
  }
}
