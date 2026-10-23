import { createArchivedCall, getArchivedCalls, getCallYears } from '../calls';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  const post = jest.fn();
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
      put: jest.fn(),
      delete: jest.fn(),
    })),
    __mockGet: get,
    __mockPost: post,
    __mockEndpoint: endpoint,
  };
});

const {
  __mockGet: mockGet,
  __mockPost: mockPost,
  __mockEndpoint: mockEndpoint,
} = jest.requireMock('../../common/client') as { __mockGet: jest.Mock; __mockPost: jest.Mock; __mockEndpoint: jest.Mock };

describe('archived calls API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { Data: [] } });
    mockPost.mockResolvedValue({ data: { Id: '42' } });
  });

  it('asks for the call years', async () => {
    await getCallYears();

    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/GetCallYears');
  });

  it('asks for one year of archived calls', async () => {
    await getArchivedCalls('2025');

    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/GetArchivedCalls');
    expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ year: '2025' }));
  });

  it('saves an archived call with its times, close type and the dispatch it records', async () => {
    const result = await createArchivedCall({
      name: 'Structure Fire',
      nature: 'Smoke showing',
      priority: 2,
      type: 'Fire',
      address: '1 Main St',
      latitude: 39.12,
      longitude: -119.75,
      dispatchUsers: ['u1'],
      dispatchUnits: ['5'],
      loggedOnUtc: '2026-10-01T10:00:00.000Z',
      closedOnUtc: '2026-10-01T11:30:00.000Z',
      state: 3,
      closedNotes: 'Nothing found',
      recalculateCallNumbers: true,
    });

    expect(result).toEqual({ Id: '42' });
    expect(mockEndpoint).toHaveBeenCalledWith('/Calls/SaveArchivedCall');
    expect(mockPost).toHaveBeenCalledWith({
      Name: 'Structure Fire',
      Nature: 'Smoke showing',
      Note: '',
      Address: '1 Main St',
      Geolocation: '39.12,-119.75',
      Priority: 2,
      Type: 'Fire',
      ContactName: '',
      ContactInfo: '',
      IncidentId: '',
      ExternalId: '',
      ReferenceId: '',
      DispatchList: 'P:u1|U:5',
      LoggedOnUtc: '2026-10-01T10:00:00.000Z',
      ClosedOnUtc: '2026-10-01T11:30:00.000Z',
      State: 3,
      ClosedNotes: 'Nothing found',
      RecalculateCallNumbers: true,
    });
  });

  it('leaves the close time out when none was picked, and sends no location without one', async () => {
    await createArchivedCall({ name: 'Alarm', nature: 'Commercial alarm', priority: 1, loggedOnUtc: '2026-10-01T10:00:00.000Z', state: 7 });

    const sent = mockPost.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('ClosedOnUtc');
    expect(sent.Geolocation).toBe('');
    expect(sent.DispatchList).toBe('');
    expect(sent.RecalculateCallNumbers).toBe(false);
  });
});
