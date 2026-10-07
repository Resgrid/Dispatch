import { CallState, canDispatchCallNow, getCallScheduledDispatchTime, isCallActive, isCallAwaitingScheduledDispatch, isCallClosed, isCallPending, isCallScheduled } from '../utils';

// Core's CallStates: 0 Active, 1 Closed, 2 Cancelled, 3 Unfounded, 4 Founded, 5 Minor, 6 Transferred,
// 7 False Alarm, 8 Pending.
const CLOSED_STATES = [1, 2, 3, 4, 5, 6, 7];

describe('CallState', () => {
  it('matches the Core call state numbers', () => {
    expect(CallState).toEqual({ ACTIVE: 0, CLOSED: 1, CANCELLED: 2, UNFOUNDED: 3, FOUNDED: 4, MINOR: 5, TRANSFERRED: 6, FALSE_ALARM: 7, PENDING: 8 });
  });
});

describe('isCallActive', () => {
  it('is true only for Active (0)', () => {
    expect(isCallActive(0)).toBe(true);
    expect(isCallActive('0')).toBe(true);
    CLOSED_STATES.forEach((state) => expect(isCallActive(state)).toBe(false));
  });

  it('is false for a pending call, which has not been dispatched', () => {
    expect(isCallActive(8)).toBe(false);
    expect(isCallActive('8')).toBe(false);
  });

  it('still accepts the state names older API versions send', () => {
    expect(isCallActive('Active')).toBe(true);
    expect(isCallActive(' open ')).toBe(true);
    expect(isCallActive('Closed')).toBe(false);
    expect(isCallActive('Pending')).toBe(false);
  });

  it('is false for a missing state', () => {
    expect(isCallActive(null)).toBe(false);
    expect(isCallActive(undefined)).toBe(false);
    expect(isCallActive('')).toBe(false);
  });
});

describe('isCallPending', () => {
  it('is true only for Pending (8)', () => {
    expect(isCallPending(8)).toBe(true);
    expect(isCallPending('8')).toBe(true);
    expect(isCallPending('pending')).toBe(true);
    expect(isCallPending(0)).toBe(false);
    // 2 was "pending" under the old, wrong mapping; it is Cancelled.
    expect(isCallPending(2)).toBe(false);
    expect(isCallPending(null)).toBe(false);
  });
});

describe('isCallClosed', () => {
  it('is true for every close type (1-7)', () => {
    CLOSED_STATES.forEach((state) => expect(isCallClosed(state)).toBe(true));
    expect(isCallClosed('1')).toBe(true);
  });

  it('is false for Active and Pending calls', () => {
    expect(isCallClosed(0)).toBe(false);
    expect(isCallClosed(8)).toBe(false);
    expect(isCallClosed('8')).toBe(false);
  });

  it('accepts close type names', () => {
    expect(isCallClosed('Closed')).toBe(true);
    expect(isCallClosed('Cancelled')).toBe(true);
    expect(isCallClosed('False Alarm')).toBe(true);
    expect(isCallClosed('Active')).toBe(false);
    expect(isCallClosed(undefined)).toBe(false);
  });
});

describe('isCallScheduled', () => {
  it('only matches the Scheduled name; Core has no scheduled state number', () => {
    expect(isCallScheduled('Scheduled')).toBe(true);
    // 3 is Unfounded in Core, not scheduled.
    expect(isCallScheduled(3)).toBe(false);
    expect(isCallScheduled('3')).toBe(false);
    expect(isCallScheduled(0)).toBe(false);
  });
});

describe('isCallAwaitingScheduledDispatch / canDispatchCallNow', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');

  it('is a scheduled call while its dispatch time is in the future', () => {
    expect(isCallAwaitingScheduledDispatch({ State: 0, DispatchedOnUtc: '2026-10-06T13:00:00Z' }, now)).toBe(true);
    expect(canDispatchCallNow({ State: 0, DispatchedOnUtc: '2026-10-06T13:00:00Z' }, now)).toBe(true);
  });

  it('reads a zone-less dispatch time as UTC', () => {
    expect(isCallAwaitingScheduledDispatch({ State: 0, DispatchedOnUtc: '2026-10-06T12:30:00' }, now)).toBe(true);
    expect(isCallAwaitingScheduledDispatch({ State: 0, DispatchedOnUtc: '2026-10-06T11:30:00' }, now)).toBe(false);
  });

  it('cannot be dispatched now once the scheduled time has passed or when it was never scheduled', () => {
    expect(canDispatchCallNow({ State: 0, DispatchedOnUtc: '2026-10-06T11:00:00Z' }, now)).toBe(false);
    expect(canDispatchCallNow({ State: 0, DispatchedOnUtc: '' }, now)).toBe(false);
  });

  it('can always dispatch a pending call, and never a closed one', () => {
    expect(canDispatchCallNow({ State: 8 }, now)).toBe(true);
    expect(canDispatchCallNow({ State: 1, DispatchedOnUtc: '2026-10-06T13:00:00Z' }, now)).toBe(false);
  });
});

describe('getCallScheduledDispatchTime', () => {
  it('prefers the department-local time and falls back to UTC', () => {
    expect(getCallScheduledDispatchTime({ ScheduledOn: '2026-10-06T08:00:00', DispatchedOn: '2026-10-06T07:00:00' })).toBe('2026-10-06T08:00:00');
    expect(getCallScheduledDispatchTime({ DispatchedOn: '2026-10-06T07:00:00', DispatchedOnUtc: '2026-10-06T11:00:00Z' })).toBe('2026-10-06T07:00:00');
    expect(getCallScheduledDispatchTime({ DispatchedOnUtc: '2026-10-06T11:00:00Z' })).toBe('2026-10-06T11:00:00Z');
    expect(getCallScheduledDispatchTime({})).toBe('');
  });
});
