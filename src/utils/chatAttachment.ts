import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { env } from '../config/env';
import { httpClient } from '../services/api/httpClient';
import type { ChatMessageRecord } from '../types/chat';

const STORMBUDDI_BASE = env.stormBuddiApiOrigin.replace(/\/$/, '');
const HARBOR_BASE = env.apiOrigin.replace(/\/$/, '');

/** Resolve absolute attachment URL (matches messages.vue `resolveAttachmentUrl`). */
export function resolveChatAttachmentUrl(msg: ChatMessageRecord): string {
  const rawUrl = msg.file_url || (msg as Record<string, unknown>).attachment_url;
  if (rawUrl && /^https?:\/\//i.test(String(rawUrl))) {
    return String(rawUrl);
  }

  const rawPath =
    (msg as Record<string, unknown>).attachment_path ||
    (msg as Record<string, unknown>).file_path ||
    (msg as Record<string, unknown>).path ||
    rawUrl;

  if (!rawPath) {
    return '';
  }

  const normalizedPath = String(rawPath).replace(/^\//, '');
  const storagePath = normalizedPath.startsWith('storage/')
    ? normalizedPath
    : `storage/${normalizedPath}`;

  return `${STORMBUDDI_BASE}/${storagePath}`;
}

export function normalizeChatMessageRecord(msg: ChatMessageRecord): ChatMessageRecord {
  const record = msg as Record<string, unknown>;
  const attachmentType = String(record.attachment_type ?? '').toLowerCase();
  let fileType = msg.file_type;
  if (!fileType && attachmentType === 'image') {
    fileType = 'photo';
  }

  return {
    ...msg,
    file_url: resolveChatAttachmentUrl(msg) || msg.file_url || null,
    file_type: fileType ?? msg.file_type,
  };
}

export function getChatMessageText(msg: ChatMessageRecord): string {
  const raw = msg.message;
  if (raw == null || typeof raw === 'object') {
    return '';
  }
  return String(raw);
}

export function getChatAttachmentFileName(msg: ChatMessageRecord): string {
  const text = getChatMessageText(msg).trim();
  if (!text) {
    return 'Open document';
  }
  const cleaned = text.replace(/^\[(PHOTO|DOCUMENT)\]\s*/i, '').trim();
  return cleaned || 'Open document';
}

export type ChatAttachmentKind = 'photo' | 'document';

export function getChatAttachmentKind(msg: ChatMessageRecord): ChatAttachmentKind | null {
  const fileUrl = resolveChatAttachmentUrlWithFallback(msg);
  if (!fileUrl) {
    return null;
  }

  const fileType = String(msg.file_type || (msg as Record<string, unknown>).attachment_type || '').toLowerCase();
  if (fileType === 'photo' || fileType === 'image' || fileType.startsWith('image/')) {
    return 'photo';
  }
  if (fileType === 'document') {
    return 'document';
  }

  if (/\.(jpe?g|png|gif|webp|bmp|heic|svg)(\?|#|$)/i.test(fileUrl)) {
    return 'photo';
  }

  return 'document';
}

/** Prefer StormBuddi for storage paths; HarbourShield for app-hosted files. */
export function resolveChatAttachmentUrlWithFallback(msg: ChatMessageRecord): string {
  const primary = resolveChatAttachmentUrl(msg);
  if (primary) {
    return primary;
  }

  const raw = msg.file_url;
  if (typeof raw === 'string' && raw.startsWith('/')) {
    return `${HARBOR_BASE}${raw}`;
  }

  return '';
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  return trimmed || 'attachment';
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/pdf,image/*,*/*' };
  const auth = httpClient.defaults.headers.common.Authorization;
  if (typeof auth === 'string') {
    headers.Authorization = auth;
  }
  return headers;
}

function urlNeedsAuth(url: string): boolean {
  const harbor = env.apiOrigin.replace(/\/+$/, '');
  const apiBase = env.apiBaseUrl.replace(/\/+$/, '');
  return url.startsWith(harbor) || url.startsWith(apiBase);
}

function extensionForFile(fileName: string, kind: ChatAttachmentKind): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : '';
  if (fromName) {
    return fromName.toLowerCase();
  }
  return kind === 'photo' ? 'jpg' : 'pdf';
}

function mimeForFile(fileName: string, kind: ChatAttachmentKind): string {
  const ext = extensionForFile(fileName, kind);
  if (kind === 'photo') {
    if (ext === 'png') {
      return 'image/png';
    }
    if (ext === 'gif') {
      return 'image/gif';
    }
    if (ext === 'webp') {
      return 'image/webp';
    }
    return 'image/jpeg';
  }
  if (ext === 'pdf') {
    return 'application/pdf';
  }
  if (ext === 'doc') {
    return 'application/msword';
  }
  if (ext === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (ext === 'txt') {
    return 'text/plain';
  }
  return 'application/octet-stream';
}

/** Download and open a chat attachment in the system viewer. */
export async function openChatAttachment(payload: {
  url: string;
  fileName?: string;
  kind: ChatAttachmentKind;
}): Promise<void> {
  const url = payload.url.trim();
  if (!url) {
    throw new Error('Attachment URL is not available.');
  }

  const fileName = sanitizeFilename(
    payload.fileName || (payload.kind === 'photo' ? 'image.jpg' : 'document.pdf'),
  );
  const ext = extensionForFile(fileName, payload.kind);
  const mime = mimeForFile(fileName, payload.kind);
  const headers = urlNeedsAuth(url) ? buildAuthHeaders() : { Accept: 'application/pdf,image/*,*/*' };

  const response = await ReactNativeBlobUtil.config({
    fileCache: true,
    appendExt: ext,
  }).fetch('GET', url, headers);

  const status = response.info().status;
  if (status < 200 || status >= 300) {
    throw new Error(`Unable to open file (${status})`);
  }

  const path = response.path();
  if (Platform.OS === 'ios') {
    await ReactNativeBlobUtil.ios.previewDocument(path);
    return;
  }

  await ReactNativeBlobUtil.android.actionViewIntent(path, mime);
}
