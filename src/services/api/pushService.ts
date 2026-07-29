import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import { env } from '../../config/env';
import { httpClient } from './httpClient';

export type PushPlatform = 'android' | 'ios';

/**
 * Shows the OS notification permission dialog (Android 13+ / iOS).
 * Called after login when registering the device token.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function getFcmToken(): Promise<string | null> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) {
      return null;
    }

    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    return token || null;
  } catch {
    return null;
  }
}

export async function registerDeviceTokenWithBackend(token: string): Promise<void> {
  if (env.useMockAuth) {
    return;
  }

  await httpClient.post(env.mobileDevices.register, {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    app: 'harborshield',
  });
}

export async function unregisterDeviceTokenFromBackend(token: string | null): Promise<void> {
  if (!token || env.useMockAuth) {
    return;
  }

  try {
    await httpClient.post(env.mobileDevices.unregister, {
      token,
      app: 'harborshield',
    });
  } catch {
    // Best-effort on logout
  }
}

export async function syncPushToken(): Promise<string | null> {
  const token = await getFcmToken();
  if (!token) {
    return null;
  }

  try {
    await registerDeviceTokenWithBackend(token);
  } catch {
    // Token sync should not block login/session
  }

  return token;
}
