import { getUnitsInfos } from '../units';

jest.mock('../../common/cached-client', () => {
  const get = jest.fn();
  return {
    createCachedApiEndpoint: jest.fn(() => ({ get })),
    __mockGet: get,
  };
});

const { __mockGet: mockGet } = jest.requireMock('../../common/cached-client') as { __mockGet: jest.Mock };

describe('getUnitsInfos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { Data: [] } });
  });

  it('uses the cache by default', async () => {
    await getUnitsInfos('');

    expect(mockGet).toHaveBeenCalledWith(undefined, { forceRefresh: false });
  });

  it('forwards forceRefresh without a filter', async () => {
    await getUnitsInfos('', true);

    expect(mockGet).toHaveBeenCalledWith(undefined, { forceRefresh: true });
  });

  it('forwards forceRefresh with a filter', async () => {
    await getUnitsInfos('Station 1', true);

    expect(mockGet).toHaveBeenCalledWith({ activeFilter: 'Station%201' }, { forceRefresh: true });
  });
});
