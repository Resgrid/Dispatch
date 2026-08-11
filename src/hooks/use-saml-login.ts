import { randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { externalTokenRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { logger } from '@/lib/logging';
import { getItem, removeItem, setItem } from '@/lib/storage';

export interface SamlLoginHook {
  startSamlLogin: () => Promise<void>;
  handleSamlDeepLink: (url: string) => Promise<AuthResponse | null>;
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

export function useSamlLogin(idpSsoUrl: string, username: string, departmentId?: number): SamlLoginHook {
  async function startSamlLogin(): Promise<void> {
    if (!idpSsoUrl) {
      logger.error({ message: 'SSO SAML: No IdP SSO URL available' });
      return;
    }

    try {
      // Record the pending flow and ask the IdP to echo our nonce back as RelayState
      const nonce = randomUUID();
      await savePendingState({ nonce, startedAt: Date.now() });

      const separator = idpSsoUrl.includes('?') ? '&' : '?';
      const urlWithState = `${idpSsoUrl}${separator}RelayState=${encodeURIComponent(nonce)}`;

      if (Platform.OS === 'web') {
        // On web, open in the same tab so the SAML flow completes properly
        Linking.openURL(urlWithState);
      } else {
        await WebBrowser.openBrowserAsync(urlWithState);
      }
    } catch (error) {
      logger.error({ message: 'SSO SAML: Failed to open IdP browser', context: { error, idpSsoUrl } });
    }
  }

  async function handleSamlDeepLink(url: string): Promise<AuthResponse | null> {
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

      // If the IdP echoed RelayState (or a state param), it must match our nonce.
      // Absence is tolerated for IdPs that drop RelayState; the pending-flow check above still applies.
      const echoedState = (parsed.queryParams?.RelayState ?? parsed.queryParams?.state) as string | undefined;
      if (echoedState && echoedState !== pending.nonce) {
        logger.warn({ message: 'SSO SAML: Rejecting saml_response with mismatched RelayState', context: { path: parsed.path } });
        return null;
      }

      // Consume the pending flow so a replayed deep link is rejected
      await savePendingState(null);

      const result = await externalTokenRequest('saml2', samlResponse, username, departmentId);

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
