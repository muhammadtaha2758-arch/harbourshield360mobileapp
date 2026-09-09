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
import { resolveUserAvatarUrl } from './userAvatar';

export type ConversationPreview = {
  id: string;
  type: 'direct' | 'group';
  name: string;
  preview: string;
  time: string;
  lastMessageAt?: string;
  lastMessageIsMine?: boolean;
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

function recordLastMessageIsMine(record: Record<string, unknown>, currentUserId?: string): boolean {
  if (record.last_message_is_mine === true) {
    return true;
  }
  if (record.last_message_is_mine === false) {
    return false;
  }
  return (
    currentUserId != null &&
    record.last_message_sender_id != null &&
    String(record.last_message_sender_id) === String(currentUserId)
  );
}

/** True when `current` is a later chat timestamp than the snapshot taken at hide. */
export function isNewerChatActivity(current?: string | null, previous?: string | null): boolean {
  if (!current || !previous) {
    return false;
  }
  if (current === previous) {
    return false;
  }
  const currentDate = parseChatDateTime(current);
  const previousDate = parseChatDateTime(previous);
  if (currentDate && previousDate) {
    return currentDate.getTime() > previousDate.getTime();
  }
  return current !== previous;
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
  const resolved = resolveUserAvatarUrl({
    avatar: typeof contact.avatar === 'string' ? contact.avatar : null,
    avatar_url: typeof contact.avatar_url === 'string' ? contact.avatar_url : null,
  });
  if (resolved) {
    return resolved;
  }
  for (const key of ['profile_image', 'profile_photo', 'image', 'photo'] as const) {
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

/**
 * Chat timestamps are StormBuddi/app wall-clock. Laravel may serialize them as
 * UTC (`Z`) or with an offset (`-04:00`). Converting those on a PK device
 * moves evening messages to the next calendar day. Display the date/time
 * written in the string, matching StormBuddi.
 */
export function parseChatDateTime(iso?: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const raw = String(iso).trim();
  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0),
  );
}

export function formatChatListTime(iso?: string | null): string {
  const date = parseChatDateTime(iso);
  if (!date) {
    return '';
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso?: string | null): string {
  const date = parseChatDateTime(iso);
  if (!date) {
    return '';
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
  peers: ChatContact[] = [],
): Promise<{ admins: ChatContact[]; groups: ChatGroup[]; peers: ChatContact[] }> {
  const enrichDirect = async (contact: ChatContact): Promise<ChatContact> => {
    const record = contact as Record<string, unknown>;
    try {
      const msgs = await fetchDirect(contact.id);
      const last = pickLatestMessage(msgs);
      if (last) {
        return applyMessageToRecord(record, last, currentUserId) as ChatContact;
      }
    } catch {
      // Fall back to list payload when thread fetch fails.
    }
    return contact;
  };

  const enrichedAdmins = await Promise.all(admins.map(enrichDirect));
  const enrichedPeers = await Promise.all(peers.map(enrichDirect));

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

  return { admins: enrichedAdmins, groups: enrichedGroups, peers: enrichedPeers };
}

export function buildConversationPreviews(
  admins: ChatContact[],
  groups: ChatGroup[],
  currentUserId?: string,
  peers: ChatContact[] = [],
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
      lastMessageIsMine: recordLastMessageIsMine(g, currentUserId),
      unreadCount: Number(g.unread_count ?? 0) || 0,
      avatarUri: contactAvatarUri(g) ?? placeholderAvatarUri(groupName),
    });
  }

  const directContacts = [...admins, ...peers];
  const seenPeerIds = new Set<string>();

  for (const contact of directContacts) {
    const peerId = String(contact.id);
    if (seenPeerIds.has(peerId)) {
      continue;
    }
    seenPeerIds.add(peerId);

    const contactRecord = contact as Record<string, unknown>;
    const lastMessageAt = lastMessageIso(contactRecord);
    const contactName = String(contact.name || contact.email || 'Chat');
    items.push({
      id: `direct-${peerId}`,
      type: 'direct',
      peerUserId: peerId,
      name: contactName,
      preview: buildPreviewLabel(contactRecord, 'direct', currentUserId),
      time: formatChatListTime(lastMessageAt),
      lastMessageAt,
      lastMessageIsMine: recordLastMessageIsMine(contactRecord, currentUserId),
      unreadCount: Number(contact.unread_count ?? 0) || 0,
      avatarUri: contactAvatarUri(contactRecord) ?? placeholderAvatarUri(contactName),
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
