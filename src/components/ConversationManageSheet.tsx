import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { ChatHeaderAvatar } from './ChatHeaderAvatar';
import type { ConversationPreview } from '../utils/chatMapping';

export type ConversationManageRole = 'direct' | 'creator' | 'member';

type PendingAction = 'hide' | 'wipe' | 'delete' | 'leave';

type Props = {
  visible: boolean;
  chat: ConversationPreview | null;
  role: ConversationManageRole | null;
  onClose: () => void;
  onHide: () => void;
  onWipe: () => void;
  onDelete: () => void;
  onLeave: () => void;
};

type ActionItem = {
  key: PendingAction;
  title: string;
  subtitle: string;
};

type ConfirmCopy = {
  title: string;
  body: string;
  confirmLabel: string;
};

function confirmCopyFor(action: PendingAction, roomName: string, chatType?: ConversationPreview['type']): ConfirmCopy {
  const name = roomName.trim() ? `“${roomName.trim()}”` : 'this conversation';
  switch (action) {
    case 'wipe':
      return {
        title: 'Wipe all messages?',
        body: `All messages in ${name} will be permanently deleted. This cannot be undone.`,
        confirmLabel: 'Wipe messages',
      };
    case 'delete':
      return {
        title: 'Delete meeting room?',
        body: `${name} will be closed for everyone. Existing messages are kept for reference, but no new messages can be sent.`,
        confirmLabel: 'Delete room',
      };
    case 'leave':
      return {
        title: 'Leave meeting room?',
        body: `You will be removed from ${name} and it will no longer appear in your Messages list.`,
        confirmLabel: 'Leave room',
      };
    case 'hide':
    default:
      return {
        title: 'Hide from your list?',
        body:
          chatType === 'group'
            ? `${name} will be removed from your Messages list. Other members are not affected.`
            : 'This chat will be removed from your Messages list. You can open it again anytime by starting a new conversation with the same contact.',
        confirmLabel: 'Hide',
      };
  }
}

export function ConversationManageSheet({
  visible,
  chat,
  role,
  onClose,
  onHide,
  onWipe,
  onDelete,
  onLeave,
}: Props): React.JSX.Element {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (!visible) {
      setPendingAction(null);
    }
  }, [visible]);

  const actions = useMemo((): ActionItem[] => {
    if (!role) {
      return [];
    }
    if (role === 'direct') {
      return [
        {
          key: 'hide',
          title: 'Hide conversation',
          subtitle: 'Remove this chat from your Messages list',
        },
      ];
    }
    if (role === 'creator') {
      return [
        {
          key: 'hide',
          title: 'Hide from my list',
          subtitle: 'Remove this room from your Messages list only',
        },
        {
          key: 'wipe',
          title: 'Wipe messages',
          subtitle: 'Permanently delete all messages in this room',
        },
        {
          key: 'delete',
          title: 'Delete meeting room',
          subtitle: 'Close the room for everyone. Messages are kept for reference',
        },
      ];
    }
    return [
      {
        key: 'hide',
        title: 'Hide from my list',
        subtitle: 'Remove this room from your Messages list only',
      },
      {
        key: 'leave',
        title: 'Leave meeting room',
        subtitle: 'You will be removed and will no longer see this room',
      },
    ];
  }, [role]);

  const heading =
    role === 'direct' ? 'Conversation options' : role === 'creator' ? 'Manage meeting room' : 'Meeting room options';

  const confirm = pendingAction
    ? confirmCopyFor(pendingAction, chat?.name ?? '', chat?.type)
    : null;

  const runPending = (): void => {
    if (!pendingAction) {
      return;
    }
    const action = pendingAction;
    setPendingAction(null);
    onClose();
    if (action === 'wipe') {
      onWipe();
    } else if (action === 'delete') {
      onDelete();
    } else if (action === 'leave') {
      onLeave();
    } else {
      onHide();
    }
  };

  const handleRequestClose = (): void => {
    if (pendingAction) {
      setPendingAction(null);
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {confirm ? (
              <>
                <Text style={styles.heading}>{confirm.title}</Text>
                {chat ? (
                  <View style={styles.chatCard}>
                    <ChatHeaderAvatar name={chat.name} uri={chat.avatarUri} size={44} />
                    <View style={styles.chatText}>
                      <Text style={styles.chatName} numberOfLines={1}>
                        {chat.name}
                      </Text>
                      <Text style={styles.chatMeta}>
                        {chat.type === 'group' ? 'Meeting room' : 'Direct message'}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <Text style={styles.confirmBody}>{confirm.body}</Text>
                <Pressable
                  style={({ pressed }) => [styles.confirmDangerBtn, pressed && styles.btnPressed]}
                  onPress={runPending}
                  accessibilityRole="button"
                  accessibilityLabel={confirm.confirmLabel}
                >
                  <Text style={styles.confirmDangerText}>{confirm.confirmLabel}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                  onPress={() => setPendingAction(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>{heading}</Text>

                {chat ? (
                  <View style={styles.chatCard}>
                    <ChatHeaderAvatar name={chat.name} uri={chat.avatarUri} size={44} />
                    <View style={styles.chatText}>
                      <Text style={styles.chatName} numberOfLines={1}>
                        {chat.name}
                      </Text>
                      <Text style={styles.chatMeta} numberOfLines={1}>
                        {chat.type === 'group' ? 'Meeting room' : 'Direct message'}
                        {chat.preview ? ` · ${chat.preview}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {actions.map((action) => (
                    <Pressable
                      key={action.key}
                      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                      onPress={() => setPendingAction(action.key)}
                      accessibilityRole="button"
                      accessibilityLabel={action.title}
                    >
                      <View style={styles.actionTextCol}>
                        <Text style={[styles.actionTitle, styles.actionTitleDanger]}>{action.title}</Text>
                        <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
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
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D5DD',
    marginBottom: 14,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#E8EEF6',
    marginBottom: 14,
  },
  chatText: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  confirmBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 16,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EEF6',
  },
  actionRowPressed: {
    backgroundColor: '#F3F6FB',
  },
  actionTextCol: {
    gap: 3,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionTitleDanger: {
    color: colors.danger,
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  confirmDangerBtn: {
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 10,
  },
  confirmDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    borderRadius: 14,
    backgroundColor: '#F3F6FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btnPressed: {
    opacity: 0.88,
  },
});
