import { randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { externalTokenRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { logger } from '@/lib/logging';
import { RESGRID_CLIENT } from '@/lib/mfa/client-app';
import { desktopLegacySso } from '@/lib/mfa/legacy-sso-desktop';
import { isSharedInstallation } from '@/lib/mfa/shared-installation';
import { getItem, removeItem, setItem } from '@/lib/storage';

export interface SamlLoginHook {
  /** Opens the start page. The desktop app's main process receives the relay's link and this returns it; null otherwise. */
  startSamlLogin: () => Promise<string | null>;
  handleSamlDeepLink: (url: string) => Promise<AuthResponse | 'mfa_required' | null>;
}

// CSRF protection for the SAML flow: a random RelayState nonce is generated when the
// user starts the login and the deep link is only accepted while a matching pending
// flow exists. Persisted so a cold-started app (killed during the browser round-trip)
// can still validate the callback. Any installed app can claim the custom URL scheme,
// so an unsolicited injected saml_response must be rejected.
const SAML_PENDING_STATE_KEY = 'SAML_PENDING_STATE';
const SAML_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

interface SamlPendingState {
  nonce: string;
  startedAt: number;
}

async function savePendingState(state: SamlPendingState | null): Promise<void> {
  if (state) {
    await setItem(SAML_PENDING_STATE_KEY, JSON.stringify(state));
  } else {
    await removeItem(SAML_PENDING_STATE_KEY);
  }
}

function readPendingState(): SamlPendingState | null {
  const raw = getItem<string>(SAML_PENDING_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SamlPendingState;
  } catch {
    return null;
  }
}

/**
 * SAML without the broker: the app opens the server's start page (discovery's SamlLoginUrl), which sends the browser on to
 * the department's IdP with an AuthnRequest; the IdP's answer comes back through the relay to this app's own scheme.
 */
export function useSamlLogin(signInUrl: string, username: string, departmentId?: number, departmentToken?: string | null): SamlLoginHook {
  async function startSamlLogin(): Promise<string | null> {
    if (!signInUrl) {
      logger.error({ message: 'SSO SAML: No SAML sign-in page available' });
      return null;
    }

    try {
      // Record the pending flow and ask the IdP to echo our nonce back as RelayState. It is tagged with this app's name:
      // every app shares one ACS URL, and the server's relay returns to the app named here, echoing it as relay_state.
      const nonce = `${RESGRID_CLIENT}.${randomUUID()}`;
      await savePendingState({ nonce, startedAt: Date.now() });

      const separator = signInUrl.includes('?') ? '&' : '?';
      // A shared installation asks the IdP to authenticate the member again (ForceAuthn): its browser may still hold the last
      // operator's IdP session, and the server refuses a sign-in that is not fresh (plan section 12.5.2).
      const startUrl = `${signInUrl}${separator}RelayState=${encodeURIComponent(nonce)}${isSharedInstallation() ? '&forceAuthn=true' : ''}`;
      const desktop = desktopLegacySso();
      if (desktop) {
        const returned = await desktop.legacySsoSaml(startUrl);
        return returned.ok ? returned.url : null;
      }
      await WebBrowser.openBrowserAsync(startUrl);
    } catch (error) {
      logger.error({ message: 'SSO SAML: Failed to open the sign-in browser', context: { error } });
    }
    return null;
  }

  async function handleSamlDeepLink(url: string): Promise<AuthResponse | 'mfa_required' | null> {
    try {
      const parsed = Linking.parse(url);
      const samlResponse = parsed.queryParams?.saml_response as string | undefined;

      if (!samlResponse) {
        // Never log the raw deep link - its query params can carry the saml_response token
        logger.error({ message: 'SSO SAML: No saml_response in deep link', context: { path: parsed.path } });
        return null;
      }

      // Validate against the pending flow started by startSamlLogin
      const pending = readPendingState();
      if (!pending || Date.now() - pending.startedAt > SAML_FLOW_MAX_AGE_MS) {
        logger.warn({ message: 'SSO SAML: Rejecting saml_response with no fresh pending login flow', context: { path: parsed.path } });
        return null;
      }

      // The server's relay echoes our RelayState as relay_state, and it must match our nonce. A callback without it is
      // not one this app started: the relay only returns to this app when the RelayState named it.
      const echoedState = parsed.queryParams?.relay_state as string | undefined;
      if (!echoedState || echoedState !== pending.nonce) {
        logger.warn({ message: 'SSO SAML: Rejecting saml_response with missing or mismatched RelayState', context: { path: parsed.path } });
        return null;
      }

      // Consume the pending flow so a replayed deep link is rejected
      await savePendingState(null);

      // The relay sends the department (encrypted) with the callback; discovery's token is the fallback.
      const callbackDepartmentToken = (parsed.queryParams?.department_token as string | undefined) || departmentToken || undefined;
      const result = await externalTokenRequest('saml2', samlResponse, username, departmentId, undefined, callbackDepartmentToken);

      if (result.mfaRequired) {
        // The exchange is retained by the auth api; the caller prompts for the code and
        // retries via retrySsoExchangeWithOtp.
        return 'mfa_required';
      }

      if (!result.successful || !result.authResponse) {
        logger.error({ message: 'SSO SAML: External token exchange failed', context: { message: result.message } });
        return null;
      }

      return result.authResponse;
    } catch (error) {
      logger.error({ message: 'SSO SAML: Deep link handling threw exception', context: { message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }

  return { startSamlLogin, handleSamlDeepLink };
}
