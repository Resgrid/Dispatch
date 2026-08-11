import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { performTokenRefresh } from '@/lib/auth/token-refresh';
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

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically resolve baseURL to support custom server URLs
    // that may have been changed after app startup (e.g. via settings/login)
    config.baseURL = getBaseApiUrl();

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
        logger.error({
          message: 'Token refresh failed',
          context: { error: refreshError instanceof Error ? refreshError.message : String(refreshError) },
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
