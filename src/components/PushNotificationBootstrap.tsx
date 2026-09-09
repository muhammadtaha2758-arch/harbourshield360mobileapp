import { useEffect } from 'react';
import { AppState } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { portalService } from '../services/api/portalService';
import { registerDeviceTokenWithBackend, syncPushToken } from '../services/api/pushService';
import { shouldSuppressChatPush } from '../services/push/activeChat';
import { emitChatInboxIncoming } from '../services/push/chatInboxEvents';
import {
  clearAppBadge,
  displayMessageNotification,
  ensureMessageNotificationChannel,
  setAppBadgeCount,
  subscribeNotificationOpen,
} from '../services/push/localNotifications';
import { sessionStorage } from '../services/storage/sessionStorage';

function asStringData(
  data: FirebaseMessagingTypes.RemoteMessage['data'] | Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const out: Record<string, string> = {};
  Object.entries(data).forEach(([key, value]) => {
    out[key] = String(value ?? '');
  });
  return out;
}

export function PushNotificationBootstrap(): null {
  const { token, user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing || !token) {
      return;
    }

    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeOnOpened: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeNotifee: (() => void) | undefined;
    let cancelled = false;
    const currentUserId = String(user?.id ?? '');

    const syncBadgeFromServer = async (): Promise<void> => {
      try {
        const count = await portalService.getNotificationsUnreadCount();
        await setAppBadgeCount(count);
      } catch {
        // ignore
      }
    };

    const openChat = (data: Record<string, string> | undefined): void => {
      if (!data || data.type !== 'chat_message') {
        return;
      }

      const chatType = data.chat_type === 'group' ? 'group' : 'direct';
      const name =
        chatType === 'group' ? data.group_name || 'Meeting Room' : data.sender_name || 'Chat';

      const tryNavigate = (attempt = 0): void => {
        if (!navigationRef.isReady()) {
          if (attempt < 20) {
            setTimeout(() => tryNavigate(attempt + 1), 250);
          }
          return;
        }

        navigationRef.navigate('AppShell', {
          screen: 'AppTabs',
          params: {
            screen: 'MessagesTab',
            params: {
              screen: 'Chat',
              params: {
                chatId:
                  chatType === 'group'
                    ? `group-${data.group_id || ''}`
                    : `direct-${data.peer_user_id || ''}`,
                name,
                type: chatType,
                currentUserId,
                peerUserId: chatType === 'direct' ? data.peer_user_id : undefined,
                groupId: chatType === 'group' ? data.group_id : undefined,
              },
            },
          },
        });
      };

      tryNavigate();
      void syncBadgeFromServer();
    };

    const bootstrap = async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      if (cancelled) {
        return;
      }

      await ensureMessageNotificationChannel();

      const fcmToken = await syncPushToken();
      if (cancelled) {
        return;
      }
      if (fcmToken) {
        await sessionStorage.setFcmToken(fcmToken);
      }

      await syncBadgeFromServer();

      unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
        const data = asStringData(remoteMessage.data);
        if (shouldSuppressChatPush(data)) {
          return;
        }

        if (data?.type === 'chat_message') {
          emitChatInboxIncoming({
            chatType: data.chat_type === 'group' ? 'group' : 'direct',
            peerUserId: data.peer_user_id,
            groupId: data.group_id,
            preview: data.preview || remoteMessage.notification?.body,
            senderName: data.sender_name,
          });
        }

        const title =
          remoteMessage.notification?.title ||
          data?.sender_name ||
          data?.group_name ||
          'HarborShield';
        const body = remoteMessage.notification?.body || data?.preview || 'New message';
        const badgeRaw = data?.badge;
        const badge = badgeRaw != null && badgeRaw !== '' ? Number(badgeRaw) : undefined;

        await displayMessageNotification({
          title,
          body,
          data,
          badge: Number.isFinite(badge) ? badge : undefined,
        });
      });

      unsubscribeOnOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
        openChat(asStringData(remoteMessage.data));
      });

      unsubscribeNotifee = subscribeNotificationOpen((data) => {
        openChat(data);
      });

      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (nextToken) => {
        try {
          await registerDeviceTokenWithBackend(nextToken);
          await sessionStorage.setFcmToken(nextToken);
        } catch {
          // ignore
        }
      });

      const initial = await messaging().getInitialNotification();
      if (initial?.data) {
        openChat(asStringData(initial.data));
      }
    };

    bootstrap().catch(() => undefined);

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void syncBadgeFromServer();
      }
    });

    return () => {
      cancelled = true;
      unsubscribeOnMessage?.();
      unsubscribeOnOpened?.();
      unsubscribeTokenRefresh?.();
      unsubscribeNotifee?.();
      appStateSub.remove();
    };
  }, [isInitializing, token, user?.id]);

  useEffect(() => {
    if (!token) {
      void clearAppBadge();
    }
  }, [token]);

  return null;
}
