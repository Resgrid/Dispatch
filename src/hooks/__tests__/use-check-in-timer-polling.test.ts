import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useCallsStore } from '@/stores/calls/store';

import { resetCheckInTimerPolling, useCheckInTimerPolling } from '../use-check-in-timer-polling';

/**
 * The check-in store is faked rather than stubbed because the behaviour under test is about
 * ownership handover: the call-detail screen and the console take the store's single interval from
 * each other, and the hook reacts to `_pollingOwner` moving. A bag of jest.fn()s would never emit
 * those transitions.
 */
const FAKE_INTERVAL = 1 as unknown as ReturnType<typeof setInterval>;

type MockOwner = 'call-detail' | 'console' | null;
type MockListener = (state: MockCheckInState, previousState: MockCheckInState) => void;

interface MockCheckInState {
  _pollingInterval: ReturnType<typeof setInterval> | null;
  _pollingOwner: MockOwner;
  fetchTimerStatusesForCalls: jest.Mock;
  startPollingForCalls: jest.Mock;
  startPolling: jest.Mock;
  stopPolling: jest.Mock;
  reset: jest.Mock;
}

const mockFetchTimerStatusesForCalls = jest.fn();
const mockStartPollingForCalls = jest.fn();
const mockStartPolling = jest.fn();
const mockStopPolling = jest.fn();
const mockReset = jest.fn();
const mockListeners = new Set<MockListener>();

let mockState: MockCheckInState;

const mockSetState = (patch: Partial<MockCheckInState>) => {
  const previousState = mockState;
  mockState = { ...mockState, ...patch };
  mockListeners.forEach((listener) => listener(mockState, previousState));
};

const mockBuildState = (): MockCheckInState => ({
  _pollingInterval: null,
  _pollingOwner: null,
  fetchTimerStatusesForCalls: mockFetchTimerStatusesForCalls,
  startPollingForCalls: mockStartPollingForCalls,
  startPolling: mockStartPolling,
  stopPolling: mockStopPolling,
  reset: mockReset,
});

mockState = mockBuildState();

let mockAuthStatus = 'signedIn';

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: jest.fn(),
}));

jest.mock('@/stores/checkIn/store', () => ({
  useCheckInStore: {
    getState: () => mockState,
    subscribe: (listener: MockListener) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => ({ status: mockAuthStatus }) },
}));

jest.mock('@/lib/utils', () => ({
  isCallActive: (state: number) => state === 1,
}));

const mockUseCallsStore = useCallsStore as unknown as jest.Mock;

/** `state: 1` is active per the isCallActive mock above; anything else is not. */
const setCalls = (calls: { CallId: string; State: number }[]) => {
  mockUseCallsStore.mockImplementation((selector: (s: unknown) => unknown) => selector({ calls }));
};

/** Stand-in for the call-detail check-in tab claiming the store's single interval. */
const callDetailTakesOver = () => {
  mockStartPolling();
  mockSetState({ _pollingInterval: FAKE_INTERVAL, _pollingOwner: 'call-detail' });
};

/** Stand-in for that tab unmounting: it stops the poll and then resets the store. */
const callDetailReleases = ({ withReset = true }: { withReset?: boolean } = {}) => {
  mockStopPolling();
  mockSetState({ _pollingInterval: null, _pollingOwner: null });
  if (withReset) {
    mockReset();
    mockSetState({ _pollingInterval: null, _pollingOwner: null });
  }
};

describe('useCheckInTimerPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockState = mockBuildState();
    mockAuthStatus = 'signedIn';
    resetCheckInTimerPolling();

    mockStartPollingForCalls.mockImplementation(() => {
      mockSetState({ _pollingInterval: FAKE_INTERVAL, _pollingOwner: 'console' });
    });
    mockStopPolling.mockImplementation(() => {
      mockSetState({ _pollingInterval: null, _pollingOwner: null });
    });

    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 1 },
    ]);
  });

  afterEach(() => {
    resetCheckInTimerPolling();
    mockListeners.clear();
  });

  it('starts a poll over the active call ids when enabled', () => {
    renderHook(() => useCheckInTimerPolling(true));

    expect(mockFetchTimerStatusesForCalls).toHaveBeenCalledWith([1, 2]);
    expect(mockStartPollingForCalls).toHaveBeenCalledWith([1, 2], 30000);
  });

  it('does not poll when the consumer is disabled', () => {
    renderHook(() => useCheckInTimerPolling(false));

    expect(mockStartPollingForCalls).not.toHaveBeenCalled();
    expect(mockFetchTimerStatusesForCalls).not.toHaveBeenCalled();
  });

  it('excludes calls that are not active', () => {
    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 4 },
      { CallId: '3', State: 1 },
    ]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(mockStartPollingForCalls).toHaveBeenCalledWith([1, 3], 30000);
  });

  it('ignores call ids that are not numeric', () => {
    setCalls([
      { CallId: 'call-1', State: 1 },
      { CallId: '7', State: 1 },
    ]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(mockStartPollingForCalls).toHaveBeenCalledWith([7], 30000);
  });

  it('does not start a poll when no active call has a usable id', () => {
    setCalls([{ CallId: 'call-1', State: 1 }]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(mockStartPollingForCalls).not.toHaveBeenCalled();
  });

  it('runs a single interval for two consumers', () => {
    renderHook(() => useCheckInTimerPolling(true));
    renderHook(() => useCheckInTimerPolling(true));

    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);
  });

  it('keeps polling while another consumer is still interested', () => {
    const first = renderHook(() => useCheckInTimerPolling(true));
    renderHook(() => useCheckInTimerPolling(true));

    first.unmount();

    expect(mockStopPolling).not.toHaveBeenCalled();
    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);
  });

  it('stops polling once the last consumer goes away', () => {
    const only = renderHook(() => useCheckInTimerPolling(true));

    only.unmount();

    expect(mockStopPolling).toHaveBeenCalledTimes(1);
  });

  it('restarts over the widened set when the active calls change', () => {
    const { rerender } = renderHook(() => useCheckInTimerPolling(true));

    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 1 },
      { CallId: '3', State: 1 },
    ]);
    rerender(undefined);

    expect(mockStartPollingForCalls).toHaveBeenLastCalledWith([1, 2, 3], 30000);
    expect(mockFetchTimerStatusesForCalls).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('does not restart when the same calls arrive in a new array', () => {
    const { rerender } = renderHook(() => useCheckInTimerPolling(true));

    setCalls([
      { CallId: '2', State: 1 },
      { CallId: '1', State: 1 },
    ]);
    rerender(undefined);

    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);
    expect(mockStopPolling).not.toHaveBeenCalled();
  });

  it('pauses in the background and refetches on return to the foreground', () => {
    let emit: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: AppStateStatus) => void) => {
      emit = handler;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    }) as typeof AppState.addEventListener);

    renderHook(() => useCheckInTimerPolling(true));
    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);

    emit?.('background');
    expect(mockStopPolling).toHaveBeenCalledTimes(1);
    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);

    emit?.('active');
    expect(mockStartPollingForCalls).toHaveBeenCalledTimes(2);
    expect(mockFetchTimerStatusesForCalls).toHaveBeenCalledTimes(2);

    addEventListener.mockRestore();
  });

  it('drops the app-state listener once the last consumer unmounts', () => {
    const remove = jest.fn();
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove }) as unknown as ReturnType<typeof AppState.addEventListener>) as typeof AppState.addEventListener);

    const only = renderHook(() => useCheckInTimerPolling(true));
    only.unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    addEventListener.mockRestore();
  });

  it('unsubscribes from the store once the last consumer unmounts', () => {
    const only = renderHook(() => useCheckInTimerPolling(true));
    expect(mockListeners.size).toBe(1);

    only.unmount();

    expect(mockListeners.size).toBe(0);
  });

  describe('shared interval handover', () => {
    it('yields the interval when the call-detail screen takes over', () => {
      renderHook(() => useCheckInTimerPolling(true));
      mockStopPolling.mockClear();

      callDetailTakesOver();

      // The detail screen's interval is not the console's to cancel.
      expect(mockStopPolling).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBe('call-detail');
    });

    it('reclaims the interval when the call-detail screen releases it', () => {
      renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();
      mockStartPollingForCalls.mockClear();
      mockFetchTimerStatusesForCalls.mockClear();

      callDetailReleases();

      expect(mockStartPollingForCalls).toHaveBeenCalledWith([1, 2], 30000);
      expect(mockFetchTimerStatusesForCalls).toHaveBeenCalledWith([1, 2]);
      expect(mockState._pollingOwner).toBe('console');
      expect(mockState._pollingInterval).toBe(FAKE_INTERVAL);
    });

    it('reclaims even though the release is followed by a store reset', () => {
      renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();

      // `stopPolling()` then `reset()` — the detail tab's cleanup order. The reset clears the
      // interval the console just took back, so the console has to notice a second time.
      callDetailReleases({ withReset: true });

      expect(mockState._pollingOwner).toBe('console');
      expect(mockState._pollingInterval).toBe(FAKE_INTERVAL);
    });

    it('leaves the console polling after a takeover and release cycle with two consumers', () => {
      renderHook(() => useCheckInTimerPolling(true));
      renderHook(() => useCheckInTimerPolling(true));

      callDetailTakesOver();
      callDetailReleases();

      expect(mockState._pollingOwner).toBe('console');
      expect(mockStartPollingForCalls).toHaveBeenLastCalledWith([1, 2], 30000);
    });

    it('does not reclaim the interval after sign-out teardown', () => {
      renderHook(() => useCheckInTimerPolling(true));
      mockStartPollingForCalls.mockClear();
      mockFetchTimerStatusesForCalls.mockClear();

      // teardownSignedInSession() stops the poll through the same action the detail screen uses.
      mockAuthStatus = 'signedOut';
      mockStopPolling();
      mockSetState({ _pollingInterval: null, _pollingOwner: null });

      expect(mockStartPollingForCalls).not.toHaveBeenCalled();
      expect(mockFetchTimerStatusesForCalls).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBeNull();
      expect(mockState._pollingInterval).toBeNull();
    });

    it('does not reclaim the interval when the call-detail screen releases while signed out', () => {
      renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();
      mockStartPollingForCalls.mockClear();

      mockAuthStatus = 'signedOut';
      callDetailReleases();

      expect(mockStartPollingForCalls).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBeNull();
    });

    it('stops nothing on unmount when another screen owns the interval', () => {
      const only = renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();
      mockStopPolling.mockClear();

      only.unmount();

      expect(mockStopPolling).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBe('call-detail');
    });

    it('does not take the interval back when the app returns to the foreground mid-visit', () => {
      let emit: ((state: AppStateStatus) => void) | undefined;
      const remove = jest.fn();
      const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: AppStateStatus) => void) => {
        emit = handler;
        return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
      }) as typeof AppState.addEventListener);

      renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();

      // The console stays mounted underneath the detail screen, so it still sees the app leave and
      // come back. Resuming used to restart its own poll, which clears the detail screen's interval.
      emit?.('background');
      emit?.('active');

      expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);
      expect(mockStopPolling).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBe('call-detail');
      expect(mockState._pollingInterval).toBe(FAKE_INTERVAL);

      addEventListener.mockRestore();
    });

    it('does not take the interval back when the active calls change mid-visit', () => {
      const { rerender } = renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();

      // A SignalR refresh adding a call widens the desired set, which is normally a restart.
      setCalls([
        { CallId: '1', State: 1 },
        { CallId: '2', State: 1 },
        { CallId: '3', State: 1 },
      ]);
      rerender(undefined);

      expect(mockStartPollingForCalls).toHaveBeenCalledTimes(1);
      expect(mockFetchTimerStatusesForCalls).toHaveBeenCalledTimes(1);
      expect(mockState._pollingOwner).toBe('call-detail');
      expect(mockState._pollingInterval).toBe(FAKE_INTERVAL);
    });

    it('reclaims over the set that changed while the call-detail screen held the interval', () => {
      const { rerender } = renderHook(() => useCheckInTimerPolling(true));
      callDetailTakesOver();

      setCalls([
        { CallId: '1', State: 1 },
        { CallId: '2', State: 1 },
        { CallId: '3', State: 1 },
      ]);
      rerender(undefined);
      callDetailReleases();

      // Deferring the restart must not lose it: the hand-back polls the widened set, not the stale one.
      expect(mockStartPollingForCalls).toHaveBeenLastCalledWith([1, 2, 3], 30000);
      expect(mockFetchTimerStatusesForCalls).toHaveBeenLastCalledWith([1, 2, 3]);
      expect(mockState._pollingOwner).toBe('console');
    });

    it('does not take an interval the call-detail screen already owns when a consumer mounts', () => {
      // Opening a call first and only then expanding a console panel: the takeover predates the
      // owner subscription, so nothing told the hook to give up a claim it never made.
      callDetailTakesOver();

      renderHook(() => useCheckInTimerPolling(true));

      expect(mockStartPollingForCalls).not.toHaveBeenCalled();
      expect(mockFetchTimerStatusesForCalls).not.toHaveBeenCalled();
      expect(mockState._pollingOwner).toBe('call-detail');

      callDetailReleases();

      expect(mockStartPollingForCalls).toHaveBeenCalledWith([1, 2], 30000);
      expect(mockState._pollingOwner).toBe('console');
    });
  });
});
