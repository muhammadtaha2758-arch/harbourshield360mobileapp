import { Linking } from 'react-native';
import { env } from '../config/env';
import type { CustomerAgreement } from '../types/portal';

export function isAgreementSigned(agreement: CustomerAgreement): boolean {
  return agreement.signature_status === 'signed' || agreement.status === 'signed';
}

export function getAgreementTitle(agreement: CustomerAgreement): string {
  const title = String(agreement.title ?? '').trim();
  if (title) {
    return title;
  }
  return `Agreement #${agreement.id ?? ''}`.trim();
}

export function formatAgreementDate(value: string | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function resolveAgreementPublicUrl(agreement: CustomerAgreement): string {
  const record = agreement as Record<string, unknown>;
  const fromApi = record.public_view_url;
  if (typeof fromApi === 'string' && fromApi.startsWith('http')) {
    return fromApi;
  }
  return env.agreementPublicUrl(agreement.id);
}

export async function openAgreementPublicView(agreement: CustomerAgreement): Promise<void> {
  const url = resolveAgreementPublicUrl(agreement);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('This agreement link cannot be opened on this device.');
  }
  await Linking.openURL(url);
}
