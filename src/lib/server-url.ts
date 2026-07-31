import { Env } from '@/lib/env';

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
