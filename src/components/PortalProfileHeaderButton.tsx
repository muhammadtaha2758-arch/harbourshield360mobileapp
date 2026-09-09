import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { navigateToProfileTab } from '../navigation/navigateToProfileTab';
import type { UserProfile } from '../types/auth';
import { colors } from '../theme/colors';
import { UserAvatar } from './UserAvatar';

type Props = {
  style?: StyleProp<ViewStyle>;
  showChevron?: boolean;
  /** When true, shows first token of the name (default). */
  useFirstNameOnly?: boolean;
  displayName?: string;
};

export function getProfileHeaderDisplayName(
  user: UserProfile | null | undefined,
  firstNameOnly = true,
): string {
  const fullName =
    user?.name?.trim() ||
    [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() ||
    user?.username?.trim() ||
    '';

  if (!fullName) {
    const email = user?.email?.trim();
    if (email) {
      return email.split('@')[0] || 'Account';
    }
    return 'Account';
  }

  if (!firstNameOnly) {
    return fullName;
  }

  const first = fullName.split(/\s+/)[0];
  return first || fullName;
}

export function PortalProfileHeaderButton({
  style,
  showChevron = true,
  useFirstNameOnly = true,
  displayName: displayNameOverride,
}: Props): React.JSX.Element {
  const { user } = useAuth();
  const navigation = useNavigation();

  const displayName = useMemo(() => {
    if (displayNameOverride?.trim()) {
      return displayNameOverride.trim();
    }
    return getProfileHeaderDisplayName(user, useFirstNameOnly);
  }, [displayNameOverride, user, useFirstNameOnly]);

  const onPress = useCallback(() => {
    navigateToProfileTab(navigation);
  }, [navigation]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, open profile`}
      onPress={onPress}
      style={({ pressed }) => [styles.profilePill, pressed && styles.dim, style]}
    >
      <UserAvatar
        avatar={user?.avatar}
        avatarUrl={user?.avatar_url}
        size={36}
        radius={14}
      />
      <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
        {displayName}
      </Text>
      {showChevron ? <Text style={styles.chevron}>▾</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    maxWidth: '72%',
  },
  dim: { opacity: 0.85 },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginLeft: 10,
    flexShrink: 1,
  },
  chevron: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 6,
  },
});
