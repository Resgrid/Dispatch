import mapboxgl from 'mapbox-gl';

import { getMapboxAccessToken, onMapboxAccessTokenChange } from '@/lib/mapbox-token';

/**
 * Web only (imports mapbox-gl; import it from `.web.tsx` files only, never from code that ships in the
 * native bundles).
 *
 * Points mapbox-gl's global token at the token in use and keeps it there. The store listener runs
 * synchronously inside a token change, before React re-renders, so a map that restyles to a style that
 * needs the new token (a department's custom style) already requests it with that token.
 */
let stopSync: (() => void) | null = null;

/** Call right before constructing a mapbox-gl map. Idempotent. */
export const applyMapboxGlAccessToken = (): void => {
  mapboxgl.accessToken = getMapboxAccessToken();

  if (!stopSync) {
    stopSync = onMapboxAccessTokenChange((token) => {
      mapboxgl.accessToken = token;
    });
  }
};
