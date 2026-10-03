import { useColorScheme } from 'nativewind';

import { getMapboxAccessToken, useMapboxAccessToken } from '@/lib/mapbox-token';
import { useCoreStore } from '@/stores/app/core-store';

/**
 * The department's Mapbox base map.
 *
 * Departments pick a day style and a night style on the web Mapping Settings screen (Streets,
 * Outdoors, Light, Dark, Satellite, Satellite Streets, Navigation Day/Night), or use their own Mapbox
 * account's custom style. The server resolves both, including the "Automatic" pairing, and ships them
 * in config as mapbox:// urls. Every base map in the app renders through here, so the choice reaches
 * every map, and the device's dark mode switches to the night style.
 *
 * The fallbacks cover only the window before config loads and servers that predate the setting. They
 * are the same Streets / Dark pair the server sends for a department that has not chosen, so a map that
 * renders during bootstrap does not visibly change style a moment later.
 */

export const FALLBACK_DAY_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
export const FALLBACK_NIGHT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

interface MapStyleConfig {
  MapDayStyleUrl?: string | null;
  MapNightStyleUrl?: string | null;
  AppMapboxAccessToken?: string | null;
}

/** Only a mapbox:// style can load on the app's own token; anything else falls back. */
const toMapboxStyle = (value: string | null | undefined, fallback: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  return trimmed.startsWith('mapbox://styles/') ? trimmed : fallback;
};

/** Mapbox's own styles load on any token; a department's custom style only on that department's token. */
const isMapboxOwnedStyle = (style: string): boolean => style.startsWith('mapbox://styles/mapbox/');

export const resolveDepartmentMapStyle = (config: MapStyleConfig | null | undefined, colorScheme: string | null | undefined, activeToken?: string | null): string => {
  const isDark = colorScheme === 'dark';
  const fallback = isDark ? FALLBACK_NIGHT_MAP_STYLE : FALLBACK_DAY_MAP_STYLE;
  const style = toMapboxStyle(isDark ? config?.MapNightStyleUrl : config?.MapDayStyleUrl, fallback);

  if (style !== fallback && !isMapboxOwnedStyle(style)) {
    // Until the token that goes with a custom style has been checked and is the one in use, a map asking
    // for that style would come back blank; show the default until the token switch lands.
    const serverToken = typeof config?.AppMapboxAccessToken === 'string' ? config.AppMapboxAccessToken.trim() : '';

    if (!serverToken || (activeToken ?? '').trim() !== serverToken) {
      return fallback;
    }
  }

  return style;
};

/** Reactive: re-renders when config lands, the device theme flips or the Mapbox token changes. */
export const useDepartmentMapStyle = (): string => {
  const { colorScheme } = useColorScheme();
  const config = useCoreStore((state) => state.config);
  const activeToken = useMapboxAccessToken();

  return resolveDepartmentMapStyle(config, colorScheme, activeToken);
};

/** Non-reactive read for imperative paths (map construction inside effects). */
export const getDepartmentMapStyle = (colorScheme: string | null | undefined): string => resolveDepartmentMapStyle(useCoreStore.getState().config, colorScheme, getMapboxAccessToken());
