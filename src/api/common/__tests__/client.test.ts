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
  status: 'signedOut' as string,
};

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => authState },
}));

const mockPerformTokenRefresh = performTokenRefresh as jest.MockedFunction<typeof performTokenRefresh>;

const unauthorized = (config: InternalAxiosRequestConfig): AxiosError =>
  new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config } as AxiosResponse);

describe('api client session gating', () => {
  let adapter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    authState.accessToken = 'access-token';
    authState.refreshToken = 'refresh-token';
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
});
