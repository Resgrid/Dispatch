import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import { MapMarkerEntityType } from './destination-helpers';

/**
 * The latest realtime position the geolocation hub pushed for one map entity.
 *
 * `pinId` is the REST map pin id it moves, lower-cased (`u12` for unit 12, `p<guid>` for a person), so a
 * lookup against `MapMakerInfoData.Id` is a case-insensitive match. `timestamp` is the GPS fix time in epoch
 * milliseconds, or null when the server did not send one (older servers) or it could not be parsed.
 * `receivedAt` is when this client received the push, in epoch milliseconds.
 */
export interface LiveLocation {
  pinId: string;
  latitude: number;
  longitude: number;
  timestamp: number | null;
  receivedAt: number;
}

/** Live positions keyed by lower-cased pin id. Always replaced, never mutated. */
export type LiveLocations = Record<string, LiveLocation>;

const UNIT_PIN_PREFIX = 'u';
const PERSONNEL_PIN_PREFIX = 'p';

/** The key a pin is stored under in {@link LiveLocations}. */
export const toLivePinKey = (pinId: string): string => pinId.toLowerCase();

/** Hub payloads may arrive as an object or as a JSON string; anything else is unusable. */
const toPayloadObject = (payload: unknown): Record<string, unknown> | null => {
  let value = payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

/** Reads a field under its camelCase name (the SignalR JSON protocol default) or its PascalCase name. */
const readField = (source: Record<string, unknown>, camelName: string): unknown => {
  const pascalName = camelName.charAt(0).toUpperCase() + camelName.slice(1);
  return source[camelName] ?? source[pascalName];
};

const toIdentifier = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** GPS fix time in epoch ms; null means "unknown", which callers must treat as always newer. */
const toTimestamp = (value: unknown): number | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

/** Coordinates the map can actually place: finite, in range, and not the 0,0 "no fix" placeholder. */
export const isValidLiveCoordinate = (latitude: number, longitude: number): boolean => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return !(latitude === 0 && longitude === 0);
};

const parseLocationUpdate = (payload: unknown, idField: 'unitId' | 'userId', prefix: string, receivedAt: number): LiveLocation | null => {
  const source = toPayloadObject(payload);
  if (!source) return null;

  const entityId = toIdentifier(readField(source, idField));
  const latitude = toCoordinate(readField(source, 'latitude'));
  const longitude = toCoordinate(readField(source, 'longitude'));
  if (entityId === null || latitude === null || longitude === null || !isValidLiveCoordinate(latitude, longitude)) {
    return null;
  }

  return {
    pinId: toLivePinKey(`${prefix}${entityId}`),
    latitude,
    longitude,
    timestamp: toTimestamp(readField(source, 'timestamp')),
    receivedAt,
  };
};

/** Parses an `onUnitLocationUpdated` push. Returns null for anything that cannot move a pin. */
export const parseUnitLocationUpdate = (payload: unknown, receivedAt: number = Date.now()): LiveLocation | null => parseLocationUpdate(payload, 'unitId', UNIT_PIN_PREFIX, receivedAt);

/** Parses an `onPersonnelLocationUpdated` push. Returns null for anything that cannot move a pin. */
export const parsePersonnelLocationUpdate = (payload: unknown, receivedAt: number = Date.now()): LiveLocation | null => parseLocationUpdate(payload, 'userId', PERSONNEL_PIN_PREFIX, receivedAt);

/**
 * Records a live position, returning the SAME object when the update is ignored.
 *
 * Trackers replay buffered fixes and queue consumers can reorder, so a fix older than the one already held
 * for the entity is dropped. A fix with an unknown time always applies, and an identical repeat is dropped so
 * it does not wake every map.
 */
export const upsertLiveLocation = (current: LiveLocations, update: LiveLocation): LiveLocations => {
  const existing = current[update.pinId];
  if (existing && existing.timestamp !== null && update.timestamp !== null) {
    if (update.timestamp < existing.timestamp) {
      return current;
    }
    if (update.timestamp === existing.timestamp && update.latitude === existing.latitude && update.longitude === existing.longitude) {
      return current;
    }
  }
  return { ...current, [update.pinId]: update };
};

/** Only unit and personnel pins track a live position; the id prefix must agree with the pin type. */
const getLivePinKey = (pin: MapMakerInfoData): string | null => {
  if (typeof pin.Id !== 'string' || pin.Id.length === 0) return null;
  const key = toLivePinKey(pin.Id);
  if (pin.Type === MapMarkerEntityType.Unit) {
    return key.startsWith(UNIT_PIN_PREFIX) ? key : null;
  }
  if (pin.Type === MapMarkerEntityType.Personnel) {
    return key.startsWith(PERSONNEL_PIN_PREFIX) ? key : null;
  }
  return null;
};

export interface ApplyLiveLocationsOptions {
  /** Ignore live positions received before this time (epoch ms), e.g. older than a fresh REST snapshot. */
  receivedSince?: number;
  /** Consider only these pin keys (lower-cased), e.g. the entries a push just changed. */
  onlyPinIds?: Iterable<string>;
}

export interface ApplyLiveLocationsResult {
  /** The input array itself when nothing moved; otherwise a new array with new objects for moved pins only. */
  pins: MapMakerInfoData[];
  /** Considered live positions that match no unit/personnel pin. Pins are never created from a push. */
  unknownPinIds: string[];
}

/**
 * Moves unit and personnel pins to their live positions.
 *
 * The realtime feed is not filtered by the viewer's visibility rules or location TTLs the REST map endpoint
 * applies, so a push can only move a pin REST already returned — it never adds one. Unchanged pins keep their
 * object identity (they are memoized by the renderers), and the input array is returned untouched when no pin
 * moved.
 */
export const applyLiveLocations = (pins: MapMakerInfoData[], liveLocations: LiveLocations, options: ApplyLiveLocationsOptions = {}): ApplyLiveLocationsResult => {
  const candidates = new Map<string, LiveLocation>();
  const keys = options.onlyPinIds ? Array.from(options.onlyPinIds, toLivePinKey) : Object.keys(liveLocations);
  keys.forEach((key) => {
    const location = liveLocations[key];
    if (!location) return;
    if (options.receivedSince !== undefined && location.receivedAt < options.receivedSince) return;
    candidates.set(key, location);
  });

  if (candidates.size === 0) {
    return { pins, unknownPinIds: [] };
  }

  const matched = new Set<string>();
  let nextPins: MapMakerInfoData[] | null = null;

  for (let index = 0; index < pins.length; index += 1) {
    const pin = pins[index];
    const key = getLivePinKey(pin);
    if (key === null) continue;
    const location = candidates.get(key);
    if (!location) continue;

    matched.add(key);
    if (pin.Latitude === location.latitude && pin.Longitude === location.longitude) continue;

    if (nextPins === null) {
      nextPins = pins.slice();
    }
    nextPins[index] = { ...pin, Latitude: location.latitude, Longitude: location.longitude };
  }

  const unknownPinIds = Array.from(candidates.keys()).filter((key) => !matched.has(key));
  return { pins: nextPins ?? pins, unknownPinIds };
};
