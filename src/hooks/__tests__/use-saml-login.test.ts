import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { externalTokenRequest } from '@/lib/auth/api';
import { isSharedInstallation } from '@/lib/mfa/shared-installation';
import { getItem, removeItem, setItem } from '@/lib/storage';

import { useSamlLogin } from '../use-saml-login';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13') }));
jest.mock('expo-linking', () => ({ parse: jest.fn(), openURL: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })) }));
jest.mock('@/lib/auth/api', () => ({ externalTokenRequest: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/mfa/shared-installation', () => ({ isSharedInstallation: jest.fn(() => false) }));
jest.mock('@/lib/storage', () => {
  const store = new Map<string, unknown>();
  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: unknown) => void store.set(key, value)),
    removeItem: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

const RELAY_STATE = 'dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13';
const store = (jest.requireMock('@/lib/storage') as { __store: Map<string, unknown> }).__store;
const tokens = { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 3600, token_type: 'Bearer', expiration_date: '' };
const callback = (params: Record<string, string>) => (Linking.parse as jest.Mock).mockReturnValue({ path: 'auth/callback', queryParams: params });

describe('Dispatch SAML sign-in (legacy relay)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    (externalTokenRequest as jest.Mock).mockResolvedValue({ successful: true, message: '', authResponse: tokens });
  });

  it('tags its RelayState with the app name, so the server relay returns to Dispatch', async () => {
    const { startSamlLogin } = useSamlLogin('https://idp.example.com/sso?app=1', 'dispatcher', 7, 'enc-dept');

    await startSamlLogin();

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`https://idp.example.com/sso?app=1&RelayState=${RELAY_STATE}`);
    expect(setItem).toHaveBeenCalledWith('SAML_PENDING_STATE', expect.stringContaining(RELAY_STATE));
  });

  it('opens nothing when the server names no sign-in page', async () => {
    const { startSamlLogin } = useSamlLogin('', 'dispatcher', 7, 'enc-dept');

    await startSamlLogin();

    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("in the desktop app hands the start page to the main process and returns the relay's link", async () => {
    const legacySsoSaml = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, url: `resgriddispatch://auth/callback?saml_response=r&relay_state=${RELAY_STATE}` })
      .mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    (window as unknown as { electronAPI?: unknown }).electronAPI = { legacySsoOidc: jest.fn(), legacySsoSaml, legacySsoCancel: jest.fn() };
    try {
      const { startSamlLogin } = useSamlLogin('https://api.resgrid.com/start?departmentToken=t', 'dispatcher', 7, 'enc-dept');

      await expect(startSamlLogin()).resolves.toBe(`resgriddispatch://auth/callback?saml_response=r&relay_state=${RELAY_STATE}`);
      expect(legacySsoSaml).toHaveBeenCalledWith(`https://api.resgrid.com/start?departmentToken=t&RelayState=${RELAY_STATE}`);
      expect(setItem).toHaveBeenCalledWith('SAML_PENDING_STATE', expect.stringContaining(RELAY_STATE));
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();

      await expect(startSamlLogin()).resolves.toBeNull();
    } finally {
      delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    }
  });

  it('on a shared installation asks the IdP to authenticate the member again', async () => {
    (isSharedInstallation as jest.Mock).mockReturnValueOnce(true);
    const { startSamlLogin } = useSamlLogin('https://api.resgrid.com/start?departmentToken=t', 'dispatcher', 7, 'enc-dept');
    await startSamlLogin();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`https://api.resgrid.com/start?departmentToken=t&RelayState=${RELAY_STATE}&forceAuthn=true`);
  });

  it('on a phone opens the browser and returns nothing: the deep link brings the answer', async () => {
    const { startSamlLogin } = useSamlLogin('https://api.resgrid.com/start', 'dispatcher', 7, 'enc-dept');
    await expect(startSamlLogin()).resolves.toBeNull();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
  });

  it('exchanges an echoed callback with the department the relay sent, once', async () => {
    const { startSamlLogin, handleSamlDeepLink } = useSamlLogin('https://idp.example.com/sso', 'dispatcher', 7, 'discovery-token');
    await startSamlLogin();
    callback({ saml_response: 'saml-relay:ABC', department_token: 'relay-token', relay_state: RELAY_STATE });

    await expect(handleSamlDeepLink('resgriddispatch://auth/callback?...')).resolves.toEqual(tokens);
    expect(externalTokenRequest).toHaveBeenCalledWith('saml2', 'saml-relay:ABC', 'dispatcher', 7, undefined, 'relay-token');

    // Replayed: the pending flow was consumed.
    await expect(handleSamlDeepLink('resgriddispatch://auth/callback?...')).resolves.toBeNull();
    expect(externalTokenRequest).toHaveBeenCalledTimes(1);
  });

  it("falls back to discovery's department token when the callback has none", async () => {
    const { startSamlLogin, handleSamlDeepLink } = useSamlLogin('https://idp.example.com/sso', 'dispatcher', undefined, 'discovery-token');
    await startSamlLogin();
    callback({ saml_response: 'saml-relay:ABC', relay_state: RELAY_STATE });

    await handleSamlDeepLink('resgriddispatch://auth/callback?...');

    expect(externalTokenRequest).toHaveBeenCalledWith('saml2', 'saml-relay:ABC', 'dispatcher', undefined, undefined, 'discovery-token');
  });

  it.each([
    ['no relay_state', { saml_response: 'saml-relay:ABC' }],
    ['a mismatched relay_state', { saml_response: 'saml-relay:ABC', relay_state: 'dispatch.someone-elses-nonce-1234' }],
    ['a relay_state only in the old RelayState param', { saml_response: 'saml-relay:ABC', RelayState: RELAY_STATE }],
  ])('refuses a callback with %s (login CSRF)', async (_label, params) => {
    const { startSamlLogin, handleSamlDeepLink } = useSamlLogin('https://idp.example.com/sso', 'dispatcher');
    await startSamlLogin();
    callback(params as Record<string, string>);

    await expect(handleSamlDeepLink('resgriddispatch://auth/callback?...')).resolves.toBeNull();
    expect(externalTokenRequest).not.toHaveBeenCalled();
  });

  it('refuses a callback when no sign-in is pending', async () => {
    const { handleSamlDeepLink } = useSamlLogin('https://idp.example.com/sso', 'dispatcher');
    callback({ saml_response: 'saml-relay:ABC', relay_state: RELAY_STATE });

    await expect(handleSamlDeepLink('resgriddispatch://auth/callback?...')).resolves.toBeNull();
    expect(externalTokenRequest).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalled();
  });
});
