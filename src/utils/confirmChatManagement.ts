import { Alert } from 'react-native';

type ConfirmOptions = {
  onConfirm: () => void;
};

/**
 * Native confirm dialogs for chat / meeting-room management.
 * Keep copy calm, clear, and action-oriented (no slang).
 */
export function confirmHideConversation(options: ConfirmOptions): void {
  Alert.alert(
    'Hide conversation?',
    'This chat will be removed from your Messages list. You can open it again anytime by starting a new conversation with the same contact.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide conversation', style: 'destructive', onPress: options.onConfirm },
    ],
  );
}

export function confirmWipeMeetingRoom(roomName: string | undefined, options: ConfirmOptions): void {
  const name = roomName?.trim() ? `“${roomName.trim()}”` : 'this meeting room';
  Alert.alert(
    'Wipe all messages?',
    `All messages in ${name} will be permanently deleted. This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Wipe messages', style: 'destructive', onPress: options.onConfirm },
    ],
  );
}

export function confirmDeleteMeetingRoom(roomName: string | undefined, options: ConfirmOptions): void {
  const name = roomName?.trim() ? `“${roomName.trim()}”` : 'this meeting room';
  Alert.alert(
    'Delete meeting room?',
    `${name} will be closed for everyone. Existing messages are kept for reference, but no new messages can be sent.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete room', style: 'destructive', onPress: options.onConfirm },
    ],
  );
}

export function confirmLeaveMeetingRoom(roomName: string | undefined, options: ConfirmOptions): void {
  const name = roomName?.trim() ? `“${roomName.trim()}”` : 'this meeting room';
  Alert.alert(
    'Leave meeting room?',
    `You will be removed from ${name} and it will no longer appear in your Messages list.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave room', style: 'destructive', onPress: options.onConfirm },
    ],
  );
}
