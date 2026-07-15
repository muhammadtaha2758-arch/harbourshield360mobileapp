import { toastAlert } from '../utils/toastAlert';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationIcon from '../assets/icons/notification-icon.svg';
import { portalService } from '../services/api/portalService';
import { colors } from '../theme/colors';
import type { PortalNotification } from '../types/notifications';
import { formatNotificationTime } from '../utils/formatNotificationTime';
import { navigateFromNotification } from '../utils/notificationNavigation';

const REFRESH_MS = 30000;

function typeDotStyle(type: PortalNotification['type']) {
  switch (type) {
    case 'success':
      return styles.typeDotSuccess;
    case 'warning':
      return styles.typeDotWarning;
    case 'error':
      return styles.typeDotError;
    default:
      return styles.typeDotInfo;
  }
}

export type NotificationBellPressableProps = {
  /** Pass-through `Pressable` style, including `({ pressed }) => [...]` from parent screens. */
  style?: PressableProps['style'];
  iconWidth?: number;
  iconHeight?: number;
};

export function NotificationBellPressable({
  style,
  iconWidth = 24,
  iconHeight = 25,
}: NotificationBellPressableProps): React.JSX.Element {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    try {
      const count = await portalService.getNotificationsUnreadCount();
      setUnreadCount(count);
    } catch {
      // Badge is best-effort
    }
  }, []);

  const loadNotifications = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const payload = await portalService.getNotifications();
      setNotifications(payload.notifications);
      setUnreadCount(payload.unread_count);
    } catch (error) {
      toastAlert(
        'Notifications',
        error instanceof Error ? error.message : 'Failed to load notifications.',
      );
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openModal = useCallback(async (): Promise<void> => {
    setOpen(true);
    await loadNotifications();
    try {
      await portalService.markNotificationsReadOnOpen();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Keep list visible even if mark-on-open fails
    }
  }, [loadNotifications]);

  const closeModal = useCallback((): void => {
    setOpen(false);
  }, []);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      await portalService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      toastAlert(
        'Notifications',
        error instanceof Error ? error.message : 'Failed to mark all as read.',
      );
    }
  }, []);

  const onNotificationPress = useCallback(
    async (item: PortalNotification): Promise<void> => {
      if (markingId) {
        return;
      }
      setMarkingId(String(item.id));
      try {
        const navigationData =
          (await portalService.markNotificationRead(item.id)) ?? item.navigation ?? null;

        setNotifications((prev) =>
          prev.map((n) => (String(n.id) === String(item.id) ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - (item.read ? 0 : 1)));

        closeModal();
        navigateFromNotification(navigation, navigationData, item.notification_type);
      } catch (error) {
        toastAlert(
          'Notifications',
          error instanceof Error ? error.message : 'Unable to open notification.',
        );
      } finally {
        setMarkingId(null);
      }
    },
    [closeModal, markingId, navigation],
  );

  useEffect(() => {
    refreshUnreadCount().catch(() => undefined);
    refreshTimerRef.current = setInterval(() => {
      refreshUnreadCount().catch(() => undefined);
    }, REFRESH_MS);
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshUnreadCount]);

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <>
      <Pressable
        style={style}
        onPress={() => {
          openModal().catch(() => undefined);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
      >
        <View style={styles.iconWrap}>
          <NotificationIcon width={iconWidth} height={iconHeight} accessibilityElementsHidden />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeModal}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notifications"
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              {unreadCount > 0 ? (
                <Pressable
                  onPress={() => {
                    markAllAsRead().catch(() => undefined);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                >
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </Pressable>
              ) : null}
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading notifications…</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No notifications</Text>
                <Text style={styles.emptySub}>You&apos;re all caught up. New alerts will appear here.</Text>
              </View>
            ) : (
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {notifications.map((item) => {
                  const isUnread = !item.read;
                  const isBusy = markingId === String(item.id);
                  return (
                    <Pressable
                      key={String(item.id)}
                      style={({ pressed }) => [
                        styles.notifRow,
                        isUnread && styles.notifRowUnread,
                        pressed && styles.notifRowPressed,
                      ]}
                      onPress={() => {
                        onNotificationPress(item).catch(() => undefined);
                      }}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      <View style={[styles.typeDot, typeDotStyle(item.type)]} />
                      <View style={styles.notifBody}>
                        <View style={styles.notifTop}>
                          <Text style={styles.notifTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.notifTime}>{formatNotificationTime(item.created_at)}</Text>
                        </View>
                        <Text style={styles.notifText} numberOfLines={3}>
                          {item.message}
                        </Text>
                        {isUnread ? <View style={styles.unreadDot} /> : null}
                      </View>
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.primary} style={styles.rowSpinner} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.footerCount}>
              {notifications.length} notification{notifications.length === 1 ? '' : 's'}
            </Text>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              onPress={closeModal}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    borderBottomWidth: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  markAllRead: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    maxHeight: 420,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
  },
  notifRowUnread: {
    backgroundColor: '#F5F9FF',
  },
  notifRowPressed: {
    opacity: 0.92,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 10,
  },
  typeDotInfo: {
    backgroundColor: colors.primary,
  },
  typeDotSuccess: {
    backgroundColor: '#22C55E',
  },
  typeDotWarning: {
    backgroundColor: '#F59E0B',
  },
  typeDotError: {
    backgroundColor: '#EF4444',
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  notifTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  notifTitle: {
    flex: 1,
    color: '#1D2D44',
    fontSize: 15,
    fontWeight: '700',
  },
  notifTime: {
    color: '#6A7489',
    fontSize: 12,
    fontWeight: '600',
  },
  notifText: {
    color: '#4F5B73',
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  rowSpinner: {
    marginLeft: 8,
    marginTop: 8,
  },
  footerCount: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
  },
  closeBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  closeBtnPressed: {
    opacity: 0.9,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
