import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

import {
  boundsForFocusPoints,
  createUnitMapFocus,
  FOCUS_MIN_SPAN_DEGREES,
  focusFrameKey,
  getCrewFocusPinIds,
  hasPointLeftView,
  resolveMapFocusPoints,
  visibleBoundsFromCorners,
} from '../unit-map-focus';

const pin = (Id: string, Type: number, Latitude: number, Longitude: number) => ({ Id, Type, Latitude, Longitude, Title: Id }) as MapMakerInfoData;

const unitWithRoles = (roles: { UserId: string; RoleName: string }[]) => ({ Roles: roles.map((role, index) => ({ RoleId: String(index + 1), Name: '', ...role })) }) as unknown as UnitInfoResultData;

describe('getCrewFocusPinIds', () => {
  it('lists the seated members in role order, once each, and skips empty seats', () => {
    const unit = unitWithRoles([
      { UserId: 'Officer-1', RoleName: 'Officer' },
      { UserId: '', RoleName: 'Driver' },
      { UserId: 'ff-2', RoleName: 'Firefighter' },
      { UserId: 'officer-1', RoleName: 'EMT' },
    ]);

    expect(getCrewFocusPinIds(unit)).toEqual(['pofficer-1', 'pff-2']);
  });

  it('has no crew for a unit without roles', () => {
    expect(getCrewFocusPinIds(undefined)).toEqual([]);
    expect(getCrewFocusPinIds({ Roles: [] } as unknown as UnitInfoResultData)).toEqual([]);
  });
});

describe('resolveMapFocusPoints', () => {
  const focus = createUnitMapFocus('12', 'Engine 12', ['pabc', 'pdef', 'pghi']);

  it('finds the unit and the located crew, matching ids case-insensitively', () => {
    const located = resolveMapFocusPoints([pin('c12', 0, 1, 1), pin('U12', 1, 39.2, -119.2), pin('pABC', 3, 39.3, -119.3), pin('pDEF', 3, 39.4, -119.4), pin('pzzz', 3, 40, -120)], focus);

    expect(located.points).toEqual([
      { pinId: 'u12', coordinate: [-119.2, 39.2] },
      { pinId: 'pabc', coordinate: [-119.3, 39.3] },
      { pinId: 'pdef', coordinate: [-119.4, 39.4] },
    ]);
    expect(located.unitLocated).toBe(true);
    expect(located.crewLocated).toBe(2);
    expect(located.crewTotal).toBe(3);
  });

  it('reads the bare ids an older server sends', () => {
    const located = resolveMapFocusPoints([pin('12', 1, 39.2, -119.2), pin('ABC', 3, 39.3, -119.3)], focus);

    expect(located.points.map((point) => point.pinId)).toEqual(['u12', 'pabc']);
  });

  it('frames the crew alone when the unit has no position', () => {
    const located = resolveMapFocusPoints([pin('pabc', 3, 39.3, -119.3)], focus);

    expect(located.unitLocated).toBe(false);
    expect(located.points).toEqual([{ pinId: 'pabc', coordinate: [-119.3, 39.3] }]);
  });

  it('ignores positions fitBounds would choke on', () => {
    const located = resolveMapFocusPoints([pin('u12', 1, 0, 0), pin('pabc', 3, 95, -119), pin('pdef', 3, Number.NaN, -119)], focus);

    expect(located.points).toEqual([]);
  });
});

describe('boundsForFocusPoints', () => {
  it('is null without points', () => {
    expect(boundsForFocusPoints([])).toBeNull();
  });

  it('widens a single point to the minimum span around it', () => {
    const bounds = boundsForFocusPoints([[-119.3, 39.3]])!;

    expect(bounds.ne[0] - bounds.sw[0]).toBeCloseTo(FOCUS_MIN_SPAN_DEGREES, 9);
    expect(bounds.ne[1] - bounds.sw[1]).toBeCloseTo(FOCUS_MIN_SPAN_DEGREES, 9);
    expect((bounds.ne[0] + bounds.sw[0]) / 2).toBeCloseTo(-119.3, 9);
    expect((bounds.ne[1] + bounds.sw[1]) / 2).toBeCloseTo(39.3, 9);
  });

  it('keeps a spread-out crew as it is', () => {
    expect(
      boundsForFocusPoints([
        [-119.3, 39.3],
        [-119.1, 39.5],
        [-119.2, 39.4],
      ])
    ).toEqual({ sw: [-119.3, 39.3], ne: [-119.1, 39.5] });
  });

  it('never widens past the poles', () => {
    const bounds = boundsForFocusPoints([[0.5, 89.9999]])!;

    expect(bounds.ne[1]).toBe(90);
  });
});

describe('focusFrameKey', () => {
  const focus = createUnitMapFocus('12', 'Engine 12', ['pabc', 'pdef']);

  it('stays the same while positions move and changes when someone starts reporting', () => {
    const before = focusFrameKey(focus, resolveMapFocusPoints([pin('u12', 1, 39.2, -119.2), pin('pabc', 3, 39.3, -119.3)], focus));
    const moved = focusFrameKey(focus, resolveMapFocusPoints([pin('u12', 1, 39.25, -119.25), pin('pabc', 3, 39.35, -119.35)], focus));
    const joined = focusFrameKey(focus, resolveMapFocusPoints([pin('u12', 1, 39.2, -119.2), pin('pabc', 3, 39.3, -119.3), pin('pdef', 3, 39.4, -119.4)], focus));

    expect(moved).toBe(before);
    expect(joined).not.toBe(before);
  });

  it('changes with the unit', () => {
    const other = createUnitMapFocus('13', 'Engine 13', ['pabc']);

    expect(focusFrameKey(other, resolveMapFocusPoints([], other))).not.toBe(focusFrameKey(focus, resolveMapFocusPoints([], focus)));
  });
});

describe('hasPointLeftView', () => {
  const visible = visibleBoundsFromCorners([
    [-119, 40],
    [-120, 39],
  ])!;

  it('follows a member who was on screen and has moved off it', () => {
    const previous = new Map<string, [number, number]>([['pabc', [-119.5, 39.5]]]);

    expect(hasPointLeftView(previous, [{ pinId: 'pabc', coordinate: [-118.5, 39.5] }], visible)).toBe(true);
  });

  it('ignores moves that stay on screen, members who were already off it, and members seen for the first time', () => {
    const previous = new Map<string, [number, number]>([
      ['pabc', [-119.5, 39.5]],
      ['pdef', [-110, 30]],
    ]);

    expect(
      hasPointLeftView(
        previous,
        [
          { pinId: 'pabc', coordinate: [-119.4, 39.6] },
          { pinId: 'pdef', coordinate: [-111, 31] },
          { pinId: 'pghi', coordinate: [-100, 20] },
        ],
        visible
      )
    ).toBe(false);
  });

  it('reads native corners that cross the antimeridian', () => {
    const across = visibleBoundsFromCorners([
      [-179, 10],
      [179, -10],
    ])!;

    expect(across.contains([179.5, 0])).toBe(true);
    expect(across.contains([-179.5, 0])).toBe(true);
    expect(across.contains([0, 0])).toBe(false);
  });
});
