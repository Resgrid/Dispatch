import { isSameServerUrl, RESGRID_HOSTED_LOCATIONS } from '@/lib/server-url';

/** Which server a sign-in goes to, as the login form labels it. */
export type LoginServerKind = 'us_west' | 'eu_central' | 'custom';

export interface LoginServer {
  kind: LoginServerKind;
  /** The server's host name, shown beside "Custom" so a self-hosted or test server is recognizable. */
  host: string;
}

const HOSTED_KINDS: Record<string, LoginServerKind> = {
  'US-West': 'us_west',
  'EU-Central': 'eu_central',
};

// RN's URL polyfill does not implement hostname, so the host is read from the address directly.
const hostOf = (url: string) => /^[a-z][a-z\d+.-]*:\/\/([^/?#]+)/i.exec(url.trim())?.[1]?.toLowerCase() ?? url.trim();

/** Names the server behind an API URL (with or without the /api/vX suffix): a Resgrid hosted site, or a custom one. */
export const describeLoginServer = (apiUrl: string): LoginServer => {
  const hosted = RESGRID_HOSTED_LOCATIONS.find((location) => isSameServerUrl(location.ApiUrl, apiUrl));
  return { kind: (hosted && HOSTED_KINDS[hosted.Name]) || 'custom', host: hostOf(apiUrl) };
};
