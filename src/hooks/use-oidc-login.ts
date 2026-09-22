import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { externalTokenRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';

// Required for iOS to close the system browser after OIDC redirect
WebBrowser.maybeCompleteAuthSession();

export interface OidcLoginResult {
  request: AuthSession.AuthRequest | null;
  response: AuthSession.AuthSessionResult | null;
  promptAsync: (options?: AuthSession.AuthRequestPromptOptions) => Promise<AuthSession.AuthSessionResult>;
  exchangeCodeForResgridToken: () => Promise<AuthResponse | 'mfa_required' | null>;
}

export function useOidcLogin(authority: string, clientId: string, username: string, departmentId?: number): OidcLoginResult {
  const redirectUri = AuthSession.makeRedirectUri(Platform.OS === 'web' ? { path: 'login/sso' } : { scheme: Env.SCHEME, path: 'auth/callback' });

  // Pass null when authority is empty to prevent useAutoDiscovery from throwing
  // "Expected a valid discovery object or issuer URL" before config is loaded
  const discovery = AuthSession.useAutoDiscovery(authority || (null as unknown as string));

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'placeholder',
      redirectUri,
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  async function exchangeCodeForResgridToken(): Promise<AuthResponse | 'mfa_required' | null> {
    if (response?.type !== 'success' || !request?.codeVerifier || !discovery) {
      logger.error({
        message: 'SSO OIDC: Cannot exchange code — missing response, code verifier, or discovery',
        context: { responseType: response?.type },
      });
      return null;
    }

    try {
      // Step 1: Exchange the authorization code for an id_token at the IdP
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: clientId,
          redirectUri,
          code: (response as AuthSession.AuthSessionResult & { params: { code: string } }).params.code,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery
      );

      const idToken = tokenResponse.idToken;
      if (!idToken) {
        logger.error({ message: 'SSO OIDC: No id_token in IdP token response' });
        return null;
      }

      // Step 2: Exchange the id_token for a Resgrid access token
      const result = await externalTokenRequest('oidc', idToken, username, departmentId);

      if (result.mfaRequired) {
        // The exchange is retained by the auth api; the caller prompts for the code and
        // retries via retrySsoExchangeWithOtp.
        return 'mfa_required';
      }

      if (!result.successful || !result.authResponse) {
        logger.error({ message: 'SSO OIDC: External token exchange failed', context: { message: result.message } });
        return null;
      }

      return result.authResponse;
    } catch (error) {
      logger.error({ message: 'SSO OIDC: Token exchange threw exception', context: { error } });
      return null;
    }
  }

  return { request, response, promptAsync, exchangeCodeForResgridToken };
}
