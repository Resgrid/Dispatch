import { applyLiveLocations, isValidLiveCoordinate, type LiveLocation, type LiveLocations, parsePersonnelLocationUpdate, parseUnitLocationUpdate, upsertLiveLocation } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

const RECEIVED_AT = 1_758_808_991_000;
const GUID = '6F9619FF-8B86-D011-B42D-00C04FC964FF';

const makePin = (overrides: Partial<MapMakerInfoData>): MapMakerInfoData => ({
  Id: 'u1',
  Longitude: -74.006,
  Latitude: 40.7128,
  Title: 'Pin',
  zIndex: 0,
  ImagePath: '',
  InfoWindowContent: '',
  Color: '',
  Type: 1,
  PoiImage: '',
  Marker: '',
  PoiTypeId: null,
  PoiTypeName: '',
  Address: '',
  Note: '',
  LayerId: '',
  LayerName: '',
  ...overrides,
});

const makeLocation = (overrides: Partial<LiveLocation>): LiveLocation => ({
  pinId: 'u12',
  latitude: 41,
  longitude: -73,
  timestamp: null,
  receivedAt: RECEIVED_AT,
  ...overrides,
});

describe('parseUnitLocationUpdate', () => {
  it('parses the camelCase payload the hub sends', () => {
    const payload = { departmentId: 1, unitId: '12', latitude: 39.1, longitude: -119.8, recordId: 'r1', timestamp: '2026-09-25T14:03:11.123Z' };

    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)).toEqual({
      pinId: 'u12',
      latitude: 39.1,
      longitude: -119.8,
      timestamp: Date.parse('2026-09-25T14:03:11.123Z'),
      receivedAt: RECEIVED_AT,
    });
  });

  it('accepts PascalCase fields and a numeric unit id', () => {
    const payload = { DepartmentId: 1, UnitId: 12, Latitude: 39.1, Longitude: -119.8, Timestamp: '2026-09-25T14:03:11Z' };

    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)).toMatchObject({ pinId: 'u12', latitude: 39.1, longitude: -119.8, timestamp: Date.parse('2026-09-25T14:03:11Z') });
  });

  it('accepts the payload as a JSON string', () => {
    const payload = JSON.stringify({ unitId: '7', latitude: '39.5', longitude: '-119.5' });

    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)).toMatchObject({ pinId: 'u7', latitude: 39.5, longitude: -119.5 });
  });

  it.each([
    ['a missing timestamp', { unitId: '1', latitude: 39, longitude: -119 }],
    ['a null timestamp', { unitId: '1', latitude: 39, longitude: -119, timestamp: null }],
    ['an unparseable timestamp', { unitId: '1', latitude: 39, longitude: -119, timestamp: 'not a date' }],
  ])('treats %s as unknown', (_label, payload) => {
    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)?.timestamp).toBeNull();
  });

  it.each([
    ['latitude out of range', { unitId: '1', latitude: 91, longitude: 10 }],
    ['longitude out of range', { unitId: '1', latitude: 10, longitude: -180.5 }],
    ['0,0', { unitId: '1', latitude: 0, longitude: 0 }],
    ['a non-finite coordinate', { unitId: '1', latitude: Number.NaN, longitude: 10 }],
    ['an empty coordinate string', { unitId: '1', latitude: '', longitude: 10 }],
    ['a missing unit id', { latitude: 10, longitude: 10 }],
    ['a blank unit id', { unitId: '  ', latitude: 10, longitude: 10 }],
  ])('rejects %s', (_label, payload) => {
    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)).toBeNull();
  });

  it.each([null, undefined, 42, 'not json', '[1,2]', []])('rejects an unusable payload (%p)', (payload) => {
    expect(parseUnitLocationUpdate(payload, RECEIVED_AT)).toBeNull();
  });
});

describe('parsePersonnelLocationUpdate', () => {
  it('lower-cases the user id into a p-prefixed pin id', () => {
    const payload = { departmentId: 1, userId: GUID, latitude: 39.1, longitude: -119.8, recordId: 'r1', timestamp: null };

    expect(parsePersonnelLocationUpdate(payload, RECEIVED_AT)).toEqual({ pinId: `p${GUID.toLowerCase()}`, latitude: 39.1, longitude: -119.8, timestamp: null, receivedAt: RECEIVED_AT });
  });

  it('accepts PascalCase fields', () => {
    expect(parsePersonnelLocationUpdate({ UserId: GUID, Latitude: 1.5, Longitude: 2.5 }, RECEIVED_AT)).toMatchObject({ pinId: `p${GUID.toLowerCase()}`, latitude: 1.5, longitude: 2.5 });
  });

  it('does not read a unit id as a user id', () => {
    expect(parsePersonnelLocationUpdate({ unitId: '12', latitude: 1.5, longitude: 2.5 }, RECEIVED_AT)).toBeNull();
  });
});

describe('isValidLiveCoordinate', () => {
  it('accepts the range edges but not Null Island', () => {
    expect(isValidLiveCoordinate(90, 180)).toBe(true);
    expect(isValidLiveCoordinate(-90, -180)).toBe(true);
    expect(isValidLiveCoordinate(0, 12)).toBe(true);
    expect(isValidLiveCoordinate(0, 0)).toBe(false);
    expect(isValidLiveCoordinate(Number.POSITIVE_INFINITY, 0)).toBe(false);
  });
});

describe('upsertLiveLocation', () => {
  it('adds a new entity immutably', () => {
    const current: LiveLocations = {};
    const next = upsertLiveLocation(current, makeLocation({}));

    expect(next).not.toBe(current);
    expect(current).toEqual({});
    expect(next.u12).toMatchObject({ latitude: 41, longitude: -73 });
  });

  it('ignores a fix older than the one already held', () => {
    const current: LiveLocations = { u12: makeLocation({ timestamp: 2000 }) };

    expect(upsertLiveLocation(current, makeLocation({ timestamp: 1000, latitude: 1 }))).toBe(current);
  });

  it('applies a newer fix', () => {
    const current: LiveLocations = { u12: makeLocation({ timestamp: 1000 }) };
    const next = upsertLiveLocation(current, makeLocation({ timestamp: 2000, latitude: 42 }));

    expect(next.u12.latitude).toBe(42);
  });

  it('always applies a fix with an unknown time, and a known fix after an unknown one', () => {
    const current: LiveLocations = { u12: makeLocation({ timestamp: 2000 }) };
    const withUnknown = upsertLiveLocation(current, makeLocation({ timestamp: null, latitude: 43 }));
    expect(withUnknown.u12.latitude).toBe(43);

    const withKnown = upsertLiveLocation(withUnknown, makeLocation({ timestamp: 1000, latitude: 44 }));
    expect(withKnown.u12.latitude).toBe(44);
  });

  it('drops an identical repeat of the same fix', () => {
    const current: LiveLocations = { u12: makeLocation({ timestamp: 2000 }) };

    expect(upsertLiveLocation(current, makeLocation({ timestamp: 2000, receivedAt: RECEIVED_AT + 5 }))).toBe(current);
  });
});

describe('applyLiveLocations', () => {
  const pins = [makePin({ Id: 'c5', Type: 0 }), makePin({ Id: 'u12', Type: 1 }), makePin({ Id: `p${GUID}`, Type: 3 }), makePin({ Id: 's3', Type: 2 })];

  it('returns the same array when there is nothing to apply', () => {
    const result = applyLiveLocations(pins, {});

    expect(result.pins).toBe(pins);
    expect(result.unknownPinIds).toEqual([]);
  });

  it('returns the same array when the live position equals the pin position', () => {
    const live: LiveLocations = { u12: makeLocation({ latitude: 40.7128, longitude: -74.006 }) };

    expect(applyLiveLocations(pins, live).pins).toBe(pins);
  });

  it('moves a pin immutably, replacing only the moved pin', () => {
    const live: LiveLocations = { u12: makeLocation({ latitude: 41, longitude: -73 }) };
    const result = applyLiveLocations(pins, live);

    expect(result.pins).not.toBe(pins);
    expect(result.pins[1]).not.toBe(pins[1]);
    expect(result.pins[1]).toMatchObject({ Id: 'u12', Latitude: 41, Longitude: -73, Title: 'Pin' });
    expect(pins[1]).toMatchObject({ Latitude: 40.7128, Longitude: -74.006 });
    expect(result.pins[0]).toBe(pins[0]);
    expect(result.pins[2]).toBe(pins[2]);
    expect(result.pins[3]).toBe(pins[3]);
  });

  it('matches personnel pin ids case-insensitively', () => {
    const live: LiveLocations = { [`p${GUID.toLowerCase()}`]: makeLocation({ pinId: `p${GUID.toLowerCase()}`, latitude: 1, longitude: 2 }) };
    const result = applyLiveLocations(pins, live);

    expect(result.pins[2]).toMatchObject({ Id: `p${GUID}`, Latitude: 1, Longitude: 2 });
    expect(result.unknownPinIds).toEqual([]);
  });

  it('moves the bare-id unit and personnel pins of a server from before pin ids were prefixed', () => {
    const legacyPins = [makePin({ Id: '12', Type: 1 }), makePin({ Id: GUID, Type: 3 })];
    const live: LiveLocations = { u12: makeLocation({ latitude: 3, longitude: 4 }), [`p${GUID.toLowerCase()}`]: makeLocation({ pinId: `p${GUID.toLowerCase()}`, latitude: 5, longitude: 6 }) };
    const result = applyLiveLocations(legacyPins, live);

    expect(result.pins[0]).toMatchObject({ Id: '12', Latitude: 3, Longitude: 4 });
    expect(result.pins[1]).toMatchObject({ Id: GUID, Latitude: 5, Longitude: 6 });
    expect(result.unknownPinIds).toEqual([]);
  });

  it('never adds pins and reports pushes for pins it does not have', () => {
    const live: LiveLocations = { u99: makeLocation({ pinId: 'u99' }) };
    const result = applyLiveLocations(pins, live);

    expect(result.pins).toBe(pins);
    expect(result.pins).toHaveLength(4);
    expect(result.unknownPinIds).toEqual(['u99']);
  });

  it('only moves unit and personnel pins', () => {
    const typedPins = [makePin({ Id: 'u12', Type: 0 }), makePin({ Id: 'p1', Type: 4 })];
    const live: LiveLocations = { u12: makeLocation({}), p1: makeLocation({ pinId: 'p1' }) };
    const result = applyLiveLocations(typedPins, live);

    expect(result.pins).toBe(typedPins);
    expect(result.unknownPinIds).toEqual(['u12', 'p1']);
  });

  it('ignores positions received before a fresh snapshot started', () => {
    const live: LiveLocations = { u12: makeLocation({ receivedAt: RECEIVED_AT - 1 }) };

    expect(applyLiveLocations(pins, live, { receivedSince: RECEIVED_AT }).pins).toBe(pins);
    expect(applyLiveLocations(pins, live, { receivedSince: RECEIVED_AT - 1 }).pins[1]).toMatchObject({ Latitude: 41 });
  });

  it('can be limited to the entries that just changed', () => {
    const live: LiveLocations = { u12: makeLocation({}), [`p${GUID.toLowerCase()}`]: makeLocation({ pinId: `p${GUID.toLowerCase()}`, latitude: 5, longitude: 6 }) };
    const result = applyLiveLocations(pins, live, { onlyPinIds: ['U12'] });

    expect(result.pins[1]).toMatchObject({ Latitude: 41 });
    expect(result.pins[2]).toBe(pins[2]);
  });
});
