import { getSystemConfig } from '@/api/config';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { type ResgridSystemLocation } from '@/models/v4/configs/getSystemConfigResultData';

/**
 * Shared helpers for resolving the Resgrid base API URL from either a selected
 * hosted site or a user-supplied custom URL. Used by the settings/login server
 * selector (native bottom sheet) and the web login server modal so both stay
 * consistent in how they normalize, compare and persist URLs.
 */

// Sentinel value used for the "Custom" option in the hosted-site dropdown.
export const CUSTOM_SERVER_VALUE = '__custom__';

// Matches https:// URLs. Plain http:// is only allowed for local development
// hosts (localhost / 127.0.0.1) - anything else would send the password grant
// and bearer tokens in cleartext.
export const URL_PATTERN = /^(https:\/\/.+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?([/?#].*)?)$/i;

// The Resgrid hosted sites, mirroring the hosted /Config/GetSystemConfig response. They are
// always offered in the dropdown so a user on an unreachable or self-hosted custom URL (whose
// config can't be loaded, or doesn't list them) can still switch back to a hosted site.
export const RESGRID_HOSTED_LOCATIONS: readonly ResgridSystemLocation[] = [
  {
    Name: 'US-West',
    DisplayName: 'Resgrid North America (Global)',
    LocationInfo: '',
    IsDefault: true,
    ApiUrl: 'https://api.resgrid.com',
    AllowsFreeAccounts: true,
  },
  {
    Name: 'EU-Central',
    DisplayName: 'Resgrid Europe',
    LocationInfo: '',
    IsDefault: false,
    ApiUrl: 'https://api-eu-central.resgrid.com',
    AllowsFreeAccounts: false,
  },
];

// The API path suffix (e.g. /api/v4) appended to every base URL.
const API_PATH_SUFFIX = `/api/${Env.API_VERSION}`;

// Trim whitespace and strip any trailing slashes from a URL.
const stripTrailingSlashes = (url: string) => url.trim().replace(/\/+$/, '');

// Reduce a stored/hosted URL to its bare base (no /api/vX suffix, no trailing
// slash) so hosted-site URLs and the persisted URL can be compared and edited
// consistently regardless of whether they already include the API suffix.
export const toBaseUrl = (url: string) => stripTrailingSlashes(url).replace(/\/api\/v\d+$/i, '');

// Build the full API URL (base + /api/vX) that gets persisted and read by the
// API client. Always produces exactly one API suffix to avoid /api/v4/api/v4.
export const buildApiUrl = (url: string) => `${toBaseUrl(url)}${API_PATH_SUFFIX}`;

// Hostnames are case-insensitive, so compare bases the same way.
const toComparableUrl = (url: string) => toBaseUrl(url).toLowerCase();

// Whether two URLs (with or without the /api/vX suffix) point at the same server.
export const isSameServerUrl = (a: string, b: string) => toComparableUrl(a) === toComparableUrl(b);

// Find the site whose API URL matches the given (stored or entered) URL.
export const findLocationByUrl = (locations: readonly ResgridSystemLocation[], url: string) => locations.find((location) => isSameServerUrl(location.ApiUrl, url));

// Combine the sites reported by the server with the built-in hosted sites. Server-reported
// entries come first and win on a duplicate URL or name (names are the dropdown values).
export const mergeServerLocations = (fetched: readonly ResgridSystemLocation[]): ResgridSystemLocation[] => {
  const valid = fetched.filter((location) => !!location?.Name && !!location?.ApiUrl);
  const missing = RESGRID_HOSTED_LOCATIONS.filter((hosted) => !valid.some((location) => location.Name === hosted.Name || isSameServerUrl(location.ApiUrl, hosted.ApiUrl)));
  return [...valid, ...missing];
};

// Load the selectable sites from the configured server, falling back to the built-in hosted
// sites when it can't be reached so the dropdown is never left with only "Custom".
export const loadServerLocations = async (): Promise<ResgridSystemLocation[]> => {
  let fetched: ResgridSystemLocation[] = [];
  try {
    const result = await getSystemConfig();
    fetched = result?.Data?.Locations ?? [];
  } catch (error) {
    logger.warn({
      message: 'Failed to load Resgrid hosted sites, using built-in list',
      context: { error },
    });
  }
  return mergeServerLocations(fetched);
};
