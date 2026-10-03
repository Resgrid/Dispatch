import {
  applySharedSessionStatus,
  consumeSessionRestoredAtLaunch,
  type CurrentSessionData,
  INITIAL_SHARED_SESSION_STATE,
  markSharedSessionLocked,
  noteSessionRestoredAtLaunch,
  resetSharedSession,
  useSharedSessionStore,
} from '../store';

const current = (overrides: Partial<CurrentSessionData> = {}): CurrentSessionData => ({
  Operator: null,
  Client: 'dispatch',
  Shared: true,
  Locked: false,
  LockVersion: 3,
  LockReason: null,
  IdleLockMinutes: 15,
  IdleLocksAt: '2026-09-29T12:15:00Z',
  ShiftEndsAt: '2026-09-29T20:00:00',
  InstallationLabel: 'Engine 12',
  ...overrides,
});

describe('shared session store', () => {
  beforeEach(() => resetSharedSession());

  it('follows the server: deadlines in UTC, and the operator kept when `current` does not name one', () => {
    applySharedSessionStatus(current({ Operator: 'jdoe' }));
    applySharedSessionStatus(current());

    const state = useSharedSessionStore.getState();
    expect(state.shared).toBe(true);
    expect(state.locked).toBe(false);
    expect(state.lockVersion).toBe(3);
    expect(state.idleLocksAt).toBe(Date.parse('2026-09-29T12:15:00Z'));
    // A zone-less server time is UTC.
    expect(state.shiftEndsAt).toBe(Date.parse('2026-09-29T20:00:00Z'));
    expect(state.operator).toBe('jdoe');
    expect(state.installationLabel).toBe('Engine 12');
    expect(state.checkedAt).not.toBeNull();
  });

  it('has no idle deadline while locked', () => {
    applySharedSessionStatus(current({ Locked: true, LockReason: 'idle', LockVersion: 4 }));
    expect(useSharedSessionStore.getState()).toMatchObject({ locked: true, lockReason: 'idle', lockVersion: 4, idleLocksAt: null });
  });

  it('marks a lock from a 401 (with its version) or a refused refresh (keeping the last version)', () => {
    applySharedSessionStatus(current({ LockVersion: 5 }));
    markSharedSessionLocked(null);
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: true, lockVersion: 5, idleLocksAt: null });

    markSharedSessionLocked(9);
    expect(useSharedSessionStore.getState().lockVersion).toBe(9);
  });

  it('keeps nothing after a reset', () => {
    applySharedSessionStatus(current({ Operator: 'jdoe', Locked: true }));
    resetSharedSession();
    expect(useSharedSessionStore.getState()).toEqual(INITIAL_SHARED_SESSION_STATE);
  });

  it('reports a restored launch exactly once', () => {
    expect(consumeSessionRestoredAtLaunch()).toBe(false);
    noteSessionRestoredAtLaunch();
    expect(consumeSessionRestoredAtLaunch()).toBe(true);
    expect(consumeSessionRestoredAtLaunch()).toBe(false);
  });
});
