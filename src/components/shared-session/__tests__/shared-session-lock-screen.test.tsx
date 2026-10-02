import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as api from '@/api/mfa/shared-session';
import { getPasskeyAssertion } from '@/lib/mfa/passkey';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';
import { afterSharedUnlock, endSharedShift } from '@/lib/shared-session/controller';
import useAuthStore from '@/stores/auth/store';
import { resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

import { SharedSessionLockScreen } from '../shared-session-lock-screen';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/api/mfa/shared-session');
jest.mock('@/lib/mfa/passkey', () => ({ getPasskeyAssertion: jest.fn(), passkeysSupported: jest.fn(() => true) }));
jest.mock('@/lib/mfa/sso-browser', () => ({ runSsoRoundTrip: jest.fn() }));
jest.mock('@/lib/mfa/approval-wait', () => ({ waitForApproval: jest.fn() }));
jest.mock('@/lib/shared-session/controller', () => ({ afterSharedUnlock: jest.fn(async () => undefined), endSharedShift: jest.fn(async () => undefined) }));
jest.mock('@/stores/auth/store', () => {
  const { create } = require('zustand');
  const store = create(() => ({ status: 'signedIn', logout: jest.fn(async () => undefined) }));
  return { __esModule: true, default: store };
});

const mocked = api as jest.Mocked<typeof api>;
const { waitForApproval } = jest.requireMock('@/lib/mfa/approval-wait') as { waitForApproval: jest.Mock };
const refusal = (status: number, type: string) => Object.assign(new Error(type), { response: { status, data: { type } } });

const options = (overrides: Partial<api.UnlockOptionsData> = {}): api.UnlockOptionsData => ({
  Operator: 'pat',
  LockVersion: 7,
  Methods: ['totp', 'passkey', 'passkey_approval', 'federated'],
  Preferred: 'totp',
  Passkey: { RequestId: 'req-1', Options: { challenge: 'c' } },
  ...overrides,
});

const unlocked = { Operator: 'pat', Client: 'dispatch', Shared: true, Locked: false, LockVersion: 7, LockReason: null, IdleLockMinutes: 15, IdleLocksAt: '2026-09-29T12:00:00Z', ShiftEndsAt: null, InstallationLabel: 'Engine 12' };

describe('SharedSessionLockScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSharedSession();
    useAuthStore.setState({ status: 'signedIn' });
    mocked.lockSession.mockResolvedValue({ Locked: true, LockVersion: 7 });
    mocked.getUnlockOptions.mockResolvedValue(options());
    mocked.completeUnlock.mockResolvedValue(unlocked as never);
  });

  const showLocked = () => act(() => useSharedSessionStore.setState({ shared: true, locked: true, lockVersion: null }));

  it('shows nothing while the session is unlocked', () => {
    const { queryByTestId } = render(<SharedSessionLockScreen />);
    expect(queryByTestId('shared-lock-screen')).toBeNull();
    expect(mocked.lockSession).not.toHaveBeenCalled();
  });

  it('locks on the server first, then offers the methods; never starts the passkey on its own', async () => {
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();

    await waitFor(() => expect(getByTestId('shared-lock-code')).toBeTruthy());
    expect(mocked.lockSession).toHaveBeenCalledTimes(1);
    expect(mocked.getUnlockOptions).toHaveBeenCalledWith(7);
    expect(useSharedSessionStore.getState().lockVersion).toBe(7);
    expect(getByTestId('shared-lock-operator')).toBeTruthy();
    expect(getByTestId('shared-lock-passkey')).toBeTruthy();
    expect(getByTestId('shared-lock-approval')).toBeTruthy();
    expect(getByTestId('shared-lock-provider')).toBeTruthy();
    expect(getPasskeyAssertion).not.toHaveBeenCalled();
  });

  it('unlocks the same session with a code, then resumes it', async () => {
    const { getByTestId, queryByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-code')).toBeTruthy());

    fireEvent.changeText(getByTestId('shared-lock-code'), ' 123456 ');
    await act(async () => fireEvent.press(getByTestId('shared-lock-unlock')));

    expect(mocked.completeUnlock).toHaveBeenCalledWith(7, { Method: 'totp', Code: '123456' });
    expect(afterSharedUnlock).toHaveBeenCalledTimes(1);
    expect(useSharedSessionStore.getState()).toMatchObject({ locked: false, operator: 'pat' });
    await waitFor(() => expect(queryByTestId('shared-lock-screen')).toBeNull());
  });

  it('shows a wrong code and stays locked', async () => {
    mocked.completeUnlock.mockRejectedValueOnce(refusal(401, 'invalid_totp'));
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-code')).toBeTruthy());

    fireEvent.changeText(getByTestId('shared-lock-code'), '000000');
    await act(async () => fireEvent.press(getByTestId('shared-lock-unlock')));

    expect(getByTestId('shared-lock-error').props.children).toBe('mfa.errors.invalid_totp');
    expect(useSharedSessionStore.getState().locked).toBe(true);
    expect(afterSharedUnlock).not.toHaveBeenCalled();
  });

  it('starts over on the current lock when it changed', async () => {
    mocked.completeUnlock.mockRejectedValueOnce(refusal(409, 'shared_session_lock_changed'));
    mocked.lockSession.mockResolvedValueOnce({ Locked: true, LockVersion: 7 }).mockResolvedValueOnce({ Locked: true, LockVersion: 8 });
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-code')).toBeTruthy());

    fireEvent.changeText(getByTestId('shared-lock-code'), '123456');
    await act(async () => fireEvent.press(getByTestId('shared-lock-unlock')));

    await waitFor(() => expect(mocked.getUnlockOptions).toHaveBeenLastCalledWith(8));
    expect(getByTestId('shared-lock-error').props.children).toBe('mfa.errors.shared_session_lock_changed');
  });

  it('unlocks with a passkey only when the operator asks, with a fresh ceremony after a failure', async () => {
    (getPasskeyAssertion as jest.Mock).mockRejectedValueOnce(refusal(400, 'passkey_verification_failed')).mockResolvedValueOnce({ id: 'cred' });
    mocked.getUnlockOptions.mockResolvedValueOnce(options()).mockResolvedValueOnce(options({ Passkey: { RequestId: 'req-2', Options: { challenge: 'd' } } }));
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-passkey')).toBeTruthy());

    await act(async () => fireEvent.press(getByTestId('shared-lock-passkey')));
    expect(mocked.getUnlockOptions).toHaveBeenCalledTimes(2);

    await act(async () => fireEvent.press(getByTestId('shared-lock-passkey')));
    expect(mocked.completeUnlock).toHaveBeenCalledWith(7, { Method: 'passkey', RequestId: 'req-2', Credential: { id: 'cred' } });
  });

  it('unlocks with approval from Responder, showing the number here only', async () => {
    mocked.requestUnlockApproval.mockResolvedValue({ ApprovalRequestId: 'apr-1', MatchNumber: '42', ExpiresIn: 120 });
    waitForApproval.mockResolvedValue('approved');
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-approval')).toBeTruthy());

    await act(async () => fireEvent.press(getByTestId('shared-lock-approval')));

    expect(mocked.requestUnlockApproval).toHaveBeenCalledWith(7);
    expect(mocked.completeUnlock).toHaveBeenCalledWith(7, { Method: 'passkey_approval', ApprovalRequestId: 'apr-1' });
  });

  it('unlocks through the organization with a fresh provider sign-in', async () => {
    (runSsoRoundTrip as jest.Mock).mockResolvedValue({ ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code', codeVerifier: 'ver' } });
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-provider')).toBeTruthy());

    await act(async () => fireEvent.press(getByTestId('shared-lock-provider')));

    expect((runSsoRoundTrip as jest.Mock).mock.calls[0][1]).toBe(true);
    expect(mocked.completeUnlock).toHaveBeenCalledWith(7, { Method: 'federated', SsoTransactionId: 'sso-1', SsoCode: 'code', CodeVerifier: 'ver' });
  });

  it('offers only ending the shift when there is no quick unlock', async () => {
    mocked.getUnlockOptions.mockResolvedValue(options({ Methods: [], Passkey: null }));
    const { getByTestId, queryByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-no-methods')).toBeTruthy());
    expect(queryByTestId('shared-lock-code')).toBeNull();

    await act(async () => fireEvent.press(getByTestId('shared-lock-switch')));
    expect(endSharedShift).toHaveBeenCalledWith(true);
    await act(async () => fireEvent.press(getByTestId('shared-lock-end-shift')));
    expect(endSharedShift).toHaveBeenCalledWith(false);
  });

  it('signs out when the session itself has ended', async () => {
    mocked.lockSession.mockRejectedValue(refusal(401, 'session_revoked'));
    render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(useAuthStore.getState().logout).toHaveBeenCalled());
  });

  it('offers a retry when the server cannot be reached', async () => {
    mocked.lockSession.mockRejectedValueOnce(new Error('Network Error'));
    const { getByTestId } = render(<SharedSessionLockScreen />);
    showLocked();
    await waitFor(() => expect(getByTestId('shared-lock-retry')).toBeTruthy());

    await act(async () => fireEvent.press(getByTestId('shared-lock-retry')));
    await waitFor(() => expect(getByTestId('shared-lock-code')).toBeTruthy());
  });
});
