import { Env } from '@env';
import axios, { AxiosError } from 'axios';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import queryString from 'query-string';

import { logger } from '@/lib/logging';
import { applyClientHeaders } from '@/lib/mfa/client-app';
import { type MfaChallenge, parseMethods } from '@/lib/mfa/types';

import { getItem, removeItem, setItem } from '../storage';
import { getBaseApiUrl } from '../storage/app';
import type { AuthResponse, LoginCredentials, LoginResponse } from './types';

// Strip any query string from a URL so tokens/credentials in params are never logged.
const sanitizeUrl = (url?: string): string | undefined => url?.split('?')[0];

// Extract only non-sensitive fields from an axios error. Never log error.config,
// config.data or response bodies for the token endpoints - they contain credentials.
const sanitizeAuthError = (error: unknown): Record<string, unknown> => {
  if (error instanceof AxiosError) {
    // Keep only known OAuth diagnostics. Arbitrary response text can contain secrets;
    // OpenIddict's documentation ID identifies its validation error without that text.
    const data = error.response?.data;
    const oauthErrors = ['invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client', 'unsupported_grant_type', 'invalid_scope', 'server_error', 'temporarily_unavailable'];
    const oauthError = typeof data?.error === 'string' && oauthErrors.includes(data.error) ? data.error : undefined;
    const oauthErrorId = typeof data?.error_uri === 'string' ? /^https:\/\/documentation\.openiddict\.com\/errors\/(ID\d+)\/?$/.exec(data.error_uri)?.[1] : undefined;
    const knownDescriptions: Record<string, string> = {
      'The refresh token is no longer valid.': 'refresh_token_no_longer_valid',
      'The user is no longer allowed to sign in.': 'user_sign_in_not_allowed',
    };
    const rejectionReason = typeof data?.error_description === 'string' && Object.hasOwn(knownDescriptions, data.error_description) ? knownDescriptions[data.error_description] : undefined;
    return {
      message: error.message,
      status: error.response?.status,
      url: sanitizeUrl(error.config?.url),
      ...(oauthError ? { oauthError } : {}),
      ...(oauthErrorId ? { oauthErrorId } : {}),
      ...(rejectionReason ? { rejectionReason } : {}),
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
};

const PASSWORD_VERIFICATION_HASH_KEY = 'PASSWORD_VERIFICATION_HASH';
const PASSWORD_VERIFICATION_SALT_KEY = 'PASSWORD_VERIFICATION_SALT';

/** A salted SHA-256 of the password for the personal lockscreen; never the password itself. */
export interface PasswordVerification {
  salt: string;
  hash: string;
}

/**
 * Computes the lockscreen verifier without storing it, so a sign-in still waiting for its second factor can hold it in
 * memory (never the password) and store it only once the sign-in finishes.
 */
export const computePasswordVerification = async (password: string): Promise<PasswordVerification | null> => {
  try {
    const salt = getItem<string>(PASSWORD_VERIFICATION_SALT_KEY) ?? randomUUID();
    const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
    return { salt, hash };
  } catch (error) {
    logger.error({
      message: 'Failed to compute password verification hash',
      context: { message: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
};

export const savePasswordVerification = async (verification: PasswordVerification): Promise<void> => {
  await setItem(PASSWORD_VERIFICATION_SALT_KEY, verification.salt);
  await setItem(PASSWORD_VERIFICATION_HASH_KEY, verification.hash);
};

// Store a salted SHA-256 hash of the password after a successful password-grant
// login so the lockscreen can verify the password offline. This is a verification
// cache only - the password itself is never stored.
export const storePasswordVerificationHash = async (password: string): Promise<void> => {
  try {
    const verification = await computePasswordVerification(password);
    if (verification) {
      await savePasswordVerification(verification);
    }
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
  // The app and installation headers bind a sign-in transaction and the session it creates to this app, and mark a shared
  // dispatch workstation (passkey plan sections 10.4 and 10.5).
  applyClientHeaders(config.headers);
  logger.info({
    message: 'Auth API request interceptor',
    context: { baseURL: config.baseURL, url: sanitizeUrl(config.url) },
  });
  return config;
});

interface OAuthErrorBody {
  error?: string;
  mfa_transaction?: string;
  mfa_setup_transaction?: string;
  mfa_methods?: string;
  mfa_enrolled?: string;
  mfa_preferred?: string;
  mfa_expires_in?: number;
}

const oauthErrorBody = (error: unknown): OAuthErrorBody => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  return typeof data === 'object' && data !== null ? (data as OAuthErrorBody) : {};
};

/** The login transaction the token endpoint started, when it started one (transaction flow on, passkey workbook section 7.1). */
export const loginTransactionFrom = (body: OAuthErrorBody, source: MfaChallenge['source']): LoginResponse['mfaTransaction'] | undefined => {
  const expiresAt = typeof body.mfa_expires_in === 'number' ? Date.now() + body.mfa_expires_in * 1000 : null;
  if (body.error === 'mfa_required' && body.mfa_transaction) {
    const methods = parseMethods(body.mfa_methods);
    const enrolled = parseMethods(body.mfa_enrolled);
    const preferred = parseMethods(body.mfa_preferred)[0] ?? null;
    return { secret: body.mfa_transaction, challenge: { kind: 'verify', methods, enrolled, preferred, expiresAt, source } };
  }
  if (body.error === 'mfa_enrollment_required' && body.mfa_setup_transaction) {
    return { secret: body.mfa_setup_transaction, challenge: { kind: 'setup', methods: ['totp'], enrolled: [], preferred: 'totp', expiresAt, source } };
  }
  return undefined;
};

export const loginRequest = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      // A second factor continues on a login transaction; a server without one answers the older way (a code resent
      // with the password), which the totp_code below still serves.
      ...(credentials.otpCode ? { totp_code: credentials.otpCode.trim() } : { mfa_flow: 'transaction' }),
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
    // password, the transaction nor any code is ever logged.
    const body = oauthErrorBody(error);
    const mfaTransaction = loginTransactionFrom(body, 'password');
    if (mfaTransaction) {
      logger.info({
        message: 'Login continues on a second-factor transaction',
        context: { kind: mfaTransaction.challenge.kind, methods: mfaTransaction.challenge.methods },
      });
      return { successful: false, message: 'Additional verification is required', authResponse: null, mfaRequired: true, mfaTransaction };
    }
    if (body.error === 'mfa_enrollment_required') {
      return { successful: false, message: 'mfa_enrollment_required', authResponse: null, enrollmentRequired: true };
    }

    const oauthError = body.error;
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

/**
 * Exchanges a finished login transaction for tokens (passkey workbook section 7.1): the completion code is single-use,
 * bound to this transaction and app, and lives about a minute. A lost response means signing in again. This request
 * creates the session, so it carries the shared-installation and device headers too (the interceptor adds them).
 */
export const completionGrantRequest = async (transaction: string, completionCode: string): Promise<AuthResponse> => {
  const data = queryString.stringify({
    grant_type: 'urn:resgrid:params:oauth:grant-type:mfa_completion',
    transaction,
    completion_code: completionCode,
  });
  try {
    const response = await authApi.post<AuthResponse>('/connect/token', data);
    logger.info({ message: 'Login transaction completed' });
    return response.data;
  } catch (error) {
    // The transaction and completion code travel in the request body; only the sanitized failure is logged.
    logger.error({ message: 'Login transaction completion failed', context: sanitizeAuthError(error) });
    throw error;
  }
};

// Last SSO exchange that failed with a 2FA challenge, retained IN MEMORY ONLY so the OTP
// prompt can retry the same IdP token with a code. Cleared on success and on any final failure.
let pendingSsoMfaExchange: { provider: 'oidc' | 'saml2'; externalToken: string; username: string; departmentId?: number; departmentToken?: string } | null = null;

/**
 * The legacy SSO exchange. `departmentToken` is the department's encrypted token (from SSO discovery, or from the SAML
 * relay's callback): connect/external-token needs it, or a department code, to know which department's provider to
 * validate against. `department_id` alone is not read by the server.
 */
export const externalTokenRequest = async (provider: 'oidc' | 'saml2', externalToken: string, username: string, departmentId?: number, otpCode?: string, departmentToken?: string): Promise<LoginResponse> => {
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

    if (departmentToken) {
      data.department_token = departmentToken;
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

      pendingSsoMfaExchange = { provider, externalToken, username, departmentId, departmentToken };
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

/** Drops the IdP token kept for a code retry: the member dismissed the prompt, left the screen, or signed out. */
export const forgetPendingSsoExchange = (): void => {
  pendingSsoMfaExchange = null;
};

/** Retries the pending SSO exchange with the user's authenticator code (2FA challenge). */
export const retrySsoExchangeWithOtp = async (otpCode: string): Promise<LoginResponse> => {
  if (!pendingSsoMfaExchange) {
    return { successful: false, message: 'No pending SSO sign-in to verify', authResponse: null };
  }

  const { provider, externalToken, username, departmentId, departmentToken } = pendingSsoMfaExchange;
  return externalTokenRequest(provider, externalToken, username, departmentId, otpCode, departmentToken);
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
