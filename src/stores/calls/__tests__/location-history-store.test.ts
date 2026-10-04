import { act } from '@testing-library/react-native';

import { getCallLocationHistory } from '@/api/calls/callLocationHistory';
import { getContactCallHistory } from '@/api/contacts/contactCallHistory';
import { type LocationHistoryData } from '@/models/v4/calls/locationHistoryResult';

import { locationHistoryKey, useLocationHistoryStore } from '../location-history-store';

jest.mock('@/api/calls/callLocationHistory', () => ({ getCallLocationHistory: jest.fn() }));
jest.mock('@/api/contacts/contactCallHistory', () => ({ getContactCallHistory: jest.fn() }));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCallHistory = getCallLocationHistory as jest.MockedFunction<typeof getCallLocationHistory>;
const mockContactHistory = getContactCallHistory as jest.MockedFunction<typeof getContactCallHistory>;

const history = (callIds: string[]): LocationHistoryData => ({
  AddressMatchingAvailable: true,
  IndexComplete: true,
  HasMore: false,
  IsProtected: false,
  Calls: callIds.map((id) => ({ CallId: id, Number: id, Name: 'Call ' + id, Priority: 0, State: 1, LoggedOnUtc: '2026-10-01T10:00:00Z', Matches: ['SameAddress'], Notes: [] })),
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('useLocationHistoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationHistoryStore.setState({ entries: {} });
  });

  it('keys entries by source so a call and a contact panel do not overwrite each other', async () => {
    mockCallHistory.mockResolvedValueOnce({ Data: history(['1']) } as never);
    mockContactHistory.mockResolvedValueOnce({ Data: history(['2', '3']) } as never);

    await act(async () => {
      await useLocationHistoryStore.getState().fetchHistory({ kind: 'call', id: '42' });
      await useLocationHistoryStore.getState().fetchHistory({ kind: 'contact', id: 'c1' });
    });

    const { entries } = useLocationHistoryStore.getState();
    expect(entries[locationHistoryKey({ kind: 'call', id: '42' })].history?.Calls).toHaveLength(1);
    expect(entries[locationHistoryKey({ kind: 'contact', id: 'c1' })].history?.Calls).toHaveLength(2);
    expect(mockCallHistory).toHaveBeenCalledWith('42');
    expect(mockContactHistory).toHaveBeenCalledWith('c1');
  });

  it('drops a stale response when a newer request for the same source has started', async () => {
    const first = deferred<never>();
    mockCallHistory.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ Data: history(['new']) } as never);

    let firstRequest!: Promise<void>;
    await act(async () => {
      firstRequest = useLocationHistoryStore.getState().fetchHistory({ kind: 'call', id: '42' });
      await useLocationHistoryStore.getState().fetchHistory({ kind: 'call', id: '42' });
    });
    await act(async () => {
      first.resolve({ Data: history(['old']) } as never);
      await firstRequest;
    });

    expect(useLocationHistoryStore.getState().entries['call:42'].history?.Calls[0].CallId).toBe('new');
  });

  it('records an error and clears the history when the request fails', async () => {
    mockCallHistory.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await useLocationHistoryStore.getState().fetchHistory({ kind: 'call', id: '42' });
    });

    expect(useLocationHistoryStore.getState().entries['call:42']).toEqual({ history: null, isLoading: false, error: 'boom' });
  });

  it('clear removes the entry and ignores a response still in flight', async () => {
    const pending = deferred<never>();
    mockCallHistory.mockReturnValueOnce(pending.promise);

    let request!: Promise<void>;
    act(() => {
      request = useLocationHistoryStore.getState().fetchHistory({ kind: 'call', id: '42' });
    });
    act(() => {
      useLocationHistoryStore.getState().clear({ kind: 'call', id: '42' });
    });
    await act(async () => {
      pending.resolve({ Data: history(['late']) } as never);
      await request;
    });

    expect(useLocationHistoryStore.getState().entries['call:42']).toBeUndefined();
  });
});
