const mockGetSystemConfig = jest.fn();

jest.mock('@/api/config', () => ({
  getSystemConfig: () => mockGetSystemConfig(),
}));
jest.mock('@/lib/env', () => ({ Env: { API_VERSION: 'v4' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { buildApiUrl, findLocationByUrl, isSameServerUrl, loadServerLocations, mergeServerLocations, RESGRID_HOSTED_LOCATIONS, toBaseUrl } from '../server-url';

const location = (Name: string, ApiUrl: string) => ({ Name, ApiUrl, DisplayName: '', LocationInfo: '', IsDefault: false, AllowsFreeAccounts: false });

describe('server-url', () => {
  beforeEach(() => {
    mockGetSystemConfig.mockReset();
  });

  it('includes the US-West and EU-Central hosted sites', () => {
    expect(RESGRID_HOSTED_LOCATIONS.map((item) => [item.Name, item.ApiUrl])).toEqual([
      ['US-West', 'https://api.resgrid.com'],
      ['EU-Central', 'https://api-eu-central.resgrid.com'],
    ]);
  });

  describe('toBaseUrl / buildApiUrl', () => {
    it('strips the api suffix and trailing slashes', () => {
      expect(toBaseUrl(' https://api.resgrid.com/api/v4/ ')).toBe('https://api.resgrid.com');
      expect(toBaseUrl('https://api.resgrid.com///')).toBe('https://api.resgrid.com');
    });

    it('always produces exactly one api suffix', () => {
      expect(buildApiUrl('https://api.resgrid.com')).toBe('https://api.resgrid.com/api/v4');
      expect(buildApiUrl('https://api.resgrid.com/api/v4/')).toBe('https://api.resgrid.com/api/v4');
    });
  });

  describe('isSameServerUrl / findLocationByUrl', () => {
    it('compares with or without the api suffix and ignores host case', () => {
      expect(isSameServerUrl('https://API.resgrid.com/api/v4', 'https://api.resgrid.com/')).toBe(true);
      expect(isSameServerUrl('https://api.resgrid.com/api/v4', 'https://api-eu-central.resgrid.com/api/v4')).toBe(false);
    });

    it('finds the hosted site matching a persisted url', () => {
      expect(findLocationByUrl(RESGRID_HOSTED_LOCATIONS, 'https://api-eu-central.resgrid.com/api/v4')?.Name).toBe('EU-Central');
      expect(findLocationByUrl(RESGRID_HOSTED_LOCATIONS, 'https://dispatch.example.org/api/v4')).toBeUndefined();
    });
  });

  describe('mergeServerLocations', () => {
    it('returns the built-in hosted sites when nothing was fetched', () => {
      expect(mergeServerLocations([]).map((item) => item.Name)).toEqual(['US-West', 'EU-Central']);
    });

    it('keeps server-reported sites first and does not duplicate hosted ones', () => {
      const fetched = [location('US-West', 'https://api.resgrid.com'), location('EU-Central', 'https://api-eu-central.resgrid.com/api/v4')];
      expect(mergeServerLocations(fetched)).toEqual(fetched);
    });

    it('appends the hosted sites to a self-hosted server list', () => {
      const merged = mergeServerLocations([location('Local', 'https://resgrid.example.org')]);
      expect(merged.map((item) => item.Name)).toEqual(['Local', 'US-West', 'EU-Central']);
    });

    it('skips a hosted site whose name is already taken so dropdown values stay unique', () => {
      const merged = mergeServerLocations([location('US-West', 'https://mirror.example.org')]);
      expect(merged.map((item) => item.Name)).toEqual(['US-West', 'EU-Central']);
      expect(merged[0].ApiUrl).toBe('https://mirror.example.org');
    });

    it('drops entries without a name or api url', () => {
      const merged = mergeServerLocations([location('', 'https://a.example.org'), location('B', '')]);
      expect(merged.map((item) => item.Name)).toEqual(['US-West', 'EU-Central']);
    });
  });

  describe('loadServerLocations', () => {
    it('uses the sites reported by the configured server', async () => {
      mockGetSystemConfig.mockResolvedValue({ Data: { Locations: [location('US-West', 'https://api.resgrid.com'), location('EU-Central', 'https://api-eu-central.resgrid.com')] } });

      const result = await loadServerLocations();

      expect(result.map((item) => item.Name)).toEqual(['US-West', 'EU-Central']);
    });

    it('falls back to the hosted sites when the server cannot be reached', async () => {
      mockGetSystemConfig.mockRejectedValue(new Error('Network Error'));

      const result = await loadServerLocations();

      expect(result.map((item) => item.Name)).toEqual(['US-West', 'EU-Central']);
    });
  });
});
