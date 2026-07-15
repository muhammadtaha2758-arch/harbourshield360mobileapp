import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { colors } from '../../theme/colors';
import { portalScreenLayout, PORTAL_HEADER_TOP_PADDING } from '../../theme/portalScreenLayout';
import type { ChatGroup, ChatUsersPayload } from '../../types/portal';
import type { MessagesStackParamList } from '../../navigation/types';
import { buildConversationPreviews, enrichConversationSources, type ConversationPreview } from '../../utils/chatMapping';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { ChatHeaderAvatar } from '../../components/ChatHeaderAvatar';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { MESSAGE_STATUS_OPTIONS, STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { applyListFilters } from '../../utils/listFiltering';

export function MessagesScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<MessagesStackParamList>>();
  const [usersPayload, setUsersPayload] = useState<ChatUsersPayload | null>(null);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [u, g] = await Promise.all([portalService.getChatUsers(), portalService.getChatGroups()]);
      const currentId = String(u.client?.id ?? '');
      const enriched = await enrichConversationSources(
        u.admins ?? [],
        g,
        currentId || undefined,
        (id) => portalService.getDirectMessages(id, 1),
        (id) => portalService.getGroupMessages(id, 1),
      );
      setUsersPayload({ ...u, admins: enriched.admins });
      setGroups(enriched.groups);
    } catch (error) {
      toastAlert('Messages', error instanceof Error ? error.message : 'Failed to load chat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load(false).catch(() => setLoading(false));
  }, [load]);

  const currentUserId = useMemo(
    () => String(usersPayload?.client?.id ?? ''),
    [usersPayload?.client?.id],
  );

  const previews = useMemo(
    () => buildConversationPreviews(usersPayload?.admins ?? [], groups, currentUserId || undefined),
    [usersPayload?.admins, groups, currentUserId],
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

  const openDrawer = (): void => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  if (loading && !usersPayload) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        <Pressable style={styles.ctaButton}>
          <Text style={styles.ctaText}>+ Create Meeting Room</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        {previews.length === 0 ? (
          <Text style={styles.emptyText}>No conversations yet. Contact support from the web portal to get started.</Text>
        ) : filteredPreviews.length === 0 ? (
          <Text style={styles.emptyText}>No conversations match your search or filters.</Text>
        ) : null}
        {filteredPreviews.map((chat) => (
          <Pressable key={chat.id} style={styles.chatRow} onPress={() => openChat(chat)}>
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
                <Text style={styles.unreadBadgeText}>{chat.unreadCount > 99 ? '99+' : String(chat.unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

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
  blueHeader: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: PORTAL_HEADER_TOP_PADDING,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    color: '#FFFFFF',
    fontSize: 12,
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
  searchShell: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  innerFilterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    marginBottom: 12,
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
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
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
