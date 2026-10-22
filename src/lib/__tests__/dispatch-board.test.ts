import { describe, expect, it } from '@jest/globals';

import { boundsAround, buildDispatchMapOverlay, callLocationOf, formatAge, formatDistanceEta, orderRecipients, parseGeofenceRing, positionNote, rankBoardUnits } from '@/lib/dispatch-board';
import { EtaSource, type NearestUnitBoard, type NearestUnitResult, UnitPositionSource } from '@/models/v4/dispatch/nearestUnitBoard';

const unit = (overrides: Partial<NearestUnitResult>): NearestUnitResult => ({
  UnitId: 1,
  Name: 'Unit',
  IsAvailable: true,
  PositionIsStale: false,
  PositionSource: UnitPositionSource.Live,
  LocationHidden: false,
  EtaSource: EtaSource.Estimated,
  TurnoutSeconds: 0,
  Crew: [],
  CrewCount: 0,
  CrewAvailableCount: 0,
  OnShiftCount: 0,
  ...overrides,
});

const board = (units: NearestUnitResult[]): NearestUnitBoard => ({ Latitude: 39.5, Longitude: -119.8, GeneratedOn: '', IsDepartmentWide: true, Units: units, Personnel: [], Notes: [] });

describe('dispatch board helpers', () => {
  it('ranks only the available entries with a distance as nearest', () => {
    const ranks = rankBoardUnits(
      board([
        unit({ UnitId: 1, DistanceMeters: 500 }),
        unit({ UnitId: 2, DistanceMeters: 800, IsAvailable: false }),
        unit({ UnitId: 3, DistanceMeters: null }),
        unit({ UnitId: 4, DistanceMeters: 1200 }),
      ])
    );

    expect(ranks.get('1')?.nearestRank).toBe(1);
    expect(ranks.get('2')?.nearestRank).toBeNull();
    expect(ranks.get('3')?.nearestRank).toBeNull();
    expect(ranks.get('4')?.nearestRank).toBe(2);
    expect(ranks.get('4')?.index).toBe(3);
  });

  it('orders board rows first, keeps selected rows when filtering', () => {
    const ranks = rankBoardUnits(board([unit({ UnitId: 2, DistanceMeters: 100 }), unit({ UnitId: 1, DistanceMeters: 900, IsAvailable: false })]));
    const items = [
      { Id: '1', Name: 'Alpha' },
      { Id: '3', Name: 'Charlie' },
      { Id: '2', Name: 'Bravo' },
    ];
    const isAvailable = (_item: unknown, rank?: { entry: NearestUnitResult }) => (rank ? rank.entry.IsAvailable : true);

    expect(orderRecipients(items, ranks, { sort: 'closest', availableOnly: false, selectedIds: [], isAvailable }).map((i) => i.Id)).toEqual(['2', '1', '3']);
    expect(orderRecipients(items, ranks, { sort: 'name', availableOnly: false, selectedIds: [], isAvailable }).map((i) => i.Id)).toEqual(['1', '2', '3']);
    expect(orderRecipients(items, ranks, { sort: 'closest', availableOnly: true, selectedIds: [], isAvailable }).map((i) => i.Id)).toEqual(['2', '3']);
    expect(orderRecipients(items, ranks, { sort: 'closest', availableOnly: true, selectedIds: ['1'], isAvailable }).map((i) => i.Id)).toEqual(['2', '1', '3']);
  });

  it('formats distance and ETA, marking estimates', () => {
    expect(formatDistanceEta(1400, 240, EtaSource.Estimated)).toBe('1.4 km · ~4 min');
    expect(formatDistanceEta(650, 45, EtaSource.Road)).toBe('650 m · 45s');
    expect(formatDistanceEta(null, null)).toBeNull();
  });

  it('formats the age of a position', () => {
    const now = Date.parse('2026-10-22T16:00:00Z');
    expect(formatAge('2026-10-22T15:35:00Z', now)).toBe('25 min');
    expect(formatAge('2026-10-22T13:00:00', now)).toBe('3 h');
    expect(formatAge('2026-10-22T15:59:40Z', now)).toBeNull();
    expect(formatAge(null, now)).toBeNull();
  });

  it('says why a position needs a second look', () => {
    expect(positionNote({ LocationHidden: true, DistanceMeters: 100 })?.key).toBe('calls.dispatch_board.location_hidden');
    expect(positionNote({ LocationHidden: false, DistanceMeters: null })?.key).toBe('calls.dispatch_board.no_location');
    expect(positionNote({ LocationHidden: false, DistanceMeters: 100, PositionSource: UnitPositionSource.Station })?.key).toBe('calls.dispatch_board.at_station');
    expect(positionNote({ LocationHidden: false, DistanceMeters: 100, LocationIsStale: true, LocationTimestamp: '2026-10-22T15:35:00Z' }, Date.parse('2026-10-22T16:00:00Z'))).toEqual({
      key: 'calls.dispatch_board.location_stale',
      values: { age: '25 min' },
    });
    expect(positionNote({ LocationHidden: false, DistanceMeters: 100 })).toBeNull();
  });

  it('parses a geofence into a closed GeoJSON ring, including legacy keys', () => {
    expect(parseGeofenceRing('[{"lat":39.5,"lng":-119.8},{"lat":39.6,"lng":-119.8},{"lat":39.6,"lng":-119.7}]')).toEqual([
      [-119.8, 39.5],
      [-119.8, 39.6],
      [-119.7, 39.6],
      [-119.8, 39.5],
    ]);
    expect(parseGeofenceRing('[{"k":1,"A":2},{"k":1,"A":3},{"k":2,"A":3}]')).toHaveLength(4);
    expect(parseGeofenceRing('[{"lat":1,"lng":2},{"lat":1,"lng":3}]')).toBeNull();
    expect(parseGeofenceRing('not json')).toBeNull();
    expect(parseGeofenceRing('')).toBeNull();
  });

  it('draws placed resources and boundaries, leaving hidden positions off', () => {
    const overlay = buildDispatchMapOverlay(
      {
        ...board([unit({ UnitId: 1, Name: 'MCT 1', Latitude: 39.51, Longitude: -119.79, StatusColor: '#2f9e44', DistanceMeters: 1400, StatusText: 'Available' }), unit({ UnitId: 2, LocationHidden: true, DistanceMeters: 300 })]),
        Personnel: [
          {
            UserId: 'u1',
            Name: 'Taylor',
            IsAvailable: true,
            IsOnShift: true,
            Roles: [],
            Latitude: 39.52,
            Longitude: -119.78,
            LocationIsStale: false,
            LocationHidden: false,
            DistanceMeters: 2000,
            EtaSource: EtaSource.Estimated,
          },
        ],
      },
      [{ Id: '7', Name: 'South', Geofence: '[{"lat":39.5,"lng":-119.8},{"lat":39.6,"lng":-119.8},{"lat":39.6,"lng":-119.7}]', GeofenceColor: 'not-a-colour' }]
    );

    expect(overlay).not.toBeNull();
    expect(overlay!.unitCount).toBe(1);
    expect(overlay!.personCount).toBe(1);
    expect(overlay!.points.features[0].properties).toMatchObject({ id: 'u1', kind: 'unit', color: '#2f9e44', available: true });
    expect(overlay!.points.features[0].properties.detail).toBe('Available · 1.4 km');
    expect(overlay!.boundaries.features[0].properties.color).toBe('#0ea5e9');
    expect(overlay!.nearest).toEqual([
      [-119.79, 39.51],
      [-119.78, 39.52],
    ]);
  });

  it('does not frame the call with a resource whose fix is far away', () => {
    const overlay = buildDispatchMapOverlay(board([unit({ UnitId: 1, Latitude: 41.8, Longitude: -87.6, DistanceMeters: 2_700_000 }), unit({ UnitId: 2, Latitude: 39.51, Longitude: -119.79, DistanceMeters: 1400 })]), []);

    expect(overlay!.unitCount).toBe(2);
    expect(overlay!.nearest).toEqual([[-119.79, 39.51]]);
  });

  it('leaves off a resource whose position is out of range', () => {
    const overlay = buildDispatchMapOverlay(board([unit({ UnitId: 1, Latitude: 139.5, Longitude: -119.79, DistanceMeters: 900 }), unit({ UnitId: 2, Latitude: 39.5, Longitude: -219.79, DistanceMeters: 900 }), unit({ UnitId: 3, Latitude: 39.51, Longitude: -119.79, DistanceMeters: 1400 })]), []);

    expect(overlay!.unitCount).toBe(1);
    expect(overlay!.nearest).toEqual([[-119.79, 39.51]]);
  });

  it('has nothing to draw without positions or boundaries', () => {
    expect(buildDispatchMapOverlay(null, [])).toBeNull();
  });

  it('reads a call location from its string coordinates', () => {
    expect(callLocationOf({ Latitude: '39.178716', Longitude: '-119.767430' })).toEqual({ latitude: 39.178716, longitude: -119.76743 });
    expect(callLocationOf({ Latitude: '0', Longitude: '0' })).toBeNull();
    expect(callLocationOf({ Latitude: '', Longitude: '' })).toBeNull();
    expect(callLocationOf(null)).toBeNull();
  });

  it('frames the call with the closest resources', () => {
    expect(boundsAround({ latitude: 39.5, longitude: -119.8 }, [[-119.7, 39.6]])).toEqual({ sw: [-119.8, 39.5], ne: [-119.7, 39.6] });
    expect(boundsAround({ latitude: 39.5, longitude: -119.8 }, [])).toBeNull();
  });
});
