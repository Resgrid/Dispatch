import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { externalTokenRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { logger } from '@/lib/logging';

export interface SamlLoginHook {
  startSamlLogin: () => Promise<void>;
  handleSamlDeepLink: (url: string) => Promise<AuthResponse | null>;
}

export function useSamlLogin(idpSsoUrl: string, username: string, departmentId?: number): SamlLoginHook {
  async function startSamlLogin(): Promise<void> {
    if (!idpSsoUrl) {
      logger.error({ message: 'SSO SAML: No IdP SSO URL available' });
      return;
    }

    try {
      if (Platform.OS === 'web') {
        // On web, open in the same tab so the SAML flow completes properly
        Linking.openURL(idpSsoUrl);
      } else {
        await WebBrowser.openBrowserAsync(idpSsoUrl);
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
