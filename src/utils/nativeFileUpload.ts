import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { httpClient } from '../services/api/httpClient';

type MultipartFilePart = {
  fieldName: string;
  uri: string;
  fileName: string;
  mime: string;
};

function authHeader(): string {
  const auth = httpClient.defaults.headers.common.Authorization;
  return typeof auth === 'string' ? auth : '';
}

function stripFileScheme(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

async function localPathForUpload(uri: string, fileName: string): Promise<string> {
  const dest = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName.replace(/[/\\]/g, '_')}`;
  const exists = await ReactNativeBlobUtil.fs.exists(dest);
  if (exists) {
    await ReactNativeBlobUtil.fs.unlink(dest);
  }

  try {
    await ReactNativeBlobUtil.fs.cp(uri, dest);
    return dest;
  } catch {
    const stripped = stripFileScheme(uri);
    if (stripped !== uri) {
      await ReactNativeBlobUtil.fs.cp(stripped, dest);
      return dest;
    }
    throw new Error('Could not read the selected photo.');
  }
}

function parseJsonBody(raw: string, status: number): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Upload failed (${status}).`);
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(`Upload failed (${status}).`);
  }
}

export async function postMultipartJson(
  url: string,
  file: MultipartFilePart,
  fields: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const path = await localPathForUpload(file.uri, file.fileName);
  const wrapped = ReactNativeBlobUtil.wrap(
    Platform.OS === 'ios' ? path : stripFileScheme(path),
  );

  const parts = [
    ...Object.entries(fields).map(([name, value]) => ({ name, data: value })),
    {
      name: file.fieldName,
      filename: file.fileName,
      type: file.mime,
      data: wrapped,
    },
  ];

  const response = await ReactNativeBlobUtil.config({ timeout: 120000 }).fetch(
    'POST',
    url,
    {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'multipart/form-data',
    },
    parts,
  );

  const status = Number(response.info().status) || 0;
  const json = parseJsonBody(String(response.data ?? ''), status);

  if (status < 200 || status >= 300) {
    const errorField = json.error;
    const fromError =
      typeof errorField === 'string'
        ? errorField
        : errorField && typeof errorField === 'object' && typeof (errorField as { message?: string }).message === 'string'
          ? (errorField as { message: string }).message
          : undefined;
    const message =
      (typeof json.message === 'string' && json.message) || fromError || 'Upload failed';
    throw new Error(`${message} (${status})`);
  }

  return json;
}
