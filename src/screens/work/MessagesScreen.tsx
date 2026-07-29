import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout, PORTAL_HEADER_TOP_PADDING } from '../../theme/portalScreenLayout';
import type { ChatGroup, ChatUsersPayload } from '../../types/portal';
import type { MessagesStackParamList } from '../../navigation/types';
import { buildConversationPreviews, enrichConversationSources, type ConversationPreview } from '../../utils/chatMapping';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { CreateMeetingRoomSheet } from '../../components/CreateMeetingRoomSheet';
import { StartConversationSheet } from '../../components/StartConversationSheet';
import { ChatHeaderAvatar } from '../../components/ChatHeaderAvatar';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { MESSAGE_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';
import type { ChatContact } from '../../types/portal';

/** Matches CustomTabBar TAB_BASE_HEIGHT so list content clears the absolute tab bar. */
const TAB_BAR_BASE_HEIGHT = 96;

export function MessagesScreen(): React.JSX.Element {
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
      const [u, g] = await Promise.all([portalService.getChatUsers(), portalService.getChatGroups()]);
      const currentId = String(u.client?.id ?? '');
      const enriched = await enrichConversationSources(
        u.admins ?? [],
        g,
        currentId || undefined,
        (id) => portalService.getDirectMessages(id, 1),
        (id) => portalService.getGroupMessages(id, 1),
        u.peers ?? [],
      );
      setUsersPayload({ ...u, admins: enriched.admins, peers: enriched.peers });
      setGroups(enriched.groups);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);

      const intervalId = setInterval(() => {
        void load(true, { silent: true });
      }, 10000);

      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          void load(true, { silent: true });
        }
      });

      return () => {
        clearInterval(intervalId);
        appStateSub.remove();
      };
    }, [load]),
  );

  const currentUserId = useMemo(
    () => String(usersPayload?.client?.id ?? ''),
    [usersPayload?.client?.id],
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
    let list = previews;
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
  }, [previews, searchQuery, sortBy, statusFilter]);

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;
  const listBottomPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 16;

  const openChat = useCallback(
    (chat: ConversationPreview) => {
      if (!currentUserId) {
        toastAlert('Messages', 'Unable to open chat. Please pull to refresh and try again.');
        return;
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
        chatId: `direct-${String(peer.id)}`,
        name: String(peer.name || peer.email || 'Chat'),
        type: 'direct',
        currentUserId,
        peerUserId: String(peer.id),
      });
    },
    [currentUserId, navigation],
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
          <Pressable style={styles.chatRow} onPress={() => openChat(chat)}>
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
            {chat.unreadCount > 0 ? (
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
