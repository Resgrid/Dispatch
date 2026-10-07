import { formatGeolocation } from '../call-geolocation';

describe('formatGeolocation', () => {
  it('formats a usable pair as "lat,lon"', () => {
    expect(formatGeolocation(39.2733, -119.5841)).toBe('39.2733,-119.5841');
  });

  it('sends nothing rather than a bare comma when there is no fix', () => {
    // A "," made the server treat the call as located and skip geocoding the typed address.
    expect(formatGeolocation(undefined, undefined)).toBe('');
    expect(formatGeolocation(null, null)).toBe('');
  });

  it('sends nothing when only one coordinate is present', () => {
    expect(formatGeolocation(39.2733, undefined)).toBe('');
    expect(formatGeolocation(undefined, -119.5841)).toBe('');
  });

  it('treats 0,0 as no fix, matching the server', () => {
    expect(formatGeolocation(0, 0)).toBe('');
  });

  it('keeps a single zero coordinate, which is a real place', () => {
    expect(formatGeolocation(0, 32.5)).toBe('0,32.5');
    expect(formatGeolocation(51.4779, 0)).toBe('51.4779,0');
  });

  it('rejects non-finite and off-globe values', () => {
    expect(formatGeolocation(Number.NaN, 10)).toBe('');
    expect(formatGeolocation(10, Number.POSITIVE_INFINITY)).toBe('');
    expect(formatGeolocation(91, 10)).toBe('');
    expect(formatGeolocation(10, -181)).toBe('');
  });
});
