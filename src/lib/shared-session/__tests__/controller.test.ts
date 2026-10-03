const mockGetCurrentSession = jest.fn();
const mockLockSession = jest.fn();
const mockEndShift = jest.fn();
const mockLogout = jest.fn();
const mockRefresh = jest.fn();
const mockAuthState = { status: 'signedIn', refreshTimeoutId: null as unknown, logout: mockLogout, refreshAccessToken: mockRefresh };
const mockSignalR = {
  disconnectUpdateHub: jest.fn(async () => undefined),
  disconnectGeolocationHub: jest.fn(async () => undefined),
  disconnectChatHub: jest.fn(async () => undefined),
  connectUpdateHub: jest.fn(async () => undefined),
  connectGeolocationHub: jest.fn(async () => undefined),
  connectChatHub: jest.fn(async () => undefined),
};

jest.mock('@/api/mfa/shared-session', () => ({
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
  lockSession: (...args: unknown[]) => mockLockSession(...args),
  endShift: (...args: unknown[]) => mockEndShift(...args),
}));
jest.mock('@/stores/auth/store', () => ({ __esModule: true, default: { getState: () => mockAuthState } }));
jest.mock('@/stores/signalr/signalr-store', () => ({ useSignalRStore: { getState: () => mockSignalR } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { applySharedSessionStatus, resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

import { _resetSharedSessionController, afterSharedUnlock, checkSharedSession, endSharedShift, lockSharedSession, reportOperatorActivity } from '../controller';

const session = (overrides: Record<string, unknown> = {}) => ({
  Operator: null,
  Client: 'dispatch',
  Shared: true,
  Locked: false,
  LockVersion: 2,
  LockReason: null,
  IdleLockMinutes: 15,
  IdleLocksAt: new Date(Date.now() + 900000).toISOString(),
  ShiftEndsAt: new Date(Date.now() + 8 * 3600000).toISOString(),
  InstallationLabel: 'Engine 12',
  ...overrides,
});

const problem = (status: number, type: string) => Object.assign(new Error(type), { response: { status, data: { type } } });

describe('shared session controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSharedSession();
    _resetSharedSessionController();
    mockAuthState.status = 'signedIn';
    mockAuthState.refreshTimeoutId = null;
    mockGetCurrentSession.mockResolvedValue(session());
    mockLockSession.mockResolvedValue({ Locked: true, LockVersion: 3 });
    mockEndShift.mockResolvedValue({ Ended: true });
    mockLogout.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(true);
  });

  it('follows the server status, and asks nothing when signed out', async () => {
    await checkSharedSession();
    expect(mockGetCurrentSession).toHaveBeenCalledWith(false);
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: false, lockVersion: 2 });

    mockAuthState.status = 'signedOut';
    mockGetCurrentSession.mockClear();
    await expect(checkSharedSession()).resolves.toBeNull();
    expect(mockGetCurrentSession).not.toHaveBeenCalled();
  });

  it('never lets a status answer end a lock: one that left before the lock, or one saying unlocked while locked here', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockGetCurrentSession.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    useSharedSessionStore.setState({ shared: true, locked: false });
    const pending = checkSharedSession();
    await lockSharedSession('explicit');
    answer(session());
    await pending;
    expect(useSharedSessionStore.getState().locked).toBe(true);

    await checkSharedSession();
    expect(useSharedSessionStore.getState().locked).toBe(true);

    mockGetCurrentSession.mockResolvedValueOnce(session({ Locked: true, LockVersion: 9 }));
    await checkSharedSession();
    expect(useSharedSessionStore.getState().lockVersion).toBe(9);
  });

  it('does not let an answer from before a lock overwrite the unlock that followed it', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockGetCurrentSession.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    useSharedSessionStore.setState({ shared: true, locked: false });
    const pending = checkSharedSession();

    await lockSharedSession('explicit');
    applySharedSessionStatus(session({ LockVersion: 4, Operator: 'pat' }) as never);
    answer(session({ LockVersion: 2 }));
    await pending;

    expect(useSharedSessionStore.getState()).toMatchObject({ locked: false, lockVersion: 4 });
  });

  it('keeps the last state when the server cannot be reached', async () => {
    await checkSharedSession();
    mockGetCurrentSession.mockRejectedValueOnce(new Error('offline'));
    await expect(checkSharedSession()).resolves.toBeNull();
    expect(useSharedSessionStore.getState().shared).toBe(true);
  });

  it('reports operator activity at most every 30 seconds, only on an unlocked shared session; "Stay" always does', async () => {
    reportOperatorActivity();
    expect(mockGetCurrentSession).not.toHaveBeenCalled();

    await checkSharedSession();
    mockGetCurrentSession.mockClear();
    reportOperatorActivity();
    reportOperatorActivity();
    await Promise.resolve();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentSession).toHaveBeenCalledWith(true);

    reportOperatorActivity(true);
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(2);

    useSharedSessionStore.setState({ locked: true });
    reportOperatorActivity(true);
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(2);
  });

  it('locks the screen at once, stops the hubs, and takes the lock version from the server', async () => {
    await checkSharedSession();
    await lockSharedSession('explicit');

    expect(useSharedSessionStore.getState()).toMatchObject({ locked: true, lockVersion: 3 });
    expect(mockLockSession).toHaveBeenCalledTimes(1);
    expect(mockSignalR.disconnectUpdateHub).toHaveBeenCalled();
    expect(mockSignalR.disconnectGeolocationHub).toHaveBeenCalled();
    expect(mockSignalR.disconnectChatHub).toHaveBeenCalled();

    // Already locked: nothing more to ask.
    await lockSharedSession('background');
    expect(mockLockSession).toHaveBeenCalledTimes(1);
  });

  it('stays locked on screen when the lock does not reach the server', async () => {
    mockLockSession.mockRejectedValueOnce(new Error('offline'));
    await lockSharedSession('restart');
    expect(useSharedSessionStore.getState().locked).toBe(true);
  });

  it('lets go of a personal session the server will not lock', async () => {
    mockLockSession.mockRejectedValueOnce(problem(409, 'not_shared_session'));
    await lockSharedSession('restart');
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: false, locked: false });
  });

  it('does not lock when nobody is signed in', async () => {
    mockAuthState.status = 'signedOut';
    await lockSharedSession('background');
    expect(useSharedSessionStore.getState().locked).toBe(false);
    expect(mockLockSession).not.toHaveBeenCalled();
  });

  it('ends the shift on the server, then signs out; and signs out even when the server cannot be reached', async () => {
    await endSharedShift(true);
    expect(mockEndShift).toHaveBeenCalledWith(true);
    expect(mockLogout).toHaveBeenCalledTimes(1);

    mockEndShift.mockRejectedValueOnce(new Error('offline'));
    await endSharedShift(false);
    expect(mockEndShift).toHaveBeenLastCalledWith(false);
    expect(mockLogout).toHaveBeenCalledTimes(2);
  });

  it('after an unlock, runs the refresh that waited and reconnects the hubs', async () => {
    await afterSharedUnlock();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockSignalR.connectUpdateHub).toHaveBeenCalled();
    expect(mockSignalR.connectChatHub).toHaveBeenCalled();
  });
});
