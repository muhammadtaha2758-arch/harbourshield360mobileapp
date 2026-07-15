import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface InfoCardProps {
  title: string;
  value: string;
}

export function InfoCard({ title, value }: InfoCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
});
