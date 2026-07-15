import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import type { AppDrawerParamList } from '../../navigation/types';

export function ComingSoonScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<AppDrawerParamList>>();
  const title = String(route.name);

  return (
    <ScreenContainer>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>This section will connect to your account soon.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
