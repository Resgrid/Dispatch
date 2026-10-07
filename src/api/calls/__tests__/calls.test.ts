import { buildDispatchList, createCall, dispatchCallNow, getPendingCalls, updateCall } from '../calls';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  const post = jest.fn();
  const put = jest.fn();
  // Records the endpoint path of every request, so a test can tell which API a call went to.
  const endpoint = jest.fn();
  return {
    createApiEndpoint: jest.fn((path: string) => ({
      get: (...args: unknown[]) => {
        endpoint(path);
        return get(...args);
      },
      post: (...args: unknown[]) => {
        endpoint(path);
        return post(...args);
      },
      put: (...args: unknown[]) => {
        endpoint(path);
        return put(...args);
      },
      delete: jest.fn(),
    })),
    __mockGet: get,
    __mockPost: post,
    __mockPut: put,
    __mockEndpoint: endpoint,
  };
});

const {
  __mockGet: mockGet,
  __mockPost: mockPost,
  __mockPut: mockPut,
  __mockEndpoint: mockEndpoint,
} = jest.requireMock('../../common/client') as { __mockGet: jest.Mock; __mockPost: jest.Mock; __mockPut: jest.Mock; __mockEndpoint: jest.Mock };

const sentGeolocation = (mock: jest.Mock): unknown => (mock.mock.calls[0][0] as { Geolocation: unknown }).Geolocation;

describe('call save Geolocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { Id: 'call-1' } });
    mockPut.mockResolvedValue({ data: { Id: 'call-1' } });
  });

  it('does not send a bare comma on create when no location was picked', async () => {
    // A "," made the server treat the call as located and skip geocoding the typed address.
    await createCall({ name: 'Structure Fire', nature: 'Smoke showing', address: '1 Main St', priority: 1 });

    expect(sentGeolocation(mockPost)).toBe('');
  });

  it('sends the picked location on create', async () => {
    await createCall({ name: 'Structure Fire', nature: 'Smoke showing', latitude: 39.2733, longitude: -119.5841, priority: 1 });

    expect(sentGeolocation(mockPost)).toBe('39.2733,-119.5841');
  });

  it('does not send 0,0 on create', async () => {
    await createCall({ name: 'Structure Fire', nature: 'Smoke showing', address: '1 Main St', latitude: 0, longitude: 0, priority: 1 });

    expect(sentGeolocation(mockPost)).toBe('');
  });

  it('does not send a bare comma on edit when no location was picked', async () => {
    await updateCall({ callId: '1', name: 'Structure Fire', nature: 'Smoke showing', address: '1 Main St', priority: 1 });

    expect(sentGeolocation(mockPut)).toBe('');
  });

  it('sends the picked location on edit', async () => {
    await updateCall({ callId: '1', name: 'Structure Fire', nature: 'Smoke showing', latitude: 0, longitude: 32.5, priority: 1 });

    expect(sentGeolocation(mockPut)).toBe('0,32.5');
  });
});

describe('buildDispatchList', () => {
  it('sends "0" for everyone, whatever else was picked', () => {
    expect(buildDispatchList({ everyone: true, users: ['u1'], units: ['5'] })).toBe('0');
  });

  it('joins personnel, groups, roles and units with their prefixes', () => {
    expect(buildDispatchList({ users: ['u1', 'u2'], groups: ['3'], roles: ['7'], units: ['5'] })).toBe('P:u1|P:u2|G:3|R:7|U:5');
  });

  it('is empty for an empty selection', () => {
    expect(buildDispatchList({ everyone: false, users: [], groups: [], roles: [], units: [] })).toBe('');
    expect(buildDispatchList({})).toBe('');
  });
});

describe('createCall / updateCall dispatch list and pending flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { Id: 'call-1' } });
    mockPut.mockResolvedValue({ data: { Id: 'call-1' } });
  });

  const sent = (mock: jest.Mock) => mock.mock.calls[0][0] as Record<string, unknown>;

  it('builds the same DispatchList on create and edit', async () => {
    const dispatch = { dispatchUsers: ['u1'], dispatchGroups: ['3'], dispatchRoles: ['7'], dispatchUnits: ['5'] };

    await createCall({ name: 'Welfare check', nature: 'Follow-up', priority: 1, ...dispatch });
    await updateCall({ callId: '9', name: 'Welfare check', nature: 'Follow-up', priority: 1, ...dispatch });

    expect(sent(mockPost).DispatchList).toBe('P:u1|G:3|R:7|U:5');
    expect(sent(mockPut).DispatchList).toBe('P:u1|G:3|R:7|U:5');
  });

  it('is not pending unless asked, and keeps the scheduled time', async () => {
    await createCall({ name: 'Welfare check', nature: 'Follow-up', priority: 1, scheduledOn: '2026-10-07T09:00:00.000Z' });

    expect(sent(mockPost).IsPending).toBe(false);
    expect(sent(mockPost).ScheduledOn).toBe('2026-10-07T09:00:00.000Z');
  });

  it('sends IsPending and drops the scheduled time for a pending call', async () => {
    await createCall({ name: 'Welfare check', nature: 'Follow-up', priority: 1, isPending: true, scheduledOn: '2026-10-07T09:00:00.000Z', dispatchUnits: ['5'] });

    expect(sent(mockPost).IsPending).toBe(true);
    expect(sent(mockPost).ScheduledOn).toBe('');
    // The picked recipients still go up, as the proposed dispatch.
    expect(sent(mockPost).DispatchList).toBe('U:5');
    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/SaveCall');
  });

  it('allows a pending call with no recipients', async () => {
    await createCall({ name: 'Welfare check', nature: 'Follow-up', priority: 1, isPending: true });

    expect(sent(mockPost).DispatchList).toBe('');
  });
});

describe('getPendingCalls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads Calls/GetPendingCalls', async () => {
    mockGet.mockResolvedValue({ data: { Data: [{ CallId: '12', State: 8 }], Status: 'Success' } });

    const result = await getPendingCalls();

    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/GetPendingCalls');
    expect(result.Data).toEqual([{ CallId: '12', State: 8 }]);
  });
});

describe('dispatchCallNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockResolvedValue({ data: { Id: '12', Status: 'Success' } });
  });

  it('puts the call id and the replacement dispatch list to Calls/DispatchCallNow', async () => {
    const result = await dispatchCallNow('12', 'U:5|P:abc');

    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/DispatchCallNow');
    expect(mockPut).toHaveBeenCalledWith({ CallId: '12', DispatchList: 'U:5|P:abc' });
    expect(result.Id).toBe('12');
  });

  it('leaves DispatchList out so the server uses the stored recipients', async () => {
    await dispatchCallNow('12');
    await dispatchCallNow('13', '');

    expect(mockPut).toHaveBeenNthCalledWith(1, { CallId: '12' });
    expect(mockPut).toHaveBeenNthCalledWith(2, { CallId: '13' });
  });
});
