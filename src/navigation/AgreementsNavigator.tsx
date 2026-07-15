import React from 'react';
import {
  createNativeStackNavigator,
  type NativeStackHeaderLeftProps,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { HeaderBackButton } from '@react-navigation/elements';
import { colors } from '../theme/colors';
import { AgreementsStackParamList } from './types';
import { AgreementsScreen } from '../screens/work/AgreementsScreen';
import { AgreementDetailScreen } from '../screens/work/AgreementDetailScreen';

const Stack = createNativeStackNavigator<AgreementsStackParamList>();

function AgreementsStackHeaderLeft(props: NativeStackHeaderLeftProps): React.JSX.Element {
  if (props.canGoBack) {
    return <HeaderBackButton {...props} />;
  }
  return <DrawerToggleButton tintColor={colors.primary} {...props} />;
}

function agreementDetailHeaderLeft(
  props: NativeStackHeaderLeftProps,
  navigation: NativeStackNavigationProp<AgreementsStackParamList>,
): React.JSX.Element {
  return (
    <HeaderBackButton
      {...props}
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('AgreementsList');
        }
      }}
    />
  );
}

export function AgreementsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="AgreementsList"
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerLeft: AgreementsStackHeaderLeft,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="AgreementsList"
        component={AgreementsScreen}
        options={{ title: 'Agreements', headerShown: false }}
      />
      <Stack.Screen
        name="AgreementDetail"
        component={AgreementDetailScreen}
        options={({ navigation }) => ({
          title: 'Agreement',
          headerLeft: (headerProps) => agreementDetailHeaderLeft(headerProps, navigation),
        })}
      />
    </Stack.Navigator>
  );
}
