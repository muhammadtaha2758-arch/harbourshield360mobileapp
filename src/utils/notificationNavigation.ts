import type { NotificationNavigation } from '../types/notifications';

type NotificationNavigator = {
  navigate: (name: never, params?: never) => void;
  getParent?: () => NotificationNavigator | undefined;
};

const PATH_TO_TAB: Record<string, string> = {
  '/customer/home': 'DashboardTab',
  '/customer/project': 'ProjectsTab',
  '/customer/invoicing': 'EstimatesInvoicesTab',
  '/customer/document': 'DocumentsTab',
  '/customer/photos-media': 'PhotosMediaTab',
  '/customer/schedule': 'ScheduleTab',
  '/customer/messages': 'MessagesTab',
  '/customer/service-requests': 'ServiceRequestsTab',
  '/customer/financing': 'FinancingTab',
  '/customer/profile': 'ProfileTab',
};

const NAME_TO_TAB: Record<string, string> = {
  dashboard: 'DashboardTab',
  'customer-home': 'DashboardTab',
  messages: 'MessagesTab',
  'customer-messages': 'MessagesTab',
};

const TYPE_TO_TAB: Record<string, string> = {
  service_request: 'ServiceRequestsTab',
  schedule_event: 'ScheduleTab',
  financing_request: 'FinancingTab',
  chat_message: 'MessagesTab',
};

function normalizeRouteKey(name?: string): string {
  if (!name) {
    return '';
  }
  const trimmed = name.trim();
  if (trimmed.startsWith('/')) {
    return trimmed.split('?')[0] ?? trimmed;
  }
  return trimmed.toLowerCase();
}

function resolveTabRoute(
  navigationData?: NotificationNavigation | null,
  notificationType?: string,
): string | null {
  const routeKey = normalizeRouteKey(navigationData?.name || navigationData?.route);
  if (routeKey && PATH_TO_TAB[routeKey]) {
    return PATH_TO_TAB[routeKey];
  }
  if (routeKey && NAME_TO_TAB[routeKey]) {
    return NAME_TO_TAB[routeKey];
  }
  if (routeKey.startsWith('/customer/agreements')) {
    return '__drawer_agreements__';
  }
  if (notificationType && TYPE_TO_TAB[notificationType]) {
    return TYPE_TO_TAB[notificationType];
  }
  return 'DashboardTab';
}

function entityIdFromParams(
  navigationData?: NotificationNavigation | null,
): string | undefined {
  const params = navigationData?.params ?? {};
  const query = navigationData?.query ?? {};
  const raw = params.id ?? params.job_id ?? params.project_id ?? query.id ?? query.job_id;
  if (raw == null || raw === '') {
    return undefined;
  }
  return String(raw);
}

/**
 * Navigate from a notification tap — mirrors TopNav.vue `navigateToNotificationPage`.
 */
export function navigateFromNotification(
  navigation: NotificationNavigator,
  navigationData?: NotificationNavigation | null,
  notificationType?: string,
): void {
  const tabRoute = resolveTabRoute(navigationData, notificationType);
  const entityId = entityIdFromParams(navigationData);
  const routeKey = normalizeRouteKey(navigationData?.name || navigationData?.route);

  if (tabRoute === '__drawer_agreements__') {
    const drawer = navigation.getParent?.() ?? navigation;
    if (entityId) {
      drawer.navigate('Agreements' as never, {
        screen: 'AgreementDetail',
        params: { agreementId: entityId },
      } as never);
    } else {
      drawer.navigate('Agreements' as never);
    }
    return;
  }

  if (tabRoute === 'ProjectsTab' && entityId) {
    navigation.navigate(
      'ProjectsTab' as never,
      {
        screen: 'ProjectDetail',
        params: {
          projectId: entityId,
          title: 'Project',
        },
      } as never,
    );
    return;
  }

  if (routeKey.startsWith('/customer/agreements/') && entityId) {
    const drawer = navigation.getParent?.() ?? navigation;
    drawer.navigate('Agreements' as never, {
      screen: 'AgreementDetail',
      params: { agreementId: entityId },
    } as never);
    return;
  }

  navigation.navigate(tabRoute as never);
}
