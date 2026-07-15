import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  query?: string;
  onClear: () => void;
  message?: string;
};

export function SearchResultsEmpty({
  query,
  onClear,
  message = 'Try a different search term or clear filters.',
}: Props): React.JSX.Element {
  const trimmed = query?.trim();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>No matching results</Text>
      <Text style={styles.sub}>
        {trimmed ? `Nothing matches "${trimmed}". ${message}` : message}
      </Text>
      <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={onClear}>
        <Text style={styles.btnText}>Clear search & filters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
