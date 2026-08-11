import { cancelScheduledTokenRefresh, scheduleTokenRefresh } from '../token-refresh';

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../api', () => ({
  refreshTokenRequest: jest.fn(),
}));

describe('scheduleTokenRefresh', () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    cancelScheduledTokenRefresh();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const lastScheduledDelay = (): number => setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1] as number;

  it('refreshes one buffer before expiry for normal lifetimes', () => {
    scheduleTokenRefresh(86400); // 24h, the server default
    expect(lastScheduledDelay()).toBe(86400 * 1000 - 60000);
  });

  it('refreshes at half the lifetime when the lifetime approaches the buffer', () => {
    // A 1-minute server lifetime equals the buffer; the old max(lifetime - buffer, min)
    // clamped this to the 5s minimum and refreshed in a perpetual tight loop.
    scheduleTokenRefresh(60);
    expect(lastScheduledDelay()).toBe(30000);
  });

  it('never schedules below the minimum delay', () => {
    scheduleTokenRefresh(8);
    expect(lastScheduledDelay()).toBe(5000);

    scheduleTokenRefresh(0);
    expect(lastScheduledDelay()).toBe(5000);
  });

  it('replaces a previously scheduled refresh instead of stacking timers', () => {
    scheduleTokenRefresh(3600);
    scheduleTokenRefresh(7200);
    expect(jest.getTimerCount()).toBe(1);
  });
});
