import { getCallRecommendation } from '../runcards';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  return {
    api: { put: jest.fn() },
    createApiEndpoint: jest.fn(() => ({
      get: (...args: unknown[]) => get(...args),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    })),
    __mockGet: get,
  };
});

const { __mockGet: mockGet } = jest.requireMock('../../common/client') as { __mockGet: jest.Mock };

describe('getCallRecommendation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { Data: { MatchedRunCardId: 4, Units: [] } } });
  });

  it('asks for the pinned decision by default, exactly as before conditional run cards', async () => {
    await getCallRecommendation('7');

    expect(mockGet).toHaveBeenCalledWith({ callId: '7' }, undefined);
  });

  it('asks for a fresh walk of the decision graph when re-evaluating', async () => {
    await getCallRecommendation('7', undefined, { reevaluate: true });

    expect(mockGet).toHaveBeenCalledWith({ callId: '7', reevaluate: true }, undefined);
  });

  it('collapses a result with no matched card to null', async () => {
    mockGet.mockResolvedValue({ data: { Data: { MatchedRunCardId: null } } });

    await expect(getCallRecommendation('7')).resolves.toBeNull();
  });
});
