import { PermissionsAndroid, Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { env } from '../config/env';
import { httpClient } from '../services/api/httpClient';
import { portalService } from '../services/api/portalService';
import type { CustomerDocument } from '../types/portal';
import { buildInvoiceHtml } from './invoiceHtml';

/**
 * Lets the user save/share a local file via Files (Save to Files / On My iPhone).
 * Documents are already in DocumentDir; file sharing exposes that folder in Files.
 */
async function presentIosSaveToFiles(path: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  const fileUrl = path.startsWith('file://') ? path : `file://${path}`;
  await Share.share({ url: fileUrl });
}

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
  return (
    (url.includes('/mobile/documents/') && url.includes('/download')) ||
    (url.includes('/mobile/invoices/') && url.includes('/download'))
  );
}

function invoicePdfUrl(invoiceId: number | string): string {
  const base = env.apiBaseUrl.replace(/\/+$/, '');
  return `${base}/${env.mobileInvoices.download(invoiceId)}`;
}

function invoicePdfFileName(fileName?: string, invoiceId?: number | string): string {
  const base = sanitizeFilename(fileName || `invoice-${invoiceId ?? 'download'}`);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Fetch an authenticated file into a local path (no Android Download Manager).
 * Download Manager often drops Authorization headers and hangs on protected PDFs.
 */
async function fetchAuthenticatedFile(options: {
  url: string;
  path: string;
  timeoutMs?: number;
}): Promise<string> {
  const headers = downloadUrlNeedsAuth(options.url)
    ? buildAuthHeaders()
    : { Accept: '*/*' };

  if (!headers.Authorization && downloadUrlNeedsAuth(options.url)) {
    throw new Error('Please sign in again to download this file.');
  }

  const response = await ReactNativeBlobUtil.config({
    fileCache: false,
    path: options.path,
    timeout: options.timeoutMs ?? 120000,
  }).fetch('GET', options.url, {
    ...headers,
    Accept: 'application/pdf,application/json,*/*',
  });

  const status = Number(response.info().status) || 0;
  const savedPath = response.path();
  const responseHeaders = (response.info().headers || {}) as Record<string, string>;
  const contentType = String(
    responseHeaders['Content-Type'] || responseHeaders['content-type'] || '',
  ).toLowerCase();

  const readBodyText = async (): Promise<string> => {
    try {
      return await ReactNativeBlobUtil.fs.readFile(savedPath, 'utf8');
    } catch {
      return '';
    }
  };

  const extractServerMessage = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // ignore
    }
    return '';
  };

  if (status < 200 || status >= 300) {
    const serverMessage = extractServerMessage(await readBodyText());
    try {
      await ReactNativeBlobUtil.fs.unlink(savedPath);
    } catch {
      // ignore cleanup errors
    }

    if (serverMessage) {
      throw new Error(serverMessage);
    }
    if (status === 401 || status === 403) {
      throw new Error('You are not allowed to access this invoice.');
    }
    if (status === 404) {
      throw new Error('Invoice not found.');
    }
    throw new Error(`Download failed (${status || 'network'})`);
  }

  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    const serverMessage =
      extractServerMessage(await readBodyText()) || 'Server did not return a PDF.';
    try {
      await ReactNativeBlobUtil.fs.unlink(savedPath);
    } catch {
      // ignore
    }
    throw new Error(serverMessage);
  }

  return savedPath;
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
 * Downloads a remote file to device storage.
 * Android: system Download Manager (Downloads folder + notification).
 * iOS: saves locally then opens Quick Look so the file can be saved/shared.
 */
export async function downloadRemoteFile(options: {
  url: string;
  fileName: string;
  mime?: string;
}): Promise<void> {
  const url = options.url.trim();
  if (!url) {
    throw new Error('Download is not available for this file.');
  }

  await ensureAndroidDownloadPermission();

  const fileName = sanitizeFilename(options.fileName || 'download');
  const headers = downloadUrlNeedsAuth(url) ? buildAuthHeaders() : { Accept: '*/*' };
  const dirs = ReactNativeBlobUtil.fs.dirs;
  const directory = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
  const path = `${directory}/${fileName}`;
  const mime = options.mime && options.mime.trim() ? options.mime.trim() : undefined;

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

/**
 * Opens a project invoice PDF in the system viewer.
 * Falls back to a local HTML invoice if the PDF endpoint fails.
 */
export async function viewInvoicePdf(options: {
  invoiceId: number | string;
  fileName?: string;
}): Promise<void> {
  const url = invoicePdfUrl(options.invoiceId);
  const fileName = invoicePdfFileName(options.fileName, options.invoiceId);
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;

  try {
    const savedPath = await fetchAuthenticatedFile({ url, path });

    if (Platform.OS === 'ios') {
      await ReactNativeBlobUtil.ios.previewDocument(savedPath);
      return;
    }

    await ReactNativeBlobUtil.android.actionViewIntent(savedPath, 'application/pdf');
  } catch (pdfError) {
    try {
      await viewInvoiceHtmlFallback(options.invoiceId, options.fileName);
    } catch {
      throw pdfError instanceof Error ? pdfError : new Error('Unable to open invoice.');
    }
  }
}

/**
 * Downloads a project invoice PDF to device storage.
 * iOS: app Documents (visible in Files) + share sheet for "Save to Files".
 * Android: Downloads folder.
 * Falls back to saving an HTML invoice if the PDF endpoint fails.
 */
export async function downloadInvoicePdf(options: {
  invoiceId: number | string;
  fileName?: string;
}): Promise<'pdf' | 'html'> {
  await ensureAndroidDownloadPermission();

  const url = invoicePdfUrl(options.invoiceId);
  const fileName = invoicePdfFileName(options.fileName, options.invoiceId);
  const dirs = ReactNativeBlobUtil.fs.dirs;
  const directory = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
  const path = `${directory}/${fileName}`;

  try {
    const savedPath = await fetchAuthenticatedFile({ url, path });
    await notifyAndroidDownloadComplete({
      path: savedPath,
      fileName,
      mime: 'application/pdf',
      description: 'HarbourShield invoice',
    });
    await presentIosSaveToFiles(savedPath);
    return 'pdf';
  } catch (pdfError) {
    try {
      await downloadInvoiceHtmlFallback(options.invoiceId, options.fileName);
      return 'html';
    } catch {
      throw pdfError instanceof Error ? pdfError : new Error('Unable to download invoice.');
    }
  }
}

async function viewInvoiceHtmlFallback(
  invoiceId: number | string,
  fileName?: string,
): Promise<void> {
  const detail = await portalService.getInvoiceById(invoiceId);
  const html = buildInvoiceHtml(detail);
  const base = sanitizeFilename(fileName || `invoice-${invoiceId}`).replace(/\.pdf$/i, '');
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${base}.html`;
  await ReactNativeBlobUtil.fs.writeFile(path, html, 'utf8');

  if (Platform.OS === 'ios') {
    await ReactNativeBlobUtil.ios.previewDocument(path);
    return;
  }

  await ReactNativeBlobUtil.android.actionViewIntent(path, 'text/html');
}

/**
 * Saves invoice HTML to Downloads / Documents only — never opens a viewer chooser.
 */
async function downloadInvoiceHtmlFallback(
  invoiceId: number | string,
  fileName?: string,
): Promise<void> {
  await ensureAndroidDownloadPermission();

  const detail = await portalService.getInvoiceById(invoiceId);
  const html = buildInvoiceHtml(detail);
  const base = sanitizeFilename(fileName || `invoice-${invoiceId}`).replace(/\.pdf$/i, '');
  const htmlName = `${base}.html`;
  const dirs = ReactNativeBlobUtil.fs.dirs;
  const directory = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
  const path = `${directory}/${htmlName}`;
  await ReactNativeBlobUtil.fs.writeFile(path, html, 'utf8');

  await notifyAndroidDownloadComplete({
    path,
    fileName: htmlName,
    mime: 'text/html',
    description: 'HarbourShield invoice',
  });
  await presentIosSaveToFiles(path);
}

async function notifyAndroidDownloadComplete(options: {
  path: string;
  fileName: string;
  mime: string;
  description: string;
}): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await ReactNativeBlobUtil.fs.scanFile([{ path: options.path, mime: options.mime }]);
  } catch {
    // File is still saved.
  }

  try {
    await ReactNativeBlobUtil.android.addCompleteDownload({
      title: options.fileName,
      description: options.description,
      mime: options.mime,
      path: options.path,
      showNotification: true,
    });
  } catch {
    // Older Android / missing API — file is still in Downloads.
  }
}

/**
 * Downloads a customer document to device storage.
 */
export async function downloadCustomerDocument(doc: CustomerDocument): Promise<void> {
  const url = resolveDocumentDownloadUrl(doc);
  if (!url) {
    throw new Error('Download is not available for this file.');
  }

  await downloadRemoteFile({
    url,
    fileName: String(doc.original_name || `document-${doc.id}`),
    mime: typeof doc.file_type === 'string' && doc.file_type ? doc.file_type : undefined,
  });
}
