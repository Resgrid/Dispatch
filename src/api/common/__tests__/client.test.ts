import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { performTokenRefresh } from '@/lib/auth/token-refresh';

import { api, NoActiveSessionError } from '../client';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => 'https://api.example.com/api/v4',
}));

jest.mock('@/lib/auth/token-refresh', () => ({
  performTokenRefresh: jest.fn(),
}));

const authState = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
  refreshTokenExpiresOn: null as string | null,
  status: 'signedOut' as string,
};

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => authState },
}));

const mockPerformTokenRefresh = performTokenRefresh as jest.MockedFunction<typeof performTokenRefresh>;

const unauthorized = (config: InternalAxiosRequestConfig): AxiosError => new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config } as AxiosResponse);

describe('api client session gating', () => {
  let adapter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    authState.accessToken = 'access-token';
    authState.refreshToken = 'refresh-token';
    authState.refreshTokenExpiresOn = String(Date.now() + 3600000);
    authState.status = 'signedIn';

    adapter = jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} });
    api.defaults.adapter = adapter as never;
  });

  it('does not send a request once the session is gone', async () => {
    authState.accessToken = null;
    authState.status = 'signedOut';

    await expect(api.get('/CallPriorities/GetAllCallPriorites')).rejects.toBeInstanceOf(NoActiveSessionError);

    expect(adapter).not.toHaveBeenCalled();
    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
  });

  it('does not attempt a refresh for a 401 that lands after sign-out', async () => {
    // The access token is still in memory but the session has ended, so the 401 in flight
    // has nothing left to refresh with.
    authState.status = 'signedOut';
    authState.refreshToken = null;
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.reject(unauthorized(config)));

    await expect(api.get('/Calls/GetActiveCalls')).rejects.toMatchObject({ response: { status: 401 } });

    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('still refreshes and retries a 401 for a live session', async () => {
    adapter.mockImplementationOnce((config: InternalAxiosRequestConfig) => Promise.reject(unauthorized(config)));
    mockPerformTokenRefresh.mockImplementation(async () => {
      authState.accessToken = 'refreshed-token';
      return true;
    });

    await expect(api.get('/Calls/GetActiveCalls')).resolves.toMatchObject({ status: 200 });

    expect(mockPerformTokenRefresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('refreshes an expired restored session before sending parallel API requests', async () => {
    authState.refreshTokenExpiresOn = String(Date.now() - 1000);
    mockPerformTokenRefresh.mockImplementation(async () => {
      authState.accessToken = 'refreshed-token';
      authState.refreshTokenExpiresOn = String(Date.now() + 3600000);
      return true;
    });

    await Promise.all([api.get('/Calls/GetActiveCalls'), api.get('/Units/GetAllUnitsInfos')]);

    expect(mockPerformTokenRefresh).toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(2);
    for (const [config] of adapter.mock.calls) {
      expect(config.headers.Authorization).toBe('Bearer refreshed-token');
    }
  });

  it('does not send protected requests when refreshing the restored session fails', async () => {
    authState.refreshTokenExpiresOn = String(Date.now() - 1000);
    mockPerformTokenRefresh.mockResolvedValue(false);

    await expect(api.get('/Calls/GetActiveCalls')).rejects.toBeInstanceOf(NoActiveSessionError);
    expect(adapter).not.toHaveBeenCalled();
  });

  it('retries a delayed 401 with the latest token without rotating it again', async () => {
    adapter.mockImplementationOnce((config: InternalAxiosRequestConfig) => {
      // Another request or the timer completed refresh while this request was in flight.
      authState.accessToken = 'refreshed-token';
      return Promise.reject(unauthorized(config));
    });

    await expect(api.get('/Calls/GetActiveCalls')).resolves.toMatchObject({ status: 200 });

    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('retries every parallel unauthorized request at most once', async () => {
    adapter.mockImplementation((config: InternalAxiosRequestConfig) => Promise.reject(unauthorized(config)));
    mockPerformTokenRefresh.mockImplementation(async () => {
      authState.accessToken = 'refreshed-token';
      return true;
    });

    const results = await Promise.allSettled([api.get('/Calls/GetActiveCalls'), api.get('/Units/GetAllUnitsInfos')]);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(adapter).toHaveBeenCalledTimes(4);
  });
});
