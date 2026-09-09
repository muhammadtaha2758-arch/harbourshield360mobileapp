import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { resolveUserAvatarUrl } from '../utils/userAvatar';

type Props = {
  uri?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  fallbackVariant?: 'default' | 'light';
};

function PersonOutlineGlyph({ light }: { light: boolean }): React.JSX.Element {
  const stroke = light ? '#FFFFFF' : colors.primaryDark;
  return (
    <View style={styles.personGlyph}>
      <View style={[styles.personHeadRing, { borderColor: stroke }]} />
      <View style={[styles.personShoulders, { borderColor: stroke }]} />
    </View>
  );
}

export function UserAvatar({
  uri,
  avatar,
  avatarUrl,
  size = 36,
  radius,
  style,
  fallbackVariant = 'default',
}: Props): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const resolved = useMemo(() => {
    if (typeof uri === 'string' && uri.trim()) {
      return uri.trim();
    }
    return resolveUserAvatarUrl({ avatar, avatar_url: avatarUrl });
  }, [avatar, avatarUrl, uri]);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const showImage = Boolean(resolved) && !failed;
  const borderRadius = radius ?? Math.round(size * 0.4);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: fallbackVariant === 'light' ? 'rgba(255,255,255,0.18)' : colors.avatarSoftFill,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: resolved as string }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <PersonOutlineGlyph light={fallbackVariant === 'light'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  personGlyph: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 22,
    paddingTop: 2,
  },
  personHeadRing: {
    width: 9,
    height: 9,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  personShoulders: {
    marginTop: 1,
    width: 14,
    height: 7,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1.5,
    borderTopWidth: 0,
  },
});
