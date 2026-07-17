import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { toastAlert } from '../utils/toastAlert';
import { portalService } from '../services/api/portalService';
import { colors } from '../theme/colors';
import type { ChatGroup } from '../types/portal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: ChatGroup) => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateMeetingRoomSheet({ visible, onClose, onCreated }: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setEmailDraft('');
      setInviteEmails([]);
      setSubmitting(false);
    }
  }, [visible]);

  const addEmail = (): void => {
    const email = emailDraft.trim().toLowerCase();
    if (!email) {
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      toastAlert('Validation', 'Enter a valid email address.');
      return;
    }
    if (inviteEmails.includes(email)) {
      toastAlert('Validation', 'This email has already been added.');
      return;
    }
    setInviteEmails((list) => [...list, email]);
    setEmailDraft('');
  };

  const removeEmail = (email: string): void => {
    setInviteEmails((list) => list.filter((item) => item !== email));
  };

  const submit = async (): Promise<void> => {
    const pendingEmail = emailDraft.trim().toLowerCase();
    if (pendingEmail && !EMAIL_REGEX.test(pendingEmail)) {
      toastAlert('Validation', 'Enter a valid email address.');
      return;
    }

    const emailsToInvite =
      pendingEmail && !inviteEmails.includes(pendingEmail)
        ? [...inviteEmails, pendingEmail]
        : inviteEmails;

    try {
      setSubmitting(true);
      const result = await portalService.createChatGroup({
        name: name.trim() || undefined,
        inviteEmails: emailsToInvite,
      });
      onCreated(result.group);
      onClose();
      toastAlert(
        'Meeting room',
        result.emailsFailed.length > 0
          ? `Room created, but invitation email could not be sent to: ${result.emailsFailed.join(', ')}`
          : 'Meeting room created and invitation email sent.',
      );
    } catch (error) {
      toastAlert(
        'Meeting room',
        error instanceof Error ? error.message : 'Unable to create meeting room.',
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
            <Text style={styles.title}>Create Meeting Room</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Meeting room name (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter meeting room name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                editable={!submitting}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Invite people by email (optional)</Text>
              <View style={styles.emailRow}>
                <TextInput
                  style={[styles.textInput, styles.emailInput]}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.textSecondary}
                  value={emailDraft}
                  onChangeText={setEmailDraft}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                  onSubmitEditing={addEmail}
                  returnKeyType="done"
                />
                <Pressable
                  style={[styles.addBtn, (!emailDraft.trim() || submitting) && styles.addBtnDisabled]}
                  onPress={addEmail}
                  disabled={!emailDraft.trim() || submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Add email"
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>

              {inviteEmails.length > 0 ? (
                <View style={styles.tagRow}>
                  {inviteEmails.map((email) => (
                    <View key={email} style={styles.tag}>
                      <Text style={styles.tagText}>{email}</Text>
                      <Pressable onPress={() => removeEmail(email)} hitSlop={8} disabled={submitting}>
                        <Text style={styles.tagClear}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.hintText}>
                You can invite people later. An admin is automatically added to every room.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.createBtn,
                (pressed || submitting) && styles.createBtnPressed,
              ]}
              onPress={() => submit().catch(() => undefined)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Create meeting room"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createBtnText}>Create Meeting Room</Text>
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
    maxHeight: '82%',
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
    maxHeight: 420,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  fieldGroup: {
    marginBottom: 18,
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
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailInput: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginRight: 6,
  },
  tagClear: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  hintText: {
    marginTop: 8,
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
