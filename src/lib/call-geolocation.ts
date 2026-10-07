/**
 * The `Geolocation` wire value for a call save or edit: `"lat,lon"`, or empty when there is no usable fix.
 *
 * Never send a bare `","`. The server took any non-empty value as the call's location and skipped
 * geocoding the typed address, so a call saved without a map pick ended up unlocated. Mirrors the
 * server's coordinate check (GeoMath.ParseCoordinatePair): both values finite and on the globe, and
 * not 0,0. A single zero coordinate is a real place on the equator or prime meridian and is kept.
 */
export const formatGeolocation = (latitude?: number | null, longitude?: number | null): string => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '';
  }

  if (latitude === 0 && longitude === 0) {
    return '';
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return '';
  }

  return `${latitude},${longitude}`;
};
