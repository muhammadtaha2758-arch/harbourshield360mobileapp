import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { env } from '../config/env';
import { httpClient } from '../services/api/httpClient';
import type { CustomerDocument } from '../types/portal';

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  return trimmed || 'document';
}

function extensionForDocument(fileName: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : '';
  return fromName ? fromName.toLowerCase() : 'bin';
}

function mimeForDocument(doc: CustomerDocument, fileName: string): string {
  if (typeof doc.file_type === 'string' && doc.file_type.trim()) {
    return doc.file_type.trim();
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.doc')) {
    return 'application/msword';
  }
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: '*/*' };
  const auth = httpClient.defaults.headers.common.Authorization;
  if (typeof auth === 'string') {
    headers.Authorization = auth;
  }
  return headers;
}

export function resolveDocumentDownloadUrl(doc: CustomerDocument): string | null {
  const id = doc.id;
  if (id != null && id !== '' && !String(id).startsWith('mock-')) {
    const base = env.apiBaseUrl.replace(/\/+$/, '');
    return `${base}/${env.mobileDocuments.download(id)}`;
  }

  const record = doc as Record<string, unknown>;
  for (const key of ['url', 'file_url', 'download_url'] as const) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) {
      const base = env.apiBaseUrl.replace(/\/+$/, '');
      return `${base}${value}`;
    }
  }

  return null;
}

function downloadUrlNeedsAuth(url: string): boolean {
  return url.includes('/mobile/documents/') && url.includes('/download');
}

async function ensureAndroidDownloadPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version >= 29) {
    return;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Storage permission',
      message: 'Allow access to save files to your Downloads folder.',
      buttonPositive: 'Allow',
    },
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Storage permission is required to download files.');
  }
}

/**
 * Fetches a document into a temporary cache file and opens it with the system viewer.
 */
export async function viewCustomerDocument(doc: CustomerDocument): Promise<void> {
  const url = resolveDocumentDownloadUrl(doc);
  if (!url) {
    throw new Error('This file cannot be opened.');
  }

  const fileName = sanitizeFilename(String(doc.original_name || `document-${doc.id}`));
  const ext = extensionForDocument(fileName);
  const mime = mimeForDocument(doc, fileName);
  const headers = downloadUrlNeedsAuth(url) ? buildAuthHeaders() : { Accept: '*/*' };

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

/**
 * Downloads a customer document to device storage.
 * Android: system Download Manager (Downloads folder + notification).
 * iOS: saves locally then opens Quick Look so the file can be saved/shared.
 */
export async function downloadCustomerDocument(doc: CustomerDocument): Promise<void> {
  const url = resolveDocumentDownloadUrl(doc);
  if (!url) {
    throw new Error('Download is not available for this file.');
  }

  await ensureAndroidDownloadPermission();

  const fileName = sanitizeFilename(String(doc.original_name || `document-${doc.id}`));
  const headers = downloadUrlNeedsAuth(url) ? buildAuthHeaders() : { Accept: '*/*' };
  const dirs = ReactNativeBlobUtil.fs.dirs;
  const directory = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
  const path = `${directory}/${fileName}`;
  const mime = typeof doc.file_type === 'string' && doc.file_type ? doc.file_type : undefined;

  const config: ReactNativeBlobUtil.ReactNativeBlobUtilConfig = {
    fileCache: Platform.OS === 'ios',
    path,
  };

  if (Platform.OS === 'android') {
    config.addAndroidDownloads = {
      useDownloadManager: true,
      notification: true,
      title: fileName,
      description: 'HarbourShield document',
      mime,
      mediaScannable: true,
      path,
    };
  }

  const response = await ReactNativeBlobUtil.config(config).fetch('GET', url, headers);
  const status = response.info().status;

  if (status < 200 || status >= 300) {
    throw new Error(`Download failed (${status})`);
  }

  if (Platform.OS === 'ios') {
    const savedPath = response.path();
    try {
      await ReactNativeBlobUtil.ios.previewDocument(savedPath);
    } catch {
      // File is saved even if preview cannot open.
    }
  }
}
