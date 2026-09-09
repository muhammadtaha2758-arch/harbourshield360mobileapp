import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
  type DocumentPickerResponse,
} from '@react-native-documents/picker';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { portalService } from '../../services/api/portalService';
import { sessionStorage } from '../../services/storage/sessionStorage';
import type { ChatContact, ChatMessageRecord } from '../../types/chat';
import type { ChatGroup, ChatGroupMember } from '../../types/portal';
import type { MessagesStackParamList } from '../../navigation/types';
import { ChatHeaderAvatar } from '../../components/ChatHeaderAvatar';
import { ChatMessageBubble } from '../../components/ChatMessageBubble';
import { mapMessagesToBubbles, parseChatDateTime, type ChatBubble } from '../../utils/chatMapping';
import { ChatAttachmentSheet, type ChatAttachmentChoice } from '../../components/ChatAttachmentSheet';
import { ChatMessageActionSheet } from '../../components/ChatMessageActionSheet';
import { captureImageWithCamera, pickImageFromLibrary } from '../../utils/imageSource';
import { openChatAttachment, type ChatAttachmentKind } from '../../utils/chatAttachment';
import { setActiveChat } from '../../services/push/activeChat';
import { setAppBadgeCount } from '../../services/push/localNotifications';
import {
  confirmDeleteMeetingRoom,
  confirmHideConversation,
  confirmLeaveMeetingRoom,
  confirmWipeMeetingRoom,
} from '../../utils/confirmChatManagement';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const PREVIEW_IMAGE_MAX_H = Math.round(Dimensions.get('window').height * 0.72);

type ChatListItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; msg: ChatBubble };

function memberDisplayName(member: ChatGroupMember): string {
  const record = member as Record<string, unknown>;
  const fullName = [record.firstname, record.lastname].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }
  return String(member.username || member.email || 'Member');
}

function memberTypeLabel(userType?: string): string | null {
  switch (userType) {
    case 'roofr':
      return 'Contractor';
    case 'insurance':
      return 'Insurer';
    case 'admin':
      return 'Admin';
    default:
      return null;
  }
}

function contactField(contact: ChatContact | null, key: string): string {
  if (!contact) {
    return '';
  }
  const value = (contact as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatDateDivider(iso?: string): string {
  const date = parseChatDateTime(iso);
  if (!date) {
    return '';
  }
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildChatListItems(messages: ChatBubble[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDateKey = '';

  for (const msg of messages) {
    const dateKey = msg.createdAt ? formatDateDivider(msg.createdAt) : '';
    if (dateKey && dateKey !== lastDateKey) {
      items.push({ type: 'date', id: `date-${dateKey}`, label: dateKey });
      lastDateKey = dateKey;
    }
    items.push({ type: 'message', id: msg.id, msg });
  }

  return items;
}

export function ChatScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MessagesStackParamList, 'Chat'>>();
  const insets = useSafeAreaInsets();
  const chatName = route.params?.name || 'Chat';
  const chatAvatarUri = route.params?.avatarUri;
  const chatType = route.params?.type ?? 'direct';
  const currentUserId = route.params?.currentUserId ?? '';
  const peerUserId = route.params?.peerUserId;
  const groupId = route.params?.groupId;

  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [directContact, setDirectContact] = useState<ChatContact | null>(null);
  const [groupDetails, setGroupDetails] = useState<ChatGroup | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [managingRoom, setManagingRoom] = useState(false);
  const [messageActionTarget, setMessageActionTarget] = useState<ChatBubble | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const loadInFlightRef = useRef(false);
  const sendingRef = useRef(false);
  const uploadingRef = useRef(false);
  const hiddenMessageIdsRef = useRef<Set<string>>(new Set());

  const chatListItems = useMemo(() => buildChatListItems(messages), [messages]);

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    uploadingRef.current = uploadingAttachment;
  }, [uploadingAttachment]);

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (chatType === 'direct' && !peerUserId) {
      if (!silent) {
        setLoading(false);
      }
      return;
    }
    if (chatType === 'group' && !groupId) {
      if (!silent) {
        setLoading(false);
      }
      return;
    }
    if (silent && (sendingRef.current || uploadingRef.current || loadInFlightRef.current)) {
      return;
    }
    if (loadInFlightRef.current) {
      return;
    }

    loadInFlightRef.current = true;
    try {
      if (!silent) {
        setLoading(true);
      }
      let records: ChatMessageRecord[] = [];
      if (chatType === 'group' && groupId) {
        records = await portalService.getGroupMessages(groupId);
        await portalService.markGroupRead(groupId);
      } else if (peerUserId) {
        records = await portalService.getDirectMessages(peerUserId);
        await portalService.markDirectRead(peerUserId);
      }
      const storedHidden = await sessionStorage.getHiddenMessageIds();
      storedHidden.forEach((id) => hiddenMessageIdsRef.current.add(id));
      const hidden = hiddenMessageIdsRef.current;
      const visibleRecords = records.filter((record) => !hidden.has(String(record.id)));
      setMessages(mapMessagesToBubbles(visibleRecords, currentUserId));
    } catch (error) {
      if (!silent) {
        toastAlert('Chat', error instanceof Error ? error.message : 'Failed to load messages.');
      }
    } finally {
      loadInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [chatType, currentUserId, groupId, peerUserId]);

  useFocusEffect(
    useCallback(() => {
      if (chatType === 'group' && groupId) {
        setActiveChat({ type: 'group', groupId: String(groupId) });
      } else if (chatType === 'direct' && peerUserId) {
        setActiveChat({ type: 'direct', peerUserId: String(peerUserId) });
      } else {
        setActiveChat(null);
      }

      void loadMessages();
      void portalService
        .getNotificationsUnreadCount()
        .then((count) => setAppBadgeCount(count))
        .catch(() => undefined);

      const intervalId = setInterval(() => {
        void loadMessages({ silent: true });
      }, 10000);

      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          void loadMessages({ silent: true });
        }
      });

      return () => {
        setActiveChat(null);
        clearInterval(intervalId);
        appStateSub.remove();
      };
    }, [chatType, groupId, loadMessages, peerUserId]),
  );

  const onSendMessage = async (): Promise<void> => {
    const text = messageInput.trim();
    if (!text || sending) {
      return;
    }
    if (chatType === 'direct' && !peerUserId) {
      return;
    }
    if (chatType === 'group' && !groupId) {
      return;
    }

    const tempId = `temp-${String(Date.now())}`;
    const nowIso = new Date().toISOString();
    const optimistic: ChatBubble = {
      id: tempId,
      kind: 'text',
      text,
      side: 'right',
      timeLabel: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      createdAt: nowIso,
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageInput('');
    setSending(true);

    try {
      const saved =
        chatType === 'group' && groupId
          ? await portalService.sendGroupMessage(groupId, text)
          : await portalService.sendDirectMessage(peerUserId as string, text);

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const [bubble] = mapMessagesToBubbles([saved], currentUserId);
        return bubble ? [...withoutTemp, bubble] : withoutTemp;
      });
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(text);
      toastAlert('Chat', error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const resolvePickedFileUri = useCallback(async (file: DocumentPickerResponse): Promise<{ uri: string; name: string }> => {
    const baseName = file.name || 'attachment';
    let uri = file.uri;

    if (Platform.OS === 'ios') {
      const [copy] = await keepLocalCopy({
        files: [{ uri: file.uri, fileName: baseName }],
        destination: 'cachesDirectory',
      });
      if (copy.status === 'success') {
        uri = copy.localUri;
      }
      return { uri, name: baseName };
    }

    if (file.isVirtual && file.convertibleToMimeTypes?.length) {
      const mime = file.convertibleToMimeTypes[0].mimeType;
      const [copy] = await keepLocalCopy({
        files: [{ uri: file.uri, fileName: baseName, convertVirtualFileToType: mime }],
        destination: 'cachesDirectory',
      });
      if (copy.status === 'success') {
        uri = copy.localUri;
      }
    }

    return { uri, name: baseName };
  }, []);

  const uploadAttachment = useCallback(
    async (uri: string, name: string, mimeType: string | null, attachmentType: ChatAttachmentKind): Promise<void> => {
      if (uploadingAttachment || sending) {
        return;
      }
      if (chatType === 'direct' && !peerUserId) {
        toastAlert('Chat', 'Select a conversation before uploading a file.');
        return;
      }
      if (chatType === 'group' && !groupId) {
        toastAlert('Chat', 'Select a conversation before uploading a file.');
        return;
      }

      setUploadingAttachment(true);
      setShowAttachmentMenu(false);

      try {
        const saved = await portalService.uploadChatAttachment({
          uri,
          name,
          type: mimeType,
          attachmentType,
          receiverId: chatType === 'direct' ? peerUserId : undefined,
          groupId: chatType === 'group' ? groupId : undefined,
        });

        setMessages((prev) => {
          const [bubble] = mapMessagesToBubbles([saved], currentUserId);
          return bubble ? [...prev, bubble] : prev;
        });

        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
      } catch (error) {
        toastAlert('Chat', error instanceof Error ? error.message : 'Failed to upload attachment.');
      } finally {
        setUploadingAttachment(false);
      }
    },
    [chatType, currentUserId, groupId, peerUserId, sending, uploadingAttachment],
  );

  const onSelectAttachment = useCallback(
    async (choice: ChatAttachmentChoice): Promise<void> => {
      try {
        if (choice === 'camera' || choice === 'library') {
          const selected =
            choice === 'camera' ? await captureImageWithCamera() : await pickImageFromLibrary();
          if (!selected) {
            return;
          }
          await uploadAttachment(selected.uri, selected.name, selected.type, 'photo');
          return;
        }

        const [file] = await pick({
          type: [types.pdf, types.doc, types.docx, types.plainText],
          allowMultiSelection: false,
          ...(Platform.OS === 'android' ? { allowVirtualFiles: true } : {}),
        });

        if (file.error) {
          toastAlert('Chat', file.error);
          return;
        }

        if (typeof file.size === 'number' && file.size > MAX_ATTACHMENT_BYTES) {
          toastAlert('Chat', 'File must be 10MB or smaller.');
          return;
        }

        const resolved = await resolvePickedFileUri(file);
        await uploadAttachment(resolved.uri, resolved.name, file.type ?? null, 'document');
      } catch (error) {
        if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
          return;
        }
        toastAlert('Chat', error instanceof Error ? error.message : 'Could not pick a file.');
      }
    },
    [resolvePickedFileUri, uploadAttachment],
  );

  const composerBusy = sending || uploadingAttachment || loading;

  const closeAttachmentMenu = useCallback((): void => {
    setShowAttachmentMenu(false);
  }, []);

  const closeAttachmentPreview = useCallback((): void => {
    setAttachmentPreview(null);
  }, []);

  const onOpenAttachment = useCallback(async (msg: ChatBubble): Promise<void> => {
    if (!msg.fileUrl) {
      toastAlert('Open file', 'Attachment URL is not available.');
      return;
    }

    if (msg.kind === 'photo') {
      setAttachmentPreview({
        url: msg.fileUrl,
        fileName: msg.fileName || 'Image',
      });
      return;
    }

    setOpeningAttachmentId(msg.id);
    try {
      await openChatAttachment({
        url: msg.fileUrl,
        fileName: msg.fileName,
        kind: 'document',
      });
    } catch (error) {
      toastAlert('Open file', error instanceof Error ? error.message : 'Unable to open file.');
    } finally {
      setOpeningAttachmentId(null);
    }
  }, []);

  const closeInfo = useCallback((): void => {
    setInfoOpen(false);
  }, []);

  const openInfo = useCallback(async (): Promise<void> => {
    setInfoOpen(true);
    setInfoLoading(true);
    setDirectContact(null);
    setGroupDetails(null);

    try {
      if (chatType === 'group' && groupId) {
        const groups = await portalService.getChatGroups();
        const found = groups.find((g) => String(g.id) === String(groupId));
        setGroupDetails(found ?? { id: groupId, name: chatName, title: chatName });
      } else if (peerUserId) {
        const payload = await portalService.getChatUsers();
        const contacts = [...(payload.admins ?? []), ...(payload.peers ?? [])];
        const found = contacts.find((a) => String(a.id) === String(peerUserId));
        setDirectContact(found ?? { id: peerUserId, name: chatName });
      }
    } catch (error) {
      toastAlert('Chat', error instanceof Error ? error.message : 'Unable to load chat details.');
      setInfoOpen(false);
    } finally {
      setInfoLoading(false);
    }
  }, [chatName, chatType, groupId, peerUserId]);

  const isRoomCreator = useMemo(() => {
    if (!groupDetails?.created_by || !currentUserId) {
      return false;
    }
    return String(groupDetails.created_by) === String(currentUserId);
  }, [currentUserId, groupDetails?.created_by]);

  const hideDirectChat = useCallback(() => {
    const chatId = route.params?.chatId || (peerUserId ? `direct-${peerUserId}` : groupId ? `group-${groupId}` : '');
    if (!chatId) {
      return;
    }
    confirmHideConversation({
      onConfirm: () => {
        void (async () => {
          try {
            await sessionStorage.hideConversation(chatId);
            setInfoOpen(false);
            navigation.goBack();
            toastAlert('Chat', 'Removed from your Messages list.');
          } catch (error) {
            toastAlert('Chat', error instanceof Error ? error.message : 'Unable to hide conversation.');
          }
        })();
      },
    });
  }, [groupId, navigation, peerUserId, route.params?.chatId]);

  const deleteMessageForMe = useCallback(async (): Promise<void> => {
    const target = messageActionTarget;
    if (!target || deletingMessage) {
      return;
    }
    const messageId = String(target.id);
    if (messageId.startsWith('temp-')) {
      setMessages((prev) => prev.filter((m) => String(m.id) !== messageId));
      setMessageActionTarget(null);
      return;
    }
    setDeletingMessage(true);
    hiddenMessageIdsRef.current.add(messageId);
    setMessages((prev) => prev.filter((m) => String(m.id) !== messageId));
    setMessageActionTarget(null);
    try {
      await sessionStorage.hideChatMessage(messageId);
      await portalService.hideMessageForMe(messageId);
    } catch {
      // Keep it removed on this device even if the server hide is not live yet.
    } finally {
      setDeletingMessage(false);
    }
  }, [deletingMessage, messageActionTarget]);

  const deleteMeetingRoom = useCallback(() => {
    if (!groupId || managingRoom) {
      return;
    }
    confirmDeleteMeetingRoom(chatName, {
      onConfirm: () => {
        void (async () => {
          setManagingRoom(true);
          try {
            const message = await portalService.deleteChatGroup(groupId);
            const chatId = route.params?.chatId || `group-${groupId}`;
            await sessionStorage.hideConversation(chatId);
            setInfoOpen(false);
            toastAlert('Chat', message);
            navigation.goBack();
          } catch (error) {
            const chatId = route.params?.chatId || `group-${groupId}`;
            await sessionStorage.hideConversation(chatId);
            setInfoOpen(false);
            toastAlert(
              'Chat',
              'Removed from your Messages list. Only the room creator can close it for everyone.',
            );
            navigation.goBack();
          } finally {
            setManagingRoom(false);
          }
        })();
      },
    });
  }, [chatName, groupId, managingRoom, navigation, route.params?.chatId]);

  const wipeMeetingRoom = useCallback(() => {
    if (!groupId || managingRoom) {
      return;
    }
    confirmWipeMeetingRoom(chatName, {
      onConfirm: () => {
        void (async () => {
          setManagingRoom(true);
          try {
            const message = await portalService.wipeChatGroup(groupId);
            toastAlert('Chat', message);
            setMessages([]);
            setInfoOpen(false);
            void loadMessages({ silent: true });
          } catch (error) {
            toastAlert('Chat', error instanceof Error ? error.message : 'Unable to wipe meeting room.');
          } finally {
            setManagingRoom(false);
          }
        })();
      },
    });
  }, [chatName, groupId, loadMessages, managingRoom]);

  const leaveMeetingRoom = useCallback(() => {
    if (!groupId || managingRoom) {
      return;
    }
    confirmLeaveMeetingRoom(chatName, {
      onConfirm: () => {
        void (async () => {
          setManagingRoom(true);
          try {
            const message = await portalService.leaveChatGroup(groupId);
            setInfoOpen(false);
            toastAlert('Chat', message);
            navigation.goBack();
          } catch (error) {
            toastAlert('Chat', error instanceof Error ? error.message : 'Unable to leave meeting room.');
          } finally {
            setManagingRoom(false);
          }
        })();
      },
    });
  }, [chatName, groupId, managingRoom, navigation]);

  const groupMemberCount = useMemo(() => {
    if (!groupDetails) {
      return 0;
    }
    const members = groupDetails.members;
    if (Array.isArray(members)) {
      return members.length;
    }
    return Number(groupDetails.members_count ?? 0) || 0;
  }, [groupDetails]);

  const groupIsDeleted = Boolean(groupDetails?.deleted_at);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#111827" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.headerIdentity}>
            <ChatHeaderAvatar name={chatName} uri={chatAvatarUri} size={40} style={styles.headerAvatar} />
            <View style={styles.headerTextCol}>
              <Text style={styles.headerName} numberOfLines={1}>
                {chatName}
              </Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
              onPress={() => {
                openInfo().catch(() => undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="5" r="1.6" fill="#111827" />
                <Circle cx="12" cy="12" r="1.6" fill="#111827" />
                <Circle cx="12" cy="19" r="1.6" fill="#111827" />
              </Svg>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3480E9" />
          </View>
        ) : (
          <ScrollView
            ref={chatScrollRef}
            style={styles.thread}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={closeAttachmentMenu}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <Text style={styles.emptyThread}>No messages yet. Say hello.</Text>
            ) : null}
            {chatListItems.map((item) =>
              item.type === 'date' ? (
                <View key={item.id} style={styles.dateDividerRow}>
                  <View style={styles.dateDividerLine} />
                  <Text style={styles.dateDividerText}>{item.label}</Text>
                  <View style={styles.dateDividerLine} />
                </View>
              ) : (
                <ChatMessageBubble
                  key={item.id}
                  msg={item.msg}
                  peerName={chatName}
                  peerAvatarUri={chatAvatarUri}
                  onPressAttachment={(bubble) => {
                    onOpenAttachment(bubble).catch(() => undefined);
                  }}
                  onLongPress={(bubble) => setMessageActionTarget(bubble)}
                  openingAttachment={openingAttachmentId === item.msg.id}
                />
              ),
            )}
          </ScrollView>
        )}

        <View style={[styles.footerComposer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.attachWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.attachBtn,
                pressed && styles.pressed,
                composerBusy && styles.sendDisabled,
              ]}
              onPress={() => {
                if (composerBusy) {
                  return;
                }
                setShowAttachmentMenu(true);
              }}
              disabled={composerBusy}
              accessibilityRole="button"
              accessibilityLabel="Add attachment"
            >
              {uploadingAttachment ? (
                <ActivityIndicator size="small" color="#3480E9" />
              ) : (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                    stroke="#3480E9"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </Pressable>
          </View>

          <TextInput
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            style={styles.footerInput}
            returnKeyType="send"
            editable={!composerBusy}
            onSubmitEditing={() => {
              onSendMessage().catch(() => undefined);
            }}
          />

          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.pressed,
              composerBusy && styles.sendDisabled,
            ]}
            onPress={() => {
              onSendMessage().catch(() => undefined);
            }}
            disabled={composerBusy}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 2L11 13"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ChatAttachmentSheet
        visible={showAttachmentMenu}
        onClose={closeAttachmentMenu}
        onSelect={(choice) => {
          onSelectAttachment(choice).catch(() => undefined);
        }}
      />

      <ChatMessageActionSheet
        visible={messageActionTarget != null}
        message={messageActionTarget}
        busy={deletingMessage}
        onClose={() => {
          if (!deletingMessage) {
            setMessageActionTarget(null);
          }
        }}
        onDeleteForMe={() => {
          void deleteMessageForMe();
        }}
      />

      <Modal visible={infoOpen} transparent animationType="slide" onRequestClose={closeInfo}>
        <View style={styles.infoModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeInfo}
            accessibilityRole="button"
            accessibilityLabel="Dismiss chat details"
          />
          <View style={styles.infoModalSheet}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{chatType === 'group' ? 'Meeting room' : 'Contact'}</Text>
              <Pressable onPress={closeInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.infoModalClose}>✕</Text>
              </Pressable>
            </View>

            {infoLoading ? (
              <View style={styles.infoLoadingWrap}>
                <ActivityIndicator size="large" color="#3480E9" />
              </View>
            ) : chatType === 'group' && groupDetails ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoModalBody}>
                <View style={styles.infoProfileSection}>
                  <ChatHeaderAvatar name={chatName} uri={chatAvatarUri} size={72} style={styles.infoAvatar} />
                  <Text style={styles.infoName}>{String(groupDetails.name || groupDetails.title || chatName)}</Text>
                  <Text style={styles.infoMeta}>
                    {groupMemberCount} {groupMemberCount === 1 ? 'member' : 'members'}
                  </Text>
                </View>

                {groupIsDeleted ? (
                  <View style={styles.infoWarningBox}>
                    <Text style={styles.infoWarningText}>
                      This meeting room has been deleted. No new messages can be sent.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.infoSectionHeading}>Members</Text>
                {(groupDetails.members ?? []).length === 0 ? (
                  <Text style={styles.infoEmptyText}>No member details available.</Text>
                ) : (
                  (groupDetails.members ?? []).map((member) => {
                    const typeLabel = memberTypeLabel(member.user_type);
                    const isCreator =
                      groupDetails.created_by != null && String(groupDetails.created_by) === String(member.id);
                    return (
                      <View key={String(member.id)} style={styles.infoMemberRow}>
                        <Text style={styles.infoMemberName}>
                          {memberDisplayName(member)}
                          {isCreator ? ' · Creator' : ''}
                        </Text>
                        {typeLabel ? <Text style={styles.infoMemberBadge}>{typeLabel}</Text> : null}
                        {member.email ? <Text style={styles.infoMemberEmail}>{member.email}</Text> : null}
                      </View>
                    );
                  })
                )}

                {!groupIsDeleted ? (
                  <View style={styles.infoActions}>
                    <Pressable
                      style={({ pressed }) => [styles.infoActionBtn, pressed && styles.pressed]}
                      onPress={hideDirectChat}
                      accessibilityRole="button"
                      accessibilityLabel="Hide meeting room from my list"
                    >
                      <Text style={styles.infoActionBtnText}>Hide from my list</Text>
                    </Pressable>
                    {isRoomCreator ? (
                      <>
                        <Pressable
                          style={({ pressed }) => [styles.infoActionBtn, pressed && styles.pressed]}
                          onPress={wipeMeetingRoom}
                          disabled={managingRoom}
                          accessibilityRole="button"
                          accessibilityLabel="Wipe meeting room messages"
                        >
                          <Text style={styles.infoActionBtnText}>Wipe messages</Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.infoActionBtn,
                            styles.infoActionBtnDanger,
                            pressed && styles.pressed,
                          ]}
                          onPress={deleteMeetingRoom}
                          disabled={managingRoom}
                          accessibilityRole="button"
                          accessibilityLabel="Delete meeting room"
                        >
                          {managingRoom ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.infoActionBtnTextDanger}>Delete meeting room</Text>
                          )}
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [
                          styles.infoActionBtn,
                          styles.infoActionBtnDanger,
                          pressed && styles.pressed,
                        ]}
                        onPress={leaveMeetingRoom}
                        disabled={managingRoom}
                        accessibilityRole="button"
                        accessibilityLabel="Leave meeting room"
                      >
                        {managingRoom ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.infoActionBtnTextDanger}>Leave meeting room</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            ) : directContact ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoModalBody}>
                <View style={styles.infoProfileSection}>
                  <ChatHeaderAvatar
                    name={String(directContact.name || chatName)}
                    uri={chatAvatarUri}
                    size={72}
                    style={styles.infoAvatar}
                  />
                  <Text style={styles.infoName}>{String(directContact.name || chatName)}</Text>
                  {directContact.email ? <Text style={styles.infoMeta}>{directContact.email}</Text> : null}
                </View>

                <Text style={styles.infoSectionHeading}>Contact information</Text>
                <View style={styles.infoDetailRow}>
                  <Text style={styles.infoDetailLabel}>Address</Text>
                  <Text style={styles.infoDetailValue}>
                    {contactField(directContact, 'address') || 'Address not available'}
                  </Text>
                </View>
                <View style={styles.infoDetailRow}>
                  <Text style={styles.infoDetailLabel}>Phone</Text>
                  <Text style={styles.infoDetailValue}>
                    {contactField(directContact, 'phone') || 'Phone not available'}
                  </Text>
                </View>

                <View style={styles.infoActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.infoActionBtn,
                      styles.infoActionBtnDanger,
                      pressed && styles.pressed,
                    ]}
                    onPress={hideDirectChat}
                    accessibilityRole="button"
                    accessibilityLabel="Hide conversation"
                  >
                    <Text style={styles.infoActionBtnTextDanger}>Hide conversation</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.infoLoadingWrap}>
                <Text style={styles.infoEmptyText}>No details available.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={attachmentPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={closeAttachmentPreview}
      >
        <View style={styles.attachmentPreviewRoot}>
          <Pressable
            style={styles.attachmentPreviewBackdrop}
            onPress={closeAttachmentPreview}
            accessibilityRole="button"
            accessibilityLabel="Dismiss image"
          />
          <View style={styles.attachmentPreviewPanel} pointerEvents="box-none">
            <View style={styles.attachmentPreviewHeader}>
              <Text style={styles.attachmentPreviewTitle} numberOfLines={2}>
                {attachmentPreview?.fileName || 'Image'}
              </Text>
              <Pressable
                onPress={closeAttachmentPreview}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.attachmentPreviewClose}>✕</Text>
              </Pressable>
            </View>
            {attachmentPreview ? (
              <Image
                source={{ uri: attachmentPreview.url }}
                style={styles.attachmentPreviewImage}
                resizeMode="contain"
                accessibilityLabel="Full size chat image"
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerAvatar: {
    marginRight: 10,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onlineText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: {
    flex: 1,
    backgroundColor: '#F3F5F8',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5F8',
  },
  emptyThread: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 24,
  },
  chatContent: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  dateDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D5DB',
  },
  dateDividerText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  footerComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachWrap: {
    position: 'relative',
  },
  footerInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3480E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.82,
  },
  infoModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  infoModalSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingBottom: 24,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoModalClose: {
    fontSize: 20,
    color: '#6B7280',
    lineHeight: 22,
  },
  infoModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  infoLoadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoProfileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoAvatar: {
    marginBottom: 12,
  },
  infoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3480E9',
    textAlign: 'center',
  },
  infoMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  infoSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  infoMemberRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoMemberBadge: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#3480E9',
  },
  infoMemberEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  infoDetailRow: {
    marginBottom: 14,
  },
  infoDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  infoDetailValue: {
    fontSize: 15,
    color: '#1F2937',
  },
  infoWarningBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  infoWarningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  infoActions: {
    marginTop: 20,
    gap: 10,
  },
  infoActionBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  infoActionBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  infoActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  infoActionBtnTextDanger: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B91C1C',
  },
  infoEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  attachmentPreviewRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
  },
  attachmentPreviewBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  attachmentPreviewPanel: {
    marginHorizontal: 16,
    zIndex: 1,
  },
  attachmentPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  attachmentPreviewTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  attachmentPreviewClose: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    padding: 4,
  },
  attachmentPreviewImage: {
    width: '100%',
    height: PREVIEW_IMAGE_MAX_H,
    backgroundColor: 'transparent',
  },
});
