import { type PoiResultData } from '@/models/v4/mapping/poiResultData';

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Every capability the POIs offer (e.g. "Cath Lab", "Stroke Center"), once each and alphabetically, for the destination
 * picker's filter chips. Capabilities are department-managed in Core, so the same capability is spelled the same way on
 * every POI; matching is still case-insensitive and keeps the first spelling seen.
 */
export const getPoiCapabilityOptions = (pois: Pick<PoiResultData, 'Capabilities'>[]): string[] => {
  const byKey = new Map<string, string>();
  pois.forEach((poi) =>
    (poi.Capabilities ?? []).forEach((capability) => {
      const key = normalize(capability ?? '');
      if (key && !byKey.has(key)) byKey.set(key, capability.trim());
    })
  );

  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};

/** The POIs that offer every selected capability (a STEMI with trauma needs both), in their original order. */
export const filterPoisByCapabilities = <T extends Pick<PoiResultData, 'Capabilities'>>(pois: T[], selected: string[]): T[] => {
  const wanted = selected.map(normalize).filter(Boolean);
  if (wanted.length === 0) return pois;

  return pois.filter((poi) => {
    const offered = new Set((poi.Capabilities ?? []).map(normalize));
    return wanted.every((capability) => offered.has(capability));
  });
};
