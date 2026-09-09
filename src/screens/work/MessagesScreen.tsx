import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { sessionStorage } from '../../services/storage/sessionStorage';
import { colors } from '../../theme/colors';
import { portalScreenLayout, PORTAL_HEADER_TOP_PADDING } from '../../theme/portalScreenLayout';
import type { ChatContact, ChatGroup, ChatUsersPayload } from '../../types/portal';
import type { MessagesStackParamList } from '../../navigation/types';
import { buildConversationPreviews, enrichConversationSources, type ConversationPreview } from '../../utils/chatMapping';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { CreateMeetingRoomSheet } from '../../components/CreateMeetingRoomSheet';
import { StartConversationSheet } from '../../components/StartConversationSheet';
import {
  ConversationManageSheet,
  type ConversationManageRole,
} from '../../components/ConversationManageSheet';
import { ChatHeaderAvatar } from '../../components/ChatHeaderAvatar';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { MESSAGE_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import { useAuth } from '../../context/AuthContext';
import { subscribeChatInbox, type ChatInboxIncoming } from '../../services/push/chatInboxEvents';

/** Matches CustomTabBar TAB_BASE_HEIGHT so list content clears the absolute tab bar. */
const TAB_BAR_BASE_HEIGHT = 96;

function wallClockNow(): string {
  const date = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function applyWipedGroupPreviews(groups: ChatGroup[], wipedGroupIds: string[]): ChatGroup[] {
  if (wipedGroupIds.length === 0) {
    return groups;
  }
  const wiped = new Set(wipedGroupIds);
  return groups.map((group) => {
    if (!wiped.has(String(group.id))) {
      return group;
    }
    return {
      ...group,
      last_message_preview: '',
      last_message: '',
      last_message_time: undefined,
      last_message_sender: null,
      unread_count: 0,
    };
  });
}

function keepHigherUnread<T extends { id: number | string; unread_count?: number }>(
  previous: T[] | undefined,
  incoming: T[],
): T[] {
  const prevById = new Map((previous ?? []).map((item) => [String(item.id), item]));
  return incoming.map((item) => {
    const prev = prevById.get(String(item.id));
    const apiUnread = Number(item.unread_count) || 0;
    const localUnread = Number(prev?.unread_count) || 0;
    if (localUnread <= apiUnread) {
      return item;
    }
    return { ...item, unread_count: localUnread };
  });
}

function bumpDirectUnread(contacts: ChatContact[], peerUserId: string, event: ChatInboxIncoming): ChatContact[] {
  return contacts.map((contact) => {
    if (String(contact.id) !== peerUserId) {
      return contact;
    }
    const unread = (Number(contact.unread_count) || 0) + 1;
    return {
      ...contact,
      unread_count: unread,
      last_message_preview: event.preview || contact.last_message_preview,
      last_message: event.preview || contact.last_message_preview,
      last_message_time: wallClockNow(),
      last_message_is_mine: false,
      last_message_sender: event.senderName,
    };
  });
}

export function MessagesScreen(): React.JSX.Element {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<MessagesStackParamList>>();
  const insets = useSafeAreaInsets();
  const [usersPayload, setUsersPayload] = useState<ChatUsersPayload | null>(null);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [startConversationOpen, setStartConversationOpen] = useState(false);
  const [hiddenConversationIds, setHiddenConversationIds] = useState<string[]>([]);
  const [managingChatId, setManagingChatId] = useState<string | null>(null);
  const [manageSheetChat, setManageSheetChat] = useState<ConversationPreview | null>(null);
  const [manageSheetRole, setManageSheetRole] = useState<ConversationManageRole | null>(null);
  /** Kept after sheet close so wipe/delete/leave confirms still have the target chat. */
  const manageSheetChatRef = useRef<ConversationPreview | null>(null);
  const loadInFlightRef = useRef(false);

  const load = useCallback(async (isRefresh: boolean, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (loadInFlightRef.current) {
      return;
    }
    loadInFlightRef.current = true;
    try {
      if (!silent) {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }
      const wipedGroupIds = await sessionStorage.getWipedGroupIds();
      const [u, g] = await Promise.all([portalService.getChatUsers(), portalService.getChatGroups()]);
      const currentId = String(user?.id ?? u.client?.id ?? '');
      if (silent) {
        setUsersPayload((prev) => ({
          ...u,
          admins: keepHigherUnread(prev?.admins, u.admins ?? []),
          peers: keepHigherUnread(prev?.peers, u.peers ?? []),
        }));
        setGroups((prev) =>
          keepHigherUnread(prev, applyWipedGroupPreviews(g.filter((group) => !group.deleted_at), wipedGroupIds)),
        );
      } else {
        const hiddenMessageIds = new Set(await sessionStorage.getHiddenMessageIds());
        const enriched = await enrichConversationSources(
          u.admins ?? [],
          g,
          currentId || undefined,
          (id) => portalService.getDirectMessages(id, 1, { markRead: false }),
          async (id) => {
            const msgs = await portalService.getGroupMessages(id, 1, { markRead: false });
            return msgs.filter((msg) => !hiddenMessageIds.has(String(msg.id)));
          },
          u.peers ?? [],
        );
        setUsersPayload({ ...u, admins: enriched.admins, peers: enriched.peers });
        // Soft-deleted rooms stay in DB for history; hide them from the mobile inbox.
        setGroups(
          applyWipedGroupPreviews(
            enriched.groups.filter((group) => !group.deleted_at),
            wipedGroupIds,
          ),
        );
      }
    } catch (error) {
      if (!silent) {
        toastAlert('Messages', error instanceof Error ? error.message : 'Failed to load chat.');
      }
    } finally {
      loadInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
      void sessionStorage.getHiddenConversationIds().then(setHiddenConversationIds);

      const intervalId = setInterval(() => {
        void load(true, { silent: true });
      }, 10000);

      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          void load(true, { silent: true });
        }
      });

      const unsubscribeInbox = subscribeChatInbox((event) => {
        if (event.chatType === 'direct' && event.peerUserId) {
          const peerId = String(event.peerUserId);
          setUsersPayload((prev) => {
            if (!prev) {
              return prev;
            }
            return {
              ...prev,
              admins: bumpDirectUnread(prev.admins ?? [], peerId, event),
              peers: bumpDirectUnread(prev.peers ?? [], peerId, event),
            };
          });
        } else if (event.chatType === 'group' && event.groupId) {
          const groupId = String(event.groupId);
          void sessionStorage.clearWipedGroup(groupId);
          setGroups((prev) =>
            prev.map((group) => {
              if (String(group.id) !== groupId) {
                return group;
              }
              return {
                ...group,
                unread_count: (Number(group.unread_count) || 0) + 1,
                last_message_preview: event.preview || group.last_message_preview,
                last_message: event.preview || group.last_message,
                last_message_time: wallClockNow(),
                last_message_is_mine: false,
                last_message_sender: event.senderName,
              };
            }),
          );
        }
      });

      return () => {
        clearInterval(intervalId);
        appStateSub.remove();
        unsubscribeInbox();
      };
    }, [load]),
  );

  const currentUserId = useMemo(
    () => String(user?.id ?? usersPayload?.client?.id ?? ''),
    [user?.id, usersPayload?.client?.id],
  );

  const previews = useMemo(
    () =>
      buildConversationPreviews(
        usersPayload?.admins ?? [],
        groups,
        currentUserId || undefined,
        usersPayload?.peers ?? [],
      ),
    [usersPayload?.admins, usersPayload?.peers, groups, currentUserId],
  );

  const filteredPreviews = useMemo(() => {
    const hidden = new Set(hiddenConversationIds);
    let list = previews.filter((chat) => !hidden.has(chat.id));
    if (statusFilter === 'unread') {
      list = list.filter((chat) => chat.unreadCount > 0);
    }
    return applyListFilters(list, {
      searchQuery,
      searchFields: (chat) => [chat.name, chat.preview, chat.time],
      sort: sortBy,
      getName: (chat) => chat.name,
      getDate: (chat) => chat.lastMessageAt ?? chat.time,
    });
  }, [previews, searchQuery, sortBy, statusFilter, hiddenConversationIds]);

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;
  const listBottomPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 16;

  const openChat = useCallback(
    (chat: ConversationPreview) => {
      if (!currentUserId) {
        toastAlert('Messages', 'Unable to open chat. Please pull to refresh and try again.');
        return;
      }

      if (chat.type === 'direct' && chat.peerUserId) {
        const peerId = String(chat.peerUserId);
        setUsersPayload((prev) => {
          if (!prev) {
            return prev;
          }
          const zeroUnread = (contacts: ChatContact[]): ChatContact[] =>
            contacts.map((contact) =>
              String(contact.id) === peerId ? { ...contact, unread_count: 0 } : contact,
            );
          return {
            ...prev,
            admins: zeroUnread(prev.admins ?? []),
            peers: zeroUnread(prev.peers ?? []),
          };
        });
      } else if (chat.groupId) {
        const groupId = String(chat.groupId);
        setGroups((prev) =>
          prev.map((group) =>
            String(group.id) === groupId ? { ...group, unread_count: 0 } : group,
          ),
        );
      }

      navigation.navigate('Chat', {
        chatId: chat.id,
        name: chat.name,
        type: chat.type,
        currentUserId,
        peerUserId: chat.peerUserId,
        groupId: chat.groupId,
        avatarUri: chat.avatarUri,
      });
    },
    [currentUserId, navigation],
  );

  const openPeerChat = useCallback(
    (peer: ChatContact) => {
      if (!currentUserId) {
        toastAlert('Messages', 'Unable to open chat. Please pull to refresh and try again.');
        return;
      }

      const chatId = `direct-${String(peer.id)}`;
      void sessionStorage.unhideConversation(chatId).then(() => {
        setHiddenConversationIds((prev) => prev.filter((id) => id !== chatId));
      });

      setUsersPayload((prev) => {
        if (!prev) {
          return prev;
        }
        const existing = (prev.peers ?? []).some((item) => String(item.id) === String(peer.id));
        if (existing) {
          return prev;
        }
        return {
          ...prev,
          peers: [peer, ...(prev.peers ?? [])],
        };
      });

      navigation.navigate('Chat', {
        chatId,
        name: String(peer.name || peer.email || 'Chat'),
        type: 'direct',
        currentUserId,
        peerUserId: String(peer.id),
      });
    },
    [currentUserId, navigation],
  );

  const hideConversation = useCallback(async (chat: ConversationPreview) => {
    try {
      await sessionStorage.hideConversation(chat.id);
      setHiddenConversationIds((prev) => (prev.includes(chat.id) ? prev : [...prev, chat.id]));
      toastAlert('Messages', 'Removed from your Messages list.');
    } catch (error) {
      toastAlert('Messages', error instanceof Error ? error.message : 'Unable to hide conversation.');
    }
  }, []);

  const deleteMeetingRoom = useCallback(
    async (chat: ConversationPreview) => {
      if (!chat.groupId) {
        return;
      }
      setManagingChatId(chat.id);
      try {
        const message = await portalService.deleteChatGroup(chat.groupId);
        await sessionStorage.hideConversation(chat.id);
        setHiddenConversationIds((prev) => (prev.includes(chat.id) ? prev : [...prev, chat.id]));
        setGroups((prev) => prev.filter((group) => String(group.id) !== String(chat.groupId)));
        toastAlert('Messages', message);
      } catch (error) {
        await sessionStorage.hideConversation(chat.id);
        setHiddenConversationIds((prev) => (prev.includes(chat.id) ? prev : [...prev, chat.id]));
        setGroups((prev) => prev.filter((group) => String(group.id) !== String(chat.groupId)));
        toastAlert(
          'Messages',
          'Removed from your Messages list. Only the room creator can close it for everyone.',
        );
      } finally {
        setManagingChatId(null);
      }
    },
    [],
  );

  const wipeMeetingRoom = useCallback(async (chat: ConversationPreview) => {
    if (!chat.groupId) {
      return;
    }
    setManagingChatId(chat.id);
    try {
      const message = await portalService.wipeChatGroup(chat.groupId);
      setGroups((prev) =>
        prev.map((group) =>
          String(group.id) === String(chat.groupId)
            ? {
                ...group,
                last_message_preview: '',
                last_message: '',
                last_message_time: undefined,
                last_message_sender: null,
                unread_count: 0,
              }
            : group,
        ),
      );
      toastAlert('Messages', message);
    } catch (error) {
      toastAlert('Messages', error instanceof Error ? error.message : 'Unable to wipe meeting room.');
    } finally {
      setManagingChatId(null);
    }
  }, []);

  const leaveMeetingRoom = useCallback(async (chat: ConversationPreview) => {
    if (!chat.groupId) {
      return;
    }
    setManagingChatId(chat.id);
    try {
      const message = await portalService.leaveChatGroup(chat.groupId);
      await sessionStorage.hideConversation(chat.id);
      setHiddenConversationIds((prev) => (prev.includes(chat.id) ? prev : [...prev, chat.id]));
      setGroups((prev) => prev.filter((group) => String(group.id) !== String(chat.groupId)));
      toastAlert('Messages', message);
    } catch (error) {
      toastAlert('Messages', error instanceof Error ? error.message : 'Unable to leave meeting room.');
    } finally {
      setManagingChatId(null);
    }
  }, []);

  const closeManageSheet = useCallback(() => {
    setManageSheetChat(null);
    setManageSheetRole(null);
  }, []);

  const onManageChat = useCallback(
    (chat: ConversationPreview) => {
      if (managingChatId) {
        return;
      }

      manageSheetChatRef.current = chat;

      if (chat.type === 'direct') {
        setManageSheetChat(chat);
        setManageSheetRole('direct');
        return;
      }

      const group = groups.find((item) => String(item.id) === String(chat.groupId));
      const isCreator =
        group?.created_by != null && currentUserId !== '' && String(group.created_by) === currentUserId;

      setManageSheetChat(chat);
      setManageSheetRole(isCreator ? 'creator' : 'member');
    },
    [currentUserId, groups, managingChatId],
  );

  const openDrawer = useCallback((): void => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const listHeader = useMemo(
    () => (
      <View style={styles.blueHeader}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={styles.iconTile} />
        </View>

        <View style={styles.searchRow}>
          <Pressable onPress={openDrawer} style={styles.iconTile}>
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
            variant="onPrimary"
          />
        </View>

        <Text style={styles.screenTitle}>Messages{'\n'}Chat</Text>
        <View style={styles.ctaRow}>
          <Pressable
            style={styles.ctaButton}
            onPress={() => setStartConversationOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Start conversation"
          >
            <Text style={styles.ctaText}>+ Start Conversation</Text>
          </Pressable>
          <Pressable
            style={styles.ctaButton}
            onPress={() => setCreateRoomOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create meeting room"
          >
            <Text style={styles.ctaText}>+ Create Meeting Room</Text>
          </Pressable>
        </View>
      </View>
    ),
    [filterActive, openDrawer, searchQuery],
  );

  if (loading && !usersPayload) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filteredPreviews}
        keyExtractor={(chat) => chat.id}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces
        alwaysBounceVertical
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {previews.length === 0
              ? 'No conversations yet. Start a conversation with another customer, or create a meeting room.'
              : 'No conversations match your search or filters.'}
          </Text>
        }
        renderItem={({ item: chat }) => (
          <Pressable
            style={styles.chatRow}
            onPress={() => openChat(chat)}
            onLongPress={() => onManageChat(chat)}
            delayLongPress={350}
            accessibilityHint="Long press to delete, leave, or hide"
          >
            <ChatHeaderAvatar name={chat.name} uri={chat.avatarUri} size={48} style={styles.chatAvatarSpacing} />
            <View style={styles.chatBody}>
              <View style={styles.chatTopLine}>
                <Text style={[styles.chatName, chat.unreadCount > 0 && styles.chatNameUnread]}>{chat.name}</Text>
                {chat.time ? <Text style={styles.chatTime}>{chat.time}</Text> : null}
              </View>
              <Text
                style={[styles.chatPreview, chat.unreadCount > 0 && styles.chatPreviewUnread]}
                numberOfLines={1}
              >
                {chat.preview}
              </Text>
            </View>
            {managingChatId === chat.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : chat.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {chat.unreadCount > 99 ? '99+' : String(chat.unreadCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />

      <StartConversationSheet
        visible={startConversationOpen}
        onClose={() => setStartConversationOpen(false)}
        onReady={openPeerChat}
      />

      <ConversationManageSheet
        visible={manageSheetChat != null && manageSheetRole != null}
        chat={manageSheetChat}
        role={manageSheetRole}
        onClose={closeManageSheet}
        onHide={() => {
          const chat = manageSheetChatRef.current;
          if (chat) {
            void hideConversation(chat);
          }
        }}
        onWipe={() => {
          const chat = manageSheetChatRef.current;
          if (chat) {
            void wipeMeetingRoom(chat);
          }
        }}
        onDelete={() => {
          const chat = manageSheetChatRef.current;
          if (chat) {
            void deleteMeetingRoom(chat);
          }
        }}
        onLeave={() => {
          const chat = manageSheetChatRef.current;
          if (chat) {
            void leaveMeetingRoom(chat);
          }
        }}
      />

      <CreateMeetingRoomSheet
        visible={createRoomOpen}
        onClose={() => setCreateRoomOpen(false)}
        onCreated={() => {
          load(true).catch(() => undefined);
        }}
      />

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={MESSAGE_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={statusFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setStatusFilter(status);
          setSortBy(sort);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  blueHeader: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: PORTAL_HEADER_TOP_PADDING,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 4,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: {
    width: 18,
    gap: 4,
  },
  menuLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chatAvatarSpacing: {
    marginRight: 12,
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  chatTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  chatPreview: {
    fontSize: 14,
    color: '#6B7280',
  },
  chatPreviewUnread: {
    color: '#374151',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
