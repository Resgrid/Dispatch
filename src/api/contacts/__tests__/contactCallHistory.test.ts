import { createApiEndpoint } from '../../common/client';
import { getContactCallHistory } from '../contactCallHistory';

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

describe('contactCallHistory api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('targets Contacts/GetContactCallHistory', () => {
    expect(registeredPaths).toEqual(['/Contacts/GetContactCallHistory']);
  });

  it('passes contactId as a query parameter and returns the body', async () => {
    const payload = { Data: { AddressMatchingAvailable: true, IndexComplete: true, HasMore: false, IsProtected: false, Calls: [] } };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getContactCallHistory('c1')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1' }, undefined);
  });
});
