import React from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import SearchIcon from '../assets/icons/Search-Icon.svg';
import { colors } from '../theme/colors';
import { FilterIconButton } from './FilterIconButton';

type Variant = 'default' | 'onPrimary';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onFilterPress: () => void;
  filterActive?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  onSubmit?: () => void;
};

export function PortalSearchBar({
  value,
  onChangeText,
  placeholder,
  onFilterPress,
  filterActive = false,
  variant = 'default',
  style,
  onSubmit,
}: Props): React.JSX.Element {
  const onPrimary = variant === 'onPrimary';
  const hasQuery = value.trim().length > 0;

  return (
    <View
      style={[
        styles.shell,
        onPrimary ? styles.shellOnPrimary : null,
        hasQuery ? styles.shellActive : null,
        style,
      ]}
    >
      <SearchIcon width={18} height={18} accessibilityLabel="Search" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={onPrimary ? 'rgba(255,255,255,0.75)' : colors.textSecondary}
        style={[styles.input, onPrimary ? styles.inputOnPrimary : null]}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={placeholder}
        onSubmitEditing={onSubmit}
      />
      <FilterIconButton active={filterActive} onPress={onFilterPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    marginLeft: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  shellOnPrimary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shellActive: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  inputOnPrimary: {
    color: '#FFFFFF',
  },
});
