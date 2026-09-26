const mockAxiosGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockAxiosGet(...args) },
}));
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => 'https://api-eu-central.resgrid.com/api/v4',
}));
jest.mock('../../common', () => ({
  createApiEndpoint: () => ({ get: jest.fn() }),
}));

import { getSystemConfig } from '../index';

describe('getSystemConfig', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockAxiosGet.mockResolvedValue({ data: { Data: { Locations: [] } } });
  });

  it('calls the configured server anonymously so it works before sign-in', async () => {
    const result = await getSystemConfig();

    expect(result).toEqual({ Data: { Locations: [] } });
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockAxiosGet.mock.calls[0];
    expect(url).toBe('https://api-eu-central.resgrid.com/api/v4/Config/GetSystemConfig');
    expect(config.headers?.Authorization).toBeUndefined();
    expect(config.timeout).toBeGreaterThan(0);
  });

  it('can query an explicit server', async () => {
    await getSystemConfig('https://api.resgrid.com/api/v4');

    expect(mockAxiosGet.mock.calls[0][0]).toBe('https://api.resgrid.com/api/v4/Config/GetSystemConfig');
  });
});
