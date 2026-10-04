import { createApiEndpoint } from '../../common/client';
import { getCallLocationHistory } from '../callLocationHistory';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get })),
    __mockGet: get,
  };
});

const { __mockGet: mockGet } = jest.requireMock('../../common/client') as { __mockGet: jest.Mock };

// Endpoints are created at module load; capture them before beforeEach clears the mock.
const registeredPaths = (createApiEndpoint as jest.Mock).mock.calls.map((c) => c[0]);

describe('callLocationHistory api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('targets Calls/GetCallLocationHistory', () => {
    expect(registeredPaths).toEqual(['/Calls/GetCallLocationHistory']);
  });

  it('passes callId as a query parameter and returns the body', async () => {
    const payload = { Data: { AddressMatchingAvailable: true, IndexComplete: true, HasMore: false, IsProtected: false, Calls: [] } };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getCallLocationHistory('42')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ callId: '42' }, undefined);
  });

  it('forwards the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: { Data: null } });

    await getCallLocationHistory('42', controller.signal);

    expect(mockGet).toHaveBeenCalledWith({ callId: '42' }, controller.signal);
  });
});
