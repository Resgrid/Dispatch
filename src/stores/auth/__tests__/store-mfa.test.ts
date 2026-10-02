/**
 * The auth store on a login transaction (passkey plan section 7.5) and on a shared workstation (section 12.5): the
 * pending sign-in is never persisted, the completion grant signs in like the password path, the personal lockscreen's
 * verifier waits in memory until the sign-in finishes (and a shared workstation never keeps one), a refresh refused while
 * the shared session is locked keeps the tokens, and a sign-out drops every sign-in secret and the shared state.
 */
import { MMKV } from 'react-native-mmkv';

import {
  clearPasswordVerificationHash,
  completionGrantRequest,
  computePasswordVerification,
  forgetPendingSsoExchange,
  loginRequest,
  refreshTokenRequest,
  savePasswordVerification,
  storePasswordVerificationHash,
} from '@/lib/auth/api';
import { cancelScheduledTokenRefresh, performTokenRefresh } from '@/lib/auth/token-refresh';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';
import { completeTotp, ssoRedeem } from '@/lib/mfa/transaction-api';
import { hasLoginTransaction } from '@/stores/auth/login-mfa';
import { applySharedSessionStatus, resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

import useAuthStore from '../store';

let mockSharedInstallation = false;

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/auth/api', () => ({
  loginRequest: jest.fn(),
  forgetPendingSsoExchange: jest.fn(),
  refreshTokenRequest: jest.fn(),
  completionGrantRequest: jest.fn(),
  clearPasswordVerificationHash: jest.fn().mockResolvedValue(undefined),
  storePasswordVerificationHash: jest.fn().mockResolvedValue(undefined),
  computePasswordVerification: jest.fn().mockResolvedValue({ salt: 's', hash: 'h' }),
  savePasswordVerification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/mfa/transaction-api', () => ({ ...jest.requireActual('@/lib/mfa/transaction-api'), completeTotp: jest.fn(), ssoRedeem: jest.fn() }));
jest.mock('@/lib/mfa/sso-browser', () => ({ runSsoRoundTrip: jest.fn() }));
jest.mock('@/lib/mfa/shared-installation', () => ({ ...jest.requireActual('@/lib/mfa/shared-installation'), isSharedInstallation: () => mockSharedInstallation }));

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokens = { access_token: 'access', refresh_token: 'refresh', id_token: `h.${base64Url({ sub: 'user-9', name: 'Pat' })}.s`, expires_in: 3600, token_type: 'Bearer', expiration_date: '' };
const challenge = { kind: 'verify' as const, methods: ['totp' as const], enrolled: ['totp' as const], preferred: 'totp' as const, expiresAt: null, source: 'password' as const };
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Dispatch auth store: login transaction and shared workstations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharedInstallation = false;
    resetSharedSession();
    (computePasswordVerification as jest.Mock).mockResolvedValue({ salt: 's', hash: 'h' });
    (clearPasswordVerificationHash as jest.Mock).mockResolvedValue(undefined);
    (savePasswordVerification as jest.Mock).mockResolvedValue(undefined);
    useAuthStore.setState({ accessToken: null, refreshToken: null, refreshTokenExpiresOn: null, status: 'signedOut', error: null, profile: null, userId: null, mfaChallenge: null, pendingRecoveryCodes: null });
  });

  afterEach(() => cancelScheduledTokenRefresh());

  const startTransaction = async () => {
    (loginRequest as jest.Mock).mockResolvedValue({ successful: false, message: '', authResponse: null, mfaRequired: true, mfaTransaction: { secret: 'txn-secret', challenge } });
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });
  };

  it('holds a login transaction in memory and shows only the challenge; the verifier waits', async () => {
    await startTransaction();

    expect(useAuthStore.getState()).toMatchObject({ status: 'mfaRequired', mfaChallenge: challenge, error: null });
    expect(hasLoginTransaction()).toBe(true);
    expect(JSON.stringify(useAuthStore.getState())).not.toContain('txn-secret');
    expect(computePasswordVerification).toHaveBeenCalledWith('pw');
    expect(savePasswordVerification).not.toHaveBeenCalled();
  });

  it('finishes the sign-in with the completion grant and keeps the personal lockscreen verifier', async () => {
    await startTransaction();
    (completeTotp as jest.Mock).mockResolvedValue({ CompletionCode: 'done', ExpiresIn: 60, RecoveryCodes: null });
    (completionGrantRequest as jest.Mock).mockResolvedValue(tokens);

    const result = await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: '123456' });
    await flush();

    expect(result).toEqual({ ok: true, recovery: false });
    expect(completionGrantRequest).toHaveBeenCalledWith('txn-secret', 'done');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'access', refreshToken: 'refresh', userId: 'user-9', mfaChallenge: null });
    expect(savePasswordVerification).toHaveBeenCalledWith({ salt: 's', hash: 'h' });
    expect(hasLoginTransaction()).toBe(false);
  });

  it('never keeps a lockscreen verifier on a shared workstation', async () => {
    mockSharedInstallation = true;
    await startTransaction();
    expect(computePasswordVerification).not.toHaveBeenCalled();

    (completeTotp as jest.Mock).mockResolvedValue({ CompletionCode: 'done', ExpiresIn: 60, RecoveryCodes: null });
    (completionGrantRequest as jest.Mock).mockResolvedValue(tokens);
    await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: '123456' });
    await flush();
    expect(savePasswordVerification).not.toHaveBeenCalled();
    expect(clearPasswordVerificationHash).toHaveBeenCalled();

    (loginRequest as jest.Mock).mockResolvedValue({ successful: true, message: '', authResponse: tokens });
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });
    expect(storePasswordVerificationHash).not.toHaveBeenCalled();
  });

  it('saves no verifier from a waiting password sign-in when the organization sign-in finishes instead', async () => {
    await startTransaction();
    (runSsoRoundTrip as jest.Mock).mockResolvedValue({ ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code', codeVerifier: 'v' } });
    (ssoRedeem as jest.Mock).mockResolvedValue({ Outcome: 'completed', Transaction: 'sso-txn', CompletionCode: 'done' });
    (completionGrantRequest as jest.Mock).mockResolvedValue(tokens);

    await expect(useAuthStore.getState().loginWithBrokeredSso({ username: 'pat' })).resolves.toEqual({ outcome: 'signed_in' });
    await flush();

    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(savePasswordVerification).not.toHaveBeenCalled();
    expect(clearPasswordVerificationHash).toHaveBeenCalled();
  });

  it('does not store a verifier from before the device was made shared', async () => {
    await startTransaction();
    expect(computePasswordVerification).toHaveBeenCalled();
    mockSharedInstallation = true;
    (completeTotp as jest.Mock).mockResolvedValue({ CompletionCode: 'done', ExpiresIn: 60, RecoveryCodes: null });
    (completionGrantRequest as jest.Mock).mockResolvedValue(tokens);

    await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: '123456' });
    await flush();

    expect(savePasswordVerification).not.toHaveBeenCalled();
    expect(clearPasswordVerificationHash).toHaveBeenCalled();
  });

  it('drops a waiting verifier when the sign-in is abandoned', async () => {
    await startTransaction();
    useAuthStore.getState().cancelLoginMfa();

    expect(hasLoginTransaction()).toBe(false);
    expect(useAuthStore.getState().status).toBe('signedOut');

    // A brokered sign-in afterwards has no password: nothing from the abandoned one is saved.
    (completionGrantRequest as jest.Mock).mockResolvedValue(tokens);
    expect(savePasswordVerification).not.toHaveBeenCalled();
  });

  it('reports a department that requires MFA this server cannot set up here', async () => {
    (loginRequest as jest.Mock).mockResolvedValue({ successful: false, message: 'mfa_enrollment_required', authResponse: null, enrollmentRequired: true });
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'error', error: 'mfa_enrollment_required' });
  });

  it('keeps the tokens when a refresh is refused because the shared session is locked', async () => {
    useAuthStore.setState({ accessToken: 'a', refreshToken: 'r', status: 'signedIn' });
    (refreshTokenRequest as jest.Mock).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { error: 'invalid_grant', shared_session_locked: true } } });

    await expect(performTokenRefresh()).resolves.toBe(false);

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a', refreshToken: 'r' });
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: true });
  });

  it('signs out with a reason, dropping sign-in secrets and the shared session', async () => {
    await startTransaction();
    applySharedSessionStatus({ Operator: 'pat', Client: 'dispatch', Shared: true, Locked: true, LockVersion: 4, LockReason: 'idle', IdleLockMinutes: 15, IdleLocksAt: null, ShiftEndsAt: null, InstallationLabel: null });

    await useAuthStore.getState().logout('shift_ended');

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', error: 'shift_ended', mfaChallenge: null, pendingRecoveryCodes: null });
    expect(hasLoginTransaction()).toBe(false);
    // An SSO code retry the member never finished keeps no provider token past sign-out.
    expect(forgetPendingSsoExchange).toHaveBeenCalled();
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: false, locked: false, operator: null });
  });

  it('ignores anything but a reason string, such as a press event handed straight to logout', async () => {
    await useAuthStore.getState().logout({ nativeEvent: {} } as never);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', error: null });
  });

  it('never persists the pending challenge, recovery codes, or a pending second factor as a status', () => {
    useAuthStore.setState({ mfaChallenge: challenge, pendingRecoveryCodes: ['a-b'], accessToken: 'a', status: 'mfaRequired' });
    const saved = useAuthStore.persist.getOptions().partialize!(useAuthStore.getState()) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('mfaChallenge');
    expect(saved).not.toHaveProperty('pendingRecoveryCodes');
    expect(saved.status).toBe('signedOut');
    expect(saved.accessToken).toBe('a');
  });

  it('conceals a session restored on a shared installation before the server is asked, and not on a personal one', async () => {
    const stored = { state: { status: 'signedIn', accessToken: 'a', refreshToken: 'r', refreshTokenExpiresOn: String(Date.now() + 3600000) }, version: 0 };
    const storage = new MMKV({ id: 'auth-storage' });

    storage.set('auth-storage', JSON.stringify(stored));
    await useAuthStore.persist.rehydrate();
    expect(useSharedSessionStore.getState().locked).toBe(false);

    mockSharedInstallation = true;
    storage.set('auth-storage', JSON.stringify(stored));
    await useAuthStore.persist.rehydrate();
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: true });
  });
});
