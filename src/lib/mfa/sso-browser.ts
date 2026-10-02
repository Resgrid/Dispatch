import * as WebBrowser from 'expo-web-browser';
import queryString from 'query-string';
import { Platform } from 'react-native';

import { ephemeralBrowser, SSO_RETURN_SCHEME } from './client-app';
import { toMfaProblem } from './errors';
import { randomBase64Url, s256Challenge } from './pkce';
import type { SsoBeginData } from './types';

// ---------------------------------------------------------------------------
// One brokered SSO round trip (passkey plan section 7.7.2). The broker returns only a one-time code and this app's
// state to the registered return target; the PKCE verifier never leaves this app's memory until the code is redeemed,
// and no IdP token or assertion ever reaches the app.
// ---------------------------------------------------------------------------

export interface SsoRoundTripSecrets {
  returnTarget: string;
  state: string;
  codeChallenge: string;
  platform: string;
}

export interface SsoRoundTrip {
  ssoTransactionId: string;
  ssoCode: string;
  codeVerifier: string;
}

export type SsoRoundTripResult = { ok: true; trip: SsoRoundTrip } | { ok: false; reason: 'cancelled' | 'denied' | 'failed' | 'state_mismatch' | 'refused'; code?: string };

/**
 * The desktop app's loopback bridge (electron/sso-loopback.js): a one-time listener on 127.0.0.1 receives the broker's
 * return, because a packaged desktop page cannot receive a browser redirect. Absent everywhere else.
 */
interface DesktopSso {
  ssoListen: () => Promise<{ id: string; returnTarget: string }>;
  ssoOpen: (id: string, authorizeUrl: string) => Promise<string | null>;
  ssoCancel: (id: string) => Promise<void>;
}

const desktopSso = (): DesktopSso | null => {
  const bridge = typeof window !== 'undefined' ? (window as unknown as { electronAPI?: Partial<DesktopSso> }).electronAPI : undefined;
  return bridge?.ssoListen && bridge.ssoOpen && bridge.ssoCancel ? (bridge as DesktopSso) : null;
};

/** This build's registered return target: the app's scheme, or this site's `/sso-return` page. */
export const ssoReturnTarget = (): string => (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/sso-return` : `${SSO_RETURN_SCHEME}://sso-return`);

export const ssoPlatform = (): string => (desktopSso() ? 'electron' : Platform.OS);

/** Parses the broker's return: `?sso_code=…&state=…` or `?error=…&state=…`. */
export const parseSsoReturn = (url: string): { ssoCode?: string; state?: string; error?: string } => {
  const query = url.includes('?') ? (url.substring(url.indexOf('?') + 1).split('#')[0] ?? '') : '';
  const parsed = queryString.parse(query);
  const one = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);
  return { ssoCode: one(parsed.sso_code), state: one(parsed.state), error: one(parsed.error) };
};

/**
 * Begins the round trip through `begin`, runs it in the system browser (an auth session, so the redirect comes straight
 * back to this app), and checks the state before handing back the code. `ephemeral` keeps the provider's cookies out of
 * a shared installation so the next operator cannot inherit the last one's provider session.
 */
export const runSsoRoundTrip = async (begin: (secrets: SsoRoundTripSecrets) => Promise<SsoBeginData>, ephemeral = ephemeralBrowser()): Promise<SsoRoundTripResult> => {
  const codeVerifier = randomBase64Url(32);
  const state = randomBase64Url(24);
  const desktop = desktopSso();
  const listener = desktop ? await desktop.ssoListen() : null;
  const returnTarget = listener ? listener.returnTarget : ssoReturnTarget();

  let begun: SsoBeginData;
  try {
    begun = await begin({ returnTarget, state, codeChallenge: await s256Challenge(codeVerifier), platform: ssoPlatform() });
  } catch (error) {
    if (desktop && listener) {
      await desktop.ssoCancel(listener.id);
    }
    return { ok: false, reason: 'refused', code: toMfaProblem(error).code };
  }

  let returnedUrl: string | null;
  if (desktop && listener) {
    // The provider opens in the member's own browser; the loopback listener hands back its one return.
    returnedUrl = await desktop.ssoOpen(listener.id, begun.AuthorizeUrl);
  } else {
    const result = await WebBrowser.openAuthSessionAsync(begun.AuthorizeUrl, returnTarget, { preferEphemeralSession: ephemeral });
    returnedUrl = result.type === 'success' && result.url ? result.url : null;
  }
  if (!returnedUrl) {
    return { ok: false, reason: 'cancelled' };
  }

  const returned = parseSsoReturn(returnedUrl);
  if (returned.state !== state) {
    return { ok: false, reason: 'state_mismatch' };
  }
  if (returned.error) {
    return { ok: false, reason: returned.error === 'access_denied' ? 'denied' : 'failed', code: returned.error };
  }
  if (!returned.ssoCode) {
    return { ok: false, reason: 'failed' };
  }

  return { ok: true, trip: { ssoTransactionId: begun.SsoTransactionId, ssoCode: returned.ssoCode, codeVerifier } };
};
