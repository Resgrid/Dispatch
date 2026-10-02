import { renderHook } from '@testing-library/react-native';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import { externalTokenRequest } from '@/lib/auth/api';
import { saveSharedInstallation } from '@/lib/mfa/shared-installation';

import { useOidcLogin } from '../use-oidc-login';

jest.mock('@/lib/auth/api', () => ({ externalTokenRequest: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('Dispatch legacy OIDC redirect URI', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  it('uses the lowercase app scheme the department registers (resgriddispatch://auth/callback), not the display scheme', () => {
    Platform.OS = 'ios';
    renderHook(() => useOidcLogin('https://idp.example.com', 'client-1', 'dispatcher'));

    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({ scheme: 'resgriddispatch', path: 'auth/callback' });
  });

  it('returns to its own page on the web', () => {
    Platform.OS = 'web';
    renderHook(() => useOidcLogin('https://idp.example.com', 'client-1', 'dispatcher'));

    expect(AuthSession.makeRedirectUri).toHaveBeenCalledWith({ path: 'login/sso' });
  });
});

describe('Dispatch OIDC exchange of an id_token the app already holds (the desktop app)', () => {
  const tokens = { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 3600, token_type: 'Bearer', expiration_date: '' };
  const exchange = (idToken: string) => renderHook(() => useOidcLogin('https://idp.example.com', 'client-1', 'dispatcher', 7, 'enc-dept')).result.current.exchangeIdTokenForResgridToken(idToken);

  afterEach(() => jest.clearAllMocks());

  it("exchanges it with the department's token and answers with Resgrid's tokens", async () => {
    (externalTokenRequest as jest.Mock).mockResolvedValue({ successful: true, message: '', authResponse: tokens });
    await expect(exchange('idp.id.token')).resolves.toBe(tokens);
    expect(externalTokenRequest).toHaveBeenCalledWith('oidc', 'idp.id.token', 'dispatcher', 7, undefined, 'enc-dept');
  });

  it("says the member's code is needed, for the code prompt", async () => {
    (externalTokenRequest as jest.Mock).mockResolvedValue({ successful: false, mfaRequired: true, message: 'mfa_required' });
    await expect(exchange('idp.id.token')).resolves.toBe('mfa_required');
  });

  it('answers nothing when the exchange is refused, even with tokens in the answer', async () => {
    (externalTokenRequest as jest.Mock).mockResolvedValue({ successful: false, message: 'invalid_grant', authResponse: tokens });
    await expect(exchange('idp.id.token')).resolves.toBeNull();
    (externalTokenRequest as jest.Mock).mockResolvedValue({ successful: true, message: '' });
    await expect(exchange('idp.id.token')).resolves.toBeNull();
  });
});

describe('Dispatch legacy OIDC on a shared installation', () => {
  const promptAsync = jest.fn();

  beforeEach(() => (AuthSession.useAuthRequest as jest.Mock).mockReturnValue([{ codeVerifier: 'v' }, null, promptAsync]));
  afterEach(() => {
    saveSharedInstallation({ shared: false, label: null });
    jest.clearAllMocks();
  });

  it('asks the provider to authenticate the member again, in a browser that keeps no cookies', async () => {
    saveSharedInstallation({ shared: true, label: null });
    const { result } = renderHook(() => useOidcLogin('https://idp.example.com', 'client-1', 'dispatcher'));

    expect(AuthSession.useAuthRequest).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: 'login', extraParams: { max_age: '0' } }), expect.anything());
    await result.current.promptAsync();
    expect(promptAsync).toHaveBeenCalledWith({ preferEphemeralSession: true });
  });

  it('leaves a personal installation as it was', async () => {
    const { result } = renderHook(() => useOidcLogin('https://idp.example.com', 'client-1', 'dispatcher'));

    expect(AuthSession.useAuthRequest).toHaveBeenLastCalledWith(expect.not.objectContaining({ prompt: expect.anything() }), expect.anything());
    await result.current.promptAsync();
    expect(promptAsync).toHaveBeenCalledWith({ preferEphemeralSession: false });
  });
});
