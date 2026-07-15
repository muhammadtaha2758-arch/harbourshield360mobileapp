import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function AppButton({ title, onPress, disabled = false }: AppButtonProps): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    backgroundColor: colors.primaryDark,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
