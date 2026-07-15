import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { AppButton } from '../../components/AppButton';
import { AppTextInput } from '../../components/AppTextInput';
import { portalService } from '../../services/api/portalService';
import {
  formatAgreementDate,
  getAgreementTitle,
  isAgreementSigned,
  openAgreementPublicView,
} from '../../utils/agreementHelpers';
import { colors } from '../../theme/colors';
import type { CustomerAgreement } from '../../types/portal';
import type { AgreementsStackParamList } from '../../navigation/types';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function AgreementDetailScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<AgreementsStackParamList, 'AgreementDetail'>>();
  const { agreementId } = route.params;

  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<CustomerAgreement | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureText, setSignatureText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalService.getAgreementDetail(agreementId);
      setAgreement(data);
    } catch (error) {
      toastAlert('Agreement', error instanceof Error ? error.message : 'Failed to load.');
      setAgreement(null);
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const onSign = async (): Promise<void> => {
    if (!signatureName.trim() || !signatureText.trim()) {
      toastAlert('Validation', 'Enter your full name and typed signature.');
      return;
    }
    try {
      setSigning(true);
      const updated = await portalService.signAgreement(agreementId, {
        signature_name: signatureName.trim(),
        signature_image: signatureText.trim(),
      });
      setAgreement(updated);
      setSignatureName('');
      setSignatureText('');
      toastAlert('Success', 'Agreement signed.');
    } catch (error) {
      toastAlert('Sign failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const handleSignPress = (): void => {
    onSign().catch(() => {
      toastAlert('Sign failed', 'Unexpected error.');
    });
  };

  const openPublicPreview = (): void => {
    if (!agreement) {
      return;
    }
    openAgreementPublicView(agreement).catch(() => {
      toastAlert('Browser', 'Could not open agreement.');
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!agreement) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Agreement not found.</Text>
      </View>
    );
  }

  const bodyHtml = String(agreement.content || agreement.body || '');
  const bodyText = bodyHtml ? stripHtml(bodyHtml) : 'No content.';

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <Text style={styles.title}>{getAgreementTitle(agreement)}</Text>
      <AppButton
        title={isAgreementSigned(agreement) ? 'View signed agreement' : 'View & sign in browser'}
        onPress={openPublicPreview}
      />

      <Text style={styles.section}>Terms (plain text)</Text>
      <Text style={styles.body}>{bodyText}</Text>

      {isAgreementSigned(agreement) ? (
        <View style={styles.signedBox}>
          <Text style={styles.signedText}>
            Signed on {formatAgreementDate(String(agreement.signature_date ?? ''))} by{' '}
            {String(agreement.signature_name || '—')}.
          </Text>
        </View>
      ) : (
        <View style={styles.signBox}>
          <Text style={styles.section}>Sign agreement</Text>
          <AppTextInput label="Your full name" value={signatureName} onChangeText={setSignatureName} />
          <AppTextInput
            label="Type your signature"
            value={signatureText}
            onChangeText={setSignatureText}
            placeholder="Same as your name or customary signature"
          />
          <AppButton
            title={signing ? 'Signing…' : 'Sign agreement'}
            onPress={handleSignPress}
            disabled={signing}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  section: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  signedBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#d1e7dd',
    borderWidth: 1,
    borderColor: '#badbcc',
  },
  signedText: {
    color: '#0f5132',
    fontSize: 14,
  },
  signBox: {
    marginTop: 8,
    paddingTop: 8,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
