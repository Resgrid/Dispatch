import axios from 'axios';

import { logger } from '@/lib/logging';

import { refreshTokenRequest } from './api';
import type { AuthResponse } from './types';

const REFRESH_BUFFER_MS = 60000;
const MIN_REFRESH_DELAY_MS = 5000;

// A refresh that fails for a reason other than the server rejecting the token is retried rather
// than treated as the end of the session: a dispatcher who loses signal for a minute must not be
// signed out by it. The delay doubles from the first value up to the cap and stays there; the
// refresh token's own lifetime is what bounds the retries, because once it lapses the server
// answers 400 and the session ends the normal way.
const TRANSIENT_RETRY_BASE_MS = 5000;
const TRANSIENT_RETRY_MAX_MS = 60000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightRefresh: Promise<boolean> | null = null;
let transientFailures = 0;

export interface TokenRefreshHandlers {
  getRefreshToken: () => string | null;
  applyAuthResponse: (response: AuthResponse) => void;
  onRefreshFailed: () => void;
}

let handlers: TokenRefreshHandlers | null = null;

export function initTokenRefresh(h: TokenRefreshHandlers): void {
  handlers = h;
}

export function cancelScheduledTokenRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/** Exposed for tests: the delay the next transient retry would use, in ms. */
export function transientRetryDelayMs(failures: number): number {
  return Math.min(TRANSIENT_RETRY_BASE_MS * 2 ** Math.max(0, failures - 1), TRANSIENT_RETRY_MAX_MS);
}

const scheduleTransientRetry = (): void => {
  cancelScheduledTokenRefresh();
  transientFailures += 1;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void performTokenRefresh();
  }, transientRetryDelayMs(transientFailures));
};

/**
 * Whether a failed token request says anything about the token. The endpoint answering 400/401 is
 * the server's verdict on the refresh token itself; a network error, a timeout or a 5xx is the
 * endpoint not being reachable, which says nothing about the token.
 */
const isTransientFailure = (status: number | undefined): boolean => status === undefined || status >= 500 || status === 408 || status === 429;
// Only an Axios error qualifies: a throw from our own handlers (applyAuthResponse refusing a
// response that raced sign-out) has no status either, but it is a verdict, not an outage.

/**
 * Schedule an automatic refresh one minute before the access token expires.
 * `expiresInSeconds` is the relative lifetime from the token response, NOT an
 * epoch timestamp - subtracting Date.now() from it yields a hugely negative
 * delay that fires the timer immediately and loops forever.
 */
export function scheduleTokenRefresh(expiresInSeconds: number): void {
  cancelScheduledTokenRefresh();
  // A fresh token (login, or a refresh that got through) ends any retry sequence.
  transientFailures = 0;

  // Refresh REFRESH_BUFFER_MS before expiry, but never earlier than half the token's
  // lifetime: the server's lifetime is configurable down to one minute, which equals
  // the buffer and would otherwise clamp every delay to the minimum and refresh in a
  // perpetual tight loop. MIN_REFRESH_DELAY_MS stays as the absolute lower bound.
  const lifetimeMs = expiresInSeconds * 1000;
  const delay = Math.max(lifetimeMs - REFRESH_BUFFER_MS, lifetimeMs / 2, MIN_REFRESH_DELAY_MS);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void performTokenRefresh();
  }, delay);
}

/**
 * Single-flight token refresh shared by the auth store timer and the axios 401
 * interceptor. Concurrent callers await the same request, so the refresh token
 * is never rotated twice in parallel (which invalidates one of the requests).
 */
export function performTokenRefresh(): Promise<boolean> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const operation = (async (): Promise<boolean> => {
    if (!handlers) {
      logger.error({ message: 'Token refresh attempted before initTokenRefresh was called' });
      return false;
    }

    const refreshToken = handlers.getRefreshToken();
    if (!refreshToken) {
      logger.warn({ message: 'Token refresh skipped: no refresh token available' });
      handlers.onRefreshFailed();
      return false;
    }

    try {
      const response = await refreshTokenRequest(refreshToken);
      // A logout or a new login can replace the session while the request is in
      // flight. Its result must never overwrite or sign out the newer session.
      if (handlers.getRefreshToken() !== refreshToken) {
        return false;
      }
      handlers.applyAuthResponse(response);
      scheduleTokenRefresh(response.expires_in);
      return true;
    } catch (error) {
      if (handlers.getRefreshToken() !== refreshToken) {
        return false;
      }
      // A refresh token the server no longer honours is how a session ends: the token
      // endpoint answers 400/401, the user goes back to the login screen, and nothing is
      // broken. Only the shapes that mean something is actually wrong - network loss,
      // server faults - are worth reporting as errors.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const context = { status, error: error instanceof Error ? error.message : String(error) };

      if (status === 400 || status === 401) {
        logger.warn({ message: 'Token refresh rejected, ending session', context });
      } else if (axios.isAxiosError(error) && isTransientFailure(status)) {
        // The token is still good as far as anyone knows; keep it and try again shortly. Callers
        // still get `false` for this attempt, so the request that needed a fresh token fails on
        // its own without taking the session down with it.
        scheduleTransientRetry();
        logger.error({ message: 'Token refresh failed; will retry', context: { ...context, attempt: transientFailures, retryInMs: transientRetryDelayMs(transientFailures) } });
        return false;
      } else {
        logger.error({ message: 'Token refresh failed', context });
      }

      cancelScheduledTokenRefresh();
      handlers.onRefreshFailed();
      return false;
    }
  })();

  inFlightRefresh = operation;
  operation.finally(() => {
    if (inFlightRefresh === operation) {
      inFlightRefresh = null;
    }
  });

  return operation;
}
