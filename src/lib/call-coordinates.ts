/**
 * Typed call coordinates: the separate latitude and longitude inputs on the new and edit call screens.
 *
 * Only signed decimal degrees are taken ("39.122639", "-119.758773"): no degrees-minutes-seconds, hemisphere
 * letters, exponents or decimal commas, which a dispatcher could mean several ways and the server would not read.
 */
export type CoordinateAxis = 'latitude' | 'longitude';

export interface CallPoint {
  latitude: number;
  longitude: number;
}

const AXIS_LIMITS: Record<CoordinateAxis, number> = { latitude: 90, longitude: 180 };

// An optional sign, one to three whole digits and an optional fraction. "39." and ".5" are half-typed, not values.
const DECIMAL_DEGREES = '[-+]?\\d{1,3}(?:\\.\\d+)?';
const DECIMAL_DEGREES_PATTERN = new RegExp(`^${DECIMAL_DEGREES}$`);
// "lat, lon" or "lat lon", as map apps copy a point.
const COORDINATE_PAIR_PATTERN = new RegExp(`^(${DECIMAL_DEGREES})\\s*(?:,\\s*|\\s+)(${DECIMAL_DEGREES})$`);

export type CoordinateParse = { status: 'empty' } | { status: 'invalid' } | { status: 'valid'; value: number };

/** One input's text: blank, a decimal-degree value on the globe, or anything else. */
export const parseCoordinate = (text: string | undefined, axis: CoordinateAxis): CoordinateParse => {
  const trimmed = (text ?? '').trim();

  if (!trimmed) {
    return { status: 'empty' };
  }

  if (!DECIMAL_DEGREES_PATTERN.test(trimmed)) {
    return { status: 'invalid' };
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value) || Math.abs(value) > AXIS_LIMITS[axis]) {
    return { status: 'invalid' };
  }

  return { status: 'valid', value };
};

export type CoordinateEntry =
  | { status: 'empty' }
  /** One input filled in and the other blank. */
  | { status: 'incomplete'; missing: CoordinateAxis }
  | { status: 'invalid'; latitudeInvalid: boolean; longitudeInvalid: boolean }
  | ({ status: 'valid' } & CallPoint);

/** Both inputs together: a usable point only when each holds a valid value. */
export const parseCoordinateEntry = (latitudeText: string | undefined, longitudeText: string | undefined): CoordinateEntry => {
  const latitude = parseCoordinate(latitudeText, 'latitude');
  const longitude = parseCoordinate(longitudeText, 'longitude');

  if (latitude.status === 'invalid' || longitude.status === 'invalid') {
    return { status: 'invalid', latitudeInvalid: latitude.status === 'invalid', longitudeInvalid: longitude.status === 'invalid' };
  }

  if (latitude.status === 'valid' && longitude.status === 'valid') {
    return { status: 'valid', latitude: latitude.value, longitude: longitude.value };
  }

  if (latitude.status === 'empty' && longitude.status === 'empty') {
    return { status: 'empty' };
  }

  return { status: 'incomplete', missing: latitude.status === 'empty' ? 'latitude' : 'longitude' };
};

/** A whole "lat, lon" pair pasted or typed into one input, split into the text for each, as typed. */
export const splitCoordinatePair = (text: string | undefined): { latitude: string; longitude: string } | null => {
  const match = (text ?? '').trim().match(COORDINATE_PAIR_PATTERN);

  if (!match || parseCoordinateEntry(match[1], match[2]).status !== 'valid') {
    return null;
  }

  return { latitude: match[1], longitude: match[2] };
};

/** How the inputs show a point the map or a lookup chose: six places, about 10 cm. */
export const formatCoordinate = (value: number): string => value.toFixed(6);

/** A coordinate as a call stores it (text), for the inputs: blank when it is not a number. */
export const formatStoredCoordinate = (stored: string | null | undefined): string => {
  const value = stored ? parseFloat(stored) : NaN;
  return Number.isFinite(value) ? formatCoordinate(value) : '';
};

/** Whether two points are the same spot as the inputs show it, so a point the inputs echo back is not re-applied. */
export const isSameCoordinateSpot = (a: CallPoint | null | undefined, b: CallPoint | null | undefined): boolean =>
  !!a && !!b && formatCoordinate(a.latitude) === formatCoordinate(b.latitude) && formatCoordinate(a.longitude) === formatCoordinate(b.longitude);
