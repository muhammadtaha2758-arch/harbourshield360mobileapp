import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

export const MESSAGE_CHANNEL_ID = 'harbourshield_messages';

let channelReady = false;

export async function ensureMessageNotificationChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: MESSAGE_CHANNEL_ID,
    name: 'Messages',
    description: 'New chat and meeting room messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    badge: true,
  });
  channelReady = true;
}

export type ChatPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
};

/**
 * Show a local banner (used when the app is in the foreground).
 */
export async function displayMessageNotification(payload: ChatPushPayload): Promise<void> {
  await ensureMessageNotificationChannel();

  const data = payload.data ?? {};
  await notifee.displayNotification({
    title: payload.title,
    body: payload.body,
    data,
    android: {
      channelId: MESSAGE_CHANNEL_ID,
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
      sound: 'default',
      smallIcon: 'ic_launcher',
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });

  if (typeof payload.badge === 'number' && Number.isFinite(payload.badge)) {
    await setAppBadgeCount(payload.badge);
  }
}

export async function setAppBadgeCount(count: number): Promise<void> {
  const next = Math.max(0, Math.floor(count));
  try {
    await notifee.setBadgeCount(next);
  } catch {
    // Badge APIs can fail on some Android OEMs; ignore.
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadgeCount(0);
}

export function subscribeNotificationOpen(
  onOpen: (data: Record<string, string> | undefined) => void,
): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      const raw = detail.notification?.data;
      if (!raw || typeof raw !== 'object') {
        onOpen(undefined);
        return;
      }
      const data: Record<string, string> = {};
      Object.entries(raw).forEach(([key, value]) => {
        data[key] = String(value ?? '');
      });
      onOpen(data);
    }
  });
}
