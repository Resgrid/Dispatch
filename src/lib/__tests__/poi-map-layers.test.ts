import { createDefaultVisiblePoiLayerIds, mergeVisiblePoiLayerIds } from '@/lib/poi-map-layers';
import { type PoiLayerData } from '@/models/v4/mapping/poiLayerData';

const layer = (poiTypeId: number): PoiLayerData => ({ PoiTypeId: poiTypeId, Name: `Layer ${poiTypeId}`, Color: '', ImagePath: '', PoiImage: '', Marker: '', IsDestination: false });

describe('mergeVisiblePoiLayerIds', () => {
  it('keeps a layer the user hid hidden across a refresh', () => {
    const layers = [layer(1), layer(2)];
    const current = new Set(['poi-1']);

    const merged = mergeVisiblePoiLayerIds(current, layers, [layer(1), layer(2)]);

    expect(merged).toBe(current);
    expect(Array.from(merged)).toEqual(['poi-1']);
  });

  it('shows layers that are new in the refresh and drops ones that disappeared', () => {
    const current = new Set(['poi-1']);

    const merged = mergeVisiblePoiLayerIds(current, [layer(1), layer(2)], [layer(2), layer(3)]);

    expect(Array.from(merged).sort()).toEqual(['poi-3']);
  });

  it('returns the same set when the defaults are unchanged', () => {
    const layers = [layer(1), layer(2)];
    const current = createDefaultVisiblePoiLayerIds(layers);

    expect(mergeVisiblePoiLayerIds(current, layers, [layer(1), layer(2)])).toBe(current);
  });
});
