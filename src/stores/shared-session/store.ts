import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Shared session state (passkey plan section 10.5). The server owns the idle lock, the lock version and the shift
// end; this store only follows what it said last. It imports nothing, so the auth store, the API client and the
// data-protection store can all tell it "the session is locked" without an import cycle. Never persisted: a restart
// asks the server again (and a shared installation locks on restart anyway).
// ---------------------------------------------------------------------------

/** `GET sessions/current` and `complete-unlock` (`CurrentSessionResultData`). */
export interface CurrentSessionData {
  Operator: string | null;
  Client: string | null;
  Shared: boolean;
  Locked: boolean;
  LockVersion: number;
  LockReason: 'explicit' | 'idle' | null;
  IdleLockMinutes: number;
  IdleLocksAt: string | null;
  ShiftEndsAt: string | null;
  InstallationLabel: string | null;
}

export interface SharedSessionState {
  /** True once the server said this session is shared (or answered a request with the locked 401). */
  shared: boolean;
  locked: boolean;
  /** The lock the unlock must answer; null until the server names it (a locked refresh does not). */
  lockVersion: number | null;
  lockReason: 'explicit' | 'idle' | null;
  idleLockMinutes: number | null;
  /** Epoch ms of the server's idle deadline; null while locked or unknown. */
  idleLocksAt: number | null;
  shiftEndsAt: number | null;
  /** The member signed in on this shared session, when the server named them (the unlock does). */
  operator: string | null;
  installationLabel: string | null;
  /** Epoch ms of the last answer from the server. */
  checkedAt: number | null;
}

export const INITIAL_SHARED_SESSION_STATE: SharedSessionState = {
  shared: false,
  locked: false,
  lockVersion: null,
  lockReason: null,
  idleLockMinutes: null,
  idleLocksAt: null,
  shiftEndsAt: null,
  operator: null,
  installationLabel: null,
  checkedAt: null,
};

export const useSharedSessionStore = create<SharedSessionState>()(() => ({ ...INITIAL_SHARED_SESSION_STATE }));

/** Server timestamps may lack a zone; they are UTC. */
const utc = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(/([zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Takes the server's view of the session. A missing operator keeps the one already known (`current` never names it). */
export const applySharedSessionStatus = (data: CurrentSessionData): void => {
  useSharedSessionStore.setState((state) => ({
    shared: data.Shared === true,
    locked: data.Locked === true,
    lockVersion: typeof data.LockVersion === 'number' ? data.LockVersion : state.lockVersion,
    lockReason: data.LockReason ?? null,
    idleLockMinutes: typeof data.IdleLockMinutes === 'number' ? data.IdleLockMinutes : state.idleLockMinutes,
    idleLocksAt: data.Locked ? null : utc(data.IdleLocksAt),
    shiftEndsAt: utc(data.ShiftEndsAt) ?? state.shiftEndsAt,
    operator: data.Operator ?? state.operator,
    installationLabel: data.InstallationLabel ?? state.installationLabel,
    checkedAt: Date.now(),
  }));
};

// Counts every lock seen here, so a status request that left before a lock can tell its answer is stale (plan section
// 12.5.4: late results are discarded by lock version).
let lockGeneration = 0;

export const sharedLockGeneration = (): number => lockGeneration;

/**
 * The session is locked: a 401 `shared_session_locked` (with its lock version), a refresh refused while locked (without
 * one), or a lock this app made. The tokens stay; the lock screen unlocks the same session.
 */
export const markSharedSessionLocked = (lockVersion: number | null): void => {
  lockGeneration += 1;
  useSharedSessionStore.setState((state) => ({
    shared: true,
    locked: true,
    lockVersion: typeof lockVersion === 'number' ? lockVersion : state.lockVersion,
    idleLocksAt: null,
    checkedAt: Date.now(),
  }));
};

/** Sign-out, end of shift, or a personal session: nothing of the last shared session is kept. */
export const resetSharedSession = (): void => {
  useSharedSessionStore.setState({ ...INITIAL_SHARED_SESSION_STATE });
};

// A session restored from storage at launch, rather than signed in during this run: a shared one locks at once, so a
// restarted vehicle device never opens on the last operator's session.
let restoredAtLaunch = false;

export const noteSessionRestoredAtLaunch = (): void => {
  restoredAtLaunch = true;
};

/** True once after a launch that restored a session; the caller locks a shared session then. */
export const consumeSessionRestoredAtLaunch = (): boolean => {
  const restored = restoredAtLaunch;
  restoredAtLaunch = false;
  return restored;
};
