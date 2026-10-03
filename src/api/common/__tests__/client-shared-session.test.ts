/**
 * The API client's answer to a shared session (passkey plan section 10.5): a locked 401 shows the lock screen and never
 * refreshes or signs out; an expired shift signs out with a reason; an application refusal (a 401 with a problem type)
 * is passed straight back without a refresh or a replay.
 */
const mockResponseInterceptorUse = jest.fn();
const mockGetAuthState = jest.fn();
const mockMarkLocked = jest.fn();
const mockAxiosInstance = Object.assign(jest.fn(), {
  defaults: { headers: { common: {} } },
  interceptors: { request: { use: jest.fn() }, response: { use: mockResponseInterceptorUse } },
});
const mockCreateConfigs: Record<string, unknown>[] = [];

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config: Record<string, unknown>) => {
      mockCreateConfigs.push(config);
      return mockAxiosInstance;
    }),
  },
}));
jest.mock('@/lib/logging', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: jest.fn(() => 'https://example.test') }));
jest.mock('@/stores/auth/store', () => ({ __esModule: true, default: { getState: mockGetAuthState } }));
jest.mock('@/stores/shared-session/store', () => ({ markSharedSessionLocked: (...args: unknown[]) => mockMarkLocked(...args) }));
const mockPerformTokenRefresh = jest.fn();
jest.mock('@/lib/auth/token-refresh', () => ({ performTokenRefresh: (...args: unknown[]) => mockPerformTokenRefresh(...args) }));

let rejectResponse: (error: unknown) => Promise<unknown>;

const failure = (status: number, data: unknown) => ({ config: { headers: { get: jest.fn() } }, response: { status, data } });

describe('API client and shared sessions', () => {
  const refreshAccessToken = jest.fn();
  const logout = jest.fn();

  beforeAll(() => {
    jest.isolateModules(() => {
      require('@/api/common/client');
    });
    rejectResponse = mockResponseInterceptorUse.mock.calls[0]?.[1] as (error: unknown) => Promise<unknown>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    refreshAccessToken.mockResolvedValue(true);
    logout.mockResolvedValue(undefined);
    mockPerformTokenRefresh.mockResolvedValue(true);
    mockGetAuthState.mockReturnValue({ refreshAccessToken, logout, refreshToken: 'refresh-token', accessToken: 'access-token', status: 'signedIn' });
  });

  it('names this app on every request', () => {
    const apiConfig = mockCreateConfigs.find((config) => (config.headers as Record<string, string>)['Content-Type'] === 'application/json');
    expect((apiConfig?.headers as Record<string, string>)['X-Resgrid-Client']).toBe('dispatch');
  });

  it('shows the lock screen for a locked session: no refresh, no sign-out', async () => {
    const error = failure(401, { error: 'shared_session_locked', lock_version: 12 });

    await expect(rejectResponse(error)).rejects.toBe(error);

    expect(mockMarkLocked).toHaveBeenCalledWith(12);
    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('signs out with the shift-ended reason when the shift ran out', async () => {
    const error = failure(401, { error: 'shared_session_expired' });

    await expect(rejectResponse(error)).rejects.toBe(error);

    expect(logout).toHaveBeenCalledWith('shift_ended');
    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
    expect(mockMarkLocked).not.toHaveBeenCalled();
  });

  it('passes an application refusal straight back: no refresh, no replay', async () => {
    const error = failure(401, { type: 'invalid_totp', status: 401 });

    await expect(rejectResponse(error)).rejects.toBe(error);

    expect(mockPerformTokenRefresh).not.toHaveBeenCalled();
    expect(mockAxiosInstance).not.toHaveBeenCalled();
  });

  it('still refreshes and replays for an expired access token (a 401 without a body)', async () => {
    mockAxiosInstance.mockResolvedValueOnce({ data: 'ok' });
    const error = { config: { headers: { get: jest.fn(), Authorization: 'Bearer access-token' } }, response: { status: 401, data: '' } };

    await expect(rejectResponse(error)).resolves.toEqual({ data: 'ok' });

    expect(mockPerformTokenRefresh).toHaveBeenCalledTimes(1);
    expect(mockMarkLocked).not.toHaveBeenCalled();
  });
});
