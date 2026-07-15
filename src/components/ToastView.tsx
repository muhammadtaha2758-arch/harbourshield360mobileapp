import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import type { ToastAction, ToastItem, ToastType } from '../utils/toast';

type Props = {
  item: ToastItem;
  onDismiss: (id: string) => void;
};

const TYPE_STYLES: Record<
  ToastType,
  { accent: string; iconBg: string; iconColor: string; glyph: string }
> = {
  success: {
    accent: colors.success,
    iconBg: '#E8F5EE',
    iconColor: colors.success,
    glyph: '✓',
  },
  error: {
    accent: colors.danger,
    iconBg: '#FDECEE',
    iconColor: colors.danger,
    glyph: '!',
  },
  warning: {
    accent: '#D97706',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
    glyph: '!',
  },
  info: {
    accent: colors.primary,
    iconBg: colors.avatarSoftFill,
    iconColor: colors.primaryDark,
    glyph: 'i',
  },
};

export function ToastView({ item, onDismiss }: Props): React.JSX.Element {
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const typeStyle = TYPE_STYLES[item.type ?? 'info'];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const dismiss = (): void => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDismiss(item.id);
      }
    });
  };

  useEffect(() => {
    const hasActions = (item.actions?.length ?? 0) > 0;
    const duration = item.duration ?? (hasActions ? 8000 : item.message.length > 90 ? 5000 : 3600);
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [item.actions?.length, item.duration, item.id, item.message.length]);

  return (
    <Animated.View
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.card, { borderLeftColor: typeStyle.accent }]}>
        <View style={[styles.iconCircle, { backgroundColor: typeStyle.iconBg }]}>
          <Text style={[styles.iconGlyph, { color: typeStyle.iconColor }]}>{typeStyle.glyph}</Text>
        </View>

        <View style={styles.body}>
          {item.title ? (
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}
          <Text style={styles.message} numberOfLines={4}>
            {item.message}
          </Text>

          {item.actions && item.actions.length > 0 ? (
            <View style={styles.actions}>
              {item.actions.map((action) => (
                <ToastActionButton key={action.label} action={action} onDone={dismiss} />
              ))}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function ToastActionButton({
  action,
  onDone,
}: {
  action: ToastAction;
  onDone: () => void;
}): React.JSX.Element {
  const isPrimary = action.variant !== 'secondary';

  return (
    <Pressable
      onPress={() => {
        action.onPress?.();
        onDone();
      }}
      style={({ pressed }) => [
        styles.actionBtn,
        isPrimary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        pressed && styles.actionBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <Text style={[styles.actionText, isPrimary ? styles.actionTextPrimary : styles.actionTextSecondary]}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  iconGlyph: {
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: '#EEF2F8',
  },
  actionBtnPressed: {
    opacity: 0.88,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextPrimary: {
    color: '#FFFFFF',
  },
  actionTextSecondary: {
    color: colors.primaryDark,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  closeBtnPressed: {
    backgroundColor: '#F1F5F9',
  },
  closeGlyph: {
    fontSize: 20,
    lineHeight: 22,
    color: '#94A3B8',
    fontWeight: '300',
  },
});
