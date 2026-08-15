import { act, renderHook } from '@testing-library/react-native';

import { getDispatchRecommendation } from '@/api/runcards/runcards';
import { useCallRecommendation } from '@/components/runcards/use-call-recommendation';
import { useRunCardsStore } from '@/stores/runcards/store';

jest.mock('@/api/runcards/runcards', () => ({
  getDispatchRecommendation: jest.fn(),
  escalateCall: jest.fn(),
}));

jest.mock('@/stores/feature-flags/store', () => ({
  isRunCardsEnabled: jest.fn(() => true),
  useIsRunCardsEnabled: jest.fn(() => true),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedGetRecommendation = getDispatchRecommendation as jest.Mock;

const callPriorities = [{ Id: 1, Name: 'High' }];

const args = (overrides: Partial<Parameters<typeof useCallRecommendation>[0]> = {}) => ({
  priorityName: 'High',
  typeName: 'Structure Fire',
  latitude: 51.1,
  longitude: 3.8,
  callPriorities,
  ...overrides,
});

/** Past the store's 600 ms debounce, and flushing the fetch promise the timer starts. */
const runDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
};

describe('useCallRecommendation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedGetRecommendation.mockResolvedValue({ MatchedRunCardId: 3, Units: [], Personnel: [] });
    useRunCardsStore.getState().clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels a pending lookup when the inputs stop being requestable', async () => {
    // Clearing the call type mid-debounce must not let the timer fire with the priority and type
    // the dispatcher just removed.
    const { rerender } = renderHook((props: Parameters<typeof useCallRecommendation>[0]) => useCallRecommendation(props), { initialProps: args() });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockedGetRecommendation).not.toHaveBeenCalled();

    rerender(args({ typeName: '' }));
    await runDebounce();

    expect(mockedGetRecommendation).not.toHaveBeenCalled();
  });

  it('drops a recommendation already on screen once the inputs stop being requestable', async () => {
    const { result, rerender } = renderHook((props: Parameters<typeof useCallRecommendation>[0]) => useCallRecommendation(props), { initialProps: args() });

    await runDebounce();
    expect(result.current.recommendation).not.toBeNull();

    rerender(args({ priorityName: null }));

    expect(result.current.recommendation).toBeNull();
    expect(result.current.hasFetched).toBe(false);
  });

  it('replaces a pending lookup when the inputs change but stay requestable', async () => {
    const { rerender } = renderHook((props: Parameters<typeof useCallRecommendation>[0]) => useCallRecommendation(props), { initialProps: args() });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    rerender(args({ typeName: 'Medical' }));
    await runDebounce();

    expect(mockedGetRecommendation).toHaveBeenCalledTimes(1);
    expect(mockedGetRecommendation).toHaveBeenCalledWith(expect.objectContaining({ type: 'Medical', priority: 1 }), expect.anything());
  });
});
