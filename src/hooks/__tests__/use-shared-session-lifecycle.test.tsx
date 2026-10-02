import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { checkSharedSession, lockSharedSession, reportOperatorActivity, stopRealtime } from '@/lib/shared-session/controller';
import { noteSessionRestoredAtLaunch, resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

import { useSharedSessionLifecycle } from '../use-shared-session-lifecycle';

let mockAppState = 'active';
let mockSharedInstallation = false;

jest.mock('../use-app-lifecycle', () => ({ useAppLifecycle: () => ({ appState: mockAppState, isActive: mockAppState === 'active' }) }));
jest.mock('@/lib/mfa/shared-installation', () => ({ isSharedInstallation: () => mockSharedInstallation }));
jest.mock('@/lib/shared-session/controller', () => ({
  POLL_INTERVAL_MS: 60000,
  checkSharedSession: jest.fn(async () => null),
  lockSharedSession: jest.fn(async () => undefined),
  reportOperatorActivity: jest.fn(),
  stopRealtime: jest.fn(async () => undefined),
}));

const shared = (overrides: Record<string, unknown> = {}) => ({ Shared: true, Locked: false, LockVersion: 1, ...overrides });
const flush = () => act(async () => undefined);

describe('useSharedSessionLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSharedSession();
    mockAppState = 'active';
    mockSharedInstallation = false;
    Platform.OS = 'ios';
  });

  it('asks the server at sign-in, and does not lock a session signed in during this run', async () => {
    (checkSharedSession as jest.Mock).mockResolvedValue(shared());
    renderHook(() => useSharedSessionLifecycle(true));
    await flush();
    expect(checkSharedSession).toHaveBeenCalledWith();
    expect(lockSharedSession).not.toHaveBeenCalled();
  });

  it('locks a shared session restored at launch', async () => {
    noteSessionRestoredAtLaunch();
    (checkSharedSession as jest.Mock).mockResolvedValue(shared());
    renderHook(() => useSharedSessionLifecycle(true));
    await flush();
    expect(lockSharedSession).toHaveBeenCalledWith('restart');
  });

  it('leaves a restored personal session alone', async () => {
    noteSessionRestoredAtLaunch();
    (checkSharedSession as jest.Mock).mockResolvedValue(shared({ Shared: false }));
    renderHook(() => useSharedSessionLifecycle(true));
    await flush();
    expect(lockSharedSession).not.toHaveBeenCalled();
  });

  it('locks a restored session on a shared installation without asking for a status first', async () => {
    noteSessionRestoredAtLaunch();
    mockSharedInstallation = true;
    renderHook(() => useSharedSessionLifecycle(true));
    await flush();
    expect(lockSharedSession).toHaveBeenCalledWith('restart');
    expect(checkSharedSession).not.toHaveBeenCalled();
  });

  it('locks when the app goes to the background, only for a shared, unlocked session', async () => {
    const { rerender } = renderHook(() => useSharedSessionLifecycle(true));
    await flush();

    mockAppState = 'background';
    rerender({});
    expect(lockSharedSession).not.toHaveBeenCalled();

    act(() => useSharedSessionStore.setState({ shared: true, locked: false }));
    mockAppState = 'active';
    rerender({});
    mockAppState = 'background';
    rerender({});
    expect(lockSharedSession).toHaveBeenCalledWith('background');
  });

  it('stops the hubs whenever the session is locked', async () => {
    renderHook(() => useSharedSessionLifecycle(true));
    await flush();
    act(() => useSharedSessionStore.setState({ shared: true, locked: true }));
    expect(stopRealtime).toHaveBeenCalled();
  });

  it('polls the server every minute and at the idle deadline, never as activity', async () => {
    jest.useFakeTimers();
    try {
      renderHook(() => useSharedSessionLifecycle(true));
      await flush();
      (checkSharedSession as jest.Mock).mockClear();

      act(() => useSharedSessionStore.setState({ shared: true, locked: false, checkedAt: Date.now(), idleLocksAt: Date.now() + 5000 }));
      act(() => jest.advanceTimersByTime(3000));
      expect(checkSharedSession).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(3000));
      expect(checkSharedSession).toHaveBeenCalledWith(false);

      (checkSharedSession as jest.Mock).mockClear();
      act(() => useSharedSessionStore.setState({ idleLocksAt: Date.now() + 3600000, checkedAt: Date.now() }));
      act(() => jest.advanceTimersByTime(61000));
      expect(checkSharedSession).toHaveBeenCalledWith(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports touches as activity without claiming them', () => {
    const { result } = renderHook(() => useSharedSessionLifecycle(true));
    expect(result.current.onTouchCapture()).toBe(false);
    expect(reportOperatorActivity).toHaveBeenCalledTimes(1);
  });

  it('does nothing while signed out', async () => {
    noteSessionRestoredAtLaunch();
    const { result } = renderHook(() => useSharedSessionLifecycle(false));
    await flush();
    expect(checkSharedSession).not.toHaveBeenCalled();
    expect(result.current.locked).toBe(false);
  });
});
