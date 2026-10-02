import { endShift, getCurrentSession, lockSession } from '@/api/mfa/shared-session';
import { logger } from '@/lib/logging';
import { toMfaProblem } from '@/lib/mfa/errors';
import useAuthStore from '@/stores/auth/store';
import { applySharedSessionStatus, type CurrentSessionData, markSharedSessionLocked, resetSharedSession, sharedLockGeneration, useSharedSessionStore } from '@/stores/shared-session/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

// ---------------------------------------------------------------------------
// Following a shared session (passkey plan section 10.5), with the same timings as Core Web's shared workstation
// bar: real operator input is reported at most every 30 seconds, the status is polled every minute (never as activity),
// a warning shows a minute before the idle lock and ten minutes before the shift ends. The server enforces every one of
// these; this module only keeps the screen honest about them.
// ---------------------------------------------------------------------------

export const ACTIVITY_INTERVAL_MS = 30000;
export const POLL_INTERVAL_MS = 60000;
export const IDLE_WARNING_SECONDS = 60;
export const SHIFT_NOTICE_SECONDS = 600;

let lastActivityReport = 0;
let inFlight: Promise<CurrentSessionData | null> | null = null;

const signedIn = (): boolean => useAuthStore.getState().status === 'signedIn';

/**
 * Asks the server how this session stands. A locked or expired session answers with the 401 the API client already
 * turns into the lock screen or a sign-out; anything else unreachable leaves the last known state, which the server
 * enforces anyway.
 */
export const checkSharedSession = (activity = false): Promise<CurrentSessionData | null> => {
  if (!signedIn()) {
    return Promise.resolve(null);
  }
  if (inFlight && !activity) {
    return inFlight;
  }
  const generation = sharedLockGeneration();
  const run = getCurrentSession(activity)
    .then((current) => {
      // Only an unlock ends a lock: an answer that left before a newer lock, or that says "unlocked" while this screen is
      // locked (a restart or an offline lock the server has not confirmed yet), is not applied.
      const stale = sharedLockGeneration() !== generation || (useSharedSessionStore.getState().locked && !current.Locked);
      if (!stale) {
        applySharedSessionStatus(current);
      }
      return current;
    })
    .catch(() => null)
    .finally(() => {
      if (inFlight === run) {
        inFlight = null;
      }
    });
  inFlight = run;
  return run;
};

/** Real input from the operator (touch, key, pointer): reported at most once per interval; "Stay signed in" forces it. */
export const reportOperatorActivity = (force = false): void => {
  const state = useSharedSessionStore.getState();
  if (!state.shared || state.locked || !signedIn()) {
    return;
  }
  const now = Date.now();
  if (!force && now - lastActivityReport < ACTIVITY_INTERVAL_MS) {
    return;
  }
  lastActivityReport = now;
  void checkSharedSession(true);
};

/** Stops the realtime hubs: a locked session must not keep receiving the department's traffic. */
export const stopRealtime = async (): Promise<void> => {
  const signalR = useSignalRStore.getState();
  await Promise.allSettled([signalR.disconnectUpdateHub(), signalR.disconnectGeolocationHub(), signalR.disconnectChatHub()]);
};

/** Reconnects the hubs after an unlock (the same session carries on). */
export const resumeRealtime = async (): Promise<void> => {
  const signalR = useSignalRStore.getState();
  await Promise.allSettled([signalR.connectUpdateHub(), signalR.connectGeolocationHub(), signalR.connectChatHub()]);
};

/**
 * Locks this shared session now: the Lock button, the app going to the background, or a restart. The screen locks even
 * when the server cannot be reached; the lock screen asks the server again (locking is idempotent there) before any
 * unlock, so a lock that did not reach it can never be skipped.
 */
export const lockSharedSession = async (reason: 'explicit' | 'background' | 'restart'): Promise<void> => {
  if (!signedIn()) {
    return;
  }
  const alreadyLocked = useSharedSessionStore.getState().locked;
  markSharedSessionLocked(null);
  void stopRealtime();
  if (alreadyLocked) {
    return;
  }
  try {
    const locked = await lockSession();
    markSharedSessionLocked(locked.LockVersion);
    logger.info({ message: 'Shared session locked', context: { reason } });
  } catch (error) {
    const code = toMfaProblem(error).code;
    if (code === 'not_shared_session') {
      // A personal session has nothing to lock: the server is the authority on which sessions are shared.
      resetSharedSession();
      return;
    }
    logger.warn({ message: 'Shared session lock did not reach the server; the lock screen will lock it', context: { reason, errorType: code } });
  }
};

/**
 * Ends this operator's shift (or hands the vehicle to the next operator), then drops the tokens, caches and sockets
 * through the ordinary sign-out. A shift end that cannot reach the server still signs out here; the server ends the
 * session at its shift ceiling regardless.
 */
export const endSharedShift = async (switchOperator: boolean): Promise<void> => {
  try {
    await endShift(switchOperator);
  } catch (error) {
    logger.warn({ message: 'End shift did not reach the server; signing out locally', context: { errorType: toMfaProblem(error).code } });
  }
  resetSharedSession();
  await useAuthStore.getState().logout();
};

/**
 * After an unlock: the same session resumes, so the refresh that waited for it runs now (the refresh engine left it
 * unscheduled while locked; a refresh that was still scheduled shares this one) and the hubs reconnect.
 */
export const afterSharedUnlock = async (): Promise<void> => {
  lastActivityReport = Date.now();
  await useAuthStore.getState().refreshAccessToken();
  void resumeRealtime();
};

/** Test hook. */
export const _resetSharedSessionController = (): void => {
  lastActivityReport = 0;
  inFlight = null;
};
