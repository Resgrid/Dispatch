import { createApiEndpoint } from '../../common/client';
import { getCallSiteInfo } from '../callSiteInfo';

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

describe('callSiteInfo api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('targets Calls/GetCallSiteInfo', () => {
    expect(registeredPaths).toEqual(['/Calls/GetCallSiteInfo']);
  });

  it('passes callId as a query parameter and returns the body', async () => {
    const payload = { Data: { CallId: '42', IsProtected: false, Contacts: [] } };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getCallSiteInfo('42')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ callId: '42' }, undefined);
  });

  it('forwards the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: { Data: null } });

    await getCallSiteInfo('42', controller.signal);

    expect(mockGet).toHaveBeenCalledWith({ callId: '42' }, controller.signal);
  });

  it('propagates transport errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('Request failed with status code 403'));

    await expect(getCallSiteInfo('42')).rejects.toThrow('403');
  });
});
