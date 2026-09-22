import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { refreshTokenRequest } from '@/lib/auth/api';
import { cancelScheduledTokenRefresh } from '@/lib/auth/token-refresh';
import type { AuthResponse } from '@/lib/auth/types';
import useAuthStore from '@/stores/auth/store';

import { api, NoActiveSessionError } from '../client';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => 'https://api.example.com/api/v4',
}));

jest.mock('@/lib/auth/api', () => ({
  loginRequest: jest.fn(),
  refreshTokenRequest: jest.fn(),
  clearPasswordVerificationHash: jest.fn().mockResolvedValue(undefined),
}));

const response = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 } as AuthResponse;

describe('API requests using the shared token refresh engine', () => {
  const adapter = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh', refreshTokenExpiresOn: String(Date.now() + 3600000) });
    api.defaults.adapter = adapter;
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
    (refreshTokenRequest as jest.Mock).mockResolvedValue(response);
  });

  afterEach(() => {
    cancelScheduledTokenRefresh();
    jest.useRealTimers();
  });

  it('uses one refresh for concurrent requests with an expired persisted token', async () => {
    useAuthStore.setState({ refreshTokenExpiresOn: String(Date.now() - 1000) });

    await Promise.all([api.get('/Calls/GetActiveCalls'), api.get('/Units/GetAllUnitsInfos'), api.get('/Mapping/GetMayLayers')]);

    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
    expect(refreshTokenRequest).toHaveBeenCalledWith('old-refresh');
    expect(adapter).toHaveBeenCalledTimes(3);
    expect(adapter.mock.calls.every(([config]) => config.headers.Authorization === 'Bearer new-access')).toBe(true);
  });

  it('uses one refresh when parallel requests are rejected by the server', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer old-access') {
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config } as AxiosResponse);
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    });

    await Promise.all([api.get('/Calls/GetActiveCalls'), api.get('/Units/GetAllUnitsInfos'), api.get('/Mapping/GetMayLayers')]);

    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(6);
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('ends a rejected restored session once and stops all protected requests', async () => {
    useAuthStore.setState({ refreshTokenExpiresOn: String(Date.now() - 1000) });
    (refreshTokenRequest as jest.Mock).mockRejectedValue(new AxiosError('Rejected', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400 } as AxiosResponse));

    const results = await Promise.allSettled([api.get('/Calls/GetActiveCalls'), api.get('/Units/GetAllUnitsInfos')]);

    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
    expect(adapter).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', accessToken: null, refreshToken: null });
    for (const result of results) {
      expect(result).toMatchObject({ status: 'rejected', reason: expect.any(NoActiveSessionError) });
    }
    expect(jest.getTimerCount()).toBe(0);
  });
});
