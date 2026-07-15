import { toastAlert } from '../utils/toastAlert';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService, type RegisterPayload, type RegisterResult } from '../services/api/authService';
import { loadMobileConfig } from '../services/api/configService';
import { customerService } from '../services/api/customerService';
import { env } from '../config/env';
import { setAuthToken } from '../services/api/httpClient';
import { sessionStorage } from '../services/storage/sessionStorage';
import { AuthState, UserProfile } from '../types/auth';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isInitializing: true,
  });

  const refreshUserData = useCallback(async (showError = false): Promise<UserProfile | null> => {
    try {
      const user = await customerService.getProfile();
      setState(prev => ({ ...prev, user }));
      return user;
    } catch (error) {
      if (showError) {
        toastAlert('Error', error instanceof Error ? error.message : 'Unable to load profile.');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      await loadMobileConfig();

      const token = await sessionStorage.getToken();
      setAuthToken(token);

      if (token) {
        if (env.useMockAuth) {
          setState(prev => ({
            ...prev,
            token,
            user: { name: 'Mobile User', email: 'mobile@harborshield360.local' },
            isInitializing: false,
          }));
          return;
        }

        const user = await refreshUserData(false);
        setState(prev => ({
          ...prev,
          token,
          user: user || null,
          isInitializing: false,
        }));
        return;
      }

      setState(prev => ({ ...prev, isInitializing: false }));
    };

    initialize().catch(() => {
      setState(prev => ({ ...prev, isInitializing: false }));
    });
  }, [refreshUserData]);

  const establishSession = useCallback(
    async (token: string, loginUser: UserProfile | null, rememberedEmail?: string): Promise<void> => {
      await sessionStorage.setToken(token);
      setAuthToken(token);

      let user = loginUser;
      if (!user) {
        user = await refreshUserData(false);
      }

      setState({
        token,
        user: user || null,
        isInitializing: false,
      });

      if (rememberedEmail) {
        await sessionStorage.setRememberedEmail(rememberedEmail);
      }
    },
    [refreshUserData],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (env.useMockAuth) {
        const mockToken = `mock-token-${Date.now()}`;
        const mockUser: UserProfile = {
          name: email.split('@')[0] || 'Mobile User',
          email,
        };

        await sessionStorage.setToken(mockToken);
        setAuthToken(mockToken);
        setState({
          token: mockToken,
          user: mockUser,
          isInitializing: false,
        });
        await sessionStorage.setRememberedEmail(email.trim());
        return;
      }

      await loadMobileConfig();

      const { token, user: loginUser } = await authService.login({ email, password });
      await establishSession(token, loginUser, email.trim());
    },
    [establishSession],
  );

  const register = useCallback(async (payload: RegisterPayload): Promise<RegisterResult> => {
    if (env.useMockAuth) {
      return {
        requiresEmailVerification: true,
        email: payload.email.trim(),
        message: 'Mock mode: verify your email, then sign in.',
      };
    }

    await loadMobileConfig();
    return authService.register(payload);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (!env.useMockAuth) {
      await authService.logout();
    }
    await sessionStorage.clearToken();
    setAuthToken(null);
    setState({
      token: null,
      user: null,
      isInitializing: false,
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    await refreshUserData(true);
  }, [refreshUserData]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      refreshUser,
    }),
    [login, register, logout, refreshUser, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
};
