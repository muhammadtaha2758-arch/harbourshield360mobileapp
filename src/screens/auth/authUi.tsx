import React from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export const AUTH_BLUE = '#1A3FD8';
export const AUTH_LIGHT_BLUE = '#EEF2F8';

export const AUTH_HERO_IMAGE_URI =
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&w=1400&h=900&fit=crop&q=85';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const AUTH_HERO_ROW_MIN_HEIGHT = Math.min(SCREEN_HEIGHT * 0.34, 268);

const INPUT_FIELD_ICON_COLOR = '#6B7280';

export function MailIcon(): React.JSX.Element {
  const c = INPUT_FIELD_ICON_COLOR;
  return (
    <View style={authStyles.iconWrapper}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 6.5C4 5.67 4.67 5 5.5 5h13c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z"
          stroke={c}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <Path
          d="M4 7l8 5 8-5"
          stroke={c}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export function LockIcon(): React.JSX.Element {
  const c = INPUT_FIELD_ICON_COLOR;
  return (
    <View style={authStyles.iconWrapper}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Rect x={5} y={11} width={14} height={10} rx={2} stroke={c} strokeWidth={1.75} />
        <Path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          stroke={c}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export function PasswordVisibilityIcon({ visible }: { visible: boolean }): React.JSX.Element {
  const c = INPUT_FIELD_ICON_COLOR;
  return (
    <View style={authStyles.eyeIconSlot}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        {visible ? (
          <>
            <Path
              d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
              stroke={c}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
              stroke={c}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <Path
            d="M1 1l22 22M17.9 17.9A10.5 10.5 0 0 1 12 19C5 19 1 12 1 12a18.3 18.3 0 0 1 5.1-6.3M9.9 4.2A10.5 10.5 0 0 1 12 5c7 0 11 7 11 7a18.3 18.3 0 0 1-2.1 3.1M14.1 14.1A3 3 0 0 1 9.9 9.9"
            stroke={c}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}

type AuthHeroProps = {
  title: string;
  subtitle: string;
  gradientId: string;
};

export function AuthHero({ title, subtitle, gradientId }: AuthHeroProps): React.JSX.Element {
  return (
    <View style={authStyles.heroSection}>
      <View style={authStyles.heroRow}>
        <View style={authStyles.heroLeft}>
          <View style={authStyles.appIconContainer}>
            <Image
              source={require('../../assets/images/harbour-logo.png')}
              style={authStyles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="Harbour Shield logo"
            />
          </View>
          <View style={authStyles.welcomeTextContainer}>
            <Text
              style={authStyles.welcomeTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {title}
            </Text>
            <Text
              style={authStyles.welcomeSubtitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {subtitle}
            </Text>
          </View>
        </View>
        <View style={authStyles.heroRight} pointerEvents="none">
          <ImageBackground
            source={{ uri: AUTH_HERO_IMAGE_URI }}
            style={authStyles.heroRightImage}
            resizeMode="cover"
          >
            <View style={authStyles.heroImageWash} />
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                  gradientUnits="objectBoundingBox"
                >
                  <Stop offset="0" stopColor={AUTH_LIGHT_BLUE} stopOpacity="1" />
                  <Stop offset="0.2" stopColor={AUTH_LIGHT_BLUE} stopOpacity="0.78" />
                  <Stop offset="0.45" stopColor={AUTH_LIGHT_BLUE} stopOpacity="0.22" />
                  <Stop offset="0.75" stopColor={AUTH_LIGHT_BLUE} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
          </ImageBackground>
        </View>
      </View>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_LIGHT_BLUE,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    backgroundColor: AUTH_LIGHT_BLUE,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: AUTH_HERO_ROW_MIN_HEIGHT,
  },
  heroLeft: {
    flexBasis: '50%',
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 360,
    backgroundColor: AUTH_LIGHT_BLUE,
    justifyContent: 'center',
    paddingLeft: 24,
    paddingRight: 10,
    paddingVertical: 16,
  },
  heroRight: {
    flex: 1,
    minWidth: 0,
    backgroundColor: AUTH_LIGHT_BLUE,
  },
  heroRightImage: {
    flex: 1,
    width: '100%',
    minHeight: AUTH_HERO_ROW_MIN_HEIGHT,
  },
  heroImageWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(230, 240, 252, 0.42)',
  },
  appIconContainer: {
    marginBottom: 14,
  },
  brandLogo: {
    width: 72,
    height: 72,
  },
  welcomeTextContainer: {
    marginTop: 0,
    width: '100%',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B2545',
    letterSpacing: -0.5,
    marginBottom: 8,
    width: '100%',
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#5C6570',
    lineHeight: 22,
    width: '100%',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
    flex: 1,
  },
  backRow: {
    marginBottom: 16,
  },
  backLink: {
    fontSize: 14,
    color: AUTH_BLUE,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  iconWrapper: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  eyeIconSlot: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: AUTH_BLUE,
    borderColor: AUTH_BLUE,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#374151',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: AUTH_BLUE,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: AUTH_BLUE,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  apiHintText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  footerPromptText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerLinkText: {
    fontSize: 14,
    color: AUTH_BLUE,
    fontWeight: '700',
  },
  verifyBanner: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  verifyBannerText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  verifyBannerLink: {
    marginTop: 8,
    fontSize: 13,
    color: AUTH_BLUE,
    fontWeight: '700',
  },
});
