import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'hs360_token';
const REMEMBERED_EMAIL_KEY = 'hs360_remembered_email';
const PENDING_MEETING_INVITATION_KEY = 'hs360_pending_meeting_invitation';
const FCM_TOKEN_KEY = 'hs360_fcm_token';
const HIDDEN_CONVERSATIONS_KEY = 'hs360_hidden_conversations';
const HIDDEN_MESSAGES_KEY = 'hs360_hidden_messages';
const WIPED_GROUPS_KEY = 'hs360_wiped_groups';

export type HiddenConversation = {
  id: string;
  lastMessageAt: string;
};

function parseHiddenConversations(raw: string | null): HiddenConversation[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const items: HiddenConversation[] = [];
    for (const entry of parsed) {
      if (typeof entry === 'string' && entry.trim()) {
        items.push({ id: entry.trim(), lastMessageAt: '' });
        continue;
      }
      if (entry && typeof entry === 'object' && 'id' in entry) {
        const id = String((entry as { id?: unknown }).id ?? '').trim();
        if (!id) {
          continue;
        }
        items.push({
          id,
          lastMessageAt: String((entry as { lastMessageAt?: unknown }).lastMessageAt ?? ''),
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

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

  async getHiddenConversations(): Promise<HiddenConversation[]> {
    const raw = await AsyncStorage.getItem(HIDDEN_CONVERSATIONS_KEY);
    return parseHiddenConversations(raw);
  },

  async getHiddenConversationIds(): Promise<string[]> {
    return (await this.getHiddenConversations()).map((item) => item.id);
  },

  async hideConversation(conversationId: string, lastMessageAt?: string): Promise<void> {
    const id = String(conversationId).trim();
    if (!id) {
      return;
    }
    const existing = await this.getHiddenConversations();
    const next = existing.filter((item) => item.id !== id);
    next.push({
      id,
      lastMessageAt: String(lastMessageAt ?? ''),
    });
    await AsyncStorage.setItem(HIDDEN_CONVERSATIONS_KEY, JSON.stringify(next));
  },

  async unhideConversation(conversationId: string): Promise<void> {
    const id = String(conversationId).trim();
    const existing = await this.getHiddenConversations();
    await AsyncStorage.setItem(
      HIDDEN_CONVERSATIONS_KEY,
      JSON.stringify(existing.filter((item) => item.id !== id)),
    );
  },

  async replaceHiddenConversations(entries: HiddenConversation[]): Promise<void> {
    await AsyncStorage.setItem(HIDDEN_CONVERSATIONS_KEY, JSON.stringify(entries));
  },

  async getHiddenMessageIds(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(HIDDEN_MESSAGES_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((id) => String(id)).filter(Boolean);
    } catch {
      return [];
    }
  },

  async hideChatMessage(messageId: number | string): Promise<void> {
    await this.hideChatMessages([messageId]);
  },

  async hideChatMessages(messageIds: Array<number | string>): Promise<void> {
    const incoming = messageIds.map((id) => String(id).trim()).filter((id) => id && !id.startsWith('temp-'));
    if (incoming.length === 0) {
      return;
    }
    const existing = await this.getHiddenMessageIds();
    const merged = new Set(existing);
    incoming.forEach((id) => merged.add(id));
    await AsyncStorage.setItem(HIDDEN_MESSAGES_KEY, JSON.stringify([...merged]));
  },

  async getWipedGroupIds(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(WIPED_GROUPS_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((id) => String(id)).filter(Boolean);
    } catch {
      return [];
    }
  },

  async markChatGroupWiped(groupId: number | string): Promise<void> {
    const id = String(groupId).trim();
    if (!id) {
      return;
    }
    const existing = await this.getWipedGroupIds();
    if (existing.includes(id)) {
      return;
    }
    await AsyncStorage.setItem(WIPED_GROUPS_KEY, JSON.stringify([...existing, id]));
  },

  async clearWipedGroup(groupId: number | string): Promise<void> {
    const id = String(groupId);
    const existing = await this.getWipedGroupIds();
    await AsyncStorage.setItem(
      WIPED_GROUPS_KEY,
      JSON.stringify(existing.filter((item) => item !== id)),
    );
  },
};
