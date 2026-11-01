import { AxiosError, type AxiosResponse } from 'axios';

import { logger } from '@/lib/logging';

import { refreshTokenRequest } from '../api';
import { cancelScheduledTokenRefresh, initTokenRefresh, isRefreshCredentialRejection, performTokenRefresh, scheduleTokenRefresh, transientRetryDelayMs } from '../token-refresh';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../api', () => ({
  refreshTokenRequest: jest.fn(),
}));

const mockRefreshTokenRequest = refreshTokenRequest as jest.MockedFunction<typeof refreshTokenRequest>;
const mockLogger = logger as jest.Mocked<typeof logger>;

const axiosErrorWithStatus = (status: number, data?: unknown): AxiosError => new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse);

// How the token endpoint (OpenIddict) answers a refresh token it no longer honours.
const INVALID_GRANT = { error: 'invalid_grant', error_description: 'The refresh token is no longer valid.' };

describe('isRefreshCredentialRejection', () => {
  it.each([400, 401])('returns true for a %i invalid_grant from the token endpoint', (status) => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status, INVALID_GRANT))).toBe(true);
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status, { error: 'invalid_grant' }))).toBe(true);
  });

  it.each(['invalid_request', 'invalid_client', 'unauthorized_client', 'unsupported_grant_type', 'invalid_scope'])('returns false for a 400 %s (says nothing about the refresh token)', (oauthError) => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(400, { error: oauthError }))).toBe(false);
  });

  it('returns false for a 401 invalid_client (client authentication, not the refresh token)', () => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(401, { error: 'invalid_client' }))).toBe(false);
  });

  it.each([400, 401])('returns false for a %i with no OAuth error body (e.g. a proxy error page)', (status) => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status))).toBe(false);
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status, {}))).toBe(false);
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status, '<html>Bad Request</html>'))).toBe(false);
  });

  it.each([403, 404, 408, 429, 500, 502, 503])('returns false for invalid_grant on a %i', (status) => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status, { error: 'invalid_grant' }))).toBe(false);
  });

  it('returns false for a network error and for non-Axios errors', () => {
    expect(isRefreshCredentialRejection(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(false);
    expect(isRefreshCredentialRejection(new Error('boom'))).toBe(false);
    expect(isRefreshCredentialRejection({ response: { status: 400, data: { error: 'invalid_grant' } } })).toBe(false);
    expect(isRefreshCredentialRejection(null)).toBe(false);
  });
});

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

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.getRefreshToken.mockReturnValue('refresh-token');
    initTokenRefresh(handlers);
    // Resets the transient-failure counter as a fresh login would.
    scheduleTokenRefresh(3600);
    cancelScheduledTokenRefresh();
  });

  afterEach(() => {
    cancelScheduledTokenRefresh();
  });

  it.each([400, 401])('treats a %i invalid_grant from the token endpoint as an expired session, not an error', async (status) => {
    mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status, INVALID_GRANT));

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh rejected, ending session' }));
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 400 invalid_request', 400, { error: 'invalid_request' }],
    ['a 401 invalid_client', 401, { error: 'invalid_client' }],
    ['a 400 with no body', 400, undefined],
    ['a 401 with no body', 401, undefined],
    ['a 400 proxy error page', 400, '<html><body>Bad Request</body></html>'],
  ])('keeps the session and schedules a retry for %s, which says nothing about the refresh token', async (_label, status, data) => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    try {
      mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status, data));

      await expect(performTokenRefresh()).resolves.toBe(false);

      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh rejected, ending session' }));
      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh failed; will retry', context: expect.objectContaining({ status }) }));
      expect(handlers.onRefreshFailed).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
      expect(setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1]).toBe(transientRetryDelayMs(1));
    } finally {
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
      setTimeoutSpy.mockRestore();
    }
  });

  it.each([403, 404])('still ends the session for a non-transient %i', async (status) => {
    mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status));

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh failed' }));
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('keeps the session and schedules a retry when the token endpoint is unreachable', async () => {
    // A network blip says nothing about the refresh token. Signing the user out for it would end
    // a dispatcher's shift over a dead spot; the token is kept and the refresh tried again.
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    try {
      mockRefreshTokenRequest.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

      await expect(performTokenRefresh()).resolves.toBe(false);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token refresh failed; will retry' }));
      expect(handlers.onRefreshFailed).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
      expect(setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1]).toBe(transientRetryDelayMs(1));
    } finally {
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
      setTimeoutSpy.mockRestore();
    }
  });

  it.each([500, 502, 503, 408, 429])('treats a %i from the token endpoint as transient', async (status) => {
    jest.useFakeTimers();
    try {
      mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status));

      await expect(performTokenRefresh()).resolves.toBe(false);

      expect(handlers.onRefreshFailed).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
    } finally {
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
    }
  });

  it('backs off between retries and stops at the cap', () => {
    expect(transientRetryDelayMs(1)).toBe(5000);
    expect(transientRetryDelayMs(2)).toBe(10000);
    expect(transientRetryDelayMs(3)).toBe(20000);
    expect(transientRetryDelayMs(4)).toBe(40000);
    expect(transientRetryDelayMs(5)).toBe(60000);
    expect(transientRetryDelayMs(12)).toBe(60000);
  });

  it('retries on the timer and ends the session once the server actually rejects the token', async () => {
    jest.useFakeTimers();
    try {
      mockRefreshTokenRequest.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK')).mockRejectedValueOnce(axiosErrorWithStatus(400, INVALID_GRANT));

      await expect(performTokenRefresh()).resolves.toBe(false);
      expect(handlers.onRefreshFailed).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(transientRetryDelayMs(1));

      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(2);
      expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
    }
  });

  it('a retry that gets through reschedules the normal refresh and resets the backoff', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    try {
      mockRefreshTokenRequest
        .mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
        .mockResolvedValueOnce({ access_token: 'a', refresh_token: 'r', id_token: '', expires_in: 3600, token_type: 'Bearer', expiration_date: '' });

      await expect(performTokenRefresh()).resolves.toBe(false);
      await jest.advanceTimersByTimeAsync(transientRetryDelayMs(1));

      expect(handlers.applyAuthResponse).toHaveBeenCalledTimes(1);
      expect(handlers.onRefreshFailed).not.toHaveBeenCalled();
      expect(setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1]).toBe(3600 * 1000 - 60000);
    } finally {
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
      setTimeoutSpy.mockRestore();
    }
  });

  it('does not treat a handler refusing the response as an outage', async () => {
    // applyAuthResponse throws when the refresh raced a sign-out. That is a verdict, not a network
    // failure: nothing is retried.
    jest.useFakeTimers();
    try {
      mockRefreshTokenRequest.mockResolvedValue({ access_token: 'a', refresh_token: 'r', id_token: '', expires_in: 3600, token_type: 'Bearer', expiration_date: '' });
      handlers.applyAuthResponse.mockImplementation(() => {
        throw new Error('Token refresh completed after sign-out; discarding tokens');
      });

      await expect(performTokenRefresh()).resolves.toBe(false);

      expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      handlers.applyAuthResponse.mockReset();
      cancelScheduledTokenRefresh();
      jest.useRealTimers();
    }
  });

  it('does not report a missing refresh token as an error', async () => {
    handlers.getRefreshToken.mockReturnValue(null);

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(handlers.onRefreshFailed).toHaveBeenCalledTimes(1);
  });
});
