import { MMKV } from 'react-native-mmkv';

import { clearPasswordVerificationHash, refreshTokenRequest } from '@/lib/auth/api';
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
  beforeEach(() => {
    jest.useFakeTimers();
    (clearPasswordVerificationHash as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cancelScheduledTokenRefresh();
    jest.useRealTimers();
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
    expect(state.refreshTokenExpiresOn).toBe(String(Date.now() + 3600000));
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

  it('ends the session before password cleanup finishes', async () => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh' });
    let finishCleanup: () => void = () => {};
    (clearPasswordVerificationHash as jest.Mock).mockReturnValue(new Promise<void>((resolve) => (finishCleanup = resolve)));

    const logout = useAuthStore.getState().logout();
    const stateDuringCleanup = useAuthStore.getState();
    finishCleanup();
    await logout;

    expect(stateDuringCleanup.status).toBe('signedOut');
    expect(stateDuringCleanup.accessToken).toBeNull();
  });

  it('still ends the session if password cleanup fails', async () => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh' });
    (clearPasswordVerificationHash as jest.Mock).mockRejectedValue(new Error('Storage unavailable'));

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it.each(['resolve', 'reject'])('ignores a refresh that %ss after a different session signs in', async (outcome) => {
    useAuthStore.setState({ status: 'signedIn', accessToken: 'old-access', refreshToken: 'old-refresh' });
    let finishRefresh: () => void = () => {};
    (refreshTokenRequest as jest.Mock).mockReturnValue(
      new Promise<AuthResponse>((resolve, reject) => {
        finishRefresh = () => (outcome === 'resolve' ? resolve(authResponse) : reject(new Error('Old refresh rejected')));
      })
    );
    const refresh = performTokenRefresh();
    useAuthStore.setState({ status: 'signedIn', accessToken: 'other-access', refreshToken: 'other-refresh' });
    finishRefresh();

    await expect(refresh).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'other-access', refreshToken: 'other-refresh' });
  });

  it('restores automatic refresh when persisted credentials are rehydrated', async () => {
    const authStorage = new MMKV({ id: 'auth-storage' });
    authStorage.set('auth-storage', JSON.stringify({ state: { status: 'signedIn', accessToken: 'stored-access', refreshToken: 'stored-refresh', refreshTokenExpiresOn: String(Date.now() + 3600000) }, version: 0 }));
    (refreshTokenRequest as jest.Mock).mockResolvedValue(authResponse);

    await useAuthStore.persist.rehydrate();
    await jest.advanceTimersByTimeAsync(3540000);

    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
    expect(refreshTokenRequest).toHaveBeenCalledWith('stored-refresh');
    expect(useAuthStore.getState().accessToken).toBe('new-access');
  });
});
