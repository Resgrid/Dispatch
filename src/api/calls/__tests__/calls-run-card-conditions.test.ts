import { createCall, dispatchCallNow, updateCall } from '../calls';

jest.mock('../../common/client', () => {
  const post = jest.fn();
  const put = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({
      get: jest.fn(),
      post: (...args: unknown[]) => post(...args),
      put: (...args: unknown[]) => put(...args),
      delete: jest.fn(),
    })),
    __mockPost: post,
    __mockPut: put,
  };
});

const { __mockPost: mockPost, __mockPut: mockPut } = jest.requireMock('../../common/client') as { __mockPost: jest.Mock; __mockPut: jest.Mock };

const sent = (mock: jest.Mock): Record<string, unknown> => mock.mock.calls[0][0] as Record<string, unknown>;

describe('call saves with conditional run cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { Id: '1' } });
    mockPut.mockResolvedValue({ data: { Id: '1' } });
  });

  it('sends the reviewed outcome and the response codes on a new call', async () => {
    await createCall({ name: 'Cardiac arrest', nature: 'CPR in progress', priority: 1, dispatchUnits: ['5'], unitResponseCodes: '5:3', runCardOutcomeNodeKey: 'leaf-a' });

    expect(sent(mockPost)).toEqual(expect.objectContaining({ UnitResponseCodes: '5:3', RunCardOutcomeNodeKey: 'leaf-a' }));
  });

  it('leaves both fields off a new call without them, as older servers expect', async () => {
    await createCall({ name: 'Cardiac arrest', nature: 'CPR in progress', priority: 1 });

    expect(sent(mockPost)).not.toHaveProperty('UnitResponseCodes');
    expect(sent(mockPost)).not.toHaveProperty('RunCardOutcomeNodeKey');
  });

  it('sends the response codes on an edit only when there are any', async () => {
    await updateCall({ callId: '1', name: 'Cardiac arrest', nature: 'CPR in progress', priority: 1, unitResponseCodes: '5:|6:2' });
    await updateCall({ callId: '1', name: 'Cardiac arrest', nature: 'CPR in progress', priority: 1 });

    expect(mockPut.mock.calls[0][0]).toEqual(expect.objectContaining({ UnitResponseCodes: '5:|6:2' }));
    expect(mockPut.mock.calls[1][0]).not.toHaveProperty('UnitResponseCodes');
  });

  it('sends the response codes with Dispatch Now only when there are any', async () => {
    await dispatchCallNow('12', 'U:5', '5:3');
    await dispatchCallNow('13');

    expect(mockPut.mock.calls[0][0]).toEqual({ CallId: '12', DispatchList: 'U:5', UnitResponseCodes: '5:3' });
    expect(mockPut.mock.calls[1][0]).toEqual({ CallId: '13' });
  });
});
