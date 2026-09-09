import { sessionStorage } from '../storage/sessionStorage';

export type ChatInboxIncoming = {
  chatType: 'direct' | 'group';
  peerUserId?: string;
  groupId?: string;
  preview?: string;
  senderName?: string;
};

type Listener = (event: ChatInboxIncoming) => void;

const listeners = new Set<Listener>();

export function subscribeChatInbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function conversationIdFromInboxEvent(event: ChatInboxIncoming): string | null {
  if (event.chatType === 'group' && event.groupId) {
    return `group-${String(event.groupId)}`;
  }
  if (event.chatType === 'direct' && event.peerUserId) {
    return `direct-${String(event.peerUserId)}`;
  }
  return null;
}

export function emitChatInboxIncoming(event: ChatInboxIncoming): void {
  const chatId = conversationIdFromInboxEvent(event);
  if (chatId) {
    void sessionStorage.unhideConversation(chatId);
  }
  listeners.forEach((listener) => {
    listener(event);
  });
}
