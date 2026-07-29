import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';

import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { registerDeviceTokenWithBackend, syncPushToken } from '../services/api/pushService';
import { sessionStorage } from '../services/storage/sessionStorage';

export function PushNotificationBootstrap(): null {
  const { token, user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing || !token) {
      return;
    }

    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeOnOpened: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let cancelled = false;
    const currentUserId = String(user?.id ?? '');

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
    };

    const bootstrap = async (): Promise<void> => {
      // Let the post-login UI settle, then show the OS permission dialog.
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      if (cancelled) {
        return;
      }

      const fcmToken = await syncPushToken();
      if (cancelled) {
        return;
      }
      if (fcmToken) {
        await sessionStorage.setFcmToken(fcmToken);
      }

      unsubscribeOnMessage = messaging().onMessage(async () => {
        // Open chats already poll; OS shows the notification when app is backgrounded.
      });

      unsubscribeOnOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
        openChat(remoteMessage.data as Record<string, string> | undefined);
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
        openChat(initial.data as Record<string, string>);
      }
    };

    bootstrap().catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribeOnMessage?.();
      unsubscribeOnOpened?.();
      unsubscribeTokenRefresh?.();
    };
  }, [isInitializing, token, user?.id]);

  return null;
}
