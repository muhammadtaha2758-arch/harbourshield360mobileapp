import { toastAlert } from '../utils/toastAlert';
import React, { useCallback, useState } from 'react';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { AppDrawerParamList, AppTabParamList } from './types';
import DashboardIcon from '../assets/icons/drawer-icons/dashboard.svg';
import ProjectsIcon from '../assets/icons/drawer-icons/projects.svg';
import InvoicesIcon from '../assets/icons/drawer-icons/invoices.svg';
import DocumentsIcon from '../assets/icons/drawer-icons/documents.svg';
import AgreementsIcon from '../assets/icons/drawer-icons/agreements.svg';
import PhotosIcon from '../assets/icons/drawer-icons/photos.svg';
import ScheduleIcon from '../assets/icons/drawer-icons/Schedule.svg';
import MessagesIcon from '../assets/icons/drawer-icons/Messages.svg';
import ServicesIcon from '../assets/icons/drawer-icons/services.svg';
import FinancingIcon from '../assets/icons/drawer-icons/financing.svg';
import ProfileIcon from '../assets/icons/drawer-icons/profile.svg';
import LogoutIcon from '../assets/icons/drawer-icons/logout.svg';

type DrawerRouteName = keyof AppDrawerParamList;
type MenuRouteName =
  | 'Dashboard'
  | 'Projects'
  | 'EstimatesInvoices'
  | 'Documents'
  | 'Agreements'
  | 'PhotosMedia'
  | 'Schedule'
  | 'Messages'
  | 'ServiceRequests'
  | 'Financing'
  | 'Profile';

const MENU_ICONS = {
  Dashboard: DashboardIcon,
  Projects: ProjectsIcon,
  EstimatesInvoices: InvoicesIcon,
  Documents: DocumentsIcon,
  Agreements: AgreementsIcon,
  PhotosMedia: PhotosIcon,
  Schedule: ScheduleIcon,
  Messages: MessagesIcon,
  ServiceRequests: ServicesIcon,
  Financing: FinancingIcon,
  Profile: ProfileIcon,
} as const;

const MENU_ITEMS: { name: MenuRouteName; label: string }[] = [
  { name: 'Dashboard', label: 'Dashboard' },
  { name: 'Projects', label: 'Projects' },
  { name: 'EstimatesInvoices', label: 'Estimates & Invoices' },
  { name: 'Documents', label: 'Documents' },
  { name: 'Agreements', label: 'Agreements' },
  { name: 'PhotosMedia', label: 'Photos & Media' },
  { name: 'Schedule', label: 'Schedule' },
  { name: 'Messages', label: 'Messages' },
  { name: 'ServiceRequests', label: 'Services Requests' },
  { name: 'Financing', label: 'Finacing' },
  { name: 'Profile', label: 'Profile' },
];

const MENU_TO_TAB_MAP: Partial<Record<MenuRouteName, keyof AppTabParamList>> = {
  Dashboard: 'DashboardTab',
  Projects: 'ProjectsTab',
  Schedule: 'ScheduleTab',
  Messages: 'MessagesTab',
  PhotosMedia: 'PhotosMediaTab',
  Profile: 'ProfileTab',
  EstimatesInvoices: 'EstimatesInvoicesTab',
  Documents: 'DocumentsTab',
  ServiceRequests: 'ServiceRequestsTab',
  Financing: 'FinancingTab',
};

const MENU_TO_DRAWER_ROUTE_MAP: Partial<Record<MenuRouteName, DrawerRouteName>> = {
  Agreements: 'Agreements',
};

export function AppDrawerContent(props: DrawerContentComponentProps): React.JSX.Element {
  const { navigation, state } = props;
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const activeRouteName = state.routes[state.index]?.name as DrawerRouteName | undefined;
  const activeTabRouteName =
    activeRouteName === 'AppTabs'
      ? ((state.routes[state.index]?.state as { routes?: Array<{ name: string }>; index?: number } | undefined)?.routes?.[
          (state.routes[state.index]?.state as { index?: number } | undefined)?.index ?? 0
        ]?.name as keyof AppTabParamList | undefined)
      : undefined;

  const onNavigate = useCallback(
    (name: MenuRouteName) => {
      const tabRoute = MENU_TO_TAB_MAP[name];
      if (tabRoute) {
        navigation.navigate('AppTabs', { screen: tabRoute } as never);
        navigation.closeDrawer();
        return;
      }
      const drawerRoute = MENU_TO_DRAWER_ROUTE_MAP[name];
      if (drawerRoute) {
        navigation.navigate(drawerRoute);
      }
      navigation.closeDrawer();
    },
    [navigation],
  );

  const confirmLogout = useCallback(async () => {
    setLogoutModalVisible(false);
    navigation.closeDrawer();
    try {
      await logout();
    } catch {
      toastAlert('Logout', 'Could not sign out. Please try again.');
    }
  }, [logout, navigation]);

  return (
    <>
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 + insets.bottom }]}
      style={styles.scroll}
    >
      <View style={[styles.brand, { paddingTop: 8 + insets.top }]}>
        <Text style={styles.brandTitle}>Harborshield360</Text>
        <Text style={styles.brandSubtitle}>Customer Portal</Text>
      </View>

      <View style={styles.menu}>
        {MENU_ITEMS.map(item => {
          const tabRoute = MENU_TO_TAB_MAP[item.name];
          const focused = tabRoute ? activeTabRouteName === tabRoute : activeRouteName === MENU_TO_DRAWER_ROUTE_MAP[item.name];
          const ItemIcon = MENU_ICONS[item.name];
          return (
            <TouchableOpacity
              key={item.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              style={[styles.row, focused && styles.rowActive]}
              onPress={() => onNavigate(item.name)}
            >
              <View style={styles.iconWrap}>
                <ItemIcon width={14} height={14} />
              </View>
              <Text style={[styles.rowLabel, focused && styles.rowLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.row, styles.logoutRow]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <View style={styles.iconWrap}>
            <LogoutIcon width={14} height={14} />
          </View>
          <Text style={styles.rowLabel}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
    <LogoutConfirmModal
      visible={logoutModalVisible}
      onCancel={() => setLogoutModalVisible(false)}
      onConfirm={() => {
        void confirmLogout();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#DEDEDE',
  },
  scrollContent: {
    flexGrow: 1,
  },
  brand: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#C9C9C9',
  },
  brandTitle: {
    color: '#2A2A2A',
    fontSize: 25,
    fontWeight: '600',
    lineHeight: 40,
  },
  brandSubtitle: {
    color: '#2A2A2A',
    fontWeight: '400',
    fontSize: 15,
    marginTop: -2,
  },
  menu: {
    paddingTop: 6,
  },
  row: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#B9B9B9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowActive: {
    backgroundColor: 'transparent',
  },
  rowLabel: {
    color: '#2F2F2F',
    fontSize: 15,
    lineHeight: 22,
  },
  rowLabelActive: {
    color: colors.primary,
  },
  iconWrap: {
    width: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutRow: {
    marginTop: 0,
    borderTopWidth: 0,
  },
});
