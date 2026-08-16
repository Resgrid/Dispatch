import { useCoreStore } from '@/stores/app/core-store';

/**
 * The department's default map center.
 *
 * Every map surface — new-call location pickers, live maps, board maps — should open here when it
 * has nothing better (no call location, no device fix). Before this existed each app fell back to
 * its own hardcoded coordinates, which is how a Belgian department ended up looking at a map of
 * Nevada, and an Australian sample coordinate ended up shipping as the web fallback.
 *
 * The server always populates these: it resolves the department's configured center, falls back to
 * geocoding the department address, and finally to a system default. The guard here is only for the
 * window before config has loaded.
 */

export interface MapCenter {
  latitude: number;
  longitude: number;
  zoomLevel: number;
}

/**
 * Used only until config arrives. Deliberately the same value the server falls back to, so a map
 * that renders during bootstrap does not visibly jump somewhere else a moment later.
 */
export const FALLBACK_MAP_CENTER: MapCenter = {
  latitude: 39.14086268299356,
  longitude: -119.7583809782715,
  zoomLevel: 9,
};

const isUsableCoordinate = (value: number | null | undefined, limit: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

const toMapCenter = (latitude: number | null | undefined, longitude: number | null | undefined, zoomLevel: number | null | undefined): MapCenter => {
  // Out of range is corrupt rather than merely absent, and handing it to the map is worse than
  // showing the fallback.
  if (!isUsableCoordinate(latitude, 90) || !isUsableCoordinate(longitude, 180)) {
    return FALLBACK_MAP_CENTER;
  }

  // 0,0 is Null Island — the shape of an unset value rather than a real department, so treat it as
  // missing instead of dropping the user in the Atlantic. Only the pair: a lone zero is an ordinary
  // coordinate on the equator or the prime meridian, and rejecting those moved real departments
  // (Ghana, Ecuador, most of the UK) to the other side of the world.
  if (latitude === 0 && longitude === 0) {
    return FALLBACK_MAP_CENTER;
  }

  return {
    latitude,
    longitude,
    // Infinity is greater than zero, so the positivity test alone would let it reach the camera.
    zoomLevel: typeof zoomLevel === 'number' && Number.isFinite(zoomLevel) && zoomLevel > 0 ? zoomLevel : FALLBACK_MAP_CENTER.zoomLevel,
  };
};

/** Reactive: re-renders when config lands. */
export const useDepartmentMapCenter = (): MapCenter => {
  const config = useCoreStore((state) => state.config);

  return toMapCenter(config?.MapCenterLatitude, config?.MapCenterLongitude, config?.MapCenterZoomLevel);
};

/** Non-reactive read for imperative paths (effects, camera setup, one-shot defaults). */
export const getDepartmentMapCenter = (): MapCenter => {
  const config = useCoreStore.getState().config;

  return toMapCenter(config?.MapCenterLatitude, config?.MapCenterLongitude, config?.MapCenterZoomLevel);
};
