import { describe, expect, it, jest } from '@jest/globals';
import type mapboxgl from 'mapbox-gl';

import { type DispatchMapOverlay } from '@/lib/dispatch-board';
import { applyDispatchOverlay, DISPATCH_BOUNDARIES_SOURCE, DISPATCH_POINTS_SOURCE } from '@/lib/dispatch-map-layers-web';

/** Just enough of a Mapbox GL map: addSource throws until the style has loaded, as Mapbox GL does. */
const fakeMap = (styleLoaded: boolean) => {
  const sources = new Map<string, { setData: jest.Mock }>();
  const styleLoadHandlers: (() => void)[] = [];
  const map = {
    styleLoaded,
    // Also false while tiles load, after the style itself is ready
    isStyleLoaded: () => false,
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => {
      if (!map.styleLoaded) throw new Error('Style is not done loading');
      sources.set(id, { setData: jest.fn() });
    },
    addLayer: jest.fn(),
    once: (event: string, handler: () => void) => {
      if (event === 'style.load') styleLoadHandlers.push(handler);
    },
    fireStyleLoad: () => {
      map.styleLoaded = true;
      styleLoadHandlers.splice(0).forEach((handler) => handler());
    },
    sources,
  };
  return map;
};

const overlay = { points: { type: 'FeatureCollection', features: [] }, boundaries: { type: 'FeatureCollection', features: [] }, nearest: [], unitCount: 0, personCount: 0 } as unknown as DispatchMapOverlay;

describe('applyDispatchOverlay', () => {
  it('draws the overlay once the style is ready, even while tiles are still loading', () => {
    const map = fakeMap(true);

    applyDispatchOverlay(map as unknown as mapboxgl.Map, overlay);

    expect(map.sources.get(DISPATCH_POINTS_SOURCE)!.setData).toHaveBeenCalledWith(overlay.points);
    expect(map.sources.get(DISPATCH_BOUNDARIES_SOURCE)!.setData).toHaveBeenCalledWith(overlay.boundaries);
  });

  it('waits for the style when it has not loaded yet', () => {
    const map = fakeMap(false);

    applyDispatchOverlay(map as unknown as mapboxgl.Map, overlay);
    expect(map.sources.size).toBe(0);

    map.fireStyleLoad();
    expect(map.sources.get(DISPATCH_POINTS_SOURCE)!.setData).toHaveBeenCalledWith(overlay.points);
  });
});
