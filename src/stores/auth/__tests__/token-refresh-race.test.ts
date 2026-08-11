import { refreshTokenRequest } from '@/lib/auth/api';
import { cancelScheduledTokenRefresh, performTokenRefresh } from '@/lib/auth/token-refresh';
import type { AuthResponse } from '@/lib/auth/types';

import useAuthStore from '../store';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/auth/api', () => ({
  loginRequest: jest.fn(),
  refreshTokenRequest: jest.fn(),
  clearPasswordVerificationHash: jest.fn().mockResolvedValue(undefined),
  storePasswordVerificationHash: jest.fn().mockResolvedValue(undefined),
}));

const authResponse = {
  access_token: 'new-access',
  refresh_token: 'new-refresh',
  expires_in: 3600,
} as AuthResponse;

describe('token refresh racing sign-out', () => {
  afterEach(() => {
    cancelScheduledTokenRefresh();
    jest.clearAllMocks();
  });

  it('applies tokens for an active session', async () => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh' });
    (refreshTokenRequest as jest.Mock).mockResolvedValue(authResponse);

    await expect(performTokenRefresh()).resolves.toBe(true);

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
  });

  it('does not resurrect the session when the refresh resolves after logout', async () => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh' });

    // Refresh request in flight when the user logs out
    let resolveRefresh: (value: AuthResponse) => void = () => {};
    (refreshTokenRequest as jest.Mock).mockReturnValue(new Promise<AuthResponse>((resolve) => (resolveRefresh = resolve)));

    const refreshPromise = performTokenRefresh();

    // Logout wins the race: store cleared and signed out
    useAuthStore.setState({ status: 'signedOut', accessToken: null, refreshToken: null, profile: null, userId: null });

    resolveRefresh(authResponse);
    await expect(refreshPromise).resolves.toBe(false);

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });
});
