import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type PoiLayerData } from '@/models/v4/mapping/poiLayerData';

import { MapMarkerEntityType } from './destination-helpers';

export const getPoiMapLayerId = (poiTypeId: number) => `poi-${poiTypeId}`;

export const createDefaultVisiblePoiLayerIds = (poiLayers: PoiLayerData[]) => {
  return new Set(poiLayers.map((poiLayer) => getPoiMapLayerId(poiLayer.PoiTypeId)));
};

/**
 * Carries the user's POI layer toggles across a map data refresh.
 *
 * Layers the map already knew keep whatever visibility the user gave them, layers that are new in this refresh
 * start visible (the default), and layers that disappeared are dropped. Returns `current` itself when nothing
 * changed, so a background refetch does not re-filter or re-render the pins.
 */
export const mergeVisiblePoiLayerIds = (current: Set<string>, previousPoiLayers: PoiLayerData[], nextPoiLayers: PoiLayerData[]) => {
  const previousIds = new Set(previousPoiLayers.map((poiLayer) => getPoiMapLayerId(poiLayer.PoiTypeId)));

  const merged = new Set<string>();
  nextPoiLayers.forEach((poiLayer) => {
    const layerId = getPoiMapLayerId(poiLayer.PoiTypeId);
    if (!previousIds.has(layerId) || current.has(layerId)) {
      merged.add(layerId);
    }
  });

  if (merged.size === current.size && Array.from(merged).every((layerId) => current.has(layerId))) {
    return current;
  }
  return merged;
};

export const filterMapPinsByPoiLayers = (pins: MapMakerInfoData[], visiblePoiLayerIds: Set<string>) => {
  return pins.filter((pin) => {
    if (pin.Type !== MapMarkerEntityType.Poi || pin.PoiTypeId == null) {
      return true;
    }

    return visiblePoiLayerIds.has(getPoiMapLayerId(pin.PoiTypeId));
  });
};
