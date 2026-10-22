import { describe, expect, it } from '@jest/globals';

import { filterPoisByCapabilities, getPoiCapabilityOptions } from '../poi-capabilities';

type TestPoi = { PoiId: number; Name: string; Capabilities?: string[] };

const uzGent: TestPoi = { PoiId: 1, Name: 'UZ Gent', Capabilities: ['Cath Lab', 'Trauma Center', 'Maternity', 'Neurosurgery'] };
const zottegem: TestPoi = { PoiId: 2, Name: 'AZ Sint-Elisabeth Zottegem', Capabilities: ['Stroke Center', 'Maternity'] };
const uzBrussel: TestPoi = { PoiId: 3, Name: 'UZ Brussel', Capabilities: ['burn center', 'trauma center', 'Cath Lab'] };
const legacy: TestPoi = { PoiId: 4, Name: 'Older server POI' };
const pois = [uzGent, zottegem, uzBrussel, legacy];

describe('getPoiCapabilityOptions', () => {
  it('lists every capability once, alphabetically, keeping the first spelling', () => {
    expect(getPoiCapabilityOptions(pois)).toEqual(['burn center', 'Cath Lab', 'Maternity', 'Neurosurgery', 'Stroke Center', 'Trauma Center']);
  });

  it('is empty when no POI has capabilities (older servers)', () => {
    expect(getPoiCapabilityOptions([legacy, { Capabilities: [] }])).toEqual([]);
  });
});

describe('filterPoisByCapabilities', () => {
  it('keeps every POI when nothing is selected', () => {
    expect(filterPoisByCapabilities(pois, [])).toBe(pois);
  });

  it('keeps the POIs offering the selected capability, case-insensitively', () => {
    expect(filterPoisByCapabilities(pois, ['Trauma Center']).map((p) => p.PoiId)).toEqual([1, 3]);
  });

  it('needs every selected capability', () => {
    expect(filterPoisByCapabilities(pois, ['Cath Lab', 'Neurosurgery']).map((p) => p.PoiId)).toEqual([1]);
    expect(filterPoisByCapabilities(pois, ['Stroke Center', 'Cath Lab'])).toEqual([]);
  });
});
