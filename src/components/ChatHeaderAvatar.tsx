import React, { useMemo } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { placeholderAvatarUri } from '../utils/chatAvatar';

type Props = {
  name: string;
  uri?: string | null;
  /** Default 32 — use 48 for conversation list rows. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Same avatar as ChatScreen header — photo URL or initials placeholder. */
export function ChatHeaderAvatar({ name, uri, size = 32, style }: Props): React.JSX.Element {
  const sourceUri = useMemo(() => {
    const trimmed = typeof uri === 'string' ? uri.trim() : '';
    return trimmed.length > 0 ? trimmed : placeholderAvatarUri(name);
  }, [uri, name]);

  const radius = size / 2;

  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }, style]}
      accessibilityLabel={`${name} profile photo`}
    >
      <Image source={{ uri: sourceUri }} style={styles.avatarImage} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E6EEF9',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
