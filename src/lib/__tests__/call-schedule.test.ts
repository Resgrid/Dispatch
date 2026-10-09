import { getScheduledDispatchPrefill, isDispatchTimeTooSoon, MIN_DISPATCH_LEAD_MINUTES, parseUtcTimestamp, toDispatchOnUtc } from '@/lib/call-schedule';

const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const minutesFromNow = (minutes: number) => new Date(NOW + minutes * 60 * 1000).toISOString();

describe('parseUtcTimestamp', () => {
  it('reads a timestamp without a zone as UTC', () => {
    expect(parseUtcTimestamp('2026-10-09T14:30:00')?.toISOString()).toBe('2026-10-09T14:30:00.000Z');
    expect(parseUtcTimestamp('2026-10-09T14:30:00.5')?.toISOString()).toBe('2026-10-09T14:30:00.500Z');
  });

  it('keeps an explicit zone', () => {
    expect(parseUtcTimestamp('2026-10-09T14:30:00Z')?.toISOString()).toBe('2026-10-09T14:30:00.000Z');
    expect(parseUtcTimestamp('2026-10-09T16:30:00+02:00')?.toISOString()).toBe('2026-10-09T14:30:00.000Z');
  });

  it('is null for blank or unreadable input', () => {
    expect(parseUtcTimestamp('')).toBeNull();
    expect(parseUtcTimestamp('   ')).toBeNull();
    expect(parseUtcTimestamp(undefined)).toBeNull();
    expect(parseUtcTimestamp('not a date')).toBeNull();
  });
});

describe('toDispatchOnUtc', () => {
  it('is the ISO UTC instant of a picked time', () => {
    expect(toDispatchOnUtc('2026-10-09T14:30:00.000Z')).toBe('2026-10-09T14:30:00.000Z');
  });

  it('is undefined when nothing was picked, so nothing is sent', () => {
    expect(toDispatchOnUtc('')).toBeUndefined();
    expect(toDispatchOnUtc(undefined)).toBeUndefined();
  });
});

describe('isDispatchTimeTooSoon', () => {
  it(`refuses a time less than ${MIN_DISPATCH_LEAD_MINUTES} minutes ahead or already past`, () => {
    expect(isDispatchTimeTooSoon(minutesFromNow(14), NOW)).toBe(true);
    expect(isDispatchTimeTooSoon(minutesFromNow(-5), NOW)).toBe(true);
  });

  it(`accepts a time at least ${MIN_DISPATCH_LEAD_MINUTES} minutes ahead`, () => {
    expect(isDispatchTimeTooSoon(minutesFromNow(15), NOW)).toBe(false);
    expect(isDispatchTimeTooSoon(minutesFromNow(90), NOW)).toBe(false);
  });

  it('has nothing to refuse when no time was picked', () => {
    expect(isDispatchTimeTooSoon('', NOW)).toBe(false);
    expect(isDispatchTimeTooSoon(undefined, NOW)).toBe(false);
  });
});

describe('getScheduledDispatchPrefill', () => {
  it('starts with the stored time while the call is still scheduled, read as UTC without a Z', () => {
    expect(getScheduledDispatchPrefill('2026-10-09T14:30:00', NOW)).toBe('2026-10-09T14:30:00.000Z');
  });

  it('starts blank for a call that already went out or was never scheduled', () => {
    expect(getScheduledDispatchPrefill('2026-10-08T11:00:00', NOW)).toBe('');
    expect(getScheduledDispatchPrefill('0001-01-01T00:00:00', NOW)).toBe('');
    expect(getScheduledDispatchPrefill('', NOW)).toBe('');
    expect(getScheduledDispatchPrefill(null, NOW)).toBe('');
  });
});
