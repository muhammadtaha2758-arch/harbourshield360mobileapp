/**
 * Tracks which chat the user is currently viewing so we can suppress
 * WhatsApp-style banners for that conversation.
 */

type ActiveChat = {
  type: 'direct' | 'group';
  peerUserId?: string;
  groupId?: string;
};

let active: ActiveChat | null = null;

export function setActiveChat(next: ActiveChat | null): void {
  active = next;
}

export function getActiveChat(): ActiveChat | null {
  return active;
}

export function shouldSuppressChatPush(data: Record<string, string> | undefined): boolean {
  if (!active || !data || data.type !== 'chat_message') {
    return false;
  }

  if (data.chat_type === 'group') {
    return Boolean(active.type === 'group' && active.groupId && data.group_id === String(active.groupId));
  }

  if (data.chat_type === 'direct') {
    return Boolean(
      active.type === 'direct' &&
        active.peerUserId &&
        data.peer_user_id === String(active.peerUserId),
    );
  }

  return false;
}
