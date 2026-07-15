import { toastAlert } from '../../utils/toastAlert';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { env } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { authService, AuthApiError } from '../../services/api/authService';
import { sessionStorage } from '../../services/storage/sessionStorage';
import type { AppRootStackParamList } from '../../navigation/types';
import {
  AuthHero,
  LockIcon,
  MailIcon,
  PasswordVisibilityIcon,
  authStyles,
} from './authUi';

type AuthMode = 'signIn' | 'forgotPassword';

type LoginNav = NativeStackNavigationProp<AppRootStackParamList, 'Login'>;

export function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<LoginNav>();
  const route = useRoute<RouteProp<AppRootStackParamList, 'Login'>>();
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isForgotPassword = mode === 'forgotPassword';

  useEffect(() => {
    const loadRememberedEmail = async (): Promise<void> => {
      try {
        const savedEmail = await sessionStorage.getRememberedEmail();
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch {
        // Ignore storage read errors; user can still sign in manually.
      }
    };

    void loadRememberedEmail();
  }, []);

  useEffect(() => {
    const pending = route.params?.pendingVerificationEmail?.trim();
    if (pending) {
      setEmail(pending);
      setShowVerifyBanner(true);
      setMode('signIn');
    }
  }, [route.params?.pendingVerificationEmail]);

  const onResendVerification = async (): Promise<void> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toastAlert('Validation', 'Enter your email address first.');
      return;
    }

    try {
      setLoading(true);
      const message = await authService.resendVerification(trimmedEmail);
      toastAlert('Verification email', message);
    } catch (error) {
      toastAlert(
        'Request failed',
        error instanceof Error ? error.message : 'Unable to resend verification email.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onSignIn = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      toastAlert('Validation', 'Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);
      if (!rememberMe) {
        await sessionStorage.clearRememberedEmail();
      }
    } catch (error) {
      if (error instanceof AuthApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        setShowVerifyBanner(true);
        toastAlert('Verify your email', error.message, [
          { text: 'Resend email', onPress: () => onResendVerification().catch(() => undefined) },
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }
      toastAlert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async (): Promise<void> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toastAlert('Validation', 'Email is required.');
      return;
    }

    try {
      setLoading(true);
      const message = await authService.forgotPassword(trimmedEmail);
      toastAlert('Check your email', message, [
        {
          text: 'OK',
          onPress: () => setMode('signIn'),
        },
      ]);
    } catch (error) {
      toastAlert(
        'Request failed',
        error instanceof Error ? error.message : 'Unable to send reset email.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onPrimaryAction = (): void => {
    if (isForgotPassword) {
      onForgotPassword().catch(() => undefined);
      return;
    }
    onSignIn().catch(() => undefined);
  };

  const heroTitle = isForgotPassword ? 'Reset Password' : 'Welcome Back!';
  const heroSubtitle = isForgotPassword
    ? 'Enter your email and we will send\na password setup link.'
    : 'Sign in to manage your projects,\ninvoices and clients.';

  const primaryButtonLabel = loading
    ? isForgotPassword
      ? 'Sending…'
      : 'Signing in…'
    : isForgotPassword
      ? 'Send Reset Link'
      : 'Sign In';

  return (
    <SafeAreaView style={authStyles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2F8" />
      <KeyboardAvoidingView
        style={authStyles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={authStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHero title={heroTitle} subtitle={heroSubtitle} gradientId="loginHeroFadeIntoPanel" />

          <View style={authStyles.formCard}>
            {showVerifyBanner && !isForgotPassword ? (
              <View style={authStyles.verifyBanner}>
                <Text style={authStyles.verifyBannerText}>
                  We sent a verification link to your email. Open it, then sign in here.
                </Text>
                <Text
                  style={authStyles.verifyBannerLink}
                  onPress={() => onResendVerification().catch(() => undefined)}
                >
                  Resend verification email
                </Text>
              </View>
            ) : null}

            {isForgotPassword ? (
              <TouchableOpacity
                onPress={() => setMode('signIn')}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
              >
                <Text style={authStyles.backLink}>← Back to sign in</Text>
              </TouchableOpacity>
            ) : null}

            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>Email</Text>
              <View style={authStyles.inputContainer}>
                <MailIcon />
                <TextInput
                  style={authStyles.textInput}
                  placeholder="Enter your email"
                  placeholderTextColor="#B0B8C5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {!isForgotPassword ? (
              <View style={authStyles.fieldGroup}>
                <Text style={authStyles.fieldLabel}>Password</Text>
                <View style={authStyles.inputContainer}>
                  <LockIcon />
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#B0B8C5"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {!isForgotPassword ? (
              <View style={authStyles.rememberRow}>
                <TouchableOpacity
                  style={authStyles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[authStyles.checkbox, rememberMe && authStyles.checkboxChecked]}>
                    {rememberMe ? <Text style={authStyles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={authStyles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('forgotPassword')} disabled={loading}>
                  <Text style={authStyles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              style={[authStyles.primaryButton, loading && authStyles.primaryButtonDisabled]}
              activeOpacity={0.85}
              onPress={onPrimaryAction}
              disabled={loading}
            >
              <Text style={authStyles.primaryButtonText}>{primaryButtonLabel}</Text>
            </TouchableOpacity>

            {!env.useMockAuth ? (
              <Text style={authStyles.apiHintText} accessibilityLabel="API server">
                Connected to {env.apiOrigin}
              </Text>
            ) : null}

            {isForgotPassword ? (
              <View style={authStyles.footerRow}>
                <Text style={authStyles.footerPromptText}>Remember your password? </Text>
                <TouchableOpacity onPress={() => setMode('signIn')} disabled={loading}>
                  <Text style={authStyles.footerLinkText}>Sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={authStyles.footerRow}>
                <Text style={authStyles.footerPromptText}>Don&apos;t have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SignUp')}
                  disabled={loading}
                >
                  <Text style={authStyles.footerLinkText}>Sign up</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
