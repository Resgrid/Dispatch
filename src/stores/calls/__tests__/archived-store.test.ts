import { act } from '@testing-library/react-native';

import { getArchivedCalls, getCallYears } from '@/api/calls/calls';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { useArchivedCallsStore } from '../archived-store';

jest.mock('@/api/calls/calls', () => ({
  getArchivedCalls: jest.fn(),
  getCallYears: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetCallYears = getCallYears as jest.MockedFunction<typeof getCallYears>;
const mockGetArchivedCalls = getArchivedCalls as jest.MockedFunction<typeof getArchivedCalls>;

const archivedCall = (callId: string): CallResultData => ({ CallId: callId, Number: `26-${callId}`, Name: 'Fire', State: 1 }) as CallResultData;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('useArchivedCallsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useArchivedCallsStore.getState().reset();
  });

  it('loads the years and then the newest year with calls', async () => {
    mockGetCallYears.mockResolvedValueOnce({ Data: ['2026', '2025'], Status: 'Success' } as never);
    mockGetArchivedCalls.mockResolvedValueOnce({ Data: [archivedCall('1'), archivedCall('2')], Status: 'Success' } as never);

    await act(async () => {
      await useArchivedCallsStore.getState().load();
    });

    const state = useArchivedCallsStore.getState();
    expect(mockGetArchivedCalls).toHaveBeenCalledWith('2026');
    expect(state.years).toEqual(['2026', '2025']);
    expect(state.selectedYear).toBe('2026');
    expect(state.archivedCalls.map((c) => c.CallId)).toEqual(['1', '2']);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('falls back to the current year when the department has no calls', async () => {
    mockGetCallYears.mockResolvedValueOnce({ Data: undefined, Status: 'NotFound' } as never);
    mockGetArchivedCalls.mockResolvedValueOnce({ Data: undefined, Status: 'NotFound' } as never);

    await act(async () => {
      await useArchivedCallsStore.getState().load();
    });

    const year = String(new Date().getFullYear());
    expect(useArchivedCallsStore.getState().selectedYear).toBe(year);
    expect(useArchivedCallsStore.getState().years).toEqual([year]);
    expect(useArchivedCallsStore.getState().archivedCalls).toEqual([]);
  });

  it('keeps the selected year across loads while it is still listed', async () => {
    useArchivedCallsStore.setState({ selectedYear: '2025' });
    mockGetCallYears.mockResolvedValueOnce({ Data: ['2026', '2025'], Status: 'Success' } as never);
    mockGetArchivedCalls.mockResolvedValueOnce({ Data: [], Status: 'Success' } as never);

    await act(async () => {
      await useArchivedCallsStore.getState().load();
    });

    expect(mockGetArchivedCalls).toHaveBeenCalledWith('2025');
  });

  it('opens on the year showYear picked, for the call just added', async () => {
    useArchivedCallsStore.getState().showYear('2019');
    mockGetCallYears.mockResolvedValueOnce({ Data: ['2026', '2019'], Status: 'Success' } as never);
    mockGetArchivedCalls.mockResolvedValueOnce({ Data: [archivedCall('7')], Status: 'Success' } as never);

    await act(async () => {
      await useArchivedCallsStore.getState().load();
    });

    expect(mockGetArchivedCalls).toHaveBeenCalledWith('2019');
    expect(useArchivedCallsStore.getState().archivedCalls.map((c) => c.CallId)).toEqual(['7']);
  });

  it('marks the year already showing for a reload when a call is added to it', () => {
    useArchivedCallsStore.setState({ selectedYear: '2026', years: ['2026', '2025'], archivedCalls: [archivedCall('1')], lastFetched: Date.now() });

    useArchivedCallsStore.getState().showYear('2026');

    const state = useArchivedCallsStore.getState();
    expect(state.selectedYear).toBe('2026');
    expect(state.lastFetched).toBe(0);
    // Its rows stay up until the reload replaces them.
    expect(state.archivedCalls.map((c) => c.CallId)).toEqual(['1']);
  });

  it("drops another year's rows when showYear moves to a different year", () => {
    useArchivedCallsStore.setState({ selectedYear: '2026', years: ['2026', '2025'], archivedCalls: [archivedCall('1')], lastFetched: Date.now() });

    useArchivedCallsStore.getState().showYear('2019');

    const state = useArchivedCallsStore.getState();
    expect(state.selectedYear).toBe('2019');
    expect(state.years).toEqual(['2026', '2025', '2019']);
    expect(state.archivedCalls).toEqual([]);
    expect(state.lastFetched).toBe(0);
  });

  it('reports a failed year lookup without loading calls', async () => {
    mockGetCallYears.mockRejectedValueOnce(new Error('Network down'));

    await act(async () => {
      await useArchivedCallsStore.getState().load();
    });

    expect(mockGetArchivedCalls).not.toHaveBeenCalled();
    expect(useArchivedCallsStore.getState().error).toBe('Network down');
    expect(useArchivedCallsStore.getState().isLoading).toBe(false);
  });

  it('keeps the rows and reports the error when a refresh fails', async () => {
    useArchivedCallsStore.setState({ selectedYear: '2026', archivedCalls: [archivedCall('1')] });
    mockGetArchivedCalls.mockRejectedValueOnce(new Error('Server error'));

    await act(async () => {
      await useArchivedCallsStore.getState().fetchArchivedCalls();
    });

    expect(useArchivedCallsStore.getState().archivedCalls.map((c) => c.CallId)).toEqual(['1']);
    expect(useArchivedCallsStore.getState().error).toBe('Server error');
  });

  it("never shows an older year's calls after a quicker switch to another year", async () => {
    useArchivedCallsStore.setState({ selectedYear: '2026', years: ['2026', '2025', '2024'], lastFetched: 1 });
    const slow = deferred<unknown>();
    mockGetArchivedCalls.mockReturnValueOnce(slow.promise as never).mockResolvedValueOnce({ Data: [archivedCall('24')], Status: 'Success' } as never);

    let first!: Promise<void>;
    await act(async () => {
      first = useArchivedCallsStore.getState().selectYear('2025');
      await useArchivedCallsStore.getState().selectYear('2024');
    });
    await act(async () => {
      slow.resolve({ Data: [archivedCall('25')], Status: 'Success' });
      await first;
    });

    expect(useArchivedCallsStore.getState().selectedYear).toBe('2024');
    expect(useArchivedCallsStore.getState().archivedCalls.map((c) => c.CallId)).toEqual(['24']);
    expect(useArchivedCallsStore.getState().isLoading).toBe(false);
  });

  it('clears the previous year while the selected one loads', async () => {
    useArchivedCallsStore.setState({ selectedYear: '2026', years: ['2026', '2025'], archivedCalls: [archivedCall('1')], lastFetched: 1 });
    const pending = deferred<unknown>();
    mockGetArchivedCalls.mockReturnValueOnce(pending.promise as never);

    let switching!: Promise<void>;
    act(() => {
      switching = useArchivedCallsStore.getState().selectYear('2025');
    });

    expect(useArchivedCallsStore.getState().archivedCalls).toEqual([]);
    expect(useArchivedCallsStore.getState().isLoading).toBe(true);

    await act(async () => {
      pending.resolve({ Data: [archivedCall('2')], Status: 'Success' });
      await switching;
    });
  });
});
