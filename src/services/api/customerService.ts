import { AxiosError } from 'axios';
import { env } from '../../config/env';
import { httpClient } from './httpClient';
import { mapMobileApiUserToProfile, MobileApiUser, UserProfile } from '../../types/auth';

interface DashboardData {
  [key: string]: unknown;
}

const getError = (error: unknown, fallback: string): Error => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return new Error(axiosError.response?.data?.message || fallback);
};

const mockProfile = (): UserProfile => ({
  id: 1,
  name: 'Demo Customer',
  email: 'demo@harborshield360.com',
  username: 'demo_customer',
});

const mockDashboard = (): DashboardData => ({
  success: true,
  mock: true,
  message: 'Mock dashboard — set env.useMockData to false for live data.',
});

const mockSettings = (): Record<string, unknown> => ({
  mock: true,
});

export const customerService = {
  async getProfile(): Promise<UserProfile> {
    if (env.useMockAuth) {
      return mockProfile();
    }
    try {
      const response = await httpClient.get<{
        success?: boolean;
        data?: { user?: MobileApiUser };
      }>(env.mobileAuth.me);

      const apiUser = response.data?.data?.user;
      if (apiUser) {
        return mapMobileApiUserToProfile(apiUser);
      }

      throw new Error('Profile not found in response.');
    } catch (error) {
      throw getError(error, 'Unable to fetch profile.');
    }
  },

  async getDashboardData(): Promise<DashboardData> {
    if (env.useMockData) {
      return mockDashboard();
    }
    try {
      const response = await httpClient.get<DashboardData>('dashboard_data');
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to load dashboard data.');
    }
  },

  async getSettings(): Promise<Record<string, unknown>> {
    if (env.useMockData) {
      return mockSettings();
    }
    try {
      const response = await httpClient.get<Record<string, unknown>>('settings');
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to load settings.');
    }
  },
};
