import { AxiosError } from 'axios';
import { env } from '../../config/env';
import { mapMobileApiUserToProfile, MobileApiUser, UserProfile } from '../../types/auth';
import { httpClient } from './httpClient';

interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}

interface ApiErrorBody {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  error?: { code?: string };
}

export class AuthApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
  }
}

interface MobileAuthResponse {
  success?: boolean;
  message?: string;
  data?: {
    token?: string;
    token_type?: string;
    token_expires_at?: string | null;
    user?: MobileApiUser;
  };
}

export interface LoginResult {
  token: string;
  user: UserProfile | null;
  tokenExpiresAt?: string | null;
}

export interface RegisterResult {
  requiresEmailVerification: boolean;
  email: string;
  message: string;
}

function parseApiError(error: unknown, fallback: string): AuthApiError {
  const axiosError = error as AxiosError<ApiErrorBody>;
  const data = axiosError.response?.data;
  const firstValidation =
    data?.errors != null
      ? (Object.values(data.errors).flat().find(m => Boolean(m)) as string | undefined)
      : undefined;

  return new AuthApiError(
    data?.message || firstValidation || axiosError.message || fallback,
    data?.error?.code,
  );
}

function parseAuthResponse(body: MobileAuthResponse, fallback: string): LoginResult {
  if (body.success === false) {
    throw new Error(body.message || fallback);
  }

  const token = body.data?.token;
  if (!token) {
    throw new Error('Token not found in response.');
  }

  const user = body.data?.user ? mapMobileApiUserToProfile(body.data.user) : null;

  return {
    token,
    user,
    tokenExpiresAt: body.data?.token_expires_at ?? null,
  };
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResult> {
    try {
      const response = await httpClient.post<MobileAuthResponse>(
        env.mobileAuth.login,
        payload,
      );
      return parseAuthResponse(response.data, 'Unable to login. Please try again.');
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      throw parseApiError(error, 'Unable to login. Please try again.');
    }
  },

  async register(payload: RegisterPayload): Promise<RegisterResult> {
    try {
      const response = await httpClient.post<{
        success?: boolean;
        message?: string;
        data?: {
          requires_email_verification?: boolean;
          email?: string;
        };
      }>(env.mobileAuth.register, payload);

      const body = response.data;
      if (body.success === false) {
        throw new Error(body.message || 'Unable to create account. Please try again.');
      }

      return {
        requiresEmailVerification: body.data?.requires_email_verification === true,
        email: String(body.data?.email ?? payload.email).trim(),
        message:
          body.message ||
          'Registration successful. Please check your email to verify your account before signing in.',
      };
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      throw parseApiError(error, 'Unable to create account. Please try again.');
    }
  },

  async resendVerification(email: string): Promise<string> {
    try {
      const response = await httpClient.post<{ success?: boolean; message?: string }>(
        env.mobileAuth.resendVerification,
        { email },
      );
      const body = response.data;
      if (body.success === false) {
        throw new Error(body.message || 'Unable to resend verification email.');
      }
      return body.message || 'If that email is registered and not yet verified, a new verification link has been sent.';
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      throw parseApiError(error, 'Unable to resend verification email.');
    }
  },

  async forgotPassword(email: string): Promise<string> {
    const fallback =
      'If that email is registered, a password setup link has been sent.';
    try {
      const response = await httpClient.post<{ success?: boolean; message?: string }>(
        env.mobileAuth.forgotPassword,
        { email },
      );
      const body = response.data;
      if (body.success === false) {
        throw new Error(body.message || 'Unable to send reset email.');
      }
      return body.message || fallback;
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorBody>;
      if (axiosError.response?.status === 200) {
        return axiosError.response.data?.message || fallback;
      }
      if (error instanceof Error && !axiosError.isAxiosError) {
        throw error;
      }
      // Do not surface raw SMTP/server errors to the user.
      const raw = axiosError.response?.data?.message || '';
      if (/sendasdenied|554|smtp|mail/i.test(raw)) {
        throw new Error(
          'We could not send the email right now. Please try again later or contact support.',
        );
      }
      throw parseApiError(error, 'Unable to send reset email. Please try again.');
    }
  },

  async logout(): Promise<void> {
    try {
      await httpClient.post(env.mobileAuth.logout);
    } catch {
      // Local session is cleared regardless of network errors.
    }
  },
};
