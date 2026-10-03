import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MAPBOX_BUILT_IN_TOKEN } from '@/lib/mapbox-built-in-token';
import { zustandStorage } from '@/lib/storage';

/**
 * Which Mapbox token the app renders maps and calls Mapbox services (directions, geocoding, static
 * images) with.
 *
 * The server hands out a public token in config (`AppMapboxAccessToken`): the department's own token
 * when its Mapbox override is on, otherwise the token the installation configures for this app. A token
 * the server sends is checked with Mapbox once, kept on the device, and used from then on, so a token
 * can be rotated without an app release. Whenever the server sends none, or Mapbox says the token is
 * invalid, expired or revoked, the app goes back to the token built into it.
 *
 * Storage is synchronous (MMKV), so the stored token is already in place when modules that call the
 * Mapbox SDK at import time read it.
 */

/** Public tokens only: "pk." plus a base64url payload and signature. Secret (sk.) tokens never qualify. */
const PUBLIC_TOKEN_PATTERN = /^pk\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+$/;

/** A token in use is re-checked this often; a rejected token is not re-checked sooner than this. */
export const MAPBOX_TOKEN_RECHECK_MS = 24 * 60 * 60 * 1000;

const MAPBOX_TOKEN_CHECK_URL = 'https://api.mapbox.com/tokens/v2';

interface MapboxTokenState {
  /** Server token that Mapbox confirmed valid; null = use the built-in token. */
  token: string | null;
  verifiedAt: number | null;
  /** Last server token Mapbox refused, so it is not re-checked on every config load. */
  rejectedToken: string | null;
  rejectedAt: number | null;
}

const EMPTY_STATE: MapboxTokenState = { token: null, verifiedAt: null, rejectedToken: null, rejectedAt: null };

export const useMapboxTokenStore = create<MapboxTokenState>()(
  persist(() => ({ ...EMPTY_STATE }), {
    name: 'mapbox-token-storage',
    storage: createJSONStorage(() => zustandStorage),
  })
);

export const isUsableMapboxToken = (value: string | null | undefined): value is string => typeof value === 'string' && PUBLIC_TOKEN_PATTERN.test(value.trim());

export const getBuiltInMapboxToken = (): string => (typeof MAPBOX_BUILT_IN_TOKEN === 'string' ? MAPBOX_BUILT_IN_TOKEN.trim() : '');

const resolveToken = (stored: string | null | undefined): string => (isUsableMapboxToken(stored) ? stored.trim() : getBuiltInMapboxToken());

/** Non-reactive: the token to use right now (stored server token, else built-in). */
export const getMapboxAccessToken = (): string => resolveToken(useMapboxTokenStore.getState().token);

/** Reactive: re-renders when the token in use changes. */
export const useMapboxAccessToken = (): string => useMapboxTokenStore((state) => resolveToken(state.token));

/**
 * Calls `listener` with the token in use now and again whenever it changes. Store listeners run
 * synchronously inside the state change, before React re-renders, so an SDK token set here is in place
 * before any map re-renders with a style that needs it.
 */
export const onMapboxAccessTokenChange = (listener: (token: string) => void): (() => void) => {
  listener(getMapboxAccessToken());

  return useMapboxTokenStore.subscribe((state, previous) => {
    const next = resolveToken(state.token);

    if (next !== resolveToken(previous.token)) {
      listener(next);
    }
  });
};

export type MapboxTokenVerdict = 'valid' | 'invalid' | 'unknown';

const REFUSED_CODES = ['TokenInvalid', 'TokenExpired', 'TokenRevoked', 'TokenMalformed'];

/** Asks Mapbox whether a token works. Network trouble is 'unknown', never 'invalid'. */
export const verifyMapboxToken = async (token: string): Promise<MapboxTokenVerdict> => {
  try {
    const response = await fetch(`${MAPBOX_TOKEN_CHECK_URL}?access_token=${encodeURIComponent(token)}`);
    const body = (await response.json().catch(() => null)) as { code?: string } | null;

    if (body?.code === 'TokenValid') {
      return 'valid';
    }

    if (body?.code && REFUSED_CODES.includes(body.code)) {
      return 'invalid';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * Applies the token from a successful config load. Call it only when config actually arrived: an
 * empty or missing token (an older server, or none configured) drops back to the built-in token.
 */
export const applyServerMapboxToken = async (serverToken: string | null | undefined, now: number = Date.now()): Promise<void> => {
  const candidate = typeof serverToken === 'string' ? serverToken.trim() : '';
  const state = useMapboxTokenStore.getState();

  if (!isUsableMapboxToken(candidate)) {
    if (state.token !== null) {
      useMapboxTokenStore.setState({ token: null, verifiedAt: null });
    }
    return;
  }

  if (candidate === state.token && state.verifiedAt !== null && now - state.verifiedAt < MAPBOX_TOKEN_RECHECK_MS) {
    return;
  }

  if (candidate === state.rejectedToken && state.rejectedAt !== null && now - state.rejectedAt < MAPBOX_TOKEN_RECHECK_MS) {
    // Refused recently. The server is still sending it, so the stored token (if any) is stale too.
    if (state.token !== null) {
      useMapboxTokenStore.setState({ token: null, verifiedAt: null });
    }
    return;
  }

  const verdict = await verifyMapboxToken(candidate);

  if (verdict === 'valid') {
    useMapboxTokenStore.setState({ token: candidate, verifiedAt: Date.now(), rejectedToken: null, rejectedAt: null });
  } else if (verdict === 'invalid') {
    useMapboxTokenStore.setState({ token: null, verifiedAt: null, rejectedToken: candidate, rejectedAt: Date.now() });
  }
  // 'unknown' (offline, Mapbox unreachable): keep whatever is in use and try again on the next config load.
};

/** Forget the server token (sign-out, server switch); the built-in token is used until config loads again. */
export const clearMapboxToken = (): void => {
  useMapboxTokenStore.setState({ ...EMPTY_STATE });
};
