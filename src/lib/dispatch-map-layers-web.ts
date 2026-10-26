import type mapboxgl from 'mapbox-gl';

import { type DispatchMapOverlay } from '@/lib/dispatch-board';

/*
 * The dispatch overlay (available units and personnel, group boundaries) as Mapbox GL sources and layers, for the web
 * location picker. Sources live in the style, so a style switch (day/night) drops them: call `applyDispatchOverlay`
 * again on 'style.load'.
 */

export const DISPATCH_POINTS_SOURCE = 'dispatch-resources';
export const DISPATCH_BOUNDARIES_SOURCE = 'dispatch-boundaries';
export const DISPATCH_POINTS_LAYER = 'dispatch-resources-circle';
const DISPATCH_LABELS_LAYER = 'dispatch-resources-label';
const DISPATCH_BOUNDARY_FILL_LAYER = 'dispatch-boundaries-fill';
const DISPATCH_BOUNDARY_LINE_LAYER = 'dispatch-boundaries-line';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const isUnit: mapboxgl.Expression = ['==', ['get', 'kind'], 'unit'];

const ensureLayers = (map: mapboxgl.Map) => {
  if (!map.getSource(DISPATCH_BOUNDARIES_SOURCE)) {
    map.addSource(DISPATCH_BOUNDARIES_SOURCE, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: DISPATCH_BOUNDARY_FILL_LAYER, type: 'fill', source: DISPATCH_BOUNDARIES_SOURCE, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } });
    map.addLayer({ id: DISPATCH_BOUNDARY_LINE_LAYER, type: 'line', source: DISPATCH_BOUNDARIES_SOURCE, paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.85 } });
  }

  if (!map.getSource(DISPATCH_POINTS_SOURCE)) {
    map.addSource(DISPATCH_POINTS_SOURCE, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: DISPATCH_POINTS_LAYER,
      type: 'circle',
      source: DISPATCH_POINTS_SOURCE,
      paint: {
        'circle-radius': ['case', isUnit, 8, 6],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['case', isUnit, 2.5, 1.5],
        // Only available resources are in the overlay (buildDispatchMapOverlay leaves the rest off), so all draw solid.
      },
    });
    map.addLayer({
      id: DISPATCH_LABELS_LAYER,
      type: 'symbol',
      source: DISPATCH_POINTS_SOURCE,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    });
  }
};

/** Puts the overlay on the map (or clears it with null). Safe to call before the style has loaded: it waits for it. */
export const applyDispatchOverlay = (map: mapboxgl.Map, overlay: DispatchMapOverlay | null | undefined) => {
  const apply = () => {
    ensureLayers(map);
    (map.getSource(DISPATCH_BOUNDARIES_SOURCE) as mapboxgl.GeoJSONSource).setData(overlay?.boundaries ?? EMPTY);
    (map.getSource(DISPATCH_POINTS_SOURCE) as mapboxgl.GeoJSONSource).setData(overlay?.points ?? EMPTY);
  };

  // Not gated on isStyleLoaded(): it is also false while tiles load (a pan or zoom), and 'style.load' does not fire
  // again until the next style switch, so the update would be dropped. Sources and layers can be added as soon as the
  // style itself has loaded; before that addSource throws, and the overlay waits for the style.
  try {
    apply();
  } catch {
    map.once('style.load', apply);
  }
};

/** The resource under a map click, if any: its name and detail line for a popup. */
export const dispatchFeatureAt = (map: mapboxgl.Map, point: mapboxgl.PointLike): { name: string; detail: string; coordinates: [number, number] } | null => {
  if (!map.getLayer(DISPATCH_POINTS_LAYER)) return null;

  const feature = map.queryRenderedFeatures(point, { layers: [DISPATCH_POINTS_LAYER] })[0];
  if (!feature || feature.geometry.type !== 'Point') return null;

  const properties = (feature.properties ?? {}) as { name?: string; detail?: string };
  return { name: properties.name ?? '', detail: properties.detail ?? '', coordinates: feature.geometry.coordinates as [number, number] };
};
