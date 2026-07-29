import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'hs360_token';
const REMEMBERED_EMAIL_KEY = 'hs360_remembered_email';
const PENDING_MEETING_INVITATION_KEY = 'hs360_pending_meeting_invitation';
const FCM_TOKEN_KEY = 'hs360_fcm_token';

export const sessionStorage = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async getRememberedEmail(): Promise<string | null> {
    return AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
  },

  async setRememberedEmail(email: string): Promise<void> {
    await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  },

  async clearRememberedEmail(): Promise<void> {
    await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
  },

  async getPendingMeetingInvitation(): Promise<string | null> {
    return AsyncStorage.getItem(PENDING_MEETING_INVITATION_KEY);
  },

  async setPendingMeetingInvitation(token: string): Promise<void> {
    await AsyncStorage.setItem(PENDING_MEETING_INVITATION_KEY, token);
  },

  async clearPendingMeetingInvitation(): Promise<void> {
    await AsyncStorage.removeItem(PENDING_MEETING_INVITATION_KEY);
  },

  async getFcmToken(): Promise<string | null> {
    return AsyncStorage.getItem(FCM_TOKEN_KEY);
  },

  async setFcmToken(token: string): Promise<void> {
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
  },

  async clearFcmToken(): Promise<void> {
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
  },
};
