import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useCallsStore } from '@/stores/calls/store';
import { useCheckInStore } from '@/stores/checkIn/store';

import { resetCheckInTimerPolling, useCheckInTimerPolling } from '../use-check-in-timer-polling';

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: jest.fn(),
}));

jest.mock('@/stores/checkIn/store', () => ({
  useCheckInStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/lib/utils', () => ({
  isCallActive: (state: number) => state === 1,
}));

const mockUseCallsStore = useCallsStore as unknown as jest.Mock;
const mockGetState = (useCheckInStore as unknown as { getState: jest.Mock }).getState;

const fetchTimerStatusesForCalls = jest.fn();
const startPollingForCalls = jest.fn();
const stopPolling = jest.fn();

/** `state: 1` is active per the isCallActive mock above; anything else is not. */
const setCalls = (calls: { CallId: string; State: number }[]) => {
  mockUseCallsStore.mockImplementation((selector: (s: unknown) => unknown) => selector({ calls }));
};

describe('useCheckInTimerPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCheckInTimerPolling();
    mockGetState.mockReturnValue({ fetchTimerStatusesForCalls, startPollingForCalls, stopPolling });
    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 1 },
    ]);
  });

  afterEach(() => {
    resetCheckInTimerPolling();
  });

  it('starts a poll over the active call ids when enabled', () => {
    renderHook(() => useCheckInTimerPolling(true));

    expect(fetchTimerStatusesForCalls).toHaveBeenCalledWith([1, 2]);
    expect(startPollingForCalls).toHaveBeenCalledWith([1, 2], 30000);
  });

  it('does not poll when the consumer is disabled', () => {
    renderHook(() => useCheckInTimerPolling(false));

    expect(startPollingForCalls).not.toHaveBeenCalled();
    expect(fetchTimerStatusesForCalls).not.toHaveBeenCalled();
  });

  it('excludes calls that are not active', () => {
    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 4 },
      { CallId: '3', State: 1 },
    ]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(startPollingForCalls).toHaveBeenCalledWith([1, 3], 30000);
  });

  it('ignores call ids that are not numeric', () => {
    setCalls([
      { CallId: 'call-1', State: 1 },
      { CallId: '7', State: 1 },
    ]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(startPollingForCalls).toHaveBeenCalledWith([7], 30000);
  });

  it('does not start a poll when no active call has a usable id', () => {
    setCalls([{ CallId: 'call-1', State: 1 }]);

    renderHook(() => useCheckInTimerPolling(true));

    expect(startPollingForCalls).not.toHaveBeenCalled();
  });

  it('runs a single interval for two consumers', () => {
    renderHook(() => useCheckInTimerPolling(true));
    renderHook(() => useCheckInTimerPolling(true));

    expect(startPollingForCalls).toHaveBeenCalledTimes(1);
  });

  it('keeps polling while another consumer is still interested', () => {
    const first = renderHook(() => useCheckInTimerPolling(true));
    renderHook(() => useCheckInTimerPolling(true));

    first.unmount();

    expect(stopPolling).not.toHaveBeenCalled();
    expect(startPollingForCalls).toHaveBeenCalledTimes(1);
  });

  it('stops polling once the last consumer goes away', () => {
    const only = renderHook(() => useCheckInTimerPolling(true));

    only.unmount();

    expect(stopPolling).toHaveBeenCalledTimes(1);
  });

  it('restarts over the widened set when the active calls change', () => {
    const { rerender } = renderHook(() => useCheckInTimerPolling(true));

    setCalls([
      { CallId: '1', State: 1 },
      { CallId: '2', State: 1 },
      { CallId: '3', State: 1 },
    ]);
    rerender(undefined);

    expect(startPollingForCalls).toHaveBeenLastCalledWith([1, 2, 3], 30000);
    expect(fetchTimerStatusesForCalls).toHaveBeenLastCalledWith([1, 2, 3]);
  });

  it('does not restart when the same calls arrive in a new array', () => {
    const { rerender } = renderHook(() => useCheckInTimerPolling(true));

    setCalls([
      { CallId: '2', State: 1 },
      { CallId: '1', State: 1 },
    ]);
    rerender(undefined);

    expect(startPollingForCalls).toHaveBeenCalledTimes(1);
    expect(stopPolling).not.toHaveBeenCalled();
  });

  it('pauses in the background and refetches on return to the foreground', () => {
    let emit: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: AppStateStatus) => void) => {
      emit = handler;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    }) as typeof AppState.addEventListener);

    renderHook(() => useCheckInTimerPolling(true));
    expect(startPollingForCalls).toHaveBeenCalledTimes(1);

    emit?.('background');
    expect(stopPolling).toHaveBeenCalledTimes(1);
    expect(startPollingForCalls).toHaveBeenCalledTimes(1);

    emit?.('active');
    expect(startPollingForCalls).toHaveBeenCalledTimes(2);
    expect(fetchTimerStatusesForCalls).toHaveBeenCalledTimes(2);

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
});
