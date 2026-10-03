import axios from 'axios';

import { fetchSsoConfigForUser, normalizeSsoConfig } from '../sso-discovery';

jest.mock('axios');
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4') }));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SSO discovery (passkey workbook section 7.3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the PascalCase v4 wire names, including the broker fields', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      data: {
        Data: {
          SsoEnabled: true,
          ProviderType: 'oidc',
          Authority: 'https://idp.example.com',
          ClientId: 'client-1',
          AllowLocalLogin: false,
          RequireSso: true,
          RequireMfa: true,
          OidcRedirectUri: 'resgriddispatch://auth/callback',
          OidcScopes: 'openid email',
          DepartmentId: 7,
          DepartmentToken: 'enc-token',
          BrokeredSsoAvailable: true,
        },
      },
    });

    const config = await fetchSsoConfigForUser('jane', 7);

    expect(mockedAxios.get).toHaveBeenCalledWith('https://api.resgrid.com/api/v4/connect/sso-config-for-user', { params: { username: 'jane', departmentId: 7 }, headers: { 'X-Resgrid-Client': 'dispatch' } });
    expect(config).toMatchObject({
      ssoEnabled: true,
      providerType: 'oidc',
      authority: 'https://idp.example.com',
      clientId: 'client-1',
      allowLocalLogin: false,
      requireSso: true,
      requireMfa: true,
      departmentId: 7,
      departmentToken: 'enc-token',
      brokeredSsoAvailable: true,
    });
  });

  it('still reads an older camelCase answer', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: { Data: { SsoEnabled: true, ProviderType: 'saml2', SamlLoginUrl: 'https://api.example.com/api/v4/connect/saml-mobile-login?departmentToken=t' } } });

    await expect(fetchSsoConfigForUser('jane')).resolves.toMatchObject({ ssoEnabled: true, providerType: 'saml2', samlLoginUrl: 'https://api.example.com/api/v4/connect/saml-mobile-login?departmentToken=t', brokeredSsoAvailable: false, departmentToken: null });
  });

  it('returns null for a missing answer and throws when the lookup fails', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: {} });
    await expect(fetchSsoConfigForUser('nobody')).resolves.toBeNull();

    mockedAxios.get = jest.fn().mockRejectedValueOnce(new Error('Network Error'));
    await expect(fetchSsoConfigForUser('jane')).rejects.toThrow('Network Error');
  });

  it('drops an unknown provider type and a non-positive department id', () => {
    expect(normalizeSsoConfig({ SsoEnabled: true, ProviderType: 'ldap', DepartmentId: 0 })).toMatchObject({ providerType: null, departmentId: null });
    expect(normalizeSsoConfig('x')).toBeNull();
  });
});
