import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { toastAlert } from '../utils/toastAlert';
import { portalService } from '../services/api/portalService';
import { colors } from '../theme/colors';
import type { ChatContact } from '../types/portal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onReady: (peer: ChatContact) => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StartConversationSheet({ visible, onClose, onReady }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setSubmitting(false);
    }
  }, [visible]);

  const submit = async (): Promise<void> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toastAlert('Validation', 'Enter an email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      toastAlert('Validation', 'Enter a valid email address.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await portalService.startPeerConversation(trimmed);

      if (result.status === 'ready' && result.peer) {
        onReady(result.peer);
        onClose();
        toastAlert('Messages', result.message || 'Conversation ready.');
        return;
      }

      onClose();
      toastAlert(
        'Invitation sent',
        result.message ||
          'No account found for that email. We sent an invite so they can join and chat with you.',
      );
    } catch (error) {
      toastAlert(
        'Start conversation',
        error instanceof Error ? error.message : 'Unable to start conversation.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Start Conversation</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.fieldLabel}>Customer email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="name@example.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              onSubmitEditing={() => {
                submit().catch(() => undefined);
              }}
              returnKeyType="done"
            />
            <Text style={styles.hintText}>
              Starts a direct chat with another customer. Admin is not added to this conversation.
            </Text>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.createBtn,
                (pressed || submitting) && styles.createBtnPressed,
              ]}
              onPress={() => submit().catch(() => undefined)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Start conversation"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createBtnText}>Start Conversation</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  hintText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnPressed: {
    opacity: 0.9,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
