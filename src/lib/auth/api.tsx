import { Env } from '@env';
import axios, { AxiosError } from 'axios';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import queryString from 'query-string';

import { logger } from '@/lib/logging';

import { getItem, removeItem, setItem } from '../storage';
import { getBaseApiUrl } from '../storage/app';
import type { AuthResponse, LoginCredentials, LoginResponse } from './types';

// Strip any query string from a URL so tokens/credentials in params are never logged.
const sanitizeUrl = (url?: string): string | undefined => url?.split('?')[0];

// Extract only non-sensitive fields from an axios error. Never log error.config,
// config.data or response bodies for the token endpoints - they contain credentials.
const sanitizeAuthError = (error: unknown): Record<string, unknown> => {
  if (error instanceof AxiosError) {
    return {
      message: error.message,
      status: error.response?.status,
      url: sanitizeUrl(error.config?.url),
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
};

const PASSWORD_VERIFICATION_HASH_KEY = 'PASSWORD_VERIFICATION_HASH';
const PASSWORD_VERIFICATION_SALT_KEY = 'PASSWORD_VERIFICATION_SALT';

// Store a salted SHA-256 hash of the password after a successful password-grant
// login so the lockscreen can verify the password offline. This is a verification
// cache only - the password itself is never stored.
export const storePasswordVerificationHash = async (password: string): Promise<void> => {
  try {
    let salt = getItem<string>(PASSWORD_VERIFICATION_SALT_KEY);
    if (!salt) {
      salt = randomUUID();
      await setItem(PASSWORD_VERIFICATION_SALT_KEY, salt);
    }

    const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
    await setItem(PASSWORD_VERIFICATION_HASH_KEY, hash);
  } catch (error) {
    logger.error({
      message: 'Failed to store password verification hash',
      context: { message: error instanceof Error ? error.message : String(error) },
    });
  }
};

// Verify a password against the stored salted hash. Returns null when no hash is
// stored (e.g. SSO/OIDC login), true on match and false on mismatch.
export const verifyPassword = async (password: string): Promise<boolean | null> => {
  try {
    const salt = getItem<string>(PASSWORD_VERIFICATION_SALT_KEY);
    const storedHash = getItem<string>(PASSWORD_VERIFICATION_HASH_KEY);

    if (!salt || !storedHash) {
      return null;
    }

    const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
    return hash === storedHash;
  } catch (error) {
    logger.error({
      message: 'Failed to verify password',
      context: { message: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
};

export const clearPasswordVerificationHash = async (): Promise<void> => {
  await removeItem(PASSWORD_VERIFICATION_HASH_KEY);
  await removeItem(PASSWORD_VERIFICATION_SALT_KEY);
};

const authApi = axios.create({
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Add request interceptor to dynamically set baseURL
authApi.interceptors.request.use((config) => {
  config.baseURL = getBaseApiUrl();
  logger.info({
    message: 'Auth API request interceptor',
    context: { baseURL: config.baseURL, url: sanitizeUrl(config.url) },
  });
  return config;
});

export const loginRequest = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      // Accounts with Resgrid 2FA enabled must supply the current authenticator code.
      ...(credentials.otpCode ? { totp_code: credentials.otpCode.trim() } : {}),
      scope: Env.IS_MOBILE_APP ? 'openid profile offline_access mobile' : 'openid profile offline_access',
    });

    logger.info({
      message: 'API: Sending login request',
      context: { username: credentials.username, baseURL: authApi.defaults.baseURL },
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    logger.info({
      message: 'API: Received response',
      context: { status: response.status, hasData: !!response.data },
    });

    if (response.status === 200) {
      logger.info({
        message: 'Login successful',
        context: { username: credentials.username },
      });

      return {
        successful: true,
        message: 'Login successful',
        authResponse: response.data,
      };
    } else {
      logger.error({
        message: 'Login failed',
        context: { status: response.status, username: credentials.username },
      });

      return {
        successful: false,
        message: 'Login failed',
        authResponse: null,
      };
    }
  } catch (error) {
    // The OAuth error body distinguishes the 2FA challenge from a bad password. Neither the
    // password nor any code is ever logged.
    const oauthError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (oauthError === 'mfa_required' || oauthError === 'invalid_totp') {
      logger.info({
        message: 'Login requires two-factor code',
        context: { invalidOtp: oauthError === 'invalid_totp' },
      });

      return {
        successful: false,
        message: 'Two-factor authentication required',
        authResponse: null,
        mfaRequired: true,
        invalidOtp: oauthError === 'invalid_totp',
      };
    }

    logger.error({
      message: 'Login API call failed with exception',
      context: { ...sanitizeAuthError(error), username: credentials.username },
    });

    // Return a failed response instead of throwing
    return {
      successful: false,
      message: error instanceof Error ? error.message : 'Login failed',
      authResponse: null,
    };
  }
};

// Last SSO exchange that failed with a 2FA challenge, retained IN MEMORY ONLY so the OTP
// prompt can retry the same IdP token with a code. Cleared on success and on any final failure.
let pendingSsoMfaExchange: { provider: 'oidc' | 'saml2'; externalToken: string; username: string; departmentId?: number } | null = null;

export const externalTokenRequest = async (provider: 'oidc' | 'saml2', externalToken: string, username: string, departmentId?: number, otpCode?: string): Promise<LoginResponse> => {
  const requestId = randomUUID();
  try {
    const data: Record<string, string> = {
      provider,
      external_token: externalToken,
      username,
      scope: Env.IS_MOBILE_APP ? 'openid profile offline_access mobile' : 'openid profile offline_access',
    };

    if (departmentId) {
      data.department_id = String(departmentId);
    }

    // Accounts with Resgrid 2FA enabled must supply the current authenticator code even via SSO.
    if (otpCode) {
      data.totp_code = otpCode.trim();
    }

    logger.info({
      message: 'API: Sending SSO external token request',
      context: { provider, requestId },
    });

    const response = await authApi.post<AuthResponse>('/connect/external-token', queryString.stringify(data));

    if (response.status === 200) {
      logger.info({ message: 'SSO: External token exchange successful', context: { requestId } });
      pendingSsoMfaExchange = null;
      return { successful: true, message: 'SSO login successful', authResponse: response.data };
    }

    return { successful: false, message: 'SSO login failed', authResponse: null };
  } catch (error) {
    // The error body distinguishes the 2FA challenge from a real failure. Neither the IdP
    // token nor any code is ever logged.
    const oauthError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (oauthError === 'mfa_required' || oauthError === 'invalid_totp') {
      logger.info({
        message: 'SSO login requires two-factor code',
        context: { requestId, invalidOtp: oauthError === 'invalid_totp' },
      });

      pendingSsoMfaExchange = { provider, externalToken, username, departmentId };
      return {
        successful: false,
        message: 'Two-factor authentication required',
        authResponse: null,
        mfaRequired: true,
        invalidOtp: oauthError === 'invalid_totp',
      };
    }

    pendingSsoMfaExchange = null;
    logger.error({ message: 'SSO: External token request failed', context: { ...sanitizeAuthError(error), requestId } });
    return {
      successful: false,
      message: error instanceof Error ? error.message : 'SSO login failed',
      authResponse: null,
    };
  }
};

/** Retries the pending SSO exchange with the user's authenticator code (2FA challenge). */
export const retrySsoExchangeWithOtp = async (otpCode: string): Promise<LoginResponse> => {
  if (!pendingSsoMfaExchange) {
    return { successful: false, message: 'No pending SSO sign-in to verify', authResponse: null };
  }

  const { provider, externalToken, username, departmentId } = pendingSsoMfaExchange;
  return externalTokenRequest(provider, externalToken, username, departmentId, otpCode);
};

export const refreshTokenRequest = async (refreshToken: string): Promise<AuthResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: '',
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    logger.info({
      message: 'Token refresh successful',
    });

    return response.data;
  } catch (error) {
    // performTokenRefresh owns the verdict on this failure - an expired refresh token is a
    // normal end of session, a network outage is not. Record the sanitized transport detail
    // here as a breadcrumb so the same failure is not reported twice.
    logger.warn({
      message: 'Token refresh request failed',
      context: sanitizeAuthError(error),
    });
    throw error;
  }
};
