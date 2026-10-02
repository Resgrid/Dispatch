import axios from 'axios';

import { logger } from '@/lib/logging';
import { CLIENT_HEADER, RESGRID_CLIENT } from '@/lib/mfa/client-app';
import { getBaseApiUrl } from '@/lib/storage/app';

import type { SsoConfig } from '../lib/auth/types';

type WireConfig = Record<string, unknown>;

/**
 * The v4 API is PascalCase (`SsoEnabled`, `Authority`, ...), like every other v4 model; reading the camelCase names left
 * every field undefined, so SSO looked disabled. Both spellings are read so an older server still works.
 */
const read = (data: WireConfig, name: string): unknown => data[name.charAt(0).toUpperCase() + name.slice(1)] ?? data[name];

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

export const normalizeSsoConfig = (data: unknown): SsoConfig | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const wire = data as WireConfig;
  const providerType = text(read(wire, 'providerType'));
  const departmentId = read(wire, 'departmentId');
  return {
    ssoEnabled: read(wire, 'ssoEnabled') === true,
    providerType: providerType === 'oidc' || providerType === 'saml2' ? providerType : null,
    authority: text(read(wire, 'authority')),
    clientId: text(read(wire, 'clientId')),
    metadataUrl: text(read(wire, 'metadataUrl')),
    entityId: text(read(wire, 'entityId')),
    samlLoginUrl: text(read(wire, 'samlLoginUrl')),
    allowLocalLogin: read(wire, 'allowLocalLogin') !== false,
    requireSso: read(wire, 'requireSso') === true,
    requireMfa: read(wire, 'requireMfa') === true,
    oidcRedirectUri: text(read(wire, 'oidcRedirectUri')),
    oidcScopes: text(read(wire, 'oidcScopes')),
    departmentCode: text(read(wire, 'departmentCode')),
    departmentId: typeof departmentId === 'number' && departmentId > 0 ? departmentId : null,
    departmentToken: text(read(wire, 'departmentToken')),
    brokeredSsoAvailable: read(wire, 'brokeredSsoAvailable') === true,
  };
};

// The server answers with this app's own legacy OIDC redirect URI (each app has its own scheme), so it is told which app
// is asking.
const clientHeaders = { [CLIENT_HEADER]: RESGRID_CLIENT };

export async function fetchSsoConfigForUser(username: string, departmentId?: number): Promise<SsoConfig | null> {
  const requestId = `sso-${Date.now().toString(36)}`;
  try {
    const baseUrl = getBaseApiUrl();
    const params: Record<string, string | number> = { username };
    if (departmentId) {
      params.departmentId = departmentId;
    }

    const response = await axios.get(`${baseUrl}/connect/sso-config-for-user`, { params, headers: clientHeaders });

    logger.info({
      message: 'SSO: Fetched SSO config for user',
      context: { requestId, ssoEnabled: normalizeSsoConfig(response.data?.Data)?.ssoEnabled ?? false, outcome: 'success' },
    });

    return normalizeSsoConfig(response.data?.Data);
  } catch (error) {
    logger.error({
      message: 'SSO: Failed to fetch SSO config for user',
      context: { requestId, outcome: 'failure', error },
    });
    throw error instanceof Error ? error : new Error('Failed to fetch SSO config');
  }
}
