import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { performTokenRefresh } from '@/lib/auth/token-refresh';
import { readProtectedGrantHeaders } from '@/lib/data-protection/grant-provider';
import { logger } from '@/lib/logging';
import { getBaseApiUrl } from '@/lib/storage/app';
import useAuthStore from '@/stores/auth/store';

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: getBaseApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track if we're refreshing the token
let isRefreshing = false;
// Store pending requests
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

/**
 * Raised instead of sending a request that has no session behind it. Callers can tell this
 * apart from a server rejection: nothing was sent and nothing is wrong with the request.
 */
export class NoActiveSessionError extends Error {
  constructor(url?: string) {
    super(`Request to ${url ?? 'the API'} skipped: no active session`);
    this.name = 'NoActiveSessionError';
  }
}


// Request interceptor for API calls
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically resolve baseURL to support custom server URLs
    // that may have been changed after app startup (e.g. via settings/login)
    config.baseURL = getBaseApiUrl();

    const accessToken = useAuthStore.getState().accessToken;
    // Every endpoint reached through this instance is authenticated - the anonymous ones
    // (token grant, SSO discovery) use their own clients. Sending without a token is a
    // guaranteed 401 that then drags a refresh attempt and a logout behind it, which is
    // exactly what a screen unmounting after sign-out produces a burst of.
    if (!accessToken) {
      return Promise.reject(new NoActiveSessionError(config.url));
    }

    config.headers.Authorization = `Bearer ${accessToken}`;

    // Advanced Data Protection: while the member holds a live grant, every read through this
    // instance carries it, so a protected value comes back decrypted instead of REDACTED.
    //
    // Attached centrally on purpose. The alternative - each screen remembering to add the header -
    // is the failure mode that already shipped twice on the web side, and it fails SILENTLY: the
    // page looks fine and simply shows placeholders. The grant only ever goes to Resgrid's own API
    // (this instance's baseURL), is short-lived, and is bound to this member, department and policy
    // epoch, so the server is the only thing that can act on it.
    if (config.headers) {
      for (const [name, value] of Object.entries(readProtectedGrantHeaders())) {
        config.headers.set(name, value);
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }
    // Handle 401 errors
    if (error.response?.status === 401 && !(originalRequest as InternalAxiosRequestConfig & { _retry?: boolean })._retry) {
      // Nothing to refresh with: a 401 that arrives after the session ended (or with no
      // refresh token to begin with) would otherwise start a refresh, fail it, and drive
      // another logout for every request still in flight.
      const { refreshToken, status } = useAuthStore.getState();
      if (!refreshToken || status === 'signedOut') {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axiosInstance(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Add _retry property to request config type
      (originalRequest as InternalAxiosRequestConfig & { _retry: boolean })._retry = true;
      isRefreshing = true;

      try {
        // Single-flight refresh shared with the auth store's refresh timer, so a
        // timer refresh and a 401-triggered refresh can never rotate the refresh
        // token twice in parallel. Failure handling (logout) happens inside
        // performTokenRefresh.
        const refreshed = await performTokenRefresh();
        if (!refreshed) {
          throw new Error('Token refresh failed');
        }

        const accessToken = useAuthStore.getState().accessToken;
        if (!accessToken) {
          throw new Error('No access token available after refresh');
        }

        // Update Authorization header
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);
        // performTokenRefresh already reported why the refresh failed; this only records
        // which request was abandoned as a result.
        logger.warn({
          message: 'Request abandoned after token refresh failed',
          context: { url: originalRequest.url?.split('?')[0], error: refreshError instanceof Error ? refreshError.message : String(refreshError) },
        });
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Export configured axios instance
export const api = axiosInstance;

// Helper function to create API endpoints
export const createApiEndpoint = (endpoint: string) => {
  return {
    get: <T,>(params?: Record<string, unknown>, signal?: AbortSignal) => api.get<T>(endpoint, { params, signal }),
    post: <T,>(data: object, signal?: AbortSignal) => api.post<T>(endpoint, data, { signal }),
    put: <T,>(data: object, signal?: AbortSignal) => api.put<T>(endpoint, data, { signal }),
    delete: <T,>(params?: Record<string, unknown>, signal?: AbortSignal) => api.delete<T>(endpoint, { params, signal }),
  };
};
