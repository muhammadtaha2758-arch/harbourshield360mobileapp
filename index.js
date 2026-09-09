/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // Required so FCM can deliver messages while backgrounded.
  // OS already displays `notification` payloads; keep handler for data-only cases.
  const badge = remoteMessage?.data?.badge;
  if (badge != null && badge !== '') {
    const n = Number(badge);
    if (Number.isFinite(n)) {
      try {
        await notifee.setBadgeCount(Math.max(0, Math.floor(n)));
      } catch {
        // ignore
      }
    }
  }
});

notifee.onBackgroundEvent(async ({ type }) => {
  if (type === EventType.PRESS) {
    // Navigation is handled when the JS app boots via getInitialNotification / bootstrap.
  }
});

AppRegistry.registerComponent(appName, () => App);
