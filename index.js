/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async () => {
  // Required so FCM can deliver data/notification messages while backgrounded.
});

AppRegistry.registerComponent(appName, () => App);
