import { isPersonnelAvailable, isPersonnelOnDuty, isUnitAvailable } from '@/lib/resource-availability';
import { formatDistance, formatEta } from '@/lib/run-cards';
import { EtaSource, type NearestPersonnelResult, type NearestUnitBoard, type NearestUnitResult, UnitPositionSource } from '@/models/v4/dispatch/nearestUnitBoard';
import { type DispatchItem } from '@/stores/dispatch/store';

/*
 * The nearest-unit board (/Dispatch/GetNearestUnits) joined onto the dispatch picker's rows, and its available entries
 * drawn on the New Call / Edit Call map. The board ranks every unit and responder the viewer may dispatch for the call
 * location: available first, then response time, then distance. Rows the board does not list (out of the viewer's
 * dispatch scope, or no call location yet) keep their place after the ranked ones, by name.
 */

/** How many of the closest available units or personnel get a "Nearest" badge. */
export const NEAREST_BADGE_COUNT = 3;

/** A location older than this many seconds is called out on the row, whatever the board says. */
const AGE_MINUTE = 60;

export interface BoardRank<T> {
  /** 0-based position on the board. */
  index: number;
  /** 1-based rank among the available entries with a response time; null for the rest. */
  nearestRank: number | null;
  entry: T;
}

const rankEntries = <T extends { IsAvailable: boolean; DistanceMeters?: number | null }>(entries: T[], idOf: (entry: T) => string): Map<string, BoardRank<T>> => {
  const ranks = new Map<string, BoardRank<T>>();
  let nearest = 0;

  entries.forEach((entry, index) => {
    const hasDistance = typeof entry.DistanceMeters === 'number' && Number.isFinite(entry.DistanceMeters);
    const nearestRank = entry.IsAvailable && hasDistance ? ++nearest : null;
    ranks.set(idOf(entry), { index, nearestRank, entry });
  });

  return ranks;
};

export const rankBoardUnits = (board: NearestUnitBoard | null | undefined): Map<string, BoardRank<NearestUnitResult>> => rankEntries(board?.Units ?? [], (unit) => String(unit.UnitId));

export const rankBoardPersonnel = (board: NearestUnitBoard | null | undefined): Map<string, BoardRank<NearestPersonnelResult>> => rankEntries(board?.Personnel ?? [], (person) => person.UserId);

/** Whether a picker row is available to send: the board's answer when it lists the row, else the row's own status (and staffing). */
export const isDispatchUserAvailable = (user: DispatchItem, rank?: BoardRank<NearestPersonnelResult>): boolean => {
  if (rank) return rank.entry.IsAvailable;
  if (user.Status === undefined && user.StatusBaseType === undefined) return true;

  return (
    isPersonnelAvailable({ Status: user.Status ?? '', StatusBaseType: user.StatusBaseType }) && (user.Staffing == null || isPersonnelOnDuty({ Staffing: user.Staffing ?? '', StaffingBaseType: user.StaffingBaseType }))
  );
};

export const isDispatchUnitAvailable = (unit: DispatchItem, rank?: BoardRank<NearestUnitResult>): boolean => {
  if (rank) return rank.entry.IsAvailable;

  return isUnitAvailable({ CurrentStatus: unit.Status ?? '', CurrentStatusId: '', CurrentStatusBaseType: unit.StatusBaseType });
};

export type RecipientSort = 'closest' | 'name';

/**
 * Rows in the order the dispatcher asked for. "closest" follows the board for the rows it lists, then the rest by name;
 * "name" is alphabetical. Selected rows always stay visible; "available only" hides the others that cannot go.
 */
export const orderRecipients = <T>(
  items: DispatchItem[],
  ranks: Map<string, BoardRank<T>>,
  options: { sort: RecipientSort; availableOnly: boolean; selectedIds: string[]; isAvailable: (item: DispatchItem, rank?: BoardRank<T>) => boolean }
): DispatchItem[] => {
  const visible = options.availableOnly ? items.filter((item) => options.selectedIds.includes(item.Id) || options.isAvailable(item, ranks.get(item.Id))) : items;
  const byName = (a: DispatchItem, b: DispatchItem) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });

  if (options.sort === 'name' || ranks.size === 0) {
    return [...visible].sort(byName);
  }

  return [...visible].sort((a, b) => {
    const rankA = ranks.get(a.Id);
    const rankB = ranks.get(b.Id);
    if (rankA && rankB) return rankA.index - rankB.index;
    if (rankA) return -1;
    if (rankB) return 1;
    return byName(a, b);
  });
};

/** "2.3 km · 6 min", with "~" on an estimated (straight-line) ETA; null when the board had neither. */
export const formatDistanceEta = (distanceMeters: number | null | undefined, etaSeconds: number | null | undefined, etaSource?: EtaSource): string | null => {
  const distance = formatDistance(distanceMeters);
  const eta = formatEta(etaSeconds);
  const etaText = eta ? (etaSource === EtaSource.Estimated ? `~${eta}` : eta) : null;

  return [distance, etaText].filter(Boolean).join(' · ') || null;
};

/** "4 min" / "2 h" / "3 d" since an ISO timestamp; null when it is missing, unparseable or under a minute old. */
export const formatAge = (timestamp: string | null | undefined, now: number = Date.now()): string | null => {
  if (!timestamp) return null;
  const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (!Number.isFinite(parsed)) return null;

  const seconds = Math.max(0, (now - parsed) / 1000);
  if (seconds < AGE_MINUTE) return null;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
};

/** What the row should say about where the position came from, as an i18n key plus its values; null when nothing needs saying. */
export const positionNote = (
  entry: {
    LocationHidden: boolean;
    LocationIsStale?: boolean;
    PositionIsStale?: boolean;
    PositionSource?: UnitPositionSource;
    LocationTimestamp?: string | null;
    PositionTimestamp?: string | null;
    DistanceMeters?: number | null;
  },
  now: number = Date.now()
): { key: string; values?: Record<string, string> } | null => {
  if (entry.LocationHidden) return { key: 'calls.dispatch_board.location_hidden' };

  const hasDistance = typeof entry.DistanceMeters === 'number' && Number.isFinite(entry.DistanceMeters);
  if (!hasDistance) return { key: 'calls.dispatch_board.no_location' };
  if (entry.PositionSource === UnitPositionSource.Station) return { key: 'calls.dispatch_board.at_station' };

  if (entry.LocationIsStale || entry.PositionIsStale) {
    const age = formatAge(entry.LocationTimestamp ?? entry.PositionTimestamp, now);
    return age ? { key: 'calls.dispatch_board.location_stale', values: { age } } : { key: 'calls.dispatch_board.location_stale_unknown' };
  }

  return null;
};

/** A call's coordinates (the API sends them as strings) as a location the picker can rank from; null without a usable one. */
export const callLocationOf = (call: { Latitude?: string | number | null; Longitude?: string | number | null } | null | undefined): { latitude: number; longitude: number } | null => {
  const latitude = Number.parseFloat(String(call?.Latitude ?? ''));
  const longitude = Number.parseFloat(String(call?.Longitude ?? ''));

  return Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0) ? { latitude, longitude } : null;
};

// ---------------------------------------------------------------------------------------------------------------------
// Map overlay
// ---------------------------------------------------------------------------------------------------------------------

export const UNIT_MARKER_COLOR = '#2563eb';
export const PERSON_MARKER_COLOR = '#7c3aed';
export const BOUNDARY_COLOR = '#0ea5e9';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hexOr = (color: string | null | undefined, fallback: string) => (color && HEX_COLOR.test(color.trim()) ? color.trim() : fallback);

/** A group's boundary as a closed GeoJSON ring of [lng, lat]; null when it has fewer than three usable points. */
export const parseGeofenceRing = (geofence: string | null | undefined): [number, number][] | null => {
  if (!geofence?.trim()) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(geofence);
  } catch {
    return null;
  }

  if (!Array.isArray(raw)) return null;

  const ring: [number, number][] = [];
  for (const point of raw) {
    if (!point || typeof point !== 'object') continue;
    const p = point as Record<string, unknown>;
    const lat = Number(p.lat ?? p.Lat ?? p.k);
    const lng = Number(p.lng ?? p.lon ?? p.Lng ?? p.Lon ?? p.A ?? p.a);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      ring.push([lng, lat]);
    }
  }

  if (ring.length < 3) return null;

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) ring.push([firstLng, firstLat]);

  return ring;
};

export interface DispatchMapPointProperties {
  id: string;
  kind: 'unit' | 'person';
  name: string;
  color: string;
  /** Status, distance and ETA, for the popup. */
  detail: string;
}

export interface DispatchMapBoundaryProperties {
  id: string;
  name: string;
  color: string;
}

export interface DispatchMapOverlay {
  points: GeoJSON.FeatureCollection<GeoJSON.Point, DispatchMapPointProperties>;
  boundaries: GeoJSON.FeatureCollection<GeoJSON.Polygon, DispatchMapBoundaryProperties>;
  /** [lng, lat] of the closest few resources with a position, to frame the call with them. */
  nearest: [number, number][];
  /** Available units on the map. */
  unitCount: number;
  /** Available personnel on the map. */
  personCount: number;
}

/** Only resources this close frame the call: one with a far-off fix would zoom the map out to a continent. */
export const FRAME_MAX_DISTANCE_METERS = 50_000;

const withinFrame = (distanceMeters: number | null | undefined) => typeof distanceMeters === 'number' && distanceMeters <= FRAME_MAX_DISTANCE_METERS;

// The board comes off the network: an out-of-range position would reach fitBounds, which throws on an invalid latitude.
const usable = (lat: number | null | undefined, lng: number | null | undefined): lat is number =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * The available units and responders the board placed (hidden positions carry no coordinates and are left off), plus
 * every group boundary, as GeoJSON for the location picker. Null when there is nothing to draw.
 *
 * The call maps (New Call, Edit Call) show only who can be sent: a unit or person the board marks unavailable is left
 * off, by the same `IsAvailable` answer the recipient picker uses for the rows the board lists (`isDispatchUnitAvailable`
 * / `isDispatchUserAvailable`). The picker itself still lists everyone with their status, for reassignment.
 */
export const buildDispatchMapOverlay = (board: NearestUnitBoard | null | undefined, groups: { Id: string; Name: string; Geofence?: string | null; GeofenceColor?: string | null }[]): DispatchMapOverlay | null => {
  const points: GeoJSON.Feature<GeoJSON.Point, DispatchMapPointProperties>[] = [];
  const nearest: [number, number][] = [];

  for (const unit of board?.Units ?? []) {
    if (!unit.IsAvailable || !usable(unit.Latitude, unit.Longitude)) continue;
    const coordinates: [number, number] = [unit.Longitude as number, unit.Latitude as number];
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: {
        id: `u${unit.UnitId}`,
        kind: 'unit',
        name: unit.Name,
        color: hexOr(unit.StatusColor, UNIT_MARKER_COLOR),
        detail: [unit.StatusText, formatDistanceEta(unit.DistanceMeters, unit.EtaSeconds, unit.EtaSource)].filter(Boolean).join(' · '),
      },
    });
    if (withinFrame(unit.DistanceMeters) && nearest.length < NEAREST_BADGE_COUNT) nearest.push(coordinates);
  }

  let nearestPeople = 0;
  for (const person of board?.Personnel ?? []) {
    if (!person.IsAvailable || !usable(person.Latitude, person.Longitude)) continue;
    const coordinates: [number, number] = [person.Longitude as number, person.Latitude as number];
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: {
        id: `p${person.UserId}`,
        kind: 'person',
        name: person.Name,
        color: hexOr(person.StatusColor, PERSON_MARKER_COLOR),
        detail: [person.StatusText, formatDistanceEta(person.DistanceMeters, person.EtaSeconds, person.EtaSource)].filter(Boolean).join(' · '),
      },
    });
    if (withinFrame(person.DistanceMeters) && nearestPeople < NEAREST_BADGE_COUNT) {
      nearest.push(coordinates);
      nearestPeople++;
    }
  }

  const boundaries: GeoJSON.Feature<GeoJSON.Polygon, DispatchMapBoundaryProperties>[] = [];
  for (const group of groups) {
    const ring = parseGeofenceRing(group.Geofence);
    if (!ring) continue;
    boundaries.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { id: `g${group.Id}`, name: group.Name, color: hexOr(group.GeofenceColor, BOUNDARY_COLOR) },
    });
  }

  if (points.length === 0 && boundaries.length === 0) return null;

  return {
    points: { type: 'FeatureCollection', features: points },
    boundaries: { type: 'FeatureCollection', features: boundaries },
    nearest,
    unitCount: points.filter((p) => p.properties.kind === 'unit').length,
    personCount: points.filter((p) => p.properties.kind === 'person').length,
  };
};

/** South-west and north-east corners framing the call and the given points, or null when there is nothing beside the call. */
export const boundsAround = (center: { latitude: number; longitude: number }, points: [number, number][]): { sw: [number, number]; ne: [number, number] } | null => {
  if (points.length === 0) return null;

  let minLng = center.longitude;
  let maxLng = center.longitude;
  let minLat = center.latitude;
  let maxLat = center.latitude;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { sw: [minLng, minLat], ne: [maxLng, maxLat] };
};
