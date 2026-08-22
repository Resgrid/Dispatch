import { getTimeAgoUtc } from '../utils';

describe('getTimeAgoUtc', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T20:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads a Z-stamped UTC string without applying the legacy offset shift', () => {
    expect(getTimeAgoUtc('2026-08-19T19:55:00.000Z')).toBe('5 minutes ago');
  });

  it('reads an offset-stamped string without applying the legacy offset shift', () => {
    expect(getTimeAgoUtc('2026-08-19T12:55:00-07:00')).toBe('5 minutes ago');
  });

  it('still reads legacy zone-less UTC strings via the offset-shifted comparison', () => {
    // Zone-less strings parse as device-local; the function compensates by shifting "now"
    // by the same offset, so the result is correct in any device timezone.
    const zoneless = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
    expect(getTimeAgoUtc(zoneless)).toBe('5 minutes ago');
  });

  it('treats Date objects as exact instants', () => {
    expect(getTimeAgoUtc(new Date(Date.now() - 5 * 60 * 1000))).toBe('5 minutes ago');
  });

  it('treats epoch milliseconds as exact instants', () => {
    expect(getTimeAgoUtc(Date.now() - 5 * 60 * 1000)).toBe('5 minutes ago');
  });

  it('returns Unknown for empty input', () => {
    expect(getTimeAgoUtc('')).toBe('Unknown');
  });
});
