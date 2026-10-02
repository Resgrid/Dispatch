import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { saveSharedInstallation } from '@/lib/mfa/shared-installation';

import SsoLoginScreen from '../sso';

const mockStartSaml = jest.fn();
const mockSamlUrl = jest.fn();
const mockHandleSamlDeepLink = jest.fn();
const mockPromptAsync = jest.fn();
const mockExchangeIdToken = jest.fn();

// The screen builds its form schema with `import * as z`; a chainable stand-in keeps the schema out of the way.
jest.mock('zod', () => {
  const chain: any = new Proxy(() => chain, { get: () => chain, apply: () => chain });
  return chain;
});
jest.mock('@hookform/resolvers/zod', () => ({ zodResolver: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn(() => ({ queryParams: {} })),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/sso-discovery', () => ({ fetchSsoConfigForUser: jest.fn() }));
jest.mock('@/hooks/use-oidc-login', () => ({
  useOidcLogin: jest.fn(() => ({ request: null, response: null, promptAsync: mockPromptAsync, exchangeCodeForResgridToken: jest.fn(), exchangeIdTokenForResgridToken: mockExchangeIdToken })),
}));
jest.mock('@/hooks/use-saml-login', () => ({
  useSamlLogin: (samlLoginUrl: string) => {
    mockSamlUrl(samlLoginUrl);
    return { startSamlLogin: mockStartSaml, handleSamlDeepLink: mockHandleSamlDeepLink };
  },
}));
jest.mock('@/stores/auth/store', () => {
  const { create } = require('zustand');
  return { __esModule: true, default: create(() => ({ status: 'signedOut', mfaChallenge: null, loginWithSso: jest.fn(), loginWithBrokeredSso: jest.fn() })) };
});
jest.mock('@/components/auth/login-mfa-sheet', () => ({ LoginMfaSheet: () => null }));
jest.mock('@/components/auth/login-otp-modal', () => ({ LoginOtpModal: () => null }));

const { fetchSsoConfigForUser } = jest.requireMock('@/services/sso-discovery') as { fetchSsoConfigForUser: jest.Mock };
const start = 'https://api.example/api/v4/connect/saml-mobile-login?departmentToken=t';
const saml = (overrides: Record<string, unknown> = {}) => ({
  ssoEnabled: true,
  providerType: 'saml2',
  brokeredSsoAvailable: false,
  samlLoginUrl: start,
  departmentToken: 'dept-token',
  departmentId: 7,
  ...overrides,
});

/** The member's username, then Continue: the screen looks the department up and shows its sign-in. */
const lookUp = async () => {
  const view = render(<SsoLoginScreen />);
  await act(async () => screen.getByPlaceholderText('login.username_placeholder').props.onChangeText('dispatcher'));
  await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-continue' }).props.onPress());
  return view;
};

describe('SsoLoginScreen SAML sign-in without the broker', () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers SAML sign-in that starts on the server's page, which sends the browser on to the IdP", async () => {
    fetchSsoConfigForUser.mockResolvedValue(saml());
    await lookUp();

    expect(mockSamlUrl).toHaveBeenLastCalledWith(start);
    expect(screen.queryByTestId('sso-saml-unavailable')).toBeNull();
    await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-saml' }).props.onPress());
    expect(mockStartSaml).toHaveBeenCalled();
  });

  it('says it cannot sign in where the server names no start page', async () => {
    fetchSsoConfigForUser.mockResolvedValue(saml({ samlLoginUrl: null }));
    await lookUp();

    expect(screen.getByTestId('sso-saml-unavailable')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByProps({ testID: 'sso-saml' })).toHaveLength(0);
  });

  it('says it cannot sign in on the web edition, which the relay cannot return to', async () => {
    const { Platform } = require('react-native');
    const os = Platform.OS;
    Platform.OS = 'web';
    try {
      fetchSsoConfigForUser.mockResolvedValue(saml());
      await lookUp();
      expect(screen.getByTestId('sso-saml-unavailable')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByProps({ testID: 'sso-saml' })).toHaveLength(0);
    } finally {
      Platform.OS = os;
    }
  });
});

describe('SsoLoginScreen in the desktop app, without the broker', () => {
  const { Platform } = require('react-native');
  const os = Platform.OS;
  const useAuthStore = jest.requireMock('@/stores/auth/store').default;
  const tokens = { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 3600, token_type: 'Bearer', expiration_date: '' };
  const bridge = { legacySsoOidc: jest.fn(), legacySsoSaml: jest.fn(), legacySsoCancel: jest.fn(async () => undefined) };
  const oidc = { ssoEnabled: true, providerType: 'oidc', brokeredSsoAvailable: false, authority: 'https://idp.example.com/tenant', clientId: 'resgrid-desktop', departmentToken: 'dept-token', departmentId: 7 };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    (window as unknown as { electronAPI?: unknown }).electronAPI = bridge;
  });

  afterEach(() => {
    Platform.OS = os;
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it("signs in with the id_token the main process redeemed, exchanged by the page's hook, not the page's own popup", async () => {
    fetchSsoConfigForUser.mockResolvedValue(oidc);
    bridge.legacySsoOidc.mockResolvedValue({ ok: true, idToken: 'idp.id.token' });
    mockExchangeIdToken.mockResolvedValue(tokens);
    await lookUp();

    const button = screen.UNSAFE_getByProps({ testID: 'sso-oidc' });
    expect(button.props.isDisabled).toBe(false);
    await act(async () => button.props.onPress());

    expect(bridge.legacySsoOidc).toHaveBeenCalledWith('https://idp.example.com/tenant', 'resgrid-desktop', false);
    expect(mockExchangeIdToken).toHaveBeenCalledWith('idp.id.token');
    expect(mockPromptAsync).not.toHaveBeenCalled();
    expect(useAuthStore.getState().loginWithSso).toHaveBeenCalledWith(tokens);
  });

  it('says nothing when the member abandons the sign-in, and says so when the provider refuses it', async () => {
    fetchSsoConfigForUser.mockResolvedValue(oidc);
    bridge.legacySsoOidc.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    const first = await lookUp();
    await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-oidc' }).props.onPress());
    expect(mockExchangeIdToken).not.toHaveBeenCalled();
    expect(screen.queryByText('sso.error_oidc_cancelled')).toBeNull();
    expect(screen.queryByText('sso.error_generic')).toBeNull();
    first.unmount();

    bridge.legacySsoOidc.mockResolvedValueOnce({ ok: false, reason: 'denied', code: 'access_denied' });
    await lookUp();
    await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-oidc' }).props.onPress());
    expect(screen.getByText('sso.error_oidc_cancelled')).toBeTruthy();
    expect(useAuthStore.getState().loginWithSso).not.toHaveBeenCalled();
  });

  it("offers SAML, and finishes it with the relay's link the main process received", async () => {
    const link = 'resgriddispatch://auth/callback?saml_response=relay-token&department_token=enc-dept&relay_state=dispatch.nonce';
    fetchSsoConfigForUser.mockResolvedValue(saml());
    mockStartSaml.mockResolvedValue(link);
    mockHandleSamlDeepLink.mockResolvedValue(tokens);
    await lookUp();

    expect(screen.queryByTestId('sso-saml-unavailable')).toBeNull();
    await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-saml' }).props.onPress());
    expect(mockHandleSamlDeepLink).toHaveBeenCalledWith(link);
    expect(useAuthStore.getState().loginWithSso).toHaveBeenCalledWith(tokens);
  });

  it('does nothing more when the SAML sign-in was abandoned', async () => {
    fetchSsoConfigForUser.mockResolvedValue(saml());
    mockStartSaml.mockResolvedValue(null);
    await lookUp();
    await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-saml' }).props.onPress());
    expect(mockHandleSamlDeepLink).not.toHaveBeenCalled();
  });

  it('asks the main process for a fresh provider sign-in on a shared installation', async () => {
    saveSharedInstallation({ shared: true, label: null });
    try {
      fetchSsoConfigForUser.mockResolvedValue(oidc);
      bridge.legacySsoOidc.mockResolvedValue({ ok: false, reason: 'cancelled' });
      await lookUp();
      await act(async () => screen.UNSAFE_getByProps({ testID: 'sso-oidc' }).props.onPress());
      expect(bridge.legacySsoOidc).toHaveBeenCalledWith('https://idp.example.com/tenant', 'resgrid-desktop', true);
    } finally {
      saveSharedInstallation({ shared: false, label: null });
    }
  });

  it("ends a sign-in still waiting in the member's browser when the screen closes", () => {
    const view = render(<SsoLoginScreen />);
    view.unmount();
    expect(bridge.legacySsoCancel).toHaveBeenCalledTimes(1);
  });
});
