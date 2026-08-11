import { logger } from '@/lib/logging';

import { refreshTokenRequest } from './api';
import type { AuthResponse } from './types';

const REFRESH_BUFFER_MS = 60000;
const MIN_REFRESH_DELAY_MS = 5000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightRefresh: Promise<boolean> | null = null;

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

/**
 * Schedule an automatic refresh one minute before the access token expires.
 * `expiresInSeconds` is the relative lifetime from the token response, NOT an
 * epoch timestamp - subtracting Date.now() from it yields a hugely negative
 * delay that fires the timer immediately and loops forever.
 */
export function scheduleTokenRefresh(expiresInSeconds: number): void {
  cancelScheduledTokenRefresh();

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
      handlers.applyAuthResponse(response);
      scheduleTokenRefresh(response.expires_in);
      return true;
    } catch (error) {
      logger.error({
        message: 'Token refresh failed',
        context: { error: error instanceof Error ? error.message : String(error) },
      });
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
