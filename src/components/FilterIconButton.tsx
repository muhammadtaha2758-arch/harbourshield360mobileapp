import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import FilterIconSvg from '../assets/icons/filter-icon.svg';
import { colors } from '../theme/colors';

type Props = {
  onPress: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  iconWidth?: number;
  iconHeight?: number;
};

export function FilterIconButton({
  onPress,
  active = false,
  style,
  iconWidth = 18,
  iconHeight = 22,
}: Props): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, style, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open filters"
      accessibilityState={{ selected: active }}
    >
      <FilterIconSvg width={iconWidth} height={iconHeight} accessibilityLabel="" />
      {active ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.innerFilterBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
