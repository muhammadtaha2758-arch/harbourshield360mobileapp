import { toastAlert } from '../../utils/toastAlert';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { env } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import type { AppRootStackParamList } from '../../navigation/types';
import {
  AuthHero,
  LockIcon,
  MailIcon,
  PasswordVisibilityIcon,
  authStyles,
} from './authUi';

type SignUpNav = NativeStackNavigationProp<AppRootStackParamList, 'SignUp'>;

export function SignUpScreen(): React.JSX.Element {
  const navigation = useNavigation<SignUpNav>();
  const { register } = useAuth();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignUp = async (): Promise<void> => {
    const trimmedFirst = firstname.trim();
    const trimmedLast = lastname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password.trim()) {
      toastAlert('Validation', 'First name, last name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      toastAlert('Validation', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toastAlert('Validation', 'Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const result = await register({
        firstname: trimmedFirst,
        lastname: trimmedLast,
        email: trimmedEmail,
        password,
        password_confirmation: confirmPassword,
        phone: phone.trim() || undefined,
      });

      toastAlert('Check your email', result.message, [
        {
          text: 'Go to sign in',
          onPress: () => {
            navigation.navigate('Login', { pendingVerificationEmail: result.email });
          },
        },
      ]);
    } catch (error) {
      toastAlert('Sign up failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <AuthHero
            title="Create Account"
            subtitle={'Sign up to track your project\nand stay connected.'}
            gradientId="signUpHeroFadeIntoPanel"
          />

          <View style={authStyles.formCard}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text style={authStyles.backLink}>← Back to sign in</Text>
            </TouchableOpacity>

            <View style={authStyles.nameRow}>
              <View style={[authStyles.fieldGroup, authStyles.nameField]}>
                <Text style={authStyles.fieldLabel}>First name</Text>
                <View style={authStyles.inputContainer}>
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="First name"
                    placeholderTextColor="#B0B8C5"
                    value={firstname}
                    onChangeText={setFirstname}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <View style={[authStyles.fieldGroup, authStyles.nameField]}>
                <Text style={authStyles.fieldLabel}>Last name</Text>
                <View style={authStyles.inputContainer}>
                  <TextInput
                    style={authStyles.textInput}
                    placeholder="Last name"
                    placeholderTextColor="#B0B8C5"
                    value={lastname}
                    onChangeText={setLastname}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>Phone (optional)</Text>
              <View style={authStyles.inputContainer}>
                <TextInput
                  style={authStyles.textInput}
                  placeholder="Phone number"
                  placeholderTextColor="#B0B8C5"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </View>
            </View>

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

            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>Password</Text>
              <View style={authStyles.inputContainer}>
                <LockIcon />
                <TextInput
                  style={authStyles.textInput}
                  placeholder="Create a password (min. 8 characters)"
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

            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>Confirm password</Text>
              <View style={authStyles.inputContainer}>
                <LockIcon />
                <TextInput
                  style={authStyles.textInput}
                  placeholder="Confirm your password"
                  placeholderTextColor="#B0B8C5"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <PasswordVisibilityIcon visible={showConfirmPassword} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[authStyles.primaryButton, loading && authStyles.primaryButtonDisabled]}
              activeOpacity={0.85}
              onPress={() => {
                onSignUp().catch(() => undefined);
              }}
              disabled={loading}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? 'Creating account…' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            {!env.useMockAuth ? (
              <Text style={authStyles.apiHintText} accessibilityLabel="API server">
                Connected to {env.apiOrigin}
              </Text>
            ) : null}

            <View style={authStyles.footerRow}>
              <Text style={authStyles.footerPromptText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
                <Text style={authStyles.footerLinkText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
