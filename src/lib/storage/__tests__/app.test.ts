const mockStore = new Map<string, string>();

jest.mock('@env', () => ({ Env: { BASE_API_URL: 'https://api.resgrid.com', API_VERSION: 'v4' } }));
jest.mock('@/lib/storage', () => ({
  getItem: (key: string) => {
    const value = mockStore.get(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (key: string, value: unknown) => {
    mockStore.set(key, JSON.stringify(value));
  },
  removeItem: async (key: string) => {
    mockStore.delete(key);
  },
}));

import { getBaseApiUrl, removeBaseApiUrl, setBaseApiUrl } from '../app';

describe('base API url storage', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('defaults to the environment url when nothing has been saved', () => {
    expect(getBaseApiUrl()).toBe('https://api.resgrid.com/api/v4');
  });

  it('returns the saved url on later reads (e.g. after a reload)', async () => {
    await setBaseApiUrl('https://api-eu-central.resgrid.com/api/v4');

    expect(mockStore.get('baseUrl')).toBe(JSON.stringify('https://api-eu-central.resgrid.com/api/v4'));
    expect(getBaseApiUrl()).toBe('https://api-eu-central.resgrid.com/api/v4');
  });

  it('normalizes whitespace and trailing slashes', async () => {
    await setBaseApiUrl('  https://dispatch.example.org/api/v4/  ');

    expect(getBaseApiUrl()).toBe('https://dispatch.example.org/api/v4');
  });

  it('falls back to the default after the saved url is removed', async () => {
    await setBaseApiUrl('https://api-eu-central.resgrid.com/api/v4');
    await removeBaseApiUrl();

    expect(getBaseApiUrl()).toBe('https://api.resgrid.com/api/v4');
  });
});
