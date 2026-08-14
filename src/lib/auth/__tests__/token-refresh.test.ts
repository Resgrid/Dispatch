import { AxiosError, type AxiosResponse } from 'axios';

import { logger } from '@/lib/logging';

import { refreshTokenRequest } from '../api';
import { cancelScheduledTokenRefresh, initTokenRefresh, performTokenRefresh, scheduleTokenRefresh } from '../token-refresh';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../api', () => ({
  refreshTokenRequest: jest.fn(),
}));

const mockRefreshTokenRequest = refreshTokenRequest as jest.MockedFunction<typeof refreshTokenRequest>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('scheduleTokenRefresh', () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    cancelScheduledTokenRefresh();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const lastScheduledDelay = (): number => setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1] as number;

  it('refreshes one buffer before expiry for normal lifetimes', () => {
    scheduleTokenRefresh(86400); // 24h, the server default
    expect(lastScheduledDelay()).toBe(86400 * 1000 - 60000);
  });

  it('refreshes at half the lifetime when the lifetime approaches the buffer', () => {
    // A 1-minute server lifetime equals the buffer; the old max(lifetime - buffer, min)
    // clamped this to the 5s minimum and refreshed in a perpetual tight loop.
    scheduleTokenRefresh(60);
    expect(lastScheduledDelay()).toBe(30000);
  });

  it('never schedules below the minimum delay', () => {
    scheduleTokenRefresh(8);
    expect(lastScheduledDelay()).toBe(5000);

    scheduleTokenRefresh(0);
    expect(lastScheduledDelay()).toBe(5000);
  });

  it('replaces a previously scheduled refresh instead of stacking timers', () => {
    scheduleTokenRefresh(3600);
    scheduleTokenRefresh(7200);
    expect(jest.getTimerCount()).toBe(1);
  });
});

describe('performTokenRefresh failure reporting', () => {
  const handlers = {
    getRefreshToken: jest.fn<string | null, []>(),
    applyAuthResponse: jest.fn(),
    onRefreshFailed: jest.fn(),
  };

  const axiosErrorWithStatus = (status: number): AxiosError => new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', undefined, undefined, { status } as AxiosResponse);

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.getRefreshToken.mockReturnValue('refresh-token');
    initTokenRefresh(handlers);
  });

  it.each([400, 401])('treats a %i from the token endpoint as an expired session, not an error', async (status) => {
    mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status));

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh rejected, ending session' }));
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('still reports an unreachable token endpoint as an error', async () => {
    mockRefreshTokenRequest.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh failed' }));
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('does not report a missing refresh token as an error', async () => {
    handlers.getRefreshToken.mockReturnValue(null);

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });
});
