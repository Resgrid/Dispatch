import { act } from '@testing-library/react-native';

import { getPendingCalls, getPendingScheduledCalls } from '@/api/calls/calls';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { refreshQueuedCallLists, usePendingCallsStore } from '../pending-store';
import { useScheduledCallsStore } from '../scheduled-store';

jest.mock('@/api/calls/calls', () => ({
  getPendingCalls: jest.fn(),
  getPendingScheduledCalls: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('../store', () => ({
  useCallsStore: { getState: () => ({ callPriorities: [{ Id: 2, Name: 'High', Color: '#f00' }] }) },
}));

const mockGetPendingCalls = getPendingCalls as jest.MockedFunction<typeof getPendingCalls>;
const mockGetScheduledCalls = getPendingScheduledCalls as jest.MockedFunction<typeof getPendingScheduledCalls>;

const pendingCall = (callId: string): CallResultData => ({ CallId: callId, Number: `26-${callId}`, Name: 'Follow-up', State: 8 }) as CallResultData;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('usePendingCallsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePendingCallsStore.getState().reset();
    useScheduledCallsStore.getState().reset();
  });

  it('loads the pending calls', async () => {
    mockGetPendingCalls.mockResolvedValueOnce({ Data: [pendingCall('1'), pendingCall('2')], Status: 'Success' } as never);

    await act(async () => {
      await usePendingCallsStore.getState().fetchPendingCalls();
    });

    const state = usePendingCallsStore.getState();
    expect(state.pendingCalls.map((c) => c.CallId)).toEqual(['1', '2']);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastFetched).toBeGreaterThan(0);
  });

  it('treats a NotFound answer with no data as an empty list', async () => {
    usePendingCallsStore.setState({ pendingCalls: [pendingCall('1')] });
    mockGetPendingCalls.mockResolvedValueOnce({ Data: undefined, Status: 'NotFound' } as never);

    await act(async () => {
      await usePendingCallsStore.getState().fetchPendingCalls();
    });

    expect(usePendingCallsStore.getState().pendingCalls).toEqual([]);
    expect(usePendingCallsStore.getState().error).toBeNull();
  });

  it('keeps the last list and records the error when the request fails', async () => {
    usePendingCallsStore.setState({ pendingCalls: [pendingCall('1')] });
    mockGetPendingCalls.mockRejectedValueOnce(new Error('Network Error'));

    await act(async () => {
      await usePendingCallsStore.getState().fetchPendingCalls();
    });

    const state = usePendingCallsStore.getState();
    expect(state.pendingCalls.map((c) => c.CallId)).toEqual(['1']);
    expect(state.error).toBe('Network Error');
    expect(state.isLoading).toBe(false);
  });

  it('collapses a burst of refreshes into the in-flight request plus one trailing request', async () => {
    const first = deferred<never>();
    mockGetPendingCalls.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ Data: [pendingCall('2')] } as never);

    let burst!: Promise<unknown>;
    await act(async () => {
      const fetchPendingCalls = usePendingCallsStore.getState().fetchPendingCalls;
      burst = Promise.all([fetchPendingCalls(), fetchPendingCalls(), fetchPendingCalls(), fetchPendingCalls()]);
      first.resolve({ Data: [pendingCall('1')] } as never);
      await burst;
    });

    expect(mockGetPendingCalls).toHaveBeenCalledTimes(2);
    // The trailing request answers last, so a change saved mid-flight is what stays on screen.
    expect(usePendingCallsStore.getState().pendingCalls.map((c) => c.CallId)).toEqual(['2']);
  });

  it('looks up a call priority from the calls store', () => {
    expect(usePendingCallsStore.getState().getPriorityForCall(2)?.Name).toBe('High');
    expect(usePendingCallsStore.getState().getPriorityForCall(99)).toBeUndefined();
  });
});

describe('refreshQueuedCallLists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePendingCallsStore.getState().reset();
    useScheduledCallsStore.getState().reset();
    mockGetPendingCalls.mockResolvedValue({ Data: [] } as never);
    mockGetScheduledCalls.mockResolvedValue({ Data: [] } as never);
  });

  it('refreshes the pending list but leaves an unloaded scheduled list alone', async () => {
    await act(async () => {
      refreshQueuedCallLists();
      await Promise.resolve();
    });

    expect(mockGetPendingCalls).toHaveBeenCalledTimes(1);
    expect(mockGetScheduledCalls).not.toHaveBeenCalled();
  });

  it('also refreshes the scheduled list once something has loaded it', async () => {
    useScheduledCallsStore.setState({ lastFetched: Date.now() });

    await act(async () => {
      refreshQueuedCallLists();
      await Promise.resolve();
    });

    expect(mockGetPendingCalls).toHaveBeenCalledTimes(1);
    expect(mockGetScheduledCalls).toHaveBeenCalledTimes(1);
  });
});
