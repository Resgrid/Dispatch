import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { externalTokenRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { logger } from '@/lib/logging';
import { SSO_RETURN_SCHEME } from '@/lib/mfa/client-app';
import { isSharedInstallation } from '@/lib/mfa/shared-installation';

// Required for iOS to close the system browser after OIDC redirect
WebBrowser.maybeCompleteAuthSession();

export interface OidcLoginResult {
  request: AuthSession.AuthRequest | null;
  response: AuthSession.AuthSessionResult | null;
  promptAsync: (options?: AuthSession.AuthRequestPromptOptions) => Promise<AuthSession.AuthSessionResult>;
  exchangeCodeForResgridToken: () => Promise<AuthResponse | 'mfa_required' | null>;
  /** The Resgrid exchange for an id_token the app already holds (the desktop app's main process redeems the code itself). */
  exchangeIdTokenForResgridToken: (idToken: string) => Promise<AuthResponse | 'mfa_required' | null>;
}

export function useOidcLogin(authority: string, clientId: string, username: string, departmentId?: number, departmentToken?: string | null): OidcLoginResult {
  // The lowercase app scheme the department registers with its IdP (resgriddispatch://auth/callback): IdPs compare
  // redirect URIs as exact strings, and Android matches intent-filter schemes case-sensitively.
  const redirectUri = AuthSession.makeRedirectUri(Platform.OS === 'web' ? { path: 'login/sso' } : { scheme: SSO_RETURN_SCHEME, path: 'auth/callback' });

  // Pass null when authority is empty to prevent useAutoDiscovery from throwing
  // "Expected a valid discovery object or issuer URL" before config is loaded
  const discovery = AuthSession.useAutoDiscovery(authority || (null as unknown as string));

  // A shared installation's browser may still hold the last operator's provider session: the provider must authenticate the
  // member again, and on iOS the sign-in keeps no cookies (Android's browser always shares Chrome's). The server refuses a
  // sign-in that is not fresh (plan section 12.5.2).
  const shared = isSharedInstallation();
  const [request, response, promptRequest] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'placeholder',
      redirectUri,
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
      ...(shared ? { prompt: 'login' as AuthSession.Prompt, extraParams: { max_age: '0' } } : {}),
    },
    discovery
  );
  const promptAsync = (options?: AuthSession.AuthRequestPromptOptions) => promptRequest({ preferEphemeralSession: shared, ...options });

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
      return await exchangeIdTokenForResgridToken(idToken);
    } catch (error) {
      logger.error({ message: 'SSO OIDC: Token exchange threw exception', context: { error } });
      return null;
    }
  }

  async function exchangeIdTokenForResgridToken(idToken: string): Promise<AuthResponse | 'mfa_required' | null> {
    const result = await externalTokenRequest('oidc', idToken, username, departmentId, undefined, departmentToken ?? undefined);

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
  }

  return { request, response, promptAsync, exchangeCodeForResgridToken, exchangeIdTokenForResgridToken };
}
