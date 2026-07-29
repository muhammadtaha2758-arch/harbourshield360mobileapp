import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerToggleButton,
  type DrawerContentComponentProps,
  type DrawerNavigationOptions,
} from '@react-navigation/drawer';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { DashboardScreen } from '../screens/app/DashboardScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { ComingSoonScreen } from '../screens/app/ComingSoonScreen';
import { ProjectsScreen } from '../screens/work/ProjectsScreen';
import { DocumentsScreen } from '../screens/work/DocumentsScreen';
import { ScheduleScreen } from '../screens/work/ScheduleScreen';
import { MessagesScreen } from '../screens/work/MessagesScreen';
import { ChatScreen } from '../screens/work/ChatScreen';
import { ProjectDetailScreen } from '../screens/work/ProjectDetailScreen';
import { InvoicesScreen } from '../screens/work/InvoicesScreen';
import { PhotosMediaScreen } from '../screens/work/PhotosMediaScreen';
import { ServiceRequestsScreen } from '../screens/work/ServiceRequestsScreen';
import { FinancingScreen } from '../screens/work/FinancingScreen';
import { VendorsScreen } from '../screens/work/VendorsScreen';
import { AgreementsNavigator } from './AgreementsNavigator';
import { AppDrawerContent } from './AppDrawerContent';
import { colors } from '../theme/colors';
import {
  AppDrawerParamList,
  AppRootStackParamList,
  AppTabParamList,
  MessagesStackParamList,
  ProjectsStackParamList,
} from './types';

const Stack = createNativeStackNavigator<AppRootStackParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();
const ProjectsStack = createNativeStackNavigator<ProjectsStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const FAB_SIZE = 49;
const TAB_BAR_SIDE_GAP = 0;
const TAB_BASE_HEIGHT = 96;
const NOTCH_RADIUS = 35;

/** Tab routes that stay in the tab navigator but have no tab chip (opened from drawer / deep links). */
const TAB_BAR_HIDDEN_ROUTES: ReadonlySet<keyof AppTabParamList> = new Set([
  'PhotosMediaTab',
  'EstimatesInvoicesTab',
  'DocumentsTab',
  'ServiceRequestsTab',
  'FinancingTab',
  'VendorsTab',
]);

function renderAppDrawerContent(props: DrawerContentComponentProps): React.JSX.Element {
  return <AppDrawerContent {...props} />;
}

const drawerScreenOptions: DrawerNavigationOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
  drawerStyle: {
    backgroundColor: '#DEDEDE',
    width: 292,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  sceneStyle: { backgroundColor: colors.background },
  headerLeft: props => <DrawerToggleButton tintColor={colors.primary} {...props} />,
};

function AppShell(): React.JSX.Element {
  return (
    <Drawer.Navigator
      initialRouteName="AppTabs"
      drawerContent={renderAppDrawerContent}
      screenOptions={drawerScreenOptions}
    >
      <Drawer.Screen name="AppTabs" component={AppTabs} options={{ title: 'Dashboard', headerShown: false }} />
      <Drawer.Screen
        name="Agreements"
        component={AgreementsNavigator}
        options={{ title: 'Agreements', headerShown: false }}
      />
    </Drawer.Navigator>
  );
}

function TabIcon({ routeName, focused }: { routeName: keyof AppTabParamList; focused: boolean }): React.JSX.Element {
  const stroke = focused ? '#2A69E8' : '#444444';
  const common = { stroke, strokeWidth: 1.6, fill: 'none' as const, strokeLinecap: 'round' as const };

  if (routeName === 'DashboardTab') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Rect x="3" y="4" width="4.5" height="14" {...common} />
        <Rect x="9.75" y="6" width="4.5" height="12" {...common} />
        <Rect x="16.5" y="4" width="4.5" height="14" {...common} />
        <Path d="M5.25 9l4.5-3.5L12 8l4.5-4.5" {...common} />
      </Svg>
    );
  }
  if (routeName === 'ScheduleTab') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Rect x="4" y="5" width="16" height="14" {...common} />
        <Path d="M4 9h16M8 3.8v2.8M16 3.8v2.8" {...common} />
      </Svg>
    );
  }
  if (routeName === 'ProjectsTab') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M3 8h18v11H3zM3 8V6h7l1.6 2" {...common} />
      </Svg>
    );
  }
  if (routeName === 'MessagesTab') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M4 6h13v10H9l-4 4v-4H4z" {...common} />
        <Path d="M9 9.5h6M9 12.5h5" {...common} />
      </Svg>
    );
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="5" y="4.5" width="14" height="15" {...common} />
      <Path d="M8 18.5v-4c0-2.2 1.8-4 4-4s4 1.8 4 4v4" {...common} />
      <Path d="M12 7.4a2.3 2.3 0 100 4.6 2.3 2.3 0 000-4.6z" {...common} />
    </Svg>
  );
}

function NotchedTabBackground({ width, height }: { width: number; height: number }): React.JSX.Element {
  const center = width / 2;
  const notchLeft = center - 40;
  const notchRight = center + 40;
  const notchDepth = NOTCH_RADIUS + 5;
  const d = [
    `M 16 0`,
    `H ${notchLeft}`,
    // U-shape notch: steeper sides, rounded bottom
    `C ${notchLeft + 4} 0 ${center - 26} ${notchDepth} ${center} ${notchDepth}`,
    `C ${center + 26} ${notchDepth} ${notchRight - 4} 0 ${notchRight} 0`,
    `H ${width - 16}`,
    `Q ${width} 0 ${width} 16`,
    `V ${height}`,
    `H 0`,
    `V 16`,
    `Q 0 0 16 0`,
    'Z',
  ].join(' ');

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Path d={d} fill="#EEEEEE" stroke="#D9D9D9" strokeWidth={1} />
      <Path d={d} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={0.8} />
    </Svg>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centerRoute: keyof AppTabParamList = 'ProjectsTab';
  const selectedTabRoute = state.routes[state.index];
  const selectedRoute = selectedTabRoute?.name as keyof AppTabParamList;
  const selectedMessagesStackState = selectedTabRoute?.state as
    | { routes?: Array<{ name: string }>; index?: number }
    | undefined;
  const selectedMessagesRouteName =
    selectedRoute === 'MessagesTab'
      ? selectedMessagesStackState?.routes?.[selectedMessagesStackState.index ?? 0]?.name
      : undefined;

  if (selectedRoute === 'MessagesTab' && selectedMessagesRouteName === 'Chat') {
    return <></>;
  }

  const innerWidth = Math.max(width - TAB_BAR_SIDE_GAP * 2, 280);
  const barHeight = TAB_BASE_HEIGHT + insets.bottom;

  return (
    <View style={[styles.tabBarWrap, { paddingHorizontal: TAB_BAR_SIDE_GAP, height: barHeight }]}>
      <View style={[styles.tabBarInner, { height: barHeight }]}>
        <NotchedTabBackground width={innerWidth} height={barHeight} />

        <View style={styles.fabBackdrop} />
        <Pressable
          style={({ pressed }) => [styles.fabButton, selectedRoute === centerRoute && styles.fabButtonActive, pressed && styles.fabPressed]}
          onPress={() => navigation.navigate(centerRoute)}
        >
          <Text style={styles.fabPlus}>+</Text>
        </Pressable>

        <View style={[styles.tabRow, { paddingBottom: insets.bottom }]}>
          {state.routes
            .map((route, index) => ({ route, index }))
            .filter(({ route }) => !TAB_BAR_HIDDEN_ROUTES.has(route.name as keyof AppTabParamList))
            .map(({ route, index }) => {
            if (route.name === centerRoute) {
              const options = descriptors[route.key]?.options;
              const label = typeof options?.title === 'string' ? options.title : route.name;
              const isFocused = state.index === index;
              const onCenterPress = (): void => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <Pressable key={route.key} style={styles.centerSlot} onPress={onCenterPress}>
                  <TabIcon routeName={route.name as keyof AppTabParamList} focused={isFocused} />
                  <Text style={[styles.tabLabel, styles.centerTabLabel, isFocused && styles.tabLabelFocused]}>
                    {label}
                  </Text>
                </Pressable>
              );
            }

            const options = descriptors[route.key]?.options;
            const label = typeof options?.title === 'string' ? options.title : route.name;
            const isFocused = state.index === index;

            const onPress = (): void => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable key={route.key} style={styles.tabItem} onPress={onPress}>
                <TabIcon routeName={route.name as keyof AppTabParamList} focused={isFocused} />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarShowLabel: false,
};

function ProjectsTabNavigator(): React.JSX.Element {
  return (
    <ProjectsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProjectsStack.Screen name="ProjectsList" component={ProjectsScreen} />
      <ProjectsStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

function MessagesTabNavigator(): React.JSX.Element {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} />
    </MessagesStack.Navigator>
  );
}

function AppTabs(): React.JSX.Element {
  return (
    <Tabs.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={tabScreenOptions}>
      <Tabs.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'DashBoard' }} />
      <Tabs.Screen name="ScheduleTab" component={ScheduleScreen} options={{ title: 'Schedule' }} />
      <Tabs.Screen name="ProjectsTab" component={ProjectsTabNavigator} options={{ title: 'Projects' }} />
      <Tabs.Screen name="MessagesTab" component={MessagesTabNavigator} options={{ title: 'Messages' }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Tabs.Screen name="PhotosMediaTab" component={PhotosMediaScreen} options={{ title: 'Photos' }} />
      <Tabs.Screen name="EstimatesInvoicesTab" component={InvoicesScreen} options={{ title: 'Invoices' }} />
      <Tabs.Screen name="DocumentsTab" component={DocumentsScreen} options={{ title: 'Documents' }} />
      <Tabs.Screen name="ServiceRequestsTab" component={ServiceRequestsScreen} options={{ title: 'Services' }} />
      <Tabs.Screen name="FinancingTab" component={FinancingScreen} options={{ title: 'Financing' }} />
      <Tabs.Screen name="VendorsTab" component={VendorsScreen} options={{ title: 'Vendors' }} />
    </Tabs.Navigator>
  );
}

function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { token, isInitializing } = useAuth();

  if (isInitializing) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <Stack.Screen name="AppShell" component={AppShell} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    
  },
  tabBarInner: {
    justifyContent: 'flex-end',
  
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 36,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 12,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    marginBottom: 12,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#444444',
    marginTop: 1,
  },
  tabLabelFocused: {
    color: '#2A69E8',
  },
  centerTabLabel: {
    marginTop: 1,
  },
  fabBackdrop: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -34,
    width: 68,
    height: 38,
    backgroundColor: 'transparent',
   
   
  },
  fabButton: {
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -(FAB_SIZE / 2),
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabButtonActive: {
    backgroundColor: '#F7FAFF',
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabPlus: {
    color: '#2A69E8',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});
