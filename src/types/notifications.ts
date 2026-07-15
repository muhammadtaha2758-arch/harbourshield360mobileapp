export type NotificationVisualType = 'info' | 'success' | 'warning' | 'error';

export type NotificationNavigation = {
  name?: string;
  route?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export type PortalNotification = {
  id: number | string;
  title: string;
  message: string;
  type: NotificationVisualType;
  read: boolean;
  created_at: string;
  notification_type?: string;
  navigation?: NotificationNavigation | null;
};

export type NotificationsIndexResponse = {
  success: boolean;
  notifications: PortalNotification[];
  total_count: number;
  unread_count: number;
  message?: string;
};

export type NotificationMarkReadResponse = {
  success: boolean;
  message?: string;
  navigation?: NotificationNavigation | null;
};
