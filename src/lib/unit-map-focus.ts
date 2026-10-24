import { getPinEntityId, MapPinType } from '@/lib/map-pin-ids';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

/**
 * What the console map frames while a unit is selected: the unit's own pin and the pins of the members seated in its
 * roles. Either may have no position: a team whose members carry the app may never run the Unit app, so it is framed
 * on its crew alone.
 */
export interface MapFocus {
  /** Identifies what is focused ("unit:12"); a new key always re-frames. */
  key: string;
  /** The unit's name, for the map's focus banner. */
  label: string;
  /** The unit's pin id, lowercased ("u12"). */
  unitPinId: string;
  /** The seated members' pin ids, lowercased ("p<userId>"), in the unit's role order, one per person. */
  crewPinIds: string[];
}

export interface MapFocusPoint {
  pinId: string;
  /** [longitude, latitude], the order Mapbox takes. */
  coordinate: [number, number];
}

export interface MapFocusPoints {
  /** Every focused pin that has a position: the unit first, then its crew. */
  points: MapFocusPoint[];
  unitLocated: boolean;
  crewLocated: number;
  crewTotal: number;
}

/**
 * The narrowest view a frame may have, in degrees (about 250 m of latitude). A lone member, or a crew standing
 * together, is framed as close as this: near enough to read the street, without zooming into a blank tile.
 */
export const FOCUS_MIN_SPAN_DEGREES = 0.0025;

/** The web map's cap on top of the minimum span, so it agrees with the native frame. */
export const FOCUS_MAX_ZOOM = 17;

export const unitFocusPinId = (unitId: string | number): string => `u${unitId}`.toLowerCase();

export const personFocusPinId = (userId: string): string => `p${userId}`.toLowerCase();

/** The pin ids of the members seated in the unit's roles, one per person even when someone holds two seats. */
export const getCrewFocusPinIds = (unit: Pick<UnitInfoResultData, 'Roles'> | null | undefined): string[] => {
  const pinIds: string[] = [];

  for (const role of unit?.Roles ?? []) {
    const userId = (role?.UserId ?? '').trim();
    if (!userId) continue;

    const pinId = personFocusPinId(userId);
    if (!pinIds.includes(pinId)) pinIds.push(pinId);
  }

  return pinIds;
};

export const createUnitMapFocus = (unitId: string, label: string, crewPinIds: string[]): MapFocus => ({
  key: `unit:${unitId}`,
  label,
  unitPinId: unitFocusPinId(unitId),
  crewPinIds,
});

/** The pin's focus id in the same lowercased, prefixed form, also for a server that sends bare ids. */
const focusIdForPin = (pin: MapMakerInfoData): string | null => {
  if (pin.Type === MapPinType.Unit) return unitFocusPinId(getPinEntityId(pin));
  if (pin.Type === MapPinType.Personnel) return personFocusPinId(getPinEntityId(pin));
  return null;
};

// Pins come off the network (and the live feed); fitBounds throws on an out-of-range latitude.
const usable = (pin: MapMakerInfoData): boolean =>
  Number.isFinite(pin.Latitude) && Number.isFinite(pin.Longitude) && Math.abs(pin.Latitude) <= 90 && Math.abs(pin.Longitude) <= 180 && !(pin.Latitude === 0 && pin.Longitude === 0);

/** Where the focused unit and crew are on the map now, from the pins it shows (live positions already applied). */
export const resolveMapFocusPoints = (pins: MapMakerInfoData[], focus: MapFocus): MapFocusPoints => {
  const positions = new Map<string, [number, number]>();

  for (const pin of pins) {
    if (pin.Type !== MapPinType.Unit && pin.Type !== MapPinType.Personnel) continue;
    if (!usable(pin)) continue;

    const focusId = focusIdForPin(pin);
    if (focusId && !positions.has(focusId)) positions.set(focusId, [pin.Longitude, pin.Latitude]);
  }

  const points: MapFocusPoint[] = [];
  const unitCoordinate = positions.get(focus.unitPinId);
  if (unitCoordinate) points.push({ pinId: focus.unitPinId, coordinate: unitCoordinate });

  let crewLocated = 0;
  for (const pinId of focus.crewPinIds) {
    const coordinate = positions.get(pinId);
    if (!coordinate) continue;
    points.push({ pinId, coordinate });
    crewLocated++;
  }

  return { points, unitLocated: !!unitCoordinate, crewLocated, crewTotal: focus.crewPinIds.length };
};

/**
 * South-west and north-east corners around the points, widened to at least `minSpan` degrees each way so one point
 * (or several on top of each other) still frames a street, not a single tile; null when there are no points.
 */
export const boundsForFocusPoints = (points: [number, number][], minSpan: number = FOCUS_MIN_SPAN_DEGREES): { sw: [number, number]; ne: [number, number] } | null => {
  if (points.length === 0) return null;

  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const widen = (min: number, max: number, limit: number): [number, number] => {
    const missing = minSpan - (max - min);
    if (missing <= 0) return [min, max];
    return [Math.max(-limit, min - missing / 2), Math.min(limit, max + missing / 2)];
  };

  const [west, east] = widen(minLng, maxLng, 180);
  const [south, north] = widen(minLat, maxLat, 90);

  return { sw: [west, south], ne: [east, north] };
};

/**
 * Changes when the frame should change on its own: another unit, someone joining or leaving the crew, or a member
 * starting or stopping reporting. A position moving does not change it.
 */
export const focusFrameKey = (focus: MapFocus, located: MapFocusPoints): string =>
  `${focus.key}|${located.points
    .map((point) => point.pinId)
    .sort()
    .join(',')}`;

export interface VisibleBounds {
  contains: (coordinate: [number, number]) => boolean;
}

/** A visible-bounds test from the native map's [[neLng, neLat], [swLng, swLat]]. */
export const visibleBoundsFromCorners = (corners: number[][] | null | undefined): VisibleBounds | null => {
  if (!corners || corners.length < 2) return null;

  const [ne, sw] = corners;
  const east = ne[0];
  const north = ne[1];
  const west = sw[0];
  const south = sw[1];

  return {
    contains: ([lng, lat]) => lat >= south && lat <= north && (west <= east ? lng >= west && lng <= east : lng >= west || lng <= east),
  };
};

/**
 * True when a focused member who was on screen has moved off it. Someone the dispatcher already panned away from does
 * not count, so following the crew never undoes a deliberate look elsewhere.
 */
export const hasPointLeftView = (previous: Map<string, [number, number]>, points: MapFocusPoint[], visible: VisibleBounds): boolean =>
  points.some((point) => {
    const before = previous.get(point.pinId);
    if (!before || (before[0] === point.coordinate[0] && before[1] === point.coordinate[1])) return false;
    return visible.contains(before) && !visible.contains(point.coordinate);
  });
