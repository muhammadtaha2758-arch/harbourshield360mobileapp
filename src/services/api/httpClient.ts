import axios from 'axios';
import { env } from '../../config/env';

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.requestTimeoutMs,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  try {
    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (!isFormData) {
      return config;
    }

    const headers = config.headers as { delete?: (name: string) => void } & Record<string, unknown>;
    if (headers && typeof headers.delete === 'function') {
      headers.delete('Content-Type');
      headers.delete('content-type');
    } else if (headers) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
  } catch {
    // Never block the request if header cleanup fails.
  }

  return config;
});

export const setAuthToken = (token: string | null): void => {
  if (token) {
    httpClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete httpClient.defaults.headers.common.Authorization;
};
