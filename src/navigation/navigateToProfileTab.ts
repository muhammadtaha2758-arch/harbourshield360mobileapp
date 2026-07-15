import { CommonActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

export function navigateToProfileTab(navigation: NavigationProp<ParamListBase>): void {
  let nav: NavigationProp<ParamListBase> | undefined = navigation;

  while (nav) {
    const routeNames = nav.getState()?.routeNames ?? [];
    if (routeNames.includes('ProfileTab')) {
      nav.navigate('ProfileTab' as never);
      return;
    }
    nav = nav.getParent();
  }

  navigation.dispatch(
    CommonActions.navigate({
      name: 'AppTabs',
      params: { screen: 'ProfileTab' },
    }),
  );
}
