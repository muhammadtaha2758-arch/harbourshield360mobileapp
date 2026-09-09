import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import type { ChatBubble } from '../utils/chatMapping';

type Props = {
  visible: boolean;
  message: ChatBubble | null;
  busy?: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
};

export function ChatMessageActionSheet({
  visible,
  message,
  busy = false,
  onClose,
  onDeleteForMe,
}: Props): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) {
      setConfirming(false);
    }
  }, [visible]);

  const preview =
    message?.kind === 'photo'
      ? 'Photo'
      : message?.kind === 'document'
        ? message.fileName || 'Document'
        : (message?.text || 'Message').trim().slice(0, 80);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            {!confirming ? (
              <>
                <Text style={styles.heading}>Message</Text>
                <Text style={styles.subheading} numberOfLines={2}>
                  {preview || 'Message'}
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
                    onPress={() => setConfirming(true)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Delete for me"
                  >
                    <Text style={styles.dangerTitle}>Delete for me</Text>
                    <Text style={styles.actionSubtitle}>
                      Remove this message from your chat only. Others can still see it.
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Delete for me?</Text>
                <Text style={styles.subheading}>
                  This message will be removed from your view only. It will still be visible to others.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && styles.rowPressed, busy && styles.disabled]}
                  onPress={onDeleteForMe}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete for me"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Delete for me</Text>
                  )}
                </Pressable>
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.rowPressed]}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetSafe: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  actions: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF6',
    marginBottom: 10,
  },
  actionRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  confirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginBottom: 10,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    borderRadius: 14,
    backgroundColor: '#F3F6FB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rowPressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.65,
  },
});
