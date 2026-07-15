import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { env } from '../config/env';
import type { ServiceRequestAttachment } from '../types/portal';

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  return trimmed || 'attachment';
}

export function isPdfAttachment(attachment: ServiceRequestAttachment): boolean {
  const type = String(attachment.type ?? '').toLowerCase();
  const fileName = String(attachment.name ?? '').toLowerCase();
  return type.includes('pdf') || fileName.endsWith('.pdf');
}

export function resolveAttachmentUrl(attachment: ServiceRequestAttachment): string | null {
  const raw = attachment.url;
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    const base = env.apiOrigin.replace(/\/+$/, '');
    return `${base}${trimmed}`;
  }
  const base = env.apiOrigin.replace(/\/+$/, '');
  return `${base}/${trimmed.replace(/^\/+/, '')}`;
}

function extensionForAttachment(attachment: ServiceRequestAttachment, fileName: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : '';
  if (fromName) {
    return fromName.toLowerCase();
  }
  return isPdfAttachment(attachment) ? 'pdf' : 'jpg';
}

function mimeForAttachment(attachment: ServiceRequestAttachment): string {
  if (typeof attachment.type === 'string' && attachment.type.trim()) {
    return attachment.type.trim();
  }
  return isPdfAttachment(attachment) ? 'application/pdf' : 'image/jpeg';
}

/**
 * Download and open a service-request attachment (PDF, image, etc.).
 */
export async function openServiceRequestAttachment(attachment: ServiceRequestAttachment): Promise<void> {
  const url = resolveAttachmentUrl(attachment);
  if (!url) {
    throw new Error('Attachment URL is not available.');
  }

  const fileName = sanitizeFilename(String(attachment.name || 'attachment'));
  const ext = extensionForAttachment(attachment, fileName);
  const mime = mimeForAttachment(attachment);

  const response = await ReactNativeBlobUtil.config({
    fileCache: true,
    appendExt: ext,
  }).fetch('GET', url, { Accept: 'application/pdf,image/*,*/*' });

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

export function collectRequestAttachments(
  request: { attachment?: ServiceRequestAttachment | null; attachments?: ServiceRequestAttachment[] } | null,
): ServiceRequestAttachment[] {
  if (!request) {
    return [];
  }
  if (Array.isArray(request.attachments) && request.attachments.length > 0) {
    return request.attachments.filter((item) => resolveAttachmentUrl(item) || item.name);
  }
  if (request.attachment) {
    return [request.attachment];
  }
  return [];
}
