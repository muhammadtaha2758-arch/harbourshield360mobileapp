import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scrollable = true,
  contentContainerStyle,
}: ScreenContainerProps): React.JSX.Element {
  if (!scrollable) {
    return <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
});
