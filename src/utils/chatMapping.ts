import type { ChatGroup } from '../types/portal';
import type { ChatContact, ChatMessageRecord } from '../types/chat';
import {
  getChatAttachmentFileName,
  getChatAttachmentKind,
  getChatMessageText,
  normalizeChatMessageRecord,
  resolveChatAttachmentUrlWithFallback,
} from './chatAttachment';
import { placeholderAvatarUri } from './chatAvatar';

export type ConversationPreview = {
  id: string;
  type: 'direct' | 'group';
  name: string;
  preview: string;
  time: string;
  lastMessageAt?: string;
  peerUserId?: string;
  groupId?: string;
  unreadCount: number;
  avatarUri?: string;
};

function normalizePreviewText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (/^\[PHOTO\]/i.test(trimmed)) {
    return 'Photo';
  }
  if (/^\[DOCUMENT\]/i.test(trimmed)) {
    return 'Document';
  }
  return trimmed;
}

function lastMessageIso(record: Record<string, unknown>): string | undefined {
  const lastMessage = record.lastMessage as { created_at?: string } | undefined;
  const candidates = [
    record.last_message_time,
    lastMessage?.created_at,
    record.last_message_at,
    record.updated_at,
    record.created_at,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nested = record.lastMessage as { created_at?: string } | undefined;
  if (nested?.created_at && typeof nested.created_at === 'string') {
    return nested.created_at.trim();
  }

  return undefined;
}

function resolveRawPreview(record: Record<string, unknown>): string {
  const direct = String(record.last_message_preview ?? record.last_message ?? '').trim();
  if (direct) {
    return direct;
  }

  const nested = record.lastMessage as ChatMessageRecord | undefined;
  if (nested) {
    return previewTextFromMessage(nested);
  }

  return '';
}

function buildPreviewLabel(
  record: Record<string, unknown>,
  type: 'direct' | 'group',
  currentUserId?: string,
): string {
  const rawPreview = resolveRawPreview(record);
  const normalized = normalizePreviewText(rawPreview);

  if (!normalized) {
    return 'No messages yet';
  }

  const isMine =
    record.last_message_is_mine === true ||
    (currentUserId != null &&
      record.last_message_sender_id != null &&
      String(record.last_message_sender_id) === String(currentUserId));

  if (type === 'group') {
    const sender = String(record.last_message_sender ?? '').trim();
    if (isMine) {
      return `You: ${normalized}`;
    }
    if (sender) {
      return `${sender}: ${normalized}`;
    }
  } else if (isMine) {
    return `You: ${normalized}`;
  }

  return normalized;
}

function contactAvatarUri(contact: Record<string, unknown>): string | undefined {
  for (const key of ['avatar', 'profile_image', 'profile_photo', 'image', 'photo'] as const) {
    const value = contact[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export type ChatBubbleKind = 'text' | 'photo' | 'document';

export type ChatBubble = {
  id: string;
  kind: ChatBubbleKind;
  text: string;
  side: 'left' | 'right';
  timeLabel: string;
  createdAt?: string;
  isRead?: boolean;
  fileUrl?: string;
  fileName?: string;
};

export function formatChatListTime(iso?: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso?: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function previewTextFromMessage(msg: ChatMessageRecord): string {
  const record = msg as Record<string, unknown>;
  const text =
    getChatMessageText(msg).trim() ||
    (typeof record.text === 'string' ? record.text.trim() : '');
  if (text) {
    return normalizePreviewText(text);
  }
  const kind = getChatAttachmentKind(msg);
  if (kind === 'photo') {
    return 'Photo';
  }
  if (kind === 'document') {
    return 'Document';
  }
  if (msg.file_url || msg.file_type) {
    return 'Attachment';
  }
  return '';
}

function pickLatestMessage(msgs: ChatMessageRecord[]): ChatMessageRecord | undefined {
  if (msgs.length === 0) {
    return undefined;
  }
  return [...msgs].sort((a, b) => {
    const aId = Number(a.id);
    const bId = Number(b.id);
    if (!Number.isNaN(aId) && !Number.isNaN(bId) && aId !== bId) {
      return bId - aId;
    }
    return Date.parse(String(b.created_at ?? '')) - Date.parse(String(a.created_at ?? ''));
  })[0];
}

function applyMessageToRecord<T extends Record<string, unknown>>(
  record: T,
  msg: ChatMessageRecord,
  currentUserId?: string,
): T {
  const sender = msg.sender;
  const senderName =
    [sender?.firstname, sender?.lastname].filter(Boolean).join(' ').trim() ||
    sender?.name ||
    msg.sender_name;

  return {
    ...record,
    last_message_preview: previewTextFromMessage(msg),
    last_message: previewTextFromMessage(msg),
    last_message_time: msg.created_at,
    last_message_is_mine: currentUserId != null && String(msg.sender_id) === String(currentUserId),
    last_message_sender: senderName,
    lastMessage: msg,
  };
}

/** Fetch latest message per thread when list API omits preview (matches web messages.vue). */
export async function enrichConversationSources(
  admins: ChatContact[],
  groups: ChatGroup[],
  currentUserId: string | undefined,
  fetchDirect: (id: number | string) => Promise<ChatMessageRecord[]>,
  fetchGroup: (id: number | string) => Promise<ChatMessageRecord[]>,
): Promise<{ admins: ChatContact[]; groups: ChatGroup[] }> {
  const enrichedAdmins = await Promise.all(
    admins.map(async (admin) => {
      const record = admin as Record<string, unknown>;
      try {
        const msgs = await fetchDirect(admin.id);
        const last = pickLatestMessage(msgs);
        if (last) {
          return applyMessageToRecord(record, last, currentUserId) as ChatContact;
        }
      } catch {
        // Fall back to list payload when thread fetch fails.
      }
      return admin;
    }),
  );

  const enrichedGroups = await Promise.all(
    groups.map(async (group) => {
      const record = group as Record<string, unknown>;
      try {
        const msgs = await fetchGroup(group.id);
        const last = pickLatestMessage(msgs);
        if (last) {
          return applyMessageToRecord(record, last, currentUserId) as ChatGroup;
        }
      } catch {
        // Fall back to list payload when thread fetch fails.
      }
      return group;
    }),
  );

  return { admins: enrichedAdmins, groups: enrichedGroups };
}

export function buildConversationPreviews(
  admins: ChatContact[],
  groups: ChatGroup[],
  currentUserId?: string,
): ConversationPreview[] {
  const items: ConversationPreview[] = [];

  for (const group of groups) {
    const g = group as Record<string, unknown>;
    const lastMessageAt = lastMessageIso(g);
    const groupName = String(group.name || group.title || 'Meeting room');
    items.push({
      id: `group-${String(group.id)}`,
      type: 'group',
      groupId: String(group.id),
      name: groupName,
      preview: buildPreviewLabel(g, 'group', currentUserId),
      time: formatChatListTime(lastMessageAt),
      lastMessageAt,
      unreadCount: Number(g.unread_count ?? 0) || 0,
      avatarUri: contactAvatarUri(g) ?? placeholderAvatarUri(groupName),
    });
  }

  for (const admin of admins) {
    const adminRecord = admin as Record<string, unknown>;
    const lastMessageAt = lastMessageIso(adminRecord);
    const adminName = String(admin.name || 'Support');
    items.push({
      id: `direct-${String(admin.id)}`,
      type: 'direct',
      peerUserId: String(admin.id),
      name: adminName,
      preview: buildPreviewLabel(adminRecord, 'direct', currentUserId),
      time: formatChatListTime(lastMessageAt),
      lastMessageAt,
      unreadCount: Number(admin.unread_count ?? 0) || 0,
      avatarUri: contactAvatarUri(adminRecord) ?? placeholderAvatarUri(adminName),
    });
  }

  return items.sort((a, b) => {
    const aTs = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bTs = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (bTs !== aTs) {
      return bTs - aTs;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function mapMessagesToBubbles(
  records: ChatMessageRecord[],
  currentUserId: string | number,
): ChatBubble[] {
  const sorted = [...records].sort((a, b) => {
    const aId = String(a.id).startsWith('temp-') ? Date.parse(String(a.created_at ?? '')) : Number(a.id);
    const bId = String(b.id).startsWith('temp-') ? Date.parse(String(b.created_at ?? '')) : Number(b.id);
    return aId - bId;
  });

  const bubbles = sorted.map((raw) => {
    const record = normalizeChatMessageRecord(raw);
    const senderId = record.sender_id ?? record.sender?.id;
    const isMine = String(senderId) === String(currentUserId);
    const attachmentKind = getChatAttachmentKind(record);
    const fileUrl = resolveChatAttachmentUrlWithFallback(record);
    const messageText = getChatMessageText(record).trim();

    if (attachmentKind && fileUrl) {
      return {
        id: String(record.id),
        kind: attachmentKind,
        text: messageText,
        side: isMine ? 'right' : 'left',
        timeLabel: formatMessageTime(record.created_at),
        createdAt: record.created_at,
        isRead: Boolean(record.seen),
        fileUrl,
        fileName: getChatAttachmentFileName(record),
      };
    }

    return {
      id: String(record.id),
      kind: 'text',
      text: messageText || '',
      side: isMine ? 'right' : 'left',
      timeLabel: formatMessageTime(record.created_at),
      createdAt: record.created_at,
      isRead: Boolean(record.seen),
    };
  });

  return bubbles.filter((bubble) => bubble.kind !== 'text' || bubble.text.length > 0);
}
