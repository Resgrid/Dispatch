import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getCallSiteInfo } from '@/api/calls/callSiteInfo';
import { type CallSiteInfoData } from '@/models/v4/calls/callSiteInfoResult';

import { useSiteInfoStore } from '../site-info-store';

jest.mock('@/api/calls/callSiteInfo');
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetCallSiteInfo = getCallSiteInfo as jest.MockedFunction<typeof getCallSiteInfo>;

const makeSiteInfo = (callId: string): CallSiteInfoData => ({
  CallId: callId,
  IsProtected: false,
  Contacts: [
    {
      ContactId: 'c1',
      CallContactType: 0,
      ContactType: 1,
      Name: 'Acme Warehouse',
      PhoneNumber: '5551234',
      EntranceGpsCoordinates: null,
      AlertNotes: [],
      Preplan: null,
      Hazards: [],
      Attachments: [],
    },
  ],
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('useSiteInfoStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSiteInfoStore.getState().reset();
  });

  it('starts empty', () => {
    const state = useSiteInfoStore.getState();
    expect(state.callId).toBeNull();
    expect(state.siteInfo).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetches and stores the site info for a call', async () => {
    mockGetCallSiteInfo.mockResolvedValue({ Data: makeSiteInfo('42') } as any);

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    const state = useSiteInfoStore.getState();
    expect(mockGetCallSiteInfo).toHaveBeenCalledWith('42');
    expect(state.callId).toBe('42');
    expect(state.siteInfo?.Contacts).toHaveLength(1);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('stores null site info when the server returns no Data', async () => {
    mockGetCallSiteInfo.mockResolvedValue({ Data: undefined } as any);

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    expect(useSiteInfoStore.getState().siteInfo).toBeNull();
    expect(useSiteInfoStore.getState().isLoading).toBe(false);
  });

  it('records the error message and clears loading on failure', async () => {
    mockGetCallSiteInfo.mockRejectedValue(new Error('Network Error'));

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    const state = useSiteInfoStore.getState();
    expect(state.error).toBe('Network Error');
    expect(state.siteInfo).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('ignores a stale response after a different call is requested', async () => {
    const first = deferred<any>();
    mockGetCallSiteInfo.mockImplementationOnce(() => first.promise);
    mockGetCallSiteInfo.mockResolvedValueOnce({ Data: makeSiteInfo('43') } as any);

    const firstFetch = useSiteInfoStore.getState().fetchSiteInfo('42');
    await useSiteInfoStore.getState().fetchSiteInfo('43');

    first.resolve({ Data: makeSiteInfo('42') });
    await firstFetch;

    const state = useSiteInfoStore.getState();
    expect(state.callId).toBe('43');
    expect(state.siteInfo?.CallId).toBe('43');
  });

  it('ignores a stale error after a different call is requested', async () => {
    const first = deferred<any>();
    mockGetCallSiteInfo.mockImplementationOnce(() => first.promise);
    mockGetCallSiteInfo.mockResolvedValueOnce({ Data: makeSiteInfo('43') } as any);

    const firstFetch = useSiteInfoStore.getState().fetchSiteInfo('42');
    await useSiteInfoStore.getState().fetchSiteInfo('43');

    first.resolve(Promise.reject(new Error('late failure')));
    await firstFetch;

    expect(useSiteInfoStore.getState().error).toBeNull();
    expect(useSiteInfoStore.getState().siteInfo?.CallId).toBe('43');
  });

  it('reset clears everything', async () => {
    mockGetCallSiteInfo.mockResolvedValue({ Data: makeSiteInfo('42') } as any);
    await useSiteInfoStore.getState().fetchSiteInfo('42');

    useSiteInfoStore.getState().reset();

    const state = useSiteInfoStore.getState();
    expect(state.callId).toBeNull();
    expect(state.siteInfo).toBeNull();
    expect(state.error).toBeNull();
  });
});
