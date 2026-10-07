import { closeCall } from '../calls';

jest.mock('../../common/client', () => {
  const put = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get: jest.fn(), post: jest.fn(), put, delete: jest.fn() })),
    __mockPut: put,
  };
});

const { __mockPut: mockPut } = jest.requireMock('../../common/client') as { __mockPut: jest.Mock };

describe('closeCall api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockResolvedValue({ data: { Id: '42' } });
  });

  it('sends Id, Type, Notes and SendNotification when the caller chose whether to notify', async () => {
    await closeCall({ callId: '42', type: 3, note: 'Nothing found', sendNotification: true });
    expect(mockPut).toHaveBeenCalledWith({ Id: '42', Type: 3, Notes: 'Nothing found', SendNotification: true });

    await closeCall({ callId: '42', type: 1, sendNotification: false });
    expect(mockPut).toHaveBeenLastCalledWith({ Id: '42', Type: 1, Notes: '', SendNotification: false });
  });

  it('leaves SendNotification out when not set, so older callers send the same body as before', async () => {
    await closeCall({ callId: '42', type: 2, note: 'Cancelled by caller' });

    expect(mockPut).toHaveBeenCalledWith({ Id: '42', Type: 2, Notes: 'Cancelled by caller' });
    expect(mockPut.mock.calls[0][0]).not.toHaveProperty('SendNotification');
  });

  it('returns the response body', async () => {
    await expect(closeCall({ callId: '42', type: 1 })).resolves.toEqual({ Id: '42' });
  });

  it('propagates a refusal to the caller', async () => {
    const refusal = Object.assign(new Error('Request failed with status code 400'), { isAxiosError: true, response: { status: 400, data: 'This call has an active incident command.' } });
    mockPut.mockRejectedValueOnce(refusal);

    await expect(closeCall({ callId: '42', type: 1, sendNotification: true })).rejects.toBe(refusal);
  });
});
